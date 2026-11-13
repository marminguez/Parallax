/**
 * Upcoming Moon Base missions and the Earth site to rehearse each one.
 *
 * Facts (maker, target date, landing region, payloads, LTV limits) come from NASA's
 * Moon Base announcements of May-July 2026 as reported in the sources below, and from
 * the Moon Base programme briefing at the opening of NASA Space Apps 2026 (13 Nov 2026).
 * Dates are "no earlier than" and move; the page says so. The Earth twin is never
 * stored here: it is read from the published twin sheets (web/data/val004-sites.json).
 */
export type Rehearse = "mobility" | "plume" | "drilling" | "flight";
export type UpcomingMission = {
  id: string;
  name: string;
  maker: { es: string; en: string };
  when: { es: string; en: string };
  /** Destination id of a published twin sheet, or null when the mission targets the whole south-polar region. */
  site: string | null;
  region: { es: string; en: string };
  payload: { es: string; en: string };
  rehearse: Rehearse[];
  source: string;
};

export const UPCOMING: UpcomingMission[] = [
  {
    id: "griffin-1", name: "Griffin Mission One",
    maker: { es: "Voyager Technologies (Astrobotic); rover FLIP de Astrolab", en: "Voyager Technologies (Astrobotic); Astrolab FLIP rover" },
    when: { es: "No antes de noviembre de 2026", en: "No earlier than November 2026" },
    site: "mons-mouton", region: { es: "Mons Mouton", en: "Mons Mouton" },
    payload: { es: "Rover FLIP con cargas de NASA y retrorreflector láser (LRA)", en: "FLIP rover with NASA payloads and a laser retroreflector (LRA)" },
    rehearse: ["mobility"],
    source: "https://aerospaceamerica.aiaa.org/nasa-expects-one-lunar-launch-this-year-moon-base-manager-says/",
  },
  {
    id: "endurance", name: "Endurance (Blue Moon Mark 1)",
    maker: { es: "Blue Origin", en: "Blue Origin" },
    when: { es: "No antes del primer trimestre de 2027", en: "No earlier than Q1 2027" },
    site: "shackleton", region: { es: "Cráter Shackleton", en: "Shackleton crater" },
    payload: { es: "SCALPSS (cámaras que estudian cómo el chorro del motor levanta el regolito) y LRA", en: "SCALPSS (cameras that study how the engine plume lifts regolith) and an LRA" },
    rehearse: ["plume"],
    source: "https://spacepolicyonline.com/news/nasa-awards-initial-moon-base-rover-and-lander-contracts/",
  },
  {
    id: "viper", name: "VIPER",
    maker: { es: "NASA", en: "NASA" },
    when: { es: "En la segunda misión Mark 1 de Blue Origin", en: "On Blue Origin's second Mark 1 mission" },
    site: null, region: { es: "Zonas en sombra permanente del polo sur", en: "Permanently shadowed areas of the south pole" },
    payload: { es: "Rover de prospección de hielo con taladro", en: "Ice-prospecting rover with a drill" },
    rehearse: ["drilling", "mobility"],
    source: "https://spacepolicyonline.com/news/nasa-awards-initial-moon-base-rover-and-lander-contracts/",
  },
  {
    id: "ltv", name: "Pegasus · FLEX (LTV)",
    maker: { es: "Lunar Outpost (Pegasus) y Astrolab (FLEX)", en: "Lunar Outpost (Pegasus) and Astrolab (FLEX)" },
    when: { es: "Hacia 2028", en: "By 2028" },
    site: null, region: { es: "Polo sur", en: "South pole" },
    payload: { es: "Vehículos todoterreno con o sin tripulación: hasta 10 km/h, pendientes de hasta 20° y 200 km de autonomía", en: "Crewed or autonomous terrain vehicles: up to 10 km/h, slopes up to 20° and 200 km of range" },
    rehearse: ["mobility"],
    source: "https://spacepolicyonline.com/news/nasa-awards-initial-moon-base-rover-and-lander-contracts/",
  },
  {
    id: "moonfall", name: "MoonFall",
    maker: { es: "NASA JPL; entrega de Firefly Aerospace", en: "NASA JPL; delivered by Firefly Aerospace" },
    when: { es: "Hacia 2028", en: "By 2028" },
    site: null, region: { es: "Polo sur", en: "South pole" },
    payload: { es: "Tres o cuatro drones que vuelan de día para explorar zonas de alunizaje", en: "Three or four drones that fly in daylight to scout landing areas" },
    rehearse: ["flight"],
    source: "https://www.jpl.nasa.gov/videos/introducing-moonfall-nasas-lunar-drone-mission/",
  },
];

/** What each kind of test needs from an Earth site, and which Parallax measures speak to it. */
export const REHEARSE = {
  es: {
    mobility: "Movilidad: suelo desnudo, relieve fino a 60 m y textura del suelo",
    plume: "Aterrizaje: suelo suelto y fino (arena y limo) y suelo desnudo",
    drilling: "Perforación en hielo: permafrost, suelo desnudo y temperatura",
    flight: "Vuelo de exploración: relieve a 50 km y a 60 m; la Tierra no reproduce el vacío",
  },
  en: {
    mobility: "Mobility: bare ground, fine relief at 60 m and soil texture",
    plume: "Landing: loose, fine soil (sand and silt) and bare ground",
    drilling: "Ice drilling: permafrost, bare ground and temperature",
    flight: "Scouting flight: relief at 50 km and 60 m; Earth does not reproduce vacuum",
  },
} as const;
