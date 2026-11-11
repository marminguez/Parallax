"""Display data for the earth dimensions index (config/search/earth_dimensions_v1.yaml).

Writes web/data/earth-index-extras.json, keyed by window id:
  places        nearest GeoNames settlement at the 4-decimal window centre (display only, never used to rank or filter)
  landFraction  land fraction already measured by VAL-004 (results/val004/earth_windows.csv), for the land threshold

No new measurement.

    python scripts/export_earth_index_extras.py
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from parallax.places import ATTRIBUTION, METHOD, SOURCE, describe  # noqa: E402

INDEX = ROOT / "web/data/earth-index.csv"
WINDOWS = ROOT / "results/val004/earth_windows.csv"
OUTPUT = ROOT / "web/data/earth-index-extras.json"


def main() -> None:
    with WINDOWS.open(newline="") as f:
        land = {r["id"]: round(float(r["land_fraction"]), 6) for r in csv.DictReader(f) if r["land_status"] == "ELIGIBLE"}
    places, fractions = {}, {}
    with INDEX.open(newline="") as f:
        for r in csv.DictReader(f):
            p = describe(float(r["lat"]), float(r["lon"]))
            places[r["id"]] = [p["nearest"], p["admin1"], p["countryCode"], p["distanceKm"]]
            fractions[r["id"]] = land[r["id"]]
    doc = {"source": SOURCE, "attribution": ATTRIBUTION, "method": METHOD,
           "placeFields": ["nearest", "admin1", "countryCode", "distanceKm"], "places": places, "landFraction": fractions}
    OUTPUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(places)} labels and land fractions to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
