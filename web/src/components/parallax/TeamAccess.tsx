"use client";
import { useMemo, useSyncExternalStore } from "react";
import { useLang, useT } from "@/lib/i18n";
import { countryName } from "@/lib/places";
import { cleanPassports, notesFor, passportCodes, teamEntry, type AccessData, type EntryKind, type Risk } from "@/lib/access";
import accessData from "../../../data/access.json";

/**
 * The team's nationalities ("who is going"): each site says what entry and permits that
 * team needs. Descriptive only: no site is removed and the order never changes. The
 * choice is kept in this browser so the campaign sheet shows the same team.
 */
export const ACCESS = accessData as unknown as AccessData;
const KEY = "parallax.team.passports";
const EVENT = "parallax-team-passports";

const EMPTY: string[] = [];
let cache: { raw: string | null; list: string[] } = { raw: null, list: EMPTY };
function snapshot(): string[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage is optional */ }
  if (raw === cache.raw) return cache.list;
  let list = EMPTY;
  try { list = cleanPassports(ACCESS, JSON.parse(raw ?? "[]")); } catch { list = EMPTY; }
  cache = { raw, list };
  return list;
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

/** Team nationalities, shared across pages through localStorage (empty when storage is unavailable). */
export function useTeamPassports(): [string[], (p: string[]) => void] {
  const list = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const set = (p: string[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(cleanPassports(ACCESS, p))); } catch { /* storage is optional */ }
    window.dispatchEvent(new Event(EVENT));
  };
  return [list, set];
}

const T = {
  es: {
    h: "Quién va (opcional)", cta: "Añadir las nacionalidades del equipo", ctaHint: "Indica el pasaporte de cada persona del equipo y verás qué visado necesita cada una.",
    advisoryH: "Aviso de viaje", generalH: "A tener en cuenta", teamPassports: (n: number) => n === 1 ? "1 pasaporte" : `${n} pasaportes`,
    lead: "Indica la nacionalidad de cada pasaporte del equipo y cada sitio dirá qué visado y permisos hacen falta. No quita sitios ni cambia el orden.",
    add: "Añadir nacionalidad", pick: "Elige un país…", remove: (c: string) => `Quitar ${c}`, clear: "Quitar todas",
    entry: { self: "nacional", free: "sin visado", eta: "autorización electrónica (ETA)", ev: "visado electrónico", voa: "visado a la llegada", vr: "visado previo en embajada", no: "entrada denegada", unknown: "sin dato" } as Record<EntryKind, string>,
    days: (n: number) => `${n} días`,
    risk: { normal: "Riesgo normal", caution: "Precaución", reconsider: "Reconsiderar el viaje", avoid: "No viajar", unknown: "" } as Record<Risk, string>,
    papers: "Permisos", noTeam: "Pulsa «Añadir las nacionalidades del equipo» para ver el visado de cada pasaporte.",
    h4: "Permisos antes de viajar", entryH: "Entrada, por pasaporte", permitsH: "Permisos para investigar", siteH: "En este sitio", regionH: "En esta región", teamH: "Para vuestros pasaportes",
    check: "verificar: el país cambió sus normas", corrected: "dato corregido",
    hits: (p: string) => `Afecta a vuestro equipo (${p}).`,
    notResearched: "Este país no está en la investigación de Parallax (solo cubre los países de los gemelos). Consulta los avisos de viaje de tu país.",
    tourist: "Visado de turista: investigar en el terreno suele necesitar otro visado o permiso.",
    sources: "Fuentes", dataset: (d: string) => `Entrada por pasaporte: Passport Index (abierto, MIT), datos del ${d}, con correcciones documentadas. Investigado el`,
  },
  en: {
    h: "Who is going? (optional)", cta: "Add the team's nationalities", ctaHint: "Add each team member's passport and you will see which visa each one needs.",
    advisoryH: "Travel advisory", generalH: "Keep in mind", teamPassports: (n: number) => n === 1 ? "1 passport" : `${n} passports`,
    lead: "Add the nationality of each passport in the team and each site says which visa and permits are needed. It removes no site and never changes the order.",
    add: "Add nationality", pick: "Pick a country…", remove: (c: string) => `Remove ${c}`, clear: "Clear all",
    entry: { self: "national", free: "visa-free", eta: "electronic authorisation (ETA)", ev: "e-visa", voa: "visa on arrival", vr: "visa from an embassy beforehand", no: "entry refused", unknown: "no data" } as Record<EntryKind, string>,
    days: (n: number) => `${n} days`,
    risk: { normal: "Normal risk", caution: "Caution", reconsider: "Reconsider travel", avoid: "Do not travel", unknown: "" } as Record<Risk, string>,
    papers: "Permits", noTeam: "Press “Add the team's nationalities” to see the visa for each passport.",
    h4: "Permits before you travel", entryH: "Entry, by passport", permitsH: "Permits to do research", siteH: "At this site", regionH: "In this region", teamH: "For your passports",
    check: "check: the country changed its rules", corrected: "corrected value",
    hits: (p: string) => `Affects your team (${p}).`,
    notResearched: "This country is not in Parallax's research (it covers only the twins' countries). Check your country's travel advice.",
    tourist: "Tourist entry: fieldwork usually needs another visa or a permit.",
    sources: "Sources", dataset: (d: string) => `Entry by passport: Passport Index (open, MIT), data of ${d}, with documented corrections. Researched on`,
  },
};

