import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importTs } from "./load-ts.mjs";

const { UPCOMING, REHEARSE } = await importTs("upcomingMissions.ts");
const sites = JSON.parse(await readFile(new URL("../data/val004-sites.json", import.meta.url), "utf8"));

test("every upcoming mission names a published twin sheet or none, a source and known tests", () => {
  const ids = new Set(sites.destinations.map(d => d.id));
  for (const m of UPCOMING) {
    if (m.site !== null) assert.ok(ids.has(m.site), m.id);
    assert.match(m.source, /^https:\/\//);
    assert.ok(m.rehearse.length > 0);
    for (const r of m.rehearse) assert.ok(REHEARSE.es[r] && REHEARSE.en[r], r);
    for (const k of ["maker", "when", "region", "payload"]) assert.ok(m[k].es && m[k].en, `${m.id}.${k}`);
  }
  assert.deepEqual(UPCOMING.filter(m => m.site).map(m => [m.id, m.site]), [["griffin-1", "mons-mouton"], ["endurance", "shackleton"]]);
});
