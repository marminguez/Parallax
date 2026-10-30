"use client";
import { useState } from "react";
import { Mark, Page } from "./Site";
import { AreaTwin, LocationPicker, RadiusChips, placeText } from "./Area";
import { fmtCoord, useLang, useT } from "@/lib/i18n";
import { useReverse } from "@/lib/useReverse";
import { areaProfile, windowsWithin, type AreaWindow } from "@/lib/regions";
import { rankAmongEarth } from "@/lib/sites";
import { REGIONS } from "@/lib/presets";
import type { Body } from "@/lib/underfoot";

const T = {
  es: {
    h1: "Un paisaje de otro mundo, con datos.",
    lead: "Muchas zonas se anuncian como «paisaje lunar» o «marciano». Parallax lo mide: compara el relieve de tu zona con el del polo sur de la Luna y el de todo Marte, y lo sitúa frente al resto de la Tierra.",
    pick: "Elige una zona", radius: "Radio de la zona",
    loading: "Cargando el mapa al revés…", notRun: "El mapa al revés no está disponible en este servidor.",
    none: "No hay terreno medido en esta zona. Parallax mide tierra firme entre 56° S y 60° N, en ventanas con al menos un 90 % de tierra; las costas e islas pequeñas pueden quedar fuera. Prueba con un radio mayor.",
    sheet: "Perfil de análogo", measuredOn: "Datos de VAL-004, calculados el",
    summary: (n: number, km: number) => `${n} ventanas de 50 km medidas en un radio de ${km} km.`,
    moon: "Su lado lunar", mars: "Su lado marciano",
    rankLine: (body: Body, p: number) => `Más ${body === "moon" ? "lunar" : "marciano"} que el ${Math.round(p)} % del terreno medido de la Tierra`,
    table: "Todas las ventanas de la zona", place: "Lugar", moonCol: "Luna", marsCol: "Marte", rankCol: "frente a la Tierra",
    print: "Imprimir o guardar en PDF",
    say: "Cómo contarlo", sayLead: "Una frase verificable vale más que un adjetivo. Esta está calculada para tu zona:",
    sentence: (place: string, body: Body, p: number) => `Según Parallax, con datos de la NASA, el relieve de ${place ? `«${place}»` : "esta zona"} a escala de 50 km se parece al ${body === "moon" ? "del polo sur de la Luna" : "de Marte"} más que el ${Math.round(p)} % del terreno medido de la Tierra.`,
    copy: "Copiar la frase", copied: "Frase copiada",
    can: "Puedes decir", cannot: "Mejor no digas",
    canList: ["Que la forma del relieve se parece a la de la Luna o Marte, con el porcentaje calculado.", "Qué lugar concreto de la Luna o de Marte es su gemelo, con sus coordenadas.", "Que el cálculo usa datos públicos de la NASA, de USGS y de la ESA."],
    cannotList: ["Que es «igual que la Luna» o «como estar en Marte»: no medimos gravedad, atmósfera, color ni temperatura.", "Que está certificado o respaldado por la NASA. Parallax es un proyecto independiente del Space Apps Challenge.", "Que la NASA entrena o entrenará allí, salvo que una fuente oficial lo diga."],
    uses: "Ideas para la zona",
    usesList: [
      { t: "Paneles con código QR", d: "En miradores y centros de visitantes: el público ve el gemelo lunar y marciano del punto donde está." },
      { t: "Rutas interpretativas", d: "Un itinerario por las ventanas más lunares de la zona, con lo que se parece y lo que no." },
      { t: "Actividades con colegios", d: "Las sesiones de la sección Educación funcionan con el paisaje de la zona como caso real." },
    ],
    credit: "Parallax, NASA Space Apps Challenge 2026. Datos: NASA SRTMGL30, MOD44W y LOLA; USGS MOLA; GeoNames. Mide la distribución de pendientes a 1 km en ventanas de 50 km. No es una certificación ni un respaldo de la NASA.",
  },
  en: {
    h1: "A landscape from another world, with data.",
    lead: "Many areas advertise a “lunar” or “Martian landscape”. Parallax measures it: it compares your area's relief with the Moon's south pole and all of Mars, and ranks it against the rest of Earth.",
    pick: "Choose an area", radius: "Area radius",
    loading: "Loading the reverse map…", notRun: "The reverse map is not available on this server.",
    none: "No measured terrain in this area. Parallax measures land between 56° S and 60° N, in windows that are at least 90 % land; coasts and small islands can fall outside. Try a larger radius.",
    sheet: "Analog profile", measuredOn: "VAL-004 data, computed on",
    summary: (n: number, km: number) => `${n} measured 50 km windows within ${km} km.`,
    moon: "Its lunar side", mars: "Its Martian side",
    rankLine: (body: Body, p: number) => `More ${body === "moon" ? "Moon-like" : "Mars-like"} than ${Math.round(p)} % of Earth's measured terrain`,
    table: "Every window in the area", place: "Place", moonCol: "Moon", marsCol: "Mars", rankCol: "against Earth",
    print: "Print or save as PDF",
    say: "How to say it", sayLead: "One verifiable sentence beats an adjective. This one is computed for your area:",
    sentence: (place: string, body: Body, p: number) => `According to Parallax, using NASA data, the relief of ${place ? `“${place}”` : "this area"} at 50 km scale resembles ${body === "moon" ? "the Moon's south pole" : "Mars"} more than ${Math.round(p)} % of Earth's measured terrain does.`,
    copy: "Copy the sentence", copied: "Sentence copied",
    can: "You can say", cannot: "Better not say",
    canList: ["That the shape of the relief resembles the Moon or Mars, with the computed percentage.", "Which place on the Moon or Mars is its twin, with its coordinates.", "That the calculation uses public data from NASA, USGS and ESA."],
    cannotList: ["That it is “just like the Moon” or “like being on Mars”: gravity, atmosphere, colour and temperature are not measured.", "That it is certified or endorsed by NASA. Parallax is an independent Space Apps Challenge project.", "That NASA trains or will train there, unless an official source says so."],
    uses: "Ideas for the area",
    usesList: [
      { t: "Signs with a QR code", d: "At viewpoints and visitor centres: people see the lunar and Martian twin of the spot where they stand." },
      { t: "Interpretive trails", d: "A route through the area's most Moon-like windows, with what is alike and what is not." },
      { t: "School activities", d: "The sessions in the Education section work with the area's landscape as a real case." },
    ],
    credit: "Parallax, NASA Space Apps Challenge 2026. Data: NASA SRTMGL30, MOD44W and LOLA; USGS MOLA; GeoNames. It measures the 1 km slope distribution in 50 km windows. It is not a NASA certification or endorsement.",
  },
};

