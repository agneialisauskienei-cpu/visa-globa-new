import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

export type OrganizationMembership = {
  organization_id: string
  role: 'owner' | 'admin' | 'employee'
}

export type OrganizationProfile = {
  id: string
  name: string | null
  code: string | null
  address: string | null
  logo_url: string | null
  created_by: string | null
  created_at?: string | null
}

function getReadableError(error: unknown) {
  if (!error) {
    return 'Nežinoma klaida.'
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object') {
    const maybeError = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    if (maybeError.message) return maybeError.message
    if (maybeError.details) return maybeError.details
    if (maybeError.hint) return maybeError.hint
    if (maybeError.code) return `Klaidos kodas: ${maybeError.code}`
  }

  return 'Nepavyko įvykdyti veiksmo.'
}

export async function getCurrentOrganization(
  userId: string
): Promise<OrganizationMembership> {
  const activeOrganizationId = await getCurrentOrganizationId()

  if (!activeOrganizationId) {
    throw new Error('Aktyvi organizacija nepasirinkta.')
  }

  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .eq('organization_id', activeOrganizationId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(getReadableError(error))
  }

  if (!data?.organization_id) {
    throw new Error('Vartotojas nepriskirtas pasirinktai įstaigai.')
  }

  return {
    organization_id: data.organization_id,
    role: data.role,
  }
}

export async function ensureUserOrganization(userId: string, email: string) {
  const { data: existingMemberships, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)

  if (membershipError) {
    throw new Error(getReadableError(membershipError))
  }

  if (existingMemberships && existingMemberships.length > 0) {
    return {
      organizationId: existingMemberships[0].organization_id,
      created: false,
    }
  }

  const defaultName = email?.trim()
    ? `${email.split('@')[0]} įstaiga`
    : 'Mano įstaiga'

  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: defaultName,
      created_by: userId,
    })
    .select('id')
    .single()

  if (orgError || !organization) {
    throw new Error(getReadableError(orgError))
  }

  const { error: memberInsertError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: organization.id,
      user_id: userId,
      role: 'owner',
      is_active: true,
    })

  if (memberInsertError) {
    throw new Error(getReadableError(memberInsertError))
  }

  return {
    organizationId: organization.id,
    created: true,
  }
}

export async function getOrganizationProfile(
  userId: string
): Promise<OrganizationProfile> {
  const membership = await getCurrentOrganization(userId)

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, code, address, logo_url, created_by, created_at')
    .eq('id', membership.organization_id)
    .single()

  if (error || !data) {
    throw new Error(getReadableError(error))
  }

  return data as OrganizationProfile
}

export async function updateOrganizationProfile(
  userId: string,
  values: {
    name: string
    code: string
    address: string
    logo_url: string
  }
) {
  const membership = await getCurrentOrganization(userId)

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    throw new Error('Neturi teisės redaguoti įstaigos profilio.')
  }

  const payload = {
    name: values.name.trim(),
    code: values.code.trim() || null,
    address: values.address.trim() || null,
    logo_url: values.logo_url.trim() || null,
  }

  if (!payload.name) {
    throw new Error('Įstaigos pavadinimas yra privalomas.')
  }

  const { data, error } = await supabase
    .from('organizations')
    .update(payload)
    .eq('id', membership.organization_id)
    .select('id, name, code, address, logo_url, created_by, created_at')
    .single()

  if (error || !data) {
    throw new Error(getReadableError(error))
  }

  return data as OrganizationProfile
}