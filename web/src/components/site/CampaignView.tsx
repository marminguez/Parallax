"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Page } from "./Site";
import { EarthSquare } from "./Plates";
import { fmtCoord, fmtNum, useLang, useT, type Lang } from "@/lib/i18n";
import { countryName } from "@/lib/sites";
import { KIND, siteName } from "@/lib/copy";
import { CONTINENTS, filterShortlist, hasLodging, hasMonths, workableRanges, type CampaignData, type CampaignWindow, type LogisticsData, type SiteLogistics } from "@/lib/campaign";
import LunarLightCalendar from "@/components/parallax/LunarLightCalendar";
import campaignData from "../../../data/reachable-twins.json";
import logisticsData from "../../../data/campaign-logistics.json";

const campaign = campaignData as unknown as CampaignData;
const logistics = logisticsData as unknown as LogisticsData;

const ORDER = ["reference", "artemis", "landed", "candidate"];

const T = {
  es: {
    crumb: "Misiones", here: "Planificar una campaña",
    h1: "El gemelo al que sí puedes ir.",
    lead: "El gemelo más parecido a veces está lejos de cualquier aeropuerto. Aquí, para cada destino, Parallax busca entre todos los gemelos fuertes el más parecido que esté a 100 km o menos de un aeropuerto con vuelos regulares, y te da diez sitios distintos para elegir.",
    moon: "Luna: polo sur", mars: "Marte", destination: "Destino",
    groups: { reference: "Referencias", artemis: "Artemis III", landed: "Misiones aterrizadas", candidate: "Candidatos" } as Record<string, string>,
    original: "Gemelo del mapa inverso", reachable: "Gemelo alcanzable", same: "El gemelo ya es alcanzable",
    sameNote: "El gemelo más parecido ya está cerca de un aeropuerto con vuelos regulares: no hace falta cambiar de sitio.",
    distance: "Distancia", airport: (name: string, km: number) => `${name}, a ${fmtKm(km)} km`,
    band: { near: "≤ 100 km de un aeropuerto", mid: "100–250 km de un aeropuerto", far: "> 250 km de un aeropuerto" } as Record<string, string>,
    cost: (a: string, b: string) => `Se parece algo menos (${a} → ${b}) y sigue siendo un gemelo fuerte: más parecido que tres de cada cuatro análogos que ya usan las agencias.`,
    counts: (good: string, reach: string) => `De ${good} gemelos fuertes en la Tierra, ${reach} están a 100 km o menos de un aeropuerto con vuelos regulares.`,
    none: "Ningún gemelo fuerte de este destino está a 100 km o menos de un aeropuerto con vuelos regulares. La regla no se relaja.",
    shortlist: "Diez sitios para elegir",
    shortlistNote: "Ordenados por parecido. Ninguno se solapa con otro: son sitios de campo distintos.",
    all: "Todos", noneIn: "Ninguno de los diez está en este continente.",
    continents: { AF: "África", AS: "Asia", EU: "Europa", NA: "Norteamérica", OC: "Oceanía", SA: "Sudamérica" } as Record<string, string>,
    near: (n: string, a: string, c: string) => [n, a, c].filter(Boolean).join(", "),
    checks: "Antes de ir, comprueba",
    checkList: ["Permisos de acceso y zonas protegidas.", "Seguridad y avisos de viaje del país.", "Estado de las carreteras y acceso según la estación.", "Suelo: composición, granulometría y capacidad portante.", "Las seis dimensiones de la ficha (relieve fino, temperatura, acceso, hielo, suelo y roca) solo están calculadas para el gemelo del mapa inverso."],
    method: "Regla fijada antes de calcular (config/campaign/reachable_twins_v1.yaml). Gemelo fuerte: distancia ≤ 0,299, el mismo umbral del mapa inverso. Aeropuertos: OurAirports (dominio público), grandes y medianos con vuelos regulares; distancia en línea recta desde el centro de la ventana. No cambia ningún gemelo del mapa inverso.",
    back: "Volver a Misiones",
    when: "Cuándo ir", sleep: "Dónde dormir", pending: "Pendiente de cálculo", failed: "No se pudo calcular",
    monthsShort: ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
    monthsLong: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    workable: (n: number, ranges: string) => n === 12 ? "Se puede trabajar todo el año." : n === 0 ? "Ningún mes cumple: frío, calor o lluvia extremos todo el año." : `${n} ${n === 1 ? "mes" : "meses"} buenos: ${ranges}.`,
    monthTip: (m: string, a: number, b: number, r: number) => `${m}: ${a} a ${b} °C, ${r} mm/día`,
    workableRule: "Mes bueno: mínimas de −10 °C o más, máximas de 35 °C o menos y 3 mm/día de lluvia o menos (NASA POWER).",
    lodgingLine: (n50: number, n25: number) => `${n50} alojamientos a 50 km o menos (${n25} a 25 km o menos).`,
    nearestLodging: (name: string, type: string, km: number) => `El más cercano: ${name} (${type}), a ${Math.round(km)} km.`,
    noLodging: "OpenStreetMap no tiene alojamientos a 50 km o menos. Puede estar incompleto: no prueba que no haya.",
    unnamed: "sin nombre", lodgingShort: (n: number) => `${n} ${n === 1 ? "alojamiento" : "alojamientos"}`,
    types: { hotel: "hotel", motel: "motel", guest_house: "casa de huéspedes", hostel: "albergue", chalet: "chalé", apartment: "apartamento", alpine_hut: "refugio de montaña", camp_site: "camping" } as Record<string, string>,
    lodgingNote: "Alojamientos de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL). No se comprueban apertura, precio, capacidad ni si aceptan grupos.",
    lunarLight: "En los destinos lunares, el calendario de luz muestra cuándo el Sol está tan bajo como en el polo sur.",
  },
  en: {
    crumb: "Missions", here: "Plan a campaign",
    h1: "The twin you can actually reach.",
    lead: "The closest twin is sometimes far from any airport. Here, for each destination, Parallax looks through every strong twin for the closest one within 100 km of an airport with scheduled flights, and gives you ten distinct sites to choose from.",
    moon: "Moon: south pole", mars: "Mars", destination: "Destination",
    groups: { reference: "References", artemis: "Artemis III", landed: "Landed missions", candidate: "Candidates" } as Record<string, string>,
    original: "Reverse-map twin", reachable: "Reachable twin", same: "The twin is already reachable",
    sameNote: "The closest twin is already near an airport with scheduled flights: no need to move.",
    distance: "Distance", airport: (name: string, km: number) => `${name}, ${fmtKm(km)} km away`,
    band: { near: "≤ 100 km from an airport", mid: "100–250 km from an airport", far: "> 250 km from an airport" } as Record<string, string>,
    cost: (a: string, b: string) => `Slightly less alike (${a} → ${b}) and still a strong twin: closer than three in four analogs agencies already use.`,
    counts: (good: string, reach: string) => `Of ${good} strong twins on Earth, ${reach} are within 100 km of an airport with scheduled flights.`,
    none: "No strong twin of this destination is within 100 km of an airport with scheduled flights. The rule is not relaxed.",
    shortlist: "Ten sites to choose from",
    shortlistNote: "Ordered by similarity. None overlaps another: they are distinct field sites.",
    all: "All", noneIn: "None of the ten is on this continent.",
    continents: { AF: "Africa", AS: "Asia", EU: "Europe", NA: "North America", OC: "Oceania", SA: "South America" } as Record<string, string>,
    near: (n: string, a: string, c: string) => [n, a, c].filter(Boolean).join(", "),
    checks: "Before you go, check",
    checkList: ["Access permits and protected areas.", "Safety and the country's travel advisories.", "Road condition and seasonal access.", "Soil: composition, grain size and bearing strength.", "The six dimensions of the twin sheet (fine relief, temperature, access, ice, ground and rock) are computed only for the reverse-map twin."],
    method: "Rule fixed before computing (config/campaign/reachable_twins_v1.yaml). Strong twin: distance ≤ 0.299, the reverse map's own threshold. Airports: OurAirports (public domain), large and medium with scheduled flights; straight-line distance from the window centre. No reverse-map twin changes.",
    back: "Back to Missions",
    when: "When to go", sleep: "Where to sleep", pending: "Not computed yet", failed: "Could not be computed",
    monthsShort: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
    monthsLong: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    workable: (n: number, ranges: string) => n === 12 ? "Workable all year." : n === 0 ? "No month qualifies: extreme cold, heat or rain all year." : `${n} good ${n === 1 ? "month" : "months"}: ${ranges}.`,
    monthTip: (m: string, a: number, b: number, r: number) => `${m}: ${a} to ${b} °C, ${r} mm/day`,
    workableRule: "Good month: lows of −10 °C or above, highs of 35 °C or below and 3 mm/day of rain or less (NASA POWER).",
    lodgingLine: (n50: number, n25: number) => `${n50} places to stay within 50 km (${n25} within 25 km).`,
    nearestLodging: (name: string, type: string, km: number) => `Nearest: ${name} (${type}), ${Math.round(km)} km away.`,
    noLodging: "OpenStreetMap has no places to stay within 50 km. It may be incomplete: this is not proof there are none.",
    unnamed: "unnamed", lodgingShort: (n: number) => `${n} ${n === 1 ? "place to stay" : "places to stay"}`,
    types: { hotel: "hotel", motel: "motel", guest_house: "guest house", hostel: "hostel", chalet: "chalet", apartment: "apartment", alpine_hut: "mountain hut", camp_site: "campsite" } as Record<string, string>,
    lodgingNote: "Places to stay from OpenStreetMap (© OpenStreetMap contributors, ODbL). Opening, prices, capacity and group bookings are not checked.",
    lunarLight: "For lunar destinations, the light calendar shows when the Sun is as low as at the south pole.",
  },
};

