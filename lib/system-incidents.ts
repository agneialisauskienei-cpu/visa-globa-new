import { getStoredOrganizationId } from "@/lib/current-organization"

type IncidentType =
  | "auth_configuration_unavailable"
  | "auth_service_unavailable"
  | "membership_check_failed"
  | "access_check_failed"
  | "login_unexpected_error"

const THROTTLE_MS = 5 * 60 * 1000

function canUseStorage() {
  return typeof window !== "undefined"
}

function shouldSkipIncident(key: string) {
  if (!canUseStorage()) return false

  try {
    const storageKey = `system_incident:${key}`
    const previous = Number(window.sessionStorage.getItem(storageKey) || 0)
    const now = Date.now()

    if (previous && now - previous < THROTTLE_MS) {
      return true
    }

    window.sessionStorage.setItem(storageKey, String(now))
    return false
  } catch {
    return false
  }
}

export function reportSystemIncident({
  type,
  source,
  path,
}: {
  type: IncidentType
  source: string
  path?: string
}) {
  const safePath =
    path || (typeof window !== "undefined" ? window.location.pathname : "/")
  const key = `${type}:${source}:${safePath}`

  if (shouldSkipIncident(key)) return

  try {
    void fetch("/api/system/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        source,
        path: safePath,
        organizationId: getStoredOrganizationId(),
      }),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Incident reporting must never block the user flow.
  }
}

export function isLoginServiceIncident(message: string) {
  const normalized = message.toLowerCase()

  return (
    normalized.includes("invalid api key") ||
    normalized.includes("apikey") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("fetch")
  )
}
