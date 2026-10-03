# EXP-001B — Blind Earth Discovery Protocol v1.0

## Status

FROZEN BEFORE EARTH CANDIDATE DISCOVERY

No Earth candidate ranking, candidate coordinates, candidate place names,
or expected terrestrial winner were inspected before freezing this protocol.

---

## 1. Research question

Can PARALLAX identify terrestrial regions whose terrain morphology is
compatible with the Jezero Crater rover-mobility target without encoding
known planetary analog locations into the search?

---

## 2. Target

Planet: Mars  
Region: Jezero Crater  
Mission context: Rover Mobility  
Reference point: Perseverance landing site  
Target footprint: 50 km × 50 km

The target footprint was frozen in EXP-001A.2 before Earth discovery.

Absolute elevation is excluded from Earth–Mars matching because Earth and
Mars use different vertical reference systems.

---

## 3. Planetary reference

Source:

Mars 2020 Science Investigation CTX DEM Mosaic  
USGS Astrogeology / NASA  
Nominal pixel size: 20 m

For Stage 1 discovery, the target terrain representation is evaluated at
approximately 1 km scale.

---

## 4. Earth search domain

Primary elevation source:

NASA SRTMGL30 V002

The search domain is restricted to terrestrial regions observable by
SRTMGL30.

PARALLAX must therefore NOT describe EXP-001B as a search of the entire
Earth.

Regions outside SRTM coverage, including polar regions, are outside the
scope of this experiment.

---

## 5. Search footprint

Candidate footprint:

50 km × 50 km physical window

Search stride:

25 km

This creates approximately 50% overlap between neighboring candidate
windows.

The physical footprint must remain approximately constant with latitude.
Longitude pixel spacing must therefore account for latitude.

---

## 6. Land eligibility

Source:

MODIS/Terra Land Water Mask Derived from MODIS and SRTM
MOD44W V061
250 m sinusoidal grid

Validated classes:

0   = land
1   = water
250 = outside projection
253 = fill

Reprojected categorical masks must use nearest-neighbor resampling.

For each candidate window:

land_fraction = land_pixels / valid_surface_pixels

where valid surface pixels contain only class 0 or class 1.

Primary eligibility threshold:

land_fraction >= 0.90

Windows below the threshold are excluded before terrain ranking.

Land fraction is an eligibility criterion and MUST NOT contribute to
terrain similarity.

Sensitivity analysis will later evaluate thresholds of:

0.80
0.90
0.95

The primary ranking remains the ranking produced with 0.90.

---

## 7. Terrain representation

Stage 1 uses slope derived from SRTMGL30 elevation.

Slope calculations must account for latitude-dependent east-west pixel
spacing.

Primary terrain representation:

normalized slope distribution using the following fixed bins:

[0°, 1°)
[1°, 2°)
[2°, 3°)
[3°, 5°)
[5°, 10°)
[10°, 15°)
[15°, 20°)
[20°, +inf)

The histogram must sum to 1.0 over valid terrain pixels.

Additional diagnostic statistics:

mean slope
median slope
P90 slope
P95 slope

These statistics MUST NOT alter the primary Stage 1 ranking.

---

## 8. Similarity metric

Primary metric:

Jensen-Shannon distance (JSD)

Input:

Jezero normalized slope distribution
versus
Earth candidate normalized slope distribution

JSD is selected because it is:

- symmetric,
- bounded,
- suitable for probability distributions,
- deterministic,
- explainable,
- and does not require arbitrary feature weights.

Lower JSD indicates greater terrain-distribution similarity.

Ranking order:

ascending Jensen-Shannon distance

Any UI similarity percentage derived later from this distance is a
presentation layer and must not be interpreted as percentage geological
identity with Mars.

---

## 9. Candidate validity

A candidate must:

- satisfy the land eligibility threshold,
- contain sufficient valid elevation coverage,
- produce a valid normalized slope distribution,
- and contain no unresolved numerical errors.

Missing or invalid data must never be silently converted to zero terrain.

---

## 10. Blind discovery

Before the primary ranking is frozen:

- no known Mars analog coordinates may be encoded,
- no preferred Earth region may receive a score bonus,
- no candidate may be selected for visual similarity,
- no candidate may be selected for storytelling convenience,
- no place-name lookup may influence the scoring method,
- no metric may be changed in response to candidate identity.

The ranking engine operates on numerical terrain information only.

---

## 11. Ranking output

The initial machine output will contain:

candidate_id
center_latitude
center_longitude
land_fraction
Jensen-Shannon distance
slope histogram
mean slope
median slope
P90 slope
P95 slope
valid coverage

Place names will not be used by the ranking algorithm.

For blind inspection, candidate IDs may be reviewed before geographic
names are resolved.

---

## 12. Spatial deduplication

Because the search uses a 25 km stride with 50 km windows, neighboring
high-ranking windows may represent the same physical terrain system.

Spatial clustering/deduplication will therefore be applied after scoring.

Deduplication must not change the underlying similarity score.

Both raw ranking and deduplicated ranking must be preserved.

---

## 13. Unblinding

Only after the primary ranking has been generated and frozen will
PARALLAX:

1. resolve coordinates to geographic locations,
2. inspect satellite imagery,
3. compare candidates with known analog literature,
4. identify unexpected candidates,
5. perform sensitivity analysis,
6. evaluate scientific plausibility.

Known analog sites are validation evidence, not training labels.

---

## 14. Stage 2

Stage 1 identifies coarse regional candidates.

Top candidates may subsequently be refined using higher-resolution
NASADEM terrain data.

Stage 2 may evaluate the previously frozen:

100 m
500 m
1000 m

terrain scales.

Stage 2 must not retroactively alter the Stage 1 discovery result.

---

## 15. Interpretation

A high PARALLAX ranking means:

"The terrestrial region has a terrain-slope distribution similar to the
Jezero rover-mobility target under the definitions of EXP-001."

It does NOT mean:

"This place is X% identical to Mars."

It does NOT establish a validated planetary analog by itself.

Geology, mineralogy, thermal environment, surface materials,
operational constraints and mission-specific factors require additional
evidence.

---

## 16. Primary claim

There is no single best analog for Mars.

There may be a best terrestrial analog for a specific mission objective
under explicitly defined environmental criteria.

---

## 17. Change control

This protocol is frozen before Earth candidate discovery.

Any subsequent methodological change must:

1. receive a new protocol version,
2. document the reason,
3. preserve the original EXP-001B result,
4. never replace an unfavorable result silently.
