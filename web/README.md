# Parallax web application

Next.js 16 front end and search API for Parallax. See the [project README](../README.md)
for the problem, method and data sources.

## Getting started

Run `npm ci` inside `web` first. `npm run dev` and `npm run build`
automatically copy the MapLibre module worker and its shared module from the
installed package into `public`. Both files must be served together; copying
only the worker causes the map to fail with a missing shared-module request.

```bash
npm ci
npm run dev        # http://localhost:3000
npm test           # production build + API and unit tests
npm run lint
```

The discovery map uses CARTO's hosted dark basemap and the satellite previews use
Esri World Imagery; both require internet access (pages show coordinates instead
when offline). Fonts are self-hosted (Geist from the `geist` package, Instrument
Serif in `src/fonts`, SIL OFL), so the app builds and runs without Google Fonts.

### Public site: three audiences

| Route | Audience | What it does |
|---|---|---|
| `/` | Everyone | The result in one line, the three uses and the validation record |
| `/misiones` | Agencies, science teams, analog missions | Artemis III regions, Shackleton, Mars landing sites and Jezero with their Earth twin; the Mars windows Earth cannot imitate; link to the experiment search |
| `/educacion` | Schools, museums, planetariums | Nearest Moon-like and Mars-like field trip within a travel radius, four classroom activities, link to screen mode |
| `/educacion/pantalla` | Museum or planetarium screen | QR code to `/bajo-tus-pies` and a self-advancing tour of destinations (stops if the system asks for reduced motion) |
| `/territorio` | Regions, geoparks, tourism | An area's analog profile ranked against all measured Earth terrain, a printable sheet and a verifiable sentence with what can and cannot be claimed |
| `/bajo-tus-pies` | Visitors (QR) | Your location's Moon and Mars twins |
| `/experiments/new` | Mission planners | The full experiment search |

Everything is Spanish first with an English toggle (stored per device). The pages read
`data/val004-sites.json` and `public/reverse/places/`, both written by
`python scripts/export_web_sites.py` from the VAL-004 results (no distance is
recomputed). Add `--thumbs` on a machine with the Moon and Mars DEMs to render the
destination thumbnails; until then the pages show a crop of the global relief map.

### Place names and site grouping

Results show a region and nearest settlement for each window centre, from an
offline GeoNames table bundled in `src/parallax/places` (CC BY 4.0). Labels for
the measured index are precomputed in `data/earth-candidate-places.json`
(`python scripts/build_place_labels.py` from the repository root regenerates
them); live searches label new centres in the Python runner. Within 50 km the
label names the region; farther away it reads "Remote area" and gives the
distance to the nearest settlement. Labels are joined after ranking and never
affect matching, filtering or order.

After ranking and the result limit, returned windows whose 50 × 50 km
footprints overlap a better-ranked window are grouped into that window's site
(greedy, non-transitive). The API adds `site` to each candidate and
`independentSites` to the result; the raw order is unchanged. The results panel
groups by default and can be switched to show every window. For the validated
Northern Spain search (centres within about 15 km), all nine windows form one
site.

## Request-driven experiment search

Open `/experiments/new`. Indexed terrain searches work immediately after
`npm ci` and `npm run dev`: the measured pilot CSV is bundled in `web/data`.
This searches 986 recorded windows; it does not scan the whole planet.
Change bounds, slope constraints and ranking target to get different results.
The previous fixed EXP-001 discovery URL now redirects to this search.

Facility mode discovers documented capabilities at three NASA centres. It does
not verify numeric test envelopes, access, bookings or suitability. Strict
mode excludes candidates with any unresolved critical evidence.

### Evaluate new locations using the local scientific engine

