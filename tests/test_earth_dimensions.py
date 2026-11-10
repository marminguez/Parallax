"""Earth dimensions v1 runner: windows, B1 comparison, resume and predictions (no rasters needed)."""
import copy
import csv
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("earth_dimensions", ROOT / "scripts/earth_dimensions.py")
ed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ed)


@pytest.fixture(scope="module")
def windows():
    return ed.load_windows()


def test_index_is_the_eligible_val004_windows_at_4_decimals(windows):
    assert len(windows) == 42405
    assert all(round(w["lat"], 4) == w["lat"] and round(w["lon"], 4) == w["lon"] for w in windows)
    assert all(len(w["hist"]) == 8 for w in windows)


def test_every_twin_is_in_the_index_at_its_published_centre(windows):
    by_id = {w["id"]: w for w in windows}
    ts = ed.twins()
    assert len(ts) == 21 and len({t["id"] for t in ts}) == 21
    for t in ts:
        assert (by_id[t["id"]]["lat"], by_id[t["id"]]["lon"]) == (t["lat"], t["lon"])


def test_same_compares_at_published_precision():
    assert ed.same({"a": 0.1234, "v": "rural"}, {"a": 0.1234})
    assert ed.same({"a": 0.12340004}, {"a": 0.1234})
    assert not ed.same({"a": 0.1235}, {"a": 0.1234})
    assert not ed.same({"v": "remote"}, {"v": "rural"})
    assert not ed.same({"signal": 1}, {"signal": True})
    assert ed.same({"c": [-33.3, 31.1]}, {"c": [-33.3, 31.1]})
    assert not ed.same({}, {"a": 1})


@pytest.mark.parametrize("dim,key", [("access", "operations"), ("ground", "ground")])
def test_b1_view_accepts_published_values_and_rejects_changes(dim, key):
    t = ed.twins()[0]
    published = copy.deepcopy(t["sheet"]["dimensions"][key])
    new, old = ed.twin_view(dim, copy.deepcopy(published), t["sheet"], t["body"])
    assert ed.same(new, old)
    field = "population_mean_km2" if dim == "access" else "bare_share"
    published[field] += 0.01
    new, old = ed.twin_view(dim, published, t["sheet"], t["body"])
    assert not ed.same(new, old)


def test_b1_view_permafrost_uses_the_earth_side_only():
    t = ed.twins()[0]
    earth = copy.deepcopy(t["sheet"]["dimensions"]["ice"]["earth"])
    new, old = ed.twin_view("permafrost", earth, t["sheet"], t["body"])
    assert ed.same(new, old)


def test_run_is_resumable_and_retries_only_errors(tmp_path, monkeypatch, windows):
    monkeypatch.setattr(ed, "PARTIAL", tmp_path)
    calls = []

    def fake(dim, w, args):
        calls.append(w["id"])
        return {"status": "error", "reason": "x"} if w["id"] == "B" else {"status": "measured", "population_mean_km2": 1.0, "verdict": "rural"}

    monkeypatch.setattr(ed, "guarded", fake)
    ws = [{"id": i, "lat": 0.0, "lon": 0.0, "hist": [1] * 8} for i in "ABC"]
    args = type("A", (), {"workers": 2, "retry_errors": False})()
    ed.run_dimension("access", ws, args)
    assert sorted(calls) == ["A", "B", "C"]
    calls.clear()
    ed.run_dimension("access", ws, args)
    assert calls == []
    args.retry_errors = True
    ed.run_dimension("access", ws, args)
    assert calls == ["B"]
    assert ed.read_partial("access")["A"]["status"] == "measured"
    assert ed.complete("access", ["A", "B", "C"]) and not ed.complete("access", ["A", "D"])


def test_flat_leaves_not_measured_empty():
    assert ed.flat("ground", {"status": "not_measured"}) == {"bare_share": "", "vegetated_share": "", "snow_ice_share": "", "dominant_class": ""}
    assert ed.flat("permafrost", {"status": "measured", "pzi_share": 0.3, "signal": True}) == {"pzi_share": 0.3, "ice_signal": "true"}
    assert ed.flat("rock", {"status": "measured", "classes": {"ss": 0.6, "mt": 0.4}}) == {"glim": "ss:0.6;mt:0.4"}
    assert ed.reason({"status": "error", "reason": "timeout"}) == "error: timeout"


def test_shackleton_strong_twins_match_campaign_count(windows):
    assert len(ed.shackleton_strong_twins(windows)) == 1769


def test_predictions_only_for_complete_dimensions():
    rows = [{"id": str(i), "bare_share": 0.6 if i < 10 else 0.1, "ice_signal": "false", "access": "remote" if i < 30 else "rural"}
            for i in range(100)]
    p = ed.predictions(rows, [], {"ground", "access"})
    assert p["P1_bare"] == {"value": 0.1, "supported": True}
    assert p["P3_remote"] == {"value": 0.3, "supported": True}
    assert "P2_permafrost" not in p and "P4_drilling" not in p


def test_frozen_files_are_consistent():
    import yaml

    cfg = yaml.safe_load(ed.CONFIG.read_text())
    amend = yaml.safe_load(ed.AMENDMENT.read_text())
    assert cfg["version"] == "earth_dimensions_v1" and amend["amends"] == "earth_dimensions_v1.yaml"
    assert amend["made_after_seeing_results"] is False
    assert "0.29885" in cfg["predictions"]["P4_drilling"] and ed.STRONG == 0.29885
