"""VAL-004 — the reverse map: Moon and Mars, seen from Earth.

One command for an unattended overnight run, following the frozen
pre-registration config/validation/val004_reverse_map_v1.yaml:

  earth   every 50 km Earth window (50 km spacing, 56 S - 60 N) with the
          unchanged evaluate_candidate.py method (local SRTMGL30 + MOD44W)
  moon    the lunar south polar cap from LOLA 20 m, block mean to 1 km in the
          native plane, 50 km windows every 25 km, plus the Shackleton bridge test
  mars    all of Mars from MOLA 463 m, Earth method (local AEQD, 1 km,
          bilinear), 50 km spacing, plus the Jezero bridge test
  twins   closest Earth window for every Moon/Mars window, closest Moon and
          Mars window for every Earth window, classes, overlays, predictions,
          results/validation/val004_reverse_map.* and the web export
  images  class maps and shaded-relief thumbnails for the public page

Every stage writes as it goes and resumes where it stopped. Run from the
repository root, in the environment used for live evaluation:

    python scripts/run_val004.py --plan            # counts and data checks, nothing computed
    python scripts/run_val004.py --check           # 1 Earth window + both bridge tests; must end CHECK OK
    python scripts/run_val004.py --workers 8       # everything (leave it overnight)
    python scripts/run_val004.py --stage twins     # one stage only
    python scripts/run_val004.py --stage moon-bridge   # Moon bridge test as amended in v1.1 (uses the cached grid)
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

from parallax import reverse as rv  # noqa: E402

CONFIG = ROOT / "config/validation/val004_reverse_map_v1.yaml"
OVERLAYS = ROOT / "config/validation/val004_overlays_v1.yaml"
AMENDMENT = ROOT / "config/validation/val004_amendment_v1_1.yaml"
OUT = ROOT / "results/val004"
CACHE = OUT / "cache"
VALIDATION = ROOT / "results/validation/val004_reverse_map"
WEB = ROOT / "web/public/reverse"
JEZERO = ROOT / "results/exp001/jezero_target_50km_v0_4.json"
SHACKLETON = ROOT / "results/exp002/shackleton_target_50km_v0_1.json"

MOON_DEM_LOCAL = ROOT / "data/moon/LDEM_80S_20MPP_ADJ.TIF"
MOON_DEM_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF"
MARS_DEM_LOCAL = ROOT / "data/mars/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif"
MARS_DEM_URL = "https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif"

EARTH_CSV = OUT / "earth_windows.csv"
EARTH_ERRORS = OUT / "earth_errors.csv"
MOON_CSV = OUT / "moon_windows.csv"
MARS_CSV = OUT / "mars_windows.csv"
MARS_ERRORS = OUT / "mars_errors.csv"
BRIDGES = OUT / "bridges.json"
MOON_GRID = CACHE / "moon_grid_1km.npy"
MOON_GRID_META = CACHE / "moon_grid_1km.json"
TWINS_JSON = OUT / "twins.json"

STRIDE_M = 50_000.0
BRIDGE_RADIUS_KM = 12.5
HIST_COLUMNS = list(rv.BIN_LABELS)
LOG = OUT / "run.log"


def log(message: str) -> None:
    line = f"{datetime.now().strftime('%H:%M:%S')}  {message}"
    print(line, flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_config() -> dict:
    return yaml.safe_load(CONFIG.read_text(encoding="utf-8"))


def load_overlays() -> dict:
    return yaml.safe_load(OVERLAYS.read_text(encoding="utf-8"))


def frozen_histogram(path: Path) -> np.ndarray:
    d = json.loads(path.read_text(encoding="utf-8"))["terrain"]["1000m"]["slope"]["distribution_pct"]
    h = np.array([d[k] for k in rv.BIN_LABELS], dtype=float)
    return h / h.sum()


def dem_source(local: Path, url: str, override: str | None) -> str:
    if override:
        return override
    return str(local) if local.exists() else url


def read_ids(*paths: Path) -> set[str]:
    ids = set()
    for p in paths:
        if p.exists():
            with p.open(newline="", encoding="utf-8") as f:
                ids.update(row["id"] for row in csv.DictReader(f))
    return ids


class Appender:
    """CSV writer that appends and flushes every row, so a crash loses nothing."""

    def __init__(self, path: Path, columns: list[str]):
        path.parent.mkdir(parents=True, exist_ok=True)
        new = not path.exists() or path.stat().st_size == 0
        self.f = path.open("a", newline="", encoding="utf-8")
        self.w = csv.DictWriter(self.f, fieldnames=columns)
        if new:
            self.w.writeheader()

    def write(self, row: dict) -> None:
        self.w.writerow(row)
        self.f.flush()

    def close(self) -> None:
        self.f.close()


def hist_fields(h) -> dict:
    return {k: repr(float(v)) for k, v in zip(rv.BIN_LABELS, h)}


def read_windows(path: Path) -> tuple[list[dict], np.ndarray]:
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    hist = np.array([[float(r[k]) for k in rv.BIN_LABELS] for r in rows], dtype=float).reshape(-1, len(rv.BIN_LABELS))
    return rows, hist


# =========================================================================== Earth


def earth_centres() -> list[tuple[str, float, float]]:
    from parallax.data.srtmgl30 import candidate_latitudes, candidate_longitudes

    out = []
    for lat in candidate_latitudes(window_m=50_000.0, stride_m=STRIDE_M):
        for lon in candidate_longitudes(float(lat), stride_m=STRIDE_M):
            out.append((f"EARTH-{len(out) + 1:06d}", float(lat), float(lon)))
    return out


def earth_has_land_tile(lat: float, lon: float) -> bool:
    from parallax.data.mod44w import latlon_to_tile, local_water_mask_path

    try:
        h, v = latlon_to_tile(lat, lon)
        local_water_mask_path(h, v)
        return True
    except FileNotFoundError:
        return False


def earth_crosses_antimeridian(lat: float, lon: float) -> bool:
    from parallax.data.srtmgl30 import physical_window_bounds

    west, _, east, _ = physical_window_bounds(lat, lon, window_m=50_000.0)
    return west < -180.0 or east > 180.0


def earth_one(job: tuple[str, float, float]) -> dict:
    """Runs in a worker process. Same evaluator as the blind pilot and VAL-001..003."""
    from evaluate_candidate import evaluate_candidate

    cid, lat, lon = job
    try:
        r = evaluate_candidate(lat, lon)
    except Exception as exc:  # recorded, never retried silently with another method
        return {"id": cid, "lat": lat, "lon": lon, "error": str(exc)[:300]}
    d = r["slope"]["distribution"]
    return {
        "id": cid,
        "lat": repr(lat),
        "lon": repr(lon),
        "land_fraction": repr(r["land_eligibility"]["land_fraction"]),
        "land_status": r["land_eligibility"]["status"],
        **{k: repr(float(d[k])) for k in rv.BIN_LABELS},
    }


def stage_earth(workers: int) -> None:
    centres = earth_centres()
    done = read_ids(EARTH_CSV, EARTH_ERRORS)
    todo, skipped = [], {"no_land_tile": 0, "antimeridian": 0}
    for cid, lat, lon in centres:
        if cid in done:
            continue
        if earth_crosses_antimeridian(lat, lon):
            skipped["antimeridian"] += 1
        elif not earth_has_land_tile(lat, lon):
            skipped["no_land_tile"] += 1
        else:
            todo.append((cid, lat, lon))
    log(f"EARTH  {len(centres)} centres · {len(done)} already done · skipped {skipped} · {len(todo)} to evaluate with {workers} workers")
    (OUT / "earth_plan.json").write_text(json.dumps({"centres": len(centres), "skipped": skipped, "stride_m": STRIDE_M}, indent=2) + "\n", encoding="utf-8")
    if not todo:
        return
    ok = Appender(EARTH_CSV, ["id", "lat", "lon", "land_fraction", "land_status", *HIST_COLUMNS])
    bad = Appender(EARTH_ERRORS, ["id", "lat", "lon", "error"])
    start = time.perf_counter()
    try:
        with ProcessPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(earth_one, job) for job in todo]
            for n, fut in enumerate(as_completed(futures), 1):
                row = fut.result()
                (bad if "error" in row else ok).write(row)
                if n % 500 == 0 or n == len(todo):
                    rate = (time.perf_counter() - start) / n
                    log(f"  earth {n}/{len(todo)} · ~{rate * (len(todo) - n) / 60:.0f} min left")
    finally:
        ok.close()
        bad.close()


# =========================================================================== Moon


def moon_grid(dem: str):
    from parallax.reverse.readers import PlaneGrid, plane_grid_1km

    CACHE.mkdir(parents=True, exist_ok=True)
    if MOON_GRID.exists() and MOON_GRID_META.exists():
        meta = json.loads(MOON_GRID_META.read_text(encoding="utf-8"))
        grid = PlaneGrid(np.load(MOON_GRID), meta["left"], meta["top"], meta["crs_wkt"], meta["native_resolution_m"])
        log(f"MOON   using cached 1 km grid {grid.elevation.shape}")
    else:
        log(f"MOON   building 1 km grid from {dem} (reads the whole DEM once)")
        grid = plane_grid_1km(dem, progress=lambda r, n: log(f"  moon grid row {r}/{n}") if r % 100 == 0 or r == n else None)
        np.save(MOON_GRID, grid.elevation)
        MOON_GRID_META.write_text(json.dumps({"left": grid.left, "top": grid.top, "crs_wkt": grid.crs_wkt, "native_resolution_m": grid.native_resolution_m, "dem": dem, "shape": list(grid.elevation.shape), "built_at": now()}, indent=2) + "\n", encoding="utf-8")
    return grid


def stage_moon(dem: str) -> None:
    grid = moon_grid(dem)
    rows = []
    for r0, c0, h in rv.sliding_windows(grid.elevation):
        x, y = grid.centre_xy(r0, c0)
        rows.append((r0, c0, x, y, h))
    xs = np.array([r[2] for r in rows])
    ys = np.array([r[3] for r in rows])
    lon, lat = grid.to_lonlat(xs, ys)
    with MOON_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["id", "lat", "lon", "x", "y", "r0", "c0", *HIST_COLUMNS])
        w.writeheader()
        for (r0, c0, x, y, h), la, lo in zip(rows, lat, lon):
            w.writerow({"id": f"MOON-{r0:03d}-{c0:03d}", "lat": repr(float(la)), "lon": repr(float(lo)), "x": repr(x), "y": repr(y), "r0": r0, "c0": c0, **hist_fields(h)})
    log(f"MOON   {len(rows)} complete windows written")
    moon_bridge(grid, rows, lat, lon)
    moon_bridge_v1_1(grid)


def moon_bridge(grid, rows, lat, lon) -> dict:
    config = load_config()
    target = frozen_histogram(SHACKLETON)
    c = json.loads(SHACKLETON.read_text(encoding="utf-8"))["target"]
    near = []
    for (r0, c0, _, _, h), la, lo in zip(rows, lat, lon):
        km = rv.great_circle_km(float(la), float(lo), c["center_lat_deg"], c["center_lon_deg"], rv.MOON_RADIUS_M)
        if km <= BRIDGE_RADIUS_KM:
            near.append({"id": f"MOON-{r0:03d}-{c0:03d}", "centre_offset_km": km, "distance_to_frozen": float(rv.jsd_matrix(h, target)[0, 0])})
    best = min((n["distance_to_frozen"] for n in near), default=None)
    tol = config["bridge_tests"]["tolerance"]
    result = {"windows_within_km": BRIDGE_RADIUS_KM, "windows": near, "best": best, "tolerance": tol, "passed": best is not None and best < tol}
    save_bridge("moon", result)
    log(f"MOON   bridge test: best {best} vs tolerance {tol} → {'PASS' if result['passed'] else 'FAIL'}")
    return result


def moon_bridge_v1_1(grid) -> dict:
    """Moon bridge test as amended in v1.1: the 1 km-placed window closest to Shackleton's centre.

    The v1.0 outcome stays in bridges.json under moon.v1_0 and is reported.
    """
    amendment = yaml.safe_load(AMENDMENT.read_text(encoding="utf-8"))
    tol = amendment["bridge_tests"]["tolerance"]
    c = json.loads(SHACKLETON.read_text(encoding="utf-8"))["target"]
    x, y = grid.to_xy(c["center_lon_deg"], c["center_lat_deg"])
    r0, c0 = rv.window_origin_near((x - grid.left) / rv.GRID_M, (grid.top - y) / rv.GRID_M, grid.elevation.shape)
    cx, cy = grid.centre_xy(r0, c0)
    clon, clat = grid.to_lonlat(np.array([cx]), np.array([cy]))
    offset_km = math.hypot(cx - x, cy - y) / 1000
    previous = json.loads(BRIDGES.read_text(encoding="utf-8")).get("moon", {}) if BRIDGES.exists() else {}
    v1_0 = previous.get("v1_0", previous if previous.get("amendment") is None else None)
    result = {"amendment": rel(AMENDMENT), "method": "closest complete 50 km window at 1 km placement on the map grid",
              "window": {"r0": r0, "c0": c0, "centre_lat": float(clat[0]), "centre_lon": float(clon[0]), "centre_offset_km": offset_km},
              "tolerance": tol}
    block = grid.elevation[r0 : r0 + rv.WINDOW_CELLS, c0 : c0 + rv.WINDOW_CELLS]
    if offset_km > 1.0 or not np.isfinite(block).all():
        result.update({"distance_to_frozen": None, "passed": False, "reason": "no complete window within 1 km of the centre"})
    else:
        h = rv.window_histogram(block)
        d = float(rv.jsd_matrix(h, frozen_histogram(SHACKLETON))[0, 0])
        result.update({"lola_grid_histogram": [float(v) for v in h], "distance_to_frozen": d, "best": d, "passed": d < tol})
    if v1_0:
        result["v1_0"] = dict(v1_0)
    save_bridge("moon", result)
    d = result["distance_to_frozen"]
    log(f"MOON   bridge test v1.1 (grid window {offset_km:.2f} km from Shackleton vs frozen target): "
        f"{'none' if d is None else f'{d:.4f}'} vs tolerance {tol} → {'PASS' if result['passed'] else 'FAIL'}")
    return result


def save_bridge(body: str, result: dict) -> None:
    data = json.loads(BRIDGES.read_text(encoding="utf-8")) if BRIDGES.exists() else {}
    data[body] = {**result, "run_at": now()}
    BRIDGES.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


# =========================================================================== Mars

_MARS = None


def _mars_init(dem: str) -> None:
    global _MARS
    from parallax.reverse.readers import MarsDEM

    _MARS = MarsDEM(dem)


def mars_one(job: tuple[str, float, float]) -> dict:
    cid, lat, lon = job
    try:
        h = _MARS.histogram(lat, lon)
    except Exception as exc:
        return {"id": cid, "lat": lat, "lon": lon, "error": str(exc)[:300]}
    return {"id": cid, "lat": repr(lat), "lon": repr(lon), **hist_fields(h)}


def mars_centres() -> list[tuple[str, float, float]]:
    lo, hi = load_config()["grids"]["mars"]["domain_lat_deg"]
    return [(f"MARS-{i + 1:06d}", la, lo_) for i, (la, lo_) in enumerate(rv.sphere_centres(rv.MARS_RADIUS_M, STRIDE_M, lo, hi))]


def mars_bridge(dem: str) -> dict:
    from parallax.reverse.readers import MarsDEM

    config = load_config()
    c = json.loads(JEZERO.read_text(encoding="utf-8"))["target"]
    with MarsDEM(dem) as m:
        h = m.histogram(c["center_lat_deg"], c["center_lon_deg"])
    d = float(rv.jsd_matrix(h, frozen_histogram(JEZERO))[0, 0])
    tol = config["bridge_tests"]["tolerance"]
    result = {"centre": [c["center_lat_deg"], c["center_lon_deg"]], "mola_histogram": [float(v) for v in h], "distance_to_frozen": d, "tolerance": tol, "passed": d < tol}
    save_bridge("mars", result)
    log(f"MARS   bridge test (MOLA Jezero vs CTX Jezero): {d:.4f} vs tolerance {tol} → {'PASS' if result['passed'] else 'FAIL'}")
    return result


def stage_mars(dem: str, workers: int) -> None:
    mars_bridge(dem)
    centres = mars_centres()
    done = read_ids(MARS_CSV, MARS_ERRORS)
    todo = [c for c in centres if c[0] not in done]
    log(f"MARS   {len(centres)} centres · {len(done)} already done · {len(todo)} to build with {workers} workers")
    if not todo:
        return
    ok = Appender(MARS_CSV, ["id", "lat", "lon", *HIST_COLUMNS])
    bad = Appender(MARS_ERRORS, ["id", "lat", "lon", "error"])
    start = time.perf_counter()
    try:
        with ProcessPoolExecutor(max_workers=workers, initializer=_mars_init, initargs=(dem,)) as pool:
            for n, row in enumerate(pool.map(mars_one, todo, chunksize=64), 1):
                (bad if "error" in row else ok).write(row)
                if n % 2000 == 0 or n == len(todo):
                    rate = (time.perf_counter() - start) / n
                    log(f"  mars {n}/{len(todo)} · ~{rate * (len(todo) - n) / 60:.0f} min left")
    finally:
        ok.close()
        bad.close()


# =========================================================================== Twins


def overlay_report(sites: list[dict], rows: list[dict], radius_m: float, planet_class: list[str], twin_idx, twin_d, earth_rows, max_km: float) -> list[dict]:
    centres = np.array([[float(r["lat"]), float(r["lon"])] for r in rows])
    out = []
    for s in sites:
        if s.get("lat") is None or s.get("lon") is None:
            out.append({"id": s["id"], "name": s["name"], "status": "not_evaluated", "reason": "coordinates not frozen before the run"})
            continue
        i, km = rv.nearest_centre(s["lat"], s["lon"], centres, radius_m)
        if km > max_km:
            out.append({"id": s["id"], "name": s["name"], "status": "outside_grid", "nearest_window_km": km})
            continue
        e = earth_rows[int(twin_idx[i])]
        out.append({"id": s["id"], "name": s["name"], "status": "evaluated", "window": rows[i]["id"], "window_centre_km": round(km, 2), "class": planet_class[i], "distance": float(twin_d[i]), "earth_twin": {"id": e["id"], "lat": float(e["lat"]), "lon": float(e["lon"])}})
    return out


def stage_twins() -> dict:
    config = load_config()
    overlays = load_overlays()
    thresholds = rv.frozen_thresholds(config, ROOT)
    bridges = json.loads(BRIDGES.read_text(encoding="utf-8")) if BRIDGES.exists() else {}

    earth_all, earth_hist_all = read_windows(EARTH_CSV)
    land = np.array([float(r["land_fraction"]) for r in earth_all])
    eligible = np.flatnonzero(land >= 0.90)
    display = np.flatnonzero(land >= 0.50)
    earth_rows = [earth_all[i] for i in eligible]
    earth_hist = earth_hist_all[eligible]
    log(f"TWINS  Earth windows: {len(earth_all)} evaluated · {len(eligible)} eligible (≥ 90 % land) · {len(display)} shown on the public page (≥ 50 %)")

    result = {"id": "VAL-004", "preregistration": rel(CONFIG), "amendments": [rel(AMENDMENT)], "run_at": now(), "thresholds": thresholds.__dict__, "bridges": bridges, "earth": {"evaluated": len(earth_all), "eligible": int(len(eligible)), "display": int(len(display))}, "bodies": {}}
    planets = {}
    for body, path, radius in (("moon", MOON_CSV, rv.MOON_RADIUS_M), ("mars", MARS_CSV, rv.MARS_RADIUS_M)):
        if not path.exists():
            log(f"TWINS  {body}: no windows yet, skipped")
            continue
        rows, hist = read_windows(path)
        idx, d = rv.nearest(hist, earth_hist)
        classes = [thresholds.classify(x) for x in d]
        planets[body] = {"rows": rows, "hist": hist, "radius": radius, "idx": idx, "d": d, "classes": classes}
        passed = bridges.get(body, {}).get("passed")
        result["bodies"][body] = {
            "windows": len(rows),
            "shares": rv.class_shares(classes),
            "distance_median": float(np.median(d)),
            "bridge_passed": passed,
            "status": "result" if passed else "exploratory (bridge test failed or not run)",
        }
        with (OUT / f"{body}_twins.csv").open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["id", "lat", "lon", "class", "distance", "earth_id", "earth_lat", "earth_lon"])
            for r, i, x, c in zip(rows, idx, d, classes):
                e = earth_rows[int(i)]
                w.writerow([r["id"], r["lat"], r["lon"], c, repr(float(x)), e["id"], e["lat"], e["lon"]])
        log(f"TWINS  {body}: {len(rows)} windows · " + " · ".join(f"{k} {v:.1%}" for k, v in result["bodies"][body]["shares"].items()))

    # Earth → Moon and Earth → Mars (display windows, so coastal cities still get an answer)
    earth_display = [earth_all[i] for i in display]
    earth_display_hist = earth_hist_all[display]
    earth_out = {"rows": earth_display}
    for body, p in planets.items():
        i, d = rv.nearest(earth_display_hist, p["hist"])
        earth_out[body] = (i, d, [thresholds.classify(x) for x in d])
    with (OUT / "earth_twins.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        head = ["id", "lat", "lon", "land_fraction", "eligible"]
        for body in planets:
            head += [f"{body}_id", f"{body}_distance", f"{body}_class"]
        w.writerow(head)
        for k, r in enumerate(earth_display):
            line = [r["id"], r["lat"], r["lon"], r["land_fraction"], float(r["land_fraction"]) >= 0.90]
            for body, p in planets.items():
                i, d, c = earth_out[body]
                line += [p["rows"][int(i[k])]["id"], repr(float(d[k])), c[k]]
            w.writerow(line)

    # Overlays
    ov = {}
    if "moon" in planets:
        p = planets["moon"]
        ov["artemis_iii"] = overlay_report(overlays["artemis_iii_regions"]["regions"], p["rows"], p["radius"], p["classes"], p["idx"], p["d"], earth_rows, 25.0)
        ov["moon_reference"] = overlay_report(overlays["moon_reference"], p["rows"], p["radius"], p["classes"], p["idx"], p["d"], earth_rows, 25.0)
    if "mars" in planets:
        p = planets["mars"]
        sites = overlays["mars_landing_sites"]["sites"] + overlays["mars_landing_sites"]["also"]
        ov["mars_sites"] = overlay_report(sites, p["rows"], p["radius"], p["classes"], p["idx"], p["d"], earth_rows, 40.0)
    result["overlays"] = ov

    # Predictions
    pred = {}
    if {"moon", "mars"} <= planets.keys():
        m, r = result["bodies"]["moon"]["shares"]["no_twin"], result["bodies"]["mars"]["shares"]["no_twin"]
        pred["P1"] = {"moon_no_twin": m, "mars_no_twin": r, "supported": m > r}
    if "mars" in planets:
        p = planets["mars"]
        no = [k for k, c in enumerate(p["classes"]) if c == "no_twin"]
        partial_or_better = 1 - result["bodies"]["mars"]["shares"]["no_twin"]
        steep = np.array([h[4:].sum() for h in p["hist"]])  # share of slopes >= 5 degrees
        pred["P2"] = {
            "share_with_at_least_partial_twin": partial_or_better,
            "median_steep_share_no_twin": float(np.median(steep[no])) if no else None,
            "median_steep_share_all": float(np.median(steep)),
            "supported": partial_or_better > 0.5 and (not no or float(np.median(steep[no])) > float(np.median(steep))),
        }
    shack = [o for o in ov.get("moon_reference", []) if o["id"] == "shackleton" and o["status"] == "evaluated"]
    if shack:
        pred["P3"] = {"class": shack[0]["class"], "distance": shack[0]["distance"], "supported": shack[0]["class"] in ("partial", "no_twin")}
    result["predictions"] = pred

    # Valencia, computed once and reported as it comes out
    v = overlays["valencia"]
    centres = np.array([[float(r["lat"]), float(r["lon"])] for r in earth_display])
    i, km = rv.nearest_centre(v["lat"], v["lon"], centres)
    val = {"query": v, "earth_window": earth_display[i]["id"], "window_centre_km": round(km, 2), "land_fraction": float(earth_display[i]["land_fraction"])}
    for body, p in planets.items():
        bi, bd, bc = earth_out[body]
        w = p["rows"][int(bi[i])]
        val[body] = {"window": w["id"], "lat": float(w["lat"]), "lon": float(w["lon"]), "distance": float(bd[i]), "class": bc[i]}
    result["valencia"] = val

    VALIDATION.parent.mkdir(parents=True, exist_ok=True)
    VALIDATION.with_suffix(".json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    with VALIDATION.with_suffix(".csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["body", "windows", "bridge_passed", "status", *rv.CLASSES, "distance_median"])
        for body, b in result["bodies"].items():
            w.writerow([body, b["windows"], b["bridge_passed"], b["status"], *[f"{b['shares'][c]:.4f}" for c in rv.CLASSES], f"{b['distance_median']:.4f}"])
    log(f"TWINS  results → {rel(VALIDATION)}.json/.csv · Valencia → " + ", ".join(f"{b} {val[b]['class']} ({val[b]['distance']:.3f})" for b in planets))
    export_web(result, thresholds, planets, earth_display, earth_out, earth_rows)
    return result


# =========================================================================== Web export

TILE_DEG = 10


def tile_key(lat: float, lon: float) -> str:
    return f"{math.floor(lat / TILE_DEG) * TILE_DEG}_{math.floor(lon / TILE_DEG) * TILE_DEG}"


def r4(x: float) -> float:
    return round(float(x), 4)


def export_web(result, thresholds, planets, earth_display, earth_out, earth_rows) -> None:
    from parallax.places import describe

    (WEB / "earth").mkdir(parents=True, exist_ok=True)
    for old in (WEB / "earth").glob("*.json"):
        old.unlink()
    tiles: dict[str, dict] = {}
    for k, r in enumerate(earth_display):
        lat, lon = float(r["lat"]), float(r["lon"])
        t = tiles.setdefault(tile_key(lat, lon), {"lat": [], "lon": [], "land": [], **{f"{b}{f}": [] for b in planets for f in ("I", "D")}})
        t["lat"].append(r4(lat))
        t["lon"].append(r4(lon))
        t["land"].append(round(float(r["land_fraction"]), 3))
        for b, p in planets.items():
            i, d, _ = earth_out[b]
            t[f"{b}I"].append(int(i[k]))
            t[f"{b}D"].append(r4(d[k]))
    for key, t in tiles.items():
        (WEB / "earth" / f"{key}.json").write_text(json.dumps(t, separators=(",", ":")), encoding="utf-8")

    for body, p in planets.items():
        used = sorted(set(int(x) for x in earth_out[body][0]))
        windows = {}
        for i in range(len(p["rows"])):
            r = p["rows"][i]
            e = earth_rows[int(p["idx"][i])]
            entry = {"id": r["id"], "lat": r4(float(r["lat"])), "lon": r4(float(r["lon"])), "c": rv.CLASSES.index(p["classes"][i]), "d": r4(p["d"][i]), "e": [r4(float(e["lat"])), r4(float(e["lon"]))]}
            if i in used:
                place = describe(float(e["lat"]), float(e["lon"]))
                entry["e_place"] = [place["nearest"], place["admin1"], place["countryCode"], place["distanceKm"]]
            windows[i] = entry
        # The full planetary list is only needed for windows someone can land on; the class map is an image.
        (WEB / f"{body}-windows.json").write_text(json.dumps({str(i): windows[i] for i in used}, separators=(",", ":")), encoding="utf-8")

    pairs = sorted(d for _, _, d in rv.validated_pairs([ROOT / s for s in load_config()["thresholds"]["source"]]))
    summary = {
        "id": "VAL-004",
        "run_at": result["run_at"],
        "tileDeg": TILE_DEG,
        "tiles": sorted(tiles),
        "thresholds": thresholds.__dict__,
        "classes": list(rv.CLASSES),
        "validatedPairs": [r4(x) for x in pairs],
        "bodies": result["bodies"],
        "bridges": {b: {"passed": v.get("passed"), "distance": v.get("best", v.get("distance_to_frozen"))} for b, v in result["bridges"].items()},
        "overlays": result["overlays"],
        "valencia": result["valencia"],
        "earth": result["earth"],
    }
    (WEB / "summary.json").write_text(json.dumps(summary, indent=1) + "\n", encoding="utf-8")
    log(f"WEB    {len(tiles)} Earth tiles, " + ", ".join(f"{b}: {len(set(int(x) for x in earth_out[b][0]))} reachable windows" for b in planets) + f" → {rel(WEB)}")


# =========================================================================== Images

CLASS_RGB = {"strong_twin": (99, 214, 163), "twin": (104, 185, 234), "partial": (232, 179, 93), "no_twin": (230, 106, 106)}


def save_png(rgb: np.ndarray, path: Path, quality: int | None = None) -> None:
    from PIL import Image

    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.fromarray(rgb.astype("uint8"))
    if path.suffix == ".jpg":
        img.save(path, quality=quality or 82, optimize=True)
    else:
        img.save(path, optimize=True)


def tint(shade: np.ndarray, rgb: np.ndarray, mask: np.ndarray, alpha: float = 0.55) -> np.ndarray:
    base = np.repeat(shade[..., None], 3, axis=2).astype(float)
    out = base.copy()
    out[mask] = (1 - alpha) * base[mask] + alpha * rgb[mask]
    return out


def stage_images(moon_dem: str, mars_dem: str) -> None:
    from parallax.reverse.readers import MarsDEM

    summary = json.loads((WEB / "summary.json").read_text(encoding="utf-8"))
    maps = {}
    # Moon class map: one colour per 25 km cell, from the window centred on it
    if MOON_GRID.exists() and (OUT / "moon_twins.csv").exists():
        grid = np.load(MOON_GRID)
        shade = rv.hillshade(np.nan_to_num(grid, nan=float(np.nanmean(grid))), rv.GRID_M, altitude_deg=8.0)
        rgb_cls = np.zeros(grid.shape + (3,))
        mask = np.zeros(grid.shape, dtype=bool)
        with (OUT / "moon_twins.csv").open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                _, r0, c0 = row["id"].split("-")
                r0, c0 = int(r0), int(c0)
                sl = (slice(r0 + 12, r0 + 37), slice(c0 + 12, c0 + 37))
                rgb_cls[sl] = CLASS_RGB[row["class"]]
                mask[sl] = True
        save_png(tint(shade, rgb_cls, mask), WEB / "moon-map.png")
        meta = json.loads(MOON_GRID_META.read_text(encoding="utf-8"))
        maps["moon"] = {"projection": "native polar stereographic", "left": meta["left"], "top": meta["top"], "cell_m": rv.GRID_M, "shape": list(grid.shape), "crs_wkt": meta["crs_wkt"]}
        log("IMAGES moon-map.png")
    # Mars class map: equirectangular, 0.25 degree, nearest window centre
    if (OUT / "mars_twins.csv").exists():
        width, height = 1440, 720
        with MarsDEM(mars_dem) as m:
            from rasterio.enums import Resampling

            elev = m.src.read(1, out_shape=(height, width), resampling=Resampling.average, masked=True).astype(float).filled(np.nan) * m.scale + m.offset
        km_px = 2 * math.pi * rv.MARS_RADIUS_M / 1000 / width
        shade = rv.hillshade(np.nan_to_num(elev, nan=float(np.nanmean(elev))), km_px * 1000, altitude_deg=35.0, exaggeration=8.0)
        lat_rows: dict[float, list[tuple[float, str]]] = {}
        with (OUT / "mars_twins.csv").open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                lat_rows.setdefault(round(float(row["lat"]), 6), []).append((float(row["lon"]), row["class"]))
        lats = np.array(sorted(lat_rows))
        rgb_cls = np.zeros((height, width, 3))
        mask = np.zeros((height, width), dtype=bool)
        step = math.degrees(STRIDE_M / rv.MARS_RADIUS_M)
        for y in range(height):
            lat = 90 - (y + 0.5) * 180 / height
            k = int(np.argmin(np.abs(lats - lat)))
            if abs(lats[k] - lat) > step:
                continue
            row = sorted(lat_rows[lats[k]])
            lons = np.array([r[0] for r in row])
            for x in range(width):
                lon = -180 + (x + 0.5) * 360 / width
                j = int(np.argmin(np.abs((lons - lon + 180) % 360 - 180)))
                gap = abs((lons[j] - lon + 180) % 360 - 180) * math.cos(math.radians(lat)) * math.pi / 180 * rv.MARS_RADIUS_M
                if gap <= STRIDE_M:
                    rgb_cls[y, x] = CLASS_RGB[row[j][1]]
                    mask[y, x] = True
        save_png(tint(shade, rgb_cls, mask, alpha=0.5), WEB / "mars-map.png")
        maps["mars"] = {"projection": "equirectangular", "width": width, "height": height}
        log("IMAGES mars-map.png")
    # Thumbnails for every planetary window a visitor can land on
    for body in ("moon", "mars"):
        path = WEB / f"{body}-windows.json"
        if not path.exists():
            continue
        windows = json.loads(path.read_text(encoding="utf-8"))
        folder = WEB / "thumbs" / body
        todo = [w for w in windows.values() if not (folder / f"{w['id']}.jpg").exists()]
        log(f"IMAGES {body}: {len(todo)} thumbnails to render")
        if body == "moon":
            thumbs_moon(todo, folder, moon_dem)
        else:
            with MarsDEM(mars_dem) as m:
                for w in todo:
                    elev = mars_thumb_elevation(m, w["lat"], w["lon"])
                    save_png(np.repeat(rv.hillshade(elev, 200.0, altitude_deg=25.0)[..., None], 3, axis=2), folder / f"{w['id']}.jpg", quality=78)
    summary["maps"] = maps
    (WEB / "summary.json").write_text(json.dumps(summary, indent=1) + "\n", encoding="utf-8")


def mars_thumb_elevation(m, lat: float, lon: float, size: int = 250) -> np.ndarray:
    """Display only: 50 km at 200 m from MOLA, bilinear. Never used in any statistic."""
    import rasterio
    from rasterio.transform import from_origin
    from rasterio.warp import Resampling, reproject

    from parallax.reverse.readers import mars_aeqd_crs

    half = 25_000.0
    dst = np.full((size, size), np.nan)
    reproject(source=rasterio.band(m.src, 1), destination=dst, src_nodata=m.nodata, dst_transform=from_origin(-half, half, 200.0, 200.0), dst_crs=mars_aeqd_crs(lat, lon), dst_nodata=np.nan, resampling=Resampling.bilinear)
    dst = dst * m.scale + m.offset
    return np.nan_to_num(dst, nan=float(np.nanmean(dst)) if np.isfinite(dst).any() else 0.0)


def thumbs_moon(windows: list[dict], folder: Path, dem: str) -> None:
    """Display only: each window at 100 m from the 20 m DEM, low-Sun shading like the south pole."""
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.windows import Window

    from parallax.reverse.readers import GDAL_ENV, _path

    if not windows:
        return
    with rasterio.Env(**GDAL_ENV), rasterio.open(_path(dem)) as src:
        res = abs(src.transform.a)
        per_km = int(round(1000 / res))
        n = 50 * per_km
        for w in windows:
            _, r0, c0 = w["id"].split("-")
            win = Window(int(c0) * per_km, int(r0) * per_km, n, n)
            elev = src.read(1, window=win, out_shape=(500, 500), resampling=Resampling.average, masked=True).astype(float).filled(np.nan)
            elev = np.nan_to_num(elev, nan=float(np.nanmean(elev)))
            save_png(np.repeat(rv.hillshade(elev, 100.0, altitude_deg=6.0)[..., None], 3, axis=2), folder / f"{w['id']}.jpg", quality=80)


# =========================================================================== plan / check


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def plan(moon_dem: str, mars_dem: str) -> None:
    config = load_config()
    thresholds = rv.frozen_thresholds(config, ROOT)
    centres = earth_centres()
    land = sum(1 for _, la, lo in centres if earth_has_land_tile(la, lo))
    mars = mars_centres()
    print("VAL-004 plan (nothing computed)")
    print(f"  thresholds recomputed from VAL-001/002 and match the freeze: q25 {thresholds.q25:.4f} · q50 {thresholds.q50:.4f} · q90 {thresholds.q90:.4f}")
    print(f"  Earth: {len(centres)} centres at 50 km, {land} with a local MOD44W tile → evaluated (~0.4 s each, single process)")
    print(f"  Moon:  DEM {moon_dem}{'  (local)' if Path(moon_dem).exists() else '  (remote: the whole file is streamed once — download it first, see docs/VAL004_RUN.md)'}")
    print(f"  Mars:  {len(mars)} centres at 50 km · DEM {mars_dem}{'  (local)' if Path(mars_dem).exists() else '  (remote: download it first, see docs/VAL004_RUN.md)'}")
    pending = [r["id"] for r in load_overlays()["artemis_iii_regions"]["regions"] if r.get("lat") is None]
    print(f"  Artemis III regions without frozen coordinates: {len(pending)} of 9" + (" → their results will read 'not evaluated'" if pending else ""))
    done = {p.name: sum(1 for _ in p.open()) - 1 for p in (EARTH_CSV, MOON_CSV, MARS_CSV) if p.exists()}
    print(f"  already computed: {done or 'nothing'}")


def check(moon_dem: str, mars_dem: str) -> None:
    rv.frozen_thresholds(load_config(), ROOT)
    print("✓ thresholds match the pre-registration")
    near = [c for c in earth_centres() if abs(c[1] - 39.47) < 1 and abs(c[2] + 0.38) < 1.5 and earth_has_land_tile(c[1], c[2])]
    if not near:
        raise SystemExit("✗ No local MOD44W tile around Valencia: run scripts/download_mod44w.py first.")
    cid, lat, lon = min(near, key=lambda c: rv.great_circle_km(c[1], c[2], 39.47, -0.38, rv.EARTH_RADIUS_M))
    row = earth_one((cid, lat, lon))
    if "error" in row:
        raise SystemExit(f"✗ Earth window failed: {row['error']}")
    print(f"✓ Earth window {cid} ({lat:.2f}, {lon:.2f}) land {float(row['land_fraction']):.2f}")
    b = mars_bridge(mars_dem)
    print(f"✓ Mars DEM readable · Jezero bridge {b['distance_to_frozen']:.4f} ({'PASS' if b['passed'] else 'FAIL — the Mars map would be exploratory'})")
    import rasterio

    from parallax.reverse.readers import GDAL_ENV, _path

    with rasterio.Env(**GDAL_ENV), rasterio.open(_path(moon_dem)) as src:
        print(f"✓ Moon DEM readable · {src.width} x {src.height} px at {abs(src.transform.a)} m · bounds {tuple(round(v) for v in src.bounds)}")
    print("CHECK OK")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--plan", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--stage", choices=["earth", "moon", "moon-bridge", "mars", "twins", "images", "all"], default="all")
    parser.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    parser.add_argument("--moon-dem", default=None)
    parser.add_argument("--mars-dem", default=None)
    args = parser.parse_args()
    moon_dem = dem_source(MOON_DEM_LOCAL, MOON_DEM_URL, args.moon_dem)
    mars_dem = dem_source(MARS_DEM_LOCAL, MARS_DEM_URL, args.mars_dem)
    if args.plan:
        return plan(moon_dem, mars_dem)
    if args.check:
        return check(moon_dem, mars_dem)
    stages = ["earth", "moon", "mars", "twins", "images"] if args.stage == "all" else [args.stage]
    log(f"VAL-004 start · stages {stages}")
    for s in stages:
        if s == "earth":
            stage_earth(args.workers)
        elif s == "moon":
            stage_moon(moon_dem)
        elif s == "moon-bridge":
            moon_bridge_v1_1(moon_grid(moon_dem))
        elif s == "mars":
            stage_mars(mars_dem, args.workers)
        elif s == "twins":
            stage_twins()
        elif s == "images":
            stage_images(moon_dem, mars_dem)
    log("VAL-004 done")


if __name__ == "__main__":
    main()
