"""Campaign v1.1 rules (scripts/campaign_logistics.py)."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("campaign_logistics", ROOT / "scripts/campaign_logistics.py")
cl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cl)


def test_constants_follow_frozen_config():
    cfg = yaml.safe_load((ROOT / "config/campaign/logistics_v1.yaml").read_text())
    assert cfg["calendar"]["workable_month"] == "T2M_MIN >= -10 C and T2M_MAX <= 35 C and PRECTOTCORR <= 3 mm/day"
    assert (cl.T_MIN, cl.T_MAX, cl.RAIN_MAX) == (-10.0, 35.0, 3.0)
    assert cfg["lodging"]["radius_km"] == cl.RADIUS_KM == 50
    for t in cl.LODGING:
        assert t in cfg["lodging"]["features"]


def test_workable_edges():
    assert cl.workable(-10, 35, 3)
    assert not cl.workable(-10.1, 20, 1)
    assert not cl.workable(0, 35.1, 1)
    assert not cl.workable(0, 20, 3.01)


def _payload(tmin, tmax, rain):
    p = {k: {m: v for m in cl.MONTHS} for k, v in (("T2M_MIN", tmin), ("T2M_MAX", tmax), ("PRECTOTCORR", rain))}
    return {"header": {"fill_value": -999.0}, "properties": {"parameter": p}}


def test_calendar_counts_and_rejects_fill():
    assert cl.calendar(_payload(2, 20, 1))["workable_count"] == 12
    assert cl.calendar(_payload(-20, 5, 1))["workable_count"] == 0
    with pytest.raises(ValueError):
        cl.calendar(_payload(-999, 20, 1))


def test_lodging_bands_and_nearest():
    lat, lon = 40.0, -3.0
    els = [
        {"lat": 40.1, "lon": -3.0, "tags": {"tourism": "hotel", "name": "A"}},           # ~11 km
        {"center": {"lat": 40.3, "lon": -3.0}, "tags": {"tourism": "camp_site"}},          # ~33 km
        {"lat": 41.0, "lon": -3.0, "tags": {"tourism": "hostel"}},                         # ~111 km: outside
        {"lat": 40.05, "lon": -3.0, "tags": {"tourism": "museum"}},                        # not lodging
    ]
    out = cl.lodging(lat, lon, els)
    assert out["within_25km"] == 1 and out["within_50km"] == 2 and out["band"] == "in_reach"
    assert out["nearest"]["name"] == "A" and out["nearest"]["type"] == "hotel"
    assert cl.lodging(lat, lon, els[1:2])["band"] == "day_trip"
    assert cl.lodging(lat, lon, [])["band"] == "none_mapped"
