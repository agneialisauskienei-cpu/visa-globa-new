"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getChangedFields, logAudit } from "@/lib/audit";

type EmployeeOption = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  role?: string | null;
  department?: string | null;
  position?: string | null;
};

type TrainingRecord = {
  id: string;
  organization_id?: string | null;
  employee_id: string;
  title?: string | null;
  training_name?: string | null;
  name?: string | null;
  category?: string | null;
  provider?: string | null;
  completed_at?: string | null;
  expires_at?: string | null;
  valid_until?: string | null;
  hours?: number | string | null;
  status?: string | null;
  approval_status?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  submitted_by?: string | null;
  certificate_number?: string | null;
  certificate_no?: string | null;
  document_number?: string | null;
  number?: string | null;
  created_by?: string | null;
};

type Props = {
  organizationId: string | null | undefined;
  employees?: EmployeeOption[] | null;
  trainings?: TrainingRecord[] | null;
  onRefresh?: () => void | Promise<void>;
};

type FilterKey = "all" | "valid" | "expiring" | "expired" | "missing" | "pending";
type DepartmentKey = "all" | "administration" | "social" | "health" | "food" | "maintenance";

type Requirement = {
  title: string;
  hours: number;
};

type PositionRequirement = {
  key: string;
  title: string;
  department: DepartmentKey;
  departmentLabel: string;
  annualHours: number;
  roleKeywords: string[];
  positionKeywords: string[];
  required: Requirement[];
};

const COMMON_TRAININGS: Requirement[] = [
  { title: "Darbų sauga", hours: 2 },
  { title: "Gaisrinė sauga", hours: 2 },
  { title: "BDAR", hours: 1 },
];

const DEFAULT_GENERAL_TRAININGS: Requirement[] = [
  ...COMMON_TRAININGS,
  { title: "Pirmoji pagalba", hours: 4 },
  { title: "Higienos mokymai", hours: 2 },
  { title: "Infekcijų kontrolė", hours: 2 },
];

const POSITION_REQUIREMENTS: PositionRequirement[] = [
  {
    key: "director",
    title: "Direktorius",
    department: "administration",
    departmentLabel: "Administracija",
    annualHours: 8,
    roleKeywords: ["owner", "admin"],
    positionKeywords: ["direktor", "vadov", "administrator"],
    required: [
      { title: "Darbuotojų sauga vadovams", hours: 4 },
      { title: "BDAR vadovams", hours: 2 },
      { title: "Krizių valdymas", hours: 2 },
    ],
  },
  {
    key: "social_worker",
    title: "Socialinis darbuotojas",
    department: "social",
    departmentLabel: "Socialinė sritis",
    annualHours: 24,
    roleKeywords: [],
    positionKeywords: ["social", "soc", "glob", "užimt", "uzimt"],
    required: [
      { title: "Smurto prevencija", hours: 2 },
      { title: "Socialinių paslaugų įvadiniai mokymai", hours: 160 },
      { title: "Supervizijos / intervizijos", hours: 8 },
    ],
  },
  {
    key: "nurse",
    title: "Slaugytojas",
    department: "health",
    departmentLabel: "Sveikatos priežiūra",
    annualHours: 32,
    roleKeywords: [],
    positionKeywords: ["slaug", "medic", "sveikat", "gyd", "padėj", "padej"],
    required: [
      { title: "Profesinės licencijos palaikymas", hours: 8 },
      { title: "Vaistų administravimas", hours: 4 },
      { title: "Infekcijų kontrolė", hours: 2 },
    ],
  },
  {
    key: "food",
    title: "Maitinimo darbuotojas",
    department: "food",
    departmentLabel: "Maitinimo paslaugos",
    annualHours: 12,
    roleKeywords: [],
    positionKeywords: ["maist", "virtuv", "virėj", "virej"],
    required: [
      { title: "Maisto sauga", hours: 4 },
      { title: "Higienos mokymai", hours: 2 },
    ],
  },
  {
    key: "maintenance",
    title: "Ūkio darbuotojas",
    department: "maintenance",
    departmentLabel: "Ūkis",
    annualHours: 8,
    roleKeywords: [],
    positionKeywords: ["ūk", "uk", "techn", "vair", "sandel", "sandėl"],
    required: [
      { title: "Darbų sauga", hours: 2 },
      { title: "Gaisrinė sauga", hours: 2 },
    ],
  },
];

