# VAL-004 — the reverse map: how to run

Pre-registration: [`config/validation/val004_reverse_map_v1.yaml`](../config/validation/val004_reverse_map_v1.yaml) and [`val004_overlays_v1.yaml`](../config/validation/val004_overlays_v1.yaml), committed before any grid was computed.
Script: `scripts/run_val004.py` (resumable; every stage appends as it goes).

## What it computes

| Stage | What | Data | Rough time |
|---|---|---|---|
| `earth` | Every 50 km Earth window between 56° S and 60° N (172,528 centres; only those with a local MOD44W tile are evaluated) with the unchanged `evaluate_candidate.py` | local SRTMGL30 + MOD44W (already on your machine) | ~0.4 s per window per worker → about 1–2 h with 7 workers |
| `moon` | 1 km grid of the whole lunar south polar cap, 50 km windows every 25 km, Shackleton bridge test | LOLA 20 m south-pole DEM | one pass over the file, ~10–20 min |
| `mars` | All of Mars, 57,939 windows at 50 km, Jezero bridge test (MOLA vs the CTX reference) | MOLA 463 m global DEM (2 GB) | ~15 ms per window → ~15 min with 7 workers |
| `twins` | Closest Earth window for every Moon/Mars window and the reverse, classes, overlays, predictions, Valencia, web export | outputs of the stages above | minutes |
| `images` | Moon and Mars class maps, shaded-relief thumbnails for the public page | both DEMs | minutes |

## 1. Download the two planetary DEMs (once)

```bash
mkdir -p data/moon data/mars
curl -L -C - -o data/mars/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif
curl -L -C - -o data/moon/LDEM_80S_20MPP_ADJ.TIF https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF
```

`-C -` resumes an interrupted download. Both files stay local (`/data/` is git-ignored).

## Amendment v1.1 — Moon bridge test (2026-10-29)

The v1.0 Moon bridge test could not run: it looked for grid windows within 12.5 km of Shackleton, but on a 25 km stride the nearest window centre is 15.6 km away, so `bridges.json` recorded `best: null` with no distance computed. [`val004_amendment_v1_1.yaml`](../config/validation/val004_amendment_v1_1.yaml) was committed before any Moon distance was seen: the test now uses the closest complete window at 1 km placement on the same grid (as the Mars test builds one window at Jezero). Tolerance and the on-failure rule are unchanged; the v1.0 outcome is kept under `moon.v1_0`.

```bash
python scripts/run_val004.py --stage moon-bridge   # uses the cached 1 km Moon grid; seconds
```

Run it after the `moon` stage and before `twins`. A fresh `--stage moon` runs both tests.

## 2. Freeze the Artemis III region centres (before `twins`)

NASA has not published numeric coordinates for the nine regions. Digitise each centre from NASA's official region map and fill `lat`/`lon` in `config/validation/val004_overlays_v1.yaml` (`status: digitised from NASA map`), then **commit before running `twins`**. If you skip this, the regions are reported as "not evaluated" and can only be added in a v2.

## 3. Run

From the repository root, in the environment used for live evaluation:

```bash
python scripts/run_val004.py --plan                          # counts and data checks, nothing computed
python scripts/run_val004.py --check                         # 1 Earth window + both bridge tests; must end with CHECK OK
nohup python scripts/run_val004.py --stage earth --workers 7 > results/val004/earth.out 2>&1 &
python scripts/run_val004.py --stage moon
python scripts/run_val004.py --stage mars --workers 7
python scripts/run_val004.py --stage twins
python scripts/run_val004.py --stage images
```

Or everything in one go: `nohup python scripts/run_val004.py --workers 7 > results/val004/all.out 2>&1 &`. If anything stops, run the same command again: finished windows are not recomputed.

## 4. What to commit

- `results/validation/val004_reverse_map.json` and `.csv` (the result), `results/val004/bridges.json`, `results/val004/run.log`, the `*_twins.csv` files.
- `web/public/reverse/` (the public page's data, maps and thumbnails).
- The window CSVs (`results/val004/*_windows.csv`) are a few MB each; commit them for reproducibility.
- `results/val004/cache/` stays local.

## Rules

- Thresholds, classes, bridge tolerance and predictions are frozen. The script recomputes the thresholds from VAL-001/002 and stops if they differ from the freeze.
- If a bridge test fails, that body's map is labelled exploratory everywhere (results file and public page). It is not fixed and re-run.
- The Valencia result is computed once and reported as it comes out.
