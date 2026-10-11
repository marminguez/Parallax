import Link from "next/link";

const ArrowLeft = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const OrbitMark = () => (
  <div className="relative h-8 w-8">
    <div className="absolute left-[2px] top-[9px] h-3 w-3 rounded-full bg-[var(--mars-primary)] shadow-[0_0_18px_rgba(215,106,58,.45)]" />
    <div className="absolute bottom-[7px] right-[2px] h-3 w-3 rounded-full bg-[var(--earth-primary)] shadow-[0_0_18px_rgba(104,185,234,.45)]" />
    <div className="absolute inset-[2px] rotate-[-24deg] rounded-[50%] border border-white/25" />
  </div>
);

export default function NewExperiment() {
  return (
    <main className="parallax-grid min-h-screen bg-[var(--space-void)] text-[var(--text-primary)]">
      <header className="border-b border-white/[0.07] bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <OrbitMark />
            <div>
              <div className="text-[15px] font-semibold tracking-[0.32em]">
                PARALLAX
              </div>
              <div className="mt-0.5 text-[8px] uppercase tracking-[0.28em] text-[var(--text-muted)]">
                Planetary Analog Intelligence
              </div>
            </div>
          </Link>

          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            New experiment
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1320px] px-6 pb-24 pt-12 lg:px-10 lg:pt-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] transition hover:text-white"
        >
          <ArrowLeft />
          Experiments
        </Link>

        <div className="mt-10 grid gap-14 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-[var(--mars-bright)]">
              <span className="h-px w-7 bg-[var(--mars-primary)]" />
              Experiment definition
            </div>

            <h1 className="mt-5 text-4xl font-light tracking-[-0.04em] sm:text-5xl">
              What do you need to
              <br />
              <span className="parallax-gradient-text">
                reproduce on Earth?
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
              Define the planetary environment and mission objective.
              PARALLAX translates them into observable conditions and searches
              for terrestrial candidates.
            </p>

            <div className="mt-14 space-y-10">
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[10px] text-[var(--mars-bright)]">
                      01
                    </div>
                    <h2 className="mt-1 text-sm font-medium">
                      Planetary target
                    </h2>
                  </div>
                  <span className="text-[9px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    Required
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button className="relative overflow-hidden rounded-sm border border-[var(--mars-primary)]/50 bg-[var(--mars-primary)]/[0.06] p-5 text-left">
                    <div className="absolute right-[-30px] top-[-35px] h-28 w-28 rounded-full border border-[var(--mars-primary)]/15" />
                    <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      World
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-base">
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--mars-primary)] shadow-[0_0_12px_rgba(215,106,58,.4)]" />
                      Mars
                    </div>
                  </button>

                  <div className="rounded-sm border border-white/[0.09] bg-[var(--space-deep)] p-5">
                    <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Region
                    </div>
                    <div className="mt-3 text-base">Jezero Crater</div>
                    <div className="mt-2 font-mono text-[10px] text-[var(--text-muted)]">
                      18.44463° N · 77.45088° E
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-4">
                  <div className="font-mono text-[10px] text-[var(--mars-bright)]">
                    02
                  </div>
                  <h2 className="mt-1 text-sm font-medium">
                    Mission objective
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    What will the terrestrial analog be used to test?
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <button className="rounded-sm border border-[var(--earth-primary)]/45 bg-[var(--earth-primary)]/[0.055] p-5 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Rover mobility
                      </span>
                      <span className="h-2 w-2 rounded-full bg-[var(--earth-primary)]" />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
                      Terrain morphology and surface conditions for rover field
                      testing.
                    </p>
                    <div className="mt-4 text-[9px] uppercase tracking-[0.14em] text-[var(--positive)]">
                      Validated pipeline
                    </div>
                  </button>

                  {[
                    "Geological field operations",
                    "Human surface operations",
                    "Instrument testing",
                    "Habitat / EVA operations",
                    "Custom mission",
                  ].map((mission) => (
                    <div
                      key={mission}
                      className="rounded-sm border border-white/[0.07] bg-white/[0.015] p-5 opacity-55"
                    >
                      <div className="text-sm">{mission}</div>
                      <div className="mt-4 text-[9px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        Coming next
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-4">
                  <div className="font-mono text-[10px] text-[var(--mars-bright)]">
                    03
                  </div>
                  <h2 className="mt-1 text-sm font-medium">
                    Experiment setup
                  </h2>
                </div>

                <div className="grid gap-px overflow-hidden rounded-sm border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2">
                  <div className="bg-[var(--space-deep)] p-5">
                    <div className="text-[9px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                      Search footprint
                    </div>
                    <div className="mt-3 font-mono text-base">
                      50 × 50 km
                    </div>
                    <div className="mt-2 text-xs text-[var(--text-muted)]">
                      Fixed mission comparison window
                    </div>
                  </div>

                  <div className="bg-[var(--space-deep)] p-5">
                    <div className="text-[9px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                      Discovery mode
                    </div>
                    <div className="mt-3 text-base">Blind global search</div>
                    <div className="mt-2 text-xs text-[var(--text-muted)]">
                      No known analog locations encoded
                    </div>
                  </div>
                </div>
              </section>

              <section className="parallax-panel rounded-sm p-6">
                <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                  <div>
                    <div className="font-mono text-[10px] text-[var(--earth-bright)]">
                      04 · MISSION FINGERPRINT
                    </div>
                    <h2 className="mt-2 text-lg font-medium">
                      PARALLAX translates the mission into observable evidence
                    </h2>
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--text-secondary)]">
                      The ranking engine uses reproducible geospatial evidence.
                      Generative AI does not determine candidate ranking.
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-[var(--positive)]/25 bg-[var(--positive)]/[0.05] px-3 py-1.5 text-[9px] uppercase tracking-[0.13em] text-[var(--positive)]">
                    Pipeline ready
                  </span>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <div className="rounded-sm border border-white/[0.07] bg-black/20 p-4">
                    <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Terrain morphology
                    </div>
                    <div className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
                      Slope distribution · relief · multiscale terrain structure
                    </div>
                  </div>

                  <div className="rounded-sm border border-white/[0.07] bg-black/20 p-4">
                    <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Surface screening
                    </div>
                    <div className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
                      Vegetation · moisture · exposed-surface signal
                    </div>
                  </div>

                  <div className="rounded-sm border border-white/[0.07] bg-black/20 p-4">
                    <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Operational eligibility
                    </div>
                    <div className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
                      Land availability · valid coverage · footprint integrity
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <aside className="lg:pt-8">
            <div className="sticky top-8">
              <div className="parallax-panel rounded-sm p-6">
                <div className="font-mono text-[9px] uppercase tracking-[0.17em] text-[var(--text-muted)]">
                  Experiment preview
                </div>

                <div className="mt-5 font-mono text-[10px] text-[var(--mars-bright)]">
                  EXP-002
                </div>

                <h3 className="mt-2 text-xl font-medium">
                  Jezero Rover Mobility
                </h3>

                <div className="mt-6 space-y-4 border-y border-white/[0.07] py-5">
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-[var(--text-muted)]">Target</span>
                    <span>Mars · Jezero</span>
                  </div>
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-[var(--text-muted)]">Mission</span>
                    <span>Rover mobility</span>
                  </div>
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-[var(--text-muted)]">Footprint</span>
                    <span className="font-mono">50 × 50 km</span>
                  </div>
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-[var(--text-muted)]">Mode</span>
                    <span>Blind discovery</span>
                  </div>
                </div>

                <Link
                  href="/experiments/exp-001/discover"
                  className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-sm bg-white text-sm font-medium transition hover:bg-[var(--earth-bright)]"
                  style={{ color: "#030405" }}
                >
                  Create experiment
                  <ArrowRight />
                </Link>

                <p className="mt-4 text-[10px] leading-4 text-[var(--text-muted)]">
                  Hackathon MVP · Rover Mobility is currently the validated
                  end-to-end experiment pipeline.
                </p>
              </div>

              <div className="mt-4 rounded-sm border border-[var(--warning)]/20 bg-[var(--warning)]/[0.035] p-5">
                <div className="text-[9px] uppercase tracking-[0.15em] text-[var(--warning)]">
                  Field validation required
                </div>
                <p className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                  Orbital data cannot determine soil bearing strength, wheel
                  slip, sinkage or small rock hazards. PARALLAX identifies
                  candidates for further investigation — not rover-safe sites.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
