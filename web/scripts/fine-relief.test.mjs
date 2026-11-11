import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importTs } from "./load-ts.mjs";

const { fineFor, finePasses, fineVerdict } = await importTs("fineRelief.ts");
const { parseEarthIndex, validateEarthFilters } = await importTs("earthIndex.ts");
const { rankTerrain } = await importTs("search.ts");
const { targetHistogram } = await importTs("targets.ts");

const read = file => readFile(new URL(file, import.meta.url), "utf8");
const fine = JSON.parse(await read("../data/fine-relief.json"));
const run = JSON.parse(await read("../../results/fine_relief/fine_relief_v1.json"));
const index = parseEarthIndex(await read("../data/earth-index.csv"));
const extras = JSON.parse(await read("../data/earth-index-extras.json"));
const rows = index.map(r => ({ id: r.id, lat: r.lat, lon: r.lon, jsd: NaN, landFraction: extras.landFraction[r.id], landStatus: "ELIGIBLE", slopeP95: null, slopeMean: null, distribution: r.distribution, earth: r.earth }));
const base = { title: "t", objective: "", profile: "mobility", mode: "indexed", west: -180, east: 180, south: -90, north: 90, minLandFraction: 0.9, minSlopeP95: 0, maxSlopeP95: 90, desiredSlopeP95: 8, maxJsd: 1, requirements: [], strict: false, limit: 50 };

test("538 windows, 11 references, the published bands", () => {
  assert.equal(Object.keys(fine.windows).length, 538);
  assert.equal(Object.keys(fine.references).length, 11);
  assert.deepEqual(fine.bands, { holds: 0.1, partly: 0.3 });
  assert.equal(fineVerdict(0.1, fine.bands), "holds");
  assert.equal(fineVerdict(0.30001, fine.bands), "breaks");
});

test("the web reads the same distances and verdicts as the run", () => {
  for (const [id, pairs] of Object.entries(run.pairs)) for (const [ref, p] of Object.entries(pairs)) {
    const r = fineFor(fine, id, ref);
    if (p.status !== "measured") { assert.notEqual(r.status, "measured"); continue; }
    assert.equal(r.status, "measured");
    assert.equal(r.distance, p.distance);
    assert.equal(r.verdict, p.verdict, `${id} ${ref}`);
  }
  assert.equal(fineFor(fine, "EARTH-000000", "shackleton").status, "not_selected");
});

test("only measured windows can pass the condition", () => {
  assert.deepEqual(finePasses({ status: "not_selected" }, "holds_or_partly"), { pass: false, missing: true });
  assert.deepEqual(finePasses({ status: "measured", verdict: "partly", distance: 0.2, steepEarth: 0, steepReference: 0 }, "holds"), { pass: false, missing: false });
  assert.deepEqual(validateEarthFilters({ fineRelief: "holds" }), { fineRelief: "holds" });
});

test("Nobile Rim 1 with fine relief that holds returns only windows that hold at 60 m", async () => {
  const ref = targetHistogram(JSON.parse(await read("../data/artemis/nobile-rim-1.json")));
  const r = rankTerrain(rows, { ...base, target: "nobile-rim-1", earthFilters: { fineRelief: "holds" } }, 50, ref, fine);
  const expected = Object.entries(run.pairs).filter(([, p]) => p["nobile-rim-1"].verdict === "holds").map(([id]) => id).sort();
  assert.deepEqual(r.candidates.map(c => c.id).sort(), expected);
  assert.ok(r.candidates.every(c => c.fine.status === "measured" && c.fine.verdict === "holds"));
  assert.ok(r.earthRejected.fineRelief.missing > 40000);
});
