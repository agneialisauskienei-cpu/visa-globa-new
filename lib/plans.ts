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

const PAGE_MODULE_ROUTES: Array<[string, ModuleKey]> = [
  ["/team", "employees"],
  ["/employees", "employees"],
  ["/invites", "employees"],
  ["/requests", "employees"],
  ["/tasks", "tasks"],
  ["/my-tasks", "tasks"],
  ["/employee-tasks", "tasks"],
  ["/residents", "residents"],
  ["/my-residents", "residents"],
  ["/activities", "activities"],
  ["/medicine", "medicine"],
  ["/medications", "medicine"],
  ["/rooms", "rooms"],
  ["/inventory", "inventory"],
  ["/handover-logs", "handover"],
  ["/reports", "reports"],
  ["/audit", "audit"],
]

const API_MODULE_ROUTES: Array<[string, ModuleKey]> = [
  ["/api/invitations", "employees"],
  ["/api/personnel", "employees"],
  ["/api/employee-substitutions", "employees"],
  ["/api/team/vacation-requests", "employees"],
  ["/api/vacations", "employees"],
  ["/api/care-tasks", "tasks"],
  ["/api/resident-assignments", "residents"],
  ["/api/residents", "residents"],
  ["/api/resident-activities", "activities"],
  ["/api/activity-attendance", "activities"],
  ["/api/activity-sessions", "activities"],
  ["/api/reports", "reports"],
]

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`)
}

export function moduleForPath(pathname: string): ModuleKey | null {
  const routes = pathname.startsWith("/api/")
    ? API_MODULE_ROUTES
    : PAGE_MODULE_ROUTES

  return routes.find(([route]) => matchesRoute(pathname, route))?.[1] || null
}
