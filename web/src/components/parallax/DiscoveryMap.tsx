"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { analysisRing } from "@/lib/footprint";
import { CARTO_STYLE_URL, IMAGERY_ATTRIBUTION, IMAGERY_TEMPLATE } from "@/lib/basemaps";

maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export type MapCandidate = { id: string; name: string; lon: number; lat: number; jsd: string; best: boolean; footprintKm?: number | null };

export default function DiscoveryMap({ candidates, distanceLabel = "Planetary distance" }: { candidates: MapCandidate[]; distanceLabel?: string }) {
  const [selected, setSelected] = useState<MapCandidate | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CARTO_STYLE_URL,
      center: [2, 23],
      zoom: 1.35,
      minZoom: 1,
      maxZoom: 8,
      attributionControl: { compact: false },
    });

    mapRef.current = map;
    const footprints = candidates.flatMap(c => {
      const ring = c.footprintKm ? analysisRing(c.lon, c.lat, c.footprintKm) : [];
      return ring.length ? [{ type: "Feature" as const, properties: { name: c.name, id: c.id }, geometry: { type: "Polygon" as const, coordinates: [ring] } }] : [];
    });
    map.on("load", () => {
      if (!footprints.length) return;
      map.addSource("analysis-windows", { type: "geojson", data: { type: "FeatureCollection", features: footprints } });
      map.addLayer({ id: "analysis-fill", type: "fill", source: "analysis-windows", paint: { "fill-color": "#68B9EA", "fill-opacity": 0.07 } });
      map.addLayer({ id: "analysis-outline", type: "line", source: "analysis-windows", paint: { "line-color": "#68B9EA", "line-width": 1.5, "line-opacity": 0.65 } });
    });
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    if (candidates.length > 1 || footprints.length) {
      const bounds = new maplibregl.LngLatBounds();
      candidates.forEach(c => bounds.extend([c.lon, c.lat]));
      footprints.forEach(f => f.geometry.coordinates[0].forEach(p => bounds.extend(p)));
      map.fitBounds(bounds, { padding: 70, maxZoom: 6, duration: 0 });
    } else if (candidates.length === 1) {
      map.jumpTo({ center: [candidates[0].lon, candidates[0].lat], zoom: 5 });
    }

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
      }),
      "top-right"
    );

    candidates.forEach((candidate) => {
      const marker = document.createElement("button");

      marker.type = "button";
      marker.setAttribute("aria-label", candidate.name);
      marker.addEventListener("click", () => setSelected(candidate));

      marker.style.width = candidate.best ? "18px" : "14px";
      marker.style.height = candidate.best ? "18px" : "14px";
      marker.style.borderRadius = "999px";
      marker.style.border = candidate.best
        ? "2px solid #F5F6F7"
        : "2px solid rgba(245,246,247,.72)";
      marker.style.background = candidate.best ? "#68B9EA" : "#183F59";
      marker.style.boxShadow = candidate.best
        ? "0 0 0 6px rgba(104,185,234,.12), 0 0 24px rgba(104,185,234,.65)"
        : "0 0 0 5px rgba(104,185,234,.08)";
      marker.style.cursor = "pointer";

      const popup = new maplibregl.Popup({
        offset: 18,
        closeButton: false,
        className: "parallax-map-popup",
      }).setHTML(`
        <div style="
          min-width:180px;
          background:#080b0f;
          color:#f5f6f7;
          border:1px solid rgba(255,255,255,.12);
          padding:14px;
          font-family:Arial,Helvetica,sans-serif;
        ">
          <div style="
            color:#69737d;
            font-size:9px;
            letter-spacing:.14em;
            text-transform:uppercase;
          ">
            ${candidate.best ? "First ranked result" : "Priority candidate"}
          </div>

          <div style="
            margin-top:7px;
            font-size:13px;
            font-weight:600;
          ">
            ${escapeHtml(candidate.name)}
          </div>

          <div style="
            margin-top:10px;
            display:flex;
            justify-content:space-between;
            gap:20px;
            font-size:10px;
            color:#a8b0b8;
          ">
            <span>${escapeHtml(distanceLabel)}</span>
            <span style="
              color:${candidate.best ? "#a5daf7" : "#f5f6f7"};
              font-family:monospace;
            ">
              ${escapeHtml(candidate.jsd)}
            </span>
          </div>
        </div>
      `);

      new maplibregl.Marker({
        element: marker,
        anchor: "center",
      })
        .setLngLat([candidate.lon, candidate.lat])
        .setPopup(popup)
        .addTo(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [candidates, distanceLabel]);

  return (
    <>
    <div className="relative overflow-hidden rounded-sm border border-white/[0.08] bg-[var(--space-deep)]">
      <div
        ref={containerRef}
        className="h-[390px] w-full"
        aria-label="PARALLAX Earth candidate discovery map"
      />

      <div className="pointer-events-none absolute left-5 top-5 z-10">
        <div className="rounded-sm border border-white/[0.1] bg-[#030405]/85 px-4 py-3 backdrop-blur-md">
          <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--earth-bright)]">
            Earth candidate map
          </div>
          <div className="mt-1 text-[10px] text-[var(--text-muted)]">
            Select a result to inspect real imagery
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-5 z-10">
        <div className="flex items-center gap-4 rounded-sm border border-white/[0.08] bg-[#030405]/85 px-4 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
            <span className="h-2 w-2 rounded-full bg-[var(--earth-deep)] ring-1 ring-white/60" />
            Candidate
          </div>

          <div className="h-3 w-px bg-white/10" />

          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-[var(--earth-bright)]">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--earth-primary)] ring-2 ring-white/80" />
            First ranked result
          </div>
        </div>
      </div>
    </div>
    {candidates.some(c => c.footprintKm) && <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">Blue outlines show the full analysis windows on the local WGS84 metric grid. Darker fills indicate overlapping windows, not independent field sites. Windows can extend beyond the search bounds; markers show their centres. Valid slope cells occupy a smaller interior footprint.</p>}
    <div className="mt-3 flex flex-wrap gap-2" aria-label="Select a candidate for satellite inspection">{candidates.map(c => <button type="button" key={c.id} onClick={() => setSelected(c)} aria-pressed={selected?.id === c.id} className="rounded-sm border border-white/15 px-3 py-2 text-xs">Inspect {c.name}</button>)}</div>
    {selected && <SatellitePreview key={selected.id} candidate={selected} distanceLabel={distanceLabel} />}
    </>
  );
}

