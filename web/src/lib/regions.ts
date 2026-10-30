/**
 * Area queries on the reverse map: every measured Earth window inside a circle, and the
 * closest Moon and Mars twins among them. Pure functions, so they run in the browser and
 * in tests. Data: the Earth tiles written by scripts/run_val004.py (web/public/reverse/earth).
 */
import { haversineKm, type Body, type EarthTile } from "./underfoot";

/** Nearest GeoNames settlement to each window (web/public/reverse/places), aligned with the Earth tile arrays. */
export type PlaceTile = { n: string[]; a: string[]; c: string[]; k: number[] };
export type LabelledTile = EarthTile & { places?: PlaceTile };
export type WindowPlace = { nearest: string; admin1: string; cc: string; km: number };
export type AreaWindow = { lat: number; lon: number; land: number; km: number; eligible: boolean; place?: WindowPlace } & Partial<Record<`${Body}I`, number>> & Partial<Record<`${Body}D`, number>>;

/** Same rule as every Parallax statistic: a window counts when at least 90 % of it is land. */
export const ELIGIBLE_LAND = 0.9;
const KM_PER_DEG = 111.195;

/** Every tile key whose 10° cell overlaps the circle's bounding box (antimeridian-safe). */
export function tilesForRadius(lat: number, lon: number, radiusKm: number, deg: number, available: Iterable<string>): string[] {
  if (!(radiusKm > 0)) throw new Error("Radius must be positive.");
  const have = new Set(available);
  const dLat = radiusKm / KM_PER_DEG + 0.5;
  const dLon = Math.min(180, radiusKm / (KM_PER_DEG * Math.max(0.05, Math.cos((Math.min(89, Math.abs(lat) + dLat) * Math.PI) / 180))) + 0.5);
  const keys = new Set<string>();
  const south = Math.max(-90, lat - dLat), north = Math.min(89.999, lat + dLat);
  for (let la = Math.floor(south / deg) * deg; la <= north; la += deg)
    for (let k = Math.floor((lon - dLon) / deg); k * deg <= lon + dLon; k++) {
      const lo = ((((k * deg + 180) % 360) + 360) % 360) - 180;
      keys.add(`${la}_${lo}`);
    }
  return [...keys].filter(k => have.has(k)).sort();
}

/** Measured windows whose centre lies within `radiusKm` of the point, nearest first. */
export function windowsWithin(lat: number, lon: number, radiusKm: number, tiles: LabelledTile[]): AreaWindow[] {
  const out: AreaWindow[] = [];
  for (const t of tiles)
    for (let i = 0; i < t.lat.length; i++) {
      const km = haversineKm(lat, lon, t.lat[i], t.lon[i]);
      if (km > radiusKm) continue;
      out.push({
        lat: t.lat[i], lon: t.lon[i], land: t.land[i], km, eligible: t.land[i] >= ELIGIBLE_LAND,
        moonI: t.moonI?.[i], moonD: t.moonD?.[i], marsI: t.marsI?.[i], marsD: t.marsD?.[i],
        place: t.places && t.places.n[i] !== undefined ? { nearest: t.places.n[i], admin1: t.places.a[i], cc: t.places.c[i], km: t.places.k[i] } : undefined,
      });
    }
  return out.sort((a, b) => a.km - b.km || a.lat - b.lat || a.lon - b.lon);
}

/** The window in the area whose twin on `body` is closest (eligible windows only by default). */
export function bestFor(body: Body, windows: AreaWindow[], eligibleOnly = true): AreaWindow | null {
  const key = `${body}D` as const;
  const pool = windows.filter(w => w[key] !== undefined && (!eligibleOnly || w.eligible));
  let best: AreaWindow | null = null;
  for (const w of pool) if (!best || (w[key] as number) < (best[key] as number) || ((w[key] as number) === (best[key] as number) && w.km < best.km)) best = w;
  return best;
}

/** A summary of an area: how much was measured and its best twins. */
export function areaProfile(windows: AreaWindow[]) {
  const eligible = windows.filter(w => w.eligible);
  return { measured: windows.length, eligible: eligible.length, moon: bestFor("moon", windows), mars: bestFor("mars", windows) };
}
