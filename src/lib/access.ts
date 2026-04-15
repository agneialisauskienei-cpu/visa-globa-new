export type SystemRole = 'owner' | 'admin' | 'employee'

export type StaffType =
  | 'care_worker'
  | 'nursing_staff'
  | 'kitchen'
  | 'reception'
  | 'administration'

export type MemberAccessProfile = {
  role: SystemRole
  staff_type: StaffType | null
}

export type ResidentAccessContext = {
  residentId: string
  roomHasNursing: boolean
  careLevel: string | null
  isAssignedToCurrentEmployee: boolean
  status: string | null
}

export type EmployeeDirectoryVisibility = 'full' | 'limited' | 'self_only' | 'none'

export function isPrivilegedRole(role: SystemRole | null | undefined) {
  return role === 'owner' || role === 'admin'
}

export function getEmployeeDirectoryVisibility(
  viewer: MemberAccessProfile | null
): EmployeeDirectoryVisibility {
  if (!viewer) return 'none'
  if (isPrivilegedRole(viewer.role)) return 'full'

  switch (viewer.staff_type) {
    case 'administration':
      return 'limited'
    case 'care_worker':
    case 'nursing_staff':
    case 'kitchen':
    case 'reception':
      return 'self_only'
    default:
      return 'none'
  }
}

export function canManageEmployees(viewer: MemberAccessProfile | null) {
  if (!viewer) return false
  return isPrivilegedRole(viewer.role)
}

export function canViewResident(
  viewer: MemberAccessProfile | null,
  ctx: ResidentAccessContext
) {
  if (!viewer) return false

  if (isPrivilegedRole(viewer.role)) return true

  switch (viewer.staff_type) {
    case 'care_worker':
      return ctx.isAssignedToCurrentEmployee

    case 'nursing_staff':
  return true

    case 'kitchen':
      return isOperationalResidentStatus(ctx.status)

    case 'reception':
      return isOperationalResidentStatus(ctx.status)

    default:
      return false
  }
}

export function canViewResidentFullCard(
  viewer: MemberAccessProfile | null,
  ctx: ResidentAccessContext
) {
  if (!viewer) return false

  if (isPrivilegedRole(viewer.role)) return true

  switch (viewer.staff_type) {
    case 'care_worker':
      return ctx.isAssignedToCurrentEmployee

    case 'nursing_staff':
      return ctx.roomHasNursing || isNursingCareLevel(ctx.careLevel)

    case 'kitchen':
      return false

    case 'reception':
      return false

    default:
      return false
  }
}

export function canViewResidentHistory(
  viewer: MemberAccessProfile | null,
  ctx: ResidentAccessContext
) {
  if (!viewer) return false
  if (isPrivilegedRole(viewer.role)) return true

  switch (viewer.staff_type) {
    case 'care_worker':
      return ctx.isAssignedToCurrentEmployee

    case 'nursing_staff':
      return ctx.roomHasNursing || isNursingCareLevel(ctx.careLevel)

    default:
      return false
  }
}

export function getVisibleResidentFields(
  viewer: MemberAccessProfile | null
): string[] {
  if (!viewer) return []

  if (isPrivilegedRole(viewer.role)) {
    return [
      'id',
      'code',
      'first_name',
      'last_name',
      'status',
      'room_id',
      'care_level',
      'notes',
      'created_at',
    ]
  }

  switch (viewer.staff_type) {
    case 'care_worker':
      return [
        'id',
        'code',
        'first_name',
        'status',
        'room_id',
        'care_level',
        'notes',
        'created_at',
      ]

    case 'nursing_staff':
      return [
        'id',
        'code',
        'first_name',
        'status',
        'room_id',
        'care_level',
        'notes',
        'created_at',
      ]

    case 'kitchen':
      return ['id', 'code', 'status', 'room_id', 'created_at']

    case 'reception':
      return ['id', 'code', 'first_name', 'status', 'room_id', 'created_at']

    default:
      return []
  }
}

export function getEmployeeDisplayName(params: {
  viewer: MemberAccessProfile | null
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  email?: string | null
}) {
  const { viewer, firstName, lastName, fullName, email } = params

  if (isPrivilegedRole(viewer?.role)) {
    if (firstName || lastName) {
      return [firstName, lastName].filter(Boolean).join(' ')
    }
    if (fullName) return fullName
    return email || 'Nežinomas darbuotojas'
  }

  if (firstName && lastName) {
    return `${firstName} ${lastName.charAt(0)}.`
  }

  if (firstName) return firstName
  if (fullName) return fullName
  return email || 'Darbuotojas'
}

export function canViewEmployeeMedicalData(viewer: MemberAccessProfile | null) {
  if (!viewer) return false
  return isPrivilegedRole(viewer.role)
}

export function isOccupationalHealthValid(validUntil: string | null) {
  if (!validUntil) return false

  const today = new Date()
  const end = new Date(validUntil)
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  return end >= today
}

export function getOccupationalHealthStatus(validUntil: string | null) {
  if (!validUntil) {
    return {
      label: 'Nenurodyta',
      tone: 'neutral' as const,
    }
  }

  const isValid = isOccupationalHealthValid(validUntil)

  if (!isValid) {
    return {
      label: 'Negalioja',
      tone: 'danger' as const,
    }
  }

  const today = new Date()
  const end = new Date(validUntil)
  const diffDays = Math.ceil(
    (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays <= 30) {
    return {
      label: 'Baigiasi netrukus',
      tone: 'warning' as const,
    }
  }

  return {
    label: 'Galioja',
    tone: 'success' as const,
  }
}

function isNursingCareLevel(careLevel: string | null) {
  if (!careLevel) return false

  return ['slauga', 'intensyvi_slauga', 'paliatyvi_slauga'].includes(careLevel)
}

function isOperationalResidentStatus(status: string | null) {
  if (!status) return false

  return [
    'gyvena',
    'ligonineje',
    'laikinai_isvyke',
    'netrukus_atvyks',
  ].includes(status)
}