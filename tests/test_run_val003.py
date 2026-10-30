import importlib.util
import sys
from pathlib import Path

import numpy as np
import pytest
import yaml

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("run_val003", ROOT / "scripts/run_val003.py")
val3 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(val3)
CONFIG = yaml.safe_load((ROOT / "config/validation/atlas_sites_v1.yaml").read_text(encoding="utf-8"))


def test_preregistration_freezes_the_external_list_and_model():
    assert CONFIG["id"] == "VAL-003" and CONFIG["frozen_on"] == "2026-10-13"
    assert len(CONFIG["sites"]) == 38
    assert CONFIG["site_list_source"]["commit"].startswith("4206f43")
    assert "0.5 * d1 + 0.5 * (1 - b)" in CONFIG["models"]["v2"]["distance"]
    assert set(CONFIG["hypotheses"]) >= {"H5", "H6", "H7"}
    assert all(s["source_url"].startswith("http") for s in CONFIG["sites"])


def cover(bare, coverage=1.0, status="available"):
    return {"status": status, "coverageFraction": coverage, "classes": [{"code": 60, "fractionOfWindow": bare * coverage}, {"code": 10, "fractionOfWindow": (1 - bare) * coverage}]}


def test_bare_fraction_requires_near_complete_coverage():
    assert val3.bare_fraction(cover(0.3)) == pytest.approx(0.3)
    assert val3.bare_fraction(cover(0.3, coverage=0.995, status="partial")) == pytest.approx(0.3)
    assert val3.bare_fraction(cover(0.3, coverage=0.9, status="partial")) is None
    assert val3.bare_fraction({"status": "error", "classes": []}) is None
    assert val3.bare_fraction(None) is None
    assert val3.bare_fraction({"status": "available", "coverageFraction": 1, "classes": [{"code": 10, "fractionOfWindow": 1}]}) == 0.0


def test_model_v2_is_the_frozen_equal_weight_mix():
    assert val3.model_distance("v1", 0.4, None) == 0.4
    assert val3.model_distance("v2", 0.4, 1.0) == pytest.approx(0.2)
    assert val3.model_distance("v2", 0.4, 0.0) == pytest.approx(0.7)
    assert val3.model_distance("v2", 0.4, None) is None


def test_tiles_match_the_existing_download_rule():
    assert val3.tiles_for_window(43.0, -3.0) == ["N42W003", "N42W006"]
    with pytest.raises(ValueError):
        val3.tiles_for_window(0, 179.9)


def test_paired_bootstrap_detects_improvement():
    rng = np.random.default_rng(0)
    null = rng.uniform(0.2, 0.8, 200)
    better = val3.paired_bootstrap(np.full(10, 0.5), np.full(10, 0.25), null, null, n=2000)
    assert better["difference"] > 0 and better["ci95"][0] > 0
    same = val3.paired_bootstrap(np.full(10, 0.5), np.full(10, 0.5), null, null, n=2000)
    assert same["difference"] == 0
    assert val3.paired_bootstrap(np.array([]), np.array([]), null, null) == {"n_sites": 0}


def test_site_classification_follows_the_rule_not_judgement():
    earlier = [{"id": "x", "lat": 38.41, "lon": -110.79}]
    sites = val3.classify_sites(CONFIG, earlier)
    by_id = {s["id"]: s for s in sites}
    assert by_id["haughton-hmp"]["status"] == "outside_coverage"
    assert by_id["neemo-aquarius"]["status"] == "excluded_facility"
    assert by_id["mdrs"]["status"] == "candidate" and by_id["mdrs"]["overlaps_earlier_validation"] == ["x"]
    assert sum(s["status"] == "candidate" for s in sites) == 28


def test_analysis_runs_end_to_end_on_synthetic_data():
    rng = np.random.default_rng(1)
    flat = np.array([0.4, 0.3, 0.15, 0.1, 0.05, 0, 0, 0])
    index = [{"id": f"w{i}", "lat": -40 + i, "lon": 100 + i, "hist": rng.dirichlet(np.ones(8)), "bare": float(rng.uniform(0, 0.3))} for i in range(60)]
    targets = {"jezero": flat, "shackleton": np.array([0, 0, 0, 0.1, 0.3, 0.3, 0.1, 0.2])}
    for w in index:
        w["slope_distance"] = {t: val3.jensen_shannon_distance(h, w["hist"]) for t, h in targets.items()}
    sites = []
    for i in range(6):
        s = {"id": f"s{i}", "lat": 10 + i * 2, "lon": 10, "analog_for": ["mars", "moon"], "themes": ["arid"], "status": "eligible", "overlaps_earlier_validation": [] if i % 2 else ["y"], "bare": 0.8}
        s["slope_distance"] = {t: val3.jensen_shannon_distance(h, flat) for t, h in targets.items()}
        sites.append(s)
    result = val3.analyse(CONFIG, sites, index)
    a = result["analyses"]
    assert a["all_mars_vs_jezero_v2"]["auc"] == 1.0 and a["all_mars_vs_jezero_v2"]["kind"] == "primary"
    assert a["all_mars_v2_minus_v1"]["n_sites"] == 6
    assert a["unseen_mars_vs_jezero_v1"]["n_sites"] == 3
    assert "atlas_theme_rule_jezero_v2" in a
