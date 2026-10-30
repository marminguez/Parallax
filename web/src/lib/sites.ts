/**
 * Destinations, hardest windows and Earth percentiles from VAL-004, as exported by
 * scripts/export_web_sites.py into web/data/val004-sites.json. Read-only; nothing here
 * recomputes a distance.
 */
import data from "../../data/val004-sites.json";
import type { Body, TwinClass } from "./underfoot";
import { rankIn, type RankTable } from "./ranks";

export type Place = { nearest: string; admin1: string; cc: string; km: number };
export type Destination = {
  id: string; name: string; kind: "reference" | "artemis" | "landed" | "candidate"; body: Body;
  lat: number; lon: number; window: string; windowKm: number; distance: number; cls: TwinClass;
  closerThan: number; ofPairs: number; earth: { lat: number; lon: number } & Place;
};
export type HardWindow = { id: string; lat: number; lon: number; distance: number; cls: TwinClass; feature?: string };
export type SitesData = {
  id: "VAL-004"; run_at: string;
  headline: Record<Body, { windows: number; strong: number; median: number; bridgePassed: boolean }>;
  earth: { evaluated: number; eligible: number; display: number };
  thresholds: { q25: number; q50: number; q90: number }; pairs: number[];
  predictions: Record<string, boolean>;
  destinations: Destination[];
  hardest: Record<Body, HardWindow[]>;
  hardestFeatures: Record<string, number>;
  earthPercentiles: { step: number } & Record<Body, number[]>;
};

export const sites = data as unknown as SitesData;

/** Share of measured Earth windows whose twin is farther than `d` (0..100), from the exported table. */
export const rankAmongEarth = (body: Body, d: number, table: RankTable = sites.earthPercentiles) => rankIn(body, d, table);

/** Country name in the visitor's language, from the browser's own locale data. */
export function countryName(cc: string, lang: "es" | "en"): string {
  try { return new Intl.DisplayNames([lang], { type: "region" }).of(cc) ?? cc; } catch { return cc; }
}
