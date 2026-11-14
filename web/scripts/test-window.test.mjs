import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./load-ts.mjs";

const tw = await importTs("testWindow.ts");

test("rules mirror scripts/test_window.py", () => {
  assert.ok(tw.generalMonth(-10, 35, 3) && !tw.generalMonth(-10.1, 20, 1) && !tw.generalMonth(0, 35.1, 1) && !tw.generalMonth(0, 20, 3.01));
  assert.ok(tw.frozenMonth(0, -25, 3) && !tw.frozenMonth(0.1, -5, 1) && !tw.frozenMonth(-5, -25.1, 1) && !tw.frozenMonth(-5, -5, 3.5));
});

test("runs wrap the year end; days, longest block and daylight as in Python", () => {
  const f = [true, true, false, false, false, false, false, false, false, false, true, true];
  assert.deepEqual(tw.runs(f), [[10, 1]]);
  assert.deepEqual(tw.runs(Array(12).fill(true)), [[0, 11]]);
  assert.deepEqual(tw.runs(Array(12).fill(false)), []);
  const g = [false, false, false, true, true, true, false, false, true, true, false, false];
  const w = tw.window(g, 40);
  assert.deepEqual(w.runs, [["APR", "JUN"], ["SEP", "OCT"]]);
  assert.equal(w.days_per_year, 152); assert.equal(w.longest_block_days, 91);
  assert.ok(w.daylight_h[0] < w.daylight_h[1]);
  assert.equal(tw.runsText(w, "es"), "abr–jun, sep–oct");
  assert.equal(tw.runsText(tw.window(f, 30), "en"), "Nov–Feb");
  const wf = tw.window(f, 30);
  assert.equal(wf.days_per_year, 120); assert.deepEqual(wf.daylight_h, [10.2, 11.1]);
});

test("fill values keep a month out of both windows", () => {
  const m = { T2M_MIN: Array(12).fill(0), T2M_MAX: Array(12).fill(20), PRECTOTCORR: Array(12).fill(1), TS: Array(12).fill(-1) };
  m.TS[0] = -999;
  const w = tw.windows(m, 30);
  assert.equal(w.general.months.length, 11); assert.equal(w.frozen.months.length, 11); assert.ok(!w.frozen.months.includes("JAN"));
});
