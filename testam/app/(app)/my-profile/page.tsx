'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import MobileBottomNav from '@/components/mobile/MobileBottomNav'

type ProfileRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  role: string | null
}

type MembershipRow = {
  organization_id: string
  role: 'owner' | 'admin' | 'employee'
  staff_type: string | null
  position: string | null
  department: string | null
  is_deputy: boolean | null
  occupational_health_valid_until: string | null
  professional_license_number: string | null
  professional_license_valid_until: string | null
}

type NotificationCountRow = {
  id: string
  is_read: boolean | null
}

function formatFullName(profile: ProfileRow | null) {
  const combined = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  if (combined) return combined
  if (profile?.full_name?.trim()) return profile.full_name.trim()
  return profile?.email || 'Darbuotojas'
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('lt-LT')
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

export default function MyProfilePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [membership, setMembership] = useState<MembershipRow | null>(null)
  const [notificationsCount, setNotificationsCount] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setMessage('')

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.replace('/login')
          return
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, full_name, avatar_url, phone, role')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) throw profileError

        const typedProfile = (profileData as ProfileRow | null) || null
        setProfile(typedProfile)

        const { data: membershipData, error: membershipError } = await supabase
          .from('organization_members')
          .select(
            'organization_id, role, staff_type, position, department, is_deputy, occupational_health_valid_until, professional_license_number, professional_license_valid_until'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (membershipError) throw membershipError

        const typedMembership = (membershipData as MembershipRow | null) || null
        setMembership(typedMembership)

        if (typedMembership?.role === 'owner' || typedMembership?.role === 'admin') {
          router.replace('/admin-dashboard')
          return
        }

        const { data: notifications } = await supabase
          .from('notifications')
          .select('id, is_read')
          .eq('user_id', user.id)
          .eq('is_read', false)

        setNotificationsCount(((notifications as NotificationCountRow[]) || []).length)
      } catch (error) {
        setMessage(getReadableError(error))
      } finally {
        setLoading(false)
      }
    }

    loadData()
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
      <div style={styles.container}>
        <div style={styles.headerCard}>
          <button onClick={() => router.push('/employee-dashboard')} style={styles.backButton}>
            ← Atgal
          </button>

          <div style={styles.profileTop}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profilio nuotrauka" style={styles.avatar} />
            ) : (
              <div style={styles.avatarFallback}>
                {formatFullName(profile).charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <h1 style={styles.title}>{formatFullName(profile)}</h1>
              <p style={styles.subtitle}>{membership?.position || 'Darbuotojas'}</p>
            </div>
          </div>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Pagrindinė informacija</h2>
          <InfoRow label="El. paštas" value={profile?.email || '—'} />
          <InfoRow label="Telefonas" value={profile?.phone || '—'} />
          <InfoRow label="Rolė" value={membership?.role || '—'} />
          <InfoRow label="Pareigos" value={membership?.position || '—'} />
          <InfoRow label="Skyrius" value={membership?.department || '—'} />
          <InfoRow label="Darbuotojo tipas" value={membership?.staff_type || '—'} />
          <InfoRow label="Pavaduojantis" value={membership?.is_deputy ? 'Taip' : 'Ne'} />
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Dokumentai</h2>
          <InfoRow
            label="Med. pažyma galioja iki"
            value={formatDate(membership?.occupational_health_valid_until || null)}
          />
          <InfoRow
            label="Licencijos numeris"
            value={membership?.professional_license_number || '—'}
          />
          <InfoRow
            label="Licencija galioja iki"
            value={formatDate(membership?.professional_license_valid_until || null)}
          />
        </div>
      </div>

      <MobileBottomNav notificationsCount={notificationsCount} />
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
  },
  container: {
    width: '100%',
    maxWidth: 860,
    margin: '0 auto',
    padding: '16px 16px 96px',
    boxSizing: 'border-box',
    display: 'grid',
    gap: 16,
  },
  loadingWrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
  },
  loadingText: {
    color: '#475569',
    fontSize: 18,
    fontWeight: 700,
  },
  headerCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 24,
    padding: 18,
    display: 'grid',
    gap: 16,
  },
  backButton: {
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    background: '#fff',
    color: '#0f172a',
    padding: '10px 12px',
    fontWeight: 700,
    cursor: 'pointer',
    width: 'fit-content',
  },
  profileTop: {
    display: 'flex',
    gap: 14,
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    objectFit: 'cover',
    border: '1px solid #e2e8f0',
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#e2e8f0',
    color: '#0f172a',
    fontWeight: 800,
    fontSize: 28,
  },
  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: 28,
    fontWeight: 800,
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: 15,
    fontWeight: 600,
  },
  message: {
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    color: '#9a3412',
    padding: 14,
    borderRadius: 16,
    fontWeight: 700,
  },
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 22,
    padding: 18,
    display: 'grid',
    gap: 10,
  },
  cardTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: 20,
    fontWeight: 800,
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 10,
    borderBottom: '1px solid #f1f5f9',
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: 700,
  },
  infoValue: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: 800,
    textAlign: 'right',
  },
}