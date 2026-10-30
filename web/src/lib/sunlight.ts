/**
 * Lunar light calendar: when is the Sun as low over an Earth site as it is at the
 * lunar south pole?
 *
 * At the lunar south pole the Sun never rises more than about 1.5° above the
 * horizon (the Moon's spin axis is tilted only ~1.54° to the ecliptic), so the
 * terrain is lit at grazing angles with very long shadows and strong glare.
 * On Earth the same geometry occurs for a limited time around sunrise and sunset,
 * and for much longer at high latitudes in winter. This module finds those times.
 *
 * Solar position: NOAA Solar Calculator equations (after Meeus), geometric
 * elevation without atmospheric refraction, flat horizon, accurate to about
 * 0.01° — checked against astropy in scripts/sun-fixtures.json.
 *
 * Limits: Earth's atmosphere scatters light (bright sky, softer shadows) and
 * real horizons are not flat, so this is a geometric lighting analog only.
 */

export const LUNAR_SOUTH_POLE_MAX_SUN_ELEVATION_DEG = 1.6;
const rad = Math.PI / 180;
const deg = 180 / Math.PI;

export type SunPosition = { elevationDeg: number; azimuthDeg: number };

/** Geometric solar elevation and azimuth (degrees, azimuth clockwise from north). */
export function solarPosition(date: Date, latDeg: number, lonDeg: number): SunPosition {
  const ms = date.getTime();
  const jd = ms / 86_400_000 + 2_440_587.5;
  const t = (jd - 2_451_545) / 36_525;
  const l0 = (((280.46646 + t * (36_000.76983 + t * 0.0003032)) % 360) + 360) % 360;
  const m = 357.52911 + t * (35_999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const mr = m * rad;
  const c = Math.sin(mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * mr) * (0.019993 - 0.000101 * t) + Math.sin(3 * mr) * 0.000289;
  const omega = (125.04 - 1934.136 * t) * rad;
  const apparentLong = (l0 + c - 0.00569 - 0.00478 * Math.sin(omega)) * rad;
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = (eps0 + 0.00256 * Math.cos(omega)) * rad;
  const decl = Math.asin(Math.sin(eps) * Math.sin(apparentLong));
  const y = Math.tan(eps / 2) ** 2;
  const l0r = l0 * rad;
  const eotMinutes = 4 * deg * (y * Math.sin(2 * l0r) - 2 * e * Math.sin(mr) + 4 * e * y * Math.sin(mr) * Math.cos(2 * l0r) - 0.5 * y * y * Math.sin(4 * l0r) - 1.25 * e * e * Math.sin(2 * mr));
  const utcMinutes = (((ms / 60_000) % 1440) + 1440) % 1440;
  const trueSolarMinutes = (((utcMinutes + eotMinutes + 4 * lonDeg) % 1440) + 1440) % 1440;
  const hourAngle = (trueSolarMinutes / 4 - 180) * rad;
  const lat = latDeg * rad;
  const cosZenith = Math.min(1, Math.max(-1, Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle)));
  const zenith = Math.acos(cosZenith);
  const azimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) * deg + 180;
  return { elevationDeg: 90 - zenith * deg, azimuthDeg: ((azimuth % 360) + 360) % 360 };
}

export type LowSunWindow = { startUtc: string; minutes: number; azimuthDeg: number };
export type LowSunCalendar = {
  band: { minElevationDeg: number; maxElevationDeg: number };
  period: { startUtc: string; days: number; stepMinutes: number };
  totalHours: number;
  daysWithWindow: number;
  medianDailyMinutes: number;
  longest: LowSunWindow | null;
  months: { month: string; hours: number; longestMinutes: number }[];
};

/**
 * Scan `days` days from `start` (UTC) and collect every interval in which the
 * Sun's geometric elevation stays within [minElevationDeg, maxElevationDeg].
 */
export function lowSunCalendar(latDeg: number, lonDeg: number, options: { start?: Date; days?: number; stepMinutes?: number; minElevationDeg?: number; maxElevationDeg?: number } = {}): LowSunCalendar {
  const { days = 365, stepMinutes = 2, minElevationDeg = 0, maxElevationDeg = LUNAR_SOUTH_POLE_MAX_SUN_ELEVATION_DEG } = options;
  if (![latDeg, lonDeg, days, stepMinutes, minElevationDeg, maxElevationDeg].every(Number.isFinite) || Math.abs(latDeg) > 90 || days <= 0 || stepMinutes <= 0 || minElevationDeg > maxElevationDeg) throw new Error("Invalid lunar light calendar request.");
  const startDate = options.start ?? new Date();
  const start = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
  const stepMs = stepMinutes * 60_000;
  const steps = Math.round((days * 1440) / stepMinutes);
  const monthly = new Map<string, { minutes: number; longestMinutes: number }>();
  const daily = new Map<string, number>();
  let current: LowSunWindow | null = null;
  let longest: LowSunWindow | null = null;
  let totalMinutes = 0;
  const close = () => {
    if (!current) return;
    if (!longest || current.minutes > longest.minutes) longest = current;
    const month = current.startUtc.slice(0, 7);
    const entry = monthly.get(month) ?? { minutes: 0, longestMinutes: 0 };
    entry.longestMinutes = Math.max(entry.longestMinutes, current.minutes);
    monthly.set(month, entry);
    current = null;
  };
  for (let i = 0; i < steps; i++) {
    const time = new Date(start + i * stepMs);
    const sun = solarPosition(time, latDeg, lonDeg);
    if (sun.elevationDeg >= minElevationDeg && sun.elevationDeg <= maxElevationDeg) {
      const iso = time.toISOString();
      if (!current) current = { startUtc: iso, minutes: 0, azimuthDeg: Math.round(sun.azimuthDeg) };
      current.minutes += stepMinutes;
      totalMinutes += stepMinutes;
      const month = iso.slice(0, 7);
      const entry = monthly.get(month) ?? { minutes: 0, longestMinutes: 0 };
      entry.minutes += stepMinutes;
      monthly.set(month, entry);
      daily.set(iso.slice(0, 10), (daily.get(iso.slice(0, 10)) ?? 0) + stepMinutes);
    } else close();
  }
  close();
  const perDay = [...daily.values()].sort((a, b) => a - b);
  const median = perDay.length ? (perDay.length % 2 ? perDay[(perDay.length - 1) / 2] : (perDay[perDay.length / 2 - 1] + perDay[perDay.length / 2]) / 2) : 0;
  const months: LowSunCalendar["months"] = [];
  for (let d = new Date(start); d.getTime() < start + days * 86_400_000; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const key = d.toISOString().slice(0, 7);
    const entry = monthly.get(key);
    months.push({ month: key, hours: Math.round(((entry?.minutes ?? 0) / 60) * 10) / 10, longestMinutes: entry?.longestMinutes ?? 0 });
  }
  return {
    band: { minElevationDeg, maxElevationDeg },
    period: { startUtc: new Date(start).toISOString(), days, stepMinutes },
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    daysWithWindow: daily.size,
    medianDailyMinutes: median,
    longest,
    months,
  };
}
