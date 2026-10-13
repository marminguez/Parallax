# Parallax

**Planetary Analog Intelligence — find the right place on Earth to prepare for another world.**

Before a rover, an instrument or a crew goes to Mars or the Moon, it is tested on Earth. Choosing *where* is still largely a matter of experience and a few well-known sites. Parallax turns that choice into an explicit, traceable search. You describe what your test needs; Parallax returns measured candidate regions, explains why each one passes or is excluded, and lists what is still unknown before a campaign can be planned.

> Built for the NASA Space Apps Challenge 2026 — *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*.

## Why Parallax is different

- **Experiment first.** The search starts from a test profile (rover mobility, navigation, drilling, ISRU…) and measurable constraints, not from a map of famous analogs.
- **Where, and when.** For lunar targets, a *lunar light calendar* shows the days and hours when the Sun over each Earth candidate sits as low as at the lunar south pole (0–1.6°), the grazing light that makes Artemis navigation and imaging hard.
- **Similar is not suitable.** A region can share Jezero's slope distribution and still be 60% forest. Parallax combines planetary similarity with Earth-side constraints such as land cover, and shows which constraint removed each window.
- **Honest by design.** Missing evidence is never counted as a pass. Empty results are reported and explained. No synthetic data is substituted, and generative AI is not used in ranking.
- **Reproducible.** Every run records its request, dataset versions and SHA-256 hashes, and can be exported as JSON.

## What works today

| Capability | Status |
|---|---|
| Experiment form | Test profiles, geographic bounds, slope limits, optional numeric test envelope, mandatory evidence. Free text is kept in the report but never drives selection. |
| Mars reference | Jezero Crater (Perseverance landing site), 50 × 50 km window from the Mars 2020 CTX DEM mosaic, frozen as reference v0.4. |
| Moon reference | Shackleton crater at the lunar south pole (IAU centre 89.67° S, 129.78° E), 50 × 50 km window from the LOLA 20 m south-pole DEM, built with the same method as Jezero (`scripts/build_lunar_target_50km.py`). |
| Any-target ranking | Every Earth window keeps its 1 km slope histogram, so the same windows can be ranked against Jezero or Shackleton, and new references only need a frozen fingerprint. |
| Lunar light calendar | For each candidate, the next 12 months of low-Sun windows matching lunar south-pole illumination geometry: longest window, hours per year, best month. NOAA solar equations, verified against astropy. |
| Measured Earth index | 986 windows from a blind, systematic global pilot, ranked by slope-distribution distance to Jezero. Works immediately, no data download. |
| Live evaluation | Nine new window centres per request, computed locally from NASA SRTMGL30 elevation and MOD44W land/water masks. |
| Land cover | ESA WorldCover 2021 class proportions per window, plus optional filters (minimum bare/sparse, maximum trees, maximum built-up). |
| Place names | Each window is labelled with its region and nearest settlement (GeoNames, offline). Labels are display-only and never affect ranking. |
| Site grouping | Overlapping 50 km windows are grouped into independent sites after ranking, so nine neighbouring windows are not presented as nine places. |
| Evidence view | Earth vs Jezero comparison, satellite imagery for visual context, sources, resolution, outstanding evidence and JSON export. |
| Test facilities | A catalogue of three NASA centres with documented capabilities (access and exact envelopes not verified). |

## How it works

1. **Reference fingerprint.** Slopes are computed on a 1 km grid inside a 50 × 50 km window centred on the planetary site (Jezero on Mars, Shackleton on the Moon) and binned into a slope histogram (0–1°, 1–2°, … ≥20°).
2. **Earth windows.** The same window and grid are built on Earth (local azimuthal-equidistant projection, Vincenty geodesics). Windows with less than 90% land are excluded.
3. **Similarity.** Windows are ranked by the base-2 Jensen–Shannon distance between their slope histogram and the chosen target's (Jezero or Shackleton). Lower means more similar distributions. **It is not a suitability percentage.**
4. **Earth constraints.** Optional land-cover limits remove windows before ranking is displayed; all active limits require complete coverage.
5. **Presentation.** Results are labelled with place names and grouped into sites. Neither step changes the ranking.

