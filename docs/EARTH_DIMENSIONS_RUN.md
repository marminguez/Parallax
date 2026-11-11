# Earth dimensions v1 — how to run

Frozen rules: [`config/search/earth_dimensions_v1.yaml`](../config/search/earth_dimensions_v1.yaml) and amendment [`v1.1`](../config/search/earth_dimensions_v1_1_amendment.yaml) (centres rounded to 4 decimals, B1 at the published precision). Every eligible VAL-004 Earth window (42,405) gets five Earth-side dimensions, measured with the twin characterization code unchanged.

Every invocation first runs **B1**: the 21 VAL-004 twins must reproduce their published values. A dimension that fails B1 is not run. Paste the B1 output back before going further if anything fails.

## Inputs (the same files used for the twin sheets)

| Dimension | Input | Flag |
|---|---|---|
| rock | GLiM 0.5° folder (`glim_wgs84_0point5deg.txt.asc`, `Classnames.txt`) | `--glim` |
| access | GPWv4 population density 2020, 2.5′ | `--gpw` |
| permafrost | Global Permafrost Zonation Index | `--pzi` |
| temperature | NASA POWER (internet; cached in `data/cache/power/`) | — |
| ground | ESA WorldCover 2021 (internet, AWS; or local tiles) | `--worldcover-root` (optional) |

## Steps

```bash
git checkout main && git pull
python -m pip install -e ".[geo,dev]"
python -m pytest tests/test_earth_dimensions.py

# 1. B1 and timing only: no new window is measured
python scripts/earth_dimensions.py --twins-only --dims rock access permafrost temperature ground \
  --glim /mnt/c/Parallax/proyecto/data/glim \
  --gpw data/gpw/gpw_v4_population_density_rev11_2020_2pt5_min.tif \
  --pzi /mnt/c/Parallax/proyecto/data/pzi/PZI.flt

# 2. Full run, cheapest first. Resumable: Ctrl-C and run the same command again.
python scripts/earth_dimensions.py --dims rock access permafrost --glim ... --gpw ... --pzi ...
python scripts/earth_dimensions.py --dims temperature --workers 4
python scripts/earth_dimensions.py --dims ground --workers 8

# Requests that failed (network) can be tried again with the same method:
python scripts/earth_dimensions.py --dims temperature --retry-errors --workers 4

# 3. Outputs from the dimensions that are complete
python scripts/earth_dimensions.py --assemble
```

Step 1 prints seconds per window and the projected hours for each dimension. If a dimension is too slow, stop: any change of method is an amendment written before computing other windows.

## Outputs

- `results/earth_dimensions/checks_v1.json`: B1 per dimension and timing.
- `results/earth_dimensions/earth_dimensions_v1.csv`: one row per window, complete dimensions only, with the reason for every missing value.
- `results/earth_dimensions/run_v1.json`: provenance, coverage, predictions P1–P4.
- `web/data/earth-index.csv`: what the search will read (next pull request, with check B2).
- `results/earth_dimensions/partial/`: resume files, kept local (gitignored).

Commit the first four. A dimension enters the outputs only when every window has been attempted.

## After the run: web search (check B2)

```bash
python scripts/export_earth_index_extras.py   # place labels (display only) and VAL-004 land fractions
python scripts/check_b2.py                    # Python distances for 20 windows, seed 2026
cd web && npm test                            # earth-index.test.mjs compares the web search with them (1e-9)
```

The experiment search then ranks `web/data/earth-index.csv` for Jezero and Shackleton (Jezero with the Mars model v2 score), and offers the five terrain conditions as filters. The generic slope search (no planetary reference) keeps the EXP-001B pilot, the only index with a regional P95.

## Artemis III references (artemis_references_v1)

```bash
python scripts/artemis_references.py   # freezes the 9 region fingerprints, runs C1, evaluates P1
```

Rules: [`config/search/artemis_references_v1.yaml`](../config/search/artemis_references_v1.yaml). Each Artemis III region becomes a search reference from its VAL-004 lunar window. C1: with no conditions, every region's first result is its published reverse-map twin. Results in `results/artemis_references/run_v1.json`.

## Fine relief for search results (fine_relief_search_v1)

Rules: [`config/search/fine_relief_search_v1.yaml`](../config/search/fine_relief_search_v1.yaml). 60 m relief (Copernicus GLO-30, read from AWS) for 538 windows: the top 50 of each of the 11 references, the top 50 drilling candidates of each lunar reference and the 21 twins. Check F1 runs first on the 21 twins.

```bash
python scripts/fine_relief_search.py --twins-only      # F1 and timing, no new window
python scripts/fine_relief_search.py --workers 6       # resumable; Ctrl-C is safe
python scripts/fine_relief_search.py --retry-errors --workers 2   # if network errors remain
python scripts/fine_relief_search.py --assemble        # results/fine_relief/fine_relief_v1.json, web/data/fine-relief.json
```

## Soil texture (soil_texture_v1)

Rules: [`config/search/soil_texture_v1.yaml`](../config/search/soil_texture_v1.yaml). Topsoil (0-5 cm) sand, silt, clay and coarse fragments from SoilGrids 2.0 aggregated 1000 m maps (ISRIC, CC BY 4.0), for all 42,405 index windows. Earth-side only: no planet value, no verdict, never changes the order. SoilGrids masks bare surface, so the barest windows have the least soil data.

Download the four files (about 750 MB) and ISRIC's checksums, from the repository root:

```bash
mkdir -p data/soilgrids
for v in sand silt clay cfvo; do
  base="https://files.isric.org/soilgrids/latest/data_aggregated/1000m/$v"
  f="${v}_0-5cm_mean_1000.tif"
  curl -fL -C - -o "data/soilgrids/$f" "$base/$f"
  curl -fsS "$base/checksum.sha256.txt" | grep "$f" > "data/soilgrids/$f.sha256"
  (cd data/soilgrids && sha256sum -c "$f.sha256")
done
```

Then:

```bash
python scripts/soil_texture.py --twins-only   # checksums, S1 on the 21 twins, their values, timing
python scripts/soil_texture.py                # all windows; resumable, Ctrl-C is safe
python scripts/soil_texture.py --assemble     # S2, P1-P3, results/soil_texture/*, web/data/soil-texture.csv
```
