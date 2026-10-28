/**
 * "What lies under your feet": the reverse map (VAL-004) read from the visitor's side.
 *
 * Everything here runs in the browser. The visitor's position is used to pick
 * the nearest precomputed Earth window and never leaves the device.
 * Data: web/public/reverse/ (written by scripts/run_val004.py).
 */

export const REVERSE_BASE = "/reverse";
export const CLASSES = ["strong_twin", "twin", "partial", "no_twin"] as const;
export type TwinClass = (typeof CLASSES)[number];
export type Body = "moon" | "mars";
export const BODIES: Body[] = ["moon", "mars"];

/** A 50 km window's centre is at most ~35 km from any point it covers. */
export const MAX_WINDOW_KM = 40;
const EARTH_RADIUS_KM = 6371.0088;

export type Thresholds = { q25: number; q50: number; q90: number };

export type ReverseSummary = {
  id: "VAL-004";
  run_at: string;
  tileDeg: number;
  tiles: string[];
  thresholds: Thresholds;
  classes: TwinClass[];
  validatedPairs: number[];
  bodies: Partial<Record<Body, { windows: number; shares: Record<TwinClass, number>; distance_median: number; bridge_passed: boolean | null; status: string }>>;
  bridges: Partial<Record<Body, { passed: boolean | null; distance: number | null }>>;
  maps?: { moon?: { shape: [number, number] }; mars?: { width: number; height: number } };
  earth: { evaluated: number; eligible: number; display: number };
};

export type EarthTile = { lat: number[]; lon: number[]; land: number[]; moonI?: number[]; moonD?: number[]; marsI?: number[]; marsD?: number[] };

/** One Moon or Mars window. `e` is its own closest Earth window; `e_place` the nearest settlement to it (display only). */
export type PlanetWindow = { id: string; lat: number; lon: number; c: number; d: number; e: [number, number]; e_place?: [string, string, string, number] };

export type Twin = { body: Body; window: PlanetWindow; distance: number; cls: TwinClass; closerThan: number; ofPairs: number };
export type UnderfootResult =
  | { status: "ok"; earth: { lat: number; lon: number; km: number; land: number; eligible: boolean }; twins: Twin[] }
  | { status: "outside"; nearestKm: number | null };

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function validCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export const tileKey = (lat: number, lon: number, deg: number) => `${Math.floor(lat / deg) * deg}_${Math.floor(lon / deg) * deg}`;

/** The tile holding the point, plus neighbours when a window centre could sit across a tile edge. */
export function tilesFor(lat: number, lon: number, deg: number, available: Iterable<string>, marginDeg = 1): string[] {
  const have = new Set(available);
  const lonMargin = Math.min(180, marginDeg / Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  const keys = new Set<string>();
  for (const dLat of [-marginDeg, 0, marginDeg])
    for (const dLon of [-lonMargin, 0, lonMargin]) {
      const la = Math.max(-90, Math.min(89.999, lat + dLat));
      const lo = ((((lon + dLon + 180) % 360) + 360) % 360) - 180;
      keys.add(tileKey(la, lo, deg));
    }
  return [...keys].filter(k => have.has(k)).sort();
}

export function classify(d: number, t: Thresholds): TwinClass {
  if (!Number.isFinite(d)) throw new Error("Distance must be finite.");
  if (d <= t.q25) return "strong_twin";
  if (d <= t.q50) return "twin";
  if (d <= t.q90) return "partial";
  return "no_twin";
}

/** How many of the validated, agency-used analogs are farther from their own target than this twin is. */
export const closerThan = (d: number, pairs: number[]) => pairs.filter(p => p > d).length;

type Found = { tile: EarthTile; index: number; km: number };

export function nearestWindow(lat: number, lon: number, tiles: EarthTile[]): Found | null {
  let best: Found | null = null;
  for (const tile of tiles)
    for (let i = 0; i < tile.lat.length; i++) {
      const km = haversineKm(lat, lon, tile.lat[i], tile.lon[i]);
      if (!best || km < best.km || (km === best.km && tile.lat[i] < best.tile.lat[best.index])) best = { tile, index: i, km };
    }
  return best;
}

export function lookUp(lat: number, lon: number, tiles: EarthTile[], planets: Partial<Record<Body, Record<string, PlanetWindow>>>, summary: Pick<ReverseSummary, "thresholds" | "validatedPairs">): UnderfootResult {
  if (!validCoordinate(lat, lon)) throw new Error("Invalid coordinates.");
  const found = nearestWindow(lat, lon, tiles);
  if (!found || found.km > MAX_WINDOW_KM) return { status: "outside", nearestKm: found ? Math.round(found.km) : null };
  const { tile, index, km } = found;
  const twins: Twin[] = [];
  for (const body of BODIES) {
    const ids = tile[`${body}I`];
    const ds = tile[`${body}D`];
    const windows = planets[body];
    if (!ids || !ds || !windows) continue;
    const window = windows[String(ids[index])];
    if (!window) throw new Error(`Missing ${body} window ${ids[index]} in the export.`);
    const distance = ds[index];
    twins.push({ body, window, distance, cls: classify(distance, summary.thresholds), closerThan: closerThan(distance, summary.validatedPairs), ofPairs: summary.validatedPairs.length });
  }
  return { status: "ok", earth: { lat: tile.lat[index], lon: tile.lon[index], km, land: tile.land[index], eligible: tile.land[index] >= 0.9 }, twins };
}

/** Position of a planetary window on its class map, as fractions of the image (0..1). */
export function mapPosition(body: Body, w: Pick<PlanetWindow, "id" | "lat" | "lon">, maps: ReverseSummary["maps"]): { x: number; y: number } | null {
  if (body === "mars") return { x: (w.lon + 180) / 360, y: (90 - w.lat) / 180 };
  const shape = maps?.moon?.shape;
  const m = /^MOON-(\d+)-(\d+)$/.exec(w.id);
  if (!shape || !m) return null;
  return { x: (Number(m[2]) + 25) / shape[1], y: (Number(m[1]) + 25) / shape[0] };
}

/** Web-Mercator tile maths for the satellite context image. */
export function slippy(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const r = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n };
}

export const pixelsPerKm = (lat: number, zoom: number, tilePx = 256) => (tilePx * 2 ** zoom) / (40075.016686 * Math.cos((lat * Math.PI) / 180));
