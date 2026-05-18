import { SupabaseClient } from "@supabase/supabase-js"
import { ReportFilters, ReportResponse } from "./types"

export async function getResidentsReport(
  supabase: SupabaseClient,
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResponse<any>> {
  let query = supabase
    .from("residents")
    .select(`
      id,
      organization_id,
      resident_code,
      current_status,
      care_level,
      current_room_id,
      is_active,
      created_at,
      rooms (
        id,
        name,
        floor,
        capacity
      )
    `)
    .eq("organization_id", organizationId)

  if (!filters.includeInactive) query = query.eq("is_active", true)
  if (filters.status) query = query.eq("current_status", filters.status)
  if (filters.roomId) query = query.eq("current_room_id", filters.roomId)
  if (filters.residentId) query = query.eq("id", filters.residentId)
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom)
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo)

  const { data, error } = await query

  if (error) throw error

  let rows = data ?? []

  if (filters.search) {
    const needle = filters.search.toLowerCase()
    rows = rows.filter((row: any) =>
      [row.resident_code, row.current_status, row.care_level, row.rooms?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    )
  }

  const living = rows.filter((x: any) => x.current_status === "gyvena").length
  const arriving = rows.filter((x: any) =>
    ["reservuotas", "netrukus_atvyks"].includes(x.current_status)
  ).length
  const hospital = rows.filter((x: any) => x.current_status === "ligonineje").length
  const inactive = rows.filter((x: any) => !x.is_active).length

  return {
    stats: [
      { label: "Gyvena", value: living, tone: "success" },
      { label: "Netrukus atvyks", value: arriving, tone: "warning" },
      { label: "Ligoninėje", value: hospital, tone: hospital ? "warning" : "success" },
      { label: "Neaktyvūs", value: inactive },
    ],
    priorities: [
      ...(arriving
        ? [
            {
              title: `${arriving} gyventojai netrukus atvyks`,
              description: "Patikrink kambarių rezervacijas.",
              tone: "warning" as const,
            },
          ]
        : []),
      ...(hospital
        ? [
            {
              title: `${hospital} gyventojai ligoninėje`,
              description: "Reikia stebėti grįžimo ir perdavimo informaciją.",
              tone: "warning" as const,
            },
          ]
        : []),
    ],
    rows,
  }
}