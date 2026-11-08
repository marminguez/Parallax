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

// ---------------------------------------------------------------- campaign v1.1: when to go, where to sleep
export type Month = { month: string; tmin: number; tmax: number; rain: number; workable: boolean };
export type Lodging = {
  within_25km: number; within_50km: number; band: "in_reach" | "day_trip" | "none_mapped";
  nearest: { name: string | null; type: string; km: number } | null; types: Record<string, number>;
};
export type SiteLogistics = { calendar: { months: Month[]; workable_count: number } | { error: string }; lodging: Lodging | { error: string } };
export type LogisticsData = { version: string; run_at: string | null; sites: Record<string, SiteLogistics> };

export const hasMonths = (c: SiteLogistics["calendar"] | undefined): c is { months: Month[]; workable_count: number } => !!c && "months" in c;
export const hasLodging = (l: SiteLogistics["lodging"] | undefined): l is Lodging => !!l && "band" in l;

/** Runs of workable months as ranges, wrapping over the new year ("Oct–Apr"). Indexes 0..11. */
export function workableRanges(months: Month[]): [number, number][] {
  const ok = months.map(m => m.workable);
  if (ok.every(Boolean)) return [[0, 11]];
  if (!ok.some(Boolean)) return [];
  const start = ok.findIndex((v, i) => !v && ok[(i + 1) % 12]); // the month before a run begins
  const ranges: [number, number][] = [];
  for (let k = 1; k <= 12; k++) {
    const i = (start + k) % 12;
    if (ok[i] && !ok[(i + 11) % 12]) ranges.push([i, i]);
    if (ok[i]) ranges[ranges.length - 1][1] = i;
  }
  return ranges;
}
