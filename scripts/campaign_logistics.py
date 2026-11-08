"""Campaign planning v1.1: when to go and where to sleep (config/campaign/logistics_v1.yaml).

For every reverse-map twin and every shortlisted reachable twin (results/campaign/reachable_twins_v1.json):
  - NASA POWER monthly climatology (air temperature min/max, precipitation) -> workable months
  - OpenStreetMap lodging (Overpass API) within 50 km -> counts and the nearest one

Responses are cached in data/cache/ so a re-run reads them instead of asking again.

    python scripts/campaign_logistics.py          # about 10 minutes the first time (polite pauses)

Outputs:
  results/campaign/logistics_v1.json   full record with provenance
  web/data/campaign-logistics.json     what the web page shows
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REACHABLE = ROOT / "results/campaign/reachable_twins_v1.json"
OUT_FULL = ROOT / "results/campaign/logistics_v1.json"
OUT_WEB = ROOT / "web/data/campaign-logistics.json"
CACHE_POWER = ROOT / "data/cache/power_campaign"
CACHE_OSM = ROOT / "data/cache/overpass"
POWER_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "Parallax-NASA-Space-Apps-2026/1.0 (research prototype)"
MONTHS = ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
LODGING = ("hotel", "motel", "guest_house", "hostel", "chalet", "apartment", "alpine_hut", "camp_site")
T_MIN, T_MAX, RAIN_MAX = -10.0, 35.0, 3.0      # frozen: workable_month
NEAR_KM, RADIUS_KM = 25.0, 50.0                 # frozen: lodging bands
R_KM = 6371.0088


# ------------------------------------------------------------------ pure rules (tested)

def workable(t_min: float, t_max: float, rain: float) -> bool:
    return t_min >= T_MIN and t_max <= T_MAX and rain <= RAIN_MAX


def calendar(payload: dict) -> dict:
    """Monthly climatology from a POWER response -> per-month values and the workable flag."""
    params = payload["properties"]["parameter"]
    fill = payload.get("header", {}).get("fill_value", -999.0)
    months = []
    for m in MONTHS:
        vals = {k: float(params[k][m]) for k in ("T2M_MIN", "T2M_MAX", "PRECTOTCORR")}
        if any(v == fill or v <= -900 for v in vals.values()):
            raise ValueError(f"NASA POWER has no {m} value here")
        months.append({"month": m, "tmin": round(vals["T2M_MIN"], 1), "tmax": round(vals["T2M_MAX"], 1),
                       "rain": round(vals["PRECTOTCORR"], 2), "workable": workable(vals["T2M_MIN"], vals["T2M_MAX"], vals["PRECTOTCORR"])})
    return {"months": months, "workable_count": sum(m["workable"] for m in months)}


def km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * R_KM * math.asin(math.sqrt(min(1.0, h)))


def lodging(lat: float, lon: float, elements: list[dict]) -> dict:
    """Overpass elements -> counts within 25 and 50 km and the nearest lodging."""
    found = []
    for e in elements:
        tags = e.get("tags", {})
        if tags.get("tourism") not in LODGING:
            continue
        la = e.get("lat", e.get("center", {}).get("lat"))
        lo = e.get("lon", e.get("center", {}).get("lon"))
        if la is None or lo is None:
            continue
        found.append({"name": tags.get("name") or tags.get("name:en"), "type": tags["tourism"], "km": round(km(lat, lon, la, lo), 1)})
    found = [f for f in found if f["km"] <= RADIUS_KM]
    found.sort(key=lambda f: f["km"])
    near = sum(f["km"] <= NEAR_KM for f in found)
    band = "in_reach" if near else "day_trip" if found else "none_mapped"
    return {"within_25km": near, "within_50km": len(found), "nearest": found[0] if found else None, "band": band,
            "types": {t: sum(f["type"] == t for f in found) for t in LODGING if any(f["type"] == t for f in found)}}


# ------------------------------------------------------------------ network (cached)

def fetch(url: str, data: bytes | None = None, tries: int = 4) -> bytes:
    last: Exception | None = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"{url}: {last}")


def power(site: dict) -> dict:
    CACHE_POWER.mkdir(parents=True, exist_ok=True)
    path = CACHE_POWER / f"{site['id']}.json"
    if not path.exists():
        q = urllib.parse.urlencode({"parameters": "T2M_MIN,T2M_MAX,PRECTOTCORR", "community": "AG",
                                    "longitude": f"{site['lon']:.4f}", "latitude": f"{site['lat']:.4f}", "format": "JSON"})
        path.write_bytes(fetch(f"{POWER_URL}?{q}"))
        time.sleep(1)
    return json.loads(path.read_text())


def overpass(site: dict) -> list[dict]:
    CACHE_OSM.mkdir(parents=True, exist_ok=True)
    path = CACHE_OSM / f"{site['id']}.json"
    if not path.exists():
        types = "|".join(LODGING)
        query = f'[out:json][timeout:90];nwr(around:{int(RADIUS_KM * 1000)},{site["lat"]},{site["lon"]})["tourism"~"^({types})$"];out center tags;'
        path.write_bytes(fetch(OVERPASS_URL, urllib.parse.urlencode({"data": query}).encode()))
        time.sleep(2)  # Overpass etiquette
    return json.loads(path.read_text()).get("elements", [])


def git_commit() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return None


def main() -> None:
    reach = json.loads(REACHABLE.read_text())
    sites: dict[str, dict] = {}
    for d in reach["destinations"]:
        for w in [d["val004_twin"], *d["shortlist"]]:
            sites.setdefault(w["id"], {"id": w["id"], "lat": w["lat"], "lon": w["lon"]})
    out: dict[str, dict] = {}
    for i, s in enumerate(sites.values(), 1):
        rec: dict = {}
        try:
            rec["calendar"] = calendar(power(s))
        except Exception as e:  # recorded, never hidden
            rec["calendar"] = {"error": f"{type(e).__name__}: {e}"}
        try:
            rec["lodging"] = lodging(s["lat"], s["lon"], overpass(s))
        except Exception as e:
            rec["lodging"] = {"error": f"{type(e).__name__}: {e}"}
        out[s["id"]] = rec
        c, l = rec["calendar"], rec["lodging"]
        print(f"[{i}/{len(sites)}] {s['id']}: {c.get('workable_count', 'error')} workable months; "
              f"{l.get('within_50km', 'error')} lodgings within 50 km", flush=True)

    provenance = {"config": "config/campaign/logistics_v1.yaml", "commit": git_commit(),
                  "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                  "power": "NASA POWER climatology API, community AG, T2M_MIN / T2M_MAX / PRECTOTCORR",
                  "lodging": "OpenStreetMap via Overpass API, (c) OpenStreetMap contributors, ODbL", "sites": len(sites)}
    OUT_FULL.parent.mkdir(parents=True, exist_ok=True)
    OUT_FULL.write_text(json.dumps({"version": "campaign_v1.1", "provenance": provenance, "sites": out}, indent=1))
    OUT_WEB.write_text(json.dumps({"version": "campaign_v1.1", "run_at": provenance["run_at"], "sites": out}, separators=(",", ":")))
    print(f"Wrote {OUT_FULL.relative_to(ROOT)} and {OUT_WEB.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
