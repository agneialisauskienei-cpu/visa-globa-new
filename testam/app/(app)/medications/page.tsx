'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

type SystemRole = 'owner' | 'admin' | 'employee'
type StaffType =
  | 'care_worker'
  | 'nursing_staff'
  | 'kitchen'
  | 'reception'
  | 'administration'
  | null

type Resident = {
  id: string
  resident_code: string | null
  current_status: string | null
  current_room_id: string | null
  care_level: string | null
  created_at: string | null
}

type Room = {
  id: string
  name: string
}

type MedicationLog = {
  id: string
  organization_id: string
  resident_id: string
  employee_user_id: string
  medication_name: string
  dose: string | null
  taken_at: string
  notes: string | null
  created_at: string | null
}

type NewMedicationForm = {
  resident_id: string
  medication_name: string
  dose: string
  taken_at: string
  notes: string
}

const initialForm: NewMedicationForm = {
  resident_id: '',
  medication_name: '',
  dose: '',
  taken_at: new Date().toISOString().slice(0, 16),
  notes: '',
}

export default function MedicationsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const [myRole, setMyRole] = useState<SystemRole | ''>('')
  const [myStaffType, setMyStaffType] = useState<StaffType>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [rooms, setRooms] = useState<Room[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [logs, setLogs] = useState<MedicationLog[]>([])

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [form, setForm] = useState<NewMedicationForm>(initialForm)

  const [search, setSearch] = useState('')
  const [residentFilter, setResidentFilter] = useState('')
  const [sortBy, setSortBy] = useState('taken_desc')

  const canViewModule =
    myRole === 'owner' ||
    myRole === 'admin' ||
    myStaffType === 'nursing_staff' ||
    myStaffType === 'care_worker'

  const canCreateMedicationLog =
    myRole === 'owner' || myRole === 'admin' || myStaffType === 'nursing_staff'

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
        setResidents([])
        setLogs([])
        setRooms([])
        setMessage('Nepavyko nustatyti įstaigos.')
        setLoading(false)
        return
      }

      setOrganizationId(orgId)

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

      const { data: membershipData, error: membershipError } = await supabase
        .from('organization_members')
        .select('role, staff_type')
        .eq('organization_id', orgId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)

      if (membershipError || !membershipData || membershipData.length === 0) {
        setMessage('Nepavyko nustatyti tavo teisių.')
        setLoading(false)
        return
      }

      const membership = membershipData[0] as {
        role: SystemRole
        staff_type: StaffType
      }

      setMyRole(membership.role)
      setMyStaffType(membership.staff_type)

      if (
        membership.role !== 'owner' &&
        membership.role !== 'admin' &&
        membership.staff_type !== 'nursing_staff' &&
        membership.staff_type !== 'care_worker'
      ) {
        setResidents([])
        setLogs([])
        setRooms([])
        setLoading(false)
        return
      }

      const roomsPromise = supabase
        .from('rooms')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name')

      let visibleResidents: Resident[] = []

      if (membership.role === 'owner' || membership.role === 'admin' || membership.staff_type === 'nursing_staff') {
        const { data: residentsData, error: residentsError } = await supabase
          .from('residents')
          .select('id, resident_code, current_status, current_room_id, care_level, created_at')
          .eq('organization_id', orgId)

        if (residentsError) throw residentsError
        visibleResidents = (residentsData || []) as Resident[]
      } else if (membership.staff_type === 'care_worker') {
        const { data: assignments, error: assignmentsError } = await supabase
          .from('resident_assignments')
          .select('resident_id')
          .eq('organization_id', orgId)
          .eq('employee_user_id', user.id)

        if (assignmentsError) throw assignmentsError

        const residentIds = (assignments || []).map((item) => item.resident_id)

        if (residentIds.length > 0) {
          const { data: residentsData, error: residentsError } = await supabase
            .from('residents')
            .select('id, resident_code, current_status, current_room_id, care_level, created_at')
            .eq('organization_id', orgId)
            .in('id', residentIds)

          if (residentsError) throw residentsError
          visibleResidents = (residentsData || []) as Resident[]
        } else {
          visibleResidents = []
        }
      }

      const visibleResidentIds = visibleResidents.map((resident) => resident.id)

      let logsData: MedicationLog[] = []

      if (visibleResidentIds.length > 0) {
        const { data, error } = await supabase
          .from('medication_logs')
          .select(
            'id, organization_id, resident_id, employee_user_id, medication_name, dose, taken_at, notes, created_at'
          )
          .eq('organization_id', orgId)
          .in('resident_id', visibleResidentIds)
          .order('taken_at', { ascending: false })

        if (error) throw error
        logsData = (data || []) as MedicationLog[]
      }

      const roomsResult = await roomsPromise
      if (roomsResult.error) throw roomsResult.error

      setResidents(visibleResidents)
      setLogs(logsData)
      setRooms((roomsResult.data || []) as Room[])
    } catch (error: any) {
      setResidents([])
      setLogs([])
      setRooms([])
      setMessage(error?.message || 'Nepavyko įkelti vaistų modulio.')
    } finally {
      setLoading(false)
    }
  }

  function updateForm<K extends keyof NewMedicationForm>(
    key: K,
    value: NewMedicationForm[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCreateLog(e: React.FormEvent) {
    e.preventDefault()

    if (!organizationId || !currentUserId) {
      setMessage('Nepavyko nustatyti sistemos duomenų.')
      return
    }

    if (!form.resident_id) {
      setMessage('Pasirink gyventoją.')
      return
    }

    if (!form.medication_name.trim()) {
      setMessage('Įvesk vaisto pavadinimą.')
      return
    }

    if (!canCreateMedicationLog) {
      setMessage('Neturi teisės registruoti vaistų davimo.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const payload = {
        organization_id: organizationId,
        resident_id: form.resident_id,
        employee_user_id: currentUserId,
        medication_name: form.medication_name.trim(),
        dose: form.dose.trim() || null,
        taken_at: form.taken_at ? new Date(form.taken_at).toISOString() : new Date().toISOString(),
        notes: form.notes.trim() || null,
      }

      const { error } = await supabase.from('medication_logs').insert(payload)
      if (error) throw error

      setForm(initialForm)
      setShowCreateForm(false)
      setMessage('Vaistų davimo įrašas sėkmingai išsaugotas.')
      await loadData()
    } catch (error: any) {
      setMessage(error?.message || 'Nepavyko išsaugoti vaistų įrašo.')
    } finally {
      setSaving(false)
    }
  }

  function clearAllFilters() {
    setSearch('')
    setResidentFilter('')
    setSortBy('taken_desc')
  }

  function getResidentCode(residentId: string) {
    return residents.find((resident) => resident.id === residentId)?.resident_code || '—'
  }

  function getRoomName(roomId: string | null) {
    if (!roomId) return '—'
    return rooms.find((room) => room.id === roomId)?.name || '—'
  }

  const filteredLogs = useMemo(() => {
    let result = [...logs]

    if (search.trim()) {
      const q = search.trim().toLowerCase()

      result = result.filter((log) => {
        const resident = residents.find((item) => item.id === log.resident_id)

        return [
          log.medication_name || '',
          log.dose || '',
          log.notes || '',
          resident?.resident_code || '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      })
    }

    if (residentFilter) {
      result = result.filter((log) => log.resident_id === residentFilter)
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'taken_asc':
          return new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime()
        case 'name_asc':
          return (a.medication_name || '').localeCompare(b.medication_name || '', 'lt')
        case 'name_desc':
          return (b.medication_name || '').localeCompare(a.medication_name || '', 'lt')
        case 'taken_desc':
        default:
          return new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
      }
    })

    return result
  }, [logs, search, residentFilter, sortBy, residents])

  const stats = useMemo(() => {
    const totalLogs = logs.length

    const today = new Date()
    const todayStart = new Date(today)
    todayStart.setHours(0, 0, 0, 0)

    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    const todayLogs = logs.filter((log) => {
      const taken = new Date(log.taken_at)
      return taken >= todayStart && taken <= todayEnd
    }).length

    const distinctResidents = new Set(logs.map((log) => log.resident_id)).size
    const distinctMedications = new Set(logs.map((log) => log.medication_name)).size

    return {
      totalLogs,
      todayLogs,
      distinctResidents,
      distinctMedications,
    }
  }, [logs])

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
            <h1 style={styles.title}>Vaistai</h1>
            <p style={styles.subtitle}>
              Vaistų dalinimo registras pagal gyventoją, laiką ir darbuotoją.
            </p>
          </div>

          {canCreateMedicationLog ? (
            <button
              onClick={() => setShowCreateForm((prev) => !prev)}
              style={styles.primaryButton}
            >
              {showCreateForm ? 'Uždaryti formą' : 'Registruoti vaistų davimą'}
            </button>
          ) : null}
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        {!loading && !canViewModule ? (
          <div style={styles.deniedCard}>
            Neturi teisės matyti vaistų modulio.
          </div>
        ) : (
          <>
            <div style={styles.statsRow}>
              <StatCard label="Visi įrašai" value={String(stats.totalLogs)} />
              <StatCard label="Šiandien" value={String(stats.todayLogs)} />
              <StatCard label="Gyventojų" value={String(stats.distinctResidents)} />
              <StatCard label="Skirtingų vaistų" value={String(stats.distinctMedications)} />
            </div>

            {showCreateForm && canCreateMedicationLog ? (
              <form onSubmit={handleCreateLog} style={styles.createCard}>
                <div style={styles.cardHeader}>
                  <h2 style={styles.sectionTitle}>Naujas vaistų davimo įrašas</h2>
                </div>

                <div style={styles.formGrid}>
                  <Field label="Gyventojas *">
                    <select
                      value={form.resident_id}
                      onChange={(e) => updateForm('resident_id', e.target.value)}
                      style={styles.input}
                    >
                      <option value="">Pasirink gyventoją</option>
                      {residents.map((resident) => (
                        <option key={resident.id} value={resident.id}>
                          {resident.resident_code || 'Be kodo'} • {getRoomName(resident.current_room_id)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Vaisto pavadinimas *">
                    <input
                      value={form.medication_name}
                      onChange={(e) => updateForm('medication_name', e.target.value)}
                      placeholder="Pvz. Paracetamolis"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Dozė">
                    <input
                      value={form.dose}
                      onChange={(e) => updateForm('dose', e.target.value)}
                      placeholder="Pvz. 500 mg / 1 tab."
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Davimo laikas *">
                    <input
                      type="datetime-local"
                      value={form.taken_at}
                      onChange={(e) => updateForm('taken_at', e.target.value)}
                      style={styles.input}
                    />
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
                <h2 style={styles.sectionTitle}>Filtrai ir paieška</h2>

                <button onClick={clearAllFilters} style={styles.secondaryButton}>
                  Valyti filtrus
                </button>
              </div>

              <div style={styles.filtersGrid}>
                <Field label="Paieška">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Vaistas, dozė, pastabos ar gyventojo kodas"
                    style={styles.input}
                  />
                </Field>

                <Field label="Gyventojas">
                  <select
                    value={residentFilter}
                    onChange={(e) => setResidentFilter(e.target.value)}
                    style={styles.input}
                  >
                    <option value="">Visi</option>
                    {residents.map((resident) => (
                      <option key={resident.id} value={resident.id}>
                        {resident.resident_code || 'Be kodo'}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Rūšiavimas">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={styles.input}
                  >
                    <option value="taken_desc">Naujausi viršuje</option>
                    <option value="taken_asc">Seniausi viršuje</option>
                    <option value="name_asc">Vaistas A–Ž</option>
                    <option value="name_desc">Vaistas Ž–A</option>
                  </select>
                </Field>
              </div>
            </div>

            <div style={styles.tableCard}>
              <div style={styles.cardHeader}>
                <h2 style={styles.sectionTitle}>Vaistų davimo lentelė</h2>
                <button onClick={loadData} style={styles.secondaryButton}>
                  Atnaujinti
                </button>
              </div>

              {loading ? (
                <div style={styles.emptyState}>Kraunami vaistų įrašai...</div>
              ) : filteredLogs.length === 0 ? (
                <div style={styles.emptyState}>Vaistų įrašų nerasta.</div>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Gyventojas</th>
                        <th style={styles.th}>Kambarys</th>
                        <th style={styles.th}>Vaistas</th>
                        <th style={styles.th}>Dozė</th>
                        <th style={styles.th}>Davimo laikas</th>
                        <th style={styles.th}>Pastabos</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredLogs.map((log) => {
                        const resident = residents.find((item) => item.id === log.resident_id)

                        return (
                          <tr key={log.id} style={styles.tr}>
                            <td style={styles.tdBold}>
                              {resident?.resident_code || '—'}
                            </td>
                            <td style={styles.td}>
                              {getRoomName(resident?.current_room_id || null)}
                            </td>
                            <td style={styles.td}>{log.medication_name || '—'}</td>
                            <td style={styles.td}>{log.dose || '—'}</td>
                            <td style={styles.td}>
                              {log.taken_at
                                ? new Date(log.taken_at).toLocaleString('lt-LT')
                                : '—'}
                            </td>
                            <td style={styles.td}>{log.notes || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
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
}: {
  label: string
  value: string
}) {
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
  message: {
    padding: '12px 14px',
    borderRadius: 14,
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    color: '#111827',
  },
  deniedCard: {
    padding: 24,
    borderRadius: 18,
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    color: '#9f1239',
    fontWeight: 700,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
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
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 14,
  },
  filtersGrid: {
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
}