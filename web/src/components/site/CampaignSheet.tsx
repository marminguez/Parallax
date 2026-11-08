"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Page } from "./Site";
import { EarthSquare } from "./Plates";
import { fmtCoord, useLang, useT } from "@/lib/i18n";
import { countryName } from "@/lib/sites";
import { KIND, siteName } from "@/lib/copy";
import { alternatives, hasLodging, hasMonths, hoursByMonth, osmUrl, sheetWindow, workableRanges, type CampaignData, type CampaignWindow, type LogisticsData } from "@/lib/campaign";
import { describe, type Tone, type TwinSheets } from "@/lib/twinSheets";
import { lowSunCalendar, LUNAR_SOUTH_POLE_MAX_SUN_ELEVATION_DEG } from "@/lib/sunlight";
import campaignData from "../../../data/reachable-twins.json";
import logisticsData from "../../../data/campaign-logistics.json";
import sheetsData from "../../../data/twin-sheets.json";

const campaign = campaignData as unknown as CampaignData;
const logistics = logisticsData as unknown as LogisticsData;
const SHEETS = sheetsData as unknown as TwinSheets;

const T = {
  es: {
    crumb: "Misiones", parent: "Planificar una campaña", here: "Ficha de campaña",
    kicker: "Parallax · Ficha de campaña", print: "Imprimir o guardar en PDF", back: "Volver a la campaña",
    pick: "Sitio", reachable: "gemelo alcanzable", original: "gemelo del mapa inverso", alt: (n: number) => `alternativa n.º ${n}`,
    analog: (dest: string) => `Análogo terrestre de ${dest}`,
    moon: "Luna", mars: "Marte",
    facts: { distance: "Distancia de forma", strong: "gemelo fuerte (≤ 0,299)", coords: "Coordenadas del centro", window: "Ventana", windowV: "50 × 50 km" },
    s1: "Qué se puede ensayar",
    relief: (dest: string) => `Relieve: la distribución de pendientes de esta ventana se parece a la de ${dest}. Sirve para ensayar travesías, movilidad de rovers y planificación de rutas sobre pendientes como las del destino.`,
    dimsSame: "Las seis dimensiones medidas para este gemelo:",
    dimsOther: "Las seis dimensiones (relieve fino, temperatura, acceso, hielo, suelo y roca) solo están medidas para el gemelo del mapa inverso. Para este sitio, compruébalas en el campo.",
    s2: "Cómo llegar",
    airport: "Aeropuerto con vuelos regulares", straight: (km: number) => `${Math.round(km)} km en línea recta desde el centro de la ventana (no por carretera).`,
    map: "Mapa", place: "Localidad más cercana",
    s3: "Cuándo ir",
    cols: ["Mes", "Mín. °C", "Máx. °C", "Lluvia mm/día", "Mes bueno"], light: "Luz rasante h",
    rule: "Mes bueno: mínimas de −10 °C o más, máximas de 35 °C o menos y 3 mm/día de lluvia o menos. Medias mensuales de NASA POWER: un mes con máximas altas puede ser trabajable a primera hora.",
    lightNote: (deg: number) => `Luz rasante: horas en los próximos 12 meses con el Sol entre 0° y ${deg}° sobre el horizonte, como en el polo sur lunar.`,
    lightCalc: "Calculando la luz rasante…",
    months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    workable: (n: number, r: string) => n === 12 ? "Se puede trabajar todo el año." : n === 0 ? "Ningún mes cumple la regla." : `${n} ${n === 1 ? "mes bueno" : "meses buenos"}: ${r}.`,
    s4: "Dónde dormir",
    lodging: (n50: number, n25: number) => `${n50} alojamientos a 50 km o menos, ${n25} de ellos a 25 km o menos.`,
    nearest: (name: string, type: string, km: number) => `El más cercano: ${name} (${type}), a ${Math.round(km)} km.`,
    noLodging: "OpenStreetMap no tiene alojamientos a 50 km o menos. Puede estar incompleto: no prueba que no haya. Prevé acampada con permiso o base en la localidad del aeropuerto.",
    unnamed: "sin nombre",
    types: { hotel: "hotel", motel: "motel", guest_house: "casa de huéspedes", hostel: "albergue", chalet: "chalé", apartment: "apartamento", alpine_hut: "refugio de montaña", camp_site: "camping" } as Record<string, string>,
    s5: "Comprobaciones antes y durante",
    checks: ["Permisos de acceso, zonas protegidas y propiedad del terreno.", "Seguridad y avisos de viaje del país.", "Estado de las carreteras y acceso según la estación.", "Cobertura móvil o comunicación por satélite.", "Agua, combustible y centro sanitario más cercano.", "Previsión meteorológica de los días de campaña.", "Alojamiento: apertura, precio, capacidad y reservas de grupo.", "Suelo: composición, granulometría y capacidad portante.", "Pendientes reales en el punto de ensayo (la ventana mide 50 × 50 km)."],
    s6: "Si este sitio no sirve",
    altLine: (n: number, l: number | null) => `${n} ${n === 1 ? "mes bueno" : "meses buenos"}${l === null ? "" : ` · ${l} alojamientos`}`,
    unknown: "—", failed: "No se pudo calcular",
    notes: "Notas de campo",
    method: "Reglas fijadas antes de calcular: config/campaign/reachable_twins_v1.yaml y logistics_v1.yaml. Fuentes: OurAirports (dominio público), NASA POWER, © colaboradores de OpenStreetMap (ODbL), y para el relieve las fuentes del mapa inverso. Esta ficha describe; no certifica que el sitio sea seguro ni accesible.",
    made: (d: string) => `Generada el ${d}.`,
    verdictTone: "Veredicto",
  },
  en: {
    crumb: "Missions", parent: "Plan a campaign", here: "Campaign sheet",
    kicker: "Parallax · Campaign sheet", print: "Print or save as PDF", back: "Back to the campaign",
    pick: "Site", reachable: "reachable twin", original: "reverse-map twin", alt: (n: number) => `alternative no. ${n}`,
    analog: (dest: string) => `Earth analog of ${dest}`,
    moon: "Moon", mars: "Mars",
    facts: { distance: "Shape distance", strong: "strong twin (≤ 0.299)", coords: "Centre coordinates", window: "Window", windowV: "50 × 50 km" },
    s1: "What you can rehearse",
    relief: (dest: string) => `Relief: this window's slope distribution is like ${dest}'s. Use it to rehearse traverses, rover mobility and route planning on slopes like the destination's.`,
    dimsSame: "The six dimensions measured for this twin:",
    dimsOther: "The six dimensions (fine relief, temperature, access, ice, ground and rock) are measured only for the reverse-map twin. Check them in the field for this site.",
    s2: "How to get there",
    airport: "Airport with scheduled flights", straight: (km: number) => `${Math.round(km)} km in a straight line from the window centre (not by road).`,
    map: "Map", place: "Nearest town",
    s3: "When to go",
    cols: ["Month", "Low °C", "High °C", "Rain mm/day", "Good month"], light: "Low Sun h",
    rule: "Good month: lows of −10 °C or above, highs of 35 °C or below and 3 mm/day of rain or less. NASA POWER monthly means: a month with high highs may still be workable early in the day.",
    lightNote: (deg: number) => `Low Sun: hours in the next 12 months with the Sun between 0° and ${deg}° above the horizon, as at the lunar south pole.`,
    lightCalc: "Computing low Sun…",
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    workable: (n: number, r: string) => n === 12 ? "Workable all year." : n === 0 ? "No month meets the rule." : `${n} good ${n === 1 ? "month" : "months"}: ${r}.`,
    s4: "Where to sleep",
    lodging: (n50: number, n25: number) => `${n50} places to stay within 50 km, ${n25} of them within 25 km.`,
    nearest: (name: string, type: string, km: number) => `Nearest: ${name} (${type}), ${Math.round(km)} km away.`,
    noLodging: "OpenStreetMap has no places to stay within 50 km. It may be incomplete: this is not proof there are none. Plan for permitted camping or a base in the airport town.",
    unnamed: "unnamed",
    types: { hotel: "hotel", motel: "motel", guest_house: "guest house", hostel: "hostel", chalet: "chalet", apartment: "apartment", alpine_hut: "mountain hut", camp_site: "campsite" } as Record<string, string>,
    s5: "Checks before and during",
    checks: ["Access permits, protected areas and land ownership.", "Safety and the country's travel advisories.", "Road condition and seasonal access.", "Mobile coverage or satellite communication.", "Water, fuel and the nearest medical centre.", "Weather forecast for the campaign days.", "Lodging: opening, prices, capacity and group bookings.", "Soil: composition, grain size and bearing strength.", "Actual slopes at the test spot (the window is 50 × 50 km)."],
    s6: "If this site does not work",
    altLine: (n: number, l: number | null) => `${n} good ${n === 1 ? "month" : "months"}${l === null ? "" : ` · ${l} places to stay`}`,
    unknown: "—", failed: "Could not be computed",
    notes: "Field notes",
    method: "Rules fixed before computing: config/campaign/reachable_twins_v1.yaml and logistics_v1.yaml. Sources: OurAirports (public domain), NASA POWER, © OpenStreetMap contributors (ODbL), and the reverse map's sources for relief. This sheet describes; it does not certify that the site is safe or accessible.",
    made: (d: string) => `Generated on ${d}.`,
    verdictTone: "Verdict",
  },
};

