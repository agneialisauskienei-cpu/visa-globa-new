'use client'

import Link from 'next/link'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type SystemRole = 'owner' | 'admin' | 'employee'
type StaffType =
  | 'care_worker'
  | 'nursing_staff'
  | 'kitchen'
  | 'reception'
  | 'administration'
  | null

type Member = {
  user_id: string
  organization_id: string
  role: SystemRole
  staff_type: StaffType
  position: string | null
  department: string | null
  is_deputy: boolean
  occupational_health_valid_until: string | null
  professional_license_number: string | null
  professional_license_valid_until: string | null
  created_at: string | null
  email: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
}

type MembershipRow = {
  user_id: string
  organization_id: string
  role: SystemRole
  staff_type: StaffType
  position: string | null
  department: string | null
  is_deputy: boolean | null
  occupational_health_valid_until: string | null
  professional_license_number: string | null
  professional_license_valid_until: string | null
  created_at: string | null
}

type ProfileRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
}

type EditMemberForm = {
  user_id: string
  role: SystemRole
  staff_type: StaffType
  position: string
  department: string
  is_deputy: boolean
  occupational_health_valid_until: string
  professional_license_number: string
  professional_license_valid_until: string
  first_name: string
  last_name: string
  full_name: string
}

const ROLE_OPTIONS: { value: SystemRole; label: string }[] = [
  { value: 'employee', label: 'Darbuotojas' },
  { value: 'admin', label: 'Administratorius' },
]

const STAFF_TYPE_OPTIONS: { value: NonNullable<StaffType>; label: string }[] = [
  { value: 'care_worker', label: 'Individuali priežiūra' },
  { value: 'nursing_staff', label: 'Slauga' },
  { value: 'kitchen', label: 'Valgykla' },
  { value: 'reception', label: 'Registratūra' },
  { value: 'administration', label: 'Administracija' },
]

const POSITION_OPTIONS = [
  { value: '', label: 'Nenurodyta' },
  { value: 'direktorius', label: 'Direktorius' },
  { value: 'direktoriaus_pavaduotojas', label: 'Direktoriaus pavaduotojas' },
  { value: 'administratorius', label: 'Administratorius' },
  { value: 'vyr_slaugytojas', label: 'Vyr. slaugytojas' },
  { value: 'slaugytojas', label: 'Slaugytojas' },
  {
    value: 'individualios_prieziuros_darbuotojas',
    label: 'Individualios priežiūros darbuotojas',
  },
  { value: 'ukvedys', label: 'Ūkvedys' },
  {
    value: 'vyr_socialinis_darbuotojas',
    label: 'Vyr. socialinis darbuotojas',
  },
  { value: 'socialinis_darbuotojas', label: 'Socialinis darbuotojas' },
]

function getRoleLabel(role: string | null) {
  switch (role) {
    case 'owner':
      return 'Savininkas'
    case 'admin':
      return 'Administratorius'
    case 'employee':
      return 'Darbuotojas'
    default:
      return '—'
  }
}

function getStaffTypeLabel(value: StaffType) {
  switch (value) {
    case 'care_worker':
      return 'Individuali priežiūra'
    case 'nursing_staff':
      return 'Slauga'
    case 'kitchen':
      return 'Valgykla'
    case 'reception':
      return 'Registratūra'
    case 'administration':
      return 'Administracija'
    default:
      return 'Nenurodyta'
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

function getReadableError(error: unknown) {
  if (!error) return 'Nežinoma klaida.'
  if (error instanceof Error) return error.message

  if (typeof error === 'object') {
    const maybeError = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
      error?: string
      statusCode?: string | number
    }

    if (maybeError.message) return maybeError.message
    if (maybeError.details) return maybeError.details
    if (maybeError.hint) return maybeError.hint
    if (maybeError.error) return maybeError.error
    if (maybeError.code) return `Klaidos kodas: ${maybeError.code}`
    if (maybeError.statusCode) return `Statusas: ${maybeError.statusCode}`
  }

  return 'Nepavyko įvykdyti veiksmo.'
}

function buildFullName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim()
}

