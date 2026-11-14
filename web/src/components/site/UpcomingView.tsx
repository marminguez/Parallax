"use client";
import Link from "next/link";
import { Page } from "./Site";
import { useLang, useT } from "@/lib/i18n";
import { countryName, sites } from "@/lib/sites";
import { likeness } from "@/lib/missionProfiles";
import { UPCOMING, type UpcomingMission } from "@/lib/upcomingMissions";
import { TWIN_WINDOWS } from "@/lib/twinWindows";
import { windowShort } from "@/components/parallax/TestWindow";

/**
 * Próximas misiones: what NASA's Moon Base programme sends to the lunar south pole next,
 * and where on Earth to rehearse each one. Missions with a landing site show their published
 * twin; region-wide ones open the search. Every button lands on the quick search with both
 * questions already answered.
 */
const T = {
  es: {
    eyebrow: "Programa Moon Base · NASA",
    h1: "Lo que va al polo sur lunar, y dónde ensayarlo antes",
    lead: "Cinco misiones en los próximos dos años. Para cada una, el sitio de la Tierra con el terreno más parecido a su destino.",
    timeline: "Calendario",
    landH: "Con lugar de aterrizaje",
    regionH: "Para toda la región",
    regionLead: "Aún sin sitio fijo: busca con la región de Artemis III que más te interese.",
    moon: "Polo sur lunar", earth: "Tierra",
    tests: "Qué ensayar en su gemelo", winH: (p: string) => `Cuándo ensayar en ${p}`, winGeneral: "Trabajo al aire libre", winFrozen: "Suelo helado",
    search: "Buscar sitios para esta misión", twin: "Ver el gemelo", pick: "Elegir región y buscar",
    likeTip: (d: string) => `Distancia de pendientes ${d}`,
    note: "Fechas «no antes de»: pueden moverse. Fuentes: anuncios del programa Moon Base de NASA (mayo–julio de 2026) y su presentación en NASA Space Apps 2026.",
    source: "Fuente",
  },
  en: {
    eyebrow: "NASA Moon Base programme",
    h1: "What goes to the lunar south pole, and where to rehearse it first",
    lead: "Five missions over the next two years. For each, the place on Earth whose terrain is closest to its destination.",
    timeline: "Timeline",
    landH: "With a landing site",
    regionH: "For the whole region",
    regionLead: "No fixed site yet: search with the Artemis III region that interests you most.",
    moon: "Lunar south pole", earth: "Earth",
    tests: "What to rehearse at its twin", winH: (p: string) => `When to rehearse in ${p}`, winGeneral: "Outdoor work", winFrozen: "Frozen ground",
    search: "Find sites for this mission", twin: "See the twin", pick: "Pick a region and search",
    likeTip: (d: string) => `Slope distance ${d}`,
    note: "Dates are \"no earlier than\" and may move. Sources: NASA Moon Base announcements (May–July 2026) and its briefing at NASA Space Apps 2026.",
    source: "Source",
  },
};

function MoonIcon({ label }: { label: string }) {
  return <svg role="img" aria-label={label} viewBox="0 0 88 88" className="wb-orb"><circle cx="44" cy="44" r="40" fill="#8F95A1" /><circle cx="30" cy="34" r="8" fill="#6F7580" /><circle cx="56" cy="52" r="11" fill="#747A85" /><circle cx="52" cy="24" r="5" fill="#6F7580" /><circle cx="28" cy="60" r="4" fill="#6F7580" /></svg>;
}
function EarthIcon({ label }: { label: string }) {
  return <svg role="img" aria-label={label} viewBox="0 0 88 88" className="wb-orb"><circle cx="44" cy="44" r="40" fill="#1F4F7A" /><path d="M18 34c8-10 20-12 26-6s-2 14 6 18 16-2 20 6-8 16-18 14-12-8-20-6-18-6-14-26z" fill="#3E7A4E" /></svg>;
}

