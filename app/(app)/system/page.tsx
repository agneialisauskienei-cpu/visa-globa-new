'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

export default function SystemPage() {
  const [userId, setUserId] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      setUserId(user.id)
      setEmail(user.email || '')

      const activeOrganizationId = await getCurrentOrganizationId()

      if (activeOrganizationId) {
        setOrganizationId(activeOrganizationId)
      } else {
        setOrganizationId('')
      }
    }

    void load()
  }, [])

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