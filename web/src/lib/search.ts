import type { Airport } from "./airports";
import { planetaryTargets, isPlanetaryTarget, jensenShannonDistance, type FrozenTarget, type PlanetaryTargetId } from "./targets";
import { failedFilter, marsScore, validateEarthFilters, type EarthDims, type EarthFilters, type EarthRejections } from "./earthIndex";
import { fineFor, finePasses, type FineData, type FineResult } from "./fineRelief";

export const profiles = {
  mobility: { label: "Rover mobility / wheels", evidence: ["bearing_strength", "permits"], capability: "mobility" },
  navigation: { label: "Navigation / cameras / LiDAR", evidence: ["lighting", "permits"], capability: "navigation" },
  eva: { label: "EVA / field sampling operations", evidence: ["permits"], capability: "eva" },
  drilling: { label: "Drilling / sampling", evidence: ["bearing_strength", "mineralogy", "permits"], capability: "drilling" },
  dust: { label: "Materials / dust abrasion", evidence: ["dust"], capability: "dust" },
  thermal: { label: "Materials / thermal vacuum", evidence: ["thermal_range", "vacuum"], capability: "thermal" },
  isru: { label: "ISRU / excavation", evidence: ["mineralogy", "bearing_strength", "permits"], capability: "excavation" },
} as const;
export type Profile = keyof typeof profiles;
export const evidenceLabels: Record<string, string> = {
  bearing_strength: "Soil strength, particle size, slip and sinkage",
  lighting: "Required illumination and obstacle-scale resolution",
  permits: "Access permission and campaign logistics",
  mineralogy: "Mineralogy / composition and sampling depth",
  dust: "Dust composition, angularity, abrasion and exposure protocol",
  thermal_range: "Temperature range, cycling rate and specimen compatibility",
  vacuum: "Required pressure and chamber compatibility",
  dry_surface: "Surface moisture and vegetation",
  hardware: "Hardware size, mass, loading and specimen compatibility",
};
export const envelopeFields = {
  temperatureMinC: { label: "Minimum test temperature (°C)", min: -273.15, max: 2000, evidence: "thermal_range" },
  temperatureMaxC: { label: "Maximum test temperature (°C)", min: -273.15, max: 2000, evidence: "thermal_range" },
  pressurePa: { label: "Required pressure (Pa)", min: 0, max: 2000000, evidence: "vacuum" },
  particleSizeMaxUm: { label: "Maximum particle diameter (µm)", min: 0, max: 10000000, evidence: "dust" },
  drillingDepthM: { label: "Required drilling depth (m)", min: 0, max: 1000, evidence: "mineralogy" },
  hardwareMassKg: { label: "Hardware mass (kg)", min: 0, max: 1000000, evidence: "hardware" },
};
export type TestEnvelope = Partial<Record<keyof typeof envelopeFields, number>>;
export type LandCoverConstraints = { minBareFraction?: number; maxTreeFraction?: number; maxBuiltFraction?: number };
export type SearchRequest = {
  title: string;
  objective: string;
  profile: Profile;
  target: PlanetaryTargetId | "terrain";
  mode: "indexed" | "live" | "facilities";
  west: number; east: number; south: number; north: number;
  minLandFraction: number;
  minSlopeP95: number; maxSlopeP95: number; desiredSlopeP95: number;
  maxJsd: number;
  requirements: string[];
  strict: boolean;
  limit: number;
  testEnvelope?: TestEnvelope;
  landCoverConstraints?: LandCoverConstraints;
  /** Earth dimensions index only (earth_dimensions_v1): filters that remove windows, never reorder them. */
  earthFilters?: EarthFilters;
};
export type LandCover = {
  status: "available" | "partial" | "unavailable" | "error";
  dataset: string; year: number; version: string; source: string; attribution: string;
  nativeResolutionM: number; analysisResolutionM: number; windowKm: number;
  method: string; message: string; coverageFraction: number; classifiedSamples: number; totalSamples: number;
  sourceTiles: { name: string; bytes: number; sha256?: string; url?: string }[];
  classes: { code: number; label: string; samples: number; fractionOfClassified: number; fractionOfWindow: number }[];
};
/** Display-only nearest-settlement label. Joined after ranking; never used for matching. */
export type Place = { nearest: string; admin1: string; countryCode: string; distanceKm: number };
/**
 * Post-ranking spatial grouping. Windows whose 50 × 50 km footprints overlap the
 * window of a better-ranked representative join that representative's site.
 * The raw ranking order is preserved; grouping only adds this annotation.
 */
