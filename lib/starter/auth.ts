import type { StarterAuthContext } from './types'

export function canAccessResident(ctx: StarterAuthContext, resident: { id: string; created_by: string | null }, assignedResidentIds: string[]) {
  if (ctx.scope === 'all') return true
  if (ctx.scope === 'own_created') return resident.created_by === ctx.userId
  if (ctx.scope === 'assigned_only') return assignedResidentIds.includes(resident.id)
  return false
}

export function maskSensitiveResident<T extends Record<string, unknown>>(ctx: StarterAuthContext, row: T): T {
  if (ctx.canViewSensitive) return row
  return {
    ...row,
    personal_code: null,
    birth_date: null,
    phone: null,
    email: null,
    address: null,
    internal_notes: null,
  }
}
