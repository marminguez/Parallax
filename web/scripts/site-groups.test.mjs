import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const load = async file => {
  const code = ts.transpileModule(await readFile(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
};
const { validateRequest, rankTerrain, windowsOverlap, groupOverlappingWindows } = await load("../src/lib/search.ts");
const { placeLabel } = await load("../src/lib/places.ts");

const base = { title: "Sites", objective: "", profile: "mobility", target: "jezero", mode: "indexed", west: -180, east: 180, south: -55, north: 59, minLandFraction: 0.9, minSlopeP95: 0, maxSlopeP95: 20, desiredSlopeP95: 8.4, maxJsd: 1, requirements: [], strict: false, limit: 50 };
const row = (id, lat, lon, jsd, extra = {}) => ({ id, lat, lon, jsd, landFraction: 1, landStatus: "ELIGIBLE", slopeP95: 10, slopeMean: 4, ...extra });
const km = deg => deg * Math.PI / 180 * 6371.0088;

test("square windows overlap only when both centre offsets are below the window side", () => {
  const a = { lat: 43, lon: -3 };
  assert.ok(windowsOverlap(a, { lat: 43 + 49 / km(1), lon: -3 }, 50));
  assert.ok(!windowsOverlap(a, { lat: 43 + 51 / km(1), lon: -3 }, 50));
  const lon51 = 51 / (km(1) * Math.cos(43 * Math.PI / 180));
  assert.ok(!windowsOverlap(a, { lat: 43, lon: -3 + lon51 }, 50));
  assert.ok(windowsOverlap({ lat: 0, lon: 179.9 }, { lat: 0, lon: -179.9 }, 50), "antimeridian neighbours overlap");
});

test("grouping keeps the raw order and attaches lower-ranked overlaps to the best window", () => {
  const rows = [row("far", 10, 10, 0.3), row("best", 43, -3, 0.1), row("near-best", 43.2, -3.1, 0.2), row("touches-near", 43.6, -3.1, 0.25)];
  const result = rankTerrain(rows, validateRequest(base));
  assert.deepEqual(result.candidates.map(c => c.id), ["best", "near-best", "touches-near", "far"]);
  assert.equal(result.independentSites, 3);
  const byId = Object.fromEntries(result.candidates.map(c => [c.id, c.site]));
  assert.deepEqual(byId.best, { rank: 1, representativeId: "best", isRepresentative: true, overlapping: ["near-best"] });
  assert.equal(byId["near-best"].representativeId, "best");
  // Not transitive: overlaps near-best but not best, so it is its own site.
  assert.equal(byId["touches-near"].isRepresentative, true);
  assert.equal(byId["touches-near"].rank, 2);
  assert.equal(byId.far.rank, 3);
});

// Same centre layout as scripts/search_candidates.py: linspace(bound, bound, 7)[1::2].
const centres = (lo, hi) => [1, 3, 5].map(k => lo + (hi - lo) * k / 6);
test("the validated Northern Spain search (nine centres within 15 km) is one site", () => {
  const rows = [];
  for (const lat of centres(42.9, 43.1)) for (const lon of centres(-3.1, -2.9)) rows.push(row(`w${rows.length}`, lat, lon, 0.39 + rows.length / 1000));
  const candidates = rows.map(r => ({ ...r }));
  assert.equal(groupOverlappingWindows(candidates, 50), 1);
  assert.equal(candidates[0].site.overlapping.length, 8);
});
test("a 2° × 2° live search spaces centres about 74 km apart, so its windows stay independent", () => {
  const rows = [];
  for (const lat of centres(42, 44)) for (const lon of centres(-4, -2)) rows.push(row(`w${rows.length}`, lat, lon, 0.3 + rows.length / 100));
  const candidates = rows.map(r => ({ ...r }));
  assert.equal(groupOverlappingWindows(candidates, 50), 9);
});

test("place labels are display-only and never change ranking", () => {
  const rows = [row("a", 1, 1, 0.3), row("b", 2, 2, 0.1), row("c", 30, 30, 0.2)];
  const plain = rankTerrain(rows, validateRequest(base)).candidates.map(c => c.id);
  const labelled = rankTerrain(rows.map((r, i) => ({ ...r, place: { nearest: "Z" + i, admin1: "Region", countryCode: ["ES", "MA", "AQ"][i], distanceKm: i * 40 } })), validateRequest(base));
  assert.deepEqual(labelled.candidates.map(c => c.id), plain);
  assert.ok(labelled.candidates.every(c => c.place));
});

test("labels name the region when close and say remote when far", () => {
  assert.equal(placeLabel({ id: "x", name: "x" }).title, "x");
  const near = placeLabel({ id: "x", name: "x", place: { nearest: "Urduna", admin1: "Basque Country", countryCode: "ES", distanceKm: 1 } });
  assert.equal(near.title, "Basque Country, Spain");
  assert.match(near.detail, /Urduna/);
  const far = placeLabel({ id: "x", name: "x", place: { nearest: "Rehoboth", admin1: "Hardap", countryCode: "NA", distanceKm: 120 } });
  assert.match(far.title, /^Remote area/);
  assert.match(far.detail, /120 km/);
});
