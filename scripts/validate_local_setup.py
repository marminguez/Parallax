"""Inspect the local geospatial setup; optionally evaluate one new coordinate."""
from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lat", type=float, default=43.0)
    parser.add_argument("--lon", type=float, default=-3.0)
    parser.add_argument("--evaluate", action="store_true")
    args = parser.parse_args()
    if not (-55 <= args.lat <= 59 and -180 <= args.lon <= 180):
        parser.error("Coordinate must be finite and inside SRTM coverage (-55 to 59 latitude).")

    report = {
        "python": sys.executable,
        "python_version": sys.version.split()[0],
        "dependencies": {},
        "datasets": {},
        "coordinate": {"lat": args.lat, "lon": args.lon},
        "status": "inventory",
    }
    missing = []
    for name in ("numpy", "rasterio", "pyproj"):
        try:
            module = importlib.import_module(name)
            report["dependencies"][name] = getattr(module, "__version__", "available")
        except Exception as exc:
            report["dependencies"][name] = str(exc)
            missing.append(name)

    dem_dir = ROOT / "data/earth/coarse/raw"
    mask_dir = ROOT / "data/earth/mod44w/processed"
    dems = sorted(dem_dir.glob("*.SRTMGL30.dem.zip"))
    masks = sorted(mask_dir.glob("MOD44W_*_native.tif"))
    target = ROOT / "results/exp001/jezero_target_50km_v0_4.json"
    report["datasets"] = {
        "srtm_tiles": len(dems),
        "srtm_examples": [p.name for p in dems[:5]],
        "mod44w_masks": len(masks),
        "mask_examples": [p.name for p in masks[:5]],
        "jezero_target_present": target.is_file(),
    }
    report["missing_prerequisites"] = [
        *["Python dependency: " + name for name in missing],
        *(["SRTMGL30 ZIP tiles in data/earth/coarse/raw"] if not dems else []),
        *(["MOD44W native masks in data/earth/mod44w/processed"] if not masks else []),
        *(["Frozen Jezero target v0.4"] if not target.is_file() else []),
    ]
    if args.evaluate:
        if report["missing_prerequisites"]:
            report["status"] = "not_ready"
            report["next_step"] = "Prepare the listed prerequisites, then rerun the same command. No synthetic result was generated."
        else:
            sys.path.insert(0, str(ROOT / "src"))
            sys.path.insert(0, str(ROOT / "scripts"))
            previous_dir = Path.cwd()
            try:
                os.chdir(ROOT)
                from evaluate_candidate import evaluate_candidate
                result = evaluate_candidate(args.lat, args.lon)
                report["status"] = "evaluation_passed"
                report["result"] = result
                report["next_step"] = "Use this exact Python executable as PARALLAX_PYTHON when starting web. Then evaluate a small region around this coordinate."
            except Exception as exc:
                report["status"] = "evaluation_failed"
                report["error_type"] = type(exc).__name__
                report["error"] = str(exc)
                report["next_step"] = "Inspect the reported source/coverage error before running the web live search. Having some raster files does not guarantee coverage at this coordinate."
            finally:
                os.chdir(previous_dir)
    else:
        report["next_step"] = "Rerun with --evaluate to calculate a new point; inventory alone does not validate the engine."
    print(json.dumps(report, indent=2, allow_nan=False))
    return 1 if report["status"] in ("not_ready", "evaluation_failed") else 0


if __name__ == "__main__":
    raise SystemExit(main())
