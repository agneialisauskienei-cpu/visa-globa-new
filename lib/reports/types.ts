export type ReportType =
  | "residents"
  | "employees"
  | "medicine"
  | "audit"
  | "activities"
  | "tasks"
  | "rooms"
  | "handover"

export type ReportTone = "default" | "success" | "warning" | "danger"

export type ReportFilters = {
  dateFrom?: string
  dateTo?: string
  department?: string
  roomId?: string
  residentId?: string
  employeeId?: string
  status?: string
  riskLevel?: string
  search?: string
  includeInactive?: boolean
}

export type ReportStat = {
  label: string
  value: number | string
  tone?: ReportTone
  description?: string
}

export type ReportPriority = {
  title: string
  description?: string
  tone?: ReportTone
}

export type ReportResponse<T> = {
  stats: ReportStat[]
  rows: T[]
  priorities: ReportPriority[]
}