"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import { logAudit } from "@/lib/audit"

type Gender = "male" | "female" | "mixed" | ""
type RoomType = "single" | "double" | "triple" | "quad" | "other"
type AssignMode = "active" | "arriving_soon" | "hospital" | "temporary_leave"

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
  organization_id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  resident_code: string | null
  current_room_id: string | null
  current_status: string | null
  status: string | null
  archived_at: string | null
  room_reserved_until: string | null
  is_active: boolean | null
}

type EditForm = {
  id: string
  name: string
  room_type: RoomType
  capacity: number
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

function toInt(value: string, fallback = 0) {
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
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

function formatGender(gender: Gender) {
  switch (gender) {
    case "male":
      return "Vyrai"
    case "female":
      return "Moterys"
    case "mixed":
      return "Mišrus"
    default:
      return "—"
  }
}

function statusLabel(status: string | null | undefined) {
  if (status === "arriving_soon") return "Netrukus atvyks"
  if (status === "active") return "Gyvena"
  if (status === "hospital") return "Ligoninėje"
  if (status === "temporary_leave") return "Laikinai išvykęs"
  if (status === "deceased") return "Mirė"
  if (status === "contract_ended") return "Nutraukė sutartį"
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

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("lt-LT")
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n")

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function getRoomVisual(room: Room) {
  if (!room.is_active) {
    return {
      label: "Neaktyvus",
      style: styles.roomInactive,
      badge: styles.statusInactive,
    }
  }

  if (room.reserved > 0 || room.room_status === "reserved" || room.reserved_for) {
    return {
      label: "Rezervuotas",
      style: styles.roomReserved,
      badge: styles.statusReserved,
    }
  }

  if (room.occupied >= room.capacity || room.room_status === "occupied" || room.occupied_by) {
    return {
      label: "Užimtas",
      style: styles.roomOccupied,
      badge: styles.statusOccupied,
    }
  }

  if (room.occupied > 0) {
    return {
      label: "Iš dalies užimtas",
      style: styles.roomPartial,
      badge: styles.statusPartial,
    }
  }

  return {
    label: "Laisvas",
    style: styles.roomFree,
    badge: styles.statusFree,
  }
}

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
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all")
  const [floorFilter, setFloorFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "free" | "partial" | "occupied" | "reserved">("all")

  const [bulkOpen, setBulkOpen] = useState(true)
  const [bulkForm, setBulkForm] = useState<BulkForm>(emptyBulkForm)

  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignForm, setAssignForm] = useState<AssignForm>(emptyAssignForm)
  const [releaseRoomId, setReleaseRoomId] = useState<string | null>(null)

  useEffect(() => {
    void loadOrganization()
  }, [])

  useEffect(() => {
    if (organizationId) {
      void loadRooms(organizationId)
    }
  }, [organizationId])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeEditModal()
        closeAssignModal()
        setReleaseRoomId(null)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  async function loadOrganization() {
    setError(null)
    setLoading(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError("Nepavyko nustatyti prisijungusio vartotojo.")
        setLoading(false)
        return
      }

      const orgId = await getCurrentOrganizationId()

      if (!orgId) {
        setError("Nepavyko nustatyti aktyvios organizacijos.")
        setLoading(false)
        return
      }

      setOrganizationId(orgId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepavyko nustatyti organizacijos.")
      setLoading(false)
    }
  }

  async function loadRooms(orgId: string) {
    setLoading(true)
    setError(null)

    const { data: roomRows, error: roomError } = await supabase
      .from("rooms")
      .select(`
        id,
        organization_id,
        name,
        room_type,
        capacity,
        floor,
        gender,
        area_m2,
        sort_order,
        oxygen,
        nursing,
        wc,
        shower,
        sink,
        functional_bed,
        wheelchair_accessible,
        notes,
        is_active,
        created_at,
        occupied_by,
        reserved_for,
        reserved_until,
        room_status
      `)
      .eq("organization_id", orgId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })

    if (roomError) {
      setLoading(false)
      setError(roomError.message)
      return
    }

    const { data: residentsRows, error: residentsError } = await supabase
      .from("residents")
      .select(`
        id,
        organization_id,
        first_name,
        last_name,
        full_name,
        resident_code,
        current_room_id,
        current_status,
        status,
        archived_at,
        room_reserved_until,
        is_active
      `)
      .eq("organization_id", orgId)
      .is("archived_at", null)

    if (residentsError) {
      setLoading(false)
      setError(residentsError.message)
      return
    }

    const residentList = ((residentsRows || []) as Resident[]).filter((resident) => resident.is_active !== false)

    const occupiedMap = new Map<string, number>()
    const reservedMap = new Map<string, number>()

    for (const resident of residentList) {
      const roomId = resident.current_room_id
      if (!roomId) continue

      const status = resident.current_status || resident.status

      if (status === "arriving_soon") {
        reservedMap.set(roomId, (reservedMap.get(roomId) || 0) + 1)
      } else if (status === "active" || status === "hospital" || status === "temporary_leave") {
        occupiedMap.set(roomId, (occupiedMap.get(roomId) || 0) + 1)
      }
    }

    const mapped: Room[] = ((roomRows as RoomRow[] | null) || []).map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      room_type: (row.room_type as RoomType) || "other",
      capacity: row.capacity ?? 1,
      floor: row.floor,
      gender: (row.gender as Gender) || "",
      area_m2: row.area_m2,
      sort_order: row.sort_order,
      oxygen: !!row.oxygen,
      nursing: !!row.nursing,
      wc: !!row.wc,
      shower: !!row.shower,
      sink: !!row.sink,
      functional_bed: !!row.functional_bed,
      wheelchair_accessible: !!row.wheelchair_accessible,
      notes: row.notes || "",
      is_active: row.is_active ?? true,
      created_at: row.created_at,
      occupied_by: row.occupied_by || null,
      reserved_for: row.reserved_for || null,
      reserved_until: row.reserved_until || null,
      room_status: row.room_status || null,
      occupied: occupiedMap.get(row.id) || 0,
      reserved: reservedMap.get(row.id) || 0,
    }))

    setRooms(mapped)
    setResidents(residentList)
    setLoading(false)
  }

  const residentsByRoom = useMemo(() => {
    const map = new Map<string, Resident[]>()

    residents.forEach((resident) => {
      if (!resident.current_room_id) return
      if (!map.has(resident.current_room_id)) map.set(resident.current_room_id, [])
      map.get(resident.current_room_id)!.push(resident)
    })

    return map
  }, [residents])

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const search = query.trim().toLowerCase()
      const roomResidents = residentsByRoom.get(room.id) || []
      const searchOk =
        !search ||
        room.name.toLowerCase().includes(search) ||
        formatType(room.room_type).toLowerCase().includes(search) ||
        formatGender(room.gender).toLowerCase().includes(search) ||
        room.notes.toLowerCase().includes(search) ||
        roomResidents.some((resident) => residentName(resident).toLowerCase().includes(search))

      const typeOk = typeFilter === "all" || room.room_type === typeFilter

      const activeOk =
        activeFilter === "all" ||
        (activeFilter === "active" ? room.is_active : !room.is_active)

      const floorOk =
        floorFilter === "all" ||
        String(room.floor ?? "") === floorFilter

      const roomVisual = getRoomVisual(room)
      const statusOk =
        statusFilter === "all" ||
        (statusFilter === "free" && roomVisual.label === "Laisvas") ||
        (statusFilter === "partial" && roomVisual.label === "Iš dalies užimtas") ||
        (statusFilter === "occupied" && roomVisual.label === "Užimtas") ||
        (statusFilter === "reserved" && roomVisual.label === "Rezervuotas")

      return searchOk && typeOk && activeOk && floorOk && statusOk
    })
  }, [rooms, residentsByRoom, query, typeFilter, activeFilter, floorFilter, statusFilter])

  const stats = useMemo(() => {
    const totalRooms = filteredRooms.length
    const totalPlaces = filteredRooms.reduce((sum, room) => sum + room.capacity, 0)
    const occupiedPlaces = filteredRooms.reduce((sum, room) => sum + room.occupied, 0)
    const reservedPlaces = filteredRooms.reduce((sum, room) => sum + room.reserved, 0)
    const freePlaces = Math.max(totalPlaces - occupiedPlaces - reservedPlaces, 0)

    const freeRooms = filteredRooms.filter((room) => getRoomVisual(room).label === "Laisvas").length
    const occupiedRooms = filteredRooms.filter((room) => getRoomVisual(room).label === "Užimtas").length
    const reservedRooms = filteredRooms.filter((room) => getRoomVisual(room).label === "Rezervuotas").length
    const partialRooms = filteredRooms.filter((room) => getRoomVisual(room).label === "Iš dalies užimtas").length

    const byType = filteredRooms.reduce(
      (acc, room) => {
        acc[room.room_type] += 1
        return acc
      },
      { single: 0, double: 0, triple: 0, quad: 0, other: 0 }
    )

    return {
      totalRooms,
      totalPlaces,
      occupiedPlaces,
      reservedPlaces,
      freePlaces,
      freeRooms,
      occupiedRooms,
      reservedRooms,
      partialRooms,
      byType,
    }
  }, [filteredRooms])

  const floors = useMemo(() => {
    return Array.from(
      new Set(
        rooms
          .map((room) => room.floor)
          .filter((floor): floor is number => typeof floor === "number")
      )
    ).sort((a, b) => a - b)
  }, [rooms])

  const roomsByFloor = useMemo(() => {
    const map = new Map<string, Room[]>()

    filteredRooms.forEach((room) => {
      const key = room.floor == null ? "Be aukšto" : `${room.floor} aukštas`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(room)
    })

    return Array.from(map.entries())
  }, [filteredRooms])

  const availableResidents = useMemo(() => {
    return residents.filter((resident) => {
      const status = resident.current_status || resident.status
      return !resident.current_room_id || status === "arriving_soon"
    })
  }, [residents])

  const bulkPreview = useMemo(() => {
    const single = toInt(bulkForm.singleCount)
    const double = toInt(bulkForm.doubleCount)
    const triple = toInt(bulkForm.tripleCount)
    const quad = toInt(bulkForm.quadCount)
    const other = toInt(bulkForm.otherCount)
    const otherCapacity = Math.max(toInt(bulkForm.otherCapacity, 5), 1)

    const totalRooms = single + double + triple + quad + other
    const totalPlaces = single * 1 + double * 2 + triple * 3 + quad * 4 + other * otherCapacity

    return { totalRooms, totalPlaces, otherCapacity }
  }, [bulkForm])

  function resetMessages() {
    setError(null)
    setSuccess(null)
  }

  function openEditModal(room: Room) {
    setEditingRoomId(room.id)
    setEditForm({
      id: room.id,
      name: room.name,
      room_type: room.room_type,
      capacity: room.capacity,
      floor: room.floor == null ? "" : String(room.floor),
      gender: room.gender,
      area_m2: room.area_m2 == null ? "" : String(room.area_m2),
      sort_order: room.sort_order == null ? "" : String(room.sort_order),
      oxygen: room.oxygen,
      nursing: room.nursing,
      wc: room.wc,
      shower: room.shower,
      sink: room.sink,
      functional_bed: room.functional_bed,
      wheelchair_accessible: room.wheelchair_accessible,
      notes: room.notes,
      is_active: room.is_active,
    })
  }

  function closeEditModal() {
    setEditingRoomId(null)
    setEditForm(null)
  }

  function openAssignModal(room: Room, mode: AssignMode = "active") {
    setAssignForm({
      roomId: room.id,
      residentId: "",
      mode,
      reservedUntil: "",
    })
    setAssignOpen(true)
  }

  function closeAssignModal() {
    setAssignOpen(false)
    setAssignForm(emptyAssignForm)
  }

  async function createRoomsBulk() {
    if (!organizationId) return
    resetMessages()
    setSaving(true)

    try {
      const startNumber = toInt(bulkForm.startNumber, 101)
      const startSortOrder = toInt(bulkForm.startSortOrder, 1)
      const floor = bulkForm.floor.trim() ? toInt(bulkForm.floor) : null
      const gender = bulkForm.gender || null

      const single = Math.max(toInt(bulkForm.singleCount), 0)
      const double = Math.max(toInt(bulkForm.doubleCount), 0)
      const triple = Math.max(toInt(bulkForm.tripleCount), 0)
      const quad = Math.max(toInt(bulkForm.quadCount), 0)
      const other = Math.max(toInt(bulkForm.otherCount), 0)
      const otherCapacity = Math.max(toInt(bulkForm.otherCapacity, 5), 1)

      if (single + double + triple + quad + other === 0) {
        setError("Nurodyk bent vieną kuriamų kambarių kiekį.")
        setSaving(false)
        return
      }

      let currentNumber = startNumber
      let currentSortOrder = startSortOrder

      const rows: Record<string, unknown>[] = []

      const addRooms = (count: number, capacity: number, roomType: RoomType) => {
        for (let i = 0; i < count; i += 1) {
          rows.push({
            organization_id: organizationId,
            name: `${bulkForm.prefix}${currentNumber}`,
            room_type: roomType,
            capacity,
            floor,
            gender,
            sort_order: currentSortOrder,
            oxygen: false,
            nursing: false,
            wc: false,
            shower: false,
            sink: false,
            functional_bed: false,
            wheelchair_accessible: false,
            notes: "",
            is_active: true,
            room_status: "available",
          })
          currentNumber += 1
          currentSortOrder += 1
        }
      }

      addRooms(single, 1, "single")
      addRooms(double, 2, "double")
      addRooms(triple, 3, "triple")
      addRooms(quad, 4, "quad")
      addRooms(other, otherCapacity, "other")

      const names = rows.map((row) => String(row.name))
      const { data: existingRooms, error: existingError } = await supabase
        .from("rooms")
        .select("name")
        .eq("organization_id", organizationId)
        .in("name", names)

      if (existingError) {
        setError(existingError.message)
        setSaving(false)
        return
      }

      if ((existingRooms || []).length > 0) {
        const duplicateNames = (existingRooms || []).map((r: any) => r.name).join(", ")
        setError(`Tokie kambariai jau egzistuoja: ${duplicateNames}`)
        setSaving(false)
        return
      }

      const { data: insertedRooms, error: insertError } = await supabase.from("rooms").insert(rows).select("id, name")

      if (insertError) {
        setError(insertError.message)
        setSaving(false)
        return
      }

      await logAudit({
        organizationId,
        tableName: "rooms",
        recordId: insertedRooms?.[0]?.id || null,
        action: "insert",
        changes: {
          created_count: rows.length,
          rooms: rows.map((row) => row.name),
        },
      })

      setSuccess(`Sukurta ${rows.length} kambarių.`)
      setBulkForm(emptyBulkForm)
      await loadRooms(organizationId)
      setBulkOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function saveRoomEdit() {
    if (!organizationId || !editForm) return
    resetMessages()
    setSaving(true)

    try {
      const name = editForm.name.trim()
      if (!name) {
        setError("Kambario numeris / pavadinimas negali būti tuščias.")
        setSaving(false)
        return
      }

      if (editForm.capacity < 1) {
        setError("Vietų skaičius turi būti bent 1.")
        setSaving(false)
        return
      }

      const duplicate = rooms.find(
        (room) => room.id !== editForm.id && room.name.trim().toLowerCase() === name.toLowerCase()
      )

      if (duplicate) {
        setError("Toks kambario numeris jau egzistuoja.")
        setSaving(false)
        return
      }

      const before = rooms.find((room) => room.id === editForm.id) || null

      const payload = {
        name,
        room_type: editForm.room_type,
        capacity: editForm.capacity,
        floor: editForm.floor.trim() ? toInt(editForm.floor) : null,
        gender: editForm.gender || null,
        area_m2: editForm.area_m2.trim() ? Number(editForm.area_m2) : null,
        sort_order: editForm.sort_order.trim() ? toInt(editForm.sort_order) : null,
        oxygen: editForm.oxygen,
        nursing: editForm.nursing,
        wc: editForm.wc,
        shower: editForm.shower,
        sink: editForm.sink,
        functional_bed: editForm.functional_bed,
        wheelchair_accessible: editForm.wheelchair_accessible,
        notes: editForm.notes.trim(),
        is_active: editForm.is_active,
      }

      const { error: updateError } = await supabase
        .from("rooms")
        .update(payload)
        .eq("id", editForm.id)
        .eq("organization_id", organizationId)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      await logAudit({
        organizationId,
        tableName: "rooms",
        recordId: editForm.id,
        action: "update",
        changes: {
          before: before
            ? {
                name: before.name,
                room_type: before.room_type,
                capacity: before.capacity,
                floor: before.floor,
                gender: before.gender,
                area_m2: before.area_m2,
                sort_order: before.sort_order,
                is_active: before.is_active,
              }
            : null,
          after: payload,
        },
      })

      setSuccess("Kambarys atnaujintas.")
      await loadRooms(organizationId)
      closeEditModal()
    } finally {
      setSaving(false)
    }
  }

  async function assignResidentToRoom() {
    if (!organizationId) return

    const room = rooms.find((item) => item.id === assignForm.roomId)
    const resident = residents.find((item) => item.id === assignForm.residentId)

    if (!room) {
      setError("Pasirinktas kambarys nerastas.")
      return
    }

    if (!resident) {
      setError("Pasirink gyventoją.")
      return
    }

    if (assignForm.mode === "arriving_soon" && !assignForm.reservedUntil) {
      setError("Rezervacijai nurodyk datą iki kada rezervuota.")
      return
    }

    resetMessages()
    setSaving(true)

    try {
      const status = assignForm.mode
      const reservedUntil = status === "arriving_soon" ? assignForm.reservedUntil : null
      const isReservation = status === "arriving_soon"

      const { error: clearRoomsError } = await supabase
        .from("rooms")
        .update({
          occupied_by: null,
          reserved_for: null,
          reserved_until: null,
          room_status: "available",
        })
        .or(`occupied_by.eq.${resident.id},reserved_for.eq.${resident.id}`)

      if (clearRoomsError) throw clearRoomsError

      const { error: residentError } = await supabase
        .from("residents")
        .update({
          current_room_id: room.id,
          current_status: status,
          room_reserved_until: reservedUntil,
        })
        .eq("id", resident.id)
        .eq("organization_id", organizationId)

      if (residentError) throw residentError

      const { error: roomError } = await supabase
        .from("rooms")
        .update({
          occupied_by: isReservation ? null : resident.id,
          reserved_for: isReservation ? resident.id : null,
          reserved_until: reservedUntil,
          room_status: isReservation ? "reserved" : "occupied",
        })
        .eq("id", room.id)
        .eq("organization_id", organizationId)

      if (roomError) throw roomError

      await logAudit({
        organizationId,
        tableName: "rooms",
        recordId: room.id,
        action: "update",
        changes: {
  Veiksmas: isReservation ? "Kambario rezervacija" : "Gyventojo priskyrimas kambariui",
  Kambarys: room.name,
  Gyventojas: residentName(resident),
  Statusas: statusLabel(status),
  ...(reservedUntil ? { "Rezervuota iki": reservedUntil } : {}),
},
      })

      const residentChanges: Record<string, { from: unknown; to: unknown }> = {}

if ((resident.current_room_id || null) !== room.id) {
  residentChanges.current_room_id = {
    from: resident.current_room_id || null,
    to: room.id,
  }
}

if ((resident.current_status || resident.status || null) !== status) {
  residentChanges.current_status = {
    from: resident.current_status || resident.status || null,
    to: status,
  }
}

if ((resident.room_reserved_until || null) !== reservedUntil) {
  residentChanges.room_reserved_until = {
    from: resident.room_reserved_until || null,
    to: reservedUntil,
  }
}

if (Object.keys(residentChanges).length > 0) {
  await logAudit({
    organizationId,
    tableName: "residents",
    recordId: resident.id,
    action: "update",
    changes: residentChanges,
  })
}

      setSuccess(isReservation ? "Kambarys rezervuotas gyventojui." : "Gyventojas priskirtas kambariui.")
      await loadRooms(organizationId)
      closeAssignModal()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepavyko priskirti gyventojo.")
    } finally {
      setSaving(false)
    }
  }

  async function releaseRoom(roomId: string) {
    if (!organizationId) return

    const room = rooms.find((item) => item.id === roomId)
    const roomResidents = residentsByRoom.get(roomId) || []

    if (!room) return

    if (!confirm(`Ar tikrai atlaisvinti kambarį ${room.name}? Gyventojams bus nuimtas kambario priskyrimas.`)) {
      return
    }

    resetMessages()
    setSaving(true)

    try {
      const residentIds = roomResidents.map((resident) => resident.id)

      if (residentIds.length > 0) {
        const { error: residentsError } = await supabase
          .from("residents")
          .update({
            current_room_id: null,
            room_reserved_until: null,
          })
          .in("id", residentIds)
          .eq("organization_id", organizationId)

        if (residentsError) throw residentsError
      }

      const { error: roomError } = await supabase
        .from("rooms")
        .update({
          occupied_by: null,
          reserved_for: null,
          reserved_until: null,
          room_status: "available",
        })
        .eq("id", roomId)
        .eq("organization_id", organizationId)

      if (roomError) throw roomError

      await logAudit({
        organizationId,
        tableName: "rooms",
        recordId: roomId,
        action: "update",
        changes: {
          action: "Kambarys atlaisvintas",
          room: room.name,
          residents: roomResidents.map((resident) => residentName(resident)),
        },
      })

      setSuccess("Kambarys atlaisvintas.")
      await loadRooms(organizationId)
      setReleaseRoomId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepavyko atlaisvinti kambario.")
    } finally {
      setSaving(false)
    }
  }

  function exportStats() {
    const rows: string[][] = [
      ["Rodiklis", "Reikšmė"],
      ["Kambarių skaičius", String(stats.totalRooms)],
      ["Vietų skaičius", String(stats.totalPlaces)],
      ["Užimta vietų", String(stats.occupiedPlaces)],
      ["Rezervuota vietų", String(stats.reservedPlaces)],
      ["Laisva vietų", String(stats.freePlaces)],
      ["Laisvų kambarių", String(stats.freeRooms)],
      ["Rezervuotų kambarių", String(stats.reservedRooms)],
      ["Užimtų kambarių", String(stats.occupiedRooms)],
      ["Iš dalies užimtų kambarių", String(stats.partialRooms)],
      ["Vienviečių", String(stats.byType.single)],
      ["Dviviečių", String(stats.byType.double)],
      ["Triviečių", String(stats.byType.triple)],
      ["Keturviečių", String(stats.byType.quad)],
      ["Kitų", String(stats.byType.other)],
      [],
      ["Kambariai"],
      [
        "Numeris",
        "Tipas",
        "Vietos",
        "Užimta",
        "Rezervuota",
        "Laisva",
        "Aukštas",
        "Lytis",
        "Aktyvus",
        "Būsena",
        "Gyventojai",
        "Įranga",
        "Pastabos",
      ],
      ...filteredRooms.map((room) => {
        const roomResidents = residentsByRoom.get(room.id) || []
        const visual = getRoomVisual(room)

        return [
          room.name,
          formatType(room.room_type),
          String(room.capacity),
          String(room.occupied),
          String(room.reserved),
          String(Math.max(room.capacity - room.occupied - room.reserved, 0)),
          room.floor == null ? "" : String(room.floor),
          formatGender(room.gender),
          room.is_active ? "Taip" : "Ne",
          visual.label,
          roomResidents.map((resident) => residentName(resident)).join(" | "),
          [
            room.oxygen ? "Deguonis" : "",
            room.nursing ? "Slauga" : "",
            room.wc ? "WC" : "",
            room.shower ? "Dušas" : "",
            room.sink ? "Kriauklė" : "",
            room.functional_bed ? "Funkcinė lova" : "",
            room.wheelchair_accessible ? "Pritaikytas neįgaliesiems" : "",
          ]
            .filter(Boolean)
            .join(" | "),
          room.notes,
        ]
      }),
    ]

    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`kambariu-statistika-${date}.csv`, rows)
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Kraunama...</div>
  }

  const selectedAssignRoom = rooms.find((room) => room.id === assignForm.roomId) || null
  const selectedReleaseRoom = rooms.find((room) => room.id === releaseRoomId) || null
  const selectedReleaseResidents = releaseRoomId ? residentsByRoom.get(releaseRoomId) || [] : []

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Kambariai</h1>
          <p style={styles.subtitle}>
            Masinis kūrimas, statistika, užimtumas, rezervacijos ir gyventojų priskyrimas vienoje vietoje.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button type="button" onClick={() => setBulkOpen((v) => !v)} style={styles.secondaryButton}>
            {bulkOpen ? "Slėpti masinį kūrimą" : "Rodyti masinį kūrimą"}
          </button>
          <button type="button" onClick={exportStats} style={styles.primaryButton}>
            Atsisiųsti statistiką
          </button>
        </div>
      </div>

      {error ? <div style={styles.errorBox}>{error}</div> : null}
      {success ? <div style={styles.successBox}>{success}</div> : null}

      {bulkOpen ? (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Masinis kambarių sukūrimas</h2>
              <p style={styles.panelText}>
                Suvesk kiek vienviečių, dviviečių ir kitų kambarių turi, o sistema juos sukurs iš karto.
              </p>
            </div>
          </div>

          <div style={styles.bulkGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Prefiksas</span>
              <input
                style={styles.input}
                value={bulkForm.prefix}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, prefix: e.target.value }))}
                placeholder="Pvz. A-"
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Pradinis numeris</span>
              <input
                style={styles.input}
                type="number"
                value={bulkForm.startNumber}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, startNumber: e.target.value }))}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Pradinis rikiavimo nr.</span>
              <input
                style={styles.input}
                type="number"
                value={bulkForm.startSortOrder}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, startSortOrder: e.target.value }))}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Aukštas</span>
              <input
                style={styles.input}
                type="number"
                value={bulkForm.floor}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, floor: e.target.value }))}
                placeholder="Pvz. 2"
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Lytis</span>
              <select
                style={styles.input}
                value={bulkForm.gender}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, gender: e.target.value as Gender }))}
              >
                <option value="">Nenurodyta</option>
                <option value="male">Vyrai</option>
                <option value="female">Moterys</option>
                <option value="mixed">Mišrus</option>
              </select>
            </label>
          </div>

          <div style={styles.bulkCountsGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Vienviečių</span>
              <input
                style={styles.input}
                type="number"
                min={0}
                value={bulkForm.singleCount}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, singleCount: e.target.value }))}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Dviviečių</span>
              <input
                style={styles.input}
                type="number"
                min={0}
                value={bulkForm.doubleCount}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, doubleCount: e.target.value }))}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Triviečių</span>
              <input
                style={styles.input}
                type="number"
                min={0}
                value={bulkForm.tripleCount}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, tripleCount: e.target.value }))}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Keturviečių</span>
              <input
                style={styles.input}
                type="number"
                min={0}
                value={bulkForm.quadCount}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, quadCount: e.target.value }))}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Kitų kambarių</span>
              <input
                style={styles.input}
                type="number"
                min={0}
                value={bulkForm.otherCount}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, otherCount: e.target.value }))}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Kitų kambarių vietos</span>
              <input
                style={styles.input}
                type="number"
                min={1}
                value={bulkForm.otherCapacity}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, otherCapacity: e.target.value }))}
              />
            </label>
          </div>

          <div style={styles.previewBox}>
            <strong>Peržiūra:</strong> bus sukurta <strong>{bulkPreview.totalRooms}</strong> kambarių ir{" "}
            <strong>{bulkPreview.totalPlaces}</strong> vietų.
          </div>

          <div style={styles.actionsRow}>
            <button type="button" onClick={createRoomsBulk} disabled={saving} style={styles.primaryButton}>
              {saving ? "Kuriama..." : "Sukurti kambarius"}
            </button>
          </div>
        </section>
      ) : null}

      <section style={styles.statsGrid}>
        <button type="button" style={styles.statCard} onClick={() => setStatusFilter("all")}>
          <div style={styles.statLabel}>Kambarių</div>
          <div style={styles.statValue}>{stats.totalRooms}</div>
        </button>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Vietų</div>
          <div style={styles.statValue}>{stats.totalPlaces}</div>
        </div>
        <button type="button" style={styles.statCard} onClick={() => setStatusFilter("occupied")}>
          <div style={styles.statLabel}>Užimta vietų</div>
          <div style={styles.statValue}>{stats.occupiedPlaces}</div>
        </button>
        <button type="button" style={styles.statCard} onClick={() => setStatusFilter("reserved")}>
          <div style={styles.statLabel}>Rezervuota vietų</div>
          <div style={styles.statValue}>{stats.reservedPlaces}</div>
        </button>
        <button type="button" style={styles.statCard} onClick={() => setStatusFilter("free")}>
          <div style={styles.statLabel}>Laisva vietų</div>
          <div style={styles.statValue}>{stats.freePlaces}</div>
        </button>
        <button type="button" style={styles.statCard} onClick={() => setStatusFilter("partial")}>
          <div style={styles.statLabel}>Iš dalies užimtų</div>
          <div style={styles.statValue}>{stats.partialRooms}</div>
        </button>
      </section>

      <section style={styles.panel}>
        <div style={styles.filtersGrid}>
          <label style={styles.field}>
            <span style={styles.label}>Paieška</span>
            <input
              style={styles.input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kambario nr., gyventojas, tipas..."
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Tipas</span>
            <select
              style={styles.input}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as RoomType | "all")}
            >
              <option value="all">Visi</option>
              <option value="single">Vienviečiai</option>
              <option value="double">Dviviečiai</option>
              <option value="triple">Triviečiai</option>
              <option value="quad">Keturviečiai</option>
              <option value="other">Kiti</option>
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Būsena</span>
            <select
              style={styles.input}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">Visi</option>
              <option value="free">Laisvi</option>
              <option value="partial">Iš dalies užimti</option>
              <option value="occupied">Užimti</option>
              <option value="reserved">Rezervuoti</option>
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Aktyvumas</span>
            <select
              style={styles.input}
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as "all" | "active" | "inactive")}
            >
              <option value="all">Visi</option>
              <option value="active">Aktyvūs</option>
              <option value="inactive">Neaktyvūs</option>
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Aukštas</span>
            <select
              style={styles.input}
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
            >
              <option value="all">Visi</option>
              {floors.map((floor) => (
                <option key={floor} value={String(floor)}>
                  {floor}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={styles.legendRow}>
          <span style={{ ...styles.legendDot, background: "#dcfce7", borderColor: "#86efac" }} /> Laisvas
          <span style={{ ...styles.legendDot, background: "#fef9c3", borderColor: "#fde047" }} /> Rezervuotas
          <span style={{ ...styles.legendDot, background: "#ffedd5", borderColor: "#fdba74" }} /> Iš dalies užimtas
          <span style={{ ...styles.legendDot, background: "#fee2e2", borderColor: "#fca5a5" }} /> Užimtas
        </div>

        <div style={styles.floorGridWrap}>
          {roomsByFloor.map(([floor, floorRooms]) => (
            <div key={floor} style={styles.floorBlock}>
              <h3 style={styles.floorTitle}>{floor}</h3>

              <div style={styles.roomGrid}>
                {floorRooms.map((room) => {
                  const visual = getRoomVisual(room)
                  const roomResidents = residentsByRoom.get(room.id) || []

                  return (
                    <div key={room.id} style={{ ...styles.roomCard, ...visual.style }}>
                      <div style={styles.roomCardTop}>
                        <strong>{room.name}</strong>
                        <span style={visual.badge}>{visual.label}</span>
                      </div>

                      <div style={styles.roomCardMeta}>
                        {room.occupied + room.reserved} / {room.capacity} vietos · {formatType(room.room_type)}
                      </div>

                      <div style={styles.roomResidents}>
                        {roomResidents.length > 0 ? (
                          roomResidents.map((resident) => (
                            <div key={resident.id} style={styles.residentPill}>
                              {residentName(resident)}
                              <span>{statusLabel(resident.current_status || resident.status)}</span>
                            </div>
                          ))
                        ) : (
                          <span style={styles.metaText}>Gyventojų nėra</span>
                        )}
                      </div>

                      <div style={styles.roomActions}>
                        <button type="button" style={styles.greenSmallButton} onClick={() => openAssignModal(room, "active")}>
                          Priskirti
                        </button>
                        <button type="button" style={styles.yellowSmallButton} onClick={() => openAssignModal(room, "arriving_soon")}>
                          Rezervuoti
                        </button>
                        <button type="button" style={styles.secondaryButtonSmall} onClick={() => openEditModal(room)}>
                          Redaguoti
                        </button>
                        {(roomResidents.length > 0 || room.occupied_by || room.reserved_for) ? (
                          <button type="button" style={styles.dangerSmallButton} onClick={() => setReleaseRoomId(room.id)}>
                            Atlaisvinti
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Kambarys</th>
                <th style={styles.th}>Tipas</th>
                <th style={styles.th}>Vietos</th>
                <th style={styles.th}>Užimtumas</th>
                <th style={styles.th}>Gyventojai</th>
                <th style={styles.th}>Aukštas</th>
                <th style={styles.th}>Lytis</th>
                <th style={styles.th}>Įranga</th>
                <th style={styles.th}>Būsena</th>
                <th style={styles.th}>Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.map((room) => {
                const roomResidents = residentsByRoom.get(room.id) || []
                const free = Math.max(room.capacity - room.occupied - room.reserved, 0)
                const visual = getRoomVisual(room)
                const tags = [
                  room.oxygen ? "Deguonis" : null,
                  room.nursing ? "Slauga" : null,
                  room.wc ? "WC" : null,
                  room.shower ? "Dušas" : null,
                  room.sink ? "Kriauklė" : null,
                  room.functional_bed ? "Funkcinė lova" : null,
                  room.wheelchair_accessible ? "Pritaikytas" : null,
                ].filter(Boolean) as string[]

                return (
                  <tr key={room.id}>
                    <td style={styles.tdStrong}>
                      <div>{room.name}</div>
                      <div style={styles.metaText}>
                        <Link href={`/residents?room_id=${room.id}`} style={styles.link}>
                          Gyventojai kambaryje
                        </Link>
                      </div>
                    </td>
                    <td style={styles.td}>{formatType(room.room_type)}</td>
                    <td style={styles.td}>{room.capacity}</td>
                    <td style={styles.td}>
                      {room.occupied + room.reserved} / {room.capacity}
                      <div style={styles.metaText}>
                        Užimta: {room.occupied} · Rezervuota: {room.reserved} · Laisva: {free}
                      </div>
                    </td>
                    <td style={styles.td}>
                      {roomResidents.length > 0 ? (
                        <div style={styles.tagWrap}>
                          {roomResidents.map((resident) => (
                            <span key={resident.id} style={styles.tag}>
                              {residentName(resident)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={styles.metaText}>Nėra</span>
                      )}
                    </td>
                    <td style={styles.td}>{room.floor ?? "—"}</td>
                    <td style={styles.td}>{formatGender(room.gender)}</td>
                    <td style={styles.td}>
                      <div style={styles.tagWrap}>
                        {tags.length > 0 ? tags.map((tag) => (
                          <span key={tag} style={styles.tag}>{tag}</span>
                        )) : <span style={styles.metaText}>Nėra</span>}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={visual.badge}>{visual.label}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.rowActions}>
                        <button type="button" style={styles.greenSmallButton} onClick={() => openAssignModal(room, "active")}>
                          Priskirti
                        </button>
                        <button type="button" style={styles.yellowSmallButton} onClick={() => openAssignModal(room, "arriving_soon")}>
                          Rezervuoti
                        </button>
                        <button type="button" style={styles.secondaryButtonSmall} onClick={() => openEditModal(room)}>
                          Redaguoti
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={10} style={styles.emptyCell}>
                    Kambarių pagal pasirinktus filtrus nerasta.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {assignOpen ? (
        <div style={styles.modalBackdrop} onClick={closeAssignModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>
                  {assignForm.mode === "arriving_soon" ? "Rezervuoti kambarį" : "Priskirti gyventoją"}
                </h3>
                <p style={styles.panelText}>
                  {selectedAssignRoom ? `Kambarys: ${selectedAssignRoom.name}` : "Pasirink kambario ir gyventojo duomenis."}
                </p>
              </div>
              <button type="button" style={styles.closeButton} onClick={closeAssignModal}>
                ×
              </button>
            </div>

            <div style={styles.modalGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Kambarys</span>
                <select
                  style={styles.input}
                  value={assignForm.roomId}
                  onChange={(e) => setAssignForm((prev) => ({ ...prev, roomId: e.target.value }))}
                >
                  <option value="">Pasirink kambarį</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} · {room.occupied + room.reserved}/{room.capacity}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Gyventojas</span>
                <select
                  style={styles.input}
                  value={assignForm.residentId}
                  onChange={(e) => setAssignForm((prev) => ({ ...prev, residentId: e.target.value }))}
                >
                  <option value="">Pasirink gyventoją</option>
                  {availableResidents.map((resident) => (
                    <option key={resident.id} value={resident.id}>
                      {residentName(resident)} · {statusLabel(resident.current_status || resident.status)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Veiksmas</span>
                <select
                  style={styles.input}
                  value={assignForm.mode}
                  onChange={(e) => setAssignForm((prev) => ({ ...prev, mode: e.target.value as AssignMode }))}
                >
                  <option value="active">Priskirti kaip gyvenantį</option>
                  <option value="arriving_soon">Rezervuoti, netrukus atvyks</option>
                  <option value="hospital">Priskirti, ligoninėje</option>
                  <option value="temporary_leave">Priskirti, laikinai išvykęs</option>
                </select>
              </label>

              {assignForm.mode === "arriving_soon" ? (
                <label style={styles.field}>
                  <span style={styles.label}>Rezervuota iki</span>
                  <input
                    style={styles.input}
                    type="date"
                    value={assignForm.reservedUntil}
                    onChange={(e) => setAssignForm((prev) => ({ ...prev, reservedUntil: e.target.value }))}
                  />
                </label>
              ) : null}
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.secondaryButton} onClick={closeAssignModal}>
                Atšaukti
              </button>
              <button type="button" style={styles.primaryButton} onClick={assignResidentToRoom} disabled={saving}>
                {saving ? "Saugoma..." : assignForm.mode === "arriving_soon" ? "Rezervuoti" : "Priskirti"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {releaseRoomId && selectedReleaseRoom ? (
        <div style={styles.modalBackdrop} onClick={() => setReleaseRoomId(null)}>
          <div style={styles.modalCardSmall} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Atlaisvinti kambarį</h3>
                <p style={styles.panelText}>Kambarys: {selectedReleaseRoom.name}</p>
              </div>
              <button type="button" style={styles.closeButton} onClick={() => setReleaseRoomId(null)}>
                ×
              </button>
            </div>

            <div style={styles.warningBox}>
              Gyventojams bus nuimtas kambario priskyrimas. Jų statusas nebus keičiamas.
            </div>

            <div style={styles.releaseList}>
              {selectedReleaseResidents.length > 0 ? (
                selectedReleaseResidents.map((resident) => (
                  <div key={resident.id} style={styles.releaseItem}>
                    <strong>{residentName(resident)}</strong>
                    <span>{statusLabel(resident.current_status || resident.status)}</span>
                  </div>
                ))
              ) : (
                <div style={styles.metaText}>Gyventojų nėra, bus tik išvalyta kambario būsena.</div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.secondaryButton} onClick={() => setReleaseRoomId(null)}>
                Atšaukti
              </button>
              <button type="button" style={styles.dangerButton} onClick={() => releaseRoom(releaseRoomId)} disabled={saving}>
                {saving ? "Atlaisvinama..." : "Atlaisvinti"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editForm && editingRoomId ? (
        <div style={styles.modalBackdrop} onClick={closeEditModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Redaguoti kambarį</h3>
                <p style={styles.panelText}>Keisk kambario duomenis ir savybes vienoje vietoje.</p>
              </div>
              <button type="button" style={styles.closeButton} onClick={closeEditModal}>
                ×
              </button>
            </div>

            <div style={styles.modalGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Kambario numeris</span>
                <input
                  style={styles.input}
                  autoFocus
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Tipas</span>
                <select
                  style={styles.input}
                  value={editForm.room_type}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, room_type: e.target.value as RoomType } : prev)}
                >
                  <option value="single">Vienvietis</option>
                  <option value="double">Dvivietis</option>
                  <option value="triple">Trivietis</option>
                  <option value="quad">Keturvietis</option>
                  <option value="other">Kitas</option>
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Vietų skaičius</span>
                <input
                  style={styles.input}
                  type="number"
                  min={1}
                  value={editForm.capacity}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, capacity: Math.max(1, Number(e.target.value || 1)) } : prev)}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Aukštas</span>
                <input
                  style={styles.input}
                  type="number"
                  value={editForm.floor}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, floor: e.target.value } : prev)}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Lytis</span>
                <select
                  style={styles.input}
                  value={editForm.gender}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, gender: e.target.value as Gender } : prev)}
                >
                  <option value="">Nenurodyta</option>
                  <option value="male">Vyrai</option>
                  <option value="female">Moterys</option>
                  <option value="mixed">Mišrus</option>
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Kvadratūra</span>
                <input
                  style={styles.input}
                  type="number"
                  step="0.1"
                  value={editForm.area_m2}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, area_m2: e.target.value } : prev)}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Rikiavimo nr.</span>
                <input
                  style={styles.input}
                  type="number"
                  value={editForm.sort_order}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, sort_order: e.target.value } : prev)}
                />
              </label>
            </div>

            <div style={styles.checkboxSection}>
              <label style={styles.checkbox}><input type="checkbox" checked={editForm.oxygen} onChange={(e) => setEditForm((prev) => prev ? { ...prev, oxygen: e.target.checked } : prev)} /> Deguonis</label>
              <label style={styles.checkbox}><input type="checkbox" checked={editForm.nursing} onChange={(e) => setEditForm((prev) => prev ? { ...prev, nursing: e.target.checked } : prev)} /> Slauga</label>
              <label style={styles.checkbox}><input type="checkbox" checked={editForm.wc} onChange={(e) => setEditForm((prev) => prev ? { ...prev, wc: e.target.checked } : prev)} /> WC</label>
              <label style={styles.checkbox}><input type="checkbox" checked={editForm.shower} onChange={(e) => setEditForm((prev) => prev ? { ...prev, shower: e.target.checked } : prev)} /> Dušas</label>
              <label style={styles.checkbox}><input type="checkbox" checked={editForm.sink} onChange={(e) => setEditForm((prev) => prev ? { ...prev, sink: e.target.checked } : prev)} /> Kriauklė</label>
              <label style={styles.checkbox}><input type="checkbox" checked={editForm.functional_bed} onChange={(e) => setEditForm((prev) => prev ? { ...prev, functional_bed: e.target.checked } : prev)} /> Funkcinė lova</label>
              <label style={styles.checkbox}><input type="checkbox" checked={editForm.wheelchair_accessible} onChange={(e) => setEditForm((prev) => prev ? { ...prev, wheelchair_accessible: e.target.checked } : prev)} /> Pritaikytas neįgaliesiems</label>
              <label style={styles.checkbox}><input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm((prev) => prev ? { ...prev, is_active: e.target.checked } : prev)} /> Aktyvus</label>
            </div>

            <label style={styles.field}>
              <span style={styles.label}>Pastabos</span>
              <textarea
                style={styles.textarea}
                rows={4}
                value={editForm.notes}
                onChange={(e) => setEditForm((prev) => prev ? { ...prev, notes: e.target.value } : prev)}
              />
            </label>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.secondaryButton} onClick={closeEditModal}>
                Atšaukti
              </button>
              <button type="button" style={styles.primaryButton} onClick={saveRoomEdit} disabled={saving}>
                {saving ? "Saugoma..." : "Išsaugoti pakeitimus"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    display: "grid",
    gap: 20,
    background: "#f8fafc",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 6,
    color: "#475569",
    fontSize: 14,
  },
  headerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  panelTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
  },
  panelText: {
    marginTop: 4,
    marginBottom: 0,
    color: "#64748b",
    fontSize: 14,
  },
  bulkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 12,
  },
  bulkCountsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
    marginBottom: 12,
  },
  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 14,
  },
  field: {
    display: "grid",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    color: "#0f172a",
    background: "#fff",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    color: "#0f172a",
    background: "#fff",
    resize: "vertical",
    boxSizing: "border-box",
  },
  previewBox: {
    marginTop: 8,
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#047857",
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
  },
  warningBox: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#c2410c",
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
  },
  actionsRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  primaryButton: {
    border: "none",
    borderRadius: 12,
    padding: "10px 14px",
    background: "#047857",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 14px",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
  },
  dangerButton: {
    border: "none",
    borderRadius: 12,
    padding: "10px 14px",
    background: "#dc2626",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButtonSmall: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "8px 10px",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },
  greenSmallButton: {
    border: "none",
    borderRadius: 10,
    padding: "8px 10px",
    background: "#047857",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 13,
  },
  yellowSmallButton: {
    border: "1px solid #fde047",
    borderRadius: 10,
    padding: "8px 10px",
    background: "#fef9c3",
    color: "#854d0e",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 13,
  },
  dangerSmallButton: {
    border: "none",
    borderRadius: 10,
    padding: "8px 10px",
    background: "#fee2e2",
    color: "#b91c1c",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 13,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
  },
  statCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
    textAlign: "left",
    cursor: "pointer",
  },
  statLabel: {
    color: "#64748b",
    fontSize: 13,
    marginBottom: 8,
    fontWeight: 700,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 850,
    color: "#0f172a",
  },
  legendRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    color: "#475569",
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 14,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    border: "1px solid",
    display: "inline-block",
  },
  floorGridWrap: {
    display: "grid",
    gap: 18,
  },
  floorBlock: {
    display: "grid",
    gap: 10,
  },
  floorTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 850,
  },
  roomGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 12,
  },
  roomCard: {
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 10,
    border: "1px solid #e2e8f0",
  },
  roomFree: {
    background: "#dcfce7",
    border: "1px solid #86efac",
  },
  roomReserved: {
    background: "#fef9c3",
    border: "1px solid #fde047",
  },
  roomOccupied: {
    background: "#fee2e2",
    border: "1px solid #fca5a5",
  },
  roomPartial: {
    background: "#ffedd5",
    border: "1px solid #fdba74",
  },
  roomInactive: {
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
  },
  roomCardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  roomCardMeta: {
    color: "#475569",
    fontSize: 13,
    fontWeight: 700,
  },
  roomResidents: {
    display: "grid",
    gap: 6,
  },
  residentPill: {
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 12,
    padding: "7px 9px",
    display: "grid",
    gap: 2,
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 800,
  },
  roomActions: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
  },
  rowActions: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    minWidth: 1100,
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: 13,
    fontWeight: 800,
    background: "#f8fafc",
    position: "sticky",
    top: 0,
  },
  td: {
    padding: "12px 10px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 14,
    color: "#0f172a",
    verticalAlign: "top",
  },
  tdStrong: {
    padding: "12px 10px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 14,
    color: "#0f172a",
    verticalAlign: "top",
    fontWeight: 800,
  },
  metaText: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
  },
  link: {
    color: "#047857",
    textDecoration: "none",
    fontWeight: 800,
  },
  tagWrap: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  tag: {
    display: "inline-flex",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #a7f3d0",
    fontWeight: 750,
  },
  statusFree: {
    display: "inline-flex",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontWeight: 800,
  },
  statusReserved: {
    display: "inline-flex",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    background: "#fef9c3",
    color: "#854d0e",
    border: "1px solid #fde047",
    fontWeight: 800,
  },
  statusOccupied: {
    display: "inline-flex",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    background: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    fontWeight: 800,
  },
  statusPartial: {
    display: "inline-flex",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    background: "#ffedd5",
    color: "#c2410c",
    border: "1px solid #fdba74",
    fontWeight: 800,
  },
  statusInactive: {
    display: "inline-flex",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    background: "#e2e8f0",
    color: "#475569",
    border: "1px solid #cbd5e1",
    fontWeight: 800,
  },
  emptyCell: {
    padding: 22,
    textAlign: "center",
    color: "#64748b",
    fontSize: 14,
  },
  errorBox: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontWeight: 750,
  },
  successBox: {
    background: "#f0fdf4",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontWeight: 750,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 50,
  },
  modalCard: {
    width: "100%",
    maxWidth: 900,
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.25)",
  },
  modalCardSmall: {
    width: "100%",
    maxWidth: 540,
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.25)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1,
    cursor: "pointer",
  },
  modalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  checkboxSection: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    marginBottom: 16,
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    color: "#0f172a",
  },
  releaseList: {
    display: "grid",
    gap: 8,
    marginTop: 12,
  },
  releaseItem: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 12,
    padding: 10,
    display: "grid",
    gap: 4,
  },
  modalFooter: {
    position: "sticky",
    bottom: 0,
    background: "#ffffff",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    paddingTop: 16,
    marginTop: 16,
    borderTop: "1px solid #e2e8f0",
  },
}