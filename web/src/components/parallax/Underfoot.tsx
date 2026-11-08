"use client";
import { useEffect, useState } from "react";
import {
  BODIES, REVERSE_BASE, lookUp, mapPosition, pixelsPerKm, slippy, tilesFor, validCoordinate,
  type Body, type EarthTile, type PlanetWindow, type ReverseSummary, type Twin, type TwinClass, type UnderfootResult,
} from "@/lib/underfoot";
import { imageryTile } from "@/lib/basemaps";
import { useLang } from "@/lib/i18n";
import { Page } from "@/components/site/Site";

const T = {
  es: {
    title: "¿Qué Luna tienes bajo los pies?",
    titleB: "¿Y qué Marte?",
    intro: "Medimos la forma del terreno de toda la Tierra, del polo sur de la Luna y de todo Marte con datos de la NASA. Cada lugar de la Tierra tiene un gemelo en la Luna y otro en Marte. Este es el tuyo.",
    locate: "Usar mi ubicación",
    valencia: "Probar con Valencia",
    privacy: "Tu ubicación no sale de este dispositivo: la búsqueda se hace aquí, sobre datos ya calculados.",
    locating: "Buscando tu sitio…",
    denied: "No hemos podido leer tu ubicación. Prueba con Valencia o escribe unas coordenadas.",
    coords: "o escribe latitud, longitud",
    go: "Buscar",
    notRun: "El mapa al revés todavía no se ha calculado. Cuando se ejecute VAL-004, esta página mostrará resultados reales; no inventamos datos mientras tanto.",
    outside: (km: number | null) => `Aquí no hay una ventana medida${km != null ? ` (la más cercana está a ${km} km)` : ""}. Parallax mide tierra firme entre 56° S y 60° N; el mar y los polos quedan fuera.`,
    you: "Tú",
    yourWindow: (km: number) => `Ventana de 50 × 50 km a ${km.toFixed(0)} km de ti`,
    coastal: "Ventana con mucho mar: se muestra, pero no entra en las estadísticas.",
    moon: "Tu Luna", mars: "Tu Marte",
    moonPlace: "Polo sur lunar", marsPlace: "Marte",
    cls: { strong_twin: "Gemelo fuerte", twin: "Gemelo", partial: "Parecido parcial", no_twin: "Sin gemelo" } as Record<TwinClass, string>,
    compare: (n: number, of: number) => n === 0 ? `Más lejos que los ${of} análogos que ya usan las agencias.` : `Se parece más que ${n} de los ${of} análogos que ya usan las agencias a su objetivo.`,
    honestNone: "Tu terreno no tiene gemelo cercano: es muy terrestre. La Tierra no puede enseñar todo.",
    distance: "distancia",
    exploratory: "Exploratorio: la rejilla de este cuerpo no reproduce su referencia congelada.",
    reverse: "El mapa al revés",
    reverseIntro: "Cada ventana de la Luna y de Marte, coloreada según lo bien que la Tierra la imita. Casi todo es verde: a esta escala, la Tierra tiene un gemelo fuerte para todo el polo sur lunar y para el 99,9 % de Marte. Las pocas excepciones están sobre todo en el monte Olimpo y Valles Marineris.",
    here: "tu gemelo",
    shares: "de las ventanas",
    limits: "Qué mide y qué no: solo la distribución de pendientes a 1 km dentro de ventanas de 50 km (SRTMGL30 + MOD44W en la Tierra, LOLA 20 m en la Luna, MOLA 463 m en Marte). No mide gravedad, vacío, atmósfera, radiación, luz, temperatura, hielo ni composición. Las imágenes de la Luna y Marte son relieve sombreado calculado a partir de la altimetría, no fotografías. Umbrales fijados antes de calcular (VAL-004).",
    again: "Otro lugar",
  },
  en: {
    title: "What Moon is under your feet?",
    titleB: "And what Mars?",
    intro: "We measured the shape of the terrain across Earth, the Moon's south pole and all of Mars with NASA data. Every place on Earth has a twin on the Moon and one on Mars. This is yours.",
    locate: "Use my location",
    valencia: "Try Valencia",
    privacy: "Your location never leaves this device: the search runs here, on precomputed data.",
    locating: "Finding your place…",
    denied: "We could not read your location. Try Valencia or type coordinates.",
    coords: "or type latitude, longitude",
    go: "Search",
    notRun: "The reverse map has not been computed yet. Once VAL-004 runs, this page will show real results; we do not invent data in the meantime.",
    outside: (km: number | null) => `No measured window here${km != null ? ` (the nearest is ${km} km away)` : ""}. Parallax measures land between 56° S and 60° N; sea and poles are not covered.`,
    you: "You",
    yourWindow: (km: number) => `50 × 50 km window, ${km.toFixed(0)} km from you`,
    coastal: "A window with a lot of sea: shown, but never used in statistics.",
    moon: "Your Moon", mars: "Your Mars",
    moonPlace: "Lunar south pole", marsPlace: "Mars",
    cls: { strong_twin: "Strong twin", twin: "Twin", partial: "Partial match", no_twin: "No twin" } as Record<TwinClass, string>,
    compare: (n: number, of: number) => n === 0 ? `Farther than all ${of} analogs agencies already use.` : `Closer than ${n} of the ${of} agency-used analogs are to their own target.`,
    honestNone: "Your terrain has no close twin: it is very Earth-like. Earth cannot teach everything.",
    distance: "distance",
    exploratory: "Exploratory: this body's grid does not reproduce its frozen reference.",
    reverse: "The reverse map",
    reverseIntro: "Every Moon and Mars window, coloured by how well Earth imitates it. Almost everything is green: at this scale, Earth has a strong twin for the whole lunar south pole and for 99.9 % of Mars. The few exceptions sit mostly on Olympus Mons and Valles Marineris.",
    here: "your twin",
    shares: "of windows",
    limits: "What it measures and what it does not: only the 1 km slope distribution inside 50 km windows (SRTMGL30 + MOD44W on Earth, LOLA 20 m on the Moon, MOLA 463 m on Mars). It does not measure gravity, vacuum, atmosphere, radiation, light, temperature, ice or composition. Moon and Mars images are shaded relief computed from altimetry, not photographs. Thresholds fixed before computing (VAL-004).",
    again: "Another place",
  },
};

