"""Earth dimensions v1: measure every eligible Earth window (config/search/earth_dimensions_v1.yaml).

Frozen rules: config/search/earth_dimensions_v1.yaml and its amendment v1.1 (centres
rounded to 4 decimals, B1 at the published precision). Each dimension reuses the
twin characterization code unchanged.

Every invocation first runs check B1 on the 21 VAL-004 twins (their values are
already published) and times it. A dimension whose B1 fails is not run.

    # 1. B1 and timing only (no new window is measured)
    python scripts/earth_dimensions.py --twins-only --gpw <GPW.tif> --pzi <PZI.tif> --glim <GLiM folder>

    # 2. Full run, one dimension at a time, resumable (Ctrl-C is safe)
    python scripts/earth_dimensions.py --dims rock access permafrost --gpw ... --pzi ... --glim ...
    python scripts/earth_dimensions.py --dims temperature --workers 4
    python scripts/earth_dimensions.py --dims ground --workers 8 [--worldcover-root <local tiles>]

    # 3. Outputs, once dimensions are complete
    python scripts/earth_dimensions.py --assemble

Outputs:
  results/earth_dimensions/partial/<dimension>.csv   one row per window as it is measured (resume point)
  results/earth_dimensions/checks_v1.json            B1 per dimension, timing
  results/earth_dimensions/earth_dimensions_v1.csv   complete dimensions, one row per window (with --assemble)
  results/earth_dimensions/run_v1.json               provenance, coverage, predictions (with --assemble)
  web/data/earth-index.csv                           what the search reads (with --assemble)
"""
from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from parallax import characterize as ch  # noqa: E402
from parallax.matching.similarity import jensen_shannon_distance  # noqa: E402

CONFIG = ROOT / "config/search/earth_dimensions_v1.yaml"
AMENDMENT = ROOT / "config/search/earth_dimensions_v1_1_amendment.yaml"
WINDOWS = ROOT / "results/val004/earth_windows.csv"
MOON_WINDOWS = ROOT / "results/val004/moon_windows.csv"
REACHABLE = ROOT / "results/campaign/reachable_twins_v1.json"
SHEETS = ROOT / "results/characterization/twin_sheets_v1.json"
OUT = ROOT / "results/earth_dimensions"
PARTIAL = OUT / "partial"
OUT_WEB = ROOT / "web/data/earth-index.csv"
BINS = ["0-1", "1-2", "2-3", "3-5", "5-10", "10-15", "15-20", ">=20"]
DIMENSIONS = ["rock", "access", "permafrost", "temperature", "ground"]  # cheapest first
STRONG = 0.29885
TOL = 5e-7


# --------------------------------------------------------------------------- windows


def load_windows(path: Path = WINDOWS) -> list[dict]:
    """Eligible VAL-004 Earth windows, centre rounded to 4 decimals (amendment v1.1)."""
    out = []
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            if r["land_status"] != "ELIGIBLE":
                continue
            out.append({"id": r["id"], "lat": round(float(r["lat"]), 4), "lon": round(float(r["lon"]), 4),
                        "hist": [float(r[b]) for b in BINS]})
    return out


# --------------------------------------------------------------------------- one window, one dimension


def measure(dim: str, lat: float, lon: float, args) -> dict:
    """Earth-side value of one dimension, with the twin characterization code unchanged."""
    from parallax.characterize import sources

    box = ch.window_bounds_deg(lat, lon)
    if dim == "rock":
        weights = sources.glim_class_weights(args.glim, box)
        out = ch.geology("sedimentary", weights)  # the family only picks the verdict; the shares do not depend on it
        if out["status"] != "measured":
            return {"status": "not_measured", "reason": out["reason"]}
        return {"status": "measured", "classes": out["earth_classes"], "_weights": weights}
    if dim == "access":
        return ch.operations(sources.population_densities(args.gpw, lat, lon), None)
    if dim == "permafrost":
        return ch.earth_ice(sources.box_values(args.pzi, *box))
    if dim == "temperature":
        lo, hi = ch.power_extremes(sources.power_climatology(lat, lon, args.power_cache))
        return {"status": "measured", "ts_min_c": round(lo, 1), "ts_max_c": round(hi, 1), "_raw": [lo, hi]}
    if dim == "ground":
        counts, total, tiles = sources.worldcover_counts(lat, lon, args.worldcover_root)
        return {**ch.ground(counts, total), "tiles": tiles}
    raise ValueError(dim)


def guarded(dim: str, w: dict, args) -> dict:
    try:
        return measure(dim, w["lat"], w["lon"], args)
    except Exception as e:  # recorded, never filled in
        return {"status": "error", "reason": f"{type(e).__name__}: {e}"[:300]}


