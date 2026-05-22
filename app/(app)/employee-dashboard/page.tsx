"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MobileEmployeeDashboard from "@/components/mobile/MobileEmployeeDashboard";
import { supabase } from "@/lib/supabase";
import {
  ArrowRight,
  BadgeAlert,
  Bell,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Info,
  Loader2,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";

type ViewKey =
  | "profile"
  | "schedule"
  | "tasks"
  | "notifications"
  | "residents"
  | "trainings"
  | "documents";

type Toast = {
  title: string;
  message: string;
};

type EmployeeTask = {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  created_at?: string | null;
};

type EmployeeSchedule = {
  id: string;
  shift_date?: string | null;
  date?: string | null;
  work_date?: string | null;
  schedule_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  department?: string | null;
  position?: string | null;
  status?: string | null;
  is_published?: boolean | null;
  published_at?: string | null;
};

type NotificationRow = {
  id: string;
  title?: string | null;
  message?: string | null;
  body?: string | null;
  type?: string | null;
  is_read?: boolean | null;
  read_at?: string | null;
  created_at?: string | null;
};

type TrainingRow = {
  id: string;
  title?: string | null;
  training_name?: string | null;
  name?: string | null;
  completed_at?: string | null;
  valid_until?: string | null;
  hours?: number | string | null;
  status?: string | null;
};

type AssignedResident = {
  id: string;
  resident_id?: string | null;
  resident_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  first_name_encrypted?: string | null;
  last_name_encrypted?: string | null;
  room_name?: string | null;
  current_room_id?: string | null;
  current_status?: string | null;
  care_level?: string | null;
  residents?: {
    id?: string | null;
    resident_code?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    first_name_encrypted?: string | null;
    last_name_encrypted?: string | null;
    current_status?: string | null;
    care_level?: string | null;
  } | null;
};

type ProfileRow = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  position?: string | null;
  department?: string | null;
  license_number?: string | null;
  license_until?: string | null;
  health_certificate_until?: string | null;
};

