"use client";
import Link from "next/link";
import { Page } from "./Site";
import { fmtNum, useLang, useT } from "@/lib/i18n";
import { countryName, sites } from "@/lib/sites";
import { BODY_NAME, KIND, siteName } from "@/lib/copy";
import { REVERSE_BASE } from "@/lib/underfoot";
import { novelty, twinNovelty, type NoveltyStatus } from "@/lib/novelty";

/**
 * Método: how Parallax knows what it says. Everything a busy team does not need to
 * pick a site, but a reviewer needs to trust it: the measure, the blind validations,
 * the pre-registered extensions (with the predictions that failed), the new analogs
 * and where Earth falls short. Moved here from Misiones and the home page.
 */
const T = {
  es: {
    h1: "Cómo lo sabemos",
    lead: "Lo que hay detrás de cada resultado: qué medimos, cómo lo validamos y dónde falla.",
    howH: "Una sola medida para elegir gemelos",
    how: [
      { t: "Pendientes a 1 km", d: "Para cada ventana de 50 × 50 km de la Tierra, la Luna o Marte, contamos cómo se reparten las pendientes medidas cada kilómetro, en 8 clases." },
      { t: "Distancia entre repartos", d: "Dos ventanas se parecen cuando sus repartos se parecen (distancia de Jensen-Shannon: 0 es idéntico). Por debajo de 0,30 hablamos de gemelo fuerte." },
      { t: "Después, describir", d: "Al gemelo se le miden suelo desnudo, acceso, permafrost, roca, temperatura, relieve fino a 60 m y textura del suelo. Esas medidas filtran, pero nunca cambian el orden." },
    ],
    trustH: "Validado a ciegas",
    trustLead: "Cada prueba se registró antes de calcular, y publicamos también lo que no salió como esperábamos.",
    trust: [
      ["VAL-001", "11 análogos que ya usan las agencias", "Los de Marte se parecen a Jezero más que el terreno típico (AUC 0,76; p = 0,007)."],
      ["VAL-002", "8 lugares de entrenamiento de Apollo", "Junto con VAL-001, los de la Luna se parecen a Shackleton más que el terreno típico (AUC 0,76; p = 0,001)."],
      ["VAL-003", "38 sitios elegidos por otro equipo", "Añadir el suelo desnudo mejora Marte (AUC 0,78). En la Luna no mejora, y lo contamos."],
      ["VAL-004", "Toda la Luna polar y todo Marte", "Las dos cuadrículas reproducen sus referencias. Dos de tres predicciones fallaron: la Tierra tiene más gemelos de los que esperábamos."],
    ],
    preH: "Ampliaciones preregistradas",
    preLead: "Cada variable nueva entró con sus reglas, comprobaciones y predicciones fijadas antes de leer un solo dato.",
    pre: [
      ["Dimensiones de la Tierra", "Suelo desnudo, acceso, permafrost, roca y temperatura en 42.405 ventanas. Las cuatro predicciones se cumplieron."],
      ["Regiones de Artemis III", "Las 9 regiones como referencia de búsqueda. La predicción se cumplió."],
      ["Relieve fino a 60 m", "538 ventanas medidas con Copernicus GLO-30. Las tres predicciones se cumplieron."],
      ["Textura del suelo", "SoilGrids 2.0 en las 42.405 ventanas. Una predicción falló: esperábamos menos datos en el suelo desnudo y no fue así."],
      ["Ventana de ensayo", "Cuántos días al año se puede trabajar en cada sitio, y cuándo está helado el suelo (NASA POWER). Las tres predicciones se cumplieron; 4 gemelos de Marte no tienen ningún mes trabajable al aire libre."],
      ["Temperatura lunar medida", "LRO Diviner sobre cada región lunar, en lugar de un rango único de la literatura. Registrado; en cálculo."],
    ],
    configs: "Reglas y resultados en el repositorio (config/ y results/).",
    newH: "Sitios nuevos para ensayar",
    newLead: (n: number, total: number, k: number) => `${n} de los ${total} gemelos no tienen ningún análogo conocido a menos de 100 km, comparados con ${k} sitios de tres listas (agencias, Apollo y Analog Atlas). La regla se fijó antes de calcular.`,
    newCols: ["Destino", "Gemelo en la Tierra", "Frente a las listas", "Análogo conocido más cercano"],
    status: { new: "Análogo nuevo", known: "Ya en una lista", undecided: "Sin decidir" } as Record<NoveltyStatus, string>,
    view: "Ver ficha",
    hardH: "Dónde la Tierra no llega",
    hardLead: (n: number, total: string) => `De ${total} ventanas de Marte, solo ${n} no tienen un gemelo fuerte en la Tierra: los volcanes gigantes y Valles Marineris.`,
    windows: (n: number) => n === 1 ? "1 ventana" : `${n} ventanas`,
    mapAlt: "Mapa de Marte con las ventanas sin gemelo fuerte marcadas",
    limitsH: "Lo que la Tierra nunca reproduce",
    limits: "Gravedad, vacío y radiación. Tampoco la oscuridad permanente de los cráteres polares. Cada ficha dice qué falta por comprobar en campo.",
    cta: "Buscar sitios",
  },
  en: {
    h1: "How we know",
    lead: "What sits behind every result: what we measure, how we validated it and where it falls short.",
    howH: "One measure to pick twins",
    how: [
      { t: "Slopes at 1 km", d: "For every 50 × 50 km window on Earth, the Moon or Mars, we count how slopes measured every kilometre are distributed, in 8 classes." },
      { t: "Distance between distributions", d: "Two windows are alike when their distributions are alike (Jensen-Shannon distance: 0 is identical). Below 0.30 we call it a strong twin." },
      { t: "Then, describe", d: "Each twin gets bare ground, access, permafrost, rock, temperature, 60 m fine relief and soil texture. They filter, but never change the order." },
    ],
    trustH: "Validated blind",
    trustLead: "Every test was registered before computing, and we also publish what did not turn out as expected.",
    trust: [
      ["VAL-001", "11 analogs agencies already use", "The Mars ones resemble Jezero more than typical terrain (AUC 0.76; p = 0.007)."],
      ["VAL-002", "8 Apollo training sites", "With VAL-001, the Moon ones resemble Shackleton more than typical terrain (AUC 0.76; p = 0.001)."],
      ["VAL-003", "38 sites chosen by another team", "Adding bare ground improves Mars (AUC 0.78). It does not improve the Moon, and we say so."],
      ["VAL-004", "The whole polar Moon and all of Mars", "Both grids reproduce their references. Two of three predictions failed: Earth has more twins than we expected."],
    ],
    preH: "Pre-registered extensions",
    preLead: "Every new variable came in with its rules, checks and predictions fixed before a single value was read.",
    pre: [
      ["Earth dimensions", "Bare ground, access, permafrost, rock and temperature on 42,405 windows. All four predictions held."],
      ["Artemis III regions", "The 9 regions as search references. The prediction held."],
      ["Fine relief at 60 m", "538 windows measured with Copernicus GLO-30. All three predictions held."],
      ["Soil texture", "SoilGrids 2.0 on all 42,405 windows. One prediction failed: we expected less data on bare ground, and it was not so."],
      ["Test window", "How many days a year a team can work at each site, and when the ground is frozen (NASA POWER). All three predictions held; 4 Mars twins have no workable outdoor month."],
      ["Measured lunar temperature", "LRO Diviner over each lunar region, instead of one literature range. Registered; being computed."],
    ],
    configs: "Rules and results in the repository (config/ and results/).",
    newH: "New places to rehearse",
    newLead: (n: number, total: number, k: number) => `${n} of the ${total} twins have no known analog within 100 km, compared with ${k} sites from three lists (agencies, Apollo and Analog Atlas). The rule was fixed before computing.`,
    newCols: ["Destination", "Earth twin", "Against the lists", "Nearest known analog"],
    status: { new: "New analog", known: "Already on a list", undecided: "Undecided" } as Record<NoveltyStatus, string>,
    view: "Open sheet",
    hardH: "Where Earth falls short",
    hardLead: (n: number, total: string) => `Of ${total} Mars windows, only ${n} have no strong twin on Earth: the giant volcanoes and Valles Marineris.`,
    windows: (n: number) => n === 1 ? "1 window" : `${n} windows`,
    mapAlt: "Map of Mars with the windows without a strong twin marked",
    limitsH: "What Earth never reproduces",
    limits: "Gravity, vacuum and radiation. Nor the permanent darkness of polar craters. Every sheet says what still needs checking in the field.",
    cta: "Find sites",
  },
};

