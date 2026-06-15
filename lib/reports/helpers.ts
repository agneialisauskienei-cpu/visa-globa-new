import { SupabaseClient } from "@supabase/supabase-js"

export async function getActiveOrganizationId(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, user_id, role, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .limit(1)

  if (error) throw error

  return data?.[0]?.organization_id as string | undefined
}

export function fullName(profile?: {
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
} | null) {
  return (
    profile?.full_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.email ||
    "Nenurodyta"
  )
}