const TONE: Record<Tone, string> = { good: "bg-[#2f7d4f]", mid: "bg-[#c08a1e]", bad: "bg-[#b23a3a]", info: "bg-[#4a6fa5]", none: "bg-[#bbb]" };

function H({ n, children }: { n: number; children: React.ReactNode }) {
  return <h2 className="mt-5 flex items-baseline gap-3 border-b border-[#ccc] pb-1.5 text-[17px] font-semibold text-[#111] break-after-avoid"><span className="font-mono text-xs text-[#777]">{n}</span>{children}</h2>;
}

export default function CampaignSheet() {
  const t = useT(T);
  const { lang } = useLang();
  const [query, setQuery] = useState<{ d: string | null; w: string | null }>({ d: null, w: null });
  const [light, setLight] = useState<number[] | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const frame = requestAnimationFrame(() => setQuery({ d: p.get("d"), w: p.get("w") }));
    return () => cancelAnimationFrame(frame);
  }, []);

  const d = campaign.destinations.find(x => x.id === query.d) ?? campaign.destinations.find(x => x.id === "nobile-rim-1") ?? campaign.destinations[0];
  const w = sheetWindow(d, query.w);
  const isMoon = d.body === "moon";

  useEffect(() => {
    if (!isMoon) return;
    let cancelled = false;
    const id = setTimeout(() => { // let the sheet paint first; this scans a year at 2-minute steps
      try { const c = lowSunCalendar(w.lat, w.lon, { days: 365 }); if (!cancelled) setLight(hoursByMonth(c.months)); } catch { if (!cancelled) setLight([]); }
    }, 50);
    return () => { cancelled = true; clearTimeout(id); setLight(null); };
  }, [isMoon, w.lat, w.lon]);

  const dest = siteName(lang, d.name);
  const country = countryName(w.place.countryCode, lang);
  const role = w.id === d.reachable_twin?.id ? t.reachable : w.id === d.val004_twin.id ? t.original : t.alt(d.shortlist.findIndex(x => x.id === w.id) + 1);
  const site = logistics.sites[w.id];
  const cal = site && hasMonths(site.calendar) ? site.calendar : null;
  const lodging = site && hasLodging(site.lodging) ? site.lodging : null;
  const ranges = cal ? workableRanges(cal.months).map(([a, b]) => a === b ? t.months[a] : `${t.months[a]}–${t.months[b]}`).join(", ") : "";
  const rows = w.id === d.val004_twin.id ? describe(SHEETS.sheets[d.id], d.body, lang) : null;
  const alts = alternatives(d, w, 3);
  const options: CampaignWindow[] = [d.reachable_twin, d.val004_twin, ...d.shortlist].filter((x, i, a): x is CampaignWindow => !!x && a.findIndex(y => y?.id === x.id) === i);
  const num = (v: number, dg = 1) => v.toLocaleString(lang === "es" ? "es-ES" : "en-GB", { minimumFractionDigits: dg, maximumFractionDigits: dg });
  const today = new Date().toLocaleDateString(lang === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const href = (x: CampaignWindow) => `/misiones/campana/ficha?d=${d.id}&w=${x.id}`;
  const label = (x: CampaignWindow) => `${x.place.nearest}, ${countryName(x.place.countryCode, lang)}`;
  // The tab title (and the PDF file name when printing) follows the visitor's language
  useEffect(() => { document.title = `${t.here} · ${label(w)} — Parallax`; });

  return <Page>
    <div className="no-print flex flex-wrap items-center justify-between gap-3 pb-6 pt-10">
      <p className="text-sm text-[var(--text-muted)]"><Link href="/misiones" className="hover:text-white">{t.crumb}</Link> / <Link href={`/misiones/campana?d=${d.id}`} className="hover:text-white">{t.parent}</Link> / {t.here}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="sheet-site">{t.pick}</label>
        <select id="sheet-site" value={w.id} onChange={e => { const x = options.find(o => o.id === e.target.value); if (x) { history.replaceState(null, "", href(x)); setQuery({ d: d.id, w: x.id }); } }}
          className="h-11 max-w-[280px] rounded-full border border-white/15 bg-[#0b0f14] px-4 text-sm text-white">
          {options.map(x => <option key={x.id} value={x.id}>{label(x)}</option>)}
        </select>
        <button type="button" onClick={() => window.print()} className="h-11 rounded-full bg-white px-5 text-sm text-black hover:bg-white/85">{t.print}</button>
      </div>
    </div>

    <article className="campaign-sheet mx-auto max-w-[210mm] bg-white px-6 py-8 text-[#222] shadow-[0_0_0_1px_rgba(255,255,255,0.1)] sm:px-[16mm] sm:py-[14mm]">
      <header className="flex items-start justify-between gap-6 border-b-2 border-[#111] pb-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#666]">{t.kicker}</p>
          <h1 className="mt-1 text-[30px] font-semibold leading-tight text-[#111]">{label(w)}</h1>
          <p className="mt-1 text-[14px] text-[#444]">{t.analog(dest)} · {isMoon ? t.moon : t.mars} · {KIND[lang][d.kind]} · {role}</p>
        </div>
        <p className="shrink-0 text-right font-mono text-[11px] leading-5 text-[#666]">{w.id}<br />{campaign.version} · {logistics.version}</p>
      </header>

      <section className="mt-5 grid gap-5 sm:grid-cols-[124px_1fr]">
        <div className="w-[124px] overflow-hidden rounded-sm"><EarthSquare lat={w.lat} lon={w.lon} label={label(w)} /></div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
          <div><dt className="text-[#777]">{t.facts.distance}</dt><dd className="font-mono text-[#111]">{w.distance.toFixed(4)} <span className="font-sans text-[#555]">· {t.facts.strong}</span></dd></div>
          <div><dt className="text-[#777]">{t.facts.coords}</dt><dd className="font-mono text-[#111]">{fmtCoord(w.lat, w.lon, 4)}</dd></div>
          <div><dt className="text-[#777]">{t.place}</dt><dd className="text-[#111]">{[w.place.nearest, w.place.admin1, country].filter(Boolean).join(", ")}</dd></div>
          <div><dt className="text-[#777]">{t.facts.window}</dt><dd className="text-[#111]">{t.facts.windowV}</dd></div>
        </dl>
      </section>

      <H n={1}>{t.s1}</H>
      <p className="mt-2 text-[13px] leading-6">{t.relief(dest)}</p>
      {rows ? <>
        <p className="mt-2 text-[13px] text-[#555]">{t.dimsSame}</p>
        <table className="mt-1 w-full text-[12px] leading-5">
          <tbody>{rows.map(r => <tr key={r.key} className="border-b border-[#e3e3e3] align-top break-inside-avoid">
            <td className="w-[110px] py-1.5 pr-3 font-medium text-[#111]">{r.label}</td>
            <td className="w-[110px] py-1.5 pr-3 whitespace-nowrap"><span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${TONE[r.tone]}`} style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }} />{r.verdict}</td>
            <td className="py-1.5 text-[#444]">{r.text}</td>
          </tr>)}</tbody>
        </table>
      </> : <p className="mt-2 text-[13px] leading-6 text-[#555]">{t.dimsOther}</p>}

      <div className="grid gap-x-8 sm:grid-cols-2">
        <div>
      <H n={2}>{t.s2}</H>
      <dl className="mt-2 grid gap-x-6 gap-y-2 text-[13px]">
        <div><dt className="text-[#777]">{t.airport}</dt><dd className="text-[#111]">{w.airport.name}{w.airport.iata ? ` (${w.airport.iata})` : ""}{w.airport.municipality ? `, ${w.airport.municipality}` : ""}, {countryName(w.airport.country, lang)}</dd><dd className="text-[#555]">{t.straight(w.airport.km)}</dd></div>
        <div><dt className="text-[#777]">{t.map}</dt><dd className="break-all font-mono text-[11px] text-[#111]">{osmUrl(w.lat, w.lon)}</dd></div>
      </dl>
        </div>
        <div>
      <H n={3}>{t.s4}</H>
      {lodging ? (lodging.nearest ? <div className="mt-2 text-[13px] leading-6">
        <p className="text-[#111]">{t.lodging(lodging.within_50km, lodging.within_25km)} {t.nearest(lodging.nearest.name ?? t.unnamed, t.types[lodging.nearest.type] ?? lodging.nearest.type, lodging.nearest.km)}</p>
        <p className="text-[#555]">{Object.entries(lodging.types).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${t.types[k] ?? k} ${n}`).join(" · ")}</p>
      </div> : <p className="mt-2 text-[13px] leading-6 text-[#8a5a00]">{t.noLodging}</p>) : <p className="mt-2 text-[13px] text-[#777]">{t.failed}</p>}
        </div>
      </div>

      <div>
      <H n={4}>{t.s3}</H>
      {cal ? <>
        <p className="mt-2 text-[13px] font-medium text-[#111]">{t.workable(cal.workable_count, ranges)}</p>
        <table className="mt-1 w-full text-center text-[11.5px] leading-[18px] tabular-nums">
          <thead><tr className="border-b border-[#bbb] text-[#666]">{t.cols.map(c => <th key={c} className="py-1 font-normal first:text-left">{c}</th>)}{isMoon && <th className="py-1 font-normal">{t.light}</th>}</tr></thead>
          <tbody>{cal.months.map((m, i) => <tr key={m.month} className={`break-inside-avoid border-b border-[#eee] ${m.workable ? "bg-[#e7f3ea]" : ""}`} style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
            <td className="py-px text-left capitalize">{t.months[i]}</td><td>{num(m.tmin)}</td><td className={m.tmax > 35 ? "text-[#b23a3a]" : ""}>{num(m.tmax)}</td>
            <td className={m.rain > 3 ? "text-[#b23a3a]" : ""}>{num(m.rain, 2)}</td><td>{m.workable ? "✓" : ""}</td>
            {isMoon && <td>{light ? (light.length ? light[i] : t.unknown) : "…"}</td>}
          </tr>)}</tbody>
        </table>
        <p className="mt-2 text-[11px] leading-5 text-[#666]">{t.rule}</p>
        {isMoon && <p className="text-[11px] leading-5 text-[#666]">{light ? t.lightNote(LUNAR_SOUTH_POLE_MAX_SUN_ELEVATION_DEG) : t.lightCalc}</p>}
      </> : <p className="mt-2 text-[13px] text-[#777]">{t.failed}</p>}
      </div>

      <div className="break-inside-avoid">
        <H n={5}>{t.s5}</H>
        <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-[12.5px] leading-5 sm:grid-cols-2">
          {t.checks.map(c => <li key={c} className="flex gap-2"><span aria-hidden className="mt-[3px] inline-block h-3 w-3 shrink-0 border border-[#555]" />{c}</li>)}
        </ul>
      </div>

      {alts.length > 0 && <div className="break-inside-avoid">
        <H n={6}>{t.s6}</H>
        <table className="mt-2 w-full text-[12px] leading-5">
          <tbody>{alts.map(x => {
            const s = logistics.sites[x.id];
            const c = s && hasMonths(s.calendar) ? s.calendar.workable_count : null;
            const l = s && hasLodging(s.lodging) ? s.lodging.within_50km : null;
            return <tr key={x.id} className="border-b border-[#eee] align-top">
              <td className="py-1.5 pr-3 text-[#111]">{label(x)}</td>
              <td className="py-1.5 pr-3 font-mono">{x.distance.toFixed(4)}</td>
              <td className="py-1.5 pr-3 text-[#555]">{x.airport.iata ?? x.airport.name} · {Math.round(x.airport.km)} km</td>
              <td className="py-1.5 text-[#555]">{c === null ? t.unknown : t.altLine(c, l)}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>}

      <div className="break-inside-avoid">
        <H n={7}>{t.notes}</H>
        <div className="mt-1 h-[24mm] bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_7.5mm,#ddd_7.5mm,#ddd_calc(7.5mm+1px))]" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }} />
      </div>

      <footer className="mt-4 border-t border-[#ccc] pt-3 text-[10.5px] leading-5 text-[#777]">
        <p>{t.method}</p>
        <p>{t.made(today)} parallax-indol-three.vercel.app{href(w)}</p>
      </footer>
    </article>

    <div className="no-print mt-6 flex justify-center">
      <Link href={`/misiones/campana?d=${d.id}`} className="inline-flex h-11 items-center rounded-full border border-white/70 px-5 text-sm hover:bg-white hover:text-black">{t.back}</Link>
    </div>
  </Page>;
}
