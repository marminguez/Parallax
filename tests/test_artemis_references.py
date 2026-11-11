"""Artemis references v1: frozen config, outputs and check C1 (no rasters needed)."""
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]


def test_config_windows_are_the_val004_windows():
    cfg = yaml.safe_load((ROOT / "config/search/artemis_references_v1.yaml").read_text())
    sites = {d["id"]: d for d in json.loads((ROOT / "web/data/val004-sites.json").read_text())["destinations"]}
    regions = cfg["references"]["regions"]
    assert len(regions) == 9
    for r in regions:
        assert sites[r["id"]]["window"] == r["window"]
        assert sites[r["id"]]["body"] == "moon"


def test_run_passed_c1_and_records_p1():
    run = json.loads((ROOT / "results/artemis_references/run_v1.json").read_text())
    assert run["C1"]["pass"] is True
    assert len(run["C1"]["regions"]) == 9
    assert all(v["first"] == v["published_twin"] for v in run["C1"]["regions"].values())
    assert run["P1"]["supported"] == (run["P1"]["regions_with_at_least_5"] >= 7)


def test_references_keep_the_window_histogram():
    import csv
    with (ROOT / "results/val004/moon_windows.csv").open() as f:
        moon = {r["id"]: r for r in csv.DictReader(f)}
    bins = ["0-1", "1-2", "2-3", "3-5", "5-10", "10-15", "15-20", ">=20"]
    for r in json.loads((ROOT / "web/data/artemis-references.json").read_text())["regions"]:
        ref = json.loads((ROOT / f"web/data/artemis/{r['id']}.json").read_text())
        pct = ref["terrain"]["1000m"]["slope"]["distribution_pct"]
        w = moon[r["window"]]
        total = sum(float(w[b]) for b in bins)
        for b in bins:
            assert abs(pct[b] - 100 * float(w[b]) / total) < 1e-5
