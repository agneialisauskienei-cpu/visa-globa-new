import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

type SubstitutionBody = {
  organizationId?: string
  absentUserId?: string
  substituteUserId?: string
  startsOn?: string
  endsOn?: string
  reason?: string
  sourceVacationRequestId?: string
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}

function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Trūksta Supabase serverio nustatymų.")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function requireOrganizationAdmin(
  request: NextRequest,
  organizationId: string,
) {
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) return null

  const token = authHeader.replace("Bearer ", "").trim()
  const supabase = getServiceSupabase()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) return null

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, is_active")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return null
  }

  return user
}

function normalizeDate(value?: string) {
  const normalized = String(value || "").trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : ""
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SubstitutionBody
    const organizationId = String(body.organizationId || "").trim()
    const absentUserId = String(body.absentUserId || "").trim()
    const substituteUserId = String(body.substituteUserId || "").trim()
    const startsOn = normalizeDate(body.startsOn)
    const endsOn = normalizeDate(body.endsOn)

    if (!organizationId || !absentUserId || !substituteUserId) {
      return jsonError("Trūksta organizacijos arba darbuotojų duomenų.")
    }

    if (absentUserId === substituteUserId) {
      return jsonError("Darbuotojas negali pavaduoti pats savęs.")
    }

    if (!startsOn || !endsOn || endsOn < startsOn) {
      return jsonError("Nurodykite teisingą pavadavimo laikotarpį.")
    }

    const authUser = await requireOrganizationAdmin(request, organizationId)

    if (!authUser) {
      return jsonError("Neturite teisės kurti pavadavimo.", 403)
    }

    const supabase = getServiceSupabase()

    const { data: members, error: membersError } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("user_id", [absentUserId, substituteUserId])

    if (membersError) {
      return jsonError(membersError.message, 500)
    }

    const memberIds = new Set((members || []).map((member) => member.user_id))

    if (!memberIds.has(absentUserId) || !memberIds.has(substituteUserId)) {
      return jsonError("Abu darbuotojai turi būti aktyvūs šios organizacijos nariai.")
    }

    const { data, error } = await supabase
      .from("employee_substitutions")
      .insert({
        organization_id: organizationId,
        absent_user_id: absentUserId,
        substitute_user_id: substituteUserId,
        starts_on: startsOn,
        ends_on: endsOn,
        status: "active",
        reason: String(body.reason || "").trim() || null,
        source_vacation_request_id:
          String(body.sourceVacationRequestId || "").trim() || null,
        created_by: authUser.id,
      })
      .select("*")
      .single()

    if (error) {
      return jsonError(error.message, 500)
    }

    return NextResponse.json({ ok: true, substitution: data })
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Nepavyko sukurti pavadavimo.",
      500,
    )
  }
}