From the repository root, install the Python environment:

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[geo,dev]"
cd web
$env:PARALLAX_PYTHON = (Resolve-Path ..\.venv\Scripts\python.exe).Path
npm run dev
```

Linux/macOS:

```bash
source .venv/bin/activate
python -m pip install -e '.[geo,dev]'
cd web
PARALLAX_PYTHON=../.venv/bin/python npm run dev
```

Use the existing download/extraction scripts to prepare required SRTMGL30
ZIPs in `data/earth/coarse/raw` and native MOD44W masks in
`data/earth/mod44w/processed`. These large rasters are not committed. Existing
local datasets can be reused. The target is
`results/exp001/jezero_target_50km_v0_4.json`.

Select live evaluation and enter a region no larger than 10 degrees per axis,
within SRTM latitude coverage. The server evaluates a 3 × 3 sample of new
centres, with a 50 km window per centre, and reports errors individually. It
allows one live job per Node process and stops after 110 seconds. Missing data
returns a clear error, not fabricated candidates. This mode is designed for
local use; serverless deployment requires a separate geospatial worker and
job queue. Centre bounds do not constrain the whole 50 km window.

### Validation and production boundaries

`npm test` builds and tests the actual search API. `npm run lint` checks code.
The Python test suite includes integration cases that require local raster
fixtures. Their absence produces file-not-found failures; it is not evidence
of a successful live geospatial run.

Experiment history lives in this browser. Export each report as JSON for a
durable record; server-side project storage/authentication is not implemented.
See `../docs/EXPERIMENT_REQUIREMENTS.md` for primary research, evidence limits
and the work needed for a commercial deployment.

### Optional historical land-cover characterization (ESA WorldCover)

Live terrain searches attempt to characterize each 50 × 50 km window from local
ESA WorldCover 2021 v200 tiles. Missing files do not break terrain evaluation:
cover stays explicitly unknown. The measured index and facilities are not enriched
with invented percentages. Downloaded rasters remain local; do not commit them.

For the validated Northern Spain search, run from the repository root with the
same Python environment as the terrain engine:

```bash
python scripts/download_worldcover.py --west -3.1 --east -2.9 --south 42.9 --north 43.1
```

This downloads two official 3° tiles (approximately 128 MB total) into
`data/earth/worldcover/raw`, validates the raster format and records SHA-256, URL
and file size. Downloads use temporary files; rerunning reuses completed files
with matching preparation metadata. `--plan` prints required URLs without writes.
For another live-search region, use its bounds; the downloader includes the full
50 km windows beyond the sampled centre bounds. Crossing the antimeridian is not
supported by this optional layer.

Repeat the live search after preparation. Old browser-history reports remain
unchanged. The new report contains `landCover` per candidate, including all eleven
classes, coverage, sample counts, source files and provenance. Percentages are
estimated from nearest-neighbour samples on a 100 m local AEQD grid (250,000
samples); the input classification has nominal 10 m resolution. Percentages are
among classified samples. Missing/unrecognized samples are excluded and counted
as unknown coverage, never as bare ground. This is not exact native-pixel area
aggregation. The data describe 2021, not current site conditions.

Land cover is descriptive evidence and does not change JSD ordering or pass
soil strength, moisture, vegetation-free space, geology or permission checks.
The bare/sparse class includes sparse vegetation. There is no claim that samples
form a continuous testable parcel. The MOD44W eligibility mask is retained
independently; water percentages can differ because sources, dates and resolution
differ.

Source: https://doi.org/10.5281/zenodo.7254221 (CC BY 4.0).
Attribution: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel
data (2021) processed by ESA WorldCover consortium.

### Optional cover constraints

In live mode, three optional percentage fields constrain minimum bare/sparse
vegetation, maximum tree cover and maximum built-up. Empty fields add no filter;
zero is a real limit. UI percentages are exported as fractions from 0 to 1 in
`request.landCoverConstraints` (`minBareFraction`, `maxTreeFraction`,
`maxBuiltFraction`). API validation rejects constraints in indexed/facility mode;
switching UI evidence modes clears them.

All active constraints require a completely classified WorldCover window. Missing,
partial, corrupt or malformed evidence cannot pass, even for a limit of 0/100%.
These are historical sampled proportions of the full window, not a continuous
field parcel. Results retain the existing terrain ranking and unresolved critical
requirements. `landCoverRejected` separates exclusions outside limits from missing
coverage among windows already passing the geographic and terrain filters.

For Northern Spain, a 1% bare/sparse minimum excludes all nine previously
characterized windows. This demonstrates filtering, not ground truth validation:
source year, class uncertainty and 100 m sampling still apply.
