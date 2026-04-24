import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type ArchiveOrganizationBody = {
  organizationId?: string
  actorUserId?: string | null
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
    const body = (await request.json()) as ArchiveOrganizationBody
    const organizationId = body.organizationId?.trim()
    const actorUserId = body.actorUserId?.trim() || null

    if (!organizationId) {
      return jsonError('Trūksta organizationId.')
    }

    const supabase = getServiceSupabase()

    const { data: organization, error: organizationError } = await supabase
      .from('organizations')
      .select('id, name, status, archived_at')
      .eq('id', organizationId)
      .maybeSingle()

    if (organizationError) {
      return jsonError(organizationError.message, 500)
    }

    if (!organization) {
      return jsonError('Organizacija nerasta.', 404)
    }

    if (organization.status === 'archived') {
      return NextResponse.json({
        ok: true,
        message: 'Įstaiga jau archyvuota.',
      })
    }

    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
      })
      .eq('id', organizationId)

    if (updateError) {
      return jsonError(updateError.message, 500)
    }

    const { error: auditError } = await supabase.rpc('log_audit_event', {
      p_actor_user_id: actorUserId,
      p_organization_id: organizationId,
      p_entity_type: 'organization',
      p_entity_id: organizationId,
      p_action: 'organization_archived',
      p_old_values: {
        status: organization.status,
        archived_at: organization.archived_at,
      },
      p_new_values: {
        status: 'archived',
        archived_at: new Date().toISOString(),
      },
    })

    if (auditError) {
      return jsonError(auditError.message, 500)
    }

    return NextResponse.json({
      ok: true,
      message: 'Įstaiga sėkmingai archyvuota.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Serverio klaida.'
    return jsonError(message, 500)
  }
}