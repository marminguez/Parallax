import Link from "next/link";

const ArrowUpRight = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

const Plus = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const OrbitMark = () => (
  <div className="relative h-8 w-8">
    <div className="absolute left-[2px] top-[9px] h-3 w-3 rounded-full bg-[var(--mars-primary)] shadow-[0_0_18px_rgba(215,106,58,.45)]" />
    <div className="absolute bottom-[7px] right-[2px] h-3 w-3 rounded-full bg-[var(--earth-primary)] shadow-[0_0_18px_rgba(104,185,234,.45)]" />
    <div className="absolute inset-[2px] rotate-[-24deg] rounded-[50%] border border-white/25" />
  </div>
);

export default function Home() {
  return (
    <main className="parallax-grid min-h-screen bg-[var(--space-void)] text-[var(--text-primary)]">
      <header className="border-b border-white/[0.07] bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <OrbitMark />
            <div>
              <div className="text-[15px] font-semibold tracking-[0.32em]">
                PARALLAX
              </div>
              <div className="mt-0.5 text-[8px] uppercase tracking-[0.28em] text-[var(--text-muted)]">
                Planetary Analog Intelligence
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm md:flex">
            <span className="text-white">Experiments</span>
            <span className="cursor-default text-[var(--text-muted)]">
              Discover
            </span>
            <span className="cursor-default text-[var(--text-muted)]">
              Compare
            </span>
          </nav>

          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)] shadow-[0_0_8px_var(--positive)]" />
            Engine online
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-6 pb-20 pt-16 lg:px-10 lg:pt-20">
        <div className="flex flex-col justify-between gap-10 lg:flex-row lg:items-end">
          <div>
            <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
              <span className="h-px w-8 bg-[var(--mars-primary)]" />
              Mission workspace
            </div>

            <h1 className="max-w-4xl text-4xl font-light tracking-[-0.045em] sm:text-5xl lg:text-[64px] lg:leading-[1.02]">
              Another world.
              <br />
              <span className="parallax-gradient-text">
                The right place on this one.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-[15px] leading-7 text-[var(--text-secondary)]">
              Define the planetary environment and mission conditions you need
              to reproduce. PARALLAX searches Earth for the places where those
              conditions are most likely to exist.
            </p>
          </div>

          <Link
            href="/experiments/new"
            className="group flex h-12 shrink-0 items-center justify-center gap-3 rounded-sm bg-white px-5 text-sm font-medium transition hover:bg-[var(--earth-bright)]"
            style={{ color: "#030405" }}
          >
            <Plus />
            New experiment
            <ArrowUpRight />
          </Link>
        </div>

        <div className="mt-20 flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-sm font-medium">Experiments</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Mission-specific planetary analog searches
            </p>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            01 experiment
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.65fr_.7fr]">
          <article className="parallax-panel group relative overflow-hidden rounded-sm">
            <div className="absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-[var(--mars-primary)] via-white/40 to-[var(--earth-primary)]" />

            <div className="absolute right-[-90px] top-[-110px] h-[320px] w-[320px] rounded-full border border-[var(--mars-primary)]/10" />
            <div className="absolute right-[-35px] top-[-55px] h-[210px] w-[210px] rounded-full border border-[var(--earth-primary)]/10" />

            <div className="relative p-7 lg:p-9">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--mars-bright)]">
                      EXP-001
                    </span>
                    <span className="rounded-full border border-[var(--positive)]/25 bg-[var(--positive)]/[0.06] px-2.5 py-1 text-[9px] uppercase tracking-[0.15em] text-[var(--positive)]">
                      Completed
                    </span>
                  </div>

                  <h3 className="mt-5 text-2xl font-medium tracking-[-0.025em] sm:text-3xl">
                    Jezero Rover Mobility
                  </h3>

                  <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
                    Identify terrestrial candidates whose terrain morphology
                    statistically resembles the Jezero mission footprint for
                    rover mobility testing.
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-[var(--text-secondary)] transition group-hover:border-[var(--earth-primary)]/40 group-hover:text-white">
                  <ArrowUpRight />
                </div>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/[0.07] bg-white/[0.07] sm:grid-cols-4">
                <div className="bg-[var(--space-deep)] p-4">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Target
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 rounded-full bg-[var(--mars-primary)]" />
                    Mars · Jezero
                  </div>
                </div>

                <div className="bg-[var(--space-deep)] p-4">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Mission
                  </div>
                  <div className="mt-2 text-sm">Rover mobility</div>
                </div>

                <div className="bg-[var(--space-deep)] p-4">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Footprint
                  </div>
                  <div className="mt-2 font-mono text-sm">50 × 50 km</div>
                </div>

                <div className="bg-[var(--space-deep)] p-4">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Discovery
                  </div>
                  <div className="mt-2 text-sm">Blind search</div>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/[0.07] pt-6">
                <div>
                  <div className="font-mono text-xl text-white">690,069</div>
                  <div className="mt-1 text-[9px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                    Candidate windows
                  </div>
                </div>

                <div className="h-8 w-px bg-white/[0.08]" />

                <div>
                  <div className="font-mono text-xl text-white">1,001</div>
                  <div className="mt-1 text-[9px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                    Pilot samples evaluated
                  </div>
                </div>

                <div className="h-8 w-px bg-white/[0.08]" />

                <div>
                  <div className="font-mono text-xl text-[var(--earth-bright)]">
                    0.081
                  </div>
                  <div className="mt-1 text-[9px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                    Best observed morphology JSD
                  </div>
                </div>
              </div>
            </div>
          </article>

          <button className="group flex min-h-[310px] flex-col items-center justify-center rounded-sm border border-dashed border-white/[0.12] bg-white/[0.015] p-8 text-center transition hover:border-[var(--earth-primary)]/35 hover:bg-[var(--earth-primary)]/[0.025]">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.12] text-[var(--text-secondary)] transition group-hover:border-[var(--earth-primary)]/50 group-hover:text-[var(--earth-bright)]">
              <Plus />
            </div>
            <div className="mt-5 text-sm font-medium">Create new experiment</div>
            <div className="mt-2 max-w-[250px] text-xs leading-5 text-[var(--text-muted)]">
              Define a planetary target and the mission conditions you need to
              reproduce on Earth.
            </div>
          </button>
        </div>

        <div className="mt-14 flex flex-col justify-between gap-4 border-t border-white/[0.06] pt-5 text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)] sm:flex-row">
          <span>PARALLAX · EXPERIMENTAL RESEARCH PLATFORM</span>
          <span>
            Orbital evidence → Candidate discovery → Field validation
          </span>
        </div>
      </section>
    </main>
  );
}