export default function TerritoryView() {
  const t = useT(T);
  const { lang } = useLang();
  const { summary, planets, ready, tilesAround } = useReverse();
  const [radius, setRadius] = useState(50);
  const [point, setPoint] = useState<{ lat: number; lon: number; label: string; id?: string } | null>(null);
  const [windows, setWindows] = useState<AreaWindow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run(lat: number, lon: number, label: string, km: number, id?: string) {
    setPoint({ lat, lon, label, id }); setBusy(true); setCopied(false);
    try { setWindows(windowsWithin(lat, lon, km, await tilesAround(lat, lon, km))); } finally { setBusy(false); }
  }
  const profile = windows ? areaProfile(windows) : null;
  const eligible = (windows ?? []).filter(w => w.eligible);
  // The headline side is whichever world the area resembles more, relative to the rest of Earth.
  const ranks = profile ? { moon: profile.moon?.moonD !== undefined ? rankAmongEarth("moon", profile.moon.moonD) : 0, mars: profile.mars?.marsD !== undefined ? rankAmongEarth("mars", profile.mars.marsD) : 0 } : null;
  const lead: Body = ranks && ranks.mars > ranks.moon ? "mars" : "moon";
  // A typed or device location has no name worth quoting; presets do.
  const sentence = profile && ranks && point ? t.sentence(point.id ? point.label : "", lead, ranks[lead]) : "";
  const runDate = summary?.run_at ? new Date(summary.run_at).toLocaleDateString(lang === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  async function copy() {
    try { await navigator.clipboard.writeText(sentence); setCopied(true); } catch { /* clipboard is optional */ }
  }

  return <Page>
    <section className="no-print max-w-[780px] pb-12 pt-14 lg:pt-20">
      <h1 className="font-display text-[44px] leading-[1.04] sm:text-[60px]">{t.h1}</h1>
      <p className="mt-5 max-w-[62ch] text-[17px] leading-8 text-[var(--text-secondary)]">{t.lead}</p>
    </section>

    <section className="no-print grid gap-8 border-t border-white/[0.08] pt-10 md:grid-cols-[1fr_auto] md:items-end">
      <div>
        <h2 className="mb-4 font-display text-2xl">{t.pick}</h2>
        {summary === undefined && <p className="text-sm text-[var(--text-muted)]">{t.loading}</p>}
        {summary === null && <p className="text-sm text-[var(--warning)]">{t.notRun}</p>}
        {ready && <LocationPicker presets={REGIONS} busy={busy} value={point?.id} onPick={(la, lo, label, id) => run(la, lo, label, radius, id)} />}
      </div>
      {ready && <RadiusChips label={t.radius} value={radius} options={[25, 50, 100]} onChange={km => { setRadius(km); if (point) run(point.lat, point.lon, point.label, km, point.id); }} />}
    </section>

    {profile && point && profile.eligible === 0 && <p className="mt-10 max-w-[64ch] text-[15px] leading-7 text-[var(--warning)]" aria-live="polite">{t.none}</p>}

    {profile && point && summary && profile.eligible > 0 && ranks && <>
      <article className="print-sheet mt-12 border border-white/15 p-5 sm:p-8" aria-live="polite">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-sm text-[var(--text-muted)]">{t.sheet}</p>
            <h2 className="font-display mt-1 text-[38px] leading-tight sm:text-[48px]">{point.label}</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{fmtCoord(point.lat, point.lon)}. {t.summary(profile.eligible, radius)}</p>
          </div>
          <div className="flex items-center gap-2"><Mark size={24} /><span className="font-display text-xl">Parallax</span></div>
        </header>
        <div className="mt-6 grid gap-10 md:grid-cols-2">
          {(["moon", "mars"] as Body[]).map(b => {
            const w = profile[b];
            return w && <section key={b}>
              <h3 className="font-display text-2xl">{b === "moon" ? t.moon : t.mars}</h3>
              <p className="mb-3 mt-1 text-[15px]" style={{ color: b === "mars" ? "var(--mars-bright)" : "var(--moon)" }}>{t.rankLine(b, ranks[b])}</p>
              <AreaTwin w={w} body={b} planets={planets} summary={summary} showDistanceFromPoint={false} />
            </section>;
          })}
        </div>
        <h3 className="mt-10 text-sm text-white">{t.table}</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead><tr className="text-[var(--text-muted)]"><th className="py-2 pr-4 font-normal">{t.place}</th><th className="py-2 pr-4 font-normal">{t.moonCol}, {t.rankCol}</th><th className="py-2 font-normal">{t.marsCol}, {t.rankCol}</th></tr></thead>
            <tbody>{eligible.slice(0, 12).map(w => <tr key={`${w.lat},${w.lon}`} className="border-t border-white/[0.08]">
              <td className="py-2 pr-4">{placeText(lang, w)}<div className="text-xs text-[var(--text-muted)]">{fmtCoord(w.lat, w.lon, 2)}</div></td>
              <td className="py-2 pr-4 tabular-nums">{w.moonD !== undefined ? `${Math.round(rankAmongEarth("moon", w.moonD))} %` : "–"}</td>
              <td className="py-2 tabular-nums">{w.marsD !== undefined ? `${Math.round(rankAmongEarth("mars", w.marsD))} %` : "–"}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-5 text-[var(--text-muted)]">{t.credit} {t.measuredOn} {runDate}.</p>
      </article>
      <button type="button" onClick={() => window.print()} className="no-print mt-4 h-11 rounded-sm border border-white/20 px-4 text-sm hover:border-white/50">{t.print}</button>

      <section aria-labelledby="say" className="no-print mt-20 border-t border-white/[0.08] pt-12">
        <h2 id="say" className="font-display text-3xl sm:text-4xl">{t.say}</h2>
        <p className="mt-3 text-[15px] text-[var(--text-secondary)]">{t.sayLead}</p>
        <blockquote className="font-display mt-5 max-w-[46ch] border-l-2 border-[var(--mars-primary)] pl-5 text-[26px] leading-snug">{sentence}</blockquote>
        <button type="button" onClick={copy} aria-live="polite" className="mt-4 h-10 rounded-sm border border-white/20 px-4 text-sm hover:border-white/50">{copied ? t.copied : t.copy}</button>
        <div className="mt-10 grid gap-10 md:grid-cols-2">
          <div><h3 className="text-white">{t.can}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-[var(--text-secondary)]">{t.canList.map(x => <li key={x}>{x}</li>)}</ul></div>
          <div><h3 className="text-white">{t.cannot}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-[var(--text-secondary)]">{t.cannotList.map(x => <li key={x}>{x}</li>)}</ul></div>
        </div>
      </section>
    </>}

    <section aria-labelledby="uses" className="no-print mt-20 border-t border-white/[0.08] pt-12">
      <h2 id="uses" className="font-display text-3xl sm:text-4xl">{t.uses}</h2>
      <dl className="mt-8 grid gap-8 md:grid-cols-3">
        {t.usesList.map(u => <div key={u.t} className="border-t border-white/15 pt-4"><dt className="text-white">{u.t}</dt><dd className="mt-2 text-[15px] leading-7 text-[var(--text-secondary)]">{u.d}</dd></div>)}
      </dl>
    </section>
  </Page>;
}
