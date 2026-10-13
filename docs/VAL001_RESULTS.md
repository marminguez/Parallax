# VAL-001 — Blind recovery of established Moon/Mars analogs

Pre-registration: [`config/validation/known_analogs_v1.yaml`](../config/validation/known_analogs_v1.yaml), committed before any site was evaluated.
Results: [`results/validation/val001_known_analogs.json`](../results/validation/val001_known_analogs.json) (and `.csv`).
Script: `scripts/validate_known_analogs.py`.

## Question

Do sites that agencies and researchers already use as Moon or Mars analogs look more like the planetary reference than a typical Earth window does, judged only by Parallax's 1 km slope-distribution distance? The model never saw these names or coordinates.

## Headline results

| Analysis | Sites | AUC | Median percentile | In closest 10 % | Permutation p | Verdict |
|---|---|---|---|---|---|---|
| **H1** Mars-use analogs vs Jezero (primary) | 7 | **0.76** | 19 % | 2 | **0.007** | Supported |
| **H2** Moon-use analogs vs Shackleton (primary) | 3 | 0.74 | 28 % | 1 | 0.081 | Same direction, not significant (n = 3) |
| Mars-use analogs vs Shackleton (exploratory) | 7 | 0.74 | 26 % | 1 | 0.017 | — |
| Moon-use analogs vs Jezero (exploratory) | 3 | 0.68 | 41 % | 1 | 0.149 | — |

AUC 0.5 = no closer than a random Earth window; 1.0 = closer than every window. Null: the 224 eligible windows of the EXP-001B systematic sample (none overlapped an analog site). 10,000 permutations, seed 2026.

## Per site

Rank = position among the 224 index windows plus the site (1 = closest to the target).

| Site | Used for | Jezero rank | Shackleton rank |
|---|---|---|---|
| Atacama, Yungay | Mars | **1** (closer than every window) | 48 |
| Mars Desert Research Station, Utah | Mars | **6** | 59 |
| SP Crater / Black Point, Arizona | Moon (Artemis tests) | 10 | 64 |
| Mojave (Dumont Dunes) | Mars | 41 | 28 |
| Río Tinto | Mars (chemistry) | 43 | 64 |
| Qaidam Basin | Mars | 80 | 92 |
| Meteor Crater, Arizona | Moon (Apollo training) | 93 | 101 |
| Death Valley (Badwater) | Moon/Mars (named in the challenge) | 101 | **9** |
| Namib (Gobabeb) | Mars | 105 | 121 |
| Mauna Kea, Hawaii | Moon (ISRU tests) | 115 | **13** |
| Lanzarote (Timanfaya) | Moon/Mars | — | — (excluded: 16 % land in the 50 km window) |

## What it means

- **Mars:** established Mars analogs are clearly closer to Jezero's terrain than typical Earth land. The hyperarid core of the Atacama is closer to Jezero than any of the 224 sampled windows.
- **Moon:** the trend points the same way (Mauna Kea and Death Valley rank 13th and 9th for Shackleton), but three eligible sites are not enough for significance. More lunar analog sites are needed.
- **Body specificity is partial.** Mars analogs are also closer than average to Shackleton (exploratory). Slopes alone separate "analog-like" terrain from typical Earth better than they separate Moon-like from Mars-like terrain, although individual sites lean clearly one way (Atacama and Utah toward Jezero; Mauna Kea and Death Valley toward Shackleton).
- **Scale matters.** Meteor Crater is 1.2 km wide; a 50 km window at 1 km resolution cannot see it. Sites chosen for chemistry (Río Tinto) or climate are not expected to match by regional slopes.

## Limits

Small samples (n = 7 and 3); several coordinates are representative points (precision noted in the pre-registration); polar analogs (Haughton, Devon Island, Antarctica) are outside the elevation data's coverage; one morphological feature only. These results support Parallax as a regional pre-selection signal, not as site qualification.
