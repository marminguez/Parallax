"""Soil texture v1 (config/search/soil_texture_v1.yaml).

Describes the topsoil (0-5 cm) of every index window with SoilGrids 2.0 aggregated
1000 m maps: sand, silt, clay and coarse fragments. Earth-side only: no planet value,
no verdict, never changes the order of a search.

Every invocation first verifies the four files against ISRIC's SHA-256 and runs
check S1 (sampler) on the 21 VAL-004 twin windows, then prints their values.

    # 0. Files (downloaded with the commands in docs/EARTH_DIMENSIONS_RUN.md)
    #    data/soilgrids/{sand,silt,clay,cfvo}_0-5cm_mean_1000.tif (+ .sha256)

    # 1. Checksums, S1 and the twins' values only
    python scripts/soil_texture.py --twins-only

    # 2. Full run (resumable; Ctrl-C is safe)
    python scripts/soil_texture.py

    # 3. Outputs: S2, P1-P3
    python scripts/soil_texture.py --assemble

Outputs:
  results/soil_texture/partial.csv          one row per window as it is measured (resume point, gitignored)
  results/soil_texture/checks_v1.json       checksums, S1, twins' values, timing
  results/soil_texture/soil_texture_v1.csv  one row per window (with --assemble)
  results/soil_texture/soil_texture_v1.json S2, P1-P3, checksums, provenance (with --assemble)
  web/data/soil-texture.csv                 what the search reads (with --assemble)
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from parallax import characterize as ch  # noqa: E402

CONFIG = ROOT / "config/search/soil_texture_v1.yaml"
INDEX = ROOT / "web/data/earth-index.csv"
REACHABLE = ROOT / "results/campaign/reachable_twins_v1.json"
OUT = ROOT / "results/soil_texture"
PARTIAL = OUT / "partial.csv"
OUT_WEB = ROOT / "web/data/soil-texture.csv"
LAYERS = ["sand", "silt", "clay", "cfvo"]
FILE = "{}_0-5cm_mean_1000.tif"
N = 50                      # 50 x 50 points per window
MIN_VALID = 0.25            # measured when valid_share >= 0.25
ROUNDTRIP_M = 1.0           # S1 tolerance
EARTH_R = 6_371_008.8


# --------------------------------------------------------------------------- frozen rules


def window_points(lat: float, lon: float, n: int = N) -> tuple[np.ndarray, np.ndarray]:
    """Centres of the window box divided into n x n equal cells (lon, lat), row-major."""
    west, south, east, north = ch.window_bounds_deg(lat, lon)
    lons = west + (np.arange(n) + 0.5) * (east - west) / n
    lats = south + (np.arange(n) + 0.5) * (north - south) / n
    gx, gy = np.meshgrid(lons, lats)
    return gx.ravel(), gy.ravel()


def usda_class(sand: float, silt: float, clay: float) -> str:
    """USDA texture class (NRCS soil texture calculator rules) of fractions rescaled to sum 1."""
    total = sand + silt + clay
    s, si, c = (100 * sand / total, 100 * silt / total, 100 * clay / total)
    if si + 1.5 * c < 15:
        return "sand"
    if si + 2 * c < 30:
        return "loamy_sand"
    if c >= 40:
        if si >= 40:
            return "silty_clay"
        if s <= 45:
            return "clay"
    if c >= 35 and s > 45:
        return "sandy_clay"
    if 27 <= c < 40:
        if s <= 20:
            return "silty_clay_loam"
        if s <= 45:
            return "clay_loam"
    if 20 <= c < 35 and si < 28 and s > 45:
        return "sandy_clay_loam"
    if 7 <= c < 27 and 28 <= si < 50 and s <= 52:
        return "loam"
    if si >= 80 and c < 12:
        return "silt"
    if si >= 50 and (12 <= c < 27 or c < 12):
        return "silt_loam"
    return "sandy_loam"


def summarize(values: dict[str, np.ndarray]) -> dict:
    """Window values from the point values of the four layers (NaN = no data)."""
    stack = np.vstack([values[k] for k in LAYERS])
    valid = np.all(np.isfinite(stack), axis=0)
    share = float(valid.sum()) / valid.size
    out = {"valid_share": round(share, 4)}
    if share < MIN_VALID:
        return {"status": "not_measured", **out}
    m = {k: float(values[k][valid].mean()) for k in LAYERS}
    out.update({"status": "measured",
                "sand": round(m["sand"] / 1000, 4), "silt": round(m["silt"] / 1000, 4), "clay": round(m["clay"] / 1000, 4),
                "coarse": round(m["cfvo"] / 1000, 4), "sum_gkg": round(m["sand"] + m["silt"] + m["clay"], 1),
                "texture_class": usda_class(m["sand"], m["silt"], m["clay"])})
    return out


# --------------------------------------------------------------------------- reading the maps


class Maps:
    """The four SoilGrids files, opened once; points are read by the 1000 m cell that contains them."""

    def __init__(self, folder: Path):
        import rasterio
        from pyproj import Transformer

        self.src = {k: rasterio.open(folder / FILE.format(k)) for k in LAYERS}
        first = self.src["sand"]
        for k, s in self.src.items():
            if s.crs != first.crs or s.transform != first.transform or s.shape != first.shape:
                raise SystemExit(f"{k}: grid differs from sand; the four layers must share one grid")
        self.crs, self.transform, self.shape = first.crs, first.transform, first.shape
        self.fwd = Transformer.from_crs("EPSG:4326", self.crs, always_xy=True)

    def project(self, lon: np.ndarray, lat: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        return self.fwd.transform(lon, lat)

    def cells(self, x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        inv = ~self.transform
        x, y = np.asarray(x), np.asarray(y)
        col, row = inv.a * x + inv.b * y + inv.c, inv.d * x + inv.e * y + inv.f
        return np.floor(row).astype(int), np.floor(col).astype(int)

    def read(self, rows: np.ndarray, cols: np.ndarray) -> dict[str, np.ndarray]:
        """Point values per layer (NaN for nodata or outside the map). Reads one block per 512-column group,
        so a window cut by an interruption of the projection never reads the gap."""
        from rasterio.windows import Window

        h, w = self.shape
        inside = (rows >= 0) & (rows < h) & (cols >= 0) & (cols < w)
        out = {k: np.full(rows.shape, np.nan) for k in LAYERS}
        idx = np.flatnonzero(inside)
        groups: dict[int, list[int]] = {}
        for i in idx:
            groups.setdefault(int(cols[i]) // 512, []).append(i)
        for members in groups.values():
            m = np.array(members)
            r0, r1, c0, c1 = rows[m].min(), rows[m].max(), cols[m].min(), cols[m].max()
            win = Window(c0, r0, c1 - c0 + 1, r1 - r0 + 1)
            for k, s in self.src.items():
                block = s.read(1, window=win, masked=True)
                v = block[rows[m] - r0, cols[m] - c0]
                out[k][m] = np.where(np.ma.getmaskarray(v), np.nan, np.ma.getdata(v).astype("float64"))
        return out

    def window(self, lat: float, lon: float) -> dict:
        lons, lats = window_points(lat, lon)
        x, y = self.project(lons, lats)
        ok = np.isfinite(x) & np.isfinite(y)
        r, c = self.cells(np.where(ok, x, 0), np.where(ok, y, 0))
        r, c = np.where(ok, r, -1), np.where(ok, c, -1)
        return summarize(self.read(r, c))


# --------------------------------------------------------------------------- checks


def verify_files(folder: Path) -> dict:
    """SHA-256 of each file against the line ISRIC publishes (saved next to it as <file>.sha256)."""
    out = {}
    for k in LAYERS:
        f = folder / FILE.format(k)
        ref = folder / (f.name + ".sha256")
        if not f.exists() or not ref.exists():
            raise SystemExit(f"Missing {f} or {ref}: download them first (docs/EARTH_DIMENSIONS_RUN.md)")
        expected = ref.read_text().split()[0].lower()
        h = hashlib.sha256()
        with f.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 22), b""):
                h.update(chunk)
        got = h.hexdigest()
        if got != expected:
            raise SystemExit(f"{f.name}: SHA-256 {got} does not match ISRIC's {expected}; the run stops")
        out[k] = {"file": f.name, "sha256": got}
    return out


def haversine_m(lon1, lat1, lon2, lat2) -> np.ndarray:
    p1, p2 = np.radians(lat1), np.radians(lat2)
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(np.radians(lon2 - lon1) / 2) ** 2
    return 2 * EARTH_R * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def check_s1(maps: Maps, windows: list[dict]) -> dict:
    """Every sampled point projects and comes back within 1 m, inside the window box."""
    from pyproj import Transformer

    inv = Transformer.from_crs(maps.crs, "EPSG:4326", always_xy=True)
    rows = []
    for w in windows:
        lons, lats = window_points(w["lat"], w["lon"])
        x, y = maps.project(lons, lats)
        lon2, lat2 = inv.transform(x, y)
        err = haversine_m(lons, lats, np.asarray(lon2), np.asarray(lat2))
        west, south, east, north = ch.window_bounds_deg(w["lat"], w["lon"])
        inside = bool(np.all((lons > west) & (lons < east) & (lats > south) & (lats < north)))
        worst = float(np.nanmax(err)) if np.isfinite(err).any() else math.inf
        ok = bool(np.all(np.isfinite(err)) and worst <= ROUNDTRIP_M and inside)
        rows.append({"id": w["id"], "dest": w.get("dest"), "ok": ok, "max_roundtrip_m": round(worst, 6), "inside": inside})
    return {"pass": all(r["ok"] for r in rows), "windows": len(rows), "rows": rows}


# --------------------------------------------------------------------------- windows


def load_index() -> list[dict]:
    with INDEX.open(newline="") as f:
        return [{"id": r["id"], "lat": float(r["lat"]), "lon": float(r["lon"]),
                 "bare": float(r["bare_share"]) if r["bare_share"] else None} for r in csv.DictReader(f)]


def twin_windows(by_id: dict) -> list[dict]:
    out = []
    for d in json.loads(REACHABLE.read_text())["destinations"]:
        w = by_id[d["val004_twin"]["id"]]
        out.append({**w, "dest": d["id"]})
    return out


def read_partial() -> dict[str, dict]:
    out: dict[str, dict] = {}
    if PARTIAL.exists():
        with PARTIAL.open(newline="") as f:
            for r in csv.DictReader(f):
                out[r["id"]] = json.loads(r["value"])
    return out


def run(maps: Maps, windows: list[dict]) -> None:
    done = read_partial()
    todo = [w for w in windows if w["id"] not in done or done[w["id"]].get("status") == "error"]
    print(f"{len(windows) - len(todo)} already measured, {len(todo)} to go", flush=True)
    new = not PARTIAL.exists()
    t0 = time.perf_counter()
    with PARTIAL.open("a", newline="") as f:
        wr = csv.writer(f)
        if new:
            wr.writerow(["id", "value"])
        for i, w in enumerate(todo, 1):
            try:
                v = maps.window(w["lat"], w["lon"])
            except Exception as e:  # recorded, retried on the next run
                v = {"status": "error", "error": f"{type(e).__name__}: {e}"[:300]}
            wr.writerow([w["id"], json.dumps(v)])
            if i % 500 == 0 or i == len(todo):
                f.flush()
                rate = i / (time.perf_counter() - t0)
                print(f"  {i}/{len(todo)} ({rate:.0f} windows/s, ~{(len(todo) - i) / rate / 60:.1f} min left)", flush=True)


# --------------------------------------------------------------------------- outputs


def predictions(rows: list[dict]) -> dict:
    bare = [r for r in rows if r["bare"] is not None and r["bare"] >= 0.5]
    veg = [r for r in rows if r["bare"] is not None and r["bare"] < 0.2]
    med = lambda rs: float(np.median([r["valid_share"] for r in rs])) if rs else None  # noqa: E731
    measured = [r for r in rows if r["status"] == "measured"]
    sand = lambda rs: float(np.mean([r["sand"] for r in rs])) if rs else None  # noqa: E731
    bare_ids, veg_ids = {r["id"] for r in bare}, {r["id"] for r in veg}
    mb = [r for r in measured if r["id"] in bare_ids]
    mv = [r for r in measured if r["id"] in veg_ids]
    p1 = {"median_valid_share_bare_ge_0_5": med(bare), "median_valid_share_bare_lt_0_2": med(veg),
          "windows": [len(bare), len(veg)]}
    p1["holds"] = p1["median_valid_share_bare_ge_0_5"] is not None and p1["median_valid_share_bare_lt_0_2"] is not None \
        and p1["median_valid_share_bare_ge_0_5"] < p1["median_valid_share_bare_lt_0_2"]
    share = len(measured) / len(rows)
    p3 = {"mean_sand_bare_ge_0_5": sand(mb), "mean_sand_bare_lt_0_2": sand(mv), "windows": [len(mb), len(mv)]}
    p3["holds"] = None not in (p3["mean_sand_bare_ge_0_5"], p3["mean_sand_bare_lt_0_2"]) \
        and p3["mean_sand_bare_ge_0_5"] > p3["mean_sand_bare_lt_0_2"]
    return {"P1_bare_windows_have_less_soil_data": p1,
            "P2_most_windows_measured": {"measured_share": round(share, 4), "measured": len(measured), "windows": len(rows), "holds": share >= 0.8},
            "P3_bare_windows_are_sandier": p3}


def assemble(windows: list[dict]) -> None:
    done = read_partial()
    missing = [w["id"] for w in windows if w["id"] not in done or done[w["id"]].get("status") == "error"]
    if missing:
        raise SystemExit(f"{len(missing)} windows not measured yet (first: {missing[:5]}); run without --assemble first")
    checks = json.loads((OUT / "checks_v1.json").read_text())
    rows = [{"id": w["id"], "bare": w["bare"], "texture_class": None, **done[w["id"]]} for w in windows]
    measured = [r for r in rows if r["status"] == "measured"]
    ok = [r for r in measured if 900 <= r["sum_gkg"] <= 1100]
    s2 = {"what": "sand + silt + clay between 900 and 1100 g/kg in >= 99 % of measured windows",
          "within": len(ok), "measured": len(measured), "share": round(len(ok) / max(1, len(measured)), 4)}
    s2["pass"] = s2["share"] >= 0.99
    OUT.mkdir(parents=True, exist_ok=True)
    cols = ["id", "status", "valid_share", "sand", "silt", "clay", "coarse", "sum_gkg", "texture_class"]
    with (OUT / "soil_texture_v1.csv").open("w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        wr.writeheader()
        wr.writerows(rows)
    run_out = {"config": str(CONFIG.relative_to(ROOT)), "commit": git_commit(),
               "assembled_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
               "files": checks.get("files"), "S1": {"pass": checks["S1"]["pass"]}, "S2": s2,
               "predictions": predictions(rows),
               "classes": {c: sum(1 for r in measured if r["texture_class"] == c) for c in sorted({r["texture_class"] for r in measured})}}
    (OUT / "soil_texture_v1.json").write_text(json.dumps(run_out, indent=1, ensure_ascii=False))
    print(json.dumps({"S2": s2, "predictions": run_out["predictions"], "classes": run_out["classes"]}, indent=1))
    if not s2["pass"]:
        print("S2 fails: web/data/soil-texture.csv is not written (soil_texture_v1.yaml, checks.S2).")
        return
    web_cols = ["id", "valid_share", "sand", "silt", "clay", "coarse", "texture_class"]
    with OUT_WEB.open("w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=web_cols, extrasaction="ignore")
        wr.writeheader()
        wr.writerows(rows)
    print(f"wrote {OUT_WEB.relative_to(ROOT)} ({len(rows)} windows, {len(measured)} measured)")


def git_commit() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return None


# --------------------------------------------------------------------------- main


def parse(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--soilgrids", type=Path, default=ROOT / "data/soilgrids", help="folder with the four 0-5 cm files and their .sha256")
    p.add_argument("--twins-only", action="store_true", help="checksums, S1 and the twins' values only")
    p.add_argument("--assemble", action="store_true", help="S2, P1-P3 and the outputs")
    return p.parse_args(argv)


def main(argv=None) -> None:
    args = parse(argv)
    windows = load_index()
    if args.assemble:
        assemble(windows); return
    OUT.mkdir(parents=True, exist_ok=True)
    files = verify_files(args.soilgrids)
    print("checksums: OK (" + ", ".join(files) + ")", flush=True)
    maps = Maps(args.soilgrids)
    print(f"CRS: {maps.crs.to_wkt()[:120]}...", flush=True)
    twins = twin_windows({w["id"]: w for w in windows})
    s1 = check_s1(maps, twins)
    t0 = time.perf_counter()
    values = [{"dest": w["dest"], "id": w["id"], **maps.window(w["lat"], w["lon"])} for w in twins]
    secs = (time.perf_counter() - t0) / len(twins)
    checks = {"run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "commit": git_commit(),
              "files": files, "crs": maps.crs.to_wkt(), "S1": s1, "twins": values,
              "seconds_per_window": round(secs, 4), "projected_minutes": round(secs * len(windows) / 60, 1)}
    (OUT / "checks_v1.json").write_text(json.dumps(checks, indent=1, ensure_ascii=False))
    print(f"S1: {'PASS' if s1['pass'] else 'FAIL'} ({s1['windows']} twins, worst round trip "
          f"{max(r['max_roundtrip_m'] for r in s1['rows']):.2e} m)")
    for v in values:
        txt = (f"{v['texture_class']:>16}  sand {v['sand']:.2f} silt {v['silt']:.2f} clay {v['clay']:.2f} coarse {v['coarse']:.2f}"
               if v["status"] == "measured" else "     no soil data")
        print(f"  {v['dest']:<22} {v['id']}  valid {v['valid_share']:.2f}  {txt}")
    print(f"~{checks['projected_minutes']} min for {len(windows)} windows")
    if not s1["pass"]:
        print("S1 fails: no window is measured (soil_texture_v1.yaml, checks.S1).")
        return
    if not args.twins_only:
        run(maps, windows)


if __name__ == "__main__":
    main()
