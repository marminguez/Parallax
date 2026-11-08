"""Campaign planning v1.2: facts on the ground for the campaign sheet (config/campaign/field_v1.yaml).

For the same 209 sites as scripts/campaign_logistics.py:
  - altitude of the window (Copernicus DEM GLO-30, read at about 1 km)      -> acclimatization band
  - daylight hours per month (computed from latitude, no download)
  - nearest hospital, fuel station and supermarket (OpenStreetMap, Overpass API)
  - road access to the window centre (OpenStreetMap roads and tracks)
  - emergency numbers of the country (config/campaign/emergency_numbers.yaml)

Responses are cached in data/cache/ so a re-run only asks again for what failed.

    python scripts/campaign_field.py          # about 20-30 minutes the first time (polite pauses)

Outputs:
  results/campaign/field_v1.json     full record with provenance
  web/data/campaign-field.json       what the web page shows
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

import numpy as np
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

REACHABLE = ROOT / "results/campaign/reachable_twins_v1.json"
NUMBERS = ROOT / "config/campaign/emergency_numbers.yaml"
OUT_FULL = ROOT / "results/campaign/field_v1.json"
OUT_WEB = ROOT / "web/data/campaign-field.json"
CACHE_DEM = ROOT / "data/cache/elevation_campaign"
CACHE_SERVICES = ROOT / "data/cache/overpass_services"
CACHE_ROADS = ROOT / "data/cache/overpass_roads"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "Parallax-NASA-Space-Apps-2026/1.0 (research prototype)"
R_KM = 6371.0088

# frozen (config/campaign/field_v1.yaml)
ALT_BANDS = ((2500.0, "low"), (3500.0, "high"), (5500.0, "very_high"))   # below each bound; above the last: extreme
MID_MONTH_DOY = (15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349)
SUN_ALT_DEG = -0.833
HOSPITAL_KM, SHOP_KM = 100.0, 50.0
ROAD_CLASSES = ("motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential",
                "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link")
TRACK_CLASSES = ("track",)
NEAR_KM = 2.0
ROAD_RADII_KM = (2.0, 10.0, 25.0)
DEM_HALF_KM = 25.0
DEM_DECIMATE = 30


# ------------------------------------------------------------------ pure rules (tested)

def altitude_band(median_m: float) -> str:
    for bound, name in ALT_BANDS:
        if median_m < bound:
            return name
    return "extreme"


def elevation_summary(values: np.ndarray, centre_m: float | None) -> dict:
    v = np.asarray(values, dtype="float64")
    v = v[np.isfinite(v)]
    if v.size == 0:
        raise ValueError("no elevation values in the window")
    median = float(np.median(v))
    return {"centre_m": None if centre_m is None or not math.isfinite(centre_m) else round(centre_m),
            "median_m": round(median), "p90_m": round(float(np.percentile(v, 90))), "max_m": round(float(v.max())),
            "band": altitude_band(median)}


def day_length_h(lat: float, doy: int) -> float:
    """Hours with the Sun's centre above -0.833 deg on a given day of the year."""
    decl = math.radians(23.44) * math.sin(2 * math.pi * (284 + doy) / 365)
    phi = math.radians(lat)
    cos_w = (math.sin(math.radians(SUN_ALT_DEG)) - math.sin(phi) * math.sin(decl)) / (math.cos(phi) * math.cos(decl))
    if cos_w <= -1:
        return 24.0
    if cos_w >= 1:
        return 0.0
    return 2 * math.degrees(math.acos(cos_w)) / 15


def daylight(lat: float) -> list[float]:
    return [round(day_length_h(lat, d), 1) for d in MID_MONTH_DOY]


def km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * R_KM * math.asin(math.sqrt(min(1.0, h)))


def _point(e: dict) -> tuple[float, float] | None:
    la = e.get("lat", e.get("center", {}).get("lat"))
    lo = e.get("lon", e.get("center", {}).get("lon"))
    return None if la is None or lo is None else (la, lo)


def services(lat: float, lon: float, elements: list[dict]) -> dict:
    """Overpass elements -> nearest hospital (and count within 100 km), fuel station and supermarket."""
    found: dict[str, list[dict]] = {"hospital": [], "fuel": [], "supermarket": []}
    for e in elements:
        tags, p = e.get("tags", {}), _point(e)
        if p is None:
            continue
        kind = "hospital" if tags.get("amenity") == "hospital" else "fuel" if tags.get("amenity") == "fuel" \
            else "supermarket" if tags.get("shop") == "supermarket" else None
        if kind is None:
            continue
        d = km(lat, lon, *p)
        if d <= (HOSPITAL_KM if kind == "hospital" else SHOP_KM):
            found[kind].append({"name": tags.get("name") or tags.get("name:en"), "km": round(d, 1)})
    out: dict = {}
    for kind, items in found.items():
        items.sort(key=lambda f: f["km"])
        out[kind] = items[0] if items else None
    out["hospitals_within_100km"] = len(found["hospital"])
    return out


