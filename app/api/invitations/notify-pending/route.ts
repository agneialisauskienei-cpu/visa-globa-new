import { NextResponse } from "next/server"
import { createServiceClient, requireAuthenticatedUser } from "@/lib/server/service-auth"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || "").trim().toLowerCase()
    const organizationId = String(
      body.organizationId || body.organization_id || "",
    ).trim()

    if (!email || !organizationId) {
      return NextResponse.json({ error: "Trūksta duomenų." }, { status: 400 })
    }

    const user = await requireAuthenticatedUser(request)
    if (!user || String(user.email || "").trim().toLowerCase() !== email) {
      return NextResponse.json({ error: "Neturite teisių." }, { status: 403 })
    }

    const admin = createServiceClient()
    const { data: pendingRequest } = await admin
      .from("organization_join_requests")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle()

    if (!pendingRequest) {
      return NextResponse.json({ error: "Laukiantis prašymas nerastas." }, { status: 404 })
    }

    const { data: admins, error } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .in("role", ["owner", "admin"])
      .eq("is_active", true)

    if (error) throw error

    return NextResponse.json({
      ok: true,
      notifiedAdmins: admins?.length || 0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nepavyko paruošti pranešimų.",
      },
      { status: 500 },
    )
  }
}
