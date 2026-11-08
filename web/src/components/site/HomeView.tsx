"use client";
import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { Page } from "./Site";
import logo from "@/assets/parallax-logo-hero.jpg";
import { TwinPlate } from "./Plates";
import { fmtCoord, fmtNum, useLang, useT } from "@/lib/i18n";
import { sites } from "@/lib/sites";
import { siteName, verdict } from "@/lib/copy";
import { countryName } from "@/lib/sites";

const T = {
  es: {
    tagline: ["Otro mundo.", "El lugar exacto en este."],
    logoAlt: "Parallax: Marte y la Tierra sobre la palabra PARALLAX",
    h1: "La Luna y Marte tienen gemelos en la Tierra.",
    lead: "Parallax mide la forma del terreno de la Tierra, del polo sur de la Luna y de todo Marte con datos de la NASA. Después busca, para cada lugar, el sitio del otro mundo que más se le parece.",
    ctaMine: "¿Qué Luna tienes bajo los pies?",
    ctaDest: "Ver destinos de misión",
    plateHint: "Regiones candidatas de Artemis III y su gemelo terrestre",
    prev: "Anterior", next: "Siguiente",
    earth: "En la Tierra",
    who: "Para quién es",
    doors: [
      { href: "/misiones", title: "Misiones", color: "var(--earth-primary)", who: "Agencias, equipos científicos y misiones análogas.", does: "Encuentra dónde probar hábitats, rovers y procedimientos: el lugar de la Tierra que mejor reproduce el terreno de tu destino, con la evidencia y lo que falta por medir.", cta: "Buscar dónde ensayar" },
      { href: "/educacion", title: "Educación", color: "var(--moon)", who: "Colegios, museos y planetarios.", does: "Enseña la Luna y Marte en local: el gemelo de tu ciudad, la salida de campo lunar más cercana, actividades de aula y un modo pantalla con código QR.", cta: "Preparar una clase" },
      { href: "/territorio", title: "Territorio", color: "var(--mars-primary)", who: "Regiones, geoparques y turismo.", does: "Pon en valor un paisaje lunar o marciano con datos verificables: el perfil de análogo de tu zona, comparado con toda la Tierra, y una ficha lista para imprimir.", cta: "Ver el perfil de una zona" },
    ],
    measured: "Lo que hemos medido",
    facts: (moon: string, mars: string, earth: string) => [
      { n: moon, t: "ventanas de 50 km del polo sur lunar. Todas tienen un gemelo fuerte en la Tierra." },
      { n: mars, t: "ventanas de Marte. El 99,9 % tiene gemelo fuerte; las que no, están sobre todo en el monte Olimpo y Valles Marineris." },
      { n: earth, t: "ventanas de la Tierra con suelo firme, entre 56° S y 60° N, comparadas con todas ellas." },
    ],
    trust: "Por qué fiarse",
    trustLead: "Cada prueba se registró antes de calcular, y publicamos también lo que no salió como esperábamos.",
    rows: [
      ["VAL-001", "11 análogos que ya usan las agencias", "Los de Marte se parecen a Jezero más que el terreno típico (AUC 0,76; p = 0,007)."],
      ["VAL-002", "8 lugares de entrenamiento de Apollo", "Junto con VAL-001, los de la Luna se parecen a Shackleton más que el terreno típico (AUC 0,76; p = 0,001)."],
      ["VAL-003", "38 sitios elegidos por otro equipo", "Añadir el suelo desnudo mejora Marte (AUC 0,78). En la Luna no mejora, y lo contamos."],
      ["VAL-004", "Toda la Luna polar y todo Marte", "Las dos cuadrículas reproducen sus referencias. Dos de tres predicciones fallaron: la Tierra tiene más gemelos de los que esperábamos."],
    ],
  },
  en: {
    tagline: ["Another world.", "The right place on this one."],
    logoAlt: "Parallax: Mars and Earth over the word PARALLAX",
    h1: "The Moon and Mars have twins on Earth.",
    lead: "Parallax measures the shape of the terrain across Earth, the Moon's south pole and all of Mars with NASA data. Then, for every place, it finds the spot on the other world that resembles it most.",
    ctaMine: "What Moon is under your feet?",
    ctaDest: "See mission destinations",
    plateHint: "Artemis III candidate regions and their Earth twin",
    prev: "Previous", next: "Next",
    earth: "On Earth",
    who: "Who it is for",
    doors: [
      { href: "/misiones", title: "Missions", color: "var(--earth-primary)", who: "Agencies, science teams and analog missions.", does: "Find where to test habitats, rovers and procedures: the place on Earth that best reproduces your destination's terrain, with the evidence and what is still unmeasured.", cta: "Find where to rehearse" },
      { href: "/educacion", title: "Education", color: "var(--moon)", who: "Schools, museums and planetariums.", does: "Teach the Moon and Mars locally: your city's twin, the nearest lunar field trip, classroom activities and a screen mode with a QR code.", cta: "Prepare a lesson" },
      { href: "/territorio", title: "Territory", color: "var(--mars-primary)", who: "Regions, geoparks and tourism.", does: "Showcase a lunar or Martian landscape with verifiable data: your area's analog profile, compared with all of Earth, and a sheet ready to print.", cta: "See an area's profile" },
    ],
    measured: "What we measured",
    facts: (moon: string, mars: string, earth: string) => [
      { n: moon, t: "50 km windows of the lunar south pole. Every one has a strong twin on Earth." },
      { n: mars, t: "windows of Mars. 99.9 % have a strong twin; those that do not sit mostly on Olympus Mons and Valles Marineris." },
      { n: earth, t: "Earth windows on solid ground, between 56° S and 60° N, compared with all of them." },
    ],
    trust: "Why trust it",
    trustLead: "Every test was registered before computing, and we also publish what did not turn out as expected.",
    rows: [
      ["VAL-001", "11 analogs agencies already use", "The Mars ones resemble Jezero more than typical terrain (AUC 0.76; p = 0.007)."],
      ["VAL-002", "8 Apollo training sites", "With VAL-001, the Moon ones resemble Shackleton more than typical terrain (AUC 0.76; p = 0.001)."],
      ["VAL-003", "38 sites chosen by another team", "Adding bare ground improves Mars (AUC 0.78). It does not improve the Moon, and we say so."],
      ["VAL-004", "The whole polar Moon and all of Mars", "Both grids reproduce their references. Two of three predictions failed: Earth has more twins than we expected."],
    ],
  },
};

