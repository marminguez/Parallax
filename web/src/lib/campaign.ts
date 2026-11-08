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

// ---------------------------------------------------------------- printable campaign sheet
/** The window a sheet is about: the one asked for if it belongs to this destination, else the reachable twin (or the reverse-map twin). */
export function sheetWindow(d: CampaignDestination, id: string | null): CampaignWindow {
  const pool = [d.reachable_twin, d.val004_twin, ...d.shortlist].filter((w): w is CampaignWindow => !!w);
  return pool.find(w => w.id === id) ?? d.reachable_twin ?? d.val004_twin;
}

/** Other shortlisted sites, in shortlist order, to print as a fallback. */
export function alternatives(d: CampaignDestination, w: CampaignWindow, n = 3): CampaignWindow[] {
  return d.shortlist.filter(x => x.id !== w.id).slice(0, n);
}

/** Low-Sun hours by calendar month (0..11) from a rolling calendar's "YYYY-MM" months. */
export function hoursByMonth(months: { month: string; hours: number }[]): number[] {
  const out = Array(12).fill(0);
  for (const m of months) out[Number(m.month.slice(5, 7)) - 1] += m.hours;
  return out.map(h => Math.round(h));
}

/** OpenStreetMap link for a point, readable when printed. */
export const osmUrl = (lat: number, lon: number) => `https://www.openstreetmap.org/?mlat=${lat.toFixed(4)}&mlon=${lon.toFixed(4)}#map=11/${lat.toFixed(4)}/${lon.toFixed(4)}`;
