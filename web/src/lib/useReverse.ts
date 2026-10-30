"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { REVERSE_BASE, type Body, type EarthTile, type PlanetWindow, type ReverseSummary } from "./underfoot";
import { tilesForRadius, type LabelledTile, type PlaceTile } from "./regions";

async function getJson<T>(path: string): Promise<T | null> {
  const r = await fetch(`${REVERSE_BASE}/${path}`, { cache: "force-cache" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export type Planets = Partial<Record<Body, Record<string, PlanetWindow>>>;

/** Loads the reverse-map summary and planet windows once, and Earth tiles on demand (cached per page). */
export function useReverse(withPlanets: Body[] = ["moon", "mars"]) {
  const [summary, setSummary] = useState<ReverseSummary | null | undefined>(undefined);
  const [planets, setPlanets] = useState<Planets>({});
  const [error, setError] = useState("");
  const cache = useRef(new Map<string, LabelledTile>());
  const want = withPlanets.join(",");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const s = await getJson<ReverseSummary>("summary.json");
        if (!live) return;
        setSummary(s);
        if (!s) return;
        const loaded: Planets = {};
        for (const b of want.split(",") as Body[]) if (b && s.bodies[b]) loaded[b] = (await getJson<Record<string, PlanetWindow>>(`${b}-windows.json`)) ?? undefined;
        if (live) setPlanets(loaded);
      } catch (e) { if (live) { setError(e instanceof Error ? e.message : String(e)); setSummary(null); } }
    })();
    return () => { live = false; };
  }, [want]);

  /** Earth tiles around a point, with their place labels when exported (labels are optional). */
  const tilesAround = useCallback(async (lat: number, lon: number, radiusKm: number): Promise<LabelledTile[]> => {
    if (!summary) return [];
    const keys = tilesForRadius(lat, lon, radiusKm, summary.tileDeg, summary.tiles);
    const out: LabelledTile[] = [];
    for (const k of keys) {
      let t = cache.current.get(k);
      if (!t) {
        const [tile, places] = await Promise.all([getJson<EarthTile>(`earth/${k}.json`), getJson<PlaceTile>(`places/${k}.json`).catch(() => null)]);
        if (tile) { t = { ...tile, places: places ?? undefined }; cache.current.set(k, t); }
      }
      if (t) out.push(t);
    }
    return out;
  }, [summary]);

  return { summary, planets, error, ready: !!summary && Object.keys(planets).length > 0, tilesAround };
}

/** Browser geolocation as a promise; the position never leaves the device. */
export function locate(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unavailable"));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => reject(new Error("denied")),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  });
}
