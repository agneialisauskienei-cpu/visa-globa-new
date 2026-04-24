"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Pencil,
  RefreshCw,
  RotateCcw,
  SkipForward,
  StopCircle,
  X,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import { getChangedFields, logAudit } from "@/lib/audit"

type TaskStatus =
  | "new"
  | "assigned"
  | "in_progress"
  | "waiting"
  | "done"
  | "cancelled"
  | "overdue"

type TaskPriority = "low" | "medium" | "high" | "critical"

type Task = {
  id: string
  organization_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assigned_to: string | null
  created_by: string | null
  resident_id: string | null
  care_plan_id: string | null
  category: string | null
  department: string | null
  due_date: string | null
  completed_at: string | null
  created_at: string | null
  recurrence_days: number | null
  recurrence_parent_id: string | null
  recurrence_until: string | null
}

type Resident = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  resident_code: string | null
  current_room_id: string | null
}

type CarePlan = {
  id: string
  resident_id: string
  needs: string | null
  goals: string | null
  services: string | null
  responsible_staff: string | null
  review_date: string | null
  status: string | null
  created_at: string | null
}

type Room = {
  id: string
  name: string | null
}

type Profile = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
}

type TaskComment = {
  id: string
  task_id: string
  user_id: string | null
  user_name: string | null
  comment: string | null
  created_at: string | null
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "new", label: "Nauja" },
  { value: "assigned", label: "Priskirta" },
  { value: "in_progress", label: "Vykdoma" },
  { value: "waiting", label: "Laukia informacijos" },
  { value: "done", label: "Atlikta" },
  { value: "cancelled", label: "Atšaukta" },
  { value: "overdue", label: "Pavėluota" },
]

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Žemas" },
  { value: "medium", label: "Vidutinis" },
  { value: "high", label: "Aukštas" },
  { value: "critical", label: "Kritinis" },
]

const CATEGORIES = [
  "Socialinis darbas",
  "Slauga",
  "Dokumentai",
  "Incidentas",
  "Užimtumas",
  "Kontaktas su artimaisiais",
  "Techninis / ūkio klausimas",
  "Vadovo pavedimas",
]

function profileName(profile?: Profile | null) {
  if (!profile) return "—"
  const full = String(profile.full_name || "").trim()
  const first = String(profile.first_name || "").trim()
  const last = String(profile.last_name || "").trim()
  const combined = [first, last].filter(Boolean).join(" ").trim()
  return full || combined || profile.email || "—"
}

function residentName(resident?: Resident | null, roomsById?: Record<string, string>) {
  if (!resident) return "—"
  const full = String(resident.full_name || "").trim()
  const first = String(resident.first_name || "").trim()
  const last = String(resident.last_name || "").trim()
  const combined = [first, last].filter(Boolean).join(" ").trim()
  const code = resident.resident_code ? ` · ${resident.resident_code}` : ""
  const room = resident.current_room_id && roomsById?.[resident.current_room_id] ? ` · ${roomsById[resident.current_room_id]}` : ""
  return `${full || combined || "Gyventojas"}${code}${room}`
}

function carePlanName(plan?: CarePlan | null) {
  if (!plan) return "—"
  const title = String(plan.goals || plan.needs || plan.services || "").trim()
  const status = plan.status ? ` · ${plan.status}` : ""
  const review = plan.review_date ? ` · peržiūra ${plan.review_date}` : ""
  return `${title || "Individualus planas"}${status}${review}`
}

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || status
}

function priorityLabel(priority: string) {
  return PRIORITY_OPTIONS.find((item) => item.value === priority)?.label || priority
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("lt-LT")
}

function toDateTimeInput(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 16)
}

function toDateInput(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function isOverdue(task: Task) {
  if (!task.due_date) return false
  if (task.status === "done" || task.status === "cancelled") return false
  return new Date(task.due_date).getTime() < Date.now()
}

function addDays(base: string | null, days: number) {
  const date = base ? new Date(base) : new Date()
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date()
    fallback.setDate(fallback.getDate() + days)
    return fallback
  }
  date.setDate(date.getDate() + days)
  return date
}

