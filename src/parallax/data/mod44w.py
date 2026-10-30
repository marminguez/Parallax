"""MOD44W V061 sinusoidal-grid geometry utilities."""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path


MODIS_RADIUS_M = 6_371_007.181
MODIS_TILE_SIZE_M = 1_111_950.519667

MODIS_XMIN_M = -20_015_109.354006
MODIS_YMAX_M = 10_007_554.677003

MODIS_PIXELS_PER_TILE = 4800

MODIS_PIXEL_SIZE_M = (
    MODIS_TILE_SIZE_M / MODIS_PIXELS_PER_TILE
)

MOD44W_CATALOG_PATH = Path(
    "data/earth/mod44w_granules.json"
)

MOD44W_PROCESSED_DIR = Path(
    "data/earth/mod44w/processed"
)


def local_water_mask_path(
    h: int,
    v: int,
    processed_dir: Path = MOD44W_PROCESSED_DIR,
) -> Path:
    """Return the local cached native MOD44W water-mask path."""

    if not 0 <= h < 36:
        raise ValueError(
            "h must be in [0, 35]."
        )

    if not 0 <= v < 18:
        raise ValueError(
            "v must be in [0, 17]."
        )

    tile_id = f"h{h:02d}v{v:02d}"

    path = (
        processed_dir
        / f"MOD44W_{tile_id}_native.tif"
    )

    if not path.exists():
        raise FileNotFoundError(
            "Local MOD44W water mask is missing: "
            f"{path}"
        )

    return path


MOD44W_TILE_PATTERN = re.compile(
    r"\.(h\d{2}v\d{2})\."
)


@dataclass(frozen=True)
class Mod44wTileBounds:
    """Sinusoidal bounds of one MOD44W tile."""

    h: int
    v: int
    xmin: float
    xmax: float
    ymin: float
    ymax: float



def normalize_longitude(
    longitude_deg: float,
) -> float:
    """Normalize longitude to the global [-180, 180] domain.

    Longitudes crossing the antimeridian are wrapped periodically.
    Positive exact multiples mapping to the antimeridian preserve
    +180 degrees rather than becoming -180 degrees.
    """

    normalized = (
        (longitude_deg + 180.0) % 360.0
    ) - 180.0

    if normalized == -180.0 and longitude_deg > 0.0:
        return 180.0

    return normalized


def latlon_to_sinusoidal(
    latitude_deg: float,
    longitude_deg: float,
) -> tuple[float, float]:
    """Convert geographic coordinates to MODIS sinusoidal metres."""

    if not -90.0 <= latitude_deg <= 90.0:
        raise ValueError(
            "Latitude must be between -90 and 90 degrees."
        )

    if not -180.0 <= longitude_deg <= 180.0:
        raise ValueError(
            "Longitude must be between -180 and 180 degrees."
        )

    lat_rad = math.radians(latitude_deg)
    lon_rad = math.radians(longitude_deg)

    x = (
        MODIS_RADIUS_M
        * lon_rad
        * math.cos(lat_rad)
    )

    y = MODIS_RADIUS_M * lat_rad

    return x, y


def _snap_near_integer(
    value: float,
    tolerance: float = 1e-5,
) -> float:
    """Snap floating-point boundary noise to the nearest integer."""
    nearest = round(value)

    if abs(value - nearest) <= tolerance:
        return float(nearest)

    return value


def sinusoidal_to_tile(
    x: float,
    y: float,
) -> tuple[int, int]:
    """Return MODIS horizontal/vertical tile indices."""

    h_raw = (
        (x - MODIS_XMIN_M)
        / MODIS_TILE_SIZE_M
    )

    v_raw = (
        (MODIS_YMAX_M - y)
        / MODIS_TILE_SIZE_M
    )

    h = math.floor(
        _snap_near_integer(h_raw)
    )

    v = math.floor(
        _snap_near_integer(v_raw)
    )

    if not 0 <= h < 36:
        raise ValueError(
            f"Invalid MODIS horizontal tile: h={h}"
        )

    if not 0 <= v < 18:
        raise ValueError(
            f"Invalid MODIS vertical tile: v={v}"
        )

    return h, v


