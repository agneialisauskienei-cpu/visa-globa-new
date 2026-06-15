import type { SupabaseClient } from "@supabase/supabase-js"
import { MODULE_KEYS, modulesForPlan, normalizePlanCode } from "@/lib/plans"

export async function syncOrganizationPlan(
  admin: SupabaseClient,
  organizationId: string,
  rawPlan: unknown,
) {
  const plan = normalizePlanCode(rawPlan)
  if (!plan) throw new Error("Neteisingas planas.")

  const enabled = new Set(modulesForPlan(plan))
  const now = new Date().toISOString()

  const { error: closeError } = await admin
    .from("subscriptions")
    .update({ status: "inactive", ends_at: now })
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .neq("plan_code", plan)
  if (closeError) throw closeError

  const { error: subscriptionError } = await admin
    .from("subscriptions")
    .upsert(
      {
        organization_id: organizationId,
        plan_code: plan,
        status: "active",
        starts_at: now,
        ends_at: null,
      },
      { onConflict: "organization_id,plan_code" },
    )
  if (subscriptionError) throw subscriptionError

  const { error: modulesError } = await admin
    .from("organization_modules")
    .upsert(
      MODULE_KEYS.map((moduleKey) => ({
        organization_id: organizationId,
        module_key: moduleKey,
        is_enabled: enabled.has(moduleKey),
        updated_at: now,
      })),
      { onConflict: "organization_id,module_key" },
    )
  if (modulesError) throw modulesError

  return { plan, enabledModules: Array.from(enabled) }
}
