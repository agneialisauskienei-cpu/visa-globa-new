"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  GraduationCap,
  LayoutList,
  Library,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

type Department =
  | "Visi padaliniai"
  | "Administracija"
  | "Maitinimo paslaugos"
  | "Socialinė sritis"
  | "Sveikatos priežiūra"
  | "Ūkis";

type Training = {
  id: string;
  title: string;
  category: Department;
  hours: number;
  validityMonths: number | null;
  description: string;
  isCommon: boolean;
};

type Position = {
  id: string;
  title: string;
  department: Department;
  yearlyHours: number;
  assignedCount: number;
  requiredTrainingIds: string[];
};

type Employee = {
  id: string;
  name: string;
  department: Exclude<Department, "Visi padaliniai">;
  positionId: string;
  completedTrainingIds: string[];
  expiringTrainingIds: string[];
};

type EmployeeTrainingSubmission = {
  id: string;
  employeeId: string;
  trainingId: string;
  completedAt: string;
  note: string;
  status: "pending" | "approved" | "rejected";
};

type DrawerMode =
  | { type: "none" }
  | { type: "library" }
  | { type: "training"; trainingId: string | null }
  | { type: "position"; positionId: string }
  | { type: "requirement"; trainingId: string }
  | { type: "employee"; employeeId: string };

const departments: Department[] = [
  "Visi padaliniai",
  "Administracija",
  "Socialinė sritis",
  "Sveikatos priežiūra",
  "Maitinimo paslaugos",
  "Ūkis",
];

const initialTrainings: Training[] = [
  {
    id: "work-safety",
    title: "Darbų sauga",
    category: "Visi padaliniai",
    hours: 2,
    validityMonths: 12,
    description:
      "Bendras darbuotojų instruktavimas dėl saugaus darbo aplinkos reikalavimų.",
    isCommon: true,
  },
  {
    id: "fire-safety",
    title: "Gaisrinė sauga",
    category: "Visi padaliniai",
    hours: 2,
    validityMonths: 12,
    description: "Gaisrinės saugos instruktažas ir evakuacijos tvarka.",
    isCommon: true,
  },
  {
    id: "gdpr",
    title: "BDAR",
    category: "Visi padaliniai",
    hours: 1,
    validityMonths: 12,
    description:
      "Asmens duomenų apsauga, konfidencialumas ir saugus informacijos tvarkymas.",
    isCommon: true,
  },
  {
    id: "info-security",
    title: "Informacijos sauga",
    category: "Administracija",
    hours: 1,
    validityMonths: 12,
    description: "Prisijungimų, dokumentų ir vidinės informacijos sauga.",
    isCommon: false,
  },
  {
    id: "violence-prevention",
    title: "Smurto prevencija",
    category: "Socialinė sritis",
    hours: 2,
    validityMonths: 12,
    description:
      "Smurto, prievartos ir nepriežiūros atpažinimas bei reagavimo eiga.",
    isCommon: false,
  },
  {
    id: "intro-160",
    title: "160 val. įvadiniai mokymai",
    category: "Socialinė sritis",
    hours: 160,
    validityMonths: null,
    description:
      "Įvadiniai mokymai individualios priežiūros ir socialinės srities darbuotojams.",
    isCommon: false,
  },
  {
    id: "supervision",
    title: "Supervizijos / intervizijos",
    category: "Socialinė sritis",
    hours: 8,
    validityMonths: 12,
    description:
      "Profesinio palaikymo, refleksijos ir atvejų aptarimo valandos.",
    isCommon: false,
  },
  {
    id: "nursing-update",
    title: "Slaugos kompetencijų atnaujinimas",
    category: "Sveikatos priežiūra",
    hours: 16,
    validityMonths: 12,
    description:
      "Slaugos procedūrų, infekcijų kontrolės ir dokumentavimo atnaujinimas.",
    isCommon: false,
  },
  {
    id: "food-hygiene",
    title: "Maisto higiena",
    category: "Maitinimo paslaugos",
    hours: 4,
    validityMonths: 24,
    description: "Maisto saugos, higienos ir virtuvės darbo reikalavimai.",
    isCommon: false,
  },
  {
    id: "lifting-techniques",
    title: "Saugus kėlimas ir perkėlimas",
    category: "Sveikatos priežiūra",
    hours: 3,
    validityMonths: 12,
    description: "Gyventojų perkėlimo, kėlimo ir traumų prevencijos praktika.",
    isCommon: false,
  },
];

