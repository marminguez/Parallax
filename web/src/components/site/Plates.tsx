"use client";
import { useCallback, useState } from "react";

/**
 * onError can fire before hydration, when React is not yet listening; this ref also catches
 * images that had already failed by the time the component mounted.
 */
function useFailed(): [boolean, () => void, (img: HTMLImageElement | null) => void] {
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);
  const ref = useCallback((img: HTMLImageElement | null) => { if (img && img.complete && img.naturalWidth === 0) setFailed(true); }, []);
  return [failed, fail, ref];
}
import { REVERSE_BASE, pixelsPerKm, slippy, type Body } from "@/lib/underfoot";
import { useLang } from "@/lib/i18n";

/** Esri World Imagery around a point, with the 50 × 50 km window outlined. Context only, never measured. */
export function EarthSquare({ lat, lon, label, zoom = 9 }: { lat: number; lon: number; label: string; zoom?: number }) {
  const [offline, setOffline, imgRef] = useFailed();
  const { lang } = useLang();
  const { x, y } = slippy(lat, lon, zoom);
  const x0 = Math.floor(x - 0.5), y0 = Math.floor(y - 0.5);
  const side = (50 * pixelsPerKm(lat, zoom)) / 512;
  const n = 2 ** zoom;
  return <div className="relative aspect-square w-full overflow-hidden bg-[#0d1116]" role="img" aria-label={label}>
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
      {[0, 1].flatMap(dy => [0, 1].map(dx => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${dx}${dy}`} alt="" loading="lazy" ref={imgRef} onError={setOffline} className={`h-full w-full object-cover ${offline ? "invisible" : ""}`}
          src={`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y0 + dy}/${(((x0 + dx) % n) + n) % n}`} />
      )))}
    </div>
    <div className="absolute border border-[var(--earth-bright)]/90" style={{ left: `${((x - x0) / 2 - side / 2) * 100}%`, top: `${((y - y0) / 2 - side / 2) * 100}%`, width: `${side * 100}%`, height: `${side * 100}%` }} />
    {offline && <span className="absolute inset-x-3 top-3 text-[11px] leading-4 text-[var(--text-muted)]">{lat.toFixed(2)}, {lon.toFixed(2)}<br />{lang === "es" ? "La imagen de satélite necesita conexión" : "Satellite imagery needs a connection"}</span>}
    <span className="absolute bottom-1 right-1.5 text-[9px] text-white/55">Esri World Imagery</span>
  </div>;
}

const MOON_MAP = 608; // cells of 1 km in moon-map.png (summary.maps.moon.shape)

/** Shaded relief of a Moon or Mars window. Falls back to a crop of the global class map when no thumbnail was rendered. */
export function PlanetSquare({ body, id, lat, lon, label }: { body: Body; id: string; lat: number; lon: number; label: string }) {
  const [missing, setMissing, imgRef] = useFailed();
  if (!missing)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`${REVERSE_BASE}/thumbs/${body}/${id}.jpg`} alt={label} loading="lazy" ref={imgRef} onError={setMissing} className="aspect-square w-full bg-[#0d1116] object-cover" />;
  if (body === "moon") {
    const m = /^MOON-(\d+)-(\d+)$/.exec(id);
    const r0 = m ? Number(m[1]) : 279, c0 = m ? Number(m[2]) : 279;
    const view = 100, left = Math.min(MOON_MAP - view, Math.max(0, c0 - 25)), top = Math.min(MOON_MAP - view, Math.max(0, r0 - 25));
    return <div role="img" aria-label={label} className="relative aspect-square w-full overflow-hidden bg-[#0d1116] [filter:grayscale(1)_contrast(1.1)]"
      style={{ backgroundImage: `url(${REVERSE_BASE}/moon-map.png)`, backgroundSize: `${(MOON_MAP / view) * 100}%`, backgroundPosition: `${(left / (MOON_MAP - view)) * 100}% ${(top / (MOON_MAP - view)) * 100}%` }}>
      <div className="absolute border border-white/80" style={{ left: `${((c0 - left) / view) * 100}%`, top: `${((r0 - top) / view) * 100}%`, width: "50%", height: "50%" }} />
    </div>;
  }
  // Mars class map: 1440 × 720 px equirectangular. Show 24° around the window with a marker.
  const W = 1440, H = 720, span = 24, pxDeg = W / 360, view = span * pxDeg;
  const cx = (lon + 180) * pxDeg, cy = (90 - lat) * pxDeg;
  const left = Math.min(W - view, Math.max(0, cx - view / 2)), top = Math.min(H - view, Math.max(0, cy - view / 2));
  return <div role="img" aria-label={label} className="relative aspect-square w-full overflow-hidden bg-[#0d1116] [filter:grayscale(1)_contrast(1.1)] [image-rendering:pixelated]"
    style={{ backgroundImage: `url(${REVERSE_BASE}/mars-map.png)`, backgroundSize: `${(W / view) * 100}% ${(H / view) * 100}%`, backgroundPosition: `${(left / (W - view)) * 100}% ${(top / (H - view)) * 100}%` }}>
    <div className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: `${((cx - left) / view) * 100}%`, top: `${((cy - top) / view) * 100}%` }} />
  </div>;
}

type Side = { title: string; place: string; coords: string };

/**
 * The Parallax diptych: an Earth window and its twin on the Moon or Mars, side by side,
 * with the measured distance on the seam. Used everywhere a twin is shown.
 */
export function TwinPlate({ earth, planet, body, window, distance, verdict }: {
  earth: Side & { lat: number; lon: number };
  planet: Side; body: Body; window: { id: string; lat: number; lon: number };
  distance: number; verdict: string;
}) {
  const accent = body === "mars" ? "var(--mars-bright)" : "var(--moon)";
  return <figure className="plate-fade" key={`${window.id}-${earth.lat}-${earth.lon}`}>
    <div className="relative grid grid-cols-2 gap-[3px] bg-[var(--space-void)]">
      <EarthSquare lat={earth.lat} lon={earth.lon} label={`${earth.title}: ${earth.place}`} />
      <PlanetSquare body={body} id={window.id} lat={window.lat} lon={window.lon} label={`${planet.title}: ${planet.place}`} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-[var(--space-void)]/90 px-3 py-1.5 text-center backdrop-blur">
        <div className="font-mono text-[13px] tabular-nums text-white">{distance.toFixed(3)}</div>
      </div>
    </div>
    <figcaption className="mt-3 grid grid-cols-2 gap-4 text-sm">
      <div><div className="text-[var(--earth-bright)]">{earth.title}</div><div className="mt-0.5 text-white">{earth.place}</div><div className="mt-0.5 text-xs text-[var(--text-muted)]">{earth.coords}</div></div>
      <div><div style={{ color: accent }}>{planet.title}</div><div className="mt-0.5 text-white">{planet.place}</div><div className="mt-0.5 text-xs text-[var(--text-muted)]">{planet.coords}</div></div>
      <div className="col-span-2 text-[13px] text-[var(--text-secondary)]">{verdict}</div>
    </figcaption>
  </figure>;
}
