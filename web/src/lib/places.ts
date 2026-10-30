import type { Candidate } from "./search";

/** Within this distance the settlement's region is a reasonable name for the window centre (windows are 50 km wide). */
export const NEAR_PLACE_KM = 50;

let regionNames: Intl.DisplayNames | null | undefined;
export function countryName(code: string) {
  if (regionNames === undefined) {
    try { regionNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch { regionNames = null; }
  }
  try { return regionNames?.of(code) ?? code; } catch { return code; }
}

/** Human-readable title and subtitle for a candidate. Falls back to the measurement id. */
export function placeLabel(candidate: Pick<Candidate, "id" | "name" | "place">) {
  const p = candidate.place;
  if (!p) return { title: candidate.name, detail: "" };
  const country = countryName(p.countryCode);
  const distance = `${Math.round(p.distanceKm)} km`;
  if (p.distanceKm <= NEAR_PLACE_KM) {
    return { title: [p.admin1, country].filter(Boolean).join(", "), detail: `Near ${p.nearest} · ${distance} from window centre` };
  }
  return { title: `Remote area · ${country}`, detail: `Nearest settlement: ${p.nearest}${p.admin1 ? ", " + p.admin1 : ""} · ${distance} away` };
}
