"""Campaign v1.2 rules (scripts/campaign_field.py)."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("campaign_field", ROOT / "scripts/campaign_field.py")
cf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cf)


def test_constants_follow_frozen_config():
    cfg = yaml.safe_load((ROOT / "config/campaign/field_v1.yaml").read_text())
    assert cfg["version"] == "campaign_v1.2"
    assert cfg["altitude"]["band_on"] == "median"
    assert [b for b, _ in cf.ALT_BANDS] == [2500.0, 3500.0, 5500.0]
    assert cfg["services"]["hospital"]["radius_km"] == cf.HOSPITAL_KM == 100
    assert cfg["services"]["fuel"]["radius_km"] == cfg["services"]["supermarket"]["radius_km"] == cf.SHOP_KM == 50
    for c in cf.ROAD_CLASSES:
        assert c.replace("_link", "") in cfg["road_access"]["road_classes"]
    assert cf.ROAD_RADII_KM == (2.0, 10.0, 25.0)
    assert "-0.833" in cfg["daylight"]["source"] and cf.SUN_ALT_DEG == -0.833


def test_altitude_bands_and_summary():
    assert [cf.altitude_band(v) for v in (0, 2499.9, 2500, 3499, 3500, 5499, 5500)] == \
        ["low", "low", "high", "high", "very_high", "very_high", "extreme"]
    s = cf.elevation_summary(np.array([1000, 3000, np.nan, 4000, 2000.0]), 2900.4)
    assert s == {"centre_m": 2900, "median_m": 2500, "p90_m": 3700, "max_m": 4000, "band": "high"}
    assert cf.elevation_summary(np.array([10.0]), None)["centre_m"] is None
    with pytest.raises(ValueError):
        cf.elevation_summary(np.array([np.nan]), None)


def test_daylight():
    eq = cf.daylight(0.0)
    assert all(12.0 <= h <= 12.3 for h in eq)                  # refraction adds a few minutes at the equator
    north = cf.daylight(45.0)
    assert north[5] > 15 and north[11] < 9.5                    # June long, December short
    south = cf.daylight(-30.0)
    assert south[5] < south[11]                                  # seasons flip in the south
    assert cf.day_length_h(80.0, 172) == 24.0 and cf.day_length_h(80.0, 355) == 0.0


def test_services_nearest_and_radii():
    lat, lon = 10.0, 20.0
    el = [
        {"type": "node", "lat": 10.5, "lon": 20.0, "tags": {"amenity": "hospital", "name": "Far"}},       # ~55.6 km
        {"type": "way", "center": {"lat": 10.1, "lon": 20.0}, "tags": {"amenity": "hospital", "name": "Near"}},
        {"type": "node", "lat": 11.0, "lon": 20.0, "tags": {"amenity": "hospital"}},                       # ~111 km: out
        {"type": "node", "lat": 10.6, "lon": 20.0, "tags": {"amenity": "fuel"}},                           # ~67 km: out
        {"type": "node", "lat": 10.2, "lon": 20.0, "tags": {"shop": "supermarket", "name": "Shop"}},
        {"type": "node", "tags": {"amenity": "fuel"}},                                                      # no position
    ]
    s = cf.services(lat, lon, el)
    assert s["hospital"]["name"] == "Near" and abs(s["hospital"]["km"] - 11.1) < 0.1
    assert s["hospitals_within_100km"] == 2
    assert s["fuel"] is None
    assert s["supermarket"]["name"] == "Shop"


def _way(cls, pts):
    return {"type": "way", "tags": {"highway": cls}, "geometry": [{"lat": a, "lon": b} for a, b in pts]}


def test_nearest_way_uses_segments():
    # a road running east-west 0.01 deg (~1.11 km) north of the point, with vertices far to either side
    w = _way("primary", [(0.01, -1.0), (0.01, 1.0)])
    d = cf.nearest_way_km(0.0, 0.0, [w], cf.ROAD_CLASSES)
    assert abs(d - 1.11) < 0.01
    assert cf.nearest_way_km(0.0, 0.0, [w], cf.TRACK_CLASSES) is None


def test_road_access_bands():
    road = _way("tertiary", [(0.01, -1), (0.01, 1)])          # 1.1 km
    track = _way("track", [(0.005, -1), (0.005, 1)])          # 0.6 km
    far = _way("secondary", [(0.07, -1), (0.07, 1)])          # 7.8 km
    assert cf.road_access({2.0: [road, track]}, 0, 0) == {"band": "road", "road_km": 1.1, "track_km": 0.6, "searched_km": 2.0}
    r = cf.road_access({2.0: [track], 10.0: [far]}, 0, 0)
    assert r == {"band": "track", "road_km": 7.8, "track_km": 0.6, "searched_km": 10.0}
    r = cf.road_access({2.0: [], 10.0: [], 25.0: []}, 0, 0)
    assert r == {"band": "off_road", "road_km": None, "track_km": None, "searched_km": 25.0}


def test_every_campaign_country_has_numbers():
    numbers = yaml.safe_load((ROOT / "config/campaign/emergency_numbers.yaml").read_text())
    reach = json.loads((ROOT / "results/campaign/reachable_twins_v1.json").read_text())
    countries = {w["place"]["countryCode"] for d in reach["destinations"] for w in [d["val004_twin"], *d["shortlist"]]}
    assert countries <= set(numbers), sorted(countries - set(numbers))
    for code, n in numbers.items():
        assert set(n) <= {"general", "police", "ambulance", "fire", "extra"}, code
        assert n.get("general") or n.get("police") or n.get("ambulance"), code


def test_window_elevation_reads_a_local_tile(tmp_path):
    rasterio = pytest.importorskip("rasterio")
    from rasterio.transform import from_origin

    name = "Copernicus_DSM_COG_10_N36_00_E074_00_DEM"
    n = 3600
    rows = np.arange(n, dtype="float32")[:, None]
    data = np.repeat(4000 - rows / 3, n, axis=1).astype("float32")   # 4000 m at the north edge, falling south
    with rasterio.open(tmp_path / f"{name}.tif", "w", driver="GTiff", width=n, height=n, count=1, dtype="float32",
                       crs="EPSG:4326", transform=from_origin(74.0, 37.0, 1 / 3600, 1 / 3600)) as dst:
        dst.write(data, 1)
    values, centre = cf.window_elevation(36.5, 74.5, str(tmp_path))
    assert values.size > 1000
    assert abs(centre - (4000 - 1800 / 3)) < 1
    s = cf.elevation_summary(values, centre)
    assert s["band"] == "high" and abs(s["median_m"] - 3400) < 15


def test_overpass_falls_back_to_mirrors_and_records_endpoint(tmp_path, monkeypatch):
    calls = []

    def fake_fetch(url, data=None, tries=4):
        calls.append(url)
        if url == cf.OVERPASS_URLS[0]:
            raise RuntimeError("Network is unreachable")
        return json.dumps({"elements": [{"type": "node", "lat": 1, "lon": 2}]}).encode()

    monkeypatch.setattr(cf, "fetch", fake_fetch)
    monkeypatch.setattr(cf.time, "sleep", lambda s: None)
    cache = tmp_path / "x.json"
    assert cf.overpass(cache, "q") == [{"type": "node", "lat": 1, "lon": 2}]
    assert calls == list(cf.OVERPASS_URLS[:2])
    assert cf.endpoint_of(cache) == cf.OVERPASS_URLS[1]
    assert cf.overpass(cache, "q") and len(calls) == 2, "served from cache"

    monkeypatch.setattr(cf, "fetch", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("down")))
    with pytest.raises(RuntimeError):
        cf.overpass(tmp_path / "y.json", "q")
    assert not (tmp_path / "y.json").exists(), "failures are never cached"
    cfg = yaml.safe_load((ROOT / "config/campaign/field_v1.yaml").read_text())
    assert str(cfg["amendments"][0]["date"]) == "2026-11-09"
