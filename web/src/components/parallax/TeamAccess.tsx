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
    h: "Quién va (opcional)",
    lead: "Indica la nacionalidad de cada pasaporte del equipo y cada sitio dirá qué visado y permisos hacen falta. No quita sitios ni cambia el orden.",
    add: "Añadir nacionalidad", pick: "Elige un país…", remove: (c: string) => `Quitar ${c}`, clear: "Quitar todas",
    entry: { self: "nacional", free: "sin visado", eta: "autorización electrónica (ETA)", ev: "visado electrónico", voa: "visado a la llegada", vr: "visado previo en embajada", no: "entrada denegada", unknown: "sin dato" } as Record<EntryKind, string>,
    days: (n: number) => `${n} días`,
    risk: { normal: "Riesgo normal", caution: "Precaución", reconsider: "Reconsiderar el viaje", avoid: "No viajar", unknown: "" } as Record<Risk, string>,
    papers: "Papeles", noTeam: "Añade las nacionalidades del equipo en «Quién va» para ver el visado de cada una.",
    h4: "Papeles y permisos", entryH: "Entrada, por pasaporte", permitsH: "Permisos para investigar", siteH: "En este sitio", regionH: "En esta región", teamH: "Para vuestros pasaportes",
    check: "verificar: el país cambió sus normas", corrected: "dato corregido",
    hits: (p: string) => `Afecta a vuestro equipo (${p}).`,
    notResearched: "Este país no está en la investigación de Parallax (solo cubre los países de los gemelos). Consulta los avisos de viaje de tu país.",
    tourist: "Visado de turista: investigar en el terreno suele necesitar otro visado o permiso.",
    sources: "Fuentes", dataset: (d: string) => `Entrada por pasaporte: Passport Index (abierto, MIT), datos del ${d}, con correcciones documentadas. Investigado el`,
  },
  en: {
    h: "Who is going? (optional)",
    lead: "Add the nationality of each passport in the team and each site says which visa and permits are needed. It removes no site and never changes the order.",
    add: "Add nationality", pick: "Pick a country…", remove: (c: string) => `Remove ${c}`, clear: "Clear all",
    entry: { self: "national", free: "visa-free", eta: "electronic authorisation (ETA)", ev: "e-visa", voa: "visa on arrival", vr: "visa from an embassy beforehand", no: "entry refused", unknown: "no data" } as Record<EntryKind, string>,
    days: (n: number) => `${n} days`,
    risk: { normal: "Normal risk", caution: "Caution", reconsider: "Reconsider travel", avoid: "Do not travel", unknown: "" } as Record<Risk, string>,
    papers: "Papers", noTeam: "Add the team's nationalities in “Who is going?” to see each one's visa.",
    h4: "Papers and permits", entryH: "Entry, by passport", permitsH: "Permits to do research", siteH: "At this site", regionH: "In this region", teamH: "For your passports",
    check: "check: the country changed its rules", corrected: "corrected value",
    hits: (p: string) => `Affects your team (${p}).`,
    notResearched: "This country is not in Parallax's research (it covers only the twins' countries). Check your country's travel advice.",
    tourist: "Tourist entry: fieldwork usually needs another visa or a permit.",
    sources: "Sources", dataset: (d: string) => `Entry by passport: Passport Index (open, MIT), data of ${d}, with documented corrections. Researched on`,
  },
};

const RISK_CHIP: Record<Risk, string> = { normal: "wb-chip--good", caution: "wb-chip--mid", reconsider: "wb-chip--bad", avoid: "wb-chip--bad", unknown: "" };
const ENTRY_TONE = (k: EntryKind) => k === "self" || k === "free" || k === "eta" ? "wb-fit-good" : k === "ev" || k === "voa" ? "" : "wb-fit-bad";

export function NationalityForm({ passports, onChange, sheet = false }: { passports: string[]; onChange: (p: string[]) => void; sheet?: boolean }) {
  const t = useT(T);
  const { lang } = useLang();
  const options = useMemo(() => passportCodes(ACCESS).map(c => ({ c, name: countryName(c, lang) })).sort((a, b) => a.name.localeCompare(b.name, lang)), [lang]);
  if (sheet) return <div className="flex flex-wrap items-center gap-2 rounded border border-[#ccc] p-2 text-[12.5px] text-[#222]">
    <label className="flex items-center gap-2">{t.add}
      <select className="h-8 rounded border border-[#bbb] bg-white px-2 text-[#111]" value="" onChange={e => { if (e.target.value) onChange([...passports, e.target.value]); }}>
        <option value="">{t.pick}</option>
        {options.filter(o => !passports.includes(o.c)).map(o => <option key={o.c} value={o.c}>{o.name}</option>)}
      </select>
    </label>
    {passports.map(p => <button key={p} type="button" className="rounded-full border border-[#888] px-2 py-0.5" onClick={() => onChange(passports.filter(x => x !== p))} aria-label={t.remove(countryName(p, lang))}>{countryName(p, lang)} ×</button>)}
  </div>;
  return <details className="wb-advanced wb-plan" open={passports.length > 0}>
    <summary>{t.h}{passports.length > 0 && <span className="wb-help"> · {passports.map(p => countryName(p, lang)).join(", ")}</span>}</summary>
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
export function AccessDetail({ cc, admin1, siteId, passports, print = false }: { cc: string; admin1?: string | null; siteId?: string | null; passports: string[]; print?: boolean }) {
  const t = useT(T);
  const { lang } = useLang();
  const n = notesFor(ACCESS, cc, siteId, passports, lang, admin1);
  const team = passports.length ? teamEntry(ACCESS, passports, cc) : null;
  const hTag = print ? "font-semibold text-[#111] mt-2" : "wb-section-title";
  return <section aria-label={t.h4} className={print ? "text-[12.5px] leading-5" : "grid gap-2"}>
    {!print && <h4 className="wb-section-title" style={{ fontSize: "var(--text-sm)" }}>{t.h4} · {countryName(cc, lang)} {n.risk !== "unknown" && <span className={`wb-chip ${RISK_CHIP[n.risk]}`}>{t.risk[n.risk]}</span>}</h4>}
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
