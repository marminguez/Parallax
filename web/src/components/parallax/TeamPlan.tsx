"use client";
import { useLang, useT } from "@/lib/i18n";
import { monthName, planFit, RULE_FROZEN, RULE_GENERAL, ruleKind, type Plan, type TeamRule } from "@/lib/testWindow";
import { useWindowData } from "./TestWindow";

/**
 * The team's own dates and rule ("we want to go from June to August"): each site says how
 * many of those months meet the rule. The two registered rules are presets; changing any
 * value makes it the team's rule, and every line says so. Descriptive only: no site is
 * removed and the order never changes.
 */
const T = {
  es: {
    h: "Cuándo vais (opcional)",
    lead: "Elige tus meses y cada sitio dirá cuántos cumplen la regla. No quita sitios ni cambia el orden.",
    from: "Desde", to: "Hasta", none: "Sin fechas",
    rule: "Regla para cada mes", general: "Trabajo al aire libre (regla registrada)", frozen: "Suelo helado (regla registrada)", team: "Regla del equipo",
    minC: "Mínima de al menos (°C)", maxC: "Máxima de como mucho (°C)", rainMax: "Lluvia de como mucho (mm/día)", groundFrozen: "El suelo tiene que estar helado (0 °C o menos)",
    teamNote: "Regla del equipo, no la registrada: Parallax la aplica tal cual, sin validarla.",
    clear: "Quitar fechas",
    line: (a: string, b: string, ok: number, n: number) => `${a}–${b}: ${ok} de ${n} ${n === 1 ? "mes cumple" : "meses cumplen"}`,
    lineOne: (a: string, ok: number) => `${a}: ${ok ? "cumple" : "no cumple"}`,
    okMonths: (m: string) => ` (${m})`,
    loading: "Comprobando tus fechas…", error: "NASA POWER no responde ahora.",
    tableH: (a: string, b: string) => `Tus fechas, ${a}–${b}`,
    cols: ["Mes", "Mín. °C", "Máx. °C", "Lluvia mm/día", "Suelo °C", ""],
    fails: { cold: "frío", hot: "calor", rain: "lluvia", notFrozen: "suelo sin helar" } as Record<string, string>,
    missing: "sin dato",
    days: (d: number) => `Unos ${d} días útiles en esas fechas.`,
    ruleText: (r: TeamRule) => [r.minC !== null ? `mínima ≥ ${r.minC} °C` : null, r.maxC !== null ? `máxima ≤ ${r.maxC} °C` : null, r.rainMax !== null ? `lluvia ≤ ${r.rainMax} mm/día` : null, r.groundFrozen ? "suelo a 0 °C o menos" : null].filter(Boolean).join(", "),
    climate: "Clima medio de NASA POWER en el centro del sitio, no una previsión.",
  },
  en: {
    h: "When are you going? (optional)",
    lead: "Pick your months and each site says how many meet the rule. It removes no site and never changes the order.",
    from: "From", to: "To", none: "No dates",
    rule: "Rule for each month", general: "Outdoor work (registered rule)", frozen: "Frozen ground (registered rule)", team: "Team rule",
    minC: "Minimum of at least (°C)", maxC: "Maximum of at most (°C)", rainMax: "Rain of at most (mm/day)", groundFrozen: "The ground must be frozen (0 °C or below)",
    teamNote: "The team's rule, not the registered one: Parallax applies it as given, without validating it.",
    clear: "Clear dates",
    line: (a: string, b: string, ok: number, n: number) => `${a}–${b}: ${ok} of ${n} ${n === 1 ? "month meets" : "months meet"}`,
    lineOne: (a: string, ok: number) => `${a}: ${ok ? "meets" : "does not meet"}`,
    okMonths: (m: string) => ` (${m})`,
    loading: "Checking your dates…", error: "NASA POWER is not responding now.",
    tableH: (a: string, b: string) => `Your dates, ${a}–${b}`,
    cols: ["Month", "Min °C", "Max °C", "Rain mm/day", "Ground °C", ""],
    fails: { cold: "cold", hot: "heat", rain: "rain", notFrozen: "ground not frozen" } as Record<string, string>,
    missing: "no data",
    days: (d: number) => `About ${d} usable days in those dates.`,
    ruleText: (r: TeamRule) => [r.minC !== null ? `minimum ≥ ${r.minC} °C` : null, r.maxC !== null ? `maximum ≤ ${r.maxC} °C` : null, r.rainMax !== null ? `rain ≤ ${r.rainMax} mm/day` : null, r.groundFrozen ? "ground at 0 °C or below" : null].filter(Boolean).join(", "),
    climate: "NASA POWER average climate at the site's centre, not a forecast.",
  },
};

const numOrNull = (v: string) => v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v);