def latlon_to_tile(
    latitude_deg: float,
    longitude_deg: float,
) -> tuple[int, int]:
    """Return MODIS h/v tile for a geographic coordinate."""

    x, y = latlon_to_sinusoidal(
        latitude_deg,
        longitude_deg,
    )

    return sinusoidal_to_tile(x, y)


def tile_bounds(
    h: int,
    v: int,
) -> Mod44wTileBounds:
    """Return sinusoidal bounds for an MOD44W tile."""

    if not 0 <= h < 36:
        raise ValueError("h must be in [0, 35].")

    if not 0 <= v < 18:
        raise ValueError("v must be in [0, 17].")

    xmin = (
        MODIS_XMIN_M
        + h * MODIS_TILE_SIZE_M
    )

    xmax = xmin + MODIS_TILE_SIZE_M

    ymax = (
        MODIS_YMAX_M
        - v * MODIS_TILE_SIZE_M
    )

    ymin = ymax - MODIS_TILE_SIZE_M

    return Mod44wTileBounds(
        h=h,
        v=v,
        xmin=xmin,
        xmax=xmax,
        ymin=ymin,
        ymax=ymax,
    )


def latlon_to_pixel(
    latitude_deg: float,
    longitude_deg: float,
) -> tuple[int, int]:
    """Return row/column inside the MOD44W tile."""

    x, y = latlon_to_sinusoidal(
        latitude_deg,
        longitude_deg,
    )

    h, v = sinusoidal_to_tile(x, y)
    bounds = tile_bounds(h, v)

    col_raw = (
        (x - bounds.xmin)
        / MODIS_PIXEL_SIZE_M
    )

    row_raw = (
        (bounds.ymax - y)
        / MODIS_PIXEL_SIZE_M
    )

    col = math.floor(
        _snap_near_integer(col_raw)
    )

    row = math.floor(
        _snap_near_integer(row_raw)
    )

    col = min(
        MODIS_PIXELS_PER_TILE - 1,
        max(0, col),
    )

    row = min(
        MODIS_PIXELS_PER_TILE - 1,
        max(0, row),
    )

    return row, col


from pathlib import Path
import subprocess

import numpy as np


WATER_MASK_SUBDATASET = (
    "MOD44W_250m_GRID:water_mask"
)

LAND_VALUE = 0
WATER_VALUE = 1
INVALID_VALUE = 253


def water_mask_subdataset(
    hdf_path: str | Path,
) -> str:
    """
    Return the GDAL subdataset identifier for MOD44W water_mask.
    """

    path = Path(hdf_path)

    if not path.exists():
        raise FileNotFoundError(path)

    return (
        f'HDF4_EOS:EOS_GRID:"{path}":'
        f"{WATER_MASK_SUBDATASET}"
    )


def extract_water_mask(
    hdf_path: str | Path,
    output_path: str | Path,
) -> Path:
    """
    Extract MOD44W water_mask into a GeoTIFF using GDAL.
    """

    source = water_mask_subdataset(hdf_path)
    output = Path(output_path)

    output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    subprocess.run(
        [
            "gdal_translate",
            source,
            str(output),
            "-of",
            "GTiff",
            "-co",
            "COMPRESS=LZW",
        ],
        check=True,
    )

    return output


def read_water_mask(
    path: str | Path,
) -> np.ndarray:
    """
    Read a cached MOD44W water_mask GeoTIFF.

    Returns a uint8 array containing the native categorical values:

        0   = land
        1   = water
        253 = fill / invalid

    NoData values are preserved and must never be interpreted as land
    or water.
    """

    import rasterio

    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(path)

    with rasterio.open(path) as src:
        if src.count != 1:
            raise ValueError(
                "MOD44W water mask must contain exactly one band."
            )

        if src.width != MODIS_PIXELS_PER_TILE:
            raise ValueError(
                f"Unexpected MOD44W width: {src.width}."
            )

        if src.height != MODIS_PIXELS_PER_TILE:
            raise ValueError(
                f"Unexpected MOD44W height: {src.height}."
            )

        data = src.read(1)

        nodata = src.nodata

    if data.dtype != np.uint8:
        raise ValueError(
            f"Unexpected MOD44W dtype: {data.dtype}."
        )

    if nodata is not None and int(nodata) != INVALID_VALUE:
        raise ValueError(
            f"Unexpected MOD44W NoData value: {nodata}."
        )

    allowed = {
        LAND_VALUE,
        WATER_VALUE,
        250,
        INVALID_VALUE,
    }

    values = set(
        int(value)
        for value in np.unique(data)
    )

    unexpected = values - allowed

    if unexpected:
        raise ValueError(
            f"Unexpected MOD44W classes: {sorted(unexpected)}."
        )

    return data



