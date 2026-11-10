"""Novelty v1 rule (scripts/novelty.py)."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("novelty", ROOT / "scripts/novelty.py")
nv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nv)

KNOWN = [{"id": "a", "name": "Site A", "lat": 0.0, "lon": 0.0, "list": "VAL-001"},
         {"id": "b", "name": "Site B", "lat": 10.0, "lon": 10.0, "list": "VAL-003"}]
UNDECIDABLE = [{"name": "Ibn Battuta Centre sites", "country": "MA"}, {"name": "Formations in west Texas", "country": "US", "admin1": "Texas"}]


def test_frozen_radius_matches_config():
    cfg = yaml.safe_load((ROOT / "config/novelty/novelty_v1.yaml").read_text())
    assert cfg["rule"]["radius_km"] == nv.RADIUS_KM == 100


def test_known_new_and_boundary():
    r = nv.classify(0.5, 0.0, "XX", "", KNOWN, UNDECIDABLE)          # ~55.6 km from A
    assert r["status"] == "known" and r["nearest_known"]["id"] == "a" and abs(r["nearest_known"]["km"] - 55.6) < 0.2
    r = nv.classify(0.9, 0.0, "XX", "", KNOWN, UNDECIDABLE)          # ~100.1 km: just outside
    assert r["status"] == "new"
    r = nv.classify(0.899, 0.0, "XX", "", KNOWN, UNDECIDABLE)        # ~99.97 km: inside
    assert r["status"] == "known"


def test_undecidable_entries_block_new():
    assert nv.classify(31.0, -4.0, "MA", "Drâa-Tafilalet", KNOWN, UNDECIDABLE)["status"] == "undecided"
    assert nv.classify(31.0, -103.0, "US", "Texas", KNOWN, UNDECIDABLE)["status"] == "undecided"
    assert nv.classify(32.0, -107.0, "US", "New Mexico", KNOWN, UNDECIDABLE)["status"] == "new"


def test_lists_load_every_site_with_coordinates():
    cfg = yaml.safe_load((ROOT / "config/novelty/novelty_v1.yaml").read_text())
    known = nv.load_known(cfg)
    assert len(known) == 57
    assert {k["list"] for k in known} == {"VAL-001", "VAL-002", "VAL-003"}
