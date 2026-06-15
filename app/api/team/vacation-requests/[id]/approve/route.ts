import { NextResponse } from "next/server"
import { approveVacationRequestServer } from "@/lib/vacations/approveVacationRequestServer"
import {
  createServiceClient,
  requireAuthenticatedUser,
} from "@/lib/server/service-auth"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: "Prisijungimas būtinas." }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const admin = createServiceClient()

    const { data: vacationRequest, error: requestError } = await admin
      .from("vacation_requests")
      .select("id, organization_id, status")
      .eq("id", id)
      .maybeSingle()

    if (requestError) throw requestError
    if (!vacationRequest) {
      return NextResponse.json({ error: "Prašymas nerastas." }, { status: 404 })
    }

    const { data: membership } = await admin
      .from("organization_members")
      .select("role, is_active")
      .eq("organization_id", vacationRequest.organization_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    if (!membership || !["owner", "admin", "director", "hr"].includes(membership.role)) {
      return NextResponse.json({ error: "Neturite teisės tvirtinti prašymo." }, { status: 403 })
    }

    const result = await approveVacationRequestServer(admin, {
      requestId: id,
      actorUserId: user.id,
      substitution: body?.substitution?.substituteUserId
        ? { substituteUserId: String(body.substitution.substituteUserId) }
        : undefined,
      negativeBalance:
        body?.negativeBalance?.allowNegativeBalance === true
          ? {
              allowNegativeBalance: true,
              reason: String(body.negativeBalance.reason || ""),
            }
          : undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nepavyko patvirtinti prašymo." },
      { status: 400 },
    )
  }
}
