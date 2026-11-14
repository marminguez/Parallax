import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importTs } from "./load-ts.mjs";

const a = await importTs("access.ts");
const data = JSON.parse(await readFile(new URL("../data/access.json", import.meta.url), "utf8"));
const twins = JSON.parse(await readFile(new URL("../data/reachable-twins.json", import.meta.url), "utf8"));

test("every twin and reachable twin country has researched notes", () => {
  for (const d of twins.destinations) for (const w of [d.val004_twin, d.reachable_twin].filter(Boolean)) {
    assert.ok(data.countries[w.place.countryCode], `${d.id}: ${w.place.countryCode}`);
  }
});

test("every site note points to a real twin window and cites a source", () => {
  const ids = new Set(twins.destinations.flatMap(d => [d.val004_twin?.id, d.reachable_twin?.id]));
  for (const [id, s] of Object.entries(data.sites)) { assert.ok(ids.has(id), id); assert.ok(s.sources.length > 0, id); }
});

test("a documented correction wins over the dataset", () => {
  assert.deepEqual(a.entry(data, "US", "BO"), { kind: "free", days: 90, corrected: true, check: false });
  assert.equal(a.entry(data, "US", "NA").kind, "voa");
  assert.equal(a.entry(data, "ES", "NA").check, a.entry(data, "ES", "NA").kind === "free");
});

test("the team moves at its hardest passport, and own country counts as national", () => {
  const t = a.teamEntry(data, ["ES", "AF", "CN"], "CN");
  assert.equal(t.byPassport.find(x => x.passport === "CN").entry.kind, "self");
  assert.equal(t.hardest, "vr");
  assert.equal(t.groups[0].kind, "vr");
});

test("site notes raise the country risk and flag the team's passports", () => {
  assert.equal(a.riskAt(data, "CN", "EARTH-133851"), "avoid");
  const n = a.notesFor(data, "PK", "EARTH-143309", ["ES", "US"], "es");
  assert.deepEqual(n.siteHitsTeam, ["US"]);
  assert.equal(a.notesFor(data, "IR", null, ["US", "ES"], "en").forTeam.length, 1);
});

test("nationality lists are cleaned", () => {
  assert.deepEqual(a.cleanPassports(data, ["es", "ES", "XX", "us", "1"]), ["ES", "US"]);
});

test("region notes reach every result in that region, not only the twins", () => {
  assert.equal(a.riskAt(data, "CN", "EARTH-000000", "Tibet Autonomous Region"), "reconsider");
  assert.equal(a.riskAt(data, "CN", null, "Yunnan"), "unknown");
  assert.ok(a.notesFor(data, "CN", null, [], "es", "Tibet Autonomous Region").region.includes("Tibet Travel Permit"));
});
