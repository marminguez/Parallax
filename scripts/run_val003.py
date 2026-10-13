"""VAL-003 — model v2 (relief + bare ground) on the Analog Atlas site list.

One command for an unattended overnight run. It follows the frozen
pre-registration config/validation/atlas_sites_v1.yaml:

  1. land cover (ESA WorldCover 2021) for the 224 index windows and every
     eligible test site — read straight from ESA's public cloud tiles, only the
     50 km window, nothing downloaded whole (local tiles are used if present);
  2. terrain (slope histogram, land fraction) for every test site;
  3. models v1 and v2, per body, with permutation tests and the paired
     bootstrap comparison; results to results/validation/val003_atlas_sites.*

Every step is cached in results/val003/cache/, so an interrupted run resumes
where it stopped. Run from the repository root:

    python scripts/run_val003.py --plan     # what will be computed, no network
    python scripts/run_val003.py --check    # 1 window + 1 site, tests the connection
    python scripts/run_val003.py            # the full run (leave it overnight)
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

import validate_known_analogs as v  # noqa: E402  (shared metrics, frozen in VAL-001)
from parallax.matching.similarity import jensen_shannon_distance  # noqa: E402

CONFIG = ROOT / "config/validation/atlas_sites_v1.yaml"
EARLIER = [ROOT / "config/validation/known_analogs_v1.yaml", ROOT / "config/validation/apollo_training_v1.yaml"]
CACHE = ROOT / "results/val003/cache"
OUTPUT = ROOT / "results/validation/val003_atlas_sites"
WORLDCOVER = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
LOCAL_TILES = ROOT / "data/earth/worldcover/raw"
BODY_TARGET = {"mars": "jezero", "moon": "shackleton"}
BARE_CLASS = 60
MIN_COVER = 0.99
N_BOOT = 10_000
GDAL_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR", "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
    "GDAL_HTTP_MAX_RETRY": "5", "GDAL_HTTP_RETRY_DELAY": "3", "VSI_CACHE": "TRUE", "GDAL_HTTP_TIMEOUT": "120",
}


def log(message: str) -> None:
    line = f"[{datetime.now().strftime('%H:%M:%S')}] {message}"
    print(line, flush=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    with (CACHE.parent / "run.log").open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


# ---------- pure helpers (unit-tested) ----------

def tiles_for_window(lat: float, lon: float) -> list[str]:
    """3-degree WorldCover tile names touched by the 50 km AEQD window (same rule as download_worldcover.py)."""
    from pyproj import CRS, Transformer
    crs = CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m")
    left, bottom, right, top = Transformer.from_crs(crs, "EPSG:4326", always_xy=True).transform_bounds(-25000, -25000, 25000, 25000, densify_pts=21)
    if left > right:
        raise ValueError("window crosses the antimeridian")
    names = set()
    for y in range(math.floor(bottom / 3) * 3, math.floor(top / 3) * 3 + 1, 3):
        for x in range(math.floor(left / 3) * 3, math.floor(right / 3) * 3 + 1, 3):
            names.add(f'{"N" if y >= 0 else "S"}{abs(y):02d}{"E" if x >= 0 else "W"}{abs(x):03d}')
    return sorted(names)


def bare_fraction(land_cover: dict | None) -> float | None:
    """Share of the window classified bare/sparse; None unless coverage >= MIN_COVER."""
    if not land_cover or land_cover.get("status") not in ("available", "partial"):
        return None
    if not land_cover.get("coverageFraction", 0) >= MIN_COVER:
        return None
    for c in land_cover.get("classes", []):
        if c.get("code") == BARE_CLASS:
            return float(c["fractionOfWindow"]) / float(land_cover["coverageFraction"])
    return 0.0


def model_distance(model: str, slope_distance: float, bare: float | None) -> float | None:
    if model == "v1":
        return slope_distance
    if bare is None:
        return None
    return 0.5 * slope_distance + 0.5 * (1.0 - bare)


def paired_bootstrap(site_v1: np.ndarray, site_v2: np.ndarray, null_v1: np.ndarray, null_v2: np.ndarray, n: int = N_BOOT, seed: int = v.SEED) -> dict:
    """AUC(v2) - AUC(v1) over the same sites; sites resampled with replacement."""
    if site_v1.size == 0:
        return {"n_sites": 0}
    p1 = np.array([1 - v.percentile(d, null_v1) for d in site_v1])
    p2 = np.array([1 - v.percentile(d, null_v2) for d in site_v2])
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, p1.size, size=(n, p1.size))
    diffs = p2[idx].mean(axis=1) - p1[idx].mean(axis=1)
    return {"n_sites": int(p1.size), "auc_v1": float(p1.mean()), "auc_v2": float(p2.mean()), "difference": float(p2.mean() - p1.mean()),
            "ci95": [float(np.percentile(diffs, 2.5)), float(np.percentile(diffs, 97.5))]}


# ---------- cached computation ----------

def cached(kind: str, key: str, compute):
    path = CACHE / kind / f"{key}.json"
    if path.is_file():
        return json.loads(path.read_text(encoding="utf-8"))
    value = compute()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    tmp.write_text(json.dumps(value, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)
    return value


_tile_index: dict[str, bool] | None = None
_tile_lock = threading.Lock()


def tile_exists(name: str) -> bool:
    """ESA publishes no tile over open ocean: a 403/404 means 'no tile', anything else is retried."""
    global _tile_index
    index_path = CACHE / "tile_index.json"
    with _tile_lock:
        if _tile_index is None:
            _tile_index = json.loads(index_path.read_text()) if index_path.is_file() else {}
        if name in _tile_index:
            return _tile_index[name]
    url = f"{WORLDCOVER}ESA_WorldCover_10m_2021_v200_{name}_Map.tif"
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=60):
                exists = True
            break
        except urllib.error.HTTPError as exc:
            if exc.code in (403, 404):
                exists = False
                break
            time.sleep(5 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError):
            time.sleep(5 * (attempt + 1))
    else:
        raise ConnectionError(f"could not reach {url}")
    with _tile_lock:
        _tile_index[name] = exists
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_text(json.dumps(_tile_index, indent=1, sort_keys=True))
    return exists


def land_cover_for(key: str, lat: float, lon: float) -> dict:
    def compute():
        import rasterio
        from land_cover import characterize_files
        try:
            names = tiles_for_window(lat, lon)
        except ValueError as exc:
            return {"status": "error", "message": str(exc), "classes": [], "coverageFraction": 0}
        files = []
        for name in names:
            local = LOCAL_TILES / f"ESA_WorldCover_10m_2021_v200_{name}_Map.tif"
            if local.is_file():
                files.append(local)
            elif tile_exists(name):
                files.append(f"/vsicurl/{WORLDCOVER}ESA_WorldCover_10m_2021_v200_{name}_Map.tif")
        result = None
        for attempt in range(3):
            with rasterio.Env(**GDAL_ENV):
                result = characterize_files(lat, lon, files)
            if result["status"] != "error":
                break
            time.sleep(10 * (attempt + 1))
        result["tiles"] = names
        return result
    return cached("landcover", key, compute)


def terrain_for(key: str, lat: float, lon: float) -> dict:
    def compute():
        from evaluate_candidate import evaluate_candidate
        try:
            r = evaluate_candidate(lat, lon)
        except Exception as exc:
            return {"status": "error", "error": str(exc)[:300]}
        return {"status": "ok", "land_fraction": float(r["land_eligibility"]["land_fraction"]),
                "slope_p95_deg": float(r["slope"]["p95_deg"]), "histogram": [float(r["slope"]["distribution"][b]) for b in v.BINS]}
    return cached("terrain", key, compute)


# ---------- run ----------

def load_inputs():
    import yaml
    config = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    earlier = [s for p in EARLIER for s in yaml.safe_load(p.read_text(encoding="utf-8"))["sites"]]
    index = v.load_index()
    targets = {t: v.target_histogram(json.loads(p.read_text())) for t, p in v.TARGETS.items()}
    return config, earlier, index, targets


def classify_sites(config: dict, earlier: list[dict]) -> list[dict]:
    lo, hi = config["selection"]["coverage_latitudes"]
    sites = []
    for s in config["sites"]:
        status = "candidate"
        if s.get("facility"):
            status = "excluded_facility"
        elif not lo <= s["lat"] <= hi:
            status = "outside_coverage"
        seen = [e["id"] for e in earlier if v.windows_overlap((s["lat"], s["lon"]), (e["lat"], e["lon"]))]
        sites.append({**s, "status": status, "overlaps_earlier_validation": seen})
    return sites


def evaluate(sites, index, targets, workers: int):
    todo = [s for s in sites if s["status"] == "candidate"]
    log(f"Terrain for {len(todo)} sites (local SRTMGL30/MOD44W)")
    for i, s in enumerate(todo, 1):
        s["terrain"] = terrain_for(s["id"], s["lat"], s["lon"])
        if i % 5 == 0 or i == len(todo):
            log(f"  terrain {i}/{len(todo)}")
    for s in todo:
        t = s["terrain"]
        if t["status"] != "ok":
            s["status"] = "terrain_error"
        elif t["land_fraction"] < 0.90:
            s["status"] = "ineligible_land_fraction"
        else:
            s["status"] = "eligible"
    jobs = [(f"site-{s['id']}", s["lat"], s["lon"], s) for s in sites if s["status"] == "eligible"]
    jobs += [(f"index-{w['id']}", w["lat"], w["lon"], w) for w in index]
    log(f"Land cover for {len(jobs)} windows ({workers} in parallel; cached ones are skipped)")
    start, done = time.perf_counter(), 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(land_cover_for, key, lat, lon): owner for key, lat, lon, owner in jobs}
        for future in as_completed(futures):
            owner = futures[future]
            try:
                owner["land_cover"] = future.result()
            except Exception as exc:
                owner["land_cover"] = {"status": "error", "message": str(exc)[:300], "classes": [], "coverageFraction": 0}
            done += 1
            if done % 10 == 0 or done == len(jobs):
                rate = (time.perf_counter() - start) / done
                log(f"  land cover {done}/{len(jobs)} · ~{rate * (len(jobs) - done) / 60:.0f} min left")
    for owner in [s for s in sites if s["status"] == "eligible"] + index:
        owner["bare"] = bare_fraction(owner.get("land_cover"))
        if "hist" in owner:
            owner["slope_distance"] = {t: jensen_shannon_distance(h, owner["hist"]) for t, h in targets.items()}
        else:
            owner["slope_distance"] = {t: jensen_shannon_distance(h, np.array(owner["terrain"]["histogram"])) for t, h in targets.items()}


def analyse(config, sites, index) -> dict:
    eligible = [s for s in sites if s["status"] == "eligible"]
    null = [w for w in index if not any(v.windows_overlap((w["lat"], w["lon"]), (s["lat"], s["lon"])) for s in sites if s["status"] != "outside_coverage")]
    null_lc = [w for w in null if w["bare"] is not None]

    def dists(rows, model, target):
        out = [model_distance(model, r["slope_distance"][target], r["bare"]) for r in rows]
        return np.array([d for d in out if d is not None])

    analyses = {}
    subsets = {"all": eligible, "unseen": [s for s in eligible if not s["overlaps_earlier_validation"]]}
    for subset, members_all in subsets.items():
        for body, target in BODY_TARGET.items():
            members = [s for s in members_all if body in s["analog_for"]]
            for model in ("v1", "v2"):
                rows = members if model == "v1" else [s for s in members if s["bare"] is not None]
                key = f"{subset}_{body}_vs_{target}_{model}"
                analyses[key] = {"model": model, "subset": subset, "kind": "primary" if subset == "all" and model == "v2" else "secondary",
                                 "sites": [s["id"] for s in rows], **v.summarize(dists(rows, model, target), dists(null if model == "v1" else null_lc, model, target))}
            both = [s for s in members if s["bare"] is not None]
            analyses[f"{subset}_{body}_v2_minus_v1"] = {"kind": "primary (H7)" if subset == "all" else "secondary", "sites": [s["id"] for s in both],
                                                       **paired_bootstrap(dists(both, "v1", target), dists(both, "v2", target), dists(null_lc, "v1", target), dists(null_lc, "v2", target))}
    themed = [s for s in eligible if {"arid", "evaporite"} & set(s["themes"])]
    for model in ("v1", "v2"):
        rows = themed if model == "v1" else [s for s in themed if s["bare"] is not None]
        analyses[f"atlas_theme_rule_jezero_{model}"] = {"model": model, "kind": "secondary (descriptive vs Atlas 0.831)", "sites": [s["id"] for s in rows],
                                                        **v.summarize(dists(rows, model, "jezero"), dists(null if model == "v1" else null_lc, model, "jezero"))}
    return {"null_windows": len(null), "null_windows_with_land_cover": len(null_lc), "analyses": analyses}


def write_outputs(config, sites, index, result) -> None:
    report = {"id": config["id"], "preregistration": str(CONFIG.relative_to(ROOT)), "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
              "site_list_source": config["site_list_source"], "permutations": v.N_PERMUTATIONS, "bootstrap": N_BOOT, "seed": v.SEED, **result,
              "sites": [{k: s.get(k) for k in ("id", "name", "country", "lat", "lon", "analog_for", "themes", "status", "overlaps_earlier_validation", "bare", "slope_distance")} | {"land_fraction": (s.get("terrain") or {}).get("land_fraction"), "land_cover_status": (s.get("land_cover") or {}).get("status")} for s in sites],
              "index_land_cover": {w["id"]: {"bare": w["bare"], "status": (w.get("land_cover") or {}).get("status")} for w in index}}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.with_suffix(".json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    with OUTPUT.with_suffix(".csv").open("w", encoding="utf-8", newline="") as handle:
        w = csv.writer(handle)
        w.writerow(["analysis", "kind", "model", "n_sites", "auc", "median_percentile", "top_decile", "permutation_p", "difference", "ci95_low", "ci95_high"])
        for name, a in result["analyses"].items():
            ci = a.get("ci95") or ["", ""]
            w.writerow([name, a.get("kind"), a.get("model", ""), a.get("n_sites"), a.get("auc", a.get("auc_v2", "")), a.get("median_percentile", ""), a.get("top_decile", ""), a.get("permutation_p", ""), a.get("difference", ""), ci[0], ci[1]])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--plan", action="store_true", help="Show what will be computed; no network.")
    parser.add_argument("--check", action="store_true", help="Compute one index window and one site to test the setup.")
    parser.add_argument("--workers", type=int, default=4, help="Parallel land-cover reads (default 4).")
    args = parser.parse_args()
    config, earlier, index, targets = load_inputs()
    sites = classify_sites(config, earlier)
    counts = {}
    for s in sites:
        counts[s["status"]] = counts.get(s["status"], 0) + 1
    if args.plan:
        tiles = set()
        for lat, lon in [(s["lat"], s["lon"]) for s in sites if s["status"] == "candidate"] + [(w["lat"], w["lon"]) for w in index]:
            try:
                tiles.update(tiles_for_window(lat, lon))
            except ValueError:
                pass
        print(f"VAL-003 plan · {len(sites)} Atlas sites: {counts}")
        print(f"  {len(index)} index windows + {counts.get('candidate', 0)} sites need land cover; up to {len(tiles)} WorldCover tiles touched (read remotely, only the window).")
        print(f"  Cached so far: {len(list((CACHE / 'landcover').glob('*.json')))} land cover, {len(list((CACHE / 'terrain').glob('*.json')))} terrain.")
        return
    if args.check:
        w, s = index[0], next(x for x in sites if x["status"] == "candidate")
        t0 = time.perf_counter()
        lc = land_cover_for(f"index-{w['id']}", w["lat"], w["lon"])
        log(f"Land cover check {w['id']}: {lc['status']}, coverage {lc.get('coverageFraction', 0):.3f}, bare {bare_fraction(lc)}, {time.perf_counter() - t0:.0f} s")
        tr = terrain_for(s["id"], s["lat"], s["lon"])
        log(f"Terrain check {s['id']}: {tr['status']}" + (f", land {tr['land_fraction']:.2f}" if tr["status"] == "ok" else f" — {tr.get('error')}"))
        ok = lc["status"] in ("available", "partial", "unavailable") and tr["status"] == "ok"
        log("CHECK OK — you can start the full run." if ok else "CHECK FAILED — see the messages above.")
        raise SystemExit(0 if ok else 1)
    log(f"VAL-003 start · sites {counts}")
    evaluate(sites, index, targets, args.workers)
    result = analyse(config, sites, index)
    write_outputs(config, sites, index, result)
    log(f"Null windows {result['null_windows']} ({result['null_windows_with_land_cover']} with land cover)")
    for name, a in result["analyses"].items():
        if name.endswith("_minus_v1"):
            if a.get("n_sites"):
                log(f"{name:34s} n={a['n_sites']:2d} AUC v1 {a['auc_v1']:.3f} → v2 {a['auc_v2']:.3f} (Δ {a['difference']:+.3f}, 95% CI {a['ci95'][0]:+.3f} to {a['ci95'][1]:+.3f})")
        elif a["n_sites"]:
            log(f"{name:34s} n={a['n_sites']:2d} AUC {a['auc']:.3f} · median pct {100 * a['median_percentile']:.0f} · top10% {a['top_decile']} · p {a['permutation_p']:.4f}")
    log(f"✓ Results: {OUTPUT.relative_to(ROOT)}.json and .csv")


if __name__ == "__main__":
    main()
