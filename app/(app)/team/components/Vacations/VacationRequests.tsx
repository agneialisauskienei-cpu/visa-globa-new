"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileDown,
  History,
  Plus,
  Printer,
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
  // Prefer these DB-driven fields over text/regex detection.
  schedule_type?: "five_day" | "six_day" | "variable" | string | null;
  vacation_entitlement_days?: number | string | null;
  annual_vacation_days?: number | string | null;
  vacation_balance_days?: number | string | null;
  vacation_balance_as_of?: string | null;
  vacation_used_days?: number | string | null;
  vacation_reserved_days?: number | string | null;
  position_id?: string | null;
  department_id?: string | null;
  staffing_group_id?: string | null;
  staffing_group?: string | null;
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
  rejection_reason?: string | null;
  created_at: string | null;
  substitute_user_id?: string | null;
  handover_note?: string | null;
  vacation_pay_method?: "with_salary" | "before_vacation" | null;
};

type AbsenceType = { value: string; label: string; code: string };

type VacationForm = {
  employee_id: string;
  type: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  substitute_user_id?: string;
  handover_note?: string;
  vacation_pay_method?: "with_salary" | "before_vacation";
  note: string;
};

type FilterKey =
  | "all"
  | "submitted"
  | "approved"
  | "rejected"
  | "risk"
  | "history";

type ScheduleConflict = {
  employee_id: string;
  start_date: string;
  end_date: string;
  label?: string | null;
};

type NegativeBalanceApproval = {
  allowNegativeBalance: true;
  reason: string;
};

type SubmitOptions = {
  negativeBalance?: NegativeBalanceApproval;
};

type ApprovalSubstitution = {
  substituteUserId: string;
  absentEmployeeId: string;
  validFrom: string;
  validUntil: string;
  sourceRequestId: string;
  reason: string;
};

type ApproveOptions = {
  /**
   * Server/API must handle approval transactionally:
   * approve request → create employee_substitutions → create temporary permission grants → audit_log.
   */
  substitution?: ApprovalSubstitution;
};

type RejectOptions = {
  /**
   * Privaloma atmetimo priežastis. Ji turi būti įrašoma DB ir rodoma darbuotojui.
   */
  reason: string;
};

type ReasonDialogState =
  | {
      kind: "negativeBalance";
      title: string;
      message: string;
      minLength: number;
      confirmLabel: string;
    }
  | {
      kind: "reject";
      requestId: string;
      title: string;
      message: string;
      minLength: number;
      confirmLabel: string;
    }
  | null;

