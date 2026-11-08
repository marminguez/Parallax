/**
 * Campaign planning v1: the reachable twin (config/campaign/reachable_twins_v1.yaml).
 * Written by scripts/reachable_twins.py into web/data/reachable-twins.json. A separate view:
 * it never changes a VAL-004 twin. Pure helpers here; the data is imported by the page.
 */
export type Airport = { name: string; iata: string | null; municipality: string | null; country: string; continent: string; km: number };
export type CampaignWindow = {
  id: string; lat: number; lon: number; distance: number; band: "near" | "mid" | "far";
  airport: Airport; place: { nearest: string; admin1: string; countryCode: string; distanceKm: number };
};
export type CampaignDestination = {
  id: string; name: string; body: "moon" | "mars"; kind: string; window: string;
  val004_twin: CampaignWindow; val004_twin_reachable: boolean;
  good_twins: number; reachable_good_twins: number;
  reachable_twin: CampaignWindow | null; shortlist: CampaignWindow[];
};
export type CampaignData = { version: string; run_at: string; reachableKm: number; q25: number; destinations: CampaignDestination[] };

export const CONTINENTS = ["AF", "AS", "EU", "NA", "OC", "SA"] as const;

/** Shortlist filtered for display; the shortlist itself (and its order) never changes. */
export function filterShortlist(d: CampaignDestination, continent: string | null): CampaignWindow[] {
  return continent ? d.shortlist.filter(w => w.airport.continent === continent) : d.shortlist;
}

/** How much less alike the reachable twin is than the VAL-004 twin (0 when they are the same window). */
export function similarityCost(d: CampaignDestination): number {
  return d.reachable_twin ? Math.max(0, d.reachable_twin.distance - d.val004_twin.distance) : NaN;
}
