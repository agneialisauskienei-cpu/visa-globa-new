"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  GripVertical,
  HelpCircle,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Status = "attended" | "absent" | "refused" | "not_applicable";
type AttendanceFilter = "all" | "unmarked" | Status;
type ViewMode = "day" | "week" | "month";

type Activity = {
  id: string;
  organization_id: string;
  title: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
};

type Resident = {
  id: string;
  resident_code: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  display_name?: string | null;
  first_name_encrypted: string | null;
  last_name_encrypted: string | null;
  current_room_id: string | null;
  current_status: string | null;
  is_active: boolean | null;
};

type Room = {
  id: string;
  name: string | null;
};

type Attendance = {
  id?: string;
  session_id: string;
  resident_id: string;
  status: Status;
  note?: string | null;
};

type ActivityForm = {
  title: string;
  session_date: string;
  start_time: string;
  end_time: string;
  notes: string;
};

type StatusOption = {
  value: Status;
  short: string;
  label: string;
  chipClass: string;
  cellClass: string;
};

const ATTENDANCE_FILTER_OPTIONS: Array<{ value: AttendanceFilter; label: string }> = [
  { value: "all", label: "Visi" },
  { value: "unmarked", label: "Nepažymėti" },
  { value: "attended", label: "Dalyvavo" },
  { value: "absent", label: "Nedalyvavo" },
  { value: "refused", label: "Atsisakė" },
  { value: "not_applicable", label: "Netaikoma" },
];

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "attended",
    short: "D",
    label: "Dalyvavo",
    chipClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
    cellClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    value: "absent",
    short: "N",
    label: "Nedalyvavo",
    chipClass: "border-slate-200 bg-slate-100 text-slate-700",
    cellClass: "border-slate-200 bg-slate-100 text-slate-700",
  },
  {
    value: "refused",
    short: "A",
    label: "Atsisakė",
    chipClass: "border-slate-200 bg-white text-orange-800",
    cellClass: "border-slate-200 bg-white text-orange-800",
  },
  {
    value: "not_applicable",
    short: "T",
    label: "Netaikoma",
    chipClass: "border-blue-200 bg-blue-50 text-blue-800",
    cellClass: "border-blue-200 bg-blue-50 text-blue-800",
  },
];

const WEEK_DAYS = ["Pr", "An", "Tr", "Kt", "Pn", "Št", "Sk"];
function dateInput(date: Date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function todayInput() {
  return dateInput(new Date());
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("lt-LT", { year: "numeric", month: "long" });
}

function fullDateLabel(value: string) {
  return parseDate(value).toLocaleDateString("lt-LT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function timeLabel(start?: string | null, end?: string | null) {
  return `${start?.slice(0, 5) || "—"}–${end?.slice(0, 5) || "—"}`;
}

function calendarDays(month: Date) {
  const first = monthStart(month);
  const last = monthEnd(month);
  const firstDay = first.getDay() === 0 ? 7 : first.getDay();
  const result: Date[] = [];

  for (let i = firstDay - 1; i > 0; i -= 1) {
    result.push(new Date(first.getFullYear(), first.getMonth(), 1 - i));
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    result.push(new Date(first.getFullYear(), first.getMonth(), day));
  }

  while (result.length % 7 !== 0) {
    const previous = result[result.length - 1];
    result.push(new Date(previous.getFullYear(), previous.getMonth(), previous.getDate() + 1));
  }

  return result;
}

function weekDays(selectedDate: string) {
  const date = parseDate(selectedDate);
  const day = date.getDay() === 0 ? 7 : date.getDay();
  const monday = addDays(date, 1 - day);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

function defaultForm(date: string): ActivityForm {
  return {
    title: "",
    session_date: date,
    start_time: "10:00",
    end_time: "11:00",
    notes: "",
  };
}

function residentName(resident: Resident) {
  const fullName = String(resident.full_name || "").trim();
  if (fullName) return fullName;

  const displayName = String(resident.display_name || resident.name || "").trim();
  if (displayName) return displayName;

  const publicName = [resident.first_name, resident.last_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  if (publicName) return publicName;

  const encryptedName = [resident.first_name_encrypted, resident.last_name_encrypted]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");

  if (encryptedName && !/^gyv-/i.test(encryptedName)) return encryptedName;

  return "Gyventojas";
}


const BLOCKED_RESIDENT_STATUSES = new Set([
  "netrukus_atvyks",
  "reserved",
  "rezervuotas",
  "arriving_soon",
  "mire",
  "mirė",
  "deceased",
  "isvykes",
  "išvykęs",
  "permanently_left",
  "left",
  "archived",
  "neaktyvus",
  "inactive",
]);

function normalizeResidentStatus(status?: string | null) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");
}

function canUseResidentForActivities(resident: Resident) {
  if (resident.is_active === false) return false;

  const normalized = normalizeResidentStatus(resident.current_status);
  if (!normalized) return true;

  return !BLOCKED_RESIDENT_STATUSES.has(normalized);
}

function blockedResidentReason(status?: string | null) {
  const normalized = normalizeResidentStatus(status);

  if (["netrukus_atvyks", "reserved", "rezervuotas", "arriving_soon"].includes(normalized)) {
    return "dar neatvyko";
  }

  if (["mire", "mirė", "deceased"].includes(normalized)) {
    return "miręs";
  }

  if (["isvykes", "išvykęs", "permanently_left", "left", "archived"].includes(normalized)) {
    return "išvykęs visam laikui";
  }

  if (["neaktyvus", "inactive"].includes(normalized)) {
    return "neaktyvus";
  }

  return "negalima žymėti veiklose";
}


function residentHasReadableName(resident: Resident) {
  return residentName(resident) !== "Gyventojas";
}

function normalizeResidentsResponse(payload: unknown): Resident[] {
  if (Array.isArray(payload)) return payload as Resident[];

  if (payload && typeof payload === "object") {
    const item = payload as Record<string, unknown>;

    if (Array.isArray(item.residents)) return item.residents as Resident[];
    if (Array.isArray(item.data)) return item.data as Resident[];

    if (item.data && typeof item.data === "object") {
      const data = item.data as Record<string, unknown>;
      if (Array.isArray(data.residents)) return data.residents as Resident[];
    }
  }

  return [];
}

function normalizeResidentResponse(payload: unknown): Resident | null {
  if (!payload || typeof payload !== "object") return null;

  const item = payload as Record<string, unknown>;

  if (item.id) return item as Resident;

  if (item.resident && typeof item.resident === "object") {
    return item.resident as Resident;
  }

  if (item.data && typeof item.data === "object") {
    const data = item.data as Record<string, unknown>;

    if (data.id) return data as Resident;

    if (data.resident && typeof data.resident === "object") {
      return data.resident as Resident;
    }
  }

  return null;
}

async function loadReadableResidentsListFallback(): Promise<Resident[]> {
  const endpoints = ["/api/residents?limit=1000", "/api/residents"];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);

      if (!response.ok) continue;

      const payload = await response.json();
      const residents = normalizeResidentsResponse(payload);

      if (residents.length) return residents;
    } catch {
      // Jei sąrašo API nepasiekiamas, bandysime kiekvieną gyventoją atskirai.
    }
  }

  return [];
}

async function loadReadableResidentByIdFallback(id: string): Promise<Resident | null> {
  const endpoints = [`/api/residents/${id}`, `/api/residents?id=${id}`];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);

      if (!response.ok) continue;

      const payload = await response.json();
      const resident = normalizeResidentResponse(payload);

      if (resident) return resident;
    } catch {
      // Jei konkretus endpointas nepasiekiamas, paliekamas Supabase įrašas.
    }
  }

  return null;
}

