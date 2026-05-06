"use client"

import { useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Mail, Plus, Copy, Trash2 } from "lucide-react"

type Candidate = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  desired_role: string | null
  status: string | null
  experience: string | null
  created_at: string | null
}

type CandidateQuestion = {
  id: string
  label: string
  required: boolean
  includeInContract: boolean
  category: "contract" | "work" | "availability" | "qualification" | "other"
}

type CandidatesModuleProps = {
  organizationId: string | null | undefined
  candidates?: Candidate[] | null
  onRefresh?: () => void | Promise<void>
}

const DEFAULT_QUESTIONS: CandidateQuestion[] = [
  {
    id: "start_date",
    label: "Nuo kada galėtumėte pradėti dirbti?",
    required: true,
    includeInContract: false,
    category: "work",
  },
  {
    id: "desired_position",
    label: "Į kokias pareigas kandidatuojate?",
    required: true,
    includeInContract: true,
    category: "contract",
  },
  {
    id: "employment_type",
    label: "Kokio darbo krūvio pageidaujate: pilno etato, dalinio etato ar pamaininio darbo?",
    required: true,
    includeInContract: true,
    category: "contract",
  },
  {
    id: "availability",
    label: "Kokiomis savaitės dienomis ir valandomis galite dirbti?",
    required: true,
    includeInContract: false,
    category: "availability",
  },
  {
    id: "night_weekend",
    label: "Ar sutiktumėte dirbti vakarais, savaitgaliais ar švenčių dienomis, jei pareigybė to reikalauja?",
    required: false,
    includeInContract: false,
    category: "availability",
  },
  {
    id: "education",
    label: "Koks Jūsų išsilavinimas ar kvalifikacija, susijusi su šiomis pareigomis?",
    required: false,
    includeInContract: false,
    category: "qualification",
  },
  {
    id: "experience",
    label: "Trumpai aprašykite patirtį, kuri aktuali šioms pareigoms.",
    required: false,
    includeInContract: false,
    category: "qualification",
  },
  {
    id: "certificates",
    label: "Ar turite pareigoms reikalingų pažymų, licencijų ar mokymų? Nurodykite tik dokumento tipą ir galiojimą, be asmens kodo ar dokumento kopijų.",
    required: false,
    includeInContract: false,
    category: "qualification",
  },
  {
    id: "salary_expectation",
    label: "Kokio darbo užmokesčio intervalo tikitės?",
    required: false,
    includeInContract: false,
    category: "work",
  },
  {
    id: "notice_period",
    label: "Jeigu šiuo metu dirbate, koks būtų Jūsų įspėjimo / perėjimo laikotarpis?",
    required: false,
    includeInContract: false,
    category: "work",
  },
]

const FORBIDDEN_HINTS = [
  "asmens kod",
  "a.k.",
  "ak ",
  "ak.",
  "asmens kortel",
  "paso",
  "tapatybės",
  "sveikatos diagnoz",
  "diagnoz",
  "relig",
  "polit",
  "teistum",
  "šeimyn",
  "vaikų skai",
  "nėšt",
  "lytin",
]

function candidateStatusLabel(status?: string | null) {
  switch ((status || "new").toLowerCase()) {
    case "new":
      return "Naujas"
    case "questionnaire_sent":
      return "Klausimynas išsiųstas"
    case "answered":
      return "Atsakyta"
    case "invited":
      return "Pakviestas"
    case "rejected":
      return "Atmestas"
    case "hired":
      return "Priimtas"
    default:
      return status || "Naujas"
  }
}

function hasForbiddenData(text: string) {
  const lower = text.toLowerCase()
  return FORBIDDEN_HINTS.some((hint) => lower.includes(hint))
}

