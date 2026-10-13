"""Build a frozen 50 × 50 km lunar south-pole target for Parallax (EXP-002).

Same method as the Jezero reference (scripts/build_jezero_target_50km_v0_4.py):
a square window in the DEM's native projected plane, centred on the site,
block-mean aggregation to 100 / 500 / 1000 m, np.gradient slope, interior
cells only, and the frozen 8 slope classes used by every Parallax target.

Elevation: LOLA south-pole DEM, 20 m/pixel (Barker et al. 2023, PSJ 4, 183,
doi:10.3847/PSJ/acf3e1; data doi:10.60903/gsfcpgda-lola-spole), published
by NASA GSFC PGDA as a cloud-optimised GeoTIFF in south polar stereographic
coordinates. By default only the window is read over HTTP (about 25 MB);
pass --dem to use a local copy instead.

    python scripts/build_lunar_target_50km.py --site shackleton
    python scripts/build_lunar_target_50km.py --site shackleton --dem path/to/LDEM_80S_20MPP_ADJ.TIF
"""
from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

LOLA_20M_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF"
MOON_RADIUS_M = 1_737_400.0
WINDOW_SIZE_M = 50_000.0
HALF_WINDOW_M = WINDOW_SIZE_M / 2
SCALES_M = (100, 500, 1000)
SLOPE_CLASSES = ((0, 1), (1, 2), (2, 3), (3, 5), (5, 10), (10, 15), (15, 20), (20, math.inf))

# Centres are fixed here, before any Earth comparison, and cite their source.
SITES = {
    "shackleton": {
        "region": "Shackleton crater",
        "reference": "IAU Gazetteer of Planetary Nomenclature, feature 5450 (crater centre, D = 20.92 km)",
        "reference_url": "https://planetarynames.wr.usgs.gov/Feature/5450",
        "center_lat_deg": -89.67,
        "center_lon_deg": 129.78,
        "context": "Lunar south pole. The window holds the permanently shadowed crater floor, its walls and the sunlit rim discussed for Artemis surface operations.",
    },
}
OUTPUT_DIR = Path("results/exp002")


def aggregate_mean(data: np.ndarray, factor: int) -> np.ndarray:
    """Block-mean aggregation; blocks containing any NaN become NaN."""
    if factor < 1:
        raise ValueError("Aggregation factor must be >= 1.")
    rows = (data.shape[0] // factor) * factor
    cols = (data.shape[1] // factor) * factor
    blocks = data[:rows, :cols].reshape(rows // factor, factor, cols // factor, factor)
    return blocks.mean(axis=(1, 3))


def slope_degrees(dem: np.ndarray, resolution_m: float) -> np.ndarray:
    dz_dy, dz_dx = np.gradient(dem, resolution_m, resolution_m)
    return np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))


def summarize_slope(slope: np.ndarray) -> dict:
    """Interior cells only (complete cardinal stencil), as for Jezero."""
    interior = slope[1:-1, 1:-1].ravel()
    valid = interior[np.isfinite(interior)]
    if valid.size == 0:
        raise ValueError("No finite interior slope cells.")
    result = {
        "mean_deg": float(np.mean(valid)),
        "std_deg": float(np.std(valid)),
        "p50_deg": float(np.percentile(valid, 50)),
        "p90_deg": float(np.percentile(valid, 90)),
        "p95_deg": float(np.percentile(valid, 95)),
        "distribution_pct": {},
        "valid_cells": int(valid.size),
        "interior_cells": int(interior.size),
    }
    for low, high in SLOPE_CLASSES:
        label = f">={low}" if math.isinf(high) else f"{low}-{high}"
        mask = valid >= low if math.isinf(high) else (valid >= low) & (valid < high)
        result["distribution_pct"][label] = float(mask.mean() * 100)
    return result


def build_terrain(elevation_m: np.ndarray, base_resolution_m: float) -> dict:
    """Slope statistics at every scale. Requires complete coverage of the window."""
    if elevation_m.ndim != 2:
        raise ValueError("Elevation must be two-dimensional.")
    if not np.isfinite(elevation_m).all():
        raise ValueError(f"Incomplete DEM coverage: {int(np.isfinite(elevation_m).sum())} / {elevation_m.size} valid pixels.")
    finite_max = float(np.nanmax(np.abs(elevation_m)))
    if finite_max < 50:
        raise ValueError("Elevations look like kilometres or radius-normalised values; expected metres.")
    terrain = {}
    for scale_m in SCALES_M:
        factor = scale_m / base_resolution_m
        if abs(factor - round(factor)) > 1e-9:
            raise ValueError(f"{scale_m} m is not an integer multiple of the {base_resolution_m} m source grid.")
        aggregated = aggregate_mean(elevation_m, int(round(factor)))
        slope = slope_degrees(aggregated, scale_m)
        terrain[f"{scale_m}m"] = {"effective_resolution_m": float(scale_m), "shape": list(aggregated.shape), "slope": summarize_slope(slope)}
    return terrain


def window_bounds(center_x: float, center_y: float) -> tuple[float, float, float, float]:
    return center_x - HALF_WINDOW_M, center_y - HALF_WINDOW_M, center_x + HALF_WINDOW_M, center_y + HALF_WINDOW_M


def read_window(dem: str, site: dict):
    """Read the 50 km window around the site from the polar stereographic DEM."""
    import rasterio
    from pyproj import CRS, Proj, Transformer
    from rasterio.windows import from_bounds

    path = dem if not dem.startswith("https://") else "/vsicurl/" + dem
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".TIF,.tif"):
        with rasterio.open(path) as src:
            projected = CRS.from_wkt(src.crs.to_wkt())
            # Use the DEM's own lunar body definition so no datum shift is introduced.
            geographic = projected.geodetic_crs or CRS.from_proj4(f"+proj=longlat +R={MOON_RADIUS_M} +no_defs")
            to_projected = Transformer.from_crs(geographic, projected, always_xy=True)
            cx, cy = to_projected.transform(site["center_lon_deg"], site["center_lat_deg"])
            left, bottom, right, top = window_bounds(cx, cy)
            if not (src.bounds.left <= left and right <= src.bounds.right and src.bounds.bottom <= bottom and top <= src.bounds.top):
                raise RuntimeError("The 50 km window extends outside the DEM.")
            resolution = abs(src.transform.a)
            if abs(abs(src.transform.e) - resolution) > 1e-6:
                raise RuntimeError("Expected square DEM pixels.")
            window = from_bounds(left, bottom, right, top, src.transform).round_offsets().round_lengths()
            data = src.read(1, window=window, masked=True).astype("float64").filled(np.nan)
            meta = {
                "native_resolution_m": float(resolution),
                "crs_wkt": src.crs.to_wkt(),
                "window_pixels": [int(window.height), int(window.width)],
                "center_projected_m": [float(cx), float(cy)],
            }
            # Polar stereographic is not exactly equal-distance; record the scale at the centre.
            try:
                factors = Proj(projected).get_factors(site["center_lon_deg"], site["center_lat_deg"])
                meta["projection_scale_at_center"] = {"meridional": float(factors.meridional_scale), "parallel": float(factors.parallel_scale)}
            except Exception as exc:  # pragma: no cover - depends on PROJ build
                meta["projection_scale_at_center"] = f"unavailable: {exc}"
    return data, meta


