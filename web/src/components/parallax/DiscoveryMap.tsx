"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

const candidates = [
  {
    name: "Western Ethiopia",
    lon: 37.1665,
    lat: 10.5497,
    jsd: "0.090",
    best: false,
  },
  {
    name: "Central Mexico",
    lon: -103.0135,
    lat: 22.4657,
    jsd: "0.129",
    best: false,
  },
  {
    name: "Eastern Anatolia",
    lon: 42.5744,
    lat: 39.1031,
    jsd: "0.081",
    best: true,
  },
];

export default function DiscoveryMap() {
  const [selected, setSelected] = useState<(typeof candidates)[number] | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [2, 23],
      zoom: 1.35,
      minZoom: 1,
      maxZoom: 8,
      attributionControl: false,
    });

    mapRef.current = map;

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
            ${candidate.best ? "Best observed" : "Priority candidate"}
          </div>

          <div style="
            margin-top:7px;
            font-size:13px;
            font-weight:600;
          ">
            ${candidate.name}
          </div>

          <div style="
            margin-top:10px;
            display:flex;
            justify-content:space-between;
            gap:20px;
            font-size:10px;
            color:#a8b0b8;
          ">
            <span>Morphology JSD</span>
            <span style="
              color:${candidate.best ? "#a5daf7" : "#f5f6f7"};
              font-family:monospace;
            ">
              ${candidate.jsd}
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
  }, []);

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
            EXP-001 · Regional refinement
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
            Best observed
          </div>
        </div>
      </div>
    </div>
    {selected && <SatellitePreview key={selected.name} candidate={selected} />}
    </>
  );
}

function SatellitePreview({ candidate }: { candidate: (typeof candidates)[number] }) {
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
            tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
            tileSize: 256,
            maxzoom: 19,
            attribution: 'Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community · <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer" target="_blank" rel="noopener noreferrer">World Imagery</a>',
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
          <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">{candidate.lat.toFixed(4)}°, {candidate.lon.toFixed(4)}° · Morphology JSD {candidate.jsd}</p>
        </div>
        <span className="text-xs text-[var(--earth-bright)]">Marker = candidate coordinates</span>
      </div>
      <div ref={containerRef} className="h-[360px] w-full" aria-label={`Real imagery centered on ${candidate.lat}, ${candidate.lon}`} />
      <div className="px-5 py-3 text-xs leading-5 text-[var(--text-secondary)]">
        {failed && <p role="status" className="text-[var(--warning)]">Some imagery could not load. Check your connection or try zooming out.</p>}
        <p>Esri World Imagery · Satellite/aerial mosaic. Acquisition date and local resolution have not been verified. This view provides visual context; it is not the terrain dataset used to calculate JSD or evidence of field suitability.</p>
      </div>
    </section>
  );
}

