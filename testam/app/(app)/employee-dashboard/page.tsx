'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import MobileBottomNav from '@/components/mobile/MobileBottomNav'

type SystemRole = 'owner' | 'admin' | 'employee'
type StaffType =
  | 'care_worker'
  | 'nursing_staff'
  | 'kitchen'
  | 'reception'
  | 'administration'
  | null

type MembershipRow = {
  organization_id: string
  role: SystemRole
  staff_type: StaffType
  position: string | null
  department: string | null
}

type ProfileRow = {
  first_name: string | null
  last_name: string | null
  full_name: string | null
  email: string | null
}

type DashboardStats = {
  residentsCount: number
  tasksCount: number
  medicationsToday: number
  lowStockCount: number
  activeAssignmentsCount: number
}

type QuickLink = {
  href: string
  title: string
  description: string
  accent: string
}

export default function EmployeeDashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [message, setMessage] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [myRole, setMyRole] = useState<SystemRole | ''>('')
  const [myStaffType, setMyStaffType] = useState<StaffType>(null)
  const [myPosition, setMyPosition] = useState<string | null>(null)
  const [myDepartment, setMyDepartment] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('Darbuotojas')
  const [email, setEmail] = useState<string | null>(null)

  const [stats, setStats] = useState<DashboardStats>({
    residentsCount: 0,
    tasksCount: 0,
    medicationsToday: 0,
    lowStockCount: 0,
    activeAssignmentsCount: 0,
  })

  useEffect(() => {
    const updateViewport = () => {
      setIsMobile(window.innerWidth <= 900)
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)

    return () => window.removeEventListener('resize', updateViewport)
  }, [])

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
        router.push('/login')
        return
      }

      setCurrentUserId(user.id)

      const { data: membershipData, error: membershipError } = await supabase
        .from('organization_members')
        .select('organization_id, role, staff_type, position, department')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)

      if (membershipError || !membershipData || membershipData.length === 0) {
        setMessage('Nepavyko nustatyti tavo organizacijos.')
        setLoading(false)
        return
      }

      const membership = membershipData[0] as MembershipRow

      setOrganizationId(membership.organization_id)
      setMyRole(membership.role)
      setMyStaffType(membership.staff_type)
      setMyPosition(membership.position)
      setMyDepartment(membership.department)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('first_name, last_name, full_name, email')
        .eq('id', user.id)
        .maybeSingle()

      const profile = (profileData || null) as ProfileRow | null
      const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()

      setDisplayName(full || profile?.full_name || profile?.email || 'Darbuotojas')
      setEmail(profile?.email || user.email || null)

      const orgId = membership.organization_id

      const [
        residentsCount,
        medicationsToday,
        lowStockCount,
        activeAssignmentsCount,
      ] = await Promise.all([
        getResidentsCountForUser(orgId, user.id, membership.role, membership.staff_type),
        getMedicationsTodayCount(orgId, user.id, membership.role, membership.staff_type),
        getLowStockCount(orgId),
        getAssignmentsCount(orgId, user.id, membership.role, membership.staff_type),
      ])

      setStats({
        residentsCount,
        tasksCount: residentsCount,
        medicationsToday,
        lowStockCount,
        activeAssignmentsCount,
      })
    } catch (error: any) {
      setMessage(error?.message || 'Nepavyko įkelti darbuotojo dashboard.')
    } finally {
      setLoading(false)
    }
  }

  async function getResidentsCountForUser(
    orgId: string,
    userId: string,
    role: SystemRole,
    staffType: StaffType
  ) {
    if (role === 'owner' || role === 'admin' || staffType === 'nursing_staff') {
      const { count } = await supabase
        .from('residents')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)

      return count || 0
    }

    if (staffType === 'care_worker') {
      const { data, error } = await supabase
        .from('resident_assignments')
        .select('resident_id')
        .eq('organization_id', orgId)
        .eq('employee_user_id', userId)

      if (error || !data) return 0
      return data.length
    }

    if (staffType === 'kitchen' || staffType === 'reception') {
      const { count } = await supabase
        .from('residents')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('current_status', ['gyvena', 'ligonineje', 'laikinai_isvykes', 'rezervuotas'])

      return count || 0
    }

    return 0
  }

  async function getAssignmentsCount(
    orgId: string,
    userId: string,
    role: SystemRole,
    staffType: StaffType
  ) {
    if (role === 'owner' || role === 'admin' || staffType === 'nursing_staff') {
      return 0
    }

    if (staffType === 'care_worker') {
      const { data, error } = await supabase
        .from('resident_assignments')
        .select('id')
        .eq('organization_id', orgId)
        .eq('employee_user_id', userId)

      if (error || !data) return 0
      return data.length
    }

    return 0
  }

  async function getMedicationsTodayCount(
    orgId: string,
    userId: string,
    role: SystemRole,
    staffType: StaffType
  ) {
    const start = new Date()
    start.setHours(0, 0, 0, 0)

    let allowedResidentIds: string[] | null = null

    if (role !== 'owner' && role !== 'admin' && staffType === 'care_worker') {
      const { data: assignments } = await supabase
        .from('resident_assignments')
        .select('resident_id')
        .eq('organization_id', orgId)
        .eq('employee_user_id', userId)

      allowedResidentIds = (assignments || []).map((item) => item.resident_id)
      if (allowedResidentIds.length === 0) return 0
    }

    let query = supabase
      .from('medication_logs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('taken_at', start.toISOString())

    if (allowedResidentIds) {
      query = query.in('resident_id', allowedResidentIds)
    }

    const { count } = await query
    return count || 0
  }

  async function getLowStockCount(orgId: string) {
    const { data } = await supabase
      .from('inventory_items')
      .select('quantity, min_quantity')
      .eq('organization_id', orgId)

    if (!data) return 0

    return data.filter((item) => {
      const quantity = Number(item.quantity || 0)
      const minQuantity =
        item.min_quantity === null || item.min_quantity === undefined
          ? null
          : Number(item.min_quantity)

      return minQuantity !== null && quantity > 0 && quantity <= minQuantity
    }).length
  }

  async function handleSignOut() {
    setSigningOut(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push('/login')
      router.refresh()
    } catch (error: any) {
      setMessage(error?.message || 'Nepavyko atsijungti.')
      setSigningOut(false)
    }
  }

  const quickLinks = useMemo<QuickLink[]>(() => {
    const common: QuickLink[] = [
      {
        href: '/my-schedule',
        title: 'Mano grafikas',
        description: 'Peržiūrėti savo darbo grafiką',
        accent: '#2563eb',
      },
      {
        href: '/my-tasks',
        title: 'Mano užduotys',
        description: 'Dienos darbai, pastabos ir sekimas',
        accent: '#7c3aed',
      },
    ]

    if (myRole === 'owner' || myRole === 'admin') {
      return [
        {
          href: '/residents',
          title: 'Gyventojai',
          description: 'Pilnas gyventojų sąrašas ir valdymas',
          accent: '#2563eb',
        },
        {
          href: '/team',
          title: 'Darbuotojai',
          description: 'Vartotojai, rolės ir dokumentai',
          accent: '#0f172a',
        },
        {
          href: '/inventory',
          title: 'Sandėlis',
          description: 'Likučiai, kategorijos ir istorija',
          accent: '#059669',
        },
        {
          href: '/medications',
          title: 'Vaistai',
          description: 'Vaistų davimo įrašai',
          accent: '#dc2626',
        },
        ...common,
      ]
    }

    if (myStaffType === 'nursing_staff') {
      return [
        {
          href: '/residents',
          title: 'Gyventojai',
          description: 'Peržiūrėti gyventojus ir jų būseną',
          accent: '#2563eb',
        },
        {
          href: '/medications',
          title: 'Vaistai',
          description: 'Registruoti ir tikrinti vaistų davimą',
          accent: '#dc2626',
        },
        {
          href: '/inventory/medication',
          title: 'Vaistų sandėlis',
          description: 'Peržiūrėti vaistų likučius',
          accent: '#059669',
        },
        ...common,
      ]
    }

    if (myStaffType === 'care_worker') {
      return [
        {
          href: '/residents',
          title: 'Mano gyventojai',
          description: 'Tik tau priskirtų gyventojų sąrašas',
          accent: '#2563eb',
        },
        {
          href: '/inventory/diapers',
          title: 'Sauskelnės',
          description: 'Greitas priemonių likučių peržiūrėjimas',
          accent: '#059669',
        },
        ...common,
      ]
    }

    if (myStaffType === 'kitchen') {
      return [
        {
          href: '/residents',
          title: 'Gyventojų būsena',
          description: 'Kas vietoje, ligoninėje ar išvykęs',
          accent: '#2563eb',
        },
        {
          href: '/inventory',
          title: 'Sandėlis',
          description: 'Bendra atsargų peržiūra',
          accent: '#059669',
        },
        ...common,
      ]
    }

    return [
      {
        href: '/residents',
        title: 'Gyventojai',
        description: 'Peržiūrėti aktualią informaciją',
        accent: '#2563eb',
      },
      {
        href: '/inventory',
        title: 'Sandėlis',
        description: 'Peržiūrėti likučius ir istoriją',
        accent: '#059669',
      },
      ...common,
    ]
  }, [myRole, myStaffType])

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingCard}>Kraunamas darbuotojo dashboard...</div>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div style={styles.mobilePage}>
        <div style={styles.mobileHero}>
          <div style={styles.mobileHeroTop}>
            <span style={styles.roleBadge}>{getRoleTitle(myRole, myStaffType)}</span>

            <button
              onClick={handleSignOut}
              disabled={signingOut}
              style={styles.signOutButtonMobile}
            >
              {signingOut ? 'Atsijungiama...' : 'Atsijungti'}
            </button>
          </div>

          <div style={styles.avatarCircle}>
            {getInitial(displayName)}
          </div>

          <h1 style={styles.mobileTitle}>Sveiki, {displayName}</h1>
          <p style={styles.mobileSubtitle}>
            Čia gali greitai pasiekti svarbiausius darbuotojo modulius.
          </p>

          <div style={styles.mobileInfoGrid}>
            <InfoBox label="El. paštas" value={email || '—'} />
            <InfoBox label="Pareigos" value={getPositionLabel(myPosition)} />
            <InfoBox label="Skyrius" value={myDepartment || getRoleTitle(myRole, myStaffType)} />
          </div>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        <div style={styles.mobileStatsGrid}>
          <MiniStatCard label="Gyventojai" value={String(stats.residentsCount)} />
          <MiniStatCard label="Vaistai šiandien" value={String(stats.medicationsToday)} />
          <MiniStatCard label="Baigiasi likučiai" value={String(stats.lowStockCount)} />
          <MiniStatCard label="Priskyrimai" value={String(stats.activeAssignmentsCount)} />
        </div>

        <div style={styles.mobileSection}>
          <h2 style={styles.sectionTitle}>Pagrindiniai veiksmai</h2>

          <div style={styles.mobileActionGrid}>
            {quickLinks.map((item) => (
              <Link key={item.href} href={item.href} style={styles.mobileActionCard}>
                <div
                  style={{
                    ...styles.mobileActionAccent,
                    background: item.accent,
                  }}
                />
                <div style={styles.mobileActionTitle}>{item.title}</div>
                <div style={styles.mobileActionText}>{item.description}</div>
                <div style={styles.mobileActionHint}>Atidaryti →</div>
              </Link>
            ))}
          </div>
        </div>

        <div style={{ height: 90 }} />
        <MobileBottomNav />
      </div>
    )
  }

  return (
    <div style={styles.desktopPage}>
      <div style={styles.desktopShell}>
        <main style={styles.mainContentOnly}>
          <div style={styles.desktopHero}>
            <div style={styles.desktopHeroLeft}>
              <div style={styles.heroAvatar}>{getInitial(displayName)}</div>

              <div>
                <span style={styles.roleBadge}>{getRoleTitle(myRole, myStaffType)}</span>
                <h1 style={styles.desktopTitle}>Sveiki, {displayName}</h1>
                <p style={styles.desktopSubtitle}>
                  Čia gali valdyti tau skirtus gyventojus, vaistus, grafiką, sandėlį ir kitus kasdienius procesus.
                </p>

                <div style={styles.infoRow}>
                  <InfoPill label="El. paštas" value={email || '—'} />
                  <InfoPill label="Pareigos" value={getPositionLabel(myPosition)} />
                  <InfoPill label="Skyrius" value={myDepartment || getRoleTitle(myRole, myStaffType)} />
                </div>
              </div>
            </div>

            <div style={styles.desktopHeroRight}>
              <button
                onClick={() => router.push('/dashboard')}
                style={styles.secondaryButton}
              >
                Pilnas dashboard
              </button>

              <button
                onClick={handleSignOut}
                disabled={signingOut}
                style={styles.primaryButton}
              >
                {signingOut ? 'Atsijungiama...' : 'Atsijungti'}
              </button>
            </div>
          </div>

          {message ? <div style={styles.message}>{message}</div> : null}

          <div style={styles.desktopStatsGrid}>
            <StatCard
              label="Matomi gyventojai"
              value={String(stats.residentsCount)}
              description="Pagal tavo teises ir priskyrimus"
            />
            <StatCard
              label="Vaistų įrašai šiandien"
              value={String(stats.medicationsToday)}
              description="Šios dienos registruoti įrašai"
            />
            <StatCard
              label="Baigiasi sandėlis"
              value={String(stats.lowStockCount)}
              description="Prekės, kurių likutis artėja prie minimumo"
            />
            <StatCard
              label="Aktyvūs priskyrimai"
              value={String(stats.activeAssignmentsCount)}
              description="Gyventojai, priskirti tiesiogiai tau"
            />
          </div>

          <div style={styles.desktopContentGrid}>
            <section style={styles.bigCard}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Pagrindiniai valdymai</h2>
                <p style={styles.sectionSubtext}>
                  Dažniausiai naudojami darbuotojo veiksmai.
                </p>
              </div>

              <div style={styles.desktopActionGrid}>
                {quickLinks.map((item) => (
                  <Link key={item.href} href={item.href} style={styles.desktopActionCard}>
                    <div
                      style={{
                        ...styles.desktopActionAccent,
                        background: item.accent,
                      }}
                    />
                    <div style={styles.desktopActionTitle}>{item.title}</div>
                    <div style={styles.desktopActionText}>{item.description}</div>
                    <div style={styles.desktopActionHint}>Atidaryti →</div>
                  </Link>
                ))}
              </div>
            </section>

            <aside style={styles.sideColumn}>
              <div style={styles.sideCard}>
                <h2 style={styles.sectionTitle}>Greita santrauka</h2>

                <div style={styles.summaryList}>
                  <SummaryRow label="Prisijungęs vartotojas" value={displayName} />
                  <SummaryRow label="Darbuotojo rolė" value={getRoleTitle(myRole, myStaffType)} />
                  <SummaryRow label="Pareigos" value={getPositionLabel(myPosition)} />
                  <SummaryRow label="Skyrius" value={myDepartment || '—'} />
                  <SummaryRow label="El. paštas" value={email || '—'} />
                  <SummaryRow label="Organizacijos ID" value={organizationId || '—'} />
                </div>
              </div>

              <div style={styles.sideCard}>
                <h2 style={styles.sectionTitle}>Tolimesni geri žingsniai</h2>

                <div style={styles.tipBox}>Pasitikrink, ar tavo darbuotojo tipas ir pareigos nustatytos teisingai.</div>
                <div style={styles.tipBox}>Susiek užduotis su gyventojais, kad darbai būtų aiškiai paskirstyti.</div>
                <div style={styles.tipBox}>Naudok Mano užduotys ir Mano grafikas kaip pagrindinius kasdienius langus.</div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  )
}

