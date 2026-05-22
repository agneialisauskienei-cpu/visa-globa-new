"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  ArrowRight,
  Building2,
  CalendarCheck,
  ClipboardList,
  Home,
  Info,
  Plus,
  RefreshCw,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type DashboardStats = {
  organizations: number;
  activeResidents: number;
  allResidents: number;
  activeEmployees: number;
  pendingTasks: number;
  pendingLeaves: number;
  expiringCertificates: number;
  completedTrainings: number;
  requiredTrainings: number;
  capacity: number | null;
};

const EMPTY_STATS: DashboardStats = {
  organizations: 0,
  activeResidents: 0,
  allResidents: 0,
  activeEmployees: 0,
  pendingTasks: 0,
  pendingLeaves: 0,
  expiringCertificates: 0,
  completedTrainings: 0,
  requiredTrainings: 0,
  capacity: null,
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const [embeddedFormRoute, setEmbeddedFormRoute] = useState<string | null>(null);

  async function loadStats() {
    setLoading(true);

    const [
      organizations,
      allResidents,
      activeResidents,
      activeEmployees,
      pendingTasks,
      pendingLeaves,
      expiringCertificates,
      trainingStats,
      capacity,
    ] = await Promise.all([
      safeCount("organizations"),
      safeCount("residents"),
      safeCount("residents", (q) => q.eq("is_active", true)),
      safeCount("organization_members", (q) => q.eq("is_active", true)),
      firstWorkingCount([
        () => safeCountResult("tasks", (q) => q.in("status", ["pending", "open", "todo", "new"])),
        () => safeCountResult("admin_tasks", (q) => q.in("status", ["pending", "open", "todo", "new"])),
        () => safeCountResult("requests", (q) => q.in("status", ["pending", "submitted", "new"])),
      ]),
      firstWorkingCount([
        () => safeCountResult("vacation_requests", (q) => q.in("status", ["pending", "submitted", "new"])),
        () => safeCountResult("leave_requests", (q) => q.in("status", ["pending", "submitted", "new"])),
        () => safeCountResult("absence_requests", (q) => q.in("status", ["pending", "submitted", "new"])),
      ]),
      countExpiringCertificates(),
      countTrainingProgress(),
      getOrganizationCapacity(),
    ]);

    const activeResidentsFixed = activeResidents || allResidents;

    setStats({
      organizations,
      allResidents,
      activeResidents: activeResidentsFixed,
      activeEmployees,
      pendingTasks,
      pendingLeaves,
      expiringCertificates,
      completedTrainings: trainingStats.completed,
      requiredTrainings: trainingStats.required,
      capacity,
    });

    setLastUpdated(new Date());
    setLoading(false);
  }

  useEffect(() => {
    void loadStats();
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

    return { occupancy, trainingCompletion };
  }, [stats]);

  return (

    <main className="min-h-screen bg-[#f8faf8] p-4 text-[#10251f] sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-xl border border-[#dbe6e0] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#e9f7ef] text-[#047857]">
                <Home className="h-7 w-7" />
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
                  Pagrindinis skydelis
                </p>

                <h1 className="mt-1 text-4xl font-black">
                  Pagrindinis skydelis
                </h1>

                <p className="mt-2 max-w-3xl text-sm font-bold text-[#6a7e75]">
                  Greita įstaigos statistika, personalo prioritetai ir pagrindiniai valdymo veiksmai.
                </p>

                <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-[#6a7e75]">
                  {lastUpdated ? `Atnaujinta: ${formatDateTime(lastUpdated)}` : "Kraunama statistika..."}
                </p>

                <button
                  type="button"
                  onClick={() => setShowHelp(true)}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-black text-[#047857] underline underline-offset-4 transition hover:text-[#065f46]"
                >
                  <Info className="h-4 w-4" />
                  Plačiau
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={loadStats}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-[#86efac] bg-[#e9f7ef] px-4 py-3 text-sm font-black text-[#047857] transition hover:bg-[#d8f3e3] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className="h-4 w-4" />
                Atnaujinti
              </button>

              <button
                type="button"
                onClick={() => router.push("/reports")}
                className="inline-flex items-center gap-2 rounded-xl bg-[#047857] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#065f46]"
              >
                <BarChart3 className="h-4 w-4" />
                Ataskaitos
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Building2 />}
            title="Įstaigos"
            value={loading ? "…" : String(stats.organizations)}
            meta={stats.organizations === 1 ? "Aktyvi" : "Aktyvios"}
            onClick={() => router.push("/organizations")}
          />
          <StatCard
            icon={<Users />}
            title="Gyventojai"
            value={loading ? "…" : String(stats.activeResidents)}
            meta={stats.capacity ? `iš ${stats.capacity}` : "aktyvūs"}
            onClick={() => router.push("/residents")}
          />
          <StatCard
            icon={<UserPlus />}
            title="Darbuotojai"
            value={loading ? "…" : String(stats.activeEmployees)}
            meta="aktyvūs"
            onClick={() => router.push("/team")}
          />
          <StatCard
            icon={<ClipboardList />}
            title="Užduotys"
            value={loading ? "…" : String(stats.pendingTasks)}
            meta={stats.pendingTasks ? "laukia" : "nėra"}
            onClick={() => router.push("/tasks")}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-4">
            <Card className="min-h-[286px]">
              <h2 className="text-2xl font-black">Greiti veiksmai</h2>
              <p className="mt-1 text-sm font-bold text-[#6a7e75]">
                Dažniausiai naudojamos administravimo operacijos.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <ActionCard title="Naujas gyventojas" desc="Pridėti gyventojo profilį" onClick={() => setEmbeddedFormRoute("/residents?newResident=1")} />
                <ActionCard title="Naujas darbuotojas" desc="Sukurti darbuotojo paskyrą" onClick={() => setEmbeddedFormRoute("/team?newEmployee=1")} />
                <ActionCard title="Nauja užduotis" desc="Sukurti užduotį" onClick={() => router.push("/tasks")} />
                <ActionCard title="Audit žurnalas" desc="Peržiūrėti pakeitimus" onClick={() => router.push("/audit")} />
              </div>
            </Card>

            <Card className="min-h-[370px]">
              <h2 className="text-2xl font-black">Naujausias aktyvumas</h2>
              <p className="mt-1 text-sm font-bold text-[#6a7e75]">
                Paskutiniai administraciniai veiksmai sistemoje.
              </p>

              <div className="mt-5 space-y-3">
                <ActivityItem title="Atnaujinta statistika" meta="Sistema · dabar" />
                <ActivityItem title="Aktyvių darbuotojų skaičius perskaičiuotas" meta={`Darbuotojai · ${stats.activeEmployees}`} />
                <ActivityItem title="Gyventojų užimtumas perskaičiuotas" meta={`Gyventojai · ${computed.occupancy}%`} />
                <ActivityItem title="Mokymų būsena perskaičiuota" meta={`Mokymai · ${computed.trainingCompletion}%`} />
              </div>
            </Card>
          </div>

          <div className="grid gap-4">
            <Card className="min-h-[286px]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">Šiandien</p>
                  <h2 className="mt-1 text-2xl font-black">Direktoriaus santrauka</h2>
                  <p className="mt-1 text-sm font-bold text-[#6a7e75]">Svarbiausi rodikliai ir veiksmai vienoje vietoje.</p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e9f7ef] text-[#047857]">
                  <CalendarCheck className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <SummaryCard title="Gyventojai" value={`${stats.activeResidents} aktyvūs`} />
                <SummaryCard title="Darbuotojai" value={`${stats.activeEmployees} aktyvūs`} />
                <SummaryCard title="Užduotys" value={`${stats.pendingTasks} laukia`} muted={stats.pendingTasks === 0} />
                <SummaryCard title="Atostogos" value={`${stats.pendingLeaves} laukia`} muted={stats.pendingLeaves === 0} />
              </div>
            </Card>

            <Card className="min-h-[370px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8a5a13]">Prioritetai</p>
                  <h2 className="mt-1 text-2xl font-black">Reikia dėmesio</h2>
                  <p className="mt-1 text-sm font-bold text-[#6a7e75]">Personalo, pažymų, mokymų ir atostogų klausimai.</p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#fff6df] text-[#8a5a13]">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <PriorityCard title="Mokymų užbaigimas" desc={`Privalomų mokymų užbaigimas: ${computed.trainingCompletion}%.`} color={computed.trainingCompletion < 70 ? "red" : "blue"} badge="Sekti" />
                <PriorityCard title="Baigiasi pažymos" desc={`${stats.expiringCertificates} pažym. baigiasi per 14 dienų.`} color={stats.expiringCertificates ? "red" : "emerald"} badge={stats.expiringCertificates ? "Skubu" : "Gerai"} />
                <PriorityCard title="Atostogų prašymai" desc={`${stats.pendingLeaves} praš. laukia patvirtinimo.`} color={stats.pendingLeaves ? "amber" : "emerald"} badge={stats.pendingLeaves ? "Peržiūrėti" : "Nėra"} />
                <PriorityCard title="Užimtumas" desc={`Gyventojų vietų užpildymas: ${computed.occupancy}%.`} color="blue" badge="Info" />
              </div>
            </Card>
          </div>
        </section>

        <section className="rounded-xl border border-[#dbe6e0] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">Statistika</p>
              <h2 className="mt-1 text-2xl font-black">Įstaigos rodikliai</h2>
              <p className="mt-1 text-sm font-bold text-[#6a7e75]">Greitai įvertinami rodikliai direktoriui.</p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/audit")}
              className="rounded-xl border border-[#dbe6e0] bg-white px-4 py-2 text-sm font-black text-[#486b5d] transition hover:bg-[#eef4f1]"
            >
              Peržiūrėti ataskaitą
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ChartCard title="Užimtumas" value={`${computed.occupancy}%`} progress={computed.occupancy} color="#047857" desc={stats.capacity ? `Užimta ${stats.activeResidents} iš ${stats.capacity} vietų.` : `${stats.activeResidents} aktyvūs gyventojai.`} />
            <ChartCard title="Mokymai" value={`${computed.trainingCompletion}%`} progress={computed.trainingCompletion} color="#047857" desc={`${stats.completedTrainings} iš ${stats.requiredTrainings} privalomų įrašų.`} />
            <ChartCard title="Pažymos" value={String(stats.expiringCertificates)} progress={clamp(stats.expiringCertificates * 20, 0, 100)} color="#b91c1c" desc="Baigiasi per 14 dienų." />
            <ChartCard title="Atostogos" value={String(stats.pendingLeaves)} progress={clamp(stats.pendingLeaves * 25, 0, 100)} color="#8a5a13" desc="Laukia sprendimo." />
          </div>
        </section>
      </div>
    
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-[#c9d8d0] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-6 border-b border-[#dbe6e0] bg-[#f8faf8] px-5 py-4">
              <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#6a7e75]">
                  Trumpa instrukcija
                </p>

                <h1 className="text-3xl font-black text-[#10251f] sm:text-4xl">
                  Kaip naudotis pagrindiniu skydeliu?
                </h1>

                <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-[#6a7e75]">
                  Čia matysi svarbiausią įstaigos dienos informaciją: užimtumą,
                  gyventojus, darbuotojus, užduotis ir įspėjimus.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dbe6e0] bg-white text-2xl leading-none text-[#486b5d] transition hover:bg-[#eef4f1]"
                aria-label="Uždaryti instrukciją"
              >
                ×
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto bg-white p-5">
              <div className="mb-4 rounded-xl border border-[#dbe6e0] bg-[#f8faf8] p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9f7ef] text-lg font-black text-[#047857]">
                    1
                  </div>

                  <h2 className="text-2xl font-black text-[#10251f]">
                    Pagrindinė santrauka
                  </h2>
                </div>

                <p className="max-w-4xl text-sm font-bold leading-6 text-[#6a7e75]">
                  Viršutiniai blokai parodo bendrą situaciją: kiek yra aktyvių
                  gyventojų, kiek vietų užimta kambariuose, kiek darbuotojų ir
                  kiek užduočių laukia dėmesio.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {["Gyventojai", "Užimtumas", "Darbuotojai", "Užduotys"].map((item) => (
                    <div key={item} className="rounded-xl border border-[#dbe6e0] bg-white px-4 py-3 shadow-sm">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6a7e75]">
                        Blokas
                      </p>
                      <p className="mt-1 text-base font-black text-[#10251f]">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[#dbe6e0] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ef] text-lg font-black text-[#315740]">
                      2
                    </div>

                    <h3 className="text-xl font-black text-[#10251f]">
                      Greiti veiksmai
                    </h3>
                  </div>

                  <p className="text-sm font-bold leading-6 text-[#6a7e75]">
                    Mygtukas „Greiti veiksmai“ leidžia pasirinkti, ką kurti: gyventoją,
                    darbuotoją, užduotį arba perdavimo įrašą.
                  </p>
                </div>

                <div className="rounded-xl border border-[#dbe6e0] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ef] text-lg font-black text-[#315740]">
                      3
                    </div>

                    <h3 className="text-xl font-black text-[#10251f]">
                      Užimtumo skaičiavimas
                    </h3>
                  </div>

                  <p className="text-sm font-bold leading-6 text-[#6a7e75]">
                    Užimtumas skaičiuojamas pagal kambarių vietas, o ne tik pagal
                    gyventojų skaičių. Jei vietų nėra, sistema parodo įspėjimą.
                  </p>
                </div>

                <div className="rounded-xl border border-[#dbe6e0] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ef] text-lg font-black text-[#315740]">
                      4
                    </div>

                    <h3 className="text-xl font-black text-[#10251f]">
                      Paspaudžiami blokai
                    </h3>
                  </div>

                  <p className="text-sm font-bold leading-6 text-[#6a7e75]">
                    Statistikos kortelės gali nuvesti į susijusią skiltį arba
                    parodyti detalesnę informaciją apie pasirinktą rodiklį.
                  </p>
                </div>

                <div className="rounded-xl border border-[#ead9b2] bg-[#fffdf8] p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff6df] text-lg font-black text-[#8a5a13]">
                      5
                    </div>

                    <h3 className="text-xl font-black text-[#10251f]">
                      Įspėjimai
                    </h3>
                  </div>

                  <p className="text-sm font-bold leading-6 text-[#7a6a4f]">
                    Geltoni arba raudoni pranešimai rodo, kad reikia patikrinti
                    trūkstamus duomenis, neatliktas užduotis arba sistemos klaidas.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-[#dbe6e0] bg-[#f8faf8] px-5 py-4">
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="rounded-xl bg-[#047857] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#065f46]"
              >
                Supratau
              </button>
            </div>
          </div>
        </div>
      )}

    
      {embeddedFormRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-[#c9d8d0] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#dbe6e0] bg-[#f8faf8] px-5 py-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#047857]">
                  Greitas veiksmas
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#10251f]">
                  {embeddedFormRoute.startsWith("/residents") ? "Naujas gyventojas" : "Naujas darbuotojas"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEmbeddedFormRoute(null);
                  void loadStats();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dbe6e0] bg-white text-[#486b5d] transition hover:bg-[#eef4f1]"
                aria-label="Uždaryti"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <iframe
              title={embeddedFormRoute.startsWith("/residents") ? "Naujo gyventojo forma" : "Naujo darbuotojo forma"}
              src={embeddedFormRoute}
              className="h-full w-full flex-1 border-0"
            />
          </div>
        </div>
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
    () => safeCountResult("employee_trainings", (q) => q.not("completed_at", "is", null)),
    () => safeCountResult("staff_trainings", (q) => q.not("completed_at", "is", null)),
    () => safeCountResult("training_records", (q) => q.not("completed_at", "is", null)),
  ]);

  const requiredRows = await firstWorkingCount([
    () => safeCountResult("employee_trainings"),
    () => safeCountResult("staff_trainings"),
    () => safeCountResult("training_records"),
  ]);

  const roleRequirements = await firstWorkingCount([
    () => safeCountResult("role_training_requirements"),
    () => safeCountResult("position_training_requirements"),
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
    const { data, error } = await supabase.from("organizations").select("*").limit(1).maybeSingle();
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

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <article className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>{children}</article>;
}

function StatCard({ icon, title, value, meta, onClick }: { icon: ReactNode; title: string; value: string; meta: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 [&>svg]:h-6 [&>svg]:w-6">{icon}</div>
        <div>
          <p className="font-extrabold text-slate-500">{title}</p>
          <p className="mt-1 text-4xl font-black">
            {value} <span className="text-sm font-bold text-emerald-700">{meta}</span>
          </p>
        </div>
      </div>
    </button>
  );
}

function ActionCard({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50">
      <span>
        <b>{title}</b>
        <br />
        <small className="font-semibold text-slate-500">{desc}</small>
      </span>
      <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
    </button>
  );
}

function ActivityItem({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-100 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-600">
        <CalendarCheck className="h-5 w-5" />
      </div>
      <div>
        <b>{title}</b>
        <p className="text-sm font-bold text-slate-500">{meta}</p>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, muted = false }: { title: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="font-black text-slate-800">{title}</p>
      <p className={`mt-1 text-sm font-black ${muted ? "text-slate-600" : "text-emerald-700"}`}>{value}</p>
    </div>
  );
}

function PriorityCard({ title, desc, badge, color }: { title: string; desc: string; badge: string; color: "amber" | "red" | "blue" | "emerald" }) {
  const colorClass = {
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    red: "border-red-100 bg-red-50 text-red-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  }[color];

  return (
    <div className={`flex items-start justify-between gap-4 rounded-2xl border p-4 ${colorClass}`}>
      <div>
        <p className="font-black text-slate-900">{title}</p>
        <p className="mt-1 text-sm font-semibold text-slate-600">{desc}</p>
      </div>
      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-black">{badge}</span>
    </div>
  );
}

function ChartCard({ title, value, progress, color, desc }: { title: string; value: string; progress: number; color: string; desc: string }) {
  const circumference = 301;
  const offset = circumference - (clamp(progress, 0, 100) / 100) * circumference;

  return (
    <article className="group overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wider text-slate-500">{title}</p>
          <h3 className="mt-2 text-4xl font-black tracking-tight">{value}</h3>
        </div>

        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
          <svg className="-rotate-90 transform" width="96" height="96" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="48" stroke="#e2e8f0" strokeWidth="10" fill="none" />
            <circle cx="60" cy="60" r="48" stroke={color} strokeWidth="10" strokeLinecap="round" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} />
          </svg>
          <span className="absolute text-lg font-black">{value}</span>
        </div>
      </div>

      <p className="mt-4 text-sm font-semibold text-slate-500">{desc}</p>
    </article>
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
