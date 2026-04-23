'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import MobileBottomNav from '@/components/mobile/MobileBottomNav'
import { getCurrentOrganizationId } from '@/lib/current-organization'

type ShiftRow = {
  id: string
  shift_date: string
  start_time: string | null
  end_time: string | null
  shift_type: string | null
  status: string | null
  notes: string | null
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

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('lt-LT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
}

function formatShiftTime(start: string | null, end: string | null) {
  const from = start?.slice(0, 5) || '--:--'
  const to = end?.slice(0, 5) || '--:--'
  return `${from}–${to}`
}

export default function MySchedulePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [notificationsCount, setNotificationsCount] = useState(0)

  useEffect(() => {
    const loadData = async () => {
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
          return
        }

        const { data: membership, error: membershipError } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .maybeSingle()

        if (membershipError) throw membershipError

        const typedMembership = (membership as MembershipRow | null) || null

        if (typedMembership?.role === 'owner' || typedMembership?.role === 'admin') {
          router.replace('/admin-dashboard')
          return
        }

        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(today.getDate() + 14)

        const from = today.toISOString().slice(0, 10)
        const to = endDate.toISOString().slice(0, 10)

        const { data, error } = await supabase
          .from('work_shifts')
          .select('id, shift_date, start_time, end_time, shift_type, status, notes')
          .eq('user_id', user.id)
          .gte('shift_date', from)
          .lte('shift_date', to)
          .order('shift_date', { ascending: true })
          .order('start_time', { ascending: true })

        if (error) throw error

        setShifts((data as ShiftRow[]) || [])

        const { data: notifications, error: notificationsError } = await supabase
          .from('notifications')
          .select('id, is_read')
          .eq('user_id', user.id)
          .eq('is_read', false)

        if (notificationsError) throw notificationsError

        setNotificationsCount(((notifications as NotificationCountRow[]) || []).length)
      } catch (error) {
        setMessage(getReadableError(error))
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [router])

  const todayText = useMemo(() => new Date().toLocaleDateString('lt-LT'), [])

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
            <h1 style={styles.title}>Mano grafikas</h1>
            <p style={styles.subtitle}>Rodomos artimiausios 14 dienų pamainos nuo {todayText}.</p>
          </div>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        {shifts.length === 0 ? (
          <div style={styles.emptyState}>Artimiausių pamainų nerasta.</div>
        ) : (
          <div style={styles.list}>
            {shifts.map((shift) => (
              <div key={shift.id} style={styles.card}>
                <div style={styles.topRow}>
                  <h2 style={styles.cardTitle}>{formatDate(shift.shift_date)}</h2>
                  <span style={styles.badge}>{shift.status || 'suplanuota'}</span>
                </div>

                <div style={styles.meta}>Laikas: {formatShiftTime(shift.start_time, shift.end_time)}</div>
                <div style={styles.meta}>Tipas: {shift.shift_type || '—'}</div>
                <div style={styles.description}>Pastabos: {shift.notes?.trim() || 'Pastabų nėra.'}</div>
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
  message: {
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    color: '#9a3412',
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
    gap: 8,
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
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
  meta: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: 600,
  },
  description: {
    color: '#475569',
    lineHeight: 1.6,
    fontSize: 14,
  },
}