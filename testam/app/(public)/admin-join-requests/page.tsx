'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type MembershipRole = 'owner' | 'admin' | 'employee'
type StaffType =
  | 'care_worker'
  | 'nursing_staff'
  | 'kitchen'
  | 'reception'
  | 'administration'

type PositionCode =
  | 'direktorius'
  | 'direktoriaus_pavaduotojas'
  | 'administratorius'
  | 'vyr_slaugytojas'
  | 'slaugytojas'
  | 'individualios_prieziuros_darbuotojas'
  | 'ukvedys'
  | 'vyr_socialinis_darbuotojas'
  | 'socialinis_darbuotojas'

type MembershipRow = {
  organization_id: string
  role: MembershipRole
}

type JoinRequestRow = {
  id: string
  organization_id: string
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  status: string
  created_at: string | null
}

type ApprovalForm = {
  role: 'employee' | 'admin'
  staff_type: StaffType
  position: PositionCode
  department: string
}

const DEFAULT_FORM: ApprovalForm = {
  role: 'employee',
  staff_type: 'care_worker',
  position: 'individualios_prieziuros_darbuotojas',
  department: 'Slauga',
}

const STAFF_TYPE_OPTIONS: { value: StaffType; label: string }[] = [
  { value: 'care_worker', label: 'Individuali priežiūra' },
  { value: 'nursing_staff', label: 'Slauga' },
  { value: 'kitchen', label: 'Virtuvė' },
  { value: 'reception', label: 'Registratūra' },
  { value: 'administration', label: 'Administracija' },
]

const POSITION_OPTIONS: { value: PositionCode; label: string }[] = [
  { value: 'direktorius', label: 'Direktorius' },
  { value: 'direktoriaus_pavaduotojas', label: 'Direktoriaus pavaduotojas' },
  { value: 'administratorius', label: 'Administratorius' },
  { value: 'vyr_slaugytojas', label: 'Vyr. slaugytojas' },
  { value: 'slaugytojas', label: 'Slaugytojas' },
  {
    value: 'individualios_prieziuros_darbuotojas',
    label: 'Individualios priežiūros darbuotojas',
  },
  { value: 'ukvedys', label: 'Ūkvedys' },
  { value: 'vyr_socialinis_darbuotojas', label: 'Vyr. socialinis darbuotojas' },
  { value: 'socialinis_darbuotojas', label: 'Socialinis darbuotojas' },
]

function getReadableError(error: unknown) {
  if (!error) return 'Nežinoma klaida.'
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const maybe = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }
    if (maybe.message) return maybe.message
    if (maybe.details) return maybe.details
    if (maybe.hint) return maybe.hint
    if (maybe.code) return `Klaidos kodas: ${maybe.code}`
  }
  return 'Nepavyko įvykdyti veiksmo.'
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('lt-LT')
}

function getFullName(item: JoinRequestRow) {
  return [item.first_name, item.last_name].filter(Boolean).join(' ').trim() || 'Nenurodytas vardas'
}

