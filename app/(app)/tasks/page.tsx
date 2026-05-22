"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Camera,
  Eye,
  FileText,
  Hammer,
  Plus,
  PencilLine,
  Repeat,
  Search,
  Sparkles,
  Timer,
  UserCheck,
  UserRound,
  Wrench,
  X,
} from "lucide-react"

import MobileBottomNav from "@/components/mobile/MobileBottomNav"
import { getCurrentAccess, hasPermission, type CurrentAccess } from "@/lib/app-access"
import { getReadableError } from "@/lib/errors"
import { formatDate, formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { supabase } from "@/lib/supabase"

type TaskRow = {
  id: string
  organization_id: string
  assigned_user_id: string | null
  created_by_user_id?: string | null
  resident_id: string | null
  title: string
  description: string | null
  type: string | null
  subtype: string | null
  status: string | null
  priority: string | null
  due_date: string | null
  created_at: string | null
  viewed_at?: string | null
  completed_at?: string | null
  interval_days: number | null
  last_done_at: string | null
}

type ResidentRow = {
  id: string
  resident_code: string | null
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  room_number?: string | null
  current_room_id?: string | null
  rooms?: { name?: string | null } | null
}

type EmployeeOption = {
  user_id: string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  staff_type?: string | null
  role?: string | null
}

type NewTaskForm = {
  title: string
  description: string
  type: string
  subtype: string
  priority: string
  status: string
  due_date: string
  resident_id: string
  assigned_user_id: string
  interval_days: string
  keep_open: boolean
  draft_note: string
}

const TASK_TYPES = [
  { value: "maintenance", label: "Ūkis / techninė problema" },
  { value: "higiena", label: "Higiena" },
  { value: "slauga", label: "Slauga" },
  { value: "mobilumas", label: "Mobilumas" },
  { value: "maitinimas", label: "Maitinimas" },
  { value: "socialinis", label: "Socialinė priežiūra" },
  { value: "administration", label: "Administracija" },
  { value: "kita", label: "Kita" },
]


const PRIORITY_OPTIONS = [
  { value: "low", label: "Žemas", className: "border-slate-200 bg-slate-50 text-slate-600" },
  { value: "medium", label: "Vidutinis", className: "border-blue-200 bg-blue-50 text-blue-700" },
  { value: "high", label: "Aukštas", className: "border-orange-200 bg-orange-50 text-orange-700" },
  { value: "urgent", label: "Kritinis", className: "border-rose-200 bg-rose-50 text-rose-700" },
]

const STATUS_OPTIONS = [
  { value: "new", label: "Nauja" },
  { value: "in_progress", label: "Vykdoma" },
  { value: "waiting_parts", label: "Laukia dalių" },
  { value: "done", label: "Užbaigta" },
]

const REPEAT_OPTIONS = [
  { value: "", label: "Nekartoti", helper: "Vienkartinė užduotis" },
  { value: "1", label: "Kasdien", helper: "Pvz., kasdienė patikra" },
  { value: "7", label: "Kas savaitę", helper: "Pvz., maudymas kas 7 d." },
  { value: "14", label: "Kas 2 savaites", helper: "Pvz., higienos priežiūra" },
  { value: "30", label: "Kas mėnesį", helper: "Pvz., patikra / papildymas" },
]

const TASK_PRESETS = [
  {
    label: "Lova",
    icon: "🛏",
    title: "Sulūžo lova",
    type: "maintenance",
    subtype: "Baldai",
    priority: "high",
    description: "Kas neveikia? Kuriame kambaryje? Ar trukdo gyventojui?",
  },
  {
    label: "Elektra",
    icon: "💡",
    title: "Reikia pakeisti lemputę",
    type: "maintenance",
    subtype: "Elektra",
    priority: "medium",
    description: "Kurioje vietoje? Ar patalpa naudojama gyventojų?",
  },
  {
    label: "Santechnika",
    icon: "🚿",
    title: "Neveikia dušas",
    type: "maintenance",
    subtype: "Santechnika",
    priority: "high",
    description: "Kas neveikia? Ar yra vandens nuotėkis? Ar reikia skubaus remonto?",
  },
  {
    label: "Tvarkymas",
    icon: "🧹",
    title: "Reikia sutvarkyti / išvalyti",
    type: "higiena",
    subtype: "Tvarkymas",
    priority: "medium",
    description: "Kuri vieta? Kas turi būti sutvarkyta?",
  },
  {
    label: "Maudymas",
    icon: "🧼",
    title: "Maudymas",
    type: "higiena",
    subtype: "Asmens higiena",
    priority: "medium",
    interval_days: "7",
    description: "Nuolatinė užduotis: maudymas pagal individualų planą.",
  },
  {
    label: "Vaistai",
    icon: "💊",
    title: "Medikamentų papildymas",
    type: "slauga",
    subtype: "Medikamentai",
    priority: "high",
    description: "Kokių medikamentų trūksta? Iki kada reikia papildyti?",
  },
]

function getPriorityOption(priority: string | null) {
  return PRIORITY_OPTIONS.find((item) => item.value === priority) || PRIORITY_OPTIONS[1]
}

function getVisibilityText(type: string, assignedUserId: string) {
  const viewers = ["Administratoriai"]

  if (type === "maintenance") viewers.push("Ūkis")
  if (type === "slauga") viewers.push("Slauga")
  if (type === "higiena") viewers.push("Slauga / higiena")
  if (type === "socialinis") viewers.push("Socialiniai darbuotojai")
  if (assignedUserId) viewers.push("Priskirtas darbuotojas")

  return viewers
}

function getSlaHint(priority: string, dueDate: string) {
  if (!dueDate) {
    if (priority === "urgent") return "Kritinei užduočiai rekomenduojamas terminas šiandien."
    if (priority === "high") return "Aukštam prioritetui rekomenduojamas terminas per 24–48 val."
    return ""
  }

  const due = new Date(dueDate)
  const hours = (due.getTime() - Date.now()) / 36e5

  if (priority === "urgent" && hours <= 24) return "🔥 Skubu: terminas per 24 val."
  if (priority === "high" && hours <= 48) return "⚠ Aukštas prioritetas: terminas arti."
  if (hours < 0) return "⚠ Terminas jau praėjęs."

  return ""
}


const initialForm: NewTaskForm = {
  title: "",
  description: "",
  type: "maintenance",
  subtype: "",
  priority: "medium",
  status: "new",
  due_date: "",
  resident_id: "",
  assigned_user_id: "",
  interval_days: "",
  keep_open: false,
  draft_note: "",
}

function isMaintenanceStaff(staffType?: string | null) {
  const value = String(staffType || "").trim().toLowerCase()

  return ["maintenance", "ukis", "ūkis", "technician", "techninis"].includes(value)
}

function canManageAllTasks(access: CurrentAccess | null) {
  return hasPermission(access, "tasks.manage")
}

function getTaskStatusLabel(status: string | null) {
  switch (status) {
    case "new":
      return "Nauja"
    case "in_progress":
      return "Vykdoma"
    case "waiting_parts":
      return "Laukia dalių"
    case "done":
      return "Atlikta"
    case "cancelled":
      return "Atšaukta"
    default:
      return "Nenurodyta"
  }
}

function getPriorityLabel(priority: string | null) {
  switch (priority) {
    case "low":
      return "Žemas"
    case "medium":
      return "Vidutinis"
    case "high":
      return "Aukštas"
    case "urgent":
      return "Skubus"
    default:
      return "—"
  }
}

function getTypeLabel(type: string | null) {
  if (type === "maintenance") return "Ūkis"
  if (type === "higiena") return "Higiena"
  if (type === "slauga") return "Slauga"
  if (type === "mobilumas") return "Mobilumas"
  if (type === "maitinimas") return "Maitinimas"
  if (type === "socialinis") return "Socialinė priežiūra"
  if (type === "administration") return "Administracija"

  return type || "Kita"
}

function employeeName(employee: EmployeeOption) {
  if (employee.full_name?.trim()) return employee.full_name.trim()

  const combined = [employee.first_name, employee.last_name]
    .filter(Boolean)
    .join(" ")
    .trim()

  return combined || employee.email || "Darbuotojas"
}

function residentName(resident?: ResidentRow) {
  if (!resident) return "—"
  if (resident.full_name?.trim()) return resident.full_name.trim()

  const combined = [resident.first_name, resident.last_name]
    .filter(Boolean)
    .join(" ")
    .trim()

  return combined || resident.resident_code || "Gyventojas"
}

function residentRoom(resident?: ResidentRow) {
  if (!resident) return "—"

  return (
    resident.room_number ||
    resident.rooms?.name ||
    resident.current_room_id ||
    "—"
  )
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)

  return local.toISOString().slice(0, 16)
}

