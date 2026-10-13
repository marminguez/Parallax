import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const code = ts.transpileModule(await readFile(new URL("../src/lib/sunlight.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { solarPosition, lowSunCalendar, LUNAR_SOUTH_POLE_MAX_SUN_ELEVATION_DEG } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const fixtures = JSON.parse(await readFile(new URL("./sun-fixtures.json", import.meta.url), "utf8"));

test("solar elevation and azimuth agree with astropy within 0.03°", () => {
  for (const p of fixtures.points) {
    const sun = solarPosition(new Date(p.utc), p.lat, p.lon);
    assert.ok(Math.abs(sun.elevationDeg - p.elevationDeg) < 0.03, `${p.utc} ${p.lat},${p.lon}: ${sun.elevationDeg} vs ${p.elevationDeg}`);
    if (p.elevationDeg > -80 && Math.abs(p.lat) < 89) {
      const dAz = ((sun.azimuthDeg - p.azimuthDeg + 540) % 360) - 180;
      assert.ok(Math.abs(dAz) < 0.1, `azimuth ${p.utc} ${p.lat},${p.lon}: ${sun.azimuthDeg} vs ${p.azimuthDeg}`);
    }
  }
});

test("equator: the Sun crosses the lunar band twice a day, a few minutes each time", () => {
  const cal = lowSunCalendar(0, 0, { start: new Date("2027-03-01T00:00:00Z"), days: 10, stepMinutes: 1 });
  assert.equal(cal.daysWithWindow, 10);
  assert.ok(cal.medianDailyMinutes >= 10 && cal.medianDailyMinutes <= 16, String(cal.medianDailyMinutes));
  assert.ok(cal.longest.minutes <= 8);
});

test("high latitude in winter gives far longer low-Sun windows than mid-latitude", () => {
  const start = new Date("2026-12-10T00:00:00Z");
  const north = lowSunCalendar(66.5, 25.7, { start, days: 20 });
  const spain = lowSunCalendar(43, -3, { start, days: 20 });
  assert.ok(north.longest.minutes > 4 * spain.longest.minutes, `${north.longest.minutes} vs ${spain.longest.minutes}`);
  assert.ok(north.totalHours > spain.totalHours);
});

test("polar night and band limits behave as expected", () => {
  // 80° N in mid-December: the Sun never rises, so no window at all.
  const night = lowSunCalendar(80, 15, { start: new Date("2026-12-15T00:00:00Z"), days: 5 });
  assert.equal(night.totalHours, 0);
  assert.equal(night.longest, null);
  assert.equal(LUNAR_SOUTH_POLE_MAX_SUN_ELEVATION_DEG, 1.6);
  assert.throws(() => lowSunCalendar(95, 0));
  assert.throws(() => lowSunCalendar(0, 0, { minElevationDeg: 3, maxElevationDeg: 1 }));
});

test("a year scan reports twelve or thirteen calendar months and consistent totals", () => {
  const cal = lowSunCalendar(43, -3, { start: new Date("2027-01-15T00:00:00Z"), days: 365 });
  assert.ok(cal.months.length === 12 || cal.months.length === 13);
  const sum = cal.months.reduce((s, m) => s + m.hours, 0);
  assert.ok(Math.abs(sum - cal.totalHours) < 1, `${sum} vs ${cal.totalHours}`);
  assert.equal(cal.period.days, 365);
});
