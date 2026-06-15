import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { readReportFilters } from "@/lib/reports/filters"
import { getActiveOrganizationId } from "@/lib/reports/helpers"
import { getEmployeesReport } from "@/lib/reports/employees"

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user

    if (!user) {
      return NextResponse.json({ error: "Neprisijungęs naudotojas." }, { status: 401 })
    }

    const organizationId = await getActiveOrganizationId(supabase, user.id)

    if (!organizationId) {
      return NextResponse.json({ error: "Nerasta aktyvi organizacija." }, { status: 403 })
    }

    const filters = readReportFilters(req.nextUrl.searchParams)
    const report = await getEmployeesReport(supabase, organizationId, filters)

    await supabase.from("report_audit_log").insert({
      organization_id: organizationId,
      user_id: user.id,
      report_type: "employees",
      action: "view",
      filters,
    })

    return NextResponse.json(report)
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nepavyko gauti ataskaitos.",
      },
      { status: 500 }
    )
  }
}