function isTaskLate(task: TaskRow) {
  if (!task.due_date) return false
  if (task.status === "done" || task.status === "cancelled") return false

  const due = new Date(task.due_date)

  if (Number.isNaN(due.getTime())) return false

  return due.getTime() < Date.now()
}

function isOpenTask(task: TaskRow) {
  return task.status !== "done" && task.status !== "cancelled"
}

export default function TasksPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [access, setAccess] = useState<CurrentAccess | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [residentsMap, setResidentsMap] = useState<Record<string, ResidentRow>>({})
  const [allResidents, setAllResidents] = useState<ResidentRow[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [notificationsCount, setNotificationsCount] = useState(0)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [viewFilter, setViewFilter] = useState<"my" | "maintenance" | "all">("my")
  const [isMobile, setIsMobile] = useState(false)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null)
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null)
  const [form, setForm] = useState<NewTaskForm>(initialForm)
  const [editForm, setEditForm] = useState<NewTaskForm>(initialForm)

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 1024)

    update()
    window.addEventListener("resize", update)

    return () => window.removeEventListener("resize", update)
  }, [])

  async function loadData() {
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

      setCurrentUserId(user.id)

      const currentAccess = await getCurrentAccess()
      setAccess(currentAccess)

      if (!hasPermission(currentAccess, "tasks.view")) {
        setMessage("Neturite teisės matyti užduočių.")
        setLoading(false)
        return
      }

      if (!currentAccess.organizationId) {
        setMessage("Nepavyko nustatyti įstaigos.")
        setLoading(false)
        return
      }

      const { data: notifications, error: notificationsError } = await supabase
        .from("notifications")
        .select("id, is_read")
        .eq("user_id", user.id)
        .eq("is_read", false)

      if (!notificationsError) setNotificationsCount((notifications || []).length)

      const canManage = canManageAllTasks(currentAccess)
      const maintenance = isMaintenanceStaff(currentAccess.staffType)

      let query = supabase
        .from("employee_tasks")
        .select(`
          id,
          organization_id,
          assigned_user_id,
          created_by_user_id,
          resident_id,
          title,
          description,
          type,
          subtype,
          status,
          priority,
          due_date,
          created_at,
          viewed_at,
          completed_at,
          interval_days,
          last_done_at
        `)
        .eq("organization_id", currentAccess.organizationId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })

      if (!canManage) {
        if (maintenance) {
          query = query.or(
            `assigned_user_id.eq.${user.id},created_by_user_id.eq.${user.id},type.eq.maintenance`
          )
        } else {
          query = query.or(
            `assigned_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`
          )
        }
      }

      const { data: tasksData, error: tasksError } = await query

      if (tasksError) throw tasksError

      const typedTasks = (tasksData as TaskRow[]) || []
      setTasks(typedTasks)

      let residents: ResidentRow[] = []

      const residentQueries = [
        "id, resident_code, full_name, first_name, last_name, room_number, current_room_id, rooms:current_room_id(name)",
        "id, resident_code, full_name, first_name, last_name, room_number, current_room_id",
        "id, resident_code, full_name, first_name, last_name, current_room_id",
      ]

      for (const selectFields of residentQueries) {
        const { data: residentsData, error: residentsError } = await supabase
          .from("residents")
          .select(selectFields)
          .eq("organization_id", currentAccess.organizationId)
          .order("resident_code")

        if (!residentsError) {
          residents = (residentsData as ResidentRow[]) || []
          break
        }
      }

      const map: Record<string, ResidentRow> = {}

      for (const resident of residents) {
        map[resident.id] = resident
      }

      setAllResidents(residents)
      setResidentsMap(map)

      const { data: membersData, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id, staff_type, role")
        .eq("organization_id", currentAccess.organizationId)
        .eq("is_active", true)

      if (membersError) throw membersError

      const members = (membersData as EmployeeOption[]) || []
      const userIds = members
        .map((member) => member.user_id)
        .filter((value): value is string => Boolean(value))

      let profilesMap: Record<string, Partial<EmployeeOption>> = {}

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name, full_name")
          .in("id", userIds)

        profilesMap = Object.fromEntries(
          ((profilesData as Array<{
            id: string
            email?: string | null
            first_name?: string | null
            last_name?: string | null
            full_name?: string | null
          }>) || []).map((profile) => [
            profile.id,
            {
              email: profile.email,
              first_name: profile.first_name,
              last_name: profile.last_name,
              full_name: profile.full_name,
            },
          ])
        )
      }

      const mergedEmployees = members
        .map((member) => ({
          ...member,
          ...(profilesMap[member.user_id] || {}),
        }))
        .sort((a, b) => employeeName(a).localeCompare(employeeName(b), "lt"))

      setEmployees(mergedEmployees)
    } catch (error) {
      const readable = getReadableError(error)

      if (readable.includes("created_by_user_id")) {
        setMessage(
          "Užduočių lentelėje trūksta stulpelio created_by_user_id. Pridėkite jį, kad darbuotojai matytų savo sukurtas užduotis."
        )
      } else {
        setMessage(readable)
      }
    } finally {
      setLoading(false)
    }
  }

  async function createTask() {
    if (!access?.organizationId || !currentUserId) {
      setMessage("Nepavyko nustatyti naudotojo arba įstaigos.")
      return
    }

    const cleanTitle = form.title.trim()

    if (!cleanTitle) {
      setMessage("Įveskite užduoties pavadinimą.")
      return
    }

    setSaving(true)
    setMessage("")

    try {
      const payload = {
        organization_id: access.organizationId,
        assigned_user_id: form.assigned_user_id || null,
        created_by_user_id: currentUserId,
        resident_id: form.resident_id || null,
        title: cleanTitle,
        description: form.description.trim() || null,
        type: form.type || "kita",
        subtype: form.subtype.trim() || null,
        status: form.status || "new",
        priority: form.priority || "medium",
        due_date: form.due_date || null,
        interval_days: form.interval_days ? Number(form.interval_days) : null,
        viewed_at: null,
        completed_at: null,
        last_done_at: null,
      }

      const { error } = await supabase.from("employee_tasks").insert(payload)

      if (error) throw error

      if (form.keep_open) {
        setForm((previous) => ({
          ...initialForm,
          keep_open: previous.keep_open,
        }))
        setMessage("Užduotis sukurta. Forma palikta atidaryta kitai užduočiai.")
      } else {
        setShowCreateModal(false)
        setForm(initialForm)
        setMessage("Užduotis sukurta.")
      }

      await loadData()
    } catch (error) {
      const readable = getReadableError(error)

      if (readable.includes("created_by_user_id")) {
        setMessage(
          "Nepavyko sukurti: employee_tasks lentelėje trūksta created_by_user_id stulpelio. Paleiskite pridėtą SQL migraciją."
        )
      } else {
        setMessage(readable)
      }
    } finally {
      setSaving(false)
    }
  }

  function openEditTask(task: TaskRow) {
    setSelectedTask(null)
    setEditingTask(task)
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      type: task.type || "kita",
      subtype: task.subtype || "",
      priority: task.priority || "medium",
      status: task.status || "new",
      due_date: toDateTimeLocal(task.due_date),
      resident_id: task.resident_id || "",
      assigned_user_id: task.assigned_user_id || "",
      interval_days: task.interval_days ? String(task.interval_days) : "",
      keep_open: false,
      draft_note: "",
    })
  }

  async function updateTask() {
    if (!editingTask) return

    const cleanTitle = editForm.title.trim()

    if (!cleanTitle) {
      setMessage("Įveskite užduoties pavadinimą.")
      return
    }

    setSaving(true)
    setMessage("")

    try {
      const payload = {
        assigned_user_id: editForm.assigned_user_id || null,
        resident_id: editForm.resident_id || null,
        title: cleanTitle,
        description: editForm.description.trim() || null,
        type: editForm.type || "kita",
        subtype: editForm.subtype.trim() || null,
        status: editForm.status || "new",
        priority: editForm.priority || "medium",
        due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : null,
        interval_days: editForm.interval_days ? Number(editForm.interval_days) : null,
      }

      const { error } = await supabase
        .from("employee_tasks")
        .update(payload)
        .eq("id", editingTask.id)

      if (error) throw error

      setEditingTask(null)
      setMessage("Užduotis atnaujinta.")
      await loadData()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSaving(false)
    }
  }

  async function updateTaskStatus(task: TaskRow, status: string) {
    setSavingId(task.id)
    setMessage("")

    try {
      const completedAt = status === "done" ? new Date().toISOString() : task.last_done_at

      const payload: Partial<TaskRow> = {
        status,
        completed_at: status === "done" ? completedAt : task.completed_at,
        last_done_at: completedAt,
      }

      const { error } = await supabase
        .from("employee_tasks")
        .update(payload)
        .eq("id", task.id)

      if (error) throw error

      if (
        status === "done" &&
        task.interval_days &&
        task.interval_days > 0 &&
        task.due_date &&
        access?.organizationId
      ) {
        const currentDue = new Date(task.due_date)

        if (!Number.isNaN(currentDue.getTime())) {
          const nextDue = new Date(currentDue)
          nextDue.setDate(nextDue.getDate() + task.interval_days)

          const { error: recurringError } = await supabase.from("employee_tasks").insert({
            organization_id: access.organizationId,
            assigned_user_id: task.assigned_user_id,
            created_by_user_id: task.created_by_user_id || currentUserId,
            resident_id: task.resident_id,
            title: task.title,
            description: task.description,
            type: task.type,
            subtype: task.subtype,
            status: "new",
            priority: task.priority,
            due_date: nextDue.toISOString(),
            interval_days: task.interval_days,
            viewed_at: null,
            completed_at: null,
            last_done_at: null,
          })

          if (recurringError) throw recurringError
        }
      }

      await loadData()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSavingId(null)
    }
  }

  async function openTaskDetails(task: TaskRow) {
    setSelectedTask(task)

    if (task.viewed_at) return

    try {
      const viewedAt = new Date().toISOString()

      const { error } = await supabase
        .from("employee_tasks")
        .update({ viewed_at: viewedAt })
        .eq("id", task.id)

      if (error) throw error

      setTasks((previous) =>
        previous.map((item) =>
          item.id === task.id
            ? {
                ...item,
                viewed_at: viewedAt,
              }
            : item
        )
      )

      setSelectedTask((previous) =>
        previous?.id === task.id
          ? {
              ...previous,
              viewed_at: viewedAt,
            }
          : previous
      )
    } catch (error) {
      setMessage(getReadableError(error))
    }
  }

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    const canManage = canManageAllTasks(access)
    const maintenance = isMaintenanceStaff(access?.staffType)

    let rows = [...tasks]

    if (viewFilter === "my" && currentUserId) {
      rows = rows.filter(
        (task) =>
          task.assigned_user_id === currentUserId ||
          task.created_by_user_id === currentUserId ||
          canManage
      )

      if (canManage) rows = [...tasks]
    }

    if (viewFilter === "maintenance") {
      rows = rows.filter((task) => task.type === "maintenance")
    }

    if (viewFilter === "all" && !canManage && !maintenance) {
      rows = rows.filter(
        (task) =>
          task.assigned_user_id === currentUserId ||
          task.created_by_user_id === currentUserId
      )
    }

    if (statusFilter) {
      rows = rows.filter((task) => task.status === statusFilter)
    }

    if (typeFilter) {
      rows = rows.filter((task) => task.type === typeFilter)
    }

    if (q) {
      rows = rows.filter((task) => {
        const resident = task.resident_id ? residentsMap[task.resident_id] : undefined

        return [
          task.title,
          task.description,
          task.type,
          task.subtype,
          residentName(resident),
          resident?.room_number,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      })
    }

    return rows
  }, [
    tasks,
    search,
    statusFilter,
    typeFilter,
    viewFilter,
    currentUserId,
    access,
    residentsMap,
  ])

  const openTasks = tasks.filter(isOpenTask)
  const lateTasks = tasks.filter(isTaskLate)
  const maintenanceTasks = tasks.filter((task) => task.type === "maintenance")
  const myTasks = tasks.filter(
    (task) =>
      task.assigned_user_id === currentUserId ||
      task.created_by_user_id === currentUserId
  )

  const viewedTasks = tasks.filter((task) => Boolean(task.viewed_at))
  const unseenTasks = tasks.filter((task) => !task.viewed_at && isOpenTask(task))
  const completedTasks = tasks.filter((task) => task.status === "done" || Boolean(task.completed_at || task.last_done_at))
  const recurringTasks = tasks.filter((task) => task.interval_days && task.interval_days > 0)
  const urgentTasks = tasks.filter((task) => (task.priority === "urgent" || task.priority === "high") && isOpenTask(task))
  const todayTasks = tasks.filter((task) => {
    if (!task.due_date || !isOpenTask(task)) return false

    const due = new Date(task.due_date)
    const today = new Date()

    return (
      due.getFullYear() === today.getFullYear() &&
      due.getMonth() === today.getMonth() &&
      due.getDate() === today.getDate()
    )
  })

  const waitingPartsTasks = tasks.filter((task) => task.status === "waiting_parts")
  const employeesMap = useMemo(() => {
    const map: Record<string, EmployeeOption> = {}

    for (const employee of employees) {
      map[employee.user_id] = employee
    }

    return map
  }, [employees])
  const operationalTotal = Math.max(1, tasks.length)
  const completionRate = Math.round((completedTasks.length / operationalTotal) * 100)
  const viewedRate = Math.round((viewedTasks.length / operationalTotal) * 100)
  const overdueRate = Math.round((lateTasks.length / operationalTotal) * 100)
  const recurringRate = Math.round((recurringTasks.length / operationalTotal) * 100)

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-950">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
          <p className="mt-4 text-lg font-black text-slate-700">Kraunama...</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Ruošiame užduočių sąrašą.
          </p>
        </div>
      </main>
    )
  }

  const canCreate = hasPermission(access, "tasks.create")
  const canManage = canManageAllTasks(access)

  if (isMobile) {
    return (
      <main className="min-h-screen bg-[#f7faf8] pb-28 text-slate-950">
        <section className="overflow-hidden rounded-b-[34px] bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 px-5 pb-8 pt-7 text-white shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-100">
                Užduotys
              </p>
              <h1 className="mt-3 text-3xl font-black leading-tight">
                {canManage ? "Visos užduotys" : "Mano užduotys"}
              </h1>
              <p className="mt-3 max-w-[320px] text-sm font-semibold text-emerald-50/90">
                Greitas pamainos darbas telefone: skubios, šiandienos ir neperžiūrėtos užduotys.
              </p>
            </div>

            <div className="rounded-[28px] bg-white/15 p-4 backdrop-blur">
              <ClipboardList className="h-7 w-7" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <MobileTaskStat label="Šiandien" value={todayTasks.length} />
            <MobileTaskStat label="Skubios" value={urgentTasks.length} />
            <MobileTaskStat label="Vėluoja" value={lateTasks.length} />
          </div>
        </section>

        <section className="space-y-4 px-4 pt-5">
          {message ? (
            <div className="rounded-[24px] border border-amber-100 bg-amber-50 p-4 text-sm font-extrabold text-amber-800">
              {message}
            </div>
          ) : null}

          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ieškoti užduoties, gyventojo..."
              className="h-14 w-full rounded-[22px] border border-slate-200/70 bg-white py-3 pl-12 pr-4 text-sm font-bold text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
            />
          </label>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <MobileTaskChip active={viewFilter === "my"} onClick={() => setViewFilter("my")}>
              Mano
            </MobileTaskChip>
            <MobileTaskChip active={viewFilter === "maintenance"} onClick={() => setViewFilter("maintenance")}>
              Ūkis
            </MobileTaskChip>
            <MobileTaskChip active={statusFilter === "new"} onClick={() => setStatusFilter(statusFilter === "new" ? "" : "new")}>
              Naujos
            </MobileTaskChip>
            <MobileTaskChip active={statusFilter === "in_progress"} onClick={() => setStatusFilter(statusFilter === "in_progress" ? "" : "in_progress")}>
              Vykdomos
            </MobileTaskChip>
            <MobileTaskChip active={viewFilter === "all"} onClick={() => setViewFilter("all")}>
              Visos
            </MobileTaskChip>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MobileTaskMiniCard title="Nepamatytos" value={unseenTasks.length} tone="amber" />
            <MobileTaskMiniCard title="Periodinės" value={recurringTasks.length} tone="emerald" />
          </div>

          {filteredTasks.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
              <ClipboardList className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-4 text-lg font-black text-slate-700">Užduočių nėra</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Sukurk naują užduotį arba pakeisk filtrus.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <MobileTaskCard
                  key={task.id}
                  task={task}
                  resident={task.resident_id ? residentsMap[task.resident_id] : undefined}
                  assignedEmployee={task.assigned_user_id ? employeesMap[task.assigned_user_id] : undefined}
                  saving={savingId === task.id}
                  onOpen={() => void openTaskDetails(task)}
                  onDone={() => void updateTaskStatus(task, "done")}
                  onProgress={() => void updateTaskStatus(task, "in_progress")}
                />
              ))}
            </div>
          )}
        </section>

        {canCreate ? (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="fixed bottom-28 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-white shadow-2xl transition active:scale-95"
            aria-label="Sukurti užduotį"
          >
            <Plus className="h-7 w-7" />
          </button>
        ) : null}

        {showCreateModal ? (
          <MobileCreateTaskSheet
            form={form}
            setForm={setForm}
            allResidents={allResidents}
            employees={employees}
            saving={saving}
            onClose={() => setShowCreateModal(false)}
            onSubmit={() => void createTask()}
          />
        ) : null}

        {selectedTask ? (
          <MobileTaskDetailsSheet
            task={selectedTask}
            resident={selectedTask.resident_id ? residentsMap[selectedTask.resident_id] : undefined}
            assignedEmployee={selectedTask.assigned_user_id ? employeesMap[selectedTask.assigned_user_id] : undefined}
            saving={savingId === selectedTask.id}
            onClose={() => setSelectedTask(null)}
            onEdit={() => openEditTask(selectedTask)}
            onStatusChange={(status) => void updateTaskStatus(selectedTask, status)}
          />
        ) : null}

  
      {editingTask && (
        <Modal
          title="Redaguoti užduotį"
          desc="Pakeisk užduoties detales, gyventoją, kambarį per gyventojo priskyrimą, atsakingą darbuotoją ir terminą."
          onClose={() => setEditingTask(null)}
        >
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault()
              void updateTask()
            }}
          >
            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Pavadinimas" full>
                  <input
                    value={editForm.title}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, title: event.target.value }))
                    }
                    className="input text-lg"
                    placeholder="Užduoties pavadinimas"
                  />
                </Field>

                <Field label="Gyventojas">
                  <select
                    value={editForm.resident_id}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, resident_id: event.target.value }))
                    }
                    className="input"
                  >
                    <option value="">Pasirinkti gyventoją (nebūtina)</option>
                    {allResidents.map((resident) => (
                      <option key={resident.id} value={resident.id}>
                        {residentName(resident)}{residentRoom(resident) !== "—" ? ` · kamb. ${residentRoom(resident)}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Priskirti darbuotojui">
                  <select
                    value={editForm.assigned_user_id}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, assigned_user_id: event.target.value }))
                    }
                    className="input"
                  >
                    <option value="">Pasirinkti darbuotoją (nebūtina)</option>
                    {employees.map((employee) => (
                      <option key={employee.user_id} value={employee.user_id}>
                        {employeeName(employee)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Tipas">
                  <select
                    value={editForm.type}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, type: event.target.value }))
                    }
                    className="input"
                  >
                    {TASK_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Statusas">
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, status: event.target.value }))
                    }
                    className="input"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Prioritetas">
                  <select
                    value={editForm.priority}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, priority: event.target.value }))
                    }
                    className="input"
                  >
                    {PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Terminas">
                  <input
                    type="datetime-local"
                    value={editForm.due_date}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, due_date: event.target.value }))
                    }
                    className="input"
                  />
                </Field>

                <Field label="Papildoma kategorija">
                  <input
                    value={editForm.subtype}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, subtype: event.target.value }))
                    }
                    className="input"
                    placeholder="Pvz., baldai, elektra, higiena"
                  />
                </Field>

                <Field label="Pasikartojimas">
                  <select
                    value={editForm.interval_days}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, interval_days: event.target.value }))
                    }
                    className="input"
                  >
                    {REPEAT_OPTIONS.map((option) => (
                      <option key={option.value || "none"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <Field label="Aprašymas">
              <textarea
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((previous) => ({ ...previous, description: event.target.value }))
                }
                className="input min-h-36 resize-none"
                placeholder="Trumpai aprašyk užduotį..."
              />
            </Field>

            {editForm.resident_id ? (
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold text-emerald-900">
                Pasirinktas gyventojas: {residentName(residentsMap[editForm.resident_id])} · kambarys: {residentRoom(residentsMap[editForm.resident_id])}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
              <button type="button" onClick={() => setEditingTask(null)} className="btn-secondary">
                Atšaukti
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saugoma..." : "Išsaugoti pakeitimus"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <MobileBottomNav notificationsCount={notificationsCount} />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-28 text-slate-950 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700">
                <ClipboardList className="h-7 w-7" />
              </div>

              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                  Užduotys
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                  {canManage ? "Visos užduotys" : "Mano užduotys"}
                </h1>
                <p className="mt-2 text-base font-semibold text-slate-500 sm:text-lg">
                  Darbuotojai mato jiems priskirtas ir jų sukurtas užduotis.
                  Ūkis mato technines užduotis.
                </p>
              </div>
            </div>

            {canCreate ? (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-black text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
              >
                <Plus className="h-5 w-5" />
                Sukurti užduotį
              </button>
            ) : null}
          </div>
        </section>

        {message ? (
          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 font-extrabold text-amber-800">
            {message}
          </div>
        ) : null}

        <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                Operacinis dashboardas
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                Užduočių situacija
              </h2>
              <p className="mt-1 font-semibold text-slate-500">
                Greitai matosi vėlavimai, neperžiūrėtos užduotys, periodinės procedūros ir atlikimo progresas.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <DashboardPill label="Šiandien" value={todayTasks.length} tone="blue" />
              <DashboardPill label="Skubios" value={urgentTasks.length} tone="rose" />
              <DashboardPill label="Laukia dalių" value={waitingPartsTasks.length} tone="amber" />
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <CircleStat
              title="Atlikimo progresas"
              value={completedTasks.length}
              total={operationalTotal}
              percent={completionRate}
              tone="emerald"
              helper="Atliktos užduotys"
            />
            <CircleStat
              title="Peržiūrėjimas"
              value={viewedTasks.length}
              total={operationalTotal}
              percent={viewedRate}
              tone="blue"
              helper="Darbuotojai jau pamatė"
            />
            <CircleStat
              title="Vėlavimai"
              value={lateTasks.length}
              total={operationalTotal}
              percent={overdueRate}
              tone="rose"
              helper="Praėjęs terminas"
            />
            <CircleStat
              title="Periodinės"
              value={recurringTasks.length}
              total={operationalTotal}
              percent={recurringRate}
              tone="amber"
              helper="Kartojamos užduotys"
            />
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
          <StatCard
            icon={<UserRound className="h-6 w-6" />}
            title="Mano"
            value={String(canManage ? tasks.length : myTasks.length)}
            meta="užduočių"
            tone="emerald"
          />
          <StatCard
            icon={<Clock className="h-6 w-6" />}
            title="Atviros"
            value={String(openTasks.length)}
            meta="vykdomos"
            tone="blue"
          />
          <StatCard
            icon={<Eye className="h-6 w-6" />}
            title="Nepamatytos"
            value={String(unseenTasks.length)}
            meta="reikia dėmesio"
            tone="amber"
          />
          <StatCard
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="Įvykdytos"
            value={String(completedTasks.length)}
            meta="atliktos"
            tone="emerald"
          />
          <StatCard
            icon={<Wrench className="h-6 w-6" />}
            title="Ūkis"
            value={String(maintenanceTasks.length)}
            meta="techninės"
            tone="slate"
          />
          <StatCard
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Vėluoja"
            value={String(lateTasks.length)}
            meta="užduočių"
            tone="rose"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <article className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                  Sąrašas
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">
                  Užduočių kortelės
                </h2>
                <p className="mt-1 font-semibold text-slate-500">
                  Paspausk užduotį, kad pamatytum daugiau informacijos.
                </p>
              </div>

              <label className="relative block w-full md:w-80">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Ieškoti užduoties..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Select
                value={viewFilter}
                onChange={(value) => setViewFilter(value as "my" | "maintenance" | "all")}
              >
                <option value="my">Mano vaizdas</option>
                <option value="maintenance">Ūkio užduotys</option>
                <option value="all">Visos leidžiamos</option>
              </Select>

              <Select value={statusFilter} onChange={setStatusFilter}>
                <option value="">Visi statusai</option>
                <option value="new">Nauja</option>
                <option value="in_progress">Vykdoma</option>
                <option value="waiting_parts">Laukia dalių</option>
                <option value="done">Atlikta</option>
                <option value="cancelled">Atšaukta</option>
              </Select>

              <Select value={typeFilter} onChange={setTypeFilter}>
                <option value="">Visi tipai</option>
                {TASK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>

              <button
                type="button"
                onClick={() => void loadData()}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-black text-slate-700 transition hover:bg-slate-100 active:scale-[0.99]"
              >
                Atnaujinti
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <TaskSegmentCard
                title="Mano užduotys"
                value={myTasks.length}
                helper="Priskirtos arba sukurtos man"
                tone="emerald"
                onClick={() => setViewFilter("my")}
              />
              <TaskSegmentCard
                title="Techninės / ūkio"
                value={maintenanceTasks.length}
                helper="Ūkio darbai ir gedimai"
                tone="amber"
                onClick={() => setViewFilter("maintenance")}
              />
              <TaskSegmentCard
                title="Periodinės"
                value={recurringTasks.length}
                helper="Maudymas, patikros, priežiūra"
                tone="blue"
                onClick={() => {
                  setViewFilter("all")
                  setStatusFilter("")
                  setTypeFilter("")
                }}
              />
              <TaskSegmentCard
                title="Pavėluotos"
                value={lateTasks.length}
                helper="Praėję terminai"
                tone="rose"
                onClick={() => {
                  setViewFilter("all")
                  setStatusFilter("")
                }}
              />
            </div>

            {filteredTasks.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <ClipboardList className="mx-auto h-10 w-10 text-slate-400" />
                <p className="mt-4 text-lg font-black text-slate-700">
                  Užduočių nėra
                </p>
                <p className="mt-1 font-semibold text-slate-500">
                  Sukurk naują užduotį arba pakeisk filtrus.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    resident={task.resident_id ? residentsMap[task.resident_id] : undefined}
                    assignedEmployee={task.assigned_user_id ? employeesMap[task.assigned_user_id] : undefined}
                    saving={savingId === task.id}
                    onClick={() => void openTaskDetails(task)}
                    onEdit={() => openEditTask(task)}
                    onStatusChange={(status) => void updateTaskStatus(task, status)}
                  />
                ))}
              </div>
            )}
          </article>

          <aside className="grid content-start gap-6">
            <article className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-amber-700">
                    Greitas kūrimas
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Pranešti problemai
                  </h2>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <Hammer className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                {[
                  { title: "Sulūžo lova", type: "maintenance", interval: "", hint: "Sukurti ūkio užduotį" },
                  { title: "Neveikia lemputė", type: "maintenance", interval: "", hint: "Sukurti ūkio užduotį" },
                  { title: "Maudymas", type: "higiena", interval: "7", hint: "Nuolatinė užduotis kas 7 d." },
                  { title: "Nagų / plaukų priežiūra", type: "higiena", interval: "14", hint: "Nuolatinė užduotis kas 14 d." },
                  { title: "Kambario patikra", type: "socialinis", interval: "7", hint: "Nuolatinė užduotis kas 7 d." },
                ].map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                      setForm({
                        ...initialForm,
                        title: item.title,
                        type: item.type,
                        priority: item.title === "Sulūžo lova" ? "high" : "medium",
                        interval_days: item.interval,
                      })
                      setShowCreateModal(true)
                    }}
                    className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50 active:scale-[0.99]"
                  >
                    <span>
                      <b>{item.title}</b>
                      <br />
                      <small className="font-semibold text-slate-500">
                        {item.hint}
                      </small>
                    </span>

                    <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
                  </button>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">Matomumo taisyklės</h2>
              <div className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
                <p>• Admin / owner mato visas užduotis.</p>
                <p>• Darbuotojas mato jam priskirtas ir jo sukurtas užduotis.</p>
                <p>• Ūkio darbuotojas mato technines ūkio užduotis.</p>
              </div>
            </article>
          </aside>
        </section>
      </div>

      {showCreateModal && (
        <Modal
          title="Sukurti užduotį"
          desc="Greitai registruokite problemą, paskirkite atsakingą žmogų ir nustatykite terminą."
          onClose={() => setShowCreateModal(false)}
        >
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault()
              void createTask()
            }}
          >
            <section className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5">
              <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-emerald-700">
                <Sparkles className="h-4 w-4" />
                Greiti šablonai
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {TASK_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        title: preset.title,
                        type: preset.type,
                        subtype: preset.subtype,
                        priority: preset.priority,
                        description: preset.description,
                        interval_days: preset.interval_days || previous.interval_days,
                      }))
                    }
                    className="rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-100 active:scale-[0.98]"
                  >
                    <span className="mr-1">{preset.icon}</span>
                    {preset.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Pavadinimas" full>
                  <input
                    value={form.title}
                    onChange={(event) => {
                      const value = event.target.value

                      setForm((previous) => {
                        const lower = value.toLowerCase()
                        const suggestion: Partial<NewTaskForm> = {}

                        if (lower.includes("lova")) {
                          suggestion.type = "maintenance"
                          suggestion.subtype = "Baldai"
                          suggestion.priority = "high"
                        } else if (lower.includes("duš") || lower.includes("kriauk")) {
                          suggestion.type = "maintenance"
                          suggestion.subtype = "Santechnika"
                          suggestion.priority = "high"
                        } else if (lower.includes("lemput") || lower.includes("elektr")) {
                          suggestion.type = "maintenance"
                          suggestion.subtype = "Elektra"
                          suggestion.priority = "medium"
                        } else if (lower.includes("maud")) {
                          suggestion.type = "higiena"
                          suggestion.subtype = "Asmens higiena"
                          suggestion.priority = "medium"
                          suggestion.interval_days = previous.interval_days || "7"
                        }

                        return {
                          ...previous,
                          ...suggestion,
                          title: value,
                        }
                      })
                    }}
                    className="input text-lg"
                    placeholder="Pvz., sulūžo lova 203 kambaryje"
                  />
                  {form.subtype ? (
                    <p className="mt-2 text-sm font-bold text-emerald-700">
                      🤖 Pasiūlyta: {getTypeLabel(form.type)} · {form.subtype}
                    </p>
                  ) : null}
                </Field>

                <Field label="Prioritetas" full>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {PRIORITY_OPTIONS.map((priority) => (
                      <button
                        key={priority.value}
                        type="button"
                        onClick={() =>
                          setForm((previous) => ({
                            ...previous,
                            priority: priority.value,
                          }))
                        }
                        className={`rounded-2xl border px-4 py-3 text-sm font-black transition active:scale-[0.98] ${
                          priority.className
                        } ${form.priority === priority.value ? "ring-4 ring-emerald-100" : ""}`}
                      >
                        {priority.label}
                      </button>
                    ))}
                  </div>
                  {getSlaHint(form.priority, form.due_date) ? (
                    <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-800">
                      {getSlaHint(form.priority, form.due_date)}
                    </p>
                  ) : null}
                </Field>

                <Field label="Tipas">
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        type: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    {TASK_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Statusas">
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        status: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Gyventojas">
                  <select
                    value={form.resident_id}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        resident_id: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    <option value="">Pasirinkti gyventoją (nebūtina)</option>
                    {allResidents.map((resident) => (
                      <option key={resident.id} value={resident.id}>
                        {residentName(resident)}{residentRoom(resident) !== "—" ? ` · kamb. ${residentRoom(resident)}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Priskirti darbuotojui">
                  <select
                    value={form.assigned_user_id}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        assigned_user_id: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    <option value="">Pasirinkti darbuotoją (nebūtina)</option>
                    {employees.map((employee) => (
                      <option key={employee.user_id} value={employee.user_id}>
                        {employeeName(employee)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Terminas">
                  <input
                    type="datetime-local"
                    value={form.due_date}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        due_date: event.target.value,
                      }))
                    }
                    className="input"
                  />
                </Field>

                <Field label="Papildoma kategorija">
                  <input
                    value={form.subtype}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        subtype: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="Pvz., baldai, elektra, santechnika"
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200/70 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Repeat className="h-5 w-5 text-emerald-700" />
                <h3 className="text-xl font-black">Pasikartojimas</h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {REPEAT_OPTIONS.map((option) => (
                  <button
                    key={option.value || "none"}
                    type="button"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        interval_days: option.value,
                      }))
                    }
                    className={`rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                      form.interval_days === option.value
                        ? "border-emerald-300 bg-emerald-50 ring-4 ring-emerald-50"
                        : "border-slate-200 bg-slate-50 hover:bg-white"
                    }`}
                  >
                    <b className="block text-sm">{option.label}</b>
                    <span className="mt-1 block text-xs font-bold text-slate-500">
                      {option.helper}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200/70 bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-slate-600" />
                  <h3 className="text-lg font-black">Kas matys?</h3>
                </div>
                <div className="space-y-2">
                  {getVisibilityText(form.type, form.assigned_user_id).map((viewer) => (
                    <div
                      key={viewer}
                      className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-700"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {viewer}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Camera className="h-5 w-5 text-slate-600" />
                  <h3 className="text-lg font-black">Nuotrauka</h3>
                </div>
                <p className="text-sm font-semibold text-slate-500">
                  Vėliau čia galima prijungti foto / screenshot įkėlimą. Dokumentų kelti nereikia.
                </p>
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-black text-slate-400">
                  📷 Foto zona / preview
                </div>
              </div>
            </section>

            <Field label="Aprašymas">
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                className="input min-h-36 resize-none"
                placeholder="Trumpai aprašyk problemą arba užduotį..."
              />
              <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                <b className="text-slate-700">Padeda kokybiškam aprašymui:</b>
                <br />
                • Kas neveikia?
                <br />
                • Kurioje vietoje?
                <br />
                • Ar trukdo gyventojams?
                <br />
                • Ar reikia skubaus reagavimo?
              </div>
            </Field>

            <div className="sticky bottom-0 z-10 -mx-7 -mb-7 border-t border-slate-100 bg-white/95 p-5 backdrop-blur">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <label className="flex items-center gap-2 text-sm font-black text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.keep_open}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        keep_open: event.target.checked,
                      }))
                    }
                  />
                  Sukūrus palikti formą atidarytą
                </label>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary"
                  >
                    Atšaukti
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        draft_note: "draft",
                      }))
                    }
                    className="btn-secondary"
                  >
                    Išsaugoti juodraštį
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary bg-emerald-700 hover:bg-emerald-800">
                    {saving ? "Kuriama..." : "Sukurti užduotį"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {selectedTask && (
        <Modal
          title={selectedTask.title}
          desc="Užduoties informacija"
          onClose={() => setSelectedTask(null)}
        >
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <DetailBox label="Statusas" value={getTaskStatusLabel(selectedTask.status)} />
                <DetailBox label="Tipas" value={getTypeLabel(selectedTask.type)} />
                <DetailBox label="Prioritetas" value={getPriorityLabel(selectedTask.priority)} />
                <DetailBox label="Terminas" value={formatDateTime(selectedTask.due_date)} />
                <DetailBox
                  label="Gyventojas"
                  value={residentName(
                    selectedTask.resident_id
                      ? residentsMap[selectedTask.resident_id]
                      : undefined
                  )}
                />
                <DetailBox
                  label="Kambarys"
                  value={residentRoom(
                    selectedTask.resident_id
                      ? residentsMap[selectedTask.resident_id]
                      : undefined
                  )}
                />
                <DetailBox label="Sukurta" value={formatDate(selectedTask.created_at)} />
                <DetailBox
                  label="Priskirta"
                  value={
                    selectedTask.assigned_user_id && employeesMap[selectedTask.assigned_user_id]
                      ? employeeName(employeesMap[selectedTask.assigned_user_id])
                      : "Nepriskirta"
                  }
                />
                <DetailBox label="Pamatė" value={formatDateTime(selectedTask.viewed_at || null)} />
                <DetailBox label="Įvykdė" value={formatDateTime(selectedTask.completed_at || selectedTask.last_done_at || null)} />
                <DetailBox label="Kartojimas" value={selectedTask.interval_days ? `Kas ${selectedTask.interval_days} d.` : "Nekartojama"} />
              </div>
            </div>

            {selectedTask.description ? (
              <div className="rounded-3xl border border-slate-200/70 bg-white p-5">
                <p className="text-sm font-extrabold uppercase tracking-widest text-slate-400">
                  Aprašymas
                </p>
                <p className="mt-2 whitespace-pre-wrap font-semibold text-slate-700">
                  {selectedTask.description}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => openEditTask(selectedTask)}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <PencilLine className="h-4 w-4" />
                Redaguoti
              </button>
              <button
                type="button"
                onClick={() => void updateTaskStatus(selectedTask, "in_progress")}
                className="btn-secondary"
              >
                Pažymėti vykdoma
              </button>
              <button
                type="button"
                onClick={() => void updateTaskStatus(selectedTask, "waiting_parts")}
                className="btn-secondary"
              >
                Laukia dalių
              </button>
              <button
                type="button"
                onClick={() => void updateTaskStatus(selectedTask, "done")}
                className="btn-primary"
              >
                Pažymėti atlikta
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editingTask && (
        <Modal
          title="Redaguoti užduotį"
          desc="Pakeisk užduoties detales, gyventoją, kambarį per gyventojo priskyrimą, atsakingą darbuotoją ir terminą."
          onClose={() => setEditingTask(null)}
        >
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault()
              void updateTask()
            }}
          >
            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Pavadinimas" full>
                  <input
                    value={editForm.title}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, title: event.target.value }))
                    }
                    className="input text-lg"
                    placeholder="Užduoties pavadinimas"
                  />
                </Field>

                <Field label="Gyventojas">
                  <select
                    value={editForm.resident_id}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, resident_id: event.target.value }))
                    }
                    className="input"
                  >
                    <option value="">Pasirinkti gyventoją (nebūtina)</option>
                    {allResidents.map((resident) => (
                      <option key={resident.id} value={resident.id}>
                        {residentName(resident)}{residentRoom(resident) !== "—" ? ` · kamb. ${residentRoom(resident)}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Priskirti darbuotojui">
                  <select
                    value={editForm.assigned_user_id}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, assigned_user_id: event.target.value }))
                    }
                    className="input"
                  >
                    <option value="">Pasirinkti darbuotoją (nebūtina)</option>
                    {employees.map((employee) => (
                      <option key={employee.user_id} value={employee.user_id}>
                        {employeeName(employee)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Tipas">
                  <select
                    value={editForm.type}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, type: event.target.value }))
                    }
                    className="input"
                  >
                    {TASK_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Statusas">
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, status: event.target.value }))
                    }
                    className="input"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Prioritetas">
                  <select
                    value={editForm.priority}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, priority: event.target.value }))
                    }
                    className="input"
                  >
                    {PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Terminas">
                  <input
                    type="datetime-local"
                    value={editForm.due_date}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, due_date: event.target.value }))
                    }
                    className="input"
                  />
                </Field>

                <Field label="Papildoma kategorija">
                  <input
                    value={editForm.subtype}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, subtype: event.target.value }))
                    }
                    className="input"
                    placeholder="Pvz., baldai, elektra, higiena"
                  />
                </Field>

                <Field label="Pasikartojimas">
                  <select
                    value={editForm.interval_days}
                    onChange={(event) =>
                      setEditForm((previous) => ({ ...previous, interval_days: event.target.value }))
                    }
                    className="input"
                  >
                    {REPEAT_OPTIONS.map((option) => (
                      <option key={option.value || "none"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <Field label="Aprašymas">
              <textarea
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((previous) => ({ ...previous, description: event.target.value }))
                }
                className="input min-h-36 resize-none"
                placeholder="Trumpai aprašyk užduotį..."
              />
            </Field>

            {editForm.resident_id ? (
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold text-emerald-900">
                Pasirinktas gyventojas: {residentName(residentsMap[editForm.resident_id])} · kambarys: {residentRoom(residentsMap[editForm.resident_id])}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
              <button type="button" onClick={() => setEditingTask(null)} className="btn-secondary">
                Atšaukti
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saugoma..." : "Išsaugoti pakeitimus"}
              </button>
            </div>
          </form>
        </Modal>
      )}


      <MobileBottomNav notificationsCount={notificationsCount} />

      <style jsx>{`
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
          background: #047857;
          padding: 0.85rem 1.35rem;
          font-weight: 900;
          color: white;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .btn-primary:hover {
          background: #065f46;
        }

        .btn-primary:active {
          transform: scale(0.98);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          border-radius: 1rem;
          border: 1px solid #dbe3ef;
          background: white;
          padding: 0.85rem 1.35rem;
          font-weight: 900;
          color: #334155;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .btn-secondary:hover {
          background: #f8fafc;
        }

        .btn-secondary:active {
          transform: scale(0.98);
        }
      `}</style>
    </main>
  )
}



function MobileTaskStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[28px] bg-white/15 p-4 backdrop-blur">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-emerald-50">
        {label}
      </div>
    </div>
  )
}

function MobileTaskChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-black transition active:scale-[0.98] ${
        active
          ? "bg-slate-950 text-white"
          : "border border-slate-200/70 bg-white text-slate-600"
      }`}
    >
      {children}
    </button>
  )
}

function MobileTaskMiniCard({
  title,
  value,
  tone,
}: {
  title: string
  value: number
  tone: "amber" | "emerald"
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-100 bg-amber-50 text-amber-800"
      : "border-emerald-100 bg-emerald-50 text-emerald-800"

  return (
    <article className={`rounded-[24px] border p-4 shadow-sm ${toneClass}`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-black uppercase tracking-wide opacity-80">
        {title}
      </div>
    </article>
  )
}

function MobilePriorityPill({ priority }: { priority: string | null }) {
  const option = getPriorityOption(priority)

  return (
    <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${option.className}`}>
      {getPriorityLabel(priority)}
    </span>
  )
}

function MobileTaskCard({
  task,
  resident,
  assignedEmployee,
  saving,
  onOpen,
  onDone,
  onProgress,
}: {
  task: TaskRow
  resident?: ResidentRow
  assignedEmployee?: EmployeeOption
  saving: boolean
  onOpen: () => void
  onDone: () => void
  onProgress: () => void
}) {
  const late = isTaskLate(task)
  const done = task.status === "done"

  return (
    <article
      className={`rounded-[28px] border p-4 shadow-sm ${
        done
          ? "border-emerald-100 bg-emerald-50"
          : late
            ? "border-rose-100 bg-rose-50"
            : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <MobilePriorityPill priority={task.priority} />
            {!task.viewed_at && isOpenTask(task) ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black text-amber-800">
                Nepamatyta
              </span>
            ) : null}
            {late ? (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-[10px] font-black text-rose-700">
                Vėluoja
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 text-lg font-black leading-tight text-slate-950">
            {task.title}
          </h3>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            {residentName(resident)} · kamb. {residentRoom(resident)} · {getTypeLabel(task.type)}
          </p>
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={done ? onProgress : onDone}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition active:scale-95 disabled:opacity-50 ${
            done ? "bg-white text-emerald-700" : "bg-emerald-50 text-emerald-700"
          }`}
          aria-label={done ? "Grąžinti" : "Atlikta"}
        >
          <CheckCircle2 className="h-5 w-5" />
        </button>
      </div>

      {task.description ? (
        <p className="mt-4 line-clamp-2 text-sm font-medium leading-relaxed text-slate-600">
          {task.description}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 rounded-[20px] bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {task.due_date ? formatDateTime(task.due_date) : "Be termino"}
          </span>
          <span>{getTaskStatusLabel(task.status)}</span>
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Priskirta: {assignedEmployee ? employeeName(assignedEmployee) : "Nepriskirta"}
        </div>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-3 h-11 w-full rounded-2xl bg-slate-950 text-sm font-black text-white transition active:scale-[0.99]"
      >
        Atidaryti
      </button>
    </article>
  )
}

function MobileCreateTaskSheet({
  form,
  setForm,
  allResidents,
  employees,
  saving,
  onClose,
  onSubmit,
}: {
  form: NewTaskForm
  setForm: (updater: NewTaskForm | ((previous: NewTaskForm) => NewTaskForm)) => void
  allResidents: ResidentRow[]
  employees: EmployeeOption[]
  saving: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-slate-950/45 backdrop-blur-sm">
      <section className="max-h-[92vh] w-full overflow-y-auto rounded-t-[32px] bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
              Nauja užduotis
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Sukurti greitai</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"
            aria-label="Uždaryti"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">
              Pavadinimas
            </span>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, title: event.target.value }))
              }
              className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-bold outline-none focus:border-emerald-300 focus:bg-white"
              placeholder="Pvz., sulūžo lova 203 kambaryje"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">
                Tipas
              </span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, type: event.target.value }))
                }
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none"
              >
                {TASK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">
                Prioritetas
              </span>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, priority: event.target.value }))
                }
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none"
              >
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">
              Gyventojas
            </span>
            <select
              value={form.resident_id}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, resident_id: event.target.value }))
              }
              className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-bold outline-none"
            >
              <option value="">Nepriskirta gyventojui</option>
              {allResidents.map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {residentName(resident)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">
              Priskirti darbuotojui
            </span>
            <select
              value={form.assigned_user_id}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  assigned_user_id: event.target.value,
                }))
              }
              className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-bold outline-none"
            >
              <option value="">Nepriskirta</option>
              {employees.map((employee) => (
                <option key={employee.user_id} value={employee.user_id}>
                  {employeeName(employee)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">
              Aprašymas
            </span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-emerald-300 focus:bg-white"
              placeholder="Trumpai aprašyk problemą..."
            />
          </label>

          <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-slate-100 bg-white/95 p-5 backdrop-blur">
            <button
              type="submit"
              disabled={saving}
              className="h-14 w-full rounded-2xl bg-emerald-700 text-base font-black text-white disabled:opacity-60"
            >
              {saving ? "Kuriama..." : "Sukurti užduotį"}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function MobileTaskDetailsSheet({
  task,
  resident,
  assignedEmployee,
  saving,
  onClose,
  onEdit,
  onStatusChange,
}: {
  task: TaskRow
  resident?: ResidentRow
  assignedEmployee?: EmployeeOption
  saving: boolean
  onClose: () => void
  onEdit: () => void
  onStatusChange: (status: string) => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-slate-950/45 backdrop-blur-sm">
      <section className="max-h-[92vh] w-full overflow-y-auto rounded-t-[32px] bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <MobilePriorityPill priority={task.priority} />
            <h2 className="mt-3 text-2xl font-black tracking-tight">{task.title}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {residentName(resident)} · {getTypeLabel(task.type)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"
            aria-label="Uždaryti"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3">
          <DetailBox label="Statusas" value={getTaskStatusLabel(task.status)} />
          <DetailBox label="Terminas" value={formatDateTime(task.due_date)} />
          <DetailBox label="Gyventojas" value={residentName(resident)} />
          <DetailBox label="Kambarys" value={residentRoom(resident)} />
          <DetailBox
            label="Priskirta"
            value={assignedEmployee ? employeeName(assignedEmployee) : "Nepriskirta"}
          />
          <DetailBox label="Kartojimas" value={task.interval_days ? `Kas ${task.interval_days} d.` : "Nekartojama"} />
        </div>

        {task.description ? (
          <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
              Aprašymas
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-700">
              {task.description}
            </p>
          </div>
        ) : null}

        <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 bg-white/95 p-5 backdrop-blur">
          <button
            type="button"
            onClick={onEdit}
            className="col-span-2 h-13 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 font-black text-slate-700"
          >
            Redaguoti užduotį
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onStatusChange("in_progress")}
            className="h-13 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 font-black text-slate-700 disabled:opacity-60"
          >
            Vykdoma
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onStatusChange("done")}
            className="h-13 rounded-2xl bg-emerald-700 px-4 py-3 font-black text-white disabled:opacity-60"
          >
            Atlikta
          </button>
        </div>
      </section>
    </div>
  )
}


function CircleStat({
  title,
  value,
  total,
  percent,
  tone,
  helper,
}: {
  title: string
  value: number
  total: number
  percent: number
  tone: "emerald" | "blue" | "amber" | "rose"
  helper: string
}) {
  const color = {
    emerald: "#047857",
    blue: "#2563eb",
    amber: "#d97706",
    rose: "#e11d48",
  }[tone]

  const bg = {
    emerald: "bg-emerald-50 text-emerald-800",
    blue: "bg-blue-50 text-blue-800",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-800",
  }[tone]

  const radius = 42
  const circumference = 2 * Math.PI * radius
  const safePercent = Math.max(0, Math.min(100, percent || 0))
  const strokeDashoffset = circumference - (safePercent / 100) * circumference

  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="9"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <b className="text-2xl font-black">{safePercent}%</b>
            <span className="text-xs font-black text-slate-400">{value}/{total}</span>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-lg font-black text-slate-950">{title}</p>
          <p className="mt-1 text-sm font-bold text-slate-500">{helper}</p>
          <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${bg}`}>
            {value} įrašai
          </span>
        </div>
      </div>
    </article>
  )
}

function DashboardPill({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "blue" | "amber" | "rose"
}) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
  }[tone]

  return (
    <div className={`rounded-2xl border px-4 py-3 font-black ${toneClass}`}>
      {label}: {value}
    </div>
  )
}

function TaskSegmentCard({
  title,
  value,
  helper,
  tone,
  onClick,
}: {
  title: string
  value: number
  helper: string
  tone: "emerald" | "amber" | "blue" | "rose"
  onClick: () => void
}) {
  const toneClass = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-800",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    blue: "border-blue-100 bg-blue-50 text-blue-800",
    rose: "border-rose-100 bg-rose-50 text-rose-800",
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}
    >
      <span className="text-3xl font-black">{value}</span>
      <p className="mt-1 font-black">{title}</p>
      <p className="mt-1 text-xs font-bold opacity-75">{helper}</p>
    </button>
  )
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-black text-slate-700 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-50"
    >
      {children}
    </select>
  )
}

