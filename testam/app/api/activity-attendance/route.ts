import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type AttendanceStatus = 'attended' | 'absent' | 'refused'

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
    const rows = Array.isArray(body?.rows) ? body.rows : []

    if (!session_id) {
      return NextResponse.json(
        { message: 'session_id yra privalomas.' },
        { status: 400 }
      )
    }

    const { data: sessionRow, error: sessionError } = await supabase
      .from('activity_sessions')
      .select('id, organization_id')
      .eq('id', session_id)
      .eq('organization_id', membership.organization_id)
      .maybeSingle()

    if (sessionError) throw sessionError

    if (!sessionRow?.id) {
      return NextResponse.json(
        { message: 'Sesija nerasta arba nepriklauso jūsų organizacijai.' },
        { status: 404 }
      )
    }

    const normalizedRows = rows
      .map((row: any) => ({
        session_id,
        resident_id: String(row?.resident_id || '').trim(),
        status: String(row?.status || '').trim() as AttendanceStatus,
        note: row?.note ? String(row.note).trim() : null,
      }))
      .filter(
        (row: {
          session_id: string
          resident_id: string
          status: string
          note: string | null
        }) => row.resident_id && row.status
      )

    if (normalizedRows.length === 0) {
      return NextResponse.json(
        { message: 'Nėra ką išsaugoti.' },
        { status: 400 }
      )
    }

    const allowedStatuses: AttendanceStatus[] = ['attended', 'absent', 'refused']

    for (const row of normalizedRows) {
      if (!allowedStatuses.includes(row.status as AttendanceStatus)) {
        return NextResponse.json(
          { message: `Neleistinas attendance status: ${row.status}` },
          { status: 400 }
        )
      }
    }

    const residentIds = normalizedRows.map((row) => row.resident_id)

    const { data: validResidents, error: residentsError } = await supabase
      .from('residents')
      .select('id')
      .eq('organization_id', membership.organization_id)
      .in('id', residentIds)

    if (residentsError) throw residentsError

    const validResidentSet = new Set((validResidents || []).map((row) => row.id))
    const invalidRow = normalizedRows.find((row) => !validResidentSet.has(row.resident_id))

    if (invalidRow) {
      return NextResponse.json(
        {
          message:
            'Bent vienas gyventojas nepriklauso jūsų organizacijai arba neegzistuoja.',
        },
        { status: 400 }
      )
    }

    const { error } = await supabase.from('activity_attendance').upsert(normalizedRows, {
      onConflict: 'session_id,resident_id',
    })

    if (error) throw error

    return NextResponse.json({
      success: true,
      saved_rows: normalizedRows.length,
    })
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Nepavyko išsaugoti dalyvavimo.' },
      { status: error?.status || 500 }
    )
  }
}
