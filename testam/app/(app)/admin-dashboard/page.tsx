'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type DashboardStats = {
  residentsCount: number
  employeesCount: number
  pendingApprovalsCount: number
  unreadNotificationsCount: number
  roomsCount: number
  occupiedRoomsCount: number
}

type NotificationRow = {
  id: string
  title: string
  message: string | null
  created_at: string | null
  is_read: boolean | null
}

type PendingJoinRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  created_at: string | null
}

type MembershipRow = {
  organization_id: string
  role: 'owner' | 'admin' | 'employee'
}

type ProfileRow = {
  first_name: string | null
  last_name: string | null
  full_name: string | null
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

function formatDateTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('lt-LT')
}

function getDisplayName(profile: ProfileRow | null) {
  if (!profile) return 'Administratorius'
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
  return full || profile.full_name || 'Administratorius'
}

function getPendingName(item: PendingJoinRow) {
  return [item.first_name, item.last_name].filter(Boolean).join(' ').trim() || 'Nenurodytas vardas'
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [displayName, setDisplayName] = useState('Administratorius')

  const [stats, setStats] = useState<DashboardStats>({
    residentsCount: 0,
    employeesCount: 0,
    pendingApprovalsCount: 0,
    unreadNotificationsCount: 0,
    roomsCount: 0,
    occupiedRoomsCount: 0,
  })

  const [latestNotifications, setLatestNotifications] = useState<NotificationRow[]>([])
  const [pendingRequests, setPendingRequests] = useState<PendingJoinRow[]>([])

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
        setMessage('Reikia prisijungti.')
        setLoading(false)
        return
      }

      const { data: membershipData, error: membershipError } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (membershipError) throw membershipError

      const membership = (membershipData || null) as MembershipRow | null

      if (!membership) {
        setMessage('Nepavyko nustatyti organizacijos.')
        setLoading(false)
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('first_name, last_name, full_name')
        .eq('id', user.id)
        .maybeSingle()

      setDisplayName(getDisplayName((profileData || null) as ProfileRow | null))

      const [
        residentsRes,
        employeesRes,
        pendingRes,
        notificationsCountRes,
        notificationsRes,
        roomsRes,
      ] = await Promise.all([
        supabase
          .from('residents')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', membership.organization_id),

        supabase
          .from('organization_members')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', membership.organization_id)
          .eq('is_active', true),

        supabase
          .from('organization_join_requests')
          .select('id, first_name, last_name, email, created_at', { count: 'exact' })
          .eq('organization_id', membership.organization_id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(4),

        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false),

        supabase
          .from('notifications')
          .select('id, title, message, created_at, is_read')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(4),

        supabase
          .from('rooms')
          .select('id, occupancy_status')
          .eq('organization_id', membership.organization_id),
      ])

      if (residentsRes.error) throw residentsRes.error
      if (employeesRes.error) throw employeesRes.error
      if (pendingRes.error) throw pendingRes.error
      if (notificationsCountRes.error) throw notificationsCountRes.error
      if (notificationsRes.error) throw notificationsRes.error
      if (roomsRes.error) throw roomsRes.error

      const rooms = roomsRes.data || []
      const occupiedRoomsCount = rooms.filter(
        (room) =>
          room.occupancy_status === 'occupied' ||
          room.occupancy_status === 'pilnas' ||
          room.occupancy_status === 'uzimtas'
      ).length

      setStats({
        residentsCount: residentsRes.count || 0,
        employeesCount: employeesRes.count || 0,
        pendingApprovalsCount: pendingRes.count || 0,
        unreadNotificationsCount: notificationsCountRes.count || 0,
        roomsCount: rooms.length,
        occupiedRoomsCount,
      })

      setLatestNotifications((notificationsRes.data || []) as NotificationRow[])
      setPendingRequests((pendingRes.data || []) as PendingJoinRow[])
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingCard}>Kraunama administratoriaus aplinka...</div>
      </div>
    )
  }

  return (
    <main style={styles.page}>
      <section style={styles.heroCard}>
        <div style={styles.heroBadge}>Administravimo zona</div>
        <h1 style={styles.heroTitle}>Sveiki, {displayName}</h1>
        <p style={styles.heroSubtitle}>
          Čia matai svarbiausią organizacijos būseną, laukiančius patvirtinimus ir naujausius pranešimus.
        </p>
      </section>

      {message ? <div style={styles.message}>{message}</div> : null}

      <div style={styles.statsGrid}>
        <StatCard title="Gyventojai" value={String(stats.residentsCount)} subtitle="Aktyvūs gyventojai" />
        <StatCard title="Darbuotojai" value={String(stats.employeesCount)} subtitle="Aktyvūs komandos nariai" />
        <StatCard title="Laukia patvirtinimo" value={String(stats.pendingApprovalsCount)} subtitle="Naujos registracijos" />
        <StatCard title="Neperžiūrėti pranešimai" value={String(stats.unreadNotificationsCount)} subtitle="Svarbūs sistemos pranešimai" />
      </div>

      <section style={styles.mainGrid}>
        <div style={styles.mainColumn}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Svarbiausia šiandien</h2>
              <p style={styles.panelSubtitle}>Trumpa organizacijos santrauka vietoj dubliuojančių nuorodų.</p>
            </div>

            <div style={styles.focusGrid}>
              <FocusCard
                title="Kambariai"
                value={`${stats.occupiedRoomsCount} / ${stats.roomsCount}`}
                note="Užimti ir visi kambariai"
              />
              <FocusCard
                title="Patvirtinimai"
                value={String(stats.pendingApprovalsCount)}
                note="Darbuotojai, kurie laukia patvirtinimo"
              />
              <FocusCard
                title="Pranešimai"
                value={String(stats.unreadNotificationsCount)}
                note="Neperskaityti administratoriaus pranešimai"
              />
              <FocusCard
                title="Komanda"
                value={String(stats.employeesCount)}
                note="Aktyvūs organizacijos nariai"
              />
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Laukiantys darbuotojai</h2>
              <p style={styles.panelSubtitle}>Naujausi registracijos prašymai su įstaigos kodu.</p>
            </div>

            <div style={styles.list}>
              {pendingRequests.length === 0 ? (
                <div style={styles.emptyState}>Šiuo metu laukiančių darbuotojų nėra.</div>
              ) : (
                pendingRequests.map((item) => (
                  <div key={item.id} style={styles.listCard}>
                    <div>
                      <div style={styles.listTitle}>{getPendingName(item)}</div>
                      <div style={styles.listText}>{item.email || 'Be el. pašto'}</div>
                    </div>
                    <div style={styles.listMeta}>{formatDateTime(item.created_at)}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside style={styles.sideColumn}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Paskutiniai pranešimai</h2>
            </div>

            <div style={styles.noticeList}>
              {latestNotifications.length === 0 ? (
                <div style={styles.emptyState}>Pranešimų dar nėra.</div>
              ) : (
                latestNotifications.map((item) => (
                  <div key={item.id} style={styles.noticeCard}>
                    <div style={styles.noticeTitle}>{item.title}</div>
                    <div style={styles.noticeText}>{item.message || '—'}</div>
                    <div style={styles.noticeTime}>{formatDateTime(item.created_at)}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Administratoriaus fokusas</h2>
            </div>

            <div style={styles.todoList}>
              <TodoCard title="Peržiūrėti naujas registracijas" when="Dabar" />
              <TodoCard title="Patikrinti pranešimus" when="Šiandien" />
              <TodoCard title="Peržiūrėti kambarių užimtumą" when="Kasdien" />
            </div>
          </section>
        </aside>
      </section>
    </main>
  )
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string
  value: string
  subtitle: string
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statTitle}>{title}</div>
      <div style={styles.statSubtitle}>{subtitle}</div>
    </div>
  )
}

function FocusCard({
  title,
  value,
  note,
}: {
  title: string
  value: string
  note: string
}) {
  return (
    <div style={styles.focusCard}>
      <div style={styles.focusValue}>{value}</div>
      <div style={styles.focusTitle}>{title}</div>
      <div style={styles.focusNote}>{note}</div>
    </div>
  )
}

function TodoCard({ title, when }: { title: string; when: string }) {
  return (
    <div style={styles.todoCard}>
      <div>
        <div style={styles.todoTitle}>{title}</div>
        <div style={styles.todoText}>Administracinis veiksmas</div>
      </div>
      <div style={styles.todoWhen}>{when}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'grid',
    gap: 18,
    padding: 8,
    background: '#ffffff',
  },
  loadingWrap: {
    minHeight: '70vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#ffffff',
  },
  loadingCard: {
    background: '#fff',
    border: '1px solid #dde5de',
    borderRadius: 24,
    padding: '26px 30px',
    fontSize: 16,
    fontWeight: 800,
    color: '#223128',
  },
  heroCard: {
    borderRadius: 30,
    border: '1px solid #dce5dd',
    background: '#eef4ef',
    padding: 28,
  },
  heroBadge: {
    display: 'inline-flex',
    padding: '7px 12px',
    borderRadius: 999,
    background: '#2f5a3a',
    color: '#fff',
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 14,
  },
  heroTitle: {
    margin: 0,
    fontSize: 44,
    fontWeight: 900,
    lineHeight: 1.05,
    color: '#173120',
  },
  heroSubtitle: {
    margin: '12px 0 0',
    color: '#64756a',
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.6,
    maxWidth: 860,
  },
  message: {
    padding: '12px 14px',
    borderRadius: 14,
    background: '#fff8f6',
    border: '1px solid #f1d0c2',
    color: '#9a3412',
    fontWeight: 700,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 14,
  },
  statCard: {
    background: '#fff',
    border: '1px solid #dde5de',
    borderRadius: 24,
    padding: 22,
    boxShadow: '0 10px 28px rgba(48,68,55,0.05)',
  },
  statValue: {
    fontSize: 42,
    fontWeight: 900,
    lineHeight: 1,
    color: '#162d1d',
  },
  statTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 900,
    color: '#24322a',
  },
  statSubtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: 700,
    color: '#6b7c71',
    lineHeight: 1.5,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(360px, 0.8fr)',
    gap: 24,
    alignItems: 'start',
  },
  mainColumn: {
    display: 'grid',
    gap: 24,
  },
  sideColumn: {
    display: 'grid',
    gap: 24,
  },
  panel: {
    borderRadius: 28,
    border: '1px solid #dde5de',
    background: '#fff',
    padding: 24,
    boxShadow: '0 10px 28px rgba(48,68,55,0.05)',
  },
  panelHeader: {
    marginBottom: 18,
  },
  panelTitle: {
    margin: 0,
    fontSize: 30,
    fontWeight: 900,
    color: '#162d1d',
  },
  panelSubtitle: {
    margin: '10px 0 0',
    fontSize: 16,
    fontWeight: 700,
    color: '#718277',
    lineHeight: 1.6,
  },
  focusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 14,
  },
  focusCard: {
    borderRadius: 24,
    border: '1px solid #dde5de',
    background: '#fcfdfc',
    padding: 18,
  },
  focusValue: {
    fontSize: 32,
    fontWeight: 900,
    color: '#2f5a3a',
    lineHeight: 1,
  },
  focusTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 900,
    color: '#203229',
  },
  focusNote: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.6,
    color: '#6a7b70',
    fontWeight: 700,
  },
  list: {
    display: 'grid',
    gap: 12,
  },
  listCard: {
    borderRadius: 20,
    border: '1px solid #e3ebe4',
    background: '#fafcfb',
    padding: 16,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  listTitle: {
    fontSize: 17,
    fontWeight: 900,
    color: '#1f3128',
  },
  listText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: 700,
    color: '#607066',
    lineHeight: 1.6,
  },
  listMeta: {
    fontSize: 12,
    fontWeight: 800,
    color: '#809086',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  noticeList: {
    display: 'grid',
    gap: 12,
  },
  noticeCard: {
    borderRadius: 20,
    border: '1px solid #e3ebe4',
    background: '#fafcfb',
    padding: 16,
  },
  noticeTitle: {
    fontSize: 17,
    fontWeight: 900,
    color: '#1f3128',
  },
  noticeText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: 700,
    color: '#607066',
    lineHeight: 1.6,
  },
  noticeTime: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: 800,
    color: '#809086',
  },
  todoList: {
    display: 'grid',
    gap: 12,
  },
  todoCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderRadius: 20,
    border: '1px solid #e3ebe4',
    background: '#fafcfb',
    padding: 16,
  },
  todoTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: '#1f3128',
  },
  todoText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: 700,
    color: '#6c7c72',
  },
  todoWhen: {
    borderRadius: 999,
    background: '#eef4ef',
    padding: '8px 12px',
    color: '#4d6c56',
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  emptyState: {
    border: '1px dashed #d8e1d8',
    borderRadius: 20,
    padding: 20,
    textAlign: 'center',
    color: '#64756b',
    background: '#fff',
    fontWeight: 700,
  },
}