"""PARALLAX — EXP-001A.1
Robust multiscale terrain fingerprint for Jezero Crater.

Target: Mars / Jezero Crater
Mission: Rover Mobility

Dataset:
Mars 2020 Science Investigation CTX DEM Mosaic
USGS Astrogeology / NASA
20 m/pixel

Scientific principle:
Ground sample distance is not assumed to equal effective
topographic resolution. Terrain metrics are therefore
reported at multiple spatial baselines.
"""

import json
from pathlib import Path

import numpy as np
import rasterio


INPUT = Path(
    "data/mars/jezero/raw/M20_JezeroCrater_CTXDEM_20m.tif"
)

OUTPUT = Path(
    "results/exp001/jezero_fingerprint_v0_2.json"
)


def valid_values(array):
    """Return finite values only."""
    return array[np.isfinite(array)]


def calculate_slope(dem, pixel_size):
    """Calculate slope in degrees."""
    dz_dy, dz_dx = np.gradient(
        dem,
        pixel_size,
        pixel_size,
    )

    gradient = np.sqrt(
        dz_dx**2 + dz_dy**2
    )

    return np.degrees(
        np.arctan(gradient)
    )


def aggregate_dem(dem, factor):
    """
    Aggregate DEM using block mean.

    factor=5 at 20 m GSD -> 100 m baseline.
    """

    rows = (dem.shape[0] // factor) * factor
    cols = (dem.shape[1] // factor) * factor

    cropped = dem[:rows, :cols]

    reshaped = cropped.reshape(
        rows // factor,
        factor,
        cols // factor,
        factor,
    )

    valid_count = np.sum(
        np.isfinite(reshaped),
        axis=(1, 3),
    )

    sums = np.nansum(
        reshaped,
        axis=(1, 3),
    )

    result = np.full(
        valid_count.shape,
        np.nan,
        dtype="float64",
    )

    mask = valid_count > 0

    result[mask] = (
        sums[mask] /
        valid_count[mask]
    )

    return result


def slope_distribution(slope):
    """Percentage of valid terrain in slope classes."""

    values = valid_values(slope)
    total = len(values)

    return {
        "lt_5_deg": float(
            100 * np.sum(values < 5) / total
        ),
        "5_10_deg": float(
            100
            * np.sum(
                (values >= 5) &
                (values < 10)
            )
            / total
        ),
        "10_15_deg": float(
            100
            * np.sum(
                (values >= 10) &
                (values < 15)
            )
            / total
        ),
        "15_20_deg": float(
            100
            * np.sum(
                (values >= 15) &
                (values < 20)
            )
            / total
        ),
        "gte_20_deg": float(
            100
            * np.sum(values >= 20)
            / total
        ),
    }


def summarize_slope(slope):
    values = valid_values(slope)

    return {
        "mean": float(np.mean(values)),
        "std": float(np.std(values)),
        "p50": float(
            np.percentile(values, 50)
        ),
        "p90": float(
            np.percentile(values, 90)
        ),
        "p95": float(
            np.percentile(values, 95)
        ),
        "distribution_percent":
            slope_distribution(slope),
    }


def main():

    print()
    print("PARALLAX — EXP-001A.1")
    print("Jezero Multiscale Terrain Fingerprint")
    print("=" * 52)

    # --------------------------------------------------
    # LOAD DEM
    # --------------------------------------------------

    with rasterio.open(INPUT) as src:

        dem = src.read(1).astype(
            "float64"
        )

        nodata = src.nodata
        pixel_size = src.res[0]

        valid = np.isfinite(dem)

        if nodata is not None:
            valid &= dem != nodata

        dem[~valid] = np.nan

    total_pixels = dem.size

    valid_pixels = int(
        np.sum(np.isfinite(dem))
    )

    coverage = (
        100 *
        valid_pixels /
        total_pixels
    )

    # --------------------------------------------------
    # ELEVATION
    # --------------------------------------------------

    elevation = valid_values(dem)

    elevation_stats = {
        "mean": float(
            np.mean(elevation)
        ),
        "std": float(
            np.std(elevation)
        ),
        "min": float(
            np.min(elevation)
        ),
        "max": float(
            np.max(elevation)
        ),
        "relief": float(
            np.max(elevation) -
            np.min(elevation)
        ),
    }

    # --------------------------------------------------
    # MULTISCALE TERRAIN
    # --------------------------------------------------

    scales = {
        "native_20m": 1,
        "100m": 5,
        "500m": 25,
        "1000m": 50,
    }

    multiscale = {}

    for name, factor in scales.items():

        if factor == 1:
            scale_dem = dem
        else:
            scale_dem = aggregate_dem(
                dem,
                factor,
            )

        baseline = (
            pixel_size * factor
        )

        slope = calculate_slope(
            scale_dem,
            baseline,
        )

        stats = summarize_slope(
            slope
        )

        stats["baseline_m"] = float(
            baseline
        )

        stats["grid_shape"] = [
            int(scale_dem.shape[0]),
            int(scale_dem.shape[1]),
        ]

        multiscale[name] = stats

    # --------------------------------------------------
    # FINGERPRINT
    # --------------------------------------------------

    fingerprint = {

        "experiment":
            "EXP-001A.1",

        "fingerprint_version":
            "0.2",

        "target": {
            "planet": "Mars",
            "location": "Jezero Crater",
        },

        "mission":
            "rover_mobility",

        "source": {
            "dataset":
                "Mars 2020 Science Investigation "
                "CTX DEM Mosaic",

            "provider":
                "USGS Astrogeology / NASA",

            "ground_sample_distance_m":
                float(pixel_size),

            "vertical_reference":
                "MOLA-localized",

            "projection":
                "Equirectangular",
        },

        "coverage": {
            "valid_pixels":
                valid_pixels,

            "total_pixels":
                int(total_pixels),

            "valid_percent":
                float(coverage),
        },

        "terrain": {

            "elevation_m":
                elevation_stats,

            "slope_multiscale":
                multiscale,
        },

        "scientific_notes": [
            (
                "20 m ground sample distance "
                "is not assumed to equal "
                "effective topographic resolution."
            ),
            (
                "Native-scale metrics are retained "
                "for reference but should not be "
                "interpreted as independent 20 m "
                "terrain detail."
            ),
            (
                "Mission matching should prioritize "
                "multiscale terrain distributions "
                "over absolute planetary elevation."
            ),
        ],
    }

    OUTPUT.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with OUTPUT.open("w") as f:

        json.dump(
            fingerprint,
            f,
            indent=2,
        )

    # --------------------------------------------------
    # REPORT
    # --------------------------------------------------

    print(
        f"Valid coverage: {coverage:.2f}%"
    )

    print()
    print("ELEVATION")
    print("-" * 52)

    print(
        f"Mean:   "
        f"{elevation_stats['mean']:,.2f} m"
    )

    print(
        f"Relief: "
        f"{elevation_stats['relief']:,.2f} m"
    )

    for name, stats in multiscale.items():

        print()
        print(
            f"SLOPE — "
            f"{stats['baseline_m']:.0f} m baseline"
        )

        print("-" * 52)

        print(
            f"Mean: {stats['mean']:.3f}°"
        )

        print(
            f"P50:  {stats['p50']:.3f}°"
        )

        print(
            f"P90:  {stats['p90']:.3f}°"
        )

        print(
            f"P95:  {stats['p95']:.3f}°"
        )

        d = stats[
            "distribution_percent"
        ]

        print()
        print("Terrain distribution:")

        print(
            f"  <5°      {d['lt_5_deg']:.2f}%"
        )

        print(
            f"  5–10°    {d['5_10_deg']:.2f}%"
        )

        print(
            f"  10–15°   {d['10_15_deg']:.2f}%"
        )

        print(
            f"  15–20°   {d['15_20_deg']:.2f}%"
        )

        print(
            f"  >=20°    {d['gte_20_deg']:.2f}%"
        )

    print()
    print("=" * 52)

    print(
        "✓ Multiscale fingerprint generated"
    )

    print(
        f"✓ Saved: {OUTPUT}"
    )


if __name__ == "__main__":
    main()