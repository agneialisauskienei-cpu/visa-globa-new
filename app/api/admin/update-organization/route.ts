import { NextResponse } from "next/server"
import { createServiceClient, requireSystemAdmin } from "@/lib/server/service-auth"

export async function POST(request: Request) {
  try {
    const user = await requireSystemAdmin(request)
    if (!user) {
      return NextResponse.json({ ok: false, error: "Neturite teisių." }, { status: 403 })
    }

    const body = await request.json()
    const id = String(body.id || "").trim()
    const name = String(body.name || "").trim()
    const code = String(body.code || "").trim()
    const address = String(body.address || "").trim()
    const plan = String(body.plan || "basic").trim().toLowerCase()

    if (!id || !name || name.length > 200) {
      return NextResponse.json({ ok: false, error: "Neteisingi įstaigos duomenys." }, { status: 400 })
    }

    const admin = createServiceClient()
    const { data: planRow } = await admin
      .from("plan_limits")
      .select("plan_code")
      .eq("plan_code", plan)
      .maybeSingle()
    if (!planRow) {
      return NextResponse.json({ ok: false, error: "Neteisingas planas." }, { status: 400 })
    }

    const { data: before } = await admin
      .from("organizations")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (!before) {
      return NextResponse.json({ ok: false, error: "Organizacija nerasta." }, { status: 404 })
    }

    const { data, error } = await admin
      .from("organizations")
      .update({
        name,
        code: code || null,
        address: address || null,
        plan,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single()
    if (error) throw error

    await admin.rpc("log_audit_event", {
      p_actor_user_id: user.id,
      p_organization_id: id,
      p_entity_type: "organization",
      p_entity_id: id,
      p_action: "organization_updated",
      p_old_values: before,
      p_new_values: data,
    })

    return NextResponse.json({ ok: true, message: "Įstaiga atnaujinta.", organization: data })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Serverio klaida." },
      { status: 500 },
    )
  }
}