export type SiteGroup = { rank: number; representativeId: string; isRepresentative: boolean; overlapping: string[] };
export type Candidate = {
  id: string; name: string; lat: number; lon: number;
  place?: Place;
  /** Nearest airport with scheduled flights (reachability v1). Display only; never used for matching. */
  airport?: Airport;
  site?: SiteGroup;
  jsd: number | null; landFraction: number | null;
  slopeP95: number | null; slopeMean: number | null;
  status: "terrain-match" | "verification-required" | "documented-capability";
  explanation: string[];
  missingEvidence: string[];
  source: string;
  landCover?: LandCover;
  /** Earth-side dimensions from the earth dimensions index (earth_dimensions_v1). */
  earth?: EarthDims;
  /** Slope histogram of the window, when the index stores it. */
  distribution?: number[];
  /** 60 m relief against the selected reference (fine_relief_search_v1). */
  fine?: FineResult;
  /** Mars model v2 score (VAL-003) used to order Jezero searches on the earth index; null when bare ground is missing. */
  score?: number | null;
  measurementProvenance?: { sourceTiles: string[]; waterMaskTile: string; analysisGrid: Record<string, unknown> };
};
export type SearchResult = {
  runId: string; createdAt: string; request: SearchRequest;
  landCoverRejected?: { missing: number; outside: number };
  earthRejected?: EarthRejections;
  /** Which measured index answered: the EXP-001B pilot or the earth dimensions index. */
  index?: "pilot" | "earth";
  candidates: Candidate[];
  independentSites?: number;
  placeNames?: { source: string; attribution: string; method: string };
  /** Full frozen reference used for ranking, included so exports are self-contained. */
  planetaryReference?: FrozenTarget & { id: PlanetaryTargetId };
  evaluated: number; rejected: number; provisional: number; errors: { id: string; message: string }[];
  provenance: { dataset: string; version: string; footprintKm: number | null; resolutionM: number | null; scope: string; ranking: string };
};
export function validateRequest(input: unknown): SearchRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected an experiment object.");
  const r = input as Record<string, unknown>;
  if (typeof r.profile !== "string" || !Object.hasOwn(profiles, r.profile)) throw new Error("Unknown experiment type.");
  if (typeof r.target !== "string" || !(r.target === "terrain" || isPlanetaryTarget(r.target))) throw new Error("Unknown target.");
  if (!["indexed", "live", "facilities"].includes(String(r.mode))) throw new Error("Unknown search mode.");
  for (const [key, max] of [["title", 160], ["objective", 3000]] as const) {
    if (typeof r[key] !== "string" || (r[key] as string).length > max) throw new Error("Invalid " + key);
  }
  if (!(r.title as string).trim()) throw new Error("Give this experiment a name.");
  const ranges: Record<string, [number, number]> = {
    west: [-180, 180], east: [-180, 180], south: [-90, 90], north: [-90, 90],
    minLandFraction: [0.9, 1], minSlopeP95: [0, 90], maxSlopeP95: [0, 90],
    desiredSlopeP95: [0, 90], maxJsd: [0, 1], limit: [1, 50],
  };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (typeof r[key] !== "number" || !Number.isFinite(r[key]) || (r[key] as number) < min || (r[key] as number) > max) throw new Error("Invalid " + key);
  }
  if ((r.west as number) >= (r.east as number) || (r.south as number) >= (r.north as number)) throw new Error("Bounds must have west < east and south < north. Split antimeridian searches.");
  if ((r.minSlopeP95 as number) > (r.maxSlopeP95 as number)) throw new Error("Minimum slope exceeds maximum.");
  if (!Number.isInteger(r.limit)) throw new Error("Result limit must be an integer.");
  if (typeof r.strict !== "boolean" || !Array.isArray(r.requirements) || r.requirements.some(k => typeof k !== "string" || !Object.hasOwn(evidenceLabels, k))) throw new Error("Invalid required evidence.");
  if (r.mode === "live" && ((r.north as number) - (r.south as number) > 10 || (r.east as number) - (r.west as number) > 10)) throw new Error("Live search is limited to a 10° × 10° region per request.");
  if (r.mode === "live" && ((r.south as number) < -55 || (r.north as number) > 59)) throw new Error("Live terrain search requires SRTM coverage between 55° S and 59° N.");
  if (r.mode !== "facilities" && ["dust", "thermal"].includes(String(r.profile))) throw new Error("Dust and thermal qualification require controlled facilities, not a terrain-only search.");
  const cover = r.landCoverConstraints ?? {};
  if (!cover || typeof cover !== "object" || Array.isArray(cover)) throw new Error("Invalid land-cover constraints.");
  for (const [key, value] of Object.entries(cover)) {
    if (!["minBareFraction", "maxTreeFraction", "maxBuiltFraction"].includes(key) || typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new Error("Land-cover fractions must be between 0 and 1.");
  }
  if (Object.keys(cover).length && r.mode !== "live") throw new Error("Land-cover filters require live search with local WorldCover data.");
  const earthFilters = validateEarthFilters(r.earthFilters);
  if (Object.keys(earthFilters).length && !(r.mode === "indexed" && r.target !== "terrain")) throw new Error("Terrain conditions need the measured index and a planetary reference.");
  const envelope = r.testEnvelope ?? {};
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new Error("Invalid test envelope.");
  const required = [...r.requirements];
  for (const [key, value] of Object.entries(envelope)) {
    if (!Object.hasOwn(envelopeFields, key)) throw new Error("Unknown test envelope parameter.");
    const field = envelopeFields[key as keyof typeof envelopeFields];
    if (typeof value !== "number" || !Number.isFinite(value) || value < field.min || value > field.max) throw new Error("Invalid " + field.label);
    required.push(field.evidence);
  }
  const temp = envelope as TestEnvelope;
  if (temp.temperatureMinC !== undefined && temp.temperatureMaxC !== undefined && temp.temperatureMinC > temp.temperatureMaxC) throw new Error("Temperature minimum exceeds maximum.");
  return { ...r, title: (r.title as string).trim(), testEnvelope: envelope, landCoverConstraints: cover, earthFilters, requirements: [...new Set(required)] } as SearchRequest;
}
export type Measurement = { id: string; lat: number; lon: number; jsd: number; landFraction: number; landStatus: string;
  /** Regional slope statistics. Null on the earth dimensions index, which stores only the histogram. */
  slopeP95: number | null; slopeMean: number | null; earth?: EarthDims; sourceTiles?: string[]; waterMaskTile?: string; analysisGrid?: Record<string, unknown>; landCover?: LandCover; place?: Place | null; airport?: Airport | null;
  /** Normalised 1 km slope histogram (8 frozen bins). Needed to rank against targets other than the precomputed Jezero distance. */
  distribution?: number[] };