const CLASS_COLOR: Record<TwinClass, string> = { strong_twin: "var(--positive)", twin: "var(--earth-primary)", partial: "var(--warning)", no_twin: "var(--critical)" };
const fmt = (lat: number, lon: number) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"} · ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`;
const VALENCIA = { lat: 39.47, lon: -0.38 };

async function getJson<T>(path: string): Promise<T | null> {
  const r = await fetch(`${REVERSE_BASE}/${path}`, { cache: "force-cache" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

function EarthImage({ lat, lon, label }: { lat: number; lon: number; label: string }) {
  const z = 9;
  const { x, y } = slippy(lat, lon, z);
  const x0 = Math.floor(x - 0.5), y0 = Math.floor(y - 0.5);
  const side = (50 * pixelsPerKm(lat, z)) / 512;
  return <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-black" role="img" aria-label={label}>
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
      {[0, 1].flatMap(dy => [0, 1].map(dx => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${dx}${dy}`} alt="" className="h-full w-full object-cover" src={imageryTile(z, y0 + dy, x0 + dx)} />
      )))}
    </div>
    <div className="absolute border border-[var(--earth-bright)]" style={{ left: `${((x - x0) / 2 - side / 2) * 100}%`, top: `${((y - y0) / 2 - side / 2) * 100}%`, width: `${side * 100}%`, height: `${side * 100}%` }} />
    <div className="absolute bottom-1 right-1 text-[8px] text-white/60">Powered by Esri · Maxar, Earthstar Geographics</div>
  </div>;
}

function TwinCard({ twin, t, summary }: { twin: Twin; t: (typeof T)["es"]; summary: ReverseSummary }) {
  const w = twin.window;
  const passed = summary.bridges[twin.body]?.passed;
  return <article className="rounded-sm border border-white/10 bg-[var(--panel)] p-3">
    <div className="flex items-baseline justify-between">
      <h3 className="text-sm uppercase tracking-[0.18em]" style={{ color: twin.body === "mars" ? "var(--mars-bright)" : "var(--text-primary)" }}>{twin.body === "moon" ? t.moon : t.mars}</h3>
      <span className="rounded-sm px-2 py-0.5 text-[11px] font-medium text-black" style={{ background: CLASS_COLOR[twin.cls] }}>{t.cls[twin.cls]}</span>
    </div>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`${REVERSE_BASE}/thumbs/${twin.body}/${w.id}.jpg`} alt={`${twin.body === "moon" ? t.moonPlace : t.marsPlace} ${fmt(w.lat, w.lon)}`} className="mt-3 aspect-square w-full rounded-sm bg-black object-cover" />
    <p className="mt-2 text-xs text-[var(--text-secondary)]">{twin.body === "moon" ? t.moonPlace : t.marsPlace} · {fmt(w.lat, w.lon)}</p>
    <p className="mt-2 text-sm leading-6">{twin.cls === "no_twin" ? t.honestNone : t.compare(twin.closerThan, twin.ofPairs)}</p>
    <p className="mt-1 text-[11px] text-[var(--text-muted)]">{t.distance} {twin.distance.toFixed(3)} · {w.id}</p>
    {passed === false && <p className="mt-2 text-[11px] text-[var(--warning)]">{t.exploratory}</p>}
  </article>;
}

function ClassMap({ body, summary, marker, t }: { body: Body; summary: ReverseSummary; marker: PlanetWindow | null; t: (typeof T)["es"] }) {
  const b = summary.bodies[body];
  if (!b) return null;
  const pos = marker ? mapPosition(body, marker, summary.maps) : null;
  return <figure className="rounded-sm border border-white/10 p-3">
    <figcaption className="mb-2 flex items-baseline justify-between text-xs">
      <span className="uppercase tracking-[0.18em]">{body === "moon" ? t.moonPlace : t.marsPlace}</span>
      <span className="text-[var(--text-muted)]">{b.windows.toLocaleString()} · {b.bridge_passed === false ? t.exploratory : `VAL-004`}</span>
    </figcaption>
    <div className={`relative w-full overflow-hidden rounded-sm bg-black ${body === "moon" ? "aspect-square" : "aspect-[2/1]"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${REVERSE_BASE}/${body}-map.png`} alt={`${t.reverse}: ${body}`} className="absolute inset-0 h-full w-full object-cover" />
      {pos && <div className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_10px_white]" style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }} title={t.here} />}
    </div>
    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-4">
      {summary.classes.map(c => <span key={c} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: CLASS_COLOR[c] }} />{t.cls[c]} {(b.shares[c] * 100).toFixed(0)}%</span>)}
    </div>
  </figure>;
}

export default function Underfoot() {
  const { lang } = useLang();
  const t = T[lang];
  const [summary, setSummary] = useState<ReverseSummary | null | undefined>(undefined);
  const [planets, setPlanets] = useState<Partial<Record<Body, Record<string, PlanetWindow>>>>({});
  const [result, setResult] = useState<UnderfootResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const s = await getJson<ReverseSummary>("summary.json");
        setSummary(s);
        if (!s) return;
        const loaded: Partial<Record<Body, Record<string, PlanetWindow>>> = {};
        for (const b of BODIES) if (s.bodies[b]) loaded[b] = (await getJson<Record<string, PlanetWindow>>(`${b}-windows.json`)) ?? undefined;
        setPlanets(loaded);
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); setSummary(null); }
    })();
  }, []);

  async function search(lat: number, lon: number) {
    if (!summary) return;
    setBusy(true); setError("");
    try {
      const keys = tilesFor(lat, lon, summary.tileDeg, summary.tiles);
      const tiles = (await Promise.all(keys.map(k => getJson<EarthTile>(`earth/${k}.json`)))).filter((x): x is EarthTile => !!x);
      setResult(lookUp(lat, lon, tiles, planets, summary));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  function locate() {
    if (!navigator.geolocation) return setError(t.denied);
    setBusy(true);
    navigator.geolocation.getCurrentPosition(p => search(p.coords.latitude, p.coords.longitude), () => { setBusy(false); setError(t.denied); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  }

  function submitTyped(e: React.FormEvent) {
    e.preventDefault();
    const [a, b] = typed.split(/[,;\s]+/).filter(Boolean).map(Number);
    if (validCoordinate(a, b)) search(a, b); else setError(t.denied);
  }

  const ready = summary && Object.keys(planets).length > 0;
  const okResult = result?.status === "ok" ? result : null;

  return <Page>
    <div className="max-w-3xl pt-14 text-[var(--text-primary)] lg:pt-20">
      <h1 className="font-display text-[44px] leading-[1.04] sm:text-[60px]">{t.title}<br /><span className="parallax-gradient-text">{t.titleB}</span></h1>
      <p className="mt-4 text-[15px] leading-7 text-[var(--text-secondary)]">{t.intro}</p>

      {summary === null && !error && <p className="mt-6 rounded-sm border border-[var(--warning)]/40 p-3 text-sm text-[var(--warning)]">{t.notRun}</p>}

      {ready && !okResult && <section className="mt-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={locate} className="h-12 flex-1 rounded-sm bg-white px-5 text-sm font-medium text-black disabled:opacity-50">{busy ? t.locating : t.locate}</button>
          <button type="button" disabled={busy} onClick={() => search(VALENCIA.lat, VALENCIA.lon)} className="h-12 rounded-sm border border-white/20 px-4 text-sm">{t.valencia}</button>
        </div>
        <form onSubmit={submitTyped} className="flex gap-2">
          <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={t.coords} inputMode="decimal" className="h-10 flex-1 rounded-sm border border-white/15 bg-transparent px-3 text-sm" />
          <button className="h-10 rounded-sm border border-white/15 px-3 text-sm">{t.go}</button>
        </form>
        <p className="text-xs text-[var(--text-muted)]">{t.privacy}</p>
      </section>}

      {error && <p role="alert" className="mt-4 text-sm text-[var(--critical)]">{error}</p>}
      {result?.status === "outside" && <p className="mt-4 text-sm text-[var(--warning)]">{t.outside(result.nearestKm)}</p>}

      {okResult && summary && <section className="mt-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-sm border border-white/10 bg-[var(--panel)] p-3">
            <h3 className="text-sm uppercase tracking-[0.18em] text-[var(--earth-bright)]">{t.you}</h3>
            <div className="mt-3"><EarthImage lat={okResult.earth.lat} lon={okResult.earth.lon} label={fmt(okResult.earth.lat, okResult.earth.lon)} /></div>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">{t.yourWindow(okResult.earth.km)}</p>
            {!okResult.earth.eligible && <p className="mt-2 text-[11px] text-[var(--text-muted)]">{t.coastal}</p>}
          </article>
          {okResult.twins.map(tw => <TwinCard key={tw.body} twin={tw} t={t} summary={summary} />)}
        </div>
        <button type="button" onClick={() => setResult(null)} className="mt-4 text-xs text-[var(--text-muted)] underline">{t.again}</button>
      </section>}

      {ready && summary && <section className="mt-12">
        <h2 className="text-2xl font-light tracking-[-0.03em]">{t.reverse}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{t.reverseIntro}</p>
        <div className="mt-4 space-y-4">
          {BODIES.map(b => <ClassMap key={b} body={b} summary={summary} t={t} marker={okResult?.twins.find(x => x.body === b)?.window ?? null} />)}
        </div>
      </section>}

      <p className="mt-12 text-[11px] leading-5 text-[var(--text-muted)]">{t.limits}</p>
    </div>
  </Page>;
}
