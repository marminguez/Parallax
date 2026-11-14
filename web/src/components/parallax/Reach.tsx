"use client";
import Link from "next/link";
import { useLang, useT } from "@/lib/i18n";
import { countryName } from "@/lib/places";
import { isReachable, REACHABLE_KM, type Airport } from "@/lib/airports";
import { likeness } from "@/lib/missionProfiles";
import type { Candidate } from "@/lib/search";
import campaignData from "../../../data/reachable-twins.json";

type CampaignWin = { id: string; lat: number; lon: number; distance: number; airport: { km: number }; place: { nearest: string; countryCode: string } };
const CAMPAIGN = (campaignData as unknown as { destinations: { id: string; reachable_twin: CampaignWin | null }[] }).destinations;

const T = {
  es: {
    h: "¿Llega el equipo?",
    yes: (km: string, ap: string) => `Sí. Aeropuerto con vuelos regulares a ${km} km (${ap}): unas dos horas por carretera.`,
    no: (km: string, ap: string) => `Queda lejos. El aeropuerto con vuelos regulares más cercano está a ${km} km (${ap}); la regla de campaña pide ${REACHABLE_KM} km o menos.`,
    unknown: "Sin dato de aeropuerto para esta ventana.",
    altH: "Alternativa alcanzable en esta búsqueda",
    alt: (rank: number, name: string, km: string, like: string) => `Nº ${rank}: ${name}. Aeropuerto a ${km} km. ${like}; cumple las mismas condiciones.`,
    altBtn: "Ver ese sitio",
    altNone: `Ningún sitio de esta búsqueda está a ${REACHABLE_KM} km o menos de un aeropuerto con vuelos regulares.`,
    twinH: (dest: string) => `Gemelo alcanzable de ${dest}`,
    twin: (name: string, km: string, like: string) => `${name}, a ${km} km de un aeropuerto. ${like}. No aplica las condiciones de esta búsqueda.`,
    twinBtn: "Ficha de campaña",
    note: "Distancia en línea recta al aeropuerto más cercano con vuelos regulares (OurAirports, regla de campaña v1). No dice nada de carreteras, fronteras, permisos ni acceso según la estación.",
  },
  en: {
    h: "Can the team get there?",
    yes: (km: string, ap: string) => `Yes. Airport with scheduled flights ${km} km away (${ap}): about two hours by road.`,
    no: (km: string, ap: string) => `It is far. The nearest airport with scheduled flights is ${km} km away (${ap}); the campaign rule asks for ${REACHABLE_KM} km or less.`,
    unknown: "No airport data for this window.",
    altH: "Reachable alternative in this search",
    alt: (rank: number, name: string, km: string, like: string) => `No. ${rank}: ${name}. Airport ${km} km away. ${like}; it meets the same conditions.`,
    altBtn: "See that site",
    altNone: `No site in this search is within ${REACHABLE_KM} km of an airport with scheduled flights.`,
    twinH: (dest: string) => `Reachable twin of ${dest}`,
    twin: (name: string, km: string, like: string) => `${name}, ${km} km from an airport. ${like}. It does not apply this search's conditions.`,
    twinBtn: "Campaign sheet",
    note: "Straight-line distance to the nearest airport with scheduled flights (OurAirports, campaign rule v1). It says nothing about roads, borders, permits or seasonal access.",
  },
};

export function airportLabel(a: Airport) {
  return a.iata ? `${a.iata} · ${a.municipality ?? a.name}` : a.name;
}

/**
 * Reachability v1 on a candidate sheet: is the nearest scheduled airport within 100 km?
 * If not, the best-ranked reachable site of the same search, and the destination's
 * reachable twin from campaign v1. Display only.
 */
export default function Reach({ c, ranked, names, campaignId, destShort, onPick }: {
  c: Candidate; ranked: { c: Candidate; rank: number }[]; names: (c: Candidate) => string;
  campaignId: string | null; destShort: string; onPick: (id: string) => void;
}) {
  const t = useT(T);
  const { lang } = useLang();
  const km = (v: number) => Math.round(v).toLocaleString(lang);
  if (!c.airport) return <section aria-label={t.h}><h4 className="wb-section-title" style={{ fontSize: "var(--text-sm)" }}>{t.h}</h4><p className="wb-help">{t.unknown}</p></section>;
  const ok = isReachable(c.airport);
  const alt = ok ? null : ranked.find(r => r.c.id !== c.id && isReachable(r.c.airport)) ?? null;
  const twin = !ok && campaignId ? CAMPAIGN.find(d => d.id === campaignId)?.reachable_twin ?? null : null;
  const like = (d: number | null) => { const s = likeness(d, lang); return lang === "es" ? `${s} a ${destShort}` : `${s} to ${destShort}`; };
  return <section aria-label={t.h} className="grid gap-2">
    <h4 className="wb-section-title" style={{ fontSize: "var(--text-sm)" }}>{t.h}</h4>
    <p><span className={`wb-chip ${ok ? "wb-chip--good" : "wb-chip--bad"}`}>{ok ? (lang === "es" ? "Alcanzable" : "Reachable") : (lang === "es" ? "Lejos de un aeropuerto" : "Far from an airport")}</span></p>
    <p>{ok ? t.yes(km(c.airport.km), airportLabel(c.airport)) : t.no(km(c.airport.km), airportLabel(c.airport))}</p>
    {!ok && <div className="wb-window">
      <p><strong>{t.altH}</strong></p>
      {alt ? <>
        <p className="wb-help">{t.alt(alt.rank, names(alt.c), km(alt.c.airport!.km), like(alt.c.jsd))}</p>
        <p><button type="button" className="wb-btn" onClick={() => onPick(alt.c.id)}>{t.altBtn}<span className="visually-hidden"> {names(alt.c)}</span></button></p>
      </> : <p className="wb-help">{t.altNone}</p>}
    </div>}
    {twin && twin.id !== c.id && <div className="wb-window">
      <p><strong>{t.twinH(destShort)}</strong></p>
      <p className="wb-help">{t.twin(`${twin.place.nearest}, ${countryName(twin.place.countryCode, lang)}`, km(twin.airport.km), like(twin.distance))}</p>
      <p><Link className="wb-btn" href={`/misiones/campana/ficha?d=${campaignId}&w=${twin.id}`}>{t.twinBtn}</Link></p>
    </div>}
    <p className="wb-help">{t.note}</p>
  </section>;
}
