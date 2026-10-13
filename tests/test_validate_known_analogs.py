import importlib.util
from pathlib import Path

import numpy as np
import pytest
import yaml

ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("validate_known_analogs", ROOT / "scripts/validate_known_analogs.py")
val = importlib.util.module_from_spec(spec)
spec.loader.exec_module(val)
CONFIG = yaml.safe_load((ROOT / "config/validation/known_analogs_v1.yaml").read_text(encoding="utf-8"))


def test_preregistration_is_complete_and_sourced():
    ids = [s["id"] for s in CONFIG["sites"]]
    assert len(ids) == len(set(ids)) == 11
    for s in CONFIG["sites"]:
        assert -90 <= s["lat"] <= 90 and -180 <= s["lon"] <= 180
        assert set(s["groups"]) <= {"mars", "moon"} and s["groups"]
        assert s["source_url"].startswith("https://") and s["coordinate_source"]
    assert CONFIG["frozen_on"] == "2026-10-13"
    assert set(CONFIG["hypotheses"]) >= {"H1", "H2"}


def test_percentile_and_auc_count_ties_half():
    null = np.array([0.1, 0.2, 0.3, 0.4])
    assert val.percentile(0.05, null) == 0.0
    assert val.percentile(0.2, null) == pytest.approx(0.375)
    assert val.percentile(0.9, null) == 1.0
    assert val.auc(np.array([0.05, 0.9]), null) == pytest.approx(0.5)


def test_permutation_p_detects_a_strong_signal_and_not_a_null_one():
    rng = np.random.default_rng(1)
    null = rng.uniform(0.2, 0.8, 300)
    assert val.permutation_p(np.array([0.1, 0.12, 0.15, 0.18]), null, n_permutations=2000) < 0.01
    assert val.permutation_p(np.array([0.5, 0.52, 0.48, 0.55]), null, n_permutations=2000) > 0.1
    assert np.isnan(val.permutation_p(np.array([0.1]), np.array([0.2])))


def test_overlap_matches_the_web_definition():
    assert val.windows_overlap((43, -3), (43.3, -3))       # ~33 km apart
    assert not val.windows_overlap((43, -3), (43.6, -3))   # ~67 km apart
    assert val.windows_overlap((0, 179.9), (0, -179.9))    # antimeridian


def fake_result(land=1.0, steep=False):
    h = [0, 0, 0, 0.1, 0.3, 0.3, 0.1, 0.2] if steep else [0.3, 0.3, 0.2, 0.1, 0.1, 0, 0, 0]
    return {"land_eligibility": {"land_fraction": land}, "slope": {"p95_deg": 25 if steep else 5, "mean_deg": 10 if steep else 2, "distribution": dict(zip(val.BINS, h))}}


def test_run_reports_every_site_and_never_drops_failures():
    sites = [
        {"id": "flat", "name": "Flat", "country": "XX", "lat": 10, "lon": 10, "groups": ["mars"], "used_for": "", "source_url": "https://x"},
        {"id": "steep", "name": "Steep", "country": "XX", "lat": 20, "lon": 20, "groups": ["moon"], "used_for": "", "source_url": "https://x"},
        {"id": "coast", "name": "Coast", "country": "XX", "lat": 30, "lon": 30, "groups": ["mars", "moon"], "used_for": "", "source_url": "https://x"},
        {"id": "polar", "name": "Polar", "country": "XX", "lat": 75, "lon": 0, "groups": ["moon"], "used_for": "", "source_url": "https://x"},
        {"id": "broken", "name": "Broken", "country": "XX", "lat": 40, "lon": 40, "groups": ["mars"], "used_for": "", "source_url": "https://x"},
    ]
    def evaluator(lat, lon):
        if lat == 40:
            raise FileNotFoundError("tile missing")
        return fake_result(land=0.5 if lat == 30 else 1.0, steep=lat == 20)
    rng = np.random.default_rng(0)
    index = [{"id": f"w{i}", "lat": -40 + i * 0.7, "lon": 100 + i * 0.7, "hist": rng.dirichlet(np.ones(8))} for i in range(60)]
    index.append({"id": "near-flat", "lat": 10.1, "lon": 10.1, "hist": rng.dirichlet(np.ones(8))})
    targets = {"jezero": np.array([0.3, 0.3, 0.2, 0.1, 0.1, 0, 0, 0]), "shackleton": np.array([0, 0, 0, 0.1, 0.3, 0.3, 0.1, 0.2])}
    report = val.run({"id": "T", "coverage": {"srtmgl30_latitudes": [-55, 59]}, "sites": sites}, evaluator, index, targets)
    status = {s["id"]: s["status"] for s in report["sites"]}
    assert status == {"flat": "eligible", "steep": "eligible", "coast": "ineligible_land_fraction", "polar": "outside_coverage", "broken": "error"}
    assert report["null"]["excluded_overlapping_sites"] == 1
    assert report["analyses"]["mars_vs_jezero"]["sites"] == ["flat"]
    assert report["analyses"]["moon_vs_shackleton"]["sites"] == ["steep"]
    assert report["analyses"]["mars_vs_jezero"]["auc"] == 1.0  # identical histogram -> closer than every random window
    assert report["analyses"]["moon_vs_jezero"]["kind"] == "exploratory"
