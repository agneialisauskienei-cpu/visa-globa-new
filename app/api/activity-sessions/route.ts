import { NextRequest, NextResponse } from 'next/server'
import {
  canCreateActivitySession,
  getAuthContext,
  isValidDateInput,
  isValidTimeInput,
  isValidTimeRange,
  normalizeOptionalString,
} from '@/lib/server/auth-context'

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, membership, activeOrganizationId } =
      await getAuthContext(request)

    if (!canCreateActivitySession(membership)) {
      return NextResponse.json(
        { message: 'Neturite teisės kurti veiklos sesijos.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const title = String(body?.title || '').trim()
    const session_date = String(body?.session_date || '').trim()
    const start_time = normalizeOptionalString(body?.start_time)
    const end_time = normalizeOptionalString(body?.end_time)
    const template_id = normalizeOptionalString(body?.template_id)

    if (!title) {
      return NextResponse.json(
        { message: 'Veiklos pavadinimas yra privalomas.' },
        { status: 400 }
      )
    }

    if (!session_date) {
      return NextResponse.json(
        { message: 'Veiklos data yra privaloma.' },
        { status: 400 }
      )
    }

    if (!isValidDateInput(session_date)) {
      return NextResponse.json(
        { message: 'Neteisingas datos formatas. Naudok YYYY-MM-DD.' },
        { status: 400 }
      )
    }

    if (start_time && !isValidTimeInput(start_time)) {
      return NextResponse.json(
        { message: 'Neteisingas pradžios laiko formatas.' },
        { status: 400 }
      )
    }

    if (end_time && !isValidTimeInput(end_time)) {
      return NextResponse.json(
        { message: 'Neteisingas pabaigos laiko formatas.' },
        { status: 400 }
      )
    }

    if (!isValidTimeRange(start_time, end_time)) {
      return NextResponse.json(
        { message: 'Pabaigos laikas turi būti vėlesnis už pradžios laiką.' },
        { status: 400 }
      )
    }

    const payload = {
      organization_id: activeOrganizationId,
      template_id,
      title,
      session_date,
      start_time,
      end_time,
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from('activity_sessions')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Nepavyko sukurti veiklos sesijos.' },
      { status: error?.status || 500 }
    )
  }
}