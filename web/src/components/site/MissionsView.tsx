"use client";
import Link from "next/link";
import { useState } from "react";
import { Page } from "./Site";
import { TwinPlate } from "./Plates";
import { fmtCoord, fmtNum, useLang, useT } from "@/lib/i18n";
import { countryName, sites, type Destination } from "@/lib/sites";
import { BODY_NAME, KIND, siteName, verdict } from "@/lib/copy";
import { REVERSE_BASE, type Body } from "@/lib/underfoot";
import { describe, type Tone, type TwinSheets } from "@/lib/twinSheets";
import sheetsData from "../../../data/twin-sheets.json";

const SHEETS = sheetsData as unknown as TwinSheets;
const TONE_CLASS: Record<Tone, string> = {
  good: "border-[var(--positive)]/50 text-[var(--positive)]",
  mid: "border-[var(--warning)]/50 text-[var(--warning)]",
  bad: "border-[var(--critical)]/50 text-[var(--critical)]",
  info: "border-white/25 text-[var(--text-secondary)]",
  none: "border-white/10 text-[var(--text-muted)]",
};

const T = {
  es: {
    h1: "Dónde ensayar, antes de ir.",
    lead: "Elige un destino de la Luna o de Marte. Parallax te muestra el lugar de la Tierra cuyo terreno se comporta igual a escala de 50 km, cuánto se parece y qué falta por comprobar antes de mandar a nadie allí.",
    tabs: "Destino", moon: "Luna: polo sur", mars: "Marte",
    groups: { reference: "Referencias", artemis: "Artemis III", landed: "Misiones aterrizadas", candidate: "Candidatos" } as Record<string, string>,
    earth: "Su gemelo en la Tierra",
    facts: "Ficha del gemelo",
    dest: "Destino", window: "Ventana analizada", windowAt: (id: string, km: number) => `${id}, a ${km.toFixed(1)} km del centro del destino`,
    twin: "Gemelo terrestre", near: (n: string, a: string, c: string, km: number) => `Cerca de ${n} (${a}, ${c}), a ${km.toFixed(0)} km`,
    distance: "Distancia", distanceNote: "Jensen-Shannon entre distribuciones de pendientes; 0 es idéntico.",
    copy: "Copiar coordenadas del gemelo", copied: "Coordenadas copiadas",
    open: "Abrir el buscador de experimentos",
    reach: (to: string) => `¿Difícil llegar? Ver gemelos alcanzables para ${to}`,
    campaign: "Planificar una campaña", campaignLead: "El gemelo más parecido no siempre está cerca de un aeropuerto. Para cada destino, el gemelo fuerte más parecido a 100 km o menos de un aeropuerto con vuelos regulares, y diez sitios distintos para elegir.", campaignCta: "Ver gemelos alcanzables",
    missing: "Qué falta comprobar en el gemelo",
    missingList: ["Composición y granulometría del suelo frente al regolito.", "Luz: la altura del sol en el polo sur lunar (el buscador calcula un calendario de luz lunar para cada candidato).", "Acceso, permisos y espacio continuo para el ensayo.", "Rocas y cráteres pequeños, por debajo de 60 m."],
    dims: "Analogía por dimensión",
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
  },
  en: {
    h1: "Where to rehearse, before you go.",
    lead: "Pick a destination on the Moon or Mars. Parallax shows the place on Earth whose terrain behaves the same at 50 km scale, how close it is, and what still needs checking before anyone is sent there.",
    tabs: "Destination", moon: "Moon: south pole", mars: "Mars",
    groups: { reference: "References", artemis: "Artemis III", landed: "Landed missions", candidate: "Candidates" } as Record<string, string>,
    earth: "Its twin on Earth",
    facts: "Twin sheet",
    dest: "Destination", window: "Window analysed", windowAt: (id: string, km: number) => `${id}, ${km.toFixed(1)} km from the destination's centre`,
    twin: "Earth twin", near: (n: string, a: string, c: string, km: number) => `Near ${n} (${a}, ${c}), ${km.toFixed(0)} km away`,
    distance: "Distance", distanceNote: "Jensen-Shannon between slope distributions; 0 is identical.",
    copy: "Copy the twin's coordinates", copied: "Coordinates copied",
    open: "Open the experiment search",
    reach: (to: string) => `Hard to reach? See reachable twins for ${to}`,
    campaign: "Plan a campaign", campaignLead: "The closest twin is not always near an airport. For each destination, the closest strong twin within 100 km of an airport with scheduled flights, and ten distinct sites to choose from.", campaignCta: "See reachable twins",
    missing: "What still needs checking at the twin",
    missingList: ["Soil composition and grain size against regolith.", "Light: the sun's height at the lunar south pole (the search computes a lunar light calendar for each candidate).", "Access, permits and continuous space for the test.", "Rocks and small craters, below 60 m."],
    dims: "Analogy by dimension",
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
  const hard = sites.hardest.mars;
  const features = Object.entries(sites.hardestFeatures).filter(([k]) => k !== "Other").sort((a, b) => b[1] - a[1]);

  async function copy() {
    try { await navigator.clipboard.writeText(`${d.earth.lat.toFixed(4)}, ${d.earth.lon.toFixed(4)}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard is optional */ }
  }

  return <Page>
    <section className="max-w-[760px] pb-12 pt-14 lg:pt-20">
      <h1 className="font-display text-[44px] leading-[1.04] sm:text-[60px]">{t.h1}</h1>
      <p className="mt-5 max-w-[62ch] text-[17px] leading-8 text-[var(--text-secondary)]">{t.lead}</p>
    </section>

    <div role="tablist" aria-label={t.tabs} className="inline-flex rounded-sm border border-white/15 p-1">
      {(["moon", "mars"] as Body[]).map(b => <button key={b} role="tab" aria-selected={body === b} type="button" onClick={() => setBody(b)}
        className={`rounded-sm px-4 py-2 text-sm ${body === b ? "bg-white text-black" : "text-[var(--text-secondary)] hover:text-white"}`}>{b === "moon" ? t.moon : t.mars}</button>)}
    </div>

    <section className="mt-8 grid gap-10 lg:grid-cols-[280px_1fr]">
      <nav aria-label={t.tabs} className="space-y-6">
        {ORDER.map(kind => {
          const items = list.filter(x => x.kind === kind);
          if (!items.length) return null;
          return <div key={kind}>
            <h2 className="text-[13px] text-[var(--text-muted)]">{t.groups[kind]}</h2>
            <ul className="mt-2 border-l border-white/10">
              {items.map(x => {
                const on = x.id === d.id;
                return <li key={x.id}><button type="button" onClick={() => setSelected({ ...selected, [body]: x.id })} aria-current={on ? "true" : undefined}
                  className={`-ml-px flex w-full items-baseline justify-between gap-3 border-l-2 py-1.5 pl-3 pr-1 text-left text-sm ${on ? "border-white text-white" : "border-transparent text-[var(--text-secondary)] hover:text-white"}`}>
                  <span>{siteName(lang, x.name)}</span><span className="font-mono text-xs tabular-nums text-[var(--text-muted)]">{x.distance.toFixed(3)}</span>
                </button></li>;
              })}
            </ul>
          </div>;
        })}
      </nav>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_330px]">
        <TwinPlate body={d.body} window={{ id: d.window, lat: d.lat, lon: d.lon }} distance={d.distance}
          earth={{ title: t.earth, place: `${d.earth.nearest}, ${country}`, coords: fmtCoord(d.earth.lat, d.earth.lon, 2), lat: d.earth.lat, lon: d.earth.lon }}
          planet={{ title: siteName(lang, d.name), place: KIND[lang][d.kind], coords: fmtCoord(d.lat, d.lon) }}
          verdict={verdict(lang, d.cls, d.closerThan, d.ofPairs)} />
        <div>
          <h2 className="font-display text-2xl">{t.facts}</h2>
          <dl className="mt-4 divide-y divide-white/[0.08] border-y border-white/[0.08] text-sm">
            <div className="py-3"><dt className="text-[var(--text-muted)]">{t.dest}</dt><dd className="mt-1">{siteName(lang, d.name)} ({BODY_NAME[lang][d.body]}), {fmtCoord(d.lat, d.lon)}</dd></div>
            <div className="py-3"><dt className="text-[var(--text-muted)]">{t.window}</dt><dd className="mt-1">{t.windowAt(d.window, d.windowKm)}</dd></div>
            <div className="py-3"><dt className="text-[var(--text-muted)]">{t.twin}</dt><dd className="mt-1">{t.near(d.earth.nearest, d.earth.admin1, country, d.earth.km)}<br /><span className="font-mono text-xs text-[var(--text-secondary)]">{d.earth.lat.toFixed(4)}, {d.earth.lon.toFixed(4)}</span></dd></div>
            <div className="py-3"><dt className="text-[var(--text-muted)]">{t.distance}</dt><dd className="mt-1"><span className="font-mono">{d.distance.toFixed(4)}</span><p className="mt-1 text-xs text-[var(--text-muted)]">{t.distanceNote}</p></dd></div>
          </dl>
          <h3 className="mt-6 text-sm text-white">{t.dims}</h3>
          <ul className="mt-2 divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {describe(SHEETS.sheets[d.id], d.body, lang).map(r => (
              <li key={r.key} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[var(--text-muted)]">{r.label}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs ${TONE_CLASS[r.tone]}`}>{r.verdict}</span>
                </div>
                {r.text && <p className="mt-1.5 text-[13px] leading-5 text-[var(--text-secondary)]">{r.text}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{t.dimsNote}</p>
          <div className="mt-5 flex flex-col gap-2">
            <button type="button" onClick={copy} className="h-11 rounded-sm border border-white/20 px-4 text-sm hover:border-white/50" aria-live="polite">{copied ? t.copied : t.copy}</button>
            <Link href="/experiments/new" className="flex h-11 items-center justify-center rounded-sm bg-white px-4 text-sm font-medium text-black hover:bg-[var(--earth-bright)]">{t.open}</Link>
            <Link href={`/misiones/campana?d=${d.id}`} className="mt-1 text-center text-sm text-[var(--earth-bright)] underline decoration-white/20 underline-offset-4 hover:decoration-white/60">{t.reach(siteName(lang, d.name))}</Link>
          </div>
          <h3 className="mt-8 text-sm text-white">{t.missing}</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] leading-6 text-[var(--text-secondary)]">{t.missingList.map(m => <li key={m}>{m}</li>)}</ul>
        </div>
      </div>
    </section>

    <section aria-labelledby="campaign" className="mt-20">
      <Link href="/misiones/campana" className="group grid gap-6 rounded-xl bg-white/[0.045] p-8 transition-colors hover:bg-white/[0.075] md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 id="campaign" className="font-display text-3xl sm:text-4xl">{t.campaign}</h2>
          <p className="mt-3 max-w-[66ch] text-[15px] leading-7 text-[var(--text-secondary)]">{t.campaignLead}</p>
        </div>
        <span className="inline-flex h-10 items-center self-start rounded-full border border-white/70 px-5 text-sm text-white transition-colors group-hover:bg-white group-hover:text-black md:self-center">{t.campaignCta}</span>
      </Link>
    </section>

    <section aria-labelledby="hard" className="mt-24 border-t border-white/[0.08] pt-12">
      <h2 id="hard" className="font-display text-3xl sm:text-4xl">{t.hard}</h2>
      <p className="mt-3 max-w-[66ch] text-[15px] leading-7 text-[var(--text-secondary)]">{t.hardLead(hard.length, fmtNum(lang, sites.headline.mars.windows))}</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_260px]">
        <div className="relative aspect-[2/1] w-full overflow-hidden bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${REVERSE_BASE}/mars-map.png`} alt={t.mapAlt} className="absolute inset-0 h-full w-full object-cover opacity-75 [filter:grayscale(1)_contrast(1.15)]" />
          {hard.map(w => <span key={w.id} title={`${w.feature} · ${w.distance.toFixed(3)}`} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--warning)] ring-2 ring-black/60"
            style={{ left: `${((w.lon + 180) / 360) * 100}%`, top: `${((90 - w.lat) / 180) * 100}%` }} />)}
        </div>
        <ul className="divide-y divide-white/[0.08] border-y border-white/[0.08] text-sm">
          {features.map(([name, n]) => <li key={name} className="flex items-baseline justify-between py-2.5"><span>{name}</span><span className="text-[var(--text-muted)]">{t.windows(n)}</span></li>)}
        </ul>
      </div>
    </section>

    <section aria-labelledby="steps" className="mt-24 border-t border-white/[0.08] pt-12">
      <h2 id="steps" className="font-display text-3xl sm:text-4xl">{t.steps}</h2>
      <ol className="mt-8 grid gap-8 md:grid-cols-3">
        {t.stepList.map((s, k) => <li key={s.t} className="border-t border-white/15 pt-4">
          <span className="font-display text-2xl text-[var(--text-muted)]">{k + 1}</span>
          <h3 className="mt-1 text-white">{s.t}</h3>
          <p className="mt-2 text-[15px] leading-7 text-[var(--text-secondary)]">{s.d}</p>
        </li>)}
      </ol>
      <Link href="/experiments/new" className="mt-8 inline-flex h-12 items-center rounded-sm bg-white px-5 text-sm font-medium text-black hover:bg-[var(--earth-bright)]">{t.stepCta}</Link>
    </section>
  </Page>;
}
