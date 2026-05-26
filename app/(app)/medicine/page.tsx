"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Check,
  ClipboardList,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  HeartPulse,
  Info,
  Lock,
  PackageMinus,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Unlock,
  UserRound,
  UserCheck,
  X,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/current-organization"

type Resident = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  resident_code: string | null
  current_room_id: string | null
  room_number?: string | null
  status?: string | null
}

type Room = {
  id: string
  name: string | null
}

type Medication = {
  id: string
  organization_id: string
  resident_id: string
  medication_name: string
  dose: string
  scheduled_time: string
  route: string | null
  instructions: string | null
  is_fractional: boolean
  is_external: boolean
  is_prn: boolean
  status: string
  prescription_source: string | null
  prescribed_by: string | null
  prescription_date: string | null
  requires_double_check: boolean | null
  inventory_item_id: string | null
  inventory_units_per_dose: number | null
  safety_notes: string | null
  created_at: string
}

type AdminLog = {
  id: string
  organization_id: string
  resident_id: string
  medication_id: string | null
  scheduled_for: string | null
  status: string
  prepared_by: string | null
  prepared_at: string | null
  given_by: string | null
  given_at: string | null
  created_at: string
}

type PrnLog = {
  id: string
  organization_id: string
  resident_id: string
  medication_id: string | null
  reason: string
  result: string | null
  administered_by: string | null
  administered_at: string
  created_at: string
}

type Vital = {
  id: string
  organization_id: string
  resident_id: string
  measured_at: string
  bp_sys: number | null
  bp_dia: number | null
  pulse: number | null
  sugar: number | null
  temperature: number | null
  weight: number | null
  notes: string | null
  measured_by: string | null
  created_at: string
}

type InventoryItem = {
  id: string
  organization_id?: string | null
  name: string | null
  unit?: string | null
  quantity?: number | null
  category?: string | null
  subcategory?: string | null
  size?: string | null
  sku?: string | null
  min_quantity?: number | null
  is_active?: boolean | null
}

type EmployeeOption = {
  user_id: string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  role?: string | null
  position?: string | null
}

type ConfirmChecks = {
  responsibility_acknowledged: boolean
}

type MedicineTab = "medications" | "prn" | "events" | "history" | "unfinished"
type WorkflowFilter = "all" | "prescribed" | "preparation" | "checked" | "handover" | "given"

const emptyChecks: ConfirmChecks = {
  responsibility_acknowledged: false,
}

const norm = {
  bpSysMax: 150,
  bpDiaMax: 90,
  pulseMin: 50,
  pulseMax: 100,
  sugarMax: 7.8,
  tempMax: 37.5,
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("lt-LT")
}

function toTime(value?: string | null) {
  return value ? String(value).slice(0, 5) : "—"
}


function historyCellValue(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "" ? "—" : String(value)
}

function medicationStatusLabel(status?: string | null) {
  const value = String(status || "").trim().toLowerCase()

  switch (value) {
    case "prepared":
      return "Paruošta"
    case "given":
      return "Suduota"
    case "pending":
      return "Laukia"
    case "completed":
      return "Atlikta"
    case "missed":
      return "Praleista"
    case "late":
      return "Pavėluota"
    case "refused":
      return "Atsisakyta"
    case "active":
      return "Aktyvus"
    case "inactive":
      return "Neaktyvus"
    default:
      return status || "—"
  }
}

function getCurrentShiftName() {
  const hour = new Date().getHours()

  if (hour >= 6 && hour < 14) return "Rytinė pamaina"
  if (hour >= 14 && hour < 22) return "Dieninė pamaina"
  return "Naktinė pamaina"
}

function scheduledDateForToday(time?: string | null) {
  const [hourRaw, minuteRaw] = toTime(time).split(":").map(Number)
  const date = new Date()
  date.setHours(Number.isFinite(hourRaw) ? hourRaw : 0, Number.isFinite(minuteRaw) ? minuteRaw : 0, 0, 0)
  return date
}

function isMedicationLate(medication: Medication, minutes = 30) {
  const scheduled = scheduledDateForToday(medication.scheduled_time)
  return new Date().getTime() - scheduled.getTime() > minutes * 60 * 1000
}

function statusToneStyle(status: "given" | "prepared" | "late" | "pending") {
  if (status === "given") return styles.statusGreen
  if (status === "prepared") return styles.statusAmber
  if (status === "late") return styles.statusRed
  return styles.statusNeutral
}

function residentName(resident?: Resident | null, roomsById?: Record<string, string>) {
  if (!resident) return "Gyventojas"
  const full = String(resident.full_name || "").trim()
  const first = String(resident.first_name || "").trim()
  const last = String(resident.last_name || "").trim()
  const combined = [first, last].filter(Boolean).join(" ").trim()
  const code = resident.resident_code ? ` · ${resident.resident_code}` : ""
  const room = resident.current_room_id && roomsById?.[resident.current_room_id] ? ` · ${roomsById[resident.current_room_id]}` : ""
  return `${full || combined || "Gyventojas"}${code}${room}`
}

function residentShortName(resident?: Resident | null) {
  if (!resident) return "Gyventojas"
  const full = String(resident.full_name || "").trim()
  const first = String(resident.first_name || "").trim()
  const last = String(resident.last_name || "").trim()
  return full || [first, last].filter(Boolean).join(" ").trim() || "Gyventojas"
}

