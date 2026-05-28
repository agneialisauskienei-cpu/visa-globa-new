import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const email = String(body.email || "").trim().toLowerCase()
    const organizationId = String(
      body.organizationId || body.organization_id || "",
    ).trim()
    const role = String(body.role || "employee").trim()

    if (!email || !organizationId) {
      return NextResponse.json(
        { error: "Trūksta el. pašto arba organizacijos ID." },
        { status: 400 },
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Trūksta Supabase nustatymų." },
        { status: 500 },
      )
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: usersData, error: usersError } =
      await admin.auth.admin.listUsers()

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 400 })
    }

    const user = usersData.users.find(
      (item) => String(item.email || "").trim().toLowerCase() === email,
    )

    if (!user) {
      return NextResponse.json(
        { error: "Darbuotojas dar neprisijungė pagal kvietimą." },
        { status: 400 },
      )
    }

    const { data: candidate } = await admin
      .from("candidates")
      .select("first_name, last_name, phone, desired_role, experience")
      .eq("organization_id", organizationId)
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const firstName = String(candidate?.first_name || "").trim()
    const lastName = String(candidate?.last_name || "").trim()
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()

    if (firstName || lastName || candidate?.phone) {
      const { error: profileError } = await admin.from("profiles").upsert(
        {
          id: user.id,
          email,
          first_name: firstName || null,
          last_name: lastName || null,
          full_name: fullName || null,
          phone: candidate?.phone || null,
        },
        { onConflict: "id" },
      )

      if (profileError) {
        return NextResponse.json(
          { error: profileError.message },
          { status: 400 },
        )
      }
    }

    const safeRole =
      role === "owner" || role === "admin" ? "employee" : role

    const { error: memberError } = await admin
      .from("organization_members")
      .upsert(
        {
          organization_id: organizationId,
          user_id: user.id,
          role: safeRole,
          is_active: true,
          position: candidate?.desired_role || null,
          department: candidate?.experience || null,
        },
        { onConflict: "organization_id,user_id" },
      )

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 400 })
    }

    const { error: inviteError } = await admin
      .from("organization_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .ilike("email", email)

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      userId: user.id,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nepavyko patvirtinti kvietimo.",
      },
      { status: 500 },
    )
  }
}