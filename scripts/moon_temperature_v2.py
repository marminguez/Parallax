"""Moon temperature v2 (config/search/moon_temperature_v2.yaml, amendment v2.1).

Measures the lunar surface temperature range of each lunar reference window with
LRO Diviner Polar Cumulative Products (south pole, bolometric temperature binned
by subsolar longitude, 240 m), downloading only the byte ranges of the tables that
cover the windows.

    # 1. Download the window rows of the 48 tables (resumable; about 5 GB of transfer)
    python scripts/moon_temperature_v2.py --fetch --workers 2

    # 2. D1, D2, T1-T3 and the outputs
    python scripts/moon_temperature_v2.py --assemble

Outputs:
  data/diviner/rows/<file>.npz            the window rows of each table (resume point, not in git)
  results/diviner/moon_temperature_v2.json
  web/data/moon-temperature-v2.json        (only if D1 and D2 pass)
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import subprocess
import sys
import time
import http.client
import threading
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config/search/moon_temperature_v2.yaml"
BASE = "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_pcp/diurnal/slon/pols/"
SEASONS = ("sum", "win")
BINS = list(range(1, 97, 4))            # amendment v2.1: slon01, 05, ..., 93
FILE = "pcp_avg_tbol_pols_{season}_slon{b:02d}_240"
ROW = 59                                 # RECORD_BYTES; row 0 of the file is the header
R_M = 1_737_400.0
DX = 240.0 / R_M
HALF_M = 25_000.0
MARGIN_M = 2_000.0
LOLA = "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
SHACKLETON_IAU = (-89.67, 129.78)
VALID_SHARE = 0.90
COLD_TRAP_K = 110.0
K0 = 273.15

ARTEMIS = {"peak-near-cabeus-b": "MOON-200-100", "haworth": "MOON-200-250", "malapert-massif": "MOON-150-275",
           "mons-mouton-plateau": "MOON-125-375", "mons-mouton": "MOON-150-350", "nobile-rim-1": "MOON-175-350",
           "nobile-rim-2": "MOON-175-425", "de-gerlache-rim-2": "MOON-250-225", "slater-plain": "MOON-325-350"}

OUT = ROOT / "results/diviner"
ROWS_DIR = ROOT / "data/diviner/rows"
OUT_WEB = ROOT / "web/data/moon-temperature-v2.json"


# --------------------------------------------------------------------------- windows


def lola():
    from pyproj import Transformer
    return Transformer.from_crs("+proj=longlat +R=1737400 +no_defs", LOLA, always_xy=True)


def windows() -> dict[str, dict]:
    """The 11 windows: 'shackleton' (exp002 box, search target), the Shackleton twin-sheet window and the 9 Artemis windows."""
    rows = {r["id"]: r for r in csv.DictReader((ROOT / "results/val004/moon_windows.csv").open())}
    t = lola()
    sx, sy = t.transform(SHACKLETON_IAU[1], SHACKLETON_IAU[0])
    out = {"shackleton": {"x": float(sx), "y": float(sy), "use": "search target (exp002 box)"},
           "shackleton-sheet": {"x": float(rows["MOON-275-275"]["x"]), "y": float(rows["MOON-275-275"]["y"]), "window": "MOON-275-275", "use": "Shackleton twin sheet"}}
    for ref, wid in ARTEMIS.items():
        out[ref] = {"x": float(rows[wid]["x"]), "y": float(rows[wid]["y"]), "window": wid, "use": "search target and twin sheet"}
    return out


def x_intervals(wins: dict) -> list[tuple[float, float]]:
    """Normalised x ranges (with margin) that cover every window, merged."""
    iv = sorted(((w["x"] - HALF_M - MARGIN_M) / R_M, (w["x"] + HALF_M + MARGIN_M) / R_M) for w in wins.values())
    merged: list[list[float]] = []
    for a, b in iv:
        if merged and a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    return [(a, b) for a, b in merged]


def members(clon: np.ndarray, clat: np.ndarray, wins: dict) -> dict[str, np.ndarray]:
    """Boolean mask per window: the pixel centre, through lon/lat into the LOLA plane, lies inside the box."""
    x, y = lola().transform(clon, clat)
    x, y = np.asarray(x), np.asarray(y)
    return {k: (np.abs(x - w["x"]) < HALF_M) & (np.abs(y - w["y"]) < HALF_M) for k, w in wins.items()}


# --------------------------------------------------------------------------- reading the tables


_local = threading.local()
BACKOFF_S = (5, 15, 45, 90, 180, 300)


def _conn(fresh: bool = False):
    """One kept-alive HTTPS connection per worker thread: the archive refuses bursts of new TLS handshakes."""
    if fresh or getattr(_local, "conn", None) is None:
        if getattr(_local, "conn", None) is not None:
            try:
                _local.conn.close()
            except Exception:
                pass
        _local.conn = http.client.HTTPSConnection(urllib.parse.urlsplit(BASE).netloc, timeout=120)
    return _local.conn


def http_get(url: str, rng: tuple[int, int] | None = None) -> bytes:
    path = urllib.parse.urlsplit(url).path
    headers = {"User-Agent": "parallax-moon-temperature-v2", "Connection": "keep-alive"}
    if rng:
        headers["Range"] = f"bytes={rng[0]}-{rng[1]}"
    for i, wait in enumerate((0, *BACKOFF_S)):
        if wait:
            time.sleep(wait)
        try:
            c = _conn(fresh=i > 0)
            c.request("GET", path, headers=headers)
            r = c.getresponse()
            body = r.read()
            if rng and r.status != 206:
                raise IOError(f"server did not honour the byte range (HTTP {r.status})")
            if not rng and r.status != 200:
                raise IOError(f"HTTP {r.status}")
            return body
        except Exception:
            if i == len(BACKOFF_S):
                raise
    raise AssertionError


def http_range(url: str, start: int, end: int) -> bytes:
    return http_get(url, (start, end))


def parse_rows(buf: bytes) -> np.ndarray:
    """(n, 5) array of x, y, clon, clat, tbol from whole fixed-length rows."""
    if not buf:
        return np.empty((0, 5))
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        arr = np.fromstring(buf.decode("ascii").replace(",", " "), sep=" ")
    if arr.size % 5:
        raise ValueError("partial row in a byte range")
    return arr.reshape(-1, 5)


def label(name: str) -> dict:
    text = http_get(BASE + name + ".lbl").decode("ascii", "replace")
    def get(key):
        for line in text.splitlines():
            if line.strip().startswith(key):
                return line.split("=", 1)[1].strip()
        raise SystemExit(f"{name}.lbl: {key} not found")
    lab = {"record_bytes": int(get("RECORD_BYTES")), "rows": int(get("ROWS")), "file_records": int(get("FILE_RECORDS")),
           "sunlon": [float(get("LRO:DLRE_SUNLON_MIN").split()[0]), float(get("LRO:DLRE_SUNLON_MAX").split()[0])]}
    if lab["record_bytes"] != ROW or lab["file_records"] != lab["rows"] + 1:
        raise SystemExit(f"{name}: unexpected layout {lab}; the run stops (rules: read every file with its label)")
    return lab


def row_x(url: str, k: int) -> float:
    off = ROW * (k + 1)
    return float(http_range(url, off, off + ROW - 1).split(b",")[0])


def lower_bound(url: str, n: int, xv: float) -> int:
    """First row index with x >= xv (rows sorted by x)."""
    lo, hi = 0, n
    while lo < hi:
        mid = (lo + hi) // 2
        if row_x(url, mid) < xv:
            lo = mid + 1
        else:
            hi = mid
    return lo


def fetch_one(season: str, b: int, wins: dict, intervals) -> dict:
    name = FILE.format(season=season, b=b)
    dest = ROWS_DIR / f"{name}.npz"
    if dest.exists():
        return {"file": name, "status": "cached"}
    lab = label(name)
    url = BASE + name + ".tab"
    n = lab["rows"]
    parts, nbytes, chunk = [], 0, 200_000
    for a, bnd in intervals:
        i0, i1 = lower_bound(url, n, a), lower_bound(url, n, bnd)
        for j in range(i0, i1, chunk):
            buf = http_range(url, ROW * (j + 1), ROW * (min(j + chunk, i1) + 1) - 1)
            nbytes += len(buf)
            rows = parse_rows(buf)
            keep = np.zeros(len(rows), bool)
            for v in members(rows[:, 2], rows[:, 3], wins).values():
                keep |= v
            parts.append(rows[keep])
    rows = np.vstack(parts) if parts else np.empty((0, 5))
    ROWS_DIR.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".tmp.npz")
    np.savez_compressed(tmp, x=rows[:, 0], y=rows[:, 1], clon=rows[:, 2], clat=rows[:, 3], tbol=rows[:, 4].astype("float32"),
                        label=json.dumps(lab), bytes=nbytes)
    tmp.replace(dest)
    return {"file": name, "status": "fetched", "rows": len(rows), "mb": round(nbytes / 1e6, 1)}


def fetch(workers: int) -> None:
    wins = windows()
    intervals = x_intervals(wins)
    jobs = [(s, b) for s in SEASONS for b in BINS]
    print(f"{len(jobs)} tables, x intervals {[(round(a, 4), round(b, 4)) for a, b in intervals]}", flush=True)
    t0, done = time.perf_counter(), 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(fetch_one, s, b, wins, intervals): (s, b) for s, b in jobs}
        for f in as_completed(futs):
            done += 1
            try:
                r = f.result()
                print(f"  [{done}/{len(jobs)}] {r}  ({(time.perf_counter() - t0) / 60:.1f} min)", flush=True)
            except Exception as e:  # retried on the next run
                print(f"  [{done}/{len(jobs)}] {futs[f]} ERROR {type(e).__name__}: {e}", flush=True)


# --------------------------------------------------------------------------- statistics


def pixel_stats() -> dict:
    """Per pixel and season: min and max over bins, and the pixel centre."""
    keys, seas, tb, lon, lat = [], [], [], [], []
    missing = []
    for s_i, s in enumerate(SEASONS):
        for b in BINS:
            f = ROWS_DIR / f"{FILE.format(season=s, b=b)}.npz"
            if not f.exists():
                missing.append(f.name)
                continue
            z = np.load(f)
            ix, iy = np.rint(z["x"] / DX).astype(np.int64), np.rint(z["y"] / DX).astype(np.int64)
            keys.append(ix * 100_000 + iy); seas.append(np.full(len(ix), s_i, np.int8)); tb.append(z["tbol"].astype(float))
            lon.append(z["clon"]); lat.append(z["clat"])
    if missing:
        raise SystemExit(f"{len(missing)} tables not fetched yet (first: {missing[:3]}); run --fetch again")
    k, s, t, lo, la = (np.concatenate(a) for a in (keys, seas, tb, lon, lat))
    out = {}
    for s_i in range(2):
        sel = s == s_i
        ks, ts = k[sel], t[sel]
        order = np.argsort(ks, kind="stable")
        ks, ts = ks[order], ts[order]
        u, start = np.unique(ks, return_index=True)
        out[s_i] = (u, np.minimum.reduceat(ts, start), np.maximum.reduceat(ts, start))
    u_all, first = np.unique(k, return_index=True)
    return {"seasons": out, "pixels": u_all, "lon": lo[first], "lat": la[first]}


def window_ranges(ps: dict, wins: dict) -> dict:
    u = ps["pixels"]
    mins = np.full(len(u), np.inf); maxs = np.full(len(u), -np.inf); seen = np.zeros((2, len(u)), bool)
    for s_i, (ks, mn, mx) in ps["seasons"].items():
        idx = np.searchsorted(u, ks)
        mins[idx] = np.minimum(mins[idx], mn); maxs[idx] = np.maximum(maxs[idx], mx); seen[s_i, idx] = True
    valid = seen.all(axis=0)
    m = members(ps["lon"], ps["lat"], wins)
    expected = (2 * HALF_M / 240.0) ** 2
    res = {}
    for k, w in wins.items():
        sel = m[k] & valid
        n = int(sel.sum())
        r = {"use": w["use"], "window": w.get("window"), "valid_pixels": n, "expected_pixels": round(expected),
             "valid_share": round(n / expected, 4), "measured": n >= VALID_SHARE * expected}
        if n:
            r.update({"min_k": round(float(np.percentile(mins[sel], 1)), 2), "max_k": round(float(np.percentile(maxs[sel], 99)), 2),
                      "coldest_max_k": round(float(maxs[sel].min()), 2)})
            r["min_c"], r["max_c"] = round(r["min_k"] - K0, 1), round(r["max_k"] - K0, 1)
        res[k] = r
    return res


def overlap(earth, planet) -> float:
    e0, e1 = min(earth), max(earth)
    p0, p1 = planet
    return max(0.0, min(e1, p1) - max(e0, p0)) / (p1 - p0)


def band(x: float) -> str:
    return "breaks" if x < 0.2 else "partly" if x < 0.5 else "holds"


def assemble() -> None:
    wins = windows()
    ps = pixel_stats()
    ranges = window_ranges(ps, wins)
    d1 = all(r["measured"] for r in ranges.values())
    d2 = ranges["shackleton"].get("coldest_max_k", math.inf) < COLD_TRAP_K
    sheets = json.loads((ROOT / "results/characterization/twin_sheets_v1.json").read_text())["sheets"]
    twins = {}
    for ref in ["shackleton", *ARTEMIS]:
        t = sheets[ref]["dimensions"]["temperature"]
        r = ranges["shackleton-sheet" if ref == "shackleton" else ref]
        v2 = None
        if r.get("measured"):
            ov = overlap(t["earth_c"], (r["min_c"], r["max_c"]))
            v2 = {"planet_c": [r["min_c"], r["max_c"]], "overlap": round(ov, 3), "verdict": band(ov)}
        twins[ref] = {"earth_c": t["earth_c"], "v1": {k: t[k] for k in ("planet_c", "overlap", "verdict")}, "v2": v2}
    measured = [r for r in ranges.values() if r.get("measured")]
    preds = {
        "T1_colder_than_100K": {"holds": d1 and all(r["min_c"] < -173.15 for r in measured), "min_c": {k: r.get("min_c") for k, r in ranges.items()}},
        "T2_cooler_than_literature_max": {"holds": d1 and all(r["max_c"] < 54 for r in measured), "max_c": {k: r.get("max_c") for k, r in ranges.items()}},
        "T3_no_lunar_twin_holds": {"holds": all(t["v2"] is not None and t["v2"]["overlap"] < 0.5 for t in twins.values())},
    }
    OUT.mkdir(parents=True, exist_ok=True)
    run = {"config": str(CONFIG.relative_to(ROOT)), "amendment": "v2.1", "commit": git_commit(),
           "assembled_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "files": [FILE.format(season=s, b=b) + ".tab" for s in SEASONS for b in BINS], "archive": BASE,
           "D1_coverage": {"pass": d1}, "D2_cold_trap": {"pass": d2, "shackleton_coldest_max_k": ranges["shackleton"].get("coldest_max_k")},
           "windows": ranges, "twins": twins, "predictions": preds}
    (OUT / "moon_temperature_v2.json").write_text(json.dumps(run, indent=1, ensure_ascii=False))
    print(json.dumps({"D1": d1, "D2": run["D2_cold_trap"], "windows": {k: [r.get("min_c"), r.get("max_c"), r["valid_share"]] for k, r in ranges.items()},
                      "twins": {k: [t["v1"]["verdict"], t["v2"] and t["v2"]["verdict"], t["v2"] and t["v2"]["overlap"]] for k, t in twins.items()},
                      "predictions": {k: v["holds"] for k, v in preds.items()}}, indent=1))
    if not (d1 and d2):
        print("D1 or D2 fails: web/data/moon-temperature-v2.json is not written (moon_temperature_v2.yaml, checks).")
        return
    web = {"source": "LRO Diviner Polar Cumulative Products (PDS), bolometric temperature, 240 m; moon temperature v2",
           "targets": {k: [ranges[k]["min_c"], ranges[k]["max_c"]] for k in ["shackleton", *ARTEMIS]}}
    OUT_WEB.write_text(json.dumps(web, indent=1) + "\n")
    print(f"wrote {OUT_WEB.relative_to(ROOT)}")


def git_commit():
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return None


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--fetch", action="store_true")
    p.add_argument("--assemble", action="store_true")
    p.add_argument("--workers", type=int, default=2)
    a = p.parse_args(argv)
    if a.fetch:
        fetch(a.workers)
    if a.assemble:
        assemble()
    if not (a.fetch or a.assemble):
        p.print_help()


if __name__ == "__main__":
    main()