def _longitude_segments(
    west: float,
    east: float,
) -> list[tuple[float, float]]:
    """
    Split an unwrapped longitude interval into pieces contained within
    [-180, 180], preserving antimeridian continuity.
    """

    if west >= east:
        raise ValueError(
            "west must be smaller than east."
        )

    if east - west > 360.0:
        raise ValueError(
            "Longitude span cannot exceed 360 degrees."
        )

    segments: list[tuple[float, float]] = []

    segment_west = west
    segment_east = east

    while segment_west < -180.0:
        segment_west += 360.0
        segment_east += 360.0

    while segment_west > 180.0:
        segment_west -= 360.0
        segment_east -= 360.0

    if segment_east <= 180.0:
        segments.append(
            (segment_west, segment_east)
        )
    else:
        segments.append(
            (segment_west, 180.0)
        )
        segments.append(
            (-180.0, segment_east - 360.0)
        )

    return segments

def tiles_for_geographic_footprint(
    west: float,
    south: float,
    east: float,
    north: float,
) -> set[tuple[int, int]]:
    """
    Return MOD44W tiles intersected by a geographic footprint.

    The footprint is an axis-aligned geographic rectangle. Tile
    intersections are solved analytically in the MODIS sinusoidal
    projection rather than inferred from perimeter sampling.

    For each intersected MODIS vertical row, the function evaluates the
    exact horizontal extent produced by

        x = R * longitude * cos(latitude)

    over the latitude interval inside that row.

    Footprints crossing the antimeridian are split into continuous
    longitude segments before projection.
    """

    if south >= north:
        raise ValueError(
            "south must be smaller than north."
        )

    if west >= east:
        raise ValueError(
            "west must be smaller than east."
        )

    if south < -90.0 or north > 90.0:
        raise ValueError(
            "Latitude bounds must remain within [-90, 90]."
        )

    if east - west > 360.0:
        raise ValueError(
            "Footprint longitude span cannot exceed 360 degrees."
        )

    segments = _longitude_segments(
        west,
        east,
    )

    tiles: set[tuple[int, int]] = set()

    # MODIS sinusoidal vertical tile boundaries correspond to 10-degree
    # latitude bands. Test every row whose latitude interval overlaps
    # the footprint.
    for v in range(18):
        bounds = tile_bounds(18, v)

        row_south = math.degrees(
            bounds.ymin / MODIS_RADIUS_M
        )
        row_north = math.degrees(
            bounds.ymax / MODIS_RADIUS_M
        )

        lat_min = max(
            south,
            row_south,
        )
        lat_max = min(
            north,
            row_north,
        )

        # Require positive-area vertical overlap. MODIS grid constants
        # contain sub-millimetre rounding differences at nominal
        # 10-degree row boundaries, so reuse the module's established
        # 1e-5-pixel numerical tolerance.
        overlap_m = (
            math.radians(lat_max - lat_min)
            * MODIS_RADIUS_M
        )

        geometry_tolerance_m = (
            MODIS_PIXEL_SIZE_M * 1e-5
        )

        if overlap_m <= geometry_tolerance_m:
            continue

        # cos(latitude) can have an interior extremum at the equator.
        critical_latitudes = [
            lat_min,
            lat_max,
        ]

        if lat_min <= 0.0 <= lat_max:
            critical_latitudes.append(0.0)

        for lon_west, lon_east in segments:
            x_values: list[float] = []

            for latitude in critical_latitudes:
                cos_lat = math.cos(
                    math.radians(latitude)
                )

                for longitude in (
                    lon_west,
                    lon_east,
                ):
                    x_values.append(
                        MODIS_RADIUS_M
                        * math.radians(longitude)
                        * cos_lat
                    )

            x_min = min(x_values)
            x_max = max(x_values)

            h_min_raw = (
                (x_min - MODIS_XMIN_M)
                / MODIS_TILE_SIZE_M
            )
            h_max_raw = (
                (x_max - MODIS_XMIN_M)
                / MODIS_TILE_SIZE_M
            )

            h_min = math.floor(
                _snap_near_integer(h_min_raw)
            )
            h_max = math.floor(
                _snap_near_integer(h_max_raw)
            )

            h_min = max(0, h_min)
            h_max = min(35, h_max)

            for h in range(
                h_min,
                h_max + 1,
            ):
                candidate_bounds = tile_bounds(h, v)

                horizontal_overlap_m = (
                    min(x_max, candidate_bounds.xmax)
                    - max(x_min, candidate_bounds.xmin)
                )

                # Require positive-area horizontal overlap, using the
                # same established 1e-5-pixel numerical tolerance as
                # the vertical intersection test.
                if (
                    horizontal_overlap_m
                    <= geometry_tolerance_m
                ):
                    continue

                tiles.add((h, v))

    return tiles


