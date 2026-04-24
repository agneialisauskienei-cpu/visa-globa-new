import { supabase } from '@/lib/supabase'

export type AuditAction = 'insert' | 'update' | 'delete'

function normalizeUuid(value?: string | null) {
  if (!value) return null

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  return uuidRegex.test(value) ? value : null
}

export function getChangedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const result: Record<string, { from: unknown; to: unknown }> = {}

  Object.keys(after).forEach((key) => {
    const oldValue = before[key] ?? null
    const newValue = after[key] ?? null

    if (String(oldValue ?? '') !== String(newValue ?? '')) {
      result[key] = {
        from: oldValue,
        to: newValue,
      }
    }
  })

  return result
}

export async function logAudit({
  organizationId,
  tableName,
  recordId,
  action,
  changes,
}: {
  organizationId?: string | null
  tableName: string
  recordId?: string | null
  action: AuditAction
  changes?: unknown
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const payload = {
    organization_id: normalizeUuid(organizationId),
    table_name: tableName,
    record_id: normalizeUuid(recordId),
    action,
    changed_by: normalizeUuid(user?.id || null),
    changes: changes || {},
  }

  const { error } = await supabase.from('audit_log').insert(payload)

  if (error) {
    console.error('AUDIT ERROR MESSAGE:', error.message)
    console.error('AUDIT ERROR DETAILS:', error.details)
    console.error('AUDIT ERROR HINT:', error.hint)
    console.error('AUDIT PAYLOAD:', payload)
  }
}