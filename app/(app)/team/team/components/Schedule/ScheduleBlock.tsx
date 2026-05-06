"use client"

import { useMemo, useState, type ReactNode } from "react"
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Plus, Save, Users, X } from "lucide-react"

type ScheduleEntry = {
  id?: string
  employee_id: string
  date: string
  start_datetime?: string | null
  end_datetime?: string | null
  status?: string | null
  note?: string | null
}

type Employee = {
  user_id: string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  role?: string | null
  legacy_role?: string | null
  position?: string | null
  department?: string | null
  staff_type?: string | null
}

type ComplianceRow = {
  employee: Employee
  plannedHours: number
  maxSevenDayHours: number
  maxSevenDayWorkDays: number
  shortestRestHours: number | null
  status: string
  warnings: string[]
}

type Props = {
  employees: Employee[]
  schedule: ScheduleEntry[]
  scheduleMonth: Date
  setScheduleMonth: (updater: Date | ((prev: Date) => Date)) => void
  scheduleDays: Date[]
  scheduleGridData: unknown[][]
  scheduleComplianceRows: ComplianceRow[]
  scheduleWarningRows: ComplianceRow[]
  saving: boolean
  addMonths: (date: Date, amount: number) => Date
  monthLabel: (date: Date) => string
  toDateInput: (date: Date) => string
  employeeName: (employee?: Employee | null) => string
  employeeRole: (employee?: Employee | null) => string
  onSaveGridChanges: (changes: unknown[]) => Promise<void> | void
}

type EditingCell = {
  employee: Employee
  rowIndex: number
  day: Date
  colIndex: number
  currentValue: string
} | null

const statusOptions = [
  { value: "", label: "Tuščia", tone: "empty" },
  { value: "08:00-16:00", label: "Darbas 08:00–16:00", tone: "work" },
  { value: "08:00-20:00", label: "Darbas 08:00–20:00", tone: "work" },
  { value: "20:00-08:00", label: "Naktinė 20:00–08:00", tone: "night" },
  { value: "P", label: "Poilsis", tone: "off" },
  { value: "A", label: "Atostogos", tone: "vacation" },
  { value: "L", label: "Liga", tone: "sick" },
]

function cellTone(value: string) {
  const normalized = String(value || "").trim().toUpperCase()
  if (!normalized) return "empty"
  if (normalized === "A") return "vacation"
  if (normalized === "L") return "sick"
  if (normalized === "P") return "off"
  if (normalized.includes("20") || normalized.includes("N")) return "night"
  return "work"
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("lt-LT", { weekday: "short" }).format(date)
}

