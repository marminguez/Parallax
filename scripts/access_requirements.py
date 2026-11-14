"""Access v1: entry rules by passport and paperwork notes per country and site.

No network. Reads config/access/access_v1.yaml and the vendored Passport Index
dataset (config/access/passport-index/), and writes what the web shows:

    python scripts/access_requirements.py

Output:
  web/data/access.json
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config/access/access_v1.yaml"
OUT_WEB = ROOT / "web/data/access.json"

# Dataset wording -> short token. A number means visa-free for that many days.
TOKENS = {
    "visa free": "vf",
    "visa on arrival": "voa",
    "e-visa": "ev",
    "eta": "eta",
    "visa required": "vr",
    "no admission": "no",
    "-1": "self",
}
# French Guiana is not in the dataset. It follows France's list of visa-exempt
# nationalities, but a Schengen visa is not valid there (see access_v1.yaml, GF).
COPY_COLUMN = {"GF": "FR"}


def token(raw: str) -> str:
    raw = raw.strip()
    if raw.isdigit():
        return raw
    if raw not in TOKENS:
        raise ValueError(f"unknown requirement {raw!r}")
    return TOKENS[raw]


def load_matrix(path: Path) -> tuple[list[str], dict[str, dict[str, str]]]:
    rows: dict[str, dict[str, str]] = {}
    with path.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.setdefault(r["Passport"], {})[r["Destination"]] = token(r["Requirement"])
    codes = sorted({d for row in rows.values() for d in row})
    return codes, rows


def bilingual(block: dict | None) -> dict | None:
    if not block:
        return None
    return {"es": block["es"], "en": block["en"]}


def build(cfg: dict) -> dict:
    codes, rows = load_matrix(ROOT / cfg["passport_index"]["file"])
    for new, src in COPY_COLUMN.items():
        for p, row in rows.items():
            row[new] = "self" if p == new else row.get(src, "vr")
        codes.append(new)
    codes.sort()
    passports = {p: ",".join(row.get(c, "") for c in codes) for p, row in sorted(rows.items())}

    countries, overrides = {}, {}
    for cc, c in (cfg.get("countries") or {}).items():
        out: dict = {"risk": c.get("risk", "unknown")}
        if c.get("advisory"):
            out["advisory"] = bilingual(c["advisory"])
        if c.get("permits"):
            out["permits"] = bilingual(c["permits"])
        if c.get("by_passport"):
            out["byPassport"] = {p: bilingual(v) for p, v in c["by_passport"].items()}
        vo = c.get("visa_overrides")
        if vo:
            overrides[cc] = {p: token(str(v)) for p, v in vo["passports"].items()}
            out["overrideNote"] = bilingual(vo["note"])
        out["sources"] = c.get("sources", [])
        countries[cc] = out

    sites = {}
    for sid, s in (cfg.get("sites") or {}).items():
        sites[sid] = {"level": s["level"], "es": s["es"], "en": s["en"], "sources": s.get("sources", [])}
        if s.get("passports"):
            sites[sid]["passports"] = s["passports"]

    regions = {k: {"level": r["level"], "es": r["es"], "en": r["en"], "sources": r.get("sources", [])}
               for k, r in (cfg.get("regions") or {}).items()}

    return {
        "version": cfg["version"],
        "researchedOn": str(cfg["researched_on"]),
        "passportIndex": {k: str(cfg["passport_index"][k]) for k in ("source", "commit", "commit_date", "licence")},
        "general": bilingual(cfg["general"]),
        "codes": codes,
        "passports": passports,
        "overrides": overrides,
        "countries": countries,
        "sites": sites,
        "regions": regions,
    }


def main() -> None:
    cfg = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    data = build(cfg)
    OUT_WEB.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(data['passports'])} passports x {len(data['codes'])} destinations, "
          f"{len(data['countries'])} countries, {len(data['sites'])} site notes, {len(data['regions'])} regions -> {OUT_WEB.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
