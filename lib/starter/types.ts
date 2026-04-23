export type ResidentStatus = 'active' | 'draft' | 'archived'
export type TaskStatus = 'pending' | 'done' | 'skipped'
export type FrequencyType = 'daily' | 'weekly' | 'selected_weekdays'
export type ScopeType = 'all' | 'assigned_only' | 'own_created'

export type StarterAuthContext = {
  userId: string
  organizationId: string
  role: 'owner' | 'admin' | 'manager' | 'employee'
  scope: ScopeType
  canViewSensitive: boolean
}

export type ResidentRow = {
  id: string
  organization_id: string
  full_name: string
  status: ResidentStatus
  created_by: string | null
  personal_code: string | null
  birth_date: string | null
  phone: string | null
  email: string | null
  address: string | null
  internal_notes: string | null
  created_at: string
  updated_at: string
}

export type ResidentAssignmentRow = {
  id: string
  organization_id: string
  resident_id: string
  employee_user_id: string
  assigned_date: string
  is_primary: boolean
  created_at: string
}

export type RecurringActivityRow = {
  id: string
  organization_id: string
  resident_id: string
  title: string
  description: string | null
  activity_type: string
  frequency_type: FrequencyType
  weekdays: number[] | null
  times_per_day: number
  preferred_time: string | null
  assigned_user_id: string | null
  is_active: boolean
  start_date: string
  end_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CareTaskRow = {
  id: string
  organization_id: string
  resident_id: string
  recurring_activity_id: string | null
  title: string
  description: string | null
  task_date: string
  status: TaskStatus
  assigned_user_id: string | null
  completed_by: string | null
  completed_at: string | null
  completion_note: string | null
  created_at: string
  updated_at: string
}