export default function UpcomingView() {
  const t = useT(T);
  const { lang } = useLang();
  const years = [2026, 2027, 2028] as const;
  const landers = UPCOMING.filter(m => m.site);
  const region = UPCOMING.filter(m => !m.site);
  const searchHref = (m: UpcomingMission, target: string) => `/experiments/new?test=${m.category}&target=${target}`;

  return <Page>
    <div className="wb">
      <header className="wb-head">
        <p className="wb-eyebrow">{t.eyebrow}</p>
        <h1>{t.h1}</h1>
        <p>{t.lead}</p>
      </header>

      <section aria-label={t.timeline} className="wb-timeline">
        <ol>{years.map((y, i) => <li key={y}>
          <span className="num">{y}</span>
          <span aria-hidden="true" className={i === years.length - 1 ? "wb-dot wb-dot--open" : "wb-dot"} />
          <span>{UPCOMING.filter(m => m.year === y).map(m => m.name.split(" (")[0]).join(" · ")}</span>
        </li>)}</ol>
      </section>

      <section aria-labelledby="land" className="wb-upsec">
        <h2 id="land">{t.landH}</h2>
        <div className="wb-mcards wb-mcards--big">{landers.map(m => {
          const d = sites.destinations.find(x => x.id === m.site)!;
          return <article key={m.id} className="wb-mcard">
            <div className="wb-twinpair">
              <div><MoonIcon label={t.moon} /><strong>{m.region[lang]}</strong><span>{t.moon}</span></div>
              <div className="wb-twinpair-mid"><span className="wb-chip wb-chip--info" title={t.likeTip(d.distance.toFixed(3))}>{likeness(d.distance, lang)}</span><svg aria-hidden="true" viewBox="0 0 90 12" width="90" height="12"><path d="M2 6h84M78 1l8 5-8 5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></div>
              <div><EarthIcon label={t.earth} /><strong>{d.earth.nearest}</strong><span>{[d.earth.admin1, countryName(d.earth.cc, lang)].filter(Boolean).join(", ")}</span></div>
            </div>
            <div className="wb-mcard-body">
              <div className="wb-mcard-meta"><span className="wb-date">{m.when[lang]}</span><span className="wb-help">{m.maker[lang]}</span></div>
              <h3>{m.name}</h3>
              <p>{m.payload[lang]}</p>
              <div><p className="wb-help">{t.tests}</p><ul className="wb-tags">{m.tests[lang].map(x => <li key={x}>{x}</li>)}</ul></div>
              {TWIN_WINDOWS[d.id] && <div className="wb-window"><p className="wb-help">{t.winH(d.earth.nearest)}</p>
                <p><strong>{t.winGeneral}</strong> · {windowShort(TWIN_WINDOWS[d.id].general, lang)}</p>
                <p><strong>{t.winFrozen}</strong> · {windowShort(TWIN_WINDOWS[d.id].frozen, lang)}</p></div>}
              <div className="wb-mcard-cta">
                <Link href={searchHref(m, d.id)} className="wb-btn wb-btn--primary">{t.search}</Link>
                <Link href={`/misiones?d=${d.id}`} className="wb-btn">{t.twin}</Link>
                <a href={m.source} target="_blank" rel="noreferrer" className="wb-link wb-help">{t.source}</a>
              </div>
            </div>
          </article>;
        })}</div>
      </section>

      <section aria-labelledby="region" className="wb-upsec">
        <h2 id="region">{t.regionH}</h2>
        <p className="wb-help">{t.regionLead}</p>
        <div className="wb-mcards">{region.map(m => <article key={m.id} className="wb-mcard wb-mcard--small">
          <div className="wb-mcard-meta"><span className="wb-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={m.icon} /></svg></span><span className="wb-date">{m.when[lang]}</span></div>
          <h3>{m.name}</h3>
          <span className="wb-help">{m.maker[lang]}</span>
          <p>{m.payload[lang]}</p>
          <ul className="wb-tags">{m.tests[lang].map(x => <li key={x}>{x}</li>)}</ul>
          <div className="wb-mcard-cta">
            <Link href={`/experiments/new?test=${m.category}`} className="wb-btn">{t.pick}</Link>
            <a href={m.source} target="_blank" rel="noreferrer" className="wb-link wb-help">{t.source}</a>
          </div>
        </article>)}</div>
      </section>

      <p className="wb-help">{t.note}</p>
    </div>
  </Page>;
}