function getRoleTitle(role: SystemRole | '', staffType: StaffType) {
  if (role === 'owner') return 'Savininkas'
  if (role === 'admin') return 'Administratorius'

  switch (staffType) {
    case 'care_worker':
      return 'Individualios priežiūros darbuotojas'
    case 'nursing_staff':
      return 'Slaugos darbuotojas'
    case 'kitchen':
      return 'Valgykla'
    case 'reception':
      return 'Registratūra'
    case 'administration':
      return 'Administracija'
    default:
      return 'Darbuotojas'
  }
}

function getPositionLabel(position: string | null) {
  switch (position) {
    case 'direktorius':
      return 'Direktorius'
    case 'direktoriaus_pavaduotojas':
      return 'Direktoriaus pavaduotojas'
    case 'administratorius':
      return 'Administratorius'
    case 'vyr_slaugytojas':
      return 'Vyr. slaugytojas'
    case 'slaugytojas':
      return 'Slaugytojas'
    case 'individualios_prieziuros_darbuotojas':
      return 'Individualios priežiūros darbuotojas'
    case 'ukvedys':
      return 'Ūkvedys'
    case 'vyr_socialinis_darbuotojas':
      return 'Vyr. socialinis darbuotojas'
    case 'socialinis_darbuotojas':
      return 'Socialinis darbuotojas'
    default:
      return 'Nenurodyta'
  }
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'D'
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statDescription}>{description}</div>
    </div>
  )
}

function MiniStatCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div style={styles.miniStatCard}>
      <div style={styles.miniStatValue}>{value}</div>
      <div style={styles.miniStatLabel}>{label}</div>
    </div>
  )
}

function InfoBox({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div style={styles.infoBox}>
      <div style={styles.infoBoxLabel}>{label}</div>
      <div style={styles.infoBoxValue}>{value}</div>
    </div>
  )
}

function InfoPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div style={styles.infoPill}>
      <div style={styles.infoPillLabel}>{label}</div>
      <div style={styles.infoPillValue}>{value}</div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div style={styles.summaryRow}>
      <span style={styles.summaryLabel}>{label}</span>
      <span style={styles.summaryValue}>{value}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  loadingWrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    padding: 24,
  },
  loadingCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 20,
    padding: '24px 28px',
    fontSize: 16,
    fontWeight: 700,
    color: '#111827',
  },

  mobilePage: {
    minHeight: '100vh',
    background: '#f3f6fb',
    padding: '20px 16px 0',
  },
  mobileHero: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 28,
    padding: 18,
    display: 'grid',
    gap: 14,
    marginBottom: 16,
  },
  mobileHeroTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  roleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: 999,
    background: '#e0f2fe',
    color: '#0369a1',
    border: '1px solid #bae6fd',
    fontSize: 12,
    fontWeight: 800,
  },
  signOutButtonMobile: {
    border: '1px solid #d1d5db',
    borderRadius: 12,
    background: '#fff',
    color: '#111827',
    padding: '10px 12px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 20,
    background: 'linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#1e3a8a',
    fontWeight: 800,
    fontSize: 30,
  },
  mobileTitle: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.1,
    fontWeight: 800,
    color: '#0f172a',
  },
  mobileSubtitle: {
    margin: 0,
    color: '#64748b',
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.5,
  },
  mobileInfoGrid: {
    display: 'grid',
    gap: 10,
  },
  infoBox: {
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    padding: 12,
  },
  infoBoxLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
  },
  infoBoxValue: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: 800,
    wordBreak: 'break-word',
  },
  message: {
    padding: '12px 14px',
    borderRadius: 14,
    background: '#fff',
    border: '1px solid #e5e7eb',
    color: '#111827',
    marginBottom: 16,
  },
  mobileStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 18,
  },
  miniStatCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 20,
    padding: 16,
  },
  miniStatValue: {
    fontSize: 28,
    fontWeight: 800,
    color: '#0f172a',
    lineHeight: 1,
    marginBottom: 8,
  },
  miniStatLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: 700,
  },
  mobileSection: {
    display: 'grid',
    gap: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
  },
  mobileActionGrid: {
    display: 'grid',
    gap: 12,
  },
  mobileActionCard: {
    textDecoration: 'none',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 20,
    padding: 16,
    display: 'grid',
    gap: 8,
  },
  mobileActionAccent: {
    width: 42,
    height: 4,
    borderRadius: 999,
  },
  mobileActionTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: '#0f172a',
  },
  mobileActionText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  mobileActionHint: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: 800,
  },

  desktopPage: {
    minHeight: '100vh',
    background: '#f3f6fb',
    padding: 24,
  },
  desktopShell: {
    maxWidth: 1700,
    margin: '0 auto',
  },
  mainContentOnly: {
    display: 'grid',
    gap: 18,
  },
  desktopHero: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 30,
    padding: 24,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 20,
    flexWrap: 'wrap',
  },
  desktopHeroLeft: {
    display: 'flex',
    gap: 20,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  heroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 28,
    background: 'linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#1e3a8a',
    fontWeight: 800,
    fontSize: 46,
    flexShrink: 0,
  },
  desktopHeroRight: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  desktopTitle: {
    margin: '10px 0 0',
    fontSize: 56,
    fontWeight: 800,
    lineHeight: 1.05,
    color: '#0f172a',
  },
  desktopSubtitle: {
    margin: '12px 0 0',
    fontSize: 16,
    color: '#64748b',
    fontWeight: 600,
    maxWidth: 900,
    lineHeight: 1.6,
  },
  infoRow: {
    marginTop: 18,
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  infoPill: {
    minWidth: 220,
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
    borderRadius: 18,
    padding: 14,
  },
  infoPillLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
  },
  infoPillValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: 800,
    wordBreak: 'break-word',
  },
  desktopStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 14,
  },
  statCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 22,
    padding: 18,
    display: 'grid',
    gap: 8,
    minHeight: 150,
  },
  statValue: {
    fontSize: 34,
    fontWeight: 800,
    color: '#0f172a',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0f172a',
  },
  statDescription: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  desktopContentGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.9fr) minmax(320px, 0.95fr)',
    gap: 18,
    alignItems: 'start',
  },
  bigCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 28,
    padding: 22,
    display: 'grid',
    gap: 18,
  },
  sideColumn: {
    display: 'grid',
    gap: 18,
  },
  sideCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 28,
    padding: 22,
    display: 'grid',
    gap: 16,
  },
  sectionHeader: {
    display: 'grid',
    gap: 8,
  },
  sectionSubtext: {
    margin: 0,
    fontSize: 15,
    color: '#64748b',
    fontWeight: 600,
  },
  desktopActionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 14,
  },
  desktopActionCard: {
    textDecoration: 'none',
    background: '#fff',
    border: '1px solid #dbe2ea',
    borderRadius: 22,
    padding: 18,
    display: 'grid',
    gap: 10,
    minHeight: 180,
    boxShadow: '0 1px 1px rgba(15, 23, 42, 0.02)',
  },
  desktopActionAccent: {
    width: 48,
    height: 5,
    borderRadius: 999,
  },
  desktopActionTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#0f172a',
  },
  desktopActionText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: 600,
    lineHeight: 1.6,
  },
  desktopActionHint: {
    marginTop: 4,
    fontSize: 14,
    color: '#2563eb',
    fontWeight: 800,
  },
  summaryList: {
    display: 'grid',
    gap: 0,
  },
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 1fr',
    gap: 12,
    padding: '12px 0',
    borderBottom: '1px solid #e5e7eb',
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: 700,
  },
  summaryValue: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: 800,
    textAlign: 'right',
    wordBreak: 'break-word',
  },
  tipBox: {
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    padding: 14,
    color: '#475569',
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  primaryButton: {
    border: 'none',
    borderRadius: 14,
    padding: '12px 18px',
    background: '#0f172a',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid #d1d5db',
    borderRadius: 14,
    padding: '12px 18px',
    background: '#fff',
    color: '#0f172a',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
}