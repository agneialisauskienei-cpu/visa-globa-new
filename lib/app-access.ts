import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/current-organization"

export type MembershipRole =
  | "super_admin"
  | "owner"
  | "admin"
  | "employee"

export type StaffType =
  | "care_worker"
  | "nursing_staff"
  | "nurse"
  | "doctor"
  | "medic"
  | "social_worker"
  | "activity_specialist"
  | "occupational_therapist"
  | "maintenance"
  | "ukis"
  | "ūkis"
  | "kitchen"
  | "reception"
  | "administration"
  | string
  | null

export type Permission =
  | "dashboard.view"
  | "employees.view"
  | "employees.manage"
  | "residents.view_basic"
  | "activities.manage"
  | "tasks.view"
  | "tasks.create"
  | "tasks.manage"
  | "schedule.view"
  | "notifications.view"
  | "medicine.view"
  | "handover.view"
  | "handover.create"
  | "rooms.view"
  | "inventory.view"
  | "reports.view"
  | "audit.view"
  | "settings.manage"
  | "system.super"

export type CurrentAccess = {
  role: MembershipRole | null
  staffType?: StaffType
  position?: string | null
  extraPermissions?: Permission[]
  organizationId: string | null
  permissions: Permission[]
  substitutionPermissions?: Permission[]
  substitutedForUserIds?: string[]
  email?: string | null
}

const MEDICAL_STAFF_TYPES = [
  "nursing_staff",
  "nurse",
  "doctor",
  "medic",
  "slaugytojas",
  "slaugytoja",
  "medikas",
  "gydytojas",
  "gydytoja",
]

const SOCIAL_STAFF_TYPES = [
  "social_worker",
  "socialinis_darbuotojas",
  "socialine_darbuotoja",
  "socialinė_darbuotoja",
]

const ACTIVITY_SPECIALIST_STAFF_TYPES = [
  "activity_specialist",
  "occupational_therapist",
  "uzimtumo_specialistas",
  "užimtumo_specialistas",
  "uzimtumo_specialiste",
  "užimtumo_specialistė",
]

const MAINTENANCE_STAFF_TYPES = [
  "maintenance",
  "ukis",
  "ūkis",
  "technician",
  "techninis",
  "ukio_darbuotojas",
  "ūkio_darbuotojas",
]

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "employees.view",
  "employees.manage",
  "residents.view_basic",
  "activities.manage",
  "tasks.view",
  "tasks.create",
  "tasks.manage",
  "schedule.view",
  "notifications.view",
  "medicine.view",
  "handover.view",
  "handover.create",
  "rooms.view",
  "inventory.view",
  "reports.view",
  "audit.view",
  "settings.manage",
  "system.super",
]

const ROLE_PERMISSIONS: Record<MembershipRole, Permission[]> = {
  super_admin: [
    "system.super",
    "settings.manage",
  ],

  owner: [
    "dashboard.view",
    "employees.view",
    "employees.manage",
    "residents.view_basic",
    "activities.manage",
    "tasks.view",
    "tasks.create",
    "tasks.manage",
    "schedule.view",
    "notifications.view",
    "medicine.view",
    "handover.view",
    "handover.create",
    "rooms.view",
    "inventory.view",
    "reports.view",
    "audit.view",
    "settings.manage",
  ],

  admin: [
    "dashboard.view",
    "employees.view",
    "employees.manage",
    "residents.view_basic",
    "activities.manage",
    "tasks.view",
    "tasks.create",
    "tasks.manage",
    "schedule.view",
    "notifications.view",
    "medicine.view",
    "handover.view",
    "handover.create",
    "rooms.view",
    "inventory.view",
    "reports.view",
    "audit.view",
    "settings.manage",
  ],

  employee: [
    "dashboard.view",
    "tasks.view",
    "tasks.create",
    "schedule.view",
    "notifications.view",
  ],
}

function normalizedStaffType(staffType?: StaffType) {
  return String(staffType || "").trim().toLowerCase()
}

export function isMedicalStaff(staffType?: StaffType) {
  return MEDICAL_STAFF_TYPES.includes(normalizedStaffType(staffType))
}

export function isSocialStaff(staffType?: StaffType) {
  return SOCIAL_STAFF_TYPES.includes(normalizedStaffType(staffType))
}

export function isActivitySpecialist(staffType?: StaffType) {
  return ACTIVITY_SPECIALIST_STAFF_TYPES.includes(normalizedStaffType(staffType))
}

export function isMaintenanceStaff(staffType?: StaffType) {
  return MAINTENANCE_STAFF_TYPES.includes(normalizedStaffType(staffType))
}

function normalizeExtraPermissions(value: unknown): Permission[] {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.filter((item): item is Permission =>
      ALL_PERMISSIONS.includes(item as Permission)
    )
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)

      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is Permission =>
          ALL_PERMISSIONS.includes(item as Permission)
        )
      }
    } catch {
      return []
    }
  }

  return []
}

function buildPermissions(
  role: MembershipRole,
  staffType?: StaffType,
  extraPermissions?: Permission[]
) {
  const permissions = new Set<Permission>(ROLE_PERMISSIONS[role])

  if (role === "employee") {
    if (isMedicalStaff(staffType)) {
      permissions.add("residents.view_basic")
      permissions.add("medicine.view")
      permissions.add("handover.view")
      permissions.add("handover.create")
    }

    if (isSocialStaff(staffType)) {
      permissions.add("residents.view_basic")
      permissions.add("handover.view")
      permissions.add("handover.create")
    }

    if (isActivitySpecialist(staffType)) {
      permissions.add("residents.view_basic")
      permissions.add("activities.manage")
    }

    if (isMaintenanceStaff(staffType)) {
      permissions.add("rooms.view")
      permissions.add("inventory.view")
    }
  }

  for (const permission of extraPermissions || []) {
    if (permission !== "system.super") {
      permissions.add(permission)
    }
  }

  return Array.from(permissions)
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10)
}

