"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type MemberRole = "owner" | "admin" | "employee" | string

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
  return classes.filter(Boolean).join(" ")
}

function roleLabel(role: string | null) {
  switch (role) {
    case "owner":
      return "Savininkas"
    case "admin":
      return "Administratorius"
    case "employee":
      return "Darbuotojas"
    default:
      return role || "Nenurodyta"
  }
}

function roleBadgeStyle(role: string | null) {
  switch (role) {
    case "owner":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "admin":
      return "bg-violet-50 text-violet-700 border-violet-200"
    case "employee":
      return "bg-slate-50 text-slate-700 border-slate-200"
    default:
      return "bg-slate-50 text-slate-600 border-slate-200"
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("lt-LT")
}

export default function TeamPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | "owner" | "admin" | "employee">("all")
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all")
  const [sortBy, setSortBy] = useState<"name" | "role" | "newest" | "oldest">("name")

  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)

  useEffect(() => {
    void bootstrap()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
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
        setError("Nėra prisijungusio vartotojo.")
        return
      }

      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()

      if (membershipError) {
        setError(membershipError.message)
        return
      }

      if (!membership?.organization_id) {
        setError("Nepavyko nustatyti organizacijos.")
        return
      }

      setOrganizationId(membership.organization_id)
      await loadEmployees(membership.organization_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Įvyko nenumatyta klaida.")
    } finally {
      setLoading(false)
    }
  }

  async function loadEmployees(orgId: string) {
    setError(null)

    const { data: members, error: membersError } = await supabase
      .from("organization_members")
      .select("id, user_id, role, is_active, created_at")
      .eq("organization_id", orgId)

    if (membersError) {
      setError(membersError.message)
      return
    }

    const userIds = (members || []).map((m: any) => m.user_id).filter(Boolean)

    let profilesMap = new Map<string, any>()

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, first_name, last_name, email")
        .in("id", userIds)

      if (profilesError) {
        setError(profilesError.message)
        return
      }

      profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]))
    }

    const mapped: Employee[] = (members || []).map((member: any) => {
      const profile = profilesMap.get(member.user_id)

      const firstName = profile?.first_name || ""
      const lastName = profile?.last_name || ""
      const fullName =
        profile?.full_name ||
        [firstName, lastName].filter(Boolean).join(" ") ||
        profile?.email ||
        "Nežinomas darbuotojas"

      return {
        id: member.user_id,
        organization_member_id: member.id,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        email: profile?.email || "",
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
      full_name: employee.full_name === "Nežinomas darbuotojas" ? "" : employee.full_name,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      role: employee.role || "employee",
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
          [cleanFirstName, cleanLastName].filter(Boolean).join(" ") ||
          null,
        first_name: cleanFirstName || null,
        last_name: cleanLastName || null,
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profilePayload)
        .eq("id", editForm.id)

      if (profileError) {
        setError(profileError.message)
        return
      }

      const { error: memberError } = await supabase
        .from("organization_members")
        .update({
          role: editForm.role,
          is_active: editForm.is_active,
        })
        .eq("organization_id", organizationId)
        .eq("user_id", editForm.id)

      if (memberError) {
        setError(memberError.message)
        return
      }

      await loadEmployees(organizationId)
      setSuccess("Darbuotojo duomenys atnaujinti.")
      closeModal()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepavyko išsaugoti.")
    } finally {
      setSaving(false)
    }
  }

  const filteredEmployees = useMemo(() => {
    let rows = [...employees]

    const q = search.trim().toLowerCase()

    if (q) {
      rows = rows.filter((emp) =>
        [
          emp.full_name,
          emp.first_name,
          emp.last_name,
          emp.email,
          emp.role || "",
          roleLabel(emp.role),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    }

    if (roleFilter !== "all") {
      rows = rows.filter((emp) => emp.role === roleFilter)
    }

    if (activeFilter !== "all") {
      rows = rows.filter((emp) =>
        activeFilter === "active" ? emp.is_active : !emp.is_active
      )
    }

    rows.sort((a, b) => {
      if (sortBy === "name") {
        return a.full_name.localeCompare(b.full_name, "lt")
      }
      if (sortBy === "role") {
        return (a.role || "").localeCompare(b.role || "", "lt")
      }
      if (sortBy === "newest") {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    })

    return rows
  }, [employees, search, roleFilter, activeFilter, sortBy])

  const stats = useMemo(() => {
    const total = employees.length
    const owners = employees.filter((e) => e.role === "owner").length
    const admins = employees.filter((e) => e.role === "admin").length
    const active = employees.filter((e) => e.is_active).length
    const inactive = employees.filter((e) => !e.is_active).length

    return { total, owners, admins, active, inactive }
  }, [employees])

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Kraunama...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Darbuotojai
            </h1>
            <p className="mt-2 text-base text-slate-600">
              Darbuotojų sąrašas, rolės, būsenos ir greitas redagavimas vienoje vietoje.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => organizationId && loadEmployees(organizationId)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-100"
            >
              Atnaujinti
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Visi darbuotojai</div>
            <div className="mt-2 text-4xl font-bold text-slate-900">{stats.total}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Savininkai</div>
            <div className="mt-2 text-4xl font-bold text-slate-900">{stats.owners}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Administratoriai</div>
            <div className="mt-2 text-4xl font-bold text-slate-900">{stats.admins}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Aktyvūs</div>
            <div className="mt-2 text-4xl font-bold text-slate-900">{stats.active}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Neaktyvūs</div>
            <div className="mt-2 text-4xl font-bold text-slate-900">{stats.inactive}</div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-slate-900">Filtrai ir paieška</h2>
            <p className="mt-1 text-sm text-slate-500">
              Greitai rask darbuotoją pagal vardą, el. paštą ar rolę.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <div className="mb-1.5 text-sm font-medium text-slate-700">Paieška</div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Vardas, el. paštas, rolė..."
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
              />
            </label>

            <label className="block">
              <div className="mb-1.5 text-sm font-medium text-slate-700">Rolė</div>
              <select
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(e.target.value as "all" | "owner" | "admin" | "employee")
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
              >
                <option value="all">Visos</option>
                <option value="owner">Savininkas</option>
                <option value="admin">Administratorius</option>
                <option value="employee">Darbuotojas</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-1.5 text-sm font-medium text-slate-700">Būsena</div>
              <select
                value={activeFilter}
                onChange={(e) =>
                  setActiveFilter(e.target.value as "all" | "active" | "inactive")
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
              >
                <option value="all">Visi</option>
                <option value="active">Aktyvūs</option>
                <option value="inactive">Neaktyvūs</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-1.5 text-sm font-medium text-slate-700">Rūšiavimas</div>
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as "name" | "role" | "newest" | "oldest")
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
              >
                <option value="name">Pagal vardą</option>
                <option value="role">Pagal rolę</option>
                <option value="newest">Naujausi viršuje</option>
                <option value="oldest">Seniausi viršuje</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Darbuotojų sąrašas</h2>
              <p className="mt-1 text-sm text-slate-500">
                Spausk „Redaguoti“, jei nori pakeisti vardą, rolę ar būseną.
              </p>
            </div>

            <div className="text-sm text-slate-500">
              Rasta: <span className="font-semibold text-slate-900">{filteredEmployees.length}</span>
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              Darbuotojų pagal pasirinktus filtrus nerasta.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-2xl font-bold text-slate-900">
                        {emp.full_name}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                            roleBadgeStyle(emp.role)
                          )}
                        >
                          {roleLabel(emp.role)}
                        </span>

                        <span
                          className={cn(
                            "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                            emp.is_active
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-rose-200 bg-rose-50 text-rose-700"
                          )}
                        >
                          {emp.is_active ? "Aktyvus" : "Neaktyvus"}
                        </span>
                      </div>

                      <div className="mt-4 space-y-1 text-sm text-slate-600">
                        <div>
                          <span className="font-medium text-slate-800">El. paštas:</span>{" "}
                          {emp.email || "Nenurodytas"}
                        </div>
                        <div>
                          <span className="font-medium text-slate-800">Sukurta:</span>{" "}
                          {formatDate(emp.created_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(emp)}
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                      >
                        Redaguoti
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {editForm && editingEmployeeId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Redaguoti darbuotoją</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Gali keisti vardą, rolę ir darbuotojo aktyvumą.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-xl text-slate-700 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <div className="mb-1.5 text-sm font-medium text-slate-700">Pilnas vardas</div>
                <input
                  autoFocus
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, full_name: e.target.value } : prev))
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                />
              </label>

              <label className="block">
                <div className="mb-1.5 text-sm font-medium text-slate-700">Rolė</div>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, role: e.target.value } : prev))
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                >
                  <option value="owner">Savininkas</option>
                  <option value="admin">Administratorius</option>
                  <option value="employee">Darbuotojas</option>
                </select>
              </label>

              <label className="block">
                <div className="mb-1.5 text-sm font-medium text-slate-700">Vardas</div>
                <input
                  value={editForm.first_name}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, first_name: e.target.value } : prev))
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                />
              </label>

              <label className="block">
                <div className="mb-1.5 text-sm font-medium text-slate-700">Pavardė</div>
                <input
                  value={editForm.last_name}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, last_name: e.target.value } : prev))
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                />
              </label>

              <label className="block md:col-span-2">
                <div className="mb-1.5 text-sm font-medium text-slate-700">El. paštas</div>
                <input
                  value={editForm.email}
                  disabled
                  className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 outline-none"
                />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, is_active: e.target.checked } : prev))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Darbuotojas aktyvus
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                Atšaukti
              </button>

              <button
                type="button"
                onClick={saveEmployee}
                disabled={saving}
                className="rounded-2xl border border-slate-900 bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saugoma..." : "Išsaugoti pakeitimus"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}