'use client'

import { useEffect, useState } from 'react'
import { Building2, ClipboardList, UserRound, Users } from 'lucide-react'
import { getCurrentAccess, type SystemRole } from '@/lib/app-access'
import { supabase } from '@/lib/supabase'

type DashboardStats = {
  organizations: number
  residents: number
  employees: number
  requests: number
}

function getRoleLabel(role: SystemRole | null) {
  if (role === 'owner') return 'Super Admin'
  if (role === 'admin') return 'Administratorius'
  if (role === 'employee') return 'Darbuotojas'
  return 'Sistema'
}

async function safeCount(table: string) {
  try {
    const { count, error } = await supabase.from(table).select('*', {
      count: 'exact',
      head: true,
    })

    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<SystemRole | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    organizations: 0,
    residents: 0,
    employees: 0,
    requests: 0,
  })

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    try {
      setLoading(true)

      const access = await getCurrentAccess()
      setEmail(access.email || '')
      setRole(access.role)

      const [organizations, residents, employees, requests] = await Promise.all([
        safeCount('organizations'),
        safeCount('residents'),
        safeCount('organization_members'),
        safeCount('requests'),
      ])

      setStats({
        organizations,
        residents,
        employees,
        requests,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>VisaGloba valdymas</div>
          <h1 style={styles.title}>Pagrindinis skydelis</h1>
          <p style={styles.subtitle}>
            Greita sistemos apžvalga, aktyvūs skaičiai ir pagrindiniai valdymo veiksmai.
          </p>
        </div>

        <div style={styles.userBox}>
          <div style={styles.userLine}>
            <strong>Email:</strong> {email || '—'}
          </div>
          <div style={styles.userLine}>
            <strong>Rolė:</strong> {getRoleLabel(role)}
          </div>
        </div>
      </div>

      <section style={styles.statsGrid}>
        <StatCard icon={Building2} label="Įstaigos" value={stats.organizations} loading={loading} />
        <StatCard icon={UserRound} label="Gyventojai" value={stats.residents} loading={loading} />
        <StatCard icon={Users} label="Darbuotojai" value={stats.employees} loading={loading} />
        <StatCard icon={ClipboardList} label="Užklausos" value={stats.requests} loading={loading} />
      </section>

      <section style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Greiti veiksmai</h2>

          <div style={styles.actions}>
            <a href="/organizations" style={styles.actionButton}>Įstaigos</a>
            <a href="/residents" style={styles.actionButton}>Gyventojai</a>
            <a href="/employees" style={styles.actionButton}>Darbuotojai</a>
            <a href="/requests" style={styles.actionButton}>Užklausos</a>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Sistemos būsena</h2>

          <div style={styles.statusList}>
            <div style={styles.statusItem}>
              <span style={styles.statusDot} />
              Duomenų bazė prijungta
            </div>
            <div style={styles.statusItem}>
              <span style={styles.statusDot} />
              Serveriniai veiksmai aktyvūs
            </div>
            <div style={styles.statusItem}>
              <span style={styles.statusDot} />
              Audit log paruoštas
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  value: number
  loading: boolean
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>
        <Icon size={20} strokeWidth={2.2} />
      </div>

      <div>
        <div style={styles.statLabel}>{label}</div>
        <div style={styles.statValue}>{loading ? '...' : value}</div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'grid',
    gap: 22,
  },
  header: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 24,
    padding: 26,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 18,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    boxShadow: '0 18px 50px rgba(15, 23, 42, 0.04)',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: 800,
    color: '#047857',
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.05,
    fontWeight: 950,
    color: '#0f172a',
    letterSpacing: '-0.05em',
  },
  subtitle: {
    margin: '12px 0 0',
    maxWidth: 680,
    color: '#64748b',
    fontSize: 15,
    lineHeight: 1.55,
    fontWeight: 600,
  },
  userBox: {
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
    borderRadius: 18,
    padding: 16,
    minWidth: 260,
    display: 'grid',
    gap: 8,
  },
  userLine: {
    fontSize: 14,
    color: '#0f172a',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 14,
  },
  statCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 22,
    padding: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    boxShadow: '0 14px 38px rgba(15, 23, 42, 0.035)',
  },
  statIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    background: '#ecfdf5',
    color: '#047857',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: 800,
  },
  statValue: {
    marginTop: 4,
    fontSize: 28,
    color: '#0f172a',
    fontWeight: 950,
    lineHeight: 1,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 24,
    padding: 22,
    boxShadow: '0 16px 44px rgba(15, 23, 42, 0.035)',
  },
  cardTitle: {
    margin: 0,
    fontSize: 19,
    fontWeight: 900,
    color: '#0f172a',
  },
  actions: {
    marginTop: 16,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    padding: '11px 14px',
    borderRadius: 14,
    background: '#0f172a',
    color: '#ffffff',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 850,
  },
  statusList: {
    marginTop: 16,
    display: 'grid',
    gap: 12,
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 14,
    fontWeight: 700,
    color: '#334155',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: '#22c55e',
  },
}