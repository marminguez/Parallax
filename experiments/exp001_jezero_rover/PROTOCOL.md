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
## Target footprint freeze — EXP-001A.2

Before inspecting or ranking any terrestrial candidate locations, the
planetary target footprint was frozen.

### Reference point

- Body: Mars
- Region: Jezero Crater
- Mission reference: Perseverance landing site
- Latitude: 18.44463° N
- Longitude: 77.45088° E

### Analysis footprint

- Window: 50 × 50 km
- Center: Perseverance landing site
- Native source resolution: 20 m
- Target coverage: 100%

The 50 × 50 km footprint was selected before Earth candidate discovery
and is kept fixed throughout EXP-001.

### Multiscale terrain fingerprint

Terrain morphology is represented at:

- 100 m
- 500 m
- 1000 m

For Stage 1 Earth discovery, only the 1000 m regional terrain signature
will be used.

The finer 100 m and 500 m signatures are reserved for subsequent
candidate refinement using higher-resolution Earth elevation data.

### Stage 1 Jezero signature

At 1000 m scale:

- Mean slope: 2.575°
- Median slope: 1.555°
- P90 slope: 5.995°
- P95 slope: 8.724°

Slope distribution:

- 0–5°: 86.92%
- 5–10°: 9.52%
- 10–15°: 2.20%
- 15–20°: 1.24%
- ≥20°: 0.12%

Absolute elevation is not used for Earth–Mars matching because Earth
and Mars use different vertical reference systems.

### Blind-discovery status at freeze

At the time this target was frozen:

- No terrestrial candidate ranking had been generated.
- No candidate coordinates had been inspected.
- No known analog location was encoded in the matching process.
- No terrestrial site was selected as an expected winner.
- Target footprint and terrain scales were fixed before discovery.

Any subsequent changes to the target definition or matching methodology
must be versioned and documented rather than silently replacing this
configuration.
