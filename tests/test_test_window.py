"""Test window v1: frozen rules, runs across the year end, days and daylight."""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("tw", ROOT / "scripts/test_window.py")
tw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tw)


def test_general_is_logistics_rule():
    assert tw.general_month(-10.0, 35.0, 3.0) and not tw.general_month(-10.1, 20, 1) and not tw.general_month(0, 35.1, 1) and not tw.general_month(0, 20, 3.01)


def test_frozen_rule():
    assert tw.frozen_month(0.0, -25.0, 3.0) and not tw.frozen_month(0.1, -5, 1) and not tw.frozen_month(-5, -25.1, 1) and not tw.frozen_month(-5, -5, 3.5)


def test_runs_wrap_and_edges():
    f = [True, True, False, False, False, False, False, False, False, False, True, True]
    assert tw.runs(f) == [(10, 1)]
    assert tw.runs([True] * 12) == [(0, 11)] and tw.runs([False] * 12) == []
    g = [False, False, False, True, True, True, False, False, True, True, False, False]
    assert tw.runs(g) == [(3, 5), (8, 9)]
    w = tw.window(g, 40.0)
    assert w["runs"] == [["APR", "JUN"], ["SEP", "OCT"]] and w["days_per_year"] == 30 + 31 + 30 + 30 + 31 and w["longest_block_days"] == 91
    assert w["daylight_h"][0] < w["daylight_h"][1]
    assert tw.window([False] * 12, 40.0) == {"months": [], "runs": [], "days_per_year": 0, "longest_block_days": 0, "daylight_h": None}


def test_windows_skip_fill_values():
    m = {"T2M_MIN": [0.0] * 12, "T2M_MAX": [20.0] * 12, "PRECTOTCORR": [1.0] * 12, "TS": [-1.0] * 12}
    m["TS"][0] = -999.0
    w = tw.windows(m, 30.0)
    assert len(w["general"]["months"]) == 11 and "JAN" not in w["frozen"]["months"] and len(w["frozen"]["months"]) == 11


def test_w1_passes_offline():
    assert tw.check_w1()["pass"]
