"use client";
import type { Candidate, SearchResult } from "@/lib/search";
import { planetaryTargets, type FrozenTarget } from "@/lib/targets";
import jezero from "../../../data/jezero-target.json";
import { useT } from "@/lib/i18n";

const T = {
  es: {
    notMeasured: "Sin medir", unknown: "Desconocido", notSpecified: "Sin especificar", preferred: " preferido",
    p95: "P95 regional de pendiente", mean: "Pendiente media regional", window: "Ventana de análisis", grid: "Separación de la rejilla",
    mask: "Máscara tierra / agua", land: "% de tierra", notComparable: "No comparable entre planetas",
    summary: (s: string) => `Comparación de evidencia Tierra–${s}`, summaryTerrain: "Comparación Tierra–terreno pedido",
    caption: (r: string, v: string) => `Solo morfología · referencia congelada de ${r} v${v}`, captionTerrain: "Criterios de terreno regionales · sin afirmar similitud planetaria",
    measurement: "Medida", earth: "Ventana terrestre", yours: "Tu requisito",
    jsd: (d: string) => `Distancia entre distribuciones de pendientes (Jensen–Shannon, base 2): ${d}. Cuanto menor, más parecidas; no es un porcentaje de idoneidad. El P95 por sí solo no determina esta distancia.`,
    sources: (planet: string) => `Tierra: elevación SRTMGL30 + máscara tierra/agua MOD44W. ${planet} La separación de la rejilla no garantiza precisión a escala de obstáculo. Las celdas del borde se excluyen de las estadísticas de pendiente.`,
    planet: (p: string, d: string, lat: number, lon: number) => `${p}: ${d}, agregado a la rejilla de análisis de 1 km; centro ${lat}°, ${lon}°.`,
    warning: "Esta comparación morfológica no verifica la geología, la mecánica del suelo, el clima ni el acceso al campo. Las clases históricas de vegetación, si las hay, se muestran aparte más abajo. Pendientes parecidas no implican un entorno lunar o marciano equivalente.",
    tiles: "Teselas DEM terrestres:", waterMask: "Máscara de agua:", indexed: "Piloto indexado: este registro no incluye la procedencia de cada tesela ráster.",
    frozen: "Referencia congelada y medidas",
  },
  en: {
    notMeasured: "Not measured", unknown: "Unknown", notSpecified: "Not specified", preferred: " preferred",
    p95: "Regional P95 slope", mean: "Regional mean slope", window: "Analysis window", grid: "Analysis grid spacing",
    mask: "Land / water mask", land: "% land", notComparable: "Not comparable across planets",
    summary: (s: string) => `Earth–${s} evidence comparison`, summaryTerrain: "Earth–requested terrain comparison",
    caption: (r: string, v: string) => `Morphology only · frozen ${r} reference v${v}`, captionTerrain: "Regional terrain criteria · no planetary similarity claim",
    measurement: "Measurement", earth: "Earth window", yours: "Your requirement",
    jsd: (d: string) => `Slope-distribution distance (base-2 Jensen–Shannon): ${d}. Lower means closer distributions; this is not a percentage of suitability. P95 alone does not determine this distance.`,
    sources: (planet: string) => `Earth: SRTMGL30 elevation + MOD44W land/water mask. ${planet} Grid spacing does not guarantee obstacle-scale accuracy. Boundary cells are excluded from slope statistics.`,
    planet: (p: string, d: string, lat: number, lon: number) => `${p}: ${d}, aggregated to the 1 km analysis grid; centre ${lat}°, ${lon}°.`,
    warning: "Geology, soil mechanics, climate and field access are not verified by this morphology comparison. Historical vegetation classes, when available, are shown separately below. Similar slopes do not establish an equivalent lunar or Martian environment.",
    tiles: "Earth DEM tiles:", waterMask: "Water mask:", indexed: "Indexed pilot: individual raster tile provenance is not included in this record.",
    frozen: "Frozen reference and measurements",
  },
};

