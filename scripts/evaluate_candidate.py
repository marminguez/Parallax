"""PARALLAX — EXP-001B single-candidate evaluator.

First end-to-end scientific smoke test:

SRTMGL30
    -> source window + halo
    -> local AEQD
    -> 50 x 50 km / 1 km metric grid
    -> slope
    -> frozen 8-bin histogram
    -> Jensen-Shannon distance vs Jezero

MOD44W land eligibility is intentionally not evaluated yet.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject

from parallax.data.srtmgl30 import (
    bounds_from_tile_name,
    candidate_longitudes,
    coordinate_to_pixel,
    extract_cross_tile_window_ew,
    extract_cross_tile_window_ns,
    extract_four_tile_window,
    extract_single_tile_source_window,
    find_tile_for_coordinate,
    geographic_source_transform,
    local_aeqd_crs,
    metric_grid_transform,
    read_tile_dem,
    source_window_shape,
)
from parallax.data.mod44w import (
    land_fraction_single_tile,
    latlon_to_tile,
    local_water_mask_path,
    read_water_mask,
    water_mask_to_metric_grid,
)
from parallax.matching.similarity import (
    jensen_shannon_distance,
)


RAW_SRTM = Path(
    "data/earth/coarse/raw"
)

JEZERO_TARGET = Path(
    "results/exp001/jezero_target_50km_v0_4.json"
)

WINDOW_M = 50_000.0
RESOLUTION_M = 1_000.0
HALO_PIXELS = 2

SLOPE_BINS = (
    (0.0, 1.0),
    (1.0, 2.0),
    (2.0, 3.0),
    (3.0, 5.0),
    (5.0, 10.0),
    (10.0, 15.0),
    (15.0, 20.0),
    (20.0, np.inf),
)


def slope_degrees(
    dem: np.ndarray,
    resolution_m: float,
) -> np.ndarray:
    """Calculate slope in degrees on the metric grid."""

    if dem.ndim != 2:
        raise ValueError(
            "DEM must be a two-dimensional array."
        )

    dz_dy, dz_dx = np.gradient(
        dem,
        resolution_m,
        resolution_m,
    )

    gradient = np.hypot(
        dz_dx,
        dz_dy,
    )

    return np.degrees(
        np.arctan(gradient)
    )



def land_slope_stencil(
    land: np.ndarray,
) -> np.ndarray:
    """
    Return cells whose slope stencil is entirely on land.

    A valid interior cell requires the center plus its four
    cardinal neighbours to be land. Border cells are invalid
    because np.gradient cannot use a complete central stencil.
    """

    if land.ndim != 2:
        raise ValueError(
            "Land mask must be a two-dimensional array."
        )

    valid = np.zeros_like(
        land,
        dtype=bool,
    )

    if (
        land.shape[0] < 3
        or land.shape[1] < 3
    ):
        return valid

    valid[1:-1, 1:-1] = (
        land[1:-1, 1:-1]
        & land[1:-1, :-2]
        & land[1:-1, 2:]
        & land[:-2, 1:-1]
        & land[2:, 1:-1]
    )

    return valid

def slope_histogram(
    slope: np.ndarray,
    valid_mask: np.ndarray | None = None,
) -> np.ndarray:
    """Return normalized probabilities for the frozen 8 slope bins."""

    finite = np.isfinite(slope)

    if valid_mask is not None:
        if valid_mask.shape != slope.shape:
            raise ValueError(
                "valid_mask must have the same shape as slope."
            )

        finite &= valid_mask

    values = slope[
        finite
    ]

    if values.size == 0:
        raise ValueError(
            "Slope array contains no finite values."
        )

    counts = []

    for lower, upper in SLOPE_BINS:
        if np.isinf(upper):
            mask = values >= lower
        else:
            mask = (
                (values >= lower)
                & (values < upper)
            )

        counts.append(
            int(np.count_nonzero(mask))
        )

    counts = np.asarray(
        counts,
        dtype=float,
    )

    total = counts.sum()

    if total <= 0:
        raise ValueError(
            "Slope histogram contains no probability mass."
        )

    return counts / total


def load_jezero_histogram() -> np.ndarray:
    """Load the frozen 1000 m Jezero slope distribution."""

    data = json.loads(
        JEZERO_TARGET.read_text()
    )

    distribution = (
        data["terrain"]
        ["1000m"]
        ["slope"]
        ["distribution_pct"]
    )

    keys = (
        "0-1",
        "1-2",
        "2-3",
        "3-5",
        "5-10",
        "10-15",
        "15-20",
        ">=20",
    )

    values = np.asarray(
        [
            distribution[key]
            for key in keys
        ],
        dtype=float,
    )

    if values.size != 8:
        raise ValueError(
            "Jezero histogram must contain exactly 8 bins."
        )

    if values.sum() <= 0:
        raise ValueError(
            "Jezero histogram has no probability mass."
        )

    return values / values.sum()


def available_srtm_tiles() -> list[Path]:
    """Return available local SRTMGL30 ZIP tiles."""

    tiles = sorted(
        RAW_SRTM.glob(
            "*.SRTMGL30.dem.zip"
        )
    )

    if not tiles:
        raise FileNotFoundError(
            f"No SRTMGL30 ZIP tiles found in {RAW_SRTM}"
        )

    return tiles


def resolve_source_tiles(
    latitude_deg: float,
    longitude_deg: float,
) -> dict[str, Path]:
    """
    Resolve the SRTM tiles required by the source window.

    The candidate centre determines the primary tile. Additional tiles
    are discovered by probing the source-window cardinal directions.
    """

    tiles = available_srtm_tiles()

    center_tile = find_tile_for_coordinate(
        latitude_deg,
        longitude_deg,
        tiles,
    )

    base_west, base_south, base_east, base_north = (
        __import__(
            "parallax.data.srtmgl30",
            fromlist=["physical_window_bounds"],
        ).physical_window_bounds(
            latitude_deg,
            longitude_deg,
            WINDOW_M,
        )
    )

    halo_deg = HALO_PIXELS * (
        1.0 / 120.0
    )

    west = base_west - halo_deg
    east = base_east + halo_deg
    south = base_south - halo_deg
    north = base_north + halo_deg

    probe_points = [
        (latitude_deg, longitude_deg),
        (latitude_deg, west + 1e-10),
        (latitude_deg, east - 1e-10),
        (south + 1e-10, longitude_deg),
        (north - 1e-10, longitude_deg),
    ]

    resolved: dict[str, Path] = {}

    for lat, lon in probe_points:
        try:
            tile = find_tile_for_coordinate(
                lat,
                lon,
                tiles,
            )
        except ValueError:
            continue

        bounds = bounds_from_tile_name(
            tile.name
        )

        if bounds.south <= lat < bounds.north:
            if bounds.west <= lon < bounds.east:
                resolved[tile.name] = tile

    resolved[center_tile.name] = center_tile

    return {
        name: path
        for name, path in sorted(
            resolved.items()
        )
    }


def load_required_dems(
    tile_paths: dict[str, Path],
) -> dict[str, np.ndarray]:
    """Load all resolved SRTM DEMs."""

    return {
        name: read_tile_dem(path)
        for name, path in tile_paths.items()
    }


def classify_tiles(
    latitude_deg: float,
    longitude_deg: float,
    tile_paths: dict[str, Path],
) -> dict[str, Path]:
    """
    Classify resolved tiles relative to the candidate.

    The center tile is the anchor. Neighbours are classified by their
    geographic bounds.
    """

    center = find_tile_for_coordinate(
        latitude_deg,
        longitude_deg,
        tile_paths.values(),
    )

    center_bounds = bounds_from_tile_name(
        center.name
    )

    result = {
        "center": center,
    }

    for path in tile_paths.values():
        if path == center:
            continue

        bounds = bounds_from_tile_name(
            path.name
        )

        if (
            bounds.south == center_bounds.south
            and bounds.north == center_bounds.north
        ):
            if bounds.east == center_bounds.west:
                result["west"] = path
            elif bounds.west == center_bounds.east:
                result["east"] = path

        if (
            bounds.west == center_bounds.west
            and bounds.east == center_bounds.east
        ):
            if bounds.north == center_bounds.south:
                result["south"] = path
            elif bounds.south == center_bounds.north:
                result["north"] = path

    return result


def extract_source_window(
    latitude_deg: float,
    longitude_deg: float,
) -> tuple[np.ndarray, dict]:
    """Extract the source DEM required for metric reprojection."""

    tile_paths = resolve_source_tiles(
        latitude_deg,
        longitude_deg,
    )

    dem_by_name = load_required_dems(
        tile_paths
    )

    classified = classify_tiles(
        latitude_deg,
        longitude_deg,
        tile_paths,
    )

    center_path = classified["center"]
    center_bounds = bounds_from_tile_name(
        center_path.name
    )

    center_dem = dem_by_name[
        center_path.name
    ]

    if "west" in classified and "east" not in classified:
        window = extract_cross_tile_window_ew(
            dem_by_name[
                classified["west"].name
            ],
            center_dem,
            latitude_deg,
            longitude_deg,
            bounds_from_tile_name(
                classified["west"].name
            ),
            window_m=WINDOW_M,
            halo_pixels=HALO_PIXELS,
        )
        mode = "E-W"

    elif "east" in classified and "west" not in classified:
        window = extract_cross_tile_window_ew(
            center_dem,
            dem_by_name[
                classified["east"].name
            ],
            latitude_deg,
            longitude_deg,
            center_bounds,
            window_m=WINDOW_M,
            halo_pixels=HALO_PIXELS,
        )
        mode = "E-W"

    elif "north" in classified and "south" not in classified:
        window = extract_cross_tile_window_ns(
            center_dem,
            dem_by_name[
                classified["north"].name
            ],
            latitude_deg,
            longitude_deg,
            bounds_from_tile_name(
                classified["north"].name
            ),
            window_m=WINDOW_M,
            halo_pixels=HALO_PIXELS,
        )
        mode = "N-S"

    elif "south" in classified and "north" not in classified:
        window = extract_cross_tile_window_ns(
            dem_by_name[
                classified["south"].name
            ],
            center_dem,
            latitude_deg,
            longitude_deg,
            center_bounds,
            window_m=WINDOW_M,
            halo_pixels=HALO_PIXELS,
        )
        mode = "N-S"

    elif (
        "west" in classified
        and "north" in classified
    ):
        nw = center_dem
        ne = dem_by_name[
            classified["east"].name
        ] if "east" in classified else None
        sw = dem_by_name[
            classified["south"].name
        ] if "south" in classified else None

        if ne is None or sw is None:
            raise ValueError(
                "Incomplete four-tile neighbourhood."
            )

        se_name = None

        for path in tile_paths.values():
            bounds = bounds_from_tile_name(
                path.name
            )

            if (
                bounds.west == center_bounds.east
                and bounds.north == center_bounds.south
            ):
                se_name = path.name
                break

        if se_name is None:
            raise ValueError(
                "Missing SE tile for four-tile window."
            )

        window = extract_four_tile_window(
            dem_by_name[
                classified["south"].name
            ],
            dem_by_name[se_name],
            nw,
            dem_by_name[
                classified["east"].name
            ],
            latitude_deg,
            longitude_deg,
            center_bounds,
            window_m=WINDOW_M,
            halo_pixels=HALO_PIXELS,
        )
        mode = "4-TILE"

    else:
        window = extract_single_tile_source_window(
            center_dem,
            latitude_deg,
            longitude_deg,
            center_bounds,
            window_m=WINDOW_M,
            halo_pixels=HALO_PIXELS,
        )
        mode = "SINGLE"

    return window, {
        "mode": mode,
        "tiles": sorted(tile_paths),
    }


def evaluate_candidate(
    latitude_deg: float,
    longitude_deg: float,
) -> dict:
    """Evaluate one Earth candidate."""

    source, extraction = extract_source_window(
        latitude_deg,
        longitude_deg,
    )

    source_transform, source_width, source_height = (
        geographic_source_transform(
            latitude_deg,
            longitude_deg,
            window_m=WINDOW_M,
            halo_pixels=HALO_PIXELS,
        )
    )

    expected_source_shape = (
        source_height,
        source_width,
    )

    if source.shape != expected_source_shape:
        raise ValueError(
            "Source shape does not match source transform: "
            f"{source.shape} != {expected_source_shape}"
        )

    crs = local_aeqd_crs(
        latitude_deg,
        longitude_deg,
    )

    destination_transform, width, height = (
        metric_grid_transform(
            window_m=WINDOW_M,
            resolution_m=RESOLUTION_M,
        )
    )

    destination = np.full(
        (height, width),
        np.nan,
        dtype="float64",
    )

    reproject(
        source,
        destination,
        src_transform=source_transform,
        src_crs="EPSG:4326",
        dst_transform=destination_transform,
        dst_crs=crs,
        resampling=Resampling.bilinear,
        src_nodata=np.nan,
        dst_nodata=np.nan,
    )

    finite = np.isfinite(destination)

    if not finite.all():
        raise ValueError(
            "Metric grid does not have complete elevation coverage: "
            f"{finite.sum()} / {destination.size}"
        )

    slope = slope_degrees(
        destination,
        RESOLUTION_M,
    )

    mod_h, mod_v = latlon_to_tile(
        latitude_deg,
        longitude_deg,
    )

    mod_path = local_water_mask_path(
        mod_h,
        mod_v,
    )

    mod_mask = read_water_mask(
        mod_path
    )

    mod_metric_grid = water_mask_to_metric_grid(
        mask=mod_mask,
        latitude_deg=latitude_deg,
        longitude_deg=longitude_deg,
        h=mod_h,
        v=mod_v,
        window_m=WINDOW_M,
        resolution_m=RESOLUTION_M,
    )

    terrain_land = (
        mod_metric_grid == 0
    )

    terrain_valid = land_slope_stencil(
        terrain_land
    )

    q = slope_histogram(
        slope,
        valid_mask=terrain_valid,
    )

    p = load_jezero_histogram()

    jsd = jensen_shannon_distance(
        p,
        q,
    )

    land_result = land_fraction_single_tile(
        mask=mod_mask,
        latitude_deg=latitude_deg,
        longitude_deg=longitude_deg,
        h=mod_h,
        v=mod_v,
        window_m=WINDOW_M,
    )

    land_fraction = land_result[
        "land_fraction"
    ]

    land_status = (
        "ELIGIBLE"
        if land_fraction >= 0.90
        else "REJECTED"
    )

    return {
        "latitude_deg": float(latitude_deg),
        "longitude_deg": float(longitude_deg),
        "srtm": {
            "extraction_mode": extraction["mode"],
            "tiles": extraction["tiles"],
            "source_shape": list(
                source.shape
            ),
            "source_finite": int(
                np.isfinite(source).sum()
            ),
            "source_total": int(
                source.size
            ),
        },
        "metric_grid": {
            "shape": [
                int(height),
                int(width),
            ],
            "resolution_m": RESOLUTION_M,
            "window_m": WINDOW_M,
            "crs": crs.to_string(),
            "resampling": "bilinear",
        },
        "elevation": {
            "min_m": float(
                np.min(destination)
            ),
            "mean_m": float(
                np.mean(destination)
            ),
            "max_m": float(
                np.max(destination)
            ),
        },
        "slope": {
            "mean_deg": float(
                np.mean(slope)
            ),
            "p50_deg": float(
                np.percentile(slope, 50)
            ),
            "p90_deg": float(
                np.percentile(slope, 90)
            ),
            "p95_deg": float(
                np.percentile(slope, 95)
            ),
            "distribution": {
                "0-1": float(q[0]),
                "1-2": float(q[1]),
                "2-3": float(q[2]),
                "3-5": float(q[3]),
                "5-10": float(q[4]),
                "10-15": float(q[5]),
                "15-20": float(q[6]),
                ">=20": float(q[7]),
            },
        },
        "similarity": {
            "metric": "jensen_shannon_distance",
            "distance": float(jsd),
        },
        "land_eligibility": {
            "status": land_status,
            "threshold": 0.90,
            "tile": f"h{mod_h:02d}v{mod_v:02d}",
            "land_fraction": float(
                land_fraction
            ),
            "land_pixels": land_result[
                "land_pixels"
            ],
            "water_pixels": land_result[
                "water_pixels"
            ],
            "excluded_pixels": land_result[
                "excluded_pixels"
            ],
            "valid_pixels": land_result[
                "valid_pixels"
            ],
            "footprint_pixels": land_result[
                "footprint_pixels"
            ],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--lat",
        type=float,
        required=True,
    )

    parser.add_argument(
        "--lon",
        type=float,
        required=True,
    )

    args = parser.parse_args()

    result = evaluate_candidate(
        args.lat,
        args.lon,
    )

    print()
    print(
        "PARALLAX — EXP-001B SINGLE CANDIDATE"
    )
    print("=" * 52)

    print(
        f"Location: "
        f"{result['latitude_deg']:.6f}, "
        f"{result['longitude_deg']:.6f}"
    )

    print()
    print("SRTM")
    print("-" * 52)

    print(
        "Mode:",
        result["srtm"]["extraction_mode"],
    )

    print(
        "Source:",
        result["srtm"]["source_shape"],
    )

    print(
        "Finite:",
        result["srtm"]["source_finite"],
        "/",
        result["srtm"]["source_total"],
    )

    print()
    print("METRIC GRID")
    print("-" * 52)

    print(
        "Shape:",
        result["metric_grid"]["shape"],
    )

    print(
        "Resolution:",
        result["metric_grid"]["resolution_m"],
        "m",
    )

    print(
        "Resampling:",
        result["metric_grid"]["resampling"],
    )

    print()
    print("ELEVATION")
    print("-" * 52)

    print(
        f"Min:  "
        f"{result['elevation']['min_m']:.3f} m"
    )

    print(
        f"Mean: "
        f"{result['elevation']['mean_m']:.3f} m"
    )

    print(
        f"Max:  "
        f"{result['elevation']['max_m']:.3f} m"
    )

    print()
    print("SLOPE DISTRIBUTION")
    print("-" * 52)

    for key, value in (
        result["slope"]["distribution"]
        .items()
    ):
        print(
            f"{key:>7}: "
            f"{value * 100:8.3f}%"
        )

    print()
    print("SIMILARITY")
    print("-" * 52)

    print(
        f"JSD: "
        f"{result['similarity']['distance']:.6f}"
    )

    print()
    print("LAND ELIGIBILITY")
    print("-" * 52)

    land = result["land_eligibility"]

    print(
        "Tile:",
        land["tile"],
    )

    print(
        f"Land fraction: "
        f"{land['land_fraction'] * 100:.3f}%"
    )

    print(
        "Land pixels:",
        land["land_pixels"],
    )

    print(
        "Water pixels:",
        land["water_pixels"],
    )

    print(
        "Excluded pixels:",
        land["excluded_pixels"],
    )

    print(
        f"Threshold: "
        f"{land['threshold'] * 100:.0f}%"
    )

    print(
        "Eligibility:",
        land["status"],
    )

    print()
    print(
        "RESULT: PASS — candidate "
        "evaluated end-to-end"
    )


if __name__ == "__main__":
    main()
