'use client'

import Link from 'next/link'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

type Room = {
  id: string
  name: string
  capacity: number
  floor: string | null
  room_type: string | null
  gender: 'male' | 'female' | 'mix' | null
  is_active: boolean | null
}

type Resident = {
  id: string
  organization_id: string
  resident_code: string
  first_name_encrypted: string | null
  last_name_encrypted: string | null
  phone_encrypted: string | null
  notes_encrypted: string | null
  contact_person_encrypted: string | null
  contact_person_phone_encrypted: string | null
  birth_date: string | null
  care_level: string | null
  current_status: string | null
  current_room_id: string | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

type ResidentStay = {
  id: string
  resident_id: string
  room_id: string | null
  status: string | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string | null
}

type NewResidentForm = {
  resident_code: string
  current_status:
    | 'rezervuotas'
    | 'gyvena'
    | 'ligonineje'
    | 'laikinai_isvykes'
    | 'isvykes'
    | 'neaktyvus'
  room_id: string
  start_date: string
  notes: string
  care_level: '' | 'savarankiskas' | 'daline_slauga' | 'slauga' | 'intensyvi_slauga'
}

type EditStateForm = {
  resident_id: string
  new_status:
    | 'rezervuotas'
    | 'gyvena'
    | 'ligonineje'
    | 'laikinai_isvykes'
    | 'isvykes'
    | 'neaktyvus'
  new_room_id: string
  start_date: string
  notes: string
}

const STATUS_OPTIONS = [
  { value: 'rezervuotas', label: 'Netrukus atvyks' },
  { value: 'gyvena', label: 'Gyvena' },
  { value: 'ligonineje', label: 'Ligoninėje' },
  { value: 'laikinai_isvykes', label: 'Laikinai išvykęs' },
  { value: 'isvykes', label: 'Išvykęs' },
  { value: 'neaktyvus', label: 'Neaktyvus' },
] as const

const CARE_LEVEL_OPTIONS = [
  { value: '', label: 'Nenurodyta' },
  { value: 'savarankiskas', label: 'Savarankiškas' },
  { value: 'daline_slauga', label: 'Dalinė slauga' },
  { value: 'slauga', label: 'Slauga' },
  { value: 'intensyvi_slauga', label: 'Intensyvi slauga' },
] as const

const initialForm: NewResidentForm = {
  resident_code: '',
  current_status: 'gyvena',
  room_id: '',
  start_date: new Date().toISOString().slice(0, 10),
  notes: '',
  care_level: '',
}

export default function ResidentsPage() {
  const searchParams = useSearchParams()

  const roomIdFromQuery = searchParams.get('room_id') || ''
  const specialFilter = searchParams.get('filter') || ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const [rooms, setRooms] = useState<Room[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [stays, setStays] = useState<ResidentStay[]>([])

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [form, setForm] = useState<NewResidentForm>(initialForm)

  const [editingResidentId, setEditingResidentId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditStateForm | null>(null)
  const [rowSavingId, setRowSavingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roomFilter, setRoomFilter] = useState(roomIdFromQuery)
  const [careLevelFilter, setCareLevelFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_desc')

  useEffect(() => {
    setRoomFilter(roomIdFromQuery)
  }, [roomIdFromQuery])

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
        setResidents([])
        setStays([])
        setMessage('Nepavyko nustatyti įstaigos.')
        return
      }

      setOrganizationId(orgId)

      const [roomsResult, residentsResult, staysResult] = await Promise.all([
        supabase
          .from('rooms')
          .select('id, name, capacity, floor, room_type, gender, is_active')
          .eq('organization_id', orgId)
          .order('name'),
        supabase.from('residents').select('*').eq('organization_id', orgId),
        supabase.from('resident_stays').select('*').eq('organization_id', orgId),
      ])

      if (roomsResult.error) throw roomsResult.error
      if (residentsResult.error) throw residentsResult.error
      if (staysResult.error) throw staysResult.error

      setRooms((roomsResult.data || []) as Room[])
      setResidents((residentsResult.data || []) as Resident[])
      setStays((staysResult.data || []) as ResidentStay[])
    } catch (error: any) {
      setRooms([])
      setResidents([])
      setStays([])
      setMessage(error?.message || 'Nepavyko įkelti gyventojų.')
    } finally {
      setLoading(false)
    }
  }

  const selectedRoom = useMemo(() => {
    return rooms.find((room) => room.id === roomFilter) || null
  }, [rooms, roomFilter])

  const selectedRoomStats = useMemo(() => {
    if (!selectedRoom) return null

    const occupied = residents.filter((resident) => {
      return (
        resident.current_room_id === selectedRoom.id &&
        ['rezervuotas', 'gyvena', 'ligonineje', 'laikinai_isvykes'].includes(
          resident.current_status || ''
        )
      )
    }).length

    return {
      occupied,
      free: Math.max((selectedRoom.capacity || 0) - occupied, 0),
      capacity: selectedRoom.capacity || 0,
    }
  }, [selectedRoom, residents])

  const filteredResidents = useMemo(() => {
    let result = [...residents]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((resident) => {
        return (
          (resident.resident_code || '').toLowerCase().includes(q) ||
          (resident.current_status || '').toLowerCase().includes(q)
        )
      })
    }

    if (statusFilter) {
      result = result.filter((resident) => resident.current_status === statusFilter)
    }

    if (roomFilter) {
      result = result.filter((resident) => resident.current_room_id === roomFilter)
    }

    if (careLevelFilter) {
      result = result.filter((resident) => resident.care_level === careLevelFilter)
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'code_asc':
          return (a.resident_code || '').localeCompare(b.resident_code || '', 'lt')
        case 'code_desc':
          return (b.resident_code || '').localeCompare(a.resident_code || '', 'lt')
        case 'status_asc':
          return (a.current_status || '').localeCompare(b.current_status || '', 'lt')
        case 'status_desc':
          return (b.current_status || '').localeCompare(a.current_status || '', 'lt')
        case 'created_asc':
          return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
        case 'created_desc':
        default:
          return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
      }
    })

    return result
  }, [residents, search, statusFilter, roomFilter, careLevelFilter, sortBy])

  const stats = useMemo(() => {
    const active = residents.filter((resident) => resident.current_status === 'gyvena').length
    const arrivingSoon = residents.filter((resident) => resident.current_status === 'rezervuotas').length
    const hospital = residents.filter((resident) => resident.current_status === 'ligonineje').length
    const away = residents.filter((resident) => resident.current_status === 'laikinai_isvykes').length

    return {
      total: residents.length,
      active,
      arrivingSoon,
      hospital,
      away,
    }
  }, [residents])

  function updateForm<K extends keyof NewResidentForm>(key: K, value: NewResidentForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function getOpenStay(residentId: string) {
    return stays.find((stay) => stay.resident_id === residentId && stay.end_date === null) || null
  }

  function startEdit(resident: Resident) {
    setEditingResidentId(resident.id)
    setEditForm({
      resident_id: resident.id,
      new_status:
        (resident.current_status as EditStateForm['new_status']) || 'gyvena',
      new_room_id: resident.current_room_id || '',
      start_date: new Date().toISOString().slice(0, 10),
      notes: '',
    })
  }

  function cancelEdit() {
    setEditingResidentId(null)
    setEditForm(null)
  }

  function clearAllFilters() {
    setSearch('')
    setStatusFilter('')
    setRoomFilter(roomIdFromQuery || '')
    setCareLevelFilter('')
    setSortBy('created_desc')
  }

  async function handleCreateResident(e: React.FormEvent) {
    e.preventDefault()

    if (!organizationId) {
      setMessage('Nepavyko nustatyti įstaigos.')
      return
    }

    if (!form.start_date) {
      setMessage('Pasirink pradžios datą.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const residentPayload = {
        organization_id: organizationId,
        resident_code: form.resident_code.trim() || null,
        care_level: form.care_level || null,
        current_status: form.current_status,
        current_room_id: form.room_id || null,
        is_active: form.current_status !== 'neaktyvus',
      }

      const { data: residentInsert, error: residentError } = await supabase
        .from('residents')
        .insert(residentPayload)
        .select('id')
        .single()

      if (residentError) throw residentError
      if (!residentInsert?.id) throw new Error('Nepavyko sukurti gyventojo.')

      const stayPayload = {
        organization_id: organizationId,
        resident_id: residentInsert.id,
        room_id: form.room_id || null,
        status: form.current_status,
        start_date: form.start_date,
        end_date: null,
        notes: form.notes.trim() || null,
      }

      const { error: stayError } = await supabase.from('resident_stays').insert(stayPayload)
      if (stayError) throw stayError

      setForm({
        ...initialForm,
        room_id: roomFilter || '',
      })
      setShowCreateForm(false)
      setMessage('Gyventojas sėkmingai sukurtas.')
      await loadData()
    } catch (error: any) {
      setMessage(error?.message || 'Nepavyko sukurti gyventojo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateResidentState() {
    if (!organizationId || !editForm) return

    if (!editForm.start_date) {
      setMessage('Pasirink pokyčio pradžios datą.')
      return
    }

    setRowSavingId(editForm.resident_id)
    setMessage('')

    try {
      const resident = residents.find((item) => item.id === editForm.resident_id)
      if (!resident) throw new Error('Gyventojas nerastas.')

      const openStay = getOpenStay(editForm.resident_id)

      if (openStay) {
        const endDate = new Date(editForm.start_date)
        endDate.setDate(endDate.getDate() - 1)
        const closedEndDate = endDate.toISOString().slice(0, 10)

        const { error: closeError } = await supabase
          .from('resident_stays')
          .update({ end_date: closedEndDate })
          .eq('id', openStay.id)

        if (closeError) throw closeError
      }

      const { error: insertError } = await supabase.from('resident_stays').insert({
        organization_id: organizationId,
        resident_id: editForm.resident_id,
        room_id: editForm.new_room_id || null,
        status: editForm.new_status,
        start_date: editForm.start_date,
        end_date: null,
        notes: editForm.notes.trim() || null,
      })

      if (insertError) throw insertError

      const { error: residentUpdateError } = await supabase
        .from('residents')
        .update({
          current_status: editForm.new_status,
          current_room_id: editForm.new_room_id || null,
          is_active: !['isvykes', 'neaktyvus'].includes(editForm.new_status),
        })
        .eq('id', editForm.resident_id)

      if (residentUpdateError) throw residentUpdateError

      setEditingResidentId(null)
      setEditForm(null)
      setMessage(`Gyventojo ${resident.resident_code} būsena atnaujinta.`)
      await loadData()
    } catch (error: any) {
      setMessage(error?.message || 'Nepavyko atnaujinti gyventojo būsenos.')
    } finally {
      setRowSavingId(null)
    }
  }

  function getRoomName(roomId: string | null) {
    if (!roomId) return '—'
    return rooms.find((room) => room.id === roomId)?.name || '—'
  }

  function getStatusLabel(value: string | null) {
    const found = STATUS_OPTIONS.find((option) => option.value === value)
    return found?.label || '—'
  }

  function getCareLevelLabel(value: string | null) {
    const found = CARE_LEVEL_OPTIONS.find((option) => option.value === value)
    return found?.label || '—'
  }

  function statusStyle(status: string | null): React.CSSProperties {
    switch (status) {
      case 'gyvena':
        return {
          background: '#dcfce7',
          color: '#166534',
          border: '1px solid #bbf7d0',
        }
      case 'rezervuotas':
        return {
          background: '#e0f2fe',
          color: '#0369a1',
          border: '1px solid #bae6fd',
        }
      case 'ligonineje':
        return {
          background: '#fee2e2',
          color: '#b91c1c',
          border: '1px solid #fecaca',
        }
      case 'laikinai_isvykes':
        return {
          background: '#fef3c7',
          color: '#92400e',
          border: '1px solid #fde68a',
        }
      case 'isvykes':
      case 'neaktyvus':
      default:
        return {
          background: '#f3f4f6',
          color: '#374151',
          border: '1px solid #e5e7eb',
        }
    }
  }

  return (
    <div style={styles.outer}>
      <div style={styles.page}>
        <div style={styles.topBar}>
          <Link href="/dashboard" style={styles.backLink}>
            ← Grįžti į dashboard
          </Link>

          {roomFilter ? (
            <Link href="/rooms" style={styles.backLink}>
              ← Atgal į kambarius
            </Link>
          ) : null}
        </div>

        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Gyventojai</h1>
            <p style={styles.subtitle}>
              Gyventojų sąrašas su perkėlimu, būsenų keitimu ir buvimo istorija.
            </p>
          </div>

          <button
            onClick={() => {
              setForm((prev) => ({ ...prev, room_id: roomFilter || prev.room_id }))
              setShowCreateForm((prev) => !prev)
            }}
            style={styles.primaryButton}
          >
            {showCreateForm ? 'Uždaryti formą' : 'Pridėti gyventoją'}
          </button>
        </div>

        {selectedRoom && selectedRoomStats ? (
          <div style={styles.roomBanner}>
            <div>
              <div style={styles.roomBannerTitle}>
                Kambarys: <strong>{selectedRoom.name}</strong>
              </div>
              <div style={styles.roomBannerMeta}>
                Užimtumas: {selectedRoomStats.occupied}/{selectedRoomStats.capacity} • Laisvos vietos: {selectedRoomStats.free}
              </div>
            </div>

            {specialFilter === 'free' ? (
              <div style={styles.freeBadge}>Rodomas kambarys su laisvomis vietomis</div>
            ) : null}
          </div>
        ) : null}

        {message ? <div style={styles.message}>{message}</div> : null}

        <div style={styles.statsRow}>
          <StatCard
            label="Visi gyventojai"
            value={String(stats.total)}
            active={statusFilter === ''}
            onClick={() => setStatusFilter('')}
          />
          <StatCard
            label="Gyvena"
            value={String(stats.active)}
            active={statusFilter === 'gyvena'}
            onClick={() => setStatusFilter('gyvena')}
          />
          <StatCard
            label="Netrukus atvyks"
            value={String(stats.arrivingSoon)}
            active={statusFilter === 'rezervuotas'}
            onClick={() => setStatusFilter('rezervuotas')}
          />
          <StatCard
            label="Ligoninėje"
            value={String(stats.hospital)}
            active={statusFilter === 'ligonineje'}
            onClick={() => setStatusFilter('ligonineje')}
          />
          <StatCard
            label="Laikinai išvykę"
            value={String(stats.away)}
            active={statusFilter === 'laikinai_isvykes'}
            onClick={() => setStatusFilter('laikinai_isvykes')}
          />
        </div>

        {showCreateForm ? (
          <form onSubmit={handleCreateResident} style={styles.createCard}>
            <div style={styles.cardHeader}>
              <h2 style={styles.sectionTitle}>Naujas gyventojas</h2>
            </div>

            <div style={styles.formGrid}>
              <Field label="Gyventojo kodas">
                <input
                  value={form.resident_code}
                  onChange={(e) => updateForm('resident_code', e.target.value)}
                  placeholder="Palik tuščią automatiniam kodui"
                  style={styles.input}
                />
              </Field>

              <Field label="Būsena *">
                <select
                  value={form.current_status}
                  onChange={(e) =>
                    updateForm('current_status', e.target.value as NewResidentForm['current_status'])
                  }
                  style={styles.input}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Kambarys">
                <select
                  value={form.room_id}
                  onChange={(e) => updateForm('room_id', e.target.value)}
                  style={styles.input}
                >
                  <option value="">Nepasirinkta</option>
                  {rooms
                    .filter((room) => room.is_active !== false)
                    .map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                </select>
              </Field>

              <Field label="Pradžios data *">
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => updateForm('start_date', e.target.value)}
                  style={styles.input}
                />
              </Field>

              <Field label="Priežiūros lygis">
                <select
                  value={form.care_level}
                  onChange={(e) =>
                    updateForm('care_level', e.target.value as NewResidentForm['care_level'])
                  }
                  style={styles.input}
                >
                  {CARE_LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
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
          <div style={styles.cardHeader}>
            <h2 style={styles.sectionTitle}>Filtrai ir rūšiavimas</h2>

            <button onClick={clearAllFilters} style={styles.secondaryButton}>
              Valyti filtrus
            </button>
          </div>

          <div style={styles.filtersGrid}>
            <Field label="Paieška">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Gyventojo kodas arba būsena"
                style={styles.input}
              />
            </Field>

            <Field label="Būsena">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.input}>
                <option value="">Visos</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Kambarys">
              <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} style={styles.input}>
                <option value="">Visi</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Priežiūros lygis">
              <select
                value={careLevelFilter}
                onChange={(e) => setCareLevelFilter(e.target.value)}
                style={styles.input}
              >
                {CARE_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Rūšiavimas">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={styles.input}>
                <option value="created_desc">Naujausi viršuje</option>
                <option value="created_asc">Seniausi viršuje</option>
                <option value="code_asc">Kodas A–Ž</option>
                <option value="code_desc">Kodas Ž–A</option>
                <option value="status_asc">Būsena A–Ž</option>
                <option value="status_desc">Būsena Ž–A</option>
              </select>
            </Field>
          </div>
        </div>

        <div style={styles.tableCard}>
          <div style={styles.cardHeader}>
            <h2 style={styles.sectionTitle}>Gyventojų lentelė</h2>
            <button onClick={loadData} style={styles.secondaryButton}>
              Atnaujinti
            </button>
          </div>

          {loading ? (
            <div style={styles.emptyState}>Kraunami gyventojai...</div>
          ) : filteredResidents.length === 0 ? (
            <div style={styles.emptyState}>Gyventojų nerasta.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Kodas</th>
                    <th style={styles.th}>Būsena</th>
                    <th style={styles.th}>Kambarys</th>
                    <th style={styles.th}>Priežiūros lygis</th>
                    <th style={styles.th}>Sukurta</th>
                    <th style={styles.th}>Veiksmai</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredResidents.map((resident) => (
                    <Fragment key={resident.id}>
                      <tr style={styles.tr}>
                        <td style={styles.tdBold}>{resident.resident_code || '—'}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.statusBadge, ...statusStyle(resident.current_status) }}>
                            {getStatusLabel(resident.current_status)}
                          </span>
                        </td>
                        <td style={styles.td}>{getRoomName(resident.current_room_id)}</td>
                        <td style={styles.td}>{getCareLevelLabel(resident.care_level)}</td>
                        <td style={styles.td}>
                          {resident.created_at
                            ? new Date(resident.created_at).toLocaleDateString('lt-LT')
                            : '—'}
                        </td>
                        <td style={styles.td}>
                          <div style={styles.actionsCell}>
                            <button
                              onClick={() => startEdit(resident)}
                              style={styles.smallButton}
                            >
                              Perkelti / keisti būseną
                            </button>
                          </div>
                        </td>
                      </tr>

                      {editingResidentId === resident.id && editForm ? (
                        <tr style={styles.editRow}>
                          <td colSpan={6} style={styles.editCell}>
                            <div style={styles.editBox}>
                              <div style={styles.editTitle}>
                                Redaguojamas gyventojas: <strong>{resident.resident_code}</strong>
                              </div>

                              <div style={styles.editGrid}>
                                <Field label="Nauja būsena">
                                  <select
                                    value={editForm.new_status}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        new_status: e.target.value as EditStateForm['new_status'],
                                      })
                                    }
                                    style={styles.input}
                                  >
                                    {STATUS_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </Field>

                                <Field label="Naujas kambarys">
                                  <select
                                    value={editForm.new_room_id}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        new_room_id: e.target.value,
                                      })
                                    }
                                    style={styles.input}
                                  >
                                    <option value="">Be kambario</option>
                                    {rooms
                                      .filter((room) => room.is_active !== false)
                                      .map((room) => (
                                        <option key={room.id} value={room.id}>
                                          {room.name}
                                        </option>
                                      ))}
                                  </select>
                                </Field>

                                <Field label="Pokyčio data">
                                  <input
                                    type="date"
                                    value={editForm.start_date}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        start_date: e.target.value,
                                      })
                                    }
                                    style={styles.input}
                                  />
                                </Field>
                              </div>

                              <Field label="Pastabos">
                                <textarea
                                  value={editForm.notes}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      notes: e.target.value,
                                    })
                                  }
                                  rows={2}
                                  style={{ ...styles.input, resize: 'vertical' }}
                                />
                              </Field>

                              <div style={styles.formActions}>
                                <button
                                  onClick={handleUpdateResidentState}
                                  disabled={rowSavingId === resident.id}
                                  style={styles.primaryButton}
                                >
                                  {rowSavingId === resident.id ? 'Saugoma...' : 'Išsaugoti pokytį'}
                                </button>

                                <button onClick={cancelEdit} style={styles.secondaryButton}>
                                  Atšaukti
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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

