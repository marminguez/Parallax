import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./load-ts.mjs";

const { SEARCH_T, PROFILE_LABELS, EVIDENCE_LABELS, ENVELOPE_LABELS, TARGET_LABELS } = await importTs("searchCopy.ts");
const { profiles, evidenceLabels, envelopeFields } = await importTs("search.ts");
const { planetaryTargets } = await importTs("targets.ts");

test("Spanish and English cover the same keys", () => {
  assert.deepEqual(Object.keys(SEARCH_T.es).sort(), Object.keys(SEARCH_T.en).sort());
  for (const lang of ["es", "en"]) {
    assert.deepEqual(Object.keys(PROFILE_LABELS[lang]).sort(), Object.keys(profiles).sort());
    assert.deepEqual(Object.keys(EVIDENCE_LABELS[lang]).sort(), Object.keys(evidenceLabels).sort());
    assert.deepEqual(Object.keys(ENVELOPE_LABELS[lang]).sort(), Object.keys(envelopeFields).sort());
    assert.deepEqual(Object.keys(TARGET_LABELS[lang]).sort(), Object.keys(planetaryTargets).sort());
  }
});

test("English copy matches what the API itself says", () => {
  for (const [k, v] of Object.entries(evidenceLabels)) assert.equal(EVIDENCE_LABELS.en[k], v);
  for (const [k, p] of Object.entries(profiles)) assert.equal(PROFILE_LABELS.en[k], p.label);
  for (const [k, f] of Object.entries(envelopeFields)) assert.equal(ENVELOPE_LABELS.en[k], f.label);
});
