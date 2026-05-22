"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Edit3,
  FileText,
  GraduationCap,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Umbrella,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentOrganizationId } from "@/lib/current-organization";
import { getReadableError } from "@/lib/errors";
import CandidatesModule from "./components/Candidates/CandidatesModule";
import TrainingModule from "./components/Trainings/TrainingModule";
import DocumentAcknowledgementsModule from "./components/DocumentAcknowledgements/DocumentAcknowledgementsModule";
import StaffTypesModule from "./components/StaffTypes/StaffTypesModule";
import ScheduleBlock from "./components/Schedule/ScheduleBlock";
import VacationRequests from "./components/Vacations/VacationRequests";

type TabKey =
  | "overview"
  | "employees"
  | "fte"
  | "access"
  | "docs"
  | "trainings"
  | "vacations"
  | "schedule"
  | "candidates"
  | "invites";

type Employee = {
  member_id?: string | null;
  user_id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  role?: string | null;
  legacy_role?: string | null;
  position?: string | null;
  department?: string | null;
  staff_type?: string | null;
  contract_number?: string | null;
  employment_rate?: number | null;
  weekly_hours?: number | null;
  employment_type?: string | null;
  employment_start_date?: string | null;
  termination_date?: string | null;
  is_archived?: boolean | null;
  archived_at?: string | null;
  archive_reason?: string | null;
  extra_permissions?: string[] | null;
  professional_license_number?: string | null;
  professional_license_valid_until?: string | null;
  occupational_health_valid_until?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

type Candidate = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  desired_role: string | null;
  status: string | null;
  experience: string | null;
  notes?: string | null;
  created_at: string | null;
};

type Invite = {
  id: string;
  email: string | null;
  role: string | null;
  status: string | null;
  created_at: string | null;
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

type ScheduleEntry = {
  id?: string;
  employee_id: string;
  date: string;
  start_datetime?: string | null;
  end_datetime?: string | null;
  status?: string | null;
  note?: string | null;
};

type PersonnelPosition = {
  id: string;
  organization_id?: string | null;
  department: string | null;
  position_name: string | null;
  planned_fte: number | null;
  coefficient_min: number | null;
  coefficient_max: number | null;
  minimum_day_shift: number | null;
  minimum_night_shift: number | null;
  active: boolean | null;
  created_at?: string | null;
};

type PositionPlanForm = {
  id: string;
  department: string;
  position_name: string;
  planned_fte: number;
  coefficient_min: string;
  coefficient_max: string;
  minimum_day_shift: number;
  minimum_night_shift: number;
  active: boolean;
};

type FtePlanRow = {
  id: string;
  department: string;
  title: string;
  planned: number;
  filled: number;
  free: number;
  coefficient: string;
  minimumDayShift: number;
  minimumNightShift: number;
  percent: number;
  status: "Užpildyta" | "Stebėti" | "Trūksta";
  tone: "emerald" | "amber" | "red";
};

type VacationForm = {
  employee_id: string;
  type: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  note: string;
};

type VacationFilterKey = "all" | "submitted" | "approved" | "rejected" | "risk" | "history";

type AbsenceType = { value: string; label: string; code: string };

type Training = {
  id: string;
  employee_id: string;
  title: string;
  completed_at: string | null;
  expires_at: string | null;
  hours: number | null;
  provider?: string | null;
  category?: string | null;
  status?: string | null;
};

type Credential = {
  id: string;
  employee_id: string;
  type: string;
  number: string | null;
  expires_at: string | null;
};

type NewEmployeeForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  staff_type: string;
  role: string;
  notes: string;
  send_invite: boolean;
  candidate_id: string;
};

type EditForm = {
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  birth_date: string;
  position: string;
  department: string;
  staff_type: string;
  role: string;
  contract_number: string;
  employment_rate: number;
  weekly_hours: number;
  employment_type: string;
  employment_start_date: string;
  termination_date: string;
  is_archived: boolean;
  archive_reason: string;
  professional_license_number: string;
  professional_license_valid_until: string;
  occupational_health_valid_until: string;
  extra_permissions: string[];
  is_active: boolean;
};

type EmployeeEditorTab = "register" | "profile" | "contract" | "access" | "documents" | "trainings";
type EmployeeFilterKey = "all" | "active" | "inactive" | "archived" | "administration" | "health" | "social" | "maintenance";

const STAFF_TYPES = [
  {
    value: "social_worker",
    label: "Socialinis darbuotojas",
    desc: "Gyventojai, užduotys, perdavimo žurnalai",
    permissions: ["residents.view_basic", "tasks.view", "tasks.create", "handover.view", "handover.create"],
  },
  {
    value: "nurse",
    label: "Slaugytojas / medikas",
    desc: "Gyventojai, medicina, perdavimo žurnalai",
    permissions: ["residents.view_basic", "medicine.view", "tasks.view", "tasks.create", "handover.view", "handover.create"],
  },
  {
    value: "doctor",
    label: "Gydytojas",
    desc: "Gyventojai, medicina, perdavimo žurnalai",
    permissions: ["residents.view_basic", "medicine.view", "tasks.view", "tasks.create", "handover.view", "handover.create"],
  },
  {
    value: "activity_specialist",
    label: "Užimtumo specialistas",
    desc: "Gyventojai, veiklos, užduotys",
    permissions: ["residents.view_basic", "activities.manage", "tasks.view", "tasks.create"],
  },
  {
    value: "maintenance",
    label: "Ūkis",
    desc: "Ūkio užduotys, kambariai, sandėliai",
    permissions: ["tasks.view", "tasks.create", "rooms.view", "inventory.view"],
  },
  {
    value: "administration",
    label: "Administracija",
    desc: "Administracinis darbuotojas",
    permissions: ["dashboard.view", "tasks.view", "tasks.create"],
  },
  {
    value: "care_worker",
    label: "Priežiūros darbuotojas",
    desc: "Bendras darbuotojo tipas",
    permissions: ["dashboard.view", "tasks.view", "tasks.create"],
  },
];

const EXTRA_PERMISSIONS = [
  { value: "residents.view_basic", label: "Gyventojai" },
  { value: "medicine.view", label: "Medicina" },
  { value: "handover.view", label: "Perdavimo žurnalai" },
  { value: "handover.create", label: "Kurti perdavimo įrašus" },
  { value: "activities.manage", label: "Veiklos / užimtumas" },
  { value: "rooms.view", label: "Kambariai" },
  { value: "inventory.view", label: "Sandėliai" },
  { value: "tasks.manage", label: "Valdyti visas užduotis" },
  { value: "employees.view", label: "Darbuotojai" },
  { value: "reports.view", label: "Ataskaitos" },
];

const tabs: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
  { key: "overview", label: "Apžvalga", icon: ShieldCheck },
  { key: "employees", label: "Darbuotojai", icon: Users },
  { key: "fte", label: "Etatų planas", icon: BriefcaseBusiness },
  { key: "schedule", label: "Grafikas", icon: CalendarDays },
  { key: "vacations", label: "Atostogos", icon: Umbrella },
  { key: "candidates", label: "Kandidatai", icon: UserPlus },
  { key: "access", label: "Pareigos ir teisės", icon: UserCog },
  { key: "trainings", label: "Mokymai", icon: GraduationCap },
  { key: "docs", label: "Dokumentai", icon: FileText },
];

const absenceTypes: AbsenceType[] = [
  { value: "annual_leave", label: "Kasmetinės atostogos", code: "A" },
  { value: "sick_leave", label: "Nedarbingumas", code: "L" },
  { value: "training", label: "Mokymai / komandiruotė", code: "M" },
  { value: "short_leave", label: "Trumpas išvykimas", code: "TI" },
  { value: "unpaid_leave", label: "Nemokamos atostogos", code: "NA" },
  { value: "other", label: "Kita", code: "K" },
];

const initialNewEmployeeForm: NewEmployeeForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  position: "",
  department: "",
  staff_type: "",
  role: "employee",
  notes: "",
  send_invite: true,
  candidate_id: "",
};

const initialPositionPlanForm: PositionPlanForm = {
  id: "",
  department: "",
  position_name: "",
  planned_fte: 1,
  coefficient_min: "",
  coefficient_max: "",
  minimum_day_shift: 0,
  minimum_night_shift: 0,
  active: true,
};


function roundFte(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatFte(value: number) {
  const rounded = roundFte(value);

  return rounded.toLocaleString("lt-LT", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function normalizePlanText(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function positionGroupKey(employee: Employee) {
  const text = normalizePlanText(
    [employee.staff_type, employee.department, employee.position, employee.role].filter(Boolean).join(" "),
  );

  if (/slaug|nurse|medic|sveikat/.test(text)) return "slauga";
  if (/social|soc|glob|uzimt/.test(text)) return "socialine sritis";
  if (/virtuv|maitin|vir|kitchen|cook/.test(text)) return "maitinimas";
  if (/uk|ūk|techn|sandel|valy|maintenance/.test(text)) return "ukis";
  if (/admin|direkt|vadov|owner/.test(text)) return "administracija";

  return text || "kita";
}

function groupLabel(key: string) {
  const labels: Record<string, string> = {
    slauga: "Slauga",
    "socialine sritis": "Socialinė sritis",
    maitinimas: "Maitinimas",
    ukis: "Ūkis",
    administracija: "Administracija",
    kita: "Kita",
  };

  return labels[key] || key;
}

function employeeMatchesPosition(employee: Employee, position: PersonnelPosition) {
  const positionName = normalizePlanText(position.position_name);
  const department = normalizePlanText(position.department);
  const employeePosition = normalizePlanText(employee.position);
  const employeeDepartment = normalizePlanText(employee.department);
  const employeeStaffType = normalizePlanText(employee.staff_type);
  const group = positionGroupKey(employee);

  if (positionName && employeePosition && employeePosition.includes(positionName)) return true;
  if (positionName && employeeStaffType && employeeStaffType.includes(positionName)) return true;
  if (department && employeeDepartment && employeeDepartment.includes(department)) return true;
  if (department && group && group.includes(department)) return true;

  return false;
}

function coefficientText(position: PersonnelPosition) {
  const min = Number(position.coefficient_min || 0);
  const max = Number(position.coefficient_max || 0);

  if (min > 0 && max > 0) return `${min.toFixed(2)} – ${max.toFixed(2)}`;
  if (min > 0) return min.toFixed(2);
  if (max > 0) return max.toFixed(2);

  return "—";
}

function makeFtePlanRow({
  id,
  department,
  title,
  planned,
  filled,
  coefficient,
  minimumDayShift,
  minimumNightShift,
}: {
  id: string;
  department: string;
  title: string;
  planned: number;
  filled: number;
  coefficient: string;
  minimumDayShift: number;
  minimumNightShift: number;
}): FtePlanRow {
  const plannedFte = roundFte(planned);
  const filledFte = roundFte(filled);
  const free = roundFte(Math.max(0, plannedFte - filledFte));
  const percent = plannedFte > 0 ? Math.round((filledFte / plannedFte) * 100) : filledFte > 0 ? 100 : 0;
  const tone = percent >= 90 ? "emerald" : percent >= 70 ? "amber" : "red";
  const status = percent >= 90 ? "Užpildyta" : percent >= 70 ? "Stebėti" : "Trūksta";

  return {
    id,
    department,
    title,
    planned: plannedFte,
    filled: filledFte,
    free,
    coefficient,
    minimumDayShift: roundFte(minimumDayShift),
    minimumNightShift: roundFte(minimumNightShift),
    percent,
    status,
    tone,
  };
}

function buildFtePlanRows(positions: PersonnelPosition[], employees: Employee[]): FtePlanRow[] {
  const activePositions = positions.filter((position) => position.active !== false);

  if (activePositions.length > 0) {
    return activePositions.map((position) => {
      const filled = employees
        .filter((employee) => employeeMatchesPosition(employee, position))
        .reduce((sum, employee) => sum + Number(employee.employment_rate || 1), 0);

      return makeFtePlanRow({
        id: position.id,
        department: position.department || "",
        title: position.position_name || "Pareigybė",
        planned: Number(position.planned_fte || 0),
        filled,
        coefficient: coefficientText(position),
        minimumDayShift: Number(position.minimum_day_shift || 0),
        minimumNightShift: Number(position.minimum_night_shift || 0),
      });
    });
  }

  const groups = new Map<string, { title: string; filled: number }>();

  for (const employee of employees) {
    const key = positionGroupKey(employee);
    const current = groups.get(key) || { title: groupLabel(key), filled: 0 };
    current.filled += Number(employee.employment_rate || 1);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([key, row]) =>
    makeFtePlanRow({
      id: key,
      department: row.title,
      title: row.title,
      planned: Math.ceil(row.filled),
      filled: row.filled,
      coefficient: "—",
      minimumDayShift: 0,
      minimumNightShift: 0,
    }),
  );
}

function fmt(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("lt-LT");
}


function normalizeDateInput(value?: string | null) {
  if (!value) return "";

  const raw = String(value).trim();

  if (!raw) return "";

  const isoDate = raw.match(/^(\d{4}-\d{2}-\d{2})/);

  if (isoDate) return isoDate[1];

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isRealBirthDate(value?: string | null) {
  const normalized = normalizeDateInput(value);

  if (!normalized) return true;

  const date = new Date(`${normalized}T00:00:00`);
  const min = new Date("1900-01-01T00:00:00");
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return !Number.isNaN(date.getTime()) && date >= min && date <= today;
}

function removeUndefinedValues<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as T;
}


function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("lt-LT", { month: "long", year: "numeric" });
}

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

function daysBetween(start: string, end: string) {
  if (!start || !end) return 0;
  const days = datesBetween(start, end).length;
  return Math.max(1, days);
}

function absenceTypeMeta(type?: string | null): AbsenceType {
  return absenceTypes.find((item) => item.value === type) || absenceTypes[0];
}

function absenceStatusLabel(status?: string | null) {
  if (status === "approved") return "Patvirtinta";
  if (status === "rejected") return "Atmesta";
  if (status === "pending") return "Laukia";
  return "Pateikta";
}

function timeLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" });
}

function employeeName(employee?: Employee | null) {
  if (!employee) return "Darbuotojas";

  const full = String(employee.full_name || "").trim();

  if (full) return full;

  const combined = [employee.first_name, employee.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (combined) return combined;

  if (employee.position?.trim()) return employee.position.trim();

  return "Darbuotojas";
}

function employeeKey(employee: Pick<Employee, "member_id" | "user_id">) {
  return employee.member_id || employee.user_id;
}

function employeeRole(employee?: Employee | null) {
  const candidates = [
    employee?.position,
    employee?.legacy_role,
    employee?.staff_type,
    employee?.department,
    employee?.role,
  ];

  for (const value of candidates) {
    const raw = String(value || "").trim();
    const normalized = raw.toLowerCase();

    if (!raw) continue;
    if (["admin", "employee", "administratorius", "darbuotojas"].includes(normalized)) continue;

    return raw;
  }

  return "";
}

function staffTypeLabel(value?: string | null) {
  return STAFF_TYPES.find((item) => item.value === value)?.label || "Nepasirinkta";
}

function normalizeExtraPermissions(value: unknown) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      return [];
    }
  }

  return [];
}

