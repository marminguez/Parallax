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
export type Ice = Base & {
  verdict?: "holds" | "breaks" | "none" | "earth_only"; verdict_v1_1?: "holds" | "breaks" | "none" | "earth_only"; destination_swim_clear_share?: number;
  destination_psr_share?: number; destination_swim_mean?: number; destination_swim_positive_share?: number; destination_reason?: string;
  earth_pzi_mean?: number; earth_pzi_share?: number;
};
export type Ground = Base & { bare_share?: number; snow_ice_share?: number; vegetated_share?: number; dominant_class?: number; coverage?: number; verdict?: "holds" | "partly" | "breaks" };
export type TwinSheet = { fine_relief?: FineRelief; temperature?: Temperature; operations?: Operations; ice?: Ice; ground?: Ground };
export type TwinSheets = { version: string; run_at: string | null; sheets: Record<string, TwinSheet> };

export type Tone = "good" | "mid" | "bad" | "info" | "none";
export type Row = { key: "fine_relief" | "temperature" | "operations" | "ice" | "ground"; label: string; verdict: string; tone: Tone; text: string };

const L = {
  es: {
    fine: "Relieve fino (60 m)", temp: "Temperatura de superficie", ops: "Acceso", ice: "Hielo", ground: "Suelo y polvo",
    groundText: (bare: string, snow: string, veg: string) => `Suelo desnudo en el ${bare} de la ventana; nieve o hielo, ${snow}; vegetación, ${veg} (ESA WorldCover).`,
    groundNote: " Ensaya moverse y excavar en suelo suelto, no el polvo del destino: el lunar es cortante y se carga de electricidad; el marciano es finísimo y oxidante.",
    v: { holds: "Se mantiene", partly: "En parte", breaks: "Se rompe", remote: "Remoto", rural: "Rural", populated: "Poblado", none: "Sin hielo", earth_only: "Solo en la Tierra" } as Record<string, string>,
    iceMoon: (psr: string) => `Sombra permanente en el ${psr} de la ventana lunar: trampas frías donde se conserva hielo de agua.`,
    iceMars: (pos: string) => `El ${pos} de la ventana marciana es claramente coherente con hielo en el primer metro (SWIM).`,
    amended: (v: string) => ` Con la regla original salía «${v}»; se enmendó tras ver los datos porque SWIM considera no concluyentes los valores cercanos a 0.`,
    iceEarth: (pzi: string, share: string) => ` Permafrost en la gemela: índice medio ${pzi}, extendido en el ${share} de la ventana.`,
    iceNote: " Ensaya perforar y excavar suelo helado, no el frío ni el proceso del destino.",
    pending: "Pendiente de cálculo", notMeasured: "Sin medir", failed: "No se pudo calcular",
    fineText: (d: string, e: string, p: string) => `Distancia ${d} entre huellas de pendientes a 60 m. Pendientes de 15° o más: ${e} en la Tierra, ${p} en el destino.`,
    fineMars: "Sin medir: aquí no hay un modelo de relieve de Marte más fino que 463 m.",
    tempText: (e0: string, e1: string, body: string, p0: string, p1: string, share: string) => `Tierra de ${e0} a ${e1} °C; ${body} de ${p0} a ${p1} °C. El gemelo cubre el ${share} del rango del destino.`,
    colder: (c: string) => ` El destino llega ${c} °C más frío.`,
    opsText: (mean: string, max: string, km: string | null) => `${mean} hab/km² de media (máximo ${max}).${km ? ` Población más cercana a ${km} km.` : ""}`,
    moon: "Luna", mars: "Marte",
  },
  en: {
    fine: "Fine relief (60 m)", temp: "Surface temperature", ops: "Access", ice: "Ice", ground: "Ground and dust",
    groundText: (bare: string, snow: string, veg: string) => `Bare ground over ${bare} of the window; snow or ice, ${snow}; vegetation, ${veg} (ESA WorldCover).`,
    groundNote: " It rehearses moving and digging on loose ground, not the destination's dust: lunar dust is sharp and electrostatically charged; Martian dust is ultra-fine and oxidizing.",
    v: { holds: "Holds", partly: "Partly", breaks: "Breaks", remote: "Remote", rural: "Rural", populated: "Populated", none: "No ice", earth_only: "Earth only" } as Record<string, string>,
    iceMoon: (psr: string) => `Permanent shadow covers ${psr} of the lunar window: cold traps where water ice survives.`,
    iceMars: (pos: string) => `${pos} of the Mars window is clearly consistent with ice in the top metre (SWIM).`,
    amended: (v: string) => ` Under the original rule it was "${v}"; amended after seeing the data because SWIM treats values near 0 as inconclusive.`,
    iceEarth: (pzi: string, share: string) => ` Permafrost at the twin: mean index ${pzi}, widespread over ${share} of the window.`,
    iceNote: " It rehearses drilling and digging frozen ground, not the destination's cold or process.",
    pending: "Not computed yet", notMeasured: "Not measured", failed: "Could not be computed",
    fineText: (d: string, e: string, p: string) => `Distance ${d} between 60 m slope fingerprints. Slopes of 15° or more: ${e} on Earth, ${p} at the destination.`,
    fineMars: "Not measured: there is no Mars elevation model finer than 463 m here.",
    tempText: (e0: string, e1: string, body: string, p0: string, p1: string, share: string) => `Earth ${e0} to ${e1} °C; ${body} ${p0} to ${p1} °C. The twin covers ${share} of the destination's range.`,
    colder: (c: string) => ` The destination gets ${c} °C colder.`,
    opsText: (mean: string, max: string, km: string | null) => `${mean} people/km² on average (maximum ${max}).${km ? ` Nearest settlement ${km} km away.` : ""}`,
    moon: "Moon", mars: "Mars",
  },
};