const EARTH_RADIUS_KM = 6371.0088;
/**
 * True when two square analysis windows of side `windowKm`, centred on each
 * point, overlap. Uses a local equirectangular offset between centres, which is
 * accurate to well under 1% at these separations within SRTM latitudes. Touching
 * edges do not count as overlap.
 */
export function windowsOverlap(a: { lat: number; lon: number }, b: { lat: number; lon: number }, windowKm: number) {
  const rad = Math.PI / 180;
  let dLon = b.lon - a.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const dy = (b.lat - a.lat) * rad * EARTH_RADIUS_KM;
  const dx = dLon * rad * EARTH_RADIUS_KM * Math.cos(((a.lat + b.lat) / 2) * rad);
  return Math.abs(dx) < windowKm && Math.abs(dy) < windowKm;
}
/**
 * Greedy non-maximum suppression over an already ranked list: each window joins
 * the best-ranked representative it overlaps, otherwise it starts a new site.
 * Membership is not transitive. Mutates `candidates` by setting `site`; returns
 * the number of independent sites. Ranking order is unchanged.
 */
export function groupOverlappingWindows(candidates: Candidate[], windowKm: number) {
  const representatives: Candidate[] = [];
  for (const candidate of candidates) {
    const representative = representatives.find(r => windowsOverlap(r, candidate, windowKm));
    if (representative) {
      representative.site!.overlapping.push(candidate.id);
      candidate.site = { rank: representative.site!.rank, representativeId: representative.id, isRepresentative: false, overlapping: [] };
    } else {
      candidate.site = { rank: representatives.length + 1, representativeId: candidate.id, isRepresentative: true, overlapping: [] };
      representatives.push(candidate);
    }
  }
  return representatives.length;
}
/**
 * Distance from a window to the requested planetary target. The frozen index stores
 * its Jezero distance; every other target (and live rows) uses the window histogram.
 */
