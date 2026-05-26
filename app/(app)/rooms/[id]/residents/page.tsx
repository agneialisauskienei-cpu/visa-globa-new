// @ts-nocheck
"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  AlertTriangle,
  ArrowRightLeft,
  Bed,
  Building2,
  CheckCircle2,
  CalendarDays,
  DoorOpen,
  Download,
  Hammer,
  Home,
  Layers,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/current-organization"

type Gender = "male" | "female" | "mixed" | ""
type RoomType = "single" | "double" | "triple" | "quad" | "other"
type AssignMode = "active" | "arriving_soon" | "hospital" | "temporary_leave"
type ModalMode = "details" | "reserve"
type RoomTab = "overview" | "rooms" | "occupancy" | "reservations" | "repairs" | "export"

type RoomRow = {
  id: string
  organization_id: string
  name: string
  room_type: RoomType | null
  capacity: number | null
  floor: number | null
  gender: Gender | null
  area_m2: number | null
  sort_order: number | null
  oxygen: boolean | null
  nursing: boolean | null
  wc: boolean | null
  shower: boolean | null
  sink: boolean | null
  functional_bed: boolean | null
  wheelchair_accessible: boolean | null
  notes: string | null
  is_active: boolean | null
  created_at: string | null
  occupied_by?: string | null
  reserved_for?: string | null
  reserved_until?: string | null
  room_status?: string | null
}

type Room = {
  id: string
  organization_id: string
  name: string
  room_type: RoomType
  capacity: number
  floor: number | null
  gender: Gender
  area_m2: number | null
  sort_order: number | null
  oxygen: boolean
  nursing: boolean
  wc: boolean
  shower: boolean
  sink: boolean
  functional_bed: boolean
  wheelchair_accessible: boolean
  notes: string
  is_active: boolean
  created_at: string | null
  occupied_by: string | null
  reserved_for: string | null
  reserved_until: string | null
  room_status: string | null
  occupied: number
  reserved: number
}

type Resident = {
  id: string
  resident_id?: string | null
  organization_id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  resident_code: string | null
  current_room_id: string | null
  room_id?: string | null
  current_status: string | null
  status: string | null
  archived_at: string | null
  room_reserved_until: string | null
  is_active: boolean | null
  care_level?: string | null
}

type RoomForm = {
  id: string
  name: string
  room_type: RoomType
  capacity: string
  floor: string
  gender: Gender
  area_m2: string
  sort_order: string
  oxygen: boolean
  nursing: boolean
  wc: boolean
  shower: boolean
  sink: boolean
  functional_bed: boolean
  wheelchair_accessible: boolean
  notes: string
  is_active: boolean
  room_status: string
}

type BulkForm = {
  prefix: string
  startNumber: string
  startSortOrder: string
  floor: string
  gender: Gender
  singleCount: string
  doubleCount: string
  tripleCount: string
  quadCount: string
  otherCount: string
  otherCapacity: string
}

type AssignForm = {
  roomId: string
  residentId: string
  mode: AssignMode
  reservedUntil: string
}

const emptyRoomForm: RoomForm = {
  id: "",
  name: "",
  room_type: "single",
  capacity: "1",
  floor: "",
  gender: "",
  area_m2: "",
  sort_order: "",
  oxygen: false,
  nursing: false,
  wc: false,
  shower: false,
  sink: false,
  functional_bed: false,
  wheelchair_accessible: false,
  notes: "",
  is_active: true,
  room_status: "",
}

const emptyBulkForm: BulkForm = {
  prefix: "",
  startNumber: "101",
  startSortOrder: "1",
  floor: "",
  gender: "",
  singleCount: "0",
  doubleCount: "0",
  tripleCount: "0",
  quadCount: "0",
  otherCount: "0",
  otherCapacity: "5",
}

const emptyAssignForm: AssignForm = {
  roomId: "",
  residentId: "",
  mode: "active",
  reservedUntil: "",
}

function toInt(value: string | number | null | undefined, fallback = 0) {
  const n = parseInt(String(value ?? ""), 10)
  return Number.isFinite(n) ? n : fallback
}