function residentInitials(resident?: Resident | null) {
  const name = residentShortName(resident)
  const parts = name.split(" ").filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}. ${parts[1][0]}.`
  return parts[0]?.slice(0, 2).toUpperCase() || "G"
}

function latestVitals(vitals: Vital[]) {
  return [...vitals].sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime())[0] || null
}

function alertList(v: Vital | null) {
  const alerts: string[] = []
  if (!v) return alerts
  if ((v.bp_sys || 0) > norm.bpSysMax || (v.bp_dia || 0) > norm.bpDiaMax) alerts.push("Kraujospūdis virš normos")
  if ((v.pulse || 0) < norm.pulseMin || (v.pulse || 0) > norm.pulseMax) alerts.push("Pulsas už normos ribų")
  if ((v.sugar || 0) > norm.sugarMax) alerts.push("Cukraus kiekis virš normos")
  if ((v.temperature || 0) > norm.tempMax) alerts.push("Temperatūra virš normos")
  return alerts
}

function bmi(weight?: number | null, heightM = 1.68) {
  if (!weight) return "—"
  return Number((weight / (heightM * heightM)).toFixed(1))
}

function inventoryName(item?: InventoryItem | null) {
  if (!item) return "—"
  return item.name || item.id
}

function inventoryQuantity(item?: InventoryItem | null) {
  if (!item) return null
  return item.quantity ?? null
}

function medicationStockStatus(item?: InventoryItem | null, unitsPerDose = 1) {
  const quantity = inventoryQuantity(item)
  const minQuantity = item?.min_quantity ?? 5

  if (quantity === null) {
    return {
      level: "unknown" as const,
      label: "Likutis nežinomas",
      tone: "neutral" as const,
      blocksAction: false,
    }
  }

  if (quantity <= 0 || quantity < unitsPerDose) {
    return {
      level: "empty" as const,
      label: "Likutis baigėsi",
      tone: "danger" as const,
      blocksAction: true,
    }
  }

  if (quantity <= Math.max(2, unitsPerDose)) {
    return {
      level: "critical" as const,
      label: "Likutis kritinis",
      tone: "danger" as const,
      blocksAction: false,
    }
  }

  if (quantity <= Math.max(5, minQuantity)) {
    return {
      level: "low" as const,
      label: "Vaistas artėja prie pabaigos",
      tone: "warning" as const,
      blocksAction: false,
    }
  }

  return {
    level: "ok" as const,
    label: "Likutis pakankamas",
    tone: "ok" as const,
    blocksAction: false,
  }
}

function looksLikeMedicationInventoryItem(item: InventoryItem) {
  const text = [item.name, item.category, item.subcategory, item.sku].filter(Boolean).join(" ").toLowerCase()

  const medicineWords = [
    "vaist",
    "medic",
    "medik",
    "tablet",
    "kapsul",
    "ampul",
    "sirup",
    "laš",
    "injek",
    "tepal",
    "krem",
    "gel",
    "pleistr",
  ]

  return medicineWords.some((word) => text.includes(word))
}

function employeeName(employee?: EmployeeOption | null) {
  if (!employee) return "Darbuotojas"
  const full = String(employee.full_name || "").trim()
  const combined = [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim()
  const base = full || combined || employee.email || "Darbuotojas"
  return employee.position ? `${base} · ${employee.position}` : base
}


function normalizeMedicineResident(row: any): Resident {
  const source = row?.residents || row?.resident || row || {}

  return {
    id: String(source.id || row?.resident_id || ""),
    full_name: source.full_name || null,
    first_name: source.first_name || null,
    last_name: source.last_name || null,
    resident_code: source.resident_code || null,
    current_room_id: source.current_room_id || null,
    room_number: source.room_number || null,
    status: source.status || source.current_status || null,
  }
}

function dedupeMedicineResidents(rows: Resident[]) {
  const map = new Map<string, Resident>()

  for (const row of rows) {
    if (!row.id) continue
    if (!map.has(row.id)) map.set(row.id, row)
  }

  return Array.from(map.values())
}

async function resolveMedicineOrganizationId(userId?: string | null) {
  const currentOrgId = await getCurrentOrganizationId()
  if (currentOrgId) return currentOrgId

  if (!userId) return null

  const memberResult = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (memberResult.error) {
    console.warn("[medicine] organization_members fallback:", memberResult.error.message)
    return null
  }

  return memberResult.data?.organization_id || null
}

async function loadResidentsByIds(ids: string[]) {
  const cleanIds = Array.from(new Set(ids.filter(Boolean)))
  if (cleanIds.length === 0) return [] as Resident[]

  const result = await supabase
    .from("residents")
    .select("id, first_name, last_name, full_name, resident_code, current_room_id, organization_id")
    .in("id", cleanIds)

  if (result.error) {
    console.warn("[medicine] residents by ids:", result.error.message)
    return [] as Resident[]
  }

  return dedupeMedicineResidents((result.data || []).map(normalizeMedicineResident))
}

async function loadMedicineResidents(orgId: string) {
  // Svarbu: nebeužklausinėjame resident_assignments pagal spėjamus stulpelius
  // assigned_user_id / employee_id / staff_user_id ir pan., nes tavo DB jų neturi.
  // Pirma bandome saugiai krauti gyventojus iš residents pagal organization_id,
  // o jei toks stulpelis neegzistuoja arba RLS grąžina klaidą – naudojame kitus fallback'us.

  const directResidentsQuery = supabase
    .from("residents")
    .select("id, first_name, last_name, full_name, resident_code, current_room_id, organization_id")
    .eq("organization_id", orgId)
    .order("full_name", { ascending: true })
    .limit(500)

  const directResidents = await directResidentsQuery

  console.log("[medicine] ORG:", orgId)
  console.log("[medicine] RESIDENTS:", directResidents.data)
  console.log("[medicine] RESIDENTS_ERROR:", directResidents.error)

  if (!directResidents.error && directResidents.data?.length) {
    return dedupeMedicineResidents((directResidents.data || []).map(normalizeMedicineResident))
  }

  if (directResidents.error) {
    console.warn("[medicine] residents.organization_id fallback:", directResidents.error.message)
  }

  const medicineSources = await Promise.all([
    supabase.from("resident_medications").select("resident_id").eq("organization_id", orgId).limit(500),
    supabase.from("resident_vitals").select("resident_id").eq("organization_id", orgId).limit(500),
    supabase.from("medication_administration_logs").select("resident_id").eq("organization_id", orgId).limit(500),
    supabase.from("medication_prn_logs").select("resident_id").eq("organization_id", orgId).limit(500),
  ])

  const medicineResidentIds = Array.from(
    new Set(
      medicineSources.flatMap((result) => {
        if (result.error) {
          console.warn("[medicine] resident source:", result.error.message)
          return []
        }

        return ((result.data || []) as Array<{ resident_id?: string | null }>)
          .map((row) => row.resident_id)
          .filter((id): id is string => Boolean(id))
      })
    )
  )

  const residentsByMedicine = await loadResidentsByIds(medicineResidentIds)
  if (residentsByMedicine.length > 0) return residentsByMedicine

  const stayResidents = await supabase
    .from("resident_stays")
    .select("resident_id")
    .eq("organization_id", orgId)
    .is("end_date", null)
    .limit(500)

  if (!stayResidents.error && stayResidents.data?.length) {
    const ids = (stayResidents.data || [])
      .map((row: any) => row.resident_id)
      .filter((id: string | null | undefined): id is string => Boolean(id))
    const rows = await loadResidentsByIds(ids)
    if (rows.length > 0) return rows
  }

  if (stayResidents.error) {
    console.warn("[medicine] resident_stays fallback:", stayResidents.error.message)
  }

  const allResidents = await supabase
    .from("residents")
    .select("id, first_name, last_name, full_name, resident_code, current_room_id, organization_id")
    .limit(500)

  if (!allResidents.error && allResidents.data?.length) {
    return dedupeMedicineResidents((allResidents.data || []).map(normalizeMedicineResident))
  }

  if (allResidents.error) {
    console.warn("[medicine] residents final fallback:", allResidents.error.message)
  }

  return [] as Resident[]
}


export default function MedicinePage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [residents, setResidents] = useState<Resident[]>([])
  const [roomsById, setRoomsById] = useState<Record<string, string>>({})
  const [medications, setMedications] = useState<Medication[]>([])
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([])
  const [prnLogs, setPrnLogs] = useState<PrnLog[]>([])
  const [vitals, setVitals] = useState<Vital[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])

  const [selectedId, setSelectedId] = useState("")
  const [query, setQuery] = useState("")
  const [unlocked, setUnlocked] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [activeMedicineTab, setActiveMedicineTab] = useState<MedicineTab>("medications")
  const [dispenserView, setDispenserView] = useState<"today" | "tomorrow" | "week">("today")
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>("all")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const [showAddMedicationModal, setShowAddMedicationModal] = useState(false)
  const [showVitalsModal, setShowVitalsModal] = useState(false)
  const [showPrepareModal, setShowPrepareModal] = useState(false)
  const [prepareMedication, setPrepareMedication] = useState<Medication | null>(null)
  const [prepareMedicationList, setPrepareMedicationList] = useState<Medication[]>([])
  const [prepareAcknowledged, setPrepareAcknowledged] = useState(false)
  const [prepareSecondCheckerId, setPrepareSecondCheckerId] = useState("")
  const [prepareChecks, setPrepareChecks] = useState({
    resident_checked: false,
    medication_checked: false,
    dose_checked: false,
    time_checked: false,
    prescription_checked: false,
  })
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showProblemModal, setShowProblemModal] = useState(false)
  const [problemMedicationId, setProblemMedicationId] = useState("")
  const [problemNote, setProblemNote] = useState("")
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyType, setHistoryType] = useState<"all" | "medications" | "vitals" | "prn">("all")
  const [historyFrom, setHistoryFrom] = useState(todayKey())
  const [historyTo, setHistoryTo] = useState(todayKey())
  const [showCompletedMeds, setShowCompletedMeds] = useState(false)
  const [showAdvancedMedicationSettings, setShowAdvancedMedicationSettings] = useState(false)

  const [confirmMedication, setConfirmMedication] = useState<Medication | null>(null)
  const [confirmChecks, setConfirmChecks] = useState<ConfirmChecks>(emptyChecks)
  const [confirmNotes, setConfirmNotes] = useState("")
  const [secondCheckerId, setSecondCheckerId] = useState("")

  const [inventorySearch, setInventorySearch] = useState("")
  const [taskAssigneeId, setTaskAssigneeId] = useState("")
  const [taskNote, setTaskNote] = useState("")

  const [medForm, setMedForm] = useState({
    medication_name: "",
    dose: "",
    scheduled_time: "08:00",
    schedule_frequency: "daily",
    schedule_start_date: todayKey(),
    schedule_end_date: "",
    route: "",
    instructions: "",
    prescription_source: "",
    prescribed_by: "",
    prescription_date: "",
    inventory_item_id: "",
    inventory_units_per_dose: "1",
    is_fractional: false,
    is_external: false,
    is_prn: false,
    requires_double_check: false,
    safety_notes: "",
  })

  const [prnReason, setPrnReason] = useState("")

  const [newVitals, setNewVitals] = useState({
    bp_sys: 120,
    bp_dia: 80,
    pulse: 72,
    sugar: 5.8,
    temperature: 36.6,
    weight: 70,
    notes: "",
  })

  useEffect(() => {
    void loadAll()
  }, [])

  async function loadAll() {
    try {
      setLoading(true)
      setMessage("")

      const {
        data: { user },
      } = await supabase.auth.getUser()

      setCurrentUserId(user?.id || null)

      const orgId = await resolveMedicineOrganizationId(user?.id || null)
      setOrganizationId(orgId)

      if (!orgId) {
        setMessage("Nepavyko nustatyti organizacijos. Patikrinkite, ar naudotojas turi aktyvią narystę organization_members lentelėje.")
        return
      }

      const [residentList, roomsResult, medsResult, logsResult, prnResult, vitalsResult] = await Promise.all([
        loadMedicineResidents(orgId),

        supabase.from("rooms").select("id, name").eq("organization_id", orgId),

        supabase
          .from("resident_medications")
          .select("*")
          .eq("organization_id", orgId)
          .order("scheduled_time", { ascending: true }),

        supabase
          .from("medication_administration_logs")
          .select("*")
          .eq("organization_id", orgId)
          .gte("created_at", `${todayKey()}T00:00:00.000Z`)
          .order("created_at", { ascending: false }),

        supabase
          .from("medication_prn_logs")
          .select("*")
          .eq("organization_id", orgId)
          .order("administered_at", { ascending: false })
          .limit(100),

        supabase
          .from("resident_vitals")
          .select("*")
          .eq("organization_id", orgId)
          .order("measured_at", { ascending: false })
          .limit(500),
      ])

      if (roomsResult.error) throw roomsResult.error
      if (medsResult.error) throw medsResult.error
      if (logsResult.error) throw logsResult.error
      if (prnResult.error) throw prnResult.error
      if (vitalsResult.error) throw vitalsResult.error

      setResidents(residentList)
      setRoomsById(Object.fromEntries(((roomsResult.data || []) as Room[]).map((room) => [room.id, room.name || "Kambarys"])))
      setMedications((medsResult.data || []) as Medication[])
      setAdminLogs((logsResult.data || []) as AdminLog[])
      setPrnLogs((prnResult.data || []) as PrnLog[])
      setVitals((vitalsResult.data || []) as Vital[])

      if (!selectedId && residentList.length > 0) setSelectedId(residentList[0].id)

      await loadInventoryItems(orgId)
      await loadEmployeeOptions(orgId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko įkelti medicinos modulio.")
    } finally {
      setLoading(false)
    }
  }

  async function loadInventoryItems(orgId: string) {
    const result = await supabase
      .from("inventory_items")
      .select("id, organization_id, name, unit, quantity, category, subcategory, size, sku, min_quantity, is_active")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(1000)

    if (result.error) {
      setInventoryItems([])
      return
    }

    setInventoryItems((result.data || []) as InventoryItem[])
  }

  async function loadEmployeeOptions(orgId: string) {
    const result = await supabase
      .from("organization_members")
      .select("user_id, role, legacy_role, position, is_active")
      .eq("organization_id", orgId)
      .eq("is_active", true)

    if (result.error) {
      setEmployees([])
      return
    }

    const memberRows = (result.data || []) as Array<{
      user_id: string
      role?: string | null
      legacy_role?: string | null
      position?: string | null
    }>

    const ids = memberRows.map((m) => m.user_id).filter(Boolean)

    if (ids.length === 0) {
      setEmployees([])
      return
    }

    const profiles = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, full_name")
      .in("id", ids)

    if (profiles.error) {
      setEmployees(
        memberRows.map((member) => ({
          user_id: member.user_id,
          role: member.role || member.legacy_role || null,
          position: member.position || null,
        }))
      )
      return
    }

    const profileRows = (profiles.data || []) as Array<{
      id: string
      email?: string | null
      first_name?: string | null
      last_name?: string | null
      full_name?: string | null
    }>
    const profileMap = new Map(profileRows.map((profile) => [profile.id, profile]))

    setEmployees(
      memberRows.map((member) => {
        const profile = profileMap.get(member.user_id) || {}
        return {
          user_id: member.user_id,
          email: profile.email || null,
          first_name: profile.first_name || null,
          last_name: profile.last_name || null,
          full_name: profile.full_name || null,
          role: member.role || member.legacy_role || null,
          position: member.position || null,
        }
      })
    )
  }

  const selected = residents.find((resident) => resident.id === selectedId) || residents[0] || null

  const selectedMedications = useMemo(() => {
    return medications.filter((med) => med.resident_id === selected?.id && med.status === "active")
  }, [medications, selected])

  const medicationTemplates = useMemo(() => {
    const unique = new Map<string, Medication>()

    medications
      .filter((med) => med.status === "active")
      .forEach((med) => {
        const key = [med.medication_name.trim().toLowerCase(), med.dose.trim().toLowerCase(), toTime(med.scheduled_time), med.route || ""].join("|")
        if (!unique.has(key)) unique.set(key, med)
      })

    return Array.from(unique.values())
      .sort((a, b) => a.medication_name.localeCompare(b.medication_name, "lt"))
      .slice(0, 24)
  }, [medications])

  const selectedVitals = useMemo(() => {
    return vitals.filter((vital) => vital.resident_id === selected?.id)
  }, [vitals, selected])

  const latest = latestVitals(selectedVitals)
  const alerts = alertList(latest)

  const filteredResidents = useMemo(() => {
    const q = query.trim().toLowerCase()
    return residents.filter((resident) => {
      const residentLatest = latestVitals(vitals.filter((vital) => vital.resident_id === resident.id))
      const haystack = [
        residentName(resident, roomsById),
        resident.resident_code,
        residentInitials(resident),
        residentLatest ? alertList(residentLatest).join(" ") : "",
      ]
        .join(" ")
        .toLowerCase()

      return !q || haystack.includes(q)
    })
  }, [residents, roomsById, vitals, query])

  const filteredInventoryItems = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase()

    return inventoryItems
      .filter((item) => looksLikeMedicationInventoryItem(item))
      .filter((item) => {
        if (!q) return false

        return [item.name, item.category, item.subcategory, item.size, item.sku]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => inventoryName(a).localeCompare(inventoryName(b), "lt"))
      .slice(0, 20)
  }, [inventoryItems, inventorySearch])

  const preparedNotGiven = useMemo(() => {
    return selectedMedications.filter((med) => getMedicationLog(med.id, "prepared") && !getMedicationLog(med.id, "given"))
  }, [selectedMedications, adminLogs])

  const visibleMedications = useMemo(() => {
    if (activeMedicineTab === "prn") {
      return selectedMedications.filter((med) => med.is_prn)
    }

    if (activeMedicineTab === "unfinished") {
      return selectedMedications.filter((med) => !getMedicationLog(med.id, "given"))
    }

    return selectedMedications.filter((med) => !getMedicationLog(med.id, "given") || showCompletedMeds)
  }, [selectedMedications, adminLogs, showCompletedMeds, activeMedicineTab])

  const stats = useMemo(() => {
    const activeMeds = selectedMedications.length
    const prepared = selectedMedications.filter((med) => getMedicationLog(med.id, "prepared")).length
    const given = selectedMedications.filter((med) => getMedicationLog(med.id, "given")).length
    const linkedStock = selectedMedications.filter((med) => med.inventory_item_id).length
    return { activeMeds, prepared, given, linkedStock }
  }, [selectedMedications, adminLogs])

  const medicineTabInfo = useMemo(() => {
    if (activeMedicineTab === "prn") {
      return {
        kicker: "Pagal poreikį",
        title: "p.r.n. vaistai",
        hint: "Rodomi tik pagal poreikį skiriami vaistai. Žurnalą galima pildyti iš dešinės pusės greitų veiksmų arba istorijos.",
      }
    }

    if (activeMedicineTab === "events") {
      return {
        kicker: "Įvykiai",
        title: "Gyvybiniai rodikliai ir įspėjimai",
        hint: "Šis tabas paryškina sveikatos rodiklius ir įspėjimus. Naujam įrašui naudok mygtuką „Vitals“.",
      }
    }

    if (activeMedicineTab === "history") {
      return {
        kicker: "Žurnalas",
        title: "Vaistų ir rodiklių istorija",
        hint: "Žurnalas atidaromas modaliniame lange su filtrais ir CSV eksportu.",
      }
    }

    if (activeMedicineTab === "unfinished") {
      return {
        kicker: "Neužbaigta",
        title: "Dar nesuduoti vaistai",
        hint: "Rodomi visi šiandien dar nesuduoti vaistai, įskaitant laukiančius ir paruoštus.",
      }
    }

    return {
      kicker: "Vaistų kontrolė",
      title: "Šiandienos vaistai",
      hint: "Rodomi aktyvūs vaistai, paruošimas, sudavimas ir sandėlio nurašymas.",
    }
  }, [activeMedicineTab])

  function switchMedicineTab(tab: MedicineTab) {
    setActiveMedicineTab(tab)

    if (tab === "history") {
      setShowHistoryModal(true)
      return
    }

    if (tab === "events") {
      setShowVitalsModal(true)
      return
    }

    if (tab === "unfinished") {
      setShowCompletedMeds(false)
    }
  }

  function getMedicationLog(medicationId: string, status: string) {
    return adminLogs.find(
      (log) =>
        log.medication_id === medicationId &&
        log.status === status &&
        String(log.created_at || "").slice(0, 10) === todayKey()
    )
  }

  function applyMedicationTemplate(template: Medication) {
    setMedForm((prev) => ({
      ...prev,
      medication_name: template.medication_name || prev.medication_name,
      dose: template.dose || prev.dose,
      scheduled_time: toTime(template.scheduled_time) || prev.scheduled_time,
      schedule_frequency: prev.schedule_frequency || "daily",
      schedule_start_date: prev.schedule_start_date || todayKey(),
      schedule_end_date: prev.schedule_end_date || "",
      route: template.route || "",
      instructions: template.instructions || "",
      prescription_source: template.prescription_source || prev.prescription_source,
      prescribed_by: template.prescribed_by || "",
      prescription_date: template.prescription_date || "",
      inventory_item_id: template.inventory_item_id || "",
      inventory_units_per_dose: String(template.inventory_units_per_dose || 1),
      is_fractional: Boolean(template.is_fractional),
      is_external: Boolean(template.is_external),
      is_prn: Boolean(template.is_prn),
      requires_double_check: Boolean(template.requires_double_check),
      safety_notes: template.safety_notes || "",
    }))
  }

  function applyInventoryItem(item: InventoryItem) {
    setMedForm((prev) => ({
      ...prev,
      medication_name: prev.medication_name || inventoryName(item),
      inventory_item_id: item.id,
      inventory_units_per_dose: prev.inventory_units_per_dose || "1",
    }))
  }

  function closeAddMedicationModal() {
    setShowAddMedicationModal(false)
    setShowAdvancedMedicationSettings(false)
  }

  function currentEmployeeName() {
    const employee = employees.find((item) => item.user_id === currentUserId)
    return employeeName(employee)
  }

  async function writeMedicineAudit({
    table,
    recordId,
    action,
    changes,
  }: {
    table: string
    recordId?: string | null
    action: "insert" | "update" | "delete"
    changes: Record<string, unknown>
  }) {
    if (!organizationId || !currentUserId) return

    try {
      const { error } = await supabase.from("audit_log").insert({
        organization_id: organizationId,
        table_name: table,
        record_id: recordId || null,
        action,
        changed_by: currentUserId,
        changed_at: new Date().toISOString(),
        changes,
      })

      if (error) console.warn("[medicine audit]", error.message)
    } catch (error) {
      console.warn("[medicine audit]", error)
    }
  }

  async function saveMedicationFromModal() {
    await createMedication()
    if (medForm.medication_name.trim() && medForm.dose.trim() && medForm.prescription_source.trim() && medForm.inventory_item_id) {
      closeAddMedicationModal()
    }
  }

  async function createMedication() {
    try {
      if (!organizationId || !selected || !currentUserId) return

      if (!medForm.medication_name.trim() || !medForm.dose.trim()) {
        setMessage("Privalomi laukai: vaistas ir dozė.")
        return
      }

      if (!medForm.prescription_source.trim()) {
        setMessage("Privalomas saugumo laukas: paskyrimo šaltinis.")
        return
      }

      if (!medForm.inventory_item_id) {
        setMessage("Privalomas laukas: sandėlio prekė. Ji reikalinga automatiniam nurašymui.")
        return
      }

      const selectedInventoryItem = inventoryItems.find((item) => item.id === medForm.inventory_item_id)
      const unitsPerDose = Number(medForm.inventory_units_per_dose || 1)
      const quantity = inventoryQuantity(selectedInventoryItem)

      if (quantity !== null && quantity < unitsPerDose) {
        setMessage(`Negalima paskirti vaisto: sandėlyje nepakanka "${inventoryName(selectedInventoryItem)}" likučio. Likutis: ${quantity}, reikia: ${unitsPerDose}.`)
        return
      }

      setSaving(true)
      setMessage("")

      const scheduleSummary = [
        medForm.schedule_frequency === "daily" ? "Kartojimas: kasdien" : medForm.schedule_frequency === "as_needed" ? "Kartojimas: pagal poreikį" : "Kartojimas: pagal grafiką",
        medForm.schedule_start_date ? `Nuo: ${medForm.schedule_start_date}` : "",
        medForm.schedule_end_date ? `Iki: ${medForm.schedule_end_date}` : "",
      ].filter(Boolean).join(" · ")

      const instructionsWithSchedule = [medForm.instructions.trim(), scheduleSummary].filter(Boolean).join("\n")

      const { data: createdMedication, error } = await supabase.from("resident_medications").insert({
        organization_id: organizationId,
        resident_id: selected.id,
        medication_name: medForm.medication_name.trim(),
        dose: medForm.dose.trim(),
        scheduled_time: medForm.scheduled_time,
        route: medForm.route.trim() || null,
        instructions: instructionsWithSchedule || null,
        prescription_source: medForm.prescription_source.trim(),
        prescribed_by: medForm.prescribed_by.trim() || null,
        prescription_date: medForm.prescription_date || null,
        inventory_item_id: medForm.inventory_item_id || null,
        inventory_units_per_dose: Number(medForm.inventory_units_per_dose || 1),
        is_fractional: medForm.is_fractional,
        is_external: medForm.is_external,
        is_prn: medForm.is_prn,
        requires_double_check: medForm.requires_double_check,
        safety_notes: medForm.safety_notes.trim() || null,
        created_by: currentUserId,
      }).select("id").single()

      if (error) throw error

      await writeMedicineAudit({
        table: "resident_medications",
        recordId: createdMedication?.id || null,
        action: "insert",
        changes: {
          Veiksmas: "Vaistas paskirtas",
          Gyventojas: residentName(selected, roomsById),
          Vaistas: medForm.medication_name.trim(),
          Dozė: medForm.dose.trim(),
          Laikas: medForm.scheduled_time,
          Kartojimas: scheduleSummary || "—",
          "Vartojimo būdas": medForm.route.trim() || "—",
          "Paskyrimo šaltinis": medForm.prescription_source.trim(),
          "Paskyrė": medForm.prescribed_by.trim() || "—",
          "Pagal poreikį": medForm.is_prn ? "Taip" : "Ne",
          "Dviguba patikra": medForm.requires_double_check ? "Taip" : "Ne",
          Sandėlis: inventoryName(selectedInventoryItem),
          "Nurašoma per dozę": Number(medForm.inventory_units_per_dose || 1),
          Statusas: "Aktyvus",
          Darbuotojas: currentEmployeeName(),
        },
      })

      setMedForm({
        medication_name: "",
        dose: "",
        scheduled_time: "08:00",
        schedule_frequency: "daily",
        schedule_start_date: todayKey(),
        schedule_end_date: "",
        route: "",
        instructions: "",
        prescription_source: "",
        prescribed_by: "",
        prescription_date: "",
        inventory_item_id: "",
        inventory_units_per_dose: "1",
        is_fractional: false,
        is_external: false,
        is_prn: false,
        requires_double_check: false,
        safety_notes: "",
      })

      setInventorySearch("")
      setMessage("Vaistas pridėtas.")
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko pridėti vaisto.")
    } finally {
      setSaving(false)
    }
  }

  function openPrepareConfirmation(medicationsToPrepare: Medication[]) {
    const unique = medicationsToPrepare.filter(
      (medication, index, list) =>
        medication &&
        list.findIndex((item) => item.id === medication.id) === index &&
        !getMedicationLog(medication.id, "prepared") &&
        !getMedicationLog(medication.id, "given"),
    )

    if (unique.length === 0) {
      setMessage("Nėra vaistų, kuriuos reikėtų pažymėti kaip paruoštus.")
      return
    }

    setPrepareMedication(unique[0])
    setPrepareMedicationList(unique)
    setPrepareAcknowledged(false)
    setPrepareSecondCheckerId("")
    setPrepareChecks({
      resident_checked: false,
      medication_checked: false,
      dose_checked: false,
      time_checked: false,
      prescription_checked: false,
    })
    setShowPrepareModal(true)
  }

  async function confirmPreparedList() {
    if (!prepareAcknowledged) {
      setMessage("Prieš patvirtinant paruošimą pažymėkite atsakomybės patvirtinimą.")
      return
    }

    if (prepareMedicationList.length === 0) {
      setMessage("Nėra vaistų, kuriuos reikėtų pažymėti kaip paruoštus.")
      return
    }

    if (prepareMedicationList.some((medication) => medication.requires_double_check) && !prepareSecondCheckerId) {
      setMessage("Pasirinkite darbuotoją, kuris sutikrino dozatorių prieš dalinimą.")
      return
    }

    const stockProblem = prepareMedicationList.find((medication) => {
      if (!medication.inventory_item_id) return false
      const item = inventoryItems.find((inventoryItem) => inventoryItem.id === medication.inventory_item_id)
      const quantity = inventoryQuantity(item)
      const unitsPerDose = medication.inventory_units_per_dose || 1
      return quantity !== null && quantity < unitsPerDose
    })

    if (stockProblem) {
      const item = inventoryItems.find((inventoryItem) => inventoryItem.id === stockProblem.inventory_item_id)
      setMessage(`Negalima paruošti: sandėlyje nepakanka "${inventoryName(item)}" likučio.`)
      return
    }

    for (const medication of prepareMedicationList) {
      const prepared = await markPrepared(medication, true)
      if (!prepared) return
    }

    setShowPrepareModal(false)
    setPrepareMedication(null)
    setPrepareMedicationList([])
    setPrepareAcknowledged(false)
    setPrepareSecondCheckerId("")
    setMessage("Dozatorius pažymėtas kaip paruoštas ir laukia sudavimo.")
  }

  async function markPrepared(medication: Medication, skipChecks = false) {
    try {
      if (!organizationId || !selected || !currentUserId) return false

      if (!medication.prescription_source) {
        setMessage("Negalima pažymėti: nenurodytas paskyrimo šaltinis.")
        return false
      }

      const allChecked = Object.values(prepareChecks).every(Boolean)

      if (!skipChecks && !allChecked) {
        setMessage("Patvirtinkite visus paruošimo saugos punktus.")
        return false
      }

      if (medication.requires_double_check && !prepareSecondCheckerId) {
        setMessage("Pasirinkite darbuotoją, kuris sutikrino dozatorių prieš dalinimą.")
        return false
      }

      const inventoryItemForAudit = medication.inventory_item_id
        ? inventoryItems.find((inventoryItem) => inventoryItem.id === medication.inventory_item_id)
        : null

      if (medication.inventory_item_id) {
        const item = inventoryItemForAudit
        const quantity = inventoryQuantity(item)
        const unitsPerDose = medication.inventory_units_per_dose || 1

        if (quantity !== null && quantity < unitsPerDose) {
          setMessage(`Negalima paruošti: sandėlyje nepakanka "${inventoryName(item)}" likučio.`)
          return false
        }
      }

      setSaving(true)

      const { data: preparedLog, error } = await supabase.from("medication_administration_logs").insert({
        organization_id: organizationId,
        resident_id: selected.id,
        medication_id: medication.id,
        scheduled_for: `${todayKey()}T${toTime(medication.scheduled_time)}:00`,
        status: "prepared",
        prepared_by: currentUserId,
        prepared_at: new Date().toISOString(),
        notes:
          [
            medication.instructions,
            medication.requires_double_check && prepareSecondCheckerId
              ? `Dozatorių prieš dalinimą sutikrino darbuotojas: ${prepareSecondCheckerId}`
              : "",
          ]
            .filter(Boolean)
            .join("\n") || null,
      }).select("id").single()

      if (error) throw error

      await writeMedicineAudit({
        table: "medication_administration_logs",
        recordId: preparedLog?.id || medication.id,
        action: "insert",
        changes: {
          Veiksmas: "Paruošta",
          Gyventojas: residentName(selected, roomsById),
          Vaistas: medication.medication_name,
          Dozė: medication.dose,
          Laikas: toTime(medication.scheduled_time),
          "Paskyrimo šaltinis": medication.prescription_source || "—",
          Sandėlis: inventoryName(inventoryItemForAudit),
          "Dviguba patikra": medication.requires_double_check ? "Taip" : "Ne",
          "Dozatorių sutikrino": prepareSecondCheckerId ? employeeName(employees.find((item) => item.user_id === prepareSecondCheckerId)) : "—",
          Darbuotojas: currentEmployeeName(),
        },
      })

      setShowPrepareModal(false)
      await loadAll()
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko pažymėti dozatoriaus.")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function markAllSelectedPrepared() {
    const notPrepared = selectedMedications.filter(
      (med) => !getMedicationLog(med.id, "prepared") && !getMedicationLog(med.id, "given"),
    )

    openPrepareConfirmation(notPrepared)
  }

  async function confirmGivenSafely() {
    try {
      if (!organizationId || !selected || !currentUserId || !confirmMedication) return

      setSaving(true)
      setMessage("")

      const { data, error } = await supabase.rpc("administer_medication_safely", {
        p_medication_id: confirmMedication.id,
        p_resident_id: selected.id,
        p_organization_id: organizationId,
        p_actor_id: currentUserId,
        p_identity_checked: confirmChecks.responsibility_acknowledged,
        p_medication_checked: confirmChecks.responsibility_acknowledged,
        p_dose_checked: confirmChecks.responsibility_acknowledged,
        p_route_checked: confirmChecks.responsibility_acknowledged,
        p_time_checked: confirmChecks.responsibility_acknowledged,
        p_prescription_checked: confirmChecks.responsibility_acknowledged,
        p_responsibility_acknowledged: confirmChecks.responsibility_acknowledged,
        p_notes: confirmNotes.trim() || null,
        p_second_checked_by: secondCheckerId || null,
      })

      if (error) throw error

      await writeMedicineAudit({
        table: "medication_administration_logs",
        recordId: confirmMedication.id,
        action: "insert",
        changes: {
          Veiksmas: "Suduota",
          Gyventojas: residentName(selected, roomsById),
          Vaistas: confirmMedication.medication_name,
          Dozė: confirmMedication.dose,
          Laikas: toTime(confirmMedication.scheduled_time),
          "Vartojimo būdas": confirmMedication.route || "—",
          Sandėlis: confirmMedication.inventory_item_id
            ? inventoryName(inventoryItems.find((item) => item.id === confirmMedication.inventory_item_id))
            : "Nesusieta",
          "Nurašyta iš sandėlio": data?.inventory?.deducted ? "Taip" : "Ne",
          "Likutis po nurašymo": data?.inventory?.quantity ?? "—",
          "Dviguba patikra": confirmMedication.requires_double_check ? "Taip" : "Ne",
          "Papildomai sutikrino": secondCheckerId ? employeeName(employees.find((item) => item.user_id === secondCheckerId)) : "—",
          Pastabos: confirmNotes.trim() || "—",
          Darbuotojas: currentEmployeeName(),
        },
      })

      setConfirmMedication(null)
      setConfirmChecks(emptyChecks)
      setConfirmNotes("")
      setSecondCheckerId("")

      const inventoryMessage = data?.inventory?.deducted
        ? ` Sandėlis nurašytas: ${data.inventory.quantity}.`
        : " Sandėlis nenurašytas, nes vaistas nesusietas su preke."

      setMessage(`Sudavimą patvirtino darbuotojas.${inventoryMessage}`)
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko saugiai patvirtinti sudavimo.")
    } finally {
      setSaving(false)
    }
  }

  async function createMedicationDistributionTask() {
    try {
      if (!organizationId || !selected || !currentUserId) return

      const assignee = taskAssigneeId || currentUserId

      if (preparedNotGiven.length === 0) {
        setMessage("Nėra paruoštų vaistų, kuriuos būtų galima perduoti dalinimui.")
        return
      }

      setSaving(true)
      setMessage("")

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const tomorrowStart = new Date(todayStart)
      tomorrowStart.setDate(tomorrowStart.getDate() + 1)

      const existing = await supabase
        .from("tasks")
        .select("id, title, status, due_date")
        .eq("organization_id", organizationId)
        .eq("resident_id", selected.id)
        .eq("category", "medicina")
        .in("status", ["new", "pending", "in_progress"])
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", tomorrowStart.toISOString())
        .limit(1)

      if (existing.error) throw existing.error

      if ((existing.data || []).length > 0) {
        setMessage("Šiam gyventojui šiandien jau yra aktyvi medicinos užduotis. Naujos nedubliuoju.")
        return
      }

      const now = new Date()
      const candidateDueDates = preparedNotGiven
        .map((med) => {
          const [hour, minute] = toTime(med.scheduled_time).split(":").map(Number)
          const due = new Date()
          due.setHours(Number.isFinite(hour) ? hour : now.getHours(), Number.isFinite(minute) ? minute : now.getMinutes(), 0, 0)
          return due
        })
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime())

      let due = candidateDueDates.find((date) => date.getTime() > now.getTime()) || null

      if (!due) {
        due = new Date(now.getTime() + 30 * 60 * 1000)
      }

      const title = `Išdalinti paruoštus vaistus: ${residentName(selected, roomsById)}`
      const description = [
        "SAUGUMO TAISYKLĖ:",
        "Užduotį galima žymėti kaip atliktą tik tada, kai medicinos modulyje kiekvienas paruoštas vaistas yra saugiai patvirtintas kaip suduotas.",
        "",
        "Paruošti vaistai:",
        ...preparedNotGiven.map((med) => `- ${toTime(med.scheduled_time)} · ${med.medication_name} · ${med.dose}`),
        taskNote.trim() ? "" : "",
        taskNote.trim() ? `Pastaba: ${taskNote.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n")

      const { error } = await supabase.from("tasks").insert({
        organization_id: organizationId,
        assigned_to: assignee,
        resident_id: selected.id,
        title,
        description,
        status: "new",
        priority: "high",
        due_date: due.toISOString(),
        created_by: currentUserId,
        category: "medicina",
        department: "slauga",
      })

      if (error) throw error

      await writeMedicineAudit({
        table: "tasks",
        recordId: null,
        action: "insert",
        changes: {
          Veiksmas: "Sukurta vaistų dalinimo užduotis",
          Gyventojas: residentName(selected, roomsById),
          Užduotis: title,
          Terminas: due.toISOString(),
          Atsakingas: employeeName(employees.find((item) => item.user_id === assignee)),
          Darbuotojas: currentEmployeeName(),
        },
      })

      setTaskNote("")
      setShowTaskModal(false)
      setMessage("Dalinimo užduotis sukurta.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko sukurti vaistų dalinimo užduoties.")
    } finally {
      setSaving(false)
    }
  }


  async function createMedicationProblemTask() {
    try {
      if (!organizationId || !selected || !currentUserId) return

      if (!problemNote.trim()) {
        setMessage("Įrašykite, kokia problema pastebėta.")
        return
      }

      const medication =
        selectedMedications.find((item) => item.id === problemMedicationId) ||
        selectedMedications.find((item) => !getMedicationLog(item.id, "given") && isMedicationLate(item, 30)) ||
        selectedMedications.find((item) => !getMedicationLog(item.id, "given")) ||
        selectedMedications[0] ||
        null

      setSaving(true)
      setMessage("")

      const title = medication
        ? `Vaisto problema: ${medication.medication_name} · ${residentName(selected, roomsById)}`
        : `Vaistų problema: ${residentName(selected, roomsById)}`

      const description = [
        "Registruota iš medicinos modulio.",
        medication ? `Vaistas: ${toTime(medication.scheduled_time)} · ${medication.medication_name} · ${medication.dose}` : "Vaistas: nenurodytas",
        "",
        `Problema: ${problemNote.trim()}`,
      ].join("\n")

      const due = new Date(Date.now() + 30 * 60 * 1000)

      const { error } = await supabase.from("tasks").insert({
        organization_id: organizationId,
        assigned_to: currentUserId,
        resident_id: selected.id,
        title,
        description,
        status: "new",
        priority: "high",
        due_date: due.toISOString(),
        created_by: currentUserId,
        category: "medicina",
        department: "slauga",
      })

      if (error) throw error

      await writeMedicineAudit({
        table: "tasks",
        recordId: null,
        action: "insert",
        changes: {
          Veiksmas: "Registruota vaisto problema",
          Gyventojas: residentName(selected, roomsById),
          Vaistas: medication?.medication_name || "—",
          Dozė: medication?.dose || "—",
          Laikas: medication ? toTime(medication.scheduled_time) : "—",
          Problema: problemNote.trim(),
          Darbuotojas: currentEmployeeName(),
        },
      })

      setShowProblemModal(false)
      setProblemMedicationId("")
      setProblemNote("")
      setMessage("Problema užregistruota kaip medicinos užduotis.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko užregistruoti problemos.")
    } finally {
      setSaving(false)
    }
  }

  async function addPrnLog() {
    try {
      if (!organizationId || !selected || !currentUserId || !prnReason.trim()) return
      setSaving(true)

      const prnMedication = selectedMedications.find((med) => med.is_prn) || null

      const { data: prnLog, error } = await supabase.from("medication_prn_logs").insert({
        organization_id: organizationId,
        resident_id: selected.id,
        medication_id: prnMedication?.id || null,
        reason: prnReason.trim(),
        result: null,
        administered_by: currentUserId,
        administered_at: new Date().toISOString(),
      }).select("id").single()

      if (error) throw error

      await writeMedicineAudit({
        table: "medication_prn_logs",
        recordId: prnLog?.id || null,
        action: "insert",
        changes: {
          Veiksmas: "p.r.n. registruota",
          Gyventojas: residentName(selected, roomsById),
          Vaistas: prnMedication?.medication_name || "Pagal poreikį",
          Dozė: prnMedication?.dose || "—",
          Priežastis: prnReason.trim(),
          Darbuotojas: currentEmployeeName(),
        },
      })

      setPrnReason("")
      setMessage("p.r.n. įrašas užregistruotas.")
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko registruoti p.r.n.")
    } finally {
      setSaving(false)
    }
  }

  async function addVitals() {
    try {
      if (!organizationId || !selected || !currentUserId) return
      setSaving(true)

      const { data: vitalLog, error } = await supabase.from("resident_vitals").insert({
        organization_id: organizationId,
        resident_id: selected.id,
        measured_by: currentUserId,
        bp_sys: Number(newVitals.bp_sys),
        bp_dia: Number(newVitals.bp_dia),
        pulse: Number(newVitals.pulse),
        sugar: Number(newVitals.sugar),
        temperature: Number(newVitals.temperature),
        weight: Number(newVitals.weight),
        notes: newVitals.notes.trim() || null,
      }).select("id").single()

      if (error) throw error

      await writeMedicineAudit({
        table: "resident_vitals",
        recordId: vitalLog?.id || null,
        action: "insert",
        changes: {
          Veiksmas: "Rodikliai įvesti",
          Gyventojas: residentName(selected, roomsById),
          AKS: `${Number(newVitals.bp_sys)}/${Number(newVitals.bp_dia)}`,
          Pulsas: Number(newVitals.pulse),
          Cukrus: Number(newVitals.sugar),
          "Temperatūra": Number(newVitals.temperature),
          Svoris: Number(newVitals.weight),
          Pastabos: newVitals.notes.trim() || "—",
          Darbuotojas: currentEmployeeName(),
        },
      })

      setShowVitalsModal(false)
      setMessage("Rodikliai išsaugoti.")
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko išsaugoti rodiklių.")
    } finally {
      setSaving(false)
    }
  }

  function setVitalsButton(field: keyof typeof newVitals, delta: number) {
    setNewVitals((prev) => ({
      ...prev,
      [field]: Number((Number(prev[field]) + delta).toFixed(1)),
    }))
  }

  function openConfirmModal(medication: Medication) {
    setConfirmMedication(medication)
    setConfirmChecks(emptyChecks)
    setConfirmNotes("")
    setSecondCheckerId("")
  }

  const allConfirmChecksOk = Object.values(confirmChecks).every(Boolean)
  const allPrepareChecksOk = Object.values(prepareChecks).every(Boolean)
  const prepareNeedsSecondCheck = prepareMedicationList.some((medication) => medication.requires_double_check)


  function historyRows() {
    if (!selected) return []

    const from = new Date(`${historyFrom}T00:00:00`)
    const to = new Date(`${historyTo}T23:59:59`)

    const inRange = (value?: string | null) => {
      if (!value) return false
      const date = new Date(value)
      return date >= from && date <= to
    }

    const medicationRows = adminLogs
      .filter((log) => log.resident_id === selected.id && inRange(log.created_at))
      .map((log) => {
        const med = medications.find((item) => item.id === log.medication_id)
        return {
          tipas: "Vaistai",
          data: formatDate(log.created_at),
          pavadinimas: med?.medication_name || "—",
          doze: med?.dose || "—",
          statusas: medicationStatusLabel(log.status),
          pastaba: log.status === "given" ? "Suduota / patvirtinta" : log.status === "prepared" ? "Dozatorius paruoštas" : "—",
        }
      })

    const vitalRows = vitals
      .filter((vital) => vital.resident_id === selected.id && inRange(vital.measured_at))
      .map((vital) => ({
        tipas: "Vitals",
        data: formatDate(vital.measured_at),
        pavadinimas: `AKS ${vital.bp_sys || "—"}/${vital.bp_dia || "—"}`,
        doze: `Pulsas ${vital.pulse || "—"} · Cukrus ${vital.sugar || "—"} · Temp. ${vital.temperature || "—"} · Svoris ${vital.weight || "—"}`,
        statusas: "įrašyta",
        pastaba: vital.notes || "—",
      }))

    const prnRows = prnLogs
      .filter((log) => log.resident_id === selected.id && inRange(log.administered_at))
      .map((log) => {
        const med = medications.find((item) => item.id === log.medication_id)
        return {
          tipas: "p.r.n.",
          data: formatDate(log.administered_at),
          pavadinimas: med?.medication_name || "Pagal poreikį",
          doze: med?.dose || "—",
          statusas: "registruota",
          pastaba: log.reason || "—",
        }
      })

    if (historyType === "medications") return medicationRows
    if (historyType === "vitals") return vitalRows
    if (historyType === "prn") return prnRows

    return [...medicationRows, ...vitalRows, ...prnRows].sort((a, b) => {
      return new Date(b.data).getTime() - new Date(a.data).getTime()
    })
  }

  function downloadHistoryCsv() {
    const rows = historyRows()
    const header = ["Tipas", "Data", "Pavadinimas", "Dozė / Rodikliai", "Statusas", "Pastaba"]
    const csvRows = [
      header,
      ...rows.map((row) => [row.tipas, row.data, row.pavadinimas, row.doze, row.statusas, row.pastaba]),
    ]

    const csv = csvRows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\\n")

    const blob = new Blob(["\\ufeff" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `medicina_${residentShortName(selected).replaceAll(" ", "_")}_${historyFrom}_${historyTo}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }


  const todayAttentionItems = [
    selectedMedications.some((med) => !getMedicationLog(med.id, "given"))
      ? {
          title: "Nesuduoti vaistai",
          value: selectedMedications.filter((med) => !getMedicationLog(med.id, "given")).length,
          tone: "red",
          description: "Dar yra vaistų, kurie nepažymėti kaip suduoti.",
        }
      : null,
    selectedMedications.some((med) => !getMedicationLog(med.id, "given") && isMedicationLate(med, 30))
      ? {
          title: "Vėluojantys vaistai",
          value: selectedMedications.filter((med) => !getMedicationLog(med.id, "given") && isMedicationLate(med, 30)).length,
          tone: "red",
          description: "Vaistai nesuduoti laiku. Patikrinkite prioritetą ir priežastį.",
        }
      : null,
    selectedMedications.some((med) => med.is_prn && !prnLogs.some((log) => log.medication_id === med.id && String(log.administered_at || "").slice(0, 10) === todayKey()))
      ? {
          title: "Pagal poreikį vaistai be paaiškinimo",
          value: selectedMedications.filter((med) => med.is_prn && !prnLogs.some((log) => log.medication_id === med.id && String(log.administered_at || "").slice(0, 10) === todayKey())).length,
          tone: "amber",
          description: "Reikia įrašyti skyrimo priežastį.",
        }
      : null,
    selectedMedications.some((med) => med.requires_double_check)
      ? {
          title: "Dviguba patikra",
          value: selectedMedications.filter((med) => med.requires_double_check).length,
          tone: "blue",
          description: "Vaistams reikalinga papildoma darbuotojo patikra.",
        }
      : null,
selectedMedications.some((med) => {
      const item = inventoryItems.find((inventoryItem) => inventoryItem.id === med.inventory_item_id)
      const stock = medicationStockStatus(item, med.inventory_units_per_dose || 1)
      return stock.level === "low" || stock.level === "critical" || stock.level === "empty"
    })
      ? {
          title: "Vaistai artėja prie pabaigos",
          value: selectedMedications.filter((med) => {
            const item = inventoryItems.find((inventoryItem) => inventoryItem.id === med.inventory_item_id)
            const stock = medicationStockStatus(item, med.inventory_units_per_dose || 1)
            return stock.level === "low" || stock.level === "critical" || stock.level === "empty"
          }).length,
          tone: selectedMedications.some((med) => {
            const item = inventoryItems.find((inventoryItem) => inventoryItem.id === med.inventory_item_id)
            const stock = medicationStockStatus(item, med.inventory_units_per_dose || 1)
            return stock.level === "empty" || stock.level === "critical"
          }) ? "red" : "amber",
          description: "Patikrink sandėlį ir sukurk papildymo užduotį.",
        }
      : null,
  ].filter(Boolean)

  const selectedInventoryForForm = inventoryItems.find((item) => item.id === medForm.inventory_item_id) || null
  const selectedInventoryUnitsPerDose = Number(medForm.inventory_units_per_dose || 1)
  const selectedMedicationStock = medicationStockStatus(selectedInventoryForForm, selectedInventoryUnitsPerDose)
  const selectedMedicationBlocksByStock = Boolean(medForm.inventory_item_id && selectedMedicationStock.blocksAction)
  const canSaveMedicationFromModal = Boolean(
    medForm.medication_name.trim() &&
      medForm.dose.trim() &&
      medForm.prescription_source.trim() &&
      medForm.inventory_item_id &&
      !selectedMedicationBlocksByStock &&
      !saving,
  )

  const currentShiftName = getCurrentShiftName()
  const currentEmployee = employees.find((employee) => employee.user_id === currentUserId) || null
  const lateMedicationsCount = selectedMedications.filter((med) => !getMedicationLog(med.id, "given") && isMedicationLate(med, 30)).length


  const selectedRoomLabel = roomsById[selected?.current_room_id || ""] || "Kambarys —"

  const dispenserSlots = useMemo(() => {
    const slotDefinitions = [
      { key: "morning", title: "Rytas", subtitle: "iki 12:00" },
      { key: "noon", title: "Pietūs", subtitle: "12:00–15:59" },
      { key: "evening", title: "Vakaras", subtitle: "16:00–20:59" },
      { key: "night", title: "Naktis", subtitle: "nuo 21:00" },
    ]

    function slotKey(time?: string | null) {
      const hour = Number(toTime(time).split(":")[0])
      if (!Number.isFinite(hour)) return "morning"
      if (hour < 12) return "morning"
      if (hour < 16) return "noon"
      if (hour < 21) return "evening"
      return "night"
    }

    return slotDefinitions.map((slot) => ({
      ...slot,
      medications: selectedMedications.filter((medication) => slotKey(medication.scheduled_time) === slot.key),
    }))
  }, [selectedMedications])

  const weekDispenserDays = useMemo(() => {
    const dayNames = ["Sekm.", "Pirm.", "Antr.", "Treč.", "Ketv.", "Penkt.", "Šešt."]
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() + index)
      const dayKey = date.toISOString().slice(0, 10)
      const medicationsForDay = selectedMedications

      const prepared = medicationsForDay.filter((medication) => getMedicationLog(medication.id, "prepared")).length
      const given = medicationsForDay.filter((medication) => getMedicationLog(medication.id, "given")).length
      const late = index === 0 ? medicationsForDay.filter((medication) => !getMedicationLog(medication.id, "given") && isMedicationLate(medication, 30)).length : 0
      const waiting = Math.max(medicationsForDay.length - prepared - given, 0)

      return {
        key: dayKey,
        title: index === 0 ? "Šiandien" : dayNames[date.getDay()],
        dateLabel: date.toLocaleDateString("lt-LT", { month: "2-digit", day: "2-digit" }),
        medications: medicationsForDay,
        prepared,
        given,
        late,
        waiting,
      }
    })
  }, [selectedMedications, adminLogs])

  const allActiveMedications = medications.filter((med) => med.status === "active")
  const allNeedPreparation = allActiveMedications.filter((med) => !getMedicationLog(med.id, "prepared") && !getMedicationLog(med.id, "given"))
  const allPreparedNotGiven = allActiveMedications.filter((med) => getMedicationLog(med.id, "prepared") && !getMedicationLog(med.id, "given"))
  const allCheckedBeforeHandover = allPreparedNotGiven.filter((med) => med.requires_double_check || getMedicationLog(med.id, "prepared"))
  const allHandoverWaiting = allPreparedNotGiven
  const allGivenToday = allActiveMedications.filter((med) => getMedicationLog(med.id, "given"))

  const workflowFilteredMedications = (() => {
    if (workflowFilter === "prescribed") return allActiveMedications
    if (workflowFilter === "preparation") return allNeedPreparation
    if (workflowFilter === "checked") return allCheckedBeforeHandover
    if (workflowFilter === "handover") return allHandoverWaiting
    if (workflowFilter === "given") return allGivenToday
    return allActiveMedications
  })()

  const workflowVisibleResidentIds = new Set(workflowFilteredMedications.map((med) => med.resident_id).filter(Boolean))
  const workflowVisibleResidentCount = workflowFilter === "all" ? residents.length : workflowVisibleResidentIds.size
  const workflowVisibleResidents = workflowFilter === "all" ? residents : residents.filter((resident) => workflowVisibleResidentIds.has(resident.id))
  const workflowFilterLabel =
    workflowFilter === "prescribed"
      ? "Paskirta"
      : workflowFilter === "preparation"
        ? "Ruošiamas dozatorius"
        : workflowFilter === "checked"
          ? "Sutikrinta"
          : workflowFilter === "handover"
            ? "Perduota dalinimui"
            : workflowFilter === "given"
              ? "Suduota"
              : "Visi gyventojai"

  if (loading) return <div style={styles.page}>Kraunama...</div>
  if (!selected) {
    return (
      <div style={styles.page}>
        <section style={styles.panelSoft}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.sectionKicker}>
                <AlertTriangle size={16} />
                Medicinos modulis
              </div>
              <h1 style={styles.sectionTitle}>Gyventojų nerasta</h1>
              <p style={styles.quickHint}>
                Sistema nerado gyventojų pagal priskyrimus, medicinos įrašus, tiesioginį residents.organization_id arba aktyvias resident_stays eilutes.
              </p>
              {message ? <p style={styles.quickHint}>{message}</p> : null}
            </div>
            <button type="button" style={styles.secondaryButton} onClick={() => void loadAll()}>
              <RefreshCw size={16} />
              Atnaujinti
            </button>
          </div>
        </section>
      </div>
    )
  }


  const prnPanel = (
    <section style={styles.prnPanelInline}>
      <div style={styles.sectionHeaderLine}>
        <div>
          <div style={styles.sectionKicker}>
            <Stethoscope size={16} />
            Pagal poreikį
          </div>
          <h3 style={styles.smallTitle}>p.r.n. registravimas</h3>
          <p style={styles.quickHint}>
            Registruojama tik tada, kai atsiranda konkreti priežastis, pvz. skausmas, nerimas ar kitas poreikis.
          </p>
        </div>
      </div>

      <div style={styles.prnInlineForm}>
        <input
          value={prnReason}
          onChange={(event) => setPrnReason(event.target.value)}
          placeholder="Priežastis, pvz., galvos skausmas"
          style={styles.prnInput}
        />
        <button
          type="button"
          onClick={() => void addPrnLog()}
          disabled={saving || !prnReason.trim()}
          style={saving || !prnReason.trim() ? styles.prnSubmitDisabled : styles.prnSubmitButton}
        >
          Registruoti
        </button>
      </div>

      <div style={styles.prnHistoryList}>
        {prnLogs.filter((log) => log.resident_id === selected.id).slice(0, 4).map((log) => {
          const medication = medications.find((item) => item.id === log.medication_id)

          return (
            <div key={log.id} style={styles.prnHistoryItem}>
              <strong>{medication?.medication_name || "Pagal poreikį"}</strong>
              <span>{formatDate(log.administered_at)} · {log.reason}</span>
            </div>
          )
        })}

        {prnLogs.filter((log) => log.resident_id === selected.id).length === 0 ? (
          <div style={styles.emptySmall}>p.r.n. įrašų šiam gyventojui dar nėra.</div>
        ) : null}
      </div>
    </section>
  )

  return (
    <div style={styles.page}>
      <section style={styles.topShell}>
        <div style={styles.heroTop}>
          <div>
            <div style={styles.heroKicker}>MEDICINOS VALDYMAS</div>
            <h1 style={styles.heroTitle}>Medicina, vaistai ir sudavimai</h1>
            <p style={styles.heroSubtitle}>
              Vaistų paskyrimas, dozatoriaus ruošimas, sutikrinimas prieš dalinimą, darbuotojo paskyrimas ir sudavimas viename aiškiame lange.
            </p>
            <div style={styles.shiftBadgeRow}>
              <span style={styles.shiftBadge}>{currentShiftName}</span>
              {lateMedicationsCount > 0 ? <span style={styles.shiftBadgeDanger}>{lateMedicationsCount} vėluoja</span> : null}
            </div>
          </div>

          <div style={styles.heroActionsTeam}>
            <button type="button" style={styles.heroWhiteButton} onClick={() => void loadAll()} disabled={loading || saving}>
              <RefreshCw size={16} />
              Atnaujinti
            </button>
            <button type="button" style={styles.heroGhostButton} onClick={() => setShowAddMedicationModal(true)}>
              <Plus size={16} />
              Naujas vaistas
            </button>
          </div>
        </div>

        <div style={styles.heroWorkbar}>
          <div style={styles.topResidentSearch}>
            <Search size={18} color="#2f6b5d" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ieškoti gyventojo, kambario arba kodo..."
              style={styles.topResidentSearchInput}
            />

            {query.trim() ? (
              <div style={styles.topResidentResults}>
                {filteredResidents.length > 0 ? (
                  filteredResidents.slice(0, 8).map((resident) => {
                    const residentLatest = latestVitals(vitals.filter((vital) => vital.resident_id === resident.id))
                    const residentAlerts = alertList(residentLatest)
                    const room = roomsById[resident.current_room_id || ""] || "Kambarys —"

                    return (
                      <button
                        key={resident.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(resident.id)
                          setQuery("")
                          setUnlocked(false)
                        }}
                        style={{
                          ...styles.topResidentOption,
                          ...(selected.id === resident.id ? styles.topResidentOptionActive : {}),
                        }}
                      >
                        <span style={styles.topResidentAvatar}>
                          <UserRound size={17} />
                        </span>
                        <span style={styles.topResidentOptionText}>
                          <strong>{unlocked ? residentShortName(resident) : `${residentInitials(resident)} · ${room}`}</strong>
                          <small>{resident.resident_code || resident.id.slice(0, 8)}{residentAlerts.length > 0 ? ` · ${residentAlerts.length} įsp.` : ""}</small>
                        </span>
                      </button>
                    )
                  })
                ) : (
                  <div style={styles.topResidentEmpty}>Gyventojas nerastas.</div>
                )}
              </div>
            ) : null}
          </div>

          <div style={styles.moduleNavBar}>
            <div style={styles.moduleNavList}>
              {[
                { key: "medications" as const, label: "Paskyrimai", icon: ClipboardList },
                { key: "unfinished" as const, label: "Dozatorius", icon: PackageMinus },
                { key: "history" as const, label: "Sudavimai", icon: Check },
                { key: "prn" as const, label: "p.r.n.", icon: Stethoscope },
                { key: "events" as const, label: "Vitals", icon: HeartPulse },
              ].map((tab) => {
                const Icon = tab.icon
                const active = activeMedicineTab === tab.key

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => switchMedicineTab(tab.key)}
                    style={active ? styles.moduleNavButtonActive : styles.moduleNavButton}
                  >
                    <Icon size={18} strokeWidth={2.2} />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <div style={styles.moduleNavRight}>
              <button type="button" style={styles.moduleSmallButton} onClick={() => setShowHelpModal(true)}>
                <Info size={17} strokeWidth={2.2} />
                Instrukcija
              </button>
              <button type="button" style={unlocked ? styles.moduleSmallButtonActive : styles.moduleSmallButton} onClick={() => setUnlocked((v) => !v)}>
                {unlocked ? <Unlock size={17} strokeWidth={2.2} /> : <Lock size={17} strokeWidth={2.2} />}
                {unlocked ? "Atrakinta" : "BDAR"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.selectedResidentSummary}>
        <div style={styles.selectedResidentMain}>
          <div style={styles.selectedResidentAvatar}>
            <UserRound size={22} />
          </div>
          <div>
            <div style={styles.sectionKicker}>
              <UserRound size={15} />
              Pasirinktas gyventojas
            </div>
            <h2 style={styles.selectedResidentTitle}>
              {unlocked ? residentShortName(selected) : `${residentInitials(selected)} · ${roomsById[selected.current_room_id || ""] || "Kambarys —"}`}
            </h2>
            <p style={styles.selectedResidentMeta}>
              {selected.resident_code || selected.id.slice(0, 8)} · apačioje rodoma tik šio gyventojo informacija
            </p>
          </div>
        </div>

        <div style={styles.selectedResidentFacts}>
          <div style={styles.selectedFact}>
            <span style={styles.selectedFactIcon}>
              <Clock3 size={18} strokeWidth={2.15} />
            </span>
            <div style={styles.selectedFactText}>
              <span style={styles.selectedFactLabel}>Pamaina</span>
              <strong style={styles.selectedFactValue}>{currentShiftName}</strong>
            </div>
          </div>
          <div style={styles.selectedFact}>
            <span style={styles.selectedFactIcon}>
              <UserCheck size={18} strokeWidth={2.15} />
            </span>
            <div style={styles.selectedFactText}>
              <span style={styles.selectedFactLabel}>Fiksuoja</span>
              <strong style={styles.selectedFactValue}>{employeeName(currentEmployee)}</strong>
            </div>
          </div>
          <div style={styles.selectedFact}>
            <span style={styles.selectedFactIcon}>
              <BadgeCheck size={18} strokeWidth={2.15} />
            </span>
            <div style={styles.selectedFactText}>
              <span style={styles.selectedFactLabel}>Sutikrino</span>
              <strong style={styles.selectedFactValue}>{prepareSecondCheckerId ? employeeName(employees.find((employee) => employee.user_id === prepareSecondCheckerId)) : "Nepasirinkta"}</strong>
            </div>
          </div>
        </div>
      </section>

      {message ? <div style={styles.message}>{message}</div> : null}

      {showHelpModal ? (
        <div style={styles.modalBackdrop}>
          <section style={styles.instructionModal}>
            <div style={styles.instructionHeader}>
              <div>
                <p style={styles.instructionKicker}>Trumpa instrukcija</p>
                <h2 style={styles.instructionTitle}>Kaip naudotis medicinos moduliu?</h2>
                <p style={styles.instructionSubtitle}>
                  Čia valdoma vaistų paskyrimo, paruošimo, sudavimo, p.r.n.,
                  sandėlio nurašymo ir sveikatos rodiklių registravimo eiga.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                style={styles.instructionClose}
                aria-label="Uždaryti instrukciją"
              >
                ×
              </button>
            </div>

            <div style={styles.instructionBody}>
              <div style={styles.instructionHighlight}>
                <div style={styles.instructionNumber}>1</div>
                <div>
                  <h3 style={styles.instructionSectionTitle}>Saugumo principas</h3>
                  <p style={styles.instructionText}>
                    Sistema registruoja veiksmus, tačiau darbuotojas visada privalo patikrinti
                    gyventoją, vaistą, dozę, laiką, vartojimo būdą ir paskyrimo pagrindą prieš patvirtindamas sudavimą.
                  </p>
                </div>
              </div>

              <div style={styles.instructionGrid}>
                <div style={styles.instructionCard}>
                  <div style={styles.instructionCardNumber}>2</div>
                  <h3 style={styles.instructionCardTitle}>Gyventojo pasirinkimas</h3>
                  <p style={styles.instructionCardText}>
                    Pasirinkite gyventoją iš kortelių. Jei BDAR režimas užrakintas, rodomi tik inicialai, kodas ir kambarys.
                  </p>
                </div>

                <div style={styles.instructionCard}>
                  <div style={styles.instructionCardNumber}>3</div>
                  <h3 style={styles.instructionCardTitle}>Vaistų paruošimas ir sudavimas</h3>
                  <p style={styles.instructionCardText}>
                    Pirmiausia pažymėkite, kad vaistas paruoštas, o sudavimą patvirtinkite atskiru atsakomybės veiksmu.
                  </p>
                </div>

                <div style={styles.instructionCard}>
                  <div style={styles.instructionCardNumber}>4</div>
                  <h3 style={styles.instructionCardTitle}>Sandėlis ir dozatoriai</h3>
                  <p style={styles.instructionCardText}>
                    Jei vaistas susietas su sandėliu, sistema rodo likutį ir nurašymo vienetus. Dozatoriaus veiksmai registruojami atskirai.
                  </p>
                </div>

                <div style={{ ...styles.instructionCard, ...styles.instructionWarningCard }}>
                  <div style={styles.instructionWarningNumber}>5</div>
                  <h3 style={styles.instructionWarningTitle}>Įspėjimai</h3>
                  <p style={styles.instructionWarningText}>
                    Raudoni / geltoni įspėjimai reiškia papildomą patikrą: dviguba patikra, p.r.n. pagrindas, dalinė dozė, alergija ar rizikos pastaba.
                  </p>
                </div>
              </div>
            </div>

            <div style={styles.instructionFooter}>
              <button type="button" onClick={() => setShowHelpModal(false)} style={styles.instructionDone}>
                Supratau
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <section style={styles.workflowSummaryBarCompact}>
        <div style={styles.workflowSummaryLeft}>
          <ShieldCheck size={15} />
          <strong>Vaistų eigos filtrai</strong>
          <span>Veikia visiems gyventojams. Apačioje lieka pasirinkto gyventojo dozatorius.</span>
        </div>
        <div style={styles.workflowSummaryBadges}>
          <span style={styles.workflowFilterBadge}>Filtras: {workflowFilterLabel}</span>
          <span style={styles.workflowFilterCount}>Rodoma gyventojų: {workflowVisibleResidentCount}</span>
          {workflowFilter !== "all" ? (
            <button type="button" onClick={() => setWorkflowFilter("all")} style={styles.workflowClearButton}>
              <X size={14} strokeWidth={2.4} />
              Nuimti filtrą
            </button>
          ) : null}
        </div>
      </section>

      <section style={styles.workflowStepsGrid}>
        {[
          { filter: "prescribed" as const, label: "Paskirta", value: allActiveMedications.length, hint: "aktyvūs paskyrimai", icon: ClipboardList, tab: "medications" as const },
          { filter: "preparation" as const, label: "Ruošiamas dozatorius", value: allNeedPreparation.length, hint: "dar neparuošta", icon: PackageMinus, tab: "unfinished" as const },
          { filter: "checked" as const, label: "Sutikrinta", value: allCheckedBeforeHandover.length, hint: "paruošta dalinimui", icon: BadgeCheck, tab: "unfinished" as const },
          { filter: "handover" as const, label: "Perduota dalinimui", value: allHandoverWaiting.length, hint: "laukia sudavimo", icon: UserCheck, tab: "unfinished" as const },
          { filter: "given" as const, label: "Suduota", value: allGivenToday.length, hint: "užbaigti veiksmai", icon: CheckCircle2, tab: "history" as const },
        ].map((step) => {
          const Icon = step.icon
          const active = workflowFilter === step.filter

          return (
            <button
              key={step.label}
              type="button"
              onClick={() => {
                setWorkflowFilter(step.filter)
                switchMedicineTab(step.tab)
              }}
              style={active ? styles.workflowStepActive : styles.workflowStep}
            >
              <span style={styles.workflowStepIcon}>
                <Icon size={18} strokeWidth={2.2} />
              </span>
              <span style={styles.workflowStepBody}>
                <span style={styles.workflowStepTitleRow}>
                  <strong>{step.label}</strong>
                  <span style={styles.workflowStepValue}>{step.value}</span>
                </span>
                <small>{step.hint}</small>
              </span>
            </button>
          )
        })}
      </section>

      <section style={styles.workflowResidentsPanel}>
        <div style={styles.workflowResidentsHeader}>
          <div>
            <strong>{workflowFilter === "all" ? "Visi gyventojai" : `Gyventojai pagal filtrą: ${workflowFilterLabel}`}</strong>
            <span>Paspaudus gyventoją apačioje rodomas tik jo dozatorius ir veiksmai.</span>
          </div>
          <button type="button" onClick={() => setWorkflowFilter("all")} style={styles.workflowSmallGhostButton}>
            Rodyti visus
          </button>
        </div>

        {workflowVisibleResidents.length > 0 ? (
          <div style={styles.workflowResidentsGrid}>
            {workflowVisibleResidents.slice(0, 12).map((resident) => {
              const room = roomsById[resident.current_room_id || ""] || "Kambarys —"
              const residentMeds = medications.filter((med) => med.resident_id === resident.id && med.status === "active")
              const residentNeed = residentMeds.filter((med) => !getMedicationLog(med.id, "prepared") && !getMedicationLog(med.id, "given")).length
              const residentPrepared = residentMeds.filter((med) => getMedicationLog(med.id, "prepared") && !getMedicationLog(med.id, "given")).length
              const residentLate = residentMeds.filter((med) => !getMedicationLog(med.id, "given") && isMedicationLate(med, 30)).length

              return (
                <button
                  key={resident.id}
                  type="button"
                  onClick={() => setSelectedId(resident.id)}
                  style={resident.id === selected.id ? styles.workflowResidentCardActive : styles.workflowResidentCard}
                >
                  <span style={styles.workflowResidentAvatar}>
                    <UserRound size={16} strokeWidth={2.2} />
                  </span>
                  <span style={styles.workflowResidentText}>
                    <strong>{unlocked ? residentShortName(resident) : `${residentInitials(resident)} · ${room}`}</strong>
                    <small>
                      {residentNeed} ruošti · {residentPrepared} paruošta{residentLate > 0 ? ` · ${residentLate} vėluoja` : ""}
                    </small>
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div style={styles.workflowResidentsEmpty}>Pagal pasirinktą filtrą gyventojų nėra.</div>
        )}
      </section>

      <section
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 360px",
          gap: 18,
          alignItems: "start",
        }}
      >
        <main
          style={{
            background: "#ffffff",
            border: "1px solid #dbe6e0",
            borderRadius: 22,
            padding: 22,
            boxShadow: "0 14px 34px rgba(15,23,42,.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 18,
              alignItems: "flex-start",
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <div>
              <div style={styles.sectionKicker}>
                <PackageMinus size={16} />
                Dozatorių ruošimas
              </div>
              <h2 style={{ margin: "8px 0 0", color: "#10251f", fontSize: 28, fontWeight: 950, letterSpacing: "-0.04em" }}>
                {unlocked ? residentShortName(selected) : `${residentInitials(selected)} · ${selectedRoomLabel}`}
              </h2>
              <p style={{ margin: "8px 0 0", color: "#64756e", fontSize: 14, fontWeight: 850 }}>
                {dispenserView === "today" ? "Rodomas šiandienos dozatorius" : dispenserView === "tomorrow" ? "Rodomas rytojaus planas" : "Rodomas savaitės vaistų planas"} pagal pasirinktą bendrą filtrą: {workflowFilterLabel}.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                background: "#eef4f1",
                border: "1px solid #dbe6e0",
                borderRadius: 17,
                padding: 8,
              }}
            >
              <button type="button" onClick={() => setDispenserView("today")} style={dispenserView === "today" ? styles.moduleNavButtonActive : styles.moduleNavButton}>Šiandien</button>
              <button type="button" onClick={() => setDispenserView("tomorrow")} style={dispenserView === "tomorrow" ? styles.moduleNavButtonActive : styles.moduleNavButton}>Rytoj</button>
              <button type="button" onClick={() => setDispenserView("week")} style={dispenserView === "week" ? styles.moduleNavButtonActive : styles.moduleNavButton}>Savaitė</button>
            </div>
          </div>

          {dispenserView === "week" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(130px, 1fr))",
                gap: 10,
                overflowX: "auto",
                paddingBottom: 4,
              }}
            >
              {weekDispenserDays.map((day) => {
                const dayNeedsAction = day.waiting > 0 || day.late > 0

                return (
                  <section
                    key={day.key}
                    style={{
                      minWidth: 130,
                      border: dayNeedsAction ? "1px solid #7aa69b" : "1px solid #dbe6e0",
                      borderRadius: 20,
                      background: dayNeedsAction ? "#f0faf6" : "#fbfdfc",
                      padding: 14,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <div>
                        <strong style={{ display: "block", color: "#10251f", fontSize: 15, fontWeight: 950 }}>{day.title}</strong>
                        <span style={{ display: "block", marginTop: 3, color: "#64756e", fontSize: 12, fontWeight: 850 }}>{day.dateLabel}</span>
                      </div>
                      <span style={{ ...styles.statusChip, ...(day.late > 0 ? styles.statusRed : day.waiting > 0 ? styles.statusAmber : styles.statusGreen) }}>
                        {day.late > 0 ? "!" : day.waiting > 0 ? "Ruošti" : "OK"}
                      </span>
                    </div>

                    <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#64756e", fontSize: 12, fontWeight: 900 }}>
                        <span>Vaistai</span><strong style={{ color: "#10251f" }}>{day.medications.length}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#64756e", fontSize: 12, fontWeight: 900 }}>
                        <span>Paruošta</span><strong style={{ color: "#10251f" }}>{day.prepared}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#64756e", fontSize: 12, fontWeight: 900 }}>
                        <span>Suduota</span><strong style={{ color: "#10251f" }}>{day.given}</strong>
                      </div>
                      {day.late > 0 ? (
                        <div style={{ color: "#b91c1c", fontSize: 12, fontWeight: 950 }}>Vėluoja: {day.late}</div>
                      ) : null}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              {dispenserSlots.map((slot) => (
                <section
                  key={slot.key}
                  style={{
                    minHeight: 230,
                    border: "1px solid #dbe6e0",
                    borderRadius: 22,
                    background: "#fbfdfc",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "16px 18px", background: "#f4faf7", borderBottom: "1px solid #dbe6e0" }}>
                    <strong style={{ display: "block", color: "#10251f", fontSize: 18, fontWeight: 950 }}>{slot.title}</strong>
                    <span style={{ display: "block", marginTop: 4, color: "#64756e", fontSize: 13, fontWeight: 850 }}>{slot.subtitle}</span>
                  </div>

                  <div style={{ padding: 14, display: "grid", gap: 10 }}>
                    {slot.medications.map((medication) => {
                      const prepared = getMedicationLog(medication.id, "prepared")
                      const given = getMedicationLog(medication.id, "given")
                      const isLate = !given && isMedicationLate(medication, 30)
                      const label = given ? "Suduota" : prepared ? "Paruošta" : isLate ? "Vėluoja" : "Laukia"
                      const badgeStyle = given
                        ? styles.statusGreen
                        : prepared
                          ? styles.statusAmber
                          : isLate
                            ? styles.statusRed
                            : styles.statusNeutral

                      return (
                        <article
                          key={medication.id}
                          style={{
                            border: "1px solid #dbe6e0",
                            background: "#ffffff",
                            borderRadius: 14,
                            padding: 14,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                            <div>
                              <strong style={{ display: "block", color: "#10251f", fontSize: 15, fontWeight: 950 }}>
                                {toTime(medication.scheduled_time)} · {medication.medication_name}
                              </strong>
                              <span style={{ display: "block", marginTop: 5, color: "#64756e", fontSize: 13, fontWeight: 850 }}>
                                {medication.dose}{medication.route?.trim() ? ` · ${medication.route}` : ""}
                              </span>
                            </div>
                            <span style={{ ...styles.statusChip, ...badgeStyle }}>{label}</span>
                          </div>
                        </article>
                      )
                    })}

                    {slot.medications.length === 0 ? (
                      <div style={{ color: "#64756e", fontSize: 13, fontWeight: 800, padding: "8px 4px" }}>
                        Šiam laikui vaistų nėra.
                      </div>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          )}

          <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <button type="button" style={styles.secondaryButton} onClick={() => void markAllSelectedPrepared()} disabled={saving}>
              Pažymėti paruošta
            </button>
            <button type="button" style={styles.primaryButton} onClick={() => setShowTaskModal(true)} disabled={saving || preparedNotGiven.length === 0}>
              Perduoti dalinimui
            </button>
            <button type="button" style={{ ...styles.secondaryButton, borderColor: "#fecaca", background: "#fff4f4", color: "#b91c1c" }} onClick={() => setShowProblemModal(true)}>
              Registruoti problemą
            </button>
          </div>
        </main>

        <aside style={{ display: "grid", gap: 14 }}>
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #dbe6e0",
              borderRadius: 22,
              padding: 20,
              boxShadow: "0 14px 34px rgba(15,23,42,.06)",
            }}
          >
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ margin: 0, color: "#10251f", fontSize: 22, fontWeight: 950, letterSpacing: "-0.03em" }}>Veiksmai dabar</h2>
              <p style={{ margin: "6px 0 0", color: "#64756e", fontSize: 13, fontWeight: 850 }}>Rodoma tik tai, ką reikia atlikti pasirinktam gyventojui.</p>
            </div>

            {visibleMedications.some((med) => !getMedicationLog(med.id, "given") && isMedicationLate(med, 30)) ? (
              <div style={{ border: "1px solid #fecaca", background: "#fff4f4", borderRadius: 22, padding: 18 }}>
                <span style={{ ...styles.statusChip, ...styles.statusRed }}>Vėluoja</span>
                <h3 style={{ margin: "14px 0 0", color: "#10251f", fontSize: 20, fontWeight: 950 }}>
                  {visibleMedications.find((med) => !getMedicationLog(med.id, "given") && isMedicationLate(med, 30))?.medication_name || "Vaistas"} dar nesuduotas
                </h3>
                <p style={{ margin: "8px 0 0", color: "#64756e", fontSize: 14, fontWeight: 850, lineHeight: 1.45 }}>
                  Patikrinkite situaciją ir patvirtinkite sudavimą arba registruokite priežastį.
                </p>
                <button
                  type="button"
                  style={{ ...styles.primaryButton, marginTop: 16 }}
                  onClick={() => {
                    const medication = visibleMedications.find((med) => !getMedicationLog(med.id, "given") && isMedicationLate(med, 30))
                    if (medication) openConfirmModal(medication)
                  }}
                  disabled={saving}
                >
                  Patvirtinti sudavimą
                </button>
              </div>
            ) : (
              <div style={styles.okBox}>
                <strong>Nėra vėluojančių veiksmų</strong>
                <span>Šiam gyventojui šiuo metu nėra vėluojančių vaistų.</span>
              </div>
            )}
          </section>

          <section
            style={{
              background: "#f4faf7",
              border: "1px solid #dbe6e0",
              borderRadius: 22,
              padding: 20,
              boxShadow: "0 14px 34px rgba(15,23,42,.05)",
            }}
          >
            <span style={{ ...styles.statusChip, ...styles.statusAmber }}>Dalinimas</span>
            <h3 style={{ margin: "14px 0 0", color: "#10251f", fontSize: 20, fontWeight: 950 }}>Paskirti darbuotoją</h3>
            <p style={{ margin: "8px 0 0", color: "#64756e", fontSize: 14, fontWeight: 850, lineHeight: 1.45 }}>
              Prieš perduodant dalinimui dozatorius sutikrinamas, tada paskiriamas atsakingas darbuotojas.
            </p>

            <select value={taskAssigneeId} onChange={(event) => setTaskAssigneeId(event.target.value)} style={{ ...styles.input, marginTop: 14 }}>
              <option value="">{employeeName(currentEmployee)}</option>
              {employees.filter((employee) => employee.user_id !== currentUserId).map((employee) => (
                <option key={employee.user_id} value={employee.user_id}>{employeeName(employee)}</option>
              ))}
            </select>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, color: "#64756e", fontSize: 13, fontWeight: 850 }}>
              <span>Dozatorių sutikrino</span>
              <strong style={{ color: "#10251f" }}>
                {prepareSecondCheckerId ? employeeName(employees.find((employee) => employee.user_id === prepareSecondCheckerId)) : "Nepasirinkta"}
              </strong>
            </div>

            <textarea
              value={taskNote}
              onChange={(event) => setTaskNote(event.target.value)}
              placeholder="Pastaba dalinančiam darbuotojui..."
              style={{ ...styles.textareaSmall, marginTop: 12 }}
            />

            <button type="button" style={{ ...styles.primaryButton, width: "100%", marginTop: 12 }} onClick={() => void createMedicationDistributionTask()} disabled={saving || preparedNotGiven.length === 0}>
              Sukurti dalinimo užduotį
            </button>
          </section>
        </aside>
      </section>

      {showAddMedicationModal ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.addMedicationModal}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.modalKicker}>Medicina</p>
                <h2 style={styles.modalTitle}>Paskirti vaistą</h2>
                <p style={styles.modalSubtitle}>Įvesk tik būtinus paskyrimo duomenis, susiek su sandėliu ir išsaugok.</p>
              </div>

              <button type="button" onClick={closeAddMedicationModal} style={styles.modalCloseButton} aria-label="Uždaryti">
                <X size={28} strokeWidth={2.1} />
              </button>
            </div>

            <div style={styles.modalBody}>
            <div style={styles.modalStep}>
              <div style={styles.stepNumber}>1</div>
              <div>
                <strong>Vaistas iš sandėlio</strong>
                <p style={styles.quickHint}>Įvesk pavadinimą arba pasirink iš istorijos.</p>
              </div>
            </div>

            <div style={styles.quickBox}>
              <input
                style={styles.input}
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                placeholder="Ieškoti vaisto sandėlyje..."
              />

              {inventorySearch.trim().length === 0 ? (
                <div style={styles.emptySmall}>Įvesk vaisto pavadinimą, pvz. „ibu“, „lašai“, „tablet“.</div>
              ) : filteredInventoryItems.length === 0 ? (
                <div style={styles.emptySmall}>Vaistų sandėlyje nerasta. Galima įrašyti pavadinimą ranka.</div>
              ) : (
                <div style={styles.quickList}>
                  {filteredInventoryItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      style={{
                        ...styles.quickItem,
                        ...(medForm.inventory_item_id === item.id ? styles.quickItemActive : {}),
                      }}
                      onClick={() => {
                        applyInventoryItem(item)
                        setInventorySearch(inventoryName(item))
                      }}
                    >
                      <strong>{inventoryName(item)}</strong>
                      <span>
                        Likutis: {inventoryQuantity(item) ?? "—"} {item.unit || ""}{item.category ? ` · ${item.category}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {medicationTemplates.length > 0 ? (
              <div style={styles.quickBox}>
                <strong>Greitas pasirinkimas iš istorijos</strong>
                <div style={styles.templateChips}>
                  {medicationTemplates.slice(0, 8).map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      style={styles.templateChip}
                      onClick={() => applyMedicationTemplate(template)}
                    >
                      {template.medication_name} · {template.dose}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={styles.modalStep}>
              <div style={styles.stepNumber}>2</div>
              <div>
                <strong>Pagrindiniai duomenys</strong>
                <p style={styles.quickHint}>Privalomi laukai pažymėti *.</p>
              </div>
            </div>

            <div style={styles.modalFormGrid}>
              <Field label="Vaistas *">
                <input style={styles.input} value={medForm.medication_name} onChange={(e) => setMedForm({ ...medForm, medication_name: e.target.value })} placeholder="Pvz. Ibuprofen" />
              </Field>

              <Field label="Dozė *">
                <input style={styles.input} value={medForm.dose} onChange={(e) => setMedForm({ ...medForm, dose: e.target.value })} placeholder="Pvz. 200 mg" />
              </Field>

              <Field label="Laikas">
                <input type="time" style={styles.input} value={medForm.scheduled_time} onChange={(e) => setMedForm({ ...medForm, scheduled_time: e.target.value })} />
              </Field>

              <Field label="Paskyrimo šaltinis *">
                <input style={styles.input} value={medForm.prescription_source} onChange={(e) => setMedForm({ ...medForm, prescription_source: e.target.value })} placeholder="Pvz. gydytojo / slaugytojo paskyrimas" />
              </Field>

              <Field label="Sandėlio prekė *">
                <select style={styles.input} value={medForm.inventory_item_id} onChange={(e) => setMedForm({ ...medForm, inventory_item_id: e.target.value })}>
                  <option value="">Pasirinkti</option>
                  {inventoryItems
                    .filter((item) => looksLikeMedicationInventoryItem(item))
                    .sort((a, b) => inventoryName(a).localeCompare(inventoryName(b), "lt"))
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {inventoryName(item)} · likutis: {inventoryQuantity(item) ?? "—"} {item.unit || ""}
                      </option>
                    ))}
                </select>
              </Field>

              <Field label="Nurašyti per dozę">
                <input type="number" min="0.001" step="0.001" style={styles.input} value={medForm.inventory_units_per_dose} onChange={(e) => setMedForm({ ...medForm, inventory_units_per_dose: e.target.value })} />
              </Field>
            </div>

            <div style={{ marginTop: 16, border: "1px solid #dbe6e0", background: "#f8fbfa", borderRadius: 22, padding: 16 }}>
              <div style={{ color: "#08785f", fontSize: 12, fontWeight: 950, letterSpacing: ".14em", textTransform: "uppercase" }}>
                Vaisto vartojimo grafikas
              </div>
              <p style={{ margin: "6px 0 14px", color: "#64756e", fontSize: 13, fontWeight: 800 }}>
                Pagal šiuos nustatymus vaistas automatiškai rodomas dozatoriaus sąraše.
              </p>

              <div style={styles.modalFormGrid}>
                <Field label="Kartojimas">
                  <select
                    style={styles.input}
                    value={medForm.schedule_frequency}
                    onChange={(e) =>
                      setMedForm({
                        ...medForm,
                        schedule_frequency: e.target.value,
                        is_prn: e.target.value === "as_needed" ? true : medForm.is_prn,
                      })
                    }
                  >
                    <option value="daily">Kasdien</option>
                    <option value="custom">Pagal grafiką</option>
                    <option value="as_needed">Pagal poreikį</option>
                  </select>
                </Field>

                <Field label="Nuo datos">
                  <input
                    type="date"
                    style={styles.input}
                    value={medForm.schedule_start_date}
                    onChange={(e) => setMedForm({ ...medForm, schedule_start_date: e.target.value })}
                  />
                </Field>

                <Field label="Iki datos">
                  <input
                    type="date"
                    style={styles.input}
                    value={medForm.schedule_end_date}
                    onChange={(e) => setMedForm({ ...medForm, schedule_end_date: e.target.value })}
                  />
                </Field>
              </div>

              {medForm.schedule_frequency === "custom" ? (
                <div style={{ marginTop: 12, border: "1px solid #f1dfb7", background: "#fff8e8", borderRadius: 18, padding: 12, color: "#8a5c08", fontSize: 13, fontWeight: 850 }}>
                  Pagal grafiką: kol kas išsaugoma prie paskyrimo instrukcijos. Vėliau galima prijungti atskirą savaitės dienų lentelę duomenų bazėje.
                </div>
              ) : null}
            </div>

            {medForm.inventory_item_id && selectedMedicationStock.blocksAction ? (
              <div style={styles.stockDangerBox}>
                <AlertTriangle size={19} />
                <div>
                  <strong>Nepakankamas likutis</strong>
                  <p>
                    Negalima paskirti šio vaisto, nes sandėlyje yra {inventoryQuantity(selectedInventoryForForm) ?? "—"},
                    o vienai dozei reikia {selectedInventoryUnitsPerDose}. Pirmiausia papildyk sandėlį arba pasirink kitą prekę.
                  </p>
                </div>
              </div>
            ) : medForm.inventory_item_id && (selectedMedicationStock.level === "low" || selectedMedicationStock.level === "critical") ? (
              <div style={styles.stockWarningBox}>
                <AlertTriangle size={19} />
                <div>
                  <strong>{selectedMedicationStock.label}</strong>
                  <p>Vaistą galima paskirti, bet po paskyrimo verta suplanuoti papildymą.</p>
                </div>
              </div>
            ) : null}

            <button type="button" style={styles.moreButton} onClick={() => setShowAdvancedMedicationSettings((value) => !value)}>
              {showAdvancedMedicationSettings ? "Slėpti papildomus nustatymus" : "Daugiau nustatymų"}
            </button>

            {showAdvancedMedicationSettings ? (
              <div style={styles.advancedBox}>
                <div style={styles.modalFormGrid}>
                  <Field label="Vartojimo būdas">
                    <input style={styles.input} value={medForm.route} onChange={(e) => setMedForm({ ...medForm, route: e.target.value })} placeholder="Pvz. per burną" />
                  </Field>

                  <Field label="Paskyrė">
                    <input style={styles.input} value={medForm.prescribed_by} onChange={(e) => setMedForm({ ...medForm, prescribed_by: e.target.value })} placeholder="Pvz. gyd. Vardenis Pavardenis" />
                  </Field>

                  <Field label="Paskyrimo data">
                    <input type="date" style={styles.input} value={medForm.prescription_date} onChange={(e) => setMedForm({ ...medForm, prescription_date: e.target.value })} />
                  </Field>
                </div>

                <div style={styles.checkGrid}>
                  <label style={styles.checkboxRow}>
                    <input type="checkbox" checked={medForm.is_fractional} onChange={(e) => setMedForm({ ...medForm, is_fractional: e.target.checked })} />
                    Dalinė dozė
                  </label>

                  <label style={styles.checkboxRow}>
                    <input type="checkbox" checked={medForm.is_external} onChange={(e) => setMedForm({ ...medForm, is_external: e.target.checked })} />
                    Išorinis vaistas
                  </label>

                  <label style={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={medForm.is_prn}
                      onChange={(e) => setMedForm({ ...medForm, is_prn: e.target.checked, schedule_frequency: e.target.checked ? "as_needed" : medForm.schedule_frequency })}
                    />
                    Pagal poreikį
                  </label>

                  <label style={styles.checkboxRow}>
                    <input type="checkbox" checked={medForm.requires_double_check} onChange={(e) => setMedForm({ ...medForm, requires_double_check: e.target.checked })} />
                    Reikalinga 2 darbuotojų patikra
                  </label>
                </div>

                <Field label="Instrukcija">
                  <textarea style={styles.textareaSmall} value={medForm.instructions} onChange={(e) => setMedForm({ ...medForm, instructions: e.target.value })} placeholder="Nebūtina" />
                </Field>

                <Field label="Saugumo pastabos">
                  <textarea style={styles.textareaSmall} value={medForm.safety_notes} onChange={(e) => setMedForm({ ...medForm, safety_notes: e.target.value })} placeholder="Nebūtina" />
                </Field>
              </div>
            ) : null}

            </div>

            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={closeAddMedicationModal}>
                Atšaukti
              </button>

              <button
                type="button"
                style={canSaveMedicationFromModal ? styles.primaryButton : styles.disabledButton}
                onClick={() => void saveMedicationFromModal()}
                disabled={!canSaveMedicationFromModal}
              >
                <Plus size={16} />
                Išsaugoti vaistą
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showVitalsModal ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.modalKicker}>Sveikatos rodikliai</p>
                <h2 style={styles.modalTitle}>Įvesti rodiklius</h2>
                <p style={styles.modalSubtitle}>{residentName(selected, roomsById)}</p>
              </div>
              <button type="button" onClick={() => setShowVitalsModal(false)} style={styles.modalCloseButton} aria-label="Uždaryti">
                <X size={28} strokeWidth={2.1} />
              </button>
            </div>

            <VitalsStepper label="Sistolinis" value={newVitals.bp_sys} onMinus={() => setVitalsButton("bp_sys", -1)} onPlus={() => setVitalsButton("bp_sys", 1)} />
            <VitalsStepper label="Diastolinis" value={newVitals.bp_dia} onMinus={() => setVitalsButton("bp_dia", -1)} onPlus={() => setVitalsButton("bp_dia", 1)} />
            <VitalsStepper label="Pulsas" value={newVitals.pulse} onMinus={() => setVitalsButton("pulse", -1)} onPlus={() => setVitalsButton("pulse", 1)} />
            <VitalsStepper label="Cukrus" value={newVitals.sugar} onMinus={() => setVitalsButton("sugar", -0.1)} onPlus={() => setVitalsButton("sugar", 0.1)} />
            <VitalsStepper label="Temperatūra" value={newVitals.temperature} onMinus={() => setVitalsButton("temperature", -0.1)} onPlus={() => setVitalsButton("temperature", 0.1)} />
            <VitalsStepper label="Svoris" value={newVitals.weight} onMinus={() => setVitalsButton("weight", -0.1)} onPlus={() => setVitalsButton("weight", 0.1)} />

            <textarea style={styles.textareaSmall} value={newVitals.notes} onChange={(e) => setNewVitals({ ...newVitals, notes: e.target.value })} placeholder="Pastaba..." />

            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => setShowVitalsModal(false)}>Atšaukti</button>
              <button type="button" style={styles.primaryButton} onClick={() => void addVitals()} disabled={saving}>Išsaugoti</button>
            </div>
          </div>
        </div>
      ) : null}

      {showPrepareModal && prepareMedication ? (() => {
        const medicationsToPrepare = prepareMedicationList.length ? prepareMedicationList : [prepareMedication]
        const stockRows = medicationsToPrepare.map((medication) => {
          const stockItem = inventoryItems.find((item) => item.id === medication.inventory_item_id) || null
          const stock = medicationStockStatus(stockItem, medication.inventory_units_per_dose || 1)
          return { medication, stockItem, stock }
        })
        const blockedStockRows = stockRows.filter((row) => row.stock.blocksAction)
        const attentionStockRows = stockRows.filter(
          (row) => row.stock.level === "low" || row.stock.level === "critical" || row.stock.level === "empty",
        )
        const needsSecondCheck = medicationsToPrepare.some((medication) => medication.requires_double_check)
        const canPrepare = Boolean(
          prepareAcknowledged &&
            blockedStockRows.length === 0 &&
            (!needsSecondCheck || prepareSecondCheckerId) &&
            !saving,
        )
        const closePrepareModal = () => {
          setShowPrepareModal(false)
          setPrepareMedication(null)
          setPrepareMedicationList([])
          setPrepareAcknowledged(false)
          setPrepareSecondCheckerId("")
        }

        return (
          <div style={styles.modalBackdrop}>
            <div style={styles.giveConfirmModal}>
              <div style={styles.giveConfirmHeader}>
                <div>
                  <p style={styles.modalKicker}>Medicina</p>
                  <h2 style={styles.giveConfirmTitle}>Patvirtinti paruošimą</h2>
                  <p style={styles.giveConfirmSubtitle}>
                    Vienas atsakomybės patvirtinimas visiems dozatoriuje ruošiamiems vaistams.
                  </p>
                </div>

                <button type="button" onClick={closePrepareModal} style={styles.giveConfirmClose}>
                  <X size={28} strokeWidth={2.1} />
                </button>
              </div>

              <div style={styles.giveDivider} />

              <div style={styles.giveIdentityCard}>
                <div style={styles.giveAvatar}>{residentInitials(selected)}</div>

                <div style={styles.giveIdentityMain}>
                  <div style={styles.giveLabel}>Gyventojas</div>
                  <h3 style={styles.giveResidentName}>{residentName(selected, roomsById)}</h3>
                  <p style={styles.giveMedicationLine}>
                    {medicationsToPrepare.length} vaist. paruošimui · dozatorius / dalinimas
                  </p>
                </div>
              </div>

              <div style={styles.giveMedicationList}>
                <div style={styles.giveMedicationListHeader}>
                  <span>Vaistas</span>
                  <span>Dozė</span>
                  <span>Laikas</span>
                  <span>Būdas</span>
                  <span>Sandėlis</span>
                </div>

                {stockRows.map(({ medication, stockItem }) => (
                  <div key={medication.id} style={styles.giveMedicationListRow}>
                    <strong>{medication.medication_name}</strong>
                    <strong>{medication.dose}</strong>
                    <strong>{toTime(medication.scheduled_time)}</strong>
                    <strong>{medication.route || "—"}</strong>
                    <strong>
                      {stockItem
                        ? `${inventoryName(stockItem)} · ${inventoryQuantity(stockItem) ?? "—"} ${stockItem.unit || ""} · paruošimui ${medication.inventory_units_per_dose || 1}`
                        : "Nesusieta"}
                    </strong>
                  </div>
                ))}
              </div>

              {attentionStockRows.length > 0 ? (
                <div style={blockedStockRows.length > 0 ? styles.stockDangerBox : styles.stockWarningBox}>
                  <AlertTriangle size={19} />
                  <div>
                    <strong>{blockedStockRows.length > 0 ? "Nepakankamas likutis" : "Likutis kritinis"}</strong>
                    <p>
                      {blockedStockRows.length > 0
                        ? "Paruošimas blokuojamas, nes bent vieno vaisto sandėlyje nėra arba jo nepakanka pasirinktai dozei."
                        : "Vaistas artėja prie pabaigos. Po paruošimo suplanuok papildymo užduotį arba informuok atsakingą darbuotoją."}
                    </p>
                  </div>
                </div>
              ) : null}

              {needsSecondCheck ? (
                <div style={styles.secondCheckBox}>
                  <ShieldAlert size={19} />
                  <div style={{ flex: 1 }}>
                    <strong>Reikalinga antro darbuotojo patikra</strong>
                    <select style={{ ...styles.input, marginTop: 10 }} value={prepareSecondCheckerId} onChange={(e) => setPrepareSecondCheckerId(e.target.value)}>
                      <option value="">Pasirinkti sutikrinusį darbuotoją</option>
                      {employees
                        .filter((employee) => employee.user_id !== currentUserId)
                        .map((employee) => (
                          <option key={employee.user_id} value={employee.user_id}>
                            {employeeName(employee)}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              ) : null}

              <div
                style={{
                    border: "1px solid #dbe6e0",
                    background: "#f8fbf9",
                    borderRadius: 16,
                    padding: 14,
                    margin: "0 34px 18px",
                  }}
                >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      background: "#e7f6ef",
                      color: "#047857",
                      display: "grid",
                      placeItems: "center",
                      flex: "0 0 auto",
                    }}
                  >
                    <ShieldCheck size={18} />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        color: "#047857",
                        fontSize: 13,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                      }}
                    >
                      Patikrinimas prieš paruošimą
                    </p>
                    <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 13, fontWeight: 600 }}>
                      Prieš pažymint dozatorių paruoštu patvirtink būtinas saugos patikras.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  {[
                    "Gyventojo tapatybė",
                    "Vaistų pavadinimai ir dozės",
                    "Laikas ir vartojimo būdas",
                    "Paskyrimo šaltinis",
                  ].map((item) => (
                    <div
                      key={item}
                      style={{
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                        borderRadius: 12,
                        padding: "9px 10px",
                        color: "#334155",
                        fontSize: 13,
                        fontWeight: 600,
                        lineHeight: 1.25,
                      }}
                    >
                      ✓ {item}
                    </div>
                  ))}
                </div>

                <label
                  style={{
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    border: prepareAcknowledged ? "1px solid #10b981" : "1px solid #f1d38c",
                    background: prepareAcknowledged ? "#ecfdf5" : "#fff8e7",
                    borderRadius: 14,
                    padding: "11px 12px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={prepareAcknowledged}
                    onChange={(event) => setPrepareAcknowledged(event.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "#059669", flex: "0 0 auto" }}
                  />

                  <span style={{ color: "#334155", fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>
                    Patvirtinu, kad patikrinau ir galiu saugiai paruošti vaistus dalinimui.
                  </span>
                </label>
              </div>

              <div style={styles.giveDivider} />

              <div style={styles.modalActions}>
                <button type="button" style={styles.secondaryButton} onClick={closePrepareModal}>
                  Atšaukti
                </button>

                <button
                  type="button"
                  style={canPrepare ? styles.primaryButton : styles.disabledButton}
                  disabled={!canPrepare}
                  onClick={() => void confirmPreparedList()}
                >
                  <Check size={16} />
                  {saving ? "Saugoma..." : "Patvirtinti paruošimą"}
                </button>
              </div>
            </div>
          </div>
        )
      })() : null}

      {showTaskModal ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.taskModal}>
            <div style={styles.taskModalHeader}>
              <div>
                <div style={styles.taskModalKicker}>Dalinimo užduotis</div>
                <h2 style={styles.taskModalTitle}>{residentShortName(selected)} · {roomsById[selected.current_room_id || ""] || "—"}</h2>
                <p style={styles.taskModalSubtitle}>Paruošti vaistai perduodami atsakingam darbuotojui sudavimui.</p>
              </div>
              <button type="button" onClick={() => setShowTaskModal(false)} style={styles.taskModalCloseButton}>
                <X size={22} strokeWidth={2.2} />
              </button>
            </div>

            <div style={styles.taskModalBody}>
              <div style={styles.taskSummaryCard}>
                <div>
                  <strong>Paruoštų dalinimui</strong>
                  <span>{preparedNotGiven.length} vaistai</span>
                </div>
                <div style={styles.taskSummaryPill}>Šiandien</div>
              </div>

              {preparedNotGiven.length > 0 ? (
                <div style={styles.taskMedicineList}>
                  {preparedNotGiven.map((medication) => (
                    <div key={medication.id} style={styles.taskMedicineItem}>
                      <strong>{toTime(medication.scheduled_time)} · {medication.medication_name}</strong>
                      <span>{medication.dose}{medication.route ? ` · ${medication.route}` : ""}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.emptySmall}>Šiuo metu nėra paruoštų vaistų, kuriuos galima perduoti dalinimui.</div>
              )}

              <Field label="Atsakingas darbuotojas">
                <select style={styles.input} value={taskAssigneeId} onChange={(e) => setTaskAssigneeId(e.target.value)}>
                  <option value="">Priskirti sau</option>
                  {employees.filter((employee) => employee.user_id !== currentUserId).map((employee) => (
                    <option key={employee.user_id} value={employee.user_id}>
                      {employeeName(employee)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Pastaba">
                <textarea style={styles.textareaCompact} value={taskNote} onChange={(e) => setTaskNote(e.target.value)} placeholder="Papildoma informacija dalinančiam darbuotojui..." />
              </Field>
            </div>

            <div style={styles.taskModalFooter}>
              <button type="button" style={styles.secondaryButton} onClick={() => setShowTaskModal(false)}>
                Atšaukti
              </button>
              <button type="button" style={styles.primaryButton} onClick={() => void createMedicationDistributionTask()} disabled={saving || preparedNotGiven.length === 0}>
                {saving ? "Saugoma..." : "Sukurti užduotį"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showProblemModal ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.taskModal}>
            <div style={styles.taskModalHeaderDanger}>
              <div>
                <div style={styles.taskModalKicker}>Registruoti problemą</div>
                <h2 style={styles.taskModalTitle}>{residentShortName(selected)} · {roomsById[selected.current_room_id || ""] || "—"}</h2>
                <p style={styles.taskModalSubtitle}>Problema bus išsaugota kaip aukšto prioriteto medicinos užduotis.</p>
              </div>
              <button type="button" onClick={() => setShowProblemModal(false)} style={styles.taskModalCloseButton}>
                <X size={22} strokeWidth={2.2} />
              </button>
            </div>

            <div style={styles.taskModalBody}>
              <Field label="Vaistas">
                <select style={styles.input} value={problemMedicationId} onChange={(e) => setProblemMedicationId(e.target.value)}>
                  <option value="">Pasirinkti vaistą arba palikti bendrą problemą</option>
                  {selectedMedications.map((medication) => (
                    <option key={medication.id} value={medication.id}>
                      {toTime(medication.scheduled_time)} · {medication.medication_name} · {medication.dose}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Problemos aprašymas">
                <textarea
                  style={styles.textareaCompact}
                  value={problemNote}
                  onChange={(e) => setProblemNote(e.target.value)}
                  placeholder="Pvz., gyventojas atsisakė, vaisto nėra dozatoriuje, neaiškus paskyrimas, trūksta likučio..."
                />
              </Field>
            </div>

            <div style={styles.taskModalFooter}>
              <button type="button" style={styles.secondaryButton} onClick={() => setShowProblemModal(false)}>
                Atšaukti
              </button>
              <button type="button" style={{ ...styles.primaryButton, background: "#b91c1c" }} onClick={() => void createMedicationProblemTask()} disabled={saving || !problemNote.trim()}>
                {saving ? "Saugoma..." : "Registruoti problemą"}
              </button>
            </div>
          </div>
        </div>
      ) : null}



{showHistoryModal ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.historyModal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Istorija ir eksportas</h2>
                <p style={styles.subtitle}>{residentName(selected, roomsById)}</p>
              </div>
              <button type="button" onClick={() => setShowHistoryModal(false)} style={styles.modalCloseButton}>
                <X size={28} strokeWidth={2.1} />
              </button>
            </div>

            <div style={styles.historyFilters}>
              <Field label="Nuo">
                <input type="date" style={styles.input} value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
              </Field>

              <Field label="Iki">
                <input type="date" style={styles.input} value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
              </Field>

              <Field label="Tipas">
                <select style={styles.input} value={historyType} onChange={(e) => setHistoryType(e.target.value as "all" | "medications" | "vitals" | "prn")}>
                  <option value="all">Visi</option>
                  <option value="medications">Vaistai</option>
                  <option value="vitals">Rodikliai</option>
                  <option value="prn">p.r.n.</option>
                </select>
              </Field>
            </div>

            <div style={styles.historyTableWrap}>
              <div style={styles.historyGrid}>
                <div style={styles.historyHeaderRow}>
                  <span>Tipas</span>
                  <span>Data</span>
                  <span>Pavadinimas</span>
                  <span>Dozė / rodikliai</span>
                  <span>Statusas</span>
                  <span>Pastaba</span>
                </div>

                <div style={styles.historyGridBody}>
                  {historyRows().map((row, index) => (
                    <div key={`${row.tipas}-${row.data}-${index}`} style={styles.historyRow}>
                      <span>{historyCellValue(row.tipas)}</span>
                      <span>{historyCellValue(row.data)}</span>
                      <span>{historyCellValue(row.pavadinimas)}</span>
                      <span>{historyCellValue(row.doze)}</span>
                      <span>{historyCellValue(row.statusas)}</span>
                      <span>{historyCellValue(row.pastaba)}</span>
                    </div>
                  ))}

                  {historyRows().length === 0 ? <div style={styles.empty}>Įrašų nerasta.</div> : null}
                </div>
              </div>

              {historyRows().length === 0 ? <div style={styles.emptySmall}>Pasirinktu laikotarpiu įrašų nėra.</div> : null}
            </div>

            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => window.print()}>
                Spausdinti / PDF
              </button>
              <button type="button" style={styles.primaryButton} onClick={downloadHistoryCsv} disabled={historyRows().length === 0}>
                Atsisiųsti CSV
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmMedication ? (() => {
        const stockItem = inventoryItems.find((item) => item.id === confirmMedication.inventory_item_id)
        const stock = medicationStockStatus(stockItem, confirmMedication.inventory_units_per_dose || 1)
        const blocksBecauseStock = stock.blocksAction
        const needsSecondCheck = Boolean(confirmMedication.requires_double_check)
        const canConfirm = allConfirmChecksOk && !blocksBecauseStock && (!needsSecondCheck || Boolean(secondCheckerId)) && !saving

        return (
          <div style={styles.modalBackdrop}>
            <div style={styles.giveConfirmModal}>
              <div style={styles.giveConfirmHeader}>
                <div>
                  <p style={styles.modalKicker}>Medicina</p>
                  <h2 style={styles.giveConfirmTitle}>Patvirtinti sudavimą</h2>
                  <p style={styles.giveConfirmSubtitle}>
                    Vienas trumpas atsakomybės patvirtinimas.
                  </p>
                </div>

                <button type="button" onClick={() => setConfirmMedication(null)} style={styles.giveConfirmClose}>
                  <X size={28} strokeWidth={2.1} />
                </button>
              </div>

              <div style={styles.giveDivider} />

              <div style={styles.giveIdentityCard}>
                <div style={styles.giveAvatar}>{residentInitials(selected)}</div>

                <div style={styles.giveIdentityMain}>
                  <div style={styles.giveLabel}>Gyventojas</div>
                  <h3 style={styles.giveResidentName}>{residentName(selected, roomsById)}</h3>
                  <p style={styles.giveMedicationLine}>
                    {confirmMedication.medication_name} · {confirmMedication.dose} · {toTime(confirmMedication.scheduled_time)}
                  </p>
                </div>
              </div>

              <div style={styles.giveMedicationList}>
                <div style={styles.giveMedicationListHeader}>
                  <span>Vaistas</span>
                  <span>Dozė</span>
                  <span>Laikas</span>
                  <span>Būdas</span>
                  <span>Sandėlis</span>
                </div>

                <div style={styles.giveMedicationListRow}>
                  <strong>{confirmMedication.medication_name}</strong>
                  <strong>{confirmMedication.dose}</strong>
                  <strong>{toTime(confirmMedication.scheduled_time)}</strong>
                  <strong>{confirmMedication.route || "—"}</strong>
                  <strong>
                    {stockItem ? `${inventoryName(stockItem)} · ${inventoryQuantity(stockItem) ?? "—"} ${stockItem.unit || ""} · nurašoma ${confirmMedication.inventory_units_per_dose || 1}` : "Nesusieta"}
                  </strong>
                </div>
              </div>

              {(stock.level === "low" || stock.level === "critical" || stock.level === "empty") ? (
                <div style={stock.level === "empty" ? styles.stockDangerBox : styles.stockWarningBox}>
                  <AlertTriangle size={19} />
                  <div>
                    <strong>{stock.label}</strong>
                    <p>
                      {stock.level === "empty"
                        ? "Sudavimas blokuojamas, nes sandėlyje nėra pakankamo likučio."
                        : "Vaistas artėja prie pabaigos. Po sudavimo reikėtų sukurti papildymo užduotį arba informuoti atsakingą darbuotoją."}
                    </p>
                  </div>
                </div>
              ) : null}

              {needsSecondCheck ? (
                <div style={styles.secondCheckBox}>
                  <ShieldAlert size={19} />
                  <div style={{ flex: 1 }}>
                    <strong>Reikalinga antro darbuotojo patikra</strong>
                    <select style={{ ...styles.input, marginTop: 10 }} value={secondCheckerId} onChange={(e) => setSecondCheckerId(e.target.value)}>
                      <option value="">Pasirinkti sutikrinusį darbuotoją</option>
                      {employees
                        .filter((employee) => employee.user_id !== currentUserId)
                        .map((employee) => (
                          <option key={employee.user_id} value={employee.user_id}>
                            {employeeName(employee)}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {confirmMedication.safety_notes || confirmMedication.instructions ? (
                <div style={styles.giveNoteBox}>
                  <strong>Pastabos</strong>
                  <p>{confirmMedication.safety_notes || confirmMedication.instructions}</p>
                </div>
              ) : null}

              <div
                style={{
                    border: "1px solid #dbe6e0",
                    background: "#f8fbf9",
                    borderRadius: 16,
                    padding: 14,
                    margin: "0 34px 18px",
                  }}
                >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      background: "#e7f6ef",
                      color: "#047857",
                      display: "grid",
                      placeItems: "center",
                      flex: "0 0 auto",
                    }}
                  >
                    <ShieldCheck size={18} />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        color: "#047857",
                        fontSize: 13,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                      }}
                    >
                      Patikrinimas prieš sudavimą
                    </p>
                    <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 13, fontWeight: 600 }}>
                      Prieš nurašymą patvirtink tik būtinas saugos patikras.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  {[
                    "Gyventojo tapatybė",
                    "Vaisto pavadinimas ir dozė",
                    "Laikas ir vartojimo būdas",
                    "Galiojimas ir paskyrimas",
                  ].map((item) => (
                    <div
                      key={item}
                      style={{
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                        borderRadius: 12,
                        padding: "9px 10px",
                        color: "#334155",
                        fontSize: 13,
                        fontWeight: 600,
                        lineHeight: 1.25,
                      }}
                    >
                      ✓ {item}
                    </div>
                  ))}
                </div>

                <label
                  style={{
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    border: confirmChecks.responsibility_acknowledged ? "1px solid #10b981" : "1px solid #f1d38c",
                    background: confirmChecks.responsibility_acknowledged ? "#ecfdf5" : "#fff8e7",
                    borderRadius: 14,
                    padding: "11px 12px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={confirmChecks.responsibility_acknowledged}
                    onChange={(event) =>
                      setConfirmChecks({
                        ...confirmChecks,
                        responsibility_acknowledged: event.target.checked,
                      })
                    }
                    style={{ width: 18, height: 18, accentColor: "#059669", flex: "0 0 auto" }}
                  />

                  <span style={{ color: "#334155", fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>
                    Patvirtinu, kad patikrinau ir galiu saugiai suduoti vaistą.
                  </span>
                </label>
              </div>

              <textarea style={styles.giveTextarea} value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} placeholder="Papildoma pastaba..." />

              <div style={styles.giveDivider} />

              <div style={styles.modalActions}>
                <button type="button" style={styles.secondaryButton} onClick={() => setConfirmMedication(null)}>
                  Atšaukti
                </button>

                <button
                  type="button"
                  style={canConfirm ? styles.primaryButton : styles.disabledButton}
                  onClick={() => void confirmGivenSafely()}
                  disabled={!canConfirm}
                >
                  <Check size={16} />
                  Patvirtinti ir nurašyti
                </button>
              </div>
            </div>
          </div>
        )
      })() : null}
    </div>
  )
}

function ActionCard({
  title,
  text,
  button,
  onClick,
}: {
  title: string
  text: string
  button: string
  onClick: () => void
}) {
  return (
    <button type="button" style={styles.actionCard} onClick={onClick}>
      <strong>{title}</strong>
      <span>{text}</span>
      <em>{button}</em>
    </button>
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

function ConfirmCheck({
  label,
  checked,
  onChange,
  danger,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  danger?: boolean
}) {
  return (
    <label style={{ ...styles.confirmCheck, ...(danger ? styles.confirmCheckDanger : {}) }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function SmallStat({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div style={{ ...styles.smallStat, ...(danger ? styles.smallStatDanger : {}) }}>
      <div style={styles.meta}>{label}</div>
      <strong>{value}</strong>
    </div>
  )
}

function VitalsStepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string
  value: number
  onMinus: () => void
  onPlus: () => void
}) {
  return (
    <div style={styles.stepper}>
      <div>{label}</div>
      <button type="button" style={styles.stepButton} onClick={onMinus}>−</button>
      <strong>{value}</strong>
      <button type="button" style={styles.stepButton} onClick={onPlus}>+</button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f3f6f4", padding: 24, color: "#10251f", maxWidth: 1500, margin: "0 auto", fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif" },
  topShell: {
    marginBottom: 18,
    overflow: "visible",
    border: "1px solid #c9d8d0",
    borderRadius: 14,
    background: "#eef4f1",
    boxShadow: "0 8px 18px rgba(15,23,42,.06)",
  },
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    background: "#486b5d",
    color: "#ffffff",
    padding: "22px 22px 18px",
  },
  heroKicker: {
    color: "rgba(255,255,255,.72)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.18em",
  },
  heroTitle: {
    margin: "8px 0 0",
    color: "#ffffff",
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "-0.035em",
    lineHeight: 1.08,
  },
  heroSubtitle: {
    margin: "8px 0 0",
    maxWidth: 900,
    color: "rgba(255,255,255,.84)",
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.45,
  },
  shiftBadgeRow: {
    marginTop: 12,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  shiftBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "7px 11px",
    background: "rgba(255,255,255,.16)",
    border: "1px solid rgba(255,255,255,.22)",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 900,
  },
  shiftBadgeDanger: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "7px 11px",
    background: "#fff4f4",
    border: "1px solid #fecaca",
    color: "#b42318",
    fontSize: 13,
    fontWeight: 900,
  },
  heroActionsTeam: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
  },
  heroWhiteButton: {
    height: 42,
    border: "1px solid rgba(255,255,255,.72)",
    background: "#ffffff",
    color: "#486b5d",
    borderRadius: 9,
    padding: "0 15px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(15,23,42,.08)",
  },
  heroGhostButton: {
    height: 42,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.12)",
    color: "#ffffff",
    borderRadius: 9,
    padding: "0 15px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  heroWorkbar: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 520px) minmax(0, 1fr)",
    gap: 12,
    alignItems: "stretch",
    padding: "0 14px 14px",
    background: "#486b5d",
    position: "relative",
    zIndex: 8,
  },
  topResidentSearch: {
    position: "relative",
    minHeight: 54,
    border: "1px solid rgba(255,255,255,.26)",
    background: "#ffffff",
    color: "#10251f",
    borderRadius: 16,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 10px 24px rgba(15,23,42,.12)",
  },
  topResidentSearchInput: {
    width: "100%",
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#10251f",
    fontSize: 14,
    fontWeight: 800,
  },
  topResidentResults: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "calc(100% + 8px)",
    zIndex: 50,
    overflow: "hidden",
    border: "1px solid #dbe6e0",
    borderRadius: 14,
    background: "#ffffff",
    boxShadow: "0 22px 55px rgba(15,35,29,.18)",
  },
  topResidentOption: {
    width: "100%",
    border: "none",
    borderBottom: "1px solid #e7eee9",
    background: "#ffffff",
    color: "#10251f",
    padding: "12px 14px",
    display: "grid",
    gridTemplateColumns: "42px 1fr",
    gap: 12,
    alignItems: "center",
    textAlign: "left",
    cursor: "pointer",
  },
  topResidentOptionActive: {
    background: "#eef8f3",
  },
  topResidentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    background: "#eef4f1",
    color: "#047857",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  topResidentOptionText: {
    minWidth: 0,
    display: "grid",
    gap: 2,
  },
  topResidentEmpty: {
    padding: "14px 16px",
    color: "#64756e",
    fontSize: 14,
    fontWeight: 800,
  },
  moduleNavBar: {
    minHeight: 54,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: 8,
    background: "#eef4f1",
    border: "1px solid #c9d8d0",
    borderRadius: 16,
  },
  moduleNavList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  moduleNavButton: {
    height: 40,
    border: "1px solid transparent",
    background: "transparent",
    color: "#486b5d",
    borderRadius: 12,
    padding: "0 12px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  moduleNavButtonActive: {
    height: 42,
    border: "1px solid #c4d5cd",
    background: "#ffffff",
    color: "#2f5d50",
    borderRadius: 13,
    padding: "0 14px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 7px 14px rgba(15,23,42,.08)",
  },
  moduleNavRight: {
    marginLeft: "auto",
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
  moduleSmallButton: {
    height: 38,
    border: "1px solid #c9d8d0",
    background: "#ffffff",
    color: "#486b5d",
    borderRadius: 9,
    padding: "0 12px",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  moduleSmallButtonActive: {
    height: 38,
    border: "1px solid #047857",
    background: "#047857",
    color: "#ffffff",
    borderRadius: 9,
    padding: "0 12px",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  dashboardStatsGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
  },
  dashboardStatCard: {
    background: "#ffffff",
    border: "1px solid #dbe6e0",
    borderRadius: 16,
    padding: 22,
    display: "grid",
    gridTemplateColumns: "58px 1fr",
    gap: 16,
    alignItems: "center",
    boxShadow: "0 8px 18px rgba(15,23,42,.05)",
  },
  statIconGreen: { width: 52, height: 52, borderRadius: 16, background: "#eef4f1", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center" },
  statIconAmber: { width: 52, height: 52, borderRadius: 16, background: "#fff9e8", color: "#8a5a13", display: "flex", alignItems: "center", justifyContent: "center" },
  statIconRed: { width: 52, height: 52, borderRadius: 16, background: "#fff4f4", color: "#b91c1c", display: "flex", alignItems: "center", justifyContent: "center" },
  statLabel: { color: "#526174", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em" },
  statValue: { marginTop: 4, color: "#10251f", fontSize: 34, fontWeight: 800, lineHeight: 1 },
  statText: { marginTop: 8, color: "#3e4b5f", fontSize: 14, fontWeight: 800 },
  selectedResidentSummary: {
    marginTop: 16,
    background: "#ffffff",
    border: "1px solid #dbe6e0",
    borderRadius: 14,
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "center",
    boxShadow: "0 8px 18px rgba(15,23,42,.05)",
  },
  selectedResidentMain: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    minWidth: 0,
  },
  selectedResidentAvatar: {
    width: 58,
    height: 58,
    borderRadius: 14,
    background: "#eef4f1",
    color: "#047857",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  selectedResidentTitle: {
    margin: "6px 0 0",
    color: "#10251f",
    fontSize: 24,
    fontWeight: 900,
    letterSpacing: "-0.035em",
  },
  selectedResidentMeta: {
    margin: "4px 0 0",
    color: "#64756e",
    fontSize: 13,
    fontWeight: 800,
  },
  selectedResidentFacts: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(120px, 1fr))",
    gap: 10,
    minWidth: 420,
  },
  selectedFact: {
    minHeight: 56,
    border: "1px solid #dbe6e0",
    background: "#eef4f1",
    color: "#2f5d50",
    borderRadius: 16,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  selectedFactIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    background: "#ffffff",
    color: "#2f6b5d",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  selectedFactText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 3,
    lineHeight: 1.15,
  },
  selectedFactLabel: {
    display: "block",
    color: "#64756e",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  selectedFactValue: {
    display: "block",
    color: "#12352d",
    fontSize: 15,
    fontWeight: 950,
    letterSpacing: "-0.02em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  workflowSummaryBarCompact: {
    marginTop: 18,
    background: "transparent",
    border: "0",
    padding: 0,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  workflowSummaryBar: {
    marginTop: 16,
    border: "1px solid #dbe6e0",
    background: "#ffffff",
    borderRadius: 14,
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    boxShadow: "0 6px 14px rgba(15,23,42,.035)",
  },
  workflowSummaryLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#2f5d50",
    fontSize: 13,
    fontWeight: 900,
    flexWrap: "wrap",
  },
  workflowSummaryBadges: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  workflowFilterBadge: {
    background: "#ffffff",
    border: "1px solid #dbe6e0",
    borderRadius: 14,
    padding: "10px 12px",
    color: "#475569",
    fontSize: 12,
    fontWeight: 900,
  },
  workflowFilterCount: {
    background: "#eaf3ef",
    color: "#047857",
    borderRadius: 14,
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 900,
  },
  workflowClearButton: {
    border: "1px solid #dbe6e0",
    background: "#ffffff",
    borderRadius: 14,
    padding: "10px 12px",
    color: "#2f5d50",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  workflowStepsGrid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 12,
  },
  workflowStep: {
    border: "1px solid #dbe6e0",
    background: "#ffffff",
    borderRadius: 14,
    padding: "14px 16px",
    minHeight: 74,
    display: "grid",
    gridTemplateColumns: "40px 1fr",
    gap: 12,
    alignItems: "center",
    textAlign: "left",
    color: "#10251f",
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(15,23,42,.04)",
  },
  workflowStepActive: {
    border: "1px solid #2f6b5d",
    background: "#f0faf6",
    borderRadius: 14,
    padding: "14px 16px",
    minHeight: 74,
    display: "grid",
    gridTemplateColumns: "40px 1fr",
    gap: 12,
    alignItems: "center",
    textAlign: "left",
    color: "#10251f",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(47,107,93,.13)",
  },
  workflowStepIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: "#eef4f1",
    color: "#2f6b5d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  workflowStepBody: {
    display: "grid",
    gap: 3,
    minWidth: 0,
  },
  workflowStepTitleRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
    minWidth: 0,
  },
  workflowStepValue: {
    color: "#10251f",
    fontSize: 16,
    fontWeight: 900,
    fontStyle: "normal",
    lineHeight: 1,
  },
  workflowResidentsPanel: {
    marginTop: 12,
    border: "1px solid #dbe6e0",
    background: "#ffffff",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 6px 14px rgba(15,23,42,.035)",
  },
  workflowResidentsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  workflowSmallGhostButton: {
    border: "1px solid #dbe6e0",
    background: "#f8fbfa",
    color: "#2f5d50",
    borderRadius: 14,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  workflowResidentsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 10,
    maxHeight: 172,
    overflow: "auto",
    paddingRight: 2,
  },
  workflowResidentCard: {
    border: "1px solid #dbe6e0",
    background: "#ffffff",
    borderRadius: 16,
    padding: 12,
    display: "grid",
    gridTemplateColumns: "38px 1fr",
    gap: 10,
    alignItems: "center",
    textAlign: "left",
    cursor: "pointer",
    color: "#10251f",
  },
  workflowResidentCardActive: {
    border: "1px solid #2f6b5d",
    background: "#f0faf6",
    borderRadius: 16,
    padding: 12,
    display: "grid",
    gridTemplateColumns: "38px 1fr",
    gap: 10,
    alignItems: "center",
    textAlign: "left",
    cursor: "pointer",
    color: "#10251f",
  },
  workflowResidentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    background: "#eef4f1",
    color: "#2f6b5d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  workflowResidentText: {
    display: "grid",
    gap: 3,
    minWidth: 0,
  },
  workflowResidentsEmpty: {
    border: "1px dashed #cbd5d1",
    background: "#f8fbfa",
    borderRadius: 16,
    padding: 14,
    color: "#64736d",
    fontSize: 13,
    fontWeight: 800,
  },
  dashboardLayout: { marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(360px, 0.65fr)", gap: 20, alignItems: "start" },
  leftColumn: { display: "grid", gap: 16, minWidth: 0 },
  rightColumn: { display: "grid", gap: 16, minWidth: 0, alignSelf: "start" },
  bottomInfoGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 0.55fr)", gap: 20, alignItems: "start" },
  panelWide: { background: "#ffffff", border: "1px solid #dbe6e0", borderRadius: 16, padding: 22, display: "grid", gap: 18, boxShadow: "0 8px 18px rgba(15, 23, 42, 0.05)" },
  prnBoxWide: { background: "#ffffff", border: "1px solid #dbe6e0", borderRadius: 16, padding: 22, display: "grid", gap: 16, boxShadow: "0 8px 18px rgba(15, 23, 42, 0.05)", alignSelf: "start" },
  panelSoft: { background: "#ffffff", border: "1px solid #c9d8d0", borderRadius: 16, padding: 16, display: "grid", gap: 14, boxShadow: "0 8px 18px rgba(15, 23, 42, 0.05)" },
  residentCardsCompact: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12, maxHeight: 188, overflow: "auto", paddingRight: 2 },
  contentTabsPanel: { background: "#ffffff", border: "1px solid #c9d8d0", borderRadius: 16, padding: 16, boxShadow: "0 8px 18px rgba(15, 23, 42, 0.05)" },
  panelInner: { marginTop: 14, border: "1px solid #dbe6e0", borderRadius: 16, padding: 20, display: "grid", gap: 18, background: "#ffffff" },
  tabsBar: { display: "flex", flexWrap: "wrap", gap: 8, borderRadius: 16, background: "#eef4f1", padding: 8, border: "1px solid #dbe6e0" },
  tabButton: { border: "none", background: "transparent", color: "#486b5d", borderRadius: 12, padding: "10px 16px", fontSize: 14, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 },
  tabActive: { border: "1px solid #c9d8d0", background: "#ffffff", color: "#2f5d50", borderRadius: 12, padding: "10px 16px", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 6px 14px rgba(15,23,42,.06)", display: "inline-flex", alignItems: "center", gap: 8 },
  attentionGridSidebar: { display: "grid", gap: 12 },
  quickActionsGrid: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  sideTitle: { margin: "6px 0 0", fontSize: 22, fontWeight: 800, letterSpacing: "-0.035em", color: "#10251f" },
  heroActions: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
  hero: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 18, alignItems: "center", background: "#486b5d", border: "1px solid #c9d8d0", borderRadius: 20, padding: "22px 22px", boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)", color: "#ffffff" },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 16,
    background: "#eef4f1",
    color: "#047857",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#047857",
    fontSize: 13,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
  },
  title: { margin: "8px 0 0", fontSize: 28, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.08, color: "#ffffff" },
  subtitle: { margin: "8px 0 0", maxWidth: 920, color: "rgba(255,255,255,.84)", fontSize: 15, fontWeight: 700, lineHeight: 1.45 },
  lockCard: { background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 16, padding: 12, display: "flex", alignItems: "center", gap: 12, boxShadow: "none", color: "#ffffff" },
  disclaimer: { marginTop: 16, background: "#fff9e8", border: "1px solid #ead8a7", color: "#8a5a13", borderRadius: 16, padding: 16, display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, fontWeight: 800, lineHeight: 1.55 },
  shiftInfo: { marginTop: 12, background: "#ffffff", border: "1px solid #dbe6e0", color: "#2f5d50", borderRadius: 16, padding: 14, display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, fontWeight: 800, lineHeight: 1.5, boxShadow: "0 8px 18px rgba(15,23,42,.04)" },
  residentsSection: {
    marginTop: 16,
    background: "#ffffff",
    border: "1px solid #dbe6e0",
    borderRadius: 16,
    padding: 18,
    display: "grid",
    gap: 14,
    boxShadow: "0 12px 28px rgba(15,23,42,.045)",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid #dbe6e0",
    borderRadius: 20,
    padding: "0 14px",
    height: 52,
    background: "#f8faf8",
  },
  searchInput: {
    border: "none",
    outline: "none",
    flex: 1,
    fontSize: 14,
    fontWeight: 700,
    background: "transparent",
    color: "#10251f",
  },
  residentCards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 12,
  },
  residentCard: {
    border: "1px solid #dbe6e0",
    background: "#ffffff",
    borderRadius: 22,
    padding: 14,
    display: "grid",
    gridTemplateColumns: "44px 1fr auto",
    gap: 12,
    alignItems: "center",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(15,23,42,.035)",
  },
  residentCardActive: {
    border: "1px solid #047857",
    background: "#eef4f1",
    boxShadow: "0 0 0 3px rgba(4,120,87,.08)",
  },
  residentCardAlert: {
    border: "1px solid #ffd6d6",
    background: "#fffafa",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "#eef4f1",
    color: "#047857",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  actionGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 14,
  },
  actionCard: {
    background: "#ffffff",
    border: "1px solid #dbe6e0",
    borderRadius: 26,
    padding: 18,
    display: "grid",
    gap: 10,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(15,23,42,.045)",
  },
  main: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "minmax(620px, 1.25fr) minmax(340px, 0.75fr)",
    gap: 18,
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #dbe6e0",
    borderRadius: 16,
    padding: 22,
    display: "grid",
    gap: 18,
    alignContent: "start",
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.05)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  sectionKicker: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#047857",
    fontSize: 13,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  sectionTitle: {
    margin: "8px 0 0",
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "-0.035em",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 12,
  },
  smallStat: {
    border: "1px solid #dbe6e0",
    borderRadius: 22,
    padding: 14,
    background: "#f8faf8",
  },
  smallStatDanger: {
    borderColor: "#fca5a5",
    background: "#fff4f4",
    color: "#b42318",
  },
  distributionBox: {
    border: "1px solid #c9d8d0",
    background: "#eef4f1",
    borderRadius: 26,
    padding: 18,
    display: "grid",
    gap: 14,
  },
  distributionList: {
    display: "grid",
    gap: 12,
  },
  distributionItem: {
    border: "1px solid #c9d8d0",
    background: "#ffffff",
    borderRadius: 20,
    padding: 14,
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 14,
    alignItems: "center",
    boxShadow: "0 8px 18px rgba(15,23,42,.035)",
  },
  counterPill: {
    background: "#047857",
    color: "#ffffff",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 800,
  },
  sectionSplit: {
    display: "grid",
    gap: 14,
  },
  sectionHeaderLine: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  linkButton: {
    border: "1px solid #c9d8d0",
    background: "#eef4f1",
    color: "#047857",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  medGrid: {
    display: "grid",
    gap: 12,
  },
  medCard: {
    border: "1px solid #dbe6e0",
    borderRadius: 22,
    padding: 16,
    display: "grid",
    gap: 12,
    background: "#ffffff",
    boxShadow: "0 10px 24px rgba(15,23,42,.035)",
  },
  medCardDone: {
    background: "#f8faf8",
    opacity: 0.88,
  },
  medHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
  },
  medSubline: {
    marginTop: 5,
    color: "#526174",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.4,
  },
  badges: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "flex-start",
  },
  badgeAmber: {
    background: "#fff9e8",
    color: "#a15c07",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 800,
  },
  badgeBlue: {
    background: "#eef4ff",
    color: "#315f9e",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 800,
  },
  badgeGreen: {
    background: "#e9f7ef",
    color: "#047857",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 800,
  },
  badgeRed: {
    background: "#fff4f4",
    color: "#b42318",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 800,
  },
  badgeNeutral: {
    background: "#eef2f1",
    color: "#526174",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 800,
  },
  statusChip: {
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid transparent",
  },
  statusGreen: { background: "#e9f7ef", color: "#047857", borderColor: "#bfe8d1" },
  statusAmber: { background: "#fff9e8", color: "#a15c07", borderColor: "#ead8a7" },
  statusRed: { background: "#fff4f4", color: "#b42318", borderColor: "#fecaca" },
  statusNeutral: { background: "#eef2f1", color: "#526174", borderColor: "#dbe6e0" },
  medTimeline: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },
  timelineDone: {
    borderRadius: 999,
    padding: "7px 9px",
    textAlign: "center",
    background: "#e9f7ef",
    color: "#047857",
    border: "1px solid #bfe8d1",
    fontSize: 12,
    fontWeight: 900,
  },
  timelinePending: {
    borderRadius: 999,
    padding: "7px 9px",
    textAlign: "center",
    background: "#f8faf8",
    color: "#526174",
    border: "1px solid #dbe6e0",
    fontSize: 12,
    fontWeight: 900,
  },
  timelineLate: {
    borderRadius: 999,
    padding: "7px 9px",
    textAlign: "center",
    background: "#fff4f4",
    color: "#b42318",
    border: "1px solid #fecaca",
    fontSize: 12,
    fontWeight: 900,
  },
  warningBox: {
    background: "#fff9e8",
    color: "#a15c07",
    border: "1px solid #ead8a7",
    borderRadius: 14,
    padding: 12,
    fontWeight: 800,
  },

  stockDangerBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    margin: "0 34px 18px",
    border: "1px solid #fecaca",
    borderRadius: 14,
    background: "#fff1f2",
    padding: "16px 18px",
    color: "#10251f",
    fontWeight: 750,
  },
  stockWarningBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    margin: "0 34px 18px",
    border: "1px solid #fde68a",
    borderRadius: 14,
    background: "#fffbeb",
    padding: "16px 18px",
    color: "#10251f",
    fontWeight: 750,
  },
  secondCheckBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    margin: "0 34px 18px",
    border: "1px solid #dbe6e0",
    borderRadius: 14,
    background: "#ffffff",
    padding: "16px 18px",
    color: "#10251f",
  },


  prnPanelInline: {
    marginTop: 22,
    border: "1px solid #dbe6e0",
    borderRadius: 22,
    background: "#ffffff",
    padding: 22,
    boxShadow: "0 1px 3px rgba(16, 37, 31, 0.06)",
  },
  prnInlineForm: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 160px",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    marginBottom: 14,
  },
  prnInput: {
    width: "100%",
    minHeight: 54,
    border: "1px solid #dbe6e0",
    borderRadius: 16,
    background: "#ffffff",
    padding: "0 18px",
    fontSize: 15,
    fontWeight: 750,
    color: "#10251f",
    outline: "none",
    boxSizing: "border-box",
  },

  prnSubmitButton: {
    minHeight: 54,
    border: "0",
    borderRadius: 16,
    background: "#047857",
    color: "#ffffff",
    padding: "0 18px",
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  },
  prnSubmitDisabled: {
    minHeight: 54,
    border: "0",
    borderRadius: 16,
    background: "#94a3b8",
    color: "#ffffff",
    padding: "0 18px",
    fontSize: 15,
    fontWeight: 900,
    cursor: "not-allowed",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    opacity: 0.75,
  },

  prnHistoryList: {
    display: "grid",
    gap: 10,
    marginTop: 12,
  },
  prnHistoryItem: {
    display: "grid",
    gap: 4,
    border: "1px solid #dbe6e0",
    borderRadius: 16,
    background: "#f8faf8",
    padding: "12px 14px",
    color: "#10251f",
  },

  stockBoxCompact: {
    display: "flex",
    gap: 9,
    alignItems: "center",
    background: "#f8faf8",
    border: "1px solid #dbe6e0",
    borderRadius: 16,
    padding: 11,
    color: "#526174",
    fontSize: 13,
    fontWeight: 800,
  },
  note: {
    color: "#526174",
    margin: 0,
    lineHeight: 1.5,
    fontWeight: 650,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    background: "#047857",
    color: "#ffffff",
    borderRadius: 16,
    padding: "11px 15px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  secondaryButton: {
    border: "1px solid #d7ddd9",
    background: "#ffffff",
    color: "#10251f",
    borderRadius: 16,
    padding: "11px 15px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  disabledButton: {
    border: "none",
    background: "#94a3b8",
    color: "#ffffff",
    borderRadius: 16,
    padding: "11px 15px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "not-allowed",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  bigGiveButton: {
    border: "none",
    background: "#047857",
    color: "#ffffff",
    borderRadius: 14,
    padding: "13px 18px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    marginTop: 14,
    padding: 14,
    borderRadius: 20,
    background: "#eef4f1",
    border: "1px solid #cfeadd",
    color: "#047857",
    fontWeight: 800,
  },
  addBox: {
    border: "1px solid #dbe6e0",
    borderRadius: 16,
    padding: 18,
    display: "grid",
    gap: 14,
    background: "#ffffff",
  },
  prnBox: {
    border: "1px solid #dbe6e0",
    borderRadius: 16,
    padding: 18,
    display: "grid",
    gap: 14,
    background: "#ffffff",
  },
  smallTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
  },
  quickHint: {
    margin: "5px 0 0",
    color: "#047857",
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1.45,
  },
  field: {
    display: "grid",
    gap: 7,
    color: "#3e4b5f",
    fontSize: 13,
    fontWeight: 800,
  },
  input: {
    width: "100%",
    border: "1px solid #d7ddd9",
    borderRadius: 16,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 700,
    boxSizing: "border-box",
    outline: "none",
    background: "#ffffff",
  },
  textareaSmall: {
    width: "100%",
    minHeight: 84,
    border: "1px solid #d7ddd9",
    borderRadius: 16,
    padding: 14,
    fontSize: 14,
    fontWeight: 700,
    boxSizing: "border-box",
    outline: "none",
    background: "#ffffff",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    color: "#3e4b5f",
    fontSize: 13,
    fontWeight: 800,
  },
  inlineForm: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 10,
  },
  historyList: {
    display: "grid",
    gap: 10,
  },
  historyItem: {
    background: "#f8faf8",
    border: "1px solid #dbe6e0",
    borderRadius: 16,
    padding: 12,
    fontSize: 13,
  },
  alertBox: {
    background: "#fff4f4",
    color: "#b42318",
    border: "1px solid #ffd6d6",
    borderRadius: 22,
    padding: 16,
  },
  okBox: {
    background: "#eef4f1",
    color: "#047857",
    border: "1px solid #cfeadd",
    borderRadius: 22,
    padding: 16,
    display: "grid",
    gap: 5,
    alignSelf: "start",
  },
  meta: {
    color: "#526174",
    fontSize: 12,
    fontWeight: 800,
  },
  stepper: {
    display: "grid",
    gridTemplateColumns: "1fr 46px 70px 46px",
    alignItems: "center",
    gap: 9,
    background: "#f8faf8",
    borderRadius: 14,
    padding: 10,
  },
  stepButton: {
    border: "1px solid #d7ddd9",
    background: "#ffffff",
    borderRadius: 14,
    height: 40,
    cursor: "pointer",
    fontWeight: 800,
  },
  vitalRow: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
    gap: 10,
    background: "#f8faf8",
    borderRadius: 16,
    padding: 12,
    fontSize: 13,
  },
  empty: {
    padding: 20,
    color: "#526174",
    textAlign: "center",
    border: "1px dashed #d7ddd9",
    borderRadius: 20,
    fontWeight: 750,
  },
  emptySmall: {
    padding: 14,
    color: "#526174",
    textAlign: "center",
    border: "1px dashed #d7ddd9",
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 750,
  },
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      zIndex: 50,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 14,
      background: "rgba(15, 23, 42, 0.52)",
      backdropFilter: "blur(8px)",
    },
    modal: {
      width: "min(1280px, calc(100vw - 28px))",
      maxHeight: "calc(100vh - 40px)",
      overflowY: "auto",
      borderRadius: 24,
      border: "1px solid #dbe6e0",
      background: "#f3f6f4",
      boxShadow: "0 28px 90px rgba(15, 23, 42, 0.30)",
    },
    taskModal: {
      width: "min(760px, calc(100vw - 28px))",
      maxHeight: "calc(100vh - 40px)",
      overflow: "hidden",
      borderRadius: 24,
      border: "1px solid #dbe6e0",
      background: "#ffffff",
      boxShadow: "0 28px 90px rgba(15, 23, 42, 0.30)",
      display: "flex",
      flexDirection: "column",
    },
    taskModalHeader: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 18,
      padding: "18px 20px",
      background: "linear-gradient(135deg, #486b5d, #2f6b5d)",
      color: "#ffffff",
    },
    taskModalHeaderDanger: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 18,
      padding: "18px 20px",
      background: "linear-gradient(135deg, #7f1d1d, #b91c1c)",
      color: "#ffffff",
    },
    taskModalKicker: {
      fontSize: 12,
      fontWeight: 950,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      opacity: 0.82,
    },
    taskModalTitle: {
      margin: "8px 0 0",
      color: "#ffffff",
      fontSize: 22,
      lineHeight: 1.1,
      fontWeight: 950,
      letterSpacing: "-0.03em",
    },
    taskModalSubtitle: {
      margin: "8px 0 0",
      color: "rgba(255,255,255,0.82)",
      fontSize: 14,
      fontWeight: 750,
      lineHeight: 1.45,
    },
    taskModalCloseButton: {
      width: 42,
      height: 42,
      minWidth: 42,
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.14)",
      color: "#ffffff",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
      cursor: "pointer",
    },
    taskModalBody: {
      padding: 18,
      overflowY: "auto",
      display: "grid",
      gap: 16,
    },
    taskModalFooter: {
      position: "sticky",
      bottom: 0,
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      padding: "14px 18px",
      borderTop: "1px solid #dbe6e0",
      background: "rgba(255,255,255,0.96)",
      backdropFilter: "blur(8px)",
    },
    taskSummaryCard: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
      padding: 16,
      border: "1px solid #dbe6e0",
      borderRadius: 20,
      background: "#f5faf7",
    },
    taskSummaryPill: {
      borderRadius: 999,
      padding: "8px 12px",
      background: "#ffffff",
      border: "1px solid #dbe6e0",
      color: "#2f6b5d",
      fontSize: 12,
      fontWeight: 950,
    },
    taskMedicineList: {
      display: "grid",
      gap: 8,
    },
    taskMedicineItem: {
      padding: "12px 14px",
      border: "1px solid #dbe6e0",
      borderRadius: 16,
      background: "#ffffff",
    },
    textareaCompact: {
      width: "100%",
      minHeight: 92,
      resize: "vertical",
      border: "1px solid #d7ddd9",
      borderRadius: 14,
      padding: 14,
      fontSize: 14,
      fontWeight: 750,
      outline: "none",
      color: "#0f172a",
      background: "#ffffff",
    },
    addMedicationModal: {
      width: "min(1280px, calc(100vw - 28px))",
      maxHeight: "calc(100vh - 40px)",
      overflowY: "auto",
      borderRadius: 24,
      border: "1px solid #dbe6e0",
      background: "#f3f6f4",
      boxShadow: "0 28px 90px rgba(15, 23, 42, 0.30)",
    },
    modalHeader: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 24,
      padding: "30px 34px",
      backgroundColor: "#486b5d",
      color: "#ffffff",
      minHeight: 180,
      borderBottom: "1px solid rgba(255,255,255,0.08)",
    },
  iconButton: {
    width: 64,
    height: 64,
    minWidth: 64,
    borderRadius: 14,
    border: "0",
    background: "#f1f5f9",
    color: "#526174",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    margin: 0,
    lineHeight: 1,
    flexShrink: 0,
    cursor: "pointer",
    transition: "all 0.15s ease",
    fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
  },
    modalStep: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      border: "1px solid #dbe6e0",
      borderRadius: 20,
      background: "#ffffff",
      padding: "16px 18px",
      marginBottom: 16,
      boxShadow: "0 1px 3px rgba(16, 37, 31, 0.06)",
    },
    stepNumber: {
      width: 48,
      height: 48,
      borderRadius: 14,
      background: "#047857",
      color: "#ffffff",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 20,
      fontWeight: 950,
      flexShrink: 0,
    },
  quickBox: {
    border: "1px solid #c9d8d0",
    background: "#f8faf8",
    borderRadius: 16,
    padding: 18,
    display: "grid",
    gap: 12,
  },
  quickList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 10,
    maxHeight: 260,
    overflowY: "auto",
  },
  quickItem: {
    border: "1px solid #c9d8d0",
    background: "#ffffff",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gap: 5,
    textAlign: "left",
    cursor: "pointer",
    color: "#10251f",
  },
  quickItemActive: {
    border: "1px solid #047857",
    background: "#eef4f1",
    boxShadow: "0 0 0 3px rgba(4,120,87,.08)",
  },
  templateChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 9,
  },
  templateChip: {
    border: "1px solid #c9d8d0",
    background: "#ffffff",
    borderRadius: 999,
    padding: "9px 13px",
    cursor: "pointer",
    fontWeight: 800,
    color: "#486b5d",
  },
  modalFormGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },
  moreButton: {
    border: "1px solid #d7ddd9",
    background: "#ffffff",
    color: "#10251f",
    borderRadius: 14,
    padding: "13px 15px",
    fontWeight: 800,
    cursor: "pointer",
  },
  advancedBox: {
    border: "1px solid #dbe6e0",
    background: "#f8faf8",
    borderRadius: 16,
    padding: 18,
    display: "grid",
    gap: 14,
  },
  prepareList: {
    display: "grid",
    gap: 10,
    marginTop: 16,
  },

  prepareListItem: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 16px",
    borderRadius: 16,
    background: "#f8faf8",
    border: "1px solid #dbe6e0",
  },

  prepareMedicationName: {
    fontSize: 15,
    fontWeight: 800,
    color: "#10251f",
  },

  prepareMedicationMeta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: 800,
    color: "#486b5d",
  },

  prepareMedicationNote: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 700,
    color: "#6a7e75",
  },

  doubleCheckBadge: {
    flexShrink: 0,
    borderRadius: 999,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
  },

  responsibilityCheck: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
    padding: "14px 16px",
    borderRadius: 16,
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#064e3b",
    fontWeight: 800,
    lineHeight: 1.45,
  },

  checkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  identityCard: {
    display: "flex",
    gap: 16,
    alignItems: "center",
    background: "#f8faf8",
    borderRadius: 16,
    padding: 18,
    border: "1px solid #dbe6e0",
  },
  bigAvatar: {
    width: 82,
    height: 82,
    borderRadius: 16,
    background: "#eef4f1",
    color: "#047857",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 800,
  },
  checkList: {
    display: "grid",
    gap: 10,
  },
  confirmCheck: {
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
    border: "1px solid #dbe6e0",
    borderRadius: 16,
    padding: 12,
    fontSize: 13,
    fontWeight: 800,
  },
  confirmCheckDanger: {
    background: "#fff9e8",
    borderColor: "#ead8a7",
    color: "#a15c07",
  },
  shortConfirmText: {
    background: "#f8faf8",
    border: "1px solid #dbe6e0",
    borderRadius: 14,
    padding: 14,
    color: "#3e4b5f",
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.5,
  },
    modalActions: {
      position: "sticky",
      bottom: 0,
      zIndex: 10,
      display: "flex",
      justifyContent: "flex-end",
      gap: 12,
      padding: "18px 34px",
      borderTop: "1px solid #dbe6e0",
      background: "rgba(255,255,255,0.94)",
      backdropFilter: "blur(12px)",
    },
    giveConfirmModal: {
      width: "min(1180px, calc(100vw - 48px))",
      maxHeight: "calc(100vh - 48px)",
      overflowY: "auto",
      background: "#f3f6f4",
      borderRadius: 24,
      padding: 0,
      display: "grid",
      gap: 0,
      boxShadow: "0 28px 90px rgba(15,23,42,.34)",
      border: "1px solid #dbe6e0",
      color: "#10251f",
      fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
    },
    giveConfirmHeader: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 24,
      minHeight: 170,
      margin: 0,
      padding: "28px 34px",
      background: "#486b5d",
      color: "#ffffff",
      borderRadius: "28px 28px 0 0",
      borderBottom: "1px solid rgba(255,255,255,0.10)",
      boxShadow: "0 10px 28px rgba(16, 37, 31, 0.18)",
    },
    giveConfirmTitle: {
      margin: "10px 0 0",
      color: "#ffffff",
      fontSize: 44,
      lineHeight: 1.02,
      fontWeight: 950,
      letterSpacing: "-0.05em",
    },
    giveConfirmSubtitle: {
      margin: "14px 0 0",
      maxWidth: 900,
      color: "rgba(255,255,255,0.88)",
      fontSize: 17,
      lineHeight: 1.55,
      fontWeight: 800,
    },
    giveConfirmClose: {
      width: 76,
      height: 76,
      minWidth: 76,
      borderRadius: 22,
      border: "0",
      background: "rgba(255,255,255,0.12)",
      color: "#ffffff",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
      margin: 0,
      lineHeight: 1,
      flexShrink: 0,
      cursor: "pointer",
      transition: "all 0.15s ease",
      fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
    },
    giveDivider: {
      display: "none",
    },
    giveIdentityCard: {
      display: "grid",
      gridTemplateColumns: "64px minmax(0, 1fr)",
      gap: 14,
      alignItems: "center",
      background: "#eef4f1",
      border: "1px solid #dbe6e0",
      borderRadius: 20,
      padding: 16,
      margin: "24px 34px 16px",
    },
  giveAvatar: {
    width: 64,
    height: 64,
    borderRadius: 14,
    background: "#ffffff",
    color: "#047857",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 800,
    border: "1px solid #c9d8d0",
  },
  giveIdentityMain: {
    minWidth: 0,
  },
  giveLabel: {
    color: "#6a7e75",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  giveResidentName: {
    margin: "4px 0 0",
    color: "#10251f",
    fontSize: 20,
    lineHeight: 1.25,
    fontWeight: 800,
    wordBreak: "break-word",
  },
  giveMedicationLine: {
    margin: "5px 0 0",
    color: "#486b5d",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 800,
    wordBreak: "break-word",
  },
    giveMedicationList: {
      width: "calc(100% - 68px)",
      margin: "0 34px 18px",
      overflow: "hidden",
      border: "1px solid #dbe6e0",
      borderRadius: 14,
      background: "#ffffff",
    },
    giveMedicationListHeader: {
      display: "grid",
      gridTemplateColumns: "1.4fr .7fr .7fr .7fr 1.4fr",
      gap: 12,
      alignItems: "center",
      padding: "12px 16px",
      background: "#e9f1ed",
      color: "#486b5d",
      fontSize: 12,
      fontWeight: 950,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
    },
    giveMedicationListRow: {
      display: "grid",
      gridTemplateColumns: "1.4fr .7fr .7fr .7fr 1.4fr",
      gap: 12,
      alignItems: "center",
      padding: "14px 16px",
      background: "#ffffff",
      borderTop: "1px solid #dbe6e0",
      fontWeight: 850,
      color: "#10251f",
    },
    giveDetailsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: 10,
      margin: "0 34px 18px",
    },
    giveDetailCard: {
      border: "1px solid #dbe6e0",
      borderRadius: 16,
      background: "#ffffff",
      padding: "10px 12px",
      minWidth: 0,
    },
    giveDetailCardWide: {
      gridColumn: "1 / -1",
      border: "1px solid #dbe6e0",
      borderRadius: 16,
      background: "#ffffff",
      padding: "12px 14px",
      minWidth: 0,
    },
    giveNoteBox: {
      margin: "0 34px 18px",
      border: "1px solid #dbe6e0",
      borderRadius: 14,
      background: "#ffffff",
      padding: "14px 16px",
      fontWeight: 800,
      color: "#10251f",
    },
    giveTextarea: {
      width: "calc(100% - 68px)",
      minHeight: 86,
      margin: "0 34px 18px",
      border: "1px solid #dbe6e0",
      borderRadius: 14,
      padding: 16,
      resize: "vertical",
      fontWeight: 750,
      outline: "none",
      color: "#10251f",
      background: "#ffffff",
      fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
    },
  historyModal: {
    width: "min(1280px, calc(100vw - 48px))",
    maxHeight: "calc(100vh - 64px)",
    overflow: "hidden",
    borderRadius: 22,
    background: "#ffffff",
    boxShadow: "0 26px 80px rgba(15, 23, 42, 0.28)",
    fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
    width: "100%",
    maxWidth: 1120,
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 20,
    padding: 24,
    display: "grid",
    gap: 18,
    boxShadow: "0 26px 76px rgba(15, 23, 42, 0.30)",
    border: "1px solid #dbe6e0",
  },
  historyFilters: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
    alignItems: "end",
    paddingTop: 22,
    borderTop: "1px solid #dbe6e0",
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
  },
  historyTableWrap: {
    border: "1px solid #dbe6e0",
    borderRadius: 22,
    overflow: "auto",
    maxHeight: 480,
  },
  historyTable: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    overflow: "visible",
    border: "1px solid #dbe6e0",
    borderRadius: 14,
    background: "#ffffff",
    fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
  },

  moreLink: {
    marginTop: 12,
    border: "none",
    background: "transparent",
    color: "#047857",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 800,
    textDecoration: "underline",
    textUnderlineOffset: 4,
    cursor: "pointer",
  },
    instructionModal: {
      width: "min(1280px, calc(100vw - 28px))",
      maxHeight: "calc(100vh - 40px)",
      overflowY: "auto",
      borderRadius: 24,
      border: "1px solid #dbe6e0",
      background: "#f3f6f4",
      boxShadow: "0 28px 90px rgba(15, 23, 42, 0.30)",
    },
    instructionHeader: {
      position: "sticky",
      top: 0,
      zIndex: 10,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 24,
      minHeight: 168,
      padding: "28px 34px",
      background: "#486b5d",
      color: "#ffffff",
    },
    instructionKicker: {
      margin: 0,
      fontSize: 12,
      fontWeight: 950,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "rgba(209, 250, 229, 0.82)",
    },
    instructionTitle: {
      margin: "10px 0 0",
      fontSize: 44,
      lineHeight: 1.02,
      fontWeight: 950,
      letterSpacing: "-0.05em",
      color: "#ffffff",
    },
    instructionSubtitle: {
      margin: "14px 0 0",
      maxWidth: 900,
      color: "rgba(255,255,255,0.88)",
      fontWeight: 800,
      lineHeight: 1.55,
      fontSize: 17,
    },
    instructionClose: {
      width: 76,
      height: 76,
      border: "0",
      borderRadius: 22,
      background: "rgba(255,255,255,0.12)",
      color: "#ffffff",
      fontSize: 36,
      cursor: "pointer",
    },
    instructionBody: {
      maxHeight: "calc(100vh - 210px)",
      overflowY: "auto",
      padding: 24,
      background: "#f3f6f4",
    },
  instructionHighlight: {
    display: "flex",
    gap: 16,
    border: "1px solid #c9d8d0",
    background: "#eef4f1",
    borderRadius: 16,
    padding: 24,
  },
  instructionNumber: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "#e6f7ed",
    color: "#047857",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 800,
    flexShrink: 0,
  },
  instructionSectionTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: "#10251f",
  },
  instructionText: {
    margin: "10px 0 0",
    fontSize: 17,
    fontWeight: 750,
    lineHeight: 1.75,
    color: "#526174",
  },
  instructionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },
  instructionCard: {
    border: "1px solid #dbe6e0",
    background: "#ffffff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 10px 24px rgba(15,23,42,.04)",
  },
  instructionCardNumber: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: "#eef4f1",
    color: "#486b5d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 12,
  },
  instructionCardTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: "#10251f",
  },
  instructionCardText: {
    margin: "8px 0 0",
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.65,
    color: "#526174",
  },
  instructionWarningCard: {
    borderColor: "#f1b44c",
    background: "#fff9e8",
  },
  instructionWarningNumber: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: "#ead8a7",
    color: "#a15c07",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 12,
  },
  instructionWarningTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: "#78350f",
  },
  instructionWarningText: {
    margin: "8px 0 0",
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.65,
    color: "#a15c07",
  },
    instructionFooter: {
      padding: 18,
      borderTop: "1px solid #dbe6e0",
      background: "#ffffff",
      display: "flex",
      justifyContent: "flex-end",
    },
  instructionDone: {
    border: "none",
    borderRadius: 14,
    background: "#486b5d",
    color: "#ffffff",
    padding: "14px 28px",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
  },

  attentionSection: {
    marginTop: 16,
    background: "#ffffff",
    border: "1px solid #dbe6e0",
    borderRadius: 16,
    padding: 22,
    display: "grid",
    gap: 18,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.05)",
  },
  attentionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  attentionTitle: {
    margin: "8px 0 0",
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "-0.04em",
    color: "#10251f",
  },
  attentionSubtitle: {
    margin: "8px 0 0",
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.6,
    color: "#526174",
  },
  attentionButton: {
    border: "1px solid #c9d8d0",
    background: "#eef4f1",
    color: "#047857",
    borderRadius: 14,
    padding: "12px 16px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  attentionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
  },
  attentionCard: {
    borderRadius: 16,
    padding: 18,
    display: "grid",
    gridTemplateColumns: "58px 1fr",
    alignItems: "center",
    gap: 14,
    border: "1px solid #dbe6e0",
    background: "#ffffff",
    boxShadow: "0 10px 24px rgba(15,23,42,.04)",
  },
  attentionCardRed: {
    borderColor: "#ffd6d6",
    background: "#fff4f4",
  },
  attentionCardAmber: {
    borderColor: "#ead8a7",
    background: "#fff9e8",
  },
  attentionCardBlue: {
    borderColor: "#d6e4ff",
    background: "#f4f7ff",
  },
  attentionValue: {
    width: 58,
    height: 58,
    borderRadius: 20,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 30,
    fontWeight: 800,
    lineHeight: 1,
    color: "#10251f",
    boxShadow: "0 8px 18px rgba(15,23,42,.05)",
  },
  attentionCardTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#10251f",
  },
  attentionCardText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
    color: "#526174",
  },
  historyHeaderRow: {
    display: "grid",
    gridTemplateColumns: "0.8fr 1.15fr 1.15fr 1.25fr 0.9fr 1.35fr",
    gap: 12,
    padding: "12px 18px",
    background: "#eef4f1",
    borderBottom: "1px solid #dbe6e0",
    color: "#486b5d",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
  },
  historyRows: {
    maxHeight: 320,
    overflowY: "auto",
    overflowX: "auto",
    border: "1px solid #dbe6e0",
    borderRadius: 14,
    background: "#ffffff",
    fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
  },
  historyRow: {
    display: "grid",
    gridTemplateColumns: "0.8fr 1.15fr 1.15fr 1.25fr 0.9fr 1.35fr",
    gap: 12,
    alignItems: "center",
    padding: "11px 18px",
    borderBottom: "1px solid #eef4f1",
    color: "#10251f",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.35,
    whiteSpace: "normal",
    wordBreak: "break-word",
    fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
  },
  historyGrid: {
    width: "100%",
    overflow: "hidden",
    border: "1px solid #dbe6e0",
    borderRadius: 14,
    background: "#ffffff",
    fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
  },
  historyGridBody: {
    maxHeight: 320,
    overflowY: "auto",
    overflowX: "auto",
  },

  modalBody: {
    maxHeight: "calc(100vh - 220px)",
    overflowY: "auto",
    padding: 26,
    background: "#f3f6f4",
  },
    modalKicker: {
      margin: 0,
      fontSize: 13,
      fontWeight: 950,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      color: "rgba(209, 250, 229, 0.82)",
    },
    modalTitle: {
      margin: "10px 0 0",
      fontSize: 44,
      lineHeight: 1.02,
      fontWeight: 950,
      letterSpacing: "-0.05em",
      color: "#ffffff",
    },
    modalSubtitle: {
      margin: "14px 0 0",
      maxWidth: 900,
      color: "rgba(255,255,255,0.90)",
      fontWeight: 800,
      lineHeight: 1.55,
      fontSize: 17,
    },
    modalCloseButton: {
      width: 76,
      height: 76,
      border: "0",
      borderRadius: 22,
      background: "rgba(255,255,255,0.12)",
      color: "#ffffff",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      flexShrink: 0,
    },

}
