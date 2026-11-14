"use client";
import { useEffect, useState } from "react";
import { useLang, useT } from "@/lib/i18n";
import { runsText, type Monthly, type Window, type Windows } from "@/lib/testWindow";

const T = {
  es: {
    general: "Ventana de ensayo", frozen: "Ventana de suelo helado",
    days: (n: number) => `unos ${n} días al año`, block: (n: number) => `bloque seguido más largo: ${n} días`,
    light: (a: number, b: number) => a === b ? `${a} h de luz al día` : `${a}–${b} h de luz al día`,
    none: "Ninguna época del año cumple esta regla aquí.",
    loading: "Calculando la ventana con NASA POWER…", error: "No se pudo consultar NASA POWER ahora. Inténtalo más tarde.",
    other: (label: string) => `Comparar con la ${label.toLowerCase()}`,
    ruleGeneral: "Meses con mínima de −10 °C o más, máxima de 35 °C o menos y 3 mm de lluvia al día o menos (clima medio, NASA POWER).",
    ruleFrozen: "Meses con la superficie a 0 °C o menos de media, mínima de −25 °C o más y 3 mm de lluvia al día o menos (clima medio, NASA POWER). No prueba hielo en profundidad.",
  },
  en: {
    general: "Test window", frozen: "Frozen-ground window",
    days: (n: number) => `about ${n} days a year`, block: (n: number) => `longest block: ${n} days`,
    light: (a: number, b: number) => a === b ? `${a} h of daylight` : `${a}–${b} h of daylight`,
    none: "No time of year meets this rule here.",
    loading: "Working out the window with NASA POWER…", error: "NASA POWER is not reachable now. Try again later.",
    other: (label: string) => `Compare with the ${label.toLowerCase()}`,
    ruleGeneral: "Months with a minimum of −10 °C or more, a maximum of 35 °C or less and 3 mm of rain a day or less (average climate, NASA POWER).",
    ruleFrozen: "Months with the surface at 0 °C or below on average, a minimum of −25 °C or more and 3 mm of rain a day or less (average climate, NASA POWER). It does not prove ice at depth.",
  },
};

function Line({ w, label, rule }: { w: Window; label: string; rule: string }) {
  const t = useT(T);
  const { lang } = useLang();
  return <div className="wb-window">
    <p><strong>{label}</strong>{w.months.length ? <> · {runsText(w, lang)}</> : null}</p>
    {w.months.length
      ? <p className="wb-help">{t.days(w.days_per_year)} · {t.block(w.longest_block_days)}{w.daylight_h && <> · {t.light(w.daylight_h[0], w.daylight_h[1])}</>}</p>
      : <p className="wb-help">{t.none}</p>}
    <p className="wb-help">{rule}</p>
  </div>;
}

/** Both windows of a site whose climatology is already known; ISRU tests read the frozen-ground window first. */
export function TestWindowView({ data, frozenFirst }: { data: Windows; frozenFirst: boolean }) {
  const t = useT(T);
  const main = frozenFirst ? { w: data.frozen, label: t.frozen, rule: t.ruleFrozen } : { w: data.general, label: t.general, rule: t.ruleGeneral };
  const other = frozenFirst ? { w: data.general, label: t.general, rule: t.ruleGeneral } : { w: data.frozen, label: t.frozen, rule: t.ruleFrozen };
  return <div className="grid gap-2">
    <Line {...main} />
    <details className="wb-reveal"><summary>{t.other(other.label)}</summary><div className="wb-reveal-body"><Line {...other} /></div></details>
  </div>;
}

/** Short form for cards: "Shanjiao: Mar–May, Oct–Dec · 184 days a year". */
export function windowShort(w: Window, lang: "es" | "en") {
  if (!w.months.length) return lang === "es" ? "ninguna época cumple la regla" : "no time of year meets the rule";
  return `${runsText(w, lang)} · ${lang === "es" ? `${w.days_per_year} días al año` : `${w.days_per_year} days a year`}`;
}

type WindowAnswer = { windows: Windows; monthly: Monthly };
const cache = new Map<string, Promise<WindowAnswer>>();
/** One request per site per page view: cards, sheet and plan share it. */
export function fetchWindow(lat: number, lon: number): Promise<WindowAnswer> {
  const key = `lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/api/window?${key}`).then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))));
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** Both windows and the monthly climatology of a site, fetched live from /api/window (NASA POWER at the window centre). */
export function useWindowData(lat: number, lon: number, enabled = true) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const [state, setState] = useState<{ key: string; data: WindowAnswer | null; error: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    if (!enabled) return;
    fetchWindow(lat, lon).then(d => { if (live) setState({ key, data: d, error: false }); }).catch(() => { if (live) setState({ key, data: null, error: true }); });
    return () => { live = false; };
  }, [key, lat, lon, enabled]);
  // A result for other coordinates is stale: show "loading" until this site's answer arrives.
  return state?.key === key ? { data: state.data, error: state.error } : { data: null, error: false };
}
/** Both windows of a site (see useWindowData). */
export function useTestWindow(lat: number, lon: number, enabled = true) {
  const { data, error } = useWindowData(lat, lon, enabled);
  return { data: data?.windows ?? null, error };
}

/** Test window v1 for one site, fetched live; ISRU tests read the frozen-ground window first. Descriptive only. */
export default function TestWindow({ lat, lon, frozenFirst }: { lat: number; lon: number; frozenFirst: boolean }) {
  const t = useT(T);
  const { data, error } = useTestWindow(lat, lon);
  if (error) return <p className="wb-help">{t.error}</p>;
  if (!data) return <p className="wb-help" role="status">{t.loading}</p>;
  return <TestWindowView data={data} frozenFirst={frozenFirst} />;
}
