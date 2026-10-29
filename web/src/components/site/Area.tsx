"use client";
import { useState } from "react";
import { TwinPlate } from "./Plates";
import { fmtCoord, useLang, useT, type Lang } from "@/lib/i18n";
import { countryName, rankAmongEarth } from "@/lib/sites";
import { BODY_NAME, verdict } from "@/lib/copy";
import { classify, closerThan, validCoordinate, type Body, type ReverseSummary } from "@/lib/underfoot";
import type { AreaWindow } from "@/lib/regions";
import type { Planets } from "@/lib/useReverse";
import { locate } from "@/lib/useReverse";

export type Preset = { id: string; lat: number; lon: number; es: string; en: string };

const LT = {
  es: { mine: "Usar mi ubicación", locating: "Buscando tu ubicación…", choose: "Elige un lugar", coords: "o escribe latitud, longitud", go: "Buscar", denied: "No se ha podido leer tu ubicación. Elige un lugar de la lista o escribe unas coordenadas.", bad: "Escribe dos números separados por una coma, por ejemplo 39.47, -0.38.", privacy: "Tu ubicación no sale de este dispositivo." },
  en: { mine: "Use my location", locating: "Finding your location…", choose: "Choose a place", coords: "or type latitude, longitude", go: "Search", denied: "Your location could not be read. Choose a place from the list or type coordinates.", bad: "Type two numbers separated by a comma, for example 39.47, -0.38.", privacy: "Your location never leaves this device." },
};

