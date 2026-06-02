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
  organization_id?: string | null;
  employee_id: string;
  user_id?: string | null;
  shift_date?: string | null;
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
  onSaveGridChanges: (
    changes: unknown[],
    options?: { status: "draft" | "published"; publish: boolean },
  ) => Promise<void> | void;
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
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value) ||
    !Number.isFinite(value)
  )
    return "—";
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
  const explicit =
    parseNumericValue(employee?.weekly_hours) ??
    parseNumericValue(employee?.contract_weekly_hours);
  if (explicit !== null && explicit > 0) return Math.min(explicit, 80);
  return getEmploymentRate(employee) * 40;
}

function getMonthlyContractHours(
  scheduleDays: Date[],
  employee?: Employee | null,
) {
  const workableDays = scheduleDays.filter(
    (date) => !isWeekend(date) && !isHoliday(date),
  ).length;
  return (getWeeklyContractHours(employee) / 5) * workableDays;
}

function formatEmploymentRate(employee?: Employee | null) {
  return `${getEmploymentRate(employee).toFixed(2).replace(".", ",")} et.`;
}

function dayKey(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
    .toISOString()
    .slice(0, 10);
}

function weekdayLabel(date: Date) {
  return new Intl.DateTimeFormat("lt-LT", { weekday: "short" })
    .format(date)
    .replace(".", "");
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function cleanText(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
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
  const parts = raw
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
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
    return {
      normalized: "",
      label: "+",
      detail: "Tuščia",
      kind: "empty",
      hours: null,
      grossHours: null,
      breakMinutes: 0,
      startMinutes: null,
      endMinutes: null,
      crossesMidnight: false,
    };
  }

  const statuses: Record<
    string,
    { code: string; label: string; kind: ShiftKind }
  > = {
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
    R: {
      code: "R",
      label: "Laukianti neatvykimo rezervacija",
      kind: "reserved",
    },
  };

  if (statuses[upper]) {
    const status = statuses[upper];
    return {
      normalized: status.code,
      label: status.code,
      detail: status.label,
      kind: status.kind,
      hours: null,
      grossHours: null,
      breakMinutes: 0,
      startMinutes: null,
      endMinutes: null,
      crossesMidnight: false,
    };
  }

  // Trumpi išvykimai nebelaikomi grafiko / tabelio kodais.
  // Juos reikia registruoti atskirame neatvykimų / vidaus įvykių modulyje.

  // Pertrauka gali būti rašoma: 08-17 P30, 08-17 / P45, 08-17 pietūs 30
  const breakMatch = upper.match(
    /(?:^|\s|\/)(?:P|PIETŪS|PIETUS|PIETU|PIETŲ|PERTRAUKA)\s*(\d{1,3})\s*(?:MIN)?$/,
  );
  const breakMinutes = breakMatch ? Number(breakMatch[1]) : 0;
  const withoutBreak = raw
    .replace(
      /(?:\s|\/)*(?:P|p|pietūs|pietus|pietu|pietų|pertrauka)\s*\d{1,3}\s*(?:min)?\s*$/i,
      "",
    )
    .replace(/\s+/g, "");

  const match = withoutBreak.match(
    /^(\d{1,2})(?::?(\d{2}))?[-–](\d{1,2})(?::?(\d{2}))?$/,
  );
  if (!match) {
    return {
      normalized: raw,
      label: raw,
      detail: "Neteisingas laiko formatas",
      kind: "unknown",
      hours: null,
      grossHours: null,
      breakMinutes: 0,
      startMinutes: null,
      endMinutes: null,
      crossesMidnight: false,
    };
  }

  const start = parseTime(`${match[1]}${match[2] ? `:${match[2]}` : ""}`);
  const end = parseTime(`${match[3]}${match[4] ? `:${match[4]}` : ""}`);

  if (
    !start ||
    !end ||
    start.hour > 23 ||
    end.hour > 24 ||
    breakMinutes < 0 ||
    breakMinutes > 240
  ) {
    return {
      normalized: raw,
      label: raw,
      detail: "Neteisingas laiko formatas",
      kind: "unknown",
      hours: null,
      grossHours: null,
      breakMinutes: 0,
      startMinutes: null,
      endMinutes: null,
      crossesMidnight: false,
    };
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
  const endLabel =
    end.hour === 24 ? "24:00" : `${pad2(end.hour)}:${pad2(end.minute)}`;
  const night =
    crossesMidnight || start.hour >= 20 || end.hour <= 6 || end.hour === 24;
  const normalizedBase = `${startLabel}-${endLabel}`;
  const normalized = breakMinutes
    ? `${normalizedBase} P${breakMinutes}`
    : normalizedBase;

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

function classifyPlannedShift(
  parsed: ParsedShift,
  allowTwentyFourHourDuty: boolean,
) {
  const isWork = parsed.kind === "work" || parsed.kind === "night";
  const gross = parsed.grossHours ?? 0;

  if (!isWork || parsed.grossHours === null) {
    return {
      type: "none",
      title: "",
      detail: "",
      isViolation: false,
      isWarning: false,
    };
  }

  if (gross === 24 && allowTwentyFourHourDuty) {
    return {
      type: "duty24",
      title: "24 val. budėjimas",
      detail:
        "Leidžiamas darbuotojui. Poilsio ir 7 dienų valandų ribos tikrinamos atskirai.",
      isViolation: false,
      isWarning: false,
    };
  }

  if (gross === 24 && !allowTwentyFourHourDuty) {
    return {
      type: "duty24-not-allowed",
      title: "24 val. budėjimas neleidžiamas",
      detail:
        "Darbuotojui nėra pažymėta, kad galima planuoti 24 val. budėjimus.",
      isViolation: true,
      isWarning: false,
    };
  }

  if (gross > 12) {
    return {
      type: parsed.crossesMidnight ? "overnight-too-long" : "too-long",
      title: parsed.crossesMidnight
        ? "Per ilga naktinė pamaina"
        : "Pamaina viršija 12 val. ribą",
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

  return {
    type: "regular",
    title: "Įprasta pamaina",
    detail: `Pamaina trunka ${formatHours(gross)} val.`,
    isViolation: false,
    isWarning: false,
  };
}

function stripBreakFromValue(value: string) {
  return cleanText(value)
    .replace(
      /(?:\s|\/)*(?:P|p|pietūs|pietus|pietu|pietų|pertrauka)\s*\d{1,3}\s*(?:min)?\s*$/i,
      "",
    )
    .trim();
}

function hasExplicitBreak(value: string) {
  return /(?:^|\s|\/)(?:P|PIETŪS|PIETUS|PIETU|PIETŲ|PERTRAUKA)\s*\d{1,3}\s*(?:MIN)?$/i.test(
    cleanText(value),
  );
}

function withDefaultBreak(value: string, defaultBreakMinutes: number) {
  const clean = cleanText(value);

  if (!clean || defaultBreakMinutes <= 0 || hasExplicitBreak(clean))
    return clean;

  const parsed = parseShiftValue(clean);

  if (!(parsed.kind === "work" || parsed.kind === "night")) return clean;
  if (parsed.breakMinutes > 0) return parsed.normalized;

  return `${parsed.normalized} P${defaultBreakMinutes}`;
}

function parseShiftWithDefaultBreak(
  value: string,
  defaultBreakMinutes: number,
) {
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

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const EXPORT_STYLE = `
  @page { size: A4 landscape; margin: 5mm; mso-page-orientation: landscape; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #17352f; background: #ffffff; margin: 0; zoom: 0.78; }
  table { border-collapse: collapse; table-layout: fixed; border-spacing: 0; }
  th, td { border: 1.5px solid #89a89d; padding: 0; font-size: 10px; vertical-align: middle; mso-number-format: "\\@"; }
  .schedule-table th, .schedule-table td { border-color: #89a89d; }
  th { background: #dbe8e2; font-weight: 800; text-align: center; color: #17352f; }
  .schedule-table { width: auto; }
  .issues-table { margin-top: 18px; width: 100%; table-layout: auto; }
  .legend { margin-top: 12px; table-layout: auto; }
  .title { background: #486b5d; color: #fff; font-size: 18px; font-weight: 800; text-align: left; padding: 8px 10px; }
  .subtitle { background: #eef5f1; color: #486b5d; font-weight: 700; text-align: left; padding: 7px 10px; }
  .section-title { background: #cfe0d8; color: #17352f; font-size: 14px; font-weight: 800; text-align: left; padding: 8px 10px; }
  .employee-head { width: 132px; min-width: 132px; padding: 5px 4px; }
  .role-head { width: 105px; min-width: 105px; padding: 5px 4px; }
  .small-head { width: 52px; padding: 5px 3px; }
  .norm-head { width: 72px; padding: 5px 3px; }
  .day-head { width: 36px; min-width: 36px; height: 38px; padding: 0; border-left: 2px solid #6f978b; border-right: 1.25px solid #89a89d; border-top: 1.25px solid #89a89d; border-bottom: 1.25px solid #89a89d; }
  .day-head .day-number { display: block; font-size: 13px; line-height: 15px; font-weight: 900; color: #16342d; }
  .day-head .weekday { display: block; margin-top: 1px; font-size: 9px; line-height: 10px; font-weight: 800; color: #5d6f68; text-transform: lowercase; }
  .employee { background: #f8faf9; font-weight: 800; white-space: nowrap; padding: 5px 5px; width: 132px; }
  .role-cell { background: #fbfcfb; color: #51645e; padding: 5px 5px; width: 105px; }
  .meta { background: #fbfcfb; color: #51645e; padding: 5px 4px; }
  .center { text-align: center; }
  .shift-cell { width: 36px; min-width: 36px; height: 38px; text-align: center; border-left: 2px solid #6f978b; border-right: 1.25px solid #89a89d; border-top: 1.25px solid #89a89d; border-bottom: 1.25px solid #89a89d; padding: 1px; mso-number-format: "\@"; }
  .shift-empty { background: #f7fbf9; color: #9aaaa3; }
  .weekend { background: #fbf0ec; }
  .holiday { background: #fbf2d9; }
  .weekday-bg { background: #f7fbf9; }
  .excel-text { mso-number-format: "\\@"; white-space: nowrap; }
  .shiftbox { display: block; min-height: 24px; border-radius: 5px; border: 1.5px solid transparent; padding: 2px 1px; line-height: 10px; font-size: 10px; font-weight: 900; text-align: center; mso-number-format: "\@"; white-space: nowrap; }
  .shiftbox small { display: block; margin-top: 1px; font-size: 8px; line-height: 9px; font-weight: 800; }
  .work .shiftbox { background: #f5c94b; border-color: #df9f1b; color: #3f3108; }
  .night .shiftbox { background: #76629a; border-color: #5c4a7d; color: #ffffff; }
  .duty .shiftbox { background: #6a558c; border-color: #4e3e69; color: #ffffff; }
  .off .shiftbox { background: #b8e0c8; border-color: #8bc7a2; color: #234132; }
  .vacation .shiftbox { background: #f4b6b6; border-color: #de8f8f; color: #7f1d1d; }
  .sick .shiftbox { background: #9bb7f5; border-color: #7395dc; color: #1e3a8a; }
  .reserved .shiftbox { background: #edf0ef; border-color: #cfd8d4; color: #43534c; }
  .total { background: #eef4f1; font-weight: 800; text-align: center; white-space: nowrap; padding: 7px 6px; }
  .bad { background: #fff1f0; color: #8a2f27; font-weight: 800; padding: 6px 7px; }
  .warn { background: #fff8df; color: #8a5a13; font-weight: 800; padding: 6px 7px; }
  .ok { background: #eef7f1; color: #166534; font-weight: 800; padding: 6px 7px; }
  .issues-table th, .issues-table td { padding: 6px 7px; font-size: 11px; }
  .legend td { padding: 6px 8px; font-size: 11px; }
  .legend-sample { width: 52px; height: 28px; text-align: center; font-weight: 900; border-radius: 6px; }
  .coverage-cell { background: #e7f0eb; color: #6b8178; font-weight: 900; text-align: center; border: 2px solid #8fb0a5; }
  .small-day { width: 28px; min-width: 28px; border-left: 2px solid #6f978b !important; border-right: 1.5px solid #89a89d !important; }
  .timesheet-cell { width: 28px; min-width: 28px; height: 25px; text-align: center; font-weight: 900; border-left: 2px solid #6f978b; border-right: 1.25px solid #89a89d; border-top: 1.25px solid #89a89d; border-bottom: 1.25px solid #89a89d; padding: 1px; mso-number-format: "\@"; }
  .shortLeave, .shortLeave .shiftbox { display: block; min-height: 24px; border-radius: 5px; border: 1.5px solid transparent; padding: 2px 1px; line-height: 10px; font-size: 10px; font-weight: 900; text-align: center; mso-number-format: "\@"; white-space: nowrap; }
  .legend-label { background: #eef5f1; font-weight: 900; padding: 6px 8px; }
  @media print {
    body { zoom: 0.48; }
    .schedule-table { page-break-inside: avoid; }
    .legend { page-break-inside: avoid; }
  }
`;

function buildExportDocument(html: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>${EXPORT_STYLE}</style>
</head>
<body>${html}</body>
</html>`;
}

function exportCellText(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (!text) return "";
  // Zero-width space + text CSS neleidžia Excel paversti 7-19 į Jul-19 / Aug-17.
  return `<span class="excel-text">&#8203;${escapeHtml(text)}</span>`;
}

function downloadExcelHtml(filename: string, html: string) {
  const excelDocument = buildExportDocument(html);
  const blob = new Blob(["\ufeff" + excelDocument], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openPrintPdf(title: string, html: string) {
  const printWindow = window.open("", "_blank", "width=1400,height=900");
  if (!printWindow) return false;

  const documentHtml = buildExportDocument(html);
  printWindow.document.open();
  printWindow.document.write(documentHtml);
  printWindow.document.close();
  printWindow.document.title = title;
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 650);

  return true;
}

function emptySettings(): TemplateSettings {
  return {
    templates: {},
    patterns: {},
    allowTwentyFourHourDuty: {},
    defaultBreakMinutes: 30,
  };
}

type ScheduleSaveMode = "draft" | "published";

function timeFromMinutesForDb(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return null;
  return normalizeTime(value);
}

function nextDateKey(date: Date) {
  const next = new Date(date);
  next.setDate(date.getDate() + 1);
  return dayKey(next);
}

function isOvernightOrDutyShift(parsed: ParsedShift) {
  return Boolean(
    (parsed.kind === "work" || parsed.kind === "night") &&
    parsed.startMinutes !== null &&
    parsed.endMinutes !== null &&
    parsed.grossHours !== null &&
    (parsed.crossesMidnight ||
      parsed.grossHours >= 24 ||
      parsed.endMinutes >= 1440 ||
      parsed.endMinutes <= parsed.startMinutes),
  );
}

function splitShiftForDb(parsed: ParsedShift, shiftDate: string) {
  const baseType = shiftTypeForDb(parsed);
  const isOvernight = isOvernightOrDutyShift(parsed);

  if (!isOvernight) {
    return [
      {
        shift_date: shiftDate,
        start_time: timeFromMinutesForDb(parsed.startMinutes),
        end_time: timeFromMinutesForDb(parsed.endMinutes),
        shift_type: baseType,
        notes: parsed.detail || null,
      },
    ];
  }

  const start = timeFromMinutesForDb(parsed.startMinutes) || "00:00";
  const end = timeFromMinutesForDb(parsed.endMinutes) || start;
  const nextDate = nextDateKey(new Date(`${shiftDate}T00:00:00`));

  return [
    {
      shift_date: shiftDate,
      start_time: start,
      end_time: "23:59",
      shift_type: "night",
      notes: `Paros / naktinės pamainos pradžia · ${start}–24:00 · split_parent=${shiftDate}`,
    },
    {
      shift_date: nextDate,
      start_time: "00:00",
      end_time: end,
      shift_type: "night",
      notes: `Paros / naktinės pamainos tęsinys · 00:00–${end} · split_parent=${shiftDate}`,
    },
  ];
}

function shiftTypeForDb(parsed: ParsedShift) {
  if (parsed.kind === "work" || parsed.kind === "night")
    return parsed.kind === "night" ? "night" : "day";
  if (parsed.kind === "off") return "off";
  if (parsed.kind === "vacation") return parsed.normalized || "vacation";
  if (parsed.kind === "sick") return "sick";
  if (parsed.kind === "reserved") return "reserved";
  return parsed.normalized || "unknown";
}

function reservationStatusKey(value?: string | null) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[ą]/g, "a")
    .replace(/[č]/g, "c")
    .replace(/[ęė]/g, "e")
    .replace(/[į]/g, "i")
    .replace(/[š]/g, "s")
    .replace(/[ųū]/g, "u")
    .replace(/[ž]/g, "z");
}

function isApprovedReservation(reservation: VacationReservation) {
  const status = reservationStatusKey(reservation.status);
  return [
    "approved",
    "accepted",
    "confirmed",
    "published",
    "patvirtinta",
    "patvirtintas",
    "patvirtinti",
    "tvirtinta",
    "galioja",
  ].some((item) => status.includes(item));
}

function isPendingReservation(reservation: VacationReservation) {
  const status = reservationStatusKey(reservation.status);
  if (isApprovedReservation(reservation)) return false;
  return (
    !status ||
    [
      "pending",
      "submitted",
      "waiting",
      "requested",
      "laukiama",
      "pateikta",
      "prasymas",
      "rezervacija",
    ].some((item) => status.includes(item))
  );
}

function reservationScheduleValue(reservation: VacationReservation) {
  const rawCode = cleanText(reservation.code || reservation.type).toUpperCase();
  const rawType = reservationStatusKey(
    `${reservation.type} ${reservation.label}`,
  );

  if (isPendingReservation(reservation)) return "R";
  if (rawCode) {
    if (["ATOSTOGOS", "KASMETINES", "KASMETINĖS", "VACATION"].includes(rawCode))
      return "A";
    if (["MAMADIENIS", "MAMADIENIAI"].includes(rawCode)) return "M";
    if (
      ["TEVADIENIS", "TĖVADIENIS", "TEVADIENIAI", "TĖVADIENIAI"].includes(
        rawCode,
      )
    )
      return "T";
    if (["NEDARBINGUMAS", "SICK", "LIGA"].includes(rawCode)) return "L";
    return rawCode;
  }

  if (rawType.includes("mam")) return "M";
  if (rawType.includes("tev") || rawType.includes("tevadien")) return "T";
  if (rawType.includes("nemok") || rawType.includes("neapmok")) return "NA";
  if (rawType.includes("lig") || rawType.includes("nedarbing")) return "L";
  return "A";
}

function applyReservationsToGridRows(
  rows: unknown[][],
  employees: Employee[],
  scheduleDays: Date[],
  vacationReservations: VacationReservation[],
) {
  if (!vacationReservations.length) return rows;

  const employeeIndex = new Map(
    employees.map((employee, index) => [employee.user_id, index]),
  );
  const dateIndex = new Map(
    scheduleDays.map((date, index) => [dayKey(date), index + 1]),
  );
  const next = rows.map((row) => [...row]);

  vacationReservations.forEach((reservation) => {
    const rowIndex = employeeIndex.get(reservation.employee_id);
    const colIndex = dateIndex.get(reservation.date);
    if (rowIndex === undefined || colIndex === undefined) return;

    const value = reservationScheduleValue(reservation);
    if (!value) return;

    const current = cleanText(String(next[rowIndex]?.[colIndex] || ""));
    const currentParsed = parseShiftValue(current);

    if (!next[rowIndex]) next[rowIndex] = [employees[rowIndex]?.user_id || ""];

    // Patvirtinti neatvykimai turi laimėti prieš suplanuotą pamainą,
    // nes darbuotojo profilyje ir grafike turi matytis realus neatvykimas.
    if (isApprovedReservation(reservation)) {
      next[rowIndex][colIndex] = value;
      return;
    }

    // Laukiantys prašymai tik rezervuoja tuščią langelį ir neperrašo darbo.
    if (!current || currentParsed.kind === "empty") {
      next[rowIndex][colIndex] = value;
    }
  });

  return next;
}

export default function ScheduleBlock({
  employees,
  schedule,
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
  const [grid, setGrid] = useState<unknown[][]>(() =>
    scheduleGridData.map((row) => [...row]),
  );
  const [pendingChanges, setPendingChanges] = useState<GridChange[]>([]);
  const [activeCell, setActiveCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
    draft: string;
    oldValue: string;
  } | null>(null);
  const [clipboardValue, setClipboardValue] = useState("");
  const [message, setMessage] = useState("");
  const [localSaving, setLocalSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "errors" | "warnings" | "training" | "reservations"
  >("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showLargeGrid, setShowLargeGrid] = useState(false);
  const [toolPanel, setToolPanel] = useState<
    null | "templates" | "pattern" | "bulk"
  >(null);
  const [inspectorPanel, setInspectorPanel] = useState<
    null | "issues" | "summary" | "history" | "training"
  >(null);
  const [scheduleView, setScheduleView] = useState<"month" | "week">("month");
  const [weekStartIndex, setWeekStartIndex] = useState(0);
  const [history, setHistory] = useState<
    Array<{ id: string; label: string; at: string; changes: GridChange[] }>
  >([]);
  const [undoStack, setUndoStack] = useState<
    Array<{ id: string; label: string; at: string; changes: GridChange[] }>
  >([]);
  const [settings, setSettings] = useState<TemplateSettings>(() =>
    emptySettings(),
  );
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [templateEmployeeId, setTemplateEmployeeId] = useState("");
  const [templateDraft, setTemplateDraft] = useState("08-17");
  const [activePatternDay, setActivePatternDay] = useState<number | null>(null);
  const [clearEmployeeId, setClearEmployeeId] = useState("all");
  const [clearFrom, setClearFrom] = useState(() =>
    scheduleDays[0] ? dayKey(scheduleDays[0]) : "",
  );
  const [clearTo, setClearTo] = useState(() =>
    scheduleDays.length ? dayKey(scheduleDays[scheduleDays.length - 1]) : "",
  );
  const [dragCopy, setDragCopy] = useState<null | {
    value: string;
    cells: Array<{ row: number; col: number; oldValue: string }>;
  }>(null);
  const dragRef = useRef(dragCopy);
  const gridCacheKey = useMemo(() => {
    const first = scheduleDays[0] ? dayKey(scheduleDays[0]) : "unknown";
    const last = scheduleDays.length
      ? dayKey(scheduleDays[scheduleDays.length - 1])
      : "unknown";
    return `${STORAGE_KEY}.grid.${first}.${last}`;
  }, [scheduleDays]);

  const employeesSignature = useMemo(
    () => employees.map((employee) => employee.user_id).join("|"),
    [employees],
  );
  const scheduleDaysSignature = useMemo(
    () => scheduleDays.map((date) => dayKey(date)).join("|"),
    [scheduleDays],
  );
  const scheduleGridSignature = useMemo(
    () => JSON.stringify(scheduleGridData),
    [scheduleGridData],
  );
  const vacationReservationSignature = useMemo(
    () =>
      vacationReservations
        .map((reservation) =>
          [
            reservation.employee_id,
            reservation.date,
            reservation.status,
            reservation.code,
            reservation.type,
            reservation.label,
          ].join("::"),
        )
        .join("||"),
    [vacationReservations],
  );

  useEffect(() => {
    dragRef.current = dragCopy;
  }, [dragCopy]);

  useEffect(() => {
    if (pendingChanges.length !== 0) return;

    const incoming = scheduleGridData.map((row) => [...row]);

    const normalizedIncoming = applyReservationsToGridRows(
      employees.map((employee, rowIndex) => {
        const source = incoming[rowIndex] || [];
        const row = Array.from(
          { length: scheduleDays.length + 1 },
          (_, index) => {
            if (index === 0) return source[0] || employee.user_id;
            return source[index] || "";
          },
        );
        return row;
      }),
      employees,
      scheduleDays,
      vacationReservations,
    );

    // Svarbu: po saugojimo tėvinis komponentas kartais dar grąžina seną
    // scheduleGridData. Todėl lokaliai išsaugotą grafiko kopiją ne ignoruojame,
    // o uždedame ant naujai atėjusio grid'o. Taip pakeitimai nepradingsta
    // po mėnesio perjungimo, refresh ar kol Supabase query dar negrąžina naujų eilučių.
    try {
      const cached = window.localStorage.getItem(gridCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as
          | {
              version?: number;
              byEmployee?: Record<string, Record<string, string>>;
            }
          | unknown[][];

        if (!Array.isArray(parsed) && parsed?.byEmployee) {
          const restored = normalizedIncoming.map((row) => [...row]);
          employees.forEach((employee, rowIndex) => {
            if (!restored[rowIndex]) restored[rowIndex] = [employee.user_id];
            scheduleDays.forEach((date, dayIndex) => {
              const cachedValue =
                parsed.byEmployee?.[employee.user_id]?.[dayKey(date)];
              if (cachedValue !== undefined)
                restored[rowIndex][dayIndex + 1] = cachedValue;
            });
          });

          setGrid(
            applyReservationsToGridRows(
              restored,
              employees,
              scheduleDays,
              vacationReservations,
            ),
          );
          return;
        }

        // Senas lokalus cache buvo saugomas pagal eilutės indeksą.
        if (Array.isArray(parsed) && parsed.length === employees.length) {
          const restored = normalizedIncoming.map((row) => [...row]);
          employees.forEach((employee, rowIndex) => {
            const source = parsed[rowIndex] || [];
            if (!restored[rowIndex]) restored[rowIndex] = [employee.user_id];
            scheduleDays.forEach((_, dayIndex) => {
              const cachedValue = source[dayIndex + 1];
              if (cachedValue !== undefined)
                restored[rowIndex][dayIndex + 1] = cachedValue;
            });
          });

          setGrid(
            applyReservationsToGridRows(
              restored,
              employees,
              scheduleDays,
              vacationReservations,
            ),
          );
          return;
        }
      }
    } catch {}

    setGrid(normalizedIncoming);
    // Svarbu: dependency array turi būti pastovaus dydžio.
    // Nenaudojame ...employees ar ...scheduleDays, nes React meta klaidą,
    // kai darbuotojų / dienų kiekis pasikeičia tarp renderių.
  }, [
    scheduleGridSignature,
    pendingChanges.length,
    gridCacheKey,
    employeesSignature,
    scheduleDaysSignature,
    vacationReservationSignature,
  ]);

  useEffect(() => {
    if (!templateEmployeeId && employees[0]?.user_id)
      setTemplateEmployeeId(employees[0].user_id);
  }, [employees, templateEmployeeId]);

  useEffect(() => {
    setClearFrom(scheduleDays[0] ? dayKey(scheduleDays[0]) : "");
    setClearTo(
      scheduleDays.length ? dayKey(scheduleDays[scheduleDays.length - 1]) : "",
    );
  }, [scheduleDays]);

  useEffect(() => {
    setWeekStartIndex(0);
  }, [scheduleDays]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = {
          ...emptySettings(),
          ...JSON.parse(stored),
        } as TemplateSettings;

        Object.keys(parsed.templates || {}).forEach((employeeId) => {
          parsed.templates[employeeId] = (
            parsed.templates[employeeId] || []
          ).map(stripBreakFromValue);
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
    setSettingsHydrated(true);
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings, settingsHydrated]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!activeCell || editingCell) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        return;
      const key = event.key.toLowerCase();
      const shortcutMap: Record<string, string> = {
        d: "08-17",
        n: "19-07",
        p: "P",
        a: "A",
        l: "L",
      };
      const value = shortcutMap[key];
      if (!value) return;
      event.preventDefault();
      quickSet(value);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCell, editingCell, settings.defaultBreakMinutes, grid]);

  const getName = (employee?: Employee | null) => {
    if (!employee) return "Vardas nenurodytas";
    const fromProp = cleanPersonName(employeeName(employee));
    if (fromProp !== "Vardas nenurodytas") return fromProp;
    const full = cleanPersonName(employee.full_name);
    if (full !== "Vardas nenurodytas") return full;
    const joined = cleanPersonName(
      `${employee.first_name || ""} ${employee.last_name || ""}`,
    );
    if (joined !== "Vardas nenurodytas") return joined;
    const emailName = cleanPersonName(nameFromEmail(employee.email));
    return emailName !== "Vardas nenurodytas"
      ? emailName
      : "Vardas nenurodytas";
  };

  const getRole = (employee?: Employee | null) => {
    if (!employee) return "Pareigybė nenurodyta";
    const preferred = cleanRoleLabel(
      employee.position ||
        employee.legacy_role ||
        employee.role ||
        employee.staff_type ||
        employee.department,
    );
    if (preferred !== "Pareigybė nenurodyta") return preferred;
    const fromProp = cleanRoleLabel(employeeRole(employee));
    return fromProp;
  };

  const reservationMap = useMemo(() => {
    const map = new Map<string, VacationReservation>();
    vacationReservations.forEach((reservation) =>
      map.set(`${reservation.employee_id}__${reservation.date}`, reservation),
    );
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
    const missingHours = Number(
      row?.missingHours ?? employee.training_missing_hours ?? 0,
    );
    const expiredCount = Number(
      row?.expiredCount ?? employee.training_expired_count ?? 0,
    );
    const expiresSoonCount = Number(
      row?.expiresSoonCount ?? employee.training_expires_soon_count ?? 0,
    );
    const blocking = Boolean(
      row?.blocking ||
      missingHours > 0 ||
      expiredCount > 0 ||
      /neatitinka|trūksta|pasibaig/i.test(status),
    );
    const warning =
      !blocking &&
      Boolean(expiresSoonCount > 0 || /rizika|baigiasi/i.test(status));
    return {
      status,
      missingHours,
      expiredCount,
      expiresSoonCount,
      blocking,
      warning,
      row,
    };
  };

  const getValue = (row: number, col: number) => String(grid[row]?.[col] || "");

  const getVisualShiftForCell = (row: number, dayIndex: number) => {
    const rawValue = getValue(row, dayIndex + 1);
    const parsed = parseShiftValue(rawValue);

    if (
      parsed.normalized &&
      (parsed.kind === "work" || parsed.kind === "night")
    ) {
      if (isOvernightOrDutyShift(parsed)) {
        const startLabel =
          parsed.startMinutes !== null
            ? normalizeTime(parsed.startMinutes)
            : parsed.label.split("-")[0] || "";
        return {
          rawValue,
          parsed,
          displayLabel: `${startLabel}-24:00`,
          isSplitStart: true,
          isSplitContinuation: false,
          sourceCol: dayIndex + 1,
        };
      }

      return {
        rawValue,
        parsed,
        displayLabel: parsed.label,
        isSplitStart: false,
        isSplitContinuation: false,
        sourceCol: dayIndex + 1,
      };
    }

    if (!parsed.normalized && dayIndex > 0) {
      const previousRaw = getValue(row, dayIndex);
      const previousParsed = parseShiftValue(previousRaw);

      if (isOvernightOrDutyShift(previousParsed)) {
        const endLabel =
          previousParsed.endMinutes !== null
            ? normalizeTime(previousParsed.endMinutes)
            : previousParsed.label.split("-")[1] || "";
        const continuationValue = `00:00-${endLabel}`;
        return {
          rawValue: previousRaw,
          parsed: parseShiftValue(continuationValue),
          displayLabel: continuationValue,
          isSplitStart: false,
          isSplitContinuation: true,
          sourceCol: dayIndex,
        };
      }
    }

    return {
      rawValue,
      parsed,
      displayLabel: parsed.label,
      isSplitStart: false,
      isSplitContinuation: false,
      sourceCol: dayIndex + 1,
    };
  };

  const activeEmployee = activeCell ? employees[activeCell.row] : null;
  const activeEmployeeId = activeEmployee?.user_id || templateEmployeeId;
  const allowTwentyFourFor = (employee: Employee) =>
    Boolean(
      settings.allowTwentyFourHourDuty[employee.user_id] ||
      /budė|slaug|apsaug/i.test(
        `${employee.role || ""} ${employee.position || ""} ${employee.staff_type || ""}`,
      ),
    );

  const validationByEmployee = useMemo(() => {
    const result = new Map<string, EmployeeValidation>();

    employees.forEach((employee, rowIndex) => {
      const issues: ValidationIssue[] = [];
      const warnings: ValidationIssue[] = [];
      const workShifts: Array<{
        dateIndex: number;
        date: Date;
        startAbs: number;
        endAbs: number;
        hours: number;
        grossHours: number;
        parsed: ParsedShift;
      }> = [];
      let plannedHours = 0;

      scheduleDays.forEach((date, dayIndex) => {
        const dateText = dayKey(date);
        const parsed = parseShiftValue(getValue(rowIndex, dayIndex + 1));
        const name = getName(employee);
        const reservation = reservationMap.get(
          `${employee.user_id}__${dateText}`,
        );

        if (parsed.kind === "unknown") {
          issues.push({
            id: `${employee.user_id}-${dateText}-format`,
            employeeId: employee.user_id,
            employeeName: name,
            date: dateText,
            severity: "error",
            type: "format",
            title: "Neteisingas laiko formatas",
            detail: `${date.getDate()} d. įrašas neatpažintas. Tinka: 08:00-17:00, 8-17, 08-17 P30, P, A, NA, M, T, L.`,
          });
        }

        if (
          (parsed.kind === "work" || parsed.kind === "night") &&
          parsed.hours !== null &&
          parsed.grossHours !== null
        ) {
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
              detail:
                training.missingHours > 0
                  ? `Darbuotojo negalima planuoti darbui: trūksta ${formatHours(training.missingHours)} mokymų val.`
                  : "Darbuotojo negalima planuoti darbui: mokymai neatitinka reikalavimų.",
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
              detail:
                training.expiresSoonCount > 0
                  ? `Artėja ${training.expiresSoonCount} mokymų terminas.`
                  : "Yra mokymų termino rizika.",
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

          const shiftClassification = classifyPlannedShift(
            parsed,
            allowTwentyFourFor(employee),
          );
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
        shortestRestHours =
          shortestRestHours === null ? rest : Math.min(shortestRestHours, rest);
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
      const monthlyContractHours = getMonthlyContractHours(
        scheduleDays,
        employee,
      );
      const monthlyBalanceHours = plannedHours - monthlyContractHours;
      const monthlyBalancePercent =
        monthlyContractHours > 0
          ? (plannedHours / monthlyContractHours) * 100
          : 0;

      let maxSevenDayHours = 0;
      let maxSevenDayWorkDays = 0;
      for (let start = 0; start < scheduleDays.length; start += 1) {
        const end = start + 6;
        const shiftsInWindow = workShifts.filter(
          (shift) => shift.dateIndex >= start && shift.dateIndex <= end,
        );
        const hours = shiftsInWindow.reduce(
          (sum, shift) => sum + shift.hours,
          0,
        );
        const days = new Set(shiftsInWindow.map((shift) => shift.dateIndex))
          .size;
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
      } else if (
        monthlyContractHours > 0 &&
        plannedHours < monthlyContractHours - 8
      ) {
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

      const external = scheduleComplianceRows.find(
        (row) => row.employee.user_id === employee.user_id,
      );
      external?.errors?.forEach((text, index) => {
        issues.push({
          id: `${employee.user_id}-external-error-${index}`,
          employeeId: employee.user_id,
          employeeName: getName(employee),
          severity: "error",
          type: /mokym/i.test(text)
            ? "training"
            : /poils/i.test(text)
              ? "rest"
              : /norm|val/i.test(text)
                ? "weekly-hours"
                : "format",
          title: /mokym/i.test(text)
            ? "Mokymų neatitiktis"
            : /poils/i.test(text)
              ? "Poilsio pažeidimas"
              : /norm|val/i.test(text)
                ? "Viršyta norma"
                : "Neatitikimas",
          detail: text,
        });
      });
      external?.warnings?.forEach((text, index) => {
        warnings.push({
          id: `${employee.user_id}-external-warning-${index}`,
          employeeId: employee.user_id,
          employeeName: getName(employee),
          severity: "warning",
          type: /mokym/i.test(text)
            ? "training"
            : /poils/i.test(text)
              ? "rest"
              : /norm|val/i.test(text)
                ? "weekly-hours"
                : "format",
          title: /mokym/i.test(text)
            ? "Mokymų termino rizika"
            : /poils/i.test(text)
              ? "Poilsio rizika"
              : /norm|val/i.test(text)
                ? "Valandų rizika"
                : "Įspėjimas",
          detail: text,
        });
      });

      const uniqueIssues = Array.from(
        new Map(issues.map((issue) => [issue.id, issue])).values(),
      );
      const uniqueWarnings = Array.from(
        new Map(warnings.map((issue) => [issue.id, issue])).values(),
      ).filter(
        (warning) => !uniqueIssues.some((issue) => issue.id === warning.id),
      );
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
        statusLabel: uniqueIssues.length
          ? first.title
          : uniqueWarnings.length
            ? first.title
            : "Be neatitikimų",
        statusClass: uniqueIssues.length
          ? "bad"
          : uniqueWarnings.length
            ? "warn"
            : "ok",
      });
    });

    return result;
  }, [
    employees,
    grid,
    reservationMap,
    scheduleComplianceRows,
    scheduleDays,
    settings.allowTwentyFourHourDuty,
    trainingMap,
  ]);

  const allValidations = useMemo(
    () =>
      employees
        .map((employee) => validationByEmployee.get(employee.user_id))
        .filter(Boolean) as EmployeeValidation[],
    [employees, validationByEmployee],
  );
  const allIssues = useMemo(
    () => allValidations.flatMap((row) => [...row.issues, ...row.warnings]),
    [allValidations],
  );
  const trainingIssues = useMemo(
    () => allIssues.filter((issue) => issue.type === "training"),
    [allIssues],
  );
  const errorCount = allIssues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const warningCount = allIssues.filter(
    (issue) => issue.severity === "warning",
  ).length;
  const trainingIssueCount = trainingIssues.length;
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

    return employees.filter(
      (employee) => cleanText(employee.department) === departmentFilter,
    );
  }, [employees, departmentFilter]);

  const filteredEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    const source = employeesByDepartment.filter((employee) => {
      if (!search) return true;
      return [
        getName(employee),
        getRole(employee),
        employee.email,
        employee.department,
        employee.position,
        employee.staff_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });

    if (filter === "all") return source;
    if (filter === "reservations")
      return source.filter((employee) =>
        vacationReservations.some(
          (reservation) => reservation.employee_id === employee.user_id,
        ),
      );
    return source.filter((employee) => {
      const validation = validationByEmployee.get(employee.user_id);
      if (!validation) return false;
      if (filter === "errors") return validation.issues.length > 0;
      if (filter === "warnings")
        return validation.warnings.length > 0 && validation.issues.length === 0;
      if (filter === "training")
        return [...validation.issues, ...validation.warnings].some(
          (issue) => issue.type === "training",
        );
      return true;
    });
  }, [
    employeesByDepartment,
    employeeSearch,
    filter,
    vacationReservations,
    validationByEmployee,
  ]);

  const visibleScheduleDays = useMemo(() => {
    if (scheduleView === "month") return scheduleDays;

    return scheduleDays.slice(weekStartIndex, weekStartIndex + 7);
  }, [scheduleDays, scheduleView, weekStartIndex]);

  const visibleDayIndexes = useMemo(() => {
    return visibleScheduleDays.map((date) =>
      scheduleDays.findIndex((item) => dayKey(item) === dayKey(date)),
    );
  }, [scheduleDays, visibleScheduleDays]);

  const weekLabel = useMemo(() => {
    if (scheduleView !== "week" || visibleScheduleDays.length === 0) return "";

    const first = visibleScheduleDays[0];
    const last = visibleScheduleDays[visibleScheduleDays.length - 1];

    return `${dayKey(first)} – ${dayKey(last)}`;
  }, [scheduleView, visibleScheduleDays]);

  const canGoPreviousWeek = scheduleView === "week" && weekStartIndex > 0;
  const canGoNextWeek =
    scheduleView === "week" && weekStartIndex + 7 < scheduleDays.length;

  const showPreviousWeek = () => {
    setWeekStartIndex((previous) => Math.max(0, previous - 7));
  };

  const showNextWeek = () => {
    setWeekStartIndex((previous) =>
      Math.min(Math.max(0, scheduleDays.length - 7), previous + 7),
    );
  };

  const gridTemplateColumns = useMemo(() => {
    if (scheduleView === "week")
      return `190px repeat(${visibleScheduleDays.length}, 112px) 120px`;

    return `175px repeat(${visibleScheduleDays.length}, 39px) 92px`;
  }, [scheduleView, visibleScheduleDays.length]);

  const recordHistory = (label: string, changes: GridChange[]) => {
    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      label,
      at: new Date().toLocaleString("lt-LT"),
      changes,
    };
    setHistory((prev) => [item, ...prev].slice(0, 80));
    setUndoStack((prev) => [item, ...prev].slice(0, 30));
  };

  const applyChangesToGrid = (
    changes: GridChange[],
    direction: "next" | "previous",
  ) => {
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      changes.forEach(([row, col, oldValue, newValue]) => {
        if (!next[row]) next[row] = [];
        next[row][col] = direction === "next" ? newValue : oldValue;
      });
      return next;
    });
  };

  const queueChanges = (
    changes: GridChange[],
    label: string,
    successMessage: string,
  ) => {
    const realChanges = changes.filter(
      ([, , oldValue, newValue]) =>
        parseShiftValue(oldValue).normalized !==
        parseShiftValue(newValue).normalized,
    );
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
          if (
            parseShiftValue(originalOld).normalized ===
            parseShiftValue(newValue).normalized
          )
            next.splice(index, 1);
          else next[index] = [row, col, originalOld, newValue];
        } else next.push([row, col, oldValue, newValue]);
      });
      return next;
    });
    setMessage(successMessage);
  };

  const commitCell = (
    row: number,
    col: number,
    oldValue: string,
    rawValue: string,
  ) => {
    const parsed = parseShiftWithDefaultBreak(
      rawValue,
      settings.defaultBreakMinutes,
    );
    const newValue = parsed.normalized;
    const employee = employees[row];
    const training = employee ? getTrainingStatus(employee) : null;

    if (
      employee &&
      (parsed.kind === "work" || parsed.kind === "night") &&
      training?.blocking
    ) {
      setMessage(
        `${getName(employee)} negali būti planuojamas darbui: mokymų neatitiktis.`,
      );
      setEditingCell(null);
      return;
    }

    setEditingCell(null);
    queueChanges(
      [[row, col, oldValue, newValue]],
      `${getName(employee)} · ${scheduleDays[col - 1]?.getDate()} d.: ${oldValue || "tuščia"} → ${newValue || "tuščia"}`,
      newValue ? `Įrašyta: ${newValue}` : "Langelis išvalytas",
    );
  };

  const getReservationSyncChanges = () => {
    const changes: GridChange[] = [];

    vacationReservations.forEach((reservation) => {
      if (
        !isApprovedReservation(reservation) &&
        !isPendingReservation(reservation)
      )
        return;
      const row = employees.findIndex(
        (employee) => employee.user_id === reservation.employee_id,
      );
      const dayIndex = scheduleDays.findIndex(
        (date) => dayKey(date) === reservation.date,
      );
      if (row < 0 || dayIndex < 0) return;

      const col = dayIndex + 1;
      const oldValue = getValue(row, col);
      const newValue = reservationScheduleValue(reservation);
      if (!newValue) return;

      if (
        parseShiftValue(oldValue).normalized !==
        parseShiftValue(newValue).normalized
      ) {
        changes.push([row, col, oldValue, newValue]);
      }
    });

    return changes;
  };

  const saveScheduleChanges = async (mode: ScheduleSaveMode) => {
    const publish = mode === "published";
    const reservationSyncChanges = getReservationSyncChanges();
    const effectiveChanges = pendingChanges.length
      ? [...pendingChanges, ...reservationSyncChanges]
      : publish
        ? allCurrentGridChanges
        : reservationSyncChanges;

    if (!effectiveChanges.length) {
      setMessage(
        publish
          ? "Nėra ką paskelbti: grafike nėra suplanuotų pamainų."
          : "Nėra neišsaugotų pakeitimų.",
      );
      return;
    }

    setLocalSaving(true);
    setPublishing(publish);
    setMessage(
      publish
        ? "Skelbiamas grafikas darbuotojams..."
        : "Saugomas grafiko juodraštis...",
    );

    try {
      // Šis komponentas neberašo tiesiai į employee_schedules iš kliento.
      // Svarbu, kad tėvinis komponentas / API atliktų saugojimą serverio pusėje:
      // teisių patikra, transakcija, DK validacijos, atostogų rezervacijų sinchronizacija ir audit log.
      await onSaveGridChanges(effectiveChanges, { status: mode, publish });

      try {
        const snapshot = grid.map((row) => [...row]);
        effectiveChanges.forEach(([row, col, , newValue]) => {
          if (!snapshot[row]) snapshot[row] = [employees[row]?.user_id || ""];
          snapshot[row][col] = newValue;
        });

        const byEmployee: Record<string, Record<string, string>> = {};
        employees.forEach((employee, rowIndex) => {
          scheduleDays.forEach((date, dayIndex) => {
            const value = cleanText(
              String(snapshot[rowIndex]?.[dayIndex + 1] || ""),
            );
            if (!value) return;
            if (!byEmployee[employee.user_id])
              byEmployee[employee.user_id] = {};
            byEmployee[employee.user_id][dayKey(date)] = value;
          });
        });

        window.localStorage.setItem(
          gridCacheKey,
          JSON.stringify({
            version: 2,
            savedAt: new Date().toISOString(),
            employeeIds: employees.map((employee) => employee.user_id),
            byEmployee,
          }),
        );
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch {}

      setPendingChanges([]);
      setMessage(
        publish
          ? "Grafikas paskelbtas. Darbuotojai jį matys savo paskyrose."
          : "Grafikas išsaugotas kaip juodraštis. Darbuotojai jo dar nematys.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Nepavyko išsaugoti grafiko pakeitimų.",
      );
    } finally {
      setLocalSaving(false);
      setPublishing(false);
    }
  };

  // Automatinis juodraščio išsaugojimas.
  // Pakeitimai pirmiausia įrašomi į lokalų grid per queueChanges(),
  // tada po trumpos pauzės išsaugomi taip pat, kaip paspaudus „Išsaugoti juodraštį“.
  useEffect(() => {
    if (pendingChanges.length === 0) return;
    if (localSaving || saving || publishing) return;

    const timer = window.setTimeout(() => {
      void saveScheduleChanges("draft");
    }, 1200);

    return () => window.clearTimeout(timer);
    // Sąmoningai klausomės tik būsenų, kurios turi paleisti autosave.
    // saveScheduleChanges yra komponento funkcija, todėl jos nededame į dependency,
    // kad autosave nepersikurtų be realių pakeitimų.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChanges.length, localSaving, saving, publishing]);

  const undo = () => {
    const item = undoStack[0];
    if (!item) return;
    applyChangesToGrid(item.changes, "previous");
    setPendingChanges((prev) =>
      prev.filter(
        ([row, col]) => !item.changes.some(([r, c]) => r === row && c === col),
      ),
    );
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
    const parsed = parseShiftWithDefaultBreak(
      value,
      settings.defaultBreakMinutes,
    );
    const nextValue =
      parsed.kind === "work" || parsed.kind === "night"
        ? parsed.normalized
        : value;
    commitCell(activeCell.row, activeCell.col, oldValue, nextValue);
  };

  const defaultTemplates = [
    "08:00-17:00",
    "08:00-16:00",
    "07:00-19:00",
    "19:00-07:00",
    "07:00-07:00",
  ];
  const employeeTemplates = activeEmployee
    ? Array.from(
        new Set([
          ...defaultTemplates,
          ...(settings.templates[activeEmployee.user_id] || []).map(
            stripBreakFromValue,
          ),
        ]),
      )
    : defaultTemplates;

  const addTemplate = () => {
    const employee =
      employees.find((item) => item.user_id === templateEmployeeId) ||
      activeEmployee;
    if (!employee) return;
    const parsed = parseShiftWithDefaultBreak(
      templateDraft,
      settings.defaultBreakMinutes,
    );
    if (!(parsed.kind === "work" || parsed.kind === "night")) {
      setMessage(
        "Šablonui įveskite pamainos laiką, pvz. 08-17, 07-19 arba 07:00-07:00. Pertrauka pridedama automatiškai pagal nustatymą.",
      );
      return;
    }
    setSettings((prev) => ({
      ...prev,
      templates: {
        ...prev.templates,
        [employee.user_id]: Array.from(
          new Set([
            stripBreakFromValue(parsed.normalized),
            ...(prev.templates[employee.user_id] || []).map(
              stripBreakFromValue,
            ),
          ]),
        ).slice(0, 12),
      },
    }));
    setTemplateDraft(stripBreakFromValue(parsed.normalized));
    setMessage(
      `${getName(employee)}: pridėtas šablonas ${stripBreakFromValue(parsed.normalized)}. Pertrauka bus pridedama automatiškai.`,
    );
  };

  const removeTemplate = (employeeId: string, template: string) => {
    setSettings((prev) => ({
      ...prev,
      templates: {
        ...prev.templates,
        [employeeId]: (prev.templates[employeeId] || []).filter(
          (item) => item !== template,
        ),
      },
    }));
  };

  const useTemplate = (template: string) => {
    const parsed = parseShiftWithDefaultBreak(
      template,
      settings.defaultBreakMinutes,
    );
    const normalized = parsed.normalized || template;
    const displayValue = stripBreakFromValue(normalized);

    if (activeCell) {
      setActivePatternDay(null);
      const oldValue = getValue(activeCell.row, activeCell.col);
      commitCell(activeCell.row, activeCell.col, oldValue, normalized);
      return;
    }

    if (activePatternDay !== null && selectedPatternEmployee) {
      updatePattern(
        selectedPatternEmployee.user_id,
        activePatternDay,
        displayValue,
      );
      setTemplateDraft(displayValue);
      setMessage(
        `${WEEKDAYS.find((item) => item.day === activePatternDay)?.label || "Diena"}: įrašyta ${displayValue}. Pertrauka bus pridedama automatiškai.`,
      );
      return;
    }

    setMessage("Pasirinkite grafiko langelį arba darbo laiko modelio lauką.");
  };

  const updatePattern = (
    employeeId: string,
    day: number,
    value: string,
    normalize = false,
  ) => {
    const trimmed = value.trim();
    const parsed = parseShiftWithDefaultBreak(
      trimmed,
      settings.defaultBreakMinutes,
    );
    const nextValue = !trimmed
      ? ""
      : normalize && (parsed.kind === "work" || parsed.kind === "night")
        ? stripBreakFromValue(parsed.normalized)
        : value;
    setSettings((prev) => ({
      ...prev,
      patterns: {
        ...prev.patterns,
        [employeeId]: {
          ...(prev.patterns[employeeId] || {}),
          [day]: nextValue,
        },
      },
    }));
  };

  const applyPattern = (mode: "selected" | "all") => {
    const targetEmployees =
      mode === "all"
        ? employees
        : employees.filter(
            (employee) =>
              employee.user_id === templateEmployeeId ||
              employee.user_id === activeEmployee?.user_id,
          );
    const changes: GridChange[] = [];
    targetEmployees.forEach((employee) => {
      const row = employees.findIndex(
        (item) => item.user_id === employee.user_id,
      );
      const pattern = settings.patterns[employee.user_id] || {};
      const training = getTrainingStatus(employee);
      if (training.blocking) return;
      scheduleDays.forEach((date, dayIndex) => {
        const rawPatternValue = pattern[date.getDay()];
        if (!rawPatternValue) return;
        const parsedPattern = parseShiftWithDefaultBreak(
          rawPatternValue,
          settings.defaultBreakMinutes,
        );
        if (!(parsedPattern.kind === "work" || parsedPattern.kind === "night"))
          return;
        const value = parsedPattern.normalized;
        const col = dayIndex + 1;
        const oldValue = getValue(row, col);
        if (oldValue) return;
        const reservation = reservationMap.get(
          `${employee.user_id}__${dayKey(date)}`,
        );
        if (reservation) return;
        changes.push([row, col, oldValue, value]);
      });
    });
    queueChanges(
      changes,
      "Darbo laiko modelio pritaikymas",
      `Užpildyta pagal modelį: ${changes.length}`,
    );
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
        const reservation = reservationMap.get(
          `${employee.user_id}__${dayKey(date)}`,
        );
        if (existing || reservation) return;

        const employeePattern = settings.patterns[employee.user_id] || {};
        const patternValue = employeePattern[date.getDay()];
        const fallbackValue =
          employeePattern[date.getDay()] || DEFAULT_FALLBACK_SHIFT;
        const parsed = parseShiftWithDefaultBreak(
          patternValue || fallbackValue,
          settings.defaultBreakMinutes,
        );
        if (!(parsed.kind === "work" || parsed.kind === "night")) return;

        changes.push([row, col, existing, parsed.normalized]);
      });
    });

    queueChanges(
      changes,
      "Darbo dienų užpildymas",
      `Užpildyta darbo dienų: ${changes.length}. Pildoma pagal darbuotojo darbo laiko modelį, o jei jo nėra — 08:00-17:00. Pertrauka pridedama automatiškai pagal nustatymą.`,
    );
  };

  const clearRange = () => {
    const fromIndex = scheduleDays.findIndex(
      (date) => dayKey(date) >= clearFrom,
    );
    const toIndex = scheduleDays.findIndex((date) => dayKey(date) > clearTo);
    const start = fromIndex >= 0 ? fromIndex : 0;
    const endExclusive = toIndex >= 0 ? toIndex : scheduleDays.length;
    const employeeIndexes =
      clearEmployeeId === "all"
        ? employees.map((_, index) => index)
        : employees
            .map((employee, index) =>
              employee.user_id === clearEmployeeId ? index : -1,
            )
            .filter((index) => index >= 0);
    const changes: GridChange[] = [];
    employeeIndexes.forEach((row) => {
      for (let dayIndex = start; dayIndex < endExclusive; dayIndex += 1) {
        const col = dayIndex + 1;
        const oldValue = getValue(row, col);
        if (oldValue) changes.push([row, col, oldValue, ""]);
      }
    });
    queueChanges(
      changes,
      "Masinis grafiko išvalymas",
      `Išvalyta langelių: ${changes.length}`,
    );
  };

  const excelShiftClass = (parsed: ParsedShift) => {
    if (!parsed.normalized || parsed.kind === "empty") return "";
    if (
      (parsed.kind === "work" || parsed.kind === "night") &&
      parsed.grossHours === 24
    )
      return "duty";
    if (parsed.kind === "work") return "work";
    if (parsed.kind === "night") return "night";
    if (parsed.kind === "off") return "off";
    if (parsed.kind === "vacation") return "vacation";
    if (parsed.kind === "sick") return "sick";
    if (parsed.kind === "reserved") return "reserved";
    return "meta";
  };

  const compactTimeForExport = (time: string) => {
    return time.replace(/^0/, "").replace(":00", "");
  };

  const exportCellClass = (parsed: ParsedShift) => {
    if (!parsed.normalized || parsed.kind === "empty") return "shift-empty";
    if (
      (parsed.kind === "work" || parsed.kind === "night") &&
      parsed.grossHours === 24
    )
      return "duty";
    if (parsed.kind === "work") return "work";
    if (parsed.kind === "night") return "night";
    if (parsed.kind === "off") return "off";
    if (parsed.kind === "vacation") return "vacation";
    if (parsed.kind === "sick") return "sick";
    if (parsed.kind === "reserved") return "reserved";

    return "meta";
  };

  const graphExportValue = (parsed: ParsedShift) => {
    if (!parsed.normalized || parsed.kind === "empty") return "";

    if (
      (parsed.kind === "work" || parsed.kind === "night") &&
      parsed.startMinutes !== null &&
      parsed.endMinutes !== null
    ) {
      const start = compactTimeForExport(normalizeTime(parsed.startMinutes));
      const end =
        parsed.endMinutes >= 1440 && parsed.grossHours === 24
          ? "24"
          : compactTimeForExport(normalizeTime(parsed.endMinutes));
      return `${start}-${end}`;
    }

    if (parsed.kind === "off") return "P";
    if (parsed.kind === "vacation") {
      const code = cleanText(parsed.normalized).toUpperCase();
      if (code === "MD") return "M";
      if (code === "TD") return "T";
      return code || "A";
    }
    if (parsed.kind === "sick") return "L";
    if (parsed.kind === "reserved") return "R";

    return parsed.normalized;
  };

  const timesheetDayValue = (parsed: ParsedShift) => {
    if (!parsed.normalized || parsed.kind === "empty") return "";

    if (parsed.kind === "off") return "P";
    if (parsed.kind === "vacation") {
      const code = cleanText(parsed.normalized).toUpperCase();
      if (code === "MD") return "M";
      if (code === "TD") return "T";
      return code || "A";
    }
    if (parsed.kind === "sick") return "L";
    if (parsed.kind === "reserved") return "R";

    if (
      (parsed.kind === "work" || parsed.kind === "night") &&
      parsed.grossHours !== null
    ) {
      const gross = parsed.grossHours;
      let hours = gross;

      // Tabelyje rodome tabelines valandas, ne pilną įrašo tekstą.
      // 08-17 tipiniu grafiku skaičiuojama kaip 8 val.; 12/24 val. pamainos lieka kaip pamainos trukmė.
      if (gross >= 8.5 && gross <= 9) hours = 8;
      else if (gross >= 11.5 && gross <= 12.5) hours = 12;
      else if (gross >= 23.5) hours = 24;

      return formatHours(hours).replace(".", ",");
    }

    return parsed.normalized;
  };

  const timesheetCountHours = (parsed: ParsedShift) => {
    if (
      !(parsed.kind === "work" || parsed.kind === "night") ||
      parsed.grossHours === null
    )
      return 0;

    const gross = parsed.grossHours;
    if (gross >= 8.5 && gross <= 9) return 8;
    if (gross >= 11.5 && gross <= 12.5) return 12;
    if (gross >= 23.5) return 24;
    return Number(formatHours(gross));
  };

  const exportSchedule = () => {
    const monthTitle = monthLabel(scheduleMonth);
    const totalColumns = 4 + scheduleDays.length + 2;

    const colgroup = `<colgroup>
      <col style="width:132px" />
      <col style="width:105px" />
      <col style="width:52px" />
      <col style="width:72px" />
      ${scheduleDays.map(() => '<col style="width:34px" />').join("")}
      <col style="width:68px" />
      <col style="width:72px" />
    </colgroup>`;

    const dayHeader = scheduleDays
      .map((date) => {
        const className = isHoliday(date)
          ? "holiday"
          : isWeekend(date)
            ? "weekend"
            : "weekday-bg";
        return `<th class="${className} day-head"><span class="day-number">${escapeHtml(pad2(date.getDate()))}</span><span class="weekday">${escapeHtml(weekdayLabel(date))}</span></th>`;
      })
      .join("");

    const coverageRow = `<tr>
      <td class="section-title" colspan="4">Dienos padengimas</td>
      ${scheduleDays.map(() => '<td class="coverage-cell">+</td>').join("")}
      <td class="section-title" colspan="2"></td>
    </tr>`;

    const bodyRows = employees
      .map((employee, rowIndex) => {
        let totalHours = 0;
        const dayCells = scheduleDays
          .map((date, dayIndex) => {
            const parsed = parseShiftValue(getValue(rowIndex, dayIndex + 1));
            totalHours += timesheetCountHours(parsed);
            const dayClass = isHoliday(date)
              ? "holiday"
              : isWeekend(date)
                ? "weekend"
                : "weekday-bg";
            const shiftClassName = exportCellClass(parsed);
            const value = graphExportValue(parsed);
            const baseClass = value
              ? `${shiftClassName} ${dayClass}`
              : `shift-empty ${dayClass}`;
            const content = value
              ? `<span class="shiftbox"><span>${exportCellText(value)}</span></span>`
              : "";
            return `<td class="${baseClass} shift-cell">${content}</td>`;
          })
          .join("");

        const monthlyNorm = getMonthlyContractHours(scheduleDays, employee);
        const balance = totalHours - monthlyNorm;

        return `<tr>
          <td class="employee">${escapeHtml(getName(employee))}</td>
          <td class="role-cell">${escapeHtml(getRole(employee))}</td>
          <td class="meta center">${escapeHtml(formatEmploymentRate(employee))}</td>
          <td class="meta center">${escapeHtml(formatHours(monthlyNorm))} val.</td>
          ${dayCells}
          <td class="total">${escapeHtml(formatHours(totalHours))} val.</td>
          <td class="total ${balance > 0 || balance < -8 ? "warn" : ""}">${balance > 0 ? "+" : ""}${escapeHtml(formatHours(balance))} val.</td>
        </tr>`;
      })
      .join("");

    const legendHtml = `<table class="legend">
      <tr>
        <td class="legend-label">Žymėjimai</td>
        <td class="legend-sample work"><span class="shiftbox">8-17</span></td><td>Darbo valandos</td>
        <td class="legend-sample night"><span class="shiftbox">19-7</span></td><td>Naktinė / per parą pereinanti pamaina</td>
        <td class="legend-sample off"><span class="shiftbox">P</span></td><td>Poilsis</td>
        <td class="legend-sample vacation"><span class="shiftbox">A</span></td><td>Atostogos / M / T / NA</td>
        <td class="legend-sample sick"><span class="shiftbox">L</span></td><td>Liga</td>
      </tr>
    </table>`;

    const html = `<table class="schedule-table">
      ${colgroup}
      <tr><td class="title" colspan="${totalColumns}">Galutinis darbuotojų grafikas · ${escapeHtml(monthTitle)}</td></tr>
      <tr><td class="subtitle" colspan="${totalColumns}">Langeliuose rodomos darbo valandos taip, kaip grafike: 8-17, 7-19, 19-7, 7-24. Pažeidimai šiame darbuotojams skirtame eksporte nerodomi.</td></tr>
      <tr>
        <th class="employee-head">Darbuotojas</th>
        <th class="role-head">Pareigybė</th>
        <th class="small-head">Etatas</th>
        <th class="norm-head">Mėnesio norma</th>
        ${dayHeader}
        <th class="norm-head">Iš viso</th>
        <th class="norm-head">Balansas</th>
      </tr>
      ${coverageRow}
      ${bodyRows}
    </table>
    ${legendHtml}`;

    openPrintPdf(`grafikas-${monthTitle}`, html);
  };

  const exportTimesheet = () => {
    const monthTitle = monthLabel(scheduleMonth);
    const totalColumns = 4 + scheduleDays.length + 7;

    const colgroup = `<colgroup>
      <col style="width:132px" />
      <col style="width:58px" />
      <col style="width:70px" />
      <col style="width:105px" />
      ${scheduleDays.map(() => '<col style="width:30px" />').join("")}
      <col style="width:76px" />
      <col style="width:76px" />
      <col style="width:76px" />
      <col style="width:76px" />
      <col style="width:76px" />
      <col style="width:76px" />
      <col style="width:76px" />
    </colgroup>`;

    const dayHeader = scheduleDays
      .map((date) => {
        const className = isHoliday(date)
          ? "holiday"
          : isWeekend(date)
            ? "weekend"
            : "weekday-bg";
        return `<th class="${className} day-head small-day"><span class="day-number">${escapeHtml(pad2(date.getDate()))}</span><span class="weekday">${escapeHtml(weekdayLabel(date))}</span></th>`;
      })
      .join("");

    let totals = {
      norm: 0,
      worked: 0,
      night: 0,
      vacation: 0,
      sick: 0,
      unpaid: 0,
      balance: 0,
    };

    const bodyRows = employees
      .map((employee, rowIndex) => {
        const monthlyNorm = getMonthlyContractHours(scheduleDays, employee);
        let worked = 0;
        let night = 0;
        let vacation = 0;
        let sick = 0;
        let unpaid = 0;

        const dayCells = scheduleDays
          .map((date, dayIndex) => {
            const parsed = parseShiftValue(getValue(rowIndex, dayIndex + 1));
            const value = timesheetDayValue(parsed);
            const hours = timesheetCountHours(parsed);
            const dayClass = isHoliday(date)
              ? "holiday"
              : isWeekend(date)
                ? "weekend"
                : "weekday-bg";
            const shiftClassName = exportCellClass(parsed);

            if (parsed.kind === "work" || parsed.kind === "night") {
              worked += hours;
              if (parsed.kind === "night") night += hours;
            } else if (parsed.kind === "vacation") {
              const code = cleanText(parsed.normalized).toUpperCase();
              if (code === "NA") unpaid += 8;
              else vacation += 8;
            } else if (parsed.kind === "sick") {
              sick += 8;
            }

            const baseClass = value
              ? `${shiftClassName} ${dayClass}`
              : `shift-empty ${dayClass}`;
            return `<td class="${baseClass} timesheet-cell">${exportCellText(value)}</td>`;
          })
          .join("");

        const allHours = worked + vacation + sick + unpaid;
        const balance = allHours - monthlyNorm;

        totals.norm += monthlyNorm;
        totals.worked += worked;
        totals.night += night;
        totals.vacation += vacation;
        totals.sick += sick;
        totals.unpaid += unpaid;
        totals.balance += balance;

        return `<tr>
          <td class="employee">${escapeHtml(getName(employee))}</td>
          <td class="meta center">${escapeHtml(formatEmploymentRate(employee))}</td>
          <td class="meta center">${escapeHtml(formatHours(monthlyNorm))}</td>
          <td class="meta center">${escapeHtml(getRole(employee))}</td>
          ${dayCells}
          <td class="total">${escapeHtml(formatHours(worked))}</td>
          <td class="total">${escapeHtml(formatHours(night))}</td>
          <td class="total">${escapeHtml(formatHours(vacation))}</td>
          <td class="total">${escapeHtml(formatHours(sick))}</td>
          <td class="total">${escapeHtml(formatHours(unpaid))}</td>
          <td class="total">${escapeHtml(formatHours(allHours))}</td>
          <td class="total ${balance > 0 || balance < -8 ? "warn" : ""}">${balance > 0 ? "+" : ""}${escapeHtml(formatHours(balance))}</td>
        </tr>`;
      })
      .join("");

    const summaryRow = `<tr>
      <td class="employee">IŠ VISO</td>
      <td class="total"></td>
      <td class="total">${escapeHtml(formatHours(totals.norm))}</td>
      <td class="total"></td>
      ${scheduleDays.map(() => '<td class="total"></td>').join("")}
      <td class="total">${escapeHtml(formatHours(totals.worked))}</td>
      <td class="total">${escapeHtml(formatHours(totals.night))}</td>
      <td class="total">${escapeHtml(formatHours(totals.vacation))}</td>
      <td class="total">${escapeHtml(formatHours(totals.sick))}</td>
      <td class="total">${escapeHtml(formatHours(totals.unpaid))}</td>
      <td class="total">${escapeHtml(formatHours(totals.worked + totals.vacation + totals.sick + totals.unpaid))}</td>
      <td class="total ${totals.balance > 0 || totals.balance < -8 ? "warn" : ""}">${totals.balance > 0 ? "+" : ""}${escapeHtml(formatHours(totals.balance))}</td>
    </tr>`;

    const html = `<table class="schedule-table">
      ${colgroup}
      <tr><td class="title" colspan="${totalColumns}">KR tabelis · ${escapeHtml(monthTitle)}</td></tr>
      <tr><td class="subtitle" colspan="${totalColumns}">PDF tabelyje rodomas visas mėnesio kalendorius. Darbo pamainos rodomos valandomis, pvz. 8 arba 12; neatvykimai – A, M, T, L, P, NA.</td></tr>
      <tr>
        <th class="employee-head">Darbuotojas</th>
        <th class="small-head">Etatas</th>
        <th class="norm-head">Norma</th>
        <th class="role-head">Pareigybė</th>
        ${dayHeader}
        <th class="norm-head">Dirbta</th>
        <th class="norm-head">Naktinės</th>
        <th class="norm-head">A/M/T</th>
        <th class="norm-head">Liga</th>
        <th class="norm-head">NA</th>
        <th class="norm-head">Iš viso</th>
        <th class="norm-head">Likutis</th>
      </tr>
      ${bodyRows}
      ${summaryRow}
    </table>`;

    openPrintPdf(`tabelis-${monthTitle}`, html);
  };

  const beginDrag = (value: string) => {
    const parsed = parseShiftValue(value);
    if (!parsed.normalized) return;
    setDragCopy({ value: parsed.normalized, cells: [] });
  };

  const dragOverCell = (row: number, col: number) => {
    setDragCopy((prev) => {
      if (!prev) return prev;
      if (prev.cells.some((cell) => cell.row === row && cell.col === col))
        return prev;
      const employee = employees[row];
      const parsed = parseShiftValue(prev.value);
      if (
        employee &&
        (parsed.kind === "work" || parsed.kind === "night") &&
        getTrainingStatus(employee).blocking
      )
        return prev;
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
    queueChanges(
      drag.cells.map(
        (cell) => [cell.row, cell.col, cell.oldValue, drag.value] as GridChange,
      ),
      "Kopijavimas tempiant",
      `Nukopijuota į ${drag.cells.length} lang.`,
    );
  };

  const selectedPatternEmployee =
    employees.find((employee) => employee.user_id === templateEmployeeId) ||
    activeEmployee ||
    employees[0];
  const pattern = selectedPatternEmployee
    ? settings.patterns[selectedPatternEmployee.user_id] || {}
    : {};
  const departmentLabel =
    departmentFilter === "all"
      ? "visi skyriai"
      : departmentFilter === "none"
        ? "be skyriaus"
        : departmentFilter;
  const visibleCountText = `Rodoma: ${filter === "all" ? "visi darbuotojai" : filter === "errors" ? "darbuotojai su pažeidimais" : filter === "warnings" ? "darbuotojai su įspėjimais" : filter === "training" ? "mokymų rizikos" : "neatvykimų rezervacijos"} · ${departmentLabel} (${filteredEmployees.length} iš ${employees.length}).`;
  const maxSeven = Math.max(
    0,
    ...allValidations.map((row) => row.maxSevenDayHours),
  );
  const shortestRestValues = allValidations
    .map((row) => row.shortestRestHours ?? Infinity)
    .filter((value) => Number.isFinite(value));
  const shortestRest = shortestRestValues.length
    ? Math.min(...shortestRestValues)
    : null;
  const totalEmploymentRate = allValidations.reduce(
    (sum, row) => sum + row.employmentRate,
    0,
  );
  const totalPlannedHours = allValidations.reduce(
    (sum, row) => sum + row.plannedHours,
    0,
  );
  const totalContractHours = allValidations.reduce(
    (sum, row) => sum + row.monthlyContractHours,
    0,
  );
  const allCurrentGridChanges = useMemo(() => {
    const changes: GridChange[] = [];
    employees.forEach((employee, rowIndex) => {
      scheduleDays.forEach((date, dayIndex) => {
        const col = dayIndex + 1;
        const value = parseShiftValue(getValue(rowIndex, col)).normalized;
        if (value) changes.push([rowIndex, col, "", value]);
      });
    });
    return changes;
  }, [employees, scheduleDays, grid]);

  const hasPublishableGrid = allCurrentGridChanges.length > 0;
  const overEmploymentCount = allValidations.filter(
    (row) => row.monthlyBalanceHours > 1,
  ).length;
  const coverageByVisibleDay = visibleScheduleDays.map(
    (date, visibleDayIndex) => {
      const originalDayIndex = visibleDayIndexes[visibleDayIndex];
      const planned = filteredEmployees.reduce((count, employee) => {
        const rowIndex = employees.findIndex(
          (item) => item.user_id === employee.user_id,
        );
        const parsed = parseShiftValue(
          getValue(rowIndex, originalDayIndex + 1),
        );
        const previousParsed =
          originalDayIndex > 0
            ? parseShiftValue(getValue(rowIndex, originalDayIndex))
            : null;
        const isCoveredByShift =
          parsed.kind === "work" ||
          parsed.kind === "night" ||
          Boolean(previousParsed && isOvernightOrDutyShift(previousParsed));
        return count + (isCoveredByShift ? 1 : 0);
      }, 0);
      const target = Math.max(1, Math.ceil(filteredEmployees.length * 0.55));
      const percent = Math.min(100, Math.round((planned / target) * 100));
      return { date, planned, target, percent };
    },
  );

  return (
    <section className="schedule-module" onMouseUp={finishDrag}>
      <div className="schedule-toolbar">
        <div>
          <div className="eyebrow">Darbo grafikas</div>
          <h2>{monthLabel(scheduleMonth)}</h2>
          <p className="subtle">
            Tikrinamas darbo laikas, poilsis, neatvykimai, mokymai, pertraukos,
            prieššventinės dienos ir etato krūvio norma.
          </p>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setScheduleMonth((prev) => addMonths(prev, -1))}
          >
            <ChevronLeft size={16} /> Ankstesnis
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setScheduleMonth(new Date())}
          >
            <CalendarDays size={16} /> Šis mėnuo
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setScheduleMonth((prev) => addMonths(prev, 1))}
          >
            Kitas <ChevronRight size={16} />
          </button>
          <button type="button" className="btn" onClick={exportSchedule}>
            <Download size={16} /> Eksportuoti grafiką PDF
          </button>
          <button type="button" className="btn" onClick={exportTimesheet}>
            <Download size={16} /> Tabelis PDF
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => saveScheduleChanges("draft")}
            disabled={localSaving || saving || pendingChanges.length === 0}
          >
            <Save size={16} />{" "}
            {localSaving && !publishing
              ? "Saugoma..."
              : pendingChanges.length
                ? `Išsaugoti juodraštį (${pendingChanges.length})`
                : "Juodraštis išsaugotas"}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => saveScheduleChanges("published")}
            disabled={
              localSaving ||
              saving ||
              (!pendingChanges.length && !hasPublishableGrid)
            }
          >
            <CheckCircle2 size={16} />{" "}
            {publishing || saving
              ? "Skelbiama..."
              : pendingChanges.length
                ? `Paskelbti (${pendingChanges.length})`
                : hasPublishableGrid
                  ? "Paskelbti grafiką"
                  : "Paskelbta"}
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <button
          type="button"
          className={`kpi ${filter === "all" ? "active" : ""}`}
          onClick={() => {
            setFilter("all");
            setInspectorPanel("summary");
          }}
        >
          <Users size={20} /> <b>{employees.length}</b>
          <span>Darbuotojų</span>
        </button>
        <button type="button" className="kpi">
          <Clock size={20} /> <b>{formatHours(totalEmploymentRate)}</b>
          <span>Etatai</span>
        </button>
        <button
          type="button"
          className={`kpi warn ${overEmploymentCount ? "active" : ""}`}
          onClick={() => {
            setFilter("warnings");
            setInspectorPanel("issues");
          }}
        >
          <AlertTriangle size={20} /> <b>{overEmploymentCount}</b>
          <span>Viršija etatą</span>
        </button>
        <button
          type="button"
          className={`kpi bad ${filter === "errors" ? "active" : ""}`}
          onClick={() => {
            setFilter("errors");
            setInspectorPanel("issues");
          }}
        >
          <AlertTriangle size={20} /> <b>{errorCount}</b>
          <span>Pažeidimai</span>
        </button>
        <button
          type="button"
          className={`kpi warn ${filter === "warnings" ? "active" : ""}`}
          onClick={() => {
            setFilter("warnings");
            setInspectorPanel("issues");
          }}
        >
          <Clock size={20} /> <b>{warningCount}</b>
          <span>Įspėjimai</span>
        </button>
        <button
          type="button"
          className={`kpi bad ${filter === "training" ? "active" : ""}`}
          onClick={() => {
            setFilter("training");
            setInspectorPanel("training");
          }}
        >
          <GraduationCap size={20} /> <b>{trainingIssueCount}</b>
          <span>Mokymų rizikos</span>
        </button>
      </div>

      <div className="compact-help">
        <span>ⓘ</span> Spauskite langelį ir rinkitės greitą įrašą. Kopijavimas:
        Ctrl+C / Ctrl+V arba tempimas per langelius.
      </div>

      <div className="planning-workbar">
        <div className="module-employee-picker">
          <span className="label">Darbuotojas moduliams</span>
          <select
            value={templateEmployeeId}
            onChange={(event) => setTemplateEmployeeId(event.target.value)}
          >
            {employees.map((employee) => (
              <option key={employee.user_id} value={employee.user_id}>
                {getName(employee)}
              </option>
            ))}
          </select>
        </div>
        <div className="workbar-actions">
          <button
            type="button"
            className={`btn ${toolPanel === "templates" ? "primary" : "ghost"}`}
            onClick={() =>
              setToolPanel((prev) =>
                prev === "templates" ? null : "templates",
              )
            }
          >
            <Plus size={15} /> Šablonai
          </button>
          <button
            type="button"
            className={`btn ${toolPanel === "pattern" ? "primary" : "ghost"}`}
            onClick={() =>
              setToolPanel((prev) => (prev === "pattern" ? null : "pattern"))
            }
          >
            <CalendarDays size={15} /> Darbo modelis
          </button>
          <button
            type="button"
            className={`btn ${toolPanel === "bulk" ? "primary" : "ghost"}`}
            onClick={() =>
              setToolPanel((prev) => (prev === "bulk" ? null : "bulk"))
            }
          >
            <Sparkles size={15} /> Masiniai veiksmai
          </button>
        </div>
      </div>

      {toolPanel === "templates" ? (
        <div className="panel templates-panel tool-drawer">
          <div>
            <h3>Pamainų šablonai</h3>
            <p className="subtle">
              Pasirinkus grafiko langelį šablonas įrašomas į grafiką. Pasirinkus
              darbo laiko modelio lauką — į tą savaitės dieną. Pertrauka
              pridedama automatiškai pagal nustatymą.
            </p>
          </div>
          <div className="template-form">
            <select
              value={templateEmployeeId}
              onChange={(event) => setTemplateEmployeeId(event.target.value)}
            >
              {employees.map((employee) => (
                <option key={employee.user_id} value={employee.user_id}>
                  {getName(employee)}
                </option>
              ))}
            </select>
            <input
              value={templateDraft}
              onChange={(event) => setTemplateDraft(event.target.value)}
              onBlur={(event) => {
                const parsed = parseShiftWithDefaultBreak(
                  event.target.value,
                  settings.defaultBreakMinutes,
                );
                if (parsed.kind === "work" || parsed.kind === "night")
                  setTemplateDraft(stripBreakFromValue(parsed.normalized));
              }}
              placeholder="08-17"
            />
            <select
              value={String(settings.defaultBreakMinutes)}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  defaultBreakMinutes: Number(event.target.value),
                }))
              }
              title="Automatiškai pridedama pertrauka į grafiko įrašus, kai šablone nenurodyta P."
            >
              <option value="0">Be auto pertraukos</option>
              <option value="30">Pertrauka 30 min.</option>
              <option value="45">Pertrauka 45 min.</option>
              <option value="60">Pertrauka 60 min.</option>
              <option value="90">Pertrauka 90 min.</option>
            </select>
            <button type="button" className="btn" onClick={addTemplate}>
              <Plus size={15} /> Pridėti šabloną
            </button>
            {selectedPatternEmployee ? (
              <div
                className="employment-chip"
                title="Etatas ir savaitinė norma ateina iš darbuotojo kortelės / organization_members duomenų"
              >
                {formatEmploymentRate(selectedPatternEmployee)} ·{" "}
                {formatHours(getWeeklyContractHours(selectedPatternEmployee))}{" "}
                val./sav.
              </div>
            ) : null}
            {selectedPatternEmployee ? (
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={Boolean(
                    settings.allowTwentyFourHourDuty[
                      selectedPatternEmployee.user_id
                    ],
                  )}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      allowTwentyFourHourDuty: {
                        ...prev.allowTwentyFourHourDuty,
                        [selectedPatternEmployee.user_id]: event.target.checked,
                      },
                    }))
                  }
                />
                Leisti 24 val. budėjimus
              </label>
            ) : null}
          </div>
          <div className="template-list">
            {employeeTemplates.map((template) => (
              <button
                type="button"
                className="template-pill"
                key={template}
                onClick={() => useTemplate(template)}
              >
                {template}
                {activeEmployee &&
                settings.templates[activeEmployee.user_id]?.includes(
                  template,
                ) ? (
                  <span
                    onClick={(event) => {
                      event.stopPropagation();
                      removeTemplate(activeEmployee.user_id, template);
                    }}
                  >
                    <X size={12} />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {toolPanel === "pattern" ? (
        <div className="panel pattern-panel tool-drawer">
          <div>
            <h3>Darbo laiko modelis</h3>
            <p className="subtle">
              Skirtingoms savaitės dienoms galima nustatyti skirtingą laiką.
              Paspauskite modelio lauką ir pasirinkite šabloną — laikas įsirašys
              į tą dieną.
            </p>
            <label className="drawer-field">
              <span>Darbuotojas</span>
              <select
                value={templateEmployeeId}
                onChange={(event) => setTemplateEmployeeId(event.target.value)}
              >
                {employees.map((employee) => (
                  <option key={employee.user_id} value={employee.user_id}>
                    {getName(employee)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="pattern-grid">
            {WEEKDAYS.map((day) => (
              <label key={day.day}>
                <span>{day.short}</span>
                <input
                  value={stripBreakFromValue(pattern[day.day] || "")}
                  onFocus={() => {
                    setActiveCell(null);
                    setActivePatternDay(day.day);
                  }}
                  onChange={(event) =>
                    selectedPatternEmployee &&
                    updatePattern(
                      selectedPatternEmployee.user_id,
                      day.day,
                      event.target.value,
                    )
                  }
                  onBlur={(event) =>
                    selectedPatternEmployee &&
                    updatePattern(
                      selectedPatternEmployee.user_id,
                      day.day,
                      event.target.value,
                      true,
                    )
                  }
                  placeholder={
                    day.day === 1 || day.day === 3
                      ? "08-17"
                      : day.day === 2 || day.day === 4
                        ? "07-15"
                        : ""
                  }
                />
              </label>
            ))}
          </div>
          <div className="pattern-actions">
            <button
              type="button"
              className="btn"
              onClick={() => applyPattern("selected")}
            >
              <Sparkles size={15} /> Pritaikyti pasirinktam darbuotojui
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => applyPattern("all")}
            >
              Pritaikyti visiems pagal jų modelius
            </button>
          </div>
        </div>
      ) : null}

      {toolPanel === "bulk" ? (
        <div className="panel bulk-panel tool-drawer">
          <div>
            <h3>Masiniai veiksmai</h3>
            <p className="subtle">
              Pasirinkite darbuotoją arba „Visi darbuotojai“, laikotarpį ir
              spauskite „Užpildyti pasirinktą laikotarpį“. Pildoma pagal
              kiekvieno darbuotojo darbo laiko modelį. Jei modelio nėra, taikoma
              08:00-17:00; pertrauka pridedama automatiškai pagal nustatymą.
            </p>
          </div>
          <div className="bulk-actions">
            <button type="button" className="btn" onClick={autofillWorkdays}>
              <Sparkles size={15} /> Užpildyti pasirinktą laikotarpį
            </button>
            <select
              className="bulk-control"
              value={clearEmployeeId}
              onChange={(event) => setClearEmployeeId(event.target.value)}
            >
              <option value="all">Visi darbuotojai</option>
              {employees.map((employee) => (
                <option key={employee.user_id} value={employee.user_id}>
                  {getName(employee)}
                </option>
              ))}
            </select>
            <input
              className="bulk-control date-control"
              type="date"
              value={clearFrom}
              onChange={(event) => setClearFrom(event.target.value)}
            />
            <input
              className="bulk-control date-control"
              type="date"
              value={clearTo}
              onChange={(event) => setClearTo(event.target.value)}
            />
            <button type="button" className="btn danger" onClick={clearRange}>
              <Trash2 size={15} /> Išvalyti laikotarpį
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={undo}
              disabled={!undoStack.length}
            >
              <RotateCcw size={15} /> Atšaukti
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="notice">
          <CheckCircle2 size={16} /> {message}
        </div>
      ) : null}

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
            <button
              type="button"
              className="btn ghost"
              onClick={showPreviousWeek}
              disabled={!canGoPreviousWeek}
            >
              <ChevronLeft size={15} /> Ankstesnė savaitė
            </button>
            <strong>{weekLabel}</strong>
            <button
              type="button"
              className="btn ghost"
              onClick={showNextWeek}
              disabled={!canGoNextWeek}
            >
              Kita savaitė <ChevronRight size={15} />
            </button>
          </div>
        ) : (
          <span className="view-help">{visibleCountText}</span>
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
        <button
          type="button"
          className={`validation-banner ${errorCount > 0 ? "bad" : "warn"}`}
          onClick={() => setInspectorPanel("issues")}
        >
          <AlertTriangle size={18} />
          <div>
            <b>
              {errorCount > 0
                ? "Yra grafiko pažeidimų"
                : "Yra grafiko įspėjimų"}
            </b>
            <span>
              {errorCount} pažeid. · {warningCount} įspėj. Paspauskite KPI arba
              atidarykite neatitikimų langą.
            </span>
          </div>
        </button>
      ) : null}

      <div className="schedule-legend">
        <span>
          <i className="legend-dot work" /> Dieninė
        </span>
        <span>
          <i className="legend-dot night" /> Naktinė
        </span>
        <span>
          <i className="legend-dot vacation" /> Atostogos / mamadienis
        </span>
        <span>
          <i className="legend-dot sick" /> Liga
        </span>
        <span>
          <i className="legend-dot off" /> Poilsis
        </span>
        <span>
          <i className="legend-dot reserved" /> Rezervacija
        </span>
      </div>

      <div className="quick-entry-strip">
        <span className="label">Greiti įrašai</span>
        {[
          ["08-17", "Dieninė"],
          ["07-19", "Ilga dieninė"],
          ["19-07", "Naktinė"],
          ["07-07", "Para"],
          ["P", "Poilsis"],
          ["A", "Atostogos"],
          ["L", "Liga"],
        ].map(([code, label]) => (
          <button
            type="button"
            key={code}
            className="pill"
            title={label}
            onClick={() => quickSet(code)}
          >
            {code}
          </button>
        ))}
        <button type="button" className="pill" onClick={() => quickSet("")}>
          Išvalyti
        </button>
        <span className="quick-hint">
          Pasirinkite langelį ir spauskite greitą įrašą.
        </span>
      </div>

      <div className="grid-shell">
        <div className="schedule-grid" style={{ gridTemplateColumns }}>
          <div className="coverage-head sticky-left">
            <strong>Statistika</strong>
            <span>Dienos padengimas</span>
          </div>
          {coverageByVisibleDay.map((item) => (
            <div
              key={`coverage-${dayKey(item.date)}`}
              className={`coverage-cell ${isWeekend(item.date) ? "weekend" : ""} ${isHoliday(item.date) ? "holiday" : ""}`}
            >
              <div
                className="coverage-bar"
                style={{ height: `${Math.max(10, item.percent)}%` }}
              />
              <small>
                {item.planned}/{item.target}
              </small>
            </div>
          ))}
          <div className="coverage-total">Padengimas</div>

          <div className="head sticky-left employee-head">
            <div className="employee-head-title">Darbuotojas</div>
            <input
              className="employee-head-search"
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
              placeholder="Ieškoti..."
            />
            <select
              className="employee-head-select"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
            >
              <option value="all">Visi skyriai</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
              <option value="none">Be skyriaus</option>
            </select>
          </div>
          {visibleScheduleDays.map((date) => (
            <div
              key={dayKey(date)}
              className={`head ${isWeekend(date) ? "weekend" : ""} ${isHoliday(date) ? "holiday" : ""} ${isPreHoliday(date) ? "preholiday" : ""} ${activeCell && activeCell.col === scheduleDays.findIndex((item) => dayKey(item) === dayKey(date)) + 1 ? "active-col" : ""}`}
              title={
                isHoliday(date)
                  ? "Šventinė diena"
                  : isPreHoliday(date)
                    ? "Prieššventinė diena"
                    : ""
              }
            >
              <b>{pad2(date.getDate())}</b>
              <small>{weekdayLabel(date)}</small>
              {isPreHoliday(date) ? <em>-1 val.</em> : null}
            </div>
          ))}
          <div className="head total-head">Iš viso</div>

          {filteredEmployees.map((employee) => {
            const rowIndex = employees.findIndex(
              (item) => item.user_id === employee.user_id,
            );
            const validation = validationByEmployee.get(employee.user_id);
            return (
              <div
                key={employee.user_id}
                className="row-fragment"
                style={{ display: "contents" }}
              >
                <div
                  className={`person sticky-left ${activeCell?.row === rowIndex ? "active-row" : ""}`}
                  onClick={() => setTemplateEmployeeId(employee.user_id)}
                >
                  <b>{getName(employee)}</b>
                  <span>{getRole(employee)}</span>
                  <div className="person-meta">
                    <em>
                      {formatHours(validation?.plannedHours || 0)}h /{" "}
                      {formatHours(validation?.monthlyContractHours || 0)}h
                    </em>
                    <em>{formatEmploymentRate(employee)}</em>
                    {validation?.issues.length ? (
                      <em className="bad">{validation.issues.length}!</em>
                    ) : null}
                    {!validation?.issues.length &&
                    validation?.warnings.length ? (
                      <em className="warn">{validation.warnings.length}</em>
                    ) : null}
                  </div>
                </div>
                {visibleScheduleDays.map((date, visibleDayIndex) => {
                  const originalDayIndex = visibleDayIndexes[visibleDayIndex];
                  const colIndex = originalDayIndex + 1;
                  if (originalDayIndex < 0) return null;
                  const visualShift = getVisualShiftForCell(
                    rowIndex,
                    originalDayIndex,
                  );
                  const rawValue = visualShift.rawValue;
                  const parsed = visualShift.parsed;
                  const displayLabel = visualShift.displayLabel;
                  const sourceColIndex = visualShift.sourceCol;
                  const isEditing =
                    editingCell?.row === rowIndex &&
                    editingCell.col === sourceColIndex;
                  const reservation = reservationMap.get(
                    `${employee.user_id}__${dayKey(date)}`,
                  );
                  const training = getTrainingStatus(employee);
                  const datedIssues = [
                    ...(validation?.issues || []),
                    ...(validation?.warnings || []),
                  ].filter((issue) => issue.date === dayKey(date));
                  const hasCellIssue = datedIssues.some(
                    (issue) => issue.severity === "error",
                  );
                  const hasCellWarning = datedIssues.some(
                    (issue) => issue.severity === "warning",
                  );

                  return (
                    <div
                      key={`${employee.user_id}-${dayKey(date)}`}
                      className={`day-cell ${isWeekend(date) ? "weekend" : ""} ${isHoliday(date) ? "holiday" : ""} ${hasCellIssue ? "cell-error" : ""} ${hasCellWarning ? "cell-warning" : ""} ${reservation ? "reserved" : ""} ${visualShift.isSplitStart ? "split-start" : ""} ${visualShift.isSplitContinuation ? "split-continuation" : ""} ${activeCell?.row === rowIndex ? "active-row" : ""} ${activeCell?.col === colIndex || activeCell?.col === sourceColIndex ? "active-col" : ""} ${activeCell?.row === rowIndex && activeCell?.col === sourceColIndex ? "active-cell" : ""}`}
                      onMouseEnter={() =>
                        dragCopy && dragOverCell(rowIndex, colIndex)
                      }
                    >
                      {isEditing ? (
                        <input
                          className="cell-input"
                          autoFocus
                          value={editingCell.draft}
                          onChange={(event) =>
                            setEditingCell((prev) =>
                              prev
                                ? { ...prev, draft: event.target.value }
                                : prev,
                            )
                          }
                          onFocus={(event) => event.currentTarget.select()}
                          onBlur={() =>
                            commitCell(
                              rowIndex,
                              sourceColIndex,
                              editingCell.oldValue,
                              editingCell.draft,
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter")
                              commitCell(
                                rowIndex,
                                sourceColIndex,
                                editingCell.oldValue,
                                editingCell.draft,
                              );
                            if (event.key === "Escape") setEditingCell(null);
                            if (
                              event.key === "Delete" ||
                              event.key === "Backspace"
                            )
                              setEditingCell((prev) =>
                                prev ? { ...prev, draft: "" } : prev,
                              );
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className={`${shiftClass(
                            parsed,
                            allowTwentyFourFor(employee),
                          )} ${visualShift.isSplitContinuation ? "shift-split-continuation" : ""}`.trim()}
                          title={[
                            parsed.detail,
                            reservation
                              ? `Rezervacija: ${reservation.label}`
                              : "",
                            datedIssues.map((issue) => issue.detail).join("; "),
                          ]
                            .filter(Boolean)
                            .join("\n")}
                          onClick={() => {
                            setActivePatternDay(null);
                            setActiveCell({
                              row: rowIndex,
                              col: sourceColIndex,
                            });
                            setEditingCell({
                              row: rowIndex,
                              col: sourceColIndex,
                              draft: stripBreakFromValue(parsed.normalized),
                              oldValue: rawValue,
                            });
                          }}
                          onMouseDown={() =>
                            !visualShift.isSplitContinuation &&
                            beginDrag(parsed.normalized)
                          }
                          onKeyDown={(event) => {
                            if (
                              event.ctrlKey &&
                              event.key.toLowerCase() === "c"
                            ) {
                              setClipboardValue(parsed.normalized);
                              setMessage(
                                `Nukopijuota: ${parsed.normalized || "tuščia"}`,
                              );
                            }
                            if (
                              event.ctrlKey &&
                              event.key.toLowerCase() === "v" &&
                              clipboardValue
                            )
                              commitCell(
                                rowIndex,
                                sourceColIndex,
                                rawValue,
                                clipboardValue,
                              );
                            if (event.key === "Delete")
                              commitCell(
                                rowIndex,
                                sourceColIndex,
                                rawValue,
                                "",
                              );
                            if (
                              [
                                "p",
                                "P",
                                "a",
                                "A",
                                "l",
                                "L",
                                "m",
                                "M",
                                "t",
                                "T",
                              ].includes(event.key)
                            )
                              commitCell(
                                rowIndex,
                                sourceColIndex,
                                rawValue,
                                event.key.toUpperCase(),
                              );
                          }}
                        >
                          {reservation ? (
                            <span className="badge reservation">R</span>
                          ) : null}
                          {training.blocking &&
                          (parsed.kind === "work" ||
                            parsed.kind === "night") ? (
                            <span className="badge training">M</span>
                          ) : null}
                          {parsed.kind === "work" || parsed.kind === "night" ? (
                            <span className="time">
                              <span>{displayLabel.split("-")[0]}</span>
                              <i />
                              <span>{displayLabel.split("-")[1]}</span>
                              {parsed.breakMinutes ? (
                                <small>P{parsed.breakMinutes}</small>
                              ) : null}
                            </span>
                          ) : (
                            <span>{parsed.label}</span>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
                <div className="total-cell">
                  <b>
                    {formatHours(validation?.plannedHours || 0)} /{" "}
                    {formatHours(validation?.monthlyContractHours || 0)} val.
                  </b>
                  <small
                    className={
                      validation && Math.abs(validation.monthlyBalanceHours) > 1
                        ? validation.monthlyBalanceHours > 0
                          ? "over"
                          : "under"
                        : "ok"
                    }
                  >
                    {validation
                      ? `${validation.monthlyBalanceHours > 0 ? "+" : ""}${formatHours(validation.monthlyBalanceHours)} val.`
                      : "0 val."}
                  </small>
                  <span className={`status ${validation?.statusClass || "ok"}`}>
                    {validation?.statusLabel || "Be neatitikimų"}
                  </span>
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
              <div
                className="schedule-grid large-schedule-grid"
                style={{
                  gridTemplateColumns:
                    scheduleView === "week"
                      ? `220px repeat(${visibleScheduleDays.length}, 112px) 150px`
                      : `200px repeat(${visibleScheduleDays.length}, 41px) 118px`,
                }}
              >
                <div className="head sticky-left">Darbuotojas</div>
                {visibleScheduleDays.map((date) => (
                  <div
                    key={dayKey(date)}
                    className={`head ${isWeekend(date) ? "weekend" : ""} ${isHoliday(date) ? "holiday" : ""} ${isPreHoliday(date) ? "preholiday" : ""}`}
                    title={
                      isHoliday(date)
                        ? "Šventinė diena"
                        : isPreHoliday(date)
                          ? "Prieššventinė diena"
                          : ""
                    }
                  >
                    <b>{pad2(date.getDate())}</b>
                    <small>{weekdayLabel(date)}</small>
                    {isPreHoliday(date) ? <em>-1 val.</em> : null}
                  </div>
                ))}
                <div className="head total-head">Iš viso</div>

                {filteredEmployees.map((employee) => {
                  const rowIndex = employees.findIndex(
                    (item) => item.user_id === employee.user_id,
                  );
                  const validation = validationByEmployee.get(employee.user_id);
                  return (
                    <div
                      key={employee.user_id}
                      className="row-fragment"
                      style={{ display: "contents" }}
                    >
                      <div
                        className="person sticky-left"
                        onClick={() => setTemplateEmployeeId(employee.user_id)}
                      >
                        <b>{getName(employee)}</b>
                        <span>{getRole(employee)}</span>
                        <div className="person-meta">
                          <em>
                            {formatHours(validation?.plannedHours || 0)}h /{" "}
                            {formatHours(validation?.monthlyContractHours || 0)}
                            h
                          </em>
                          <em>{formatEmploymentRate(employee)}</em>
                          {validation?.issues.length ? (
                            <em className="bad">{validation.issues.length}!</em>
                          ) : null}
                          {!validation?.issues.length &&
                          validation?.warnings.length ? (
                            <em className="warn">
                              {validation.warnings.length}
                            </em>
                          ) : null}
                        </div>
                      </div>
                      {visibleScheduleDays.map((date, visibleDayIndex) => {
                        const originalDayIndex =
                          visibleDayIndexes[visibleDayIndex];
                        const colIndex = originalDayIndex + 1;
                        if (originalDayIndex < 0) return null;
                        const rawValue = getValue(rowIndex, colIndex);
                        const parsed = parseShiftValue(rawValue);
                        const isEditing =
                          editingCell?.row === rowIndex &&
                          editingCell.col === colIndex;
                        const reservation = reservationMap.get(
                          `${employee.user_id}__${dayKey(date)}`,
                        );
                        const training = getTrainingStatus(employee);
                        const datedIssues = [
                          ...(validation?.issues || []),
                          ...(validation?.warnings || []),
                        ].filter((issue) => issue.date === dayKey(date));
                        const hasCellIssue = datedIssues.some(
                          (issue) => issue.severity === "error",
                        );
                        const hasCellWarning = datedIssues.some(
                          (issue) => issue.severity === "warning",
                        );

                        return (
                          <div
                            key={`${employee.user_id}-${dayKey(date)}`}
                            className={`day-cell ${isWeekend(date) ? "weekend" : ""} ${isHoliday(date) ? "holiday" : ""} ${hasCellIssue ? "cell-error" : ""} ${hasCellWarning ? "cell-warning" : ""} ${reservation ? "reserved" : ""}`}
                            onMouseEnter={() =>
                              dragCopy && dragOverCell(rowIndex, colIndex)
                            }
                          >
                            {isEditing ? (
                              <input
                                className="cell-input"
                                autoFocus
                                value={editingCell.draft}
                                onChange={(event) =>
                                  setEditingCell((prev) =>
                                    prev
                                      ? { ...prev, draft: event.target.value }
                                      : prev,
                                  )
                                }
                                onFocus={(event) =>
                                  event.currentTarget.select()
                                }
                                onBlur={() =>
                                  commitCell(
                                    rowIndex,
                                    colIndex,
                                    editingCell.oldValue,
                                    editingCell.draft,
                                  )
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter")
                                    commitCell(
                                      rowIndex,
                                      colIndex,
                                      editingCell.oldValue,
                                      editingCell.draft,
                                    );
                                  if (event.key === "Escape")
                                    setEditingCell(null);
                                  if (
                                    event.key === "Delete" ||
                                    event.key === "Backspace"
                                  )
                                    setEditingCell((prev) =>
                                      prev ? { ...prev, draft: "" } : prev,
                                    );
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                className={shiftClass(
                                  parsed,
                                  allowTwentyFourFor(employee),
                                )}
                                title={[
                                  parsed.detail,
                                  reservation
                                    ? `Rezervacija: ${reservation.label}`
                                    : "",
                                  datedIssues
                                    .map((issue) => issue.detail)
                                    .join("; "),
                                ]
                                  .filter(Boolean)
                                  .join("\n")}
                                onClick={() => {
                                  setActivePatternDay(null);
                                  setActiveCell({
                                    row: rowIndex,
                                    col: colIndex,
                                  });
                                  setEditingCell({
                                    row: rowIndex,
                                    col: colIndex,
                                    draft: stripBreakFromValue(
                                      parsed.normalized,
                                    ),
                                    oldValue: rawValue,
                                  });
                                }}
                                onMouseDown={() => beginDrag(parsed.normalized)}
                                onKeyDown={(event) => {
                                  if (
                                    event.ctrlKey &&
                                    event.key.toLowerCase() === "c"
                                  ) {
                                    setClipboardValue(parsed.normalized);
                                    setMessage(
                                      `Nukopijuota: ${parsed.normalized || "tuščia"}`,
                                    );
                                  }
                                  if (
                                    event.ctrlKey &&
                                    event.key.toLowerCase() === "v" &&
                                    clipboardValue
                                  )
                                    commitCell(
                                      rowIndex,
                                      colIndex,
                                      rawValue,
                                      clipboardValue,
                                    );
                                  if (event.key === "Delete")
                                    commitCell(
                                      rowIndex,
                                      colIndex,
                                      rawValue,
                                      "",
                                    );
                                  if (
                                    [
                                      "p",
                                      "P",
                                      "a",
                                      "A",
                                      "l",
                                      "L",
                                      "m",
                                      "M",
                                      "t",
                                      "T",
                                    ].includes(event.key)
                                  )
                                    commitCell(
                                      rowIndex,
                                      colIndex,
                                      rawValue,
                                      event.key.toUpperCase(),
                                    );
                                }}
                              >
                                {reservation ? (
                                  <span className="badge reservation">R</span>
                                ) : null}
                                {training.blocking &&
                                (parsed.kind === "work" ||
                                  parsed.kind === "night") ? (
                                  <span className="badge training">M</span>
                                ) : null}
                                {parsed.kind === "work" ||
                                parsed.kind === "night" ? (
                                  <span className="time">
                                    <span>{parsed.label.split("-")[0]}</span>
                                    <i />
                                    <span>{parsed.label.split("-")[1]}</span>
                                    {parsed.breakMinutes ? (
                                      <small>P{parsed.breakMinutes}</small>
                                    ) : null}
                                  </span>
                                ) : (
                                  <span>{parsed.label}</span>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                      <div className="total-cell">
                        <b>
                          {formatHours(validation?.plannedHours || 0)} /{" "}
                          {formatHours(validation?.monthlyContractHours || 0)}{" "}
                          val.
                        </b>
                        <small
                          className={
                            validation &&
                            Math.abs(validation.monthlyBalanceHours) > 1
                              ? validation.monthlyBalanceHours > 0
                                ? "over"
                                : "under"
                              : "ok"
                          }
                        >
                          {validation
                            ? `${validation.monthlyBalanceHours > 0 ? "+" : ""}${formatHours(validation.monthlyBalanceHours)} val.`
                            : "0 val."}
                        </small>
                        <span
                          className={`status ${validation?.statusClass || "ok"}`}
                        >
                          {validation?.statusLabel || "Be neatitikimų"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {inspectorPanel ? (
        <div
          className="inspector-backdrop"
          role="presentation"
          onClick={() => setInspectorPanel(null)}
        >
          <div
            className="inspector-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="inspector-head">
              <div>
                <span className="eyebrow dark">Grafiko kontrolė</span>
                <h3>
                  {inspectorPanel === "issues"
                    ? "Neatitikimai ir įspėjimai"
                    : inspectorPanel === "summary"
                      ? "Darbo laiko atitikties suvestinė"
                      : inspectorPanel === "training"
                        ? "Mokymų rizikos"
                        : "Veiksmų istorija"}
                </h3>
              </div>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setInspectorPanel(null)}
              >
                <X size={16} /> Uždaryti
              </button>
            </div>

            {inspectorPanel === "issues" ? (
              allIssues.length ? (
                <div className="issues-list modal-list">
                  {allIssues.slice(0, 120).map((issue) => (
                    <div
                      key={issue.id}
                      className={`issue ${issue.severity === "error" ? "bad" : "warn"}`}
                    >
                      <b>{issue.employeeName}</b> · {issue.title}
                      <br />
                      <span>{issue.detail}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Neatitikimų nerasta.</div>
              )
            ) : null}

            {inspectorPanel === "training" ? (
              trainingIssues.length ? (
                <div className="issues-list modal-list">
                  {trainingIssues.slice(0, 120).map((issue) => (
                    <div
                      key={issue.id}
                      className={`issue ${issue.severity === "error" ? "bad" : "warn"}`}
                    >
                      <b>{issue.employeeName}</b> · {issue.title}
                      <br />
                      <span>{issue.detail}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Mokymų rizikų nerasta.</div>
              )
            ) : null}

            {inspectorPanel === "summary" ? (
              <div className="summary-grid modal-summary">
                <div>
                  <span>Pažeidimai</span>
                  <b>{errorCount}</b>
                </div>
                <div>
                  <span>Įspėjimai</span>
                  <b>{warningCount}</b>
                </div>
                <div>
                  <span>Mokymų rizikos</span>
                  <b>{trainingIssueCount}</b>
                </div>
                <div>
                  <span>Rezervacijos</span>
                  <b>{reservationCount}</b>
                </div>
                <div>
                  <span>Didžiausia 7 d. suma</span>
                  <b>{formatHours(maxSeven)} val.</b>
                </div>
                <div>
                  <span>Trumpiausias poilsis</span>
                  <b>{formatHours(shortestRest)} val.</b>
                </div>
                <div>
                  <span>Etatai iš viso</span>
                  <b>{formatHours(totalEmploymentRate)} et.</b>
                </div>
                <div>
                  <span>Planuota / norma</span>
                  <b>
                    {formatHours(totalPlannedHours)} /{" "}
                    {formatHours(totalContractHours)} val.
                  </b>
                </div>
              </div>
            ) : null}

            {inspectorPanel === "history" ? (
              history.length ? (
                <div className="history-list modal-list">
                  {history.slice(0, 60).map((item) => (
                    <div key={item.id} className="history-item">
                      <span>{item.label}</span>
                      <small>{item.at}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Pakeitimų dar nėra.</div>
              )
            ) : null}
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .schedule-module {
          --vg-bg: #f5f7f4;
          --vg-surface: #ffffff;
          --vg-surface-soft: #f8faf7;
          --vg-border: #d7e2da;
          --vg-border-strong: #b9cfc4;
          --vg-text: #14251f;
          --vg-muted: #64756d;
          --vg-green: #047857;
          --vg-green-dark: #065f46;
          --vg-green-soft: #ecfdf5;
          --vg-green-bar: #d9eee5;
          --vg-amber: #d97706;
          --vg-amber-soft: #fff7df;
          --vg-red: #b91c1c;
          --vg-red-soft: #fff1f1;
          --vg-blue: #475987;
          --vg-blue-soft: #eef2ff;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          display: grid;
          gap: 0;
          padding: 10px;
          overflow: hidden;
          background: var(--vg-bg);
          color: var(--vg-text);
        }

        h2,
        h3 {
          margin: 0;
          letter-spacing: -0.03em;
        }

        h2 {
          font-size: 18px;
          line-height: 1.12;
          color: #fff;
        }

        h3 {
          font-size: 15px;
          color: var(--vg-text);
        }

        .eyebrow {
          color: rgba(255, 255, 255, 0.78);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .subtle {
          margin: 2px 0 0;
          color: rgba(255, 255, 255, 0.76);
          font-weight: 650;
          font-size: 12px;
          line-height: 1.28;
        }

        .schedule-toolbar {
          min-width: 0;
          display: grid;
          grid-template-columns: minmax(240px, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 12px 14px;
          background: linear-gradient(135deg, #315f4f 0%, #486b5d 100%);
          border: 1px solid #4f7566;
          border-bottom: 0;
          border-radius: 14px 14px 0 0;
          box-shadow: 0 10px 24px rgba(20, 37, 31, 0.1);
        }

        .toolbar-actions,
        .quick-actions,
        .template-form,
        .template-list,
        .pattern-actions,
        .view-mode-buttons,
        .week-switcher,
        .workbar-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }

        .toolbar-actions {
          justify-content: flex-end;
        }

        .btn,
        .pill,
        .template-pill,
        select,
        input {
          min-width: 0;
          border: 1px solid var(--vg-border-strong);
          border-radius: 7px;
          min-height: 31px;
          padding: 0 10px;
          background: #fff;
          color: var(--vg-text);
          font-weight: 800;
          font-size: 12px;
          outline: none;
        }

        input:focus,
        select:focus {
          border-color: var(--vg-green);
          box-shadow: 0 0 0 2px rgba(4, 120, 87, 0.12);
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          white-space: nowrap;
          transition: 0.15s ease;
        }

        .btn:hover,
        .pill:hover,
        .template-pill:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 12px rgba(20, 37, 31, 0.08);
        }

        .btn.primary {
          background: var(--vg-green);
          border-color: var(--vg-green);
          color: #fff;
        }

        .btn.ghost {
          background: rgba(255, 255, 255, 0.88);
          border-color: rgba(255, 255, 255, 0.35);
          color: #24483c;
        }

        .schedule-toolbar .btn:not(.primary):not(.ghost) {
          background: rgba(255, 255, 255, 0.92);
          border-color: rgba(255, 255, 255, 0.42);
        }

        .btn.danger {
          color: var(--vg-red);
          border-color: #f3c1c1;
          background: var(--vg-red-soft);
        }

        .btn:disabled {
          opacity: 0.54;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .kpi-grid {
          display: flex;
          flex-wrap: wrap;
          align-items: stretch;
          gap: 0;
          background: #f7faf8;
          border-inline: 1px solid var(--vg-border-strong);
          border-bottom: 1px solid var(--vg-border);
          box-shadow: 0 8px 18px rgba(20, 37, 31, 0.06);
        }

        .kpi {
          min-height: 48px;
          text-align: left;
          display: grid;
          grid-template-columns: 24px auto;
          grid-template-rows: auto auto;
          gap: 1px 8px;
          align-content: center;
          align-items: center;
          min-width: 136px;
          flex: 1 1 136px;
          padding: 8px 12px;
          border: 0;
          border-right: 1px solid var(--vg-border);
          border-radius: 0;
          background: #fff;
          cursor: pointer;
          box-shadow: none;
        }

        .kpi svg {
          grid-row: span 2;
          width: 18px;
          height: 18px;
          color: var(--vg-green);
        }

        .kpi b {
          font-size: 20px;
          line-height: 1;
          color: var(--vg-text);
        }

        .kpi span {
          min-width: 0;
          color: var(--vg-muted);
          font-weight: 800;
          font-size: 11px;
        }

        .kpi.bad {
          background: #fffafa;
        }

        .kpi.bad svg,
        .kpi.bad b {
          color: var(--vg-red);
        }

        .kpi.warn {
          background: #fffdf6;
        }

        .kpi.warn svg,
        .kpi.warn b {
          color: var(--vg-amber);
        }

        .kpi.active {
          background: var(--vg-green-soft);
          box-shadow: inset 0 -2px 0 var(--vg-green);
        }

        .planning-workbar {
          position: sticky;
          top: 0;
          z-index: 45;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
          border-inline: 1px solid var(--vg-border-strong);
          border-bottom: 1px solid var(--vg-border-strong);
          background: #eef6f1;
          padding: 8px 10px;
          box-shadow: 0 10px 22px rgba(20, 37, 31, 0.08);
        }

        .label {
          color: #46645a;
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .pill {
          min-height: 28px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          background: #fff;
          border-color: #c8dbd2;
          color: #24483c;
        }

        .compact-help {
          display: flex;
          align-items: center;
          gap: 8px;
          border-inline: 1px solid var(--vg-border-strong);
          border-bottom: 1px solid var(--vg-border);
          background: #fbfcfb;
          padding: 7px 11px;
          color: var(--vg-muted);
          font-size: 12px;
          font-weight: 750;
        }

        .compact-help span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 999px;
          background: var(--vg-green-soft);
          color: var(--vg-green);
          font-weight: 950;
        }

        .panel,
        .notice,
        .visible-count {
          min-width: 0;
          background: var(--vg-surface);
          border: 1px solid var(--vg-border);
          border-radius: 10px;
          box-shadow: 0 8px 18px rgba(20, 37, 31, 0.05);
        }

        .panel {
          padding: 12px;
        }

        .tool-drawer {
          border-radius: 0;
          border-top: 0;
          border-inline-color: var(--vg-border-strong);
          background: linear-gradient(180deg, #ffffff 0%, #f7faf8 100%);
        }

        .controls-panel,
        .templates-panel,
        .pattern-panel {
          display: grid;
          grid-template-columns: minmax(220px, 0.78fr) minmax(0, 1.22fr);
          gap: 12px;
          align-items: center;
        }

        .bulk-panel {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) minmax(420px, 720px);
          gap: 12px;
          align-items: center;
        }

        .bulk-actions {
          display: grid;
          grid-template-columns:
            minmax(170px, 1fr) minmax(170px, 1fr)
            132px 132px;
          gap: 7px;
          align-items: center;
          justify-self: end;
          width: min(720px, 100%);
        }

        .bulk-actions .danger {
          grid-column: 1 / span 2;
        }

        .bulk-actions .ghost {
          grid-column: 3 / span 2;
        }

        .bulk-control,
        .date-control {
          width: 100%;
        }

        .template-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 29px;
          background: var(--vg-green-soft);
          color: var(--vg-green-dark);
          border-color: #b9e0ce;
          cursor: pointer;
        }

        .employment-chip,
        .checkline {
          min-height: 31px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 0 10px;
          border: 1px solid var(--vg-border);
          background: #f7faf8;
          color: #315446;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .checkline input {
          min-height: auto;
          padding: 0;
        }

        .pattern-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(86px, 1fr));
          gap: 7px;
        }

        .pattern-grid label {
          display: grid;
          gap: 4px;
          font-weight: 900;
          color: var(--vg-muted);
          font-size: 11px;
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
          padding: 9px 11px;
          color: var(--vg-green-dark);
          font-weight: 850;
          border-radius: 0;
          border-top: 0;
          border-inline-color: var(--vg-border-strong);
        }

        .visible-filter-bar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
          border-inline: 1px solid var(--vg-border-strong);
          border-bottom: 1px solid var(--vg-border);
          background: #fff;
          padding: 8px 10px;
        }

        .department-filter,
        .search-filter {
          max-width: 220px;
        }

        .visible-count {
          padding: 8px 10px;
          font-weight: 850;
          font-size: 12px;
          color: var(--vg-muted);
          border: 0;
          box-shadow: none;
        }

        .schedule-view-bar {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
          padding: 8px 10px;
          background: #f7faf8;
          border-inline: 1px solid var(--vg-border-strong);
          border-bottom: 1px solid var(--vg-border-strong);
          box-shadow: none;
          border-radius: 0;
          position: sticky;
          top: 48px;
          z-index: 40;
        }

        .week-switcher {
          justify-content: center;
        }

        .week-switcher strong {
          min-width: 190px;
          text-align: center;
          color: var(--vg-text);
          font-weight: 900;
          font-size: 12px;
        }

        .view-help {
          color: var(--vg-muted);
          font-size: 12px;
          font-weight: 780;
          text-align: center;
        }

        .quick-entry-strip {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 10px;
          border: 1px solid var(--border);
          border-top: 0;
          background: #f7faf8;
          min-width: 0;
          overflow-x: auto;
        }

        .quick-entry-strip .label {
          flex: 0 0 auto;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .quick-hint {
          margin-left: auto;
          color: var(--muted);
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .employee-head {
          display: grid !important;
          grid-template-columns: 1fr;
          gap: 5px;
          align-content: start;
          padding: 7px !important;
          text-align: left !important;
        }

        .employee-head-title {
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .employee-head-search,
        .employee-head-select {
          width: 100%;
          min-width: 0;
          border: 1px solid #c8ded5;
          border-radius: 7px;
          background: #fff;
          padding: 5px 7px;
          color: #18342d;
          font-size: 11px;
          font-weight: 750;
          outline: none;
        }

        .employee-head-search:focus,
        .employee-head-select:focus {
          border-color: var(--moss);
          box-shadow: 0 0 0 2px rgba(72, 107, 93, 0.12);
        }

        .grid-shell {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          max-height: 74vh;
          overflow: auto;
          overscroll-behavior-x: contain;
          border-inline: 1px solid var(--vg-border-strong);
          border-bottom: 1px solid var(--vg-border-strong);
          border-top: 0;
          border-radius: 0 0 12px 12px;
          background: #fff;
          box-shadow: 0 12px 28px rgba(20, 37, 31, 0.08);
          padding-bottom: 8px;
        }

        .grid-shell::-webkit-scrollbar {
          height: 12px;
          width: 12px;
        }

        .grid-shell::-webkit-scrollbar-track {
          background: #edf2ef;
        }

        .grid-shell::-webkit-scrollbar-thumb {
          background: #9eb9ad;
          border-radius: 999px;
          border: 2px solid #edf2ef;
        }

        .schedule-grid {
          display: grid;
          width: max-content;
          min-width: 100%;
          border-top: 1px solid var(--vg-border-strong);
          background: #fff;
        }

        .row-fragment {
          display: contents;
        }

        .head {
          position: sticky;
          top: 0;
          z-index: 24;
          min-height: 42px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border-right: 1px solid var(--vg-border);
          border-bottom: 1px solid var(--vg-border-strong);
          background: #d9eee5;
          color: #28483e;
          font-size: 11px;
          font-weight: 900;
          text-align: center;
          box-shadow: inset 0 -1px 0 rgba(20, 37, 31, 0.08);
        }

        .head b {
          font-size: 14px;
          line-height: 1;
        }

        .head small {
          margin-top: 2px;
          color: #567168;
          font-size: 10px;
          font-weight: 800;
          text-transform: lowercase;
        }

        .head em {
          margin-top: 1px;
          font-style: normal;
          font-size: 9px;
          color: var(--vg-amber);
        }

        .head.weekend {
          background: #f3e8df;
          color: #7b4f3a;
        }

        .head.holiday,
        .head.preholiday {
          background: #f4edd3;
          color: #805c13;
        }

        .sticky-left {
          position: sticky;
          left: 0;
          z-index: 18;
          background: #fff;
          box-shadow:
            1px 0 0 var(--vg-border-strong),
            12px 0 24px rgba(20, 37, 31, 0.04);
        }

        .head.sticky-left {
          z-index: 36;
          background: #d8e2dc;
          align-items: flex-start;
          padding-left: 10px;
        }

        .person {
          min-height: 58px;
          display: grid;
          align-content: center;
          gap: 2px;
          padding: 7px 9px;
          border-right: 1px solid var(--vg-border-strong);
          border-bottom: 1px solid var(--vg-border);
          background: #f7f8f7;
        }

        .person b {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--vg-text);
          font-size: 12px;
          font-weight: 900;
        }

        .person span {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--vg-muted);
          font-size: 10px;
          font-weight: 700;
        }

        .person-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: center;
          margin-top: 3px;
        }

        .person-meta em {
          display: inline-flex;
          align-items: center;
          min-height: 17px;
          padding: 0 5px;
          border-radius: 999px;
          background: #fff;
          border: 1px solid var(--vg-border);
          color: #3e5f54;
          font-size: 9px;
          font-style: normal;
          font-weight: 850;
        }

        .person-meta em.bad {
          color: var(--vg-red);
          background: var(--vg-red-soft);
          border-color: #f1bcbc;
        }

        .person-meta em.warn {
          color: var(--vg-amber);
          background: var(--vg-amber-soft);
          border-color: #ecd19a;
        }

        .day-cell {
          position: relative;
          z-index: 1;
          min-height: 58px;
          padding: 4px;
          border-right: 1px solid #dbe7e0;
          border-bottom: 1px solid var(--vg-border);
          background: #fff;
        }

        .day-cell.weekend {
          background: #fbf4f1;
        }

        .day-cell.holiday {
          background: #faf4df;
        }

        .day-cell.reserved {
          background-image: repeating-linear-gradient(
            135deg,
            rgba(100, 116, 139, 0.08) 0,
            rgba(100, 116, 139, 0.08) 6px,
            transparent 6px,
            transparent 12px
          );
        }

        .day-cell.cell-error {
          box-shadow: inset 0 0 0 2px rgba(185, 28, 28, 0.28);
        }

        .day-cell.cell-warning {
          box-shadow: inset 0 0 0 2px rgba(217, 119, 6, 0.24);
        }

        .person.active-row,
        .day-cell.active-row {
          background: #eef8f3;
        }

        .head.active-col,
        .day-cell.active-col {
          background: #eef6f1;
        }

        .day-cell.active-cell {
          outline: 2px solid var(--vg-green);
          outline-offset: -2px;
          z-index: 6;
        }

        .shift {
          position: relative;
          width: 100%;
          height: 49px;
          border: 1px solid #d6e3dc;
          border-left-width: 4px;
          border-radius: 5px;
          display: grid;
          place-items: center;
          background: #fff;
          color: var(--vg-muted);
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          text-align: center;
          touch-action: manipulation;
          box-shadow: inset 0 -1px 0 rgba(20, 37, 31, 0.04);
        }

        .shift:hover {
          filter: brightness(0.985);
          box-shadow: 0 8px 18px rgba(20, 37, 31, 0.1);
        }

        .shift-empty {
          border-left-color: transparent;
          border-style: dashed;
          color: #b3bfb9;
          background: transparent;
        }

        .shift-work {
          background: #f5f0de;
          border-color: #dbc27e;
          border-left-color: #d4a72c;
          color: #5f4308;
        }

        .shift-night {
          background: #eef1f7;
          border-color: #c6cfdf;
          border-left-color: #61718f;
          color: #31415c;
        }

        .shift-off {
          background: #f3f5f4;
          border-color: #d7dfda;
          border-left-color: #94a3b8;
          color: #64748b;
        }

        .shift-vacation,
        .shift-shortLeave {
          background: #f8f1f3;
          border-color: #e3c1cb;
          border-left-color: #b47a89;
          color: #75384a;
        }

        .shift-sick {
          background: #fff1f1;
          border-color: #e9b9b9;
          border-left-color: #b75c5c;
          color: #7f2626;
        }

        .shift-reserved {
          background: #f2eff7;
          border-color: #cec4dc;
          border-left-color: #77638e;
          color: #554369;
        }

        .shift-danger {
          box-shadow: inset 0 0 0 1px rgba(185, 28, 28, 0.38);
        }

        .shift-warning {
          box-shadow: inset 0 0 0 1px rgba(217, 119, 6, 0.35);
        }

        .shift-duty {
          background: #f3eef1;
          border-color: #c9a7b0;
          border-left-color: #9b5f6b;
          color: #5f2634;
        }

        .time {
          display: grid;
          justify-items: center;
          gap: 0;
          font-size: 9px;
          line-height: 1.03;
        }

        .time i {
          display: block;
          width: 18px;
          height: 1px;
          margin: 2px 0;
          background: currentColor;
          opacity: 0.35;
        }

        .time small {
          margin-top: 2px;
          font-size: 8px;
          opacity: 0.78;
        }

        .badge {
          position: absolute;
          top: 2px;
          right: 2px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          color: #fff;
          font-size: 8px;
          font-weight: 950;
        }

        .badge.reservation {
          background: #77638e;
        }

        .badge.training {
          background: var(--vg-red);
          right: 18px;
        }

        .cell-input {
          width: 100%;
          height: 49px;
          border-radius: 5px;
          text-align: center;
          font-weight: 900;
          font-size: 12px;
          border: 2px solid var(--vg-green);
          box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.12);
        }

        .total-head {
          right: 0;
          z-index: 22;
          background: #d8e2dc;
        }

        .total-cell {
          min-height: 58px;
          display: grid;
          align-content: center;
          gap: 2px;
          padding: 6px 8px;
          border-bottom: 1px solid var(--vg-border);
          background: #fbfcfb;
          color: var(--vg-text);
          font-size: 11px;
        }

        .total-cell b {
          font-size: 11px;
          white-space: nowrap;
        }

        .total-cell small {
          font-weight: 900;
          font-size: 10px;
        }

        .total-cell small.over {
          color: var(--vg-red);
        }

        .total-cell small.under {
          color: var(--vg-amber);
        }

        .total-cell small.ok {
          color: var(--vg-green-dark);
        }

        .status {
          display: inline-flex;
          width: max-content;
          max-width: 100%;
          min-height: 17px;
          align-items: center;
          border-radius: 999px;
          padding: 0 6px;
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .status.ok {
          background: var(--vg-green-soft);
          color: var(--vg-green-dark);
        }

        .status.warn {
          background: var(--vg-amber-soft);
          color: #8a5a13;
        }

        .status.bad {
          background: var(--vg-red-soft);
          color: var(--vg-red);
        }

        .bottom-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr) minmax(
              0,
              0.9fr
            );
          gap: 10px;
          margin-top: 10px;
        }

        .panel-title {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 9px;
          color: var(--vg-text);
          font-weight: 950;
          font-size: 13px;
        }

        .issues-list,
        .history-list {
          display: grid;
          gap: 7px;
          max-height: 250px;
          overflow: auto;
          padding-right: 3px;
        }

        .issue,
        .history-item,
        .empty-state {
          border: 1px solid var(--vg-border);
          border-radius: 8px;
          background: #f8faf7;
          padding: 9px;
          color: var(--vg-muted);
          font-size: 12px;
          font-weight: 750;
        }

        .issue b {
          color: var(--vg-text);
        }

        .issue span {
          color: var(--vg-muted);
        }

        .issue.bad {
          background: var(--vg-red-soft);
          border-color: #efc0bd;
        }

        .issue.warn {
          background: var(--vg-amber-soft);
          border-color: #ead8a7;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 7px;
        }

        .summary-grid div {
          border: 1px solid var(--vg-border);
          border-radius: 8px;
          background: #f8faf7;
          padding: 9px;
        }

        .summary-grid span {
          display: block;
          color: var(--vg-muted);
          font-size: 10px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .summary-grid b {
          display: block;
          margin-top: 3px;
          color: var(--vg-text);
          font-size: 16px;
        }

        .history-item {
          display: grid;
          gap: 3px;
        }

        .history-item span {
          color: var(--vg-text);
          font-weight: 850;
        }

        .history-item small {
          color: var(--vg-muted);
        }

        .validation-banner {
          display: grid;
          gap: 6px;
          margin: 8px 0;
        }

        .schedule-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          border-inline: 1px solid var(--vg-border-strong);
          border-bottom: 1px solid var(--vg-border-strong);
          background: #f7faf8;
          padding: 8px 10px;
          color: var(--vg-muted);
          font-size: 12px;
          font-weight: 800;
        }

        .legend-dot {
          display: inline-flex;
          width: 10px;
          height: 10px;
          border-radius: 3px;
          margin-right: 4px;
          vertical-align: -1px;
          background: currentColor;
        }

        .legend-dot.work {
          color: #d4a72c;
        }
        .legend-dot.night {
          color: #61718f;
        }
        .legend-dot.off {
          color: #94a3b8;
        }
        .legend-dot.vacation {
          color: #b47a89;
        }
        .legend-dot.sick {
          color: #b75c5c;
        }

        .large-grid-shell {
          max-height: calc(94vh - 92px);
          border-radius: 12px;
        }

        .large-schedule-grid .head {
          min-height: 40px;
        }

        .large-schedule-grid .person,
        .large-schedule-grid .day-cell,
        .large-schedule-grid .total-cell {
          min-height: 56px;
        }

        .large-schedule-grid .shift,
        .large-schedule-grid .cell-input {
          height: 47px;
        }

        @media (max-width: 1100px) {
          .schedule-toolbar,
          .planning-workbar,
          .visible-filter-bar,
          .schedule-view-bar {
            grid-template-columns: 1fr;
          }

          .toolbar-actions,
          .workbar-actions {
            justify-content: flex-start;
          }

          .bottom-grid {
            grid-template-columns: 1fr;
          }

          .controls-panel,
          .templates-panel,
          .pattern-panel,
          .bulk-panel {
            grid-template-columns: 1fr;
          }

          .bulk-actions {
            grid-template-columns: 1fr;
            justify-self: stretch;
          }

          .bulk-actions .danger,
          .bulk-actions .ghost {
            grid-column: auto;
          }
        }

        @media (max-width: 760px) {
          .schedule-module {
            padding: 8px;
          }

          .kpi {
            flex-basis: 50%;
          }

          .pattern-grid {
            grid-template-columns: 1fr;
          }

          .view-help {
            text-align: left;
          }
        }

        /* Enterprise scheduling matrix override: closer to the HTML preview, while keeping save/publish logic untouched */
        .schedule-module {
          --vg-bg: #edf2ee;
          --vg-surface: #fff;
          --vg-surface-soft: #f6f8f5;
          --vg-border: #c6d6ce;
          --vg-border-strong: #93b2a4;
          --vg-text: #18342d;
          --vg-muted: #65756e;
          --vg-green: #486b5d;
          --vg-green-dark: #315746;
          --vg-green-soft: #e7f0ec;
          --vg-green-bar: #d9e7e0;
          padding: 0;
          gap: 0;
          background: transparent;
          border: 1px solid var(--vg-border);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 10px 24px rgba(28, 52, 43, 0.08);
        }

        .schedule-toolbar {
          border-radius: 0;
          border: 0;
          border-bottom: 1px solid #5f8374;
          padding: 10px 14px;
          background: linear-gradient(135deg, #315746 0%, #486b5d 100%);
        }

        .schedule-toolbar h2 {
          font-size: 17px;
        }
        .schedule-toolbar .subtle {
          max-width: 620px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.8);
        }
        .toolbar-actions {
          gap: 6px;
        }
        .toolbar-actions .btn {
          height: 30px;
          border-radius: 6px;
          padding: 0 10px;
          font-size: 11px;
          border-color: rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.9);
          color: #18342d;
        }
        .toolbar-actions .btn.primary {
          background: #6f8f7f;
          color: #fff;
          border-color: #6f8f7f;
        }
        .toolbar-actions .btn:disabled {
          opacity: 0.65;
        }

        .kpi-grid {
          grid-template-columns: repeat(6, minmax(120px, 1fr));
          gap: 0;
          border-left: 0;
          border-right: 0;
          border-bottom: 1px solid var(--vg-border);
          background: #f7faf8;
        }
        .kpi {
          min-height: 48px;
          border: 0;
          border-right: 1px solid var(--vg-border);
          border-radius: 0;
          padding: 8px 12px;
          background: #f7faf8;
          box-shadow: none;
          display: grid;
          grid-template-columns: 18px auto;
          align-items: center;
          column-gap: 8px;
        }
        .kpi svg {
          width: 16px;
          height: 16px;
          color: #486b5d;
        }
        .kpi b {
          font-size: 18px;
          line-height: 1;
          color: #18342d;
        }
        .kpi span {
          grid-column: 2;
          margin: 0;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #65756e;
        }
        .kpi.warn b {
          color: #b7791f;
        }
        .kpi.bad b {
          color: #b91c1c;
        }
        .kpi.active {
          background: #e7f0ec;
          box-shadow: inset 0 -2px 0 #486b5d;
        }

        .planning-workbar {
          border-left: 0;
          border-right: 0;
          border-bottom: 1px solid var(--vg-border);
          border-radius: 0;
          padding: 7px 12px;
          background: #eef5f1;
        }
        .compact-actions .label {
          font-size: 10px;
          letter-spacing: 0.08em;
          color: #486b5d;
        }
        .pill {
          height: 24px;
          min-width: 32px;
          border-radius: 5px;
          padding: 0 8px;
          border-color: #c6d6ce;
          background: #fff;
          font-size: 11px;
          color: #18342d;
        }
        .workbar-actions .btn {
          height: 28px;
          border-radius: 6px;
          font-size: 11px;
          padding: 0 10px;
        }
        .compact-help {
          border-left: 0;
          border-right: 0;
          border-bottom: 1px solid var(--vg-border);
          border-radius: 0;
          padding: 6px 12px;
          background: #fbfcfa;
          font-size: 11px;
        }

        .visible-filter-bar {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 280px 220px;
          gap: 10px;
          align-items: end;
          border: 0;
          border-bottom: 1px solid var(--vg-border);
          border-radius: 0;
          padding: 10px 12px;
          background: #fff;
        }
        .visible-count {
          font-size: 11px;
          color: #486b5d;
        }
        .search-filter span,
        .department-filter span {
          font-size: 10px;
          letter-spacing: 0.08em;
          color: #65756e;
        }
        .search-filter input,
        .department-filter select {
          height: 30px;
          border-radius: 6px;
          font-size: 11px;
        }

        .schedule-view-bar {
          border: 0;
          border-bottom: 1px solid var(--vg-border);
          border-radius: 0;
          padding: 7px 12px;
          background: #f7faf8;
        }
        .schedule-view-bar .btn {
          height: 27px;
          border-radius: 6px;
          font-size: 11px;
        }
        .validation-banner {
          border-left: 0;
          border-right: 0;
          border-radius: 0;
          margin: 0;
          padding: 9px 12px;
          box-shadow: none;
        }
        .schedule-legend {
          border: 0;
          border-bottom: 1px solid var(--vg-border);
          border-radius: 0;
          padding: 6px 12px;
          background: #fbfcfa;
          font-size: 11px;
        }

        .grid-shell {
          border: 0;
          border-radius: 0;
          background: #fff;
          max-height: 72vh;
        }
        .schedule-grid {
          min-width: max-content;
          border-radius: 0;
          background: #fff;
        }
        .coverage-head {
          position: sticky;
          left: 0;
          z-index: 44;
          height: 92px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 2px;
          padding: 10px;
          border-right: 1px solid var(--vg-border-strong);
          border-bottom: 1px solid var(--vg-border-strong);
          background: #d8e2dc;
          color: #18342d;
          font-size: 12px;
        }
        .coverage-head span {
          font-size: 10px;
          color: #65756e;
          font-weight: 700;
        }
        .coverage-cell {
          position: relative;
          height: 92px;
          border-right: 1px solid #c6d6ce;
          border-bottom: 1px solid var(--vg-border-strong);
          background: linear-gradient(to bottom, #dce7e2, #f7faf8);
          overflow: hidden;
        }
        .coverage-cell.weekend {
          background: linear-gradient(to bottom, #eadfd7, #f8f4f2);
        }
        .coverage-cell.holiday {
          background: linear-gradient(to bottom, #eee5c9, #f6f3e8);
        }
        .coverage-bar {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            to bottom,
            rgba(111, 143, 127, 0.75),
            rgba(72, 107, 93, 0.38)
          );
        }
        .coverage-cell small {
          position: absolute;
          left: 50%;
          bottom: 15px;
          transform: translateX(-50%);
          z-index: 2;
          display: block;
          min-width: 0;
          padding: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          font-size: 11px;
          line-height: 1;
          font-weight: 950;
          color: #17352c;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
          opacity: 1;
        }
        .coverage-total {
          height: 92px;
          display: grid;
          place-items: center;
          border-bottom: 1px solid var(--vg-border-strong);
          background: #d8e2dc;
          font-size: 10px;
          font-weight: 900;
          color: #486b5d;
          text-transform: uppercase;
        }

        .head {
          position: sticky;
          top: 0;
          z-index: 30;
          min-height: 34px;
          height: 34px;
          border-right: 1px solid var(--vg-border);
          border-bottom: 1px solid var(--vg-border-strong);
          border-radius: 0;
          background: #b8cdc5;
          padding: 4px 2px;
          color: #18342d;
          box-shadow: none;
        }
        .head.sticky-left {
          z-index: 45;
          background: #d8e2dc;
          text-align: left;
          padding-left: 10px;
        }
        .head.weekend {
          background: #eadfd7;
          color: #6e4a42;
        }
        .head.holiday,
        .head.preholiday {
          background: #eee5c9;
          color: #725c22;
        }
        .head b {
          font-size: 13px;
        }
        .head small {
          font-size: 9px;
          font-weight: 800;
        }
        .head em {
          display: none;
        }
        .person {
          min-height: 62px;
          border-right: 1px solid var(--vg-border-strong);
          border-bottom: 1px solid var(--vg-border);
          border-radius: 0;
          padding: 8px 8px;
          background: #f7f8f7;
          box-shadow: none;
        }
        .person:nth-of-type(odd) {
          background: #fff;
        }
        .person b {
          font-size: 12px;
        }
        .person span {
          font-size: 10px;
        }
        .person-meta {
          margin-top: 6px;
          gap: 4px;
        }
        .person-meta em {
          font-size: 9px;
          padding: 1px 5px;
          border-radius: 999px;
        }
        .day-cell {
          min-height: 62px;
          height: 62px;
          border-right: 1px solid #d4e5df;
          border-bottom: 1px solid var(--vg-border);
          border-radius: 0;
          padding: 2px;
          background: #fff;
          box-shadow: none;
        }
        .day-cell.weekend {
          background: #f8f4f2;
        }
        .day-cell.holiday {
          background: #f6f3e8;
        }
        .day-cell.active-row,
        .person.active-row {
          background-color: #eef5f1;
        }
        .day-cell.active-col {
          box-shadow: inset 0 0 0 9999px rgba(72, 107, 93, 0.04);
        }
        .day-cell.active-cell {
          box-shadow: inset 0 0 0 2px #486b5d;
        }
        .shift {
          width: 100%;
          min-height: 25px;
          height: auto;
          border-radius: 3px;
          border: 0;
          padding: 2px 1px;
          background: transparent;
          color: #94a3a0;
          font-size: 10px;
          box-shadow: none;
        }
        .shift-empty {
          color: #b9c7c1;
          border: 1px dashed #dbe6e1;
          background: rgba(255, 255, 255, 0.45);
        }
        .shift-work {
          background: #d4b15d;
          color: #523b0c;
          font-weight: 900;
        }
        .shift-night {
          background: #71809c;
          color: #fff;
          font-weight: 900;
        }
        .shift-off {
          background: #eef3f1;
          color: #64756d;
          font-weight: 900;
        }
        .shift-vacation,
        .shift-shortLeave {
          background: #d6b7be;
          color: #613846;
          font-weight: 900;
        }
        .shift-sick,
        .shift-duty,
        .shift-danger {
          background: #9b5f6b;
          color: #fff;
          font-weight: 900;
        }
        .shift-warning {
          box-shadow: inset 0 0 0 2px rgba(217, 119, 6, 0.55);
        }
        .shift .time {
          gap: 1px;
          line-height: 1.05;
        }
        .shift .time i {
          display: none;
        }
        .shift .time small {
          font-size: 8px;
          padding: 0;
          background: transparent;
        }
        .cell-input {
          height: 28px;
          border-radius: 3px;
          font-size: 10px;
          padding: 2px;
        }
        .total-cell {
          min-height: 62px;
          border-bottom: 1px solid var(--vg-border);
          border-radius: 0;
          padding: 6px;
          background: #f7faf8;
          box-shadow: none;
        }
        .total-cell b {
          font-size: 11px;
        }
        .total-cell small,
        .status {
          font-size: 9px;
        }
        .bottom-grid {
          display: grid;
          grid-template-columns: 1.3fr 1.1fr 1fr;
          gap: 8px;
          padding: 10px;
          background: #edf2ee;
        }
        .panel {
          border-radius: 8px;
          box-shadow: none;
          border-color: var(--vg-border);
        }

        .inspector-modal .issues-list {
          display: grid;
          gap: 10px;
        }
        .inspector-modal .issue {
          position: relative;
          padding: 12px 14px 12px 44px;
          border-radius: 12px;
          font-size: 12px;
          line-height: 1.45;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
        }
        .inspector-modal .issue::before {
          content: "!";
          position: absolute;
          left: 13px;
          top: 13px;
          display: grid;
          width: 22px;
          height: 22px;
          place-items: center;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.7);
          color: inherit;
          font-weight: 950;
        }
        .inspector-modal .issue b {
          color: var(--vg-text);
        }
        .inspector-modal .issue span {
          color: #52645c;
          font-weight: 700;
        }
        .inspector-head .btn {
          min-height: 34px;
          border-radius: 10px;
          background: #fff;
        }
        @media (max-width: 900px) {
          .schedule-toolbar,
          .visible-filter-bar {
            grid-template-columns: 1fr;
          }
          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .bottom-grid {
            grid-template-columns: 1fr;
          }
        }

        /* v3 layout fixes: reduce crowding, make modules usable, move bottom analysis into popup */
        .planning-workbar {
          grid-template-columns: minmax(220px, 340px) 1fr;
          padding: 7px 10px;
          gap: 12px;
        }
        .module-employee-picker {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .module-employee-picker select {
          width: min(230px, 100%);
        }
        .tool-drawer {
          position: relative;
          z-index: 40;
          padding: 14px;
          border-bottom: 1px solid var(--vg-border-strong);
        }
        .tool-drawer .subtle {
          color: var(--vg-muted);
        }
        .drawer-field {
          display: grid;
          gap: 4px;
          margin-top: 10px;
          color: var(--vg-muted);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .quick-entry-strip {
          border-inline: 1px solid var(--vg-border-strong);
          border-bottom: 1px solid var(--vg-border-strong);
          padding: 7px 10px;
          background: #f7faf8;
        }
        .quick-entry-strip .quick-hint {
          display: none;
        }
        .schedule-legend {
          border-inline: 1px solid var(--vg-border-strong);
          border-bottom: 0;
          padding: 7px 10px;
          background: #fbfcfa;
        }
        .grid-shell {
          max-height: 72vh;
          overflow: auto;
          border-top: 0;
        }
        .coverage-head,
        .coverage-cell,
        .coverage-total {
          height: 78px;
        }
        .head {
          top: 78px;
          min-height: 38px;
          height: 38px;
        }
        .head.sticky-left.employee-head {
          top: 78px;
          height: 78px;
          min-height: 78px;
          display: grid !important;
          grid-template-columns: 1fr;
          grid-auto-rows: max-content;
          align-content: center;
          gap: 5px;
          padding: 8px 9px !important;
        }
        .employee-head-title {
          font-size: 12px;
          line-height: 1;
        }
        .employee-head-search,
        .employee-head-select {
          height: 28px;
          min-height: 28px;
          padding: 3px 7px;
          font-size: 11px;
        }
        .person,
        .day-cell,
        .total-cell {
          min-height: 66px;
        }
        .bottom-grid {
          display: none;
        }
        .kpi {
          cursor: pointer;
        }
        .validation-banner {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 9px;
          border: 0;
          border-inline: 1px solid var(--vg-border-strong);
          border-bottom: 1px solid var(--vg-border);
          margin: 0;
          padding: 10px 12px;
          background: #fffaf0;
          color: #7b4f13;
          text-align: left;
          cursor: pointer;
        }
        .validation-banner.bad {
          background: #fff1f1;
          color: var(--vg-red);
        }
        .validation-banner b,
        .validation-banner span {
          display: inline;
        }
        .inspector-backdrop {
          position: fixed;
          inset: 0;
          z-index: 999;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(15, 23, 42, 0.34);
          backdrop-filter: blur(4px);
        }
        .inspector-modal {
          width: min(760px, 100%);
          max-height: min(78vh, 720px);
          overflow: hidden;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          gap: 0;
          border: 1px solid rgba(185, 207, 196, 0.95);
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 30px 90px rgba(20, 37, 31, 0.28);
        }
        .inspector-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 18px 20px 16px;
          border-bottom: 1px solid var(--vg-border);
          background: linear-gradient(135deg, #fbfcfa, #f1f6f3);
        }
        .eyebrow.dark {
          color: var(--vg-muted);
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .inspector-head h3 {
          margin-top: 2px;
          font-size: 18px;
        }
        .modal-list {
          max-height: none;
          overflow: auto;
          padding: 14px 16px 16px;
        }
        .modal-summary {
          padding: 16px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          overflow: auto;
        }

        /* v5: softer program colors and clear 24 h split visualisation */
        .schedule-module {
          --vg-bg: #f2f5f1;
          --vg-surface-soft: #fafbf8;
          --vg-border: #d8e2da;
          --vg-border-strong: #afc4b8;
          --vg-green: #4f6f60;
          --vg-green-dark: #2f5747;
          --vg-green-soft: #edf3ef;
          --vg-amber: #b98934;
          --vg-amber-soft: #fbf3dc;
          --vg-red: #9b4d55;
          --vg-red-soft: #fbefef;
          --vg-blue: #687693;
          --vg-blue-soft: #f1f3f8;
        }
        .schedule-toolbar {
          background: linear-gradient(135deg, #385f50 0%, #4f6f60 100%);
          border-bottom-color: #6f8b7e;
        }
        .toolbar-actions .btn.primary {
          background: #5f806f;
          border-color: #5f806f;
        }
        .kpi.active {
          background: #edf3ef;
          box-shadow: inset 0 -2px 0 #4f6f60;
        }
        .coverage-head,
        .coverage-total,
        .head.sticky-left.employee-head {
          background: #e0e9e3;
        }
        .coverage-cell {
          background: linear-gradient(to bottom, #e6eee9, #fbfcfa);
        }
        .coverage-bar {
          background: linear-gradient(
            to bottom,
            rgba(95, 128, 111, 0.66),
            rgba(79, 111, 96, 0.3)
          );
        }
        .coverage-cell small {
          bottom: 16px;
          min-width: 0;
          min-height: 0;
          background: transparent;
          box-shadow: none;
          color: #18342d;
          font-size: 11px;
        }
        .head {
          background: #c9d8d0;
        }
        .head.weekend {
          background: #eadfd8;
          color: #694c42;
        }
        .head.holiday,
        .head.preholiday {
          background: #efe6cf;
          color: #6d5623;
        }
        .day-cell.weekend {
          background: #faf6f3;
        }
        .day-cell.holiday {
          background: #f8f3e4;
        }
        .shift-work {
          background: #d9b84d;
          color: #49370b;
        }
        .shift-night {
          background: #52618a;
          color: #fff;
        }
        .shift-vacation,
        .shift-shortLeave {
          background: #d5b0bd;
          color: #563240;
        }
        .shift-sick,
        .shift-danger {
          background: #a84f5a;
          color: #fff;
        }
        .shift-duty {
          background: #6f4f7f;
          color: #fff;
        }
        .day-cell.split-start {
          box-shadow: inset -3px 0 0 rgba(111, 79, 127, 0.52);
        }
        .day-cell.split-continuation {
          box-shadow: inset 3px 0 0 rgba(111, 79, 127, 0.52);
          background-image: linear-gradient(
            90deg,
            rgba(111, 79, 127, 0.12),
            rgba(255, 255, 255, 0)
          );
        }
        .shift-split-continuation {
          opacity: 0.96;
          background: #7b6b90;
          color: #fff;
          border-left: 3px solid #5d4c72;
        }

        @media (max-width: 900px) {
          .planning-workbar {
            grid-template-columns: 1fr;
          }
          .module-employee-picker {
            align-items: stretch;
            flex-direction: column;
          }
          .module-employee-picker select {
            width: 100%;
          }
          .modal-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </section>
  );
}
