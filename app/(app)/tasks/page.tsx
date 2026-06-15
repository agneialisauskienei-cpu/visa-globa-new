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
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react"

import MobileBottomNav from "@/components/mobile/MobileBottomNav"
import { getCurrentAccess, hasPermission, type CurrentAccess } from "@/lib/app-access"
import { getReadableError } from "@/lib/errors"
import { formatDate, formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { supabase } from "@/lib/supabase"
import { getChangedFields, logAudit } from "@/lib/audit"

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

type TaskAttachmentRow = {
  id: string
  task_id: string
  file_path: string
  file_name: string | null
  content_type: string | null
  size_bytes: number | null
  created_at: string | null
  signed_url?: string | null
}

type TaskAttachmentInsert = {
  organization_id: string
  task_id: string
  file_path: string
  file_name: string | null
  content_type: string | null
  size_bytes: number
  uploaded_by: string | null
  created_at: string
}

async function writeTaskAudit(input: {
  organizationId?: string | null
  recordId?: string | null
  action: "insert" | "update" | "delete"
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}) {
  try {
    await logAudit({
      organizationId: input.organizationId || null,
      tableName: "employee_tasks",
      recordId: input.recordId || null,
      action: input.action,
      changes: getChangedFields(input.before || {}, input.after || {}),
    })
  } catch (error) {
    console.warn("[tasks] audit skipped", error)
  }
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

type TaskImageDraft = {
  id: string
  file: File
  previewUrl: string
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
  { value: "low", label: "Žemas", className: "border-[#dbe6e0] bg-[#f8faf8] text-[#526174]" },
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

const TASK_IMAGE_BUCKET = "task-images"
const MAX_TASK_IMAGE_COUNT = 5
const MAX_TASK_IMAGE_SIZE_MB = 5
const ALLOWED_TASK_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90)
}


async function createSignedTaskAttachment(row: TaskAttachmentRow) {
  if (!row.file_path) return row

  const { data: signedData, error } = await supabase.storage
    .from(TASK_IMAGE_BUCKET)
    .createSignedUrl(row.file_path, 60 * 60)

  if (error) {
    console.warn("Could not create signed URL for task attachment:", error)
  }

  return {
    ...row,
    signed_url: signedData?.signedUrl || null,
  }
}

function revokeTaskImagePreview(image: TaskImageDraft) {
  URL.revokeObjectURL(image.previewUrl)
}


const TASK_PRESETS = [
  {
    label: "Lova",
    icon: "bed",
    title: "Sulūžo lova",
    type: "maintenance",
    subtype: "Baldai",
    priority: "high",
    description: "Kas neveikia? Kuriame kambaryje? Ar trukdo gyventojui?",
  },
  {
    label: "Elektra",
    icon: "electricity",
    title: "Reikia pakeisti lemputę",
    type: "maintenance",
    subtype: "Elektra",
    priority: "medium",
    description: "Kurioje vietoje? Ar patalpa naudojama gyventojų?",
  },
  {
    label: "Santechnika",
    icon: "plumbing",
    title: "Neveikia dušas",
    type: "maintenance",
    subtype: "Santechnika",
    priority: "high",
    description: "Kas neveikia? Ar yra vandens nuotėkis? Ar reikia skubaus remonto?",
  },
  {
    label: "Tvarkymas",
    icon: "cleaning",
    title: "Reikia sutvarkyti / išvalyti",
    type: "higiena",
    subtype: "Tvarkymas",
    priority: "medium",
    description: "Kuri vieta? Kas turi būti sutvarkyta?",
  },
  {
    label: "Maudymas",
    icon: "bath",
    title: "Maudymas",
    type: "higiena",
    subtype: "Asmens higiena",
    priority: "medium",
    interval_days: "7",
    description: "Nuolatinė užduotis: maudymas pagal individualų planą.",
  },
  {
    label: "Vaistai",
    icon: "medicine",
    title: "Medikamentų papildymas",
    type: "slauga",
    subtype: "Medikamentai",
    priority: "high",
    description: "Kokių medikamentų trūksta? Iki kada reikia papildyti?",
  },
]


function presetIcon(label: string) {
  switch (label) {
    case "Lova":
      return <Hammer className="h-4 w-4" />
    case "Elektra":
      return <Sparkles className="h-4 w-4" />
    case "Santechnika":
      return <Wrench className="h-4 w-4" />
    case "Tvarkymas":
      return <CheckCircle2 className="h-4 w-4" />
    case "Maudymas":
      return <Repeat className="h-4 w-4" />
    case "Vaistai":
      return <ClipboardList className="h-4 w-4" />
    default:
      return <ClipboardList className="h-4 w-4" />
  }
}

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

function relevantTaskTypesForStaff(staffType?: string | null) {
  const value = String(staffType || "").trim().toLowerCase()

  if (!value) return ["kita", "administration"]

  if (["maintenance", "ukis", "ūkis", "technician", "techninis"].includes(value)) {
    return ["maintenance"]
  }

  if (
    value.includes("slaug") ||
    value.includes("med") ||
    value.includes("nurse") ||
    value.includes("care")
  ) {
    return ["slauga", "higiena", "mobilumas", "maitinimas"]
  }

  if (value.includes("social")) {
    return ["socialinis", "mobilumas", "maitinimas"]
  }

  if (value.includes("admin") || value.includes("vadov")) {
    return ["administration", "kita"]
  }

  return ["kita", "administration"]
}

function isTaskRelevantForStaff(task: TaskRow, staffType?: string | null) {
  const relevant = relevantTaskTypesForStaff(staffType)
  return relevant.includes(task.type || "kita")
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
  const [taskAttachmentsMap, setTaskAttachmentsMap] = useState<Record<string, TaskAttachmentRow[]>>({})
  const [residentsMap, setResidentsMap] = useState<Record<string, ResidentRow>>({})
  const [allResidents, setAllResidents] = useState<ResidentRow[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [notificationsCount, setNotificationsCount] = useState(0)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [viewFilter, setViewFilter] = useState<"my" | "maintenance" | "all">("my")
  const [activePageTab, setActivePageTab] = useState<"overview" | "tasks" | "maintenance" | "recurring" | "late">("tasks")
  const [isMobile, setIsMobile] = useState(false)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null)
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null)
  const [form, setForm] = useState<NewTaskForm>(initialForm)
  const [editForm, setEditForm] = useState<NewTaskForm>(initialForm)
  const [taskImages, setTaskImages] = useState<TaskImageDraft[]>([])
  const [editTaskImages, setEditTaskImages] = useState<TaskImageDraft[]>([])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 1024)

    update()
    window.addEventListener("resize", update)

    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    const canUseMaintenanceView =
      canManageAllTasks(access) || isMaintenanceStaff(access?.staffType)

    if (activePageTab === "maintenance" && !canUseMaintenanceView) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivePageTab("tasks")
      setViewFilter("all")
      setTypeFilter("")
    }
  }, [activePageTab, access])

  useEffect(() => {
    return () => {
      taskImages.forEach(revokeTaskImagePreview)
      editTaskImages.forEach(revokeTaskImagePreview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const taskIds = typedTasks.map((task) => task.id)
      const attachmentsByTask: Record<string, TaskAttachmentRow[]> = {}

      if (taskIds.length > 0) {
        for (const taskId of taskIds) {
          attachmentsByTask[taskId] = await loadTaskAttachments(taskId)
        }
      }

      setTaskAttachmentsMap(attachmentsByTask)

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
          residents = (residentsData as unknown as ResidentRow[]) || []
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


  function handleTaskImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    const incoming = Array.from(files)
    const valid: TaskImageDraft[] = []
    const rejected: string[] = []

    for (const file of incoming) {
      if (!ALLOWED_TASK_IMAGE_TYPES.includes(file.type)) {
        rejected.push(`${file.name}: leidžiami tik JPG, PNG arba WEBP.`)
        continue
      }

      if (file.size > MAX_TASK_IMAGE_SIZE_MB * 1024 * 1024) {
        rejected.push(`${file.name}: failas didesnis nei ${MAX_TASK_IMAGE_SIZE_MB} MB.`)
        continue
      }

      valid.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }

    setTaskImages((previous) => {
      const availableSlots = Math.max(0, MAX_TASK_IMAGE_COUNT - previous.length)
      const accepted = valid.slice(0, availableSlots)
      const notAccepted = valid.slice(availableSlots)

      notAccepted.forEach(revokeTaskImagePreview)

      if (notAccepted.length > 0) {
        setMessage(`Galima pridėti iki ${MAX_TASK_IMAGE_COUNT} nuotraukų.`)
      }

      return [...previous, ...accepted]
    })

    if (rejected.length > 0) {
      setMessage(rejected.join(" "))
    }
  }

  function clearTaskImages() {
    setTaskImages((previous) => {
      previous.forEach(revokeTaskImagePreview)
      return []
    })
  }

  function removeTaskImage(imageId: string) {
    setTaskImages((previous) => {
      const image = previous.find((item) => item.id === imageId)
      if (image) revokeTaskImagePreview(image)

      return previous.filter((item) => item.id !== imageId)
    })
  }


  async function loadTaskAttachments(taskId: string) {
    if (!access?.organizationId) return []

    const collected: TaskAttachmentRow[] = []

    const { data: attachmentRows, error: attachmentError } = await supabase
      .from("task_attachments")
      .select("id, task_id, file_path, file_name, content_type, size_bytes, created_at")
      .eq("task_id", taskId)
      .eq("organization_id", access.organizationId)

    if (!attachmentError && attachmentRows?.length) {
      for (const row of attachmentRows as TaskAttachmentRow[]) {
        collected.push(await createSignedTaskAttachment(row))
      }
    } else if (attachmentError) {
      console.warn("Could not load task attachment metadata:", attachmentError)
    }

    const folder = `${access.organizationId}/${taskId}`
    const { data: storageFiles, error: listError } = await supabase.storage
      .from(TASK_IMAGE_BUCKET)
      .list(folder, {
        limit: 20,
        sortBy: { column: "created_at", order: "desc" },
      })

    if (!listError && storageFiles?.length) {
      const knownPaths = new Set(collected.map((item) => item.file_path))

      for (const file of storageFiles) {
        if (!file.name) continue

        const filePath = `${folder}/${file.name}`
        if (knownPaths.has(filePath)) continue

        const fallbackRow: TaskAttachmentRow = {
          id: file.id || filePath,
          task_id: taskId,
          file_path: filePath,
          file_name: file.name,
          content_type: file.metadata?.mimetype || file.metadata?.contentType || null,
          size_bytes: typeof file.metadata?.size === "number" ? file.metadata.size : null,
          created_at: file.created_at || null,
        }

        collected.push(await createSignedTaskAttachment(fallbackRow))
      }
    } else if (listError) {
      console.warn(`Could not list task image folder ${folder}:`, listError)
    }

    return collected
  }

  async function refreshTaskAttachments(taskId: string) {
    const attachments = await loadTaskAttachments(taskId)

    setTaskAttachmentsMap((previous) => ({
      ...previous,
      [taskId]: attachments,
    }))

    return attachments
  }

  function handleEditTaskImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    if (!editingTask) return

    const incoming = Array.from(files)
    const valid: TaskImageDraft[] = []
    const rejected: string[] = []
    const existingCount = taskAttachmentsMap[editingTask.id]?.length || 0

    for (const file of incoming) {
      if (!ALLOWED_TASK_IMAGE_TYPES.includes(file.type)) {
        rejected.push(`${file.name}: leidžiami tik JPG, PNG arba WEBP.`)
        continue
      }

      if (file.size > MAX_TASK_IMAGE_SIZE_MB * 1024 * 1024) {
        rejected.push(`${file.name}: failas didesnis nei ${MAX_TASK_IMAGE_SIZE_MB} MB.`)
        continue
      }

      valid.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }

    setEditTaskImages((previous) => {
      const availableSlots = Math.max(0, MAX_TASK_IMAGE_COUNT - existingCount - previous.length)
      const accepted = valid.slice(0, availableSlots)
      const notAccepted = valid.slice(availableSlots)

      notAccepted.forEach(revokeTaskImagePreview)

      if (notAccepted.length > 0) {
        setMessage(
          existingCount > 0
            ? `Galima turėti iki ${MAX_TASK_IMAGE_COUNT} nuotraukų. Ši užduotis jau turi ${existingCount}.`
            : `Galima pridėti iki ${MAX_TASK_IMAGE_COUNT} nuotraukų.`
        )
      }

      return [...previous, ...accepted]
    })

    if (rejected.length > 0) {
      setMessage(rejected.join(" "))
    }
  }

  function clearEditTaskImages() {
    setEditTaskImages((previous) => {
      previous.forEach(revokeTaskImagePreview)
      return []
    })
  }

  function removeEditTaskImage(imageId: string) {
    setEditTaskImages((previous) => {
      const image = previous.find((item) => item.id === imageId)
      if (image) revokeTaskImagePreview(image)

      return previous.filter((item) => item.id !== imageId)
    })
  }

  async function uploadTaskImages(taskId: string, images: TaskImageDraft[] = taskImages) {
    if (!access?.organizationId || !currentUserId || images.length === 0) return

    const uploadedRows: TaskAttachmentInsert[] = []
    const uploadedPaths: string[] = []

    for (const image of images) {
      const file = image.file
      const safeName = sanitizeFileName(file.name || "task-image")
      const filePath = `${access.organizationId}/${taskId}/${crypto.randomUUID()}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from(TASK_IMAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        if (uploadedPaths.length > 0) {
          const { error: cleanupError } = await supabase.storage
            .from(TASK_IMAGE_BUCKET)
            .remove(uploadedPaths)

          if (cleanupError) {
            console.warn("Task image upload failed and partial upload cleanup failed:", cleanupError)
          }
        }

        throw uploadError
      }

      uploadedPaths.push(filePath)

      uploadedRows.push({
        organization_id: access.organizationId,
        task_id: taskId,
        file_path: filePath,
        file_name: file.name,
        content_type: file.type,
        size_bytes: file.size,
        uploaded_by: currentUserId,
        created_at: new Date().toISOString(),
      })
    }

    if (uploadedRows.length > 0) {
      const { error: metaError } = await supabase.from("task_attachments").insert(uploadedRows)

      if (metaError) {
        if (uploadedPaths.length > 0) {
          const { error: cleanupError } = await supabase.storage
            .from(TASK_IMAGE_BUCKET)
            .remove(uploadedPaths)

          if (cleanupError) {
            console.warn("Task images metadata failed and uploaded files cleanup failed:", cleanupError)
          }
        }

        throw metaError
      }
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
      const taskId = crypto.randomUUID()

      const payload = {
        id: taskId,
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

      let uploadedTaskImages = false

      try {
        await uploadTaskImages(taskId)
        uploadedTaskImages = taskImages.length > 0
      } catch (uploadError) {
        console.warn("Task was created, but images were not uploaded:", uploadError)
        setMessage(
          `Užduotis sukurta, bet nuotraukų įkelti nepavyko: ${getReadableError(uploadError)}`
        )
      }

      await writeTaskAudit({
        organizationId: access.organizationId,
        recordId: taskId,
        action: "insert",
        after: {
          ...payload,
          attachments_count: uploadedTaskImages ? taskImages.length : 0,
          attachments_upload_failed: taskImages.length > 0 && !uploadedTaskImages,
        },
      })

      if (form.keep_open) {
        setForm((previous) => ({
          ...initialForm,
          keep_open: previous.keep_open,
        }))
        clearTaskImages()
        if (uploadedTaskImages) {
          setMessage("Užduotis sukurta su nuotraukomis. Forma palikta atidaryta kitai užduočiai.")
        } else if (taskImages.length === 0) {
          setMessage("Užduotis sukurta. Forma palikta atidaryta kitai užduočiai.")
        }
      } else {
        setShowCreateModal(false)
        setForm(initialForm)
        clearTaskImages()
        if (uploadedTaskImages) {
          setMessage("Užduotis sukurta su nuotraukomis.")
        } else if (taskImages.length === 0) {
          setMessage("Užduotis sukurta.")
        }
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
    clearEditTaskImages()
    void refreshTaskAttachments(task.id)
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
        .eq("organization_id", access?.organizationId || editingTask.organization_id || "")

      if (error) throw error

      if (editTaskImages.length > 0) {
        await uploadTaskImages(editingTask.id, editTaskImages)
        await refreshTaskAttachments(editingTask.id)
        clearEditTaskImages()
      }

      await writeTaskAudit({
        organizationId: editingTask.organization_id || access?.organizationId || null,
        recordId: editingTask.id,
        action: "update",
        before: {
          assigned_user_id: editingTask.assigned_user_id || null,
          resident_id: editingTask.resident_id || null,
          title: editingTask.title || null,
          description: editingTask.description || null,
          type: editingTask.type || null,
          subtype: editingTask.subtype || null,
          status: editingTask.status || null,
          priority: editingTask.priority || null,
          due_date: editingTask.due_date || null,
          interval_days: editingTask.interval_days || null,
        },
        after: {
          ...payload,
          attachments_added: editTaskImages.length,
        },
      })

      setEditingTask(null)
      setMessage(editTaskImages.length > 0 ? "Užduotis atnaujinta su nuotraukomis." : "Užduotis atnaujinta.")
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
        .eq("organization_id", access?.organizationId || task.organization_id || "")

      if (error) throw error

      if (
        status === "done" &&
        task.status !== "done" &&
        task.interval_days &&
        task.interval_days > 0 &&
        task.due_date &&
        access?.organizationId
      ) {
        const currentDue = new Date(task.due_date)

        if (!Number.isNaN(currentDue.getTime())) {
          const nextDue = new Date(currentDue)
          nextDue.setDate(nextDue.getDate() + task.interval_days)
          const nextDueIso = nextDue.toISOString()

          let recurringQuery = supabase
            .from("employee_tasks")
            .select("id")
            .eq("organization_id", access.organizationId)
            .eq("title", task.title)
            .eq("due_date", nextDueIso)
            .eq("interval_days", task.interval_days)
            .eq("type", task.type || "")

          recurringQuery = task.assigned_user_id
            ? recurringQuery.eq("assigned_user_id", task.assigned_user_id)
            : recurringQuery.is("assigned_user_id", null)

          recurringQuery = task.resident_id
            ? recurringQuery.eq("resident_id", task.resident_id)
            : recurringQuery.is("resident_id", null)

          const { data: existingRecurring, error: recurringCheckError } = await recurringQuery.limit(1)

          if (recurringCheckError) throw recurringCheckError

          if (!existingRecurring?.length) {
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
              due_date: nextDueIso,
              interval_days: task.interval_days,
              viewed_at: null,
              completed_at: null,
              last_done_at: null,
            })

            if (recurringError) throw recurringError
          }
        }
      }

      await writeTaskAudit({
        organizationId: task.organization_id || access?.organizationId || null,
        recordId: task.id,
        action: "update",
        before: {
          status: task.status || null,
          completed_at: task.completed_at || null,
          last_done_at: task.last_done_at || null,
        },
        after: payload,
      })

      await loadData()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSavingId(null)
    }
  }

  async function openTaskDetails(task: TaskRow) {
    setSelectedTask(task)
    void refreshTaskAttachments(task.id)

    if (task.viewed_at) return

    try {
      const viewedAt = new Date().toISOString()

      const { error } = await supabase
        .from("employee_tasks")
        .update({ viewed_at: viewedAt })
        .eq("id", task.id)
        .eq("organization_id", access?.organizationId || task.organization_id || "")

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

    if (!canManage) {
      rows = rows.filter((task) => {
        const ownTask =
          task.assigned_user_id === currentUserId ||
          task.created_by_user_id === currentUserId

        if (ownTask) return true

        return isTaskRelevantForStaff(task, access?.staffType)
      })
    }

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

  const visibleTasks = useMemo(() => {
    if (activePageTab === "maintenance") {
      return filteredTasks.filter((task) => task.type === "maintenance")
    }

    if (activePageTab === "recurring") {
      return filteredTasks.filter((task) => task.interval_days && task.interval_days > 0)
    }

    if (activePageTab === "late") {
      return filteredTasks.filter(isTaskLate)
    }

    return filteredTasks
  }, [activePageTab, filteredTasks])

  const statusNavTasks = filteredTasks
  const newStatusTasks = statusNavTasks.filter((task) => task.status === "new")
  const inProgressStatusTasks = statusNavTasks.filter((task) => task.status === "in_progress")
  const waitingPartsStatusTasks = statusNavTasks.filter((task) => task.status === "waiting_parts")
  const doneStatusTasks = statusNavTasks.filter((task) => task.status === "done")

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

  const visibleTaskTypes = useMemo(() => {
    if (canManageAllTasks(access)) return TASK_TYPES

    const allowed = new Set(relevantTaskTypesForStaff(access?.staffType))

    return TASK_TYPES.filter((type) => allowed.has(type.value))
  }, [access])
  const operationalTotal = Math.max(1, tasks.length)
  const completionRate = Math.round((completedTasks.length / operationalTotal) * 100)
  const viewedRate = Math.round((viewedTasks.length / operationalTotal) * 100)
  const overdueRate = Math.round((lateTasks.length / operationalTotal) * 100)
  const recurringRate = Math.round((recurringTasks.length / operationalTotal) * 100)

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8faf8] p-6 text-[#10251f]">
        <div className="rounded-[22px] border border-[#dbe6e0] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#dbe6e0] border-t-emerald-600" />
          <p className="mt-4 text-lg font-black text-[#486b5d]">Kraunama...</p>
          <p className="mt-1 text-sm font-semibold text-[#526174]">
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
      <main className="min-h-screen bg-[#f7faf8] pb-28 text-[#10251f]">
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
              className="h-14 w-full rounded-[22px] border border-[#dbe6e0] bg-white py-3 pl-12 pr-4 text-sm font-bold text-[#10251f] shadow-sm outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
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
              <p className="mt-4 text-lg font-black text-[#486b5d]">Užduočių nėra</p>
              <p className="mt-1 text-sm font-semibold text-[#526174]">
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
            onClose={() => { setShowCreateModal(false); clearTaskImages() }}
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
          onClose={() => { setEditingTask(null); clearEditTaskImages() }}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void updateTask()
            }}
          >
            <section className="rounded-[18px] border border-[#c9d8d0] bg-white p-4 shadow-[0_1px_3px_rgba(16,37,31,0.06)]">
              <div className="grid gap-4 md:grid-cols-2">
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

            {editingTask && taskAttachmentsMap[editingTask.id]?.length ? (
              <TaskAttachmentGallery
                title="Esamos nuotraukos"
                attachments={taskAttachmentsMap[editingTask.id]}
              />
            ) : null}

            <section className="rounded-[18px] border border-[#c9d8d0] bg-white p-4 shadow-[0_1px_3px_rgba(16,37,31,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Camera className="h-5 w-5 text-[#047857]" />
                    <h3 className="text-base font-black">Pridėti foto / screenshot</h3>
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#526174]">
                    Galima pridėti naujų nuotraukų ir redaguojant užduotį. Dokumentų čia nekelk.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-[#047857]">
                  {editTaskImages.length}/{MAX_TASK_IMAGE_COUNT}
                </span>
              </div>

              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  handleEditTaskImageFiles(event.dataTransfer.files)
                }}
                className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-dashed border-[#a7f3d0] bg-[#f8faf8] px-4 py-3 transition hover:bg-emerald-50/60"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white text-[#047857]">
                    <Camera className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-black text-[#10251f]">Pridėti nuotraukas</span>
                    <span className="block text-xs font-bold text-[#526174]">JPG, PNG, WEBP · iki {MAX_TASK_IMAGE_SIZE_MB} MB</span>
                  </span>
                </span>
                <Plus className="h-5 w-5 text-[#047857]" />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    handleEditTaskImageFiles(event.target.files)
                    event.currentTarget.value = ""
                  }}
                />
              </label>

              {editTaskImages.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {editTaskImages.map((image) => (
                    <div key={image.id} className="group overflow-hidden rounded-[14px] border border-[#dbe6e0] bg-white">
                      <a href={image.previewUrl} target="_blank" rel="noreferrer">
                        <img
                          src={image.previewUrl}
                          alt={image.file.name}
                          className="h-24 w-full object-cover transition group-hover:scale-[1.02]"
                        />
                      </a>
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-[#10251f]">{image.file.name}</p>
                          <p className="text-[11px] font-bold text-[#526174]">
                            {(image.file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEditTaskImage(image.id)}
                          className="rounded-[10px] border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-100"
                        >
                          Šalinti
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            {editForm.resident_id ? (
              <div className="rounded-[22px] border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold text-emerald-900">
                Pasirinktas gyventojas: {residentName(residentsMap[editForm.resident_id])} · kambarys: {residentRoom(residentsMap[editForm.resident_id])}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3 border-t border-[#dbe6e0] pt-5">
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
    <main className="min-h-screen bg-[#f3f6f4] p-4 pb-28 text-[#10251f] sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[30px] border border-emerald-900/10 bg-white shadow-[0_16px_45px_rgba(16,37,31,0.16)]">
          <div className="flex flex-col gap-6 bg-[#486b5d] p-7 text-white lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#e8f7ef] text-[#486b5d]">
                <ClipboardList className="h-7 w-7" />
              </div>

              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-100/80">
                  Užduotys
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                  {canManage ? "Visos užduotys" : "Mano užduotys"}
                </h1>
                <p className="mt-2 max-w-4xl text-base font-semibold text-white/85 sm:text-lg">
                  Darbuotojai mato jiems priskirtas ir jų sukurtas užduotis. Ūkis mato technines užduotis.
                </p>
              </div>
            </div>

            {canCreate ? (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-white px-5 py-3 font-black text-[#486b5d] shadow-sm transition hover:bg-white/90 active:scale-[0.98]"
              >
                <Plus className="h-5 w-5" />
                Sukurti užduotį
              </button>
            ) : null}
          </div>

          <div className="border-t border-emerald-900/10 bg-[#eef4f1] p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setActivePageTab("overview")
                  setViewFilter("all")
                  setStatusFilter("")
                  setTypeFilter("")
                }}
                className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
                  activePageTab === "overview"
                    ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
                    : "text-[#486b5d] hover:bg-white/70"
                }`}
              >
                <ClipboardList className="h-4 w-4" />
                Apžvalga
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePageTab("tasks")
                  setViewFilter("all")
                  setStatusFilter("")
                  setTypeFilter("")
                }}
                className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
                  activePageTab === "tasks"
                    ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
                    : "text-[#486b5d] hover:bg-white/70"
                }`}
              >
                <UserRound className="h-4 w-4" />
                Užduotys
                <span className="ml-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-black text-[#047857] ring-1 ring-[#c9d8d0]">
                  {filteredTasks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePageTab("tasks")
                  setViewFilter("all")
                  setStatusFilter("new")
                  setTypeFilter("")
                }}
                className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
                  activePageTab === "tasks" && statusFilter === "new"
                    ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
                    : "text-[#486b5d] hover:bg-white/70"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                Naujos
                <span className="ml-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-black text-[#047857] ring-1 ring-[#c9d8d0]">
                  {newStatusTasks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePageTab("tasks")
                  setViewFilter("all")
                  setStatusFilter("in_progress")
                  setTypeFilter("")
                }}
                className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
                  activePageTab === "tasks" && statusFilter === "in_progress"
                    ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
                    : "text-[#486b5d] hover:bg-white/70"
                }`}
              >
                <Timer className="h-4 w-4" />
                Vykdoma
                <span className="ml-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-black text-[#047857] ring-1 ring-[#c9d8d0]">
                  {inProgressStatusTasks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePageTab("tasks")
                  setViewFilter("all")
                  setStatusFilter("waiting_parts")
                  setTypeFilter("")
                }}
                className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
                  activePageTab === "tasks" && statusFilter === "waiting_parts"
                    ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
                    : "text-[#486b5d] hover:bg-white/70"
                }`}
              >
                <Clock className="h-4 w-4" />
                Laukia dalių
                <span className="ml-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-black text-[#047857] ring-1 ring-[#c9d8d0]">
                  {waitingPartsStatusTasks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePageTab("tasks")
                  setViewFilter("all")
                  setStatusFilter("done")
                  setTypeFilter("")
                }}
                className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
                  activePageTab === "tasks" && statusFilter === "done"
                    ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
                    : "text-[#486b5d] hover:bg-white/70"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                Atlikta
                <span className="ml-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-black text-[#047857] ring-1 ring-[#c9d8d0]">
                  {doneStatusTasks.length}
                </span>
              </button>

              {(canManage || isMaintenanceStaff(access?.staffType)) ? (
              <button
                type="button"
                onClick={() => {
                  setActivePageTab("maintenance")
                  setViewFilter("maintenance")
                  setStatusFilter("")
                  setTypeFilter("maintenance")
                }}
                className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
                  activePageTab === "maintenance"
                    ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
                    : "text-[#486b5d] hover:bg-white/70"
                }`}
              >
                <Wrench className="h-4 w-4" />
                Ūkis
                <span className="ml-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-black text-[#047857] ring-1 ring-[#c9d8d0]">
                  {maintenanceTasks.length}
                </span>
              </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setActivePageTab("recurring")
                  setViewFilter("all")
                  setStatusFilter("")
                  setTypeFilter("")
                }}
                className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
                  activePageTab === "recurring"
                    ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
                    : "text-[#486b5d] hover:bg-white/70"
                }`}
              >
                <Repeat className="h-4 w-4" />
                Periodinės
                <span className="ml-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-black text-[#047857] ring-1 ring-[#c9d8d0]">
                  {recurringTasks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePageTab("late")
                  setViewFilter("all")
                  setStatusFilter("")
                  setTypeFilter("")
                }}
                className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
                  activePageTab === "late"
                    ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
                    : "text-[#486b5d] hover:bg-white/70"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                Vėluoja
                <span className="ml-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-black text-rose-700 ring-1 ring-rose-100">
                  {lateTasks.length}
                </span>
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-[22px] border border-amber-100 bg-amber-50 p-5 font-extrabold text-amber-800">
            {message}
          </div>
        ) : null}

        {activePageTab === "overview" ? (
        <section className="rounded-[24px] border border-[#c9d8d0] bg-white p-6 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                Operacinė apžvalga
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                Užduočių būklė
              </h2>
              <p className="mt-1 font-semibold text-[#526174]">
                Svarbiausi signalai: šiandienos, skubios, vėluojančios ir periodinės užduotys.
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

        ) : null}

        {activePageTab !== "overview" ? (
        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <article className="rounded-[22px] border border-[#dbe6e0] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                  {activePageTab === "maintenance" ? "Ūkio darbai" : activePageTab === "recurring" ? "Periodinės" : activePageTab === "late" ? "Vėluoja" : "Sąrašas"}
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">
                  {activePageTab === "maintenance"
                    ? "Techninės užduotys"
                    : activePageTab === "recurring"
                      ? "Pasikartojančios užduotys"
                      : activePageTab === "late"
                        ? "Pavėluotos užduotys"
                        : "Užduočių kortelės"}
                </h2>
                <p className="mt-1 font-semibold text-[#526174]">
                  {activePageTab === "maintenance"
                    ? "Čia rodomi ūkiui ir techniniams gedimams aktualūs darbai."
                    : activePageTab === "recurring"
                      ? "Čia rodomos periodinės užduotys: maudymas, patikros, priežiūra."
                      : activePageTab === "late"
                        ? "Čia rodomos užduotys, kurių terminas jau praėjęs."
                        : "Paspausk užduotį, kad pamatytum daugiau informacijos."}
                </p>
              </div>

              <label className="relative block w-full md:w-80">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Ieškoti užduoties..."
                  className="w-full rounded-[14px] border border-[#dbe6e0] bg-[#f8faf8] py-3 pl-12 pr-4 font-bold text-[#10251f] outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
              <Select value={typeFilter} onChange={setTypeFilter}>
                <option value="">Visi tipai pagal pareigas</option>
                {visibleTaskTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>

              <button
                type="button"
                onClick={() => void loadData()}
                className="rounded-[14px] border border-[#dbe6e0] bg-[#f8faf8] px-5 py-3 font-black text-[#486b5d] transition hover:bg-slate-100 active:scale-[0.99]"
              >
                Atnaujinti
              </button>
            </div>

            {visibleTasks.length === 0 ? (
              <div className="mt-6 rounded-[22px] border border-dashed border-slate-300 bg-[#f8faf8] p-10 text-center">
                <ClipboardList className="mx-auto h-10 w-10 text-slate-400" />
                <p className="mt-4 text-lg font-black text-[#486b5d]">
                  Užduočių nėra
                </p>
                <p className="mt-1 font-semibold text-[#526174]">
                  Sukurk naują užduotį arba pakeisk filtrus.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-6 hidden overflow-hidden rounded-[22px] border border-slate-200 xl:block">
                  <table className="w-full border-collapse bg-white text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          Užduotis
                        </th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          Gyventojas
                        </th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          Terminas
                        </th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          Statusas
                        </th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          Prioritetas
                        </th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          Veiksmai
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTasks.map((task) => (
                        <TaskTableRow
                          key={task.id}
                          task={task}
                          resident={task.resident_id ? residentsMap[task.resident_id] : undefined}
                          assignedEmployee={task.assigned_user_id ? employeesMap[task.assigned_user_id] : undefined}
                          saving={savingId === task.id}
                          attachmentCount={taskAttachmentsMap[task.id]?.length || 0}
                          onOpen={() => void openTaskDetails(task)}
                          onEdit={() => openEditTask(task)}
                          onStatusChange={(status) => void updateTaskStatus(task, status)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 grid gap-4 xl:hidden">
                  {visibleTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      resident={task.resident_id ? residentsMap[task.resident_id] : undefined}
                      assignedEmployee={task.assigned_user_id ? employeesMap[task.assigned_user_id] : undefined}
                      saving={savingId === task.id}
                      attachmentCount={taskAttachmentsMap[task.id]?.length || 0}
                      onClick={() => void openTaskDetails(task)}
                      onEdit={() => openEditTask(task)}
                      onStatusChange={(status) => void updateTaskStatus(task, status)}
                    />
                  ))}
                </div>
              </>
            )}
          </article>

          <aside className="grid content-start gap-6">
            <article className="rounded-[22px] border border-[#dbe6e0] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-amber-700">
                    {activePageTab === "maintenance" ? "Ūkio šablonai" : "Šablonai"}
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Greitas sukūrimas
                  </h2>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-amber-50 text-amber-700">
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
                    className="group flex items-center justify-between rounded-[14px] border border-[#dbe6e0] bg-[#f8faf8] p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50 active:scale-[0.99]"
                  >
                    <span>
                      <b>{item.title}</b>
                      <br />
                      <small className="font-semibold text-[#526174]">
                        {item.hint}
                      </small>
                    </span>

                    <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
                  </button>
                ))}
              </div>
            </article>

          </aside>
        </section>
        ) : null}
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
            <section className="rounded-[18px] border border-emerald-100 bg-emerald-50/80 p-5">
              <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-emerald-700">
                <Sparkles className="h-4 w-4" />
                Greiti šablonai
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
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
                    className="inline-flex items-center gap-2 rounded-[14px] border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-[#047857] shadow-sm transition hover:bg-emerald-50 active:scale-[0.98]"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-emerald-50 text-[#047857]">
                      {presetIcon(preset.label)}
                    </span>
                    {preset.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[18px] border border-[#c9d8d0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.06)]">
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
                        className={`rounded-[14px] border px-4 py-3 text-sm font-black transition active:scale-[0.98] ${
                          priority.className
                        } ${form.priority === priority.value ? "ring-4 ring-emerald-100" : ""}`}
                      >
                        {priority.label}
                      </button>
                    ))}
                  </div>
                  {getSlaHint(form.priority, form.due_date) ? (
                    <p className="mt-2 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-800">
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
                    {visibleTaskTypes.map((type) => (
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

            <section className="rounded-[22px] border border-[#dbe6e0] bg-white p-5">
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
                    className={`rounded-[14px] border p-4 text-left transition active:scale-[0.98] ${
                      form.interval_days === option.value
                        ? "border-emerald-200 bg-emerald-50 ring-4 ring-emerald-50"
                        : "border-[#dbe6e0] bg-[#f8faf8] hover:bg-white"
                    }`}
                  >
                    <b className="block text-sm">{option.label}</b>
                    <span className="mt-1 block text-xs font-bold text-[#526174]">
                      {option.helper}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-[22px] border border-[#dbe6e0] bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-[#526174]" />
                  <h3 className="text-lg font-black">Kas matys?</h3>
                </div>
                <div className="space-y-2">
                  {getVisibilityText(form.type, form.assigned_user_id).map((viewer) => (
                    <div
                      key={viewer}
                      className="flex items-center gap-2 rounded-[14px] bg-[#f8faf8] px-4 py-3 text-sm font-black text-[#486b5d]"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {viewer}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[18px] border border-[#c9d8d0] bg-white p-4 shadow-[0_1px_3px_rgba(16,37,31,0.06)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Camera className="h-5 w-5 text-[#047857]" />
                      <h3 className="text-base font-black">Foto / screenshot</h3>
                    </div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[#526174]">
                      JPG, PNG, WEBP · iki {MAX_TASK_IMAGE_COUNT} vnt. · iki {MAX_TASK_IMAGE_SIZE_MB} MB. Dokumentų čia nekelk.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-[#047857]">
                    {taskImages.length}/{MAX_TASK_IMAGE_COUNT}
                  </span>
                </div>

                <label
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    handleTaskImageFiles(event.dataTransfer.files)
                  }}
                  className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-dashed border-[#a7f3d0] bg-[#f8faf8] px-4 py-3 transition hover:bg-emerald-50/60"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white text-[#047857]">
                      <Camera className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-black text-[#10251f]">Pridėti nuotraukas</span>
                      <span className="block text-xs font-bold text-[#526174]">Gedimas, inventorius ar screenshot</span>
                    </span>
                  </span>
                  <Plus className="h-5 w-5 text-[#047857]" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    capture="environment"
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      handleTaskImageFiles(event.target.files)
                      event.currentTarget.value = ""
                    }}
                  />
                </label>

                {taskImages.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {taskImages.map((image) => (
                      <div key={image.id} className="group overflow-hidden rounded-[14px] border border-[#dbe6e0] bg-white">
                        <a href={image.previewUrl} target="_blank" rel="noreferrer">
                          <img
                            src={image.previewUrl}
                            alt={image.file.name}
                            className="h-24 w-full object-cover transition group-hover:scale-[1.02]"
                          />
                        </a>
                        <div className="flex items-center justify-between gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-[#10251f]">{image.file.name}</p>
                            <p className="text-[11px] font-bold text-[#526174]">
                              {(image.file.size / 1024 / 1024).toFixed(1)} MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTaskImage(image.id)}
                            className="rounded-[10px] border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-100"
                          >
                            Šalinti
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
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
              <div className="mt-3 rounded-[14px] bg-[#f8faf8] p-4 text-sm font-semibold text-[#526174]">
                <b className="text-[#486b5d]">Padeda kokybiškam aprašymui:</b>
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

            <div className="sticky bottom-0 z-10 -mx-7 -mb-7 border-t border-[#dbe6e0] bg-white/95 p-5 backdrop-blur">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <label className="flex items-center gap-2 text-sm font-black text-[#526174]">
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
                    onClick={() => { setShowCreateModal(false); clearTaskImages() }}
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
                  <button type="submit" disabled={saving} className="btn-primary bg-[#047857] hover:bg-[#036747]">
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
          <div className="space-y-4">
            <section className="rounded-[20px] border border-[#c9d8d0] bg-white p-4 shadow-[0_1px_3px_rgba(16,37,31,0.06)]">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${getPriorityOption(selectedTask.priority).className}`}>
                  {getPriorityLabel(selectedTask.priority)}
                </span>
                <span className="rounded-full bg-[#eef4f1] px-3 py-1 text-xs font-black text-[#486b5d]">
                  {getTypeLabel(selectedTask.type)}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${
                  isTaskLate(selectedTask)
                    ? "bg-rose-50 text-rose-700"
                    : "bg-emerald-50 text-[#047857]"
                }`}>
                  {isTaskLate(selectedTask) ? "Vėluoja" : getTaskStatusLabel(selectedTask.status)}
                </span>
                {taskAttachmentsMap[selectedTask.id]?.length ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-black text-[#047857] ring-1 ring-emerald-100">
                    <Camera className="h-3.5 w-3.5" />
                    {taskAttachmentsMap[selectedTask.id].length} foto
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <CompactDetail
                  label="Gyventojas"
                  value={residentName(selectedTask.resident_id ? residentsMap[selectedTask.resident_id] : undefined)}
                />
                <CompactDetail
                  label="Kambarys"
                  value={residentRoom(selectedTask.resident_id ? residentsMap[selectedTask.resident_id] : undefined)}
                />
                <CompactDetail
                  label="Priskirta"
                  value={
                    selectedTask.assigned_user_id && employeesMap[selectedTask.assigned_user_id]
                      ? employeeName(employeesMap[selectedTask.assigned_user_id])
                      : "Nepriskirta"
                  }
                />
                <CompactDetail label="Terminas" value={formatDateTime(selectedTask.due_date)} />
                <CompactDetail label="Pamatė" value={formatDateTime(selectedTask.viewed_at || null)} />
                <CompactDetail label="Įvykdė" value={formatDateTime(selectedTask.completed_at || selectedTask.last_done_at || null)} />
                <CompactDetail label="Sukurta" value={formatDate(selectedTask.created_at)} />
                <CompactDetail label="Kartojimas" value={selectedTask.interval_days ? `Kas ${selectedTask.interval_days} d.` : "Nekartojama"} />
              </div>
            </section>

            {selectedTask.description ? (
              <section className="rounded-[20px] border border-[#c9d8d0] bg-white p-4 shadow-[0_1px_3px_rgba(16,37,31,0.06)]">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8ea0b5]">
                  Aprašymas
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-[#486b5d]">
                  {selectedTask.description}
                </p>
              </section>
            ) : null}

            {taskAttachmentsMap[selectedTask.id]?.length ? (
              <TaskAttachmentGallery
                title="Nuotraukos"
                attachments={taskAttachmentsMap[selectedTask.id]}
              />
            ) : (
              <section className="rounded-[20px] border border-dashed border-[#c9d8d0] bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-black text-[#526174]">
                  <Camera className="h-5 w-5 text-[#047857]" />
                  Nuotraukų nėra
                </div>
                <p className="mt-1 text-xs font-semibold text-[#526174]">
                  Nuotraukas galima pridėti kuriant užduotį. Esamoms užduotims redagavime kol kas rodomos jau įkeltos nuotraukos.
                </p>
              </section>
            )}

            <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap justify-end gap-3 border-t border-[#dbe6e0] bg-white/95 p-4 backdrop-blur sm:-mx-7 sm:-mb-7">
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
          onClose={() => { setEditingTask(null); clearEditTaskImages() }}
        >
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault()
              void updateTask()
            }}
          >
            <section className="rounded-[18px] border border-[#c9d8d0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.06)]">
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

            {editingTask && taskAttachmentsMap[editingTask.id]?.length ? (
              <TaskAttachmentGallery
                title="Esamos nuotraukos"
                attachments={taskAttachmentsMap[editingTask.id]}
              />
            ) : null}

            <section className="rounded-[18px] border border-[#c9d8d0] bg-white p-4 shadow-[0_1px_3px_rgba(16,37,31,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Camera className="h-5 w-5 text-[#047857]" />
                    <h3 className="text-base font-black">Pridėti foto / screenshot</h3>
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#526174]">
                    Galima pridėti naujų nuotraukų ir redaguojant užduotį. Dokumentų čia nekelk.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-[#047857]">
                  {editTaskImages.length}/{MAX_TASK_IMAGE_COUNT}
                </span>
              </div>

              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  handleEditTaskImageFiles(event.dataTransfer.files)
                }}
                className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-dashed border-[#a7f3d0] bg-[#f8faf8] px-4 py-3 transition hover:bg-emerald-50/60"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white text-[#047857]">
                    <Camera className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-black text-[#10251f]">Pridėti nuotraukas</span>
                    <span className="block text-xs font-bold text-[#526174]">JPG, PNG, WEBP · iki {MAX_TASK_IMAGE_SIZE_MB} MB</span>
                  </span>
                </span>
                <Plus className="h-5 w-5 text-[#047857]" />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    handleEditTaskImageFiles(event.target.files)
                    event.currentTarget.value = ""
                  }}
                />
              </label>

              {editTaskImages.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {editTaskImages.map((image) => (
                    <div key={image.id} className="group overflow-hidden rounded-[14px] border border-[#dbe6e0] bg-white">
                      <a href={image.previewUrl} target="_blank" rel="noreferrer">
                        <img
                          src={image.previewUrl}
                          alt={image.file.name}
                          className="h-24 w-full object-cover transition group-hover:scale-[1.02]"
                        />
                      </a>
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-[#10251f]">{image.file.name}</p>
                          <p className="text-[11px] font-bold text-[#526174]">
                            {(image.file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEditTaskImage(image.id)}
                          className="rounded-[10px] border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-100"
                        >
                          Šalinti
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            {editForm.resident_id ? (
              <div className="rounded-[22px] border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold text-emerald-900">
                Pasirinktas gyventojas: {residentName(residentsMap[editForm.resident_id])} · kambarys: {residentRoom(residentsMap[editForm.resident_id])}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3 border-t border-[#dbe6e0] pt-5">
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
          border-radius: 0.875rem;
          border: 1px solid #dbe6e0;
          background: white;
          padding: 0.9rem 1rem;
          font-weight: 800;
          color: #10251f;
          outline: none;
        }

        .input:focus {
          border-color: #047857;
          box-shadow: 0 0 0 4px rgba(4, 120, 87, 0.12);
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
          : "border border-[#dbe6e0] bg-white text-[#526174]"
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
            : "border-[#dbe6e0] bg-white"
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

          <h3 className="mt-3 text-lg font-black leading-tight text-[#10251f]">
            {task.title}
          </h3>

          <p className="mt-1 text-sm font-semibold text-[#526174]">
            {residentName(resident)} · kamb. {residentRoom(resident)} · {getTypeLabel(task.type)}
          </p>
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={done ? onProgress : onDone}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] transition active:scale-95 disabled:opacity-50 ${
            done ? "bg-white text-emerald-700" : "bg-emerald-50 text-emerald-700"
          }`}
          aria-label={done ? "Grąžinti" : "Atlikta"}
        >
          <CheckCircle2 className="h-5 w-5" />
        </button>
      </div>

      {task.description ? (
        <p className="mt-4 line-clamp-2 text-sm font-medium leading-relaxed text-[#526174]">
          {task.description}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 rounded-[20px] bg-[#f8faf8] p-3">
        <div className="flex items-center justify-between gap-3 text-xs font-black text-[#526174]">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {task.due_date ? formatDateTime(task.due_date) : "Be termino"}
          </span>
          <span>{getTaskStatusLabel(task.status)}</span>
        </div>
        <div className="text-xs font-semibold text-[#526174]">
          Priskirta: {assignedEmployee ? employeeName(assignedEmployee) : "Nepriskirta"}
        </div>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-3 h-11 w-full rounded-[14px] bg-slate-950 text-sm font-black text-white transition active:scale-[0.99]"
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
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-slate-950/50 p-4 backdrop-blur-sm md:p-6">
      <section className="max-h-[calc(100vh-48px)] w-full max-w-[980px] overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)]">
        <div className="flex items-start justify-between gap-5 bg-[#486b5d] px-6 py-5 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/80">
              Nauja užduotis
            </p>
            <h2 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">Sukurti greitai</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Uždaryti"
          >
            <X size={28} strokeWidth={2.1} />
          </button>
        </div>

        <form
          className="max-h-[calc(100vh-178px)] space-y-4 overflow-y-auto bg-[#f3f6f4] p-6"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#526174]">
              Pavadinimas
            </span>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, title: event.target.value }))
              }
              className="h-14 w-full rounded-[14px] border border-[#dbe6e0] bg-[#f8faf8] px-4 font-bold outline-none focus:border-emerald-300 focus:bg-white"
              placeholder="Pvz., sulūžo lova 203 kambaryje"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#526174]">
                Tipas
              </span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, type: event.target.value }))
                }
                className="h-14 w-full rounded-[14px] border border-[#dbe6e0] bg-[#f8faf8] px-3 text-sm font-bold outline-none"
              >
                {TASK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#526174]">
                Prioritetas
              </span>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, priority: event.target.value }))
                }
                className="h-14 w-full rounded-[14px] border border-[#dbe6e0] bg-[#f8faf8] px-3 text-sm font-bold outline-none"
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
            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#526174]">
              Gyventojas
            </span>
            <select
              value={form.resident_id}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, resident_id: event.target.value }))
              }
              className="h-14 w-full rounded-[14px] border border-[#dbe6e0] bg-[#f8faf8] px-4 font-bold outline-none"
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
            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#526174]">
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
              className="h-14 w-full rounded-[14px] border border-[#dbe6e0] bg-[#f8faf8] px-4 font-bold outline-none"
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
            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#526174]">
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
              className="min-h-28 w-full rounded-[14px] border border-[#dbe6e0] bg-[#f8faf8] p-4 font-bold outline-none focus:border-emerald-300 focus:bg-white"
              placeholder="Trumpai aprašyk problemą..."
            />
          </label>

          <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-[#dbe6e0] bg-white/95 p-5 backdrop-blur">
            <button
              type="submit"
              disabled={saving}
              className="h-14 w-full rounded-[14px] bg-[#047857] text-base font-black text-white disabled:opacity-60"
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
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-slate-950/50 p-4 backdrop-blur-sm md:p-6">
      <section className="max-h-[calc(100vh-48px)] w-full max-w-[980px] overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)]">
        <div className="flex items-start justify-between gap-5 bg-[#486b5d] px-6 py-5 text-white">
          <div>
            <MobilePriorityPill priority={task.priority} />
            <h2 className="mt-3 text-2xl font-black tracking-tight">{task.title}</h2>
            <p className="mt-1 text-sm font-semibold text-[#526174]">
              {residentName(resident)} · {getTypeLabel(task.type)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Uždaryti"
          >
            <X size={28} strokeWidth={2.1} />
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
          <div className="mt-4 rounded-[24px] border border-[#dbe6e0] bg-[#f8faf8] p-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
              Aprašymas
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[#486b5d]">
              {task.description}
            </p>
          </div>
        ) : null}

        <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 grid grid-cols-2 gap-3 border-t border-[#dbe6e0] bg-white/95 p-5 backdrop-blur">
          <button
            type="button"
            onClick={onEdit}
            className="col-span-2 h-13 rounded-[14px] border border-[#dbe6e0] bg-white px-4 py-3 font-black text-[#486b5d]"
          >
            Redaguoti užduotį
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onStatusChange("in_progress")}
            className="h-13 rounded-[14px] border border-[#dbe6e0] bg-white px-4 py-3 font-black text-[#486b5d] disabled:opacity-60"
          >
            Vykdoma
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onStatusChange("done")}
            className="h-13 rounded-[14px] bg-[#047857] px-4 py-3 font-black text-white disabled:opacity-60"
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
    <article className="rounded-[18px] border border-[#c9d8d0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.06)]">
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
          <p className="text-lg font-black text-[#10251f]">{title}</p>
          <p className="mt-2 text-sm font-bold text-white/80">{helper}</p>
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
    <div className={`rounded-[14px] border px-4 py-3 font-black ${toneClass}`}>
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
      className={`rounded-[22px] border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}
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
      className="rounded-[14px] border border-[#dbe6e0] bg-[#f8faf8] px-4 py-3 font-black text-[#486b5d] outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-50"
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
    slate: "bg-[#f8faf8] text-[#486b5d]",
  }[tone]

  const textClass = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    blue: "text-blue-700",
    rose: "text-rose-700",
    slate: "text-[#486b5d]",
  }[tone]

  return (
    <article className="rounded-[22px] border border-[#dbe6e0] bg-white p-6 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-[14px] ${toneClass}`}
        >
          {icon}
        </div>

        <div>
          <p className="font-extrabold text-[#526174]">{title}</p>
          <p className="mt-1 text-4xl font-black">
            {value}{" "}
            <span className={`text-sm font-bold ${textClass}`}>{meta}</span>
          </p>
        </div>
      </div>
    </article>
  )
}