def _segment_km(lat: float, lon: float, a: dict, b: dict) -> float:
    """Distance from a point to a short segment, on a local equirectangular plane (km)."""
    kx = math.cos(math.radians(lat)) * math.pi * R_KM / 180
    ky = math.pi * R_KM / 180
    ax, ay = (a["lon"] - lon) * kx, (a["lat"] - lat) * ky
    bx, by = (b["lon"] - lon) * kx, (b["lat"] - lat) * ky
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / L2))
    return math.hypot(ax + t * dx, ay + t * dy)


def nearest_way_km(lat: float, lon: float, elements: list[dict], classes: tuple[str, ...]) -> float | None:
    best = None
    for e in elements:
        if e.get("type") != "way" or e.get("tags", {}).get("highway") not in classes:
            continue
        g = e.get("geometry") or []
        pts = [p for p in g if p and "lat" in p and "lon" in p]
        if len(pts) == 1:
            d = km(lat, lon, pts[0]["lat"], pts[0]["lon"])
            best = d if best is None or d < best else best
        for a, b in zip(pts, pts[1:]):
            d = _segment_km(lat, lon, a, b)
            best = d if best is None or d < best else best
    return best


def road_access(found: dict[float, list[dict]], lat: float, lon: float) -> dict:
    """found: search radius (km) -> Overpass ways from that search. Applies the frozen bands."""
    near = found.get(ROAD_RADII_KM[0], [])
    road = nearest_way_km(lat, lon, near, ROAD_CLASSES)
    track = nearest_way_km(lat, lon, near, TRACK_CLASSES)
    road = road if road is not None and road <= NEAR_KM else None
    track = track if track is not None and track <= NEAR_KM else None
    if road is not None:
        return {"band": "road", "road_km": round(road, 1), "track_km": None if track is None else round(track, 1), "searched_km": NEAR_KM}
    searched = NEAR_KM
    for r in ROAD_RADII_KM[1:]:
        if r not in found:
            break
        searched = r
        d = nearest_way_km(lat, lon, found[r], ROAD_CLASSES)
        if d is not None and d <= r:
            road = d
            break
    return {"band": "track" if track is not None else "off_road", "road_km": None if road is None else round(road, 1),
            "track_km": None if track is None else round(track, 1), "searched_km": searched}


def emergency(numbers: dict, country: str) -> dict | None:
    n = numbers.get(country)
    return dict(n) if n else None


# ------------------------------------------------------------------ network (cached)

def fetch(url: str, data: bytes | None = None, tries: int = 4) -> bytes:
    last: Exception | None = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"{url}: {last}")


def overpass(cache: Path, query: str) -> list[dict]:
    cache.parent.mkdir(parents=True, exist_ok=True)
    if not cache.exists():
        cache.write_bytes(fetch(OVERPASS_URL, urllib.parse.urlencode({"data": query}).encode()))
        time.sleep(2)  # Overpass etiquette
    return json.loads(cache.read_text()).get("elements", [])


def services_query(lat: float, lon: float) -> str:
    h, s = int(HOSPITAL_KM * 1000), int(SHOP_KM * 1000)
    return (f'[out:json][timeout:180];(nwr(around:{h},{lat},{lon})["amenity"="hospital"];'
            f'nwr(around:{s},{lat},{lon})["amenity"="fuel"];nwr(around:{s},{lat},{lon})["shop"="supermarket"];);out center tags;')


def roads_query(lat: float, lon: float, radius_km: float, with_tracks: bool) -> str:
    classes = "|".join(ROAD_CLASSES + (TRACK_CLASSES if with_tracks else ()))
    return f'[out:json][timeout:180];way(around:{int(radius_km * 1000)},{lat},{lon})["highway"~"^({classes})$"];out tags geom;'


def roads(site: dict) -> dict[float, list[dict]]:
    lat, lon = site["lat"], site["lon"]
    found: dict[float, list[dict]] = {}
    first = ROAD_RADII_KM[0]
    found[first] = overpass(CACHE_ROADS / f"{site['id']}_{int(first)}.json", roads_query(lat, lon, first, True))
    d = nearest_way_km(lat, lon, found[first], ROAD_CLASSES)
    if d is not None and d <= NEAR_KM:
        return found
    for r in ROAD_RADII_KM[1:]:
        found[r] = overpass(CACHE_ROADS / f"{site['id']}_{int(r)}.json", roads_query(lat, lon, r, False))
        d = nearest_way_km(lat, lon, found[r], ROAD_CLASSES)
        if d is not None and d <= r:
            break
    return found


