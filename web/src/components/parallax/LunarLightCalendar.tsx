"use client";
import { useEffect, useState } from "react";
import { lowSunCalendar, LUNAR_SOUTH_POLE_MAX_SUN_ELEVATION_DEG, type LowSunCalendar } from "@/lib/sunlight";
import { useLang, useT } from "@/lib/i18n";

const T = {
  es: {
    aria: "Calendario de luz lunar", title: "Calendario de luz lunar · cuándo ensayar aquí", compute: "Calcular los próximos 12 meses",
    intro: (d: number) => `En el polo sur lunar el Sol nunca sube más de unos ${d}° sobre el horizonte: luz rasante, sombras muy largas y fuerte deslumbramiento. Esto busca cuándo el Sol sobre el centro de esta ventana está en la misma franja de 0–${d}°, para ensayos de cámaras, navegación y operaciones.`,
    unavailable: "Calendario no disponible.", longest: "Ventana continua más larga", none: "Ninguna", sunAt: (a: number) => ` UTC · Sol a ${a}°`,
    perYear: "Tiempo con Sol bajo al año", days: (d: number, m: string) => `en ${d} días · mediana ${m}/día`, best: "Mejor mes", bestNote: "ventana más larga de ese mes",
    bars: "Ventana más larga con Sol bajo por mes", barTitle: (m: string, l: string, h: number) => `${m}: la más larga ${l}, ${h} h en total`,
    warning: "Solo análogo geométrico: coincide el ángulo del Sol, pero la atmósfera terrestre ilumina el cielo y suaviza las sombras, y se supone un horizonte plano (sin sombras del relieve ni refracción). En la Luna estas condiciones duran días; en la Tierra, de minutos a horas. Ecuaciones solares de la NOAA, contrastadas con astropy a 0,03°. Horas en UTC para el centro de la ventana.",
  },
  en: {
    aria: "Lunar light calendar", title: "Lunar light calendar · when to test here", compute: "Compute next 12 months",
    intro: (d: number) => `At the lunar south pole the Sun never climbs more than about ${d}° above the horizon: grazing light, very long shadows and strong glare. This finds when the Sun over this window's centre sits in the same 0–${d}° band, for camera, navigation and operations rehearsals.`,
    unavailable: "Calendar unavailable.", longest: "Longest continuous window", none: "None", sunAt: (a: number) => ` UTC · Sun at ${a}°`,
    perYear: "Low-Sun time per year", days: (d: number, m: string) => `on ${d} days · median ${m}/day`, best: "Best month", bestNote: "longest single window that month",
    bars: "Longest low-Sun window per month", barTitle: (m: string, l: string, h: number) => `${m}: longest ${l}, ${h} h total`,
    warning: "Geometric analog only: the Sun's angle matches, but Earth's atmosphere brightens the sky and softens shadows, and a flat horizon is assumed (no terrain shading, no refraction). On the Moon these conditions last for days; on Earth they last minutes to hours. NOAA solar equations, checked against astropy to 0.03°. Times are UTC for the window centre.",
  },
};

const monthName = (key: string, lang = "en") => new Date(key + "-01T00:00:00Z").toLocaleString(lang, { month: "short", year: "2-digit", timeZone: "UTC" });
const duration = (minutes: number) => minutes >= 90 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;

/** When the Sun over this Earth window is as low as at the lunar south pole. Computed in the browser. */
export default function LunarLightCalendar({ lat, lon, autoCompute = false }: { lat: number; lon: number; autoCompute?: boolean }) {
  const t = useT(T);
  const { lang } = useLang();
  const [calendar, setCalendar] = useState<LowSunCalendar | null>(null);
  const [error, setError] = useState("");
  function compute() {
    try { setCalendar(lowSunCalendar(lat, lon, { days: 365 })); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : t.unavailable); }
  }
  // On the campaign page the calendar opens already computed (it depends on today's date, so only in the browser).
  useEffect(() => {
    if (!autoCompute) return;
    const frame = requestAnimationFrame(compute);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCompute, lat, lon]);
  const peak = calendar ? Math.max(1, ...calendar.months.map(m => m.longestMinutes)) : 1;
  const best = calendar?.months.reduce((a, b) => (b.longestMinutes > a.longestMinutes ? b : a), calendar.months[0]);
  return <section className="mt-4 rounded-sm border border-white/10 p-3" aria-label={t.aria}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm text-[var(--earth-bright)]">{t.title}</h4>
      {!calendar && <button type="button" onClick={compute} className="rounded-sm border border-white/20 px-3 py-1.5 text-xs">{t.compute}</button>}
    </div>
    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{t.intro(LUNAR_SOUTH_POLE_MAX_SUN_ELEVATION_DEG)}</p>
    {error && <p role="alert" className="mt-2 text-xs text-[var(--critical)]">{error}</p>}
    {calendar && <>
      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
        <div><div className="text-[var(--text-muted)]">{t.longest}</div><div className="mt-1 text-base">{calendar.longest ? duration(calendar.longest.minutes) : t.none}</div>{calendar.longest && <div className="text-[var(--text-muted)]">{calendar.longest.startUtc.slice(0, 16).replace("T", " ")}{t.sunAt(calendar.longest.azimuthDeg)}</div>}</div>
        <div><div className="text-[var(--text-muted)]">{t.perYear}</div><div className="mt-1 text-base">{calendar.totalHours} h</div><div className="text-[var(--text-muted)]">{t.days(calendar.daysWithWindow, duration(calendar.medianDailyMinutes))}</div></div>
        <div><div className="text-[var(--text-muted)]">{t.best}</div><div className="mt-1 text-base">{best && best.longestMinutes > 0 ? new Date(best.month + "-01T00:00:00Z").toLocaleString(lang, { month: "long", year: "numeric", timeZone: "UTC" }) : "—"}</div><div className="text-[var(--text-muted)]">{t.bestNote}</div></div>
      </div>
      <div className="mt-4 flex h-24 items-end gap-1" role="img" aria-label={t.bars}>
        {calendar.months.map(m => <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t-sm bg-[var(--earth-primary)]" style={{ height: `${Math.max(2, (m.longestMinutes / peak) * 72)}px`, opacity: m.longestMinutes ? 1 : 0.25 }} title={t.barTitle(monthName(m.month, lang), duration(m.longestMinutes), m.hours)} />
          <span className="text-[9px] text-[var(--text-muted)]">{monthName(m.month, lang).slice(0, 3)}</span>
        </div>)}
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--warning)]">{t.warning}</p>
    </>}
  </section>;
}
