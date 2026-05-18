import { ReportFilters } from "./types"

export function readReportFilters(searchParams: URLSearchParams): ReportFilters {
  return {
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    department: searchParams.get("department") || undefined,
    roomId: searchParams.get("roomId") || undefined,
    residentId: searchParams.get("residentId") || undefined,
    employeeId: searchParams.get("employeeId") || undefined,
    status: searchParams.get("status") || undefined,
    riskLevel: searchParams.get("riskLevel") || undefined,
    search: searchParams.get("search") || undefined,
    includeInactive: searchParams.get("includeInactive") === "true",
  }
}

export function filtersToQueryString(filters: ReportFilters) {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return
    params.set(key, String(value))
  })

  return params.toString()
}