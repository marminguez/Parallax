"""Campaign planning v1: the reachable twin (config/campaign/reachable_twins_v1.yaml).

For each VAL-004 destination, every eligible Earth window is compared with the destination's
slope histogram. Among strong twins (distance <= q25), the ones within 100 km of an airport with
scheduled flights are "reachable". The VAL-004 twin is never changed: this is a separate view.

    python scripts/reachable_twins.py            # downloads the pinned OurAirports file if missing

Outputs:
  results/campaign/reachable_twins_v1.json   full record with provenance
  web/data/reachable-twins.json              what the web page shows
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from parallax.matching.similarity import jensen_shannon_distance  # noqa: E402
from parallax.places import describe  # noqa: E402

CONFIG = ROOT / "config/campaign/reachable_twins_v1.yaml"
VAL004 = ROOT / "config/validation/val004_reverse_map_v1.yaml"
SITES = ROOT / "web/data/val004-sites.json"
AIRPORTS = ROOT / "data/airports/airports.csv"
AIRPORTS_COMMIT = "64af12951161ed52bc733eb4101224643c48850a"
AIRPORTS_URL = f"https://raw.githubusercontent.com/davidmegginson/ourairports-data/{AIRPORTS_COMMIT}/airports.csv"
OUT_FULL = ROOT / "results/campaign/reachable_twins_v1.json"
OUT_WEB = ROOT / "web/data/reachable-twins.json"
BINS = ["0-1", "1-2", "2-3", "3-5", "5-10", "10-15", "15-20", ">=20"]
R_KM = 6371.0088
REACHABLE_KM = 100.0
BANDS_KM = (100.0, 250.0)
SHORTLIST = 10
WINDOW_KM = 50.0


def js_distances(p: np.ndarray, Q: np.ndarray) -> np.ndarray:
    """Base-2 Jensen-Shannon distance from one histogram to many (same maths as jensen_shannon_distance)."""
    p = p / p.sum()
    Q = Q / Q.sum(axis=1, keepdims=True)
    M = 0.5 * (p + Q)
    with np.errstate(divide="ignore", invalid="ignore"):
        kp = np.where(p > 0, p * np.log2(p / M), 0.0).sum(axis=1)
        kq = np.where(Q > 0, Q * np.log2(Q / M), 0.0).sum(axis=1)
    return np.sqrt(np.clip(0.5 * (kp + kq), 0, None))


def haversine_min(lat: np.ndarray, lon: np.ndarray, alat: np.ndarray, alon: np.ndarray, chunk: int = 2000):
    """Nearest airport (index, km) for every point."""
    la, lo = np.radians(lat), np.radians(lon)
    ala, alo = np.radians(alat), np.radians(alon)
    idx = np.empty(lat.size, int)
    dist = np.empty(lat.size)
    for s in range(0, lat.size, chunk):
        a, b = la[s:s + chunk, None], lo[s:s + chunk, None]
        h = np.sin((ala - a) / 2) ** 2 + np.cos(a) * np.cos(ala) * np.sin((alo - b) / 2) ** 2
        i = h.argmin(axis=1)
        idx[s:s + chunk] = i
        dist[s:s + chunk] = 2 * R_KM * np.arcsin(np.sqrt(np.minimum(1.0, h[np.arange(i.size), i])))
    return idx, dist


def overlaps(a: dict, b: dict) -> bool:
    """Same rule as the web's windowsOverlap: 50 km squares on a local equirectangular offset."""
    d_lon = b["lon"] - a["lon"]
    d_lon = (d_lon + 180) % 360 - 180
    dy = math.radians(b["lat"] - a["lat"]) * R_KM
    dx = math.radians(d_lon) * R_KM * math.cos(math.radians((a["lat"] + b["lat"]) / 2))
    return abs(dx) < WINDOW_KM and abs(dy) < WINDOW_KM


def band(km: float) -> str:
    return "near" if km <= BANDS_KM[0] else "mid" if km <= BANDS_KM[1] else "far"


def load_windows(path: Path, eligible_only: bool = False):
    ids, lat, lon, hist = [], [], [], []
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            if eligible_only and r.get("land_status") != "ELIGIBLE":
                continue
            ids.append(r["id"]); lat.append(float(r["lat"])); lon.append(float(r["lon"]))
            hist.append([float(r[b]) for b in BINS])
    return ids, np.array(lat), np.array(lon), np.array(hist)


