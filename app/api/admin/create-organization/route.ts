import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireSystemAdmin } from '@/lib/server/service-auth'

type CreateOrganizationBody = {
  name?: string
  code?: string
  address?: string
  plan?: string
}

type PlanLimitsRow = {
  id: string
  plan_code: string
  max_members: number
  max_residents: number
  can_export: boolean
  can_use_reports: boolean
  can_have_multiple_admins: boolean
  can_use_api: boolean
}

function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Trūksta SUPABASE aplinkos kintamųjų.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return null
  }

  const token = authHeader.replace("Bearer ", "").trim()

  const supabase = getServiceSupabase()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return null
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()

  if (!membership) {
    return null
  }

  if (!["owner", "admin"].includes(membership.role)) {
    return null
  }

  return user
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await requireSystemAdmin(request)

    if (!authUser) {
      return jsonError("Neturite teisių.", 403)
    }

    const body = (await request.json()) as CreateOrganizationBody

    const name = body.name?.trim() || ''
    const code = body.code?.trim() || ''
    const address = body.address?.trim() || ''
    const plan = body.plan?.trim().toLowerCase() || 'basic'

    if (!name) {
      return jsonError('Įstaigos pavadinimas yra privalomas.')
    }

    const supabase = getServiceSupabase()

    const { data: planLimits, error: planError } = await supabase
      .from('plan_limits')
      .select(
        'id, plan_code, max_members, max_residents, can_export, can_use_reports, can_have_multiple_admins, can_use_api'
      )
      .eq('plan_code', plan)
      .maybeSingle<PlanLimitsRow>()

    if (planError) {
      return jsonError(planError.message, 500)
    }

    if (!planLimits) {
      return jsonError('Neteisingas planas.')
    }

    const { data: organization, error: insertError } = await supabase
      .from('organizations')
      .insert({
        name,
        code: code || null,
        address: address || null,
        plan,
        status: 'active',
      })
      .select('*')
      .maybeSingle()

    if (insertError) {
      return jsonError(insertError.message, 500)
    }

    if (!organization) {
      return jsonError('Nepavyko sukurti įstaigos.', 500)
    }

    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .insert({
        organization_id: organization.id,
        plan_code: plan,
        status: 'active',
        starts_at: new Date().toISOString(),
      })

    if (subscriptionError) {
      return jsonError(subscriptionError.message, 500)
    }

    const { error: auditError } = await supabase.rpc('log_audit_event', {
      p_organization_id: organization.id,
      p_entity_type: 'organization',
      p_entity_id: organization.id,
      p_action: 'organization_created',
      p_old_values: null,
      p_new_values: organization,
    })

    if (auditError) {
      return jsonError(auditError.message, 500)
    }

    return NextResponse.json({
      ok: true,
      message: 'Įstaiga sėkmingai sukurta.',
      organization,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Serverio klaida.'
    return jsonError(message, 500)
  }
}
