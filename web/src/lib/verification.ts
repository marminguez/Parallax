/**
 * Team verification log. Parallax cannot check permits, logistics or field measurements; the team
 * running the campaign can. A verification records who checked one piece of missing evidence for one
 * Earth window, when, and against what source. It is declared by the team, not certified by Parallax,
 * and it never changes the ranking: only the candidate's status.
 *
 * Verifications are kept per window id and evidence key, so a site verified once stays verified in
 * later searches that return the same window. They live in this browser and travel in the export.
 */
export type Verification = {
  candidateId: string;
  evidence: string;          // evidence key (profiles[...].evidence or a requested requirement)
  by: string;                // person or organisation who checked it
  date: string;              // YYYY-MM-DD, when it was checked
  source: string;            // permit number, document, link or contact
  note?: string;
  recordedAt: string;        // ISO timestamp, when it was entered here
};

export type VerificationDraft = Pick<Verification, "by" | "date" | "source"> & { note?: string };
export type VerificationStatus = { required: string[]; verified: Verification[]; pending: string[]; complete: boolean };

export const VERIFICATION_STORAGE_KEY = "parallax-verifications-v1";
export const VERIFICATION_STATEMENT = "Declared by the campaign team, not certified by Parallax. Verifications never change the ranking.";
const LIMITS = { by: 120, source: 500, note: 1000 };

const pad = (n: number) => String(n).padStart(2, "0");
export const todayIso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Problems with a draft, as keys the page translates; empty when it can be saved. */
export function draftProblems(d: VerificationDraft, today = todayIso()): ("by" | "date" | "future" | "source" | "long")[] {
  const out: ("by" | "date" | "future" | "source" | "long")[] = [];
  if (!d.by.trim()) out.push("by");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || Number.isNaN(Date.parse(d.date + "T00:00:00Z")) || new Date(d.date + "T00:00:00Z").toISOString().slice(0, 10) !== d.date) out.push("date");
  else if (d.date > today) out.push("future");
  if (!d.source.trim()) out.push("source");
  if (d.by.length > LIMITS.by || d.source.length > LIMITS.source || (d.note ?? "").length > LIMITS.note) out.push("long");
  return out;
}

/** Add or replace the verification of one evidence key for one window. */
export function record(log: Verification[], candidateId: string, evidence: string, d: VerificationDraft, now = new Date()): Verification[] {
  if (draftProblems(d, todayIso(now)).length) throw new Error("Incomplete verification");
  const v: Verification = {
    candidateId, evidence, by: d.by.trim(), date: d.date, source: d.source.trim(),
    ...(d.note?.trim() ? { note: d.note.trim() } : {}), recordedAt: now.toISOString(),
  };
  return [...log.filter(x => !(x.candidateId === candidateId && x.evidence === evidence)), v];
}

export function remove(log: Verification[], candidateId: string, evidence: string): Verification[] {
  return log.filter(x => !(x.candidateId === candidateId && x.evidence === evidence));
}

/** Which of the required evidence keys are verified for this window. */
export function statusFor(log: Verification[], candidateId: string, required: string[]): VerificationStatus {
  const verified = required.map(k => log.find(v => v.candidateId === candidateId && v.evidence === k)).filter((v): v is Verification => !!v);
  const done = new Set(verified.map(v => v.evidence));
  const pending = required.filter(k => !done.has(k));
  return { required, verified, pending, complete: required.length > 0 && pending.length === 0 };
}

/** The verifications that concern a set of windows, for the export. */
export function forCandidates(log: Verification[], ids: string[]): Verification[] {
  const set = new Set(ids);
  return log.filter(v => set.has(v.candidateId));
}

/** Keep only well-formed entries from storage or an import. */
export function sanitize(input: unknown): Verification[] {
  if (!Array.isArray(input)) return [];
  return input.filter((v): v is Verification => !!v && typeof v === "object"
    && ["candidateId", "evidence", "by", "date", "source", "recordedAt"].every(k => typeof (v as Record<string, unknown>)[k] === "string")
    && ((v as Verification).note === undefined || typeof (v as Verification).note === "string"));
}

export function loadLog(): Verification[] {
  try { return sanitize(JSON.parse(localStorage.getItem(VERIFICATION_STORAGE_KEY) || "[]")); } catch { return []; }
}

export function saveLog(log: Verification[]): boolean {
  try { localStorage.setItem(VERIFICATION_STORAGE_KEY, JSON.stringify(log)); return true; } catch { return false; }
}
