import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import {
  containsForbiddenSensitiveText,
  decryptResidentField,
  encryptResidentField,
  normalizeSearchValue,
} from "@/lib/server/resident-crypto"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  {
    auth: {
      persistSession: false,
    },
  }
)

type ResidentPayload = {
  id?: string
  organization_id: string
  resident_code?: string | null
  full_name?: string | null
  birth_date?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  internal_notes?: string | null
  current_status?: string | null
  current_room_id?: string | null
  care_level?: string | null
  assigned_to?: string | null
  start_date?: string | null
}

async function getUserAccess(request: Request) {
  const authHeader = request.headers.get("authorization")

  if (!authHeader) {
    return null
  }

  const token = authHeader.replace("Bearer ", "").trim()

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token)

  if (error || !user) return null

  const { data: membership } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()

  if (!membership) return null

  return {
    user,
    organizationId: membership.organization_id as string,
    role: membership.role as "owner" | "admin" | "employee",
  }
}

function decryptResident(row: any) {
  return {
    ...row,
    full_name:
      decryptResidentField(row.full_name_enc) ||
      row.full_name ||
      null,
    birth_date:
      decryptResidentField(row.birth_date_enc) ||
      row.birth_date ||
      null,
    phone:
      decryptResidentField(row.phone_enc) ||
      row.phone ||
      null,
    email:
      decryptResidentField(row.email_enc) ||
      row.email ||
      null,
    address:
      decryptResidentField(row.address_enc) ||
      row.address ||
      null,
    internal_notes:
      decryptResidentField(row.internal_notes_enc) ||
      row.internal_notes ||
      null,
  }
}

function buildEncryptedResidentPayload(payload: ResidentPayload, userId: string) {
  if (containsForbiddenSensitiveText(payload.internal_notes)) {
    throw new Error(
      "Pastaboje yra perteklinių arba jautrių duomenų. Nerašyk diagnozių, asmens kodo, teistumo, religijos ar kitų nebūtinų duomenų."
    )
  }

  const fullName = payload.full_name?.trim() || ""

  if (!fullName) {
    throw new Error("Pilnas vardas yra privalomas.")
  }

  return {
    organization_id: payload.organization_id,
    resident_code: payload.resident_code?.trim() || null,
    current_status: payload.current_status || "gyvena",
    current_room_id: payload.current_room_id || null,
    care_level: payload.care_level || null,
    assigned_to: payload.assigned_to || null,
    is_active: !["sutartis_nutraukta", "mire"].includes(
      payload.current_status || ""
    ),
    created_by: userId,

    full_name_enc: encryptResidentField(fullName),
    birth_date_enc: encryptResidentField(payload.birth_date || null),
    phone_enc: encryptResidentField(payload.phone?.trim() || null),
    email_enc: encryptResidentField(payload.email?.trim() || null),
    address_enc: encryptResidentField(payload.address?.trim() || null),
    internal_notes_enc: encryptResidentField(payload.internal_notes?.trim() || null),

    search_name: normalizeSearchValue(fullName),
    search_contact: normalizeSearchValue(
      [payload.phone, payload.email, payload.address].filter(Boolean).join(" ")
    ),

    full_name: null,
    birth_date: null,
    phone: null,
    email: null,
    address: null,
    internal_notes: null,
  }
}

async function writeAuditLog(input: {
  organizationId: string
  actorId: string
  action: string
  residentId: string | null
  details: string
}) {
  await supabaseAdmin.from("audit_log").insert({
    organization_id: input.organizationId,
    actor: input.actorId,
    action: input.action,
    entity_type: "resident",
    entity_id: input.residentId,
    details: input.details,
  })
}

export async function GET(request: Request) {
  const access = await getUserAccess(request)

  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = normalizeSearchValue(searchParams.get("q") || "")
  const status = searchParams.get("status") || ""

  let requestQuery = supabaseAdmin
    .from("residents")
    .select("*")
    .eq("organization_id", access.organizationId)
    .order("created_at", { ascending: false })

  if (status && status !== "all") {
    requestQuery = requestQuery.eq("current_status", status)
  }

  if (query) {
    requestQuery = requestQuery.or(
      `search_name.ilike.%${query}%,search_contact.ilike.%${query}%,resident_code.ilike.%${query}%`
    )
  }

  if (access.role === "employee") {
    requestQuery = requestQuery.eq("assigned_to", access.user.id)
  }

  const { data, error } = await requestQuery

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const residents = (data || []).map(decryptResident)

  await writeAuditLog({
    organizationId: access.organizationId,
    actorId: access.user.id,
    action: "resident_list_viewed",
    residentId: null,
    details: "Peržiūrėtas gyventojų sąrašas",
  })

  return NextResponse.json({ residents })
}

export async function POST(request: Request) {
  const access = await getUserAccess(request)

  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (access.role !== "owner" && access.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as ResidentPayload

    const payload = buildEncryptedResidentPayload(
      {
        ...body,
        organization_id: access.organizationId,
      },
      access.user.id
    )

    const { data, error } = await supabaseAdmin
      .from("residents")
      .insert(payload)
      .select("id")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (body.start_date) {
      await supabaseAdmin.from("resident_stays").insert({
        organization_id: access.organizationId,
        resident_id: data.id,
        room_id: body.current_room_id || null,
        status: body.current_status || "gyvena",
        start_date: body.start_date,
        end_date: null,
        notes: null,
      })
    }

    await writeAuditLog({
      organizationId: access.organizationId,
      actorId: access.user.id,
      action: "resident_created_secure",
      residentId: data.id,
      details: "Sukurtas gyventojas su šifruotais asmens duomenimis",
    })

    return NextResponse.json({ id: data.id })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Nepavyko sukurti gyventojo." },
      { status: 400 }
    )
  }
}

export async function PATCH(request: Request) {
  const access = await getUserAccess(request)

  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (access.role !== "owner" && access.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as ResidentPayload

    if (!body.id) {
      throw new Error("Trūksta gyventojo ID.")
    }

    const payload = buildEncryptedResidentPayload(
      {
        ...body,
        organization_id: access.organizationId,
      },
      access.user.id
    )

    delete (payload as any).organization_id
    delete (payload as any).created_by

    const { error } = await supabaseAdmin
      .from("residents")
      .update(payload)
      .eq("id", body.id)
      .eq("organization_id", access.organizationId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await writeAuditLog({
      organizationId: access.organizationId,
      actorId: access.user.id,
      action: "resident_updated_secure",
      residentId: body.id,
      details: "Atnaujinti gyventojo šifruoti asmens duomenys",
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Nepavyko atnaujinti gyventojo." },
      { status: 400 }
    )
  }
}