export default function EmployeeDashboardPage() {
  const [activeView, setActiveView] = useState<ViewKey>("profile");
  const [modal, setModal] = useState<ViewKey | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [schedule, setSchedule] = useState<EmployeeSchedule[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [trainings, setTrainings] = useState<TrainingRow[]>([]);
  const [assignedResidents, setAssignedResidents] = useState<AssignedResident[]>([]);
  const [selectedTask, setSelectedTask] = useState<EmployeeTask | null>(null);

  const [contactForm, setContactForm] = useState({
    phone: "",
    email: "",
    address: "",
  });

  const [documentForm, setDocumentForm] = useState({
    healthCertificateUntil: "",
    licenseUntil: "",
    licenseNumber: "",
  });

  const [documentsPendingApproval, setDocumentsPendingApproval] =
    useState(false);
  const [contactPendingApproval, setContactPendingApproval] = useState(false);

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`employee-dashboard-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => void loadDashboard(false),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "employee_tasks",
          filter: `assigned_user_id=eq.${userId}`,
        },
        () => void loadDashboard(false),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "employee_schedules",
        },
        () => void loadDashboard(false),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "resident_assignments",
        },
        () => void loadDashboard(false),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function safeSelect<T>(
    query: PromiseLike<{ data: T[] | null; error: any }>,
  ) {
    const { data, error } = await query;
    if (error) {
      console.warn("[employee-dashboard] query skipped:", error.message);
      return [] as T[];
    }
    return data || [];
  }

  function getScheduleDate(shift: EmployeeSchedule) {
    return shift.shift_date || shift.date || shift.work_date || shift.schedule_date || "";
  }

  function getScheduleStart(shift: EmployeeSchedule) {
    return shift.start_time || shift.shift_start || shift.starts_at || "";
  }

  function isSchedulePublished(shift: EmployeeSchedule) {
    const status = String(shift.status || "").toLowerCase();
    return shift.is_published === true || status === "published" || status === "paskelbta" || status === "approved";
  }

  async function loadEmployeeSchedule(userId: string, memberId?: string | null) {
    const today = new Date();
    const in14Days = new Date();
    in14Days.setDate(today.getDate() + 14);

    const todayIso = today.toISOString().slice(0, 10);
    const in14DaysIso = in14Days.toISOString().slice(0, 10);

    const candidates: Array<{ column: string; value: string }> = [
      { column: "user_id", value: userId },
      { column: "assigned_user_id", value: userId },
      { column: "staff_user_id", value: userId },
      { column: "employee_id", value: userId },
    ];

    if (memberId) {
      candidates.push({ column: "organization_member_id", value: memberId });
      candidates.push({ column: "member_id", value: memberId });
      candidates.push({ column: "employee_id", value: memberId });
    }

    for (const candidate of candidates) {
      const { data, error } = await supabase
        .from("employee_schedules")
        .select("*")
        .eq(candidate.column, candidate.value)
        .limit(120);

      if (error) {
        console.warn(
          `[employee-dashboard] schedule skipped ${candidate.column}:`,
          error.message,
        );
        continue;
      }

      const publishedRows = ((data || []) as EmployeeSchedule[])
        .filter(isSchedulePublished)
        .sort((a, b) => {
          const aKey = `${getScheduleDate(a)} ${getScheduleStart(a)}`;
          const bKey = `${getScheduleDate(b)} ${getScheduleStart(b)}`;
          return aKey.localeCompare(bKey);
        });

      const upcomingRows = publishedRows
        .filter((shift) => {
          const date = getScheduleDate(shift);
          if (!date) return true;
          const normalized = date.slice(0, 10);
          return normalized >= todayIso && normalized <= in14DaysIso;
        })
        .slice(0, 10);

      if (upcomingRows.length) return upcomingRows;

      const recentRows = publishedRows
        .filter((shift) => {
          const date = getScheduleDate(shift);
          if (!date) return false;
          return date.slice(0, 10) < todayIso;
        })
        .slice(-10)
        .reverse();

      if (recentRows.length) return recentRows;
    }

    return [] as EmployeeSchedule[];
  }

  function normalizeAssignedResident(row: AssignedResident): AssignedResident {
    const nested = row.residents || null;
    return {
      ...row,
      id: String(nested?.id || row.resident_id || row.id),
      resident_code: nested?.resident_code || row.resident_code || null,
      first_name: nested?.first_name || row.first_name || null,
      last_name: nested?.last_name || row.last_name || null,
      first_name_encrypted:
        nested?.first_name_encrypted || row.first_name_encrypted || null,
      last_name_encrypted:
        nested?.last_name_encrypted || row.last_name_encrypted || null,
      current_status: nested?.current_status || row.current_status || null,
      care_level: nested?.care_level || row.care_level || null,
    };
  }

  async function loadAssignedResidents(userId: string, memberId?: string | null) {
    const assignmentCandidates: Array<{ column: string; value: string }> = [
      { column: "assigned_user_id", value: userId },
      { column: "user_id", value: userId },
      { column: "employee_id", value: userId },
      { column: "staff_user_id", value: userId },
    ];

    if (memberId) {
      assignmentCandidates.push({ column: "organization_member_id", value: memberId });
      assignmentCandidates.push({ column: "member_id", value: memberId });
      assignmentCandidates.push({ column: "employee_id", value: memberId });
    }

    for (const candidate of assignmentCandidates) {
      const { data, error } = await supabase
        .from("resident_assignments")
        .select("*, residents(*)")
        .eq(candidate.column, candidate.value)
        .limit(20);

      if (error) {
        console.warn(
          `[employee-dashboard] resident assignments skipped ${candidate.column}:`,
          error.message,
        );
        continue;
      }

      const rows = ((data || []) as AssignedResident[]).map(normalizeAssignedResident);
      if (rows.length) return rows;
    }

    for (const column of ["assigned_user_id", "responsible_user_id", "employee_id", "social_worker_id", "nurse_user_id"]) {
      const { data, error } = await supabase
        .from("residents")
        .select("*")
        .eq(column, userId)
        .limit(20);

      if (error) {
        console.warn(
          `[employee-dashboard] residents skipped ${column}:`,
          error.message,
        );
        continue;
      }

      const rows = ((data || []) as AssignedResident[]).map(normalizeAssignedResident);
      if (rows.length) return rows;
    }

    return [] as AssignedResident[];
  }

  async function loadDashboard(showLoader = true) {
    if (showLoader) setLoading(true);
    setLoadError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const [
        profileData,
        membershipData,
        tasksData,
        notificationsData,
        trainingData,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "full_name, first_name, last_name, email, phone, address, license_number, license_until, health_certificate_until",
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("organization_members")
          .select("id, position, department")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),
        safeSelect<EmployeeTask>(
          supabase
            .from("employee_tasks")
            .select("*")
            .or(
              `assigned_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`,
            )
            .neq("status", "done")
            .order("due_date", { ascending: true, nullsFirst: false })
            .limit(12),
        ),
        safeSelect<NotificationRow>(
          supabase
            .from("notifications")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(12),
        ),
        safeSelect<TrainingRow>(
          supabase
            .from("training_records")
            .select("*")
            .eq("employee_id", user.id)
            .order("valid_until", { ascending: true, nullsFirst: false })
            .limit(10),
        ),
      ]);

      if (profileData.error)
        console.warn(
          "[employee-dashboard] profile:",
          profileData.error.message,
        );
      if (membershipData.error)
        console.warn(
          "[employee-dashboard] membership:",
          membershipData.error.message,
        );

      const memberId = (membershipData.data as any)?.id || null;
      const loadedSchedule = await loadEmployeeSchedule(user.id, memberId);
      const loadedResidents = await loadAssignedResidents(user.id, memberId);

      const mergedProfile: ProfileRow = {
        ...(profileData.data || {}),
        ...(membershipData.data || {}),
        email: profileData.data?.email || user.email || null,
      };

      setProfile(mergedProfile);
      setTasks(tasksData);
      setNotifications(notificationsData);
      setSchedule(loadedSchedule);
      setTrainings(trainingData);
      setAssignedResidents(loadedResidents);

      setContactForm({
        phone: mergedProfile.phone || "",
        email: mergedProfile.email || user.email || "",
        address: mergedProfile.address || "",
      });

      setDocumentForm({
        healthCertificateUntil: mergedProfile.health_certificate_until || "",
        licenseUntil: mergedProfile.license_until || "",
        licenseNumber: mergedProfile.license_number || "",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nepavyko įkelti darbuotojo duomenų.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }

  const openSection = (view: ViewKey) => {
    setActiveView(view);
    setModal(view);
  };

  const showToast = (title: string, message: string) => {
    setToast({ title, message });
    window.setTimeout(() => setToast(null), 3200);
  };

  async function submitDocuments() {
    setDocumentsPendingApproval(true);
    setModal(null);
    setActiveView("documents");
    showToast(
      "Pateikta administratoriui",
      "Dokumentų pakeitimai laukia administratoriaus patvirtinimo.",
    );

    if (!userId) return;

    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      title: "Dokumentų pakeitimai pateikti",
      message: "Dokumentų pakeitimai laukia administratoriaus patvirtinimo.",
      type: "documents",
      is_read: false,
    });

    if (error)
      console.warn(
        "[employee-dashboard] notification insert failed:",
        error.message,
      );
  }

  async function submitContacts() {
    setContactPendingApproval(true);
    setModal(null);
    setActiveView("profile");
    showToast(
      "Kontaktai pateikti",
      "Kontaktų pakeitimai laukia administratoriaus patvirtinimo.",
    );

    if (!userId) return;

    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      title: "Kontaktų pakeitimai pateikti",
      message: "Kontaktų pakeitimai laukia administratoriaus patvirtinimo.",
      type: "profile",
      is_read: false,
    });

    if (error)
      console.warn(
        "[employee-dashboard] notification insert failed:",
        error.message,
      );
  }

  async function markNotificationsRead() {
    if (!userId) return;

    const unreadIds = notifications
      .filter((item) => !item.is_read && !item.read_at)
      .map((item) => item.id);

    if (unreadIds.length) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in("id", unreadIds);

      if (error)
        console.warn(
          "[employee-dashboard] notifications update failed:",
          error.message,
        );
    }

    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        is_read: true,
        read_at: item.read_at || new Date().toISOString(),
      })),
    );
    showToast(
      "Pranešimai atnaujinti",
      "Visi pranešimai pažymėti kaip perskaityti.",
    );
  }

  async function completeTask(taskId: string) {
    const previousTasks = tasks;

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    showToast("Užduotis įvykdyta", "Užduotis pažymėta kaip atlikta.");

    const { error } = await supabase
      .from("employee_tasks")
      .update({ status: "done" })
      .eq("id", taskId);

    if (error) {
      console.warn("[employee-dashboard] task complete failed:", error.message);
      setTasks(previousTasks);
      showToast(
        "Nepavyko pažymėti",
        "Patikrink, ar employee_tasks turi status stulpelį ir ar RLS leidžia darbuotojui atnaujinti savo užduotį.",
      );
      return;
    }

    void loadDashboard(false);
  }

  const displayName = useMemo(() => {
    return (
      profile?.full_name ||
      [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      profile?.email ||
      "Darbuotojau"
    );
  }, [profile]);

  const unreadNotifications = notifications.filter(
    (item) => !item.is_read && !item.read_at,
  );
  const expiringTrainings = trainings.filter((item) =>
    isExpiringSoon(item.valid_until),
  );

  const documentProgress = useMemo(() => {
    const total = 3;
    const filled = [
      documentForm.healthCertificateUntil,
      documentForm.licenseUntil,
      documentForm.licenseNumber,
    ].filter(Boolean).length;
    return Math.round((filled / total) * 100);
  }, [documentForm]);

  const nextShift = schedule[0];

  return (
    <>
      <div className="lg:hidden">
        <MobileEmployeeDashboard />
      </div>

      <div className="hidden lg:block">
        <main className="min-h-screen overflow-x-hidden bg-slate-50 px-3 py-4 text-slate-950 sm:px-5 sm:py-6 lg:px-6">
          <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6 lg:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3 sm:gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 sm:h-16 sm:w-16 sm:rounded-3xl">
                    <UserRound className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>

                  <div>
                    <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                      Darbuotojo paskyra
                    </p>
                    <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
                      Sveiki, {displayName}
                    </h1>
                    <p className="mt-2 text-base font-semibold text-slate-500 sm:text-lg">
                      Pamainos, užduotys, mokymai, dokumentai ir pranešimai
                      vienoje vietoje.
                    </p>
                  </div>
                </div>

                <div className="grid w-full gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:max-w-sm sm:rounded-3xl sm:p-5 lg:min-w-[260px]">
                  <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
                    <span className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
                      Pareigos
                    </span>
                    <strong className="text-right text-slate-950">
                      {profile?.position || "Darbuotojas"}
                    </strong>
                  </div>
                  <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
                    <span className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
                      Skyrius
                    </span>
                    <strong className="text-right text-slate-950">
                      {profile?.department || "Nenurodyta"}
                    </strong>
                  </div>
                </div>
              </div>

              {loadError && (
                <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  Nepavyko įkelti dalies duomenų: {loadError}
                </div>
              )}
            </section>

            <section className="grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:grid-cols-4 sm:rounded-3xl sm:p-5">
              <TodayItem
                title="Šiandien / artimiausia pamaina"
                value={nextShift ? formatShift(nextShift) : "Pamainų nerasta"}
              />
              <TodayItem title="Atviros užduotys" value={`${tasks.length}`} />
              <TodayItem
                title="Nauji pranešimai"
                value={`${unreadNotifications.length}`}
              />
              <TodayItem
                title="Baigiantys mokymai"
                value={`${expiringTrainings.length}`}
              />
            </section>

            <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 xl:gap-5">
              <StatCard
                icon={<GraduationCap className="h-6 w-6" />}
                title="Mokymai"
                value={trainings.length.toString()}
                meta="įrašų"
                tone="emerald"
                active={activeView === "trainings"}
                onClick={() => openSection("trainings")}
              />
              <StatCard
                icon={<BadgeAlert className="h-6 w-6" />}
                title="Baigiasi"
                value={expiringTrainings.length.toString()}
                meta="mokymų"
                tone="amber"
                active={activeView === "trainings"}
                onClick={() => openSection("trainings")}
              />
              <StatCard
                icon={<ClipboardList className="h-6 w-6" />}
                title="Užduotys"
                value={tasks.length.toString()}
                meta="atviros"
                tone="blue"
                active={activeView === "tasks"}
                onClick={() => openSection("tasks")}
              />
              <StatCard
                icon={<Bell className="h-6 w-6" />}
                title="Pranešimai"
                value={unreadNotifications.length.toString()}
                meta="naujų"
                tone="rose"
                active={activeView === "notifications"}
                onClick={() => openSection("notifications")}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-2 xl:gap-6">
              <div className="grid gap-6">
                <Card className="min-h-[286px]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-black tracking-tight">
                        Greiti veiksmai
                      </h2>
                      <p className="mt-1 font-semibold text-slate-500">
                        Dažniausiai naudojami darbuotojo veiksmai.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadDashboard()}
                      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                      aria-label="Atnaujinti"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  <div className="mt-5 grid flex-1 gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4">
                    <ActionCard
                      title="Mano profilis"
                      desc="Kontaktai ir dokumentai"
                      active={activeView === "profile"}
                      onClick={() => openSection("profile")}
                    />
                    <ActionCard
                      title="Mano grafikas"
                      desc="Pamainos ir atostogos"
                      active={activeView === "schedule"}
                      onClick={() => openSection("schedule")}
                    />
                    <ActionCard
                      title="Mano užduotys"
                      desc="Atviros ir suplanuotos"
                      active={activeView === "tasks"}
                      onClick={() => openSection("tasks")}
                    />
                    <ActionCard
                      title="Mano gyventojai"
                      desc={`${assignedResidents.length} priskirta`}
                      active={activeView === "residents"}
                      onClick={() => openSection("residents")}
                    />
                    <ActionCard
                      title="Pranešimai"
                      desc="Sistemos naujienos"
                      active={activeView === "notifications"}
                      onClick={() => openSection("notifications")}
                    />
                  </div>
                </Card>

                <Card className="min-h-[370px]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div>
                      <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                        Užduotys
                      </p>
                      <h2 className="mt-1 text-2xl font-black tracking-tight">
                        Mano užduotys
                      </h2>
                      <p className="mt-1 font-semibold text-slate-500">
                        Atviros užduotys ir terminai.
                      </p>
                    </div>
                    <Link
                      href="/tasks"
                      className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-200"
                    >
                      Atidaryti
                    </Link>
                  </div>

                  <div className="mt-5 flex-1 space-y-3">
                    {tasks.length ? (
                      tasks
                        .slice(0, 4)
                        .map((task) => (
                          <TaskItem
                            key={task.id}
                            task={task}
                            onOpen={() => setSelectedTask(task)}
                            onComplete={() => void completeTask(task.id)}
                          />
                        ))
                    ) : (
                      <EmptyBlock
                        icon={<ClipboardList className="h-7 w-7" />}
                        title="Atvirų užduočių nėra"
                        desc="Kai vadovas priskirs užduotį, ji atsiras čia."
                      />
                    )}
                  </div>
                </Card>
              </div>

              <div className="grid gap-6">
                <Card className="min-h-[286px]">
                  <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
                    <div>
                      <p className="text-sm font-extrabold uppercase tracking-widest text-amber-600">
                        Dokumentai
                      </p>
                      <h2 className="mt-1 text-2xl font-black tracking-tight">
                        Dokumentų būsena
                      </h2>
                      <p className="mt-1 font-semibold text-slate-500">
                        Pažymos, licencijos ir privalomi dokumentai.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openSection("documents")}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 transition hover:bg-amber-100"
                      aria-label="Atidaryti dokumentus"
                    >
                      <FileCheck2 className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="mt-5 grid flex-1 gap-3 sm:mt-6">
                    <DocumentRow
                      title="Sveikatos pažyma"
                      desc={
                        documentForm.healthCertificateUntil
                          ? `Galioja iki: ${documentForm.healthCertificateUntil}`
                          : "Galiojimas nenurodytas"
                      }
                      badge={
                        documentForm.healthCertificateUntil
                          ? "Užpildyta"
                          : "Nenurodyta"
                      }
                      tone={
                        documentForm.healthCertificateUntil
                          ? "emerald"
                          : "slate"
                      }
                      onClick={() => openSection("documents")}
                    />
                    <DocumentRow
                      title="Profesinė licencija"
                      desc={
                        documentForm.licenseUntil
                          ? `Galioja iki: ${documentForm.licenseUntil}`
                          : "Galiojimas nenurodytas"
                      }
                      badge={
                        documentForm.licenseUntil ? "Užpildyta" : "Nenurodyta"
                      }
                      tone={documentForm.licenseUntil ? "emerald" : "slate"}
                      onClick={() => openSection("documents")}
                    />
                    <DocumentRow
                      title="Licencijos numeris"
                      desc={
                        documentForm.licenseNumber || "Trūksta įrašo profilyje"
                      }
                      badge={
                        documentForm.licenseNumber ? "Užpildyta" : "Trūksta"
                      }
                      tone={documentForm.licenseNumber ? "emerald" : "amber"}
                      onClick={() => openSection("documents")}
                    />
                  </div>

                  {documentsPendingApproval && (
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                      Pakeitimai pateikti administratoriui patvirtinti.
                    </div>
                  )}
                </Card>

                <Card className="min-h-[370px]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div>
                      <p className="text-sm font-extrabold uppercase tracking-widest text-blue-700">
                        Grafikas
                      </p>
                      <h2 className="mt-1 text-2xl font-black tracking-tight">
                        Artimiausios pamainos
                      </h2>
                      <p className="mt-1 font-semibold text-slate-500">
                        Tavo suplanuotos pamainos per artimiausias 14 dienų.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openSection("schedule")}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                      aria-label="Atidaryti grafiką"
                    >
                      <CalendarDays className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="mt-6 flex-1 space-y-3">
                    {schedule.length ? (
                      schedule
                        .slice(0, 5)
                        .map((shift) => (
                          <ShiftItem key={shift.id} shift={shift} />
                        ))
                    ) : (
                      <EmptyBlock
                        icon={<CalendarX className="h-7 w-7" />}
                        title="Artimiausių pamainų nerasta"
                        desc="Kai grafikas bus suplanuotas, pamainos atsiras čia."
                      />
                    )}
                  </div>
                </Card>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                    Asmeninė statistika
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Mano rodikliai
                  </h2>
                  <p className="mt-1 font-semibold text-slate-500">
                    Greita asmeninės būsenos ir darbo informacijos apžvalga.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openSection("profile")}
                  className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-200"
                >
                  Peržiūrėti profilį
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4 xl:gap-6">
                <ChartCard
                  title="Mokymai"
                  value={`${trainings.length}`}
                  progress={trainings.length ? 100 : 0}
                  desc="Užregistruoti mokymai."
                  onClick={() => openSection("trainings")}
                />
                <ChartCard
                  title="Dokumentai"
                  value={`${documentProgress}%`}
                  progress={documentProgress}
                  desc="Užpildytų dokumentų būsena."
                  onClick={() => openSection("documents")}
                />
                <ChartCard
                  title="Užduotys"
                  value={`${tasks.length}`}
                  progress={Math.min(tasks.length * 20, 100)}
                  desc="Atviros užduotys šiuo metu."
                  onClick={() => openSection("tasks")}
                />
                <ChartCard
                  title="Pranešimai"
                  value={`${unreadNotifications.length}`}
                  progress={Math.min(unreadNotifications.length * 25, 100)}
                  desc="Neskaityti sistemos pranešimai."
                  onClick={() => openSection("notifications")}
                />
              </div>
            </section>
          </div>

          {modal === "profile" && (
            <Modal
              title="Mano profilis"
              desc="Kontaktinė informacija ir asmeniniai duomenys."
              onClose={() => setModal(null)}
            >
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitContacts();
                }}
              >
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Telefonas">
                      <input
                        value={contactForm.phone}
                        onChange={(e) =>
                          setContactForm((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        className="input"
                        placeholder="+370..."
                      />
                    </Field>
                    <Field label="El. paštas">
                      <input
                        value={contactForm.email}
                        onChange={(e) =>
                          setContactForm((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        className="input"
                        type="email"
                        placeholder="vardas@example.com"
                      />
                    </Field>
                    <Field label="Adresas" full>
                      <input
                        value={contactForm.address}
                        onChange={(e) =>
                          setContactForm((prev) => ({
                            ...prev,
                            address: e.target.value,
                          }))
                        }
                        className="input"
                        placeholder="Adresas"
                      />
                    </Field>
                  </div>
                </div>
                <InfoBox text="Kontaktų pakeitimai bus pateikti administratoriui patvirtinti." />
                {contactPendingApproval && (
                  <InfoBox text="Kontaktų pakeitimai jau pateikti administratoriui patvirtinti." />
                )}
                <ModalFooter
                  onCancel={() => setModal(null)}
                  submitText="Pateikti patvirtinimui"
                />
              </form>
            </Modal>
          )}

          {modal === "documents" && (
            <Modal
              title="Dokumentai"
              desc="Atnaujinkite pažymų ir licencijų informaciją. Pakeitimai bus pateikti administratoriui."
              onClose={() => setModal(null)}
            >
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitDocuments();
                }}
              >
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Licencijos numeris" full>
                      <input
                        value={documentForm.licenseNumber}
                        onChange={(e) =>
                          setDocumentForm((prev) => ({
                            ...prev,
                            licenseNumber: e.target.value,
                          }))
                        }
                        className="input"
                        placeholder="Pvz., 2412"
                      />
                    </Field>
                    <Field label="Licencija galioja iki">
                      <input
                        value={documentForm.licenseUntil}
                        onChange={(e) =>
                          setDocumentForm((prev) => ({
                            ...prev,
                            licenseUntil: e.target.value,
                          }))
                        }
                        className="input"
                        type="date"
                      />
                    </Field>
                    <Field label="Med. pažyma galioja iki">
                      <input
                        value={documentForm.healthCertificateUntil}
                        onChange={(e) =>
                          setDocumentForm((prev) => ({
                            ...prev,
                            healthCertificateUntil: e.target.value,
                          }))
                        }
                        className="input"
                        type="date"
                      />
                    </Field>
                  </div>
                </div>
                <InfoBox text="Įrašas bus pateiktas administratoriui patvirtinti, kad dokumentai buvo matyti." />
                <ModalFooter
                  onCancel={() => setModal(null)}
                  submitText="Pateikti patvirtinimui"
                />
              </form>
            </Modal>
          )}

          {modal === "schedule" && (
            <Modal
              title="Mano grafikas"
              desc="Pamainos ir atostogų informacija."
              onClose={() => setModal(null)}
            >
              <div className="space-y-3">
                {schedule.length ? (
                  schedule.map((shift) => (
                    <ShiftItem key={shift.id} shift={shift} />
                  ))
                ) : (
                  <EmptyBlock
                    icon={<CalendarX className="h-7 w-7" />}
                    title="Artimiausių pamainų nerasta"
                    desc="Kai grafikas bus suplanuotas, pamainos atsiras čia."
                  />
                )}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setModal(null)}
                  className="btn-primary"
                  type="button"
                >
                  Uždaryti
                </button>
              </div>
            </Modal>
          )}

          {modal === "tasks" && (
            <Modal
              title="Mano užduotys"
              desc="Atviros ir suplanuotos užduotys."
              onClose={() => setModal(null)}
            >
              <div className="space-y-3">
                {tasks.length ? (
                  tasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onOpen={() => setSelectedTask(task)}
                      onComplete={() => void completeTask(task.id)}
                    />
                  ))
                ) : (
                  <EmptyBlock
                    icon={<ClipboardList className="h-7 w-7" />}
                    title="Šiuo metu atvirų užduočių nėra"
                    desc="Naujos užduotys atsiras šiame lange."
                  />
                )}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setModal(null)}
                  className="btn-primary"
                  type="button"
                >
                  Uždaryti
                </button>
              </div>
            </Modal>
          )}

          {modal === "trainings" && (
            <Modal
              title="Mano mokymai"
              desc="Mokymų galiojimas ir sukauptos valandos."
              onClose={() => setModal(null)}
            >
              <div className="space-y-3">
                {trainings.length ? (
                  trainings.map((training) => (
                    <TrainingItem key={training.id} training={training} />
                  ))
                ) : (
                  <EmptyBlock
                    icon={<GraduationCap className="h-7 w-7" />}
                    title="Mokymų įrašų nėra"
                    desc="Kai administratorius pridės ar patvirtins mokymus, jie atsiras čia."
                  />
                )}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setModal(null)}
                  className="btn-primary"
                  type="button"
                >
                  Uždaryti
                </button>
              </div>
            </Modal>
          )}



          {modal === "residents" && (
            <Modal
              title="Mano gyventojai"
              desc="Gyventojai, kurie priskirti tavo atsakomybei."
              onClose={() => setModal(null)}
            >
              <div className="space-y-3">
                {assignedResidents.length ? (
                  assignedResidents.map((resident) => (
                    <ResidentItem key={resident.id} resident={resident} />
                  ))
                ) : (
                  <EmptyBlock
                    icon={<UserRound className="h-7 w-7" />}
                    title="Priskirtų gyventojų nerasta"
                    desc="Jei turi matyti gyventojus, patikrink resident_assignments arba residents priskyrimo stulpelius ir RLS teises."
                  />
                )}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setModal(null)}
                  className="btn-primary"
                  type="button"
                >
                  Uždaryti
                </button>
              </div>
            </Modal>
          )}

          {selectedTask && (
            <Modal
              title={selectedTask.title || selectedTask.name || "Užduotis"}
              desc="Pilnas užduoties aprašymas ir veiksmai."
              onClose={() => setSelectedTask(null)}
            >
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-extrabold uppercase tracking-widest text-slate-500">
                    Aprašymas
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-base font-semibold leading-7 text-slate-700">
                    {selectedTask.description || "Aprašymo nėra."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniInfo label="Prioritetas" value={selectedTask.priority || "Nenurodyta"} />
                  <MiniInfo label="Statusas" value={selectedTask.status || "Atvira"} />
                  <MiniInfo
                    label="Terminas"
                    value={selectedTask.due_date ? formatDate(selectedTask.due_date) : "Nenurodytas"}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="btn-secondary"
                >
                  Uždaryti
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const taskId = selectedTask.id;
                    setSelectedTask(null);
                    void completeTask(taskId);
                  }}
                  className="btn-primary"
                >
                  Pažymėti įvykdyta
                </button>
              </div>
            </Modal>
          )}

          {modal === "notifications" && (
            <Modal
              title="Pranešimai"
              desc="Sistemos naujienos ir svarbūs pranešimai."
              onClose={() => setModal(null)}
            >
              <div className="space-y-3">
                {notifications.length ? (
                  notifications.map((item) => (
                    <NotificationItem key={item.id} item={item} />
                  ))
                ) : (
                  <EmptyBlock
                    icon={<CheckCircle2 className="h-7 w-7" />}
                    title="Naujų pranešimų nėra"
                    desc="Svarbūs sistemos pranešimai atsiras čia."
                  />
                )}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setModal(null)}
                  className="btn-secondary"
                  type="button"
                >
                  Uždaryti
                </button>
                <button
                  onClick={() => void markNotificationsRead()}
                  className="btn-primary"
                  type="button"
                >
                  Pažymėti kaip skaitytus
                </button>
              </div>
            </Modal>
          )}

          {toast && (
            <div className="fixed inset-x-3 bottom-4 z-50 rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-sm sm:rounded-3xl sm:p-5">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-black text-slate-950">{toast.title}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {toast.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          <style jsx global>{`
            .input {
              width: 100%;
              border-radius: 1rem;
              border: 1px solid #dbe3ef;
              background: white;
              padding: 0.9rem 1rem;
              font-weight: 800;
              color: #0f172a;
              outline: none;
            }
            .input:focus {
              border-color: #10b981;
              box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.12);
            }
            .btn-primary {
              border-radius: 1rem;
              background: #020617;
              padding: 0.85rem 1.1rem;
              font-weight: 900;
              color: white;
              transition:
                transform 0.15s ease,
                background 0.15s ease;
              width: 100%;
            }
            @media (min-width: 640px) {
              .btn-primary,
              .btn-secondary {
                width: auto;
              }
            }
            .btn-primary:hover {
              background: #1e293b;
            }
            .btn-primary:active {
              transform: scale(0.98);
            }
            .btn-secondary {
              border-radius: 1rem;
              border: 1px solid #dbe3ef;
              background: white;
              padding: 0.85rem 1.1rem;
              font-weight: 900;
              color: #334155;
              transition:
                transform 0.15s ease,
                background 0.15s ease;
              width: 100%;
            }
            .btn-secondary:hover {
              background: #f8fafc;
            }
            .btn-secondary:active {
              transform: scale(0.98);
            }
          `}</style>
        </main>
      </div>
    </>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6 ${className}`}
    >
      {children}
    </article>
  );
}

