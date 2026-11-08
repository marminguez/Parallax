"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./Site";
import { TwinPlate } from "./Plates";
import { QrCode } from "./Qr";
import { fmtCoord, useLang, useT } from "@/lib/i18n";
import { countryName, sites } from "@/lib/sites";
import { KIND, siteName, verdict } from "@/lib/copy";

const T = {
  es: { q1: "¿Qué Luna tienes bajo los pies?", q2: "¿Y qué Marte?", scan: "Escanea con el móvil y descubre el gemelo de tu ciudad en la Luna y en Marte.", earth: "Su gemelo en la Tierra", pause: "Pausar", play: "Reanudar", exit: "Salir del modo pantalla", qr: "Código QR a «¿Qué Luna tienes bajo los pies?»", credit: "Datos de NASA, USGS y ESA. Parallax, NASA Space Apps Challenge 2026." },
  en: { q1: "What Moon is under your feet?", q2: "And what Mars?", scan: "Scan with your phone to find your city's twin on the Moon and on Mars.", earth: "Its twin on Earth", pause: "Pause", play: "Resume", exit: "Leave screen mode", qr: "QR code to “What Moon is under your feet?”", credit: "Data from NASA, USGS and ESA. Parallax, NASA Space Apps Challenge 2026." },
};

// Alternate Moon and Mars destinations so the hall sees both worlds.
const moon = sites.destinations.filter(d => d.body === "moon");
const mars = sites.destinations.filter(d => d.body === "mars");
const TOUR = Array.from({ length: Math.max(moon.length, mars.length) * 2 }, (_, i) => (i % 2 ? mars : moon)[Math.floor(i / 2) % (i % 2 ? mars : moon).length]);
const SECONDS = 12;

export default function KioskView() {
  const t = useT(T);
  const { lang } = useLang();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    // A display screen in a hall: the tour advances on its own unless the visitor's system asks for reduced motion.
    if (!playing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI(x => (x + 1) % TOUR.length), SECONDS * 1000);
    return () => clearInterval(id);
  }, [playing]);
  const d = TOUR[i];
  return <main className="parallax-grid flex min-h-screen flex-col px-6 py-6 sm:px-12 sm:py-10">
    <div className="flex items-center justify-between">
      <Logo height={64} priority />
      <div className="flex items-center gap-2 text-xs">
        <button type="button" onClick={() => setPlaying(!playing)} className="rounded-sm border border-white/15 px-3 py-1.5 text-[var(--text-secondary)] hover:text-white">{playing ? t.pause : t.play}</button>
        <Link href="/educacion" className="rounded-sm border border-white/15 px-3 py-1.5 text-[var(--text-secondary)] hover:text-white">{t.exit}</Link>
      </div>
    </div>
    <div className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
      <div>
        <h1 className="font-display text-[52px] leading-[1.02] sm:text-[80px] 2xl:text-[104px]">{t.q1}<br /><span className="text-[var(--mars-bright)]">{t.q2}</span></h1>
        <div className="mt-10 flex items-center gap-8">
          <div className="w-[220px] shrink-0 bg-white p-4 2xl:w-[300px]"><QrCode path="/bajo-tus-pies" label={t.qr} lang={lang} /></div>
          <p className="max-w-[26ch] text-xl leading-8 text-[var(--text-secondary)] 2xl:text-2xl 2xl:leading-10">{t.scan}</p>
        </div>
      </div>
      <div>
        <TwinPlate body={d.body} window={{ id: d.window, lat: d.lat, lon: d.lon }} distance={d.distance}
          earth={{ title: t.earth, place: `${d.earth.nearest}, ${countryName(d.earth.cc, lang)}`, coords: fmtCoord(d.earth.lat, d.earth.lon, 1), lat: d.earth.lat, lon: d.earth.lon }}
          planet={{ title: siteName(lang, d.name), place: KIND[lang][d.kind], coords: fmtCoord(d.lat, d.lon) }}
          verdict={verdict(lang, d.cls, d.closerThan, d.ofPairs)} />
        <div className="mt-4 h-[2px] w-full bg-white/10" aria-hidden="true">
          {playing && <div key={i} className="h-full bg-white/50 motion-safe:animate-[kiosk-progress_12s_linear_forwards]" />}
        </div>
      </div>
    </div>
    <p className="text-xs text-[var(--text-muted)]">{t.credit}</p>
  </main>;
}
