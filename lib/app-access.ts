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

type OrganizationMemberRow = {
  organization_id: string | null
  role: unknown
  is_active?: boolean | null
}

const EMPTY_ACCESS: CurrentAccess = {
  userId: null,
  email: null,
  role: null,
  organizationId: null,
  isOwner: false,
  isAdmin: false,
  isEmployee: false,
}

const ROLE_PRIORITY: Record<SystemRole, number> = {
  owner: 3,
  admin: 2,
  employee: 1,
}

function normalizeRole(value: unknown): SystemRole | null {
  const role = String(value || '').toLowerCase().trim()

  if (role === 'owner') return 'owner'
  if (role === 'admin') return 'admin'
  if (role === 'employee') return 'employee'

  return null
}

function buildAccess(
  userId: string | null,
  email: string | null,
  role: SystemRole | null,
  organizationId: string | null
): CurrentAccess {
  return {
    userId,
    email,
    role,
    organizationId,
    isOwner: role === 'owner',
    isAdmin: role === 'owner' || role === 'admin',
    isEmployee: role === 'owner' || role === 'admin' || role === 'employee',
  }
}

function pickHighestRole(memberships: OrganizationMemberRow[]) {
  let selected: {
    role: SystemRole
    organizationId: string | null
  } | null = null

  for (const membership of memberships) {
    if (membership.is_active === false) continue

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

async function loadOrganizationMemberships(userId: string) {
  /**
   * Tavo duomenų bazėje narystės lentelė vadinasi `organization_members`,
   * o ne `memberships`. Pirmiausia bandom skaityti su `is_active`, jei toks
   * stulpelis yra. Jei projekte jo nėra, darom fallback be šio filtro.
   */
  const withActive = await supabase
    .from('organization_members')
    .select('organization_id, role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!withActive.error) {
    return {
      data: (withActive.data || []) as OrganizationMemberRow[],
      error: null,
    }
  }

  const message = String(withActive.error.message || '').toLowerCase()
  const isMissingActiveColumn =
    message.includes('is_active') ||
    message.includes('column') ||
    message.includes('schema cache')

  if (!isMissingActiveColumn) {
    return {
      data: [] as OrganizationMemberRow[],
      error: withActive.error,
    }
  }

  const withoutActive = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)

  return {
    data: (withoutActive.data || []) as OrganizationMemberRow[],
    error: withoutActive.error,
  }
}

export async function getCurrentAccess(): Promise<CurrentAccess> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    console.error('getCurrentAccess user error:', userError)
    return EMPTY_ACCESS
  }

  if (!user) {
    return EMPTY_ACCESS
  }

  const { data: memberships, error } = await loadOrganizationMemberships(user.id)

  if (error) {
    console.error('getCurrentAccess organization_members error:', error)
    return buildAccess(user.id, user.email || null, null, null)
  }

  const selected = pickHighestRole(memberships)
  const role = selected?.role || null

  return buildAccess(
    user.id,
    user.email || null,
    role,
    selected?.organizationId || null
  )
}
