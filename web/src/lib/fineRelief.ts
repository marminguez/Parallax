/**
 * Fine relief for search results v1 (config/search/fine_relief_search_v1.yaml).
 *
 * 60 m slope fingerprints (Copernicus GLO-30) for the 538 windows a team is most likely
 * to see, compared with the 60 m fingerprints of the 11 search references. Any other
 * window is "not measured at 60 m", never estimated.
 */
export type FineWindow = { status: string; steep: number | null; d: Record<string, number | null> };
export type FineData = { version: string; bands: { holds: number; partly: number }; roverSlopeDeg: number; references: Record<string, { sheet: string; steep: number }>; windows: Record<string, FineWindow> };
export type FineVerdict = "holds" | "partly" | "breaks";
export type FineResult =
  | { status: "measured"; distance: number; verdict: FineVerdict; steepEarth: number; steepReference: number }
  | { status: "not_measured" | "not_selected" };

export function fineVerdict(distance: number, bands: FineData["bands"]): FineVerdict {
  return distance <= bands.holds ? "holds" : distance <= bands.partly ? "partly" : "breaks";
}

/** 60 m comparison of one window with one reference; "not_selected" = outside the 538 measured windows. */
export function fineFor(data: FineData, windowId: string, reference: string): FineResult {
  const w = data.windows[windowId];
  if (!w) return { status: "not_selected" };
  const d = w.d[reference];
  const ref = data.references[reference];
  if (w.status !== "measured" || d === null || d === undefined || w.steep === null || !ref) return { status: "not_measured" };
  return { status: "measured", distance: d, verdict: fineVerdict(d, data.bands), steepEarth: w.steep, steepReference: ref.steep };
}

/** The optional condition: only measured windows can pass. */
export function finePasses(result: FineResult, level: "holds" | "holds_or_partly") {
  if (result.status !== "measured") return { pass: false, missing: true };
  const ok = result.verdict === "holds" || (level === "holds_or_partly" && result.verdict === "partly");
  return { pass: ok, missing: false };
}
