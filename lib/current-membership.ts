import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

export type CurrentMembership = {
  organization_id: string
  role: 'owner' | 'admin' | 'employee'
  staff_type?: string | null
  position?: string | null
  department?: string | null
  is_deputy?: boolean | null
  occupational_health_valid_until?: string | null
  professional_license_number?: string | null
  professional_license_valid_until?: string | null
}

export async function getCurrentMembership(
  userId: string
): Promise<CurrentMembership | null> {
  const organizationId = await getCurrentOrganizationId()

  if (!organizationId) {
    return null
  }

  const { data, error } = await supabase
    .from('organization_members')
    .select(
      `
      organization_id,
      role,
      staff_type,
      position,
      department,
      is_deputy,
      occupational_health_valid_until,
      professional_license_number,
      professional_license_valid_until
    `
    )
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as CurrentMembership | null) || null
}