'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import MobileBottomNav from '@/components/mobile/MobileBottomNav'
import { getCurrentOrganizationId } from '@/lib/current-organization'

type TaskRow = {
  id: string
  organization_id: string
  assigned_user_id: string | null
  resident_id: string | null
  title: string
  description: string | null
  type: string | null
  subtype: string | null
  status: string | null
  priority: string | null
  due_date: string | null
  created_at: string | null
  interval_days: number | null
  last_done_at: string | null
}

type MembershipRow = {
  role: 'owner' | 'admin' | 'employee'
  staff_type?: string | null
  position?: string | null
  department?: string | null
}

type ResidentRow = {
  id: string
  resident_code: string | null
}

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

function getTaskStatusLabel(status: string | null) {
  switch (status) {
    case 'new':
      return 'Nauja'
    case 'in_progress':
      return 'Vykdoma'
    case 'done':
      return 'Atlikta'
    case 'cancelled':
      return 'Atšaukta'
    default:
      return 'Nenurodyta'
  }
}

function getPriorityLabel(priority: string | null) {
  switch (priority) {
    case 'low':
      return 'Žemas'
    case 'medium':
      return 'Vidutinis'
    case 'high':
      return 'Aukštas'
    case 'urgent':
      return 'Skubus'
    default:
      return '—'
  }
}

function getTypeLabel(type: string | null) {
  switch (type) {
    case 'higiena':
      return 'Higiena'
    case 'slauga':
      return 'Slauga'
    case 'mobilumas':
      return 'Mobilumas'
    case 'maitinimas':
      return 'Maitinimas'
    case 'socialinis':
      return 'Socialinė priežiūra'
    default:
      return type || 'Kita'
  }
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('lt-LT')
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('lt-LT')
}

function isTaskLate(task: TaskRow) {
  if (!task.due_date) return false
  if (task.status === 'done' || task.status === 'cancelled') return false

  const now = new Date()
  const due = new Date(task.due_date)

  if (Number.isNaN(due.getTime())) return false

  return due.getTime() < now.getTime()
}

function getTaskCardStyle(task: TaskRow): React.CSSProperties {
  if (task.status === 'done') {
    return {
      border: '1px solid #bbf7d0',
      background: '#f0fdf4',
    }
  }

  if (isTaskLate(task)) {
    return {
      border: '1px solid #fecaca',
      background: '#fef2f2',
    }
  }

  switch (task.type) {
    case 'higiena':
      return {
        border: '1px solid #bfdbfe',
        background: '#eff6ff',
      }
    case 'slauga':
      return {
        border: '1px solid #fecaca',
        background: '#fff1f2',
      }
    case 'mobilumas':
      return {
        border: '1px solid #fde68a',
        background: '#fffbeb',
      }
    case 'maitinimas':
      return {
        border: '1px solid #bbf7d0',
        background: '#f0fdf4',
      }
    case 'socialinis':
      return {
        border: '1px solid #ddd6fe',
        background: '#f5f3ff',
      }
    default:
      return {
        border: '1px solid #e2e8f0',
        background: '#ffffff',
      }
  }
}

