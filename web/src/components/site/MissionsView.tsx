"use client";
import Link from "next/link";
import { ACCESS, AccessDetail, NationalityForm, useTeamPassports } from "@/components/parallax/TeamAccess";
import { riskAt, type Risk } from "@/lib/access";
import reachableData from "../../../data/reachable-twins.json";
import { useEffect, useState } from "react";
import { Page } from "./Site";
import { TwinPlate } from "./Plates";
import { fmtCoord, useLang, useT } from "@/lib/i18n";
import { countryName, sites, type Destination } from "@/lib/sites";
import { BODY_NAME, KIND, siteName, verdict } from "@/lib/copy";
import { isPlanetaryTarget } from "@/lib/targets";
import type { Body } from "@/lib/underfoot";
import { describe, type Tone, type TwinSheets } from "@/lib/twinSheets";
import sheetsData from "../../../data/twin-sheets.json";
import { twinNovelty, type NoveltyStatus } from "@/lib/novelty";
import { likeness } from "@/lib/missionProfiles";
import { TWIN_WINDOWS } from "@/lib/twinWindows";
import { TestWindowView, windowShort } from "@/components/parallax/TestWindow";

const SHEETS = sheetsData as unknown as TwinSheets;
const TONE_CLASS: Record<Tone, string> = { good: "wb-chip--good", mid: "wb-chip--mid", bad: "wb-chip--bad", info: "wb-chip--info", none: "wb-chip--none" };

