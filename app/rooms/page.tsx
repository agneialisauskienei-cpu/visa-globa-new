'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

type Room = {
  id: string
  organization_id: string
  name: string
  room_type: 'vienvietis' | 'dvivietis' | 'trivietis' | 'keturvietis' | 'kita' | null
  capacity: number
  area_m2: number | null
  floor: string | null
  display_order: number | null
  gender: 'male' | 'female' | 'mix' | null
  has_oxygen: boolean | null
  has_nursing: boolean | null
  has_private_wc: boolean | null
  has_shower: boolean | null
  has_sink: boolean | null
  has_functional_bed: boolean | null
  is_accessible: boolean | null
  is_active: boolean | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

type ResidentStay = {
  id: string
  room_id: string | null
  status: string | null
  end_date: string | null
}

type RoomWithStats = Room & {
  occupied_count: number
  free_places: number
}

type NewRoomForm = {
  name: string
  room_type: 'vienvietis' | 'dvivietis' | 'trivietis' | 'keturvietis' | 'kita'
  capacity: string
  area_m2: string
  floor: string
  display_order: string
  gender: 'male' | 'female' | 'mix'
  has_oxygen: boolean
  has_nursing: boolean
  has_private_wc: boolean
  has_shower: boolean
  has_sink: boolean
  has_functional_bed: boolean
  is_accessible: boolean
  is_active: boolean
  notes: string
}

const ACTIVE_OCCUPANCY_STATUSES = [
  'rezervuotas',
  'gyvena',
  'ligonineje',
  'laikinai_isvykes',
]

const ROOM_TYPE_OPTIONS = [
  { value: 'kita', label: 'Kita' },
  { value: 'vienvietis', label: 'Vienvietis' },
  { value: 'dvivietis', label: 'Dvivietis' },
  { value: 'trivietis', label: 'Trivietis' },
  { value: 'keturvietis', label: 'Keturvietis' },
] as const

const GENDER_OPTIONS = [
  { value: 'mix', label: 'Mišrus' },
  { value: 'male', label: 'Vyrų' },
  { value: 'female', label: 'Moterų' },
] as const

const SORT_OPTIONS = [
  { value: 'display_order_asc', label: 'Pagal eilę' },
  { value: 'name_asc', label: 'Pavadinimas A–Ž' },
  { value: 'name_desc', label: 'Pavadinimas Ž–A' },
  { value: 'capacity_desc', label: 'Daugiausia vietų' },
  { value: 'capacity_asc', label: 'Mažiausiai vietų' },
  { value: 'occupancy_desc', label: 'Didžiausias užimtumas' },
  { value: 'occupancy_asc', label: 'Mažiausias užimtumas' },
  { value: 'area_desc', label: 'Didžiausia kvadratūra' },
  { value: 'area_asc', label: 'Mažiausia kvadratūra' },
] as const

const initialForm: NewRoomForm = {
  name: '',
  room_type: 'kita',
  capacity: '1',
  area_m2: '',
  floor: '',
  display_order: '',
  gender: 'mix',
  has_oxygen: false,
  has_nursing: false,
  has_private_wc: false,
  has_shower: false,
  has_sink: false,
  has_functional_bed: false,
  is_accessible: false,
  is_active: true,
  notes: '',
}

export default function RoomsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const [rooms, setRooms] = useState<Room[]>([])
  const [stays, setStays] = useState<ResidentStay[]>([])

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [form, setForm] = useState<NewRoomForm>(initialForm)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [oxygenFilter, setOxygenFilter] = useState('')
  const [nursingFilter, setNursingFilter] = useState('')
  const [freePlacesFilter, setFreePlacesFilter] = useState('')
  const [sortBy, setSortBy] = useState('display_order_asc')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setMessage('')

    try {
      const orgId = await getCurrentOrganizationId()

      if (!orgId) {
        setOrganizationId(null)
        setRooms([])
        setStays([])
        setMessage('Nepavyko nustatyti įstaigos.')
        return
      }

      setOrganizationId(orgId)

      const [roomsResult, staysResult] = await Promise.all([
        supabase.from('rooms').select('*').eq('organization_id', orgId),
        supabase
          .from('resident_stays')
          .select('id, room_id, status, end_date')
          .eq('organization_id', orgId),
      ])

      if (roomsResult.error) throw roomsResult.error
      if (staysResult.error) throw staysResult.error

      setRooms((roomsResult.data || []) as Room[])
      setStays((staysResult.data || []) as ResidentStay[])
    } catch (error: any) {
      setRooms([])
      setStays([])
      setMessage(error?.message || 'Nepavyko įkelti kambarių.')
    } finally {
      setLoading(false)
    }
  }

  const roomsWithStats = useMemo<RoomWithStats[]>(() => {
    return rooms.map((room) => {
      const occupiedCount = stays.filter((stay) => {
        return (
          stay.room_id === room.id &&
          stay.end_date === null &&
          ACTIVE_OCCUPANCY_STATUSES.includes(stay.status || '')
        )
      }).length

      return {
        ...room,
        occupied_count: occupiedCount,
        free_places: Math.max((room.capacity || 0) - occupiedCount, 0),
      }
    })
  }, [rooms, stays])

  const filteredRooms = useMemo(() => {
    const result = [...roomsWithStats]

    const filtered = result.filter((room) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchesSearch =
          room.name.toLowerCase().includes(q) ||
          (room.floor || '').toLowerCase().includes(q) ||
          (room.notes || '').toLowerCase().includes(q)

        if (!matchesSearch) return false
      }

      if (typeFilter && room.room_type !== typeFilter) return false
      if (genderFilter && (room.gender || 'mix') !== genderFilter) return false
      if (activeFilter === 'aktyvus' && room.is_active !== true) return false
      if (activeFilter === 'neaktyvus' && room.is_active !== false) return false
      if (oxygenFilter === 'taip' && room.has_oxygen !== true) return false
      if (oxygenFilter === 'ne' && room.has_oxygen === true) return false
      if (nursingFilter === 'taip' && room.has_nursing !== true) return false
      if (nursingFilter === 'ne' && room.has_nursing === true) return false
      if (freePlacesFilter === 'yra' && room.free_places <= 0) return false
      if (freePlacesFilter === 'nera' && room.free_places > 0) return false

      return true
    })

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name, 'lt')
        case 'name_desc':
          return b.name.localeCompare(a.name, 'lt')
        case 'capacity_desc':
          return (b.capacity || 0) - (a.capacity || 0)
        case 'capacity_asc':
          return (a.capacity || 0) - (b.capacity || 0)
        case 'occupancy_desc':
          return b.occupied_count - a.occupied_count
        case 'occupancy_asc':
          return a.occupied_count - b.occupied_count
        case 'area_desc':
          return (Number(b.area_m2) || 0) - (Number(a.area_m2) || 0)
        case 'area_asc':
          return (Number(a.area_m2) || 0) - (Number(b.area_m2) || 0)
        case 'display_order_asc':
        default: {
          const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER
          const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER
          if (orderA !== orderB) return orderA - orderB
          return a.name.localeCompare(b.name, 'lt')
        }
      }
    })

    return filtered
  }, [
    roomsWithStats,
    search,
    typeFilter,
    genderFilter,
    activeFilter,
    oxygenFilter,
    nursingFilter,
    freePlacesFilter,
    sortBy,
  ])

  const stats = useMemo(() => {
    const activeRooms = roomsWithStats.filter((room) => room.is_active).length
    const inactiveRooms = roomsWithStats.filter((room) => !room.is_active).length
    const totalCapacity = roomsWithStats.reduce((sum, room) => sum + (room.capacity || 0), 0)
    const totalOccupied = roomsWithStats.reduce((sum, room) => sum + room.occupied_count, 0)

    return {
      totalRooms: roomsWithStats.length,
      activeRooms,
      inactiveRooms,
      totalCapacity,
      totalOccupied,
      totalFree: Math.max(totalCapacity - totalOccupied, 0),
    }
  }, [roomsWithStats])

  function updateForm<K extends keyof NewRoomForm>(key: K, value: NewRoomForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault()

    if (!organizationId) {
      setMessage('Nepavyko nustatyti įstaigos.')
      return
    }

    if (!form.name.trim()) {
      setMessage('Įvesk kambario pavadinimą.')
      return
    }

    const capacity = Number(form.capacity)
    if (!capacity || capacity < 1) {
      setMessage('Vietų skaičius turi būti bent 1.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const payload = {
        organization_id: organizationId,
        name: form.name.trim(),
        room_type: form.room_type || 'kita',
        capacity,
        area_m2: form.area_m2 ? Number(form.area_m2) : null,
        floor: form.floor.trim() || null,
        display_order: form.display_order ? Number(form.display_order) : null,
        gender: form.gender || 'mix',
        has_oxygen: form.has_oxygen,
        has_nursing: form.has_nursing,
        has_private_wc: form.has_private_wc,
        has_shower: form.has_shower,
        has_sink: form.has_sink,
        has_functional_bed: form.has_functional_bed,
        is_accessible: form.is_accessible,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
      }

      const { error } = await supabase.from('rooms').insert(payload)
      if (error) throw error

      setForm(initialForm)
      setShowCreateForm(false)
      setMessage('Kambarys sėkmingai sukurtas.')
      await loadData()
    } catch (error: any) {
      setMessage(error?.message || 'Nepavyko sukurti kambario.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleRoomActive(room: Room) {
    try {
      setMessage('')
      const { error } = await supabase
        .from('rooms')
        .update({ is_active: !room.is_active })
        .eq('id', room.id)

      if (error) throw error
      await loadData()
    } catch (error: any) {
      setMessage(error?.message || 'Nepavyko pakeisti kambario būsenos.')
    }
  }

  function formatType(value: Room['room_type']) {
    const found = ROOM_TYPE_OPTIONS.find((option) => option.value === value)
    return found?.label || 'Kita'
  }

  function formatGender(value: Room['gender']) {
    if (value === 'male') return 'Vyrų'
    if (value === 'female') return 'Moterų'
    return 'Mišrus'
  }

  function genderBadgeStyle(value: Room['gender']): React.CSSProperties {
    if (value === 'male') {
      return {
        background: '#dbeafe',
        color: '#1d4ed8',
        border: '1px solid #bfdbfe',
      }
    }

    if (value === 'female') {
      return {
        background: '#fce7f3',
        color: '#be185d',
        border: '1px solid #fbcfe8',
      }
    }

    return {
      background: '#f3f4f6',
      color: '#374151',
      border: '1px solid #e5e7eb',
    }
  }

  function boolIcon(value: boolean | null | undefined) {
    return value ? 'Taip' : '—'
  }

  return (
    <div style={styles.outer}>
      <div style={styles.page}>
        <div style={styles.topBar}>
          <Link href="/dashboard" style={styles.backLink}>
            ← Grįžti į dashboard
          </Link>
        </div>

        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Kambariai</h1>
            <p style={styles.subtitle}>
              Kompaktiškas kambarių sąrašas su greitu perėjimu į priskirtus gyventojus.
            </p>
          </div>

          <button
            onClick={() => setShowCreateForm((prev) => !prev)}
            style={styles.primaryButton}
          >
            {showCreateForm ? 'Uždaryti formą' : 'Pridėti kambarį'}
          </button>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        <div style={styles.statsRow}>
          <StatCard label="Visi kambariai" value={String(stats.totalRooms)} />
          <StatCard label="Aktyvūs" value={String(stats.activeRooms)} />
          <StatCard label="Neaktyvūs" value={String(stats.inactiveRooms)} />
          <StatCard label="Visos vietos" value={String(stats.totalCapacity)} />
          <StatCard label="Užimtos" value={String(stats.totalOccupied)} />
          <StatCard label="Laisvos" value={String(stats.totalFree)} />
        </div>

        {showCreateForm ? (
          <form onSubmit={handleCreateRoom} style={styles.createCard}>
            <div style={styles.cardHeader}>
              <h2 style={styles.sectionTitle}>Naujas kambarys</h2>
            </div>

            <div style={styles.formGrid}>
              <Field label="Kambario pavadinimas *">
                <input
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="Pvz. 101"
                  style={styles.input}
                />
              </Field>

              <Field label="Kambario tipas">
                <select
                  value={form.room_type}
                  onChange={(e) => updateForm('room_type', e.target.value as NewRoomForm['room_type'])}
                  style={styles.input}
                >
                  {ROOM_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Vietų skaičius *">
                <input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => updateForm('capacity', e.target.value)}
                  style={styles.input}
                />
              </Field>

              <Field label="Aukštas">
                <input
                  value={form.floor}
                  onChange={(e) => updateForm('floor', e.target.value)}
                  placeholder="Pvz. 2 aukštas"
                  style={styles.input}
                />
              </Field>

              <Field label="Lytis">
                <select
                  value={form.gender}
                  onChange={(e) => updateForm('gender', e.target.value as NewRoomForm['gender'])}
                  style={styles.input}
                >
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Kvadratūra">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.area_m2}
                  onChange={(e) => updateForm('area_m2', e.target.value)}
                  placeholder="Pvz. 18.50"
                  style={styles.input}
                />
              </Field>

              <Field label="Rikiavimo numeris">
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => updateForm('display_order', e.target.value)}
                  placeholder="Pvz. 10"
                  style={styles.input}
                />
              </Field>
            </div>

            <div style={styles.checkboxGrid}>
              <Checkbox label="Deguonies aparatas" checked={form.has_oxygen} onChange={(checked) => updateForm('has_oxygen', checked)} />
              <Checkbox label="Pritaikyta slaugai" checked={form.has_nursing} onChange={(checked) => updateForm('has_nursing', checked)} />
              <Checkbox label="Atskiras WC" checked={form.has_private_wc} onChange={(checked) => updateForm('has_private_wc', checked)} />
              <Checkbox label="Dušas" checked={form.has_shower} onChange={(checked) => updateForm('has_shower', checked)} />
              <Checkbox label="Kriauklė" checked={form.has_sink} onChange={(checked) => updateForm('has_sink', checked)} />
              <Checkbox label="Funkcinė lova" checked={form.has_functional_bed} onChange={(checked) => updateForm('has_functional_bed', checked)} />
              <Checkbox label="Neįgaliesiems" checked={form.is_accessible} onChange={(checked) => updateForm('is_accessible', checked)} />
              <Checkbox label="Aktyvus" checked={form.is_active} onChange={(checked) => updateForm('is_active', checked)} />
            </div>

            <Field label="Pastabos">
              <textarea
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                rows={3}
                style={{ ...styles.input, resize: 'vertical' }}
              />
            </Field>

            <div style={styles.formActions}>
              <button type="submit" disabled={saving} style={styles.primaryButton}>
                {saving ? 'Saugoma...' : 'Išsaugoti'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setForm(initialForm)
                  setShowCreateForm(false)
                }}
                style={styles.secondaryButton}
              >
                Atšaukti
              </button>
            </div>
          </form>
        ) : null}

        <div style={styles.filtersCard}>
          <h2 style={styles.sectionTitle}>Filtrai ir rūšiavimas</h2>

          <div style={styles.filtersGrid}>
            <Field label="Paieška">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pavadinimas, aukštas, pastabos"
                style={styles.input}
              />
            </Field>

            <Field label="Kambario tipas">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={styles.input}>
                <option value="">Visi</option>
                {ROOM_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Lytis">
              <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} style={styles.input}>
                <option value="">Visos</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Aktyvumas">
              <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} style={styles.input}>
                <option value="">Visi</option>
                <option value="aktyvus">Aktyvūs</option>
                <option value="neaktyvus">Neaktyvūs</option>
              </select>
            </Field>

            <Field label="Deguonies aparatas">
              <select value={oxygenFilter} onChange={(e) => setOxygenFilter(e.target.value)} style={styles.input}>
                <option value="">Visi</option>
                <option value="taip">Taip</option>
                <option value="ne">Ne</option>
              </select>
            </Field>

            <Field label="Slauga">
              <select value={nursingFilter} onChange={(e) => setNursingFilter(e.target.value)} style={styles.input}>
                <option value="">Visi</option>
                <option value="taip">Taip</option>
                <option value="ne">Ne</option>
              </select>
            </Field>

            <Field label="Laisvos vietos">
              <select value={freePlacesFilter} onChange={(e) => setFreePlacesFilter(e.target.value)} style={styles.input}>
                <option value="">Visi</option>
                <option value="yra">Yra laisvų</option>
                <option value="nera">Nėra laisvų</option>
              </select>
            </Field>

            <Field label="Rūšiavimas">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={styles.input}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div style={styles.tableCard}>
          <div style={styles.cardHeader}>
            <h2 style={styles.sectionTitle}>Kambarių lentelė</h2>
            <button onClick={loadData} style={styles.secondaryButton}>
              Atnaujinti
            </button>
          </div>

          {loading ? (
            <div style={styles.emptyState}>Kraunami kambariai...</div>
          ) : filteredRooms.length === 0 ? (
            <div style={styles.emptyState}>Kambarių nerasta.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Kambarys</th>
                    <th style={styles.th}>Tipas</th>
                    <th style={styles.th}>Aukštas</th>
                    <th style={styles.th}>Lytis</th>
                    <th style={styles.th}>Užimtumas</th>
                    <th style={styles.th}>Laisvos vietos</th>
                    <th style={styles.th}>Deguonis</th>
                    <th style={styles.th}>Slauga</th>
                    <th style={styles.th}>Būsena</th>
                    <th style={styles.th}>Veiksmai</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRooms.map((room) => (
                    <tr key={room.id} style={styles.tr}>
                      <td style={styles.tdBold}>{room.name}</td>
                      <td style={styles.td}>{formatType(room.room_type)}</td>
                      <td style={styles.td}>{room.floor || '—'}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.genderBadge, ...genderBadgeStyle(room.gender) }}>
                          {formatGender(room.gender)}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <Link
                          href={`/residents?room_id=${room.id}`}
                          style={styles.inlineLink}
                        >
                          {room.occupied_count}/{room.capacity}
                        </Link>
                      </td>
                      <td style={styles.td}>
                        <Link
                          href={`/residents?room_id=${room.id}&filter=free`}
                          style={styles.inlineLinkStrong}
                        >
                          {room.free_places}
                        </Link>
                      </td>
                      <td style={styles.td}>{boolIcon(room.has_oxygen)}</td>
                      <td style={styles.td}>{boolIcon(room.has_nursing)}</td>
                      <td style={styles.td}>
                        <span style={room.is_active ? styles.statusActive : styles.statusInactive}>
                          {room.is_active ? 'Aktyvus' : 'Neaktyvus'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionsCell}>
                          <Link href={`/residents?room_id=${room.id}`} style={styles.smallLinkButton}>
                            Gyventojai
                          </Link>
                          <button onClick={() => toggleRoomActive(room)} style={styles.smallButton}>
                            {room.is_active ? 'Išjungti' : 'Įjungti'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  )
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label style={styles.checkboxLabel}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  outer: {
    width: '100%',
    padding: '20px 24px 40px',
  },
  page: {
    width: '100%',
    maxWidth: 1700,
    margin: '0 auto',
    display: 'grid',
    gap: 18,
  },
  topBar: {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  backLink: {
    textDecoration: 'none',
    color: '#111827',
    fontSize: 14,
    fontWeight: 700,
    padding: '8px 12px',
    borderRadius: 10,
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: 40,
    fontWeight: 800,
    lineHeight: 1.1,
  },
  subtitle: {
    margin: '10px 0 0',
    color: '#6b7280',
    fontSize: 17,
  },
  message: {
    padding: '12px 14px',
    borderRadius: 14,
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    color: '#111827',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
    gap: 12,
  },
  statCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 18,
    padding: 16,
    minHeight: 110,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 800,
    marginBottom: 8,
    lineHeight: 1,
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: 600,
  },
  createCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 22,
    padding: 20,
    display: 'grid',
    gap: 16,
  },
  filtersCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 22,
    padding: 20,
    display: 'grid',
    gap: 16,
  },
  tableCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 22,
    padding: 20,
    display: 'grid',
    gap: 16,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: 14,
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
    gap: 14,
  },
  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
  },
  field: {
    display: 'grid',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 700,
    color: '#111827',
  },
  input: {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: 12,
    padding: '11px 12px',
    fontSize: 14,
    outline: 'none',
    background: '#fff',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    color: '#111827',
  },
  formActions: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  primaryButton: {
    border: 'none',
    borderRadius: 12,
    padding: '12px 18px',
    background: '#0f172a',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid #d1d5db',
    borderRadius: 12,
    padding: '12px 16px',
    background: '#fff',
    color: '#111827',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  smallButton: {
    border: '1px solid #d1d5db',
    borderRadius: 10,
    padding: '8px 10px',
    background: '#fff',
    color: '#111827',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  smallLinkButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    padding: '8px 10px',
    background: '#f8fafc',
    color: '#111827',
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  emptyState: {
    padding: 24,
    textAlign: 'center',
    color: '#6b7280',
    border: '1px dashed #d1d5db',
    borderRadius: 16,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 1200,
  },
  th: {
    textAlign: 'left',
    padding: '12px 10px',
    borderBottom: '1px solid #e5e7eb',
    color: '#6b7280',
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '14px 10px',
    color: '#374151',
    fontSize: 14,
    fontWeight: 500,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  },
  tdBold: {
    padding: '14px 10px',
    color: '#111827',
    fontSize: 14,
    fontWeight: 800,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  },
  inlineLink: {
    textDecoration: 'none',
    color: '#2563eb',
    fontWeight: 700,
  },
  inlineLinkStrong: {
    textDecoration: 'none',
    color: '#0f172a',
    fontWeight: 800,
  },
  actionsCell: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  genderBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },
  statusActive: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: '#dcfce7',
    color: '#166534',
    border: '1px solid #bbf7d0',
  },
  statusInactive: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #e5e7eb',
  },
}