"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  BedSingle,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Home,
  Search,
  Users,
  X,
} from "lucide-react"

import MobileBottomNav from "@/components/mobile/MobileBottomNav"
import { getCurrentMembership } from "@/lib/current-membership"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import { getReadableError } from "@/lib/errors"
import { formatDate } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { supabase } from "@/lib/supabase"

type ResidentAssignmentRow = {
  id: string
  resident_id: string
  created_at: string | null
  residents: {
    id: string
    first_name: string | null
    last_name: string | null
    full_name: string | null
    room_number: string | null
    status: string | null
  } | null
}

type NotificationCountRow = {
  id: string
  is_read: boolean | null
}

type ResidentTask = {
  id: string
  title: string | null
  description?: string | null
  resident_id: string | null
  assigned_user_id?: string | null
  created_by_user_id?: string | null
  status: string | null
  priority?: string | null
  due_date: string | null
  created_at: string | null
  type?: string | null
}

function formatResidentName(resident: ResidentAssignmentRow["residents"]) {
  if (!resident) return "Gyventojas"

  const combined = [resident.first_name, resident.last_name]
    .filter(Boolean)
    .join(" ")
    .trim()

  if (combined) return combined
  if (resident.full_name?.trim()) return resident.full_name.trim()

  return "Gyventojas"
}

