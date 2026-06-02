"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  Plus,
  RefreshCw,
  Search,
  Umbrella,
  XCircle,
} from "lucide-react";

type RequestStatus = "submitted" | "pending" | "approved" | "rejected" | "canceled";
type RequestKind =
  | "annual_leave"
  | "temporary_leave"
  | "mamadienis"
  | "tevadienis"
  | "sick_leave"
  | "training";

type EmployeeRow = {
  user_id: string;
  email?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  role?: string | null;
  department?: string | null;
};

type VacationDbRow = {
  id: string;
  organization_id?: string | null;
  employee_id: string;
  type: string | null;
  start_date: string;
  end_date: string;
  status: string | null;
  requested_days: number | null;
  note: string | null;
  rejection_reason?: string | null;
  created_at: string | null;
};

type RequestRow = {
  id: string;
  employeeId: string;
  employeeEmail?: string | null;
  employee: string;
  position: string;
  kind: RequestKind;
  kindLabel: string;
  code: string;
  start: string;
  end: string;
  amount: string;
  requestedDays: number;
  status: RequestStatus;
  balance: string;
  risk: string;
  note: string;
  rejectionReason?: string | null;
  createdAt?: string | null;
};

type VacationBalanceRow = {
  employeeId: string;
  employeeEmail?: string | null;
  employee: string;
  position: string;
  annualTotal: number;
  annualUsed: number;
  annualReserved: number;
  annualLeft: number;
};

type VacationEntitlementDbRow = {
  employee_id: string;
  year?: number | null;
  annual_days?: number | string | null;
  entitlement_days?: number | string | null;
  carried_over_days?: number | string | null;
  used_days?: number | string | null;
  reserved_days?: number | string | null;
  remaining_days?: number | string | null;
  is_active?: boolean | null;
};


const EMPTY_FORM = {
  employeeId: "",
  kind: "annual_leave" as RequestKind,
  start: new Date().toISOString().slice(0, 10),
  end: new Date().toISOString().slice(0, 10),
  note: "",
};

function statusLabel(status: RequestStatus) {
  if (status === "approved") return "Patvirtinta";
  if (status === "rejected") return "Atmesta";
  if (status === "canceled") return "Atšaukta";
  return "Laukia";
}

function statusClass(status: RequestStatus) {
  if (status === "approved") return "border-emerald-100 bg-emerald-50 text-emerald-800";
  if (status === "rejected") return "border-rose-100 bg-rose-50 text-rose-800";
  if (status === "canceled") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-amber-100 bg-amber-50 text-amber-800";
}

function statusIcon(status: RequestStatus) {
  if (status === "approved") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "rejected" || status === "canceled") return <XCircle className="h-4 w-4" />;
  return <Clock3 className="h-4 w-4" />;
}

function normalizeStatus(value?: string | null): RequestStatus {
  const raw = String(value || "submitted").toLowerCase();
  if (["approved", "confirmed", "patvirtinta"].includes(raw)) return "approved";
  if (["rejected", "atmesta"].includes(raw)) return "rejected";
  if (["canceled", "cancelled", "atšaukta", "atsaukta"].includes(raw)) return "canceled";
  if (["pending", "laukiama"].includes(raw)) return "pending";
  return "submitted";
}

function requestKindMeta(kind?: string | null) {
  const raw = String(kind || "annual_leave").toLowerCase();

  if (["temporary_leave", "short_leave", "ti"].includes(raw)) {
    return { kind: "temporary_leave" as RequestKind, label: "Trumpas išvykimas", code: "TI" };
  }

  if (["mamadienis", "mother_day", "md"].includes(raw)) {
    return { kind: "mamadienis" as RequestKind, label: "Mamadienis", code: "MD" };
  }

  if (["tevadienis", "father_day", "td"].includes(raw)) {
    return { kind: "tevadienis" as RequestKind, label: "Tėvadienis", code: "TD" };
  }

  if (["sick", "sick_leave", "nedarbingumas", "l"].includes(raw)) {
    return { kind: "sick_leave" as RequestKind, label: "Nedarbingumas", code: "L" };
  }

  if (["training", "business_trip", "komandiruote", "mokymai", "k"].includes(raw)) {
    return { kind: "training" as RequestKind, label: "Mokymai / komandiruotė", code: "K" };
  }

  return { kind: "annual_leave" as RequestKind, label: "Kasmetinės atostogos", code: "A" };
}

function isAnnualKind(kind?: string | null) {
  return requestKindMeta(kind).kind === "annual_leave";
}

function isTemporaryKind(kind?: string | null) {
  return requestKindMeta(kind).kind === "temporary_leave";
}