function TaskTableRow({
  task,
  resident,
  assignedEmployee,
  saving,
  attachmentCount,
  onOpen,
  onEdit,
  onStatusChange,
}: {
  task: TaskRow
  resident?: ResidentRow
  assignedEmployee?: EmployeeOption
  saving: boolean
  attachmentCount?: number
  onOpen: () => void
  onEdit: () => void
  onStatusChange: (status: string) => void
}) {
  const late = isTaskLate(task)
  const done = task.status === "done"
  const description = task.description?.trim()

  return (
    <tr className={`border-t border-slate-100 ${late ? "bg-rose-50/25" : done ? "bg-emerald-50/20" : ""}`}>
      <td className="max-w-[360px] px-5 py-4 align-top">
        <button type="button" onClick={onOpen} className="block min-w-0 text-left">
          <span className="block break-words text-base font-black text-slate-950">
            {task.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs font-black text-[#526174]">
            <span>{getTypeLabel(task.type)}</span>
            {task.interval_days ? (
              <span className="rounded-full bg-slate-50 px-2 py-1">
                Kas {task.interval_days} d.
              </span>
            ) : null}
            {attachmentCount ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[#047857]">
                <Camera className="h-3.5 w-3.5" />
                {attachmentCount} foto
              </span>
            ) : null}
            {!task.viewed_at ? (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                Nepamatyta
              </span>
            ) : null}
          </span>
          {description ? (
            <span className="mt-2 line-clamp-2 block text-sm font-semibold leading-5 text-[#526174]">
              {description}
            </span>
          ) : null}
        </button>
      </td>
      <td className="px-5 py-4 align-top">
        <div className="font-black text-[#10251f]">{residentName(resident)}</div>
        <div className="mt-1 text-sm font-bold text-[#526174]">
          Kamb. {residentRoom(resident)}
        </div>
        <div className="mt-1 text-xs font-bold text-[#526174]">
          {assignedEmployee ? employeeName(assignedEmployee) : "Nepriskirta"}
        </div>
      </td>
      <td className="px-5 py-4 align-top text-sm font-black text-slate-700">
        {formatDateTime(task.due_date)}
      </td>
      <td className="px-5 py-4 align-top">
        <span
          className={`inline-flex rounded-full px-4 py-2 text-sm font-black ${
            late
              ? "bg-rose-50 text-rose-700"
              : done
                ? "bg-emerald-50 text-[#047857]"
                : "bg-[#eef4f1] text-[#486b5d]"
          }`}
        >
          {late ? "Vėluoja" : getTaskStatusLabel(task.status)}
        </span>
      </td>
      <td className="px-5 py-4 align-top">
        <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${getPriorityOption(task.priority).className}`}>
          {getPriorityLabel(task.priority)}
        </span>
      </td>
      <td className="px-5 py-4 align-top">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-[12px] border border-[#dbe6e0] bg-white px-3 py-2 text-sm font-black text-[#486b5d] transition hover:bg-slate-100"
          >
            Redaguoti
          </button>
          {task.status !== "done" ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => onStatusChange("done")}
              className="rounded-[12px] bg-slate-950 px-3 py-2 text-sm font-black text-white transition hover:bg-[#036747] disabled:opacity-60"
            >
              Atlikta
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => onStatusChange("in_progress")}
              className="rounded-[12px] border border-[#dbe6e0] bg-white px-3 py-2 text-sm font-black text-[#486b5d] transition hover:bg-slate-100 disabled:opacity-60"
            >
              Grąžinti
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function TaskCard({
  task,
  resident,
  assignedEmployee,
  saving,
  attachmentCount,
  onClick,
  onEdit,
  onStatusChange,
}: {
  task: TaskRow
  resident?: ResidentRow
  assignedEmployee?: EmployeeOption
  saving: boolean
  attachmentCount?: number
  onClick: () => void
  onEdit: () => void
  onStatusChange: (status: string) => void
}) {
  const late = isTaskLate(task)
  const done = task.status === "done"
  const description = task.description?.trim()

  return (
    <article
      className={`rounded-[22px] border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        done
          ? "border-emerald-100 border-l-[8px] border-l-[#047857]"
          : late
            ? "border-rose-100 border-l-[8px] border-l-rose-600"
            : "border-[#dbe6e0] border-l-[8px] border-l-[#486b5d]"
      }`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h3 className="truncate text-xl font-black tracking-[-0.02em] text-[#10251f]">
                {task.title}
              </h3>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-black text-[#486b5d]">
                <span>{getTypeLabel(task.type)}</span>
                <span className="text-[#8ea0b5]">•</span>
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${getPriorityOption(task.priority).className}`}>
                  {getPriorityLabel(task.priority)}
                </span>
                <span className="text-[#8ea0b5]">•</span>
                <span className={late ? "text-rose-700" : done ? "text-[#047857]" : "text-[#486b5d]"}>
                  {late ? "Vėluoja" : getTaskStatusLabel(task.status)}
                </span>
                {!task.viewed_at ? (
                  <>
                    <span className="text-[#8ea0b5]">•</span>
                    <span className="text-amber-700">Nepamatyta</span>
                  </>
                ) : null}
                {attachmentCount ? (
                  <>
                    <span className="text-[#8ea0b5]">•</span>
                    <span className="inline-flex items-center gap-1 text-[#047857]">
                      <Camera className="h-3.5 w-3.5" />
                      {attachmentCount} foto
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <span
              className={`w-fit rounded-full px-4 py-2 text-sm font-black ${
                late
                  ? "bg-rose-50 text-rose-700"
                  : done
                    ? "bg-emerald-50 text-[#047857]"
                    : "bg-[#eef4f1] text-[#486b5d]"
              }`}
            >
              {late ? "Vėluoja" : getTaskStatusLabel(task.status)}
            </span>
          </div>

          {description ? (
            <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-[#486b5d]">
              {description}
            </p>
          ) : null}

          <div className="mt-4 space-y-2 text-sm font-semibold text-[#10251f]">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <TaskInlineMeta label="Gyventojas" value={residentName(resident)} />
              <TaskInlineMeta label="Kambarys" value={residentRoom(resident)} />
              <TaskInlineMeta label="Priskirta" value={assignedEmployee ? employeeName(assignedEmployee) : "Nepriskirta"} />
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[#526174]">
              <TaskInlineMeta label="Terminas" value={formatDateTime(task.due_date)} />
              <TaskInlineMeta label="Kartojimas" value={task.interval_days ? `Kas ${task.interval_days} d.` : "—"} />
              <TaskInlineMeta label="Pamatė" value={formatDateTime(task.viewed_at || null)} />
              <TaskInlineMeta label="Įvykdė" value={formatDateTime(task.completed_at || task.last_done_at || null)} />
            </div>
          </div>
        </button>

        <div className="flex shrink-0 flex-wrap gap-2 xl:w-40 xl:flex-col xl:pt-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-[14px] border border-[#dbe6e0] bg-white px-4 py-2 text-sm font-black text-[#486b5d] transition hover:bg-slate-100"
          >
            Redaguoti
          </button>
          {task.status !== "done" ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => onStatusChange("in_progress")}
                className="rounded-[14px] border border-[#dbe6e0] bg-white px-4 py-2 text-sm font-black text-[#486b5d] transition hover:bg-slate-100 disabled:opacity-60"
              >
                Vykdoma
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => onStatusChange("done")}
                className="rounded-[14px] bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-[#036747] disabled:opacity-60"
              >
                Atlikta
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => onStatusChange("in_progress")}
              className="rounded-[14px] border border-[#dbe6e0] bg-white px-4 py-2 text-sm font-black text-[#486b5d] transition hover:bg-slate-100 disabled:opacity-60"
            >
              Grąžinti
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function TaskInlineMeta({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0">
      <span className="mr-1 text-[11px] font-black uppercase tracking-[0.1em] text-[#8ea0b5]">
        {label}:
      </span>
      <span className="font-black text-[#10251f]">{value || "—"}</span>
    </span>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-white px-4 py-3">
      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-black text-slate-800">{value || "—"}</p>
    </div>
  )
}


function CompactDetail({
  label,
  value,
  wide = false,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={`rounded-[16px] border border-[#dbe6e0] bg-[#f8faf8] px-4 py-3 ${wide ? "md:col-span-2" : ""}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8ea0b5]">{label}</p>
      <p className="mt-1 break-words text-sm font-black leading-5 text-[#10251f]">{value || "—"}</p>
    </div>
  )
}

function TaskAttachmentGallery({
  title,
  attachments,
}: {
  title: string
  attachments: TaskAttachmentRow[]
}) {
  return (
    <div className="rounded-[18px] border border-[#c9d8d0] bg-white p-4 shadow-[0_1px_3px_rgba(16,37,31,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-[#047857]" />
          <h3 className="text-lg font-black text-[#10251f]">{title}</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-[#047857]">
          {attachments.length}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {attachments.map((attachment) => (
          <a
            key={attachment.id}
            href={attachment.signed_url || undefined}
            target={attachment.signed_url ? "_blank" : undefined}
            rel={attachment.signed_url ? "noreferrer" : undefined}
            className="group overflow-hidden rounded-[16px] border border-[#dbe6e0] bg-[#f8faf8] transition hover:border-emerald-200 hover:bg-emerald-50/50"
          >
            {attachment.signed_url ? (
              <img
                src={attachment.signed_url}
                alt={attachment.file_name || "Užduoties nuotrauka"}
                className="h-32 w-full object-cover"
              />
            ) : (
              <div className="flex h-32 items-center justify-center text-sm font-black text-[#526174]">
                Nuotraukos peržiūra nepasiekiama
              </div>
            )}

            <div className="p-3">
              <p className="truncate text-xs font-black text-[#10251f]">
                {attachment.file_name || "Nuotrauka"}
              </p>
              <p className="mt-1 text-[11px] font-bold text-[#526174]">
                {attachment.size_bytes ? `${(attachment.size_bytes / 1024 / 1024).toFixed(1)} MB` : "Failas"}
              </p>
            </div>
          </a>
        ))}
      </div>
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
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-slate-950/50 p-4 backdrop-blur-sm md:p-6">
      <section className="max-h-[calc(100vh-48px)] w-full max-w-[1180px] overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)]">
        <div className="flex items-start justify-between gap-5 bg-[#486b5d] px-6 py-5 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/80">
              Užduotys
            </p>
            <h2 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white md:text-4xl">
              {title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-white/80">{desc}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition hover:bg-white/20 active:scale-[0.98]"
            aria-label="Uždaryti"
          >
            <X size={28} strokeWidth={2.1} />
          </button>
        </div>

        <div className="max-h-[calc(100vh-178px)] overflow-y-auto bg-[#f3f6f4] p-6 sm:p-7">{children}</div>
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
      <span className="mb-2 block text-sm font-extrabold uppercase tracking-widest text-[#526174]">
        {label}
      </span>
      {children}
    </label>
  )
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-white p-4">
      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words font-black text-[#10251f]">{value || "—"}</p>
    </div>
  )
}