def build_target(site_id: str, elevation_m: np.ndarray, meta: dict, source: str) -> dict:
    site = SITES[site_id]
    valid = np.isfinite(elevation_m)
    elevation = elevation_m[valid]
    return {
        "experiment": "EXP-002",
        "version": "0.1",
        "target": {
            "id": site_id,
            "planet": "Moon",
            "region": site["region"],
            "reference": site["reference"],
            "reference_url": site["reference_url"],
            "center_lat_deg": site["center_lat_deg"],
            "center_lon_deg": site["center_lon_deg"],
            "window_km": WINDOW_SIZE_M / 1000,
            "context": site["context"],
        },
        "source": {
            "dataset": "LOLA south pole DEM, 20 m/pixel (LDEM_80S_20MPP_ADJ)",
            "url": source,
            "citation": "Barker, M. K., et al. (2023), Planetary Science Journal 4, 183, doi:10.3847/PSJ/acf3e1. Data doi:10.60903/gsfcpgda-lola-spole",
            "native_resolution_m": meta["native_resolution_m"],
            "window_pixels": meta["window_pixels"],
            "projection": "South polar stereographic (native DEM plane); window is square in that plane",
            "projection_scale_at_center": meta.get("projection_scale_at_center"),
        },
        "coverage_pct": float(valid.mean() * 100),
        "elevation": {
            "mean_m": float(np.mean(elevation)),
            "std_m": float(np.std(elevation)),
            "min_m": float(np.min(elevation)),
            "max_m": float(np.max(elevation)),
            "relief_m": float(np.max(elevation) - np.min(elevation)),
        },
        "terrain": build_terrain(elevation_m, meta["native_resolution_m"]),
        "method": "Same as Jezero v0.4: block-mean aggregation in the native projected plane, np.gradient slope, interior cells, 8 frozen slope classes.",
        "scientific_guardrails": {
            "absolute_elevation_used_for_matching": False,
            "earth_candidates_seen_before_freeze": False,
            "target_window_fixed_before_discovery": True,
        },
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--site", choices=sorted(SITES), default="shackleton")
    parser.add_argument("--dem", default=LOLA_20M_URL, help="Local DEM path or HTTPS URL (default: PGDA LOLA 20 m COG).")
    parser.add_argument("--no-web-copy", dest="web_copy", action="store_false", help="Do not write web/data/<site>-target.json.")
    args = parser.parse_args()

    data, meta = read_window(args.dem, SITES[args.site])
    output = build_target(args.site, data, meta, args.dem)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / f"{args.site}_target_50km_v0_1.json"
    text = json.dumps(output, indent=2) + "\n"
    path.write_text(text, encoding="utf-8")
    if args.web_copy:
        Path("web/data").joinpath(f"{args.site}-target.json").write_text(text, encoding="utf-8")
    s = output["terrain"]["1000m"]["slope"]
    print(f"PARALLAX — {output['target']['region']} 50 km target")
    print(f"Window pixels {meta['window_pixels']} at {meta['native_resolution_m']} m · coverage {output['coverage_pct']:.2f}%")
    print(f"Relief {output['elevation']['relief_m']:.0f} m · 1 km slope mean {s['mean_deg']:.2f}° · P95 {s['p95_deg']:.2f}°")
    for label, pct in s["distribution_pct"].items():
        print(f"  {label:>5}°: {pct:6.2f}%")
    print(f"✓ Frozen target written to {path}" + (" and web/data" if args.web_copy else ""))


if __name__ == "__main__":
    main()
