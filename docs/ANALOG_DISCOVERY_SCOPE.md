# Parallax: current challenge scope and assumptions

The current development goal is identifying and characterizing terrestrial analogs using traceable Earth and planetary measurements. Detailed submission requirements have not been verified. Jezero and rover mobility are provisional demonstration choices, not official challenge requirements. The Moon and additional Mars sites need separate measured references before being supported.

## Analysis-window map and comparison

Terrain results show full 50 × 50 km local WGS84 azimuthal-equidistant windows. Boundaries use Vincenty's direct geodesic to invert local coordinates, sampled every 5 km along each edge. This is the analysis grid envelope, not a permitted field parcel or the smaller set of valid interior slope cells. Windows may extend beyond centre search bounds. Overlapping fill is visible; results are not grouped into independent sites and no overlap count or independence claim is made. Facilities have no terrain window.

The Earth–Jezero table compares regional P95 and mean slopes on the 1000 m grid, with reference v0.4 copied exactly from results/exp001/jezero_target_50km_v0_4.json. JSD uses the full slope histogram, not just P95. Land fraction is an Earth eligibility measurement, not a planetary similarity criterion. User-defined terrain and facility modes do not claim Jezero similarity. Jezero JSON downloads include the frozen planetary reference alongside the existing run evidence.

Vegetation, geology, climate, soil mechanics and access remain unverified. Coverage-of-terrain data is the next integration; none is synthesized from satellite imagery.

## Validation

Production build, TypeScript, ESLint and the ten existing API integration tests pass. Three additional tests check 12 boundary coordinates against independent pyproj/PROJ AEQD fixtures (including southern/northern coverage and the antimeridian), ring continuity, and equality with the frozen scientific reference. Browser rendering and external basemap/imagery loading still need a visual check on the user's computer.
