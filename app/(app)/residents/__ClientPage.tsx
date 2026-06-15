// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bed,
  CheckCircle2,
  Edit3,
  Phone,
  HeartHandshake,
  Info,
  Plus,
  RefreshCw,
  Search,
  User,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentOrganizationId } from "@/lib/current-organization";

type ResidentStatus =
  | "netrukus_atvyks"
  | "gyvena"
  | "ligonineje"
  | "laikinai_isvykes"
  | "sutartis_nutraukta"
  | "mire";

type Resident = {
  id: string;
  organization_id: string;
  resident_code: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  current_status: string | null;
  current_room_id: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  care_level: string | null;
  created_by: string | null;
  assigned_to: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  internal_notes: string | null;
};

type Room = {
  id: string;
  name: string | null;
  organization_id?: string | null;
  is_active?: boolean | null;
};

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

type ResidentContactRow = {
  resident_id: string;
  full_name: string | null;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  can_receive_info: boolean | null;
  authorization_basis: string | null;
  authorization_notes: string | null;
  is_primary: boolean | null;
};

type ResidentContactForm = {
  full_name: string;
  relationship: string;
  phone: string;
  email: string;
  can_receive_info: boolean;
  authorization_basis:
    | ""
    | "gyventojo_sutikimas"
    | "igaliojimas"
    | "teisetasis_atstovas"
    | "kita";
  authorization_notes: string;
};

type ResidentForm = {
  full_name: string;
  resident_code: string;
  current_status: ResidentStatus;
  room_id: string;
  start_date: string;
  birth_date: string;
  phone: string;
  email: string;
  contacts: ResidentContactForm[];
  address: string;
  care_level:
    | ""
    | "savarankiskas"
    | "daline_slauga"
    | "slauga"
    | "intensyvi_slauga";
  assigned_staff_ids: string[];
  notes: string;
};

const STATUS_OPTIONS: { value: ResidentStatus; label: string }[] = [
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
] as const;


type ResidentListTab =
  | "active"
  | "gyvena"
  | "netrukus_atvyks"
  | "ligonineje"
  | "laikinai_isvykes"
  | "archived";

const RESIDENT_LIST_TABS: Array<{
  key: ResidentListTab;
  label: string;
  icon: React.ElementType;
}> = [
  { key: "active", label: "Aktyvūs", icon: Users },
  { key: "gyvena", label: "Gyvena", icon: CheckCircle2 },
  { key: "netrukus_atvyks", label: "Netrukus atvyks", icon: Bed },
  { key: "ligonineje", label: "Ligoninėje", icon: HeartHandshake },
  { key: "laikinai_isvykes", label: "Laikinai išvykę", icon: Phone },
  { key: "archived", label: "Archyvas", icon: X },
];


type ResidentPopupTab = "main" | "contacts" | "staff" | "notes";

const RESIDENT_POPUP_TABS: Array<{
  key: ResidentPopupTab;
  label: string;
  icon: React.ElementType;
}> = [
  { key: "main", label: "Pagrindinė info", icon: User },
  { key: "contacts", label: "Artimieji", icon: HeartHandshake },
  { key: "staff", label: "Atsakingi", icon: Users },
  { key: "notes", label: "Pastabos", icon: Info },
];

function emptyContactForm(): ResidentContactForm {
  return {
    full_name: "",
    relationship: "",
    phone: "",
    email: "",
    can_receive_info: false,
    authorization_basis: "",
    authorization_notes: "",
  };
}

const initialForm: ResidentForm = {
  full_name: "",
  resident_code: "",
  current_status: "gyvena",
  room_id: "",
  start_date: todayInputValue(),
  birth_date: "",
  phone: "",
  email: "",
  contacts: [emptyContactForm()],
  address: "",
  care_level: "",
  assigned_staff_ids: [],
  notes: "",
};

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

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return {
      first_name: null as string | null,
      last_name: null as string | null,
    };
  }

  if (parts.length === 1) {
    return { first_name: parts[0], last_name: null as string | null };
  }

  return {
    first_name: parts.slice(0, -1).join(" "),
    last_name: parts.slice(-1).join(" "),
  };
}

function residentName(resident: Resident) {
  const full = String(resident.full_name || "").trim();

  if (full) return full;

  const joined = [resident.first_name, resident.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return joined || "Be vardo";
}

function normalizeResidentStatus(status: string | null): ResidentStatus | null {
  const raw = String(status || "")
    .trim()
    .toLowerCase();

  if (!raw) return null;

  const normalized = raw
    .replaceAll(" ", "_")
    .replaceAll("-", "_")
    .replaceAll("ą", "a")
    .replaceAll("č", "c")
    .replaceAll("ę", "e")
    .replaceAll("ė", "e")
    .replaceAll("į", "i")
    .replaceAll("š", "s")
    .replaceAll("ų", "u")
    .replaceAll("ū", "u")
    .replaceAll("ž", "z");

  if (normalized.includes("netrukus")) return "netrukus_atvyks";
  if (normalized.includes("gyvena") || normalized === "active") return "gyvena";
  if (normalized.includes("ligon")) return "ligonineje";
  if (normalized.includes("isvyk") || normalized.includes("isvyke"))
    return "laikinai_isvykes";
  if (normalized.includes("nutrauk")) return "sutartis_nutraukta";
  if (normalized.includes("mir")) return "mire";

  return null;
}

function statusLabel(status: string | null) {
  const normalized = normalizeResidentStatus(status);
  return (
    STATUS_OPTIONS.find((option) => option.value === normalized)?.label || "—"
  );
}

function isArchived(status: string | null) {
  const normalized = normalizeResidentStatus(status);
  return normalized === "sutartis_nutraukta" || normalized === "mire";
}

function statusClass(status: string | null) {
  const normalized = normalizeResidentStatus(status);

  if (normalized === "gyvena")
    return "border-[#a7f3d0] bg-emerald-50 text-[#047857]";
  if (normalized === "netrukus_atvyks")
    return "border-blue-200 bg-white text-[#486b5d]";
  if (normalized === "ligonineje")
    return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "laikinai_isvykes")
    return "border-lime-200 bg-lime-50 text-lime-700";
  if (normalized === "mire") return "border-red-200 bg-red-50 text-red-700";
  if (normalized === "sutartis_nutraukta")
    return "border-red-200 bg-red-50 text-red-700";

  return "border-[#dbe6e0] bg-[#f8faf8] text-[#526174]";
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administratorius",
  employee: "Darbuotojas",
  director: "Direktorius",
  nurse: "Slaugytojas",
  social_worker: "Socialinis darbuotojas",
  care_worker: "Individualios priežiūros darbuotojas",
};

