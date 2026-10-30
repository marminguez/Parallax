"use client";
import Link from "next/link";
import { useState } from "react";
import { Page } from "./Site";
import { AreaTwin, LocationPicker, RadiusChips } from "./Area";
import { QrCode } from "./Qr";
import { useLang, useT } from "@/lib/i18n";
import { useReverse } from "@/lib/useReverse";
import { areaProfile, windowsWithin, type AreaWindow } from "@/lib/regions";
import { CITIES } from "@/lib/presets";

const T = {
  es: {
    h1: "La Luna y Marte, a una excursión de distancia.",
    lead: "Cada lugar de la Tierra tiene un gemelo en la Luna y otro en Marte, medidos con datos de la NASA. Úsalo para enseñar relieve, escala y método científico con paisajes que tus alumnos pueden visitar.",
    trip: "Busca vuestra salida de campo",
    tripLead: "Elige el centro o la ciudad y hasta dónde podéis viajar. Te mostramos el lugar más lunar y el más marciano a vuestro alcance.",
    radius: "Distancia máxima de viaje",
    loading: "Cargando el mapa al revés…",
    notRun: "El mapa al revés no está disponible en este servidor.",
    none: (km: number) => `No hay terreno medido a menos de ${km} km. Parallax mide tierra firme entre 56° S y 60° N; prueba con una distancia mayor.`,
    found: (n: number, label: string, km: number) => `${n} ventanas de 50 km medidas a menos de ${km} km de ${label}.`,
    moonBest: "El lugar más lunar a vuestro alcance", marsBest: "El lugar más marciano a vuestro alcance",
    activities: "Actividades para el aula",
    activitiesLead: "Cuatro sesiones basadas en el método de Parallax. Cada una usa datos reales y termina con una pregunta abierta.",
    age: "Edad", time: "Duración", material: "Material",
    list: [
      { t: "¿Qué Luna tenemos bajo los pies?", age: "10–16 años", time: "45 min", mat: "Móviles o un proyector", steps: ["Cada grupo busca el gemelo lunar y marciano de su localidad en la página «¿Qué Luna tienes?».", "Comparan la foto de satélite con el relieve de la Luna: ¿qué se parece y qué no?", "Debate final: ¿cómo puede tener un gemelo lunar un paisaje con árboles? Pista: Parallax solo mide pendientes."], link: "/bajo-tus-pies", linkText: "Abrir «¿Qué Luna tienes?»" },
      { t: "Cierra un ojo: el paralaje", age: "8–12 años", time: "20 min", mat: "Ninguno", steps: ["Con el brazo estirado, tapa un objeto lejano con el pulgar y cierra un ojo y luego el otro: el pulgar salta.", "Ese salto es el paralaje. Con dos vistas del mismo sitio se puede medir la distancia y, con ella, el relieve.", "Así se hizo el mapa de Jezero, con pares de fotos de la cámara CTX. En la Luna, el instrumento LOLA mide la altura con un láser."] },
      { t: "Mide pendientes como Parallax", age: "12–16 años", time: "50 min", mat: "Mapa topográfico de la zona, regla, papel cuadriculado", steps: ["Dibujad una cuadrícula sobre el mapa y calculad la pendiente de cada celda con las curvas de nivel.", "Contad cuántas celdas caen en cada clase: 0–1°, 1–2°, 2–3°, 3–5°, 5–10°, 10–15°, 15–20° y más de 20°.", "Comparad vuestro histograma con el de otro grupo. Esa comparación es, en pequeño, lo que hace Parallax con toda la Tierra."] },
      { t: "Donde la Tierra no llega", age: "15–18 años", time: "55 min", mat: "Página de misiones", steps: ["De casi 58.000 ventanas de Marte, solo 48 no tienen un gemelo fuerte en la Tierra. Localizadlas en el mapa.", "¿Por qué casi todas están en el monte Olimpo y Valles Marineris? Investigad por qué Marte tiene volcanes tan grandes.", "Parallax predijo que la Luna tendría zonas sin gemelo y se equivocó. ¿Por qué es importante publicar una predicción que falla?"], link: "/misiones", linkText: "Ver el mapa de Marte" },
    ],
    museum: "Museos y planetarios",
    museumLead: "El modo pantalla está pensado para un monitor o una proyección en sala: muestra un código QR para que el público descubra su propio gemelo en el móvil, mientras la pantalla recorre las regiones de Artemis III y los sitios de aterrizaje de Marte.",
    museumPoints: ["Sin instalación ni registro: se abre en el navegador.", "El público usa su propio móvil y su ubicación no sale del dispositivo.", "En español y en inglés."],
    open: "Abrir el modo pantalla",
    qrAlt: "Código QR a «¿Qué Luna tienes bajo los pies?»",
  },
  en: {
    h1: "The Moon and Mars, one field trip away.",
    lead: "Every place on Earth has a twin on the Moon and one on Mars, measured with NASA data. Use them to teach relief, scale and the scientific method with landscapes your students can visit.",
    trip: "Find your field trip",
    tripLead: "Choose your school or city and how far you can travel. We show the most Moon-like and the most Mars-like place within reach.",
    radius: "Maximum travel distance",
    loading: "Loading the reverse map…",
    notRun: "The reverse map is not available on this server.",
    none: (km: number) => `No measured terrain within ${km} km. Parallax measures land between 56° S and 60° N; try a larger distance.`,
    found: (n: number, label: string, km: number) => `${n} measured 50 km windows within ${km} km of ${label}.`,
    moonBest: "The most Moon-like place within reach", marsBest: "The most Mars-like place within reach",
    activities: "Classroom activities",
    activitiesLead: "Four sessions built on Parallax's method. Each uses real data and ends with an open question.",
    age: "Age", time: "Time", material: "Materials",
    list: [
      { t: "What Moon is under our feet?", age: "10–16", time: "45 min", mat: "Phones or a projector", steps: ["Each group finds their town's Moon and Mars twins on the “What Moon is yours?” page.", "They compare the satellite photo with the Moon's relief: what is alike and what is not?", "Closing debate: how can a landscape with trees have a lunar twin? Hint: Parallax only measures slopes."], link: "/bajo-tus-pies", linkText: "Open “What Moon is yours?”" },
      { t: "Close one eye: parallax", age: "8–12", time: "20 min", mat: "None", steps: ["Arm outstretched, cover a distant object with your thumb, then close one eye and the other: the thumb jumps.", "That jump is parallax. Two views of the same place let you measure distance and, with it, relief.", "That is how the Jezero map was made, from pairs of CTX camera images. On the Moon, the LOLA instrument measures height with a laser."] },
      { t: "Measure slopes like Parallax", age: "12–16", time: "50 min", mat: "Topographic map of your area, ruler, squared paper", steps: ["Draw a grid on the map and work out each cell's slope from the contour lines.", "Count the cells in each class: 0–1°, 1–2°, 2–3°, 3–5°, 5–10°, 10–15°, 15–20° and over 20°.", "Compare your histogram with another group's. That comparison is, in miniature, what Parallax does with all of Earth."] },
      { t: "Where Earth falls short", age: "15–18", time: "55 min", mat: "Missions page", steps: ["Of almost 58,000 Mars windows, only 48 have no strong twin on Earth. Find them on the map.", "Why are nearly all of them on Olympus Mons and Valles Marineris? Find out why Mars has such large volcanoes.", "Parallax predicted the Moon would have places without a twin, and it was wrong. Why does publishing a failed prediction matter?"], link: "/misiones", linkText: "See the Mars map" },
    ],
    museum: "Museums and planetariums",
    museumLead: "Screen mode is built for a monitor or a projection in the hall: it shows a QR code so visitors discover their own twin on their phone, while the screen tours the Artemis III regions and the Mars landing sites.",
    museumPoints: ["No installation or sign-up: it opens in the browser.", "Visitors use their own phone and their location never leaves the device.", "In Spanish and English."],
    open: "Open screen mode",
    qrAlt: "QR code to “What Moon is under your feet?”",
  },
};

