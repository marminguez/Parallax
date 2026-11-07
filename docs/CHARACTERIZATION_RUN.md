# Twin characterization v1 — how to run

Frozen configuration: [`config/characterization/dimensions_v1.yaml`](../config/characterization/dimensions_v1.yaml), committed before any value was computed. Descriptive only: it adds three dimensions to every destination's twin sheet and never changes a VAL-004 twin or ranking.

| Dimension | Earth | Destination | Verdict bands (fixed in advance) |
|---|---|---|---|
| Fine relief (60 m) | Copernicus DEM GLO-30, read directly from AWS Open Data | LOLA 20 m (Moon); CTX 20 m (Jezero only) | distance ≤ 0.10 holds · ≤ 0.30 partly · above breaks |
| Surface temperature | NASA POWER climatology, TS_MIN / TS_MAX | Literature range per body (Moon −203 to 54 °C; Mars −83 to −13 °C) | share of the destination range covered ≥ 0.5 holds · ≥ 0.2 partly · below breaks |
| Access | NASA SEDAC GPWv4 population density 2020 (2.5′) | — | mean < 1 /km² remote · < 25 rural · above populated |

## Steps (on the machine with the VAL-004 data)

```bash
git fetch origin && git checkout feat/twin-characterization
python -m pip install -e ".[geo,dev]"
python -m pytest tests/test_characterize.py

# Population: download once from NASA Earthdata (free account), unzip into data/gpw/
#   "Gridded Population of the World (GPW), v4: Population Density, Revision 11", 2020, 2.5 arc-minutes, GeoTIFF
python scripts/characterize_twins.py --gpw data/gpw/gpw_v4_population_density_rev11_2020_2pt5_min.tif
```

- The Moon side uses `data/moon/LDEM_80S_20MPP_ADJ.TIF` if present, otherwise it reads the windows from the PGDA URL.
- Jezero fine relief uses `data/mars/jezero/raw/M20_JezeroCrater_CTXDEM_20m.tif`. Other Mars sites are reported as not measured.
- Earth tiles and NASA POWER need an internet connection; POWER answers are cached in `data/cache/power/`.
- Run one destination first to check: `--only nobile-rim-1`. A dimension that fails is recorded as an error in the output, never filled in.

Outputs: `results/characterization/twin_sheets_v1.json` (full record with fingerprints and provenance) and `web/data/twin-sheets.json` (what the Missions page shows). Commit both.

## Limits

- Temperature ranges for the Moon and Mars are body-wide literature values, not per-site measurements. Earth values are monthly climatology of skin temperature, not extremes.
- Population is a proxy for access; roads, protected areas, ownership and security are not measured.
- Earth cannot reproduce reduced gravity, vacuum, Mars's thin atmosphere or radiation.
