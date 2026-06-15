"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Check,
  ClipboardList,
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

function medicationScheduleKey(medication: Medication) {
  return `${todayKey()}T${toTime(medication.scheduled_time)}:00`
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("lt-LT")
}

function toTime(value?: string | null) {
  return value ? String(value).slice(0, 5) : "—"
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

      const orgId = await getCurrentOrganizationId()
      setOrganizationId(orgId)

      if (!orgId) {
        setMessage("Nepavyko nustatyti organizacijos.")
        return
      }

      const [residentsResult, roomsResult, medsResult, logsResult, prnResult, vitalsResult] = await Promise.all([
        supabase
          .from("residents")
          .select("id, full_name, first_name, last_name, resident_code, current_room_id, current_status, is_active, assigned_to")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .is("archived_at", null),

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

      if (residentsResult.error) throw residentsResult.error
      if (roomsResult.error) throw roomsResult.error
      if (medsResult.error) throw medsResult.error
      if (logsResult.error) throw logsResult.error
      if (prnResult.error) throw prnResult.error
      if (vitalsResult.error) throw vitalsResult.error

      const residentList = (residentsResult.data || []) as Resident[]

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
        const profile = profileMap.get(member.user_id)
        return {
          user_id: member.user_id,
          email: profile?.email || null,
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null,
          full_name: profile?.full_name || null,
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
        String(log.scheduled_for || log.created_at || "").slice(0, 10) === todayKey()
    )
  }

  function applyMedicationTemplate(template: Medication) {
    setMedForm((prev) => ({
      ...prev,
      medication_name: template.medication_name || prev.medication_name,
      dose: template.dose || prev.dose,
      scheduled_time: toTime(template.scheduled_time) || prev.scheduled_time,
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

  async function saveMedicationFromModal() {
    await createMedication()
    if (medForm.medication_name.trim() && medForm.dose.trim() && medForm.prescription_source.trim() && (medForm.is_external || medForm.inventory_item_id)) {
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

      if (!medForm.is_external && !medForm.inventory_item_id) {
        setMessage("Privalomas laukas: sandėlio prekė. Ji reikalinga automatiniam nurašymui.")
        return
      }

      setSaving(true)
      setMessage("")

      const { error } = await supabase.from("resident_medications").insert({
        organization_id: organizationId,
        resident_id: selected.id,
        medication_name: medForm.medication_name.trim(),
        dose: medForm.dose.trim(),
        scheduled_time: medForm.scheduled_time,
        route: medForm.route.trim() || null,
        instructions: medForm.instructions.trim() || null,
        prescription_source: medForm.prescription_source.trim(),
        prescribed_by: medForm.prescribed_by.trim() || null,
        prescription_date: medForm.prescription_date || null,
        inventory_item_id: medForm.is_external ? null : medForm.inventory_item_id || null,
        inventory_units_per_dose: Number(medForm.inventory_units_per_dose || 1),
        is_fractional: medForm.is_fractional,
        is_external: medForm.is_external,
        is_prn: medForm.is_prn,
        requires_double_check: medForm.requires_double_check,
        safety_notes: medForm.safety_notes.trim() || null,
        created_by: currentUserId,
      })

      if (error) throw error

      setMedForm({
        medication_name: "",
        dose: "",
        scheduled_time: "08:00",
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
    const allChecked = Object.values(prepareChecks).every(Boolean)

    if (!prepareAcknowledged || !allChecked) {
      setMessage("Prieš patvirtinant paruošimą pažymėkite visus saugos punktus.")
      return
    }

    if (prepareMedicationList.length === 0) {
      setMessage("Nėra vaistų, kuriuos reikėtų pažymėti kaip paruoštus.")
      return
    }

    if (prepareMedicationList.some((medication) => medication.requires_double_check) && !prepareSecondCheckerId) {
      setMessage("Vaistui su dviguba patikra pasirinkite antrą darbuotoją.")
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
        setMessage("Vaistui su dviguba patikra pasirinkite antrą darbuotoją.")
        return false
      }

      if (medication.inventory_item_id) {
        const item = inventoryItems.find((inventoryItem) => inventoryItem.id === medication.inventory_item_id)
        const quantity = inventoryQuantity(item)
        const unitsPerDose = medication.inventory_units_per_dose || 1

        if (quantity !== null && quantity < unitsPerDose) {
          setMessage(`Negalima paruošti: sandėlyje nepakanka "${inventoryName(item)}" likučio.`)
          return false
        }
      }

      setSaving(true)

      const scheduledFor = medicationScheduleKey(medication)
      const existingPrepared = adminLogs.find(
        (log) =>
          log.medication_id === medication.id &&
          log.status === "prepared" &&
          log.scheduled_for === scheduledFor
      )

      if (existingPrepared) {
        setMessage("Šis vaistas šiandien jau pažymėtas kaip paruoštas.")
        return true
      }

      const { error } = await supabase.from("medication_administration_logs").insert({
        organization_id: organizationId,
        resident_id: selected.id,
        medication_id: medication.id,
        scheduled_for: scheduledFor,
        status: "prepared",
        prepared_by: currentUserId,
        prepared_at: new Date().toISOString(),
        notes:
          [
            medication.instructions,
            medication.requires_double_check && prepareSecondCheckerId
              ? `Paruošimą papildomai patikrino darbuotojas: ${prepareSecondCheckerId}`
              : "",
          ]
            .filter(Boolean)
            .join("\n") || null,
      })

      if (error) throw error
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

      setTaskNote("")
      setShowTaskModal(false)
      setMessage("Dalinimo užduotis sukurta.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko sukurti vaistų dalinimo užduoties.")
    } finally {
      setSaving(false)
    }
  }

  async function addPrnLog() {
    try {
      if (!organizationId || !selected || !currentUserId || !prnReason.trim()) return
      setSaving(true)

      const prnMedication = selectedMedications.find((med) => med.is_prn) || null

      const { error } = await supabase.from("medication_prn_logs").insert({
        organization_id: organizationId,
        resident_id: selected.id,
        medication_id: prnMedication?.id || null,
        reason: prnReason.trim(),
        administered_by: currentUserId,
      })

      if (error) throw error

      setPrnReason("")
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

      const { error } = await supabase.from("resident_vitals").insert({
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
      })

      if (error) throw error

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
          statusas: log.status,
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

  if (loading) return <div style={styles.page}>Kraunama...</div>
  if (!selected) return <div style={styles.page}>Gyventojų nerasta.</div>


  const todayAttentionItems = [
    selectedMedications.some((med) => !getMedicationLog(med.id, "given"))
      ? {
          title: "Nesuduoti vaistai",
          value: selectedMedications.filter((med) => !getMedicationLog(med.id, "given")).length,
          tone: "red",
          description: "Dar yra vaistų, kurie nepažymėti kaip suduoti.",
        }
      : null,
    selectedMedications.some((med) => med.is_prn && !prnLogs.some((log) => log.medication_id === med.id && String(log.administered_at || "").slice(0, 10) === todayKey()))
      ? {
          title: "P.R.N. be priežasties",
          value: selectedMedications.filter((med) => med.is_prn && !prnLogs.some((log) => log.medication_id === med.id && String(log.administered_at || "").slice(0, 10) === todayKey())).length,
          tone: "amber",
          description: "Reikia papildyti skyrimo pagrindą.",
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
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  return (
    <div style={styles.page}>
      <section style={styles.topShell}>
        <header style={styles.hero}>
          <div>
            <div style={styles.kicker}>Medicina</div>
            <h1 style={styles.title}>Vaistai, sveikatos įrašai ir dozatoriai</h1>
            <p style={styles.subtitle}>
              Vienas darbo langas slaugai: vaistų paskyrimai, paruošimas, sudavimas, p.r.n.,
              rodikliai ir sandėlio nurašymas.
            </p>
          </div>

          <div style={styles.heroActions}>
            <button type="button" style={styles.headerButton} onClick={() => void loadAll()}>
              <RefreshCw size={16} />
              Atnaujinti
            </button>
            <button type="button" style={styles.headerGhostButton} onClick={() => setShowAddMedicationModal(true)}>
              <Plus size={16} />
              Naujas įrašas
            </button>
          </div>
        </header>

        <nav style={styles.topNav}>
          <div style={styles.topTabs}>
            {[
              { key: "medications" as const, label: "Vaistai", icon: Stethoscope },
              { key: "prn" as const, label: "PRN", icon: ShieldCheck },
              { key: "events" as const, label: "Įvykiai", icon: HeartPulse },
              { key: "history" as const, label: "Žurnalas", icon: ClipboardList },
              { key: "unfinished" as const, label: "Neužbaigta", icon: AlertTriangle },
            ].map((item) => {
              const Icon = item.icon
              const active = activeMedicineTab === item.key

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => switchMedicineTab(item.key)}
                  style={active ? styles.topTabActive : styles.topTab}
                >
                  <Icon size={16} strokeWidth={2.2} />
                  {item.label}
                </button>
              )
            })}
          </div>

          <button type="button" style={styles.compactButton} onClick={() => setShowHelpModal(true)}>
            Kompaktiškas režimas
          </button>
        </nav>
      </section>

      <section style={styles.actionToolbar}>
        <div style={styles.toolbarGroupLabel}>Veiksmai</div>
        <button type="button" style={styles.toolbarButton} onClick={() => setShowAddMedicationModal(true)}>+ Vaistas</button>
        <button type="button" style={styles.toolbarButton} onClick={() => setShowVitalsModal(true)}>+ Rodikliai</button>
        <button type="button" style={styles.toolbarButton} onClick={() => void loadAll()}>Atnaujinti</button>
        <div style={styles.toolbarDivider} />
        <div style={styles.toolbarGroupLabel}>Filtrai</div>
        <div style={styles.toolbarSearch}>
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ieškoti..."
            style={styles.toolbarSearchInput}
          />
        </div>
        <div style={styles.warningPill}>Vaistų įspėjimai: {alerts.length + todayAttentionItems.length}</div>
      </section>

      <section style={styles.disclaimer}>
        <ShieldAlert size={18} />
        <div>
          <strong>Atsakomybės principas</strong>
          <p>
            Sistema tik registruoja veiksmus. Už vaisto patikrinimą ir sudavimą atsako veiksmą patvirtinantis darbuotojas.
          </p>
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

      <section style={styles.dashboardStatsGrid}>
        <div style={styles.dashboardStatCard}>
          <div style={styles.statIconGreen}><ClipboardList size={25} /></div>
          <div>
            <div style={styles.statLabel}>Šiandien suplanuota</div>
            <div style={styles.statValue}>{stats.activeMeds}</div>
            <div style={styles.statText}>Aktyvūs vaistų įrašai</div>
          </div>
        </div>

        <div style={styles.dashboardStatCard}>
          <div style={styles.statIconAmber}><RefreshCw size={25} /></div>
          <div>
            <div style={styles.statLabel}>Laukia pažymėjimo</div>
            <div style={styles.statValue}>{preparedNotGiven.length}</div>
            <div style={styles.statText}>Paruošta, bet nesuduota</div>
          </div>
        </div>

        <div style={styles.dashboardStatCard}>
          <div style={styles.statIconRed}><AlertTriangle size={25} /></div>
          <div>
            <div style={styles.statLabel}>Rizikos / įspėjimai</div>
            <div style={styles.statValue}>{alerts.length + todayAttentionItems.length}</div>
            <div style={styles.statText}>Reikia darbuotojo dėmesio</div>
          </div>
        </div>

        <div style={styles.dashboardStatCard}>
          <div style={styles.statIconGreen}><HeartPulse size={25} /></div>
          <div>
            <div style={styles.statLabel}>Sveikatos rodikliai</div>
            <div style={styles.statValue}>{selectedVitals.length}</div>
            <div style={styles.statText}>Gyventojo įrašų istorija</div>
          </div>
        </div>
      </section>

      <section style={styles.dashboardLayout}>
        <div style={styles.leftColumn}>
          <section style={styles.panelSoft}>
            <div style={styles.searchBox}>
              <Search size={18} color="#94a3b8" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ieškoti gyventojo, vaisto, kambario, ID ar įspėjimo..."
                style={styles.searchInput}
              />
            </div>

            <div style={styles.residentCardsCompact}>
              {filteredResidents.map((resident) => {
                const residentLatest = latestVitals(vitals.filter((vital) => vital.resident_id === resident.id))
                const residentAlerts = alertList(residentLatest)
                const room = roomsById[resident.current_room_id || ""] || "Kambarys —"

                return (
                  <button
                    type="button"
                    key={resident.id}
                    onClick={() => {
                      setSelectedId(resident.id)
                      setUnlocked(false)
                    }}
                    style={{
                      ...styles.residentCard,
                      ...(selected.id === resident.id ? styles.residentCardActive : {}),
                      ...(residentAlerts.length > 0 ? styles.residentCardAlert : {}),
                    }}
                  >
                    <div style={styles.avatar}>
                      <UserRound size={18} />
                    </div>

                    <div>
                      <strong>{unlocked ? residentShortName(resident) : `${residentInitials(resident)} · ${room}`}</strong>
                      <div style={styles.meta}>{resident.resident_code || resident.id.slice(0, 8)}</div>
                    </div>

                    {residentAlerts.length > 0 ? <AlertTriangle size={17} color="#dc2626" /> : null}
                  </button>
                )
              })}
            </div>
          </section>

          <main style={styles.contentTabsPanel}>
            <div style={styles.tabsBar}>
              {[
                { key: "medications" as const, label: "Vaistai" },
                { key: "prn" as const, label: "PRN" },
                { key: "events" as const, label: "Įvykiai" },
                { key: "history" as const, label: "Žurnalas" },
                { key: "unfinished" as const, label: "Neužbaigta" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => switchMedicineTab(tab.key)}
                  style={activeMedicineTab === tab.key ? styles.tabActive : styles.tabButton}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <section style={styles.panelInner}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.sectionKicker}>
                    <ClipboardList size={16} />
                    {medicineTabInfo.kicker}
                  </div>
                  <h2 style={styles.sectionTitle}>
                    {medicineTabInfo.title} · {unlocked ? residentName(selected, roomsById) : `${residentInitials(selected)} · ${roomsById[selected.current_room_id || ""] || "Kambarys —"}`}
                  </h2>
                  <p style={styles.quickHint}>{medicineTabInfo.hint}</p>
                </div>

                <button type="button" onClick={() => void loadAll()} style={styles.secondaryButton}>
                  <RefreshCw size={16} />
                  Atnaujinti
                </button>
              </div>

              <div style={styles.statsGrid}>
                <SmallStat label="Aktyvūs" value={stats.activeMeds} />
                <SmallStat label="Paruošta" value={stats.prepared} />
                <SmallStat label="Suduota" value={stats.given} />
                <SmallStat label="Sandėlis" value={stats.linkedStock} />
              </div>

              <div style={styles.distributionBox}>
                <div style={styles.sectionHeaderLine}>
                  <div>
                    <h3 style={styles.smallTitle}>Paruošta dalinimui</h3>
                    <p style={styles.quickHint}>Tik paruošti, bet dar nesuduoti vaistai. Vienas mygtukas atidaro atsakomybės patvirtinimą.</p>
                  </div>
                  <span style={styles.counterPill}>{preparedNotGiven.length}</span>
                </div>

                <div style={styles.distributionList}>
                  {preparedNotGiven.map((med) => {
                    const stockItem = inventoryItems.find((item) => item.id === med.inventory_item_id)
                    return (
                      <div key={med.id} style={styles.distributionItem}>
                        <div>
                          <strong>{toTime(med.scheduled_time)} · {med.medication_name}</strong>
                          <div style={styles.meta}>
                            {med.dose}{med.route?.trim() ? ` · ${med.route}` : ""} · {stockItem ? inventoryName(stockItem) : "sandėlis nesusietas"}
                          </div>
                        </div>
                        <button type="button" style={styles.bigGiveButton} onClick={() => openConfirmModal(med)} disabled={saving}>
                          Patikrinta ir suduota
                        </button>
                      </div>
                    )
                  })}

                  {preparedNotGiven.length === 0 ? <div style={styles.emptySmall}>Nėra paruoštų, bet dar nesuduotų vaistų.</div> : null}
                </div>
              </div>

              <div style={styles.sectionSplit}>
                <div style={styles.sectionHeaderLine}>
                  <h3 style={styles.smallTitle}>
                    {activeMedicineTab === "prn"
                      ? "Pagal poreikį"
                      : activeMedicineTab === "unfinished"
                        ? "Neužbaigti vaistai"
                        : activeMedicineTab === "events"
                          ? "Vaistai ir rodiklių įvykiai"
                          : activeMedicineTab === "history"
                            ? "Žurnalo santrauka"
                            : "Vaistai"}
                  </h3>
                  {activeMedicineTab === "medications" ? (
                    <button type="button" style={styles.linkButton} onClick={() => setShowCompletedMeds((v) => !v)}>
                      {showCompletedMeds ? "Slėpti suduotus" : "Rodyti suduotus"}
                    </button>
                  ) : null}
                </div>

                <div style={styles.medGrid}>
                  {visibleMedications.map((med) => {
                    const prepared = getMedicationLog(med.id, "prepared")
                    const given = getMedicationLog(med.id, "given")
                    const stockItem = inventoryItems.find((item) => item.id === med.inventory_item_id)
                    const qty = inventoryQuantity(stockItem)

                    return (
                      <article key={med.id} style={{ ...styles.medCard, ...(given ? styles.medCardDone : {}) }}>
                        <div style={styles.medHeader}>
                          <div>
                            <strong>{toTime(med.scheduled_time)} · {med.medication_name}</strong>
                            <div style={styles.medSubline}>
                              Dozė: {med.dose}
                              {med.route?.trim() ? ` · Būdas: ${med.route}` : ""}
                              {med.prescription_source?.trim() ? ` · Paskyrimas: ${med.prescription_source}` : ""}
                            </div>
                          </div>

                          <div style={styles.badges}>
                            {med.requires_double_check ? <span style={styles.badgeRed}>2 patikros</span> : null}
                            {med.is_prn ? <span style={styles.badgeBlue}>p.r.n.</span> : null}
                            {given ? <span style={styles.badgeGreen}>Suduota</span> : prepared ? <span style={styles.badgeAmber}>Paruošta</span> : <span style={styles.badgeNeutral}>Laukia</span>}
                          </div>
                        </div>

                        {med.instructions?.trim() ? <p style={styles.note}>{med.instructions}</p> : null}
                        {med.safety_notes?.trim() ? <div style={styles.warningBox}>{med.safety_notes}</div> : null}
                        {med.is_fractional ? <div style={styles.warningBox}>️ Dalinė dozė</div> : null}

                        <div style={styles.stockBoxCompact}>
                          <PackageMinus size={15} />
                          <span>
                            Sandėlis: {stockItem ? `${inventoryName(stockItem)} · ${qty ?? "—"} ${stockItem.unit || ""}` : "nesusieta"} · nurašoma: {med.inventory_units_per_dose || 1}
                          </span>
                        </div>

                        {(() => {
                          const stock = medicationStockStatus(stockItem, med.inventory_units_per_dose || 1)

                          if (stock.level !== "low" && stock.level !== "critical" && stock.level !== "empty") return null

                          return (
                            <div style={stock.level === "empty" ? styles.stockInlineDanger : styles.stockInlineWarning}>
                              <AlertTriangle size={15} />
                              <span>{stock.label}</span>
                            </div>
                          )
                        })()}

                        <div style={styles.actions}>
                          <button
                            type="button"
                            style={prepared || given ? styles.secondaryButton : styles.primaryButton}
                            onClick={() => openPrepareConfirmation([med])}
                            disabled={Boolean(prepared || given) || saving}
                          >
                            {prepared || given ? <Check size={16} /> : null}
                            {prepared || given ? "Paruošta" : "Pažymėti paruoštą"}
                          </button>

                          <button
                            type="button"
                            style={given ? styles.secondaryButton : styles.bigGiveButton}
                            disabled={Boolean(given) || saving}
                            onClick={() => openConfirmModal(med)}
                          >
                            {given ? "Sudavimas patvirtintas" : "Patikrinta ir suduota"}
                          </button>
                        </div>
                      </article>
                    )
                  })}

                  {selectedMedications.length === 0 ? <div style={styles.empty}>Vaistų dar nėra.</div> : null}
                  {selectedMedications.length > 0 && visibleMedications.length === 0 ? (
                    <div style={styles.emptySmall}>
                      {activeMedicineTab === "prn"
                        ? "Šiam gyventojui nėra p.r.n. vaistų."
                        : activeMedicineTab === "unfinished"
                          ? "Neužbaigtų vaistų nėra."
                          : "Visi šiandienos vaistai jau suduoti."}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </main>
        </div>

        <aside style={styles.rightColumn}>
          <section style={styles.panel}>
            <div style={styles.sectionHeaderLine}>
              <div>
                <div style={styles.sectionKicker}>Svarbūs įspėjimai</div>
                <h2 style={styles.sideTitle}>Reikia dėmesio</h2>
              </div>
              <button type="button" style={styles.linkButton}>Peržiūrėti viską</button>
            </div>

            <div style={styles.attentionGridSidebar}>
              {todayAttentionItems.length ? (
                todayAttentionItems.map((item) => (
                  <div
                    key={item.title}
                    style={{
                      ...styles.attentionCard,
                      ...(item.tone === "red"
                        ? styles.attentionCardRed
                        : item.tone === "amber"
                          ? styles.attentionCardAmber
                          : styles.attentionCardBlue),
                    }}
                  >
                    <div style={styles.attentionValue}>{item.value}</div>
                    <div>
                      <div style={styles.attentionCardTitle}>{item.title}</div>
                      <div style={styles.attentionCardText}>{item.description}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={styles.okBox}>
                  <strong>Nėra kritinių įspėjimų</strong>
                  <span>Šiuo metu nėra papildomo dėmesio reikalaujančių vaistų.</span>
                </div>
              )}
            </div>

            {alerts.length > 0 ? (
              <div style={styles.alertBox}>
                <strong>
                  <AlertTriangle size={18} />
                  Smart Alert
                </strong>
                <ul>
                  {alerts.map((alert) => (
                    <li key={alert}>{alert}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionKicker}>Greiti veiksmai</div>
            <div style={styles.quickActionsGrid}>
              <ActionCard title="Paskirti vaistą" text="Sandėlio paieška ir paskyrimo duomenys." button="Pridėti" onClick={() => setShowAddMedicationModal(true)} />
              <ActionCard title="Vitals" text="AKS, pulsas, cukrus, temperatūra, svoris." button="Įvesti" onClick={() => { setActiveMedicineTab("events"); setShowVitalsModal(true) }} />
              <ActionCard title="Dozatorius" text="Pažymėti vieną ar kelis vaistus paruoštais." button="Patvirtinti" onClick={() => void markAllSelectedPrepared()} />
              <ActionCard title="Dalinimo užduotis" text="Priskirti paruoštų vaistų dalinimą." button="Sukurti" onClick={() => setShowTaskModal(true)} />
              <ActionCard title="Istorija" text="Vaistai, vitals ir p.r.n. įrašai." button="Atidaryti" onClick={() => { setActiveMedicineTab("history"); setShowHistoryModal(true) }} />
            </div>
          </section>

        </aside>
      </section>

      <section style={styles.bottomInfoGrid}>
      <section style={styles.panelWide}>
            <div style={styles.sectionKicker}>
              <HeartPulse size={16} />
              Sveikatos rodiklių skydas
            </div>
            <h2 style={styles.sideTitle}>Vitals</h2>

            {alerts.length === 0 ? (
              <div style={styles.okBox}>
                <strong>Rodikliai normos ribose</strong>
                <span>Pagal paskutinį įrašą nėra kritinių įspėjimų.</span>
              </div>
            ) : null}

            <div style={styles.statsGrid}>
              <SmallStat label="AKS" value={latest ? `${latest.bp_sys || "—"}/${latest.bp_dia || "—"}` : "—"} danger={!!latest && ((latest.bp_sys || 0) > norm.bpSysMax || (latest.bp_dia || 0) > norm.bpDiaMax)} />
              <SmallStat label="Pulsas" value={latest?.pulse || "—"} danger={!!latest && ((latest.pulse || 0) < norm.pulseMin || (latest.pulse || 0) > norm.pulseMax)} />
              <SmallStat label="Cukrus" value={latest?.sugar ? `${latest.sugar} mmol/l` : "—"} danger={!!latest && (latest.sugar || 0) > norm.sugarMax} />
              <SmallStat label="Temp." value={latest?.temperature ? `${latest.temperature} °C` : "—"} danger={!!latest && (latest.temperature || 0) > norm.tempMax} />
              <SmallStat label="Svoris" value={latest?.weight ? `${latest.weight} kg` : "—"} />
              <SmallStat label="KMI" value={bmi(latest?.weight)} />
            </div>

            <div style={styles.addBox}>
              <h3 style={styles.smallTitle}>Istorija</h3>
              <div style={styles.historyList}>
                {selectedVitals.slice(0, 6).map((vital) => (
                  <div key={vital.id} style={styles.vitalRow}>
                    <strong>{formatDate(vital.measured_at)}</strong>
                    <span>AKS {vital.bp_sys || "—"}/{vital.bp_dia || "—"}</span>
                    <span>Cukrus {vital.sugar || "—"}</span>
                    <span>Temp. {vital.temperature || "—"}</span>
                  </div>
                ))}
                {selectedVitals.length === 0 ? <div style={styles.empty}>Rodiklių dar nėra.</div> : null}
              </div>
            </div>
          </section>

      <section style={styles.prnBoxWide}>
            <div>
              <h3 style={styles.smallTitle}>Pagal poreikį (p.r.n.)</h3>
              <p style={styles.quickHint}>
                p.r.n. reiškia „pagal poreikį“ — registruojama tik atsiradus konkrečiai priežasčiai, pvz. skausmui.
              </p>
            </div>

            <div style={styles.inlineForm}>
              <input value={prnReason} onChange={(e) => setPrnReason(e.target.value)} placeholder="Priežastis, pvz., galvos skausmas" style={styles.input} />
              <button type="button" disabled={!prnReason.trim() || saving} onClick={() => void addPrnLog()} style={styles.primaryButton}>
                Registruoti
              </button>
            </div>

            {prnLogs
              .filter((log) => log.resident_id === selected.id)
              .slice(0, 3)
              .map((log) => (
                <div key={log.id} style={styles.historyItem}>
                  {formatDate(log.administered_at)} · {log.reason}
                </div>
              ))}
          </section>

      </section>

      {showAddMedicationModal ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.addMedicationModal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Paskirti vaistą</h2>
                <p style={styles.subtitle}>Trumpas įvedimas su sandėlio paieška ir istorija.</p>
              </div>

              <button type="button" onClick={closeAddMedicationModal} style={styles.iconButton}>
                <X size={18} />
              </button>
            </div>

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
                    <input type="checkbox" checked={medForm.is_prn} onChange={(e) => setMedForm({ ...medForm, is_prn: e.target.checked })} />
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

            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={closeAddMedicationModal}>
                Atšaukti
              </button>

              <button type="button" style={styles.primaryButton} onClick={() => void saveMedicationFromModal()} disabled={saving}>
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
                <h2 style={styles.sectionTitle}>Įvesti rodiklius</h2>
                <p style={styles.subtitle}>{residentName(selected, roomsById)}</p>
              </div>
              <button type="button" onClick={() => setShowVitalsModal(false)} style={styles.iconButton}>
                <X size={18} />
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

      {showPrepareModal && prepareMedication ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Dozatoriaus paruošimo patvirtinimas</h2>
                <p style={styles.subtitle}>Vienas trumpas atsakomybės patvirtinimas visiems žemiau išvardintiems vaistams.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPrepareModal(false)
                  setPrepareMedication(null)
                  setPrepareMedicationList([])
                  setPrepareAcknowledged(false)
                  setPrepareSecondCheckerId("")
                }}
                style={styles.iconButton}
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.warningBox}>
              Patikrinkite sąrašą. Patvirtinus visi išvardinti vaistai bus pažymėti kaip paruošti dalinimui.
            </div>

            <div style={styles.prepareList}>
              {(prepareMedicationList.length ? prepareMedicationList : [prepareMedication]).map((medication) => (
                <div key={medication.id} style={styles.prepareListItem}>
                  <div>
                    <div style={styles.prepareMedicationName}>
                      {toTime(medication.scheduled_time)} · {medication.medication_name}
                    </div>
                    <div style={styles.prepareMedicationMeta}>
                      {medication.dose}
                      {medication.route ? ` · ${medication.route}` : ""}
                      {medication.prescription_source ? ` · ${medication.prescription_source}` : ""}
                    </div>
                    {medication.instructions ? (
                      <div style={styles.prepareMedicationNote}>{medication.instructions}</div>
                    ) : null}
                  </div>

                  {medication.requires_double_check ? (
                    <span style={styles.doubleCheckBadge}>Dvigubas tikrinimas</span>
                  ) : null}
                </div>
              ))}
            </div>

            <label style={styles.responsibilityCheck}>
              <input
                type="checkbox"
                checked={prepareAcknowledged}
                onChange={(event) => setPrepareAcknowledged(event.target.checked)}
              />
              <span>
                Patvirtinu, kad patikrinau gyventoją, vaistus, dozes, laiką ir paskyrimo šaltinį. Prisiimu atsakomybę už paruošimą.
              </span>
            </label>

            <div style={styles.checkList}>
              <ConfirmCheck
                label="teisingas gyventojas"
                checked={prepareChecks.resident_checked}
                onChange={(checked) => setPrepareChecks((prev) => ({ ...prev, resident_checked: checked }))}
              />
              <ConfirmCheck
                label="teisingas vaistas"
                checked={prepareChecks.medication_checked}
                onChange={(checked) => setPrepareChecks((prev) => ({ ...prev, medication_checked: checked }))}
              />
              <ConfirmCheck
                label="teisinga dozė"
                checked={prepareChecks.dose_checked}
                onChange={(checked) => setPrepareChecks((prev) => ({ ...prev, dose_checked: checked }))}
              />
              <ConfirmCheck
                label="teisingas laikas"
                checked={prepareChecks.time_checked}
                onChange={(checked) => setPrepareChecks((prev) => ({ ...prev, time_checked: checked }))}
              />
              <ConfirmCheck
                label="patikrintas paskyrimo šaltinis"
                checked={prepareChecks.prescription_checked}
                onChange={(checked) => setPrepareChecks((prev) => ({ ...prev, prescription_checked: checked }))}
              />
            </div>

            {prepareNeedsSecondCheck ? (
              <div style={styles.warningBox}>
                Bent vienam vaistui reikalinga antro darbuotojo patikra.
                <select style={{ ...styles.input, marginTop: 10 }} value={prepareSecondCheckerId} onChange={(e) => setPrepareSecondCheckerId(e.target.value)}>
                  <option value="">Pasirinkti antrą darbuotoją</option>
                  {employees
                    .filter((employee) => employee.user_id !== currentUserId)
                    .map((employee) => (
                      <option key={employee.user_id} value={employee.user_id}>
                        {employeeName(employee)}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setShowPrepareModal(false)
                  setPrepareMedication(null)
                  setPrepareMedicationList([])
                  setPrepareAcknowledged(false)
                  setPrepareSecondCheckerId("")
                }}
              >
                Atšaukti
              </button>
              <button
                type="button"
                style={{
                  ...styles.primaryButton,
                  opacity: prepareAcknowledged && allPrepareChecksOk && (!prepareNeedsSecondCheck || prepareSecondCheckerId) ? 1 : 0.55,
                  cursor: prepareAcknowledged && allPrepareChecksOk && (!prepareNeedsSecondCheck || prepareSecondCheckerId) ? "pointer" : "not-allowed",
                }}
                disabled={!prepareAcknowledged || !allPrepareChecksOk || (prepareNeedsSecondCheck && !prepareSecondCheckerId) || saving}
                onClick={() => void confirmPreparedList()}
              >
                {saving ? "Saugoma..." : "Patvirtinti paruošimą"}
              </button>
            </div>
          </div>
        </div>
      ) : null}


      {showTaskModal ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Dalinimo užduotis</h2>
                <p style={styles.subtitle}>{residentName(selected, roomsById)}</p>
              </div>
              <button type="button" onClick={() => setShowTaskModal(false)} style={styles.iconButton}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.emptySmall}>Paruoštų dalinimui: {preparedNotGiven.length}</div>

            <Field label="Atsakingas darbuotojas">
              <select style={styles.input} value={taskAssigneeId} onChange={(e) => setTaskAssigneeId(e.target.value)}>
                <option value="">Priskirti sau</option>
                {employees.map((employee) => (
                  <option key={employee.user_id} value={employee.user_id}>
                    {employeeName(employee)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Pastaba">
              <textarea style={styles.textareaSmall} value={taskNote} onChange={(e) => setTaskNote(e.target.value)} placeholder="Papildoma informacija dalinimui..." />
            </Field>

            <div style={styles.modalActions}>
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



{showHistoryModal ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.historyModal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Istorija ir eksportas</h2>
                <p style={styles.subtitle}>{residentName(selected, roomsById)}</p>
              </div>
              <button type="button" onClick={() => setShowHistoryModal(false)} style={styles.iconButton}>
                <X size={18} />
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
                  <option value="vitals">Vitals</option>
                  <option value="prn">p.r.n.</option>
                </select>
              </Field>
            </div>

            <div style={styles.historyTableWrap}>
              <table style={styles.historyTable}>
                <thead>
                  <tr>
                    <th>Tipas</th>
                    <th>Data</th>
                    <th>Pavadinimas</th>
                    <th>Dozė / rodikliai</th>
                    <th>Statusas</th>
                    <th>Pastaba</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows().map((row, index) => (
                    <tr key={`${row.tipas}-${row.data}-${index}`}>
                      <td>{row.tipas}</td>
                      <td>{row.data}</td>
                      <td>{row.pavadinimas}</td>
                      <td>{row.doze}</td>
                      <td>{row.statusas}</td>
                      <td>{row.pastaba}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

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
                  <h2 style={styles.giveConfirmTitle}>Patvirtinti sudavimą</h2>
                  <p style={styles.giveConfirmSubtitle}>
                    Vienas trumpas atsakomybės patvirtinimas.
                  </p>
                </div>

                <button type="button" onClick={() => setConfirmMedication(null)} style={styles.giveConfirmClose}>
                  <X size={22} />
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

              <div style={styles.giveDetailsGrid}>
                <div style={styles.giveDetailCard}>
                  <span>Vaistas</span>
                  <strong>{confirmMedication.medication_name}</strong>
                </div>

                <div style={styles.giveDetailCard}>
                  <span>Dozė</span>
                  <strong>{confirmMedication.dose}</strong>
                </div>

                <div style={styles.giveDetailCard}>
                  <span>Laikas</span>
                  <strong>{toTime(confirmMedication.scheduled_time)}</strong>
                </div>

                <div style={styles.giveDetailCard}>
                  <span>Būdas</span>
                  <strong>{confirmMedication.route || "Nenurodyta"}</strong>
                </div>

                <div style={styles.giveDetailCardWide}>
                  <span>Paskyrimo šaltinis</span>
                  <strong>{confirmMedication.prescription_source || "Nenurodyta"}</strong>
                </div>

                <div style={styles.giveDetailCardWide}>
                  <span>Sandėlis</span>
                  <strong>{stockItem ? inventoryName(stockItem) : "Nesusieta su sandėliu"}</strong>
                  <em>
                    Likutis: {stockItem ? `${inventoryQuantity(stockItem) ?? "—"} ${stockItem.unit || ""}` : "—"} · nurašoma: {confirmMedication.inventory_units_per_dose || 1}
                  </em>
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
                      <option value="">Pasirinkti antrą darbuotoją</option>
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

              <div style={styles.shortConfirmText}>
                Patvirtinu, kad prieš sudavimą patikrinau gyventojo tapatybę, vaisto pavadinimą,
                dozę, laiką, vartojimo būdą ir gydytojo / slaugytojo paskyrimą.
              </div>

              <ConfirmCheck
                label="Patvirtinu atsakomybę už šio vaisto patikrinimą ir sudavimą"
                checked={confirmChecks.responsibility_acknowledged}
                onChange={(v) => setConfirmChecks({ responsibility_acknowledged: v })}
                danger
              />

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
  page: { minHeight: "100vh", background: "#ffffff", padding: 20, color: "#10251f", maxWidth: 1500, margin: "0 auto", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
  topShell: { overflow: "hidden", border: "1px solid #c9d8d0", borderRadius: 16, background: "#ffffff", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)" },
  dashboardStatsGrid: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 },
  dashboardStatCard: { background: "#ffffff", border: "1px solid #c9d8d0", borderRadius: 12, padding: 16, display: "grid", gridTemplateColumns: "1fr", gap: 4, alignItems: "center", boxShadow: "0 1px 2px rgba(15,23,42,.05)" },
  statIconGreen: { display: "none" },
  statIconAmber: { display: "none" },
  statIconRed: { display: "none" },
  statLabel: { color: "#6a7e75", fontSize: 11, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.08em" },
  statValue: { marginTop: 2, color: "#10251f", fontSize: 28, fontWeight: 950, lineHeight: 1 },
  statText: { marginTop: 4, color: "#64748b", fontSize: 12, fontWeight: 750 },
  dashboardLayout: { marginTop: 14, display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(360px, 0.65fr)", gap: 16, alignItems: "start" },
  leftColumn: { display: "grid", gap: 16, minWidth: 0 },
  rightColumn: { display: "grid", gap: 16, minWidth: 0, alignSelf: "start" },
  bottomInfoGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 0.55fr)", gap: 20, alignItems: "start" },
  panelWide: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 30, padding: 22, display: "grid", gap: 18, boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)" },
  prnBoxWide: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 30, padding: 22, display: "grid", gap: 16, boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)", alignSelf: "start" },
  panelSoft: { background: "#ffffff", border: "1px solid #c9d8d0", borderRadius: 12, padding: 16, display: "grid", gap: 12, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)" },
  residentCardsCompact: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10, maxHeight: 188, overflow: "auto", paddingRight: 2 },
  contentTabsPanel: { background: "#ffffff", border: "1px solid #c9d8d0", borderRadius: 12, padding: 16, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)" },
  panelInner: { marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 28, padding: 20, display: "grid", gap: 18, background: "#ffffff" },
  tabsBar: { display: "flex", flexWrap: "wrap", gap: 4, borderRadius: 18, background: "#eef2f1", padding: 4 },
  tabButton: { border: "none", background: "transparent", color: "#667085", borderRadius: 14, padding: "11px 18px", fontSize: 14, fontWeight: 950, cursor: "pointer" },
  tabActive: { border: "none", background: "#ffffff", color: "#0f172a", borderRadius: 14, padding: "11px 18px", fontSize: 14, fontWeight: 950, cursor: "pointer", boxShadow: "0 8px 18px rgba(15,23,42,.08)" },
  attentionGridSidebar: { display: "grid", gap: 12 },
  quickActionsGrid: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  sideTitle: { margin: "6px 0 0", fontSize: 22, fontWeight: 950, letterSpacing: "-0.035em" },
  heroActions: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" },
  headerButton: { display: "inline-flex", alignItems: "center", gap: 8, border: "none", borderRadius: 8, background: "#ffffff", color: "#486b5d", padding: "9px 12px", fontSize: 14, fontWeight: 950, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,.06)" },
  headerGhostButton: { display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, background: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.92)", padding: "9px 12px", fontSize: 14, fontWeight: 950, cursor: "pointer" },
  topNav: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, borderBottom: "1px solid #dbe6e0", background: "#f7fcf9", padding: "8px 16px" },
  topTabs: { display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" },
  topTab: { display: "inline-flex", alignItems: "center", gap: 8, border: "none", borderRadius: 8, background: "transparent", color: "#486b5d", padding: "8px 12px", fontSize: 14, fontWeight: 950, cursor: "pointer" },
  topTabActive: { display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #c9d8d0", borderRadius: 8, background: "#ffffff", color: "#486b5d", padding: "8px 12px", fontSize: 14, fontWeight: 950, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,.06)" },
  compactButton: { marginLeft: "auto", border: "1px solid #c2d3ca", borderRadius: 8, background: "#ffffff", color: "#486b5d", padding: "8px 12px", fontSize: 12, fontWeight: 950, cursor: "pointer" },
  actionToolbar: { marginTop: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, border: "1px solid #dbe6e0", background: "#ffffff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 2px rgba(15,23,42,.04)" },
  toolbarGroupLabel: { color: "#6a7e75", fontSize: 11, fontWeight: 950, letterSpacing: "0.18em", textTransform: "uppercase" },
  toolbarButton: { border: "1px solid #dbe6e0", borderRadius: 8, background: "#ffffff", color: "#486b5d", padding: "8px 12px", fontSize: 13, fontWeight: 950, cursor: "pointer" },
  toolbarDivider: { width: 1, height: 24, background: "#dbe6e0" },
  toolbarSearch: { display: "flex", alignItems: "center", gap: 8, border: "1px solid #dbe6e0", borderRadius: 8, background: "#ffffff", padding: "0 10px", height: 38, minWidth: 260, color: "#94a3b8" },
  toolbarSearchInput: { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: 13, fontWeight: 700, color: "#10251f" },
  warningPill: { marginLeft: "auto", border: "1px solid #fecdd3", background: "#fff1f2", color: "#be123c", borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 950 },
  hero: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, background: "#486b5d", border: "none", borderRadius: 0, padding: "16px 20px", boxShadow: "none", color: "#ffffff" },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 28,
    background: "#eef8f1",
    color: "#0b7a53",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { margin: 0, color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.18em" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 950, letterSpacing: "-0.035em", lineHeight: 1.08, color: "#ffffff" },
  subtitle: { margin: "4px 0 0", maxWidth: 860, color: "rgba(255,255,255,0.82)", fontSize: 14, fontWeight: 650, lineHeight: 1.45 },
  lockCard: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 24, padding: 14, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 16px 34px rgba(15, 23, 42, 0.08)" },
  disclaimer: { marginTop: 14, background: "#fff8ef", border: "1px solid #f3d49a", color: "#985b00", borderRadius: 16, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, fontWeight: 800, lineHeight: 1.45 },
  residentsSection: {
    marginTop: 16,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 28,
    padding: 18,
    display: "grid",
    gap: 14,
    boxShadow: "0 12px 28px rgba(15,23,42,.045)",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "0 12px",
    height: 44,
    background: "#f7f8f7",
  },
  searchInput: {
    border: "none",
    outline: "none",
    flex: 1,
    fontSize: 14,
    fontWeight: 700,
    background: "transparent",
    color: "#0f172a",
  },
  residentCards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 12,
  },
  residentCard: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gridTemplateColumns: "44px 1fr auto",
    gap: 12,
    alignItems: "center",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(15,23,42,.035)",
  },
  residentCardActive: {
    border: "1px solid #0b7a53",
    background: "#eef8f1",
    boxShadow: "0 0 0 3px rgba(4,120,87,.08)",
  },
  residentCardAlert: {
    border: "1px solid #ffd6d6",
    background: "#fffafa",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 18,
    background: "#eef8f1",
    color: "#0b7a53",
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
    border: "1px solid #e5e7eb",
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
  panel: { background: "#ffffff", border: "1px solid #c9d8d0", borderRadius: 12, padding: 18, display: "grid", gap: 14, alignContent: "start", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)" },
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
    color: "#0b7a53",
    fontSize: 13,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  sectionTitle: {
    margin: "8px 0 0",
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 12,
  },
  smallStat: {
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 14,
    background: "#f7f8f7",
  },
  smallStatDanger: {
    borderColor: "#fca5a5",
    background: "#fff4f4",
    color: "#b42318",
  },
  distributionBox: {
    border: "1px solid #d7efe3",
    background: "#eef8f1",
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
    border: "1px solid #d7efe3",
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
    background: "#0b7a53",
    color: "#ffffff",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 950,
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
    border: "1px solid #d7efe3",
    background: "#eef8f1",
    color: "#0b7a53",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },
  medGrid: {
    display: "grid",
    gap: 12,
  },
  medCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 16,
    display: "grid",
    gap: 12,
    background: "#ffffff",
    boxShadow: "0 10px 24px rgba(15,23,42,.035)",
  },
  medCardDone: {
    background: "#f7f8f7",
    opacity: 0.88,
  },
  medHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
  },
  medSubline: {
    marginTop: 5,
    color: "#667085",
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
    background: "#fff8ef",
    color: "#be123c",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 950,
  },
  badgeBlue: {
    background: "#eef4ff",
    color: "#315f9e",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 950,
  },
  badgeGreen: {
    background: "#e9f7ef",
    color: "#0b7a53",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 950,
  },
  badgeRed: {
    background: "#fff4f4",
    color: "#b42318",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 950,
  },
  badgeNeutral: {
    background: "#eef2f1",
    color: "#526174",
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 950,
  },
  warningBox: {
    background: "#fff8ef",
    color: "#be123c",
    border: "1px solid #ffe0b2",
    borderRadius: 18,
    padding: 12,
    fontWeight: 900,
  },
  stockBoxCompact: {
    display: "flex",
    gap: 9,
    alignItems: "center",
    background: "#f7f8f7",
    border: "1px solid #e5e7eb",
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
    background: "#0b7a53",
    color: "#ffffff",
    borderRadius: 16,
    padding: "11px 15px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  secondaryButton: {
    border: "1px solid #d7ddd9",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 16,
    padding: "11px 15px",
    fontSize: 13,
    fontWeight: 950,
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
    fontWeight: 950,
    cursor: "not-allowed",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  bigGiveButton: {
    border: "none",
    background: "#0b7a53",
    color: "#ffffff",
    borderRadius: 18,
    padding: "13px 18px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    marginTop: 14,
    padding: 14,
    borderRadius: 20,
    background: "#eef8f1",
    border: "1px solid #cfeadd",
    color: "#0b7a53",
    fontWeight: 900,
  },
  addBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 24,
    padding: 18,
    display: "grid",
    gap: 14,
    background: "#ffffff",
  },
  prnBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 24,
    padding: 18,
    display: "grid",
    gap: 14,
    background: "#ffffff",
  },
  smallTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
  },
  quickHint: {
    margin: "5px 0 0",
    color: "#0b7a53",
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1.45,
  },
  field: {
    display: "grid",
    gap: 7,
    color: "#3e4b5f",
    fontSize: 13,
    fontWeight: 850,
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
    background: "#f7f8f7",
    border: "1px solid #e5e7eb",
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
    background: "#eef8f1",
    color: "#0b7a53",
    border: "1px solid #cfeadd",
    borderRadius: 22,
    padding: 16,
    display: "grid",
    gap: 5,
    alignSelf: "start",
  },
  meta: {
    color: "#667085",
    fontSize: 12,
    fontWeight: 800,
  },
  stepper: {
    display: "grid",
    gridTemplateColumns: "1fr 46px 70px 46px",
    alignItems: "center",
    gap: 9,
    background: "#f7f8f7",
    borderRadius: 18,
    padding: 10,
  },
  stepButton: {
    border: "1px solid #d7ddd9",
    background: "#ffffff",
    borderRadius: 14,
    height: 40,
    cursor: "pointer",
    fontWeight: 950,
  },
  vitalRow: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
    gap: 10,
    background: "#f7f8f7",
    borderRadius: 16,
    padding: 12,
    fontSize: 13,
  },
  empty: {
    padding: 20,
    color: "#667085",
    textAlign: "center",
    border: "1px dashed #d7ddd9",
    borderRadius: 20,
    fontWeight: 750,
  },
  emptySmall: {
    padding: 14,
    color: "#667085",
    textAlign: "center",
    border: "1px dashed #d7ddd9",
    borderRadius: 18,
    fontSize: 13,
    fontWeight: 750,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    zIndex: 50,
    backdropFilter: "blur(5px)",
  },
  modal: {
    width: "100%",
    maxWidth: 780,
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 32,
    padding: 24,
    display: "grid",
    gap: 18,
    boxShadow: "0 26px 76px rgba(15, 23, 42, 0.30)",
    border: "1px solid #e5e7eb",
  },
  addMedicationModal: {
    width: "100%",
    maxWidth: 840,
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 32,
    padding: 24,
    display: "grid",
    gap: 18,
    boxShadow: "0 26px 76px rgba(15, 23, 42, 0.30)",
    border: "1px solid #e5e7eb",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 14,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    background: "#f7f8f7",
    cursor: "pointer",
    color: "#526174",
  },
  modalStep: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    background: "#f7f8f7",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 14,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: "#0b7a53",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
  },
  quickBox: {
    border: "1px solid #d7efe3",
    background: "#f7f8f7",
    borderRadius: 24,
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
    border: "1px solid #d7efe3",
    background: "#ffffff",
    borderRadius: 18,
    padding: 12,
    display: "grid",
    gap: 5,
    textAlign: "left",
    cursor: "pointer",
    color: "#0f172a",
  },
  quickItemActive: {
    border: "1px solid #0b7a53",
    background: "#eef8f1",
    boxShadow: "0 0 0 3px rgba(4,120,87,.08)",
  },
  templateChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 9,
  },
  templateChip: {
    border: "1px solid #d7efe3",
    background: "#ffffff",
    borderRadius: 999,
    padding: "9px 13px",
    cursor: "pointer",
    fontWeight: 950,
    color: "#064236",
  },
  modalFormGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },
  moreButton: {
    border: "1px solid #d7ddd9",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 18,
    padding: "13px 15px",
    fontWeight: 950,
    cursor: "pointer",
  },
  advancedBox: {
    border: "1px solid #e5e7eb",
    background: "#f7f8f7",
    borderRadius: 24,
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
    background: "#ffffff",
    border: "1px solid #dbe6e0",
  },

  prepareMedicationName: {
    fontSize: 15,
    fontWeight: 900,
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
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9a3412",
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 900,
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
    background: "#f7f8f7",
    borderRadius: 24,
    padding: 18,
    border: "1px solid #e5e7eb",
  },
  bigAvatar: {
    width: 82,
    height: 82,
    borderRadius: 28,
    background: "#eef8f1",
    color: "#0b7a53",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 950,
  },
  checkList: {
    display: "grid",
    gap: 10,
  },
  confirmCheck: {
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 12,
    fontSize: 13,
    fontWeight: 800,
  },
  confirmCheckDanger: {
    background: "#fff8ef",
    borderColor: "#ffe0b2",
    color: "#be123c",
  },
  shortConfirmText: {
    background: "#f7f8f7",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 14,
    color: "#3e4b5f",
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.5,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    borderTop: "1px solid #e5e7eb",
    paddingTop: 14,
  },
  historyModal: {
    width: "100%",
    maxWidth: 1120,
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 32,
    padding: 24,
    display: "grid",
    gap: 18,
    boxShadow: "0 26px 76px rgba(15, 23, 42, 0.30)",
    border: "1px solid #e5e7eb",
  },
  historyFilters: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
  },
  historyTableWrap: {
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    overflow: "auto",
    maxHeight: 480,
  },
  historyTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },

  moreLink: {
    marginTop: 12,
    border: "none",
    background: "transparent",
    color: "#0b7a53",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 950,
    textDecoration: "underline",
    textUnderlineOffset: 4,
    cursor: "pointer",
  },
  instructionModal: {
    width: "100%",
    maxWidth: 1050,
    maxHeight: "92vh",
    overflow: "hidden",
    borderRadius: 32,
    border: "1px solid #e5e7eb",
    background: "#f4f7f3",
    boxShadow: "0 26px 76px rgba(15,23,42,.30)",
    display: "flex",
    flexDirection: "column",
  },
  instructionHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 24,
    borderBottom: "1px solid #e5e7eb",
    background: "#ffffff",
    padding: "28px 30px",
  },
  instructionKicker: {
    margin: "0 0 8px",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.24em",
    color: "#0b7a53",
  },
  instructionTitle: {
    margin: 0,
    fontSize: 42,
    fontWeight: 950,
    letterSpacing: "-0.05em",
    color: "#0f172a",
    lineHeight: 1.05,
  },
  instructionSubtitle: {
    margin: "12px 0 0",
    maxWidth: 760,
    fontSize: 16,
    fontWeight: 750,
    lineHeight: 1.65,
    color: "#667085",
  },
  instructionClose: {
    width: 52,
    height: 52,
    flexShrink: 0,
    border: "none",
    borderRadius: 20,
    background: "#eef8f1",
    color: "#064236",
    fontSize: 32,
    lineHeight: 1,
    cursor: "pointer",
  },
  instructionBody: {
    overflowY: "auto",
    padding: 28,
    display: "grid",
    gap: 22,
  },
  instructionHighlight: {
    display: "flex",
    gap: 16,
    border: "1px solid #d7efe3",
    background: "#eef8f1",
    borderRadius: 28,
    padding: 24,
  },
  instructionNumber: {
    width: 44,
    height: 44,
    borderRadius: 18,
    background: "#e6f7ed",
    color: "#0b7a53",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 950,
    flexShrink: 0,
  },
  instructionSectionTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 950,
    color: "#0f172a",
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
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 10px 24px rgba(15,23,42,.04)",
  },
  instructionCardNumber: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: "#eef8f1",
    color: "#064236",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 950,
    marginBottom: 12,
  },
  instructionCardTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 950,
    color: "#0f172a",
  },
  instructionCardText: {
    margin: "8px 0 0",
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.65,
    color: "#667085",
  },
  instructionWarningCard: {
    borderColor: "#f1b44c",
    background: "#fff8ef",
  },
  instructionWarningNumber: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: "#ffe0a3",
    color: "#be123c",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 950,
    marginBottom: 12,
  },
  instructionWarningTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 950,
    color: "#78350f",
  },
  instructionWarningText: {
    margin: "8px 0 0",
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.65,
    color: "#be123c",
  },
  instructionFooter: {
    borderTop: "1px solid #e5e7eb",
    background: "#ffffff",
    padding: "18px 30px",
    display: "flex",
    justifyContent: "flex-end",
  },
  instructionDone: {
    border: "none",
    borderRadius: 18,
    background: "#064236",
    color: "#ffffff",
    padding: "14px 28px",
    fontSize: 16,
    fontWeight: 950,
    cursor: "pointer",
  },

  attentionSection: {
    marginTop: 16,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 30,
    padding: 22,
    display: "grid",
    gap: 18,
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)",
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
    fontWeight: 950,
    letterSpacing: "-0.04em",
    color: "#0f172a",
  },
  attentionSubtitle: {
    margin: "8px 0 0",
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.6,
    color: "#667085",
  },
  attentionButton: {
    border: "1px solid #d7efe3",
    background: "#eef8f1",
    color: "#0b7a53",
    borderRadius: 18,
    padding: "12px 16px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  attentionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
  },
  attentionCard: {
    borderRadius: 24,
    padding: 18,
    display: "grid",
    gridTemplateColumns: "58px 1fr",
    alignItems: "center",
    gap: 14,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    boxShadow: "0 10px 24px rgba(15,23,42,.04)",
  },
  attentionCardRed: {
    borderColor: "#ffd6d6",
    background: "#fff4f4",
  },
  attentionCardAmber: {
    borderColor: "#ffe0a3",
    background: "#fff8ef",
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
    fontWeight: 950,
    lineHeight: 1,
    color: "#0f172a",
    boxShadow: "0 8px 18px rgba(15,23,42,.05)",
  },
  attentionCardTitle: {
    fontSize: 17,
    fontWeight: 950,
    color: "#0f172a",
  },
  attentionCardText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
    color: "#526174",
  },

}
