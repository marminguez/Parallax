"use client";
import { useState } from "react";
import { useLang, useT } from "@/lib/i18n";
import { draftProblems, record, remove, statusFor, todayIso, type Verification, type VerificationDraft } from "@/lib/verification";

export const VERIFY_T = {
  es: {
    mark: "Marcar como verificada", by: "Quién lo comprobó", byHint: "Persona u organización",
    date: "Fecha de la comprobación", source: "Fuente", sourceHint: "N.º de permiso, documento, enlace o contacto",
    note: "Nota (opcional)", save: "Guardar verificación", cancel: "Cancelar", undo: "Deshacer",
    verified: (by: string, date: string) => `Verificado por ${by} · ${date}`,
    problems: { by: "Indica quién lo comprobó.", date: "La fecha no es válida.", future: "La fecha no puede ser futura.", source: "Indica la fuente.", long: "Algún campo es demasiado largo." } as Record<string, string>,
    declared: "Verificación declarada por el equipo, no certificada por Parallax. No cambia el orden de los candidatos.",
    storage: "Se guarda en este navegador y viaja en el JSON exportado.",
    badgeDone: "verificado por el equipo", badgePartial: (n: number, total: number) => `requiere verificación · ${n} de ${total}`,
    headingDone: "Evidencia verificada por el equipo",
    onlyVerified: (n: number) => `Mostrar solo los verificados por el equipo (${n})`,
  },
  en: {
    mark: "Mark as verified", by: "Who checked it", byHint: "Person or organisation",
    date: "Date of the check", source: "Source", sourceHint: "Permit number, document, link or contact",
    note: "Note (optional)", save: "Save verification", cancel: "Cancel", undo: "Undo",
    verified: (by: string, date: string) => `Verified by ${by} · ${date}`,
    problems: { by: "Say who checked it.", date: "The date is not valid.", future: "The date cannot be in the future.", source: "Give the source.", long: "A field is too long." } as Record<string, string>,
    declared: "Declared by the team, not certified by Parallax. It does not change the order of the candidates.",
    storage: "Kept in this browser and included in the exported JSON.",
    badgeDone: "verified by the team", badgePartial: (n: number, total: number) => `verification required · ${n} of ${total}`,
    headingDone: "Evidence verified by the team",
    onlyVerified: (n: number) => `Show only those verified by the team (${n})`,
  },
};

const field = "mt-1 w-full rounded-sm border border-white/15 bg-[#11171e] px-2.5 py-1.5 text-xs text-white";

function formatDate(iso: string, lang: string) {
  const d = new Date(iso + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(lang === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function VerificationList({ candidateId, keys, labels, log, onChange }: {
  candidateId: string; keys: string[]; labels: Record<string, string>; log: Verification[]; onChange: (next: Verification[]) => void;
}) {
  const t = useT(VERIFY_T);
  const { lang } = useLang();
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<VerificationDraft>({ by: "", date: todayIso(), source: "", note: "" });
  const [problems, setProblems] = useState<string[]>([]);
  const status = statusFor(log, candidateId, keys);

  function start(key: string) {
    const last = [...log].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
    setDraft({ by: last?.by ?? "", date: todayIso(), source: "", note: "" }); // the same person usually records several checks
    setProblems([]); setOpen(key);
  }
  function save(key: string) {
    const p = draftProblems(draft);
    if (p.length) { setProblems(p); return; }
    onChange(record(log, candidateId, key, draft)); setOpen(null);
  }

  return <div className="mt-1">
    <ul className="grid gap-2 text-xs leading-5">
      {keys.map(key => {
        const v = status.verified.find(x => x.evidence === key);
        const id = `${candidateId}-${key}`;
        return <li key={key} className={`rounded-sm border px-3 py-2 ${v ? "border-[#5fbf86]/35 bg-[#5fbf86]/[0.06]" : "border-white/10"}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className={v ? "text-[#9fe0b8]" : "text-[var(--text-secondary)]"}>{v ? "✓ " : ""}{labels[key] ?? key}</span>
            {v ? <button type="button" onClick={() => onChange(remove(log, candidateId, key))} className="text-[var(--text-muted)] underline-offset-4 hover:text-white hover:underline">{t.undo}</button>
              : open !== key && <button type="button" onClick={() => start(key)} className="rounded-sm border border-white/20 px-2.5 py-1 hover:border-white/50">{t.mark}</button>}
          </div>
          {v && <div className="mt-1 text-[var(--text-secondary)]">
            <p>{t.verified(v.by, formatDate(v.date, lang))}</p>
            <p className="break-words text-[var(--text-muted)]">{t.source}: {v.source}</p>
            {v.note && <p className="break-words text-[var(--text-muted)]">{v.note}</p>}
          </div>}
          {open === key && <form className="mt-2 grid gap-2 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); save(key); }}>
            <label htmlFor={`${id}-by`} className="text-[var(--text-secondary)]">{t.by}<input id={`${id}-by`} value={draft.by} maxLength={120} placeholder={t.byHint} onChange={e => setDraft({ ...draft, by: e.target.value })} className={field} /></label>
            <label htmlFor={`${id}-date`} className="text-[var(--text-secondary)]">{t.date}<input id={`${id}-date`} type="date" value={draft.date} max={todayIso()} onChange={e => setDraft({ ...draft, date: e.target.value })} className={field} /></label>
            <label htmlFor={`${id}-source`} className="text-[var(--text-secondary)] sm:col-span-2">{t.source}<input id={`${id}-source`} value={draft.source} maxLength={500} placeholder={t.sourceHint} onChange={e => setDraft({ ...draft, source: e.target.value })} className={field} /></label>
            <label htmlFor={`${id}-note`} className="text-[var(--text-secondary)] sm:col-span-2">{t.note}<textarea id={`${id}-note`} value={draft.note} maxLength={1000} rows={2} onChange={e => setDraft({ ...draft, note: e.target.value })} className={field} /></label>
            {problems.length > 0 && <p role="alert" className="text-[var(--warning)] sm:col-span-2">{problems.map(p => t.problems[p]).join(" ")}</p>}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" className="rounded-sm bg-white px-3 py-1.5 text-black hover:bg-white/85">{t.save}</button>
              <button type="button" onClick={() => setOpen(null)} className="rounded-sm border border-white/20 px-3 py-1.5">{t.cancel}</button>
            </div>
            <p className="text-[var(--text-muted)] sm:col-span-2">{t.declared} {t.storage}</p>
          </form>}
        </li>;
      })}
    </ul>
  </div>;
}
