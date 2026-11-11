"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import DiscoveryMap, { SatellitePreview } from "./DiscoveryMap";
import TerrainComparison, { resultReference } from "./TerrainComparison";
import LunarLightCalendar from "./LunarLightCalendar";
import LandCoverEvidence from "./LandCoverEvidence";
import EarthDimensions from "./EarthDimensions";
import type { AccessBand, EarthFilters, EarthFilterKey, Level } from "@/lib/earthIndex";
import VerificationList, { VERIFY_T } from "./VerificationList";
import { forCandidates, loadLog, saveLog, statusFor, VERIFICATION_STATEMENT, type Verification } from "@/lib/verification";
import { profiles, Profile, evidenceLabels, envelopeFields, SearchRequest, SearchResult, type Candidate } from "@/lib/search";
import { placeLabel } from "@/lib/places";
import { planetaryTargets, isPlanetaryTarget, isArtemisRegion } from "@/lib/targets";
import { PUBLIC_DEPLOYMENT } from "@/lib/basemaps";
import { Page } from "@/components/site/Site";
import { useLang, useT } from "@/lib/i18n";
import { SEARCH_T, PROFILE_LABELS, EVIDENCE_LABELS, ENVELOPE_LABELS, TARGET_LABELS } from "@/lib/searchCopy";

// Defaults applied when the ranking target changes. Jezero keeps the frozen pilot settings (rover-scale
// slope cap). The lunar south pole is steep, so the Moon starts without a slope cap or distance limit;
// users add a cap for hardware that cannot operate on steep regional terrain.
const targetDefaults: Partial<Record<SearchRequest["target"], Partial<SearchRequest>>> = {
  jezero: { maxJsd: 0.3, maxSlopeP95: 15 },
  shackleton: { maxJsd: 1, maxSlopeP95: 90 },
  terrain: {},
};
/** Artemis III regions start like Shackleton: no slope cap, no distance limit. */
const defaultsFor = (target: SearchRequest["target"]) => targetDefaults[target] ?? targetDefaults.shackleton!;

const defaults: SearchRequest = {
  title: "Jezero rover field campaign", objective: "", profile: "mobility",
  target: "jezero", mode: "indexed", west: -180, east: 180, south: -55, north: 59,
  minLandFraction: 0.9, minSlopeP95: 0, maxSlopeP95: 15, desiredSlopeP95: 8.4,
  maxJsd: 0.3, requirements: [], strict: false, limit: 10,
};
const historyKey = "parallax-experiments-v1";
const inputClass = "wb-input";
type NumericField = "west" | "east" | "south" | "north" | "minSlopeP95" | "maxSlopeP95" | "desiredSlopeP95" | "maxJsd" | "minLandFraction" | "limit";

type Copy = (typeof SEARCH_T)["en"];
type WbCopy = (typeof WB_T)["en"];

/** The API answers in English; these rebuild its prose from the numbers in the visitor's language. */
function scopeText(r: SearchResult, t: Copy, w: WbCopy) {
  return r.request.mode === "facilities" ? t.scopeFacilities : r.request.mode === "live" ? t.scopeLive : r.index === "earth" ? w.scopeEarth : t.scopeIndexed;
}
function rankingText(r: SearchResult, t: Copy, w: WbCopy) {
  if (r.request.mode === "facilities") return t.rankingFacilities;
  if (r.index === "earth" && r.request.target === "jezero") return w.rankingV2;
  return isPlanetaryTarget(r.request.target) ? t.rankingTarget(planetaryTargets[r.request.target].short, r.request.target === "jezero" && r.index !== "earth") : t.rankingTerrain;
}
function explanationText(c: Candidate, r: SearchResult, t: Copy, w: WbCopy) {
  if (r.request.mode === "facilities") return [...(t.facilityEvidence[c.id] ?? c.explanation.slice(0, -1)), t.facilityMarker];
  if (c.landFraction === null) return c.explanation;
  if (c.slopeP95 === null) {
    return [
      ...(Object.keys(r.request.earthFilters ?? {}).length ? [w.explainConditions] : []),
      t.explainLand((100 * c.landFraction).toFixed(2)),
      ...(c.jsd !== null && isPlanetaryTarget(r.request.target) ? [t.explainDist(planetaryTargets[r.request.target].short, c.jsd.toFixed(4))] : []),
      ...(c.score !== undefined ? [c.score === null ? w.explainV1 : w.explainV2(c.score.toFixed(4))] : []),
    ];
  }
  return [
    ...(Object.keys(r.request.landCoverConstraints ?? {}).length ? [t.explainCover] : []),
    t.explainLand((100 * c.landFraction).toFixed(2)),
    t.explainP95(c.slopeP95.toFixed(2)),
    c.jsd !== null && isPlanetaryTarget(r.request.target) ? t.explainDist(planetaryTargets[r.request.target].short, c.jsd.toFixed(4)) : t.explainTerrain,
  ];
}
/** Evidence keys a candidate still needs: the profile's critical evidence plus what the team asked for. */
function requiredKeys(r: SearchResult) {
  return [...new Set([...profiles[r.request.profile].evidence, ...r.request.requirements])];
}

