import { canAccessResident, maskSensitiveResident } from './auth'
import type { ResidentRow, StarterAuthContext } from './types'

export async function listAssignedResidentIds(
  supabase: any,
  ctx: StarterAuthContext
): Promise<string[]> {
  const { data, error } = await supabase
    .from('resident_assignments')
    .select('resident_id')
    .eq('organization_id', ctx.organizationId)
    .eq('employee_user_id', ctx.userId)

  if (error) throw error
  return (data ?? []).map((row: { resident_id: string }) => row.resident_id)
}

export async function listResidents(supabase: any, ctx: StarterAuthContext) {
  const assignedResidentIds = await listAssignedResidentIds(supabase, ctx)

  const { data, error } = await supabase
    .from('residents')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .order('full_name', { ascending: true })

  if (error) throw error

  return ((data ?? []) as ResidentRow[])
    .filter((row) => canAccessResident(ctx, row, assignedResidentIds))
    .map((row) => maskSensitiveResident(ctx, row))
}

export async function getResidentById(
  supabase: any,
  ctx: StarterAuthContext,
  id: string
) {
  const assignedResidentIds = await listAssignedResidentIds(supabase, ctx)

  const { data, error } = await supabase
    .from('residents')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .eq('id', id)
    .single()

  if (error) throw error
  if (!canAccessResident(ctx, data, assignedResidentIds)) {
    const err = new Error('Forbidden') as Error & { status?: number }
    err.status = 403
    throw err
  }

  return maskSensitiveResident(ctx, data)
}