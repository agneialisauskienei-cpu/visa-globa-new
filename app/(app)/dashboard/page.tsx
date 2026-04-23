'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Stats = {
  residents: number
  employees: number
  pending: number
  notifications: number
  rooms: number
}

export default function DashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>({
    residents: 0,
    employees: 0,
    pending: 0,
    notifications: 0,
    rooms: 0,
  })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace('/login')
        return
      }

      // 🔥 Vienas organization source
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!membership) {
        setError('Nerasta organizacija')
        return
      }

      const orgId = membership.organization_id

      const [
        residents,
        employees,
        pending,
        notifications,
        rooms,
      ] = await Promise.all([
        supabase
          .from('residents')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId),

        supabase
          .from('organization_members')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('is_active', true),

        supabase
          .from('organization_join_requests')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'pending'),

        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false),

        // ❌ BE occupancy_status
        supabase
          .from('rooms')
          .select('id')
          .eq('organization_id', orgId),
      ])

      setStats({
        residents: residents.count || 0,
        employees: employees.count || 0,
        pending: pending.count || 0,
        notifications: notifications.count || 0,
        rooms: rooms.data?.length || 0,
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 40 }}>Kraunama...</div>
  }

  if (error) {
    return <div style={{ padding: 40, color: 'red' }}>{error}</div>
  }

  return (
    <div style={styles.page}>
      <div style={styles.sidebar}>
        <h2>Dashboard</h2>

        <button onClick={() => router.push('/residents')}>Gyventojai</button>
        <button onClick={() => router.push('/team')}>Komanda</button>
        <button onClick={() => router.push('/rooms')}>Kambariai</button>
        <button onClick={() => router.push('/notifications')}>
          Pranešimai
        </button>
      </div>

      <div style={styles.content}>
        <h1>Admin Dashboard</h1>

        <div style={styles.grid}>
          <Card title="Gyventojai" value={stats.residents} />
          <Card title="Darbuotojai" value={stats.employees} />
          <Card title="Laukia patvirtinimo" value={stats.pending} />
          <Card title="Pranešimai" value={stats.notifications} />
          <Card title="Kambariai" value={stats.rooms} />
        </div>
      </div>
    </div>
  )
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div style={styles.card}>
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  )
}

const styles: any = {
  page: {
    display: 'flex',
    minHeight: '100vh',
  },
  sidebar: {
    width: 220,
    background: '#0f3d2e',
    color: 'white',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  content: {
    flex: 1,
    padding: 30,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 20,
    marginTop: 20,
  },
  card: {
    background: '#f5f5f5',
    padding: 20,
    borderRadius: 10,
  },
}