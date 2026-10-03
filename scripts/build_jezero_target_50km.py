"""Build the frozen 50 × 50 km Jezero mission target for EXP-001."""

import json
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.windows import from_bounds


DEM_PATH = Path(
    "data/mars/jezero/raw/M20_JezeroCrater_CTXDEM_20m.tif"
)

OUTPUT_PATH = Path(
    "results/exp001/jezero_target_50km_v0_3.json"
)

LANDING_LAT = 18.44463
LANDING_LON = 77.45088

WINDOW_SIZE_M = 50_000
HALF_WINDOW_M = WINDOW_SIZE_M / 2

SCALES_M = [100, 500, 1000]

SLOPE_CLASSES = [
    (0, 1),
    (1, 2),
    (2, 3),
    (3, 5),
    (5, 10),
    (10, 15),
    (15, 20),
    (20, np.inf),
]


def aggregate_mean(data, factor):
    """Aggregate DEM using block means."""

    rows = (data.shape[0] // factor) * factor
    cols = (data.shape[1] // factor) * factor

    trimmed = data[:rows, :cols]

    reshaped = trimmed.reshape(
        rows // factor,
        factor,
        cols // factor,
        factor,
    )

    return np.nanmean(
        reshaped,
        axis=(1, 3),
    )


def calculate_slope(dem, resolution_m):
    """Calculate slope in degrees on a metric grid."""

    dz_dy, dz_dx = np.gradient(
        dem,
        resolution_m,
        resolution_m,
    )

    gradient = np.sqrt(
        dz_dx**2 + dz_dy**2
    )

    return np.degrees(
        np.arctan(gradient)
    )


def summarize_slope(slope):
    valid = slope[np.isfinite(slope)]

    result = {
        "mean_deg": float(np.mean(valid)),
        "std_deg": float(np.std(valid)),
        "p50_deg": float(np.percentile(valid, 50)),
        "p90_deg": float(np.percentile(valid, 90)),
        "p95_deg": float(np.percentile(valid, 95)),
        "distribution_pct": {},
    }

    for low, high in SLOPE_CLASSES:

        if np.isinf(high):
            label = f">={low}"
            mask = valid >= low
        else:
            label = f"{low}-{high}"
            mask = (
                (valid >= low)
                & (valid < high)
            )

        result["distribution_pct"][label] = (
            float(mask.mean() * 100)
        )

    return result


def main():

    OUTPUT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with rasterio.open(DEM_PATH) as src:

        mars_geo = CRS.from_proj4(
            "+proj=longlat "
            "+R=3396190 "
            "+no_defs"
        )

        mars_projected = CRS.from_wkt(
            src.crs.to_wkt()
        )

        transformer = Transformer.from_crs(
            mars_geo,
            mars_projected,
            always_xy=True,
        )

        center_x, center_y = transformer.transform(
            LANDING_LON,
            LANDING_LAT,
        )

        left = center_x - HALF_WINDOW_M
        right = center_x + HALF_WINDOW_M
        bottom = center_y - HALF_WINDOW_M
        top = center_y + HALF_WINDOW_M

        if not (
            src.bounds.left <= left
            and right <= src.bounds.right
            and src.bounds.bottom <= bottom
            and top <= src.bounds.top
        ):
            raise RuntimeError(
                "50 km target extends outside CTX DEM."
            )

        window = from_bounds(
            left,
            bottom,
            right,
            top,
            src.transform,
        )

        data = src.read(
            1,
            window=window,
        ).astype("float64")

        if src.nodata is not None:
            data[
                np.isclose(
                    data,
                    src.nodata,
                )
            ] = np.nan

        base_resolution = abs(
            src.transform.a
        )

    valid = np.isfinite(data)

    elevation = data[valid]

    output = {
        "experiment": "EXP-001",
        "version": "0.3",
        "target": {
            "planet": "Mars",
            "region": "Jezero Crater",
            "reference": "Perseverance landing site",
            "center_lat_deg": LANDING_LAT,
            "center_lon_deg": LANDING_LON,
            "window_km": 50,
        },
        "source": {
            "dataset": (
                "Mars 2020 Science Investigation "
                "CTX DEM Mosaic"
            ),
            "native_resolution_m": base_resolution,
        },
        "coverage_pct": float(
            valid.mean() * 100
        ),
        "elevation": {
            "mean_m": float(np.mean(elevation)),
            "std_m": float(np.std(elevation)),
            "min_m": float(np.min(elevation)),
            "max_m": float(np.max(elevation)),
            "relief_m": float(
                np.max(elevation)
                - np.min(elevation)
            ),
        },
        "terrain": {},
        "scientific_guardrails": {
            "absolute_elevation_used_for_matching": False,
            "earth_candidates_seen_before_freeze": False,
            "target_window_fixed_before_discovery": True,
        },
    }

    for scale_m in SCALES_M:

        factor = round(
            scale_m / base_resolution
        )

        aggregated = aggregate_mean(
            data,
            factor,
        )

        effective_resolution = (
            base_resolution * factor
        )

        slope = calculate_slope(
            aggregated,
            effective_resolution,
        )

        output["terrain"][
            f"{scale_m}m"
        ] = {
            "effective_resolution_m":
                effective_resolution,
            "shape": list(
                aggregated.shape
            ),
            "slope":
                summarize_slope(slope),
        }

    with OUTPUT_PATH.open(
        "w"
    ) as f:
        json.dump(
            output,
            f,
            indent=2,
        )

    print()
    print(
        "PARALLAX — JEZERO 50 KM TARGET"
    )
    print("=" * 60)

    print(
        f"Window:          "
        f"{WINDOW_SIZE_M / 1000:.0f} × "
        f"{WINDOW_SIZE_M / 1000:.0f} km"
    )

    print(
        f"Center:          "
        f"{LANDING_LAT:.5f}° N, "
        f"{LANDING_LON:.5f}° E"
    )

    print(
        f"Raster shape:    {data.shape}"
    )

    print(
        f"Coverage:        "
        f"{output['coverage_pct']:.2f}%"
    )

    print()
    print("Elevation")
    print(
        f"Mean:            "
        f"{output['elevation']['mean_m']:.2f} m"
    )
    print(
        f"Relief:          "
        f"{output['elevation']['relief_m']:.2f} m"
    )

    for scale, values in output[
        "terrain"
    ].items():

        s = values["slope"]

        print()
        print(f"Slope — {scale}")
        print(
            f"Mean:            "
            f"{s['mean_deg']:.3f}°"
        )
        print(
            f"P50:             "
            f"{s['p50_deg']:.3f}°"
        )
        print(
            f"P90:             "
            f"{s['p90_deg']:.3f}°"
        )
        print(
            f"P95:             "
            f"{s['p95_deg']:.3f}°"
        )

        print("Distribution:")

        for label, pct in (
            s["distribution_pct"].items()
        ):
            print(
                f"  {label:>5}° : "
                f"{pct:6.2f}%"
            )

    print()
    print(
        f"✓ Frozen target written to "
        f"{OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()