import { NextRequest, NextResponse } from 'next/server'
import { getStarterAuthContext } from '@/lib/starter/server'

export async function GET(request: NextRequest) {
  try {
    const { supabase, ctx } = await getStarterAuthContext(request)

    const { data, error } = await supabase
      .from('resident_assignments')
      .select('id, organization_id, resident_id, employee_user_id, created_at')
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Nepavyko užkrauti priskyrimų.' },
      { status: error?.status || 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, ctx } = await getStarterAuthContext(request)

    if (!['owner', 'admin', 'manager'].includes(ctx.role)) {
      return NextResponse.json(
        { message: 'Neturite teisės priskirti gyventojų darbuotojams.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const resident_id = String(body?.resident_id || '').trim()
    const employee_user_id = String(body?.employee_user_id || '').trim()

    if (!resident_id || !employee_user_id) {
      return NextResponse.json(
        { message: 'resident_id ir employee_user_id yra privalomi.' },
        { status: 400 }
      )
    }

    const { data: employeeMembership, error: employeeMembershipError } = await supabase
      .from('organization_members')
      .select('user_id, is_active')
      .eq('organization_id', ctx.organizationId)
      .eq('user_id', employee_user_id)
      .maybeSingle()

    if (employeeMembershipError) throw employeeMembershipError

    if (!employeeMembership?.user_id) {
      return NextResponse.json(
        { message: 'Pasirinktas darbuotojas nepriklauso šiai organizacijai.' },
        { status: 400 }
      )
    }

    if (employeeMembership.is_active === false) {
      return NextResponse.json(
        { message: 'Negalima priskirti neaktyvaus darbuotojo.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('resident_assignments')
      .insert({
        organization_id: ctx.organizationId,
        resident_id,
        employee_user_id,
      })
      .select('id, organization_id, resident_id, employee_user_id, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { message: 'Šis darbuotojas jau priskirtas šiam gyventojui.' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Nepavyko priskirti darbuotojo.' },
      { status: error?.status || 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, ctx } = await getStarterAuthContext(request)

    if (!['owner', 'admin', 'manager'].includes(ctx.role)) {
      return NextResponse.json(
        { message: 'Neturite teisės nuimti priskyrimų.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const resident_id = String(body?.resident_id || '').trim()
    const employee_user_id = String(body?.employee_user_id || '').trim()

    if (!resident_id || !employee_user_id) {
      return NextResponse.json(
        { message: 'resident_id ir employee_user_id yra privalomi.' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('resident_assignments')
      .delete()
      .eq('organization_id', ctx.organizationId)
      .eq('resident_id', resident_id)
      .eq('employee_user_id', employee_user_id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Nepavyko nuimti priskyrimo.' },
      { status: error?.status || 500 }
    )
  }
}