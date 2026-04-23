"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type Gender = "male" | "female" | "mixed" | ""
type RoomType = "single" | "double" | "triple" | "quad" | "other"

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
}

type ResidentCountRow = {
  current_room_id: string | null
  count: number
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
  occupied: number
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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
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

export default function RoomsPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<RoomType | "all">("all")
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all")
  const [floorFilter, setFloorFilter] = useState<string>("all")

  const [bulkOpen, setBulkOpen] = useState(true)
  const [bulkForm, setBulkForm] = useState<BulkForm>(emptyBulkForm)

  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)

  useEffect(() => {
    loadOrganization()
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
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  async function loadOrganization() {
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setLoading(false)
      setError("Nepavyko nustatyti prisijungusio vartotojo.")
      return
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (membershipError || !membership?.organization_id) {
      setLoading(false)
      setError("Nepavyko nustatyti organizacijos.")
      return
    }

    setOrganizationId(membership.organization_id)
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
        created_at
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
      .select("current_room_id")
      .eq("organization_id", orgId)
      .eq("is_active", true)

    if (residentsError) {
      setLoading(false)
      setError(residentsError.message)
      return
    }

    const occupiedMap = new Map<string, number>()
    for (const row of residentsRows || []) {
      const roomId = row.current_room_id
      if (!roomId) continue
      occupiedMap.set(roomId, (occupiedMap.get(roomId) || 0) + 1)
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
      occupied: occupiedMap.get(row.id) || 0,
    }))

    setRooms(mapped)
    setLoading(false)
  }

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const search = query.trim().toLowerCase()
      const searchOk =
        !search ||
        room.name.toLowerCase().includes(search) ||
        formatType(room.room_type).toLowerCase().includes(search) ||
        formatGender(room.gender).toLowerCase().includes(search) ||
        room.notes.toLowerCase().includes(search)

      const typeOk = typeFilter === "all" || room.room_type === typeFilter

      const activeOk =
        activeFilter === "all" ||
        (activeFilter === "active" ? room.is_active : !room.is_active)

      const floorOk =
        floorFilter === "all" ||
        String(room.floor ?? "") === floorFilter

      return searchOk && typeOk && activeOk && floorOk
    })
  }, [rooms, query, typeFilter, activeFilter, floorFilter])

  const stats = useMemo(() => {
    const totalRooms = filteredRooms.length
    const totalPlaces = filteredRooms.reduce((sum, room) => sum + room.capacity, 0)
    const occupiedPlaces = filteredRooms.reduce((sum, room) => sum + room.occupied, 0)
    const freePlaces = totalPlaces - occupiedPlaces

    const byType = filteredRooms.reduce(
      (acc, room) => {
        acc[room.room_type] += 1
        return acc
      },
      { single: 0, double: 0, triple: 0, quad: 0, other: 0 }
    )

    return { totalRooms, totalPlaces, occupiedPlaces, freePlaces, byType }
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

      const { error: insertError } = await supabase.from("rooms").insert(rows)

      if (insertError) {
        setError(insertError.message)
        setSaving(false)
        return
      }

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

      setSuccess("Kambarys atnaujintas.")
      await loadRooms(organizationId)
      closeEditModal()
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
      ["Laisva vietų", String(stats.freePlaces)],
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
        "Laisva",
        "Aukštas",
        "Lytis",
        "Aktyvus",
        "Įranga",
        "Pastabos",
      ],
      ...filteredRooms.map((room) => [
        room.name,
        formatType(room.room_type),
        String(room.capacity),
        String(room.occupied),
        String(Math.max(room.capacity - room.occupied, 0)),
        room.floor == null ? "" : String(room.floor),
        formatGender(room.gender),
        room.is_active ? "Taip" : "Ne",
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
      ]),
    ]

    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`kambariu-statistika-${date}.csv`, rows)
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Kraunama...</div>
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Kambariai</h1>
          <p style={styles.subtitle}>
            Masinis kūrimas, statistika, užimtumas ir redagavimas vienoje vietoje.
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
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Kambarių</div>
          <div style={styles.statValue}>{stats.totalRooms}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Vietų</div>
          <div style={styles.statValue}>{stats.totalPlaces}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Užimta</div>
          <div style={styles.statValue}>{stats.occupiedPlaces}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Laisva</div>
          <div style={styles.statValue}>{stats.freePlaces}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Vienviečių</div>
          <div style={styles.statValue}>{stats.byType.single}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Dviviečių</div>
          <div style={styles.statValue}>{stats.byType.double}</div>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.filtersGrid}>
          <label style={styles.field}>
            <span style={styles.label}>Paieška</span>
            <input
              style={styles.input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kambario nr., tipas, lytis..."
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

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Kambarys</th>
                <th style={styles.th}>Tipas</th>
                <th style={styles.th}>Vietos</th>
                <th style={styles.th}>Užimtumas</th>
                <th style={styles.th}>Aukštas</th>
                <th style={styles.th}>Lytis</th>
                <th style={styles.th}>Įranga</th>
                <th style={styles.th}>Būsena</th>
                <th style={styles.th}>Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.map((room) => {
                const free = Math.max(room.capacity - room.occupied, 0)
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
                      {room.occupied} / {room.capacity}
                      <div style={styles.metaText}>Laisva: {free}</div>
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
                      <span style={room.is_active ? styles.statusActive : styles.statusInactive}>
                        {room.is_active ? "Aktyvus" : "Neaktyvus"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button type="button" style={styles.secondaryButtonSmall} onClick={() => openEditModal(room)}>
                        Redaguoti
                      </button>
                    </td>
                  </tr>
                )
              })}

              {filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={9} style={styles.emptyCell}>
                    Kambarių pagal pasirinktus filtrus nerasta.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

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
    fontWeight: 700,
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
    fontWeight: 700,
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
    fontWeight: 600,
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
  },
  previewBox: {
    marginTop: 8,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
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
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 14px",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButtonSmall: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "8px 10px",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 600,
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
  },
  statLabel: {
    color: "#64748b",
    fontSize: 13,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 700,
    color: "#0f172a",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    minWidth: 980,
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: 13,
    fontWeight: 700,
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
    fontWeight: 700,
  },
  metaText: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
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
    background: "#eef2ff",
    color: "#3730a3",
    border: "1px solid #c7d2fe",
  },
  statusActive: {
    display: "inline-flex",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
  },
  statusInactive: {
    display: "inline-flex",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    background: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
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
  },
  successBox: {
    background: "#f0fdf4",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
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
    fontWeight: 700,
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