function lithuanianEasterDate(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function isLithuanianPublicHoliday(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const fixed = new Set([
    "1-1",
    "2-16",
    "3-11",
    "5-1",
    "6-24",
    "7-6",
    "8-15",
    "11-1",
    "11-2",
    "12-24",
    "12-25",
    "12-26",
  ]);

  if (fixed.has(`${month}-${day}`)) return true;

  const easter = lithuanianEasterDate(year);
  const easterMonday = addDays(easter, 1);
  const mothersDay = new Date(year, 4, 1);
  mothersDay.setDate(1 + ((7 - mothersDay.getDay()) % 7));
  const fathersDay = new Date(year, 5, 1);
  fathersDay.setDate(1 + ((7 - fathersDay.getDay()) % 7));

  return [easter, easterMonday, mothersDay, fathersDay].some(
    (holiday) => toDateInput(holiday) === toDateInput(date),
  );
}

function isBusinessDay(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6 && !isLithuanianPublicHoliday(date);
}

function businessDaysBetween(start: string, end: string) {
  const dates = dateRange(start, end);

  return dates.filter((date) => {
    const current = new Date(`${date}T00:00:00`);
    return isBusinessDay(current);
  }).length;
}

function isScheduledWorkEntry(entry: {
  status?: string | null;
  start_datetime?: string | null;
  end_datetime?: string | null;
}) {
  const status = String(entry.status || "").trim().toLowerCase();

  if (status.startsWith("absence_")) return false;
  if (["off", "free", "poilsis", "laisva", "holiday", "svente", "šventė"].includes(status)) return false;
  if (entry.start_datetime && entry.end_datetime) return true;
  if (["work", "p", "d", "dirba"].includes(status)) return true;

  return false;
}

function daysBetween(start: string, end: string) {
  if (!start || !end) return 0;
  return businessDaysBetween(start, end);
}

function dateRange(start: string, end: string) {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);

  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return days;

  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function employeeName(employee?: EmployeeRow | null) {
  const full = String(employee?.full_name || "").trim();
  if (full) return full;

  const parts = [employee?.first_name, employee?.last_name].map((item) => String(item || "").trim()).filter(Boolean);
  if (parts.length) return parts.join(" ");

  return employee?.email || "Darbuotojas";
}

function vacationEntitlement(employee?: EmployeeRow | null) {
  const roleText = `${employee?.position || ""} ${employee?.department || ""}`.toLowerCase();

  if (
    roleText.includes("slaug") ||
    roleText.includes("social") ||
    roleText.includes("individualios priežiūros") ||
    roleText.includes("individualios prieziuros")
  ) {
    return 30;
  }

  return 20;
}

function normalizeIsoDateInput(value?: string | null) {
  const raw = String(value || "").trim();

  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (slash) {
    const [, day, month, year] = slash;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return raw;
}

function getReadableError(error: unknown) {
  if (!error) return "Nepavyko atlikti veiksmo.";
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message || "Nepavyko atlikti veiksmo.");
  return "Nepavyko atlikti veiksmo.";
}

function parseNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : null;
}


