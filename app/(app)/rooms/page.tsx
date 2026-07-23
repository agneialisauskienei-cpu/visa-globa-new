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

function text(value: unknown, fallback = "â€”") {
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
  if (gender === "mixed") return "MiÅ¡rus"
  return "Nenurodyta"
}

function statusLabel(status: string | null | undefined) {
  if (status === "arriving_soon" || status === "netrukus_atvyks") return "Netrukus atvyks"
  if (status === "active" || status === "gyvena") return "Gyvena"
  if (status === "hospital" || status === "ligonineje") return "LigoninÄ—je"
  if (status === "temporary_leave" || status === "laikinai_isvykes") return "Laikinai iÅ¡vykÄ™s"
  if (status === "deceased" || status === "mire") return "MirÄ—"
  if (status === "contract_ended" || status === "sutartis_nutraukta") return "NutraukÄ— sutartÄ¯"
  return "â€”"
}

function residentName(resident: Resident | null | undefined) {
  if (!resident) return "â€”"

  const fullName = String(resident.full_name || "").trim()
  const firstName = String(resident.first_name || "").trim()
  const lastName = String(resident.last_name || "").trim()
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim()
  return fullName || combined || "Gyventojas"
}

function occupiedByLabel(room: Room, residents: Resident[]) {
  if (!room.occupied_by) return "â€”"

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
  if (!value) return "â€”"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "â€”"
  return date.toLocaleDateString("lt-LT")
}