async function mergeReadableResidents(supabaseResidents: Resident[]) {
  const readableList = await loadReadableResidentsListFallback();
  const readableById = new Map(readableList.map((resident) => [resident.id, resident]));

  const missingNameResidents = supabaseResidents.filter((resident) => {
    const readable = readableById.get(resident.id);
    return !residentHasReadableName(readable || resident);
  });

  const detailResults = await Promise.all(
    missingNameResidents.slice(0, 150).map((resident) => loadReadableResidentByIdFallback(resident.id)),
  );

  for (const detail of detailResults) {
    if (detail?.id) {
      readableById.set(detail.id, detail);
    }
  }

  return supabaseResidents.map((resident) => {
    const readable = readableById.get(resident.id);

    return {
      ...resident,
      full_name: readable?.full_name ?? resident.full_name ?? null,
      first_name: readable?.first_name ?? resident.first_name ?? null,
      last_name: readable?.last_name ?? resident.last_name ?? null,
      name: readable?.name ?? resident.name ?? null,
      display_name: readable?.display_name ?? resident.display_name ?? null,
      first_name_encrypted: readable?.first_name_encrypted ?? resident.first_name_encrypted ?? null,
      last_name_encrypted: readable?.last_name_encrypted ?? resident.last_name_encrypted ?? null,
    };
  });
}

function statusMeta(status?: Status | null) {
  return STATUS_OPTIONS.find((item) => item.value === status);
}

function nextStatus(status?: Status): Status {
  if (!status) return "attended";
  const index = STATUS_OPTIONS.findIndex((item) => item.value === status);
  return STATUS_OPTIONS[(index + 1) % STATUS_OPTIONS.length].value;
}

function activityTone(index: number) {
  return [
    "border-emerald-200 bg-emerald-50 text-emerald-900",
    "border-violet-200 bg-violet-50 text-violet-900",
    "border-blue-200 bg-blue-50 text-blue-900",
    "border-amber-200 bg-amber-50 text-amber-900",
    "border-rose-200 bg-white text-rose-900",
  ][index % 5];
}

function errorText(error: unknown) {
  if (!error) return "Nežinoma klaida.";
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const item = error as Record<string, unknown>;
    return [item.message, item.details, item.hint, item.code].filter(Boolean).map(String).join(" · ");
  }
  return String(error);
}

