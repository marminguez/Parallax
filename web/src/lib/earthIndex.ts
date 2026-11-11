/**
 * Earth dimensions index (config/search/earth_dimensions_v1.yaml, amendment v1.1).
 *
 * 42,405 eligible VAL-004 Earth windows with their 1 km slope histogram and five
 * Earth-side dimensions. The rules below mirror src/parallax/characterize exactly:
 * filters remove windows and never reorder them; a missing value never passes.
 */
import { SLOPE_BINS, type PlanetaryTargetId } from "./targets";

export type AccessBand = "remote" | "rural" | "populated";
export type EarthDims = {
  bare: number | null;
  vegetated: number | null;
  access: AccessBand | null;
  ice: boolean | null;
  /** GLiM first-level class shares in the window (sum 1), largest first. */
  glim: Record<string, number> | null;
  tsMin: number | null;
  tsMax: number | null;
};
export type EarthRow = { id: string; lat: number; lon: number; distribution: number[]; earth: EarthDims };

export type Level = "holds" | "holds_or_partly";
export type EarthFilters = {
  bareMin?: number;
  vegetatedMax?: number;
  access?: AccessBand[];
  permafrost?: boolean;
  rock?: Level;
  temperature?: Level;
};
export const EARTH_FILTER_KEYS = ["bareMin", "vegetatedMax", "access", "permafrost", "rock", "temperature"] as const;
export type EarthFilterKey = (typeof EARTH_FILTER_KEYS)[number];
export type EarthRejections = Partial<Record<EarthFilterKey, { outside: number; missing: number }>>;

// ---------------------------------------------------------------- frozen bands (characterization v1-v1.4)

/** breaks < 0.20 <= partly < 0.50 <= holds (ground_v1, dimensions_v1). */
const BANDS = [0.2, 0.5] as const;
export type Verdict = "holds" | "partly" | "breaks";
const band = (share: number): Verdict => share < BANDS[0] ? "breaks" : share < BANDS[1] ? "partly" : "holds";

export const GEOLOGY_FAMILIES = {
  crystalline_feldspathic: { match: ["pb"], family: ["pb", "pi", "pa", "mt"] },
  basaltic_volcanic: { match: ["vb"], family: ["vb", "vi", "va", "py"] },
  basaltic_crust: { match: ["vb"], family: ["vb", "vi", "va", "py", "pb", "pi", "pa", "mt"] },
  sedimentary: { match: ["ss", "sm", "su"], family: ["ss", "sm", "su", "sc", "ev"] },
  polar: { match: ["ig"], family: ["ig", "su"] },
} as const;
export type RockFamily = keyof typeof GEOLOGY_FAMILIES;
/** Rock family of each search target (characterization v1.4). */
export const TARGET_FAMILY: Record<PlanetaryTargetId, RockFamily> = { jezero: "sedimentary", shackleton: "crystalline_feldspathic" };
/** Literature surface-temperature ranges, one per body (dimensions_v1). */
export const PLANET_TEMPERATURE_C = { Moon: [-203, 54], Mars: [-83, -13] } as const;
export const TARGET_BODY: Record<PlanetaryTargetId, keyof typeof PLANET_TEMPERATURE_C> = { jezero: "Mars", shackleton: "Moon" };

export function rockVerdict(glim: Record<string, number>, family: RockFamily) {
  const spec = GEOLOGY_FAMILIES[family];
  const sum = (codes: readonly string[]) => codes.reduce((a, k) => a + (glim[k] ?? 0), 0);
  const match = sum(spec.match), fam = sum(spec.family);
  return { match, family: fam, verdict: (match >= 0.5 ? "holds" : fam >= 0.5 ? "partly" : "breaks") as Verdict };
}
export function temperatureOverlap(earth: [number, number], planet: readonly [number, number]) {
  const [e0, e1] = [Math.min(...earth), Math.max(...earth)];
  const [p0, p1] = planet;
  return Math.max(0, Math.min(e1, p1) - Math.max(e0, p0)) / (p1 - p0);
}
export const temperatureVerdict = band;
export const groundVerdict = band;

/** Every dimension of a window judged against the selected target, as on the twin sheets. */
export function judge(earth: EarthDims, target: PlanetaryTargetId) {
  const planet = PLANET_TEMPERATURE_C[TARGET_BODY[target]];
  const overlap = earth.tsMin !== null && earth.tsMax !== null ? temperatureOverlap([earth.tsMin, earth.tsMax], planet) : null;
  const rock = earth.glim ? rockVerdict(earth.glim, TARGET_FAMILY[target]) : null;
  return {
    ground: earth.bare === null ? null : groundVerdict(earth.bare),
    rock, rockFamily: TARGET_FAMILY[target],
    temperature: overlap === null ? null : { overlap, verdict: temperatureVerdict(overlap), planet },
  };
}

