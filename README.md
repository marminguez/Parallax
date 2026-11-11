# Parallax

**Planetary Analog Intelligence — find the right place on Earth to prepare for another world.**

Before a rover, an instrument or a crew goes to Mars or the Moon, it is tested on Earth. Choosing *where* is still largely a matter of experience and a few well-known sites. Parallax turns that choice into an explicit, traceable search. You describe what your test needs; Parallax returns measured candidate regions, explains why each one passes or is excluded, and lists what is still unknown before a campaign can be planned.

> Built for the NASA Space Apps Challenge 2026 — *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*.
> Team **Parallax Lab**: Daniela Galeano and Mar Mínguez.

## Headline result

**Earth can rehearse almost all of the lunar south pole and Mars; Parallax says where.** Comparing every 50 km of the lunar south polar cap and of Mars with every eligible 50 km window on Earth (1 km slope fingerprint, NASA LOLA, MOLA and SRTMGL30), Earth has a strong terrain twin for **all 529 lunar windows** and **99.9 % of Mars** (57,891 of 57,939 windows), including **all nine Artemis III candidate regions**. Their twins are new analog candidates: measured with a rule fixed beforehand ([`config/novelty/novelty_v1.yaml`](config/novelty/novelty_v1.yaml), `python scripts/novelty.py`), 20 of the 21 reverse-map twins have none of the 57 listed analogs of VAL-001, VAL-002 and VAL-003 within 100 km (the exception: Holden crater's twin near Doğubayazıt, 47 km from Armash, AMADEE-24); for example, the twin of Nobile Rim 1 lies in Gilgit-Baltistan, Pakistan (distance 0.017, closer than any of 18 agency-used analogs to their own target). The few Mars windows Earth struggles to imitate sit on Olympus Mons and Valles Marineris. Details: [`docs/VAL004_RESULTS.md`](docs/VAL004_RESULTS.md).

## Where the analogy breaks

Each twin is also characterized on six more dimensions, with verdicts fixed before computing ([`config/characterization/`](config/characterization/); descriptive, it never changes a twin):

- **Fine relief (60 m): the lunar twins break.** All ten lunar twins behave like the Moon at 50 km but not at 60 m: Earth's mountains, carved by water and ice, have 42–85 % of their slopes at 15° or more, against 13–48 % on the Moon, whose craters are softened by regolith. Jezero's twin holds partly (distance 0.165; 3 % vs 4 % steep slopes). For rover tests, a lunar twin must also be searched at fine scale.
- **Temperature: Earth does not get cold enough.** The lunar twins cover 13–35 % of the Moon's surface range; the Moon gets 149–203 °C colder. Of the eleven Mars twins, eight never reach Martian ground temperatures; only Jezero's twin, in the southern Urals, covers most of the Mars range.
- **Access:** 4 twins are remote, 10 rural and 7 populated (NASA SEDAC population density).
- **Ice:** every Artemis III region and Shackleton hold cold traps (1.5–22 % of the window in permanent shadow, LOLA). Only two lunar twins have permafrost: those of Nobile Rim 1 and Malapert Massif, both in the Karakoram (Gilgit-Baltistan, Pakistan; Gruber permafrost index). Among the 21 twins, those are the ones to rehearse drilling ice-bearing ground for Artemis; across all of Earth there are many more (see *Search all of Earth* below). On Mars, only Viking 2 (Utopia Planitia) shows clear ice (NASA SWIM), and its twin has none. The Mars rule was amended after seeing the first results ([`ice_v1_2_amendment.yaml`](config/characterization/ice_v1_2_amendment.yaml)): SWIM values near 0 are inconclusive, so they no longer count as ice; both verdicts are published.
- **Bare ground: shape is not enough.** At 50 km the Moon and Mars are loose ground everywhere; 16 of the 21 twins are mostly vegetated (ESA WorldCover). Only three hold: Opportunity's twin in the Sahara (Arlit, Niger; 98 % bare) and the two Karakoram twins of Malapert Massif and Nobile Rim 1 (58–60 % bare). Mars Pathfinder's twin is rainforest in French Guiana. This is why the experiment search offers bare ground as a condition. The analogy is about open, loose ground, never about the dust itself.
- **Rock: same shape, different rock.** No lunar twin has the Moon's anorthosite or gabbro (GLiM); two are partly crystalline (Peru). On Mars, two twins hold: Viking 2's lowland plains against sediments near Roma, Australia, and Jezero's sedimentary transition unit against mixed sedimentary rock in the southern Urals. Holden's twin, by Mount Ararat (Doğubayazıt, Türkiye), is 47 % basalt. Rock families are compared at map scale (GLiM 0.5°, USGS SIM 3292), never chemistry.

**Search all of Earth.** Five of those dimensions (bare ground, access, permafrost, rock family, surface temperature) were then measured on all 42,405 eligible Earth windows, with rules and four predictions frozen before computing ([`config/search/earth_dimensions_v1.yaml`](config/search/earth_dimensions_v1.yaml), amendment v1.1 made before any value; run guide [`docs/EARTH_DIMENSIONS_RUN.md`](docs/EARTH_DIMENSIONS_RUN.md)). The code first reproduced the 21 published twins exactly (B1), and the web search gives the same distances as the Python engine (B2). All four predictions held: 18.5 % of windows are mostly bare ground (predicted 5–20 %), 4.2 % have permafrost (< 15 %), 29.5 % are remote (20–40 %), and 111 of Shackleton's 1,769 strong twins combine bare ground and permafrost (≥ 5). With the nine Artemis III regions as references ([`config/search/artemis_references_v1.yaml`](config/search/artemis_references_v1.yaml)), every region has between 63 (Nobile Rim 1) and 170 (Slater Plain) such candidates to rehearse drilling into frozen, open ground (predicted at least 5 for 7 of 9; it held for 9 of 9). Almost all lie in High Asia. Permafrost is a zonation index, not measured ground ice: every site needs a field check.

**Fine relief for search results.** At 60 m every lunar twin breaks, so the windows teams see most (538: the top 50 of each of the 11 references, the top 50 drilling candidates of each lunar reference and the 21 twins) were measured at 60 m with Copernicus GLO-30, rules and predictions frozen first ([`config/search/fine_relief_search_v1.yaml`](config/search/fine_relief_search_v1.yaml), `python scripts/fine_relief_search.py`). Check F1 passed (the 21 twins reproduce their published 60 m values). All three predictions held: only 0.17 % of lunar pairs hold at 60 m (predicted at most 5 %), yet every one of the 10 lunar references has windows that hold or partly hold (9 pairs hold, for Nobile Rim 1, Slater Plain, Malapert Massif, Shackleton and Mons Mouton), and 26 of Jezero's top 50 hold or partly hold (predicted at least half). Each candidate sheet shows its 60 m verdict, and a team can require it as a condition; only measured windows can pass.

Full record: [`results/characterization/twin_sheets_v1.json`](results/characterization/twin_sheets_v1.json).

## Why Parallax is different

- **The reverse map.** Instead of only asking where Earth looks like the Moon or Mars, Parallax maps the Moon and Mars by whether Earth has a twin for each place, and gives the address of that twin. Anyone can ask *what Moon, and what Mars, is under my feet?*
- **Experiment first.** The search starts from a test profile (rover mobility, navigation, drilling, ISRU…) and measurable constraints, not from a map of famous analogs.
- **Where, and when.** For lunar targets, a *lunar light calendar* shows the days and hours when the Sun over each Earth candidate sits as low as at the lunar south pole (0–1.6°), the grazing light that makes Artemis navigation and imaging hard.
- **Similar is not suitable.** A region can share Jezero's slope distribution and still be 60% forest. Parallax combines planetary similarity with Earth-side constraints such as land cover, and shows which constraint removed each window.
- **Honest by design.** Missing evidence is never counted as a pass. Empty results are reported and explained. No synthetic data is substituted, and generative AI is not used in ranking.
- **Reproducible.** Every run records its request, dataset versions and SHA-256 hashes, and can be exported as JSON.

## What works today

| Capability | Status |
|---|---|
| Experiment form | Test profiles, geographic bounds, distance and slope limits, terrain conditions, optional numeric test envelope, mandatory evidence. Free text is kept in the report but never drives selection. |
| Team verification | Each piece of missing evidence (permits, logistics, field measurements) can be marked as verified by the campaign team: who checked it, when, against what source. Declared by the team, not certified by Parallax; it changes the candidate's status, never the ranking. Kept per Earth window in the browser and included in the exported JSON. |
| Mars reference | Jezero Crater (Perseverance landing site), 50 × 50 km window from the Mars 2020 CTX DEM mosaic, frozen as reference v0.4. |
| Moon reference | Shackleton crater at the lunar south pole (IAU centre 89.67° S, 129.78° E), 50 × 50 km window from the LOLA 20 m south-pole DEM, built with the same method as Jezero (`scripts/build_lunar_target_50km.py`). |
| Any-target ranking | Every Earth window keeps its 1 km slope histogram, so the same windows can be ranked against Jezero, Shackleton or any of the nine Artemis III regions; a new reference only needs a frozen fingerprint. |
| Artemis III references | Each Artemis III candidate region is a search reference: the 1 km fingerprint of its VAL-004 lunar window, frozen unchanged ([`config/search/artemis_references_v1.yaml`](config/search/artemis_references_v1.yaml), `python scripts/artemis_references.py`). Check C1 passed: with no conditions, every region's first result is its published reverse-map twin. Each Missions sheet links to a search preselected for its destination. |
| Lunar light calendar | For each candidate, the next 12 months of low-Sun windows matching lunar south-pole illumination geometry: longest window, hours per year, best month. NOAA solar equations, verified against astropy. |
| Measured Earth index | 42,405 eligible VAL-004 Earth windows (every 50 km, 56° S to 60° N, ≥ 90 % land) with five measured Earth-side dimensions ([`config/search/earth_dimensions_v1.yaml`](config/search/earth_dimensions_v1.yaml)). Jezero searches use the Mars model v2 score; lunar references rank by slope distance. Works immediately, no data download. The generic P95 slope search, with no planetary reference, keeps the 986 windows of the EXP-001B pilot, the only index with a regional P95. |
| Terrain conditions | Minimum bare ground, maximum vegetation, access band, required permafrost, rock like the reference, temperature like the destination (all measured on every index window) and fine relief at 60 m like the reference (measured for 538 windows only; the rest never pass). They only remove windows, never reorder them, and a missing value never passes; the result reports how many each removed. |
| Live evaluation | Nine new window centres per request, computed locally from NASA SRTMGL30 elevation and MOD44W land/water masks. |
| Land cover | ESA WorldCover 2021 class proportions per window, plus optional filters (minimum bare/sparse, maximum trees, maximum built-up). |
| Place names | Each window is labelled with its region and nearest settlement (GeoNames, offline). Labels are display-only and never affect ranking. |
| Site grouping | Overlapping 50 km windows are grouped into independent sites after ranking, so nine neighbouring windows are not presented as nine places. |
| Evidence view | Earth vs Jezero comparison, satellite imagery for visual context, sources, resolution, outstanding evidence and JSON export. |
| Test facilities | A catalogue of three NASA centres with documented capabilities (access and exact envelopes not verified). |
| Reverse map (VAL-004, pre-registered and run) | Every 50 km window of the lunar south polar cap (529) and of Mars (57,939), classified by whether Earth has a twin with the same terrain behaviour, with the nine Artemis III regions and eleven Mars landing sites placed on the map; and for every Earth window, its closest Moon and Mars windows. Results: [`docs/VAL004_RESULTS.md`](docs/VAL004_RESULTS.md); how to run: [`docs/VAL004_RUN.md`](docs/VAL004_RUN.md). |
| Twin characterization v1.4 | Every destination's twin also compared on fine relief (60 m), surface temperature, access, ice, bare ground and rock family, with verdicts fixed before computing. Descriptive only; it never changes a twin. How to run: [`docs/CHARACTERIZATION_RUN.md`](docs/CHARACTERIZATION_RUN.md). |
| Campaign planning v1: the reachable twin | `/misiones/campana`. For each destination, the closest strong twin within 100 km of an airport with scheduled flights, and ten non-overlapping sites to choose from, filterable by continent. Rule frozen before computing ([`config/campaign/reachable_twins_v1.yaml`](config/campaign/reachable_twins_v1.yaml)); run with `python scripts/reachable_twins.py`. Each site also shows when to go (workable months from NASA POWER: lows ≥ −10 °C, highs ≤ 35 °C, rain ≤ 3 mm/day) and where to sleep (OpenStreetMap lodging within 50 km), frozen in [`config/campaign/logistics_v1.yaml`](config/campaign/logistics_v1.yaml); run with `python scripts/campaign_logistics.py`. It never changes a reverse-map twin. 10 of 21 reverse-map twins are already reachable; the other 11 get a reachable strong twin (for example Nobile Rim 1: Vicuña, Chile, near La Serena; Opportunity: Deming, New Mexico, USA). Every site has a printable two-page campaign sheet (`/misiones/campana/ficha?d=<destination>&w=<window>`): what it can rehearse, how to get there, where to sleep, the month-by-month climate (plus low-Sun hours for Moon destinations), field checks, three fallback sites and space for notes. Campaign v1.2 adds facts on the ground, frozen in [`config/campaign/field_v1.yaml`](config/campaign/field_v1.yaml): altitude and an acclimatization band (Copernicus GLO-30), daylight hours per month, the nearest hospital, fuel station and supermarket, road access to the window centre (OpenStreetMap) and the country's emergency numbers; run with `python scripts/campaign_field.py`. |
| Public site (Spanish and English) | Home with the result and three audiences: `/misiones` (agencies, science teams, analog missions), `/educacion` and `/educacion/pantalla` (classrooms, museums, kiosk screen), `/territorio` (regions). `/bajo-tus-pies` answers *what Moon, and what Mars, is under your feet?*; location is used only on the visitor's device. Hosted on Vercel from this repository; `?lang=en` forces English. See [docs/DEPLOY.md](docs/DEPLOY.md). |

## How it works

1. **Reference fingerprint.** Slopes are computed on a 1 km grid inside a 50 × 50 km window centred on the planetary site (Jezero on Mars, Shackleton on the Moon) and binned into a slope histogram (0–1°, 1–2°, … ≥20°).
2. **Earth windows.** The same window and grid are built on Earth (local azimuthal-equidistant projection, Vincenty geodesics). Windows with less than 90% land are excluded.
3. **Similarity.** Windows are ranked by the base-2 Jensen–Shannon distance between their slope histogram and the chosen target's (Jezero or Shackleton). Lower means more similar distributions. **It is not a suitability percentage.**
4. **Earth constraints.** Optional land-cover limits remove windows before ranking is displayed; all active limits require complete coverage.
5. **Presentation.** Results are labelled with place names and grouped into sites. Neither step changes the ranking.

The protocol was frozen before Earth discovery (`config/missions/jezero_rover_mobility.yaml`): no known analog sites or place names are used to rank, and known analogs are reserved for post-hoc validation.

## Validation

Four pre-registered tests. For the first three, sites came from independent sources (agency programmes, Wikipedia's analog and Apollo-training lists) and were frozen in the repository before Parallax evaluated them; they were compared with the 224-window systematic Earth sample.

| Test | Sites | Target | AUC | p (10,000 permutations) |
|---|---|---|---|---|
| VAL-001 Mars-use analogs | 7 | Jezero | 0.76 | 0.007 |
| VAL-002 Apollo geology-training sites | 8 | Shackleton | 0.77 | 0.004 |
| VAL-001 + VAL-002 Moon-use sites, pooled | 11 | Shackleton | 0.76 | 0.001 |
| VAL-003 Mars-use sites from another team's list, model v2 (relief + bare ground) | 21 | Jezero | 0.78 | < 0.001 |

VAL-004, the reverse map, was pre-registered with three predictions before any grid was computed. Both bridge tests passed (each planetary grid reproduces its frozen reference: Mars 0.064, Moon 0.013, tolerance 0.15). Two of the three predictions failed: we expected the lunar south pole to be harder to imitate than Mars, and the Shackleton window to lack a twin; neither held. We report the result as it came out.

- Established analogs fall, at the median, in the **closest ~19 % of Earth** to their planetary target. The hyperarid core of the **Atacama is closer to Jezero than every sampled window**.
- **On an independent list** published by another Space Apps team (Analog Atlas), adding bare ground to relief raises Mars recognition from 0.67 to 0.78 and matches that team's own 21-variable result for Jezero (0.82 vs 0.83). For the Moon, bare ground does not help (lunar training sites were chosen for geology), so Moon targets keep the relief-only model.
- Honest limit: the 1 km slope fingerprint recognises planetary-analog terrain versus typical Earth land better than it separates Moon-like from Mars-like terrain (Apollo sites are equally close to Jezero). Crater-scale features such as Meteor Crater are invisible at this scale.

Details: [`docs/VAL001_RESULTS.md`](docs/VAL001_RESULTS.md), [`docs/VAL002_RESULTS.md`](docs/VAL002_RESULTS.md), [`docs/VAL003_RESULTS.md`](docs/VAL003_RESULTS.md), [`docs/VAL004_RESULTS.md`](docs/VAL004_RESULTS.md).

## Data sources

Full list with citations, DOIs, licences and validation-site sources: [docs/SOURCES.md](docs/SOURCES.md).

| Data | Use | Licence / attribution |
|---|---|---|
| Mars 2020 Science Investigation CTX DEM Mosaic | Jezero reference terrain | NASA / USGS |
| LOLA south-pole DEM, 20 m (Barker et al. 2023, NASA GSFC PGDA) | Shackleton reference terrain and the lunar reverse map | NASA; cite doi:10.3847/PSJ/acf3e1 |
| Mars MGS MOLA DEM 463 m | Reverse map of all of Mars | NASA GSFC / USGS, CC0 |
| NASA Artemis III landing-region map (28 Oct 2024) | Places the nine regions on the lunar map | NASA, use with credit |
| IAU / USGS Gazetteer of Planetary Nomenclature | Shackleton and Nobile centres | Public domain |
| Analog Atlas site list (another Space Apps 2026 team) | Independent test set for VAL-003 | MIT, © 2026 Analog Atlas contributors |
| Copernicus DEM GLO-30 (ESA / Copernicus) | Fine relief (60 m) of each twin | © DLR / Airbus, provided under COPERNICUS by the EU and ESA |
| NASA POWER climatology | Surface temperature of each twin | NASA, public domain |
| NASA SEDAC GPWv4 population density 2020 | Access of each twin | CIESIN / NASA SEDAC, CC BY 4.0 |
| LOLA permanent shadow map 120 m (NASA PGDA) | Cold traps in each lunar window | NASA, public domain |
| SWIM ice consistency 0–1 m (NASA / PSI) | Ground ice in each Mars window | NASA-funded, public |
| Global Permafrost Zonation Index (Gruber 2012) | Permafrost at each twin | Free use with citation |
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

- Earth cannot reproduce reduced gravity, the Moon's vacuum, Mars's thin atmosphere or space radiation. Parallax finds terrain that behaves alike; it never claims a site is "like being on the Moon or Mars".
- Windows are 50 × 50 km at a 1 km grid: this is **regional pre-selection**, not obstacle-scale or wheel-safety analysis.
- Eleven planetary references for the search (Jezero, Shackleton and the nine Artemis III regions). A search from any other lunar or Mars place needs its own frozen fingerprint.
- Earth is covered between 56° S and 60° N, so polar analogs (Devon Island, the Dry Valleys) are not yet included.
- At 50 km and 1 km slope, almost every planetary window finds a strong Earth twin; separating hard-to-imitate terrain needs a finer scale or more variables (composition, illumination).
- The lunar light calendar is geometric: Earth's atmosphere brightens the sky and softens shadows, and it assumes a flat horizon.
- Land cover describes 2021, sampled at 100 m; it is not current site condition.
- Geology, climate, soil strength, moisture, continuous testable space and permits are not yet measured.
- Passing every filter does not qualify a site for NASA; all candidates stay provisional.
- Live evaluation runs locally, one job at a time, and needs Python plus local data. The basemap and imagery need an internet connection.

## Use of AI

The team used Claude (Anthropic) as a coding and writing assistant; AI-assisted commits carry a co-author line. AI is not part of how Parallax ranks or classifies places: the ranking is a deterministic distance between measured slope distributions (plus measured bare ground for Mars), and every validation was pre-registered before results were computed.

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

1. Features that separate Moon-like from Mars-like terrain (fine-scale roughness, illumination, composition), soil texture (SoilGrids) and protected areas as new conditions, and 60 m fine relief beyond the 538 windows measured so far.
2. A characterization dossier per candidate: what is measured, what fails, what is unknown, and the field measurement that would close each gap.
3. Multi-scale terrain (Copernicus GLO-30) so crater-scale analogs such as Meteor Crater become visible, plus geology, climate, soil, access and protected areas.
4. Review by a geoscience / GIS expert and a second, contrasting Earth region.
5. Coverage of polar analogs (Haughton, Devon Island, Svalbard) with a high-latitude elevation model.
6. A hosted geospatial service with saved projects and shareable site dossiers.
