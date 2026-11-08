"""Campaign v1 helpers (scripts/reachable_twins.py)."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import numpy as np
import yaml

from parallax.matching.similarity import jensen_shannon_distance

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("reachable_twins", ROOT / "scripts/reachable_twins.py")
rt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rt)


def test_vectorised_distance_equals_reference():
    rng = np.random.default_rng(4)
    p = rng.random(8)
    Q = rng.random((50, 8))
    Q[3, :4] = 0  # empty bins must not break the maths
    d = rt.js_distances(p, Q)
    for i in range(len(Q)):
        assert abs(d[i] - jensen_shannon_distance(p, Q[i])) < 1e-12


def test_constants_follow_frozen_config():
    cfg = yaml.safe_load((ROOT / "config/campaign/reachable_twins_v1.yaml").read_text())
    assert cfg["reachability"]["bands_km"] == [100, 250]
    assert rt.REACHABLE_KM == 100 and rt.BANDS_KM == (100, 250) and rt.SHORTLIST == 10
    assert rt.AIRPORTS_COMMIT in cfg["reachability"]["source"]
    assert "<= 100 km" in cfg["reachability"]["reachable"]


def test_bands_and_overlap():
    assert rt.band(100) == "near" and rt.band(100.1) == "mid" and rt.band(250) == "mid" and rt.band(251) == "far"
    a = {"lat": 0.0, "lon": 0.0}
    assert rt.overlaps(a, {"lat": 0.3, "lon": 0.0})       # 33 km apart
    assert not rt.overlaps(a, {"lat": 0.5, "lon": 0.0})   # 56 km apart
    assert rt.overlaps({"lat": 10, "lon": 179.9}, {"lat": 10, "lon": -179.9})  # across the antimeridian


def test_nearest_airport():
    idx, km = rt.haversine_min(np.array([0.0, 45.0]), np.array([0.0, 10.0]), np.array([0.0, 45.0, 1.0]), np.array([1.0, 10.5, 0.0]))
    assert list(idx) == [0, 1] or list(idx) == [2, 1]
    assert abs(km[0] - 111.2) < 0.5 and abs(km[1] - 39.3) < 0.5
