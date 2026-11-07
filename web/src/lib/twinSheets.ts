/**
 * Twin characterization v1: how each Earth twin compares with its destination on
 * fine relief (60 m), surface temperature and access. Written by
 * scripts/characterize_twins.py into web/data/twin-sheets.json (see
 * config/characterization/dimensions_v1.yaml). Descriptive only: it never changes a twin.
 */
import type { Lang } from "./i18n";
import type { Body } from "./underfoot";

type Base = { status: "measured" | "not_measured" | "error"; reason?: string; error?: string };
export type FineRelief = Base & { distance?: number; verdict?: "holds" | "partly" | "breaks"; earth_steep_share?: number | null; planet_steep_share?: number | null };
export type Temperature = Base & { earth_c?: [number, number]; planet_c?: [number, number]; overlap?: number; verdict?: "holds" | "partly" | "breaks"; planet_colder_by_c?: number };
export type Operations = Base & { population_mean_km2?: number; population_max_km2?: number; nearest_settlement_km?: number | null; verdict?: "remote" | "rural" | "populated" };
export type TwinSheet = { fine_relief?: FineRelief; temperature?: Temperature; operations?: Operations };
export type TwinSheets = { version: string; run_at: string | null; sheets: Record<string, TwinSheet> };

export type Tone = "good" | "mid" | "bad" | "info" | "none";
export type Row = { key: "fine_relief" | "temperature" | "operations"; label: string; verdict: string; tone: Tone; text: string };

const L = {
  es: {
    fine: "Relieve fino (60 m)", temp: "Temperatura de superficie", ops: "Acceso",
    v: { holds: "Se mantiene", partly: "En parte", breaks: "Se rompe", remote: "Remoto", rural: "Rural", populated: "Poblado" } as Record<string, string>,
    pending: "Pendiente de cálculo", notMeasured: "Sin medir", failed: "No se pudo calcular",
    fineText: (d: string, e: string, p: string) => `Distancia ${d} entre huellas de pendientes a 60 m. Pendientes de 15° o más: ${e} en la Tierra, ${p} en el destino.`,
    fineMars: "Sin medir: aquí no hay un modelo de relieve de Marte más fino que 463 m.",
    tempText: (e0: string, e1: string, body: string, p0: string, p1: string, share: string) => `Tierra de ${e0} a ${e1} °C; ${body} de ${p0} a ${p1} °C. El gemelo cubre el ${share} del rango del destino.`,
    colder: (c: string) => ` El destino llega ${c} °C más frío.`,
    opsText: (mean: string, max: string, km: string | null) => `${mean} hab/km² de media (máximo ${max}).${km ? ` Población más cercana a ${km} km.` : ""}`,
    moon: "Luna", mars: "Marte",
  },
  en: {
    fine: "Fine relief (60 m)", temp: "Surface temperature", ops: "Access",
    v: { holds: "Holds", partly: "Partly", breaks: "Breaks", remote: "Remote", rural: "Rural", populated: "Populated" } as Record<string, string>,
    pending: "Not computed yet", notMeasured: "Not measured", failed: "Could not be computed",
    fineText: (d: string, e: string, p: string) => `Distance ${d} between 60 m slope fingerprints. Slopes of 15° or more: ${e} on Earth, ${p} at the destination.`,
    fineMars: "Not measured: there is no Mars elevation model finer than 463 m here.",
    tempText: (e0: string, e1: string, body: string, p0: string, p1: string, share: string) => `Earth ${e0} to ${e1} °C; ${body} ${p0} to ${p1} °C. The twin covers ${share} of the destination's range.`,
    colder: (c: string) => ` The destination gets ${c} °C colder.`,
    opsText: (mean: string, max: string, km: string | null) => `${mean} people/km² on average (maximum ${max}).${km ? ` Nearest settlement ${km} km away.` : ""}`,
    moon: "Moon", mars: "Mars",
  },
};

const TONE: Record<string, Tone> = { holds: "good", partly: "mid", breaks: "bad", remote: "info", rural: "info", populated: "info" };

const num = (lang: Lang, v: number, digits = 0) => v.toLocaleString(lang === "es" ? "es-ES" : "en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (lang: Lang, v: number | null | undefined) => (v === null || v === undefined ? "—" : `${num(lang, v * 100)} %`);

function blank(key: Row["key"], label: string, lang: Lang, dim: Base | undefined, body: Body): Row {
  const t = L[lang];
  if (!dim) return { key, label, verdict: t.pending, tone: "none", text: "" };
  if (dim.status === "error") return { key, label, verdict: t.failed, tone: "none", text: "" };
  const text = key === "fine_relief" && body === "mars" && dim.reason !== "earth" ? t.fineMars : "";
  return { key, label, verdict: t.notMeasured, tone: "none", text };
}

/** The three rows of a twin sheet, in the visitor's language. A missing sheet gives three "pending" rows. */
export function describe(sheet: TwinSheet | undefined, body: Body, lang: Lang): Row[] {
  const t = L[lang];
  const rows: Row[] = [];
  const f = sheet?.fine_relief;
  rows.push(f?.status === "measured" && f.verdict && f.distance !== undefined
    ? { key: "fine_relief", label: t.fine, verdict: t.v[f.verdict], tone: TONE[f.verdict], text: t.fineText(num(lang, f.distance, 3), pct(lang, f.earth_steep_share), pct(lang, f.planet_steep_share)) }
    : blank("fine_relief", t.fine, lang, f, body));
  const m = sheet?.temperature;
  rows.push(m?.status === "measured" && m.verdict && m.earth_c && m.planet_c && m.overlap !== undefined
    ? { key: "temperature", label: t.temp, verdict: t.v[m.verdict], tone: TONE[m.verdict],
        text: t.tempText(num(lang, m.earth_c[0]), num(lang, m.earth_c[1]), t[body], num(lang, m.planet_c[0]), num(lang, m.planet_c[1]), pct(lang, m.overlap)) + (m.planet_colder_by_c ? t.colder(num(lang, m.planet_colder_by_c)) : "") }
    : blank("temperature", t.temp, lang, m, body));
  const o = sheet?.operations;
  rows.push(o?.status === "measured" && o.verdict && o.population_mean_km2 !== undefined && o.population_max_km2 !== undefined
    ? { key: "operations", label: t.ops, verdict: t.v[o.verdict], tone: TONE[o.verdict],
        text: t.opsText(num(lang, o.population_mean_km2, o.population_mean_km2 < 10 ? 1 : 0), num(lang, o.population_max_km2), o.nearest_settlement_km ? num(lang, o.nearest_settlement_km) : null) }
    : blank("operations", t.ops, lang, o, body));
  return rows;
}
