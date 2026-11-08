# Deploying the public site

The public site is the Next.js app in `web/`, hosted on Vercel and built from GitHub.

## Why the Git integration, not the CLI

`web/public` holds about 17,000 precomputed files (about 100 MB): planet windows, thumbnails and maps. Vercel's CLI upload on the Hobby plan stops at 100 MB of source and 15,000 files, so `vercel deploy` from a laptop fails. Importing the GitHub repository has no such limit: Vercel clones the repository and builds there.

## One-time setup

1. Sign in at vercel.com with the GitHub account that owns `marminguez/Parallax` (Hobby plan is enough).
2. **Add New → Project → Import Git Repository**, choose `marminguez/Parallax`. Allow the Vercel GitHub app to see that repository if asked; the repository can stay private.
3. In **Configure Project**:
   - **Root Directory:** `web`
   - **Framework Preset:** Next.js (detected)
   - Build and output settings: leave the defaults (`npm run build`).
4. **Environment Variables** (see `web/.env.example`):

   | Name | Value | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_PARALLAX_PUBLIC` | `1` | Hides the live local-raster search; the API answers 501 for it. |
   | `PARALLAX_NOINDEX` | `1` | Asks search engines not to index the site. Set `0` when the team decides to publish. |
   | `NEXT_PUBLIC_CARTO_KEY` | CARTO key | Optional until the key arrives. |
   | `NEXT_PUBLIC_ARCGIS_TOKEN` | ArcGIS access token | Optional until the key arrives. Restrict its referrers to the Vercel domain. |

5. **Deploy.** The first build takes a few minutes. The site is served at `https://<project>.vercel.app`.

## After setup

- Every push to `main` redeploys production; every pull request gets its own preview URL.
- Changing an environment variable needs a redeploy (**Deployments → … → Redeploy**), because `NEXT_PUBLIC_*` values are baked into the build.
- Language: links can force it with `?lang=en` or `?lang=es`. The NASA form and pitch use `?lang=en`; the Valencia QR uses the plain URL (Spanish first).

## What the public site does not do

- **Live evaluation** of new Earth regions needs the Python engine and local rasters, which the host does not have. It stays available on a local install (`npm run dev` with the repository's Python environment).
- **Basemaps** (CARTO, Esri World Imagery) are visual context only and never enter a measurement. Without keys the legacy keyless endpoints are used; with keys the current authenticated ones are.
