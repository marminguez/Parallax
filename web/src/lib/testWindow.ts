/**
 * Test window v1 (config/search/test_window_v1.yaml): how long a team can rehearse at a site.
 * Mirrors scripts/test_window.py exactly; both are tested on the same cases.
 *   general  logistics_v1's workable month, unchanged (every category but ISRU)
 *   frozen   TS <= 0, T2M_MIN >= -25, PRECTOTCORR <= 3 (ISRU)
 * Descriptive only: a window never removes a site and never changes the order.
 */
export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MID_MONTH_DOY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];
export type Monthly = { T2M_MIN: number[]; T2M_MAX: number[]; PRECTOTCORR: number[]; TS: number[] };
export type Window = { months: string[]; runs: [string, string][]; days_per_year: number; longest_block_days: number; daylight_h: [number, number] | null };
export type Windows = { general: Window; frozen: Window };

export const generalMonth = (tmin: number, tmax: number, rain: number) => tmin >= -10 && tmax <= 35 && rain <= 3;
export const frozenMonth = (ts: number, tmin: number, rain: number) => ts <= 0 && tmin >= -25 && rain <= 3;

/** Hours with the Sun's centre above -0.833 deg (field_v1). */
export function dayLength(lat: number, doy: number) {
  const r = Math.PI / 180;
  const decl = 23.44 * r * Math.sin(2 * Math.PI * (284 + doy) / 365);
  const phi = lat * r;
  const cosW = (Math.sin(-0.833 * r) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
  if (cosW <= -1) return 24;
  if (cosW >= 1) return 0;
  return 2 * (Math.acos(cosW) / r) / 15;
}
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Runs of consecutive months, December running into January. */
export function runs(flags: boolean[]): [number, number][] {
  if (flags.every(Boolean)) return [[0, 11]];
  if (!flags.some(Boolean)) return [];
  const start = flags.findIndex(f => !f);
  const out: [number, number][] = [];
  let cur: number | null = null;
  for (let k = 1; k <= 12; k++) {
    const i = (start + k) % 12;
    if (flags[i] && cur === null) cur = i;
    if (!flags[i] && cur !== null) { out.push([cur, (i + 11) % 12]); cur = null; }
  }
  return out.sort((a, b) => a[0] - b[0]);
}
const runDays = ([a, b]: [number, number]) => {
  let d = 0; for (let i = a; ; i = (i + 1) % 12) { d += DAYS[i]; if (i === b) break; } return d;
};

export function window(flags: boolean[], lat: number): Window {
  const rs = runs(flags);
  const light = flags.flatMap((f, i) => f ? [round1(dayLength(lat, MID_MONTH_DOY[i]))] : []);
  return {
    months: MONTHS.filter((_, i) => flags[i]),
    runs: rs.map(([a, b]) => [MONTHS[a], MONTHS[b]]),
    days_per_year: flags.reduce((s, f, i) => s + (f ? DAYS[i] : 0), 0),
    longest_block_days: rs.reduce((m, r) => Math.max(m, runDays(r)), 0),
    daylight_h: light.length ? [Math.min(...light), Math.max(...light)] : null,
  };
}

export function windows(m: Monthly, lat: number): Windows {
  const ok = MONTHS.map((_, i) => (["T2M_MIN", "T2M_MAX", "PRECTOTCORR", "TS"] as const).every(k => Number.isFinite(m[k][i]) && m[k][i] > -900));
  const g = ok.map((o, i) => o && generalMonth(m.T2M_MIN[i], m.T2M_MAX[i], m.PRECTOTCORR[i]));
  const f = ok.map((o, i) => o && frozenMonth(m.TS[i], m.T2M_MIN[i], m.PRECTOTCORR[i]));
  return { general: window(g, lat), frozen: window(f, lat) };
}

const MONTH_NAME = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
/** "abr–jun, sep–oct" */
export function runsText(w: Window, lang: "es" | "en") {
  const n = (m: string) => MONTH_NAME[lang][MONTHS.indexOf(m as (typeof MONTHS)[number])];
  if (w.months.length === 12) return lang === "es" ? "todo el año" : "all year";
  return w.runs.map(([a, b]) => a === b ? n(a) : `${n(a)}–${n(b)}`).join(", ");
}

export const POWER_PARAMS = "T2M_MIN,T2M_MAX,PRECTOTCORR,TS";
export function monthlyFromPower(payload: { properties: { parameter: Record<string, Record<string, number>> } }): Monthly {
  const p = payload.properties.parameter;
  const get = (k: keyof Monthly) => MONTHS.map(m => Number(p[k]?.[m]));
  return { T2M_MIN: get("T2M_MIN"), T2M_MAX: get("T2M_MAX"), PRECTOTCORR: get("PRECTOTCORR"), TS: get("TS") };
}

// ---------------------------------------------------------------- the team's own dates and rule

/**
 * A team's plan: the months it wants to go (from..to, December runs into January) and the
 * rule it applies to each month. The two registered rules are presets; any other values are
 * the team's own rule, and the page says so. Descriptive only: never removes or reorders a site.
 */
export type TeamRule = { minC: number | null; maxC: number | null; rainMax: number | null; groundFrozen: boolean };
export type Plan = { from: number; to: number; rule: TeamRule };
export const RULE_GENERAL: TeamRule = { minC: -10, maxC: 35, rainMax: 3, groundFrozen: false };
export const RULE_FROZEN: TeamRule = { minC: -25, maxC: null, rainMax: 3, groundFrozen: true };
const same = (a: TeamRule, b: TeamRule) => a.minC === b.minC && a.maxC === b.maxC && a.rainMax === b.rainMax && a.groundFrozen === b.groundFrozen;
/** "general" | "frozen" when the rule is a registered one, else "team". */
export const ruleKind = (r: TeamRule) => same(r, RULE_GENERAL) ? "general" : same(r, RULE_FROZEN) ? "frozen" : "team";

/** Month indices from..to inclusive, wrapping December to January. */
export function planMonths(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; ; i = (i + 1) % 12) { out.push(i); if (i === to || out.length === 12) break; }
  return out;
}

