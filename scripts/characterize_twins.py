"""Characterize every destination's Earth twin on three more dimensions (characterization v1).

Frozen configuration: config/characterization/dimensions_v1.yaml (committed before
any value was computed). Descriptive only: the VAL-004 twins and ranking do not change.

    python scripts/characterize_twins.py --gpw data/gpw/gpw_v4_population_density_rev11_2020_2pt5_min.tif

Inputs (defaults in brackets):
  web/data/val004-sites.json            destinations and their Earth twins
  results/val004/moon_windows.csv       lunar window centres in the LOLA plane
  results/val004/mars_windows.csv       Mars window centres
  --moon-dem  [data/moon/LDEM_80S_20MPP_ADJ.TIF, else the PGDA URL]
  --ctx-dem   [data/mars/jezero/raw/M20_JezeroCrater_CTXDEM_20m.tif]
  --gpw       SEDAC GPWv4 population density 2020, 2.5 arc-minute GeoTIFF (operations is skipped without it)
  Copernicus GLO-30 tiles are read from the public AWS bucket (or --copernicus-root).
  NASA POWER responses are cached in data/cache/power/.

Outputs:
  results/characterization/twin_sheets_v1.json   full record with fingerprints and provenance
  web/data/twin-sheets.json                      what the web app shows
"""
from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from parallax import characterize as ch  # noqa: E402

SITES = ROOT / "web/data/val004-sites.json"
CONFIG = ROOT / "config/characterization/dimensions_v1.yaml"
OUT_FULL = ROOT / "results/characterization/twin_sheets_v1.json"
OUT_WEB = ROOT / "web/data/twin-sheets.json"
MOON_DEM_LOCAL = ROOT / "data/moon/LDEM_80S_20MPP_ADJ.TIF"
MOON_DEM_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF"
CTX_DEM_LOCAL = ROOT / "data/mars/jezero/raw/M20_JezeroCrater_CTXDEM_20m.tif"
CTX_DEM_URL = "https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif"
FINE_MARS_IDS = {"perseverance"}  # the only Mars destination with a fine DEM (CTX)


def read_rows(path: Path) -> dict[str, dict]:
    with path.open(newline="") as f:
        return {r["id"]: r for r in csv.DictReader(f)}


def git_commit() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return None


def guarded(fn, *args):
    try:
        return fn(*args)
    except Exception as e:  # recorded, never hidden
        return {"status": "error", "error": f"{type(e).__name__}: {e}"}


def fine_dimension(dest: dict, moon_rows: dict, mars_rows: dict, args) -> dict:
    from parallax.characterize import sources

    earth = ch.fine_fingerprint(sources.earth_fine_window(dest["earth"]["lat"], dest["earth"]["lon"], args.copernicus_root))
    if dest["body"] == "moon":
        w = moon_rows[dest["window"]]
        planet = ch.fine_fingerprint(sources.moon_fine_window(args.moon_dem, float(w["x"]), float(w["y"])))
    elif dest["id"] in FINE_MARS_IDS and Path(args.ctx_dem).exists():
        # The CTX mosaic (17.58-19.29 N, 76.99-78.58 E) does not contain the VAL-004 grid window
        # (centre 77.08 E), so Jezero is measured at the frozen reference centre, the landing site,
        # as in the VAL-004 Mars bridge test. Decided before any Jezero fine value was computed.
        planet = ch.fine_fingerprint(sources.mars_fine_window(str(args.ctx_dem), float(dest["lat"]), float(dest["lon"])))
    else:
        out = ch.fine_relief(earth, None)
        if out["reason"] == "planet":  # explain why the planetary side is missing; an Earth gap keeps reason "earth"
            out["reason"] = (f"CTX DEM not found at {args.ctx_dem}" if dest["id"] in FINE_MARS_IDS
                             else "no Mars elevation model finer than MOLA 463 m at this site")
        return out
    out = ch.fine_relief(earth, planet)
    if out.get("reason") == "earth" and earth["valid_share"] == 0:
        out["reason_detail"] = "no Copernicus GLO-30 tile published for this area"
    return out


def temperature_dimension(dest: dict, cache: Path) -> dict:
    from parallax.characterize import sources

    payload = sources.power_climatology(dest["earth"]["lat"], dest["earth"]["lon"], cache)
    return ch.temperature(ch.power_extremes(payload), dest["body"])


