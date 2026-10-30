"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "es" | "en";
const KEY = "parallax-lang";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "es", setLang: () => {} });

/** Spanish first (the event is in Valencia); English for visitors whose browser asks for it. Stored per device. */
export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, set] = useState<Lang>("es");
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(KEY); } catch { /* storage is optional */ }
    const next: Lang = stored === "es" || stored === "en" ? stored : navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
    const frame = requestAnimationFrame(() => set(next));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l: Lang) => {
    set(l);
    try { localStorage.setItem(KEY, l); } catch { /* storage is optional */ }
  }, []);
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

/** Pick the dictionary for the current language. */
export function useT<T>(dict: Record<Lang, T>): T {
  return dict[useContext(Ctx).lang];
}

export const fmtNum = (lang: Lang, n: number, digits = 0) =>
  n.toLocaleString(lang === "es" ? "es-ES" : "en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtCoord = (lat: number, lon: number, digits = 2) =>
  `${Math.abs(lat).toFixed(digits)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(digits)}° ${lon >= 0 ? "E" : "W"}`;
