'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import MobileBottomNav from '@/components/mobile/MobileBottomNav'
import { getCurrentMembership } from '@/lib/current-membership'
import { getReadableError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { useNotifications } from '@/components/providers/NotificationProvider'

type NotificationRow = {
  id: string
  title: string
  message: string | null
  type: string | null
  is_read: boolean | null
  created_at: string | null
}

export default function NotificationsPage() {
  const router = useRouter()
  const { unreadCount, refreshUnreadCount } = useNotifications()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<NotificationRow[]>([])

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
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

      const membership = await getCurrentMembership(user.id)

      if (membership?.role === 'owner' || membership?.role === 'admin') {
        router.replace(ROUTES.adminDashboard)
        return
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, type, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setItems((data as NotificationRow[]) || [])
      await refreshUnreadCount()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(id: string) {
    setMessage('')

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)

      if (error) throw error

      await loadData()
    } catch (error) {
      setMessage(getReadableError(error))
    }
  }

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
            <h1 style={styles.title}>Pranešimai</h1>
            <p style={styles.subtitle}>Neskaityti pranešimai: {unreadCount}</p>
          </div>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        {items.length === 0 ? (
          <div style={styles.emptyState}>Pranešimų nėra.</div>
        ) : (
          <div style={styles.list}>
            {items.map((item) => (
              <div key={item.id} style={styles.card}>
                <div style={styles.topRow}>
                  <h2 style={styles.cardTitle}>{item.title}</h2>
                  {!item.is_read ? <span style={styles.badge}>Nauja</span> : null}
                </div>

                <div style={styles.typeLine}>Tipas: {item.type || '—'}</div>
                <p style={styles.description}>{item.message || '—'}</p>
                <div style={styles.dateLine}>{formatDateTime(item.created_at)}</div>

                {!item.is_read ? (
                  <button onClick={() => void markAsRead(item.id)} style={styles.button}>
                    Pažymėti kaip skaitytą
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <MobileBottomNav />
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
    background: '#dbeafe',
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  typeLine: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: 600,
  },
  description: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.6,
    fontSize: 14,
  },
  dateLine: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: 600,
  },
  button: {
    border: 'none',
    borderRadius: 12,
    background: '#0f172a',
    color: '#fff',
    padding: '12px 14px',
    fontWeight: 700,
    cursor: 'pointer',
    width: 'fit-content',
  },
}