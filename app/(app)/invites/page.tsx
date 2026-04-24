'use client'

import { useEffect, useState } from 'react'
import { Check, X, Mail, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

type Invite = {
  id: string
  organization_id: string
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string | null
  invited_by: string | null
  invited_by_name?: string | null
}

type Profile = {
  id: string
  full_name: string | null
  email: string | null
}

function roleLabel(role: string) {
  if (role === 'admin') return 'Administratorius'
  if (role === 'employee') return 'Darbuotojas'
  if (role === 'owner') return 'Savininkas'
  return role || '—'
}

function statusLabel(status: string) {
  if (status === 'pending') return 'Laukia patvirtinimo'
  if (status === 'accepted') return 'Priimtas'
  if (status === 'cancelled') return 'Atšauktas'
  if (status === 'expired') return 'Pasibaigęs'
  return status || '—'
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('lt-LT')
}

function statusStyle(status: string): React.CSSProperties {
  if (status === 'pending') return styles.badgeWarning
  if (status === 'accepted') return styles.badgeSuccess
  if (status === 'cancelled') return styles.badgeDanger
  return styles.badgeMuted
}

export default function InvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      setMessage('')

      const orgId = await getCurrentOrganizationId()

      const { data: invitesData, error } = await supabase
        .from('organization_invites')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')

      const profileMap = new Map((profiles || []).map((p: Profile) => [p.id, p]))

      setInvites(
        ((invitesData || []) as Invite[]).map((invite) => ({
          ...invite,
          invited_by_name:
            profileMap.get(invite.invited_by || '')?.full_name ||
            profileMap.get(invite.invited_by || '')?.email ||
            null,
        }))
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko įkelti kvietimų.')
    } finally {
      setLoading(false)
    }
  }

  async function acceptInvite(invite: Invite) {
    try {
      setMessage('')

      const { data: userResult } = await supabase.auth.getUser()
      const userId = userResult.user?.id

      if (!userId) {
        setMessage('Nepavyko nustatyti naudotojo.')
        return
      }

      await supabase.from('organization_members').insert({
        organization_id: invite.organization_id,
        user_id: userId,
        role: invite.role,
        legacy_role: invite.role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      await supabase
        .from('organization_invites')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', invite.id)

      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko patvirtinti kvietimo.')
    }
  }

  async function cancelInvite(id: string) {
    await supabase
      .from('organization_invites')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    await load()
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.heroIcon}>
          <Mail size={26} />
        </div>

        <div>
          <div style={styles.eyebrow}>Naudotojų valdymas</div>
          <h1 style={styles.title}>Kvietimai</h1>
          <p style={styles.subtitle}>Darbuotojų pakvietimai į įstaigos sistemą.</p>
        </div>

        <button type="button" onClick={() => void load()} style={styles.refreshButton}>
          <RefreshCw size={16} />
          Atnaujinti
        </button>
      </div>

      {message ? <div style={styles.message}>{message}</div> : null}

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.sectionTitle}>Kvietimų sąrašas</h2>
          <span style={styles.meta}>{loading ? 'Kraunama...' : `Iš viso: ${invites.length}`}</span>
        </div>

        {invites.length === 0 ? (
          <div style={styles.empty}>Kvietimų nėra.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>El. paštas</th>
                  <th style={styles.th}>Rolė</th>
                  <th style={styles.th}>Statusas</th>
                  <th style={styles.th}>Pakvietė</th>
                  <th style={styles.th}>Sukurta</th>
                  <th style={styles.th}>Galioja iki</th>
                  <th style={styles.th}>Veiksmai</th>
                </tr>
              </thead>

              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td style={styles.tdStrong}>{invite.email}</td>
                    <td style={styles.td}>{roleLabel(invite.role)}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...statusStyle(invite.status) }}>
                        {statusLabel(invite.status)}
                      </span>
                    </td>
                    <td style={styles.td}>{invite.invited_by_name || '—'}</td>
                    <td style={styles.td}>{formatDate(invite.created_at)}</td>
                    <td style={styles.td}>{formatDate(invite.expires_at)}</td>
                    <td style={styles.td}>
                      {invite.status === 'pending' ? (
                        <div style={styles.actions}>
                          <button type="button" style={styles.successButton} onClick={() => void acceptInvite(invite)}>
                            <Check size={15} />
                            Patvirtinti
                          </button>

                          <button type="button" style={styles.dangerButton} onClick={() => void cancelInvite(invite.id)}>
                            <X size={15} />
                            Atšaukti
                          </button>
                        </div>
                      ) : (
                        <span style={styles.muted}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    display: 'grid',
    gap: 18,
    background: '#f8fafc',
  },
  header: {
    display: 'grid',
    gridTemplateColumns: '58px 1fr auto',
    gap: 16,
    alignItems: 'center',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 24,
    padding: 22,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    background: '#ecfdf5',
    color: '#047857',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#047857',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  title: {
    margin: '4px 0',
    color: '#0f172a',
    fontSize: 34,
    fontWeight: 950,
  },
  subtitle: {
    margin: 0,
    color: '#64748b',
    fontSize: 15,
    fontWeight: 700,
  },
  refreshButton: {
    border: '1px solid #a7f3d0',
    background: '#ecfdf5',
    color: '#047857',
    borderRadius: 13,
    padding: '10px 13px',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
  },
  message: {
    background: '#fff1f2',
    color: '#be123c',
    border: '1px solid #fecdd3',
    borderRadius: 16,
    padding: 13,
    fontSize: 14,
    fontWeight: 800,
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 22,
    padding: 20,
    display: 'grid',
    gap: 14,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  sectionTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: 22,
    fontWeight: 950,
  },
  meta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: 850,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    minWidth: 980,
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 10px',
    borderBottom: '1px solid #e5e7eb',
    color: '#475569',
    fontWeight: 900,
  },
  td: {
    padding: '13px 10px',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
    fontWeight: 650,
    verticalAlign: 'top',
  },
  tdStrong: {
    padding: '13px 10px',
    borderBottom: '1px solid #f1f5f9',
    color: '#0f172a',
    fontWeight: 900,
    verticalAlign: 'top',
  },
  badge: {
    display: 'inline-flex',
    borderRadius: 999,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 900,
  },
  badgeWarning: {
    background: '#fef9c3',
    color: '#854d0e',
  },
  badgeSuccess: {
    background: '#dcfce7',
    color: '#166534',
  },
  badgeDanger: {
    background: '#fee2e2',
    color: '#b91c1c',
  },
  badgeMuted: {
    background: '#e2e8f0',
    color: '#475569',
  },
  actions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  successButton: {
    border: 'none',
    borderRadius: 11,
    padding: '8px 10px',
    background: '#047857',
    color: '#ffffff',
    fontWeight: 900,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  dangerButton: {
    border: 'none',
    borderRadius: 11,
    padding: '8px 10px',
    background: '#fee2e2',
    color: '#b91c1c',
    fontWeight: 900,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  muted: {
    color: '#94a3b8',
  },
  empty: {
    padding: 22,
    border: '1px dashed #cbd5e1',
    borderRadius: 16,
    color: '#64748b',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 750,
  },
}