'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import MobileBottomNav from '@/components/mobile/MobileBottomNav'
import { getReadableError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { getCurrentMembership } from '@/lib/current-membership'
import { getCurrentOrganizationId } from '@/lib/current-organization'
import { ROUTES } from '@/lib/routes'

type ResidentAssignmentRow = {
  id: string
  resident_id: string
  created_at: string | null
  residents: {
    id: string
    first_name: string | null
    last_name: string | null
    full_name: string | null
    room_number: string | null
    status: string | null
  } | null
}

type NotificationCountRow = {
  id: string
  is_read: boolean | null
}

function formatResidentName(resident: ResidentAssignmentRow['residents']) {
  if (!resident) return 'Gyventojas'
  const combined = [resident.first_name, resident.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()

  if (combined) return combined
  if (resident.full_name?.trim()) return resident.full_name.trim()
  return 'Gyventojas'
}

export default function MyResidentsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<ResidentAssignmentRow[]>([])
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
          router.replace(ROUTES.login)
          return
        }

        const organizationId = await getCurrentOrganizationId()

        if (!organizationId) {
          setMessage('Nepavyko nustatyti įstaigos.')
          return
        }

        const membership = await getCurrentMembership(user.id)

        if (membership?.role === 'owner' || membership?.role === 'admin') {
          router.replace(ROUTES.adminDashboard)
          return
        }

        const { data, error } = await supabase
          .from('resident_assignments')
          .select(
            'id, resident_id, created_at, residents(id, first_name, last_name, full_name, room_number, status)'
          )
          .eq('employee_user_id', user.id)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })

        if (error) throw error

        setItems((data as ResidentAssignmentRow[]) || [])

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
          <button
            onClick={() => router.push(ROUTES.employeeDashboard)}
            style={styles.backButton}
          >
            ← Atgal
          </button>

          <div>
            <h1 style={styles.title}>Mano priskirti gyventojai</h1>
            <p style={styles.subtitle}>Čia matai tik tau priskirtus gyventojus.</p>
          </div>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        {items.length === 0 ? (
          <div style={styles.emptyState}>Priskirtų gyventojų nėra.</div>
        ) : (
          <div style={styles.list}>
            {items.map((item) => (
              <div key={item.id} style={styles.card}>
                <h2 style={styles.cardTitle}>{formatResidentName(item.residents)}</h2>

                <div style={styles.meta}>
                  Kambarys: {item.residents?.room_number || '—'}
                </div>

                <div style={styles.meta}>
                  Būsena: {item.residents?.status || '—'}
                </div>

                <div style={styles.meta}>Priskirta: {formatDate(item.created_at)}</div>
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
    gap: 6,
  },
  cardTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 800,
  },
  meta: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: 600,
  },
}