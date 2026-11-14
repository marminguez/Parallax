"""Reachability v1 (config/search/reachability_v1.yaml): nearest scheduled airport for every window
of the Earth dimensions index, with the campaign v1 rule reused unchanged.

Check R1 first: every window of results/campaign/reachable_twins_v1.json must get the same
airport and the same distance (to 0.1 km). On failure nothing is written for the web.

    python scripts/search_reachability.py
"""
from __future__ import annotations

import csv
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from reachable_twins import AIRPORTS, AIRPORTS_COMMIT, BANDS_KM, REACHABLE_KM, haversine_min, load_airports  # noqa: E402

CONFIG = ROOT / "config/search/reachability_v1.yaml"
INDEX = ROOT / "web/data/earth-index.csv"
CENTRES = ROOT / "results/val004/earth_windows.csv"
CAMPAIGN = ROOT / "results/campaign/reachable_twins_v1.json"
OUT = ROOT / "results/search/reachability_v1.json"
OUT_WEB = ROOT / "web/data/earth-airports.json"


def band(km: float) -> str:
    return "near" if km <= BANDS_KM[0] else "mid" if km <= BANDS_KM[1] else "far"


def campaign_windows() -> dict[str, dict]:
    out = {}
    for d in json.loads(CAMPAIGN.read_text())["destinations"]:
        for w in [d.get("val004_twin"), d.get("reachable_twin"), *d.get("shortlist", [])]:
            if w and "airport" in w:
                out[w["id"]] = w
    return out


def main() -> None:
    ids = [r["id"] for r in csv.DictReader(INDEX.open())]
    centres = {r["id"]: (float(r["lat"]), float(r["lon"])) for r in csv.DictReader(CENTRES.open())}
    missing = [i for i in ids if i not in centres]
    if missing:
        raise SystemExit(f"{len(missing)} index windows have no VAL-004 centre (first {missing[:3]})")
    camp = campaign_windows()
    every = list(dict.fromkeys(ids + list(camp)))
    lat = np.array([centres[i][0] for i in every]); lon = np.array([centres[i][1] for i in every])
    airports = load_airports()
    a_idx, a_km = haversine_min(lat, lon, np.array([float(a["latitude_deg"]) for a in airports]), np.array([float(a["longitude_deg"]) for a in airports]))
    pos = {w: k for k, w in enumerate(every)}

    # R1: reproduce campaign v1
    mism = []
    for wid, w in camp.items():
        k = pos[wid]
        name, km = airports[a_idx[k]]["name"], round(float(a_km[k]), 1)
        if name != w["airport"]["name"] or abs(km - w["airport"]["km"]) > 0.1:
            mism.append({"id": wid, "published": [w["airport"]["name"], w["airport"]["km"]], "new": [name, km]})
    r1 = {"pass": not mism, "windows": len(camp), "mismatches": mism}

    sel = np.array([pos[i] for i in ids])
    km = a_km[sel]
    counts = {b: int(n) for b, n in zip(*np.unique([band(float(x)) for x in km], return_counts=True))}
    run = {"config": str(CONFIG.relative_to(ROOT)), "commit": git_commit(), "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "airports": {"commit": AIRPORTS_COMMIT, "sha256": hashlib.sha256(AIRPORTS.read_bytes()).hexdigest(), "scheduled": len(airports)},
           "R1": r1, "windows": len(ids), "reachable": int((km <= REACHABLE_KM).sum()), "bands": counts}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(run, indent=1, ensure_ascii=False) + "\n")
    print(json.dumps({k: run[k] for k in ("R1", "windows", "reachable", "bands")}, indent=1, ensure_ascii=False))
    if not r1["pass"]:
        print("R1 fails: web/data/earth-airports.json is not written (reachability_v1.yaml, checks).")
        return
    used = sorted(set(int(a_idx[k]) for k in sel))
    remap = {a: n for n, a in enumerate(used)}
    web = {"source": "OurAirports (public domain), large and medium airports with scheduled service; reachability v1",
           "fields": ["name", "iata", "municipality", "country"],
           "window_fields": ["airport", "km (rounded to 0.1)", "reachable (1 if the unrounded distance is <= 100 km)"],
           "airports": [[airports[a]["name"], airports[a]["iata_code"] or None, airports[a]["municipality"] or None, airports[a]["iso_country"]] for a in used],
           "windows": {i: [remap[int(a_idx[pos[i]])], round(float(a_km[pos[i]]), 1), int(a_km[pos[i]] <= REACHABLE_KM)] for i in ids}}
    OUT_WEB.write_text(json.dumps(web, separators=(",", ":"), ensure_ascii=False) + "\n")
    print(f"wrote {OUT_WEB.relative_to(ROOT)} ({OUT_WEB.stat().st_size // 1024} KB)")


def git_commit():
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return None


if __name__ == "__main__":
    main()
