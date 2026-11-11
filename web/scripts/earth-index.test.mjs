import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importTs } from "./load-ts.mjs";

const { parseEarthIndex, failedFilter, validateEarthFilters, rockVerdict, temperatureOverlap, temperatureVerdict, groundVerdict, PLANET_TEMPERATURE_C, marsScore } = await importTs("earthIndex.ts");
const { rankTerrain, validateRequest } = await importTs("search.ts");
const { targetHistogram } = await importTs("targets.ts");

const read = file => readFile(new URL(file, import.meta.url), "utf8");
const index = parseEarthIndex(await read("../data/earth-index.csv"));
const extras = JSON.parse(await read("../data/earth-index-extras.json"));
const b2 = JSON.parse(await read("../../results/earth_dimensions/b2_v1.json"));
const sheets = JSON.parse(await read("../data/twin-sheets.json")).sheets;
const sites = JSON.parse(await read("../data/val004-sites.json")).destinations;
const targets = { jezero: JSON.parse(await read("../data/jezero-target.json")), shackleton: JSON.parse(await read("../data/shackleton-target.json")) };

const base = { title: "t", objective: "", profile: "drilling", target: "shackleton", mode: "indexed", west: -180, east: 180, south: -90, north: 90, minLandFraction: 0.9, minSlopeP95: 0, maxSlopeP95: 90, desiredSlopeP95: 8, maxJsd: 1, requirements: [], strict: false, limit: 50 };
const measurement = r => ({ id: r.id, lat: r.lat, lon: r.lon, jsd: NaN, landFraction: extras.landFraction[r.id], landStatus: "ELIGIBLE", slopeP95: null, slopeMean: null, distribution: r.distribution, earth: r.earth });

test("the index is the 42,405 eligible VAL-004 windows with labels and land fractions", () => {
  assert.equal(index.length, 42405);
  assert.equal(new Set(index.map(r => r.id)).size, 42405);
  assert.ok(index.every(r => r.distribution.length === 8 && Math.abs(r.distribution.reduce((a, b) => a + b, 0) - 1) < 1e-4));
  assert.ok(index.every(r => extras.landFraction[r.id] >= 0.9 && extras.places[r.id]?.length === 4));
  assert.equal(index.filter(r => r.earth.access === null).length, 24);
  assert.ok(index.every(r => r.earth.bare !== null && r.earth.ice !== null && r.earth.glim && r.earth.tsMin !== null));
});

test("B2: web search distances equal the Python engine within 1e-9", () => {
  assert.equal(b2.seed, 2026);
  assert.equal(b2.windows.length, 20);
  const byId = new Map(index.map(r => [r.id, r]));
  for (const target of ["jezero", "shackleton"]) {
    const rows = b2.windows.map(w => measurement(byId.get(w.id)));
    const { candidates } = rankTerrain(rows, { ...base, target, limit: 50 }, 50, targetHistogram(targets[target]));
    assert.equal(candidates.length, 20, target);
    for (const w of b2.windows) {
      const c = candidates.find(x => x.id === w.id);
      assert.ok(Math.abs(c.jsd - w[target]) <= b2.tolerance, `${target} ${w.id}: ${c.jsd} vs ${w[target]}`);
    }
  }
});

test("the web rules reproduce the published twin verdicts for rock, temperature and ground", () => {
  for (const d of sites) {
    const s = sheets[d.id];
    if (s.geology.status === "measured") assert.equal(rockVerdict(s.geology.earth_classes, s.geology.family).verdict, s.geology.verdict, `${d.id} rock`);
    if (s.temperature.status === "measured") {
      const overlap = temperatureOverlap(s.temperature.earth_c, PLANET_TEMPERATURE_C[d.body === "moon" ? "Moon" : "Mars"]);
      assert.ok(Math.abs(overlap - s.temperature.overlap) < 0.002, `${d.id} overlap`);
      assert.equal(temperatureVerdict(overlap), s.temperature.verdict, `${d.id} temperature`);
    }
    if (s.ground.status === "measured") assert.equal(groundVerdict(s.ground.bare_share), s.ground.verdict, `${d.id} ground`);
  }
});