function buildEmailBody(candidateName: string, questions: CandidateQuestion[]) {
  const required = questions.filter((q) => q.required)
  const optional = questions.filter((q) => !q.required)

  return [
    `Sveiki, ${candidateName || ""},`,
    "",
    "Dėkojame už susidomėjimą darbu mūsų organizacijoje.",
    "Kad galėtume įvertinti tinkamumą pareigoms ir paruošti būtiną informaciją tolimesniam atrankos etapui, prašome atsakyti į žemiau pateiktus klausimus.",
    "",
    "Svarbu dėl asmens duomenų:",
    "- Neprašome ir neprašome siųsti asmens kodo.",
    "- Neprašome dokumentų kopijų, paso, ID kortelės ar kitų perteklinių dokumentų.",
    "- Neprašome sveikatos diagnozių, politinių, religinių ar kitų specialių kategorijų duomenų.",
    "- Pateikite tik informaciją, kuri būtina atrankai ir būsimos darbo sutarties paruošimui.",
    "",
    "Privalomi klausimai:",
    ...required.map((q, index) => `${index + 1}. ${q.label}`),
    "",
    "Papildomi klausimai:",
    ...(optional.length ? optional.map((q, index) => `${index + 1}. ${q.label}`) : ["Papildomų klausimų nėra."]),
    "",
    "Atsakydami į šį laišką patvirtinate, kad pateikta informacija yra teisinga ir ją galima naudoti atrankos tikslu.",
    "",
    "Pagarbiai",
  ].join("\n")
}