const REPO = "https://github.com/marminguez/Parallax/blob/feat/exp001-jezero-rover/";

/** Frozen reference for this result; older saved results (before multi-target) were always Jezero. */
export function resultReference(result: SearchResult): (FrozenTarget & { id: string }) | null {
  if (result.request.mode === "facilities" || result.request.target === "terrain") return null;
  return result.planetaryReference ?? (result.request.target === "jezero" ? { id: "jezero", ...(jezero as FrozenTarget) } : null);
}

export default function TerrainComparison({ candidate, result }: { candidate: Candidate; result: SearchResult }) {
  const t = useT(T);
  if (result.request.mode === "facilities") return null;
  const reference = resultReference(result);
  const spec = reference && reference.id in planetaryTargets ? planetaryTargets[reference.id as keyof typeof planetaryTargets] : null;
  const name = reference ? `${reference.target.planet} · ${reference.target.region}` : "";
  const slope = reference?.terrain["1000m"]?.slope;
  const value = (n: number | null | undefined, unit = "°") => n === null || n === undefined ? t.notMeasured : n.toFixed(2) + unit;
  const rows = [
    [t.p95, value(candidate.slopeP95), reference ? value(slope?.p95_deg) : value(result.request.desiredSlopeP95) + t.preferred],
    [t.mean, value(candidate.slopeMean), reference ? value(slope?.mean_deg) : t.notSpecified],
    [t.window, `${result.provenance.footprintKm ?? t.unknown} × ${result.provenance.footprintKm ?? t.unknown} km`, reference ? `${reference.target.window_km} × ${reference.target.window_km} km` : t.notSpecified],
    [t.grid, `${result.provenance.resolutionM ?? t.unknown} m`, reference ? "1000 m" : t.notSpecified],
    [t.mask, candidate.landFraction === null ? t.notMeasured : `${(candidate.landFraction * 100).toFixed(2)}${t.land}`, t.notComparable],
  ];
  return <details className="mt-4 rounded-sm border border-white/10 p-3">
    <summary className="cursor-pointer text-sm text-[var(--earth-bright)]">{reference ? t.summary(spec?.short ?? reference.target.region) : t.summaryTerrain}</summary>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs">
      <caption className="mb-3 text-left text-[var(--text-secondary)]">{reference ? t.caption(reference.target.region, String(reference.version)) : t.captionTerrain}</caption>
      <thead><tr>{[t.measurement, t.earth, reference ? name : t.yours].map(label => <th key={label} scope="col" className="border-b border-white/15 px-2 py-2">{label}</th>)}</tr></thead>
      <tbody>{rows.map(([label, earth, target]) => <tr key={label}><th scope="row" className="px-2 py-2 font-normal">{label}</th><td className="px-2 py-2">{earth}</td><td className="px-2 py-2">{target}</td></tr>)}</tbody>
    </table></div>
    {reference && <p className="mt-3 text-xs leading-5">{t.jsd(candidate.jsd?.toFixed(4) ?? t.notMeasured)}</p>}
    <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">{t.sources(reference ? t.planet(reference.target.planet, reference.source.dataset, reference.target.center_lat_deg, reference.target.center_lon_deg) : "")}</p>
    <p className="mt-2 text-xs leading-5 text-[var(--warning)]">{t.warning}</p>
    {candidate.measurementProvenance ? <div className="mt-3 break-all text-xs leading-5 text-[var(--text-muted)]"><p>{t.tiles} {candidate.measurementProvenance.sourceTiles.join(", ")}</p><p>{t.waterMask} {candidate.measurementProvenance.waterMaskTile}</p></div> : <p className="mt-3 text-xs text-[var(--text-muted)]">{t.indexed}</p>}
    {spec && <a className="mt-3 inline-block text-xs underline" href={REPO + spec.frozen} target="_blank" rel="noopener noreferrer">{t.frozen}</a>}
  </details>;
}
