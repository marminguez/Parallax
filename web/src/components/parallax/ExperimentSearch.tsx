"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DiscoveryMap from "./DiscoveryMap";
import TerrainComparison from "./TerrainComparison";
import jezero from "../../../data/jezero-target.json";
import { profiles, Profile, evidenceLabels, envelopeFields, SearchRequest, SearchResult } from "@/lib/search";

const defaults: SearchRequest = {
  title: "Jezero rover field campaign", objective: "", profile: "mobility",
  target: "jezero", mode: "indexed", west: -180, east: 180, south: -55, north: 59,
  minLandFraction: 0.9, minSlopeP95: 0, maxSlopeP95: 15, desiredSlopeP95: 8.4,
  maxJsd: 0.3, requirements: [], strict: false, limit: 10,
};
const historyKey = "parallax-experiments-v1";
const inputClass = "mt-2 w-full rounded-sm border border-white/15 bg-[#11171e] px-3 py-2 text-sm text-white";
type NumericField = "west" | "east" | "south" | "north" | "minSlopeP95" | "maxSlopeP95" | "desiredSlopeP95" | "maxJsd" | "minLandFraction" | "limit";

export default function ExperimentSearch() {
  const [request, setRequest] = useState<SearchRequest>(defaults);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<SearchResult[]>([]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(historyKey) || "[]");
      if (Array.isArray(stored)) setHistory(stored.filter(r => r?.runId && r?.request && Array.isArray(r?.candidates)).slice(0, 20));
    } catch { /* Browser storage is optional. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const markers = useMemo(() => result?.candidates.map((c, i) => ({
    name: c.name, lon: c.lon, lat: c.lat, jsd: c.jsd === null ? "Not applicable" : c.jsd.toFixed(4),
    best: i === 0 && result.request.mode !== "facilities",
    footprintKm: result.request.mode === "facilities" ? null : result.provenance.footprintKm,
  })) || [], [result]);
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
    } catch (e) { setError(e instanceof Error ? e.message : "Search failed."); }
    finally { setBusy(false); }
  }
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...result, ...(result.request.mode !== "facilities" && result.request.target === "jezero" ? { planetaryReference: jezero } : {}) }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "parallax-" + result.runId + ".json"; link.click(); URL.revokeObjectURL(url);
  }
  const numberInput = (key: NumericField, label: string, min: number, max: number, step = 0.1) => (
    <label className="text-xs text-[var(--text-secondary)]">{label}<input required type="number" min={min} max={max} step={step} value={request[key]} onChange={e => change(key, Number(e.target.value))} className={inputClass} /></label>
  );
  return <main className="parallax-grid min-h-screen px-5 py-8 text-[var(--text-primary)] md:px-10">
    <div className="mx-auto max-w-[1450px]">
      <Link href="/" className="text-sm tracking-[0.25em]">PARALLAX</Link>
      <p className="mt-8 text-xs uppercase tracking-widest text-[var(--earth-bright)]">Earth analog discovery · traceable evidence</p>
      <h1 className="mt-3 text-3xl font-light md:text-5xl">Explore Earth analogs for your mission.</h1>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">Define measurable constraints and inspect candidates with traceable evidence. Field terrain and controlled test facilities answer different questions.</p>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[390px_1fr]">
        <form onSubmit={search} className="parallax-panel space-y-5 rounded-sm p-5">
          <label className="block text-xs">Experiment name<input required maxLength={160} value={request.title} onChange={e => change("title", e.target.value)} className={inputClass} /></label>
          <label className="block text-xs">Experiment type<select value={request.profile} onChange={e => {
            const profile = e.target.value as Profile;
            setRequest(prev => ({ ...prev, profile, mode: ["dust", "thermal"].includes(profile) ? "facilities" : "indexed" }));
          }} className={inputClass}>{Object.entries(profiles).map(([key, p]) => <option value={key} key={key}>{p.label}</option>)}</select></label>
          <label className="block text-xs">Objective / hardware / success criteria<textarea maxLength={3000} rows={3} value={request.objective} onChange={e => change("objective", e.target.value)} className={inputClass} placeholder="Payload, specimen and measurements required" /></label>
          <p className="text-xs leading-5 text-[var(--text-muted)]">The description is retained in the report. Only structured constraints affect matching.</p>
          <fieldset><legend className="text-xs">Test envelope · optional measured requirements</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">{Object.entries(envelopeFields).map(([key, field]) => <label key={key} className="text-xs text-[var(--text-secondary)]">{field.label}<input type="number" min={field.min} max={field.max} step="any" className={inputClass} value={request.testEnvelope?.[key as keyof typeof envelopeFields] ?? ""} onChange={e => {
              const envelope = { ...request.testEnvelope };
              if (e.target.value === "") delete envelope[key as keyof typeof envelopeFields];
              else envelope[key as keyof typeof envelopeFields] = Number(e.target.value);
              change("testEnvelope", envelope);
            }} /></label>)}</div>
            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">Exact values are retained and make the corresponding evidence mandatory. The current index and facility catalogue cannot verify these numerical envelopes; results stay provisional.</p>
          </fieldset>
          <label className="block text-xs">Search evidence<select value={request.mode} onChange={e => change("mode", e.target.value as SearchRequest["mode"])} className={inputClass}>
            {!["dust", "thermal"].includes(request.profile) && <option value="indexed">Measured Earth index · available now</option>}
            {!["dust", "thermal"].includes(request.profile) && <option value="live">New local-raster evaluation · 9 centres</option>}
            <option value="facilities">NASA documented test facilities</option>
          </select></label>
          {request.mode !== "facilities" && <>
            <label className="block text-xs">Ranking target<select value={request.target} onChange={e => change("target", e.target.value as SearchRequest["target"])} className={inputClass}>
              <option value="jezero">Mars · frozen Jezero morphology</option>
              <option value="terrain">User-defined terrain requirement</option>
            </select></label>
            <p className="text-xs leading-5 text-[var(--text-muted)]">Measurements cover 50 × 50 km at a 1 km grid. P95 is a regional statistic, not a maximum slope or obstacle safety limit. Other planetary targets require additional measured fingerprints.</p>
            <div className="grid grid-cols-2 gap-3">
              {numberInput("minSlopeP95", "Minimum regional P95 slope (°)", 0, 90)}
              {numberInput("maxSlopeP95", "Maximum regional P95 slope (°)", 0, 90)}
              {request.target === "terrain" ? numberInput("desiredSlopeP95", "Preferred regional P95 slope (°)", 0, 90) : numberInput("maxJsd", "Maximum Jezero JSD", 0, 1, 0.01)}
              {numberInput("minLandFraction", "Minimum land fraction (0–1)", 0.9, 1, 0.001)}
            </div>
          </>}
          <fieldset><legend className="text-xs">Search bounds · degrees</legend><div className="mt-2 grid grid-cols-2 gap-3">
            {numberInput("west", "West longitude", -180, 180)}{numberInput("east", "East longitude", -180, 180)}
            {numberInput("south", "South latitude", -90, 90)}{numberInput("north", "North latitude", -90, 90)}
          </div></fieldset>
          {request.mode === "live" && <p className="text-xs text-[var(--warning)]">Bounds must be ≤10° per axis. Requires local SRTMGL30 tiles, MOD44W masks and Python geo dependencies. Each sampled centre uses a 50 km window, which may extend beyond these centre bounds.</p>}
          <fieldset><legend className="text-xs">Additional mandatory evidence</legend><div className="mt-3 space-y-2">
            {Object.entries(evidenceLabels).map(([key, label]) => <label key={key} className="flex items-start gap-2 text-xs leading-5 text-[var(--text-secondary)]"><input type="checkbox" checked={request.requirements.includes(key)} onChange={e => change("requirements", e.target.checked ? [...request.requirements, key] : request.requirements.filter(k => k !== key))} />{label}</label>)}
          </div></fieldset>
          <div className="rounded-sm border border-[var(--warning)]/25 p-3 text-xs leading-5 text-[var(--text-secondary)]">Critical checks: {profiles[request.profile].evidence.map(k => evidenceLabels[k]).join("; ")}. These need test-specific evidence before a site can be qualified.</div>
          <label className="flex gap-2 text-xs leading-5"><input type="checkbox" checked={request.strict} onChange={e => change("strict", e.target.checked)} />Require all critical evidence verified (exclude provisional candidates)</label>
          {numberInput("limit", "Maximum results", 1, 50, 1)}
          <button disabled={busy} className="w-full rounded-sm bg-[var(--earth-primary)] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">{busy ? "Evaluating evidence…" : "Find candidates"}</button>
          {error && <p role="alert" className="break-words text-xs leading-5 text-[var(--critical)]">{error}</p>}
        </form>
        <section aria-live="polite" className="min-w-0">
          {!result && <div className="parallax-panel rounded-sm p-7"><h2 className="text-lg">Available evidence</h2><ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-[var(--text-secondary)]">
            <li>Measured index: 986 Earth windows from the existing scientific pilot. Ranking responds to your criteria.</li>
            <li>Live search: nine new centres evaluated by the Python engine from local raster data.</li>
            <li>Facilities: three NASA centres with documented capabilities. Access, availability and your hardware compatibility remain unverified.</li>
            <li>Unknown evidence is explicit. Strict mode excludes unverified critical requirements.</li>
          </ul></div>}
          {result && <>
            <div className="parallax-panel rounded-sm p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl">{result.request.title}</h2><button onClick={download} className="rounded-sm border border-white/20 px-3 py-2 text-xs">Export experiment + evidence</button></div>
              <p className="mt-3 text-sm text-[var(--earth-bright)]">{result.candidates.length} returned · {result.evaluated} evaluated · {result.rejected} excluded · {result.provisional} requiring verification · {result.errors.length} errors</p>
              <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">{result.provenance.scope}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{result.provenance.ranking}</p>
            </div>
            {!result.candidates.length && <p role="status" className="mt-5 rounded-sm border border-[var(--warning)]/30 p-5 text-sm leading-6">No candidates satisfy this request with the available evidence. Adjust bounds or terrain constraints, or collect critical measurements. Missing evidence is never a pass.</p>}
            {!!markers.length && <div className="mt-5"><DiscoveryMap key={result.runId} candidates={markers} /></div>}
            <div className="mt-5 grid gap-4">{result.candidates.map((c, i) => <article key={c.id} className="parallax-panel rounded-sm p-5">
              <div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{i + 1}. {c.name}</h3><span className="text-xs text-[var(--warning)]">{c.status.replaceAll("-", " ")}</span></div>
              <p className="mt-2 font-mono text-xs text-[var(--earth-bright)]">{c.lat.toFixed(5)}°, {c.lon.toFixed(5)}°</p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs">{c.jsd !== null && <span>Jezero JSD {c.jsd.toFixed(4)}</span>}{c.slopeP95 !== null && <span>Regional P95 slope {c.slopeP95.toFixed(2)}°</span>}{c.landFraction !== null && <span>Land {(c.landFraction * 100).toFixed(2)}%</span>}</div>
              <ul className="mt-3 list-disc pl-5 text-xs leading-6 text-[var(--text-secondary)]">{c.explanation.map(t => <li key={t}>{t}</li>)}</ul>
              <TerrainComparison candidate={c} result={result} />
              <h4 className="mt-4 text-xs text-[var(--warning)]">Evidence still required</h4><ul className="mt-1 list-disc pl-5 text-xs leading-6 text-[var(--text-secondary)]">{c.missingEvidence.map(t => <li key={t}>{t}</li>)}</ul>
              {c.source.startsWith("https://") ? <a className="mt-3 inline-block text-xs underline" href={c.source} target="_blank" rel="noopener noreferrer">NASA capability source</a> : <p className="mt-3 text-xs text-[var(--text-muted)]">{c.source}</p>}
            </article>)}</div>
            {!!result.errors.length && <details className="mt-4 text-xs"><summary>Evaluation errors ({result.errors.length})</summary><ul>{result.errors.map(e => <li key={e.id}>{e.id}: {e.message}</li>)}</ul></details>}
            <details className="mt-4 break-all text-xs leading-5 text-[var(--text-muted)]"><summary>Run provenance</summary><p>{result.provenance.dataset}</p><p>Dataset/output SHA-256 or catalogue version: {result.provenance.version}</p><p>{result.createdAt} · {result.runId}</p></details>
          </>}
          {!!history.length && <div className="mt-6 border-t border-white/10 pt-4"><h2 className="text-sm">Recent experiments · this browser</h2><div className="mt-3 flex flex-wrap gap-2">{history.map(r => <button key={r.runId} onClick={() => { setResult(r); setRequest(r.request); setError(""); }} className="rounded-sm border border-white/15 px-3 py-2 text-xs">{r.request.title} · {r.candidates.length} results</button>)}</div><p className="mt-2 text-xs text-[var(--text-muted)]">Browser-local history. Export reports for durable records.</p></div>}
        </section>
      </div>
    </div>
  </main>;
}
