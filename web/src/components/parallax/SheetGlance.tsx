"use client";
import { useLang, useT } from "@/lib/i18n";
import { riskAt, type Risk } from "@/lib/access";
import { isReachable, type Airport } from "@/lib/airports";
import { likeness } from "@/lib/missionProfiles";
import { ACCESS } from "./TeamAccess";
import { useTestWindow, windowShort } from "./TestWindow";

/**
 * "At a glance" for a search candidate's sheet, the same block as the Missions analog sheet:
 * likeness, bare ground, when to rehearse (live NASA POWER), airport and permits.
 * Also returns the "Before you go" warnings through `useWarnings`, so the Summary cards agree.
 */
const T = {
  es: {
    h: "De un vistazo", like: (d: string) => `Parecido a ${d}`, bare: "Suelo desnudo", when: "Cuándo ensayar", airport: "Aeropuerto con vuelos", permits: "Permisos",
    reachable: "Alcanzable", far: "Lejos de un aeropuerto", loading: "Calculando…", none: "sin dato",
    risk: { normal: "Riesgo normal", caution: "Precaución", reconsider: "Reconsiderar el viaje", avoid: "No viajar", unknown: "Sin investigar" } as Record<Risk, string>,
    warnRisk: (r: string) => `Permisos: ${r.toLowerCase()}.`,
    warnFar: (km: number, ap: string) => `Aeropuerto con vuelos regulares a ${km} km (${ap}); la regla de campaña pide 100 km o menos.`,
    warnWindow: "Ninguna época del año cumple la regla de trabajo al aire libre.",
  },
  en: {
    h: "At a glance", like: (d: string) => `Similarity to ${d}`, bare: "Bare ground", when: "When to rehearse", airport: "Airport with flights", permits: "Permits",
    reachable: "Reachable", far: "Far from an airport", loading: "Working out…", none: "no data",
    risk: { normal: "Normal risk", caution: "Caution", reconsider: "Reconsider travel", avoid: "Do not travel", unknown: "Not researched" } as Record<Risk, string>,
    warnRisk: (r: string) => `Permits: ${r.toLowerCase()}.`,
    warnFar: (km: number, ap: string) => `Airport with scheduled flights ${km} km away (${ap}); the campaign rule asks for 100 km or less.`,
    warnWindow: "No time of year meets the outdoor-work rule.",
  },
};
export const RISK_CHIP: Record<Risk, string> = { normal: "wb-chip--good", caution: "wb-chip--mid", reconsider: "wb-chip--bad", avoid: "wb-chip--bad", unknown: "wb-chip--none" };
const apLabel = (a: Airport) => a.iata ? `${a.iata} · ${a.municipality ?? a.name}` : a.name;

type Site = { lat: number; lon: number; jsd: number | null; bare: number | null; airport?: Airport | null; cc?: string | null; admin1?: string | null; id: string };

export function useWarnings(s: Site, live: boolean): string[] {
  const t = useT(T);
  const { data } = useTestWindow(s.lat, s.lon, live);
  const risk = s.cc ? riskAt(ACCESS, s.cc, s.id, s.admin1) : "unknown";
  return [
    ...(risk !== "normal" && risk !== "unknown" ? [t.warnRisk(t.risk[risk])] : []),
    ...(s.airport && !isReachable(s.airport) ? [t.warnFar(Math.round(s.airport.km), apLabel(s.airport))] : []),
    ...(live && data && !data.general.months.length ? [t.warnWindow] : []),
  ];
}

export default function SheetGlance({ s, dest, live }: { s: Site; dest: string; live: boolean }) {
  const t = useT(T);
  const { lang } = useLang();
  const { data, error } = useTestWindow(s.lat, s.lon, live);
  const risk = s.cc ? riskAt(ACCESS, s.cc, s.id, s.admin1) : "unknown";
  return <section className="wb-sub" aria-labelledby="wb-glance-s">
    <h4 id="wb-glance-s" className="wb-section-title">{t.h}</h4>
    <dl className="wb-facts">
      {s.jsd !== null && <div><dt>{t.like(dest)}</dt><dd>{likeness(s.jsd, lang)}</dd></div>}
      {s.bare !== null && <div><dt>{t.bare}</dt><dd>{Math.round(s.bare * 100)} %</dd></div>}
      {live && <div><dt>{t.when}</dt><dd className="wb-fact-sm">{data ? windowShort(data.general, lang) : error ? t.none : t.loading}</dd></div>}
      {s.airport && <div><dt>{t.airport}</dt><dd>{Math.round(s.airport.km)} km <span className={`wb-chip ${isReachable(s.airport) ? "wb-chip--good" : "wb-chip--bad"}`}>{isReachable(s.airport) ? t.reachable : t.far}</span></dd></div>}
      {s.cc && <div><dt>{t.permits}</dt><dd><span className={`wb-chip ${RISK_CHIP[risk]}`}>{t.risk[risk]}</span></dd></div>}
    </dl>
  </section>;
}

const C = {
  es: { goodH: "Sirve para ensayar", badH: "No reproduce", warnH: "Antes de ir", noneGood: "Ninguna condición medida se mantiene del todo.", noneBad: "Ninguna condición medida se rompe.", noneWarn: "Nada destacado: aeropuerto cerca y sin avisos especiales.", seeCond: "Ver el detalle en Condiciones", seeGo: "Ver qué hacer en Ir allí", pending: (n: number) => n === 1 ? "1 comprobación pendiente en campo." : `${n} comprobaciones pendientes en campo.` },
  en: { goodH: "Good for rehearsing", badH: "Does not reproduce", warnH: "Before you go", noneGood: "No measured condition fully holds.", noneBad: "No measured condition breaks.", noneWarn: "Nothing to flag: airport nearby and no special advisories.", seeCond: "See the detail under Conditions", seeGo: "See what to do under Getting there", pending: (n: number) => n === 1 ? "1 check still to do in the field." : `${n} checks still to do in the field.` },
};

/** The three Summary cards of the analog sheet: good for, does not reproduce, before you go. */
export function SummaryCards({ s, live, good, bad, pending, onTab }: { s: Site; live: boolean; good: string[]; bad: string[]; pending: number; onTab: (tab: "conditions" | "go") => void }) {
  const t = useT(C);
  const warns = [...useWarnings(s, live), ...(pending ? [t.pending(pending)] : [])];
  return <div className="wb-tri">
    <section className="wb-card wb-card--good"><h4>{t.goodH}</h4>
      {good.length ? <ul className="wb-list">{good.map(x => <li key={x}>{x}</li>)}</ul> : <p className="wb-help">{t.noneGood}</p>}
      <button type="button" className="wb-link wb-linkbtn" onClick={() => onTab("conditions")}>{t.seeCond}</button></section>
    <section className="wb-card wb-card--bad"><h4>{t.badH}</h4>
      {bad.length ? <ul className="wb-list">{bad.map(x => <li key={x}>{x}</li>)}</ul> : <p className="wb-help">{t.noneBad}</p>}
      <button type="button" className="wb-link wb-linkbtn" onClick={() => onTab("conditions")}>{t.seeCond}</button></section>
    <section className={`wb-card${warns.length ? " wb-card--warn" : ""}`}><h4>{t.warnH}</h4>
      {warns.length ? <ul className="wb-list">{warns.map(w => <li key={w}>{w}</li>)}</ul> : <p className="wb-help">{t.noneWarn}</p>}
      <button type="button" className="wb-link wb-linkbtn" onClick={() => onTab("go")}>{t.seeGo}</button></section>
  </div>;
}
