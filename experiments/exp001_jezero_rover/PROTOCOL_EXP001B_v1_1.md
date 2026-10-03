# EXP-001B — Blind Earth Discovery Protocol v1.1

## Amendment to v1.0

This document records a methodological clarification made after protocol
v1.0 was frozen and before any Earth candidate ranking was generated.

No Earth candidate scores, ranked coordinates, place names or expected
winners were inspected before this amendment.

All provisions of EXP-001B Protocol v1.0 remain unchanged except where
explicitly clarified below.

---

## Earth search domain clarification

Primary elevation source:

NASA SRTMGL30 V002

The primary discovery domain is explicitly restricted to the documented
SRTM observation latitude range:

56°S to 60°N

Candidate centers must also preserve the complete 50 km × 50 km search
footprint inside this latitude domain.

With a 25 km half-window, the nominal candidate-center latitude domain is
therefore approximately:

55.775170°S to 59.775170°N

The deterministic 25 km latitude lattice may terminate before the northern
limit when the next lattice position would exceed the permitted domain.

The longitude domain remains global:

180°W to 180°E

with periodic longitude wrapping at the antimeridian.

---

## Rationale

Inspection of the downloaded SRTMGL30 mosaics showed that all raster cells
contain numerical values, including regions outside the original SRTM
observation latitude range.

Therefore, raster NoData values cannot be used to infer the scientific
observation domain.

The observation-domain restriction must be applied explicitly.

This clarification prevents filled or otherwise non-observed high-latitude
terrain from entering the blind discovery search.

---

## Change-control status

Protocol version: 1.1

Change type:

Pre-ranking methodological clarification.

Primary similarity metric:

Unchanged.

Target fingerprint:

Unchanged.

50 km candidate footprint:

Unchanged.

25 km search stride:

Unchanged.

Land eligibility threshold:

Unchanged.

Blind discovery rules:

Unchanged.

Earth candidate rankings generated before this amendment:

None.
