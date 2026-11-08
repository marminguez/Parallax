"use client";
import Image from "next/image";
import { useEffect, useRef } from "react";
import logo from "@/assets/parallax-logo.jpg";

/**
 * Opening screen: the team logo with its slogan, brought to life with light that travels along the
 * orbits and the horizon line, pulsing moons and a slow drift. The overlay is drawn in the logo's own
 * pixel space (2092 x 964), so it stays on the artwork at any size. The section is pure black, like the
 * artwork, so the image has no visible edge. Scrolling fades it out and the
 * page takes over. Everything stops for visitors who ask for reduced motion.
 */

// Arcs traced from the artwork (ellipses fitted to the drawn orbits, visible part only).
const ORANGE_ORBIT = "M486 496 L489 471 L492 447 L497 423 L502 400 L509 377 L517 355 L526 333 L536 312 L547 292 L559 273 L571 255 L585 237 L600 221 L615 206 L631 191 L648 178 L666 166 L684 155 L703 146 L722 137 L742 130 L762 124 L782 120 L803 116 L825 114 L846 114 L867 115 L889 117 L911 120 L932 125 L954 131 L975 138 L996 147 L1017 156 L1037 167 L1057 179 L1077 193 L1096 207 L1115 223 L1133 239 L1150 257 L1167 275 L1183 295 L1198 315 L1213 336 L1226 357 L1239 380 L1250 403 L1261 426 L1271 450 L1279 474 L1287 499";
const BLUE_ORBIT = "M1621 500 L1622 513 L1622 526 L1621 539 L1619 552 L1617 565 L1614 578 L1610 590 L1605 603 L1600 615 L1594 628 L1587 640 L1580 651 L1572 663 L1563 674 L1553 685 L1544 695 L1533 705 L1522 715 L1510 724 L1498 732 L1486 740 L1473 748 L1460 755 L1447 761 L1433 767 L1419 772 L1404 777 L1390 781 L1375 784 L1361 787 L1346 789 L1331 790 L1316 790 L1302 790 L1287 789 L1273 788 L1259 786 L1245 783 L1231 780 L1217 776 L1204 771 L1192 766 L1179 760 L1167 753 L1156 746 L1145 738 L1135 730 L1125 721 L1116 712 L1111 707";
const HORIZON_Y = 493;

export default function HomeHero({ alt, cue }: { alt: string; cue: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / (el.offsetHeight * 0.75)));
      el.style.setProperty("--hero-p", p.toFixed(3));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(frame); };
  }, []);

  return <section ref={ref} aria-label="Parallax" className="hero relative mx-[calc(50%-50vw)] flex h-[calc(100svh-114px)] min-h-[420px] items-center justify-center overflow-hidden sm:h-[calc(100svh-64px)]"
    style={{ background: "linear-gradient(to bottom, #000 0, #000 82%, var(--space-void) 100%)" }}>
    <div className="hero-stars absolute inset-0" aria-hidden="true" />
    <div className="hero-stars hero-stars-b absolute inset-0" aria-hidden="true" />

    <div className="hero-scroll relative w-[125%] max-w-[1500px] shrink-0 sm:w-[min(100%,1500px)]">
      <div className="hero-drift relative">
        <Image src={logo} alt={alt} priority placeholder="blur" sizes="(min-width: 1500px) 1500px, 125vw"
          className="hero-art block select-none" style={{ width: "100%", height: "auto" }} />
        <svg viewBox="0 0 2092 964" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
            <filter id="hero-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22" /></filter>
            <linearGradient id="hero-horizon" x1="80" x2="2010" y1="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ff7a45" stopOpacity="0" />
              <stop offset=".25" stopColor="#ff7a45" />
              <stop offset=".5" stopColor="#ffffff" />
              <stop offset=".75" stopColor="#5fb4ff" />
              <stop offset="1" stopColor="#5fb4ff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="hero-flare">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset=".35" stopColor="#ffe9d6" stopOpacity=".8" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Atmospheres breathing */}
          <circle cx="870" cy="430" r="268" fill="none" stroke="#ff6a2b" strokeWidth="18" filter="url(#hero-soft)" className="hero-breathe" />
          <circle cx="1250" cy="540" r="292" fill="none" stroke="#3d9bff" strokeWidth="22" filter="url(#hero-soft)" className="hero-breathe hero-breathe-b" />

          {/* Light travelling along the two orbits */}
          <path d={ORANGE_ORBIT} pathLength={1000} fill="none" stroke="#ff9a62" strokeWidth="7" strokeLinecap="round" filter="url(#hero-glow)" className="hero-comet" />
          <path d={ORANGE_ORBIT} pathLength={1000} fill="none" stroke="#fff3ea" strokeWidth="2.5" strokeLinecap="round" className="hero-comet" />
          <path d={BLUE_ORBIT} pathLength={1000} fill="none" stroke="#7cc4ff" strokeWidth="7" strokeLinecap="round" filter="url(#hero-glow)" className="hero-comet hero-comet-b" />
          <path d={BLUE_ORBIT} pathLength={1000} fill="none" stroke="#eef7ff" strokeWidth="2.5" strokeLinecap="round" className="hero-comet hero-comet-b" />

          {/* Moons */}
          <circle cx="612" cy="208" r="34" fill="#ff7a45" filter="url(#hero-soft)" className="hero-pulse" />
          <circle cx="1484" cy="748" r="34" fill="#5fb4ff" filter="url(#hero-soft)" className="hero-pulse hero-pulse-b" />

          {/* Horizon line: it breathes, and a flare runs from Mars to Earth */}
          <rect x="80" y={HORIZON_Y - 1.5} width="1930" height="3" fill="url(#hero-horizon)" className="hero-horizon" />
          <g className="hero-sweep"><ellipse cx="0" cy={HORIZON_Y} rx="150" ry="7" fill="url(#hero-flare)" /></g>
        </svg>
      </div>
    </div>

    <a href="#start" className="hero-cue absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/60 hover:text-white">
      {cue}
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 6.5 9 12.5 15 6.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
    </a>
  </section>;
}
