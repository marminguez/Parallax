"""Export the 1 km slope histogram of every eligible window in the measured index.

With histograms stored, the web app can rank the same Earth windows against any
frozen planetary target (Jezero, Shackleton, …) without re-reading rasters.

Reproducibility check: the Jensen–Shannon distance to Jezero is recomputed from
each exported histogram and must match the frozen index value; otherwise the
script stops without writing.

Run from the repository root, with the local SRTMGL30 tiles and MOD44W masks
used for the EXP-001B pilot:

    python scripts/export_index_histograms.py
"""
from __future__ import annotations

import csv
import json
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

from parallax.matching.similarity import jensen_shannon_distance  # noqa: E402

INDEX = ROOT / "web/data/earth-candidates.csv"
OUTPUT = ROOT / "web/data/earth-slope-histograms.csv"
REPORT = ROOT / "results/exp002/index_histogram_export.json"
BINS = ("0-1", "1-2", "2-3", "3-5", "5-10", "10-15", "15-20", ">=20")
TOLERANCE = 1e-9


def jezero_histogram() -> np.ndarray:
    data = json.loads((ROOT / "results/exp001/jezero_target_50km_v0_4.json").read_text())
    values = np.array([data["terrain"]["1000m"]["slope"]["distribution_pct"][b] for b in BINS], dtype=float)
    return values / values.sum()


def main() -> None:
    from evaluate_candidate import evaluate_candidate

    with INDEX.open(encoding="utf-8", newline="") as handle:
        rows = [r for r in csv.DictReader(handle) if r["land_status"] == "ELIGIBLE"]
    reference = jezero_histogram()
    exported, mismatches = [], []
    start = time.perf_counter()
    for i, row in enumerate(rows, 1):
        result = evaluate_candidate(float(row["latitude_deg"]), float(row["longitude_deg"]))
        histogram = [result["slope"]["distribution"][b] for b in BINS]
        distance = jensen_shannon_distance(reference, np.array(histogram))
        difference = abs(distance - float(row["jsd"]))
        if difference > TOLERANCE:
            mismatches.append({"candidate_id": row["candidate_id"], "index_jsd": float(row["jsd"]), "recomputed_jsd": distance})
        exported.append([row["candidate_id"], *(f"{v:.17g}" for v in histogram)])
        if i % 25 == 0:
            print(f"{i}/{len(rows)} windows · {time.perf_counter() - start:.0f} s")
    if mismatches:
        print(json.dumps(mismatches[:10], indent=2))
        raise SystemExit(f"{len(mismatches)} windows do not reproduce the frozen Jezero distance. Nothing written.")
    with OUTPUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["candidate_id", *BINS])
        writer.writerows(exported)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps({
        "windows": len(exported),
        "jezero_jsd_reproduced": True,
        "tolerance": TOLERANCE,
        "bins_deg": BINS,
        "grid": "50 × 50 km local AEQD, 1 km, MOD44W land stencil (EXP-001B)",
        "seconds": round(time.perf_counter() - start, 1),
    }, indent=2) + "\n", encoding="utf-8")
    print(f"✓ {len(exported)} histograms written to {OUTPUT.relative_to(ROOT)}; Jezero distances reproduced.")


if __name__ == "__main__":
    main()
