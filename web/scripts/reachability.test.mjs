import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importTs } from "./load-ts.mjs";

const ap = await importTs("airports.ts");
const text = readFileSync(new URL("../data/earth-airports.json", import.meta.url), "utf8");
const run = JSON.parse(readFileSync(new URL("../../results/search/reachability_v1.json", import.meta.url), "utf8"));
const campaign = JSON.parse(readFileSync(new URL("../data/reachable-twins.json", import.meta.url), "utf8"));

test("R1 passed and the web file covers the 42,405 index windows", () => {
  assert.equal(run.R1.pass, true);
  const m = ap.parseAirports(text);
  assert.equal(m.size, 42405);
  assert.equal([...m.values()].filter(ap.isReachable).length, run.reachable);
});

test("the web file gives every campaign window its published airport and distance", () => {
  const m = ap.parseAirports(text);
  let n = 0;
  for (const d of campaign.destinations) for (const w of [d.val004_twin, d.reachable_twin, ...d.shortlist]) {
    if (!w?.airport || !m.has(w.id)) continue;
    const a = m.get(w.id); n++;
    assert.equal(a.name, w.airport.name); assert.ok(Math.abs(a.km - w.airport.km) <= 0.1);
    assert.equal(a.reachable, w.band === "near");
  }
  assert.ok(n > 150);
});

test("the reachable flag decides, as in campaign v1 (unrounded distance)", () => {
  assert.ok(ap.isReachable({ reachable: true }) && !ap.isReachable({ reachable: false }) && !ap.isReachable(null));
  const m = ap.parseAirports(text);
  assert.ok([...m.values()].every(a => a.reachable ? a.km <= 100.05 : a.km >= 100), "flag agrees with the rounded km");
});
