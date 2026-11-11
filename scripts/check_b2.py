"""Check B2 of config/search/earth_dimensions_v1.yaml: web distances equal the Python engine.

Draws 20 windows of web/data/earth-index.csv with seed 2026 and computes, with
parallax.matching.similarity.jensen_shannon_distance on the same (stored) histograms,
their distance to the frozen Jezero and Shackleton 1 km histograms. Writes
results/earth_dimensions/b2_v1.json; web/scripts/earth-index.test.mjs then checks the
web search gives the same distances within 1e-9.

    python scripts/check_b2.py
"""
from __future__ import annotations

import csv
import json
import random
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from parallax.matching.similarity import jensen_shannon_distance  # noqa: E402

BINS = ["0-1", "1-2", "2-3", "3-5", "5-10", "10-15", "15-20", ">=20"]
INDEX = ROOT / "web/data/earth-index.csv"
TARGETS = {"jezero": ROOT / "web/data/jezero-target.json", "shackleton": ROOT / "web/data/shackleton-target.json"}
OUT = ROOT / "results/earth_dimensions/b2_v1.json"
SEED, N, TOL = 2026, 20, 1e-9


def target_hist(path: Path) -> np.ndarray:
    pct = json.loads(path.read_text())["terrain"]["1000m"]["slope"]["distribution_pct"]
    return np.array([pct[b] for b in BINS], dtype=float)


def main() -> None:
    with INDEX.open(newline="") as f:
        rows = {r["id"]: np.array([float(r[b]) for b in BINS]) for r in csv.DictReader(f)}
    ids = random.Random(SEED).sample(sorted(rows), N)
    refs = {k: target_hist(p) for k, p in TARGETS.items()}
    windows = [{"id": i, **{k: float(jensen_shannon_distance(ref, rows[i])) for k, ref in refs.items()}} for i in ids]
    OUT.write_text(json.dumps({"check": "B2_index_distance", "config": "config/search/earth_dimensions_v1.yaml", "seed": SEED,
                               "tolerance": TOL, "python": "parallax.matching.similarity.jensen_shannon_distance",
                               "windows": windows}, indent=1))
    print(f"Wrote {len(windows)} Python distances to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