The protocol was frozen before Earth discovery (`config/missions/jezero_rover_mobility.yaml`): no known analog sites or place names are used to rank, and known analogs are reserved for post-hoc validation.

## Data sources

| Data | Use | Licence / attribution |
|---|---|---|
| Mars 2020 Science Investigation CTX DEM Mosaic | Jezero reference terrain | NASA / USGS |
| LOLA south-pole DEM, 20 m (Barker et al. 2023, NASA GSFC PGDA) | Shackleton reference terrain | NASA; cite doi:10.3847/PSJ/acf3e1 |
| NASA SRTMGL30 v002 | Earth elevation | NASA, public domain |
| NASA MOD44W v061 | Land/water eligibility | NASA, public domain |
| ESA WorldCover 2021 v200 | Historical land cover | © ESA WorldCover project 2021, CC BY 4.0 |
| GeoNames cities1000 (2015 snapshot) | Display-only place labels | © GeoNames, CC BY 4.0 |
| CARTO Dark Matter, Esri World Imagery | Basemap and visual context only | Check provider terms before commercial use |

## Quick start

Requirements: Node.js 20+ and npm. Python 3.11+ is only needed for live evaluation.

```bash
cd web
npm ci
npm run dev
```

Open <http://localhost:3000/experiments/new> and press **Find candidates**. The measured index is bundled, so this works offline except for the basemap and imagery.

For live evaluation (Python engine, local rasters and WorldCover), follow [`web/README.md`](web/README.md).

### Enable the Moon target

Two one-off commands from the repository root, in the Python environment used for live evaluation:

```bash
# 1. Freeze the Shackleton reference (reads only the 50 km window from the LOLA COG, ~25 MB)
python scripts/build_lunar_target_50km.py --site shackleton

# 2. Store the 1 km slope histograms of the measured index (needs the local SRTMGL30/MOD44W data;
#    checks that every Jezero distance is reproduced before writing)
python scripts/export_index_histograms.py
```

Until both files exist, choosing the Moon returns a clear message with these commands; it never falls back to Jezero.

## Tests

```bash
# Web: production build + API, geometry, filter and site-grouping tests
cd web && npm test && npm run lint

# Python engine
python -m pip install -e ".[geo,dev]"
python -m pytest
```

Nine Python integration tests need local SRTMGL30/MOD44W raster fixtures that are not committed; without them they fail with file-not-found errors.

## Known limits

- Windows are 50 × 50 km at a 1 km grid: this is **regional pre-selection**, not obstacle-scale or wheel-safety analysis.
- Two planetary references so far (Jezero, Shackleton). Other Artemis III regions need their own frozen fingerprint.
- The lunar light calendar is geometric: Earth's atmosphere brightens the sky and softens shadows, and it assumes a flat horizon.
- Land cover describes 2021, sampled at 100 m; it is not current site condition.
- Geology, climate, soil strength, moisture, continuous testable space and permits are not yet measured.
- Passing every filter does not qualify a site for NASA; all candidates stay provisional.
- Live evaluation runs locally, one job at a time, and needs Python plus local data. The basemap and imagery need an internet connection.

## Repository map

```
config/missions/   Frozen experiment configuration (EXP-001)
docs/              Scope, requirements and validation notes
experiments/       Protocols for EXP-001 (Jezero rover mobility)
results/exp001/    Frozen Jezero reference and validation outputs
scripts/           Data download, evaluation and search runners
src/parallax/      Python engine: DEM/mask readers, similarity, place labels
tests/             Python tests
web/               Next.js application and API
```

## Roadmap

1. More Artemis III candidate regions (e.g. Malapert Massif, Mons Mouton Plateau, Haworth) as frozen references.
2. A characterization dossier per candidate: what is measured, what fails, what is unknown, and the field measurement that would close each gap.
3. Post-hoc validation against established analogs (e.g. Atacama, Mojave, Devon Island, Río Tinto).
4. A second, contrasting Earth region and review by a geoscience / GIS expert.
5. Higher-resolution terrain (Copernicus GLO-30) and more layers: geology, climate, soil, access and protected areas.
6. A hosted geospatial service with saved projects and shareable site dossiers.
