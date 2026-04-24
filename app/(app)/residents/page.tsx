'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

type ResidentStatus =
  | 'netrukus_atvyks'
  | 'gyvena'
  | 'ligonineje'
  | 'laikinai_isvykes'
  | 'sutartis_nutraukta'
  | 'mire'

type Room = {
  id: string
  name: string | null
  organization_id?: string | null
  is_active?: boolean | null
}

type Resident = {
  id: string
  organization_id: string
  resident_code: string | null
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  current_status: string | null
  current_room_id: string | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  care_level: string | null
  created_by: string | null
  assigned_to: string | null
  birth_date?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  internal_notes?: string | null
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

type StaffMember = {
  user_id: string
  role: 'owner' | 'admin' | 'employee'
  staff_type: string | null
  position: string | null
  department: string | null
  full_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
}

type NewResidentForm = {
  full_name: string
  resident_code: string
  current_status: ResidentStatus
  room_id: string
  start_date: string
  notes: string
  care_level: '' | 'savarankiskas' | 'daline_slauga' | 'slauga' | 'intensyvi_slauga'
  assigned_to: string
  birth_date: string
  phone: string
  email: string
  address: string
}

type EditStateForm = {
  resident_id: string
  full_name: string
  new_status: ResidentStatus
  new_room_id: string
  start_date: string
  notes: string
  assigned_to: string
  birth_date: string
  phone: string
  email: string
  address: string
}

const STATUS_OPTIONS = [
  { value: 'netrukus_atvyks', label: 'Netrukus atvyks' },
  { value: 'gyvena', label: 'Gyvena' },
  { value: 'ligonineje', label: 'Ligoninėje' },
  { value: 'laikinai_isvykes', label: 'Laikinai išvykęs' },
  { value: 'sutartis_nutraukta', label: 'Sutartis nutraukta' },
  { value: 'mire', label: 'Miręs' },
] as const

const initialForm: NewResidentForm = {
  full_name: '',
  resident_code: '',
  current_status: 'gyvena',
  room_id: '',
  start_date: new Date().toISOString().slice(0, 10),
  notes: '',
  care_level: '',
  assigned_to: '',
  birth_date: '',
  phone: '',
  email: '',
  address: '',
}

function normalizeResidentDisplayName(resident: Resident) {
  if (resident.full_name?.trim()) return resident.full_name.trim()
  const joined = [resident.first_name, resident.last_name].filter(Boolean).join(' ').trim()
  return joined || 'Be vardo'
}

function getStatusLabel(value: string | null) {
  const found = STATUS_OPTIONS.find((option) => option.value === value)
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
    case 'netrukus_atvyks':
      return {
        background: '#ecfdf5',
        color: '#047857',
        border: '1px solid #a7f3d0',
      }
    case 'ligonineje':
      return {
        background: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fde68a',
      }
    case 'laikinai_isvykes':
      return {
        background: '#ecfccb',
        color: '#3f6212',
        border: '1px solid #d9f99d',
      }
    case 'sutartis_nutraukta':
      return {
        background: '#f3f4f6',
        color: '#374151',
        border: '1px solid #d1d5db',
      }
    case 'mire':
      return {
        background: '#fee2e2',
        color: '#b91c1c',
        border: '1px solid #fecaca',
      }
    default:
      return {
        background: '#f3f4f6',
        color: '#374151',
        border: '1px solid #e5e7eb',
      }
  }
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <th
      className={`border-b border-slate-200 bg-slate-50 px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-slate-500 ${className}`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <td className={`border-b border-slate-100 px-6 py-5 ${className}`}>{children}</td>
}

export default function ResidentsPage() {
  const searchParams = useSearchParams()
  const roomIdFromQuery = searchParams.get('room_id') || ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const [rooms, setRooms] = useState<Room[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [stays, setStays] = useState<ResidentStay[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<'owner' | 'admin' | 'employee' | ''>('')

  const [form, setForm] = useState<NewResidentForm>(initialForm)

  const [editingResidentId, setEditingResidentId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditStateForm | null>(null)
  const [rowSavingId, setRowSavingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | string>('active_only')
  const [roomFilter, setRoomFilter] = useState(roomIdFromQuery)
  const [careLevelFilter, setCareLevelFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_desc')

  const canManageAll = myRole === 'owner' || myRole === 'admin'

  useEffect(() => {
    setRoomFilter(roomIdFromQuery)
  }, [roomIdFromQuery])

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setMessage('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setMessage('Nepavyko nustatyti naudotojo.')
        setLoading(false)
        return
      }

      setCurrentUserId(user.id)

      const orgId = await getCurrentOrganizationId()

      if (!orgId) {
        setOrganizationId(null)
        setRooms([])
        setResidents([])
        setStays([])
        setStaffMembers([])
        setMessage('Nepavyko nustatyti įstaigos.')
        setLoading(false)
        return
      }

      setOrganizationId(orgId)

      const [
        { data: roomsData, error: roomsError },
        { data: residentsData, error: residentsError },
        { data: staysData, error: staysError },
        { data: membersData, error: membersError },
      ] = await Promise.all([
        supabase
          .from('rooms')
          .select('id, name, organization_id, is_active')
          .eq('organization_id', orgId)
          .order('name'),
        supabase
          .from('residents')
          .select(
            'id, organization_id, resident_code, full_name, first_name, last_name, current_status, current_room_id, is_active, created_at, updated_at, care_level, created_by, assigned_to, birth_date, phone, email, address, internal_notes'
          )
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false }),
        supabase
          .from('resident_stays')
          .select('id, resident_id, room_id, status, start_date, end_date, notes, created_at')
          .eq('organization_id', orgId)
          .order('start_date', { ascending: false }),
        supabase
          .from('organization_members')
          .select('user_id, role, is_active')
          .eq('organization_id', orgId)
          .eq('is_active', true),
      ])

      if (roomsError) throw roomsError
      if (residentsError) throw residentsError
      if (staysError) throw staysError
      if (membersError) throw membersError

      const memberUserIds = (membersData || [])
        .map((row: any) => row.user_id)
        .filter(Boolean)

      let profilesMap = new Map<string, any>()

      if (memberUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, last_name, email')
          .in('id', memberUserIds)

        if (profilesError) throw profilesError

        profilesMap = new Map(
          (profilesData || []).map((profile: any) => [profile.id, profile])
        )
      }

      const mappedStaff: StaffMember[] = (membersData || []).map((row: any) => {
        const profile = profilesMap.get(row.user_id)

        return {
          user_id: row.user_id,
          role: row.role,
          staff_type: null,
          position: null,
          department: null,
          full_name: profile?.full_name || null,
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null,
          email: profile?.email || null,
        }
      })

      const myMembership = mappedStaff.find((m) => m.user_id === user.id)
      setMyRole((myMembership?.role as 'owner' | 'admin' | 'employee') || 'employee')

      setRooms((roomsData || []) as Room[])
      setResidents((residentsData || []) as Resident[])
      setStays((staysData || []) as ResidentStay[])
      setStaffMembers(mappedStaff)

      setForm((prev) => ({
        ...prev,
        room_id: roomIdFromQuery || prev.room_id,
      }))
    } catch (error: any) {
      setMessage(error?.message || 'Nepavyko užkrauti duomenų.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateResident(e: React.FormEvent) {
    e.preventDefault()

    if (!organizationId) {
      setMessage('Nepavyko nustatyti įstaigos.')
      return
    }

    if (!form.full_name.trim()) {
      setMessage('Įvesk pilną vardą.')
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
        full_name: form.full_name.trim(),
        resident_code: form.resident_code.trim() || null,
        care_level: form.care_level || null,
        current_status: form.current_status,
        current_room_id: form.room_id || null,
        is_active: !['sutartis_nutraukta', 'mire'].includes(form.current_status),
        created_by: currentUserId,
        assigned_to: form.assigned_to || null,
        birth_date: form.birth_date || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        internal_notes: form.notes.trim() || null,
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
      setMessage('Gyventojas sėkmingai sukurtas.')
      await loadData()
    } catch (error: any) {
      setMessage(error?.message || 'Nepavyko sukurti gyventojo.')
    } finally {
      setSaving(false)
    }
  }

  function getOpenStay(residentId: string) {
    return stays.find((stay) => stay.resident_id === residentId && !stay.end_date) || null
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
          full_name: editForm.full_name.trim() || resident.full_name,
          current_status: editForm.new_status,
          current_room_id: editForm.new_room_id || null,
          is_active: !['sutartis_nutraukta', 'mire'].includes(editForm.new_status),
          assigned_to: editForm.assigned_to || null,
          birth_date: editForm.birth_date || null,
          phone: editForm.phone.trim() || null,
          email: editForm.email.trim() || null,
          address: editForm.address.trim() || null,
          internal_notes: editForm.notes.trim() || null,
        })
        .eq('id', editForm.resident_id)

      if (residentUpdateError) throw residentUpdateError

      setEditingResidentId(null)
      setEditForm(null)
      setMessage(
        `Gyventojo ${resident.resident_code || resident.full_name || ''} duomenys atnaujinti.`
      )
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

  function getAssignedLabel(userId: string | null | undefined) {
    if (!userId) return 'Nepriskirta'
    const member = staffMembers.find((item) => item.user_id === userId)
    if (!member) return 'Nežinomas darbuotojas'
    return (
      member.full_name ||
      [member.first_name, member.last_name].filter(Boolean).join(' ').trim() ||
      member.email ||
      'Darbuotojas'
    )
  }

  const filteredResidents = useMemo(() => {
    let rows = [...residents]

    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter((resident) =>
        [
          normalizeResidentDisplayName(resident),
          resident.resident_code || '',
          resident.phone || '',
          resident.email || '',
          resident.address || '',
          getRoomName(resident.current_room_id),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
    }

    if (statusFilter === 'active_only') {
      rows = rows.filter(
        (resident) => !['sutartis_nutraukta', 'mire'].includes(resident.current_status || '')
      )
    } else if (statusFilter === 'archived_only') {
      rows = rows.filter((resident) =>
        ['sutartis_nutraukta', 'mire'].includes(resident.current_status || '')
      )
    } else if (statusFilter === 'ligonineje_ir_isvyke') {
      rows = rows.filter((resident) =>
        ['ligonineje', 'laikinai_isvykes'].includes(resident.current_status || '')
      )
    } else if (statusFilter !== 'all') {
      rows = rows.filter((resident) => resident.current_status === statusFilter)
    }

    if (roomFilter) {
      rows = rows.filter((resident) => resident.current_room_id === roomFilter)
    }

    if (careLevelFilter) {
      rows = rows.filter((resident) => resident.care_level === careLevelFilter)
    }

    if (assignedFilter) {
      rows = rows.filter((resident) => resident.assigned_to === assignedFilter)
    }

    rows.sort((a, b) => {
      if (sortBy === 'created_asc') {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      }
      if (sortBy === 'name_asc') {
        return normalizeResidentDisplayName(a).localeCompare(
          normalizeResidentDisplayName(b),
          'lt'
        )
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })

    return rows
  }, [
    residents,
    search,
    statusFilter,
    roomFilter,
    careLevelFilter,
    assignedFilter,
    sortBy,
    stays,
    rooms,
  ])

  const stats = useMemo(() => {
    const total = residents.length
    const soon = residents.filter((r) => r.current_status === 'netrukus_atvyks').length
    const living = residents.filter((r) => r.current_status === 'gyvena').length
    const hospital = residents.filter((r) => r.current_status === 'ligonineje').length
    const away = residents.filter((r) => r.current_status === 'laikinai_isvykes').length
    const archived = residents.filter((r) =>
      ['sutartis_nutraukta', 'mire'].includes(r.current_status || '')
    ).length
    const active = total - archived

    return { total, active, soon, living, hospital, away, archived }
  }, [residents])

  function openEdit(resident: Resident) {
    setEditingResidentId(resident.id)
    setEditForm({
      resident_id: resident.id,
      full_name: normalizeResidentDisplayName(resident),
      new_status: (resident.current_status as ResidentStatus) || 'gyvena',
      new_room_id: resident.current_room_id || '',
      start_date: new Date().toISOString().slice(0, 10),
      notes: resident.internal_notes || '',
      assigned_to: resident.assigned_to || '',
      birth_date: resident.birth_date || '',
      phone: resident.phone || '',
      email: resident.email || '',
      address: resident.address || '',
    })
  }

  function StatFilterCard({
    label,
    value,
    active,
    onClick,
  }: {
    label: string
    value: number
    active?: boolean
    onClick: () => void
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition ${
          active
            ? 'border-emerald-300 ring-2 ring-emerald-100'
            : 'border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/40'
        }`}
      >
        <div className="text-sm text-slate-500">{label}</div>
        <div className="mt-2 text-4xl font-bold text-slate-900">{value}</div>
      </button>
    )
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Kraunama...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-[1820px] space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Gyventojai
            </h1>
            <p className="mt-2 text-base text-slate-600">
              Lentelės vaizdas didesniam kiekiui duomenų: greitesnis skenavimas,
              redagavimas ir priskyrimai.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
            >
              Atnaujinti
            </button>
          </div>
        </div>

        {message ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatFilterCard
            label="Viso"
            value={stats.total}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <StatFilterCard
            label="Aktyvūs"
            value={stats.active}
            active={statusFilter === 'active_only'}
            onClick={() => setStatusFilter('active_only')}
          />
          <StatFilterCard
            label="Netrukus atvyks"
            value={stats.soon}
            active={statusFilter === 'netrukus_atvyks'}
            onClick={() => setStatusFilter('netrukus_atvyks')}
          />
          <StatFilterCard
            label="Gyvena"
            value={stats.living}
            active={statusFilter === 'gyvena'}
            onClick={() => setStatusFilter('gyvena')}
          />
          <StatFilterCard
            label="Ligoninėje / išvykę"
            value={stats.hospital + stats.away}
            active={statusFilter === 'ligonineje_ir_isvyke'}
            onClick={() => setStatusFilter('ligonineje_ir_isvyke')}
          />
          <StatFilterCard
            label="Archyvas"
            value={stats.archived}
            active={statusFilter === 'archived_only'}
            onClick={() => setStatusFilter('archived_only')}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.32fr_1.08fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Gyventojų sąrašas</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Tinka didesniam kiekiui įrašų ir kasdieniam darbui.
                </p>
              </div>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ieškoti pagal vardą, kodą, tel., el. paštą..."
                className="xl:col-span-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
              >
                <option value="active_only">Aktyvūs gyventojai</option>
                <option value="archived_only">Archyvas</option>
                <option value="ligonineje_ir_isvyke">Ligoninėje / išvykę</option>
                <option value="all">Visi įrašai</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
              >
                <option value="">Visi kambariai</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name || room.id}
                  </option>
                ))}
              </select>

              <select
                value={assignedFilter}
                onChange={(e) => setAssignedFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
              >
                <option value="">Visi darbuotojai</option>
                {staffMembers.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {getAssignedLabel(member.user_id)}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <Th>Gyventojas</Th>
                    <Th>Statusas</Th>
                    <Th>Kontaktai</Th>
                    <Th>Priskirti darbuotojai</Th>
                    <Th>Kodas / kambarys</Th>
                    <Th className="text-right">Veiksmai</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResidents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="rounded-b-2xl border border-slate-200 px-6 py-10 text-center text-sm text-slate-500"
                      >
                        Gyventojų nerasta.
                      </td>
                    </tr>
                  ) : (
                    filteredResidents.map((resident) => (
                      <tr key={resident.id} className="align-top">
                        <Td>
                          <Link href={`/residents/${resident.id}`} className="inline-block">
                            <div className="text-2xl font-semibold text-slate-900 transition hover:text-emerald-600">
                              {normalizeResidentDisplayName(resident)}
                            </div>
                          </Link>
                          <div className="mt-3 space-y-1 text-sm text-slate-500">
                            <div>Gimimo data: {resident.birth_date || 'nenurodyta'}</div>
                            <div>Adresas: {resident.address || 'nenurodytas'}</div>
                          </div>
                        </Td>

                        <Td>
                          <span
                            className="inline-flex rounded-full px-3 py-1 text-sm font-medium"
                            style={statusStyle(resident.current_status)}
                          >
                            {getStatusLabel(resident.current_status)}
                          </span>
                        </Td>

                        <Td>
                          <div className="space-y-1 text-sm text-slate-700">
                            <div>{resident.phone || '—'}</div>
                            <div>{resident.email || '—'}</div>
                          </div>
                        </Td>

                        <Td>
                          <div className="space-y-2">
                            <div className="text-sm text-slate-700">
                              {getAssignedLabel(resident.assigned_to)}
                            </div>

                            {canManageAll ? (
                              <select
                                value={resident.assigned_to || ''}
                                onChange={async (e) => {
                                  const userId = e.target.value || null
                                  const { error } = await supabase
                                    .from('residents')
                                    .update({ assigned_to: userId })
                                    .eq('id', resident.id)

                                  if (error) {
                                    setMessage(error.message)
                                    return
                                  }

                                  await loadData()
                                }}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400"
                              >
                                <option value="">Nepriskirta</option>
                                {staffMembers.map((member) => (
                                  <option key={member.user_id} value={member.user_id}>
                                    {getAssignedLabel(member.user_id)}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                          </div>
                        </Td>

                        <Td>
                          <div className="space-y-1 text-sm text-slate-700">
                            <div>{resident.resident_code || '—'}</div>
                            <div>Kambarys {getRoomName(resident.current_room_id)}</div>
                          </div>
                        </Td>

                        <Td className="text-right">
                          <button
                            type="button"
                            onClick={() => openEdit(resident)}
                            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            Redaguoti
                          </button>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Sukurti gyventoją</h2>
            <p className="mt-1 text-sm text-slate-500">
              Platesnė forma, kad viskas tilptų patogiau.
            </p>

            <form onSubmit={handleCreateResident} className="mt-6 space-y-4">
              <label className="block">
                <div className="mb-1.5 text-sm font-medium text-slate-700">Pilnas vardas</div>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Pvz. Jonas Jonaitis"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">Telefonas</div>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+370..."
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="block">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">El. paštas</div>
                  <input
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="email@pvz.lt"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">Gimimo data</div>
                  <input
                    type="date"
                    value={form.birth_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, birth_date: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="block">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">Statusas</div>
                  <select
                    value={form.current_status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        current_status: e.target.value as NewResidentForm['current_status'],
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">Kambarys</div>
                  <select
                    value={form.room_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, room_id: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  >
                    <option value="">Nepasirinkta</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name || room.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">Pokyčio data</div>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  />
                </label>
              </div>

              <label className="block">
                <div className="mb-1.5 text-sm font-medium text-slate-700">
                  Priskirtas darbuotojas
                </div>
                <select
                  value={form.assigned_to}
                  onChange={(e) => setForm((prev) => ({ ...prev, assigned_to: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                >
                  <option value="">Nepriskirta</option>
                  {staffMembers.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {getAssignedLabel(member.user_id)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1.5 text-sm font-medium text-slate-700">Adresas</div>
                <input
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Vilnius..."
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                />
              </label>

              <label className="block">
                <div className="mb-1.5 text-sm font-medium text-slate-700">Pastabos</div>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? 'Saugoma...' : 'Sukurti gyventoją'}
              </button>
            </form>
          </aside>
        </section>

        {editForm ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => {
              setEditingResidentId(null)
              setEditForm(null)
            }}
          >
            <div
              className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Redaguoti gyventoją</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Čia gali pakeisti statusą, kambarį, priskyrimą ir kontaktinę informaciją.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingResidentId(null)
                    setEditForm(null)
                  }}
                  className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                >
                  ×
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">Pilnas vardas</div>
                  <input
                    value={editForm.full_name}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, full_name: e.target.value } : prev
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="block">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">Statusas</div>
                  <select
                    value={editForm.new_status}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? { ...prev, new_status: e.target.value as EditStateForm['new_status'] }
                          : prev
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">Kambarys</div>
                  <select
                    value={editForm.new_room_id}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, new_room_id: e.target.value } : prev
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  >
                    <option value="">Nepasirinkta</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name || room.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">Pokyčio data</div>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, start_date: e.target.value } : prev
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="block">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">
                    Priskirtas darbuotojas
                  </div>
                  <select
                    value={editForm.assigned_to}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, assigned_to: e.target.value } : prev
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  >
                    <option value="">Nepriskirta</option>
                    {staffMembers.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {getAssignedLabel(member.user_id)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">Gimimo data</div>
                  <input
                    type="date"
                    value={editForm.birth_date}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, birth_date: e.target.value } : prev
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="block">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">Telefonas</div>
                  <input
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm((prev) => (prev ? { ...prev, phone: e.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="block">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">El. paštas</div>
                  <input
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((prev) => (prev ? { ...prev, email: e.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="block md:col-span-2">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">Adresas</div>
                  <input
                    value={editForm.address}
                    onChange={(e) =>
                      setEditForm((prev) => (prev ? { ...prev, address: e.target.value } : prev))
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="block md:col-span-2">
                  <div className="mb-1.5 text-sm font-medium text-slate-700">Pastabos</div>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) =>
                      setEditForm((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                    }
                    rows={4}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditingResidentId(null)
                    setEditForm(null)
                  }}
                  className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                >
                  Atšaukti
                </button>

                <button
                  type="button"
                  onClick={() => void handleUpdateResidentState()}
                  disabled={rowSavingId === editForm.resident_id}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {rowSavingId === editForm.resident_id
                    ? 'Saugoma...'
                    : 'Išsaugoti pakeitimus'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}