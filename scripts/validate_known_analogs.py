"""VAL-001 — blind recovery of established Moon/Mars analogs.

Follows the frozen pre-registration in config/validation/known_analogs_v1.yaml:
evaluates each established analog site with the EXP-001B engine, measures its
slope-distribution distance to Jezero and Shackleton, and compares it with the
eligible windows of the measured index (the null distribution).

Run from the repository root with the local SRTMGL30/MOD44W data:

    python scripts/validate_known_analogs.py

Writes results/validation/val001_known_analogs.json and .csv.
"""
from __future__ import annotations

import csv
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

from parallax.matching.similarity import jensen_shannon_distance  # noqa: E402

CONFIG = ROOT / "config/validation/known_analogs_v1.yaml"
OUTPUT_DIR = ROOT / "results/validation"
BINS = ("0-1", "1-2", "2-3", "3-5", "5-10", "10-15", "15-20", ">=20")
TARGETS = {
    "jezero": ROOT / "results/exp001/jezero_target_50km_v0_4.json",
    "shackleton": ROOT / "results/exp002/shackleton_target_50km_v0_1.json",
}
PRIMARY = {"mars": "jezero", "moon": "shackleton"}
WINDOW_KM = 50.0
EARTH_RADIUS_KM = 6371.0088
N_PERMUTATIONS = 10_000
SEED = 2026
LAND_THRESHOLD = 0.90


# ---------- pure helpers (unit-tested) ----------

def target_histogram(target: dict) -> np.ndarray:
    pct = target["terrain"]["1000m"]["slope"]["distribution_pct"]
    values = np.array([pct[b] for b in BINS], dtype=float)
    return values / values.sum()


def windows_overlap(a: tuple[float, float], b: tuple[float, float], window_km: float = WINDOW_KM) -> bool:
    """Same square-window overlap test as web/src/lib/search.ts (local equirectangular offsets)."""
    d_lon = (b[1] - a[1] + 540.0) % 360.0 - 180.0
    dy = math.radians(b[0] - a[0]) * EARTH_RADIUS_KM
    dx = math.radians(d_lon) * EARTH_RADIUS_KM * math.cos(math.radians((a[0] + b[0]) / 2))
    return abs(dx) < window_km and abs(dy) < window_km


def percentile(distance: float, null: np.ndarray) -> float:
    """Share of null windows at least as close as `distance` (ties count half). Lower is better."""
    return float((np.sum(null < distance) + 0.5 * np.sum(null == distance)) / null.size)


def auc(distances: np.ndarray, null: np.ndarray) -> float:
    """Mean probability that a null window is farther from the target than a site."""
    return float(np.mean([1.0 - percentile(d, null) for d in distances]))


def permutation_p(distances: np.ndarray, null: np.ndarray, n_permutations: int = N_PERMUTATIONS, seed: int = SEED) -> float:
    """One-sided p: random sets of n null windows scored against the remaining null reach the observed AUC."""
    n = distances.size
    if n == 0 or null.size <= n:
        return float("nan")
    observed = auc(distances, null)
    rng = np.random.default_rng(seed)
    hits = 0
    for _ in range(n_permutations):
        chosen = rng.choice(null.size, size=n, replace=False)
        mask = np.ones(null.size, dtype=bool)
        mask[chosen] = False
        if auc(null[chosen], null[mask]) >= observed - 1e-12:
            hits += 1
    return (hits + 1) / (n_permutations + 1)


def summarize(distances: np.ndarray, null: np.ndarray) -> dict:
    pcts = [percentile(d, null) for d in distances]
    return {
        "n_sites": int(distances.size),
        "n_null": int(null.size),
        "auc": auc(distances, null) if distances.size else None,
        "median_percentile": float(np.median(pcts)) if pcts else None,
        "top_decile": int(sum(p <= 0.10 for p in pcts)),
        "permutation_p": permutation_p(distances, null) if distances.size else None,
    }


# ---------- evaluation ----------

def load_index() -> list[dict]:
    with (ROOT / "web/data/earth-candidates.csv").open(encoding="utf-8", newline="") as handle:
        coords = {r["candidate_id"]: (float(r["latitude_deg"]), float(r["longitude_deg"])) for r in csv.DictReader(handle)}
    with (ROOT / "web/data/earth-slope-histograms.csv").open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    return [{"id": r["candidate_id"], "lat": coords[r["candidate_id"]][0], "lon": coords[r["candidate_id"]][1], "hist": np.array([float(r[b]) for b in BINS])} for r in rows]


