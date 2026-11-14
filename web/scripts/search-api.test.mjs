import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { once } from "node:events";

const origin = "http://127.0.0.1:3102";
let server;
const base = {
  title: "Reproducible test", objective: "Validate measured terrain matching",
  profile: "mobility", target: "jezero", mode: "indexed",
  west: -180, east: 180, south: -55, north: 59,
  minLandFraction: 0.9, minSlopeP95: 0, maxSlopeP95: 90,
  desiredSlopeP95: 8.4, maxJsd: 0.3, requirements: [], strict: false, limit: 10,
};
async function query(overrides = {}) {
  const response = await fetch(origin + "/api/search", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...base, ...overrides }),
  });
  return { status: response.status, body: await response.json() };
}
before(async () => {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3102"], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  server.stdout.on("data", d => { output += d; });
  server.stderr.on("data", d => { output += d; });
  for (let i = 0; i < 100; i++) {
    if (output.includes("Ready")) return;
    if (server.exitCode !== null) throw new Error(output);
    await delay(100);
  }
  throw new Error("Server did not start: " + output);
});
after(async () => {
  if (server && server.exitCode === null) { const exit = once(server, "exit"); server.kill(); await exit; }
});
test("planetary searches rank the 42,405-window earth index, Jezero by the Mars model v2 score", async () => {
  const { status, body } = await query();
  assert.equal(status, 200);
  assert.equal(body.index, "earth");
  assert.equal(body.evaluated, 42405);
  assert.equal(body.candidates.length, 10);
  assert.ok(body.candidates.every(c => c.id.startsWith("EARTH-") && c.jsd <= 0.3 && c.earth && c.slopeP95 === null));
  assert.ok(body.candidates.every((c, i, xs) => Math.abs(c.score - (0.5 * c.jsd + 0.5 * (1 - c.earth.bare))) < 1e-12 && (i === 0 || xs[i - 1].score <= c.score)));
  assert.match(body.provenance.ranking, /model v2/);
  assert.equal(body.provenance.resolutionM, 1000);
  assert.match(body.provenance.version, /^[a-f0-9]{64}$/);
  assert.ok(body.candidates.every(c => c.missingEvidence.length > 0));
});
test("the earth index has no regional P95, so a slope limit never passes there", async () => {
  const { status, body } = await query({ maxSlopeP95: 15 });
  assert.equal(status, 200);
  assert.equal(body.candidates.length, 0);
  assert.equal(body.rejected, 42405);
});
test("terrain conditions remove windows, report why, and never pass a missing value", async () => {
  const { status, body } = await query({ target: "shackleton", profile: "drilling", maxJsd: 1, earthFilters: { bareMin: 0.5, permafrost: true, access: ["remote"] } });
  assert.equal(status, 200);
  assert.ok(body.candidates.length > 0);
  assert.ok(body.candidates.every(c => c.earth.bare >= 0.5 && c.earth.ice === true && c.earth.access === "remote"));
  assert.ok(body.candidates.every((c, i, xs) => i === 0 || xs[i - 1].jsd <= c.jsd));
  assert.ok(body.earthRejected.bareMin.outside > 0 && body.earthRejected.permafrost.outside > 0);
  for (const bad of [{ earthFilters: { bareMin: 50 } }, { earthFilters: { access: ["city"] } }, { target: "terrain", earthFilters: { permafrost: true } }]) assert.equal((await query(bad)).status, 400);
});
test("the generic slope search keeps the EXP-001B pilot, which stores the regional P95", async () => {
  const { body } = await query({ target: "terrain", desiredSlopeP95: 8.4, maxSlopeP95: 15 });
  assert.equal(body.index, "pilot");
  assert.equal(body.evaluated, 986);
  assert.ok(body.candidates.every(c => c.id.startsWith("EXP001B-") && c.slopeP95 <= 15));
});
test("indexed results carry display-only place labels and site groups", async () => {
  const { body } = await query();
  assert.match(body.candidates[0].place.countryCode, /^[A-Z]{2}$/);
  assert.ok(body.candidates.every(c => c.place && c.site));
  assert.equal(body.candidates.filter(c => c.site.isRepresentative).length, body.independentSites);
  assert.match(body.placeNames.attribution, /GeoNames/);
});
test("lunar ranking needs its frozen reference and index histograms, and never falls back to Jezero", async () => {
  const exists = async file => readFile(new URL(`../data/${file}`, import.meta.url)).then(() => true, () => false);
  const ready = await exists("shackleton-target.json");
  const { status, body } = await query({ target: "shackleton", maxJsd: 1 });
  if (!ready) {
    assert.equal(status, 503);
    assert.match(body.error, /build_lunar_target_50km\.py/);
    assert.equal(body.candidates, undefined);
    return;
  }
  assert.equal(status, 200);
  assert.equal(body.planetaryReference.target.planet, "Moon");
  assert.ok(body.candidates.length > 0);
  assert.ok(body.candidates.every((c, i, all) => Number.isFinite(c.jsd) && (i === 0 || all[i - 1].jsd <= c.jsd)));
  assert.match(body.provenance.ranking, /Shackleton/);
});
test("changing the requested terrain changes ranking and removes Jezero scores", async () => {
  const low = (await query({ target: "terrain", desiredSlopeP95: 2 })).body;
  const high = (await query({ target: "terrain", desiredSlopeP95: 14 })).body;
  assert.notEqual(low.candidates[0].id, high.candidates[0].id);
  assert.ok(high.candidates.every(c => c.jsd === null));
});
test("geographic and slope constraints are hard filters", async () => {
  const { body } = await query({ target: "terrain", west: -110, east: -90, south: 15, north: 30, maxSlopeP95: 7 });
  assert.ok(body.candidates.length > 0);
  assert.ok(body.candidates.every(c => c.lon >= -110 && c.lon <= -90 && c.lat >= 15 && c.lat <= 30 && c.slopeP95 <= 7));
});
test("missing critical evidence never qualifies in strict mode", async () => {
  const { body } = await query({ strict: true });
  assert.equal(body.candidates.length, 0);
  assert.ok(body.provisional > 0);
});
test("required numeric envelopes are retained and marked unresolved", async () => {
  const { body } = await query({ testEnvelope: { pressurePa: 0.001, hardwareMassKg: 500 } });
  assert.equal(body.request.testEnvelope.pressurePa, 0.001);
  assert.ok(body.request.requirements.includes("vacuum"));
  assert.ok(body.candidates[0].missingEvidence.some(s => s.includes("pressure")));
});
test("invalid bounds, envelopes, types and terrain dust searches are rejected", async () => {
  for (const bad of [{ west: 20, east: 10 }, { minLandFraction: "0.9" }, { profile: "__proto__" }, { profile: "dust" }, { testEnvelope: { temperatureMinC: 100, temperatureMaxC: 0 } }, { mode: "live" }]) {
    assert.equal((await query(bad)).status, 400);
  }
});
test("facilities come from documented NASA capabilities, with no fake JSD", async () => {
  const { body } = await query({ profile: "thermal", mode: "facilities", south: -90, north: 90 });
  assert.equal(body.candidates.length, 1);
  assert.equal(body.candidates[0].id, "NASA-JSC-LDTF");
  assert.equal(body.candidates[0].jsd, null);
  assert.match(body.candidates[0].source, /^https:\/\/www.nasa.gov\//);
  assert.equal((await query({ profile: "thermal", mode: "facilities", strict: true })).body.candidates.length, 0);
});
test("zero geographic matches produces an empty result instead of fallback points", async () => {
  const { body } = await query({ west: 0, east: 0.01, south: 0, north: 0.01 });
  assert.equal(body.candidates.length, 0);
});
test("map worker assets and experiment page are served", async () => {
  for (const route of ["/experiments/new", "/maplibre-gl-worker.mjs", "/maplibre-gl-shared.mjs"]) assert.equal((await fetch(origin + route)).status, 200);
  const worker = await readFile("public/maplibre-gl-worker.mjs", "utf8");
  assert.ok(worker.includes("./maplibre-gl-shared.mjs"));
});
const PUBLIC = process.env.NEXT_PUBLIC_PARALLAX_PUBLIC === "1";
test("public deployment refuses live evaluation with a clear message", async t => {
  if (!PUBLIC) return t.skip("Local build: live evaluation is enabled.");
  const { status, body } = await query({ mode: "live", west: 36, east: 38, south: 9, north: 11 });
  assert.equal(status, 501);
  assert.match(body.error, /local install/);
  assert.equal(body.candidates, undefined);
});
test("missing local rasters return an actionable error, never indexed fallback", async t => {
  if (PUBLIC) return t.skip("Public build: live evaluation is off.");
  const tiles = await readdir("../data/earth/coarse/raw").catch(() => []);
  if (tiles.some(name => name.endsWith(".SRTMGL30.dem.zip"))) return t.skip("Local rasters are present; run the geospatial integration suite.");
  const { status, body } = await query({ mode: "live", west: 36, east: 38, south: 9, north: 11 });
  assert.equal(status, 503);
  assert.match(body.error, /SRTMGL30/);
  assert.equal(body.candidates, undefined);
});

test("land-cover constraints reject unsupported modes and malformed fractions", async () => {
  for (const override of [
    { landCoverConstraints: { minBareFraction: 0.01 } },
    { mode: "facilities", landCoverConstraints: { maxTreeFraction: 0.5 } },
    { mode: "live", west: -3.1, east: -2.9, south: 42.9, north: 43.1, landCoverConstraints: { maxBuiltFraction: 50 } },
    { mode: "live", west: -3.1, east: -2.9, south: 42.9, north: 43.1, landCoverConstraints: { minBareFraction: "1" } },
  ]) assert.equal((await query(override)).status, 400);
});

test("an Artemis III region is a search reference whose first result is its published twin", async () => {
  const summary = JSON.parse(await readFile(new URL("../data/artemis-references.json", import.meta.url), "utf8"));
  const region = summary.regions.find(r => r.id === "nobile-rim-1");
  const { status, body } = await query({ target: "nobile-rim-1", maxJsd: 1, limit: 3 });
  assert.equal(status, 200);
  assert.equal(body.index, "earth");
  assert.equal(body.planetaryReference.target.planet, "Moon");
  assert.equal(body.candidates[0].id, region.twin);
  assert.match(body.provenance.ranking, /Nobile Rim 1/);
});

test("indexed results carry the nearest scheduled airport (reachability v1), display only", async () => {
  const { status, body } = await query({ target: "shackleton", limit: 20 });
  assert.equal(status, 200);
  assert.ok(body.candidates.every(c => c.airport && typeof c.airport.km === "number" && c.airport.name));
  const plain = (await query({ target: "shackleton", limit: 20 })).body.candidates.map(c => c.id);
  assert.deepEqual(body.candidates.map(c => c.id), plain, "airports never change the order");
});