function getDisplayName(member: Member, privileged: boolean) {
  const full = [member.first_name, member.last_name].filter(Boolean).join(' ').trim()

  if (privileged) {
    if (full) return full
    if (member.full_name?.trim()) return member.full_name.trim()
    return member.email || 'Nežinomas darbuotojas'
  }

  if (member.first_name?.trim() && member.last_name?.trim()) {
    return `${member.first_name.trim()} ${member.last_name.trim().charAt(0)}.`
  }

  if (member.first_name?.trim()) return member.first_name.trim()
  if (member.full_name?.trim()) return member.full_name.trim()
  return member.email || 'Darbuotojas'
}

function getHealthStatus(validUntil: string | null) {
  if (!validUntil) {
    return {
      label: 'Nenurodyta',
      style: {
        background: '#f3f4f6',
        color: '#374151',
        border: '1px solid #e5e7eb',
      },
    }
  }

  const today = new Date()
  const end = new Date(validUntil)
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const diffDays = Math.ceil(
    (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays < 0) {
    return {
      label: 'Negalioja',
      style: {
        background: '#fee2e2',
        color: '#b91c1c',
        border: '1px solid #fecaca',
      },
    }
  }

  if (diffDays <= 30) {
    return {
      label: 'Baigiasi netrukus',
      style: {
        background: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fde68a',
      },
    }
  }

  return {
    label: 'Galioja',
    style: {
      background: '#dcfce7',
      color: '#166534',
      border: '1px solid #bbf7d0',
    },
  }
}

function getLicenseStatus(validUntil: string | null, licenseNumber: string | null) {
  if (!licenseNumber) {
    return {
      label: 'Nenurodyta',
      style: {
        background: '#f3f4f6',
        color: '#374151',
        border: '1px solid #e5e7eb',
      },
    }
  }

  if (!validUntil) {
    return {
      label: 'Be galiojimo datos',
      style: {
        background: '#e0f2fe',
        color: '#0369a1',
        border: '1px solid #bae6fd',
      },
    }
  }

  const today = new Date()
  const end = new Date(validUntil)
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const diffDays = Math.ceil(
    (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays < 0) {
    return {
      label: 'Negalioja',
      style: {
        background: '#fee2e2',
        color: '#b91c1c',
        border: '1px solid #fecaca',
      },
    }
  }

  if (diffDays <= 30) {
    return {
      label: 'Baigiasi',
      style: {
        background: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fde68a',
      },
    }
  }

  return {
    label: 'Galioja',
    style: {
      background: '#dcfce7',
      color: '#166534',
      border: '1px solid #bbf7d0',
    },
  }
}

export default function TeamPage() {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<SystemRole | ''>('')

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [staffTypeFilter, setStaffTypeFilter] = useState('')
  const [healthFilter, setHealthFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_desc')

  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditMemberForm | null>(null)
  const [rowSavingId, setRowSavingId] = useState<string | null>(null)

  const canManageMembers = myRole === 'owner' || myRole === 'admin'
  const canSeeMedicalFields = myRole === 'owner' || myRole === 'admin'
  const privilegedView = myRole === 'owner' || myRole === 'admin'

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

      const { data: myMembershipData, error: myMembershipError } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)

      if (myMembershipError || !myMembershipData || myMembershipData.length === 0) {
        setMessage('Nepavyko nustatyti tavo organizacijos.')
        setLoading(false)
        return
      }

      const myMembership = myMembershipData[0] as {
        organization_id: string
        role: SystemRole
      }

      setOrganizationId(myMembership.organization_id)
      setMyRole(myMembership.role)

      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select(
          'user_id, organization_id, role, staff_type, position, department, is_deputy, occupational_health_valid_until, professional_license_number, professional_license_valid_until, created_at'
        )
        .eq('organization_id', myMembership.organization_id)
        .order('created_at', { ascending: false })

      if (membersError || !membersData) {
        setMessage('Nepavyko užkrauti darbuotojų.')
        setLoading(false)
        return
      }

      const typedMembers = membersData as MembershipRow[]
      const userIds = typedMembers.map((item) => item.user_id)

      let profilesMap = new Map<string, ProfileRow>()

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, full_name')
          .in('id', userIds)

        if (profilesError) {
          console.error('Profiles load error:', profilesError)
        } else {
          const typedProfiles = (profilesData || []) as ProfileRow[]
          profilesMap = new Map(typedProfiles.map((profile) => [profile.id, profile]))
        }
      }

      const merged: Member[] = typedMembers.map((item) => {
        const profile = profilesMap.get(item.user_id)

        return {
          user_id: item.user_id,
          organization_id: item.organization_id,
          role: item.role,
          staff_type: item.staff_type,
          position: item.position,
          department: item.department,
          is_deputy: Boolean(item.is_deputy),
          occupational_health_valid_until: item.occupational_health_valid_until,
          professional_license_number: item.professional_license_number,
          professional_license_valid_until: item.professional_license_valid_until,
          created_at: item.created_at,
          email: profile?.email || null,
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null,
          full_name: profile?.full_name || null,
        }
      })

      if (!canManageMembers) {
        setMembers(merged.filter((member) => member.user_id === user.id))
      } else {
        setMembers(merged)
      }
    } catch (error: any) {
      setMembers([])
      setMessage(error?.message || 'Nepavyko įkelti darbuotojų.')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(member: Member) {
    setEditingUserId(member.user_id)
    setEditForm({
      user_id: member.user_id,
      role: member.role,
      staff_type: member.staff_type,
      position: member.position || '',
      department: member.department || '',
      is_deputy: member.is_deputy,
      occupational_health_valid_until: member.occupational_health_valid_until || '',
      professional_license_number: member.professional_license_number || '',
      professional_license_valid_until: member.professional_license_valid_until || '',
      first_name: member.first_name || '',
      last_name: member.last_name || '',
      full_name:
        member.full_name ||
        buildFullName(member.first_name || '', member.last_name || ''),
    })
  }

  function cancelEdit() {
    setEditingUserId(null)
    setEditForm(null)
  }

  async function handleSaveMember() {
    if (!organizationId || !editForm) return

    setRowSavingId(editForm.user_id)
    setMessage('')

    try {
      const firstName = editForm.first_name.trim()
      const lastName = editForm.last_name.trim()
      const computedFullName =
        editForm.full_name.trim() || buildFullName(firstName, lastName)

      const membershipPayload = {
        role: editForm.role,
        staff_type: editForm.staff_type || null,
        position: editForm.position || null,
        department: editForm.department.trim() || null,
        is_deputy: Boolean(editForm.is_deputy),
        occupational_health_valid_until:
          editForm.occupational_health_valid_until || null,
        professional_license_number:
          editForm.professional_license_number.trim() || null,
        professional_license_valid_until:
          editForm.professional_license_valid_until || null,
      }

      const { error: membershipError } = await supabase
        .from('organization_members')
        .update(membershipPayload)
        .eq('organization_id', organizationId)
        .eq('user_id', editForm.user_id)

      if (membershipError) throw membershipError

      const profilePayload = {
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: computedFullName || null,
      }

      const { data: existingProfile, error: existingProfileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', editForm.user_id)
        .maybeSingle()

      if (existingProfileError) throw existingProfileError

      if (existingProfile?.id) {
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update(profilePayload)
          .eq('id', editForm.user_id)

        if (profileUpdateError) throw profileUpdateError
      } else {
        const { error: profileInsertError } = await supabase
          .from('profiles')
          .insert({
            id: editForm.user_id,
            email: null,
            ...profilePayload,
          })

        if (profileInsertError) throw profileInsertError
      }

      setEditingUserId(null)
      setEditForm(null)
      setMessage('Darbuotojo informacija sėkmingai atnaujinta.')
      await loadData()
    } catch (error) {
      setMessage(`Nepavyko atnaujinti darbuotojo: ${getReadableError(error)}`)
    } finally {
      setRowSavingId(null)
    }
  }

  async function handleDeleteMember(userId: string) {
    if (!organizationId) return
    if (!confirm('Ar tikrai nori pašalinti šį darbuotoją?')) return

    setMessage('')

    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', organizationId)
        .eq('user_id', userId)

      if (error) throw error

      setMessage('Darbuotojas sėkmingai pašalintas.')
      await loadData()
    } catch (error) {
      setMessage(`Nepavyko pašalinti darbuotojo: ${getReadableError(error)}`)
    }
  }

  function clearAllFilters() {
    setSearch('')
    setRoleFilter('')
    setStaffTypeFilter('')
    setHealthFilter('')
    setSortBy('created_desc')
  }

  const filteredMembers = useMemo(() => {
    let result = [...members]

    if (search.trim()) {
      const q = search.trim().toLowerCase()

      result = result.filter((member) => {
        const health = getHealthStatus(member.occupational_health_valid_until).label
        const displayName = getDisplayName(member, privilegedView)

        return [
          displayName,
          member.email || '',
          getRoleLabel(member.role),
          getStaffTypeLabel(member.staff_type),
          getPositionLabel(member.position),
          member.department || '',
          health,
          member.is_deputy ? 'pavaduojantis' : '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      })
    }

    if (roleFilter) {
      result = result.filter((member) => member.role === roleFilter)
    }

    if (staffTypeFilter) {
      result = result.filter((member) => (member.staff_type || '') === staffTypeFilter)
    }

    if (healthFilter) {
      result = result.filter((member) => {
        const label = getHealthStatus(member.occupational_health_valid_until).label

        if (healthFilter === 'valid') return label === 'Galioja'
        if (healthFilter === 'expiring') return label === 'Baigiasi netrukus'
        if (healthFilter === 'expired') return label === 'Negalioja'
        if (healthFilter === 'empty') return label === 'Nenurodyta'
        return true
      })
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return getDisplayName(a, privilegedView).localeCompare(
            getDisplayName(b, privilegedView),
            'lt'
          )
        case 'name_desc':
          return getDisplayName(b, privilegedView).localeCompare(
            getDisplayName(a, privilegedView),
            'lt'
          )
        case 'role_asc':
          return getRoleLabel(a.role).localeCompare(getRoleLabel(b.role), 'lt')
        case 'role_desc':
          return getRoleLabel(b.role).localeCompare(getRoleLabel(a.role), 'lt')
        case 'created_asc':
          return (
            new Date(a.created_at || '').getTime() -
            new Date(b.created_at || '').getTime()
          )
        case 'created_desc':
        default:
          return (
            new Date(b.created_at || '').getTime() -
            new Date(a.created_at || '').getTime()
          )
      }
    })

    return result
  }, [members, search, roleFilter, staffTypeFilter, healthFilter, sortBy, privilegedView])

  const stats = useMemo(() => {
    const total = members.length
    const admins = members.filter(
      (member) => member.role === 'owner' || member.role === 'admin'
    ).length
    const nursing = members.filter((member) => member.staff_type === 'nursing_staff').length
    const expiringHealth = members.filter(
      (member) =>
        getHealthStatus(member.occupational_health_valid_until).label ===
        'Baigiasi netrukus'
    ).length
    const expiredHealth = members.filter(
      (member) =>
        getHealthStatus(member.occupational_health_valid_until).label ===
        'Negalioja'
    ).length

    return {
      total,
      admins,
      nursing,
      expiringHealth,
      expiredHealth,
    }
  }, [members])

  return (
    <div style={styles.outer}>
      <div style={styles.page}>
        <div style={styles.topBar}>
          <Link href="/dashboard" style={styles.backLink}>
            ← Grįžti į dashboard
          </Link>
        </div>

        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Darbuotojai</h1>
            <p style={styles.subtitle}>
              Darbuotojų sąrašas, rolės, pareigos, skyriai ir darbo dokumentų kontrolė.
            </p>
          </div>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        <div style={styles.statsRow}>
          <StatCard label="Visi darbuotojai" value={String(stats.total)} />
          <StatCard label="Admin / savininkai" value={String(stats.admins)} />
          <StatCard label="Slaugos darbuotojai" value={String(stats.nursing)} />
          <StatCard label="Pažyma baigiasi" value={String(stats.expiringHealth)} />
          <StatCard label="Pažyma negalioja" value={String(stats.expiredHealth)} />
        </div>

        <div style={styles.filtersCard}>
          <div style={styles.cardHeader}>
            <h2 style={styles.sectionTitle}>Filtrai ir rūšiavimas</h2>

            <button onClick={clearAllFilters} style={styles.secondaryButton}>
              Valyti filtrus
            </button>
          </div>

          <div style={styles.filtersGrid}>
            <Field label="Paieška">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Vardas, el. paštas, rolė, pareigos..."
                style={styles.input}
              />
            </Field>

            <Field label="Rolė">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={styles.input}
              >
                <option value="">Visos</option>
                <option value="owner">Savininkas</option>
                <option value="admin">Administratorius</option>
                <option value="employee">Darbuotojas</option>
              </select>
            </Field>

            <Field label="Darbuotojo tipas">
              <select
                value={staffTypeFilter}
                onChange={(e) => setStaffTypeFilter(e.target.value)}
                style={styles.input}
              >
                <option value="">Visi</option>
                {STAFF_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Med. pažyma">
              <select
                value={healthFilter}
                onChange={(e) => setHealthFilter(e.target.value)}
                style={styles.input}
              >
                <option value="">Visos</option>
                <option value="valid">Galioja</option>
                <option value="expiring">Baigiasi netrukus</option>
                <option value="expired">Negalioja</option>
                <option value="empty">Nenurodyta</option>
              </select>
            </Field>

            <Field label="Rūšiavimas">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={styles.input}
              >
                <option value="created_desc">Naujausi viršuje</option>
                <option value="created_asc">Seniausi viršuje</option>
                <option value="name_asc">Vardas A–Ž</option>
                <option value="name_desc">Vardas Ž–A</option>
                <option value="role_asc">Rolė A–Ž</option>
                <option value="role_desc">Rolė Ž–A</option>
              </select>
            </Field>
          </div>
        </div>

        <div style={styles.tableCard}>
          <div style={styles.cardHeader}>
            <h2 style={styles.sectionTitle}>Darbuotojų lentelė</h2>
            <button onClick={loadData} style={styles.secondaryButton}>
              Atnaujinti
            </button>
          </div>

          {loading ? (
            <div style={styles.emptyState}>Kraunami darbuotojai...</div>
          ) : filteredMembers.length === 0 ? (
            <div style={styles.emptyState}>Darbuotojų nerasta.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Darbuotojas</th>
                    <th style={styles.th}>Rolė</th>
                    <th style={styles.th}>Tipas</th>
                    <th style={styles.th}>Pareigos</th>
                    <th style={styles.th}>Skyrius</th>
                    <th style={styles.th}>Med. pažyma</th>
                    <th style={styles.th}>Licencija</th>
                    <th style={styles.th}>Sukurta</th>
                    <th style={styles.th}>Veiksmai</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMembers.map((member) => {
                    const isCurrentUser = member.user_id === currentUserId
                    const isOwner = member.role === 'owner'
                    const canEditThisMember =
                      canManageMembers && !isOwner && !isCurrentUser

                    const healthStatus = getHealthStatus(
                      member.occupational_health_valid_until
                    )
                    const licenseStatus = getLicenseStatus(
                      member.professional_license_valid_until,
                      member.professional_license_number
                    )

                    return (
                      <Fragment key={member.user_id}>
                        <tr style={styles.tr}>
                          <td style={styles.tdBold}>
                            <div style={styles.personCell}>
                              <div style={styles.personName}>
                                {getDisplayName(member, privilegedView)}
                              </div>
                              <div style={styles.personMeta}>
                                {member.email || 'Be el. pašto'}
                              </div>
                            </div>
                          </td>

                          <td style={styles.td}>{getRoleLabel(member.role)}</td>
                          <td style={styles.td}>{getStaffTypeLabel(member.staff_type)}</td>
                          <td style={styles.td}>{getPositionLabel(member.position)}</td>
                          <td style={styles.td}>{member.department || '—'}</td>

                          <td style={styles.td}>
                            {canSeeMedicalFields ? (
                              <div style={styles.medCell}>
                                <span
                                  style={{
                                    ...styles.statusBadge,
                                    ...healthStatus.style,
                                  }}
                                >
                                  {healthStatus.label}
                                </span>
                                <div style={styles.smallMeta}>
                                  Iki:{' '}
                                  {member.occupational_health_valid_until
                                    ? new Date(
                                        member.occupational_health_valid_until
                                      ).toLocaleDateString('lt-LT')
                                    : '—'}
                                </div>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>

                          <td style={styles.td}>
                            {canSeeMedicalFields ? (
                              <div style={styles.medCell}>
                                <span
                                  style={{
                                    ...styles.statusBadge,
                                    ...licenseStatus.style,
                                  }}
                                >
                                  {licenseStatus.label}
                                </span>
                                <div style={styles.smallMeta}>
                                  Nr.: {member.professional_license_number || '—'}
                                </div>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>

                          <td style={styles.td}>
                            {member.created_at
                              ? new Date(member.created_at).toLocaleDateString('lt-LT')
                              : '—'}
                          </td>

                          <td style={styles.td}>
                            <div style={styles.actionsCell}>
                              {canEditThisMember ? (
                                <button
                                  onClick={() => startEdit(member)}
                                  style={styles.smallButton}
                                >
                                  Redaguoti
                                </button>
                              ) : (
                                <span style={styles.readonlyText}>
                                  {isOwner
                                    ? 'Savininko keisti negalima'
                                    : isCurrentUser
                                    ? 'Savo įrašo čia keisti negalima'
                                    : 'Tik peržiūra'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {editingUserId === member.user_id && editForm ? (
                          <tr style={styles.editRow}>
                            <td colSpan={9} style={styles.editCell}>
                              <div style={styles.editBox}>
                                <div style={styles.editTitle}>
                                  Redaguojamas darbuotojas:{' '}
                                  <strong>
                                    {buildFullName(editForm.first_name, editForm.last_name) ||
                                      editForm.full_name ||
                                      member.email ||
                                      'Nežinomas darbuotojas'}
                                  </strong>
                                </div>

                                <div style={styles.editGrid}>
                                  <Field label="Vardas">
                                    <input
                                      value={editForm.first_name}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          first_name: e.target.value,
                                          full_name:
                                            editForm.full_name.trim() ||
                                            buildFullName(e.target.value, editForm.last_name),
                                        })
                                      }
                                      placeholder="Pvz. Jonas"
                                      style={styles.input}
                                    />
                                  </Field>

                                  <Field label="Pavardė">
                                    <input
                                      value={editForm.last_name}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          last_name: e.target.value,
                                          full_name:
                                            editForm.full_name.trim() ||
                                            buildFullName(editForm.first_name, e.target.value),
                                        })
                                      }
                                      placeholder="Pvz. Jonaitis"
                                      style={styles.input}
                                    />
                                  </Field>

                                  <Field label="Pilnas vardas">
                                    <input
                                      value={editForm.full_name}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          full_name: e.target.value,
                                        })
                                      }
                                      placeholder="Pvz. Jonas Jonaitis"
                                      style={styles.input}
                                    />
                                  </Field>

                                  <Field label="Rolė">
                                    <select
                                      value={editForm.role}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          role: e.target.value as SystemRole,
                                        })
                                      }
                                      style={styles.input}
                                    >
                                      {ROLE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </Field>

                                  <Field label="Darbuotojo tipas">
                                    <select
                                      value={editForm.staff_type || ''}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          staff_type:
                                            (e.target.value as StaffType) || null,
                                        })
                                      }
                                      style={styles.input}
                                    >
                                      <option value="">Nepasirinkta</option>
                                      {STAFF_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </Field>

                                  <Field label="Pareigos">
                                    <select
                                      value={editForm.position}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          position: e.target.value,
                                        })
                                      }
                                      style={styles.input}
                                    >
                                      {POSITION_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </Field>

                                  <Field label="Skyrius">
                                    <input
                                      value={editForm.department}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          department: e.target.value,
                                        })
                                      }
                                      placeholder="Pvz. Slauga, Virtuvė"
                                      style={styles.input}
                                    />
                                  </Field>

                                  <Field label="Med. pažyma galioja iki">
                                    <input
                                      type="date"
                                      value={editForm.occupational_health_valid_until}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          occupational_health_valid_until: e.target.value,
                                        })
                                      }
                                      style={styles.input}
                                    />
                                  </Field>

                                  <Field label="Licencijos nr.">
                                    <input
                                      value={editForm.professional_license_number}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          professional_license_number: e.target.value,
                                        })
                                      }
                                      placeholder="Pvz. MPL-123456"
                                      style={styles.input}
                                    />
                                  </Field>

                                  <Field label="Licencija galioja iki">
                                    <input
                                      type="date"
                                      value={editForm.professional_license_valid_until}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          professional_license_valid_until: e.target.value,
                                        })
                                      }
                                      style={styles.input}
                                    />
                                  </Field>

                                  <Field label="Pavaduojantis">
                                    <label style={styles.checkboxLabel}>
                                      <input
                                        type="checkbox"
                                        checked={editForm.is_deputy}
                                        onChange={(e) =>
                                          setEditForm({
                                            ...editForm,
                                            is_deputy: e.target.checked,
                                          })
                                        }
                                      />
                                      Gali pavaduoti
                                    </label>
                                  </Field>
                                </div>

                                <div style={styles.formActions}>
                                  <button
                                    onClick={handleSaveMember}
                                    disabled={rowSavingId === member.user_id}
                                    style={styles.primaryButton}
                                  >
                                    {rowSavingId === member.user_id
                                      ? 'Saugoma...'
                                      : 'Išsaugoti pakeitimus'}
                                  </button>

                                  <button
                                    onClick={cancelEdit}
                                    style={styles.secondaryButton}
                                  >
                                    Atšaukti
                                  </button>

                                  <button
                                    onClick={() => handleDeleteMember(member.user_id)}
                                    style={styles.deleteButton}
                                  >
                                    Pašalinti darbuotoją
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
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
  },
  page: {
    width: '100%',
    maxWidth: 1700,
    margin: '0 auto',
    display: 'grid',
    gap: 18,
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  backLink: {
    textDecoration: 'none',
    color: '#111827',
    fontSize: 14,
    fontWeight: 700,
    padding: '8px 12px',
    borderRadius: 10,
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
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
  },
  subtitle: {
    margin: '10px 0 0',
    color: '#6b7280',
    fontSize: 17,
  },
  message: {
    padding: '12px 14px',
    borderRadius: 14,
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    color: '#111827',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
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
    color: '#111827',
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: 600,
  },
  filtersCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 22,
    padding: 20,
    display: 'grid',
    gap: 16,
  },
  tableCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 22,
    padding: 20,
    display: 'grid',
    gap: 16,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: 14,
  },
  editGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 14,
  },
  field: {
    display: 'grid',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 700,
    color: '#111827',
  },
  input: {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: 12,
    padding: '11px 12px',
    fontSize: 14,
    outline: 'none',
    background: '#fff',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    padding: '0 2px',
    color: '#111827',
    fontSize: 14,
    fontWeight: 600,
  },
  formActions: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  primaryButton: {
    border: 'none',
    borderRadius: 12,
    padding: '12px 18px',
    background: '#0f172a',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
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
  smallButton: {
    border: '1px solid #d1d5db',
    borderRadius: 10,
    padding: '8px 10px',
    background: '#fff',
    color: '#111827',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  deleteButton: {
    border: '1px solid #fecaca',
    borderRadius: 10,
    padding: '12px 16px',
    background: '#fff1f2',
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  readonlyText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: 700,
  },
  emptyState: {
    padding: 24,
    textAlign: 'center',
    color: '#6b7280',
    border: '1px dashed #d1d5db',
    borderRadius: 16,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 1500,
    tableLayout: 'fixed',
  },
  th: {
    textAlign: 'left',
    padding: '12px 10px',
    borderBottom: '1px solid #e5e7eb',
    color: '#6b7280',
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '14px 10px',
    color: '#374151',
    fontSize: 14,
    fontWeight: 500,
    verticalAlign: 'middle',
  },
  tdBold: {
    padding: '14px 10px',
    color: '#111827',
    fontSize: 14,
    fontWeight: 800,
    verticalAlign: 'middle',
  },
  personCell: {
    display: 'grid',
    gap: 4,
  },
  personName: {
    color: '#111827',
    fontWeight: 800,
    fontSize: 14,
  },
  personMeta: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: 500,
    wordBreak: 'break-all',
  },
  medCell: {
    display: 'grid',
    gap: 6,
  },
  smallMeta: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: 600,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  actionsCell: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  editRow: {
    background: '#f8fafc',
  },
  editCell: {
    padding: 0,
  },
  editBox: {
    padding: 16,
    display: 'grid',
    gap: 14,
    borderTop: '1px dashed #d1d5db',
  },
  editTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#111827',
  },
}