const T = {
  es: {
    h1: "Dónde ensayar, antes de ir.",
    lead: "Elige un destino de la Luna o de Marte y mira su gemelo en la Tierra: qué se parece y qué no.",
    tabs: "Destino", moon: "Luna: polo sur", mars: "Marte",
    groups: { reference: "Referencias", artemis: "Artemis III", landed: "Misiones aterrizadas", candidate: "Candidatos" } as Record<string, string>,
    earth: "Su gemelo en la Tierra",
    facts: "Ficha del gemelo",
    dest: "Destino", window: "Ventana analizada", windowAt: (id: string, km: number) => `${id}, a ${km.toFixed(1)} km del centro del destino`,
    twin: "Gemelo terrestre", near: (n: string, a: string, c: string, km: number) => `Cerca de ${n} (${a}, ${c}), a ${km.toFixed(0)} km`,
    distance: "Parecido", distanceNote: "Compara cómo se reparten las pendientes en 50 km (0 es idéntico).",
    copy: "Copiar coordenadas del gemelo", copied: "Coordenadas copiadas",
    open: "Abrir el buscador de experimentos", searchFrom: "Buscar sitios para ensayar esta región",
    reach: (to: string) => `¿Difícil llegar? Ver gemelos alcanzables para ${to}`,
    campaign: "Planificar una campaña", campaignLead: "El gemelo más parecido no siempre está cerca de un aeropuerto. Para cada destino, el gemelo fuerte más parecido a 100 km o menos de un aeropuerto con vuelos regulares, y diez sitios distintos para elegir.", campaignCta: "Ver gemelos alcanzables",
    missing: "Qué falta comprobar en el gemelo",
    missingList: ["Composición y granulometría del suelo frente al regolito.", "Luz: la altura del sol en el polo sur lunar (el buscador calcula un calendario de luz lunar para cada candidato).", "Acceso, permisos y espacio continuo para el ensayo.", "Rocas y cráteres pequeños, por debajo de 60 m."],
    novelty: "Frente a las listas de análogos",
    status: { new: "Análogo nuevo", known: "Ya en una lista", undecided: "Sin decidir" } as Record<NoveltyStatus, string>,
    nearestKnown: (name: string, list: string, km: string) => `El sitio de las listas más cercano es ${name} (${list}), a ${km} km.`,
    newH: "Sitios nuevos para ensayar",
    newLead: (n: number, total: number, k: number) => `${n} de los ${total} gemelos no tienen ningún análogo conocido a menos de 100 km. Los comparamos con ${k} sitios de tres listas: análogos que ya usan las agencias (VAL-001), sitios de entrenamiento de Apollo (VAL-002) y Analog Atlas, de otro equipo de Space Apps (VAL-003). La regla se fijó antes de calcular.`,
    newCols: ["Destino", "Gemelo en la Tierra", "Frente a las listas", "Análogo conocido más cercano"],
    view: "Ver",
    good: "Se mantiene", partly: "En parte", bad: "Se rompe", allDims: "Ver el detalle de cada dimensión y qué falta comprobar",
    methodH: "¿Cómo lo sabemos?", methodLead: "La medida, la validación a ciegas, los sitios nuevos y dónde la Tierra no llega.", methodCta: "Ver el método",
    dims: "Analogía por dimensión", dimCol: "Dimensión", verdictCol: "Veredicto", detailCol: "Detalle", pick: "Elige un destino",
    dimsNote: "Descriptivo, con umbrales fijados antes de calcular (caracterización v1.4; la regla de hielo en Marte se enmendó tras ver los datos y se publican ambas). No cambia el gemelo. La Tierra no reproduce la gravedad, el vacío ni la radiación.",
    hard: "Dónde la Tierra no llega",
    hardLead: (n: number, total: string) => `De ${total} ventanas de Marte, solo ${n} no tienen un gemelo fuerte en la Tierra. Están en los volcanes gigantes y en los cañones de Valles Marineris. Incluso ahí, el mejor gemelo terrestre se parece tanto como un análogo típico de los que usan las agencias.`,
    windows: (n: number) => n === 1 ? "1 ventana" : `${n} ventanas`,
    mapAlt: "Mapa de Marte en relieve sombreado con las ventanas sin gemelo fuerte marcadas",
    steps: "Del destino al ensayo",
    stepList: [
      { t: "Elige el destino", d: "Una región de Artemis III, un sitio de aterrizaje o tu propia referencia. Parallax congela su huella de pendientes antes de buscar." },
      { t: "Filtra los candidatos", d: "En el buscador de experimentos: pendiente máxima para tu rover, suelo desnudo, vegetación, zona de búsqueda y calendario de luz lunar." },
      { t: "Valida en campo", d: "Cada candidato llega con lo que está medido y lo que no. La decisión final necesita una visita y la geología del lugar." },
    ],
    stepCta: "Empezar una búsqueda",
    upH: "Próximas misiones y dónde ensayarlas",
    upLead: "Griffin, Endurance, VIPER, los LTV y MoonFall: qué va al polo sur lunar y dónde ensayarlo antes.", upCta: "Ver próximas misiones",
    upCols: ["Misión", "Quién la hace", "Cuándo", "Destino", "Su gemelo en la Tierra", "Qué ensayar"],
    upRegion: "Toda la región: busca con la referencia que mejor encaje",
    upSearch: "Buscar sitios",
    upSource: "Fuente",
    tabsSheet: { summary: "Resumen", conditions: "Condiciones", go: "Ir allí", how: "Cómo lo sabemos" } as Record<SheetTab, string>,
    glance: "De un vistazo", whenF: "Cuándo ensayar", airportF: "Aeropuerto con vuelos", papersF: "Papeles",
    reachable: "Alcanzable", far: "Lejos de un aeropuerto", noAirport: "sin dato",
    risk: { normal: "Riesgo normal", caution: "Precaución", reconsider: "Reconsiderar el viaje", avoid: "No viajar", unknown: "Sin investigar" } as Record<Risk, string>,
    headline: (twin: string, like: string, dest: string) => `${twin} es ${like.toLowerCase()} a ${dest} en el relieve.`,
    goodH: "Sirve para ensayar", badH: "No reproduce", warnH: "Antes de ir",
    noneGood: "Ninguna dimensión se mantiene del todo.", noneBad: "Ninguna dimensión se rompe.", noneWarn: "Nada destacado: aeropuerto cerca y sin avisos especiales.",
    seeConditions: "Ver el detalle en Condiciones", seeGo: "Ver qué hacer en Ir allí",
    warnFar: (km: string, ap: string) => `Aeropuerto con vuelos regulares a ${km} km (${ap}); la regla de campaña pide 100 km o menos.`,
    warnRisk: (r: string) => `Papeles: ${r}.`,
    warnWindow: "Ninguna época del año cumple la regla de trabajo al aire libre.",
    reachH: "¿Llega el equipo?",
    reachYes: (km: string, ap: string) => `Sí. Aeropuerto con vuelos regulares a ${km} km (${ap}): unas dos horas por carretera.`,
    reachNo: (km: string, ap: string) => `Queda lejos. El aeropuerto con vuelos regulares más cercano está a ${km} km (${ap}).`,
    altLead: (dest: string, name: string, km: string, like: string) => `Si no podéis ir aquí, por distancia, papeles o fechas: el gemelo alcanzable de ${dest} es ${name}, a ${km} km de un aeropuerto (${like.toLowerCase()}).`,
    altCta: "Ver el gemelo alcanzable", planCta: "Planificar la campaña",
    selfReach: "Este gemelo ya es el alcanzable de su destino. En la campaña tienes diez alternativas por continente.",
    whenH: "Cuándo ensayar", papersH: "Papeles y permisos", coordsH: "Coordenadas del gemelo",
    howWindow: "Ventana analizada", howRank: "Frente a los análogos que ya usan las agencias", howMore: "Ver el método completo",
  },
  en: {
    h1: "Where to rehearse, before you go.",
    lead: "Pick a destination on the Moon or Mars and see its twin on Earth: what matches and what does not.",
    tabs: "Destination", moon: "Moon: south pole", mars: "Mars",
    groups: { reference: "References", artemis: "Artemis III", landed: "Landed missions", candidate: "Candidates" } as Record<string, string>,
    earth: "Its twin on Earth",
    facts: "Twin sheet",
    dest: "Destination", window: "Window analysed", windowAt: (id: string, km: number) => `${id}, ${km.toFixed(1)} km from the destination's centre`,
    twin: "Earth twin", near: (n: string, a: string, c: string, km: number) => `Near ${n} (${a}, ${c}), ${km.toFixed(0)} km away`,
    distance: "Similarity", distanceNote: "Compares how slopes are distributed over 50 km (0 is identical).",
    copy: "Copy the twin's coordinates", copied: "Coordinates copied",
    open: "Open the experiment search", searchFrom: "Find sites to rehearse this region",
    reach: (to: string) => `Hard to reach? See reachable twins for ${to}`,
    campaign: "Plan a campaign", campaignLead: "The closest twin is not always near an airport. For each destination, the closest strong twin within 100 km of an airport with scheduled flights, and ten distinct sites to choose from.", campaignCta: "See reachable twins",
    missing: "What still needs checking at the twin",
    missingList: ["Soil composition and grain size against regolith.", "Light: the sun's height at the lunar south pole (the search computes a lunar light calendar for each candidate).", "Access, permits and continuous space for the test.", "Rocks and small craters, below 60 m."],
    novelty: "Against the analog lists",
    status: { new: "New analog", known: "Already on a list", undecided: "Undecided" } as Record<NoveltyStatus, string>,
    nearestKnown: (name: string, list: string, km: string) => `The nearest listed site is ${name} (${list}), ${km} km away.`,
    newH: "New places to rehearse",
    newLead: (n: number, total: number, k: number) => `${n} of the ${total} twins have no known analog within 100 km. We compared them with ${k} sites from three lists: analogs agencies already use (VAL-001), Apollo training sites (VAL-002) and Analog Atlas, from another Space Apps team (VAL-003). The rule was fixed before computing.`,
    newCols: ["Destination", "Earth twin", "Against the lists", "Nearest known analog"],
    view: "View",
    good: "Holds", partly: "Partly", bad: "Breaks", allDims: "See each dimension in detail and what still needs checking",
    methodH: "How do we know?", methodLead: "The measure, the blind validation, the new sites and where Earth falls short.", methodCta: "See the method",
    dims: "Analogy by dimension", dimCol: "Dimension", verdictCol: "Verdict", detailCol: "Detail", pick: "Choose a destination",
    dimsNote: "Descriptive, with thresholds fixed before computing (characterization v1.4; the Mars ice rule was amended after seeing the data, and both versions are published). It never changes the twin. Earth does not reproduce gravity, vacuum or radiation.",
    hard: "Where Earth falls short",
    hardLead: (n: number, total: string) => `Of ${total} Mars windows, only ${n} have no strong twin on Earth. They sit on the giant volcanoes and in the canyons of Valles Marineris. Even there, Earth's best twin is as close as a typical agency-used analog.`,
    windows: (n: number) => n === 1 ? "1 window" : `${n} windows`,
    mapAlt: "Shaded-relief map of Mars with the windows without a strong twin marked",
    steps: "From destination to test",
    stepList: [
      { t: "Pick the destination", d: "An Artemis III region, a landing site or your own reference. Parallax freezes its slope fingerprint before searching." },
      { t: "Filter the candidates", d: "In the experiment search: maximum slope for your rover, bare ground, vegetation, search area and lunar light calendar." },
      { t: "Validate in the field", d: "Each candidate comes with what is measured and what is not. The final decision needs a visit and the site's geology." },
    ],
    stepCta: "Start a search",
    upH: "Upcoming missions and where to rehearse them",
    upLead: "Griffin, Endurance, VIPER, the LTVs and MoonFall: what goes to the lunar south pole and where to rehearse it first.", upCta: "See upcoming missions",
    upCols: ["Mission", "Who builds it", "When", "Destination", "Its twin on Earth", "What to rehearse"],
    upRegion: "The whole region: search with the reference that fits best",
    upSearch: "Find sites",
    upSource: "Source",
    tabsSheet: { summary: "Summary", conditions: "Conditions", go: "Getting there", how: "How we know" } as Record<SheetTab, string>,
    glance: "At a glance", whenF: "When to rehearse", airportF: "Airport with flights", papersF: "Papers",
    reachable: "Reachable", far: "Far from an airport", noAirport: "no data",
    risk: { normal: "Normal risk", caution: "Caution", reconsider: "Reconsider travel", avoid: "Do not travel", unknown: "Not researched" } as Record<Risk, string>,
    headline: (twin: string, like: string, dest: string) => `${twin} is ${like.toLowerCase()} to ${dest} in its terrain.`,
    goodH: "Good for rehearsing", badH: "Does not reproduce", warnH: "Before you go",
    noneGood: "No dimension fully holds.", noneBad: "No dimension breaks.", noneWarn: "Nothing to flag: airport nearby and no special advisories.",
    seeConditions: "See the detail under Conditions", seeGo: "See what to do under Getting there",
    warnFar: (km: string, ap: string) => `Airport with scheduled flights ${km} km away (${ap}); the campaign rule asks for 100 km or less.`,
    warnRisk: (r: string) => `Papers: ${r}.`,
    warnWindow: "No time of year meets the outdoor-work rule.",
    reachH: "Can the team get there?",
    reachYes: (km: string, ap: string) => `Yes. Airport with scheduled flights ${km} km away (${ap}): about two hours by road.`,
    reachNo: (km: string, ap: string) => `It is far. The nearest airport with scheduled flights is ${km} km away (${ap}).`,
    altLead: (dest: string, name: string, km: string, like: string) => `If you cannot go here, for distance, papers or dates: ${dest}'s reachable twin is ${name}, ${km} km from an airport (${like.toLowerCase()}).`,
    altCta: "See the reachable twin", planCta: "Plan the campaign",
    selfReach: "This twin is already its destination's reachable twin. The campaign page has ten alternatives by continent.",
    whenH: "When to rehearse", papersH: "Papers and permits", coordsH: "Twin coordinates",
    howWindow: "Window analysed", howRank: "Against the analogs agencies already use", howMore: "See the full method",
  },
};
type SheetTab = "summary" | "conditions" | "go" | "how";
type Twin = { id: string; distance: number; airport?: { name: string; iata: string | null; municipality: string | null; km: number }; place: { nearest: string; countryCode: string } };
const REACH = (reachableData as unknown as { destinations: { id: string; val004_twin: Twin; val004_twin_reachable: boolean; reachable_twin: Twin | null }[] }).destinations;
const RISK_CHIP: Record<Risk, string> = { normal: "wb-chip--good", caution: "wb-chip--mid", reconsider: "wb-chip--bad", avoid: "wb-chip--bad", unknown: "wb-chip--none" };

