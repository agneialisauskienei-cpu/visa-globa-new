"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type PanelKey =
  | "overview"
  | "requests"
  | "tasks"
  | "notifications"
  | "residents"
  | "documents"
  | "trainings"
  | "profile";

type EmployeeTask = {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  created_at?: string | null;
};

type EmployeeSchedule = {
  id: string;
  shift_date?: string | null;
  date?: string | null;
  work_date?: string | null;
  schedule_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  department?: string | null;
  position?: string | null;
  status?: string | null;
  is_published?: boolean | null;
};

type NotificationRow = {
  id: string;
  title?: string | null;
  message?: string | null;
  body?: string | null;
  type?: string | null;
  is_read?: boolean | null;
  read_at?: string | null;
  created_at?: string | null;
};

type VacationRequestRow = {
  id: string;
  organization_id?: string | null;
  employee_id?: string | null;
  type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  requested_days?: number | string | null;
  note?: string | null;
  rejection_reason?: string | null;
  created_at?: string | null;
};

type VacationRequestForm = {
  type: string;
  startDate: string;
  endDate: string;
  note: string;
};

type TrainingRow = {
  id: string;
  title?: string | null;
  training_name?: string | null;
  name?: string | null;
  completed_at?: string | null;
  valid_until?: string | null;
  expires_at?: string | null;
  hours?: number | string | null;
  status?: string | null;
};

type AssignedResident = {
  id: string;
  resident_id?: string | null;
  resident_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  first_name_encrypted?: string | null;
  last_name_encrypted?: string | null;
  room_name?: string | null;
  current_room_id?: string | null;
  current_status?: string | null;
  care_level?: string | null;
  residents?: {
    id?: string | null;
    resident_code?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    first_name_encrypted?: string | null;
    last_name_encrypted?: string | null;
    current_status?: string | null;
    care_level?: string | null;
  } | null;
};

type ProfileRow = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  position?: string | null;
  department?: string | null;
  license_number?: string | null;
  license_until?: string | null;
  health_certificate_until?: string | null;
};

type MembershipRow = {
  id?: string | null;
  organization_id?: string | null;
  position?: string | null;
  department?: string | null;
};

type EmployeeCredentialRow = {
  id: string;
  type?: string | null;
  number?: string | null;
  expires_at?: string | null;
  status?: string | null;
  note?: string | null;
  created_at?: string | null;
};

type Toast = { title: string; message: string };

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return raw || "—";
  return date.toLocaleDateString("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fmtDate(value);
  return date.toLocaleString("lt-LT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function timeOnly(value?: string | null) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 5);
  return date.toLocaleTimeString("lt-LT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getScheduleDate(shift: EmployeeSchedule) {
  return (
    shift.shift_date ||
    shift.date ||
    shift.work_date ||
    shift.schedule_date ||
    ""
  );
}

function getScheduleStart(shift: EmployeeSchedule) {
  return shift.start_time || shift.shift_start || shift.starts_at || "";
}

function getScheduleEnd(shift: EmployeeSchedule) {
  return shift.end_time || shift.shift_end || shift.ends_at || "";
}

function isSchedulePublished(shift: EmployeeSchedule) {
  const status = String(shift.status || "").toLowerCase();
  return (
    shift.is_published === true ||
    ["published", "paskelbta", "approved"].includes(status)
  );
}

function formatShift(shift?: EmployeeSchedule | null) {
  if (!shift) return "Pamainų nerasta";
  const date = fmtDate(getScheduleDate(shift));
  const start = timeOnly(getScheduleStart(shift));
  const end = timeOnly(getScheduleEnd(shift));
  return `${date}${start || end ? ` · ${start || "—"}–${end || "—"}` : ""}`;
}

function taskTitle(task: EmployeeTask) {
  return task.title || task.name || "Užduotis";
}

function residentName(row: AssignedResident) {
  const nested = row.residents || null;
  const first = nested?.first_name || row.first_name || "";
  const last = nested?.last_name || row.last_name || "";
  const encrypted =
    nested?.first_name_encrypted ||
    row.first_name_encrypted ||
    nested?.last_name_encrypted ||
    row.last_name_encrypted;
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || (encrypted ? "Gyventojas" : row.resident_code || "Gyventojas");
}

function normalizeAssignedResident(row: AssignedResident): AssignedResident {
  const nested = row.residents || null;
  return {
    ...row,
    id: String(nested?.id || row.resident_id || row.id),
    resident_code: nested?.resident_code || row.resident_code || null,
    first_name: nested?.first_name || row.first_name || null,
    last_name: nested?.last_name || row.last_name || null,
    first_name_encrypted:
      nested?.first_name_encrypted || row.first_name_encrypted || null,
    last_name_encrypted:
      nested?.last_name_encrypted || row.last_name_encrypted || null,
    current_status: nested?.current_status || row.current_status || null,
    care_level: nested?.care_level || row.care_level || null,
  };
}

function isExpiringSoon(value?: string | null) {
  if (!value) return false;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 45);
  return date <= limit;
}

function readableError(error: unknown) {
  if (!error) return "Nepavyko atlikti veiksmo.";
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const e = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    return (
      [e.message, e.details, e.hint, e.code].filter(Boolean).join(" · ") ||
      "Nepavyko atlikti veiksmo."
    );
  }
  return String(error);
}

function normalizeRequestStatus(value?: string | null) {
  const raw = String(value || "submitted").toLowerCase();
  if (["approved", "confirmed", "patvirtinta"].includes(raw))
    return "approved";
  if (["rejected", "atmesta"].includes(raw)) return "rejected";
  if (["canceled", "cancelled", "atsaukta", "atšaukta"].includes(raw))
    return "canceled";
  if (["pending", "laukiama"].includes(raw)) return "pending";
  return "submitted";
}

function requestStatusLabel(value?: string | null) {
  const status = normalizeRequestStatus(value);
  if (status === "approved") return "Patvirtinta";
  if (status === "rejected") return "Atmesta";
  if (status === "canceled") return "Atšaukta";
  return "Laukia";
}

function requestStatusClass(value?: string | null) {
  const status = normalizeRequestStatus(value);
  if (status === "approved")
    return "border-emerald-100 bg-emerald-50 text-emerald-800";
  if (status === "rejected")
    return "border-rose-100 bg-rose-50 text-rose-800";
  if (status === "canceled")
    return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-amber-100 bg-amber-50 text-amber-800";
}

