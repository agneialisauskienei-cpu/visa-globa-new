'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentMembership, type CurrentMembership } from '@/lib/current-membership'
import { getReadableError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import MobileBottomNav from '@/components/mobile/MobileBottomNav'

type ProfileRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
}

type TrainingRow = {
  id: string
  title: string
  hours: number | null
  provider: string | null
  completed_at: string | null
  expires_at: string | null
  verified_by: string | null
}

type TaskRow = {
  id: string
  title: string
  status: string | null
  due_date: string | null
  priority: string | null
}

type ShiftRow = {
  id: string
  shift_date: string
  start_time: string | null
  end_time: string | null
  shift_type: string | null
  status: string | null
}

type NotificationCountRow = {
  id: string
}

function formatFullName(profile: ProfileRow | null) {
  const combined = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  if (combined) return combined
  if (profile?.full_name?.trim()) return profile.full_name.trim()
  return profile?.email || 'Darbuotojas'
}

function formatShiftTime(start: string | null, end: string | null) {
  const from = start?.slice(0, 5) || '--:--'
  const to = end?.slice(0, 5) || '--:--'
  return `${from}-${to}`
}

function daysUntil(value: string | null) {
  if (!value) return null
  const target = new Date(`${value}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function getDocumentStatus(value: string | null) {
  const diff = daysUntil(value)
  if (diff === null) return { label: 'Nenurodyta', tone: 'muted' as const }
  if (diff < 0) return { label: 'Pasibaigė', tone: 'danger' as const }
  if (diff <= 45) return { label: `Baigiasi už ${diff} d.`, tone: 'warn' as const }
  return { label: 'Galioja', tone: 'good' as const }
}

function getTrainingStatus(expiresAt: string | null) {
  const diff = daysUntil(expiresAt)
  if (expiresAt && diff !== null) {
    if (diff < 0) return { label: 'Pasibaigė', tone: 'danger' as const }
    if (diff <= 30) return { label: `Baigiasi už ${diff} d.`, tone: 'warn' as const }
  }
  return { label: 'Galioja', tone: 'good' as const }
}

function getToneStyle(tone: 'good' | 'warn' | 'danger' | 'muted'): React.CSSProperties {
  switch (tone) {
    case 'good':
      return { background: '#dcfce7', color: '#166534' }
    case 'warn':
      return { background: '#fef3c7', color: '#92400e' }
    case 'danger':
      return { background: '#fee2e2', color: '#b91c1c' }
    default:
      return { background: '#e2e8f0', color: '#475569' }
  }
}

export default function EmployeeDashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [membership, setMembership] = useState<CurrentMembership | null>(null)
  const [notificationsCount, setNotificationsCount] = useState(0)
  const [trainings, setTrainings] = useState<TrainingRow[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [shifts, setShifts] = useState<ShiftRow[]>([])

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

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, full_name')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) throw profileError
        setProfile((profileData as ProfileRow | null) || null)

        const currentMembership = await getCurrentMembership(user.id)

        if (!currentMembership) {
          router.replace(ROUTES.login)
          return
        }

        if (currentMembership.role === 'admin' || currentMembership.role === 'owner') {
          router.replace(ROUTES.adminDashboard)
          return
        }

        setMembership(currentMembership)

        const organizationId = currentMembership.organization_id

        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(today.getDate() + 14)

        const from = today.toISOString().slice(0, 10)
        const to = endDate.toISOString().slice(0, 10)

        const [notificationsResult, trainingsResult, tasksResult, shiftsResult] = await Promise.all([
          supabase.from('notifications').select('id').eq('user_id', user.id).eq('is_read', false),
          supabase
            .from('personnel_trainings')
            .select('id, title, hours, provider, completed_at, expires_at, verified_by')
            .eq('organization_id', organizationId)
            .eq('employee_id', user.id)
            .order('completed_at', { ascending: false }),
          supabase
            .from('employee_tasks')
            .select('id, title, status, due_date, priority')
            .eq('organization_id', organizationId)
            .eq('assigned_user_id', user.id)
            .neq('status', 'done')
            .neq('status', 'cancelled')
            .order('due_date', { ascending: true })
            .limit(4),
          supabase
            .from('work_shifts')
            .select('id, shift_date, start_time, end_time, shift_type, status')
            .eq('user_id', user.id)
            .gte('shift_date', from)
            .lte('shift_date', to)
            .order('shift_date', { ascending: true })
            .order('start_time', { ascending: true })
            .limit(4),
        ])

        if (notificationsResult.error) throw notificationsResult.error
        if (trainingsResult.error) throw trainingsResult.error
        if (tasksResult.error) throw tasksResult.error
        if (shiftsResult.error) throw shiftsResult.error

        setNotificationsCount(((notificationsResult.data as NotificationCountRow[]) || []).length)
        setTrainings((trainingsResult.data as TrainingRow[]) || [])
        setTasks((tasksResult.data as TaskRow[]) || [])
        setShifts((shiftsResult.data as ShiftRow[]) || [])
      } catch (error) {
        setMessage(getReadableError(error))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [router])

  const totalTrainingHours = useMemo(
    () => trainings.reduce((sum, item) => sum + Number(item.hours || 0), 0),
    [trainings]
  )

  const expiringTrainings = useMemo(
    () => trainings.filter((item) => {
      const diff = daysUntil(item.expires_at)
      return diff !== null && diff <= 30
    }).length,
    [trainings]
  )

  const healthStatus = getDocumentStatus(membership?.occupational_health_valid_until || null)
  const licenseStatus = getDocumentStatus(membership?.professional_license_valid_until || null)

  const quickLinks = [
    { label: 'Mano profilis', href: ROUTES.myProfile },
    { label: 'Mano grafikas', href: ROUTES.mySchedule },
    { label: 'Mano užduotys', href: ROUTES.myTasks },
    { label: 'Pranešimai', href: ROUTES.notifications },
  ]

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
        <section style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>Darbuotojo paskyra</div>
            <h1 style={styles.title}>Sveiki, {formatFullName(profile)}</h1>
            <p style={styles.subtitle}>
              Čia matai savo mokymus, dokumentų galiojimus, artimiausias pamainas ir atviras užduotis.
            </p>
          </div>

          <div style={styles.heroMeta}>
            <div style={styles.heroMetaItem}>
              <span style={styles.heroMetaLabel}>Pareigos</span>
              <strong>{membership?.position || 'Darbuotojas'}</strong>
            </div>
            <div style={styles.heroMetaItem}>
              <span style={styles.heroMetaLabel}>Skyrius</span>
              <strong>{membership?.department || '—'}</strong>
            </div>
          </div>
        </section>

        {message ? <div style={styles.message}>{message}</div> : null}

        <section style={styles.statsGrid}>
          <StatCard title="Mokymai" value={trainings.length} hint={`Sukaupta ${totalTrainingHours} val.`} />
          <StatCard title="Baigiasi mokymai" value={expiringTrainings} hint="Per artimiausias 30 d." warning={expiringTrainings > 0} />
          <StatCard title="Atviros užduotys" value={tasks.length} hint="Reikia tavo dėmesio" warning={tasks.length > 0} />
          <StatCard title="Neskaityti pranešimai" value={notificationsCount} hint="Nauji sistemos įvykiai" warning={notificationsCount > 0} />
        </section>

        <section style={styles.gridTwo}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Greiti veiksmai</h2>
            <div style={styles.quickLinks}>
              {quickLinks.map((item) => (
                <button key={item.href} type="button" style={styles.quickLink} onClick={() => router.push(item.href)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Dokumentų būsena</h2>
            <DocumentRow
              label="Sveikatos pažyma"
              value={formatDate(membership?.occupational_health_valid_until || null)}
              status={healthStatus.label}
              tone={healthStatus.tone}
            />
            <DocumentRow
              label="Profesinė licencija"
              value={formatDate(membership?.professional_license_valid_until || null)}
              status={licenseStatus.label}
              tone={licenseStatus.tone}
            />
            <DocumentRow
              label="Licencijos numeris"
              value={membership?.professional_license_number || '—'}
              status={membership?.professional_license_number ? 'Įvestas' : 'Trūksta'}
              tone={membership?.professional_license_number ? 'good' : 'warn'}
            />
          </div>
        </section>

        <section style={styles.gridTwo}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Mano mokymai</h2>
              <button type="button" style={styles.secondaryButton} onClick={() => router.push(ROUTES.myProfile)}>
                Visa informacija
              </button>
            </div>

            {trainings.length === 0 ? (
              <div style={styles.empty}>Mokymų įrašų dar nėra.</div>
            ) : (
              <div style={styles.trainingList}>
                {trainings.slice(0, 5).map((training) => {
                  const status = getTrainingStatus(training.expires_at)

                  return (
                    <article key={training.id} style={styles.trainingCard}>
                      <div style={styles.trainingTopRow}>
                        <h3 style={styles.trainingTitle}>{training.title}</h3>
                        <span style={{ ...styles.statusBadge, ...getToneStyle(status.tone) }}>{status.label}</span>
                      </div>
                      <div style={styles.trainingMeta}>Baigta: {formatDate(training.completed_at)}</div>
                      <div style={styles.trainingMeta}>Galioja iki: {formatDate(training.expires_at)}</div>
                      <div style={styles.trainingMeta}>Valandos: {training.hours || 0}</div>
                      <div style={styles.trainingMeta}>Patikrino: {training.verified_by || '—'}</div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Artimiausios pamainos</h2>
            {shifts.length === 0 ? (
              <div style={styles.empty}>Artimiausių pamainų nerasta.</div>
            ) : (
              <div style={styles.list}>
                {shifts.map((shift) => (
                  <div key={shift.id} style={styles.shiftCard}>
                    <div style={styles.shiftDate}>{formatDate(shift.shift_date)}</div>
                    <div style={styles.shiftMeta}>Laikas: {formatShiftTime(shift.start_time, shift.end_time)}</div>
                    <div style={styles.shiftMeta}>Tipas: {shift.shift_type || '—'}</div>
                    <div style={styles.shiftMeta}>Būsena: {shift.status || 'suplanuota'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Atviros užduotys</h2>
            <button type="button" style={styles.secondaryButton} onClick={() => router.push(ROUTES.myTasks)}>
              Atidaryti užduotis
            </button>
          </div>

          {tasks.length === 0 ? (
            <div style={styles.empty}>Šiuo metu atvirų užduočių nėra.</div>
          ) : (
            <div style={styles.taskList}>
              {tasks.map((task) => (
                <div key={task.id} style={styles.taskCard}>
                  <div style={styles.taskTitle}>{task.title}</div>
                  <div style={styles.taskMeta}>Terminas: {formatDate(task.due_date)}</div>
                  <div style={styles.taskMeta}>Prioritetas: {task.priority || '—'}</div>
                  <div style={styles.taskMeta}>Būsena: {task.status || 'new'}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <MobileBottomNav />
    </div>
  )
}

function StatCard({
  title,
  value,
  hint,
  warning,
}: {
  title: string
  value: number
  hint: string
  warning?: boolean
}) {
  return (
    <article style={warning ? styles.statCardWarn : styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statTitle}>{title}</div>
      <div style={styles.statHint}>{hint}</div>
    </article>
  )
}

function DocumentRow({
  label,
  value,
  status,
  tone,
}: {
  label: string
  value: string
  status: string
  tone: 'good' | 'warn' | 'danger' | 'muted'
}) {
  return (
    <div style={styles.infoRow}>
      <div>
        <div style={styles.infoLabel}>{label}</div>
        <div style={styles.infoValue}>{value}</div>
      </div>
      <span style={{ ...styles.statusBadge, ...getToneStyle(tone) }}>{status}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' },
  container: { width: '100%', maxWidth: 1120, margin: '0 auto', padding: '20px 16px 96px', boxSizing: 'border-box', display: 'grid', gap: 16 },
  loadingWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' },
  loadingText: { color: '#475569', fontSize: 18, fontWeight: 700 },
  hero: { background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)', color: '#ffffff', borderRadius: 28, padding: 24, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', boxShadow: '0 20px 50px rgba(15,118,110,0.18)' },
  eyebrow: { fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.8 },
  title: { margin: '8px 0 0', fontSize: 36, fontWeight: 900, letterSpacing: '-.04em' },
  subtitle: { margin: '10px 0 0', maxWidth: 680, color: 'rgba(255,255,255,0.88)', fontSize: 16, lineHeight: 1.5, fontWeight: 600 },
  heroMeta: { display: 'grid', gap: 10, minWidth: 220 },
  heroMetaItem: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 18, padding: 14, display: 'grid', gap: 4 },
  heroMetaLabel: { fontSize: 12, fontWeight: 800, opacity: 0.8, textTransform: 'uppercase' },
  message: { background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', padding: 14, borderRadius: 16, fontWeight: 700 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  statCard: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 22, padding: 18, display: 'grid', gap: 6, boxShadow: '0 10px 28px rgba(15,23,42,0.05)' },
  statCardWarn: { background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 22, padding: 18, display: 'grid', gap: 6, boxShadow: '0 10px 28px rgba(15,23,42,0.05)' },
  statValue: { fontSize: 34, fontWeight: 900, color: '#0f172a' },
  statTitle: { fontSize: 14, fontWeight: 800, color: '#0f172a' },
  statHint: { fontSize: 13, color: '#64748b', fontWeight: 600 },
  gridTwo: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 },
  card: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 18, display: 'grid', gap: 14, boxShadow: '0 12px 30px rgba(15,23,42,0.05)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  cardTitle: { margin: 0, color: '#0f172a', fontSize: 21, fontWeight: 900 },
  quickLinks: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 },
  quickLink: { border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', borderRadius: 16, padding: '14px 16px', fontWeight: 800, cursor: 'pointer', textAlign: 'left' },
  secondaryButton: { border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', borderRadius: 14, padding: '10px 14px', fontWeight: 800, cursor: 'pointer' },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' },
  infoLabel: { color: '#64748b', fontSize: 13, fontWeight: 800 },
  infoValue: { color: '#0f172a', fontSize: 15, fontWeight: 800, marginTop: 4 },
  statusBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' },
  trainingList: { display: 'grid', gap: 10 },
  trainingCard: { border: '1px solid #e2e8f0', borderRadius: 18, padding: 14, display: 'grid', gap: 6, background: '#f8fafc' },
  trainingTopRow: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  trainingTitle: { margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 900 },
  trainingMeta: { color: '#475569', fontSize: 13, fontWeight: 700 },
  list: { display: 'grid', gap: 10 },
  shiftCard: { border: '1px solid #e2e8f0', borderRadius: 18, padding: 14, display: 'grid', gap: 6, background: '#f8fafc' },
  shiftDate: { color: '#0f172a', fontWeight: 900, fontSize: 16 },
  shiftMeta: { color: '#475569', fontSize: 13, fontWeight: 700 },
  taskList: { display: 'grid', gap: 10 },
  taskCard: { border: '1px solid #e2e8f0', borderRadius: 18, padding: 14, display: 'grid', gap: 6, background: '#f8fafc' },
  taskTitle: { color: '#0f172a', fontSize: 15, fontWeight: 900 },
  taskMeta: { color: '#475569', fontSize: 13, fontWeight: 700 },
  empty: { border: '1px dashed #cbd5e1', borderRadius: 18, padding: 18, textAlign: 'center', color: '#64748b', background: '#f8fafc', fontWeight: 700 },
}