const ORDER = ["reference", "artemis", "landed", "candidate"];

export default function MissionsView() {
  const t = useT(T);
  const { lang } = useLang();
  const [body, setBody] = useState<Body>("moon");
  const list = sites.destinations.filter(d => d.body === body);
  const [selected, setSelected] = useState<Record<Body, string>>({ moon: "nobile-rim-1", mars: "perseverance" });
  const d: Destination = list.find(x => x.id === selected[body]) ?? list[0];
  const [copied, setCopied] = useState(false);
  const country = countryName(d.earth.cc, lang);
  const rows = describe(SHEETS.sheets[d.id], d.body, lang, d.id);
  const nov = twinNovelty(d.id);
  const [passports, setPassports] = useTeamPassports();
  const reach = REACH.find(x => x.id === d.id) ?? null;
  const twinId = reach?.val004_twin.id ?? null;
  const [tab, setTab] = useState<SheetTab>("summary");
  const kmText = (v: number) => Math.round(v).toLocaleString(lang === "es" ? "es-ES" : "en-GB");
  const NOV_CHIP: Record<NoveltyStatus, string> = { new: "wb-chip--good", known: "wb-chip--info", undecided: "wb-chip--none" };
  const win = TWIN_WINDOWS[d.id] ?? null;
  const ap = reach?.val004_twin.airport ?? null;
  const apLabel = (a: NonNullable<Twin["airport"]>) => a.iata ? `${a.iata} · ${a.municipality ?? a.name}` : a.name;
  const risk = riskAt(ACCESS, d.earth.cc, twinId, d.earth.admin1);
  const good = rows.filter(r => r.tone === "good" || r.tone === "mid");
  const bad = rows.filter(r => r.tone === "bad");
  const warns = [
    ...(risk !== "normal" && risk !== "unknown" ? [t.warnRisk(t.risk[risk])] : []),
    ...(ap && reach && !reach.val004_twin_reachable ? [t.warnFar(kmText(ap.km), apLabel(ap))] : []),
    ...(win && !win.general.months.length ? [t.warnWindow] : []),
  ];
  const attention = warns.length > 0;

  // The open destination lives in the address (?d=), so a twin sheet can be shared.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("d");
    const hit = id ? sites.destinations.find(x => x.id === id) : undefined;
    if (!hit) return;
    const frame = requestAnimationFrame(() => { setBody(hit.body); setSelected(prev => ({ ...prev, [hit.body]: hit.id })); });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("d") === d.id) return;
    url.searchParams.set("d", d.id);
    history.replaceState(null, "", url);
  }, [d.id]);

  function choose(id: string) { setSelected({ ...selected, [body]: id }); }
  async function copy() {
    try { await navigator.clipboard.writeText(`${d.earth.lat.toFixed(4)}, ${d.earth.lon.toFixed(4)}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard is optional */ }
  }

  return <Page>
    <div className="wb">
      <header className="wb-head">
        <h1>{t.h1}</h1>
        <p>{t.lead}</p>
      </header>

      <section className="wb-mission">
        <nav aria-label={t.tabs} className="wb-rail">
          <div role="tablist" aria-label={t.tabs} className="wb-seg">
            {(["moon", "mars"] as Body[]).map(b => <button key={b} role="tab" aria-selected={body === b} type="button" onClick={() => setBody(b)}>{b === "moon" ? t.moon : t.mars}</button>)}
          </div>
          <label className="wb-field wb-rail-select" htmlFor="wb-destination">{t.pick}
            <select id="wb-destination" className="wb-input" value={d.id} onChange={e => choose(e.target.value)}>
              {ORDER.map(kind => {
                const items = list.filter(x => x.kind === kind);
                return items.length ? <optgroup key={kind} label={t.groups[kind]}>{items.map(x => <option key={x.id} value={x.id}>{siteName(lang, x.name)}</option>)}</optgroup> : null;
              })}
            </select>
          </label>
            {ORDER.map(kind => {
              const items = list.filter(x => x.kind === kind);
              if (!items.length) return null;
              return <div key={kind} className="wb-rail-list">
                <h2>{t.groups[kind]}</h2>
                <ul>
                  {items.map(x => {
                    const on = x.id === d.id;
                    return <li key={x.id}><button type="button" onClick={() => choose(x.id)} aria-current={on ? "true" : undefined} className="wb-dest">
                      <span>{siteName(lang, x.name)}</span><span className="num">{x.distance.toFixed(3)}</span>
                    </button></li>;
                  })}
                </ul>
              </div>;
            })}
        </nav>

        <article className="wb-sheet" aria-labelledby="wb-dest-name">
          <header className="wb-sheet-head">
            <div>
              <h2 id="wb-dest-name">{siteName(lang, d.name)} <span className="wb-arrow" aria-hidden="true">→</span> <span className="wb-sheet-twin">{d.earth.nearest}, {country}</span></h2>
              <p>{KIND[lang][d.kind]}, {BODY_NAME[lang][d.body]}, <span className="num">{fmtCoord(d.lat, d.lon)}</span></p>
            </div>
            <div className="wb-actions">
              <Link href={isPlanetaryTarget(d.id) ? `/experiments/new?target=${d.id}` : "/experiments/new"} className="wb-btn wb-btn--primary">{isPlanetaryTarget(d.id) ? t.searchFrom : t.open}</Link>
              {reach && <Link href={`/misiones/campana?d=${d.id}`} className={`wb-btn${attention ? " wb-btn--warn" : ""}`}>{reach.val004_twin_reachable ? t.planCta : t.altCta}</Link>}
            </div>
          </header>

          <div className="wb-twin">
            <TwinPlate body={d.body} window={{ id: d.window, lat: d.lat, lon: d.lon }} distance={d.distance}
              earth={{ title: t.earth, place: `${d.earth.nearest}, ${country}`, coords: fmtCoord(d.earth.lat, d.earth.lon, 2), lat: d.earth.lat, lon: d.earth.lon }}
              planet={{ title: siteName(lang, d.name), place: KIND[lang][d.kind], coords: fmtCoord(d.lat, d.lon) }}
              verdict={verdict(lang, d.cls, d.closerThan, d.ofPairs)} />
            <section className="wb-sub" aria-labelledby="wb-glance">
              <h3 id="wb-glance" className="wb-section-title">{t.glance}</h3>
              <dl className="wb-facts">
                <div><dt>{t.distance}</dt><dd>{likeness(d.distance, lang)}</dd></div>
                {nov && <div><dt>{t.novelty}</dt><dd><span className={`wb-chip ${NOV_CHIP[nov.status]}`}>{t.status[nov.status]}</span></dd></div>}
                {win && <div><dt>{t.whenF}</dt><dd className="wb-fact-sm">{windowShort(win.general, lang)}</dd></div>}
                <div><dt>{t.airportF}</dt><dd>{ap ? <>{kmText(ap.km)} km <span className={`wb-chip ${reach?.val004_twin_reachable ? "wb-chip--good" : "wb-chip--bad"}`}>{reach?.val004_twin_reachable ? t.reachable : t.far}</span></> : t.noAirport}</dd></div>
                <div><dt>{t.papersF} · {country}</dt><dd><span className={`wb-chip ${RISK_CHIP[risk]}`}>{t.risk[risk]}</span></dd></div>
              </dl>
            </section>
          </div>

          <div role="tablist" aria-label={siteName(lang, d.name)} className="wb-tabs">
            {(["summary", "conditions", "go", "how"] as SheetTab[]).map(k => <button key={k} type="button" role="tab" id={`wb-mtab-${k}`} aria-selected={tab === k} aria-controls={`wb-mpanel-${k}`} onClick={() => setTab(k)}>{t.tabsSheet[k]}</button>)}
          </div>

          {tab === "summary" && <div role="tabpanel" id="wb-mpanel-summary" aria-labelledby="wb-mtab-summary" className="wb-panel">
            <p className="wb-verdict">{t.headline(`${d.earth.nearest} (${country})`, likeness(d.distance, lang), siteName(lang, d.name))}</p>
            <div className="wb-tri">
              <section className="wb-card wb-card--good"><h4>{t.goodH}</h4>
                {good.length ? <ul className="wb-list">{good.map(r => <li key={r.key}>{r.label}{r.tone === "mid" && <span className="wb-help"> · {r.verdict.toLowerCase()}</span>}</li>)}</ul> : <p className="wb-help">{t.noneGood}</p>}
                <button type="button" className="wb-link wb-linkbtn" onClick={() => setTab("conditions")}>{t.seeConditions}</button></section>
              <section className="wb-card wb-card--bad"><h4>{t.badH}</h4>
                {bad.length ? <ul className="wb-list">{bad.map(r => <li key={r.key}>{r.label}</li>)}</ul> : <p className="wb-help">{t.noneBad}</p>}
                <button type="button" className="wb-link wb-linkbtn" onClick={() => setTab("conditions")}>{t.seeConditions}</button></section>
              <section className={`wb-card${warns.length ? " wb-card--warn" : ""}`}><h4>{t.warnH}</h4>
                {warns.length ? <ul className="wb-list">{warns.map(w => <li key={w}>{w}</li>)}</ul> : <p className="wb-help">{t.noneWarn}</p>}
                <button type="button" className="wb-link wb-linkbtn" onClick={() => setTab("go")}>{t.seeGo}</button></section>
            </div>
          </div>}

          {tab === "conditions" && <div role="tabpanel" id="wb-mpanel-conditions" aria-labelledby="wb-mtab-conditions" className="wb-panel">
            <ul className="wb-dimcards">{rows.map(r => <li key={r.key} className="wb-card">
              <div className="wb-dimcard-head"><h4>{r.label}</h4><span className={`wb-chip ${TONE_CLASS[r.tone]}`}>{r.verdict}</span></div>
              <p>{r.text}</p>
            </li>)}</ul>
            <p className="wb-help">{t.dimsNote}</p>
            <details className="wb-reveal"><summary>{t.missing}</summary><div className="wb-reveal-body">
              <ul className="wb-list">{t.missingList.map(m => <li key={m}>{m}</li>)}</ul>
            </div></details>
          </div>}

          {tab === "go" && <div role="tabpanel" id="wb-mpanel-go" aria-labelledby="wb-mtab-go" className="wb-panel">
            <div className="wb-gocards">
              <section className={`wb-card${reach && !reach.val004_twin_reachable ? " wb-card--warn" : ""}`}><h4>{t.reachH}</h4>
                {ap ? <p>{reach?.val004_twin_reachable ? t.reachYes(kmText(ap.km), apLabel(ap)) : t.reachNo(kmText(ap.km), apLabel(ap))}</p> : <p className="wb-help">{t.noAirport}</p>}
                {reach?.reachable_twin && !reach.val004_twin_reachable && <p className="wb-help">{t.altLead(siteName(lang, d.name), `${reach.reachable_twin.place.nearest}, ${countryName(reach.reachable_twin.place.countryCode, lang)}`, kmText(reach.reachable_twin.airport?.km ?? 0), likeness(reach.reachable_twin.distance, lang))}</p>}
                {reach?.val004_twin_reachable && <p className="wb-help">{t.selfReach}</p>}
                {reach && <Link href={`/misiones/campana?d=${d.id}`} className={`wb-btn${reach.val004_twin_reachable ? "" : " wb-btn--primary"}`}>{reach.val004_twin_reachable ? t.planCta : t.altCta}</Link>}
                <div className="wb-coords">
                  <p><span className="wb-help">{t.coordsH}</span><br /><span className="num">{d.earth.lat.toFixed(4)}, {d.earth.lon.toFixed(4)}</span> <span className="wb-help">· {t.near(d.earth.nearest, d.earth.admin1, country, d.earth.km)}</span></p>
                  <button type="button" onClick={copy} className="wb-btn" aria-live="polite">{copied ? t.copied : t.copy}</button>
                </div>
              </section>
              <section className="wb-card"><h4>{t.whenH}</h4>
                {win ? <TestWindowView data={win} frozenFirst={false} /> : <p className="wb-help">{t.noAirport}</p>}
              </section>
              <section className={`wb-card wb-card--wide${risk === "reconsider" || risk === "avoid" ? " wb-card--warn" : ""}`}><h4>{t.papersH} · {country} <span className={`wb-chip ${RISK_CHIP[risk]}`}>{t.risk[risk]}</span></h4>
                <NationalityForm passports={passports} onChange={setPassports} />
                <AccessDetail cc={d.earth.cc} admin1={d.earth.admin1} siteId={twinId} passports={passports} bare />
              </section>
            </div>
          </div>}

          {tab === "how" && <div role="tabpanel" id="wb-mpanel-how" aria-labelledby="wb-mtab-how" className="wb-panel">
            <dl className="wb-dl">
              <div><dt>{t.distance}</dt><dd>{likeness(d.distance, lang)} <span className="num wb-help">({d.distance.toFixed(3)})</span></dd><dd className="wb-help">{t.distanceNote}</dd></div>
              <div><dt>{t.howRank}</dt><dd>{verdict(lang, d.cls, d.closerThan, d.ofPairs)}</dd></div>
              <div><dt>{t.howWindow}</dt><dd>{t.windowAt(d.window, d.windowKm)}</dd></div>
              {nov && <div><dt>{t.novelty}</dt><dd><span className={`wb-chip ${NOV_CHIP[nov.status]}`}>{t.status[nov.status]}</span></dd><dd className="wb-help">{t.nearestKnown(nov.nearest_known.name, nov.nearest_known.list, kmText(nov.nearest_known.km))}</dd></div>}
            </dl>
            <p className="wb-help">{t.dimsNote}</p>
            <Link href="/metodo" className="wb-link">{t.howMore}</Link>
          </div>}
        </article>
      </section>

      <section aria-labelledby="upcoming-link" className="wb-band">
        <div>
          <h2 id="upcoming-link">{t.upH}</h2>
          <p>{t.upLead}</p>
        </div>
        <Link href="/proximas-misiones" className="wb-btn wb-btn--primary">{t.upCta}</Link>
      </section>

      <section aria-labelledby="method-link" className="wb-band">
        <div>
          <h2 id="method-link">{t.methodH}</h2>
          <p>{t.methodLead}</p>
        </div>
        <Link href="/metodo" className="wb-btn">{t.methodCta}</Link>
      </section>
    </div>
  </Page>;
}
