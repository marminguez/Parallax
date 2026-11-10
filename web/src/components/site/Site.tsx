"use client";
import Image from "next/image";
import Link from "next/link";
import logo from "@/assets/parallax-logo-header.jpg";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
 * The team logo (Mars and Earth over PARALLAX, without the slogan), cropped for the header.
 * It sits on pure black: screen blending drops the black, so it lies on any dark background.
 */
export function Logo({ height = 52, priority = false, alignWordmark = false }: { height?: number; priority?: boolean; alignWordmark?: boolean }) {
  // alignWordmark: shift up so the PARALLAX letters, not the whole image, sit on the line's centre
  const shift = alignWordmark ? -Math.round((WORDMARK_CENTER - 0.5) * height) : 0;
  return <Image src={logo} alt="Parallax" priority={priority} height={height} width={Math.round((height * logo.width) / logo.height)}
    className="block select-none" style={{ mixBlendMode: "screen", maskImage: LOGO_FADE, WebkitMaskImage: LOGO_FADE, transform: shift ? `translateY(${shift}px)` : undefined }} />;
}
/** Vertical centre of the PARALLAX letters within the header logo (rows 307-434 of 465). */
const WORDMARK_CENTER = 0.797;
const LOGO_FADE = "linear-gradient(to bottom, #000 0, #000 82%, transparent 100%)";

export function SiteHeader() {
  const t = useT(NAV);
  const { lang, setLang } = useLang();
  const path = usePathname();
  // On the home page the hero already shows the logo: the header one appears once the hero scrolls away.
  const home = path === "/";
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    if (!home) return;
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.55);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [home]);
  const showLogo = !home || pastHero;
  const links: { href: string; base?: string; label: string; color: string }[] = [
    { href: "/misiones", label: t.missions, color: "var(--earth-primary)" },
    { href: "/educacion", label: t.education, color: "var(--moon)" },
    { href: "/territorio", label: t.territory, color: "var(--mars-primary)" },
    { href: "/bajo-tus-pies", label: t.underfoot, color: "var(--text-secondary)" },
    { href: "/experiments/new", base: "/experiments", label: t.workspace, color: "var(--earth-bright)" },
  ];
  return <header className="no-print sticky top-0 z-30 border-b border-white/[0.07] bg-black">
    <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 px-4 pt-3 sm:h-16 sm:flex-nowrap sm:px-8 sm:pt-0">
      <Link href="/" aria-label="Parallax" tabIndex={showLogo ? undefined : -1}
        className={`mr-auto flex shrink-0 items-center py-1.5 transition-opacity duration-500 sm:mr-0 ${showLogo ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <Logo height={36} priority alignWordmark />
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
    data: "Datos: NASA SRTMGL30, MOD44W, POWER y SEDAC; NASA LOLA (Barker et al. 2023) y su mapa de sombra permanente; MOLA y CTX (USGS Astrogeology); NASA SWIM; mapas geológicos del USGS; ESA WorldCover y Copernicus DEM; índice de permafrost de Gruber; GLiM; GeoNames. Imágenes de satélite: Esri World Imagery.",
    method: "Elige los gemelos con una sola medida: cómo se reparten las pendientes a 1 km dentro de ventanas de 50 × 50 km. Después describe cada gemelo, sin cambiarlo, en relieve fino, temperatura, acceso, hielo, suelo y roca, con umbrales fijados antes de calcular. No reproduce gravedad, vacío ni radiación. Validaciones prerregistradas VAL-001 a VAL-004.",
    nasa: "Parallax es un proyecto del NASA Space Apps Challenge 2026. No está respaldado por la NASA.",
    workspace: "Buscador de experimentos",
  },
  en: {
    data: "Data: NASA SRTMGL30, MOD44W, POWER and SEDAC; NASA LOLA (Barker et al. 2023) and its permanent-shadow map; MOLA and CTX (USGS Astrogeology); NASA SWIM; USGS geologic maps; ESA WorldCover and Copernicus DEM; Gruber permafrost index; GLiM; GeoNames. Satellite imagery: Esri World Imagery.",
    method: "Twins are chosen on one measure: how slopes are distributed at 1 km inside 50 × 50 km windows. Each twin is then described, never changed, on fine relief, temperature, access, ice, ground and rock, with thresholds fixed before computing. Earth does not reproduce gravity, vacuum or radiation. Pre-registered validations VAL-001 to VAL-004.",
    nasa: "Parallax is a NASA Space Apps Challenge 2026 project. It is not endorsed by NASA.",
    workspace: "Experiment search",
  },
};

export function SiteFooter() {
  const t = useT(FOOT);
  return <footer className="no-print mt-24 border-t border-white/[0.07]">
    <div className="mx-auto grid max-w-[1240px] gap-6 px-4 py-10 text-[13px] leading-6 text-[var(--text-muted)] sm:px-8 md:grid-cols-[auto_1fr_1fr]">
      <Link href="/" aria-label="Parallax" className="self-start"><Logo height={44} /></Link>
      <p>{t.data}</p>
      <div className="space-y-2"><p>{t.method}</p><p>{t.nasa}</p><Link href="/experiments/new" className="underline decoration-white/25 underline-offset-4 hover:text-white">{t.workspace}</Link></div>
    </div>
  </footer>;
}

export function Page({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <>
    <SiteHeader />
    <main className={`mx-auto w-full flex-1 px-4 sm:px-8 ${wide ? "max-w-[1440px]" : "max-w-[1240px]"}`}>{children}</main>
    <SiteFooter />
  </>;
}