const NOV_CHIP: Record<NoveltyStatus, string> = { new: "wb-chip--good", known: "wb-chip--info", undecided: "wb-chip--none" };

export default function MethodView() {
  const t = useT(T);
  const { lang } = useLang();
  const hard = sites.hardest.mars;
  const features = Object.entries(sites.hardestFeatures).filter(([k]) => k !== "Other").sort((a, b) => b[1] - a[1]);
  const km = (v: number) => Math.round(v).toLocaleString(lang === "es" ? "es-ES" : "en-GB");

  return <Page>
    <div className="wb">
      <header className="wb-head">
        <h1>{t.h1}</h1>
        <p>{t.lead}</p>
      </header>

      <section aria-labelledby="how" className="wb-more">
        <h2 id="how">{t.howH}</h2>
        <ol className="wb-steps">{t.how.map(s => <li key={s.t}><h3>{s.t}</h3><p>{s.d}</p></li>)}</ol>
      </section>

      <section aria-labelledby="trust" className="wb-more">
        <h2 id="trust">{t.trustH}</h2>
        <p>{t.trustLead}</p>
        <div className="wb-tablewrap"><table className="wb-table wb-stack"><tbody>
          {t.trust.map(([id, what, result]) => <tr key={id}><th scope="row" className="num" style={{ fontWeight: 400 }}>{id}</th><td className="wb-strong">{what}</td><td>{result}</td></tr>)}
        </tbody></table></div>
      </section>

      <section aria-labelledby="pre" className="wb-more">
        <h2 id="pre">{t.preH}</h2>
        <p>{t.preLead}</p>
        <div className="wb-tablewrap"><table className="wb-table wb-stack"><tbody>
          {t.pre.map(([what, result]) => <tr key={what}><th scope="row" className="wb-strong" style={{ fontWeight: 400 }}>{what}</th><td>{result}</td></tr>)}
        </tbody></table></div>
        <p className="wb-help">{t.configs}</p>
      </section>

      <section aria-labelledby="new-sites" className="wb-more">
        <h2 id="new-sites">{t.newH}</h2>
        <p>{t.newLead(novelty.counts.new, sites.destinations.length, novelty.knownSites)}</p>
        <div className="wb-tablewrap">
          <table className="wb-table">
            <thead><tr>{t.newCols.map((c, i) => <th key={c} scope="col" className={i === 3 ? "wb-right" : undefined}>{c}</th>)}<th scope="col"><span className="visually-hidden">{t.view}</span></th></tr></thead>
            <tbody>{sites.destinations.map(x => {
              const n = twinNovelty(x.id);
              return <tr key={x.id}>
                <td className="wb-strong">{siteName(lang, x.name)}<span className="wb-help" style={{ display: "block" }}>{BODY_NAME[lang][x.body]}, {KIND[lang][x.kind]}</span></td>
                <td>{x.earth.nearest}, {countryName(x.earth.cc, lang)}</td>
                <td>{n && <span className={`wb-chip ${NOV_CHIP[n.status]}`}>{t.status[n.status]}</span>}</td>
                <td className="num">{n ? `${km(n.nearest_known.km)} km` : ""}{n && <span className="wb-help" style={{ display: "block", fontFamily: "var(--font-body)" }}>{n.nearest_known.name}</span>}</td>
                <td><Link className="wb-link" href={`/misiones?d=${x.id}`}>{t.view}<span className="visually-hidden"> {siteName(lang, x.name)}</span></Link></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="hard" className="wb-more">
        <h2 id="hard">{t.hardH}</h2>
        <p>{t.hardLead(hard.length, fmtNum(lang, sites.headline.mars.windows))}</p>
        <div className="wb-map">
          <div className="wb-map-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${REVERSE_BASE}/mars-map.png`} alt={t.mapAlt} width={1440} height={720} className="absolute inset-0 h-full w-full object-cover opacity-75 [filter:grayscale(1)_contrast(1.15)]" />
            {hard.map(w => <span key={w.id} title={`${w.feature}, ${w.distance.toFixed(3)}`} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--warning)] ring-2 ring-[var(--space-void)]"
              style={{ left: `${((w.lon + 180) / 360) * 100}%`, top: `${((90 - w.lat) / 180) * 100}%` }} />)}
          </div>
          <table className="wb-table">
            <tbody>{features.map(([name, n]) => <tr key={name}><td className="wb-strong">{name}</td><td className="num">{t.windows(n)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="limits" className="wb-more">
        <h2 id="limits">{t.limitsH}</h2>
        <p>{t.limits}</p>
        <div><Link href="/experiments/new" className="wb-btn wb-btn--primary">{t.cta}</Link></div>
      </section>
    </div>
  </Page>;
}
