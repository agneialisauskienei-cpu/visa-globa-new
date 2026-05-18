import { SupabaseClient } from "@supabase/supabase-js"
import { ReportFilters, ReportResponse } from "./types"

export async function getMedicineReport(
  supabase: SupabaseClient,
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResponse<any>> {
  let query = supabase
    .from("medication_logs")
    .select(`
      id,
      organization_id,
      resident_id,
      medication_name,
      dose,
      status,
      scheduled_at,
      given_at,
      created_at,
      residents (
        id,
        resident_code,
        current_room_id,
        rooms (
          id,
          name
        )
      )
    `)
    .eq("organization_id", organizationId)

  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom)
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo)
  if (filters.residentId) query = query.eq("resident_id", filters.residentId)
  if (filters.status) query = query.eq("status", filters.status)

  const { data, error } = await query.order("created_at", { ascending: false }).limit(500)

  if (error) throw error

  let rows = data ?? []

  if (filters.search) {
    const needle = filters.search.toLowerCase()
    rows = rows.filter((row: any) =>
      [row.medication_name, row.dose, row.status, row.residents?.resident_code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    )
  }

  const given = rows.filter((x: any) => x.status === "given").length
  const missed = rows.filter((x: any) => x.status === "missed").length
  const refused = rows.filter((x: any) => x.status === "refused").length
  const prn = rows.filter((x: any) => String(x.status).toLowerCase() === "prn").length

  return {
    stats: [
      { label: "Sugirdyta", value: given, tone: "success" },
      { label: "Praleista", value: missed, tone: missed ? "danger" : "success" },
      { label: "Atsisakė", value: refused, tone: refused ? "warning" : "success" },
      { label: "PRN įrašai", value: prn },
    ],
    priorities: [
      ...(missed
        ? [
            {
              title: `${missed} praleistos dozės`,
              description: "Reikia slaugos peržiūros.",
              tone: "danger" as const,
            },
          ]
        : []),
      ...(refused
        ? [
            {
              title: `${refused} atsisakymai vartoti vaistus`,
              description: "Reikia pažymėti priežastį ir veiksmus.",
              tone: "warning" as const,
            },
          ]
        : []),
    ],
    rows,
  }
}