def available_tiles_from_catalog(
    catalog_path: Path = MOD44W_CATALOG_PATH,
) -> set[str]:
    """
    Return the official MOD44W V061 tile IDs present in the CMR catalog.

    Absence from this set means that MOD44W does not provide a granule
    for that tile. Under EXP-001B v1.2+ semantics, an officially absent
    MOD44W granule represents ocean. A tile present in this catalog but
    missing from the local cache is instead a data-availability error.
    """
    with catalog_path.open() as f:
        data = json.load(f)

    entries = data["feed"]["entry"]

    tiles: set[str] = set()

    for entry in entries:
        producer_id = entry.get(
            "producer_granule_id",
            "",
        )

        match = MOD44W_TILE_PATTERN.search(
            producer_id
        )

        if not match:
            raise RuntimeError(
                "Could not extract MOD44W tile ID from "
                f"{producer_id!r}"
            )

        tiles.add(match.group(1))

    if len(entries) != 318:
        raise RuntimeError(
            f"Expected 318 MOD44W granules, found {len(entries)}."
        )

    if len(tiles) != 318:
        raise RuntimeError(
            f"Expected 318 unique MOD44W tiles, found {len(tiles)}."
        )

    return tiles


def land_fraction_single_tile(
    mask: np.ndarray,
    latitude_deg: float,
    longitude_deg: float,
    h: int,
    v: int,
    window_m: float = 50_000.0,
) -> dict:
    """
    Calculate MOD44W land fraction inside the exact candidate-local
    metric footprint for a candidate contained within one MOD44W tile.

    Pixel centers are transformed from the native MODIS sinusoidal CRS
    into a candidate-centered WGS84 Azimuthal Equidistant CRS.

    Classes:
        0   = land
        1   = water
        250 = outside projection (excluded)
        253 = fill / invalid (excluded)
    """
    from pyproj import CRS, Transformer

    from parallax.data.srtmgl30 import local_aeqd_crs

    if mask.shape != (
        MODIS_PIXELS_PER_TILE,
        MODIS_PIXELS_PER_TILE,
    ):
        raise ValueError(
            "Unexpected MOD44W mask shape."
        )

    if window_m <= 0:
        raise ValueError(
            "window_m must be positive."
        )

    half_window_m = window_m / 2.0
    bounds = tile_bounds(h, v)

    modis_crs = CRS.from_proj4(
        f"+proj=sinu "
        f"+R={MODIS_RADIUS_M} "
        "+nadgrids=@null "
        "+wktext"
    )

    local_crs = local_aeqd_crs(
        latitude_deg,
        longitude_deg,
    )

    to_modis = Transformer.from_crs(
        "EPSG:4326",
        modis_crs,
        always_xy=True,
    )

    to_local = Transformer.from_crs(
        modis_crs,
        local_crs,
        always_xy=True,
    )

    center_x, center_y = to_modis.transform(
        longitude_deg,
        latitude_deg,
    )

    # Conservative source radius. The additional 5 km ensures that
    # every pixel center potentially intersecting the 50 km footprint
    # is available before the exact AEQD test.
    radius_pixels = int(
        np.ceil(
            (
                half_window_m
                + 5_000.0
            )
            / MODIS_PIXEL_SIZE_M
        )
    )

    center_col = int(
        np.floor(
            (center_x - bounds.xmin)
            / MODIS_PIXEL_SIZE_M
        )
    )

    center_row = int(
        np.floor(
            (bounds.ymax - center_y)
            / MODIS_PIXEL_SIZE_M
        )
    )

    row_start = max(
        0,
        center_row - radius_pixels,
    )

    row_end = min(
        mask.shape[0],
        center_row + radius_pixels + 1,
    )

    col_start = max(
        0,
        center_col - radius_pixels,
    )

    col_end = min(
        mask.shape[1],
        center_col + radius_pixels + 1,
    )

    window = mask[
        row_start:row_end,
        col_start:col_end,
    ]

    rows = np.arange(
        row_start,
        row_end,
    )

    cols = np.arange(
        col_start,
        col_end,
    )

    xs = (
        bounds.xmin
        + (cols + 0.5)
        * MODIS_PIXEL_SIZE_M
    )

    ys = (
        bounds.ymax
        - (rows + 0.5)
        * MODIS_PIXEL_SIZE_M
    )

    xx, yy = np.meshgrid(
        xs,
        ys,
    )

    local_x, local_y = to_local.transform(
        xx,
        yy,
    )

    inside = (
        (local_x >= -half_window_m)
        & (local_x < half_window_m)
        & (local_y >= -half_window_m)
        & (local_y < half_window_m)
    )

    values = window[inside]

    land = int(
        np.count_nonzero(
            values == LAND_VALUE
        )
    )

    water = int(
        np.count_nonzero(
            values == WATER_VALUE
        )
    )

    excluded = int(
        np.count_nonzero(
            (values == 250)
            | (values == INVALID_VALUE)
        )
    )

    denominator = land + water

    if denominator == 0:
        raise ValueError(
            "MOD44W footprint contains no valid "
            "land/water observations."
        )

    land_fraction = (
        land / denominator
    )

    return {
        "land_pixels": land,
        "water_pixels": water,
        "excluded_pixels": excluded,
        "valid_pixels": denominator,
        "footprint_pixels": int(values.size),
        "land_fraction": float(
            land_fraction
        ),
    }



