import { supabase } from '@/lib/supabase'

const KEY = 'active_organization_id'

export type ActiveMembership = {
  organization_id: string
  role?: 'owner' | 'admin' | 'employee' | null
  organization_name?: string | null
}

function canUseStorage() {
  return typeof window !== 'undefined'
}

export function getStoredOrganizationId(): string | null {
  if (!canUseStorage()) return null

  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setStoredOrganizationId(id: string | null) {
  if (!canUseStorage()) return

  try {
    if (!id) {
      window.localStorage.removeItem(KEY)
      return
    }

    window.localStorage.setItem(KEY, id)
  } catch {
    // ignore storage errors
  }
}

export async function getActiveMemberships(): Promise<ActiveMembership[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return []

  const { data, error } = await supabase
    .from('organization_members')
    .select(
      `
      organization_id,
      role,
      organizations (
        name
      )
    `
    )
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (error || !data) {
    console.error('Failed to load active memberships:', error)
    return []
  }

  return (data as any[]).map((row) => ({
    organization_id: row.organization_id,
    role: row.role,
    organization_name: row.organizations?.name || 'Be pavadinimo',
  }))
}

export async function getCurrentOrganizationId(): Promise<string | null> {
  const memberships = await getActiveMemberships()

  if (!memberships.length) {
    setStoredOrganizationId(null)
    return null
  }

  const storedId = getStoredOrganizationId()

  if (storedId && memberships.some((m) => m.organization_id === storedId)) {
    return storedId
  }

  const fallbackId = memberships[0]?.organization_id || null
  setStoredOrganizationId(fallbackId)

  return fallbackId
}

export async function getCurrentOrganizationContext(): Promise<{
  organizationId: string | null
  memberships: ActiveMembership[]
  activeMembership: ActiveMembership | null
}> {
  const memberships = await getActiveMemberships()

  if (!memberships.length) {
    setStoredOrganizationId(null)
    return {
      organizationId: null,
      memberships: [],
      activeMembership: null,
    }
  }

  const organizationId = await getCurrentOrganizationId()
  const activeMembership =
    memberships.find((m) => m.organization_id === organizationId) || null

  return {
    organizationId,
    memberships,
    activeMembership,
  }
}

export async function setCurrentOrganizationId(id: string): Promise<boolean> {
  const memberships = await getActiveMemberships()

  const exists = memberships.some((m) => m.organization_id === id)
  if (!exists) return false

  setStoredOrganizationId(id)
  return true
}