function MonthStrip({ site, t, compact = false }: { site: SiteLogistics | undefined; t: (typeof T)["es"]; compact?: boolean }) {
  if (!site) return <p className="text-xs text-[var(--text-muted)]">{t.pending}</p>;
  if (!hasMonths(site.calendar)) return <p className="text-xs text-[var(--text-muted)]">{t.failed}</p>;
  const months = site.calendar.months;
  const ranges = workableRanges(months).map(([a, b]) => a === b ? t.monthsLong[a] : `${t.monthsLong[a]}–${t.monthsLong[b]}`).join(", ");
  return <div>
    <div className={`grid grid-cols-12 gap-0.5 ${compact ? "w-[132px]" : ""}`} role="img" aria-label={t.workable(site.calendar.workable_count, ranges)}>
      {months.map((m, i) => <span key={m.month} title={t.monthTip(t.monthsLong[i], m.tmin, m.tmax, m.rain)}
        className={`flex h-6 items-center justify-center rounded-[3px] text-[10px] ${m.workable ? "bg-[var(--positive)]/80 text-black" : "bg-white/[0.06] text-[var(--text-muted)]"}`}>{compact ? "" : t.monthsShort[i]}</span>)}
    </div>
    {!compact && <p className="mt-2 text-sm text-[var(--text-secondary)]">{t.workable(site.calendar.workable_count, ranges)}</p>}
  </div>;
}

