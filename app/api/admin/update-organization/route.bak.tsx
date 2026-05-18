'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type OrganizationRow = {
  id: string
  name: string | null
  code: string | null
  address: string | null
  created_at: string | null
  updated_at?: string | null
  archived_at?: string | null
  status?: string | null
  plan?: string | null
}

type AdminProfile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
}

type AuditLogRow = {
  id: string
  organization_id: string | null
  actor_user_id: string | null
  entity_type: string
  entity_id: string
  action: string
  created_at: string
  old_values?: Record<string, unknown> | null
  new_values?: Record<string, unknown> | null
}

type AuditLogDisplay = AuditLogRow & {
  actor_name: string | null
  actor_email: string | null
}

type OrganizationCard = OrganizationRow & {
  members_count: number
  residents_count: number
  admin_name: string | null
  admin_email: string | null
  audit_logs: AuditLogDisplay[]
}

type EditForm = {
  id: string
  name: string
  code: string
  address: string
  plan: string
}

type StatusFilter = 'active' | 'archived' | 'all'

function getReadableError(error: unknown) {
  if (!error) return 'Nežinoma klaida.'
  if (error instanceof Error) return error.message

  if (typeof error === 'object') {
    const e = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    if (e.message) return e.message
    if (e.details) return e.details
    if (e.hint) return e.hint
    if (e.code) return `Klaidos kodas: ${e.code}`
  }

  return 'Nepavyko įvykdyti veiksmo.'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('lt-LT')
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('lt-LT')
}

function getProfileDisplayName(profile: AdminProfile | null) {
  if (!profile) return null

  const combined = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
  if (combined) return combined
  if (profile.full_name?.trim()) return profile.full_name.trim()
  return profile.email || null
}

function getAuditActorDisplayName(log: AuditLogDisplay) {
  if (log.actor_name?.trim()) return log.actor_name.trim()
  if (log.actor_email?.trim()) return log.actor_email.trim()
  return 'Sistema'
}

function getAuditActionLabel(action: string) {
  switch (action) {
    case 'admin_assigned':
      return 'Priskirtas admin'
    case 'admin_invited':
      return 'Sukurtas admin kvietimas'
    case 'organization_archived':
      return 'Įstaiga archyvuota'
    case 'organization_restored':
      return 'Įstaiga atstatyta'
    case 'organization_created':
      return 'Įstaiga sukurta'
    case 'organization_updated':
      return 'Įstaiga atnaujinta'
    default:
      return action
    }
}

function getPlanLabel(plan: string | null | undefined) {
  switch ((plan || '').toLowerCase()) {
    case 'starter':
      return 'Pradinis'
    case 'basic':
      return 'Bazinis'
    case 'pro':
      return 'Profesionalus'
    case 'enterprise':
      return 'Verslo'
    default:
      return plan || 'Bazinis'
  }
}

function getPlanBadgeStyle(plan: string | null | undefined): React.CSSProperties {
  switch ((plan || '').toLowerCase()) {
    case 'starter':
      return {
        background: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fcd34d',
      }
    case 'pro':
      return {
        background: '#dbeafe',
        color: '#1d4ed8',
        border: '1px solid #93c5fd',
      }
    case 'enterprise':
      return {
        background: '#ede9fe',
        color: '#6d28d9',
        border: '1px solid #c4b5fd',
      }
    case 'basic':
    default:
      return {
        background: '#dcfce7',
        color: '#166534',
        border: '1px solid #86efac',
      }
  }
}

function getStatusLabel(status: string | null | undefined) {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return 'Aktyvi'
    case 'archived':
      return 'Archyvuota'
    case 'suspended':
      return 'Sustabdyta'
    default:
      return status || 'Aktyvi'
  }
}

function getStatusBadgeStyle(status: string | null | undefined): React.CSSProperties {
  switch ((status || '').toLowerCase()) {
    case 'archived':
      return {
        background: '#f1f5f9',
        color: '#475569',
        border: '1px solid #cbd5e1',
      }
    case 'suspended':
      return {
        background: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fcd34d',
      }
    case 'active':
    default:
      return {
        background: '#dcfce7',
        color: '#166534',
        border: '1px solid #86efac',
      }
  }
}

