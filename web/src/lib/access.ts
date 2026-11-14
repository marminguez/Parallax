/**
 * Access v1 (config/access/access_v1.yaml): what a team of given nationalities needs
 * to enter a country and work at a site. Descriptive only: it never removes a site or
 * changes an order. Entry rules come from the open Passport Index dataset (tourist
 * entry), corrected where a newer change is documented; country and site notes were
 * researched by hand, each with its source.
 */

export type Lang = "es" | "en";
export type Bi<T> = { es: T; en: T };
export type Source = { title: string; url: string };
export type Risk = "normal" | "caution" | "reconsider" | "avoid" | "unknown";
export type CountryAccess = {
  risk: Risk; advisory?: Bi<string>; permits?: Bi<string[]>; byPassport?: Record<string, Bi<string>>;
  overrideNote?: Bi<string>; sources: Source[];
};
export type SiteAccess = { level: Risk; es: string; en: string; passports?: string[]; sources: Source[] };
export type AccessData = {
  version: string; researchedOn: string;
  passportIndex: { source: string; commit: string; commit_date: string; licence: string };
  general: Bi<string[]>;
  codes: string[];
  passports: Record<string, string>;
  overrides: Record<string, Record<string, string>>;
  countries: Record<string, CountryAccess>;
  sites: Record<string, SiteAccess>;
  /** Region notes keyed "CC/admin1", for every result in that region. */
  regions: Record<string, SiteAccess>;
};

/** Entry for one passport. "free" carries days when the dataset gives them. */
export type EntryKind = "self" | "free" | "eta" | "ev" | "voa" | "vr" | "no" | "unknown";
export type Entry = { kind: EntryKind; days?: number; corrected: boolean; check: boolean };

/** From easiest to hardest: the team moves as fast as its hardest passport. */
export const ENTRY_ORDER: EntryKind[] = ["self", "free", "eta", "ev", "voa", "vr", "no", "unknown"];
export const RISK_ORDER: Risk[] = ["unknown", "normal", "caution", "reconsider", "avoid"];

const KIND: Record<string, EntryKind> = { self: "self", vf: "free", eta: "eta", ev: "ev", voa: "voa", vr: "vr", no: "no" };
function decode(tok: string | undefined): Pick<Entry, "kind" | "days"> {
  if (!tok) return { kind: "unknown" };
  if (/^\d+$/.test(tok)) return { kind: "free", days: Number(tok) };
  return { kind: KIND[tok] ?? "unknown" };
}

const columns = new WeakMap<AccessData, Map<string, number>>();
const rows = new WeakMap<AccessData, Map<string, string[]>>();
function column(data: AccessData, dest: string) {
  let m = columns.get(data);
  if (!m) { m = new Map(data.codes.map((c, i) => [c, i])); columns.set(data, m); }
  return m.get(dest);
}
function row(data: AccessData, passport: string) {
  let m = rows.get(data);
  if (!m) { m = new Map(); rows.set(data, m); }
  let r = m.get(passport);
  if (!r && data.passports[passport] !== undefined) { r = data.passports[passport].split(","); m.set(passport, r); }
  return r;
}

/** Passports in the dataset, i.e. the nationalities the form can offer. */
export const passportCodes = (data: AccessData) => Object.keys(data.passports);

/**
 * Entry rule for one passport into one country. A documented correction wins over the
 * dataset; where a country has a correction note but none for this passport, and the
 * dataset says visa-free, the entry is flagged to check.
 */
export function entry(data: AccessData, passport: string, dest: string): Entry {
  const fixed = data.overrides[dest]?.[passport];
  if (fixed) return { ...decode(fixed), corrected: true, check: false };
  if (passport === dest) return { kind: "self", corrected: false, check: false };
  const i = column(data, dest);
  const r = row(data, passport);
  const e = decode(i === undefined || !r ? undefined : r[i]);
  const check = !!data.countries[dest]?.overrideNote && e.kind === "free";
  return { ...e, corrected: false, check };
}

export type TeamEntry = { hardest: EntryKind; byPassport: { passport: string; entry: Entry }[]; groups: { kind: EntryKind; days?: number; passports: string[] }[] };

/** One line per team: each passport's entry, grouped, and the hardest of them. */
export function teamEntry(data: AccessData, passports: string[], dest: string): TeamEntry {
  const byPassport = passports.map(passport => ({ passport, entry: entry(data, passport, dest) }));
  const groups: TeamEntry["groups"] = [];
  for (const { passport, entry: e } of byPassport) {
    const g = groups.find(x => x.kind === e.kind && x.days === e.days);
    if (g) g.passports.push(passport); else groups.push({ kind: e.kind, days: e.days, passports: [passport] });
  }
  groups.sort((a, b) => ENTRY_ORDER.indexOf(b.kind) - ENTRY_ORDER.indexOf(a.kind));
  const hardest = byPassport.reduce<EntryKind>((h, x) => ENTRY_ORDER.indexOf(x.entry.kind) > ENTRY_ORDER.indexOf(h) ? x.entry.kind : h, "self");
  return { hardest, byPassport, groups };
}

const regionOf = (data: AccessData, dest: string, admin1?: string | null) => admin1 ? data.regions?.[`${dest}/${admin1}`] : undefined;
const higher = (a: Risk, b: Risk | undefined) => b && RISK_ORDER.indexOf(b) > RISK_ORDER.indexOf(a) ? b : a;

/** Country risk, raised by the region's or the site's own note when there is one. */
export function riskAt(data: AccessData, dest: string, siteId?: string | null, admin1?: string | null): Risk {
  const c = data.countries[dest]?.risk ?? "unknown";
  return higher(higher(c, regionOf(data, dest, admin1)?.level), siteId ? data.sites[siteId]?.level : undefined);
}

/** Notes for a site: country permits, the site's own note, and the ones for the team's passports. */
export function notesFor(data: AccessData, dest: string, siteId: string | null | undefined, passports: string[], lang: Lang, admin1?: string | null) {
  const c = data.countries[dest];
  const s = siteId ? data.sites[siteId] : undefined;
  const r = regionOf(data, dest, admin1);
  const forTeam = c?.byPassport ? passports.filter(p => c.byPassport![p]).map(p => ({ passport: p, text: c.byPassport![p][lang] })) : [];
  const siteHitsTeam = s?.passports ? s.passports.filter(p => passports.includes(p)) : [];
  const sources = [...(s?.sources ?? []), ...(r?.sources ?? []), ...(c?.sources ?? [])].filter((x, i, a) => a.findIndex(y => y.url === x.url) === i);
  return {
    risk: riskAt(data, dest, siteId, admin1),
    region: r ? r[lang] : null,
    regionLevel: (r?.level ?? "unknown") as Risk,
    advisory: c?.advisory?.[lang] ?? null,
    permits: c?.permits?.[lang] ?? [],
    site: s ? s[lang] : null,
    siteLevel: (s?.level ?? "unknown") as Risk,
    siteHitsTeam,
    forTeam,
    correction: c?.overrideNote?.[lang] ?? null,
    sources,
    researched: !!c,
  };
}

/** Normalise a list of nationality codes: upper case, known to the dataset, no repeats, at most 12. */
export function cleanPassports(data: AccessData | null, list: string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const p = raw.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(p) || out.includes(p)) continue;
    if (data && data.passports[p] === undefined) continue;
    out.push(p);
    if (out.length === 12) break;
  }
  return out;
}
