import { SupabaseClient } from "@supabase/supabase-js"
import { ReportFilters, ReportResponse } from "./types"

export async function getAuditReport(
  supabase: SupabaseClient,
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResponse<any>> {
  let query = supabase
    .from("audit_logs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(500)

  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom)
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo)
  if (filters.status) query = query.eq("action", filters.status)

  const { data, error } = await query

  if (error) throw error

  let rows = data ?? []

  if (filters.search) {
    const needle = filters.search.toLowerCase()
    rows = rows.filter((row: any) =>
      [row.action, row.module, row.table_name, row.record_id, row.user_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    )
  }

  const total = rows.length
  const sensitive = rows.filter((x: any) => {
    const action = String(x.action || "").toLowerCase()
    return action.includes("sensitive") || action.includes("export") || action.includes("permission")
  }).length

  return {
    stats: [
      { label: "Audito įrašai", value: total },
      {
        label: "Jautrūs veiksmai",
        value: sensitive,
        tone: sensitive ? "warning" : "success",
      },
    ],
    priorities: [
      ...(sensitive
        ? [
            {
              title: `${sensitive} jautrūs audito veiksmai`,
              description: "Peržiūrėk eksportus, teisių keitimus ir jautrių duomenų peržiūras.",
              tone: "warning" as const,
            },
          ]
        : []),
    ],
    rows,
  }
}