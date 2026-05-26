"use client";

import ResidentActivityAttendanceAuto from "@/app/components/residents/ResidentActivityAttendanceAuto";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  FileText,
  Home,
  Lock,
  PackageMinus,
  Phone,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ActiveTab =
  | "kortele"
  | "kontaktai"
  | "planas"
  | "irasai"
  | "incidentai"
  | "prekes";

type Resident = {
  id: string;
  organization_id?: string | null;
  resident_code?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  current_status?: string | null;
  current_room_id?: string | null;
  room_id?: string | null;
  care_level?: string | null;
  birth_date?: string | null;
  admission_date?: string | null;
  arrival_date?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  internal_notes?: string | null;
  notes?: string | null;
  assigned_to?: string | null;
  responsible_employee_name?: string | null;
};

type Room = { id: string; name: string | null };

type StaffMember = {
  user_id: string;
  role: string | null;
  position: string | null;
  department: string | null;
  staff_type: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type ResidentAssignment = {
  resident_id: string;
  user_id: string;
  is_primary: boolean | null;
};

type Contact = {
  id: string;
  full_name: string | null;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  can_receive_info: boolean | null;
  is_primary: boolean | null;
};

type IsgpGoal = {
  id: string;
  title: string | null;
  description: string | null;
  actions: string | null;
  responsible: string | null;
  status: string | null;
  review_date: string | null;
};

type HandoverEntry = {
  id: string;
  category: string | null;
  title?: string | null;
  note: string | null;
  needs_follow_up: boolean | null;
  is_important?: boolean | null;
  priority?: string | null;
  shift_date?: string | null;
  shift_type?: string | null;
  archived?: boolean | null;
  created_at: string | null;
};

type Incident = {
  id: string;
  incident_type: string | null;
  severity: string | null;
  description: string | null;
  action_taken: string | null;
  occurred_at: string | null;
};

type MedicationLog = {
  id: string;
  medication_name: string | null;
  dose: string | null;
  taken_at: string | null;
  notes: string | null;
};

type ActivityAttendance = {
  id: string;
  resident_id?: string | null;
  session_id?: string | null;
  status: string | null;
  note: string | null;
  activity_title?: string | null;
  session_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

type InventoryIssue = {
  id: string;
  item_name: string | null;
  quantity: number | null;
  reason: string | null;
  note: string | null;
  created_at: string | null;
};

type CareTab = "slauga" | "rizikos" | "mityba" | "judejimas" | "pastabos";

type CareInfo = {
  allergies: string;
  allergy_valid_until: string;
  nursing_notes: string;
  fall_risk: boolean;
  diabetes: boolean;
  pressure_sore_risk: boolean;
  choking_risk: boolean;
  wandering_risk: boolean;
  risk_valid_until: string;
  nutrition_type: string;
  fluid_restriction: string;
  texture_notes: string;
  mobility_level: string;
  transfer_two_staff: boolean;
  mobility_aid: string;
  staff_notes: string;
  updated_by: string;
  updated_at: string;
};

const STATUS_OPTIONS = [
  { value: "netrukus_atvyks", label: "Netrukus atvyks" },
  { value: "gyvena", label: "Gyvena" },
  { value: "ligonineje", label: "Ligoninėje" },
  { value: "laikinai_isvykes", label: "Laikinai išvykęs" },
  { value: "sutartis_nutraukta", label: "Sutartis nutraukta" },
  { value: "mire", label: "Miręs" },
];

const CARE_LEVEL_OPTIONS = [
  { value: "", label: "Nepasirinkta" },
  { value: "savarankiskas", label: "Savarankiškas" },
  { value: "daline_slauga", label: "Dalinė slauga" },
  { value: "slauga", label: "Slauga" },
  { value: "intensyvi_slauga", label: "Intensyvi slauga" },
];

function text(value: unknown, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function isUuid(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function safeResponsible(value?: string | null) {
  if (!value || isUuid(value)) return "Nepriskirta";
  return value;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function firstParamValue(value: unknown) {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : "";
  if (typeof value === "string") return value;
  return "";
}

function getResidentIdFromPathname(pathname: string) {
  const cleanSegments = pathname
    .split("/")
    .map((segment) => decodeURIComponent(segment).trim())
    .filter(Boolean);

  return cleanSegments.find((segment) => isUuid(segment)) || "";
}

function resolveResidentId(
  params: Record<string, unknown> | null | undefined,
  searchParams: URLSearchParams | null,
) {
  const candidates = [
    firstParamValue(params?.id),
    firstParamValue(params?.residentId),
    firstParamValue(params?.resident_id),
    firstParamValue(params?.gyventojasId),
    firstParamValue(params?.slug),
    ...Object.values(params || {}).map(firstParamValue),
    searchParams?.get("id") || "",
    searchParams?.get("residentId") || "",
    searchParams?.get("resident_id") || "",
    searchParams?.get("gyventojasId") || "",
    typeof window !== "undefined"
      ? getResidentIdFromPathname(window.location.pathname)
      : "",
  ];

  return candidates.find((value) => isUuid(value)) || "";
}

function staffName(member?: StaffMember | null) {
  if (!member) return "";
  const full = String(member.full_name || "").trim();
  if (full) return full;
  const joined = [member.first_name, member.last_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  return joined || member.email || "";
}

function toDateInput(value: unknown) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatEntryDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);

  return date.toLocaleString("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status?: string | null) {
  const raw = String(status || "").toLowerCase();
  const map: Record<string, string> = {
    netrukus_atvyks: "Netrukus atvyks",
    reserved: "Netrukus atvyks",
    requested: "Netrukus atvyks",
    gyvena: "Gyvena",
    active: "Gyvena",
    ligonineje: "Ligoninėje",
    hospital: "Ligoninėje",
    laikinai_isvykes: "Laikinai išvykęs",
    temporarily_away: "Laikinai išvykęs",
    sutartis_nutraukta: "Sutartis nutraukta",
    moved_out: "Išvykęs",
    mire: "Miręs",
    inactive: "Neaktyvus",
    neaktyvus: "Neaktyvus",
  };
  return map[raw] || text(status, "Nežinoma");
}

function careLevelLabel(value?: string | null) {
  const found = CARE_LEVEL_OPTIONS.find((item) => item.value === value);
  return found?.label || text(value, "Nepasirinkta");
}

function normalizeName(resident: Resident | null) {
  const full = String(resident?.full_name || "").trim();
  if (full) return full;
  const joined = [resident?.first_name, resident?.last_name]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(" ");
  return joined || "Gyventojas";
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0)
    return {
      first_name: null as string | null,
      last_name: null as string | null,
    };
  if (parts.length === 1)
    return { first_name: parts[0], last_name: null as string | null };
  return {
    first_name: parts.slice(0, -1).join(" "),
    last_name: parts.slice(-1).join(" "),
  };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "G"}${parts[1]?.[0] || ""}`.toUpperCase();
}

function getReadableError(error: unknown) {
  if (!error) return "Nepavyko atlikti veiksmo.";
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const maybe = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    return [maybe.message, maybe.details, maybe.hint, maybe.code]
      .filter(Boolean)
      .join(" · ");
  }
  return String(error);
}

async function writeAuditLog(input: {
  organizationId: string | null | undefined;
  tableName: string;
  recordId: string | null;
  action: string;
  changes?: Record<string, unknown>;
}) {
  if (!input.organizationId) return;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      organization_id: input.organizationId,
      table_name: input.tableName,
      record_id: input.recordId,
      action: input.action,
      changed_by: user?.id || null,
      changed_at: new Date().toISOString(),
      changes: input.changes || {},
    };

    const attempts = [
      supabase.from("audit_log").insert(payload),
      supabase.from("audit_logs").insert({
        organization_id: payload.organization_id,
        table_name: payload.table_name,
        record_id: payload.record_id,
        action: payload.action,
        user_id: payload.changed_by,
        created_at: payload.changed_at,
        changes: payload.changes,
        metadata: payload.changes,
      } as any),
    ];

    for (const attempt of attempts) {
      const { error } = await attempt;
      if (!error) return;
    }
  } catch {
    // Auditas neturi nulaužti pagrindinio veiksmo.
  }
}

function localGoalsKey(residentId: string) {
  return `resident-isgp-goals:${residentId}`;
}

function loadLocalGoals(residentId: string): IsgpGoal[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(
      window.localStorage.getItem(localGoalsKey(residentId)) || "[]",
    );
  } catch {
    return [];
  }
}

function saveLocalGoals(residentId: string, rows: IsgpGoal[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localGoalsKey(residentId), JSON.stringify(rows));
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "green" | "blue" | "warning" | "danger" | "neutral";
}) {
  const tones = {
    green: "border-[#c9d8d0] bg-white/10 text-white",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-[#dbe6e0] bg-[#f8faf8] text-[#526174]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-[#dbe6e0] bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <h2 className="text-[17px] font-black tracking-tight text-[#10251f]">
          {title}
        </h2>
        {action}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

function InfoNotice({
  title,
  children,
  tone = "green",
}: {
  title: string;
  children: ReactNode;
  tone?: "green" | "amber" | "blue";
}) {
  const tones = {
    green: "border-emerald-100 bg-emerald-50 text-emerald-900",
    amber: "border-amber-100 bg-amber-50 text-amber-900",
    blue: "border-blue-100 bg-blue-50 text-blue-900",
  };

  return (
    <div className={`rounded-[18px] border p-4 ${tones[tone]}`}>
      <div className="mb-1 flex items-center gap-2 text-sm font-black">
        <ShieldAlert size={16} />
        {title}
      </div>
      <div className="text-sm font-bold leading-6 opacity-90">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  masked,
}: {
  label: string;
  value: ReactNode;
  masked?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 text-sm">
      <div className="font-semibold text-[#66756c]">{label}</div>
      <div className="break-words font-extrabold text-[#10251f]">
        {masked ? (
          <span className="inline-flex rounded-lg bg-[#eef4f1] px-2 py-1 text-xs font-black text-[#66756c]">
            {value}
          </span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function CompactStat({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
}) {
  return (
    <div className="rounded-[14px] border border-[#c9d8d0] bg-white p-4 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[#eef4f1] text-[#486b5d]">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="truncate text-2xl font-black leading-none text-[#10251f]">
            {value}
          </div>
          <div className="mt-1 text-sm font-bold text-[#66756c]">{label}</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-black text-[#486b5d]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-12 w-full rounded-[18px] border border-[#dbe6e0] bg-white px-4 text-sm font-bold text-[#10251f] outline-none transition focus:border-[#047857] focus:ring-4 focus:ring-[#047857]/10";
const textareaClass =
  "min-h-[108px] w-full rounded-[18px] border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-bold text-[#10251f] outline-none transition focus:border-[#047857] focus:ring-4 focus:ring-[#047857]/10";

const emptyContact = {
  full_name: "",
  relationship: "",
  phone: "",
  email: "",
  can_receive_info: true,
  is_primary: false,
};
const emptyGoal = {
  title: "",
  description: "",
  actions: "",
  responsible: "",
  status: "aktyvus",
  review_date: "",
};
const emptyEntry = { category: "Bendra", note: "", needs_follow_up: false };
const emptyIncident = {
  incident_type: "",
  severity: "vidutinis",
  description: "",
  action_taken: "",
  occurred_at: new Date().toISOString().slice(0, 16),
};
const emptyWriteOff = { item_name: "", quantity: "1", reason: "", note: "" };

const emptyCareInfo: CareInfo = {
  allergies: "",
  allergy_valid_until: "",
  nursing_notes: "",
  fall_risk: false,
  diabetes: false,
  pressure_sore_risk: false,
  choking_risk: false,
  wandering_risk: false,
  risk_valid_until: "",
  nutrition_type: "",
  fluid_restriction: "",
  texture_notes: "",
  mobility_level: "",
  transfer_two_staff: false,
  mobility_aid: "",
  staff_notes: "",
  updated_by: "",
  updated_at: "",
};

const CARE_TABS: Array<{ value: CareTab; label: string }> = [
  { value: "slauga", label: "Slauga" },
  { value: "rizikos", label: "Rizikos" },
  { value: "mityba", label: "Mityba" },
  { value: "judejimas", label: "Judėjimas" },
  { value: "pastabos", label: "Pastabos darbuotojams" },
];

const NUTRITION_OPTIONS = [
  { value: "", label: "Nepasirinkta" },
  { value: "iprasta", label: "Įprasta mityba" },
  { value: "diabetine", label: "Diabetinė mityba" },
  { value: "trinta", label: "Trinta / minkšta" },
  { value: "maitinamas", label: "Reikia pagalbos maitinant" },
  { value: "zondas", label: "Maitinimas per zondą" },
  { value: "kita", label: "Kita" },
];

const MOBILITY_OPTIONS = [
  { value: "", label: "Nepasirinkta" },
  { value: "savarankiskas", label: "Savarankiškas" },
  { value: "su_pagalba", label: "Su pagalba" },
  { value: "vaikstyne", label: "Su vaikštyne / lazdele" },
  { value: "vezimelis", label: "Vežimėlis" },
  { value: "gulimas", label: "Gulimas" },
];

export default function ResidentDetailPage() {
  const params = useParams<Record<string, string | string[]>>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const residentId = useMemo(
    () => resolveResidentId(params, searchParams),
    [params, searchParams],
  );

  const [resident, setResident] = useState<Resident | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [assignedStaffIds, setAssignedStaffIds] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [goals, setGoals] = useState<IsgpGoal[]>([]);
  const [entries, setEntries] = useState<HandoverEntry[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [medications, setMedications] = useState<MedicationLog[]>([]);
  const [activity, setActivity] = useState<ActivityAttendance[]>([]);
  const [inventory, setInventory] = useState<InventoryIssue[]>([]);

  const [activeTab, setActiveTab] = useState<ActiveTab>("kortele");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [careModalOpen, setCareModalOpen] = useState(false);
  const [careTab, setCareTab] = useState<CareTab>("slauga");

  const [form, setForm] = useState({
    full_name: "",
    resident_code: "",
    current_status: "gyvena",
    current_room_id: "",
    care_level: "",
    birth_date: "",
    admission_date: "",
    phone: "",
    email: "",
    address: "",
    internal_notes: "",
  });

  const [contactForm, setContactForm] = useState(emptyContact);
  const [goalForm, setGoalForm] = useState(emptyGoal);
  const [entryForm, setEntryForm] = useState(emptyEntry);
  const [incidentForm, setIncidentForm] = useState(emptyIncident);
  const [writeOffForm, setWriteOffForm] = useState(emptyWriteOff);
  const [careInfo, setCareInfo] = useState<CareInfo>(emptyCareInfo);

  const residentName = normalizeName(resident);

  const roomLabel = useMemo(() => {
    const roomId = resident?.current_room_id || resident?.room_id || "";
    const found = rooms.find((room) => room.id === roomId);
    return found?.name || text(roomId, "—");
  }, [resident?.current_room_id, resident?.room_id, rooms]);

  const assignedStaffNames = useMemo(() => {
    return uniqueValues(assignedStaffIds)
      .map((id) =>
        staffName(staffMembers.find((member) => member.user_id === id)),
      )
      .filter(Boolean);
  }, [assignedStaffIds, staffMembers]);

  const responsibleName = assignedStaffNames.length
    ? assignedStaffNames.join(", ")
    : safeResponsible(
        resident?.responsible_employee_name || resident?.assigned_to,
      );

  const nutritionLabel =
    NUTRITION_OPTIONS.find((option) => option.value === careInfo.nutrition_type)
      ?.label || "Nepasirinkta";

  const mobilityLabel =
    MOBILITY_OPTIONS.find((option) => option.value === careInfo.mobility_level)
      ?.label || "Nepasirinkta";

  const activeRiskLabels = [
    careInfo.fall_risk ? "kritimo" : "",
    careInfo.diabetes ? "diabeto" : "",
    careInfo.pressure_sore_risk ? "pragulų" : "",
    careInfo.choking_risk ? "springimo" : "",
    careInfo.wandering_risk ? "paklydimo" : "",
  ].filter(Boolean);

  const updateCareInfo = (patch: Partial<CareInfo>) => {
    setCareInfo((prev) => ({ ...prev, ...patch }));
  };

  async function safeSelect<T>(
    table: string,
    callback: (query: any) => Promise<{ data: T[] | null; error: any }>,
  ) {
    try {
      const query = supabase.from(table).select("*");
      const { data, error } = await callback(query);
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  }

  async function loadCareInfo(currentResidentId: string) {
    const storageKey = `resident-care-info:${currentResidentId}`;

    try {
      const { data, error } = await supabase
        .from("resident_care_information")
        .select("*")
        .eq("resident_id", currentResidentId)
        .maybeSingle();

      if (!error && data) {
        setCareInfo({ ...emptyCareInfo, ...(data as Partial<CareInfo>) });
        return;
      }
    } catch {
      // Lentelė gali būti dar nesukurta – UI vis tiek veikia, o saugojimas turi atsarginį localStorage kelią.
    }

    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        try {
          setCareInfo({ ...emptyCareInfo, ...JSON.parse(saved) });
          return;
        } catch {
          setCareInfo(emptyCareInfo);
        }
      }
    }

    setCareInfo(emptyCareInfo);
  }

  async function loadData() {
    if (!residentId) {
      setLoading(false);
      setErrorText(
        "Nepavyko nustatyti gyventojo ID iš puslapio adreso. Patikrink, ar šis failas įdėtas į dinaminį maršrutą app/(app)/residents/[id]/page.tsx, o ne į app/(app)/residents/page.tsx.",
      );
      return;
    }

    setLoading(true);
    setErrorText("");

    try {
      const { data: residentData, error: residentError } = await supabase
        .from("residents")
        .select("*")
        .eq("id", residentId)
        .single();

      if (residentError) throw residentError;

      const nextResident = residentData as Resident;
      setResident(nextResident);
      setForm({
        full_name: normalizeName(nextResident),
        resident_code: text(nextResident.resident_code, ""),
        current_status: String(nextResident.current_status || "gyvena"),
        current_room_id: String(
          nextResident.current_room_id || nextResident.room_id || "",
        ),
        care_level: String(nextResident.care_level || ""),
        birth_date: toDateInput(nextResident.birth_date),
        admission_date: toDateInput(
          nextResident.admission_date || nextResident.arrival_date,
        ),
        phone: text(nextResident.phone, ""),
        email: text(nextResident.email, ""),
        address: text(nextResident.address, ""),
        internal_notes: text(
          nextResident.internal_notes || nextResident.notes,
          "",
        ),
      });

      const organizationId = nextResident.organization_id;
      const roomsQuery = supabase
        .from("rooms")
        .select("id,name")
        .order("name", { ascending: true });
      const { data: roomData } = organizationId
        ? await roomsQuery.eq("organization_id", organizationId)
        : await roomsQuery;
      setRooms((roomData || []) as Room[]);

      let staff: StaffMember[] = [];
      if (organizationId) {
        const membersResult = await supabase
          .from("organization_members")
          .select("user_id, role, position, department, staff_type, is_active")
          .eq("organization_id", organizationId)
          .eq("is_active", true);

        const userIds = (membersResult.data || [])
          .map((member: any) => member.user_id)
          .filter(Boolean);

        let profiles = new Map<string, any>();

        if (userIds.length > 0) {
          const profilesResult = await supabase
            .from("profiles")
            .select("id, full_name, first_name, last_name, email")
            .in("id", userIds);

          profiles = new Map(
            (profilesResult.data || []).map((profile: any) => [
              profile.id,
              profile,
            ]),
          );
        }

        staff = (membersResult.data || []).map((member: any) => {
          const profile = profiles.get(member.user_id);

          return {
            user_id: member.user_id,
            role: member.role || null,
            position: member.position || null,
            department: member.department || null,
            staff_type: member.staff_type || null,
            full_name: profile?.full_name || null,
            first_name: profile?.first_name || null,
            last_name: profile?.last_name || null,
            email: profile?.email || null,
          };
        });
      }

      setStaffMembers(staff);

      let nextAssignedIds: string[] = [];
      try {
        const assignmentsResult = await supabase
          .from("resident_assignments")
          .select("resident_id, user_id, is_primary")
          .eq("resident_id", residentId);

        if (!assignmentsResult.error) {
          nextAssignedIds = (
            (assignmentsResult.data || []) as ResidentAssignment[]
          )
            .map((assignment) => assignment.user_id)
            .filter(Boolean);
        }
      } catch {
        nextAssignedIds = [];
      }

      if (nextResident.assigned_to) {
        nextAssignedIds = uniqueValues([
          ...nextAssignedIds,
          nextResident.assigned_to,
        ]);
      }

      setAssignedStaffIds(nextAssignedIds);

      setContacts(
        await safeSelect<Contact>("resident_contacts", (q) =>
          q
            .eq("resident_id", residentId)
            .order("is_primary", { ascending: false }),
        ),
      );
      setGoals(loadLocalGoals(residentId));
      setEntries(
        await safeSelect<HandoverEntry>("handover_logs", (q) =>
          q
            .eq("resident_id", residentId)
            .neq("archived", true)
            .order("shift_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(50),
        ),
      );
      setIncidents(
        await safeSelect<Incident>("resident_incidents", (q) =>
          q
            .eq("resident_id", residentId)
            .order("created_at", { ascending: false }),
        ),
      );
      setMedications(
        await safeSelect<MedicationLog>("medication_logs", (q) =>
          q
            .eq("resident_id", residentId)
            .order("taken_at", { ascending: false })
            .limit(10),
        ),
      );
      setActivity(
        await safeSelect<ActivityAttendance>(
          "resident_activity_attendance_view",
          (q) =>
            q
              .eq("resident_id", residentId)
              .order("session_date", { ascending: false })
              .order("start_time", { ascending: false })
              .limit(10),
        ),
      );
      setInventory(
        await safeSelect<InventoryIssue>("inventory_issue_history", (q) =>
          q
            .eq("resident_id", residentId)
            .order("created_at", { ascending: false })
            .limit(20),
        ),
      );

      await loadCareInfo(residentId);
    } catch (error) {
      setErrorText(getReadableError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [residentId]);

  async function saveResident() {
    if (!residentId) return;
    setSaving(true);
    setErrorText("");
    setSuccessText("");

    try {
      const nameParts = splitName(form.full_name);
      const payload = {
        full_name: form.full_name.trim() || null,
        first_name: nameParts.first_name,
        last_name: nameParts.last_name,
        resident_code: form.resident_code.trim() || null,
        current_status: form.current_status || null,
        current_room_id: form.current_room_id || null,
        care_level: form.care_level || null,
        birth_date: form.birth_date || null,
        admission_date: form.admission_date || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        internal_notes: form.internal_notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("residents")
        .update(payload)
        .eq("id", residentId)
        .select("*")
        .single();
      if (error) throw error;
      setResident(data as Resident);
      await writeAuditLog({
        organizationId: resident?.organization_id,
        tableName: "residents",
        recordId: residentId,
        action: "update",
        changes: {
          Veiksmas: "Gyventojo kortelė atnaujinta",
          Gyventojas: form.full_name.trim() || residentName,
          Statusas: form.current_status,
          Kambarys: form.current_room_id || null,
          Priežiūros_ligis: form.care_level || null,
        },
      });
      setSuccessText("Gyventojo kortelė išsaugota.");
    } catch (error) {
      setErrorText(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function insertRow(
    table: string,
    payload: Record<string, unknown>,
    success: string,
  ) {
    if (!residentId) return;
    setSaving(true);
    setErrorText("");
    setSuccessText("");

    try {
      const { data, error } = await supabase
        .from(table)
        .insert({
          organization_id: resident?.organization_id || null,
          resident_id: residentId,
          ...payload,
        })
        .select("id")
        .single();
      if (error) throw error;

      await writeAuditLog({
        organizationId: resident?.organization_id,
        tableName: table,
        recordId: data?.id || residentId,
        action: "insert",
        changes: {
          Veiksmas: success,
          Gyventojas: residentName,
          ...payload,
        },
      });

      setSuccessText(success);
      await loadData();
    } catch (error) {
      setErrorText(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(table: string, id: string, success: string) {
    setSaving(true);
    setErrorText("");
    setSuccessText("");

    try {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;

      await writeAuditLog({
        organizationId: resident?.organization_id,
        tableName: table,
        recordId: id,
        action: "delete",
        changes: {
          Veiksmas: success,
          Gyventojas: residentName,
        },
      });

      setSuccessText(success);
      await loadData();
    } catch (error) {
      setErrorText(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function archiveHandoverEntry(entry: HandoverEntry) {
    setSaving(true);
    setErrorText("");
    setSuccessText("");

    try {
      const { error } = await supabase
        .from("handover_logs")
        .update({ archived: true, updated_at: new Date().toISOString() })
        .eq("id", entry.id);

      if (error) throw error;

      await writeAuditLog({
        organizationId: resident?.organization_id,
        tableName: "handover_logs",
        recordId: entry.id,
        action: "update",
        changes: {
          Veiksmas: "Perdavimo įrašas archyvuotas",
          Gyventojas: residentName,
          Pavadinimas: entry.title || entry.category || "Perdavimo įrašas",
          archived: { from: false, to: true },
        },
      });

      setSuccessText("Perdavimo įrašas archyvuotas.");
      await loadData();
    } catch (error) {
      setErrorText(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function addContact() {
    if (!contactForm.full_name.trim()) {
      setErrorText("Įrašyk kontakto vardą.");
      return;
    }

    await insertRow(
      "resident_contacts",
      {
        full_name: contactForm.full_name.trim(),
        relationship: contactForm.relationship.trim() || null,
        phone: contactForm.phone.trim() || null,
        email: contactForm.email.trim() || null,
        can_receive_info: contactForm.can_receive_info,
        is_primary: contactForm.is_primary,
      },
      "Kontaktas pridėtas.",
    );
    setContactForm(emptyContact);
  }

  async function addGoal() {
    if (!goalForm.title.trim()) {
      setErrorText("Įrašyk ISGP tikslo pavadinimą.");
      return;
    }

    const nextGoal: IsgpGoal = {
      id: `local-${Date.now()}`,
      title: goalForm.title.trim(),
      description: goalForm.description.trim() || null,
      actions: goalForm.actions.trim() || null,
      responsible: goalForm.responsible.trim() || null,
      status: goalForm.status || "aktyvus",
      review_date: goalForm.review_date || null,
    };

    const nextGoals = [nextGoal, ...goals];
    setGoals(nextGoals);
    saveLocalGoals(residentId, nextGoals);

    await writeAuditLog({
      organizationId: resident?.organization_id,
      tableName: "resident_isgp_goals",
      recordId: residentId,
      action: "insert",
      changes: {
        Veiksmas: "ISGP tikslas pridėtas",
        Gyventojas: residentName,
        Pavadinimas: nextGoal.title,
        Atsakingas: nextGoal.responsible,
        Statusas: nextGoal.status,
      },
    });

    setSuccessText("ISGP tikslas pridėtas.");
    setGoalForm(emptyGoal);
  }

  async function addEntry() {
    if (!entryForm.note.trim()) {
      setErrorText("Įrašyk perdavimo žurnalo pastabą.");
      return;
    }

    await insertRow(
      "handover_logs",
      {
        shift_date: new Date().toISOString().slice(0, 10),
        shift_type: "day",
        category: entryForm.category.trim() || "Bendra",
        priority: entryForm.needs_follow_up ? "high" : "medium",
        title: entryForm.category.trim() || "Perdavimo įrašas",
        note: entryForm.note.trim(),
        is_important: Boolean(entryForm.needs_follow_up),
        needs_follow_up: entryForm.needs_follow_up,
        archived: false,
        created_by: currentUserId || null,
        updated_by: currentUserId || null,
      },
      "Perdavimo įrašas pridėtas.",
    );
    setEntryForm(emptyEntry);
  }

  async function addIncident() {
    if (!incidentForm.description.trim()) {
      setErrorText("Įrašyk incidento aprašymą.");
      return;
    }

    await insertRow(
      "resident_incidents",
      {
        incident_type: incidentForm.incident_type.trim() || "Kita",
        severity: incidentForm.severity || "vidutinis",
        description: incidentForm.description.trim(),
        action_taken: incidentForm.action_taken.trim() || null,
        created_at: incidentForm.occurred_at
          ? new Date(incidentForm.occurred_at).toISOString()
          : new Date().toISOString(),
      },
      "Incidentas pridėtas.",
    );
    setIncidentForm(emptyIncident);
  }

  async function submitWriteOff() {
    const quantity = Number(writeOffForm.quantity || 0);

    if (!writeOffForm.item_name.trim()) {
      setErrorText("Įrašyk prekės pavadinimą.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setErrorText("Kiekis turi būti didesnis nei 0.");
      return;
    }

    await insertRow(
      "inventory_issue_history",
      {
        item_name: writeOffForm.item_name.trim(),
        quantity,
        reason: writeOffForm.reason.trim() || "Nurašyta gyventojui",
        note: writeOffForm.note.trim() || null,
      },
      "Prekė nurašyta.",
    );
    setWriteOffOpen(false);
    setWriteOffForm(emptyWriteOff);
  }

  async function saveCareInfo() {
    if (!residentId) return;
    setSaving(true);
    setErrorText("");
    setSuccessText("");

    const nextCareInfo: CareInfo = {
      ...careInfo,
      updated_by: responsibleName || "Darbuotojas",
      updated_at: new Date().toISOString(),
    };

    try {
      const payload = {
        organization_id: resident?.organization_id || null,
        resident_id: residentId,
        ...nextCareInfo,
      };

      const { data, error } = await supabase
        .from("resident_care_information")
        .upsert(payload, { onConflict: "resident_id" })
        .select("*")
        .single();

      if (error) throw error;
      setCareInfo({ ...emptyCareInfo, ...(data as Partial<CareInfo>) });
      await writeAuditLog({
        organizationId: resident?.organization_id,
        tableName: "resident_care_information",
        recordId: residentId,
        action: "upsert",
        changes: {
          Veiksmas: "Priežiūros informacija išsaugota",
          Gyventojas: residentName,
          Alergijos: nextCareInfo.allergies || null,
          Mityba: nextCareInfo.nutrition_type || null,
          Judėjimas: nextCareInfo.mobility_level || null,
          Rizikos: [
            nextCareInfo.fall_risk ? "kritimo" : "",
            nextCareInfo.diabetes ? "diabeto" : "",
            nextCareInfo.pressure_sore_risk ? "pragulų" : "",
            nextCareInfo.choking_risk ? "springimo" : "",
            nextCareInfo.wandering_risk ? "paklydimo" : "",
          ].filter(Boolean),
        },
      });
      setSuccessText("Priežiūros informacija išsaugota.");
      setCareModalOpen(false);
    } catch (error) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `resident-care-info:${residentId}`,
          JSON.stringify(nextCareInfo),
        );
      }
      setCareInfo(nextCareInfo);
      setSuccessText(
        "Priežiūros informacija išsaugota naršyklėje. Jei nori saugoti DB, sukurk lentelę resident_care_information.",
      );
      setCareModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const tabs: { value: ActiveTab; label: string; icon: ReactNode }[] = [
    { value: "kortele", label: "Kortelė", icon: <User size={17} /> },
    { value: "kontaktai", label: "Kontaktai", icon: <Users size={17} /> },
    { value: "planas", label: "Planas", icon: <FileText size={17} /> },
    { value: "irasai", label: "Įrašai", icon: <ClipboardList size={17} /> },
    {
      value: "incidentai",
      label: "Incidentai",
      icon: <AlertTriangle size={17} />,
    },
    { value: "prekes", label: "Prekės", icon: <PackageMinus size={17} /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7f4] px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-[1500px] rounded-[22px] border border-[#dbe6e0] bg-white p-8 text-sm font-black text-[#66756c] shadow-sm">
          Kraunama gyventojo kortelė...
        </div>
      </div>
    );
  }

  if (!resident) {
    return (
      <div className="min-h-screen bg-[#f5f7f4] px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-[1500px] rounded-[22px] border border-[#dbe6e0] bg-white p-8 shadow-sm">
          <button
            type="button"
            onClick={() => router.push("/residents")}
            className="mb-5 inline-flex items-center gap-2 text-sm font-black text-[#486b5d]"
          >
            <ArrowLeft size={18} />
            Grįžti į gyventojus
          </button>
          <h1 className="text-2xl font-black text-[#10251f]">
            Gyventojas nerastas
          </h1>
          {errorText ? (
            <p className="mt-3 text-sm font-bold text-red-700">{errorText}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f6f4] px-4 py-5 text-[#10251f] lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/residents")}
            className="inline-flex items-center gap-2 rounded-xl px-1 py-2 text-sm font-black text-[#486b5d] hover:text-[#10251f]"
          >
            <ArrowLeft size={18} />
            Grįžti į gyventojus
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveResident}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-[14px] border border-[#c9d8d0] bg-white px-4 py-3 text-sm font-black text-[#486b5d] shadow-sm transition hover:bg-[#f8faf8] disabled:opacity-60"
            >
              <Save size={17} />
              {saving ? "Saugoma..." : "Išsaugoti"}
            </button>
            <button
              type="button"
              onClick={() => setWriteOffOpen(true)}
              className="inline-flex items-center gap-2 rounded-[14px] bg-[#047857] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#036747]"
            >
              <Plus size={18} />
              Nurašyti prekę
            </button>
          </div>
        </div>

        {errorText ? (
          <div className="mb-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {errorText}
          </div>
        ) : null}
        {successText ? (
          <div className="mb-4 rounded-[18px] border border-[#c9d8d0] bg-emerald-50 px-4 py-3 text-sm font-bold text-[#486b5d]">
            {successText}
          </div>
        ) : null}

        <section className="mb-5 overflow-hidden rounded-[22px] border border-[#c9d8d0] bg-white shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
          <div className="grid gap-5 bg-[#486b5d] p-5 text-white lg:grid-cols-[1fr_420px] lg:items-center">
            <div className="flex items-center gap-5">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[24px] bg-emerald-50 text-3xl font-black text-[#486b5d]">
                {initials(residentName)}
              </div>
              <div className="min-w-0">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-[#486b5d]">
                  Gyventojo kortelė
                </div>
                <h1 className="truncate text-3xl font-black tracking-[-0.035em] text-white lg:text-4xl">
                  {residentName}
                </h1>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="neutral">
                    {text(resident.resident_code, "Be kodo")}
                  </Badge>
                  <Badge
                    tone={
                      statusLabel(resident.current_status) === "Gyvena"
                        ? "green"
                        : "blue"
                    }
                  >
                    {statusLabel(resident.current_status)}
                  </Badge>
                  <Badge tone="blue">Kambarys {roomLabel}</Badge>
                  <Badge tone="warning">
                    {careLevelLabel(resident.care_level)}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/20 bg-white p-4 text-sm text-[#10251f] shadow-sm">
              <div className="mb-2 flex items-center gap-2 font-black text-[#486b5d]">
                <ShieldAlert size={17} className="text-amber-600" />
                BDAR saugi peržiūra
              </div>
              <p className="leading-6 text-[#526174]">
                Rodomi tik darbui būtini duomenys. Jautri informacija maskuojama
                arba rodoma tik pagal teises.
              </p>
            </div>
          </div>
        </section>

        <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <CompactStat
            icon={<PackageMinus size={20} />}
            value={inventory.length}
            label="Sandėlio judėjimų"
          />
          <CompactStat
            icon={<CalendarDays size={20} />}
            value={medications.length}
            label="Vaistų įrašų"
          />
          <CompactStat
            icon={<CalendarDays size={20} />}
            value={activity.length}
            label="Veiklų įrašų"
          />
          <CompactStat
            icon={<Home size={20} />}
            value={roomLabel}
            label="Kambarys"
          />
          <CompactStat
            icon={<User size={20} />}
            value={responsibleName}
            label="Atsakingas darbuotojas"
          />
        </div>

        <div className="mb-5 flex flex-wrap gap-2 rounded-[22px] border border-[#c9d8d0] bg-[#eef4f1] p-3 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-3 text-sm font-black transition ${isActive ? "border border-[#c9d8d0] bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]" : "text-[#526174] hover:bg-white/70 hover:text-[#10251f]"}`}
              >
                <span className="text-inherit">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === "kortele" ? (
          <div className="grid gap-5 2xl:grid-cols-[320px_minmax(0,1fr)_340px] xl:grid-cols-1">
            <div className="grid gap-5">
              <Card
                title="Pagrindinė info"
                action={<Badge tone="neutral">BDAR</Badge>}
              >
                <div className="space-y-3">
                  <InfoRow label="Kodas" value={text(resident.resident_code)} />
                  <InfoRow
                    label="Statusas"
                    value={statusLabel(resident.current_status)}
                  />
                  <InfoRow label="Gimimo data" value={text(form.birth_date)} />
                  <InfoRow
                    label="Atvykimas"
                    value={text(form.admission_date)}
                  />
                  <InfoRow label="Telefonas" value={text(form.phone)} />
                  <InfoRow label="Asmens kodas" value="•••••••••••" masked />
                </div>
              </Card>

              <Card
                title="Kontaktai"
                action={
                  <button
                    type="button"
                    onClick={() => setActiveTab("kontaktai")}
                    className="text-xs font-black text-[#486b5d]"
                  >
                    Pildyti
                  </button>
                }
              >
                {contacts.length ? (
                  <div className="space-y-3">
                    {contacts.slice(0, 2).map((contact) => (
                      <div
                        key={contact.id}
                        className="rounded-[18px] border border-[#dbe6e0] bg-[#f8faf8] p-3"
                      >
                        <div className="font-black text-[#10251f]">
                          {text(contact.full_name, "Kontaktas")}
                        </div>
                        <div className="mt-1 text-sm font-bold text-[#66756c]">
                          {text(contact.relationship)}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-sm font-bold text-[#486b5d]">
                          <Phone size={15} />
                          {text(contact.phone)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-dashed border-slate-300 bg-[#f8faf8] p-4 text-sm font-bold text-[#66756c]">
                    Kontaktų dar nėra.
                  </div>
                )}
              </Card>

              <Card title="Apgyvendinimas">
                <div className="space-y-3">
                  <InfoRow label="Kambarys" value={roomLabel} />
                  <InfoRow
                    label="Priežiūra"
                    value={careLevelLabel(resident.care_level)}
                  />
                  <InfoRow label="Atsakingas" value={responsibleName} />
                </div>
              </Card>
            </div>

            <div className="grid gap-5">
              <section className="rounded-[26px] border border-[#dbe6e0] bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black tracking-[-0.03em]">
                      Redaguojama kortelės santrauka
                    </h2>
                    <p className="mt-1 text-sm font-bold text-[#66756c]">
                      Naujo gyventojo kūrimo forma neliečiama.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={saveResident}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-[14px] bg-[#047857] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#036747] disabled:opacity-60"
                  >
                    <Save size={17} />
                    {saving ? "Saugoma..." : "Išsaugoti"}
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Vardas ir pavardė">
                    <input
                      className={inputClass}
                      value={form.full_name}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          full_name: event.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field label="Vidinis gyventojo ID">
                    <input
                      className={inputClass}
                      value={form.resident_code}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          resident_code: event.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field label="Statusas">
                    <select
                      className={inputClass}
                      value={form.current_status}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          current_status: event.target.value,
                        }))
                      }
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Kambarys">
                    <select
                      className={inputClass}
                      value={form.current_room_id}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          current_room_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Nepriskirta</option>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name || room.id}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Gimimo data">
                    <input
                      type="date"
                      className={inputClass}
                      value={form.birth_date}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          birth_date: event.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field label="Atvykimo data">
                    <input
                      type="date"
                      className={inputClass}
                      value={form.admission_date}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          admission_date: event.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field label="Priežiūros lygis">
                    <select
                      className={inputClass}
                      value={form.care_level}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          care_level: event.target.value,
                        }))
                      }
                    >
                      {CARE_LEVEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Telefonas">
                    <input
                      className={inputClass}
                      value={form.phone}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field label="El. paštas">
                    <input
                      className={inputClass}
                      value={form.email}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field label="Adresas">
                    <input
                      className={inputClass}
                      value={form.address}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          address: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="Praktinės pastabos darbuotojams">
                    <textarea
                      className={textareaClass}
                      value={form.internal_notes}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          internal_notes: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              </section>

              <Card
                title="ISGP santrauka"
                action={
                  <button
                    type="button"
                    onClick={() => setActiveTab("planas")}
                    className="text-xs font-black text-[#486b5d]"
                  >
                    Pildyti planą
                  </button>
                }
              >
                {goals.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {goals.slice(0, 4).map((goal) => (
                      <div
                        key={goal.id}
                        className="rounded-[18px] border border-emerald-100 bg-emerald-50 p-4"
                      >
                        <div className="font-black text-emerald-900">
                          {text(goal.title)}
                        </div>
                        <p className="mt-1 text-sm font-bold leading-6 text-emerald-800">
                          {text(goal.actions || goal.description)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-dashed border-slate-300 bg-[#f8faf8] p-4 text-sm font-bold text-[#66756c]">
                    ISGP tikslų dar nėra. Eik į „Planas“ ir pridėk.
                  </div>
                )}
              </Card>

              <ResidentActivityAttendanceAuto />
            </div>

            <div className="grid gap-5">
              <Card
                title="Priežiūros / rizikų santrauka"
                action={<Badge tone="danger">Ribota</Badge>}
              >
                <div className="space-y-4">
                  <InfoNotice title="Kur pildyti?" tone="amber">
                    Ši kortelė rodo tik trumpą perspėjimų santrauką. Alergijos,
                    mityba, judėjimas ir priežiūros rizikos pildomos atskirame
                    lange, kad ISGP planas nesimaišytų su slaugos informacija.
                  </InfoNotice>

                  <div className="space-y-3">
                    <InfoRow
                      label="Alergijos"
                      value={
                        careInfo.allergies ? careInfo.allergies : "Neįrašyta"
                      }
                    />
                    <InfoRow
                      label="Kritinės rizikos"
                      value={
                        activeRiskLabels.length
                          ? activeRiskLabels.join(", ")
                          : incidents.length
                            ? `${incidents.length} incidentų įraš.`
                            : "Nėra pažymėtų"
                      }
                    />
                    <InfoRow label="Mityba" value={nutritionLabel} />
                    <InfoRow label="Judėjimas" value={mobilityLabel} />
                  </div>

                  {careInfo.transfer_two_staff ? (
                    <div className="rounded-[18px] border border-red-200 bg-red-50 p-3 text-sm font-black text-red-800">
                      Reikia 2 darbuotojų perkėlimui.
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      setCareTab("slauga");
                      setCareModalOpen(true);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#047857] px-5 py-3 text-sm font-black text-white hover:bg-[#036747]"
                  >
                    <ShieldAlert size={17} />
                    Atidaryti priežiūros informaciją
                  </button>
                </div>
              </Card>

              <Card
                title="Vaistai"
                action={<Badge tone="blue">Iš vaistų modulio</Badge>}
              >
                <div className="grid gap-3">
                  {medications.length ? (
                    medications.slice(0, 4).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between rounded-[18px] border border-[#dbe6e0] bg-[#f8faf8] p-3"
                      >
                        <div>
                          <div className="font-black">
                            {text(log.medication_name)}
                          </div>
                          <div className="text-sm font-bold text-[#66756c]">
                            {text(log.dose)} · {text(log.taken_at)}
                          </div>
                        </div>
                        <Badge tone="green">Įrašyta</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-slate-300 bg-[#f8faf8] p-4 text-sm font-bold text-[#66756c]">
                      Vaistų įrašų dar nėra.
                    </div>
                  )}
                </div>
              </Card>

              <Card
                title="Perdavimo žurnalas"
                action={
                  <button
                    type="button"
                    onClick={() => setActiveTab("irasai")}
                    className="text-xs font-black text-[#486b5d]"
                  >
                    Pildyti
                  </button>
                }
              >
                <div className="grid gap-3">
                  {entries.length ? (
                    entries.slice(0, 3).map((entry) => (
                      <div
                        key={entry.id}
                        className="grid grid-cols-[72px_1fr] gap-3 rounded-[18px] border border-[#dbe6e0] bg-[#f8faf8] p-3"
                      >
                        <div className="text-xs font-black text-[#66756c]">
                          {toDateInput(entry.shift_date || entry.created_at)}
                        </div>
                        <div>
                          <div className="text-sm font-black text-[#10251f]">
                            {text(entry.category)}
                          </div>
                          <p className="mt-1 text-sm font-bold leading-5 text-[#526174]">
                            {text(entry.note)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-slate-300 bg-[#f8faf8] p-4 text-sm font-bold text-[#66756c]">
                      Perdavimo įrašų dar nėra.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        ) : null}

        {activeTab === "kontaktai" ? (
          <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <Card title="Pridėti kontaktą">
              <div className="grid gap-4">
                <Field label="Vardas, pavardė">
                  <input
                    className={inputClass}
                    value={contactForm.full_name}
                    onChange={(e) =>
                      setContactForm((p) => ({
                        ...p,
                        full_name: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Ryšys">
                  <input
                    className={inputClass}
                    value={contactForm.relationship}
                    onChange={(e) =>
                      setContactForm((p) => ({
                        ...p,
                        relationship: e.target.value,
                      }))
                    }
                    placeholder="Dukra, sūnus, globėjas..."
                  />
                </Field>
                <Field label="Telefonas">
                  <input
                    className={inputClass}
                    value={contactForm.phone}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, phone: e.target.value }))
                    }
                  />
                </Field>
                <Field label="El. paštas">
                  <input
                    className={inputClass}
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm font-bold text-[#486b5d]">
                  <input
                    type="checkbox"
                    checked={contactForm.can_receive_info}
                    onChange={(e) =>
                      setContactForm((p) => ({
                        ...p,
                        can_receive_info: e.target.checked,
                      }))
                    }
                  />{" "}
                  Leidžiama informuoti
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-[#486b5d]">
                  <input
                    type="checkbox"
                    checked={contactForm.is_primary}
                    onChange={(e) =>
                      setContactForm((p) => ({
                        ...p,
                        is_primary: e.target.checked,
                      }))
                    }
                  />{" "}
                  Pagrindinis kontaktas
                </label>
                <button
                  type="button"
                  onClick={addContact}
                  disabled={saving}
                  className="rounded-[18px] bg-[#047857] px-5 py-3 text-sm font-black text-white"
                >
                  Pridėti kontaktą
                </button>
              </div>
            </Card>

            <Card
              title="Kontaktų sąrašas"
              action={<Badge tone="neutral">BDAR</Badge>}
            >
              <div className="grid gap-3 md:grid-cols-2">
                {contacts.length ? (
                  contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="rounded-[18px] border border-[#dbe6e0] bg-[#f8faf8] p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-lg font-black text-[#10251f]">
                          {text(contact.full_name, "Kontaktas")}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            deleteRow(
                              "resident_contacts",
                              contact.id,
                              "Kontaktas pašalintas.",
                            )
                          }
                          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-slate-100 text-[#526174] transition hover:bg-slate-200"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <InfoRow
                          label="Ryšys"
                          value={text(contact.relationship)}
                        />
                        <InfoRow
                          label="Telefonas"
                          value={text(contact.phone)}
                        />
                        <InfoRow
                          label="El. paštas"
                          value={text(contact.email)}
                        />
                        <InfoRow
                          label="Informuoti"
                          value={
                            contact.can_receive_info
                              ? "Leidžiama"
                              : "Nerodyti / nėra sutikimo"
                          }
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm font-bold text-[#66756c]">
                    Kontaktų dar nėra.
                  </div>
                )}
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === "planas" ? (
          <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <Card title="Pridėti ISGP tikslą">
              <div className="grid gap-4">
                <Field label="Tikslas">
                  <input
                    className={inputClass}
                    value={goalForm.title}
                    onChange={(e) =>
                      setGoalForm((p) => ({ ...p, title: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Aprašymas">
                  <textarea
                    className={textareaClass}
                    value={goalForm.description}
                    onChange={(e) =>
                      setGoalForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Veiksmai">
                  <textarea
                    className={textareaClass}
                    value={goalForm.actions}
                    onChange={(e) =>
                      setGoalForm((p) => ({ ...p, actions: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Atsakingas">
                  <input
                    className={inputClass}
                    value={goalForm.responsible}
                    onChange={(e) =>
                      setGoalForm((p) => ({
                        ...p,
                        responsible: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Peržiūros data">
                  <input
                    type="date"
                    className={inputClass}
                    value={goalForm.review_date}
                    onChange={(e) =>
                      setGoalForm((p) => ({
                        ...p,
                        review_date: e.target.value,
                      }))
                    }
                  />
                </Field>
                <button
                  type="button"
                  onClick={addGoal}
                  disabled={saving}
                  className="rounded-[18px] bg-[#047857] px-5 py-3 text-sm font-black text-white"
                >
                  Pridėti tikslą
                </button>
              </div>
            </Card>

            <Card title="ISGP tikslai">
              <div className="grid gap-3 md:grid-cols-2">
                {goals.length ? (
                  goals.map((goal) => (
                    <div
                      key={goal.id}
                      className="rounded-[18px] border border-[#dbe6e0] bg-[#f8faf8] p-4"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="font-black text-[#10251f]">
                          {text(goal.title)}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            deleteRow(
                              "resident_isgp_goals",
                              goal.id,
                              "Tikslas pašalintas.",
                            )
                          }
                          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-slate-100 text-[#526174] transition hover:bg-slate-200"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <p className="text-sm font-bold leading-6 text-[#526174]">
                        {text(goal.description)}
                      </p>
                      <p className="mt-2 text-sm font-bold leading-6 text-emerald-800">
                        {text(goal.actions)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone="blue">
                          {text(goal.status, "Aktyvus")}
                        </Badge>
                        {goal.review_date ? (
                          <Badge tone="warning">
                            Peržiūra {goal.review_date}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm font-bold text-[#66756c]">
                    ISGP tikslų dar nėra.
                  </div>
                )}
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === "irasai" ? (
          <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <Card title="Naujas perdavimo įrašas">
              <div className="grid gap-4">
                <Field label="Kategorija">
                  <input
                    className={inputClass}
                    value={entryForm.category}
                    onChange={(e) =>
                      setEntryForm((p) => ({ ...p, category: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Pastaba">
                  <textarea
                    className={textareaClass}
                    value={entryForm.note}
                    onChange={(e) =>
                      setEntryForm((p) => ({ ...p, note: e.target.value }))
                    }
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm font-bold text-[#486b5d]">
                  <input
                    type="checkbox"
                    checked={entryForm.needs_follow_up}
                    onChange={(e) =>
                      setEntryForm((p) => ({
                        ...p,
                        needs_follow_up: e.target.checked,
                      }))
                    }
                  />{" "}
                  Reikia tęstinio veiksmo
                </label>
                <button
                  type="button"
                  onClick={addEntry}
                  disabled={saving}
                  className="rounded-[18px] bg-[#047857] px-5 py-3 text-sm font-black text-white"
                >
                  Pridėti įrašą
                </button>
              </div>
            </Card>

            <Card title="Perdavimo žurnalas">
              <div className="grid gap-3">
                {entries.length ? (
                  entries.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-[20px] border border-[#dbe6e0] bg-[#f8faf8] p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#486b5d] ring-1 ring-[#dbe6e0]">
                              {formatEntryDate(entry.created_at)}
                            </span>
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                              {text(entry.category)}
                            </span>
                            {entry.needs_follow_up ? (
                              <Badge tone="warning">Reikia veiksmo</Badge>
                            ) : null}
                          </div>

                          {entry.title ? (
                            <h3 className="mt-3 break-words text-[17px] font-black leading-6 text-[#10251f]">
                              {entry.title}
                            </h3>
                          ) : null}

                          <p className="mt-2 whitespace-pre-wrap break-words text-[15px] font-bold leading-7 text-[#10251f]">
                            {text(entry.note)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void archiveHandoverEntry(entry)}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-white text-[#526174] ring-1 ring-[#dbe6e0] transition hover:bg-slate-100"
                          aria-label="Pašalinti perdavimo įrašą"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="text-sm font-bold text-[#66756c]">
                    Įrašų dar nėra.
                  </div>
                )}
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === "incidentai" ? (
          <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <Card
              title="Naujas incidentas"
              action={<Badge tone="danger">Ribota</Badge>}
            >
              <div className="grid gap-4">
                <Field label="Tipas">
                  <input
                    className={inputClass}
                    value={incidentForm.incident_type}
                    onChange={(e) =>
                      setIncidentForm((p) => ({
                        ...p,
                        incident_type: e.target.value,
                      }))
                    }
                    placeholder="Kritimas, konfliktas, vaistų klaida..."
                  />
                </Field>
                <Field label="Rimčiai">
                  <select
                    className={inputClass}
                    value={incidentForm.severity}
                    onChange={(e) =>
                      setIncidentForm((p) => ({
                        ...p,
                        severity: e.target.value,
                      }))
                    }
                  >
                    <option value="zemas">Žemas</option>
                    <option value="vidutinis">Vidutinis</option>
                    <option value="aukstas">Aukštas</option>
                    <option value="kritinis">Kritinis</option>
                  </select>
                </Field>
                <Field label="Įvykio laikas">
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={incidentForm.occurred_at}
                    onChange={(e) =>
                      setIncidentForm((p) => ({
                        ...p,
                        occurred_at: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Aprašymas">
                  <textarea
                    className={textareaClass}
                    value={incidentForm.description}
                    onChange={(e) =>
                      setIncidentForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Atlikti veiksmai">
                  <textarea
                    className={textareaClass}
                    value={incidentForm.action_taken}
                    onChange={(e) =>
                      setIncidentForm((p) => ({
                        ...p,
                        action_taken: e.target.value,
                      }))
                    }
                  />
                </Field>
                <button
                  type="button"
                  onClick={addIncident}
                  disabled={saving}
                  className="rounded-[18px] bg-[#047857] px-5 py-3 text-sm font-black text-white"
                >
                  Pridėti incidentą
                </button>
              </div>
            </Card>

            <Card title="Incidentai ir rizikos">
              <div className="grid gap-3">
                {incidents.length ? (
                  incidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="rounded-[18px] border border-amber-200 bg-amber-50 p-4"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <div className="font-black text-amber-900">
                            {text(incident.incident_type, "Incidentas")}
                          </div>
                          <div className="text-sm font-bold text-amber-800">
                            {text(incident.occurred_at)} ·{" "}
                            {text(incident.severity)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            deleteRow(
                              "resident_incidents",
                              incident.id,
                              "Incidentas pašalintas.",
                            )
                          }
                          className="rounded-xl p-2 text-red-600 hover:bg-red-100"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <p className="text-sm font-bold leading-6 text-amber-900">
                        {text(incident.description)}
                      </p>
                      {incident.action_taken ? (
                        <p className="mt-2 text-sm font-bold leading-6 text-[#486b5d]">
                          Veiksmai: {incident.action_taken}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="text-sm font-bold text-[#66756c]">
                    Incidentų nėra.
                  </div>
                )}
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === "prekes" ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <Card
              title="Prekės ir išdavimai"
              action={
                <button
                  type="button"
                  onClick={() => setWriteOffOpen(true)}
                  className="inline-flex items-center gap-2 rounded-[18px] bg-[#047857] px-4 py-2.5 text-sm font-black text-white hover:bg-[#036747]"
                >
                  <Plus size={17} />
                  Nurašyti prekę
                </button>
              }
            >
              <div className="grid gap-3">
                {inventory.length ? (
                  inventory.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-2 rounded-[18px] border border-[#dbe6e0] bg-white p-4 md:grid-cols-[1fr_110px_160px]"
                    >
                      <div>
                        <div className="font-black text-[#10251f]">
                          {text(item.item_name)}
                        </div>
                        <div className="mt-1 text-sm font-bold text-[#66756c]">
                          {text(item.reason)} · {text(item.note)}
                        </div>
                      </div>
                      <div className="font-black text-[#10251f]">
                        {text(item.quantity)} vnt.
                      </div>
                      <div className="text-sm font-bold text-[#66756c]">
                        {text(item.created_at)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-slate-300 bg-[#f8faf8] p-6 text-sm font-bold leading-6 text-[#66756c]">
                    Prekių nurašymų dar nėra.
                  </div>
                )}
              </div>
            </Card>

            <Card title="Prekių santrauka">
              <div className="space-y-3">
                <InfoRow label="Išduota iš viso" value={inventory.length} />
                <InfoRow
                  label="Šį mėnesį"
                  value={
                    inventory.filter(
                      (i) =>
                        String(i.created_at || "").slice(0, 7) ===
                        new Date().toISOString().slice(0, 7),
                    ).length
                  }
                />
                <InfoRow
                  label="Paskutinis veiksmas"
                  value={inventory[0]?.created_at || "—"}
                />
              </div>
            </Card>
          </div>
        ) : null}
      </div>

      {careModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-[#dbe6e0] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#dbe6e0] px-6 py-5">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone="danger">Ribota prieiga</Badge>
                  <Badge tone="neutral">Atskira nuo ISGP</Badge>
                </div>
                <h2 className="text-2xl font-black tracking-[-0.03em] text-[#10251f]">
                  Priežiūros informacija
                </h2>
                <p className="mt-1 text-sm font-bold text-[#66756c]">
                  {residentName} · pildoma tik darbui būtina slaugos, rizikų,
                  mitybos ir judėjimo informacija.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCareModalOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[18px] border border-[#dbe6e0] text-[#66756c] hover:bg-[#f8faf8]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-[#dbe6e0] bg-[#f8faf8] px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {CARE_TABS.map((tab) => {
                  const isActive = careTab === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setCareTab(tab.value)}
                      className={`rounded-[18px] px-4 py-2.5 text-sm font-black transition ${isActive ? "bg-[#047857] text-white shadow-sm" : "bg-white text-[#526174] hover:bg-emerald-50 hover:text-emerald-800"}`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-y-auto p-6">
              {careTab === "slauga" ? (
                <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
                  <div className="grid gap-4">
                    <Field label="Alergijos">
                      <textarea
                        className={textareaClass}
                        value={careInfo.allergies}
                        onChange={(event) =>
                          updateCareInfo({ allergies: event.target.value })
                        }
                        placeholder="Pvz., penicilinas, lateksas, maisto produktai..."
                      />
                    </Field>
                    <Field label="Alergijų / perspėjimo galiojimo peržiūra">
                      <input
                        type="date"
                        className={inputClass}
                        value={careInfo.allergy_valid_until}
                        onChange={(event) =>
                          updateCareInfo({
                            allergy_valid_until: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Slaugos pastabos">
                      <textarea
                        className={textareaClass}
                        value={careInfo.nursing_notes}
                        onChange={(event) =>
                          updateCareInfo({ nursing_notes: event.target.value })
                        }
                        placeholder="Trumpai: ką būtina žinoti pamainai."
                      />
                    </Field>
                  </div>
                  <InfoNotice title="Svarbu" tone="blue">
                    Čia nėra ISGP tikslai. Čia rašoma praktinė priežiūros
                    informacija, kurią turi greitai pamatyti slauga ir atsakingi
                    darbuotojai.
                  </InfoNotice>
                </div>
              ) : null}

              {careTab === "rizikos" ? (
                <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      ["fall_risk", "Kritimo rizika"],
                      ["diabetes", "Diabetas"],
                      ["pressure_sore_risk", "Pragulų rizika"],
                      ["choking_risk", "Springimo rizika"],
                      ["wandering_risk", "Išėjimo / paklydimo rizika"],
                    ].map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-3 rounded-[18px] border border-[#dbe6e0] bg-[#f8faf8] p-4 text-sm font-black text-[#10251f]"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(careInfo[key as keyof CareInfo])}
                          onChange={(event) =>
                            updateCareInfo({
                              [key]: event.target.checked,
                            } as Partial<CareInfo>)
                          }
                        />
                        {label}
                      </label>
                    ))}
                    <Field label="Rizikų peržiūros data">
                      <input
                        type="date"
                        className={inputClass}
                        value={careInfo.risk_valid_until}
                        onChange={(event) =>
                          updateCareInfo({
                            risk_valid_until: event.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                  <InfoNotice title="Alert badge logika" tone="amber">
                    Pažymėtos rizikos rodomos kortelės santraukoje kaip greiti
                    perspėjimai. Detalūs incidentai lieka „Incidentai“ skiltyje.
                  </InfoNotice>
                </div>
              ) : null}

              {careTab === "mityba" ? (
                <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Maitinimas">
                      <select
                        className={inputClass}
                        value={careInfo.nutrition_type}
                        onChange={(event) =>
                          updateCareInfo({ nutrition_type: event.target.value })
                        }
                      >
                        {NUTRITION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Skysčių ribojimas">
                      <input
                        className={inputClass}
                        value={careInfo.fluid_restriction}
                        onChange={(event) =>
                          updateCareInfo({
                            fluid_restriction: event.target.value,
                          })
                        }
                        placeholder="Pvz., iki 1,5 l / para arba nėra"
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Tekstūra / dietos pastabos">
                        <textarea
                          className={textareaClass}
                          value={careInfo.texture_notes}
                          onChange={(event) =>
                            updateCareInfo({
                              texture_notes: event.target.value,
                            })
                          }
                          placeholder="Pvz., trintas maistas, vengti riešutų, stebėti apetitą..."
                        />
                      </Field>
                    </div>
                  </div>
                  <InfoNotice
                    title="Mityba nėra socialinis tikslas"
                    tone="blue"
                  >
                    ISGP gali turėti savarankiškumo ar integracijos tikslus, o
                    čia laikoma praktinė mitybos saugos informacija pamainai.
                  </InfoNotice>
                </div>
              ) : null}

              {careTab === "judejimas" ? (
                <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Mobilumas">
                      <select
                        className={inputClass}
                        value={careInfo.mobility_level}
                        onChange={(event) =>
                          updateCareInfo({ mobility_level: event.target.value })
                        }
                      >
                        {MOBILITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Pagalbinė priemonė">
                      <input
                        className={inputClass}
                        value={careInfo.mobility_aid}
                        onChange={(event) =>
                          updateCareInfo({ mobility_aid: event.target.value })
                        }
                        placeholder="Vaikštynė, lazdelė, vežimėlis..."
                      />
                    </Field>
                    <label className="flex items-center gap-3 rounded-[18px] border border-red-200 bg-red-50 p-4 text-sm font-black text-red-800 md:col-span-2">
                      <input
                        type="checkbox"
                        checked={careInfo.transfer_two_staff}
                        onChange={(event) =>
                          updateCareInfo({
                            transfer_two_staff: event.target.checked,
                          })
                        }
                      />
                      Reikia 2 darbuotojų perkėlimui
                    </label>
                  </div>
                  <InfoNotice title="Saugumo perspėjimas" tone="amber">
                    Jei pažymėta, kad reikia 2 darbuotojų, perspėjimas visada
                    matomas santraukoje, kad pamaina nepraleistų rizikos.
                  </InfoNotice>
                </div>
              ) : null}

              {careTab === "pastabos" ? (
                <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
                  <Field label="Pastabos darbuotojams">
                    <textarea
                      className="min-h-[220px] w-full rounded-[18px] border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-bold text-[#10251f] outline-none transition focus:border-[#047857] focus:ring-4 focus:ring-[#047857]/10"
                      value={careInfo.staff_notes}
                      onChange={(event) =>
                        updateCareInfo({ staff_notes: event.target.value })
                      }
                      placeholder="Praktinės instrukcijos pamainai, ko nepamiršti, ką stebėti..."
                    />
                  </Field>
                  <div className="grid gap-4">
                    <InfoNotice title="Kas atnaujino" tone="green">
                      {careInfo.updated_at
                        ? `${careInfo.updated_by || "Darbuotojas"} · ${new Date(careInfo.updated_at).toLocaleString("lt-LT")}`
                        : "Dar neatnaujinta."}
                    </InfoNotice>
                    <InfoNotice title="BDAR" tone="blue">
                      Rašyk tik tai, kas būtina priežiūrai ir pamainos darbui.
                      Dokumentų kopijų ar perteklinių jautrių duomenų čia
                      nekeliame.
                    </InfoNotice>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dbe6e0] px-6 py-4">
              <div className="text-xs font-bold text-[#66756c]">
                ISGP tikslai lieka „Planas“ skiltyje; ši informacija skirta
                priežiūros saugai ir pamainos perspėjimams.
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCareModalOpen(false)}
                  className="rounded-[18px] border border-[#dbe6e0] bg-white px-5 py-3 text-sm font-black text-[#486b5d] hover:bg-[#f8faf8]"
                >
                  Atšaukti
                </button>
                <button
                  type="button"
                  onClick={saveCareInfo}
                  disabled={saving}
                  className="rounded-[18px] bg-[#047857] px-5 py-3 text-sm font-black text-white hover:bg-[#036747] disabled:opacity-60"
                >
                  {saving ? "Saugoma..." : "Išsaugoti priežiūros informaciją"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {writeOffOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-2xl overflow-hidden rounded-[22px] border border-[#dbe6e0] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#dbe6e0] px-6 py-5">
              <div>
                <h2 className="text-2xl font-black tracking-[-0.03em] text-[#10251f]">
                  Nurašyti prekę gyventojui
                </h2>
                <p className="mt-1 text-sm font-bold text-[#66756c]">
                  {residentName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWriteOffOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-[18px] border border-[#dbe6e0] text-[#66756c] hover:bg-[#f8faf8]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 p-6">
              <Field label="Prekės pavadinimas">
                <input
                  className={inputClass}
                  value={writeOffForm.item_name}
                  onChange={(event) =>
                    setWriteOffForm((prev) => ({
                      ...prev,
                      item_name: event.target.value,
                    }))
                  }
                  placeholder="Pvz., sauskelnės, higienos priemonė..."
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Kiekis">
                  <input
                    type="number"
                    min="1"
                    className={inputClass}
                    value={writeOffForm.quantity}
                    onChange={(event) =>
                      setWriteOffForm((prev) => ({
                        ...prev,
                        quantity: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field label="Priežastis">
                  <input
                    className={inputClass}
                    value={writeOffForm.reason}
                    onChange={(event) =>
                      setWriteOffForm((prev) => ({
                        ...prev,
                        reason: event.target.value,
                      }))
                    }
                    placeholder="Nurašyta gyventojui"
                  />
                </Field>
              </div>

              <Field label="Pastaba">
                <textarea
                  className={textareaClass}
                  value={writeOffForm.note}
                  onChange={(event) =>
                    setWriteOffForm((prev) => ({
                      ...prev,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Nebūtina"
                />
              </Field>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setWriteOffOpen(false)}
                  className="rounded-[18px] border border-[#dbe6e0] bg-white px-5 py-3 text-sm font-black text-[#486b5d] hover:bg-[#f8faf8]"
                >
                  Atšaukti
                </button>
                <button
                  type="button"
                  onClick={submitWriteOff}
                  disabled={saving}
                  className="rounded-[18px] bg-[#047857] px-5 py-3 text-sm font-black text-white hover:bg-[#036747] disabled:opacity-60"
                >
                  {saving ? "Saugoma..." : "Nurašyti"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
