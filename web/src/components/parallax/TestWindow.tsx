"use client";
import { useEffect, useState } from "react";
import { useLang, useT } from "@/lib/i18n";
import { runsText, type Window, type Windows } from "@/lib/testWindow";

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

/** Test window v1 for one site; ISRU tests read the frozen-ground window first. Descriptive only. */
export default function TestWindow({ lat, lon, frozenFirst }: { lat: number; lon: number; frozenFirst: boolean }) {
  const t = useT(T);
  const [data, setData] = useState<Windows | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/window?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`).then(r => r.ok ? r.json() : Promise.reject()).then(j => { if (live) setData(j.windows); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [lat, lon]);
  if (error) return <p className="wb-help">{t.error}</p>;
  if (!data) return <p className="wb-help" role="status">{t.loading}</p>;
  const main = frozenFirst ? { w: data.frozen, label: t.frozen, rule: t.ruleFrozen } : { w: data.general, label: t.general, rule: t.ruleGeneral };
  const other = frozenFirst ? { w: data.general, label: t.general, rule: t.ruleGeneral } : { w: data.frozen, label: t.frozen, rule: t.ruleFrozen };
  return <div className="grid gap-2">
    <Line {...main} />
    <details className="wb-reveal"><summary>{t.other(other.label)}</summary><div className="wb-reveal-body"><Line {...other} /></div></details>
  </div>;
}
