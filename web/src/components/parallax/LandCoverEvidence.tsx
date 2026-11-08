"use client";
import type { Candidate } from "@/lib/search";
import { useLang, useT } from "@/lib/i18n";

const CLASS_ES: Record<number, string> = { 10: "Cubierta arbórea", 20: "Matorral", 30: "Pradera", 40: "Cultivos", 50: "Construido", 60: "Suelo desnudo / vegetación escasa", 70: "Nieve y hielo", 80: "Agua permanente", 90: "Humedal herbáceo", 95: "Manglar", 100: "Musgo y liquen" };
const T = {
  es: {
    none: "La cubierta del suelo no se ha medido en este registro indexado. Usa una búsqueda en vivo con teselas locales de WorldCover para caracterizar la ventana.",
    title: "Cubierta del suelo", coverage: (p: string, a: string, b: string) => `${p} % de las muestras clasificadas · ${a} / ${b} muestras.`,
    partial: "Cobertura parcial. Los porcentajes de abajo describen solo las muestras clasificadas; la superficie que falta es desconocida.",
    method: (g: number, w: number, n: number) => `Proporciones estimadas por muestreo del vecino más próximo en una rejilla de ${g} m dentro de la ventana de análisis de ${w} × ${w} km. Mapa de origen: ${n} m nominales. No son recuentos exactos de todos los píxeles nativos.`,
    warning: (y: number) => `Clasificación histórica de ${y}, no condiciones actuales. «Suelo desnudo / vegetación escasa» incluye superficies con poca vegetación; no prueba regolito expuesto, suelo seco, espacio continuo ensayable ni acceso. La cubierta del suelo no cambia el orden morfológico ni verifica requisitos críticos.`,
    dataset: "Conjunto de datos y cita · CC BY 4.0", files: "Ficheros de origen de la cubierta",
    sha: (h: string) => ` · SHA-256 registrado al descargar: ${h}`, noSha: " · sin suma de control registrada",
  },
  en: {
    none: "Land cover has not been measured for this indexed record. Use a live search with local WorldCover tiles to characterize the window.",
    title: "Land cover", coverage: (p: string, a: string, b: string) => `${p}% of grid samples classified · ${a} / ${b} samples.`,
    partial: "Partial coverage. The percentages below describe only classified samples; missing surface is unknown.",
    method: (g: number, w: number, n: number) => `Estimated proportions from nearest-neighbour sampling on a ${g} m grid within the ${w} × ${w} km analysis window. Source map: nominal ${n} m. These are not exact counts of all native pixels.`,
    warning: (y: number) => `Historical ${y} classification, not current conditions. Bare / sparse vegetation includes sparsely vegetated surfaces; it does not prove exposed regolith, dry soil, continuous testable space or field access. Land cover does not change the morphology ranking or verify critical requirements.`,
    dataset: "Dataset and citation · CC BY 4.0", files: "Land-cover source files",
    sha: (h: string) => ` · SHA-256 recorded at download: ${h}`, noSha: " · no file checksum recorded",
  },
};

export default function LandCoverEvidence({ candidate }: { candidate: Candidate }) {
  const t = useT(T);
  const { lang } = useLang();
  const cover = candidate.landCover;
  if (!cover) return <p className="mt-4 rounded-sm border border-white/10 p-3 text-xs leading-5 text-[var(--text-secondary)]">{t.none}</p>;
  const measured = (cover.status === "available" || cover.status === "partial") && cover.classifiedSamples > 0;
  return <section className="mt-4 rounded-sm border border-white/10 p-3" aria-label="Historical land cover evidence">
    <h4 className="text-sm text-[var(--earth-bright)]">{t.title} · {cover.dataset} {cover.year} {cover.version}</h4>
    {!measured ? <p className="mt-2 text-xs leading-5 text-[var(--warning)]">{cover.message}</p> : <>
      <p className="mt-2 text-xs leading-5">{t.coverage((cover.coverageFraction * 100).toFixed(2), cover.classifiedSamples.toLocaleString(lang), cover.totalSamples.toLocaleString(lang))}</p>
      {cover.status === "partial" && <p className="mt-2 text-xs text-[var(--warning)]">{t.partial}</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{cover.classes.filter(c => c.samples > 0).sort((a, b) => b.samples - a.samples).map(c => <div key={c.code} className="text-xs">
        <div className="flex justify-between gap-3"><span>{lang === "es" ? CLASS_ES[c.code] ?? c.label : c.label}</span><span className="font-mono">{(c.fractionOfClassified * 100).toFixed(2)}%</span></div>
        <div className="mt-1 h-1.5 bg-white/5" aria-hidden="true"><div className="h-full bg-[var(--earth-primary)]" style={{ width: `${c.fractionOfClassified * 100}%` }} /></div>
      </div>)}</div>
      <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">{t.method(cover.analysisResolutionM, cover.windowKm, cover.nativeResolutionM)}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--warning)]">{t.warning(cover.year)}</p>
    </>}
    <a className="mt-3 inline-block text-xs underline" href={cover.source} target="_blank" rel="noopener noreferrer">{t.dataset}</a>
    <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">{cover.attribution}</p>
    {!!cover.sourceTiles.length && <details className="mt-2 break-all text-xs text-[var(--text-muted)]"><summary>{t.files}</summary>{cover.sourceTiles.map(tile => <p key={tile.name} className="mt-1">{tile.name}{tile.sha256 ? t.sha(tile.sha256) : t.noSha}</p>)}</details>}
  </section>;
}
