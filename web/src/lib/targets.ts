/** Frozen planetary references that Earth windows can be compared against. */

export const SLOPE_BINS = ["0-1", "1-2", "2-3", "3-5", "5-10", "10-15", "15-20", ">=20"] as const;

export const planetaryTargets = {
  jezero: {
    label: "Mars · Jezero crater (Perseverance landing site)",
    short: "Jezero",
    body: "Mars",
    file: "jezero-target.json",
    frozen: "results/exp001/jezero_target_50km_v0_4.json",
    build: "python scripts/build_jezero_target_50km_v0_4.py",
  },
  shackleton: {
    label: "Moon · Shackleton crater (lunar south pole)",
    short: "Shackleton",
    body: "Moon",
    file: "shackleton-target.json",
    frozen: "results/exp002/shackleton_target_50km_v0_1.json",
    build: "python scripts/build_lunar_target_50km.py --site shackleton",
  },
  // Artemis III candidate regions (config/search/artemis_references_v1.yaml): the 1 km fingerprint of each
  // region's VAL-004 lunar window, frozen unchanged.
  "peak-near-cabeus-b": {
    label: "Moon · Peak near Cabeus B (Artemis III candidate region)",
    short: "Peak near Cabeus B",
    body: "Moon",
    file: "artemis/peak-near-cabeus-b.json",
    frozen: "config/search/artemis_references_v1.yaml",
    build: "python scripts/artemis_references.py",
    artemis: true,
  },
  "haworth": {
    label: "Moon · Haworth (Artemis III candidate region)",
    short: "Haworth",
    body: "Moon",
    file: "artemis/haworth.json",
    frozen: "config/search/artemis_references_v1.yaml",
    build: "python scripts/artemis_references.py",
    artemis: true,
  },
  "malapert-massif": {
    label: "Moon · Malapert Massif (Artemis III candidate region)",
    short: "Malapert Massif",
    body: "Moon",
    file: "artemis/malapert-massif.json",
    frozen: "config/search/artemis_references_v1.yaml",
    build: "python scripts/artemis_references.py",
    artemis: true,
  },
  "mons-mouton-plateau": {
    label: "Moon · Mons Mouton Plateau (Artemis III candidate region)",
    short: "Mons Mouton Plateau",
    body: "Moon",
    file: "artemis/mons-mouton-plateau.json",
    frozen: "config/search/artemis_references_v1.yaml",
    build: "python scripts/artemis_references.py",
    artemis: true,
  },
  "mons-mouton": {
    label: "Moon · Mons Mouton (Artemis III candidate region)",
    short: "Mons Mouton",
    body: "Moon",
    file: "artemis/mons-mouton.json",
    frozen: "config/search/artemis_references_v1.yaml",
    build: "python scripts/artemis_references.py",
    artemis: true,
  },
  "nobile-rim-1": {
    label: "Moon · Nobile Rim 1 (Artemis III candidate region)",
    short: "Nobile Rim 1",
    body: "Moon",
    file: "artemis/nobile-rim-1.json",
    frozen: "config/search/artemis_references_v1.yaml",
    build: "python scripts/artemis_references.py",
    artemis: true,
  },
  "nobile-rim-2": {
    label: "Moon · Nobile Rim 2 (Artemis III candidate region)",
    short: "Nobile Rim 2",
    body: "Moon",
    file: "artemis/nobile-rim-2.json",
    frozen: "config/search/artemis_references_v1.yaml",
    build: "python scripts/artemis_references.py",
    artemis: true,
  },
  "de-gerlache-rim-2": {
    label: "Moon · de Gerlache Rim 2 (Artemis III candidate region)",
    short: "de Gerlache Rim 2",
    body: "Moon",
    file: "artemis/de-gerlache-rim-2.json",
    frozen: "config/search/artemis_references_v1.yaml",
    build: "python scripts/artemis_references.py",
    artemis: true,
  },
  "slater-plain": {
    label: "Moon · Slater Plain (Artemis III candidate region)",
    short: "Slater Plain",
    body: "Moon",
    file: "artemis/slater-plain.json",
    frozen: "config/search/artemis_references_v1.yaml",
    build: "python scripts/artemis_references.py",
    artemis: true,
  },
} as const;
export type PlanetaryTargetId = keyof typeof planetaryTargets;
export const isArtemisRegion = (id: string) => isPlanetaryTarget(id) && "artemis" in planetaryTargets[id];
export const isPlanetaryTarget = (id: string): id is PlanetaryTargetId => Object.hasOwn(planetaryTargets, id);

/** Shape shared by every frozen target JSON (results/exp00x/*_target_50km_*.json). */
export type FrozenTarget = {
  version: string;
  target: { planet: string; region: string; reference: string; center_lat_deg: number; center_lon_deg: number; window_km: number; id?: string; reference_url?: string; context?: string };
  source: { dataset: string; native_resolution_m: number; url?: string; citation?: string };
  /** Regional mean and P95 are absent from references frozen from VAL-004 windows (Artemis III regions). */
  terrain: Record<string, { slope: { mean_deg?: number; p95_deg?: number; distribution_pct: Record<string, number> } }>;
};

/** Normalised 1 km slope histogram of a frozen target, in SLOPE_BINS order. */
export function targetHistogram(target: FrozenTarget): number[] {
  const pct = target.terrain?.["1000m"]?.slope?.distribution_pct;
  if (!pct) throw new Error("Target has no 1000 m slope distribution.");
  const values = SLOPE_BINS.map(bin => pct[bin]);
  if (values.some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0)) throw new Error("Target slope distribution is incomplete.");
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error("Target slope distribution has no mass.");
  return values.map(v => v / total);
}

/** Base-2 Jensen–Shannon distance (0 = identical, 1 = disjoint), as in src/parallax/matching/similarity.py. */
export function jensenShannonDistance(p: readonly number[], q: readonly number[]): number {
  if (p.length !== q.length || !p.length) throw new Error("Distributions must have the same, non-zero length.");
  if ([...p, ...q].some(v => !Number.isFinite(v) || v < 0)) throw new Error("Probabilities must be finite and non-negative.");
  const sp = p.reduce((a, b) => a + b, 0);
  const sq = q.reduce((a, b) => a + b, 0);
  if (sp <= 0 || sq <= 0) throw new Error("Distributions must contain positive mass.");
  let divergence = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i] / sp;
    const b = q[i] / sq;
    const m = (a + b) / 2;
    if (a > 0) divergence += 0.5 * a * Math.log2(a / m);
    if (b > 0) divergence += 0.5 * b * Math.log2(b / m);
  }
  return Math.sqrt(Math.max(0, divergence));
}
