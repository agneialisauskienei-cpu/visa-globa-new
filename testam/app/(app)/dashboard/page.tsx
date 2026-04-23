'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

type Role = 'owner' | 'admin' | 'employee'

type Room = {
  id: string
  name: string
  capacity: number
  is_active: boolean | null
}

type Resident = {
  id: string
  current_status: string | null
  current_room_id: string | null
  assigned_to?: string | null
  created_by?: string | null
}

type Task = {
  id: string
  assigned_user_id: string | null
  status: string | null
  due_date: string | null
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [rooms, setRooms] = useState<Room[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setMessage('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setMessage('Nepavyko nustatyti naudotojo.')
        setLoading(false)
        return
      }

      setCurrentUserId(user.id)

      const organizationId = await getCurrentOrganizationId()
      if (!organizationId) {
        setMessage('Nepavyko nustatyti organizacijos.')
        setLoading(false)
        return
      }

      const { data: membershipData, error: membershipError } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (membershipError) throw membershipError

      const myRole = (membershipData?.role || 'employee') as Role
      setRole(myRole)

      const [roomsResult, residentsResult, tasksResult] = await Promise.all([
        supabase
          .from('rooms')
          .select('id, name, capacity, is_active')
          .eq('organization_id', organizationId),
        supabase
          .from('residents')
          .select('id, current_status, current_room_id, assigned_to, created_by')
          .eq('organization_id', organizationId),
        supabase
          .from('employee_tasks')
          .select('id, assigned_user_id, status, due_date')
          .eq('organization_id', organizationId),
      ])

      if (roomsResult.error) throw roomsResult.error
      if (residentsResult.error) throw residentsResult.error
      if (tasksResult.error) throw tasksResult.error

      let residentsData = (residentsResult.data || []) as Resident[]
      let tasksData = (tasksResult.data || []) as Task[]

      if (!(myRole === 'owner' || myRole === 'admin')) {
        residentsData = residentsData.filter(
          (resident) => resident.assigned_to === user.id || resident.created_by === user.id
        )
        tasksData = tasksData.filter((task) => task.assigned_user_id === user.id)
      }

      setRooms((roomsResult.data || []) as Room[])
      setResidents(residentsData)
      setTasks(tasksData)
    } catch (error: any) {
      setMessage(error?.message || 'Nepavyko įkelti dashboard.')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const totalResidents = residents.length
    const activeResidents = residents.filter((r) => r.current_status === 'gyvena').length
    const reservedResidents = residents.filter((r) => r.current_status === 'rezervuotas').length
    const hospitalResidents = residents.filter((r) => r.current_status === 'ligonineje').length

    const activeRooms = rooms.filter((room) => room.is_active !== false)
    const totalCapacity = activeRooms.reduce((sum, room) => sum + (room.capacity || 0), 0)

    const occupiedCount = residents.filter((resident) =>
      ['rezervuotas', 'gyvena', 'ligonineje', 'laikinai_isvykes'].includes(
        resident.current_status || ''
      )
    ).length

    const freePlaces = Math.max(totalCapacity - occupiedCount, 0)

    const openTasks = tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled').length

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const overdueTasks = tasks.filter((task) => {
      if (!task.due_date) return false
      const due = new Date(task.due_date)
      due.setHours(0, 0, 0, 0)
      return due < today && task.status !== 'done' && task.status !== 'cancelled'
    }).length

    return {
      totalResidents,
      activeResidents,
      reservedResidents,
      hospitalResidents,
      totalRooms: activeRooms.length,
      freePlaces,
      openTasks,
      overdueTasks,
    }
  }, [rooms, residents, tasks])

  return (
    <div style={styles.outer}>
      <div style={styles.page}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Dashboard</h1>
            <p style={styles.subtitle}>
              {role === 'owner' || role === 'admin'
                ? 'Bendras organizacijos vaizdas.'
                : 'Tavo gyventojai ir tavo darbai vienoje vietoje.'}
            </p>
          </div>

          <button onClick={loadData} style={styles.secondaryButton}>
            Atnaujinti
          </button>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        <div style={styles.statsRow}>
          <StatCard label="Gyventojai" value={String(stats.totalResidents)} />
          <StatCard label="Gyvena" value={String(stats.activeResidents)} />
          <StatCard label="Rezervuoti" value={String(stats.reservedResidents)} />
          <StatCard label="Ligoninėje" value={String(stats.hospitalResidents)} />
          <StatCard label="Laisvos vietos" value={String(stats.freePlaces)} />
          <StatCard label="Atviros užduotys" value={String(stats.openTasks)} />
        </div>

        <div style={styles.grid}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Greiti veiksmai</h2>
            <div style={styles.linksGrid}>
              <Link href="/residents" style={styles.actionLink}>
                Gyventojai
              </Link>
              <Link href="/rooms" style={styles.actionLink}>
                Kambariai
              </Link>
              <Link href="/employees" style={styles.actionLink}>
                Darbuotojai
              </Link>
              <Link href="/employee-tasks" style={styles.actionLink}>
                Užduotys
              </Link>
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Greiti filtrai</h2>
            <div style={styles.linksGrid}>
              <Link href="/residents?filter=all" style={styles.actionLink}>
                Visi gyventojai
              </Link>
              <Link href="/residents?filter=active" style={styles.actionLink}>
                Gyvena
              </Link>
              <Link href="/residents?filter=reserved" style={styles.actionLink}>
                Netrukus atvyks
              </Link>
              <Link href="/residents?filter=hospital" style={styles.actionLink}>
                Ligoninėje
              </Link>
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Trumpa suvestinė</h2>
            {loading ? (
              <div style={styles.muted}>Kraunama...</div>
            ) : (
              <div style={styles.summaryList}>
                <div style={styles.summaryRow}>
                  <span>Aktyvūs kambariai</span>
                  <strong>{stats.totalRooms}</strong>
                </div>
                <div style={styles.summaryRow}>
                  <span>Pradelstos užduotys</span>
                  <strong>{stats.overdueTasks}</strong>
                </div>
                <div style={styles.summaryRow}>
                  <span>Prisijungęs vartotojas</span>
                  <strong>{currentUserId ? 'Taip' : 'Ne'}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  outer: {
    width: '100%',
    padding: '20px 24px 40px',
    background: '#f8fafc',
    minHeight: '100vh',
  },
  page: {
    width: '100%',
    maxWidth: 1700,
    margin: '0 auto',
    display: 'grid',
    gap: 18,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: 40,
    fontWeight: 800,
    lineHeight: 1.1,
    color: '#0f172a',
  },
  subtitle: {
    margin: '10px 0 0',
    color: '#6b7280',
    fontSize: 17,
  },
  message: {
    padding: '12px 14px',
    borderRadius: 14,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
    gap: 12,
  },
  statCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 18,
    padding: 16,
    minHeight: 110,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 800,
    marginBottom: 8,
    lineHeight: 1,
    color: '#0f172a',
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: 600,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 16,
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 22,
    padding: 20,
    display: 'grid',
    gap: 16,
  },
  cardTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
  },
  linksGrid: {
    display: 'grid',
    gap: 10,
  },
  actionLink: {
    textDecoration: 'none',
    color: '#111827',
    fontWeight: 700,
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
  },
  summaryList: {
    display: 'grid',
    gap: 12,
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 10,
    borderBottom: '1px solid #f1f5f9',
    color: '#374151',
  },
  muted: {
    color: '#6b7280',
  },
  secondaryButton: {
    border: '1px solid #d1d5db',
    borderRadius: 12,
    padding: '12px 16px',
    background: '#fff',
    color: '#111827',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
}