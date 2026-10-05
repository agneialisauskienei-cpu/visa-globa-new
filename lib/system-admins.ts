import type { SupabaseClient } from "@supabase/supabase-js"

type SystemAdminRow = {
  email: string | null
  is_active: boolean | null
}

export function normalizeSystemAdminEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase()
}

export async function isSystemAdminEmail(
  client: SupabaseClient,
  email?: string | null,
) {
  const normalizedEmail = normalizeSystemAdminEmail(email)
  if (!normalizedEmail) return false

  const { data, error } = await client
    .from("system_admins")
    .select("email, is_active")
    .eq("email", normalizedEmail)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    console.warn("[system-admins] failed to check system admin", error)
    return false
  }

  const row = data as SystemAdminRow | null
  return row?.is_active === true
}
