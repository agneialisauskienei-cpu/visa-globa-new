'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import MobileBottomNav from '@/components/mobile/MobileBottomNav'

type TaskRow = {
  id: string
  title: string
  description: string | null
  status: string | null
  priority: string | null
  due_date: string | null
  completed_at: string | null
  created_at: string | null
}

type MembershipRow = {
  role: 'owner' | 'admin' | 'employee'
}

type NotificationCountRow = {
  id: string
  is_read: boolean | null
}

function getReadableError(error: unknown) {
  if (!error) return 'Nežinoma klaida.'
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const maybe = error as { message?: string; details?: string; hint?: string; code?: string }
    if (maybe.message) return maybe.message
    if (maybe.details) return maybe.details
    if (maybe.hint) return maybe.hint
    if (maybe.code) return `Klaidos kodas: ${maybe.code}`
  }
  return 'Nepavyko įvykdyti veiksmo.'
}

function getTaskStatusLabel(status: string | null) {
  switch (status) {
    case 'todo':
      return 'Nauja'
    case 'in_progress':
      return 'Vykdoma'
    case 'done':
      return 'Atlikta'
    case 'overdue':
      return 'Pavėluota'
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
    default:
      return '—'
  }
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('lt-LT')
}

export default function MyTasksPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [notificationsCount, setNotificationsCount] = useState(0)

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

      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      const typedMembership = (membership as MembershipRow | null) || null

      if (typedMembership?.role === 'owner' || typedMembership?.role === 'admin') {
        router.replace('/admin-dashboard')
        return
      }

      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, description, status, priority, due_date, completed_at, created_at')
        .eq('assigned_to', user.id)
        .order('due_date', { ascending: true })

      if (tasksError) throw tasksError

      setTasks((tasksData as TaskRow[]) || [])

      const { data: notifications } = await supabase
        .from('notifications')
        .select('id, is_read')
        .eq('user_id', user.id)
        .eq('is_read', false)

      setNotificationsCount(((notifications as NotificationCountRow[]) || []).length)
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
          ? { status: 'done', completed_at: new Date().toISOString() }
          : { status: 'in_progress' }

      const { error } = await supabase.from('tasks').update(payload).eq('id', taskId)

      if (error) throw error

      await loadData()
      setMessage('Užduotis atnaujinta sėkmingai.')
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSavingId(null)
    }
  }

  const filteredTasks = useMemo(() => {
    if (!statusFilter) return tasks
    return tasks.filter((task) => (task.status || '') === statusFilter)
  }, [tasks, statusFilter])

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingText}>Kraunama...</div>
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
            <p style={styles.subtitle}>Peržiūrėk ir atnaujink savo užduočių būsenas.</p>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">Visos būsenos</option>
            <option value="todo">Nauja</option>
            <option value="in_progress">Vykdoma</option>
            <option value="done">Atlikta</option>
            <option value="overdue">Pavėluota</option>
          </select>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        {filteredTasks.length === 0 ? (
          <div style={styles.emptyState}>Užduočių nerasta.</div>
        ) : (
          <div style={styles.list}>
            {filteredTasks.map((task) => (
              <div key={task.id} style={styles.card}>
                <div style={styles.rowTop}>
                  <h2 style={styles.cardTitle}>{task.title}</h2>
                  <span style={styles.badge}>{getTaskStatusLabel(task.status)}</span>
                </div>

                <p style={styles.description}>{task.description || 'Aprašymo nėra.'}</p>

                <div style={styles.meta}>Prioritetas: {getPriorityLabel(task.priority)}</div>
                <div style={styles.meta}>Terminas: {formatDateTime(task.due_date)}</div>
                <div style={styles.meta}>Sukurta: {formatDateTime(task.created_at)}</div>

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

      <MobileBottomNav notificationsCount={notificationsCount} />
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
    maxWidth: 860,
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
    background: '#fff',
    border: '1px solid #e2e8f0',
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
  cardTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 800,
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
  meta: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: 600,
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