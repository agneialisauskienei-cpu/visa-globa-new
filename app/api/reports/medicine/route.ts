import { NextRequest, NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

type ReportFilters = {
  period?: string
  dateFrom?: string
  dateTo?: string
  department?: string
  status?: string
  responsible?: string
  search?: string
  organizationId?: string
}

type KpiRow = {
  label: string
  value: string | number
  description?: string
}

type DistributionRow = {
  label: string
  value: number
  tone?: "green" | "orange" | "red" | "slate"
}

type ReportRecord = {
  id: string
  date: string
  title: string
  status: string
  comment?: string
  residentName?: string
  responsibleName?: string
  riskLevel?: string
}

type OrganizationMembership = {
  organization_id: string
  role?: string | null
  department?: string | null
  position?: string | null
  is_active?: boolean | null
}

const emptyResponse = {
  generatedAt: new Date().toISOString(),
  kpis: [] as KpiRow[],
  focusItems: [] as string[],
  sections: ["Praleistos dozės", "PRN peržiūros", "Saugos įvykiai", "Vaistų likučiai"],
  dynamics: [] as number[],
  distribution: [] as DistributionRow[],
  records: [] as ReportRecord[],
  canExport: false,
}

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const authorization = request.headers.get("authorization") || request.headers.get("Authorization") || ""

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Trūksta Supabase aplinkos kintamųjų NEXT_PUBLIC_SUPABASE_URL arba NEXT_PUBLIC_SUPABASE_ANON_KEY.")
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function readFilters(request: NextRequest): ReportFilters {
  const params = request.nextUrl.searchParams

  return {
    period: params.get("period") || "this_month",
    dateFrom: params.get("dateFrom") || undefined,
    dateTo: params.get("dateTo") || undefined,
    department: params.get("department") || undefined,
    status: params.get("status") || undefined,
    responsible: params.get("responsible") || undefined,
    search: params.get("search") || undefined,
    organizationId: params.get("organizationId") || undefined,
  }
}

function getDateRange(filters: ReportFilters) {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)

  if (filters.period === "custom" && filters.dateFrom && filters.dateTo) {
    return { from: filters.dateFrom, to: filters.dateTo }
  }

  if (filters.period === "last_month") {
    start.setMonth(now.getMonth() - 1, 1)
    end.setMonth(now.getMonth(), 0)
  } else if (filters.period === "this_year") {
    start.setMonth(0, 1)
    end.setMonth(11, 31)
  } else {
    start.setDate(1)
    end.setMonth(now.getMonth() + 1, 0)
  }

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

async function findActiveOrganization(
  supabase: SupabaseClient,
  userId: string,
  requestedOrganizationId?: string
): Promise<OrganizationMembership | null> {
  let query = supabase
    .from("organization_members")
    .select("organization_id, role, department, position, is_active")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .limit(10)

  if (requestedOrganizationId) {
    query = query.eq("organization_id", requestedOrganizationId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Nepavyko patikrinti organizacijos narystės: ${error.message}`)
  }

  const memberships = (data || []) as OrganizationMembership[]
  return memberships.find((row) => row.is_active !== false) || memberships[0] || null
}

function canSeeMedicineReport(member: OrganizationMembership) {
  const role = (member.role || "").toLowerCase()
  const position = (member.position || "").toLowerCase()
  const department = (member.department || "").toLowerCase()

  if (["owner", "admin"].includes(role)) return true
  if (department.includes("slaug")) return true
  if (position.includes("slaug")) return true
  if (position.includes("gyd")) return true
  if (position.includes("medic")) return true

  return false
}

async function safeCount(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>
) {
  try {
    const { count, error } = await query
    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}

function applyDateFilter(query: any, from: string, to: string, possibleDateColumn = "created_at") {
  return query.gte(possibleDateColumn, `${from}T00:00:00`).lte(possibleDateColumn, `${to}T23:59:59`)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseForRequest(request)
    const filters = readFilters(request)
    const range = getDateRange(filters)

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Prisijunkite, kad matytumėte medicinos ataskaitą." }, { status: 401 })
    }

    const activeMember = await findActiveOrganization(supabase, userData.user.id, filters.organizationId)

    if (!activeMember?.organization_id) {
      return NextResponse.json(
        {
          ...emptyResponse,
          error: "Nerasta aktyvi organizacija. Patikrinkite, ar vartotojas yra organization_members lentelėje ir ar is_active nėra false.",
        },
        { status: 403 }
      )
    }

    if (!canSeeMedicineReport(activeMember)) {
      return NextResponse.json(
        { error: "Neturite teisės matyti medicinos ataskaitos. Ji skirta administracijai arba slaugos/medicinos darbuotojams." },
        { status: 403 }
      )
    }

    const organizationId = activeMember.organization_id

    const medicationLogsBase = supabase
      .from("medication_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)

    const medicationLogsInPeriod = applyDateFilter(medicationLogsBase, range.from, range.to, "created_at")

    const totalLogs = await safeCount(medicationLogsInPeriod)

    const completedLogs = await safeCount(
      applyDateFilter(
        supabase
          .from("medication_logs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .in("status", ["completed", "given", "administered", "duota", "sugirdyta"]),
        range.from,
        range.to,
        "created_at"
      )
    )

    const missedLogs = await safeCount(
      applyDateFilter(
        supabase
          .from("medication_logs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .in("status", ["missed", "skipped", "praleista", "not_given"]),
        range.from,
        range.to,
        "created_at"
      )
    )

    const pendingLogs = await safeCount(
      applyDateFilter(
        supabase
          .from("medication_logs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .in("status", ["pending", "planned", "laukiama", "suplanuota"]),
        range.from,
        range.to,
        "created_at"
      )
    )

    const safetyEvents = await safeCount(
      applyDateFilter(
        supabase
          .from("medication_safety_events")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId),
        range.from,
        range.to,
        "created_at"
      )
    )

    const prnLogs = await safeCount(
      applyDateFilter(
        supabase
          .from("medication_prn_logs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId),
        range.from,
        range.to,
        "created_at"
      )
    )

    let recordsQuery = supabase
      .from("medication_logs")
      .select("id, created_at, status, notes, resident_id, medicine_name, profiles:created_by_user_id(full_name, email), residents:resident_id(resident_code)")
      .eq("organization_id", organizationId)
      .gte("created_at", `${range.from}T00:00:00`)
      .lte("created_at", `${range.to}T23:59:59`)
      .order("created_at", { ascending: false })
      .limit(80)

    if (filters.status && filters.status !== "all") {
      if (filters.status === "risk") {
        recordsQuery = recordsQuery.in("status", ["risk", "incident", "error", "rizika"])
      } else if (filters.status === "missed") {
        recordsQuery = recordsQuery.in("status", ["missed", "skipped", "praleista", "not_given"])
      } else if (filters.status === "completed") {
        recordsQuery = recordsQuery.in("status", ["completed", "given", "administered", "duota", "sugirdyta"])
      } else if (filters.status === "pending") {
        recordsQuery = recordsQuery.in("status", ["pending", "planned", "laukiama", "suplanuota"])
      }
    }

    if (filters.search) {
      recordsQuery = recordsQuery.or(`medicine_name.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`)
    }

    const { data: recordRows } = await recordsQuery

    const records: ReportRecord[] = (recordRows || []).map((row: any) => ({
      id: String(row.id),
      date: row.created_at ? new Date(row.created_at).toLocaleDateString("lt-LT") : "—",
      title: row.medicine_name || "Vaistų įrašas",
      status: row.status || "—",
      comment: row.notes || "",
      residentName: row.residents?.resident_code ? `Gyventojas ${row.residents.resident_code}` : "—",
      responsibleName: row.profiles?.full_name || row.profiles?.email || "—",
      riskLevel: ["missed", "skipped", "praleista", "not_given"].includes(String(row.status || "").toLowerCase()) ? "aukšta" : "",
    }))

    const riskCount = missedLogs + safetyEvents
    const focusItems = [
      missedLogs > 0 ? `Praleistų dozių: ${missedLogs}` : null,
      safetyEvents > 0 ? `Saugos įvykių: ${safetyEvents}` : null,
      pendingLogs > 0 ? `Laukia peržiūros / suplanuota: ${pendingLogs}` : null,
    ].filter(Boolean) as string[]

    const distribution: DistributionRow[] = [
      { label: "Tvarkinga", value: completedLogs, tone: "green" },
      { label: "Laukia", value: pendingLogs, tone: "orange" },
      { label: "Rizika / praleista", value: riskCount, tone: "red" },
    ]

    const kpis: KpiRow[] = [
      { label: "Vaistų įrašai", value: totalLogs, description: `Laikotarpis: ${range.from} – ${range.to}` },
      { label: "Tvarkingi įrašai", value: completedLogs, description: "Suskaičiuota iš medication_logs pagal statusą." },
      { label: "Praleistos dozės", value: missedLogs, description: "Įrašai su praleistos / skipped / missed būsena." },
      { label: "PRN / saugos įvykiai", value: prnLogs + safetyEvents, description: "PRN įrašai ir saugos įvykiai, jei lentelės yra projekte." },
    ]

    const maxValue = Math.max(completedLogs, pendingLogs, riskCount, 1)
    const dynamics = [completedLogs, pendingLogs, riskCount, prnLogs].map((value) => Math.round((value / maxValue) * 100))

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      organizationId,
      kpis,
      focusItems,
      sections: ["Praleistos dozės", "PRN peržiūros", "Saugos įvykiai", "Vaistų likučiai"],
      dynamics,
      distribution,
      records,
      canExport: true,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nepavyko sugeneruoti medicinos ataskaitos." },
      { status: 500 }
    )
  }
}