async function getActiveSubstitutionPermissions(input: {
  organizationId?: string | null
  substituteUserId: string
}) {
  if (!input.organizationId) {
    return {
      permissions: [] as Permission[],
      substitutedForUserIds: [] as string[],
    }
  }

  const today = todayDateString()

  const { data: substitutions } = await supabase
    .from("employee_substitutions")
    .select("absent_user_id")
    .eq("organization_id", input.organizationId)
    .eq("substitute_user_id", input.substituteUserId)
    .eq("status", "active")
    .lte("starts_on", today)
    .gte("ends_on", today)

  const absentUserIds = Array.from(
    new Set(
      ((substitutions || []) as Array<{ absent_user_id?: string | null }>)
        .map((row) => row.absent_user_id)
        .filter((value): value is string => Boolean(value)),
    ),
  )

  if (absentUserIds.length === 0) {
    return {
      permissions: [] as Permission[],
      substitutedForUserIds: [] as string[],
    }
  }

  const { data: absentMemberships } = await supabase
    .from("organization_members")
    .select("user_id, role, staff_type, extra_permissions")
    .eq("organization_id", input.organizationId)
    .in("user_id", absentUserIds)
    .eq("is_active", true)

  const permissions = new Set<Permission>()
  const substitutedForUserIds: string[] = []

  for (const membership of (absentMemberships || []) as Array<{
    user_id?: string | null
    role?: MembershipRole | null
    staff_type?: StaffType
    extra_permissions?: unknown
  }>) {
    const role = membership.role || "employee"
    const inheritedPermissions = buildPermissions(
      role === "super_admin" ? "employee" : role,
      membership.staff_type,
      normalizeExtraPermissions(membership.extra_permissions),
    )

    for (const permission of inheritedPermissions) {
      if (permission !== "system.super") {
        permissions.add(permission)
      }
    }

    if (membership.user_id) {
      substitutedForUserIds.push(membership.user_id)
    }
  }

  return {
    permissions: Array.from(permissions),
    substitutedForUserIds,
  }
}

export function hasPermission(
  access: CurrentAccess | null,
  permission: Permission
) {
  if (!access) return false

  if (access.role === "super_admin") {
    return permission === "system.super" || permission === "settings.manage"
  }

  return access.permissions.includes(permission)
}

export function roleLabel(role?: MembershipRole | null) {
  if (role === "super_admin") return "Super administratorius"
  if (role === "owner") return "Savininkas"
  if (role === "admin") return "Administratorius"

  return "Darbuotojas"
}

export function staffTypeLabel(staffType?: StaffType) {
  if (isMedicalStaff(staffType)) return "Medikas"
  if (isSocialStaff(staffType)) return "Socialinis darbuotojas"
  if (isActivitySpecialist(staffType)) return "Užimtumo specialistas"
  if (isMaintenanceStaff(staffType)) return "Ūkis"

  return "Darbuotojas"
}

export async function getCurrentAccess(): Promise<CurrentAccess> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const user = session?.user

  if (!user) {
    return {
      role: null,
      staffType: null,
      position: null,
      extraPermissions: [],
      organizationId: null,
      permissions: [],
      substitutionPermissions: [],
      substitutedForUserIds: [],
    }
  }

  const email = user.email ?? null

  // SUPER ADMIN
  if (email === "admin@visagloba.lt") {
    return {
      role: "super_admin",
      staffType: null,
      position: null,
      extraPermissions: [],
      organizationId: null,
      permissions: ROLE_PERMISSIONS.super_admin,
      substitutionPermissions: [],
      substitutedForUserIds: [],
      email,
    }
  }

  // ORGANIZATION MEMBER
  const activeOrganizationId = await getCurrentOrganizationId()

  if (!activeOrganizationId) {
    return {
      role: null,
      staffType: null,
      position: null,
      extraPermissions: [],
      organizationId: null,
      permissions: [],
      substitutionPermissions: [],
      substitutedForUserIds: [],
      email,
    }
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, organization_id, staff_type, position, extra_permissions")
    .eq("user_id", user.id)
    .eq("organization_id", activeOrganizationId)
    .eq("is_active", true)
    .maybeSingle()

  if (!membership) {
    return {
      role: null,
      staffType: null,
      position: null,
      extraPermissions: [],
      organizationId: null,
      permissions: [],
      substitutionPermissions: [],
      substitutedForUserIds: [],
      email,
    }
  }

  const role = (membership.role as MembershipRole) ?? "employee"
  const staffType = (membership?.staff_type as StaffType) ?? null
  const extraPermissions = normalizeExtraPermissions(
    (membership as any)?.extra_permissions
  )
  const basePermissions = buildPermissions(role, staffType, extraPermissions)
  const substitution = await getActiveSubstitutionPermissions({
    organizationId: membership?.organization_id ?? null,
    substituteUserId: user.id,
  })

  return {
    role,
    staffType,
    position: (membership as any)?.position ?? null,
    extraPermissions,
    organizationId: membership?.organization_id ?? null,
    permissions: Array.from(
      new Set([...basePermissions, ...substitution.permissions]),
    ),
    substitutionPermissions: substitution.permissions,
    substitutedForUserIds: substitution.substitutedForUserIds,
    email,
  }
}
