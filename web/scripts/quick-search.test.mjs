import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./load-ts.mjs";

const { CATEGORIES, CATEGORY_ORDER, DESTINATIONS, likeness, fitFor } = await importTs("missionProfiles.ts");
const { validateEarthFilters } = await importTs("earthIndex.ts");
const { profiles } = await importTs("search.ts");
const { isPlanetaryTarget } = await importTs("targets.ts");

test("six Moon Base categories plus \"other\", each a valid profile with valid conditions", () => {
  assert.deepEqual(CATEGORY_ORDER, ["ltv", "scouting", "isru", "habitation", "logistics", "techdemos", "other"]);
  assert.deepEqual(CATEGORIES.other.filters, {}, "other starts with no conditions: the team picks them");
  for (const k of CATEGORY_ORDER) {
    const c = CATEGORIES[k];
    assert.ok(profiles[c.profile], k);
    assert.deepEqual(validateEarthFilters(c.filters), c.filters, k);
    assert.ok(c.noun.es && c.noun.en && c.hint.es && c.hint.en);
  }
});

test("every destination is a search reference; upcoming missions come first", () => {
  for (const g of DESTINATIONS) for (const d of g.items) assert.ok(isPlanetaryTarget(d.id), d.id);
  assert.deepEqual(DESTINATIONS[0].items.map(d => d.id), ["mons-mouton", "shackleton"]);
});

test("likeness words follow the 0.10 / 0.20 / 0.30 cuts; presentation only", () => {
  assert.equal(likeness(0.1, "es"), "Muy parecido");
  assert.equal(likeness(0.153, "es"), "Parecido");
  assert.equal(likeness(0.3, "en"), "Somewhat similar");
  assert.equal(likeness(0.31, "en"), "Less similar");
  assert.equal(likeness(null, "es"), "Sin comparar");
});

test("fit lists come from measured dimensions only, three items at most", () => {
  const earth = { bare: 0.89, vegetated: 0.1, access: "rural", ice: false, glim: { pa: 0.72, pb: 0.23, sm: 0.05 }, tsMin: 2.9, tsMax: 39.3, soil: { validShare: 1, sand: 0.63, silt: 0.21, clay: 0.17, coarse: 0.25, texture: "sandy_loam" } };
  const fine = { status: "measured", verdict: "partly", distance: 0.235, steepEarth: 0.52, steepReference: 0.35 };
  const f = fitFor(earth, "mons-mouton", fine, "ltv", "en");
  assert.deepEqual(f.good, ["bare ground (89 %)", "partly similar fine relief", "sandy loam soil"]);
  assert.deepEqual(f.bad, ["ground ice", "lunar cold"]);
  assert.deepEqual(fitFor(undefined, "mons-mouton", undefined, "ltv", "es"), { good: [], bad: [] });
  const scout = fitFor(earth, "mons-mouton", fine, "scouting", "es");
  assert.ok(!scout.good.some(x => x.includes("franco")), "soil texture only for categories that drive or dig");
});
