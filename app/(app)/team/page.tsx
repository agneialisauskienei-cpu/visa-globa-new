'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

type MemberRole = 'owner' | 'admin' | 'employee' | string

type Employee = {
  id: string
  organization_member_id?: string
  full_name: string
  first_name: string
  last_name: string
  email: string
  role: MemberRole | null
  is_active: boolean
  created_at?: string | null
}

type EditForm = {
  id: string
  full_name: string
  first_name: string
  last_name: string
  email: string
  role: MemberRole
  is_active: boolean
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function roleLabel(role: string | null) {
  switch (role) {
    case 'owner':
      return 'Savininkas'
    case 'admin':
      return 'Administratorius'
    case 'employee':
      return 'Darbuotojas'
    default:
      return role || 'Nenurodyta'
  }
}

function roleBadgeStyle(role: string | null) {
  switch (role) {
    case 'owner':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'admin':
      return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'employee':
      return 'bg-slate-50 text-slate-700 border-slate-200'
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('lt-LT')
}

export default function TeamPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'admin' | 'employee'>('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'newest' | 'oldest'>('name')

  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)

  useEffect(() => {
    void bootstrap()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function bootstrap() {
    try {
      setLoading(true)
      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        setError(userError.message)
        return
      }

      if (!user) {
        setError('Nėra prisijungusio vartotojo.')
        return
      }

      const orgId = await getCurrentOrganizationId()

      if (!orgId) {
        setError('Nepavyko nustatyti aktyvios organizacijos.')
        return
      }

      setOrganizationId(orgId)
      await loadEmployees(orgId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Įvyko nenumatyta klaida.')
    } finally {
      setLoading(false)
    }
  }

  async function loadEmployees(orgId: string) {
    setError(null)

    const { data: members, error: membersError } = await supabase
      .from('organization_members')
      .select('id, user_id, role, is_active, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    if (membersError) {
      setError(membersError.message)
      return
    }

    const userIds = (members || []).map((m: any) => m.user_id).filter(Boolean)

    let profilesMap = new Map<string, any>()

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, email')
        .in('id', userIds)

      if (profilesError) {
        setError(profilesError.message)
        return
      }

      profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]))
    }

    const mapped: Employee[] = (members || []).map((member: any) => {
      const profile = profilesMap.get(member.user_id)

      const firstName = profile?.first_name || ''
      const lastName = profile?.last_name || ''
      const fullName =
        profile?.full_name ||
        [firstName, lastName].filter(Boolean).join(' ') ||
        profile?.email ||
        'Nežinomas darbuotojas'

      return {
        id: member.user_id,
        organization_member_id: member.id,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        email: profile?.email || '',
        role: member.role || null,
        is_active: member.is_active ?? true,
        created_at: member.created_at || null,
      }
    })

    setEmployees(mapped)
  }

  function resetMessages() {
    setError(null)
    setSuccess(null)
  }

  function openEditModal(employee: Employee) {
    resetMessages()
    setEditingEmployeeId(employee.id)
    setEditForm({
      id: employee.id,
      full_name: employee.full_name === 'Nežinomas darbuotojas' ? '' : employee.full_name,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      role: employee.role || 'employee',
      is_active: employee.is_active,
    })
  }

  function closeModal() {
    setEditingEmployeeId(null)
    setEditForm(null)
  }

  async function saveEmployee() {
    if (!organizationId || !editForm) return

    try {
      setSaving(true)
      resetMessages()

      const cleanFullName = editForm.full_name.trim()
      const cleanFirstName = editForm.first_name.trim()
      const cleanLastName = editForm.last_name.trim()

      const profilePayload: Record<string, any> = {
        full_name:
          cleanFullName ||
          [cleanFirstName, cleanLastName].filter(Boolean).join(' ') ||
          null,
        first_name: cleanFirstName || null,
        last_name: cleanLastName || null,
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profilePayload)
        .eq('id', editForm.id)

      if (profileError) {
        setError(profileError.message)
        return
      }

      const { error: memberError } = await supabase
        .from('organization_members')
        .update({
          role: editForm.role,
          is_active: editForm.is_active,
        })
        .eq('organization_id', organizationId)
        .eq('user_id', editForm.id)

      if (memberError) {
        setError(memberError.message)
        return
      }

      await loadEmployees(organizationId)
      setSuccess('Darbuotojo duomenys išsaugoti.')
      closeModal()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nepavyko išsaugoti darbuotojo.')
    } finally {
      setSaving(false)
    }
  }

  const stats = useMemo(() => {
    const total = employees.length
    const owners = employees.filter((e) => e.role === 'owner').length
    const admins = employees.filter((e) => e.role === 'admin').length
    const workers = employees.filter((e) => e.role === 'employee').length
    const active = employees.filter((e) => e.is_active).length
    const inactive = total - active

    return { total, owners, admins, workers, active, inactive }
  }, [employees])

  const filteredEmployees = useMemo(() => {
    let rows = [...employees]
    const q = search.trim().toLowerCase()

    if (q) {
      rows = rows.filter((employee) =>
        `${employee.full_name} ${employee.email} ${roleLabel(employee.role)}`
          .toLowerCase()
          .includes(q)
      )
    }

    if (roleFilter !== 'all') {
      rows = rows.filter((employee) => employee.role === roleFilter)
    }

    if (activeFilter === 'active') {
      rows = rows.filter((employee) => employee.is_active)
    } else if (activeFilter === 'inactive') {
      rows = rows.filter((employee) => !employee.is_active)
    }

    rows.sort((a, b) => {
      switch (sortBy) {
        case 'role':
          return roleLabel(a.role).localeCompare(roleLabel(b.role), 'lt')
        case 'newest':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        case 'oldest':
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        case 'name':
        default:
          return a.full_name.localeCompare(b.full_name, 'lt')
      }
    })

    return rows
  }, [employees, search, roleFilter, activeFilter, sortBy])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f6f4]">
        <div className="p-6 lg:p-8">
          <div className="rounded-[28px] bg-white p-6 text-sm text-slate-600 shadow-sm">
            Kraunamas darbuotojų modulis...
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f6f4]">
      <div className="space-y-6 p-6 lg:p-8">
        <section className="rounded-[32px] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
                Komandos valdymas
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
                Darbuotojai
              </h1>

              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-500">
                Valdyk organizacijos darbuotojus, jų roles ir aktyvumą pagal pasirinktą aktyvią organizaciją.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="text-sm text-slate-500">Aktyvi organizacija</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {organizationId || 'Nepasirinkta'}
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Iš viso" value={String(stats.total)} meta={`${stats.active} aktyvūs`} />
          <StatCard title="Administratoriai" value={String(stats.admins)} meta={`${stats.owners} savininkai`} />
          <StatCard title="Darbuotojai" value={String(stats.workers)} meta="Employee role" />
          <StatCard title="Neaktyvūs" value={String(stats.inactive)} meta="Reikalauja peržiūros" />
        </section>

        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ieškoti pagal vardą, el. paštą..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
            />

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
            >
              <option value="all">Visos rolės</option>
              <option value="owner">Savininkai</option>
              <option value="admin">Administratoriai</option>
              <option value="employee">Darbuotojai</option>
            </select>

            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as any)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
            >
              <option value="all">Visi statusai</option>
              <option value="active">Tik aktyvūs</option>
              <option value="inactive">Tik neaktyvūs</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
            >
              <option value="name">Rikiuoti pagal vardą</option>
              <option value="role">Rikiuoti pagal rolę</option>
              <option value="newest">Naujausi viršuje</option>
              <option value="oldest">Seniausi viršuje</option>
            </select>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-4 shadow-sm">
          {filteredEmployees.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
              Darbuotojų pagal pasirinktus filtrus nerasta.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2">Darbuotojas</th>
                    <th className="px-4 py-2">El. paštas</th>
                    <th className="px-4 py-2">Rolė</th>
                    <th className="px-4 py-2">Statusas</th>
                    <th className="px-4 py-2">Sukurtas</th>
                    <th className="px-4 py-2 text-right">Veiksmai</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="rounded-2xl bg-slate-50">
                      <td className="rounded-l-2xl px-4 py-4">
                        <div className="font-medium text-slate-900">{employee.full_name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {employee.first_name || employee.last_name
                            ? [employee.first_name, employee.last_name].filter(Boolean).join(' ')
                            : '—'}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {employee.email || '—'}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                            roleBadgeStyle(employee.role)
                          )}
                        >
                          {roleLabel(employee.role)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
                            employee.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-700'
                          )}
                        >
                          {employee.is_active ? 'Aktyvus' : 'Neaktyvus'}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-500">
                        {formatDate(employee.created_at)}
                      </td>

                      <td className="rounded-r-2xl px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(employee)}
                          className="rounded-xl bg-[#0f4f3d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0c4333]"
                        >
                          Redaguoti
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {editingEmployeeId && editForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Redaguoti darbuotoją</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Koreguok vardą, rolę ir aktyvumo būseną.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Uždaryti
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Pilnas vardas
                </label>
                <input
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, full_name: e.target.value } : prev))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Vardas
                </label>
                <input
                  value={editForm.first_name}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, first_name: e.target.value } : prev))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Pavardė
                </label>
                <input
                  value={editForm.last_name}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, last_name: e.target.value } : prev))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  El. paštas
                </label>
                <input
                  value={editForm.email}
                  disabled
                  className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Rolė
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, role: e.target.value } : prev))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
                >
                  <option value="owner">Savininkas</option>
                  <option value="admin">Administratorius</option>
                  <option value="employee">Darbuotojas</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) =>
                      setEditForm((prev) => (prev ? { ...prev, is_active: e.target.checked } : prev))
                    }
                  />
                  Aktyvus darbuotojas
                </label>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Atšaukti
              </button>

              <button
                type="button"
                onClick={() => void saveEmployee()}
                disabled={saving}
                className="rounded-xl bg-[#0f4f3d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0c4333] disabled:opacity-60"
              >
                {saving ? 'Saugoma...' : 'Išsaugoti'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function StatCard({
  title,
  value,
  meta,
}: {
  title: string
  value: string
  meta: string
}) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-3 text-4xl font-bold leading-none text-slate-900">{value}</div>
      <div className="mt-3 text-xs text-slate-400">{meta}</div>
    </div>
  )
}