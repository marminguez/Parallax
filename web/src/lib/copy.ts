import type { Lang } from "./i18n";
import type { Body, TwinClass } from "./underfoot";

export const CLS: Record<Lang, Record<TwinClass, string>> = {
  es: { strong_twin: "Gemelo fuerte", twin: "Gemelo", partial: "Parecido parcial", no_twin: "Sin gemelo" },
  en: { strong_twin: "Strong twin", twin: "Twin", partial: "Partial match", no_twin: "No twin" },
};

export const BODY_NAME: Record<Lang, Record<Body, string>> = {
  es: { moon: "Luna", mars: "Marte" },
  en: { moon: "Moon", mars: "Mars" },
};

/** One sentence that puts a distance next to the 18 analogs agencies already use. */
export function verdict(lang: Lang, cls: TwinClass, closerThan: number, ofPairs: number): string {
  const c = CLS[lang][cls];
  if (lang === "es") {
    if (closerThan === ofPairs) return `${c}: se parece más que cualquiera de los ${ofPairs} análogos que ya usan las agencias a su propio objetivo.`;
    if (closerThan === 0) return `${c}: más lejos que los ${ofPairs} análogos que ya usan las agencias.`;
    return `${c}: se parece más que ${closerThan} de los ${ofPairs} análogos que ya usan las agencias a su objetivo.`;
  }
  if (closerThan === ofPairs) return `${c}: closer than any of the ${ofPairs} agency-used analogs are to their own target.`;
  if (closerThan === 0) return `${c}: farther than all ${ofPairs} agency-used analogs.`;
  return `${c}: closer than ${closerThan} of the ${ofPairs} agency-used analogs are to their own target.`;
}

const NAMES_ES: Record<string, string> = {
  "Shackleton crater": "Cráter Shackleton",
  "Perseverance (Jezero crater)": "Perseverance (cráter Jezero)",
  "Viking 1 (Chryse Planitia)": "Viking 1 (Chryse Planitia)",
  "Curiosity (Gale crater)": "Curiosity (cráter Gale)",
  "Spirit (Gusev crater)": "Spirit (cráter Gusev)",
  "Eberswalde (MSL finalist)": "Eberswalde (finalista de MSL)",
  "Holden crater (MSL finalist)": "Cráter Holden (finalista de MSL)",
  "Mawrth Vallis (MSL finalist)": "Mawrth Vallis (finalista de MSL)",
};
export const siteName = (lang: Lang, name: string) => (lang === "es" ? NAMES_ES[name] ?? name : name);

export const KIND: Record<Lang, Record<string, string>> = {
  es: { reference: "Referencia de Parallax", artemis: "Región candidata de Artemis III", landed: "Misión aterrizada", candidate: "Candidato a aterrizaje" },
  en: { reference: "Parallax reference", artemis: "Artemis III candidate region", landed: "Landed mission", candidate: "Landing candidate" },
};

export const pct = (lang: Lang, v: number) => `${Math.round(v).toLocaleString(lang === "es" ? "es-ES" : "en-GB")} %`;