export type MonthCheck = { month: number; ok: boolean; missing: boolean; fails: ("cold" | "hot" | "rain" | "notFrozen")[] };
/** One month against the team's rule. A missing value never passes. */
export function checkMonth(m: Monthly, i: number, r: TeamRule): MonthCheck {
  const v = { tmin: m.T2M_MIN[i], tmax: m.T2M_MAX[i], rain: m.PRECTOTCORR[i], ts: m.TS[i] };
  const bad = (x: number) => !Number.isFinite(x) || x <= -900;
  const needed = [v.tmin, v.tmax, v.rain, ...(r.groundFrozen ? [v.ts] : [])];
  if (needed.some(bad)) return { month: i, ok: false, missing: true, fails: [] };
  const fails: MonthCheck["fails"] = [];
  if (r.minC !== null && v.tmin < r.minC) fails.push("cold");
  if (r.maxC !== null && v.tmax > r.maxC) fails.push("hot");
  if (r.rainMax !== null && v.rain > r.rainMax) fails.push("rain");
  if (r.groundFrozen && v.ts > 0) fails.push("notFrozen");
  return { month: i, ok: !fails.length, missing: false, fails };
}

export type PlanFit = { months: MonthCheck[]; okCount: number; total: number; okDays: number; verdict: "all" | "some" | "none" };
export function planFit(m: Monthly, plan: Plan): PlanFit {
  const months = planMonths(plan.from, plan.to).map(i => checkMonth(m, i, plan.rule));
  const okCount = months.filter(x => x.ok).length;
  const okDays = months.reduce((s, x) => s + (x.ok ? DAYS[x.month] : 0), 0);
  return { months, okCount, total: months.length, okDays, verdict: okCount === months.length ? "all" : okCount ? "some" : "none" };
}

export const monthName = (i: number, lang: "es" | "en") => MONTH_NAME[lang][i];
