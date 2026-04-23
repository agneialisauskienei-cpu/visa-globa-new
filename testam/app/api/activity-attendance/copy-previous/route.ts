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
    membership,
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, membership } = await getAuthContext(request)
    const body = await request.json()

    const session_id = String(body?.session_id || '').trim()

    if (!session_id) {
      return NextResponse.json(
        { message: 'session_id yra privalomas.' },
        { status: 400 }
      )
    }

    const { data: targetSession, error: targetError } = await supabase
      .from('activity_sessions')
      .select('id, organization_id, title, session_date')
      .eq('id', session_id)
      .eq('organization_id', membership.organization_id)
      .single()

    if (targetError) throw targetError

    const { data: previousSession, error: previousError } = await supabase
      .from('activity_sessions')
      .select('id, session_date')
      .eq('organization_id', targetSession.organization_id)
      .eq('title', targetSession.title)
      .lt('session_date', targetSession.session_date)
      .order('session_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (previousError) throw previousError

    if (!previousSession?.id) {
      return NextResponse.json(
        { message: 'Nerasta ankstesnės sesijos kopijavimui.' },
        { status: 404 }
      )
    }

    const { data: previousAttendance, error: attendanceError } = await supabase
      .from('activity_attendance')
      .select('resident_id, status, note')
      .eq('session_id', previousSession.id)

    if (attendanceError) throw attendanceError

    if (!previousAttendance || previousAttendance.length === 0) {
      return NextResponse.json(
        { message: 'Ankstesnė sesija neturi attendance duomenų.' },
        { status: 404 }
      )
    }

    const rows = previousAttendance.map((row) => ({
      session_id,
      resident_id: row.resident_id,
      status: row.status,
      note: row.note || null,
    }))

    const { error: upsertError } = await supabase
      .from('activity_attendance')
      .upsert(rows, {
        onConflict: 'session_id,resident_id',
      })

    if (upsertError) throw upsertError

    return NextResponse.json({
      success: true,
      copied_from_session_id: previousSession.id,
      copied_rows: rows.length,
    })
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Nepavyko nukopijuoti ankstesnio attendance.' },
      { status: error?.status || 500 }
    )
  }
}