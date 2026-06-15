"use client";

import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  BarChart3,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  Home,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentAccess } from "@/lib/app-access";
import { getCurrentOrganizationId } from "@/lib/current-organization";

type DashboardStats = {
  organizations: number;
  activeResidents: number;
  allResidents: number;
  activeEmployees: number;
  pendingTasks: number;
  pendingLeaves: number;
  pendingInvites: number;
  totalInvites: number;
  pendingDocumentApprovals: number;
  expiringCertificates: number;
  completedTrainings: number;
  requiredTrainings: number;
  capacity: number | null;
  todayShiftEntries: number;
  todayAbsences: number;
  incidentAlerts: number;
  medicationAlerts: number;
  activityGaps: number;
  plannedFte: number;
  filledFte: number;
  freeFte: number;
  temporaryUnavailableFte: number;
  replacementNeededFte: number;
  fteRows: FteRow[];
};

type FteRow = {
  key: string;
  title: string;
  planned: number;
  filled: number;
  free: number;
  coefficient: string;
  status: string;
  percent: number;
  color: "emerald" | "amber" | "red";
};

type DashboardTab = "overview" | "capacity" | "risks" | "activity" | "documents";

const EMPTY_STATS: DashboardStats = {
  organizations: 0,
  activeResidents: 0,
  allResidents: 0,
  activeEmployees: 0,
  pendingTasks: 0,
  pendingLeaves: 0,
  pendingInvites: 0,
  totalInvites: 0,
  pendingDocumentApprovals: 0,
  expiringCertificates: 0,
  completedTrainings: 0,
  requiredTrainings: 0,
  capacity: null,
  todayShiftEntries: 0,
  todayAbsences: 0,
  incidentAlerts: 0,
  medicationAlerts: 0,
  activityGaps: 0,
  plannedFte: 0,
  filledFte: 0,
  freeFte: 0,
  temporaryUnavailableFte: 0,
  replacementNeededFte: 0,
  fteRows: [],
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [embeddedFormRoute, setEmbeddedFormRoute] = useState<string | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);

  function openTeamModule(module: string) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("team-active-module", module);
    }

    router.push(`/team?module=${encodeURIComponent(module)}`);
  }

  async function bootstrapDashboard() {
    const currentAccess = await getCurrentAccess();
    const currentRole = String(currentAccess?.role || "").toLowerCase();

    if (currentRole === "employee") {
      router.replace("/employee-dashboard");
      return;
    }

    setAccessChecked(true);
    await loadStats();
  }

  async function loadStats() {
    setLoading(true);

    const [
      organizations,
      allResidents,
      activeResidents,
      activeEmployees,
      pendingTasks,
      pendingLeaves,
      inviteStats,
      pendingDocumentApprovals,
      expiringCertificates,
      trainingStats,
      capacity,
      todayShiftEntries,
      todayAbsences,
      incidentAlerts,
      medicationAlerts,
      activityGaps,
      fteSummary,
    ] = await Promise.all([
      safeCount("organizations"),
      safeCount("residents"),
      safeCount("residents", (q) => q.eq("is_active", true)),
      safeCount("organization_members", (q) => q.eq("is_active", true)),
      firstWorkingCount([
        () => safeCountResult("tasks", (q) => q.in("status", ["pending", "open", "todo", "new"])),
        () => safeCountResult("admin_tasks", (q) => q.in("status", ["pending", "open", "todo", "new"])),
        () => safeCountResult("employee_tasks", (q) => q.in("status", ["pending", "open", "todo", "new"])),
        () => safeCountResult("requests", (q) => q.in("status", ["pending", "submitted", "new"])),
      ]),
      countPendingLeaveRequests(),
      countInviteStats(),
      countPendingDocumentApprovals(),
      countExpiringCertificates(),
      countTrainingProgress(),
      getOrganizationCapacity(),
      countTodayShiftEntries(),
      countTodayAbsences(),
      countIncidentAlerts(),
      countMedicationAlerts(),
      countActivityGaps(),
      loadFteSummary(),
    ]);

    const activeResidentsFixed = activeResidents || allResidents;

    setStats({
      organizations,
      allResidents,
      activeResidents: activeResidentsFixed,
      activeEmployees,
      pendingTasks,
      pendingLeaves,
      pendingInvites: inviteStats.pending,
      totalInvites: inviteStats.total,
      pendingDocumentApprovals,
      expiringCertificates,
      completedTrainings: trainingStats.completed,
      requiredTrainings: trainingStats.required,
      capacity,
      todayShiftEntries,
      todayAbsences,
      incidentAlerts,
      medicationAlerts,
      activityGaps,
      plannedFte: fteSummary.plannedFte,
      filledFte: fteSummary.filledFte,
      freeFte: fteSummary.freeFte,
      temporaryUnavailableFte: fteSummary.temporaryUnavailableFte,
      replacementNeededFte: fteSummary.replacementNeededFte,
      fteRows: fteSummary.rows || [],
    });

    setLastUpdated(new Date());
    setLoading(false);
  }

  useEffect(() => {
    void bootstrapDashboard();
  }, []);

  const computed = useMemo(() => {
    const occupancy = stats.capacity && stats.capacity > 0
      ? percentage(stats.activeResidents, stats.capacity)
      : stats.activeResidents > 0
        ? 100
        : 0;

    const trainingCompletion = stats.requiredTrainings > 0
      ? percentage(stats.completedTrainings, stats.requiredTrainings)
      : 0;

    const freePlaces = stats.capacity && stats.capacity > stats.activeResidents
      ? stats.capacity - stats.activeResidents
      : 0;

    const workloadRisk = clamp((stats.pendingTasks + stats.pendingLeaves) * 10, 0, 100);
    const documentRisk = clamp(
      (stats.expiringCertificates + stats.pendingDocumentApprovals) * 20,
      0,
      100,
    );
    const careRisk = clamp((stats.incidentAlerts + stats.medicationAlerts + stats.activityGaps) * 15, 0, 100);
    const shiftCoverage = stats.activeEmployees > 0
      ? percentage(stats.todayShiftEntries, stats.activeEmployees)
      : 0;

    const ftePercent = stats.plannedFte > 0
      ? percentage(stats.filledFte, stats.plannedFte)
      : 0;

    return {
      occupancy,
      ftePercent,
      trainingCompletion,
      freePlaces,
      workloadRisk,
      documentRisk,
      careRisk,
      shiftCoverage,
      totalRisks: stats.incidentAlerts + stats.medicationAlerts + stats.activityGaps,
    };
  }, [stats]);

  const attentionItems = [
    {
      title: "Kvietimai",
      desc: stats.pendingInvites > 0
        ? `${stats.pendingInvites} kvietimai laukia atsakymo.`
        : "Laukiančių kvietimų nėra.",
      badge: stats.pendingInvites ? "Peržiūrėti" : "Gerai",
      color: stats.pendingInvites ? "blue" as const : "emerald" as const,
      onClick: () => openTeamModule("invites"),
    },
    {
      title: "Atostogų prašymai",
      desc: `${stats.pendingLeaves} praš. laukia sprendimo.`,
      badge: stats.pendingLeaves ? "Peržiūrėti" : "Nėra",
      color: stats.pendingLeaves ? "amber" as const : "emerald" as const,
      onClick: () => openTeamModule("vacations"),
    },
    {
      title: "Baigiasi pažymos",
      desc:
        stats.pendingDocumentApprovals > 0
          ? `${stats.pendingDocumentApprovals} dokumentų pakeitimai laukia patvirtinimo.`
          : `${stats.expiringCertificates} pažym. baigiasi per 14 dienų.`,
      badge:
        stats.pendingDocumentApprovals > 0
          ? "Patvirtinti"
          : stats.expiringCertificates
            ? "Skubu"
            : "Gerai",
      color:
        stats.pendingDocumentApprovals > 0
          ? "amber" as const
          : stats.expiringCertificates
            ? "red" as const
            : "emerald" as const,
      onClick: () => openTeamModule("docs"),
    },
    {
      title: "Mokymų neatitikimai",
      desc: `Mokymų užbaigimas: ${computed.trainingCompletion}%.`,
      badge: computed.trainingCompletion < 70 ? "Sekti" : "Gerai",
      color: computed.trainingCompletion < 70 ? "blue" as const : "emerald" as const,
      onClick: () => openTeamModule("trainings"),
    },
    {
      title: "Užduotys",
      desc: `${stats.pendingTasks} užduočių laukia dėmesio.`,
      badge: stats.pendingTasks ? "Tvarkyti" : "Ramu",
      color: stats.pendingTasks ? "amber" as const : "emerald" as const,
      onClick: () => router.push("/tasks"),
    },
  ];

  const riskItems = [
    {
      label: "Incidentai",
      value: stats.incidentAlerts,
      hint: "reikia peržiūros",
      color: "red" as const,
      onClick: () => router.push("/handover-logs"),
    },
    {
      label: "Vaistų neatitikimai",
      value: stats.medicationAlerts,
      hint: "saugos patikra",
      color: "amber" as const,
      onClick: () => router.push("/medicine"),
    },
    {
      label: "Veiklų spragos",
      value: stats.activityGaps,
      hint: "gyventojai be aktyvumo",
      color: "blue" as const,
      onClick: () => router.push("/activities"),
    },
  ];

  const dashboardTabs: Array<{ key: DashboardTab; label: string; icon: ElementType }> = [
    { key: "overview", label: "Rodiklių apžvalga", icon: ShieldCheck },
    { key: "capacity", label: "Pajėgumas", icon: BriefcaseBusiness },
    { key: "risks", label: "Rizikos", icon: ShieldAlert },
    { key: "activity", label: "Veikla", icon: Activity },
    { key: "documents", label: "Dokumentai", icon: FileText },
  ];

  if (!accessChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white p-6 text-[#10251f]">
        <div className="rounded-[24px] border border-[#c9d8d0] bg-white px-6 py-5 text-sm font-black text-[#486b5d] shadow-sm">
          Kraunama...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white p-4 text-[#10251f] sm:p-6">
      <div className="mx-auto max-w-[1540px] space-y-4">
        <section className="overflow-hidden rounded-[18px] border border-[#c9d8d0] bg-white shadow-[0_1px_6px_rgba(16,37,31,0.08)]">
          <div className="bg-[#486b5d] px-5 py-4 text-white sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/70">
                  Pagrindinis skydelis
                </p>
                <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                  Dienos apžvalga
                </h1>
                <p className="mt-2 max-w-4xl text-sm font-bold leading-6 text-white/82">
                  Vienas langas svarbiausiems įstaigos rodikliams: gyventojams, personalo pajėgumui, rizikoms, mokymams, dokumentams ir veiksmams.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={loadStats}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-black text-[#486b5d] shadow-sm transition hover:bg-[#ffffff] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Atnaujinti
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/reports")}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/12 px-4 py-2 text-sm font-black text-white ring-1 ring-white/18 transition hover:bg-white/18 active:scale-[0.98]"
                >
                  <BarChart3 className="h-4 w-4" />
                  Ataskaitos
                </button>
              </div>
            </div>
          </div>

          <div className="border-b border-[#dbe6e0] bg-[#f7fcf9] px-4 py-3 sm:px-5">
            <nav className="flex flex-wrap items-center gap-2 text-sm font-black text-[#486b5d]">
              {dashboardTabs.map((item) => {
                const Icon = item.icon;

                return (
                  <DashboardTabButton
                    key={item.key}
                    active={activeTab === item.key}
                    onClick={() => setActiveTab(item.key)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </DashboardTabButton>
                );
              })}

              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#c2d3ca] bg-white px-4 py-2 text-xs font-black text-[#486b5d] shadow-sm transition hover:bg-[#ffffff]"
              >
                <Info className="h-4 w-4" />
                Instrukcija
              </button>
            </nav>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
          <TopMetric title="Gyventojai" value={loading ? "…" : String(stats.activeResidents)} meta="aktyvūs" onClick={() => router.push("/residents")} />
          <TopMetric title="Užimtumas" value={loading ? "…" : `${computed.occupancy}%`} meta="vietos" accent="emerald" onClick={() => router.push("/rooms")} />
          <TopMetric title="Darbuotojai" value={loading ? "…" : String(stats.activeEmployees)} meta="aktyvūs" onClick={() => openTeamModule("employees")} />
          <TopMetric title="Kvietimai" value={loading ? "…" : String(stats.pendingInvites)} meta={stats.pendingInvites ? "laukia" : `${stats.totalInvites} iš viso`} accent={stats.pendingInvites ? "amber" : "emerald"} onClick={() => openTeamModule("invites")} />
          <TopMetric title="Etatai" value={loading ? "…" : formatFte(stats.freeFte)} meta={`laisva iš ${formatFte(stats.plannedFte)} et.`} accent={stats.freeFte > 0 ? "red" : "emerald"} onClick={() => openTeamModule("fte")} />
          <TopMetric title="Užduotys" value={loading ? "…" : String(stats.pendingTasks)} meta={stats.pendingTasks ? "laukia" : "nėra"} accent={stats.pendingTasks ? "amber" : "emerald"} onClick={() => router.push("/tasks")} />
          <TopMetric title="Mokymai" value={loading ? "…" : `${computed.trainingCompletion}%`} meta="sutvarkyta" accent={computed.trainingCompletion < 70 ? "amber" : "emerald"} onClick={() => openTeamModule("trainings")} />
          <TopMetric
            title="Dokumentai"
            value={loading ? "…" : String(stats.pendingDocumentApprovals + stats.expiringCertificates)}
            meta={stats.pendingDocumentApprovals ? "laukia patvirtinimo" : "baigiasi"}
            accent={stats.pendingDocumentApprovals || stats.expiringCertificates ? "amber" : "emerald"}
            onClick={() => setActiveTab("documents")}
          />
        </section>

        {activeTab === "overview" ? (
          <section className="grid gap-4">
            <div className="grid gap-4">
              <section className="rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
                      Rodiklių apžvalga
                    </p>
                    <h2 className="mt-1 text-2xl font-black">Bendra situacija</h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push("/reports")}
                    className="rounded-xl border border-[#dbe6e0] bg-[#ffffff] px-4 py-2 text-sm font-black text-[#486b5d] transition hover:bg-[#f7fcf9]"
                  >
                    Plačiau
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <RoundMetric
                    title="Kambariai"
                    label={stats.capacity ? `${computed.occupancy}% užimtumas` : "talpa nenustatyta"}
                    value={computed.occupancy}
                    center={stats.capacity ? `${stats.activeResidents}/${stats.capacity}` : `${computed.occupancy}%`}
                    sublabel="vietos"
                    color="#047857"
                  />

                  <RoundMetric
                    title="Etatai"
                    label={stats.plannedFte ? `${formatFte(stats.filledFte)} / ${formatFte(stats.plannedFte)} et.` : "planas nesuvestas"}
                    value={computed.ftePercent}
                    center={stats.plannedFte ? `${formatFte(stats.filledFte)}/${formatFte(stats.plannedFte)}` : "—"}
                    sublabel="etatai"
                    color="#0f766e"
                  />

                  <RoundMetric
                    title="Slaugos pajėgumas"
                    label={computed.totalRisks ? "reikia dėmesio" : "kritinių rizikų nėra"}
                    value={100 - computed.careRisk}
                    center={`${100 - computed.careRisk}%`}
                    sublabel="pajėgumas"
                    color={computed.careRisk > 30 ? "#ca8a04" : "#047857"}
                    warm={computed.careRisk > 30}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
                  Veiksmų centras
                </p>
                <h2 className="mt-1 text-2xl font-black">Kas šiandien svarbiausia?</h2>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {attentionItems.map((row) => (
                    <PriorityActionCard
                      key={row.title}
                      title={row.title}
                      desc={row.desc}
                      badge={row.badge}
                      color={row.color}
                      onClick={row.onClick}
                    />
                  ))}
                </div>
              </section>
            </div>

          </section>
        ) : null}

        {activeTab === "capacity" ? (
          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
                    Pajėgumas
                  </p>
                  <h2 className="mt-1 text-2xl font-black">Etatų ir pamainų santrauka</h2>
                </div>

                <button
                  type="button"
                  onClick={() => openTeamModule("fte")}
                  className="rounded-xl bg-[#047857] px-4 py-2 text-sm font-black text-white transition hover:bg-[#065f46]"
                >
                  Atidaryti etatų valdymą
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <FteSummaryCard label="Planuota" value={loading ? "…" : formatFte(stats.plannedFte)} />
                <FteSummaryCard label="Užimta" value={loading ? "…" : formatFte(stats.filledFte)} tone="emerald" />
                <FteSummaryCard label="Laisva" value={loading ? "…" : formatFte(stats.freeFte)} tone={stats.freeFte > 0 ? "red" : "emerald"} />
                <FteSummaryCard label="Laikinai nedirba" value={loading ? "…" : formatFte(stats.temporaryUnavailableFte)} tone={stats.temporaryUnavailableFte > 0 ? "amber" : "emerald"} />
              </div>

              <CompactFteRows rows={stats.fteRows || []} />
            </section>

            <section className="rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
                Pamainų rizikos
              </p>
              <h2 className="mt-1 text-2xl font-black">Pavadavimas ir grafikas</h2>

              <div className="mt-5 space-y-3">
                <RiskAttentionCard
                  title="Pavadavimo poreikis"
                  text={
                    stats.replacementNeededFte > 0
                      ? `Reikia pavaduoti ${formatFte(stats.replacementNeededFte)} et.`
                      : "Pavadavimo poreikio nerasta."
                  }
                  badge={stats.replacementNeededFte > 0 ? "Svarbu" : "Gerai"}
                  tone={stats.replacementNeededFte > 0 ? "amber" : "emerald"}
                  onClick={() => openTeamModule("schedule")}
                />

                <RiskAttentionCard
                  title="Šiandien neatvykę"
                  text={
                    stats.todayAbsences > 0
                      ? `${stats.todayAbsences} darbuotojų šiandien neatvykę.`
                      : "Šiandien neatvykimų nėra."
                  }
                  badge={stats.todayAbsences > 0 ? "Tikrinti" : "Gerai"}
                  tone={stats.todayAbsences > 0 ? "amber" : "emerald"}
                  onClick={() => openTeamModule("schedule")}
                />
              </div>
            </section>
          </section>
        ) : null}

        {activeTab === "risks" ? (
          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <section className="rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
                Rizikos
              </p>
              <h2 className="mt-1 text-2xl font-black">Reikia dėmesio</h2>

              <div className="mt-5 space-y-3">
                <RiskAttentionCard
                  title="Atostogų / išvykimo užklausos"
                  text={
                    stats.pendingLeaves > 0
                      ? `${stats.pendingLeaves} užklausos laukia patvirtinimo.`
                      : "Laukiančių užklausų nėra."
                  }
                  badge={stats.pendingLeaves > 0 ? "Patvirtinti" : "Gerai"}
                  tone={stats.pendingLeaves > 0 ? "amber" : "emerald"}
                  onClick={() => openTeamModule("vacations")}
                />

                <RiskAttentionCard
                  title="Dokumentų terminai"
                  text={
                    stats.pendingDocumentApprovals > 0
                      ? `${stats.pendingDocumentApprovals} dokumentų pakeitimai laukia patvirtinimo.`
                      : stats.expiringCertificates > 0
                        ? `${stats.expiringCertificates} darbuotojų dokumentai baigiasi.`
                      : "Baigiančių galioti dokumentų nėra."
                  }
                  badge={
                    stats.pendingDocumentApprovals > 0
                      ? "Patvirtinti"
                      : stats.expiringCertificates > 0
                        ? "Įspėjimas"
                        : "Gerai"
                  }
                  tone={
                    stats.pendingDocumentApprovals > 0 ||
                    stats.expiringCertificates > 0
                      ? "amber"
                      : "emerald"
                  }
                  onClick={() => openTeamModule("docs")}
                />

                {riskItems.map((risk) => (
                  <RiskAttentionCard
                    key={risk.label}
                    title={risk.label}
                    text={`${risk.value} įrašai · ${risk.hint}`}
                    badge={risk.value > 0 ? "Tikrinti" : "Gerai"}
                    tone={risk.value > 0 ? "amber" : "emerald"}
                    onClick={risk.onClick}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
                Greiti veiksmai
              </p>
              <h2 className="mt-1 text-2xl font-black">Kur eiti toliau?</h2>

              <div className="mt-5 grid gap-3">
                <QuickLink title="Atostogų / išvykimų patvirtinimai" onClick={() => openTeamModule("vacations")} />
                <QuickLink title="Darbuotojų dokumentai" onClick={() => openTeamModule("docs")} />
                <QuickLink title="Grafiko patikra" onClick={() => openTeamModule("schedule")} />
                <QuickLink title="Kvietimų valdymas" onClick={() => openTeamModule("invites")} />
                <QuickLink title="Audit žurnalas" onClick={() => router.push("/audit")} />
              </div>
            </section>
          </section>
        ) : null}

        {activeTab === "activity" ? (
          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <section className="rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
                Dienos eiga
              </p>
              <h2 className="mt-1 text-2xl font-black">Naujausi įvykiai</h2>

              <div className="mt-4 space-y-3">
                <TimelineItem color="#047857" title="Rodikliai atnaujinti" meta={lastUpdated ? formatDateTime(lastUpdated) : "šiandien"} />
                <TimelineItem color="#be123c" title="Atostogų / išvykimo užklausos" meta={`${stats.pendingLeaves} laukia sprendimo`} warm />
                <TimelineItem
                  color="#b91c1c"
                  title="Dokumentų terminai"
                  meta={`${stats.pendingDocumentApprovals + stats.expiringCertificates} įspėjimai`}
                  danger
                />
                <TimelineItem color="#2563eb" title="Mokymai" meta={`${computed.trainingCompletion}% užbaigta`} blue />
              </div>
            </section>

            <section className="rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
                Veiklos kryptys
              </p>
              <h2 className="mt-1 text-2xl font-black">Greitos nuorodos</h2>

              <div className="mt-5 grid gap-3">
                <QuickLink title="Gyventojai" onClick={() => router.push("/residents")} />
                <QuickLink title="Užduotys" onClick={() => router.push("/tasks")} />
                <QuickLink title="Mokymai" onClick={() => openTeamModule("trainings")} />
                <QuickLink title="Perdavimo žurnalai" onClick={() => router.push("/handover-logs")} />
              </div>
            </section>
          </section>
        ) : null}

        {activeTab === "documents" ? (
          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <section className="rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
                Dokumentai
              </p>
              <h2 className="mt-1 text-2xl font-black">Darbuotojų pateikti duomenys</h2>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <FteSummaryCard label="Laukia patvirtinimo" value={String(stats.pendingDocumentApprovals)} tone={stats.pendingDocumentApprovals > 0 ? "amber" : "emerald"} />
                <FteSummaryCard label="Baigiasi dokumentai" value={String(stats.expiringCertificates)} tone={stats.expiringCertificates > 0 ? "red" : "emerald"} />
              </div>

              <p className="mt-5 rounded-xl border border-[#dbe6e0] bg-[#ffffff] px-4 py-3 text-sm font-bold text-[#486b5d]">
                Čia rodoma tik dokumentų būsena: darbuotojo pateikti pakeitimai ir artėjantys terminai.
              </p>
            </section>

            <section className="rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
                Veiksmai
              </p>
              <h2 className="mt-1 text-2xl font-black">
                {stats.pendingDocumentApprovals > 0 ? "Patvirtinimas" : "Dokumentų peržiūra"}
              </h2>

              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={() => openTeamModule("docs")}
                  className="min-h-14 rounded-xl bg-[#047857] px-5 text-left text-base font-black text-white transition hover:bg-[#065f46]"
                >
                  {stats.pendingDocumentApprovals > 0
                    ? "Atidaryti dokumentų patvirtinimą"
                    : "Atidaryti darbuotojų dokumentus"}
                </button>
                <p className="rounded-xl border border-[#dbe6e0] bg-[#ffffff] px-4 py-3 text-sm font-bold text-[#486b5d]">
                  {stats.pendingDocumentApprovals > 0
                    ? "Atsidariusiame sąraše prie laukiančių įrašų spauskite „Patvirtinti“."
                    : "Laukiančių dokumentų patvirtinimų nėra. Atsidarys dokumentų sąrašas ir terminai."}
                </p>
              </div>
            </section>
          </section>
        ) : null}
      </div>

      {showHelp && (
        <HelpModal activeTab={activeTab} onClose={() => setShowHelp(false)} />
      )}
    </main>
  );
}


async function safeCount(table: string, apply?: (query: any) => any): Promise<number> {
  const result = await safeCountResult(table, apply);
  return result.ok ? result.count : 0;
}

async function safeCountResult(table: string, apply?: (query: any) => any): Promise<{ ok: boolean; count: number }> {
  try {
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    query = await applyDashboardOrganizationScope(table, query);
    if (apply) query = apply(query);
    const { count, error } = await query;
    if (error) return { ok: false, count: 0 };
    return { ok: true, count: count ?? 0 };
  } catch {
    return { ok: false, count: 0 };
  }
}

async function firstWorkingCount(loaders: Array<() => Promise<{ ok: boolean; count: number }>>): Promise<number> {
  for (const loader of loaders) {
    const result = await loader();
    if (result.ok) return result.count;
  }
  return 0;
}

async function countInviteStats(): Promise<{ pending: number; total: number }> {
  const rows = await safeSelectRows("organization_invites", "id, status");
  if (rows.length) {
    return {
      pending: rows.filter((row: any) => String(row?.status || "pending").toLowerCase() === "pending").length,
      total: rows.length,
    };
  }

  const pending = await safeCount("organization_invites", (q) => q.eq("status", "pending"));
  const total = await safeCount("organization_invites");

  return { pending, total };
}

async function countPendingLeaveRequests(): Promise<number> {
  const pendingStatuses = [
    "pending",
    "submitted",
    "new",
    "laukiama",
    "laukia",
  ];

  const rows = await firstWorkingRows([
    () => safeSelectRows("vacation_requests", "id, status"),
    () => safeSelectRows("leave_requests", "id, status"),
    () => safeSelectRows("absence_requests", "id, status"),
  ]);

  if (rows.length) {
    return rows.filter((row: any) =>
      pendingStatuses.includes(String(row?.status || "submitted").toLowerCase()),
    ).length;
  }

  return firstWorkingCount([
    () => safeCountResult("vacation_requests", (q) => q.in("status", pendingStatuses)),
    () => safeCountResult("leave_requests", (q) => q.in("status", pendingStatuses)),
    () => safeCountResult("absence_requests", (q) => q.in("status", pendingStatuses)),
  ]);
}

async function countPendingDocumentApprovals(): Promise<number> {
  return safeCount("personnel_credentials", (q) =>
    q.eq("status", "pending"),
  );
}


async function loadFteSummary(): Promise<{
  plannedFte: number;
  filledFte: number;
  freeFte: number;
  temporaryUnavailableFte: number;
  replacementNeededFte: number;
  rows?: FteRow[];
}> {
  const [positionsResult, membersResult, temporaryUnavailableFte] = await Promise.all([
    safeSelectRows("personnel_positions", "id, department, position_name, planned_fte, coefficient_min, coefficient_max, active"),
    safeSelectRows("organization_members", "user_id, role, position, department, staff_type, employment_rate, is_active, is_archived"),
    countTemporaryUnavailableFte(),
  ]);

  const members = membersResult
    .filter((row: any) => row?.is_active !== false && row?.is_archived !== true)
    .map((row: any) => ({
      ...row,
      employment_rate: Number(row.employment_rate || 1),
    }));

  const positionRows = positionsResult.filter((row: any) => row?.active !== false);

  if (!positionRows.length) {
    const groups = new Map<string, { title: string; filled: number; planned: number; coefficient: string }>();

    for (const member of members) {
      const key = normalizeFteGroup(member.staff_type || member.department || member.position || member.role);
      const title = fteGroupLabel(key, member);
      const current = groups.get(key) || {
        title,
        filled: 0,
        planned: 0,
        coefficient: "—",
      };

      current.filled += Number(member.employment_rate || 1);
      current.planned = Math.max(current.planned, Math.ceil(current.filled));
      groups.set(key, current);
    }

    const rows = Array.from(groups.entries()).map(([key, group]) =>
      makeFteRow({
        key,
        title: group.title,
        planned: group.planned,
        filled: group.filled,
        coefficient: group.coefficient,
      }),
    );

    const plannedFte = roundFte(rows.reduce((sum, row) => sum + row.planned, 0));
    const filledFte = roundFte(rows.reduce((sum, row) => sum + row.filled, 0));
    const freeFte = roundFte(Math.max(0, plannedFte - filledFte));

    return {
      plannedFte,
      filledFte,
      freeFte,
      temporaryUnavailableFte,
      replacementNeededFte: temporaryUnavailableFte,
      rows,
    };
  }

  const rows = positionRows.map((position: any) => {
    const planned = Number(position.planned_fte || 0);
    const title = String(position.position_name || position.department || "Pareigybė").trim();

    const filled = members
      .filter((member: any) => memberMatchesPosition(member, position))
      .reduce((sum: number, member: any) => sum + Number(member.employment_rate || 1), 0);

    const coefficient = coefficientRange(position.coefficient_min, position.coefficient_max);

    return makeFteRow({
      key: String(position.id || title),
      title,
      planned,
      filled,
      coefficient,
    });
  });

  const plannedFte = roundFte(rows.reduce((sum, row) => sum + row.planned, 0));
  const filledFte = roundFte(rows.reduce((sum, row) => sum + row.filled, 0));
  const freeFte = roundFte(Math.max(0, plannedFte - filledFte));

  return {
    plannedFte,
    filledFte,
    freeFte,
    temporaryUnavailableFte,
    replacementNeededFte: temporaryUnavailableFte,
    rows,
  };
}

async function safeSelectRows(table: string, columns: string): Promise<any[]> {
  try {
    let query = supabase.from(table).select(columns);
    query = await applyDashboardOrganizationScope(table, query);
    const { data, error } = await query;
    if (error || !data) return [];
    return data as any[];
  } catch {
    return [];
  }
}

async function countTemporaryUnavailableFte(): Promise<number> {
  const today = toDateInput(new Date());

  const rows = await firstWorkingRows([
    () => safeSelectFilteredRows("vacation_requests", "employee_id, status, start_date, end_date", (q) =>
      q.lte("start_date", today).gte("end_date", today).in("status", ["approved", "confirmed"]),
    ),
    () => safeSelectFilteredRows("leave_requests", "employee_id, status, start_date, end_date", (q) =>
      q.lte("start_date", today).gte("end_date", today).in("status", ["approved", "confirmed"]),
    ),
    () => safeSelectFilteredRows("absence_requests", "employee_id, status, start_date, end_date", (q) =>
      q.lte("start_date", today).gte("end_date", today).in("status", ["approved", "confirmed"]),
    ),
  ]);

  if (!rows.length) return 0;

  const employeeIds = Array.from(
    new Set(rows.map((row: any) => row.employee_id).filter(Boolean).map(String)),
  );

  if (!employeeIds.length) return 0;

  const members = await safeSelectFilteredRows(
    "organization_members",
    "user_id, employment_rate, is_active, is_archived",
    (q) => q.in("user_id", employeeIds),
  );

  return roundFte(
    members
      .filter((member: any) => member?.is_active !== false && member?.is_archived !== true)
      .reduce((sum: number, member: any) => sum + Number(member.employment_rate || 1), 0),
  );
}

async function firstWorkingRows(loaders: Array<() => Promise<any[]>>): Promise<any[]> {
  for (const loader of loaders) {
    const rows = await loader();
    if (rows.length) return rows;
  }
  return [];
}

async function safeSelectFilteredRows(
  table: string,
  columns: string,
  apply: (query: any) => any,
): Promise<any[]> {
  try {
    let query = supabase.from(table).select(columns);
    query = await applyDashboardOrganizationScope(table, query);
    query = apply(query);
    const { data, error } = await query;
    if (error || !data) return [];
    return data as any[];
  } catch {
    return [];
  }
}

const ORGANIZATION_SCOPED_DASHBOARD_TABLES = new Set([
  "residents",
  "organization_members",
  "tasks",
  "admin_tasks",
  "employee_tasks",
  "requests",
  "vacation_requests",
  "leave_requests",
  "absence_requests",
  "organization_invites",
  "personnel_credentials",
  "personnel_positions",
  "personnel_trainings",
  "employee_trainings",
  "staff_trainings",
  "training_records",
  "training_requirements",
  "role_training_requirements",
  "position_training_requirements",
  "employee_certificates",
  "personnel_documents",
  "employee_schedules",
  "work_schedule_entries",
  "resident_incidents",
  "medication_administration_logs",
  "activity_attendance",
])

async function applyDashboardOrganizationScope(
  table: string,
  query: any,
) {
  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) return query.eq("organization_id", "__missing__")

  if (table === "organizations") {
    return query.eq("id", organizationId)
  }

  if (ORGANIZATION_SCOPED_DASHBOARD_TABLES.has(table)) {
    return query.eq("organization_id", organizationId)
  }

  return query
}

function makeFteRow({
  key,
  title,
  planned,
  filled,
  coefficient,
}: {
  key: string;
  title: string;
  planned: number;
  filled: number;
  coefficient: string;
}): FteRow {
  const free = roundFte(Math.max(0, planned - filled));
  const percent = planned > 0 ? percentage(filled, planned) : filled > 0 ? 100 : 0;
  const color = percent >= 90 ? "emerald" : percent >= 70 ? "amber" : "red";
  const status = percent >= 90 ? "Užpildyta" : percent >= 70 ? "Stebėti" : "Trūksta";

  return {
    key,
    title,
    planned: roundFte(planned),
    filled: roundFte(filled),
    free,
    coefficient,
    status,
    percent,
    color,
  };
}

function memberMatchesPosition(member: any, position: any) {
  const positionName = normalizeText(position.position_name);
  const department = normalizeText(position.department);
  const memberPosition = normalizeText(member.position);
  const memberDepartment = normalizeText(member.department);
  const staffType = normalizeText(member.staff_type);

  if (positionName && memberPosition && memberPosition.includes(positionName)) return true;
  if (positionName && staffType && staffType.includes(positionName)) return true;
  if (department && memberDepartment && memberDepartment.includes(department)) return true;

  return false;
}

function normalizeFteGroup(value: unknown) {
  const text = normalizeText(value);

  if (/slaug|nurse|medic/.test(text)) return "nursing";
  if (/social|soc/.test(text)) return "social";
  if (/virtuv|kitchen|maist|cook|vir/.test(text)) return "kitchen";
  if (/ūk|uk|maintenance|valy|clean|techn/.test(text)) return "facility";
  if (/admin|direkt|vadov|owner/.test(text)) return "administration";

  return text || "other";
}

function fteGroupLabel(key: string, member: any) {
  const labels: Record<string, string> = {
    nursing: "Slauga",
    social: "Socialiniai darbuotojai",
    kitchen: "Virtuvė",
    facility: "Ūkis",
    administration: "Administracija",
    other: "Kita",
  };

  return labels[key] || String(member.position || member.department || member.staff_type || "Kita");
}

function coefficientRange(min: unknown, max: unknown) {
  const minNumber = Number(min);
  const maxNumber = Number(max);

  if (Number.isFinite(minNumber) && Number.isFinite(maxNumber) && maxNumber > 0) {
    return `${minNumber.toFixed(2)} – ${maxNumber.toFixed(2)}`;
  }

  if (Number.isFinite(minNumber) && minNumber > 0) return minNumber.toFixed(2);
  if (Number.isFinite(maxNumber) && maxNumber > 0) return maxNumber.toFixed(2);

  return "—";
}

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function roundFte(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatFte(value: number) {
  return roundFte(value).toLocaleString("lt-LT", {
    minimumFractionDigits: Number.isInteger(roundFte(value)) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}


async function countExpiringCertificates(): Promise<number> {
  const today = new Date();
  const in14Days = new Date(today);
  in14Days.setDate(today.getDate() + 14);

  const from = toDateInput(today);
  const to = toDateInput(in14Days);

  try {
    const { data, error } = await supabase
      .from("organization_members")
      .select("occupational_health_valid_until, professional_license_valid_until")
      .eq("organization_id", await getCurrentOrganizationId())
      .eq("is_active", true);

    if (!error && data) {
      return data.filter((row: any) => {
        return isDateInRange(row.occupational_health_valid_until, from, to)
          || isDateInRange(row.professional_license_valid_until, from, to);
      }).length;
    }
  } catch {
    // fallback below
  }

  return firstWorkingCount([
    () => safeCountResult("employee_certificates", (q) => q.gte("expires_at", from).lte("expires_at", to)),
    () => safeCountResult("personnel_documents", (q) => q.gte("valid_until", from).lte("valid_until", to)),
  ]);
}

async function countTrainingProgress(): Promise<{ completed: number; required: number }> {
  const completed = await firstWorkingCount([
    () => safeCountResult("personnel_trainings", (q) => q.not("completed_at", "is", null).in("status", ["approved", "completed", "valid", "galioja"])),
    () => safeCountResult("employee_trainings", (q) => q.not("completed_at", "is", null)),
    () => safeCountResult("staff_trainings", (q) => q.not("completed_at", "is", null)),
    () => safeCountResult("training_records", (q) => q.not("completed_at", "is", null)),
  ]);

  const requiredRows = await firstWorkingCount([
    () => safeCountResult("training_requirements"),
    () => safeCountResult("role_training_requirements"),
    () => safeCountResult("position_training_requirements"),
    () => safeCountResult("employee_trainings"),
    () => safeCountResult("staff_trainings"),
    () => safeCountResult("training_records"),
  ]);

  const roleRequirements = await firstWorkingCount([
    () => safeCountResult("role_training_requirements"),
    () => safeCountResult("position_training_requirements"),
    () => safeCountResult("training_requirements"),
  ]);

  const activeEmployees = await safeCount("organization_members", (q) => q.eq("is_active", true));
  const estimatedRequired = roleRequirements > 0 && activeEmployees > 0
    ? roleRequirements * activeEmployees
    : requiredRows;

  return {
    completed,
    required: Math.max(completed, estimatedRequired),
  };
}

async function getOrganizationCapacity(): Promise<number | null> {
  try {
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) return null;

    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .maybeSingle();
    if (error || !data) return null;

    const possibleKeys = [
      "capacity",
      "resident_capacity",
      "beds_count",
      "bed_count",
      "places_count",
      "total_places",
      "total_beds",
    ];

    for (const key of possibleKeys) {
      const value = Number((data as any)[key]);
      if (Number.isFinite(value) && value > 0) return value;
    }

    return null;
  } catch {
    return null;
  }
}

async function countTodayShiftEntries(): Promise<number> {
  const today = toDateInput(new Date());

  return firstWorkingCount([
    () => safeCountResult("employee_schedules", (q) => q.eq("date", today)),
    () => safeCountResult("staff_schedules", (q) => q.eq("date", today)),
    () => safeCountResult("schedules", (q) => q.eq("date", today)),
  ]);
}

async function countTodayAbsences(): Promise<number> {
  const today = toDateInput(new Date());

  return firstWorkingCount([
    () => safeCountResult("vacation_requests", (q) => q.lte("start_date", today).gte("end_date", today).in("status", ["approved", "confirmed"])),
    () => safeCountResult("leave_requests", (q) => q.lte("start_date", today).gte("end_date", today).in("status", ["approved", "confirmed"])),
    () => safeCountResult("absence_requests", (q) => q.lte("start_date", today).gte("end_date", today).in("status", ["approved", "confirmed"])),
  ]);
}

async function countIncidentAlerts(): Promise<number> {
  const from = toDateInput(new Date());

  return firstWorkingCount([
    () => safeCountResult("handover_logs", (q) => q.gte("created_at", from).in("priority", ["critical", "high", "skubu"])),
    () => safeCountResult("incidents", (q) => q.gte("created_at", from).in("severity", ["critical", "high"])),
    () => safeCountResult("resident_incidents", (q) => q.gte("created_at", from).in("severity", ["critical", "high"])),
  ]);
}

async function countMedicationAlerts(): Promise<number> {
  const from = toDateInput(new Date());

  return firstWorkingCount([
    () => safeCountResult("medication_logs", (q) => q.gte("created_at", from).in("status", ["missed", "error", "late", "problem"])),
    () => safeCountResult("medicine_safety_events", (q) => q.gte("created_at", from)),
    () => safeCountResult("medication_safety_events", (q) => q.gte("created_at", from)),
  ]);
}

async function countActivityGaps(): Promise<number> {
  return firstWorkingCount([
    () => safeCountResult("resident_activities", (q) => q.in("status", ["missed", "absent", "refused"])),
    () => safeCountResult("activity_attendance", (q) => q.in("status", ["absent", "refused"])),
  ]);
}





function DashboardTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 transition ${
        active
          ? "bg-white text-[#486b5d] shadow-sm ring-1 ring-[#c9d8d0]"
          : "text-[#486b5d] hover:bg-white/80"
      }`}
    >
      {children}
    </button>
  );
}

function DashboardSidePanel({
  pendingLeaves,
  pendingInvites,
  totalInvites,
  todayAbsences,
  expiringCertificates,
  pendingDocumentApprovals,
  trainingCompletion,
  lastUpdated,
  onVacations,
  onInvites,
  onSchedule,
  onDocuments,
}: {
  pendingLeaves: number;
  pendingInvites: number;
  totalInvites: number;
  todayAbsences: number;
  expiringCertificates: number;
  pendingDocumentApprovals: number;
  trainingCompletion: number;
  lastUpdated: Date | null;
  onVacations: () => void;
  onInvites: () => void;
  onSchedule: () => void;
  onDocuments: () => void;
}) {
  return (
    <aside className="grid content-start gap-4">
      <section className="rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
          Pranešimai
        </p>
        <h2 className="mt-1 text-2xl font-black">Reikia dėmesio</h2>

        <div className="mt-4 space-y-3">
          <RiskAttentionCard
            title="Darbuotojų kvietimai"
            text={
              pendingInvites > 0
                ? `${pendingInvites} kvietimai laukia atsakymo. Iš viso sukurta: ${totalInvites}.`
                : "Laukiančių kvietimų nėra."
            }
            badge={pendingInvites > 0 ? "Laukia" : "Gerai"}
            tone={pendingInvites > 0 ? "amber" : "emerald"}
            onClick={onInvites}
          />
          <RiskAttentionCard
            title="Atostogų / išvykimo užklausos"
            text={
              pendingLeaves > 0
                ? `${pendingLeaves} užklausos laukia patvirtinimo.`
                : "Laukiančių užklausų nėra."
            }
            badge={pendingLeaves > 0 ? "Laukia" : "Gerai"}
            tone={pendingLeaves > 0 ? "amber" : "emerald"}
            onClick={onVacations}
          />
          <RiskAttentionCard
            title="Šiandien neatvykę"
            text={
              todayAbsences > 0
                ? `${todayAbsences} darbuotojų neatvykę šiandien.`
                : "Šiandien neatvykimų nėra."
            }
            badge={todayAbsences > 0 ? "Tikrinti" : "Gerai"}
            tone={todayAbsences > 0 ? "amber" : "emerald"}
            onClick={onSchedule}
          />
          <RiskAttentionCard
            title="Dokumentų terminai"
            text={
              pendingDocumentApprovals > 0
                ? `${pendingDocumentApprovals} dokumentų pakeitimai laukia patvirtinimo.`
                : expiringCertificates > 0
                  ? `${expiringCertificates} darbuotojų dokumentai baigiasi.`
                : "Baigiančių galioti dokumentų nėra."
            }
            badge={
              pendingDocumentApprovals > 0
                ? "Patvirtinti"
                : expiringCertificates > 0
                  ? "Įspėjimas"
                  : "Gerai"
            }
            tone={
              pendingDocumentApprovals > 0 || expiringCertificates > 0
                ? "amber"
                : "emerald"
            }
            onClick={onDocuments}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
          Dienos eiga
        </p>
        <h2 className="mt-1 text-2xl font-black">Naujausi įvykiai</h2>

        <div className="mt-4 space-y-3">
          <TimelineItem color="#047857" title="Rodikliai atnaujinti" meta={lastUpdated ? formatDateTime(lastUpdated) : "šiandien"} />
          <TimelineItem color="#2563eb" title="Darbuotojų kvietimai" meta={`${pendingInvites} laukia atsakymo`} blue />
          <TimelineItem color="#be123c" title="Atostogų / išvykimo užklausos" meta={`${pendingLeaves} laukia sprendimo`} warm />
          <TimelineItem
            color="#b91c1c"
            title="Dokumentų terminai"
            meta={`${pendingDocumentApprovals + expiringCertificates} įspėjimai`}
            danger
          />
          <TimelineItem color="#2563eb" title="Mokymai" meta={`${trainingCompletion}% užbaigta`} blue />
        </div>
      </section>
    </aside>
  );
}

function CompactFteRows({ rows }: { rows: FteRow[] }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const visibleRows = safeRows.length
    ? safeRows
        .slice()
        .sort((a, b) => b.free - a.free)
        .slice(0, 4)
    : [
        {
          key: "empty",
          title: "Pareigybių planas nesuvestas",
          planned: 0,
          filled: 0,
          free: 0,
          coefficient: "—",
          status: "Reikia plano",
          percent: 0,
          color: "amber" as const,
        },
      ];

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-[#dbe6e0]">
      <div className="hidden grid-cols-[1fr_0.7fr_0.7fr_0.7fr] bg-[#ffffff] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#6a7e75] md:grid">
        <div>Pareigybė</div>
        <div>Užimta</div>
        <div>Laisva</div>
        <div>Būsena</div>
      </div>

      <div className="divide-y divide-[#f7fcf9] bg-white">
        {visibleRows.map((row) => (
          <div
            key={row.key}
            className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_0.7fr_0.7fr_0.7fr] md:items-center"
          >
            <div>
              <b>{row.title}</b>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                <div
                  className={`h-full rounded-full ${
                    row.color === "emerald"
                      ? "bg-[#047857]"
                      : row.color === "red"
                        ? "bg-[#be123c]"
                        : "bg-[#ca8a04]"
                  }`}
                  style={{ width: `${clamp(row.percent, 0, 100)}%` }}
                />
              </div>
            </div>

            <div className="font-black">{formatFte(row.filled)} / {formatFte(row.planned)}</div>
            <div className={row.free > 0 ? "font-black text-[#047857]" : "font-black text-emerald-700"}>
              {formatFte(row.free)} et.
            </div>
            <div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  row.color === "emerald"
                    ? "bg-emerald-50 text-emerald-700"
                    : row.color === "red"
                      ? "bg-red-50 text-[#047857]"
                      : "bg-[#fff1f2] text-[#be123c]"
                }`}
              >
                {row.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoundMetric({
  title,
  label,
  value,
  center,
  sublabel,
  color,
  warm,
}: {
  title: string;
  label: string;
  value: number;
  center: string;
  sublabel?: string;
  color: string;
  warm?: boolean;
}) {
  return (
    <article className={`rounded-2xl border p-5 ${
      warm ? "border-[#fecdd3] bg-[#fff1f2]" : "border-[#dbe6e0] bg-[#ffffff]"
    }`}>
      <div className="mx-auto flex justify-center">
        <div className="relative flex h-[132px] w-[132px] items-center justify-center">
          <CircularChart value={value} label={center} stroke={color} size={132} />
          {sublabel ? (
            <span className="absolute mt-12 text-[10px] font-black uppercase tracking-[0.12em] text-[#6a7e75]">
              {sublabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="text-lg font-black text-[#10251f]">{title}</p>
        <p className={`mt-1 text-sm font-bold ${warm ? "text-[#be123c]" : "text-[#6a7e75]"}`}>{label}</p>
      </div>
    </article>
  );
}



function RiskAttentionCard({
  title,
  text,
  badge,
  tone,
  onClick,
}: {
  title: string;
  text: string;
  badge: string;
  tone: "emerald" | "amber" | "blue" | "red";
  onClick: () => void;
}) {
  const classes =
    tone === "red"
      ? "border-[#fecdd3] bg-[#fff1f2] text-[#047857]"
      : tone === "amber"
        ? "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]"
        : tone === "blue"
          ? "border-[#c9d8d0] bg-[#f7fcf9] text-[#047857]"
          : "border-emerald-100 bg-emerald-50 text-emerald-700";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition hover:shadow-sm ${classes}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-black text-[#10251f]">{title}</p>
          <p className="mt-1 text-sm font-bold opacity-80">{text}</p>
        </div>

        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black">
          {badge}
        </span>
      </div>
    </button>
  );
}


function FtePlanningSection({
  rows,
  plannedFte,
  filledFte,
  freeFte,
  temporaryUnavailableFte,
  replacementNeededFte,
  loading,
  onOpenPlan,
  onOpenSchedule,
}: {
  rows: FteRow[];
  plannedFte: number;
  filledFte: number;
  freeFte: number;
  temporaryUnavailableFte: number;
  replacementNeededFte: number;
  loading: boolean;
  onOpenPlan: () => void;
  onOpenSchedule: () => void;
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const visibleRows = safeRows.length
    ? safeRows
    : [
        {
          key: "empty",
          title: "Pareigybių planas nesuvestas",
          planned: 0,
          filled: 0,
          free: 0,
          coefficient: "—",
          status: "Reikia plano",
          percent: 0,
          color: "amber" as const,
        },
      ];

  return (
    <section className="rounded-2xl border border-[#c9d8d0] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
            Personalo analizė
          </p>
          <h2 className="mt-1 text-2xl font-black">Etatų užpildymas</h2>
          <p className="mt-1 text-sm font-bold text-[#6a7e75]">
            Planuoti etatai, faktinis etatų užimtumas ir laikinas darbuotojų trūkumas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenPlan}
            className="rounded-xl border border-[#dbe6e0] bg-[#ffffff] px-4 py-2 text-sm font-black text-[#486b5d] transition hover:bg-[#f7fcf9]"
          >
            Personalo planas
          </button>
          <button
            type="button"
            onClick={onOpenSchedule}
            className="rounded-xl bg-[#047857] px-4 py-2 text-sm font-black text-white transition hover:bg-[#065f46]"
          >
            Grafikas
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <FteSummaryCard label="Planuota etatų" value={loading ? "…" : formatFte(plannedFte)} />
        <FteSummaryCard label="Užimta" value={loading ? "…" : formatFte(filledFte)} />
        <FteSummaryCard label="Laikinai nedirba" value={loading ? "…" : formatFte(temporaryUnavailableFte)} tone="amber" />
        <FteSummaryCard label="Laisvi etatai" value={loading ? "…" : formatFte(freeFte)} tone={freeFte > 0 ? "red" : "emerald"} />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[#dbe6e0]">
        <div className="hidden grid-cols-[1.25fr_0.8fr_0.55fr_0.8fr_0.65fr] bg-[#ffffff] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#6a7e75] md:grid">
          <div>Pareigybė / grupė</div>
          <div>Užpildyta</div>
          <div>Laisva</div>
          <div>Koeficientas</div>
          <div>Statusas</div>
        </div>

        <div className="divide-y divide-[#f7fcf9] bg-white">
          {visibleRows.map((row) => (
            <div
              key={row.key}
              className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.25fr_0.8fr_0.55fr_0.8fr_0.65fr] md:items-center"
            >
              <div>
                <div className="font-black text-[#10251f]">{row.title}</div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                  <div
                    className={`h-full rounded-full ${
                      row.color === "emerald"
                        ? "bg-[#047857]"
                        : row.color === "red"
                          ? "bg-[#be123c]"
                          : "bg-[#ca8a04]"
                    }`}
                    style={{ width: `${clamp(row.percent, 0, 100)}%` }}
                  />
                </div>
              </div>

              <div className="font-black text-[#10251f]">
                {formatFte(row.filled)} / {formatFte(row.planned)} et.
              </div>

              <div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    row.free > 0
                      ? "bg-red-50 text-[#047857]"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {formatFte(row.free)} et.
                </span>
              </div>

              <div className="font-bold text-[#6a7e75]">{row.coefficient}</div>

              <div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    row.color === "emerald"
                      ? "bg-emerald-50 text-emerald-700"
                      : row.color === "red"
                        ? "bg-red-50 text-[#047857]"
                        : "bg-[#fff1f2] text-[#be123c]"
                  }`}
                >
                  {row.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[#c9d8d0] bg-[#f7fcf9] p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
          Pamainų rizikos
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-white p-4">
            <div className="font-black text-[#10251f]">
              {replacementNeededFte > 0
                ? `Reikia pavaduoti ${formatFte(replacementNeededFte)} et.`
                : "Pavadavimo poreikio nerasta"}
            </div>
            <div className="mt-1 text-sm font-bold text-[#047857]/70">
              Skaičiuojama pagal patvirtintus neatvykimus.
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-white p-4">
            <div className="font-black text-[#10251f]">
              Tikrinti minimalų pamainos komplektą
            </div>
            <div className="mt-1 text-sm font-bold text-[#047857]/70">
              Kitas etapas — lyginti grafiką su minimaliu pareigybių poreikiu.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FteSummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber" | "red";
}) {
  const classes =
    tone === "red"
      ? "border-[#fecdd3] bg-[#fff1f2] text-[#047857]"
      : tone === "amber"
        ? "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]"
        : "border-[#dbe6e0] bg-[#ffffff] text-[#10251f]";

  return (
    <article className={`rounded-2xl border p-4 ${classes}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </article>
  );
}


function TopMetric({
  title,
  value,
  meta,
  accent,
  onClick,
}: {
  title: string;
  value: string;
  meta: string;
  accent?: "emerald" | "amber" | "red";
  onClick: () => void;
}) {
  const valueClass = accent === "red"
    ? "text-[#b91c1c]"
    : accent === "amber"
      ? "text-[#be123c]"
      : accent === "emerald"
        ? "text-[#047857]"
        : "text-[#10251f]";

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-[#c9d8d0] bg-white p-4 text-left shadow-sm transition hover:border-emerald-200 hover:bg-[#ffffff]"
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-[#6a7e75]">{title}</p>
      <p className={`mt-1 text-2xl font-black ${valueClass}`}>{value}</p>
      <p className="text-xs font-bold text-[#6a7e75]">{meta}</p>
    </button>
  );
}

function CriticalStrip({
  icon,
  title,
  text,
  color,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  color: "red" | "amber" | "blue";
  onClick: () => void;
}) {
  const styles = {
    red: "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]",
    amber: "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]",
    blue: "border-[#c9d8d0] bg-[#f7fcf9] text-[#486b5d]",
  }[color];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md ${styles}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <span>
        <b className="block text-[#10251f]">{title}</b>
        <small className="font-bold opacity-80">{text}</small>
      </span>
    </button>
  );
}

function PriorityActionCard({
  title,
  desc,
  badge,
  color,
  onClick,
}: {
  title: string;
  desc: string;
  badge: string;
  color: "amber" | "red" | "blue" | "emerald";
  onClick: () => void;
}) {
  const accentStyles = {
    amber: "text-[#8f5f55]",
    red: "text-[#9b514d]",
    blue: "text-[#486b5d]",
    emerald: "text-[#047857]",
  }[color];

  return (
    <article className="rounded-2xl border border-[#dbe6e0] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-black uppercase tracking-[0.14em] ${accentStyles}`}>Dėmesio</p>
          <h3 className="mt-1 text-lg font-black text-[#10251f]">{title}</h3>
          <p className={`mt-1 text-sm font-bold ${accentStyles}`}>{desc}</p>
        </div>
        <span className={`shrink-0 rounded-full border border-[#dbe6e0] bg-white px-3 py-1 text-xs font-black ${accentStyles}`}>
          {badge}
        </span>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="mt-4 rounded-lg bg-[#486b5d] px-4 py-2 text-sm font-black text-white transition hover:bg-[#39594c]"
      >
        Atidaryti
      </button>
    </article>
  );
}
function CircularChart({
  value,
  label,
  stroke,
  size = 96,
}: {
  value: number;
  label: string;
  stroke: string;
  size?: number;
}) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamp(value, 0, 100) / 100) * circumference;

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} stroke="#e2e8f0" strokeWidth="10" fill="none" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-lg font-black">{label}</span>
    </div>
  );
}

function MiniCircularCard({
  eyebrow,
  title,
  meta,
  value,
  label,
  color,
  warm,
  danger,
}: {
  eyebrow: string;
  title: string;
  meta: string;
  value: number;
  label: string;
  color: string;
  warm?: boolean;
  danger?: boolean;
}) {
  return (
    <article className={`rounded-2xl border p-4 ${
      danger
        ? "border-[#fecdd3] bg-[#fff1f2]"
        : warm
          ? "border-[#fecdd3] bg-[#fff1f2]"
          : "border-[#dbe6e0] bg-[#ffffff]"
    }`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={`text-xs font-black uppercase tracking-[0.14em] ${
            danger ? "text-[#047857]" : warm ? "text-[#be123c]" : "text-[#6a7e75]"
          }`}>
            {eyebrow}
          </p>
          <h3 className="mt-1 text-lg font-black">{title}</h3>
          <p className={`mt-1 text-sm font-bold ${
            danger ? "text-[#047857]/75" : warm ? "text-[#9f1239]" : "text-[#6a7e75]"
          }`}>
            {meta}
          </p>
        </div>

        <CircularChart value={value} label={label} stroke={color} />
      </div>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-xl bg-[#ffffff] px-4 py-3 text-sm font-black">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ShiftBox({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${warn ? "bg-[#fff1f2] text-[#be123c]" : "bg-[#ffffff] text-[#10251f]"}`}>
      <p className="text-xs font-black uppercase tracking-[0.12em] opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function QuickLink({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between rounded-xl border border-[#dbe6e0] bg-[#ffffff] px-4 py-3 text-left font-black transition hover:bg-[#f7fcf9]"
    >
      <span>+ {title}</span>
      <ArrowRight className="h-5 w-5 text-[#6a7e75]" />
    </button>
  );
}

function RiskRow({
  label,
  value,
  hint,
  color,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  color: "red" | "amber" | "blue";
  onClick: () => void;
}) {
  const styles = {
    red: "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]",
    amber: "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]",
    blue: "border-[#c9d8d0] bg-[#f7fcf9] text-[#486b5d]",
  }[color];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-4 rounded-xl border p-3 text-left transition hover:shadow-sm ${value > 0 ? styles : "border-[#dbe6e0] bg-[#ffffff] text-[#486b5d]"}`}
    >
      <span>
        <b className="block text-[#10251f]">{label}</b>
        <small className="font-bold opacity-75">{hint}</small>
      </span>
      <span className="rounded-full bg-white px-3 py-1 text-sm font-black">{value}</span>
    </button>
  );
}

function TimelineItem({
  color,
  title,
  meta,
  warm,
  danger,
  blue,
}: {
  color: string;
  title: string;
  meta: string;
  warm?: boolean;
  danger?: boolean;
  blue?: boolean;
}) {
  return (
    <div className={`flex gap-3 rounded-xl border p-3 ${
      danger
        ? "border-[#fecdd3] bg-[#fff1f2]"
        : warm
          ? "border-[#fecdd3] bg-[#fff1f2]"
          : blue
            ? "border-[#c9d8d0] bg-[#f7fcf9]"
            : "border-[#dbe6e0] bg-[#ffffff]"
    }`}>
      <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div>
        <b>{title}</b>
        <p className={`text-sm font-bold ${danger ? "text-[#047857]/75" : warm ? "text-[#9f1239]" : blue ? "text-[#047857]/75" : "text-[#6a7e75]"}`}>
          {meta}
        </p>
      </div>
    </div>
  );
}

const DASHBOARD_HELP: Record<DashboardTab, {
  title: string;
  intro: string;
  steps: Array<[string, string, string]>;
}> = {
  overview: {
    title: "Kaip naudotis rodiklių apžvalga?",
    intro: "Čia matysite svarbiausią įstaigos dienos informaciją ir darbus, kuriems reikia dėmesio.",
    steps: [
      ["1", "Rodiklių kortelės", "Viršuje pateikiama gyventojų, užimtumo, darbuotojų, kvietimų, etatų, užduočių, mokymų ir dokumentų santrauka."],
      ["2", "Bendra situacija", "Apskritiminiai rodikliai parodo kambarių užimtumą, užpildytus etatus ir bendrą slaugos pajėgumą."],
      ["3", "Veiksmų centras", "Baltose kortelėse rodomi klausimai, kuriuos verta peržiūrėti arba išspręsti šiandien."],
      ["4", "Atidaryti", "Mygtukas nuveda tiesiai į atitinkamą valdymo langą."],
    ],
  },
  capacity: {
    title: "Kaip suprasti etatus ir pajėgumą?",
    intro: "Šiame lange matysite, kiek etatų suplanuota, užimta, laisva ir kiek darbuotojų laikinai nedirba.",
    steps: [
      ["1", "Planuota ir užimta", "Planuota rodo įstaigai nustatytą etatų poreikį, o užimta – kiek etatų šiuo metu padengta darbuotojais."],
      ["2", "Laisva", "Laisvų etatų skaičius parodo trūkstamą pajėgumą. Nulis reiškia, kad planas šiuo metu užpildytas."],
      ["3", "Pareigybių lentelė", "Kiekvienoje eilutėje matysite pareigybę, užimtų ir laisvų etatų santykį bei būseną."],
      ["4", "Pamainų rizikos", "Dešinėje rodoma, ar reikia pavadavimo ir ar šiandien yra neatvykusių darbuotojų. Spustelėkite kortelę išsamesnei peržiūrai."],
    ],
  },
  risks: {
    title: "Kaip peržiūrėti rizikas?",
    intro: "Rizikų lange surinkti įrašai, kuriems gali reikėti sprendimo, patvirtinimo arba papildomos patikros.",
    steps: [
      ["1", "Atostogų prašymai", "Matysite, kiek prašymų laukia sprendimo. Atidarykite kortelę, kad juos patvirtintumėte arba atmestumėte."],
      ["2", "Dokumentų terminai", "Rodomi nepatvirtinti dokumentų pakeitimai ir artėjantys galiojimo terminai."],
      ["3", "Kitos rizikos", "Kortelės parodo incidentus, vaistų įspėjimus ir kitus neatitikimus."],
      ["4", "Greiti veiksmai", "Dešinėje esančios nuorodos nuveda tiesiai į pasirinktą tikrinimo ar valdymo langą."],
    ],
  },
  activity: {
    title: "Kaip stebėti veiklą?",
    intro: "Čia pateikiama naujausia dienos eiga, užduočių būsena ir veiklų informacija.",
    steps: [
      ["1", "Dienos eiga", "Peržiūrėkite naujausius įvykius ir jų laiką."],
      ["2", "Užduotys", "Rodoma, kiek užduočių laukia atlikimo arba vėluoja."],
      ["3", "Veiklos", "Atidarykite veiklų modulį detalesnei gyventojų užimtumo peržiūrai."],
      ["4", "Atnaujinimas", "Naudokite viršuje esantį mygtuką „Atnaujinti“, kad gautumėte naujausius duomenis."],
    ],
  },
  documents: {
    title: "Kaip valdyti dokumentus?",
    intro: "Dokumentų lange matysite laukiančius pakeitimus, terminus ir darbuotojų patvirtinimus.",
    steps: [
      ["1", "Laukiantys pakeitimai", "Patikrinkite darbuotojų pateiktus dokumentų pakeitimus prieš juos patvirtindami."],
      ["2", "Galiojimo terminai", "Stebėkite, kurių dokumentų galiojimas artėja prie pabaigos."],
      ["3", "Patvirtinimai", "Atidarytame dokumentų sąraše prie laukiančio įrašo pasirinkite tinkamą veiksmą."],
      ["4", "Ataskaitos", "Dokumentų būseną galima peržiūrėti ir bendrose ataskaitose."],
    ],
  },
};

function HelpModal({ activeTab, onClose }: { activeTab: DashboardTab; onClose: () => void }) {
  const help = DASHBOARD_HELP[activeTab];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-[#c9d8d0] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-6 border-b border-[#dbe6e0] bg-white px-5 py-4">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#6a7e75]">
              Trumpa instrukcija
            </p>
            <h1 className="text-3xl font-black text-[#10251f] sm:text-4xl">{help.title}</h1>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-[#6a7e75]">{help.intro}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dbe6e0] bg-white text-2xl leading-none text-[#486b5d] transition hover:bg-[#f7fcf9]"
            aria-label="Uždaryti instrukciją"
          >
            ×
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto bg-white p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {help.steps.map(([number, title, desc]) => (
              <div key={number} className="rounded-xl border border-[#dbe6e0] bg-white p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9f7ef] text-lg font-black text-[#047857]">
                    {number}
                  </div>
                  <h3 className="text-xl font-black text-[#10251f]">{title}</h3>
                </div>
                <p className="text-sm font-bold leading-6 text-[#6a7e75]">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end border-t border-[#dbe6e0] bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#047857] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#065f46]"
          >
            Supratau
          </button>
        </div>
      </div>
    </div>
  );
}
function percentage(value: number, total: number) {
  if (!total || total <= 0) return 0;
  return clamp(Math.round((value / total) * 100), 0, 100);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isDateInRange(value: string | null | undefined, from: string, to: string) {
  if (!value) return false;
  const date = String(value).slice(0, 10);
  return date >= from && date <= to;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("lt-LT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