function excelCell(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function downloadExcelTable(filename: string, rows: unknown[][]) {
  if (typeof window === "undefined") return

  const headerStarts = new Set(["Rodiklis", "Kambarys", "Gyventojas", "Rizika"])
  const sectionStarts = new Set(["SuvestinÄ—", "Vidurkiai", "KambariÅ³ sÄ…raÅ¡as", "Rezervacijos", "Rizikos ir remontas"])

  const tableRows = rows
    .map((row, index) => {
      const firstCell = String(row[0] ?? "")
      const isEmpty = row.every((cell) => String(cell ?? "").trim() === "")
      const className = [
        index === 0 ? "title-row" : "",
        sectionStarts.has(firstCell) ? "section-row" : "",
        headerStarts.has(firstCell) ? "header-row" : "",
        firstCell === "IÅ¡ viso" ? "total-row" : "",
        isEmpty ? "blank-row" : "",
      ]
        .filter(Boolean)
        .join(" ")
      const cells = row.map((cell) => `<td>${excelCell(cell)}</td>`).join("")
      return `<tr class="${className}">${cells}</tr>`
    })
    .join("")

  const content = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { background: #ffffff; color: #10251f; }
    table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; min-width: 1260px; }
    td { border: 1px solid #d9e4de; padding: 7px 10px; white-space: nowrap; vertical-align: middle; }
    .title-row td { border: 0; background: #486b5d; color: #ffffff; font-size: 20pt; font-weight: 700; padding: 14px 12px; }
    .section-row td { border: 0; background: #f7fcf9; color: #486b5d; font-size: 13pt; font-weight: 700; padding-top: 14px; }
    .header-row td { background: #486b5d; color: #ffffff; font-weight: 700; }
    .total-row td { background: #f7fcf9; color: #10251f; font-weight: 700; }
    .blank-row td { border: 0; height: 10px; padding: 0; }
    td:nth-child(1) { min-width: 130px; }
    td:nth-child(2) { min-width: 160px; }
    td:nth-child(3) { min-width: 120px; }
    td:nth-child(4) { min-width: 110px; }
    td:nth-child(5) { min-width: 95px; }
    td:nth-child(6), td:nth-child(7), td:nth-child(8) { min-width: 90px; }
    td:nth-child(9) { min-width: 140px; }
    td:nth-child(10), td:nth-child(11) { min-width: 220px; }
  </style>
</head>
<body><table>${tableRows}</table></body>
</html>`

  const blob = new Blob([content], { type: "application/vnd.ms-excel;charset=utf-8" })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
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

  const legacyOccupied =
    row.occupied_by && activeResidents.length === 0 && reservedResidents.length === 0 ? 1 : 0

  const legacyReserved =
    row.reserved_for && reservedResidents.length === 0 ? 1 : 0

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
    occupied: activeResidents.length + legacyOccupied,
    reserved: reservedResidents.length + legacyReserved,
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
    return { label: "RuoÅ¡iamas", tone: "warning" as const, bar: "bg-[#486b5d]" }
  }

  if (room.reserved > 0 || room.room_status === "reserved" || room.reserved_for) {
    return { label: "Rezervuotas", tone: "warning" as const, bar: "bg-[#486b5d]" }
  }

  if (room.occupied >= room.capacity || room.room_status === "occupied" || room.occupied_by) {
    return { label: "UÅ¾imtas", tone: "danger" as const, bar: "bg-red-500" }
  }

  if (room.occupied > 0) {
    return { label: "Dalinai uÅ¾imtas", tone: "green" as const, bar: "bg-emerald-600" }
  }

  return { label: "Laisvas", tone: "green" as const, bar: "bg-emerald-600" }
}

function featureList(room: Room) {
  const features = [
    room.oxygen ? "Deguonis" : null,
    room.nursing ? "Tinka slaugai" : null,
    room.wc ? "WC" : null,
    room.shower ? "DuÅ¡as" : null,
    room.sink ? "KriauklÄ—" : null,
    room.functional_bed ? "FunkcinÄ— lova" : null,
    room.wheelchair_accessible ? "Pritaikyta veÅ¾imÄ—liui" : null,
  ].filter(Boolean) as string[]

  return features.length ? features : ["Be paÅ¾ymÄ—tÅ³ privalumÅ³"]
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "green" | "blue" | "warning" | "danger" | "neutral"
}) {
  const tones = {
    green: "border-[#a7f3d0] bg-[#eefaf3] text-[#486b5d]",
    blue: "border-[#a7f3d0] bg-[#eefaf3] text-[#486b5d]",
    warning: "border-[#c9d8d0] bg-[#ffffff] text-[#486b5d]",
    danger: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-[#dbe6e0] bg-[#ffffff] text-[#526174]",
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${tones[tone]}`}>
      {children}
    </span>
  )
}

function RoomModuleLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-9 items-center justify-center rounded-[14px] border border-[#c9d8d0] bg-white px-3 py-1.5 text-xs font-black text-[#486b5d] transition hover:border-[#486b5d] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486b5d]/25"
    >
      {children}
    </Link>
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
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eefaf3] text-[#486b5d]">
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
  { value: "overview", label: "ApÅ¾valga", icon: <Home size={16} /> },
  { value: "rooms", label: "Kambariai", icon: <DoorOpen size={16} /> },
  { value: "occupancy", label: "UÅ¾imtumas", icon: <Users size={16} /> },
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
        if (statusFilter === "partial" && visual.label !== "Dalinai uÅ¾imtas") return false
        if (statusFilter === "occupied" && visual.label !== "UÅ¾imtas") return false
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
        title: `VirÅ¡yta talpa Â· ${room.name}`,
        text: `Talpa ${room.capacity}, uÅ¾imta ${room.occupied}, rezervuota ${room.reserved}.`,
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
        title: `Pasibaigusi rezervacija Â· ${residentName(resident)}`,
        text: `Rezervuota iki ${formatDate(resident.room_reserved_until)}. Reikia pratÄ™sti arba patvirtinti atvykimÄ….`,
        tone: "warning" as const,
      }))

    const repairAlerts = repairRooms.map((room) => ({
      
      title: `${room.room_status === "repair" ? "Remontuojamas" : room.room_status === "preparing" ? "RuoÅ¡iamas" : "Neaktyvus"} Â· ${room.name}`,
      text: `${room.floor ?? "â€”"} aukÅ¡tas Â· ${formatType(room.room_type)} Â· ${room.notes || "PastabÅ³ nÄ—ra."}`,
      tone: room.room_status === "repair" || room.room_status === "inactive" ? ("danger" as const) : ("warning" as const),
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
      setError(err instanceof Error ? err.message : "Nepavyko uÅ¾krauti organizacijos.")
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
      setError(err instanceof Error ? err.message : "Nepavyko uÅ¾krauti kambariÅ³.")
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

      if (!payload.name) throw new Error("Ä®raÅ¡yk kambario pavadinimÄ….")

      if (selectedRoomId === "new" || !roomForm.id) {
        const { error: insertError } = await supabase.from("rooms").insert(payload)
        if (insertError) throw insertError
        setSuccess("Kambarys sukurtas.")
      } else {
        const { error: updateError } = await supabase.from("rooms").update(payload).eq("id", roomForm.id).eq("organization_id", organizationId)
        if (updateError) throw updateError
        setSuccess("Kambarys iÅ¡saugotas.")
      }

      await loadData(organizationId)
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko iÅ¡saugoti kambario.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteRoom(roomId: string) {
    if (!organizationId) return
    const confirmed = window.confirm("Ar tikrai iÅ¡trinti kambarÄ¯? Jei kambaryje yra gyventojÅ³, geriau jÄ¯ paÅ¾ymÄ—ti neaktyviu.")
    if (!confirmed) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: deleteError } = await supabase.from("rooms").delete().eq("id", roomId).eq("organization_id", organizationId)
      if (deleteError) throw deleteError

      setSuccess("Kambarys iÅ¡trintas.")
      await loadData(organizationId)
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko iÅ¡trinti kambario.")
    } finally {
      setSaving(false)
    }
  }

  async function assignResident() {
    if (!organizationId) return

    if (!assignForm.roomId || !assignForm.residentId) {
      setError("Pasirink gyventojÄ… ir kambarÄ¯.")
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
        .eq("organization_id", organizationId)

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
          .eq("organization_id", organizationId)

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
        .eq("organization_id", organizationId)

      if (residentError) throw residentError

      setSuccess("Gyventojas atlaisvintas iÅ¡ kambario.")
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
        .eq("organization_id", organizationId)

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
          .eq("organization_id", organizationId)

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
        .eq("organization_id", organizationId)

      if (statusError) throw statusError

      setSuccess("Kambario bÅ«sena atnaujinta.")
      await loadData(organizationId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko atnaujinti bÅ«senos.")
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

      if (rows.length === 0) throw new Error("Nurodyk bent vienÄ… kuriamÄ… kambarÄ¯.")

      const { error: insertError } = await supabase.from("rooms").insert(rows)
      if (insertError) throw insertError

      setBulkForm(emptyBulkForm)
      setBulkOpen(false)
      setSuccess(`Sukurta kambariÅ³: ${rows.length}.`)
      await loadData(organizationId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko masiÅ¡kai sukurti kambariÅ³.")
    } finally {
      setSaving(false)
    }
  }

  function exportRooms() {
    const today = new Date()
    const filenameDate = today.toISOString().slice(0, 10)
    const occupancyPercent = stats.capacity ? Math.round(((stats.occupied + stats.reserved) / stats.capacity) * 100) : 0
    const averageCapacity = rooms.length ? Math.round((stats.capacity / rooms.length) * 100) / 100 : 0
    const averageOccupied = rooms.length ? Math.round((stats.occupied / rooms.length) * 100) / 100 : 0

    const roomRows = filteredRooms.map((room) => {
      const visual = roomVisual(room)
      const residentsInRoom = residents.filter((resident) => matchesRoom(resident, room))
      const activeNames = residentsInRoom
        .filter((resident) => isActiveResidentStatus(resident))
        .map(residentName)
        .join(", ")
      const reservedNames = residentsInRoom
        .filter((resident) => isReservedResidentStatus(resident))
        .map(residentName)
        .join(", ")

      return [
        room.name,
        room.floor ?? "-",
        formatType(room.room_type),
        formatGender(room.gender),
        room.capacity,
        room.occupied,
        room.reserved,
        Math.max(room.capacity - room.occupied - room.reserved, 0),
        visual.label,
        activeNames || "-",
        reservedNames || "-",
        featureList(room).join(", "),
        room.notes || "-",
      ]
    })

    const reservationExportRows = reservationRows.map((resident) => {
      const room = rooms.find((item) => matchesRoom(resident, item))
      return [
        residentName(resident),
        room?.name || residentRoomKey(resident) || "-",
        statusLabel(resident.current_status || resident.status),
        formatDate(resident.room_reserved_until),
      ]
    })

    const alertExportRows = roomAlerts.map((alert) => [alert.title, alert.text])

    downloadExcelTable(`kambariai-${filenameDate}.xls`, [
      ["KambariÅ³ uÅ¾imtumo ataskaita"],
      ["Sugeneruota", today.toLocaleString("lt-LT")],
      [],
      ["SuvestinÄ—"],
      ["Rodiklis", "ReikÅ¡mÄ—", "Pastaba"],
      ["KambariÅ³ skaiÄius", rooms.length, "Visi suvesti kambariai"],
      ["Bendra talpa", stats.capacity, "Visos vietos"],
      ["UÅ¾imta vietÅ³", stats.occupied, "Gyvenantys gyventojai"],
      ["Rezervuota vietÅ³", stats.reserved, "Netrukus atvyks / rezervuota"],
      ["Laisva vietÅ³", stats.free, "Laisvos vietos pagal talpÄ…"],
      ["UÅ¾imtumas", `${occupancyPercent}%`, "UÅ¾imta ir rezervuota nuo bendros talpos"],
      [],
      ["Vidurkiai"],
      ["Rodiklis", "ReikÅ¡mÄ—", "Pastaba"],
      ["VidutinÄ— talpa kambaryje", averageCapacity, "Vietos / kambariai"],
      ["VidutiniÅ¡kai gyvena kambaryje", averageOccupied, "Gyventojai / kambariai"],
      [],
      ["KambariÅ³ sÄ…raÅ¡as"],
      [
        "Kambarys",
        "AukÅ¡tas",
        "Tipas",
        "Lytis",
        "Talpa",
        "Gyvena",
        "Rezervuota",
        "Laisva",
        "BÅ«sena",
        "Gyventojai",
        "Rezervacijos",
        "Privalumai",
        "Pastabos",
      ],
      ...roomRows,
      ["IÅ¡ viso", "", "", "", stats.capacity, stats.occupied, stats.reserved, stats.free, "", "", "", "", ""],
      [],
      ["Rezervacijos"],
      ["Gyventojas", "Kambarys", "BÅ«sena", "Iki"],
      ...(reservationExportRows.length ? reservationExportRows : [["RezervacijÅ³ nÄ—ra", "", "", ""]]),
      [],
      ["Rizikos ir remontas"],
      ["Rizika", "ApraÅ¡ymas"],
      ...(alertExportRows.length ? alertExportRows : [["AktyviÅ³ rizikÅ³ nÄ—ra", ""]]),
    ])
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7f4] px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-[1500px] rounded-[28px] border border-[#dbe6e0] bg-white p-8 text-sm font-black text-[#66756c] shadow-sm">
          Kraunamas kambariÅ³ modulis...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#ffffff] px-4 py-6 text-[#10251f] lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="mb-5 overflow-hidden rounded-[22px] border border-[#c9d8d0] bg-white shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
          <div className="flex flex-col gap-6 bg-[#486b5d] px-7 py-7 text-white xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-5">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[28px] bg-[#e8f7ef] text-[#486b5d]">
                <Home size={36} />
              </div>
              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-white/75">
                  Kambariai / uÅ¾imtumas / rezervacijos
                </div>
                <h1 className="text-4xl font-black tracking-[-0.04em] text-white">
                  KambariÅ³ valdymas
                </h1>
                <p className="mt-2 max-w-3xl text-base font-bold text-white/90">
                  Kambariai, gyventojai, privalumai, rezervacijos ir paruoÅ¡imo bÅ«senos vienoje vietoje.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBulkOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-black text-[#486b5d] shadow-sm transition hover:bg-[#ffffff]"
              >
                <Layers size={17} />
                Masinis kÅ«rimas
              </button>
              <button
                type="button"
                onClick={exportRooms}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-black text-[#486b5d] shadow-sm transition hover:bg-[#ffffff]"
              >
                <Download size={17} />
                Eksportuoti Excel
              </button>
              <button
                type="button"
                onClick={openNewRoom}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#486b5d] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#39594c]"
              >
                <Plus size={18} />
                Naujas kambarys
              </button>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[24px] border border-[#c9d8d0] bg-[#f7fcf9] p-3 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
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
          <div className="mb-5 rounded-2xl border border-[#a7f3d0] bg-[#eefaf3] px-4 py-3 text-sm font-bold text-[#486b5d]">
            {success}
          </div>
        ) : null}

        <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={<Building2 size={21} />} value={rooms.length} label="Kambariai" badge={<Badge>Visi</Badge>} />
          <StatCard icon={<Bed size={21} />} value={stats.capacity} label="Bendra talpa" badge={<Badge tone="green">Vietos</Badge>} />
          <StatCard icon={<Users size={21} />} value={stats.occupied} label="UÅ¾imta vietÅ³" badge={<Badge tone="blue">Gyvena</Badge>} />
          <StatCard icon={<AlertTriangle size={21} />} value={stats.reserved} label="Rezervuota" badge={<Badge tone="warning">Laukia</Badge>} />
          <StatCard icon={<CheckCircle2 size={21} />} value={stats.free} label="LaisvÅ³ vietÅ³" badge={<Badge tone="green">Laisva</Badge>} />
        </section>

        <section className="mb-5 rounded-[26px] border border-[#c9d8d0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-black tracking-[0.14em] text-[#486b5d]">Reikia dÄ—mesio</div>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#10251f]">KambariÅ³ rizikos ir veiksmai</h2>
              <p className="mt-1 text-sm font-bold text-[#526174]">
                ÄŒia rodomi pasibaigusiÅ³ rezervacijÅ³, remontuojamÅ³ kambariÅ³ ir talpos konfliktÅ³ signalai.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge tone="warning">RezervacijÅ³: {reservationRows.length}</Badge>
              <Badge tone="danger">Remontas / neaktyvÅ«s: {repairRooms.length}</Badge>
              <Badge tone="green">Laisva vietÅ³: {stats.free}</Badge>
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
                      : "border-[#c9d8d0] bg-white text-[#486b5d]"
                  }`}
                >
                  <div className="font-black">{alert.title}</div>
                  <p className="mt-1 text-sm font-bold leading-6 opacity-85">{alert.text}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-[#dbe6e0] bg-[#ffffff] p-4 text-sm font-bold text-[#526174] lg:col-span-3">
                Å iuo metu kritiniÅ³ kambariÅ³ Ä¯spÄ—jimÅ³ nÄ—ra.
              </div>
            )}
          </div>
        </section>

        {activeTab === "reservations" ? (
          <section className="mb-5 rounded-[26px] border border-[#c9d8d0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-[-0.03em] text-[#10251f]">RezervacijÅ³ sÄ…raÅ¡as</h2>
                <p className="mt-1 text-sm font-bold text-[#526174]">Visi gyventojai su statusu â€žNetrukus atvyksâ€œ arba rezervacijos data.</p>
              </div>
              <button
                type="button"
                onClick={() => setStatusFilter("reserved")}
                className="rounded-2xl border border-[#dbe6e0] bg-[#ffffff] px-4 py-3 text-sm font-black text-[#486b5d] hover:bg-[#f7fcf9]"
              >
                Filtruoti kambarius
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {reservationRows.length ? (
                reservationRows.map((resident) => (
                  <div key={resident.id} className="rounded-[18px] border border-[#c9d8d0] bg-white p-4">
                    <div className="font-black text-[#10251f]">{residentName(resident)}</div>
                    <div className="mt-1 text-sm font-bold text-[#486b5d]">
                      {statusLabel(resident.current_status || resident.status)} Â· kambarys {rooms.find((room) => matchesRoom(resident, room))?.name || "nepriskirtas"}
                    </div>
                    <div className="mt-2 text-sm font-bold text-[#486b5d]">Iki: {formatDate(resident.room_reserved_until)}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-[#dbe6e0] bg-[#ffffff] p-5 text-sm font-bold text-[#526174]">
                  AktyviÅ³ rezervacijÅ³ nÄ—ra.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {bulkOpen ? (
          <section className="mb-5 rounded-[26px] border border-[#dbe6e0] bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-[-0.03em]">Masinis kambariÅ³ kÅ«rimas</h2>
                <p className="mt-1 text-sm font-bold text-[#66756c]">
                  Greitai sukurk vienvieÄius, dvivieÄius, trivieÄius ar kitus kambarius.
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
              <Field label="AukÅ¡tas">
                <input className={inputClass} value={bulkForm.floor} onChange={(event) => setBulkForm((prev) => ({ ...prev, floor: event.target.value }))} />
              </Field>
              <Field label="Lytis">
                <select className={inputClass} value={bulkForm.gender} onChange={(event) => setBulkForm((prev) => ({ ...prev, gender: event.target.value as Gender }))}>
                  <option value="">Nenurodyta</option>
                  <option value="female">Moterims</option>
                  <option value="male">Vyrams</option>
                  <option value="mixed">MiÅ¡rus</option>
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
                ["VienvieÄiÅ³", "singleCount"],
                ["DvivieÄiÅ³", "doubleCount"],
                ["TrivieÄiÅ³", "tripleCount"],
                ["KeturvieÄiÅ³", "quadCount"],
                ["KitÅ³", "otherCount"],
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
                className="rounded-[14px] bg-[#486b5d] px-5 py-3 text-sm font-black text-white transition hover:bg-[#39594c] disabled:opacity-60"
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
              placeholder="IeÅ¡koti kambario, aukÅ¡to, gyventojo..."
            />
          </div>

          <select className={inputClass} value={floorFilter} onChange={(event) => setFloorFilter(event.target.value)}>
            <option value="all">Visi aukÅ¡tai</option>
            {floors.map((floor) => (
              <option key={floor} value={floor}>
                {floor} aukÅ¡tas
              </option>
            ))}
          </select>

          <select className={inputClass} value={genderFilter} onChange={(event) => setGenderFilter(event.target.value as Gender | "all")}>
            <option value="all">Visos lytys</option>
            <option value="female">Moterims</option>
            <option value="male">Vyrams</option>
            <option value="mixed">MiÅ¡rus</option>
            <option value="">Nenurodyta</option>
          </select>

          <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">Visi statusai</option>
            <option value="free">Laisvas</option>
            <option value="partial">Dalinai uÅ¾imtas</option>
            <option value="occupied">UÅ¾imtas</option>
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
            <option value="all">Visi pagal prieÅ¾iÅ«rÄ…</option>
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
            <option value="shower">DuÅ¡as</option>
            <option value="oxygen">Deguonis</option>
            <option value="nursing">Slaugai</option>
            <option value="functional_bed">FunkcinÄ— lova</option>
            <option value="wheelchair_accessible">VeÅ¾imÄ—liui</option>
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
            className="rounded-2xl border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-black text-[#486b5d] hover:bg-[#ffffff]"
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
                      {room.floor ?? "â€”"} aukÅ¡tas Â· {formatType(room.room_type)} Â· {formatGender(room.gender)}
                    </div>
                  </div>
                  <Badge tone={visual.tone}>{visual.label}</Badge>
                </div>

                <div className="p-5">
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-[#dbe6e0] bg-[#ffffff] p-3">
                      <div className="text-2xl font-black text-[#10251f]">{room.capacity}</div>
                      <div className="text-xs font-bold text-[#66756c]">talpa</div>
                    </div>
                    <div className="rounded-2xl border border-[#dbe6e0] bg-[#ffffff] p-3">
                      <div className="text-2xl font-black text-[#10251f]">{room.occupied}</div>
                      <div className="text-xs font-bold text-[#66756c]">gyvena</div>
                    </div>
                    <div className="rounded-2xl border border-[#dbe6e0] bg-[#ffffff] p-3">
                      <div className="text-2xl font-black text-[#10251f]">{room.reserved}</div>
                      <div className="text-xs font-bold text-[#66756c]">rezerv.</div>
                    </div>
                  </div>

                  <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-[#f7fcf9]">
                    <div className={`h-full rounded-full ${visual.bar}`} style={{ width: `${percent}%` }} />
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {featureList(room).slice(0, 5).map((feature) => (
                      <span key={feature} className="rounded-full border border-[#dbe6e0] bg-[#ffffff] px-3 py-1 text-xs font-black text-[#526174]">
                        {feature}
                      </span>
                    ))}
                  </div>

                  <div className="grid gap-2">
                    {residentsInRoom.length ? (
                      residentsInRoom.slice(0, 3).map((resident) => (
                        <div key={resident.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#dbe6e0] bg-[#ffffff] p-3">
                          <div>
                            <div className="text-sm font-black text-[#10251f]">{residentName(resident)}</div>
                            <div className="mt-0.5 text-xs font-bold text-[#66756c]">
                              {statusLabel(resident.current_status || resident.status)}
                              {resident.room_reserved_until ? ` Â· iki ${formatDate(resident.room_reserved_until)}` : ""}
                            </div>
                          </div>
                          <Badge tone={resident.current_status === "arriving_soon" ? "warning" : "green"}>
                            {statusLabel(resident.current_status || resident.status)}
                          </Badge>
                        </div>
                      ))
                    ) : room.occupied_by || room.reserved_for ? (
                      <div className="rounded-2xl border border-[#c9d8d0] bg-white p-4 text-sm font-bold text-[#486b5d]">
                        {room.occupied_by ? `UÅ¾imta: ${occupiedByLabel(room, residents)}` : `Rezervuota: ${room.reserved_for}`}
                        {room.reserved_until ? ` Â· iki ${formatDate(room.reserved_until)}` : ""}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#c9d8d0] bg-[#ffffff] p-4 text-sm font-bold text-[#66756c]">
                        Kambarys laisvas arba gyventojai nepriskirti.
                      </div>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => openRoom(room)}
                      className="rounded-2xl border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-black text-[#486b5d] hover:bg-[#ffffff]"
                    >
                      DetalÄ—s
                    </button>
                    <button
                      type="button"
                      onClick={() => openRoom(room, "reserve")}
                      className="rounded-2xl bg-[#486b5d] px-4 py-3 text-sm font-black text-white transition hover:bg-[#39594c]"
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
              Pagal pasirinktus filtrus kambariÅ³ nerasta.
            </div>
          ) : null}
        </section>

        {selectedRoomId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/50 p-6 backdrop-blur-sm">
            
            <div className="w-full max-w-[1180px] max-h-[calc(100vh-48px)] overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)]">
              <div className="flex items-start justify-between gap-5 bg-[#486b5d] px-6 py-5 text-white">
                <div className="flex items-center gap-4">
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[24px] bg-[#eefaf3] text-2xl font-black text-[#486b5d]">
                    {selectedRoomId === "new" ? "+" : selectedRoom?.name}
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-black uppercase tracking-[0.24em] text-emerald-100/80">
                      Kambario detalÄ—s
                    </div>
                    <h2 className="text-3xl font-black tracking-[-0.04em] text-white">
                      {selectedRoomId === "new" ? "Naujas kambarys" : modalMode === "reserve" ? `Rezervuoti vietÄ… Â· ${selectedRoom?.name}` : `Kambarys ${selectedRoom?.name}`}
                    </h2>
                    {selectedRoom ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone={roomVisual(selectedRoom).tone}>{roomVisual(selectedRoom).label}</Badge>
                        <Badge tone="blue">{selectedRoom.floor ?? "â€”"} aukÅ¡tas</Badge>
                        <Badge>{formatType(selectedRoom.room_type)}</Badge>
                        <Badge>{formatGender(selectedRoom.gender)}</Badge>
                        {modalMode === "reserve" ? <Badge tone="warning">Rezervavimo reÅ¾imas</Badge> : null}
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
                      IÅ¡trinti
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition hover:bg-white/20"
                  >
                    <X size={28} strokeWidth={2.1} />
                  </button>
                </div>
              </div>

              {modalMode === "reserve" && selectedRoom ? (
                <div className="max-h-[calc(100vh-172px)] overflow-y-auto bg-[#ffffff] p-5">
                  <div className="mx-auto max-w-[720px]">
                    <Panel
                      title="Rezervuoti vietÄ…"
                      action={<Badge tone="warning">Tik rezervacija</Badge>}
                    >
                      <div className="mb-5 rounded-2xl border border-[#c9d8d0] bg-white p-4 text-sm font-bold leading-6 text-[#486b5d]">
                        Pasirink gyventojÄ…, Ä¯raÅ¡yk rezervacijos datÄ… ir spausk
                        â€žRezervuotiâ€œ. Jei gyventojo dar nÄ—ra sÄ…raÅ¡e, pirmiausia sukurk
                        jÄ¯ su statusu â€žNetrukus atvyksâ€œ.
                      </div>

                      <div className="grid gap-4">
                        <Field label="Kambarys">
                          <input
                            className={inputClass}
                            value={`${selectedRoom.name} Â· ${selectedRoom.floor ?? "â€”"} aukÅ¡tas Â· ${formatType(selectedRoom.room_type)} Â· ${formatGender(selectedRoom.gender)}`}
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
                            <option value="">Pasirinkti gyventojÄ…</option>
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
                              <option value="active">Priskirti kaip gyvenantÄ¯</option>
                              <option value="hospital">PaÅ¾ymÄ—ti ligoninÄ—je</option>
                              <option value="temporary_leave">Laikinai iÅ¡vykÄ™s</option>
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
                            className="rounded-[14px] bg-[#486b5d] px-5 py-3 text-sm font-black text-white transition hover:bg-[#39594c] disabled:opacity-60"
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
                            className="rounded-2xl border border-[#dbe6e0] bg-white px-5 py-3 text-sm font-black text-[#486b5d] hover:bg-[#ffffff]"
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
              <div className="max-h-[calc(100vh-190px)] overflow-y-auto bg-[#ffffff] p-6"><div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
                <div className="grid gap-5">
                  <Panel title="PagrindinÄ— informacija">
                    <div className="grid gap-4">
                      <Field label="Kambario pavadinimas">
                        <input className={inputClass} value={roomForm.name} onChange={(event) => setRoomForm((prev) => ({ ...prev, name: event.target.value }))} />
                      </Field>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="AukÅ¡tas">
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
                          <option value="mixed">MiÅ¡rus</option>
                        </select>
                      </Field>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Plotas mÂ²">
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
                        ["shower", "DuÅ¡as"],
                        ["sink", "KriauklÄ—"],
                        ["functional_bed", "FunkcinÄ— lova"],
                        ["wheelchair_accessible", "Pritaikyta veÅ¾imÄ—liui"],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-3 rounded-2xl border border-[#dbe6e0] bg-[#ffffff] px-4 py-3 text-sm font-black text-[#486b5d]">
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

                  <Panel title="Kambario bÅ«sena">
                    <div className="grid gap-4">
                      <Field label="BÅ«sena">
                        <select className={inputClass} value={roomForm.room_status} onChange={(event) => setRoomForm((prev) => ({ ...prev, room_status: event.target.value }))}>
                          <option value="">AutomatinÄ— pagal uÅ¾imtumÄ…</option>
                          <option value="reserved">Rezervuotas</option>
                          <option value="preparing">RuoÅ¡iamas</option>
                          <option value="repair">Remontuojamas</option>
                          <option value="inactive">Neaktyvus</option>
                        </select>
                      </Field>
                      <label className="flex items-center gap-3 rounded-2xl border border-[#dbe6e0] bg-[#ffffff] px-4 py-3 text-sm font-black text-[#486b5d]">
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
                        className="rounded-[14px] bg-[#486b5d] px-5 py-3 text-sm font-black text-white transition hover:bg-[#39594c] disabled:opacity-60"
                      >
                        {saving ? "Saugoma..." : "IÅ¡saugoti kambarÄ¯"}
                      </button>
                    </div>
                  </Panel>
                </div>

                {selectedRoomId !== "new" ? (
                <div className="grid gap-5">
                  <Panel
                    title="Lovos / vietos"
                    action={selectedRoom ? <Badge tone={roomVisual(selectedRoom).tone}>{roomVisual(selectedRoom).label}</Badge> : null}
                  >
                    {selectedRoomId === "new" ? (
                      <div className="rounded-2xl border border-dashed border-[#c9d8d0] bg-[#ffffff] p-6 text-sm font-bold text-[#66756c]">
                        IÅ¡saugok kambarÄ¯, tada galÄ—si priskirti ar rezervuoti gyventojus.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {selectedRoom && roomResidents.length === 0 && (selectedRoom.occupied_by || selectedRoom.reserved_for) ? (
                          <div className="rounded-2xl border border-[#c9d8d0] bg-white p-4 text-sm font-bold text-[#486b5d]">
                            {selectedRoom.occupied_by ? `UÅ¾imta: ${occupiedByLabel(selectedRoom, residents)}` : `Rezervuota: ${selectedRoom.reserved_for}`}
                            {selectedRoom.reserved_until ? ` Â· iki ${formatDate(selectedRoom.reserved_until)}` : ""}
                          </div>
                        ) : null}
                        {Array.from({ length: selectedRoom?.capacity || 1 }).map((_, index) => {
                          const resident = roomResidents[index]
                          const bedName = `Lova ${String.fromCharCode(65 + index)}`

                          return (
                            <div key={bedName} className="rounded-2xl border border-[#dbe6e0] bg-[#ffffff] p-4">
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
                                      {resident.care_level || "PrieÅ¾iÅ«ros lygis nenurodytas"}
                                      {resident.room_reserved_until ? ` Â· Rezervuota iki ${formatDate(resident.room_reserved_until)}` : ""}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Link
                                      href={`/residents/${resident.id}`}
                                      className="rounded-2xl border border-[#dbe6e0] px-3 py-2 text-xs font-black text-[#486b5d] hover:bg-[#ffffff]"
                                    >
                                      KortelÄ—
                                    </Link>
                                    {resident.current_status === "arriving_soon" ? (
                                      <button
                                        type="button"
                                        onClick={() => confirmArrival(resident.id)}
                                        className="rounded-2xl bg-[#486b5d] px-3 py-2 text-xs font-black text-white hover:bg-[#39594c]"
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
                                  Vieta laisva. Galima priskirti ar rezervuoti gyventojÄ….
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Panel>

                  {selectedRoomId !== "new" ? (
                    <Panel title={modalMode === "reserve" ? "Rezervuoti vietÄ…" : "Priskirti arba rezervuoti vietÄ…"} action={modalMode === "reserve" ? <Badge tone="warning">Aktyvu</Badge> : null}>
                      <div className="grid gap-4">
                        {modalMode === "reserve" ? (
                          <div className="rounded-2xl border border-[#c9d8d0] bg-white p-4 text-sm font-bold leading-6 text-[#486b5d]">
                            Pasirink gyventojÄ…, Ä¯raÅ¡yk rezervacijos datÄ… ir spausk â€žRezervuotiâ€œ. Jei gyventojo dar nÄ—ra sÄ…raÅ¡e, pirmiausia sukurk jÄ¯ su statusu â€žNetrukus atvyksâ€œ.
                          </div>
                        ) : null}
                        <Field label="Gyventojas">
                          <select className={inputClass} value={assignForm.residentId} onChange={(event) => setAssignForm((prev) => ({ ...prev, residentId: event.target.value }))}>
                            <option value="">Pasirinkti gyventojÄ…</option>
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
                              <option value="active">Priskirti kaip gyvenantÄ¯</option>
                              <option value="arriving_soon">Rezervuoti / netrukus atvyks</option>
                              <option value="hospital">PaÅ¾ymÄ—ti ligoninÄ—je</option>
                              <option value="temporary_leave">Laikinai iÅ¡vykÄ™s</option>
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
                          className="rounded-[14px] bg-[#486b5d] px-5 py-3 text-sm font-black text-white transition hover:bg-[#39594c] disabled:opacity-60"
                        >
                          {saving ? "Saugoma..." : assignForm.mode === "arriving_soon" ? "Rezervuoti" : "Priskirti"}
                        </button>
                      </div>
                    </Panel>
                  ) : null}

                  <Panel title="Ryšiai su moduliais">
                    <div className="flex flex-wrap gap-2">
                      <RoomModuleLink href={selectedRoom ? `/residents?search=${encodeURIComponent(selectedRoom.name)}` : "/residents"}>Gyventojai</RoomModuleLink>
                      <RoomModuleLink href={selectedRoom ? `/tasks?room=${encodeURIComponent(selectedRoom.name)}` : "/tasks"}>Užduotys ūkiui</RoomModuleLink>
                      <RoomModuleLink href={selectedRoom ? `/handover-logs?room=${encodeURIComponent(selectedRoom.name)}` : "/handover-logs"}>Perdavimo žurnalai</RoomModuleLink>
                      <RoomModuleLink href={selectedRoom ? `/rooms?tab=repairs&room=${encodeURIComponent(selectedRoom.name)}` : "/rooms?tab=repairs"}>Valymo būsena</RoomModuleLink>
                      <RoomModuleLink href={selectedRoom ? `/inventory?room=${encodeURIComponent(selectedRoom.name)}` : "/inventory"}>Inventorius</RoomModuleLink>
                    </div>
                  </Panel>
                </div>

                ) : null}

                <div className="grid gap-5">
                  {selectedRoomId === "new" ? (
                    <Panel title="KÄ… daryti toliau?">
                      <div className="grid gap-4">
                        <div className="rounded-[18px] border border-[#dbe6e0] bg-[#ffffff] p-4 text-sm font-bold leading-6 text-[#526174]">
                          Ä®vesk kambario pavadinimÄ…, talpÄ…, tipÄ… ir privalumus. IÅ¡saugojus kambarÄ¯ atsiras lovÅ³ / vietÅ³ valdymas, gyventojo priskyrimas ir rezervacijos.
                        </div>

                        <button
                          type="button"
                          onClick={saveRoom}
                          disabled={saving}
                          className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#486b5d] px-5 py-3 text-sm font-black text-white transition hover:bg-[#39594c] disabled:opacity-60"
                        >
                          {saving ? "Saugoma..." : "IÅ¡saugoti kambarÄ¯"}
                        </button>

                        <button
                          type="button"
                          onClick={closeModal}
                          className="rounded-[14px] border border-[#dbe6e0] bg-white px-5 py-3 text-sm font-black text-[#486b5d] transition hover:bg-[#ffffff]"
                        >
                          AtÅ¡aukti
                        </button>
                      </div>
                    </Panel>
                  ) : (
                  <>
                  <Panel title="Greiti veiksmai">
                    <div className="grid gap-3">
                      <button
                        type="button"
                        onClick={() => updateRoomStatus(null)}
                        disabled={!selectedRoom || selectedRoomId === "new"}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#486b5d] px-4 py-3 text-sm font-black text-white transition hover:bg-[#39594c] disabled:opacity-60"
                      >
                        <CheckCircle2 size={17} />
                        PaÅ¾ymÄ—ti kaip paruoÅ¡tÄ…
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRoomStatus("preparing")}
                        disabled={!selectedRoom || selectedRoomId === "new"}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#c9d8d0] bg-white px-4 py-3 text-sm font-black text-[#486b5d] hover:border-[#486b5d] hover:bg-white disabled:opacity-60"
                      >
                        <Sparkles size={17} />
                        RuoÅ¡iamas
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRoomStatus("repair")}
                        disabled={!selectedRoom || selectedRoomId === "new"}
                        className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        <Hammer size={17} />
                        UÅ¾daryti remontui
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignForm((prev) => ({ ...prev, mode: "arriving_soon" }))}
                        disabled={!selectedRoom || selectedRoomId === "new"}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-black text-[#486b5d] hover:bg-[#ffffff] disabled:opacity-60"
                      >
                        <ArrowRightLeft size={17} />
                        Rezervuoti / perkelti
                      </button>
                    </div>
                  </Panel>

                  <Panel title="Ä®spÄ—jimai">
                    <div className="grid gap-3">
                      {selectedRoom?.reserved ? (
                        <div className="rounded-2xl border border-[#c9d8d0] bg-white p-4 text-sm font-bold leading-6 text-[#486b5d]">
                          Kambaryje yra rezervuota vieta. Patikrink atvykimo terminÄ… ir paruoÅ¡imo bÅ«senÄ….
                        </div>
                      ) : null}

                      {selectedRoom && selectedRoom.occupied + selectedRoom.reserved >= selectedRoom.capacity ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
                          Kambario talpa uÅ¾pildyta. NaujÄ… gyventojÄ… galima priskirti tik atlaisvinus vietÄ….
                        </div>
                      ) : null}

                      {selectedRoom?.room_status === "repair" ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
                          Kambarys paÅ¾ymÄ—tas kaip remontuojamas. Naujam gyventojui nenaudoti.
                        </div>
                      ) : null}

                      {!selectedRoom || (!selectedRoom.reserved && selectedRoom.occupied + selectedRoom.reserved < selectedRoom.capacity && selectedRoom.room_status !== "repair") ? (
                        <div className="rounded-2xl border border-[#a7f3d0] bg-[#eefaf3] p-4 text-sm font-bold leading-6 text-[#39594c]">
                          KritiniÅ³ Ä¯spÄ—jimÅ³ nÄ—ra.
                        </div>
                      ) : null}
                    </div>
                  </Panel>
                  </>
                  )}

                  <Panel title="Kambario santrauka">
                    <div className="space-y-3">
                      <InfoRow label="Sukurta" value={formatDate(selectedRoom?.created_at)} />
                      <InfoRow label="UÅ¾imta" value={`${selectedRoom?.occupied ?? 0} iÅ¡ ${selectedRoom?.capacity ?? 0}`} />
                      <InfoRow label="Rezervuota" value={selectedRoom?.reserved ?? 0} />
                      <InfoRow label="Laisva" value={selectedRoom ? Math.max(selectedRoom.capacity - selectedRoom.occupied - selectedRoom.reserved, 0) : "â€”"} />
                      <InfoRow label="Privalumai" value={selectedRoom ? featureList(selectedRoom).join(", ") : "â€”"} />
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