export default function OrganizationsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [organizations, setOrganizations] = useState<OrganizationCard[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [address, setAddress] = useState('')
  const [plan, setPlan] = useState('basic')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)

  const [adminEmails, setAdminEmails] = useState<Record<string, string>>({})

  useEffect(() => {
    void loadOrganizations()
  }, [])

  async function loadOrganizations() {
    try {
      setLoading(true)
      setMessage('')

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = ((data || []) as Record<string, unknown>[]).map(
        (row) =>
          ({
            id: String(row.id),
            name: (row.name as string | null) ?? null,
            code: (row.code as string | null) ?? null,
            address: (row.address as string | null) ?? null,
            created_at: (row.created_at as string | null) ?? null,
            updated_at: (row.updated_at as string | null) ?? null,
            archived_at: (row.archived_at as string | null) ?? null,
            status: (row.status as string | null) ?? 'active',
            plan: (row.plan as string | null) ?? 'basic',
          }) satisfies OrganizationRow
      )

      const enriched = await Promise.all(
        rows.map(async (org) => {
          const [
            { count: membersCount },
            { count: residentsCount },
            { data: adminMembers, error: adminMemberError },
            { data: auditLogsData, error: auditLogsError },
          ] = await Promise.all([
            supabase
              .from('organization_members')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', org.id),

            supabase
              .from('residents')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', org.id),

            supabase
              .from('organization_members')
              .select('user_id, created_at')
              .eq('organization_id', org.id)
              .eq('role', 'admin')
              .eq('is_active', true)
              .order('created_at', { ascending: false })
              .limit(1),

            supabase
              .from('audit_logs')
              .select(
                'id, organization_id, actor_user_id, entity_type, entity_id, action, created_at, old_values, new_values'
              )
              .eq('organization_id', org.id)
              .order('created_at', { ascending: false })
              .limit(5),
          ])

          if (adminMemberError) throw adminMemberError
          if (auditLogsError) throw auditLogsError

          const adminUserId = adminMembers?.[0]?.user_id || null
          let adminProfile: AdminProfile | null = null

          if (adminUserId) {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('id, email, first_name, last_name, full_name')
              .eq('id', adminUserId)
              .maybeSingle()

            if (profileError) throw profileError
            adminProfile = (profileData as AdminProfile | null) || null
          }

          const rawLogs = (auditLogsData || []) as AuditLogRow[]
          const actorIds = Array.from(
            new Set(rawLogs.map((log) => log.actor_user_id).filter(Boolean))
          ) as string[]

          let actorMap = new Map<string, AdminProfile>()

          if (actorIds.length > 0) {
            const { data: actorsData, error: actorsError } = await supabase
              .from('profiles')
              .select('id, email, first_name, last_name, full_name')
              .in('id', actorIds)

            if (actorsError) throw actorsError

            actorMap = new Map(
              ((actorsData || []) as AdminProfile[]).map((profile) => [profile.id, profile])
            )
          }

          const audit_logs: AuditLogDisplay[] = rawLogs.map((log) => {
            const actor = log.actor_user_id ? actorMap.get(log.actor_user_id) || null : null

            return {
              ...log,
              actor_name: getProfileDisplayName(actor),
              actor_email: actor?.email || null,
            }
          })

          return {
            ...org,
            members_count: membersCount || 0,
            residents_count: residentsCount || 0,
            admin_name: getProfileDisplayName(adminProfile),
            admin_email: adminProfile?.email || null,
            audit_logs,
          } satisfies OrganizationCard
        })
      )

      setOrganizations(enriched)
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setLoading(false)
    }
  }

  async function createOrganization() {
    try {
      const cleanName = name.trim()
      const cleanCode = code.trim()
      const cleanAddress = address.trim()
      const cleanPlan = plan.trim() || 'basic'

      if (!cleanName) {
        setMessage('Įstaigos pavadinimas yra privalomas.')
        return
      }

      setSaving(true)
      setMessage('')

      const { error } = await supabase.from('organizations').insert({
        name: cleanName,
        code: cleanCode || null,
        address: cleanAddress || null,
        plan: cleanPlan,
        status: 'active',
      })

      if (error) throw error

      setName('')
      setCode('')
      setAddress('')
      setPlan('basic')
      setMessage('Įstaiga sėkmingai sukurta.')
      await loadOrganizations()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSaving(false)
    }
  }

  function openEdit(org: OrganizationCard) {
    setEditingId(org.id)
    setEditForm({
      id: org.id,
      name: org.name || '',
      code: org.code || '',
      address: org.address || '',
      plan: org.plan || 'basic',
    })
    setMessage('')
  }

  function closeEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  async function saveEdit() {
    if (!editForm) return

    try {
      const cleanName = editForm.name.trim()
      const cleanCode = editForm.code.trim()
      const cleanAddress = editForm.address.trim()
      const cleanPlan = editForm.plan.trim() || 'basic'

      if (!cleanName) {
        setMessage('Įstaigos pavadinimas yra privalomas.')
        return
      }

      setSaving(true)
      setMessage('')

      const { error } = await supabase
        .from('organizations')
        .update({
          name: cleanName,
          code: cleanCode || null,
          address: cleanAddress || null,
          plan: cleanPlan,
        })
        .eq('id', editForm.id)

      if (error) throw error

      setMessage('Įstaiga sėkmingai atnaujinta.')
      closeEdit()
      await loadOrganizations()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSaving(false)
    }
  }

  async function assignAdmin(orgId: string) {
    const email = (adminEmails[orgId] || '').trim().toLowerCase()

    if (!email) {
      setMessage('Įvesk admin el. paštą.')
      return
    }

    try {
      setSaving(true)
      setMessage('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const response = await fetch('/api/admin/assign-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: orgId,
          email,
          actorUserId: user?.id || null,
        }),
      })

      const result = (await response.json()) as {
        ok: boolean
        error?: string
        message?: string
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Nepavyko priskirti admin.')
      }

      setMessage(result.message || 'Veiksmas atliktas sėkmingai.')

      setAdminEmails((prev) => ({
        ...prev,
        [orgId]: '',
      }))

      await loadOrganizations()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSaving(false)
    }
  }

  async function archiveOrganization(org: OrganizationCard) {
    const confirmed = window.confirm(
      `Ar tikrai nori archyvuoti įstaigą "${org.name || 'be pavadinimo'}"?`
    )

    if (!confirmed) return

    try {
      setSaving(true)
      setMessage('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const response = await fetch('/api/admin/archive-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: org.id,
          actorUserId: user?.id || null,
        }),
      })

      const result = (await response.json()) as {
        ok: boolean
        error?: string
        message?: string
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Nepavyko archyvuoti įstaigos.')
      }

      setMessage(result.message || 'Įstaiga archyvuota.')
      await loadOrganizations()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSaving(false)
    }
  }

  async function restoreOrganization(org: OrganizationCard) {
    try {
      setSaving(true)
      setMessage('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const response = await fetch('/api/admin/restore-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: org.id,
          actorUserId: user?.id || null,
        }),
      })

      const result = (await response.json()) as {
        ok: boolean
        error?: string
        message?: string
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Nepavyko atstatyti įstaigos.')
      }

      setMessage(result.message || 'Įstaiga atstatyta.')
      await loadOrganizations()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSaving(false)
    }
  }

  const filteredOrganizations = useMemo(() => {
    const q = search.trim().toLowerCase()

    return organizations.filter((org) => {
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'archived'
            ? org.status === 'archived'
            : org.status !== 'archived'

      if (!matchesStatus) return false

      if (!q) return true

      return [
        org.name || '',
        org.code || '',
        org.address || '',
        org.admin_name || '',
        org.admin_email || '',
        org.plan || '',
        org.status || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [organizations, search, statusFilter])

  const stats = useMemo(() => {
    const totalOrganizations = organizations.filter((org) => org.status !== 'archived').length
    const totalArchived = organizations.filter((org) => org.status === 'archived').length
    const totalMembers = organizations.reduce((sum, org) => sum + org.members_count, 0)
    const totalResidents = organizations.reduce((sum, org) => sum + org.residents_count, 0)

    return {
      totalOrganizations,
      totalArchived,
      totalMembers,
      totalResidents,
    }
  }, [organizations])

  return (
    <div style={styles.pageOuter}>
      <div style={styles.page}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Įstaigos</h1>
            <p style={styles.subtitle}>
              Čia valdai klientus, jų planus ir matai bendrą platformos vaizdą.
            </p>
          </div>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalOrganizations}</div>
            <div style={styles.statLabel}>Aktyvių įstaigų</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalArchived}</div>
            <div style={styles.statLabel}>Archyvuotų</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalMembers}</div>
            <div style={styles.statLabel}>Darbuotojų</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalResidents}</div>
            <div style={styles.statLabel}>Gyventojų</div>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Sukurti naują įstaigą</h2>

          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Pavadinimas *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pvz. Saulės globos namai"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Kodas</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Pvz. SGN-001"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Adresas</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Pvz. Vilnius, Lietuva"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Planas</span>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                style={styles.input}
              >
                <option value="starter">Pradinis</option>
                <option value="basic">Bazinis</option>
                <option value="pro">Profesionalus</option>
                <option value="enterprise">Verslo</option>
              </select>
            </label>
          </div>

          <div style={styles.actions}>
            <button
              type="button"
              onClick={() => void createOrganization()}
              disabled={saving}
              style={styles.primaryButton}
            >
              {saving ? 'Kuriama...' : 'Sukurti įstaigą'}
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.listHeader}>
            <h2 style={styles.cardTitle}>Visos įstaigos</h2>

            <div style={styles.filtersRow}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                style={styles.searchInput}
              >
                <option value="active">Tik aktyvios</option>
                <option value="archived">Tik archyvuotos</option>
                <option value="all">Visos</option>
              </select>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ieškoti pagal pavadinimą, planą, kodą, adresą ar admin"
                style={styles.searchInput}
              />
            </div>
          </div>

          {loading ? (
            <div style={styles.emptyState}>Kraunama...</div>
          ) : filteredOrganizations.length === 0 ? (
            <div style={styles.emptyState}>Įstaigų nerasta.</div>
          ) : (
            <div style={styles.grid}>
              {filteredOrganizations.map((org) => (
                <article key={org.id} style={styles.orgCard}>
                  <div style={styles.orgTop}>
                    <div>
                      <div style={styles.orgName}>{org.name || 'Be pavadinimo'}</div>
                      <div style={styles.orgMeta}>Kodas: {org.code || '—'}</div>
                    </div>

                    <div style={styles.orgTopRight}>
                      <div style={styles.badgesRow}>
                        <div style={{ ...styles.orgBadge, ...getPlanBadgeStyle(org.plan) }}>
                          {getPlanLabel(org.plan)}
                        </div>

                        <div style={{ ...styles.orgBadge, ...getStatusBadgeStyle(org.status) }}>
                          {getStatusLabel(org.status)}
                        </div>
                      </div>

                      <div style={styles.buttonColumn}>
                        <button
                          type="button"
                          onClick={() => openEdit(org)}
                          disabled={saving || org.status === 'archived'}
                          style={styles.secondaryButton}
                        >
                          Redaguoti
                        </button>

                        {org.status === 'archived' ? (
                          <button
                            type="button"
                            onClick={() => void restoreOrganization(org)}
                            disabled={saving}
                            style={styles.restoreButton}
                          >
                            Atstatyti
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void archiveOrganization(org)}
                            disabled={saving}
                            style={styles.deleteButton}
                          >
                            Archyvuoti
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={styles.infoGrid}>
                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Adresas</span>
                      <span style={styles.infoValue}>{org.address || '—'}</span>
                    </div>

                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Planas</span>
                      <span style={styles.infoValue}>{getPlanLabel(org.plan)}</span>
                    </div>

                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Statusas</span>
                      <span style={styles.infoValue}>{getStatusLabel(org.status)}</span>
                    </div>

                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Admin</span>
                      <span style={styles.infoValue}>{org.admin_name || 'Nepriskirtas'}</span>
                    </div>

                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Admin el. paštas</span>
                      <span style={styles.infoValue}>{org.admin_email || '—'}</span>
                    </div>

                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Darbuotojai</span>
                      <span style={styles.infoValue}>{org.members_count}</span>
                    </div>

                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Gyventojai</span>
                      <span style={styles.infoValue}>{org.residents_count}</span>
                    </div>

                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Sukurta</span>
                      <span style={styles.infoValue}>{formatDate(org.created_at)}</span>
                    </div>

                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Archyvuota</span>
                      <span style={styles.infoValue}>{formatDate(org.archived_at)}</span>
                    </div>
                  </div>

                  <div style={styles.assignCard}>
                    <div style={styles.assignTitle}>Priskirti admin</div>

                    <input
                      value={adminEmails[org.id] || ''}
                      onChange={(e) =>
                        setAdminEmails((prev) => ({
                          ...prev,
                          [org.id]: e.target.value,
                        }))
                      }
                      placeholder="Admin el. paštas"
                      style={styles.input}
                      disabled={org.status === 'archived'}
                    />

                    <button
                      type="button"
                      onClick={() => void assignAdmin(org.id)}
                      disabled={saving || org.status === 'archived'}
                      style={styles.secondaryButton}
                    >
                      {saving ? 'Saugoma...' : 'Priskirti admin'}
                    </button>
                  </div>

                  <div style={styles.auditCard}>
                    <div style={styles.auditTitle}>Veiklos istorija</div>

                    {org.audit_logs.length === 0 ? (
                      <div style={styles.auditEmpty}>Istorijos įrašų kol kas nėra.</div>
                    ) : (
                      <div style={styles.auditList}>
                        {org.audit_logs.map((log) => (
                          <div key={log.id} style={styles.auditItem}>
                            <div style={styles.auditAction}>{getAuditActionLabel(log.action)}</div>
                            <div style={styles.auditMeta}>
                              {getAuditActorDisplayName(log)} • {formatDateTime(log.created_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {editForm && editingId ? (
          <div style={styles.modalBackdrop} onClick={closeEdit}>
            <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <h3 style={styles.modalTitle}>Redaguoti įstaigą</h3>

              <div style={styles.formGrid}>
                <label style={styles.field}>
                  <span style={styles.label}>Pavadinimas *</span>
                  <input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, name: e.target.value } : prev
                      )
                    }
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Kodas</span>
                  <input
                    value={editForm.code}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, code: e.target.value } : prev
                      )
                    }
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Adresas</span>
                  <input
                    value={editForm.address}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, address: e.target.value } : prev
                      )
                    }
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Planas</span>
                  <select
                    value={editForm.plan}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, plan: e.target.value } : prev
                      )
                    }
                    style={styles.input}
                  >
                    <option value="starter">Pradinis</option>
                    <option value="basic">Bazinis</option>
                    <option value="pro">Profesionalus</option>
                    <option value="enterprise">Verslo</option>
                  </select>
                </label>
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={closeEdit} style={styles.secondaryButton}>
                  Atšaukti
                </button>

                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={saving}
                  style={styles.primaryButton}
                >
                  {saving ? 'Saugoma...' : 'Išsaugoti'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  pageOuter: {
    width: '100%',
    padding: 24,
    boxSizing: 'border-box',
  },
  page: {
    width: '100%',
    maxWidth: 1400,
    margin: '0 auto',
    display: 'grid',
    gap: 20,
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
    fontSize: 30,
    fontWeight: 900,
    color: '#0f172a',
  },
  subtitle: {
    margin: '8px 0 0',
    fontSize: 15,
    color: '#64748b',
    fontWeight: 600,
  },
  message: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
    padding: 14,
    borderRadius: 14,
    fontWeight: 700,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 14,
  },
  statCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 18,
    padding: 18,
    display: 'grid',
    gap: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 900,
    color: '#111827',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 700,
  },
  card: {
    background: '#fff',
    padding: 18,
    borderRadius: 18,
    border: '1px solid #e5e7eb',
    display: 'grid',
    gap: 16,
    overflow: 'hidden',
  },
  cardTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: '#111827',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
  },
  field: {
    display: 'grid',
    gap: 6,
    minWidth: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: '#374151',
  },
  input: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '11px 12px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    fontSize: 14,
    outline: 'none',
    background: '#fff',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  primaryButton: {
    padding: '11px 16px',
    borderRadius: 10,
    background: '#111827',
    color: '#fff',
    border: 'none',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '10px 14px',
    borderRadius: 10,
    background: '#fff',
    color: '#111827',
    border: '1px solid #d1d5db',
    fontWeight: 700,
    cursor: 'pointer',
  },
  deleteButton: {
    padding: '10px 14px',
    borderRadius: 10,
    background: '#fff1f2',
    color: '#be123c',
    border: '1px solid #fecdd3',
    fontWeight: 700,
    cursor: 'pointer',
  },
  restoreButton: {
    padding: '10px 14px',
    borderRadius: 10,
    background: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0',
    fontWeight: 700,
    cursor: 'pointer',
  },
  listHeader: {
    display: 'grid',
    gap: 12,
  },
  filtersRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  searchInput: {
    width: '100%',
    maxWidth: 420,
    boxSizing: 'border-box',
    padding: '11px 12px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    fontSize: 14,
    outline: 'none',
    background: '#fff',
  },
  emptyState: {
    padding: 24,
    borderRadius: 14,
    border: '1px dashed #d1d5db',
    textAlign: 'center',
    color: '#6b7280',
    fontWeight: 600,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 16,
    width: '100%',
  },
  orgCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    padding: 16,
    display: 'grid',
    gap: 14,
    minWidth: 0,
  },
  orgTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  orgTopRight: {
    display: 'grid',
    gap: 8,
    justifyItems: 'end',
    flexShrink: 0,
  },
  badgesRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  buttonColumn: {
    display: 'grid',
    gap: 8,
    justifyItems: 'end',
  },
  orgName: {
    fontSize: 18,
    fontWeight: 800,
    color: '#111827',
    wordBreak: 'break-word',
  },
  orgMeta: {
    marginTop: 6,
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 600,
    wordBreak: 'break-word',
  },
  orgBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  infoGrid: {
    display: 'grid',
    gap: 10,
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 700,
    flexShrink: 0,
  },
  infoValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: 700,
    textAlign: 'right',
    wordBreak: 'break-word',
  },
  assignCard: {
    display: 'grid',
    gap: 10,
    borderTop: '1px solid #e5e7eb',
    paddingTop: 14,
  },
  assignTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: '#111827',
  },
  auditCard: {
    display: 'grid',
    gap: 10,
    borderTop: '1px solid #e5e7eb',
    paddingTop: 14,
  },
  auditTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: '#111827',
  },
  auditList: {
    display: 'grid',
    gap: 8,
  },
  auditItem: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 10,
    display: 'grid',
    gap: 4,
  },
  auditAction: {
    fontSize: 13,
    fontWeight: 800,
    color: '#111827',
  },
  auditMeta: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 600,
  },
  auditEmpty: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 600,
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 50,
  },
  modalCard: {
    width: '100%',
    maxWidth: 760,
    background: '#fff',
    borderRadius: 18,
    padding: 20,
    display: 'grid',
    gap: 16,
    boxShadow: '0 20px 60px rgba(15, 23, 42, 0.25)',
  },
  modalTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: '#111827',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
}