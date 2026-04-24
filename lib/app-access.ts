import { supabase } from '@/lib/supabase'

export type SystemRole = 'owner' | 'admin' | 'employee'

export type CurrentAccess = {
  userId: string | null
  email: string | null
  role: SystemRole | null
  organizationId: string | null
  isOwner: boolean
  isAdmin: boolean
  isEmployee: boolean
}

const ROLE_PRIORITY: Record<SystemRole, number> = {
  owner: 3,
  admin: 2,
  employee: 1,
}

function normalizeRole(value: unknown): SystemRole | null {
  if (value === 'owner') return 'owner'
  if (value === 'admin') return 'admin'
  if (value === 'employee') return 'employee'
  return null
}

function pickHighestRole(
  memberships: Array<{
    organization_id: string | null
    role: unknown
  }>
) {
  let selected: {
    role: SystemRole
    organizationId: string | null
  } | null = null

  for (const membership of memberships) {
    const role = normalizeRole(membership.role)

    if (!role) continue

    if (!selected || ROLE_PRIORITY[role] > ROLE_PRIORITY[selected.role]) {
      selected = {
        role,
        organizationId: membership.organization_id,
      }
    }
  }

  return selected
}

export async function getCurrentAccess(): Promise<CurrentAccess> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      userId: null,
      email: null,
      role: null,
      organizationId: null,
      isOwner: false,
      isAdmin: false,
      isEmployee: false,
    }
  }

  const { data: memberships, error } = await supabase
    .from('organization_members')
    .select('organization_id, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (error) {
    console.error('getCurrentAccess memberships error:', error)

    return {
      userId: user.id,
      email: user.email || null,
      role: null,
      organizationId: null,
      isOwner: false,
      isAdmin: false,
      isEmployee: false,
    }
  }

  const selected = pickHighestRole(
    ((memberships || []) as Array<{
      organization_id: string | null
      role: unknown
      is_active: boolean | null
    }>).map((membership) => ({
      organization_id: membership.organization_id,
      role: membership.role,
    }))
  )

  const role = selected?.role || null

  return {
    userId: user.id,
    email: user.email || null,
    role,
    organizationId: selected?.organizationId || null,
    isOwner: role === 'owner',
    isAdmin: role === 'owner' || role === 'admin',
    isEmployee: role === 'owner' || role === 'admin' || role === 'employee',
  }
}