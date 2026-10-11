"""Bounded on-demand terrain evaluation for the PARALLAX local web server."""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
import numpy as np
from evaluate_candidate import evaluate_candidate


def main():
    parser = argparse.ArgumentParser()
    for key in ("west", "east", "south", "north"):
        parser.add_argument("--" + key, type=float, required=True)
    args = parser.parse_args()
    if not all(math.isfinite(v) for v in vars(args).values()):
        parser.error("Bounds must be finite.")
    if not (-180 <= args.west < args.east <= 180 and -55 <= args.south < args.north <= 59):
        parser.error("Invalid bounds or outside supported SRTM latitude coverage.")
    if args.east - args.west > 10 or args.north - args.south > 10:
        parser.error("Maximum region size is 10 degrees per axis.")
    if not list(Path("data/earth/coarse/raw").glob("*.SRTMGL30.dem.zip")):
        raise FileNotFoundError("No SRTMGL30 tiles in data/earth/coarse/raw. Download the required DEM tiles first.")
    rows, errors = [], []
    # Nine cell-centres, not an exhaustive raster scan. Each uses a 50 km window.
    for y, lat in enumerate(np.linspace(args.south, args.north, 7)[1::2]):
        for x, lon in enumerate(np.linspace(args.west, args.east, 7)[1::2]):
            candidate_id = f"LIVE-{y}-{x}-{lat:.5f}-{lon:.5f}"
            try:
                r = evaluate_candidate(float(lat), float(lon))
                rows.append({
                    "id": candidate_id, "lat": float(lat), "lon": float(lon),
                    "jsd": r["similarity"]["distance"],
                    "landFraction": r["land_eligibility"]["land_fraction"],
                    "landStatus": r["land_eligibility"]["status"],
                    "slopeP95": r["slope"]["p95_deg"],
                    "slopeMean": r["slope"]["mean_deg"],
                    "sourceTiles": r["srtm"]["tiles"],
                    "waterMaskTile": r["land_eligibility"]["tile"],
                    "analysisGrid": r["metric_grid"],
                })
            except Exception as exc:
                errors.append({"id": candidate_id, "message": str(exc)})
    print(json.dumps({"rows": rows, "errors": errors}, allow_nan=False))


if __name__ == "__main__":
    main()
