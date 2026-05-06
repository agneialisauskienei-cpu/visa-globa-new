import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  })
}

function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  )
}

export async function POST(request: Request) {
  try {
    const { acknowledgementId } = await request.json()

    if (!acknowledgementId) {
      return NextResponse.json({ error: "Trūksta acknowledgementId." }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const userAgent = request.headers.get("user-agent")
    const ip = getClientIp(request)

    const { error } = await supabase
      .from("personnel_document_acknowledgements")
      .update({
        viewed_at: new Date().toISOString(),
        viewed_ip: ip,
        viewed_user_agent: userAgent,
      })
      .eq("id", acknowledgementId)
      .is("viewed_at", null)

    if (error) {
      return NextResponse.json(
        { error: "Nepavyko išsaugoti peržiūros fakto.", details: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Klaida žymint dokumento peržiūrą.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
