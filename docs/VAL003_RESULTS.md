# VAL-003 — Model v2 (relief + bare ground) on an independent site list

Pre-registration: [`config/validation/atlas_sites_v1.yaml`](../config/validation/atlas_sites_v1.yaml), committed before evaluation (726b24b).
Results: [`results/validation/val003_atlas_sites.json`](../results/validation/val003_atlas_sites.json) (and `.csv`). How to run: [`VAL003_RUN.md`](VAL003_RUN.md).

## What was tested

- **Model v1:** the 1 km slope fingerprint used in VAL-001/002.
- **Model v2:** `0.5 × slope distance + 0.5 × (1 − bare ground)`, where bare ground is the WorldCover 2021 "bare / sparse vegetation" share of the 50 km window. The weight was fixed before evaluation and never tuned.
- **Test set:** the 38 analog sites published by another Space Apps 2026 team, [Analog Atlas](https://github.com/clickTwice26/nasc) (MIT, commit 4206f43), with Moon/Mars assignment taken from its own `analog_for` field. We did not choose the sites.
- **Null:** the same 224 systematic index windows; all 224 had complete land cover.

Of the 38 sites: 24 eligible; 8 outside the elevation coverage (polar/Antarctic), 2 indoor facilities, 3 with < 90 % land in the window (Lanzarote, Kīlauea, Teide), 1 terrain evaluation error (Armash, AMADEE-24). All are listed in the results file.

## Results

| Hypothesis | Sites | Model v1 | Model v2 | Verdict |
|---|---|---|---|---|
| **H5** Mars-use sites vs Jezero | 21 | AUC 0.67 (p = 0.004) | **AUC 0.78** (p < 0.001), 7 in closest 10 % | Supported |
| **H6** Moon-use sites vs Shackleton | 11 | AUC 0.69 (p = 0.014) | AUC 0.64 (p = 0.055) | Not supported |
| **H7** v2 better than v1, Mars | 21 | | +0.10 (95 % CI +0.01 to +0.20) | Supported |
| **H7** v2 better than v1, Moon | 11 | | −0.05 (95 % CI −0.11 to +0.02) | Not supported |

Secondary analyses:

| Analysis | Sites | v1 | v2 |
|---|---|---|---|
| Mars, sites never used in VAL-001/002 | 12 | 0.63 (p = 0.06) | **0.74 (p = 0.002)** |
| Moon, sites never used in VAL-001/002 | 5 | 0.70 (p = 0.07) | 0.61 (p = 0.20) |
| Atlas's own theme rule for Jezero (arid or evaporite) | 16 | 0.68 | **0.82** (p < 0.001), 7 in closest 10 % |

Analog Atlas reports AUC 0.831 for Jezero with its own 21-variable model on the same theme rule. Model v2 reaches 0.824 with two variables. The negatives differ slightly (Atlas: all 0.5° land cells; Parallax: windows with ≥ 90 % land), so the comparison is close but not identical.

## What it means

- **For Mars, bare ground belongs in the model.** Adding it raises recognition of established Mars analogs from 0.67 to 0.78, and the gain holds on sites the model had never seen.
- **For the Moon, it does not.** Lunar field-training sites were chosen for geology (impact structures, lava fields), and several are vegetated (Sudbury, Ries, Mistastin, Lonar). Relief alone ranks them better.
- **Product decision (made after seeing these results):** Mars targets use model v2; Moon targets keep model v1. Because this choice follows the data, it needs confirmation on new sites before being presented as validated.
