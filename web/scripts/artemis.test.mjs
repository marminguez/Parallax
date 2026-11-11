import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importTs } from "./load-ts.mjs";

const { planetaryTargets, targetHistogram, isArtemisRegion } = await importTs("targets.ts");
const { parseEarthIndex, targetFamily, targetBody } = await importTs("earthIndex.ts");
const { rankTerrain, validateRequest } = await importTs("search.ts");

const read = file => readFile(new URL(file, import.meta.url), "utf8");
const summary = JSON.parse(await read("../data/artemis-references.json"));
const run = JSON.parse(await read("../../results/artemis_references/run_v1.json"));
const index = parseEarthIndex(await read("../data/earth-index.csv"));
const extras = JSON.parse(await read("../data/earth-index-extras.json"));
const rows = index.map(r => ({ id: r.id, lat: r.lat, lon: r.lon, jsd: NaN, landFraction: extras.landFraction[r.id], landStatus: "ELIGIBLE", slopeP95: null, slopeMean: null, distribution: r.distribution, earth: r.earth }));
const base = { title: "t", objective: "", profile: "drilling", mode: "indexed", west: -180, east: 180, south: -90, north: 90, minLandFraction: 0.9, minSlopeP95: 0, maxSlopeP95: 90, desiredSlopeP95: 8, maxJsd: 1, requirements: [], strict: false, limit: 5 };

test("the nine Artemis III regions are frozen references of the Moon with feldspathic crust", () => {
  assert.equal(summary.regions.length, 9);
  for (const r of summary.regions) {
    assert.ok(isArtemisRegion(r.id), r.id);
    assert.equal(planetaryTargets[r.id].body, "Moon");
    assert.equal(targetBody(r.id), "Moon");
    assert.equal(targetFamily(r.id), "crystalline_feldspathic");
    assert.equal(planetaryTargets[r.id].file, `artemis/${r.id}.json`);
  }
  assert.equal(isArtemisRegion("shackleton"), false);
  assert.equal(validateRequest({ ...base, target: "nobile-rim-1" }).target, "nobile-rim-1");
});

test("C1: with no conditions, every region's first web result is its published reverse-map twin", async () => {
  assert.equal(run.C1.pass, true);
  for (const r of summary.regions) {
    const ref = targetHistogram(JSON.parse(await read(`../data/artemis/${r.id}.json`)));
    const { candidates } = rankTerrain(rows, { ...base, target: r.id }, 50, ref);
    assert.equal(candidates[0].id, r.twin, r.id);
    assert.ok(Math.abs(candidates[0].jsd - r.twinDistance) <= 1e-5, `${r.id}: ${candidates[0].jsd} vs ${r.twinDistance}`);
  }
});

test("P1 is recorded for every region, with the drilling candidates the web search also finds", async () => {
  assert.equal(run.P1.supported, run.P1.regions_with_at_least_5 >= 7);
  const r = summary.regions.find(x => x.id === "nobile-rim-1");
  const ref = targetHistogram(JSON.parse(await read(`../data/artemis/${r.id}.json`)));
  const { candidates } = rankTerrain(rows, { ...base, target: r.id, maxJsd: 1, limit: 50, earthFilters: { bareMin: 0.5, permafrost: true } }, 50, ref);
  assert.ok(candidates.length > 0 && candidates.every(c => c.earth.ice === true && c.earth.bare >= 0.5));
});
