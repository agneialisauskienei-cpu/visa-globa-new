import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import type { StarterAuthContext } from './types'

type StarterRole = 'owner' | 'admin' | 'manager' | 'employee'

function getBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (!auth) return null

  const [type, token] = auth.split(' ')
  if (type?.toLowerCase() !== 'bearer' || !token) return null

  return token
}

function getOrganizationIdFromRequest(request: NextRequest): string | null {
  const organizationId = request.headers.get('x-organization-id')?.trim()
  return organizationId || null
}

function createHttpError(message: string, status: number) {
  const err = new Error(message) as Error & { status?: number }
  err.status = status
  return err
}

export function createRouteSupabase(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  const token = getBearerToken(request)

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  })
}

export async function getStarterAuthContext(
  request: NextRequest
): Promise<{ supabase: any; ctx: StarterAuthContext }> {
  const supabase = createRouteSupabase(request)
  const activeOrganizationId = getOrganizationIdFromRequest(request)

  if (!activeOrganizationId) {
    throw createHttpError('Missing x-organization-id header', 400)
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw createHttpError('Unauthorized', 401)
  }

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id, role, is_active')
    .eq('user_id', user.id)
    .eq('organization_id', activeOrganizationId)
    .eq('is_active', true)
    .maybeSingle()

  if (membershipError) {
    throw membershipError
  }

  if (!membership?.organization_id) {
    throw createHttpError('Forbidden', 403)
  }

  const role = (membership.role || 'employee') as StarterRole

  const ctx: StarterAuthContext = {
    userId: user.id,
    organizationId: membership.organization_id,
    role,
    scope:
      role === 'owner' || role === 'admin' || role === 'manager'
        ? 'all'
        : 'assigned_only',
    canViewSensitive:
      role === 'owner' || role === 'admin' || role === 'manager',
  }

  return { supabase, ctx }
}