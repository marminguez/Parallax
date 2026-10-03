# PARALLAX — EXP-001

## Jezero Rover Mobility Analog Discovery

### Research question

Can PARALLAX identify terrestrial candidate sites for testing
Jezero-like rover mobility without being told where known planetary
analog sites are located?

---

## Target

Planet: Mars  
Location: Jezero Crater  
Mission: Rover Mobility

---

## Hypothesis

Mission-specific terrestrial analog candidates can be discovered
computationally by comparing multiscale terrain fingerprints derived
from planetary and Earth-observation data.

---

## Planetary reference

Dataset:

Mars 2020 Science Investigation CTX DEM Mosaic

Provider:

USGS Astrogeology / NASA

Ground sample distance:

20 m

---

## Terrain fingerprint

The matching model will prioritize terrain morphology rather than
absolute elevation.

Primary comparison scales:

- 100 m
- 500 m
- 1000 m

For each scale PARALLAX will compare:

- slope distribution
- median slope
- P90 slope
- P95 slope

Slope classes:

- < 5°
- 5–10°
- 10–15°
- 15–20°
- >= 20°

Absolute planetary elevation will NOT be directly compared with
terrestrial elevation because Earth and Mars use different vertical
reference systems.

---

## Earth search strategy

### Stage 1 — Discovery

Perform a coarse search over terrestrial land areas.

No known planetary analog location will be encoded as a preferred
candidate.

Output:

Top candidate regions based only on terrain similarity.

### Stage 2 — Refinement

Retrieve higher-resolution NASADEM terrain data for the strongest
candidate regions.

Recalculate fingerprints at comparable spatial scales.

Output:

Top terrestrial candidate sites.

---

## Search window

Candidate regions will be evaluated using approximately 50 km × 50 km
terrain windows.

The window size is fixed before candidate discovery.

---

## Matching principle

PARALLAX will compare distributions rather than a single average
terrain value.

The similarity function must be:

- deterministic
- decomposable
- reproducible
- explainable

No generative AI will determine the terrain ranking.

---

## Blind discovery rule

The following locations may be used later for interpretation or
validation but MUST NOT influence candidate ranking:

- known Mars analog sites
- known lunar analog sites
- sites selected because of visual similarity
- locations preferred for storytelling or geographic convenience

The algorithm must be allowed to return unexpected locations.

---

## Interpretation

A high PARALLAX score means:

> The terrestrial terrain reproduces selected terrain characteristics
> relevant to the specified mission.

It does NOT mean:

> This place is X% identical to Mars.

Results are mission-specific.

---

## Validation

After ranking is complete:

1. inspect the highest-ranked candidates;
2. compare results with published planetary analog literature;
3. investigate unexpected candidates;
4. test sensitivity to fingerprint parameters;
5. report limitations and uncertainty.

---

## Core scientific claim

There is no single best analog for Mars.

There may be a best analog for a specific mission.