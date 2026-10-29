import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./load-ts.mjs";

const { tilesForRadius, windowsWithin, bestFor, areaProfile, ELIGIBLE_LAND } = await importTs("regions.ts");
const { rankIn: rankAmongEarth } = await importTs("ranks.ts");

test("tiles for a radius cover the circle's box, across tile edges and the antimeridian", () => {
  const all = ["30_-10", "30_0", "40_-10", "20_-10", "0_170", "0_-180"];
  assert.deepEqual(tilesForRadius(35, -5, 50, 10, all), ["30_-10"]);
  assert.deepEqual(tilesForRadius(39.47, -0.38, 100, 10, all), ["30_-10", "30_0", "40_-10"]);
  assert.deepEqual(tilesForRadius(5, 179.8, 60, 10, all), ["0_-180", "0_170"]);
  assert.throws(() => tilesForRadius(0, 0, 0, 10, all));
});

const tile = {
  lat: [39.5, 39.0, 38.0], lon: [-0.5, -0.4, -1.0], land: [0.62, 1, 0.95],
  moonI: [7, 3, 4], moonD: [0.01, 0.09, 0.05], marsI: [2, 2, 5], marsD: [0.12, 0.2, 0.03],
  places: { n: ["Valencia", "Sueca", "Yecla"], a: ["Valencia", "Valencia", "Murcia"], c: ["ES", "ES", "ES"], k: [3, 4, 2] },
};

test("windows inside the circle, nearest first, with their place labels", () => {
  const w = windowsWithin(39.47, -0.38, 100, [tile]);
  assert.deepEqual(w.map(x => x.place.nearest), ["Valencia", "Sueca"]);
  assert.equal(w[0].eligible, false);
  assert.equal(w[1].eligible, true);
  assert.equal(ELIGIBLE_LAND, 0.9);
});

test("the best twin ignores windows that are mostly sea, as every statistic does", () => {
  const w = windowsWithin(39, -0.5, 200, [tile]);
  assert.equal(bestFor("moon", w).place.nearest, "Yecla", "the 62 %-land Valencia window has the lowest distance but is not eligible");
  assert.equal(bestFor("moon", w, false).place.nearest, "Valencia");
  assert.equal(bestFor("mars", w).place.nearest, "Yecla");
  const p = areaProfile(w);
  assert.equal(p.measured, 3);
  assert.equal(p.eligible, 2);
  assert.equal(bestFor("moon", []), null);
});

test("rank among Earth: share of measured Earth windows whose twin is farther", () => {
  const table = { step: 25, moon: [0.0, 0.1, 0.2, 0.3, 0.4], mars: [0, 1, 2, 3, 4] };
  assert.equal(rankAmongEarth("moon", 0, table), 100);
  assert.equal(rankAmongEarth("moon", 0.1, table), 75);
  assert.equal(rankAmongEarth("moon", 0.15, table), 62.5);
  assert.equal(rankAmongEarth("moon", 0.5, table), 0);
  assert.throws(() => rankAmongEarth("moon", NaN, table));
});
