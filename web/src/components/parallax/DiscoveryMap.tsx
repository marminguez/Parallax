"use client";

import { useEffect, useRef } from "react";
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
  );
}
