"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Download,
  GraduationCap,
  History,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";

type ScheduleEntry = {
  id?: string;
  employee_id: string;
  date: string;
  start_datetime?: string | null;
  end_datetime?: string | null;
  status?: string | null;
  note?: string | null;
};

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
  training_status?: string | null;
  training_missing_hours?: number | null;
  training_required_hours?: number | null;
  training_completed_hours?: number | null;
  training_expires_soon_count?: number | null;
  training_expired_count?: number | null;
  employment_rate?: number | string | null;
  fte?: number | string | null;
  employment_fte?: number | string | null;
  weekly_hours?: number | string | null;
  contract_weekly_hours?: number | string | null;
  employment_type?: string | null;
};

type ComplianceRow = {
  employee: Employee;
  plannedHours: number;
  maxSevenDayHours: number;
  maxSevenDayWorkDays: number;
  shortestRestHours: number | null;
  minWeeklyRestHours?: number | null;
  averageWeeklyHours?: number;
  status: string;
  errors?: string[];
  warnings: string[];
};

type TrainingComplianceRow = {
  employee_id: string;
  status?: string | null;
  missingHours?: number | null;
  requiredHours?: number | null;
  completedHours?: number | null;
  expiresSoonCount?: number | null;
  expiredCount?: number | null;
  missingTrainings?: string[];
  expiringTrainings?: string[];
  blocking?: boolean;
};

type VacationReservation = {
  employee_id: string;
  date: string;
  type: string;
  code: string;
  label: string;
  note: string | null;
  status: string;
};

type Props = {
  employees: Employee[];
  schedule: ScheduleEntry[];
  scheduleMonth: Date;
  setScheduleMonth: (updater: Date | ((prev: Date) => Date)) => void;
  scheduleDays: Date[];
  scheduleGridData: unknown[][];
  scheduleComplianceRows: ComplianceRow[];
  scheduleWarningRows: ComplianceRow[];
  vacationReservations?: VacationReservation[];
  trainingComplianceRows?: TrainingComplianceRow[];
  saving: boolean;
  addMonths: (date: Date, amount: number) => Date;
  monthLabel: (date: Date) => string;
  toDateInput: (date: Date) => string;
  employeeName: (employee?: Employee | null) => string;
  employeeRole: (employee?: Employee | null) => string;
  onSaveGridChanges: (changes: unknown[]) => Promise<void> | void;
};

type GridChange = [number, number, string, string];

type ShiftKind =
  | "empty"
  | "work"
  | "night"
  | "off"
  | "vacation"
  | "sick"
  | "reserved"
  | "shortLeave"
  | "unknown";

type ParsedShift = {
  normalized: string;
  label: string;
  detail: string;
  kind: ShiftKind;
  hours: number | null;
  grossHours: number | null;
  breakMinutes: number;
  startMinutes: number | null;
  endMinutes: number | null;
  crossesMidnight: boolean;
};

type ValidationIssue = {
  id: string;
  employeeId: string;
  employeeName: string;
  date?: string;
  severity: "error" | "warning";
  type:
    | "format"
    | "long-shift"
    | "rest"
    | "weekly-hours"
    | "work-days"
    | "training"
    | "reservation"
    | "weekly-rest"
    | "preholiday"
    | "break"
    | "temporary-leave"
    | "employment-rate";
  title: string;
  detail: string;
};

type EmployeeValidation = {
  employee: Employee;
  plannedHours: number;
  maxSevenDayHours: number;
  maxSevenDayWorkDays: number;
  shortestRestHours: number | null;
  employmentRate: number;
  weeklyContractHours: number;
  monthlyContractHours: number;
  monthlyBalanceHours: number;
  monthlyBalancePercent: number;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
  statusLabel: string;
  statusClass: "ok" | "warn" | "bad";
};

type WeekPattern = Record<number, string>;

type TemplateSettings = {
  templates: Record<string, string[]>;
  patterns: Record<string, WeekPattern>;
  allowTwentyFourHourDuty: Record<string, boolean>;
  defaultBreakMinutes: number;
};

const STORAGE_KEY = "scheduleModuleSettings.v2";
const DEFAULT_FALLBACK_SHIFT = "08:00-17:00";
const WEEKDAYS = [
  { day: 1, label: "Pirmadienis", short: "Pr" },
  { day: 2, label: "Antradienis", short: "An" },
  { day: 3, label: "Trečiadienis", short: "Tr" },
  { day: 4, label: "Ketvirtadienis", short: "Kt" },
  { day: 5, label: "Penktadienis", short: "Pn" },
  { day: 6, label: "Šeštadienis", short: "Št" },
  { day: 0, label: "Sekmadienis", short: "Sk" },
];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatHours(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) return "—";
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function parseNumericValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getEmploymentRate(employee?: Employee | null) {
  const raw =
    parseNumericValue(employee?.employment_rate) ??
    parseNumericValue(employee?.employment_fte) ??
    parseNumericValue(employee?.fte);

  if (raw === null || raw <= 0) return 1;
  return Math.min(raw, 2);
}

function getWeeklyContractHours(employee?: Employee | null) {
  const explicit = parseNumericValue(employee?.weekly_hours) ?? parseNumericValue(employee?.contract_weekly_hours);
  if (explicit !== null && explicit > 0) return Math.min(explicit, 80);
  return getEmploymentRate(employee) * 40;
}

function getMonthlyContractHours(scheduleDays: Date[], employee?: Employee | null) {
  const workableDays = scheduleDays.filter((date) => !isWeekend(date) && !isHoliday(date)).length;
  return (getWeeklyContractHours(employee) / 5) * workableDays;
}

function formatEmploymentRate(employee?: Employee | null) {
  return `${getEmploymentRate(employee).toFixed(2).replace(".", ",")} et.`;
}

function dayKey(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().slice(0, 10);
}