/** Three ways to give a point: the device's location, a preset, or typed coordinates. */
export function LocationPicker({ presets, onPick, busy, value }: { presets: Preset[]; onPick: (lat: number, lon: number, label: string, id?: string) => void; busy: boolean; value?: string }) {
  const t = useT(LT);
  const { lang } = useLang();
  const [typed, setTyped] = useState("");
  const [msg, setMsg] = useState("");
  const [finding, setFinding] = useState(false);
  async function mine() {
    setMsg(""); setFinding(true);
    try { const p = await locate(); onPick(p.lat, p.lon, lang === "es" ? "Tu ubicación" : "Your location"); }
    catch { setMsg(t.denied); }
    finally { setFinding(false); }
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const [a, b] = typed.split(/[,;\s]+/).filter(Boolean).map(Number);
    if (validCoordinate(a, b)) { setMsg(""); onPick(a, b, fmtCoord(a, b)); } else setMsg(t.bad);
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={mine} disabled={busy || finding} className="h-11 rounded-sm bg-white px-4 text-sm font-medium text-black hover:bg-[var(--earth-bright)] disabled:opacity-50">{finding ? t.locating : t.mine}</button>
      <label className="sr-only" htmlFor="preset">{t.choose}</label>
      <select id="preset" value={value ?? ""} disabled={busy} onChange={e => { const p = presets.find(x => x.id === e.target.value); if (p) onPick(p.lat, p.lon, p[lang], p.id); }}
        className="h-11 min-w-[220px] flex-1 rounded-sm border border-white/20 bg-[var(--space-deep)] px-3 text-sm text-white">
        <option value="" disabled>{t.choose}</option>
        {presets.map(p => <option key={p.id} value={p.id}>{p[lang]}</option>)}
      </select>
    </div>
    <form onSubmit={submit} className="flex gap-2">
      <label className="sr-only" htmlFor="coords">{t.coords}</label>
      <input id="coords" value={typed} onChange={e => setTyped(e.target.value)} placeholder={t.coords} inputMode="decimal" className="h-10 min-w-0 flex-1 rounded-sm border border-white/15 bg-transparent px-3 text-sm placeholder:text-[var(--text-muted)]" />
      <button className="h-10 rounded-sm border border-white/20 px-4 text-sm hover:border-white/50" disabled={busy}>{t.go}</button>
    </form>
    <p className="text-xs text-[var(--text-muted)]">{t.privacy}</p>
    {msg && <p role="alert" className="text-sm text-[var(--warning)]">{msg}</p>}
  </div>;
}

export function RadiusChips({ value, options, onChange, label }: { value: number; options: number[]; onChange: (km: number) => void; label: string }) {
  return <fieldset className="flex flex-wrap items-center gap-2">
    <legend className="mb-2 w-full text-sm text-[var(--text-secondary)]">{label}</legend>
    {options.map(km => <button key={km} type="button" aria-pressed={value === km} onClick={() => onChange(km)}
      className={`h-9 rounded-sm border px-3 text-sm tabular-nums ${value === km ? "border-white bg-white text-black" : "border-white/20 text-[var(--text-secondary)] hover:text-white"}`}>{km} km</button>)}
  </fieldset>;
}

const AT = {
  es: {
    earthTitle: (km: number) => `En la Tierra, a ${Math.round(km)} km`,
    remote: (n: string, c: string, km: number) => `Zona remota de ${c} (a ${km} km de ${n})`,
    near: (n: string, a: string, c: string) => `Cerca de ${n}, ${a || c}`,
    rank: (body: Body, p: number) => `Más ${body === "moon" ? "lunar" : "marciano"} que el ${Math.round(p)} % del terreno medido de la Tierra.`,
    map: "Ver en el mapa",
  },
  en: {
    earthTitle: (km: number) => `On Earth, ${Math.round(km)} km away`,
    remote: (n: string, c: string, km: number) => `Remote area of ${c} (${km} km from ${n})`,
    near: (n: string, a: string, c: string) => `Near ${n}, ${a || c}`,
    rank: (body: Body, p: number) => `More ${body === "moon" ? "Moon-like" : "Mars-like"} than ${Math.round(p)} % of Earth's measured terrain.`,
    map: "Open on the map",
  },
};

export function placeText(lang: Lang, w: AreaWindow): string {
  const t = AT[lang];
  if (!w.place) return fmtCoord(w.lat, w.lon, 2);
  const c = countryName(w.place.cc, lang);
  return w.place.km > 50 ? t.remote(w.place.nearest, c, w.place.km) : t.near(w.place.nearest, w.place.admin1, c);
}

/** A measured Earth window in an area, next to its twin on the Moon or Mars. */
export function AreaTwin({ w, body, planets, summary, showDistanceFromPoint = true }: { w: AreaWindow; body: Body; planets: Planets; summary: ReverseSummary; showDistanceFromPoint?: boolean }) {
  const { lang } = useLang();
  const t = AT[lang];
  const idx = w[`${body}I`], d = w[`${body}D`];
  const pw = idx !== undefined ? planets[body]?.[String(idx)] : undefined;
  if (d === undefined || !pw) return null;
  const cls = classify(d, summary.thresholds);
  const rank = rankAmongEarth(body, d);
  return <div>
    <TwinPlate body={body} window={{ id: pw.id, lat: pw.lat, lon: pw.lon }} distance={d}
      earth={{ title: showDistanceFromPoint ? t.earthTitle(w.km) : (lang === "es" ? "En la Tierra" : "On Earth"), place: placeText(lang, w), coords: fmtCoord(w.lat, w.lon, 2), lat: w.lat, lon: w.lon }}
      planet={{ title: lang === "es" ? `Su gemelo en ${BODY_NAME.es[body] === "Luna" ? "la Luna" : "Marte"}` : `Its twin on ${BODY_NAME.en[body] === "Moon" ? "the Moon" : "Mars"}`, place: body === "moon" ? (lang === "es" ? "Polo sur lunar" : "Lunar south pole") : (lang === "es" ? "Marte" : "Mars"), coords: fmtCoord(pw.lat, pw.lon) }}
      verdict={`${verdict(lang, cls, closerThan(d, summary.validatedPairs), summary.validatedPairs.length)} ${t.rank(body, rank)}`} />
    <a href={`https://www.openstreetmap.org/?mlat=${w.lat.toFixed(4)}&mlon=${w.lon.toFixed(4)}#map=10/${w.lat.toFixed(4)}/${w.lon.toFixed(4)}`} target="_blank" rel="noopener noreferrer"
      className="mt-2 inline-block text-xs text-[var(--text-secondary)] underline decoration-white/25 underline-offset-4 hover:text-white">{t.map}</a>
  </div>;
}