function staffPermissions(staffType?: string | null) {
  return STAFF_TYPES.find((item) => item.value === staffType)?.permissions || ["dashboard.view", "tasks.view", "tasks.create"];
}

function mergedPermissions(employee: Employee | EditForm) {
  return Array.from(
    new Set([
      ...staffPermissions(employee.staff_type),
      ...normalizeExtraPermissions(employee.extra_permissions),
    ]),
  );
}

function isExpiring(value?: string | null) {
  if (!value) return false;

  const date = new Date(`${value}T00:00:00`);
  const limit = new Date();
  limit.setDate(limit.getDate() + 45);

  return date <= limit;
}

function candidateName(candidate: Candidate) {
  return [candidate.first_name, candidate.last_name].filter(Boolean).join(" ").trim() || candidate.email || "Kandidatas";
}

function employeeProfilePhone(profile: Partial<Employee>) {
  return typeof profile.phone === "string" ? profile.phone : null;
}

function employeeProfileBirthDate(profile: Partial<Employee>) {
  return normalizeDateInput(profile.birth_date);
}

export default function TeamPage() {
  const searchParams = useSearchParams();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("employees");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilterKey>("all");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [vacations, setVacations] = useState<VacationRequest[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [scheduleMonth, setScheduleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [vacationFilter, setVacationFilter] = useState<VacationFilterKey>("all");
  const [vacationForm, setVacationForm] = useState<VacationForm>({
    employee_id: "",
    type: "annual_leave",
    start_date: toDateInput(new Date()),
    end_date: toDateInput(new Date()),
    start_time: "",
    end_time: "",
    note: "",
  });
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [personnelPositions, setPersonnelPositions] = useState<PersonnelPosition[]>([]);
  const [positionPlanForm, setPositionPlanForm] = useState<PositionPlanForm>(initialPositionPlanForm);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalMessage, setCreateModalMessage] = useState("");
  const [newEmployeeForm, setNewEmployeeForm] = useState<NewEmployeeForm>(initialNewEmployeeForm);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [employeeEditorTab, setEmployeeEditorTab] = useState<EmployeeEditorTab>("register");

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    const moduleFromUrl = searchParams.get("module") as TabKey | null;
    const savedModule = typeof window !== "undefined" ? (window.localStorage.getItem("team-active-module") as TabKey | null) : null;
    const nextModule = moduleFromUrl || savedModule;

    if (nextModule && tabs.some((item) => item.key === nextModule)) {
      setTab(nextModule);
    }

    if (searchParams.get("newEmployee") === "1") {
      setCreateModalMessage("");
      setTab("employees");
      setShowCreateModal(true);
    }
  }, [searchParams]);

  function changeTab(nextTab: TabKey) {
    setTab(nextTab);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("team-active-module", nextTab);
      const url = new URL(window.location.href);
      url.searchParams.set("module", nextTab);
      window.history.replaceState(null, "", url.toString());
    }
  }

  async function loadAll() {
    setLoading(true);
    setMessage("");

    try {
      const orgId = await getCurrentOrganizationId();

      if (!orgId) {
        setMessage("Nepavyko nustatyti įstaigos.");
        setLoading(false);
        return;
      }

      setOrganizationId(orgId);

      const [
        employeesResult,
        candidatesResult,
        invitesResult,
        trainingsResult,
        credentialsResult,
        positionsResult,
      ] = await Promise.all([
        supabase
          .from("organization_members")
          .select(
            "id, user_id, role, legacy_role, position, department, staff_type, contract_number, employment_rate, weekly_hours, employment_type, employment_start_date, termination_date, is_archived, archived_at, archive_reason, professional_license_number, professional_license_valid_until, occupational_health_valid_until, is_active, created_at",
          )
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),
        supabase
          .from("candidates")
          .select("id, first_name, last_name, email, phone, desired_role, status, experience, notes, created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),
        supabase
          .from("organization_invites")
          .select("id, email, role, status, created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),
        supabase
          .from("personnel_trainings")
          .select("id, employee_id, title, category, provider, completed_at, expires_at, hours, status")
          .eq("organization_id", orgId)
          .order("completed_at", { ascending: false }),
        supabase
          .from("personnel_credentials")
          .select("id, employee_id, type, number, expires_at")
          .eq("organization_id", orgId)
          .order("expires_at", { ascending: true }),
        supabase
          .from("personnel_positions")
          .select("id, organization_id, department, position_name, planned_fte, coefficient_min, coefficient_max, minimum_day_shift, minimum_night_shift, active, created_at")
          .eq("organization_id", orgId)
          .order("department", { ascending: true })
          .order("position_name", { ascending: true }),
      ]);

      if (employeesResult.error) throw employeesResult.error;

      const memberRows = ((employeesResult.data as Array<Employee & { id?: string | null }>) || []).map((employee) => ({
        ...employee,
        member_id: employee.id || employee.member_id || null,
        extra_permissions: normalizeExtraPermissions(employee.extra_permissions),
      }));

      const userIds = memberRows.map((employee) => employee.user_id).filter(Boolean);
      let profileMap = new Map<string, Partial<Employee>>();

      if (userIds.length > 0) {
        let profilesResult = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name, full_name, phone, birth_date")
          .in("id", userIds);

        if (profilesResult.error) {
          profilesResult = await supabase
            .from("profiles")
            .select("id, email, first_name, last_name, full_name")
            .in("id", userIds);
        }

        if (!profilesResult.error) {
          profileMap = new Map(
            ((profilesResult.data as Array<Partial<Employee> & { id: string }>) || []).map((profile) => [
              profile.id,
              {
                email: profile.email || null,
                first_name: profile.first_name || null,
                last_name: profile.last_name || null,
                full_name: profile.full_name || null,
                phone: employeeProfilePhone(profile),
                birth_date: employeeProfileBirthDate(profile),
              },
            ]),
          );
        }
      }

      setEmployees(
        memberRows.map((employee) => {
          const profile = profileMap.get(employee.user_id) || {};

          return {
            ...employee,
            email: String(profile.email || employee.email || "").trim() || employee.email || null,
            first_name: String(profile.first_name || employee.first_name || "").trim() || employee.first_name || null,
            last_name: String(profile.last_name || employee.last_name || "").trim() || employee.last_name || null,
            full_name:
              String(profile.full_name || employee.full_name || "").trim() ||
              [profile.first_name || employee.first_name, profile.last_name || employee.last_name]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              employee.full_name ||
              null,
            phone: String(profile.phone || employee.phone || "").trim() || employee.phone || null,
            birth_date: String(profile.birth_date || employee.birth_date || "").trim() || employee.birth_date || null,
          };
        }),
      );
      if (!candidatesResult.error) setCandidates((candidatesResult.data as Candidate[]) || []);
      if (!invitesResult.error) setInvites((invitesResult.data as Invite[]) || []);

      const vacationResult = await supabase
        .from("vacation_requests")
        .select("id, employee_id, type, start_date, end_date, status, requested_days, note, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (!vacationResult.error) {
        setVacations(((vacationResult.data as VacationRequest[]) || []).map((request) => ({
          ...request,
          start_date: request.start_date || toDateInput(new Date()),
          end_date: request.end_date || request.start_date || toDateInput(new Date()),
          status: request.status || "submitted",
        })));
      } else {
        setVacations([]);
      }

      const scheduleResult = await supabase
        .from("work_schedule_entries")
        .select("id, employee_id, date, start_datetime, end_datetime, status, note")
        .eq("organization_id", orgId)
        .gte("date", toDateInput(new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth(), 1)))
        .lte("date", toDateInput(new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth() + 1, 0)));

      if (!scheduleResult.error) {
        setScheduleEntries((scheduleResult.data as ScheduleEntry[]) || []);
      } else {
        setScheduleEntries([]);
      }

      if (!trainingsResult.error) setTrainings((trainingsResult.data as Training[]) || []);
      if (!credentialsResult.error) setCredentials((credentialsResult.data as Credential[]) || []);
      if (!positionsResult.error) setPersonnelPositions((positionsResult.data as PersonnelPosition[]) || []);
      if (positionsResult.error) setPersonnelPositions([]);
    } catch (error) {
      const readable = getReadableError(error);

      if (readable.includes("extra_permissions")) {
        setMessage("Trūksta DB stulpelio `extra_permissions`. Paleisk SQL: alter table organization_members add column if not exists extra_permissions jsonb default '[]'::jsonb;");
      } else {
        setMessage(readable);
      }
    } finally {
      setLoading(false);
    }
  }

  function openEmployeeEditor(employee: Employee) {
    setEditingEmployee(employee);
    setEmployeeEditorTab("profile");
    setEditForm({
      first_name: employee.first_name || "",
      last_name: employee.last_name || "",
      full_name: employee.full_name || employeeName(employee),
      email: employee.email || "",
      phone: employee.phone || "",
      birth_date: normalizeDateInput(employee.birth_date),
      position: employee.position || "",
      department: employee.department || "",
      staff_type: employee.staff_type || "",
      role: employee.role || "employee",
      contract_number: employee.contract_number || "",
      employment_rate: Number(employee.employment_rate || 1),
      weekly_hours: Number(employee.weekly_hours || 40),
      employment_type: employee.employment_type || "full_time",
      employment_start_date: normalizeDateInput(employee.employment_start_date),
      termination_date: normalizeDateInput(employee.termination_date),
      is_archived: employee.is_archived === true,
      archive_reason: employee.archive_reason || "",
      professional_license_number: employee.professional_license_number || "",
      professional_license_valid_until: employee.professional_license_valid_until || "",
      occupational_health_valid_until: employee.occupational_health_valid_until || "",
      extra_permissions: normalizeExtraPermissions(employee.extra_permissions),
      is_active: employee.is_active !== false,
    });

    window.requestAnimationFrame(() => {
      document
        .getElementById("employee-register-tabs")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function closeEmployeeEditor() {
    setEditingEmployee(null);
    setEditForm(null);
    setEmployeeEditorTab("register");
  }

  async function saveEmployee() {
    console.log("[TeamPage] saveEmployee called", {
      organizationId,
      editingUserId: editingEmployee?.user_id,
      hasEditForm: Boolean(editForm),
    });

    if (!organizationId) {
      setMessage("Nepavyko nustatyti įstaigos. Perkrauk puslapį arba prisijunk iš naujo.");
      console.error("[TeamPage] saveEmployee aborted: missing organizationId");
      return;
    }

    if (!editingEmployee || !editForm) {
      setMessage("Nepavyko rasti redaguojamo darbuotojo duomenų.");
      console.error("[TeamPage] saveEmployee aborted: missing editingEmployee or editForm");
      return;
    }

    const firstName = editForm.first_name.trim();
    const lastName = editForm.last_name.trim();
    const fullName =
      editForm.full_name.trim() ||
      [firstName, lastName].filter(Boolean).join(" ").trim();

    console.log("[TeamPage] validation", { firstName, lastName, fullName, birth_date: editForm.birth_date });

    if (!firstName || !lastName) {
      console.error("[TeamPage] saveEmployee aborted: missing firstName or lastName");
      setMessage("Įvesk darbuotojo vardą ir pavardę.");
      return;
    }

    if (editForm.birth_date && !isRealBirthDate(editForm.birth_date)) {
      console.error("[TeamPage] saveEmployee aborted: invalid birth date", editForm.birth_date);
      setMessage("Gimimo data turi būti reali: nuo 1900-01-01 iki šiandienos.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const memberPayload = removeUndefinedValues({
        position: editForm.position.trim() || null,
        department: editForm.department.trim() || null,
        staff_type: editForm.staff_type || null,
        extra_permissions: Array.from(
          new Set([
            ...staffPermissions(editForm.staff_type),
            ...editForm.extra_permissions,
          ]),
        ),
        role: editForm.role || "employee",
        contract_number: editForm.contract_number.trim() || null,
        employment_rate: Number(editForm.employment_rate || 1),
        weekly_hours: Number(editForm.weekly_hours || 40),
        employment_type: editForm.employment_type || "full_time",
        employment_start_date: editForm.employment_start_date || null,
        termination_date: editForm.termination_date || null,
        is_archived: editForm.is_archived,
        archived_at: editForm.is_archived ? new Date().toISOString() : null,
        archive_reason: editForm.archive_reason.trim() || null,
        professional_license_number: editForm.professional_license_number.trim() || null,
        professional_license_valid_until: editForm.professional_license_valid_until || null,
        occupational_health_valid_until: editForm.occupational_health_valid_until || null,
        is_active: editForm.is_archived ? false : editForm.is_active,
      });

      const profilePayload = removeUndefinedValues({
        first_name: firstName,
        last_name: lastName,
        full_name: fullName || null,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        birth_date: editForm.birth_date || null,
      });

      console.log("[TeamPage] employee save payload", {
        memberPayload,
        profilePayload,
        organizationId,
        userId: editingEmployee.user_id,
      });

      const memberResult = await supabase
        .from("organization_members")
        .update(memberPayload)
        .eq("organization_id", organizationId)
        .eq("user_id", editingEmployee.user_id);

      if (memberResult.error) {
        console.error("[TeamPage] organization_members update failed", memberResult.error);
        throw memberResult.error;
      }

      console.log("[TeamPage] organization_members update ok", {
        organizationId,
        userId: editingEmployee.user_id,
      });

      const savedProfilePayload: Record<string, string | null> = {
        first_name: firstName,
        last_name: lastName,
        full_name: fullName || null,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        birth_date: editForm.birth_date || null,
      };

      const profileResult = await supabase.rpc("admin_update_employee_profile", {
        p_organization_id: organizationId,
        p_user_id: editingEmployee.user_id,
        p_first_name: firstName,
        p_last_name: lastName,
        p_full_name: fullName || null,
        p_email: editForm.email.trim() || null,
        p_phone: editForm.phone.trim() || null,
        p_birth_date: editForm.birth_date || null,
      });

      if (profileResult.error) {
        console.error("[TeamPage] admin_update_employee_profile failed", profileResult.error);
        throw profileResult.error;
      }

      console.log("[TeamPage] profiles rpc update ok", {
        userId: editingEmployee.user_id,
      });

      setEmployees((prev) =>
        prev.map((employee) =>
          employee.user_id === editingEmployee.user_id
            ? {
                ...employee,
                ...memberPayload,
                first_name: firstName,
                last_name: lastName,
                full_name: fullName,
                email: savedProfilePayload.email,
                phone: savedProfilePayload.phone,
                birth_date: normalizeDateInput(savedProfilePayload.birth_date),
              }
            : employee,
        ),
      );

      setMessage((prev) => prev || "Darbuotojo duomenys atnaujinti.");
      closeEmployeeEditor();
    } catch (error) {
      console.error("[TeamPage] saveEmployee failed", error);
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function createEmployee() {
    if (!organizationId) {
      setCreateModalMessage("Nepavyko nustatyti įstaigos.");
      setMessage("Nepavyko nustatyti įstaigos.");
      return;
    }

    const firstName = newEmployeeForm.first_name.trim();
    const lastName = newEmployeeForm.last_name.trim();
    const email = newEmployeeForm.email.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

    console.log("[TeamPage] validation", { firstName, lastName, fullName, birth_date: editForm.birth_date });

    if (!firstName || !lastName) {
      setCreateModalMessage("Įvesk darbuotojo vardą ir pavardę.");
      console.error("[TeamPage] saveEmployee aborted: missing firstName or lastName");
      setMessage("Įvesk darbuotojo vardą ir pavardę.");
      return;
    }

    if (newEmployeeForm.send_invite && !email) {
      setCreateModalMessage("Norint siųsti kvietimą, būtinas el. paštas.");
      setMessage("Norint siųsti kvietimą, būtinas el. paštas.");
      return;
    }

    setSaving(true);
    setMessage("");
    setCreateModalMessage("");

    try {
      const candidatePayload = {
        organization_id: organizationId,
        first_name: firstName,
        last_name: lastName,
        email: email || null,
        phone: newEmployeeForm.phone.trim() || null,
        desired_role: newEmployeeForm.position.trim() || newEmployeeForm.staff_type.trim() || null,
        experience: newEmployeeForm.department.trim() || null,
        notes: newEmployeeForm.notes.trim() || null,
        status: newEmployeeForm.send_invite ? "invite_pending" : "draft",
        consent: true,
      };

      const { data: candidate, error: candidateError } = await supabase
        .from("candidates")
        .insert(candidatePayload)
        .select("id, first_name, last_name, email, phone, desired_role, status, experience, notes, created_at")
        .single();

      if (candidateError) throw candidateError;

      if (newEmployeeForm.send_invite && email) {
        const inviteToken = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const invitePayload = {
          organization_id: organizationId,
          email,
          role: newEmployeeForm.role || "employee",
          status: "pending",
          token: inviteToken,
        };

        const { data: invite, error: inviteError } = await supabase
          .from("organization_invites")
          .insert(invitePayload)
          .select("id")
          .single();

        if (inviteError) throw inviteError;

        setInvites((previous) => [
          {
            id: invite?.id || crypto.randomUUID(),
            email,
            role: invitePayload.role,
            status: "pending",
            created_at: new Date().toISOString(),
          },
          ...previous,
        ]);
      }

      if (candidate) {
        setCandidates((previous) => [candidate as Candidate, ...previous]);
      }

      setNewEmployeeForm(initialNewEmployeeForm);
      setShowCreateModal(false);
      setCreateModalMessage("");
      setMessage(
        `Darbuotojo ruošinys ${fullName} išsaugotas kandidatų sąraše${newEmployeeForm.send_invite ? " ir sukurtas kvietimas" : ""}.`
      );

      await loadAll();
      setTab("invites");
    } catch (error) {
      const readable = getReadableError(error);
      setCreateModalMessage(readable || "Nepavyko išsaugoti darbuotojo ruošinio.");
      setMessage(readable || "Nepavyko išsaugoti darbuotojo ruošinio.");
    } finally {
      setSaving(false);
    }
  }

  function toggleExtraPermission(permission: string) {
    if (!editForm) return;

    const exists = editForm.extra_permissions.includes(permission);

    setEditForm({
      ...editForm,
      extra_permissions: exists
        ? editForm.extra_permissions.filter((item) => item !== permission)
        : [...editForm.extra_permissions, permission],
    });
  }

  const filteredEmployees = useMemo(() => {
    const q = query.trim().toLowerCase();

    const visibleEmployees = employees.filter((employee) => {
      const department = String(employee.department || employee.position || employee.staff_type || "").toLowerCase();
      const active = employee.is_archived !== true && employee.is_active !== false;

      if (employeeFilter === "active") return active;
      if (employeeFilter === "inactive") return employee.is_archived !== true && employee.is_active === false;
      if (employeeFilter === "archived") return employee.is_archived === true;
      if (employeeFilter === "administration") return department.includes("admin") || department.includes("vadov");
      if (employeeFilter === "health") return department.includes("slaug") || department.includes("medic") || department.includes("sveikat");
      if (employeeFilter === "social") return department.includes("social") || department.includes("glob") || department.includes("užimt") || department.includes("uzimt");
      if (employeeFilter === "maintenance") return department.includes("ūk") || department.includes("uk") || department.includes("techn") || department.includes("sandel");

      return true;
    });

    if (!q) return visibleEmployees;

    return visibleEmployees.filter((employee) =>
      [
        employeeName(employee),
        employee.email,
        employeeRole(employee),
        employee.department,
        employee.contract_number,
        employee.staff_type,
        staffTypeLabel(employee.staff_type),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [employees, employeeFilter, query]);

  const employeeMap = useMemo(() => {
    return new Map(employees.map((employee) => [employee.user_id, employee]));
  }, [employees]);
  const activeEmployeeCount = employees.filter((employee) => employee.is_archived !== true && employee.is_active !== false).length;
  const inactiveEmployeeCount = employees.filter((employee) => employee.is_archived !== true && employee.is_active === false).length;

  const pendingVacations = vacations.filter((item) => item.status === "submitted" || item.status === "pending");
  const expiringCredentials = credentials.filter((item) => isExpiring(item.expires_at));
  const expiringEmployeeDocs = employees.filter(
    (employee) =>
      isExpiring(employee.professional_license_valid_until) ||
      isExpiring(employee.occupational_health_valid_until),
  );
  const trainingIssues = employees.filter((employee) => {
    const employeeTrainings = trainings.filter((item) => item.employee_id === employee.user_id);

    return employeeTrainings.length === 0;
  });
  const pendingInvites = invites.filter((invite) => invite.status === "pending");
  const activeEmployees = employees.filter((employee) => employee.is_archived !== true);
  const vacationEmployees = useMemo(() => {
    const map = new Map<string, Employee>();

    for (const employee of employees) {
      if (!employee.user_id) continue;
      if (employee.is_archived === true) continue;

      map.set(employee.user_id, employee);
    }

    return Array.from(map.values()).sort((a, b) =>
      employeeName(a).localeCompare(employeeName(b), "lt"),
    );
  }, [employees]);
  const archivedEmployees = employees.filter((employee) => employee.is_archived === true);

  const ftePlanRows = useMemo(
    () => buildFtePlanRows(personnelPositions, activeEmployees),
    [personnelPositions, activeEmployees],
  );

  const fteTotals = useMemo(() => {
    const planned = roundFte(ftePlanRows.reduce((sum, row) => sum + row.planned, 0));
    const filled = roundFte(ftePlanRows.reduce((sum, row) => sum + row.filled, 0));
    const free = roundFte(Math.max(0, planned - filled));
    const temporaryUnavailable = roundFte(
      vacations
        .filter((request) => request.status === "approved")
        .filter((request) => {
          const today = toDateInput(new Date());
          return request.start_date <= today && request.end_date >= today;
        })
        .reduce((sum, request) => {
          const employee = employees.find((item) => item.user_id === request.employee_id);
          return sum + Number(employee?.employment_rate || 1);
        }, 0),
    );

    return {
      planned,
      filled,
      free,
      temporaryUnavailable,
      replacementNeeded: temporaryUnavailable,
      percent: planned > 0 ? Math.round((filled / planned) * 100) : 0,
    };
  }, [ftePlanRows, vacations, employees]);

  const scheduleDays = useMemo(() => {
    const first = new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth(), 1);
    const last = new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth() + 1, 0);
    const rows: Date[] = [];
    for (let day = new Date(first); day <= last; day.setDate(day.getDate() + 1)) {
      rows.push(new Date(day));
    }
    return rows;
  }, [scheduleMonth]);

  const scheduleGridData = useMemo(() => {
    return activeEmployees.map((employee) =>
      scheduleDays.map((day) => {
        const key = toDateInput(day);
        const entry = scheduleEntries.find((item) => item.employee_id === employee.user_id && item.date === key);
        if (!entry) return "";
        if (entry.status) return entry.status;
        if (entry.start_datetime && entry.end_datetime) {
          return `${timeLabel(entry.start_datetime)}-${timeLabel(entry.end_datetime)}`;
        }
        return entry.note || "";
      }),
    );
  }, [activeEmployees, scheduleDays, scheduleEntries]);

  const scheduleComplianceRows = useMemo(() => {
    return activeEmployees.map((employee) => ({
      employee,
      plannedHours: 0,
      maxSevenDayHours: 0,
      maxSevenDayWorkDays: 0,
      shortestRestHours: null,
      minWeeklyRestHours: null,
      averageWeeklyHours: 0,
      status: "ok",
      errors: [],
      warnings: [],
    }));
  }, [activeEmployees]);

  const vacationReservations = useMemo(() => {
    return vacations
      .filter((request) => request.status === "submitted" || request.status === "pending" || request.status === "approved")
      .flatMap((request) => datesBetween(request.start_date, request.end_date).map((date) => {
        const meta = absenceTypeMeta(request.type);
        return {
          employee_id: request.employee_id,
          date,
          type: request.type || "annual_leave",
          code: meta.code,
          label: meta.label,
          note: request.note,
          status: request.status,
        };
      }));
  }, [vacations]);

  const trainingComplianceRows = useMemo(() => {
    return activeEmployees.map((employee) => {
      const rows = trainings.filter((training) => training.employee_id === employee.user_id);
      return {
        employee_id: employee.user_id,
        status: rows.length ? "ok" : "missing",
        missingHours: rows.length ? 0 : 1,
        requiredHours: 1,
        completedHours: rows.reduce((sum, row) => sum + (row.hours || 0), 0),
        expiresSoonCount: rows.filter((row) => isExpiring(row.expires_at)).length,
        expiredCount: rows.filter((row) => Boolean(row.expires_at && new Date(row.expires_at) < new Date())).length,
        missingTrainings: rows.length ? [] : ["Nėra registruotų mokymų"],
        expiringTrainings: [],
        blocking: rows.length === 0,
      };
    });
  }, [activeEmployees, trainings]);



  async function saveScheduleGridChanges(changes: unknown[]) {
    console.log("[TeamPage] schedule changes", changes);
    setMessage("Grafiko pakeitimai pažymėti. DB įrašymas gali būti prijungtas pagal jūsų work_schedule_entries schemą.");
  }

  function isAnnualVacation(type?: string | null) {
    return type === "annual_leave";
  }

  function isTemporaryVacation(type?: string | null) {
    return type === "short_leave";
  }

  function vacationEntitlementDays(employee?: Employee | null) {
    const text = [employee?.position, employee?.role, employee?.legacy_role, employee?.department, employee?.staff_type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const variable = /kintam|slenkan|pamain|grafik|sumine|suminė|variable/.test(text);
    const sixDay = /6\s*d|6\s*dien|šeši|sesi/.test(text);
    const socialServices = /social|soc\s|globos|individualios priežiūros|individuali priežiūra|priežiūros darbuotoj|slaug|užimtumo|psicholog/.test(text);
    const extraGuarantee = /negal|vienas augina|nepilnamet|iki 18/.test(text);

    if (socialServices) return sixDay ? 36 : 30;
    if (extraGuarantee) return sixDay ? 30 : 25;
    if (variable) return 20;
    return sixDay ? 24 : 20;
  }

  function usedAnnualVacationDays(employeeId: string) {
    return vacations
      .filter((request) =>
        request.employee_id === employeeId &&
        request.status === "approved" &&
        isAnnualVacation(request.type)
      )
      .reduce((sum, request) => sum + (request.requested_days || daysBetween(request.start_date, request.end_date)), 0);
  }

  function reservedAnnualVacationDays(employeeId: string) {
    return vacations
      .filter((request) =>
        request.employee_id === employeeId &&
        (request.status === "submitted" || request.status === "pending") &&
        isAnnualVacation(request.type)
      )
      .reduce((sum, request) => sum + (request.requested_days || daysBetween(request.start_date, request.end_date)), 0);
  }

  async function submitVacationRequest(options?: { allowNegativeBalance?: boolean }) {
    if (!organizationId) return;

    if (!vacationForm.employee_id) {
      setMessage("Pasirinkite darbuotoją.");
      return;
    }

    if (!vacationForm.start_date || !vacationForm.end_date) {
      setMessage("Nurodykite neatvykimo pradžios ir pabaigos datą.");
      return;
    }

    if (vacationForm.end_date < vacationForm.start_date) {
      setMessage("Pabaigos data negali būti ankstesnė už pradžios datą.");
      return;
    }

    const selectedEmployee = employees.find((employee) => employee.user_id === vacationForm.employee_id);
    const requestedDays = isTemporaryVacation(vacationForm.type) ? 0 : daysBetween(vacationForm.start_date, vacationForm.end_date);
    const entitlement = vacationEntitlementDays(selectedEmployee);
    const used = usedAnnualVacationDays(vacationForm.employee_id);
    const reserved = reservedAnnualVacationDays(vacationForm.employee_id);
    const left = Math.max(0, entitlement - used - reserved);

    if (isAnnualVacation(vacationForm.type) && requestedDays > left && !options?.allowNegativeBalance) {
      const ok = window.confirm(
        `Darbuotojui trūksta atostogų likučio.\n\nLikutis: ${left} d.\nPrašoma: ${requestedDays} d.\n\nAr leisti atostogas į minusą?`
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const noteParts = [];
      if (vacationForm.note) noteParts.push(vacationForm.note);
      if (isTemporaryVacation(vacationForm.type) && (vacationForm.start_time || vacationForm.end_time)) {
        noteParts.push(`Laikas: ${vacationForm.start_time || "—"}–${vacationForm.end_time || "—"}`);
      }
      if (isAnnualVacation(vacationForm.type) && requestedDays > left) {
        noteParts.push(`Leista į minusą: prašoma ${requestedDays} d., likutis ${left} d., rezervuota ${reserved} d.`);
      }

      const payload = {
        organization_id: organizationId,
        employee_id: vacationForm.employee_id,
        type: vacationForm.type,
        start_date: vacationForm.start_date,
        end_date: isTemporaryVacation(vacationForm.type) ? vacationForm.start_date : vacationForm.end_date,
        requested_days: requestedDays,
        note: noteParts.length ? noteParts.join(" · ") : null,
        status: "submitted",
      };

      const { data, error } = await supabase
        .from("vacation_requests")
        .insert(payload)
        .select("id, employee_id, type, start_date, end_date, status, requested_days, note, created_at")
        .single();

      if (error) throw error;

      const created = {
        ...(data as VacationRequest),
        status: (data as VacationRequest).status || "submitted",
        start_date: (data as VacationRequest).start_date || vacationForm.start_date,
        end_date: (data as VacationRequest).end_date || vacationForm.end_date,
      };

      setVacations((current) => [created, ...current]);
      setVacationForm({
        employee_id: vacationForm.employee_id,
        type: "annual_leave",
        start_date: toDateInput(new Date()),
        end_date: toDateInput(new Date()),
        start_time: "",
        end_time: "",
        note: "",
      });
      setVacationFilter("submitted");
      setMessage("Prašymas pateiktas vadovo patvirtinimui. Grafike jis rodomas kaip rezervacija.");
    } catch (error) {
      const readable = getReadableError(error);
      if (readable.includes("vacation_requests") || readable.includes("does not exist") || readable.includes("404")) {
        setMessage("Nerasta vacation_requests lentelė. Paleisk SQL migraciją neatvykimų moduliui.");
      } else {
        setMessage(readable);
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateVacationStatus(id: string, status: "approved" | "rejected") {
    setSaving(true);
    try {
      const request = vacations.find((item) => item.id === id);
      const { error } = await supabase.from("vacation_requests").update({ status }).eq("id", id);
      if (error) throw error;

      if (status === "approved" && request && !isTemporaryVacation(request.type)) {
        const meta = absenceTypeMeta(request.type);
        const rows = datesBetween(request.start_date, request.end_date).map((date) => ({
          organization_id: organizationId,
          employee_id: request.employee_id,
          date,
          status: `absence_${meta.code}`,
          note: `${meta.label} · patvirtinta${request.note ? ` · ${request.note}` : ""}`,
        }));

        if (rows.length) {
          const { error: scheduleError } = await supabase.from("work_schedule_entries").insert(rows);
          if (scheduleError) {
            console.warn("[TeamPage] Patvirtinta, bet nepavyko sukurti grafiko įrašų", scheduleError);
          } else {
            setScheduleEntries((current) => [
              ...current,
              ...rows.map((row) => ({
                employee_id: row.employee_id,
                date: row.date,
                status: row.status,
                note: row.note,
              })),
            ]);
          }
        }
      }

      setVacations((current) => current.map((request) => request.id === id ? { ...request, status } : request));
      setMessage(status === "approved" ? "Prašymas patvirtintas ir grafike rodomas kaip neatvykimas." : "Prašymas atmestas.");
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }


  function startCreatePositionPlan() {
    setPositionPlanForm(initialPositionPlanForm);
    setMessage("");
    changeTab("fte");
  }

  function editPositionPlan(position: PersonnelPosition) {
    setPositionPlanForm({
      id: position.id || "",
      department: position.department || "",
      position_name: position.position_name || "",
      planned_fte: Number(position.planned_fte || 0),
      coefficient_min: position.coefficient_min != null ? String(position.coefficient_min) : "",
      coefficient_max: position.coefficient_max != null ? String(position.coefficient_max) : "",
      minimum_day_shift: Number(position.minimum_day_shift || 0),
      minimum_night_shift: Number(position.minimum_night_shift || 0),
      active: position.active !== false,
    });
    setMessage("");
    changeTab("fte");
  }

  async function savePositionPlan() {
    if (!organizationId) {
      setMessage("Nepavyko nustatyti įstaigos.");
      return;
    }

    if (!positionPlanForm.position_name.trim()) {
      setMessage("Įrašyk pareigybės pavadinimą.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      organization_id: organizationId,
      department: positionPlanForm.department.trim() || null,
      position_name: positionPlanForm.position_name.trim(),
      planned_fte: Number(positionPlanForm.planned_fte || 0),
      coefficient_min: positionPlanForm.coefficient_min ? Number(positionPlanForm.coefficient_min) : null,
      coefficient_max: positionPlanForm.coefficient_max ? Number(positionPlanForm.coefficient_max) : null,
      minimum_day_shift: Number(positionPlanForm.minimum_day_shift || 0),
      minimum_night_shift: Number(positionPlanForm.minimum_night_shift || 0),
      active: positionPlanForm.active,
    };

    try {
      if (positionPlanForm.id) {
        const { error } = await supabase
          .from("personnel_positions")
          .update(payload)
          .eq("organization_id", organizationId)
          .eq("id", positionPlanForm.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("personnel_positions").insert(payload);
        if (error) throw error;
      }

      setPositionPlanForm(initialPositionPlanForm);
      setMessage("Etatų planas išsaugotas.");
      await loadAll();
      changeTab("fte");
    } catch (error) {
      const readable = getReadableError(error);
      if (readable.includes("personnel_positions") || readable.includes("schema cache") || readable.includes("does not exist")) {
        setMessage("Nerasta `personnel_positions` lentelė. Paleisk SQL migraciją etatų planui.");
      } else {
        setMessage(readable);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deletePositionPlan(positionId: string) {
    if (!organizationId || !positionId) return;
    const ok = window.confirm("Ar tikrai ištrinti šią pareigybės plano eilutę?");
    if (!ok) return;

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("personnel_positions")
        .delete()
        .eq("organization_id", organizationId)
        .eq("id", positionId);

      if (error) throw error;

      setPersonnelPositions((current) => current.filter((position) => position.id !== positionId));
      setMessage("Pareigybės plano eilutė ištrinta.");
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  const dashboardActivity = [
    {
      title: "Darbuotojų registras atnaujintas",
      meta: `${employees.length} darbuotojai sistemoje`,
    },
    {
      title: "Kvietimų modulis paruoštas",
      meta: `${pendingInvites.length} laukia patvirtinimo`,
    },
    {
      title: "Kvietimai į sistemą",
      meta: `${pendingInvites.length} laukia patvirtinimo`,
    },
    {
      title: "Dokumentų terminai",
      meta: `${expiringCredentials.length + expiringEmployeeDocs.length} reikia dėmesio`,
    },
  ];

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-950">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
          <p className="mt-4 text-lg font-black text-slate-700">Kraunama...</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Ruošiame personalo modulį.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f6f4] p-5 text-[#10251f]">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <section className="mb-4 overflow-hidden rounded-2xl border border-[#c9d8d0] bg-white shadow-sm">
          <div className="bg-[#486b5d] px-5 py-4 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
                  Personalo valdymas
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight">
                  Darbuotojai, grafikai ir prašymai
                </h1>
                <p className="mt-1 max-w-3xl text-sm font-semibold text-white/80">
                  Vienas darbo langas personalo procesams: prašymai, grafikas, mokymai, dokumentai ir teisės.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadAll()}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-black text-[#486b5d] shadow-sm transition hover:bg-[#f8faf8] active:scale-[0.98]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Atnaujinti
                </button>

                <button
                  type="button"
                  onClick={() => { setCreateModalMessage(""); setShowCreateModal(true); }}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/12 px-3 py-2 text-sm font-black text-white/90 ring-1 ring-white/20 transition hover:bg-white/18 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" />
                  Naujas darbuotojas
                </button>
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap gap-1 border-b border-[#dbe6e0] bg-[#eef4f1] px-4 py-2 text-sm font-black text-[#486b5d]">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => changeTab(item.key)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 transition ${
                    active
                      ? "bg-white text-[#486b5d] shadow-sm ring-1 ring-[#c9d8d0]"
                      : "text-[#486b5d] hover:bg-white/80"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => changeTab("schedule")}
              className="ml-auto rounded-lg border border-[#c2d3ca] bg-white px-3 py-2 text-xs font-black text-[#486b5d]"
            >
              Kompaktiškas režimas
            </button>
          </nav>
        </section>

        {message ? (
          <div className="rounded-2xl border border-[#c9d8d0] bg-[#eef4f1] p-4 text-sm font-black text-[#486b5d]">
            {message}
          </div>
        ) : null}

        <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
          <button
            type="button"
            onClick={() => changeTab("employees")}
            className="rounded-xl border border-[#c9d8d0] bg-white p-4 text-left shadow-sm transition hover:bg-[#f8faf8]"
          >
            <p className="text-[11px] font-black uppercase tracking-wide text-[#6a7e75]">Darbuotojai</p>
            <p className="mt-1 text-2xl font-black text-[#10251f]">{activeEmployees.length}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{employees.length} registre · {archivedEmployees.length} archyve</p>
          </button>

          <button
            type="button"
            onClick={() => changeTab("fte")}
            className="rounded-xl border border-[#c9d8d0] bg-white p-4 text-left shadow-sm transition hover:bg-[#f8faf8]"
          >
            <p className="text-[11px] font-black uppercase tracking-wide text-[#6a7e75]">Etatai</p>
            <p className="mt-1 text-2xl font-black text-[#8a5a13]">{formatFte(fteTotals.free)}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">laisva iš {formatFte(fteTotals.planned)} et.</p>
          </button>

          <button
            type="button"
            onClick={() => changeTab("vacations")}
            className="rounded-xl border border-[#c9d8d0] bg-white p-4 text-left shadow-sm transition hover:bg-[#f8faf8]"
          >
            <p className="text-[11px] font-black uppercase tracking-wide text-[#6a7e75]">Atostogos</p>
            <p className="mt-1 text-2xl font-black text-[#8a5a13]">{pendingVacations.length}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">laukia patvirtinimo</p>
          </button>

          <button
            type="button"
            onClick={() => changeTab("schedule")}
            className="rounded-xl border border-[#c9d8d0] bg-white p-4 text-left shadow-sm transition hover:bg-[#f8faf8]"
          >
            <p className="text-[11px] font-black uppercase tracking-wide text-[#6a7e75]">Grafikas</p>
            <p className="mt-1 text-2xl font-black text-[#8a5a13]">{scheduleComplianceRows.length}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">įspėjimai</p>
          </button>

          <button
            type="button"
            onClick={() => changeTab("trainings")}
            className="rounded-xl border border-[#c9d8d0] bg-white p-4 text-left shadow-sm transition hover:bg-[#f8faf8]"
          >
            <p className="text-[11px] font-black uppercase tracking-wide text-[#6a7e75]">Mokymai</p>
            <p className="mt-1 text-2xl font-black text-[#10251f]">{trainingIssues.length}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">neatitikimai</p>
          </button>

          <button
            type="button"
            onClick={() => changeTab("docs")}
            className="rounded-xl border border-[#c9d8d0] bg-white p-4 text-left shadow-sm transition hover:bg-[#f8faf8]"
          >
            <p className="text-[11px] font-black uppercase tracking-wide text-[#6a7e75]">Dokumentai</p>
            <p className="mt-1 text-2xl font-black text-[#10251f]">{expiringCredentials.length + expiringEmployeeDocs.length}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">baigiasi</p>
          </button>

          <button
            type="button"
            onClick={() => changeTab("candidates")}
            className="rounded-xl border border-[#c9d8d0] bg-white p-4 text-left shadow-sm transition hover:bg-[#f8faf8]"
          >
            <p className="text-[11px] font-black uppercase tracking-wide text-[#6a7e75]">Kandidatai</p>
            <p className="mt-1 text-2xl font-black text-[#10251f]">{candidates.length}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">atrankos</p>
          </button>
        </section>

        {tab !== "overview" ? (
          <section className="mb-4 rounded-2xl border border-[#c9d8d0] bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#dbe6e0] bg-[#f8faf8] px-4 py-3">
              <span className="mr-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">Veiksmai</span>
              <button
                type="button"
                onClick={() => { setCreateModalMessage(""); setShowCreateModal(true); }}
                className="rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d] hover:bg-[#eef4f1]"
              >
                + Darbuotojas
              </button>
              <button
                type="button"
                onClick={() => changeTab("vacations")}
                className="rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d] hover:bg-[#eef4f1]"
              >
                + Prašymas
              </button>
              <button
                type="button"
                onClick={() => void loadAll()}
                className="rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d] hover:bg-[#eef4f1]"
              >
                Atnaujinti
              </button>

              <div className="mx-2 hidden h-7 w-px bg-[#dbe6e0] md:block" />

              <span className="mr-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">Filtrai</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-9 min-w-[220px] rounded-lg border border-[#c2d3ca] bg-white px-3 text-xs font-semibold outline-none focus:border-[#486b5d]"
                placeholder="Ieškoti..."
              />
              <button
                type="button"
                onClick={() => changeTab("schedule")}
                className="ml-auto rounded-lg bg-[#fff9e8] px-3 py-2 text-xs font-black text-[#8a5a13] ring-1 ring-[#ead8a7]"
              >
                Grafiko įspėjimai: {scheduleComplianceRows.length}
              </button>
            </div>
          </section>
        ) : null}

        {tab === "overview" && (
          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="text-2xl font-black tracking-tight">Artimiausi dokumentų terminai</h2>
              <div className="mt-5 space-y-3">
                {[...expiringCredentials.slice(0, 6), ...expiringEmployeeDocs.slice(0, 6).map((employee) => ({
                  id: employee.user_id,
                  employee_id: employee.user_id,
                  type: "Darbuotojo dokumentai",
                  number: employee.professional_license_number || "—",
                  expires_at: employee.professional_license_valid_until || employee.occupational_health_valid_until,
                } as Credential))].slice(0, 8).map((item) => (
                  <ActivityItem
                    key={`${item.id}-${item.type}`}
                    title={`${employeeName(employeeMap.get(item.employee_id))} · ${item.type}`}
                    meta={`Galioja iki: ${fmt(item.expires_at)} · Nr.: ${item.number || "—"}`}
                  />
                ))}
                {expiringCredentials.length + expiringEmployeeDocs.length === 0 && (
                  <EmptyState text="Dokumentų terminų artimiausiu metu nėra." />
                )}
              </div>
            </Card>

            <Card>
              <h2 className="text-2xl font-black tracking-tight">Kandidatai ir priėmimas</h2>
              <div className="mt-5 space-y-3">
                <ActivityItem title="Kandidatų anketos" meta={`${candidates.length} įrašai`} />
                <ActivityItem title="Laukia kvietimų" meta={`${pendingInvites.length} kvietimai`} />
                <ActivityItem title="Aktyvūs darbuotojai" meta={`${activeEmployees.length} iš ${employees.length}`} />
              </div>
            </Card>
          </section>
        )}

        {tab === "employees" && (
          <Card>
            <div id="employee-register-tabs" className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                  Registras
                </p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-[#10251f]">
                  Darbuotojų kortelės
                </h2>
                <p className="mt-1 font-semibold text-slate-500">
                  Darbuotojai, pareigos, skyriai ir sistemos prieigos.
                </p>
              </div>

              <label className="relative block w-full lg:w-[430px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8aa0b8]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ieškoti pagal vardą, pareigas, skyrių..."
                  className="h-12 w-full rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] pl-12 pr-4 text-sm font-bold outline-none placeholder:text-[#8aa0b8] transition focus:border-emerald-500 focus:bg-white"
                />
              </label>
            </div>

            <nav className="mt-5 flex flex-wrap gap-1 rounded-2xl border border-[#dbe6e0] bg-[#eef4f1] p-2 text-sm font-black text-[#486b5d]">
              <button
                type="button"
                onClick={() => {
                  closeEmployeeEditor();
                  setEmployeeEditorTab("register");
                }}
                className={`rounded-xl px-4 py-2 transition ${
                  employeeEditorTab === "register" || !editingEmployee
                    ? "bg-white shadow-sm ring-1 ring-[#c9d8d0]"
                    : "hover:bg-white/80"
                }`}
              >
                Visi darbuotojai
              </button>

              {[
                ["profile", "Duomenys"],
                ["contract", "Sutartis"],
                ["access", "Pareigos ir teisės"],
                ["documents", "Dokumentai"],
                ["trainings", "Mokymai"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  disabled={!editingEmployee}
                  onClick={() => setEmployeeEditorTab(key as EmployeeEditorTab)}
                  className={`rounded-xl px-4 py-2 transition ${
                    editingEmployee && employeeEditorTab === key
                      ? "bg-white shadow-sm ring-1 ring-[#c9d8d0]"
                      : editingEmployee
                        ? "hover:bg-white/80"
                        : "cursor-not-allowed opacity-45"
                  }`}
                  title={!editingEmployee ? "Pirma pasirinkite darbuotoją" : undefined}
                >
                  {label}
                </button>
              ))}

              {editingEmployee ? (
                <button
                  type="button"
                  onClick={closeEmployeeEditor}
                  className="ml-auto rounded-xl border border-[#dbe6e0] bg-white px-4 py-2 text-[#486b5d]"
                >
                  Uždaryti kortelę
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setCreateModalMessage(""); setShowCreateModal(true); }}
                  className="ml-auto rounded-xl border border-[#dbe6e0] bg-white px-4 py-2 text-[#486b5d]"
                >
                  + Darbuotojas
                </button>
              )}
            </nav>

            <section className="mt-4 border-b border-[#dbe6e0] bg-[#f8faf8] px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">
                  Filtrai
                </span>
                {[
                  ["all", `Visi (${employees.length})`],
                  ["active", `Aktyvūs (${activeEmployeeCount})`],
                  ["inactive", `Neaktyvūs (${inactiveEmployeeCount})`],
                  ["archived", `Archyvas (${archivedEmployees.length})`],
                  ["administration", "Administracija"],
                  ["health", "Slauga / medikai"],
                  ["social", "Socialinė sritis"],
                  ["maintenance", "Ūkis"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEmployeeFilter(key as EmployeeFilterKey)}
                    className={
                      employeeFilter === key
                        ? "rounded-lg bg-emerald-700 px-4 py-2 text-xs font-black text-white"
                        : "rounded-lg border border-[#dbe6e0] bg-white px-4 py-2 text-xs font-black text-[#486b5d]"
                    }
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void loadAll()}
                  className="ml-auto rounded-lg border border-[#dbe6e0] bg-white px-4 py-2 text-xs font-black text-[#486b5d]"
                >
                  Atnaujinti
                </button>
              </div>
            </section>

            {filteredEmployees.length === 0 ? (
              <EmptyState text="Darbuotojų nerasta." />
            ) : (
              <div className="mt-5 grid gap-3">
                {filteredEmployees.map((employee) => (
                  <EmployeeRowCard
                    key={employeeKey(employee)}
                    employee={employee}
                    selected={editingEmployee ? employeeKey(editingEmployee) === employeeKey(employee) : false}
                    onEdit={() => openEmployeeEditor(employee)}
                  />
                ))}
              </div>
            )}

            {editingEmployee && editForm && employeeEditorTab !== "register" ? (
              <EmployeeTabbedEditor
                employee={editingEmployee}
                editForm={editForm}
                activeTab={employeeEditorTab}
                trainings={trainings.filter((training) => training.employee_id === editingEmployee.user_id)}
                credentials={credentials.filter((credential) => credential.employee_id === editingEmployee.user_id)}
                saving={saving}
                onChange={setEditForm}
                onTabChange={setEmployeeEditorTab}
                onTogglePermission={toggleExtraPermission}
                onSave={() => void saveEmployee()}
              />
            ) : null}
          </Card>
        )}

        {tab === "fte" && (
          <FtePlanModule
            employees={activeEmployees}
            positions={personnelPositions}
            rows={ftePlanRows}
            totals={fteTotals}
            form={positionPlanForm}
            saving={saving}
            onFormChange={setPositionPlanForm}
            onNew={startCreatePositionPlan}
            onEdit={editPositionPlan}
            onSave={() => void savePositionPlan()}
            onDelete={(id) => void deletePositionPlan(id)}
          />
        )}

        {tab === "access" && <StaffTypesModule />}

        {tab === "docs" && (
          <DocumentAcknowledgementsModule
            organizationId={organizationId}
            employees={employees.map((employee) => ({
              id: employee.user_id,
              full_name: employeeName(employee),
              role: employee.position || employee.role || null,
            }))}
            acknowledgements={[]}
            onRefresh={loadAll}
          />
        )}

        {tab === "trainings" && (
          <TrainingModule
            organizationId={organizationId}
            employees={activeEmployees.map((employee) => ({
              id: employee.user_id,
              full_name: employeeName(employee),
              name: employeeName(employee),
              role: employee.position || employee.role || null,
              department: employee.department || null,
            }))}
            trainings={trainings.map((training) => ({
              ...training,
              title: training.title || "Mokymas",
            }))}
            onRefresh={loadAll}
          />
        )}

        {tab === "vacations" && (
          <VacationRequests
            employees={vacationEmployees}
            requests={vacations}
            form={vacationForm}
            saving={saving}
            absenceTypes={absenceTypes}
            activeFilter={vacationFilter}
            onFilterChange={setVacationFilter}
            onFormChange={setVacationForm}
            onSubmit={submitVacationRequest}
            onApprove={(id) => updateVacationStatus(id, "approved")}
            onReject={(id) => updateVacationStatus(id, "rejected")}
            employeeName={employeeName}
            employeeRole={employeeRole}
            daysBetween={daysBetween}
            fmt={fmt}
            absenceTypeMeta={absenceTypeMeta}
            absenceStatusLabel={absenceStatusLabel}
          />
        )}

        {tab === "schedule" && (
          <ScheduleBlock
            employees={activeEmployees}
            schedule={scheduleEntries}
            scheduleMonth={scheduleMonth}
            setScheduleMonth={setScheduleMonth}
            scheduleDays={scheduleDays}
            scheduleGridData={scheduleGridData}
            scheduleComplianceRows={scheduleComplianceRows}
            scheduleWarningRows={scheduleComplianceRows}
            vacationReservations={vacationReservations}
            trainingComplianceRows={trainingComplianceRows}
            saving={saving}
            addMonths={addMonths}
            monthLabel={monthLabel}
            toDateInput={toDateInput}
            employeeName={employeeName}
            employeeRole={employeeRole}
            onSaveGridChanges={saveScheduleGridChanges}
          />
        )}



        {tab === "candidates" && (
          <CandidatesModule
            organizationId={organizationId}
            candidates={candidates}
            onRefresh={loadAll}
          />
        )}

        {tab === "invites" && (
          <Card>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                  Kvietimai
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">
                  Kvietimai prisijungti
                </h2>
                <p className="mt-1 font-semibold text-slate-500">
                  Čia matomi pakviesti darbuotojai. Kai darbuotojas priims kvietimą ir prisijungs, jis bus valdomas darbuotojų registre.
                </p>
              </div>

              <button
                type="button"
                onClick={() => { setCreateModalMessage(""); setShowCreateModal(true); }}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-extrabold text-white shadow-sm transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Naujas kvietimas
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {invites.length === 0 && <EmptyState text="Kvietimų nėra." />}

              {invites.map((invite) => (
                <article key={invite.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-black text-slate-950">{invite.email || "Kvietimas"}</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        Rolė: {invite.role || "employee"} · Sukurta: {fmt(invite.created_at)}
                      </p>
                    </div>

                    <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-emerald-700">
                      {invite.status || "pending"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </Card>
        )}
      </div>

      {showCreateModal && (
        <Modal
          title="Naujas darbuotojas"
          desc="Įveskite pagrindinius duomenis, pareigas ir, jei reikia, išsiųskite kvietimą prisijungti."
          onClose={() => setShowCreateModal(false)}
        >
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void createEmployee();
            }}
          >
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-xl font-black">1. Darbuotojo duomenys</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Čia redaguojami pagrindiniai darbuotojo duomenys. Pavyzdžiai laukeliuose yra tik pagalba — jų trinti nereikia, tiesiog įrašykite tikrą reikšmę.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Vardas">
                  <input
                    value={newEmployeeForm.first_name}
                    onChange={(event) =>
                      setNewEmployeeForm((prev) => ({ ...prev, first_name: event.target.value }))
                    }
                    className="input"
                    placeholder="Vardas"
                  />
                </Field>

                <Field label="Pavardė">
                  <input
                    value={newEmployeeForm.last_name}
                    onChange={(event) =>
                      setNewEmployeeForm((prev) => ({ ...prev, last_name: event.target.value }))
                    }
                    className="input"
                    placeholder="Pavardė"
                  />
                </Field>

                <Field label="El. paštas">
                  <input
                    value={newEmployeeForm.email}
                    onChange={(event) =>
                      setNewEmployeeForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    className="input"
                    type="email"
                    placeholder="vardas@imone.lt"
                  />
                </Field>

                <Field label="Telefonas">
                  <input
                    value={newEmployeeForm.phone}
                    onChange={(event) =>
                      setNewEmployeeForm((prev) => ({ ...prev, phone: event.target.value }))
                    }
                    className="input"
                    placeholder="+370..."
                  />
                </Field>

                <Field label="Konkrečios pareigos">
                  <input
                    value={newEmployeeForm.position}
                    onChange={(event) =>
                      setNewEmployeeForm((prev) => ({ ...prev, position: event.target.value }))
                    }
                    className="input"
                    placeholder="Pvz., vyr. slaugytoja"
                  />
                </Field>

                <Field label="Skyrius">
                  <input
                    value={newEmployeeForm.department}
                    onChange={(event) =>
                      setNewEmployeeForm((prev) => ({ ...prev, department: event.target.value }))
                    }
                    className="input"
                    placeholder="Pvz., Slauga, Ūkis"
                  />
                </Field>

                <Field label="Sistemos pareigų tipas">
                  <select
                    value={newEmployeeForm.staff_type}
                    onChange={(event) =>
                      setNewEmployeeForm((prev) => ({ ...prev, staff_type: event.target.value }))
                    }
                    className="input"
                  >
                    <option value="">Pasirinkti</option>
                    {STAFF_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Rolė">
                  <select
                    value={newEmployeeForm.role}
                    onChange={(event) =>
                      setNewEmployeeForm((prev) => ({ ...prev, role: event.target.value }))
                    }
                    className="input"
                  >
                    <option value="employee">Darbuotojas</option>
                    <option value="admin">Administratorius</option>
                    <option value="owner">Savininkas</option>
                  </select>
                </Field>

                <Field label="Pastabos" full>
                  <textarea
                    value={newEmployeeForm.notes}
                    onChange={(event) =>
                      setNewEmployeeForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    className="input min-h-28 resize-none"
                    placeholder="Pastabos apie darbuotoją, kandidatą ar priėmimą..."
                  />
                </Field>
              </div>

              <label className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-extrabold text-emerald-800">
                <input
                  type="checkbox"
                  checked={newEmployeeForm.send_invite}
                  onChange={(event) =>
                    setNewEmployeeForm((prev) => ({ ...prev, send_invite: event.target.checked }))
                  }
                />
                Siųsti kvietimą prisijungti prie sistemos, jei nurodytas el. paštas
              </label>

              <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold leading-6 text-blue-800">
                Šis veiksmas sukuria kvietimą prisijungti. Darbuotojas į darbuotojų registrą patenka tada,
                kai priima kvietimą ir susikuria paskyrą. Taip nekuriamas netikras `user_id` organization_members lentelėje.
              </div>
            </div>

            {createModalMessage ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 font-extrabold text-rose-700">
                {createModalMessage}
              </div>
            ) : null}

            <ModalFooter
              saving={saving}
              onCancel={() => setShowCreateModal(false)}
              submitText="Sukurti kvietimą"
            />
          </form>
        </Modal>
      )}



      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.85rem;
          border: 1px solid #dbe3ef;
          background: white;
          padding: 0.72rem 0.9rem;
          font-weight: 800;
          color: #0f172a;
          outline: none;
        }

        .input:focus {
          border-color: #10b981;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.12);
        }
      `}</style>
    </main>
  );
}


function FtePlanModule({
  employees,
  positions,
  rows,
  totals,
  form,
  saving,
  onFormChange,
  onNew,
  onEdit,
  onSave,
  onDelete,
}: {
  employees: Employee[];
  positions: PersonnelPosition[];
  rows: FtePlanRow[];
  totals: {
    planned: number;
    filled: number;
    free: number;
    temporaryUnavailable: number;
    replacementNeeded: number;
    percent: number;
  };
  form: PositionPlanForm;
  saving: boolean;
  onFormChange: (form: PositionPlanForm) => void;
  onNew: () => void;
  onEdit: (position: PersonnelPosition) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}) {
  const planIsMissing = positions.length === 0;

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
            Personalo planas
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-[#10251f]">
            Etatų planas ir FTE
          </h2>
          <p className="mt-1 max-w-3xl font-semibold text-slate-500">
            Čia suvedami planuojami etatai, koeficientai ir minimalus pamainų poreikis. Faktinis užimtumas skaičiuojamas iš darbuotojų etato dalių.
          </p>
        </div>

        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#047857] px-5 py-3 font-black text-white shadow-sm transition hover:bg-[#065f46]"
        >
          <Plus className="h-4 w-4" />
          Nauja pareigybė
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <FteSmallStat label="Planuota etatų" value={formatFte(totals.planned)} />
        <FteSmallStat label="Užimta" value={formatFte(totals.filled)} />
        <FteSmallStat label="Laisvi etatai" value={formatFte(totals.free)} tone={totals.free > 0 ? "red" : "emerald"} />
        <FteSmallStat label="Laikinai nedirba" value={formatFte(totals.temporaryUnavailable)} tone={totals.temporaryUnavailable > 0 ? "amber" : "emerald"} />
      </div>

      {planIsMissing ? (
        <div className="mt-5 rounded-2xl border border-[#ead8a7] bg-[#fff9e8] p-4 text-sm font-bold text-[#8a5a13]">
          Etatų planas dar nesuvestas. Žemiau matomi preliminarūs skaičiai pagal esamus darbuotojus. Įrašyk planuojamas pareigybes, kad sistema galėtų tiksliai skaičiuoti trūkumus.
        </div>
      ) : null}

      <section className="mt-5 rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Field label="Padalinys">
            <input
              value={form.department}
              onChange={(event) => onFormChange({ ...form, department: event.target.value })}
              className="input"
              placeholder="Pvz., Slauga"
            />
          </Field>

          <Field label="Pareigybė">
            <input
              value={form.position_name}
              onChange={(event) => onFormChange({ ...form, position_name: event.target.value })}
              className="input"
              placeholder="Pvz., Slaugytojas"
            />
          </Field>

          <Field label="Planuota etatų">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.planned_fte}
              onChange={(event) => onFormChange({ ...form, planned_fte: Number(event.target.value) })}
              className="input"
            />
          </Field>

          <Field label="Koef. nuo">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.coefficient_min}
              onChange={(event) => onFormChange({ ...form, coefficient_min: event.target.value })}
              className="input"
              placeholder="1.05"
            />
          </Field>

          <Field label="Koef. iki">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.coefficient_max}
              onChange={(event) => onFormChange({ ...form, coefficient_max: event.target.value })}
              className="input"
              placeholder="1.35"
            />
          </Field>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="h-[50px] flex-1 rounded-2xl bg-[#047857] px-4 font-black text-white transition hover:bg-[#065f46] disabled:opacity-60"
            >
              {saving ? "Saugoma..." : form.id ? "Atnaujinti" : "Pridėti"}
            </button>
            {form.id ? (
              <button
                type="button"
                onClick={onNew}
                className="h-[50px] rounded-2xl border border-[#dbe6e0] bg-white px-4 font-black text-[#486b5d]"
              >
                Naujas
              </button>
            ) : null}
          </div>

          <Field label="Min. dienos pamaina">
            <input
              type="number"
              min="0"
              step="0.25"
              value={form.minimum_day_shift}
              onChange={(event) => onFormChange({ ...form, minimum_day_shift: Number(event.target.value) })}
              className="input"
            />
          </Field>

          <Field label="Min. nakties pamaina">
            <input
              type="number"
              min="0"
              step="0.25"
              value={form.minimum_night_shift}
              onChange={(event) => onFormChange({ ...form, minimum_night_shift: Number(event.target.value) })}
              className="input"
            />
          </Field>

          <label className="flex items-center gap-3 rounded-2xl border border-[#dbe6e0] bg-white px-4 py-3 font-black text-[#486b5d] md:col-span-2 xl:col-span-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => onFormChange({ ...form, active: event.target.checked })}
              className="h-5 w-5 accent-emerald-700"
            />
            Aktyvi pareigybė
          </label>
        </div>
      </section>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[#dbe6e0]">
        <div className="hidden grid-cols-[1.2fr_0.65fr_0.65fr_0.65fr_0.85fr_0.7fr] bg-[#f8faf8] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#6a7e75] lg:grid">
          <div>Pareigybė</div>
          <div>Užpildyta</div>
          <div>Laisva</div>
          <div>Koef.</div>
          <div>Min. pamaina</div>
          <div>Veiksmai</div>
        </div>

        <div className="divide-y divide-[#eef4f1] bg-white">
          {rows.length === 0 ? (
            <EmptyState text="Etatų plano eilučių dar nėra." />
          ) : (
            rows.map((row) => {
              const source = positions.find((position) => position.id === row.id);

              return (
                <div
                  key={row.id}
                  className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1.2fr_0.65fr_0.65fr_0.65fr_0.85fr_0.7fr] lg:items-center"
                >
                  <div>
                    <div className="font-black text-[#10251f]">{row.title}</div>
                    <div className="mt-1 text-xs font-bold text-[#6a7e75]">{row.department || "Padalinys nenurodytas"}</div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                      <div
                        className={`h-full rounded-full ${
                          row.tone === "emerald"
                            ? "bg-[#047857]"
                            : row.tone === "red"
                              ? "bg-red-700"
                              : "bg-[#ca8a04]"
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, row.percent))}%` }}
                      />
                    </div>
                  </div>

                  <div className="font-black">{formatFte(row.filled)} / {formatFte(row.planned)} et.</div>

                  <div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        row.free > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {formatFte(row.free)} et.
                    </span>
                  </div>

                  <div className="font-bold text-[#6a7e75]">{row.coefficient}</div>

                  <div className="text-xs font-bold text-[#6a7e75]">
                    Diena: {formatFte(row.minimumDayShift)} · Naktis: {formatFte(row.minimumNightShift)}
                    <div className="mt-1">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          row.tone === "emerald"
                            ? "bg-emerald-50 text-emerald-700"
                            : row.tone === "red"
                              ? "bg-red-50 text-red-700"
                              : "bg-[#fff9e8] text-[#8a5a13]"
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {source ? (
                      <button
                        type="button"
                        onClick={() => onEdit(source)}
                        className="rounded-xl border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d]"
                      >
                        Redaguoti
                      </button>
                    ) : null}
                    {source ? (
                      <button
                        type="button"
                        onClick={() => onDelete(source.id)}
                        className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-700"
                      >
                        Ištrinti
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">
          Pamainų rizikos
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-white p-4">
            <div className="font-black text-[#10251f]">
              {totals.replacementNeeded > 0
                ? `Reikia pavaduoti ${formatFte(totals.replacementNeeded)} et.`
                : "Pavadavimo poreikio nerasta"}
            </div>
            <div className="mt-1 text-sm font-bold text-blue-700/70">
              Skaičiuojama pagal šiandien patvirtintus neatvykimus.
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-white p-4">
            <div className="font-black text-[#10251f]">
              Minimalios pamainos: {rows.reduce((sum, row) => sum + row.minimumDayShift, 0)} d. / {rows.reduce((sum, row) => sum + row.minimumNightShift, 0)} n.
            </div>
            <div className="mt-1 text-sm font-bold text-blue-700/70">
              Kitas žingsnis — lyginti grafiką su minimaliu pareigybių poreikiu.
            </div>
          </div>
        </div>
      </section>
    </Card>
  );
}

function FteSmallStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber" | "red";
}) {
  const classes =
    tone === "red"
      ? "border-red-100 bg-red-50 text-red-700"
      : tone === "amber"
        ? "border-[#fff0c2] bg-[#fff9e8] text-[#8a5a13]"
        : tone === "emerald"
          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
          : "border-[#dbe6e0] bg-[#f8faf8] text-[#10251f]";

  return (
    <article className={`rounded-2xl border p-4 ${classes}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </article>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </article>
  );
}

function StatCard({
  icon,
  title,
  value,
  meta,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  meta: string;
  tone: "emerald" | "amber" | "blue" | "rose";
  onClick?: () => void;
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    rose: "bg-rose-50 text-rose-700",
  }[tone];

  const textClass = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    blue: "text-blue-700",
    rose: "text-rose-700",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${toneClass}`}>
          {icon}
        </div>

        <div>
          <p className="font-extrabold text-slate-500">{title}</p>
          <p className="mt-1 text-4xl font-black">
            {value} <span className={`text-sm font-bold ${textClass}`}>{meta}</span>
          </p>
        </div>
      </div>
    </button>
  );
}

function ActionCard({
  title,
  desc,
  onClick,
}: {
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50 active:scale-[0.99]"
    >
      <span>
        <b>{title}</b>
        <br />
        <small className="font-semibold text-slate-500">{desc}</small>
      </span>

      <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
    </button>
  );
}

function ActivityItem({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
        <CheckCircle2 className="h-5 w-5" />
      </div>

      <div>
        <p className="font-black text-slate-900">{title}</p>
        <p className="text-sm font-semibold text-slate-500">{meta}</p>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  muted = false,
}: {
  title: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 ${muted ? "bg-slate-50" : "bg-emerald-50"}`}>
      <p className="text-sm font-extrabold text-slate-500">{title}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function PriorityItem({
  title,
  value,
  tone,
  onClick,
}: {
  title: string;
  value: string;
  tone: "amber" | "rose" | "blue";
  onClick: () => void;
}) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    blue: "bg-blue-50 text-blue-700",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
    >
      <span className="font-black text-slate-900">{title}</span>
      <span className={`rounded-full px-3 py-1 text-sm font-black ${toneClass}`}>{value}</span>
    </button>
  );
}


function EmployeeTabbedEditor({
  employee,
  editForm,
  activeTab,
  trainings,
  credentials,
  saving,
  onChange,
  onTabChange,
  onTogglePermission,
  onSave,
}: {
  employee: Employee;
  editForm: EditForm;
  activeTab: EmployeeEditorTab;
  trainings: Training[];
  credentials: Credential[];
  saving: boolean;
  onChange: (form: EditForm) => void;
  onTabChange: (tab: EmployeeEditorTab) => void;
  onTogglePermission: (permission: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#c9d8d0] bg-white shadow-sm">
      <header className="border-b border-[#dbe6e0] bg-[#486b5d] px-5 py-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-black text-emerald-700 shadow-sm">
              {employeeName(employee).slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
                Redaguojama kortelė
              </p>
              <h3 className="mt-1 text-2xl font-black">{employeeName(employee)}</h3>
              <p className="mt-1 text-sm font-semibold text-white/75">
                {editForm.position || "Pareigos nenurodytos"} · {editForm.department || "Skyrius nenurodytas"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-xl bg-white px-4 py-2 text-sm font-black text-[#486b5d] shadow-sm disabled:opacity-60"
          >
            {saving ? "Saugoma..." : "Išsaugoti"}
          </button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-[#dbe6e0] bg-[#eef4f1] px-4 py-2 text-sm font-black text-[#486b5d]">
        {[
          ["profile", "Duomenys"],
          ["contract", "Sutartis"],
          ["access", "Pareigos ir teisės"],
          ["documents", "Dokumentai"],
          ["trainings", "Mokymai"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key as EmployeeEditorTab)}
            className={`rounded-xl px-4 py-2 transition ${
              activeTab === key
                ? "bg-white shadow-sm ring-1 ring-[#c9d8d0]"
                : "hover:bg-white/80"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="p-4">
        {activeTab === "profile" ? (
          <section className="grid gap-3 md:grid-cols-2">
            <Field label="Vardas">
              <input value={editForm.first_name} onChange={(event) => onChange({ ...editForm, first_name: event.target.value })} className="input" />
            </Field>
            <Field label="Pavardė">
              <input value={editForm.last_name} onChange={(event) => onChange({ ...editForm, last_name: event.target.value })} className="input" />
            </Field>
            <Field label="Rodomas vardas">
              <input value={editForm.full_name} onChange={(event) => onChange({ ...editForm, full_name: event.target.value })} className="input" />
            </Field>
            <Field label="El. paštas">
              <input value={editForm.email} onChange={(event) => onChange({ ...editForm, email: event.target.value })} className="input" type="email" />
            </Field>
            <Field label="Telefonas">
              <input value={editForm.phone} onChange={(event) => onChange({ ...editForm, phone: event.target.value })} className="input" />
            </Field>
            <Field label="Gimimo data">
              <input type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={editForm.birth_date} onChange={(event) => onChange({ ...editForm, birth_date: event.target.value })} className="input" />
            </Field>
          </section>
        ) : null}

        {activeTab === "contract" ? (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Konkrečios pareigos">
              <input value={editForm.position} onChange={(event) => onChange({ ...editForm, position: event.target.value })} className="input" placeholder="Pvz., vyr. slaugytoja" />
            </Field>
            <Field label="Skyrius">
              <input value={editForm.department} onChange={(event) => onChange({ ...editForm, department: event.target.value })} className="input" />
            </Field>
            <Field label="Darbo sutarties numeris">
              <input value={editForm.contract_number} onChange={(event) => onChange({ ...editForm, contract_number: event.target.value })} className="input" placeholder="Pvz., DS-2026-001" />
            </Field>
            <Field label="Etato dydis">
              <input type="number" step="0.01" min="0" max="2" value={editForm.employment_rate || 1} onChange={(event) => onChange({ ...editForm, employment_rate: Number(event.target.value) })} className="input" />
            </Field>
            <Field label="Savaitės valandos">
              <input type="number" step="1" min="1" max="80" value={editForm.weekly_hours || 40} onChange={(event) => onChange({ ...editForm, weekly_hours: Number(event.target.value) })} className="input" />
            </Field>
            <Field label="Darbo tipas">
              <select value={editForm.employment_type || "full_time"} onChange={(event) => onChange({ ...editForm, employment_type: event.target.value })} className="input">
                <option value="full_time">Pilnas etatas</option>
                <option value="part_time">Nepilnas etatas</option>
                <option value="temporary">Terminuota</option>
                <option value="internship">Praktika</option>
                <option value="volunteer">Savanoris</option>
                <option value="night_only">Naktinis</option>
              </select>
            </Field>
            <Field label="Darbo pradžia">
              <input type="date" value={editForm.employment_start_date} onChange={(event) => onChange({ ...editForm, employment_start_date: event.target.value })} className="input" />
            </Field>
            <Field label="Atleidimo data">
              <input type="date" value={editForm.termination_date} onChange={(event) => onChange({ ...editForm, termination_date: event.target.value, is_active: event.target.value ? false : editForm.is_active })} className="input" />
            </Field>
            <Field label="Archyvavimo / atleidimo pastaba" full>
              <textarea value={editForm.archive_reason} onChange={(event) => onChange({ ...editForm, archive_reason: event.target.value })} className="input min-h-[80px]" placeholder="Pvz., darbo sutartis nutraukta darbuotojo prašymu" />
            </Field>

            <button
              type="button"
              onClick={() => onChange({ ...editForm, is_active: !editForm.is_active, is_archived: !editForm.is_active ? false : editForm.is_archived })}
              className={`rounded-2xl border p-4 text-left font-black transition ${
                editForm.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {editForm.is_active ? "Aktyvus darbuotojas" : "Neaktyvus darbuotojas"}
            </button>

            <button
              type="button"
              onClick={() =>
                onChange({
                  ...editForm,
                  is_archived: !editForm.is_archived,
                  is_active: editForm.is_archived ? editForm.is_active : false,
                  termination_date: !editForm.is_archived && !editForm.termination_date ? new Date().toISOString().slice(0, 10) : editForm.termination_date,
                })
              }
              className={`rounded-2xl border p-4 text-left font-black transition ${
                editForm.is_archived ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {editForm.is_archived ? "Archyvuotas" : "Archyvuoti po atleidimo"}
            </button>
          </section>
        ) : null}

        {activeTab === "access" ? (
          <section className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Sistemos pareigų tipas">
                <select
                  value={editForm.staff_type}
                  onChange={(event) => {
                    const staffType = event.target.value;
                    onChange({
                      ...editForm,
                      staff_type: staffType,
                      position: STAFF_TYPES.find((type) => type.value === staffType)?.label || editForm.position,
                      extra_permissions: Array.from(new Set([...staffPermissions(staffType), ...editForm.extra_permissions])),
                    });
                  }}
                  className="input"
                >
                  <option value="">Pasirinkti</option>
                  {STAFF_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Rolė">
                <select value={editForm.role} onChange={(event) => onChange({ ...editForm, role: event.target.value })} className="input">
                  <option value="employee">Darbuotojas</option>
                  <option value="admin">Administratorius</option>
                  <option value="owner">Savininkas</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {EXTRA_PERMISSIONS.map((permission) => {
                const checked = editForm.extra_permissions.includes(permission.value);

                return (
                  <button
                    key={permission.value}
                    type="button"
                    onClick={() => onTogglePermission(permission.value)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm font-black transition ${
                      checked ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-[#dbe6e0] bg-[#f8faf8] text-[#486b5d] hover:border-emerald-200 hover:bg-emerald-50"
                    }`}
                  >
                    {permission.label}
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">Galutinės aktyvios teisės</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {mergedPermissions(editForm).map((permission) => (
                  <span key={permission} className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-800">
                    {permission}
                  </span>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "documents" ? (
          <section className="grid gap-3 md:grid-cols-3">
            <Field label="Profesinės licencijos numeris">
              <input value={editForm.professional_license_number} onChange={(event) => onChange({ ...editForm, professional_license_number: event.target.value })} className="input" placeholder="Pvz., SPL-1234" />
            </Field>
            <Field label="Licencija galioja iki">
              <input type="date" value={editForm.professional_license_valid_until} onChange={(event) => onChange({ ...editForm, professional_license_valid_until: event.target.value })} className="input" />
            </Field>
            <Field label="Sveikatos pažyma galioja iki">
              <input type="date" value={editForm.occupational_health_valid_until} onChange={(event) => onChange({ ...editForm, occupational_health_valid_until: event.target.value })} className="input" />
            </Field>

            <div className="md:col-span-3 rounded-xl border border-[#dbe6e0] bg-[#f8faf8] p-4">
              <p className="text-sm font-black text-[#10251f]">Darbuotojo dokumentų įrašai</p>
              <div className="mt-3 grid gap-2">
                {credentials.length ? credentials.map((credential) => (
                  <div key={credential.id} className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#486b5d]">
                    {credential.type} · galioja iki {fmt(credential.expires_at)} · Nr. {credential.number || "—"}
                  </div>
                )) : (
                  <p className="text-sm font-bold text-[#6a7e75]">Dokumentų įrašų nėra.</p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "trainings" ? (
          <section className="rounded-xl border border-[#dbe6e0] bg-[#f8faf8] p-4">
            <p className="text-sm font-black text-[#10251f]">Darbuotojo mokymai</p>
            <div className="mt-3 grid gap-2">
              {trainings.length ? trainings.map((training) => (
                <div key={training.id} className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#486b5d]">
                  {training.title} · {training.completed_at ? fmt(training.completed_at) : "data nenurodyta"} · {training.hours || 0} val.
                </div>
              )) : (
                <p className="text-sm font-bold text-[#6a7e75]">Mokymų įrašų nėra.</p>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}


function EmployeeRowCard({
  employee,
  selected,
  onEdit,
}: {
  employee: Employee;
  selected?: boolean;
  onEdit: () => void;
}) {
  const initials = employeeName(employee)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={onEdit}
      className={`grid w-full gap-3 rounded-2xl border p-4 text-left shadow-sm transition md:grid-cols-[56px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center ${
        selected
          ? "border-emerald-300 bg-emerald-50"
          : "border-[#dbe6e0] bg-[#f8faf8] hover:border-emerald-200 hover:bg-emerald-50/40"
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lg font-black text-emerald-700 shadow-sm">
        {initials || "DR"}
      </div>

      <div>
        <div className="text-lg font-black text-[#10251f]">{employeeName(employee)}</div>
        <div className="text-sm font-bold text-[#6a7e75]">
          {employee.position || employeeRole(employee) || "Pareigos nenurodytos"} · {employee.department || "Skyrius nenurodytas"}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700">
          {employee.is_active === false ? "Neaktyvus" : "Aktyvus"}
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#486b5d]">
          {staffTypeLabel(employee.staff_type)}
        </span>
      </div>

      <div className="text-sm font-bold text-[#6a7e75]">
        {employee.contract_number
          ? `${employee.contract_number}${employee.employment_start_date ? ` · nuo ${fmt(employee.employment_start_date)}` : ""}`
          : "Trūksta sutarties duomenų"}
      </div>

      <span className={selected ? "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-black text-white" : "rounded-lg border border-[#dbe6e0] bg-white px-4 py-2 text-sm font-black text-[#486b5d]"}>
        Redaguoti
      </span>
    </button>
  );
}

function EmployeeCard({
  employee,
  onEdit,
}: {
  employee: Employee;
  onEdit: () => void;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-emerald-200 hover:bg-emerald-50">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-black text-emerald-700 shadow-sm">
            {employeeName(employee).slice(0, 2).toUpperCase()}
          </div>

          <div>
            <h3 className="text-lg font-black text-slate-950">{employeeName(employee)}</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {employeeRole(employee) || "Pareigos nenurodytos"}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {employee.department || "Skyrius nenurodytas"}
            </p>
            {(employee.contract_number || employee.employment_start_date || employee.termination_date) && (
              <p className="mt-1 text-xs font-bold text-slate-400">
                {employee.contract_number ? `DS: ${employee.contract_number}` : ""}
                {employee.employment_start_date ? ` · nuo ${fmt(employee.employment_start_date)}` : ""}
                {employee.termination_date ? ` · atleistas ${fmt(employee.termination_date)}` : ""}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 active:scale-[0.98]"
        >
          <Edit3 className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-emerald-700">
          {employee.is_archived === true ? "Archyvuotas" : employee.is_active === false ? "Neaktyvus" : "Aktyvus"}
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-600">
          {staffTypeLabel(employee.staff_type)}
        </span>
      </div>
    </article>
  );
}

function ListRow({
  title,
  desc,
  badge,
}: {
  title: string;
  desc: string;
  badge: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div>
        <p className="font-black text-slate-900">{title}</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">{desc}</p>
      </div>

      <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-700">
        {badge}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center font-bold text-slate-500">
      {text}
    </div>
  );
}

function Modal({
  title,
  desc,
  children,
  onClose,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm md:p-4">
      <section className="max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="sticky top-0 z-30 flex items-start justify-between gap-4 border-b border-slate-100 bg-white p-4 md:gap-6 md:p-7">
          <div>
            <h2 className="text-2xl font-black tracking-tight md:text-4xl">{title}</h2>
            <p className="mt-2 font-semibold text-slate-500">{desc}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-[0.98] md:h-14 md:w-14"
            aria-label="Uždaryti"
          >
            <X className="h-7 w-7" />
          </button>
        </div>

        <div className="max-h-[calc(94vh-104px)] overflow-y-auto p-4 md:max-h-[calc(94vh-132px)] md:p-7">{children}</div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="mb-2 block text-sm font-extrabold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModalFooter({
  saving,
  onCancel,
  onSave,
  submitText,
}: {
  saving: boolean;
  onCancel: () => void;
  onSave?: () => void;
  submitText: string;
}) {
  return (
    <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-2xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-700 transition hover:bg-slate-50"
      >
        Atšaukti
      </button>

      <button
        type={onSave ? "button" : "submit"}
        onClick={onSave}
        disabled={saving}
        className="rounded-2xl bg-slate-950 px-5 py-3 font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {saving ? "Saugoma..." : submitText}
      </button>
    </div>
  );
}