export default function ActivitiesPage() {
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => todayInput());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  const [query, setQuery] = useState("");
  const [residentQuery, setResidentQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>("all");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<Activity | null>(null);
  const [form, setForm] = useState<ActivityForm>(() => defaultForm(todayInput()));
  const [quickStatus, setQuickStatus] = useState<Status>("attended");
  const [selectedCells, setSelectedCells] = useState<Set<string>>(() => new Set());
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(() => new Set());
  const [calendarHelpOpen, setCalendarHelpOpen] = useState(false);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function getOrgId() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.organization_id || null;
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const orgId = await getOrgId();

      if (!orgId) {
        setMessage("Nepavyko nustatyti organizacijos.");
        return;
      }

      setOrganizationId(orgId);

      const from = dateInput(monthStart(month));
      const to = dateInput(monthEnd(month));

      const [activityRes, residentRes, roomRes] = await Promise.all([
        supabase
          .from("activity_sessions")
          .select("id, organization_id, title, session_date, start_time, end_time")
          .eq("organization_id", orgId)
          .gte("session_date", from)
          .lte("session_date", to)
          .order("session_date", { ascending: true })
          .order("start_time", { ascending: true }),
        supabase
          .from("residents")
          .select("id, resident_code, full_name, first_name, last_name, first_name_encrypted, last_name_encrypted, current_room_id, current_status, is_active")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .order("resident_code", { ascending: true }),
        supabase.from("rooms").select("id, name").eq("organization_id", orgId).eq("is_active", true).order("name", { ascending: true }),
      ]);

      if (activityRes.error) throw activityRes.error;
      if (residentRes.error) throw residentRes.error;
      if (roomRes.error) throw roomRes.error;

      const loadedActivities = (activityRes.data as Activity[]) || [];
      const supabaseResidents = (residentRes.data as Resident[]) || [];
      const mergedResidents = await mergeReadableResidents(supabaseResidents);
      const usableResidents = mergedResidents.filter(canUseResidentForActivities);

      setActivities(loadedActivities);
      setResidents(usableResidents);
      setRooms((roomRes.data as Room[]) || []);

      if (!loadedActivities.length) {
        setAttendance([]);
        return;
      }

      const { data: attendanceData, error: attendanceError } = await supabase
        .from("activity_attendance")
        .select("id, session_id, resident_id, status, note")
        .in(
          "session_id",
          loadedActivities.map((activity) => activity.id),
        );

      if (attendanceError) throw attendanceError;
      setAttendance((attendanceData as Attendance[]) || []);
    } catch (error) {
      setMessage(`DB klaida: ${errorText(error)}`);
    } finally {
      setLoading(false);
    }
  }

  function openActivityModal(date?: string) {
    const day = date || selectedDate || todayInput();
    setForm(defaultForm(day));
    setActivityModalOpen(true);
  }

  async function createActivity() {
    const title = form.title.trim();

    if (!title) {
      setMessage("Įvesk veiklos pavadinimą.");
      return;
    }

    if (!organizationId) {
      setMessage("Nepavyko nustatyti organizacijos.");
      return;
    }

    if (form.start_time && form.end_time && form.end_time <= form.start_time) {
      setMessage("Veiklos pabaigos laikas turi būti vėlesnis už pradžios laiką.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("activity_sessions")
        .insert({
          organization_id: organizationId,
          title,
          session_date: form.session_date,
          start_time: form.start_time || null,
          end_time: form.end_time || null,
        })
        .select("id, organization_id, title, session_date, start_time, end_time")
        .single();

      if (error) throw error;

      setActivities((previous) => [...previous, data as Activity]);
      setSelectedDate(form.session_date);
      setMonth(monthStart(parseDate(form.session_date)));
      setActivityModalOpen(false);
      setMessage("Veikla sukurta.");
    } catch (error) {
      setMessage(`Nepavyko sukurti veiklos: ${errorText(error)}`);
    } finally {
      setSaving(false);
    }
  }

  function openAttendanceModal(activity: Activity) {
    setActiveSession(activity);
    setSelectedDate(activity.session_date);
    setSelectedCells(new Set());
    setSelectedSessionIds(new Set([activity.id]));
    setResidentQuery("");
    setRoomFilter("all");
    setAttendanceFilter("all");
    setAttendanceModalOpen(true);
  }

  async function upsertAttendanceRows(rows: Array<{ session_id: string; resident_id: string; status: Status }>) {
    if (!rows.length) return;

    const { error } = await supabase.from("activity_attendance").upsert(rows, {
      onConflict: "session_id,resident_id",
    });

    if (error) throw error;
  }

  async function setResidentStatus(residentId: string, status: Status) {
    if (!activeSession) return;

    const targetSessionIds = selectedSessionIdsForBulk();

    if (!targetSessionIds.length) {
      setMessage("Pasirink bent vieną veiklą.");
      return;
    }

    const rows = targetSessionIds.map((sessionId) => ({
      session_id: sessionId,
      resident_id: residentId,
      status,
    }));

    setAttendance((previous) => {
      const map = new Map(previous.map((item) => [`${item.session_id}:${item.resident_id}`, item]));

      for (const row of rows) {
        map.set(`${row.session_id}:${row.resident_id}`, row);
      }

      return [...map.values()];
    });

    try {
      await upsertAttendanceRows(rows);
      setMessage(
        targetSessionIds.length > 1
          ? `Gyventojas pažymėtas per ${targetSessionIds.length} veikl.`
          : "Lankomumas išsaugotas.",
      );
    } catch (error) {
      setMessage(`Nepavyko išsaugoti lankomumo: ${errorText(error)}`);
      await loadData();
    }
  }

  async function setResidentStatusInSession(sessionId: string, residentId: string, status: Status) {
    const row = { session_id: sessionId, resident_id: residentId, status };

    setAttendance((previous) => {
      const map = new Map(previous.map((item) => [`${item.session_id}:${item.resident_id}`, item]));
      map.set(`${sessionId}:${residentId}`, row);
      return [...map.values()];
    });

    try {
      await upsertAttendanceRows([row]);
      setMessage("Lankomumas išsaugotas.");
    } catch (error) {
      setMessage(`Nepavyko išsaugoti lankomumo: ${errorText(error)}`);
      await loadData();
    }
  }

  function toggleCellSelection(residentId: string) {
    setSelectedCells((previous) => {
      const next = new Set(previous);
      if (next.has(residentId)) next.delete(residentId);
      else next.add(residentId);
      return next;
    });
  }

  function toggleSessionSelection(sessionId: string) {
    setSelectedSessionIds((previous) => {
      const next = new Set(previous);

      if (next.has(sessionId)) {
        if (next.size > 1) next.delete(sessionId);
      } else {
        next.add(sessionId);
      }

      return next;
    });
  }

  function selectedSessionIdsForBulk() {
    if (selectedSessionIds.size > 0) return [...selectedSessionIds];
    return activeSession ? [activeSession.id] : [];
  }

  async function applyStatusToSelected(status = quickStatus) {
    if (!activeSession) return;

    const residentIds = [...selectedCells];
    const targetSessionIds = selectedSessionIdsForBulk();

    if (!residentIds.length) {
      setMessage("Pirma pažymėk bent vieną gyventojo langelį.");
      return;
    }

    if (!targetSessionIds.length) {
      setMessage("Pasirink bent vieną veiklą.");
      return;
    }

    setBulkSaving(true);
    setMessage("");

    const rows = targetSessionIds.flatMap((sessionId) =>
      residentIds.map((residentId) => ({ session_id: sessionId, resident_id: residentId, status })),
    );

    setAttendance((previous) => {
      const map = new Map(previous.map((item) => [`${item.session_id}:${item.resident_id}`, item]));
      for (const row of rows) {
        map.set(`${row.session_id}:${row.resident_id}`, row);
      }
      return [...map.values()];
    });

    try {
      await upsertAttendanceRows(rows);
      setMessage(`Pritaikyta ${residentIds.length} gyventojams per ${targetSessionIds.length} veikl. (${rows.length} įraš.).`);
    } catch (error) {
      setMessage(`Nepavyko pritaikyti statuso: ${errorText(error)}`);
      await loadData();
    } finally {
      setBulkSaving(false);
    }
  }

  async function markAllVisible(status: Status) {
    if (!activeSession) return;

    const targetSessionIds = selectedSessionIdsForBulk();

    if (!targetSessionIds.length) {
      setMessage("Pasirink bent vieną veiklą.");
      return;
    }

    const rows = targetSessionIds.flatMap((sessionId) =>
      visibleResidents.map((resident) => ({
        session_id: sessionId,
        resident_id: resident.id,
        status,
      })),
    );

    setBulkSaving(true);
    setMessage("");

    setAttendance((previous) => {
      const map = new Map(previous.map((item) => [`${item.session_id}:${item.resident_id}`, item]));
      for (const row of rows) {
        map.set(`${row.session_id}:${row.resident_id}`, row);
      }
      return [...map.values()];
    });

    try {
      await upsertAttendanceRows(rows);
      setMessage(`Pažymėta ${visibleResidents.length} gyventojų per ${targetSessionIds.length} veikl. (${rows.length} įraš.).`);
    } catch (error) {
      setMessage(`Nepavyko masiškai pažymėti: ${errorText(error)}`);
      await loadData();
    } finally {
      setBulkSaving(false);
    }
  }

  async function copyFromPreviousActivity() {
    if (!activeSession) return;

    const targetSessionIds = selectedSessionIdsForBulk().filter((sessionId) => sessionId !== activeSession.id);

    if (targetSessionIds.length > 0) {
      const sourceRows = attendance.filter((item) => item.session_id === activeSession.id);

      if (!sourceRows.length) {
        setMessage("Aktyvioje veikloje dar nėra ką kopijuoti į kitas pasirinktas veiklas.");
        return;
      }

      const rows = targetSessionIds.flatMap((sessionId) =>
        sourceRows.map((item) => ({
          session_id: sessionId,
          resident_id: item.resident_id,
          status: item.status,
        })),
      );

      setBulkSaving(true);
      setMessage("");

      setAttendance((previousAttendance) => {
        const map = new Map(previousAttendance.map((item) => [`${item.session_id}:${item.resident_id}`, item]));

        for (const row of rows) {
          map.set(`${row.session_id}:${row.resident_id}`, row);
        }

        return [...map.values()];
      });

      try {
        await upsertAttendanceRows(rows);
        setMessage(`Aktyvios veiklos lankomumas nukopijuotas į ${targetSessionIds.length} pasirinkt. veikl.`);
      } catch (error) {
        setMessage(`Nepavyko nukopijuoti į pasirinktas veiklas: ${errorText(error)}`);
        await loadData();
      } finally {
        setBulkSaving(false);
      }

      return;
    }

    const sameDayActivities = selectedDateActivities.filter((activity) => activity.id !== activeSession.id);
    const previous = sameDayActivities
      .filter((activity) => String(activity.start_time || "") < String(activeSession.start_time || "99:99"))
      .at(-1);

    if (!previous) {
      setMessage("Nėra ankstesnės šios dienos veiklos, iš kurios būtų galima kopijuoti lankomumą.");
      return;
    }

    const previousRows = attendance.filter((item) => item.session_id === previous.id);

    if (!previousRows.length) {
      setMessage("Ankstesnėje veikloje dar nėra lankomumo žymėjimų.");
      return;
    }

    const rows = previousRows.map((item) => ({
      session_id: activeSession.id,
      resident_id: item.resident_id,
      status: item.status,
    }));

    setBulkSaving(true);
    setMessage("");

    setAttendance((previousAttendance) => {
      const map = new Map(previousAttendance.map((item) => [`${item.session_id}:${item.resident_id}`, item]));
      for (const row of rows) {
        map.set(`${row.session_id}:${row.resident_id}`, row);
      }
      return [...map.values()];
    });

    try {
      await upsertAttendanceRows(rows);
      setMessage(`Lankomumas nukopijuotas iš „${previous.title}“ veiklos.`);
    } catch (error) {
      setMessage(`Nepavyko nukopijuoti lankomumo: ${errorText(error)}`);
      await loadData();
    } finally {
      setBulkSaving(false);
    }
  }

  const days = useMemo(() => calendarDays(month), [month]);
  const week = useMemo(() => weekDays(selectedDate), [selectedDate]);

  const filteredActivities = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return activities;

    return activities.filter((activity) =>
      [activity.title, activity.session_date, activity.start_time, activity.end_time]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }, [activities, query]);

  const activitiesByDate = useMemo(() => {
    const map = new Map<string, Activity[]>();

    for (const activity of filteredActivities) {
      const list = map.get(activity.session_date) || [];
      list.push(activity);
      map.set(activity.session_date, list.sort((a, b) => String(a.start_time || "").localeCompare(String(b.start_time || ""))));
    }

    return map;
  }, [filteredActivities]);

  const selectedDateActivities = useMemo(() => {
    return activities
      .filter((activity) => activity.session_date === selectedDate)
      .sort((a, b) => String(a.start_time || "").localeCompare(String(b.start_time || "")));
  }, [activities, selectedDate]);

  const visibleCalendarDays = viewMode === "week" ? week : viewMode === "day" ? [parseDate(selectedDate)] : days;

  const roomMap = useMemo(() => new Map(rooms.map((room) => [room.id, room.name || "Kambarys"])), [rooms]);

  const visibleResidents = useMemo(() => {
    const value = residentQuery.trim().toLowerCase();

    return residents.filter((resident) => {
      const matchesSearch = value ? residentName(resident).toLowerCase().includes(value) : true;
      const matchesRoom = roomFilter === "all" ? true : resident.current_room_id === roomFilter;

      const currentStatus = activeSession
        ? attendance.find((item) => item.session_id === activeSession.id && item.resident_id === resident.id)?.status
        : undefined;

      const matchesAttendance =
        attendanceFilter === "all"
          ? true
          : attendanceFilter === "unmarked"
            ? !currentStatus
            : currentStatus === attendanceFilter;

      return matchesSearch && matchesRoom && matchesAttendance;
    });
  }, [residents, residentQuery, roomFilter, attendanceFilter, attendance, activeSession?.id]);

  const activeAttendance = activeSession ? attendance.filter((item) => item.session_id === activeSession.id) : [];

  const activeStats = {
    marked: activeAttendance.length,
    attended: activeAttendance.filter((item) => item.status === "attended").length,
    absent: activeAttendance.filter((item) => item.status === "absent").length,
    refused: activeAttendance.filter((item) => item.status === "refused").length,
    notApplicable: activeAttendance.filter((item) => item.status === "not_applicable").length,
  };

  const attendanceSessionOptions = useMemo(() => {
    if (!activeSession) return [];

    return selectedDateActivities.length
      ? selectedDateActivities
      : [activeSession];
  }, [activeSession, selectedDateActivities]);

  const todayActivities = activities.filter((activity) => activity.session_date === todayInput()).length;
  const selectedMarkedCount = selectedDateActivities.reduce(
    (sum, activity) => sum + attendance.filter((item) => item.session_id === activity.id).length,
    0,
  );
  const selectedAttendedCount = selectedDateActivities.reduce(
    (sum, activity) => sum + attendance.filter((item) => item.session_id === activity.id && item.status === "attended").length,
    0,
  );

  return (
    <main className="min-h-screen bg-[#f3f6f4] px-4 py-5 text-[#10251f] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <section className="overflow-hidden rounded-[22px] border border-[#c9d8d0] bg-white shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
          <div className="flex flex-col gap-5 bg-[#486b5d] p-6 text-white xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/75">
                <Sparkles className="h-3.5 w-3.5" /> Socialinės globos veiklų kalendorius
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white lg:text-4xl">Veiklos ir lankomumas</h1>
              <p className="mt-2 max-w-3xl text-sm font-extrabold leading-6 text-white/85 lg:text-base">
                Kalendoriaus vaizdas, dienos planai, veiklų kortelės ir greitas lankomumo žymėjimas.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setMonth((previous) => addMonths(previous, -1))} className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/20 bg-white text-[#486b5d] transition hover:bg-white/90">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = todayInput();
                  setSelectedDate(today);
                  setMonth(monthStart(new Date()));
                }}
                className="rounded-[14px] border border-white/20 bg-white px-5 py-3 text-sm font-black text-[#486b5d] transition hover:bg-white/90"
              >
                Šiandien
              </button>
              <button type="button" onClick={() => setMonth((previous) => addMonths(previous, 1))} className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/20 bg-white text-[#486b5d] transition hover:bg-white/90">
                <ChevronRight className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => void loadData()} className="rounded-[14px] border border-white/20 bg-white px-5 py-3 text-sm font-black text-[#486b5d] transition hover:bg-white/90">
                <RefreshCw className="mr-2 inline h-4 w-4" /> Atnaujinti
              </button>
              <button type="button" onClick={() => openActivityModal()} className="rounded-[14px] bg-[#047857] px-5 py-3 text-sm font-black text-white shadow-md shadow-green-950/10 transition hover:bg-[#036747]">
                <Plus className="mr-2 inline h-4 w-4" /> Nauja veikla
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#dbe6e0] bg-[#eef4f1] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {([
                ["day", "Diena"],
                ["week", "Savaitė"],
                ["month", "Mėnuo"],
              ] as Array<[ViewMode, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setViewMode(value)}
                  className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
                    viewMode === value
                      ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
                      : "text-[#486b5d] hover:bg-white/70"
                  }`}
                >
                  <CalendarDays className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCalendarHelpOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-[#c9d8d0] bg-white px-4 py-2.5 text-sm font-black text-[#486b5d] shadow-sm transition hover:bg-[#f8faf8]"
            >
              <HelpCircle className="h-4 w-4" />
              Instrukcija
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-[#dbe6e0] bg-[#eef4f1] p-4 md:grid-cols-4 xl:grid-cols-6">
            <StatCard label="Mėnuo" value={monthLabel(month)} />
            <StatCard label="Šiandien" value={`${todayActivities} veiklos`} />
            <StatCard label="Pasirinkta diena" value={`${selectedDateActivities.length} veiklos`} />
            <StatCard label="Pažymėjimų" value={String(selectedMarkedCount)} />
            <StatCard label="Dalyvavo" value={String(selectedAttendedCount)} />
            <StatCard label="Gyventojai" value={String(residents.length)} warning />
          </div>
        </section>

        {message ? <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-900">{message}</div> : null}

        <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-[22px] border border-[#c9d8d0] bg-white shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
            <div className="flex flex-col gap-4 border-b border-[#dbe6e0] p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xl font-black capitalize text-[#10251f]">
                  <CalendarDays className="h-5 w-5 text-[#486b5d]" /> {monthLabel(month)}
                </div>
                <p className="mt-1 text-sm font-semibold text-[#526174]">
                  Veiklą spausk lankomumui. Tuščia diena atidaro naujos veiklos langą.
                </p>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <label className="relative block w-full lg:w-[300px]">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a9a91]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Ieškoti veiklos..."
                    className="h-12 w-full rounded-2xl border border-[#dbe6e0] bg-white py-3 pl-12 pr-4 text-sm font-bold outline-none transition placeholder:text-[#8a9a91] focus:border-[#047857] focus:ring-4 focus:ring-[#047857]/10"
                  />
                </label>

                <div className="hidden rounded-2xl border border-[#dbe6e0] bg-[#eef4f1] p-1 text-sm font-black lg:flex">
                  {([
                    ["day", "Diena"],
                    ["week", "Savaitė"],
                    ["month", "Mėnuo"],
                  ] as Array<[ViewMode, string]>).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setViewMode(value)}
                      className={`rounded-xl px-4 py-2 transition ${viewMode === value ? "bg-white text-[#10251f] shadow-sm" : "text-[#557066] hover:bg-white/60"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-lg font-black text-[#526174]">Kraunama...</div>
            ) : (
              <CalendarGrid
                days={visibleCalendarDays}
                month={month}
                selectedDate={selectedDate}
                viewMode={viewMode}
                activitiesByDate={activitiesByDate}
                attendance={attendance}
                onPickDate={(date) => setSelectedDate(date)}
                onCreate={(date) => openActivityModal(date)}
                onOpenAttendance={openAttendanceModal}
              />
            )}
          </div>

          <aside className="rounded-[22px] border border-[#c9d8d0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-[#10251f]">Šios dienos planas</h2>
                <p className="mt-1 text-sm font-semibold capitalize text-[#526174]">{fullDateLabel(selectedDate)}</p>
              </div>
              <button type="button" onClick={() => openActivityModal(selectedDate)} className="rounded-2xl bg-[#047857] px-4 py-2 text-sm font-black text-white transition hover:bg-[#036747]">
                + Pridėti
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {selectedDateActivities.length ? (
                selectedDateActivities.map((activity, index) => {
                  const marked = attendance.filter((item) => item.session_id === activity.id).length;
                  const attended = attendance.filter((item) => item.session_id === activity.id && item.status === "attended").length;

                  return (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => openAttendanceModal(activity)}
                      className="grid w-full grid-cols-[74px_1fr] gap-3 text-left"
                    >
                      <div className="pt-2 text-sm font-black text-[#526174]">{activity.start_time?.slice(0, 5) || "—"}</div>
                      <div className={`rounded-3xl border p-4 transition hover:scale-[1.01] ${activityTone(index)}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-black">{activity.title}</p>
                            <p className="mt-1 text-sm font-bold opacity-75">{timeLabel(activity.start_time, activity.end_time)}</p>
                          </div>
                          <GripVertical className="h-5 w-5 opacity-40" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                          <span className="rounded-full bg-white/80 px-3 py-1">{marked} pažymėta</span>
                          <span className="rounded-full bg-white/80 px-3 py-1">{attended} dalyvavo</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-[#dbe6e0] bg-[#f8faf8] p-8 text-center">
                  <CalendarDays className="mx-auto h-8 w-8 text-[#8a9a91]" />
                  <p className="mt-3 font-black text-[#10251f]">Šią dieną veiklų nėra</p>
                  <button type="button" onClick={() => openActivityModal(selectedDate)} className="mt-4 rounded-2xl bg-[#047857] px-4 py-2 text-sm font-black text-white">
                    Sukurti veiklą
                  </button>
                </div>
              )}
            </div>
          </aside>
        </section>

        <section className="rounded-[22px] border border-[#c9d8d0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-[#10251f]"><ListChecks className="h-5 w-5 text-[#486b5d]" /> Lankomumo principas</h2>
              <p className="mt-1 text-sm font-semibold text-[#526174]">
                Modaliniame lange galima žymėti vienu paspaudimu, pažymėti kelis langelius ir pritaikyti D/N/A/T masiškai.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <span key={option.value} className={`rounded-full border px-3 py-1 text-xs font-black ${option.chipClass}`}>
                  {option.short} · {option.label}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      {calendarHelpOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-6 backdrop-blur-sm">
          <section className="w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)]">
            <div className="flex items-start justify-between gap-4 bg-[#486b5d] px-6 py-5 text-white">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/80">Veiklų modulio instrukcija</p>
                <h3 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">Kaip naudotis veiklų kalendoriumi?</h3>
              </div>

              <button
                type="button"
                onClick={() => setCalendarHelpOpen(false)}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Uždaryti instrukciją"
              >
                <X className="h-7 w-7" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-3xl border border-[#dbe6e0] bg-[#f8faf8] p-5">
                <h4 className="font-black text-[#10251f]">1. Veiklos kūrimas</h4>
                <p className="mt-2 text-sm font-bold leading-6 text-[#526174]">
                  Spausk tuščią dieną kalendoriuje arba mygtuką „Nauja veikla“. Įvesk pavadinimą, datą, pradžią ir pabaigą.
                </p>
              </div>

              <div className="rounded-3xl border border-[#dbe6e0] bg-[#f8faf8] p-5">
                <h4 className="font-black text-[#10251f]">2. Lankomumo žymėjimas</h4>
                <p className="mt-2 text-sm font-bold leading-6 text-[#526174]">
                  Spausk veiklos kortelę kalendoriuje. Atsidariusiame lange žymėk D / N / A / T arba naudok mini matricą kelioms veikloms.
                </p>
              </div>

              <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
                <h4 className="font-black text-amber-900">3. Laiko taisyklė</h4>
                <p className="mt-2 text-sm font-bold leading-6 text-amber-800">
                  Veiklos pabaiga negali būti ankstesnė arba tokia pati kaip pradžia. Sistema tokios veiklos neleis sukurti.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setCalendarHelpOpen(false)}
                  className="rounded-2xl bg-[#047857] px-5 py-3 text-sm font-black text-white transition hover:bg-[#036747]"
                >
                  Supratau
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {activityModalOpen ? (
        <ActivityModal value={form} saving={saving} onChange={setForm} onClose={() => setActivityModalOpen(false)} onSubmit={() => void createActivity()} />
      ) : null}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.875rem;
          border: 1px solid #dbe6e0;
          background: white;
          padding: 0.9rem 1rem;
          font-weight: 800;
          color: #10251f;
          outline: none;
        }

        .input:focus {
          border-color: #047857;
          box-shadow: 0 0 0 4px rgba(4, 120, 87, 0.12);
        }
      `}</style>

      {attendanceModalOpen && activeSession ? (
        <AttendanceModal
          session={activeSession}
          residents={visibleResidents}
          rooms={rooms}
          roomMap={roomMap}
          roomFilter={roomFilter}
          residentQuery={residentQuery}
          attendanceFilter={attendanceFilter}
          attendance={attendance}
          stats={activeStats}
          selectedCells={selectedCells}
          selectedSessionIds={selectedSessionIds}
          sessionOptions={attendanceSessionOptions}
          quickStatus={quickStatus}
          bulkSaving={bulkSaving}
          onRoomFilter={setRoomFilter}
          onResidentQuery={setResidentQuery}
          onAttendanceFilter={setAttendanceFilter}
          onQuickStatus={(status) => {
            setQuickStatus(status);
            if (selectedCells.size > 0) {
              void applyStatusToSelected(status);
            }
          }}
          onToggleSelection={toggleCellSelection}
          onToggleSession={toggleSessionSelection}
          onSetMatrixStatus={(sessionId, residentId, status) => void setResidentStatusInSession(sessionId, residentId, status)}
          onCycleStatus={(residentId) => {
            const existing = activeAttendance.find((item) => item.resident_id === residentId);
            void setResidentStatus(residentId, nextStatus(existing?.status));
          }}
          onApplySelected={() => void applyStatusToSelected()}
          onMarkAll={(status) => void markAllVisible(status)}
          onCopyPrevious={() => void copyFromPreviousActivity()}
          onClose={() => setAttendanceModalOpen(false)}
        />
      ) : null}
    </main>
  );
}

function CalendarGrid({
  days,
  month,
  selectedDate,
  viewMode,
  activitiesByDate,
  attendance,
  onPickDate,
  onCreate,
  onOpenAttendance,
}: {
  days: Date[];
  month: Date;
  selectedDate: string;
  viewMode: ViewMode;
  activitiesByDate: Map<string, Activity[]>;
  attendance: Attendance[];
  onPickDate: (date: string) => void;
  onCreate: (date: string) => void;
  onOpenAttendance: (activity: Activity) => void;
}) {
  const columns = viewMode === "day" ? "grid-cols-1" : "grid-cols-7";

  return (
    <div>
      {viewMode !== "day" ? (
        <div className="grid grid-cols-7 border-b border-[#dbe6e0] bg-[#f8faf8] text-center text-xs font-black uppercase tracking-wider text-[#526174]">
          {WEEK_DAYS.map((day) => (
            <div key={day} className="py-3">{day}</div>
          ))}
        </div>
      ) : null}

      <div className={`grid ${columns}`}>
        {days.map((day) => {
          const key = dateInput(day);
          const dayActivities = activitiesByDate.get(key) || [];
          const isCurrentMonth = day.getMonth() === month.getMonth();
          const isSelected = key === selectedDate;
          const isToday = key === todayInput();

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onPickDate(key);
                if (!dayActivities.length) onCreate(key);
              }}
              className={`min-h-[156px] border-b border-r border-[#e4ece6] bg-white p-3 text-left transition hover:bg-[#f8faf8] ${
                !isCurrentMonth && viewMode === "month" ? "opacity-45" : ""
              } ${isSelected ? "ring-2 ring-inset ring-[#047857]" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-black ${isToday ? "bg-[#047857] text-white" : "bg-[#eef4f1] text-[#10251f]"}`}>
                  {day.getDate()}
                </div>
                {dayActivities.length ? <span className="rounded-full bg-[#eef4f1] px-2 py-1 text-xs font-black text-[#486b5d]">{dayActivities.length}</span> : null}
              </div>

              <div className="mt-3 space-y-2">
                {dayActivities.slice(0, viewMode === "month" ? 3 : 8).map((activity, index) => {
                  const marked = attendance.filter((item) => item.session_id === activity.id).length;
                  const attended = attendance.filter((item) => item.session_id === activity.id && item.status === "attended").length;

                  return (
                    <div
                      key={activity.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenAttendance(activity);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.stopPropagation();
                          onOpenAttendance(activity);
                        }
                      }}
                      className={`cursor-grab rounded-2xl border p-3 text-xs shadow-sm transition hover:scale-[1.01] ${activityTone(index)}`}
                      title="Vizualiai tempiama kortelė. Tikras perkėlimas gali būti prijungtas vėliau su drag/drop biblioteka."
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-black">{activity.start_time?.slice(0, 5) || "—"}</div>
                          <div className="mt-1 line-clamp-2 text-sm font-black">{activity.title}</div>
                        </div>
                        <GripVertical className="h-4 w-4 opacity-40" />
                      </div>
                      <div className="mt-2 text-[11px] font-bold opacity-80">
                        {marked ? `${attended} dalyvavo · ${marked} pažymėta` : "Žymėti lankomumą"}
                      </div>
                    </div>
                  );
                })}

                {dayActivities.length > (viewMode === "month" ? 3 : 8) ? (
                  <div className="rounded-2xl bg-[#f1f5f2] px-3 py-2 text-xs font-black text-[#526174]">+{dayActivities.length - 3} daugiau</div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActivityModal({
  value,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  value: ActivityForm;
  saving: boolean;
  onChange: Dispatch<SetStateAction<ActivityForm>>;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const timeInvalid = Boolean(value.start_time && value.end_time && value.end_time <= value.start_time);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/50 p-6 backdrop-blur-sm">
      <section className="w-full max-w-3xl max-h-[calc(100vh-48px)] overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)]">
        <div className="flex items-start justify-between gap-6 bg-[#486b5d] px-6 py-5 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/80">Veiklų modulis</p>
            <h2 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">Nauja veikla</h2>
            <p className="mt-2 text-sm font-semibold text-white/80">Suplanuok veiklą kalendoriuje.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex h-12 items-center gap-2 rounded-[14px] border border-white/20 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/20"
              aria-label="Kaip pildyti veiklą"
            >
              <HelpCircle className="h-5 w-5" />
              <span className="hidden sm:inline">Kaip pildyti?</span>
            </button>

            <button type="button" onClick={onClose} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition hover:bg-white/20" aria-label="Uždaryti">
              <X className="h-7 w-7" />
            </button>
          </div>
        </div>

        {helpOpen ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-6 backdrop-blur-sm">
            <section className="w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)]">
              <div className="flex items-start justify-between gap-4 bg-[#486b5d] px-6 py-5 text-white">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/80">Naujos veiklos instrukcija</p>
                  <h3 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">Kaip pildyti naują veiklą?</h3>
                </div>

                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Uždaryti instrukciją"
                >
                  <X className="h-7 w-7" />
                </button>
              </div>

              <div className="space-y-4 p-6">
                <div className="rounded-3xl border border-[#dbe6e0] bg-[#f8faf8] p-5">
                  <h4 className="font-black text-[#10251f]">1. Pavadinimas</h4>
                  <p className="mt-2 text-sm font-bold leading-6 text-[#526174]">
                    Įrašyk aiškų veiklos pavadinimą, pvz. „Muzikos terapija“, „Mankšta“, „Teatras“.
                  </p>
                </div>

                <div className="rounded-3xl border border-[#dbe6e0] bg-[#f8faf8] p-5">
                  <h4 className="font-black text-[#10251f]">2. Data ir laikas</h4>
                  <p className="mt-2 text-sm font-bold leading-6 text-[#526174]">
                    Pasirink veiklos datą, pradžią ir pabaigą. Pabaigos laikas turi būti vėlesnis už pradžios laiką.
                  </p>
                </div>

                <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
                  <h4 className="font-black text-amber-900">3. Svarbi taisyklė</h4>
                  <p className="mt-2 text-sm font-bold leading-6 text-amber-800">
                    Sistema neleis sukurti veiklos, jei pabaiga ankstesnė arba tokia pati kaip pradžia.
                  </p>
                </div>

                <div className="rounded-3xl border border-[#dbe6e0] bg-[#f8faf8] p-5">
                  <h4 className="font-black text-[#10251f]">4. Po sukūrimo</h4>
                  <p className="mt-2 text-sm font-bold leading-6 text-[#526174]">
                    Sukūrus veiklą, ją spausk kalendoriuje ir žymėk gyventojų lankomumą.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setHelpOpen(false)}
                    className="rounded-2xl bg-[#047857] px-5 py-3 text-sm font-black text-white transition hover:bg-[#036747]"
                  >
                    Supratau
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        <div className="max-h-[calc(100vh-178px)] overflow-y-auto bg-[#f3f6f4] p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Veiklos pavadinimas" full>
              <input value={value.title} onChange={(event) => onChange((previous) => ({ ...previous, title: event.target.value }))} placeholder="Pvz. Muzikos terapija" className="input" />
            </Field>

            <Field label="Data">
              <input type="date" value={value.session_date} onChange={(event) => onChange((previous) => ({ ...previous, session_date: event.target.value }))} className="input" />
            </Field>

            <Field label="Pradžia">
              <input type="time" value={value.start_time} onChange={(event) => onChange((previous) => ({ ...previous, start_time: event.target.value }))} className="input" />
            </Field>

            <Field label="Pabaiga">
              <input type="time" min={value.start_time || undefined} value={value.end_time} onChange={(event) => onChange((previous) => ({ ...previous, end_time: event.target.value }))} className={`input ${timeInvalid ? "border-red-300 bg-white text-red-900 focus:border-red-400 focus:ring-red-100" : ""}`} />
            </Field>

            {timeInvalid ? (
              <div className="md:col-span-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-black text-red-800">
                Veiklos pabaiga turi būti vėlesnė už pradžią.
              </div>
            ) : null}

            <Field label="Vidinė pastaba / grupė" full>
              <textarea
                value={value.notes}
                onChange={(event) => onChange((previous) => ({ ...previous, notes: event.target.value }))}
                placeholder="Pastaba rodoma tik formoje. DB nesiunčiama, nes activity_sessions.notes stulpelio pas tave nėra."
                className="input min-h-28 resize-none"
              />
            </Field>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#dbe6e0] pt-5">
            <button type="button" onClick={onClose} className="rounded-[14px] border border-white/20 bg-white px-5 py-3 text-sm font-black text-[#486b5d] transition hover:bg-white/90">
              Atšaukti
            </button>
            <button type="button" onClick={onSubmit} disabled={saving || timeInvalid} className="rounded-2xl bg-[#047857] px-5 py-3 text-sm font-black text-white transition hover:bg-[#036747] disabled:opacity-60">
              {saving ? "Saugoma..." : "Sukurti veiklą"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AttendanceModal({
  session,
  residents,
  rooms,
  roomMap,
  roomFilter,
  residentQuery,
  attendanceFilter,
  attendance,
  stats,
  selectedCells,
  selectedSessionIds,
  sessionOptions,
  quickStatus,
  bulkSaving,
  onRoomFilter,
  onResidentQuery,
  onAttendanceFilter,
  onQuickStatus,
  onToggleSelection,
  onToggleSession,
  onSetMatrixStatus,
  onCycleStatus,
  onApplySelected,
  onMarkAll,
  onCopyPrevious,
  onClose,
}: {
  session: Activity;
  residents: Resident[];
  rooms: Room[];
  roomMap: Map<string, string>;
  roomFilter: string;
  residentQuery: string;
  attendanceFilter: AttendanceFilter;
  attendance: Attendance[];
  stats: { marked: number; attended: number; absent: number; refused: number; notApplicable: number };
  selectedCells: Set<string>;
  selectedSessionIds: Set<string>;
  sessionOptions: Activity[];
  quickStatus: Status;
  bulkSaving: boolean;
  onRoomFilter: (value: string) => void;
  onResidentQuery: (value: string) => void;
  onAttendanceFilter: (value: AttendanceFilter) => void;
  onQuickStatus: (value: Status) => void;
  onToggleSelection: (residentId: string) => void;
  onToggleSession: (sessionId: string) => void;
  onSetMatrixStatus: (sessionId: string, residentId: string, status: Status) => void;
  onCycleStatus: (residentId: string) => void;
  onApplySelected: () => void;
  onMarkAll: (status: Status) => void;
  onCopyPrevious: () => void;
  onClose: () => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/50 p-6 backdrop-blur-sm">
      <section className="max-h-[calc(100vh-48px)] w-full max-w-7xl overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)]">
        <div className="flex items-start justify-between gap-6 bg-[#486b5d] px-6 py-5 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/80">Lankomumo žymėjimas</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white lg:text-4xl">{session.title}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-white/80">
              <Clock className="h-4 w-4" /> {fullDateLabel(session.session_date)} · {timeLabel(session.start_time, session.end_time)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition hover:bg-white/20" aria-label="Uždaryti">
            <X className="h-7 w-7" />
          </button>
        </div>

        {helpOpen ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-6 backdrop-blur-sm">
            <section className="w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)]">
              <div className="flex items-start justify-between gap-4 bg-[#486b5d] px-6 py-5 text-white">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/80">Trumpa instrukcija</p>
                  <h3 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">Kaip žymėti lankomumą?</h3>
                </div>

                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Uždaryti instrukciją"
                >
                  <X className="h-7 w-7" />
                </button>
              </div>

              <div className="space-y-5 p-6">
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                  <h4 className="text-lg font-black text-emerald-900">1. Greičiausias būdas</h4>
                  <p className="mt-2 text-sm font-bold leading-6 text-emerald-800">
                    Eilutėje prie gyventojo spausk statusą. Vienas paspaudimas iš karto išsaugo lankomumą aktyviai veiklai.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-black text-emerald-800">D = dalyvavo</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-black text-slate-700">N = nedalyvavo</span>
                    <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-sm font-black text-amber-800">A = atsisakė</span>
                    <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-black text-blue-800">T = netaikoma</span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-[#dbe6e0] bg-[#f8faf8] p-5">
                    <h4 className="font-black text-[#10251f]">2. Kelių gyventojų žymėjimas</h4>
                    <p className="mt-2 text-sm font-bold leading-6 text-[#526174]">
                      Pažymėk gyventojus su „+“, tada spausk D / N / A / T — statusas iškart pritaikomas pažymėtiems.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-[#dbe6e0] bg-[#f8faf8] p-5">
                    <h4 className="font-black text-[#10251f]">3. Kelių veiklų žymėjimas</h4>
                    <p className="mt-2 text-sm font-bold leading-6 text-[#526174]">
                      Bloke „Taikyti į kelias veiklas“ pasirink veiklas. Masiniai mygtukai žymės visose pasirinktose veiklose.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-[#dbe6e0] bg-[#f8faf8] p-5">
                    <h4 className="font-black text-[#10251f]">4. Filtrai</h4>
                    <p className="mt-2 text-sm font-bold leading-6 text-[#526174]">
                      Statistikos kvadračiukai viršuje filtruoja sąrašą: dalyvavo, nedalyvavo, atsisakė, netaikoma.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-red-100 bg-white p-5">
                    <h4 className="font-black text-red-900">5. Nepažymėti</h4>
                    <p className="mt-2 text-sm font-bold leading-6 text-red-800">
                      Jei lieka nepažymėtų, veikla dar nėra pilnai sutvarkyta. Patikrink sąrašą prieš uždarant langą.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setHelpOpen(false)}
                    className="rounded-2xl bg-[#047857] px-5 py-3 text-sm font-black text-white transition hover:bg-[#036747]"
                  >
                    Supratau
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        <div className="max-h-[calc(94vh-118px)] space-y-5 overflow-y-auto p-5 lg:p-6">
          <section className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-bold leading-6 text-emerald-900">
            <span className="font-black">Greitai:</span> eilutėje spausk D / N / A / T. One-click žymi visas viršuje pasirinktas veiklas. Masiniai mygtukai taip pat taikomi pasirinktoms veikloms.
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="ml-2 inline-flex items-center gap-1 font-black underline underline-offset-4"
            >
              <HelpCircle className="h-4 w-4" />
              plačiau
            </button>
          </section>

          <section className="grid gap-3 md:grid-cols-5">
            <MiniStat
              label="Pažymėta"
              value={String(stats.marked)}
              tone="slate"
              active={attendanceFilter === "all"}
              onClick={() => onAttendanceFilter("all")}
            />
            <MiniStat
              label="Dalyvavo"
              value={String(stats.attended)}
              tone="emerald"
              active={attendanceFilter === "attended"}
              onClick={() => onAttendanceFilter("attended")}
            />
            <MiniStat
              label="Nedalyvavo"
              value={String(stats.absent)}
              tone="slate"
              active={attendanceFilter === "absent"}
              onClick={() => onAttendanceFilter("absent")}
            />
            <MiniStat
              label="Atsisakė"
              value={String(stats.refused)}
              tone="amber"
              active={attendanceFilter === "refused"}
              onClick={() => onAttendanceFilter("refused")}
            />
            <MiniStat
              label="Netaikoma"
              value={String(stats.notApplicable)}
              tone="blue"
              active={attendanceFilter === "not_applicable"}
              onClick={() => onAttendanceFilter("not_applicable")}
            />
          </section>

          <section className="rounded-3xl border border-[#dbe6e0] bg-white p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-[#486b5d]">Taikyti į kelias veiklas</h3>
                <p className="mt-1 text-sm font-bold text-[#526174]">
                  Pasirink veiklas, kurioms bus taikomas masinis žymėjimas. One-click eilutėje žymi visas viršuje pasirinktas veiklas.
                </p>
              </div>
              <span className="rounded-full border border-[#dbe6e0] bg-[#eef4f1] px-3 py-1 text-xs font-black text-[#486b5d]">
                Pasirinkta: {selectedSessionIds.size || 1}
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {sessionOptions.map((item) => {
                const selected = selectedSessionIds.has(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggleSession(item.id)}
                    className={`shrink-0 rounded-2xl border px-4 py-3 text-left transition ${
                      selected
                        ? "border-[#2f4f3f] bg-[#047857] text-white"
                        : "border-[#dbe6e0] bg-white text-[#486b5d] hover:bg-[#eef4f1]"
                    }`}
                  >
                    <div className="text-sm font-black">{item.title}</div>
                    <div className={`mt-1 text-xs font-bold ${selected ? "text-white/75" : "text-[#526174]"}`}>
                      {timeLabel(item.start_time, item.end_time)}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-[#dbe6e0] bg-[#f8faf8] p-4">
            <div className="grid gap-3 xl:grid-cols-[1fr_220px_220px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a9a91]" />
                <input value={residentQuery} onChange={(event) => onResidentQuery(event.target.value)} placeholder="Ieškoti gyventojo..." className="h-12 w-full rounded-2xl border border-[#dbe6e0] bg-white py-3 pl-12 pr-4 text-sm font-bold outline-none transition placeholder:text-[#8a9a91] focus:border-[#047857] focus:ring-4 focus:ring-[#047857]/10" />
              </label>

              <select value={roomFilter} onChange={(event) => onRoomFilter(event.target.value)} className="h-12 rounded-2xl border border-[#dbe6e0] bg-white px-4 text-sm font-bold outline-none transition focus:border-[#047857] focus:ring-4 focus:ring-[#047857]/10">
                <option value="all">Visi kambariai</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name || "Kambarys"}</option>
                ))}
              </select>

              <select value={attendanceFilter} onChange={(event) => onAttendanceFilter(event.target.value as AttendanceFilter)} className="h-12 rounded-2xl border border-[#dbe6e0] bg-white px-4 text-sm font-bold outline-none transition focus:border-[#047857] focus:ring-4 focus:ring-[#047857]/10">
                {ATTENDANCE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap items-center gap-2 xl:col-span-3">
                <span className="mr-1 text-xs font-black uppercase tracking-widest text-[#526174]">Masinis statusas:</span>
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onQuickStatus(option.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-black transition ${option.chipClass} ${quickStatus === option.value ? "ring-2 ring-[#047857] ring-offset-2" : ""}`}
                  >
                    {option.short} = {option.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-4 text-xs font-bold leading-5 text-[#526174]">
              Viršutiniai D/N/A/T taikomi pažymėtiems gyventojams. Jei skirtingose veiklose statusai skiriasi, žymėk tiesiogiai mini matricoje.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={onApplySelected} disabled={bulkSaving} className="rounded-2xl bg-[#047857] px-4 py-2 text-sm font-black text-white transition hover:bg-[#036747] disabled:opacity-60">
                <CheckCircle2 className="mr-2 inline h-4 w-4" /> Pritaikyti pažymėtiems ({selectedCells.size}) į pasirinktas veiklas
              </button>
              <button type="button" onClick={() => onMarkAll("attended")} disabled={bulkSaving} className="rounded-2xl border border-[#dbe6e0] bg-white px-4 py-2 text-sm font-black text-[#486b5d] transition hover:bg-[#eef4f1] disabled:opacity-60">
                Matomus D į pasirinktas veiklas
              </button>
              <button type="button" onClick={() => onMarkAll("absent")} disabled={bulkSaving} className="rounded-2xl border border-[#dbe6e0] bg-white px-4 py-2 text-sm font-black text-[#486b5d] transition hover:bg-[#eef4f1] disabled:opacity-60">
                Matomus N į pasirinktas veiklas
              </button>
              <button type="button" onClick={onCopyPrevious} disabled={bulkSaving} className="rounded-2xl border border-[#dbe6e0] bg-white px-4 py-2 text-sm font-black text-[#486b5d] transition hover:bg-[#eef4f1] disabled:opacity-60">
                <Copy className="mr-2 inline h-4 w-4" /> Kopijuoti į pasirinktas
              </button>
            </div>
          </section>

          {selectedSessionIds.size > 1 ? (
            <section className="overflow-hidden rounded-3xl border border-[#dbe6e0] bg-white">
              <div className="border-b border-[#dbe6e0] bg-[#f8faf8] px-4 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#486b5d]">Mini matrica</h3>
                  <button
                    type="button"
                    onClick={() => setHelpOpen(true)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#dbe6e0] bg-white text-[#486b5d] transition hover:bg-[#eef4f1]"
                    aria-label="Kaip naudoti mini matricą"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 text-sm font-bold text-[#526174]">Čia galima žymėti kiekvieną gyventojo ir veiklos langelį atskirai.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="bg-[#fbfdfb] text-xs font-black uppercase tracking-widest text-[#526174]">
                    <tr>
                      <th className="px-4 py-3">Gyventojas</th>
                      {sessionOptions
                        .filter((item) => selectedSessionIds.has(item.id))
                        .map((item) => (
                          <th key={item.id} className="px-4 py-3">
                            {item.title}
                            <div className="mt-1 text-[11px] font-bold normal-case tracking-normal text-[#8a9a91]">
                              {timeLabel(item.start_time, item.end_time)}
                            </div>
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf2ee]">
                    {residents.slice(0, 8).map((resident) => (
                      <tr key={resident.id}>
                        <td className="px-4 py-3 font-black text-[#10251f]">{residentName(resident)}</td>
                        {sessionOptions
                          .filter((item) => selectedSessionIds.has(item.id))
                          .map((item) => {
                            const current = attendance.find((row) => row.session_id === item.id && row.resident_id === resident.id);

                            return (
                              <td key={item.id} className="px-4 py-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {STATUS_OPTIONS.map((option) => {
                                    const active = current?.status === option.value;

                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => onSetMatrixStatus(item.id, resident.id, option.value)}
                                        className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-black transition hover:scale-105 ${
                                          active ? option.cellClass : "border-[#dbe6e0] bg-white text-[#526174] hover:bg-[#eef4f1]"
                                        }`}
                                        title={`${residentName(resident)} · ${item.title} · ${option.label}`}
                                      >
                                        {option.short}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                            );
                          })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-3xl border border-[#dbe6e0] bg-white">
            <div className="grid grid-cols-[44px_minmax(230px,1.5fr)_130px_170px] bg-[#f8faf8] px-4 py-3 text-xs font-black uppercase tracking-widest text-[#526174]">
              <div></div>
              <div>Gyventojas</div>
              <div>Kambarys</div>
              <div>Statusas</div>
            </div>

            <div className="max-h-[480px] divide-y divide-[#edf2ee] overflow-auto">
              {residents.length ? (
                residents.map((resident) => {
                  const current = attendance.find((item) => item.session_id === session.id && item.resident_id === resident.id);
                  const meta = statusMeta(current?.status);
                  const selected = selectedCells.has(resident.id);

                  return (
                    <div key={resident.id} className={`grid grid-cols-[44px_minmax(230px,1.5fr)_130px_170px] items-center gap-3 px-4 py-3 transition ${selected ? "bg-[#eef4f1]" : "hover:bg-[#f8faf8]"}`}>
                      <button
                        type="button"
                        onClick={() => onToggleSelection(resident.id)}
                        className={`flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-black ${selected ? "border-[#2f4f3f] bg-[#047857] text-white" : "border-[#dbe6e0] bg-white text-[#526174]"}`}
                        title="Pažymėti masinei komandai"
                      >
                        {selected ? "✓" : "+"}
                      </button>

                      <button type="button" onClick={() => onCycleStatus(resident.id)} className="text-left">
                        <p className="font-black text-[#10251f]">{residentName(resident)}</p>
                      </button>

                      <div className="text-sm font-bold text-[#526174]">{roomMap.get(String(resident.current_room_id || "")) || "—"}</div>

                      <button type="button" onClick={() => onCycleStatus(resident.id)} className="text-left">
                        {meta ? (
                          <span className={`inline-flex min-w-[120px] justify-center rounded-full border px-3 py-1 text-sm font-black ${meta.cellClass}`}>{meta.short} · {meta.label}</span>
                        ) : (
                          <span className="inline-flex min-w-[120px] justify-center rounded-full border border-[#dbe6e0] bg-[#f8faf8] px-3 py-1 text-sm font-black text-[#526174]">Nepažymėta</span>
                        )}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="p-10 text-center font-bold text-[#526174]">Gyventojų pagal filtrus nėra. Neatvykę, mirę arba visam laikui išvykę gyventojai veiklų lankomumui nerodomi.</div>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <article className={`rounded-2xl border p-3 ${warning ? "border-[#ead9a8] bg-[#fff8e6]" : "border-[#dbe6e0] bg-[#f8faf8]"}`}>
      <div className={`text-xs font-bold ${warning ? "text-[#7b5f1b]" : "text-[#526174]"}`}>{label}</div>
      <div className={`mt-1 truncate text-lg font-black capitalize ${warning ? "text-[#6a4c12]" : "text-[#10251f]"}`}>{value}</div>
    </article>
  );
}

function MiniStat({
  label,
  value,
  tone,
  active = false,
  onClick,
}: {
  label: string;
  value: string;
  tone: "slate" | "emerald" | "rose" | "amber" | "blue";
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClass = {
    slate: "bg-slate-50 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-white text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-5 text-left transition hover:scale-[1.01] hover:shadow-sm ${
        active ? "border-[#2f4f3f] ring-2 ring-[#047857] ring-offset-2" : "border-slate-200"
      } ${toneClass}`}
    >
      <p className="text-sm font-black uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-2 text-4xl font-black">{value}</p>
      <p className="mt-2 text-xs font-black opacity-70">{active ? "Filtras aktyvus" : "Spausk filtruoti"}</p>
    </button>
  );
}


function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#526174]">{label}</span>
      {children}
    </label>
  );
}