export default function EducationView() {
  const t = useT(T);
  const { lang } = useLang();
  const { summary, planets, ready, tilesAround } = useReverse();
  const [radius, setRadius] = useState(100);
  const [point, setPoint] = useState<{ lat: number; lon: number; label: string; id?: string } | null>(null);
  const [windows, setWindows] = useState<AreaWindow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(lat: number, lon: number, label: string, km: number, id?: string) {
    setPoint({ lat, lon, label, id }); setBusy(true);
    try { setWindows(windowsWithin(lat, lon, km, await tilesAround(lat, lon, km))); } finally { setBusy(false); }
  }
  const profile = windows ? areaProfile(windows) : null;

  return <Page>
    <section className="max-w-[780px] pb-12 pt-14 lg:pt-20">
      <h1 className="font-display text-[44px] leading-[1.04] sm:text-[60px]">{t.h1}</h1>
      <p className="mt-5 max-w-[62ch] text-[17px] leading-8 text-[var(--text-secondary)]">{t.lead}</p>
    </section>

    <section aria-labelledby="trip" className="border-t border-white/[0.08] pt-12">
      <div className="grid gap-10 lg:grid-cols-[360px_1fr]">
        <div>
          <h2 id="trip" className="font-display text-3xl">{t.trip}</h2>
          <p className="mt-3 text-[15px] leading-7 text-[var(--text-secondary)]">{t.tripLead}</p>
          <div className="mt-6 space-y-6">
            {summary === undefined && <p className="text-sm text-[var(--text-muted)]">{t.loading}</p>}
            {summary === null && <p className="text-sm text-[var(--warning)]">{t.notRun}</p>}
            {ready && <>
              <LocationPicker presets={CITIES} busy={busy} value={point?.id} onPick={(la, lo, label, id) => run(la, lo, label, radius, id)} />
              <RadiusChips label={t.radius} value={radius} options={[50, 100, 200, 400]} onChange={km => { setRadius(km); if (point) run(point.lat, point.lon, point.label, km, point.id); }} />
            </>}
          </div>
        </div>
        <div aria-live="polite">
          {profile && point && (profile.eligible === 0
            ? <p className="text-[15px] text-[var(--warning)]">{t.none(radius)}</p>
            : <>
              <p className="text-sm text-[var(--text-secondary)]">{t.found(profile.eligible, point.label, radius)}</p>
              <div className="mt-6 grid gap-10 md:grid-cols-2">
                {profile.moon && summary && <div><h3 className="mb-3 text-white">{t.moonBest}</h3><AreaTwin w={profile.moon} body="moon" planets={planets} summary={summary} /></div>}
                {profile.mars && summary && <div><h3 className="mb-3 text-white">{t.marsBest}</h3><AreaTwin w={profile.mars} body="mars" planets={planets} summary={summary} /></div>}
              </div>
            </>)}
          {!point && ready && <div className="flex aspect-[2/1] max-h-[360px] items-center justify-center border border-dashed border-white/15 p-8 text-center text-sm text-[var(--text-muted)]">{t.tripLead}</div>}
        </div>
      </div>
    </section>

    <section aria-labelledby="activities" className="mt-24 border-t border-white/[0.08] pt-12">
      <h2 id="activities" className="font-display text-3xl sm:text-4xl">{t.activities}</h2>
      <p className="mt-3 max-w-[62ch] text-[15px] leading-7 text-[var(--text-secondary)]">{t.activitiesLead}</p>
      <div className="mt-8 divide-y divide-white/[0.08] border-y border-white/[0.08]">
        {t.list.map(a => <article key={a.t} className="grid gap-4 py-8 md:grid-cols-[300px_1fr] md:gap-10">
          <div>
            <h3 className="font-display text-[26px] leading-tight">{a.t}</h3>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-[var(--text-muted)]">{t.age}</dt><dd>{a.age}</dd>
              <dt className="text-[var(--text-muted)]">{t.time}</dt><dd>{a.time}</dd>
              <dt className="text-[var(--text-muted)]">{t.material}</dt><dd>{a.mat}</dd>
            </dl>
          </div>
          <div>
            <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-7 text-[var(--text-secondary)] marker:text-[var(--text-muted)]">{a.steps.map(s => <li key={s}>{s}</li>)}</ol>
            {"link" in a && a.link && <Link href={a.link} className="mt-4 inline-block text-sm underline decoration-white/25 underline-offset-4 hover:decoration-white/60">{a.linkText}</Link>}
          </div>
        </article>)}
      </div>
    </section>

    <section aria-labelledby="museum" className="mt-24 border-t border-white/[0.08] pt-12">
      <div className="grid gap-10 md:grid-cols-[1fr_240px] md:items-start">
        <div>
          <h2 id="museum" className="font-display text-3xl sm:text-4xl">{t.museum}</h2>
          <p className="mt-3 max-w-[62ch] text-[15px] leading-7 text-[var(--text-secondary)]">{t.museumLead}</p>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-[var(--text-secondary)]">{t.museumPoints.map(p => <li key={p}>{p}</li>)}</ul>
          <Link href="/educacion/pantalla" className="mt-6 inline-flex h-12 items-center rounded-sm bg-white px-5 text-sm font-medium text-black hover:bg-[var(--earth-bright)]">{t.open}</Link>
        </div>
        <div className="w-[200px] bg-white p-3"><QrCode path="/bajo-tus-pies" label={t.qrAlt} lang={lang} /></div>
      </div>
    </section>
  </Page>;
}
