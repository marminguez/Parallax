import Link from "next/link";
import DiscoveryMap from "@/components/parallax/DiscoveryMap";

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

const candidates = [
  {
    rank: "01",
    region: "Western Ethiopia",
    coordinates: "10.5497° N · 37.1665° E",
    jsd: "0.090",
    note: "Broad coherent morphology cluster",
  },
  {
    rank: "02",
    region: "Central Mexico",
    coordinates: "22.4657° N · 103.0135° W",
    jsd: "0.129",
    note: "Localized morphology hotspot",
  },
  {
    rank: "03",
    region: "Eastern Anatolia",
    coordinates: "39.1031° N · 42.5744° E",
    jsd: "0.081",
    note: "Best morphology match observed",
  },
];

export default function Discover() {
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

          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-[var(--mars-bright)]">
              EXP-001
            </span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Jezero Rover Mobility
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-6 pb-24 pt-10 lg:px-10">
        <Link
          href="/experiments/new"
          className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] transition hover:text-white"
        >
          <ArrowLeft />
          Experiment definition
        </Link>

        <div className="mt-9 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-[var(--earth-bright)]">
              <span className="h-px w-7 bg-[var(--earth-primary)]" />
              Blind discovery
            </div>

            <h1 className="mt-5 text-4xl font-light tracking-[-0.045em] sm:text-5xl">
              Where on Earth should we
              <br />
              <span className="parallax-gradient-text">
                test this mission?
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
              PARALLAX compares the mission fingerprint against terrestrial
              observation data without encoding known analog locations into
              the search.
            </p>
          </div>

          <div className="rounded-full border border-[var(--positive)]/25 bg-[var(--positive)]/[0.05] px-4 py-2 text-[9px] uppercase tracking-[0.15em] text-[var(--positive)]">
            Discovery completed
          </div>
        </div>

        <section className="mt-14 grid items-stretch gap-3 lg:grid-cols-[1fr_80px_1.35fr_80px_1fr]">
          <div className="mars-glow rounded-sm border border-[var(--mars-primary)]/25 bg-[var(--mars-primary)]/[0.045] p-6">
            <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--mars-bright)]">
              Planetary target
            </div>
            <div className="mt-5 flex items-center gap-4">
              <div className="h-11 w-11 rounded-full bg-[var(--mars-primary)] shadow-[inset_-10px_-5px_18px_rgba(0,0,0,.4),0_0_28px_rgba(215,106,58,.18)]" />
              <div>
                <div className="text-lg font-medium">Mars</div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  Jezero Crater · 50 × 50 km
                </div>
              </div>
            </div>
          </div>

          <div className="hidden items-center justify-center lg:flex">
            <div className="h-px flex-1 bg-gradient-to-r from-[var(--mars-primary)]/60 to-white/20" />
            <ArrowRight />
          </div>

          <div className="parallax-panel rounded-sm p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[9px] uppercase tracking-[0.16em] text-white">
                Mission fingerprint
              </div>
              <div className="font-mono text-[9px] text-[var(--text-muted)]">
                ROVER MOBILITY
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <div className="rounded-sm border border-white/[0.07] bg-black/20 p-3">
                <div className="text-[9px] uppercase tracking-[0.13em] text-[var(--text-muted)]">
                  Morphology
                </div>
                <div className="mt-2 text-xs">Slope distribution</div>
              </div>

              <div className="rounded-sm border border-white/[0.07] bg-black/20 p-3">
                <div className="text-[9px] uppercase tracking-[0.13em] text-[var(--text-muted)]">
                  Surface
                </div>
                <div className="mt-2 text-xs">Dry · low vegetation</div>
              </div>

              <div className="rounded-sm border border-white/[0.07] bg-black/20 p-3">
                <div className="text-[9px] uppercase tracking-[0.13em] text-[var(--text-muted)]">
                  Eligibility
                </div>
                <div className="mt-2 text-xs">Land · valid coverage</div>
              </div>
            </div>
          </div>

          <div className="hidden items-center justify-center text-[var(--earth-primary)] lg:flex">
            <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-[var(--earth-primary)]/60" />
            <ArrowRight />
          </div>

          <div className="earth-glow rounded-sm border border-[var(--earth-primary)]/25 bg-[var(--earth-primary)]/[0.04] p-6">
            <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--earth-bright)]">
              Earth search
            </div>
            <div className="mt-5 flex items-center gap-4">
              <div className="relative h-11 w-11 rounded-full border border-[var(--earth-primary)]/35 bg-[var(--earth-deep)]">
                <div className="absolute left-[8px] top-[11px] h-2 w-4 rotate-[-20deg] rounded-full bg-[var(--earth-primary)]/55" />
                <div className="absolute bottom-[8px] right-[7px] h-3 w-2 rotate-[30deg] rounded-full bg-[var(--earth-primary)]/45" />
              </div>
              <div>
                <div className="text-lg font-medium">Earth</div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  Blind candidate discovery
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-px overflow-hidden rounded-sm border border-white/[0.08] bg-white/[0.08] sm:grid-cols-4">
          {[
            ["690,069", "Candidate search space"],
            ["1,001", "Pilot samples evaluated"],
            ["224", "Eligible candidates"],
            ["3", "Priority regions refined"],
          ].map(([value, label]) => (
            <div key={label} className="bg-[var(--space-deep)] p-5">
              <div className="font-mono text-2xl text-white">{value}</div>
              <div className="mt-2 text-[9px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {label}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-6">
          <DiscoveryMap />
        </section>

        <div className="mt-14 flex items-end justify-between border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-sm font-medium">Priority candidates</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Morphology discovery followed by regional refinement
            </p>
          </div>

          <div className="hidden font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--text-muted)] sm:block">
            Lower JSD = closer terrain distribution
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {candidates.map((candidate) => (
            <article
              key={candidate.region}
              className={`group relative overflow-hidden rounded-sm border p-6 transition ${
                candidate.region === "Eastern Anatolia"
                  ? "border-[var(--earth-primary)]/35 bg-[var(--earth-primary)]/[0.035]"
                  : "border-white/[0.08] bg-[var(--space-deep)]"
              }`}
            >
              {candidate.region === "Eastern Anatolia" && (
                <div className="absolute right-4 top-4 rounded-full border border-[var(--earth-primary)]/25 px-2.5 py-1 text-[8px] uppercase tracking-[0.13em] text-[var(--earth-bright)]">
                  Best observed
                </div>
              )}

              <div className="font-mono text-[9px] text-[var(--text-muted)]">
                CANDIDATE {candidate.rank}
              </div>

              <h3 className="mt-5 text-xl font-medium">{candidate.region}</h3>

              <div className="mt-2 font-mono text-[10px] text-[var(--text-muted)]">
                {candidate.coordinates}
              </div>

              <div className="mt-7 border-y border-white/[0.07] py-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Morphology distance
                    </div>
                    <div className="mt-2 font-mono text-2xl text-white">
                      {candidate.jsd}
                    </div>
                  </div>
                  <div className="font-mono text-[9px] text-[var(--text-muted)]">
                    JSD
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">
                {candidate.note}
              </p>

              <div className="mt-6 flex items-center justify-between text-xs text-[var(--earth-bright)]">
                <span>Inspect candidate</span>
                <ArrowRight />
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-sm border border-[var(--warning)]/20 bg-[var(--warning)]/[0.03] p-5">
          <div className="text-[9px] uppercase tracking-[0.15em] text-[var(--warning)]">
            Scientific interpretation
          </div>
          <p className="mt-2 max-w-5xl text-[11px] leading-5 text-[var(--text-secondary)]">
            These are candidate locations for further investigation. A low
            morphology distance does not establish planetary-analog status or
            rover trafficability. Soil mechanics, wheel slip, sinkage, bearing
            strength and small-scale hazards require field validation.
          </p>
        </div>
      </section>
    </main>
  );
}