export default function CandidatesModule({
  organizationId,
  candidates,
  onRefresh,
}: CandidatesModuleProps) {
  const safeCandidates = Array.isArray(candidates) ? candidates : []

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [desiredRole, setDesiredRole] = useState("")
  const [experience, setExperience] = useState("")
  const [consent, setConsent] = useState(false)

  const [questions, setQuestions] = useState<CandidateQuestion[]>(DEFAULT_QUESTIONS)
  const [newQuestion, setNewQuestion] = useState("")
  const [newQuestionRequired, setNewQuestionRequired] = useState(false)
  const [newQuestionContract, setNewQuestionContract] = useState(false)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error" | "warning"
    text: string
    details?: string
  } | null>(null)

  const candidateName = `${firstName} ${lastName}`.trim()
  const selectedQuestions = useMemo(
    () => questions.filter((q) => q.label.trim()),
    [questions],
  )

  const emailBody = useMemo(
    () => buildEmailBody(candidateName || "kandidate", selectedQuestions),
    [candidateName, selectedQuestions],
  )

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent("Klausimai dėl darbo atrankos")
    const body = encodeURIComponent(emailBody)
    return `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`
  }, [email, emailBody])

  function addQuestion() {
    const trimmed = newQuestion.trim()

    if (!trimmed) {
      setMessage({ type: "error", text: "Įrašyk klausimą." })
      return
    }

    if (hasForbiddenData(trimmed)) {
      setMessage({
        type: "error",
        text: "Šis klausimas gali prašyti perteklinių arba jautrių duomenų.",
        details: "Nenaudok asmens kodo, dokumentų kopijų, diagnozių, politinių/religinių ar kitų specialių kategorijų duomenų.",
      })
      return
    }

    setQuestions((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        label: trimmed,
        required: newQuestionRequired,
        includeInContract: newQuestionContract,
        category: newQuestionContract ? "contract" : "other",
      },
    ])

    setNewQuestion("")
    setNewQuestionRequired(false)
    setNewQuestionContract(false)
    setMessage(null)
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((question) => question.id !== id))
  }

  async function copyEmailText() {
    await navigator.clipboard.writeText(emailBody)
    setMessage({ type: "success", text: "Laiško tekstas nukopijuotas." })
  }

  async function saveCandidate(status: "new" | "questionnaire_sent" = "new") {
    setMessage(null)

    if (!organizationId) {
      setMessage({ type: "error", text: "Nenustatyta organizacija." })
      return
    }

    if (!firstName.trim() || !lastName.trim()) {
      setMessage({ type: "error", text: "Įvesk kandidato vardą ir pavardę." })
      return
    }

    if (!email.trim()) {
      setMessage({ type: "error", text: "Įvesk kandidato el. paštą, nes klausimynas siunčiamas paštu." })
      return
    }

    if (!consent) {
      setMessage({
        type: "error",
        text: "Būtinas kandidato sutikimas dėl duomenų tvarkymo atrankos tikslu.",
      })
      return
    }

    if (selectedQuestions.some((q) => hasForbiddenData(q.label))) {
      setMessage({
        type: "error",
        text: "Klausimyne yra draudžiamų / perteklinių duomenų užuominų.",
        details: "Pašalink klausimus apie asmens kodą, dokumentų kopijas, diagnozes ar specialių kategorijų duomenis.",
      })
      return
    }

    setSaving(true)

    try {
      const { data: candidate, error: candidateError } = await supabase
        .from("personnel_candidates")
        .insert({
          organization_id: organizationId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          desired_role: desiredRole.trim() || null,
          experience: experience.trim() || null,
          status,
          consent: true,
        })
        .select("id")
        .single()

      if (candidateError) {
        setMessage({
          type: "error",
          text: "Nepavyko išsaugoti kandidato.",
          details: candidateError.message,
        })
        return
      }

      // Atskirai saugome, kokie klausimai buvo išsiųsti.
      // Taip vėliau galima žinoti, kas buvo prašyta ir ką galima naudoti darbo sutarties paruošimui.
      const { error: questionnaireError } = await supabase
        .from("personnel_candidate_questionnaires")
        .insert({
          organization_id: organizationId,
          candidate_id: candidate.id,
          status: status === "questionnaire_sent" ? "sent" : "draft",
          questions: selectedQuestions,
          email_body: emailBody,
          sent_to: email.trim(),
        })

      if (questionnaireError) {
        setMessage({
          type: "warning",
          text: "Kandidatas išsaugotas, bet klausimyno įrašas neišsaugotas.",
          details: questionnaireError.message,
        })
        await onRefresh?.()
        return
      }

      setMessage({
        type: "success",
        text: status === "questionnaire_sent"
          ? "Kandidatas išsaugotas, klausimyno tekstas paruoštas siuntimui."
          : "Kandidatas išsaugotas.",
      })

      await onRefresh?.()
    } catch (error) {
      setMessage({
        type: "error",
        text: "Klaida saugant kandidatą.",
        details: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setFirstName("")
    setLastName("")
    setEmail("")
    setPhone("")
    setDesiredRole("")
    setExperience("")
    setConsent(false)
    setQuestions(DEFAULT_QUESTIONS)
    setMessage(null)
  }

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            BDAR saugus atrankos klausimynas
          </p>
          <h2 className="mt-1 text-3xl font-black text-slate-950">Kandidatai</h2>
          <p className="mt-2 max-w-4xl text-sm font-semibold text-slate-500">
            Čia paruošiami klausimai, siunčiami kandidatui el. paštu. Sistema neprašo asmens kodo,
            dokumentų kopijų ar perteklinių jautrių duomenų. Atsakymai turi būti naudojami tik atrankai
            ir būtinai informacijai darbo sutarties paruošimui.
          </p>
        </div>

        <button
          type="button"
          onClick={resetForm}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
        >
          Išvalyti formą
        </button>
      </div>

      <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-900">
        Saugumo taisyklė: neklausti asmens kodo, dokumentų kopijų, sveikatos diagnozių,
        šeiminės padėties, vaikų skaičiaus, politinių / religinių pažiūrų ar kitų specialių kategorijų duomenų.
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6">
          <h3 className="text-2xl font-black text-slate-950">Kandidato duomenys</h3>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Įvesk tik būtinus atrankos kontaktinius duomenis.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-black text-slate-600">Vardas</span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Vardas"
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-black text-slate-600">Pavardė</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Pavardė"
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-black text-slate-600">El. paštas</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="vardas@pastas.lt"
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-black text-slate-600">Telefonas</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+370..."
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-black text-slate-600">Norimos pareigos</span>
              <input
                value={desiredRole}
                onChange={(event) => setDesiredRole(event.target.value)}
                placeholder="Pvz. slaugytojo padėjėjas, administratorius"
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-black text-slate-600">Trumpa aktuali patirtis</span>
              <textarea
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
                placeholder="Tik su pareigomis susijusi patirtis. Nerašyti perteklinių asmens duomenų."
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            <span className="text-sm font-black leading-6 text-slate-700">
              Kandidatas sutiko, kad jo pateikti duomenys būtų tvarkomi atrankos tikslu.
            </span>
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveCandidate("new")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <Plus size={16} />
              Išsaugoti kandidatą
            </button>

            <a
              href={email ? mailtoHref : undefined}
              onClick={(event) => {
                if (!email) {
                  event.preventDefault()
                  setMessage({ type: "error", text: "Įvesk kandidato el. paštą prieš siunčiant klausimyną." })
                  return
                }
                void saveCandidate("questionnaire_sent")
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
            >
              <Mail size={16} />
              Siųsti klausimyną el. paštu
            </a>

            <button
              type="button"
              onClick={() => void copyEmailText()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              <Copy size={16} />
              Kopijuoti laišką
            </button>
          </div>

          {message ? (
            <div
              className={[
                "mt-4 rounded-2xl border px-4 py-3 text-sm font-bold",
                message.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : message.type === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-red-200 bg-red-50 text-red-800",
              ].join(" ")}
            >
              <div>{message.text}</div>
              {message.details ? (
                <div className="mt-1 break-words text-xs font-semibold opacity-80">
                  {message.details}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6">
          <h3 className="text-2xl font-black text-slate-950">Klausimynas kandidatui</h3>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Šabloną galima papildyti savo klausimais, bet sistema blokuoja akivaizdžiai perteklinius klausimus.
          </p>

          <div className="mt-5 space-y-3">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-slate-600">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900">{question.label}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {question.required ? (
                      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                        Privalomas
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        Neprivalomas
                      </span>
                    )}
                    {question.includeInContract ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                        Gali būti naudojama sutarčiai
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeQuestion(question.id)}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                  aria-label="Pašalinti klausimą"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-600">
              Pridėti savo klausimą
            </h4>
            <textarea
              value={newQuestion}
              onChange={(event) => setNewQuestion(event.target.value)}
              placeholder="Įrašykite klausimą. Neklauskite asmens kodo, dokumentų kopijų ar jautrių duomenų."
              rows={3}
              className="mt-3 w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={newQuestionRequired}
                  onChange={(event) => setNewQuestionRequired(event.target.checked)}
                />
                Privalomas
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={newQuestionContract}
                  onChange={(event) => setNewQuestionContract(event.target.checked)}
                />
                Galima naudoti darbo sutarčiai
              </label>
              <button
                type="button"
                onClick={addQuestion}
                className="ml-auto inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
              >
                <Plus size={16} />
                Pridėti klausimą
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-600">
              Laiško peržiūra
            </h4>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs font-semibold leading-5 text-slate-100">
              {emailBody}
            </pre>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6">
        <h3 className="text-2xl font-black text-slate-950">Kandidatų sąrašas</h3>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-black">Kandidatas</th>
                <th className="px-4 py-3 font-black">Kontaktai</th>
                <th className="px-4 py-3 font-black">Pareigos</th>
                <th className="px-4 py-3 font-black">Būsena</th>
                <th className="px-4 py-3 font-black">Patirtis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {safeCandidates.length ? (
                safeCandidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {candidate.first_name} {candidate.last_name}
                    </td>
                    <td className="px-4 py-3">
                      {candidate.email || "—"} / {candidate.phone || "—"}
                    </td>
                    <td className="px-4 py-3">{candidate.desired_role || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                        {candidateStatusLabel(candidate.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{candidate.experience || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center font-bold text-slate-500">
                    Kandidatų dar nėra.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
