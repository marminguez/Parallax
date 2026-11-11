"""Artemis references v1 (config/search/artemis_references_v1.yaml).

Freezes the 1 km slope fingerprint of each Artemis III region's VAL-004 lunar window
as a search reference, runs check C1 and evaluates prediction P1. No network, no
new measurement.

    python scripts/artemis_references.py

Outputs:
  web/data/artemis/<id>.json            one frozen reference per region (same shape as the other targets)
  web/data/artemis-references.json      summary for the web (region, window, centre, published twin)
  results/artemis_references/run_v1.json  C1 per region, P1 counts, provenance
"""
from __future__ import annotations

import csv
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from parallax.matching.similarity import jensen_shannon_distance  # noqa: E402

CONFIG = ROOT / "config/search/artemis_references_v1.yaml"
SITES = ROOT / "web/data/val004-sites.json"
MOON_WINDOWS = ROOT / "results/val004/moon_windows.csv"
MOON_TWINS = ROOT / "results/val004/moon_twins.csv"
EARTH_WINDOWS = ROOT / "results/val004/earth_windows.csv"
EARTH_DIMS = ROOT / "results/earth_dimensions/earth_dimensions_v1.csv"
WEB_INDEX = ROOT / "web/data/earth-index.csv"
REACHABLE = ROOT / "results/campaign/reachable_twins_v1.json"
OUT_WEB_DIR = ROOT / "web/data/artemis"
OUT_WEB = ROOT / "web/data/artemis-references.json"
OUT_RUN = ROOT / "results/artemis_references/run_v1.json"
BINS = ["0-1", "1-2", "2-3", "3-5", "5-10", "10-15", "15-20", ">=20"]
STRONG = 0.29885
C1_TOL = 1e-5


def rows(path: Path) -> list[dict]:
    with path.open(newline="") as f:
        return list(csv.DictReader(f))


def hist(r: dict) -> np.ndarray:
    return np.array([float(r[b]) for b in BINS])


def git_commit() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return None


def main() -> None:
    cfg = yaml.safe_load(CONFIG.read_text())
    sites = {d["id"]: d for d in json.loads(SITES.read_text())["destinations"]}
    moon = {r["id"]: r for r in rows(MOON_WINDOWS)}
    twins = {r["id"]: r for r in rows(MOON_TWINS)}
    good = {d["id"]: d["good_twins"] for d in json.loads(REACHABLE.read_text())["destinations"]}
    earth_full = [(r["id"], hist(r)) for r in rows(EARTH_WINDOWS) if r["land_status"] == "ELIGIBLE"]
    web_index = [(r["id"], hist(r)) for r in rows(WEB_INDEX)]
    dims = {r["id"]: r for r in rows(EARTH_DIMS)}

    OUT_WEB_DIR.mkdir(parents=True, exist_ok=True)
    summary, c1, p1 = [], {}, {}
    for reg in cfg["references"]["regions"]:
        rid, wid = reg["id"], reg["window"]
        site = sites[rid]
        assert site["window"] == wid, f"{rid}: config window {wid} != VAL-004 {site['window']}"
        w = moon[wid]
        h = hist(w)
        twin = twins[wid]

        # The frozen reference, in the same shape as the other targets.
        pct = {b: round(float(v) * 100, 6) for b, v in zip(BINS, h / h.sum())}
        ref = {
            "version": "artemis_references_v1",
            "target": {"planet": "Moon", "region": site["name"], "reference": f"VAL-004 lunar window {wid}", "id": rid,
                       "center_lat_deg": site["lat"], "center_lon_deg": site["lon"], "window_km": 50,
                       "context": f"Artemis III candidate region; fingerprint of the VAL-004 window assigned to its centre ({site['windowKm']} km away)"},
            "source": {"dataset": "LOLA south-pole DEM 20 m, aggregated to 1 km (VAL-004 lunar grid)", "native_resolution_m": 20,
                       "citation": "Barker et al. 2023, doi:10.3847/PSJ/acf3e1"},
            "terrain": {"1000m": {"slope": {"distribution_pct": pct}}},
        }
        (OUT_WEB_DIR / f"{rid}.json").write_text(json.dumps(ref, indent=1, ensure_ascii=False))

        # C1: the web index (rounded histograms) must give the published twin first.
        d = [(float(jensen_shannon_distance(h, e)), i) for i, e in web_index]
        best_d, best_id = min(d)
        pub_d = float(twin["distance"])
        ok = best_id == twin["earth_id"] and abs(best_d - pub_d) <= C1_TOL
        c1[rid] = {"pass": ok, "first": best_id, "distance": round(best_d, 9), "published_twin": twin["earth_id"], "published_distance": round(pub_d, 9)}

        # P1: strong twins as counted in campaign v1 (full-precision histograms), then bare ground and permafrost.
        strong = [i for i, e in earth_full if jensen_shannon_distance(h, e) <= STRONG]
        if len(strong) != good[rid]:
            raise RuntimeError(f"{rid}: {len(strong)} strong twins != campaign v1 count {good[rid]}")
        hits = [i for i in strong if dims[i]["bare_share"] != "" and float(dims[i]["bare_share"]) >= 0.5 and dims[i]["ice_signal"] == "true"]
        p1[rid] = {"strong_twins": len(strong), "with_bare_and_permafrost": len(hits)}

        summary.append({"id": rid, "name": site["name"], "window": wid, "lat": site["lat"], "lon": site["lon"],
                        "twin": twin["earth_id"], "twinDistance": round(pub_d, 6), "strongTwins": len(strong), "drillingCandidates": len(hits)})

    regions_ok = sum(1 for v in p1.values() if v["with_bare_and_permafrost"] >= 5)
    run = {"version": "artemis_references_v1", "config": str(CONFIG.relative_to(ROOT)), "commit": git_commit(),
           "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "C1": {"pass": all(v["pass"] for v in c1.values()), "regions": c1},
           "P1": {"regions_with_at_least_5": regions_ok, "supported": regions_ok >= 7, "regions": p1}}
    OUT_RUN.write_text(json.dumps(run, indent=1))
    if not run["C1"]["pass"]:
        for f in (OUT_WEB_DIR.glob("*.json")):
            f.unlink()
        print(json.dumps(c1, indent=1))
        raise SystemExit("C1 failed: references not published (config/search/artemis_references_v1.yaml, checks.C1).")
    OUT_WEB.write_text(json.dumps({"version": "artemis_references_v1", "regions": summary}, indent=1, ensure_ascii=False))
    print(json.dumps({"C1": run["C1"]["pass"], "P1": run["P1"]["regions_with_at_least_5"], "supported": run["P1"]["supported"]}))
    for rid, v in p1.items():
        print(f"  {rid:22} C1 {'ok' if c1[rid]['pass'] else 'FAIL'}  strong {v['strong_twins']:5}  bare+permafrost {v['with_bare_and_permafrost']:4}")


if __name__ == "__main__":
    main()
