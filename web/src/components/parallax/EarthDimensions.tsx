"use client";
import { useLang, useT } from "@/lib/i18n";
import { judge, targetBody, type EarthDims, type Verdict } from "@/lib/earthIndex";
import { planetaryTargets, type PlanetaryTargetId } from "@/lib/targets";
import type { FineResult } from "@/lib/fineRelief";

const ROCK = {
  es: { su: "sedimentos sueltos", ss: "areniscas y lutitas", sm: "sedimentarias mixtas", sc: "calizas", ev: "evaporitas", py: "piroclastos", va: "volcánicas ácidas", vi: "volcánicas intermedias", vb: "basalto", pa: "granitos", pi: "plutónicas intermedias", pb: "gabros y anortositas", mt: "metamórficas", ig: "hielo y glaciares", wb: "agua" } as Record<string, string>,
  en: { su: "loose sediments", ss: "sandstones and shales", sm: "mixed sedimentary rocks", sc: "limestones", ev: "evaporites", py: "pyroclastics", va: "acid volcanics", vi: "intermediate volcanics", vb: "basalt", pa: "granites", pi: "intermediate plutonics", pb: "gabbros and anorthosites", mt: "metamorphic rocks", ig: "ice and glaciers", wb: "water" } as Record<string, string>,
};

export const EARTH_T = {
  es: {
    title: (t: string) => `Condiciones medidas frente a ${t}`,
    dim: "Dimensión", verdict: "Veredicto", detail: "Detalle",
    ground: "Suelo desnudo", access: "Acceso", ice: "Permafrost", rock: "Roca", temp: "Temperatura de superficie",
    groundText: (bare: string, veg: string) => `Suelo desnudo en el ${bare} de la ventana; vegetación, ${veg} (ESA WorldCover 2021).`,
    accessText: "Densidad media de población en la ventana (NASA SEDAC GPWv4, 2020).",
    iceYes: "Sí", iceNo: "No", iceText: "Índice de zonación del permafrost de 0,5 o más en al menos el 25 % de la ventana. Es un índice, no hielo medido en el suelo.",
    rockText: (fam: string, dom: string, match: string, family: string) => `Referencia: ${fam}. Predomina ${dom}; la misma roca cubre el ${match} de la ventana y la misma familia, el ${family} (GLiM, celdas de 0,5°).`,
    tempText: (e0: string, e1: string, body: string, p0: string, p1: string, share: string) => `Tierra de ${e0} a ${e1} °C; ${body} de ${p0} a ${p1} °C. Cubre el ${share} del rango del destino (NASA POWER).`,
    fam: { crystalline_feldspathic: "corteza cristalina rica en feldespato (anortosita)", sedimentary: "rocas sedimentarias" } as Record<string, string>,
    body: { Moon: "Luna", Mars: "Marte" } as Record<string, string>,
    v: { holds: "Se mantiene", partly: "En parte", breaks: "Se rompe", remote: "Remoto", rural: "Rural", populated: "Poblado" } as Record<string, string>,
    notMeasured: "Sin medir",
    fine: "Relieve fino (60 m)",
    fineText: (d: string, e: string, r: string, src: string) => `Distancia a 60 m: ${d}. Pendientes de 15° o más: Tierra ${e}, referencia ${r} (Copernicus GLO-30 frente a ${src}).`,
    fineNotSelected: "No medido a 60 m: solo se midieron las 538 ventanas que más se ven (las primeras de cada referencia y los gemelos).",
    fineNoData: "No medido a 60 m: Copernicus GLO-30 no cubre bien esta ventana.",
    srcMoon: "LOLA 20 m", srcMars: "CTX 20 m",
    note: "Medido en las 42.405 ventanas con reglas fijadas antes de calcular (earth dimensions v1). Es descriptivo: las bandas no están validadas como umbrales de idoneidad y nunca cambian el orden.",
  },
  en: {
    title: (t: string) => `Measured conditions against ${t}`,
    dim: "Dimension", verdict: "Verdict", detail: "Detail",
    ground: "Bare ground", access: "Access", ice: "Permafrost", rock: "Rock", temp: "Surface temperature",
    groundText: (bare: string, veg: string) => `Bare ground over ${bare} of the window; vegetation, ${veg} (ESA WorldCover 2021).`,
    accessText: "Mean population density in the window (NASA SEDAC GPWv4, 2020).",
    iceYes: "Yes", iceNo: "No", iceText: "Permafrost zonation index of 0.5 or more over at least 25 % of the window. An index, not measured ground ice.",
    rockText: (fam: string, dom: string, match: string, family: string) => `Reference: ${fam}. Mostly ${dom}; the same rock covers ${match} of the window and the same family ${family} (GLiM, 0.5° cells).`,
    tempText: (e0: string, e1: string, body: string, p0: string, p1: string, share: string) => `Earth ${e0} to ${e1} °C; ${body} ${p0} to ${p1} °C. It covers ${share} of the destination's range (NASA POWER).`,
    fam: { crystalline_feldspathic: "feldspar-rich crystalline crust (anorthosite)", sedimentary: "sedimentary rock" } as Record<string, string>,
    body: { Moon: "Moon", Mars: "Mars" } as Record<string, string>,
    v: { holds: "Holds", partly: "Partly", breaks: "Breaks", remote: "Remote", rural: "Rural", populated: "Populated" } as Record<string, string>,
    notMeasured: "Not measured",
    fine: "Fine relief (60 m)",
    fineText: (d: string, e: string, r: string, src: string) => `Distance at 60 m: ${d}. Slopes of 15° or more: Earth ${e}, reference ${r} (Copernicus GLO-30 vs ${src}).`,
    fineNotSelected: "Not measured at 60 m: only the 538 windows teams see most were measured (the top of each reference and the twins).",
    fineNoData: "Not measured at 60 m: Copernicus GLO-30 does not cover this window well.",
    srcMoon: "LOLA 20 m", srcMars: "CTX 20 m",
    note: "Measured on all 42,405 windows with rules fixed before computing (earth dimensions v1). Descriptive: the bands are not validated suitability thresholds and never change the order.",
  },
};