def load_airports():
    if not AIRPORTS.exists():
        AIRPORTS.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(AIRPORTS_URL, AIRPORTS)
    rows = []
    with AIRPORTS.open(newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["type"] in ("large_airport", "medium_airport") and r["scheduled_service"] == "yes":
                rows.append(r)
    return rows


def git_commit() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return None


def main() -> None:
    cfg = yaml.safe_load(CONFIG.read_text())
    q25 = float(yaml.safe_load(VAL004.read_text())["thresholds"]["q25"])
    assert "0.29885" in cfg["candidates"]["good_twin"] and abs(q25 - 0.29885) < 1e-9, "q25 must match the frozen config"

    sites = json.loads(SITES.read_text())["destinations"]
    planet = {"moon": load_windows(ROOT / "results/val004/moon_windows.csv"), "mars": load_windows(ROOT / "results/val004/mars_windows.csv")}
    e_ids, e_lat, e_lon, e_hist = load_windows(ROOT / "results/val004/earth_windows.csv", eligible_only=True)
    airports = load_airports()
    a_lat = np.array([float(a["latitude_deg"]) for a in airports])
    a_lon = np.array([float(a["longitude_deg"]) for a in airports])
    a_idx, a_km = haversine_min(e_lat, e_lon, a_lat, a_lon)
    print(f"{len(e_ids)} eligible Earth windows, {len(airports)} scheduled airports; "
          f"{(a_km <= REACHABLE_KM).sum()} windows within {REACHABLE_KM:.0f} km of one", flush=True)

    def airport(i: int) -> dict:
        a = airports[a_idx[i]]
        return {"name": a["name"], "iata": a["iata_code"] or None, "municipality": a["municipality"] or None,
                "country": a["iso_country"], "continent": a["continent"], "km": round(float(a_km[i]), 1)}

    def window(i: int, d: float) -> dict:
        place = describe(float(e_lat[i]), float(e_lon[i]))
        return {"id": e_ids[i], "lat": round(float(e_lat[i]), 4), "lon": round(float(e_lon[i]), 4), "distance": round(float(d), 4),
                "band": band(float(a_km[i])), "airport": airport(i),
                "place": {k: place[k] for k in ("nearest", "admin1", "countryCode", "distanceKm")}}

    out = []
    for dest in sites:
        p_ids, _, _, p_hist = planet[dest["body"]]
        p = p_hist[p_ids.index(dest["window"])]
        d = js_distances(p, e_hist)
        # Spot check against the reference implementation and against VAL-004.
        for j in (0, int(d.argmin()), len(d) - 1):
            assert abs(d[j] - jensen_shannon_distance(p, e_hist[j])) < 1e-9
        best = int(d.argmin())
        assert abs(d[best] - dest["distance"]) < 5e-4, (dest["id"], d[best], dest["distance"])

        good = np.where(d <= q25)[0]
        reach = good[a_km[good] <= REACHABLE_KM]
        order = reach[np.argsort(d[reach], kind="stable")]
        shortlist: list[dict] = []
        for i in order:
            cand = {"lat": float(e_lat[i]), "lon": float(e_lon[i])}
            if any(overlaps(cand, s) for s in shortlist):
                continue
            shortlist.append({**cand, "i": int(i)})
            if len(shortlist) == SHORTLIST:
                break
        listed = [window(s["i"], d[s["i"]]) for s in shortlist]
        original = window(best, d[best])
        out.append({
            "id": dest["id"], "name": dest["name"], "body": dest["body"], "kind": dest.get("kind"), "window": dest["window"],
            "val004_twin": original, "val004_twin_reachable": bool(a_km[best] <= REACHABLE_KM),
            "good_twins": int(good.size), "reachable_good_twins": int(reach.size),
            "reachable_twin": listed[0] if listed else None,
            "shortlist": listed,
        })
        r = listed[0] if listed else None
        print(f"{dest['name']}: {good.size} strong twins, {reach.size} reachable; "
              + (f"best reachable {r['distance']} near {r['airport']['iata'] or r['airport']['name']} ({r['airport']['km']} km)" if r else "none reachable"), flush=True)

    provenance = {
        "config": str(CONFIG.relative_to(ROOT)), "commit": git_commit(),
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "q25": q25, "reachable_km": REACHABLE_KM, "bands_km": list(BANDS_KM),
        "airports": {"source": "OurAirports (public domain)", "commit": AIRPORTS_COMMIT,
                     "sha256": hashlib.sha256(AIRPORTS.read_bytes()).hexdigest(), "scheduled": len(airports)},
        "earth_windows": len(e_ids),
        "places": "GeoNames cities1000 (CC BY 4.0), display only",
    }
    OUT_FULL.parent.mkdir(parents=True, exist_ok=True)
    OUT_FULL.write_text(json.dumps({"version": cfg["version"], "provenance": provenance, "destinations": out}, indent=1))
    OUT_WEB.write_text(json.dumps({"version": cfg["version"], "run_at": provenance["run_at"], "reachableKm": REACHABLE_KM,
                                   "q25": q25, "destinations": out}, separators=(",", ":")))
    print(f"Wrote {OUT_FULL.relative_to(ROOT)} and {OUT_WEB.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
