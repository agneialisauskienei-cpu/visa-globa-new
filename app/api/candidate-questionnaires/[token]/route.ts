import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/server/service-auth"

type Context = {
  params: Promise<{ token: string }>
}

const FORBIDDEN_HINTS = [
  "asmens kod",
  "a.k.",
  "ak ",
  "ak.",
  "paso",
  "id kortel",
  "tapatybės kortel",
  "diagnoz",
  "sveikatos",
  "relig",
  "polit",
  "teistum",
  "šeimyn",
  "vaikų skai",
  "nėšt",
  "lytin",
]

function hasForbiddenData(value: unknown) {
  const text = String(value || "").toLowerCase()
  return FORBIDDEN_HINTS.some((hint) => text.includes(hint))
}

function normalizeToken(value: unknown) {
  if (!value || typeof value !== "string") return ""
  return value.trim().slice(0, 160)
}

function publicCandidateName(candidate: any) {
  const firstName = String(candidate?.first_name || "").trim()
  const lastName = String(candidate?.last_name || "").trim()
  return [firstName, lastName].filter(Boolean).join(" ").trim() || "Kandidate"
}

function isExpired(value: unknown) {
  if (!value || typeof value !== "string") return false
  const expires = new Date(value)
  return Number.isFinite(expires.getTime()) && expires.getTime() < Date.now()
}

async function getQuestionnaire(token: string) {
  const admin = createServiceClient()

  const { data: questionnaire, error } = await admin
    .from("candidate_questionnaires")
    .select(
      "id, organization_id, candidate_id, status, questions, answers, submitted_at, sent_to, public_token_expires_at",
    )
    .eq("public_token", token)
    .maybeSingle()

  if (error) throw error

  let candidate = null

  if (questionnaire?.candidate_id && questionnaire?.organization_id) {
    const { data: candidateData, error: candidateError } = await admin
      .from("candidates")
      .select("id, first_name, last_name, desired_role")
      .eq("id", questionnaire.candidate_id)
      .eq("organization_id", questionnaire.organization_id)
      .maybeSingle()

    if (candidateError) throw candidateError
    candidate = candidateData
  }

  return { admin, row: questionnaire ? ({ ...questionnaire, candidate } as any) : null }
}

export async function GET(_request: Request, context: Context) {
  try {
    const { token: rawToken } = await context.params
    const token = normalizeToken(rawToken)

    if (!token) {
      return NextResponse.json({ error: "Neteisinga anketos nuoroda." }, { status: 400 })
    }

    const { row } = await getQuestionnaire(token)

    if (!row || isExpired(row.public_token_expires_at)) {
      return NextResponse.json({ error: "Anketa nerasta arba nuoroda nebegalioja." }, { status: 404 })
    }

    return NextResponse.json({
      questionnaire: {
        id: row.id,
        status: row.status,
        questions: row.questions || [],
        answers: row.answers || {},
        submitted_at: row.submitted_at,
      },
      candidate: {
        name: publicCandidateName(row.candidate),
        desired_role: row.candidate?.desired_role || null,
      },
    })
  } catch {
    return NextResponse.json({ error: "Nepavyko įkelti anketos." }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { token: rawToken } = await context.params
    const token = normalizeToken(rawToken)

    if (!token) {
      return NextResponse.json({ error: "Neteisinga anketos nuoroda." }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const answers = body?.answers && typeof body.answers === "object" ? body.answers : null

    if (!answers) {
      return NextResponse.json({ error: "Trūksta atsakymų." }, { status: 400 })
    }

    if (Object.values(answers).some(hasForbiddenData)) {
      return NextResponse.json(
        {
          error:
            "Atsakyme gali būti perteklinių arba jautrių asmens duomenų. Nerašykite asmens kodo, dokumentų numerių, diagnozių ar specialių kategorijų duomenų.",
        },
        { status: 400 },
      )
    }

    const { admin, row } = await getQuestionnaire(token)

    if (!row || isExpired(row.public_token_expires_at)) {
      return NextResponse.json({ error: "Anketa nerasta arba nuoroda nebegalioja." }, { status: 404 })
    }

    if (row.submitted_at || row.status === "answered") {
      return NextResponse.json({ ok: true, alreadySubmitted: true })
    }

    const submittedAt = new Date().toISOString()

    const { error: updateError } = await admin
      .from("candidate_questionnaires")
      .update({
        answers,
        status: "answered",
        submitted_at: submittedAt,
      })
      .eq("id", row.id)
      .is("submitted_at", null)

    if (updateError) throw updateError

    if (row.candidate_id && row.organization_id) {
      await admin
        .from("candidates")
        .update({ status: "answered" })
        .eq("id", row.candidate_id)
        .eq("organization_id", row.organization_id)
    }

    return NextResponse.json({ ok: true, submitted_at: submittedAt })
  } catch {
    return NextResponse.json({ error: "Nepavyko pateikti anketos." }, { status: 500 })
  }
}
