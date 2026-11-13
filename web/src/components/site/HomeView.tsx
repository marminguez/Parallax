"use client";
import Link from "next/link";
import { useState } from "react";
import { Page } from "./Site";
import HomeHero from "./HomeHero";
import { TwinPlate } from "./Plates";
import { fmtCoord, fmtNum, useLang, useT } from "@/lib/i18n";
import { sites } from "@/lib/sites";
import { siteName, verdict } from "@/lib/copy";
import { countryName } from "@/lib/sites";

const T = {
  es: {
    heroAlt: "Parallax. Otro mundo: el lugar exacto en este. Marte y la Tierra sobre la palabra PARALLAX",
    cue: "Desliza",
    h1: "La Luna y Marte tienen gemelos en la Tierra.",
    lead: "Dinos qué vas a probar y para qué destino. Parallax te dice dónde ensayarlo en la Tierra, con datos de la NASA.",
    ctaMine: "¿Qué Luna tienes bajo los pies?",
    ctaDest: "Buscar dónde ensayar",
    plateHint: "Regiones candidatas de Artemis III y su gemelo terrestre",
    prev: "Anterior", next: "Siguiente",
    earth: "En la Tierra",
    who: "Para quién es",
    doors: [
      { href: "/experiments/new", title: "Misiones", color: "var(--earth-primary)", who: "Agencias, equipos científicos y misiones análogas.", does: "Dónde probar rovers, hábitats y procedimientos, y qué no reproduce cada sitio.", cta: "Buscar dónde ensayar" },
      { href: "/educacion", title: "Educación", color: "var(--moon)", who: "Colegios, museos y planetarios.", does: "El gemelo lunar de tu ciudad, salidas de campo y actividades de aula.", cta: "Preparar una clase" },
      { href: "/territorio", title: "Geoturismo planetario", color: "var(--mars-primary)", who: "Regiones, geoparques y turismo.", does: "El perfil lunar o marciano de tu zona, con datos verificables y una ficha para imprimir.", cta: "Ver el perfil de una zona" },
    ],
    measured: "Lo que hemos medido",
    facts: (moon: string, mars: string, earth: string) => [
      { n: moon, t: "ventanas de 50 km del polo sur lunar. Todas tienen un gemelo fuerte en la Tierra." },
      { n: mars, t: "ventanas de Marte. El 99,9 % tiene gemelo fuerte en la Tierra." },
      { n: earth, t: "ventanas de la Tierra comparadas con todas ellas." },
    ],
    trust: "Por qué fiarse",
    trustLead: "Validado a ciegas con 57 análogos que ya usan las agencias, Apollo y otro equipo. Cada prueba se registró antes de calcular, y publicamos también lo que falló.",
    trustCta: "Ver cómo lo sabemos",
  },
  en: {
    heroAlt: "Parallax. Another world. The right place on this one. Mars and Earth over the word PARALLAX",
    cue: "Scroll",
    h1: "The Moon and Mars have twins on Earth.",
    lead: "Tell us what you will test and for which destination. Parallax tells you where to rehearse it on Earth, with NASA data.",
    ctaMine: "What Moon is under your feet?",
    ctaDest: "Find where to rehearse",
    plateHint: "Artemis III candidate regions and their Earth twin",
    prev: "Previous", next: "Next",
    earth: "On Earth",
    who: "Who it is for",
    doors: [
      { href: "/experiments/new", title: "Missions", color: "var(--earth-primary)", who: "Agencies, science teams and analog missions.", does: "Where to test rovers, habitats and procedures, and what each site does not reproduce.", cta: "Find where to rehearse" },
      { href: "/educacion", title: "Education", color: "var(--moon)", who: "Schools, museums and planetariums.", does: "Your city's lunar twin, field trips and classroom activities.", cta: "Prepare a lesson" },
      { href: "/territorio", title: "Planetary geotourism", color: "var(--mars-primary)", who: "Regions, geoparks and tourism.", does: "Your area's lunar or Martian profile, with verifiable data and a sheet to print.", cta: "See an area's profile" },
    ],
    measured: "What we measured",
    facts: (moon: string, mars: string, earth: string) => [
      { n: moon, t: "50 km windows of the lunar south pole. Every one has a strong twin on Earth." },
      { n: mars, t: "windows of Mars. 99.9 % have a strong twin on Earth." },
      { n: earth, t: "Earth windows compared with all of them." },
    ],
    trust: "Why trust it",
    trustLead: "Validated blind against 57 analogs used by agencies, Apollo and another team. Every test was registered before computing, and we also publish what failed.",
    trustCta: "See how we know",
  },
};

export default function HomeView() {
  const t = useT(T);
  const { lang } = useLang();
  const plates = sites.destinations.filter(d => d.body === "moon").sort((a, b) => a.distance - b.distance);
  const [i, setI] = useState(0);
  const d = plates[i];
  const h = sites.headline;
  return <Page>
    <HomeHero alt={t.heroAlt} cue={t.cue} />
    <section id="start" className="scroll-mt-16 grid gap-12 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pt-20">
      <div>
        <h1 className="font-display max-w-[13ch] text-[46px] leading-[1.02] sm:text-[64px] lg:text-[76px]">{t.h1}</h1>
        <p className="mt-6 max-w-[58ch] text-[17px] leading-8 text-[var(--text-secondary)]">{t.lead}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/experiments/new" className="inline-flex h-12 items-center rounded-sm bg-white px-5 text-sm font-medium text-black hover:bg-[var(--earth-bright)]">{t.ctaDest}</Link>
          <Link href="/bajo-tus-pies" className="inline-flex h-12 items-center rounded-sm border border-white/20 px-5 text-sm hover:border-white/50">{t.ctaMine}</Link>
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

    <section aria-labelledby="who" className="border-t border-white/[0.08] pt-16">
      <h2 id="who" className="font-display text-3xl sm:text-4xl">{t.who}</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {t.doors.map(door => <Link key={door.href} href={door.href}
          className="group flex flex-col rounded-xl bg-white/[0.045] p-8 transition-colors hover:bg-white/[0.075] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: door.color, boxShadow: `0 0 18px ${door.color}` }} />
          <span className="font-display mt-6 text-[34px] leading-none">{door.title}</span>
          <p className="mt-5 text-[var(--text-primary)]">{door.who}</p>
          <p className="mt-2 flex-1 text-[15px] leading-7 text-[var(--text-secondary)]">{door.does}</p>
          <span className="mt-8 inline-flex h-10 items-center self-start rounded-full border border-white/70 px-5 text-sm text-white transition-colors group-hover:bg-white group-hover:text-black">{door.cta}</span>
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
      <Link href="/metodo" className="mt-6 inline-flex h-10 items-center rounded-full border border-white/70 px-5 text-sm text-white hover:bg-white hover:text-black">{t.trustCta}</Link>
    </section>
  </Page>;
}
