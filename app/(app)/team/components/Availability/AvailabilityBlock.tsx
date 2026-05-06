"use client";

import type { ReactNode } from "react";
import { CalendarCheck2, CheckCircle2, MinusCircle, Plus, Star, XCircle } from "lucide-react";

type Employee = {
  user_id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  role?: string | null;
  legacy_role?: string | null;
  position?: string | null;
};

type AvailabilityPreference = {
  id?: string;
  employee_id: string;
  weekday?: number | null;
  date?: string | null;
  preference: "available" | "unavailable" | "prefer" | "avoid";
  time_from?: string | null;
  time_to?: string | null;
  note?: string | null;
};

type FormState = {
  employee_id: string;
  scope: "weekday" | "date";
  weekday: string;
  date: string;
  preference: AvailabilityPreference["preference"];
  time_from: string;
  time_to: string;
  note: string;
};

type Props = {
  employees: Employee[];
  preferences?: AvailabilityPreference[];
  form?: FormState;
  saving?: boolean;
  onFormChange?: (form: FormState) => void;
  onSubmit?: () => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  employeeName: (employee?: Employee | null) => string;
  employeeRole: (employee?: Employee | null) => string;
};

const defaultForm: FormState = {
  employee_id: "",
  scope: "weekday",
  weekday: "1",
  date: new Date().toISOString().slice(0, 10),
  preference: "available",
  time_from: "",
  time_to: "",
  note: "",
};

const weekDays = [
  { value: "1", label: "Pirmadienis" },
  { value: "2", label: "Antradienis" },
  { value: "3", label: "Trečiadienis" },
  { value: "4", label: "Ketvirtadienis" },
  { value: "5", label: "Penktadienis" },
  { value: "6", label: "Šeštadienis" },
  { value: "0", label: "Sekmadienis" },
];

const preferenceMeta: Record<AvailabilityPreference["preference"], { label: string; icon: ReactNode; cls: string }> = {
  available: { label: "Gali dirbti", icon: <CheckCircle2 size={16} />, cls: "av-ok" },
  unavailable: { label: "Negali dirbti", icon: <XCircle size={16} />, cls: "av-bad" },
  prefer: { label: "Pageidauja dirbti", icon: <Star size={16} />, cls: "av-good" },
  avoid: { label: "Pageidauja nedirbti", icon: <MinusCircle size={16} />, cls: "av-warn" },
};

export default function AvailabilityBlock({
  employees,
  preferences = [],
  form,
  saving = false,
  onFormChange,
  onSubmit,
  onDelete,
  employeeName,
  employeeRole,
}: Props) {
  const current = form || { ...defaultForm, employee_id: employees[0]?.user_id || "" };
  const employeeMap = new Map(employees.map((employee) => [employee.user_id, employee]));

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    onFormChange?.({ ...current, [key]: value });
  }

  return (
    <section className="av-card">
      <style>{css}</style>
      <div className="av-header">
        <div>
          <h2><CalendarCheck2 size={24} /> Prieinamumas</h2>
          <p>Čia nėra oficialus neatvykimas. Tai „soft“ informacija grafiko sudarymui: kada darbuotojas gali, negali arba pageidauja dirbti.</p>
        </div>
        <div className="av-count"><b>{preferences.length}</b> taisyklės</div>
      </div>

      <div className="av-form">
        <select value={current.employee_id} onChange={(event) => update("employee_id", event.target.value)}>
          {employees.map((employee) => (
            <option key={employee.user_id} value={employee.user_id}>{employeeName(employee)} — {employeeRole(employee)}</option>
          ))}
        </select>
        <select value={current.preference} onChange={(event) => update("preference", event.target.value as FormState["preference"])}>
          <option value="available">Gali dirbti</option>
          <option value="unavailable">Negali dirbti</option>
          <option value="prefer">Pageidauja dirbti</option>
          <option value="avoid">Pageidauja nedirbti</option>
        </select>
        <select value={current.scope} onChange={(event) => update("scope", event.target.value as FormState["scope"])}>
          <option value="weekday">Kartojasi pagal savaitės dieną</option>
          <option value="date">Konkreti data</option>
        </select>
        {current.scope === "weekday" ? (
          <select value={current.weekday} onChange={(event) => update("weekday", event.target.value)}>
            {weekDays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
          </select>
        ) : (
          <input type="date" value={current.date} onChange={(event) => update("date", event.target.value)} />
        )}
        <input type="time" value={current.time_from} onChange={(event) => update("time_from", event.target.value)} />
        <input type="time" value={current.time_to} onChange={(event) => update("time_to", event.target.value)} />
        <input value={current.note} onChange={(event) => update("note", event.target.value)} placeholder="Pastaba" />
        <button type="button" disabled={saving || !current.employee_id} onClick={() => void onSubmit?.()}><Plus size={16} /> Pridėti</button>
      </div>

      <div className="av-list">
        {preferences.length ? preferences.map((pref, index) => {
          const employee = employeeMap.get(pref.employee_id);
          const meta = preferenceMeta[pref.preference] || preferenceMeta.available;
          const dayLabel = pref.date || weekDays.find((day) => Number(day.value) === pref.weekday)?.label || "—";
          const time = pref.time_from || pref.time_to ? `${pref.time_from || "00:00"}–${pref.time_to || "24:00"}` : "Visą dieną";
          return (
            <article key={pref.id || `${pref.employee_id}-${index}`} className={`av-row ${meta.cls}`}>
              <div className="av-person"><strong>{employeeName(employee)}</strong><small>{employeeRole(employee)}</small></div>
              <div className="av-pref">{meta.icon}<b>{meta.label}</b></div>
              <div className="av-meta"><span>{dayLabel}</span><span>{time}</span>{pref.note ? <span>{pref.note}</span> : null}</div>
              {pref.id && onDelete ? <button type="button" className="av-delete" onClick={() => void onDelete(pref.id!)}>Ištrinti</button> : <span />}
            </article>
          );
        }) : <div className="av-empty">Prieinamumo taisyklių dar nėra.</div>}
      </div>
    </section>
  );
}