export default function AdminJoinRequestsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [message, setMessage] = useState('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [adminUserId, setAdminUserId] = useState<string | null>(null)
  const [requests, setRequests] = useState<JoinRequestRow[]>([])
  const [forms, setForms] = useState<Record<string, ApprovalForm>>({})

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setMessage('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      setAdminUserId(user.id)

      const { data: membershipData, error: membershipError } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (membershipError) throw membershipError

      const membership = (membershipData as MembershipRow | null) || null

      if (!membership) {
        router.replace('/login')
        return
      }

      if (membership.role === 'employee') {
        router.replace('/employee-dashboard')
        return
      }

      setOrganizationId(membership.organization_id)

      const { data, error } = await supabase
        .from('organization_join_requests')
        .select('id, organization_id, user_id, email, first_name, last_name, status, created_at')
        .eq('organization_id', membership.organization_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error

      const typed = (data || []) as JoinRequestRow[]
      setRequests(typed)

      setForms((prev) => {
        const next = { ...prev }
        for (const item of typed) {
          if (!next[item.id]) {
            next[item.id] = { ...DEFAULT_FORM }
          }
        }
        return next
      })
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setLoading(false)
    }
  }

  function updateForm<K extends keyof ApprovalForm>(
    requestId: string,
    key: K,
    value: ApprovalForm[K]
  ) {
    setForms((prev) => ({
      ...prev,
      [requestId]: {
        ...(prev[requestId] || DEFAULT_FORM),
        [key]: value,
      },
    }))
  }

  async function approveRequest(item: JoinRequestRow) {
    if (!organizationId || !adminUserId) return

    const form = forms[item.id] || DEFAULT_FORM

    setSavingId(item.id)
    setMessage('')

    try {
      const { error: memberError } = await supabase
        .from('organization_members')
        .upsert({
          organization_id: organizationId,
          user_id: item.user_id,
          role: form.role,
          staff_type: form.staff_type,
          position: form.position,
          department: form.department.trim() || null,
          is_active: true,
        })

      if (memberError) throw memberError

      const { error: requestError } = await supabase
        .from('organization_join_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminUserId,
        })
        .eq('id', item.id)

      if (requestError) throw requestError

      setMessage('Darbuotojas patvirtintas.')
      await loadData()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSavingId('')
    }
  }

  async function rejectRequest(item: JoinRequestRow) {
    if (!adminUserId) return

    setSavingId(item.id)
    setMessage('')

    try {
      const { error } = await supabase
        .from('organization_join_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminUserId,
        })
        .eq('id', item.id)

      if (error) throw error

      setMessage('Prašymas atmestas.')
      await loadData()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSavingId('')
    }
  }

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingCard}>Kraunami laukiantys darbuotojai...</div>
      </div>
    )
  }

  return (
    <main style={styles.page}>
      <section style={styles.heroCard}>
        <div style={styles.heroBadge}>Patvirtinimai</div>
        <h1 style={styles.heroTitle}>Laukiantys darbuotojai</h1>
        <p style={styles.heroSubtitle}>
          Čia gali patvirtinti registracijas ir iškart parinkti darbuotojo rolę, pareigas bei skyrių.
        </p>
      </section>

      {message ? <div style={styles.message}>{message}</div> : null}

      {requests.length === 0 ? (
        <section style={styles.emptyState}>
          <div style={styles.emptyTitle}>Laukiančių darbuotojų nėra</div>
          <div style={styles.emptyText}>
            Kai kas nors užsiregistruos su tavo įstaigos kodu, jis atsiras čia.
          </div>
        </section>
      ) : (
        <section style={styles.grid}>
          {requests.map((item) => {
            const form = forms[item.id] || DEFAULT_FORM

            return (
              <article key={item.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <div>
                    <div style={styles.name}>{getFullName(item)}</div>
                    <div style={styles.email}>{item.email || 'Be el. pašto'}</div>
                  </div>

                  <div style={styles.pendingBadge}>Laukia</div>
                </div>

                <div style={styles.metaBox}>
                  <div style={styles.metaRow}>
                    <span style={styles.metaLabel}>Registruota</span>
                    <span style={styles.metaValue}>{formatDateTime(item.created_at)}</span>
                  </div>
                </div>

                <div style={styles.formGrid}>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Rolė</span>
                    <select
                      value={form.role}
                      onChange={(e) =>
                        updateForm(item.id, 'role', e.target.value as ApprovalForm['role'])
                      }
                      style={styles.select}
                    >
                      <option value="employee">Darbuotojas</option>
                      <option value="admin">Administratorius</option>
                    </select>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Staff type</span>
                    <select
                      value={form.staff_type}
                      onChange={(e) =>
                        updateForm(item.id, 'staff_type', e.target.value as StaffType)
                      }
                      style={styles.select}
                    >
                      {STAFF_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Pareigos</span>
                    <select
                      value={form.position}
                      onChange={(e) =>
                        updateForm(item.id, 'position', e.target.value as PositionCode)
                      }
                      style={styles.select}
                    >
                      {POSITION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Skyrius</span>
                    <input
                      type="text"
                      value={form.department}
                      onChange={(e) => updateForm(item.id, 'department', e.target.value)}
                      style={styles.input}
                      placeholder="Pvz. Slauga"
                    />
                  </label>
                </div>

                <div style={styles.buttonRow}>
                  <button
                    onClick={() => approveRequest(item)}
                    disabled={savingId === item.id}
                    style={styles.approveButton}
                  >
                    {savingId === item.id ? 'Tvirtinama...' : 'Patvirtinti'}
                  </button>

                  <button
                    onClick={() => rejectRequest(item)}
                    disabled={savingId === item.id}
                    style={styles.rejectButton}
                  >
                    Atmesti
                  </button>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'grid',
    gap: 18,
    padding: 8,
  },
  loadingWrap: {
    minHeight: '70vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    background: '#fff',
    border: '1px solid #dde5de',
    borderRadius: 24,
    padding: '26px 30px',
    fontSize: 16,
    fontWeight: 800,
    color: '#223128',
  },
  heroCard: {
    borderRadius: 30,
    border: '1px solid #dce5dd',
    background: '#eef4ef',
    padding: 28,
  },
  heroBadge: {
    display: 'inline-flex',
    padding: '7px 12px',
    borderRadius: 999,
    background: '#2f5a3a',
    color: '#fff',
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 14,
  },
  heroTitle: {
    margin: 0,
    fontSize: 40,
    fontWeight: 900,
    lineHeight: 1.05,
    color: '#173120',
  },
  heroSubtitle: {
    margin: '12px 0 0',
    color: '#64756a',
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  message: {
    padding: '12px 14px',
    borderRadius: 14,
    background: '#fff8f6',
    border: '1px solid #f1d0c2',
    color: '#9a3412',
    fontWeight: 700,
  },
  emptyState: {
    border: '1px dashed #d8e1d8',
    borderRadius: 22,
    padding: 28,
    background: '#fff',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: '#1f3128',
    marginBottom: 8,
  },
  emptyText: {
    color: '#64756b',
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 16,
  },
  card: {
    background: '#fff',
    border: '1px solid #dde5de',
    borderRadius: 24,
    padding: 18,
    display: 'grid',
    gap: 16,
    boxShadow: '0 10px 24px rgba(48,68,55,0.04)',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  name: {
    fontSize: 22,
    fontWeight: 900,
    color: '#1f3128',
    lineHeight: 1.2,
  },
  email: {
    marginTop: 8,
    color: '#607066',
    fontSize: 14,
    fontWeight: 700,
  },
  pendingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px',
    borderRadius: 999,
    background: '#eef4ef',
    color: '#587561',
    fontSize: 12,
    fontWeight: 900,
    border: '1px solid #dbe7dc',
    whiteSpace: 'nowrap',
  },
  metaBox: {
    borderRadius: 18,
    border: '1px solid #e3ebe4',
    background: '#fafcfb',
    padding: 14,
    display: 'grid',
    gap: 10,
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: '#6b7c71',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: 900,
    color: '#24322a',
    textAlign: 'right',
  },
  formGrid: {
    display: 'grid',
    gap: 12,
  },
  field: {
    display: 'grid',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: '#5d7262',
  },
  select: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 14,
    border: '1px solid #d8e4da',
    background: '#fff',
    padding: '12px 14px',
    fontSize: 14,
    color: '#233229',
    outline: 'none',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 14,
    border: '1px solid #d8e4da',
    background: '#fff',
    padding: '12px 14px',
    fontSize: 14,
    color: '#233229',
    outline: 'none',
  },
  buttonRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  approveButton: {
    border: 'none',
    borderRadius: 12,
    background: '#587561',
    color: '#fff',
    padding: '11px 16px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  rejectButton: {
    border: '1px solid #d8e1d8',
    borderRadius: 12,
    background: '#fff',
    color: '#2b3a2f',
    padding: '11px 16px',
    fontWeight: 900,
    cursor: 'pointer',
  },
}