def operations_dimension(dest: dict, gpw: str) -> dict:
    from parallax.characterize import sources

    return ch.operations(sources.population_densities(gpw, dest["earth"]["lat"], dest["earth"]["lon"]), dest["earth"].get("km"))


def web_view(sheet: dict) -> dict:
    """Drop the raw fingerprints; keep what the page shows."""
    out = {}
    for key, dim in sheet["dimensions"].items():
        d = {k: v for k, v in dim.items() if k not in ("earth", "planet")}
        if key == "fine_relief":
            for side in ("earth", "planet"):
                if dim.get(side):
                    d[f"{side}_steep_share"] = dim[side].get("steep_share")
                    d[f"{side}_valid_share"] = dim[side].get("valid_share")
        out[key] = d
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--moon-dem", default=str(MOON_DEM_LOCAL) if MOON_DEM_LOCAL.exists() else MOON_DEM_URL)
    ap.add_argument("--ctx-dem", default=str(CTX_DEM_LOCAL))
    ap.add_argument("--gpw", help="GPWv4 population density 2020 2.5 arc-minute GeoTIFF")
    ap.add_argument("--copernicus-root", help="local folder or URL with Copernicus GLO-30 tiles named <tile>.tif")
    ap.add_argument("--only", nargs="*", help="destination ids to run (default: all)")
    ap.add_argument("--skip", nargs="*", default=[], choices=["fine_relief", "temperature", "operations"])
    args = ap.parse_args()

    sites = json.loads(SITES.read_text())
    dests = [d for d in sites["destinations"] if not args.only or d["id"] in args.only]
    moon_rows = read_rows(ROOT / "results/val004/moon_windows.csv")
    mars_rows = read_rows(ROOT / "results/val004/mars_windows.csv")
    cache = ROOT / "data/cache/power"

    sheets = {}
    for i, d in enumerate(dests, 1):
        print(f"[{i}/{len(dests)}] {d['name']} -> twin near {d['earth'].get('nearest')} ({d['earth']['lat']:.3f}, {d['earth']['lon']:.3f})", flush=True)
        dims = {}
        if "fine_relief" not in args.skip:
            dims["fine_relief"] = guarded(fine_dimension, d, moon_rows, mars_rows, args)
        if "temperature" not in args.skip:
            dims["temperature"] = guarded(temperature_dimension, d, cache)
        if "operations" not in args.skip:
            dims["operations"] = guarded(operations_dimension, d, args.gpw) if args.gpw else {"status": "not_measured", "reason": "GPWv4 file not given"}
        for k, v in dims.items():
            print(f"    {k}: {v.get('verdict') or v.get('status')} {v.get('error', '')}", flush=True)
        sheets[d["id"]] = {"body": d["body"], "earth": d["earth"], "window": d["window"], "dimensions": dims}

    provenance = {
        "config": str(CONFIG.relative_to(ROOT)),
        "commit": git_commit(),
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "moon_dem": args.moon_dem, "ctx_dem": args.ctx_dem, "gpw": args.gpw,
        "earth_dem": args.copernicus_root or "Copernicus DEM GLO-30, AWS Open Data (copernicus-dem-30m)",
        "temperature": "NASA POWER climatology API, TS_MIN / TS_MAX",
    }
    if args.only and OUT_FULL.exists():  # partial runs update, never drop other destinations
        prev = json.loads(OUT_FULL.read_text())
        prev["sheets"].update(sheets)
        sheets = prev["sheets"]
    OUT_FULL.parent.mkdir(parents=True, exist_ok=True)
    OUT_FULL.write_text(json.dumps({"version": "characterization_v1", "provenance": provenance, "sheets": sheets}, indent=1))
    OUT_WEB.write_text(json.dumps({"version": "characterization_v1", "run_at": provenance["run_at"],
                                   "sheets": {k: web_view(v) for k, v in sheets.items()}}, separators=(",", ":")))
    print(f"Wrote {OUT_FULL.relative_to(ROOT)} and {OUT_WEB.relative_to(ROOT)} ({len(sheets)} destinations)")


if __name__ == "__main__":
    main()