def land_fraction_multi_tile(
    latitude_deg: float,
    longitude_deg: float,
    window_m: float = 50_000.0,
    catalog_path: Path = MOD44W_CATALOG_PATH,
    processed_dir: Path = MOD44W_PROCESSED_DIR,
) -> dict:
    """
    Calculate native-resolution MOD44W land fraction for an exact
    candidate-local metric footprint that may cross MODIS tiles.

    Published MOD44W tiles are evaluated from native pixel centers.
    Officially absent catalog tiles are treated as ocean under the
    frozen EXP-001B protocol. A published tile missing from the local
    cache is a data-availability error.

    Classes 250 and 253 are excluded from the valid denominator.
    """

    import numpy as np
    from pyproj import CRS, Transformer

    from parallax.data.srtmgl30 import (
        local_aeqd_crs,
        physical_window_bounds,
    )

    if window_m <= 0:
        raise ValueError(
            "window_m must be positive."
        )

    half_window_m = window_m / 2.0

    west, south, east, north = physical_window_bounds(
        latitude_deg=latitude_deg,
        longitude_deg=longitude_deg,
        window_m=window_m,
    )

    intersected_tiles = tiles_for_geographic_footprint(
        west=west,
        south=south,
        east=east,
        north=north,
    )

    available = available_tiles_from_catalog(
        catalog_path
    )

    modis_crs = CRS.from_proj4(
        f"+proj=sinu "
        f"+R={MODIS_RADIUS_M} "
        "+nadgrids=@null "
        "+wktext"
    )

    local_crs = local_aeqd_crs(
        latitude_deg,
        longitude_deg,
    )

    to_local = Transformer.from_crs(
        modis_crs,
        local_crs,
        always_xy=True,
    )

    land = 0
    water = 0
    excluded = 0
    footprint_pixels = 0

    published_tiles = []
    absent_ocean_tiles = []

    for h, v in sorted(intersected_tiles):
        tile_id = f"h{h:02d}v{v:02d}"
        bounds = tile_bounds(h, v)

        segments = _longitude_segments(
            west,
            east,
        )

        row_south = math.degrees(
            bounds.ymin / MODIS_RADIUS_M
        )
        row_north = math.degrees(
            bounds.ymax / MODIS_RADIUS_M
        )

        lat_min = max(
            south,
            row_south,
        )
        lat_max = min(
            north,
            row_north,
        )

        if lat_min >= lat_max:
            continue

        y_min = (
            MODIS_RADIUS_M
            * math.radians(lat_min)
        )
        y_max = (
            MODIS_RADIUS_M
            * math.radians(lat_max)
        )

        row_start = max(
            0,
            int(
                np.floor(
                    (
                        bounds.ymax
                        - y_max
                    )
                    / MODIS_PIXEL_SIZE_M
                )
            )
            - 1,
        )

        row_end = min(
            MODIS_PIXELS_PER_TILE,
            int(
                np.ceil(
                    (
                        bounds.ymax
                        - y_min
                    )
                    / MODIS_PIXEL_SIZE_M
                )
            )
            + 1,
        )

        x_intervals = []

        critical_latitudes = [
            lat_min,
            lat_max,
        ]

        if lat_min <= 0.0 <= lat_max:
            critical_latitudes.append(
                0.0
            )

        for segment_west, segment_east in segments:
            x_values = []

            for latitude in critical_latitudes:
                cos_lat = math.cos(
                    math.radians(latitude)
                )

                for longitude in (
                    segment_west,
                    segment_east,
                ):
                    x_values.append(
                        MODIS_RADIUS_M
                        * math.radians(longitude)
                        * cos_lat
                    )

            segment_xmin = max(
                min(x_values),
                bounds.xmin,
            )

            segment_xmax = min(
                max(x_values),
                bounds.xmax,
            )

            if segment_xmin < segment_xmax:
                x_intervals.append(
                    (
                        segment_west,
                        segment_east,
                        segment_xmin,
                        segment_xmax,
                    )
                )

        if not x_intervals:
            continue

        col_start = max(
            0,
            min(
                int(
                    np.floor(
                        (
                            interval[2]
                            - bounds.xmin
                        )
                        / MODIS_PIXEL_SIZE_M
                    )
                )
                for interval in x_intervals
            )
            - 1,
        )

        col_end = min(
            MODIS_PIXELS_PER_TILE,
            max(
                int(
                    np.ceil(
                        (
                            interval[3]
                            - bounds.xmin
                        )
                        / MODIS_PIXEL_SIZE_M
                    )
                )
                for interval in x_intervals
            )
            + 1,
        )

        if (
            row_start >= row_end
            or col_start >= col_end
        ):
            continue

        rows = np.arange(
            row_start,
            row_end,
        )

        cols = np.arange(
            col_start,
            col_end,
        )

        xs = (
            bounds.xmin
            + (cols + 0.5)
            * MODIS_PIXEL_SIZE_M
        )

        ys = (
            bounds.ymax
            - (rows + 0.5)
            * MODIS_PIXEL_SIZE_M
        )

        xx, yy = np.meshgrid(
            xs,
            ys,
        )

        local_x, local_y = to_local.transform(
            xx,
            yy,
        )

        crosses_antimeridian = (
            west < -180.0
            or east > 180.0
        )

        if crosses_antimeridian:
            to_geographic = Transformer.from_crs(
                modis_crs,
                "EPSG:4326",
                always_xy=True,
            )

            geographic_lon, _ = (
                to_geographic.transform(
                    xx,
                    yy,
                )
            )

            geographic_segment = np.zeros(
                xx.shape,
                dtype=bool,
            )

            for (
                segment_west,
                segment_east,
                _,
                _,
            ) in x_intervals:
                geographic_segment |= (
                    (
                        geographic_lon
                        >= segment_west
                    )
                    & (
                        geographic_lon
                        < segment_east
                    )
                )
        else:
            geographic_segment = np.ones(
                xx.shape,
                dtype=bool,
            )

        inside = (
            geographic_segment
            & (local_x >= -half_window_m)
            & (local_x < half_window_m)
            & (local_y >= -half_window_m)
            & (local_y < half_window_m)
        )

        inside_count = int(
            np.count_nonzero(inside)
        )

        if inside_count == 0:
            continue

        footprint_pixels += inside_count

        if tile_id not in available:
            water += inside_count
            absent_ocean_tiles.append(
                tile_id
            )
            continue

        mask_path = local_water_mask_path(
            h,
            v,
            processed_dir=processed_dir,
        )

        mask = read_water_mask(
            mask_path
        )

        published_tiles.append(
            tile_id
        )

        values = mask[
            row_start:row_end,
            col_start:col_end,
        ][inside]

        land += int(
            np.count_nonzero(
                values == LAND_VALUE
            )
        )

        water += int(
            np.count_nonzero(
                values == WATER_VALUE
            )
        )

        excluded += int(
            np.count_nonzero(
                (values == 250)
                | (values == INVALID_VALUE)
            )
        )

    denominator = land + water

    if denominator == 0:
        raise ValueError(
            "MOD44W footprint contains no valid "
            "land/water observations."
        )

    return {
        "land_pixels": land,
        "water_pixels": water,
        "excluded_pixels": excluded,
        "valid_pixels": denominator,
        "footprint_pixels": footprint_pixels,
        "land_fraction": float(
            land / denominator
        ),
        "intersected_tiles": [
            f"h{h:02d}v{v:02d}"
            for h, v in sorted(
                intersected_tiles
            )
        ],
        "published_tiles": published_tiles,
        "absent_ocean_tiles": absent_ocean_tiles,
    }

