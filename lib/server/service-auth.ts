import { createClient } from "@supabase/supabase-js"

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Trūksta Supabase serverio nustatymų.")
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function getBearerToken(request: Request) {
  const value = request.headers.get("authorization") || ""
  return value.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || ""
}

export async function requireAuthenticatedUser(request: Request) {
  const admin = createServiceClient()
  const token = getBearerToken(request)
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  return error ? null : data.user
}

export async function requireSystemAdmin(request: Request) {
  const admin = createServiceClient()
  const user = await requireAuthenticatedUser(request)
  if (!user) return null

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  return profile?.role === "super_admin" ? user : null
}

export async function requireOrganizationAdmin(
  request: Request,
  organizationId: string,
) {
  const admin = createServiceClient()
  const user = await requireAuthenticatedUser(request)
  if (!user) return null

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role === "super_admin") return user

  const { data: membership } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role", ["owner", "admin", "super_admin"])
    .maybeSingle()

  return membership ? user : null
}
