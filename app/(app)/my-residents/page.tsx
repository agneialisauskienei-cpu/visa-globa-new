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
  Sparkles,
  Stethoscope,
  Wrench,
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
      <main className="flex min-h-screen items-center justify-center bg-[#f3f6f4] p-6 text-[#10251f]">
        <div className="rounded-3xl border border-[#dbe6e0] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#dbe6e0] border-t-emerald-600" />
          <p className="mt-4 text-lg font-black text-[#486b5d]">Kraunama...</p>
          <p className="mt-1 text-sm font-semibold text-white/80">
            Ruošiame tavo priskirtų gyventojų ir užduočių sąrašą.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f3f6f4] pb-28 text-[#10251f]">
      <section className="mx-4 mt-4 overflow-hidden rounded-[30px] border border-emerald-900/10 bg-white shadow-[0_16px_45px_rgba(16,37,31,0.14)]">
        <div className="bg-[#486b5d] px-5 pb-6 pt-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <button
              type="button"
              onClick={() => router.push(ROUTES.employeeDashboard)}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-[#e8f7ef] text-[#486b5d] shadow-sm transition active:scale-[0.98]"
              aria-label="Grįžti į dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-white/10 text-white backdrop-blur">
              <Users className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-100/80">
              Mano gyventojai
            </p>
            <h1 className="mt-3 text-[34px] font-black leading-[1.04] tracking-[-0.04em]">
              Priskirti gyventojai
            </h1>
            <p className="mt-3 max-w-[360px] text-[15px] font-semibold leading-6 text-white/85">
              Tavo gyventojai, aktyvios užduotys ir svarbiausi veiksmai vienoje vietoje.
            </p>
          </div>
        </div>

        <div className="border-t border-emerald-900/10 bg-[#eef4f1] p-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <ResidentTab active icon={<Users className="h-4 w-4" />} label="Gyventojai" count={items.length} />
            <ResidentTab icon={<ClipboardList className="h-4 w-4" />} label="Užduotys" count={openTasks.length} onClick={() => setShowTasksModal(true)} />
            <ResidentTab icon={<Clock className="h-4 w-4" />} label="Vėluoja" count={lateTasks.length} onClick={() => setShowTasksModal(true)} />
            <ResidentTab icon={<BedSingle className="h-4 w-4" />} label="Kambariai" count={roomsCount} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 p-4">
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
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8ea0b5]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ieškoti gyventojo, kambario, užduoties..."
            className="h-14 w-full rounded-[20px] border border-[#dbe6e0] bg-white pl-12 pr-4 text-[15px] font-black text-[#10251f] shadow-[0_1px_3px_rgba(16,37,31,0.08)] outline-none transition placeholder:text-[#8ea0b5] focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
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
            <h2 className="mt-1 text-2xl font-black tracking-tight text-[#10251f]">
              Dabar svarbu
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setShowTasksModal(true)}
            className="rounded-2xl border border-[#dbe6e0] bg-white px-4 py-2 text-sm font-black text-[#486b5d] shadow-sm"
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
          <section className="rounded-[28px] border border-[#dbe6e0] bg-white p-4 shadow-[0_1px_3px_rgba(16,37,31,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
                  Bendros užduotys
                </p>
                <h3 className="mt-1 text-xl font-black">Be gyventojo</h3>
              </div>
              <span className="rounded-full bg-[#eef4f1] px-3 py-1 text-sm font-black text-[#486b5d]">
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

