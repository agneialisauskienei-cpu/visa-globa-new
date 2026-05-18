"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  Plus,
  TrendingDown,
  Umbrella,
  XCircle,
} from "lucide-react";

type Employee = {
  user_id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  role?: string | null;
  legacy_role?: string | null;
  position?: string | null;
  department?: string | null;
  staff_type?: string | null;
};

type VacationRequest = {
  id: string;
  employee_id: string;
  type: string | null;
  start_date: string;
  end_date: string;
  status: string;
  requested_days: number | null;
  note: string | null;
  created_at: string | null;
};

type AbsenceType = { value: string; label: string; code: string };

type VacationForm = {
  employee_id: string;
  type: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  note: string;
};

type FilterKey =
  | "all"
  | "submitted"
  | "approved"
  | "rejected"
  | "risk"
  | "history";

type Props = {
  employees: Employee[];
  requests: VacationRequest[];
  form: VacationForm;
  saving: boolean;
  absenceTypes: AbsenceType[];
  activeFilter?: FilterKey;
  onFilterChange?: (filter: FilterKey) => void;
  onFormChange: (form: VacationForm) => void;
  onSubmit: (options?: { allowNegativeBalance?: boolean }) => void | Promise<void>;
  onApprove: (id: string) => void | Promise<void>;
  onReject: (id: string) => void | Promise<void>;
  employeeName: (employee?: Employee | null) => string;
  employeeRole: (employee?: Employee | null) => string;
  daysBetween: (start: string, end: string) => number;
  fmt: (value?: string | null) => string;
  absenceTypeMeta: (type?: string | null) => AbsenceType;
  absenceStatusLabel: (status?: string | null) => string;
};

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function datesBetween(start: string, end: string) {
  const rows: string[] = [];
  const current = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);

  while (current <= last) {
    rows.push(toDateInput(current));
    current.setDate(current.getDate() + 1);
  }

  return rows;
}

