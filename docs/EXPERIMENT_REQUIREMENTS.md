# PARALLAX — experiment requirements and evidence model

Research date: 2026-10-11. These examples inform the product model; they are not a universal NASA qualification specification. The applicable solicitation, payload interface and customer-approved test plan determine actual acceptance limits.

## What NASA actually tests

| Experiment | Requirements to capture | Measured acceptance evidence | Appropriate setting |
| --- | --- | --- | --- |
| Rover wheels / mobility | Loads, wheel geometry, slope, obstacle size, soil particle distribution and compaction | Drawbar pull, slip, sinkage, torque, energy, bearing/shear strength | Field terrain shortlist plus controlled soil testbed |
| Navigation / imaging / LiDAR | Obstacle scale, lighting angle, shadows, reflectance, localisation ground truth | Detection/localisation errors, trajectory success, sensor performance | Field terrain plus controlled light/regolith testbed |
| Drilling / sampling | Target mineralogy, depth, grain size, strength, water/organic content, contamination constraints | Penetration rate, forces, sample integrity, instrument measurements | Characterised field site plus laboratory testing |
| EVA / mission operations | Traverse, geological diversity, sampling tasks, communications, simulated lighting, access | Task completion, operator workload, sampling quality, communications performance | Permitted field campaign |
| Dust / materials | Composition, angularity, grain distribution, exposure/cycles, electric charge, specimen geometry | Abrasion, adhesion, seal performance, contamination, degradation | Controlled simulant and dust facility; vacuum when required |
| Thermal-vacuum / materials | Pressure, temperatures, ramp rates, cycles, specimen dimensions and power | Customer-approved material/system acceptance measurements | Instrumented thermal-vacuum chamber |
| ISRU / excavation | Composition, granular mechanics, compaction, depth and process inputs | Digging forces, yield, energy consumption, wear | Characterised field material plus controlled testbed |

NASA Glenn documents tilt-beds, instrumented traction, high-sinkage soils and excavation-force measurement. NASA Ames documents controlled regolith and illumination testing. NASA Johnson documents dust, vacuum and thermal-vacuum capability. These distinguish site screening from hardware qualification.

## Primary sources

- NASA Glenn, Planetary Exploration Test Facilities: https://www.nasa.gov/centers-and-facilities/glenn/planetary-exploration-test-facilities/
- NASA Ames, Lunar Lab and Regolith Testbeds: https://www.nasa.gov/centers-and-facilities/ames/the-lunar-lab-and-regolith-testbeds/
- NASA Johnson, Lunar Development and Test Facility (2026-08-07): https://www.nasa.gov/centers-and-facilities/johnson/nasas-lunar-development-and-test-facility-prepares-artemis-hardware-for-moon/
- NASA ARADS field drilling (2019 historical example): https://www.nasa.gov/missions/analog-field-testing/nasa-is-testing-a-drill-to-search-for-life-on-mars-on-its-own/
- NASA JETT / D-RATS field operations (2022 historical example): https://www.nasa.gov/humans-in-space/nasa-to-practice-artemis-moonwalking-roving-operations-in-arizona-desert/
- NASA Simulant Advisory Committee: https://ares.jsc.nasa.gov/projects/simulants/advisory-committee.html

## Implemented evidence boundaries

The web app now executes a request-driven search rather than displaying three hardcoded regions. It supports:

1. **Indexed terrain screening:** 986 measured windows from the repository's EXP-001B pilot. 224 were labelled land-eligible in the original run. Geographic centre bounds, land fraction, regional slope P95 and frozen Jezero JSD are measurable filters. User-defined terrain ranking uses distance from a requested P95, without claiming a lunar/Mars analog score.
2. **Live terrain screening:** nine newly sampled centres in bounded regions, evaluated with the existing Python SRTMGL30/MOD44W pipeline and frozen Jezero target. Local raw rasters and Python geo dependencies are required. No example results substitute for missing data.
3. **Facility capability discovery:** a deliberately small catalogue of three source-backed NASA centres. It is not a worldwide directory, booking service or evidence of supplier access. Centre coordinates are approximate campus coordinates, not exact facility footprints.
4. **Traceable runs:** exact request, numeric test envelope, evidence gaps, ranking explanation, dataset/output hash, timestamp and result export. Browser history provides convenience, not server-side durable project storage.

Missing data cannot be promoted to satisfied constraints. Each experiment profile has mandatory qualification evidence beyond the coarse DEM. Strict mode therefore legitimately returns no qualified sites with the current data. Provisional terrain matches are useful for planning collection, not as certification.

Numeric envelopes (temperature, pressure, particle diameter, drilling depth, hardware mass) are captured with units and become mandatory evidence checks. They cannot be numerically verified against the current terrain index or facility catalogue. The objective text is recorded but never silently interpreted as verified constraints.

### Scientific limitations to resolve

- The terrain footprint is fixed at 50 × 50 km and the analysis grid at 1000 m. This cannot resolve rocks, wheel-scale slopes or local traverse safety.
- The only frozen planetary histogram is Jezero. Lunar targets, custom DEM-derived fingerprints, smaller footprints and multiscale terrain require new analysis and validation, not renamed presets.
- Slope statistics and water-mask eligibility do not establish dry, unvegetated, accessible or legally usable terrain.
- The pilot is a deterministic sample, not an exhaustive Earth search. Empty results do not prove no suitable Earth site exists.
- Satellite imagery is visual context. Its acquisition date and local resolution are not verified; it is not the raster used to calculate the ranking.
- Soil strength, particle shape/distribution, mineralogy, contamination, permissions, infrastructure and campaign-time climate need measured/site-specific evidence.
- Earth field sites cannot reproduce lunar gravity, lunar vacuum, space radiation or all lunar dust properties.

## Work required for an operational commercial service

1. Expand and version a full Earth feature index; keep failed evaluations distinct from ocean/land rejections.
2. Add high-resolution DEM, land-cover/vegetation, seasonal climate, geological and protected-area/access datasets, with licence, resolution, uncertainty and update metadata.
3. Create a verified site-evidence and facility-capability registry with numeric test envelopes and operator-confirmed availability/access.
4. Add custom planetary target ingestion with matching projection, footprint and scale; benchmark against expert-defined experiments.
5. Run fresh evaluations as durable jobs with progress, cancellation, cached rasters and restartability. The current synchronous nine-centre local runner is not a distributed compute system.
6. Add authentication, organisation isolation, persistent experiments, evidence-review/audit workflows, deployment observability and abuse/resource controls before exposing live compute publicly.
7. Validate recommendations prospectively with field experts and operators. Keep screening status distinct from qualified/approved status.
