"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang, useT } from "@/lib/i18n";

const NAV = {
  es: { missions: "Misiones", education: "Educación", territory: "Territorio", underfoot: "¿Qué Luna tienes?", workspace: "Experimentos", lang: "English", langShort: "EN", menu: "Secciones" },
  en: { missions: "Missions", education: "Education", territory: "Territory", underfoot: "What Moon is yours?", workspace: "Experiments", lang: "Español", langShort: "ES", menu: "Sections" },
};

export function Mark({ size = 28 }: { size?: number }) {
  // Two bodies on one orbit: the same terrain, seen from two worlds.
  return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <ellipse cx="16" cy="16" rx="13" ry="7.5" transform="rotate(-24 16 16)" fill="none" stroke="rgba(255,255,255,.28)" />
    <circle cx="7.5" cy="12.5" r="3.4" fill="var(--mars-primary)" />
    <circle cx="24.5" cy="19.5" r="3.4" fill="var(--earth-primary)" />
  </svg>;
}

/**
 * The PARALLAX wordmark from the team's logo: wide, thin capitals (the A has no crossbar) on a
 * horizon line that runs from Mars orange to Earth blue. Drawn as SVG so it stays sharp at header size.
 */
export function Wordmark({ height = 18, className = "" }: { height?: number; className?: string }) {
  const letters: [number, string][] = [
    [0, "M2 50V12h29c8 0 12 4 12 11s-4 11-12 11H2"],
    [72, "M0 50 22 11l22 39"],
    [144, "M2 50V12h29c8 0 12 4 12 11s-4 11-12 11H2m25 0 16 16"],
    [216, "M0 50 22 11l22 39"],
    [288, "M2 11v38h40"],
    [356, "M2 11v38h40"],
    [424, "M0 50 22 11l22 39"],
    [496, "m1 11 42 39m0-39L1 50"],
  ];
  return <svg viewBox="-24 0 588 60" height={height} width={(height * 588) / 60} className={className} role="img" aria-label="Parallax">
    <defs>
      <linearGradient id="parallax-horizon" x1="0" x2="1">
        <stop offset="0" stopColor="var(--mars-primary)" stopOpacity="0" />
        <stop offset=".18" stopColor="var(--mars-primary)" />
        <stop offset=".5" stopColor="#ffffff" />
        <stop offset=".82" stopColor="var(--earth-primary)" />
        <stop offset="1" stopColor="var(--earth-primary)" stopOpacity="0" />
      </linearGradient>
    </defs>
    <rect x="-24" y="42.5" width="588" height="2" fill="url(#parallax-horizon)" />
    <g fill="none" stroke="#fff" strokeWidth="4.2" strokeLinejoin="miter">
      {letters.map(([x, d]) => <path key={x} d={d} transform={`translate(${x} 0)`} />)}
    </g>
  </svg>;
}

export function SiteHeader() {
  const t = useT(NAV);
  const { lang, setLang } = useLang();
  const path = usePathname();
  const links: { href: string; base?: string; label: string; color: string }[] = [
    { href: "/misiones", label: t.missions, color: "var(--earth-primary)" },
    { href: "/educacion", label: t.education, color: "var(--moon)" },
    { href: "/territorio", label: t.territory, color: "var(--mars-primary)" },
    { href: "/bajo-tus-pies", label: t.underfoot, color: "var(--text-secondary)" },
    { href: "/experiments/new", base: "/experiments", label: t.workspace, color: "var(--earth-bright)" },
  ];
  return <header className="no-print sticky top-0 z-30 border-b border-white/[0.07] bg-[var(--space-void)]/85 backdrop-blur-xl">
    <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 px-4 pt-3 sm:h-16 sm:flex-nowrap sm:px-8 sm:pt-0">
      <Link href="/" className="mr-auto flex shrink-0 items-center gap-2.5 py-2 sm:mr-0" aria-label="Parallax">
        <Mark />
        <Wordmark height={15} />
      </Link>
      <nav aria-label={t.menu} className="order-last -mx-3 mt-1 flex w-[calc(100%+1.5rem)] gap-1 overflow-x-auto text-sm [scrollbar-width:none] sm:order-none sm:mx-0 sm:mt-0 sm:w-auto sm:min-w-0 sm:flex-1">
        {links.map(l => {
          const base = l.base ?? l.href;
          const active = path === base || path.startsWith(base + "/");
          return <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
            className={`relative whitespace-nowrap rounded-sm px-3 py-2 transition-colors ${active ? "text-white" : "text-[var(--text-secondary)] hover:text-white"}`}>
            {l.label}
            {active && <span className="absolute inset-x-3 bottom-0 h-[2px] sm:-bottom-[13px]" style={{ background: l.color }} />}
          </Link>;
        })}
      </nav>
      <button type="button" onClick={() => setLang(lang === "es" ? "en" : "es")} aria-label={t.lang}
        className="shrink-0 rounded-sm border border-white/15 px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-white">
        {t.langShort}
      </button>
    </div>
  </header>;
}

const FOOT = {
  es: {
    data: "Datos: NASA SRTMGL30 y MOD44W, NASA LOLA (Barker et al. 2023), MOLA y CTX (USGS Astrogeology), ESA WorldCover, GeoNames. Imágenes de satélite: Esri World Imagery.",
    method: "Mide una sola cosa: cómo se reparten las pendientes a 1 km dentro de ventanas de 50 × 50 km. No mide gravedad, atmósfera, luz, temperatura ni composición. Validaciones prerregistradas VAL-001 a VAL-004.",
    nasa: "Parallax es un proyecto del NASA Space Apps Challenge 2026. No está respaldado por la NASA.",
    workspace: "Buscador de experimentos",
  },
  en: {
    data: "Data: NASA SRTMGL30 and MOD44W, NASA LOLA (Barker et al. 2023), MOLA and CTX (USGS Astrogeology), ESA WorldCover, GeoNames. Satellite imagery: Esri World Imagery.",
    method: "It measures one thing: how slopes are distributed at 1 km inside 50 × 50 km windows. It does not measure gravity, atmosphere, light, temperature or composition. Pre-registered validations VAL-001 to VAL-004.",
    nasa: "Parallax is a NASA Space Apps Challenge 2026 project. It is not endorsed by NASA.",
    workspace: "Experiment search",
  },
};

export function SiteFooter() {
  const t = useT(FOOT);
  return <footer className="no-print mt-24 border-t border-white/[0.07]">
    <div className="mx-auto grid max-w-[1240px] gap-6 px-4 py-10 text-[13px] leading-6 text-[var(--text-muted)] sm:px-8 md:grid-cols-[auto_1fr_1fr]">
      <div className="flex items-start gap-2.5 text-[var(--text-secondary)]"><Mark size={22} /><Wordmark height={12} className="mt-1.5" /></div>
      <p>{t.data}</p>
      <div className="space-y-2"><p>{t.method}</p><p>{t.nasa}</p><Link href="/experiments/new" className="underline decoration-white/25 underline-offset-4 hover:text-white">{t.workspace}</Link></div>
    </div>
  </footer>;
}

export function Page({ children }: { children: React.ReactNode }) {
  return <>
    <SiteHeader />
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 sm:px-8">{children}</main>
    <SiteFooter />
  </>;
}
