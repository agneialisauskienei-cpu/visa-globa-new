"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  BedSingle,
  CheckCircle2,
  ClipboardList,
  Clock,
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

  if (resident.full_name?.trim()) return resident.full_name.trim()

  const combined = [resident.first_name, resident.last_name]
    .filter(Boolean)
    .join(" ")
    .trim()

  return combined || "Gyventojas"
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

        const assignedResidents = (data as unknown as ResidentAssignmentRow[]) || []
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

  const openTasks = useMemo(
    () => tasks.filter((task) => isOpenTask(task.status)),
    [tasks]
  )

  const lateTasks = useMemo(() => tasks.filter(isTaskLate), [tasks])

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
        .map((task) => [task.title, task.description, task.type].filter(Boolean).join(" "))
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
      [task.title, task.description, task.type, normalizeTaskStatus(task.status)]
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

  const residentsWithTasks = new Set(
    openTasks
      .map((task) => task.resident_id)
      .filter((id): id is string => Boolean(id))
  ).size

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-950">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-8 text-center shadow-sm">
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
    <main className="min-h-screen overflow-x-hidden bg-slate-50 pb-28 text-slate-950">
      <section className="overflow-hidden rounded-b-[34px] bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-950 px-5 pb-7 pt-5 text-white shadow-[0_18px_42px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push(ROUTES.employeeDashboard)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur transition active:scale-[0.98]"
            aria-label="Grįžti į dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-100">
            Mano gyventojai
          </p>
          <h1 className="mt-3 text-[34px] font-black leading-[1.04] tracking-[-0.04em]">
            Priskirti gyventojai
          </h1>
          <p className="mt-3 max-w-[330px] text-[15px] font-semibold leading-6 text-emerald-50/90">
            Tavo gyventojai, aktyvios užduotys ir svarbiausi veiksmai vienoje vietoje.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <MobileHeroStat label="Gyventojai" value={items.length} />
          <MobileHeroStat label="Aktyvūs" value={activeCount} />
          <MobileHeroStat label="Užduotys" value={openTasks.length} />
        </div>
      </section>

      <section className="space-y-4 px-4 pt-5">
        {message ? (
          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-sm font-extrabold text-amber-800">
            {message}
          </div>
        ) : null}

        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ieškoti gyventojo, kambario, užduoties..."
            className="h-14 w-full rounded-[24px] border border-slate-200/70 bg-white pl-12 pr-4 text-[15px] font-black text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.05)] outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <MobileMetricCard
            icon={<ClipboardList className="h-5 w-5" />}
            title="Aktyvios užduotys"
            value={openTasks.length}
            onClick={() => setShowTasksModal(true)}
          />
          <MobileMetricCard
            icon={<BedSingle className="h-5 w-5" />}
            title="Kambariai"
            value={roomsCount}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
              Sąrašas
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              Dabar svarbu
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setShowTasksModal(true)}
            className="rounded-2xl border border-slate-200/70 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm"
          >
            Užduotys
          </button>
        </div>

        {items.length === 0 ? (
          <MobileEmptyState
            title="Priskirtų gyventojų nėra"
            text="Kai administratorius priskirs gyventojus, jie bus rodomi čia."
          />
        ) : filteredItems.length === 0 ? (
          <MobileEmptyState
            title="Nieko nerasta"
            text="Pabandyk pakeisti paieškos tekstą arba išvalyti filtrą."
          />
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <MobileResidentCard
                key={item.id}
                item={item}
                tasks={tasksByResidentId[item.resident_id] || []}
                onClick={() => setSelectedResident(item)}
              />
            ))}
          </div>
        )}

        {filteredUnassignedTasks.length > 0 ? (
          <section className="rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
                  Bendros užduotys
                </p>
                <h3 className="mt-1 text-xl font-black">Be gyventojo</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                {filteredUnassignedTasks.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {filteredUnassignedTasks.slice(0, 5).map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          </section>
        ) : null}
      </section>

      <MobileBottomNav notificationsCount={notificationsCount} />

      {selectedResident ? (
        <ResidentModal
          item={selectedResident}
          tasks={tasksByResidentId[selectedResident.resident_id] || []}
          onClose={() => setSelectedResident(null)}
        />
      ) : null}

      {showTasksModal ? (
        <TasksModal tasks={openTasks} onClose={() => setShowTasksModal(false)} />
      ) : null}
    </main>
  )
}

function MobileHeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[24px] bg-white/15 p-4 backdrop-blur">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-emerald-50">
        {label}
      </div>
    </div>
  )
}

function MobileMetricCard({
  icon,
  title,
  value,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  value: number
  onClick?: () => void
}) {
  const content = (
    <>
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        {icon}
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
          {title}
        </p>
        <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-3 rounded-[26px] border border-slate-200/70 bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] active:scale-[0.99]"
      >
        {content}
      </button>
    )
  }

  return (
    <article className="flex items-center gap-3 rounded-[26px] border border-slate-200/70 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      {content}
    </article>
  )
}

function MobileResidentCard({
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
  const lateCount = openTasks.filter(isTaskLate).length

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[28px] border border-slate-200/70 bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-black text-emerald-700">
            {getResidentInitials(resident)}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-lg font-black text-slate-950">
              {formatResidentName(resident)}
            </h3>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Kambarys: {resident?.room_number || "—"}
            </p>
          </div>
        </div>

        <ArrowRight className="mt-3 h-5 w-5 shrink-0 text-slate-400" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
          {status}
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
          {openTasks.length} aktyvios
        </span>
        {lateCount > 0 ? (
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">
            {lateCount} vėluoja
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
          Artimiausia užduotis
        </p>
        <p className="mt-1 line-clamp-2 font-black text-slate-800">
          {nextTask?.title || "Aktyvių užduočių nėra"}
        </p>
      </div>
    </button>
  )
}

function TaskRow({ task }: { task: ResidentTask }) {
  const late = isTaskLate(task)

  return (
    <div
      className={`rounded-2xl border p-4 ${
        late ? "border-rose-100 bg-rose-50" : "border-slate-100 bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-black text-slate-900">{task.title || "Užduotis"}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {getTaskTypeLabel(task.type)} · {task.due_date ? formatDate(task.due_date) : "Be termino"}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
            late ? "bg-white text-rose-700" : "bg-white text-slate-700"
          }`}
        >
          {late ? "Vėluoja" : normalizeTaskStatus(task.status)}
        </span>
      </div>
    </div>
  )
}

function MobileEmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[28px] border border-slate-200/70 bg-white p-8 text-center shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <Users className="h-7 w-7" />
      </div>
      <p className="mt-4 text-lg font-black text-slate-800">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{text}</p>
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
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="max-h-[92vh] w-full overflow-y-auto rounded-[2rem] bg-white shadow-2xl sm:max-w-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-black text-emerald-700">
              {getResidentInitials(resident)}
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-2xl font-black tracking-tight">
                {formatResidentName(resident)}
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Gyventojo informacija ir užduotys
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition active:scale-[0.98]"
            aria-label="Uždaryti"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailBox label="Kambarys" value={resident?.room_number || "—"} />
            <DetailBox label="Būsena" value={normalizeResidentStatus(resident?.status)} />
            <DetailBox label="Priskirta" value={formatDate(item.created_at)} />
            <DetailBox label="Atviros užduotys" value={String(openTasks.length)} />
          </div>

          <section className="rounded-[28px] border border-slate-200/70 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
                  Užduotys
                </p>
                <h3 className="mt-1 text-xl font-black tracking-tight">
                  Susijusios užduotys
                </h3>
              </div>

              <ClipboardList className="h-6 w-6 text-emerald-700" />
            </div>

            {tasks.length === 0 ? (
              <div className="mt-4 rounded-2xl bg-slate-50 p-5 text-center">
                <p className="font-black text-slate-700">Užduočių nėra</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Kai atsiras susijusių užduočių, jos bus rodomos čia.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            )}
          </section>
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
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="max-h-[92vh] w-full overflow-y-auto rounded-[2rem] bg-white shadow-2xl sm:max-w-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
              Užduotys
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">
              Aktyvios užduotys
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition active:scale-[0.98]"
            aria-label="Uždaryti"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          {tasks.length === 0 ? (
            <MobileEmptyState
              title="Aktyvių užduočių nėra"
              text="Šiuo metu nėra atvirų užduočių."
            />
          ) : (
            tasks.map((task) => <TaskRow key={task.id} task={task} />)
          )}
        </div>
      </section>
    </div>
  )
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-black text-slate-800">{value || "—"}</p>
    </div>
  )
}
