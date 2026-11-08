"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Page } from "./Site";
import { EarthSquare } from "./Plates";
import { fmtCoord, fmtNum, useLang, useT, type Lang } from "@/lib/i18n";
import { countryName } from "@/lib/sites";
import { KIND, siteName } from "@/lib/copy";
import { CONTINENTS, filterShortlist, type CampaignData, type CampaignWindow } from "@/lib/campaign";
import campaignData from "../../../data/reachable-twins.json";

const campaign = campaignData as unknown as CampaignData;

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
  },
};

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
          return <li key={w.id} className="grid gap-2 py-4 sm:grid-cols-[40px_1fr_120px_minmax(0,260px)] sm:items-baseline sm:gap-6">
            <span className="font-display text-2xl text-[var(--text-muted)]">{rank}</span>
            <div><p className="text-white">{t.near(w.place.nearest, w.place.admin1, countryName(w.place.countryCode, lang))}</p><p className="font-mono text-xs text-[var(--text-muted)]">{fmtCoord(w.lat, w.lon, 3)}</p></div>
            <span className="font-mono text-sm">{w.distance.toFixed(4)}</span>
            <span className="text-sm text-[var(--text-secondary)]">{t.airport(airportName(w), w.airport.km)}</span>
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
        <Link href="/misiones" className="mt-5 inline-flex h-11 items-center rounded-full border border-white/70 px-5 text-sm hover:bg-white hover:text-black">{t.back}</Link>
      </div>
    </section>
  </Page>;
}
