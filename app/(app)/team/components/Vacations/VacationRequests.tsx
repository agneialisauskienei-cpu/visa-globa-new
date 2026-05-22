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
  employment_start_date?: string | null;
  termination_date?: string | null;
  employment_rate?: number | string | null;
  fte?: number | string | null;
  employment_fte?: number | string | null;
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


function parseNumericValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function employeeFte(employee?: Employee | null) {
  const raw =
    parseNumericValue(employee?.employment_rate) ??
    parseNumericValue(employee?.employment_fte) ??
    parseNumericValue(employee?.fte);
  if (raw === null || raw <= 0) return 1;
  return Math.min(raw, 2);
}

function dateFromInput(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clampDate(date: Date, min: Date, max: Date) {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

function daysInclusive(start: Date, end: Date) {
  const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Math.max(0, Math.floor((endMs - startMs) / 86400000) + 1);
}

function roundDays(value: number) {
  return Math.round(value * 100) / 100;
}

function formatDays(value: number) {
  const rounded = roundDays(value);
  return rounded.toLocaleString("lt-LT", {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

function accrualInfo(employee?: Employee | null, targetInput?: string) {
  const entitlement = vacationEntitlement(employee);
  const fte = employeeFte(employee);
  const today = new Date();
  const target = dateFromInput(targetInput) || today;
  const year = target.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const employmentStart = dateFromInput(employee?.employment_start_date);
  const employmentEnd = dateFromInput(employee?.termination_date);
  const accrualStart = employmentStart && employmentStart > yearStart ? employmentStart : yearStart;
  const accrualEndLimit = employmentEnd && employmentEnd < yearEnd ? employmentEnd : yearEnd;
  const cappedTarget = clampDate(target, accrualStart, accrualEndLimit);
  const workedDays = daysInclusive(accrualStart, cappedTarget);
  const possibleDays = daysInclusive(yearStart, yearEnd);
  const annualNorm = entitlement.days * fte;
  const accrued = possibleDays > 0 ? (annualNorm / possibleDays) * workedDays : 0;

  return {
    annualNorm: roundDays(annualNorm),
    monthly: roundDays(annualNorm / 12),
    daily: roundDays(possibleDays > 0 ? annualNorm / possibleDays : 0),
    accrued: roundDays(accrued),
    target: toDateInput(target),
    basis: entitlement.basis,
    fte,
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
  const [forecastDate, setForecastDate] = useState(() => toDateInput(new Date()));
  const filter = activeFilter || localFilter;
  const [optimisticRequests, setOptimisticRequests] = useState<VacationRequest[]>([]);
  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.user_id, employee])),
    [employees],
  );

  const allRequests = useMemo(() => {
    const map = new Map<string, VacationRequest>();

    optimisticRequests.forEach((request) => {
      map.set(request.id, request);
    });

    requests.forEach((request) => {
      map.set(request.id, request);
    });

    return Array.from(map.values()).sort((a, b) => {
      const statusOrder: Record<string, number> = {
        submitted: 0,
        approved: 1,
        rejected: 2,
      };

      const aStatus = statusOrder[normalizedStatus(a.status)] ?? 9;
      const bStatus = statusOrder[normalizedStatus(b.status)] ?? 9;

      if (aStatus !== bStatus) return aStatus - bStatus;
      return String(b.created_at || b.start_date || "").localeCompare(
        String(a.created_at || a.start_date || ""),
      );
    });
  }, [requests, optimisticRequests]);

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
    return allRequests
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
    return allRequests
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
      const off = allRequests.filter((item) => {
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

  const submitted = allRequests.filter(
    (request) => normalizedStatus(request.status) === "submitted",
  );
  const approved = allRequests.filter(
    (request) => normalizedStatus(request.status) === "approved",
  );
  const rejected = allRequests.filter(
    (request) => normalizedStatus(request.status) === "rejected",
  );
  const riskCount = allRequests.filter(isRisk).length;

  const filteredRequests = allRequests.filter((request) => {
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
  const detailEmployee = historyEmployee || selectedEmployee;
  const detailBalance = remainingAnnualDays(detailEmployee);
  const selectedAccrual = accrualInfo(selectedEmployee, form.start_date || forecastDate);
  const detailAccrual = accrualInfo(detailEmployee, forecastDate);
  const projectedAvailableAtForecast = detailEmployee
    ? Math.max(0, detailAccrual.accrued - usedAnnualDays(detailEmployee) - reservedAnnualDays(detailEmployee))
    : 0;
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
  const selectedProjectedAfterRequest = selectedEmployee
    ? selectedAccrual.accrued - usedAnnualDays(selectedEmployee) - reservedAnnualDays(selectedEmployee) - (isAnnual(form.type) ? previewDays || 0 : 0)
    : 0;
  const previewHours = isTemporaryLeave(form.type)
    ? timeRangeHours(form.start_time, form.end_time)
    : 0;
  const previewOverBalance =
    isAnnual(form.type) && previewDays > selectedBalance.left;

  async function submitRequest(allowNegativeBalance = false) {
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticRequest: VacationRequest = {
      id: optimisticId,
      employee_id: form.employee_id,
      type: form.type,
      start_date: form.start_date,
      end_date: isTemporaryLeave(form.type) ? form.start_date : form.end_date,
      status: "submitted",
      requested_days: isTemporaryLeave(form.type)
        ? 0
        : daysBetween(form.start_date, form.end_date),
      note: isTemporaryLeave(form.type)
        ? `${normalizeTimeInput(form.start_time)}-${normalizeTimeInput(form.end_time)}${form.note ? ` · ${form.note}` : ""}`
        : form.note || null,
      created_at: new Date().toISOString(),
    };

    setOptimisticRequests((previous) => [optimisticRequest, ...previous]);

    try {
      await onSubmit(allowNegativeBalance ? { allowNegativeBalance: true } : undefined);
    } catch (error) {
      setOptimisticRequests((previous) =>
        previous.filter((request) => request.id !== optimisticId),
      );
      throw error;
    }
  }

  async function approveRequest(id: string) {
    setOptimisticRequests((previous) => {
      const existing =
        previous.find((request) => request.id === id) ||
        allRequests.find((request) => request.id === id);

      if (!existing) return previous;

      return [
        { ...existing, status: "approved" },
        ...previous.filter((request) => request.id !== id),
      ];
    });

    try {
      await onApprove(id);
    } catch (error) {
      setOptimisticRequests((previous) =>
        previous.filter((request) => request.id !== id),
      );
      throw error;
    }
  }

  async function rejectRequest(id: string) {
    setOptimisticRequests((previous) => {
      const existing =
        previous.find((request) => request.id === id) ||
        allRequests.find((request) => request.id === id);

      if (!existing) return previous;

      return [
        { ...existing, status: "rejected" },
        ...previous.filter((request) => request.id !== id),
      ];
    });

    try {
      await onReject(id);
    } catch (error) {
      setOptimisticRequests((previous) =>
        previous.filter((request) => request.id !== id),
      );
      throw error;
    }
  }

  return (
    <section className="vr-card">
      <style>{css}</style>

      <div className="vr-header">
        <div className="vr-title-block">
          <span className="vr-eyebrow">Prašymai</span>
          <h2>Atostogos ir trumpi išvykimai</h2>
          <p>
            Darbuotojų atostogų, mamadienių, tėvadienių ir trumpų išvykimų valdymas.
          </p>
        </div>
        <div className="vr-summary" aria-label="Prašymų filtrai">
          <button
            type="button"
            className={filter === "all" ? "vr-filter active" : "vr-filter"}
            onClick={() => setFilter("all")}
          >
            <b>{allRequests.length}</b> visi
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
          onChange={(event) => {
            update("employee_id", event.target.value);
            setHistoryEmployeeId(event.target.value || null);
          }}
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
              void submitRequest(true);
              return;
            }
            void submitRequest();
          }}
        >
          <Plus size={16} /> Pateikti prašymą
        </button>
      </div>

      <div className="vr-main-list-title">
        <div>
          <span>Prašymai</span>
          <h3>Darbuotojų pateikti prašymai</h3>
        </div>
      </div>

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
                        ? "Trumpas išvykimas"
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
                          onClick={() => void approveRequest(request.id)}
                        >
                          Patvirtinti
                        </button>
                        <button
                          type="button"
                          className="vr-reject"
                          disabled={saving}
                          onClick={() => void rejectRequest(request.id)}
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

      <section className="vr-detail-panel">
        <div className="vr-detail-head">
          <div>
            <span>Darbuotojo likutis</span>
            <h3>Kaupimas, prognozė ir istorija</h3>
          </div>
          <select
            value={detailEmployee?.user_id || ""}
            onChange={(event) => {
              const nextEmployeeId = event.target.value || "";
              setHistoryEmployeeId(nextEmployeeId || null);
            }}
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

      {detailEmployee ? (
        <div className="vr-balance">
          <Umbrella size={18} />
          <b>{employeeDisplayName(detailEmployee)}</b>
          <span>Metinė norma: {formatDays(detailAccrual.annualNorm)} d.</span>
          <span>Kaupiasi: +{formatDays(detailAccrual.monthly)} d./mėn.</span>
          <span>Per dieną: +{formatDays(detailAccrual.daily)} d.</span>
          <span>Panaudota: {detailBalance.used} d.</span>
          <span>Rezervuota: {detailBalance.reserved} d.</span>
          <span className={projectedAvailableAtForecast <= 0 ? "vr-balance-warning" : ""}>Prognozė: {formatDays(projectedAvailableAtForecast)} d.</span>
          <small>{detailBalance.basis}</small>
        </div>
      ) : null}

      {detailEmployee ? (
        <section className="vr-forecast" aria-label="Atostogų likučio prognozė">
          <div className="vr-forecast-main">
            <div>
              <span>Prognozė pasirinktai datai</span>
              <h3>{formatDays(projectedAvailableAtForecast)} d.</h3>
              <p>Preliminarus likutis įvertinus sukaupimą, panaudotas ir rezervuotas kasmetines atostogas.</p>
            </div>
            <label>
              Data
              <input
                type="date"
                value={forecastDate}
                onChange={(event) => setForecastDate(event.target.value)}
              />
            </label>
          </div>
          <div className="vr-forecast-grid">
            <span><b>Metinė norma</b>{formatDays(detailAccrual.annualNorm)} d.</span>
            <span><b>Per mėnesį</b>+{formatDays(detailAccrual.monthly)} d.</span>
            <span><b>Per dieną</b>+{formatDays(detailAccrual.daily)} d.</span>
            <span><b>Sukaupta iki datos</b>{formatDays(detailAccrual.accrued)} d.</span>
            <span><b>Po rengiamo prašymo</b>{formatDays(selectedProjectedAfterRequest)} d.</span>
          </div>
        </section>
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
            <span>Trumpas išvykimas valandomis</span>
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


      {detailEmployee ? (
        <section className="vr-rules" aria-label="Atostogų skaičiavimo taisyklės">
          <div className="vr-rule-head">
            <div>
              <span>Skaičiavimo taisyklės</span>
              <h3>Norma parenkama pagal darbuotojo pareigybę / grupę</h3>
            </div>
            <strong>Automatiškai</strong>
          </div>
          <div className="vr-rule-grid">
            <article className="vr-rule-card">
              <b>Administracija</b>
              <strong>20 d. d.</strong>
              <p>Standartinė 5 d. savaitė. Jei 6 d. savaitė — 24 d. d.</p>
            </article>
            <article className="vr-rule-card vr-rule-card-active">
              <b>Socialinė / slauga / globos darbuotojai</b>
              <strong>30 d. d.</strong>
              <p>5 d. savaitė. Jei 6 d. savaitė — 36 d. d.; jei kintantis grafikas — 6 savaitės.</p>
            </article>
            <article className="vr-rule-card vr-rule-card-warn">
              <b>Pradinis likutis ir korekcijos</b>
              <strong>{detailBalance.left} d.</strong>
              <p>Pradinis likutis įvedamas pirmą kartą arba metų pradžioje. Visi pakeitimai turi likti audite.</p>
            </article>
          </div>
        </section>
      ) : null}

      </section>

      <div className="vr-history">
        <div className="vr-history-title">
          <h3>
            <History size={18} /> Atostogų istorija
          </h3>
          <select
            value={detailEmployee?.user_id || ""}
            onChange={(event) => {
              const nextEmployeeId = event.target.value || "";
              setHistoryEmployeeId(nextEmployeeId || null);
            }}
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
        {detailEmployee ? (
          (() => {
            const balance = remainingAnnualDays(detailEmployee);
            const employeeRequests = allRequests
              .filter(
                (request) => request.employee_id === detailEmployee.user_id,
              )
              .sort((a, b) =>
                String(b.start_date).localeCompare(String(a.start_date)),
              );
            return (
              <div className="vr-history-panel">
                <div className="vr-history-person">
                  <div className="vr-avatar">
                    {employeeInitials(detailEmployee)}
                  </div>
                  <div>
                    <b>{employeeDisplayName(detailEmployee)}</b>
                    {employeePositionText(detailEmployee) ? (
                      <small>{employeePositionText(detailEmployee)}</small>
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
.vr-card {
  width: min(100%, 1500px);
  margin: 0 auto;
  background: #fff;
  border: 1px solid #c9d8d0;
  border-radius: 20px;
  box-shadow: 0 16px 38px rgba(16,37,31,.07);
  overflow: hidden;
  container-type: inline-size;
}
.vr-header {
  display: grid;
  grid-template-columns: minmax(0,1fr) auto;
  gap: 18px;
  align-items: center;
  margin: 0;
  padding: 18px 22px;
  background: #486b5d;
  color: #fff;
}
.vr-eyebrow {
  display:block;
  margin-bottom:6px;
  color: rgba(255,255,255,.72);
  font-size: 11px;
  letter-spacing: .18em;
  text-transform: uppercase;
  font-weight: 950;
}
.vr-header h2 {
  margin:0;
  color:#fff;
  font-size: clamp(24px,2.05vw,32px);
  line-height:1.04;
  font-weight:950;
  letter-spacing:-.035em;
}
.vr-header p {
  margin: 7px 0 0;
  color: rgba(255,255,255,.82);
  font-weight: 760;
  max-width: 780px;
  line-height: 1.45;
  font-size: 14px;
}
.vr-summary {
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  justify-content:flex-end;
  max-width:760px;
}
.vr-filter {
  border:1px solid rgba(255,255,255,.16);
  border-radius:10px;
  padding:9px 12px;
  color:rgba(255,255,255,.84);
  font-weight:950;
  background:rgba(255,255,255,.12);
  cursor:pointer;
  display:inline-flex;
  gap:7px;
  align-items:center;
  white-space:nowrap;
}
.vr-filter.active { background:#fff; border-color:#fff; color:#486b5d; box-shadow:0 10px 20px rgba(16,37,31,.12); }
.vr-filter.danger:not(.active) { background:#fff6df; border-color:#f2ddaa; color:#8a5a13; }
.vr-form {
  display:grid;
  grid-template-columns:minmax(230px,1.35fr) minmax(210px,1.05fr) minmax(145px,.78fr) minmax(145px,.78fr) minmax(170px,1fr) auto;
  gap:10px;
  margin:0;
  padding:16px 22px;
  border-bottom:1px solid #dbe6e0;
  background:#eef4f1;
}
.vr-form select,.vr-form input {
  width:100%;
  min-width:0;
  min-height:44px;
  border:1px solid #c2d3ca;
  border-radius:10px;
  padding:0 13px;
  color:#10251f;
  font-weight:850;
  background:#fff;
  outline:none;
  font-size:14px;
}
.vr-form select:focus,.vr-form input:focus { border-color:#486b5d; box-shadow:0 0 0 3px rgba(72,107,93,.12); }
.vr-form button {
  border:0;
  border-radius:10px;
  background:#486b5d;
  color:#fff;
  font-weight:950;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  cursor:pointer;
  min-height:44px;
  padding:0 18px;
  font-size:14px;
  box-shadow:0 10px 20px rgba(72,107,93,.18);
  white-space:nowrap;
}
.vr-form button:hover { background:#39594c; }
.vr-form button:disabled,.vr-actions button:disabled { opacity:.55; cursor:not-allowed; box-shadow:none; }
.vr-main-list-title{ display:flex; justify-content:space-between; align-items:end; gap:16px; padding:16px 22px 0; background:#fff; }
.vr-main-list-title span{ display:block; text-transform:uppercase; letter-spacing:.13em; font-size:11px; font-weight:950; color:#6a7e75; }
.vr-main-list-title h3{ margin:3px 0 0; font-size:18px; font-weight:950; color:#10251f; }
.vr-main-list-title small{ color:#6a7e75; font-weight:800; text-align:right; max-width:460px; }
.vr-table-shell {
  border:1px solid #dbe6e0;
  border-radius:14px;
  overflow:hidden;
  max-width:calc(100% - 44px);
  margin:14px 22px 18px;
  background:#fff;
}
.vr-table-head {
  display:grid;
  grid-template-columns:minmax(180px,1.15fr) minmax(260px,1.45fr) minmax(150px,.8fr) minmax(130px,.7fr) minmax(140px,.8fr) minmax(170px,.9fr);
  gap:12px;
  padding:13px 16px;
  background:#dce7e2;
  color:#40594f;
  text-transform:uppercase;
  font-size:12px;
  letter-spacing:.04em;
  font-weight:950;
}
.vr-list { display:grid; }
.vr-row {
  display:grid;
  grid-template-columns:minmax(180px,1.15fr) minmax(260px,1.45fr) minmax(150px,.8fr) minmax(130px,.7fr) minmax(140px,.8fr) minmax(170px,.9fr);
  gap:12px;
  align-items:center;
  border-top:1px solid #dbe6e0;
  padding:14px 16px;
  background:#fff;
}
.vr-row-pending { background:linear-gradient(90deg,#fffaf0,#fff); }
.vr-person { display:flex; align-items:center; gap:12px; min-width:0; text-align:left; border:0; background:transparent; padding:0; cursor:pointer; }
.vr-person:hover strong{ text-decoration:underline; }
.vr-avatar{ flex:0 0 auto; width:42px; height:42px; border-radius:14px; background:#eef4f1; color:#486b5d; display:grid; place-items:center; font-weight:950; }
.vr-person strong{ display:block; color:#10251f; font-weight:950; overflow:hidden; text-overflow:ellipsis; }
.vr-person small{ color:#6a7e75; font-weight:800; display:block; overflow:hidden; text-overflow:ellipsis; }
.vr-meta { display:flex; align-items:center; flex-wrap:wrap; gap:7px; color:#40594f; font-weight:850; min-width:0; }
.vr-meta span{ background:#f8faf8; border:1px solid #dbe6e0; border-radius:999px; padding:7px 10px; }
.vr-type b{ color:#486b5d; }
.vr-note{ border-radius:10px!important; max-width:100%; white-space:normal; }
.vr-balance-cell { display:grid; gap:3px; color:#40594f; font-weight:900; }
.vr-balance-cell small { color:#6a7e75; font-weight:800; }
.vr-status{ display:inline-flex; align-items:center; justify-content:center; gap:7px; border-radius:999px; padding:8px 11px; font-weight:950; white-space:nowrap; }
.vr-status-submitted{ background:#fff7e6; color:#8a5a13; }
.vr-status-approved{ background:#eef8f3; color:#486b5d; }
.vr-status-rejected{ background:#fff0f0; color:#8a2f27; }
.vr-decision{ display:grid; gap:2px; border-radius:12px; padding:9px; background:#eef8f3; color:#486b5d; text-align:center; font-weight:950; }
.vr-decision small{ font-weight:850; }
.vr-decision-risk{ background:#fff0f0; color:#8a2f27; }
.vr-actions{ display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }
.vr-actions button{ border:0; border-radius:10px; padding:9px 11px; font-weight:950; cursor:pointer; }
.vr-approve{ background:#486b5d; color:#fff; }
.vr-reject{ background:#fff0f0; color:#8a2f27; }
.vr-empty{ border-top:1px solid #dbe6e0; padding:28px; text-align:center; color:#6a7e75; font-weight:900; background:#f8faf8; }
.vr-detail-panel { border-top:1px solid #dbe6e0; background:#fbfcfb; }
.vr-detail-head { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 22px; border-bottom:1px solid #dbe6e0; }
.vr-detail-head span{ display:block; text-transform:uppercase; letter-spacing:.13em; font-size:11px; font-weight:950; color:#6a7e75; }
.vr-detail-head h3{ margin:3px 0 0; color:#10251f; font-weight:950; font-size:16px; }
.vr-detail-head select{ height:40px; min-width:320px; border:1px solid #c2d3ca; border-radius:10px; background:#fff; padding:0 12px; color:#10251f; font-weight:850; }
.vr-balance {
  display:grid;
  grid-template-columns:repeat(6,minmax(0,1fr));
  align-items:center;
  gap:10px;
  border-bottom:1px solid #dbe6e0;
  background:#fff;
  color:#10251f;
  padding:14px 22px;
  margin:0;
  font-weight:900;
}
.vr-balance svg { color:#486b5d; }
.vr-balance span,.vr-balance b { background:#f7faf8; border:1px solid #dbe6e0; border-radius:10px; padding:9px 11px; }
.vr-balance small { grid-column:1/-1; color:#6a7e75; font-weight:850; }
.vr-balance-warning { color:#8a5a13!important; background:#fff7ed!important; border-color:#fed7aa!important; }
.vr-forecast{ margin:0; padding:16px 22px; border-bottom:1px solid #dbe6e0; background:#fff; }
.vr-forecast-main{ display:flex; justify-content:space-between; gap:18px; align-items:end; }
.vr-forecast-main span{ display:block; text-transform:uppercase; letter-spacing:.13em; font-size:11px; font-weight:950; color:#6a7e75; }
.vr-forecast-main h3{ margin:4px 0 0; font-size:30px; line-height:1; font-weight:950; color:#10251f; }
.vr-forecast-main p{ margin:6px 0 0; color:#6a7e75; font-weight:750; max-width:720px; }
.vr-forecast-main label{ color:#6a7e75; font-size:11px; font-weight:950; text-transform:uppercase; letter-spacing:.11em; }
.vr-forecast-main input{ display:block; margin-top:6px; height:42px; min-width:180px; border:1px solid #c2d3ca; border-radius:10px; padding:0 12px; color:#10251f; font-weight:850; outline:none; background:#fff; }
.vr-forecast-main input:focus{ border-color:#486b5d; box-shadow:0 0 0 3px rgba(72,107,93,.12); }
.vr-forecast-grid{ display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-top:14px; }
.vr-forecast-grid span{ border:1px solid #dbe6e0; background:#f8faf8; border-radius:12px; padding:12px; font-size:18px; font-weight:950; color:#10251f; }
.vr-forecast-grid b{ display:block; margin-bottom:6px; text-transform:uppercase; letter-spacing:.09em; font-size:10px; font-weight:950; color:#6a7e75; }
.vr-impact {
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:10px;
  border-bottom:1px solid #dbe6e0;
  background:#fbfcfb;
  color:#40594f;
  padding:14px 22px;
  margin:0;
  font-weight:900;
}
.vr-impact span,.vr-impact strong { border-radius:999px; padding:7px 10px; background:#eef4f1; display:inline-flex; align-items:center; gap:6px; }
.vr-impact-risk { background:#fffaf0; color:#8a5a13; }
.vr-rules { border-bottom:1px solid #dbe6e0; background:#fff; padding:16px 22px; }
.vr-rule-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:12px; }
.vr-rule-head span { display:block; color:#6a7e75; text-transform:uppercase; letter-spacing:.12em; font-size:11px; font-weight:950; }
.vr-rule-head h3 { margin:4px 0 0; color:#10251f; font-size:17px; font-weight:950; }
.vr-rule-head strong { border-radius:999px; background:#eef4f1; color:#486b5d; padding:7px 11px; font-size:12px; }
.vr-rule-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.vr-rule-card { border:1px solid #dbe6e0; background:#f8faf8; border-radius:14px; padding:14px; }
.vr-rule-card b { display:block; font-size:14px; color:#10251f; }
.vr-rule-card strong { display:block; margin-top:6px; color:#10251f; font-size:26px; line-height:1; }
.vr-rule-card p { margin:8px 0 0; color:#6a7e75; font-weight:750; font-size:12px; line-height:1.4; }
.vr-rule-card-active { background:#eef8f3; border-color:#c6dcd2; }
.vr-rule-card-active strong { color:#486b5d; }
.vr-rule-card-warn { background:#fff9e8; border-color:#ead8a7; }
.vr-rule-card-warn strong,.vr-rule-card-warn p { color:#8a5a13; }
.vr-history {
  margin:0;
  border-top:1px solid #dbe6e0;
  border-left:0;
  border-right:0;
  border-bottom:0;
  border-radius:0;
  padding:16px 22px;
  background:#f7faf8;
}
.vr-history-title{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; flex-wrap:wrap; }
.vr-history h3 { margin:0; display:flex; align-items:center; gap:8px; color:#10251f; font-weight:950; }
.vr-history-title select{ min-height:40px; border:1px solid #c2d3ca; border-radius:10px; padding:0 13px; font-weight:900; color:#10251f; background:#fff; min-width:min(360px,100%); }
.vr-history-panel{ display:grid; gap:12px; }
.vr-history-person{ display:flex; align-items:center; gap:12px; }
.vr-history-person b{ display:block; color:#10251f; }
.vr-history-person small{ color:#6a7e75; font-weight:800; }
.vr-history-balance { display:flex; flex-wrap:wrap; gap:6px; }
.vr-history-balance span { border-radius:999px; padding:7px 10px; background:#eef4f1; font-weight:850; color:#40594f; }
.vr-history-table{ border:1px solid #dbe6e0; border-radius:12px; overflow:hidden; background:#fff; }
.vr-history-head,.vr-history-line{ display:grid; grid-template-columns:minmax(170px,1fr) minmax(180px,1fr) 90px 150px minmax(120px,1fr); gap:10px; padding:10px 12px; align-items:center; }
.vr-history-head{ background:#dce7e2; color:#40594f; text-transform:uppercase; font-size:12px; letter-spacing:.04em; font-weight:950; }
.vr-history-line{ border-top:1px solid #dbe6e0; color:#40594f; font-weight:800; }
@container (max-width: 1180px){
  .vr-header{ grid-template-columns:1fr; }
  .vr-summary{ justify-content:flex-start; }
  .vr-form{ grid-template-columns:1fr 1fr; }
  .vr-balance{ grid-template-columns:1fr 1fr; }
  .vr-rule-grid{ grid-template-columns:1fr; }
  .vr-forecast-main{ flex-direction:column; align-items:stretch; }
  .vr-forecast-grid{ grid-template-columns:1fr 1fr; }
  .vr-table-head{ display:none; }
  .vr-row{ grid-template-columns:1fr 1fr; border-top:1px solid #dbe6e0; }
  .vr-actions{ justify-content:flex-start; }
}
@container (max-width: 720px){
  .vr-form{ grid-template-columns:1fr; }
  .vr-balance{ grid-template-columns:1fr; }
  .vr-row{ grid-template-columns:1fr; }
  .vr-history-head{ display:none; }
  .vr-history-line{ grid-template-columns:1fr; }
  .vr-table-shell{ max-width:calc(100% - 24px); margin:12px; }
  .vr-header,.vr-form,.vr-rules,.vr-history,.vr-forecast{ padding-left:14px; padding-right:14px; }
  .vr-forecast-grid{ grid-template-columns:1fr; }
  .vr-detail-head{ align-items:stretch; flex-direction:column; }
  .vr-detail-head select{ min-width:0; width:100%; }
}
`;