export function PlanForm({ plan, onChange, isru }: { plan: Plan | null; onChange: (p: Plan | null) => void; isru: boolean }) {
  const t = useT(T);
  const { lang } = useLang();
  const kind = plan ? ruleKind(plan.rule) : (isru ? "frozen" : "general");
  const months = Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{monthName(i, lang)}</option>);
  const set = (p: Partial<Plan>) => onChange({ from: plan?.from ?? 5, to: plan?.to ?? 7, rule: plan?.rule ?? (isru ? RULE_FROZEN : RULE_GENERAL), ...p });
  const setRule = (r: Partial<TeamRule>) => set({ rule: { ...(plan?.rule ?? RULE_GENERAL), ...r } });
  return <details className="wb-advanced wb-plan" open={!!plan}>
    <summary>{t.h}{plan && <span className="wb-help"> · {monthName(plan.from, lang)}–{monthName(plan.to, lang)}</span>}</summary>
    <div className="wb-plan-body">
      <p className="wb-help">{t.lead}</p>
      <div className="wb-pair">
        <label className="wb-field">{t.from}<select className="wb-input" value={plan?.from ?? ""} onChange={e => e.target.value === "" ? onChange(null) : set({ from: Number(e.target.value) })}><option value="">{t.none}</option>{months}</select></label>
        <label className="wb-field">{t.to}<select className="wb-input" value={plan?.to ?? ""} onChange={e => e.target.value === "" ? onChange(null) : set({ to: Number(e.target.value) })}><option value="">{t.none}</option>{months}</select></label>
      </div>
      {plan && <>
        <label className="wb-field">{t.rule}<select className="wb-input" value={kind} onChange={e => setRule(e.target.value === "frozen" ? RULE_FROZEN : e.target.value === "general" ? RULE_GENERAL : { ...plan.rule, maxC: plan.rule.maxC ?? 35 })}>
          <option value="general">{t.general}</option><option value="frozen">{t.frozen}</option>{kind === "team" && <option value="team">{t.team}</option>}
        </select></label>
        <div className="wb-pair">
          <label className="wb-field">{t.minC}<input className="wb-input" type="number" step="1" value={plan.rule.minC ?? ""} onChange={e => setRule({ minC: numOrNull(e.target.value) })} /></label>
          <label className="wb-field">{t.maxC}<input className="wb-input" type="number" step="1" value={plan.rule.maxC ?? ""} onChange={e => setRule({ maxC: numOrNull(e.target.value) })} /></label>
          <label className="wb-field">{t.rainMax}<input className="wb-input" type="number" step="0.5" min="0" value={plan.rule.rainMax ?? ""} onChange={e => setRule({ rainMax: numOrNull(e.target.value) })} /></label>
        </div>
        <label className="wb-check"><input type="checkbox" checked={plan.rule.groundFrozen} onChange={e => setRule({ groundFrozen: e.target.checked })} /> {t.groundFrozen}</label>
        {kind === "team" && <p className="wb-note">{t.teamNote}</p>}
        <button type="button" className="wb-btn" style={{ justifySelf: "start" }} onClick={() => onChange(null)}>{t.clear}</button>
      </>}
    </div>
  </details>;
}

function usePlanFit(lat: number, lon: number, plan: Plan) {
  const { data, error } = useWindowData(lat, lon);
  return { fit: data ? planFit(data.monthly, plan) : null, monthly: data?.monthly ?? null, error };
}

/** One line for a result card: "jun–ago: 1 of 3 months meet (jun)". */
export function PlanLine({ lat, lon, plan }: { lat: number; lon: number; plan: Plan }) {
  const t = useT(T);
  const { lang } = useLang();
  const { fit, error } = usePlanFit(lat, lon, plan);
  if (error) return <p className="wb-help">{t.error}</p>;
  if (!fit) return <p className="wb-help" role="status">{t.loading}</p>;
  const a = monthName(plan.from, lang), b = monthName(plan.to, lang);
  const ok = fit.months.filter(m => m.ok).map(m => monthName(m.month, lang));
  const cls = fit.verdict === "all" ? "wb-chip--good" : fit.verdict === "some" ? "wb-chip--mid" : "wb-chip--bad";
  return <p className="wb-fit"><span className={`wb-chip ${cls}`}>{fit.total === 1 ? t.lineOne(a, fit.okCount) : t.line(a, b, fit.okCount, fit.total)}</span>{fit.verdict === "some" && <span className="wb-help">{t.okMonths(ok.join(", "))}</span>}{ruleKind(plan.rule) === "team" && <span className="wb-help"> · {t.team}</span>}</p>;
}

/** Month-by-month table for the site sheet. */
export function PlanDetail({ lat, lon, plan }: { lat: number; lon: number; plan: Plan }) {
  const t = useT(T);
  const { lang } = useLang();
  const { fit, monthly, error } = usePlanFit(lat, lon, plan);
  if (error) return <p className="wb-help">{t.error}</p>;
  if (!fit || !monthly) return <p className="wb-help" role="status">{t.loading}</p>;
  const n = (x: number) => x <= -900 ? "—" : x.toLocaleString(lang, { maximumFractionDigits: 1 });
  const kind = ruleKind(plan.rule);
  return <section className="wb-window" aria-label={t.tableH(monthName(plan.from, lang), monthName(plan.to, lang))}>
    <p><strong>{t.tableH(monthName(plan.from, lang), monthName(plan.to, lang))}</strong> · {kind === "general" ? t.general : kind === "frozen" ? t.frozen : t.team}</p>
    <div className="wb-tablewrap"><table className="wb-table">
      <thead><tr>{t.cols.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead>
      <tbody>{fit.months.map(m => <tr key={m.month}>
        <td>{monthName(m.month, lang)}</td><td className="num">{n(monthly.T2M_MIN[m.month])}</td><td className="num">{n(monthly.T2M_MAX[m.month])}</td>
        <td className="num">{n(monthly.PRECTOTCORR[m.month])}</td><td className="num">{n(monthly.TS[m.month])}</td>
        <td>{m.ok ? <span className="wb-chip wb-chip--good">✓</span> : <span className="wb-chip wb-chip--bad">{m.missing ? t.missing : m.fails.map(f => t.fails[f]).join(", ")}</span>}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="wb-help">{t.days(fit.okDays)} {t.ruleText(plan.rule)}. {kind === "team" ? t.teamNote : ""} {t.climate}</p>
  </section>;
}
