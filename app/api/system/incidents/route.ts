import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/server/service-auth"

type IncidentType =
  | "auth_configuration_unavailable"
  | "auth_service_unavailable"
  | "membership_check_failed"
  | "access_check_failed"
  | "login_unexpected_error"

const INCIDENT_LABELS: Record<IncidentType, { title: string; message: string }> = {
  auth_configuration_unavailable: {
    title: "Prisijungimo paslauga nepasiekiama",
    message: "Sistema aptiko prisijungimo konfigūracijos problemą. Patikrinkite Supabase ir Vercel nustatymus.",
  },
  auth_service_unavailable: {
    title: "Prisijungimo serveris neatsako",
    message: "Vartotojui nepavyko prisijungti dėl ryšio su prisijungimo paslauga.",
  },
  membership_check_failed: {
    title: "Nepavyko patikrinti vartotojo teisių",
    message: "Prisijungimas pavyko, bet nepavyko patikrinti organizacijos ar teisių.",
  },
  access_check_failed: {
    title: "Užstrigo prieigos patikra",
    message: "Vartotojui nepavyko patikrinti prieigos prie vidinio puslapio.",
  },
  login_unexpected_error: {
    title: "Prisijungimo klaida",
    message: "Prisijungimo sraute įvyko netikėta klaida.",
  },
}

function normalizeIncidentType(value: unknown): IncidentType | null {
  if (!value || typeof value !== "string") return null

  return Object.prototype.hasOwnProperty.call(INCIDENT_LABELS, value)
    ? (value as IncidentType)
    : null
}

function normalizeUuid(value: unknown) {
  if (!value || typeof value !== "string") return null

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i

  return uuidRegex.test(value) ? value : null
}

function normalizeText(value: unknown, fallback = "unknown") {
  if (!value || typeof value !== "string") return fallback
  return value.slice(0, 160)
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const type = normalizeIncidentType(body?.type)

    if (!type) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const admin = createServiceClient()
    const organizationId = normalizeUuid(body?.organizationId)
    const source = normalizeText(body?.source)
    const path = normalizeText(body?.path, "/")
    const label = INCIDENT_LABELS[type]

    const recipientIds = new Set<string>()

    const { data: superAdmins } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "super_admin")

    for (const profile of superAdmins || []) {
      if (profile.id) recipientIds.add(profile.id)
    }

    if (organizationId) {
      const { data: organizationAdmins } = await admin
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .in("role", ["owner", "admin", "super_admin"])

      for (const member of organizationAdmins || []) {
        if (member.user_id) recipientIds.add(member.user_id)
      }
    }

    const metadata = {
      type,
      source,
      path,
      organization_id: organizationId,
      user_agent: normalizeText(request.headers.get("user-agent"), "unknown"),
    }

    await admin.from("audit_log").insert({
      organization_id: organizationId,
      table_name: "system_incidents",
      record_id: null,
      action: type,
      changed_by: null,
      changes: metadata,
    })

    const notifications = Array.from(recipientIds).map((userId) => ({
      user_id: userId,
      title: label.title,
      message: `${label.message} Vieta: ${path}.`,
      type: "critical",
      is_read: false,
    }))

    if (notifications.length) {
      await admin.from("notifications").insert(notifications)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[system/incidents] failed", error)
    return NextResponse.json({ ok: true })
  }
}
