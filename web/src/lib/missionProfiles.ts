/**
 * Quick search: the two questions a busy team answers first.
 *
 * 1. What will you test? The six Moon Base programme categories, as named in the
 *    programme briefing at the NASA Space Apps 2026 opening (13 Nov 2026). Each one
 *    picks an experiment profile and the measured terrain conditions that matter for it.
 * 2. For which destination? Upcoming missions first, then the reference regions.
 *
 * Presentation only: nothing here changes how windows are measured or ranked. Conditions
 * only remove windows, exactly as in the full form, which stays one click away.
 */
import type { EarthFilters, EarthDims } from "./earthIndex";
import { judge, targetBody } from "./earthIndex";
import type { Profile } from "./search";
import type { FineResult } from "./fineRelief";
import type { PlanetaryTargetId } from "./targets";

export type Category = "ltv" | "scouting" | "isru" | "habitation" | "logistics" | "techdemos";
export type Lang = "es" | "en";

export const CATEGORIES: Record<Category, { name: string; hint: Record<Lang, string>; noun: Record<Lang, string>; profile: Profile; filters: EarthFilters; soil: boolean }> = {
  ltv: { name: "Lunar Terrain Vehicles (LTV)", hint: { es: "Pegasus, FLEX: conducción", en: "Pegasus, FLEX: driving" }, noun: { es: "un LTV", en: "an LTV" }, profile: "mobility", filters: { bareMin: 0.5, fineRelief: "holds_or_partly" }, soil: true },
  scouting: { name: "Scouting and Surveying", hint: { es: "Drones MoonFall, cámaras, cartografía", en: "MoonFall drones, cameras, mapping" }, noun: { es: "exploración y cartografía", en: "scouting and surveying" }, profile: "navigation", filters: { bareMin: 0.5 }, soil: false },
  isru: { name: "In-Situ Resource Utilization (ISRU)", hint: { es: "Excavación y hielo: IPEx, VIPER", en: "Excavation and ice: IPEx, VIPER" }, noun: { es: "excavación y uso de recursos", en: "excavation and resource use" }, profile: "isru", filters: { bareMin: 0.5, permafrost: true }, soil: true },
  habitation: { name: "Habitation", hint: { es: "Hábitat de superficie", en: "Surface habitat" }, noun: { es: "un hábitat", en: "a habitat" }, profile: "eva", filters: { bareMin: 0.5 }, soil: false },
  logistics: { name: "Early Habitation and Logistics", hint: { es: "Primeras estancias y rover presurizado", en: "First stays and pressurized rover" }, noun: { es: "logística y primeras estancias", en: "logistics and first stays" }, profile: "eva", filters: { bareMin: 0.5, access: ["rural", "populated"] }, soil: false },
  techdemos: { name: "Tech Demos & Rovers", hint: { es: "FLIP, IPEx, aterrizaje (SCALPSS)", en: "FLIP, IPEx, landing (SCALPSS)" }, noun: { es: "demostradores y rovers", en: "tech demos and rovers" }, profile: "mobility", filters: { bareMin: 0.5 }, soil: true },
};
export const CATEGORY_ORDER: Category[] = ["ltv", "scouting", "isru", "habitation", "logistics", "techdemos"];

export type Destination = { id: PlanetaryTargetId; mission?: Record<Lang, string> };
/** Upcoming missions first (NASA Moon Base, 2026), then every reference. */
export const DESTINATIONS: { group: Record<Lang, string>; items: Destination[] }[] = [
  { group: { es: "Próximas misiones", en: "Upcoming missions" }, items: [
    { id: "mons-mouton", mission: { es: "Griffin, nov 2026", en: "Griffin, Nov 2026" } },
    { id: "shackleton", mission: { es: "Endurance, 2027", en: "Endurance, 2027" } },
  ] },
  { group: { es: "Luna · regiones de Artemis III", en: "Moon · Artemis III regions" }, items: ["peak-near-cabeus-b", "haworth", "malapert-massif", "mons-mouton-plateau", "nobile-rim-1", "nobile-rim-2", "de-gerlache-rim-2", "slater-plain"].map(id => ({ id: id as PlanetaryTargetId })) },
  { group: { es: "Marte", en: "Mars" }, items: [{ id: "jezero" }] },
];

/** Slope-distribution distance in words. 0.30 matches the strong-twin cut used across Parallax (0.299). */
export function likeness(d: number | null, lang: Lang): string {
  const w = lang === "es" ? ["Muy parecido", "Parecido", "Algo parecido", "Poco parecido"] : ["Very similar", "Similar", "Somewhat similar", "Less similar"];
  if (d === null) return lang === "es" ? "Sin comparar" : "Not compared";
  return d <= 0.10 ? w[0] : d <= 0.20 ? w[1] : d <= 0.30 ? w[2] : w[3];
}

const TEXTURE: Record<Lang, Record<string, string>> = {
  es: { sand: "arenoso", loamy_sand: "arenoso franco", sandy_loam: "franco arenoso" },
  en: { sand: "sand", loamy_sand: "loamy sand", sandy_loam: "sandy loam" },
};

/** What a window lets a team rehearse, and what it does not, from the measured dimensions. Three items each at most. */
export function fitFor(earth: EarthDims | undefined, target: PlanetaryTargetId, fine: FineResult | undefined, category: Category, lang: Lang) {
  const good: string[] = [], bad: string[] = [];
  if (!earth) return { good, bad };
  const es = lang === "es";
  const j = judge(earth, target);
  const moon = targetBody(target) === "Moon";
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  if (j.ground === "holds" && earth.bare !== null) good.push(es ? `suelo desnudo (${pct(earth.bare)})` : `bare ground (${pct(earth.bare)})`);
  else if (j.ground === "breaks") bad.push(es ? "suelo desnudo (hay vegetación)" : "bare ground (vegetated)");
  if (fine?.status === "measured") {
    if (fine.verdict === "holds") good.push(es ? "relieve fino como el del destino" : "fine relief like the destination's");
    else if (fine.verdict === "partly") good.push(es ? "relieve fino parecido en parte" : "partly similar fine relief");
    else bad.push(es ? "el relieve fino (aquí más abrupto)" : "the fine relief (steeper here)");
  }
  if (earth.ice) good.push(es ? "permafrost" : "permafrost");
  else if (earth.ice === false && moon) bad.push(es ? "hielo en el suelo" : "ground ice");
  if (CATEGORIES[category].soil && earth.soil?.texture && TEXTURE[lang][earth.soil.texture]) good.push(es ? `suelo ${TEXTURE.es[earth.soil.texture]}` : `${TEXTURE.en[earth.soil.texture]} soil`);
  if (j.temperature) {
    const cold = moon ? (es ? "frío lunar" : "lunar cold") : (es ? "frío marciano" : "Martian cold");
    if (j.temperature.verdict === "holds") good.push(es ? "rango de temperatura" : "temperature range");
    else if (j.temperature.verdict === "partly") bad.push(es ? `parte del ${cold}` : `part of the ${cold}`);
    else bad.push(cold);
  }
  if (j.rock?.verdict === "breaks") bad.push(moon ? (es ? "roca lunar" : "lunar rock") : (es ? "roca de Jezero" : "Jezero rock"));
  else if (j.rock?.verdict === "holds") good.push(es ? "tipo de roca" : "rock type");
  return { good: good.slice(0, 3), bad: bad.slice(0, 3) };
}
