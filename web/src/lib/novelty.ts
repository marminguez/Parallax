/**
 * Novelty v1 (config/novelty/novelty_v1.yaml): is an Earth twin already on an analog list?
 * Written by scripts/novelty.py into web/data/novelty.json. Descriptive: it never changes a twin.
 */
import data from "../../data/novelty.json";

export type NoveltyStatus = "new" | "known" | "undecided";
export type NearestKnown = { id: string; name: string; list: string; km: number };
export type NoveltySite = { status: NoveltyStatus; nearest_known: NearestKnown };
export type NoveltyData = {
  version: string; radiusKm: number; knownSites: number;
  counts: Record<NoveltyStatus, number>;
  destinations: Record<string, { twin: string; reachable: string | null }>;
  sites: Record<string, NoveltySite>;
};

export const novelty = data as unknown as NoveltyData;

/** Novelty of a destination's reverse-map twin. */
export function twinNovelty(destinationId: string, d: NoveltyData = novelty): NoveltySite | null {
  const id = d.destinations[destinationId]?.twin;
  return id ? d.sites[id] ?? null : null;
}
