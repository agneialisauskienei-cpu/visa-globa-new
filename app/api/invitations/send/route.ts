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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || "").trim().toLowerCase()
    const organizationId = String(body.organizationId || "").trim()
    const role = body.role === "admin" ? "admin" : "employee"
    const authorization = request.headers.get("authorization") || ""
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : ""

    if (!email || !organizationId || !accessToken) {
      return NextResponse.json({ error: "Trūksta kvietimo duomenų." }, { status: 400 })
    }

    const admin = adminClient()
    const {
      data: { user },
    } = await admin.auth.getUser(accessToken)
    if (!user) return NextResponse.json({ error: "Neturite teisių." }, { status: 401 })

    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role", ["owner", "admin"])
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: "Neturite teisių." }, { status: 403 })

    const { data: existing } = await admin
      .from("organization_invites")
      .select("id, token")
      .eq("organization_id", organizationId)
      .ilike("email", email)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const token = existing?.token || crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    if (existing) {
      const { error } = await admin
        .from("organization_invites")
        .update({ token, role, expires_at: expiresAt, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
      if (error) throw error
    } else {
      const { error } = await admin.from("organization_invites").insert({
        organization_id: organizationId,
        email,
        role,
        status: "pending",
        token,
        expires_at: expiresAt,
        invited_by: user.id,
      })
      if (error) throw error
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      new URL(request.url).origin
    const redirectTo = `${appUrl}/register?token=${encodeURIComponent(token)}`
    const { error: sendError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { organization_id: organizationId, role },
    })

    if (sendError) {
      const anonKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!anonKey) throw sendError

      const publicClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, anonKey)
      const { error: recoveryError } = await publicClient.auth.resetPasswordForEmail(email, {
        redirectTo,
      })
      if (recoveryError) throw recoveryError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nepavyko išsiųsti kvietimo." },
      { status: 500 },
    )
  }
}
