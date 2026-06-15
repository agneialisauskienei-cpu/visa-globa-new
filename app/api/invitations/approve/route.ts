import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Trūksta Supabase serverio nustatymų.")
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") || ""
  return value.startsWith("Bearer ") ? value.slice(7).trim() : ""
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const inviteToken = String(body.inviteToken || "").trim()
    const accessToken = bearerToken(request)

    if (!inviteToken || !accessToken) {
      return NextResponse.json({ error: "Trūksta kvietimo arba sesijos." }, { status: 400 })
    }

    const admin = adminClient()
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(accessToken)

    if (userError || !user?.email) {
      return NextResponse.json({ error: "Prisijungimo sesija negalioja." }, { status: 401 })
    }

    const email = user.email.trim().toLowerCase()
    const { data: invite, error: inviteError } = await admin
      .from("organization_invites")
      .select("id, organization_id, email, role, status, expires_at")
      .eq("token", inviteToken)
      .maybeSingle()

    if (inviteError) throw inviteError
    if (!invite || invite.status !== "pending") {
      return NextResponse.json({ error: "Kvietimas nerastas arba nebegalioja." }, { status: 400 })
    }
    if (String(invite.email || "").trim().toLowerCase() !== email) {
      return NextResponse.json({ error: "Kvietimas skirtas kitam el. paštui." }, { status: 403 })
    }
    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      await admin.from("organization_invites").update({ status: "expired" }).eq("id", invite.id)
      return NextResponse.json({ error: "Kvietimo galiojimas pasibaigė." }, { status: 410 })
    }

    const safeRole = invite.role === "admin" ? "admin" : "employee"
    const { error: memberError } = await admin
      .from("organization_members")
      .upsert(
        {
          organization_id: invite.organization_id,
          user_id: user.id,
          role: safeRole,
          is_active: true,
        },
        { onConflict: "organization_id,user_id" },
      )
    if (memberError) throw memberError

    await admin
      .from("organization_join_requests")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("organization_id", invite.organization_id)
      .eq("user_id", user.id)
      .eq("status", "pending")

    const { error: acceptError } = await admin
      .from("organization_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invite.id)
      .eq("status", "pending")
    if (acceptError) throw acceptError

    return NextResponse.json({
      ok: true,
      organizationId: invite.organization_id,
      role: safeRole,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nepavyko aktyvuoti kvietimo." },
      { status: 500 },
    )
  }
}