test("filters remove windows, a missing value never passes, and the reason is recorded", () => {
  const earth = { bare: 0.6, vegetated: 0.1, access: null, ice: true, glim: { pb: 0.6, ss: 0.4 }, tsMin: -100, tsMax: 20 }; // Moon overlap 120/257: partly
  assert.equal(failedFilter(earth, { bareMin: 0.5, permafrost: true, rock: "holds" }, "shackleton"), null);
  assert.deepEqual(failedFilter(earth, { bareMin: 0.7 }, "shackleton"), { key: "bareMin", missing: false });
  assert.deepEqual(failedFilter(earth, { access: ["remote"] }, "shackleton"), { key: "access", missing: true });
  assert.deepEqual(failedFilter({ ...earth, ice: null }, { permafrost: true }, "shackleton"), { key: "permafrost", missing: true });
  assert.deepEqual(failedFilter(earth, { rock: "holds" }, "jezero"), { key: "rock", missing: false });
  assert.equal(failedFilter(earth, { temperature: "holds_or_partly" }, "shackleton"), null);
  assert.deepEqual(failedFilter(earth, { temperature: "holds" }, "shackleton"), { key: "temperature", missing: false });
});

test("terrain conditions are validated and only allowed on the index with a planetary target", () => {
  assert.deepEqual(validateEarthFilters({ bareMin: 0.5, permafrost: false, access: [] }), { bareMin: 0.5 });
  for (const bad of [{ bareMin: 50 }, { access: ["city"] }, { rock: "yes" }, { permafrost: "true" }, { snow: 1 }, []]) assert.throws(() => validateEarthFilters(bad));
  assert.throws(() => validateRequest({ ...base, target: "terrain", earthFilters: { bareMin: 0.5 } }));
  assert.throws(() => validateRequest({ ...base, mode: "facilities", profile: "thermal", earthFilters: { bareMin: 0.5 } }));
  assert.deepEqual(validateRequest({ ...base, earthFilters: { permafrost: true } }).earthFilters, { permafrost: true });
});

test("the index has no regional P95, so a slope limit never passes there", () => {
  const rows = index.slice(0, 200).map(measurement);
  const ref = targetHistogram(targets.shackleton);
  assert.equal(rankTerrain(rows, { ...base, maxSlopeP95: 15 }, 50, ref).candidates.length, 0);
  assert.ok(rankTerrain(rows, base, 50, ref).candidates.length > 0);
});

test("Shackleton with bare ground and permafrost keeps only windows that meet both, ordered by distance", () => {
  const ref = targetHistogram(targets.shackleton);
  const filters = { bareMin: 0.5, permafrost: true };
  const r = rankTerrain(index.map(measurement), { ...base, maxJsd: 0.29885, earthFilters: filters }, 50, ref);
  assert.equal(r.candidates.length, 50);
  const all = rankTerrain(index.map(measurement), { ...base, maxJsd: 0.29885, earthFilters: filters, limit: 50 }, 50, ref);
  assert.ok(all.candidates.every(c => c.earth.ice === true && c.earth.bare >= 0.5 && c.jsd <= 0.29885));
  assert.ok(all.earthRejected.bareMin.outside > 0 && all.earthRejected.permafrost.outside > 0);
  assert.ok(all.candidates.every((c, i, xs) => i === 0 || xs[i - 1].jsd <= c.jsd));
});

test("Jezero searches on the index are ordered by the Mars model v2 score", () => {
  const ref = targetHistogram(targets.jezero);
  const { candidates } = rankTerrain(index.map(measurement), { ...base, target: "jezero", profile: "mobility", maxJsd: 0.3 }, 50, ref);
  assert.ok(candidates.length > 0);
  for (const c of candidates) assert.ok(Math.abs(c.score - marsScore(c.jsd, c.earth.bare)) < 1e-12);
  assert.ok(candidates.every((c, i, xs) => i === 0 || xs[i - 1].score <= c.score));
});
