'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentMembership } from '@/lib/current-membership'
import { getReadableError } from '@/lib/errors'
import { ROUTES } from '@/lib/routes'

export default function AdminDashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setMessage('')

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError

        if (!user) {
          router.replace(ROUTES.login)
          return
        }

        setEmail(user.email || '')

        const membership = await getCurrentMembership(user.id)

        if (!membership) {
          router.replace(ROUTES.login)
          return
        }

        if (membership.role !== 'admin' && membership.role !== 'owner') {
          router.replace(ROUTES.employeeDashboard)
          return
        }

        setRole(membership.role)
      } catch (error) {
        setMessage(getReadableError(error))
      } finally {
        setLoading(false)
      }
    }

    void load()
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
      <div style={styles.card}>
        <h1 style={styles.title}>Admin dashboard</h1>

        <p style={styles.subtitle}>
          Dashboard duomenys kraunami pagal aktyvią organizaciją ir tavo rolę.
        </p>

        {message ? <div style={styles.message}>{message}</div> : null}

        <div style={styles.infoBox}>
          <div>
            <strong>Email:</strong> {email || '—'}
          </div>
          <div>
            <strong>Rolė:</strong> {role || '—'}
          </div>
        </div>

        <div style={styles.actions}>
          <button onClick={() => router.push('/residents')} style={styles.button}>
            Gyventojai
          </button>

          <button onClick={() => router.push('/team')} style={styles.button}>
            Darbuotojai
          </button>

          <button onClick={() => router.push('/rooms')} style={styles.button}>
            Kambariai
          </button>

          <button onClick={() => router.push('/medications')} style={styles.button}>
            Sveikatos įrašai
          </button>

          <button onClick={() => router.push('/inventory')} style={styles.button}>
            Sandėliai
          </button>

          <button onClick={() => router.push('/organization')} style={styles.button}>
            Įmonės info
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    display: 'flex',
    justifyContent: 'center',
  },
  loadingWrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 700,
  },
  card: {
    width: '100%',
    maxWidth: 900,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 20,
    padding: 24,
    display: 'grid',
    gap: 20,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    color: '#6b7280',
  },
  message: {
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    color: '#9a3412',
    padding: 14,
    borderRadius: 14,
    fontWeight: 700,
  },
  infoBox: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 12,
    display: 'grid',
    gap: 6,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    background: '#111827',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
}