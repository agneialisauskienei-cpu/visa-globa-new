import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServerSupabase(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  )
}

async function getAuthContext(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : ''

  if (!token) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 })
  }

  const supabase = getServerSupabase(token)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token)

  if (userError || !user) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 })
  }

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (membershipError) throw membershipError

  if (!membership?.organization_id) {
    throw Object.assign(new Error('Nepavyko nustatyti organizacijos.'), {
      status: 400,
    })
  }

  return {
    supabase,
    user,
    membership,
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, membership } = await getAuthContext(request)
    const body = await request.json()

    if (!['owner', 'admin', 'employee'].includes(membership.role || '')) {
      return NextResponse.json(
        { message: 'Neturite teisės kurti veiklos sesijos.' },
        { status: 403 }
      )
    }

    const title = String(body?.title || '').trim()
    const session_date = String(body?.session_date || '').trim()

    if (!title) {
      return NextResponse.json(
        { message: 'title yra privalomas.' },
        { status: 400 }
      )
    }

    if (!session_date) {
      return NextResponse.json(
        { message: 'session_date yra privalomas.' },
        { status: 400 }
      )
    }

    const payload = {
      organization_id: membership.organization_id,
      template_id: body?.template_id || null,
      title,
      session_date,
      start_time: body?.start_time || null,
      end_time: body?.end_time || null,
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from('activity_sessions')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Nepavyko sukurti veiklos sesijos.' },
      { status: error?.status || 500 }
    )
  }
}