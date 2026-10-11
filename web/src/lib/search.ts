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
  target: "jezero" | "terrain";
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
};
export type LandCover = {
  status: "available" | "partial" | "unavailable" | "error";
  dataset: string; year: number; version: string; source: string; attribution: string;
  nativeResolutionM: number; analysisResolutionM: number; windowKm: number;
  method: string; message: string; coverageFraction: number; classifiedSamples: number; totalSamples: number;
  sourceTiles: { name: string; bytes: number; sha256?: string; url?: string }[];
  classes: { code: number; label: string; samples: number; fractionOfClassified: number; fractionOfWindow: number }[];
};
export type Candidate = {
  id: string; name: string; lat: number; lon: number;
  jsd: number | null; landFraction: number | null;
  slopeP95: number | null; slopeMean: number | null;
  status: "terrain-match" | "verification-required" | "documented-capability";
  explanation: string[];
  missingEvidence: string[];
  source: string;
  landCover?: LandCover;
  measurementProvenance?: { sourceTiles: string[]; waterMaskTile: string; analysisGrid: Record<string, unknown> };
};
export type SearchResult = {
  runId: string; createdAt: string; request: SearchRequest;
  landCoverRejected?: { missing: number; outside: number };
  candidates: Candidate[];
  evaluated: number; rejected: number; provisional: number; errors: { id: string; message: string }[];
  provenance: { dataset: string; version: string; footprintKm: number | null; resolutionM: number | null; scope: string; ranking: string };
};
export function validateRequest(input: unknown): SearchRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected an experiment object.");
  const r = input as Record<string, unknown>;
  if (typeof r.profile !== "string" || !Object.hasOwn(profiles, r.profile)) throw new Error("Unknown experiment type.");
  if (!["jezero", "terrain"].includes(String(r.target))) throw new Error("Unknown target.");
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
  return { ...r, title: (r.title as string).trim(), testEnvelope: envelope, landCoverConstraints: cover, requirements: [...new Set(required)] } as SearchRequest;
}
export type Measurement = { id: string; lat: number; lon: number; jsd: number; landFraction: number; landStatus: string; slopeP95: number; slopeMean: number; sourceTiles?: string[]; waterMaskTile?: string; analysisGrid?: Record<string, unknown>; landCover?: LandCover };
export function rankTerrain(rows: Measurement[], request: SearchRequest) {
  let rejected = 0;
  let provisional = 0;
  const candidates: Candidate[] = [];
  const landCoverRejected = { missing: 0, outside: 0 };
  const coverFilters = request.landCoverConstraints ?? {};
  const filterCover = Object.keys(coverFilters).length > 0;
  const required = [...new Set([...profiles[request.profile].evidence, ...request.requirements])];
  for (const row of rows) {
    if (![row.lat, row.lon, row.jsd, row.landFraction, row.slopeP95, row.slopeMean].every(Number.isFinite) ||
        row.landStatus !== "ELIGIBLE" || row.lat < request.south || row.lat > request.north || row.lon < request.west || row.lon > request.east ||
        row.landFraction < request.minLandFraction || row.slopeP95 < request.minSlopeP95 || row.slopeP95 > request.maxSlopeP95 ||
        (request.target === "jezero" && row.jsd > request.maxJsd)) { rejected++; continue; }
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
    candidates.push({
      id: row.id, name: row.id, lat: row.lat, lon: row.lon,
      jsd: request.target === "jezero" ? row.jsd : null,
      landFraction: row.landFraction, slopeP95: row.slopeP95, slopeMean: row.slopeMean,
      status: required.length ? "verification-required" : "terrain-match",
      ...(row.landCover ? { landCover: row.landCover } : {}),
      explanation: [
        ...(filterCover ? ["Historical WorldCover 2021 sampled proportions satisfy all requested cover limits with complete coverage."] : []),
        "Land fraction " + (100 * row.landFraction).toFixed(2) + "% meets threshold.",
        "Regional slope P95 " + row.slopeP95.toFixed(2) + "° is inside requested interval.",
        request.target === "jezero" ? "Jezero slope-distribution distance " + row.jsd.toFixed(4) + " meets threshold." : "Ranked by absolute difference from requested regional P95 slope.",
      ],
      missingEvidence: required.map(k => evidenceLabels[k]), source: "SRTMGL30 + MOD44W · EXP-001B",
      ...(row.sourceTiles && row.waterMaskTile && row.analysisGrid ? { measurementProvenance: { sourceTiles: row.sourceTiles, waterMaskTile: row.waterMaskTile, analysisGrid: row.analysisGrid } } : {}),
    });
  }
  candidates.sort((a, b) => {
    const delta = request.target === "jezero" ? a.jsd! - b.jsd! : Math.abs(a.slopeP95! - request.desiredSlopeP95) - Math.abs(b.slopeP95! - request.desiredSlopeP95);
    return delta || a.id.localeCompare(b.id);
  });
  return { candidates: candidates.slice(0, request.limit), rejected, provisional, landCoverRejected };
}