function SatellitePreview({ candidate, distanceLabel }: { candidate: MapCandidate; distanceLabel: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [candidate.lon, candidate.lat],
      zoom: 12,
      minZoom: 3,
      maxZoom: 17,
      style: {
        version: 8,
        sources: {
          imagery: {
            type: "raster",
            tiles: [IMAGERY_TEMPLATE],
            tileSize: 256,
            maxzoom: 19,
            attribution: IMAGERY_ATTRIBUTION,
          },
        },
        layers: [{ id: "imagery", type: "raster", source: "imagery" }],
      },
      attributionControl: { compact: false },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    new maplibregl.Marker({ color: "#68b9ea" })
      .setLngLat([candidate.lon, candidate.lat])
      .addTo(map);
    map.on("error", () => setFailed(true));
    map.on("sourcedata", (event) => {
      if (event.sourceId === "imagery" && event.sourceDataType === "content") setFailed(false);
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); map.remove(); };
  }, [candidate]);

  return (
    <section className="mt-4 overflow-hidden rounded-sm border border-white/10 bg-[var(--space-deep)]" aria-label={`Satellite inspection of ${candidate.name}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h3 className="text-sm font-medium">{candidate.name} · Satellite inspection</h3>
          <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">{candidate.lat.toFixed(4)}°, {candidate.lon.toFixed(4)}° · {distanceLabel} {candidate.jsd}</p>
        </div>
        <span className="text-xs text-[var(--earth-bright)]">Marker = candidate coordinates</span>
      </div>
      <div ref={containerRef} className="h-[360px] w-full" aria-label={`Real imagery centered on ${candidate.lat}, ${candidate.lon}`} />
      <div className="px-5 py-3 text-xs leading-5 text-[var(--text-secondary)]">
        {failed && <p role="status" className="text-[var(--warning)]">Some imagery could not load. Check your connection or try zooming out.</p>}
        <p>Esri World Imagery · Satellite/aerial mosaic. Acquisition date and local resolution have not been verified. This view provides visual context; it is not the terrain dataset used to calculate the planetary distance or evidence of field suitability.</p>
      </div>
    </section>
  );
}