function LodgingLine({ site, t }: { site: SiteLogistics | undefined; t: (typeof T)["es"] }) {
  if (!site) return <p className="text-sm text-[var(--text-muted)]">{t.pending}</p>;
  const l = site.lodging;
  if (!hasLodging(l)) return <p className="text-sm text-[var(--text-muted)]">{t.failed}</p>;
  if (!l.nearest) return <p className="text-sm text-[var(--warning)]">{t.noLodging}</p>;
  return <p className="text-sm text-[var(--text-secondary)]">{t.lodgingLine(l.within_50km, l.within_25km)} {t.nearestLodging(l.nearest.name ?? t.unnamed, t.types[l.nearest.type] ?? l.nearest.type, l.nearest.km)}</p>;
}

const fmtKm = (km: number) => Math.round(km).toString();

function airportName(w: CampaignWindow) {
  const a = w.airport;
  return a.iata ? `${a.iata} · ${a.municipality ?? a.name}` : a.name;
}

function TwinCard({ title, w, lang, accent, t }: { title: string; w: CampaignWindow; lang: Lang; accent?: boolean; t: (typeof T)["es"] }) {
  const country = countryName(w.place.countryCode, lang);
  return <article className={`rounded-xl p-6 ${accent ? "bg-white/[0.07] ring-1 ring-[var(--earth-primary)]/50" : "bg-white/[0.04]"}`}>
    <p className={`text-xs uppercase tracking-[0.14em] ${accent ? "text-[var(--earth-bright)]" : "text-[var(--text-muted)]"}`}>{title}</p>
    <div className="mt-3 grid grid-cols-[112px_1fr] gap-5 sm:grid-cols-[150px_1fr]">
      <div className="overflow-hidden rounded-md"><EarthSquare lat={w.lat} lon={w.lon} label={`${w.place.nearest}, ${country}`} /></div>
      <div className="min-w-0">
        <h3 className="font-display text-[26px] leading-tight">{w.place.nearest}, {country}</h3>
        <p className="font-mono text-xs text-[var(--text-secondary)]">{fmtCoord(w.lat, w.lon, 3)}</p>
        <dl className="mt-3 space-y-2 text-sm">
          <div><dt className="text-[var(--text-muted)]">{t.distance}</dt><dd className="font-mono">{w.distance.toFixed(4)}</dd></div>
          <div><dt className="text-[var(--text-muted)]">{t.band[w.band]}</dt><dd>{t.airport(airportName(w), w.airport.km)}</dd></div>
        </dl>
      </div>
    </div>
    <div className="mt-5 space-y-4 border-t border-white/[0.08] pt-4">
      <div><h4 className="mb-2 text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">{t.when}</h4><MonthStrip site={logistics.sites[w.id]} t={t} /></div>
      <div><h4 className="mb-1 text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">{t.sleep}</h4><LodgingLine site={logistics.sites[w.id]} t={t} /></div>
    </div>
  </article>;
}

