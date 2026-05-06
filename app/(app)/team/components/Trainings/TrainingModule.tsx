"use client";

import React, { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileDown,
  GraduationCap,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

type Training = {
  id: string;
  title: string;
  category: string;
  hours: number;
  validityMonths?: number;
  mandatoryForAll?: boolean;
};

type RoleRequirement = {
  role: string;
  department: string;
  yearlyHours: number;
  trainingIds: string[];
};

type CompletedTraining = {
  trainingId: string;
  completedAt: string;
};

type Employee = {
  id: string;
  name: string;
  department: string;
  role: string;
  completed: CompletedTraining[];
};

const REMINDER_DAYS = 45;

const initialTrainings: Training[] = [
  {
    id: "darbai",
    title: "Darbų sauga",
    category: "Bendrieji",
    hours: 2,
    validityMonths: 12,
    mandatoryForAll: true,
  },
  {
    id: "gaisras",
    title: "Gaisrinė sauga",
    category: "Bendrieji",
    hours: 2,
    validityMonths: 12,
    mandatoryForAll: true,
  },
  {
    id: "bdar",
    title: "BDAR",
    category: "Bendrieji",
    hours: 1,
    validityMonths: 12,
    mandatoryForAll: true,
  },
  {
    id: "smurtas",
    title: "Smurto prevencija",
    category: "Socialinė sritis",
    hours: 2,
    validityMonths: 12,
  },
  {
    id: "pirmoji",
    title: "Pirmoji pagalba",
    category: "Bendrieji",
    hours: 4,
    validityMonths: 24,
  },
  {
    id: "ivadiniai-160",
    title: "160 val. įvadiniai mokymai",
    category: "Socialinė sritis",
    hours: 160,
  },
  {
    id: "supervizijos",
    title: "Supervizijos / intervizijos",
    category: "Socialinė sritis",
    hours: 8,
    validityMonths: 12,
  },
  {
    id: "infekcijos",
    title: "Infekcijų kontrolė",
    category: "Sveikatos priežiūra",
    hours: 3,
    validityMonths: 12,
  },
  {
    id: "licencijos",
    title: "Profesinės licencijos palaikymas",
    category: "Sveikatos priežiūra",
    hours: 12,
    validityMonths: 12,
  },
  {
    id: "higiena",
    title: "Higienos mokymai",
    category: "Maitinimo paslaugos",
    hours: 4,
    validityMonths: 24,
  },
  {
    id: "maistas",
    title: "Maisto sauga",
    category: "Maitinimo paslaugos",
    hours: 3,
    validityMonths: 12,
  },
  {
    id: "info",
    title: "Informacijos sauga",
    category: "Administracija",
    hours: 1,
    validityMonths: 12,
  },
];

const initialRequirements: RoleRequirement[] = [
  {
    role: "Slaugytojas",
    department: "Sveikatos priežiūra",
    yearlyHours: 24,
    trainingIds: ["infekcijos", "pirmoji", "licencijos"],
  },
  {
    role: "Bendrosios praktikos slaugytojo padėjėjas",
    department: "Sveikatos priežiūra",
    yearlyHours: 16,
    trainingIds: ["infekcijos", "pirmoji"],
  },
  {
    role: "Socialinis darbuotojas",
    department: "Socialinė sritis",
    yearlyHours: 24,
    trainingIds: ["smurtas", "ivadiniai-160", "supervizijos"],
  },
  {
    role: "Socialinio darbuotojo padėjėjas",
    department: "Socialinė sritis",
    yearlyHours: 16,
    trainingIds: ["smurtas", "pirmoji", "supervizijos"],
  },
  {
    role: "Užimtumo specialistas",
    department: "Socialinė sritis",
    yearlyHours: 16,
    trainingIds: ["smurtas", "supervizijos"],
  },
  {
    role: "Dietistas",
    department: "Maitinimo paslaugos",
    yearlyHours: 16,
    trainingIds: ["higiena", "maistas"],
  },
  {
    role: "Virėjas",
    department: "Maitinimo paslaugos",
    yearlyHours: 12,
    trainingIds: ["higiena", "maistas"],
  },
  {
    role: "Administratorius",
    department: "Administracija",
    yearlyHours: 8,
    trainingIds: ["info"],
  },
];

const initialEmployees: Employee[] = [
  {
    id: "1",
    name: "Vardenė Pavardenė",
    department: "Sveikatos priežiūra",
    role: "Slaugytojas",
    completed: [
      { trainingId: "bdar", completedAt: "2026-01-15" },
      { trainingId: "darbai", completedAt: "2025-05-20" },
      { trainingId: "pirmoji", completedAt: "2025-11-10" },
    ],
  },
  {
    id: "2",
    name: "Ona Onaitė",
    department: "Maitinimo paslaugos",
    role: "Dietistas",
    completed: [
      { trainingId: "bdar", completedAt: "2026-02-02" },
      { trainingId: "maistas", completedAt: "2025-05-25" },
    ],
  },
  {
    id: "3",
    name: "Jonas Jonaitis",
    department: "Socialinė sritis",
    role: "Socialinis darbuotojas",
    completed: [
      { trainingId: "bdar", completedAt: "2026-02-01" },
      { trainingId: "darbai", completedAt: "2026-02-03" },
      { trainingId: "gaisras", completedAt: "2025-05-18" },
      { trainingId: "smurtas", completedAt: "2026-02-10" },
    ],
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[ą]/g, "a")
    .replace(/[č]/g, "c")
    .replace(/[ęė]/g, "e")
    .replace(/[į]/g, "i")
    .replace(/[š]/g, "s")
    .replace(/[ųū]/g, "u")
    .replace(/[ž]/g, "z")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function daysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export default function TrainingModule() {
  const [trainings, setTrainings] = useState(initialTrainings);
  const [requirements, setRequirements] = useState(initialRequirements);
  const [employees, setEmployees] = useState(initialEmployees);
  const [selectedDepartment, setSelectedDepartment] = useState("Visi padaliniai");
  const [selectedRole, setSelectedRole] = useState("Socialinis darbuotojas");
  const [selectedTraining, setSelectedTraining] = useState("");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "missing" | "expiry">("all");
  const [showNewTrainingForm, setShowNewTrainingForm] = useState(false);
  const [showNewRoleForm, setShowNewRoleForm] = useState(false);
  const [newTrainingTitle, setNewTrainingTitle] = useState("");
  const [newTrainingCategory, setNewTrainingCategory] = useState("");
  const [newTrainingHours, setNewTrainingHours] = useState("1");
  const [newTrainingValidity, setNewTrainingValidity] = useState("12");
  const [newRoleTitle, setNewRoleTitle] = useState("");
  const [newRoleDepartment, setNewRoleDepartment] = useState("");
  const [newRoleHours, setNewRoleHours] = useState("8");
  const [assignNewTrainingToRole, setAssignNewTrainingToRole] = useState(false);
  const [editingRoleKey, setEditingRoleKey] = useState<string | null>(null);
  const [editRoleTitle, setEditRoleTitle] = useState("");
  const [editRoleDepartment, setEditRoleDepartment] = useState("");
  const [editRoleHours, setEditRoleHours] = useState("8");
  const [editingTrainingId, setEditingTrainingId] = useState<string | null>(
    null,
  );
  const [editTrainingTitle, setEditTrainingTitle] = useState("");
  const [editTrainingCategory, setEditTrainingCategory] = useState("");
  const [editTrainingHours, setEditTrainingHours] = useState("1");
  const [editTrainingValidity, setEditTrainingValidity] = useState("12");
  const [completionDates, setCompletionDates] = useState<
    Record<string, string>
  >({});

  const today = useMemo(() => new Date(), []);
  const departments = useMemo(
    () => [
      "Visi padaliniai",
      ...Array.from(new Set(requirements.map((r) => r.department))).sort(),
    ],
    [requirements],
  );
  const visibleRequirements = useMemo(
    () =>
      requirements.filter(
        (r) =>
          selectedDepartment === "Visi padaliniai" ||
          r.department === selectedDepartment,
      ),
    [requirements, selectedDepartment],
  );

  const getTraining = (id: string) =>
    trainings.find((training) => training.id === id);
  const getRoleRequirement = (role: string) =>
    requirements.find((requirement) => requirement.role === role);
  const getRequiredIds = (role: string) =>
    Array.from(
      new Set([
        ...trainings.filter((t) => t.mandatoryForAll).map((t) => t.id),
        ...(getRoleRequirement(role)?.trainingIds || []),
      ]),
    );
  const getCompletedRecord = (employee: Employee, trainingId: string) =>
    employee.completed.find((item) => item.trainingId === trainingId);
  const getRequiredHours = (role: string) =>
    getRequiredIds(role).reduce(
      (sum, id) => sum + (getTraining(id)?.hours || 0),
      0,
    );
  const getCompletedHours = (employee: Employee) =>
    employee.completed.reduce(
      (sum, item) => sum + (getTraining(item.trainingId)?.hours || 0),
      0,
    );
  const getMissingIds = (employee: Employee) => {
    const done = employee.completed.map((item) => item.trainingId);
    return getRequiredIds(employee.role).filter((id) => !done.includes(id));
  };
  const getExpiryInfo = (completed: CompletedTraining) => {
    const training = getTraining(completed.trainingId);
    if (!training?.validityMonths)
      return {
        status: "valid" as const,
        label: "Neterminuota",
        daysLeft: null as number | null,
      };
    const expiresAt = addMonths(
      new Date(completed.completedAt),
      training.validityMonths,
    );
    const daysLeft = daysBetween(today, expiresAt);
    if (daysLeft < 0)
      return {
        status: "expired" as const,
        label: `Baigėsi ${formatDate(expiresAt.toISOString())}`,
        daysLeft,
      };
    if (daysLeft <= REMINDER_DAYS)
      return {
        status: "soon" as const,
        label: `Baigsis po ${daysLeft} d.`,
        daysLeft,
      };
    return {
      status: "valid" as const,
      label: `Galioja iki ${formatDate(expiresAt.toISOString())}`,
      daysLeft,
    };
  };
  const getEmployeeExpiryRisk = (employee: Employee) =>
    employee.completed.filter((item) => {
      const info = getExpiryInfo(item);
      return info.status === "expired" || info.status === "soon";
    });

  const activeRequirement =
    getRoleRequirement(selectedRole) ||
    visibleRequirements[0] ||
    requirements[0];
  const activeRequiredIds = getRequiredIds(activeRequirement.role);
  const activeRoleEmployees = employees.filter(
    (employee) => employee.role === activeRequirement.role,
  );
  const filteredActiveRoleEmployees = activeRoleEmployees.filter((employee) => {
    if (riskFilter === "missing") return getMissingIds(employee).length > 0;
    if (riskFilter === "expiry") return getEmployeeExpiryRisk(employee).length > 0;
    return true;
  });

  const filteredTrainings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return trainings
      .filter(
        (training) =>
          !query ||
          `${training.title} ${training.category}`
            .toLowerCase()
            .includes(query),
      )
      .sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          a.title.localeCompare(b.title),
      );
  }, [search, trainings]);

  const dashboard = useMemo(() => {
    const nonCompliantEmployees = employees.filter(
      (employee) => getMissingIds(employee).length > 0,
    ).length;
    const missingTrainings = employees.reduce(
      (sum, employee) => sum + getMissingIds(employee).length,
      0,
    );
    const expiryRisks = employees.reduce(
      (sum, employee) => sum + getEmployeeExpiryRisk(employee).length,
      0,
    );
    const completedHours = employees.reduce(
      (sum, employee) => sum + getCompletedHours(employee),
      0,
    );
    return {
      nonCompliantEmployees,
      missingTrainings,
      completedHours,
      expiryRisks,
    };
  }, [employees, trainings, requirements]);

  function addNewTraining() {
    if (!newTrainingTitle.trim()) return;
    const baseId = slugify(newTrainingTitle);
    let nextId = baseId || `mokymas-${trainings.length + 1}`;
    let counter = 2;
    while (trainings.some((training) => training.id === nextId)) {
      nextId = `${baseId}-${counter}`;
      counter += 1;
    }
    const nextTraining = {
      id: nextId,
      title: newTrainingTitle.trim(),
      category: newTrainingCategory.trim() || "Kita",
      hours: Number(newTrainingHours) || 1,
      validityMonths: Number(newTrainingValidity) || undefined,
    };
    setTrainings((prev) => [...prev, nextTraining]);
    if (assignNewTrainingToRole && activeRequirement?.role) {
      setRequirements((prev) =>
        prev.map((requirement) =>
          requirement.role === activeRequirement.role
            ? {
                ...requirement,
                trainingIds: Array.from(
                  new Set([...requirement.trainingIds, nextTraining.id]),
                ),
              }
            : requirement,
        ),
      );
    }
    setNewTrainingTitle("");
    setNewTrainingCategory("");
    setNewTrainingHours("1");
    setNewTrainingValidity("12");
    setAssignNewTrainingToRole(false);
    setShowNewTrainingForm(false);
  }

  function addNewRole() {
    if (!newRoleTitle.trim() || !newRoleDepartment.trim()) return;
    const role = newRoleTitle.trim();
    if (
      requirements.some(
        (item) => item.role.toLowerCase() === role.toLowerCase(),
      )
    )
      return;
    const next = {
      role,
      department: newRoleDepartment.trim(),
      yearlyHours: Number(newRoleHours) || 0,
      trainingIds: [],
    };
    setRequirements((prev) => [...prev, next]);
    setSelectedDepartment(next.department);
    setSelectedRole(next.role);
    setNewRoleTitle("");
    setNewRoleDepartment("");
    setNewRoleHours("8");
    setShowNewRoleForm(false);
  }

  function startEditRole(roleName: string) {
    const role = getRoleRequirement(roleName);
    if (!role) return;
    setEditingRoleKey(role.role);
    setEditRoleTitle(role.role);
    setEditRoleDepartment(role.department);
    setEditRoleHours(String(role.yearlyHours));
  }

  function saveEditedRole() {
    if (!editingRoleKey || !editRoleTitle.trim() || !editRoleDepartment.trim())
      return;
    const nextRoleName = editRoleTitle.trim();
    const oldRoleName = editingRoleKey;
    const duplicate = requirements.some(
      (item) =>
        item.role !== oldRoleName &&
        item.role.toLowerCase() === nextRoleName.toLowerCase(),
    );
    if (duplicate) return;
    setRequirements((prev) =>
      prev.map((requirement) =>
        requirement.role === oldRoleName
          ? {
              ...requirement,
              role: nextRoleName,
              department: editRoleDepartment.trim(),
              yearlyHours: Number(editRoleHours) || 0,
            }
          : requirement,
      ),
    );
    setEmployees((prev) =>
      prev.map((employee) =>
        employee.role === oldRoleName
          ? {
              ...employee,
              role: nextRoleName,
              department: editRoleDepartment.trim(),
            }
          : employee,
      ),
    );
    setSelectedRole(nextRoleName);
    setSelectedDepartment(editRoleDepartment.trim());
    setEditingRoleKey(null);
  }

  function startEditTraining(trainingId: string) {
    const training = getTraining(trainingId);
    if (!training) return;
    setEditingTrainingId(training.id);
    setEditTrainingTitle(training.title);
    setEditTrainingCategory(training.category);
    setEditTrainingHours(String(training.hours));
    setEditTrainingValidity(
      training.validityMonths ? String(training.validityMonths) : "",
    );
  }

  function saveEditedTraining() {
    if (!editingTrainingId || !editTrainingTitle.trim()) return;
    setTrainings((prev) =>
      prev.map((training) =>
        training.id === editingTrainingId
          ? {
              ...training,
              title: editTrainingTitle.trim(),
              category: editTrainingCategory.trim() || "Kita",
              hours: Number(editTrainingHours) || 1,
              validityMonths: editTrainingValidity.trim()
                ? Number(editTrainingValidity) || undefined
                : undefined,
            }
          : training,
      ),
    );
    setEditingTrainingId(null);
  }

  function addRequirement() {
    if (!selectedRole || !selectedTraining) return;
    setRequirements((prev) =>
      prev.map((requirement) =>
        requirement.role === selectedRole &&
        !requirement.trainingIds.includes(selectedTraining)
          ? {
              ...requirement,
              trainingIds: [...requirement.trainingIds, selectedTraining],
            }
          : requirement,
      ),
    );
    setSelectedTraining("");
  }

  function removeRequirement(role: string, trainingId: string) {
    setRequirements((prev) =>
      prev.map((requirement) =>
        requirement.role === role
          ? {
              ...requirement,
              trainingIds: requirement.trainingIds.filter(
                (id) => id !== trainingId,
              ),
            }
          : requirement,
      ),
    );
  }

  function saveCompletion(employeeId: string, trainingId: string) {
    const key = `${employeeId}:${trainingId}`;
    const completedAt =
      completionDates[key] || new Date().toISOString().slice(0, 10);
    setEmployees((prev) =>
      prev.map((employee) => {
        if (employee.id !== employeeId) return employee;
        const withoutOld = employee.completed.filter(
          (item) => item.trainingId !== trainingId,
        );
        return {
          ...employee,
          completed: [...withoutOld, { trainingId, completedAt }],
        };
      }),
    );
  }

  function removeCompletion(employeeId: string, trainingId: string) {
    setEmployees((prev) =>
      prev.map((employee) =>
        employee.id === employeeId
          ? {
              ...employee,
              completed: employee.completed.filter(
                (item) => item.trainingId !== trainingId,
              ),
            }
          : employee,
      ),
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <div className="mx-auto w-full max-w-[1680px] px-4 py-6 md:px-8">
        <header className="mb-6 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.4fr_0.6fr]">
            <div className="p-7 md:p-9">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">
                <ShieldCheck className="h-4 w-4" /> Personalo mokymų ir kvalifikacijos apskaita
              </div>
              <h1 className="max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
                Darbuotojų mokymų valdymas
              </h1>
              <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-slate-500 md:text-lg">
                Čia kaupiama darbuotojų mokymų istorija, stebimi privalomi reikalavimai, galiojimo terminai ir priminimai personalo specialistui ar vadovui.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewTrainingForm((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
                >
                  <Plus className="h-5 w-5" /> Pridėti mokymus
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewRoleForm((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Plus className="h-5 w-5" /> Nauja pareigybė
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <FileDown className="h-5 w-5" /> Eksporto ataskaita
                </button>
              </div>
            </div>
            <div className="bg-slate-950 p-7 text-white md:p-9">
              <div className="text-sm font-black uppercase tracking-wide text-emerald-300">
                Mokymų stebėsena
              </div>
              <div className="mt-5 space-y-3">
                <MiniMetric
                  label="Priminama prieš"
                  value={`${REMINDER_DAYS} d. iki termino`}
                />
                <MiniMetric
                  label="Pareigybės"
                  value={`${requirements.length}`}
                />
                <MiniMetric
                  label="Padaliniai"
                  value={`${departments.length - 1}`}
                />
                <MiniMetric label="Mokymai" value={`${trainings.length}`} />
              </div>
            </div>
          </div>
        </header>

        <Modal
          isOpen={showNewTrainingForm}
          title="Pridėti mokymus"
          subtitle="Pridėkite mokymus, kurių dar nėra sąraše. Jei reikia, juos iškart galima priskirti pasirinktai pareigybei."
          onClose={() => setShowNewTrainingForm(false)}
        >
          <Input label="Mokymo pavadinimas" value={newTrainingTitle} onChange={setNewTrainingTitle} />
          <Input label="Mokymų sritis" value={newTrainingCategory} onChange={setNewTrainingCategory} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valandos" value={newTrainingHours} onChange={setNewTrainingHours} type="number" />
            <Input label="Galiojimas mėn. — palikite tuščią, jei neterminuota" value={newTrainingValidity} onChange={setNewTrainingValidity} type="number" />
          </div>
          <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
            <input
              type="checkbox"
              checked={assignNewTrainingToRole}
              onChange={(e) => setAssignNewTrainingToRole(e.target.checked)}
              className="h-4 w-4 accent-emerald-700"
            />
            Priskirti pasirinktai pareigybei: {activeRequirement?.role}
          </label>
          <button type="button" onClick={addNewTraining} className="rounded-2xl bg-emerald-700 px-5 py-3 font-black text-white hover:bg-emerald-800">
            Išsaugoti mokymus
          </button>
        </Modal>

        <Modal
          isOpen={showNewRoleForm}
          title="Pridėti pareigybę"
          subtitle="Pareigybės grupuojamos pagal padalinius, todėl sąrašas išlieka aiškus net ir didelėje įstaigoje."
          onClose={() => setShowNewRoleForm(false)}
        >
          <Input label="Pareigybė" value={newRoleTitle} onChange={setNewRoleTitle} />
          <Input label="Padalinys" value={newRoleDepartment} onChange={setNewRoleDepartment} />
          <Input label="Metinė valandų norma" value={newRoleHours} onChange={setNewRoleHours} type="number" />
          <button type="button" onClick={addNewRole} className="rounded-2xl bg-emerald-700 px-5 py-3 font-black text-white hover:bg-emerald-800">
            Išsaugoti pareigybę
          </button>
        </Modal>

        <Modal
          isOpen={!!editingRoleKey}
          title="Redaguoti pareigybę"
          subtitle="Pakeitus pavadinimą, darbuotojų įrašai bus atnaujinti automatiškai."
          onClose={() => setEditingRoleKey(null)}
        >
          <Input label="Pareigybė" value={editRoleTitle} onChange={setEditRoleTitle} />
          <Input label="Padalinys" value={editRoleDepartment} onChange={setEditRoleDepartment} />
          <Input label="Metinė valandų norma" value={editRoleHours} onChange={setEditRoleHours} type="number" />
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={saveEditedRole} className="rounded-2xl bg-emerald-700 px-5 py-3 font-black text-white hover:bg-emerald-800">Išsaugoti</button>
            <button type="button" onClick={() => setEditingRoleKey(null)} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-700 hover:bg-slate-50">Atšaukti</button>
          </div>
        </Modal>

        <Modal
          isOpen={!!editingTrainingId}
          title="Redaguoti mokymus"
          subtitle="Valandos ir galiojimas perskaičiuos progresą bei terminų priminimus."
          onClose={() => setEditingTrainingId(null)}
        >
          <Input label="Mokymo pavadinimas" value={editTrainingTitle} onChange={setEditTrainingTitle} />
          <Input label="Mokymų sritis" value={editTrainingCategory} onChange={setEditTrainingCategory} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valandos" value={editTrainingHours} onChange={setEditTrainingHours} type="number" />
            <Input label="Galiojimas mėn. — palikite tuščią, jei neterminuota" value={editTrainingValidity} onChange={setEditTrainingValidity} type="number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={saveEditedTraining} className="rounded-2xl bg-emerald-700 px-5 py-3 font-black text-white hover:bg-emerald-800">Išsaugoti</button>
            <button type="button" onClick={() => setEditingTrainingId(null)} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-700 hover:bg-slate-50">Atšaukti</button>
          </div>
        </Modal>

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Users className="h-6 w-6" />}
            label="Darbuotojų"
            value={employees.length}
            helper="rodyti visus aktyvios pareigybės darbuotojus"
            active={riskFilter === "all"}
            onClick={() => setRiskFilter("all")}
          />
          <StatCard
            icon={<AlertTriangle className="h-6 w-6" />}
            label="Trūksta mokymų"
            value={dashboard.nonCompliantEmployees}
            helper="filtras: darbuotojai su trūkumais"
            danger
            active={riskFilter === "missing"}
            onClick={() => setRiskFilter("missing")}
          />
          <StatCard
            icon={<CalendarDays className="h-6 w-6" />}
            label="Artėjantys terminai"
            value={dashboard.expiryRisks}
            helper="filtras: baigėsi arba artėja terminas"
            danger={dashboard.expiryRisks > 0}
            active={riskFilter === "expiry"}
            onClick={() => setRiskFilter("expiry")}
          />
          <StatCard
            icon={<Clock className="h-6 w-6" />}
            label="Surinkta val."
            value={dashboard.completedHours}
            helper="pagal išklausymo datas"
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle
                title="Padaliniai"
                subtitle="Filtruok pareigybes pagal padalinį."
                compact
              />
              <div className="space-y-2">
                {departments.map((department) => (
                  <button
                    key={department}
                    type="button"
                    onClick={() => setSelectedDepartment(department)}
                    className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-black transition ${selectedDepartment === department ? "bg-emerald-700 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                  >
                    {department}
                  </button>
                ))}
              </div>
            </section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle
                title="Pareigybės"
                subtitle="Sąrašas gali būti ilgas, todėl rodomas pagal padalinį."
                compact
              />
              <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
                {visibleRequirements.map((requirement) => (
                  <button
                    key={requirement.role}
                    type="button"
                    onClick={() => setSelectedRole(requirement.role)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${requirement.role === selectedRole ? "border-emerald-300 bg-emerald-50 shadow-sm ring-2 ring-emerald-100" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-black">
                          {requirement.role}
                        </div>
                        <div className="mt-1 text-sm font-bold text-slate-500">
                          {requirement.department}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                        {requirement.yearlyHours} val.
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle
                title="Paieška"
                subtitle="Mokymų sąrašo filtravimui."
                compact
              />
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ieškoti mokymų..."
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 font-bold outline-none focus:border-emerald-600"
                />
              </div>
            </section>
          </aside>

          <main className="min-w-0 space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <SectionTitle
                  title="Pareigybės reikalavimai"
                  subtitle="Privalomi mokymai, metinė valandų norma ir bendra mokymų apimtis."
                />
                <div className="grid grid-cols-3 gap-3 sm:min-w-[430px]">
                  <InfoTile
                    label="Metinė norma"
                    value={`${activeRequirement.yearlyHours} val.`}
                  />
                  <InfoTile
                    label="Priskirta"
                    value={`${activeRequiredIds.length}`}
                  />
                  <InfoTile
                    label="Valandų suma"
                    value={`${getRequiredHours(activeRequirement.role)} val.`}
                  />
                </div>
              </div>
              <div className="mt-2 rounded-[26px] border border-slate-200 bg-slate-50 p-5">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-2xl font-black">
                      {activeRequirement.role}
                    </h3>
                    <p className="mt-1 font-bold text-slate-500">
                      {activeRequirement.department}
                    </p>
                    <button
                      type="button"
                      onClick={() => startEditRole(activeRequirement.role)}
                      className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                    >
                      Redaguoti pareigybę
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(220px,360px)_auto]">
                    <div className="relative">
                      <select
                        value={selectedTraining}
                        onChange={(e) => setSelectedTraining(e.target.value)}
                        className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-10 font-bold outline-none focus:border-emerald-700"
                      >
                        <option value="">Pridėti mokymus</option>
                        {trainings.map((training) => (
                          <option key={training.id} value={training.id}>
                            {training.title}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                    <button
                      type="button"
                      onClick={addRequirement}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 font-black text-white hover:bg-emerald-800"
                    >
                      <Plus className="h-5 w-5" /> Pridėti
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignNewTrainingToRole(true);
                      setShowNewTrainingForm(true);
                    }}
                    className="text-left text-sm font-black text-emerald-700 hover:text-emerald-900"
                  >
                    Pridėti mokymus, kurių nėra sąraše
                  </button>
                </div>
                <RequirementGroup
                  title="Bendrieji visiems darbuotojams"
                  trainings={activeRequiredIds.filter(
                    (id) => getTraining(id)?.mandatoryForAll,
                  )}
                  getTraining={getTraining}
                />
                <RequirementGroup
                  title="Pareigybei privalomi mokymai"
                  trainings={activeRequirement.trainingIds}
                  getTraining={getTraining}
                  onRemove={(id) =>
                    removeRequirement(activeRequirement.role, id)
                  }
                />
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <SectionTitle
                  title="Mokymų sąrašas"
                  subtitle="Mokymų sritys, valandos ir galiojimo terminai."
                />
                <div className="overflow-hidden rounded-3xl border border-slate-200">
                  <div className="max-h-[520px] overflow-auto">
                    <table className="w-full min-w-[700px] text-left">
                      <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
                        <tr>
                          <Th>Mokymas</Th>
                          <Th>Kategorija</Th>
                          <Th>Val.</Th>
                          <Th>Galiojimas</Th>
                          <Th>Veiksmai</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTrainings.map((training) => (
                          <tr key={training.id} className="hover:bg-slate-50">
                            <Td strong>
                              <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                                  <GraduationCap className="h-4 w-4" />
                                </span>
                                <span>{training.title}</span>
                              </div>
                            </Td>
                            <Td>{training.category}</Td>
                            <Td strong>{training.hours}</Td>
                            <Td>
                              {training.validityMonths
                                ? `${training.validityMonths} mėn.`
                                : "Neterminuota"}
                            </Td>
                            <Td>
                              <button
                                type="button"
                                onClick={() => startEditTraining(training.id)}
                                className="rounded-full bg-slate-50 px-3 py-1 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-emerald-50 hover:text-emerald-800"
                              >
                                Redaguoti
                              </button>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <SectionTitle
                  title="Darbuotojų mokymų būklė"
                  subtitle={riskFilter === "missing" ? "Aktyvus filtras: rodomi tik darbuotojai, kuriems trūksta privalomų mokymų." : riskFilter === "expiry" ? "Aktyvus filtras: rodomi tik darbuotojai, kurių mokymų galiojimas pasibaigęs arba artėja prie pabaigos." : "Mokymai fiksuojami su išklausymo data, pagal ją skaičiuojamas galiojimas."}
                />
                <div className="space-y-4">
                  {filteredActiveRoleEmployees.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center font-bold text-slate-500">
                      {riskFilter === "all" ? "Šiai pareigybei darbuotojų dar nėra." : "Pagal pasirinktą filtrą šiai pareigybei neatitikimų nerasta."}
                    </div>
                  )}
                  {filteredActiveRoleEmployees.map((employee) => {
                    const missingIds = getMissingIds(employee);
                    const riskCount = getEmployeeExpiryRisk(employee).length;
                    const completedHours = getCompletedHours(employee);
                    const percent = Math.min(
                      Math.round(
                        (completedHours /
                          Math.max(activeRequirement.yearlyHours, 1)) *
                          100,
                      ),
                      100,
                    );
                    return (
                      <article
                        key={employee.id}
                        className="rounded-3xl border border-slate-200 p-5 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-xl font-black">
                              {employee.name}
                            </h3>
                            <p className="mt-1 font-bold text-slate-500">
                              {employee.department} · {employee.role}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {missingIds.length === 0 ? (
                              <CheckBadge />
                            ) : (
                              <MissingBadge count={missingIds.length} />
                            )}
                            {riskCount > 0 && <ExpiryBadge count={riskCount} />}
                          </div>
                        </div>
                        <div className="mt-5">
                          <div className="mb-2 flex justify-between text-sm font-black text-slate-600">
                            <span>
                              {completedHours} / {activeRequirement.yearlyHours}{" "}
                              val.
                            </span>
                            <span>{percent}%</span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-600"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                        <div className="mt-5 grid gap-2">
                          {activeRequiredIds.map((trainingId) => {
                            const training = getTraining(trainingId);
                            const record = getCompletedRecord(
                              employee,
                              trainingId,
                            );
                            const key = `${employee.id}:${trainingId}`;
                            const expiry = record
                              ? getExpiryInfo(record)
                              : null;
                            return (
                              <div
                                key={trainingId}
                                className="rounded-2xl bg-slate-50 px-4 py-3"
                              >
                                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                  <div className="min-w-0">
                                    <div className="truncate font-black">
                                      {training?.title || trainingId}
                                    </div>
                                    <div className="text-sm font-bold text-slate-500">
                                      {training?.hours || 0} val. ·{" "}
                                      {training?.category || "Kita"} ·{" "}
                                      {training?.validityMonths
                                        ? `${training.validityMonths} mėn.`
                                        : "neterminuota"}
                                    </div>
                                    {record && (
                                      <div className="mt-1 flex flex-wrap gap-2 text-sm font-black">
                                        <span className="text-slate-600">
                                          Išklausyta:{" "}
                                          {formatDate(record.completedAt)}
                                        </span>
                                        <StatusText
                                          status={expiry?.status || "valid"}
                                        >
                                          {expiry?.label}
                                        </StatusText>
                                      </div>
                                    )}
                                  </div>
                                  {record ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeCompletion(
                                          employee.id,
                                          trainingId,
                                        )
                                      }
                                      className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-black text-slate-600 ring-1 ring-slate-200 hover:text-red-600"
                                    >
                                      Nuimti
                                    </button>
                                  ) : (
                                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                                      <input
                                        type="date"
                                        value={
                                          completionDates[key] ||
                                          new Date().toISOString().slice(0, 10)
                                        }
                                        onChange={(e) =>
                                          setCompletionDates((prev) => ({
                                            ...prev,
                                            [key]: e.target.value,
                                          }))
                                        }
                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black outline-none focus:border-emerald-700"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          saveCompletion(
                                            employee.id,
                                            trainingId,
                                          )
                                        }
                                        className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-black text-white hover:bg-emerald-700"
                                      >
                                        Išsaugoti
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function RequirementGroup({
  title,
  trainings,
  getTraining,
  onRemove,
}: {
  title: string;
  trainings: string[];
  getTraining: (id: string) => Training | undefined;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {trainings.map((trainingId) => {
          const training = getTraining(trainingId);
          return (
            <span
              key={trainingId}
              className="inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-100"
            >
              <span className="truncate">
                {training?.title || trainingId} · {training?.hours || 0} val.
              </span>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(trainingId)}
                  className="shrink-0 rounded-full p-0.5 hover:bg-red-50 hover:text-red-600"
                  aria-label="Pašalinti mokymus"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Modal({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
}: {
  isOpen: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-5 shadow-2xl md:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <SectionTitle title={title} subtitle={subtitle} compact />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-600"
            aria-label="Uždaryti"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-3">{children}</div>
      </div>
    </div>
  );
}

function Input({
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
    <label className="grid gap-1 text-sm font-black text-slate-600">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-950 outline-none focus:border-emerald-700"
      />
    </label>
  );
}

function StatCard({
  icon,
  label,
  value,
  helper,
  danger = false,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  helper: string;
  danger?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const cardClass = `w-full rounded-[28px] border p-5 text-left shadow-sm transition ${
    danger ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"
  } ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : ""} ${
    active ? "ring-2 ring-emerald-600 ring-offset-2" : ""
  }`;

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div
          className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${danger ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {icon}
        </div>
        <BarChart3 className="h-5 w-5 text-slate-300" />
      </div>
      <div className="mt-5 text-4xl font-black tracking-tight">{value}</div>
      <div className="mt-1 text-lg font-black text-slate-600">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-400">{helper}</div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cardClass}>
        {content}
      </button>
    );
  }

  return <div className={cardClass}>{content}</div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
      <span className="font-bold text-slate-300">{label}</span>
      <span className="font-black text-white">{value}</span>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
      <div className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-lg font-black text-slate-900">{value}</div>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  compact = false,
}: {
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mb-4" : "mb-5"}>
      <h2
        className={`${compact ? "text-xl" : "text-2xl"} font-black tracking-tight`}
      >
        {title}
      </h2>
      <p className="mt-1 font-semibold text-slate-500">{subtitle}</p>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-5 py-4 text-sm font-black uppercase tracking-wide">
      {children}
    </th>
  );
}

function Td({
  children,
  strong = false,
}: {
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={`px-5 py-4 align-top ${strong ? "font-black" : "font-semibold text-slate-700"}`}
    >
      {children}
    </td>
  );
}

function CheckBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-700">
      <CheckCircle2 className="h-4 w-4" /> Atitinka
    </span>
  );
}

function MissingBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm font-black text-red-700">
      <AlertTriangle className="h-4 w-4" /> Trūksta {count}
    </span>
  );
}

function ExpiryBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800">
      <CalendarDays className="h-4 w-4" /> Terminai {count}
    </span>
  );
}

function StatusText({
  status,
  children,
}: {
  status: "valid" | "soon" | "expired";
  children: ReactNode;
}) {
  const className =
    status === "expired"
      ? "text-red-700"
      : status === "soon"
        ? "text-amber-700"
        : "text-emerald-700";
  return <span className={className}>{children}</span>;
}
