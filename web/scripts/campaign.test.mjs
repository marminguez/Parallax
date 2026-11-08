import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importTs } from "./load-ts.mjs";

const data = JSON.parse(await readFile("data/reachable-twins.json", "utf8"));
const sites = JSON.parse(await readFile("data/val004-sites.json", "utf8"));
const { windowsOverlap } = await importTs("search.ts");
const { filterShortlist, similarityCost } = await importTs("campaign.ts");

test("every destination follows the frozen rule", () => {
  assert.equal(data.destinations.length, sites.destinations.length);
  assert.equal(data.reachableKm, 100);
  assert.ok(Math.abs(data.q25 - 0.29885) < 1e-9);
  for (const d of data.destinations) {
    const site = sites.destinations.find(s => s.id === d.id);
    assert.ok(Math.abs(d.val004_twin.distance - site.distance) < 5e-4, `${d.id}: VAL-004 twin unchanged`);
    assert.equal(d.val004_twin_reachable, d.val004_twin.airport.km <= 100);
    assert.ok(d.reachable_good_twins <= d.good_twins);
    for (const w of d.shortlist) {
      assert.ok(w.distance <= data.q25, `${d.id}: strong twins only`);
      assert.ok(w.airport.km <= 100, `${d.id}: reachable only`);
      assert.equal(w.band, "near");
    }
    for (let i = 1; i < d.shortlist.length; i++) assert.ok(d.shortlist[i].distance >= d.shortlist[i - 1].distance, `${d.id}: ordered`);
    for (let i = 0; i < d.shortlist.length; i++) for (let j = i + 1; j < d.shortlist.length; j++)
      // 49.9 km: coordinates are stored to 4 decimals (about 11 m), and grid neighbours sit exactly 50 km apart
      assert.ok(!windowsOverlap(d.shortlist[i], d.shortlist[j], 49.9), `${d.id}: shortlist sites do not overlap`);
    assert.ok(d.shortlist.length <= 10);
    if (d.reachable_twin) assert.equal(d.reachable_twin.id, d.shortlist[0].id);
    if (d.val004_twin_reachable) assert.equal(d.reachable_twin.id, d.val004_twin.id, `${d.id}: a reachable VAL-004 twin is its own reachable twin`);
  }
});

test("continent filter only hides, never reorders or adds", () => {
  const d = data.destinations[0];
  const all = filterShortlist(d, null);
  assert.deepEqual(all, d.shortlist);
  for (const c of ["AF", "AS", "EU", "NA", "OC", "SA"]) {
    const sub = filterShortlist(d, c);
    assert.ok(sub.every(w => w.airport.continent === c));
    assert.deepEqual(sub, d.shortlist.filter(w => w.airport.continent === c));
  }
  assert.ok(similarityCost(d) >= 0);
});

test("workable months collapse into ranges, wrapping over the new year", async () => {
  const { workableRanges } = await importTs("campaign.ts");
  const mk = flags => flags.map((w, i) => ({ month: String(i), tmin: 0, tmax: 0, rain: 0, workable: !!w }));
  assert.deepEqual(workableRanges(mk([1,1,1,1,1,1,1,1,1,1,1,1])), [[0, 11]]);
  assert.deepEqual(workableRanges(mk([0,0,0,0,0,0,0,0,0,0,0,0])), []);
  assert.deepEqual(workableRanges(mk([0,0,0,1,1,1,1,1,0,0,0,0])), [[3, 7]]);
  assert.deepEqual(workableRanges(mk([1,1,0,0,0,0,0,0,0,0,1,1])), [[10, 1]]);
  assert.deepEqual(workableRanges(mk([0,1,0,0,1,1,0,0,0,0,0,0])), [[1, 1], [4, 5]]);
});
