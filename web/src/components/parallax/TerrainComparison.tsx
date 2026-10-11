import type { Candidate, SearchResult } from "@/lib/search";
import jezero from "../../../data/jezero-target.json";

export default function TerrainComparison({ candidate, result }: { candidate: Candidate; result: SearchResult }) {
  if (result.request.mode === "facilities") return null;
  const planetary = result.request.target === "jezero";
  const slope = jezero.terrain["1000m"].slope;
  const value = (n: number | null, unit = "°") => n === null ? "Not measured" : n.toFixed(2) + unit;
  const rows = [
    ["Regional P95 slope", value(candidate.slopeP95), planetary ? value(slope.p95_deg) : value(result.request.desiredSlopeP95) + " preferred"],
    ["Regional mean slope", value(candidate.slopeMean), planetary ? value(slope.mean_deg) : "Not specified"],
    ["Analysis window", `${result.provenance.footprintKm ?? "Unknown"} × ${result.provenance.footprintKm ?? "Unknown"} km`, planetary ? "50 × 50 km" : "Not specified"],
    ["Analysis grid spacing", `${result.provenance.resolutionM ?? "Unknown"} m`, planetary ? "1000 m" : "Not specified"],
    ["Land / water mask", candidate.landFraction === null ? "Not measured" : `${(candidate.landFraction * 100).toFixed(2)}% land`, "Not comparable across planets"],
  ];
  return <details className="mt-4 rounded-sm border border-white/10 p-3">
    <summary className="cursor-pointer text-sm text-[var(--earth-bright)]">{planetary ? "Earth–Jezero evidence comparison" : "Earth–requested terrain comparison"}</summary>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs">
      <caption className="mb-3 text-left text-[var(--text-secondary)]">{planetary ? "Morphology only · frozen Jezero reference v0.4" : "Regional terrain criteria · no planetary similarity claim"}</caption>
      <thead><tr>{["Measurement", "Earth window", planetary ? "Mars · Jezero" : "Your requirement"].map(label => <th key={label} scope="col" className="border-b border-white/15 px-2 py-2">{label}</th>)}</tr></thead>
      <tbody>{rows.map(([label, earth, target]) => <tr key={label}><th scope="row" className="px-2 py-2 font-normal">{label}</th><td className="px-2 py-2">{earth}</td><td className="px-2 py-2">{target}</td></tr>)}</tbody>
    </table></div>
    {planetary && <p className="mt-3 text-xs leading-5">Slope-distribution distance (base-2 Jensen–Shannon): {candidate.jsd?.toFixed(4) ?? "Not measured"}. Lower means closer distributions; this is not a percentage of suitability. P95 alone does not determine this distance.</p>}
    <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">Earth: SRTMGL30 elevation + MOD44W land/water mask. {planetary && `Mars: ${jezero.source.dataset}, resampled to the 1 km analysis grid; centre ${jezero.target.center_lat_deg}°, ${jezero.target.center_lon_deg}°.`} Grid spacing does not guarantee obstacle-scale accuracy. Boundary cells are excluded from slope statistics.</p>
    <p className="mt-2 text-xs leading-5 text-[var(--warning)]">Geology, soil mechanics, climate and field access are not verified by this morphology comparison. Historical vegetation classes, when available, are shown separately below. Similar slopes do not establish an equivalent lunar or Martian environment.</p>
    {candidate.measurementProvenance ? <div className="mt-3 break-all text-xs leading-5 text-[var(--text-muted)]"><p>Earth DEM tiles: {candidate.measurementProvenance.sourceTiles.join(", ")}</p><p>Water mask: {candidate.measurementProvenance.waterMaskTile}</p></div> : <p className="mt-3 text-xs text-[var(--text-muted)]">Indexed pilot: individual raster tile provenance is not included in this record.</p>}
    {planetary && <a className="mt-3 inline-block text-xs underline" href="https://github.com/marminguez/Parallax/blob/feat/exp001-jezero-rover/results/exp001/jezero_target_50km_v0_4.json" target="_blank" rel="noopener noreferrer">Frozen reference and measurements</a>}
  </details>;
}