const DEPARTMENTS: Array<{ key: DepartmentKey; label: string }> = [
  { key: "all", label: "Visi" },
  { key: "administration", label: "Administracija" },
  { key: "social", label: "Socialinė sritis" },
  { key: "health", label: "Sveikatos priežiūra" },
  { key: "food", label: "Maitinimas" },
  { key: "maintenance", label: "Ūkis" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next.toISOString().slice(0, 10);
}

function fmt(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalize(value?: string | null) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function employeeName(employees: EmployeeOption[], id: string) {
  const employee = employees.find((item) => item.id === id);
  return employee?.full_name || employee?.name || "Darbuotojas";
}

function trainingTitle(training: TrainingRecord) {
  return training.title || training.training_name || training.name || "Mokymas";
}

function trainingExpiresAt(training: TrainingRecord) {
  return training.expires_at || training.valid_until || null;
}

function trainingCertificateNumber(training: TrainingRecord) {
  return (
    training.certificate_number ||
    training.certificate_no ||
    training.document_number ||
    training.number ||
    null
  );
}

function isTrainingApproved(record?: TrainingRecord | null) {
  if (!record) return false;

  const approval = normalize(record.approval_status);
  const status = normalize(record.status);

  return (
    approval.includes("approved") ||
    approval.includes("confirmed") ||
    approval.includes("patvirt") ||
    status === "approved" ||
    status === "confirmed" ||
    status === "valid" ||
    status === "active" ||
    Boolean(record.approved_at || record.verified_at || record.reviewed_at)
  );
}

function isPendingTraining(record?: TrainingRecord | null) {
  if (!record) return false;

  const approval = normalize(record.approval_status);
  const status = normalize(record.status);

  if (approval.includes("rejected") || status.includes("rejected")) return false;

  if (
    approval.includes("pending") ||
    approval.includes("submitted") ||
    approval.includes("lauki") ||
    status.includes("pending") ||
    status.includes("submitted") ||
    status.includes("lauki")
  ) {
    return true;
  }

  return false;
}

function statusForTraining(record?: TrainingRecord | null) {
  if (!record) {
    return {
      key: "missing" as const,
      label: "Trūksta",
      cls: "bg-[#fff6df] text-[#8a5a13] ring-[#ead8a7]",
    };
  }

  if (isPendingTraining(record)) {
    return {
      key: "pending" as const,
      label: "Laukia patvirtinimo",
      cls: "bg-[#fff6df] text-[#8a5a13] ring-[#ead8a7]",
    };
  }

  if (normalize(record.approval_status).includes("rejected") || normalize(record.status).includes("rejected")) {
    return {
      key: "expired" as const,
      label: "Nepatvirtinta",
      cls: "bg-red-50 text-red-800 ring-red-200",
    };
  }

  const expiresAt = trainingExpiresAt(record);
  if (!expiresAt) {
    return {
      key: "valid" as const,
      label: "Galioja",
      cls: "bg-[#e9f7ef] text-[#047857] ring-[#b7e7c8]",
    };
  }

  const expires = new Date(`${expiresAt}T00:00:00`);
  const today = new Date(`${todayIso()}T00:00:00`);
  const daysLeft = Math.ceil((expires.getTime() - today.getTime()) / 86400000);

  if (daysLeft < 0) {
    return {
      key: "expired" as const,
      label: "Pasibaigė",
      cls: "bg-red-50 text-red-800 ring-red-200",
    };
  }

  if (daysLeft <= 30) {
    return {
      key: "expiring" as const,
      label: "Baigiasi",
      cls: "bg-[#fff6df] text-[#8a5a13] ring-[#ead8a7]",
    };
  }

  return {
    key: "valid" as const,
    label: "Galioja",
    cls: "bg-[#e9f7ef] text-[#047857] ring-[#b7e7c8]",
  };
}

function toEmployee(member: any, profile?: any): EmployeeOption {
  const fullName =
    profile?.full_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    profile?.email ||
    null;

  return {
    id: member.user_id,
    full_name: fullName,
    name: fullName,
    role: member.role || null,
    department: member.department || null,
    position: member.position || null,
  };
}

function detectRequirement(employee: EmployeeOption) {
  const text = normalize(`${employee.role || ""} ${employee.department || ""} ${employee.position || ""}`);

  if (employee.role === "owner" || employee.role === "admin") {
    return POSITION_REQUIREMENTS[0];
  }

  return (
    POSITION_REQUIREMENTS.find((requirement) =>
      [...requirement.positionKeywords, ...requirement.roleKeywords].some((keyword) => text.includes(normalize(keyword))),
    ) || POSITION_REQUIREMENTS[1]
  );
}

function employeeRequiredTrainings(employee: EmployeeOption) {
  const requirement = detectRequirement(employee);
  return {
    requirement,
    trainings: Array.from(
      new Map([...DEFAULT_GENERAL_TRAININGS, ...requirement.required].map((item) => [normalize(item.title), item])).values(),
    ),
  };
}

function trainingMatchesRequired(training: TrainingRecord, requiredTitle: string) {
  const trainingName = normalize(trainingTitle(training));
  const required = normalize(requiredTitle);

  return trainingName === required || trainingName.includes(required) || required.includes(trainingName);
}

function isKnownRequiredTraining(title: string) {
  const normalized = normalize(title);
  const allRequired = [
    ...DEFAULT_GENERAL_TRAININGS,
    ...POSITION_REQUIREMENTS.flatMap((requirement) => requirement.required),
  ];

  return allRequired.some((item) => {
    const required = normalize(item.title);
    return normalized === required || normalized.includes(required) || required.includes(normalized);
  });
}

function shouldShowInApproval(record: TrainingRecord) {
  if (isPendingTraining(record)) return true;

  // Older employee-submitted records may have status="valid" because the previous
  // version saved them directly. If the title is not part of the required catalogue,
  // keep it visible for admin review so it is not lost.
  return !isKnownRequiredTraining(trainingTitle(record)) && !isTrainingApproved(record);
}

export default function TrainingModule({
  organizationId,
  employees: employeeInput,
  trainings: trainingInput,
  onRefresh,
}: Props) {
  const [internalEmployees, setInternalEmployees] = useState<EmployeeOption[]>([]);
  const [internalTrainings, setInternalTrainings] = useState<TrainingRecord[]>([]);
  const [loadingRealData, setLoadingRealData] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentKey>("all");
  const [selectedRequirementKey, setSelectedRequirementKey] = useState("social_worker");
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<TrainingRecord | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    employee_id: "",
    title: "",
    provider: "",
    completed_at: todayIso(),
    expires_at: "",
    hours: "1",
    certificate_number: "",
  });
  const [positionRequirementOverrides, setPositionRequirementOverrides] = useState<Record<string, Requirement[]>>({});
  const [requirementForm, setRequirementForm] = useState({
    title: "",
    hours: "1",
  });
  const [editingRequirementTitle, setEditingRequirementTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRealData() {
      if (!organizationId) return;

      setLoadingRealData(true);

      try {
        const shouldLoadEmployees = !Array.isArray(employeeInput) || employeeInput.length === 0;
        const shouldLoadTrainings = !Array.isArray(trainingInput) || trainingInput.length === 0;

        if (shouldLoadEmployees) {
          const { data: members, error: membersError } = await supabase
            .from("organization_members")
            .select("user_id, role, position, department, is_active, is_archived")
            .eq("organization_id", organizationId)
            .eq("is_active", true)
            .neq("is_archived", true)
            .order("position", { ascending: true });

          if (membersError) throw membersError;

          const userIds = (members || []).map((member: any) => member.user_id).filter(Boolean);
          let profilesById = new Map<string, any>();

          if (userIds.length) {
            const { data: profiles, error: profilesError } = await supabase
              .from("profiles")
              .select("id, email, first_name, last_name, full_name")
              .in("id", userIds);

            if (!profilesError) {
              profilesById = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
            }
          }

          const nextEmployees = ((members || []) as any[])
            .map((member) => toEmployee(member, profilesById.get(member.user_id)))
            .sort((a, b) => (a.full_name || a.name || "").localeCompare(b.full_name || b.name || "", "lt"));

          if (!cancelled) setInternalEmployees(nextEmployees);
        }

        if (shouldLoadTrainings) {
          const { data, error } = await supabase
            .from("personnel_trainings")
            .select("*")
            .eq("organization_id", organizationId)
            .order("expires_at", { ascending: true, nullsFirst: false });

          if (error) throw error;
          if (!cancelled) setInternalTrainings((data || []) as TrainingRecord[]);
        }
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        if (!cancelled) setMessage({ type: "error", text: `Nepavyko įkelti realių mokymų duomenų: ${text}` });
      } finally {
        if (!cancelled) setLoadingRealData(false);
      }
    }

    void loadRealData();

    return () => {
      cancelled = true;
    };
  }, [organizationId, employeeInput, trainingInput]);

  const employees = useMemo(() => {
    if (Array.isArray(employeeInput) && employeeInput.length > 0) return employeeInput;
    return internalEmployees;
  }, [employeeInput, internalEmployees]);

  const trainings = useMemo(() => {
    if (Array.isArray(trainingInput) && trainingInput.length > 0) return trainingInput;
    return internalTrainings;
  }, [trainingInput, internalTrainings]);

  useEffect(() => {
    if (!form.employee_id && employees[0]?.id) {
      setForm((prev) => ({ ...prev, employee_id: employees[0].id }));
    }
  }, [employees, form.employee_id]);

  const pendingTrainings = useMemo(() => trainings.filter(shouldShowInApproval), [trainings]);

  const selectedRequirement = useMemo(() => {
    const base = POSITION_REQUIREMENTS.find((item) => item.key === selectedRequirementKey) || POSITION_REQUIREMENTS[1];

    return {
      ...base,
      required: positionRequirementOverrides[base.key] || base.required,
    };
  }, [selectedRequirementKey, positionRequirementOverrides]);

  const filteredRequirements = useMemo(() => {
    if (departmentFilter === "all") return POSITION_REQUIREMENTS;
    return POSITION_REQUIREMENTS.filter((item) => item.department === departmentFilter);
  }, [departmentFilter]);

  useEffect(() => {
    if (!filteredRequirements.some((item) => item.key === selectedRequirementKey)) {
      setSelectedRequirementKey(filteredRequirements[0]?.key || "social_worker");
    }
  }, [filteredRequirements, selectedRequirementKey]);

  const employeeSummaryRows = useMemo(() => {
    return employees.map((employee) => {
      const { requirement, trainings: requiredTrainings } = employeeRequiredTrainings(employee);
      const employeeTrainings = trainings.filter((training) => training.employee_id === employee.id);
      const approved = employeeTrainings.filter((training) => !["expired", "pending"].includes(statusForTraining(training).key) && !shouldShowInApproval(training));
      const pending = employeeTrainings.filter(shouldShowInApproval);
      const expiring = approved.filter((training) => statusForTraining(training).key === "expiring");
      const expired = employeeTrainings.filter((training) => statusForTraining(training).key === "expired");
      const missing = requiredTrainings.filter(
        (required) => !approved.some((training) => trainingMatchesRequired(training, required.title)),
      );
      const progress = Math.round(((requiredTrainings.length - missing.length) / Math.max(1, requiredTrainings.length)) * 100);

      return {
        employee,
        requirement,
        requiredTrainings,
        approved,
        pending,
        expiring,
        expired,
        missing,
        progress,
      };
    });
  }, [employees, trainings]);

  const allDetailRows = useMemo(() => {
    const rows: Array<{
      id: string;
      kind: "record" | "missing";
      employee_id: string;
      employee_name: string;
      employee_position: string;
      requirement: PositionRequirement;
      title: string;
      completed_at: string | null;
      expires_at: string | null;
      hours: number | string | null;
      status: ReturnType<typeof statusForTraining>;
      record?: TrainingRecord | null;
    }> = [];

    for (const summary of employeeSummaryRows) {
      for (const training of trainings.filter((item) => item.employee_id === summary.employee.id)) {
        rows.push({
          id: training.id,
          kind: "record",
          employee_id: summary.employee.id,
          employee_name: summary.employee.full_name || summary.employee.name || "Darbuotojas",
          employee_position: summary.employee.position || summary.requirement.title,
          requirement: summary.requirement,
          title: trainingTitle(training),
          completed_at: training.completed_at || null,
          expires_at: trainingExpiresAt(training),
          hours: training.hours || null,
          status: shouldShowInApproval(training) ? {
            key: "pending",
            label: "Laukia patvirtinimo",
            cls: "bg-[#fff6df] text-[#8a5a13] ring-[#ead8a7]",
          } : statusForTraining(training),
          record: training,
        });
      }

      for (const missing of summary.missing) {
        rows.push({
          id: `missing-${summary.employee.id}-${missing.title}`,
          kind: "missing",
          employee_id: summary.employee.id,
          employee_name: summary.employee.full_name || summary.employee.name || "Darbuotojas",
          employee_position: summary.employee.position || summary.requirement.title,
          requirement: summary.requirement,
          title: missing.title,
          completed_at: null,
          expires_at: null,
          hours: null,
          status: statusForTraining(null),
          record: null,
        });
      }
    }

    return rows;
  }, [employeeSummaryRows, trainings]);

  const counts = useMemo(() => {
    const base = { all: employeeSummaryRows.length, valid: 0, expiring: 0, expired: 0, missing: 0, pending: pendingTrainings.length };

    for (const row of employeeSummaryRows) {
      if (row.missing.length === 0 && row.pending.length === 0 && row.expired.length === 0) base.valid += 1;
      if (row.expiring.length > 0) base.expiring += 1;
      if (row.expired.length > 0) base.expired += 1;
      if (row.missing.length > 0) base.missing += 1;
    }

    return base;
  }, [employeeSummaryRows, pendingTrainings]);

  const selectedPositionSpecificTrainings = useMemo(() => {
    const common = new Set(COMMON_TRAININGS.map((item) => normalize(item.title)));
    return selectedRequirement.required.filter((item) => !common.has(normalize(item.title)));
  }, [selectedRequirement.required]);

  const positionStats = useMemo(() => {
    const assignedEmployees = employees.filter((employee) => detectRequirement(employee).key === selectedRequirement.key);
    const approvedTrainings = trainings.filter((training) => {
      const employee = employees.find((item) => item.id === training.employee_id);
      return employee && detectRequirement(employee).key === selectedRequirement.key && !["expired", "pending"].includes(statusForTraining(training).key) && !shouldShowInApproval(training);
    });

    const totalHours = approvedTrainings.reduce((sum, training) => sum + Number(training.hours || 0), 0);

    return {
      assigned: assignedEmployees.length,
      hours: totalHours,
    };
  }, [employees, trainings, selectedRequirement]);

  const filteredEmployeeSummary = useMemo(() => {
    const q = query.trim().toLowerCase();

    return employeeSummaryRows.filter((row) => {
      if (departmentFilter !== "all" && row.requirement.department !== departmentFilter) return false;

      if (filter === "pending" && row.pending.length === 0) return false;
      if (filter === "missing" && row.missing.length === 0) return false;
      if (filter === "expiring" && row.expiring.length === 0) return false;
      if (filter === "expired" && row.expired.length === 0) return false;
      if (filter === "valid" && (row.missing.length > 0 || row.pending.length > 0 || row.expired.length > 0)) return false;

      if (!q) return true;
      return `${row.employee.full_name || row.employee.name || ""} ${row.employee.position || ""} ${row.requirement.title}`.toLowerCase().includes(q);
    });
  }, [employeeSummaryRows, departmentFilter, filter, query]);

  function prefill(employeeId: string, title: string) {
    setForm((prev) => ({
      ...prev,
      employee_id: employeeId,
      title,
      completed_at: todayIso(),
      expires_at: "",
      certificate_number: "",
    }));
    setShowNewForm(true);
    setMessage(null);
  }

  function addRequiredTrainingForPosition() {
    const title = requirementForm.title.trim();
    const hours = Number(requirementForm.hours || 0);

    if (!title) {
      setMessage({ type: "error", text: "Įvesk privalomo mokymo pavadinimą." });
      return;
    }

    setPositionRequirementOverrides((prev) => {
      const current = prev[selectedRequirement.key] || selectedRequirement.required;
      const withoutEdited = editingRequirementTitle
        ? current.filter((item) => normalize(item.title) !== normalize(editingRequirementTitle))
        : current;

      const exists = withoutEdited.some((item) => normalize(item.title) === normalize(title));
      const next = exists
        ? withoutEdited.map((item) =>
            normalize(item.title) === normalize(title) ? { ...item, hours } : item,
          )
        : [...withoutEdited, { title, hours }];

      return {
        ...prev,
        [selectedRequirement.key]: next,
      };
    });

    setRequirementForm({ title: "", hours: "1" });
    setEditingRequirementTitle(null);
    setMessage({
      type: "success",
      text: editingRequirementTitle ? "Privalomas mokymas atnaujintas." : "Privalomas mokymas pridėtas prie pareigybės.",
    });
  }

  function editRequiredTrainingForPosition(item: Requirement) {
    setRequirementForm({ title: item.title, hours: String(item.hours) });
    setEditingRequirementTitle(item.title);
  }

  function cancelRequiredTrainingEdit() {
    setRequirementForm({ title: "", hours: "1" });
    setEditingRequirementTitle(null);
  }

  function removeRequiredTrainingFromPosition(title: string) {
    setPositionRequirementOverrides((prev) => {
      const current = prev[selectedRequirement.key] || selectedRequirement.required;
      return {
        ...prev,
        [selectedRequirement.key]: current.filter((item) => normalize(item.title) !== normalize(title)),
      };
    });

    if (editingRequirementTitle && normalize(editingRequirementTitle) === normalize(title)) {
      cancelRequiredTrainingEdit();
    }
  }

  async function refreshAll() {
    await onRefresh?.();

    if (!organizationId) return;

    const { data, error } = await supabase
      .from("personnel_trainings")
      .select("*")
      .eq("organization_id", organizationId)
      .order("expires_at", { ascending: true, nullsFirst: false });

    if (!error) setInternalTrainings((data || []) as TrainingRecord[]);
  }

  async function saveTraining() {
    setMessage(null);

    if (!organizationId) {
      setMessage({ type: "error", text: "Nenustatyta organizacija." });
      return;
    }

    if (!form.employee_id || !form.title.trim()) {
      setMessage({ type: "error", text: "Pasirink darbuotoją ir įvesk mokymo pavadinimą." });
      return;
    }

    setSaving(true);

    const payload: any = {
      organization_id: organizationId,
      employee_id: form.employee_id,
      title: form.title.trim(),
      provider: form.provider.trim() || null,
      completed_at: form.completed_at || null,
      expires_at: form.expires_at || null,
      valid_until: form.expires_at || null,
      hours: Number(form.hours || 0),
      certificate_number: form.certificate_number.trim() || null,
      status: "valid",
      approval_status: "approved",
    };

    let { data, error } = await supabase
      .from("personnel_trainings")
      .insert(payload)
      .select("*")
      .single();

    // If older DB schema does not yet have the optional fields, save the record
    // without them instead of making the whole form feel broken.
    if (error) {
      const fallbackPayload = { ...payload } as any;
      delete fallbackPayload.certificate_number;
      delete fallbackPayload.valid_until;
      delete fallbackPayload.approval_status;

      const retry = await supabase
        .from("personnel_trainings")
        .insert(fallbackPayload)
        .select("*")
        .single();

      data = retry.data;
      error = retry.error;
    }

    setSaving(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    await logAudit({
      organizationId,
      tableName: "personnel_trainings",
      recordId: (data as TrainingRecord).id,
      action: "insert",
      changes: getChangedFields({}, data as Record<string, unknown>),
    });

    setInternalTrainings((prev) => [data as TrainingRecord, ...prev]);
    setMessage({ type: "success", text: "Mokymas išsaugotas ir įskaitytas." });
    setForm((prev) => ({
      ...prev,
      title: "",
      provider: "",
      completed_at: todayIso(),
      expires_at: "",
      hours: "1",
      certificate_number: "",
    }));
    setShowNewForm(false);
    await onRefresh?.();
  }

  async function approveTraining(trainingId: string) {
    setApprovingId(trainingId);
    setMessage(null);

    const previous = trainings;
    const previousTraining = trainings.find((training) => training.id === trainingId) || null;
    const approvedPayload = {
      status: "valid",
      approval_status: "approved",
      approved_at: todayIso(),
      verified_at: todayIso(),
      reviewed_at: todayIso(),
    };

    setInternalTrainings((prev) =>
      prev.map((training) =>
        training.id === trainingId
          ? { ...training, ...approvedPayload }
          : training,
      ),
    );

    let { error } = await supabase
      .from("personnel_trainings")
      .update(approvedPayload)
      .eq("id", trainingId);

    let actualPayload: Record<string, unknown> = approvedPayload;

    if (error) {
      const retry = await supabase
        .from("personnel_trainings")
        .update({ status: "valid" })
        .eq("id", trainingId);
      error = retry.error;
      actualPayload = { status: "valid" };
    }

    setApprovingId(null);

    if (error) {
      setInternalTrainings(previous);
      setMessage({ type: "error", text: `Nepavyko patvirtinti mokymo: ${error.message}` });
      return;
    }

    setInternalTrainings((prev) =>
      prev.map((training) =>
        training.id === trainingId
          ? { ...training, ...actualPayload }
          : training,
      ),
    );

    setSelectedTraining((current) =>
      current?.id === trainingId
        ? { ...current, ...actualPayload }
        : current,
    );

    if (previousTraining) {
      await logAudit({
        organizationId: previousTraining.organization_id || organizationId,
        tableName: "personnel_trainings",
        recordId: trainingId,
        action: "update",
        changes: getChangedFields(previousTraining as Record<string, unknown>, {
          ...previousTraining,
          ...actualPayload,
        } as Record<string, unknown>),
      });
    }

    setMessage({ type: "success", text: "Mokymas patvirtintas ir įskaitytas." });
    await onRefresh?.();
  }

  async function rejectTraining(trainingId: string) {
    setApprovingId(trainingId);
    setMessage(null);

    const previous = trainings;
    const previousTraining = trainings.find((training) => training.id === trainingId) || null;
    const rejectedPayload = { status: "rejected", approval_status: "rejected" };

    setInternalTrainings((prev) =>
      prev.map((training) =>
        training.id === trainingId
          ? { ...training, ...rejectedPayload }
          : training,
      ),
    );

    let { error } = await supabase
      .from("personnel_trainings")
      .update(rejectedPayload)
      .eq("id", trainingId);

    let actualPayload: Record<string, unknown> = rejectedPayload;

    if (error) {
      const retry = await supabase
        .from("personnel_trainings")
        .update({ status: "rejected" })
        .eq("id", trainingId);
      error = retry.error;
      actualPayload = { status: "rejected" };
    }

    setApprovingId(null);

    if (error) {
      setInternalTrainings(previous);
      setMessage({ type: "error", text: `Nepavyko nepatvirtinti mokymo: ${error.message}` });
      return;
    }

    setSelectedTraining((current) =>
      current?.id === trainingId
        ? { ...current, ...actualPayload }
        : current,
    );

    if (previousTraining) {
      await logAudit({
        organizationId: previousTraining.organization_id || organizationId,
        tableName: "personnel_trainings",
        recordId: trainingId,
        action: "update",
        changes: getChangedFields(previousTraining as Record<string, unknown>, {
          ...previousTraining,
          ...actualPayload,
        } as Record<string, unknown>),
      });
    }

    setMessage({ type: "success", text: "Mokymas nepatvirtintas." });
    await onRefresh?.();
  }


  return (
    <section className="overflow-hidden rounded-2xl border border-[#c9d8d0] bg-white shadow-sm">
      <header className="border-b border-[#dbe6e0] bg-[#486b5d] px-5 py-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">Mokymai</div>
            <h2 className="mt-1 text-2xl font-black">Mokymų reikalavimai ir darbuotojų atitiktis</h2>
            <p className="mt-1 text-sm font-semibold text-white/80">
              Viena eilutė darbuotojui. Detalės atidaromos paspaudus darbuotoją.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-black">
            <button type="button" onClick={() => setFilter("all")} className={filter === "all" ? "rounded-lg bg-white px-3 py-2 text-[#486b5d]" : "rounded-lg bg-white/12 px-3 py-2"}>
              Visi {counts.all}
            </button>
            <button type="button" onClick={() => setFilter("pending")} className={filter === "pending" ? "rounded-lg bg-[#fff6df] px-3 py-2 text-[#8a5a13]" : "rounded-lg bg-white/12 px-3 py-2"}>
              Laukia patvirtinimo {counts.pending}
            </button>
            <button type="button" onClick={() => setFilter("missing")} className={filter === "missing" ? "rounded-lg bg-[#fff6df] px-3 py-2 text-[#8a5a13]" : "rounded-lg bg-white/12 px-3 py-2"}>
              Trūksta {counts.missing}
            </button>
            <button type="button" onClick={() => setFilter("expiring")} className={filter === "expiring" ? "rounded-lg bg-[#fff6df] px-3 py-2 text-[#8a5a13]" : "rounded-lg bg-white/12 px-3 py-2"}>
              Baigiasi {counts.expiring}
            </button>
            <button type="button" onClick={() => setFilter("valid")} className={filter === "valid" ? "rounded-lg bg-white px-3 py-2 text-[#486b5d]" : "rounded-lg bg-white/12 px-3 py-2"}>
              Tvarkingi {counts.valid}
            </button>
          </div>
        </div>
      </header>

      <section className="border-b border-[#dbe6e0] bg-[#f8faf8] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">Veiksmai</span>
          <button type="button" onClick={() => {
              setShowNewForm(true);
            }} className="rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d] hover:bg-[#eef4f1]">
            <Plus className="mr-1 inline h-3 w-3" />
            Naujas mokymas
          </button>
          <button type="button" onClick={() => setShowLibrary(true)} className="rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d] hover:bg-[#eef4f1]">
            Mokymų biblioteka
          </button>
          <button type="button" onClick={() => void refreshAll()} disabled={loadingRealData} className="rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d] hover:bg-[#eef4f1] disabled:opacity-60">
            {loadingRealData ? "Kraunama..." : "Atnaujinti"}
          </button>

          <div className="mx-2 hidden h-7 w-px bg-[#dbe6e0] md:block" />

          <span className="mr-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">Filtrai</span>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6a7e75]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 min-w-[300px] rounded-lg border border-[#c2d3ca] bg-white pl-9 pr-3 text-xs font-semibold outline-none focus:border-[#486b5d]" placeholder="Ieškoti darbuotojo, pareigų, mokymo..." />
          </label>
          <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value as DepartmentKey)} className="h-9 rounded-lg border border-[#c2d3ca] bg-white px-3 text-xs font-bold outline-none">
            {DEPARTMENTS.map((department) => (
              <option key={department.key} value={department.key}>{department.label}</option>
            ))}
          </select>
        </div>
      </section>

      {message ? (
        <div className={`mx-4 mt-4 rounded-lg border px-4 py-3 text-sm font-bold ${message.type === "success" ? "border-[#c9d8d0] bg-[#eef4f1] text-[#486b5d]" : "border-red-200 bg-red-50 text-red-800"}`}>
          {message.text}
        </div>
      ) : null}

      {showNewForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <section id="training-new-form" className="w-full max-w-5xl rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">Naujas įrašas</div>
              <div className="mt-1 text-lg font-black text-[#10251f]">Darbuotojo mokymas</div>
              <p className="mt-1 text-sm font-bold text-[#6a7e75]">Administratorius įveda mokymą ir jis iškart įskaitomas. Galiojimo data ir pažymėjimo numeris neprivalomi.</p>
            </div>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-[#486b5d]" />
              <button type="button" onClick={() => setShowNewForm(false)} className="rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d]">Uždaryti</button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select value={form.employee_id} onChange={(event) => setForm((prev) => ({ ...prev, employee_id: event.target.value }))} className="h-10 min-w-0 rounded-lg border border-[#c2d3ca] bg-white px-3 text-sm font-bold outline-none">
              <option value="">Pasirinkti darbuotoją</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.full_name || employee.name || employee.id}</option>
              ))}
            </select>
            <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} className="h-10 min-w-0 rounded-lg border border-[#c2d3ca] bg-white px-3 text-sm font-bold outline-none" placeholder="Mokymo pavadinimas" />
            <input value={form.provider} onChange={(event) => setForm((prev) => ({ ...prev, provider: event.target.value }))} className="h-10 min-w-0 rounded-lg border border-[#c2d3ca] bg-white px-3 text-sm font-bold outline-none" placeholder="Teikėjas" />
            <input value={form.certificate_number} onChange={(event) => setForm((prev) => ({ ...prev, certificate_number: event.target.value }))} className="h-10 min-w-0 rounded-lg border border-[#c2d3ca] bg-white px-3 text-sm font-bold outline-none" placeholder="Pažymėjimo nr." />
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#6a7e75]">
              Mokymo data
              <input type="date" value={form.completed_at} onChange={(event) => setForm((prev) => ({ ...prev, completed_at: event.target.value }))} className="h-10 min-w-0 rounded-lg border border-[#c2d3ca] bg-white px-3 text-sm font-bold normal-case tracking-normal outline-none" />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#6a7e75]">
              Galioja iki
              <input type="date" value={form.expires_at} onChange={(event) => setForm((prev) => ({ ...prev, expires_at: event.target.value }))} className="h-10 min-w-0 rounded-lg border border-[#c2d3ca] bg-white px-3 text-sm font-bold normal-case tracking-normal outline-none" />
            </label>
            <input type="number" min="0" step="0.5" value={form.hours} onChange={(event) => setForm((prev) => ({ ...prev, hours: event.target.value }))} className="h-10 min-w-0 self-end rounded-lg border border-[#c2d3ca] bg-white px-3 text-sm font-bold outline-none" placeholder="Val." />
            <button type="button" onClick={saveTraining} disabled={saving} className="h-10 self-end rounded-lg bg-[#486b5d] px-4 text-sm font-black text-white hover:bg-[#39594c] disabled:opacity-60">
              {saving ? <RefreshCw className="mr-1 inline h-4 w-4 animate-spin" /> : null}
              Išsaugoti
            </button>
          </div>
          </section>
        </div>
      ) : null}

      {showLibrary ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <section className="w-full max-w-4xl rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#dbe6e0] pb-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">
                  Mokymų biblioteka
                </div>
                <h3 className="mt-1 text-2xl font-black text-[#10251f]">
                  Pasirinkite mokymą
                </h3>
                <p className="mt-1 text-sm font-bold text-[#6a7e75]">
                  Paspaudus mokymas įkeliamas į naujo įrašo formą.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLibrary(false)}
                className="rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d]"
              >
                Uždaryti
              </button>
            </div>

            <div className="mt-4 grid max-h-[55vh] gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {[...DEFAULT_GENERAL_TRAININGS, ...POSITION_REQUIREMENTS.flatMap((requirement) => requirement.required)]
                .filter((item, index, all) => all.findIndex((other) => normalize(other.title) === normalize(item.title)) === index)
                .map((item) => (
                  <button
                    key={`${item.title}-${item.hours}`}
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, title: item.title, hours: String(item.hours) }));
                      setShowNewForm(true);
                      setShowLibrary(false);
                    }}
                    className="rounded-xl border border-[#86efac] bg-[#e9f7ef] px-4 py-3 text-left text-sm font-black text-[#047857] hover:bg-[#dcfce7]"
                  >
                    ✓ {item.title}
                    <span className="mt-1 block text-xs text-[#486b5d]">{item.hours} val.</span>
                  </button>
                ))}
            </div>
          </section>
        </div>
      ) : null}

      <section className="p-4">
        <section className="mb-4 rounded-xl border border-[#dbe6e0] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">Padalinys</span>
            {DEPARTMENTS.map((department) => (
              <button
                key={department.key}
                type="button"
                onClick={() => setDepartmentFilter(department.key)}
                className={
                  departmentFilter === department.key
                    ? "rounded-lg bg-[#047857] px-4 py-2 text-sm font-black text-white"
                    : "rounded-lg border border-[#dbe6e0] bg-white px-4 py-2 text-sm font-black text-[#40594f] hover:bg-[#eef4f1]"
                }
              >
                {department.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">Pareigybė</span>
            {filteredRequirements.map((requirement) => (
              <button
                key={requirement.key}
                type="button"
                onClick={() => setSelectedRequirementKey(requirement.key)}
                className={
                  selectedRequirement.key === requirement.key
                    ? "rounded-full border border-[#86efac] bg-[#e9f7ef] px-4 py-2 text-sm font-black text-[#047857]"
                    : "rounded-full border border-[#dbe6e0] bg-white px-4 py-2 text-sm font-black text-[#40594f] hover:bg-[#eef4f1]"
                }
              >
                {requirement.title} · {requirement.annualHours} val.
              </button>
            ))}
            <select value={selectedRequirement.key} onChange={(event) => setSelectedRequirementKey(event.target.value)} className="ml-auto h-10 rounded-lg border border-[#c2d3ca] bg-white px-3 text-sm font-black text-[#40594f] outline-none">
              {POSITION_REQUIREMENTS.map((requirement) => (
                <option key={requirement.key} value={requirement.key}>{requirement.title}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="rounded-xl border border-[#dbe6e0] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6a7e75]">Pareigybės reikalavimai</div>
              <h3 className="mt-1 text-3xl font-black">{selectedRequirement.title}</h3>
              <p className="mt-1 text-sm font-bold text-[#6a7e75]">{selectedRequirement.departmentLabel}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-left">
              <MiniStat label="Metinė norma" value={`${selectedRequirement.annualHours} val.`} />
              <MiniStat label="Priskirta" value={String(positionStats.assigned)} />
              <MiniStat label="Mokymų suma" value={`${positionStats.hours} val.`} />
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[#dbe6e0] bg-[#f8faf8] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-xl font-black">Privalomi mokymai</h4>
                <p className="mt-1 text-sm font-bold text-[#6a7e75]">Bendri visiems darbuotojams ir papildomi pagal pareigybę.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setShowLibrary(true)} className="rounded-xl border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-black text-[#486b5d]">Biblioteka</button>
                <button type="button" onClick={() => {
                    setShowNewForm(true);
                  }} className="rounded-xl bg-[#047857] px-4 py-3 text-sm font-black text-white">+ Naujas</button>
                <button
                  type="button"
                  onClick={() => {
                    setRequirementForm((prev) => ({ ...prev, title: prev.title || "", hours: prev.hours || "1" }));
                    document.getElementById("position-required-training-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="rounded-xl border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-black text-[#486b5d]"
                >
                  Pareigybė
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <RequirementBlock title="Bendrieji visiems darbuotojams" items={COMMON_TRAININGS} />

              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">
                  Pareigybei privalomi mokymai
                </div>

                <div id="position-required-training-form" className="mt-3 rounded-xl border border-[#dbe6e0] bg-white p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-[#6a7e75]">
                      {editingRequirementTitle ? "Redaguojamas privalomas mokymas" : "Naujas privalomas mokymas"}
                    </div>
                    {editingRequirementTitle ? (
                      <button
                        type="button"
                        onClick={cancelRequiredTrainingEdit}
                        className="rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d]"
                      >
                        Atšaukti
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[1fr_110px_auto]">
                    <input
                      value={requirementForm.title}
                      onChange={(event) => setRequirementForm((prev) => ({ ...prev, title: event.target.value }))}
                      className="h-10 rounded-lg border border-[#c2d3ca] bg-white px-3 text-sm font-bold outline-none"
                      placeholder="Pvz., pragulų prevencija"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={requirementForm.hours}
                      onChange={(event) => setRequirementForm((prev) => ({ ...prev, hours: event.target.value }))}
                      className="h-10 rounded-lg border border-[#c2d3ca] bg-white px-3 text-sm font-bold outline-none"
                      placeholder="Val."
                    />
                    <button
                      type="button"
                      onClick={addRequiredTrainingForPosition}
                      className="rounded-lg bg-[#047857] px-4 py-2 text-sm font-black text-white"
                    >
                      {editingRequirementTitle ? "Išsaugoti" : "Pridėti"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedPositionSpecificTrainings.map((item) => (
                    <span
                      key={`${item.title}-${item.hours}`}
                      className="inline-flex items-center gap-2 rounded-full border border-[#86efac] bg-[#e9f7ef] px-4 py-2 text-sm font-black text-[#047857]"
                    >
                      ✓ {item.title} · {item.hours} val.
                      <button
                        type="button"
                        onClick={() => editRequiredTrainingForPosition(item)}
                        className="rounded-full bg-white/80 px-2 text-xs font-black text-[#486b5d]"
                        title="Redaguoti"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRequiredTrainingFromPosition(item.title)}
                        className="rounded-full bg-white/80 px-2 text-xs font-black text-red-700"
                        title="Ištrinti"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-[#dbe6e0] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">Darbuotojų mokymai</div>
              <h3 className="mt-1 text-3xl font-black">Būklė pagal darbuotojus</h3>
              <p className="mt-1 max-w-xl text-sm font-bold text-[#6a7e75]">Viena eilutė darbuotojui. Detalės atidaromos po eilute.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setFilter("all")} className={filter === "all" ? "rounded-xl bg-[#047857] px-4 py-3 text-sm font-black text-white" : "rounded-xl border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-black text-[#40594f]"}>
                Visi
              </button>
              <button type="button" onClick={() => setFilter("pending")} className={filter === "pending" ? "rounded-xl bg-[#8a5a13] px-4 py-3 text-sm font-black text-white" : "rounded-xl border border-[#ead9b2] bg-white px-4 py-3 text-sm font-black text-[#8a5a13]"}>
                Laukia patvirtinimo
              </button>
              <button type="button" onClick={() => setFilter("missing")} className={filter === "missing" ? "rounded-xl bg-[#047857] px-4 py-3 text-sm font-black text-white" : "rounded-xl border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-black text-[#40594f]"}>
                Trūksta
              </button>
              <button type="button" onClick={() => setFilter("expiring")} className={filter === "expiring" ? "rounded-xl bg-[#fff6df] px-4 py-3 text-sm font-black text-[#8a5a13]" : "rounded-xl border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-black text-[#40594f]"}>
                Baigiasi
              </button>
            </div>
          </div>

          {pendingTrainings.length > 0 ? (
            <div className="mt-5 rounded-xl border border-[#ead9b2] bg-[#fffdf8] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8a5a13]">Patvirtinimai</div>
                  <h4 className="mt-1 text-xl font-black">Darbuotojų pateikti mokymai</h4>
                  <p className="mt-1 max-w-2xl text-sm font-bold text-[#7a6a4f]">
                    Darbuotojų įvesti mokymai įskaitomi tik administracijai patvirtinus, kad pažymėjimas buvo peržiūrėtas.
                  </p>
                </div>
                <span className="rounded-xl bg-[#8a5a13] px-4 py-3 text-sm font-black text-white">
                  Laukia patvirtinimo · {pendingTrainings.length}
                </span>
              </div>

              <div className="mt-4 grid gap-2">
                {pendingTrainings.map((training) => (
                  <div key={training.id} className="grid gap-3 rounded-xl border border-[#ead9b2] bg-white p-3 md:grid-cols-[1.2fr_1.4fr_0.7fr_auto] md:items-center">
                    <div className="font-black">{employeeName(employees, training.employee_id)}</div>
                    <div className="font-semibold text-[#40594f]">{trainingTitle(training)}</div>
                    <div className="font-semibold text-[#6a7e75]">{fmt(training.completed_at)}</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void approveTraining(training.id)}
                        disabled={approvingId === training.id}
                        className="rounded-lg bg-[#047857] px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                      >
                        {approvingId === training.id ? "Tvirtinama..." : "Patvirtinti"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void rejectTraining(training.id)}
                        disabled={approvingId === training.id}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-800 disabled:opacity-60"
                      >
                        Nepatvirtinti
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTraining(training)}
                        className="rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d]"
                      >
                        Peržiūrėti
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 overflow-x-auto rounded-xl border border-[#dbe6e0]">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#eef4f1] text-[#40594f]">
                <tr>
                  <th className="px-4 py-3 font-black">Darbuotojas</th>
                  <th className="px-4 py-3 font-black">Pareigos</th>
                  <th className="px-4 py-3 font-black">Būsena</th>
                  <th className="px-4 py-3 font-black">Trūksta</th>
                  <th className="px-4 py-3 font-black">Progresas</th>
                  <th className="px-4 py-3 font-black">Veiksmas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef4f1]">
                {filteredEmployeeSummary.length ? filteredEmployeeSummary.map((row) => {
                  const expanded = expandedEmployeeId === row.employee.id;
                  return (
                    <FragmentRow
                      key={row.employee.id}
                      row={row}
                      expanded={expanded}
                      details={allDetailRows.filter((detail) => detail.employee_id === row.employee.id)}
                      onToggle={() => setExpandedEmployeeId(expanded ? null : row.employee.id)}
                      onPrefill={prefill}
                      onApprove={approveTraining}
                      onPreview={(training) => setSelectedTraining(training)}
                      onReject={rejectTraining}
                      approvingId={approvingId}
                    />
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center font-bold text-[#6a7e75]">
                      Darbuotojų mokymų pagal pasirinktus filtrus nėra.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {selectedTraining ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[#c9d8d0] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#dbe6e0] bg-[#f8faf8] px-5 py-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">
                  Mokymo peržiūra
                </div>
                <h3 className="mt-1 text-2xl font-black text-[#10251f]">
                  {trainingTitle(selectedTraining)}
                </h3>
                <p className="mt-1 text-sm font-bold text-[#6a7e75]">
                  {employeeName(employees, selectedTraining.employee_id)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTraining(null)}
                className="rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d]"
              >
                Uždaryti
              </button>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <InfoLine label="Data" value={fmt(selectedTraining.completed_at)} />
              <InfoLine label="Galioja iki" value={fmt(trainingExpiresAt(selectedTraining))} />
              <InfoLine label="Valandos" value={String(selectedTraining.hours || "—")} />
              <InfoLine label="Pažymėjimo nr." value={trainingCertificateNumber(selectedTraining) || "—"} />
              <InfoLine label="Teikėjas" value={selectedTraining.provider || "—"} />
              <InfoLine label="Būsena" value={statusForTraining(selectedTraining).label} />
            </div>

            <div className="flex justify-end gap-2 border-t border-[#dbe6e0] px-5 py-4">
              {shouldShowInApproval(selectedTraining) ? (
                <>
                  <button
                    type="button"
                    onClick={() => void approveTraining(selectedTraining.id)}
                    disabled={approvingId === selectedTraining.id}
                    className="rounded-lg bg-[#047857] px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                  >
                    {approvingId === selectedTraining.id ? "Tvirtinama..." : "Patvirtinti"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void rejectTraining(selectedTraining.id)}
                    disabled={approvingId === selectedTraining.id}
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-800 disabled:opacity-60"
                  >
                    Nepatvirtinti
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => setSelectedTraining(null)}
                className="rounded-lg border border-[#dbe6e0] bg-white px-4 py-2 text-sm font-black text-[#486b5d]"
              >
                Gerai
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#dbe6e0] bg-[#f8faf8] p-3">
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6a7e75]">{label}</div>
      <div className="mt-1 break-words text-base font-black text-[#10251f]">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#dbe6e0] bg-[#f8faf8] p-3">
      <div className="text-[11px] font-black uppercase text-[#6a7e75]">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function RequirementBlock({ title, items }: { title: string; items: Requirement[] }) {
  return (
    <div>
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <span key={`${item.title}-${item.hours}`} className="rounded-full border border-[#86efac] bg-[#e9f7ef] px-4 py-2 text-sm font-black text-[#047857]">
              ✓ {item.title} · {item.hours} val.
            </span>
          ))
        ) : (
          <span className="rounded-full border border-[#dbe6e0] bg-white px-4 py-2 text-sm font-black text-[#6a7e75]">
            Papildomų reikalavimų nėra
          </span>
        )}
      </div>
    </div>
  );
}

function FragmentRow({
  row,
  expanded,
  details,
  onToggle,
  onPrefill,
  onApprove,
  approvingId,
  onPreview,
}: {
  row: {
    employee: EmployeeOption;
    requirement: PositionRequirement;
    missing: Requirement[];
    pending: TrainingRecord[];
    expiring: TrainingRecord[];
    expired: TrainingRecord[];
    progress: number;
  };
  expanded: boolean;
  details: Array<{
    id: string;
    kind: "record" | "missing";
    employee_id: string;
    title: string;
    completed_at: string | null;
    expires_at: string | null;
    hours: number | string | null;
    status: ReturnType<typeof statusForTraining>;
    record?: TrainingRecord | null;
  }>;
  onToggle: () => void;
  onPrefill: (employeeId: string, title: string) => void;
  onApprove: (trainingId: string) => void;
  onReject: (trainingId: string) => void;
  approvingId: string | null;
  onPreview: (training: TrainingRecord) => void;
}) {
  const hasProblems = row.missing.length > 0 || row.pending.length > 0 || row.expired.length > 0 || row.expiring.length > 0;

  return (
    <>
      <tr className="hover:bg-[#f8faf8]">
        <td className="px-4 py-3 font-black text-[#10251f]">{row.employee.full_name || row.employee.name || "Darbuotojas"}</td>
        <td className="px-4 py-3 font-semibold text-[#40594f]">{row.employee.position || row.requirement.title}</td>
        <td className="px-4 py-3">
          {hasProblems ? (
            <div className="flex flex-wrap gap-1">
              {row.pending.length ? <span className="rounded-full bg-[#fff6df] px-3 py-1 text-xs font-black text-[#8a5a13]">{row.pending.length} laukia</span> : null}
              {row.missing.length ? <span className="rounded-full bg-[#fff6df] px-3 py-1 text-xs font-black text-[#8a5a13]">{row.missing.length} trūksta</span> : null}
              {row.expiring.length ? <span className="rounded-full bg-[#fff6df] px-3 py-1 text-xs font-black text-[#8a5a13]">{row.expiring.length} baigiasi</span> : null}
              {row.expired.length ? <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-800">{row.expired.length} pasibaigė</span> : null}
            </div>
          ) : (
            <span className="rounded-full bg-[#e9f7ef] px-3 py-1 text-xs font-black text-[#047857]">Tvarkinga</span>
          )}
        </td>
        <td className="px-4 py-3 font-black text-[#8a5a13]">{row.missing.length}</td>
        <td className="px-4 py-3">
          <div className="h-2 rounded-full bg-[#eef4f1]">
            <div className="h-2 rounded-full bg-[#047857]" style={{ width: `${row.progress}%` }} />
          </div>
          <div className="mt-1 text-xs font-bold text-[#6a7e75]">{row.progress}%</div>
        </td>
        <td className="px-4 py-3">
          <button type="button" onClick={onToggle} className="inline-flex items-center gap-2 rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d] hover:bg-[#eef4f1]">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? "Slėpti" : "Detalės"}
          </button>
        </td>
      </tr>

      {expanded ? (
        <tr>
          <td colSpan={6} className="bg-[#f8faf8] px-4 py-4">
            <div className="grid gap-2">
              {details.map((detail) => (
                <div key={detail.id} className="grid gap-3 rounded-xl border border-[#dbe6e0] bg-white p-3 md:grid-cols-[1.4fr_0.7fr_0.7fr_0.4fr_0.8fr_auto] md:items-center">
                  <div>
                    <div className="font-black text-[#10251f]">{detail.title}</div>
                    <div className="text-xs font-bold text-[#6a7e75]">{detail.kind === "missing" ? "Privalomas mokymas" : "Įvestas mokymas"}</div>
                  </div>
                  <div className="font-semibold text-[#40594f]">{fmt(detail.completed_at)}</div>
                  <div className="font-semibold text-[#40594f]">{fmt(detail.expires_at)}</div>
                  <div className="font-semibold text-[#40594f]">{detail.hours || "—"}</div>
                  <div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${detail.status.cls}`}>{detail.status.label}</span>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {detail.status.key === "pending" && detail.record ? (
                      <>
                        <button type="button" onClick={() => onApprove(detail.record!.id)} disabled={approvingId === detail.record.id} className="rounded-lg bg-[#047857] px-3 py-2 text-xs font-black text-white disabled:opacity-60">
                          {approvingId === detail.record.id ? "Tvirtinama..." : "Patvirtinti"}
                        </button>
                        <button type="button" onClick={() => onReject(detail.record!.id)} disabled={approvingId === detail.record.id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-800 disabled:opacity-60">
                          Nepatvirtinti
                        </button>
                      </>
                    ) : null}
                    {detail.kind === "record" && detail.record ? (
                      <button type="button" onClick={() => onPreview(detail.record!)} className="rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d] hover:bg-[#eef4f1]">
                        Peržiūrėti
                      </button>
                    ) : (
                      <button type="button" onClick={() => onPrefill(detail.employee_id, detail.title)} className="rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d] hover:bg-[#eef4f1]">
                        Pridėti
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
