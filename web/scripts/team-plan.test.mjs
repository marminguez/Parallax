import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./load-ts.mjs";

const tw = await importTs("testWindow.ts");
// The production response for (31.0, 88.5): May, Jun and Sep workable; Mar and Nov frozen.
const m = {
  T2M_MIN: [-26.85, -27.63, -24.7, -13.96, -7.76, -5.39, -3.09, -3.72, -6.42, -14.15, -21.04, -27.99],
  T2M_MAX: [3.68, 5.58, 8.63, 12.48, 19.45, 21.43, 21.03, 20.57, 18.33, 15.53, 6.27, 5.26],
  PRECTOTCORR: [0.05, 0.04, 0.09, 0.25, 0.88, 2.05, 3.58, 3.52, 1.47, 0.26, 0.05, 0.04],
  TS: [-14.14, -11.29, -5.01, 1.49, 6.5, 11.57, 12.17, 10.61, 7.29, 0.31, -7.84, -13.24],
};

test("plan months wrap December to January", () => {
  assert.deepEqual(tw.planMonths(5, 7), [5, 6, 7]);
  assert.deepEqual(tw.planMonths(10, 1), [10, 11, 0, 1]);
  assert.equal(tw.planMonths(3, 2).length, 12);
});

test("the registered presets agree with the registered windows on every month", () => {
  const w = tw.windows(m, 31.0);
  for (let i = 0; i < 12; i++) {
    assert.equal(tw.checkMonth(m, i, tw.RULE_GENERAL).ok, w.general.months.includes(tw.MONTHS[i]));
    assert.equal(tw.checkMonth(m, i, tw.RULE_FROZEN).ok, w.frozen.months.includes(tw.MONTHS[i]));
  }
  assert.equal(tw.ruleKind(tw.RULE_GENERAL), "general"); assert.equal(tw.ruleKind(tw.RULE_FROZEN), "frozen");
});

test("June to August under the registered rule: June only; July and August fail on rain", () => {
  const f = tw.planFit(m, { from: 5, to: 7, rule: tw.RULE_GENERAL });
  assert.equal(f.okCount, 1); assert.equal(f.total, 3); assert.equal(f.okDays, 30); assert.equal(f.verdict, "some");
  assert.deepEqual(f.months.map(x => x.fails), [[], ["rain"], ["rain"]]);
});

test("a team rule that tolerates 4 mm of rain makes all three months work, and is marked as the team's", () => {
  const rule = { ...tw.RULE_GENERAL, rainMax: 4 };
  assert.equal(tw.ruleKind(rule), "team");
  const f = tw.planFit(m, { from: 5, to: 7, rule });
  assert.equal(f.verdict, "all"); assert.equal(f.okDays, 92);
});

test("a missing value never passes", () => {
  const bad = { ...m, PRECTOTCORR: m.PRECTOTCORR.map((x, i) => i === 5 ? -999 : x) };
  const c = tw.checkMonth(bad, 5, tw.RULE_GENERAL);
  assert.equal(c.ok, false); assert.equal(c.missing, true);
});
