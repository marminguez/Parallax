import { Candidate, SearchRequest, evidenceLabels, profiles } from "./search";

// Documented capability discovery, not a booking catalogue or certification.
const facilities = [
  {
    id: "NASA-GRC-SLOPE", name: "NASA Glenn · SLOPE / excavation laboratories",
    lat: 41.413, lon: -81.862,
    capabilities: ["mobility", "drilling", "excavation"],
    evidence: ["Controlled soil tanks, adjustable tilt-bed and instrumented traction testing.", "Excavation tools and forces can be evaluated in simulant soil bins."],
    source: "https://www.nasa.gov/centers-and-facilities/glenn/planetary-exploration-test-facilities/",
  },
  {
    id: "NASA-AMES-REGOLITH", name: "NASA Ames · Lunar Lab and Regolith Testbeds",
    lat: 37.415, lon: -122.064,
    capabilities: ["mobility", "navigation"],
    evidence: ["JSC-1A and LHS-1 simulants; configurable terrain.", "Controlled illumination for cameras, hazard avoidance and navigation tests."],
    source: "https://www.nasa.gov/centers-and-facilities/ames/the-lunar-lab-and-regolith-testbeds/",
  },
  {
    id: "NASA-JSC-LDTF", name: "NASA Johnson · Lunar Development and Test Facility",
    lat: 29.552, lon: -95.093,
    capabilities: ["dust", "thermal", "excavation"],
    evidence: ["Ambient dust testing, vacuum chamber and thermal-vacuum chamber using lunar regolith simulant."],
    source: "https://www.nasa.gov/centers-and-facilities/johnson/nasas-lunar-development-and-test-facility-prepares-artemis-hardware-for-moon/",
  },
];
export function findFacilities(request: SearchRequest) {
  let rejected = 0;
  let provisional = 0;
  const candidates: Candidate[] = [];
  const required = [...new Set([...profiles[request.profile].evidence, ...request.requirements])];
  for (const f of facilities) {
    if (!f.capabilities.includes(profiles[request.profile].capability) || f.lat < request.south || f.lat > request.north || f.lon < request.west || f.lon > request.east) { rejected++; continue; }
    provisional++;
    if (request.strict) { rejected++; continue; }
    candidates.push({
      id: f.id, name: f.name, lat: f.lat, lon: f.lon, jsd: null, landFraction: null, slopeP95: null, slopeMean: null,
      status: "documented-capability", explanation: [...f.evidence, "Map marker locates the NASA centre, not the exact test rig."],
      missingEvidence: [...required.map(k => evidenceLabels[k]), "Specimen dimensions, loads, test envelope, availability, pricing and external-user access require operator confirmation."],
      source: f.source,
    });
  }
  candidates.sort((a, b) => a.name.localeCompare(b.name));
  return { candidates: candidates.slice(0, request.limit), rejected, provisional, evaluated: facilities.length };
}
