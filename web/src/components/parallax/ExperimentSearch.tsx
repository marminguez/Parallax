"use client";
import { useEffect, useMemo, useState } from "react";
import DiscoveryMap from "./DiscoveryMap";
import TerrainComparison, { resultReference } from "./TerrainComparison";
import LunarLightCalendar from "./LunarLightCalendar";
import LandCoverEvidence from "./LandCoverEvidence";
import VerificationList, { VERIFY_T } from "./VerificationList";
import { forCandidates, loadLog, saveLog, statusFor, VERIFICATION_STATEMENT, type Verification } from "@/lib/verification";
import { profiles, Profile, evidenceLabels, envelopeFields, SearchRequest, SearchResult, type Candidate } from "@/lib/search";
import { placeLabel } from "@/lib/places";
import { planetaryTargets, isPlanetaryTarget } from "@/lib/targets";
import { PUBLIC_DEPLOYMENT } from "@/lib/basemaps";
import { Page } from "@/components/site/Site";
import { useLang, useT } from "@/lib/i18n";
import { SEARCH_T, PROFILE_LABELS, EVIDENCE_LABELS, ENVELOPE_LABELS, TARGET_LABELS } from "@/lib/searchCopy";

// Defaults applied when the ranking target changes. Jezero keeps the frozen pilot settings (rover-scale
// slope cap). The lunar south pole is steep, so the Moon starts without a slope cap or distance limit;
// users add a cap for hardware that cannot operate on steep regional terrain.
const targetDefaults: Record<SearchRequest["target"], Partial<SearchRequest>> = {
  jezero: { maxJsd: 0.3, maxSlopeP95: 15 },
  shackleton: { maxJsd: 1, maxSlopeP95: 90 },
  terrain: {},
};

const defaults: SearchRequest = {
  title: "Jezero rover field campaign", objective: "", profile: "mobility",
  target: "jezero", mode: "indexed", west: -180, east: 180, south: -55, north: 59,
  minLandFraction: 0.9, minSlopeP95: 0, maxSlopeP95: 15, desiredSlopeP95: 8.4,
  maxJsd: 0.3, requirements: [], strict: false, limit: 10,
};
const historyKey = "parallax-experiments-v1";
const inputClass = "mt-2 w-full rounded-sm border border-white/15 bg-[#11171e] px-3 py-2 text-sm text-white";
type NumericField = "west" | "east" | "south" | "north" | "minSlopeP95" | "maxSlopeP95" | "desiredSlopeP95" | "maxJsd" | "minLandFraction" | "limit";

type Copy = (typeof SEARCH_T)["en"];

