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
  minLandFraction: 0.9, minSlopeP95: 0, maxSlopeP95: 15,
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
test("ranked records come from the measured index, not the three demo coordinates", async () => {
  const { status, body } = await query();
  assert.equal(status, 200);
  assert.equal(body.evaluated, 986);
  assert.equal(body.candidates[0].id, "EXP001B-0406411");
  assert.ok(Math.abs(body.candidates[0].jsd - 0.10917514025505098) < 1e-12);
  assert.equal(body.provenance.resolutionM, 1000);
  assert.match(body.provenance.version, /^[a-f0-9]{64}$/);
  assert.ok(body.candidates.every(c => c.missingEvidence.length > 0));
});
test("indexed results carry display-only place labels and site groups", async () => {
  const { body } = await query();
  assert.equal(body.candidates[0].place.countryCode, "ET");
  assert.ok(body.candidates.every(c => c.place && c.site));
  assert.equal(body.candidates.filter(c => c.site.isRepresentative).length, body.independentSites);
  assert.match(body.placeNames.attribution, /GeoNames/);
});
test("lunar ranking needs its frozen reference and index histograms, and never falls back to Jezero", async () => {
  const exists = async file => readFile(new URL(`../data/${file}`, import.meta.url)).then(() => true, () => false);
  const ready = (await exists("shackleton-target.json")) && (await exists("earth-slope-histograms.csv"));
  const { status, body } = await query({ target: "shackleton", maxJsd: 1 });
  if (!ready) {
    assert.equal(status, 503);
    assert.match(body.error, /build_lunar_target_50km\.py|export_index_histograms\.py/);
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
  const { body } = await query({ west: -110, east: -90, south: 15, north: 30, maxSlopeP95: 7 });
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
test("missing local rasters return an actionable error, never indexed fallback", async t => {
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
