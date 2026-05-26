import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const email = String(body.email || "").trim().toLowerCase()
    const organizationId = String(body.organizationId || body.organization_id || "").trim()
    const role = String(body.role || "employee").trim()

    if (!email || !organizationId) {
      return NextResponse.json(
        { error: "Trūksta el. pašto arba įstaigos ID." },
        { status: 400 },
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Trūksta Supabase serverio nustatymų." },
        { status: 500 },
      )
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://visagloba.lt"

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/auth/callback`,
      data: {
        organization_id: organizationId,
        role,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      userId: data.user?.id || null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nepavyko išsiųsti kvietimo.",
      },
      { status: 500 },
    )
  }
}
