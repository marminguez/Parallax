import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./load-ts.mjs";

const { classify, closerThan, tilesFor, tileKey, lookUp, mapPosition, nearestWindow, haversineKm, slippy, MAX_WINDOW_KM } = await importTs("underfoot.ts");

const thresholds = { q25: 0.29885, q50: 0.47345, q90: 0.84956 };
const pairs = [0.0951, 0.1484, 0.2574, 0.2604, 0.2816, 0.3506, 0.3864, 0.3992, 0.463, 0.4839, 0.5545, 0.5555, 0.6, 0.7195, 0.7321, 0.8495, 0.8497, 0.8987];

test("classes match the frozen VAL-004 thresholds, twin side inclusive", () => {
  assert.deepEqual([0, 0.29885, 0.3, 0.47345, 0.5, 0.84956, 0.85, 1].map(d => classify(d, thresholds)), ["strong_twin", "strong_twin", "twin", "twin", "partial", "partial", "no_twin", "no_twin"]);
  assert.throws(() => classify(NaN, thresholds));
});

test("comparison with established analogs counts those strictly farther", () => {
  assert.equal(closerThan(0.09, pairs), 18);
  assert.equal(closerThan(0.4839, pairs), 8);
  assert.equal(closerThan(0.95, pairs), 0);
});

test("tile keys floor towards the south-west, and neighbours are fetched only near an edge", () => {
  assert.equal(tileKey(39.47, -0.38, 10), "30_-10");
  assert.equal(tileKey(-0.1, 0, 10), "-10_0");
  const all = ["30_-10", "30_0", "40_-10", "20_-10"];
  assert.deepEqual(tilesFor(35, -5, 10, all), ["30_-10"]);
  assert.deepEqual(tilesFor(39.47, -0.38, 10, all), ["30_-10", "30_0", "40_-10"]);
  assert.deepEqual(tilesFor(0, 179.9, 10, ["0_170", "0_-180", "-10_170", "-10_-180"]), ["-10_-180", "-10_170", "0_-180", "0_170"]);
});

const tile = { lat: [39.5, 38.0], lon: [-0.5, -1.0], land: [0.62, 1], moonI: [7, 3], moonD: [0.31, 0.9], marsI: [2, 2], marsD: [0.12, 0.2] };
const planets = {
  moon: { 7: { id: "MOON-100-125", lat: -88, lon: 10, c: 1, d: 0.4, e: [1, 2] }, 3: { id: "MOON-000-000", lat: -85, lon: 0, c: 3, d: 0.9, e: [1, 2] } },
  mars: { 2: { id: "MARS-000002", lat: -4.6, lon: 137.4, c: 0, d: 0.1, e: [1, 2] } },
};

test("look-up returns the nearest window's twins on both bodies", () => {
  const r = lookUp(39.47, -0.38, [tile], planets, { thresholds, validatedPairs: pairs });
  assert.equal(r.status, "ok");
  assert.equal(r.earth.eligible, false, "a coastal window is shown but flagged");
  assert.deepEqual(r.twins.map(t => [t.body, t.window.id, t.cls, t.closerThan]), [["moon", "MOON-100-125", "twin", 13], ["mars", "MARS-000002", "strong_twin", 17]]);
});

test("far from every window the answer is 'outside', never a stretched match", () => {
  const r = lookUp(0, -30, [tile], planets, { thresholds, validatedPairs: pairs });
  assert.equal(r.status, "outside");
  assert.ok(r.nearestKm > MAX_WINDOW_KM);
  assert.deepEqual(lookUp(0, 0, [], planets, { thresholds, validatedPairs: pairs }), { status: "outside", nearestKm: null });
  assert.throws(() => lookUp(91, 0, [tile], planets, { thresholds, validatedPairs: pairs }));
  assert.throws(() => lookUp(39.5, -0.5, [{ ...tile, moonI: [99, 3] }], planets, { thresholds, validatedPairs: pairs }), /Missing moon window/);
});

test("geometry helpers", () => {
  assert.ok(Math.abs(haversineKm(0, 0, 0, 1) - 111.195) < 0.01);
  assert.equal(nearestWindow(38.1, -1, [tile]).index, 1);
  const s = slippy(0, 0, 1);
  assert.deepEqual([s.x, s.y], [1, 1]);
  assert.deepEqual(mapPosition("mars", { id: "MARS-1", lat: 0, lon: 0 }), { x: 0.5, y: 0.5 });
  assert.deepEqual(mapPosition("moon", { id: "MOON-100-125", lat: 0, lon: 0 }, { moon: { shape: [600, 600] } }), { x: 150 / 600, y: 125 / 600 });
  assert.equal(mapPosition("moon", { id: "MOON-1-1", lat: 0, lon: 0 }, undefined), null);
});