// The logo sits on pure black: screen blending drops the black, and the fade softens the edges.
const FADE = "linear-gradient(to bottom, transparent 0, #000 8%, #000 72%, transparent 100%), linear-gradient(to right, transparent 0, #000 10%, #000 90%, transparent 100%)";

export default function HomeView() {
  const t = useT(T);
  const { lang } = useLang();
  const plates = sites.destinations.filter(d => d.body === "moon").sort((a, b) => a.distance - b.distance);
  const [i, setI] = useState(0);
  const d = plates[i];
  const h = sites.headline;
  return <Page>
    <section aria-label="Parallax" className="-mx-4 pt-4 sm:-mx-8 sm:pt-8">
      <Image src={logo} alt={t.logoAlt} priority placeholder="blur" sizes="(min-width: 1240px) 1240px, 100vw" className="select-none"
        style={{ width: "100%", height: "auto", mixBlendMode: "screen", maskImage: FADE, WebkitMaskImage: FADE, maskComposite: "intersect", WebkitMaskComposite: "source-in" }} />
      <p className="mt-1 px-4 text-center text-[12px] font-light uppercase leading-6 tracking-[0.3em] text-white/85 sm:-mt-4 sm:text-base sm:leading-8 sm:tracking-[0.42em]">
        {t.tagline[0]}<br />{t.tagline[1]}
      </p>
    </section>
    <section className="grid gap-12 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pt-16">
      <div>
        <h1 className="font-display max-w-[13ch] text-[46px] leading-[1.02] sm:text-[64px] lg:text-[76px]">{t.h1}</h1>
        <p className="mt-6 max-w-[58ch] text-[17px] leading-8 text-[var(--text-secondary)]">{t.lead}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/bajo-tus-pies" className="inline-flex h-12 items-center rounded-sm bg-white px-5 text-sm font-medium text-black hover:bg-[var(--earth-bright)]">{t.ctaMine}</Link>
          <Link href="/misiones" className="inline-flex h-12 items-center rounded-sm border border-white/20 px-5 text-sm hover:border-white/50">{t.ctaDest}</Link>
        </div>
      </div>
      <div>
        <TwinPlate body="moon" window={{ id: d.window, lat: d.lat, lon: d.lon }} distance={d.distance}
          earth={{ title: t.earth, place: `${d.earth.nearest}, ${countryName(d.earth.cc, lang)}`, coords: fmtCoord(d.earth.lat, d.earth.lon, 1), lat: d.earth.lat, lon: d.earth.lon }}
          planet={{ title: siteName(lang, d.name), place: lang === "es" ? "Polo sur lunar" : "Lunar south pole", coords: fmtCoord(d.lat, d.lon) }}
          verdict={verdict(lang, d.cls, d.closerThan, d.ofPairs)} />
        <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3 text-xs text-[var(--text-muted)]">
          <span>{t.plateHint}</span>
          <div className="flex items-center gap-1">
            <button type="button" aria-label={t.prev} onClick={() => setI((i + plates.length - 1) % plates.length)} className="h-8 w-8 rounded-sm border border-white/15 text-white hover:border-white/40">‹</button>
            <span className="w-12 text-center tabular-nums">{i + 1} / {plates.length}</span>
            <button type="button" aria-label={t.next} onClick={() => setI((i + 1) % plates.length)} className="h-8 w-8 rounded-sm border border-white/15 text-white hover:border-white/40">›</button>
          </div>
        </div>
      </div>
    </section>

    <section aria-labelledby="who" className="border-t border-white/[0.08] pt-12">
      <h2 id="who" className="font-display text-3xl sm:text-4xl">{t.who}</h2>
      <div className="mt-8 divide-y divide-white/[0.08] border-y border-white/[0.08]">
        {t.doors.map(door => <Link key={door.href} href={door.href} className="group grid gap-3 py-8 sm:grid-cols-[220px_1fr_auto] sm:items-baseline sm:gap-10">
          <div className="flex items-baseline gap-3">
            <span className="h-2.5 w-2.5 shrink-0 translate-y-[-3px] rounded-full" style={{ background: door.color }} />
            <span className="font-display text-[34px] leading-none">{door.title}</span>
          </div>
          <div className="max-w-[64ch]">
            <p className="text-white">{door.who}</p>
            <p className="mt-1.5 text-[15px] leading-7 text-[var(--text-secondary)]">{door.does}</p>
          </div>
          <span className="text-sm text-[var(--text-secondary)] underline decoration-white/20 underline-offset-4 group-hover:text-white group-hover:decoration-white/60">{door.cta}</span>
        </Link>)}
      </div>
    </section>

    <section aria-labelledby="measured" className="pt-20">
      <h2 id="measured" className="font-display text-3xl sm:text-4xl">{t.measured}</h2>
      <ul className="mt-8 grid gap-8 md:grid-cols-3">
        {t.facts(fmtNum(lang, h.moon.windows), fmtNum(lang, h.mars.windows), fmtNum(lang, sites.earth.eligible)).map(f => <li key={f.n} className="border-l border-white/15 pl-5">
          <span className="font-display text-[44px] leading-none text-white">{f.n}</span>
          <p className="mt-3 max-w-[34ch] text-[15px] leading-7 text-[var(--text-secondary)]">{f.t}</p>
        </li>)}
      </ul>
    </section>

    <section aria-labelledby="trust" className="pt-20">
      <h2 id="trust" className="font-display text-3xl sm:text-4xl">{t.trust}</h2>
      <p className="mt-3 max-w-[64ch] text-[15px] leading-7 text-[var(--text-secondary)]">{t.trustLead}</p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <tbody>
            {t.rows.map(r => <tr key={r[0]} className="border-t border-white/[0.08] align-top">
              <th scope="row" className="w-28 py-4 pr-4 font-mono text-[13px] font-normal text-[var(--text-secondary)]">{r[0]}</th>
              <td className="w-[30%] py-4 pr-6 text-white">{r[1]}</td>
              <td className="py-4 leading-6 text-[var(--text-secondary)]">{r[2]}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  </Page>;
}
