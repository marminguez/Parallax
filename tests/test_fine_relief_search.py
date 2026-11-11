"""Fine relief for search results v1: selection, F1 comparison and predictions (no network)."""
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("fine_relief_search", ROOT / "scripts/fine_relief_search.py")
fr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fr)


@pytest.fixture(scope="module")
def setup():
    index = fr.load_index()
    refs = fr.references()
    return index, refs, fr.selection(index, refs)


def test_eleven_references_with_published_60m_fingerprints(setup):
    _, refs, _ = setup
    assert len(refs) == 11 and sum(r["body"] == "moon" for r in refs.values()) == 10
    sheets = json.loads(fr.SHEETS.read_text())["sheets"]
    for r in refs.values():
        planet = sheets[r["sheet"]]["dimensions"]["fine_relief"]["planet"]
        assert planet["histogram"] and planet["valid_share"] >= 0.9


def test_selection_is_the_frozen_union(setup):
    index, refs, why = setup
    assert len(why) == 538
    assert sum(t.startswith("top_50:") for v in why.values() for t in v) == 550
    assert sum(t.startswith("top_50_drilling:") for v in why.values() for t in v) == 500
    assert set(fr.twin_ids().values()) <= set(why)


def test_lunar_top_result_is_the_published_twin(setup):
    index, refs, _ = setup
    artemis = {r["id"]: r["twin"] for r in json.loads(fr.ARTEMIS.read_text())["regions"]}
    for rid, twin in artemis.items():
        assert fr.rank(index, rid, refs[rid])[0] == twin


def test_drilling_set_only_holds_bare_frozen_ground(setup):
    index, refs, _ = setup
    by_id = {w["id"]: w for w in index}
    for i in fr.rank(index, "nobile-rim-1", refs["nobile-rim-1"], drilling=True):
        assert by_id[i]["bare"] >= 0.5 and by_id[i]["ice"] is True


def test_same_and_predictions():
    assert fr.same({"histogram": [0.1, 0.9], "steep_share": 0.5}, {"histogram": [0.1, 0.9], "steep_share": 0.5})
    assert not fr.same({"steep_share": 0.51}, {"steep_share": 0.5})
    assert fr.same({"histogram": None}, {"histogram": None})
    refs = {"jezero": {"body": "mars"}, "shackleton": {"body": "moon"}, "haworth": {"body": "moon"}}
    m = lambda v: {"status": "measured", "verdict": v}
    pairs = {"A": {"jezero": m("partly"), "shackleton": m("breaks"), "haworth": m("partly")},
             "B": {"jezero": m("breaks"), "shackleton": m("breaks"), "haworth": {"status": "not_measured"}}}
    why = {"A": ["top_50:jezero"], "B": ["top_50:jezero"]}
    p = fr.predictions(pairs, why, refs)
    assert p["P1_moon_rarely_holds"] == {"pairs": 3, "holds": 0, "share": 0.0, "supported": True}
    assert p["P2_moon_somewhere_partly"]["references"] == ["haworth"]
    assert p["P3_jezero_holds"] == {"measured": 2, "holds_or_partly": 1, "supported": True}
