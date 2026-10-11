import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/lib/footprint.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { aeqdPoint, analysisRing } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const fixtures = JSON.parse(await readFile(new URL("./footprint-fixtures.json", import.meta.url), "utf8"));
test("analysis boundaries agree with independent PROJ WGS84 AEQD inversion", () => {
  for (const { input, expected } of fixtures) {
    const actual = aeqdPoint(...input);
    const longitudeError = ((actual[0] - expected[0] + 540) % 360) - 180;
    assert.ok(Math.abs(longitudeError) < 1e-8, JSON.stringify(input));
    assert.ok(Math.abs(actual[1] - expected[1]) < 1e-8, JSON.stringify(input));
  }
});
test("closed analysis ring stays continuous across the antimeridian", () => {
  const ring = analysisRing(179.9, 43, 50);
  assert.equal(ring.length, 41);
  assert.deepEqual(ring[0], ring.at(-1));
  for (let i = 1; i < ring.length; i++) assert.ok(Math.abs(ring[i][0] - ring[i - 1][0]) < 1);
  assert.deepEqual(analysisRing(0, 0, 0), []);
  assert.deepEqual(analysisRing(0, NaN, 50), []);
});
test("web comparison reference equals the frozen scientific target", async () => {
  const web = JSON.parse(await readFile(new URL("../data/jezero-target.json", import.meta.url), "utf8"));
  const frozen = JSON.parse(await readFile(new URL("../../results/exp001/jezero_target_50km_v0_4.json", import.meta.url), "utf8"));
  assert.deepEqual(web, frozen);
  assert.equal(web.terrain["1000m"].slope.p95_deg, 8.401566909922817);
});