function ResidentTab({
  label,
  icon,
  count,
  active = false,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  count?: number
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
        active
          ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
          : "text-[#486b5d] hover:bg-white/70"
      }`}
    >
      {icon}
      {label}
      {typeof count === "number" ? (
        <span className="ml-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-black text-[#047857] ring-1 ring-[#c9d8d0]">
          {count}
        </span>
      ) : null}
    </button>
  )
}

function MobileHeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] bg-[#eef4f1] px-4 py-3">
      <div className="text-2xl font-black text-[#10251f]">{value}</div>
      <div className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#526174]">
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
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8ea0b5]">
          {title}
        </p>
        <p className="mt-1 text-3xl font-black text-[#10251f]">{value}</p>
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-3 rounded-[26px] border border-[#dbe6e0] bg-white p-4 text-left shadow-[0_1px_3px_rgba(16,37,31,0.08)] active:scale-[0.99]"
      >
        {content}
      </button>
    )
  }

  return (
    <article className="flex items-center gap-3 rounded-[26px] border border-[#dbe6e0] bg-white p-4 shadow-[0_1px_3px_rgba(16,37,31,0.08)]">
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
      className={`w-full rounded-[24px] border bg-white p-4 text-left shadow-[0_1px_3px_rgba(16,37,31,0.08)] transition active:scale-[0.99] ${
        lateCount > 0 ? "border-rose-100 border-l-[7px] border-l-rose-600" : "border-[#dbe6e0] border-l-[7px] border-l-[#486b5d]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#e8f7ef] text-lg font-black text-[#047857]">
            {getResidentInitials(resident)}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-lg font-black tracking-[-0.02em] text-[#10251f]">
              {formatResidentName(resident)}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-bold text-[#526174]">
              <span>Kambarys {resident?.room_number || "—"}</span>
              <span className="text-[#8ea0b5]">•</span>
              <span>{status}</span>
            </div>
          </div>
        </div>

        <ArrowRight className="mt-3 h-5 w-5 shrink-0 text-[#8ea0b5]" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-[#eef4f1] px-3 py-1 text-xs font-black text-[#486b5d]">
          {openTasks.length} aktyvios
        </span>
        {lateCount > 0 ? (
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">
            {lateCount} vėluoja
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-[18px] border border-[#dbe6e0] bg-[#f8faf8] px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8ea0b5]">
          Artimiausia užduotis
        </p>
        <p className="mt-1 line-clamp-2 font-black text-[#10251f]">
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
      className={`rounded-[18px] border bg-white p-4 ${
        late ? "border-rose-100 border-l-[6px] border-l-rose-600" : "border-[#dbe6e0] border-l-[6px] border-l-[#486b5d]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-black text-[#10251f]">{task.title || "Užduotis"}</p>
          <p className="mt-1 text-sm font-semibold text-white/80">
            {getTaskTypeLabel(task.type)} · {task.due_date ? formatDate(task.due_date) : "Be termino"}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
            late ? "bg-rose-50 text-rose-700" : "bg-[#eef4f1] text-[#486b5d]"
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
    <div className="rounded-[28px] border border-[#dbe6e0] bg-white p-8 text-center shadow-[0_1px_3px_rgba(16,37,31,0.08)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <Users className="h-7 w-7" />
      </div>
      <p className="mt-4 text-lg font-black text-[#10251f]">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#526174]">{text}</p>
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
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="max-h-[92vh] w-full overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-2xl sm:max-w-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-[#486b5d] p-5 text-white">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-black text-emerald-700">
              {getResidentInitials(resident)}
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-2xl font-black tracking-tight">
                {formatResidentName(resident)}
              </h2>
              <p className="mt-1 text-sm font-semibold text-white/80">
                Gyventojo informacija ir užduotys
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition active:scale-[0.98]"
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

          <section className="rounded-[28px] border border-[#dbe6e0] bg-white p-4">
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
              <div className="mt-4 rounded-2xl bg-[#f8faf8] p-5 text-center">
                <p className="font-black text-[#486b5d]">Užduočių nėra</p>
                <p className="mt-1 text-sm font-semibold text-white/80">
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
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="max-h-[92vh] w-full overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-2xl sm:max-w-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-[#486b5d] p-5 text-white">
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
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition active:scale-[0.98]"
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
    <div className="rounded-2xl bg-[#f8faf8] p-4">
      <p className="text-xs font-extrabold uppercase tracking-widest text-[#8ea0b5]">
        {label}
      </p>
      <p className="mt-1 font-black text-[#10251f]">{value || "—"}</p>
    </div>
  )
}
