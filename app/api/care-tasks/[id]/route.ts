import { NextResponse } from "next/server"
import { createServiceClient, requireAuthenticatedUser } from "@/lib/server/service-auth"

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: "Prisijungimas būtinas." }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()
    const status = String(body.status || "").trim()
    const completionNote = String(body.completion_note || "").trim()

    if (!["pending", "done", "skipped"].includes(status)) {
      return NextResponse.json({ error: "Neteisinga užduoties būsena." }, { status: 400 })
    }

    const admin = createServiceClient()
    const { data: task, error: taskError } = await admin
      .from("care_tasks")
      .select("id, organization_id, assigned_user_id, status")
      .eq("id", id)
      .maybeSingle()

    if (taskError) throw taskError
    if (!task) return NextResponse.json({ error: "Užduotis nerasta." }, { status: 404 })

    const { data: membership } = await admin
      .from("organization_members")
      .select("role, is_active")
      .eq("organization_id", task.organization_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    const canManage = membership && ["owner", "admin"].includes(membership.role)
    if (!canManage && task.assigned_user_id !== user.id) {
      return NextResponse.json({ error: "Neturite teisės keisti šios užduoties." }, { status: 403 })
    }

    const now = new Date().toISOString()
    const { data, error } = await admin
      .from("care_tasks")
      .update({
        status,
        completion_note: completionNote || null,
        completed_by: status === "done" ? user.id : null,
        completed_at: status === "done" ? now : null,
        updated_at: now,
      })
      .eq("id", id)
      .eq("organization_id", task.organization_id)
      .select("*")
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, task: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nepavyko atnaujinti užduoties." },
      { status: 500 },
    )
  }
}
