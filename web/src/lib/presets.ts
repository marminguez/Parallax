import type { Preset } from "@/components/site/Area";

/** City centres (approximate) for classrooms, museums and planetariums. */
export const CITIES: Preset[] = [
  { id: "valencia", lat: 39.47, lon: -0.38, es: "Valencia", en: "Valencia" },
  { id: "madrid", lat: 40.42, lon: -3.7, es: "Madrid", en: "Madrid" },
  { id: "barcelona", lat: 41.39, lon: 2.17, es: "Barcelona", en: "Barcelona" },
  { id: "sevilla", lat: 37.39, lon: -5.98, es: "Sevilla", en: "Seville" },
  { id: "zaragoza", lat: 41.65, lon: -0.88, es: "Zaragoza", en: "Zaragoza" },
  { id: "bilbao", lat: 43.26, lon: -2.93, es: "Bilbao", en: "Bilbao" },
  { id: "malaga", lat: 36.72, lon: -4.42, es: "Málaga", en: "Málaga" },
  { id: "granada", lat: 37.18, lon: -3.6, es: "Granada", en: "Granada" },
  { id: "murcia", lat: 37.99, lon: -1.13, es: "Murcia", en: "Murcia" },
  { id: "alicante", lat: 38.35, lon: -0.48, es: "Alicante", en: "Alicante" },
  { id: "castellon", lat: 39.99, lon: -0.05, es: "Castellón de la Plana", en: "Castellón de la Plana" },
  { id: "palma", lat: 39.57, lon: 2.65, es: "Palma", en: "Palma" },
  { id: "laspalmas", lat: 28.12, lon: -15.43, es: "Las Palmas de Gran Canaria", en: "Las Palmas de Gran Canaria" },
  { id: "tenerife", lat: 28.47, lon: -16.25, es: "Santa Cruz de Tenerife", en: "Santa Cruz de Tenerife" },
  { id: "cdmx", lat: 19.43, lon: -99.13, es: "Ciudad de México", en: "Mexico City" },
  { id: "bogota", lat: 4.71, lon: -74.07, es: "Bogotá", en: "Bogotá" },
  { id: "lima", lat: -12.05, lon: -77.04, es: "Lima", en: "Lima" },
  { id: "santiago", lat: -33.45, lon: -70.67, es: "Santiago de Chile", en: "Santiago, Chile" },
  { id: "buenosaires", lat: -34.6, lon: -58.38, es: "Buenos Aires", en: "Buenos Aires" },
  { id: "houston", lat: 29.76, lon: -95.37, es: "Houston", en: "Houston" },
];

/** Landscapes often described as lunar or Martian. Centres are approximate; the profile is measured, not assumed. */
export const REGIONS: Preset[] = [
  { id: "tabernas", lat: 37.05, lon: -2.39, es: "Desierto de Tabernas (Almería)", en: "Tabernas Desert (Almería, Spain)" },
  { id: "bardenas", lat: 42.18, lon: -1.48, es: "Bardenas Reales (Navarra)", en: "Bardenas Reales (Navarre, Spain)" },
  { id: "riotinto", lat: 37.69, lon: -6.59, es: "Río Tinto (Huelva)", en: "Río Tinto (Huelva, Spain)" },
  { id: "monegros", lat: 41.55, lon: -0.25, es: "Los Monegros (Aragón)", en: "Los Monegros (Aragon, Spain)" },
  { id: "guadix", lat: 37.4, lon: -3.1, es: "Hoya de Guadix (Granada)", en: "Guadix badlands (Granada, Spain)" },
  { id: "cabodegata", lat: 36.83, lon: -2.1, es: "Cabo de Gata (Almería)", en: "Cabo de Gata (Almería, Spain)" },
  { id: "teide", lat: 28.27, lon: -16.64, es: "Las Cañadas del Teide (Tenerife)", en: "Teide caldera (Tenerife, Spain)" },
  { id: "lanzarote", lat: 29.03, lon: -13.65, es: "Lanzarote", en: "Lanzarote (Spain)" },
  { id: "atacama", lat: -24.1, lon: -69.95, es: "Desierto de Atacama (Chile)", en: "Atacama Desert (Chile)" },
  { id: "ischigualasto", lat: -30.0, lon: -67.9, es: "Valle de la Luna, Ischigualasto (Argentina)", en: "Valle de la Luna, Ischigualasto (Argentina)" },
  { id: "wadirum", lat: 29.58, lon: 35.42, es: "Wadi Rum (Jordania)", en: "Wadi Rum (Jordan)" },
  { id: "ladakh", lat: 34.15, lon: 77.58, es: "Ladakh (India)", en: "Ladakh (India)" },
  { id: "sanrafael", lat: 38.9, lon: -110.6, es: "San Rafael Swell (Utah)", en: "San Rafael Swell (Utah, USA)" },
  { id: "deathvalley", lat: 36.5, lon: -117.0, es: "Valle de la Muerte (California)", en: "Death Valley (California, USA)" },
];