type Props = {
  employees: Employee[];
  requests: VacationRequest[];
  /**
   * Parent/API must pass already calculated schedule conflicts and set this to true.
   * If false, annual leave submission/approval is blocked because schedule conflict
   * validation would be incomplete.
   */
  scheduleConflicts?: ScheduleConflict[];
  scheduleConflictsChecked?: boolean;
  /**
   * This component shows employee vacation balances, so use it only in HR/admin context.
   * Parent/API must enforce the real permission before rendering this UI.
   */
  canViewSensitiveVacationData?: boolean;
  /**
   * Parent/API must pass only employees visible to the signed-in HR/admin user.
   * This component intentionally does not broaden/narrow organization, department,
   * or scope permissions on the client because that must be enforced server-side.
   */
  employeesFilteredByPermissions?: boolean;
  /**
   * UI-only gate for exceptional negative vacation balance flow.
   * Server/API must still enforce the real permission and require/audit the reason.
   */
  canAllowNegativeVacationBalance?: boolean;
  form: VacationForm;
  saving: boolean;
  absenceTypes: AbsenceType[];
  activeFilter?: FilterKey;
  onFilterChange?: (filter: FilterKey) => void;
  onFormChange: (form: VacationForm) => void;
  // Must return the persisted DB row so optimistic UI can be reconciled with the real DB id.
  // The API/parent should also create the audit row in the same transaction.
  onSubmit: (
    options?: SubmitOptions,
  ) => VacationRequest | Promise<VacationRequest>;
  // The API/parent must approve/reject and write audit in one server-side transaction.
  onApprove: (id: string, options?: ApproveOptions) => void | Promise<void>;
  onReject: (id: string, options: RejectOptions) => void | Promise<void>;
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

function vacationEntitlement(employee?: Employee | null) {
  const explicitDays =
    parseNumericValue(employee?.vacation_entitlement_days) ??
    parseNumericValue(employee?.annual_vacation_days);

  if (explicitDays !== null && explicitDays > 0) {
    return {
      days: explicitDays,
      weeks: explicitDays >= 30 ? 6 : explicitDays >= 25 ? 5 : 4,
      source: "db" as const,
      basis: "Atostogų norma paimta iš darbuotojo / pareigybės DB lauko.",
    };
  }

  return {
    days: 0,
    weeks: 0,
    source: "missing" as const,
    basis:
      "Atostogų norma nenustatyta DB. Produkcijoje norma turi būti paduodama iš vacation_entitlements / pareigybės nustatymų, ne skaičiuojama frontende.",
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
  const startMs = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  ).getTime();
  const endMs = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
  ).getTime();
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
  const accrualStart =
    employmentStart && employmentStart > yearStart
      ? employmentStart
      : yearStart;
  const accrualEndLimit =
    employmentEnd && employmentEnd < yearEnd ? employmentEnd : yearEnd;
  const cappedTarget = clampDate(target, accrualStart, accrualEndLimit);
  const workedDays = daysInclusive(accrualStart, cappedTarget);
  const possibleDays = daysInclusive(yearStart, yearEnd);
  const annualNorm = entitlement.days * fte;
  const accrued =
    possibleDays > 0 ? (annualNorm / possibleDays) * workedDays : 0;

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

function staffingGroupKey(employee?: Employee | null) {
  if (!employee) return "unknown";
  return (
    String(employee.staffing_group_id || "").trim() ||
    String(employee.position_id || "").trim() ||
    [
      employee.department_id,
      employee.position,
      employee.staff_type,
      employee.department,
    ]
      .filter(Boolean)
      .join("|")
      .toLowerCase() ||
    employee.user_id
  );
}

function staffingGroupLabel(employee?: Employee | null) {
  if (!employee) return "darbuotojo grupė";
  return (
    String(employee.staffing_group || "").trim() ||
    employeePositionText(employee) ||
    String(employee.department || "").trim() ||
    "darbuotojo grupė"
  );
}

function dateRangesOverlap(
  aStart?: string | null,
  aEnd?: string | null,
  bStart?: string | null,
  bEnd?: string | null,
) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

function employeeInitials(employee?: Employee | null) {
  const name = employeeDisplayName(employee, "D");
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function isAnnual(type?: string | null) {
  const normalized = String(type || "annual_leave")
    .trim()
    .toLowerCase();
  return [
    "annual",
    "annual_leave",
    "vacation",
    "kasmetines",
    "kasmetinės",
    "a",
  ].includes(normalized);
}

function isTemporaryLeave(type?: string | null) {
  const normalized = String(type || "")
    .trim()
    .toLowerCase();
  return normalized === "temporary_leave" || normalized === "short_leave";
}

function normalizedStatus(status?: string | null) {
  const raw = String(status || "submitted").toLowerCase();
  if (["approved", "confirmed", "patvirtinta"].includes(raw)) return "approved";
  if (
    ["rejected", "cancelled", "canceled", "atmesta", "atšaukta"].includes(raw)
  )
    return "rejected";
  if (["pending", "laukia"].includes(raw)) return "pending";
  return "submitted";
}

function isWaitingStatus(status?: string | null) {
  const normalized = normalizedStatus(status);
  return normalized === "submitted" || normalized === "pending";
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

function hasDbVacationEntitlement(employee?: Employee | null) {
  return (
    parseNumericValue(employee?.vacation_entitlement_days) !== null ||
    parseNumericValue(employee?.annual_vacation_days) !== null
  );
}

function hasDbVacationBalance(employee?: Employee | null) {
  return parseNumericValue(employee?.vacation_balance_days) !== null;
}

function hasRequiredDbVacationData(employee?: Employee | null) {
  return hasDbVacationEntitlement(employee) && hasDbVacationBalance(employee);
}

function requestSignature(
  request: Pick<
    VacationRequest,
    | "employee_id"
    | "type"
    | "start_date"
    | "end_date"
    | "requested_days"
    | "note"
  >,
) {
  return [
    request.employee_id,
    request.type || "",
    request.start_date || "",
    request.end_date || "",
    request.requested_days ?? "",
    String(request.note || "").trim(),
  ].join("|");
}

function hasSamePersistedRequest(
  persistedRequests: VacationRequest[],
  optimisticRequest: VacationRequest,
) {
  const optimisticSignature = requestSignature(optimisticRequest);

  return persistedRequests.some((request) => {
    if (request.id === optimisticRequest.id) return true;
    return requestSignature(request) === optimisticSignature;
  });
}

function isValidDateRange(start: string, end: string) {
  const startDate = dateFromInput(start);
  const endDate = dateFromInput(end);
  if (!startDate || !endDate) return false;
  return startDate <= endDate;
}

function buildSubstitutionPayload(
  request: VacationRequest,
): ApprovalSubstitution | undefined {
  const substituteUserId = String(request.substitute_user_id || "").trim();
  if (!substituteUserId) return undefined;

  return {
    substituteUserId,
    absentEmployeeId: request.employee_id,
    validFrom: request.start_date,
    validUntil: request.end_date,
    sourceRequestId: request.id,
    reason:
      "Pavadavimas patvirtinto neatvykimo laikotarpiui. Serveris privalo sukurti laikinas teises tik iki validUntil datos.",
  };
}

function normalizeReasonText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function rejectionReasonText(request?: VacationRequest | null) {
  return String(request?.rejection_reason || "").trim();
}

function payMethodLabel(value?: string | null) {
  return value === "before_vacation"
    ? "Išmokėti prieš atostogas"
    : "Išmokėti kartu su darbo užmokesčiu";
}

function requestDocumentHtml(
  request: VacationRequest,
  employee: Employee | undefined,
  typeLabel: string,
) {
  const safe = (value: unknown) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;color:#10251f;margin:48px;line-height:1.5}
  h1{color:#486b5d;font-size:24px;margin-bottom:32px} table{border-collapse:collapse;width:100%}
  td{border-bottom:1px solid #dbe6e0;padding:10px 0;vertical-align:top} td:first-child{font-weight:700;width:34%}
  </style></head><body><h1>Atostogų prašymas</h1><table>
  <tr><td>Darbuotojas</td><td>${safe(employeeDisplayName(employee))}</td></tr>
  <tr><td>Pareigos</td><td>${safe(employeePositionText(employee) || "Nenurodyta")}</td></tr>
  <tr><td>Atostogų rūšis</td><td>${safe(typeLabel)}</td></tr>
  <tr><td>Laikotarpis</td><td>${safe(request.start_date)} – ${safe(request.end_date)}</td></tr>
  <tr><td>Atostoginių išmokėjimas</td><td>${safe(payMethodLabel(request.vacation_pay_method))}</td></tr>
  <tr><td>Pavadavimas</td><td>${safe(request.substitute_user_id ? "Pasirinktas pavaduotojas" : "Nenurodytas")}</td></tr>
  <tr><td>Perduodama informacija</td><td>${safe(request.handover_note || "Nenurodyta")}</td></tr>
  <tr><td>Pastaba</td><td>${safe(request.note || "Nėra")}</td></tr>
  </table></body></html>`;
}

function downloadWord(
  request: VacationRequest,
  employee: Employee | undefined,
  typeLabel: string,
) {
  const blob = new Blob([requestDocumentHtml(request, employee, typeLabel)], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `atostogu-prasymas-${request.start_date}.doc`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function printPdf(
  request: VacationRequest,
  employee: Employee | undefined,
  typeLabel: string,
) {
  const popup = window.open("", "_blank");
  if (!popup) return;
  popup.opener = null;
  popup.document.write(requestDocumentHtml(request, employee, typeLabel));
  popup.document.close();
  popup.focus();
  popup.print();
}

export default function VacationRequests({
  employees,
  requests,
  scheduleConflicts = [],
  scheduleConflictsChecked = false,
  canViewSensitiveVacationData = false,
  employeesFilteredByPermissions = false,
  canAllowNegativeVacationBalance = false,
  form,
  saving,
  absenceTypes,
  activeFilter,
  onFilterChange,
  onFormChange,
  onSubmit,
  onApprove,
  onReject,
  daysBetween,
  fmt,
  absenceTypeMeta,
  absenceStatusLabel,
}: Props) {
  const [localFilter, setLocalFilter] = useState<FilterKey>("all");
  const [historyEmployeeId, setHistoryEmployeeId] = useState<string | null>(
    null,
  );
  const [forecastDate, setForecastDate] = useState(() =>
    toDateInput(new Date()),
  );
  const filter = activeFilter || localFilter;
  const [optimisticRequests, setOptimisticRequests] = useState<
    VacationRequest[]
  >([]);
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, VacationRequest["status"]>
  >({});
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState>(null);
  const [reasonText, setReasonText] = useState("");
  const [rejectRequestId, setRejectRequestId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.user_id, employee])),
    [employees],
  );

  const allRequests = useMemo(() => {
    const map = new Map<string, VacationRequest>();

    requests.forEach((request) => {
      map.set(request.id, {
        ...request,
        status: statusOverrides[request.id] || request.status,
      });
    });

    optimisticRequests.forEach((request) => {
      if (!hasSamePersistedRequest(requests, request)) {
        map.set(request.id, {
          ...request,
          status: statusOverrides[request.id] || request.status,
        });
      }
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
  }, [requests, optimisticRequests, statusOverrides]);

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

    const dbUsed = parseNumericValue(employee.vacation_used_days);
    if (dbUsed !== null) return dbUsed;

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

    const dbReserved = parseNumericValue(employee.vacation_reserved_days);
    if (dbReserved !== null) return dbReserved;

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
    const accrual = accrualInfo(employee);
    const used = usedAnnualDays(employee);
    const reserved = reservedAnnualDays(employee);
    const dbBalance = parseNumericValue(employee?.vacation_balance_days);
    // vacation_balance_days is treated as the current DB-authoritative balance
    // before pending reservations. Do not subtract already-used days again here,
    // because that would double-count usage when DB has already calculated it.
    const dbBalanceIsAuthoritative = dbBalance !== null;
    const availableBeforeReservations = dbBalanceIsAuthoritative
      ? dbBalance
      : accrual.accrued - used;
    // vacation_entitlements.remaining_days DB pusėje jau yra annual + carried_over - used - reserved.
    // Todėl kai turime DB balansą, pending rezervacijų nebeatimame antrą kartą.
    const rawLeft = roundDays(
      dbBalanceIsAuthoritative
        ? availableBeforeReservations
        : availableBeforeReservations - reserved,
    );

    return {
      entitlement: accrual.annualNorm,
      accrued: accrual.accrued,
      weeks: entitlement.weeks,
      used,
      reserved,
      leftBeforeReservations: roundDays(
        dbBalanceIsAuthoritative
          ? availableBeforeReservations + reserved
          : availableBeforeReservations,
      ),
      left: Math.max(0, rawLeft),
      rawLeft,
      basis:
        dbBalance !== null
          ? `${entitlement.basis} Likutis paimtas iš DB vacation_entitlements.remaining_days: ${formatDays(dbBalance)} d.${employee?.vacation_balance_as_of ? ` (${employee.vacation_balance_as_of})` : ""}`
          : `${entitlement.basis} Likutis skaičiuojamas pagal realiai sukauptą dalį iki šiandienos, ne pagal visą metinę normą.`,
      entitlementSource: entitlement.source,
    };
  }

  function groupEmployeesFor(request: VacationRequest) {
    const employee = employeeMap.get(request.employee_id);
    const key = staffingGroupKey(employee);
    return employees.filter((item) => staffingGroupKey(item) === key);
  }

  function overlappingRequestsFor(request: VacationRequest) {
    return allRequests.filter((item) => {
      if (item.id === request.id) return false;
      if (item.employee_id !== request.employee_id) return false;
      if (normalizedStatus(item.status) === "rejected") return false;
      return dateRangesOverlap(
        request.start_date,
        request.end_date,
        item.start_date,
        item.end_date,
      );
    });
  }

  function scheduleConflictsFor(request: VacationRequest) {
    return scheduleConflicts.filter(
      (item) =>
        item.employee_id === request.employee_id &&
        dateRangesOverlap(
          request.start_date,
          request.end_date,
          item.start_date,
          item.end_date,
        ),
    );
  }

  function isEmployeeActiveDuringRequest(
    employee: Employee,
    request: VacationRequest,
  ) {
    const startsAfterRequest =
      employee.employment_start_date &&
      employee.employment_start_date > request.end_date;
    const endedBeforeRequest =
      employee.termination_date &&
      employee.termination_date < request.start_date;

    return !startsAfterRequest && !endedBeforeRequest;
  }

  function hasOverlappingNonRejectedAbsence(
    employeeId: string,
    request: VacationRequest,
  ) {
    return allRequests.some((item) => {
      if (item.id === request.id) return false;
      if (item.employee_id !== employeeId) return false;
      if (normalizedStatus(item.status) === "rejected") return false;
      if (isTemporaryLeave(item.type)) return false;
      return dateRangesOverlap(
        request.start_date,
        request.end_date,
        item.start_date,
        item.end_date,
      );
    });
  }

  function requiresSubstitution(request: VacationRequest) {
    return !isTemporaryLeave(request.type) && requestDays(request) > 3;
  }

  function isSameStaffingGroup(
    absent?: Employee | null,
    substitute?: Employee | null,
  ) {
    if (!absent || !substitute) return false;
    const absentKey = staffingGroupKey(absent);
    const substituteKey = staffingGroupKey(substitute);

    return (
      absentKey !== "unknown" &&
      substituteKey !== "unknown" &&
      absentKey === substituteKey
    );
  }

  function substitutionValidationMessagesFor(request: VacationRequest) {
    const messages: string[] = [];
    const absentEmployee = employeeMap.get(request.employee_id);
    const substituteUserId = String(request.substitute_user_id || "").trim();

    if (requiresSubstitution(request) && !substituteUserId) {
      messages.push(
        "Ilgesniam nei 3 d. neatvykimui pasirinkite pavaduotoją. Serveris vis tiek privalo dar kartą patikrinti pavadavimo teisę.",
      );
    }

    if (!substituteUserId) return messages;

    const substitute = employeeMap.get(substituteUserId);

    if (substituteUserId === request.employee_id) {
      messages.push("Darbuotojas negali pavaduoti pats savęs.");
    }

    if (!substitute) {
      messages.push("Pasirinktas pavaduotojas nerastas darbuotojų sąraše.");
      return messages;
    }

    if (!isSameStaffingGroup(absentEmployee, substitute)) {
      messages.push(
        "Pavaduotojas turi būti iš tos pačios pareigybės / personalo grupės. Jei reikia išimties, ją turi patvirtinti serverio teisės.",
      );
    }

    if (!isEmployeeActiveDuringRequest(substitute, request)) {
      messages.push(
        "Pasirinktas pavaduotojas tuo laikotarpiu nėra aktyvus darbuotojas.",
      );
    }

    if (hasOverlappingNonRejectedAbsence(substitute.user_id, request)) {
      messages.push(
        "Pasirinktas pavaduotojas tuo laikotarpiu pats turi neatvykimą.",
      );
    }

    return messages;
  }

  function availableSubstitutesFor(request: VacationRequest) {
    const absentEmployee = employeeMap.get(request.employee_id);

    return employees.filter((employee) => {
      if (!absentEmployee) return false;
      if (employee.user_id === request.employee_id) return false;
      if (!isSameStaffingGroup(absentEmployee, employee)) return false;
      if (!isEmployeeActiveDuringRequest(employee, request)) return false;
      if (hasOverlappingNonRejectedAbsence(employee.user_id, request))
        return false;

      return true;
    });
  }

  function validationMessagesFor(request: VacationRequest) {
    const messages: string[] = [];
    const employee = employeeMap.get(request.employee_id);

    if (!employee) messages.push("Darbuotojas nerastas.");

    if (!request.start_date || !request.end_date) {
      messages.push("Nenurodytos datos.");
    } else if (!isValidDateRange(request.start_date, request.end_date)) {
      messages.push("Pabaigos data negali būti ankstesnė už pradžios datą.");
    }

    const overlaps = overlappingRequestsFor(request);
    if (overlaps.length) {
      messages.push(
        "Darbuotojas jau turi persidengiantį prašymą šiame laikotarpyje.",
      );
    }

    const scheduleMatches = scheduleConflictsFor(request);
    if (!isTemporaryLeave(request.type) && !scheduleConflictsChecked) {
      messages.push(
        "Grafiko konfliktai nepatikrinti. Parent/API turi paduoti scheduleConflicts ir scheduleConflictsChecked=true.",
      );
    }
    if (scheduleMatches.length) {
      messages.push(
        `Yra grafiko konfliktas: ${scheduleMatches
          .map((item) => item.label || `${item.start_date}–${item.end_date}`)
          .join(", ")}.`,
      );
    }

    if (
      isAnnual(request.type) &&
      employee &&
      !hasRequiredDbVacationData(employee)
    ) {
      messages.push(
        "Darbuotojui nėra DB atostogų normos ir/ar DB likučio. Frontend fallback nenaudojamas kaip teisinis pagrindas pateikimui ar patvirtinimui.",
      );
    }

    messages.push(...substitutionValidationMessagesFor(request));

    return messages;
  }

  function impactFor(request: VacationRequest) {
    const group = groupEmployeesFor(request);
    const employee = employeeMap.get(request.employee_id);
    const groupIds = new Set(group.map((item) => item.user_id));

    if (isTemporaryLeave(request.type)) {
      return {
        left: group.length,
        total: group.length,
        maxOff: 0,
        worstDay: request.start_date,
        risky: false,
        groupLabel: staffingGroupLabel(employee),
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
        if (!groupIds.has(item.employee_id)) return false;
        if (item.id === request.id) return true;
        return item.start_date <= day && item.end_date >= day;
      }).length;

      if (off > maxOff) {
        maxOff = off;
        worstDay = day;
      }
    }

    const left = Math.max(0, group.length - maxOff);
    const risky = left < Math.max(1, Math.ceil(group.length * 0.5));
    return {
      left,
      total: group.length,
      maxOff,
      worstDay,
      risky,
      groupLabel: staffingGroupLabel(employee),
    };
  }

  function isRisk(request: VacationRequest) {
    const employee = employeeMap.get(request.employee_id);
    const balance = remainingAnnualDays(employee);
    const days = requestDays(request);
    const impact = impactFor(request);
    return (
      impact.risky ||
      (isAnnual(request.type) &&
        normalizedStatus(request.status) === "submitted" &&
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
  const detailAccrual = accrualInfo(detailEmployee, forecastDate);
  const detailDbBalance = parseNumericValue(
    detailEmployee?.vacation_balance_days,
  );
  const projectedAvailableAtForecast = detailEmployee
    ? Math.max(
        0,
        roundDays(
          (detailDbBalance !== null
            ? detailDbBalance
            : detailAccrual.accrued - usedAnnualDays(detailEmployee)) -
            reservedAnnualDays(detailEmployee),
        ),
      )
    : 0;
  const previewRequest: VacationRequest = {
    id: "preview",
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
    created_at: null,
    substitute_user_id: form.substitute_user_id || null,
    handover_note: form.handover_note || null,
    vacation_pay_method: form.vacation_pay_method || "with_salary",
  };
  const canPreview = isTemporaryLeave(form.type)
    ? Boolean(
        form.employee_id && form.start_date && form.start_time && form.end_time,
      )
    : Boolean(
        form.employee_id &&
        form.start_date &&
        form.end_date &&
        isValidDateRange(form.start_date, form.end_date),
      );
  const availableSubstitutes = canPreview
    ? availableSubstitutesFor(previewRequest)
    : [];
  const previewImpact = canPreview ? impactFor(previewRequest) : null;
  const previewDays = isTemporaryLeave(form.type)
    ? 0
    : daysBetween(form.start_date, form.end_date);
  const selectedProjectedAfterRequest = selectedEmployee
    ? selectedBalance.leftBeforeReservations -
      selectedBalance.reserved -
      (isAnnual(form.type) ? previewDays || 0 : 0)
    : 0;
  const previewHours = isTemporaryLeave(form.type)
    ? timeRangeHours(form.start_time, form.end_time)
    : 0;
  const previewOverBalance =
    isAnnual(form.type) && previewDays > selectedBalance.left;
  const previewValidationMessages = canPreview
    ? validationMessagesFor(previewRequest)
    : [];
  const blocksSubmit = previewValidationMessages.length > 0;

  async function submitRequest(options?: SubmitOptions) {
    const normalizedStartTime = normalizeTimeInput(form.start_time);
    const normalizedEndTime = normalizeTimeInput(form.end_time);
    const isTemporary = isTemporaryLeave(form.type);
    const endDate = isTemporary ? form.start_date : form.end_date;

    if (!form.employee_id || !form.start_date || !endDate) return;
    if (!isTemporary && !isValidDateRange(form.start_date, endDate)) {
      window.alert("Pabaigos data negali būti ankstesnė už pradžios datą.");
      return;
    }
    if (isTemporary && (!normalizedStartTime || !normalizedEndTime)) {
      window.alert("Trumpam išvykimui nurodykite pradžios ir pabaigos laiką.");
      return;
    }

    const draftForValidation: VacationRequest = {
      id: "draft",
      employee_id: form.employee_id,
      type: form.type,
      start_date: form.start_date,
      end_date: endDate,
      status: "submitted",
      requested_days: isTemporary ? 0 : daysBetween(form.start_date, endDate),
      note: form.note || null,
      created_at: null,
      substitute_user_id: form.substitute_user_id || null,
      handover_note: form.handover_note || null,
      vacation_pay_method: form.vacation_pay_method || "with_salary",
    };
    const validationMessages = validationMessagesFor(draftForValidation);
    if (validationMessages.length) {
      window.alert(validationMessages.join("\n"));
      return;
    }

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticRequest: VacationRequest = {
      id: optimisticId,
      employee_id: form.employee_id,
      type: form.type,
      start_date: form.start_date,
      end_date: endDate,
      status: "submitted",
      requested_days: isTemporary ? 0 : daysBetween(form.start_date, endDate),
      note: isTemporary
        ? `${normalizedStartTime}-${normalizedEndTime}${form.note ? ` · ${form.note}` : ""}`
        : form.note || null,
      created_at: new Date().toISOString(),
      substitute_user_id: form.substitute_user_id || null,
      handover_note: form.handover_note || null,
      vacation_pay_method: form.vacation_pay_method || "with_salary",
    };

    setOptimisticRequests((previous) => [optimisticRequest, ...previous]);

    try {
      const savedRequest = await onSubmit(options);

      if (!savedRequest?.id || savedRequest.id.startsWith("optimistic-")) {
        throw new Error(
          "Prašymas išsaugotas, bet onSubmit negrąžino tikro DB įrašo ID. Auditas nesukurtas, todėl pataisykite parent/API, kad onSubmit grąžintų sukurtą vacation_requests eilutę.",
        );
      }

      setOptimisticRequests((previous) =>
        previous.filter((request) => request.id !== optimisticId),
      );
    } catch (error) {
      setOptimisticRequests((previous) =>
        previous.filter((request) => request.id !== optimisticId),
      );
      throw error;
    }
  }

  async function approveRequest(id: string) {
    const existing = allRequests.find((request) => request.id === id);
    if (!existing) return;

    const validationMessages = validationMessagesFor(existing);
    if (validationMessages.length) {
      window.alert(validationMessages.join("\n"));
      return;
    }

    setStatusOverrides((previous) => ({ ...previous, [id]: "approved" }));

    const substitution = buildSubstitutionPayload(existing);

    try {
      await onApprove(id, substitution ? { substitution } : undefined);
    } catch (error) {
      setStatusOverrides((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      throw error;
    }
  }

  async function rejectRequest(id: string, reason: string) {
    const existing = allRequests.find((request) => request.id === id);
    if (!existing) return;

    setStatusOverrides((previous) => ({ ...previous, [id]: "rejected" }));

    try {
      await onReject(id, { reason });
    } catch (error) {
      setStatusOverrides((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      throw error;
    }
  }

  function openNegativeBalanceDialog() {
    setReasonText("");
    setReasonDialog({
      kind: "negativeBalance",
      title: "Minusinio atostogų likučio priežastis",
      message: `Darbuotojui trūksta atostogų likučio. Prašoma ${previewDays} d., likutis ${selectedBalance.left} d. Serveris privalo dar kartą patikrinti teisę ir įrašyti auditą.`,
      minLength: 8,
      confirmLabel: "Pateikti su priežastimi",
    });
  }

  function openRejectDialog(requestId: string) {
    setRejectRequestId((current) => (current === requestId ? null : requestId));
    setRejectReason("");
  }

  function closeReasonDialog() {
    setReasonDialog(null);
    setReasonText("");
  }

  async function confirmReasonDialog() {
    if (!reasonDialog) return;

    const normalized = normalizeReasonText(reasonText);
    if (normalized.length < reasonDialog.minLength) {
      window.alert(
        `Būtina aiški priežastis, bent ${reasonDialog.minLength} simbolių.`,
      );
      return;
    }

    if (reasonDialog.kind === "negativeBalance") {
      closeReasonDialog();
      await submitRequest({
        negativeBalance: {
          allowNegativeBalance: true,
          reason: normalized,
        },
      });
      return;
    }

    const requestId = reasonDialog.requestId;
    closeReasonDialog();
    await rejectRequest(requestId, normalized);
  }

  async function confirmInlineReject(requestId: string) {
    const normalized = normalizeReasonText(rejectReason);

    if (normalized.length < 10) {
      window.alert("Būtina aiški atmetimo priežastis, bent 10 simbolių.");
      return;
    }

    setRejectRequestId(null);
    setRejectReason("");
    await rejectRequest(requestId, normalized);
  }

  if (!canViewSensitiveVacationData || !employeesFilteredByPermissions) {
    return (
      <section className="vr-card">
        <style>{css}</style>
        <div className="vr-validation" role="alert">
          <AlertTriangle size={18} />
          <div>
            <b>Prieiga ribojama</b>
            <span>
              Atostogų likučiai ir darbuotojų neatvykimų duomenys rodomi tik
              HR/admin aplinkoje.
            </span>
            {!canViewSensitiveVacationData ? (
              <span>
                Parent/API turi patvirtinti HR/admin teisę ir perduoti
                canViewSensitiveVacationData=true.
              </span>
            ) : null}
            {!employeesFilteredByPermissions ? (
              <span>
                Parent/API turi perduoti tik pagal organizaciją, skyrių ir
                vartotojo teises perfiltruotus darbuotojus ir nustatyti
                employeesFilteredByPermissions=true.
              </span>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="vr-card">
      <style>{css}</style>

      <div className="vr-header">
        <div className="vr-title-block">
          <span className="vr-eyebrow">Prašymai</span>
          <h2>Atostogos ir trumpi išvykimai</h2>
          <p>
            Atostogų prašymai atskirti nuo trumpų vidinių išvykimų. Teisiniai
            likučiai remiasi tik DB duomenimis, ne frontend spėjimais.
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
        <select
          value={form.substitute_user_id || ""}
          onChange={(event) => update("substitute_user_id", event.target.value)}
          title="Pavaduotojo pasirinkimas. Teisių suteikimą ir automatinį galiojimo pabaigos terminą turi įgyvendinti serverio logika."
        >
          <option value="">
            {requiresSubstitution(previewRequest)
              ? "Pasirinkite pavaduotoją"
              : "Be pavadavimo"}
          </option>
          {availableSubstitutes.map((employee) => (
            <option key={employee.user_id} value={employee.user_id}>
              Pavaduotojas: {employeeDisplayName(employee)}
              {employeePositionText(employee)
                ? ` — ${employeePositionText(employee)}`
                : ""}
            </option>
          ))}
        </select>
        {isAnnual(form.type) ? (
          <select
            value={form.vacation_pay_method || "with_salary"}
            onChange={(event) =>
              update(
                "vacation_pay_method",
                event.target.value as VacationForm["vacation_pay_method"],
              )
            }
            title="Atostoginių išmokėjimo būdas"
          >
            <option value="with_salary">Kartu su darbo užmokesčiu</option>
            <option value="before_vacation">Prieš atostogas</option>
          </select>
        ) : null}
        {form.substitute_user_id ? (
          <input
            value={form.handover_note || ""}
            onChange={(event) => update("handover_note", event.target.value)}
            placeholder="Ką perduoti pavaduotojui: užduotys, gyventojai, terminai"
            title="Ši informacija bus matoma pavaduotojui aktyvaus pavadavimo metu"
          />
        ) : null}
        <button
          type="button"
          disabled={
            saving ||
            !form.employee_id ||
            !form.start_date ||
            blocksSubmit ||
            (isTemporaryLeave(form.type)
              ? !form.start_time || !form.end_time
              : !form.end_date ||
                !isValidDateRange(form.start_date, form.end_date))
          }
          onClick={() => {
            if (previewOverBalance) {
              if (!canAllowNegativeVacationBalance) {
                window.alert(
                  "Prašymas viršija atostogų likutį. Minusinis likutis leidžiamas tik HR/admin naudotojui su atskira teise, kurią privalo patikrinti serveris.",
                );
                return;
              }
              openNegativeBalanceDialog();
              return;
            }
            void submitRequest();
          }}
        >
          <Plus size={16} /> Pateikti prašymą
        </button>
      </div>

      {canPreview &&
      requiresSubstitution(previewRequest) &&
      availableSubstitutes.length === 0 ? (
        <div className="vr-validation" role="alert">
          <AlertTriangle size={18} />
          <div>
            <b>Nėra tinkamo pavaduotojo</b>
            <span>
              Pagal dabartinius darbuotojų duomenis nerasta aktyvaus tos pačios
              grupės pavaduotojo be persidengiančio neatvykimo.
            </span>
          </div>
        </div>
      ) : null}

      {previewValidationMessages.length ? (
        <div className="vr-validation" role="alert">
          <AlertTriangle size={18} />
          <div>
            <b>Prašymo pateikti negalima</b>
            {previewValidationMessages.map((message) => (
              <span key={message}>{message}</span>
            ))}
          </div>
        </div>
      ) : null}

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
                status === "submitted" &&
                days > balance.left;

              return (
                <div key={request.id} className="vr-request-block">
                <article
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
                    {request.substitute_user_id ? (
                      <span className="vr-note">
                        Pavadavimas: galioja tik {fmt(request.start_date)}–
                        {fmt(request.end_date)}
                      </span>
                    ) : null}
                    {request.handover_note ? (
                      <span className="vr-note">
                        Perdavimas: {request.handover_note}
                      </span>
                    ) : null}
                    {isAnnual(request.type) ? (
                      <span className="vr-note">
                        Atostoginiai: {payMethodLabel(request.vacation_pay_method)}
                      </span>
                    ) : null}
                    {request.note ? (
                      <span className="vr-note">{request.note}</span>
                    ) : null}
                    {normalizedStatus(request.status) === "rejected" &&
                    rejectionReasonText(request) ? (
                      <span className="vr-note vr-rejection-reason">
                        Atmetimo priežastis: {rejectionReasonText(request)}
                      </span>
                    ) : null}
                  </div>
                  <div className="vr-balance-cell">
                    {isTemporaryLeave(request.type) ? (
                      <b>Likutis nekeičiamas</b>
                    ) : (
                      <b>Likutis {balance.left} d.</b>
                    )}
                    <small>
                      Norma {balance.entitlement} d. · panaudota {balance.used}{" "}
                      d. · rezervuota {balance.reserved} d.
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
                          ? `Rizika grupėje: ${impact.groupLabel}`
                          : `Pakanka grupėje: ${impact.groupLabel}`}
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
                          onClick={() => openRejectDialog(request.id)}
                        >
                          Atmesti
                        </button>
                      </>
                    ) : (
                      <span>—</span>
                    )}
                    <button
                      type="button"
                      className="vr-document"
                      onClick={() => downloadWord(request, employee, type.label)}
                      title="Atsisiųsti Word dokumentą"
                    >
                      <FileDown size={15} /> Word
                    </button>
                    <button
                      type="button"
                      className="vr-document"
                      onClick={() => printPdf(request, employee, type.label)}
                      title="Atidaryti spausdinimą arba išsaugoti PDF"
                    >
                      <Printer size={15} /> PDF
                    </button>
                  </div>
                </article>
                {rejectRequestId === request.id && status === "submitted" ? (
                  <div className="vr-inline-reject">
                    <div>
                      <span>Atmetimo priežastis</span>
                      <h3>Įrašykite aiškią priežastį</h3>
                      <p>Ji bus matoma darbuotojui ir liks prašymo istorijoje.</p>
                    </div>
                    <textarea
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      placeholder="Įrašykite aiškią atmetimo priežastį..."
                      rows={3}
                    />
                    <small>Mažiausiai 10 simbolių. Priežastį serveris įrašo kartu su atmetimu ir auditu.</small>
                    <div className="vr-inline-reject-actions">
                      <button
                        type="button"
                        className="vr-modal-secondary"
                        onClick={() => {
                          setRejectRequestId(null);
                          setRejectReason("");
                        }}
                      >
                        Atšaukti
                      </button>
                      <button
                        type="button"
                        className="vr-modal-primary"
                        disabled={saving}
                        onClick={() => void confirmInlineReject(request.id)}
                      >
                        Atmesti prašymą
                      </button>
                    </div>
                  </div>
                ) : null}
                </div>
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
            <span>Sukaupta: {formatDays(detailBalance.accrued)} d.</span>
            <span>Kaupiasi: +{formatDays(detailAccrual.monthly)} d./mėn.</span>
            <span>Per dieną: +{formatDays(detailAccrual.daily)} d.</span>
            <span>Panaudota: {detailBalance.used} d.</span>
            <span>Rezervuota: {detailBalance.reserved} d.</span>
            <span
              className={
                projectedAvailableAtForecast <= 0 ? "vr-balance-warning" : ""
              }
            >
              Prognozė: {formatDays(projectedAvailableAtForecast)} d.
            </span>
            <small>{detailBalance.basis}</small>
            {detailBalance.entitlementSource !== "db" ? (
              <small className="vr-balance-warning">
                Teisinė norma nenustatyta DB / pareigybės nustatymuose.
              </small>
            ) : null}
          </div>
        ) : null}

        {detailEmployee ? (
          <section
            className="vr-forecast"
            aria-label="Atostogų likučio prognozė"
          >
            <div className="vr-forecast-main">
              <div>
                <span>Prognozė pasirinktai datai</span>
                <h3>{formatDays(projectedAvailableAtForecast)} d.</h3>
                <p>
                  Preliminarus likutis įvertinus sukaupimą, panaudotas ir
                  rezervuotas kasmetines atostogas.
                </p>
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
              <span>
                <b>Metinė norma</b>
                {formatDays(detailAccrual.annualNorm)} d.
              </span>
              <span>
                <b>Per mėnesį</b>+{formatDays(detailAccrual.monthly)} d.
              </span>
              <span>
                <b>Per dieną</b>+{formatDays(detailAccrual.daily)} d.
              </span>
              <span>
                <b>Sukaupta iki datos</b>
                {formatDays(detailAccrual.accrued)} d.
              </span>
              <span>
                <b>Po rengiamo prašymo</b>
                {formatDays(selectedProjectedAfterRequest)} d.
              </span>
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
                Grupėje „{previewImpact.groupLabel}“ liks {previewImpact.left}{" "}
                iš {previewImpact.total}
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
          <section className="vr-rules" aria-label="Atostogų normos valdymas">
            <div className="vr-rule-head">
              <div>
                <span>Atostogų norma</span>
                <h3>
                  Norma ir likutis valdomi DB / API, ne statinėmis frontend
                  taisyklėmis
                </h3>
              </div>
              <strong>DB valdoma</strong>
            </div>
            <div className="vr-rule-grid">
              <article className="vr-rule-card vr-rule-card-active">
                <b>Metinė norma iš DB</b>
                <strong>{formatDays(detailBalance.entitlement)} d.</strong>
                <p>
                  Reikšmė turi ateiti iš darbuotojo pareigybės, sutarties arba
                  vacation_entitlements lentelės.
                </p>
              </article>
              <article className="vr-rule-card">
                <b>Dabartinis likutis</b>
                <strong>{formatDays(detailBalance.left)} d.</strong>
                <p>
                  Likutis turi būti apskaičiuotas API/DB, įvertinus sukaupimą,
                  korekcijas, rezervacijas ir patvirtintas atostogas.
                </p>
              </article>
              <article className="vr-rule-card vr-rule-card-warn">
                <b>Serverinė validacija</b>
                <strong>Privaloma</strong>
                <p>
                  API turi tikrinti likutį, minusinio likučio teisę, grafiko
                  konfliktus, pavadavimo galiojimą ir auditą vienoje
                  transakcijoje.
                </p>
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
                          <span>
                            {normalizedStatus(request.status) === "rejected" &&
                            rejectionReasonText(request)
                              ? `Atmetimo priežastis: ${rejectionReasonText(request)}`
                              : request.note || "—"}
                          </span>
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

      {reasonDialog ? (
        <div className="vr-modal-backdrop" role="dialog" aria-modal="true">
          <div className="vr-modal">
            <div className="vr-modal-head">
              <div>
                <span>Priežastis</span>
                <h3>{reasonDialog.title}</h3>
              </div>
              <button
                type="button"
                onClick={closeReasonDialog}
                aria-label="Uždaryti"
              >
                ×
              </button>
            </div>
            <p>{reasonDialog.message}</p>
            <textarea
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              placeholder="Įrašykite aiškią priežastį..."
              rows={5}
              autoFocus
            />
            <small>
              Mažiausiai {reasonDialog.minLength} simboliai. Šią priežastį
              privalo patikrinti ir įrašyti serveris / audit_log.
            </small>
            <div className="vr-modal-actions">
              <button
                type="button"
                className="vr-modal-secondary"
                onClick={closeReasonDialog}
              >
                Atšaukti
              </button>
              <button
                type="button"
                className="vr-modal-primary"
                onClick={() => void confirmReasonDialog()}
              >
                {reasonDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
.vr-filter.danger:not(.active) { background:#fff1f2; border-color:#fecdd3; color:#be123c; }
.vr-form {
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(170px,1fr));
  gap:10px;
  margin:0;
  padding:16px 22px;
  border-bottom:1px solid #dbe6e0;
  background:#f7fcf9;
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
.vr-validation{ display:flex; gap:10px; align-items:flex-start; margin:14px 22px 0; border:1px solid #fecdd3; background:#fff1f2; color:#be123c; border-radius:14px; padding:12px 14px; font-weight:850; }
.vr-validation b{ display:block; margin-bottom:4px; color:#9f1239; }
.vr-validation span{ display:block; margin-top:2px; }
.vr-main-list-title{ display:flex; justify-content:space-between; align-items:end; gap:16px; padding:16px 22px 0; background:#fff; }
.vr-main-list-title span{ display:block; text-transform:uppercase; letter-spacing:.13em; font-size:11px; font-weight:950; color:#6a7e75; }
.vr-main-list-title h3{ margin:3px 0 0; font-size:18px; font-weight:950; color:#10251f; }
.vr-main-list-title small{ color:#6a7e75; font-weight:800; text-align:right; max-width:460px; }
.vr-table-shell {
  border:1px solid #dbe6e0;
  border-radius:4px;
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
.vr-request-block{ border-top:1px solid #dbe6e0; }
.vr-row {
  display:grid;
  grid-template-columns:minmax(180px,1.15fr) minmax(260px,1.45fr) minmax(150px,.8fr) minmax(130px,.7fr) minmax(140px,.8fr) minmax(170px,.9fr);
  gap:12px;
  align-items:center;
  border-top:0;
  padding:14px 16px;
  background:#fff;
}
.vr-row-pending { background:#fff; }
.vr-person { display:flex; align-items:center; gap:12px; min-width:0; text-align:left; border:0; background:transparent; padding:0; cursor:pointer; }
.vr-person:hover strong{ text-decoration:underline; }
.vr-avatar{ flex:0 0 auto; width:40px; height:40px; border-radius:6px; background:#f7fcf9; color:#486b5d; display:grid; place-items:center; font-weight:950; }
.vr-person strong{ display:block; color:#10251f; font-size:14px; font-weight:950; overflow:hidden; text-overflow:ellipsis; }
.vr-person small{ color:#6a7e75; font-size:12px; font-weight:800; display:block; overflow:hidden; text-overflow:ellipsis; }
.vr-meta { display:flex; align-items:center; flex-wrap:wrap; gap:7px; color:#40594f; font-size:13px; font-weight:850; min-width:0; }
.vr-meta span{ background:#ffffff; border:1px solid #dbe6e0; border-radius:6px; padding:7px 10px; }
.vr-type b{ color:#486b5d; }
.vr-note{ border-radius:10px!important; max-width:100%; white-space:normal; }
.vr-rejection-reason{ background:#ffffff!important; color:#40594f!important; border-color:#dbe6e0!important; }
.vr-balance-cell { display:grid; gap:3px; color:#40594f; font-weight:900; }
.vr-balance-cell small { color:#6a7e75; font-weight:800; }
.vr-status{ display:inline-flex; align-items:center; justify-content:center; gap:7px; border-radius:999px; padding:8px 11px; font-weight:950; white-space:nowrap; }
.vr-status-submitted{ background:#ffffff; color:#486b5d; }
.vr-status-approved{ background:#eef8f3; color:#486b5d; }
.vr-status-rejected{ background:#ffffff; color:#8a2f27; }
.vr-decision{ display:grid; gap:2px; border-radius:12px; padding:9px; background:#eef8f3; color:#486b5d; text-align:center; font-weight:950; }
.vr-decision small{ font-weight:850; }
.vr-decision-risk{ background:#ffffff; color:#8a2f27; border:1px solid #dbe6e0; }
.vr-actions{ display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }
.vr-actions button{ min-height:38px; border:1px solid transparent; border-radius:8px; padding:8px 10px; font-size:13px; font-weight:950; cursor:pointer; }
.vr-approve{ background:#486b5d; color:#fff; }
.vr-reject{ background:#ffffff; color:#8a2f27; }
.vr-document{ display:inline-flex; align-items:center; gap:5px; background:#fff; border-color:#c2d3ca!important; color:#486b5d; }
.vr-document:hover{ border-color:#486b5d!important; }
.vr-empty{ border-top:1px solid #dbe6e0; padding:28px; text-align:center; color:#6a7e75; font-weight:900; background:#ffffff; }
.vr-inline-reject{
  display:grid;
  grid-template-columns:minmax(180px,.8fr) minmax(260px,1.2fr) minmax(180px,.9fr) auto;
  gap:12px;
  align-items:end;
  padding:14px 16px 16px;
  background:#ffffff;
  border-top:1px solid #dbe6e0;
}
.vr-inline-reject span{ display:block; text-transform:uppercase; letter-spacing:.14em; font-size:11px; font-weight:950; color:#486b5d; }
.vr-inline-reject h3{ margin:4px 0 0; color:#10251f; font-size:17px; line-height:1.2; font-weight:950; }
.vr-inline-reject p{ margin:5px 0 0; color:#40594f; font-size:13px; line-height:1.35; font-weight:800; }
.vr-inline-reject textarea{ width:100%; min-height:88px; resize:vertical; border:1px solid #dbe6e0; border-radius:14px; background:#fff; padding:12px; color:#10251f; font:inherit; font-weight:800; outline:none; }
.vr-inline-reject textarea:focus{ border-color:#486b5d; box-shadow:0 0 0 3px rgba(72,107,93,.12); }
.vr-inline-reject small{ color:#6a7e75; font-size:12px; line-height:1.35; font-weight:800; }
.vr-inline-reject-actions{ display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; }
.vr-inline-reject-actions button{ min-height:42px; border:0; border-radius:12px; padding:0 14px; font-weight:950; cursor:pointer; }
.vr-modal-backdrop{
  position:fixed;
  inset:0;
  z-index:80;
  display:grid;
  place-items:center;
  padding:20px;
  background:rgba(16,37,31,.42);
  backdrop-filter:blur(3px);
}
.vr-modal{
  width:min(100%,560px);
  max-height:calc(100vh - 40px);
  overflow:auto;
  border:1px solid #dbe6e0;
  border-radius:22px;
  background:#fff;
  box-shadow:0 24px 80px rgba(16,37,31,.26);
  padding:22px;
  color:#10251f;
}
.vr-modal-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:16px;
  margin-bottom:14px;
}
.vr-modal-head span{
  display:block;
  text-transform:uppercase;
  letter-spacing:.16em;
  font-size:11px;
  font-weight:950;
  color:#8a2f27;
}
.vr-modal-head h3{
  margin:4px 0 0;
  font-size:24px;
  line-height:1.1;
  font-weight:950;
  color:#10251f;
}
.vr-modal-head button{
  flex:0 0 auto;
  width:38px;
  height:38px;
  border:0;
  border-radius:12px;
  background:#f7fcf9;
  color:#486b5d;
  font-size:22px;
  line-height:1;
  font-weight:950;
  cursor:pointer;
}
.vr-modal p{
  margin:0 0 12px;
  color:#40594f;
  font-weight:850;
  line-height:1.45;
}
.vr-modal textarea{
  display:block;
  width:100%;
  min-height:140px;
  resize:vertical;
  border:1px solid #c2d3ca;
  border-radius:16px;
  background:#fff;
  padding:14px;
  color:#10251f;
  font:inherit;
  font-weight:800;
  outline:none;
}
.vr-modal textarea:focus{
  border-color:#486b5d;
  box-shadow:0 0 0 3px rgba(72,107,93,.13);
}
.vr-modal small{
  display:block;
  margin-top:10px;
  color:#6a7e75;
  font-size:13px;
  font-weight:800;
  line-height:1.4;
}
.vr-modal-actions{
  display:flex;
  justify-content:flex-end;
  gap:10px;
  margin-top:18px;
}
.vr-modal-actions button{
  min-height:44px;
  border:0;
  border-radius:14px;
  padding:0 16px;
  font-weight:950;
  cursor:pointer;
}
.vr-modal-secondary{ background:#f7fcf9; color:#486b5d; }
.vr-modal-primary{ background:#8a2f27; color:#fff; }
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
.vr-balance span,.vr-balance b { background:#ffffff; border:1px solid #dbe6e0; border-radius:10px; padding:9px 11px; }
.vr-balance small { grid-column:1/-1; color:#6a7e75; font-weight:850; }
.vr-balance-warning { color:#be123c!important; background:#fff1f2!important; border-color:#fecdd3!important; }
.vr-forecast{ margin:0; padding:16px 22px; border-bottom:1px solid #dbe6e0; background:#fff; }
.vr-forecast-main{ display:flex; justify-content:space-between; gap:18px; align-items:end; }
.vr-forecast-main span{ display:block; text-transform:uppercase; letter-spacing:.13em; font-size:11px; font-weight:950; color:#6a7e75; }
.vr-forecast-main h3{ margin:4px 0 0; font-size:30px; line-height:1; font-weight:950; color:#10251f; }
.vr-forecast-main p{ margin:6px 0 0; color:#6a7e75; font-weight:750; max-width:720px; }
.vr-forecast-main label{ color:#6a7e75; font-size:11px; font-weight:950; text-transform:uppercase; letter-spacing:.11em; }
.vr-forecast-main input{ display:block; margin-top:6px; height:42px; min-width:180px; border:1px solid #c2d3ca; border-radius:10px; padding:0 12px; color:#10251f; font-weight:850; outline:none; background:#fff; }
.vr-forecast-main input:focus{ border-color:#486b5d; box-shadow:0 0 0 3px rgba(72,107,93,.12); }
.vr-forecast-grid{ display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-top:14px; }
.vr-forecast-grid span{ border:1px solid #dbe6e0; background:#ffffff; border-radius:12px; padding:12px; font-size:18px; font-weight:950; color:#10251f; }
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
.vr-impact span,.vr-impact strong { border-radius:999px; padding:7px 10px; background:#f7fcf9; display:inline-flex; align-items:center; gap:6px; }
.vr-impact-risk { background:#ffffff; color:#486b5d; }
.vr-rules { border-bottom:1px solid #dbe6e0; background:#fff; padding:16px 22px; }
.vr-rule-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:12px; }
.vr-rule-head span { display:block; color:#6a7e75; text-transform:uppercase; letter-spacing:.12em; font-size:11px; font-weight:950; }
.vr-rule-head h3 { margin:4px 0 0; color:#10251f; font-size:17px; font-weight:950; }
.vr-rule-head strong { border-radius:999px; background:#f7fcf9; color:#486b5d; padding:7px 11px; font-size:12px; }
.vr-rule-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.vr-rule-card { border:1px solid #dbe6e0; background:#ffffff; border-radius:14px; padding:14px; }
.vr-rule-card b { display:block; font-size:14px; color:#10251f; }
.vr-rule-card strong { display:block; margin-top:6px; color:#10251f; font-size:26px; line-height:1; }
.vr-rule-card p { margin:8px 0 0; color:#6a7e75; font-weight:750; font-size:12px; line-height:1.4; }
.vr-rule-card-active { background:#eef8f3; border-color:#c6dcd2; }
.vr-rule-card-active strong { color:#486b5d; }
.vr-rule-card-warn { background:#fff1f2; border-color:#fecdd3; }
.vr-rule-card-warn strong,.vr-rule-card-warn p { color:#be123c; }
.vr-history {
  margin:0;
  border-top:1px solid #dbe6e0;
  border-left:0;
  border-right:0;
  border-bottom:0;
  border-radius:0;
  padding:16px 22px;
  background:#ffffff;
}
.vr-history-title{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; flex-wrap:wrap; }
.vr-history h3 { margin:0; display:flex; align-items:center; gap:8px; color:#10251f; font-weight:950; }
.vr-history-title select{ min-height:40px; border:1px solid #c2d3ca; border-radius:10px; padding:0 13px; font-weight:900; color:#10251f; background:#fff; min-width:min(360px,100%); }
.vr-history-panel{ display:grid; gap:12px; }
.vr-history-person{ display:flex; align-items:center; gap:12px; }
.vr-history-person b{ display:block; color:#10251f; }
.vr-history-person small{ color:#6a7e75; font-weight:800; }
.vr-history-balance { display:flex; flex-wrap:wrap; gap:6px; }
.vr-history-balance span { border-radius:999px; padding:7px 10px; background:#f7fcf9; font-weight:850; color:#40594f; }
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
  .vr-request-block .vr-row{ border-top:0; }
  .vr-inline-reject{ grid-template-columns:1fr; align-items:stretch; }
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
  .vr-modal-backdrop{ padding:12px; place-items:end center; }
  .vr-modal{ width:100%; max-height:calc(100vh - 24px); border-radius:18px; padding:18px; }
  .vr-modal-head h3{ font-size:20px; }
  .vr-modal-actions{ flex-direction:column-reverse; }
  .vr-modal-actions button{ width:100%; }
  .vr-inline-reject-actions{ flex-direction:column-reverse; }
  .vr-inline-reject-actions button{ width:100%; }
}
`;