function requestKindLabel(value?: string | null) {
  const raw = String(value || "annual_leave").toLowerCase();
  if (["temporary_leave", "short_leave", "ti"].includes(raw))
    return "Trumpas išvykimas";
  if (["mamadienis", "mother_day", "md"].includes(raw)) return "Mamadienis";
  if (["tevadienis", "father_day", "td"].includes(raw)) return "Tėvadienis";
  if (["sick", "sick_leave", "nedarbingumas", "l"].includes(raw))
    return "Nedarbingumas";
  if (["training", "business_trip", "komandiruote", "mokymai", "k"].includes(raw))
    return "Mokymai / komandiruotė";
  return "Kasmetinės atostogos";
}

function formatRequestDays(value?: number | string | null) {
  const days = Number(value);
  if (!Number.isFinite(days)) return "—";
  return `${days.toLocaleString("lt-LT", {
    maximumFractionDigits: 2,
  })} d.`;
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateInput(value?: string | null) {
  const raw = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
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

function countBusinessDays(start: string, end: string) {
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  let count = 0;

  while (!Number.isNaN(cursor.getTime()) && cursor <= last) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6 && !isLithuanianPublicHoliday(cursor)) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function credentialTypeKey(value?: string | null) {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("licenc")) return "license";
  if (raw.includes("sveikat")) return "health";
  return raw;
}

function newestCredential(
  credentials: EmployeeCredentialRow[],
  key: "health" | "license",
) {
  return credentials.find((credential) => credentialTypeKey(credential.type) === key);
}

async function safeSelect<T>(
  query: PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const { data, error } = await query;
  if (error) {
    console.warn("[employee-dashboard] query skipped:", readableError(error));
    return [] as T[];
  }
  return data || [];
}

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<PanelKey>("overview");
  const [modal, setModal] = useState<PanelKey | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [schedule, setSchedule] = useState<EmployeeSchedule[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [employeeCredentials, setEmployeeCredentials] = useState<
    EmployeeCredentialRow[]
  >([]);
  const [vacationRequests, setVacationRequests] = useState<
    VacationRequestRow[]
  >([]);
  const [editingVacationRequestId, setEditingVacationRequestId] = useState<
    string | null
  >(null);
  const [vacationRequestMessage, setVacationRequestMessage] = useState("");
  const [vacationRequestForm, setVacationRequestForm] =
    useState<VacationRequestForm>({
      type: "annual_leave",
      startDate: toDateInput(new Date()),
      endDate: toDateInput(new Date()),
      note: "",
    });
  const [trainings, setTrainings] = useState<TrainingRow[]>([]);
  const [assignedResidents, setAssignedResidents] = useState<
    AssignedResident[]
  >([]);
  const [selectedTask, setSelectedTask] = useState<EmployeeTask | null>(null);
  const [saving, setSaving] = useState(false);

  const [contactForm, setContactForm] = useState({
    phone: "",
    email: "",
    address: "",
  });
  const [documentForm, setDocumentForm] = useState({
    healthCertificateUntil: "",
    licenseUntil: "",
    licenseNumber: "",
  });

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`employee-dashboard-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => void loadDashboard(false),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "employee_tasks",
          filter: `assigned_user_id=eq.${userId}`,
        },
        () => void loadDashboard(false),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employee_schedules" },
        () => void loadDashboard(false),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resident_assignments" },
        () => void loadDashboard(false),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function loadEmployeeSchedule(
    currentUserId: string,
    memberId?: string | null,
  ) {
    const today = new Date();
    const in14Days = new Date();
    in14Days.setDate(today.getDate() + 14);
    const todayIso = today.toISOString().slice(0, 10);
    const in14DaysIso = in14Days.toISOString().slice(0, 10);

    const candidates: Array<{ column: string; value: string }> = [
      { column: "user_id", value: currentUserId },
      { column: "assigned_user_id", value: currentUserId },
      { column: "staff_user_id", value: currentUserId },
      { column: "employee_id", value: currentUserId },
    ];

    if (memberId) {
      candidates.push({ column: "organization_member_id", value: memberId });
      candidates.push({ column: "member_id", value: memberId });
      candidates.push({ column: "employee_id", value: memberId });
    }

    for (const candidate of candidates) {
      const { data, error } = await supabase
        .from("employee_schedules")
        .select("*")
        .eq(candidate.column, candidate.value)
        .limit(120);
      if (error) {
        console.warn(
          `[employee-dashboard] schedule skipped ${candidate.column}:`,
          error.message,
        );
        continue;
      }

      const rows = ((data || []) as EmployeeSchedule[])
        .filter(isSchedulePublished)
        .sort((a, b) =>
          `${getScheduleDate(a)} ${getScheduleStart(a)}`.localeCompare(
            `${getScheduleDate(b)} ${getScheduleStart(b)}`,
          ),
        );

      const upcoming = rows
        .filter((shift) => {
          const date = getScheduleDate(shift).slice(0, 10);
          return !date || (date >= todayIso && date <= in14DaysIso);
        })
        .slice(0, 10);
      if (upcoming.length) return upcoming;

      const recent = rows
        .filter((shift) => getScheduleDate(shift).slice(0, 10) < todayIso)
        .slice(-10)
        .reverse();
      if (recent.length) return recent;
    }

    return [] as EmployeeSchedule[];
  }

  async function loadAssignedResidents(
    currentUserId: string,
    memberId?: string | null,
  ) {
    const candidates: Array<{ column: string; value: string }> = [
      { column: "assigned_user_id", value: currentUserId },
      { column: "user_id", value: currentUserId },
      { column: "employee_id", value: currentUserId },
      { column: "staff_user_id", value: currentUserId },
    ];

    if (memberId) {
      candidates.push({ column: "organization_member_id", value: memberId });
      candidates.push({ column: "member_id", value: memberId });
      candidates.push({ column: "employee_id", value: memberId });
    }

    for (const candidate of candidates) {
      const { data, error } = await supabase
        .from("resident_assignments")
        .select("*, residents(*)")
        .eq(candidate.column, candidate.value)
        .limit(30);

      if (error) {
        console.warn(
          `[employee-dashboard] resident assignments skipped ${candidate.column}:`,
          error.message,
        );
        continue;
      }

      const rows = ((data || []) as AssignedResident[]).map(
        normalizeAssignedResident,
      );
      if (rows.length) return rows;
    }

    for (const column of [
      "assigned_user_id",
      "responsible_user_id",
      "employee_id",
      "social_worker_id",
      "nurse_user_id",
    ]) {
      const { data, error } = await supabase
        .from("residents")
        .select("*")
        .eq(column, currentUserId)
        .limit(30);
      if (error) {
        console.warn(
          `[employee-dashboard] residents skipped ${column}:`,
          error.message,
        );
        continue;
      }
      const rows = ((data || []) as AssignedResident[]).map(
        normalizeAssignedResident,
      );
      if (rows.length) return rows;
    }

    return [] as AssignedResident[];
  }

  async function loadSubmittedCredentials(accessToken?: string | null) {
    if (!accessToken) return [] as EmployeeCredentialRow[];

    const response = await fetch("/api/personnel/credentials", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.warn(
        "[employee-dashboard] credentials skipped:",
        await response.text(),
      );
      return [] as EmployeeCredentialRow[];
    }

    const payload = (await response.json()) as {
      credentials?: EmployeeCredentialRow[];
    };
    return payload.credentials || [];
  }

  async function loadDashboard(showLoader = true) {
    if (showLoader) setLoading(true);
    setLoadError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) return;
      setUserId(user.id);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || null;

      const [
        profileData,
        membershipData,
        tasksData,
        notificationsData,
        vacationRequestsData,
        trainingData,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "full_name, first_name, last_name, email, phone, address, license_number, license_until, health_certificate_until",
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("organization_members")
          .select("id, organization_id, position, department")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),
        safeSelect<EmployeeTask>(
          supabase
            .from("employee_tasks")
            .select("*")
            .or(
              `assigned_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`,
            )
            .neq("status", "done")
            .order("due_date", { ascending: true, nullsFirst: false })
            .limit(12),
        ),
        safeSelect<NotificationRow>(
          supabase
            .from("notifications")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(12),
        ),
        safeSelect<VacationRequestRow>(
          supabase
            .from("vacation_requests")
            .select(
              "id, organization_id, employee_id, type, start_date, end_date, status, requested_days, note, rejection_reason, created_at",
            )
            .eq("employee_id", user.id)
            .order("created_at", { ascending: false })
            .limit(10),
        ),
        safeSelect<TrainingRow>(
          supabase
            .from("training_records")
            .select("*")
            .eq("employee_id", user.id)
            .order("valid_until", { ascending: true, nullsFirst: false })
            .limit(10),
        ),
      ]);

      if (profileData.error)
        console.warn(
          "[employee-dashboard] profile:",
          profileData.error.message,
        );
      if (membershipData.error)
        console.warn(
          "[employee-dashboard] membership:",
          membershipData.error.message,
        );

      const memberId = (membershipData.data as MembershipRow | null)?.id || null;
      const currentOrganizationId =
        (membershipData.data as MembershipRow | null)?.organization_id || null;
      const loadedSchedule = await loadEmployeeSchedule(user.id, memberId);
      const loadedResidents = await loadAssignedResidents(user.id, memberId);
      const submittedCredentials = await loadSubmittedCredentials(accessToken);
      const healthCredential = newestCredential(submittedCredentials, "health");
      const licenseCredential = newestCredential(submittedCredentials, "license");

      const mergedProfile: ProfileRow = {
        ...(profileData.data || {}),
        ...(membershipData.data || {}),
        email: profileData.data?.email || user.email || null,
      };

      setOrganizationId(currentOrganizationId);
      setProfile(mergedProfile);
      setTasks(tasksData);
      setNotifications(notificationsData);
      setEmployeeCredentials(submittedCredentials);
      setVacationRequests(vacationRequestsData);
      setSchedule(loadedSchedule);
      setTrainings(trainingData);
      setAssignedResidents(loadedResidents);
      setContactForm({
        phone: mergedProfile.phone || "",
        email: mergedProfile.email || user.email || "",
        address: mergedProfile.address || "",
      });
      setDocumentForm({
        healthCertificateUntil:
          healthCredential?.expires_at ||
          mergedProfile.health_certificate_until ||
          "",
        licenseUntil:
          licenseCredential?.expires_at || mergedProfile.license_until || "",
        licenseNumber:
          licenseCredential?.number || mergedProfile.license_number || "",
      });
    } catch (error) {
      setLoadError(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  function showToast(title: string, message: string) {
    setToast({ title, message });
    window.setTimeout(() => setToast(null), 3500);
  }

  function openPanel(panel: PanelKey) {
    setActivePanel(panel);
    if (panel !== "overview") setModal(panel);
  }

  async function markNotificationsRead() {
    if (!userId) return;
    const unreadIds = notifications
      .filter((item) => !item.is_read && !item.read_at)
      .map((item) => item.id);
    if (unreadIds.length) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in("id", unreadIds);
      if (error)
        console.warn(
          "[employee-dashboard] notifications update failed:",
          error.message,
        );
    }
    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        is_read: true,
        read_at: item.read_at || new Date().toISOString(),
      })),
    );
    showToast(
      "Pranešimai atnaujinti",
      "Visi pranešimai pažymėti kaip perskaityti.",
    );
  }

  async function completeTask(taskId: string) {
    const previous = tasks;
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    showToast("Užduotis įvykdyta", "Užduotis pažymėta kaip atlikta.");

    const { error } = await supabase
      .from("employee_tasks")
      .update({ status: "done" })
      .eq("id", taskId);
    if (error) {
      console.warn("[employee-dashboard] task complete failed:", error.message);
      setTasks(previous);
      showToast(
        "Nepavyko pažymėti",
        "Patikrink, ar RLS leidžia darbuotojui atnaujinti savo užduotį.",
      );
      return;
    }

    void loadDashboard(false);
  }

  async function submitProfileChanges() {
    setSaving(true);
    try {
      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          title: "Kontaktų pakeitimai pateikti",
          message: "Kontaktų pakeitimai laukia administratoriaus patvirtinimo.",
          type: "profile",
          is_read: false,
        });
      }
      showToast(
        "Kontaktai pateikti",
        "Pakeitimai perduoti administratoriui patvirtinti.",
      );
      setModal(null);
    } finally {
      setSaving(false);
    }
  }

  async function submitDocuments() {
    setSaving(true);
    try {
      const credentials = [
        {
          type: "Sveikatos pažyma",
          expires_at: documentForm.healthCertificateUntil,
          note: "Pateikta darbuotojo paskyroje.",
        },
        {
          type: "Profesinė licencija",
          number: documentForm.licenseNumber,
          expires_at: documentForm.licenseUntil,
          note: "Pateikta darbuotojo paskyroje.",
        },
      ].filter((credential) => credential.expires_at || credential.number);

      if (!credentials.length) {
        showToast(
          "Nėra ką pateikti",
          "Įveskite bent vieną dokumento datą arba licencijos numerį.",
        );
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || null;

      const response = await fetch("/api/personnel/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          organization_id: organizationId,
          credentials,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Nepavyko pateikti dokumentų.");
      }

      showToast(
        "Dokumentai pateikti",
        "Pakeitimai perduoti administratoriui patvirtinti.",
      );
      setModal(null);
      await loadDashboard(false);
    } catch (error) {
      showToast("Dokumentų pateikti nepavyko", readableError(error));
    } finally {
      setSaving(false);
    }
  }

  function resetVacationRequestForm() {
    setEditingVacationRequestId(null);
    setVacationRequestMessage("");
    setVacationRequestForm({
      type: "annual_leave",
      startDate: toDateInput(new Date()),
      endDate: toDateInput(new Date()),
      note: "",
    });
  }

  function startEditVacationRequest(request: VacationRequestRow) {
    const status = normalizeRequestStatus(request.status);
    if (status !== "submitted" && status !== "pending") {
      setVacationRequestMessage("Redaguoti galima tik laukiantį prašymą.");
      return;
    }

    const startDate =
      normalizeDateInput(request.start_date) || toDateInput(new Date());
    const endDate = normalizeDateInput(request.end_date) || startDate;

    setEditingVacationRequestId(request.id);
    setVacationRequestForm({
      type: request.type || "annual_leave",
      startDate,
      endDate,
      note: request.note || "",
    });
    setVacationRequestMessage("Redaguojamas laukiantis prašymas.");
  }

  async function submitVacationRequest() {
    if (!organizationId || !userId) {
      setVacationRequestMessage("Nepavyko nustatyti organizacijos.");
      return;
    }

    const startDate = normalizeDateInput(vacationRequestForm.startDate);
    const endDate = normalizeDateInput(vacationRequestForm.endDate);

    if (!startDate || !endDate) {
      setVacationRequestMessage("Nurodykite pradžios ir pabaigos datas.");
      return;
    }

    if (endDate < startDate) {
      setVacationRequestMessage("Pabaigos data negali būti ankstesnė.");
      return;
    }

    const requestedDays = countBusinessDays(startDate, endDate);

    if (vacationRequestForm.type === "annual_leave" && requestedDays < 1) {
      setVacationRequestMessage(
        "Pasirinktame laikotarpyje nėra darbo dienų.",
      );
      return;
    }

    setSaving(true);
    setVacationRequestMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      let saved: VacationRequestRow | null = null;

      if (editingVacationRequestId) {
        const response = await fetch(
          `/api/team/vacation-requests/${encodeURIComponent(
            editingVacationRequestId,
          )}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(session?.access_token
                ? { Authorization: `Bearer ${session.access_token}` }
                : {}),
            },
            body: JSON.stringify({
              type: vacationRequestForm.type,
              start_date: startDate,
              end_date: endDate,
              note: vacationRequestForm.note.trim() || null,
            }),
          },
        );

        const payload = (await response.json().catch(() => ({}))) as {
          request?: VacationRequestRow;
          error?: string;
        };

        if (!response.ok || !payload.request) {
          throw new Error(payload.error || "Prašymo atnaujinti nepavyko.");
        }

        saved = payload.request;
      } else {
        const { data, error } = await supabase
          .from("vacation_requests")
          .insert({
            organization_id: organizationId,
            employee_id: userId,
            type: vacationRequestForm.type,
            start_date: startDate,
            end_date: endDate,
            requested_days: requestedDays,
            note: vacationRequestForm.note.trim() || null,
            status: "submitted",
          })
          .select(
            "id, organization_id, employee_id, type, start_date, end_date, status, requested_days, note, rejection_reason, created_at",
          )
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("DB negrąžino išsaugoto prašymo.");
        saved = data as VacationRequestRow;
      }

      setVacationRequests((previous) =>
        editingVacationRequestId
          ? previous.map((request) =>
              request.id === editingVacationRequestId ? saved! : request,
            )
          : [saved!, ...previous],
      );
      showToast(
        editingVacationRequestId ? "Prašymas atnaujintas" : "Prašymas pateiktas",
        "Prašymas laukia vadovo sprendimo.",
      );
      resetVacationRequestForm();
      await loadDashboard(false);
    } catch (error) {
      setVacationRequestMessage(readableError(error));
    } finally {
      setSaving(false);
    }
  }

  const displayName = useMemo(() => {
    return (
      profile?.full_name ||
      [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      profile?.email ||
      "Darbuotojau"
    );
  }, [profile]);

  const unreadNotifications = notifications.filter(
    (item) => !item.is_read && !item.read_at,
  );
  const expiringTrainings = trainings.filter((item) =>
    isExpiringSoon(item.valid_until || item.expires_at),
  );
  const pendingRequestCount = vacationRequests.filter((request) => {
    const status = normalizeRequestStatus(request.status);
    return status === "submitted" || status === "pending";
  }).length;
  const nextShift = schedule[0];
  const openTaskCount = tasks.length;

  const documentProgress = useMemo(() => {
    const total = 3;
    const filled = [
      documentForm.healthCertificateUntil,
      documentForm.licenseUntil,
      documentForm.licenseNumber,
    ].filter(Boolean).length;
    return Math.round((filled / total) * 100);
  }, [documentForm]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f6f4] p-6 text-[#10251f]">
        <div className="rounded-[28px] border border-[#dbe6e0] bg-white p-8 text-center shadow-sm">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#047857]" />
          <p className="mt-4 text-lg font-black text-[#10251f]">Kraunama...</p>
          <p className="mt-1 text-sm font-semibold text-[#526174]">
            Ruošiame darbuotojo darbo centrą.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f6f4] p-4 text-[#10251f] sm:p-5 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <section className="overflow-hidden rounded-[24px] border border-[#c9d8d0] bg-white shadow-sm">
          <div className="flex flex-col gap-5 bg-[#486b5d] px-5 py-5 text-white lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[#e8f7ef] text-[#486b5d]">
                <UserRound className="h-7 w-7" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/70">
                  Darbuotojo paskyra
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                  Sveiki, {displayName}
                </h1>
                <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-white/80">
                  Pamainos, užduotys, prašymai, gyventojai, mokymai ir
                  dokumentai viename darbo lange.
                </p>
              </div>
            </div>

            <div className="grid gap-2 rounded-[18px] border border-white/15 bg-white/10 p-4 text-sm backdrop-blur lg:min-w-[320px]">
              <InfoLine
                label="Pareigos"
                value={profile?.position || "Darbuotojas"}
                inverse
              />
              <InfoLine
                label="Skyrius"
                value={profile?.department || "Nenurodyta"}
                inverse
              />
            </div>
          </div>

          <nav className="flex flex-wrap gap-1 border-t border-[#dbe6e0] bg-[#eef4f1] px-4 py-2 text-sm font-black text-[#486b5d]">
            <TopTab
              active={activePanel === "overview"}
              onClick={() => setActivePanel("overview")}
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Apžvalga"
            />
            <TopTab
              active={false}
              onClick={() => router.push("/my-schedule")}
              icon={<CalendarDays className="h-4 w-4" />}
              label="Grafikas"
            />
            <TopTab
              active={activePanel === "requests"}
              onClick={() => openPanel("requests")}
              icon={<CalendarX className="h-4 w-4" />}
              label="Prašymai"
              count={pendingRequestCount}
            />
            <TopTab
              active={activePanel === "tasks"}
              onClick={() => openPanel("tasks")}
              icon={<ClipboardList className="h-4 w-4" />}
              label="Užduotys"
              count={openTaskCount}
            />
            <TopTab
              active={activePanel === "notifications"}
              onClick={() => openPanel("notifications")}
              icon={<Bell className="h-4 w-4" />}
              label="Pranešimai"
              count={unreadNotifications.length}
            />
            <TopTab
              active={activePanel === "residents"}
              onClick={() => openPanel("residents")}
              icon={<Users className="h-4 w-4" />}
              label="Gyventojai"
              count={assignedResidents.length}
            />
            <TopTab
              active={activePanel === "documents"}
              onClick={() => openPanel("documents")}
              icon={<FileCheck2 className="h-4 w-4" />}
              label="Dokumentai"
            />
            <TopTab
              active={activePanel === "trainings"}
              onClick={() => openPanel("trainings")}
              icon={<GraduationCap className="h-4 w-4" />}
              label="Mokymai"
              count={expiringTrainings.length}
            />
          </nav>
        </section>

        {loadError ? (
          <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            Nepavyko įkelti dalies duomenų: {loadError}
          </div>
        ) : null}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatButton
            title="Artimiausia pamaina"
            value={formatShift(nextShift)}
            icon={<CalendarDays className="h-5 w-5" />}
            onClick={() => router.push("/my-schedule")}
          />
          <StatButton
            title="Atviros užduotys"
            value={String(openTaskCount)}
            icon={<ClipboardList className="h-5 w-5" />}
            onClick={() => openPanel("tasks")}
            tone={openTaskCount ? "amber" : "green"}
          />
          <StatButton
            title="Nauji pranešimai"
            value={String(unreadNotifications.length)}
            icon={<Bell className="h-5 w-5" />}
            onClick={() => openPanel("notifications")}
            tone={unreadNotifications.length ? "rose" : "green"}
          />
          <StatButton
            title="Mano gyventojai"
            value={String(assignedResidents.length)}
            icon={<Users className="h-5 w-5" />}
            onClick={() => openPanel("residents")}
          />
          <StatButton
            title="Baigiantys mokymai"
            value={String(expiringTrainings.length)}
            icon={<GraduationCap className="h-5 w-5" />}
            onClick={() => openPanel("trainings")}
            tone={expiringTrainings.length ? "amber" : "green"}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <section className="rounded-[22px] border border-[#c9d8d0] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
                  Šiandien
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-[#10251f]">
                  Darbo eiga
                </h2>
                <p className="mt-1 text-sm font-bold text-[#526174]">
                  Čia lieka ne meniu, o aiški darbuotojo dienos seka.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadDashboard()}
                className="grid h-11 w-11 place-items-center rounded-[16px] bg-[#eef4f1] text-[#486b5d] transition hover:bg-[#dbe6e0]"
                aria-label="Atnaujinti"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <RefreshCw className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="grid gap-3">
              <WorkStep
                number="1"
                title="Patikrink artimiausią pamainą"
                desc={nextShift ? formatShift(nextShift) : "Paskelbtų pamainų nerasta"}
                actionLabel="Grafikas"
                onClick={() => router.push("/my-schedule")}
              />
              <WorkStep
                number="2"
                title="Užbaik atviras užduotis"
                desc={openTaskCount ? `${openTaskCount} aktyvios užduotys` : "Atvirų užduočių nėra"}
                tone={openTaskCount ? "warning" : "default"}
                actionLabel="Užduotys"
                onClick={() => openPanel("tasks")}
              />
              <WorkStep
                number="3"
                title="Peržiūrėk pranešimus ir mokymus"
                desc={unreadNotifications.length || expiringTrainings.length ? `${unreadNotifications.length} pranešimai · ${expiringTrainings.length} mokymai` : "Naujų įspėjimų nėra"}
                actionLabel="Peržiūrėti"
                onClick={() => openPanel(unreadNotifications.length ? "notifications" : "trainings")}
              />
            </div>
          </section>

          <Panel
            title="Kita pamaina"
            kicker="Pamaina"
            actionHref="/my-schedule"
            actionLabel="Grafikas"
          >
            {nextShift ? (
              <ShiftCard shift={nextShift} />
            ) : (
              <EmptyState
                icon={<CalendarX className="h-7 w-7" />}
                title="Pamainų nerasta"
                desc="Kai grafikas bus paskelbtas, artimiausia pamaina atsiras čia."
              />
            )}
            <div className="mt-3 space-y-2">
              {schedule.slice(1, 4).map((shift) => (
                <ShiftMini key={shift.id} shift={shift} />
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Panel
            title="Mano užduotys"
            kicker="Užduotys"
            actionHref="/tasks"
            actionLabel="Atidaryti"
          >
            <div className="space-y-3">
              {tasks.slice(0, 4).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={() => setSelectedTask(task)}
                  onComplete={() => void completeTask(task.id)}
                />
              ))}
              {!tasks.length ? (
                <EmptyState
                  icon={<ClipboardList className="h-7 w-7" />}
                  title="Atvirų užduočių nėra"
                  desc="Kai vadovas priskirs užduotį, ji atsiras čia."
                />
              ) : null}
            </div>
          </Panel>

          <Panel
            title="Pranešimai ir mokymai"
            kicker="Svarbu"
            actionLabel="Pranešimai"
            onAction={() => openPanel("notifications")}
          >
            <div className="space-y-3">
              {unreadNotifications.slice(0, 3).map((item) => (
                <NotificationMini key={item.id} item={item} />
              ))}
              {!unreadNotifications.length ? (
                <EmptyState
                  icon={<Bell className="h-7 w-7" />}
                  title="Naujų pranešimų nėra"
                  desc="Mokymai, pranešimai ir dokumentų terminai bus rodomi čia."
                />
              ) : null}
              {expiringTrainings.length ? (
                <button
                  type="button"
                  onClick={() => openPanel("trainings")}
                  className="w-full rounded-[18px] border border-amber-200 bg-amber-50 p-4 text-left text-sm font-bold text-amber-900 transition hover:bg-amber-100"
                >
                  {expiringTrainings.length} mokymų ar pažymėjimų artėja prie termino.
                </button>
              ) : null}
            </div>
          </Panel>
        </section>

      </div>

      {modal ? (
        <DashboardModal
          title={modalTitle(modal)}
          onClose={() => setModal(null)}
          wide={modal === "requests"}
          compactBody={modal === "requests"}
        >
          {modal === "profile" ? (
            <div className="grid gap-4">
              <ModalField
                label="Telefonas"
                value={contactForm.phone}
                onChange={(value) =>
                  setContactForm((prev) => ({ ...prev, phone: value }))
                }
              />
              <ModalField
                label="El. paštas"
                value={contactForm.email}
                onChange={(value) =>
                  setContactForm((prev) => ({ ...prev, email: value }))
                }
              />
              <ModalField
                label="Adresas"
                value={contactForm.address}
                onChange={(value) =>
                  setContactForm((prev) => ({ ...prev, address: value }))
                }
              />
              <ModalActions
                onCancel={() => setModal(null)}
                onSubmit={() => void submitProfileChanges()}
                saving={saving}
                submitLabel="Pateikti patvirtinimui"
              />
            </div>
          ) : null}

          {modal === "tasks" ? (
            <div className="space-y-3">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={() => setSelectedTask(task)}
                  onComplete={() => void completeTask(task.id)}
                />
              ))}
              {!tasks.length ? (
                <EmptyState
                  icon={<ClipboardList className="h-7 w-7" />}
                  title="Užduočių nėra"
                  desc="Atviros užduotys atsiras čia."
                />
              ) : null}
            </div>
          ) : null}

          {modal === "requests" ? (
            <iframe
              title="Prašymai"
              src="/requests?embedded=1"
              className="h-[78vh] w-full border-0 bg-[#f3f6f4]"
            />
          ) : null}

          {modal === "notifications" ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void markNotificationsRead()}
                className="rounded-[14px] bg-[#047857] px-4 py-3 text-sm font-black text-white"
              >
                Pažymėti visus kaip skaitytus
              </button>
              {notifications.map((item) => (
                <NotificationMini key={item.id} item={item} />
              ))}
              {!notifications.length ? (
                <EmptyState
                  icon={<Bell className="h-7 w-7" />}
                  title="Pranešimų nėra"
                  desc="Nauji pranešimai atsiras čia."
                />
              ) : null}
            </div>
          ) : null}

          {modal === "residents" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {assignedResidents.map((row) => (
                <Link
                  key={row.id}
                  href={`/residents/${row.id}`}
                  className="rounded-[18px] border border-[#dbe6e0] bg-[#f8faf8] p-4 text-[#10251f] no-underline transition hover:bg-[#eef4f1]"
                >
                  <div className="font-black">{residentName(row)}</div>
                  <div className="mt-1 text-sm font-bold text-[#526174]">
                    {row.resident_code || "Be kodo"}
                  </div>
                </Link>
              ))}
              {!assignedResidents.length ? (
                <EmptyState
                  icon={<Users className="h-7 w-7" />}
                  title="Priskirtų gyventojų nėra"
                  desc="Kai būsi priskirtas gyventojui, jis atsiras čia."
                />
              ) : null}
            </div>
          ) : null}

          {modal === "documents" ? (
            <div className="grid gap-4">
              {employeeCredentials.some(
                (credential) =>
                  String(credential.status || "").toLowerCase() === "pending",
              ) ? (
                <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black leading-6 text-amber-900">
                  Dokumentų informacija pateikta ir laukia administratoriaus
                  patvirtinimo.
                </div>
              ) : null}
              <ModalField
                label="Sveikatos pažyma galioja iki"
                type="date"
                value={documentForm.healthCertificateUntil}
                onChange={(value) =>
                  setDocumentForm((prev) => ({
                    ...prev,
                    healthCertificateUntil: value,
                  }))
                }
              />
              <ModalField
                label="Licencija galioja iki"
                type="date"
                value={documentForm.licenseUntil}
                onChange={(value) =>
                  setDocumentForm((prev) => ({ ...prev, licenseUntil: value }))
                }
              />
              <ModalField
                label="Licencijos numeris"
                value={documentForm.licenseNumber}
                onChange={(value) =>
                  setDocumentForm((prev) => ({ ...prev, licenseNumber: value }))
                }
              />
              <ModalActions
                onCancel={() => setModal(null)}
                onSubmit={() => void submitDocuments()}
                saving={saving}
                submitLabel="Pateikti patvirtinimui"
              />
            </div>
          ) : null}

          {modal === "trainings" ? (
            <div className="space-y-3">
              {trainings.map((training) => (
                <div
                  key={training.id}
                  className="rounded-[18px] border border-[#dbe6e0] bg-white p-4"
                >
                  <div className="font-black">
                    {training.title ||
                      training.training_name ||
                      training.name ||
                      "Mokymas"}
                  </div>
                  <div className="mt-1 text-sm font-bold text-[#526174]">
                    Galioja iki:{" "}
                    {fmtDate(training.valid_until || training.expires_at)} ·{" "}
                    {training.hours || 0} val.
                  </div>
                </div>
              ))}
              {!trainings.length ? (
                <EmptyState
                  icon={<GraduationCap className="h-7 w-7" />}
                  title="Mokymų nėra"
                  desc="Mokymų įrašai atsiras čia."
                />
              ) : null}
            </div>
          ) : null}
        </DashboardModal>
      ) : null}

      {selectedTask ? (
        <DashboardModal
          title={taskTitle(selectedTask)}
          onClose={() => setSelectedTask(null)}
        >
          <div className="space-y-4">
            <p className="text-sm font-bold leading-6 text-[#526174]">
              {selectedTask.description || "Aprašymo nėra."}
            </p>
            <InfoLine
              label="Prioritetas"
              value={selectedTask.priority || "Nenurodyta"}
            />
            <InfoLine label="Terminas" value={fmtDate(selectedTask.due_date)} />
            <ModalActions
              onCancel={() => setSelectedTask(null)}
              onSubmit={() => void completeTask(selectedTask.id)}
              saving={false}
              submitLabel="Pažymėti atlikta"
            />
          </div>
        </DashboardModal>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[120] max-w-sm rounded-[20px] border border-[#c9d8d0] bg-white p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#047857]" />
            <div>
              <div className="font-black text-[#10251f]">{toast.title}</div>
              <div className="mt-1 text-sm font-bold text-[#526174]">
                {toast.message}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function modalTitle(panel: PanelKey) {
  const labels: Record<PanelKey, string> = {
    overview: "Apžvalga",
    requests: "Prašymai",
    profile: "Mano profilis",
    tasks: "Mano užduotys",
    notifications: "Pranešimai",
    residents: "Mano gyventojai",
    documents: "Dokumentai",
    trainings: "Mokymai",
  };
  return labels[panel];
}


function WorkStep({
  number,
  title,
  desc,
  actionLabel,
  onClick,
  tone = "default",
}: {
  number: string;
  title: string;
  desc: string;
  actionLabel: string;
  onClick: () => void;
  tone?: "default" | "warning";
}) {
  return (
    <article
      className={`grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-[18px] border p-4 transition ${
        tone === "warning"
          ? "border-amber-200 bg-amber-50"
          : "border-[#dbe6e0] bg-[#f8faf8] hover:bg-[#eef4f1]"
      }`}
    >
      <span className="grid h-11 w-11 place-items-center rounded-[16px] bg-white text-sm font-black text-[#047857] shadow-sm">
        {number}
      </span>
      <div className="min-w-0">
        <div className="truncate text-base font-black text-[#10251f]">{title}</div>
        <div className="mt-1 truncate text-sm font-bold text-[#526174]">{desc}</div>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-2 text-sm font-black text-[#486b5d] shadow-sm transition hover:bg-[#eef4f1]"
      >
        {actionLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </article>
  );
}

function TopTab({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 transition ${active ? "bg-white text-[#486b5d] shadow-sm ring-1 ring-[#c9d8d0]" : "text-[#486b5d] hover:bg-white/80"}`}
    >
      {icon}
      {label}
      {typeof count === "number" && count > 0 ? (
        <span className="rounded-full bg-white px-2 py-0.5 text-xs shadow-sm">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function StatButton({
  title,
  value,
  icon,
  onClick,
  tone = "default",
}: {
  title: string;
  value: string;
  icon: ReactNode;
  onClick?: () => void;
  tone?: "default" | "green" | "amber" | "rose";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50"
        : tone === "green"
          ? "border-emerald-200 bg-emerald-50"
          : "border-[#c9d8d0] bg-white";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[18px] border p-4 text-left shadow-sm transition hover:bg-[#f8faf8] ${toneClass}`}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-white/80 text-[#486b5d]">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#6a7e75]">
            {title}
          </p>
          <p className="mt-1 truncate text-lg font-black text-[#10251f]">
            {value}
          </p>
        </div>
      </div>
    </button>
  );
}

function ActionRow({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-[16px] border border-[#dbe6e0] bg-[#f8faf8] p-4 text-left transition hover:bg-[#eef4f1]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-white text-[#486b5d] shadow-sm">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-black text-[#10251f]">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-sm font-bold text-[#526174]">
            {desc}
          </span>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#486b5d]" />
    </button>
  );
}

function Panel({
  title,
  kicker,
  children,
  actionHref,
  actionLabel,
  onAction,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const action = actionHref ? (
    <Link
      href={actionHref}
      className="rounded-[14px] bg-[#eef4f1] px-4 py-2 text-sm font-black text-[#486b5d] no-underline transition hover:bg-[#dbe6e0]"
    >
      {actionLabel || "Atidaryti"}
    </Link>
  ) : onAction ? (
    <button
      type="button"
      onClick={onAction}
      className="rounded-[14px] bg-[#eef4f1] px-4 py-2 text-sm font-black text-[#486b5d] transition hover:bg-[#dbe6e0]"
    >
      {actionLabel || "Atidaryti"}
    </button>
  ) : null;

  return (
    <section className="rounded-[22px] border border-[#c9d8d0] bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
            {kicker}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-[#10251f]">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ShiftCard({ shift }: { shift: EmployeeSchedule }) {
  return (
    <div className="rounded-[18px] border border-emerald-100 bg-emerald-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#047857]">
        Kita pamaina
      </p>
      <h3 className="mt-2 text-xl font-black text-[#10251f]">
        {fmtDate(getScheduleDate(shift))}
      </h3>
      <p className="mt-1 text-lg font-black text-[#10251f]">
        {timeOnly(getScheduleStart(shift)) || "—"}–
        {timeOnly(getScheduleEnd(shift)) || "—"}
      </p>
      <p className="mt-2 text-sm font-bold text-[#526174]">
        {shift.position || shift.department || "Paskelbta pamaina"}
      </p>
    </div>
  );
}

function ShiftMini({ shift }: { shift: EmployeeSchedule }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[#dbe6e0] bg-white p-3">
      <span className="font-black text-[#10251f]">
        {fmtDate(getScheduleDate(shift))}
      </span>
      <span className="text-sm font-bold text-[#526174]">
        {timeOnly(getScheduleStart(shift)) || "—"}–
        {timeOnly(getScheduleEnd(shift)) || "—"}
      </span>
    </div>
  );
}

function TaskCard({
  task,
  onOpen,
  onComplete,
}: {
  task: EmployeeTask;
  onOpen: () => void;
  onComplete: () => void;
}) {
  const urgent =
    String(task.priority || "")
      .toLowerCase()
      .includes("urgent") ||
    String(task.priority || "")
      .toLowerCase()
      .includes("auk");
  return (
    <div
      className={`rounded-[18px] border p-4 ${urgent ? "border-amber-200 bg-amber-50" : "border-[#dbe6e0] bg-white"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-black text-[#10251f]">
            {taskTitle(task)}
          </div>
          <div className="mt-1 text-sm font-bold text-[#526174]">
            Terminas: {fmtDate(task.due_date)}
          </div>
        </div>
        <button
          type="button"
          onClick={onComplete}
          className="rounded-[12px] bg-[#047857] px-3 py-2 text-xs font-black text-white"
        >
          Atlikta
        </button>
      </div>
      {task.description ? (
        <p className="mt-3 line-clamp-2 text-sm font-semibold text-[#526174]">
          {task.description}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 text-sm font-black text-[#047857]"
      >
        Peržiūrėti
      </button>
    </div>
  );
}

function DocumentLine({
  title,
  value,
  ok,
}: {
  title: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3 rounded-[16px] border border-[#dbe6e0] bg-white p-3">
      <div>
        <div className="font-black text-[#10251f]">{title}</div>
        <div className="mt-0.5 text-sm font-bold text-[#526174]">{value}</div>
      </div>
      <span
        className={`rounded-full px-3 py-1 text-xs font-black ${ok ? "bg-emerald-50 text-[#047857]" : "bg-amber-50 text-amber-700"}`}
      >
        {ok ? "OK" : "Trūksta"}
      </span>
    </div>
  );
}

function NotificationMini({ item }: { item: NotificationRow }) {
  return (
    <div
      className={`rounded-[18px] border p-4 ${!item.is_read && !item.read_at ? "border-emerald-200 bg-emerald-50" : "border-[#dbe6e0] bg-white"}`}
    >
      <div className="font-black text-[#10251f]">
        {item.title || "Pranešimas"}
      </div>
      <p className="mt-1 text-sm font-bold leading-6 text-[#526174]">
        {item.message || item.body || "—"}
      </p>
      <div className="mt-2 text-xs font-bold text-[#6a7e75]">
        {fmtDateTime(item.created_at)}
      </div>
    </div>
  );
}

function VacationRequestCard({
  request,
  onEdit,
}: {
  request: VacationRequestRow;
  onEdit?: () => void;
}) {
  const status = normalizeRequestStatus(request.status);
  const canEdit = status === "submitted" || status === "pending";
  const period =
    request.start_date === request.end_date
      ? fmtDate(request.start_date)
      : `${fmtDate(request.start_date)} - ${fmtDate(request.end_date)}`;

  return (
    <article className="rounded-[18px] border border-[#dbe6e0] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="font-black text-[#10251f]">
            {requestKindLabel(request.type)}
          </div>
          <div className="mt-1 text-sm font-bold text-[#526174]">
            {period} · {formatRequestDays(request.requested_days)}
          </div>
        </div>
        <span
          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-black ${requestStatusClass(
            request.status,
          )}`}
        >
          {requestStatusLabel(request.status)}
        </span>
      </div>

      {request.note ? (
        <p className="mt-3 rounded-[14px] bg-[#f8faf8] px-3 py-2 text-sm font-bold leading-6 text-[#526174]">
          {request.note}
        </p>
      ) : null}

      {status === "rejected" && request.rejection_reason ? (
        <div className="mt-3 rounded-[14px] border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-bold leading-6 text-rose-800">
          Atmetimo priežastis: {request.rejection_reason}
        </div>
      ) : null}

      <div className="mt-3 text-xs font-bold text-[#6a7e75]">
        Pateikta: {fmtDateTime(request.created_at)}
      </div>

      {canEdit && onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="mt-3 rounded-[14px] border border-[#c9d8d0] bg-white px-4 py-2 text-sm font-black text-[#486b5d] transition hover:bg-[#eef4f1]"
        >
          Redaguoti
        </button>
      ) : null}
    </article>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#c9d8d0] bg-[#f8faf8] p-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-[16px] bg-white text-[#486b5d] shadow-sm">
        {icon}
      </div>
      <div className="mt-3 font-black text-[#10251f]">{title}</div>
      <div className="mt-1 text-sm font-bold text-[#526174]">{desc}</div>
    </div>
  );
}

function InfoLine({
  label,
  value,
  inverse = false,
}: {
  label: string;
  value: string;
  inverse?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className={`text-xs font-black uppercase tracking-[0.14em] ${inverse ? "text-white/65" : "text-[#6a7e75]"}`}
      >
        {label}
      </span>
      <strong
        className={`text-right ${inverse ? "text-white" : "text-[#10251f]"}`}
      >
        {value}
      </strong>
    </div>
  );
}

function DashboardModal({
  title,
  children,
  onClose,
  wide = false,
  compactBody = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  compactBody?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className={`max-h-[92vh] w-full overflow-hidden rounded-[28px] bg-white shadow-2xl ${
          wide ? "max-w-[1500px]" : "max-w-3xl"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 bg-[#486b5d] p-6 text-white">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">
              Darbuotojo paskyra
            </p>
            <h2 className="mt-1 text-3xl font-black tracking-tight">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-12 w-12 place-items-center rounded-[18px] bg-white/12 text-white hover:bg-white/20"
            aria-label="Uždaryti"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div
          className={`overflow-y-auto bg-[#f8faf8] ${
            compactBody ? "max-h-[78vh] p-0" : "max-h-[70vh] p-5"
          }`}
        >
          {children}
        </div>
      </section>
    </div>
  );
}

function ModalField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-black text-[#486b5d]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-[16px] border border-[#dbe6e0] bg-white px-4 text-base font-bold text-[#10251f] outline-none focus:border-[#047857] focus:ring-4 focus:ring-emerald-100"
      />
    </label>
  );
}

function ModalActions({
  onCancel,
  onSubmit,
  saving,
  submitLabel,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-[16px] border border-[#c9d8d0] bg-white px-5 py-3 font-black text-[#486b5d]"
      >
        Atšaukti
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={saving}
        className="rounded-[16px] bg-[#047857] px-5 py-3 font-black text-white disabled:opacity-60"
      >
        {saving ? "Saugoma..." : submitLabel}
      </button>
    </div>
  );
}