function StatCard({
  icon,
  title,
  value,
  meta,
  tone,
}: {
  icon: React.ReactNode
  title: string
  value: string
  meta: string
  tone: "emerald" | "amber" | "blue" | "rose" | "slate"
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-50 text-slate-700",
  }[tone]

  const textClass = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    blue: "text-blue-700",
    rose: "text-rose-700",
    slate: "text-slate-700",
  }[tone]

  return (
    <article className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
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
    </article>
  )
}

function TaskCard({
  task,
  resident,
  assignedEmployee,
  saving,
  onClick,
  onEdit,
  onStatusChange,
}: {
  task: TaskRow
  resident?: ResidentRow
  assignedEmployee?: EmployeeOption
  saving: boolean
  onClick: () => void
  onEdit: () => void
  onStatusChange: (status: string) => void
}) {
  const late = isTaskLate(task)

  return (
    <article
      className={`rounded-3xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        task.status === "done"
          ? "border-emerald-100 bg-emerald-50"
          : late
            ? "border-rose-100 bg-rose-50"
            : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <button type="button" onClick={onClick} className="flex-1 text-left">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-950">{task.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-500">
                  {getTypeLabel(task.type)}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${getPriorityOption(task.priority).className}`}>
                  {getPriorityLabel(task.priority)}
                </span>
              </div>
            </div>

            <span
              className={`rounded-full bg-white px-3 py-1 text-sm font-black ${
                late ? "text-rose-700" : "text-slate-700"
              }`}
            >
              {late ? "Vėluoja" : getTaskStatusLabel(task.status)}
            </span>
            {!task.viewed_at ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-black text-amber-700">
                Nepamatyta
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <InfoPill label="Gyventojas" value={residentName(resident)} />
            <InfoPill label="Kambarys" value={residentRoom(resident)} />
            <InfoPill label="Priskirta" value={assignedEmployee ? employeeName(assignedEmployee) : "Nepriskirta"} />
            <InfoPill label="Terminas" value={formatDateTime(task.due_date)} />
            <InfoPill label="Kartojimas" value={task.interval_days ? `Kas ${task.interval_days} d.` : "—"} />
            <InfoPill label="Pamatė" value={formatDateTime(task.viewed_at || null)} />
            <InfoPill label="Įvykdė" value={formatDateTime(task.completed_at || task.last_done_at || null)} />
          </div>
        </button>

        <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-2xl border border-slate-200/70 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
          >
            Redaguoti
          </button>
          {task.status !== "done" ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => onStatusChange("in_progress")}
                className="rounded-2xl border border-slate-200/70 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                Vykdoma
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => onStatusChange("done")}
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                Atlikta
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => onStatusChange("in_progress")}
              className="rounded-2xl border border-slate-200/70 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              Grąžinti
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-black text-slate-800">{value || "—"}</p>
    </div>
  )
}

function Modal({
  title,
  desc,
  children,
  onClose,
}: {
  title: string
  desc: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-4">
      <section className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
        <div className="sticky top-0 z-20 flex items-start justify-between gap-6 border-b border-slate-100 bg-white/95 p-6 backdrop-blur sm:p-7">
          <div>
            <h2 className="text-3xl font-black tracking-tight md:text-5xl">
              {title}
            </h2>
            <p className="mt-2 font-semibold text-slate-500">{desc}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 active:scale-[0.98]"
            aria-label="Uždaryti"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 sm:p-7">{children}</div>
      </section>
    </div>
  )
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="mb-2 block text-sm font-extrabold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {children}
    </label>
  )
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words font-black text-slate-900">{value || "—"}</p>
    </div>
  )
}
