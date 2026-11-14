import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importTs } from "./load-ts.mjs";

const mt = await importTs("moonTemperature.ts");
const ei = await importTs("earthIndex.ts");
const run = JSON.parse(readFileSync(new URL("../../results/diviner/moon_temperature_v2.json", import.meta.url), "utf8"));
const web = JSON.parse(readFileSync(new URL("../data/moon-temperature-v2.json", import.meta.url), "utf8"));

test("search ranges match the v2 run and cover the 10 lunar targets", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(mt.MOON_TEMPERATURE_V2).map(([k, v]) => [k, [...v]])), web.targets);
  assert.equal(Object.keys(web.targets).length, 10);
  for (const k of Object.keys(web.targets)) assert.deepEqual(web.targets[k], [run.windows[k].min_c, run.windows[k].max_c]);
});

test("twin verdicts match the run: v2 beside v1, bands unchanged", () => {
  for (const [k, t] of Object.entries(run.twins)) {
    const v = mt.MOON_TWINS_V2[k];
    assert.deepEqual([...v.planet], t.v2.planet_c); assert.equal(v.overlap, t.v2.overlap);
    assert.equal(v.verdict, t.v2.verdict); assert.equal(v.v1, t.v1.verdict);
    assert.equal(ei.temperatureVerdict(v.overlap), v.verdict);
    assert.ok(Math.abs(ei.temperatureOverlap(t.earth_c, t.v2.planet_c) - t.v2.overlap) < 1e-3);
  }
  assert.ok(Object.values(mt.MOON_TWINS_V2).every(v => v.overlap < 0.5), "T3");
});

test("judge uses Diviner for lunar targets and keeps Mars on the literature range", () => {
  assert.deepEqual(ei.planetTemperature("haworth"), { range: [-259.1, 5.0], source: "diviner" });
  assert.equal(ei.planetTemperature("jezero").source, "literature");
  assert.deepEqual([...ei.planetTemperature("jezero").range], [...ei.PLANET_TEMPERATURE_C.Mars]);
});