# --------------------------------------------------------------------------- B1


def same(new, old) -> bool:
    """Equal at the published precision: numbers within TOL, everything else identical."""
    if isinstance(old, dict):
        return isinstance(new, dict) and all(k in new and same(new[k], v) for k, v in old.items())
    if isinstance(old, list):
        return isinstance(new, list) and len(new) == len(old) and all(same(a, b) for a, b in zip(new, old))
    if isinstance(old, bool) or isinstance(new, bool):
        return new is old
    if isinstance(old, (int, float)) and isinstance(new, (int, float)):
        return abs(float(new) - float(old)) <= TOL
    return new == old


def twin_view(dim: str, new: dict, sheet: dict, body: str) -> tuple[dict, dict]:
    """(new, published) pair in the published shape, for one twin."""
    d = sheet["dimensions"]
    if dim == "rock":
        old = {k: v for k, v in d["geology"].items() if k != "planet"}
        if new["status"] != "measured":
            return {"status": "not_measured"}, {"status": old["status"]}
        return ch.geology(old["family"], new["_weights"]), old
    if dim == "access":
        old = dict(d["operations"]); old.pop("nearest_settlement_km", None)
        return new, old
    if dim == "permafrost":
        return new, d["ice"]["earth"]
    if dim == "temperature":
        old = d["temperature"]
        if new["status"] != "measured":
            return {"status": new["status"]}, {"status": old["status"]}
        return ch.temperature(tuple(new["_raw"]), body), old
    if dim == "ground":
        return new, d["ground"]
    raise ValueError(dim)


def twins() -> list[dict]:
    """The 21 destinations with their twin window (id and published 4-decimal centre)."""
    sheets = json.loads(SHEETS.read_text())["sheets"]
    out = []
    for d in json.loads(REACHABLE.read_text())["destinations"]:
        s = sheets[d["id"]]
        out.append({"dest": d["id"], "body": d["body"], "id": d["val004_twin"]["id"],
                    "lat": s["earth"]["lat"], "lon": s["earth"]["lon"], "sheet": s})
    return out


def check_b1(dim: str, args, windows_by_id: dict) -> dict:
    rows, t0 = [], time.perf_counter()
    for t in twins():
        w = windows_by_id[t["id"]]
        if (w["lat"], w["lon"]) != (t["lat"], t["lon"]):
            rows.append({"dest": t["dest"], "ok": False, "why": f"centre {w['lat']},{w['lon']} != published {t['lat']},{t['lon']}"})
            continue
        new = guarded(dim, w, args)
        a, b = twin_view(dim, new, t["sheet"], t["body"])
        ok = same(a, b)
        rows.append({"dest": t["dest"], "ok": ok, **({} if ok else {"new": a, "published": b})})
    secs = time.perf_counter() - t0
    return {"pass": all(r["ok"] for r in rows), "twins": len(rows), "failed": [r for r in rows if not r["ok"]],
            "seconds_per_window": round(secs / max(1, len(rows)), 3)}


# --------------------------------------------------------------------------- partial files


def done_ids(dim: str, retry_errors: bool = False) -> set[str]:
    path = PARTIAL / f"{dim}.csv"
    if not path.exists():
        return set()
    with path.open(newline="") as f:
        return {r["id"] for r in csv.DictReader(f) if not (retry_errors and r["status"] == "error")}


def read_partial(dim: str) -> dict[str, dict]:
    """Last row per window (a retried error is superseded by the newer row)."""
    path = PARTIAL / f"{dim}.csv"
    out: dict[str, dict] = {}
    if path.exists():
        with path.open(newline="") as f:
            for r in csv.DictReader(f):
                out[r["id"]] = json.loads(r["value"])
    return out


def run_dimension(dim: str, windows: list[dict], args) -> None:
    PARTIAL.mkdir(parents=True, exist_ok=True)
    path = PARTIAL / f"{dim}.csv"
    skip = done_ids(dim, args.retry_errors)
    todo = [w for w in windows if w["id"] not in skip]
    print(f"{dim}: {len(windows) - len(todo)} already done, {len(todo)} to measure", flush=True)
    new_file = not path.exists()
    with path.open("a", newline="") as f:
        out = csv.writer(f)
        if new_file:
            out.writerow(["id", "status", "value"])
        t0, n = time.perf_counter(), 0
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
            futures = {pool.submit(guarded, dim, w, args): w["id"] for w in todo}
            for fut in as_completed(futures):
                v = fut.result(); v.pop("_raw", None); v.pop("_weights", None)
                out.writerow([futures[fut], v["status"], json.dumps(v, separators=(",", ":"))])
                n += 1
                if n % 200 == 0:
                    f.flush()
                    rate = n / (time.perf_counter() - t0)
                    print(f"  {dim}: {n}/{len(todo)} ({rate:.1f}/s, ~{(len(todo) - n) / rate / 3600:.1f} h left)", flush=True)


