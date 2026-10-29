# VAL-004 — The reverse map: Moon and Mars, seen from Earth

Pre-registration: [`config/validation/val004_reverse_map_v1.yaml`](../config/validation/val004_reverse_map_v1.yaml) and [`val004_overlays_v1.yaml`](../config/validation/val004_overlays_v1.yaml), committed before any grid was computed (ea5fd39, 28 Oct 2026).
Amendment: [`val004_amendment_v1_1.yaml`](../config/validation/val004_amendment_v1_1.yaml) (Moon bridge test, 48ed5c6).
Results: [`results/validation/val004_reverse_map.json`](../results/validation/val004_reverse_map.json) (and `.csv`), window tables in `results/val004/`. How to run: [`VAL004_RUN.md`](VAL004_RUN.md).

## Answer

**At 50 km and 1 km slope, Earth has a strong twin for every window of the lunar south polar cap (529 of 529) and for 99.9 % of Mars (57,891 of 57,939).** Nothing on either body falls in the "no twin" class. Two of the three predictions registered in advance fail. The question Parallax answers is therefore not *whether* a place can be rehearsed on Earth at this scale, but *where* its closest twin is and *what else* (land cover, light, logistics) makes that twin usable.

## What was measured

- **The same fingerprint as every Parallax validation:** the 1 km slope distribution of a 50 × 50 km window in 8 frozen classes, compared with the base-2 Jensen–Shannon distance (model v1, relief only).
- **Earth:** every 50 km window between 56° S and 60° N with the unchanged `evaluate_candidate.py` (SRTMGL30 + MOD44W). Only windows with ≥ 90 % land serve as twins.
- **Moon:** the whole LOLA 20 m south-pole DEM, block-mean to 1 km in its polar plane, 50 km windows every 25 km.
- **Mars:** all of Mars from MOLA 463 m, 50 km spacing, Earth method.
- **Classes,** frozen before the run from the distance of each established analog in VAL-001/002 to its own target (18 pairs): strong twin ≤ 0.299 (q25), twin ≤ 0.473 (q50), partial ≤ 0.850 (q90), no twin above.

## Grids reproduce their references

| Body | Bridge test | Distance | Tolerance | Verdict |
|---|---|---|---|---|
| Mars | MOLA window at Jezero vs the CTX-based Jezero reference | 0.0638 | 0.15 | **PASS** |
| Moon | Grid window 0.51 km from Shackleton's centre vs the frozen Shackleton reference (v1.1) | 0.0129 | 0.15 | **PASS** |

Both maps count as results, not exploratory.

**Moon bridge, v1.0 → v1.1.** The pre-registered v1.0 test used grid windows within 12.5 km of Shackleton's centre, but on a 25 km stride the nearest centre is 15.6 km away: it found no window and returned `best: null` without computing any distance. The radius did not fit the stride. The amendment (same grid, closest window at 1 km placement, same tolerance and failure rule) was committed before any Moon distance was seen and before the twins stage. The v1.0 outcome is kept in `results/val004/bridges.json` under `moon.v1_0`.

## Results

| Body | Windows | Strong twin | Twin | Partial | No twin | Median distance |
|---|---|---|---|---|---|---|
| Moon (south polar cap) | 529 | **100 %** | 0 | 0 | 0 | 0.042 |
| Mars (whole planet) | 57,939 | **99.92 %** | 0.08 % (48) | 0 | 0 | 0.022 |

- **Hardest Moon window:** 83.5° S, 119.3° E, distance 0.136, still a strong twin.
- **The 48 Mars windows without a strong twin** cluster on the giant volcanoes and Valles Marineris: Olympus Mons and its scarp (14–21° N, 130–138° W; the hardest window, 16.2° N 135.7° W, d = 0.437), Elysium Mons and Hecates Tholus (24–31° N, 146–151° E), Arsia and Pavonis Mons, and the walls of the Valles Marineris chasmata (5–14° S, 50–80° W). This grouping is descriptive, read after the run.
- **Earth twins are spread out:** the 529 Moon windows use 385 different Earth windows; the 57,939 Mars windows use 15,488. The Moon's closest twins are mostly high, steep mountain ranges (China, Peru, Canada, Iran, the western US, Mexico, Chile).

### Predictions (registered before computing)

| | Prediction | Outcome | Verdict |
|---|---|---|---|
| P1 | The lunar south pole has a larger no-twin share than Mars | 0 % on both | **Not supported** |
| P2 | Most Mars windows have at least a partial twin; no-twin windows concentrate in steep terrain | 100 % have one; no no-twin windows (true by the operational rule) | Supported |
| P3 | The Shackleton window is partial or no twin | Strong twin, d = 0.073 | **Not supported** |

### Why nearly everything is a strong twin

The thresholds measure how close *one* established analog is to *one* reference. Each planetary window, instead, keeps the *best* of 42,405 eligible Earth windows. A minimum over tens of thousands of candidates is far smaller than a typical single pair, so almost every window lands below q25. With slope alone at 1 km, Earth's relief is varied enough to imitate almost any 50 km of the Moon or Mars. The classes were frozen and are not changed; a map that separates "hard to imitate" terrain would need a new, pre-registered question (for example, the hardest 10 % of windows, or a finer scale).