def elevation(site: dict, tile_root: str | None = None) -> dict:
    """Window elevation at about 1 km from Copernicus GLO-30 (cached), plus the exact centre value."""
    CACHE_DEM.mkdir(parents=True, exist_ok=True)
    path = CACHE_DEM / f"{site['id']}.json"
    if path.exists():
        return json.loads(path.read_text())
    values, centre = window_elevation(site["lat"], site["lon"], tile_root)
    rec = elevation_summary(values, centre)
    path.write_text(json.dumps(rec))
    return rec


def window_elevation(lat: float, lon: float, tile_root: str | None = None) -> tuple[np.ndarray, float | None]:
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.windows import from_bounds

    from parallax.characterize import copernicus_tile_names, window_bounds_deg
    from parallax.characterize.sources import COPERNICUS_URL, GDAL_ENV, _vsi

    west, south, east, north = window_bounds_deg(lat, lon, half_km=DEM_HALF_KM)
    chunks, centre = [], None
    with rasterio.Env(**GDAL_ENV):
        for name in copernicus_tile_names(west, south, east, north):
            path = f"{tile_root.rstrip('/')}/{name}.tif" if tile_root else COPERNICUS_URL.format(name=name)
            try:
                with rasterio.open(_vsi(path)) as src:
                    b = src.bounds
                    w = from_bounds(max(west, b.left), max(south, b.bottom), min(east, b.right), min(north, b.top), src.transform)
                    w = w.round_offsets().round_lengths()
                    if w.width < 1 or w.height < 1:
                        continue
                    shape = (max(1, int(w.height) // DEM_DECIMATE), max(1, int(w.width) // DEM_DECIMATE))
                    arr = src.read(1, window=w, out_shape=shape, resampling=Resampling.average, masked=True)
                    chunks.append(arr.astype("float64").filled(np.nan).ravel())
                    if b.left <= lon < b.right and b.bottom <= lat < b.top:
                        v = next(src.sample([(lon, lat)], masked=True))[0]
                        centre = None if np.ma.is_masked(v) else float(v)
            except rasterio.errors.RasterioIOError:
                continue  # no tile here: ocean
    if not chunks:
        raise RuntimeError("no Copernicus GLO-30 tile covers this window")
    return np.concatenate(chunks), centre


def git_commit() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return None


def main() -> None:
    reach = json.loads(REACHABLE.read_text())
    numbers = yaml.safe_load(NUMBERS.read_text())
    sites: dict[str, dict] = {}
    for d in reach["destinations"]:
        for w in [d["val004_twin"], *d["shortlist"]]:
            sites.setdefault(w["id"], {"id": w["id"], "lat": w["lat"], "lon": w["lon"], "country": w["place"]["countryCode"]})
    out: dict[str, dict] = {}
    for i, s in enumerate(sites.values(), 1):
        rec: dict = {"daylight_h": daylight(s["lat"]), "emergency": emergency(numbers, s["country"])}
        for key, job in (("altitude", lambda: elevation(s)),
                         ("services", lambda: services(s["lat"], s["lon"], overpass(CACHE_SERVICES / f"{s['id']}.json", services_query(s["lat"], s["lon"])))),
                         ("road", lambda: road_access(roads(s), s["lat"], s["lon"]))):
            try:
                rec[key] = job()
            except Exception as e:  # recorded, never hidden; failed responses are not cached
                rec[key] = {"error": f"{type(e).__name__}: {e}"}
        out[s["id"]] = rec
        a, sv, r = rec["altitude"], rec["services"], rec["road"]
        hosp = (sv.get("hospital") or {}).get("km", "none") if "error" not in sv else "error"
        print(f"[{i}/{len(sites)}] {s['id']}: {a.get('median_m', 'error')} m ({a.get('band', '-')}); "
              f"hospital {hosp} km; access {r.get('band', 'error')}", flush=True)

    provenance = {"config": "config/campaign/field_v1.yaml", "commit": git_commit(),
                  "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                  "altitude": "Copernicus DEM GLO-30, public COGs on AWS Open Data, about 1 km",
                  "services_and_roads": "OpenStreetMap via Overpass API, (c) OpenStreetMap contributors, ODbL",
                  "emergency_numbers": "config/campaign/emergency_numbers.yaml (Wikipedia, read 2026-11-08)", "sites": len(sites)}
    errors = sum(1 for r in out.values() for k in ("altitude", "services", "road") if "error" in r[k])
    OUT_FULL.parent.mkdir(parents=True, exist_ok=True)
    OUT_FULL.write_text(json.dumps({"version": "campaign_v1.2", "provenance": provenance, "sites": out}, indent=1))
    OUT_WEB.write_text(json.dumps({"version": "campaign_v1.2", "run_at": provenance["run_at"], "sites": out}, separators=(",", ":")))
    print(f"Wrote {OUT_FULL.relative_to(ROOT)} and {OUT_WEB.relative_to(ROOT)} ({errors} errors; re-run to retry them)")


if __name__ == "__main__":
    main()