const css = `
.av-card { background:#fff; border:1px solid #dbe6f3; border-radius:24px; padding:22px; box-shadow:0 18px 40px rgba(15,23,42,.06); }
.av-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:18px; }
.av-header h2 { margin:0 0 6px; display:flex; gap:10px; align-items:center; font-size:24px; color:#07122a; }
.av-header p { margin:0; color:#5f6f86; font-weight:750; max-width:880px; }
.av-count { border:1px solid #dbe6f3; background:#f8fbff; border-radius:999px; padding:10px 14px; font-weight:900; color:#334155; }
.av-form { display:grid; grid-template-columns:minmax(210px,1.2fr) 180px 210px 180px 120px 120px minmax(160px,1fr) 140px; gap:10px; margin-bottom:16px; }
.av-form select,.av-form input { min-height:46px; border:1px solid #cfdbea; border-radius:14px; padding:0 12px; color:#07122a; font-weight:750; background:#fff; outline:none; }
.av-form button { border:0; border-radius:14px; background:#087f63; color:#fff; font-weight:950; display:inline-flex; gap:8px; align-items:center; justify-content:center; cursor:pointer; }
.av-form button:disabled { opacity:.55; cursor:not-allowed; }
.av-list { display:grid; gap:10px; }
.av-row { display:grid; grid-template-columns:minmax(230px,1.1fr) 190px minmax(260px,2fr) 100px; gap:12px; align-items:center; border:1px solid #e2eaf5; border-left-width:6px; border-radius:18px; padding:14px; background:#fff; }
.av-person strong,.av-person small { display:block; } .av-person strong { color:#07122a; font-weight:950; } .av-person small { color:#607089; font-weight:800; }
.av-pref { display:inline-flex; gap:8px; align-items:center; font-weight:950; }
.av-meta { display:flex; flex-wrap:wrap; gap:8px; } .av-meta span { background:#f4f8fc; border:1px solid #e2eaf5; border-radius:999px; padding:7px 10px; color:#334155; font-weight:800; }
.av-ok { border-left-color:#10b981; } .av-good { border-left-color:#84cc16; } .av-warn { border-left-color:#f59e0b; } .av-bad { border-left-color:#ef4444; }
.av-delete { border:0; border-radius:12px; background:#fff0f0; color:#9f1239; padding:10px; font-weight:900; cursor:pointer; }
.av-empty { border:1px dashed #cfdbea; border-radius:18px; padding:28px; text-align:center; color:#607089; font-weight:850; background:#fbfdff; }
@media (max-width:1200px){ .av-form,.av-row{ grid-template-columns:1fr; } .av-header{ flex-direction:column; } }
`;