def water_mask_to_metric_grid(
    mask: np.ndarray,
    latitude_deg: float,
    longitude_deg: float,
    h: int,
    v: int,
    window_m: float = 50_000.0,
    resolution_m: float = 1_000.0,
) -> np.ndarray:
    """
    Reproject one native MOD44W tile onto the candidate-local
    metric grid using nearest-neighbour resampling.

    The output preserves MOD44W categorical values. It is intended
    for terrain-validity masking, not for land-fraction eligibility.
    """

    from pyproj import CRS
    from rasterio.enums import Resampling
    from rasterio.transform import from_origin
    from rasterio.warp import reproject

    from parallax.data.srtmgl30 import (
        local_aeqd_crs,
        metric_grid_transform,
    )

    if mask.shape != (
        MODIS_PIXELS_PER_TILE,
        MODIS_PIXELS_PER_TILE,
    ):
        raise ValueError(
            "Unexpected MOD44W mask shape."
        )

    bounds = tile_bounds(h, v)

    source_transform = from_origin(
        bounds.xmin,
        bounds.ymax,
        MODIS_PIXEL_SIZE_M,
        MODIS_PIXEL_SIZE_M,
    )

    source_crs = CRS.from_proj4(
        f"+proj=sinu "
        f"+R={MODIS_RADIUS_M} "
        "+nadgrids=@null "
        "+wktext"
    )

    destination_crs = local_aeqd_crs(
        latitude_deg,
        longitude_deg,
    )

    destination_transform, width, height = (
        metric_grid_transform(
            window_m=window_m,
            resolution_m=resolution_m,
        )
    )

    destination = np.full(
        (height, width),
        INVALID_VALUE,
        dtype=np.uint8,
    )

    reproject(
        source=mask,
        destination=destination,
        src_transform=source_transform,
        src_crs=source_crs,
        dst_transform=destination_transform,
        dst_crs=destination_crs,
        resampling=Resampling.nearest,
        src_nodata=INVALID_VALUE,
        dst_nodata=INVALID_VALUE,
    )

    return destination
