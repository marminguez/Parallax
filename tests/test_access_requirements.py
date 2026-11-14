import importlib.util
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("access_requirements", ROOT / "scripts/access_requirements.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def build():
    return mod.build(yaml.safe_load((ROOT / "config/access/access_v1.yaml").read_text(encoding="utf-8")))


def test_tokens():
    assert mod.token("90") == "90"
    assert mod.token("visa required") == "vr"
    assert mod.token("-1") == "self"


def test_matrix_is_aligned_and_includes_french_guiana():
    d = build()
    assert "GF" in d["codes"]
    for p, row in d["passports"].items():
        assert len(row.split(",")) == len(d["codes"]), p
    gf = d["codes"].index("GF")
    assert d["passports"]["ES"].split(",")[gf] in {"vf", "self"} or d["passports"]["ES"].split(",")[gf].isdigit()


def test_every_country_and_site_cites_sources_when_it_says_something():
    d = build()
    for cc, c in d["countries"].items():
        if c.get("permits") or c.get("advisory") or c.get("overrideNote"):
            assert c["sources"], cc
    for sid, s in d["sites"].items():
        assert s["sources"] and s["es"] and s["en"], sid
