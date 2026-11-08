import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./load-ts.mjs";

const { describe } = await importTs("twinSheets.ts");

test("a missing sheet shows pending rows, never invented values", () => {
  const rows = describe(undefined, "moon", "en");
  assert.deepEqual(rows.map(r => r.key), ["fine_relief", "temperature", "operations", "ice", "ground", "geology"]);
  assert.ok(rows.every(r => r.verdict === "Not computed yet" && r.tone === "none" && r.text === ""));
});

test("measured dimensions carry their verdict and numbers", () => {
  const rows = describe({
    fine_relief: { status: "measured", distance: 0.1234, verdict: "partly", earth_steep_share: 0.31, planet_steep_share: 0.42 },
    temperature: { status: "measured", earth_c: [-25, 36], planet_c: [-203, 54], overlap: 0.237, verdict: "partly", planet_colder_by_c: 178 },
    operations: { status: "measured", population_mean_km2: 3.4, population_max_km2: 120, nearest_settlement_km: 59.9, verdict: "rural" },
  }, "moon", "en");
  assert.equal(rows[0].verdict, "Partly");
  assert.match(rows[0].text, /0\.123/);
  assert.match(rows[0].text, /31 % on Earth, 42 % at the destination/);
  assert.match(rows[1].text, /Earth -25 to 36 °C; Moon -203 to 54 °C\. The twin covers 24 %/);
  assert.match(rows[1].text, /178 °C colder/);
  assert.equal(rows[2].tone, "info");
  assert.match(rows[2].text, /3\.4 people\/km²/);
});

test("Mars without a fine model says so; errors are not dressed up as results", () => {
  const rows = describe({ fine_relief: { status: "not_measured", reason: "planet" }, temperature: { status: "error", error: "x" } }, "mars", "es");
  assert.equal(rows[0].verdict, "Sin medir");
  assert.match(rows[0].text, /463 m/);
  assert.equal(rows[1].verdict, "No se pudo calcular");
  assert.equal(rows[2].verdict, "Pendiente de cálculo");
});

test("ice row: lunar cold traps against Earth permafrost, with the honest caveat", () => {
  const rows = describe({ ice: { status: "measured", verdict: "holds", destination_psr_share: 0.034, earth_pzi_mean: 0.62, earth_pzi_share: 0.55 } }, "moon", "en");
  const ice = rows.find(r => r.key === "ice");
  assert.equal(ice.verdict, "Holds");
  assert.match(ice.text, /Permanent shadow covers 3 % of the lunar window/);
  assert.match(ice.text, /mean index 0\.62, widespread over 55 %/);
  assert.match(ice.text, /not the destination's cold/);
  const mars = describe({ ice: { status: "not_measured", reason: "outside SWIM coverage (60 S to 60 N)" } }, "mars", "es").find(r => r.key === "ice");
  assert.equal(mars.verdict, "Sin medir");
});

test("an amended Mars verdict shows the original one beside it", () => {
  const ice = describe({ ice: { status: "measured", verdict: "none", verdict_v1_1: "breaks", destination_swim_clear_share: 0, destination_swim_positive_share: 0.87, earth_pzi_mean: 0, earth_pzi_share: 0 } }, "mars", "en").find(r => r.key === "ice");
  assert.equal(ice.verdict, "No ice");
  assert.match(ice.text, /0 % of the Mars window is clearly consistent/);
  assert.match(ice.text, /original rule it was "Breaks"; amended after seeing the data/);
});

test("ground row: bare share against WorldCover, with the dust caveat unless it breaks", () => {
  const holds = describe({ ground: { status: "measured", verdict: "holds", bare_share: 0.72, snow_ice_share: 0.01, vegetated_share: 0.2 } }, "mars", "en").find(r => r.key === "ground");
  assert.equal(holds.verdict, "Holds");
  assert.match(holds.text, /Bare ground over 72 % of the window; snow or ice, 1 %; vegetation, 20 %/);
  assert.match(holds.text, /not the destination's dust/);
  const breaks = describe({ ground: { status: "measured", verdict: "breaks", bare_share: 0.05, snow_ice_share: 0.6, vegetated_share: 0.3 } }, "moon", "es").find(r => r.key === "ground");
  assert.equal(breaks.verdict, "Se rompe");
  assert.match(breaks.text, /nieve o hielo, 60 %/);
  assert.doesNotMatch(breaks.text, /polvo del destino/);
});

test("geology row: destination rock family against the twin's dominant GLiM class", () => {
  const geo = describe({ geology: { status: "measured", verdict: "partly", family: "basaltic_volcanic", planet_unit: "eHv", earth_dominant: "vi", match_share: 0.3, family_share: 0.8 } }, "mars", "en").find(r => r.key === "geology");
  assert.equal(geo.verdict, "Partly");
  assert.match(geo.text, /Destination: volcanic basalt \(eHv\)\. The twin is mostly intermediate volcanics; the same rock covers 30 % of the window and the same family 80 %/);
  assert.match(geo.text, /not their chemistry/);
  const moon = describe({ geology: { status: "measured", verdict: "breaks", family: "crystalline_feldspathic", earth_dominant: "ss", match_share: 0, family_share: 0.1 } }, "moon", "es").find(r => r.key === "geology");
  assert.match(moon.text, /^Destino: corteza cristalina rica en feldespato \(anortosita\)\. En la gemela predomina: areniscas y lutitas/);
});
