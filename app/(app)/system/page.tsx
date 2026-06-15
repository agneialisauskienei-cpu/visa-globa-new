'use client'

import { useEffect, useState } from 'react'
import { getCurrentAccess, hasPermission } from '@/lib/app-access'
import { supabase } from '@/lib/supabase'

export default function SystemPage() {
  const [userId, setUserId] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [email, setEmail] = useState('')
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const load = async () => {
      const [access, authResult] = await Promise.all([
        getCurrentAccess(),
        supabase.auth.getUser(),
      ])
      const user = authResult.data.user

      if (!user || !hasPermission(access, 'system.super')) {
        setAllowed(false)
        return
      }

      setUserId(user.id)
      setEmail(user.email || '')
      setOrganizationId(access.organizationId || '')
      setAllowed(true)
    }

    void load()
  }, [])

  if (allowed === null) return <div style={styles.page}>Kraunama...</div>
  if (!allowed) return <div style={styles.page}>Neturite teisės peržiūrėti sistemos informacijos.</div>

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Techninė informacija</h1>

      <div style={styles.card}>
        <div>
          <strong>User ID:</strong> {userId || '—'}
        </div>
        <div>
          <strong>Email:</strong> {email || '—'}
        </div>
        <div>
          <strong>Organization ID:</strong> {organizationId || '—'}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    marginBottom: 20,
  },
  card: {
    background: '#fff',
    padding: 16,
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    display: 'grid',
    gap: 10,
  },
}
