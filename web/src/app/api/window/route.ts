import { NextResponse } from "next/server";
import { POWER_PARAMS, monthlyFromPower, windows, type Monthly } from "@/lib/testWindow";

/**
 * Test window v1 (config/search/test_window_v1.yaml) for one site: NASA POWER monthly
 * climatology at the window centre, then both windows with the frozen rules. One request
 * per site sheet; answers are kept in memory and in the platform's fetch cache.
 */
export const runtime = "nodejs";
const POWER_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point";
const cache = new Map<string, Monthly>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat")), lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "lat and lon are required." }, { status: 400 });
  }
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  try {
    let monthly = cache.get(key);
    if (!monthly) {
      const q = new URLSearchParams({ parameters: POWER_PARAMS, community: "AG", latitude: lat.toFixed(4), longitude: lon.toFixed(4), format: "JSON" });
      const res = await fetch(`${POWER_URL}?${q}`, { headers: { "User-Agent": "Parallax-NASA-Space-Apps-2026/1.0" }, next: { revalidate: 60 * 60 * 24 * 30 }, signal: AbortSignal.timeout(25000) });
      if (!res.ok) throw new Error(`NASA POWER answered ${res.status}`);
      monthly = monthlyFromPower(await res.json());
      if (cache.size > 2000) cache.clear();
      cache.set(key, monthly);
    }
    return NextResponse.json({ windows: windows(monthly, lat), monthly, source: "NASA POWER climatology (community AG) at the window centre; test window v1" }, { headers: { "Cache-Control": "public, s-maxage=2592000" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "NASA POWER is not reachable now." }, { status: 502 });
  }
}