const RISK_CHIP: Record<Risk, string> = { normal: "wb-chip--good", caution: "wb-chip--mid", reconsider: "wb-chip--bad", avoid: "wb-chip--bad", unknown: "" };
const ENTRY_TONE = (k: EntryKind) => k === "self" || k === "free" || k === "eta" ? "wb-fit-good" : k === "ev" || k === "voa" ? "" : "wb-fit-bad";

const noop = () => () => {};
/** True only in the browser: country names come from Intl, whose data differs between server and browser. */
const useClient = () => useSyncExternalStore(noop, () => true, () => false);

export function NationalityForm({ passports, onChange, sheet = false }: { passports: string[]; onChange: (p: string[]) => void; sheet?: boolean }) {
  const t = useT(T);
  const { lang } = useLang();
  const client = useClient();
  const options = useMemo(() => !client ? [] : passportCodes(ACCESS).map(c => ({ c, name: countryName(c, lang) })).sort((a, b) => a.name.localeCompare(b.name, lang)), [lang, client]);
  if (sheet) return <div className="flex flex-wrap items-center gap-2 rounded border border-[#ccc] p-2 text-[12.5px] text-[#222]">
    <label className="flex items-center gap-2">{t.add}
      <select className="h-8 rounded border border-[#bbb] bg-white px-2 text-[#111]" value="" onChange={e => { if (e.target.value) onChange([...passports, e.target.value]); }}>
        <option value="">{t.pick}</option>
        {options.filter(o => !passports.includes(o.c)).map(o => <option key={o.c} value={o.c}>{o.name}</option>)}
      </select>
    </label>
    {passports.map(p => <button key={p} type="button" className="rounded-full border border-[#888] px-2 py-0.5" onClick={() => onChange(passports.filter(x => x !== p))} aria-label={t.remove(countryName(p, lang))}>{countryName(p, lang)} ×</button>)}
  </div>;
  return <details className="wb-team" open={passports.length > 0}>
    <summary>
      <span className="wb-team-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><path d="M17 8v6M14 11h6" /></svg></span>
      <span className="wb-team-text"><strong>{passports.length ? `${t.h.replace(/ \(.*\)$/, "")}: ${passports.map(p => countryName(p, lang)).join(", ")}` : t.cta}</strong><span className="wb-help">{passports.length ? t.teamPassports(passports.length) : t.ctaHint}</span></span>
      <span className="wb-team-chev" aria-hidden="true">▾</span>
    </summary>
    <div className="wb-plan-body">
      <p className="wb-help">{t.lead}</p>
      <label className="wb-field">{t.add}
        <select className="wb-input" value="" onChange={e => { if (e.target.value) onChange([...passports, e.target.value]); }}>
          <option value="">{t.pick}</option>
          {options.filter(o => !passports.includes(o.c)).map(o => <option key={o.c} value={o.c}>{o.name}</option>)}
        </select>
      </label>
      {passports.length > 0 && <ul className="flex flex-wrap gap-2" aria-label={t.h}>
        {passports.map(p => <li key={p}><button type="button" className="wb-chip wb-chip--info" onClick={() => onChange(passports.filter(x => x !== p))} aria-label={t.remove(countryName(p, lang))}>{countryName(p, lang)} ×</button></li>)}
        <li><button type="button" className="wb-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => onChange([])}>{t.clear}</button></li>
      </ul>}
    </div>
  </details>;
}

