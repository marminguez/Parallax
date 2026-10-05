"""PARALLAX EXP-001B — Blind Discovery Pilot #1."""

import csv
import json
import time
from pathlib import Path

from parallax.data.srtmgl30 import (
    iter_candidate_centers,
    physical_window_bounds,
)
from evaluate_candidate import evaluate_candidate


STRIDE = 690

OUTPUT_DIR = Path(
    "results/exp001/blind_discovery_pilot_001"
)

RESULTS_CSV = OUTPUT_DIR / "results.csv"
ERRORS_CSV = OUTPUT_DIR / "errors.csv"
SUMMARY_JSON = OUTPUT_DIR / "summary.json"


def crosses_antimeridian(
    latitude_deg: float,
    longitude_deg: float,
) -> bool:
    west, _, east, _ = physical_window_bounds(
        latitude_deg,
        longitude_deg,
        window_m=50_000.0,
    )

    return west < -180.0 or east > 180.0


def main() -> None:
    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    sampled = [
        candidate
        for index, candidate
        in enumerate(iter_candidate_centers())
        if index % STRIDE == 0
    ]

    results = []
    errors = []
    skipped_antimeridian = 0

    start = time.perf_counter()

    print(
        f"PARALLAX Blind Discovery Pilot #1\n"
        f"Sampled candidates: {len(sampled)}\n"
        f"Stride: {STRIDE}\n"
    )

    for position, (
        candidate_id,
        latitude_deg,
        longitude_deg,
    ) in enumerate(sampled, start=1):

        if crosses_antimeridian(
            latitude_deg,
            longitude_deg,
        ):
            skipped_antimeridian += 1
            continue

        try:
            result = evaluate_candidate(
                latitude_deg,
                longitude_deg,
            )

            results.append({
                "candidate_id": candidate_id,
                "latitude_deg": latitude_deg,
                "longitude_deg": longitude_deg,
                "jsd": result[
                    "similarity"
                ]["distance"],
                "land_fraction": result[
                    "land_eligibility"
                ]["land_fraction"],
                "land_status": result[
                    "land_eligibility"
                ]["status"],
                "slope_mean_deg": result[
                    "slope"
                ]["mean_deg"],
                "slope_p50_deg": result[
                    "slope"
                ]["p50_deg"],
                "slope_p90_deg": result[
                    "slope"
                ]["p90_deg"],
                "slope_p95_deg": result[
                    "slope"
                ]["p95_deg"],
            })

        except Exception as exc:
            message = str(exc)

            ocean_rejection = (
                "Slope array contains no finite values"
                in message
                or
                "Local MOD44W water mask is missing"
                in message
            )

            if ocean_rejection:
                results.append({
                    "candidate_id": candidate_id,
                    "latitude_deg": latitude_deg,
                    "longitude_deg": longitude_deg,
                    "jsd": float("inf"),
                    "land_fraction": 0.0,
                    "land_status": "REJECTED",
                    "slope_mean_deg": float("nan"),
                    "slope_p50_deg": float("nan"),
                    "slope_p90_deg": float("nan"),
                    "slope_p95_deg": float("nan"),
                })
            else:
                errors.append({
                    "candidate_id": candidate_id,
                    "latitude_deg": latitude_deg,
                    "longitude_deg": longitude_deg,
                    "error": message,
                })

        if position % 100 == 0:
            elapsed = time.perf_counter() - start

            print(
                f"{position}/{len(sampled)} "
                f"| valid={len(results)} "
                f"| errors={len(errors)} "
                f"| elapsed={elapsed / 60:.1f} min"
            )

    elapsed = time.perf_counter() - start

    results.sort(
        key=lambda row: row["jsd"]
    )

    eligible = [
        row
        for row in results
        if row["land_status"] == "ELIGIBLE"
    ]

    eligible.sort(
        key=lambda row: row["jsd"]
    )

    fieldnames = [
        "candidate_id",
        "latitude_deg",
        "longitude_deg",
        "jsd",
        "land_fraction",
        "land_status",
        "slope_mean_deg",
        "slope_p50_deg",
        "slope_p90_deg",
        "slope_p95_deg",
    ]

    with RESULTS_CSV.open(
        "w",
        newline="",
    ) as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=fieldnames,
        )
        writer.writeheader()
        writer.writerows(results)

    with ERRORS_CSV.open(
        "w",
        newline="",
    ) as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "candidate_id",
                "latitude_deg",
                "longitude_deg",
                "error",
            ],
        )
        writer.writeheader()
        writer.writerows(errors)

    summary = {
        "experiment": "EXP-001B",
        "run": "Blind Discovery Pilot #1",
        "sampling": {
            "method": "deterministic systematic sample",
            "stride": STRIDE,
            "sampled_candidates": len(sampled),
        },
        "evaluated_candidates": len(results),
        "eligible_candidates": len(eligible),
        "errors": len(errors),
        "skipped_antimeridian": skipped_antimeridian,
        "elapsed_seconds": elapsed,
        "top_10_eligible": eligible[:10],
    }

    SUMMARY_JSON.write_text(
        json.dumps(
            summary,
            indent=2,
        )
    )

    print("\n--- COMPLETE ---")
    print(
        f"Evaluated: {len(results)}"
    )
    print(
        f"Eligible: {len(eligible)}"
    )
    print(
        f"Errors: {len(errors)}"
    )
    print(
        f"Skipped antimeridian: "
        f"{skipped_antimeridian}"
    )
    print(
        f"Elapsed: {elapsed / 60:.1f} min"
    )

    print("\nTOP 10 ELIGIBLE — LOWEST JSD")

    for rank, row in enumerate(
        eligible[:10],
        start=1,
    ):
        print(
            f"{rank:02d}. "
            f"{row['candidate_id']} "
            f"({row['latitude_deg']:.4f}, "
            f"{row['longitude_deg']:.4f}) "
            f"JSD={row['jsd']:.6f} "
            f"land={row['land_fraction']:.3f}"
        )


if __name__ == "__main__":
    main()
