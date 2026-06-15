import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAuthenticatedUser } from "@/lib/server/service-auth"

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
    const user = await requireAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: "Neautorizuota." }, { status: 401 })
    }

    const { data: acknowledgement, error: readError } = await supabase
      .from("personnel_document_acknowledgements")
      .select("id, employee_id, viewed_at, status")
      .eq("id", acknowledgementId)
      .eq("employee_id", user.id)
      .single()

    if (readError || !acknowledgement) {
      return NextResponse.json(
        { error: "Susipažinimo įrašas nerastas.", details: readError?.message },
        { status: 404 },
      )
    }

    if (acknowledgement.status === "acknowledged") {
      return NextResponse.json({ ok: true, alreadyAcknowledged: true })
    }

    const now = new Date().toISOString()
    const userAgent = request.headers.get("user-agent")
    const ip = getClientIp(request)

    const { error } = await supabase
      .from("personnel_document_acknowledgements")
      .update({
        status: "acknowledged",
        viewed_at: acknowledgement.viewed_at || now,
        acknowledged_at: now,
        acknowledged_ip: ip,
        acknowledged_user_agent: userAgent,
      })
      .eq("id", acknowledgementId)
      .eq("employee_id", user.id)

    if (error) {
      return NextResponse.json(
        { error: "Nepavyko išsaugoti susipažinimo fakto.", details: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Klaida žymint susipažinimą.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
