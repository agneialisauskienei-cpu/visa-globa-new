import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type AssignAdminBody = {
  organizationId?: string
  email?: string
  actorUserId?: string | null
}

type PlanLimitsRow = {
  plan_code: string
  max_members: number
  max_residents: number
  can_export: boolean
  can_use_reports: boolean
  can_have_multiple_admins: boolean
  can_use_api: boolean
}

type MembershipRow = {
  id: string
  organization_id: string
  user_id: string
  role: 'owner' | 'admin' | 'employee'
  is_active: boolean
  invited_by?: string | null
  created_at?: string | null
  updated_at?: string | null
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AssignAdminBody
    const organizationId = body.organizationId?.trim()
    const email = body.email?.trim().toLowerCase()
    const actorUserId = body.actorUserId?.trim() || null

    if (!organizationId) {
      return jsonError('Trūksta organizationId.')
    }

    if (!email) {
      return jsonError('Trūksta admin el. pašto.')
    }

    const supabase = getServiceSupabase()

    const { data: organization, error: organizationError } = await supabase
      .from('organizations')
      .select('id, name, plan, status')
      .eq('id', organizationId)
      .maybeSingle()

    if (organizationError) {
      return jsonError(organizationError.message, 500)
    }

    if (!organization) {
      return jsonError('Organizacija nerasta.', 404)
    }

    if (organization.status === 'archived') {
      return jsonError('Archyvuotai įstaigai admin priskirti negalima.')
    }

    const { data: planLimits, error: planLimitsError } = await supabase
      .from('plan_limits')
      .select(
        'plan_code, max_members, max_residents, can_export, can_use_reports, can_have_multiple_admins, can_use_api'
      )
      .eq('plan_code', organization.plan || 'basic')
      .maybeSingle<PlanLimitsRow>()

    if (planLimitsError) {
      return jsonError(planLimitsError.message, 500)
    }

    if (!planLimits) {
      return jsonError('Nepavyko rasti plano limitų.', 500)
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, full_name')
      .ilike('email', email)
      .maybeSingle()

    if (profileError) {
      return jsonError(profileError.message, 500)
    }

    if (!profile?.id) {
      const token =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`

      const { data: existingInvite, error: existingInviteError } = await supabase
        .from('organization_invites')
        .select('id')
        .eq('organization_id', organizationId)
        .ilike('email', email)
        .eq('role', 'admin')
        .eq('status', 'pending')
        .maybeSingle()

      if (existingInviteError) {
        return jsonError(existingInviteError.message, 500)
      }

      if (existingInvite?.id) {
        return NextResponse.json({
          ok: true,
          type: 'invite_exists',
          message: 'Šiam el. paštui jau yra aktyvus admin kvietimas.',
        })
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const { error: inviteError } = await supabase.from('organization_invites').insert({
        organization_id: organizationId,
        email,
        role: 'admin',
        token,
        status: 'pending',
        invited_by: actorUserId,
        expires_at: expiresAt,
      })

      if (inviteError) {
        return jsonError(inviteError.message, 500)
      }

      await supabase.rpc('log_audit_event', {
        p_actor_user_id: actorUserId,
        p_organization_id: organizationId,
        p_entity_type: 'organization_invite',
        p_entity_id: email,
        p_action: 'admin_invited',
        p_old_values: null,
        p_new_values: {
          email,
          role: 'admin',
          status: 'pending',
        },
      })

      return NextResponse.json({
        ok: true,
        type: 'invite_created',
        message: 'Vartotojas nerastas, todėl sukurtas admin kvietimas.',
      })
    }

    const { data: existingMembership, error: existingMembershipError } = await supabase
      .from('organization_members')
      .select('id, organization_id, user_id, role, is_active, invited_by, created_at, updated_at')
      .eq('organization_id', organizationId)
      .eq('user_id', profile.id)
      .maybeSingle<MembershipRow>()

    if (existingMembershipError) {
      return jsonError(existingMembershipError.message, 500)
    }

    const { count: membersCount, error: membersCountError } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    if (membersCountError) {
      return jsonError(membersCountError.message, 500)
    }

    const memberAlreadyExists = Boolean(existingMembership?.id)

    if (!memberAlreadyExists && (membersCount || 0) >= planLimits.max_members) {
      return jsonError(
        `Pasiektas plano darbuotojų limitas (${planLimits.max_members}). Pakeisk planą arba pašalink dalį narių.`
      )
    }

    const { count: activeAdminCount, error: activeAdminCountError } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('role', 'admin')
      .eq('is_active', true)

    if (activeAdminCountError) {
      return jsonError(activeAdminCountError.message, 500)
    }

    const targetAlreadyActiveAdmin =
      existingMembership?.role === 'admin' && existingMembership?.is_active === true

    if (!planLimits.can_have_multiple_admins && !targetAlreadyActiveAdmin) {
      const { error: deactivateAdminsError } = await supabase
        .from('organization_members')
        .update({ is_active: false })
        .eq('organization_id', organizationId)
        .eq('role', 'admin')
        .neq('user_id', profile.id)
        .eq('is_active', true)

      if (deactivateAdminsError) {
        return jsonError(deactivateAdminsError.message, 500)
      }
    } else if (
      planLimits.can_have_multiple_admins &&
      targetAlreadyActiveAdmin &&
      (activeAdminCount || 0) > 0
    ) {
      return NextResponse.json({
        ok: true,
        type: 'already_admin',
        message: 'Šis vartotojas jau yra aktyvus admin.',
      })
    }

    if (existingMembership?.id) {
      const { error: updateMembershipError } = await supabase
        .from('organization_members')
        .update({
          role: 'admin',
          is_active: true,
          invited_by: actorUserId,
        })
        .eq('id', existingMembership.id)

      if (updateMembershipError) {
        return jsonError(updateMembershipError.message, 500)
      }
    } else {
      const { error: insertMembershipError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: profile.id,
          role: 'admin',
          is_active: true,
          invited_by: actorUserId,
        })

      if (insertMembershipError) {
        return jsonError(insertMembershipError.message, 500)
      }
    }

    const { error: clearInvitesError } = await supabase
      .from('organization_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .ilike('email', email)
      .eq('role', 'admin')
      .eq('status', 'pending')

    if (clearInvitesError) {
      return jsonError(clearInvitesError.message, 500)
    }

    await supabase.rpc('log_audit_event', {
      p_actor_user_id: actorUserId,
      p_organization_id: organizationId,
      p_entity_type: 'organization_member',
      p_entity_id: profile.id,
      p_action: 'admin_assigned',
      p_old_values: existingMembership || null,
      p_new_values: {
        organization_id: organizationId,
        user_id: profile.id,
        role: 'admin',
        is_active: true,
      },
    })

    return NextResponse.json({
      ok: true,
      type: 'admin_assigned',
      message: planLimits.can_have_multiple_admins
        ? 'Admin sėkmingai pridėtas.'
        : 'Admin sėkmingai priskirtas.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Serverio klaida.'
    return jsonError(message, 500)
  }
}