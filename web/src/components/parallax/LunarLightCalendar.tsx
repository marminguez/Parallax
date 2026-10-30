"use client";
import { useState } from "react";
import { lowSunCalendar, LUNAR_SOUTH_POLE_MAX_SUN_ELEVATION_DEG, type LowSunCalendar } from "@/lib/sunlight";

const monthName = (key: string) => new Date(key + "-01T00:00:00Z").toLocaleString("en", { month: "short", year: "2-digit", timeZone: "UTC" });
const duration = (minutes: number) => minutes >= 90 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;

/** When the Sun over this Earth window is as low as at the lunar south pole. Computed in the browser. */
export default function LunarLightCalendar({ lat, lon }: { lat: number; lon: number }) {
  const [calendar, setCalendar] = useState<LowSunCalendar | null>(null);
  const [error, setError] = useState("");
  function compute() {
    try { setCalendar(lowSunCalendar(lat, lon, { days: 365 })); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Calendar unavailable."); }
  }
  const peak = calendar ? Math.max(1, ...calendar.months.map(m => m.longestMinutes)) : 1;
  const best = calendar?.months.reduce((a, b) => (b.longestMinutes > a.longestMinutes ? b : a), calendar.months[0]);
  return <section className="mt-4 rounded-sm border border-white/10 p-3" aria-label="Lunar light calendar">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm text-[var(--earth-bright)]">Lunar light calendar · when to test here</h4>
      {!calendar && <button type="button" onClick={compute} className="rounded-sm border border-white/20 px-3 py-1.5 text-xs">Compute next 12 months</button>}
    </div>
    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">At the lunar south pole the Sun never climbs more than about {LUNAR_SOUTH_POLE_MAX_SUN_ELEVATION_DEG}° above the horizon: grazing light, very long shadows and strong glare. This finds when the Sun over this window&apos;s centre sits in the same 0–{LUNAR_SOUTH_POLE_MAX_SUN_ELEVATION_DEG}° band, for camera, navigation and operations rehearsals.</p>
    {error && <p role="alert" className="mt-2 text-xs text-[var(--critical)]">{error}</p>}
    {calendar && <>
      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
        <div><div className="text-[var(--text-muted)]">Longest continuous window</div><div className="mt-1 text-base">{calendar.longest ? duration(calendar.longest.minutes) : "None"}</div>{calendar.longest && <div className="text-[var(--text-muted)]">{calendar.longest.startUtc.slice(0, 16).replace("T", " ")} UTC · Sun at {calendar.longest.azimuthDeg}°</div>}</div>
        <div><div className="text-[var(--text-muted)]">Low-Sun time per year</div><div className="mt-1 text-base">{calendar.totalHours} h</div><div className="text-[var(--text-muted)]">on {calendar.daysWithWindow} days · median {duration(calendar.medianDailyMinutes)}/day</div></div>
        <div><div className="text-[var(--text-muted)]">Best month</div><div className="mt-1 text-base">{best && best.longestMinutes > 0 ? new Date(best.month + "-01T00:00:00Z").toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" }) : "—"}</div><div className="text-[var(--text-muted)]">longest single window that month</div></div>
      </div>
      <div className="mt-4 flex h-24 items-end gap-1" role="img" aria-label="Longest low-Sun window per month">
        {calendar.months.map(m => <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t-sm bg-[var(--earth-primary)]" style={{ height: `${Math.max(2, (m.longestMinutes / peak) * 72)}px`, opacity: m.longestMinutes ? 1 : 0.25 }} title={`${monthName(m.month)}: longest ${duration(m.longestMinutes)}, ${m.hours} h total`} />
          <span className="text-[9px] text-[var(--text-muted)]">{monthName(m.month).slice(0, 3)}</span>
        </div>)}
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--warning)]">Geometric analog only: the Sun&apos;s angle matches, but Earth&apos;s atmosphere brightens the sky and softens shadows, and a flat horizon is assumed (no terrain shading, no refraction). On the Moon these conditions last for days; on Earth they last minutes to hours. NOAA solar equations, checked against astropy to 0.03°. Times are UTC for the window centre.</p>
    </>}
  </section>;
}
