import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { moduleForPath } from "@/lib/plans"

const ACTIVE_ORGANIZATION_COOKIE = "active_organization_id"

function forbiddenResponse(request: NextRequest, moduleKey: string) {
  return NextResponse.json(
    {
      ok: false,
      error: "Šis modulis nepriklauso organizacijos paketui.",
      module: moduleKey,
    },
    { status: 403 },
  )
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const bearerToken = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: bearerToken
        ? { headers: { Authorization: `Bearer ${bearerToken}` } }
        : undefined,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )

          response = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const moduleKey = moduleForPath(request.nextUrl.pathname)
  if (!moduleKey || !request.nextUrl.pathname.startsWith("/api/")) {
    return response
  }
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Neprisijungta." },
      { status: 401 },
    )
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role === "super_admin") return response

  const requestedOrganizationId =
    request.headers.get("x-organization-id")?.trim() ||
    request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value

  let membershipQuery = supabase
    .from("organization_members")
    .select("organization_id, organizations!inner(status)")
    .eq("user_id", user.id)
    .eq("is_active", true)

  if (requestedOrganizationId) {
    membershipQuery = membershipQuery.eq(
      "organization_id",
      requestedOrganizationId,
    )
  }

  const { data: memberships } = await membershipQuery.limit(1)
  const membership = memberships?.[0] as
    | {
        organization_id?: string
        organizations?: { status?: string | null } | null
      }
    | undefined

  if (
    !membership?.organization_id ||
    membership.organizations?.status === "archived" ||
    membership.organizations?.status === "suspended"
  ) {
    return forbiddenResponse(request, moduleKey)
  }

  const { data: entitlement } = await supabase
    .from("organization_modules")
    .select("is_enabled")
    .eq("organization_id", membership.organization_id)
    .eq("module_key", moduleKey)
    .maybeSingle()

  if (entitlement?.is_enabled !== true) {
    return forbiddenResponse(request, moduleKey)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