/** The API answers in English; these rebuild its prose from the numbers in the visitor's language. */
function scopeText(r: SearchResult, t: Copy) {
  return r.request.mode === "facilities" ? t.scopeFacilities : r.request.mode === "live" ? t.scopeLive : t.scopeIndexed;
}
function rankingText(r: SearchResult, t: Copy) {
  if (r.request.mode === "facilities") return t.rankingFacilities;
  return isPlanetaryTarget(r.request.target) ? t.rankingTarget(planetaryTargets[r.request.target].short, r.request.target === "jezero") : t.rankingTerrain;
}
function explanationText(c: Candidate, r: SearchResult, t: Copy) {
  if (r.request.mode === "facilities") return [...(t.facilityEvidence[c.id] ?? c.explanation.slice(0, -1)), t.facilityMarker];
  if (c.landFraction === null || c.slopeP95 === null) return c.explanation;
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

export default function ExperimentSearch() {
  const t = useT(SEARCH_T);
  const vt = useT(VERIFY_T);
  const { lang } = useLang();
  const [log, setLog] = useState<Verification[]>([]);
  const [onlyVerified, setOnlyVerified] = useState(false);
  function updateLog(next: Verification[]) { setLog(next); saveLog(next); }
  const evidenceText = EVIDENCE_LABELS[lang];
  const [request, setRequest] = useState<SearchRequest>(defaults);
  // The example title follows the language until the visitor types their own.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setRequest(prev => [SEARCH_T.es.defaultTitle, SEARCH_T.en.defaultTitle].includes(prev.title) ? { ...prev, title: t.defaultTitle } : prev));
    return () => cancelAnimationFrame(frame);
  }, [t]);
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
  async function search(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
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
    <label className="text-xs text-[var(--text-secondary)]">{label}<input required type="number" min={min} max={max} step={step} value={request[key]} onChange={e => change(key, Number(e.target.value))} className={inputClass} /></label>
  );
  return <Page>
    <div className="pt-10 text-[var(--text-primary)] sm:pt-14">
      <p className="text-xs uppercase tracking-widest text-[var(--earth-bright)]">{t.kicker}</p>
      <h1 className="font-display mt-3 text-[44px] leading-[1.04] sm:text-[60px]">{t.h1}</h1>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{t.lead}</p>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[390px_1fr]">
        <form onSubmit={search} className="parallax-panel space-y-5 rounded-sm p-5">
          <label className="block text-xs">{t.name}<input required maxLength={160} value={request.title} onChange={e => change("title", e.target.value)} className={inputClass} /></label>
          <label className="block text-xs">{t.type}<select value={request.profile} onChange={e => {
            const profile = e.target.value as Profile;
            setRequest(prev => ({ ...prev, profile, mode: ["dust", "thermal"].includes(profile) ? "facilities" : "indexed", landCoverConstraints: {} }));
          }} className={inputClass}>{Object.entries(profiles).map(([key, p]) => <option value={key} key={key}>{PROFILE_LABELS[lang][key] ?? p.label}</option>)}</select></label>
          <label className="block text-xs">{t.objective}<textarea maxLength={3000} rows={3} value={request.objective} onChange={e => change("objective", e.target.value)} className={inputClass} placeholder={t.objectivePh} /></label>
          <p className="text-xs leading-5 text-[var(--text-muted)]">{t.objectiveNote}</p>
          <fieldset><legend className="text-xs">{t.envelope}</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">{Object.entries(envelopeFields).map(([key, field]) => <label key={key} className="text-xs text-[var(--text-secondary)]">{ENVELOPE_LABELS[lang][key] ?? field.label}<input type="number" min={field.min} max={field.max} step="any" className={inputClass} value={request.testEnvelope?.[key as keyof typeof envelopeFields] ?? ""} onChange={e => {
              const envelope = { ...request.testEnvelope };
              if (e.target.value === "") delete envelope[key as keyof typeof envelopeFields];
              else envelope[key as keyof typeof envelopeFields] = Number(e.target.value);
              change("testEnvelope", envelope);
            }} /></label>)}</div>
            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{t.envelopeNote}</p>
          </fieldset>
          <label className="block text-xs">{t.evidenceMode}<select value={request.mode} onChange={e => setRequest(prev => ({ ...prev, mode: e.target.value as SearchRequest["mode"], landCoverConstraints: {} }))} className={inputClass}>
            {!["dust", "thermal"].includes(request.profile) && <option value="indexed">{t.modeIndexed}</option>}
            {!PUBLIC_DEPLOYMENT && !["dust", "thermal"].includes(request.profile) && <option value="live">{t.modeLive}</option>}
            <option value="facilities">{t.modeFacilities}</option>
          </select></label>
          {request.mode !== "facilities" && <>
            <label className="block text-xs">{t.target}<select value={request.target} onChange={e => { const target = e.target.value as SearchRequest["target"]; setRequest(prev => ({ ...prev, target, ...targetDefaults[target] })); }} className={inputClass}>
              {Object.entries(planetaryTargets).map(([id, spec]) => <option key={id} value={id}>{TARGET_LABELS[lang][id] ?? spec.label}</option>)}
              <option value="terrain">{t.targetTerrain}</option>
            </select></label>
            <p className="text-xs leading-5 text-[var(--text-muted)]">{t.targetNote}</p>
            <div className="grid grid-cols-2 gap-3">
              {numberInput("minSlopeP95", t.minP95, 0, 90)}
              {numberInput("maxSlopeP95", t.maxP95, 0, 90)}
              {request.target === "terrain" ? numberInput("desiredSlopeP95", t.prefP95, 0, 90) : numberInput("maxJsd", t.maxDist(isPlanetaryTarget(request.target) ? planetaryTargets[request.target].short : t.theTarget), 0, 1, 0.01)}
              {numberInput("minLandFraction", t.minLand, 0.9, 1, 0.001)}
            </div>
            {request.target === "shackleton" && <p className="text-xs leading-5 text-[var(--text-muted)]">{t.shackletonNote}</p>}
          </>}
          <fieldset><legend className="text-xs">{t.bounds}</legend><div className="mt-2 grid grid-cols-2 gap-3">
            {numberInput("west", t.west, -180, 180)}{numberInput("east", t.east, -180, 180)}
            {numberInput("south", t.south, -90, 90)}{numberInput("north", t.north, -90, 90)}
          </div></fieldset>
          {request.mode === "live" && <p className="text-xs text-[var(--warning)]">{t.liveNote}</p>}
          {request.mode === "live" && <fieldset className="rounded-sm border border-white/15 p-3"><legend className="px-1 text-xs">{t.coverFilters}</legend>
            <div className="space-y-3">{([
              ["minBareFraction", t.coverMinBare],
              ["maxTreeFraction", t.coverMaxTree],
              ["maxBuiltFraction", t.coverMaxBuilt],
            ] as const).map(([key, label]) => <label key={key} className="block text-xs text-[var(--text-secondary)]">{label}<input type="number" min="0" max="100" step="any" placeholder={t.noConstraint} className={inputClass} value={request.landCoverConstraints?.[key] === undefined ? "" : Number((request.landCoverConstraints[key]! * 100).toFixed(8))} onChange={e => {
              const constraints = { ...request.landCoverConstraints };
              if (e.target.value === "") delete constraints[key]; else constraints[key] = Number(e.target.value) / 100;
              change("landCoverConstraints", constraints);
            }} /></label>)}</div>
            <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{t.coverNote}</p>
          </fieldset>}
          {request.mode === "indexed" && <p className="text-xs leading-5 text-[var(--text-muted)]">{t.coverIndexedNote}</p>}
          <fieldset><legend className="text-xs">{t.extraEvidence}</legend><div className="mt-3 space-y-2">
            {Object.keys(evidenceLabels).map(key => <label key={key} className="flex items-start gap-2 text-xs leading-5 text-[var(--text-secondary)]"><input type="checkbox" checked={request.requirements.includes(key)} onChange={e => change("requirements", e.target.checked ? [...request.requirements, key] : request.requirements.filter(k => k !== key))} />{evidenceText[key]}</label>)}
          </div></fieldset>
          <div className="rounded-sm border border-[var(--warning)]/25 p-3 text-xs leading-5 text-[var(--text-secondary)]">{t.critical(profiles[request.profile].evidence.map(k => evidenceText[k]).join("; "))}</div>
          <label className="flex gap-2 text-xs leading-5"><input type="checkbox" checked={request.strict} onChange={e => change("strict", e.target.checked)} />{t.strict}</label>
          {numberInput("limit", t.limit, 1, 50, 1)}
          <button disabled={busy} className="w-full rounded-sm bg-[var(--earth-primary)] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">{busy ? t.busy : t.submit}</button>
          {error && <p role="alert" className="break-words text-xs leading-5 text-[var(--critical)]">{error}</p>}
        </form>
        <section aria-live="polite" className="min-w-0">
          {!result && <div className="parallax-panel rounded-sm p-7"><h2 className="text-lg">{t.available}</h2><ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-[var(--text-secondary)]">
            <li>{t.availIndex}</li>
            <li>{PUBLIC_DEPLOYMENT ? t.availLivePublic : t.availLive}</li>
            <li>{t.availFacilities}</li>
            <li>{t.availUnknown}</li>
          </ul></div>}
          {result && <>
            <div className="parallax-panel rounded-sm p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl">{result.request.title}</h2><button onClick={download} className="rounded-sm border border-white/20 px-3 py-2 text-xs">{t.export}</button></div>
              <p className="mt-3 text-sm text-[var(--earth-bright)]">{t.counts(result.candidates.length, hasSites && result.independentSites !== undefined ? t.sites(result.independentSites) : "", result.evaluated, result.rejected, result.provisional, result.errors.length)}</p>
              {hasSites && result.independentSites !== undefined && result.independentSites < result.candidates.length && <div className="mt-3 flex flex-wrap items-center gap-3 text-xs leading-5 text-[var(--text-secondary)]">
                <label className="flex items-center gap-2"><input type="checkbox" checked={grouped} onChange={e => setGrouped(e.target.checked)} />{t.group}</label>
                <span className="text-[var(--text-muted)]">{t.groupNote(result.candidates.length - result.independentSites)}</span>
              </div>}
              {Object.keys(result.request.landCoverConstraints ?? {}).length > 0 && <div className="mt-3 text-xs leading-5 text-[var(--text-secondary)]"><p>{t.coverActive(Object.entries(result.request.landCoverConstraints ?? {}).map(([key, value]) => `${t.coverLabel[key]} ${Number((value * 100).toFixed(8))}%`).join(" · "))}</p><p>{t.coverRejected(result.landCoverRejected?.outside ?? 0, result.landCoverRejected?.missing ?? 0)}</p></div>}
              {verifiedCount > 0 && <label className="mt-3 flex items-center gap-2 text-xs text-[#9fe0b8]"><input type="checkbox" checked={onlyVerified} onChange={e => setOnlyVerified(e.target.checked)} />{vt.onlyVerified(verifiedCount)}</label>}
              <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">{scopeText(result, t)}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{rankingText(result, t)}</p>
            </div>
            {!result.candidates.length && <p role="status" className="mt-5 rounded-sm border border-[var(--warning)]/30 p-5 text-sm leading-6">{t.none}</p>}
            {!!markers.length && <div className="mt-5"><DiscoveryMap key={result.runId + (grouped ? "-sites" : "-raw")} candidates={markers} distanceLabel={isPlanetaryTarget(result.request.target) ? t.distanceTo(planetaryTargets[result.request.target].short) : t.planetaryDistance} /></div>}
            <div className="mt-5 grid gap-4">{visible.map(({ c, rawRank }) => { const label = placeLabel(c, lang); const overlapping = grouped ? c.site?.overlapping ?? [] : []; return <article key={c.id} className="parallax-panel rounded-sm p-5">
              <div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{grouped && c.site ? t.site(c.site.rank) : rawRank}. {label.title}</h3>{(() => {
                const st = c.status === "verification-required" ? statusFor(log, c.id, keys) : null;
                if (st?.complete) return <span className="rounded-full border border-[#5fbf86]/40 px-2 py-0.5 text-xs text-[#9fe0b8]">✓ {vt.badgeDone}</span>;
                if (st && st.verified.length) return <span className="text-xs text-[var(--warning)]">{vt.badgePartial(st.verified.length, st.required.length)}</span>;
                return <span className="text-xs text-[var(--warning)]">{t.status[c.status] ?? c.status.replaceAll("-", " ")}</span>;
              })()}</div>
              {label.detail && <p className="mt-1 text-xs text-[var(--text-secondary)]">{label.detail}</p>}
              <p className="mt-2 font-mono text-xs text-[var(--earth-bright)]">{c.lat.toFixed(5)}°, {c.lon.toFixed(5)}° · <span className="text-[var(--text-muted)]">{c.id}{grouped && c.site ? ` · ${t.windowRank(rawRank)}` : ""}{!grouped && c.site ? ` · ${t.siteOf(c.site.rank, c.site.isRepresentative)}` : ""}</span></p>
              {overlapping.length > 0 && <details className="mt-3 rounded-sm border border-white/10 p-3 text-xs leading-5 text-[var(--text-secondary)]"><summary className="cursor-pointer">{t.overlapSummary(overlapping.length)}</summary>
                <p className="mt-2 text-[var(--text-muted)]">{t.overlapNote}</p>
                <ul className="mt-2 list-disc pl-5">{overlapping.map(id => { const m = result.candidates.find(x => x.id === id); return <li key={id}>{t.windowRankCap(rawRankById.get(id) ?? 0)} · <span className="font-mono">{id}</span>{m?.jsd != null ? ` · Jezero JSD ${m.jsd.toFixed(4)}` : ""}{m?.slopeP95 != null ? ` · P95 ${m.slopeP95.toFixed(2)}°` : ""}</li>; })}</ul>
              </details>}
              <div className="mt-3 flex flex-wrap gap-4 text-xs">{c.jsd !== null && <span>{t.distanceLine(isPlanetaryTarget(result.request.target) ? planetaryTargets[result.request.target].short : t.theTarget, c.jsd.toFixed(4))}</span>}{c.slopeP95 !== null && <span>{t.p95Line(c.slopeP95.toFixed(2))}</span>}{c.landFraction !== null && <span>{t.landLine((c.landFraction * 100).toFixed(2))}</span>}</div>
              <ul className="mt-3 list-disc pl-5 text-xs leading-6 text-[var(--text-secondary)]">{explanationText(c, result, t).map(line => <li key={line}>{line}</li>)}</ul>
              <TerrainComparison candidate={c} result={result} />
              {result.request.mode !== "facilities" && <LandCoverEvidence candidate={c} />}
              {resultReference(result)?.target.planet === "Moon" && <LunarLightCalendar lat={c.lat} lon={c.lon} />}
              {keys.length > 0 && <><h4 className={`mt-4 text-xs ${teamVerified(c) ? "text-[#9fe0b8]" : "text-[var(--warning)]"}`}>{teamVerified(c) ? vt.headingDone : t.stillRequired}</h4>
              <VerificationList candidateId={c.id} keys={keys} labels={evidenceText} log={log} onChange={updateLog} /></>}
              {result.request.mode === "facilities" && <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{t.facilityConfirm}</p>}
              {c.source.startsWith("https://") ? <a className="mt-3 inline-block text-xs underline" href={c.source} target="_blank" rel="noopener noreferrer">{t.capabilitySource}</a> : <p className="mt-3 text-xs text-[var(--text-muted)]">{c.source}</p>}
            </article>; })}</div>
            {!!result.errors.length && <details className="mt-4 text-xs"><summary>{t.errors(result.errors.length)}</summary><ul>{result.errors.map(e => <li key={e.id}>{e.id}: {e.message}</li>)}</ul></details>}
            <details className="mt-4 break-all text-xs leading-5 text-[var(--text-muted)]"><summary>{t.provenance}</summary><p>{result.provenance.dataset}</p><p>{t.version} {result.provenance.version}</p><p>{result.createdAt} · {result.runId}</p>{result.placeNames && <p className="mt-2">{result.placeNames.method} {result.placeNames.attribution}.</p>}{hasSites && <p className="mt-2">{t.grouping}</p>}</details>
          </>}
          {!!history.length && <div className="mt-6 border-t border-white/10 pt-4"><h2 className="text-sm">{t.recent}</h2><div className="mt-3 flex flex-wrap gap-2">{history.map(r => <button key={r.runId} onClick={() => { setResult(r); setRequest(r.request); setError(""); }} className="rounded-sm border border-white/15 px-3 py-2 text-xs">{r.request.title} · {t.results(r.candidates.length)}</button>)}</div><p className="mt-2 text-xs text-[var(--text-muted)]">{t.recentNote}</p></div>}
        </section>
      </div>
    </div>
  </Page>;
}
