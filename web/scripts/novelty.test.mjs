import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile("data/novelty.json", "utf8"));
const sites = JSON.parse(await readFile("data/val004-sites.json", "utf8"));

test("every destination has a twin with a novelty verdict", () => {
  assert.equal(data.radiusKm, 100);
  for (const d of sites.destinations) {
    const twin = data.destinations[d.id]?.twin;
    assert.ok(twin, `${d.id}: twin`);
    const s = data.sites[twin];
    assert.ok(["new", "known", "undecided"].includes(s.status), `${d.id}: status`);
    assert.equal(s.status === "known", s.nearest_known.km <= 100, `${d.id}: verdict follows the 100 km rule`);
  }
  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);
  assert.equal(total, sites.destinations.length);
});
