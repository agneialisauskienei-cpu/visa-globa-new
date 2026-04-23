import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/server/auth-context'

export async function POST(request: NextRequest) {
  try {
    const { supabase, ctx } = await getAuthContext(request)
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
      .eq('organization_id', ctx.organizationId)
      .single()

    if (targetError) throw targetError

    const { data: previousSession, error: previousError } = await supabase
      .from('activity_sessions')
      .select('id, session_date')
      .eq('organization_id', ctx.organizationId)
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

    const residentIds = previousAttendance.map((row) => row.resident_id)

    const { data: validResidents, error: residentsError } = await supabase
      .from('residents')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .in('id', residentIds)

    if (residentsError) throw residentsError

    const validResidentSet = new Set((validResidents || []).map((row) => row.id))

    const rows = previousAttendance
      .filter((row) => validResidentSet.has(row.resident_id))
      .map((row) => ({
        session_id,
        resident_id: row.resident_id,
        status: row.status,
        note: row.note || null,
      }))

    if (rows.length === 0) {
      return NextResponse.json(
        { message: 'Nėra tinkamų attendance įrašų kopijavimui šiai organizacijai.' },
        { status: 400 }
      )
    }

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