/** Workbench copy that is new to this layout (table heads, section names, figure labels). */
const WB_T = {
  es: {
    examples: "Cargar un ejemplo", exMars: "Rover en Jezero (Marte)", exMoon: "Perforación junto a Shackleton (Luna)",
    moonTitle: "Perforación junto a Shackleton para Artemis",
    moonObjective: "Ejemplo: ensayar la perforación y el muestreo de un taladro de 1 m en suelo helado y desnudo, con relieve como el del polo sur lunar y luz rasante, antes de una misión Artemis.",
    secExperiment: "Experimento", secReference: "Referencia y límites de terreno", secArea: "Zona de búsqueda",
    rank: "Puesto", site: "Sitio", status: "Estado", p95: "P95 de pendiente", land: "Tierra",
    coords: "Coordenadas", window: "Ventana", pickHint: "Elige una fila para ver su ficha completa.", searching: "Buscando candidatos",
    figures: { returned: "ventanas devueltas", sites: "sitios independientes", evaluated: "evaluadas", rejected: "excluidas", provisional: "pendientes de verificar", errors: "errores" },
    artemisGroup: "Luna · regiones candidatas de Artemis III",
    regionTitle: (r: string) => `Ensayo en la Tierra para ${r}`,
    regionObjective: (r: string) => `Encontrar dónde ensayar en la Tierra el terreno de ${r}. Ajusta el tipo de experimento y las condiciones del terreno.`,
    artemisNote: "Huella de pendientes a 1 km de la ventana del mapa inverso asignada a la región (centro leído del mapa de la NASA, con unos pocos km de error). Sin condiciones, el primer resultado es el gemelo publicado en Misiones.",
    secConditions: "Condiciones del terreno", any: "Sin condición", holds: "Se mantiene", holdsOrPartly: "Se mantiene o en parte",
    condBare: "Suelo desnudo mínimo (%)", condVeg: "Vegetación máxima (%)", condAccess: "Acceso", condIce: "Exigir permafrost",
    condRock: "Roca como la de la referencia", condTemp: "Temperatura como la del destino",
    bands: { remote: "Remoto", rural: "Rural", populated: "Poblado" } as Record<string, string>,
    condNote: "Medidas en las 42.405 ventanas con reglas fijadas antes de calcular. Solo quitan ventanas, nunca cambian el orden, y una ventana sin dato no pasa la condición. Las bandas de roca y temperatura son descriptivas, no umbrales de idoneidad validados.",
    noP95: "Este índice no guarda el P95 regional de pendiente: la referencia se compara con la distribución completa de pendientes de cada ventana.",
    condLabel: { bareMin: "Suelo desnudo", vegetatedMax: "Vegetación", access: "Acceso", permafrost: "Permafrost", rock: "Roca", temperature: "Temperatura" } as Record<string, string>,
    condRejected: (label: string, outside: string, missing: string) => `${label}: ${outside} ventanas fuera${missing !== "0" ? `, ${missing} sin dato` : ""}.`,
    bare: "Suelo desnudo", score: "Puntuación (Marte v2)",
    scopeEarth: "42.405 ventanas terrestres aptas del mapa inverso VAL-004 (cada 50 km, de 56° S a 60° N, con al menos un 90 % de tierra), con cinco dimensiones medidas: suelo desnudo, acceso, permafrost, roca y temperatura (earth dimensions v1). Este índice no guarda el P95 regional.",
    rankingV2: "Orden por la puntuación del modelo v2 de Marte (VAL-003): 0,5 × distancia de Jensen–Shannon (base 2) al histograma congelado de Jezero + 0,5 × (1 − suelo desnudo).",
    explainConditions: "Cumple todas las condiciones del terreno pedidas, medidas en la ventana.",
    explainV2: (s: string) => `Puntuación del modelo v2 de Marte: ${s} (0,5 × distancia de pendientes + 0,5 × (1 − suelo desnudo)).`,
    explainV1: "Sin dato de suelo desnudo: se ordena solo por la distancia de pendientes (modelo v1).",
    availEarth: "Índice terrestre: 42.405 ventanas de 50 km con su huella de pendientes y cinco condiciones medidas (suelo desnudo, acceso, permafrost, roca y temperatura).",
  },
  en: {
    examples: "Load an example", exMars: "Rover at Jezero (Mars)", exMoon: "Drilling near Shackleton (Moon)",
    moonTitle: "Drilling near Shackleton for Artemis",
    moonObjective: "Example: rehearse drilling and sampling with a 1 m drill in bare, frozen ground with relief like the lunar south pole and grazing light, before an Artemis mission.",
    secExperiment: "Experiment", secReference: "Reference and terrain limits", secArea: "Search area",
    rank: "Rank", site: "Site", status: "Status", p95: "P95 slope", land: "Land",
    coords: "Coordinates", window: "Window", pickHint: "Pick a row to see its full sheet.", searching: "Searching for candidates",
    figures: { returned: "windows returned", sites: "independent sites", evaluated: "evaluated", rejected: "excluded", provisional: "requiring verification", errors: "errors" },
    artemisGroup: "Moon · Artemis III candidate regions",
    regionTitle: (r: string) => `Earth rehearsal for ${r}`,
    regionObjective: (r: string) => `Find where on Earth to rehearse the terrain of ${r}. Adjust the experiment type and the terrain conditions.`,
    artemisNote: "1 km slope fingerprint of the reverse-map window assigned to the region (centre read from NASA's map, a few km of error). With no conditions, the first result is the twin published in Missions.",
    secConditions: "Terrain conditions", any: "No condition", holds: "Holds", holdsOrPartly: "Holds or partly",
    condBare: "Minimum bare ground (%)", condVeg: "Maximum vegetation (%)", condAccess: "Access", condIce: "Require permafrost",
    condRock: "Rock like the reference", condTemp: "Temperature like the destination",
    bands: { remote: "Remote", rural: "Rural", populated: "Populated" } as Record<string, string>,
    condNote: "Measured on all 42,405 windows with rules fixed before computing. They only remove windows, never change the order, and a window without the value does not pass. The rock and temperature bands are descriptive, not validated suitability thresholds.",
    noP95: "This index stores no regional P95 slope: the reference is compared with each window's full slope distribution.",
    condLabel: { bareMin: "Bare ground", vegetatedMax: "Vegetation", access: "Access", permafrost: "Permafrost", rock: "Rock", temperature: "Temperature" } as Record<string, string>,
    condRejected: (label: string, outside: string, missing: string) => `${label}: ${outside} windows outside${missing !== "0" ? `, ${missing} without a value` : ""}.`,
    bare: "Bare ground", score: "Score (Mars v2)",
    scopeEarth: "42,405 eligible Earth windows from the VAL-004 reverse map (every 50 km, 56° S to 60° N, at least 90 % land), with five measured dimensions: bare ground, access, permafrost, rock and temperature (earth dimensions v1). This index stores no regional P95.",
    rankingV2: "Ordered by the Mars model v2 score (VAL-003): 0.5 × base-2 Jensen–Shannon distance to the frozen Jezero histogram + 0.5 × (1 − bare ground).",
    explainConditions: "Meets every requested terrain condition, measured in the window.",
    explainV2: (s: string) => `Mars model v2 score: ${s} (0.5 × slope distance + 0.5 × (1 − bare ground)).`,
    explainV1: "No bare-ground value: ordered by slope distance only (model v1).",
    availEarth: "Earth index: 42,405 windows of 50 km with their slope fingerprint and five measured conditions (bare ground, access, permafrost, rock and temperature).",
  },
};
/** "Head · tail" labels become a label and a quieter hint, so no line is joined by dots. */
function splitLabel(text: string): [string, string] {
  const i = text.indexOf(" · ");
  return i < 0 ? [text, ""] : [text.slice(0, i), text.slice(i + 3)];
}

