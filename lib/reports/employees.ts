import { SupabaseClient } from "@supabase/supabase-js"
import { ReportFilters, ReportResponse } from "./types"
import { fullName } from "./helpers"

export async function getEmployeesReport(
  supabase: SupabaseClient,
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResponse<any>> {
  let query = supabase
    .from("organization_members")
    .select(`
      id,
      user_id,
      organization_id,
      role,
      staff_type,
      position,
      department,
      is_active,
      employment_start_date
    `)
    .eq("organization_id", organizationId)

  if (!filters.includeInactive) query = query.eq("is_active", true)
  if (filters.department) query = query.eq("department", filters.department)
  if (filters.status === "active") query = query.eq("is_active", true)
  if (filters.status === "inactive") query = query.eq("is_active", false)
  if (filters.employeeId) query = query.eq("user_id", filters.employeeId)

  const { data, error } = await query.order("department", { ascending: true })

  if (error) throw error

  let rows = data ?? []

  const userIds = rows.map((x: any) => x.user_id).filter(Boolean)

  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select(`
          id,
          email,
          first_name,
          last_name,
          full_name,
          phone
        `)
        .in("id", userIds)
    : { data: [] }

  const profileMap = new Map(
    (profiles || []).map((profile: any) => [profile.id, profile])
  )

  let mergedRows = rows.map((row: any) => ({
    ...row,
    profile: profileMap.get(row.user_id) || null,
  }))

  if (filters.search) {
    const needle = filters.search.toLowerCase()

    mergedRows = mergedRows.filter((row: any) =>
      [
        fullName(row.profile),
        row.profile?.email,
        row.position,
        row.department,
        row.role,
        row.staff_type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    )
  }

  const active = mergedRows.filter((x: any) => x.is_active).length
  const inactive = mergedRows.filter((x: any) => !x.is_active).length
  const withoutPosition = mergedRows.filter((x: any) => !x.position).length
  const withoutDepartment = mergedRows.filter((x: any) => !x.department).length

  return {
    stats: [
      { label: "Aktyvūs darbuotojai", value: active, tone: "success" },
      { label: "Neaktyvūs darbuotojai", value: inactive },
      {
        label: "Be pareigybės",
        value: withoutPosition,
        tone: withoutPosition ? "warning" : "success",
      },
      {
        label: "Be skyriaus",
        value: withoutDepartment,
        tone: withoutDepartment ? "warning" : "success",
      },
    ],
    priorities: [
      ...(withoutPosition
        ? [
            {
              title: `${withoutPosition} darbuotojai be pareigybės`,
              description:
                "Reikia priskirti pareigybę, kad veiktų mokymų ir teisių logika.",
              tone: "warning" as const,
            },
          ]
        : []),
      ...(withoutDepartment
        ? [
            {
              title: `${withoutDepartment} darbuotojai be skyriaus`,
              description:
                "Reikia priskirti skyrių, kad veiktų filtrai ir grafikai.",
              tone: "warning" as const,
            },
          ]
        : []),
    ],
    rows: mergedRows,
  }
}