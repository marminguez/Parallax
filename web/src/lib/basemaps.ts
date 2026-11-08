/**
 * Basemap and imagery URLs. Visual context only: never used in any Parallax calculation.
 *
 * Public deployments set free keys in the environment (see web/.env.example):
 *  - NEXT_PUBLIC_CARTO_KEY: CARTO basemaps key (non-commercial free use), sent as ?key=
 *  - NEXT_PUBLIC_ARCGIS_TOKEN: ArcGIS Developer access token for the current basemap service
 * Without keys (local development), the legacy public endpoints are used.
 */
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_KEY || "";
const ARCGIS_TOKEN = process.env.NEXT_PUBLIC_ARCGIS_TOKEN || "";

export const CARTO_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" + (CARTO_KEY ? `?key=${encodeURIComponent(CARTO_KEY)}` : "");

const IMAGERY_BASE = ARCGIS_TOKEN
  ? "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile"
  : "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";
const IMAGERY_QUERY = ARCGIS_TOKEN ? `?token=${encodeURIComponent(ARCGIS_TOKEN)}` : "";

/** MapLibre raster template ({z}/{y}/{x}). */
export const IMAGERY_TEMPLATE = `${IMAGERY_BASE}/{z}/{y}/{x}${IMAGERY_QUERY}`;

/** One imagery tile (slippy-map numbering), longitude wrapped. */
export function imageryTile(z: number, y: number, x: number): string {
  const n = 2 ** z;
  return `${IMAGERY_BASE}/${z}/${y}/${((x % n) + n) % n}${IMAGERY_QUERY}`;
}

export const IMAGERY_ATTRIBUTION =
  'Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community · Powered by <a href="https://www.esri.com" target="_blank" rel="noopener noreferrer">Esri</a>';

/** The public deployment has no Python or local rasters, so live evaluation is turned off. */
export const PUBLIC_DEPLOYMENT = process.env.NEXT_PUBLIC_PARALLAX_PUBLIC === "1";
