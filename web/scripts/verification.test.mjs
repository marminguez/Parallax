import assert from "node:assert/strict";
import test from "node:test";
import { importTs } from "./load-ts.mjs";

const v = await importTs("verification.ts");
const now = new Date("2026-11-12T10:00:00Z");
const draft = { by: " Ana Ruiz, Parks Service ", date: "2026-11-10", source: "Permit 123/2026", note: "" };

test("a draft needs who, a real past date and a source", () => {
  assert.deepEqual(v.draftProblems(draft, "2026-11-12"), []);
  assert.deepEqual(v.draftProblems({ ...draft, by: " " }, "2026-11-12"), ["by"]);
  assert.deepEqual(v.draftProblems({ ...draft, source: "" }, "2026-11-12"), ["source"]);
  assert.deepEqual(v.draftProblems({ ...draft, date: "2026-02-30" }, "2026-11-12"), ["date"]);
  assert.deepEqual(v.draftProblems({ ...draft, date: "10/11/2026" }, "2026-11-12"), ["date"]);
  assert.deepEqual(v.draftProblems({ ...draft, date: "2026-11-13" }, "2026-11-12"), ["future"]);
  assert.deepEqual(v.draftProblems({ ...draft, note: "x".repeat(1001) }, "2026-11-12"), ["long"]);
});

test("recording replaces the same evidence for the same window and trims", () => {
  let log = v.record([], "EXP-1", "access_logistics", draft, now);
  assert.equal(log.length, 1);
  assert.equal(log[0].by, "Ana Ruiz, Parks Service");
  assert.equal("note" in log[0], false);
  assert.equal(log[0].recordedAt, "2026-11-12T10:00:00.000Z");
  log = v.record(log, "EXP-1", "access_logistics", { ...draft, source: "Permit 124/2026" }, now);
  assert.equal(log.length, 1);
  assert.equal(log[0].source, "Permit 124/2026");
  log = v.record(log, "EXP-2", "access_logistics", draft, now);
  assert.equal(log.length, 2);
  assert.throws(() => v.record(log, "EXP-1", "x", { ...draft, by: "" }, now));
  assert.equal(v.remove(log, "EXP-1", "access_logistics").length, 1);
});

test("status is complete only when every required key is verified", () => {
  let log = v.record([], "EXP-1", "a", draft, now);
  let s = v.statusFor(log, "EXP-1", ["a", "b"]);
  assert.deepEqual(s.pending, ["b"]);
  assert.equal(s.complete, false);
  log = v.record(log, "EXP-1", "b", draft, now);
  s = v.statusFor(log, "EXP-1", ["a", "b"]);
  assert.equal(s.complete, true);
  assert.equal(v.statusFor(log, "EXP-2", ["a"]).complete, false, "never carries to another window");
  assert.equal(v.statusFor(log, "EXP-1", []).complete, false, "nothing required: nothing to verify");
  assert.deepEqual(v.forCandidates(log, ["EXP-9"]), []);
  assert.equal(v.forCandidates(log, ["EXP-1"]).length, 2);
});

test("storage input is sanitized", () => {
  const good = v.record([], "EXP-1", "a", draft, now)[0];
  assert.deepEqual(v.sanitize([good, { candidateId: 1 }, null, "x", { ...good, note: 5 }]), [good]);
  assert.deepEqual(v.sanitize({}), []);
});
