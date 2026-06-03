"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Save,
  Search,
  ToggleLeft,
  ToggleRight,
  UserRound,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { getCurrentOrganizationId } from "@/lib/current-organization";
import { getReadableError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import type { Permission } from "@/lib/app-access";

type Employee = {
  user_id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  role?: string | null;
  position?: string | null;
  department?: string | null;
  extra_permissions?: Permission[] | string | null;
  is_active?: boolean | null;
  employment_start_date?: string | null;
  employment_rate?: number | null;
  weekly_hours?: number | null;
};

type PermissionOption = {
  value: Permission;
  label: string;
  description: string;
};

type RoleTemplate = {
  value: string;
  label: string;
  shortLabel: string;
  keywords: string[];
  description: string;
  permissions: Permission[];
};

type EmployeeFilter =
  | "all"
  | "active"
  | "withPosition"
  | "withRights"
  | "withoutRights";

const PAGE_SIZE = 10;
const ACCESS_MANAGER_ROLES = new Set(["owner", "admin", "director", "hr"]);

type AccessGroupValue =
  | "administration"
  | "social"
  | "medical"
  | "maintenance"
  | "care_worker";

const ACCESS_GROUP_OPTIONS: Array<{
  value: AccessGroupValue;
  label: string;
  department: string;
}> = [
  {
    value: "administration",
    label: "Administracija",
    department: "Administracija",
  },
  {
    value: "social",
    label: "Socialinė sritis",
    department: "Socialinė sritis",
  },
  {
    value: "medical",
    label: "Medicina / slauga",
    department: "Sveikatos priežiūra",
  },
  { value: "maintenance", label: "Ūkis", department: "Ūkis" },
  { value: "care_worker", label: "Priežiūra", department: "Priežiūra" },
];

const PERMISSION_OPTIONS: PermissionOption[] = [
  {
    value: "dashboard.view",
    label: "Darbalaukis",
    description: "Pagrindinis sistemos ekranas.",
  },
  {
    value: "tasks.view",
    label: "Užduotys",
    description: "Matyti priskirtas užduotis.",
  },
  {
    value: "tasks.create",
    label: "Kurti užduotis",
    description: "Kurti naujas užduotis.",
  },
  {
    value: "tasks.manage",
    label: "Valdyti visas užduotis",
    description: "Matyti ir valdyti visas įstaigos užduotis.",
  },
  {
    value: "residents.view_basic",
    label: "Gyventojai",
    description: "Matyti bazinę gyventojų informaciją.",
  },
  {
    value: "medicine.view",
    label: "Medicina",
    description: "Matyti medicinos modulį.",
  },
  {
    value: "handover.view",
    label: "Perdavimo žurnalai",
    description: "Matyti perdavimo žurnalus.",
  },
  {
    value: "handover.create",
    label: "Kurti perdavimo įrašus",
    description: "Pildyti perdavimo žurnalus.",
  },
  {
    value: "activities.manage",
    label: "Veiklos / užimtumas",
    description: "Matyti ir pildyti užimtumo veiklų matricą.",
  },
  {
    value: "rooms.view",
    label: "Kambariai",
    description: "Matyti kambarių modulį.",
  },
  {
    value: "inventory.view",
    label: "Sandėliai",
    description: "Matyti sandėlių modulį.",
  },
  {
    value: "employees.view",
    label: "Darbuotojai",
    description: "Matyti darbuotojų modulį.",
  },
  {
    value: "reports.view",
    label: "Ataskaitos",
    description: "Matyti ataskaitas.",
  },
];

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    value: "administration",
    label: "Administracijos bazinės teisės",
    shortLabel: "Administracija",
    keywords: ["direktor", "admin", "administrator", "vadov", "pavaduoto"],
    description: "Darbuotojų, užduočių, dokumentų ir ataskaitų peržiūra.",
    permissions: [
      "dashboard.view",
      "tasks.view",
      "tasks.create",
      "tasks.manage",
      "employees.view",
      "reports.view",
    ],
  },
  {
    value: "social",
    label: "Socialinio darbo bazinės teisės",
    shortLabel: "Socialinis darbas",
    keywords: ["soc", "social", "užimt", "uzimt"],
    description:
      "Gyventojų bazinė informacija, užduotys, perdavimo žurnalai ir veiklos.",
    permissions: [
      "dashboard.view",
      "tasks.view",
      "tasks.create",
      "residents.view_basic",
      "handover.view",
      "handover.create",
      "activities.manage",
    ],
  },
  {
    value: "medical",
    label: "Slaugos / medicinos bazinės teisės",
    shortLabel: "Slauga",
    keywords: [
      "slaug",
      "medic",
      "sveik",
      "gyd",
      "padėj",
      "padej",
      "sesel",
      "farmac",
      "kinez",
      "ergoter",
    ],
    description: "Medicina, gyventojai, užduotys ir perdavimo žurnalai.",
    permissions: [
      "dashboard.view",
      "tasks.view",
      "tasks.create",
      "residents.view_basic",
      "medicine.view",
      "handover.view",
      "handover.create",
    ],
  },
  {
    value: "maintenance",
    label: "Ūkio bazinės teisės",
    shortLabel: "Ūkis",
    keywords: ["ūk", "uk", "sandėl", "sandel", "pastat", "techn", "vair"],
    description: "Ūkio užduotys, kambariai ir sandėliai.",
    permissions: [
      "dashboard.view",
      "tasks.view",
      "tasks.create",
      "rooms.view",
      "inventory.view",
    ],
  },
  {
    value: "care_worker",
    label: "Priežiūros bazinės teisės",
    shortLabel: "Priežiūra",
    keywords: [
      "priežiūr",
      "prieziur",
      "individual",
      "darbuotoj",
      "globėj",
      "globej",
    ],
    description: "Bazinė gyventojų informacija ir užduotys.",
    permissions: [
      "dashboard.view",
      "tasks.view",
      "tasks.create",
      "residents.view_basic",
    ],
  },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function uniquePermissions(items: Permission[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalizeExtraPermissions(value: Employee["extra_permissions"]) {
  if (!value) return [] as Permission[];
  if (Array.isArray(value)) return uniquePermissions(value as Permission[]);

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? uniquePermissions(parsed as Permission[])
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

function employeeName(employee: Employee) {
  const full = String(employee.full_name || "").trim();
  if (full) return full;

  const combined = [employee.first_name, employee.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return combined || employee.email || "Darbuotojas";
}

function employeeInitials(employee: Employee) {
  const name = employeeName(employee);
  const parts = name.split(" ").filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`
      : name.slice(0, 2);
  return initials.toUpperCase();
}

function roleLabel(value?: string | null) {
  if (value === "owner") return "Savininkas";
  if (value === "admin") return "Administracija";
  if (value === "employee") return "Darbuotojas";
  return value || "Nepasirinkta";
}

function canManageStaffAccess(role?: string | null) {
  return ACCESS_MANAGER_ROLES.has(String(role || "").trim().toLowerCase());
}

function permissionLabel(permission: Permission) {
  return (
    PERMISSION_OPTIONS.find((item) => item.value === permission)?.label ||
    permission
  );
}
function permissionListLabel(permissions: Permission[]) {
  const labels = uniquePermissions(permissions).map(permissionLabel);
  return labels.length ? labels.join(", ") : "—";
}

function permissionsChanged(previous: Permission[], next: Permission[]) {
  const a = uniquePermissions(previous).sort().join("|");
  const b = uniquePermissions(next).sort().join("|");
  return a !== b;
}

function addAuditChange(
  changes: Record<string, unknown>,
  label: string,
  oldValue: unknown,
  newValue: unknown,
) {
  const oldText =
    oldValue === null || oldValue === undefined || oldValue === ""
      ? "—"
      : String(oldValue);
  const newText =
    newValue === null || newValue === undefined || newValue === ""
      ? "—"
      : String(newValue);

  if (oldText === newText) return;

  changes[label] = { old: oldText, new: newText };
}

async function safeAuditLog(input: {
  organizationId?: string | null;
  tableName: string;
  recordId?: string | null;
  action: string;
  changes: Record<string, unknown>;
}) {
  if (!input.organizationId) return;

  try {
    await logAudit({
      organizationId: input.organizationId,
      tableName: input.tableName,
      recordId: input.recordId || undefined,
      action: input.action,
      changes: input.changes,
    });
  } catch (error) {
    console.warn("[StaffTypesModule] audit log failed", error);
  }
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function templateByValue(value: AccessGroupValue) {
  return (
    ROLE_TEMPLATES.find((template) => template.value === value) ||
    ROLE_TEMPLATES[4]
  );
}

function inferAccessGroupFromText(
  value?: string | null,
): AccessGroupValue | null {
  const text = normalizeText(value);

  if (/(slaug|medic|sveikat|gyd|padej|sesel|farmac|kinez|ergoter)/.test(text))
    return "medical";
  if (/(social|uzimt|soc\.?|atvejo|psicholog)/.test(text)) return "social";
  if (/(direktor|admin|vadov|pavaduot|buhalt|personalo|koordinator)/.test(text))
    return "administration";
  if (
    /(uk|ūk|sandel|sandėl|pastat|techn|vair|valyt|virtu|maist|kuch)/.test(text)
  )
    return "maintenance";
  if (/(prieziur|priežiūr|individual|globej|globėj|care)/.test(text))
    return "care_worker";

  return null;
}

function detectAccessGroup(employee: Employee): AccessGroupValue {
  const byDepartment = inferAccessGroupFromText(employee.department);
  if (byDepartment) return byDepartment;

  const byPosition = inferAccessGroupFromText(employee.position);
  if (byPosition) return byPosition;

  if (employee.role === "admin" || employee.role === "owner")
    return "administration";

  return "care_worker";
}

function detectBaseTemplate(employee: Employee) {
  return templateByValue(detectAccessGroup(employee));
}

function departmentForAccessGroup(value: AccessGroupValue) {
  return (
    ACCESS_GROUP_OPTIONS.find((option) => option.value === value)?.department ||
    "Priežiūra"
  );
}

function getBasePermissions(employee: Employee) {
  return detectBaseTemplate(employee).permissions;
}

function getEffectivePermissions(employee: Employee) {
  if (!hasConfiguredAccess(employee)) return [];
  return uniquePermissions([
    ...getBasePermissions(employee),
    ...normalizeExtraPermissions(employee.extra_permissions),
  ]);
}

function hasConfiguredAccess(employee: Employee) {
  const hasPosition = Boolean(String(employee.position || "").trim());
  const hasDepartment = Boolean(String(employee.department || "").trim());
  const hasExtras =
    normalizeExtraPermissions(employee.extra_permissions).length > 0;
  const isPrivilegedRole =
    employee.role === "owner" || employee.role === "admin";

  return isPrivilegedRole || hasPosition || hasDepartment || hasExtras;
}

function toEmployee(member: any, profile?: any): Employee {
  return {
    user_id: member.user_id,
    email: profile?.email ?? null,
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
    full_name: profile?.full_name ?? null,
    role: member.role ?? null,
    position: member.position ?? null,
    department: member.department ?? null,
    extra_permissions: member.extra_permissions ?? [],
    is_active: member.is_active ?? true,
    employment_start_date: member.employment_start_date ?? null,
    employment_rate: Number(member.employment_rate ?? 1),
    weekly_hours: Number(member.weekly_hours ?? 40),
  };
}

export default function StaffTypesModulePage() {
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<EmployeeFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [canManageAccess, setCanManageAccess] = useState(false);

  async function loadEmployees() {
    setLoading(true);
    setMessage("");

    try {
      const organizationId = await getCurrentOrganizationId();

      if (!organizationId) {
        setEmployees([]);
        setCanManageAccess(false);
        setMessageType("error");
        setMessage("Nepavyko nustatyti įstaigos.");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setEmployees([]);
        setCanManageAccess(false);
        setMessageType("error");
        setMessage("Prisijunkite, kad galėtumėte valdyti darbuotojų teises.");
        return;
      }

      const { data: currentMember, error: currentMemberError } = await supabase
        .from("organization_members")
        .select("role, is_active")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (currentMemberError) throw currentMemberError;

      const hasAccess =
        Boolean(currentMember?.is_active) &&
        canManageStaffAccess(currentMember?.role);

      setCanManageAccess(hasAccess);

      if (!hasAccess) {
        setEmployees([]);
        setMessageType("error");
        setMessage("Šį modulį gali valdyti tik savininkas, administratorius, direktorius arba HR.");
        return;
      }

      const { data: members, error: membersError } = await supabase
        .from("organization_members")
        .select(
          "user_id, role, position, department, extra_permissions, is_active, employment_start_date, employment_rate, weekly_hours, is_archived",
        )
        .eq("organization_id", organizationId)
        .neq("is_archived", true)
        .order("position", { ascending: true });

      if (membersError) throw membersError;

      const userIds = (members || [])
        .map((member: any) => member.user_id)
        .filter(Boolean);
      let profilesById = new Map<string, any>();

      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name, full_name")
          .in("id", userIds);

        if (profilesError) {
          console.warn(
            "[StaffTypesModule] profiles load failed",
            profilesError,
          );
        } else {
          profilesById = new Map(
            (profiles || []).map((profile: any) => [profile.id, profile]),
          );
        }
      }

      const nextEmployees = ((members || []) as any[])
        .map((member) => toEmployee(member, profilesById.get(member.user_id)))
        .sort((a, b) => employeeName(a).localeCompare(employeeName(b), "lt"));

      setEmployees(nextEmployees);
      setSelectedUserId(
        (previous) => previous || nextEmployees[0]?.user_id || null,
      );
    } catch (error) {
      setCanManageAccess(false);
      setMessageType("error");
      setMessage(getReadableError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEmployees();
  }, []);

  function latestEmployee(employee: Employee) {
    return (
      employees.find((item) => item.user_id === employee.user_id) || employee
    );
  }

  async function updateEmployeeAccess(
    employee: Employee,
    patch: Partial<
      Pick<
        Employee,
        | "position"
        | "department"
        | "extra_permissions"
        | "employment_rate"
        | "weekly_hours"
      >
    >,
  ) {
    if (!canManageAccess) {
      setMessageType("error");
      setMessage("Neturite teisės keisti darbuotojų prieigų.");
      return;
    }

    const currentEmployee = latestEmployee(employee);

    if (currentEmployee.role === "owner") {
      setMessageType("error");
      setMessage("Savininko teisių šiame lange keisti negalima.");
      return;
    }

    const previousEmployee = { ...currentEmployee };
    const nextEmployee: Employee = { ...currentEmployee, ...patch };
    const nextPosition = String(nextEmployee.position || "").trim() || null;
    const inferredDepartment = inferAccessGroupFromText(nextPosition);
    const nextDepartment =
      patch.department !== undefined
        ? String(patch.department || "").trim() || null
        : String(currentEmployee.department || "").trim()
          ? String(currentEmployee.department || "").trim()
          : inferredDepartment
            ? departmentForAccessGroup(inferredDepartment)
            : null;
    const nextPermissions = normalizeExtraPermissions(
      nextEmployee.extra_permissions,
    );
    const nextEmploymentRate = Math.max(
      0,
      Math.min(2, Number(nextEmployee.employment_rate ?? 1)),
    );
    const nextWeeklyHours = Math.max(
      0,
      Math.min(
        80,
        Number(
          nextEmployee.weekly_hours ?? Math.round(nextEmploymentRate * 40),
        ),
      ),
    );

    setSavingUserId(currentEmployee.user_id);
    setMessage("");

    setEmployees((previous) =>
      previous.map((item) =>
        item.user_id === currentEmployee.user_id
          ? {
              ...item,
              position: nextPosition,
              department: nextDepartment,
              extra_permissions: nextPermissions,
              employment_rate: nextEmploymentRate,
              weekly_hours: nextWeeklyHours,
            }
          : item,
      ),
    );

    try {
      const organizationId = await getCurrentOrganizationId();
      if (!organizationId) throw new Error("Nepavyko nustatyti įstaigos.");

      const { data, error } = await supabase
        .from("organization_members")
        .update({
          position: nextPosition,
          department: nextDepartment,
          extra_permissions: nextPermissions,
          employment_rate: nextEmploymentRate,
          weekly_hours: nextWeeklyHours,
        })
        .eq("organization_id", organizationId)
        .eq("user_id", currentEmployee.user_id)
        .select(
          "user_id, position, department, extra_permissions, employment_rate, weekly_hours",
        )
        .maybeSingle();

      if (error) throw error;
      if (!data?.user_id) {
        throw new Error(
          "Pakeitimai neįrašyti. Patikrink RLS teises organization_members lentelei.",
        );
      }

      const savedPermissions = normalizeExtraPermissions(
        data.extra_permissions,
      );
      const previousBasePermissions = getBasePermissions(previousEmployee);
      const nextBasePermissions = getBasePermissions({
        ...previousEmployee,
        position: data.position ?? nextPosition,
        department: data.department ?? nextDepartment,
        extra_permissions: savedPermissions,
        employment_rate: Number(data.employment_rate ?? nextEmploymentRate),
        weekly_hours: Number(data.weekly_hours ?? nextWeeklyHours),
      });
      const previousExtraPermissions = normalizeExtraPermissions(
        previousEmployee.extra_permissions,
      );
      const auditChanges: Record<string, unknown> = {
        Darbuotojas: employeeName(previousEmployee),
        Veiksmas: "Atnaujintos pareigos ir prieigos",
      };

      addAuditChange(
        auditChanges,
        "Konkrečios pareigos",
        previousEmployee.position,
        data.position ?? nextPosition,
      );
      addAuditChange(
        auditChanges,
        "Pareigų grupė",
        previousEmployee.department,
        data.department ?? nextDepartment,
      );
      addAuditChange(
        auditChanges,
        "Etato dydis",
        Number(previousEmployee.employment_rate ?? 1).toFixed(2),
        Number(data.employment_rate ?? nextEmploymentRate).toFixed(2),
      );
      addAuditChange(
        auditChanges,
        "Savaitės valandos",
        Number(previousEmployee.weekly_hours ?? 40),
        Number(data.weekly_hours ?? nextWeeklyHours),
      );

      if (permissionsChanged(previousExtraPermissions, savedPermissions)) {
        auditChanges["Papildomos teisės"] = {
          old: permissionListLabel(previousExtraPermissions),
          new: permissionListLabel(savedPermissions),
        };
      }

      if (permissionsChanged(previousBasePermissions, nextBasePermissions)) {
        auditChanges["Bazinės teisės pagal pareigybę"] = {
          old: permissionListLabel(previousBasePermissions),
          new: permissionListLabel(nextBasePermissions),
        };
      }

      if (Object.keys(auditChanges).length > 2) {
        await safeAuditLog({
          organizationId,
          tableName: "organization_members",
          recordId: currentEmployee.user_id,
          action: "Atnaujintos darbuotojo teisės",
          changes: auditChanges,
        });
      }

      setEmployees((previous) =>
        previous.map((item) =>
          item.user_id === currentEmployee.user_id
            ? {
                ...item,
                position: data.position ?? nextPosition,
                department: data.department ?? nextDepartment,
                extra_permissions: savedPermissions,
                employment_rate: Number(
                  data.employment_rate ?? nextEmploymentRate,
                ),
                weekly_hours: Number(data.weekly_hours ?? nextWeeklyHours),
              }
            : item,
        ),
      );

      setMessageType("success");
      setMessage("Pakeitimai išsaugoti.");
    } catch (error) {
      setEmployees((previous) =>
        previous.map((item) =>
          item.user_id === previousEmployee.user_id ? previousEmployee : item,
        ),
      );
      setMessageType("error");
      setMessage(getReadableError(error));
    } finally {
      setSavingUserId(null);
    }
  }

  function toggleExtraPermission(employee: Employee, permission: Permission) {
    const currentEmployee = latestEmployee(employee);
    const current = normalizeExtraPermissions(
      currentEmployee.extra_permissions,
    );
    const base = getBasePermissions(currentEmployee);

    if (base.includes(permission)) {
      setMessageType("success");
      setMessage("Ši teisė yra bazinė pagal pareigybę, todėl ji jau aktyvi.");
      return;
    }

    const next = current.includes(permission)
      ? current.filter((item) => item !== permission)
      : uniquePermissions([...current, permission]);

    void updateEmployeeAccess(currentEmployee, { extra_permissions: next });
  }

  function addTemplateExtras(employee: Employee, template: RoleTemplate) {
    const currentEmployee = latestEmployee(employee);
    const base = getBasePermissions(currentEmployee);
    const current = normalizeExtraPermissions(
      currentEmployee.extra_permissions,
    );
    const onlyExtras = template.permissions.filter(
      (permission) => !base.includes(permission),
    );

    void updateEmployeeAccess(currentEmployee, {
      extra_permissions: uniquePermissions([...current, ...onlyExtras]),
    });
  }

  function clearExtraPermissions(employee: Employee) {
    const confirmed = window.confirm(
      "Ar tikrai nuimti visas papildomas teises? Bazinės teisės liks aktyvios.",
    );
    if (!confirmed) return;
    void updateEmployeeAccess(latestEmployee(employee), {
      extra_permissions: [],
    });
  }

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const effectiveCount = getEffectivePermissions(employee).length;
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "active" && employee.is_active !== false) ||
        (activeFilter === "withPosition" &&
          Boolean(String(employee.position || "").trim())) ||
        (activeFilter === "withRights" && effectiveCount > 0) ||
        (activeFilter === "withoutRights" && effectiveCount === 0);

      if (!matchesFilter) return false;
      if (!query) return true;

      return [
        employeeName(employee),
        employee.email,
        employee.position,
        employee.department,
        roleLabel(employee.role),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [employees, search, activeFilter]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredEmployees.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, pageCount);
  const paginatedEmployees = filteredEmployees.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const selectedEmployee =
    filteredEmployees.find((employee) => employee.user_id === selectedUserId) ||
    paginatedEmployees[0] ||
    null;

  useEffect(() => {
    setPage(1);
  }, [search, activeFilter]);

  useEffect(() => {
    if (!selectedEmployee && filteredEmployees.length > 0) {
      setSelectedUserId(filteredEmployees[0].user_id);
    }
  }, [filteredEmployees, selectedEmployee]);

  const stats = useMemo(() => {
    const activeCount = employees.filter(
      (employee) => employee.is_active !== false,
    ).length;
    const withPosition = employees.filter((employee) =>
      String(employee.position || "").trim(),
    ).length;
    const withRights = employees.filter(
      (employee) => getEffectivePermissions(employee).length > 0,
    ).length;
    const withoutRights = employees.filter(
      (employee) => getEffectivePermissions(employee).length === 0,
    ).length;

    return [
      { key: "all" as EmployeeFilter, label: "Visi", value: employees.length },
      { key: "active" as EmployeeFilter, label: "Aktyvūs", value: activeCount },
      {
        key: "withPosition" as EmployeeFilter,
        label: "Su pareigomis",
        value: withPosition,
      },
      {
        key: "withRights" as EmployeeFilter,
        label: "Su teisėmis",
        value: withRights,
      },
      {
        key: "withoutRights" as EmployeeFilter,
        label: "Be teisių",
        value: withoutRights,
      },
    ];
  }, [employees]);

  if (loading) {
    return (
      <section className="mx-auto max-w-[1500px] px-5 py-5">
        <div className="flex items-center gap-4 rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm">
          <RefreshCw className="h-5 w-5 animate-spin text-[#486b5d]" />
          <div>
            <p className="font-black text-[#10251f]">
              Kraunamos pareigos ir teisės
            </p>
            <p className="text-sm font-semibold text-[#6a7e75]">
              Tikrinami darbuotojai ir jų prieigos.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1500px] px-5 py-5">
      <section className="overflow-hidden rounded-2xl border border-[#c9d8d0] bg-white shadow-sm">
        <header className="border-b border-[#dbe6e0] bg-[#486b5d] px-5 py-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
                Pareigos ir teisės
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight">
                Pareigos, šablonai ir individualios teisės
              </h1>
              <p className="mt-1 text-sm font-semibold text-white/80">
                Pasirinkite darbuotoją, valdykite pareigas, etatą ir
                individualias prieigas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/team?module=employees";
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-black text-[#486b5d] shadow-sm"
              >
                <ArrowLeft className="h-4 w-4" /> Grįžti
              </button>
              <button
                type="button"
                onClick={loadEmployees}
                className="inline-flex items-center gap-2 rounded-lg bg-white/12 px-3 py-2 text-sm font-black text-white/90 ring-1 ring-white/15"
              >
                <RefreshCw className="h-4 w-4" /> Atnaujinti
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 border-b border-[#dbe6e0] bg-white p-4 lg:grid-cols-5">
          {stats.map((stat) => (
            <button
              key={stat.key}
              type="button"
              onClick={() => setActiveFilter(stat.key)}
              className={cn(
                "rounded-xl border p-4 text-left shadow-sm transition hover:bg-[#f8faf8]",
                activeFilter === stat.key
                  ? "border-[#a8d8bd] bg-[#e9f7ef] text-[#047857]"
                  : "border-[#dbe6e0] bg-white text-[#10251f]",
              )}
            >
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">
                {stat.label}
              </div>
              <div className="mt-2 text-2xl font-black">{stat.value}</div>
            </button>
          ))}
        </section>

        <section className="border-b border-[#dbe6e0] bg-[#f8faf8] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">
              Veiksmai
            </span>
            <button
              type="button"
              onClick={loadEmployees}
              className="inline-flex items-center gap-2 rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d] hover:bg-[#eef4f1]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Atnaujinti
            </button>

            <div className="mx-2 hidden h-7 w-px bg-[#dbe6e0] md:block" />

            <span className="mr-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">
              Filtrai
            </span>
            <select
              value={activeFilter}
              onChange={(event) =>
                setActiveFilter(event.target.value as EmployeeFilter)
              }
              className="h-9 rounded-lg border border-[#c2d3ca] bg-white px-3 text-xs font-bold text-[#10251f]"
            >
              <option value="all">Visi darbuotojai</option>
              <option value="active">Aktyvūs</option>
              <option value="withPosition">Su pareigomis</option>
              <option value="withRights">Su teisėmis</option>
              <option value="withoutRights">Be teisių</option>
            </select>
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8aa096]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 min-w-[250px] rounded-lg border border-[#c2d3ca] bg-white px-3 pl-9 text-xs font-semibold text-[#10251f] outline-none focus:border-[#486b5d]"
                placeholder="Ieškoti darbuotojo, pareigų..."
              />
            </label>

            <span className="ml-auto rounded-lg bg-[#eef4f1] px-3 py-2 text-xs font-black text-[#486b5d] ring-1 ring-[#c2d3ca]">
              Pakeitimai saugomi automatiškai
            </span>
          </div>
        </section>

        {message ? (
          <div
            className={cn(
              "mx-4 mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-black",
              messageType === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800",
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            {message}
          </div>
        ) : null}

        <section className="grid gap-0 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="border-b border-[#dbe6e0] bg-[#f8faf8] p-4 xl:border-b-0 xl:border-r">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">
                  Darbuotojai
                </div>
                <div className="mt-1 text-sm font-black text-[#10251f]">
                  {filteredEmployees.length} darbuotojai
                </div>
              </div>
              <div className="rounded-lg bg-white px-2 py-1 text-xs font-black text-[#486b5d] ring-1 ring-[#dbe6e0]">
                {filteredEmployees.length === 0
                  ? 0
                  : (safePage - 1) * PAGE_SIZE + 1}
                –{Math.min(safePage * PAGE_SIZE, filteredEmployees.length)}
              </div>
            </div>

            {paginatedEmployees.length === 0 ? (
              <div className="grid min-h-[180px] place-items-center rounded-xl border border-dashed border-[#c2d3ca] bg-white p-6 text-center">
                <div>
                  <UserRound className="mx-auto h-8 w-8 text-[#8aa096]" />
                  <p className="mt-3 font-black text-[#10251f]">
                    Darbuotojų nerasta
                  </p>
                  <p className="text-sm font-semibold text-[#6a7e75]">
                    Pakeiskite filtrą arba paiešką.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                {paginatedEmployees.map((employee) => {
                  const active = selectedEmployee?.user_id === employee.user_id;
                  return (
                    <button
                      key={employee.user_id}
                      type="button"
                      onClick={() => setSelectedUserId(employee.user_id)}
                      className={cn(
                        "grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-xl border p-3 text-left transition",
                        active
                          ? "border-[#a8d8bd] bg-[#e9f7ef] shadow-sm"
                          : "border-[#dbe6e0] bg-white hover:bg-[#eef4f1]",
                      )}
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-white text-sm font-black text-[#007a5a] shadow-sm">
                        {employeeInitials(employee)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-[#10251f]">
                          {employeeName(employee)}
                        </div>
                        <div className="truncate text-xs font-semibold text-[#6a7e75]">
                          {employee.position || "Pareigos nenurodytos"}
                        </div>
                        <div className="mt-1 text-[11px] font-bold text-[#6a7e75]">
                          {getEffectivePermissions(employee).length} teisės ·{" "}
                          {roleLabel(employee.role)}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-[11px] font-black",
                          employee.is_active === false
                            ? "bg-slate-100 text-slate-500"
                            : "bg-[#d9f8e7] text-[#047857]",
                        )}
                      >
                        {employee.is_active === false ? "Neaktyvus" : "Aktyvus"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex items-center justify-center gap-2 text-sm font-black text-[#486b5d]">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#dbe6e0] bg-white disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>
                {safePage} / {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount}
                onClick={() =>
                  setPage((previous) => Math.min(pageCount, previous + 1))
                }
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#dbe6e0] bg-white disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </aside>

          <section className="min-w-0 p-4">
            {selectedEmployee ? (
              <EmployeeAccessEditor
                employee={selectedEmployee}
                saving={savingUserId === selectedEmployee.user_id}
                setEmployees={setEmployees}
                toggleExtraPermission={toggleExtraPermission}
                addTemplateExtras={addTemplateExtras}
                clearExtraPermissions={clearExtraPermissions}
                updateEmployeeAccess={updateEmployeeAccess}
              />
            ) : (
              <div className="grid min-h-[260px] place-items-center rounded-xl border border-dashed border-[#c2d3ca] bg-[#f8faf8] p-6 text-center">
                <div>
                  <UserRound className="mx-auto h-9 w-9 text-[#8aa096]" />
                  <p className="mt-3 font-black text-[#10251f]">
                    Pasirinkite darbuotoją
                  </p>
                  <p className="text-sm font-semibold text-[#6a7e75]">
                    Dešinėje bus rodomos pareigos ir teisės.
                  </p>
                </div>
              </div>
            )}
          </section>
        </section>
      </section>
    </section>
  );
}

function EmployeeAccessEditor({
  employee,
  saving,
  setEmployees,
  toggleExtraPermission,
  addTemplateExtras,
  clearExtraPermissions,
  updateEmployeeAccess,
}: {
  employee: Employee;
  saving: boolean;
  setEmployees: Dispatch<SetStateAction<Employee[]>>;
  toggleExtraPermission: (employee: Employee, permission: Permission) => void;
  addTemplateExtras: (employee: Employee, template: RoleTemplate) => void;
  clearExtraPermissions: (employee: Employee) => void;
  updateEmployeeAccess: (
    employee: Employee,
    patch: Partial<
      Pick<
        Employee,
        | "position"
        | "department"
        | "extra_permissions"
        | "employment_rate"
        | "weekly_hours"
      >
    >,
  ) => void;
}) {
  const baseTemplate = detectBaseTemplate(employee);
  const basePermissions = getBasePermissions(employee);
  const extraPermissions = normalizeExtraPermissions(
    employee.extra_permissions,
  ).filter((permission) => !basePermissions.includes(permission));
  const effectivePermissions = getEffectivePermissions(employee);

  function updateLocal<K extends keyof Employee>(key: K, value: Employee[K]) {
    setEmployees((previous) =>
      previous.map((item) =>
        item.user_id === employee.user_id ? { ...item, [key]: value } : item,
      ),
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#dbe6e0] bg-[#f8faf8] p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-[#e9f7ef] text-xl font-black text-[#007a5a]">
            {employeeInitials(employee)}
          </div>
          <div>
            <h2 className="text-xl font-black text-[#10251f]">
              {employeeName(employee)}
            </h2>
            <div className="mt-1 text-sm font-bold text-[#6a7e75]">
              {employee.position || "Pareigos nenurodytos"} ·{" "}
              {employee.department || "Skyrius nenurodytas"}
            </div>
            <div className="mt-1 text-xs font-bold text-[#6a7e75]">
              Etatas: {Number(employee.employment_rate ?? 1).toFixed(2)} ·{" "}
              {Number(employee.weekly_hours ?? 40)} val./sav.
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#d9f8e7] px-3 py-1 text-xs font-black text-[#047857]">
            {employee.is_active === false ? "Neaktyvus" : "Aktyvus"}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#486b5d] ring-1 ring-[#dbe6e0]">
            {roleLabel(employee.role)}
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.35fr]">
        <section className="rounded-xl border border-[#dbe6e0] bg-white p-4">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">
            Darbo duomenys
          </div>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-xs font-black text-[#40594f]">
              Konkrečios pareigos
              <input
                value={employee.position || ""}
                onChange={(event) =>
                  updateLocal("position", event.target.value)
                }
                onBlur={(event) => {
                  const position = event.target.value;
                  const inferred = inferAccessGroupFromText(position);
                  updateEmployeeAccess(employee, {
                    position,
                    department:
                      employee.department ||
                      (inferred
                        ? departmentForAccessGroup(inferred)
                        : undefined),
                  });
                }}
                disabled={saving}
                className="h-10 rounded-lg border border-[#c2d3ca] bg-white px-3 text-sm font-bold text-[#10251f] outline-none focus:border-[#486b5d]"
                placeholder="Pvz., vyr. slaugytoja"
              />
            </label>

            <label className="grid gap-1 text-xs font-black text-[#40594f]">
              Pareigų grupė / automatinės teisės
              <select
                value={detectAccessGroup(employee)}
                onChange={(event) => {
                  const group = event.target.value as AccessGroupValue;
                  const department = departmentForAccessGroup(group);
                  updateLocal("department", department);
                  updateEmployeeAccess(employee, { department });
                }}
                disabled={saving}
                className="h-10 rounded-lg border border-[#c2d3ca] bg-white px-3 text-sm font-bold text-[#10251f] outline-none focus:border-[#486b5d]"
              >
                {ACCESS_GROUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs font-black text-[#40594f]">
                Etato dydis
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.01}
                  value={employee.employment_rate ?? 1}
                  onChange={(event) =>
                    updateLocal("employment_rate", Number(event.target.value))
                  }
                  onBlur={(event) => {
                    const nextRate = Math.max(
                      0,
                      Math.min(2, Number(event.target.value || 1)),
                    );
                    updateEmployeeAccess(employee, {
                      employment_rate: nextRate,
                      weekly_hours:
                        employee.weekly_hours ?? Math.round(nextRate * 40),
                    });
                  }}
                  disabled={saving}
                  className="h-10 rounded-lg border border-[#c2d3ca] bg-white px-3 text-sm font-bold text-[#10251f] outline-none focus:border-[#486b5d]"
                />
              </label>
              <label className="grid gap-1 text-xs font-black text-[#40594f]">
                Savaitės valandos
                <input
                  type="number"
                  min={0}
                  max={80}
                  step={1}
                  value={employee.weekly_hours ?? 40}
                  onChange={(event) =>
                    updateLocal("weekly_hours", Number(event.target.value))
                  }
                  onBlur={(event) =>
                    updateEmployeeAccess(employee, {
                      employment_rate: employee.employment_rate ?? 1,
                      weekly_hours: Math.max(
                        0,
                        Math.min(80, Number(event.target.value || 40)),
                      ),
                    })
                  }
                  disabled={saving}
                  className="h-10 rounded-lg border border-[#c2d3ca] bg-white px-3 text-sm font-bold text-[#10251f] outline-none focus:border-[#486b5d]"
                />
              </label>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-[#dbe6e0]">
            <div className="grid grid-cols-2 border-b border-[#dbe6e0] bg-[#eef4f1]">
              <SummaryItem label="Šablonas" value={baseTemplate.shortLabel} />
              <SummaryItem
                label="Etatas"
                value={`${Number(employee.employment_rate ?? 1).toFixed(2)} et.`}
                border
              />
            </div>
            <div className="grid grid-cols-3">
              <SummaryItem
                label="Bazinės"
                value={`${basePermissions.length}`}
              />
              <SummaryItem
                label="Papildomos"
                value={`${extraPermissions.length}`}
                border
              />
              <div className="border-l border-[#dbe6e0] bg-[#e9f7ef] p-3 text-[#047857]">
                <div className="text-[11px] font-black uppercase">Iš viso</div>
                <div className="mt-1 font-black">
                  {effectivePermissions.length}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[#dbe6e0] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">
                Bazinės teisės
              </div>
              <h3 className="mt-1 text-lg font-black text-[#10251f]">
                Aktyvios pagal pareigybę
              </h3>
              <p className="mt-1 text-xs font-semibold text-[#6a7e75]">
                {baseTemplate.description}
              </p>
            </div>
            <span className="rounded-full bg-[#d9f8e7] px-3 py-1 text-xs font-black text-[#047857]">
              {basePermissions.length} aktyvios
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {basePermissions.map((permission) => (
              <div
                key={permission}
                className="rounded-lg border border-[#b7e7c8] bg-[#e9f7ef] px-3 py-2 text-sm font-black text-[#064e3b]"
              >
                ✓ {permissionLabel(permission)}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-[#dbe6e0] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">
              Papildomos teisės
            </div>
            <h3 className="mt-1 text-lg font-black text-[#10251f]">
              Individualūs leidimai
            </h3>
            <p className="mt-1 text-xs font-semibold text-[#6a7e75]">
              Aktyvios teisės pažymėtos mėlynai ir išsaugomos iškart.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ROLE_TEMPLATES.map((template) => (
              <button
                key={template.value}
                type="button"
                disabled={saving}
                onClick={() => addTemplateExtras(employee, template)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#486b5d] hover:bg-[#eef4f1] disabled:opacity-50"
                title={template.description}
              >
                <Plus className="h-3.5 w-3.5" /> {template.shortLabel}
              </button>
            ))}
            <button
              type="button"
              disabled={saving || extraPermissions.length === 0}
              onClick={() => clearExtraPermissions(employee)}
              className="rounded-lg border border-[#f1caca] bg-[#fff7f7] px-3 py-2 text-xs font-black text-[#8a3a2f] disabled:opacity-50"
            >
              Nuimti papildomas
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {PERMISSION_OPTIONS.filter(
            (permission) => !basePermissions.includes(permission.value),
          ).map((permission) => {
            const checked = extraPermissions.includes(permission.value);
            return (
              <button
                key={permission.value}
                type="button"
                disabled={saving}
                onClick={() =>
                  toggleExtraPermission(employee, permission.value)
                }
                className={cn(
                  "rounded-lg border p-3 text-left text-xs font-bold transition disabled:opacity-60",
                  checked
                    ? "border-blue-200 bg-blue-50 text-blue-900"
                    : "border-[#dbe6e0] bg-[#f8faf8] text-[#40594f] hover:bg-[#eef4f1]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span>{permission.label}</span>
                  {checked ? (
                    <ToggleRight className="h-5 w-5 text-blue-700" />
                  ) : (
                    <ToggleLeft className="h-5 w-5 text-[#8aa096]" />
                  )}
                </div>
                <span className="mt-1 block font-semibold text-[#6a7e75]">
                  {permission.description}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-[#dbe6e0] pt-3 text-xs font-black text-[#6a7e75]">
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saugoma..." : "Pakeitimai saugomi automatiškai"}
        </div>
      </section>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  border = false,
}: {
  label: string;
  value: string;
  border?: boolean;
}) {
  return (
    <div className={cn("p-3", border && "border-l border-[#dbe6e0]")}>
      <div className="text-[11px] font-black uppercase text-[#6a7e75]">
        {label}
      </div>
      <div className="mt-1 font-black text-[#10251f]">{value}</div>
    </div>
  );
}