// ---------------------------------------------------------------- filters

const reaches = (verdict: Verdict, level: Level) => verdict === "holds" || (level === "holds_or_partly" && verdict === "partly");

/** First filter the window fails, and whether it failed for a missing value; null when it passes all. */
export function failedFilter(earth: EarthDims, filters: EarthFilters, target: PlanetaryTargetId): { key: EarthFilterKey; missing: boolean } | null {
  if (filters.bareMin !== undefined) {
    if (earth.bare === null) return { key: "bareMin", missing: true };
    if (earth.bare < filters.bareMin) return { key: "bareMin", missing: false };
  }
  if (filters.vegetatedMax !== undefined) {
    if (earth.vegetated === null) return { key: "vegetatedMax", missing: true };
    if (earth.vegetated > filters.vegetatedMax) return { key: "vegetatedMax", missing: false };
  }
  if (filters.access?.length) {
    if (earth.access === null) return { key: "access", missing: true };
    if (!filters.access.includes(earth.access)) return { key: "access", missing: false };
  }
  if (filters.permafrost) {
    if (earth.ice === null) return { key: "permafrost", missing: true };
    if (!earth.ice) return { key: "permafrost", missing: false };
  }
  const j = (filters.rock || filters.temperature) ? judge(earth, target) : null;
  if (filters.rock) {
    if (!j!.rock) return { key: "rock", missing: true };
    if (!reaches(j!.rock.verdict, filters.rock)) return { key: "rock", missing: false };
  }
  if (filters.temperature) {
    if (!j!.temperature) return { key: "temperature", missing: true };
    if (!reaches(j!.temperature.verdict, filters.temperature)) return { key: "temperature", missing: false };
  }
  return null;
}

export function validateEarthFilters(input: unknown): EarthFilters {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid terrain conditions.");
  const out: EarthFilters = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === undefined) continue;
    if (key === "bareMin" || key === "vegetatedMax") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new Error("Ground shares must be between 0 and 1.");
      out[key] = value;
    } else if (key === "access") {
      if (!Array.isArray(value) || value.some(v => !["remote", "rural", "populated"].includes(v))) throw new Error("Invalid access band.");
      if (value.length) out.access = [...new Set(value as AccessBand[])];
    } else if (key === "permafrost") {
      if (typeof value !== "boolean") throw new Error("Invalid permafrost condition.");
      if (value) out.permafrost = true;
    } else if (key === "rock" || key === "temperature") {
      if (!["holds", "holds_or_partly"].includes(String(value))) throw new Error("Invalid " + key + " condition.");
      out[key] = value as Level;
    } else throw new Error("Unknown terrain condition.");
  }
  return out;
}

/** Mars model v2 (VAL-003): 0.5 x slope distance + 0.5 x (1 - bare share). Null when bare ground is missing (model v1 then). */
export function marsScore(distance: number, bare: number | null) {
  return bare === null ? null : 0.5 * distance + 0.5 * (1 - bare);
}

// ---------------------------------------------------------------- parsing web/data/earth-index.csv

export const INDEX_COLUMNS = ["id", "lat", "lon", ...SLOPE_BINS, "bare_share", "vegetated_share", "access", "ice_signal", "glim", "ts_min_c", "ts_max_c"] as const;

const num = (s: string) => s === "" ? null : Number(s);
export function parseEarthIndex(text: string): EarthRow[] {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const cols = header.split(",");
  if (cols.length !== INDEX_COLUMNS.length || INDEX_COLUMNS.some((c, i) => cols[i] !== c)) throw new Error("Unexpected earth index columns.");
  return lines.map(line => {
    const v = line.split(",");
    const glim = v[15] ? Object.fromEntries(v[15].split(";").map(p => { const [k, s] = p.split(":"); return [k, Number(s)]; })) : null;
    const access = v[13] as AccessBand | "";
    return {
      id: v[0], lat: Number(v[1]), lon: Number(v[2]),
      distribution: v.slice(3, 11).map(Number),
      earth: {
        bare: num(v[11]), vegetated: num(v[12]), access: access === "" ? null : access,
        ice: v[14] === "" ? null : v[14] === "true", glim, tsMin: num(v[16]), tsMax: num(v[17]),
      },
    };
  });
}
