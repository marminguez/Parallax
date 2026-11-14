"use client";
import Link from "next/link";
import { AccessDetail, NationalityForm, useTeamPassports } from "@/components/parallax/TeamAccess";
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
import { TestWindowView } from "@/components/parallax/TestWindow";

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
  },
};

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
  const twinId = (reachableData as unknown as { destinations: { id: string; val004_twin: { id: string } }[] }).destinations.find(x => x.id === d.id)?.val004_twin.id ?? null;
  const kmText = (v: number) => Math.round(v).toLocaleString(lang === "es" ? "es-ES" : "en-GB");
  const NOV_CHIP: Record<NoveltyStatus, string> = { new: "wb-chip--good", known: "wb-chip--info", undecided: "wb-chip--none" };

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
              <h2 id="wb-dest-name">{siteName(lang, d.name)}</h2>
              <p>{KIND[lang][d.kind]}, {BODY_NAME[lang][d.body]}, <span className="num">{fmtCoord(d.lat, d.lon)}</span></p>
            </div>
            <div className="wb-actions">
              <button type="button" onClick={copy} className="wb-btn" aria-live="polite">{copied ? t.copied : t.copy}</button>
              <Link href={isPlanetaryTarget(d.id) ? `/experiments/new?target=${d.id}` : "/experiments/new"} className="wb-btn wb-btn--primary">{isPlanetaryTarget(d.id) ? t.searchFrom : t.open}</Link>
            </div>
          </header>

          <div className="wb-twin">
            <TwinPlate body={d.body} window={{ id: d.window, lat: d.lat, lon: d.lon }} distance={d.distance}
              earth={{ title: t.earth, place: `${d.earth.nearest}, ${country}`, coords: fmtCoord(d.earth.lat, d.earth.lon, 2), lat: d.earth.lat, lon: d.earth.lon }}
              planet={{ title: siteName(lang, d.name), place: KIND[lang][d.kind], coords: fmtCoord(d.lat, d.lon) }}
              verdict={verdict(lang, d.cls, d.closerThan, d.ofPairs)} />
            <div className="wb-sub">
              <h3 className="wb-section-title">{t.facts}</h3>
              <dl className="wb-dl">
                <div><dt>{t.twin}</dt><dd>{t.near(d.earth.nearest, d.earth.admin1, country, d.earth.km)}</dd><dd className="num">{d.earth.lat.toFixed(4)}, {d.earth.lon.toFixed(4)}</dd></div>
                <div><dt>{t.distance}</dt><dd>{likeness(d.distance, lang)} <span className="num wb-help">({d.distance.toFixed(3)})</span></dd><dd className="wb-help">{t.distanceNote}</dd></div>
                <div><dt>{t.dest}</dt><dd>{siteName(lang, d.name)} ({BODY_NAME[lang][d.body]})</dd><dd className="num">{fmtCoord(d.lat, d.lon)}</dd></div>
                <div><dt>{t.window}</dt><dd>{t.windowAt(d.window, d.windowKm)}</dd></div>
                {nov && <div style={{ gridColumn: "1 / -1" }}><dt>{t.novelty}</dt><dd><span className={`wb-chip ${NOV_CHIP[nov.status]}`}>{t.status[nov.status]}</span></dd><dd className="wb-help">{t.nearestKnown(nov.nearest_known.name, nov.nearest_known.list, kmText(nov.nearest_known.km))}</dd></div>}
              </dl>
              {TWIN_WINDOWS[d.id] && <TestWindowView data={TWIN_WINDOWS[d.id]} frozenFirst={false} />}
              <NationalityForm passports={passports} onChange={setPassports} />
              <AccessDetail cc={d.earth.cc} admin1={d.earth.admin1} siteId={twinId} passports={passports} />
              <Link href={`/misiones/campana?d=${d.id}`} className="wb-link">{t.reach(siteName(lang, d.name))}</Link>
            </div>
          </div>

          <section className="wb-sub" aria-labelledby="wb-dims">
            <h3 id="wb-dims" className="wb-section-title">{t.dims}</h3>
              <div className="wb-tablewrap">
                <table className="wb-table wb-stack">
                  <thead><tr><th scope="col">{t.dimCol}</th><th scope="col">{t.verdictCol}</th><th scope="col">{t.detailCol}</th></tr></thead>
                  <tbody>
                    {rows.map(r => <tr key={r.key}>
                      <th scope="row" className="wb-strong" style={{ fontWeight: 400, whiteSpace: "normal" }}>{r.label}</th>
                      <td><span className={`wb-chip ${TONE_CLASS[r.tone]}`}>{r.verdict}</span></td>
                      <td>{r.text}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            <p className="wb-help">{t.dimsNote}</p>
            <details className="wb-reveal"><summary>{t.missing}</summary><div className="wb-reveal-body">
              <ul className="wb-list">{t.missingList.map(m => <li key={m}>{m}</li>)}</ul>
            </div></details>
          </section>
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
