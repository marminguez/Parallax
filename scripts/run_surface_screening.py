#!/usr/bin/env python3

from argparse import ArgumentParser
from pathlib import Path
import json

import numpy as np
import rasterio
from pyproj import CRS
from rasterio.transform import from_origin
from rasterio.warp import reproject, Resampling


WINDOW_M = 50_000
RES_M = 30
BANDS = ["B02", "B04", "B8A", "B11", "Fmask"]


def reproject_band(path, transform, local_crs, size, band):
    with rasterio.open(path) as src:
        if band == "Fmask":
            dst = np.full((size, size), 255, dtype=np.uint8)
            nodata = 255
        else:
            dst = np.full((size, size), -9999, dtype=np.int16)
            nodata = -9999

        reproject(
            source=rasterio.band(src, 1),
            destination=dst,
            src_transform=src.transform,
            src_crs=src.crs,
            dst_transform=transform,
            dst_crs=local_crs,
            src_nodata=nodata,
            dst_nodata=nodata,
            resampling=Resampling.nearest,
        )

    return dst


def percentile(values, q):
    return round(float(np.percentile(values, q)), 4)


def main():
    parser = ArgumentParser(
        description="PARALLAX HLS Surface Screening"
    )
    parser.add_argument("--lat", type=float, required=True)
    parser.add_argument("--lon", type=float, required=True)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--candidate", default="candidate")

    args = parser.parse_args()

    granules = sorted({
        p.name.split(".B04.tif")[0]
        for p in args.input.glob("*.B04.tif")
    })

    if not granules:
        raise RuntimeError("No HLS granules found.")

    for granule in granules:
        for band in BANDS:
            path = args.input / f"{granule}.{band}.tif"
            if not path.exists():
                raise RuntimeError(f"Missing HLS asset: {path}")

    local_crs = CRS.from_proj4(
        f"+proj=aeqd +lat_0={args.lat} +lon_0={args.lon} "
        "+datum=WGS84 +units=m +no_defs"
    )

    size = round(WINDOW_M / RES_M)

    transform = from_origin(
        -WINDOW_M / 2,
        WINDOW_M / 2,
        RES_M,
        RES_M,
    )

    blue = np.full((size, size), np.nan, dtype=np.float32)
    red = np.full((size, size), np.nan, dtype=np.float32)
    nir = np.full((size, size), np.nan, dtype=np.float32)
    swir = np.full((size, size), np.nan, dtype=np.float32)

    selected = np.zeros((size, size), dtype=bool)

    for granule in granules:
        arrays = {}

        for band in BANDS:
            path = args.input / f"{granule}.{band}.tif"
            arrays[band] = reproject_band(
                path,
                transform,
                local_crs,
                size,
                band,
            )

        qa = arrays["Fmask"]

        good = (
            (qa != 255)
            & ((qa & (1 << 1)) == 0)  # cloud
            & ((qa & (1 << 2)) == 0)  # adjacent cloud/shadow
            & ((qa & (1 << 3)) == 0)  # cloud shadow
            & ((qa & (1 << 4)) == 0)  # snow/ice
            & ((qa & (1 << 5)) == 0)  # water
            & (arrays["B02"] != -9999)
            & (arrays["B04"] != -9999)
            & (arrays["B8A"] != -9999)
            & (arrays["B11"] != -9999)
        )

        take = good & ~selected

        blue[take] = arrays["B02"][take] * 0.0001
        red[take] = arrays["B04"][take] * 0.0001
        nir[take] = arrays["B8A"][take] * 0.0001
        swir[take] = arrays["B11"][take] * 0.0001

        selected[take] = True

    with np.errstate(divide="ignore", invalid="ignore"):
        ndvi = (nir - red) / (nir + red)
        ndmi = (nir - swir) / (nir + swir)

        bsi = (
            (swir + red) - (nir + blue)
        ) / (
            (swir + red) + (nir + blue)
        )

    valid = (
        selected
        & np.isfinite(ndvi)
        & np.isfinite(ndmi)
        & np.isfinite(bsi)
        & (ndvi >= -1) & (ndvi <= 1)
        & (ndmi >= -1) & (ndmi <= 1)
        & (bsi >= -1) & (bsi <= 1)
    )

    if not valid.any():
        raise RuntimeError("No valid spectral pixels.")

    ndvi_v = ndvi[valid]
    ndmi_v = ndmi[valid]
    bsi_v = bsi[valid]

    dry_low_vegetation = (
        (ndvi_v < 0.3)
        & (ndmi_v < 0.0)
    )

    dry_exposed = (
        dry_low_vegetation
        & (bsi_v > 0.0)
    )

    strong_dry_exposed = (
        (ndvi_v < 0.2)
        & (ndmi_v < 0.0)
        & (bsi_v > 0.0)
    )

    result = {
        "candidate": args.candidate,
        "center": {
            "lat": args.lat,
            "lon": args.lon,
        },
        "source": {
            "dataset": "NASA HLS S30 v2.0",
            "granules": granules,
            "bands": BANDS,
        },
        "footprint": {
            "window_m": WINDOW_M,
            "resolution_m": RES_M,
            "grid_size": size,
            "valid_spectral_coverage_pct": round(
                float(valid.mean() * 100), 2
            ),
        },
        "ndvi": {
            "mean": round(float(np.mean(ndvi_v)), 4),
            "median": round(float(np.median(ndvi_v)), 4),
            "p10": percentile(ndvi_v, 10),
            "p90": percentile(ndvi_v, 90),
            "below_0_2_pct": round(
                float(np.mean(ndvi_v < 0.2) * 100), 2
            ),
            "below_0_3_pct": round(
                float(np.mean(ndvi_v < 0.3) * 100), 2
            ),
        },
        "ndmi": {
            "mean": round(float(np.mean(ndmi_v)), 4),
            "median": round(float(np.median(ndmi_v)), 4),
            "p10": percentile(ndmi_v, 10),
            "p90": percentile(ndmi_v, 90),
            "below_0_pct": round(
                float(np.mean(ndmi_v < 0.0) * 100), 2
            ),
        },
        "bsi": {
            "mean": round(float(np.mean(bsi_v)), 4),
            "median": round(float(np.median(bsi_v)), 4),
            "p10": percentile(bsi_v, 10),
            "p90": percentile(bsi_v, 90),
            "above_0_pct": round(
                float(np.mean(bsi_v > 0.0) * 100), 2
            ),
            "above_0_1_pct": round(
                float(np.mean(bsi_v > 0.1) * 100), 2
            ),
        },
        "combined_signals": {
            "low_vegetation_and_dry_pct": round(
                float(np.mean(dry_low_vegetation) * 100), 2
            ),
            "low_vegetation_dry_exposed_pct": round(
                float(np.mean(dry_exposed) * 100), 2
            ),
            "strong_low_vegetation_dry_exposed_pct": round(
                float(np.mean(strong_dry_exposed) * 100), 2
            ),
        },
        "interpretation_guardrail": (
            "Spectral surface-screening evidence only. "
            "Does not establish rover trafficability, soil mechanics, "
            "bearing strength, wheel slip, sinkage, rock abundance, "
            "or validated planetary-analog status."
        ),
    }

    print(json.dumps(result, indent=2))

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)

        with args.output.open("w") as f:
            json.dump(result, f, indent=2)

        print()
        print(f"Saved: {args.output}")


if __name__ == "__main__":
    main()