function staffRoleLabel(member?: StaffMember | null) {
  if (!member) return "";

  const position = String(member.position || "").trim();
  if (position) return position;

  const staffType = String(member.staff_type || "").trim();
  if (staffType) return staffType;

  const role = String(member.role || "").trim();
  if (!role) return "";

  return ROLE_LABELS[role] || role;
}

function staffName(member?: StaffMember | null) {
  if (!member) return "Darbuotojas";

  const full = String(member.full_name || "").trim();
  if (full) return full;

  const joined = [member.first_name, member.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (joined) return joined;

  const position = String(member.position || "").trim();
  if (position) return position;

  if (member.email) return member.email.split("@")[0] || "Darbuotojas";

  return "Darbuotojas";
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function isValidBirthDate(value: string) {
  if (!value) return true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00`);
  const min = new Date("1900-01-01T00:00:00");
  const today = new Date(`${todayInputValue()}T00:00:00`);

  return Number.isFinite(date.getTime()) && date >= min && date <= today;
}


async function writeAuditLog(input: {
  organizationId: string;
  tableName: string;
  recordId: string | null;
  action: string;
  changes?: Record<string, unknown>;
}) {
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
    // Auditas neturi sustabdyti pagrindinio veiksmo.
  }
}

function cleanBirthDateInput(value: string | null | undefined) {
  const clean = String(value || "").trim();

  if (!clean) return "";

  return isValidBirthDate(clean) ? clean : "";
}

export default function ResidentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [residents, setResidents] = useState<Resident[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [residentAssignments, setResidentAssignments] = useState<
    Record<string, string[]>
  >({});
  const [residentContacts, setResidentContacts] = useState<
    Record<string, ResidentContactForm[]>
  >({});

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "active" | "all" | "archived" | "hospital_or_away" | ResidentStatus
  >("active");
  const [activeListTab, setActiveListTab] = useState<ResidentListTab>("active");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [form, setForm] = useState<ResidentForm>(initialForm);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (searchParams.get("newResident") === "1") {
      setShowCreateModal(true);
    }
  }, [searchParams]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("Nepavyko nustatyti naudotojo.");
      }

      setCurrentUserId(user.id);

      const orgId = await getCurrentOrganizationId();

      if (!orgId) {
        throw new Error("Nepavyko nustatyti įstaigos.");
      }

      setOrganizationId(orgId);

      const [residentsResult, roomsResult, membersResult] = await Promise.all([
        supabase
          .from("residents")
          .select(
            "id, organization_id, resident_code, full_name, first_name, last_name, current_status, current_room_id, is_active, created_at, updated_at, care_level, created_by, assigned_to, birth_date, phone, email, address, internal_notes",
          )
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),
        supabase
          .from("rooms")
          .select("id, name, organization_id, is_active")
          .eq("organization_id", orgId)
          .order("name"),
        supabase
          .from("organization_members")
          .select("user_id, role, position, department, staff_type, is_active")
          .eq("organization_id", orgId)
          .eq("is_active", true),
      ]);

      if (residentsResult.error) throw residentsResult.error;
      if (roomsResult.error) throw roomsResult.error;
      if (membersResult.error) throw membersResult.error;

      const userIds = (membersResult.data || [])
        .map((member: any) => member.user_id)
        .filter(Boolean);

      let profiles = new Map<string, any>();

      if (userIds.length > 0) {
        const profilesResult = await supabase
          .from("profiles")
          .select("id, full_name, first_name, last_name, email")
          .in("id", userIds);

        if (profilesResult.error) throw profilesResult.error;

        profiles = new Map(
          (profilesResult.data || []).map((profile: any) => [
            profile.id,
            profile,
          ]),
        );
      }

      const staff = (membersResult.data || []).map((member: any) => {
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

      const residentRows = (residentsResult.data || []) as Resident[];
      const residentIds = residentRows.map((resident) => resident.id);

      let assignmentsByResident: Record<string, string[]> = {};
      let contactsByResident: Record<string, ResidentContactForm[]> = {};

      if (residentIds.length > 0) {
        const assignmentsResult = await supabase
          .from("resident_assignments")
          .select("resident_id, user_id, is_primary")
          .in("resident_id", residentIds);

        if (!assignmentsResult.error) {
          assignmentsByResident = (
            (assignmentsResult.data || []) as ResidentAssignment[]
          ).reduce(
            (acc, assignment) => {
              if (!assignment.resident_id || !assignment.user_id) return acc;

              acc[assignment.resident_id] = acc[assignment.resident_id] || [];
              acc[assignment.resident_id].push(assignment.user_id);

              return acc;
            },
            {} as Record<string, string[]>,
          );
        }

        const contactsResult = await supabase
          .from("resident_contacts")
          .select(
            "resident_id, full_name, relationship, phone, email, can_receive_info, authorization_basis, authorization_notes, is_primary",
          )
          .in("resident_id", residentIds)
          .order("is_primary", { ascending: false })
          .order("full_name", { ascending: true });

        if (!contactsResult.error) {
          contactsByResident = (
            (contactsResult.data || []) as ResidentContactRow[]
          ).reduce(
            (acc, contact) => {
              if (!contact.resident_id) return acc;

              acc[contact.resident_id] = acc[contact.resident_id] || [];
              acc[contact.resident_id].push({
                full_name: contact.full_name || "",
                relationship: contact.relationship || "",
                phone: contact.phone || "",
                email: contact.email || "",
                can_receive_info: Boolean(contact.can_receive_info),
                authorization_basis:
                  (contact.authorization_basis as ResidentContactForm["authorization_basis"]) ||
                  "",
                authorization_notes: contact.authorization_notes || "",
              });

              return acc;
            },
            {} as Record<string, ResidentContactForm[]>,
          );
        } else {
          console.warn("resident_contacts load failed", contactsResult.error);
        }
      }

      for (const resident of residentRows) {
        if (resident.assigned_to) {
          assignmentsByResident[resident.id] = uniqueValues([
            ...(assignmentsByResident[resident.id] || []),
            resident.assigned_to,
          ]);
        }
      }

      setResidents(residentRows);
      setRooms((roomsResult.data || []) as Room[]);
      setStaffMembers(staff);
      setResidentAssignments(assignmentsByResident);
      setResidentContacts(contactsByResident);
    } catch (error) {
      setMessage(getReadableError(error) || "Nepavyko užkrauti gyventojų.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      ...initialForm,
      start_date: todayInputValue(),
    });
  }

  function openCreateModal() {
    resetForm();
    setEditingResident(null);
    setShowCreateModal(true);
  }

  function openEditModal(resident: Resident) {
    const assignmentIds = uniqueValues([
      ...(residentAssignments[resident.id] || []),
      resident.assigned_to || "",
    ]);

    setEditingResident(resident);
    setForm({
      full_name: residentName(resident),
      resident_code: resident.resident_code || "",
      current_status: (resident.current_status as ResidentStatus) || "gyvena",
      room_id: resident.current_room_id || "",
      start_date: todayInputValue(),
      birth_date: cleanBirthDateInput(resident.birth_date),
      phone: resident.phone || "",
      email: resident.email || "",
      contacts:
        residentContacts[resident.id]?.length > 0
          ? residentContacts[resident.id]
          : [emptyContactForm()],
      address: resident.address || "",
      care_level: (resident.care_level as ResidentForm["care_level"]) || "",
      assigned_staff_ids: assignmentIds,
      notes: resident.internal_notes || "",
    });
    setShowCreateModal(true);
  }

  function closeModal() {
    setShowCreateModal(false);
    setEditingResident(null);
    resetForm();
  }

  async function saveResidentContacts(residentId: string) {
    if (!organizationId) return;

    const contacts = form.contacts
      .map((contact, index) => {
        const fullName = contact.full_name.trim();
        const relationship = contact.relationship.trim();
        const phone = contact.phone.trim();
        const email = contact.email.trim();
        const authorizationNotes = contact.authorization_notes.trim();

        if (
          !fullName &&
          !relationship &&
          !phone &&
          !email &&
          !authorizationNotes
        )
          return null;

        return {
          organization_id: organizationId,
          resident_id: residentId,
          full_name: fullName || "Kontaktinis asmuo",
          relationship: relationship || null,
          phone: phone || null,
          email: email || null,
          can_receive_info: Boolean(contact.can_receive_info),
          authorization_basis: contact.authorization_basis || null,
          authorization_notes: authorizationNotes || null,
          is_primary: index === 0,
          created_by: currentUserId,
        };
      })
      .filter(Boolean);

    const { error: deleteError } = await supabase
      .from("resident_contacts")
      .delete()
      .eq("resident_id", residentId);

    if (deleteError) {
      console.warn("resident_contacts delete failed", deleteError);
      throw new Error(
        `Artimųjų atnaujinti nepavyko: ${getReadableError(deleteError)}`,
      );
    }

    if (contacts.length === 0) return;

    const { error: insertError } = await supabase
      .from("resident_contacts")
      .insert(contacts);

    if (insertError) {
      console.warn("resident_contacts insert failed", insertError);
      throw new Error(
        `Artimųjų įrašyti nepavyko: ${getReadableError(insertError)}`,
      );
    }
  }

  async function saveResidentAssignments(
    residentId: string,
    staffIds: string[],
  ) {
    if (!organizationId) return;

    const uniqueStaffIds = uniqueValues(staffIds);

    const { error: deleteError } = await supabase
      .from("resident_assignments")
      .delete()
      .eq("resident_id", residentId);

    if (deleteError) {
      console.warn("resident_assignments delete failed", deleteError);
      setMessage(
        `Gyventojas išsaugotas, bet nepavyko atnaujinti priskirtų darbuotojų: ${getReadableError(deleteError)}`,
      );
      return;
    }

    if (uniqueStaffIds.length === 0) return;

    const rows = uniqueStaffIds.map((userId, index) => ({
      organization_id: organizationId,
      resident_id: residentId,
      user_id: userId,
      is_primary: index === 0,
    }));

    const { error: insertError } = await supabase
      .from("resident_assignments")
      .insert(rows);

    if (insertError) {
      console.warn("resident_assignments insert failed", insertError);
      // Gyventojas jau turi assigned_to reikšmę, todėl papildomos lentelės klaida neturi gadinti išsaugojimo.
      return;
    }

    await writeAuditLog({
      organizationId,
      tableName: "resident_assignments",
      recordId: residentId,
      action: "update",
      changes: {
        Veiksmas: "Priskirti atsakingi darbuotojai",
        Darbuotojai: uniqueStaffIds,
      },
    });
  }

  async function handleSaveResident(event: React.FormEvent) {
    event.preventDefault();

    if (!organizationId) {
      setMessage("Nepavyko nustatyti įstaigos.");
      return;
    }

    const cleanName = form.full_name.trim();

    if (!cleanName) {
      setMessage("Įvesk gyventojo vardą ir pavardę.");
      return;
    }

    if (!form.start_date) {
      setMessage("Pasirink apsigyvenimo / pokyčio datą.");
      return;
    }

    const contactMissingBasis = form.contacts.some(
      (contact) => contact.can_receive_info && !contact.authorization_basis,
    );

    if (contactMissingBasis) {
      setMessage(
        "Pasirink teisės gauti informaciją pagrindą prie artimojo, kuriam pažymėta teisė gauti informaciją.",
      );
      return;
    }

    if (form.birth_date && !isValidBirthDate(form.birth_date)) {
      setMessage("Gimimo data turi būti reali: nuo 1900-01-01 iki šiandienos.");
      return;
    }

    const cleanBirthDate = form.birth_date || "";

    setSaving(true);
    setMessage("");

    try {
      const nameParts = splitFullName(cleanName);
      const selectedStaffIds = uniqueValues(form.assigned_staff_ids);
      const primaryAssignedTo = selectedStaffIds[0] || null;

      const residentPayload = {
        organization_id: organizationId,
        full_name: cleanName,
        first_name: nameParts.first_name,
        last_name: nameParts.last_name,
        resident_code: editingResident?.resident_code || null,
        current_status: form.current_status,
        current_room_id: form.room_id || null,
        is_active: !isArchived(form.current_status),
        care_level: form.care_level || null,
        assigned_to: primaryAssignedTo,
        birth_date: cleanBirthDate || null,
        phone: form.phone.trim() || null,
        email: null,
        address: form.address.trim() || null,
        internal_notes: form.notes.trim() || null,
      };

      let residentId = editingResident?.id || "";

      if (editingResident) {
        const { error } = await supabase
          .from("residents")
          .update(residentPayload)
          .eq("id", editingResident.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("residents")
          .insert({
            ...residentPayload,
            created_by: currentUserId,
          })
          .select("id")
          .single();

        if (error) throw error;
        if (!data?.id) throw new Error("Nepavyko sukurti gyventojo.");

        residentId = data.id;
      }

      await saveResidentAssignments(residentId, selectedStaffIds);
      await saveResidentContacts(residentId);

      if (residentId) {
        const shouldCreateStay =
          !editingResident ||
          editingResident.current_room_id !== (form.room_id || null) ||
          normalizeResidentStatus(editingResident.current_status) !==
            form.current_status;

        if (shouldCreateStay) {
          const { error: stayError } = await supabase
            .from("resident_stays")
            .insert({
              organization_id: organizationId,
              resident_id: residentId,
              room_id: form.room_id || null,
              status: form.current_status,
              start_date: form.start_date,
              end_date: null,
              notes: form.notes.trim() || null,
            });

          if (stayError) {
            console.warn("resident_stays insert failed", stayError);
            setMessage(
              `Gyventojas išsaugotas, bet nepavyko įrašyti apsigyvenimo istorijos: ${getReadableError(stayError)}`,
            );
          }
        }
      }

      await writeAuditLog({
        organizationId,
        tableName: "residents",
        recordId: residentId,
        action: editingResident ? "update" : "insert",
        changes: {
          Veiksmas: editingResident ? "Gyventojo duomenys atnaujinti" : "Gyventojas sukurtas",
          Gyventojas: cleanName,
          Statusas: form.current_status,
          Kambarys: form.room_id || null,
          Atsakingas: primaryAssignedTo,
          Priežiūros_ligis: form.care_level || null,
        },
      });

      setMessage(
        editingResident
          ? "Gyventojo duomenys atnaujinti."
          : "Gyventojas sėkmingai sukurtas.",
      );
      closeModal();
      await loadData();
    } catch (error) {
      setMessage(
        `Nepavyko išsaugoti gyventojo: ${getReadableError(error) || "nežinoma klaida"}`,
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredResidents = useMemo(() => {
    let rows = [...residents];

    const q = search.trim().toLowerCase();

    if (q) {
      rows = rows.filter((resident) =>
        [
          residentName(resident),
          resident.resident_code || "",
          resident.phone || "",
          resident.email || "",
          resident.address || "",
          rooms.find((room) => room.id === resident.current_room_id)?.name ||
            "",
          getAssignedStaffNames(resident.id).join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    if (statusFilter === "active") {
      rows = rows.filter((resident) => !isArchived(resident.current_status));
    } else if (statusFilter === "archived") {
      rows = rows.filter((resident) => isArchived(resident.current_status));
    } else if (statusFilter === "hospital_or_away") {
      rows = rows.filter((resident) =>
        ["ligonineje", "laikinai_isvykes"].includes(
          normalizeResidentStatus(resident.current_status) || "",
        ),
      );
    } else if (statusFilter !== "all") {
      rows = rows.filter(
        (resident) =>
          normalizeResidentStatus(resident.current_status) === statusFilter,
      );
    }

    return rows;
  }, [
    residents,
    rooms,
    search,
    statusFilter,
    residentAssignments,
    staffMembers,
  ]);

  const stats = useMemo(() => {
    const normalizedRows = residents.map((resident) => ({
      ...resident,
      normalizedStatus: normalizeResidentStatus(resident.current_status),
    }));

    const total = normalizedRows.length;
    const archived = normalizedRows.filter((resident) =>
      isArchived(resident.current_status),
    ).length;
    const soon = normalizedRows.filter(
      (resident) => resident.normalizedStatus === "netrukus_atvyks",
    ).length;
    const living = normalizedRows.filter(
      (resident) => resident.normalizedStatus === "gyvena",
    ).length;
    const hospital = normalizedRows.filter(
      (resident) => resident.normalizedStatus === "ligonineje",
    ).length;
    const away = normalizedRows.filter(
      (resident) => resident.normalizedStatus === "laikinai_isvykes",
    ).length;
    const hospitalOrAway = hospital + away;
    const active = soon + living + hospitalOrAway;

    return { total, active, soon, living, hospitalOrAway, archived };
  }, [residents]);


  function changeListTab(nextTab: ResidentListTab) {
    setActiveListTab(nextTab);

    if (nextTab === "archived") {
      setStatusFilter("archived");
      return;
    }

    if (nextTab === "active") {
      setStatusFilter("active");
      return;
    }

    setStatusFilter(nextTab);
  }

  function getRoomName(roomId: string | null) {
    if (!roomId) return "—";
    return rooms.find((room) => room.id === roomId)?.name || "—";
  }

  function getAssignedStaffNames(residentId: string) {
    const ids = uniqueValues(residentAssignments[residentId] || []);

    return ids
      .map((id) =>
        staffName(staffMembers.find((member) => member.user_id === id)),
      )
      .filter(Boolean);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f3f6f4] p-6 text-[#10251f]">
        <div className="mx-auto max-w-7xl rounded-3xl border border-[#dbe6e0] bg-white p-8 shadow-sm">
          <p className="font-bold text-[#526174]">Kraunama...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f6f4] p-6 text-[#10251f]">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <section className="overflow-hidden rounded-[30px] border border-emerald-900/10 bg-[#486b5d] shadow-[0_16px_45px_rgba(16,37,31,0.16)]">
          <div className="flex flex-col gap-6 px-7 py-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#e8f7ef] text-[#486b5d]">
                <Users className="h-7 w-7" />
              </div>

              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-100/80">
                  Gyventojų modulis
                </p>
                <h1 className="mt-2 text-5xl font-black tracking-[-0.04em] text-white">
                  Gyventojai
                </h1>
                <p className="mt-3 max-w-3xl text-lg font-semibold leading-8 text-emerald-50/90">
                  Gyventojų sąrašas, kambariai, statusai ir atsakingi
                  darbuotojai vienoje vietoje.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadData()}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white px-5 py-3 font-black text-[#486b5d] shadow-sm transition hover:bg-[#ecfdf5]"
              >
                <RefreshCw className="h-4 w-4" />
                Atnaujinti
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#047857] px-5 py-3 font-black text-white shadow-sm transition hover:bg-[#036747]"
              >
                <Plus className="h-4 w-4" />
                Naujas gyventojas
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#c9d8d0] bg-[#eef4f1] p-3 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
          <div className="flex flex-wrap gap-2">
            {RESIDENT_LIST_TABS.map((item) => {
              const Icon = item.icon;
              const active = activeListTab === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => changeListTab(item.key)}
                  className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
                    active
                      ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
                      : "text-[#486b5d] hover:bg-white/70 hover:text-[#10251f]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>


        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-50"
          >
            <Info className="h-4 w-4" />
            Plačiau
          </button>
        </div>

        {message ? (
          <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/80 px-5 py-3 font-bold text-[#036747]">
            {message}
          </div>
        ) : null}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
          <StatCard
            title="Viso"
            value={stats.total}
            active={statusFilter === "all"}
            onClick={() => { setActiveListTab("active"); setStatusFilter("all"); }}
          />
          <StatCard
            title="Aktyvūs"
            value={stats.active}
            active={statusFilter === "active"}
            onClick={() => changeListTab("active")}
          />
          <StatCard
            title="Netrukus atvyks"
            value={stats.soon}
            active={statusFilter === "netrukus_atvyks"}
            onClick={() => changeListTab("netrukus_atvyks")}
          />
          <StatCard
            title="Gyvena"
            value={stats.living}
            active={statusFilter === "gyvena"}
            onClick={() => changeListTab("gyvena")}
          />
          <StatCard
            title="Ligoninėje / išvykę"
            value={stats.hospitalOrAway}
            active={statusFilter === "hospital_or_away"}
            onClick={() => { setActiveListTab("ligonineje"); setStatusFilter("hospital_or_away"); }}
          />
          <StatCard
            title="Archyvas"
            value={stats.archived}
            active={statusFilter === "archived"}
            onClick={() => changeListTab("archived")}
          />
        </section>

        <InfoBox
          title="Filtrų paaiškinimas"
          text="Spustelėjus filtrų kortelę sąrašas iš karto persifiltruoja. „Aktyvūs“ rodo visus nearchyvuotus gyventojus, „Ligoninėje / išvykę“ padeda greitai rasti laikinai nesančius, o „Archyvas“ skirtas mirusiems arba sutartį nutraukusiems gyventojams."
        />

        <section className="rounded-[30px] border border-[#c9d8d0] bg-white p-6 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.02em] text-[#10251f]">
                Gyventojų sąrašas
              </h2>
              <p className="mt-1 font-semibold text-[#526174]">
                Greita paieška, statusai ir pagrindinė informacija.
              </p>
            </div>

            <label className="relative block w-full lg:w-[420px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a9a91]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ieškoti pagal vardą, telefoną, kambarį ar darbuotoją..."
                className="w-full rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] py-3 pl-12 pr-4 font-semibold outline-none transition focus:border-[#047857] focus:bg-white focus:ring-4 focus:ring-[#047857]/10"
              />
            </label>
          </div>

          <div className="mt-5">
            <InfoBox
              compact
              title="Sąrašo veiksmai"
              text="Ieškok pagal vardą, telefoną, kambarį ar priskirtą darbuotoją. Paspaudus gyventojo vardą atsidaro visa kortelė su ISGP, slaugos / rizikų informacija ir įrašais. „Redaguoti“ naudok tik greitam pagrindinių duomenų pakeitimui."
            />
          </div>

          <div className="mt-6 grid gap-4">
            {filteredResidents.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#c9d8d0] bg-[#f8faf8] p-8 text-center">
                <p className="text-xl font-black">Gyventojų nerasta</p>
                <p className="mt-2 font-semibold text-[#66756c]">
                  Pridėk naują gyventoją arba pakeisk filtrą.
                </p>
              </div>
            ) : (
              filteredResidents.map((resident) => {
                const assignedNames = getAssignedStaffNames(resident.id);

                return (
                  <article
                    key={resident.id}
                    className="rounded-3xl border border-[#dbe6e0] bg-[#f8faf8] p-5 transition hover:border-[#a7f3d0] hover:bg-[#ecfdf5]/40"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#eef4f1] text-[#486b5d] shadow-sm">
                          <User className="h-6 w-6" />
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                router.push(`/residents/${resident.id}`);
                              }}
                              className="text-left text-xl font-black text-[#10251f] transition hover:text-[#047857] hover:underline"
                            >
                              {residentName(resident)}
                            </button>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${statusClass(resident.current_status)}`}
                            >
                              {statusLabel(resident.current_status)}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm font-semibold text-[#526174] sm:grid-cols-2 lg:grid-cols-4">
                            <span className="inline-flex items-center gap-2">
                              <Bed className="h-4 w-4" />
                              Kambarys {getRoomName(resident.current_room_id)}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              {resident.phone || "Tel. —"}
                            </span>
                          </div>

                          <p className="mt-2 text-sm font-semibold text-[#66756c]">
                            Priskirti darbuotojai:{" "}
                            {assignedNames.length
                              ? assignedNames.join(", ")
                              : "Nepriskirta"}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#66756c]">
                            Artimieji:{" "}
                            {residentContacts[resident.id]?.filter(
                              (c) => c.full_name || c.phone || c.relationship,
                            ).length || 0}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/residents/${resident.id}`)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#047857] px-4 py-3 font-extrabold text-white transition hover:bg-[#036747]"
                        >
                          <User className="h-4 w-4" />
                          Atidaryti kortelę
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(resident)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] px-4 py-3 font-extrabold text-[#486b5d] transition hover:bg-[#eef4f1]"
                        >
                          <Edit3 className="h-4 w-4" />
                          Redaguoti
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>

      {showHelpModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-6 backdrop-blur-sm">
          <section className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)]">
            <div className="flex items-start justify-between gap-5 bg-[#486b5d] px-6 py-5 text-white">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-100/80">
                  Pagalba
                </p>
                <h2 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">
                  Kaip naudotis gyventojų moduliu
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/80">
                  Bendra informacija darbuotojams vienoje vietoje — be ilgų
                  instrukcijų pačiame sąraše.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Uždaryti pagalbą"
              >
                <X size={28} strokeWidth={2.1} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <HelpCard
                  title="Gyventojų sąrašas"
                  text="Viršuje esančios kortelės veikia kaip greiti filtrai: visi, aktyvūs, netrukus atvyks, gyvena, ligoninėje / išvykę ir archyvas."
                />
                <HelpCard
                  title="Gyventojo kortelė"
                  text="Paspaudus ant gyventojo vardo atsidaro pilna kortelė su ISGP, slauga, rizikomis, vaistais, perdavimo žurnalais ir kita susijusia informacija."
                />
                <HelpCard
                  title="Naujas gyventojas"
                  text="Mygtukas „Naujas gyventojas“ skirtas sukurti įrašą, įvesti gyventojo bei artimųjų duomenis, priskirti kambarį ir atsakingus darbuotojus."
                />
                <HelpCard
                  title="Redagavimas"
                  text="Mygtukas „Redaguoti“ keičia tik pagrindinius sąrašo duomenis: statusą, kambarį, artimuosius, kontaktus ir priskirtus darbuotojus."
                />
                <HelpCard
                  title="Kambario rezervavimas"
                  text="Kambarį galima priskirti kuriant arba redaguojant gyventoją. Statusas „Netrukus atvyks“ padeda matyti rezervuotus / planuojamus atvykimus."
                />
                <HelpCard
                  title="Slauga, rizikos ir ISGP"
                  text="Slaugos rizikos, alergijos, mityba, judėjimas ir darbuotojų perspėjimai pildomi gyventojo kortelėje. ISGP tikslai yra atskiri nuo slaugos rizikų."
                />
                <HelpCard
                  title="Medicina"
                  text="Vaistai ir medicininiai įrašai turi būti atidaromi iš gyventojo kortelės, kad informacija būtų susieta su konkrečiu gyventoju."
                />
                <HelpCard
                  title="Perdavimo žurnalai"
                  text="Perdavimo žurnalai turi būti susieti su gyventojo kortele, kad kita pamaina ir atsakingi darbuotojai matytų aktualią informaciją vienoje vietoje."
                />
              </div>

              <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-semibold leading-6 text-[#03543f]">
                Patarimas: sąraše laikome tik greitą administravimą. Detali
                priežiūros, medicinos, rizikų ir ISGP informacija turi būti
                tvarkoma gyventojo kortelėje, kad duomenys nesidubliuotų.
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {showCreateModal ? (
        <ResidentModal
          title={editingResident ? "Redaguoti gyventoją" : "Naujas gyventojas"}
          subtitle={
            editingResident
              ? "Atnaujink gyventojo duomenis, statusą, kambarį ar priskirtus darbuotojus."
              : "Sukurk gyventojo įrašą ir priskirk vieną ar kelis atsakingus darbuotojus."
          }
          form={form}
          setForm={setForm}
          rooms={rooms}
          staffMembers={staffMembers}
          saving={saving}
          onClose={closeModal}
          onSubmit={handleSaveResident}
        />
      ) : null}
    </main>
  );
}

function InfoBox({
  title,
  text,
  compact = false,
}: {
  title: string;
  text: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-full border border-[#dbe6e0] bg-white text-xs font-black text-[#526174] shadow-sm transition hover:border-[#a7f3d0] hover:bg-[#ecfdf5] hover:text-[#036747] ${
          compact ? "px-3 py-1.5" : "px-4 py-2"
        }`}
        title={title}
      >
        <Info className="h-3.5 w-3.5" />
        Plačiau
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)]">
            <div className="flex items-start justify-between gap-5 bg-[#486b5d] px-6 py-5 text-white">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#e8f7ef] text-[#486b5d]">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-100/80">
                    Pagalba
                  </p>
                  <h3 className="mt-1 text-2xl font-black tracking-[-0.03em] text-white">
                    {title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Uždaryti pagalbą"
              >
                <X size={28} strokeWidth={2.1} />
              </button>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm font-semibold leading-7 text-[#526174]">
                {text}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function StatCard({
  title,
  value,
  active,
  onClick,
}: {
  title: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[18px] border bg-white px-5 py-4 text-left shadow-[0_1px_3px_rgba(16,37,31,0.10)] transition ${active ? "border-[#047857] ring-2 ring-[#d1fae5]" : "border-[#c9d8d0] hover:border-[#a7f3d0] hover:bg-[#f8faf8]"}`}
    >
      <p className="font-extrabold text-[#66756c]">{title}</p>
      <p className="mt-2 text-4xl font-black tracking-[-0.04em] text-[#10251f]">{value}</p>
    </button>
  );
}

function ResidentModal({
  title,
  subtitle,
  form,
  setForm,
  rooms,
  staffMembers,
  saving,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  form: ResidentForm;
  setForm: React.Dispatch<React.SetStateAction<ResidentForm>>;
  rooms: Room[];
  staffMembers: StaffMember[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const [staffSearch, setStaffSearch] = useState("");
  const [popupTab, setPopupTab] = useState<ResidentPopupTab>("main");
  const staffSearchActive = staffSearch.trim().length >= 2;

  const filteredStaffMembers = useMemo(() => {
    const query = staffSearch.trim().toLowerCase();

    if (query.length < 2) return [];

    return staffMembers
      .filter((member) =>
        [staffName(member), member.email || "", staffRoleLabel(member)]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 8);
  }, [staffMembers, staffSearch]);

  function toggleStaff(userId: string) {
    setStaffSearch("");
    setForm((prev) => {
      const exists = prev.assigned_staff_ids.includes(userId);

      return {
        ...prev,
        assigned_staff_ids: exists
          ? prev.assigned_staff_ids.filter((id) => id !== userId)
          : [...prev.assigned_staff_ids, userId],
      };
    });
  }

  function moveStaffToPrimary(userId: string) {
    setForm((prev) => ({
      ...prev,
      assigned_staff_ids: uniqueValues([
        userId,
        ...prev.assigned_staff_ids.filter((id) => id !== userId),
      ]),
    }));
  }

  function updateContact(index: number, patch: Partial<ResidentContactForm>) {
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, ...patch } : contact,
      ),
    }));
  }

  function removeContact(index: number) {
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.filter(
        (_, contactIndex) => contactIndex !== index,
      ),
    }));
  }

  function addContact() {
    setForm((prev) => ({
      ...prev,
      contacts: [
        ...prev.contacts,
        {
          full_name: "",
          relationship: "",
          phone: "",
          email: "",
          can_receive_info: false,
          authorization_basis: "",
          authorization_notes: "",
        },
      ],
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/50 p-4 backdrop-blur-sm md:p-6">
      <section className="flex max-h-[calc(100vh-48px)] w-full max-w-[1180px] flex-col overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)]">
        <div className="flex items-start justify-between gap-5 bg-[#486b5d] px-6 py-5 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/80">
              Gyventojo duomenys
            </p>
            <h2 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white md:text-4xl">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-white/80">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Uždaryti"
          >
            <X size={28} strokeWidth={2.1} />
          </button>
        </div>

        <div className="border-b border-[#dbe6e0] bg-[#eef4f1] px-5 py-3 md:px-6">
          <div className="flex flex-wrap gap-2">
            {RESIDENT_POPUP_TABS.map((item) => {
              const Icon = item.icon;
              const active = popupTab === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPopupTab(item.key)}
                  className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
                    active
                      ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
                      : "text-[#486b5d] hover:bg-white/70 hover:text-[#10251f]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-h-[calc(100vh-238px)] overflow-y-auto bg-[#f3f6f4] px-5 py-5 md:px-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <InfoBox
              title="Kaip pildyti šią formą"
              text="Šiame lange kuriamas arba redaguojamas gyventojo sąrašo įrašas. Pirmiausia įrašyk gyventojo vardą, statusą ir kambarį, tada pridėk artimuosius bei atsakingus darbuotojus. Detalesnė slaugos, rizikų, mitybos, judėjimo ir ISGP informacija pildoma jau gyventojo kortelėje."
            />
            {popupTab === "main" ? (
            <FormSection
              icon={<User className="h-5 w-5" />}
              title="Gyventojo duomenys"
              description="Rink tik tuos duomenis, kurie reikalingi paslaugai teikti ir gyventojui identifikuoti."
            >
              <InfoBox
                compact
                title="Pagrindiniai duomenys"
                text="Šie laukai naudojami sąrašui, paieškai, kambario priskyrimui ir gyventojo kortelės atidarymui. Jei informacija nežinoma, geriau palikti tuščią negu įrašyti spėjimą."
              />

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Field label="Pilnas vardas">
                  <input
                    value={form.full_name}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        full_name: event.target.value,
                      }))
                    }
                    placeholder="Pvz., Jonas Jonaitis"
                    className={inputClass}
                  />
                </Field>

                <Field label="Gimimo data">
                  <input
                    type="date"
                    min="1900-01-01"
                    max={todayInputValue()}
                    value={form.birth_date}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        birth_date: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs font-semibold text-[#8a9a91]">
                    Galima palikti tuščią. Neleidžiamos ateities datos ir datos
                    iki 1900-01-01.
                  </span>
                </Field>

                <Field label="Apsigyvenimo data">
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        start_date: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Gyventojo statusas">
                  <select
                    value={form.current_status}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        current_status: event.target.value as ResidentStatus,
                      }))
                    }
                    className={inputClass}
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
                    value={form.room_id}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        room_id: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Nepasirinkta</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name || room.id}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Telefonas">
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="+370..."
                    className={inputClass}
                  />
                </Field>

                <Field label="Slaugos / priežiūros lygis">
                  <select
                    value={form.care_level}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        care_level: event.target
                          .value as ResidentForm["care_level"],
                      }))
                    }
                    className={inputClass}
                  >
                    {CARE_LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Adresas">
                  <input
                    value={form.address}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        address: event.target.value,
                      }))
                    }
                    placeholder="Vilnius..."
                    className={inputClass}
                  />
                </Field>
              </div>
            </FormSection>
            ) : null}

            {popupTab === "contacts" ? (
            <FormSection
              icon={<HeartHandshake className="h-5 w-5" />}
              title="Artimųjų / kontaktinių asmenų duomenys"
              description="Gali pridėti kelis kontaktinius asmenis. Teisę gauti informaciją pažymėk tik tada, kai yra gyventojo sutikimas, įgaliojimas ar teisėtas atstovavimas."
            >
              <InfoBox
                compact
                title="Artimieji ir informacijos teikimas"
                text="Kontaktą galima saugoti bendravimui, bet teisę gauti informaciją pažymėk tik tada, kai yra aiškus pagrindas. Taip išvengiama BDAR rizikos ir neaiškumo darbuotojams."
              />

              <div className="mt-4 space-y-4">
                {form.contacts.map((contact, index) => (
                  <div
                    key={index}
                    className="rounded-[18px] border border-[#dbe6e0] bg-white p-4 shadow-[0_1px_3px_rgba(16,37,31,0.06)]"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-black text-[#10251f]">
                          {index === 0
                            ? "Pagrindinis kontaktas"
                            : `Kontaktas ${index + 1}`}
                        </h4>
                        <p className="text-sm font-semibold text-[#66756c]">
                          Vesk tik būtinus kontaktinius duomenis.
                        </p>
                      </div>

                      {form.contacts.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeContact(index)}
                          className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-black text-red-700 transition hover:bg-red-100"
                        >
                          Pašalinti
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <Field label="Artimojo vardas ir pavardė">
                        <input
                          value={contact.full_name}
                          onChange={(event) =>
                            updateContact(index, {
                              full_name: event.target.value,
                            })
                          }
                          placeholder="Pvz., Ona Jonaitienė"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Ryšys su gyventoju">
                        <select
                          value={contact.relationship}
                          onChange={(event) =>
                            updateContact(index, {
                              relationship: event.target.value,
                            })
                          }
                          className={inputClass}
                        >
                          <option value="">Nepasirinkta</option>
                          <option value="Dukra">Dukra</option>
                          <option value="Sūnus">Sūnus</option>
                          <option value="Sutuoktinis / sutuoktinė">
                            Sutuoktinis / sutuoktinė
                          </option>
                          <option value="Brolis / sesuo">Brolis / sesuo</option>
                          <option value="Globėjas">Globėjas</option>
                          <option value="Įgaliotas atstovas">
                            Įgaliotas atstovas
                          </option>
                          <option value="Kitas artimasis">
                            Kitas artimasis
                          </option>
                        </select>
                      </Field>

                      <Field label="Artimojo telefonas">
                        <input
                          value={contact.phone}
                          onChange={(event) =>
                            updateContact(index, { phone: event.target.value })
                          }
                          placeholder="+370..."
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Artimojo el. paštas">
                        <input
                          type="email"
                          value={contact.email}
                          onChange={(event) =>
                            updateContact(index, { email: event.target.value })
                          }
                          placeholder="artimasis@pvz.lt"
                          className={inputClass}
                        />
                      </Field>
                    </div>

                    <div className="mt-4 rounded-3xl border border-[#dbe6e0] bg-white p-4">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={contact.can_receive_info}
                          onChange={(event) =>
                            updateContact(index, {
                              can_receive_info: event.target.checked,
                              authorization_basis: event.target.checked
                                ? contact.authorization_basis
                                : "",
                              authorization_notes: event.target.checked
                                ? contact.authorization_notes
                                : "",
                            })
                          }
                          className="mt-1 h-5 w-5 accent-emerald-700"
                        />
                        <span>
                          <span className="block font-black text-[#10251f]">
                            Šis kontaktinis asmuo turi teisę gauti informaciją
                            apie gyventoją
                          </span>
                          <span className="mt-1 block text-sm font-semibold text-[#526174]">
                            Pažymėk tik kai yra pagrindas: gyventojo sutikimas,
                            įgaliojimas arba teisėtas atstovavimas.
                          </span>
                        </span>
                      </label>

                      {contact.can_receive_info ? (
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <Field label="Teisės gauti informaciją pagrindas">
                            <select
                              value={contact.authorization_basis}
                              onChange={(event) =>
                                updateContact(index, {
                                  authorization_basis: event.target
                                    .value as ResidentContactForm["authorization_basis"],
                                })
                              }
                              className={inputClass}
                            >
                              <option value="">Pasirinkti</option>
                              <option value="gyventojo_sutikimas">
                                Gyventojo sutikimas
                              </option>
                              <option value="igaliojimas">Įgaliojimas</option>
                              <option value="teisetasis_atstovas">
                                Teisėtas atstovas
                              </option>
                              <option value="kita">Kita</option>
                            </select>
                          </Field>

                          <Field label="Pastaba dėl pagrindo / dokumento">
                            <input
                              value={contact.authorization_notes}
                              onChange={(event) =>
                                updateContact(index, {
                                  authorization_notes: event.target.value,
                                })
                              }
                              placeholder="Pvz., įgaliojimas pateiktas 2026-05-08"
                              className={inputClass}
                            />
                          </Field>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addContact}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#a7f3d0] bg-emerald-50 px-4 py-3 font-extrabold text-[#047857] transition hover:bg-emerald-100"
                >
                  <Plus className="h-4 w-4" />
                  Pridėti dar vieną artimąjį
                </button>
              </div>
            </FormSection>
            ) : null}

            {popupTab === "staff" ? (
            <FormSection
              icon={<Users className="h-5 w-5" />}
              title="Priskirti darbuotojai"
              description="Galima pažymėti kelis darbuotojus. Pirmas pažymėtas laikomas pagrindiniu atsakingu darbuotoju."
            >
              <InfoBox
                compact
                title="Atsakingų darbuotojų priskyrimas"
                text="Pažymėti darbuotojai matys gyventoją pagal tavo teisių logiką. Pirmas pasirinktas darbuotojas laikomas pagrindiniu atsakingu, o kitus galima priskirti kaip papildomus."
              />

              <div className="mt-4 rounded-3xl border border-[#dbe6e0] bg-[#f8faf8] p-4">
                {staffMembers.length === 0 ? (
                  <p className="font-semibold text-[#66756c]">
                    Aktyvių darbuotojų nerasta. Pirmiausia pridėk darbuotojus
                    komandos modulyje.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <label className="relative block w-full lg:max-w-md">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a9a91]" />
                        <input
                          value={staffSearch}
                          onChange={(event) =>
                            setStaffSearch(event.target.value)
                          }
                          placeholder="Rašyk vardą, el. paštą ar pareigas..."
                          className="w-full rounded-2xl border border-[#dbe6e0] bg-white py-3 pl-12 pr-4 font-semibold outline-none transition focus:border-[#047857]"
                        />
                      </label>

                      <p className="text-sm font-black text-[#66756c]">
                        Pasirinkta: {form.assigned_staff_ids.length}
                      </p>
                    </div>

                    {form.assigned_staff_ids.length > 0 ? (
                      <div>
                        <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#526174]">
                          Pasirinkti darbuotojai
                        </p>
                        <div className="flex flex-wrap gap-2">
                        {form.assigned_staff_ids.map((userId, index) => {
                          const member = staffMembers.find(
                            (item) => item.user_id === userId,
                          );

                          return (
                            <button
                              key={userId}
                              type="button"
                              onClick={() => toggleStaff(userId)}
                              className="rounded-full border border-[#a7f3d0] bg-emerald-50 px-3 py-2 text-sm font-black text-[#047857] transition hover:bg-emerald-100"
                            >
                              {staffName(member)}
                              {index === 0 ? " · pagrindinis" : ""} ×
                            </button>
                          );
                        })}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-[#dbe6e0] bg-white">
                      {!staffSearchActive ? (
                        <div className="p-4 text-sm font-bold leading-6 text-[#526174]">
                          Pradėk rašyti bent 2 raides — tada parodysime iki 8 tinkamų darbuotojų. Taip nereikia slinkti per visą darbuotojų sąrašą.
                        </div>
                      ) : filteredStaffMembers.length === 0 ? (
                        <p className="p-4 font-semibold text-[#66756c]">
                          Pagal paiešką darbuotojų nerasta.
                        </p>
                      ) : (
                        <div className="max-h-72 overflow-y-auto">
                        {filteredStaffMembers.map((member) => {
                          const checked = form.assigned_staff_ids.includes(
                            member.user_id,
                          );
                          const isPrimary =
                            checked &&
                            form.assigned_staff_ids[0] === member.user_id;

                          return (
                            <div
                              key={member.user_id}
                              className={`flex items-center justify-between gap-3 border-b border-[#eef4f1] p-3 last:border-b-0 ${
                                checked ? "bg-emerald-50" : "bg-white"
                              }`}
                            >
                              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleStaff(member.user_id)}
                                  className="mt-1 h-5 w-5 accent-emerald-700"
                                />

                                <span className="min-w-0">
                                  <span className="block truncate font-black text-[#10251f]">
                                    {staffName(member)}
                                  </span>
                                  <span className="block truncate text-sm font-semibold text-[#66756c]">
                                    {staffRoleLabel(member) || "Darbuotojas"}
                                    {isPrimary ? " · pagrindinis" : ""}
                                  </span>
                                </span>
                              </label>

                              {checked && !isPrimary ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    moveStaffToPrimary(member.user_id)
                                  }
                                  className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-black text-[#047857] ring-1 ring-emerald-200 transition hover:bg-emerald-100"
                                >
                                  Pagrindinis
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </FormSection>
            ) : null}

            {popupTab === "notes" ? (
            <FormSection
              title="Papildoma informacija"
              description="Vidinės pastabos darbuotojams. Nerašyk perteklinių ar nebūtinų jautrių duomenų."
            >
              <InfoBox
                compact
                title="Vidinės pastabos"
                text="Čia rašomos tik trumpos administracinės pastabos. Slaugos rizikos, alergijos, mityba, mobilumas ir ISGP tikslai turi būti pildomi gyventojo kortelėje, kad informacija nebūtų dubliuojama."
              />

              <div className="mt-4">
                <Field label="Pastabos">
                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                    rows={4}
                    className={`${inputClass} resize-none`}
                  />
                </Field>
              </div>
            </FormSection>
            ) : null}

            <div className="sticky bottom-0 -mx-5 flex flex-col-reverse gap-3 border-t border-[#dbe6e0] bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end md:-mx-6 md:px-6">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[14px] border border-[#dbe6e0] bg-white px-6 py-3 font-extrabold text-[#486b5d] transition hover:bg-[#f8faf8]"
              >
                Atšaukti
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#047857] px-6 py-3 font-extrabold text-white transition hover:bg-[#036747] disabled:opacity-60"
              >
                <CheckCircle2 className="h-5 w-5" />
                {saving ? "Saugoma..." : "Išsaugoti gyventoją"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function HelpCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-3xl border border-[#dbe6e0] bg-[#f8faf8] p-5">
      <h3 className="text-base font-black text-[#10251f]">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#526174]">
        {text}
      </p>
    </article>
  );
}

function FormSection({
  icon,
  title,
  description,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#dbe6e0] bg-[#f8faf8] p-5">
      <div className="mb-5 flex items-start gap-3">
        {icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#047857] shadow-sm">
            {icon}
          </div>
        ) : null}
        <div>
          <h3 className="text-xl font-black tracking-tight text-[#10251f]">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-sm font-semibold leading-6 text-[#66756c]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-extrabold uppercase tracking-widest text-[#66756c]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] px-4 py-3 font-semibold outline-none transition focus:border-[#047857] focus:bg-white focus:ring-4 focus:ring-[#047857]/10";