export default function RequestsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | RequestStatus>("all");
  const [type, setType] = useState<"all" | RequestKind>("all");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("employee");
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [vacationEntitlements, setVacationEntitlements] = useState<VacationEntitlementDbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

  const isAdmin =
    currentUserRole === "owner" ||
    currentUserRole === "admin" ||
    currentUserRole === "director" ||
    currentUserRole === "hr";

  useEffect(() => {
    void loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function employeeById(id?: string | null) {
    return employees.find((employee) => employee.user_id === id) || null;
  }

  function mapDbRequest(row: VacationDbRow, employeeList = employees): RequestRow {
    const employee = employeeList.find((item) => item.user_id === row.employee_id);
    const meta = requestKindMeta(row.type);
    const requestedDays = isTemporaryKind(meta.kind) ? 0 : row.requested_days || daysBetween(row.start_date, row.end_date);
    const amount = isTemporaryKind(meta.kind) ? "Trumpas išvykimas" : `${requestedDays} d.`;

    return {
      id: row.id,
      employeeId: row.employee_id,
      employeeEmail: employee?.email,
      employee: employeeName(employee),
      position: employee?.position || "Darbuotojas",
      kind: meta.kind,
      kindLabel: meta.label,
      code: meta.code,
      start: row.start_date,
      end: row.end_date || row.start_date,
      amount,
      requestedDays,
      status: normalizeStatus(row.status),
      balance: isTemporaryKind(meta.kind) ? "Likutis nekeičiamas" : "Likutis skaičiuojamas pagal patvirtintas atostogas",
      risk: normalizeStatus(row.status) === "submitted" ? "Laukia sprendimo" : "—",
      note: row.note || "—",
      rejectionReason: row.rejection_reason || null,
      createdAt: row.created_at,
    };
  }

  async function loadPage() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);
      setCurrentUserEmail(user.email || null);

      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id, role, position, department, user_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (membershipError) throw membershipError;

      const orgId = String(membership?.organization_id || "");
      const role = String(membership?.role || "employee").toLowerCase();

      setOrganizationId(orgId || null);
      setCurrentUserRole(role);

      const { data: members, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id, role, position, department")
        .eq("organization_id", orgId)
        .eq("is_active", true);

      if (membersError) throw membersError;

      const memberRows = (members || []) as EmployeeRow[];
      const profileIds = memberRows.map((member) => member.user_id).filter(Boolean);

      let profiles: EmployeeRow[] = [];

      if (profileIds.length) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name, full_name")
          .in("id", profileIds);

        profiles = ((profileData || []) as Array<EmployeeRow & { id?: string }>).map((profile) => ({
          user_id: String(profile.id || profile.user_id),
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          full_name: profile.full_name,
        }));
      }

      const mergedEmployees = memberRows.map((member) => {
        const profile = profiles.find((item) => item.user_id === member.user_id);

        return {
          ...member,
          email: profile?.email || member.email || null,
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null,
          full_name: profile?.full_name || null,
        };
      });

      setEmployees(mergedEmployees);
      setSelectedEmployeeId((previous) => previous || user.id);
      setForm((previous) => ({ ...previous, employeeId: previous.employeeId || user.id }));

      const { data: vacationData, error: vacationError } = await supabase
        .from("vacation_requests")
        .select("id, organization_id, employee_id, type, start_date, end_date, status, requested_days, note, rejection_reason, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (vacationError) throw vacationError;

      const { data: entitlementData, error: entitlementError } = await supabase
        .from("vacation_entitlements")
        .select("employee_id, year, annual_days, entitlement_days, carried_over_days, used_days, reserved_days, remaining_days, is_active")
        .eq("organization_id", orgId);

      if (!entitlementError) {
        const currentYear = new Date().getFullYear();
        setVacationEntitlements(
          ((entitlementData || []) as VacationEntitlementDbRow[]).filter(
            (row) =>
              row.is_active !== false &&
              (!row.year || Number(row.year) === currentYear),
          ),
        );
      } else {
        setVacationEntitlements([]);
      }

      setRequests(((vacationData || []) as VacationDbRow[]).map((row) => mapDbRequest(row, mergedEmployees)));
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setLoading(false);
    }
  }

  const visibleRequests = useMemo(() => {
    if (isAdmin) return requests;

    const normalizedEmail = String(currentUserEmail || "").toLowerCase();
    const normalizedUserId = String(currentUserId || "");

    return requests.filter(
      (request) =>
        request.employeeId === normalizedUserId ||
        String(request.employeeEmail || "").toLowerCase() === normalizedEmail,
    );
  }, [currentUserEmail, currentUserId, isAdmin, requests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return visibleRequests.filter((request) => {
      const haystack = [
        request.employee,
        request.position,
        request.kindLabel,
        request.code,
        request.note,
        request.status,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!q || haystack.includes(q)) &&
        (status === "all" || request.status === status) &&
        (type === "all" || request.kind === type)
      );
    });
  }, [query, status, type, visibleRequests]);

  const balances = useMemo<VacationBalanceRow[]>(() => {
    const sourceEmployees = isAdmin
      ? employees
      : employees.filter((employee) => employee.user_id === currentUserId);
    const currentYear = new Date().getFullYear();
    const entitlementMap = new Map(
      vacationEntitlements.map((row) => [
        `${row.employee_id}:${Number(row.year || currentYear)}`,
        row,
      ]),
    );

    function entitlementFor(employeeId: string) {
      return (
        entitlementMap.get(`${employeeId}:${currentYear}`) ||
        vacationEntitlements.find((row) => row.employee_id === employeeId) ||
        null
      );
    }

    return sourceEmployees.map((employee) => {
      const entitlement = entitlementFor(employee.user_id);
      const employeeRequests = requests.filter(
        (request) => request.employeeId === employee.user_id && isAnnualKind(request.kind),
      );

      const localUsed = employeeRequests
        .filter((request) => request.status === "approved")
        .reduce((sum, request) => sum + request.requestedDays, 0);
      const localReserved = employeeRequests
        .filter((request) => (request.status === "submitted" || request.status === "pending"))
        .reduce((sum, request) => sum + request.requestedDays, 0);

      const baseAnnual =
        parseNumber(entitlement?.annual_days) ??
        parseNumber(entitlement?.entitlement_days) ??
        vacationEntitlement(employee);
      const carriedOver = parseNumber(entitlement?.carried_over_days) ?? 0;
      const annualTotal = baseAnnual + carriedOver;
      const annualUsed = parseNumber(entitlement?.used_days) ?? localUsed;
      const annualReserved = parseNumber(entitlement?.reserved_days) ?? localReserved;
      const availableLeft =
        parseNumber(entitlement?.remaining_days) ??
        Math.max(0, annualTotal - annualUsed - annualReserved);

      return {
        employeeId: employee.user_id,
        employeeEmail: employee.email,
        employee: employeeName(employee),
        position: employee.position || "Darbuotojas",
        annualTotal,
        annualUsed,
        annualReserved,
        // remaining_days DB jau yra po used_days ir reserved_days, todėl rezervuotos dienos neatimamos antrą kartą.
        annualLeft: Math.max(0, availableLeft),
      };
    });
  }, [currentUserId, employees, isAdmin, requests, vacationEntitlements]);

  const filteredBalances = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();

    return balances.filter((row) => {
      const haystack = [row.employee, row.position, row.employeeEmail].join(" ").toLowerCase();
      return !search || haystack.includes(search);
    });
  }, [balances, employeeSearch]);

  const selectedBalance =
    (employeeSearch.trim() ? filteredBalances[0] : null) ||
    balances.find((row) => row.employeeId === selectedEmployeeId) ||
    balances[0] ||
    null;

  const submitted = visibleRequests.filter((request) => (request.status === "submitted" || request.status === "pending")).length;
  const approved = visibleRequests.filter((request) => request.status === "approved").length;
  const rejected = visibleRequests.filter((request) => request.status === "rejected").length;
  const total = visibleRequests.length;

  const history = visibleRequests
    .filter((request) => request.status === "approved" || request.status === "rejected" || request.status === "canceled")
    .slice()
    .sort((a, b) => String(b.createdAt || b.start).localeCompare(String(a.createdAt || a.start)));

  const historyFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return history.filter((request) => {
      const haystack = [
        request.employee,
        request.position,
        request.kindLabel,
        request.code,
        request.note,
        request.status,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!q || haystack.includes(q)) &&
        (status === "all" || request.status === status) &&
        (type === "all" || request.kind === type)
      );
    });
  }, [history, query, status, type]);

  function currentEmployeeName() {
    const employee = employeeById(isAdmin ? form.employeeId : currentUserId);
    return employeeName(employee) || currentUserEmail || "Mano prašymas";
  }

  function currentEmployeePosition() {
    return employeeById(isAdmin ? form.employeeId : currentUserId)?.position || "Darbuotojas";
  }

  async function countRequestDays(
    employeeId: string,
    kind: RequestKind,
    start: string,
    end: string,
  ) {
    void employeeId;

    if (isTemporaryKind(kind)) return 0;

    return daysBetween(start, end);
  }

  function startEditRequest(request: RequestRow) {
    if (request.status !== "submitted" && request.status !== "pending") {
      setMessage("Redaguoti galima tik laukiantį prašymą.");
      return;
    }

    setEditingRequestId(request.id);
    setForm({
      employeeId: request.employeeId,
      kind: request.kind,
      start: normalizeIsoDateInput(request.start),
      end: normalizeIsoDateInput(request.end),
      note: request.note === "—" ? "" : request.note,
    });

    setMessage("Redaguojamas laukiantis prašymas. Pakeisk datas ar pastabą ir spausk „Išsaugoti“.");
  }

  function cancelEditRequest() {
    setEditingRequestId(null);
    setForm(EMPTY_FORM);
    setMessage("");
  }

  async function submitRequest() {
    if (!organizationId || !currentUserId) return;

    const employeeId = isAdmin ? form.employeeId : currentUserId;

    if (!employeeId) {
      setMessage("Pasirink darbuotoją.");
      return;
    }

    const startDate = normalizeIsoDateInput(form.start);
    const endDate = normalizeIsoDateInput(form.end);

    if (!startDate || !endDate) {
      setMessage("Nurodyk pradžios ir pabaigos datą formatu YYYY-MM-DD.");
      return;
    }

    if (endDate < startDate) {
      setMessage("Pabaigos data negali būti ankstesnė už pradžios datą.");
      return;
    }

    const meta = requestKindMeta(form.kind);
    const requestedDays = await countRequestDays(employeeId, form.kind, startDate, endDate);

    if (isAnnualKind(form.kind) && requestedDays < 1) {
      setMessage(
        "Pasirinktame laikotarpyje nėra darbo dienų.",
      );
      return;
    }

    if (isAnnualKind(form.kind) && requestedDays <= 0) {
      setMessage("Pasirinktame laikotarpyje nėra darbo dienų.");
      return;
    }

    const noteParts = [];

    if (form.note.trim()) noteParts.push(form.note.trim());

    setSaving(true);
    setMessage("");

    try {
      const payload = {
        organization_id: organizationId,
        employee_id: employeeId,
        type: form.kind,
        start_date: startDate,
        end_date: isTemporaryKind(form.kind) ? startDate : endDate,
        requested_days: requestedDays,
        note: noteParts.length ? noteParts.join(" · ") : null,
        status: "submitted",
      };

      const requestQuery = editingRequestId
        ? supabase
            .from("vacation_requests")
            .update(payload)
            .eq("id", editingRequestId)
            .eq("employee_id", employeeId)
            .in("status", ["submitted", "pending"])
            .select("id, organization_id, employee_id, type, start_date, end_date, status, requested_days, note, rejection_reason, created_at")
            .single()
        : supabase
            .from("vacation_requests")
            .insert(payload)
            .select("id, organization_id, employee_id, type, start_date, end_date, status, requested_days, note, rejection_reason, created_at")
            .single();

      const { data, error } = await requestQuery;

      if (error) throw error;

      const saved = mapDbRequest(data as VacationDbRow, employees);

      setRequests((previous) =>
        editingRequestId
          ? previous.map((item) => (item.id === editingRequestId ? saved : item))
          : [saved, ...previous],
      );
      setForm((previous) => ({
        ...previous,
        kind: "annual_leave",
        start: new Date().toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
        note: "",
      }));
      setStatus("submitted");
      setEditingRequestId(null);
      setMessage(editingRequestId ? "Prašymas atnaujintas." : isAdmin ? "Prašymas pateiktas." : "Prašymas pateiktas vadovo sprendimui.");

      if (isAnnualKind(form.kind)) {
        await recalculateVacationEntitlement(employeeId);
        await loadPage();
      }
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function recalculateVacationEntitlement(employeeId: string) {
    if (!organizationId) return;

    const currentYear = new Date().getFullYear();
    const { data: entitlementRows } = await supabase
      .from("vacation_entitlements")
      .select("employee_id, year, annual_days, entitlement_days, carried_over_days, used_days, reserved_days, remaining_days, is_active")
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId);

    const entitlement = ((entitlementRows || []) as VacationEntitlementDbRow[]).find(
      (row) => !row.year || Number(row.year) === currentYear,
    );

    const { data: requestRows, error: requestError } = await supabase
      .from("vacation_requests")
      .select("status, requested_days, type, start_date")
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId);

    if (requestError) throw requestError;

    const annualRows = ((requestRows || []) as Array<{
      status: string | null;
      requested_days: number | null;
      type: string | null;
      start_date: string | null;
    }>).filter((row) => {
      if (!isAnnualKind(row.type) || !row.start_date) return false;
      return new Date(`${row.start_date}T00:00:00`).getFullYear() === currentYear;
    });

    const usedDays = annualRows
      .filter((row) => normalizeStatus(row.status) === "approved")
      .reduce((sum, row) => sum + Number(row.requested_days || 0), 0);
    const reservedDays = annualRows
      .filter((row) => normalizeStatus(row.status) === "submitted")
      .reduce((sum, row) => sum + Number(row.requested_days || 0), 0);

    if (entitlement) {
      const { error } = await supabase
        .from("vacation_entitlements")
        .update({
          used_days: usedDays,
          reserved_days: reservedDays,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId)
        .eq("employee_id", employeeId)
        .eq("year", entitlement.year || currentYear);

      if (error) {
        console.warn("[requests] Nepavyko perskaičiuoti atostogų likučio", error);
      }
    }

    setVacationEntitlements((previous) => {
      const exists = previous.some((row) => row.employee_id === employeeId);

      if (!exists) return previous;

      return previous.map((row) =>
        row.employee_id === employeeId && (!row.year || Number(row.year) === currentYear)
          ? { ...row, used_days: usedDays, reserved_days: reservedDays }
          : row,
      );
    });
  }

  async function updateRequestStatus(id: string, nextStatus: RequestStatus) {
    setSaving(true);
    setMessage("");

    try {
      const request = requests.find((item) => item.id === id);

      if (!request) return;

      const ownsRequest =
        request.employeeId === currentUserId ||
        String(request.employeeEmail || "").toLowerCase() ===
          String(currentUserEmail || "").toLowerCase();

      if (!isAdmin && nextStatus !== "canceled") {
        throw new Error("Darbuotojas gali tik atšaukti savo laukiantį prašymą.");
      }

      if (!isAdmin && !ownsRequest) {
        throw new Error("Galite atšaukti tik savo prašymą.");
      }

      if (nextStatus === "canceled" && request.status !== "submitted") {
        throw new Error("Galima atšaukti tik laukiantį prašymą.");
      }

      if (nextStatus === "approved" || nextStatus === "rejected") {
        throw new Error("Tvirtinimas ir atmetimas vykdomi HR / admin atostogų modulyje.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/team/vacation-requests/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json?.error || "Nepavyko atšaukti prašymo.");
      }

      setMessage("Prašymas atšauktas.");
      await loadPage();
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f6f4] px-4 pb-24 pt-4 text-[#10251f] sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
      <div className="mx-auto max-w-7xl space-y-5 lg:space-y-7">
        <section className="overflow-hidden rounded-[30px] border border-emerald-900/10 bg-white shadow-[0_16px_45px_rgba(16,37,31,0.14)]">
          <div className="flex flex-col gap-6 bg-[#486b5d] p-7 text-white lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] bg-[#e8f7ef] text-[#486b5d]">
                <Umbrella className="h-7 w-7" />
              </div>

              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-100/80">
                  Prašymai
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
                  {isAdmin ? "Prašymai ir neatvykimai" : "Pateikti prašymai"}
                </h1>
                <p className="mt-3 max-w-4xl text-base font-semibold leading-7 text-white/85">
                  {isAdmin
                    ? "Atostogos, trumpi išvykimai, mamadieniai, tėvadieniai, nedarbingumas ir mokymai vienoje vietoje."
                    : "Čia rodomi tik tavo paties atostogų, trumpų išvykimų ir kitų neatvykimų prašymai."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadPage()}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-[18px] bg-[#e8f7ef] px-5 text-sm font-black text-[#486b5d] transition hover:bg-white"
            >
              <RefreshCw className="h-4 w-4" />
              Atnaujinti
            </button>
          </div>

          <div className="grid gap-3 bg-[#eef4f1] p-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard title="Laukia" value={submitted} desc="Reikia sprendimo" tone="amber" />
            <SummaryCard title="Patvirtinta" value={approved} desc="Aktyvūs / istoriniai" tone="emerald" />
            <SummaryCard title="Atmesta" value={rejected} desc="Neaktyvūs prašymai" tone="rose" />
            <SummaryCard title="Viso" value={total} desc={isAdmin ? "Prašymų registre" : "Mano registre"} tone="slate" />
          </div>
        </section>

        {message ? (
          <div className="rounded-[22px] border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-extrabold text-amber-900">
            {message}
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[420px_1fr]">
          <article className="rounded-[30px] border border-[#dbe6e0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.10)] sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">Likutis</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Atostogų likutis</h2>
            <p className="mt-1 text-sm font-semibold text-[#526174]">
              {isAdmin ? "Pasirink darbuotoją paieškoje." : "Tavo kasmetinių atostogų likutis."}
            </p>

            {isAdmin ? (
              <label className="mt-5 flex h-12 items-center gap-3 rounded-[16px] border border-[#dbe6e0] bg-white px-4">
                <Search className="h-4 w-4 text-[#8ea0b5]" />
                <input
                  value={employeeSearch}
                  onChange={(event) => {
                    setEmployeeSearch(event.target.value);
                  }}
                  placeholder="Ieškoti darbuotojo..."
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#10251f] outline-none placeholder:text-[#8ea0b5]"
                />
              </label>
            ) : null}

            {isAdmin ? (
              <div className="mt-3 rounded-[18px] border border-[#dbe6e0] bg-[#f8faf8] px-4 py-3">
                {employeeSearch.trim() && !selectedBalance ? (
                  <p className="text-sm font-black text-rose-700">Darbuotojo pagal paiešką nerasta.</p>
                ) : (
                  <>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8ea0b5]">Rodomas darbuotojas</p>
                    <p className="mt-1 text-base font-black text-[#10251f]">{selectedBalance?.employee || "Pasirink darbuotoją"}</p>
                  </>
                )}
              </div>
            ) : null}

            <div className="mt-5 rounded-[24px] bg-[#eef4f1] p-5">
              <p className="text-sm font-black text-[#486b5d]">{selectedBalance?.employee || "Darbuotojas"}</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-[#526174]">Liko naudoti</p>
                  <p className="mt-1 text-5xl font-black tracking-[-0.06em] text-[#10251f]">{selectedBalance?.annualLeft ?? 0}</p>
                </div>
                <p className="pb-1 text-sm font-black text-[#526174]">d. d.</p>
              </div>

              <div className="mt-5 divide-y divide-[#dbe6e0] overflow-hidden rounded-[18px] bg-white">
                <BalanceLine label="Sukaupta" value={`${selectedBalance?.annualTotal ?? 0} d.`} />
                <BalanceLine label="Panaudota" value={`${selectedBalance?.annualUsed ?? 0} d.`} />
                <BalanceLine label="Rezervuota" value={`${selectedBalance?.annualReserved ?? 0} d.`} />
              </div>
            </div>
          </article>

          <article className="rounded-[30px] border border-[#dbe6e0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.10)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">Prašymai</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">"Mano prašymai"</h2>
                <p className="mt-1 text-sm font-semibold text-[#526174]">Čia matai būseną ir gali atšaukti laukiantį įrašą.</p>
              </div>
              <Umbrella className="h-6 w-6 text-[#486b5d]" />
            </div>

            <div className="mt-5 overflow-hidden rounded-[22px] border border-[#dbe6e0]">
              <table className="w-full border-collapse bg-white text-left">
                <thead className="bg-[#f8faf8]">
                  <tr>
                    <TableHead>Darbuotojas</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipas</TableHead>
                    <TableHead>Kiekis</TableHead>
                    <TableHead>Statusas</TableHead>
                    <TableHead>Veiksmai</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {visibleRequests.length ? (
                    visibleRequests.slice(0, 6).map((request) => (
                      <tr key={`active-request-${request.id}`} className="border-t border-[#eef2ef]">
                        <td className="px-5 py-4 text-sm font-black text-[#10251f]">{request.employee}</td>
                        <td className="px-5 py-4 text-sm font-black text-[#526174]">{request.start}</td>
                        <td className="px-5 py-4 text-sm font-black text-[#10251f]">{request.kindLabel}</td>
                        <td className="px-5 py-4 text-sm font-black text-[#10251f]">{request.amount}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${statusClass(request.status)}`}>
                            {statusIcon(request.status)}
                            {statusLabel(request.status)}
                          </span>
                          {request.status === "rejected" && request.rejectionReason ? (
                            <p className="mt-2 max-w-xs text-xs font-bold text-rose-700">
                              Priežastis: {request.rejectionReason}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-4">
                          {(request.status === "submitted" || request.status === "pending") ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => startEditRequest(request)}
                                className="rounded-[14px] bg-white px-4 py-2 text-sm font-black text-[#486b5d] ring-1 ring-[#dbe6e0] disabled:opacity-60"
                              >
                                Redaguoti
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void updateRequestStatus(request.id, "canceled")}
                                className="rounded-[14px] bg-[#eef4f1] px-4 py-2 text-sm font-black text-[#486b5d] disabled:opacity-60"
                              >
                                Atšaukti
                              </button>
                            </div>
                          ) : (
                            <span className="font-black text-[#8ea0b5]">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm font-bold text-[#526174]">
                        Įrašų dar nėra.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="rounded-[30px] border border-[#dbe6e0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.10)] sm:p-6 lg:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">Naujas prašymas</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight lg:text-3xl">{editingRequestId ? "Redaguoti prašymą" : "Pateikti prašymą"}</h2>
              <p className="mt-1 font-semibold text-[#526174]">
                {editingRequestId ? "Keiti jau pateiktą laukiantį prašymą. Išsaugojus jis liks laukti vadovo sprendimo." : "Užpildyk prašymo informaciją ir pateik vadovui tvirtinti."}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_1fr_150px_150px_1fr_auto]">
            <select
              value={isAdmin ? form.employeeId : currentUserId || form.employeeId}
              disabled={!isAdmin}
              onChange={(event) => setForm((previous) => ({ ...previous, employeeId: event.target.value }))}
              className="h-12 rounded-[16px] border border-[#dbe6e0] bg-white px-4 text-sm font-bold text-[#10251f] disabled:bg-[#eef4f1] disabled:text-[#486b5d]"
            >
              {isAdmin ? (
                <>
                  <option value="">Pasirinkti darbuotoją</option>
                  {employees.map((employee) => (
                    <option key={employee.user_id} value={employee.user_id}>
                      {employeeName(employee)} · {employee.position || "Darbuotojas"}
                    </option>
                  ))}
                </>
              ) : (
                <option value={currentUserId || form.employeeId}>Mano prašymas</option>
              )}
            </select>
            <select
              value={form.kind}
              onChange={(event) => setForm((previous) => ({ ...previous, kind: event.target.value as RequestKind }))}
              className="h-12 rounded-[16px] border border-[#dbe6e0] bg-white px-4 text-sm font-bold text-[#10251f]"
            >
              <option value="annual_leave">Kasmetinės atostogos (A)</option>
              <option value="temporary_leave">Trumpas išvykimas (TI)</option>
              <option value="mamadienis">Mamadienis (MD)</option>
              <option value="tevadienis">Tėvadienis (TD)</option>
              <option value="sick_leave">Nedarbingumas (L)</option>
              <option value="training">Mokymai / komandiruotė (K)</option>
            </select>
            <input
              type="text"
              placeholder="YYYY-MM-DD"
              inputMode="numeric"
              value={form.start}
              onChange={(event) => setForm((previous) => ({ ...previous, start: event.target.value, end: previous.end || event.target.value }))}
              className="h-12 rounded-[16px] border border-[#dbe6e0] bg-white px-4 text-sm font-bold text-[#10251f]"
            />
            <input
              type="text"
              placeholder="YYYY-MM-DD"
              inputMode="numeric"
              value={form.end}
              onChange={(event) => setForm((previous) => ({ ...previous, end: event.target.value }))}
              disabled={form.kind === "temporary_leave"}
              className="h-12 rounded-[16px] border border-[#dbe6e0] bg-white px-4 text-sm font-bold text-[#10251f] disabled:bg-[#eef4f1]"
            />
            <input
              value={form.note}
              onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))}
              placeholder="Pastaba"
              className="h-12 rounded-[16px] border border-[#dbe6e0] bg-white px-4 text-sm font-bold text-[#10251f]"
            />
            <button
              type="button"
              onClick={() => void submitRequest()}
              disabled={saving || (isAdmin && !form.employeeId)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] bg-[#10251f] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#8ea0b5]"
            >
              {editingRequestId ? "Išsaugoti" : "Pateikti"}
            </button>
            {editingRequestId ? (
              <button
                type="button"
                onClick={cancelEditRequest}
                className="inline-flex h-12 items-center justify-center rounded-[16px] bg-[#eef4f1] px-5 text-sm font-black text-[#486b5d]"
              >
                Atšaukti redagavimą
              </button>
            ) : null}
          </div>
        </section>

        <section className="rounded-[30px] border border-[#dbe6e0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.10)] sm:p-6 lg:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#8ea0b5]">Istorija</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight lg:text-3xl">Istorija</h2>
              <p className="mt-1 font-semibold text-[#526174]">Patvirtinti, atmesti ir atšaukti įrašai.</p>
            </div>
            <div className="rounded-[18px] bg-[#eef4f1] px-4 py-3 text-sm font-black text-[#486b5d]">
              {loading ? "Kraunama..." : `${historyFiltered.length} rodoma`}
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
            <label className="flex h-12 items-center gap-3 rounded-[16px] border border-[#dbe6e0] bg-white px-4">
              <Search className="h-4 w-4 text-[#8ea0b5]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ieškoti pagal darbuotoją, tipą, pastabą..."
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#10251f] outline-none placeholder:text-[#8ea0b5]"
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="h-12 rounded-[16px] border border-[#dbe6e0] bg-white px-4 text-sm font-bold text-[#10251f]"
            >
              <option value="all">Visi statusai</option>
              <option value="submitted">Laukia</option>
              <option value="approved">Patvirtinta</option>
              <option value="rejected">Atmesta</option>
              <option value="canceled">Atšaukta</option>
            </select>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as typeof type)}
              className="h-12 rounded-[16px] border border-[#dbe6e0] bg-white px-4 text-sm font-bold text-[#10251f]"
            >
              <option value="all">Visi tipai</option>
              <option value="annual_leave">Atostogos</option>
              <option value="temporary_leave">Trumpi išvykimai</option>
              <option value="mamadienis">Mamadienis</option>
              <option value="tevadienis">Tėvadienis</option>
              <option value="training">Mokymai</option>
            </select>
            <button
              onClick={() => {
                setQuery("");
                setStatus("all");
                setType("all");
              }}
              className="h-12 rounded-[16px] bg-[#eef4f1] px-5 text-sm font-black text-[#486b5d]"
            >
              Valyti
            </button>
          </div>

          {historyFiltered.length ? (
            <>
              <div className="mt-6 hidden overflow-hidden rounded-[24px] border border-[#dbe6e0] lg:block">
                <table className="w-full border-collapse bg-white text-left">
                  <thead className="bg-[#f8faf8]">
                    <tr>
                      <TableHead>Darbuotojas</TableHead>
                      <TableHead>Tipas</TableHead>
                      <TableHead>Laikotarpis</TableHead>
                      <TableHead>Kiekis</TableHead>
                      <TableHead>Likutis / rizika</TableHead>
                      <TableHead>Statusas</TableHead>
                      <TableHead>Veiksmai</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {historyFiltered.map((request) => (
                      <RequestTableRow
                        key={request.id}
                        request={request}
                        isAdmin={isAdmin}
                        saving={saving}
                        onApprove={() => void updateRequestStatus(request.id, "approved")}
                        onReject={() => void updateRequestStatus(request.id, "rejected")}
                        onCancel={() => void updateRequestStatus(request.id, "canceled")}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 space-y-3 lg:hidden">
                {historyFiltered.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    isAdmin={isAdmin}
                    onApprove={() => void updateRequestStatus(request.id, "approved")}
                    onReject={() => void updateRequestStatus(request.id, "rejected")}
                    onCancel={() => void updateRequestStatus(request.id, "canceled")}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-[22px] border border-dashed border-[#c9d8d0] bg-[#f8faf8] p-8 text-center">
              <p className="text-lg font-black text-[#10251f]">
                Istorijos įrašų pagal filtrą nėra
              </p>
              <p className="mt-2 text-sm font-semibold text-[#526174]">
                Pakeisk filtrus arba paiešką.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function BalanceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm font-black uppercase tracking-[0.14em] text-[#526174]">{label}</span>
      <span className="text-base font-black text-[#10251f]">{value}</span>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  desc,
  tone,
}: {
  title: string;
  value: number;
  desc: string;
  tone: "emerald" | "amber" | "rose" | "slate";
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-50 text-slate-700",
  }[tone];

  return (
    <article className="flex items-center gap-4 rounded-[22px] border border-[#dbe6e0] bg-white p-5 shadow-sm">
      <div className={`flex h-14 w-14 items-center justify-center rounded-[18px] ${toneClass}`}>
        {tone === "emerald" ? <CheckCircle2 className="h-5 w-5" /> : tone === "rose" ? <AlertTriangle className="h-5 w-5" /> : tone === "amber" ? <Clock3 className="h-5 w-5" /> : <Umbrella className="h-5 w-5" />}
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#526174]">{title}</p>
        <p className="mt-1 text-4xl font-black tracking-[-0.05em] text-[#10251f]">{value}</p>
        <p className="text-sm font-bold text-[#526174]">{desc}</p>
      </div>
    </article>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-[#526174]">
      {children}
    </th>
  );
}

function RequestTableRow({
  request,
  isAdmin,
  saving,
  onApprove,
  onReject,
  onCancel,
}: {
  request: RequestRow;
  isAdmin: boolean;
  saving: boolean;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  return (
    <tr className="border-t border-[#eef2ef]">
      <td className="px-5 py-4">
        <div className="font-black text-[#10251f]">{request.employee}</div>
        <div className="mt-1 text-sm font-semibold text-[#526174]">{request.position}</div>
      </td>
      <td className="px-5 py-4">
        <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-950">
          {request.kindLabel} · {request.code}
        </span>
      </td>
      <td className="px-5 py-4 text-sm font-extrabold text-[#526174]">{request.start} – {request.end}</td>
      <td className="px-5 py-4 text-sm font-black text-[#10251f]">{request.amount}</td>
      <td className="px-5 py-4">
        <div className="font-black text-[#10251f]">{request.balance}</div>
        <div className="mt-1 text-sm font-semibold text-[#526174]">
          {request.status === "rejected" && request.rejectionReason
            ? `Atmetimo priežastis: ${request.rejectionReason}`
            : request.risk}
        </div>
      </td>
      <td className="px-5 py-4">
        <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black ${statusClass(request.status)}`}>
          {statusIcon(request.status)}
          {statusLabel(request.status)}
        </span>
      </td>
      <td className="px-5 py-4">
        {(request.status === "submitted" || request.status === "pending") ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-black text-[#526174]">Laukia vadovo sprendimo</span>
            <button disabled={saving} type="button" onClick={onCancel} className="w-fit rounded-[14px] bg-[#eef4f1] px-4 py-2 text-sm font-black text-[#486b5d] disabled:opacity-60">
              Atšaukti
            </button>
          </div>
        ) : (
          <span className="font-black text-[#8ea0b5]">—</span>
        )}
      </td>
    </tr>
  );
}

function RequestCard({
  request,
  isAdmin,
  onApprove,
  onReject,
  onCancel,
}: {
  request: RequestRow;
  isAdmin: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
}) {
  return (
    <article className="rounded-[22px] border border-[#dbe6e0] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-[#10251f]">{request.employee}</h3>
          <p className="text-sm font-semibold text-[#526174]">{request.position}</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${statusClass(request.status)}`}>
          {statusIcon(request.status)}
          {statusLabel(request.status)}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold text-[#526174]">
        <span className="rounded-full bg-[#f8faf8] px-3 py-1.5">{request.kindLabel} · {request.code}</span>
        <span className="rounded-full bg-[#f8faf8] px-3 py-1.5">{request.start} – {request.end}</span>
        <span className="rounded-full bg-[#f8faf8] px-3 py-1.5">{request.amount}</span>
      </div>
      <p className="mt-4 text-sm font-semibold text-[#526174]">{request.note}</p>
      {request.status === "rejected" && request.rejectionReason ? (
        <p className="mt-3 rounded-[14px] bg-rose-50 px-4 py-3 text-sm font-black text-rose-800">
          Atmetimo priežastis: {request.rejectionReason}
        </p>
      ) : null}
      {(request.status === "submitted" || request.status === "pending") ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-[14px] bg-amber-50 px-4 py-2 text-sm font-black text-amber-700">
            Laukia vadovo sprendimo
          </span>
          {onCancel ? (
            <button type="button" onClick={onCancel} className="rounded-[14px] bg-[#eef4f1] px-4 py-2 text-sm font-black text-[#486b5d]">
              Atšaukti
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
