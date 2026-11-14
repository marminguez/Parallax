/**
 * Reachability v1 (config/search/reachability_v1.yaml): the nearest airport with scheduled
 * flights for every window of the Earth dimensions index, with the campaign v1 rule
 * (config/campaign/reachable_twins_v1.yaml) reused unchanged. Written by
 * scripts/search_reachability.py into web/data/earth-airports.json. Descriptive only:
 * it never removes a window and never changes the order.
 */
export const REACHABLE_KM = 100;
export const BANDS_KM = [100, 250] as const;
export type ReachBand = "near" | "mid" | "far";
/** `reachable` is decided on the unrounded distance, as in campaign v1; `km` is rounded to 0.1 for display. */
export type Airport = { name: string; iata: string | null; municipality: string | null; country: string; km: number; reachable: boolean };
export type AirportsFile = { airports: [string, string | null, string | null, string][]; windows: Record<string, [number, number, number]> };

export const reachBand = (km: number): ReachBand => km <= BANDS_KM[0] ? "near" : km <= BANDS_KM[1] ? "mid" : "far";
export const isReachable = (a: Pick<Airport, "reachable"> | null | undefined) => !!a && a.reachable;

export function parseAirports(text: string): Map<string, Airport> {
  const f = JSON.parse(text) as AirportsFile;
  return new Map(Object.entries(f.windows).map(([id, [i, km, r]]) => {
    const [name, iata, municipality, country] = f.airports[i];
    return [id, { name, iata, municipality, country, km, reachable: r === 1 }];
  }));
}
