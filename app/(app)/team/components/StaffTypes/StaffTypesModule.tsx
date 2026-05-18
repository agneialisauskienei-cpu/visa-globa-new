"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  UserRound,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { getCurrentOrganizationId } from "@/lib/current-organization";
import { getReadableError } from "@/lib/errors";
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

type EmployeeFilter = "all" | "active" | "withPosition" | "withRights" | "withoutRights";

const PAGE_SIZE = 10;

const PERMISSION_OPTIONS: PermissionOption[] = [
  { value: "dashboard.view", label: "Darbalaukis", description: "Pagrindinis sistemos ekranas." },
  { value: "tasks.view", label: "Užduotys", description: "Matyti priskirtas užduotis." },
  { value: "tasks.create", label: "Kurti užduotis", description: "Kurti naujas užduotis." },
  { value: "tasks.manage", label: "Valdyti visas užduotis", description: "Matyti ir valdyti visas įstaigos užduotis." },
  { value: "residents.view_basic", label: "Gyventojai", description: "Matyti bazinę gyventojų informaciją." },
  { value: "medicine.view", label: "Medicina", description: "Matyti medicinos modulį." },
  { value: "handover.view", label: "Perdavimo žurnalai", description: "Matyti perdavimo žurnalus." },
  { value: "handover.create", label: "Kurti perdavimo įrašus", description: "Pildyti perdavimo žurnalus." },
  { value: "activities.manage", label: "Veiklos / užimtumas", description: "Matyti ir pildyti užimtumo veiklų matricą." },
  { value: "rooms.view", label: "Kambariai", description: "Matyti kambarių modulį." },
  { value: "inventory.view", label: "Sandėliai", description: "Matyti sandėlių modulį." },
  { value: "employees.view", label: "Darbuotojai", description: "Matyti darbuotojų modulį." },
  { value: "reports.view", label: "Ataskaitos", description: "Matyti ataskaitas." },
];

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    value: "administration",
    label: "Administracijos bazinės teisės",
    shortLabel: "Administracija",
    keywords: ["direktor", "admin", "administrator", "vadov", "pavaduoto"],
    description: "Darbuotojų, užduočių, dokumentų ir ataskaitų peržiūra.",
    permissions: ["dashboard.view", "tasks.view", "tasks.create", "tasks.manage", "employees.view", "reports.view"],
  },
  {
    value: "social",
    label: "Socialinio darbo bazinės teisės",
    shortLabel: "Socialinis darbas",
    keywords: ["soc", "social", "užimt", "uzimt"],
    description: "Gyventojų bazinė informacija, užduotys, perdavimo žurnalai ir veiklos.",
    permissions: ["dashboard.view", "tasks.view", "tasks.create", "residents.view_basic", "handover.view", "handover.create", "activities.manage"],
  },
  {
    value: "medical",
    label: "Slaugos / medicinos bazinės teisės",
    shortLabel: "Slauga",
    keywords: ["slaug", "medic", "sveik", "gyd", "padėj", "padej"],
    description: "Medicina, gyventojai, užduotys ir perdavimo žurnalai.",
    permissions: ["dashboard.view", "tasks.view", "tasks.create", "residents.view_basic", "medicine.view", "handover.view", "handover.create"],
  },
  {
    value: "maintenance",
    label: "Ūkio bazinės teisės",
    shortLabel: "Ūkis",
    keywords: ["ūk", "uk", "sandėl", "sandel", "pastat", "techn", "vair"],
    description: "Ūkio užduotys, kambariai ir sandėliai.",
    permissions: ["dashboard.view", "tasks.view", "tasks.create", "rooms.view", "inventory.view"],
  },
  {
    value: "care_worker",
    label: "Priežiūros bazinės teisės",
    shortLabel: "Priežiūra",
    keywords: ["priežiūr", "prieziur", "individual", "darbuotoj"],
    description: "Bazinė gyventojų informacija ir užduotys.",
    permissions: ["dashboard.view", "tasks.view", "tasks.create", "residents.view_basic"],
  },
];

