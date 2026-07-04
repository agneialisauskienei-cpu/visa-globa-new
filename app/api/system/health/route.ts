import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/server/service-auth"

const HEALTH_TIMEOUT_MS = 8000

async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs = HEALTH_TIMEOUT_MS,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error("Supabase health check timed out.")),
      timeoutMs,
    )
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function notifyDatabaseIncident(request: Request, detail: string) {
  try {
    const url = new URL("/api/system/incidents", request.url)

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "database_unavailable",
        source: "system-health",
        path: "/api/system/health",
        detail,
      }),
      cache: "no-store",
    })
  } catch {
    // Incident reporting must never break the health response.
  }
}

export async function GET(request: Request) {
  const checkedAt = new Date().toISOString()

  try {
    const admin = createServiceClient()
    const result = await withTimeout(
      admin.from("profiles").select("id", { count: "exact", head: true }),
    )
    const error =
      result && typeof result === "object" && "error" in result
        ? result.error
        : null

    if (error) {
      await notifyDatabaseIncident(
        request,
        error instanceof Error ? error.message : "Supabase health check failed.",
      )

      return NextResponse.json(
        {
          ok: false,
          checkedAt,
          status: "database_unavailable",
          message:
            "Duomenu baze laikinai nepasiekiama. Administratorius turi patikrinti Supabase projekta.",
        },
        { status: 503 },
      )
    }

    return NextResponse.json({
      ok: true,
      checkedAt,
      status: "ok",
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error"

    await notifyDatabaseIncident(request, detail)

    return NextResponse.json(
      {
        ok: false,
        checkedAt,
        status: "database_unavailable",
        message:
          "Duomenu baze laikinai nepasiekiama. Administratorius turi patikrinti Supabase projekta.",
      },
      { status: 503 },
    )
  }
}