function getResidentInitials(resident: ResidentAssignmentRow["residents"]) {
  const name = formatResidentName(resident)

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function normalizeResidentStatus(status?: string | null) {
  if (!status) return "Nenurodyta"

  const value = status.toLowerCase()

  if (value === "active") return "Aktyvus"
  if (value === "inactive") return "Neaktyvus"
  if (value === "archived") return "Archyvuotas"
  if (value === "living") return "Gyvena"
  if (value === "arriving") return "Netrukus atvyks"
  if (value === "hospital") return "Ligoninėje"
  if (value === "left") return "Išvykęs"

  return status
}

function normalizeTaskStatus(status?: string | null) {
  if (!status) return "Atvira"

  const value = status.toLowerCase()

  if (value === "done" || value === "completed") return "Atlikta"
  if (value === "in_progress") return "Vykdoma"
  if (value === "open" || value === "pending" || value === "new") return "Atvira"
  if (value === "cancelled") return "Atšaukta"

  return status
}

function getTaskTypeLabel(type?: string | null) {
  if (type === "maintenance") return "Ūkis"
  if (type === "higiena") return "Higiena"
  if (type === "slauga") return "Slauga"
  if (type === "mobilumas") return "Mobilumas"
  if (type === "maitinimas") return "Maitinimas"
  if (type === "socialinis") return "Socialinė priežiūra"

  return type || "Kita"
}

function isOpenTask(status?: string | null) {
  const value = status?.toLowerCase()

  return (
    !value ||
    value === "new" ||
    value === "open" ||
    value === "pending" ||
    value === "in_progress"
  )
}

function isActiveResident(status?: string | null) {
  const value = status?.toLowerCase()

  return !value || value === "active" || value === "living"
}

function isTaskLate(task: ResidentTask) {
  if (!task.due_date) return false
  if (!isOpenTask(task.status)) return false

  const due = new Date(task.due_date)
  if (Number.isNaN(due.getTime())) return false

  return due.getTime() < Date.now()
}

export default function MyResidentsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [items, setItems] = useState<ResidentAssignmentRow[]>([])
  const [tasks, setTasks] = useState<ResidentTask[]>([])
  const [notificationsCount, setNotificationsCount] = useState(0)
  const [search, setSearch] = useState("")
  const [selectedResident, setSelectedResident] =
    useState<ResidentAssignmentRow | null>(null)
  const [showTasksModal, setShowTasksModal] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setMessage("")

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.replace(ROUTES.login)
          return
        }

        const organizationId = await getCurrentOrganizationId()

        if (!organizationId) {
          setMessage("Nepavyko nustatyti įstaigos.")
          return
        }

        const membership = await getCurrentMembership(user.id)

        if (membership?.role === "owner" || membership?.role === "admin") {
          router.replace(ROUTES.adminDashboard)
          return
        }

        const { data, error } = await supabase
          .from("resident_assignments")
          .select(
            "id, resident_id, created_at, residents(id, first_name, last_name, full_name, room_number, status)"
          )
          .eq("employee_user_id", user.id)
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })

        if (error) throw error

        const assignedResidents = (data as ResidentAssignmentRow[]) || []
        setItems(assignedResidents)

        const residentIds = assignedResidents
          .map((item) => item.resident_id)
          .filter(Boolean)

        try {
          let tasksQuery = supabase
            .from("employee_tasks")
            .select(
              "id, title, description, resident_id, assigned_user_id, created_by_user_id, status, priority, due_date, created_at, type"
            )
            .eq("organization_id", organizationId)
            .order("due_date", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(100)

          if (residentIds.length > 0) {
            tasksQuery = tasksQuery.or(
              `assigned_user_id.eq.${user.id},created_by_user_id.eq.${user.id},resident_id.in.(${residentIds.join(",")})`
            )
          } else {
            tasksQuery = tasksQuery.or(
              `assigned_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`
            )
          }

          const { data: taskData, error: taskError } = await tasksQuery

          if (!taskError) {
            setTasks((taskData as ResidentTask[]) || [])
          } else {
            setTasks([])
          }
        } catch {
          setTasks([])
        }

        const { data: notifications, error: notificationsError } =
          await supabase
            .from("notifications")
            .select("id, is_read")
            .eq("user_id", user.id)
            .eq("is_read", false)

        if (notificationsError) throw notificationsError

        setNotificationsCount(
          ((notifications as NotificationCountRow[]) || []).length
        )
      } catch (error) {
        setMessage(getReadableError(error))
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [router])

  const tasksByResidentId = useMemo(() => {
    return tasks.reduce<Record<string, ResidentTask[]>>((acc, task) => {
      if (!task.resident_id) return acc

      acc[task.resident_id] = acc[task.resident_id] || []
      acc[task.resident_id].push(task)

      return acc
    }, {})
  }, [tasks])

  const unassignedTasks = useMemo(
    () => tasks.filter((task) => !task.resident_id),
    [tasks]
  )

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return items

    return items.filter((item) => {
      const resident = item.residents
      const name = formatResidentName(resident).toLowerCase()
      const room = resident?.room_number?.toLowerCase() || ""
      const status = normalizeResidentStatus(resident?.status).toLowerCase()
      const residentTasks = tasksByResidentId[item.resident_id] || []
      const taskText = residentTasks
        .map((task) => `${task.title || ""} ${normalizeTaskStatus(task.status)}`)
        .join(" ")
        .toLowerCase()

      return (
        name.includes(query) ||
        room.includes(query) ||
        status.includes(query) ||
        taskText.includes(query)
      )
    })
  }, [items, search, tasksByResidentId])

  const filteredUnassignedTasks = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return unassignedTasks

    return unassignedTasks.filter((task) =>
      [
        task.title,
        task.description,
        task.type,
        normalizeTaskStatus(task.status),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    )
  }, [unassignedTasks, search])

  const activeCount = items.filter((item) =>
    isActiveResident(item.residents?.status)
  ).length

  const roomsCount = new Set(
    items
      .map((item) => item.residents?.room_number)
      .filter((room): room is string => Boolean(room))
  ).size

  const openTasks = tasks.filter((task) => isOpenTask(task.status))
  const lateTasks = tasks.filter(isTaskLate)
  const residentsWithTasks = new Set(
    openTasks
      .map((task) => task.resident_id)
      .filter((id): id is string => Boolean(id))
  ).size

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-950">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
          <p className="mt-4 text-lg font-black text-slate-700">Kraunama...</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Ruošiame tavo priskirtų gyventojų ir užduočių sąrašą.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-28 text-slate-950 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => router.push(ROUTES.employeeDashboard)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 active:scale-[0.98]"
                aria-label="Grįžti į dashboard"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700">
                  <Users className="h-7 w-7" />
                </div>

                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                    Mano gyventojai
                  </p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                    Priskirti gyventojai
                  </h1>
                  <p className="mt-2 text-base font-semibold text-slate-500 sm:text-lg">
                    Čia matai tau priskirtus gyventojus ir tavo aktyvias užduotis.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid min-w-[260px] gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
                  Gyventojai
                </span>
                <strong className="text-slate-950">{items.length}</strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
                  Aktyvios užduotys
                </span>
                <strong className="text-slate-950">{openTasks.length}</strong>
              </div>
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 font-extrabold text-amber-800">
            {message}
          </div>
        ) : null}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Users className="h-6 w-6" />}
            title="Priskirta"
            value={String(items.length)}
            meta="gyventojų"
            tone="emerald"
          />
          <StatCard
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="Aktyvūs"
            value={String(activeCount)}
            meta="gyventojai"
            tone="blue"
          />
          <StatCard
            icon={<ClipboardList className="h-6 w-6" />}
            title="Užduotys"
            value={String(openTasks.length)}
            meta="aktyvios"
            tone="rose"
            onClick={() => setShowTasksModal(true)}
          />
          <StatCard
            icon={<BedSingle className="h-6 w-6" />}
            title="Kambariai"
            value={String(roomsCount)}
            meta="unikalūs"
            tone="amber"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                  Sąrašas
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">
                  Gyventojų kortelės
                </h2>
                <p className="mt-1 font-semibold text-slate-500">
                  Paspausk kortelę, kad atsidarytų gyventojo informacija.
                </p>
              </div>

              <label className="relative block w-full md:w-80">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Ieškoti pagal vardą, kambarį, užduotį..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                />
              </label>
            </div>

            {items.length === 0 ? (
              <EmptyState
                title="Priskirtų gyventojų nėra"
                text="Gyventojų dar nėra priskirta, bet tavo aktyvios užduotys rodomos dešinėje pusėje."
              />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                title="Nieko nerasta"
                text="Pabandyk pakeisti paieškos tekstą arba išvalyti filtrą."
              />
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {filteredItems.map((item) => (
                  <ResidentCard
                    key={item.id}
                    item={item}
                    tasks={tasksByResidentId[item.resident_id] || []}
                    onClick={() => setSelectedResident(item)}
                  />
                ))}
              </div>
            )}

            {filteredUnassignedTasks.length > 0 ? (
              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-extrabold uppercase tracking-widest text-rose-700">
                      Užduotys be gyventojo
                    </p>
                    <h3 className="mt-1 text-xl font-black">
                      Tavo bendros užduotys
                    </h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-700">
                    {filteredUnassignedTasks.length}
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  {filteredUnassignedTasks.slice(0, 5).map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              </div>
            ) : null}
          </article>

          <aside className="grid content-start gap-6">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-blue-700">
                    Šiandien naudinga
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Darbo eiga
                  </h2>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <CalendarClock className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                <InfoRow
                  title="Gyventojai su užduotimis"
                  value={String(residentsWithTasks)}
                  desc="Gyventojų, kuriems yra atvirų veiksmų."
                />
                <InfoRow
                  title="Atviros užduotys"
                  value={String(openTasks.length)}
                  desc="Tau priskirtos arba tavo sukurtos užduotys."
                  onClick={() => setShowTasksModal(true)}
                />
                <InfoRow
                  title="Vėluoja"
                  value={String(lateTasks.length)}
                  desc="Aktyvios užduotys, kurių terminas jau praėjo."
                  danger
                />
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Home className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black">Svarbu</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Šiame puslapyje darbuotojas mato priskirtus gyventojus ir
                    savo aktyvias užduotis. Užduotis galima valdyti per
                    „Užduotys“ meniu.
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-rose-700">
                    Pranešimai
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Nauji pranešimai
                  </h2>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                  <Bell className="h-6 w-6" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push(ROUTES.employeeNotifications)}
                className="mt-6 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50 active:scale-[0.99]"
              >
                <span>
                  <b>Atidaryti pranešimus</b>
                  <br />
                  <small className="font-semibold text-slate-500">
                    {notificationsCount} neperskaitytų
                  </small>
                </span>

                <ArrowRight className="h-5 w-5 text-slate-400" />
              </button>
            </article>
          </aside>
        </section>
      </div>

      {selectedResident && (
        <ResidentModal
          item={selectedResident}
          tasks={tasksByResidentId[selectedResident.resident_id] || []}
          onClose={() => setSelectedResident(null)}
        />
      )}

      {showTasksModal && (
        <TasksModal tasks={openTasks} onClose={() => setShowTasksModal(false)} />
      )}

      <MobileBottomNav notificationsCount={notificationsCount} />
    </main>
  )
}