function TodayItem({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/80 p-4">
      <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">
        {title}
      </p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  meta,
  tone,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  meta: string;
  tone: "emerald" | "amber" | "blue" | "rose";
  active: boolean;
  onClick: () => void;
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    rose: "bg-rose-50 text-rose-700",
  }[tone];
  const textClass = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    blue: "text-blue-700",
    rose: "text-rose-700",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md active:scale-[0.99] sm:rounded-3xl sm:p-6 ${active ? "border-emerald-200 ring-4 ring-emerald-50" : "border-slate-200"}`}
    >
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14 sm:rounded-2xl ${toneClass}`}
        >
          {icon}
        </div>
        <div>
          <p className="font-extrabold text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-black sm:text-4xl">
            {value}{" "}
            <span className={`text-sm font-bold ${textClass}`}>{meta}</span>
          </p>
        </div>
      </div>
    </button>
  );
}

function ActionCard({
  title,
  desc,
  active,
  onClick,
}: {
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-24 items-center justify-between gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${active ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-emerald-200 hover:bg-emerald-50"}`}
    >
      <span>
        <b>{title}</b>
        <br />
        <small className="font-semibold text-slate-500">{desc}</small>
      </span>
      <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
    </button>
  );
}

function DocumentRow({
  title,
  desc,
  badge,
  tone,
  onClick,
}: {
  title: string;
  desc: string;
  badge: string;
  tone: "slate" | "amber" | "emerald";
  onClick: () => void;
}) {
  const rowClass = {
    amber: "border border-amber-100 bg-amber-50 hover:bg-amber-100",
    emerald: "border border-emerald-100 bg-emerald-50 hover:bg-emerald-100",
    slate:
      "border border-transparent bg-slate-50 hover:border-slate-200 hover:bg-slate-100",
  }[tone];
  const badgeClass = {
    amber: "text-amber-700",
    emerald: "text-emerald-700",
    slate: "text-slate-600",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start justify-between gap-3 rounded-2xl p-4 text-left transition active:scale-[0.99] sm:flex-row sm:items-center ${rowClass}`}
    >
      <div>
        <p className="font-black text-slate-800">{title}</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">{desc}</p>
      </div>
      <span
        className={`rounded-full bg-white px-3 py-1 text-sm font-black ${badgeClass}`}
      >
        {badge}
      </span>
    </button>
  );
}

function ChartCard({
  title,
  value,
  progress,
  desc,
  onClick,
}: {
  title: string;
  value: string;
  progress: number;
  desc: string;
  onClick: () => void;
}) {
  const circumference = 301;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl active:scale-[0.99] sm:rounded-[32px] sm:p-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
            {title}
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
            {value}
          </h3>
        </div>
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center sm:h-24 sm:w-24">
          <svg
            className="-rotate-90 transform"
            width="96"
            height="96"
            viewBox="0 0 120 120"
          >
            <circle
              cx="60"
              cy="60"
              r="48"
              stroke="#e2e8f0"
              strokeWidth="10"
              fill="none"
            />
            <circle
              cx="60"
              cy="60"
              r="48"
              stroke="currentColor"
              className="text-emerald-600"
              strokeWidth="10"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <span className="absolute text-lg font-black">{value}</span>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-500">{desc}</p>
    </button>
  );
}

function Modal({
  title,
  desc,
  children,
  onClose,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-[1.5rem] bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 sm:gap-6 sm:p-7">
          <div>
            <h2 className="text-2xl font-black tracking-tight sm:text-4xl">
              {title}
            </h2>
            <p className="mt-2 font-semibold text-slate-500">{desc}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-[0.98] sm:h-14 sm:w-14"
            aria-label="Uždaryti"
          >
            <X className="h-6 w-6 sm:h-7 sm:w-7" />
          </button>
        </div>
        <div className="p-4 sm:p-7">{children}</div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="mb-2 block text-sm font-extrabold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function InfoBox({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
      <Info className="h-5 w-5 shrink-0" />
      <p className="font-extrabold">{text}</p>
    </div>
  );
}

function ModalFooter({
  onCancel,
  submitText,
}: {
  onCancel: () => void;
  submitText: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
      <button type="button" onClick={onCancel} className="btn-secondary">
        Atšaukti
      </button>
      <button type="submit" className="btn-primary">
        {submitText}
      </button>
    </div>
  );
}

function NotificationItem({ item }: { item: NotificationRow }) {
  const unread = !item.is_read && !item.read_at;
  return (
    <div
      className={`rounded-3xl border p-5 ${unread ? "border-rose-100 bg-rose-50" : "border-slate-200 bg-slate-50"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-900">
            {item.title || "Pranešimas"}
          </p>
          <p className="mt-1 font-semibold text-slate-500">
            {item.message || item.body || "Nėra papildomos informacijos."}
          </p>
          {item.created_at && (
            <p className="mt-2 text-xs font-bold text-slate-400">
              {formatDate(item.created_at)}
            </p>
          )}
        </div>
        {unread && (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-rose-700">
            Naujas
          </span>
        )}
      </div>
    </div>
  );
}

function TaskItem({
  task,
  onOpen,
  onComplete,
}: {
  task: EmployeeTask;
  onOpen: () => void;
  onComplete: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-emerald-200 hover:bg-emerald-50 active:scale-[0.99]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-black text-slate-900">
            {task.title || task.name || "Užduotis"}
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-600">
            {task.description || "Be aprašymo"}
          </p>
          {task.due_date && (
            <p className="mt-2 text-xs font-bold text-slate-400">
              Terminas: {formatDate(task.due_date)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-blue-700">
            {task.priority || task.status || "Atvira"}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onComplete();
            }}
            className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700 active:scale-[0.98]"
          >
            Pažymėti įvykdyta
          </button>
          <span className="text-xs font-bold text-slate-400">Spausk kortelę aprašymui</span>
        </div>
      </div>
    </button>
  );
}


function ResidentItem({ resident }: { resident: AssignedResident }) {
  const name = residentName(resident);

  return (
    <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-black text-slate-900">{name}</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {[resident.resident_code, resident.room_name, resident.current_status]
              .filter(Boolean)
              .join(" · ") || "Priskirtas gyventojas"}
          </p>
          {resident.care_level && (
            <p className="mt-2 text-xs font-bold text-emerald-700">
              Priežiūros lygis: {resident.care_level}
            </p>
          )}
        </div>
        <Link
          href={`/residents?resident=${resident.id}`}
          className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-100"
        >
          Atidaryti
        </Link>
      </div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-black text-slate-900">{value}</p>
    </div>
  );
}

function residentName(resident: AssignedResident) {
  const first = resident.first_name || resident.first_name_encrypted || "";
  const last = resident.last_name || resident.last_name_encrypted || "";
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || resident.resident_code || "Gyventojas";
}

function ShiftItem({ shift }: { shift: EmployeeSchedule }) {
  return (
    <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-black text-slate-900">
            {formatDate(shift.shift_date || shift.date || shift.work_date || shift.schedule_date || "")}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {shift.start_time || shift.shift_start || shift.starts_at || "--:--"}–{shift.end_time || shift.shift_end || shift.ends_at || "--:--"}
          </p>
          {(shift.department || shift.position) && (
            <p className="mt-2 text-xs font-bold text-slate-500">
              {[shift.department, shift.position].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TrainingItem({ training }: { training: TrainingRow }) {
  const expiring = isExpiringSoon(training.valid_until);
  return (
    <div
      className={`rounded-3xl border p-5 ${expiring ? "border-amber-100 bg-amber-50" : "border-emerald-100 bg-emerald-50"}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-black text-slate-900">
            {training.title ||
              training.training_name ||
              training.name ||
              "Mokymas"}
          </p>
          <p className="mt-1 font-semibold text-slate-600">
            {training.completed_at
              ? `Baigta: ${formatDate(training.completed_at)} · `
              : ""}
            {training.valid_until
              ? `Galioja iki: ${formatDate(training.valid_until)}`
              : "Galiojimas nenurodytas"}
            {training.hours ? ` · ${training.hours} val.` : ""}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-emerald-700">
          {expiring ? "Baigiasi" : training.status || "Galioja"}
        </span>
      </div>
    </div>
  );
}

function EmptyBlock({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
          {icon}
        </div>
        <p className="mt-4 font-black text-slate-700">{title}</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">{desc}</p>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "Nenurodyta";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatShift(shift: EmployeeSchedule) {
  const date = formatDate(shift.shift_date || shift.date || "");
  return `${date}, ${shift.start_time || "--:--"}–${shift.end_time || "--:--"}`;
}

function isExpiringSoon(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return days >= 0 && days <= 30;
}