export default function MyTasksPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [residentsMap, setResidentsMap] = useState<Record<string, string>>({})

  const [statusFilter, setStatusFilter] = useState('')
  const [viewFilter, setViewFilter] = useState<'today' | 'late' | 'all'>('today')

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

      const organizationId = await getCurrentOrganizationId()

      if (!organizationId) {
        setMessage('Nepavyko nustatyti įstaigos.')
        setLoading(false)
        return
      }

      const { data: membership } = await supabase
        .from('organization_members')
        .select('role, staff_type, position, department')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      const typedMembership = (membership as MembershipRow | null) || null

      if (typedMembership?.role === 'owner' || typedMembership?.role === 'admin') {
        // admin gali irgi naudoti šitą puslapį jei norėsi, bet kol kas paliekam
      }

      const { data: tasksData, error: tasksError } = await supabase
        .from('employee_tasks')
        .select(`
          id,
          organization_id,
          assigned_user_id,
          resident_id,
          title,
          description,
          type,
          subtype,
          status,
          priority,
          due_date,
          created_at,
          interval_days,
          last_done_at
        `)
        .eq('organization_id', organizationId)
        .eq('assigned_user_id', user.id)
        .order('due_date', { ascending: true })

      if (tasksError) throw tasksError

      const typedTasks = (tasksData as TaskRow[]) || []
      setTasks(typedTasks)

      const residentIds = typedTasks
        .map((task) => task.resident_id)
        .filter((value): value is string => Boolean(value))

      if (residentIds.length > 0) {
        const uniqueResidentIds = Array.from(new Set(residentIds))

        const { data: residentsData, error: residentsError } = await supabase
          .from('residents')
          .select('id, resident_code')
          .eq('organization_id', organizationId)
          .in('id', uniqueResidentIds)

        if (residentsError) throw residentsError

        const map: Record<string, string> = {}
        for (const resident of ((residentsData as ResidentRow[]) || [])) {
          map[resident.id] = resident.resident_code || '—'
        }
        setResidentsMap(map)
      } else {
        setResidentsMap({})
      }
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setLoading(false)
    }
  }

  async function updateTaskStatus(taskId: string, nextStatus: 'in_progress' | 'done') {
    setSavingId(taskId)
    setMessage('')

    try {
      const payload =
        nextStatus === 'done'
          ? {
              status: 'done',
              last_done_at: new Date().toISOString(),
            }
          : {
              status: 'in_progress',
            }

      const { error } = await supabase
        .from('employee_tasks')
        .update(payload)
        .eq('id', taskId)

      if (error) throw error

      await loadData()
      setMessage(
        nextStatus === 'done'
          ? 'Užduotis pažymėta kaip atlikta.'
          : 'Užduotis pažymėta kaip vykdoma.'
      )
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSavingId(null)
    }
  }

  const filteredTasks = useMemo(() => {
    let result = [...tasks]

    if (statusFilter) {
      result = result.filter((task) => (task.status || '') === statusFilter)
    }

    if (viewFilter === 'late') {
      result = result.filter((task) => isTaskLate(task))
    }

    if (viewFilter === 'today') {
      const today = new Date().toLocaleDateString('lt-LT')
      result = result.filter((task) => {
        if (!task.due_date) return false
        const due = new Date(task.due_date)
        if (Number.isNaN(due.getTime())) return false
        return due.toLocaleDateString('lt-LT') === today
      })
    }

    return result
  }, [tasks, statusFilter, viewFilter])

  const stats = useMemo(() => {
    const total = tasks.length
    const today = new Date().toLocaleDateString('lt-LT')

    const todayCount = tasks.filter((task) => {
      if (!task.due_date) return false
      const due = new Date(task.due_date)
      if (Number.isNaN(due.getTime())) return false
      return due.toLocaleDateString('lt-LT') === today
    }).length

    const lateCount = tasks.filter((task) => isTaskLate(task)).length
    const doneCount = tasks.filter((task) => task.status === 'done').length

    return {
      total,
      todayCount,
      lateCount,
      doneCount,
    }
  }, [tasks])

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingText}>Kraunamos užduotys...</div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerCard}>
          <button onClick={() => router.push('/employee-dashboard')} style={styles.backButton}>
            ← Atgal
          </button>

          <div>
            <h1 style={styles.title}>Mano užduotys</h1>
            <p style={styles.subtitle}>
              Kasdienės priežiūros darbai: maudymas, higiena, slauga ir kita.
            </p>
          </div>

          <div style={styles.statsRow}>
            <SmallStat label="Visos" value={String(stats.total)} />
            <SmallStat label="Šiandien" value={String(stats.todayCount)} />
            <SmallStat label="Vėluoja" value={String(stats.lateCount)} />
            <SmallStat label="Atlikta" value={String(stats.doneCount)} />
          </div>

          <div style={styles.filtersRow}>
            <select
              value={viewFilter}
              onChange={(e) => setViewFilter(e.target.value as 'today' | 'late' | 'all')}
              style={styles.select}
            >
              <option value="today">Šiandienos</option>
              <option value="late">Vėluojančios</option>
              <option value="all">Visos</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.select}
            >
              <option value="">Visos būsenos</option>
              <option value="new">Nauja</option>
              <option value="in_progress">Vykdoma</option>
              <option value="done">Atlikta</option>
              <option value="cancelled">Atšaukta</option>
            </select>
          </div>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        {filteredTasks.length === 0 ? (
          <div style={styles.emptyState}>Užduočių nerasta.</div>
        ) : (
          <div style={styles.list}>
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                style={{
                  ...styles.card,
                  ...getTaskCardStyle(task),
                }}
              >
                <div style={styles.rowTop}>
                  <div style={styles.titleBlock}>
                    <h2 style={styles.cardTitle}>{task.title}</h2>
                    <div style={styles.typeText}>
                      {getTypeLabel(task.type)}{task.subtype ? ` • ${task.subtype}` : ''}
                    </div>
                  </div>

                  <span style={styles.badge}>{getTaskStatusLabel(task.status)}</span>
                </div>

                <p style={styles.description}>{task.description || 'Aprašymo nėra.'}</p>

                <div style={styles.metaGrid}>
                  <div style={styles.meta}>Prioritetas: {getPriorityLabel(task.priority)}</div>
                  <div style={styles.meta}>Terminas: {formatDateTime(task.due_date)}</div>
                  <div style={styles.meta}>
                    Gyventojas: {task.resident_id ? residentsMap[task.resident_id] || '—' : '—'}
                  </div>
                  <div style={styles.meta}>Kartojasi kas: {task.interval_days ? `${task.interval_days} d.` : '—'}</div>
                  <div style={styles.meta}>Paskutinį kartą atlikta: {formatDate(task.last_done_at)}</div>
                  <div style={styles.meta}>Sukurta: {formatDateTime(task.created_at)}</div>
                </div>

                {isTaskLate(task) ? (
                  <div style={styles.lateText}>Užduotis vėluoja</div>
                ) : null}

                <div style={styles.actions}>
                  {task.status !== 'in_progress' && task.status !== 'done' ? (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'in_progress')}
                      disabled={savingId === task.id}
                      style={styles.secondaryButton}
                    >
                      {savingId === task.id ? 'Saugoma...' : 'Pradėti vykdyti'}
                    </button>
                  ) : null}

                  {task.status !== 'done' ? (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'done')}
                      disabled={savingId === task.id}
                      style={styles.primaryButton}
                    >
                      {savingId === task.id ? 'Saugoma...' : 'Pažymėti atlikta'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  )
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.smallStat}>
      <div style={styles.smallStatValue}>{value}</div>
      <div style={styles.smallStatLabel}>{label}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
  },
  container: {
    width: '100%',
    maxWidth: 1100,
    margin: '0 auto',
    padding: '16px 16px 96px',
    boxSizing: 'border-box',
    display: 'grid',
    gap: 16,
  },
  loadingWrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
  },
  loadingText: {
    color: '#475569',
    fontSize: 18,
    fontWeight: 700,
  },
  headerCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 24,
    padding: 18,
    display: 'grid',
    gap: 14,
  },
  backButton: {
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    background: '#fff',
    color: '#0f172a',
    padding: '10px 12px',
    fontWeight: 700,
    cursor: 'pointer',
    width: 'fit-content',
  },
  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: 28,
    fontWeight: 800,
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: 15,
    fontWeight: 600,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
  },
  smallStat: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    padding: 12,
  },
  smallStatValue: {
    fontSize: 24,
    fontWeight: 800,
    color: '#0f172a',
    lineHeight: 1,
    marginBottom: 6,
  },
  smallStatLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 700,
  },
  filtersRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  select: {
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 14,
    outline: 'none',
    background: '#fff',
  },
  message: {
    background: '#ecfeff',
    border: '1px solid #a5f3fc',
    color: '#155e75',
    padding: 14,
    borderRadius: 16,
    fontWeight: 700,
  },
  emptyState: {
    border: '1px dashed #cbd5e1',
    borderRadius: 20,
    padding: 24,
    textAlign: 'center',
    color: '#64748b',
    background: '#fff',
    fontWeight: 700,
  },
  list: {
    display: 'grid',
    gap: 14,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    display: 'grid',
    gap: 10,
  },
  rowTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  titleBlock: {
    display: 'grid',
    gap: 4,
  },
  cardTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 800,
  },
  typeText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: 700,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    background: '#e2e8f0',
    color: '#334155',
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  description: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.6,
    fontSize: 14,
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
  },
  meta: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: 600,
  },
  lateText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: 800,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  primaryButton: {
    border: 'none',
    borderRadius: 12,
    background: '#0f766e',
    color: '#fff',
    padding: '12px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    background: '#fff',
    color: '#0f172a',
    padding: '12px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
}