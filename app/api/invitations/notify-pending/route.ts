import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const email = String(body.email || "").trim().toLowerCase()
    const organizationId = String(
      body.organizationId || body.organization_id || "",
    ).trim()

    if (!email || !organizationId) {
      return NextResponse.json(
        { error: "Trūksta duomenų." },
        { status: 400 },
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Trūksta serverio nustatymų." },
        { status: 500 },
      )
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: admins } = await admin
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", organizationId)
      .in("role", ["owner", "admin"])
      .eq("is_active", true)

    console.log("Notify admins:", admins)

    console.log(
      `Darbuotojas ${email} prisijungė ir laukia patvirtinimo.`,
    )

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nepavyko išsiųsti pranešimų.",
      },
      { status: 500 },
    )
  }
}