export default function CampaignView() {
  const t = useT(T);
  const { lang } = useLang();
  const [body, setBody] = useState<"moon" | "mars">("moon");
  const [selected, setSelected] = useState<Record<string, string>>({ moon: "nobile-rim-1", mars: "opportunity" });
  const [continent, setContinent] = useState<string | null>(null);

  // A link from a twin sheet may open a destination directly: /misiones/campana?d=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("d");
    const hit = campaign.destinations.find(x => x.id === id);
    if (!hit) return;
    const frame = requestAnimationFrame(() => { setBody(hit.body); setSelected(prev => ({ ...prev, [hit.body]: hit.id })); });
    return () => cancelAnimationFrame(frame);
  }, []);

  const list = campaign.destinations.filter(x => x.body === body);
  const d = list.find(x => x.id === selected[body]) ?? list[0];
  const same = d.reachable_twin?.id === d.val004_twin.id;
  const shown = filterShortlist(d, continent);
  const num = (v: number) => v.toLocaleString(lang === "es" ? "es-ES" : "en-GB", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return <Page>
    <section className="max-w-[760px] pb-10 pt-14 lg:pt-20">
      <p className="text-sm text-[var(--text-muted)]"><Link href="/misiones" className="hover:text-white">{t.crumb}</Link> / {t.here}</p>
      <h1 className="font-display mt-3 text-[44px] leading-[1.04] sm:text-[60px]">{t.h1}</h1>
      <p className="mt-5 max-w-[62ch] text-[17px] leading-8 text-[var(--text-secondary)]">{t.lead}</p>
    </section>

    <div className="flex flex-wrap items-center gap-3">
      <div role="tablist" aria-label={t.destination} className="inline-flex rounded-full border border-white/15 p-1">
        {(["moon", "mars"] as const).map(b => <button key={b} role="tab" aria-selected={body === b} type="button" onClick={() => { setBody(b); setContinent(null); }}
          className={`rounded-full px-4 py-2 text-sm ${body === b ? "bg-white text-black" : "text-[var(--text-secondary)] hover:text-white"}`}>{b === "moon" ? t.moon : t.mars}</button>)}
      </div>
      <label className="sr-only" htmlFor="campaign-destination">{t.destination}</label>
      <select id="campaign-destination" value={d.id} onChange={e => { setSelected({ ...selected, [body]: e.target.value }); setContinent(null); }}
        className="h-11 rounded-full border border-white/15 bg-[#0b0f14] px-4 text-sm text-white">
        {ORDER.map(kind => {
          const items = list.filter(x => x.kind === kind);
          return items.length ? <optgroup key={kind} label={t.groups[kind]}>{items.map(x => <option key={x.id} value={x.id}>{siteName(lang, x.name)}</option>)}</optgroup> : null;
        })}
      </select>
      <span className="text-sm text-[var(--text-muted)]">{KIND[lang][d.kind]}</span>
    </div>

    <p className="mt-6 max-w-[70ch] text-[15px] leading-7 text-[var(--text-secondary)]">{t.counts(fmtNum(lang, d.good_twins), fmtNum(lang, d.reachable_good_twins))}</p>

    {same && d.reachable_twin ? <section className="mt-6 grid gap-4 md:grid-cols-[minmax(0,420px)_1fr] md:items-start">
      <TwinCard title={t.same} w={d.reachable_twin} lang={lang} accent t={t} />
      <p className="text-[15px] leading-7 text-[var(--text-secondary)] md:pt-6">{t.sameNote}</p>
    </section> : <section className="mt-6 grid gap-4 md:grid-cols-2 md:items-start">
      <TwinCard title={t.original} w={d.val004_twin} lang={lang} t={t} />
      {d.reachable_twin ? <div>
        <TwinCard title={t.reachable} w={d.reachable_twin} lang={lang} accent t={t} />
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{t.cost(num(d.val004_twin.distance), num(d.reachable_twin.distance))}</p>
      </div> : <p className="rounded-xl bg-white/[0.04] p-6 text-[15px] leading-7 text-[var(--warning)]">{t.none}</p>}
    </section>}

    {d.body === "moon" && d.reachable_twin && <section className="mt-6 max-w-[880px]">
      <p className="text-sm text-[var(--text-secondary)]">{t.lunarLight}</p>
      <LunarLightCalendar key={d.reachable_twin.id} lat={d.reachable_twin.lat} lon={d.reachable_twin.lon} />
    </section>}

    {d.shortlist.length > 0 && <section aria-labelledby="shortlist" className="mt-16 border-t border-white/[0.08] pt-10">
      <h2 id="shortlist" className="font-display text-3xl sm:text-4xl">{t.shortlist}</h2>
      <p className="mt-2 text-[15px] text-[var(--text-secondary)]">{t.shortlistNote}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {[null, ...CONTINENTS].map(c => {
          const n = c ? d.shortlist.filter(w => w.airport.continent === c).length : d.shortlist.length;
          if (c && !n) return null;
          const on = continent === c;
          return <button key={c ?? "all"} type="button" onClick={() => setContinent(c)} aria-pressed={on}
            className={`h-9 rounded-full border px-4 text-sm ${on ? "border-white bg-white text-black" : "border-white/20 text-[var(--text-secondary)] hover:text-white"}`}>
            {c ? t.continents[c] : t.all} <span className="opacity-60">{n}</span>
          </button>;
        })}
      </div>
      {shown.length ? <ol className="mt-6 divide-y divide-white/[0.08] border-y border-white/[0.08]">
        {shown.map(w => {
          const rank = d.shortlist.indexOf(w) + 1;
          const site = logistics.sites[w.id];
          return <li key={w.id} className="grid gap-2 py-4 sm:grid-cols-[40px_1fr_100px_minmax(0,240px)_140px] sm:items-baseline sm:gap-6">
            <span className="font-display text-2xl text-[var(--text-muted)]">{rank}</span>
            <div><p className="text-white">{t.near(w.place.nearest, w.place.admin1, countryName(w.place.countryCode, lang))}</p><p className="font-mono text-xs text-[var(--text-muted)]">{fmtCoord(w.lat, w.lon, 3)}</p></div>
            <span className="font-mono text-sm">{w.distance.toFixed(4)}</span>
            <span className="text-sm text-[var(--text-secondary)]">{t.airport(airportName(w), w.airport.km)}</span>
            <div className="space-y-1"><MonthStrip site={site} t={t} compact />{site && hasLodging(site.lodging) && <p className="text-xs text-[var(--text-muted)]">{t.lodgingShort(site.lodging.within_50km)}</p>}</div>
          </li>;
        })}
      </ol> : <p className="mt-6 text-sm text-[var(--text-muted)]">{t.noneIn}</p>}
    </section>}

    <section className="mt-16 grid gap-10 border-t border-white/[0.08] pt-10 md:grid-cols-2">
      <div>
        <h2 className="font-display text-2xl">{t.checks}</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-6 text-[var(--text-secondary)]">{t.checkList.map(c => <li key={c}>{c}</li>)}</ul>
      </div>
      <div>
        <p className="text-xs leading-5 text-[var(--text-muted)]">{t.method}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{t.workableRule}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{t.lodgingNote}</p>
        <Link href="/misiones" className="mt-5 inline-flex h-11 items-center rounded-full border border-white/70 px-5 text-sm hover:bg-white hover:text-black">{t.back}</Link>
      </div>
    </section>
  </Page>;
}
