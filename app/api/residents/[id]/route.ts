import { NextRequest, NextResponse } from 'next/server'
import { getStarterAuthContext } from '@/lib/starter/server'

type ResidentCurrentStatus =
  | 'netrukus_atvyks'
  | 'gyvena'
  | 'ligonineje'
  | 'laikinai_isvykes'
  | 'sutartis_nutraukta'
  | 'mire'

const ALLOWED_STATUSES: ResidentCurrentStatus[] = [
  'netrukus_atvyks',
  'gyvena',
  'ligonineje',
  'laikinai_isvykes',
  'sutartis_nutraukta',
  'mire',
]

function normalizeResidentStatus(
  rawStatus: unknown
): {
  current_status: ResidentCurrentStatus
  is_active: boolean
  status: 'active' | 'archived'
} {
  const value =
    typeof rawStatus === 'string' && ALLOWED_STATUSES.includes(rawStatus as ResidentCurrentStatus)
      ? (rawStatus as ResidentCurrentStatus)
      : 'netrukus_atvyks'

  const archived = value === 'sutartis_nutraukta' || value === 'mire'

  return {
    current_status: value,
    is_active: !archived,
    status: archived ? 'archived' : 'active',
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, ctx } = await getStarterAuthContext(request)
    const { id } = await context.params

    const { data, error } = await supabase
      .from('residents')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Nepavyko užkrauti gyventojo.' },
      { status: error?.status || 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, ctx } = await getStarterAuthContext(request)
    const { id } = await context.params

    if (!['owner', 'admin', 'manager'].includes(ctx.role)) {
      return NextResponse.json(
        { message: 'Neturite teisės redaguoti gyventojo.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const full_name = String(body?.full_name || '').trim()

    if (!full_name) {
      return NextResponse.json(
        { message: 'full_name yra privalomas.' },
        { status: 400 }
      )
    }

    const normalized = normalizeResidentStatus(body?.current_status)

    const updatePayload = {
      full_name,
      current_status: normalized.current_status,
      is_active: normalized.is_active,
      status: normalized.status,
      birth_date: body?.birth_date || null,
      phone: body?.phone || null,
      email: body?.email || null,
      address: body?.address || null,
      internal_notes: body?.internal_notes || null,
    }

    const { data, error } = await supabase
      .from('residents')
      .update(updatePayload)
      .eq('organization_id', ctx.organizationId)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Nepavyko atnaujinti gyventojo.' },
      { status: error?.status || 500 }
    )
  }
}