# --------------------------------------------------------------------------- assemble


def complete(dim: str, ids: list[str]) -> bool:
    got = read_partial(dim)
    return all(i in got for i in ids)


def predictions(rows: list[dict], windows: list[dict], have: set[str]) -> dict:
    """The four registered predictions, evaluated only when their dimensions are complete."""
    n = len(rows)
    out: dict[str, dict] = {}

    def share(pred) -> float:
        return sum(1 for r in rows if pred(r)) / n

    if "ground" in have:
        s = share(lambda r: r.get("bare_share") not in (None, "") and float(r["bare_share"]) >= 0.5)
        out["P1_bare"] = {"value": round(s, 4), "supported": 0.05 <= s <= 0.20}
    if "permafrost" in have:
        s = share(lambda r: r.get("ice_signal") == "true")
        out["P2_permafrost"] = {"value": round(s, 4), "supported": s < 0.15}
    if "access" in have:
        s = share(lambda r: r.get("access") == "remote")
        out["P3_remote"] = {"value": round(s, 4), "supported": 0.20 <= s <= 0.40}
    if {"ground", "permafrost"} <= have:
        strong = shackleton_strong_twins(windows)
        by_id = {r["id"]: r for r in rows}
        hits = [i for i in strong if by_id[i].get("bare_share") not in (None, "") and float(by_id[i]["bare_share"]) >= 0.5
                and by_id[i].get("ice_signal") == "true"]
        out["P4_drilling"] = {"strong_twins": len(strong), "with_bare_and_permafrost": len(hits), "ids": hits[:50],
                              "supported": len(hits) >= 5}
    return out


def shackleton_strong_twins(windows: list[dict]) -> list[str]:
    dest = next(d for d in json.loads(REACHABLE.read_text())["destinations"] if d["id"] == "shackleton")
    with MOON_WINDOWS.open(newline="") as f:
        p = next([float(r[b]) for b in BINS] for r in csv.DictReader(f) if r["id"] == dest["window"])
    p = np.array(p)
    strong = [w["id"] for w in windows if jensen_shannon_distance(p, np.array(w["hist"])) <= STRONG]
    if len(strong) != dest["good_twins"]:
        raise RuntimeError(f"Shackleton strong twins {len(strong)} != campaign v1 count {dest['good_twins']}")
    return strong


def flat(dim: str, v: dict | None) -> dict:
    """Columns of one dimension for the output tables; empty when not measured."""
    m = v is not None and v.get("status") == "measured"
    if dim == "ground":
        return {"bare_share": v["bare_share"] if m else "", "vegetated_share": v["vegetated_share"] if m else "",
                "snow_ice_share": v["snow_ice_share"] if m else "", "dominant_class": v["dominant_class"] if m else ""}
    if dim == "access":
        return {"population_mean_km2": v["population_mean_km2"] if m else "", "access": v["verdict"] if m else ""}
    if dim == "permafrost":
        return {"pzi_share": v["pzi_share"] if m else "", "ice_signal": ("true" if v["signal"] else "false") if m else ""}
    if dim == "rock":
        return {"glim": ";".join(f"{k}:{s}" for k, s in v["classes"].items()) if m else ""}
    if dim == "temperature":
        return {"ts_min_c": v["ts_min_c"] if m else "", "ts_max_c": v["ts_max_c"] if m else ""}
    raise ValueError(dim)


def reason(v: dict | None) -> str:
    return "" if v is None or v.get("status") == "measured" else f"{v.get('status')}: {v.get('reason', '')}"