function StatCard({
  icon,
  title,
  value,
  meta,
  tone,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  value: string
  meta: string
  tone: "emerald" | "amber" | "blue" | "rose"
  onClick?: () => void
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    rose: "bg-rose-50 text-rose-700",
  }[tone]

  const textClass = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    blue: "text-blue-700",
    rose: "text-rose-700",
  }[tone]

  const content = (
    <div className="flex items-center gap-4">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${toneClass}`}
      >
        {icon}
      </div>

      <div>
        <p className="font-extrabold text-slate-500">{title}</p>
        <p className="mt-1 text-4xl font-black">
          {value}{" "}
          <span className={`text-sm font-bold ${textClass}`}>{meta}</span>
        </p>
      </div>
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md active:scale-[0.99]"
      >
        {content}
      </button>
    )
  }

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      {content}
    </article>
  )
}

function ResidentCard({
  item,
  tasks,
  onClick,
}: {
  item: ResidentAssignmentRow
  tasks: ResidentTask[]
  onClick: () => void
}) {
  const resident = item.residents
  const status = normalizeResidentStatus(resident?.status)
  const openTasks = tasks.filter((task) => isOpenTask(task.status))
  const nextTask = openTasks[0]

  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-3xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-black text-emerald-700 shadow-sm">
            {getResidentInitials(resident)}
          </div>

          <div>
            <h3 className="text-lg font-black text-slate-950">
              {formatResidentName(resident)}
            </h3>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Kambarys: {resident?.room_number || "—"}
            </p>
          </div>
        </div>

        <ArrowRight className="mt-2 h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <InfoPill label="Būsena" value={status} />
        <InfoPill label="Atviros užduotys" value={String(openTasks.length)} />
      </div>

      <div className="mt-3 rounded-2xl bg-white px-4 py-3">
        <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
          Artimiausia
        </p>
        <p className="mt-1 line-clamp-2 font-black text-slate-800">
          {nextTask?.title || "Aktyvių užduočių nėra"}
        </p>
      </div>
    </button>
  )
}

function TaskRow({ task }: { task: ResidentTask }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        isTaskLate(task)
          ? "border-rose-100 bg-rose-50"
          : "border-slate-100 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-black text-slate-900">
            {task.title || "Užduotis"}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {getTaskTypeLabel(task.type)} · Terminas:{" "}
            {task.due_date ? formatDate(task.due_date) : "—"}
          </p>
        </div>

        <span className="rounded-full bg-slate-50 px-3 py-1 text-sm font-black text-slate-700">
          {normalizeTaskStatus(task.status)}
        </span>
      </div>
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-black text-slate-800">{value}</p>
    </div>
  )
}

function InfoRow({
  title,
  value,
  desc,
  danger = false,
  onClick,
}: {
  title: string
  value: string
  desc: string
  danger?: boolean
  onClick?: () => void
}) {
  const content = (
    <>
      <div>
        <p className="font-black text-slate-900">{title}</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">{desc}</p>
      </div>

      <span
        className={`rounded-2xl bg-white px-4 py-2 text-xl font-black shadow-sm ${
          danger ? "text-rose-700" : "text-slate-950"
        }`}
      >
        {value}
      </span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-emerald-50 active:scale-[0.99]"
      >
        {content}
      </button>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
      {content}
    </div>
  )
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <Users className="mx-auto h-10 w-10 text-slate-400" />
      <p className="mt-4 text-lg font-black text-slate-700">{title}</p>
      <p className="mt-1 font-semibold text-slate-500">{text}</p>
    </div>
  )
}

function ResidentModal({
  item,
  tasks,
  onClose,
}: {
  item: ResidentAssignmentRow
  tasks: ResidentTask[]
  onClose: () => void
}) {
  const resident = item.residents
  const openTasks = tasks.filter((task) => isOpenTask(task.status))

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-6 border-b border-slate-100 p-7">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-emerald-50 text-xl font-black text-emerald-700">
              {getResidentInitials(resident)}
            </div>

            <div>
              <h2 className="text-3xl font-black tracking-tight">
                {formatResidentName(resident)}
              </h2>
              <p className="mt-1 font-semibold text-slate-500">
                Gyventojo informacija ir susijusios užduotys
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-[0.98]"
            aria-label="Uždaryti"
          >
            <X className="h-7 w-7" />
          </button>
        </div>

        <div className="space-y-5 p-7">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailBox label="Kambarys" value={resident?.room_number || "—"} />
              <DetailBox
                label="Būsena"
                value={normalizeResidentStatus(resident?.status)}
              />
              <DetailBox label="Priskirta" value={formatDate(item.created_at)} />
              <DetailBox label="Atviros užduotys" value={String(openTasks.length)} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-blue-700">
                  Užduotys
                </p>
                <h3 className="mt-1 text-2xl font-black tracking-tight">
                  Susijusios užduotys
                </h3>
              </div>

              <ClipboardList className="h-7 w-7 text-blue-700" />
            </div>

            {tasks.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="font-black text-slate-700">
                  Užduočių šiam gyventojui nėra
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Kai atsiras susijusių užduočių, jos bus rodomos čia.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-slate-950 px-5 py-3 font-black text-white transition hover:bg-slate-800 active:scale-[0.98]"
            >
              Uždaryti
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function TasksModal({
  tasks,
  onClose,
}: {
  tasks: ResidentTask[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-6 border-b border-slate-100 p-7">
          <div>
            <h2 className="text-3xl font-black tracking-tight">
              Aktyvios užduotys
            </h2>
            <p className="mt-1 font-semibold text-slate-500">
              Tau priskirtos arba tavo sukurtos užduotys.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-[0.98]"
            aria-label="Uždaryti"
          >
            <X className="h-7 w-7" />
          </button>
        </div>

        <div className="space-y-3 p-7">
          {tasks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-4 text-lg font-black text-slate-700">
                Aktyvių užduočių nėra
              </p>
            </div>
          ) : (
            tasks.map((task) => <TaskRow key={task.id} task={task} />)
          )}

          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-slate-950 px-5 py-3 font-black text-white transition hover:bg-slate-800 active:scale-[0.98]"
            >
              Uždaryti
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words font-black text-slate-900">{value}</p>
    </div>
  )
}