## Sites on the map

**Artemis III candidate regions** (centres digitised from NASA's 28 Oct 2024 map, see below):

| Region | Centre | Distance | Closest Earth twin (nearest place, GeoNames) |
|---|---|---|---|
| Nobile Rim 1 | 85.48° S, 37.38° E | 0.017 | Barishal, Gilgit-Baltistan (PK) · 36.9° N, 74.7° E |
| Peak near Cabeus B | 83.71° S, 68.66° W | 0.030 | Taqchah Khanah, Takhar (AF) · 36.4° N, 69.6° E |
| Mons Mouton Plateau | 84.39° S, 30.61° E | 0.035 | Huacrachuco, Huánuco (PE) · 8.6° S, 77.0° W |
| de Gerlache Rim 2 | 88.25° S, 64.26° W | 0.042 | Lordegan, Chaharmahal and Bakhtiari (IR) · 31.5° N, 51.1° E |
| Nobile Rim 2 | 84.01° S, 58.82° E | 0.046 | Huaribamba, Huancavelica (PE) · 12.2° S, 74.9° W |
| Slater Plain | 87.19° S, 125.30° E | 0.049 | Calingasta, San Juan (AR) · 31.0° S, 69.0° W |
| Malapert Massif | 86.03° S, 0.11° W | 0.063 | Skardu, Gilgit-Baltistan (PK) · 35.1° N, 75.8° E |
| Haworth | 86.80° S, 22.54° W | 0.063 | Invermere, British Columbia (CA) · 50.3° N, 115.5° W |
| Mons Mouton | 85.47° S, 31.82° E | 0.075 | Shanjiao, Yunnan (CN) · 27.4° N, 103.3° E |

All nine are strong twins. Place names are the nearest GeoNames settlement to the Earth window's centre, for orientation only.

**Mars landing sites:** all 11 are strong twins (distance 0.000–0.063). Viking 2 (Utopia Planitia) scores 0.000 because both its window and its Earth twin (inland Queensland, Australia) are entirely flatter than 1°.

**Valencia** (39.47° N, 0.38° W; window 19.7 km away, 97 % land): its closest Mars window is at 33.6° S, 170.4° W (d = 0.019, strong twin); its closest Moon window is at 78.0° S, 137.8° E (d = 0.086, strong twin). Computed once, reported as it came out.

## Coverage of the Earth grid

| Earth centres | Count | Reason |
|---|---|---|
| All centres, 56° S – 60° N, 50 km spacing | 172,528 | |
| No MOD44W land tile | 52,234 | Open ocean, skipped before evaluation |
| Crossing the antimeridian | 119 | Not supported, skipped (as in the blind pilot) |
| No finite slope values | 68,561 | Sea or coast inside a land tile: SRTMGL30 has no data over water |
| SRTM tile-boundary errors | 1,108 | Evaluator limitation at some tile seams (logged in `earth_errors.csv`) |
| **Evaluated** | **50,506** | 42,405 eligible (≥ 90 % land) · 45,852 shown on the public page (≥ 50 %) |

The 1,108 tile-seam windows (2 % of land windows) lie in strips along SRTMGL30 tile edges. Removing candidates can only make twins farther, so they do not change the result.

## Artemis III region centres: how they were obtained

NASA has not published numeric coordinates for the nine regions ([NASA, 28 Oct 2024](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/); [George et al., LPSC 2026](https://ntrs.nasa.gov/citations/20250011660)). The centre of each yellow box was read from NASA's official map, which has no lat/lon grid, using its own marks: the South Pole star as origin, the 50 km bar as scale (3.62 px/km) and the polar-stereographic convention (0° up, 90° E right). Check: both Nobile rim regions lie 39.2 and 41.7 km from Nobile's IAU centre, whose radius is 39.6 km. Expected error: a few km, inside the 25 km overlay radius. Reproducible with `scripts/digitise_artemis_regions.py`.

**Timing, stated plainly.** The v1 pre-registration asked for these coordinates "before the first run"; the overlays file asked for them before the twins stage. They were committed (7ba2eca) after the Earth, Moon and Mars grids were computed but before the twins stage, so no distance for these regions had been computed or seen. Overlays never change the map; they only report which window a region falls in.

## Limitations

- Slope only, at 1 km over 50 km windows. Composition, illumination, temperature, ice, dust, gravity, vacuum and radiation are not measured; crater-scale features are invisible.
- Earth is covered only between 56° S and 60° N (no polar analogs such as Devon Island or the Dry Valleys).
- Source resolutions differ (SRTMGL30 ~0.9 km, MOLA 463 m, LOLA 20 m). The bridge tests check the planetary side only.
- Moon windows overlap (25 km stride): shares are window shares, not area shares.

## What it means for Parallax

- **At this scale, Earth can rehearse the whole lunar south pole and the whole of Mars.** Every Artemis III region has a strong Earth twin.
- **The value is the address, not the yes/no.** Parallax finds the specific Earth window that behaves most like each place, and then filters it by what makes a test site usable (bare ground for Mars, lunar-like light, access).
- **The few places Earth struggles to imitate are the obvious giants:** Olympus Mons and Valles Marineris. Even there, Earth's best twin is as close as a typical established analog.
