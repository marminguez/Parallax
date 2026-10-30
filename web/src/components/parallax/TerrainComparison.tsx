import type { Candidate, SearchResult } from "@/lib/search";
import { planetaryTargets, type FrozenTarget } from "@/lib/targets";
import jezero from "../../../data/jezero-target.json";

const REPO = "https://github.com/marminguez/Parallax/blob/feat/exp001-jezero-rover/";

/** Frozen reference for this result; older saved results (before multi-target) were always Jezero. */
export function resultReference(result: SearchResult): (FrozenTarget & { id: string }) | null {
  if (result.request.mode === "facilities" || result.request.target === "terrain") return null;
  return result.planetaryReference ?? (result.request.target === "jezero" ? { id: "jezero", ...(jezero as FrozenTarget) } : null);
}

export default function TerrainComparison({ candidate, result }: { candidate: Candidate; result: SearchResult }) {
  if (result.request.mode === "facilities") return null;
  const reference = resultReference(result);
  const spec = reference && reference.id in planetaryTargets ? planetaryTargets[reference.id as keyof typeof planetaryTargets] : null;
  const name = reference ? `${reference.target.planet} · ${reference.target.region}` : "";
  const slope = reference?.terrain["1000m"]?.slope;
  const value = (n: number | null | undefined, unit = "°") => n === null || n === undefined ? "Not measured" : n.toFixed(2) + unit;
  const rows = [
    ["Regional P95 slope", value(candidate.slopeP95), reference ? value(slope?.p95_deg) : value(result.request.desiredSlopeP95) + " preferred"],
    ["Regional mean slope", value(candidate.slopeMean), reference ? value(slope?.mean_deg) : "Not specified"],
    ["Analysis window", `${result.provenance.footprintKm ?? "Unknown"} × ${result.provenance.footprintKm ?? "Unknown"} km`, reference ? `${reference.target.window_km} × ${reference.target.window_km} km` : "Not specified"],
    ["Analysis grid spacing", `${result.provenance.resolutionM ?? "Unknown"} m`, reference ? "1000 m" : "Not specified"],
    ["Land / water mask", candidate.landFraction === null ? "Not measured" : `${(candidate.landFraction * 100).toFixed(2)}% land`, "Not comparable across planets"],
  ];
  return <details className="mt-4 rounded-sm border border-white/10 p-3">
    <summary className="cursor-pointer text-sm text-[var(--earth-bright)]">{reference ? `Earth–${spec?.short ?? reference.target.region} evidence comparison` : "Earth–requested terrain comparison"}</summary>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs">
      <caption className="mb-3 text-left text-[var(--text-secondary)]">{reference ? `Morphology only · frozen ${reference.target.region} reference v${reference.version}` : "Regional terrain criteria · no planetary similarity claim"}</caption>
      <thead><tr>{["Measurement", "Earth window", reference ? name : "Your requirement"].map(label => <th key={label} scope="col" className="border-b border-white/15 px-2 py-2">{label}</th>)}</tr></thead>
      <tbody>{rows.map(([label, earth, target]) => <tr key={label}><th scope="row" className="px-2 py-2 font-normal">{label}</th><td className="px-2 py-2">{earth}</td><td className="px-2 py-2">{target}</td></tr>)}</tbody>
    </table></div>
    {reference && <p className="mt-3 text-xs leading-5">Slope-distribution distance (base-2 Jensen–Shannon): {candidate.jsd?.toFixed(4) ?? "Not measured"}. Lower means closer distributions; this is not a percentage of suitability. P95 alone does not determine this distance.</p>}
    <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">Earth: SRTMGL30 elevation + MOD44W land/water mask. {reference && `${reference.target.planet}: ${reference.source.dataset}, aggregated to the 1 km analysis grid; centre ${reference.target.center_lat_deg}°, ${reference.target.center_lon_deg}°.`} Grid spacing does not guarantee obstacle-scale accuracy. Boundary cells are excluded from slope statistics.</p>
    <p className="mt-2 text-xs leading-5 text-[var(--warning)]">Geology, soil mechanics, climate and field access are not verified by this morphology comparison. Historical vegetation classes, when available, are shown separately below. Similar slopes do not establish an equivalent lunar or Martian environment.</p>
    {candidate.measurementProvenance ? <div className="mt-3 break-all text-xs leading-5 text-[var(--text-muted)]"><p>Earth DEM tiles: {candidate.measurementProvenance.sourceTiles.join(", ")}</p><p>Water mask: {candidate.measurementProvenance.waterMaskTile}</p></div> : <p className="mt-3 text-xs text-[var(--text-muted)]">Indexed pilot: individual raster tile provenance is not included in this record.</p>}
    {spec && <a className="mt-3 inline-block text-xs underline" href={REPO + spec.frozen} target="_blank" rel="noopener noreferrer">Frozen reference and measurements</a>}
  </details>;
}
