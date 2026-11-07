import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./load-ts.mjs";

const { describe } = await importTs("twinSheets.ts");

test("a missing sheet shows three pending rows, never invented values", () => {
  const rows = describe(undefined, "moon", "en");
  assert.deepEqual(rows.map(r => r.key), ["fine_relief", "temperature", "operations", "ice"]);
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