export default function ExperimentSearch() {
  const t = useT(SEARCH_T);
  const vt = useT(VERIFY_T);
  const w = useT(WB_T);
  const [picked, setPicked] = useState<string | null>(null);
  const { lang } = useLang();
  const [log, setLog] = useState<Verification[]>([]);
  const [onlyVerified, setOnlyVerified] = useState(false);
  function updateLog(next: Verification[]) { setLog(next); saveLog(next); }
  const evidenceText = EVIDENCE_LABELS[lang];
  const [request, setRequest] = useState<SearchRequest>(defaults);
  // The example title and objective follow the language until the visitor types their own,
  // so a demo only needs "Buscar candidatos".
  useEffect(() => {
    const frame = requestAnimationFrame(() => setRequest(prev => ({
      ...prev,
      title: [SEARCH_T.es.defaultTitle, SEARCH_T.en.defaultTitle].includes(prev.title) ? t.defaultTitle : prev.title,
      objective: ["", SEARCH_T.es.defaultObjective, SEARCH_T.en.defaultObjective].includes(prev.objective) ? t.defaultObjective : prev.objective,
    })));
    return () => cancelAnimationFrame(frame);
  }, [t]);
  // ?target=<id> (from a Missions sheet) preselects that reference, once.
  const preselected = useRef(false);
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get("target");
    if (!target || !isPlanetaryTarget(target) || preselected.current) return;
    preselected.current = true;
    const frame = requestAnimationFrame(() => setRequest(prev => ({ ...prev, ...defaultsFor(target), target, mode: "indexed", title: w.regionTitle(planetaryTargets[target].short), objective: w.regionObjective(planetaryTargets[target].short) })));
    return () => cancelAnimationFrame(frame);
  }, [w]);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<SearchResult[]>([]);
  const [grouped, setGrouped] = useState(true);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(historyKey) || "[]");
      if (Array.isArray(stored)) setHistory(stored.filter(r => r?.runId && r?.request && Array.isArray(r?.candidates)).slice(0, 20));
    } catch { /* Browser storage is optional. */ }
    setLog(loadLog());
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const hasSites = !!result?.candidates.some(c => c.site);
  const keys = useMemo(() => result ? requiredKeys(result) : [], [result]);
  const teamVerified = (c: Candidate) => c.status === "verification-required" && statusFor(log, c.id, keys).complete;
  const verifiedCount = result?.candidates.filter(teamVerified).length ?? 0;
  const showOnlyVerified = onlyVerified && verifiedCount > 0;
  // Grouped view shows one representative per site; raw view keeps every ranked window.
  const visible = useMemo(() => result?.candidates
    .map((c, i) => ({ c, rawRank: i + 1 }))
    .filter(({ c }) => !grouped || !c.site || c.site.isRepresentative)
    .filter(({ c }) => !showOnlyVerified || (c.status === "verification-required" && statusFor(log, c.id, keys).complete)) || [], [result, grouped, showOnlyVerified, log, keys]);
  const rawRankById = useMemo(() => new Map(result?.candidates.map((c, i) => [c.id, i + 1]) ?? []), [result]);
  const markers = useMemo(() => visible.map(({ c, rawRank }) => ({
    id: c.id, name: placeLabel(c, lang).title, lon: c.lon, lat: c.lat, jsd: c.jsd === null ? t.notApplicable : c.jsd.toFixed(4),
    best: rawRank === 1 && result?.request.mode !== "facilities",
    footprintKm: result?.request.mode === "facilities" ? null : result?.provenance.footprintKm,
  })), [visible, result, t, lang]);
  function change<K extends keyof SearchRequest>(key: K, value: SearchRequest[K]) {
    setRequest(prev => ({ ...prev, [key]: value }));
  }
  const earthMode = request.mode === "indexed" && isPlanetaryTarget(request.target);
  const filters = request.earthFilters ?? {};
  function setFilter<K extends keyof EarthFilters>(key: K, value: EarthFilters[K] | undefined) {
    const next = { ...filters };
    if (value === undefined || value === false || (Array.isArray(value) && !value.length)) delete next[key]; else next[key] = value;
    change("earthFilters", next);
  }
  /** The two demo examples: the frozen Jezero pilot and a lunar drilling campaign near Shackleton. */
  function loadExample(which: "mars" | "moon") {
    setResult(null); setError(""); setPicked(null);
    setRequest(which === "mars"
      ? { ...defaults, title: t.defaultTitle, objective: t.defaultObjective }
      : { ...defaults, ...defaultsFor("shackleton"), target: "shackleton", profile: "drilling", mode: "indexed", title: w.moonTitle, objective: w.moonObjective, earthFilters: { bareMin: 0.5, permafrost: true } });
  }
  async function search(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null); setPicked(null);
    try {
      // The earth index has no regional P95, so its slope limits are not sent; terrain conditions exist only there.
      const body = earthMode ? { ...request, minSlopeP95: 0, maxSlopeP95: 90 } : { ...request, earthFilters: {} };
      const response = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error([data.error, data.detail].filter(Boolean).join(" "));
      setResult(data);
      const next = [data, ...history].slice(0, 20);
      setHistory(next);
      try { localStorage.setItem(historyKey, JSON.stringify(next)); } catch { /* Export remains available. */ }
    } catch (e) { setError(e instanceof Error ? e.message : t.failed); }
    finally { setBusy(false); }
  }
  function download() {
    if (!result) return;
    const reference = resultReference(result);
    const entries = forCandidates(log, result.candidates.map(c => c.id));
    const team = entries.length ? { teamVerifications: { statement: VERIFICATION_STATEMENT, entries } } : {};
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...result, ...(reference ? { planetaryReference: reference } : {}), ...team }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "parallax-" + result.runId + ".json"; link.click(); URL.revokeObjectURL(url);
  }
  const numberInput = (key: NumericField, label: string, min: number, max: number, step = 0.1) => (
    <label className="wb-field">{label}<input required type="number" min={min} max={max} step={step} value={request[key]} onChange={e => change(key, Number(e.target.value))} className={inputClass} /></label>
  );
  const reference = result ? resultReference(result) : null;
  const targetShort = result && isPlanetaryTarget(result.request.target) ? planetaryTargets[result.request.target].short : t.theTarget;
  const current = visible.find(v => v.c.id === picked) ?? visible[0];
  const statusChip = (c: Candidate) => {
    const st = c.status === "verification-required" ? statusFor(log, c.id, keys) : null;
    if (st?.complete) return <span className="wb-chip wb-chip--good">{vt.badgeDone}</span>;
    if (st && st.verified.length) return <span className="wb-chip wb-chip--mid">{vt.badgePartial(st.verified.length, st.required.length)}</span>;
    return <span className={`wb-chip ${c.status === "verification-required" ? "wb-chip--mid" : "wb-chip--info"}`}>{t.status[c.status] ?? c.status.replaceAll("-", " ")}</span>;
  };
  const [envelopeHead, envelopeTail] = splitLabel(t.envelope);
  const [boundsHead, boundsTail] = splitLabel(t.bounds);
  const [coverHead, coverTail] = splitLabel(t.coverFilters);
  const [recentHead, recentTail] = splitLabel(t.recent);

  return <Page>
    <div className="wb">
      <header className="wb-head">
        <h1>{t.h1}</h1>
        <p>{t.lead}</p>
      </header>
      <div className="wb-exp">
        <form onSubmit={search} className="wb-form" aria-label={t.h1}>
          <div className="wb-form-body">
            <div className="wb-sec-body" style={{ paddingTop: 0 }} role="group" aria-labelledby="wb-examples">
              <span id="wb-examples" className="wb-help">{w.examples}</span>
              <div className="grid gap-2">
                <button type="button" className="wb-btn" aria-pressed={request.target === "jezero" && request.profile === "mobility"} onClick={() => loadExample("mars")}>{w.exMars}</button>
                <button type="button" className="wb-btn" aria-pressed={request.target === "shackleton" && request.profile === "drilling"} onClick={() => loadExample("moon")}>{w.exMoon}</button>
              </div>
            </div>
            <details className="wb-sec" open>
              <summary>{w.secExperiment}</summary>
              <div className="wb-sec-body">
                <label className="wb-field">{t.name}<input required maxLength={160} value={request.title} onChange={e => change("title", e.target.value)} className={inputClass} /></label>
                <label className="wb-field">{t.type}<select value={request.profile} onChange={e => {
                  const profile = e.target.value as Profile;
                  setRequest(prev => ({ ...prev, profile, mode: ["dust", "thermal"].includes(profile) ? "facilities" : "indexed", landCoverConstraints: {} }));
                }} className={inputClass}>{Object.entries(profiles).map(([key, p]) => <option value={key} key={key}>{PROFILE_LABELS[lang][key] ?? p.label}</option>)}</select></label>
                <p className="wb-note">{t.critical(profiles[request.profile].evidence.map(k => evidenceText[k]).join("; "))}</p>
                <label className="wb-field">{t.objective}<textarea maxLength={3000} rows={3} value={request.objective} onChange={e => change("objective", e.target.value)} className={inputClass} placeholder={t.objectivePh} /></label>
                <p className="wb-help">{t.objectiveNote}</p>
              </div>
            </details>

            <details className="wb-sec" open>
              <summary>{w.secReference}</summary>
              <div className="wb-sec-body">
                <label className="wb-field">{t.evidenceMode}<select value={request.mode} onChange={e => setRequest(prev => ({ ...prev, mode: e.target.value as SearchRequest["mode"], landCoverConstraints: {} }))} className={inputClass}>
                  {!["dust", "thermal"].includes(request.profile) && <option value="indexed">{t.modeIndexed}</option>}
                  {!PUBLIC_DEPLOYMENT && !["dust", "thermal"].includes(request.profile) && <option value="live">{t.modeLive}</option>}
                  <option value="facilities">{t.modeFacilities}</option>
                </select></label>
                {request.mode !== "facilities" && <>
                  <label className="wb-field">{t.target}<select value={request.target} onChange={e => { const target = e.target.value as SearchRequest["target"]; setRequest(prev => ({ ...prev, target, ...defaultsFor(target) })); }} className={inputClass}>
                    {Object.entries(planetaryTargets).filter(([id]) => !isArtemisRegion(id)).map(([id, spec]) => <option key={id} value={id}>{TARGET_LABELS[lang][id] ?? spec.label}</option>)}
                    <optgroup label={w.artemisGroup}>{Object.entries(planetaryTargets).filter(([id]) => isArtemisRegion(id)).map(([id, spec]) => <option key={id} value={id}>{TARGET_LABELS[lang][id] ?? spec.short}</option>)}</optgroup>
                    <option value="terrain">{t.targetTerrain}</option>
                  </select></label>
                  {isArtemisRegion(request.target) && <p className="wb-help">{w.artemisNote}</p>}
                  <p className="wb-help">{t.targetNote}</p>
                  <div className="wb-pair">
                    {!earthMode && numberInput("minSlopeP95", t.minP95, 0, 90)}
                    {!earthMode && numberInput("maxSlopeP95", t.maxP95, 0, 90)}
                    {request.target === "terrain" ? numberInput("desiredSlopeP95", t.prefP95, 0, 90) : numberInput("maxJsd", t.maxDist(isPlanetaryTarget(request.target) ? planetaryTargets[request.target].short : t.theTarget), 0, 1, 0.01)}
                    {numberInput("minLandFraction", t.minLand, 0.9, 1, 0.001)}
                  </div>
                  {earthMode ? <p className="wb-help">{w.noP95}</p> : request.target === "shackleton" && <p className="wb-help">{t.shackletonNote}</p>}
                </>}
                {request.mode === "live" && <p className="wb-note">{t.liveNote}</p>}
                {request.mode === "live" && <fieldset className="wb-sec-body" style={{ border: 0, padding: 0, margin: 0 }}><legend className="wb-field">{coverHead}{coverTail && <span className="wb-help"> ({coverTail})</span>}</legend>
                  {([
                    ["minBareFraction", t.coverMinBare],
                    ["maxTreeFraction", t.coverMaxTree],
                    ["maxBuiltFraction", t.coverMaxBuilt],
                  ] as const).map(([key, label]) => <label key={key} className="wb-field">{label}<input type="number" min="0" max="100" step="any" placeholder={t.noConstraint} className={inputClass} value={request.landCoverConstraints?.[key] === undefined ? "" : Number((request.landCoverConstraints[key]! * 100).toFixed(8))} onChange={e => {
                    const constraints = { ...request.landCoverConstraints };
                    if (e.target.value === "") delete constraints[key]; else constraints[key] = Number(e.target.value) / 100;
                    change("landCoverConstraints", constraints);
                  }} /></label>)}
                  <p className="wb-help">{t.coverNote}</p>
                </fieldset>}
                {request.mode === "indexed" && <p className="wb-help">{t.coverIndexedNote}</p>}
              </div>
            </details>

            {earthMode && <details className="wb-sec" open={Object.keys(filters).length > 0}>
              <summary><span>{w.secConditions} {Object.keys(filters).length > 0 && <span className="wb-help">({Object.keys(filters).length})</span>}</span></summary>
              <fieldset className="wb-sec-body" style={{ border: 0, padding: 0, margin: 0 }}><legend className="visually-hidden">{w.secConditions}</legend>
                <div className="wb-pair">
                  {([["bareMin", w.condBare], ["vegetatedMax", w.condVeg]] as const).map(([key, label]) => <label key={key} className="wb-field">{label}<input id={`wb-cond-${key}`} type="number" min="0" max="100" step="any" placeholder={w.any} className={inputClass} value={filters[key] === undefined ? "" : Number((filters[key]! * 100).toFixed(6))} onChange={e => setFilter(key, e.target.value === "" ? undefined : Math.min(100, Math.max(0, Number(e.target.value))) / 100)} /></label>)}
                </div>
                <div role="group" aria-labelledby="wb-cond-access-label" className="grid gap-1">
                  <span id="wb-cond-access-label" className="wb-field">{w.condAccess}</span>
                  {(["remote", "rural", "populated"] as AccessBand[]).map(b => <label key={b} className="wb-check"><input type="checkbox" checked={filters.access?.includes(b) ?? false} onChange={e => setFilter("access", e.target.checked ? [...(filters.access ?? []), b] : (filters.access ?? []).filter(x => x !== b))} />{w.bands[b]}</label>)}
                </div>
                <label className="wb-check"><input type="checkbox" checked={!!filters.permafrost} onChange={e => setFilter("permafrost", e.target.checked)} />{w.condIce}</label>
                {([["rock", w.condRock], ["temperature", w.condTemp]] as const).map(([key, label]) => <label key={key} className="wb-field">{label}<select id={`wb-cond-${key}`} className={inputClass} value={filters[key] ?? ""} onChange={e => setFilter(key, (e.target.value || undefined) as Level | undefined)}>
                  <option value="">{w.any}</option><option value="holds">{w.holds}</option><option value="holds_or_partly">{w.holdsOrPartly}</option>
                </select></label>)}
                <p className="wb-help">{w.condNote}</p>
              </fieldset>
            </details>}

            <details className="wb-sec">
              <summary><span>{w.secArea} <span className="wb-help">({boundsTail || boundsHead})</span></span></summary>
              <fieldset className="wb-sec-body" style={{ border: 0, padding: 0, margin: 0 }}><legend className="visually-hidden">{boundsHead}</legend>
                <div className="wb-pair">
                  {numberInput("west", t.west, -180, 180)}{numberInput("east", t.east, -180, 180)}
                  {numberInput("south", t.south, -90, 90)}{numberInput("north", t.north, -90, 90)}
                </div>
              </fieldset>
            </details>

            <details className="wb-sec">
              <summary><span>{envelopeHead} {envelopeTail && <span className="wb-help">({envelopeTail})</span>}</span></summary>
              <fieldset className="wb-sec-body" style={{ border: 0, padding: 0, margin: 0 }}><legend className="visually-hidden">{t.envelope}</legend>
                <div className="wb-pair">{Object.entries(envelopeFields).map(([key, field]) => <label key={key} className="wb-field">{ENVELOPE_LABELS[lang][key] ?? field.label}<input type="number" min={field.min} max={field.max} step="any" className={inputClass} value={request.testEnvelope?.[key as keyof typeof envelopeFields] ?? ""} onChange={e => {
                  const envelope = { ...request.testEnvelope };
                  if (e.target.value === "") delete envelope[key as keyof typeof envelopeFields];
                  else envelope[key as keyof typeof envelopeFields] = Number(e.target.value);
                  change("testEnvelope", envelope);
                }} /></label>)}</div>
                <p className="wb-help">{t.envelopeNote}</p>
              </fieldset>
            </details>

            <details className="wb-sec">
              <summary><span>{t.extraEvidence} {request.requirements.length > 0 && <span className="wb-help">({request.requirements.length})</span>}</span></summary>
              <fieldset className="wb-sec-body" style={{ border: 0, padding: 0, margin: 0 }}><legend className="visually-hidden">{t.extraEvidence}</legend>
                {Object.keys(evidenceLabels).map(key => <label key={key} className="wb-check"><input type="checkbox" checked={request.requirements.includes(key)} onChange={e => change("requirements", e.target.checked ? [...request.requirements, key] : request.requirements.filter(k => k !== key))} />{evidenceText[key]}</label>)}
              </fieldset>
            </details>
          </div>

          <div className="wb-form-foot">
            <label className="wb-check"><input type="checkbox" checked={request.strict} onChange={e => change("strict", e.target.checked)} />{t.strict}</label>
            {numberInput("limit", t.limit, 1, 50, 1)}
            <button type="submit" disabled={busy} aria-busy={busy} className="wb-btn wb-btn--primary wb-btn--wide">{busy ? t.busy : t.submit}</button>
            {error && <p role="alert" className="wb-error">{error}</p>}
          </div>
        </form>

        <section aria-live="polite" className="wb-results">
          {busy && <div role="status" className="grid gap-2"><span className="visually-hidden">{w.searching}</span><div className="wb-skeleton" /><div className="wb-skeleton" /><div className="wb-skeleton" /></div>}
          {!result && !busy && <div className="wb-empty"><h2>{t.available}</h2><ul>
            <li>{w.availEarth}</li>
            <li>{PUBLIC_DEPLOYMENT ? t.availLivePublic : t.availLive}</li>
            <li>{t.availFacilities}</li>
            <li>{t.availUnknown}</li>
          </ul></div>}
          {result && <>
            <div className="wb-summary">
              <div className="wb-summary-top"><h2>{result.request.title}</h2><button type="button" onClick={download} className="wb-btn">{t.export}</button></div>
              <dl className="wb-figures">
                <div><dt>{w.figures.returned}</dt><dd>{result.candidates.length}</dd></div>
                {hasSites && result.independentSites !== undefined && <div><dt>{w.figures.sites}</dt><dd>{result.independentSites}</dd></div>}
                <div><dt>{w.figures.evaluated}</dt><dd>{result.evaluated}</dd></div>
                <div><dt>{w.figures.rejected}</dt><dd>{result.rejected}</dd></div>
                <div><dt>{w.figures.provisional}</dt><dd>{result.provisional}</dd></div>
                <div><dt>{w.figures.errors}</dt><dd>{result.errors.length}</dd></div>
              </dl>
              <div className="wb-toggles">
                {hasSites && result.independentSites !== undefined && result.independentSites < result.candidates.length && <label className="wb-check"><input type="checkbox" checked={grouped} onChange={e => setGrouped(e.target.checked)} />{t.group}</label>}
                {verifiedCount > 0 && <label className="wb-check"><input type="checkbox" checked={onlyVerified} onChange={e => setOnlyVerified(e.target.checked)} />{vt.onlyVerified(verifiedCount)}</label>}
              </div>
              {hasSites && result.independentSites !== undefined && result.independentSites < result.candidates.length && <p className="wb-help">{t.groupNote(result.candidates.length - result.independentSites)}</p>}
              {Object.keys(result.request.landCoverConstraints ?? {}).length > 0 && <div className="wb-help"><p>{t.coverActive(Object.entries(result.request.landCoverConstraints ?? {}).map(([key, value]) => `${t.coverLabel[key]} ${Number((value * 100).toFixed(8))}%`).join("; "))}</p><p>{t.coverRejected(result.landCoverRejected?.outside ?? 0, result.landCoverRejected?.missing ?? 0)}</p></div>}
              {Object.keys(result.request.earthFilters ?? {}).length > 0 && <div className="wb-help">{Object.entries(result.earthRejected ?? {}).map(([key, v]) => <p key={key}>{w.condRejected(w.condLabel[key as EarthFilterKey], v!.outside.toLocaleString(lang), v!.missing.toLocaleString(lang))}</p>)}</div>}
              <p className="wb-help">{scopeText(result, t, w)} {rankingText(result, t, w)}</p>
            </div>
            {!result.candidates.length && <p role="status" className="wb-note">{t.none}</p>}
            {!!markers.length && <DiscoveryMap key={result.runId + (grouped ? "-sites" : "-raw")} candidates={markers} focusId={current?.c.id ?? null} onSelect={setPicked} controlled distanceLabel={isPlanetaryTarget(result.request.target) ? t.distanceTo(planetaryTargets[result.request.target].short) : t.planetaryDistance} />}

            {visible.length > 0 && <div className="wb-tablewrap">
              <table className="wb-table" aria-describedby="wb-pick-hint">
                <thead><tr>
                  <th scope="col"><span className="wb-rank" style={{ paddingLeft: 0 }}>{w.rank}</span></th>
                  <th scope="col">{w.site}</th>
                  <th scope="col" className="num">{t.distanceTo(targetShort)}</th>
                  {result.index === "earth" && result.request.target === "jezero" && <th scope="col" className="num">{w.score}</th>}
                  <th scope="col" className="num">{result.index === "earth" ? w.bare : w.p95}</th>
                  <th scope="col" className="num">{w.land}</th>
                  <th scope="col">{w.status}</th>
                </tr></thead>
                <tbody>{visible.map(({ c, rawRank }) => {
                  const label = placeLabel(c, lang);
                  const on = current?.c.id === c.id;
                  return <tr key={c.id} className="wb-row" aria-selected={on} onClick={() => setPicked(c.id)}>
                    <td className="num wb-rank">{grouped && c.site ? c.site.rank : rawRank}</td>
                    <td><button type="button" className="wb-rowbtn" onClick={e => { e.stopPropagation(); setPicked(c.id); document.getElementById("wb-detail")?.scrollIntoView({ block: "start" }); }}>{label.title}</button>{label.detail && <span className="wb-help">{label.detail}</span>}</td>
                    <td className="num">{c.jsd === null ? t.notApplicable : c.jsd.toFixed(4)}</td>
                    {result.index === "earth" && result.request.target === "jezero" && <td className="num">{c.score == null ? t.notApplicable : c.score.toFixed(4)}</td>}
                    <td className="num">{result.index === "earth" ? (c.earth?.bare == null ? t.notApplicable : `${(c.earth.bare * 100).toFixed(0)} %`) : c.slopeP95 === null ? t.notApplicable : `${c.slopeP95.toFixed(2)}°`}</td>
                    <td className="num">{c.landFraction === null ? t.notApplicable : `${(c.landFraction * 100).toFixed(2)} %`}</td>
                    <td>{statusChip(c)}</td>
                  </tr>;
                })}</tbody>
              </table>
              <p id="wb-pick-hint" className="wb-help" style={{ marginTop: "var(--space-xs)" }}>{w.pickHint}</p>
            </div>}

            {current && (() => { const { c, rawRank } = current; const label = placeLabel(c, lang); const overlapping = grouped ? c.site?.overlapping ?? [] : []; return <article id="wb-detail" className="wb-detail" aria-labelledby="wb-detail-title">
              <div className="wb-detail-head"><div><h3 id="wb-detail-title">{grouped && c.site ? t.site(c.site.rank) : rawRank}. {label.title}</h3>{label.detail && <p>{label.detail}</p>}</div>{statusChip(c)}</div>
              <dl className="wb-dl wb-dl--wide">
                <div><dt>{w.coords}</dt><dd className="num">{c.lat.toFixed(5)}°, {c.lon.toFixed(5)}°</dd></div>
                <div><dt>{w.window}</dt><dd className="num">{c.id}</dd>{grouped && c.site && <dd className="wb-help">{t.windowRankCap(rawRank)}</dd>}{!grouped && c.site && <dd className="wb-help">{t.siteOf(c.site.rank, c.site.isRepresentative)}</dd>}</div>
                {c.jsd !== null && <div><dt>{t.distanceTo(targetShort)}</dt><dd className="num">{c.jsd.toFixed(4)}</dd></div>}
                {c.score != null && <div><dt>{w.score}</dt><dd className="num">{c.score.toFixed(4)}</dd></div>}
                {c.slopeP95 !== null && <div><dt>{w.p95}</dt><dd className="num">{c.slopeP95.toFixed(2)}°</dd></div>}
                {c.landFraction !== null && <div><dt>{w.land}</dt><dd className="num">{(c.landFraction * 100).toFixed(2)} %</dd></div>}
              </dl>
              {overlapping.length > 0 && <details className="wb-disclose"><summary>{t.overlapSummary(overlapping.length)}</summary>
                <p>{t.overlapNote}</p>
                <ul className="wb-list">{overlapping.map(id => { const m = result.candidates.find(x => x.id === id); return <li key={id}>{t.windowRankCap(rawRankById.get(id) ?? 0)}: <span className="num">{id}</span>{m?.jsd != null ? `, Jezero JSD ${m.jsd.toFixed(4)}` : ""}{m?.slopeP95 != null ? `, P95 ${m.slopeP95.toFixed(2)}°` : ""}</li>; })}</ul>
              </details>}
              <ul className="wb-list">{explanationText(c, result, t, w).map(line => <li key={line}>{line}</li>)}</ul>
              {(() => { const m = markers.find(x => x.id === c.id); return m ? <SatellitePreview key={m.id} candidate={m} distanceLabel={isPlanetaryTarget(result.request.target) ? t.distanceTo(planetaryTargets[result.request.target].short) : t.planetaryDistance} /> : null; })()}
              <TerrainComparison candidate={c} result={result} />
              {c.earth && isPlanetaryTarget(result.request.target) && <EarthDimensions earth={c.earth} target={result.request.target} />}
              {result.request.mode !== "facilities" && !c.earth && <LandCoverEvidence candidate={c} />}
              {reference?.target.planet === "Moon" && <LunarLightCalendar lat={c.lat} lon={c.lon} />}
              {keys.length > 0 && <section aria-label={teamVerified(c) ? vt.headingDone : t.stillRequired}><h4 className={`wb-section-title ${teamVerified(c) ? "" : ""}`} style={{ fontSize: "var(--text-sm)" }}>{teamVerified(c) ? vt.headingDone : t.stillRequired}</h4>
              <VerificationList candidateId={c.id} keys={keys} labels={evidenceText} log={log} onChange={updateLog} /></section>}
              {result.request.mode === "facilities" && <p className="wb-help">{t.facilityConfirm}</p>}
              {c.source.startsWith("https://") ? <a className="wb-link" href={c.source} target="_blank" rel="noopener noreferrer">{t.capabilitySource}</a> : <p className="wb-help">{c.source}</p>}
            </article>; })()}

            {!!result.errors.length && <details className="wb-disclose"><summary>{t.errors(result.errors.length)}</summary><ul className="wb-list">{result.errors.map(e => <li key={e.id}>{e.id}: {e.message}</li>)}</ul></details>}
            <details className="wb-disclose" style={{ overflowWrap: "anywhere" }}><summary>{t.provenance}</summary><p>{result.provenance.dataset}</p><p>{t.version} {result.provenance.version}</p><p>{result.createdAt}, {result.runId}</p>{result.placeNames && <p>{result.placeNames.method} {result.placeNames.attribution}.</p>}{hasSites && <p>{t.grouping}</p>}</details>
          </>}
          {!!history.length && <div className="wb-history"><h2>{recentHead}{recentTail && <span className="wb-help"> ({recentTail})</span>}</h2><div>{history.map(r => <button type="button" key={r.runId} onClick={() => { setResult(r); setRequest(r.request); setError(""); setPicked(null); }} className="wb-btn">{r.request.title}: {t.results(r.candidates.length)}</button>)}</div><p className="wb-help">{t.recentNote}</p></div>}
        </section>
      </div>
    </div>
  </Page>;
}
