import type { Candidate } from "./search";

/** Within this distance the settlement's region is a reasonable name for the window centre (windows are 50 km wide). */
export const NEAR_PLACE_KM = 50;

const regionNames: Partial<Record<"es" | "en", Intl.DisplayNames | null>> = {};
export function countryName(code: string, lang: "es" | "en" = "en") {
  if (regionNames[lang] === undefined) {
    try { regionNames[lang] = new Intl.DisplayNames([lang], { type: "region" }); } catch { regionNames[lang] = null; }
  }
  try { return regionNames[lang]?.of(code) ?? code; } catch { return code; }
}

/** Human-readable title and subtitle for a candidate. Falls back to the measurement id. */
export function placeLabel(candidate: Pick<Candidate, "id" | "name" | "place">, lang: "es" | "en" = "en") {
  const p = candidate.place;
  if (!p) return { title: candidate.name, detail: "" };
  const country = countryName(p.countryCode, lang);
  const distance = `${Math.round(p.distanceKm)} km`;
  const es = lang === "es";
  if (p.distanceKm <= NEAR_PLACE_KM) {
    return { title: [p.admin1, country].filter(Boolean).join(", "), detail: es ? `Cerca de ${p.nearest} · a ${distance} del centro de la ventana` : `Near ${p.nearest} · ${distance} from window centre` };
  }
  const nearest = `${p.nearest}${p.admin1 ? ", " + p.admin1 : ""}`;
  return es
    ? { title: `Zona remota · ${country}`, detail: `Población más cercana: ${nearest} · a ${distance}` }
    : { title: `Remote area · ${country}`, detail: `Nearest settlement: ${nearest} · ${distance} away` };
}
