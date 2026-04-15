'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type MembershipRow = {
  organization_id: string
  role: 'owner' | 'admin' | 'employee'
}

type ProfileRow = {
  id: string
  email: string | null
  role: string | null
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  avatar_url?: string | null
}

type TeamStatRow = {
  user_id: string
  role: 'owner' | 'admin' | 'employee'
}

type ResidentStatRow = {
  id: string
}

type TaskStatRow = {
  id: string
  status: string | null
}

type InviteStatRow = {
  id: string
  status: string | null
}

function getReadableError(error: unknown) {
  if (!error) return 'Nežinoma klaida.'
  if (error instanceof Error) return error.message

  if (typeof error === 'object') {
    const maybe = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    if (maybe.message) return maybe.message
    if (maybe.details) return maybe.details
    if (maybe.hint) return maybe.hint
    if (maybe.code) return `Klaidos kodas: ${maybe.code}`
  }

  return 'Nepavyko įvykdyti veiksmo.'
}

function getDisplayName(profile: ProfileRow | null) {
  if (!profile) return 'Administratorius'

  const combined = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
  if (combined) return combined
  if (profile.full_name?.trim()) return profile.full_name.trim()
  return profile.email || 'Administratorius'
}

export default function AdminDashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'owner' | 'admin' | ''>('')
  const [organizationId, setOrganizationId] = useState('')
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [message, setMessage] = useState('')

  const [teamCount, setTeamCount] = useState(0)
  const [adminCount, setAdminCount] = useState(0)
  const [residentCount, setResidentCount] = useState(0)
  const [activeTaskCount, setActiveTaskCount] = useState(0)
  const [pendingInviteCount, setPendingInviteCount] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setMessage('')

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          router.replace('/login')
          return
        }

        setEmail(user.email || '')

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, role, first_name, last_name, full_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) throw profileError

        const typedProfile = (profileData as ProfileRow | null) || null
        setProfile(typedProfile)

        if (typedProfile?.role === 'super_admin') {
          router.replace('/admin')
          return
        }

        const { data: membershipData, error: membershipError } = await supabase
          .from('organization_members')
          .select('organization_id, role')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (membershipError) throw membershipError

        const typedMembership = (membershipData as MembershipRow | null) || null

        if (!typedMembership) {
          router.replace('/login')
          return
        }

        if (typedMembership.role === 'employee') {
          router.replace('/employee-dashboard')
          return
        }

        setRole(typedMembership.role)
        setOrganizationId(typedMembership.organization_id)

        const [
          teamResult,
          residentResult,
          taskResult,
          inviteResult,
        ] = await Promise.all([
          supabase
            .from('organization_members')
            .select('user_id, role')
            .eq('organization_id', typedMembership.organization_id),

          supabase
            .from('residents')
            .select('id')
            .eq('organization_id', typedMembership.organization_id),

          supabase
            .from('tasks')
            .select('id, status')
            .eq('organization_id', typedMembership.organization_id),

          supabase
            .from('organization_invites')
            .select('id, status')
            .eq('organization_id', typedMembership.organization_id),
        ])

        if (teamResult.error) throw teamResult.error
        if (residentResult.error) throw residentResult.error
        if (taskResult.error) throw taskResult.error

        const teamRows = (teamResult.data as TeamStatRow[]) || []
        const residentRows = (residentResult.data as ResidentStatRow[]) || []
        const taskRows = (taskResult.data as TaskStatRow[]) || []
        const inviteRows = ((inviteResult.data as InviteStatRow[]) || []).filter(Boolean)

        setTeamCount(teamRows.length)
        setAdminCount(
          teamRows.filter((item) => item.role === 'owner' || item.role === 'admin').length
        )
        setResidentCount(residentRows.length)
        setActiveTaskCount(taskRows.filter((item) => item.status !== 'done').length)
        setPendingInviteCount(inviteRows.filter((item) => item.status === 'pending').length)
      } catch (error) {
        setMessage(getReadableError(error))
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const roleLabel = useMemo(() => {
    if (role === 'owner') return 'Savininkas'
    if (role === 'admin') return 'Administratorius'
    return '—'
  }, [role])

  const displayName = getDisplayName(profile)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <div style={styles.loadingText}>Kraunamas administratoriaus skydelis...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowOne} />
      <div style={styles.backgroundGlowTwo} />

      <div style={styles.container}>
        <div style={styles.heroCard}>
          <div style={styles.heroTopRow}>
            <Link href="/dashboard" style={styles.backLink}>
              ← Atgal į nukreipimą
            </Link>

            <button onClick={handleLogout} style={styles.logoutButton}>
              Atsijungti
            </button>
          </div>

          <div style={styles.heroContent}>
            <div style={styles.avatarWrap}>
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profilio nuotrauka"
                  style={styles.avatar}
                />
              ) : (
                <div style={styles.avatarFallback}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div style={styles.heroTextWrap}>
              <div style={styles.rolePill}>{roleLabel}</div>

              <h1 style={styles.heroTitle}>Sveiki, {displayName}</h1>

              <p style={styles.heroSubtitle}>
                Čia gali valdyti darbuotojus, gyventojus, kambarius, sandėlį ir
                kitus įstaigos procesus.
              </p>

              <div style={styles.metaRow}>
                <MetaChip label="El. paštas" value={email || '—'} />
                <MetaChip label="Organizacija" value={organizationId || '—'} />
              </div>
            </div>
          </div>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        <div style={styles.statsGrid}>
          <StatCard
            title="Darbuotojai"
            value={String(teamCount)}
            subtitle="Visi organizacijos nariai"
          />
          <StatCard
            title="Admin / savininkai"
            value={String(adminCount)}
            subtitle="Valdymo teisę turintys nariai"
          />
          <StatCard
            title="Gyventojai"
            value={String(residentCount)}
            subtitle="Registruoti gyventojai"
          />
          <StatCard
            title="Aktyvios užduotys"
            value={String(activeTaskCount)}
            subtitle="Neužbaigtos užduotys"
          />
          <StatCard
            title="Laukiantys kvietimai"
            value={String(pendingInviteCount)}
            subtitle="Dar nepriimti kvietimai"
          />
        </div>

        <div style={styles.mainGrid}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Pagrindiniai valdymai</h2>
              <p style={styles.panelSubtitle}>
                Dažniausiai naudojami administravimo veiksmai.
              </p>
            </div>

            <div style={styles.actionsGrid}>
              <ActionCard
                title="Įstaigos profilis"
                description="Pavadinimas, kodas, adresas, logotipas ir kita pagrindinė informacija."
                href="/organization"
                accent="#334155"
              />
              <ActionCard
                title="Darbuotojai"
                description="Rolių valdymas, dokumentai, skyriai, pareigos ir darbuotojų informacija."
                href="/team"
                accent="#475569"
              />
              <ActionCard
                title="Gyventojai"
                description="Gyventojų kortelės, priskyrimai darbuotojams ir bendra priežiūros informacija."
                href="/residents"
                accent="#1d4ed8"
              />
              <ActionCard
                title="Kambariai"
                description="Kambarių sąrašas, užimtumas, paskirstymas ir su tuo susijusi tvarka."
                href="/rooms"
                accent="#2563eb"
              />
              <ActionCard
                title="Sandėlis"
                description="Priemonės, atsargos, inventorius ir jų sekimas."
                href="/inventory"
                accent="#0f766e"
              />
            </div>
          </section>

          <section style={styles.sideColumn}>
            <div style={styles.infoCard}>
              <h3 style={styles.infoTitle}>Greita santrauka</h3>

              <div style={styles.infoList}>
                <InfoLine label="Prisijungęs vartotojas" value={displayName} />
                <InfoLine label="Administravimo rolė" value={roleLabel} />
                <InfoLine label="El. paštas" value={email || '—'} />
                <InfoLine label="Organizacijos ID" value={organizationId || '—'} />
              </div>
            </div>

            <div style={styles.infoCard}>
              <h3 style={styles.infoTitle}>Tolimesni geri žingsniai</h3>

              <div style={styles.noteList}>
                <div style={styles.noteItem}>
                  Patikrink, ar darbuotojai nemato admin puslapių per tiesioginį URL.
                </div>
                <div style={styles.noteItem}>
                  Susiek užduotis su gyventojais ir darbuotojais, kad dashboard būtų naudingesnis.
                </div>
                <div style={styles.noteItem}>
                  Vėliau gali pridėti grafikų ir svarbių pranešimų korteles čia pat.
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
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

function MetaChip({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div style={styles.metaChip}>
      <span style={styles.metaChipLabel}>{label}</span>
      <span style={styles.metaChipValue}>{value}</span>
    </div>
  )
}

function InfoLine({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div style={styles.infoLine}>
      <span style={styles.infoLineLabel}>{label}</span>
      <span style={styles.infoLineValue}>{value}</span>
    </div>
  )
}

function ActionCard({
  title,
  description,
  href,
  accent,
}: {
  title: string
  description: string
  href: string
  accent: string
}) {
  return (
    <Link href={href} style={{ ...styles.actionCard, borderLeft: `5px solid ${accent}` }}>
      <div style={styles.actionTitle}>{title}</div>
      <div style={styles.actionDescription}>{description}</div>
      <div style={{ ...styles.actionLink, color: accent }}>Atidaryti →</div>
    </Link>
  )
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 40%, #eef2ff 100%)',
    position: 'relative',
    overflow: 'hidden',
    padding: 24,
  },
  backgroundGlowOne: {
    position: 'absolute',
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: '50%',
    background: 'rgba(59,130,246,0.12)',
    filter: 'blur(40px)',
    pointerEvents: 'none',
  },
  backgroundGlowTwo: {
    position: 'absolute',
    bottom: -140,
    left: -100,
    width: 340,
    height: 340,
    borderRadius: '50%',
    background: 'rgba(15,118,110,0.10)',
    filter: 'blur(45px)',
    pointerEvents: 'none',
  },
  container: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 1320,
    margin: '0 auto',
    display: 'grid',
    gap: 18,
  },
  loadingWrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 40%, #eef2ff 100%)',
    padding: 24,
  },
  loadingCard: {
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid #e2e8f0',
    borderRadius: 24,
    padding: '28px 32px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    boxShadow: '0 20px 50px rgba(15,23,42,0.08)',
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '3px solid #cbd5e1',
    borderTopColor: '#2563eb',
  },
  loadingText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: 700,
  },
  heroCard: {
    background: 'rgba(255,255,255,0.82)',
    border: '1px solid rgba(226,232,240,0.95)',
    borderRadius: 30,
    padding: 22,
    boxShadow: '0 24px 60px rgba(15,23,42,0.08)',
    backdropFilter: 'blur(12px)',
    display: 'grid',
    gap: 18,
  },
  heroTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  backLink: {
    textDecoration: 'none',
    color: '#0f172a',
    fontSize: 14,
    fontWeight: 800,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '10px 14px',
  },
  logoutButton: {
    border: 'none',
    borderRadius: 14,
    background: '#0f172a',
    color: '#fff',
    padding: '12px 16px',
    fontWeight: 800,
    cursor: 'pointer',
    fontSize: 14,
    boxShadow: '0 10px 24px rgba(15,23,42,0.18)',
  },
  heroContent: {
    display: 'flex',
    gap: 18,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  avatarWrap: {
    flexShrink: 0,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 24,
    objectFit: 'cover',
    border: '1px solid #dbeafe',
    boxShadow: '0 14px 30px rgba(37,99,235,0.12)',
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    color: '#1e3a8a',
    fontWeight: 900,
    fontSize: 34,
    border: '1px solid #bfdbfe',
    boxShadow: '0 14px 30px rgba(37,99,235,0.14)',
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 260,
    display: 'grid',
    gap: 10,
  },
  rolePill: {
    display: 'inline-flex',
    width: 'fit-content',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px',
    borderRadius: 999,
    background: '#e0f2fe',
    color: '#0369a1',
    fontWeight: 800,
    fontSize: 12,
    border: '1px solid #bae6fd',
  },
  heroTitle: {
    margin: 0,
    fontSize: 40,
    lineHeight: 1.05,
    fontWeight: 900,
    color: '#0f172a',
  },
  heroSubtitle: {
    margin: 0,
    color: '#64748b',
    fontSize: 16,
    lineHeight: 1.7,
    maxWidth: 760,
  },
  metaRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaChip: {
    display: 'grid',
    gap: 4,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    padding: '10px 12px',
    minWidth: 170,
  },
  metaChipLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 700,
  },
  metaChipValue: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: 800,
    wordBreak: 'break-all',
  },
  message: {
    padding: '14px 16px',
    borderRadius: 18,
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    color: '#9a3412',
    fontWeight: 700,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 14,
  },
  statCard: {
    background: 'rgba(255,255,255,0.88)',
    border: '1px solid #e2e8f0',
    borderRadius: 24,
    padding: 18,
    boxShadow: '0 16px 40px rgba(15,23,42,0.05)',
    display: 'grid',
    gap: 8,
  },
  statValue: {
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 900,
    color: '#0f172a',
  },
  statTitle: {
    color: '#0f172a',
    fontWeight: 800,
    fontSize: 15,
  },
  statSubtitle: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 600,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)',
    gap: 18,
  },
  panel: {
    background: 'rgba(255,255,255,0.88)',
    border: '1px solid #e2e8f0',
    borderRadius: 28,
    padding: 20,
    display: 'grid',
    gap: 18,
    boxShadow: '0 18px 44px rgba(15,23,42,0.05)',
  },
  panelHeader: {
    display: 'grid',
    gap: 6,
  },
  panelTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: 24,
    fontWeight: 900,
  },
  panelSubtitle: {
    margin: 0,
    color: '#64748b',
    fontSize: 15,
    lineHeight: 1.6,
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 14,
  },
  actionCard: {
    textDecoration: 'none',
    color: '#0f172a',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 22,
    padding: 18,
    display: 'grid',
    gap: 10,
    boxShadow: '0 12px 30px rgba(15,23,42,0.04)',
    transition: 'transform 0.15s ease',
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: '#0f172a',
  },
  actionDescription: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 1.65,
    fontWeight: 600,
  },
  actionLink: {
    fontWeight: 900,
    fontSize: 14,
  },
  sideColumn: {
    display: 'grid',
    gap: 18,
  },
  infoCard: {
    background: 'rgba(255,255,255,0.88)',
    border: '1px solid #e2e8f0',
    borderRadius: 24,
    padding: 18,
    display: 'grid',
    gap: 14,
    boxShadow: '0 18px 44px rgba(15,23,42,0.05)',
  },
  infoTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 900,
  },
  infoList: {
    display: 'grid',
    gap: 10,
  },
  infoLine: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: 10,
  },
  infoLineLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: 700,
  },
  infoLineValue: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: 800,
    textAlign: 'right',
    wordBreak: 'break-word',
  },
  noteList: {
    display: 'grid',
    gap: 10,
  },
  noteItem: {
    padding: 12,
    borderRadius: 16,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#475569',
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 600,
  },
}