def evaluate_site(site: dict, evaluator: Callable[[float, float], dict], coverage: tuple[float, float]) -> dict:
    record = {k: site[k] for k in ("id", "name", "country", "lat", "lon", "groups", "used_for", "source_url")}
    if not coverage[0] <= site["lat"] <= coverage[1]:
        return {**record, "status": "outside_coverage"}
    try:
        result = evaluator(site["lat"], site["lon"])
    except Exception as exc:  # report, never drop
        return {**record, "status": "error", "error": str(exc)[:300]}
    land = float(result["land_eligibility"]["land_fraction"])
    return {
        **record,
        "status": "eligible" if land >= LAND_THRESHOLD else "ineligible_land_fraction",
        "land_fraction": land,
        "slope_p95_deg": float(result["slope"]["p95_deg"]),
        "slope_mean_deg": float(result["slope"]["mean_deg"]),
        "histogram": [float(result["slope"]["distribution"][b]) for b in BINS],
    }


def run(config: dict, evaluator: Callable[[float, float], dict], index: list[dict], targets: dict[str, np.ndarray]) -> dict:
    coverage = tuple(config["coverage"]["srtmgl30_latitudes"])
    sites = [evaluate_site(s, evaluator, coverage) for s in config["sites"]]
    for site in sites:
        if "histogram" in site:
            site["distance"] = {t: jensen_shannon_distance(h, np.array(site["histogram"])) for t, h in targets.items()}
    # Null: index windows that do not overlap any analog site window.
    null_windows = [w for w in index if not any(windows_overlap((w["lat"], w["lon"]), (s["lat"], s["lon"])) for s in config["sites"])]
    null = {t: np.array([jensen_shannon_distance(h, w["hist"]) for w in null_windows]) for t, h in targets.items()}
    for site in sites:
        if "distance" in site:
            site["percentile"] = {t: percentile(d, null[t]) for t, d in site["distance"].items()}
            site["rank_among_null"] = {t: int(np.sum(null[t] < d)) + 1 for t, d in site["distance"].items()}
    analyses = {}
    for group, target in PRIMARY.items():
        for t, kind in ((target, "primary"), (next(x for x in targets if x != target), "exploratory")):
            members = [s for s in sites if group in s["groups"] and s["status"] == "eligible"]
            analyses[f"{group}_vs_{t}"] = {"kind": kind, "sites": [s["id"] for s in members], **summarize(np.array([s["distance"][t] for s in members]), null[t])}
    return {
        "id": config["id"],
        "preregistration": str(CONFIG.relative_to(ROOT)),
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "null": {"source": "EXP-001B eligible index windows with stored histograms", "windows": len(null_windows), "excluded_overlapping_sites": len(index) - len(null_windows)},
        "permutations": N_PERMUTATIONS,
        "seed": SEED,
        "analyses": analyses,
        "sites": sites,
        "not_evaluable": config.get("not_evaluable", []),
    }


def main() -> None:
    import yaml
    from evaluate_candidate import evaluate_candidate

    config = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    targets = {t: target_histogram(json.loads(p.read_text())) for t, p in TARGETS.items()}
    report = run(config, evaluate_candidate, load_index(), targets)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "val001_known_analogs.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    with (OUTPUT_DIR / "val001_known_analogs.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["id", "name", "groups", "status", "land_fraction", "slope_p95_deg", "jsd_jezero", "pct_jezero", "jsd_shackleton", "pct_shackleton"])
        for s in report["sites"]:
            d, p = s.get("distance", {}), s.get("percentile", {})
            writer.writerow([s["id"], s["name"], "+".join(s["groups"]), s["status"], s.get("land_fraction", ""), s.get("slope_p95_deg", ""),
                             d.get("jezero", ""), p.get("jezero", ""), d.get("shackleton", ""), p.get("shackleton", "")])
    print(f"VAL-001 · null = {report['null']['windows']} index windows")
    for s in report["sites"]:
        if "distance" in s:
            print(f"  {s['name'][:44]:44s} {s['status']:24s} Jezero {s['distance']['jezero']:.3f} (p{100 * s['percentile']['jezero']:4.0f})  Shackleton {s['distance']['shackleton']:.3f} (p{100 * s['percentile']['shackleton']:4.0f})")
        else:
            print(f"  {s['name'][:44]:44s} {s['status']}")
    for name, a in report["analyses"].items():
        if a["n_sites"]:
            print(f"{name:22s} [{a['kind']}] n={a['n_sites']} AUC={a['auc']:.3f} median pct={100 * a['median_percentile']:.0f} top10%={a['top_decile']} p={a['permutation_p']:.4f}")
        else:
            print(f"{name:22s} [{a['kind']}] no eligible sites")
    print(f"✓ Written to {OUTPUT_DIR.relative_to(ROOT)}/val001_known_analogs.json and .csv")


if __name__ == "__main__":
    main()
