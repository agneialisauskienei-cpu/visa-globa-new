import { NextRequest, NextResponse } from "next/server"
import { createServiceClient, requireAuthenticatedUser } from "@/lib/server/service-auth"

function validTime(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const normalized = String(value).trim()
  return /^\d{2}:\d{2}(:\d{2})?$/.test(normalized) ? normalized : undefined
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ message: "Nėra aktyvios sesijos." }, { status: 401 })
    }

    const body = await request.json()
    const title = String(body.title || "").trim()
    const sessionDate = String(body.session_date || "").trim()
    const requestedOrganizationId = String(body.organization_id || "").trim()
    const startTime = validTime(body.start_time)
    const endTime = validTime(body.end_time)

    if (!title || title.length > 200) {
      return NextResponse.json({ message: "Neteisingas veiklos pavadinimas." }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
      return NextResponse.json({ message: "Neteisinga data." }, { status: 400 })
    }
    if (startTime === undefined || endTime === undefined) {
      return NextResponse.json({ message: "Neteisingas veiklos laikas." }, { status: 400 })
    }

    const admin = createServiceClient()
    let membershipQuery = admin
      .from("organization_members")
      .select("organization_id, role, staff_type")
      .eq("user_id", user.id)
      .eq("is_active", true)

    if (requestedOrganizationId) {
      membershipQuery = membershipQuery.eq("organization_id", requestedOrganizationId)
    }

    const { data: memberships, error: membershipError } =
      await membershipQuery.limit(1)
    if (membershipError) throw membershipError

    const membership = memberships?.[0]
    if (!membership?.organization_id) {
      return NextResponse.json({ message: "Neturite prieigos prie organizacijos." }, { status: 403 })
    }

    const allowed =
      ["owner", "admin", "super_admin"].includes(membership.role) ||
      ["activity_specialist", "occupational_therapist"].includes(
        String(membership.staff_type || ""),
      )
    if (!allowed) {
      return NextResponse.json({ message: "Neturite teisės kurti veiklų." }, { status: 403 })
    }

    const { data, error } = await admin
      .from("activity_sessions")
      .insert({
        organization_id: membership.organization_id,
        title,
        session_date: sessionDate,
        start_time: startTime,
        end_time: endTime,
      })
      .select("id")
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, id: data.id })
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Nepavyko sukurti veiklos." },
      { status: 500 },
    )
  }
}