function targetDistance(row: Measurement, request: SearchRequest, referenceHistogram?: number[]) {
  if (request.target === "terrain") return null;
  if (request.target === "jezero" && Number.isFinite(row.jsd)) return row.jsd;
  if (!referenceHistogram || !Array.isArray(row.distribution) || row.distribution.length !== referenceHistogram.length) return NaN;
  try { return jensenShannonDistance(referenceHistogram, row.distribution); } catch { return NaN; }
}
export function rankTerrain(rows: Measurement[], request: SearchRequest, windowKm = 50, referenceHistogram?: number[], fineData?: FineData) {
  let rejected = 0;
  let provisional = 0;
  const candidates: Candidate[] = [];
  const landCoverRejected = { missing: 0, outside: 0 };
  const earthRejected: EarthRejections = {};
  const coverFilters = request.landCoverConstraints ?? {};
  const filterCover = Object.keys(coverFilters).length > 0;
  const earthFilters = request.earthFilters ?? {};
  const filterEarth = Object.keys(earthFilters).length > 0;
  // The earth index has no regional P95: a slope limit cannot be checked there, so it never passes.
  const slopeLimited = request.minSlopeP95 > 0 || request.maxSlopeP95 < 90;
  const required = [...new Set([...profiles[request.profile].evidence, ...request.requirements])];
  const targetName = request.target === "terrain" ? "" : planetaryTargets[request.target].short;
  for (const row of rows) {
    const distance = targetDistance(row, request, referenceHistogram);
    const hasSlope = row.slopeP95 !== null && row.slopeMean !== null;
    if (![row.lat, row.lon, row.landFraction].every(Number.isFinite) ||
        (hasSlope ? ![row.slopeP95, row.slopeMean].every(Number.isFinite) || row.slopeP95! < request.minSlopeP95 || row.slopeP95! > request.maxSlopeP95 : slopeLimited || request.target === "terrain") ||
        row.landStatus !== "ELIGIBLE" || row.lat < request.south || row.lat > request.north || row.lon < request.west || row.lon > request.east ||
        row.landFraction < request.minLandFraction ||
        (distance !== null && (!Number.isFinite(distance) || distance > request.maxJsd))) { rejected++; continue; }
    if (filterEarth) {
      const failed = row.earth ? failedFilter(row.earth, earthFilters, request.target as PlanetaryTargetId) : { key: Object.keys(earthFilters)[0] as keyof EarthRejections, missing: true };
      if (failed) {
        rejected++;
        const slot = earthRejected[failed.key] ??= { outside: 0, missing: 0 };
        if (failed.missing) slot.missing++; else slot.outside++;
        continue;
      }
    }
    const fine = fineData && row.earth && request.target !== "terrain" ? fineFor(fineData, row.id, request.target) : undefined;
    if (earthFilters.fineRelief) {
      const r = fine ? finePasses(fine, earthFilters.fineRelief) : { pass: false, missing: true };
      if (!r.pass) {
        rejected++;
        const slot = earthRejected.fineRelief ??= { outside: 0, missing: 0 };
        if (r.missing) slot.missing++; else slot.outside++;
        continue;
      }
    }
    if (filterCover) {
      const cover = row.landCover;
      // Require the full window: percentages among a partial subset cannot pass.
      const wanted = [10, 50, 60].map(code => Array.isArray(cover?.classes) ? cover.classes.filter(c => c?.code === code) : undefined);
      if (!cover || cover.status !== "available" || cover.coverageFraction !== 1 || !Number.isInteger(cover.totalSamples) || cover.totalSamples <= 0 ||
          cover.classifiedSamples !== cover.totalSamples || wanted.some(entries => entries?.length !== 1 || !Number.isFinite(entries[0].fractionOfWindow) || entries[0].fractionOfWindow < 0 || entries[0].fractionOfWindow > 1)) {
        rejected++; landCoverRejected.missing++; continue;
      }
      const [trees, built, bare] = wanted.map(entries => entries![0].fractionOfWindow);
      if ((coverFilters.minBareFraction !== undefined && bare < coverFilters.minBareFraction) ||
          (coverFilters.maxTreeFraction !== undefined && trees > coverFilters.maxTreeFraction) ||
          (coverFilters.maxBuiltFraction !== undefined && built > coverFilters.maxBuiltFraction)) {
        rejected++; landCoverRejected.outside++; continue;
      }
    }
    // All critical criteria are recorded. Missing evidence never becomes a pass.
    if (required.length) provisional++;
    if (request.strict && required.length) { rejected++; continue; }
    // Mars model v2 (VAL-003) orders Jezero searches on the earth index; without bare ground the window keeps model v1.
    const score = row.earth && request.target === "jezero" && distance !== null ? marsScore(distance, row.earth.bare) : undefined;
    candidates.push({
      id: row.id, name: row.id, lat: row.lat, lon: row.lon,
      jsd: distance,
      landFraction: row.landFraction, slopeP95: row.slopeP95, slopeMean: row.slopeMean,
      status: required.length ? "verification-required" : "terrain-match",
      ...(row.landCover ? { landCover: row.landCover } : {}),
      ...(row.earth ? { earth: row.earth } : {}),
      ...(row.earth && row.distribution ? { distribution: row.distribution } : {}),
      ...(score !== undefined ? { score } : {}),
      ...(fine ? { fine } : {}),
      ...(row.place ? { place: row.place } : {}),
      ...(row.airport ? { airport: row.airport } : {}),
      explanation: [
        ...(filterCover ? ["Historical WorldCover 2021 sampled proportions satisfy all requested cover limits with complete coverage."] : []),
        ...(filterEarth ? ["Measured Earth dimensions satisfy every requested terrain condition."] : []),
        "Land fraction " + (100 * row.landFraction).toFixed(2) + "% meets threshold.",
        ...(hasSlope ? ["Regional slope P95 " + row.slopeP95!.toFixed(2) + "° is inside requested interval."] : []),
        distance !== null ? `${targetName} slope-distribution distance ${distance.toFixed(4)} meets threshold.` : "Ranked by absolute difference from requested regional P95 slope.",
        ...(score !== undefined ? [score === null ? "No bare-ground value: ordered by slope distance only (model v1)." : `Mars model v2 score ${score.toFixed(4)} (0.5 × slope distance + 0.5 × (1 − bare ground)).`] : []),
      ],
      missingEvidence: required.map(k => evidenceLabels[k]), source: row.earth ? "SRTMGL30 + MOD44W · VAL-004 earth windows · earth dimensions v1" : "SRTMGL30 + MOD44W · EXP-001B",
      ...(row.sourceTiles && row.waterMaskTile && row.analysisGrid ? { measurementProvenance: { sourceTiles: row.sourceTiles, waterMaskTile: row.waterMaskTile, analysisGrid: row.analysisGrid } } : {}),
    });
  }
  const key = (c: Candidate) => c.score ?? c.jsd!;
  candidates.sort((a, b) => {
    const delta = request.target !== "terrain" ? key(a) - key(b) : Math.abs(a.slopeP95! - request.desiredSlopeP95) - Math.abs(b.slopeP95! - request.desiredSlopeP95);
    return delta || a.id.localeCompare(b.id);
  });
  const returned = candidates.slice(0, request.limit);
  // Grouping runs after ranking and the result limit, on returned windows only.
  const independentSites = groupOverlappingWindows(returned, windowKm);
  return { candidates: returned, rejected, provisional, landCoverRejected, earthRejected, independentSites };
}