export default function ScheduleBlock({
  employees,
  scheduleMonth,
  setScheduleMonth,
  scheduleDays,
  scheduleGridData,
  scheduleComplianceRows,
  scheduleWarningRows,
  saving,
  addMonths,
  monthLabel,
  toDateInput,
  employeeName,
  employeeRole,
  onSaveGridChanges,
}: Props) {
  const [editing, setEditing] = useState<EditingCell>(null)
  const [draftValue, setDraftValue] = useState("")
  const [customStart, setCustomStart] = useState("08:00")
  const [customEnd, setCustomEnd] = useState("16:00")
  const [localSaving, setLocalSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState("")

  const monthTotalHours = useMemo(
    () => scheduleComplianceRows.reduce((sum, row) => sum + row.plannedHours, 0),
    [scheduleComplianceRows]
  )

  const shortestRest = useMemo(() => {
    const rests = scheduleComplianceRows
      .map((row) => row.shortestRestHours)
      .filter((value): value is number => value !== null)
    return rests.length ? rests.reduce((min, value) => Math.min(min, value), rests[0]) : null
  }, [scheduleComplianceRows])

  const openEditor = (employee: Employee, rowIndex: number, day: Date, colIndex: number) => {
    const currentValue = String(scheduleGridData[rowIndex]?.[colIndex] || "")
    setEditing({ employee, rowIndex, day, colIndex, currentValue })
    setDraftValue(currentValue)
    setSavedMessage("")
  }

  const saveCell = async () => {
    if (!editing) return
    const value = draftValue === "custom" ? `${customStart}-${customEnd}` : draftValue
    setLocalSaving(true)
    setSavedMessage("")

    await onSaveGridChanges([[editing.rowIndex, editing.colIndex, editing.currentValue, value]])

    setLocalSaving(false)
    setSavedMessage("Grafikas išsaugotas")
    setEditing(null)
  }

  return (
    <section className="vg2-card">
      <style jsx global>{`
        .vg2-card { display: grid; gap: 18px; padding: 22px; border-radius: 28px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #e2e8f0; box-shadow: 0 28px 80px rgba(15, 23, 42, .12); }
        .vg2-hero { display: grid; grid-template-columns: minmax(280px, 1fr) auto; gap: 18px; align-items: start; padding: 20px; border-radius: 24px; background: radial-gradient(circle at 15% 20%, rgba(16,185,129,.20), transparent 32%), linear-gradient(135deg, #0f766e, #0f172a); color: #fff; box-shadow: 0 22px 50px rgba(15,118,110,.24); }
        .vg2-title { margin: 0; font-size: 26px; line-height: 1.1; font-weight: 950; letter-spacing: -0.04em; }
        .vg2-subtitle { margin: 8px 0 0; max-width: 760px; color: rgba(255,255,255,.78); font-weight: 750; }
        .vg2-status { display: inline-flex; align-items: center; gap: 8px; padding: 10px 13px; border-radius: 999px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); color: #d1fae5; font-weight: 900; }
        .vg2-metrics { display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 12px; }
        .vg2-metric { padding: 16px; border-radius: 20px; background: #fff; border: 1px solid #e2e8f0; box-shadow: 0 18px 38px rgba(15, 23, 42, .08); }
        .vg2-metric-label { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .04em; }
        .vg2-metric-value { margin-top: 8px; color: #0f172a; font-size: 24px; font-weight: 950; letter-spacing: -0.03em; }
        .vg2-metric-value.good { color: #059669; }
        .vg2-metric-value.warn { color: #d97706; }
        .vg2-toolbar { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center; padding: 14px; border-radius: 22px; background: linear-gradient(135deg, #f8fafc, #fff); border: 1px solid #e2e8f0; box-shadow: inset 0 1px 0 rgba(255,255,255,.9); }
        .vg2-month-controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .vg2-btn { min-height: 42px; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #dbe4ef; border-radius: 14px; background: #fff; color: #0f172a; padding: 0 13px; font-weight: 900; cursor: pointer; box-shadow: 0 10px 24px rgba(15,23,42,.06); transition: transform .16s ease, box-shadow .16s ease, background .16s ease; }
        .vg2-btn:hover { transform: translateY(-1px); box-shadow: 0 16px 30px rgba(15,23,42,.10); background: #f8fafc; }
        .vg2-month { min-height: 42px; display: inline-flex; align-items: center; gap: 9px; padding: 0 15px; border-radius: 14px; background: #0f172a; color: #fff; font-weight: 950; text-transform: capitalize; box-shadow: 0 14px 30px rgba(15,23,42,.16); }
        .vg2-legend { display: flex; gap: 9px; flex-wrap: wrap; align-items: center; }
        .vg2-chip { display: inline-flex; gap: 7px; align-items: center; padding: 8px 10px; border-radius: 999px; background: #fff; border: 1px solid #e2e8f0; font-size: 13px; color: #334155; font-weight: 850; box-shadow: 0 8px 18px rgba(15,23,42,.05); }
        .vg2-dot { width: 22px; height: 22px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 950; }
        .vg2-dot.work, .vg2-cell.work { background: linear-gradient(135deg, #d1fae5, #86efac); color: #065f46; }
        .vg2-dot.night, .vg2-cell.night { background: linear-gradient(135deg, #ffedd5, #fdba74); color: #9a3412; }
        .vg2-dot.off, .vg2-cell.off { background: linear-gradient(135deg, #ede9fe, #c4b5fd); color: #5b21b6; }
        .vg2-dot.vacation, .vg2-cell.vacation { background: linear-gradient(135deg, #dbeafe, #93c5fd); color: #1e40af; }
        .vg2-dot.sick, .vg2-cell.sick { background: linear-gradient(135deg, #fee2e2, #fca5a5); color: #991b1b; }
        .vg2-grid-wrap { overflow: auto; border-radius: 24px; border: 1px solid #dbe4ef; background: #fff; box-shadow: 0 24px 70px rgba(15,23,42,.10); }
        .vg2-grid { min-width: 1180px; display: grid; grid-template-columns: 250px repeat(var(--vg-days), minmax(58px, 1fr)); }
        .vg2-head, .vg2-person, .vg2-day { min-height: 58px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; }
        .vg2-head { position: sticky; top: 0; z-index: 2; background: linear-gradient(180deg, #f8fafc, #eef6f7); color: #0f172a; font-weight: 950; }
        .vg2-person { position: sticky; left: 0; z-index: 1; justify-content: flex-start; gap: 10px; padding: 12px; background: linear-gradient(180deg, #fff, #f8fafc); }
        .vg2-person-avatar { width: 42px; height: 42px; border-radius: 15px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: linear-gradient(135deg, #d1fae5, #e0f2fe); color: #047857; font-weight: 950; box-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 12px 22px rgba(15,23,42,.08); }
        .vg2-person-name { color: #0f172a; font-weight: 950; line-height: 1.15; }
        .vg2-person-role { color: #64748b; font-size: 12px; font-weight: 800; margin-top: 3px; }
        .vg2-day { padding: 7px; background: #fff; }
        .vg2-day.weekend { background: #fafafa; }
        .vg2-cell { width: 100%; min-height: 42px; border: 0; border-radius: 15px; font-weight: 950; cursor: pointer; box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 8px 18px rgba(15,23,42,.06); transition: transform .14s ease, box-shadow .14s ease; }
        .vg2-cell:hover { transform: translateY(-1px) scale(1.02); box-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 14px 28px rgba(15,23,42,.12); }
        .vg2-cell.empty { color: #cbd5e1; background: #fff; border: 1px dashed #cbd5e1; box-shadow: none; }
        .vg2-alerts { display: grid; gap: 10px; }
        .vg2-alert { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 18px; border: 1px solid #fed7aa; background: #fff7ed; color: #9a3412; font-weight: 850; }
        .vg2-success { display: flex; gap: 10px; align-items: center; padding: 12px 14px; border-radius: 18px; border: 1px solid #bbf7d0; background: #f0fdf4; color: #047857; font-weight: 900; }
        .vg2-modal-backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(15,23,42,.45); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 18px; }
        .vg2-modal { width: min(560px, 100%); border-radius: 28px; background: #fff; box-shadow: 0 35px 100px rgba(15,23,42,.35); border: 1px solid rgba(255,255,255,.7); overflow: hidden; }
        .vg2-modal-head { padding: 20px; background: linear-gradient(135deg, #0f766e, #0f172a); color: #fff; display: flex; justify-content: space-between; gap: 12px; }
        .vg2-modal-title { margin: 0; font-size: 20px; font-weight: 950; letter-spacing: -0.03em; }
        .vg2-modal-body { padding: 20px; display: grid; gap: 14px; }
        .vg2-option-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .vg2-option { border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px; background: #fff; cursor: pointer; text-align: left; font-weight: 900; color: #0f172a; }
        .vg2-option.active { outline: 3px solid rgba(16,185,129,.20); border-color: #10b981; }
        .vg2-input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .vg2-input { width: 100%; height: 44px; border: 1px solid #dbe4ef; border-radius: 14px; padding: 0 12px; font-weight: 850; }
        .vg2-modal-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 0 20px 20px; }
        .vg2-primary { min-height: 44px; display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 14px; background: #059669; color: #fff; padding: 0 16px; font-weight: 950; cursor: pointer; box-shadow: 0 14px 30px rgba(5,150,105,.22); }
        .vg2-primary:disabled { opacity: .65; cursor: not-allowed; }
        @media (max-width: 1100px) { .vg2-hero { grid-template-columns: 1fr; } .vg2-metrics { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 700px) { .vg2-metrics, .vg2-option-grid, .vg2-input-row { grid-template-columns: 1fr; } }
      `}</style>

      <div className="vg2-hero">
        <div>
          <h2 className="vg2-title">Darbo grafikas</h2>
          <p className="vg2-subtitle">Modernus grafiko valdymas: spauskite ant dienos langelio, pasirinkite pamainą, o sistema iškart parodo įspėjimus dėl suminės darbo laiko apskaitos.</p>
        </div>
        <div className="vg2-status"><Clock size={16} />{saving || localSaving ? "Saugoma..." : "Automatinis išsaugojimas"}</div>
      </div>

      <div className="vg2-metrics">
        <Metric icon={<Users size={16} />} label="Darbuotojai" value={employees.length} />
        <Metric icon={<CalendarDays size={16} />} label="Mėnesio valandos" value={`${monthTotalHours.toFixed(1)} val.`} good />
        <Metric icon={<AlertTriangle size={16} />} label="Su įspėjimais" value={scheduleWarningRows.length} warn={scheduleWarningRows.length > 0} />
        <Metric icon={<Clock size={16} />} label="Trumpiausias poilsis" value={shortestRest === null ? "—" : `${shortestRest.toFixed(1)} val.`} warn={shortestRest !== null && shortestRest < 11} good={shortestRest !== null && shortestRest >= 11} />
      </div>

      <div className="vg2-toolbar">
        <div className="vg2-month-controls">
          <button type="button" className="vg2-btn" onClick={() => setScheduleMonth((prev) => addMonths(prev, -1))}><ChevronLeft size={16} />Ankstesnis</button>
          <div className="vg2-month"><CalendarDays size={16} />{monthLabel(scheduleMonth)}</div>
          <button type="button" className="vg2-btn" onClick={() => setScheduleMonth((prev) => addMonths(prev, 1))}>Kitas<ChevronRight size={16} /></button>
        </div>
        <div className="vg2-legend">
          <span className="vg2-chip"><span className="vg2-dot work">D</span>Darbas</span>
          <span className="vg2-chip"><span className="vg2-dot night">N</span>Naktinė</span>
          <span className="vg2-chip"><span className="vg2-dot off">P</span>Poilsis</span>
          <span className="vg2-chip"><span className="vg2-dot vacation">A</span>Atostogos</span>
          <span className="vg2-chip"><span className="vg2-dot sick">L</span>Liga</span>
        </div>
      </div>

      {savedMessage ? <div className="vg2-success"><CheckCircle2 size={18} />{savedMessage}</div> : null}

      {scheduleWarningRows.length ? (
        <div className="vg2-alerts">
          {scheduleWarningRows.slice(0, 4).map((row) => (
            <div key={row.employee.user_id} className="vg2-alert">
              <AlertTriangle size={18} />
              <div><b>{employeeName(row.employee)}</b>: {row.warnings.join(", ")}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="vg2-success"><CheckCircle2 size={18} />Kritinių grafiko įspėjimų šiam mėnesiui nėra.</div>
      )}

      <div className="vg2-grid-wrap">
        <div className="vg2-grid" style={{ ["--vg-days" as string]: scheduleDays.length }}>
          <div className="vg2-head">Darbuotojas</div>
          {scheduleDays.map((day) => (
            <div key={toDateInput(day)} className="vg2-head">
              <div>
                <div>{String(day.getDate()).padStart(2, "0")}</div>
                <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{formatDay(day)}</div>
              </div>
            </div>
          ))}

          {employees.map((employee, rowIndex) => (
            <RowFragment
              key={employee.user_id}
              employee={employee}
              rowIndex={rowIndex}
              scheduleDays={scheduleDays}
              scheduleGridData={scheduleGridData}
              employeeName={employeeName}
              employeeRole={employeeRole}
              onOpen={openEditor}
            />
          ))}
        </div>
      </div>

      {editing ? (
        <div className="vg2-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null) }}>
          <div className="vg2-modal">
            <div className="vg2-modal-head">
              <div>
                <h3 className="vg2-modal-title">Redaguoti pamainą</h3>
                <div style={{ color: "rgba(255,255,255,.72)", fontWeight: 800, marginTop: 4 }}>{employeeName(editing.employee)} · {toDateInput(editing.day)}</div>
              </div>
              <button type="button" className="vg2-btn" onClick={() => setEditing(null)}><X size={16} /></button>
            </div>
            <div className="vg2-modal-body">
              <div className="vg2-option-grid">
                {statusOptions.map((option) => (
                  <button key={option.value || "empty"} type="button" className={draftValue === option.value ? "vg2-option active" : "vg2-option"} onClick={() => setDraftValue(option.value)}>
                    <span className={`vg2-dot ${option.tone}`} style={{ marginRight: 8 }}>{option.value ? option.value.slice(0, 1) : "—"}</span>
                    {option.label}
                  </button>
                ))}
                <button type="button" className={draftValue === "custom" ? "vg2-option active" : "vg2-option"} onClick={() => setDraftValue("custom")}>
                  <span className="vg2-dot work" style={{ marginRight: 8 }}><Plus size={13} /></span>
                  Individualus laikas
                </button>
              </div>

              {draftValue === "custom" ? (
                <div className="vg2-input-row">
                  <label style={{ fontWeight: 900 }}>Nuo<input className="vg2-input" type="time" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
                  <label style={{ fontWeight: 900 }}>Iki<input className="vg2-input" type="time" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
                </div>
              ) : null}
            </div>
            <div className="vg2-modal-actions">
              <button type="button" className="vg2-btn" onClick={() => setEditing(null)}>Atšaukti</button>
              <button type="button" className="vg2-primary" disabled={localSaving} onClick={() => void saveCell()}><Save size={16} />Išsaugoti</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function RowFragment({ employee, rowIndex, scheduleDays, scheduleGridData, employeeName, employeeRole, onOpen }: {
  employee: Employee
  rowIndex: number
  scheduleDays: Date[]
  scheduleGridData: unknown[][]
  employeeName: (employee?: Employee | null) => string
  employeeRole: (employee?: Employee | null) => string
  onOpen: (employee: Employee, rowIndex: number, day: Date, colIndex: number) => void
}) {
  return (
    <>
      <div className="vg2-person">
        <div className="vg2-person-avatar">{employeeName(employee).slice(0, 2).toUpperCase()}</div>
        <div>
          <div className="vg2-person-name">{employeeName(employee)}</div>
          <div className="vg2-person-role">{employeeRole(employee)}</div>
        </div>
      </div>
      {scheduleDays.map((day, dayIndex) => {
        const colIndex = dayIndex + 1
        const value = String(scheduleGridData[rowIndex]?.[colIndex] || "")
        const tone = cellTone(value)
        const isWeekend = [0, 6].includes(day.getDay())
        return (
          <div key={`${employee.user_id}-${day.toISOString()}`} className={isWeekend ? "vg2-day weekend" : "vg2-day"}>
            <button type="button" className={`vg2-cell ${tone}`} onClick={() => onOpen(employee, rowIndex, day, colIndex)} title="Redaguoti pamainą">
              {value || "+"}
            </button>
          </div>
        )
      })}
    </>
  )
}

function Metric({ icon, label, value, good, warn }: { icon: ReactNode; label: string; value: string | number; good?: boolean; warn?: boolean }) {
  return (
    <div className="vg2-metric">
      <div className="vg2-metric-label">{icon}{label}</div>
      <div className={warn ? "vg2-metric-value warn" : good ? "vg2-metric-value good" : "vg2-metric-value"}>{value}</div>
    </div>
  )
}
