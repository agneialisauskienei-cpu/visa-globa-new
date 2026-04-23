import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/server/auth-context'

type AttendanceStatus = 'attended' | 'absent' | 'refused'

export async function POST(request: NextRequest) {
  try {
    const { supabase, ctx } = await getAuthContext(request)
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
      .eq('organization_id', ctx.organizationId)
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
      .eq('organization_id', ctx.organizationId)
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

    const { error } = await supabase
      .from('activity_attendance')
      .upsert(normalizedRows, {
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
