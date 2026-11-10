"""Novelty v1: is each Earth twin a new analog site? (config/novelty/novelty_v1.yaml)

No network. Reads the three analog lists in config/validation/ and the twins in
results/campaign/reachable_twins_v1.json.

    python scripts/novelty.py

Outputs:
  results/novelty/novelty_v1.json   full record with provenance
  web/data/novelty.json             what the web page shows
"""
from __future__ import annotations

import json
import math
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config/novelty/novelty_v1.yaml"
REACHABLE = ROOT / "results/campaign/reachable_twins_v1.json"
OUT_FULL = ROOT / "results/novelty/novelty_v1.json"
OUT_WEB = ROOT / "web/data/novelty.json"
RADIUS_KM = 100.0   # frozen
R_KM = 6371.0088


def km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * R_KM * math.asin(math.sqrt(min(1.0, h)))


def load_known(cfg: dict) -> list[dict]:
    out = []
    for src in cfg["known_analogs"]:
        data = yaml.safe_load((ROOT / src["file"]).read_text(encoding="utf-8"))
        for s in data["sites"]:
            if s.get("lat") is None or s.get("lon") is None:
                continue
            out.append({"id": s["id"], "name": s["name"], "lat": float(s["lat"]), "lon": float(s["lon"]), "list": src["list"].split(":")[0]})
    return out


def classify(lat: float, lon: float, country: str, admin1: str, known: list[dict], undecidable: list[dict]) -> dict:
    """Nearest listed analog and the frozen verdict."""
    nearest = min(known, key=lambda k: km(lat, lon, k["lat"], k["lon"]))
    d = km(lat, lon, nearest["lat"], nearest["lon"])
    rec = {"nearest_known": {"id": nearest["id"], "name": nearest["name"], "list": nearest["list"], "km": round(d, 1)}}
    if d <= RADIUS_KM:
        rec["status"] = "known"
        return rec
    blockers = [u["name"] for u in undecidable if u["country"] == country and (not u.get("admin1") or u["admin1"] == admin1)]
    if blockers:
        rec["status"] = "undecided"
        rec["undecided_because"] = blockers
        return rec
    rec["status"] = "new"
    return rec


def git_commit() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return None


def main() -> None:
    cfg = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    assert cfg["rule"]["radius_km"] == RADIUS_KM
    known = load_known(cfg)
    undecidable = cfg["entries_without_coordinates"]["undecidable"]
    reach = json.loads(REACHABLE.read_text())
    sites: dict[str, dict] = {}
    for d in reach["destinations"]:
        for role, w in (("reverse_map_twin", d["val004_twin"]), ("reachable_twin", d["reachable_twin"])):
            if not w:
                continue
            rec = sites.setdefault(w["id"], {"id": w["id"], "lat": w["lat"], "lon": w["lon"], "place": w["place"], "twin_of": []})
            rec["twin_of"].append({"destination": d["id"], "name": d["name"], "body": d["body"], "role": role})
    for s in sites.values():
        s.update(classify(s["lat"], s["lon"], s["place"]["countryCode"], s["place"].get("admin1", ""), known, undecidable))

    counts = {k: sum(s["status"] == k for s in sites.values()) for k in ("new", "known", "undecided")}
    twins = [s for s in sites.values() if any(t["role"] == "reverse_map_twin" for t in s["twin_of"])]
    counts_twins = {k: sum(s["status"] == k for s in twins) for k in ("new", "known", "undecided")}
    provenance = {"config": "config/novelty/novelty_v1.yaml", "commit": git_commit(),
                  "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                  "known_sites": len(known), "radius_km": RADIUS_KM}
    OUT_FULL.parent.mkdir(parents=True, exist_ok=True)
    body = {"version": "novelty_v1", "provenance": provenance, "counts_all": counts, "counts_reverse_map_twins": counts_twins,
            "known_sites": known, "sites": sites}
    OUT_FULL.write_text(json.dumps(body, indent=1, ensure_ascii=False))
    OUT_WEB.write_text(json.dumps({"version": "novelty_v1", "radiusKm": RADIUS_KM, "knownSites": len(known),
                                   "counts": counts_twins,
                                   "destinations": {d["id"]: {"twin": d["val004_twin"]["id"], "reachable": (d["reachable_twin"] or {}).get("id")} for d in reach["destinations"]},
                                   "sites": {k: {x: v[x] for x in ("status", "nearest_known") if x in v} for k, v in sites.items()}},
                                  ensure_ascii=False, separators=(",", ":")))
    print(f"{len(known)} listed analogs; reverse-map twins: {counts_twins}; all sites: {counts}")
    for s in sorted(sites.values(), key=lambda s: s["nearest_known"]["km"]):
        names = ", ".join(t["name"] for t in s["twin_of"])
        print(f"  {s['status']:9} {s['nearest_known']['km']:7.0f} km  {s['place']['nearest'][:18]:18} {s['place']['countryCode']}  <- {names[:40]}  (nearest: {s['nearest_known']['name'][:40]}, {s['nearest_known']['list']})")


if __name__ == "__main__":
    main()
