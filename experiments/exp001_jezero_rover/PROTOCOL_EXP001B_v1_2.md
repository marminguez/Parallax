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

---

# Amendment v1.2 — MOD44W Granule Availability Semantics

## Purpose

Clarify how official MOD44W V061 granule availability is interpreted when
computing terrestrial land eligibility.

This clarification is frozen before any Earth candidate ranking is generated.

---

## Official MOD44W inventory

The MOD44W V061 collection used by EXP-001B contains 318 official granules.

PARALLAX retrieves the official granule inventory from NASA CMR using
collection concept ID:

C2565805847-LPCLOUD

for the MOD44W A2000001 product.

The retrieved catalog contains:

318 granules  
318 unique MODIS tile IDs

This inventory is treated as the authoritative MOD44W V061 availability
domain for EXP-001B.

---

## Missing-granule interpretation

NASA documentation states that MOD44W granules completely covered by water
are not included in the distributed product and that absent granules
correspond to ocean regions rather than inland-water regions.

Therefore, for EXP-001B:

An MODIS tile absent from the official MOD44W V061 CMR inventory is treated
as ocean for land-fraction computation.

This rule applies only to absence from the official catalog.

A granule that exists in the official catalog but is missing from the local
PARALLAX filesystem MUST NOT be interpreted as ocean. That condition is a
data-availability or pipeline error.

---

## Mixed-footprint rule

A 50 km candidate footprint may intersect both:

- published MOD44W granules, and
- MODIS tiles absent from the official MOD44W inventory.

Such a candidate is not automatically rejected.

For land-fraction computation:

- published MOD44W coverage is evaluated using the native MOD44W land/water
  classification;
- portions intersecting officially absent MOD44W tiles are treated as ocean.

For published MOD44W granules, land_fraction is defined as:

land_fraction = N_land / (N_land + N_water)

where:

- class 0 contributes to N_land;
- class 1 contributes to N_water;
- class 250 (outside projection) is excluded from the denominator;
- class 253 (fill / invalid) is excluded from the denominator.

Portions of the candidate footprint falling inside MODIS tiles that are
officially absent from the MOD44W V061 inventory are treated as ocean and
therefore contribute to N_water.

An officially absent tile and an invalid pixel inside a published granule
are therefore deliberately different cases.

---

## Scientific rationale

This prevents three failure modes:

1. interpreting ocean elevations in SRTMGL30 as valid terrestrial terrain;
2. excluding coastal terrestrial candidates merely because part of their
   50 km footprint extends into an undistributed ocean-only MOD44W tile;
3. confusing an officially absent MOD44W granule with a locally missing
   source file.

MOD44W remains an eligibility mask only.

Land fraction MUST NOT contribute to Jensen-Shannon terrain similarity.

---

## Elevation coverage requirement

Stage 1 candidate terrain windows must contain 100% finite SRTMGL30
elevation values.

Formally:

valid_elevation_fraction = N_finite / N_total

and:

valid_elevation_fraction = 1.0

is required for candidate eligibility.

If any elevation value in the extracted 50 km candidate window is missing
or non-finite, the candidate is rejected.

Missing elevation values MUST NOT be imputed, converted to zero, or otherwise
reconstructed during Stage 1.

This requirement is an integrity check on the extracted elevation data. It
does not define the geographic observation domain, which remains explicitly
restricted by the SRTM observation-domain rules established in protocol v1.1.

Audit of all 27 downloaded SRTMGL30 mosaics before ranking found 100% finite
values in every raster. Therefore this rule does not reduce the observed
search domain in the current EXP-001B dataset and serves as a deterministic
pipeline-quality requirement.

---

## Change-control status

Protocol version: 1.2

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