function entryText(t: typeof T.es, kind: EntryKind, days?: number) {
  return kind === "free" && days ? `${t.entry.free} (${t.days(days)})` : t.entry[kind];
}

/** One line for a result card: the risk, and each passport's entry grouped. */
export function AccessLine({ cc, admin1, siteId, passports }: { cc: string; admin1?: string | null; siteId?: string | null; passports: string[] }) {
  const t = useT(T);
  const { lang } = useLang();
  const n = notesFor(ACCESS, cc, siteId, passports, lang, admin1);
  if (!passports.length && (n.risk === "unknown" || n.risk === "normal")) return null;
  const team = passports.length ? teamEntry(ACCESS, passports, cc) : null;
  return <p className="wb-fit">
    {n.risk !== "unknown" && n.risk !== "normal" && <><span className={`wb-chip ${RISK_CHIP[n.risk]}`}>{t.risk[n.risk]}</span> </>}
    {team && <><span className="wb-help">{t.papers}</span> · {team.groups.map(g => `${entryText(t, g.kind, g.days)}: ${g.passports.join(", ")}`).join(" · ")}</>}
  </p>;
}

/** The full section for a site: entry by passport, permits, site note, team notes and sources. */
type Tone = "ok" | "info" | "warn" | "stop";
const toneOf = (r: Risk): Tone => r === "avoid" ? "stop" : r === "reconsider" || r === "caution" ? "warn" : r === "normal" ? "ok" : "info";
const ICON: Record<Tone, string> = {
  ok: "M5 12.5l4.5 4.5L19 7.5",
  info: "M12 11v6M12 7.5v.5",
  warn: "M12 9v4.5M12 16.5v.5",
  stop: "M8 8l8 8M16 8l-8 8",
};
/** One boxed note with an icon that says how careful to be. */
function Callout({ tone, title, children }: { tone: Tone; title: string; children: React.ReactNode }) {
  return <div className={`wb-callout wb-callout--${tone}`}>
    <span className="wb-callout-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {tone === "warn" ? <path d="M12 3.5l9.5 16.5h-19z" /> : <circle cx="12" cy="12" r="9.5" />}<path d={ICON[tone]} /></svg></span>
    <div className="wb-callout-body"><p className="wb-callout-title">{title}</p>{children}</div>
  </div>;
}

