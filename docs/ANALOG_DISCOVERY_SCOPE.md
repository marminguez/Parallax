# Parallax: current challenge scope and assumptions

The current development goal is identifying and characterizing terrestrial analogs using traceable Earth and planetary measurements. Detailed submission requirements have not been verified. Jezero and rover mobility are provisional demonstration choices, not official challenge requirements. The Moon and additional Mars sites need separate measured references before being supported.

## Analysis-window map and comparison

Terrain results show full 50 × 50 km local WGS84 azimuthal-equidistant windows. Boundaries use Vincenty's direct geodesic to invert local coordinates, sampled every 5 km along each edge. This is the analysis grid envelope, not a permitted field parcel or the smaller set of valid interior slope cells. Windows may extend beyond centre search bounds. Overlapping fill is visible. Returned windows are grouped into sites after ranking when their 50 × 50 km footprints overlap a better-ranked window (see web/README.md); grouping is a display aid, not a field-parcel or statistical independence analysis. Facilities have no terrain window.

The Earth–Jezero table compares regional P95 and mean slopes on the 1000 m grid, with reference v0.4 copied exactly from results/exp001/jezero_target_50km_v0_4.json. JSD uses the full slope histogram, not just P95. Land fraction is an Earth eligibility measurement, not a planetary similarity criterion. User-defined terrain and facility modes do not claim Jezero similarity. Jezero JSON downloads include the frozen planetary reference alongside the existing run evidence.

Vegetation, geology, climate, soil mechanics and access remain unverified. Coverage-of-terrain data is the next integration; none is synthesized from satellite imagery.

## Validation

Production build, TypeScript, ESLint and the ten existing API integration tests pass. Three additional tests check 12 boundary coordinates against independent pyproj/PROJ AEQD fixtures (including southern/northern coverage and the antimeridian), ring continuity, and equality with the frozen scientific reference. Browser rendering and external basemap/imagery loading still need a visual check on the user's computer.

## Historical land cover added

Live searches now include optional local ESA WorldCover 2021 v200 characterization;
indexed results remain unknown. This is descriptive Earth evidence, not a Mars
classification target or an official challenge requirement. The next integration
noted above is now implemented. The source is nominal 10 m; class proportions
are estimated from 100 m nearest-neighbour samples on the full local AEQD window.
Missing classifications are reported as incomplete coverage. Soil moisture and
field vegetation conditions remain unverified.

Independent execution at all nine Northern Spain centres classified 100% of the
250,000 samples per window. At 43,-3, the estimated fractions are 60.4852% trees,
26.0568% grassland, 10.0588% cropland, 2.0620% built-up, 1.1476% shrubland,
0.1064% permanent water and 0.0832% bare/sparse vegetation. These historical
sampling estimates are not present-day native-pixel area totals. Source filenames,
download SHA-256 records and complete results are in
`results/exp001/worldcover_northern_spain_validation.json`. These values do not
qualify an experiment site or alter the terrain ordering.

Validation: five Python land-cover tests plus five live-runner guard tests pass,
as do the thirteen web integration/geometry tests, production build, TypeScript
and ESLint. Synthetic rasters test missing/partial/full accounting and corrupt
inputs; the nine actual windows independently exercise downloaded ESA data.
Full end-to-end DEM+cover execution still needs the user's local DEM/mask files.

## Cover filters

Optional live-search constraints now filter historical bare/sparse, tree and
built-up proportions, before the existing terrain ranking. Complete coverage is
mandatory when any limit is active. Empty constraints retain previous behaviour;
indexed and facility requests with active cover constraints are rejected.
Exclusions are reported separately for missing evidence and out-of-range cover.
Passing these filters does not verify soil, moisture, permissions or continuous
testable space. These optional product choices remain provisional challenge scope.

Validation adds five focused filter tests and one API validation test. Inclusive
boundaries, zero limits, absent/partial/malformed coverage, invalid ranges, legacy
requests, ranking preservation and unresolved critical evidence are covered. The
recorded nine actual WorldCover windows all fail a 1% bare/sparse minimum.
