This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Run `npm ci` inside `web` first. `npm run dev` and `npm run build`
automatically copy the MapLibre module worker and its shared module from the
installed package into `public`. Both files must be served together; copying
only the worker causes the map to fail with a missing shared-module request.

The discovery map uses CARTO's hosted dark basemap, which requires internet
access to load its style and tiles.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


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
