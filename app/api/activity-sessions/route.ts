import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ message: "Nėra aktyvios sesijos." }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ message: "Trūksta Supabase nustatymų." }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    const body = await request.json()
    const title = String(body.title || "").trim()
    const session_date = String(body.session_date || "").trim()
    const start_time = body.start_time ? String(body.start_time) : null
    const end_time = body.end_time ? String(body.end_time) : null

    if (!title) {
      return NextResponse.json({ message: "Įvesk veiklos pavadinimą." }, { status: 400 })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(session_date)) {
      return NextResponse.json({ message: "Neteisinga data." }, { status: 400 })
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return NextResponse.json({ message: "Nepavyko patvirtinti vartotojo." }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userData.user.id)
      .maybeSingle()

    const organization_id = body.organization_id || profile?.organization_id

    if (!organization_id) {
      return NextResponse.json({ message: "Nepavyko nustatyti organizacijos." }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("activity_sessions")
      .insert({
        organization_id,
        title,
        session_date,
        start_time,
        end_time,
      })
      .select("id")
      .single()

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, id: data.id })
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Nepavyko sukurti veiklos." },
      { status: 500 }
    )
  }
}