function weekdayLabel(date: Date) {
  return new Intl.DateTimeFormat("lt-LT", { weekday: "short" }).format(date).replace(".", "");
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function cleanText(value?: string | null) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function isTechnicalLabel(value?: string | null) {
  const raw = cleanText(value).toLowerCase();
  if (!raw) return true;
  const technical = new Set([
    "admin",
    "administrator",
    "administratorius",
    "administratore",
    "administratorė",
    "employee",
    "darbuotojas",
    "staff",
    "worker",
    "user",
  ]);
  const parts = raw.split(/[;,]/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((part) => technical.has(part));
}

function cleanRoleLabel(value?: string | null) {
  const raw = cleanText(value);
  if (!raw || isTechnicalLabel(raw)) return "Pareigybė nenurodyta";

  const dictionary: Record<string, string> = {
    manager: "Vadovas",
    supervisor: "Pamainos vadovas",
    nurse: "Slaugytojas",
    caregiver: "Priežiūros darbuotojas",
    social: "Socialinis darbuotojas",
  };

  return raw
    .split(/[;,]/)
    .map((part) => dictionary[part.trim().toLowerCase()] || part.trim())
    .filter(Boolean)
    .join(", ");
}

function cleanPersonName(value?: string | null) {
  const raw = cleanText(value);
  if (!raw || isTechnicalLabel(raw)) return "Vardas nenurodytas";
  return raw;
}

function nameFromEmail(email?: string | null) {
  const local = cleanText(email).split("@")[0];
  if (!local) return "";
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function easterDate(year: number) {
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

function lithuanianHolidayKeys(year: number) {
  const fixed = [
    [0, 1],
    [1, 16],
    [2, 11],
    [4, 1],
    [5, 24],
    [7, 15],
    [10, 1],
    [10, 2],
    [11, 24],
    [11, 25],
    [11, 26],
  ].map(([month, day]) => dayKey(new Date(year, month, day)));
  const easter = easterDate(year);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  return new Set([...fixed, dayKey(easter), dayKey(easterMonday)]);
}

function isHoliday(date: Date) {
  return lithuanianHolidayKeys(date.getFullYear()).has(dayKey(date));
}

function isPreHoliday(date: Date) {
  const next = new Date(date);
  next.setDate(date.getDate() + 1);
  return isHoliday(next);
}

function parseTime(value: string) {
  const match = value.match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] || "00");
  if (hour > 24 || minute > 59 || (hour === 24 && minute !== 0)) return null;
  return { hour, minute, minutes: hour * 60 + minute };
}

function normalizeTime(minutes: number) {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}`;
}

function parseShiftValue(input: string): ParsedShift {
  const raw = cleanText(input);
  const upper = raw.toUpperCase();

  if (!raw) {
    return { normalized: "", label: "+", detail: "Tuščia", kind: "empty", hours: null, grossHours: null, breakMinutes: 0, startMinutes: null, endMinutes: null, crossesMidnight: false };
  }

  const statuses: Record<string, { code: string; label: string; kind: ShiftKind }> = {
    P: { code: "P", label: "Poilsis", kind: "off" },
    POILSIS: { code: "P", label: "Poilsis", kind: "off" },
    A: { code: "A", label: "Atostogos", kind: "vacation" },
    ATOSTOGOS: { code: "A", label: "Atostogos", kind: "vacation" },
    NA: { code: "NA", label: "Nemokamos atostogos", kind: "vacation" },
    NEMOKAMOS: { code: "NA", label: "Nemokamos atostogos", kind: "vacation" },
    NEAPMOKAMOS: { code: "NA", label: "Nemokamos atostogos", kind: "vacation" },
    L: { code: "L", label: "Liga", kind: "sick" },
    LIGA: { code: "L", label: "Liga", kind: "sick" },
    M: { code: "M", label: "Mamadienis", kind: "vacation" },
    MD: { code: "M", label: "Mamadienis", kind: "vacation" },
    MAMADIENIS: { code: "M", label: "Mamadienis", kind: "vacation" },
    T: { code: "T", label: "Tėvadienis", kind: "vacation" },
    TD: { code: "T", label: "Tėvadienis", kind: "vacation" },
    TEVADIENIS: { code: "T", label: "Tėvadienis", kind: "vacation" },
    TĖVADIENIS: { code: "T", label: "Tėvadienis", kind: "vacation" },
    R: { code: "R", label: "Laukianti neatvykimo rezervacija", kind: "reserved" },
    G: { code: "G", label: "Laikinas išvykimas pas gydytoją", kind: "shortLeave" },
    GYDYTOJAS: { code: "G", label: "Laikinas išvykimas pas gydytoją", kind: "shortLeave" },
    TI: { code: "TI", label: "Trumpas išvykimas", kind: "shortLeave" },
    I: { code: "TI", label: "Trumpas išvykimas", kind: "shortLeave" },
  };

  if (statuses[upper]) {
    const status = statuses[upper];
    return { normalized: status.code, label: status.code, detail: status.label, kind: status.kind, hours: null, grossHours: null, breakMinutes: 0, startMinutes: null, endMinutes: null, crossesMidnight: false };
  }

  // Laikinas išvykimas su laiku: G 10-12 arba TI 14:00-15:30
  const leaveMatch = upper.match(/^(G|GYDYTOJAS|TI|I)\s+(\d{1,2}(?::?\d{2})?[-–]\d{1,2}(?::?\d{2})?)$/);
  if (leaveMatch) {
    const timeOnly = parseShiftValue(leaveMatch[2]);
    if (timeOnly.kind === "work" || timeOnly.kind === "night") {
      const code = leaveMatch[1] === "G" || leaveMatch[1] === "GYDYTOJAS" ? "G" : "TI";
      return {
        ...timeOnly,
        normalized: `${code} ${timeOnly.normalized}`,
        label: code,
        kind: "shortLeave",
        detail: `${code === "G" ? "Išvykimas pas gydytoją" : "Trumpas išvykimas"} · ${timeOnly.normalized} · ${formatHours(timeOnly.hours)} val.`,
      };
    }
  }

  // Pertrauka gali būti rašoma: 08-17 P30, 08-17 / P45, 08-17 pietūs 30
  const breakMatch = upper.match(/(?:^|\s|\/)(?:P|PIETŪS|PIETUS|PIETU|PIETŲ|PERTRAUKA)\s*(\d{1,3})\s*(?:MIN)?$/);
  const breakMinutes = breakMatch ? Number(breakMatch[1]) : 0;
  const withoutBreak = raw
    .replace(/(?:\s|\/)*(?:P|p|pietūs|pietus|pietu|pietų|pertrauka)\s*\d{1,3}\s*(?:min)?\s*$/i, "")
    .replace(/\s+/g, "");

  const match = withoutBreak.match(/^(\d{1,2})(?::?(\d{2}))?[-–](\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return { normalized: raw, label: raw, detail: "Neteisingas laiko formatas", kind: "unknown", hours: null, grossHours: null, breakMinutes: 0, startMinutes: null, endMinutes: null, crossesMidnight: false };
  }

  const start = parseTime(`${match[1]}${match[2] ? `:${match[2]}` : ""}`);
  const end = parseTime(`${match[3]}${match[4] ? `:${match[4]}` : ""}`);

  if (!start || !end || start.hour > 23 || end.hour > 24 || breakMinutes < 0 || breakMinutes > 240) {
    return { normalized: raw, label: raw, detail: "Neteisingas laiko formatas", kind: "unknown", hours: null, grossHours: null, breakMinutes: 0, startMinutes: null, endMinutes: null, crossesMidnight: false };
  }

  let endMinutesRaw = end.minutes;
  let duration = endMinutesRaw - start.minutes;
  if (duration <= 0) duration += 1440;
  const crossesMidnight = endMinutesRaw <= start.minutes && end.hour !== 24;
  if (crossesMidnight) endMinutesRaw += 1440;

  const grossHours = duration / 60;
  const netMinutes = Math.max(0, duration - breakMinutes);
  const netHours = netMinutes / 60;
  const startLabel = `${pad2(start.hour)}:${pad2(start.minute)}`;
  const endLabel = end.hour === 24 ? "24:00" : `${pad2(end.hour)}:${pad2(end.minute)}`;
  const night = crossesMidnight || start.hour >= 20 || end.hour <= 6 || end.hour === 24;
  const normalizedBase = `${startLabel}-${endLabel}`;
  const normalized = breakMinutes ? `${normalizedBase} P${breakMinutes}` : normalizedBase;

  return {
    normalized,
    label: normalizedBase,
    detail: `${normalizedBase} · ${formatHours(netHours)} val.${breakMinutes ? ` · pertrauka ${breakMinutes} min.` : ""}`,
    kind: night ? "night" : "work",
    hours: netHours,
    grossHours,
    breakMinutes,
    startMinutes: start.minutes,
    endMinutes: endMinutesRaw,
    crossesMidnight,
  };
}

function classifyPlannedShift(parsed: ParsedShift, allowTwentyFourHourDuty: boolean) {
  const isWork = parsed.kind === "work" || parsed.kind === "night";
  const gross = parsed.grossHours ?? 0;

  if (!isWork || parsed.grossHours === null) {
    return { type: "none", title: "", detail: "", isViolation: false, isWarning: false };
  }

  if (gross === 24 && allowTwentyFourHourDuty) {
    return {
      type: "duty24",
      title: "24 val. budėjimas",
      detail: "Leidžiamas darbuotojui. Poilsio ir 7 dienų valandų ribos tikrinamos atskirai.",
      isViolation: false,
      isWarning: false,
    };
  }

  if (gross === 24 && !allowTwentyFourHourDuty) {
    return {
      type: "duty24-not-allowed",
      title: "24 val. budėjimas neleidžiamas",
      detail: "Darbuotojui nėra pažymėta, kad galima planuoti 24 val. budėjimus.",
      isViolation: true,
      isWarning: false,
    };
  }

  if (gross > 12) {
    return {
      type: parsed.crossesMidnight ? "overnight-too-long" : "too-long",
      title: parsed.crossesMidnight ? "Per ilga naktinė pamaina" : "Pamaina viršija 12 val. ribą",
      detail: `Pamaina trunka ${formatHours(gross)} val. Leidžiama riba: 12 val.`,
      isViolation: true,
      isWarning: false,
    };
  }

  if (parsed.crossesMidnight) {
    return {
      type: "overnight",
      title: "Naktinė pamaina",
      detail: `Pamaina pereina į kitą dieną ir trunka ${formatHours(gross)} val.`,
      isViolation: false,
      isWarning: false,
    };
  }

  if (gross >= 10) {
    return {
      type: "near-limit",
      title: "Pamaina arti 12 val. ribos",
      detail: `Pamaina trunka ${formatHours(gross)} val.`,
      isViolation: false,
      isWarning: true,
    };
  }

  return { type: "regular", title: "Įprasta pamaina", detail: `Pamaina trunka ${formatHours(gross)} val.`, isViolation: false, isWarning: false };
}


function stripBreakFromValue(value: string) {
  return cleanText(value)
    .replace(/(?:\s|\/)*(?:P|p|pietūs|pietus|pietu|pietų|pertrauka)\s*\d{1,3}\s*(?:min)?\s*$/i, "")
    .trim();
}

function hasExplicitBreak(value: string) {
  return /(?:^|\s|\/)(?:P|PIETŪS|PIETUS|PIETU|PIETŲ|PERTRAUKA)\s*\d{1,3}\s*(?:MIN)?$/i.test(cleanText(value));
}

function withDefaultBreak(value: string, defaultBreakMinutes: number) {
  const clean = cleanText(value);

  if (!clean || defaultBreakMinutes <= 0 || hasExplicitBreak(clean)) return clean;

  const parsed = parseShiftValue(clean);

  if (!(parsed.kind === "work" || parsed.kind === "night")) return clean;
  if (parsed.breakMinutes > 0) return parsed.normalized;

  return `${parsed.normalized} P${defaultBreakMinutes}`;
}

function parseShiftWithDefaultBreak(value: string, defaultBreakMinutes: number) {
  return parseShiftValue(withDefaultBreak(value, defaultBreakMinutes));
}

function shiftClass(parsed: ParsedShift, allowTwentyFourHourDuty = false) {
  const classes = ["shift", `shift-${parsed.kind}`];
  const shift = classifyPlannedShift(parsed, allowTwentyFourHourDuty);
  if (shift.isViolation) classes.push("shift-danger");
  else if (shift.isWarning) classes.push("shift-warning");
  else if (shift.type === "duty24") classes.push("shift-duty");
  return classes.join(" ");
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function emptySettings(): TemplateSettings {
  return { templates: {}, patterns: {}, allowTwentyFourHourDuty: {}, defaultBreakMinutes: 30 };
}

export default function ScheduleBlock({
  employees,
  scheduleMonth,
  setScheduleMonth,
  scheduleDays,
  scheduleGridData,
  scheduleComplianceRows,
  vacationReservations = [],
  trainingComplianceRows = [],
  saving,
  addMonths,
  monthLabel,
  employeeName,
  employeeRole,
  onSaveGridChanges,
}: Props) {
  const [grid, setGrid] = useState<unknown[][]>(() => scheduleGridData.map((row) => [...row]));
  const [pendingChanges, setPendingChanges] = useState<GridChange[]>([]);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number; draft: string; oldValue: string } | null>(null);
  const [clipboardValue, setClipboardValue] = useState("");
  const [message, setMessage] = useState("");
  const [localSaving, setLocalSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "errors" | "warnings" | "training" | "reservations">("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showLargeGrid, setShowLargeGrid] = useState(false);
  const [scheduleView, setScheduleView] = useState<"month" | "week">("month");
  const [weekStartIndex, setWeekStartIndex] = useState(0);
  const [history, setHistory] = useState<Array<{ id: string; label: string; at: string; changes: GridChange[] }>>([]);
  const [undoStack, setUndoStack] = useState<Array<{ id: string; label: string; at: string; changes: GridChange[] }>>([]);
  const [settings, setSettings] = useState<TemplateSettings>(() => emptySettings());
  const [templateEmployeeId, setTemplateEmployeeId] = useState("");
  const [templateDraft, setTemplateDraft] = useState("08-17");
  const [activePatternDay, setActivePatternDay] = useState<number | null>(null);
  const [clearEmployeeId, setClearEmployeeId] = useState("all");
  const [clearFrom, setClearFrom] = useState(() => (scheduleDays[0] ? dayKey(scheduleDays[0]) : ""));
  const [clearTo, setClearTo] = useState(() => (scheduleDays.length ? dayKey(scheduleDays[scheduleDays.length - 1]) : ""));
  const [dragCopy, setDragCopy] = useState<null | { value: string; cells: Array<{ row: number; col: number; oldValue: string }> }>(null);
  const dragRef = useRef(dragCopy);

  useEffect(() => {
    dragRef.current = dragCopy;
  }, [dragCopy]);

  useEffect(() => {
    if (pendingChanges.length === 0) setGrid(scheduleGridData.map((row) => [...row]));
  }, [scheduleGridData, pendingChanges.length]);

  useEffect(() => {
    if (!templateEmployeeId && employees[0]?.user_id) setTemplateEmployeeId(employees[0].user_id);
  }, [employees, templateEmployeeId]);

  useEffect(() => {
    setClearFrom(scheduleDays[0] ? dayKey(scheduleDays[0]) : "");
    setClearTo(scheduleDays.length ? dayKey(scheduleDays[scheduleDays.length - 1]) : "");
  }, [scheduleDays]);

  useEffect(() => {
    setWeekStartIndex(0);
  }, [scheduleDays]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = { ...emptySettings(), ...JSON.parse(stored) } as TemplateSettings;

        Object.keys(parsed.templates || {}).forEach((employeeId) => {
          parsed.templates[employeeId] = (parsed.templates[employeeId] || []).map(stripBreakFromValue);
        });

        Object.keys(parsed.patterns || {}).forEach((employeeId) => {
          const pattern = parsed.patterns[employeeId] || {};

          Object.keys(pattern).forEach((dayKeyValue) => {
            const dayNumber = Number(dayKeyValue);
            pattern[dayNumber] = stripBreakFromValue(pattern[dayNumber] || "");
          });
        });

        setSettings(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const getName = (employee?: Employee | null) => {
    if (!employee) return "Vardas nenurodytas";
    const fromProp = cleanPersonName(employeeName(employee));
    if (fromProp !== "Vardas nenurodytas") return fromProp;
    const full = cleanPersonName(employee.full_name);
    if (full !== "Vardas nenurodytas") return full;
    const joined = cleanPersonName(`${employee.first_name || ""} ${employee.last_name || ""}`);
    if (joined !== "Vardas nenurodytas") return joined;
    const emailName = cleanPersonName(nameFromEmail(employee.email));
    return emailName !== "Vardas nenurodytas" ? emailName : "Vardas nenurodytas";
  };

  const getRole = (employee?: Employee | null) => {
    if (!employee) return "Pareigybė nenurodyta";
    const preferred = cleanRoleLabel(employee.position || employee.legacy_role || employee.role || employee.staff_type || employee.department);
    if (preferred !== "Pareigybė nenurodyta") return preferred;
    const fromProp = cleanRoleLabel(employeeRole(employee));
    return fromProp;
  };

  const reservationMap = useMemo(() => {
    const map = new Map<string, VacationReservation>();
    vacationReservations.forEach((reservation) => map.set(`${reservation.employee_id}__${reservation.date}`, reservation));
    return map;
  }, [vacationReservations]);

  const trainingMap = useMemo(() => {
    const map = new Map<string, TrainingComplianceRow>();
    trainingComplianceRows.forEach((row) => map.set(row.employee_id, row));
    return map;
  }, [trainingComplianceRows]);

  const getTrainingStatus = (employee: Employee) => {
    const row = trainingMap.get(employee.user_id);
    const status = row?.status || employee.training_status || "Atitinka";
    const missingHours = Number(row?.missingHours ?? employee.training_missing_hours ?? 0);
    const expiredCount = Number(row?.expiredCount ?? employee.training_expired_count ?? 0);
    const expiresSoonCount = Number(row?.expiresSoonCount ?? employee.training_expires_soon_count ?? 0);
    const blocking = Boolean(row?.blocking || missingHours > 0 || expiredCount > 0 || /neatitinka|trūksta|pasibaig/i.test(status));
    const warning = !blocking && Boolean(expiresSoonCount > 0 || /rizika|baigiasi/i.test(status));
    return { status, missingHours, expiredCount, expiresSoonCount, blocking, warning, row };
  };

  const getValue = (row: number, col: number) => String(grid[row]?.[col] || "");
  const activeEmployee = activeCell ? employees[activeCell.row] : null;
  const activeEmployeeId = activeEmployee?.user_id || templateEmployeeId;
  const allowTwentyFourFor = (employee: Employee) => Boolean(settings.allowTwentyFourHourDuty[employee.user_id] || /budė|slaug|apsaug/i.test(`${employee.role || ""} ${employee.position || ""} ${employee.staff_type || ""}`));

  const validationByEmployee = useMemo(() => {
    const result = new Map<string, EmployeeValidation>();

    employees.forEach((employee, rowIndex) => {
      const issues: ValidationIssue[] = [];
      const warnings: ValidationIssue[] = [];
      const workShifts: Array<{ dateIndex: number; date: Date; startAbs: number; endAbs: number; hours: number; grossHours: number; parsed: ParsedShift }> = [];
      let plannedHours = 0;

      scheduleDays.forEach((date, dayIndex) => {
        const dateText = dayKey(date);
        const parsed = parseShiftValue(getValue(rowIndex, dayIndex + 1));
        const name = getName(employee);
        const reservation = reservationMap.get(`${employee.user_id}__${dateText}`);

        if (parsed.kind === "unknown") {
          issues.push({
            id: `${employee.user_id}-${dateText}-format`,
            employeeId: employee.user_id,
            employeeName: name,
            date: dateText,
            severity: "error",
            type: "format",
            title: "Neteisingas laiko formatas",
            detail: `${date.getDate()} d. įrašas neatpažintas. Tinka: 08:00-17:00, 8-17, 08-17 P30, P, A, NA, M, T, L, G 10-12.`,
          });
        }

        if (parsed.kind === "shortLeave") {
          warnings.push({
            id: `${employee.user_id}-${dateText}-temporary-leave`,
            employeeId: employee.user_id,
            employeeName: name,
            date: dateText,
            severity: "warning",
            type: "temporary-leave",
            title: parsed.normalized.startsWith("G") ? "Išvykimas pas gydytoją" : "Trumpas išvykimas",
            detail: parsed.detail,
          });
        }

        if ((parsed.kind === "work" || parsed.kind === "night") && parsed.hours !== null && parsed.grossHours !== null) {
          plannedHours += parsed.hours;
          const dayStartAbs = dayIndex * 1440;
          workShifts.push({
            dateIndex: dayIndex,
            date,
            startAbs: dayStartAbs + Number(parsed.startMinutes),
            endAbs: dayStartAbs + Number(parsed.endMinutes),
            hours: parsed.hours,
            grossHours: parsed.grossHours,
            parsed,
          });

          const training = getTrainingStatus(employee);
          if (training.blocking) {
            issues.push({
              id: `${employee.user_id}-${dateText}-training`,
              employeeId: employee.user_id,
              employeeName: name,
              date: dateText,
              severity: "error",
              type: "training",
              title: "Mokymų neatitiktis",
              detail: training.missingHours > 0 ? `Darbuotojo negalima planuoti darbui: trūksta ${formatHours(training.missingHours)} mokymų val.` : "Darbuotojo negalima planuoti darbui: mokymai neatitinka reikalavimų.",
            });
          } else if (training.warning) {
            warnings.push({
              id: `${employee.user_id}-${dateText}-training-warning`,
              employeeId: employee.user_id,
              employeeName: name,
              date: dateText,
              severity: "warning",
              type: "training",
              title: "Artėja mokymų terminas",
              detail: training.expiresSoonCount > 0 ? `Artėja ${training.expiresSoonCount} mokymų terminas.` : "Yra mokymų termino rizika.",
            });
          }

          if (reservation) {
            issues.push({
              id: `${employee.user_id}-${dateText}-reservation`,
              employeeId: employee.user_id,
              employeeName: name,
              date: dateText,
              severity: "error",
              type: "reservation",
              title: "Konfliktas su neatvykimu",
              detail: `${date.getDate()} d. yra neatvykimo rezervacija: ${reservation.label}.`,
            });
          }

          if (parsed.breakMinutes === 0 && parsed.grossHours >= 6) {
            warnings.push({
              id: `${employee.user_id}-${dateText}-break`,
              employeeId: employee.user_id,
              employeeName: name,
              date: dateText,
              severity: "warning",
              type: "break",
              title: "Nenurodyta pertrauka",
              detail: `${date.getDate()} d. pamaina ${parsed.label}. Jei buvo pietų pertrauka, rašykite pvz. ${parsed.label} P30.`,
            });
          }

          const shiftClassification = classifyPlannedShift(parsed, allowTwentyFourFor(employee));
          if (shiftClassification.isViolation) {
            issues.push({
              id: `${employee.user_id}-${dateText}-long`,
              employeeId: employee.user_id,
              employeeName: name,
              date: dateText,
              severity: "error",
              type: "long-shift",
              title: shiftClassification.title,
              detail: `${date.getDate()} d. ${shiftClassification.detail}${shiftClassification.type === "duty24-not-allowed" ? " Įjunkite leidimą „Leisti 24 val. budėjimus“, jei ši pareigybė dirba paromis." : ""}`,
            });
          } else if (shiftClassification.isWarning) {
            warnings.push({
              id: `${employee.user_id}-${dateText}-long-warning`,
              employeeId: employee.user_id,
              employeeName: name,
              date: dateText,
              severity: "warning",
              type: "long-shift",
              title: shiftClassification.title,
              detail: `${date.getDate()} d. ${shiftClassification.detail}`,
            });
          }

          if (isPreHoliday(date)) {
            warnings.push({
              id: `${employee.user_id}-${dateText}-preholiday`,
              employeeId: employee.user_id,
              employeeName: name,
              date: dateText,
              severity: "warning",
              type: "preholiday",
              title: "Prieššventinė diena",
              detail: `${date.getDate()} d. yra prieš šventinę dieną. Patikrinkite, ar darbo laikas sutrumpintas 1 val. arba papildoma valanda apskaityta pagal įstaigos taisykles.`,
            });
          }
        }
      });

      const sorted = [...workShifts].sort((a, b) => a.startAbs - b.startAbs);
      let shortestRestHours: number | null = null;
      for (let i = 1; i < sorted.length; i += 1) {
        const rest = (sorted[i].startAbs - sorted[i - 1].endAbs) / 60;
        shortestRestHours = shortestRestHours === null ? rest : Math.min(shortestRestHours, rest);
        if (rest < 11) {
          issues.push({
            id: `${employee.user_id}-${i}-rest`,
            employeeId: employee.user_id,
            employeeName: getName(employee),
            date: dayKey(sorted[i].date),
            severity: "error",
            type: "rest",
            title: "Per trumpas poilsis",
            detail: `Tarp ${sorted[i - 1].date.getDate()} d. ir ${sorted[i].date.getDate()} d. pamainų poilsis tik ${formatHours(rest)} val. Reikia bent 11 val.`,
          });
        } else if (rest < 12) {
          warnings.push({
            id: `${employee.user_id}-${i}-rest-warning`,
            employeeId: employee.user_id,
            employeeName: getName(employee),
            date: dayKey(sorted[i].date),
            severity: "warning",
            type: "rest",
            title: "Mažas poilsio rezervas",
            detail: `Tarp pamainų poilsis ${formatHours(rest)} val. Minimalus reikalavimas: 11 val.`,
          });
        }
      }

      const employmentRate = getEmploymentRate(employee);
      const weeklyContractHours = getWeeklyContractHours(employee);
      const monthlyContractHours = getMonthlyContractHours(scheduleDays, employee);
      const monthlyBalanceHours = plannedHours - monthlyContractHours;
      const monthlyBalancePercent = monthlyContractHours > 0 ? (plannedHours / monthlyContractHours) * 100 : 0;

      let maxSevenDayHours = 0;
      let maxSevenDayWorkDays = 0;
      for (let start = 0; start < scheduleDays.length; start += 1) {
        const end = start + 6;
        const shiftsInWindow = workShifts.filter((shift) => shift.dateIndex >= start && shift.dateIndex <= end);
        const hours = shiftsInWindow.reduce((sum, shift) => sum + shift.hours, 0);
        const days = new Set(shiftsInWindow.map((shift) => shift.dateIndex)).size;
        maxSevenDayHours = Math.max(maxSevenDayHours, hours);
        maxSevenDayWorkDays = Math.max(maxSevenDayWorkDays, days);

        if (hours > 48) {
          issues.push({
            id: `${employee.user_id}-${start}-weekly-hours`,
            employeeId: employee.user_id,
            employeeName: getName(employee),
            date: dayKey(scheduleDays[start]),
            severity: "error",
            type: "weekly-hours",
            title: "Viršyta 7 d. valandų riba",
            detail: `${scheduleDays[start].getDate()}–${scheduleDays[Math.min(end, scheduleDays.length - 1)].getDate()} d. suplanuota ${formatHours(hours)} val. Riba: 48 val.`,
          });
        } else if (hours > 44) {
          warnings.push({
            id: `${employee.user_id}-${start}-weekly-hours-warning`,
            employeeId: employee.user_id,
            employeeName: getName(employee),
            date: dayKey(scheduleDays[start]),
            severity: "warning",
            type: "weekly-hours",
            title: "Artėja valandų riba",
            detail: `${scheduleDays[start].getDate()}–${scheduleDays[Math.min(end, scheduleDays.length - 1)].getDate()} d. suplanuota ${formatHours(hours)} val.`,
          });
        }

        if (weeklyContractHours > 0 && hours > weeklyContractHours + 4) {
          warnings.push({
            id: `${employee.user_id}-${start}-employment-rate-weekly`,
            employeeId: employee.user_id,
            employeeName: getName(employee),
            date: dayKey(scheduleDays[start]),
            severity: "warning",
            type: "employment-rate",
            title: "Viršijamas etato savaitinis krūvis",
            detail: `${scheduleDays[start].getDate()}–${scheduleDays[Math.min(end, scheduleDays.length - 1)].getDate()} d. suplanuota ${formatHours(hours)} val., o darbuotojo savaitinė norma pagal ${formatEmploymentRate(employee)} yra ${formatHours(weeklyContractHours)} val.`,
          });
        }

        if (days > 6) {
          issues.push({
            id: `${employee.user_id}-${start}-work-days`,
            employeeId: employee.user_id,
            employeeName: getName(employee),
            date: dayKey(scheduleDays[start]),
            severity: "error",
            type: "work-days",
            title: "Nėra savaitinio poilsio",
            detail: `${scheduleDays[start].getDate()}–${scheduleDays[Math.min(end, scheduleDays.length - 1)].getDate()} d. darbuotojas planuojamas ${days} d. Reikia bent 1 poilsio dienos per 7 d.`,
          });
        }
      }

      if (monthlyContractHours > 0 && plannedHours > monthlyContractHours + 1) {
        warnings.push({
          id: `${employee.user_id}-employment-rate-monthly`,
          employeeId: employee.user_id,
          employeeName: getName(employee),
          severity: "warning",
          type: "employment-rate",
          title: "Viršijamas etato mėnesio krūvis",
          detail: `${formatEmploymentRate(employee)} darbuotojo mėnesio norma yra apie ${formatHours(monthlyContractHours)} val., suplanuota ${formatHours(plannedHours)} val. Skirtumas: +${formatHours(monthlyBalanceHours)} val.`,
        });
      } else if (monthlyContractHours > 0 && plannedHours < monthlyContractHours - 8) {
        warnings.push({
          id: `${employee.user_id}-employment-rate-underplanned`,
          employeeId: employee.user_id,
          employeeName: getName(employee),
          severity: "warning",
          type: "employment-rate",
          title: "Neužpildytas etato krūvis",
          detail: `${formatEmploymentRate(employee)} darbuotojo mėnesio norma yra apie ${formatHours(monthlyContractHours)} val., suplanuota ${formatHours(plannedHours)} val. Trūksta ${formatHours(Math.abs(monthlyBalanceHours))} val.`,
        });
      }

      const external = scheduleComplianceRows.find((row) => row.employee.user_id === employee.user_id);
      external?.errors?.forEach((text, index) => {
        issues.push({
          id: `${employee.user_id}-external-error-${index}`,
          employeeId: employee.user_id,
          employeeName: getName(employee),
          severity: "error",
          type: /mokym/i.test(text) ? "training" : /poils/i.test(text) ? "rest" : /norm|val/i.test(text) ? "weekly-hours" : "format",
          title: /mokym/i.test(text) ? "Mokymų neatitiktis" : /poils/i.test(text) ? "Poilsio pažeidimas" : /norm|val/i.test(text) ? "Viršyta norma" : "Neatitikimas",
          detail: text,
        });
      });
      external?.warnings?.forEach((text, index) => {
        warnings.push({
          id: `${employee.user_id}-external-warning-${index}`,
          employeeId: employee.user_id,
          employeeName: getName(employee),
          severity: "warning",
          type: /mokym/i.test(text) ? "training" : /poils/i.test(text) ? "rest" : /norm|val/i.test(text) ? "weekly-hours" : "format",
          title: /mokym/i.test(text) ? "Mokymų termino rizika" : /poils/i.test(text) ? "Poilsio rizika" : /norm|val/i.test(text) ? "Valandų rizika" : "Įspėjimas",
          detail: text,
        });
      });

      const uniqueIssues = Array.from(new Map(issues.map((issue) => [issue.id, issue])).values());
      const uniqueWarnings = Array.from(new Map(warnings.map((issue) => [issue.id, issue])).values()).filter((warning) => !uniqueIssues.some((issue) => issue.id === warning.id));
      const first = uniqueIssues[0] || uniqueWarnings[0];

      result.set(employee.user_id, {
        employee,
        plannedHours,
        maxSevenDayHours,
        maxSevenDayWorkDays,
        shortestRestHours,
        employmentRate,
        weeklyContractHours,
        monthlyContractHours,
        monthlyBalanceHours,
        monthlyBalancePercent,
        issues: uniqueIssues,
        warnings: uniqueWarnings,
        statusLabel: uniqueIssues.length ? first.title : uniqueWarnings.length ? first.title : "Be neatitikimų",
        statusClass: uniqueIssues.length ? "bad" : uniqueWarnings.length ? "warn" : "ok",
      });
    });

    return result;
  }, [employees, grid, reservationMap, scheduleComplianceRows, scheduleDays, settings.allowTwentyFourHourDuty, trainingMap]);

  const allValidations = useMemo(() => employees.map((employee) => validationByEmployee.get(employee.user_id)).filter(Boolean) as EmployeeValidation[], [employees, validationByEmployee]);
  const allIssues = useMemo(() => allValidations.flatMap((row) => [...row.issues, ...row.warnings]), [allValidations]);
  const errorCount = allIssues.filter((issue) => issue.severity === "error").length;
  const warningCount = allIssues.filter((issue) => issue.severity === "warning").length;
  const trainingIssueCount = allIssues.filter((issue) => issue.type === "training").length;
  const reservationCount = vacationReservations.length;

  const departmentOptions = useMemo(() => {
    const values = employees
      .map((employee) => cleanText(employee.department))
      .filter((value): value is string => Boolean(value));

    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "lt"));
  }, [employees]);

  const employeesByDepartment = useMemo(() => {
    if (departmentFilter === "all") return employees;
    if (departmentFilter === "none") {
      return employees.filter((employee) => !cleanText(employee.department));
    }

    return employees.filter((employee) => cleanText(employee.department) === departmentFilter);
  }, [employees, departmentFilter]);

  const filteredEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    const source = employeesByDepartment.filter((employee) => {
      if (!search) return true;
      return [getName(employee), getRole(employee), employee.email, employee.department, employee.position, employee.staff_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });

    if (filter === "all") return source;
    if (filter === "reservations") return source.filter((employee) => vacationReservations.some((reservation) => reservation.employee_id === employee.user_id));
    return source.filter((employee) => {
      const validation = validationByEmployee.get(employee.user_id);
      if (!validation) return false;
      if (filter === "errors") return validation.issues.length > 0;
      if (filter === "warnings") return validation.warnings.length > 0 && validation.issues.length === 0;
      if (filter === "training") return [...validation.issues, ...validation.warnings].some((issue) => issue.type === "training");
      return true;
    });
  }, [employeesByDepartment, employeeSearch, filter, vacationReservations, validationByEmployee]);

  const visibleScheduleDays = useMemo(() => {
    if (scheduleView === "month") return scheduleDays;

    return scheduleDays.slice(weekStartIndex, weekStartIndex + 7);
  }, [scheduleDays, scheduleView, weekStartIndex]);

  const visibleDayIndexes = useMemo(() => {
    return visibleScheduleDays.map((date) => scheduleDays.findIndex((item) => dayKey(item) === dayKey(date)));
  }, [scheduleDays, visibleScheduleDays]);

  const weekLabel = useMemo(() => {
    if (scheduleView !== "week" || visibleScheduleDays.length === 0) return "";

    const first = visibleScheduleDays[0];
    const last = visibleScheduleDays[visibleScheduleDays.length - 1];

    return `${dayKey(first)} – ${dayKey(last)}`;
  }, [scheduleView, visibleScheduleDays]);

  const canGoPreviousWeek = scheduleView === "week" && weekStartIndex > 0;
  const canGoNextWeek = scheduleView === "week" && weekStartIndex + 7 < scheduleDays.length;

  const showPreviousWeek = () => {
    setWeekStartIndex((previous) => Math.max(0, previous - 7));
  };

  const showNextWeek = () => {
    setWeekStartIndex((previous) => Math.min(Math.max(0, scheduleDays.length - 7), previous + 7));
  };

  const gridTemplateColumns = useMemo(() => {
    if (scheduleView === "week") return `190px repeat(${visibleScheduleDays.length}, 112px) 120px`;

    return `175px repeat(${visibleScheduleDays.length}, 39px) 92px`;
  }, [scheduleView, visibleScheduleDays.length]);

  const recordHistory = (label: string, changes: GridChange[]) => {
    const item = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, label, at: new Date().toLocaleString("lt-LT"), changes };
    setHistory((prev) => [item, ...prev].slice(0, 80));
    setUndoStack((prev) => [item, ...prev].slice(0, 30));
  };

  const applyChangesToGrid = (changes: GridChange[], direction: "next" | "previous") => {
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      changes.forEach(([row, col, oldValue, newValue]) => {
        if (!next[row]) next[row] = [];
        next[row][col] = direction === "next" ? newValue : oldValue;
      });
      return next;
    });
  };

  const queueChanges = (changes: GridChange[], label: string, successMessage: string) => {
    const realChanges = changes.filter(([, , oldValue, newValue]) => parseShiftValue(oldValue).normalized !== parseShiftValue(newValue).normalized);
    if (!realChanges.length) {
      setMessage("Pakeitimų nėra.");
      return;
    }
    applyChangesToGrid(realChanges, "next");
    recordHistory(label, realChanges);
    setPendingChanges((prev) => {
      const next = [...prev];
      realChanges.forEach(([row, col, oldValue, newValue]) => {
        const index = next.findIndex(([r, c]) => r === row && c === col);
        if (index >= 0) {
          const originalOld = next[index][2];
          if (parseShiftValue(originalOld).normalized === parseShiftValue(newValue).normalized) next.splice(index, 1);
          else next[index] = [row, col, originalOld, newValue];
        } else next.push([row, col, oldValue, newValue]);
      });
      return next;
    });
    setMessage(successMessage);
  };

  const commitCell = (row: number, col: number, oldValue: string, rawValue: string) => {
    const parsed = parseShiftWithDefaultBreak(rawValue, settings.defaultBreakMinutes);
    const newValue = parsed.normalized;
    const employee = employees[row];
    const training = employee ? getTrainingStatus(employee) : null;

    if (employee && (parsed.kind === "work" || parsed.kind === "night") && training?.blocking) {
      setMessage(`${getName(employee)} negali būti planuojamas darbui: mokymų neatitiktis.`);
      setEditingCell(null);
      return;
    }

    setEditingCell(null);
    queueChanges([[row, col, oldValue, newValue]], `${getName(employee)} · ${scheduleDays[col - 1]?.getDate()} d.: ${oldValue || "tuščia"} → ${newValue || "tuščia"}`, newValue ? `Įrašyta: ${newValue}` : "Langelis išvalytas");
  };

  const saveChanges = async () => {
    if (!pendingChanges.length) {
      setMessage("Nėra neišsaugotų pakeitimų.");
      return;
    }
    setLocalSaving(true);
    setMessage("Saugomi pakeitimai...");
    try {
      await onSaveGridChanges(pendingChanges);
      setPendingChanges([]);
      setMessage("Grafikas išsaugotas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko išsaugoti pakeitimų.");
    } finally {
      setLocalSaving(false);
    }
  };

  const undo = () => {
    const item = undoStack[0];
    if (!item) return;
    applyChangesToGrid(item.changes, "previous");
    setPendingChanges((prev) => prev.filter(([row, col]) => !item.changes.some(([r, c]) => r === row && c === col)));
    setUndoStack((prev) => prev.slice(1));
    setMessage(`Atšaukta: ${item.label}`);
  };

  const quickSet = (value: string) => {
    if (!activeCell) {
      setMessage("Pirmiausia pasirinkite grafiko langelį.");
      return;
    }
    setActivePatternDay(null);
    const oldValue = getValue(activeCell.row, activeCell.col);
    const parsed = parseShiftWithDefaultBreak(value, settings.defaultBreakMinutes);
    const nextValue = parsed.kind === "work" || parsed.kind === "night" ? parsed.normalized : value;
    commitCell(activeCell.row, activeCell.col, oldValue, nextValue);
  };

  const defaultTemplates = ["08:00-17:00", "08:00-16:00", "07:00-19:00", "19:00-07:00", "07:00-07:00"];
  const employeeTemplates = activeEmployee ? Array.from(new Set([...defaultTemplates, ...(settings.templates[activeEmployee.user_id] || []).map(stripBreakFromValue)])) : defaultTemplates;

  const addTemplate = () => {
    const employee = employees.find((item) => item.user_id === templateEmployeeId) || activeEmployee;
    if (!employee) return;
    const parsed = parseShiftWithDefaultBreak(templateDraft, settings.defaultBreakMinutes);
    if (!(parsed.kind === "work" || parsed.kind === "night")) {
      setMessage("Šablonui įveskite pamainos laiką, pvz. 08-17, 07-19 arba 07:00-07:00. Pertrauka pridedama automatiškai pagal nustatymą.");
      return;
    }
    setSettings((prev) => ({
      ...prev,
      templates: { ...prev.templates, [employee.user_id]: Array.from(new Set([stripBreakFromValue(parsed.normalized), ...(prev.templates[employee.user_id] || []).map(stripBreakFromValue)])).slice(0, 12) },
    }));
    setTemplateDraft(stripBreakFromValue(parsed.normalized));
    setMessage(`${getName(employee)}: pridėtas šablonas ${stripBreakFromValue(parsed.normalized)}. Pertrauka bus pridedama automatiškai.`);
  };

  const removeTemplate = (employeeId: string, template: string) => {
    setSettings((prev) => ({ ...prev, templates: { ...prev.templates, [employeeId]: (prev.templates[employeeId] || []).filter((item) => item !== template) } }));
  };

  const useTemplate = (template: string) => {
    const parsed = parseShiftWithDefaultBreak(template, settings.defaultBreakMinutes);
    const normalized = parsed.normalized || template;
    const displayValue = stripBreakFromValue(normalized);

    if (activeCell) {
      setActivePatternDay(null);
      const oldValue = getValue(activeCell.row, activeCell.col);
      commitCell(activeCell.row, activeCell.col, oldValue, normalized);
      return;
    }

    if (activePatternDay !== null && selectedPatternEmployee) {
      updatePattern(selectedPatternEmployee.user_id, activePatternDay, displayValue);
      setTemplateDraft(displayValue);
      setMessage(`${WEEKDAYS.find((item) => item.day === activePatternDay)?.label || "Diena"}: įrašyta ${displayValue}. Pertrauka bus pridedama automatiškai.`);
      return;
    }

    setMessage("Pasirinkite grafiko langelį arba darbo laiko modelio lauką.");
  };

  const updatePattern = (employeeId: string, day: number, value: string, normalize = false) => {
    const trimmed = value.trim();
    const parsed = parseShiftWithDefaultBreak(trimmed, settings.defaultBreakMinutes);
    const nextValue = !trimmed ? "" : normalize && (parsed.kind === "work" || parsed.kind === "night") ? stripBreakFromValue(parsed.normalized) : value;
    setSettings((prev) => ({
      ...prev,
      patterns: {
        ...prev.patterns,
        [employeeId]: { ...(prev.patterns[employeeId] || {}), [day]: nextValue },
      },
    }));
  };

  const applyPattern = (mode: "selected" | "all") => {
    const targetEmployees = mode === "all" ? employees : employees.filter((employee) => employee.user_id === templateEmployeeId || employee.user_id === activeEmployee?.user_id);
    const changes: GridChange[] = [];
    targetEmployees.forEach((employee) => {
      const row = employees.findIndex((item) => item.user_id === employee.user_id);
      const pattern = settings.patterns[employee.user_id] || {};
      const training = getTrainingStatus(employee);
      if (training.blocking) return;
      scheduleDays.forEach((date, dayIndex) => {
        const rawPatternValue = pattern[date.getDay()];
        if (!rawPatternValue) return;
        const parsedPattern = parseShiftWithDefaultBreak(rawPatternValue, settings.defaultBreakMinutes);
        if (!(parsedPattern.kind === "work" || parsedPattern.kind === "night")) return;
        const value = parsedPattern.normalized;
        const col = dayIndex + 1;
        const oldValue = getValue(row, col);
        if (oldValue) return;
        const reservation = reservationMap.get(`${employee.user_id}__${dayKey(date)}`);
        if (reservation) return;
        changes.push([row, col, oldValue, value]);
      });
    });
    queueChanges(changes, "Darbo laiko modelio pritaikymas", `Užpildyta pagal modelį: ${changes.length}`);
  };

  const autofillWorkdays = () => {
    const changes: GridChange[] = [];

    const targetEmployeeRows =
      clearEmployeeId === "all"
        ? employees.map((employee, row) => ({ employee, row }))
        : employees
            .map((employee, row) => ({ employee, row }))
            .filter((item) => item.employee.user_id === clearEmployeeId);

    targetEmployeeRows.forEach(({ employee, row }) => {
      const training = getTrainingStatus(employee);
      if (training.blocking) return;

      scheduleDays.forEach((date, dayIndex) => {
        if (isWeekend(date) || isHoliday(date)) return;

        const col = dayIndex + 1;
        const existing = getValue(row, col);
        const reservation = reservationMap.get(`${employee.user_id}__${dayKey(date)}`);
        if (existing || reservation) return;

        const employeePattern = settings.patterns[employee.user_id] || {};
        const patternValue = employeePattern[date.getDay()];
        const fallbackValue = employeePattern[date.getDay()] || DEFAULT_FALLBACK_SHIFT;
        const parsed = parseShiftWithDefaultBreak(patternValue || fallbackValue, settings.defaultBreakMinutes);
        if (!(parsed.kind === "work" || parsed.kind === "night")) return;

        changes.push([row, col, existing, parsed.normalized]);
      });
    });

    queueChanges(
      changes,
      "Darbo dienų užpildymas",
      `Užpildyta darbo dienų: ${changes.length}. Pildoma pagal darbuotojo darbo laiko modelį, o jei jo nėra — 08:00-17:00. Pertrauka pridedama automatiškai pagal nustatymą.`
    );
  };

  const clearRange = () => {
    const fromIndex = scheduleDays.findIndex((date) => dayKey(date) >= clearFrom);
    const toIndex = scheduleDays.findIndex((date) => dayKey(date) > clearTo);
    const start = fromIndex >= 0 ? fromIndex : 0;
    const endExclusive = toIndex >= 0 ? toIndex : scheduleDays.length;
    const employeeIndexes = clearEmployeeId === "all" ? employees.map((_, index) => index) : employees.map((employee, index) => (employee.user_id === clearEmployeeId ? index : -1)).filter((index) => index >= 0);
    const changes: GridChange[] = [];
    employeeIndexes.forEach((row) => {
      for (let dayIndex = start; dayIndex < endExclusive; dayIndex += 1) {
        const col = dayIndex + 1;
        const oldValue = getValue(row, col);
        if (oldValue) changes.push([row, col, oldValue, ""]);
      }
    });
    queueChanges(changes, "Masinis grafiko išvalymas", `Išvalyta langelių: ${changes.length}`);
  };

  const exportSchedule = () => {
    const rows = [
      ["Darbuotojas", "Pareigybė", "Etatas", "Savaitės norma", "Mėnesio norma", ...scheduleDays.map((date) => `${pad2(date.getDate())} ${weekdayLabel(date)}`), "Iš viso", "Balansas", "Statusas"],
      ...employees.map((employee, row) => {
        const validation = validationByEmployee.get(employee.user_id);
        return [
          getName(employee),
          getRole(employee),
          formatEmploymentRate(employee),
          `${formatHours(getWeeklyContractHours(employee))} val.`,
          `${formatHours(validation?.monthlyContractHours || 0)} val.`,
          ...scheduleDays.map((_, dayIndex) => parseShiftValue(getValue(row, dayIndex + 1)).normalized),
          `${formatHours(validation?.plannedHours || 0)} val.`,
          `${validation && validation.monthlyBalanceHours > 0 ? "+" : ""}${formatHours(validation?.monthlyBalanceHours || 0)} val.`,
          validation?.statusLabel || "Be neatitikimų",
        ];
      }),
    ];
    downloadCsv(`grafikas-${monthLabel(scheduleMonth)}.csv`, rows);
  };

  const beginDrag = (value: string) => {
    const parsed = parseShiftValue(value);
    if (!parsed.normalized) return;
    setDragCopy({ value: parsed.normalized, cells: [] });
  };

  const dragOverCell = (row: number, col: number) => {
    setDragCopy((prev) => {
      if (!prev) return prev;
      if (prev.cells.some((cell) => cell.row === row && cell.col === col)) return prev;
      const employee = employees[row];
      const parsed = parseShiftValue(prev.value);
      if (employee && (parsed.kind === "work" || parsed.kind === "night") && getTrainingStatus(employee).blocking) return prev;
      const oldValue = getValue(row, col);
      setGrid((old) => {
        const next = old.map((item) => [...item]);
        if (!next[row]) next[row] = [];
        next[row][col] = prev.value;
        return next;
      });
      return { ...prev, cells: [...prev.cells, { row, col, oldValue }] };
    });
  };

  const finishDrag = () => {
    const drag = dragRef.current;
    setDragCopy(null);
    if (!drag || !drag.cells.length) return;
    queueChanges(drag.cells.map((cell) => [cell.row, cell.col, cell.oldValue, drag.value] as GridChange), "Kopijavimas tempiant", `Nukopijuota į ${drag.cells.length} lang.`);
  };

  const selectedPatternEmployee = employees.find((employee) => employee.user_id === templateEmployeeId) || activeEmployee || employees[0];
  const pattern = selectedPatternEmployee ? settings.patterns[selectedPatternEmployee.user_id] || {} : {};
  const departmentLabel = departmentFilter === "all" ? "visi skyriai" : departmentFilter === "none" ? "be skyriaus" : departmentFilter;
  const visibleCountText = `Rodoma: ${filter === "all" ? "visi darbuotojai" : filter === "errors" ? "darbuotojai su pažeidimais" : filter === "warnings" ? "darbuotojai su įspėjimais" : filter === "training" ? "mokymų rizikos" : "neatvykimų rezervacijos"} · ${departmentLabel} (${filteredEmployees.length} iš ${employees.length}).`;
  const maxSeven = Math.max(0, ...allValidations.map((row) => row.maxSevenDayHours));
  const shortestRestValues = allValidations.map((row) => row.shortestRestHours ?? Infinity).filter((value) => Number.isFinite(value));
  const shortestRest = shortestRestValues.length ? Math.min(...shortestRestValues) : null;
  const totalEmploymentRate = allValidations.reduce((sum, row) => sum + row.employmentRate, 0);
  const totalPlannedHours = allValidations.reduce((sum, row) => sum + row.plannedHours, 0);
  const totalContractHours = allValidations.reduce((sum, row) => sum + row.monthlyContractHours, 0);
  const overEmploymentCount = allValidations.filter((row) => row.monthlyBalanceHours > 1).length;

  return (
    <section className="schedule-module" onMouseUp={finishDrag}>
      <div className="schedule-toolbar">
        <div>
          <div className="eyebrow">Darbo grafikas</div>
          <h2>{monthLabel(scheduleMonth)}</h2>
          <p className="subtle">Tikrinamas darbo laikas, poilsis, neatvykimai, mokymai, pertraukos, prieššventinės dienos ir etato krūvio norma.</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="btn ghost" onClick={() => setScheduleMonth((prev) => addMonths(prev, -1))}><ChevronLeft size={16} /> Ankstesnis</button>
          <button type="button" className="btn ghost" onClick={() => setScheduleMonth(new Date())}><CalendarDays size={16} /> Šis mėnuo</button>
          <button type="button" className="btn ghost" onClick={() => setScheduleMonth((prev) => addMonths(prev, 1))}>Kitas <ChevronRight size={16} /></button>
          <button type="button" className="btn" onClick={exportSchedule}><Download size={16} /> Eksportuoti</button>
          <button type="button" className="btn primary" onClick={saveChanges} disabled={localSaving || saving || pendingChanges.length === 0}><Save size={16} /> {localSaving || saving ? "Saugoma..." : pendingChanges.length ? `Išsaugoti (${pendingChanges.length})` : "Išsaugota"}</button>
        </div>
      </div>

      <div className="kpi-grid">
        <button type="button" className={`kpi ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}><Users size={20} /> <b>{employees.length}</b><span>Darbuotojų</span></button>
        <button type="button" className="kpi"><Clock size={20} /> <b>{formatHours(totalEmploymentRate)}</b><span>Etatai</span></button>
        <button type="button" className={`kpi warn ${overEmploymentCount ? "active" : ""}`} onClick={() => setFilter("warnings")}><AlertTriangle size={20} /> <b>{overEmploymentCount}</b><span>Viršija etatą</span></button>
        <button type="button" className={`kpi bad ${filter === "errors" ? "active" : ""}`} onClick={() => setFilter("errors")}><AlertTriangle size={20} /> <b>{errorCount}</b><span>Pažeidimai</span></button>
        <button type="button" className={`kpi warn ${filter === "warnings" ? "active" : ""}`} onClick={() => setFilter("warnings")}><Clock size={20} /> <b>{warningCount}</b><span>Įspėjimai</span></button>
        <button type="button" className={`kpi bad ${filter === "training" ? "active" : ""}`} onClick={() => setFilter("training")}><GraduationCap size={20} /> <b>{trainingIssueCount}</b><span>Mokymų rizikos</span></button>
      </div>

      <div className="panel controls-panel">
        <div className="quick-actions">
          <span className="label">Greiti įrašai</span>
          {[["P", "Poilsis"], ["A", "Atostogos"], ["NA", "Nemokamos atostogos"], ["M", "Mamadienis"], ["T", "Tėvadienis"], ["L", "Liga"], ["G", "Išvykimas pas gydytoją"], ["TI", "Trumpas išvykimas"]].map(([code, label]) => (
            <button type="button" key={code} className="pill" title={label} onClick={() => quickSet(code)}>{code}</button>
          ))}
          <button type="button" className="pill" onClick={() => quickSet("08-17")}><Coffee size={13} /> 08-17</button>
          <button type="button" className="pill" onClick={() => quickSet("")}>Išvalyti</button>
        </div>
        <div className="help-text">Kopijavimas: pasirinkite langelį, naudokite <b>Ctrl+C</b> / <b>Ctrl+V</b> arba tempkite užpildytą langelį per kitus langelius. Etato norma skaičiuojama iš <b>employment_rate</b> ir <b>weekly_hours</b>.</div>
      </div>

      <div className="panel templates-panel">
        <div>
          <h3>Pamainų šablonai</h3>
          <p className="subtle">Pasirinkus grafiko langelį šablonas įrašomas į grafiką. Pasirinkus darbo laiko modelio lauką — į tą savaitės dieną. Pertrauka pridedama automatiškai pagal nustatymą.</p>
        </div>
        <div className="template-form">
          <select value={templateEmployeeId} onChange={(event) => setTemplateEmployeeId(event.target.value)}>
            {employees.map((employee) => <option key={employee.user_id} value={employee.user_id}>{getName(employee)}</option>)}
          </select>
          <input value={templateDraft} onChange={(event) => setTemplateDraft(event.target.value)} onBlur={(event) => { const parsed = parseShiftWithDefaultBreak(event.target.value, settings.defaultBreakMinutes); if (parsed.kind === "work" || parsed.kind === "night") setTemplateDraft(stripBreakFromValue(parsed.normalized)); }} placeholder="08-17" />
          <select
            value={String(settings.defaultBreakMinutes)}
            onChange={(event) => setSettings((prev) => ({ ...prev, defaultBreakMinutes: Number(event.target.value) }))}
            title="Automatiškai pridedama pertrauka į grafiko įrašus, kai šablone nenurodyta P."
          >
            <option value="0">Be auto pertraukos</option>
            <option value="30">Pertrauka 30 min.</option>
            <option value="45">Pertrauka 45 min.</option>
            <option value="60">Pertrauka 60 min.</option>
            <option value="90">Pertrauka 90 min.</option>
          </select>
          <button type="button" className="btn" onClick={addTemplate}><Plus size={15} /> Pridėti šabloną</button>
          {selectedPatternEmployee ? (
            <div className="employment-chip" title="Etatas ir savaitinė norma ateina iš darbuotojo kortelės / organization_members duomenų">
              {formatEmploymentRate(selectedPatternEmployee)} · {formatHours(getWeeklyContractHours(selectedPatternEmployee))} val./sav.
            </div>
          ) : null}
          {selectedPatternEmployee ? (
            <label className="checkline">
              <input
                type="checkbox"
                checked={Boolean(settings.allowTwentyFourHourDuty[selectedPatternEmployee.user_id])}
                onChange={(event) => setSettings((prev) => ({ ...prev, allowTwentyFourHourDuty: { ...prev.allowTwentyFourHourDuty, [selectedPatternEmployee.user_id]: event.target.checked } }))}
              />
              Leisti 24 val. budėjimus
            </label>
          ) : null}
        </div>
        <div className="template-list">
          {employeeTemplates.map((template) => (
            <button type="button" className="template-pill" key={template} onClick={() => useTemplate(template)}>
              {template}
              {activeEmployee && settings.templates[activeEmployee.user_id]?.includes(template) ? (
                <span onClick={(event) => { event.stopPropagation(); removeTemplate(activeEmployee.user_id, template); }}><X size={12} /></span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="panel pattern-panel">
        <div>
          <h3>Darbo laiko modelis</h3>
          <p className="subtle">Skirtingoms savaitės dienoms galima nustatyti skirtingą laiką. Paspauskite modelio lauką ir pasirinkite šabloną — laikas įsirašys į tą dieną.</p>
        </div>
        <div className="pattern-grid">
          {WEEKDAYS.map((day) => (
            <label key={day.day}>
              <span>{day.short}</span>
              <input
                value={stripBreakFromValue(pattern[day.day] || "")}
                onFocus={() => { setActiveCell(null); setActivePatternDay(day.day); }}
                onChange={(event) => selectedPatternEmployee && updatePattern(selectedPatternEmployee.user_id, day.day, event.target.value)}
                onBlur={(event) => selectedPatternEmployee && updatePattern(selectedPatternEmployee.user_id, day.day, event.target.value, true)}
                placeholder={day.day === 1 || day.day === 3 ? "08-17" : day.day === 2 || day.day === 4 ? "07-15" : ""}
              />
            </label>
          ))}
        </div>
        <div className="pattern-actions">
          <button type="button" className="btn" onClick={() => applyPattern("selected")}><Sparkles size={15} /> Pritaikyti pasirinktam darbuotojui</button>
          <button type="button" className="btn ghost" onClick={() => applyPattern("all")}>Pritaikyti visiems pagal jų modelius</button>
        </div>
      </div>

      <div className="panel bulk-panel">
        <div>
          <h3>Masiniai veiksmai</h3>
          <p className="subtle">Pasirinkite darbuotoją arba „Visi darbuotojai“, laikotarpį ir spauskite „Užpildyti pasirinktą laikotarpį“. Pildoma pagal kiekvieno darbuotojo darbo laiko modelį. Jei modelio nėra, taikoma 08:00-17:00; pertrauka pridedama automatiškai pagal nustatymą.</p>
        </div>
        <div className="bulk-actions">
          <button type="button" className="btn" onClick={autofillWorkdays}><Sparkles size={15} /> Užpildyti pasirinktą laikotarpį</button>
          <select className="bulk-control" value={clearEmployeeId} onChange={(event) => setClearEmployeeId(event.target.value)}>
            <option value="all">Visi darbuotojai</option>
            {employees.map((employee) => <option key={employee.user_id} value={employee.user_id}>{getName(employee)}</option>)}
          </select>
          <input className="bulk-control date-control" type="date" value={clearFrom} onChange={(event) => setClearFrom(event.target.value)} />
          <input className="bulk-control date-control" type="date" value={clearTo} onChange={(event) => setClearTo(event.target.value)} />
          <button type="button" className="btn danger" onClick={clearRange}><Trash2 size={15} /> Išvalyti laikotarpį</button>
          <button type="button" className="btn ghost" onClick={undo} disabled={!undoStack.length}><RotateCcw size={15} /> Atšaukti</button>
        </div>
      </div>

      {message ? <div className="notice"><CheckCircle2 size={16} /> {message}</div> : null}
      <div className="visible-filter-bar">
        <div className="visible-count">{visibleCountText}</div>
        <label className="search-filter">
          <span>Paieška</span>
          <input
            value={employeeSearch}
            onChange={(event) => setEmployeeSearch(event.target.value)}
            placeholder="Ieškoti darbuotojo, pareigų, skyriaus..."
          />
        </label>
        <label className="department-filter">
          <span>Skyrius</span>
          <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            <option value="all">Visi skyriai</option>
            {departmentOptions.map((department) => (
              <option key={department} value={department}>{department}</option>
            ))}
            <option value="none">Be skyriaus</option>
          </select>
        </label>
      </div>

      <div className="schedule-view-bar">
        <div className="view-mode-buttons">
          <button
            type="button"
            className={`btn ${scheduleView === "month" ? "primary" : "ghost"}`}
            onClick={() => setScheduleView("month")}
          >
            Mėnuo
          </button>
          <button
            type="button"
            className={`btn ${scheduleView === "week" ? "primary" : "ghost"}`}
            onClick={() => setScheduleView("week")}
          >
            Savaitė
          </button>
        </div>

        {scheduleView === "week" ? (
          <div className="week-switcher">
            <button type="button" className="btn ghost" onClick={showPreviousWeek} disabled={!canGoPreviousWeek}>
              <ChevronLeft size={15} /> Ankstesnė savaitė
            </button>
            <strong>{weekLabel}</strong>
            <button type="button" className="btn ghost" onClick={showNextWeek} disabled={!canGoNextWeek}>
              Kita savaitė <ChevronRight size={15} />
            </button>
          </div>
        ) : (
          <span className="view-help">Mėnesio vaizdas tinka suvestinei, savaitės — patogiam pildymui.</span>
        )}

        <button
          type="button"
          className="btn primary"
          onClick={() => setShowLargeGrid(true)}
        >
          <Sparkles size={15} /> Detalus vaizdas
        </button>
      </div>

      {allIssues.length > 0 ? (
        <div className={`validation-banner ${errorCount > 0 ? "bad" : "warn"}`}>
          <AlertTriangle size={18} />
          <div>
            <b>{errorCount > 0 ? "Yra grafiko pažeidimų" : "Yra grafiko įspėjimų"}</b>
            <span>{errorCount} pažeid. · {warningCount} įspėj. Paspauskite KPI arba žiūrėkite apačioje „Neatitikimai“.</span>
          </div>
        </div>
      ) : null}

      <div className="schedule-legend">
        <span><i className="legend-dot work" /> Dieninė</span>
        <span><i className="legend-dot night" /> Naktinė</span>
        <span><i className="legend-dot vacation" /> Atostogos / mamadienis</span>
        <span><i className="legend-dot sick" /> Liga</span>
        <span><i className="legend-dot off" /> Poilsis</span>
        <span><i className="legend-dot reserved" /> Rezervacija</span>
      </div>

      <div className="grid-shell">
        <div className="schedule-grid" style={{ gridTemplateColumns }}>
          <div className="head sticky-left">Darbuotojas</div>
          {visibleScheduleDays.map((date) => (
            <div key={dayKey(date)} className={`head ${isWeekend(date) ? "weekend" : ""} ${isHoliday(date) ? "holiday" : ""} ${isPreHoliday(date) ? "preholiday" : ""}`} title={isHoliday(date) ? "Šventinė diena" : isPreHoliday(date) ? "Prieššventinė diena" : ""}>
              <b>{pad2(date.getDate())}</b><small>{weekdayLabel(date)}</small>{isPreHoliday(date) ? <em>-1 val.</em> : null}
            </div>
          ))}
          <div className="head total-head">Iš viso</div>

          {filteredEmployees.map((employee) => {
            const rowIndex = employees.findIndex((item) => item.user_id === employee.user_id);
            const validation = validationByEmployee.get(employee.user_id);
            return (
              <div key={employee.user_id} className="row-fragment" style={{ display: "contents" }}>
                <div className="person sticky-left">
                  <b>{getName(employee)}</b>
                  <span>{getRole(employee)}</span>
                  <div className="person-meta">
                    <em>{formatHours(validation?.plannedHours || 0)}h / {formatHours(validation?.monthlyContractHours || 0)}h</em>
                    <em>{formatEmploymentRate(employee)}</em>
                    {validation?.issues.length ? <em className="bad">{validation.issues.length}!</em> : null}
                    {!validation?.issues.length && validation?.warnings.length ? <em className="warn">{validation.warnings.length}</em> : null}
                  </div>
                </div>
                {visibleScheduleDays.map((date, visibleDayIndex) => {
                  const originalDayIndex = visibleDayIndexes[visibleDayIndex];
                  const colIndex = originalDayIndex + 1;
                  if (originalDayIndex < 0) return null;
                  const rawValue = getValue(rowIndex, colIndex);
                  const parsed = parseShiftValue(rawValue);
                  const isEditing = editingCell?.row === rowIndex && editingCell.col === colIndex;
                  const reservation = reservationMap.get(`${employee.user_id}__${dayKey(date)}`);
                  const training = getTrainingStatus(employee);
                  const datedIssues = [...(validation?.issues || []), ...(validation?.warnings || [])].filter((issue) => issue.date === dayKey(date));
                  const hasCellIssue = datedIssues.some((issue) => issue.severity === "error");
                  const hasCellWarning = datedIssues.some((issue) => issue.severity === "warning");

                  return (
                    <div key={`${employee.user_id}-${dayKey(date)}`} className={`day-cell ${isWeekend(date) ? "weekend" : ""} ${isHoliday(date) ? "holiday" : ""} ${hasCellIssue ? "cell-error" : ""} ${hasCellWarning ? "cell-warning" : ""} ${reservation ? "reserved" : ""}`} onMouseEnter={() => dragCopy && dragOverCell(rowIndex, colIndex)}>
                      {isEditing ? (
                        <input
                          className="cell-input"
                          autoFocus
                          value={editingCell.draft}
                          onChange={(event) => setEditingCell((prev) => (prev ? { ...prev, draft: event.target.value } : prev))}
                          onFocus={(event) => event.currentTarget.select()}
                          onBlur={() => commitCell(rowIndex, colIndex, editingCell.oldValue, editingCell.draft)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") commitCell(rowIndex, colIndex, editingCell.oldValue, editingCell.draft);
                            if (event.key === "Escape") setEditingCell(null);
                            if (event.key === "Delete" || event.key === "Backspace") setEditingCell((prev) => (prev ? { ...prev, draft: "" } : prev));
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className={shiftClass(parsed, allowTwentyFourFor(employee))}
                          title={[parsed.detail, reservation ? `Rezervacija: ${reservation.label}` : "", datedIssues.map((issue) => issue.detail).join("; ")].filter(Boolean).join("\n")}
                          onClick={() => { setActivePatternDay(null); setActiveCell({ row: rowIndex, col: colIndex }); setEditingCell({ row: rowIndex, col: colIndex, draft: stripBreakFromValue(parsed.normalized), oldValue: rawValue }); }}
                          onMouseDown={() => beginDrag(parsed.normalized)}
                          onKeyDown={(event) => {
                            if (event.ctrlKey && event.key.toLowerCase() === "c") { setClipboardValue(parsed.normalized); setMessage(`Nukopijuota: ${parsed.normalized || "tuščia"}`); }
                            if (event.ctrlKey && event.key.toLowerCase() === "v" && clipboardValue) commitCell(rowIndex, colIndex, rawValue, clipboardValue);
                            if (event.key === "Delete") commitCell(rowIndex, colIndex, rawValue, "");
                            if (["p", "P", "a", "A", "l", "L", "m", "M", "t", "T"].includes(event.key)) commitCell(rowIndex, colIndex, rawValue, event.key.toUpperCase());
                          }}
                        >
                          {reservation ? <span className="badge reservation">R</span> : null}
                          {training.blocking && (parsed.kind === "work" || parsed.kind === "night") ? <span className="badge training">M</span> : null}
                          {parsed.kind === "work" || parsed.kind === "night" ? (
                            <span className="time"><span>{parsed.label.split("-")[0]}</span><i /><span>{parsed.label.split("-")[1]}</span>{parsed.breakMinutes ? <small>P{parsed.breakMinutes}</small> : null}</span>
                          ) : <span>{parsed.label}</span>}
                        </button>
                      )}
                    </div>
                  );
                })}
                <div className="total-cell">
                  <b>{formatHours(validation?.plannedHours || 0)} / {formatHours(validation?.monthlyContractHours || 0)} val.</b>
                  <small className={validation && Math.abs(validation.monthlyBalanceHours) > 1 ? validation.monthlyBalanceHours > 0 ? "over" : "under" : "ok"}>
                    {validation ? `${validation.monthlyBalanceHours > 0 ? "+" : ""}${formatHours(validation.monthlyBalanceHours)} val.` : "0 val."}
                  </small>
                  <span className={`status ${validation?.statusClass || "ok"}`}>{validation?.statusLabel || "Be neatitikimų"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showLargeGrid && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center overflow-auto">
          <div className="w-full max-w-[1850px] max-h-[94vh] rounded-3xl bg-white p-4 overflow-hidden flex flex-col my-auto">
            <div className="mb-4 flex shrink-0 items-center justify-between">
              <div>
                <p className="eyebrow">Pilnas grafikas</p>
                <h3>{monthLabel(scheduleMonth)}</h3>
              </div>

              <button
                type="button"
                className="btn ghost"
                onClick={() => setShowLargeGrid(false)}
              >
                Uždaryti
              </button>
            </div>

            <div className="grid-shell large-grid-shell">
        <div className="schedule-grid large-schedule-grid" style={{ gridTemplateColumns: scheduleView === "week" ? `220px repeat(${visibleScheduleDays.length}, 112px) 150px` : `200px repeat(${visibleScheduleDays.length}, 41px) 118px` }}>
          <div className="head sticky-left">Darbuotojas</div>
          {visibleScheduleDays.map((date) => (
            <div key={dayKey(date)} className={`head ${isWeekend(date) ? "weekend" : ""} ${isHoliday(date) ? "holiday" : ""} ${isPreHoliday(date) ? "preholiday" : ""}`} title={isHoliday(date) ? "Šventinė diena" : isPreHoliday(date) ? "Prieššventinė diena" : ""}>
              <b>{pad2(date.getDate())}</b><small>{weekdayLabel(date)}</small>{isPreHoliday(date) ? <em>-1 val.</em> : null}
            </div>
          ))}
          <div className="head total-head">Iš viso</div>

          {filteredEmployees.map((employee) => {
            const rowIndex = employees.findIndex((item) => item.user_id === employee.user_id);
            const validation = validationByEmployee.get(employee.user_id);
            return (
              <div key={employee.user_id} className="row-fragment" style={{ display: "contents" }}>
                <div className="person sticky-left">
                  <b>{getName(employee)}</b>
                  <span>{getRole(employee)}</span>
                  <div className="person-meta">
                    <em>{formatHours(validation?.plannedHours || 0)}h / {formatHours(validation?.monthlyContractHours || 0)}h</em>
                    <em>{formatEmploymentRate(employee)}</em>
                    {validation?.issues.length ? <em className="bad">{validation.issues.length}!</em> : null}
                    {!validation?.issues.length && validation?.warnings.length ? <em className="warn">{validation.warnings.length}</em> : null}
                  </div>
                </div>
                {visibleScheduleDays.map((date, visibleDayIndex) => {
                  const originalDayIndex = visibleDayIndexes[visibleDayIndex];
                  const colIndex = originalDayIndex + 1;
                  if (originalDayIndex < 0) return null;
                  const rawValue = getValue(rowIndex, colIndex);
                  const parsed = parseShiftValue(rawValue);
                  const isEditing = editingCell?.row === rowIndex && editingCell.col === colIndex;
                  const reservation = reservationMap.get(`${employee.user_id}__${dayKey(date)}`);
                  const training = getTrainingStatus(employee);
                  const datedIssues = [...(validation?.issues || []), ...(validation?.warnings || [])].filter((issue) => issue.date === dayKey(date));
                  const hasCellIssue = datedIssues.some((issue) => issue.severity === "error");
                  const hasCellWarning = datedIssues.some((issue) => issue.severity === "warning");

                  return (
                    <div key={`${employee.user_id}-${dayKey(date)}`} className={`day-cell ${isWeekend(date) ? "weekend" : ""} ${isHoliday(date) ? "holiday" : ""} ${hasCellIssue ? "cell-error" : ""} ${hasCellWarning ? "cell-warning" : ""} ${reservation ? "reserved" : ""}`} onMouseEnter={() => dragCopy && dragOverCell(rowIndex, colIndex)}>
                      {isEditing ? (
                        <input
                          className="cell-input"
                          autoFocus
                          value={editingCell.draft}
                          onChange={(event) => setEditingCell((prev) => (prev ? { ...prev, draft: event.target.value } : prev))}
                          onFocus={(event) => event.currentTarget.select()}
                          onBlur={() => commitCell(rowIndex, colIndex, editingCell.oldValue, editingCell.draft)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") commitCell(rowIndex, colIndex, editingCell.oldValue, editingCell.draft);
                            if (event.key === "Escape") setEditingCell(null);
                            if (event.key === "Delete" || event.key === "Backspace") setEditingCell((prev) => (prev ? { ...prev, draft: "" } : prev));
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className={shiftClass(parsed, allowTwentyFourFor(employee))}
                          title={[parsed.detail, reservation ? `Rezervacija: ${reservation.label}` : "", datedIssues.map((issue) => issue.detail).join("; ")].filter(Boolean).join("\n")}
                          onClick={() => { setActivePatternDay(null); setActiveCell({ row: rowIndex, col: colIndex }); setEditingCell({ row: rowIndex, col: colIndex, draft: stripBreakFromValue(parsed.normalized), oldValue: rawValue }); }}
                          onMouseDown={() => beginDrag(parsed.normalized)}
                          onKeyDown={(event) => {
                            if (event.ctrlKey && event.key.toLowerCase() === "c") { setClipboardValue(parsed.normalized); setMessage(`Nukopijuota: ${parsed.normalized || "tuščia"}`); }
                            if (event.ctrlKey && event.key.toLowerCase() === "v" && clipboardValue) commitCell(rowIndex, colIndex, rawValue, clipboardValue);
                            if (event.key === "Delete") commitCell(rowIndex, colIndex, rawValue, "");
                            if (["p", "P", "a", "A", "l", "L", "m", "M", "t", "T"].includes(event.key)) commitCell(rowIndex, colIndex, rawValue, event.key.toUpperCase());
                          }}
                        >
                          {reservation ? <span className="badge reservation">R</span> : null}
                          {training.blocking && (parsed.kind === "work" || parsed.kind === "night") ? <span className="badge training">M</span> : null}
                          {parsed.kind === "work" || parsed.kind === "night" ? (
                            <span className="time"><span>{parsed.label.split("-")[0]}</span><i /><span>{parsed.label.split("-")[1]}</span>{parsed.breakMinutes ? <small>P{parsed.breakMinutes}</small> : null}</span>
                          ) : <span>{parsed.label}</span>}
                        </button>
                      )}
                    </div>
                  );
                })}
                <div className="total-cell">
                  <b>{formatHours(validation?.plannedHours || 0)} / {formatHours(validation?.monthlyContractHours || 0)} val.</b>
                  <small className={validation && Math.abs(validation.monthlyBalanceHours) > 1 ? validation.monthlyBalanceHours > 0 ? "over" : "under" : "ok"}>
                    {validation ? `${validation.monthlyBalanceHours > 0 ? "+" : ""}${formatHours(validation.monthlyBalanceHours)} val.` : "0 val."}
                  </small>
                  <span className={`status ${validation?.statusClass || "ok"}`}>{validation?.statusLabel || "Be neatitikimų"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
          </div>
        </div>
      )}

      <div className="bottom-grid">
        <div className="panel issues-panel">
          <div className="panel-title"><AlertTriangle size={17} /> Neatitikimai</div>
          {allIssues.length ? (
            <div className="issues-list">
              {allIssues.slice(0, 80).map((issue) => (
                <div key={issue.id} className={`issue ${issue.severity === "error" ? "bad" : "warn"}`}>
                  <b>{issue.employeeName}</b> · {issue.title}<br /><span>{issue.detail}</span>
                </div>
              ))}
            </div>
          ) : <div className="empty-state">Neatitikimų nerasta.</div>}
        </div>

        <div className="panel summary-panel">
          <div className="panel-title"><CheckCircle2 size={17} /> Darbo laiko atitikties suvestinė</div>
          <div className="summary-grid">
            <div><span>Pažeidimai</span><b>{errorCount}</b></div>
            <div><span>Įspėjimai</span><b>{warningCount}</b></div>
            <div><span>Mokymų rizikos</span><b>{trainingIssueCount}</b></div>
            <div><span>Rezervacijos</span><b>{reservationCount}</b></div>
            <div><span>Didžiausia 7 d. suma</span><b>{formatHours(maxSeven)} val.</b></div>
            <div><span>Trumpiausias poilsis</span><b>{formatHours(shortestRest)} val.</b></div>
            <div><span>Etatai iš viso</span><b>{formatHours(totalEmploymentRate)} et.</b></div>
            <div><span>Planuota / norma</span><b>{formatHours(totalPlannedHours)} / {formatHours(totalContractHours)} val.</b></div>
          </div>
        </div>

        <div className="panel history-panel">
          <div className="panel-title"><History size={17} /> Veiksmų istorija</div>
          {history.length ? <div className="history-list">{history.slice(0, 30).map((item) => <div key={item.id} className="history-item"><span>{item.label}</span><small>{item.at}</small></div>)}</div> : <div className="empty-state">Pakeitimų dar nėra.</div>}
        </div>
      </div>

      <style jsx>{`
        .schedule-module {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          display: grid;
          gap: 14px;
          padding: 14px;
          overflow: hidden;
          background: #f8fafc;
          color: #0f172a;
        }

        .schedule-toolbar,
        .panel,
        .notice,
        .visible-count {
          min-width: 0;
          background: #fff;
          border: 1px solid #dbe4ef;
          border-radius: 18px;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
        }

        .schedule-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: start;
          padding: 16px;
        }

        .eyebrow {
          color: #047857;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        h2,
        h3 {
          margin: 0;
          letter-spacing: -0.04em;
        }

        h2 {
          font-size: clamp(24px, 2vw, 34px);
          line-height: 1.05;
        }

        h3 {
          font-size: 16px;
        }

        .subtle {
          margin: 4px 0 0;
          color: #64748b;
          font-weight: 750;
          font-size: 13px;
          line-height: 1.35;
        }

        .toolbar-actions,
        .quick-actions,
        .template-form,
        .template-list,
        .pattern-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .btn,
        .pill,
        .template-pill,
        select,
        input {
          min-width: 0;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          min-height: 36px;
          padding: 0 12px;
          background: #fff;
          color: #0f172a;
          font-weight: 900;
          font-size: 14px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          cursor: pointer;
          white-space: nowrap;
        }

        .btn.primary {
          background: #047857;
          border-color: #047857;
          color: #fff;
        }

        .btn.ghost {
          background: #f8fafc;
        }

        .btn.danger {
          color: #991b1b;
          border-color: #fecaca;
          background: #fff5f5;
        }

        .btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .kpi {
          min-height: 96px;
          text-align: left;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 8px 10px;
          align-content: center;
          align-items: center;
          padding: 14px;
          border-radius: 20px;
          background: #fff;
          border: 1px solid #dbe4ef;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
          cursor: pointer;
        }

        .kpi svg {
          grid-row: span 2;
          padding: 8px;
          width: 38px;
          height: 38px;
          border-radius: 14px;
          background: #ecfdf5;
          color: #047857;
        }

        .kpi b {
          font-size: 30px;
          line-height: 1;
        }

        .kpi span {
          min-width: 0;
          color: #64748b;
          font-weight: 900;
        }

        .kpi.bad {
          background: #fff7f7;
          border-color: #fecaca;
        }

        .kpi.bad svg {
          background: #fee2e2;
          color: #dc2626;
        }

        .kpi.warn {
          background: #fffbeb;
          border-color: #fed7aa;
        }

        .kpi.warn svg {
          background: #ffedd5;
          color: #d97706;
        }

        .kpi.active {
          outline: 3px solid rgba(4, 120, 87, .2);
        }

        .panel {
          padding: 14px;
        }

        .controls-panel,
        .templates-panel,
        .pattern-panel {
          display: grid;
          grid-template-columns: minmax(220px, .8fr) minmax(0, 1.2fr);
          gap: 12px;
          align-items: center;
        }

        .bulk-panel {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) minmax(420px, 720px);
          gap: 14px;
          align-items: center;
        }

        .bulk-actions {
          display: grid;
          grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) 140px 140px;
          gap: 8px;
          align-items: center;
          justify-self: end;
          width: min(720px, 100%);
        }

        .bulk-actions .btn {
          min-height: 38px;
        }

        .bulk-actions .danger {
          grid-column: 1 / span 2;
        }

        .bulk-actions .ghost {
          grid-column: 3 / span 2;
        }

        .bulk-control {
          width: 100%;
        }

        .date-control {
          min-width: 0;
        }

        .label {
          color: #64748b;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          background: #f1f5f9;
        }

        .help-text {
          justify-self: end;
          color: #334155;
          font-weight: 800;
          font-size: 13px;
        }

        .template-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ecfdf5;
          color: #065f46;
          border-color: #bbf7d0;
          cursor: pointer;
        }

        .employment-chip {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 0 12px;
          border: 1px solid #d7e5dc;
          background: #f3faf5;
          color: #27533b;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .checkline {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 36px;
          padding: 0 10px;
          border-radius: 12px;
          background: #f8fafc;
          font-weight: 900;
          color: #334155;
        }

        .checkline input {
          min-height: auto;
          padding: 0;
        }

        .pattern-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(86px, 1fr));
          gap: 8px;
        }

        .pattern-grid label {
          display: grid;
          gap: 5px;
          font-weight: 950;
          color: #64748b;
          font-size: 12px;
        }

        .pattern-grid input {
          width: 100%;
          min-width: 0;
          font-size: 12px;
          padding-inline: 8px;
        }

        .notice {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          color: #047857;
          font-weight: 900;
        }

        .visible-count {
          padding: 10px 12px;
          font-weight: 900;
        }

        .grid-shell {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          max-height: 75vh;
          overflow: auto;
          overscroll-behavior-x: contain;
          border-radius: 18px;
          border: 1px solid #cbd5e1;
          background: #fff;
          box-shadow: 0 18px 44px rgba(15,23,42,.09);
          padding-bottom: 8px;
        }

        .grid-shell::-webkit-scrollbar {
          height: 12px;
        }

        .grid-shell::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 999px;
        }

        .grid-shell::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 999px;
          border: 2px solid #f1f5f9;
        }

        .schedule-grid {
          display: grid;
          width: max-content;
          min-width: 100%;
        }

        .head {
          position: sticky;
          top: 0;
          z-index: 10;
          min-height: 44px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border-right: 1px solid #dbe4ef;
          border-bottom: 1px solid #dbe4ef;
          background: #f1f5f9;
          font-weight: 950;
          font-size: 13px;
        }

        .head b {
          font-size: 17px;
          line-height: 1;
        }

        .head.weekend {
          background: #ffedd5;
        }

        .head.holiday {
          background: #fee2e2;
          color: #991b1b;
        }

        .head.preholiday {
          background: #fef3c7;
        }

        .head small {
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .head em {
          font-style: normal;
          color: #b45309;
          font-size: 8px;
        }

        .sticky-left {
          position: sticky;
          left: 0;
          z-index: 20;
          align-items: flex-start;
          padding-left: 10px;
          box-shadow: 5px 0 12px rgba(15,23,42,.04);
        }

        .person {
          min-height: 36px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 3px;
          border-right: 1px solid #dbe4ef;
          border-bottom: 1px solid #dbe4ef;
          background: linear-gradient(180deg,#fff,#f8fafc);
        }

        .person b {
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 150px;
        }

        .person span {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #64748b;
          font-size: 10px;
          font-weight: 850;
        }

        .day-cell {
          min-height: 36px;
          padding: 2px;
          border-right: 1px solid #dbe4ef;
          border-bottom: 1px solid #dbe4ef;
          background: #fff;
        }

        .day-cell.weekend {
          background: #fffaf4;
        }

        .day-cell.holiday {
          background: #fff5f5;
        }

        .day-cell.cell-error {
          box-shadow: inset 0 0 0 2px rgba(220,38,38,.5);
        }

        .day-cell.cell-warning {
          box-shadow: inset 0 0 0 2px rgba(217,119,6,.38);
        }

        .day-cell.reserved {
          background-image: repeating-linear-gradient(135deg,rgba(100,116,139,.13) 0 6px,transparent 6px 12px);
        }

        .shift {
          position: relative;
          width: 100%;
          height: 36px;
          border: 0;
          border-radius: 9px;
          display: grid;
          place-items: center;
          cursor: pointer;
          font-weight: 950;
          color: #0f172a;
        }

        .shift-empty {
          border: 1px dashed #cbd5e1;
          background: #fff;
          color: transparent;
          font-size: 16px;
          transition: all .18s ease;
        }

        .shift-empty:hover {
          border-color: #047857;
          background: #ecfdf5;
          color: #047857;
          transform: scale(1.04);
        }

        .shift-work {
          background: linear-gradient(135deg,#dcfce7,#86efac);
          color: #065f46;
        }

        .shift-night {
          background: linear-gradient(135deg,#e0e7ff,#818cf8);
          color: #312e81;
        }

        .shift-warning {
          background: linear-gradient(135deg,#ffedd5,#fdba74);
          color: #9a3412;
        }

        .shift-duty {
          background: linear-gradient(135deg,#e0f2fe,#7dd3fc);
          color: #075985;
        }

        .shift-danger,
        .shift-unknown {
          background: linear-gradient(135deg,#fee2e2,#fca5a5);
          color: #991b1b;
        }

        .shift-off {
          background: linear-gradient(135deg,#ede9fe,#c4b5fd);
          color: #5b21b6;
        }

        .shift-vacation,
        .shift-reserved,
        .shift-shortLeave {
          background: linear-gradient(135deg,#dbeafe,#93c5fd);
          color: #1e40af;
        }

        .shift-sick {
          background: linear-gradient(135deg,#fee2e2,#fca5a5);
          color: #991b1b;
        }

        .time {
          display: grid;
          justify-items: center;
          gap: 1px;
          font-size: 6px;
          line-height: 1;
          transform: scaleX(.86);
        }

        .time i {
          width: 10px;
          height: 1px;
          background: currentColor;
          opacity: .4;
        }

        .time small {
          font-size: 6px;
          opacity: .8;
        }

        .badge {
          position: absolute;
          top: 3px;
          width: 13px;
          height: 13px;
          border-radius: 999px;
          color: #fff;
          display: grid;
          place-items: center;
          font-size: 6px;
          font-weight: 950;
        }

        .badge.reservation {
          right: 3px;
          background: #64748b;
        }

        .badge.training {
          left: 3px;
          background: #dc2626;
        }

        .cell-input {
          width: 100%;
          height: 36px;
          border: 2px solid #047857;
          border-radius: 9px;
          text-align: center;
          font-size: 10px;
          font-weight: 950;
          outline: none;
          padding: 0 2px;
        }

        .total-head {
          padding-inline: 6px;
          text-align: center;
        }

        .total-cell {
          min-height: 36px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          border-bottom: 1px solid #dbe4ef;
          background: #f8fafc;
          padding: 4px;
        }

        .total-cell b {
          font-size: 10px;
        }

        .status {
          font-size: 7px;
          font-weight: 950;
          max-width: 62px;
          text-align: center;
          line-height: 1.12;
        }

        .status.ok {
          color: #047857;
        }

        .status.warn {
          color: #d97706;
        }

        .status.bad {
          color: #dc2626;
        }

        .bottom-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          align-items: start;
        }

        .panel-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 950;
          margin-bottom: 10px;
        }

        .issues-list,
        .history-list {
          display: grid;
          gap: 7px;
          max-height: 260px;
          overflow: auto;
        }

        .issue {
          padding: 9px 10px;
          border-radius: 13px;
          border: 1px solid #dbe4ef;
          background: #f8fafc;
          font-size: 12px;
        }

        .issue.bad {
          background: #fef2f2;
          border-color: #fecaca;
        }

        .issue.warn {
          background: #fff7ed;
          border-color: #fed7aa;
        }

        .issue span {
          color: #475569;
          font-weight: 750;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap: 8px;
        }

        .summary-grid div {
          padding: 10px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          display: grid;
          gap: 4px;
        }

        .summary-grid span {
          color: #64748b;
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .summary-grid b {
          font-size: 16px;
        }

        .history-item {
          display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          gap: 8px;
          padding: 9px 10px;
          border-radius: 13px;
          background: #f8fafc;
          font-weight: 850;
          font-size: 12px;
        }

        .history-item span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .history-item small {
          color: #64748b;
          font-weight: 900;
        }

        .empty-state {
          color: #64748b;
          font-weight: 850;
          padding: 14px;
          border-radius: 14px;
          background: #f8fafc;
        }



        .large-grid-shell {
          flex: 1;
          min-height: 0;
          width: 100%;
          max-width: 100%;
          overflow: auto;
          border-radius: 22px;
        }

        .large-schedule-grid {
          width: max-content;
          min-width: max-content;
        }

        .large-schedule-grid .head {
          min-height: 48px;
        }

        .large-schedule-grid .head b {
          font-size: 18px;
        }

        .large-schedule-grid .head small {
          font-size: 9px;
        }

        .large-schedule-grid .person {
          min-height: 58px;
          padding-left: 12px;
        }

        .large-schedule-grid .person b {
          max-width: 158px;
          font-size: 13px;
        }

        .large-schedule-grid .person span {
          max-width: 158px;
          font-size: 11px;
        }

        .large-schedule-grid .day-cell {
          min-height: 58px;
          padding: 4px;
        }

        .large-schedule-grid .shift {
          height: 50px;
          border-radius: 12px;
        }

        .large-schedule-grid .cell-input {
          height: 50px;
          border-radius: 12px;
          font-size: 12px;
        }

        .large-schedule-grid .time {
          font-size: 8px;
          transform: none;
        }

        .large-schedule-grid .time small {
          font-size: 9px;
        }

        .large-schedule-grid .total-cell {
          min-height: 58px;
        }

        .large-schedule-grid .total-cell b {
          font-size: 12px;
        }

        .large-schedule-grid .status {
          max-width: 112px;
          font-size: 9px;
        }


        .schedule-grid .day-cell {
          position: relative;
          z-index: 1;
        }

        .schedule-grid .shift {
          pointer-events: auto;
          touch-action: manipulation;
        }

        .schedule-grid .sticky-left {
          z-index: 12;
        }

        .schedule-grid .head.sticky-left {
          z-index: 18;
        }

        .schedule-grid .total-head,
        .schedule-grid .total-cell {
          position: relative;
          z-index: 2;
        }


        .schedule-view-bar {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          padding: 10px 12px;
          background: #fff;
          border: 1px solid #dbe4ef;
          border-radius: 18px;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
        }

        .view-mode-buttons,
        .week-switcher {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .week-switcher {
          justify-content: center;
        }

        .week-switcher strong {
          min-width: 220px;
          text-align: center;
          color: #0f172a;
          font-weight: 950;
        }

        .view-help {
          color: #64748b;
          font-size: 13px;
          font-weight: 850;
          text-align: center;
        }

        .schedule-grid[style*="112px"] .head {
          min-height: 58px;
        }

        .schedule-grid[style*="112px"] .day-cell {
          min-height: 78px;
          padding: 6px;
        }

        .schedule-grid[style*="112px"] .shift {
          height: 66px;
          border-radius: 16px;
        }

        .schedule-grid[style*="112px"] .cell-input {
          height: 66px;
          border-radius: 16px;
          font-size: 14px;
        }

        .schedule-grid[style*="112px"] .time {
          font-size: 10px;
          transform: none;
        }

        .schedule-grid[style*="112px"] .time small {
          font-size: 9px;
        }

        .schedule-grid[style*="112px"] .person {
          min-height: 78px;
        }

        .schedule-grid[style*="112px"] .total-cell {
          min-height: 78px;
        }

        .visible-filter-bar {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) minmax(260px, 420px) minmax(220px, 320px);
          gap: 10px;
          align-items: center;
        }

        .department-filter {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 8px;
          min-width: 0;
          background: #fff;
          border: 1px solid #dbe4ef;
          border-radius: 18px;
          padding: 8px 10px;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
        }

        .department-filter span {
          color: #64748b;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .department-filter select {
          width: 100%;
          min-height: 34px;
          font-size: 13px;
        }



        .validation-banner {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          border-radius: 18px;
          border: 1px solid #fed7aa;
          background: #fffbeb;
          color: #92400e;
          padding: 12px 14px;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
        }

        .validation-banner.bad {
          border-color: #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .validation-banner div {
          display: grid;
          gap: 2px;
        }

        .validation-banner span {
          font-size: 13px;
          font-weight: 800;
          color: inherit;
          opacity: .86;
        }

        .schedule-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          padding: 10px 12px;
          border-radius: 18px;
          border: 1px solid #dbe4ef;
          background: #fff;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
          font-size: 12px;
          font-weight: 900;
          color: #334155;
        }

        .schedule-legend span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .legend-dot {
          width: 11px;
          height: 11px;
          border-radius: 999px;
          display: inline-block;
        }

        .legend-dot.work { background: #22c55e; }
        .legend-dot.night { background: #6366f1; }
        .legend-dot.vacation { background: #60a5fa; }
        .legend-dot.sick { background: #ef4444; }
        .legend-dot.off { background: #8b5cf6; }
        .legend-dot.reserved { background: #64748b; }

        .person-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 3px;
        }

        .person-meta em {
          font-style: normal;
          border-radius: 999px;
          background: #f1f5f9;
          color: #334155;
          padding: 2px 6px;
          font-size: 9px;
          font-weight: 950;
          line-height: 1;
        }

        .person-meta em.bad {
          background: #fee2e2;
          color: #991b1b;
        }

        .person-meta em.warn {
          background: #ffedd5;
          color: #9a3412;
        }

        .search-filter {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 8px;
          min-width: 0;
          background: #fff;
          border: 1px solid #dbe4ef;
          border-radius: 18px;
          padding: 8px 10px;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
        }

        .search-filter span {
          color: #64748b;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .search-filter input {
          width: 100%;
          min-height: 34px;
          font-size: 13px;
        }

        @media (max-width: 1280px) {
          .schedule-toolbar,
          .controls-panel,
          .templates-panel,
          .bulk-panel,
          .pattern-panel {
            grid-template-columns: 1fr;
          }

          .toolbar-actions,
          .bulk-actions {
            justify-self: stretch;
          }

          .bulk-actions {
            width: 100%;
          }

          .bottom-grid {
            grid-template-columns: 1fr;
          }

  
        .large-grid-shell {
          flex: 1;
          min-height: 0;
          width: 100%;
          max-width: 100%;
          overflow: auto;
          border-radius: 22px;
        }

        .large-schedule-grid {
          width: max-content;
          min-width: max-content;
        }

        .large-schedule-grid .head {
          min-height: 48px;
        }

        .large-schedule-grid .head b {
          font-size: 18px;
        }

        .large-schedule-grid .head small {
          font-size: 9px;
        }

        .large-schedule-grid .person {
          min-height: 58px;
          padding-left: 12px;
        }

        .large-schedule-grid .person b {
          max-width: 158px;
          font-size: 13px;
        }

        .large-schedule-grid .person span {
          max-width: 158px;
          font-size: 11px;
        }

        .large-schedule-grid .day-cell {
          min-height: 58px;
          padding: 4px;
        }

        .large-schedule-grid .shift {
          height: 50px;
          border-radius: 12px;
        }

        .large-schedule-grid .cell-input {
          height: 50px;
          border-radius: 12px;
          font-size: 12px;
        }

        .large-schedule-grid .time {
          font-size: 8px;
          transform: none;
        }

        .large-schedule-grid .time small {
          font-size: 9px;
        }

        .large-schedule-grid .total-cell {
          min-height: 58px;
        }

        .large-schedule-grid .total-cell b {
          font-size: 12px;
        }

        .large-schedule-grid .status {
          max-width: 112px;
          font-size: 9px;
        }


        .schedule-grid .day-cell {
          position: relative;
          z-index: 1;
        }

        .schedule-grid .shift {
          pointer-events: auto;
          touch-action: manipulation;
        }

        .schedule-grid .sticky-left {
          z-index: 12;
        }

        .schedule-grid .head.sticky-left {
          z-index: 18;
        }

        .schedule-grid .total-head,
        .schedule-grid .total-cell {
          position: relative;
          z-index: 2;
        }


        .schedule-view-bar {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          padding: 10px 12px;
          background: #fff;
          border: 1px solid #dbe4ef;
          border-radius: 18px;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
        }

        .view-mode-buttons,
        .week-switcher {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .week-switcher {
          justify-content: center;
        }

        .week-switcher strong {
          min-width: 220px;
          text-align: center;
          color: #0f172a;
          font-weight: 950;
        }

        .view-help {
          color: #64748b;
          font-size: 13px;
          font-weight: 850;
          text-align: center;
        }

        .schedule-grid[style*="112px"] .head {
          min-height: 58px;
        }

        .schedule-grid[style*="112px"] .day-cell {
          min-height: 78px;
          padding: 6px;
        }

        .schedule-grid[style*="112px"] .shift {
          height: 66px;
          border-radius: 16px;
        }

        .schedule-grid[style*="112px"] .cell-input {
          height: 66px;
          border-radius: 16px;
          font-size: 14px;
        }

        .schedule-grid[style*="112px"] .time {
          font-size: 10px;
          transform: none;
        }

        .schedule-grid[style*="112px"] .time small {
          font-size: 9px;
        }

        .schedule-grid[style*="112px"] .person {
          min-height: 78px;
        }

        .schedule-grid[style*="112px"] .total-cell {
          min-height: 78px;
        }

        .visible-filter-bar {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .schedule-module {
            padding: 10px;
          }

          .kpi-grid,
          .pattern-grid {
            grid-template-columns: 1fr;
          }

          .bulk-actions {
            grid-template-columns: 1fr;
          }

          .bulk-actions .danger,
          .bulk-actions .ghost {
            grid-column: auto;
          }

          .help-text {
            justify-self: start;
          }
        }
      `}</style>
    </section>
  );
}
