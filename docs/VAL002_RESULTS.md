# VAL-002 — Blind test on Apollo astronaut geology-training sites

Pre-registration: [`config/validation/apollo_training_v1.yaml`](../config/validation/apollo_training_v1.yaml), committed before evaluation (f072663).
Results: [`results/validation/val002_apollo_training.json`](../results/validation/val002_apollo_training.json) (and `.csv`).
Method, references, null distribution and metrics are identical to [VAL-001](VAL001_RESULTS.md).

## Why

VAL-001 had only three eligible Moon-use sites, so its lunar result (AUC 0.74, p = 0.08) was inconclusive. VAL-002 adds an independent set chosen by a fixed rule: every Apollo geology-training location listed in Wikipedia's "Apollo program training", resolved to the feature whose own article states the training.

## Results

| Analysis | Sites | AUC | Median percentile | In closest 10 % | Permutation p | Verdict |
|---|---|---|---|---|---|---|
| **H3** Apollo training sites vs Shackleton | 8 | **0.77** | 17 % | 2 | **0.004** | Supported |
| **H4** All Moon-use sites (VAL-001 + VAL-002) vs Shackleton | 11 | **0.76** | 19 % | 3 | **0.001** | Supported |
| Apollo training sites vs Jezero (exploratory) | 8 | 0.77 | 20 % | 2 | 0.004 | — |

## Per site (rank among the 224 index windows plus the site; 1 = closest)

| Site | Shackleton rank | Jezero rank |
|---|---|---|
| Valley of Ten Thousand Smokes, Alaska | **7** | 103 |
| Grand Canyon, Arizona (representative point) | **15** | 55 |
| Rio Grande Gorge, New Mexico (Apollo 15 training) | 34 | **2** |
| Orocopia Mountains, California | 34 | 37 |
| Nevada Test Site (representative point) | 44 | 25 |
| Newberry Volcano, Oregon | 62 | 12 |
| Nördlinger Ries, Germany | 101 | 74 |
| Sudbury Basin, Ontario | 121 | 107 |

## Reading the two validations together

- **Parallax recognises the terrain that space agencies choose for planetary field work.** Mars-use analogs sit in the closest ~19 % of Earth for Jezero (VAL-001, p = 0.007); the 11 Moon-use sites sit in the closest ~19 % for Shackleton (p = 0.001). The sites were chosen from independent sources and frozen before evaluation.
- **It does not yet tell the Moon from Mars by slopes alone.** Apollo sites are as close to Jezero as to Shackleton. What the 1 km slope signature captures is "rugged, sparsely vegetated planetary-analog terrain" versus typical Earth land. Individual sites still lean one way (Katmai and the Grand Canyon toward Shackleton; Rio Grande Gorge toward Jezero), and separating the bodies needs more layers (roughness at finer scales, illumination, composition).
- **Expected misses are informative.** Large, eroded or vegetated impact structures (Sudbury, Ries) and a 1.2 km crater (Meteor Crater) are not visible to a 50 km, 1 km-grid slope fingerprint.

## Limits

Small samples; two VAL-002 points are representative regional coordinates; one morphological feature only. Results support Parallax as a traceable regional pre-selection signal, not as site qualification.
