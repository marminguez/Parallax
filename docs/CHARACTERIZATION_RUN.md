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
- Jezero fine relief uses `data/mars/jezero/raw/M20_JezeroCrater_CTXDEM_20m.tif` ([USGS download](https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif), 87 MB). The mosaic does not contain the VAL-004 grid window, so Jezero is measured at the frozen reference centre (the landing site), as in the VAL-004 bridge test. Other Mars sites are reported as not measured.
- Where Copernicus GLO-30 publishes no tile (for example around Armenia and Azerbaijan), the Earth side is reported as not measured.
- Earth tiles and NASA POWER need an internet connection; POWER answers are cached in `data/cache/power/`.
- Run one destination first to check: `--only nobile-rim-1`. A dimension that fails is recorded as an error in the output, never filled in.

Outputs: `results/characterization/twin_sheets_v1.json` (full record with fingerprints and provenance) and `web/data/twin-sheets.json` (what the Missions page shows). Commit both.

## Ice and permafrost (v1.1)

Frozen configuration: [`config/characterization/ice_v1.yaml`](../config/characterization/ice_v1.yaml).

| Side | Data | Signal (fixed in advance) |
|---|---|---|
| Moon | LOLA permanent shadow map, 120 m (NASA GSFC PGDA), read remotely | ≥ 1 % of the window in permanent shadow |
| Mars | SWIM 4 MIM combined ice consistency 0–1 m, 3 km (NASA / PSI), 60 S to 60 N | ≥ 25 % of cells consistent with ice (value > 0) |
| Earth | Global Permafrost Zonation Index, 1 km (Gruber 2012, University of Zurich) | ≥ 25 % of cells with index ≥ 0.5 |

Verdict: holds (both), breaks (destination only), no ice (neither), Earth only.

**Amendment v1.2 (made after seeing the v1.1 results):** [`ice_v1_2_amendment.yaml`](../config/characterization/ice_v1_2_amendment.yaml). On Mars a cell counts as ice only at SWIM consistency ≥ 0.25, because SWIM defines values near 0 as inconclusive; v1.1 counted anything above 0 and flagged four near-equatorial sites (Spirit, Opportunity, Curiosity, Eberswalde). Both verdicts are kept in the results (`verdict` and `verdict_v1_1`). The same commit fixes a reading bug: the lunar shadow map stores 0/1 as scaled integers.

Downloads (once):
- SWIM: on [swim.psi.edu/SWIM4MIMProducts.php](https://swim.psi.edu/SWIM4MIMProducts.php), the GeoTIFF of the *Combined Ice Consistency Map (0-1 m)* into `data/swim/`.
- Permafrost: from [the University of Zurich page](http://www.geo.uzh.ch/microsite/cryodata/pf_global/), the global PZI raster into `data/pzi/`.

```bash
python scripts/characterize_twins.py --skip fine_relief temperature operations \
  --swim data/swim/<ice consistency 0-1 m file>.tif --pzi data/pzi/<PZI raster>
```

The run only adds the ice dimension: results already in `results/characterization/twin_sheets_v1.json` stay.

## Bare ground and dust (characterization v1.3)

Frozen in [`ground_v1.yaml`](../config/characterization/ground_v1.yaml) before computing. Every Moon and Mars window is covered by loose fine material at 50 km (regolith; dust, sand and soil), so the destination side is a reference, not a measurement. The Earth side is the share of the twin's 50 × 50 km window that ESA WorldCover 2021 classes as bare / sparse vegetation, sampled every 100 m with `scripts/land_cover.py`.

| Verdict | Bare share |
|---|---|
| holds | ≥ 50 % |
| partly | 20–50 % |
| breaks | < 20 % |

Snow and ice share, vegetated share and the dominant class are reported beside it. No download: tiles are read over HTTP from the public AWS bucket, only the window.

```bash
python scripts/characterize_twins.py --skip fine_relief temperature operations ice
```

The analogy is about open, loose ground to move and dig on, never about the dust itself: lunar dust is sharp and electrostatically charged; Martian dust is about 3 µm and oxidizing.

## Limits

- Temperature ranges for the Moon and Mars are body-wide literature values, not per-site measurements. Earth values are monthly climatology of skin temperature, not extremes.
- Population is a proxy for access; roads, protected areas, ownership and security are not measured.
- Earth cannot reproduce reduced gravity, vacuum, Mars's thin atmosphere or radiation.
