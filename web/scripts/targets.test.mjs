import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importTs } from "./load-ts.mjs";

const { jensenShannonDistance, targetHistogram, planetaryTargets, SLOPE_BINS } = await importTs("targets.ts");
const { validateRequest, rankTerrain } = await importTs("search.ts");
const fixtures = JSON.parse(await readFile(new URL("./jsd-fixtures.json", import.meta.url), "utf8"));
const jezero = JSON.parse(await readFile(new URL("../data/jezero-target.json", import.meta.url), "utf8"));

test("TypeScript Jensen–Shannon distance matches the Python engine", () => {
  for (const { p, q, distance } of fixtures) assert.ok(Math.abs(jensenShannonDistance(p, q) - distance) < 1e-12, JSON.stringify({ p, q }));
  assert.equal(jensenShannonDistance([1, 0], [0, 1]), 1);
  assert.throws(() => jensenShannonDistance([1], [1, 0]));
  assert.throws(() => jensenShannonDistance([0, 0], [1, 0]));
});

test("target histograms come from the frozen 1 km distribution in bin order", () => {
  const h = targetHistogram(jezero);
  assert.equal(h.length, SLOPE_BINS.length);
  assert.ok(Math.abs(h.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(Math.abs(h[0] - jezero.terrain["1000m"].slope.distribution_pct["0-1"] / 100) < 1e-9);
  assert.throws(() => targetHistogram({ terrain: {} }));
  assert.deepEqual(Object.keys(planetaryTargets).slice(0, 2), ["jezero", "shackleton"]);
  assert.equal(Object.keys(planetaryTargets).length, 11);
});

const base = { title: "Moon", objective: "", profile: "navigation", target: "shackleton", mode: "indexed", west: -180, east: 180, south: -55, north: 59, minLandFraction: 0.9, minSlopeP95: 0, maxSlopeP95: 90, desiredSlopeP95: 8, maxJsd: 1, requirements: [], strict: false, limit: 10 };
const row = (id, distribution, extra = {}) => ({ id, lat: 10, lon: 10 + Number(id.slice(1)), jsd: 0.2, landFraction: 1, landStatus: "ELIGIBLE", slopeP95: 10, slopeMean: 4, distribution, ...extra });

test("non-Jezero targets rank by histogram distance and never reuse the stored Jezero value", () => {
  const steep = [0, 0, 0, 0, 0.1, 0.2, 0.3, 0.4];
  const flat = [0.6, 0.3, 0.1, 0, 0, 0, 0, 0];
  const reference = [0, 0, 0, 0.05, 0.15, 0.2, 0.3, 0.3];
  const result = rankTerrain([row("a1", flat), row("a2", steep), row("a3", undefined)], validateRequest(base), 50, reference);
  assert.deepEqual(result.candidates.map(c => c.id), ["a2", "a1"]);
  assert.ok(result.candidates.every(c => c.jsd !== 0.2));
  assert.equal(result.rejected, 1, "a window without a histogram cannot be scored against the Moon");
  assert.match(result.candidates[0].explanation.join(" "), /Shackleton/);
});

test("Jezero keeps using the frozen index distance; terrain mode has no planetary distance", () => {
  const jz = rankTerrain([row("a1", undefined)], validateRequest({ ...base, target: "jezero" }));
  assert.equal(jz.candidates[0].jsd, 0.2);
  const terrain = rankTerrain([row("a1", undefined)], validateRequest({ ...base, target: "terrain" }));
  assert.equal(terrain.candidates[0].jsd, null);
  assert.throws(() => validateRequest({ ...base, target: "olympus" }));
});