function uniquePermissions(items: Permission[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalizeExtraPermissions(value: Employee["extra_permissions"]) {
  if (!value) return [] as Permission[];
  if (Array.isArray(value)) return uniquePermissions(value as Permission[]);

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? uniquePermissions(parsed as Permission[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function employeeName(employee: Employee) {
  const full = String(employee.full_name || "").trim();
  if (full) return full;

  const combined = [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim();
  return combined || employee.email || "Darbuotojas";
}

function employeeInitials(employee: Employee) {
  const name = employeeName(employee);
  const parts = name.split(" ").filter(Boolean);
  const initials = parts.length >= 2 ? `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}` : name.slice(0, 2);
  return initials.toUpperCase();
}

function roleLabel(value?: string | null) {
  if (value === "owner") return "Savininkas";
  if (value === "admin") return "Administracija";
  if (value === "employee") return "Darbuotojas";
  return value || "Nepasirinkta";
}

function permissionLabel(permission: Permission) {
  return PERMISSION_OPTIONS.find((item) => item.value === permission)?.label || permission;
}

function detectBaseTemplate(employee: Employee) {
  const haystack = `${employee.position || ""} ${employee.department || ""} ${employee.role || ""}`.toLowerCase();

  if (employee.role === "admin" || employee.role === "owner") {
    return ROLE_TEMPLATES[0];
  }

  return ROLE_TEMPLATES.find((template) => template.keywords.some((keyword) => haystack.includes(keyword))) || ROLE_TEMPLATES[4];
}

function getBasePermissions(employee: Employee) {
  return detectBaseTemplate(employee).permissions;
}

function getEffectivePermissions(employee: Employee) {
  return uniquePermissions([...getBasePermissions(employee), ...normalizeExtraPermissions(employee.extra_permissions)]);
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

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("lt-LT", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function StaffTypesModulePage() {
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<EmployeeFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  async function loadEmployees() {
    setLoading(true);
    setMessage("");

    try {
      const organizationId = await getCurrentOrganizationId();

      if (!organizationId) {
        setEmployees([]);
        setMessageType("error");
        setMessage("Nepavyko nustatyti įstaigos.");
        return;
      }

      const { data: members, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id, role, position, department, extra_permissions, is_active, employment_start_date, employment_rate, weekly_hours, is_archived")
        .eq("organization_id", organizationId)
        .neq("is_archived", true)
        .order("position", { ascending: true });

      if (membersError) throw membersError;

      const userIds = (members || []).map((member: any) => member.user_id).filter(Boolean);
      let profilesById = new Map<string, any>();

      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name, full_name")
          .in("id", userIds);

        if (profilesError) {
          console.warn("[StaffTypesModule] profiles load failed", profilesError);
        } else {
          profilesById = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
        }
      }

      const nextEmployees = ((members || []) as any[])
        .map((member) => toEmployee(member, profilesById.get(member.user_id)))
        .sort((a, b) => employeeName(a).localeCompare(employeeName(b), "lt"));

      setEmployees(nextEmployees);
      setSelectedUserId((previous) => previous || nextEmployees[0]?.user_id || null);
    } catch (error) {
      setMessageType("error");
      setMessage(getReadableError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEmployees();
  }, []);

  async function updateEmployeeAccess(
    employee: Employee,
    patch: Partial<Pick<Employee, "position" | "extra_permissions" | "employment_rate" | "weekly_hours">>,
  ) {
    setSavingUserId(employee.user_id);
    setMessage("");

    const nextEmployee: Employee = { ...employee, ...patch };
    const nextPosition = String(nextEmployee.position || "").trim() || null;
    const nextPermissions = normalizeExtraPermissions(nextEmployee.extra_permissions);
    const nextEmploymentRate = Math.max(0, Math.min(2, Number(nextEmployee.employment_rate ?? 1)));
    const nextWeeklyHours = Math.max(0, Math.min(80, Number(nextEmployee.weekly_hours ?? Math.round(nextEmploymentRate * 40))));

    setEmployees((previous) =>
      previous.map((item) =>
        item.user_id === employee.user_id
          ? {
              ...item,
              position: nextPosition,
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

      const { error } = await supabase
        .from("organization_members")
        .update({
          position: nextPosition,
          extra_permissions: nextPermissions,
          employment_rate: nextEmploymentRate,
          weekly_hours: nextWeeklyHours,
        })
        .eq("organization_id", organizationId)
        .eq("user_id", employee.user_id);

      if (error) throw error;

      setMessageType("success");
      setMessage("Pareigos, etatas ir papildomos teisės išsaugotos.");
    } catch (error) {
      setEmployees((previous) => previous.map((item) => (item.user_id === employee.user_id ? employee : item)));
      setMessageType("error");
      setMessage(getReadableError(error));
    } finally {
      setSavingUserId(null);
    }
  }

  function toggleExtraPermission(employee: Employee, permission: Permission) {
    const current = normalizeExtraPermissions(employee.extra_permissions);
    const base = getBasePermissions(employee);

    if (base.includes(permission)) {
      setMessageType("success");
      setMessage("Ši teisė yra bazinė pagal pareigybę, todėl ji jau aktyvi ir jos atskirai jungti nereikia.");
      return;
    }

    const next = current.includes(permission)
      ? current.filter((item) => item !== permission)
      : uniquePermissions([...current, permission]);

    void updateEmployeeAccess(employee, { extra_permissions: next });
  }

  function addTemplateExtras(employee: Employee, template: RoleTemplate) {
    const base = getBasePermissions(employee);
    const current = normalizeExtraPermissions(employee.extra_permissions);
    const onlyExtras = template.permissions.filter((permission) => !base.includes(permission));

    void updateEmployeeAccess(employee, { extra_permissions: uniquePermissions([...current, ...onlyExtras]) });
  }

  function clearExtraPermissions(employee: Employee) {
    const confirmed = window.confirm("Ar tikrai nuimti visas papildomas teises? Bazinės teisės liks aktyvios.");
    if (!confirmed) return;
    void updateEmployeeAccess(employee, { extra_permissions: [] });
  }

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const effectiveCount = getEffectivePermissions(employee).length;
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "active" && employee.is_active !== false) ||
        (activeFilter === "withPosition" && Boolean(String(employee.position || "").trim())) ||
        (activeFilter === "withRights" && effectiveCount > 0) ||
        (activeFilter === "withoutRights" && effectiveCount === 0);

      if (!matchesFilter) return false;
      if (!query) return true;

      return [employeeName(employee), employee.email, employee.position, employee.department, roleLabel(employee.role)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [employees, search, activeFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paginatedEmployees = filteredEmployees.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedEmployee =
    filteredEmployees.find((employee) => employee.user_id === selectedUserId) || paginatedEmployees[0] || null;

  useEffect(() => {
    setPage(1);
  }, [search, activeFilter]);

  useEffect(() => {
    if (!selectedEmployee && filteredEmployees.length > 0) {
      setSelectedUserId(filteredEmployees[0].user_id);
    }
  }, [filteredEmployees, selectedEmployee]);

  const stats = useMemo(() => {
    const activeCount = employees.filter((employee) => employee.is_active !== false).length;
    const withPosition = employees.filter((employee) => String(employee.position || "").trim()).length;
    const withRights = employees.filter((employee) => getEffectivePermissions(employee).length > 0).length;
    const withoutRights = employees.filter((employee) => getEffectivePermissions(employee).length === 0).length;

    return [
      { key: "all" as EmployeeFilter, label: "Visi", value: employees.length },
      { key: "active" as EmployeeFilter, label: "Aktyvūs", value: activeCount },
      { key: "withPosition" as EmployeeFilter, label: "Su pareigomis", value: withPosition },
      { key: "withRights" as EmployeeFilter, label: "Su teisėmis", value: withRights },
      { key: "withoutRights" as EmployeeFilter, label: "Be teisių", value: withoutRights },
    ];
  }, [employees]);

  if (loading) {
    return (
      <section style={styles.pageShell}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <div>
            <p style={styles.loadingTitle}>Kraunamos pareigos ir teisės</p>
            <p style={styles.loadingText}>Tikrinami darbuotojai ir jų prieigos.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.pageShell}>
      <header style={styles.headerCard}>
        <div style={styles.titleRow}>
          <div style={styles.headerIcon}>
            <BriefcaseBusiness size={30} color="#007a5a" />
          </div>
          <div>
            <p style={styles.eyebrow}>Pareigos ir teisės</p>
            <h1 style={styles.pageTitle}>Pareigos, šablonai ir individualios teisės</h1>
            <p style={styles.pageSubtitle}>Pasirinkite darbuotoją ir valdykite jo bazines pagal pareigybę bei papildomas individualias teises.</p>
          </div>
        </div>

        <div style={styles.headerActions}>
          <button type="button" onClick={() => window.location.href = "/team"} style={styles.backButton}>
            <ArrowLeft size={18} /> Grįžti
          </button>
          <button type="button" onClick={loadEmployees} style={styles.refreshButton}>
            <RefreshCw size={18} /> Atnaujinti
          </button>
        </div>
      </header>

      {message ? (
        <div style={messageType === "error" ? styles.messageError : styles.messageSuccess}>
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      ) : null}

      <div style={styles.filterGrid}>
        {stats.map((stat) => {
          const isActive = activeFilter === stat.key;
          return (
            <button
              key={stat.key}
              type="button"
              onClick={() => setActiveFilter(stat.key)}
              style={isActive ? styles.filterCardActive : styles.filterCard}
            >
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </button>
          );
        })}
      </div>

      <article style={styles.mainCard}>
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>Darbuotojai</h2>
            <p style={styles.cardSubtitle}>Kairėje pasirinkite darbuotoją, dešinėje matysite bazines ir papildomas teises.</p>
          </div>

          <label style={styles.searchBox}>
            <Search size={19} color="#94a3b8" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ieškoti darbuotojo..."
              style={styles.searchInput}
            />
          </label>
        </div>

        <div style={styles.managerLayout}>
          <aside style={styles.listPanel}>
            <div style={styles.listHeader}>
              <strong>{filteredEmployees.length} darbuotojų</strong>
              <span>
                {filteredEmployees.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filteredEmployees.length)}
              </span>
            </div>

            {paginatedEmployees.length === 0 ? (
              <div style={styles.emptyState}>
                <UserRound size={32} color="#94a3b8" />
                <strong>Darbuotojų nerasta</strong>
                <span>Pabandykite pakeisti paiešką.</span>
              </div>
            ) : (
              <div style={styles.employeeList}>
                {paginatedEmployees.map((employee) => {
                  const effectiveCount = getEffectivePermissions(employee).length;
                  const active = selectedEmployee?.user_id === employee.user_id;

                  return (
                    <button
                      key={employee.user_id}
                      type="button"
                      onClick={() => setSelectedUserId(employee.user_id)}
                      style={active ? styles.employeeRowActive : styles.employeeRow}
                    >
                      <div style={styles.avatarSmall}>{employeeInitials(employee)}</div>
                      <div style={styles.employeeRowText}>
                        <strong>{employeeName(employee)}</strong>
                        <span>{employee.position || "Pareigos nenurodytos"}</span>
                        <small>{effectiveCount} teisės · {roleLabel(employee.role)}</small>
                      </div>
                      <span style={employee.is_active === false ? styles.statusInactive : styles.statusActive}>
                        {employee.is_active === false ? "Neaktyvus" : "Aktyvus"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div style={styles.pagination}>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                style={styles.pageButton}
              >
                <ChevronLeft size={17} />
              </button>
              <span>
                {safePage} / {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount}
                onClick={() => setPage((previous) => Math.min(pageCount, previous + 1))}
                style={styles.pageButton}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </aside>

          <section style={styles.detailPanel}>
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
              <div style={styles.emptyState}>
                <UserRound size={32} color="#94a3b8" />
                <strong>Pasirinkite darbuotoją</strong>
                <span>Dešinėje bus rodomos pareigos ir teisės.</span>
              </div>
            )}
          </section>
        </div>
      </article>
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
  updateEmployeeAccess: (employee: Employee, patch: Partial<Pick<Employee, "position" | "extra_permissions" | "employment_rate" | "weekly_hours">>) => void;
}) {
  const baseTemplate = detectBaseTemplate(employee);
  const basePermissions = getBasePermissions(employee);
  const extraPermissions = normalizeExtraPermissions(employee.extra_permissions).filter((permission) => !basePermissions.includes(permission));
  const effectivePermissions = getEffectivePermissions(employee);

  return (
    <div style={styles.editorCard}>
      <div style={styles.employeeHeader}>
        <div style={styles.employeeMain}>
          <div style={styles.avatar}>{employeeInitials(employee)}</div>
          <div style={styles.employeeInfo}>
            <h3 style={styles.employeeName}>{employeeName(employee)}</h3>
            <p style={styles.employeeMeta}>{employee.position || "Pareigos nenurodytos"}</p>
            <p style={styles.employeeMetaSoft}>{employee.department || "Skyrius nenurodytas"}</p>
            <p style={styles.employeeMetaSoft}>
              Etatas: {Number(employee.employment_rate ?? 1).toFixed(2)} · {Number(employee.weekly_hours ?? 40)} val./sav.
            </p>
          </div>
        </div>

        <div style={styles.employeeBadges}>
          <span style={employee.is_active === false ? styles.badgeDanger : styles.badgeGood}>
            {employee.is_active === false ? "Neaktyvus" : "Aktyvus"}
          </span>
          <span style={styles.badgeSoft}>{roleLabel(employee.role)}</span>
        </div>
      </div>

      <div style={styles.formGrid}>
        <label style={styles.fieldLabel}>
          <span>Konkrečios pareigos</span>
          <input
            value={employee.position || ""}
            onChange={(event) => {
              const nextValue = event.target.value;
              setEmployees((previous) =>
                previous.map((item) => (item.user_id === employee.user_id ? { ...item, position: nextValue } : item)),
              );
            }}
            onBlur={(event) => updateEmployeeAccess(employee, { position: event.target.value })}
            disabled={saving}
            placeholder="Pvz., vyr. slaugytoja, ūkvedys"
            style={styles.input}
          />
        </label>

        <label style={styles.fieldLabel}>
          <span>Etato dydis</span>
          <input
            type="number"
            min={0}
            max={2}
            step={0.01}
            value={employee.employment_rate ?? 1}
            onChange={(event) => {
              const nextRate = Number(event.target.value);
              setEmployees((previous) =>
                previous.map((item) =>
                  item.user_id === employee.user_id
                    ? { ...item, employment_rate: nextRate, weekly_hours: item.weekly_hours ?? Math.round(nextRate * 40) }
                    : item,
                ),
              );
            }}
            onBlur={(event) => {
              const nextRate = Math.max(0, Math.min(2, Number(event.target.value || 1)));
              updateEmployeeAccess(employee, {
                employment_rate: nextRate,
                weekly_hours: employee.weekly_hours ?? Math.round(nextRate * 40),
              });
            }}
            disabled={saving}
            placeholder="Pvz., 1.00"
            style={styles.input}
          />
        </label>

        <label style={styles.fieldLabel}>
          <span>Savaitės valandos</span>
          <input
            type="number"
            min={0}
            max={80}
            step={1}
            value={employee.weekly_hours ?? 40}
            onChange={(event) => {
              const nextHours = Number(event.target.value);
              setEmployees((previous) =>
                previous.map((item) => (item.user_id === employee.user_id ? { ...item, weekly_hours: nextHours } : item)),
              );
            }}
            onBlur={(event) =>
              updateEmployeeAccess(employee, {
                employment_rate: employee.employment_rate ?? 1,
                weekly_hours: Math.max(0, Math.min(80, Number(event.target.value || 40))),
              })
            }
            disabled={saving}
            placeholder="Pvz., 40"
            style={styles.input}
          />
        </label>

        <div style={styles.accessSummaryGrid}>
          <div style={styles.accessSummaryItem}>
            <span>Pareigybės šablonas</span>
            <strong>{baseTemplate.shortLabel}</strong>
          </div>
          <div style={styles.accessSummaryItem}>
            <span>Etatas</span>
            <strong>{Number(employee.employment_rate ?? 1).toFixed(2)} et.</strong>
          </div>
          <div style={styles.accessSummaryItem}>
            <span>Bazinės teisės</span>
            <strong>{basePermissions.length} teisės</strong>
          </div>
          <div style={styles.accessSummaryItem}>
            <span>Papildomos teisės</span>
            <strong>{extraPermissions.length} teisės</strong>
          </div>
          <div style={styles.accessSummaryItemStrong}>
            <span>Iš viso aktyvių teisių</span>
            <strong>{effectivePermissions.length} teisės</strong>
          </div>
        </div>
      </div>

      <div style={styles.infoBox}>
        <BadgeCheck size={18} color="#2563eb" />
        <div>
          <strong>Kaip veikia teisės?</strong>
          <span>Bazinės teisės žaliai aktyvios automatiškai pagal pareigybę / rolę. Papildomos teisės jungiamos rankiniu būdu konkrečiam darbuotojui.</span>
        </div>
      </div>

      <section style={styles.permissionSection}>
        <div style={styles.permissionsHeader}>
          <div>
            <p style={styles.sectionTitle}>Bazinės teisės pagal pareigybę</p>
            <p style={styles.helpText}>{baseTemplate.description} Jų atskirai įjungti nereikia.</p>
          </div>
          <span style={styles.baseStatusPill}>Visos bazinės teisės aktyvios</span>
        </div>

        <div style={styles.permissionGridCompact}>
          {basePermissions.map((permission) => (
            <div key={permission} style={styles.basePermissionCard}>
              <CheckCircle2 size={18} color="#047857" />
              <strong>{permissionLabel(permission)}</strong>
              <span style={styles.baseBadge}>Bazinė</span>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.permissionSection}>
        <div style={styles.permissionsHeader}>
          <div>
            <p style={styles.sectionTitle}>Papildomos individualios teisės</p>
            <p style={styles.helpText}>Pridedamos prie bazinių teisių. Aktyvios pažymėtos mėlynai.</p>
          </div>
          <button
            type="button"
            disabled={saving || extraPermissions.length === 0}
            onClick={() => clearExtraPermissions(employee)}
            style={styles.clearButton}
          >
            Nuimti papildomas
          </button>
        </div>

        <div style={styles.templateSection}>
          <span style={styles.templateLabel}>Greitai pridėti papildomų teisių pagal šabloną</span>
          <div style={styles.templateGrid}>
            {ROLE_TEMPLATES.map((template) => (
              <button
                key={template.value}
                type="button"
                disabled={saving}
                onClick={() => addTemplateExtras(employee, template)}
                style={styles.templateButton}
                title={template.description}
              >
                <Plus size={15} /> {template.shortLabel}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.permissionGrid}>
          {PERMISSION_OPTIONS.filter((permission) => !basePermissions.includes(permission.value)).map((permission) => {
            const checked = extraPermissions.includes(permission.value);

            return (
              <button
                key={permission.value}
                type="button"
                disabled={saving}
                onClick={() => toggleExtraPermission(employee, permission.value)}
                style={checked ? styles.extraPermissionCardActive : styles.extraPermissionCard}
              >
                <div style={styles.permissionCardTop}>
                  <strong>{permission.label}</strong>
                  {checked ? <ToggleRight size={28} color="#2563eb" /> : <ToggleLeft size={28} color="#94a3b8" />}
                </div>
                <span>{permission.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div style={styles.footerActions}>
        <div style={styles.saveHint}>
          {saving ? <RefreshCw size={17} /> : <Save size={17} />}
          <span>{saving ? "Saugoma..." : "Pakeitimai išsaugomi automatiškai"}</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pageShell: {
    width: "min(100%, 1280px)",
    margin: "0 auto",
    display: "grid",
    gap: 18,
    padding: "0 18px 40px",
  },
  loadingCard: {
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    borderRadius: 28,
    padding: 28,
    display: "flex",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 18px 44px rgba(15,23,42,.08)",
  },
  spinner: { width: 38, height: 38, borderRadius: 999, border: "4px solid #e2e8f0", borderTop: "4px solid #007a5a" },
  loadingTitle: { margin: 0, color: "#020617", fontSize: 18, fontWeight: 950 },
  loadingText: { margin: "4px 0 0", color: "#64748b", fontSize: 14, fontWeight: 800 },
  headerCard: {
    border: "1px solid #dde7f2",
    background: "#ffffff",
    borderRadius: 30,
    padding: 26,
    boxShadow: "0 18px 45px rgba(15,23,42,.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
  },
  titleRow: { display: "flex", alignItems: "center", gap: 18, minWidth: 0 },
  headerActions: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  backButton: {
    border: "1px solid #dbe5ee",
    background: "#ffffff",
    color: "#334155",
    borderRadius: 18,
    padding: "12px 16px",
    fontWeight: 950,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
  },
  refreshButton: {
    border: "1px solid #bbf7d0",
    background: "#ecfdf5",
    color: "#007a5a",
    borderRadius: 18,
    padding: "12px 16px",
    fontWeight: 950,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    display: "grid",
    placeItems: "center",
    background: "#ecfdf5",
    flexShrink: 0,
  },
  eyebrow: { margin: 0, color: "#007a5a", textTransform: "uppercase", letterSpacing: 4, fontWeight: 950, fontSize: 13 },
  pageTitle: { margin: "6px 0 0", color: "#020617", fontSize: 30, lineHeight: 1.1, fontWeight: 950 },
  pageSubtitle: { margin: "8px 0 0", color: "#64748b", fontSize: 15, fontWeight: 800 },
  messageSuccess: { border: "1px solid #bbf7d0", background: "#ecfdf5", color: "#047857", borderRadius: 18, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, fontWeight: 900 },
  messageError: { border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 18, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, fontWeight: 900 },
  filterGrid: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 },
  filterCard: {
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    borderRadius: 18,
    padding: 16,
    color: "#334155",
    display: "grid",
    gap: 6,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(15,23,42,.05)",
  },
  filterCardActive: {
    border: "1px solid #86efac",
    background: "#ecfdf5",
    borderRadius: 18,
    padding: 16,
    color: "#047857",
    display: "grid",
    gap: 6,
    cursor: "pointer",
    boxShadow: "0 16px 34px rgba(0,122,90,.12)",
  },
  mainCard: { border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 30, padding: 24, boxShadow: "0 18px 45px rgba(15,23,42,.08)" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, paddingBottom: 18, borderBottom: "1px solid #edf2f7" },
  cardTitle: { margin: 0, color: "#020617", fontSize: 23, fontWeight: 950 },
  cardSubtitle: { margin: "8px 0 0", color: "#64748b", fontSize: 14, fontWeight: 800 },
  searchBox: { width: 340, border: "1px solid #dbe5ee", background: "#f8fafc", borderRadius: 20, padding: "0 14px", height: 56, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  searchInput: { border: 0, outline: 0, background: "transparent", color: "#0f172a", fontSize: 15, fontWeight: 800, width: "100%" },
  managerLayout: { display: "grid", gridTemplateColumns: "360px minmax(0, 1fr)", gap: 18, paddingTop: 18 },
  listPanel: { border: "1px solid #e2e8f0", background: "#f8fbff", borderRadius: 24, padding: 14, display: "grid", gap: 12, alignContent: "start" },
  listHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", color: "#0f172a", fontWeight: 950, padding: "0 4px" },
  employeeList: { display: "grid", gap: 10 },
  employeeRow: { border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 18, padding: 12, display: "grid", gridTemplateColumns: "48px minmax(0, 1fr) auto", alignItems: "center", gap: 11, textAlign: "left", cursor: "pointer" },
  employeeRowActive: { border: "1px solid #86efac", background: "#ecfdf5", borderRadius: 18, padding: 12, display: "grid", gridTemplateColumns: "48px minmax(0, 1fr) auto", alignItems: "center", gap: 11, textAlign: "left", cursor: "pointer", boxShadow: "0 10px 20px rgba(0,122,90,.10)" },
  avatarSmall: { width: 46, height: 46, borderRadius: 16, background: "#ffffff", color: "#007a5a", display: "grid", placeItems: "center", fontSize: 18, fontWeight: 950, boxShadow: "0 7px 18px rgba(15,23,42,.08)" },
  employeeRowText: { display: "grid", gap: 4, color: "#020617", minWidth: 0 },
  statusActive: { background: "#dcfce7", color: "#047857", border: "1px solid #bbf7d0", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 950 },
  statusInactive: { background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 950 },
  pagination: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: "#334155", fontWeight: 950, paddingTop: 4 },
  pageButton: { width: 38, height: 38, borderRadius: 14, border: "1px solid #dbe5ee", background: "#ffffff", color: "#334155", display: "grid", placeItems: "center", cursor: "pointer" },
  detailPanel: { minWidth: 0 },
  emptyState: { minHeight: 180, border: "1px dashed #cbd5e1", borderRadius: 22, display: "grid", placeItems: "center", alignContent: "center", gap: 8, color: "#64748b", fontWeight: 900, padding: 20 },
  editorCard: { border: "1px solid #dbe5ee", background: "#f8fbff", borderRadius: 28, padding: 18, display: "grid", gap: 16 },
  employeeHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 },
  employeeMain: { display: "flex", alignItems: "center", gap: 15, minWidth: 0 },
  avatar: { width: 70, height: 70, borderRadius: 22, background: "#ecfdf5", color: "#007a5a", display: "grid", placeItems: "center", fontSize: 26, fontWeight: 950, boxShadow: "0 12px 28px rgba(15,23,42,.08)" },
  employeeInfo: { minWidth: 0 },
  employeeName: { margin: 0, color: "#020617", fontSize: 25, fontWeight: 950 },
  employeeMeta: { margin: "5px 0 0", color: "#64748b", fontSize: 16, fontWeight: 900 },
  employeeMetaSoft: { margin: "4px 0 0", color: "#64748b", fontSize: 14, fontWeight: 850 },
  employeeBadges: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  badgeGood: { background: "#dcfce7", color: "#047857", borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 950 },
  badgeDanger: { background: "#fee2e2", color: "#b91c1c", borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 950 },
  badgeSoft: { background: "#ffffff", color: "#334155", borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 950 },
  formGrid: { display: "grid", gridTemplateColumns: "minmax(240px, 1fr) minmax(520px, 1.6fr)", gap: 14, alignItems: "end" },
  fieldLabel: { display: "grid", gap: 8, color: "#334155", fontWeight: 950, fontSize: 14 },
  input: { height: 50, border: "1px solid #dbe5ee", background: "#ffffff", borderRadius: 17, padding: "0 14px", outline: 0, color: "#0f172a", fontSize: 15, fontWeight: 850 },
  accessSummaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 18, overflow: "hidden" },
  accessSummaryItem: { padding: 12, display: "grid", gap: 6, borderRight: "1px solid #e2e8f0", color: "#334155", fontSize: 13, fontWeight: 850 },
  accessSummaryItemStrong: { padding: 12, display: "grid", gap: 6, color: "#047857", fontSize: 13, fontWeight: 850, background: "#f0fdf4" },
  infoBox: { border: "1px solid #dbeafe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 18, padding: 13, display: "flex", gap: 10, fontSize: 13, fontWeight: 850, lineHeight: 1.45 },
  permissionSection: { border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 22, padding: 14, display: "grid", gap: 12 },
  permissionsHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  sectionTitle: { margin: 0, color: "#0f172a", fontSize: 17, fontWeight: 950 },
  helpText: { margin: "5px 0 0", color: "#64748b", fontSize: 13, fontWeight: 800 },
  baseStatusPill: { background: "#dcfce7", color: "#047857", border: "1px solid #bbf7d0", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 950, whiteSpace: "nowrap" },
  permissionGridCompact: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 },
  basePermissionCard: { border: "1px solid #bbf7d0", background: "#ecfdf5", borderRadius: 14, padding: "11px 12px", display: "grid", gridTemplateColumns: "20px minmax(0, 1fr) auto", gap: 8, alignItems: "center", color: "#064e3b" },
  baseBadge: { background: "#ffffff", border: "1px solid #bbf7d0", color: "#047857", borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 950 },
  templateSection: { display: "grid", gap: 8 },
  templateLabel: { color: "#334155", fontSize: 13, fontWeight: 950 },
  templateGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  templateButton: { border: "1px solid #dbe5ee", background: "#ffffff", borderRadius: 999, padding: "9px 12px", color: "#334155", fontWeight: 950, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  permissionGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 },
  extraPermissionCard: { border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 16, padding: 11, textAlign: "left", cursor: "pointer", display: "grid", gap: 6, color: "#334155" },
  extraPermissionCardActive: { border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 16, padding: 11, textAlign: "left", cursor: "pointer", display: "grid", gap: 6, color: "#1e3a8a" },
  permissionCardTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  clearButton: { border: "1px solid #fecaca", background: "#fff7f7", color: "#b91c1c", borderRadius: 14, padding: "9px 11px", fontSize: 12, fontWeight: 950, cursor: "pointer" },
  footerActions: { display: "flex", justifyContent: "flex-end", borderTop: "1px solid #e2e8f0", paddingTop: 12 },
  saveHint: { display: "inline-flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 13, fontWeight: 900 },
};
