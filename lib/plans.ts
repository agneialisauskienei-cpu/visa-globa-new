export const PLAN_CODES = ["starter", "basic", "pro", "enterprise"] as const
export type PlanCode = (typeof PLAN_CODES)[number]

export const MODULE_KEYS = [
  "employees",
  "tasks",
  "residents",
  "activities",
  "medicine",
  "rooms",
  "inventory",
  "handover",
  "reports",
  "audit",
] as const
export type ModuleKey = (typeof MODULE_KEYS)[number]

export const PLAN_MODULES: Record<PlanCode, readonly ModuleKey[]> = {
  starter: ["employees", "tasks", "residents", "rooms"],
  basic: ["employees", "tasks", "residents", "activities", "rooms", "handover"],
  pro: [
    "employees", "tasks", "residents", "activities", "medicine",
    "rooms", "inventory", "handover", "reports",
  ],
  enterprise: MODULE_KEYS,
}

export function normalizePlanCode(value: unknown): PlanCode | null {
  const plan = String(value || "").trim().toLowerCase()
  return PLAN_CODES.includes(plan as PlanCode) ? (plan as PlanCode) : null
}

export function modulesForPlan(value: unknown): readonly ModuleKey[] {
  return PLAN_MODULES[normalizePlanCode(value) || "basic"]
}