function AccessCallouts({ n, team, cc, bare }: { n: ReturnType<typeof notesFor>; team: ReturnType<typeof teamEntry> | null; cc: string; bare: boolean }) {
  const t = useT(T);
  const { lang } = useLang();
  const hardest = team?.hardest;
  const entryTone: Tone = !team ? "info" : hardest === "no" ? "stop" : hardest === "self" || hardest === "free" || hardest === "eta" ? "ok" : "warn";
  const regionTone = toneOf(n.regionLevel !== "unknown" ? n.regionLevel : n.risk);
  const siteTone: Tone = n.siteHitsTeam.length ? "stop" : n.siteLevel !== "unknown" ? toneOf(n.siteLevel) : toneOf(n.risk);
  return <section aria-label={t.h4} className="wb-callouts">
    {!bare && <h4 className="wb-section-title" style={{ fontSize: "var(--text-sm)" }}>{t.h4} · {countryName(cc, lang)} {n.risk !== "unknown" && <span className={`wb-chip ${RISK_CHIP[n.risk]}`}>{t.risk[n.risk]}</span>}</h4>}
    {n.risk !== "unknown" && <Callout tone={toneOf(n.risk)} title={`${t.advisoryH}: ${t.risk[n.risk]}`}>{n.advisory && <p>{n.advisory}</p>}</Callout>}
    {n.region && n.region !== n.site && <Callout tone={regionTone} title={t.regionH}><p>{n.region}</p></Callout>}
    {n.site && <Callout tone={siteTone} title={t.siteH}><p>{n.site}{n.siteHitsTeam.length > 0 && <b> {t.hits(n.siteHitsTeam.join(", "))}</b>}</p></Callout>}
    <Callout tone={entryTone} title={t.entryH}>
      {team ? <ul className="wb-list">{team.byPassport.map(({ passport, entry: e }) => <li key={passport}>
        {countryName(passport, lang)}: <span className={ENTRY_TONE(e.kind)}>{entryText(t, e.kind, e.days)}</span>
        {e.corrected && <span className="wb-help"> · {t.corrected}</span>}{e.check && <span className="wb-help"> · {t.check}</span>}
      </li>)}</ul> : <p>{t.noTeam}</p>}
      {n.correction && <p className="wb-help">{n.correction}</p>}
      <p className="wb-help">{t.tourist}</p>
    </Callout>
    {n.forTeam.length > 0 && <Callout tone="warn" title={t.teamH}><ul className="wb-list">{n.forTeam.map(x => <li key={x.passport}>{countryName(x.passport, lang)}: {x.text}</li>)}</ul></Callout>}
    {(n.permits.length > 0 || !n.researched) && <Callout tone={n.researched ? "warn" : "info"} title={t.permitsH}>
      {n.researched ? <ul className="wb-list">{n.permits.map(p => <li key={p}>{p}</li>)}</ul> : <p>{t.notResearched}</p>}
    </Callout>}
    <Callout tone="info" title={t.generalH}><ul className="wb-list">{ACCESS.general[lang].map(g => <li key={g}>{g}</li>)}</ul></Callout>
    {n.sources.length > 0 && <details className="wb-disclose"><summary>{t.sources}</summary>
      <ul className="wb-help">{n.sources.map(s => <li key={s.url}><a className="wb-link" href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>
    </details>}
    <p className="wb-help">{t.dataset(ACCESS.passportIndex.commit_date)} {ACCESS.researchedOn}.</p>
  </section>;
}

export function AccessDetail({ cc, admin1, siteId, passports, print = false, bare = false }: { cc: string; admin1?: string | null; siteId?: string | null; passports: string[]; print?: boolean; bare?: boolean }) {
  const t = useT(T);
  const { lang } = useLang();
  const n = notesFor(ACCESS, cc, siteId, passports, lang, admin1);
  const team = passports.length ? teamEntry(ACCESS, passports, cc) : null;
  const hTag = print ? "font-semibold text-[#111] mt-2" : "wb-fit font-semibold";
  if (!print) return <AccessCallouts n={n} team={team} cc={cc} bare={bare} />;
  return <section aria-label={t.h4} className={print ? "text-[12.5px] leading-5" : "grid gap-2"}>
    {!print && !bare && <h4 className="wb-section-title" style={{ fontSize: "var(--text-sm)" }}>{t.h4} · {countryName(cc, lang)} {n.risk !== "unknown" && <span className={`wb-chip ${RISK_CHIP[n.risk]}`}>{t.risk[n.risk]}</span>}</h4>}
    {print && n.risk !== "unknown" && <p className={n.risk === "normal" ? "text-[#111]" : "font-semibold text-[#b23a3a]"}>{t.risk[n.risk]}{n.advisory ? ` · ${n.advisory}` : ""}</p>}
    {!print && n.advisory && <p className="wb-help">{n.advisory}</p>}
    {n.region && n.region !== n.site && <div><p className={hTag}>{t.regionH}</p><p>{n.region}</p></div>}
    {n.site && <div><p className={hTag}>{t.siteH}</p><p>{n.site}{n.siteHitsTeam.length > 0 && <b> {t.hits(n.siteHitsTeam.join(", "))}</b>}</p></div>}
    <div><p className={hTag}>{t.entryH}</p>
      {team ? <ul className={print ? "" : "wb-list"}>{team.byPassport.map(({ passport, entry: e }) => <li key={passport}>
        {countryName(passport, lang)}: <span className={print ? "" : ENTRY_TONE(e.kind)}>{entryText(t, e.kind, e.days)}</span>
        {e.corrected && <span className="wb-help"> · {t.corrected}</span>}{e.check && <span className="wb-help"> · {t.check}</span>}
      </li>)}</ul> : <p className="wb-help">{t.noTeam}</p>}
      {n.correction && <p className="wb-help">{n.correction}</p>}
      <p className="wb-help">{t.tourist}</p>
    </div>
    {n.forTeam.length > 0 && <div><p className={hTag}>{t.teamH}</p><ul className={print ? "" : "wb-list"}>{n.forTeam.map(x => <li key={x.passport}>{countryName(x.passport, lang)}: {x.text}</li>)}</ul></div>}
    {(n.permits.length > 0 || !n.researched) && <div><p className={hTag}>{t.permitsH}</p>
      {n.researched ? <ul className={print ? "" : "wb-list"}>{n.permits.map(p => <li key={p}>{p}</li>)}</ul> : <p className="wb-help">{t.notResearched}</p>}
    </div>}
    <ul className={print ? "text-[11px] text-[#555]" : "wb-help"}>{ACCESS.general[lang].map(g => <li key={g}>{g}</li>)}</ul>
    {n.sources.length > 0 && <details className={print ? "" : "wb-disclose"} open={print}><summary>{t.sources}</summary>
      <ul className={print ? "text-[10.5px] text-[#555]" : "wb-help"}>{n.sources.map(s => <li key={s.url}><a className={print ? "break-all" : "wb-link"} href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>
    </details>}
    <p className={print ? "text-[10.5px] text-[#777]" : "wb-help"}>{t.dataset(ACCESS.passportIndex.commit_date)} {ACCESS.researchedOn}.</p>
  </section>;
}

/** Compact block for a twin card: risk, each passport's entry, and the region or site note. */
export function AccessBrief({ cc, admin1, siteId, passports }: { cc: string; admin1?: string | null; siteId?: string | null; passports: string[] }) {
  const t = useT(T);
  const { lang } = useLang();
  const n = notesFor(ACCESS, cc, siteId, passports, lang, admin1);
  const team = passports.length ? teamEntry(ACCESS, passports, cc) : null;
  const note = n.site ?? n.region;
  return <div className="grid gap-1 text-sm">
    {n.risk !== "unknown" && <p><span className={`wb-chip ${RISK_CHIP[n.risk]}`}>{t.risk[n.risk]}</span>{n.advisory && <span className="wb-help"> {n.advisory}</span>}</p>}
    {team ? <p>{team.groups.map(g => `${entryText(t, g.kind, g.days)}: ${g.passports.map(p => countryName(p, lang)).join(", ")}`).join(" · ")}</p> : <p className="wb-help">{t.noTeam}</p>}
    {note && <p className="wb-help">{note}{n.siteHitsTeam.length > 0 && <b> {t.hits(n.siteHitsTeam.join(", "))}</b>}</p>}
    {!n.researched && <p className="wb-help">{t.notResearched}</p>}
  </div>;
}