def assemble(windows: list[dict]) -> None:
    ids = [w["id"] for w in windows]
    have = {d for d in DIMENSIONS if complete(d, ids)}
    if not have:
        raise SystemExit("No dimension is complete yet; nothing is assembled (partial runs are kept, not exposed).")
    data = {d: read_partial(d) for d in have}
    rows = []
    for w in windows:
        r = {"id": w["id"], "lat": w["lat"], "lon": w["lon"]}
        for d in DIMENSIONS:
            if d in have:
                r.update(flat(d, data[d].get(w["id"])))
                r[f"{d}_missing"] = reason(data[d].get(w["id"]))
        rows.append(r)
    coverage = {d: {"measured": sum(1 for i in ids if data[d][i].get("status") == "measured"),
                    "not_measured": sum(1 for i in ids if data[d][i].get("status") == "not_measured"),
                    "error": sum(1 for i in ids if data[d][i].get("status") == "error")} for d in sorted(have)}
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / "earth_dimensions_v1.csv").open("w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=list(rows[0])); wr.writeheader(); wr.writerows(rows)
    web_cols = ["id", "lat", "lon", *BINS] + [c for c in ("bare_share", "vegetated_share", "access", "ice_signal", "glim", "ts_min_c", "ts_max_c") if c in rows[0]]
    hist = {w["id"]: w["hist"] for w in windows}
    with OUT_WEB.open("w", newline="") as f:
        wr = csv.writer(f); wr.writerow(web_cols)
        for r in rows:
            wr.writerow([r["id"], r["lat"], r["lon"], *(round(x, 6) for x in hist[r["id"]])] + [r[c] for c in web_cols[11:]])
    checks = json.loads((OUT / "checks_v1.json").read_text()) if (OUT / "checks_v1.json").exists() else {}
    run = {"version": "earth_dimensions_v1.1", "config": [str(CONFIG.relative_to(ROOT)), str(AMENDMENT.relative_to(ROOT))],
           "commit": git_commit(), "assembled_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "windows": len(ids), "complete": sorted(have), "incomplete": [d for d in DIMENSIONS if d not in have],
           "checks": checks, "B2_index_distance": "run by the web tests when the search reads web/data/earth-index.csv",
           "coverage": coverage, "predictions": predictions(rows, windows, have)}
    (OUT / "run_v1.json").write_text(json.dumps(run, indent=1, ensure_ascii=False))
    print(json.dumps({"complete": run["complete"], "coverage": coverage, "predictions": run["predictions"]}, indent=1))


def git_commit() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return None


# --------------------------------------------------------------------------- main


def parse(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dims", nargs="+", choices=DIMENSIONS, default=None, help="dimensions to run (default: those whose inputs are given)")
    p.add_argument("--twins-only", action="store_true", help="run B1 and timing only")
    p.add_argument("--assemble", action="store_true", help="write the outputs from complete dimensions")
    p.add_argument("--gpw", help="GPWv4 population density 2020, 2.5 arc-minute GeoTIFF")
    p.add_argument("--pzi", help="Global Permafrost Zonation Index raster")
    p.add_argument("--glim", help="folder with glim_wgs84_0point5deg.txt.asc and Classnames.txt")
    p.add_argument("--worldcover-root", default=None, help="local WorldCover tiles (default: public AWS bucket)")
    p.add_argument("--power-cache", type=Path, default=ROOT / "data/cache/power")
    p.add_argument("--workers", type=int, default=1)
    p.add_argument("--retry-errors", action="store_true", help="measure again the windows whose last attempt was an error")
    return p.parse_args(argv)


def main(argv=None) -> None:
    args = parse(argv)
    windows = load_windows()
    if args.assemble:
        assemble(windows); return
    inputs = {"rock": args.glim, "access": args.gpw, "permafrost": args.pzi, "temperature": True, "ground": True}
    dims = args.dims or [d for d in DIMENSIONS if inputs[d] and d not in ("temperature", "ground")]
    missing = [d for d in dims if not inputs[d]]
    if missing:
        raise SystemExit(f"Missing input for {missing}: give " + ", ".join({"rock": "--glim", "access": "--gpw", "permafrost": "--pzi"}[d] for d in missing))
    by_id = {w["id"]: w for w in windows}
    OUT.mkdir(parents=True, exist_ok=True)
    checks_path = OUT / "checks_v1.json"
    checks = json.loads(checks_path.read_text()) if checks_path.exists() else {}
    for dim in dims:
        b1 = check_b1(dim, args, by_id)
        b1["run_at"], b1["commit"] = datetime.now(timezone.utc).isoformat(timespec="seconds"), git_commit()
        b1["projected_hours_1_worker"] = round(b1["seconds_per_window"] * len(windows) / 3600, 1)
        checks[dim] = b1
        checks_path.write_text(json.dumps(checks, indent=1, ensure_ascii=False))
        print(f"B1 {dim}: {'PASS' if b1['pass'] else 'FAIL'} ({b1['twins']} twins, {b1['seconds_per_window']} s/window, "
              f"~{b1['projected_hours_1_worker']} h for {len(windows)} windows with 1 worker)", flush=True)
        if not b1["pass"]:
            print(json.dumps(b1["failed"], indent=1, ensure_ascii=False)[:3000])
            print(f"  {dim} stops here: no new value is measured (earth_dimensions_v1.yaml, checks.B1).")
            continue
        if not args.twins_only:
            run_dimension(dim, windows, args)


if __name__ == "__main__":
    main()