const initialPositions: Position[] = [
  {
    id: "director",
    title: "Direktorius",
    department: "Administracija",
    yearlyHours: 8,
    assignedCount: 1,
    requiredTrainingIds: ["info-security"],
  },
  {
    id: "administrator",
    title: "Administratorius",
    department: "Administracija",
    yearlyHours: 8,
    assignedCount: 4,
    requiredTrainingIds: ["info-security"],
  },
  {
    id: "social-worker",
    title: "Socialinis darbuotojas",
    department: "Socialinė sritis",
    yearlyHours: 24,
    assignedCount: 28,
    requiredTrainingIds: ["violence-prevention", "intro-160", "supervision"],
  },
  {
    id: "care-worker",
    title: "Individualios priežiūros darbuotojas",
    department: "Socialinė sritis",
    yearlyHours: 16,
    assignedCount: 96,
    requiredTrainingIds: ["intro-160", "violence-prevention"],
  },
  {
    id: "nurse",
    title: "Bendrosios praktikos slaugytojas",
    department: "Sveikatos priežiūra",
    yearlyHours: 24,
    assignedCount: 18,
    requiredTrainingIds: ["nursing-update", "lifting-techniques"],
  },
  {
    id: "health-assistant",
    title: "Asmens sveikatos priežiūros padėjėjas",
    department: "Sveikatos priežiūra",
    yearlyHours: 16,
    assignedCount: 16,
    requiredTrainingIds: ["lifting-techniques"],
  },
  {
    id: "cook",
    title: "Virėjas",
    department: "Maitinimo paslaugos",
    yearlyHours: 8,
    assignedCount: 10,
    requiredTrainingIds: ["food-hygiene"],
  },
  {
    id: "kitchen-worker",
    title: "Virtuvės darbininkas",
    department: "Maitinimo paslaugos",
    yearlyHours: 8,
    assignedCount: 12,
    requiredTrainingIds: ["food-hygiene"],
  },
  {
    id: "maintenance",
    title: "Pastatų priežiūros specialistas",
    department: "Ūkis",
    yearlyHours: 8,
    assignedCount: 7,
    requiredTrainingIds: [],
  },
];

const names = [
  "Jonas Jonaitis",
  "Ona Onaitė",
  "Asta Petrauskė",
  "Ieva Kazlauskaitė",
  "Rasa Žukauskienė",
  "Tomas Stankevičius",
  "Greta Paulauskaitė",
  "Mantas Vaitkus",
  "Lina Jankauskienė",
  "Dalia Kavaliauskaitė",
  "Saulius Butkus",
  "Eglė Rimkutė",
];

const generatedEmployees: Employee[] = Array.from(
  { length: 300 },
  (_, index) => {
    const position = initialPositions[index % initialPositions.length];
    const required = [
      "work-safety",
      "fire-safety",
      "gdpr",
      ...position.requiredTrainingIds,
    ];
    const completedTrainingIds = required.filter(
      (_, trainingIndex) => (index + trainingIndex) % 4 !== 0,
    );
    const expiringTrainingIds = required.filter(
      (_, trainingIndex) => (index + trainingIndex) % 9 === 0,
    );

    return {
      id: `employee-${index + 1}`,
      name: `${names[index % names.length]} ${index + 1}`,
      department: position.department as Exclude<Department, "Visi padaliniai">,
      positionId: position.id,
      completedTrainingIds,
      expiringTrainingIds,
    };
  },
);