function toNumber(value: string | number | null | undefined, fallback: number | null = null) {
  const n = Number(String(value ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : fallback
}

function text(value: unknown, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback
  return String(value)
}

function formatType(type: RoomType) {
  switch (type) {
    case "single":
      return "Vienvietis"
    case "double":
      return "Dvivietis"
    case "triple":
      return "Trivietis"
    case "quad":
      return "Keturvietis"
    default:
      return "Kitas"
  }
}

function capacityByType(type: RoomType, otherCapacity = 5) {
  if (type === "single") return 1
  if (type === "double") return 2
  if (type === "triple") return 3
  if (type === "quad") return 4
  return otherCapacity
}

function formatGender(gender: Gender) {
  if (gender === "male") return "Vyrams"
  if (gender === "female") return "Moterims"
  if (gender === "mixed") return "Mišrus"
  return "Nenurodyta"
}

function statusLabel(status: string | null | undefined) {
  if (status === "arriving_soon" || status === "netrukus_atvyks") return "Netrukus atvyks"
  if (status === "active" || status === "gyvena") return "Gyvena"
  if (status === "hospital" || status === "ligonineje") return "Ligoninėje"
  if (status === "temporary_leave" || status === "laikinai_isvykes") return "Laikinai išvykęs"
  if (status === "deceased" || status === "mire") return "Mirė"
  if (status === "contract_ended" || status === "sutartis_nutraukta") return "Nutraukė sutartį"
  return "—"
}

function residentName(resident: Resident | null | undefined) {
  if (!resident) return "—"

  const fullName = String(resident.full_name || "").trim()
  const firstName = String(resident.first_name || "").trim()
  const lastName = String(resident.last_name || "").trim()
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim()
  const code = resident.resident_code ? ` (${resident.resident_code})` : ""

  return `${fullName || combined || "Gyventojas"}${code}`
}

function occupiedByLabel(room: Room, residents: Resident[]) {
  if (!room.occupied_by) return "—"

  const occupiedBy = String(room.occupied_by)

  const matchedResident = residents.find((resident) => {
    const possibleIds = [
      resident.id,
      resident.resident_id,
      resident.resident_code,
      resident.full_name,
      [resident.first_name, resident.last_name].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .map((value) => String(value))

    return possibleIds.includes(occupiedBy)
  })

  return matchedResident ? residentName(matchedResident) : occupiedBy
}



function residentRoomKey(resident: Resident) {
  return String(resident.current_room_id || resident.room_id || "").trim()
}

function matchesRoom(resident: Resident, room: Pick<Room | RoomRow, "id" | "name">) {
  const key = residentRoomKey(resident)
  if (!key) return false
  return key === room.id || key === room.name || key.toLowerCase() === String(room.name || "").toLowerCase()
}

function isActiveResidentStatus(resident: Resident) {
  return (
    resident.current_status === "active" ||
    resident.current_status === "gyvena" ||
    resident.status === "active" ||
    resident.status === "gyvena"
  )
}

function isReservedResidentStatus(resident: Resident) {
  return (
    resident.current_status === "arriving_soon" ||
    resident.current_status === "netrukus_atvyks" ||
    resident.status === "arriving_soon" ||
    resident.status === "netrukus_atvyks" ||
    Boolean(resident.room_reserved_until)
  )
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("lt-LT")
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n")

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function normalizeRoom(row: RoomRow, residents: Resident[]): Room {
  const activeResidents = residents.filter(
    (resident) =>
      matchesRoom(resident, row) &&
      resident.is_active !== false &&
      !resident.archived_at &&
      isActiveResidentStatus(resident)
  )

  const reservedResidents = residents.filter(
    (resident) =>
      matchesRoom(resident, row) &&
      resident.is_active !== false &&
      !resident.archived_at &&
      isReservedResidentStatus(resident)
  )

  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    room_type: row.room_type || "other",
    capacity: row.capacity || 1,
    floor: row.floor ?? null,
    gender: row.gender || "",
    area_m2: row.area_m2 ?? null,
    sort_order: row.sort_order ?? (row as any).display_order ?? null,
    oxygen: Boolean((row as any).oxygen ?? (row as any).has_oxygen),
    nursing: Boolean((row as any).nursing ?? (row as any).has_nursing),
    wc: Boolean((row as any).wc ?? (row as any).has_private_wc),
    shower: Boolean((row as any).shower ?? (row as any).has_shower),
    sink: Boolean((row as any).sink ?? (row as any).has_sink),
    functional_bed: Boolean((row as any).functional_bed ?? (row as any).has_functional_bed),
    wheelchair_accessible: Boolean((row as any).wheelchair_accessible ?? (row as any).is_accessible),
    notes: row.notes || "",
    is_active: row.is_active !== false,
    created_at: row.created_at,
    occupied_by: row.occupied_by || null,
    reserved_for: row.reserved_for || null,
    reserved_until: row.reserved_until || null,
    room_status: row.room_status || null,
    occupied: activeResidents.length + (row.occupied_by ? 1 : 0),
    reserved: reservedResidents.length + (row.reserved_for ? 1 : 0),
  }
}

function roomVisual(room: Room) {
  if (!room.is_active || room.room_status === "inactive") {
    return { label: "Neaktyvus", tone: "neutral" as const, bar: "bg-slate-400" }
  }

  if (room.room_status === "repair") {
    return { label: "Remontuojamas", tone: "danger" as const, bar: "bg-red-500" }
  }

  if (room.room_status === "preparing") {
    return { label: "Ruošiamas", tone: "warning" as const, bar: "bg-amber-500" }
  }

  if (room.reserved > 0 || room.room_status === "reserved" || room.reserved_for) {
    return { label: "Rezervuotas", tone: "warning" as const, bar: "bg-amber-500" }
  }

  if (room.occupied >= room.capacity || room.room_status === "occupied" || room.occupied_by) {
    return { label: "Užimtas", tone: "danger" as const, bar: "bg-red-500" }
  }

  if (room.occupied > 0) {
    return { label: "Dalinai užimtas", tone: "blue" as const, bar: "bg-blue-500" }
  }

  return { label: "Laisvas", tone: "green" as const, bar: "bg-emerald-600" }
}

function featureList(room: Room) {
  const features = [
    room.oxygen ? "Deguonis" : null,
    room.nursing ? "Tinka slaugai" : null,
    room.wc ? "WC" : null,
    room.shower ? "Dušas" : null,
    room.sink ? "Kriauklė" : null,
    room.functional_bed ? "Funkcinė lova" : null,
    room.wheelchair_accessible ? "Pritaikyta vežimėliui" : null,
  ].filter(Boolean) as string[]

  return features.length ? features : ["Be pažymėtų privalumų"]
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "green" | "blue" | "warning" | "danger" | "neutral"
}) {
  const tones = {
    green: "border-[#a7f3d0] bg-[#eefaf3] text-[#047857]",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-[#dbe6e0] bg-[#f8faf8] text-[#526174]",
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${tones[tone]}`}>
      {children}
    </span>
  )
}

function StatCard({
  icon,
  value,
  label,
  badge,
}: {
  icon: ReactNode
  value: ReactNode
  label: string
  badge?: ReactNode
}) {
  return (
    <div className="rounded-[24px] border border-[#c9d8d0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eefaf3] text-[#047857]">
          {icon}
        </div>
        {badge}
      </div>
      <div className="text-3xl font-black tracking-[-0.04em] text-[#10251f]">{value}</div>
      <div className="mt-1 text-sm font-bold text-[#66756c]">{label}</div>
    </div>
  )
}

function CompactRoomInfo({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-[#dbe6e0] bg-white p-4 shadow-sm">
      <div className="text-2xl font-black text-[#10251f]">{value}</div>
      <div className="mt-1 text-sm font-bold text-[#66756c]">{label}</div>
    </div>
  )
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#c9d8d0] bg-white shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
        <h3 className="text-[17px] font-black tracking-tight text-[#10251f]">{title}</h3>
        {action}
      </div>
      <div className="px-5 pb-5 pt-2">{children}</div>
    </section>
  )
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 text-sm">
      <div className="font-bold text-[#66756c]">{label}</div>
      <div className="font-black text-[#10251f]">{value}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-black text-[#486b5d]">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  "h-12 w-full rounded-2xl border border-[#dbe6e0] bg-white px-4 text-sm font-bold text-[#10251f] outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"

const textareaClass =
  "min-h-[104px] w-full rounded-2xl border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-bold text-[#10251f] outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"


const ROOM_TABS: Array<{ value: RoomTab; label: string; icon: ReactNode }> = [
  { value: "overview", label: "Apžvalga", icon: <Home size={16} /> },
  { value: "rooms", label: "Kambariai", icon: <DoorOpen size={16} /> },
  { value: "occupancy", label: "Užimtumas", icon: <Users size={16} /> },
  { value: "reservations", label: "Rezervacijos", icon: <CalendarDays size={16} /> },
  { value: "repairs", label: "Remontas", icon: <Hammer size={16} /> },
  { value: "export", label: "Eksportas", icon: <Download size={16} /> },
]

export default function RoomsPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<RoomType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "free" | "partial" | "occupied" | "reserved" | "repair" | "inactive">("all")
  const [floorFilter, setFloorFilter] = useState<string>("all")
  const [genderFilter, setGenderFilter] = useState<Gender | "all">("all")
  const [featureFilter, setFeatureFilter] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<RoomTab>("overview")

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>("details")
  const [roomForm, setRoomForm] = useState<RoomForm>(emptyRoomForm)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState<BulkForm>(emptyBulkForm)
  const [assignForm, setAssignForm] = useState<AssignForm>(emptyAssignForm)

  useEffect(() => {
    void loadOrganization()
  }, [])

  useEffect(() => {
    if (organizationId) void loadData(organizationId)
  }, [organizationId])

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) || null,
    [rooms, selectedRoomId]
  )

  const roomResidents = useMemo(() => {
    if (!selectedRoom) return []

    return residents.filter(
      (resident) =>
        matchesRoom(resident, selectedRoom) &&
        resident.is_active !== false &&
        !resident.archived_at
    )
  }, [residents, selectedRoom])

  const availableResidents = useMemo(() => {
    return residents.filter(
      (resident) =>
        resident.is_active !== false &&
        !resident.archived_at &&
        (!residentRoomKey(resident) || residentRoomKey(resident) === assignForm.roomId || residentRoomKey(resident) === rooms.find((room) => room.id === assignForm.roomId)?.name)
    )
  }, [residents, assignForm.roomId, rooms])

  const floors = useMemo(() => {
    return Array.from(new Set(rooms.map((room) => room.floor).filter((floor) => floor !== null)))
      .sort((a, b) => Number(a) - Number(b))
      .map(String)
  }, [rooms])

  const filteredRooms = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase()

    return rooms.filter((room) => {
      const visual = roomVisual(room)
      const residentsInRoom = residents.filter((resident) => matchesRoom(resident, room))
      const residentsText = residentsInRoom.map(residentName).join(" ").toLowerCase()

      if (cleanQuery) {
        const searchable = [
          room.name,
          room.floor,
          formatType(room.room_type),
          formatGender(room.gender),
          room.notes,
          visual.label,
          featureList(room).join(" "),
          residentsText,
        ]
          .join(" ")
          .toLowerCase()

        if (!searchable.includes(cleanQuery)) return false
      }

      if (typeFilter !== "all" && room.room_type !== typeFilter) return false
      if (floorFilter !== "all" && String(room.floor ?? "") !== floorFilter) return false
      if (genderFilter !== "all" && room.gender !== genderFilter) return false

      if (statusFilter !== "all") {
        if (statusFilter === "free" && visual.label !== "Laisvas") return false
        if (statusFilter === "partial" && visual.label !== "Dalinai užimtas") return false
        if (statusFilter === "occupied" && visual.label !== "Užimtas") return false
        if (statusFilter === "reserved" && visual.label !== "Rezervuotas") return false
        if (statusFilter === "repair" && visual.label !== "Remontuojamas") return false
        if (statusFilter === "inactive" && visual.label !== "Neaktyvus") return false
      }

      if (featureFilter !== "all") {
        if (featureFilter === "oxygen" && !room.oxygen) return false
        if (featureFilter === "nursing" && !room.nursing) return false
        if (featureFilter === "care_suitable" && !(room.nursing || room.functional_bed || room.wheelchair_accessible || room.oxygen)) return false
        if (featureFilter === "wc" && !room.wc) return false
        if (featureFilter === "shower" && !room.shower) return false
        if (featureFilter === "functional_bed" && !room.functional_bed) return false
        if (featureFilter === "wheelchair_accessible" && !room.wheelchair_accessible) return false
      }

      return true
    })
  }, [rooms, residents, query, typeFilter, floorFilter, genderFilter, statusFilter, featureFilter])

  const stats = useMemo(() => {
    const capacity = rooms.reduce((sum, room) => sum + room.capacity, 0)
    const occupied = rooms.reduce((sum, room) => sum + room.occupied, 0)
    const reserved = rooms.reduce((sum, room) => sum + room.reserved, 0)
    const free = Math.max(capacity - occupied - reserved, 0)

    return { capacity, occupied, reserved, free }
  }, [rooms])

  const reservationRows = useMemo(() => {
    return residents.filter(
      (resident) =>
        resident.is_active !== false &&
        !resident.archived_at &&
        (isReservedResidentStatus(resident) || Boolean(resident.room_reserved_until))
    )
  }, [residents])

  const repairRooms = useMemo(() => {
    return rooms.filter((room) => room.room_status === "repair" || room.room_status === "preparing" || room.room_status === "inactive")
  }, [rooms])

  const roomAlerts = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const capacityAlerts = rooms
      .filter((room) => room.occupied + room.reserved > room.capacity)
      .map((room) => ({
        title: `Viršyta talpa · ${room.name}`,
        text: `Talpa ${room.capacity}, užimta / rezervuota ${room.occupied + room.reserved}.`,
        tone: "danger" as const,
      }))

    const expiredReservations = reservationRows
      .filter((resident) => {
        if (!resident.room_reserved_until) return false
        const date = new Date(resident.room_reserved_until)
        date.setHours(0, 0, 0, 0)
        return Number.isFinite(date.getTime()) && date < today
      })
      .map((resident) => ({
        title: `Pasibaigusi rezervacija · ${residentName(resident)}`,
        text: `Rezervuota iki ${formatDate(resident.room_reserved_until)}. Reikia pratęsti arba patvirtinti atvykimą.`,
        tone: "warning" as const,
      }))

    const repairAlerts = repairRooms.map((room) => ({
      title: `${room.room_status === "repair" ? "Remontuojamas" : room.room_status === "preparing" ? "Ruošiamas" : "Neaktyvus"} · ${room.name}`,
      text: `${room.floor ?? "—"} aukštas · ${formatType(room.room_type)} · ${room.notes || "Pastabų nėra."}`,
      tone: room.room_status === "repair" ? ("danger" as const) : ("warning" as const),
    }))

    return [...capacityAlerts, ...expiredReservations, ...repairAlerts].slice(0, 8)
  }, [rooms, reservationRows, repairRooms])


  async function loadOrganization() {
    setLoading(true)
    setError(null)

    try {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error("Nepavyko nustatyti organizacijos.")

      setOrganizationId(orgId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko užkrauti organizacijos.")
      setLoading(false)
    }
  }

  async function loadData(orgId: string) {
    setLoading(true)
    setError(null)

    try {
      const [{ data: residentsData, error: residentsError }, { data: roomsData, error: roomsError }] =
        await Promise.all([
          supabase
            .from("residents")
            .select("*")
            .eq("organization_id", orgId)
            .order("full_name", { ascending: true }),
          supabase
            .from("rooms")
            .select("*")
            .eq("organization_id", orgId)
            .order("name", { ascending: true }),
        ])

      if (residentsError) throw residentsError
      if (roomsError) throw roomsError

      const safeResidents = (residentsData || []) as Resident[]
      setResidents(safeResidents)
      setRooms(((roomsData || []) as RoomRow[]).map((row) => normalizeRoom(row, safeResidents)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko užkrauti kambarių.")
    } finally {
      setLoading(false)
    }
  }

  function openRoom(room: Room, mode: ModalMode = "details") {
    setSelectedRoomId(room.id)
    setModalMode(mode)
    setAssignForm((prev) => ({
      ...prev,
      roomId: room.id,
      mode: mode === "reserve" ? "arriving_soon" : prev.mode,
    }))

    setRoomForm({
      id: room.id,
      name: room.name,
      room_type: room.room_type,
      capacity: String(room.capacity),
      floor: room.floor === null ? "" : String(room.floor),
      gender: room.gender,
      area_m2: room.area_m2 === null ? "" : String(room.area_m2),
      sort_order: room.sort_order === null ? "" : String(room.sort_order),
      oxygen: room.oxygen,
      nursing: room.nursing,
      wc: room.wc,
      shower: room.shower,
      sink: room.sink,
      functional_bed: room.functional_bed,
      wheelchair_accessible: room.wheelchair_accessible,
      notes: room.notes,
      is_active: room.is_active,
      room_status: room.room_status || "",
    })
  }

  function openNewRoom() {
    setModalMode("details")
    setSelectedRoomId("new")
    setRoomForm(emptyRoomForm)
    setAssignForm(emptyAssignForm)
  }

  function closeModal() {
    setModalMode("details")
    setSelectedRoomId(null)
    setAssignForm(emptyAssignForm)
    setRoomForm(emptyRoomForm)
  }

  async function saveRoom() {
    if (!organizationId) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const payload = {
        organization_id: organizationId,
        name: roomForm.name.trim(),
        room_type: roomForm.room_type,
        capacity: Math.max(toInt(roomForm.capacity, 1), 1),
        floor: roomForm.floor ? toInt(roomForm.floor, 0) : null,
        gender: roomForm.gender || null,
        area_m2: toNumber(roomForm.area_m2, null),
        display_order: roomForm.sort_order ? toInt(roomForm.sort_order, 0) : null,
        has_oxygen: roomForm.oxygen,
        has_nursing: roomForm.nursing,
        has_private_wc: roomForm.wc,
        has_shower: roomForm.shower,
        has_sink: roomForm.sink,
        has_functional_bed: roomForm.functional_bed,
        is_accessible: roomForm.wheelchair_accessible,
        notes: roomForm.notes.trim() || null,
        is_active: roomForm.is_active,
        room_status: roomForm.room_status || null,
      }

      if (!payload.name) throw new Error("Įrašyk kambario pavadinimą.")

      if (selectedRoomId === "new" || !roomForm.id) {
        const { error: insertError } = await supabase.from("rooms").insert(payload)
        if (insertError) throw insertError
        setSuccess("Kambarys sukurtas.")
      } else {
        const { error: updateError } = await supabase.from("rooms").update(payload).eq("id", roomForm.id)
        if (updateError) throw updateError
        setSuccess("Kambarys išsaugotas.")
      }

      await loadData(organizationId)
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko išsaugoti kambario.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteRoom(roomId: string) {
    if (!organizationId) return
    const confirmed = window.confirm("Ar tikrai ištrinti kambarį? Jei kambaryje yra gyventojų, geriau jį pažymėti neaktyviu.")
    if (!confirmed) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: deleteError } = await supabase.from("rooms").delete().eq("id", roomId)
      if (deleteError) throw deleteError

      setSuccess("Kambarys ištrintas.")
      await loadData(organizationId)
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko ištrinti kambario.")
    } finally {
      setSaving(false)
    }
  }

  async function assignResident() {
    if (!organizationId) return

    if (!assignForm.roomId || !assignForm.residentId) {
      setError("Pasirink gyventoją ir kambarį.")
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const statusByMode: Record<AssignMode, string> = {
        active: "active",
        arriving_soon: "arriving_soon",
        hospital: "hospital",
        temporary_leave: "temporary_leave",
      }

      const { error: residentError } = await supabase
        .from("residents")
        .update({
          current_room_id: assignForm.roomId,
          current_status: statusByMode[assignForm.mode],
          room_reserved_until:
            assignForm.mode === "arriving_soon" ? assignForm.reservedUntil || null : null,
        })
        .eq("id", assignForm.residentId)

      if (residentError) throw residentError

      if (assignForm.mode === "arriving_soon") {
        const selectedResident = residents.find((resident) => resident.id === assignForm.residentId)

        const { error: roomError } = await supabase
          .from("rooms")
          .update({
            room_status: "reserved",
            reserved_for: residentName(selectedResident),
            reserved_until: assignForm.reservedUntil || null,
          })
          .eq("id", assignForm.roomId)

        if (roomError) throw roomError
      }

      setSuccess(assignForm.mode === "arriving_soon" ? "Kambarys rezervuotas." : "Gyventojas priskirtas.")
      setAssignForm((prev) => ({ ...prev, residentId: "", reservedUntil: "" }))
      await loadData(organizationId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko priskirti gyventojo.")
    } finally {
      setSaving(false)
    }
  }

  async function releaseResident(residentId: string) {
    if (!organizationId) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: residentError } = await supabase
        .from("residents")
        .update({
          current_room_id: null,
          room_reserved_until: null,
        })
        .eq("id", residentId)

      if (residentError) throw residentError

      setSuccess("Gyventojas atlaisvintas iš kambario.")
      await loadData(organizationId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko atlaisvinti vietos.")
    } finally {
      setSaving(false)
    }
  }

  async function confirmArrival(residentId: string) {
    if (!organizationId) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: residentError } = await supabase
        .from("residents")
        .update({
          current_status: "active",
          room_reserved_until: null,
        })
        .eq("id", residentId)

      if (residentError) throw residentError

      if (selectedRoom) {
        const { error: roomError } = await supabase
          .from("rooms")
          .update({
            room_status: null,
            reserved_for: null,
            reserved_until: null,
          })
          .eq("id", selectedRoom.id)

        if (roomError) throw roomError
      }

      setSuccess("Atvykimas patvirtintas.")
      await loadData(organizationId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko patvirtinti atvykimo.")
    } finally {
      setSaving(false)
    }
  }

  async function updateRoomStatus(status: string | null) {
    if (!selectedRoom || !organizationId) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: statusError } = await supabase
        .from("rooms")
        .update({ room_status: status })
        .eq("id", selectedRoom.id)

      if (statusError) throw statusError

      setSuccess("Kambario būsena atnaujinta.")
      await loadData(organizationId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko atnaujinti būsenos.")
    } finally {
      setSaving(false)
    }
  }

  async function bulkCreateRooms() {
    if (!organizationId) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const rows: Partial<RoomRow>[] = []
      let number = toInt(bulkForm.startNumber, 1)
      let sort = toInt(bulkForm.startSortOrder, 1)
      const floor = bulkForm.floor ? toInt(bulkForm.floor, 0) : null

      const addRooms = (type: RoomType, count: number) => {
        for (let i = 0; i < count; i += 1) {
          const capacity = capacityByType(type, Math.max(toInt(bulkForm.otherCapacity, 5), 1))
          rows.push({
            organization_id: organizationId,
            name: `${bulkForm.prefix}${number}`,
            room_type: type,
            capacity,
            floor,
            gender: bulkForm.gender || null,
            display_order: sort,
            is_active: true,
          })
          number += 1
          sort += 1
        }
      }

      addRooms("single", Math.max(toInt(bulkForm.singleCount, 0), 0))
      addRooms("double", Math.max(toInt(bulkForm.doubleCount, 0), 0))
      addRooms("triple", Math.max(toInt(bulkForm.tripleCount, 0), 0))
      addRooms("quad", Math.max(toInt(bulkForm.quadCount, 0), 0))
      addRooms("other", Math.max(toInt(bulkForm.otherCount, 0), 0))

      if (rows.length === 0) throw new Error("Nurodyk bent vieną kuriamą kambarį.")

      const { error: insertError } = await supabase.from("rooms").insert(rows)
      if (insertError) throw insertError

      setBulkForm(emptyBulkForm)
      setBulkOpen(false)
      setSuccess(`Sukurta kambarių: ${rows.length}.`)
      await loadData(organizationId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko masiškai sukurti kambarių.")
    } finally {
      setSaving(false)
    }
  }

  function exportRooms() {
    downloadCsv("kambariai.csv", [
      ["Kambarys", "Aukštas", "Tipas", "Lytis", "Talpa", "Užimta", "Rezervuota", "Laisva", "Statusas", "Privalumai"],
      ...filteredRooms.map((room) => {
        const visual = roomVisual(room)
        return [
          room.name,
          String(room.floor ?? ""),
          formatType(room.room_type),
          formatGender(room.gender),
          String(room.capacity),
          String(room.occupied),
          String(room.reserved),
          String(Math.max(room.capacity - room.occupied - room.reserved, 0)),
          visual.label,
          featureList(room).join("; "),
        ]
      }),
    ])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7f4] px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-[1500px] rounded-[28px] border border-[#dbe6e0] bg-white p-8 text-sm font-black text-[#66756c] shadow-sm">
          Kraunamas kambarių modulis...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f3f6f4] px-4 py-6 text-[#10251f] lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="mb-5 overflow-hidden rounded-[30px] border border-emerald-900/10 bg-[#486b5d] shadow-[0_16px_45px_rgba(16,37,31,0.16)]">
          <div className="flex flex-col gap-6 px-7 py-7 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-5">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[28px] bg-[#e8f7ef] text-[#486b5d]">
                <Home size={36} />
              </div>
              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.24em] text-emerald-100/80">
                  Kambariai / Užimtumas / Rezervacijos
                </div>
                <h1 className="text-4xl font-black tracking-[-0.04em] text-white">
                  Kambarių valdymas
                </h1>
                <p className="mt-2 text-base font-bold text-emerald-50/90">
                  Kambariai, gyventojai, privalumai, rezervacijos ir paruošimo būsenos vienoje vietoje.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBulkOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-black text-[#486b5d] shadow-sm transition hover:bg-[#f8faf8]"
              >
                <Layers size={17} />
                Masinis kūrimas
              </button>
              <button
                type="button"
                onClick={exportRooms}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-black text-[#486b5d] shadow-sm transition hover:bg-[#f8faf8]"
              >
                <Download size={17} />
                Eksportuoti
              </button>
              <button
                type="button"
                onClick={openNewRoom}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#047857] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#036747]"
              >
                <Plus size={18} />
                Naujas kambarys
              </button>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[24px] border border-[#c9d8d0] bg-[#eef4f1] p-3 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
          <div className="flex flex-wrap gap-2">
            {ROOM_TABS.map((tab) => {
              const isActive = activeTab === tab.value

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.value)
                    if (tab.value === "export") exportRooms()
                    if (tab.value === "reservations") setStatusFilter("reserved")
                    if (tab.value === "repairs") setStatusFilter("repair")
                    if (tab.value === "rooms") setStatusFilter("all")
                  }}
                  className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
                    isActive
                      ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
                      : "text-[#486b5d] hover:bg-white/70"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              )
            })}
          </div>
        </section>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-5 rounded-2xl border border-[#a7f3d0] bg-[#eefaf3] px-4 py-3 text-sm font-bold text-[#047857]">
            {success}
          </div>
        ) : null}

        <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={<Building2 size={21} />} value={rooms.length} label="Kambariai" badge={<Badge>Visi</Badge>} />
          <StatCard icon={<Bed size={21} />} value={stats.capacity} label="Bendra talpa" badge={<Badge tone="green">Vietos</Badge>} />
          <StatCard icon={<Users size={21} />} value={stats.occupied} label="Užimta vietų" badge={<Badge tone="blue">Gyvena</Badge>} />
          <StatCard icon={<AlertTriangle size={21} />} value={stats.reserved} label="Rezervuota" badge={<Badge tone="warning">Laukia</Badge>} />
          <StatCard icon={<CheckCircle2 size={21} />} value={stats.free} label="Laisvų vietų" badge={<Badge tone="green">Laisva</Badge>} />
        </section>

        <section className="mb-5 rounded-[26px] border border-[#c9d8d0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-[#047857]">Reikia dėmesio</div>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#10251f]">Kambarių rizikos ir veiksmai</h2>
              <p className="mt-1 text-sm font-bold text-[#526174]">
                Čia rodomi pasibaigusių rezervacijų, remontuojamų kambarių ir talpos konfliktų signalai.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge tone="warning">Rezervacijų: {reservationRows.length}</Badge>
              <Badge tone="danger">Remontas / neaktyvūs: {repairRooms.length}</Badge>
              <Badge tone="green">Laisva vietų: {stats.free}</Badge>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {roomAlerts.length ? (
              roomAlerts.map((alert) => (
                <div
                  key={`${alert.title}-${alert.text}`}
                  className={`rounded-[18px] border p-4 ${
                    alert.tone === "danger"
                      ? "border-red-200 bg-red-50 text-red-900"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  <div className="font-black">{alert.title}</div>
                  <p className="mt-1 text-sm font-bold leading-6 opacity-85">{alert.text}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-[#dbe6e0] bg-[#f8faf8] p-4 text-sm font-bold text-[#526174] lg:col-span-3">
                Šiuo metu kritinių kambarių įspėjimų nėra.
              </div>
            )}
          </div>
        </section>

        {activeTab === "reservations" ? (
          <section className="mb-5 rounded-[26px] border border-[#c9d8d0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-[-0.03em] text-[#10251f]">Rezervacijų sąrašas</h2>
                <p className="mt-1 text-sm font-bold text-[#526174]">Visi gyventojai su statusu „Netrukus atvyks“ arba rezervacijos data.</p>
              </div>
              <button
                type="button"
                onClick={() => setStatusFilter("reserved")}
                className="rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] px-4 py-3 text-sm font-black text-[#486b5d] hover:bg-[#eef4f1]"
              >
                Filtruoti kambarius
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {reservationRows.length ? (
                reservationRows.map((resident) => (
                  <div key={resident.id} className="rounded-[18px] border border-amber-200 bg-amber-50 p-4">
                    <div className="font-black text-amber-950">{residentName(resident)}</div>
                    <div className="mt-1 text-sm font-bold text-amber-800">
                      {statusLabel(resident.current_status || resident.status)} · kambarys {rooms.find((room) => matchesRoom(resident, room))?.name || "nepriskirtas"}
                    </div>
                    <div className="mt-2 text-sm font-bold text-amber-800">Iki: {formatDate(resident.room_reserved_until)}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-[#dbe6e0] bg-[#f8faf8] p-5 text-sm font-bold text-[#526174]">
                  Aktyvių rezervacijų nėra.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {bulkOpen ? (
          <section className="mb-5 rounded-[26px] border border-[#dbe6e0] bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-[-0.03em]">Masinis kambarių kūrimas</h2>
                <p className="mt-1 text-sm font-bold text-[#66756c]">
                  Greitai sukurk vienviečius, dviviečius, triviečius ar kitus kambarius.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-slate-100 text-[#526174] transition hover:bg-slate-200"
              >
                <X size={17} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <Field label="Prefiksas">
                <input className={inputClass} value={bulkForm.prefix} onChange={(event) => setBulkForm((prev) => ({ ...prev, prefix: event.target.value }))} placeholder="Pvz. A-" />
              </Field>
              <Field label="Nuo numerio">
                <input className={inputClass} value={bulkForm.startNumber} onChange={(event) => setBulkForm((prev) => ({ ...prev, startNumber: event.target.value }))} />
              </Field>
              <Field label="Aukštas">
                <input className={inputClass} value={bulkForm.floor} onChange={(event) => setBulkForm((prev) => ({ ...prev, floor: event.target.value }))} />
              </Field>
              <Field label="Lytis">
                <select className={inputClass} value={bulkForm.gender} onChange={(event) => setBulkForm((prev) => ({ ...prev, gender: event.target.value as Gender }))}>
                  <option value="">Nenurodyta</option>
                  <option value="female">Moterims</option>
                  <option value="male">Vyrams</option>
                  <option value="mixed">Mišrus</option>
                </select>
              </Field>
              <Field label="Rikiavimas nuo">
                <input className={inputClass} value={bulkForm.startSortOrder} onChange={(event) => setBulkForm((prev) => ({ ...prev, startSortOrder: event.target.value }))} />
              </Field>
              <Field label="Kita talpa">
                <input className={inputClass} value={bulkForm.otherCapacity} onChange={(event) => setBulkForm((prev) => ({ ...prev, otherCapacity: event.target.value }))} />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-5">
              {[
                ["Vienviečių", "singleCount"],
                ["Dviviečių", "doubleCount"],
                ["Triviečių", "tripleCount"],
                ["Keturviečių", "quadCount"],
                ["Kitų", "otherCount"],
              ].map(([label, key]) => (
                <Field key={key} label={label}>
                  <input
                    className={inputClass}
                    value={bulkForm[key as keyof BulkForm]}
                    onChange={(event) => setBulkForm((prev) => ({ ...prev, [key]: event.target.value }))}
                  />
                </Field>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={bulkCreateRooms}
                disabled={saving}
                className="rounded-2xl bg-[#047857] px-5 py-3 text-sm font-black text-white hover:bg-[#036747] disabled:opacity-60"
              >
                {saving ? "Kuriama..." : "Sukurti kambarius"}
              </button>
            </div>
          </section>
        ) : null}

        <section className="mb-5 grid gap-3 rounded-[24px] border border-[#c9d8d0] bg-white p-3 shadow-[0_1px_3px_rgba(16,37,31,0.10)] lg:grid-cols-[1.4fr_repeat(6,1fr)_auto]">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94a39b]" />
            <input
              className={`${inputClass} pl-11`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ieškoti kambario, aukšto, gyventojo..."
            />
          </div>

          <select className={inputClass} value={floorFilter} onChange={(event) => setFloorFilter(event.target.value)}>
            <option value="all">Visi aukštai</option>
            {floors.map((floor) => (
              <option key={floor} value={floor}>
                {floor} aukštas
              </option>
            ))}
          </select>

          <select className={inputClass} value={genderFilter} onChange={(event) => setGenderFilter(event.target.value as Gender | "all")}>
            <option value="all">Visos lytys</option>
            <option value="female">Moterims</option>
            <option value="male">Vyrams</option>
            <option value="mixed">Mišrus</option>
            <option value="">Nenurodyta</option>
          </select>

          <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">Visi statusai</option>
            <option value="free">Laisvas</option>
            <option value="partial">Dalinai užimtas</option>
            <option value="occupied">Užimtas</option>
            <option value="reserved">Rezervuotas</option>
            <option value="repair">Remontuojamas</option>
            <option value="inactive">Neaktyvus</option>
          </select>

          <select
            className={inputClass}
            value={featureFilter === "care_suitable" ? "care_suitable" : "all"}
            onChange={(event) => {
              if (event.target.value === "care_suitable") setFeatureFilter("care_suitable")
              else if (featureFilter === "care_suitable") setFeatureFilter("all")
            }}
          >
            <option value="all">Visi pagal priežiūrą</option>
            <option value="care_suitable">Tinka slaugai</option>
          </select>

          <select className={inputClass} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as RoomType | "all")}>
            <option value="all">Visi tipai</option>
            <option value="single">Vienvietis</option>
            <option value="double">Dvivietis</option>
            <option value="triple">Trivietis</option>
            <option value="quad">Keturvietis</option>
            <option value="other">Kitas</option>
          </select>

          <select className={inputClass} value={featureFilter} onChange={(event) => setFeatureFilter(event.target.value)}>
            <option value="all">Visi privalumai</option>
            <option value="care_suitable">Tinka slaugai</option>
            <option value="wc">WC</option>
            <option value="shower">Dušas</option>
            <option value="oxygen">Deguonis</option>
            <option value="nursing">Slaugai</option>
            <option value="functional_bed">Funkcinė lova</option>
            <option value="wheelchair_accessible">Vežimėliui</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setQuery("")
              setFloorFilter("all")
              setGenderFilter("all")
              setStatusFilter("all")
              setTypeFilter("all")
              setFeatureFilter("all")
            }}
            className="rounded-2xl border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-black text-[#486b5d] hover:bg-[#f8faf8]"
          >
            Valyti
          </button>
        </section>

        <section className="grid gap-5 xl:grid-cols-3">
          {filteredRooms.map((room) => {
            const visual = roomVisual(room)
            const residentsInRoom = residents.filter(
              (resident) =>
                matchesRoom(resident, room) &&
                resident.is_active !== false &&
                !resident.archived_at
            )
            const used = Math.min(room.capacity, room.occupied + room.reserved)
            const percent = room.capacity ? Math.min((used / room.capacity) * 100, 100) : 0

            return (
              <article key={room.id} className="overflow-hidden rounded-[28px] border border-[#c9d8d0] bg-white shadow-[0_6px_20px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-3 border-b border-[#dbe6e0] p-5">
                  <div>
                    <div className="text-2xl font-black tracking-[-0.04em] text-[#10251f]">{room.name}</div>
                    <div className="mt-1 text-sm font-bold text-[#66756c]">
                      {room.floor ?? "—"} aukštas · {formatType(room.room_type)} · {formatGender(room.gender)}
                    </div>
                  </div>
                  <Badge tone={visual.tone}>{visual.label}</Badge>
                </div>

                <div className="p-5">
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] p-3">
                      <div className="text-2xl font-black text-[#10251f]">{room.capacity}</div>
                      <div className="text-xs font-bold text-[#66756c]">talpa</div>
                    </div>
                    <div className="rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] p-3">
                      <div className="text-2xl font-black text-[#10251f]">{room.occupied}</div>
                      <div className="text-xs font-bold text-[#66756c]">gyvena</div>
                    </div>
                    <div className="rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] p-3">
                      <div className="text-2xl font-black text-[#10251f]">{room.reserved}</div>
                      <div className="text-xs font-bold text-[#66756c]">rezerv.</div>
                    </div>
                  </div>

                  <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-[#eef4f1]">
                    <div className={`h-full rounded-full ${visual.bar}`} style={{ width: `${percent}%` }} />
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {featureList(room).slice(0, 5).map((feature) => (
                      <span key={feature} className="rounded-full border border-[#dbe6e0] bg-[#f8faf8] px-3 py-1 text-xs font-black text-[#526174]">
                        {feature}
                      </span>
                    ))}
                  </div>

                  <div className="grid gap-2">
                    {residentsInRoom.length ? (
                      residentsInRoom.slice(0, 3).map((resident) => (
                        <div key={resident.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] p-3">
                          <div>
                            <div className="text-sm font-black text-[#10251f]">{residentName(resident)}</div>
                            <div className="mt-0.5 text-xs font-bold text-[#66756c]">
                              {statusLabel(resident.current_status || resident.status)}
                              {resident.room_reserved_until ? ` · iki ${formatDate(resident.room_reserved_until)}` : ""}
                            </div>
                          </div>
                          <Badge tone={resident.current_status === "arriving_soon" ? "warning" : "green"}>
                            {statusLabel(resident.current_status || resident.status)}
                          </Badge>
                        </div>
                      ))
                    ) : room.occupied_by || room.reserved_for ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                        {room.occupied_by ? `Užimta: ${occupiedByLabel(room, residents)}` : `Rezervuota: ${room.reserved_for}`}
                        {room.reserved_until ? ` · iki ${formatDate(room.reserved_until)}` : ""}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#c9d8d0] bg-[#f8faf8] p-4 text-sm font-bold text-[#66756c]">
                        Kambarys laisvas arba gyventojai nepriskirti.
                      </div>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => openRoom(room)}
                      className="rounded-2xl border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-black text-[#486b5d] hover:bg-[#f8faf8]"
                    >
                      Detalės
                    </button>
                    <button
                      type="button"
                      onClick={() => openRoom(room, "reserve")}
                      className="rounded-2xl bg-[#047857] px-4 py-3 text-sm font-black text-white transition hover:bg-[#036747]"
                    >
                      Rezervuoti
                    </button>
                  </div>
                </div>
              </article>
            )
          })}

          {!filteredRooms.length ? (
            <div className="col-span-full rounded-[28px] border border-dashed border-[#c9d8d0] bg-white p-10 text-center text-sm font-bold text-[#66756c]">
              Pagal pasirinktus filtrus kambarių nerasta.
            </div>
          ) : null}
        </section>

        {selectedRoomId ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
            <button
              type="button"
              onClick={closeModal}
              className="fixed right-4 top-4 z-[60] flex h-16 w-16 items-center justify-center rounded-[18px] bg-[#eef4f1] text-[#526174] shadow-xl transition hover:bg-slate-200"
              aria-label="Uždaryti"
            >
              <X size={28} strokeWidth={2.1} />
            </button>
            <div className="my-auto w-full max-w-[1180px] max-h-[calc(100vh-48px)] overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)]">
              <div className="sticky top-0 z-20 flex items-start justify-between gap-5 border-b border-[#eef4f1] bg-white px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[24px] bg-[#eefaf3] text-2xl font-black text-[#047857]">
                    {selectedRoomId === "new" ? "+" : selectedRoom?.name}
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-black uppercase tracking-[0.24em] text-emerald-100/80">
                      Kambario detalės
                    </div>
                    <h2 className="text-3xl font-black tracking-[-0.04em] text-[#10251f]">
                      {selectedRoomId === "new" ? "Naujas kambarys" : modalMode === "reserve" ? `Rezervuoti vietą · ${selectedRoom?.name}` : `Kambarys ${selectedRoom?.name}`}
                    </h2>
                    {selectedRoom ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone={roomVisual(selectedRoom).tone}>{roomVisual(selectedRoom).label}</Badge>
                        <Badge tone="blue">{selectedRoom.floor ?? "—"} aukštas</Badge>
                        <Badge>{formatType(selectedRoom.room_type)}</Badge>
                        <Badge>{formatGender(selectedRoom.gender)}</Badge>
                        {modalMode === "reserve" ? <Badge tone="warning">Rezervavimo režimas</Badge> : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedRoom && selectedRoomId !== "new" ? (
                    <button
                      type="button"
                      onClick={() => deleteRoom(selectedRoom.id)}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      <Trash2 size={17} />
                      Ištrinti
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-slate-100 text-[#526174] transition hover:bg-slate-200"
                  >
                    <X size={28} strokeWidth={2.1} />
                  </button>
                </div>
              </div>

              {modalMode === "reserve" && selectedRoom ? (
                <div className="p-6">
                  <div className="mx-auto max-w-[760px]">
                    <Panel
                      title="Rezervuoti vietą"
                      action={<Badge tone="warning">Tik rezervacija</Badge>}
                    >
                      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
                        Pasirink gyventoją, įrašyk rezervacijos datą ir spausk
                        „Rezervuoti“. Jei gyventojo dar nėra sąraše, pirmiausia sukurk
                        jį su statusu „Netrukus atvyks“.
                      </div>

                      <div className="grid gap-4">
                        <Field label="Kambarys">
                          <input
                            className={inputClass}
                            value={`${selectedRoom.name} · ${selectedRoom.floor ?? "—"} aukštas · ${formatType(selectedRoom.room_type)} · ${formatGender(selectedRoom.gender)}`}
                            readOnly
                          />
                        </Field>

                        <Field label="Gyventojas">
                          <select
                            className={inputClass}
                            value={assignForm.residentId}
                            onChange={(event) =>
                              setAssignForm((prev) => ({
                                ...prev,
                                residentId: event.target.value,
                              }))
                            }
                          >
                            <option value="">Pasirinkti gyventoją</option>
                            {availableResidents.map((resident) => (
                              <option key={resident.id} value={resident.id}>
                                {residentName(resident)}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Veiksmas">
                            <select
                              className={inputClass}
                              value={assignForm.mode}
                              onChange={(event) =>
                                setAssignForm((prev) => ({
                                  ...prev,
                                  mode: event.target.value as AssignMode,
                                }))
                              }
                            >
                              <option value="arriving_soon">
                                Rezervuoti / netrukus atvyks
                              </option>
                              <option value="active">Priskirti kaip gyvenantį</option>
                              <option value="hospital">Pažymėti ligoninėje</option>
                              <option value="temporary_leave">Laikinai išvykęs</option>
                            </select>
                          </Field>

                          <Field label="Rezervuota iki">
                            <input
                              type="date"
                              className={inputClass}
                              disabled={assignForm.mode !== "arriving_soon"}
                              value={assignForm.reservedUntil}
                              onChange={(event) =>
                                setAssignForm((prev) => ({
                                  ...prev,
                                  reservedUntil: event.target.value,
                                }))
                              }
                            />
                          </Field>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <button
                            type="button"
                            onClick={assignResident}
                            disabled={saving}
                            className="rounded-2xl bg-[#047857] px-5 py-3 text-sm font-black text-white hover:bg-[#036747] disabled:opacity-60"
                          >
                            {saving
                              ? "Saugoma..."
                              : assignForm.mode === "arriving_soon"
                                ? "Rezervuoti"
                                : "Priskirti"}
                          </button>

                          <button
                            type="button"
                            onClick={() => setModalMode("details")}
                            className="rounded-2xl border border-[#dbe6e0] bg-white px-5 py-3 text-sm font-black text-[#486b5d] hover:bg-[#f8faf8]"
                          >
                            Atidaryti visas detales
                          </button>
                        </div>
                      </div>
                    </Panel>

                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <CompactRoomInfo label="Talpa" value={selectedRoom.capacity} />
                      <CompactRoomInfo label="Gyvena" value={selectedRoom.occupied} />
                      <CompactRoomInfo label="Rezervuota" value={selectedRoom.reserved} />
                    </div>
                  </div>
                </div>
              ) : (
              <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-6"><div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
                <div className="grid gap-5">
                  <Panel title="Pagrindinė informacija">
                    <div className="grid gap-4">
                      <Field label="Kambario pavadinimas">
                        <input className={inputClass} value={roomForm.name} onChange={(event) => setRoomForm((prev) => ({ ...prev, name: event.target.value }))} />
                      </Field>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Aukštas">
                          <input className={inputClass} value={roomForm.floor} onChange={(event) => setRoomForm((prev) => ({ ...prev, floor: event.target.value }))} />
                        </Field>
                        <Field label="Talpa">
                          <input className={inputClass} value={roomForm.capacity} onChange={(event) => setRoomForm((prev) => ({ ...prev, capacity: event.target.value }))} />
                        </Field>
                      </div>

                      <Field label="Tipas">
                        <select className={inputClass} value={roomForm.room_type} onChange={(event) => setRoomForm((prev) => ({ ...prev, room_type: event.target.value as RoomType, capacity: String(capacityByType(event.target.value as RoomType, toInt(prev.capacity, 1))) }))}>
                          <option value="single">Vienvietis</option>
                          <option value="double">Dvivietis</option>
                          <option value="triple">Trivietis</option>
                          <option value="quad">Keturvietis</option>
                          <option value="other">Kitas</option>
                        </select>
                      </Field>

                      <Field label="Lytis">
                        <select className={inputClass} value={roomForm.gender} onChange={(event) => setRoomForm((prev) => ({ ...prev, gender: event.target.value as Gender }))}>
                          <option value="">Nenurodyta</option>
                          <option value="female">Moterims</option>
                          <option value="male">Vyrams</option>
                          <option value="mixed">Mišrus</option>
                        </select>
                      </Field>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Plotas m²">
                          <input className={inputClass} value={roomForm.area_m2} onChange={(event) => setRoomForm((prev) => ({ ...prev, area_m2: event.target.value }))} />
                        </Field>
                        <Field label="Rikiavimas">
                          <input className={inputClass} value={roomForm.sort_order} onChange={(event) => setRoomForm((prev) => ({ ...prev, sort_order: event.target.value }))} />
                        </Field>
                      </div>
                    </div>
                  </Panel>

                  <Panel title="Privalumai">
                    <div className="grid gap-3">
                      {[
                        ["oxygen", "Deguonis"],
                        ["nursing", "Tinka slaugai"],
                        ["wc", "WC"],
                        ["shower", "Dušas"],
                        ["sink", "Kriauklė"],
                        ["functional_bed", "Funkcinė lova"],
                        ["wheelchair_accessible", "Pritaikyta vežimėliui"],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-3 rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] px-4 py-3 text-sm font-black text-[#486b5d]">
                          <input
                            type="checkbox"
                            checked={Boolean(roomForm[key as keyof RoomForm])}
                            onChange={(event) => setRoomForm((prev) => ({ ...prev, [key]: event.target.checked }))}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </Panel>

                  <Panel title="Kambario būsena">
                    <div className="grid gap-4">
                      <Field label="Būsena">
                        <select className={inputClass} value={roomForm.room_status} onChange={(event) => setRoomForm((prev) => ({ ...prev, room_status: event.target.value }))}>
                          <option value="">Automatinė pagal užimtumą</option>
                          <option value="reserved">Rezervuotas</option>
                          <option value="preparing">Ruošiamas</option>
                          <option value="repair">Remontuojamas</option>
                          <option value="inactive">Neaktyvus</option>
                        </select>
                      </Field>
                      <label className="flex items-center gap-3 rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] px-4 py-3 text-sm font-black text-[#486b5d]">
                        <input
                          type="checkbox"
                          checked={roomForm.is_active}
                          onChange={(event) => setRoomForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                        />
                        Kambarys aktyvus
                      </label>
                      <Field label="Pastabos">
                        <textarea className={textareaClass} value={roomForm.notes} onChange={(event) => setRoomForm((prev) => ({ ...prev, notes: event.target.value }))} />
                      </Field>
                      <button
                        type="button"
                        onClick={saveRoom}
                        disabled={saving}
                        className="rounded-2xl bg-[#047857] px-5 py-3 text-sm font-black text-white hover:bg-[#036747] disabled:opacity-60"
                      >
                        {saving ? "Saugoma..." : "Išsaugoti kambarį"}
                      </button>
                    </div>
                  </Panel>
                </div>

                <div className="grid gap-5">
                  <Panel
                    title="Lovos / vietos"
                    action={selectedRoom ? <Badge tone={roomVisual(selectedRoom).tone}>{roomVisual(selectedRoom).label}</Badge> : null}
                  >
                    {selectedRoomId === "new" ? (
                      <div className="rounded-2xl border border-dashed border-[#c9d8d0] bg-[#f8faf8] p-6 text-sm font-bold text-[#66756c]">
                        Išsaugok kambarį, tada galėsi priskirti ar rezervuoti gyventojus.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {selectedRoom && roomResidents.length === 0 && (selectedRoom.occupied_by || selectedRoom.reserved_for) ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                            {selectedRoom.occupied_by ? `Užimta: ${occupiedByLabel(selectedRoom, residents)}` : `Rezervuota: ${selectedRoom.reserved_for}`}
                            {selectedRoom.reserved_until ? ` · iki ${formatDate(selectedRoom.reserved_until)}` : ""}
                          </div>
                        ) : null}
                        {Array.from({ length: selectedRoom?.capacity || 1 }).map((_, index) => {
                          const resident = roomResidents[index]
                          const bedName = `Lova ${String.fromCharCode(65 + index)}`

                          return (
                            <div key={bedName} className="rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="font-black text-[#10251f]">{bedName}</div>
                                <Badge tone={resident ? (resident.current_status === "arriving_soon" ? "warning" : "green") : "neutral"}>
                                  {resident ? statusLabel(resident.current_status || resident.status) : "Laisva"}
                                </Badge>
                              </div>

                              {resident ? (
                                <div className="flex flex-col gap-3 rounded-2xl border border-[#dbe6e0] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <div className="font-black text-[#10251f]">{residentName(resident)}</div>
                                    <div className="mt-1 text-sm font-bold text-[#66756c]">
                                      {resident.care_level || "Priežiūros lygis nenurodytas"}
                                      {resident.room_reserved_until ? ` · Rezervuota iki ${formatDate(resident.room_reserved_until)}` : ""}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Link
                                      href={`/residents/${resident.id}`}
                                      className="rounded-2xl border border-[#dbe6e0] px-3 py-2 text-xs font-black text-[#486b5d] hover:bg-[#f8faf8]"
                                    >
                                      Kortelė
                                    </Link>
                                    {resident.current_status === "arriving_soon" ? (
                                      <button
                                        type="button"
                                        onClick={() => confirmArrival(resident.id)}
                                        className="rounded-2xl bg-[#047857] px-3 py-2 text-xs font-black text-white hover:bg-[#036747]"
                                      >
                                        Atvyko
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => releaseResident(resident.id)}
                                      className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                                    >
                                      Atlaisvinti
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-2xl border border-dashed border-[#c9d8d0] bg-white p-4 text-sm font-bold text-[#66756c]">
                                  Vieta laisva. Galima priskirti ar rezervuoti gyventoją.
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Panel>

                  {selectedRoomId !== "new" ? (
                    <Panel title={modalMode === "reserve" ? "Rezervuoti vietą" : "Priskirti arba rezervuoti vietą"} action={modalMode === "reserve" ? <Badge tone="warning">Aktyvu</Badge> : null}>
                      <div className="grid gap-4">
                        {modalMode === "reserve" ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
                            Pasirink gyventoją, įrašyk rezervacijos datą ir spausk „Rezervuoti“. Jei gyventojo dar nėra sąraše, pirmiausia sukurk jį su statusu „Netrukus atvyks“.
                          </div>
                        ) : null}
                        <Field label="Gyventojas">
                          <select className={inputClass} value={assignForm.residentId} onChange={(event) => setAssignForm((prev) => ({ ...prev, residentId: event.target.value }))}>
                            <option value="">Pasirinkti gyventoją</option>
                            {availableResidents.map((resident) => (
                              <option key={resident.id} value={resident.id}>
                                {residentName(resident)}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Veiksmas">
                            <select className={inputClass} value={assignForm.mode} onChange={(event) => setAssignForm((prev) => ({ ...prev, mode: event.target.value as AssignMode }))}>
                              <option value="active">Priskirti kaip gyvenantį</option>
                              <option value="arriving_soon">Rezervuoti / netrukus atvyks</option>
                              <option value="hospital">Pažymėti ligoninėje</option>
                              <option value="temporary_leave">Laikinai išvykęs</option>
                            </select>
                          </Field>

                          <Field label="Rezervuota iki">
                            <input
                              type="date"
                              className={inputClass}
                              disabled={assignForm.mode !== "arriving_soon"}
                              value={assignForm.reservedUntil}
                              onChange={(event) => setAssignForm((prev) => ({ ...prev, reservedUntil: event.target.value }))}
                            />
                          </Field>
                        </div>

                        <button
                          type="button"
                          onClick={assignResident}
                          disabled={saving}
                          className="rounded-2xl bg-[#047857] px-5 py-3 text-sm font-black text-white hover:bg-[#036747] disabled:opacity-60"
                        >
                          {saving ? "Saugoma..." : assignForm.mode === "arriving_soon" ? "Rezervuoti" : "Priskirti"}
                        </button>
                      </div>
                    </Panel>
                  ) : null}

                  <Panel title="Ryšiai su moduliais">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="blue">Gyventojo kortelė</Badge>
                      <Badge tone="green">Užduotys ūkiui</Badge>
                      <Badge tone="neutral">Perdavimo žurnalas</Badge>
                      <Badge tone="warning">Valymo būsena</Badge>
                      <Badge tone="neutral">Inventorius</Badge>
                    </div>
                  </Panel>
                </div>

                <div className="grid gap-5">
                  <Panel title="Greiti veiksmai">
                    <div className="grid gap-3">
                      <button
                        type="button"
                        onClick={() => updateRoomStatus(null)}
                        disabled={!selectedRoom || selectedRoomId === "new"}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#047857] px-4 py-3 text-sm font-black text-white transition hover:bg-[#036747] disabled:opacity-60"
                      >
                        <CheckCircle2 size={17} />
                        Pažymėti kaip paruoštą
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRoomStatus("preparing")}
                        disabled={!selectedRoom || selectedRoomId === "new"}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                      >
                        <Sparkles size={17} />
                        Ruošiamas
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRoomStatus("repair")}
                        disabled={!selectedRoom || selectedRoomId === "new"}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        <Hammer size={17} />
                        Uždaryti remontui
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignForm((prev) => ({ ...prev, mode: "arriving_soon" }))}
                        disabled={!selectedRoom || selectedRoomId === "new"}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-black text-[#486b5d] hover:bg-[#f8faf8] disabled:opacity-60"
                      >
                        <ArrowRightLeft size={17} />
                        Rezervuoti / perkelti
                      </button>
                    </div>
                  </Panel>

                  <Panel title="Įspėjimai">
                    <div className="grid gap-3">
                      {selectedRoom?.reserved ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
                          Kambaryje yra rezervuota vieta. Patikrink atvykimo terminą ir paruošimo būseną.
                        </div>
                      ) : null}

                      {selectedRoom && selectedRoom.occupied + selectedRoom.reserved >= selectedRoom.capacity ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
                          Kambario talpa užpildyta. Naują gyventoją galima priskirti tik atlaisvinus vietą.
                        </div>
                      ) : null}

                      {selectedRoom?.room_status === "repair" ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
                          Kambarys pažymėtas kaip remontuojamas. Naujam gyventojui nenaudoti.
                        </div>
                      ) : null}

                      {!selectedRoom || (!selectedRoom.reserved && selectedRoom.occupied + selectedRoom.reserved < selectedRoom.capacity && selectedRoom.room_status !== "repair") ? (
                        <div className="rounded-2xl border border-[#a7f3d0] bg-[#eefaf3] p-4 text-sm font-bold leading-6 text-[#036747]">
                          Kritinių įspėjimų nėra.
                        </div>
                      ) : null}
                    </div>
                  </Panel>

                  <Panel title="Kambario santrauka">
                    <div className="space-y-3">
                      <InfoRow label="Sukurta" value={formatDate(selectedRoom?.created_at)} />
                      <InfoRow label="Užimta" value={`${selectedRoom?.occupied ?? 0} iš ${selectedRoom?.capacity ?? 0}`} />
                      <InfoRow label="Rezervuota" value={selectedRoom?.reserved ?? 0} />
                      <InfoRow label="Laisva" value={selectedRoom ? Math.max(selectedRoom.capacity - selectedRoom.occupied - selectedRoom.reserved, 0) : "—"} />
                      <InfoRow label="Privalumai" value={selectedRoom ? featureList(selectedRoom).join(", ") : "—"} />
                    </div>
                  </Panel>
                </div>
              </div>
              </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
