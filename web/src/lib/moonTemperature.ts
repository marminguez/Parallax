/**
 * Moon temperature v2 (config/search/moon_temperature_v2.yaml, amendment v2.1): the measured
 * LRO Diviner range of each lunar reference replaces the single literature range
 * (dimensions_v1) for the 10 lunar targets. Values copied from the run
 * (results/diviner/moon_temperature_v2.json, web/data/moon-temperature-v2.json);
 * scripts/moon-temperature.test.mjs checks that they match. Mars is unchanged.
 */
export type Verdict = "holds" | "partly" | "breaks";

export const DIVINER_SOURCE = "LRO Diviner";

/** Search target id -> [min °C, max °C] of its window (search condition and candidate sheet). */
export const MOON_TEMPERATURE_V2: Record<string, readonly [number, number]> = {
  "shackleton": [-246.2, 16.1],
  "peak-near-cabeus-b": [-246.3, 40.7],
  "haworth": [-259.1, 5.0],
  "malapert-massif": [-238.8, 35.4],
  "mons-mouton-plateau": [-230.8, 36.7],
  "mons-mouton": [-239.9, 25.6],
  "nobile-rim-1": [-255.1, 31.8],
  "nobile-rim-2": [-243.0, 41.1],
  "de-gerlache-rim-2": [-245.1, 14.0],
  "slater-plain": [-248.8, 11.5],
};

/** Twin sheet id -> v2 temperature verdict (Shackleton uses its sheet window MOON-275-275), with the v1 verdict it sits beside. */
export const MOON_TWINS_V2: Record<string, { planet: readonly [number, number]; overlap: number; verdict: Verdict; v1: Verdict }> = {
  "shackleton": { planet: [-252.2, 16.8], overlap: 0.186, verdict: "breaks", v1: "partly" },
  "peak-near-cabeus-b": { planet: [-246.3, 40.7], overlap: 0.25, verdict: "partly", v1: "partly" },
  "haworth": { planet: [-259.1, 5.0], overlap: 0.225, verdict: "partly", v1: "partly" },
  "malapert-massif": { planet: [-238.8, 35.4], overlap: 0.322, verdict: "partly", v1: "partly" },
  "mons-mouton-plateau": { planet: [-230.8, 36.7], overlap: 0.125, verdict: "breaks", v1: "breaks" },
  "mons-mouton": { planet: [-239.9, 25.6], overlap: 0.144, verdict: "breaks", v1: "partly" },
  "nobile-rim-1": { planet: [-255.1, 31.8], overlap: 0.281, verdict: "partly", v1: "partly" },
  "nobile-rim-2": { planet: [-243.0, 41.1], overlap: 0.14, verdict: "breaks", v1: "breaks" },
  "de-gerlache-rim-2": { planet: [-245.1, 14.0], overlap: 0.169, verdict: "breaks", v1: "partly" },
  "slater-plain": { planet: [-248.8, 11.5], overlap: 0.082, verdict: "breaks", v1: "partly" },
};
