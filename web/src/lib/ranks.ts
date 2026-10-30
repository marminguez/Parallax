import type { Body } from "./underfoot";

/** Percentiles of the twin distance over every eligible Earth window, every `step` %. */
export type RankTable = { step: number } & Record<Body, number[]>;

/**
 * Share of eligible Earth windows whose twin is farther than `d` (0..100; higher = more alike than most of Earth).
 * Linear interpolation inside the exported percentile table.
 */
export function rankIn(body: Body, d: number, table: RankTable): number {
  const q = table[body];
  if (!Number.isFinite(d)) throw new Error("Distance must be finite.");
  if (d <= q[0]) return 100;
  if (d >= q[q.length - 1]) return 0;
  let i = 0;
  while (i < q.length - 1 && q[i + 1] < d) i++;
  const span = q[i + 1] - q[i];
  const frac = span > 0 ? (d - q[i]) / span : 0;
  return 100 - (i + frac) * table.step;
}