function normalizedText(employee?: Employee | null) {
  return [
    employee?.position,
    employee?.role,
    employee?.legacy_role,
    employee?.department,
    employee?.staff_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scheduleType(employee?: Employee | null): "five_day" | "six_day" | "variable" {
  const text = normalizedText(employee);
  if (/kintam|slenkan|pamain|grafik|sumine|suminė|variable/.test(text)) return "variable";
  if (/6\s*d|6\s*dien|šeši|sesi/.test(text)) return "six_day";
  return "five_day";
}

function vacationEntitlement(employee?: Employee | null) {
  const text = normalizedText(employee);
  const weekType = scheduleType(employee);

  const socialServices = /social|soc\s|globos|individualios priežiūros|individuali priežiūra|priežiūros darbuotoj|slaug|užimtumo|psicholog/.test(text);
  const extraGuarantee = /negal|vienas augina|nepilnamet|iki 18/.test(text);

  if (socialServices) {
    if (weekType === "variable") {
      return {
        days: 30,
        weeks: 6,
        basis: "Socialinių paslaugų / priežiūros grupė: 6 savaitės, kai grafikas kintantis.",
      };
    }
    return {
      days: weekType === "six_day" ? 36 : 30,
      weeks: 6,
      basis: weekType === "six_day"
        ? "Socialinių paslaugų / priežiūros grupė: 36 d. d. dirbant 6 d. savaitę."
        : "Socialinių paslaugų / priežiūros grupė: 30 d. d. dirbant 5 d. savaitę.",
    };
  }

  if (extraGuarantee) {
    return {
      days: weekType === "six_day" ? 30 : 25,
      weeks: 5,
      basis: "Papildoma garantija: padidinta minimali atostogų trukmė.",
    };
  }

  if (weekType === "variable") {
    return {
      days: 20,
      weeks: 4,
      basis: "Kintantis grafikas: skaičiuojama kaip 4 savaitės.",
    };
  }

  return {
    days: weekType === "six_day" ? 24 : 20,
    weeks: 4,
    basis: weekType === "six_day"
      ? "Standartinė norma: 24 d. d. dirbant 6 d. savaitę."
      : "Standartinė norma: 20 d. d. dirbant 5 d. savaitę.",
  };
}

function cleanRoleText(value?: string | null) {
  const text = String(value || "").trim();
  const normalized = text.toLowerCase();
  if (!text) return "";
  if (
    ["admin", "employee", "administratorius", "darbuotojas"].includes(
      normalized,
    )
  )
    return "";
  return text;
}

function employeePositionText(employee?: Employee | null) {
  if (!employee) return "";
  return (
    cleanRoleText(employee.position) ||
    cleanRoleText(employee.legacy_role) ||
    cleanRoleText(employee.role) ||
    cleanRoleText(employee.staff_type) ||
    cleanRoleText(employee.department)
  );
}

function employeeDisplayName(
  employee?: Employee | null,
  fallback = "Darbuotojas",
) {
  if (!employee) return fallback;
  const full = String(employee.full_name || "").trim();
  const combined = [employee.first_name, employee.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const email = String(employee.email || "").trim();
  return full || combined || email || fallback;
}

function employeeInitials(employee?: Employee | null) {
  const name = employeeDisplayName(employee, "D");
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function isAnnual(type?: string | null) {
  return !type || ["annual", "vacation", "A"].includes(String(type));
}

function isTemporaryLeave(type?: string | null) {
  return String(type || "") === "temporary_leave";
}

function normalizedStatus(status?: string | null) {
  const raw = String(status || "submitted").toLowerCase();
  if (["approved", "confirmed", "patvirtinta"].includes(raw)) return "approved";
  if (
    ["rejected", "cancelled", "canceled", "atmesta", "atšaukta"].includes(raw)
  )
    return "rejected";
  return "submitted";
}

function normalizeTimeInput(value?: string) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return "";
  const h = Number(match[1]);
  const m = Number(match[2] || 0);
  if (h < 0 || h > 24 || m < 0 || m > 59 || (h === 24 && m !== 0)) return "";
  return `${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeRangeHours(start?: string, end?: string) {
  const from = normalizeTimeInput(start);
  const to = normalizeTimeInput(end);
  if (!from || !to) return 0;
  const [sh, sm] = from.split(":").map(Number);
  const [eh, em] = to.split(":").map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

function temporaryLeaveHours(request: VacationRequest) {
  const text = String(request.note || "");
  const direct = text.match(/(\d+(?:[,.]\d+)?)\s*val/i);
  if (direct) return Number(direct[1].replace(",", "."));

  const range = text.match(/(\d{1,2}:?\d{0,2})\s*-\s*(\d{1,2}:?\d{0,2})/);
  if (!range) return null;
  return timeRangeHours(range[1], range[2]);
}

function requestStatusClass(status: string) {
  const normalized = normalizedStatus(status);
  if (normalized === "approved") return "vr-status vr-status-approved";
  if (normalized === "rejected") return "vr-status vr-status-rejected";
  return "vr-status vr-status-submitted";
}

function requestStatusIcon(status: string) {
  const normalized = normalizedStatus(status);
  if (normalized === "approved") return <CheckCircle2 size={16} />;
  if (normalized === "rejected") return <XCircle size={16} />;
  return <Clock3 size={16} />;
}

export default function VacationRequests({
  employees,
  requests,
  form,
  saving,
  absenceTypes,
  activeFilter,
  onFilterChange,
  onFormChange,
  onSubmit,
  onApprove,
  onReject,
  employeeName,
  employeeRole,
  daysBetween,
  fmt,
  absenceTypeMeta,
  absenceStatusLabel,
}: Props) {
  const [localFilter, setLocalFilter] = useState<FilterKey>("all");
  const [historyEmployeeId, setHistoryEmployeeId] = useState<string | null>(
    null,
  );
  const filter = activeFilter || localFilter;
  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.user_id, employee])),
    [employees],
  );

  function update<K extends keyof VacationForm>(
    key: K,
    value: VacationForm[K],
  ) {
    onFormChange({ ...form, [key]: value });
  }

  function setFilter(next: FilterKey) {
    setLocalFilter(next);
    onFilterChange?.(next);
  }

  function requestDays(
    request: Pick<
      VacationRequest,
      "type" | "start_date" | "end_date" | "requested_days"
    >,
  ) {
    if (isTemporaryLeave(request.type)) return 0;
    return (
      request.requested_days ||
      daysBetween(request.start_date, request.end_date)
    );
  }

  function usedAnnualDays(employee?: Employee | null) {
    if (!employee) return 0;
    return requests
      .filter(
        (request) =>
          request.employee_id === employee.user_id &&
          normalizedStatus(request.status) === "approved" &&
          isAnnual(request.type),
      )
      .reduce((sum, request) => sum + requestDays(request), 0);
  }

  function reservedAnnualDays(employee?: Employee | null) {
    if (!employee) return 0;
    return requests
      .filter(
        (request) =>
          request.employee_id === employee.user_id &&
          normalizedStatus(request.status) === "submitted" &&
          isAnnual(request.type),
      )
      .reduce((sum, request) => sum + requestDays(request), 0);
  }

  function remainingAnnualDays(employee?: Employee | null) {
    const entitlement = vacationEntitlement(employee);
    const used = usedAnnualDays(employee);
    const reserved = reservedAnnualDays(employee);
    const leftBeforeReservations = entitlement.days - used;
    return {
      entitlement: entitlement.days,
      weeks: entitlement.weeks,
      used,
      reserved,
      leftBeforeReservations,
      left: Math.max(0, leftBeforeReservations - reserved),
      rawLeft: leftBeforeReservations - reserved,
      basis: entitlement.basis,
    };
  }

  function impactFor(request: VacationRequest) {
    if (isTemporaryLeave(request.type)) {
      return {
        left: employees.length,
        total: employees.length,
        maxOff: 0,
        worstDay: request.start_date,
        risky: false,
      };
    }

    const days = datesBetween(request.start_date, request.end_date);
    let maxOff = 0;
    let worstDay = request.start_date;

    for (const day of days) {
      const off = requests.filter((item) => {
        const status = normalizedStatus(item.status);
        if (status === "rejected") return false;
        if (isTemporaryLeave(item.type)) return false;
        if (item.id === request.id) return true;
        return item.start_date <= day && item.end_date >= day;
      }).length;

      if (off > maxOff) {
        maxOff = off;
        worstDay = day;
      }
    }

    const left = Math.max(0, employees.length - maxOff);
    const risky = left < Math.max(1, Math.ceil(employees.length * 0.5));
    return { left, total: employees.length, maxOff, worstDay, risky };
  }

  function isRisk(request: VacationRequest) {
    const employee = employeeMap.get(request.employee_id);
    const balance = remainingAnnualDays(employee);
    const days = requestDays(request);
    const impact = impactFor(request);
    return (
      impact.risky ||
      (isAnnual(request.type) &&
        normalizedStatus(request.status) !== "rejected" &&
        days > balance.left)
    );
  }

  const submitted = requests.filter(
    (request) => normalizedStatus(request.status) === "submitted",
  );
  const approved = requests.filter(
    (request) => normalizedStatus(request.status) === "approved",
  );
  const rejected = requests.filter(
    (request) => normalizedStatus(request.status) === "rejected",
  );
  const riskCount = requests.filter(isRisk).length;

  const filteredRequests = requests.filter((request) => {
    const status = normalizedStatus(request.status);
    if (filter === "all") return true;
    if (filter === "history") return true;
    if (filter === "risk") return isRisk(request);
    if (filter === "rejected") return status === "rejected";
    return status === filter;
  });

  const selectedEmployee = employeeMap.get(form.employee_id);
  const historyEmployee = historyEmployeeId
    ? employeeMap.get(historyEmployeeId)
    : selectedEmployee;
  const selectedBalance = remainingAnnualDays(selectedEmployee);
  const previewRequest: VacationRequest = {
    id: "preview",
    employee_id: form.employee_id,
    type: form.type,
    start_date: form.start_date,
    end_date: form.end_date,
    status: "submitted",
    requested_days: isTemporaryLeave(form.type)
      ? 0
      : daysBetween(form.start_date, form.end_date),
    note: isTemporaryLeave(form.type)
      ? `${normalizeTimeInput(form.start_time)}-${normalizeTimeInput(form.end_time)}${form.note ? ` · ${form.note}` : ""}`
      : form.note || null,
    created_at: null,
  };
  const previewImpact =
    form.employee_id && form.start_date && form.end_date
      ? impactFor(previewRequest)
      : null;
  const previewDays = isTemporaryLeave(form.type)
    ? 0
    : daysBetween(form.start_date, form.end_date);
  const previewHours = isTemporaryLeave(form.type)
    ? timeRangeHours(form.start_time, form.end_time)
    : 0;
  const previewOverBalance =
    isAnnual(form.type) && previewDays > selectedBalance.left;

  return (
    <section className="vr-card">
      <style>{css}</style>

      <div className="vr-header">
        <div className="vr-title-block">
          <span className="vr-eyebrow">Neatvykimai</span>
          <h2>Atostogų ir neatvykimų valdymas</h2>
          <p>
            Vadovas mato pateiktus prašymus. Kol nepatvirtinta, grafike rodoma rezervacija; patvirtinus — neatvykimas įtraukiamas pilnai.
          </p>
        </div>
        <div className="vr-summary" aria-label="Prašymų filtrai">
          <button
            type="button"
            className={filter === "all" ? "vr-filter active" : "vr-filter"}
            onClick={() => setFilter("all")}
          >
            <b>{requests.length}</b> visi
          </button>
          <button
            type="button"
            className={
              filter === "submitted" ? "vr-filter active" : "vr-filter"
            }
            onClick={() => setFilter("submitted")}
          >
            <b>{submitted.length}</b> laukia
          </button>
          <button
            type="button"
            className={filter === "approved" ? "vr-filter active" : "vr-filter"}
            onClick={() => setFilter("approved")}
          >
            <b>{approved.length}</b> patvirtinta
          </button>
          <button
            type="button"
            className={
              filter === "risk" ? "vr-filter active danger" : "vr-filter danger"
            }
            onClick={() => setFilter("risk")}
          >
            <b>{riskCount}</b> rizikos
          </button>
          <button
            type="button"
            className={filter === "rejected" ? "vr-filter active" : "vr-filter"}
            onClick={() => setFilter("rejected")}
          >
            <b>{rejected.length}</b> atmesta
          </button>
          <button
            type="button"
            className={filter === "history" ? "vr-filter active" : "vr-filter"}
            onClick={() => setFilter("history")}
          >
            <History size={15} /> istorija
          </button>
        </div>
      </div>

      <div className="vr-form">
        <select
          value={form.employee_id}
          onChange={(event) => update("employee_id", event.target.value)}
        >
          {employees.map((employee) => {
            const balance = remainingAnnualDays(employee);
            return (
              <option key={employee.user_id} value={employee.user_id}>
                {employeeDisplayName(employee)}
                {employeePositionText(employee)
                  ? ` — ${employeePositionText(employee)}`
                  : ""}{" "}
                · liko {balance.left} d.
              </option>
            );
          })}
        </select>
        <select
          value={form.type}
          onChange={(event) => update("type", event.target.value)}
        >
          {absenceTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label} ({type.code})
            </option>
          ))}
        </select>
        <input
          type="date"
          value={form.start_date}
          onChange={(event) => update("start_date", event.target.value)}
        />
        {isTemporaryLeave(form.type) ? (
          <>
            <input
              value={form.start_time || ""}
              onChange={(event) => update("start_time", event.target.value)}
              onBlur={(event) =>
                update("start_time", normalizeTimeInput(event.target.value))
              }
              placeholder="Nuo, pvz. 10:00"
            />
            <input
              value={form.end_time || ""}
              onChange={(event) => update("end_time", event.target.value)}
              onBlur={(event) =>
                update("end_time", normalizeTimeInput(event.target.value))
              }
              placeholder="Iki, pvz. 12:00"
            />
          </>
        ) : (
          <input
            type="date"
            value={form.end_date}
            onChange={(event) => update("end_date", event.target.value)}
          />
        )}
        <input
          value={form.note}
          onChange={(event) => update("note", event.target.value)}
          placeholder="Pastaba"
        />
        <button
          type="button"
          disabled={saving || !form.employee_id || !form.start_date || !form.end_date}
          onClick={() => {
            if (previewOverBalance) {
              const ok = window.confirm(
                `Darbuotojui trūksta atostogų likučio. Prašoma ${previewDays} d., likutis ${selectedBalance.left} d.

Ar leisti atostogas į minusą?`,
              );
              if (!ok) return;
              void onSubmit({ allowNegativeBalance: true });
              return;
            }
            void onSubmit();
          }}
        >
          <Plus size={16} /> Pateikti prašymą
        </button>
      </div>

      {selectedEmployee ? (
        <div className="vr-balance">
          <Umbrella size={18} />
          <b>{employeeDisplayName(selectedEmployee)}</b>
          <span>Priklauso: {selectedBalance.entitlement} d.</span>
          <span>Panaudota: {selectedBalance.used} d.</span>
          <span>Rezervuota: {selectedBalance.reserved} d.</span>
          <span className={selectedBalance.left <= 0 ? "vr-balance-warning" : ""}>Likutis: {selectedBalance.left} d.</span>
          {isAnnual(form.type) ? <span>Po prašymo: {selectedBalance.rawLeft - previewDays} d.</span> : null}
          <small>{selectedBalance.basis} Etatas dienų skaičiaus nemažina.</small>
        </div>
      ) : null}

      {previewImpact ? (
        <div
          className={
            previewImpact.risky || previewOverBalance
              ? "vr-impact vr-impact-risk"
              : "vr-impact"
          }
        >
          <TrendingDown size={18} />
          <b>Poveikis prieš pateikiant:</b>
          {isTemporaryLeave(form.type) ? (
            <span>Trumpas išvykimas: {previewHours || "—"} val.</span>
          ) : (
            <span>Prašoma: {previewDays} d.</span>
          )}
          {isAnnual(form.type) ? (
            <span>
              Likutis po prašymo: {selectedBalance.rawLeft - previewDays} d.
            </span>
          ) : null}
          {!isTemporaryLeave(form.type) ? (
            <span>
              Komandoje liks {previewImpact.left} iš {previewImpact.total}
            </span>
          ) : (
            <span>Tabelyje atskiru kodu nerodoma</span>
          )}
          {!isTemporaryLeave(form.type) ? (
            <span>Kritinė diena: {fmt(previewImpact.worstDay)}</span>
          ) : null}
          {previewOverBalance ? (
            <strong>
              <AlertTriangle size={16} /> Viršija atostogų likutį
            </strong>
          ) : null}
          {previewImpact.risky ? (
            <strong>
              <AlertTriangle size={16} /> Gali trūkti žmonių
            </strong>
          ) : (
            <strong>
              <CheckCircle2 size={16} /> Rizikų nerasta
            </strong>
          )}
        </div>
      ) : null}

      <div className="vr-table-shell">
        <div className="vr-table-head">
          <span>Darbuotojas</span>
          <span>Tipas ir laikotarpis</span>
          <span>Likutis</span>
          <span>Statusas</span>
          <span>Rizika</span>
          <span>Veiksmas</span>
        </div>
        <div className="vr-list">
          {filteredRequests.length ? (
            filteredRequests.map((request) => {
              const employee = employeeMap.get(request.employee_id);
              const type = absenceTypeMeta(request.type);
              const days = requestDays(request);
              const hours = temporaryLeaveHours(request);
              const impact = impactFor(request);
              const balance = remainingAnnualDays(employee);
              const status = normalizedStatus(request.status);
              const overBalance =
                isAnnual(request.type) &&
                status !== "rejected" &&
                days > balance.left;

              return (
                <article
                  key={request.id}
                  className={`vr-row ${status === "submitted" ? "vr-row-pending" : ""}`}
                >
                  <button
                    type="button"
                    className="vr-person"
                    onClick={() => setHistoryEmployeeId(request.employee_id)}
                    title="Rodyti darbuotojo atostogų istoriją"
                  >
                    <div className="vr-avatar">
                      {employeeInitials(employee)}
                    </div>
                    <div>
                      <strong>{employeeDisplayName(employee)}</strong>
                      {employeePositionText(employee) ? (
                        <small>{employeePositionText(employee)}</small>
                      ) : null}
                    </div>
                  </button>
                  <div className="vr-meta">
                    <span className="vr-type">
                      {type.label} <b>{type.code}</b>
                    </span>
                    <span>
                      {fmt(request.start_date)} – {fmt(request.end_date)}
                    </span>
                    {isTemporaryLeave(request.type) ? (
                      <span>
                        {hours ? `${hours} val.` : "Valandos nenurodytos"}
                      </span>
                    ) : (
                      <span>{days} d.</span>
                    )}
                    {request.note ? (
                      <span className="vr-note">{request.note}</span>
                    ) : null}
                  </div>
                  <div className="vr-balance-cell">
                    {isTemporaryLeave(request.type) ? (
                      <b>Likutis nekeičiamas</b>
                    ) : (
                      <b>Likutis {balance.left} d.</b>
                    )}
                    <small>
                      Norma {balance.entitlement} d. · panaudota {balance.used} d. · rezervuota {balance.reserved} d.
                    </small>
                  </div>
                  <div className={requestStatusClass(request.status)}>
                    {requestStatusIcon(request.status)}
                    {absenceStatusLabel(request.status)}
                  </div>
                  <div
                    className={
                      impact.risky || overBalance
                        ? "vr-decision vr-decision-risk"
                        : "vr-decision"
                    }
                    title={`Kritinė diena: ${impact.worstDay}`}
                  >
                    <b>
                      {isTemporaryLeave(request.type)
                        ? "Vidinė info"
                        : overBalance
                          ? "Viršija likutį"
                          : `Liks ${impact.left}/${impact.total}`}
                    </b>
                    <small>
                      {isTemporaryLeave(request.type)
                        ? "Tabelio nekeičia"
                        : impact.risky
                          ? "Žmonių trūkumo rizika"
                          : "Komanda pakankama"}
                    </small>
                  </div>
                  <div className="vr-actions">
                    {status === "submitted" ? (
                      <>
                        <button
                          type="button"
                          className="vr-approve"
                          disabled={saving}
                          onClick={() => void onApprove(request.id)}
                        >
                          Patvirtinti
                        </button>
                        <button
                          type="button"
                          className="vr-reject"
                          disabled={saving}
                          onClick={() => void onReject(request.id)}
                        >
                          Atmesti
                        </button>
                      </>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="vr-empty">
              Pagal pasirinktą filtrą prašymų nėra.
            </div>
          )}
        </div>
      </div>

      <div className="vr-history">
        <div className="vr-history-title">
          <h3>
            <History size={18} /> Atostogų istorija
          </h3>
          <select
            value={historyEmployee?.user_id || ""}
            onChange={(event) =>
              setHistoryEmployeeId(event.target.value || null)
            }
          >
            {employees.map((employee) => (
              <option key={employee.user_id} value={employee.user_id}>
                {employeeDisplayName(employee)}
                {employeePositionText(employee)
                  ? ` — ${employeePositionText(employee)}`
                  : ""}
              </option>
            ))}
          </select>
        </div>
        {historyEmployee ? (
          (() => {
            const balance = remainingAnnualDays(historyEmployee);
            const employeeRequests = requests
              .filter(
                (request) => request.employee_id === historyEmployee.user_id,
              )
              .sort((a, b) =>
                String(b.start_date).localeCompare(String(a.start_date)),
              );
            return (
              <div className="vr-history-panel">
                <div className="vr-history-person">
                  <div className="vr-avatar">
                    {employeeInitials(historyEmployee)}
                  </div>
                  <div>
                    <b>{employeeDisplayName(historyEmployee)}</b>
                    {employeePositionText(historyEmployee) ? (
                      <small>{employeePositionText(historyEmployee)}</small>
                    ) : null}
                  </div>
                </div>
                <div className="vr-history-balance">
                  <span>Priklauso {balance.entitlement} d.</span>
                  <span>Panaudota {balance.used} d.</span>
                  <span>Rezervuota {balance.reserved} d.</span>
                  <span>Likutis {balance.left} d.</span>
                  <span>{balance.basis}</span>
                </div>
                <div className="vr-history-table">
                  <div className="vr-history-head">
                    <span>Tipas</span>
                    <span>Laikotarpis</span>
                    <span>Kiekis</span>
                    <span>Statusas</span>
                    <span>Pastaba</span>
                  </div>
                  {employeeRequests.length ? (
                    employeeRequests.map((request) => {
                      const type = absenceTypeMeta(request.type);
                      const hours = temporaryLeaveHours(request);
                      return (
                        <div key={request.id} className="vr-history-line">
                          <span>
                            {type.label} <b>{type.code}</b>
                          </span>
                          <span>
                            {fmt(request.start_date)} – {fmt(request.end_date)}
                          </span>
                          <span>
                            {isTemporaryLeave(request.type)
                              ? `${hours || "—"} val.`
                              : `${requestDays(request)} d.`}
                          </span>
                          <span>{absenceStatusLabel(request.status)}</span>
                          <span>{request.note || "—"}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="vr-empty">
                      Šiam darbuotojui prašymų nėra.
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="vr-empty">
            Pasirinkite darbuotoją istorijai peržiūrėti.
          </div>
        )}
      </div>
    </section>
  );
}

const css = `
.vr-card { width:min(100%,1280px); margin:0 auto; background:#fff; border:1px solid #dbe6f3; border-radius:28px; padding:28px; box-shadow:0 18px 46px rgba(15,23,42,.07); overflow:hidden; container-type:inline-size; }
.vr-header { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:20px; margin-bottom:22px; align-items:start; }
.vr-eyebrow { display:block; margin-bottom:8px; color:#007a5a; font-size:13px; letter-spacing:.18em; text-transform:uppercase; font-weight:950; }
.vr-header h2 { margin:0 0 8px; font-size:clamp(24px,2.5vw,34px); line-height:1.05; color:#03081f; font-weight:950; letter-spacing:-.03em; }
.vr-header p { margin:0; color:#63718b; font-weight:800; max-width:880px; line-height:1.45; }
.vr-summary { display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; max-width:760px; }
.vr-filter { border:1px solid #dbe6f3; border-radius:999px; padding:12px 16px; color:#334155; font-weight:950; background:#f8fbff; cursor:pointer; display:inline-flex; gap:8px; align-items:center; white-space:nowrap; box-shadow:0 10px 20px rgba(15,23,42,.03); }
.vr-filter.active { background:#007f63; border-color:#007f63; color:#fff; }
.vr-filter.danger:not(.active) { background:#fff7ed; border-color:#fed7aa; color:#9a3412; }
.vr-form { display:grid; grid-template-columns:minmax(240px,1.35fr) minmax(210px,1fr) minmax(145px,.75fr) minmax(145px,.75fr) minmax(170px,1fr) minmax(180px,.9fr); gap:12px; margin-bottom:14px; }
.vr-form select,.vr-form input { width:100%; min-width:0; min-height:54px; border:1px solid #d7e1ef; border-radius:18px; padding:0 16px; color:#07122a; font-weight:850; background:#fff; outline:none; font-size:15px; }
.vr-form select:focus,.vr-form input:focus { border-color:#007f63; box-shadow:0 0 0 4px rgba(0,127,99,.10); }
.vr-form button { border:0; border-radius:18px; background:#007f63; color:#fff; font-weight:950; display:inline-flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; min-height:54px; font-size:15px; box-shadow:0 14px 26px rgba(0,127,99,.18); }
.vr-form button:disabled,.vr-actions button:disabled { opacity:.55; cursor:not-allowed; box-shadow:none; }
.vr-balance { display:flex; flex-wrap:wrap; align-items:center; gap:10px; border:1px solid #bbf7d0; background:#ecfdf5; color:#065f46; border-radius:18px; padding:14px 16px; margin:12px 0; font-weight:900; }
.vr-balance svg { color:#007f63; } .vr-balance small { color:#64748b; font-weight:850; }
.vr-balance-warning { color:#b45309; background:#fff7ed; border-radius:999px; padding:4px 8px; }
.vr-impact { display:flex; flex-wrap:wrap; align-items:center; gap:10px; border:1px solid #bfdbfe; background:#eff6ff; color:#1e3a8a; border-radius:18px; padding:14px 16px; margin-bottom:18px; font-weight:900; }
.vr-impact-risk { border-color:#fed7aa; background:#fff7ed; color:#9a3412; } .vr-impact strong{ display:inline-flex; align-items:center; gap:6px; }
.vr-table-shell { border:1px solid #e2eaf5; border-radius:22px; overflow:hidden; max-width:100%; background:#fff; }
.vr-table-head { display:grid; grid-template-columns:minmax(180px,1.1fr) minmax(260px,1.5fr) minmax(170px,.9fr) minmax(140px,.75fr) minmax(150px,.85fr) minmax(170px,.8fr); gap:12px; padding:14px 16px; background:#f4f8fc; color:#52657e; text-transform:uppercase; font-size:12px; letter-spacing:.04em; font-weight:950; }
.vr-list { display:grid; }
.vr-row { display:grid; grid-template-columns:minmax(180px,1.1fr) minmax(260px,1.5fr) minmax(170px,.9fr) minmax(140px,.75fr) minmax(150px,.85fr) minmax(170px,.8fr); gap:12px; align-items:center; border-top:1px solid #e2eaf5; padding:16px; background:#fff; }
.vr-row-pending { background:linear-gradient(90deg,#fffdf5,#fff); }
.vr-person { display:flex; align-items:center; gap:12px; min-width:0; text-align:left; border:0; background:transparent; padding:0; cursor:pointer; } .vr-person:hover strong{ text-decoration:underline; }
.vr-avatar{ flex:0 0 auto; width:46px; height:46px; border-radius:16px; background:#e9fff6; color:#007f63; display:grid; place-items:center; font-weight:950; box-shadow:0 10px 20px rgba(15,23,42,.06); }
.vr-person strong{ display:block; color:#07122a; font-weight:950; overflow:hidden; text-overflow:ellipsis; } .vr-person small{ color:#607089; font-weight:850; display:block; overflow:hidden; text-overflow:ellipsis; }
.vr-meta { display:flex; align-items:center; flex-wrap:wrap; gap:8px; color:#334155; font-weight:850; min-width:0; } .vr-meta span{ background:#f8fbff; border:1px solid #e2eaf5; border-radius:999px; padding:7px 10px; } .vr-type b{ color:#007f63; } .vr-note{ border-radius:12px!important; max-width:100%; white-space:normal; }
.vr-balance-cell { display:grid; gap:3px; color:#334155; font-weight:900; } .vr-balance-cell small { color:#64748b; font-weight:800; }
.vr-status{ display:inline-flex; align-items:center; justify-content:center; gap:7px; border-radius:999px; padding:9px 12px; font-weight:950; white-space:nowrap; } .vr-status-submitted{ background:#fff7e6; color:#9a5a00; } .vr-status-approved{ background:#eafff4; color:#007f63; } .vr-status-rejected{ background:#fff0f0; color:#a11919; }
.vr-decision{ display:grid; gap:2px; border-radius:16px; padding:10px; background:#eafff4; color:#007f63; text-align:center; font-weight:950; } .vr-decision small{ font-weight:850; } .vr-decision-risk{ background:#fff0f0; color:#a11919; }
.vr-actions{ display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; } .vr-actions button{ border:0; border-radius:14px; padding:10px 12px; font-weight:950; cursor:pointer; } .vr-approve{ background:#007f63; color:#fff; } .vr-reject{ background:#fff0f0; color:#9f1239; }
.vr-empty{ border-top:1px solid #e2eaf5; padding:34px; text-align:center; color:#607089; font-weight:900; background:#fbfdff; }
.vr-history { margin-top:18px; border:1px solid #e2eaf5; border-radius:22px; padding:18px; background:#fbfdff; }
.vr-history-title{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; flex-wrap:wrap; }
.vr-history h3 { margin:0; display:flex; align-items:center; gap:8px; color:#07122a; font-weight:950; }
.vr-history-title select{ min-height:46px; border:1px solid #cfdbea; border-radius:16px; padding:0 14px; font-weight:900; color:#07122a; background:#fff; min-width:min(420px,100%); }
.vr-history-panel{ display:grid; gap:12px; }
.vr-history-person{ display:flex; align-items:center; gap:12px; } .vr-history-person b{ display:block; color:#07122a; } .vr-history-person small{ color:#64748b; font-weight:800; }
.vr-history-balance { display:flex; flex-wrap:wrap; gap:6px; } .vr-history-balance span { border-radius:999px; padding:7px 10px; background:#f4f8fc; font-weight:850; color:#334155; }
.vr-history-table{ border:1px solid #e2eaf5; border-radius:16px; overflow:hidden; background:#fff; }
.vr-history-head,.vr-history-line{ display:grid; grid-template-columns:minmax(170px,1fr) minmax(180px,1fr) 90px 150px minmax(120px,1fr); gap:10px; padding:10px 12px; align-items:center; }
.vr-history-head{ background:#f4f8fc; color:#52657e; text-transform:uppercase; font-size:12px; letter-spacing:.04em; font-weight:950; }
.vr-history-line{ border-top:1px solid #e2eaf5; color:#334155; font-weight:800; }
@container (max-width: 1180px){ .vr-header{ grid-template-columns:1fr; } .vr-summary{ justify-content:flex-start; } .vr-form{ grid-template-columns:1fr 1fr; } .vr-table-head{ display:none; } .vr-row{ grid-template-columns:1fr 1fr; border-top:1px solid #e2eaf5; } .vr-actions{ justify-content:flex-start; } }
@container (max-width: 720px){ .vr-card{ padding:18px; } .vr-form{ grid-template-columns:1fr; } .vr-row{ grid-template-columns:1fr; } .vr-history-head{ display:none; } .vr-history-line{ grid-template-columns:1fr; } }
`;
