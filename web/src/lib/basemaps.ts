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

/**
 * CARTO asks for the key on every basemap request (style, tiles, glyphs, sprites), not only the
 * style URL. MapLibre calls this for each request; other hosts pass through unchanged.
 */
export function withCartoKey(url: string): { url: string } {
  if (!CARTO_KEY || !/^https:\/\/[a-z0-9.-]*cartocdn\.com\//.test(url) || /[?&]key=/.test(url)) return { url };
  return { url: `${url}${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(CARTO_KEY)}` };
}

/** The public deployment has no Python or local rasters, so live evaluation is turned off. */
export const PUBLIC_DEPLOYMENT = process.env.NEXT_PUBLIC_PARALLAX_PUBLIC === "1";

/**
 * Fallback basemap when CARTO cannot be reached or refuses the key (local development, preview
 * deployments on other domains, an exhausted quota): land outlines from Natural Earth 1:110m
 * (public domain), served from /land-110m.geojson. No network beyond this site.
 */
export const FALLBACK_STYLE = {
  version: 8 as const,
  sources: {
    land: { type: "geojson" as const, data: "/land-110m.geojson", attribution: "Land: Natural Earth (public domain)" },
  },
  layers: [
    { id: "background", type: "background" as const, paint: { "background-color": "#070b10" } },
    { id: "land", type: "fill" as const, source: "land", paint: { "fill-color": "#17202a" } },
    { id: "coast", type: "line" as const, source: "land", paint: { "line-color": "#3a4a5a", "line-width": 0.8 } },
  ],
};

/** Does a MapLibre error come from the CARTO basemap (style, tiles, glyphs or sprites)? */
export function isBasemapError(sourceId: string | undefined, message: string, styleLoaded: boolean): boolean {
  return !styleLoaded || sourceId === "carto" || /cartocdn\.com/.test(message);
}