const initialEmployeeSubmissions: EmployeeTrainingSubmission[] = [
  {
    id: "submission-1",
    employeeId: "employee-2",
    trainingId: "food-hygiene",
    completedAt: "2026-05-02",
    note: "Darbuotoja suvedė mokymo datą savo paskyroje. Admin turi patvirtinti, kad matė duomenis.",
    status: "pending",
  },
  {
    id: "submission-2",
    employeeId: "employee-6",
    trainingId: "work-safety",
    completedAt: "2026-05-06",
    note: "Darbuotojas pateikė informaciją be failo. Reikia administratoriaus patvirtinimo.",
    status: "pending",
  },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function validityLabel(months: number | null) {
  if (!months) return "Neterminuota";
  return `${months} mėn.`;
}

function pageNumbers(current: number, total: number) {
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
}

export default function TrainingModule() {
  const [trainings, setTrainings] = useState<Training[]>(initialTrainings);
  const [positions, setPositions] = useState<Position[]>(initialPositions);
  const [employees] = useState<Employee[]>(generatedEmployees);
  const [adminApprovedTrainings, setAdminApprovedTrainings] = useState<
    Record<string, string[]>
  >({});
  const [employeeSubmissions, setEmployeeSubmissions] = useState<
    EmployeeTrainingSubmission[]
  >(initialEmployeeSubmissions);

  const [selectedDepartment, setSelectedDepartment] =
    useState<Department>("Visi padaliniai");
  const [selectedPositionId, setSelectedPositionId] = useState("social-worker");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "missing" | "expiring" | "ok"
  >("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawer, setDrawer] = useState<DrawerMode>({ type: "none" });

  const commonTrainings = useMemo(
    () => trainings.filter((training) => training.isCommon),
    [trainings],
  );

  const employeesWithApprovedTrainings = useMemo(() => {
    return employees.map((employee) => {
      const manuallyApproved = adminApprovedTrainings[employee.id] ?? [];
      const approvedFromEmployeeSubmissions = employeeSubmissions
        .filter(
          (submission) =>
            submission.employeeId === employee.id &&
            submission.status === "approved",
        )
        .map((submission) => submission.trainingId);
      const completedTrainingIds = Array.from(
        new Set([
          ...employee.completedTrainingIds,
          ...manuallyApproved,
          ...approvedFromEmployeeSubmissions,
        ]),
      );

      return { ...employee, completedTrainingIds };
    });
  }, [adminApprovedTrainings, employeeSubmissions, employees]);

  const pendingSubmissionCount = employeeSubmissions.filter(
    (submission) => submission.status === "pending",
  ).length;

  const filteredPositions = useMemo(() => {
    return positions.filter((position) => {
      return (
        selectedDepartment === "Visi padaliniai" ||
        position.department === selectedDepartment
      );
    });
  }, [positions, selectedDepartment]);

  const selectedPosition =
    positions.find((position) => position.id === selectedPositionId) ??
    filteredPositions[0] ??
    positions[0];

  const selectedRequiredTrainings = useMemo(() => {
    return trainings.filter((training) =>
      selectedPosition.requiredTrainingIds.includes(training.id),
    );
  }, [selectedPosition.requiredTrainingIds, trainings]);

  const requiredTrainingIdsByPosition = useMemo(() => {
    const map = new Map<string, string[]>();
    positions.forEach((position) => {
      map.set(position.id, [
        ...commonTrainings.map((training) => training.id),
        ...position.requiredTrainingIds,
      ]);
    });
    return map;
  }, [commonTrainings, positions]);

  const employeeRows = useMemo(() => {
    return employees.map((employee) => {
      const position = positions.find(
        (item) => item.id === employee.positionId,
      );
      const requiredIds =
        requiredTrainingIdsByPosition.get(employee.positionId) ?? [];
      const completedRequired = employee.completedTrainingIds.filter((id) =>
        requiredIds.includes(id),
      );
      const missingIds = requiredIds.filter(
        (id) => !employee.completedTrainingIds.includes(id),
      );
      const completedHours = trainings
        .filter((training) => completedRequired.includes(training.id))
        .reduce((sum, training) => sum + training.hours, 0);
      const requiredHours = trainings
        .filter((training) => requiredIds.includes(training.id))
        .reduce((sum, training) => sum + training.hours, 0);
      const progress =
        requiredHours > 0
          ? Math.round((completedHours / requiredHours) * 100)
          : 100;

      return {
        ...employee,
        positionTitle: position?.title ?? "Nepriskirta",
        requiredIds,
        missingIds,
        completedHours,
        requiredHours,
        progress: Math.min(100, progress),
      };
    });
  }, [
    employeesWithApprovedTrainings,
    positions,
    requiredTrainingIdsByPosition,
    trainings,
  ]);

  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();

    return employeeRows.filter((employee) => {
      const matchesDepartment =
        selectedDepartment === "Visi padaliniai" ||
        employee.department === selectedDepartment;
      const matchesSearch =
        !query ||
        employee.name.toLowerCase().includes(query) ||
        employee.positionTitle.toLowerCase().includes(query) ||
        employee.department.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "missing" && employee.missingIds.length > 0) ||
        (statusFilter === "expiring" &&
          employee.expiringTrainingIds.length > 0) ||
        (statusFilter === "ok" &&
          employee.missingIds.length === 0 &&
          employee.expiringTrainingIds.length === 0);

      return matchesDepartment && matchesSearch && matchesStatus;
    });
  }, [employeeRows, employeeSearch, selectedDepartment, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEmployees.length / pageSize),
  );
  const visibleEmployees = filteredEmployees.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const missingEmployees = employeeRows.filter(
    (employee) => employee.missingIds.length > 0,
  ).length;
  const expiringEmployees = employeeRows.filter(
    (employee) => employee.expiringTrainingIds.length > 0,
  ).length;
  const completedHours = employeeRows.reduce(
    (sum, employee) => sum + employee.completedHours,
    0,
  );
  const requiredHours = employeeRows.reduce(
    (sum, employee) => sum + employee.requiredHours,
    0,
  );
  const completionPercent =
    requiredHours > 0 ? Math.round((completedHours / requiredHours) * 100) : 0;

  function selectDepartment(department: Department) {
    setSelectedDepartment(department);
    setPage(1);
    const firstPosition = positions.find(
      (position) =>
        department === "Visi padaliniai" || position.department === department,
    );
    if (firstPosition) setSelectedPositionId(firstPosition.id);
  }

  function saveTraining(nextTraining: Training) {
    setTrainings((current) => {
      const exists = current.some(
        (training) => training.id === nextTraining.id,
      );
      if (exists)
        return current.map((training) =>
          training.id === nextTraining.id ? nextTraining : training,
        );
      return [nextTraining, ...current];
    });
    setDrawer({ type: "none" });
  }

  function savePosition(nextPosition: Position) {
    setPositions((current) =>
      current.map((position) =>
        position.id === nextPosition.id ? nextPosition : position,
      ),
    );
    setDrawer({ type: "none" });
  }

  function approveEmployeeTraining(
    employeeId: string,
    trainingId: string,
    submissionId?: string,
  ) {
    setAdminApprovedTrainings((current) => {
      const currentIds = current[employeeId] ?? [];
      return {
        ...current,
        [employeeId]: Array.from(new Set([...currentIds, trainingId])),
      };
    });

    if (submissionId) {
      setEmployeeSubmissions((current) =>
        current.map((submission) =>
          submission.id === submissionId
            ? { ...submission, status: "approved" }
            : submission,
        ),
      );
    }
  }

  function rejectEmployeeSubmission(submissionId: string) {
    setEmployeeSubmissions((current) =>
      current.map((submission) =>
        submission.id === submissionId
          ? { ...submission, status: "rejected" }
          : submission,
      ),
    );
  }

  return (
    <section className="mx-auto w-full max-w-[1480px] space-y-6 px-1">
      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          value={String(employees.length)}
          title="Darbuotojų"
          description="Aktyvūs darbuotojai"
          active
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          value={String(missingEmployees)}
          title="Trūksta mokymų"
          description="Darbuotojai su trūkumais"
          danger
        />
        <StatCard
          icon={<CalendarDays className="h-5 w-5" />}
          value={String(expiringEmployees)}
          title="Artėjantys terminai"
          description="Baigiasi galiojimas"
          warning
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          value={`${completionPercent}%`}
          title="Užbaigimas"
          description="Pagal privalomas valandas"
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Card>
            <h3 className="text-xl font-black text-slate-950">Padaliniai</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Filtruok pareigybes ir darbuotojus.
            </p>
            <div className="mt-5 space-y-2">
              {departments.map((department) => (
                <button
                  key={department}
                  type="button"
                  onClick={() => selectDepartment(department)}
                  className={cn(
                    "h-12 w-full rounded-2xl px-4 text-left text-sm font-black transition",
                    selectedDepartment === department
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {department}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-black text-slate-950">Pareigybės</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Pasirink pareigybę reikalavimams.
            </p>
            <div className="mt-4 max-h-[520px] space-y-3 overflow-auto pr-1">
              {filteredPositions.map((position) => (
                <button
                  key={position.id}
                  type="button"
                  onClick={() => setSelectedPositionId(position.id)}
                  className={cn(
                    "w-full rounded-3xl border p-4 text-left transition",
                    selectedPosition.id === position.id
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-white hover:bg-slate-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-black leading-tight text-slate-950">
                        {position.title}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        {position.department}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-700">
                      {position.yearlyHours} val.
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </aside>

        <main className="min-w-0 space-y-6">
          <Card>
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-start">
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                  Pareigybės reikalavimai
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                  {selectedPosition.title}
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {selectedPosition.department}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 2xl:w-[430px]">
                <MiniStat
                  label="Metinė norma"
                  value={`${selectedPosition.yearlyHours} val.`}
                />
                <MiniStat
                  label="Priskirta"
                  value={String(selectedPosition.assignedCount)}
                />
                <MiniStat
                  label="Mokymų suma"
                  value={`${[...commonTrainings, ...selectedRequiredTrainings].reduce((sum, training) => sum + training.hours, 0)} val.`}
                />
              </div>
            </div>

            <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-center">
                <div>
                  <h3 className="text-xl font-black text-slate-950">
                    Privalomi mokymai
                  </h3>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    Bendri visiems darbuotojams ir papildomi pagal pareigybę.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setDrawer({ type: "library" })}
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-[20px] border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    <Library className="h-4 w-4" />
                    Biblioteka
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDrawer({ type: "training", trainingId: null })
                    }
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-[20px] bg-emerald-700 px-5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
                  >
                    <Plus className="h-4 w-4" />
                    Naujas
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDrawer({
                        type: "position",
                        positionId: selectedPosition.id,
                      })
                    }
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-[20px] border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    <Edit3 className="h-4 w-4" />
                    Pareigybė
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <TrainingPills
                  title="Bendrieji visiems darbuotojams"
                  trainings={commonTrainings}
                  onOpen={(trainingId) =>
                    setDrawer({ type: "requirement", trainingId })
                  }
                />
                <TrainingPills
                  title="Pareigybei privalomi mokymai"
                  trainings={selectedRequiredTrainings}
                  onOpen={(trainingId) =>
                    setDrawer({ type: "requirement", trainingId })
                  }
                />
              </div>
            </div>
          </Card>

          <Card>
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-start">
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-emerald-700">
                  Darbuotojų mokymai
                </p>
                <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                  Būklė pagal darbuotojus
                </h3>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Rodoma puslapiais, kad būtų patogu dirbti su 300+ darbuotojų.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <FilterButton
                  active={statusFilter === "all"}
                  onClick={() => {
                    setStatusFilter("all");
                    setPage(1);
                  }}
                >
                  Visi
                </FilterButton>
                <FilterButton
                  active={statusFilter === "missing"}
                  onClick={() => {
                    setStatusFilter("missing");
                    setPage(1);
                  }}
                >
                  Trūksta
                </FilterButton>
                <FilterButton
                  active={statusFilter === "expiring"}
                  onClick={() => {
                    setStatusFilter("expiring");
                    setPage(1);
                  }}
                >
                  Baigiasi
                </FilterButton>
                <FilterButton
                  active={statusFilter === "ok"}
                  onClick={() => {
                    setStatusFilter("ok");
                    setPage(1);
                  }}
                >
                  Tvarkingi
                </FilterButton>
              </div>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={employeeSearch}
                  onChange={(event) => {
                    setEmployeeSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Ieškoti darbuotojo, pareigų arba padalinio..."
                  className="h-13 w-full rounded-[20px] border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold outline-none transition focus:border-emerald-300 focus:bg-white"
                />
              </div>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="h-13 rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none focus:border-emerald-300"
              >
                <option value={25}>25 eilutės</option>
                <option value={50}>50 eilučių</option>
              </select>
            </div>

            <div className="mt-5 overflow-x-auto rounded-[28px] border border-slate-200 bg-white">
              <div className="hidden min-w-[940px] grid-cols-[minmax(220px,1.2fr)_minmax(190px,1fr)_120px_130px_110px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500 xl:grid">
                <span>Darbuotojas</span>
                <span>Pareigos</span>
                <span>Trūksta</span>
                <span>Progresas</span>
                <span className="text-right">Veiksmas</span>
              </div>

              {visibleEmployees.map((employee, index) => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() =>
                    setDrawer({ type: "employee", employeeId: employee.id })
                  }
                  className={cn(
                    "grid w-full gap-4 px-5 py-4 text-left transition hover:bg-slate-50 min-w-[940px] xl:grid-cols-[minmax(220px,1.2fr)_minmax(190px,1fr)_120px_130px_110px] xl:items-center",
                    index !== 0 && "border-t border-slate-100",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-700">
                      {initials(employee.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-slate-950">
                        {employee.name}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        {employee.department}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800">
                      {employee.positionTitle}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {employee.requiredIds.length} privalomi mokymai
                    </p>
                  </div>
                  <div>
                    {employee.missingIds.length > 0 ? (
                      <StatusBadge
                        danger
                        icon={<AlertTriangle className="h-3.5 w-3.5" />}
                      >
                        {employee.missingIds.length} mok.
                      </StatusBadge>
                    ) : (
                      <StatusBadge
                        success
                        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      >
                        Tvarkinga
                      </StatusBadge>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800">
                      {employee.progress}%
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          employee.progress >= 100
                            ? "bg-emerald-600"
                            : employee.progress >= 60
                              ? "bg-amber-500"
                              : "bg-rose-500",
                        )}
                        style={{ width: `${employee.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right text-sm font-black text-emerald-700">
                    Atidaryti
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-slate-500">
                Rodoma {visibleEmployees.length} iš {filteredEmployees.length}{" "}
                darbuotojų
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {pageNumbers(page, totalPages).map(
                  (pageNumber, index, pages) => (
                    <span key={pageNumber} className="flex items-center gap-2">
                      {index > 0 && pageNumber - pages[index - 1] > 1 ? (
                        <span className="text-sm font-black text-slate-400">
                          ...
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setPage(pageNumber)}
                        className={cn(
                          "h-10 min-w-10 rounded-2xl px-3 text-sm font-black",
                          page === pageNumber
                            ? "bg-emerald-700 text-white"
                            : "border border-slate-200 bg-white text-slate-700",
                        )}
                      >
                        {pageNumber}
                      </button>
                    </span>
                  ),
                )}
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>
        </main>
      </div>

      <Drawer
        drawer={drawer}
        trainings={trainings}
        positions={positions}
        employees={employeeRows}
        commonTrainings={commonTrainings}
        onClose={() => setDrawer({ type: "none" })}
        onEditTraining={(trainingId) =>
          setDrawer({ type: "training", trainingId })
        }
        onSaveTraining={saveTraining}
        onSavePosition={savePosition}
        employeeSubmissions={employeeSubmissions}
        onApproveEmployeeTraining={approveEmployeeTraining}
        onRejectEmployeeSubmission={rejectEmployeeSubmission}
      />
    </section>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[32px] border border-slate-200 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function StatCard({
  icon,
  value,
  title,
  description,
  active,
  danger,
  warning,
}: {
  icon: React.ReactNode;
  value: string;
  title: string;
  description: string;
  active?: boolean;
  danger?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[190px] flex-col justify-between overflow-hidden rounded-[32px] border bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-md",
        active && "border-emerald-500 ring-1 ring-emerald-500",
        danger && "border-rose-200",
        warning && "border-amber-200",
        !active && !danger && !warning && "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl",
            danger
              ? "bg-rose-100 text-rose-700"
              : warning
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-50 text-emerald-700",
          )}
        >
          {icon}
        </div>
        <LayoutList className="h-5 w-5 text-slate-300" />
      </div>
      <div>
        <p className="text-4xl font-black tracking-tight text-slate-950">
          {value}
        </p>
        <p className="mt-1 text-lg font-black text-slate-800">{title}</p>
        <p className="mt-1 text-sm font-bold text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[76px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function FilterButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-black transition",
        active
          ? "bg-emerald-700 text-white"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

function StatusBadge({
  children,
  icon,
  danger,
  warning,
  success,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  danger?: boolean;
  warning?: boolean;
  success?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black",
        danger && "bg-rose-50 text-rose-700",
        warning && "bg-amber-50 text-amber-700",
        success && "bg-emerald-50 text-emerald-700",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function TrainingPills({
  title,
  trainings,
  onOpen,
}: {
  title: string;
  trainings: Training[];
  onOpen: (trainingId: string) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {trainings.length > 0 ? (
          trainings.map((training) => (
            <button
              key={training.id}
              type="button"
              onClick={() => onOpen(training.id)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-800 transition hover:bg-emerald-100"
            >
              <ShieldCheck className="h-4 w-4" />
              {training.title} · {training.hours} val.
            </button>
          ))
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-500">
            Nėra priskirtų mokymų
          </span>
        )}
      </div>
    </div>
  );
}

function Drawer({
  drawer,
  trainings,
  positions,
  employees,
  commonTrainings,
  onClose,
  onEditTraining,
  onSaveTraining,
  onSavePosition,
  employeeSubmissions,
  onApproveEmployeeTraining,
  onRejectEmployeeSubmission,
}: {
  drawer: DrawerMode;
  trainings: Training[];
  positions: Position[];
  employees: Array<
    Employee & {
      positionTitle: string;
      requiredIds: string[];
      missingIds: string[];
      completedHours: number;
      requiredHours: number;
      progress: number;
    }
  >;
  commonTrainings: Training[];
  onClose: () => void;
  onEditTraining: (trainingId: string) => void;
  onSaveTraining: (training: Training) => void;
  onSavePosition: (position: Position) => void;
  employeeSubmissions: EmployeeTrainingSubmission[];
  onApproveEmployeeTraining: (
    employeeId: string,
    trainingId: string,
    submissionId?: string,
  ) => void;
  onRejectEmployeeSubmission: (submissionId: string) => void;
}) {
  if (drawer.type === "none") return null;

  const training =
    drawer.type === "training" && drawer.trainingId
      ? (trainings.find((item) => item.id === drawer.trainingId) ?? null)
      : null;
  const requirement =
    drawer.type === "requirement"
      ? trainings.find((item) => item.id === drawer.trainingId)
      : null;
  const employee =
    drawer.type === "employee"
      ? employees.find((item) => item.id === drawer.employeeId)
      : null;
  const position =
    drawer.type === "position"
      ? positions.find((item) => item.id === drawer.positionId)
      : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30">
      <button
        type="button"
        aria-label="Uždaryti"
        onClick={onClose}
        className="absolute inset-0 h-full w-full"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[960px] flex-col overflow-hidden rounded-l-[32px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-7">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-700">
              Mokymai
            </p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">
              {drawer.type === "library" && "Mokymų biblioteka"}
              {drawer.type === "training" &&
                (training ? "Redaguoti mokymą" : "Naujas mokymas")}
              {drawer.type === "position" && "Redaguoti pareigybę"}
              {drawer.type === "requirement" && requirement?.title}
              {drawer.type === "employee" && employee?.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-7">
          {drawer.type === "library" ? (
            <LibraryPanel trainings={trainings} onEdit={onEditTraining} />
          ) : null}
          {drawer.type === "training" ? (
            <TrainingForm
              training={training}
              onCancel={onClose}
              onSave={onSaveTraining}
            />
          ) : null}
          {drawer.type === "position" && position ? (
            <PositionForm
              position={position}
              trainings={trainings}
              commonTrainings={commonTrainings}
              onCancel={onClose}
              onSave={onSavePosition}
            />
          ) : null}
          {drawer.type === "requirement" && requirement ? (
            <RequirementPanel
              training={requirement}
              employees={employees}
              positions={positions}
            />
          ) : null}
          {drawer.type === "employee" && employee ? (
            <EmployeePanel
              employee={employee}
              trainings={trainings}
              submissions={employeeSubmissions.filter(
                (submission) => submission.employeeId === employee.id,
              )}
              onApproveTraining={onApproveEmployeeTraining}
              onRejectSubmission={onRejectEmployeeSubmission}
            />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function LibraryPanel({
  trainings,
  onEdit,
}: {
  trainings: Training[];
  onEdit: (trainingId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = trainings.filter((training) =>
    training.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ieškoti mokymo..."
          className="h-13 w-full rounded-[20px] border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold outline-none transition focus:border-emerald-300 focus:bg-white"
        />
      </div>
      <div className="mt-5 space-y-3">
        {filtered.map((training) => (
          <button
            key={training.id}
            type="button"
            onClick={() => onEdit(training.id)}
            className="flex w-full items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-black text-slate-950">
                  {training.title}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {training.category} · {training.hours} val. ·{" "}
                  {validityLabel(training.validityMonths)}
                </p>
              </div>
            </div>
            <Edit3 className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

function TrainingForm({
  training,
  onCancel,
  onSave,
}: {
  training: Training | null;
  onCancel: () => void;
  onSave: (training: Training) => void;
}) {
  const [title, setTitle] = useState(training?.title ?? "");
  const [category, setCategory] = useState<Department>(
    training?.category ?? "Visi padaliniai",
  );
  const [hours, setHours] = useState(String(training?.hours ?? 1));
  const [validityMonths, setValidityMonths] = useState(
    training?.validityMonths ? String(training.validityMonths) : "",
  );
  const [description, setDescription] = useState(training?.description ?? "");
  const [isCommon, setIsCommon] = useState(training?.isCommon ?? false);

  function submit() {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    onSave({
      id:
        training?.id ??
        `${cleanTitle
          .toLowerCase()
          .replaceAll(" ", "-")
          .replace(/[^a-z0-9-]/g, "")}-${Date.now()}`,
      title: cleanTitle,
      category: isCommon ? "Visi padaliniai" : category,
      hours: Number(hours) || 0,
      validityMonths: validityMonths.trim()
        ? Number(validityMonths) || null
        : null,
      description: description.trim(),
      isCommon,
    });
  }

  return (
    <div className="space-y-5">
      <label className="grid gap-2 text-sm font-black text-slate-700">
        Pavadinimas
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-12 rounded-2xl border border-slate-200 px-4 font-bold outline-none focus:border-emerald-300"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-black text-slate-700">
          Valandos
          <input
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            type="number"
            min="0"
            className="h-12 rounded-2xl border border-slate-200 px-4 font-bold outline-none focus:border-emerald-300"
          />
        </label>
        <label className="grid gap-2 text-sm font-black text-slate-700">
          Galiojimas mėn.
          <input
            value={validityMonths}
            onChange={(event) => setValidityMonths(event.target.value)}
            type="number"
            min="0"
            placeholder="Tuščia = neterminuota"
            className="h-12 rounded-2xl border border-slate-200 px-4 font-bold outline-none focus:border-emerald-300"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-black text-slate-700">
        Padalinys
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as Department)}
          disabled={isCommon}
          className="h-12 rounded-2xl border border-slate-200 px-4 font-bold outline-none focus:border-emerald-300 disabled:bg-slate-100"
        >
          {departments.map((department) => (
            <option key={department}>{department}</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-700">
        <input
          type="checkbox"
          checked={isCommon}
          onChange={(event) => setIsCommon(event.target.checked)}
          className="h-4 w-4 accent-emerald-700"
        />
        Bendras visiems darbuotojams
      </label>

      <label className="grid gap-2 text-sm font-black text-slate-700">
        Aprašymas
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={5}
          className="rounded-2xl border border-slate-200 p-4 font-bold outline-none focus:border-emerald-300"
        />
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 rounded-2xl border border-slate-200 px-5 text-sm font-black text-slate-700 hover:bg-slate-50"
        >
          Atšaukti
        </button>
        <button
          type="button"
          onClick={submit}
          className="h-12 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800"
        >
          Išsaugoti
        </button>
      </div>
    </div>
  );
}

function PositionForm({
  position,
  trainings,
  commonTrainings,
  onCancel,
  onSave,
}: {
  position: Position;
  trainings: Training[];
  commonTrainings: Training[];
  onCancel: () => void;
  onSave: (position: Position) => void;
}) {
  const [yearlyHours, setYearlyHours] = useState(String(position.yearlyHours));
  const [requiredTrainingIds, setRequiredTrainingIds] = useState<string[]>(
    position.requiredTrainingIds,
  );
  const editableTrainings = trainings.filter(
    (training) =>
      !training.isCommon &&
      (training.category === position.department ||
        training.category === "Visi padaliniai"),
  );

  function toggleTraining(id: string) {
    setRequiredTrainingIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
        <p className="text-lg font-black text-slate-950">{position.title}</p>
        <p className="mt-1 text-sm font-bold text-slate-500">
          {position.department}
        </p>
      </div>

      <label className="grid gap-2 text-sm font-black text-slate-700">
        Metinė norma
        <input
          value={yearlyHours}
          onChange={(event) => setYearlyHours(event.target.value)}
          type="number"
          min="0"
          className="h-12 rounded-2xl border border-slate-200 px-4 font-bold outline-none focus:border-emerald-300"
        />
      </label>

      <div>
        <p className="text-sm font-black uppercase tracking-widest text-slate-500">
          Bendrieji mokymai
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {commonTrainings.map((training) => (
            <span
              key={training.id}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-50 px-4 text-sm font-black text-emerald-800"
            >
              <ShieldCheck className="h-4 w-4" />
              {training.title}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-black uppercase tracking-widest text-slate-500">
          Pareigybei privalomi mokymai
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {editableTrainings.map((training) => (
            <button
              key={training.id}
              type="button"
              onClick={() => toggleTraining(training.id)}
              className={cn(
                "rounded-2xl border p-4 text-left transition",
                requiredTrainingIds.includes(training.id)
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-200 bg-white hover:bg-slate-50",
              )}
            >
              <p className="text-sm font-black text-slate-950">
                {training.title}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {training.hours} val. · {validityLabel(training.validityMonths)}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 rounded-2xl border border-slate-200 px-5 text-sm font-black text-slate-700 hover:bg-slate-50"
        >
          Atšaukti
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              ...position,
              yearlyHours: Number(yearlyHours) || 0,
              requiredTrainingIds,
            })
          }
          className="h-12 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800"
        >
          Išsaugoti
        </button>
      </div>
    </div>
  );
}

function RequirementPanel({
  training,
  employees,
  positions,
}: {
  training: Training;
  employees: Array<
    Employee & {
      positionTitle: string;
      requiredIds: string[];
      missingIds: string[];
      completedHours: number;
      requiredHours: number;
      progress: number;
    }
  >;
  positions: Position[];
}) {
  const assignedPositions = training.isCommon
    ? positions
    : positions.filter((position) =>
        position.requiredTrainingIds.includes(training.id),
      );
  const requiredEmployees = employees.filter((employee) =>
    employee.requiredIds.includes(training.id),
  );
  const missingEmployees = requiredEmployees.filter((employee) =>
    employee.missingIds.includes(training.id),
  );

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-950">
              {training.title}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {training.hours} val. · {validityLabel(training.validityMonths)}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm font-bold leading-6 text-slate-600">
          {training.description}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat
          label="Priskirta pareigų"
          value={String(assignedPositions.length)}
        />
        <MiniStat label="Darbuotojų" value={String(requiredEmployees.length)} />
        <MiniStat label="Trūksta" value={String(missingEmployees.length)} />
      </div>

      <div>
        <p className="text-sm font-black uppercase tracking-widest text-slate-500">
          Kam priskirta
        </p>
        <div className="mt-3 space-y-2">
          {assignedPositions.map((position) => (
            <div
              key={position.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <p className="text-sm font-black text-slate-950">
                {position.title}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {position.department}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-black uppercase tracking-widest text-slate-500">
          Darbuotojai, kuriems trūksta
        </p>
        <div className="mt-3 max-h-[280px] space-y-2 overflow-auto pr-1">
          {missingEmployees.length > 0 ? (
            missingEmployees.slice(0, 30).map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-rose-100 bg-rose-50 p-4"
              >
                <div>
                  <p className="text-sm font-black text-slate-950">
                    {employee.name}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {employee.positionTitle}
                  </p>
                </div>
                <AlertTriangle className="h-4 w-4 text-rose-600" />
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-800">
              Visi darbuotojai turi šį mokymą.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmployeePanel({
  employee,
  trainings,
  submissions,
  onApproveTraining,
  onRejectSubmission,
}: {
  employee: Employee & {
    positionTitle: string;
    requiredIds: string[];
    missingIds: string[];
    completedHours: number;
    requiredHours: number;
    progress: number;
  };
  trainings: Training[];
  submissions: EmployeeTrainingSubmission[];
  onApproveTraining: (
    employeeId: string,
    trainingId: string,
    submissionId?: string,
  ) => void;
  onRejectSubmission: (submissionId: string) => void;
}) {
  const requiredTrainings = trainings.filter((training) =>
    employee.requiredIds.includes(training.id),
  );
  const missingTrainings = requiredTrainings.filter((training) =>
    employee.missingIds.includes(training.id),
  );
  const pendingSubmissions = submissions.filter(
    (submission) => submission.status === "pending",
  );
  const [selectedTrainingId, setSelectedTrainingId] = useState(
    missingTrainings[0]?.id ?? requiredTrainings[0]?.id ?? "",
  );

  function approveSelectedTraining() {
    if (!selectedTrainingId) return;
    onApproveTraining(employee.id, selectedTrainingId);
    const nextMissing = missingTrainings.find(
      (training) => training.id !== selectedTrainingId,
    );
    if (nextMissing) setSelectedTrainingId(nextMissing.id);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
        <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-base font-black text-slate-700 shadow-sm">
            {initials(employee.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-slate-950">
              {employee.name}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {employee.department} · {employee.positionTitle}
            </p>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm font-black">
                <span className="text-slate-700">
                  {employee.completedHours} / {employee.requiredHours} val.
                </span>
                <span className="text-slate-500">{employee.progress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full",
                    employee.progress >= 100
                      ? "bg-emerald-600"
                      : employee.progress >= 60
                        ? "bg-amber-500"
                        : "bg-rose-500",
                  )}
                  style={{ width: `${employee.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat
          label="Privaloma"
          value={String(employee.requiredIds.length)}
        />
        <MiniStat label="Trūksta" value={String(employee.missingIds.length)} />
        <MiniStat
          label="Laukia tvirtinimo"
          value={String(pendingSubmissions.length)}
        />
      </div>

      <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-emerald-700">
              Pridėti mokymą darbuotojui
            </p>
            <p className="mt-1 text-sm font-bold leading-6 text-emerald-900/70">
              Admin pažymi mokymą kaip matytą ir patvirtintą. Tik po šio
              patvirtinimo mokymas įsiskaito į progresą.
            </p>
            <select
              value={selectedTrainingId}
              onChange={(event) => setSelectedTrainingId(event.target.value)}
              className="mt-4 h-12 w-full rounded-2xl border border-emerald-200 bg-white px-4 text-sm font-black text-slate-800 outline-none focus:border-emerald-400"
            >
              {requiredTrainings.map((training) => (
                <option key={training.id} value={training.id}>
                  {training.title} · {training.hours} val.
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={approveSelectedTraining}
            disabled={
              !selectedTrainingId ||
              employee.completedTrainingIds.includes(selectedTrainingId)
            }
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Patvirtinti mokymą
          </button>
        </div>
      </div>

      {pendingSubmissions.length > 0 ? (
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-slate-500">
            Darbuotojo pateikti duomenys
          </p>
          <div className="mt-3 space-y-3">
            {pendingSubmissions.map((submission) => {
              const training = trainings.find(
                (item) => item.id === submission.trainingId,
              );
              if (!training) return null;

              return (
                <div
                  key={submission.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {training.title}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        Išklausyta: {submission.completedAt}
                      </p>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                        {submission.note}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <button
                        type="button"
                        onClick={() => onRejectSubmission(submission.id)}
                        className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50"
                      >
                        Atmesti
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onApproveTraining(
                            employee.id,
                            submission.trainingId,
                            submission.id,
                          )
                        }
                        className="h-10 rounded-2xl bg-emerald-700 px-4 text-xs font-black text-white hover:bg-emerald-800"
                      >
                        Patvirtinti
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-sm font-black uppercase tracking-widest text-slate-500">
          Privalomi mokymai
        </p>
        <div className="mt-3 grid gap-3 2xl:grid-cols-2">
          {requiredTrainings.map((training) => {
            const completed = employee.completedTrainingIds.includes(
              training.id,
            );
            const expiring = employee.expiringTrainingIds.includes(training.id);
            return (
              <div
                key={training.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-950">
                      {training.title}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {training.hours} val. ·{" "}
                      {validityLabel(training.validityMonths)}
                    </p>
                  </div>
                  {completed ? (
                    <StatusBadge
                      success
                      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    >
                      Atlikta
                    </StatusBadge>
                  ) : (
                    <StatusBadge
                      danger
                      icon={<AlertTriangle className="h-3.5 w-3.5" />}
                    >
                      Trūksta
                    </StatusBadge>
                  )}
                </div>
                {expiring ? (
                  <div className="mt-3">
                    <StatusBadge
                      warning
                      icon={<CalendarDays className="h-3.5 w-3.5" />}
                    >
                      Terminas artėja
                    </StatusBadge>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-5 w-5 text-emerald-700" />
          <div>
            <p className="text-sm font-black text-slate-800">
              Tvirtinimo logika
            </p>
            <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
              Darbuotojas savo paskyroje gali įvesti mokymo datą ir pastabą.
              Admin čia peržiūri įrašą ir paspaudžia „Patvirtinti“. Failų
              kėlimas šiame modulyje nebūtinas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
