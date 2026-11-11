import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importTs } from "./load-ts.mjs";

const { parseEarthIndex, parseSoil, failedFilter, validateEarthFilters } = await importTs("earthIndex.ts");
const { rankTerrain } = await importTs("search.ts");
const { targetHistogram } = await importTs("targets.ts");

const read = file => readFile(new URL(file, import.meta.url), "utf8");
const soil = parseSoil(await read("../data/soil-texture.csv"));
const run = JSON.parse(await read("../../results/soil_texture/soil_texture_v1.json"));
const index = parseEarthIndex(await read("../data/earth-index.csv"));
const extras = JSON.parse(await read("../data/earth-index-extras.json"));
const rows = index.map(r => ({ id: r.id, lat: r.lat, lon: r.lon, jsd: NaN, landFraction: extras.landFraction[r.id], landStatus: "ELIGIBLE", slopeP95: null, slopeMean: null, distribution: r.distribution, earth: { ...r.earth, soil: soil.get(r.id) } }));
const base = { title: "t", objective: "", profile: "mobility", mode: "indexed", west: -180, east: 180, south: -90, north: 90, minLandFraction: 0.9, minSlopeP95: 0, maxSlopeP95: 90, desiredSlopeP95: 8, maxJsd: 1, requirements: [], strict: false, limit: 50 };

test("every index window has a soil row; the measured count matches the run", () => {
  assert.equal(soil.size, index.length);
  for (const r of index) assert.ok(soil.has(r.id), r.id);
  const measured = [...soil.values()].filter(s => s.texture !== null);
  assert.equal(measured.length, run.predictions.P2_most_windows_measured.measured);
  assert.ok(run.S2.pass);
  for (const s of soil.values()) if (s.texture === null) assert.ok(s.validShare < 0.25 && s.sand === null);
});

test("soil conditions: limits are inclusive, missing never passes", () => {
  const earth = { ...index[0].earth, soil: { validShare: 1, sand: 0.6, silt: 0.3, clay: 0.1, coarse: 0.2, texture: "sandy_loam" } };
  assert.equal(failedFilter(earth, { sandMin: 0.6, clayMax: 0.1, coarseMax: 0.2 }, "jezero"), null);
  assert.deepEqual(failedFilter(earth, { sandMin: 0.61 }, "jezero"), { key: "sandMin", missing: false });
  assert.deepEqual(failedFilter(earth, { clayMax: 0.09 }, "jezero"), { key: "clayMax", missing: false });
  assert.deepEqual(failedFilter(earth, { coarseMax: 0.1 }, "jezero"), { key: "coarseMax", missing: false });
  const none = { ...index[0].earth, soil: { validShare: 0.1, sand: null, silt: null, clay: null, coarse: null, texture: null } };
  assert.deepEqual(failedFilter(none, { sandMin: 0 }, "jezero"), { key: "sandMin", missing: true });
  assert.deepEqual(failedFilter(index[0].earth, { clayMax: 1 }, "jezero"), { key: "clayMax", missing: true }); // soil not loaded
  assert.deepEqual(validateEarthFilters({ sandMin: 0.5, clayMax: 0.2, coarseMax: 0.3 }), { sandMin: 0.5, clayMax: 0.2, coarseMax: 0.3 });
  assert.throws(() => validateEarthFilters({ sandMin: 1.5 }));
});

test("soil conditions only remove windows, never reorder them", async () => {
  const ref = targetHistogram(JSON.parse(await read("../data/shackleton-target.json")));
  const all = rankTerrain(rows, { ...base, target: "shackleton", limit: 500 }, 50, ref);
  const some = rankTerrain(rows, { ...base, target: "shackleton", limit: 500, earthFilters: { sandMin: 0.6, clayMax: 0.15 } }, 50, ref);
  const kept = new Set(some.candidates.map(c => c.id));
  assert.ok(kept.size > 0);
  const order = all.candidates.map(c => c.id);
  const positions = some.candidates.map(c => order.indexOf(c.id)).filter(i => i >= 0);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  for (const c of some.candidates) assert.ok(c.earth.soil.sand >= 0.6 && c.earth.soil.clay <= 0.15);
  const r = some.earthRejected;
  assert.ok((r.sandMin?.outside ?? 0) + (r.clayMax?.outside ?? 0) > 0);
});
