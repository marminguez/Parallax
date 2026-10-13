"""Precompute display-only place labels for the bundled measured index.

Writes web/data/earth-candidate-places.json keyed by candidate_id. Labels are
joined to ranked results by the web API and never affect ranking.

    python scripts/build_place_labels.py
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from parallax.places import ATTRIBUTION, METHOD, SOURCE, describe  # noqa: E402

INDEX = ROOT / "web" / "data" / "earth-candidates.csv"
OUTPUT = ROOT / "web" / "data" / "earth-candidate-places.json"


def main() -> None:
    places = {}
    with INDEX.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            place = describe(float(row["latitude_deg"]), float(row["longitude_deg"]))
            places[row["candidate_id"]] = {k: place[k] for k in ("nearest", "admin1", "countryCode", "distanceKm")}
    document = {"source": SOURCE, "attribution": ATTRIBUTION, "method": METHOD, "places": places}
    OUTPUT.write_text(json.dumps(document, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {len(places)} labels to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