function StatCard({
  label,
  value,
  active = false,
  onClick,
}: {
  label: string
  value: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.statCard,
        ...(active ? styles.statCardActive : {}),
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </button>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
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
  roomBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    padding: '14px 16px',
    borderRadius: 16,
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
  },
  roomBannerTitle: {
    fontSize: 18,
    color: '#111827',
  },
  roomBannerMeta: {
    marginTop: 6,
    fontSize: 14,
    color: '#374151',
    fontWeight: 600,
  },
  freeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: 999,
    background: '#dcfce7',
    color: '#166534',
    border: '1px solid #bbf7d0',
    fontSize: 13,
    fontWeight: 800,
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
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: 12,
  },
  statCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 18,
    padding: 16,
    minHeight: 110,
    transition: '0.2s ease',
  },
  statCardActive: {
    background: '#eff6ff',
    border: '2px solid #2563eb',
    boxShadow: '0 0 0 3px rgba(37,99,235,0.08)',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 800,
    marginBottom: 8,
    lineHeight: 1,
    color: '#111827',
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
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: 14,
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: 14,
  },
  editGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 14,
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
    minWidth: 1100,
    tableLayout: 'fixed',
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
  },
  tdBold: {
    padding: '14px 10px',
    color: '#111827',
    fontSize: 14,
    fontWeight: 800,
    verticalAlign: 'middle',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  actionsCell: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  editRow: {
    background: '#f8fafc',
  },
  editCell: {
    padding: 0,
  },
  editBox: {
    padding: 16,
    display: 'grid',
    gap: 14,
    borderTop: '1px dashed #d1d5db',
  },
  editTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#111827',
  },
}