const tone: Record<Verdict, string> = { holds: "wb-chip--good", partly: "wb-chip--mid", breaks: "wb-chip--bad" };

export default function EarthDimensions({ earth, target, fine }: { earth: EarthDims; target: PlanetaryTargetId; fine?: FineResult }) {
  const t = useT(EARTH_T);
  const { lang } = useLang();
  const pct = (x: number) => `${(x * 100).toLocaleString(lang, { maximumFractionDigits: 0 })} %`;
  const n = (x: number) => x.toLocaleString(lang, { maximumFractionDigits: 1 });
  const j = judge(earth, target);
  const chip = (text: string, cls: string) => <span className={`wb-chip ${cls}`}>{text}</span>;
  const none = chip(t.notMeasured, "wb-chip--none");
  const dominant = earth.glim ? Object.keys(earth.glim)[0] : null;
  const rows: [string, React.ReactNode, string][] = [
    [t.ground, j.ground ? chip(t.v[j.ground], tone[j.ground]) : none, earth.bare !== null && earth.vegetated !== null ? t.groundText(pct(earth.bare), pct(earth.vegetated)) : ""],
    [t.access, earth.access ? chip(t.v[earth.access], "wb-chip--info") : none, t.accessText],
    [t.ice, earth.ice === null ? none : chip(earth.ice ? t.iceYes : t.iceNo, earth.ice ? "wb-chip--good" : "wb-chip--none"), t.iceText],
    [t.rock, j.rock ? chip(t.v[j.rock.verdict], tone[j.rock.verdict]) : none, j.rock && dominant ? t.rockText(t.fam[j.rockFamily] ?? j.rockFamily, ROCK[lang][dominant] ?? dominant, pct(j.rock.match), pct(j.rock.family)) : ""],
    [t.temp, j.temperature ? chip(t.v[j.temperature.verdict], tone[j.temperature.verdict]) : none, j.temperature && earth.tsMin !== null && earth.tsMax !== null
      ? t.tempText(n(earth.tsMin), n(earth.tsMax), t.body[targetBody(target)], n(j.temperature.planet[0]), n(j.temperature.planet[1]), pct(j.temperature.overlap)) : ""],
    [t.fine, fine?.status === "measured" ? chip(t.v[fine.verdict], tone[fine.verdict]) : none,
      fine?.status === "measured" ? t.fineText(fine.distance.toLocaleString(lang, { minimumFractionDigits: 3, maximumFractionDigits: 3 }), pct(fine.steepEarth), pct(fine.steepReference), targetBody(target) === "Moon" ? t.srcMoon : t.srcMars)
        : fine?.status === "not_measured" ? t.fineNoData : t.fineNotSelected],
  ];
  return <section aria-labelledby="wb-earth-dims">
    <h4 id="wb-earth-dims" className="wb-section-title" style={{ fontSize: "var(--text-sm)" }}>{t.title(planetaryTargets[target].short)}</h4>
    <div className="wb-tablewrap">
      <table className="wb-table wb-stack">
        <thead><tr><th scope="col">{t.dim}</th><th scope="col">{t.verdict}</th><th scope="col">{t.detail}</th></tr></thead>
        <tbody>{rows.map(([label, verdict, detail]) => <tr key={label}><th scope="row">{label}</th><td>{verdict}</td><td>{detail}</td></tr>)}</tbody>
      </table>
    </div>
    <p className="wb-help">{t.note}</p>
  </section>;
}
