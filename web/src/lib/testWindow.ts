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