const TONE: Record<string, Tone> = { holds: "good", partly: "mid", breaks: "bad", remote: "info", rural: "info", populated: "info", none: "info", earth_only: "info" };

const num = (lang: Lang, v: number, digits = 0) => v.toLocaleString(lang === "es" ? "es-ES" : "en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (lang: Lang, v: number | null | undefined) => (v === null || v === undefined ? "—" : `${num(lang, v * 100)} %`);

function blank(key: Row["key"], label: string, lang: Lang, dim: Base | undefined, body: Body): Row {
  const t = L[lang];
  if (!dim) return { key, label, verdict: t.pending, tone: "none", text: "" };
  if (dim.status === "error") return { key, label, verdict: t.failed, tone: "none", text: "" };
  const text = key === "fine_relief" && body === "mars" && dim.reason !== "earth" ? t.fineMars : "";
  return { key, label, verdict: t.notMeasured, tone: "none", text };
}

/** The rows of a twin sheet, in the visitor's language. A missing sheet gives "pending" rows. */
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
  const i = sheet?.ice;
  if (i?.status === "measured" && i.verdict) {
    const dest = body === "moon" ? t.iceMoon(pct(lang, i.destination_psr_share)) : t.iceMars(pct(lang, i.destination_swim_clear_share ?? i.destination_swim_positive_share));
    const earth = i.earth_pzi_mean !== undefined ? t.iceEarth(num(lang, i.earth_pzi_mean, 2), pct(lang, i.earth_pzi_share)) : "";
    rows.push({ key: "ice", label: t.ice, verdict: t.v[i.verdict], tone: TONE[i.verdict], text: dest + earth + (i.verdict === "holds" ? t.iceNote : "") + (i.verdict_v1_1 && i.verdict_v1_1 !== i.verdict ? t.amended(t.v[i.verdict_v1_1]) : "") });
  } else {
    rows.push(blank("ice", t.ice, lang, i, body));
  }
  const g = sheet?.ground;
  rows.push(g?.status === "measured" && g.verdict && g.bare_share !== undefined
    ? { key: "ground", label: t.ground, verdict: t.v[g.verdict], tone: TONE[g.verdict],
        text: t.groundText(pct(lang, g.bare_share), pct(lang, g.snow_ice_share), pct(lang, g.vegetated_share)) + (g.verdict === "breaks" ? "" : t.groundNote) }
    : blank("ground", t.ground, lang, g, body));
  return rows;
}