export default function TasksPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [carePlans, setCarePlans] = useState<CarePlan[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [roomsById, setRoomsById] = useState<Record<string, string>>({})
  const [comments, setComments] = useState<TaskComment[]>([])

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [employeeFilter, setEmployeeFilter] = useState("all")
  const [residentFilter, setResidentFilter] = useState("all")
  const [query, setQuery] = useState("")

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [commentText, setCommentText] = useState("")

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "assigned" as TaskStatus,
    priority: "medium" as TaskPriority,
    assigned_to: "",
    resident_id: "",
    care_plan_id: "",
    category: "Socialinis darbas",
    department: "",
    due_date: "",
    recurrence_days: "",
    recurrence_until: "",
  })

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const residentId = params.get("resident_id")
    const carePlanId = params.get("care_plan_id")
    const title = params.get("title")

    if (residentId || carePlanId || title) {
      setForm((prev) => ({
        ...prev,
        resident_id: residentId || prev.resident_id,
        care_plan_id: carePlanId || prev.care_plan_id,
        title: title || prev.title,
      }))
    }
  }, [])

  async function loadAll() {
    try {
      setLoading(true)
      setMessage("")

      const {
        data: { user },
      } = await supabase.auth.getUser()

      setCurrentUserId(user?.id || null)

      const orgId = await getCurrentOrganizationId()
      setOrganizationId(orgId)

      if (!orgId) {
        setMessage("Nepavyko nustatyti organizacijos.")
        return
      }

      const [tasksResult, residentsResult, carePlansResult, roomsResult, membersResult, commentsResult] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),

        supabase
          .from("residents")
          .select("id, full_name, first_name, last_name, resident_code, current_room_id")
          .eq("organization_id", orgId)
          .is("archived_at", null),

        supabase
          .from("resident_care_plans")
          .select("id, resident_id, needs, goals, services, responsible_staff, review_date, status, created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),

        supabase
          .from("rooms")
          .select("id, name")
          .eq("organization_id", orgId),

        supabase
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", orgId)
          .eq("is_active", true),

        supabase
          .from("task_comments")
          .select("*")
          .order("created_at", { ascending: false }),
      ])

      if (tasksResult.error) throw tasksResult.error
      if (residentsResult.error) throw residentsResult.error
      if (carePlansResult.error) throw carePlansResult.error
      if (roomsResult.error) throw roomsResult.error
      if (membersResult.error) throw membersResult.error
      if (commentsResult.error) throw commentsResult.error

      setTasks((tasksResult.data || []) as Task[])
      setResidents((residentsResult.data || []) as Resident[])
      setCarePlans((carePlansResult.data || []) as CarePlan[])
      setComments((commentsResult.data || []) as TaskComment[])

      setRoomsById(
        Object.fromEntries(((roomsResult.data || []) as Room[]).map((room) => [room.id, room.name || "Kambarys"]))
      )

      const memberIds = ((membersResult.data || []) as { user_id: string }[])
        .map((item) => item.user_id)
        .filter(Boolean)

      if (memberIds.length > 0) {
        const profilesResult = await supabase
          .from("profiles")
          .select("id, full_name, first_name, last_name, email")
          .in("id", memberIds)

        if (profilesResult.error) throw profilesResult.error
        setProfiles((profilesResult.data || []) as Profile[])
      } else {
        setProfiles([])
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko įkelti užduočių.")
    } finally {
      setLoading(false)
    }
  }

  async function getCurrentUserName() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) return { id: null, name: null }

    const profile = profiles.find((item) => item.id === user.id)

    return {
      id: user.id,
      name: profileName(profile) || user.email || null,
    }
  }

  function fallbackAssignee() {
    if (form.assigned_to) return form.assigned_to
    if (currentUserId && profiles.some((profile) => profile.id === currentUserId)) return currentUserId
    return profiles[0]?.id || currentUserId || null
  }

  function filteredCarePlansForResident(residentId: string | null | undefined) {
    if (!residentId) return []
    return carePlans.filter((plan) => plan.resident_id === residentId)
  }

  async function createTask() {
    try {
      if (!organizationId) return
      if (!form.title.trim()) {
        setMessage("Įvesk užduoties pavadinimą.")
        return
      }

      const assignedTo = fallbackAssignee()

      if (!assignedTo) {
        setMessage("Nepavyko nustatyti atsakingo darbuotojo. Pridėk aktyvų darbuotoją į įstaigą.")
        return
      }

      setSaving(true)
      setMessage("")

      const actor = await getCurrentUserName()

      const payload = {
        organization_id: organizationId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        assigned_to: assignedTo,
        created_by: actor.id || assignedTo,
        resident_id: form.resident_id || null,
        care_plan_id: form.care_plan_id || null,
        category: form.category || null,
        department: form.department.trim() || null,
        due_date: form.due_date || null,
        completed_at: form.status === "done" ? new Date().toISOString() : null,
        recurrence_days: form.recurrence_days ? Number(form.recurrence_days) : null,
        recurrence_parent_id: null,
        recurrence_until: form.recurrence_until || null,
      }

      const { data, error } = await supabase.from("tasks").insert(payload).select().single()
      if (error) throw error

      const resident = residents.find((item) => item.id === form.resident_id)
      const employee = profiles.find((item) => item.id === assignedTo)
      const plan = carePlans.find((item) => item.id === form.care_plan_id)

      await logAudit({
        organizationId,
        tableName: "tasks",
        recordId: data.id,
        action: "insert",
        changes: {
          Pavadinimas: payload.title,
          Kategorija: payload.category,
          Prioritetas: priorityLabel(payload.priority),
          Statusas: statusLabel(payload.status),
          Gyventojas: resident ? residentName(resident, roomsById) : "—",
          "Individualus planas": plan ? carePlanName(plan) : "—",
          Atsakingas: employee ? profileName(employee) : "—",
          Terminas: payload.due_date || "—",
          Kartojimas: payload.recurrence_days ? `Kas ${payload.recurrence_days} d.` : "—",
          "Kartoti iki": payload.recurrence_until || "—",
        },
      })

      setForm({
        title: "",
        description: "",
        status: "assigned",
        priority: "medium",
        assigned_to: "",
        resident_id: "",
        care_plan_id: "",
        category: "Socialinis darbas",
        department: "",
        due_date: "",
        recurrence_days: "",
        recurrence_until: "",
      })

      setMessage("Užduotis sukurta.")
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko sukurti užduoties.")
    } finally {
      setSaving(false)
    }
  }

  async function createNextRecurringTask(task: Task) {
    if (!organizationId) return
    if (!task.recurrence_days || task.recurrence_days <= 0) return

    const nextDueDate = addDays(task.due_date, task.recurrence_days)
    const until = task.recurrence_until ? new Date(task.recurrence_until) : null

    if (until && nextDueDate.getTime() > until.getTime()) {
      await logAudit({
        organizationId,
        tableName: "tasks",
        recordId: task.id,
        action: "update",
        changes: {
          Veiksmas: "Kartojimas nebetęsiamas, nes pasiekta pabaigos data",
          "Kita data": nextDueDate.toISOString(),
          "Kartoti iki": task.recurrence_until,
        },
      })
      return
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        organization_id: organizationId,
        title: task.title,
        description: task.description,
        status: "assigned",
        priority: task.priority,
        assigned_to: task.assigned_to || currentUserId || profiles[0]?.id || null,
        created_by: task.created_by || currentUserId || task.assigned_to,
        resident_id: task.resident_id,
        care_plan_id: task.care_plan_id,
        category: task.category,
        department: task.department,
        due_date: nextDueDate.toISOString(),
        completed_at: null,
        recurrence_days: task.recurrence_days,
        recurrence_parent_id: task.recurrence_parent_id || task.id,
        recurrence_until: task.recurrence_until,
      })
      .select()
      .single()

    if (error) throw error

    const resident = residents.find((item) => item.id === task.resident_id)
    const employee = profiles.find((item) => item.id === task.assigned_to)
    const plan = carePlans.find((item) => item.id === task.care_plan_id)

    await logAudit({
      organizationId,
      tableName: "tasks",
      recordId: data.id,
      action: "insert",
      changes: {
        Veiksmas: "Automatiškai sukurta pasikartojanti užduotis",
        Pavadinimas: task.title,
        Gyventojas: resident ? residentName(resident, roomsById) : "—",
        "Individualus planas": plan ? carePlanName(plan) : "—",
        Atsakingas: employee ? profileName(employee) : "—",
        Kartojimas: `Kas ${task.recurrence_days} d.`,
        Terminas: nextDueDate.toISOString(),
      },
    })
  }

  async function updateTask(taskBefore: Task, taskAfter: Task) {
    try {
      if (!organizationId) return
      setSaving(true)
      setMessage("")

      const payload = {
        title: taskAfter.title.trim(),
        description: taskAfter.description?.trim() || null,
        status: taskAfter.status,
        priority: taskAfter.priority,
        assigned_to: taskAfter.assigned_to || currentUserId || profiles[0]?.id || null,
        resident_id: taskAfter.resident_id || null,
        care_plan_id: taskAfter.care_plan_id || null,
        category: taskAfter.category || null,
        department: taskAfter.department?.trim() || null,
        due_date: taskAfter.due_date || null,
        completed_at: taskAfter.status === "done" ? taskAfter.completed_at || new Date().toISOString() : null,
        recurrence_days: taskAfter.recurrence_days || null,
        recurrence_until: taskAfter.recurrence_until || null,
      }

      const { error } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", taskAfter.id)
        .eq("organization_id", organizationId)

      if (error) throw error

      const beforeReadable = readableTask(taskBefore)
      const afterReadable = readableTask({ ...taskAfter, ...payload })
      const changes = getChangedFields(beforeReadable, afterReadable)

      if (Object.keys(changes).length > 0) {
        await logAudit({
          organizationId,
          tableName: "tasks",
          recordId: taskAfter.id,
          action: "update",
          changes,
        })
      }

      setEditingTask(null)
      setMessage("Užduotis atnaujinta.")
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko atnaujinti užduoties.")
    } finally {
      setSaving(false)
    }
  }

  async function completeTask(task: Task, createNext = true) {
    const updated = {
      ...task,
      status: "done" as TaskStatus,
      completed_at: new Date().toISOString(),
    }

    await updateTask(task, updated)

    if (createNext) {
      await createNextRecurringTask(task)
      await loadAll()
    }
  }

  async function skipOneOccurrence(task: Task) {
    if (!confirm("Ar tikrai praleisti šį kartą? Užduotis bus pažymėta atlikta, bet kita nebus sukurta.")) return

    await completeTask(task, false)

    if (organizationId) {
      await logAudit({
        organizationId,
        tableName: "tasks",
        recordId: task.id,
        action: "update",
        changes: {
          Veiksmas: "Praleistas vienas pasikartojimas",
          Pavadinimas: task.title,
        },
      })
    }
  }

  async function stopRecurrence(task: Task) {
    if (!organizationId) return
    if (!confirm("Ar tikrai nutraukti šios užduoties kartojimą?")) return

    const updated = {
      ...task,
      recurrence_days: null,
      recurrence_until: null,
    }

    await updateTask(task, updated)

    await logAudit({
      organizationId,
      tableName: "tasks",
      recordId: task.id,
      action: "update",
      changes: {
        Veiksmas: "Nutrauktas užduoties kartojimas",
        Pavadinimas: task.title,
      },
    })
  }

  async function updateTaskStatus(task: Task, nextStatus: TaskStatus) {
    if (nextStatus === "done") {
      await completeTask(task, true)
      return
    }

    const updated = {
      ...task,
      status: nextStatus,
      completed_at: null,
    }

    await updateTask(task, updated)
  }

  async function updateTaskAssignee(task: Task, assignedTo: string) {
    const updated = {
      ...task,
      assigned_to: assignedTo || currentUserId || profiles[0]?.id || null,
    }

    await updateTask(task, updated)
  }

  async function addComment() {
    try {
      if (!selectedTask || !commentText.trim()) return
      setSaving(true)
      setMessage("")

      const actor = await getCurrentUserName()

      const { error } = await supabase.from("task_comments").insert({
        task_id: selectedTask.id,
        user_id: actor.id,
        user_name: actor.name,
        comment: commentText.trim(),
      })

      if (error) throw error

      await logAudit({
        organizationId,
        tableName: "tasks",
        recordId: selectedTask.id,
        action: "update",
        changes: {
          Komentaras: commentText.trim(),
        },
      })

      setCommentText("")
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko pridėti komentaro.")
    } finally {
      setSaving(false)
    }
  }

  function readableTask(task: Partial<Task>) {
    const resident = residents.find((item) => item.id === task.resident_id)
    const assigned = profiles.find((item) => item.id === task.assigned_to)
    const plan = carePlans.find((item) => item.id === task.care_plan_id)

    return {
      Pavadinimas: task.title || "",
      Aprašymas: task.description || "",
      Statusas: statusLabel(task.status || "new"),
      Prioritetas: priorityLabel(task.priority || "medium"),
      Atsakingas: assigned ? profileName(assigned) : "—",
      Gyventojas: resident ? residentName(resident, roomsById) : "—",
      "Individualus planas": plan ? carePlanName(plan) : "—",
      Kategorija: task.category || "—",
      Skyrius: task.department || "—",
      Terminas: task.due_date || "—",
      Kartojimas: task.recurrence_days ? `Kas ${task.recurrence_days} d.` : "—",
      "Kartoti iki": task.recurrence_until || "—",
    }
  }

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase()

    return tasks.filter((task) => {
      const resident = residents.find((item) => item.id === task.resident_id)
      const assigned = profiles.find((item) => item.id === task.assigned_to)
      const plan = carePlans.find((item) => item.id === task.care_plan_id)
      const effectiveStatus = isOverdue(task) ? "overdue" : task.status

      if (statusFilter !== "all" && effectiveStatus !== statusFilter) return false
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false
      if (employeeFilter !== "all" && task.assigned_to !== employeeFilter) return false
      if (residentFilter !== "all" && task.resident_id !== residentFilter) return false

      if (!q) return true

      return [
        task.title,
        task.category,
        task.department,
        statusLabel(effectiveStatus),
        priorityLabel(task.priority),
        residentName(resident, roomsById),
        profileName(assigned),
        carePlanName(plan),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [tasks, residents, carePlans, profiles, roomsById, query, statusFilter, priorityFilter, employeeFilter, residentFilter])

  const stats = useMemo(() => {
    return {
      all: tasks.length,
      critical: tasks.filter((task) => task.priority === "critical").length,
      overdue: tasks.filter((task) => isOverdue(task)).length,
      done: tasks.filter((task) => task.status === "done").length,
      recurring: tasks.filter((task) => Boolean(task.recurrence_days)).length,
    }
  }, [tasks])

  const criticalActiveTasks = useMemo(() => {
    return tasks
      .filter((task) => task.status !== "done" && task.status !== "cancelled")
      .filter((task) => task.priority === "critical" || isOverdue(task))
      .slice(0, 8)
  }, [tasks])

  const calendarGroups = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const limit = new Date(today)
    limit.setDate(limit.getDate() + 14)

    const groups = new Map<string, Task[]>()

    tasks
      .filter((task) => task.due_date && task.status !== "done" && task.status !== "cancelled")
      .filter((task) => {
        const date = new Date(String(task.due_date))
        return date >= today && date <= limit
      })
      .sort((a, b) => new Date(String(a.due_date)).getTime() - new Date(String(b.due_date)).getTime())
      .forEach((task) => {
        const key = new Date(String(task.due_date)).toLocaleDateString("lt-LT")
        groups.set(key, [...(groups.get(key) || []), task])
      })

    return Array.from(groups.entries())
  }, [tasks])

  const createCarePlanOptions = filteredCarePlansForResident(form.resident_id)
  const editCarePlanOptions = filteredCarePlansForResident(editingTask?.resident_id)

  if (loading) return <div style={styles.page}>Kraunama...</div>

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.heroIcon}>
          <ClipboardList size={28} />
        </div>

        <div>
          <div style={styles.eyebrow}>Darbo organizavimas</div>
          <h1 style={styles.title}>Užduotys</h1>
          <p style={styles.subtitle}>Darbuotojų užduotys, terminai, komentarai, planai ir pasikartojimai.</p>
        </div>

        <button type="button" onClick={() => void loadAll()} style={styles.refreshButton}>
          <RefreshCw size={16} />
          Atnaujinti
        </button>
      </div>

      {message ? <div style={styles.message}>{message}</div> : null}

      <section style={styles.stats}>
        <Stat label="Visos" value={stats.all} />
        <Stat label="Kritinės" value={stats.critical} danger />
        <Stat label="Pavėluotos" value={stats.overdue} warning />
        <Stat label="Atliktos" value={stats.done} />
        <Stat label="Periodinės" value={stats.recurring} />
      </section>

      {criticalActiveTasks.length > 0 ? (
        <section style={styles.alertCard}>
          <div style={styles.cardHeader}>
            <h2 style={styles.sectionTitle}>Kritinės ir vėluojančios</h2>
            <span style={styles.alertCount}>{criticalActiveTasks.length}</span>
          </div>

          <div style={styles.alertList}>
            {criticalActiveTasks.map((task) => {
              const resident = residents.find((item) => item.id === task.resident_id)
              const assigned = profiles.find((item) => item.id === task.assigned_to)

              return (
                <div key={task.id} style={styles.alertItem}>
                  <div>
                    <strong>{task.title}</strong>
                    <div style={styles.meta}>
                      {residentName(resident, roomsById)} · {profileName(assigned)} · {formatDate(task.due_date)}
                    </div>
                  </div>
                  <span style={{ ...styles.badge, ...priorityStyle(task.priority) }}>
                    {isOverdue(task) ? "Pavėluota" : priorityLabel(task.priority)}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {calendarGroups.length > 0 ? (
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.sectionTitle}>Artimiausių 14 dienų kalendorius</h2>
            <span style={styles.meta}>Pagal užduočių terminus</span>
          </div>

          <div style={styles.calendarGrid}>
            {calendarGroups.map(([date, items]) => (
              <div key={date} style={styles.calendarDay}>
                <strong>{date}</strong>
                <div style={styles.calendarTasks}>
                  {items.map((task) => {
                    const resident = residents.find((item) => item.id === task.resident_id)
                    return (
                      <div key={task.id} style={styles.calendarTask}>
                        <span>{task.title}</span>
                        <small>{residentName(resident, roomsById)}</small>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.sectionTitle}>Nauja užduotis</h2>
          <button type="button" style={styles.primaryButton} onClick={() => void createTask()} disabled={saving}>
            {saving ? "Saugoma..." : "Sukurti užduotį"}
          </button>
        </div>

        <div style={styles.formGrid}>
          <Field label="Pavadinimas">
            <input style={styles.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>

          <Field label="Kategorija">
            <select style={styles.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </Field>

          <Field label="Prioritetas">
            <select style={styles.input} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
              {PRIORITY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Statusas">
            <select style={styles.input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}>
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Atsakingas darbuotojas">
            <select style={styles.input} value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
              <option value="">Automatiškai / nepriskirta</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profileName(profile)}</option>
              ))}
            </select>
          </Field>

          <Field label="Gyventojas">
            <select
              style={styles.input}
              value={form.resident_id}
              onChange={(e) => setForm({ ...form, resident_id: e.target.value, care_plan_id: "" })}
            >
              <option value="">Bendra įstaigos užduotis</option>
              {residents.map((resident) => (
                <option key={resident.id} value={resident.id}>{residentName(resident, roomsById)}</option>
              ))}
            </select>
          </Field>

          <Field label="Individualus planas">
            <select
              style={styles.input}
              value={form.care_plan_id}
              onChange={(e) => setForm({ ...form, care_plan_id: e.target.value })}
              disabled={!form.resident_id || createCarePlanOptions.length === 0}
            >
              <option value="">Nesusieta</option>
              {createCarePlanOptions.map((plan) => (
                <option key={plan.id} value={plan.id}>{carePlanName(plan)}</option>
              ))}
            </select>
          </Field>

          <Field label="Skyrius / aukštas">
            <input style={styles.input} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </Field>

          <Field label="Terminas">
            <input type="datetime-local" style={styles.input} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </Field>

          <Field label="Kartoti kas kiek dienų">
            <input
              type="number"
              min="1"
              style={styles.input}
              value={form.recurrence_days}
              onChange={(e) => setForm({ ...form, recurrence_days: e.target.value })}
              placeholder="Pvz. 7"
            />
          </Field>

          <Field label="Kartoti iki">
            <input
              type="date"
              style={styles.input}
              value={form.recurrence_until}
              onChange={(e) => setForm({ ...form, recurrence_until: e.target.value })}
            />
          </Field>

          <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
            <span>Aprašymas</span>
            <textarea
              style={styles.textarea}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Trumpai, be perteklinės jautrios informacijos."
            />
          </label>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Filtrai</h2>

        <div style={styles.filters}>
          <Field label="Paieška">
            <input style={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ieškoti pagal užduotį, gyventoją, darbuotoją..." />
          </Field>

          <Field label="Statusas">
            <select style={styles.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Visi</option>
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Prioritetas">
            <select style={styles.input} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="all">Visi</option>
              {PRIORITY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Darbuotojas">
            <select style={styles.input} value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
              <option value="all">Visi</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profileName(profile)}</option>
              ))}
            </select>
          </Field>

          <Field label="Gyventojas">
            <select style={styles.input} value={residentFilter} onChange={(e) => setResidentFilter(e.target.value)}>
              <option value="all">Visi</option>
              {residents.map((resident) => (
                <option key={resident.id} value={resident.id}>{residentName(resident, roomsById)}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.sectionTitle}>Užduočių sąrašas</h2>
          <div style={styles.meta}>Rodoma: {filteredTasks.length}</div>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Užduotis</th>
                <th style={styles.th}>Gyventojas / planas</th>
                <th style={styles.th}>Prioritetas</th>
                <th style={styles.th}>Statusas</th>
                <th style={styles.th}>Terminas</th>
                <th style={styles.th}>Kartojimas</th>
                <th style={styles.th}>Atsakingas</th>
                <th style={styles.th}>Veiksmai</th>
              </tr>
            </thead>

            <tbody>
              {filteredTasks.map((task) => {
                const resident = residents.find((item) => item.id === task.resident_id)
                const assigned = profiles.find((item) => item.id === task.assigned_to)
                const plan = carePlans.find((item) => item.id === task.care_plan_id)
                const effectiveStatus = isOverdue(task) ? "overdue" : task.status

                return (
                  <tr key={task.id}>
                    <td style={styles.tdBold}>
                      {task.title}
                      <div style={styles.meta}>{task.category || "—"}</div>
                    </td>
                    <td style={styles.td}>
                      <strong>{residentName(resident, roomsById)}</strong>
                      <div style={styles.meta}>{plan ? carePlanName(plan) : "Planas nesusietas"}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...priorityStyle(task.priority) }}>
                        {priorityLabel(task.priority)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <select
                        style={styles.smallSelect}
                        value={effectiveStatus}
                        onChange={(e) => void updateTaskStatus(task, e.target.value as TaskStatus)}
                      >
                        {STATUS_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={styles.td}>{formatDate(task.due_date)}</td>
                    <td style={styles.td}>
                      {task.recurrence_days ? (
                        <span style={styles.recurrenceBadge}>
                          <RotateCcw size={13} />
                          Kas {task.recurrence_days} d.
                        </span>
                      ) : (
                        "—"
                      )}
                      {task.recurrence_until ? <div style={styles.meta}>Iki {formatDate(task.recurrence_until)}</div> : null}
                    </td>
                    <td style={styles.td}>
                      <select
                        style={styles.smallSelect}
                        value={task.assigned_to || ""}
                        onChange={(e) => void updateTaskAssignee(task, e.target.value)}
                      >
                        <option value="">Automatiškai</option>
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>{profileName(profile)}</option>
                        ))}
                      </select>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.rowActions}>
                        {task.status !== "done" ? (
                          <button type="button" style={styles.successButton} onClick={() => void completeTask(task, true)}>
                            <CheckCircle2 size={15} />
                            Atlikta
                          </button>
                        ) : null}

                        {task.recurrence_days && task.status !== "done" ? (
                          <button type="button" style={styles.warningButton} onClick={() => void skipOneOccurrence(task)}>
                            <SkipForward size={15} />
                            Praleisti
                          </button>
                        ) : null}

                        {task.recurrence_days ? (
                          <button type="button" style={styles.dangerSoftButton} onClick={() => void stopRecurrence(task)}>
                            <StopCircle size={15} />
                            Nutraukti
                          </button>
                        ) : null}

                        <button type="button" style={styles.secondaryButton} onClick={() => setEditingTask(task)}>
                          <Pencil size={15} />
                          Redaguoti
                        </button>

                        <button type="button" style={styles.secondaryButton} onClick={() => setSelectedTask(task)}>
                          <MessageSquare size={15} />
                          Komentarai
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} style={styles.empty}>Užduočių nėra.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {editingTask ? (
        <div style={styles.modalBackdrop} onClick={() => setEditingTask(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.sectionTitle}>Redaguoti užduotį</h2>
              <button type="button" style={styles.iconButton} onClick={() => setEditingTask(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.formGrid}>
              <Field label="Pavadinimas">
                <input style={styles.input} value={editingTask.title} onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })} />
              </Field>

              <Field label="Kategorija">
                <select style={styles.input} value={editingTask.category || ""} onChange={(e) => setEditingTask({ ...editingTask, category: e.target.value })}>
                  {CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </Field>

              <Field label="Prioritetas">
                <select style={styles.input} value={editingTask.priority} onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as TaskPriority })}>
                  {PRIORITY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Statusas">
                <select style={styles.input} value={editingTask.status} onChange={(e) => setEditingTask({ ...editingTask, status: e.target.value as TaskStatus })}>
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Atsakingas darbuotojas">
                <select style={styles.input} value={editingTask.assigned_to || ""} onChange={(e) => setEditingTask({ ...editingTask, assigned_to: e.target.value || null })}>
                  <option value="">Automatiškai</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profileName(profile)}</option>
                  ))}
                </select>
              </Field>

              <Field label="Gyventojas">
                <select
                  style={styles.input}
                  value={editingTask.resident_id || ""}
                  onChange={(e) => setEditingTask({ ...editingTask, resident_id: e.target.value || null, care_plan_id: null })}
                >
                  <option value="">Bendra įstaigos užduotis</option>
                  {residents.map((resident) => (
                    <option key={resident.id} value={resident.id}>{residentName(resident, roomsById)}</option>
                  ))}
                </select>
              </Field>

              <Field label="Individualus planas">
                <select
                  style={styles.input}
                  value={editingTask.care_plan_id || ""}
                  onChange={(e) => setEditingTask({ ...editingTask, care_plan_id: e.target.value || null })}
                  disabled={!editingTask.resident_id || editCarePlanOptions.length === 0}
                >
                  <option value="">Nesusieta</option>
                  {editCarePlanOptions.map((plan) => (
                    <option key={plan.id} value={plan.id}>{carePlanName(plan)}</option>
                  ))}
                </select>
              </Field>

              <Field label="Skyrius / aukštas">
                <input style={styles.input} value={editingTask.department || ""} onChange={(e) => setEditingTask({ ...editingTask, department: e.target.value })} />
              </Field>

              <Field label="Terminas">
                <input
                  type="datetime-local"
                  style={styles.input}
                  value={toDateTimeInput(editingTask.due_date)}
                  onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value || null })}
                />
              </Field>

              <Field label="Kartoti kas kiek dienų">
                <input
                  type="number"
                  min="1"
                  style={styles.input}
                  value={editingTask.recurrence_days || ""}
                  onChange={(e) => setEditingTask({ ...editingTask, recurrence_days: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>

              <Field label="Kartoti iki">
                <input
                  type="date"
                  style={styles.input}
                  value={toDateInput(editingTask.recurrence_until)}
                  onChange={(e) => setEditingTask({ ...editingTask, recurrence_until: e.target.value || null })}
                />
              </Field>

              <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                <span>Aprašymas</span>
                <textarea style={styles.textarea} value={editingTask.description || ""} onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })} />
              </label>
            </div>

            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => setEditingTask(null)}>
                Atšaukti
              </button>
              <button type="button" style={styles.primaryButton} onClick={() => void updateTask(tasks.find((t) => t.id === editingTask.id) || editingTask, editingTask)} disabled={saving}>
                <CheckCircle2 size={16} />
                Išsaugoti
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedTask ? (
        <div style={styles.modalBackdrop} onClick={() => setSelectedTask(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.sectionTitle}>{selectedTask.title}</h2>
                <p style={styles.subtitle}>{selectedTask.description || "Aprašymo nėra."}</p>
              </div>
              <button type="button" style={styles.iconButton} onClick={() => setSelectedTask(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.commentList}>
              {comments.filter((item) => item.task_id === selectedTask.id).length === 0 ? (
                <div style={styles.empty}>Komentarų nėra.</div>
              ) : (
                comments.filter((item) => item.task_id === selectedTask.id).map((comment) => (
                  <div key={comment.id} style={styles.comment}>
                    <strong>{comment.user_name || "Naudotojas"}</strong>
                    <span>{formatDate(comment.created_at)}</span>
                    <p>{comment.comment}</p>
                  </div>
                ))
              )}
            </div>

            <textarea
              style={styles.textarea}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Komentaras..."
            />

            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => setSelectedTask(null)}>
                Uždaryti
              </button>
              <button type="button" style={styles.primaryButton} onClick={() => void addComment()} disabled={saving}>
                Pridėti komentarą
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function Stat({ label, value, danger, warning }: { label: string; value: number; danger?: boolean; warning?: boolean }) {
  return (
    <div style={{ ...styles.stat, ...(danger ? styles.statDanger : warning ? styles.statWarning : {}) }}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

function priorityStyle(priority: TaskPriority): React.CSSProperties {
  if (priority === "critical") return { background: "#fee2e2", color: "#b91c1c" }
  if (priority === "high") return { background: "#ffedd5", color: "#c2410c" }
  if (priority === "medium") return { background: "#fef9c3", color: "#854d0e" }
  return { background: "#dcfce7", color: "#166534" }
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 24, display: "grid", gap: 18, background: "#f8fafc" },
  header: {
    display: "grid",
    gridTemplateColumns: "58px 1fr auto",
    gap: 16,
    alignItems: "center",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 24,
    padding: 22,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    background: "#ecfdf5",
    color: "#047857",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#047857",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  title: { margin: 0, fontSize: 34, fontWeight: 950, color: "#0f172a" },
  subtitle: { margin: "6px 0 0", color: "#64748b", fontSize: 14, fontWeight: 700 },
  refreshButton: {
    border: "1px solid #a7f3d0",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 13,
    padding: "10px 13px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
  },
  message: { padding: 12, borderRadius: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857", fontWeight: 800 },
  stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 },
  stat: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 },
  statDanger: { background: "#fff1f2", borderColor: "#fecdd3" },
  statWarning: { background: "#fff7ed", borderColor: "#fed7aa" },
  statValue: { fontSize: 28, fontWeight: 900, color: "#0f172a" },
  statLabel: { color: "#64748b", fontWeight: 800, fontSize: 13 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 18, display: "grid", gap: 14 },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  filters: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  field: { display: "grid", gap: 6, color: "#334155", fontSize: 13, fontWeight: 800 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" },
  textarea: { width: "100%", minHeight: 90, border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, fontSize: 14, boxSizing: "border-box" },
  primaryButton: { border: "none", borderRadius: 12, padding: "10px 14px", background: "#047857", color: "#fff", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 },
  secondaryButton: { border: "1px solid #cbd5e1", borderRadius: 12, padding: "8px 12px", background: "#fff", color: "#0f172a", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  successButton: { border: "none", borderRadius: 12, padding: "8px 12px", background: "#047857", color: "#fff", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  warningButton: { border: "1px solid #fde047", borderRadius: 12, padding: "8px 12px", background: "#fef9c3", color: "#854d0e", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  dangerSoftButton: { border: "none", borderRadius: 12, padding: "8px 12px", background: "#fee2e2", color: "#b91c1c", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", minWidth: 1180, borderCollapse: "collapse" },
  th: { textAlign: "left", padding: 12, borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 900 },
  td: { padding: 12, borderBottom: "1px solid #f1f5f9", color: "#334155", verticalAlign: "top" },
  tdBold: { padding: 12, borderBottom: "1px solid #f1f5f9", color: "#0f172a", fontWeight: 900, verticalAlign: "top" },
  meta: { marginTop: 4, color: "#64748b", fontSize: 12, fontWeight: 700 },
  badge: { display: "inline-flex", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 900 },
  recurrenceBadge: { display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 900, background: "#ecfdf5", color: "#047857" },
  smallSelect: { border: "1px solid #cbd5e1", borderRadius: 10, padding: "7px 9px", background: "#fff", fontWeight: 700 },
  empty: { padding: 24, textAlign: "center", color: "#64748b" },
  rowActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 },
  modal: { width: "100%", maxWidth: 880, maxHeight: "92vh", overflow: "auto", background: "#fff", borderRadius: 20, padding: 20, display: "grid", gap: 14 },
  modalHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  iconButton: { width: 38, height: 38, borderRadius: 12, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" },
  commentList: { display: "grid", gap: 8, maxHeight: 280, overflowY: "auto" },
  comment: { border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 12, padding: 12 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10 },

  alertCard: { background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 18, padding: 18, display: "grid", gap: 14 },
  alertCount: { background: "#be123c", color: "#fff", borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 900 },
  alertList: { display: "grid", gap: 8 },
  alertItem: { background: "#fff", border: "1px solid #fecdd3", borderRadius: 14, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  calendarGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  calendarDay: { border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#f8fafc", display: "grid", gap: 8 },
  calendarTasks: { display: "grid", gap: 6 },
  calendarTask: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 9, display: "grid", gap: 3, color: "#0f172a", fontSize: 13, fontWeight: 800 },

}
