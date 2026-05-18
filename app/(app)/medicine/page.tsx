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

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const [showAddMedicationModal, setShowAddMedicationModal] = useState(false)
  const [showVitalsModal, setShowVitalsModal] = useState(false)
  const [showPrepareModal, setShowPrepareModal] = useState(false)
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
          .select("id, full_name, first_name, last_name, resident_code, current_room_id")
          .eq("organization_id", orgId)
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

    const profileMap = new Map((profiles.data || []).map((p: any) => [p.id, p]))

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
    return selectedMedications.filter((med) => !getMedicationLog(med.id, "given") || showCompletedMeds)
  }, [selectedMedications, adminLogs, showCompletedMeds])

  const stats = useMemo(() => {
    const activeMeds = selectedMedications.length
    const prepared = selectedMedications.filter((med) => getMedicationLog(med.id, "prepared")).length
    const given = selectedMedications.filter((med) => getMedicationLog(med.id, "given")).length
    const linkedStock = selectedMedications.filter((med) => med.inventory_item_id).length
    return { activeMeds, prepared, given, linkedStock }
  }, [selectedMedications, adminLogs])

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
        inventory_item_id: medForm.inventory_item_id || null,
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

  async function markPrepared(medication: Medication) {
    try {
      if (!organizationId || !selected || !currentUserId) return

      if (!medication.prescription_source) {
        setMessage("Negalima pažymėti: nenurodytas paskyrimo šaltinis.")
        return
      }

      setSaving(true)

      const { error } = await supabase.from("medication_administration_logs").insert({
        organization_id: organizationId,
        resident_id: selected.id,
        medication_id: medication.id,
        scheduled_for: `${todayKey()}T${toTime(medication.scheduled_time)}:00`,
        status: "prepared",
        prepared_by: currentUserId,
        prepared_at: new Date().toISOString(),
        notes: medication.instructions,
      })

      if (error) throw error
      setShowPrepareModal(false)
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko pažymėti dozatoriaus.")
    } finally {
      setSaving(false)
    }
  }

  async function markAllSelectedPrepared() {
    try {
      const notPrepared = selectedMedications.filter((med) => !getMedicationLog(med.id, "prepared") && !getMedicationLog(med.id, "given"))
      if (notPrepared.length === 0) {
        setMessage("Nėra vaistų, kuriuos reikėtų pažymėti kaip paruoštus.")
        return
      }

      for (const med of notPrepared) {
        await markPrepared(med)
      }

      setMessage("Dozatorius pažymėtas kaip paruoštas.")
    } catch {
      setMessage("Nepavyko pažymėti visų vaistų kaip paruoštų.")
    }
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
    medications.some((med: any) => !med.givenAt)
      ? {
          title: "Nesuduoti vaistai",
          value: medications.filter((med: any) => !med.givenAt).length,
          tone: "red",
          description: "Dar yra vaistų, kurie nepažymėti kaip suduoti.",
        }
      : null,
    medications.some((med: any) => med.prn && !med.reason)
      ? {
          title: "P.R.N. be priežasties",
          value: medications.filter((med: any) => med.prn && !med.reason).length,
          tone: "amber",
          description: "Reikia papildyti skyrimo pagrindą.",
        }
      : null,
    medications.some((med: any) => med.doubleCheck)
      ? {
          title: "Dviguba patikra",
          value: medications.filter((med: any) => med.doubleCheck).length,
          tone: "blue",
          description: "Vaistams reikalinga papildoma darbuotojo patikra.",
        }
      : null,
    medications.some((med: any) => med.stockLeft !== undefined && med.stockLeft <= 5)
      ? {
          title: "Mažas likutis",
          value: medications.filter((med: any) => med.stockLeft !== undefined && med.stockLeft <= 5).length,
          tone: "amber",
          description: "Kai kurių vaistų likutis artėja prie pabaigos.",
        }
      : null,
  ].filter(Boolean)

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <div style={styles.kicker}>
            <ShieldCheck size={15} />
            Medicina
          </div>
          <h1 style={styles.title}>Medicina</h1>
          <p style={styles.subtitle}>
            Vaistai, sveikatos įrašai, p.r.n., dozatorių paruošimas, dalinimo užduotys,
            sandėlio nurašymas ir gyventojų rodikliai vienoje vietoje.
          </p>

          <button type="button" style={styles.moreLink} onClick={() => setShowHelpModal(true)}>
            <Info size={16} />
            Plačiau
          </button>
        </div>

        <div style={styles.heroActions}>
          <button type="button" style={styles.secondaryButton} onClick={() => void loadAll()}>
            <RefreshCw size={16} />
            Atnaujinti
          </button>
          <button type="button" style={styles.primaryButton} onClick={() => setShowAddMedicationModal(true)}>
            <Plus size={16} />
            Naujas įrašas
          </button>
        </div>

        <div style={styles.lockCard}>
          {unlocked ? <Unlock size={22} color="#0b7a53" /> : <Lock size={22} color="#667085" />}
          <div>
            <div style={styles.meta}>BDAR</div>
            <strong>{unlocked ? "Atrakinta" : "Nuasmeninta"}</strong>
          </div>
          <button type="button" style={unlocked ? styles.secondaryButton : styles.primaryButton} onClick={() => setUnlocked((v) => !v)}>
            {unlocked ? "Užrakinti" : "Atrakinti"}
          </button>
        </div>
      </section>

      <section style={styles.disclaimer}>
        <ShieldAlert size={19} />
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
              {["Vaistai", "PRN", "Įvykiai", "Žurnalas", "Neužbaigta"].map((tab, index) => (
                <button key={tab} type="button" style={index === 0 ? styles.tabActive : styles.tabButton}>
                  {tab}
                </button>
              ))}
            </div>

            <section style={styles.panelInner}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.sectionKicker}>
                    <ClipboardList size={16} />
                    Vaistų kontrolė
                  </div>
                  <h2 style={styles.sectionTitle}>
                    {unlocked ? residentName(selected, roomsById) : `${residentInitials(selected)} · ${roomsById[selected.current_room_id || ""] || "Kambarys —"}`}
                  </h2>
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
                  <h3 style={styles.smallTitle}>Vaistai</h3>
                  <button type="button" style={styles.linkButton} onClick={() => setShowCompletedMeds((v) => !v)}>
                    {showCompletedMeds ? "Slėpti suduotus" : "Rodyti suduotus"}
                  </button>
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
                        {med.is_fractional ? <div style={styles.warningBox}>⚠️ Dalinė dozė</div> : null}

                        <div style={styles.stockBoxCompact}>
                          <PackageMinus size={15} />
                          <span>
                            Sandėlis: {stockItem ? `${inventoryName(stockItem)} · ${qty ?? "—"} ${stockItem.unit || ""}` : "nesusieta"} · nurašoma: {med.inventory_units_per_dose || 1}
                          </span>
                        </div>

                        <div style={styles.actions}>
                          <button
                            type="button"
                            style={prepared || given ? styles.secondaryButton : styles.primaryButton}
                            onClick={() => void markPrepared(med)}
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
                    <div style={styles.emptySmall}>Visi šiandienos vaistai jau suduoti.</div>
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
                todayAttentionItems.map((item: any) => (
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
              <ActionCard title="Vitals" text="AKS, pulsas, cukrus, temperatūra, svoris." button="Įvesti" onClick={() => setShowVitalsModal(true)} />
              <ActionCard title="Dozatorius" text="Pažymėti vieną ar kelis vaistus paruoštais." button="Patvirtinti" onClick={() => setShowPrepareModal(true)} />
              <ActionCard title="Dalinimo užduotis" text="Priskirti paruoštų vaistų dalinimą." button="Sukurti" onClick={() => setShowTaskModal(true)} />
              <ActionCard title="Istorija" text="Vaistai, vitals ir p.r.n. įrašai." button="Atidaryti" onClick={() => setShowHistoryModal(true)} />
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

      {showPrepareModal ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Dozatoriaus patvirtinimas</h2>
                <p style={styles.subtitle}>Pažymėti vaistus kaip paruoštus dalinimui.</p>
              </div>
              <button type="button" onClick={() => setShowPrepareModal(false)} style={styles.iconButton}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.historyList}>
              {selectedMedications
                .filter((med) => !getMedicationLog(med.id, "prepared") && !getMedicationLog(med.id, "given"))
                .map((med) => (
                  <div key={med.id} style={styles.distributionItem}>
                    <div>
                      <strong>{toTime(med.scheduled_time)} · {med.medication_name}</strong>
                      <div style={styles.meta}>{med.dose}</div>
                    </div>
                    <button type="button" style={styles.primaryButton} onClick={() => void markPrepared(med)} disabled={saving}>
                      Paruošta
                    </button>
                  </div>
                ))}

              {selectedMedications.filter((med) => !getMedicationLog(med.id, "prepared") && !getMedicationLog(med.id, "given")).length === 0 ? (
                <div style={styles.emptySmall}>Visi aktyvūs vaistai jau paruošti arba suduoti.</div>
              ) : null}
            </div>

            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => setShowPrepareModal(false)}>Uždaryti</button>
              <button type="button" style={styles.primaryButton} onClick={() => void markAllSelectedPrepared()} disabled={saving}>
                Pažymėti visus
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
                <h2 style={styles.sectionTitle}>Nukreipti dalinimui</h2>
                <p style={styles.subtitle}>Sukurti darbuotojui užduotį dėl paruoštų vaistų.</p>
              </div>
              <button type="button" onClick={() => setShowTaskModal(false)} style={styles.iconButton}>
                <X size={18} />
              </button>
            </div>

            <Field label="Darbuotojas">
              <select style={styles.input} value={taskAssigneeId} onChange={(e) => setTaskAssigneeId(e.target.value)}>
                <option value="">Priskirti man</option>
                {employees.map((employee) => (
                  <option key={employee.user_id} value={employee.user_id}>
                    {employeeName(employee)}
                  </option>
                ))}
              </select>
            </Field>

            <textarea style={styles.textareaSmall} value={taskNote} onChange={(e) => setTaskNote(e.target.value)} placeholder="Papildoma pastaba darbuotojui..." />

            <div style={styles.emptySmall}>Paruoštų dalinimui: {preparedNotGiven.length}</div>

            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => setShowTaskModal(false)}>Atšaukti</button>
              <button type="button" style={styles.primaryButton} onClick={() => void createMedicationDistributionTask()} disabled={saving || preparedNotGiven.length === 0}>
                Sukurti užduotį
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
                <select style={styles.input} value={historyType} onChange={(e) => setHistoryType(e.target.value as any)}>
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

      {confirmMedication ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Patvirtinti sudavimą</h2>
                <p style={styles.subtitle}>Vienas trumpas atsakomybės patvirtinimas.</p>
              </div>

              <button type="button" onClick={() => setConfirmMedication(null)} style={styles.iconButton}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.identityCard}>
              <div style={styles.bigAvatar}>{residentInitials(selected)}</div>

              <div>
                <div style={styles.meta}>Gyventojas</div>
                <h3 style={{ margin: "4px 0" }}>{residentName(selected, roomsById)}</h3>
                <p style={{ margin: 0, color: "#667085" }}>
                  {confirmMedication.medication_name} · {confirmMedication.dose} · {toTime(confirmMedication.scheduled_time)}
                </p>
              </div>
            </div>

            {confirmMedication.requires_double_check ? (
              <div style={styles.warningBox}>
                Šiam vaistui reikalinga antro darbuotojo patikra.
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
            ) : null}

            <div style={styles.checkList}>
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
            </div>

            <textarea style={styles.textareaSmall} value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} placeholder="Papildoma pastaba..." />

            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => setConfirmMedication(null)}>
                Atšaukti
              </button>

              <button
                type="button"
                style={allConfirmChecksOk && !Boolean(confirmMedication?.requires_double_check && !secondCheckerId) ? styles.primaryButton : styles.disabledButton}
                onClick={() => void confirmGivenSafely()}
                disabled={!allConfirmChecksOk || Boolean(confirmMedication?.requires_double_check && !secondCheckerId) || saving}
              >
                <Check size={16} />
                Patvirtinti ir nurašyti
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
  page: { minHeight: "100vh", background: "#f4f7f3", padding: 24, color: "#0f172a", maxWidth: 1500, margin: "0 auto" },
  dashboardStatsGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 16,
  },
  dashboardStatCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 28,
    padding: 22,
    display: "grid",
    gridTemplateColumns: "58px 1fr",
    gap: 16,
    alignItems: "center",
    boxShadow: "0 16px 34px rgba(15,23,42,.055)",
  },
  statIconGreen: { width: 58, height: 58, borderRadius: 22, background: "#e9f7ef", color: "#0b7a53", display: "flex", alignItems: "center", justifyContent: "center" },
  statIconAmber: { width: 58, height: 58, borderRadius: 22, background: "#fff8ef", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" },
  statIconRed: { width: 58, height: 58, borderRadius: 22, background: "#fff4f4", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" },
  statLabel: { color: "#526174", fontSize: 12, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.14em" },
  statValue: { marginTop: 4, color: "#0f172a", fontSize: 34, fontWeight: 950, lineHeight: 1 },
  statText: { marginTop: 8, color: "#3e4b5f", fontSize: 14, fontWeight: 800 },
  dashboardLayout: { marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(360px, 0.65fr)", gap: 20, alignItems: "start" },
  leftColumn: { display: "grid", gap: 16, minWidth: 0 },
  rightColumn: { display: "grid", gap: 16, minWidth: 0, alignSelf: "start" },
  bottomInfoGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 0.55fr)", gap: 20, alignItems: "start" },
  panelWide: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 30, padding: 22, display: "grid", gap: 18, boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)" },
  prnBoxWide: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 30, padding: 22, display: "grid", gap: 16, boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)", alignSelf: "start" },
  panelSoft: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 30, padding: 18, display: "grid", gap: 14, boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)" },
  residentCardsCompact: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12, maxHeight: 188, overflow: "auto", paddingRight: 2 },
  contentTabsPanel: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 32, padding: 18, boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)" },
  panelInner: { marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 28, padding: 20, display: "grid", gap: 18, background: "#ffffff" },
  tabsBar: { display: "flex", flexWrap: "wrap", gap: 4, borderRadius: 18, background: "#eef2f1", padding: 4 },
  tabButton: { border: "none", background: "transparent", color: "#667085", borderRadius: 14, padding: "11px 18px", fontSize: 14, fontWeight: 950, cursor: "pointer" },
  tabActive: { border: "none", background: "#ffffff", color: "#0f172a", borderRadius: 14, padding: "11px 18px", fontSize: 14, fontWeight: 950, cursor: "pointer", boxShadow: "0 8px 18px rgba(15,23,42,.08)" },
  attentionGridSidebar: { display: "grid", gap: 12 },
  quickActionsGrid: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  sideTitle: { margin: "6px 0 0", fontSize: 22, fontWeight: 950, letterSpacing: "-0.035em" },
  heroActions: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
  hero: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 18, alignItems: "center", background: "transparent", border: "none", borderRadius: 0, padding: "10px 0 14px", boxShadow: "none" },
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
  kicker: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#0b7a53",
    fontSize: 13,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
  },
  title: { margin: "8px 0 0", fontSize: 42, fontWeight: 950, letterSpacing: "-0.055em", lineHeight: 1.03 },
  subtitle: { margin: "8px 0 0", maxWidth: 920, color: "#3e4b5f", fontSize: 16, fontWeight: 750, lineHeight: 1.5 },
  lockCard: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 24, padding: 14, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 16px 34px rgba(15, 23, 42, 0.08)" },
  disclaimer: { marginTop: 16, background: "#fff8ef", border: "1px solid #ffe0b2", color: "#a15c07", borderRadius: 24, padding: 18, display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, fontWeight: 800, lineHeight: 1.55 },
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
    borderRadius: 20,
    padding: "0 14px",
    height: 52,
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
  panel: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 30,
    padding: 22,
    display: "grid",
    gap: 18,
    alignContent: "start",
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)",
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
    color: "#a15c07",
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
    color: "#a15c07",
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
    color: "#a15c07",
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
    color: "#a15c07",
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
    color: "#a15c07",
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
