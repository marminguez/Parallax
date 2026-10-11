import type { Candidate } from "@/lib/search";

export default function LandCoverEvidence({ candidate }: { candidate: Candidate }) {
  const cover = candidate.landCover;
  if (!cover) return <p className="mt-4 rounded-sm border border-white/10 p-3 text-xs leading-5 text-[var(--text-secondary)]">Land cover has not been measured for this indexed record. Use a live search with local WorldCover tiles to characterize the window.</p>;
  const measured = (cover.status === "available" || cover.status === "partial") && cover.classifiedSamples > 0;
  return <section className="mt-4 rounded-sm border border-white/10 p-3" aria-label="Historical land cover evidence">
    <h4 className="text-sm text-[var(--earth-bright)]">Land cover · {cover.dataset} {cover.year} {cover.version}</h4>
    {!measured ? <p className="mt-2 text-xs leading-5 text-[var(--warning)]">{cover.message}</p> : <>
      <p className="mt-2 text-xs leading-5">{(cover.coverageFraction * 100).toFixed(2)}% of grid samples classified · {cover.classifiedSamples.toLocaleString()} / {cover.totalSamples.toLocaleString()} samples.</p>
      {cover.status === "partial" && <p className="mt-2 text-xs text-[var(--warning)]">Partial coverage. The percentages below describe only classified samples; missing surface is unknown.</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{cover.classes.filter(c => c.samples > 0).sort((a, b) => b.samples - a.samples).map(c => <div key={c.code} className="text-xs">
        <div className="flex justify-between gap-3"><span>{c.label}</span><span className="font-mono">{(c.fractionOfClassified * 100).toFixed(2)}%</span></div>
        <div className="mt-1 h-1.5 bg-white/5" aria-hidden="true"><div className="h-full bg-[var(--earth-primary)]" style={{ width: `${c.fractionOfClassified * 100}%` }} /></div>
      </div>)}</div>
      <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">Estimated proportions from nearest-neighbour sampling on a {cover.analysisResolutionM} m grid within the {cover.windowKm} × {cover.windowKm} km analysis window. Source map: nominal {cover.nativeResolutionM} m. These are not exact counts of all native pixels.</p>
      <p className="mt-2 text-xs leading-5 text-[var(--warning)]">Historical {cover.year} classification, not current conditions. Bare / sparse vegetation includes sparsely vegetated surfaces; it does not prove exposed regolith, dry soil, continuous testable space or field access. Land cover does not change the morphology ranking or verify critical requirements.</p>
    </>}
    <a className="mt-3 inline-block text-xs underline" href={cover.source} target="_blank" rel="noopener noreferrer">Dataset and citation · CC BY 4.0</a>
    <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">{cover.attribution}</p>
    {!!cover.sourceTiles.length && <details className="mt-2 break-all text-xs text-[var(--text-muted)]"><summary>Land-cover source files</summary>{cover.sourceTiles.map(t => <p key={t.name} className="mt-1">{t.name}{t.sha256 ? ` · SHA-256 recorded at download: ${t.sha256}` : " · no file checksum recorded"}</p>)}</details>}
  </section>;
}
