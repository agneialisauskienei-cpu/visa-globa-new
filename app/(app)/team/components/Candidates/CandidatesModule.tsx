"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Download, ExternalLink, FileText, Link2, Mail, Plus, Send, Trash2, UserPlus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getChangedFields, logAudit } from "@/lib/audit";

type Candidate = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  desired_role: string | null;
  status: string | null;
  experience: string | null;
  created_at: string | null;
};

type CandidateQuestion = {
  id: string;
  label: string;
  required: boolean;
  includeInContract: boolean;
  category: "contract" | "work" | "availability" | "qualification" | "other";
};

type CandidateQuestionnaire = {
  candidate_id: string | null;
  status: string | null;
  questions?: CandidateQuestion[] | null;
  answers?: Record<string, string> | null;
  submitted_at?: string | null;
  sent_to?: string | null;
};

type CandidatesModuleProps = {
  organizationId: string | null | undefined;
  candidates?: Candidate[] | null;
  onRefresh?: () => void | Promise<void>;
};

const DEFAULT_QUESTIONS: CandidateQuestion[] = [
  {
    id: "start_date",
    label: "Kokia pageidaujama darbo pradžios data?",
    required: true,
    includeInContract: false,
    category: "work",
  },
  {
    id: "desired_position",
    label: "Patvirtinkite pareigas, į kurias prašote priimti.",
    required: true,
    includeInContract: true,
    category: "contract",
  },
  {
    id: "employment_type",
    label:
      "Kokia sutarties rūšis ir darbo krūvis sutarti: neterminuota ar terminuota, visas ar ne visas darbo laikas?",
    required: true,
    includeInContract: true,
    category: "contract",
  },
  {
    id: "salary_payment_frequency",
    label: "Kaip pageidaujate gauti darbo užmokestį: vieną ar du kartus per mėnesį?",
    required: true,
    includeInContract: true,
    category: "contract",
  },
  {
    id: "npd",
    label:
      "Ar pageidaujate, kad šioje darbovietėje būtų taikomas neapmokestinamasis pajamų dydis (NPD)?",
    required: true,
    includeInContract: true,
    category: "contract",
  },
  {
    id: "bank_details_delivery",
    label: "Nurodykite, kaip saugiai pateiksite banko sąskaitos duomenis atsakingam darbuotojui.",
    required: false,
    includeInContract: false,
    category: "other",
  },
  {
    id: "documents",
    label: "Kokius pareigoms reikalingus išsilavinimo, kvalifikacijos ar licencijų dokumentus pateiksite?",
    required: false,
    includeInContract: false,
    category: "qualification",
  },
  {
    id: "work_schedule",
    label:
      "Patvirtinkite sutartą darbo laiko normą, pamainas ir ar numatytas darbas naktimis, savaitgaliais ar švenčių dienomis.",
    required: false,
    includeInContract: true,
    category: "work",
  },
  {
    id: "probation",
    label: "Ar buvo sutartas išbandymo laikotarpis?",
    required: false,
    includeInContract: true,
    category: "contract",
  },
  {
    id: "additional_conditions",
    label: "Nurodykite kitas sutartas darbo sąlygas ar informaciją, svarbią priėmimui.",
    required: false,
    includeInContract: false,
    category: "work",
  },
];

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
];

function candidateStatusLabel(status?: string | null) {
  switch ((status || "new").toLowerCase()) {
    case "new":
      return "Naujas";
    case "questionnaire_sent":
      return "Klausimynas išsiųstas";
    case "answered":
      return "Atsakyta";
    case "invited":
      return "Pakviestas";
    case "rejected":
      return "Atmestas";
    case "hired":
      return "Priimtas";
    default:
      return status || "Naujas";
  }
}

function hasForbiddenData(text: string) {
  const lower = text.toLowerCase();
  return FORBIDDEN_HINTS.some((hint) => lower.includes(hint));
}

function getAppOrigin() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function buildQuestionnaireLink(candidateId?: string | null) {
  const origin = getAppOrigin();
  const token = candidateId || "sukurta-issaugojus-kandidata";
  return `${origin}/candidate-questionnaire/${token}`;
}

function buildShortEmailBody(candidateName: string, questionnaireLink: string) {
  return [
    `Sveiki, ${candidateName || ""},`,
    "",
    "Kviečiame nuotoliniu būdu užpildyti prašymą priimti į darbą ir pateikti darbo sutarties paruošimui reikalingą informaciją:",
    "",
    questionnaireLink,
    "",
    "Prašymo pildymas užtruks apie 5–10 min.",
    "",
    "Svarbu dėl asmens duomenų:",
    "- Neprašome asmens kodo.",
    "- Neprašome dokumentų kopijų, paso, ID kortelės ar kitų perteklinių dokumentų.",
    "- Neprašome sveikatos diagnozių, politinių, religinių ar kitų specialių kategorijų duomenų.",
    "- Pateikite tik informaciją, kuri būtina darbo sutarties paruošimui.",
    "",
    "Pagarbiai",
  ].join("\n");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Nenurodyta";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("lt-LT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function questionnaireAnswerRows(questionnaire?: CandidateQuestionnaire | null) {
  const questions = Array.isArray(questionnaire?.questions)
    ? questionnaire?.questions || []
    : [];
  const answers = questionnaire?.answers || {};

  return questions.map((question) => ({
    id: question.id,
    label: question.label,
    required: question.required,
    answer: String(answers[question.id] || "").trim() || "Neatsakyta",
  }));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function questionnaireAnswerValue(
  questionnaire: CandidateQuestionnaire | null | undefined,
  key: string,
) {
  const raw = questionnaire?.answers?.[key];
  if (typeof raw !== "string") return "";
  return raw.trim();
}

function buildQuestionnaireDocumentHtml(
  candidate: Candidate,
  questionnaire?: CandidateQuestionnaire | null,
) {
  const fullName = `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim() || "Kandidatas";
  const contactLine = [candidate.email || "", candidate.phone || ""].filter(Boolean).join(" | ") || "Kontaktai nenurodyti";
  const desiredPosition =
    questionnaireAnswerValue(questionnaire, "desired_position") ||
    candidate.desired_role ||
    "Nenurodyta";
  const startDate =
    questionnaireAnswerValue(questionnaire, "start_date") || "Nenurodyta";
  const employmentType =
    questionnaireAnswerValue(questionnaire, "employment_type") ||
    "Nenurodyta";
  const salaryFrequency =
    questionnaireAnswerValue(questionnaire, "salary_payment_frequency") ||
    "Nenurodyta";
  const npd = questionnaireAnswerValue(questionnaire, "npd") || "Nenurodyta";
  const workSchedule =
    questionnaireAnswerValue(questionnaire, "work_schedule") || "Nenurodyta";
  const probation =
    questionnaireAnswerValue(questionnaire, "probation") || "Nenurodyta";
  const documents =
    questionnaireAnswerValue(questionnaire, "documents") || "Nenurodyta";
  const bankDetails =
    questionnaireAnswerValue(questionnaire, "bank_details_delivery") ||
    "Nenurodyta";
  const additionalConditions =
    questionnaireAnswerValue(questionnaire, "additional_conditions") ||
    "Nenurodyta";
  const submittedAt = formatDateTime(questionnaire?.submitted_at);
  const submittedDate =
    questionnaire?.submitted_at && !Number.isNaN(new Date(questionnaire.submitted_at).getTime())
      ? new Intl.DateTimeFormat("lt-LT", { year: "numeric", month: "2-digit", day: "2-digit" }).format(
          new Date(questionnaire.submitted_at),
        )
      : "______________";

  const extraRows = questionnaireAnswerRows(questionnaire).filter(
    (row) =>
      ![
        "start_date",
        "desired_position",
        "employment_type",
        "salary_payment_frequency",
        "npd",
        "work_schedule",
        "probation",
        "documents",
        "bank_details_delivery",
        "additional_conditions",
      ].includes(row.id),
  );

  return `<!DOCTYPE html>
<html lang="lt">
  <head>
    <meta charset="utf-8" />
    <title>Priemimo prasymas</title>
    <style>
      @page { size: A4; margin: 24mm 18mm 20mm 24mm; }
      body {
        margin: 0;
        color: #111111;
        font-family: "Times New Roman", Times, serif;
        font-size: 12pt;
        line-height: 1.35;
      }
      .page { width: 100%; }
      .approval {
        margin-left: auto;
        width: 280px;
        text-align: left;
      }
      .center { text-align: center; }
      .spacer-lg { height: 24px; }
      .spacer-md { height: 14px; }
      .line {
        margin: 0 auto;
        width: 56%;
        border-bottom: 1px solid #111111;
        height: 18px;
      }
      .line-wide {
        margin: 0 auto;
        width: 70%;
        border-bottom: 1px solid #111111;
        height: 18px;
      }
      .hint {
        font-size: 9pt;
        text-align: center;
      }
      .request-title {
        margin: 24px 0 12px;
        font-size: 16pt;
        font-weight: 700;
        text-align: center;
      }
      .request-meta {
        display: flex;
        justify-content: center;
        gap: 28px;
        margin-bottom: 14px;
      }
      .request-meta span {
        display: inline-block;
        min-width: 180px;
        border-bottom: 1px solid #111111;
        text-align: center;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 18px;
      }
      th, td {
        border: 1px solid #111111;
        padding: 8px 10px;
        vertical-align: top;
      }
      th {
        font-weight: 700;
        text-align: left;
      }
      .label {
        width: 34%;
        font-weight: 700;
      }
      .footnote {
        margin-top: 16px;
        font-size: 10pt;
      }
      .signature-row {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        margin-top: 28px;
      }
      .signature {
        flex: 1;
        text-align: center;
      }
      .signature .rule {
        border-bottom: 1px solid #111111;
        height: 18px;
        margin-bottom: 4px;
      }
      .muted {
        color: #444444;
        font-size: 10pt;
      }
      ul {
        margin: 8px 0 0 18px;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="approval">
        <div>PATVIRTINTA</div>
        <div>Nacionalinio bendrųjų funkcijų centro</div>
        <div>direktoriaus</div>
        <div>2022 m. vasario 17 d. įsakymu Nr. V-78</div>
        <div>(2024 m. kovo 25 d. įsakymo Nr. V-98 redakcija)</div>
      </div>

      <div class="spacer-lg"></div>
      <div class="center"><strong>(Prašymo priimti į darbą forma)</strong></div>

      <div class="spacer-lg"></div>
      <div class="line-wide"></div>
      <div class="hint">${escapeHtml(fullName)}</div>
      <div class="line-wide"></div>
      <div class="hint">${escapeHtml(contactLine)}</div>

      <div class="spacer-md"></div>
      <div style="width: 240px; border-bottom: 1px solid #111111;"></div>

      <div class="request-title">PRAŠYMAS PRIIMTI Į DARBĄ</div>
      <div class="request-meta">
        <span>${escapeHtml(submittedDate)}</span>
        <span>Nr. __________</span>
      </div>

      <table>
        <tr>
          <td class="label">Pareiškėjas</td>
          <td>${escapeHtml(fullName)}</td>
        </tr>
        <tr>
          <td class="label">Kontaktai</td>
          <td>${escapeHtml(contactLine)}</td>
        </tr>
        <tr>
          <td class="label">Pageidaujama darbo pradžios data</td>
          <td>${escapeHtml(startDate)}</td>
        </tr>
        <tr>
          <td class="label">Pareigos, į kurias prašoma priimti</td>
          <td>${escapeHtml(desiredPosition)}</td>
        </tr>
        <tr>
          <td class="label">Darbo sutarties rūšis ir darbo krūvis</td>
          <td>${escapeHtml(employmentType)}</td>
        </tr>
        <tr>
          <td class="label">Darbo užmokesčio išmokėjimo būdas</td>
          <td>${escapeHtml(salaryFrequency)}</td>
        </tr>
        <tr>
          <td class="label">NPD taikymas</td>
          <td>${escapeHtml(npd)}</td>
        </tr>
        <tr>
          <td class="label">Darbo grafikas / pamainos</td>
          <td>${escapeHtml(workSchedule)}</td>
        </tr>
        <tr>
          <td class="label">Išbandymo laikotarpis</td>
          <td>${escapeHtml(probation)}</td>
        </tr>
        <tr>
          <td class="label">Pateikiami kvalifikacijos dokumentai</td>
          <td>${escapeHtml(documents)}</td>
        </tr>
        <tr>
          <td class="label">Banko duomenų pateikimo būdas</td>
          <td>${escapeHtml(bankDetails)}</td>
        </tr>
        <tr>
          <td class="label">Papildomos sąlygos ar informacija</td>
          <td>${escapeHtml(additionalConditions)}</td>
        </tr>
        <tr>
          <td class="label">Anketa pateikta</td>
          <td>${escapeHtml(submittedAt)}</td>
        </tr>
      </table>

      ${
        extraRows.length
          ? `<div class="footnote"><strong>Papildomi atsakymai</strong><ul>${extraRows
              .map(
                (row) =>
                  `<li><strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.answer)}</li>`,
              )
              .join("")}</ul></div>`
          : ""
      }

      <div class="signature-row">
        <div class="signature">
          <div class="rule"></div>
          <div class="muted">pareigos</div>
        </div>
        <div class="signature">
          <div class="rule"></div>
          <div class="muted">parašas</div>
        </div>
        <div class="signature">
          <div class="rule"></div>
          <div class="muted">${escapeHtml(fullName)}</div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function buildQuestionnaireSummary(
  candidate: Candidate,
  questionnaire?: CandidateQuestionnaire | null,
) {
  const rows = questionnaireAnswerRows(questionnaire);

  return [
    `Priemimo prasymo atsakymai`,
    `Darbuotojas: ${candidate.first_name} ${candidate.last_name}`.trim(),
    `El. pastas: ${candidate.email || "Nenurodytas"}`,
    `Telefonas: ${candidate.phone || "Nenurodytas"}`,
    `Pareigos: ${candidate.desired_role || "Nenurodytos"}`,
    `Atsakyta: ${formatDateTime(questionnaire?.submitted_at)}`,
    "",
    ...rows.map((row, index) => `${index + 1}. ${row.label}\n${row.answer}`),
  ].join("\n\n");
}

function errorText(error: unknown) {
  if (!error) return "Nežinoma klaida.";
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    return [
      e.message ? `message: ${String(e.message)}` : "",
      e.details ? `details: ${String(e.details)}` : "",
      e.hint ? `hint: ${String(e.hint)}` : "",
      e.code ? `code: ${String(e.code)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return String(error);
}

function createInviteToken() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function CandidatesModule({
  organizationId,
  candidates,
  onRefresh,
}: CandidatesModuleProps) {
  const safeCandidates = Array.isArray(candidates) ? candidates : [];

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [desiredRole, setDesiredRole] = useState("");
  const [experience, setExperience] = useState("");
  const [consent, setConsent] = useState(false);

  const [questions, setQuestions] = useState<CandidateQuestion[]>(DEFAULT_QUESTIONS);
  const [newQuestion, setNewQuestion] = useState("");
  const [newQuestionRequired, setNewQuestionRequired] = useState(false);
  const [newQuestionContract, setNewQuestionContract] = useState(false);
  const [questionnairesByCandidateId, setQuestionnairesByCandidateId] =
    useState<Record<string, CandidateQuestionnaire>>({});
  const [previewCandidateId, setPreviewCandidateId] = useState<string | null>(
    null,
  );

  const [saving, setSaving] = useState(false);
  const [acceptingCandidateId, setAcceptingCandidateId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
    details?: string;
  } | null>(null);

  const candidateName = `${firstName} ${lastName}`.trim();
  const selectedQuestions = useMemo(
    () => questions.filter((q) => q.label.trim()),
    [questions],
  );

  const questionnairePreviewLink = useMemo(() => buildQuestionnaireLink(), []);

  const emailBody = useMemo(
    () => buildShortEmailBody(candidateName || "kandidate", questionnairePreviewLink),
    [candidateName, questionnairePreviewLink],
  );

  const previewCandidate = useMemo(
    () =>
      previewCandidateId
        ? safeCandidates.find((candidate) => candidate.id === previewCandidateId) ||
          null
        : null,
    [previewCandidateId, safeCandidates],
  );

  const previewQuestionnaire = previewCandidateId
    ? questionnairesByCandidateId[previewCandidateId] || null
    : null;

  useEffect(() => {
    if (!organizationId) return;

    let active = true;

    async function loadQuestionnaires() {
      const { data, error } = await supabase
        .from("candidate_questionnaires")
        .select(
          "candidate_id, status, questions, answers, submitted_at, sent_to",
        )
        .eq("organization_id", organizationId);

      if (error || !active) return;

      const nextMap = ((data as CandidateQuestionnaire[] | null) || []).reduce<
        Record<string, CandidateQuestionnaire>
      >((acc, row) => {
        if (row.candidate_id) acc[row.candidate_id] = row;
        return acc;
      }, {});

      setQuestionnairesByCandidateId(nextMap);
    }

    void loadQuestionnaires();

    return () => {
      active = false;
    };
  }, [organizationId, safeCandidates.length]);

  function addQuestion() {
    const trimmed = newQuestion.trim();

    if (!trimmed) {
      setMessage({ type: "error", text: "Įrašyk klausimą." });
      return;
    }

    if (hasForbiddenData(trimmed)) {
      setMessage({
        type: "error",
        text: "Šis klausimas gali prašyti perteklinių arba jautrių duomenų.",
        details:
          "Nenaudok asmens kodo, dokumentų kopijų, diagnozių, politinių/religinių ar kitų specialių kategorijų duomenų.",
      });
      return;
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
    ]);

    setNewQuestion("");
    setNewQuestionRequired(false);
    setNewQuestionContract(false);
    setMessage(null);
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((question) => question.id !== id));
  }

  function updateQuestion(
    id: string,
    changes: Partial<Pick<CandidateQuestion, "label" | "required" | "includeInContract">>,
  ) {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === id ? { ...question, ...changes } : question,
      ),
    );
  }

  async function copyEmailText(candidateId?: string | null) {
    const questionnaireLink = buildQuestionnaireLink(candidateId);
    const body = buildShortEmailBody(candidateName || "kandidate", questionnaireLink);
    await navigator.clipboard.writeText(body);
    setMessage({ type: "success", text: "Trumpo laiško tekstas su anketos nuoroda nukopijuotas." });
  }

  async function copyQuestionnaireLink(candidateId?: string | null) {
    await navigator.clipboard.writeText(buildQuestionnaireLink(candidateId));
    setMessage({ type: "success", text: "Anketos nuoroda nukopijuota." });
  }

  async function copyQuestionnaireSummary(candidate: Candidate) {
    const text = buildQuestionnaireSummary(
      candidate,
      questionnairesByCandidateId[candidate.id] || null,
    );
    await navigator.clipboard.writeText(text);
    setMessage({
      type: "success",
      text: "Atsakymų santrauka nukopijuota.",
    });
  }

function downloadQuestionnaireSummary(candidate: Candidate) {
    const questionnaire = questionnairesByCandidateId[candidate.id] || null;
    const html = buildQuestionnaireDocumentHtml(
      candidate,
      questionnaire,
    );
    const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `priemimo-prasymas-${candidate.first_name || "kandidatas"}-${candidate.last_name || candidate.id}.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function forwardQuestionnaireToAccounting(candidate: Candidate) {
    const subject = encodeURIComponent(
      `Priemimo prasymo atsakymai: ${candidate.first_name} ${candidate.last_name}`.trim(),
    );
    const body = encodeURIComponent(
      buildQuestionnaireSummary(
        candidate,
        questionnairesByCandidateId[candidate.id] || null,
      ),
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  async function saveCandidate(status: "new" | "questionnaire_sent" = "new", resetAfterSave = true) {
    setMessage(null);

    if (!organizationId) {
      setMessage({ type: "error", text: "Nenustatyta organizacija." });
      return null;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setMessage({ type: "error", text: "Įvesk kandidato vardą ir pavardę." });
      return null;
    }

    if (!email.trim()) {
      setMessage({
        type: "error",
        text: "Įvesk kandidato el. paštą, nes klausimynas siunčiamas paštu.",
      });
      return null;
    }

    if (!consent) {
      setMessage({
        type: "error",
        text: "Būtinas kandidato sutikimas dėl duomenų tvarkymo atrankos tikslu.",
      });
      return null;
    }

    if (selectedQuestions.some((q) => hasForbiddenData(q.label))) {
      setMessage({
        type: "error",
        text: "Klausimyne yra draudžiamų / perteklinių duomenų užuominų.",
        details:
          "Pašalink klausimus apie asmens kodą, dokumentų kopijas, diagnozes ar specialių kategorijų duomenis.",
      });
      return null;
    }

    setSaving(true);

    try {
      const candidatePayload = {
        organization_id: organizationId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        desired_role: desiredRole.trim() || null,
        experience: experience.trim() || null,
        status,
        consent: true,
      };

      const { data: candidate, error: candidateError } = await supabase
        .from("candidates")
        .insert(candidatePayload)
        .select("id")
        .maybeSingle();

      if (candidateError) {
        setMessage({
          type: "error",
          text: "Nepavyko išsaugoti kandidato į `candidates`.",
          details: errorText(candidateError),
        });
        return null;
      }

      if (!candidate?.id) {
        setMessage({
          type: "error",
          text: "Kandidatas išsaugotas, bet DB negrąžino įrašo ID. Patikrink RLS.",
        });
        return null;
      }

      const questionnairePayload = {
        organization_id: organizationId,
        candidate_id: candidate.id,
        status: status === "questionnaire_sent" ? "sent" : "draft",
        questions: selectedQuestions,
        email_body: buildShortEmailBody(candidateName || "kandidate", buildQuestionnaireLink(candidate.id)),
        sent_to: email.trim(),
      };

      const { error: questionnaireError } = await supabase
        .from("candidate_questionnaires")
        .insert(questionnairePayload);

      if (questionnaireError) {
        await supabase
          .from("candidates")
          .delete()
          .eq("id", candidate.id)
          .eq("organization_id", organizationId);

        setMessage({
          type: "warning",
          text: "Klausimyno įrašas neišsaugotas, todėl kandidato įrašas atšauktas.",
          details: errorText(questionnaireError),
        });
        await onRefresh?.();
        return null;
      }

      await logAudit({
        organizationId,
        tableName: "candidates",
        recordId: candidate.id,
        action: status === "questionnaire_sent" ? "candidate.questionnaire_sent" : "candidate.created",
        changes: getChangedFields({}, {
          ...candidatePayload,
          candidate_id: candidate.id,
          questionnaire_status: questionnairePayload.status,
          questions_count: selectedQuestions.length,
        }),
      });

      await logAudit({
        organizationId,
        tableName: "candidate_questionnaires",
        recordId: candidate.id,
        action: "candidate.questionnaire_created",
        changes: getChangedFields({}, {
          candidate_id: candidate.id,
          status: questionnairePayload.status,
          sent_to: questionnairePayload.sent_to,
          questions_count: selectedQuestions.length,
        }),
      });

      setMessage({
        type: "success",
        text:
          status === "questionnaire_sent"
            ? "Kandidatas išsaugotas, klausimyno tekstas paruoštas siuntimui."
            : "Kandidatas išsaugotas.",
      });

      if (resetAfterSave) {
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhone("");
        setDesiredRole("");
        setExperience("");
        setConsent(false);
        setQuestions(DEFAULT_QUESTIONS);
      }

      await onRefresh?.();
      return candidate.id;
    } catch (error) {
      setMessage({
        type: "error",
        text: "Klaida saugant kandidatą.",
        details: errorText(error),
      });
      return null;
    } finally {
      setSaving(false);
    }
  }



  async function saveAndOpenQuestionnaireEmail() {
    const savedCandidateId = await saveCandidate("questionnaire_sent", false);
    if (!savedCandidateId) return;

    const questionnaireLink = buildQuestionnaireLink(savedCandidateId);
    const body = buildShortEmailBody(candidateName || "kandidate", questionnaireLink);
    const subject = encodeURIComponent("Kandidatavimo anketa");
    const encodedBody = encodeURIComponent(body);

    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${encodedBody}`;

    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setDesiredRole("");
    setExperience("");
    setConsent(false);
    setQuestions(DEFAULT_QUESTIONS);
  }

  async function acceptCandidateToTeam(candidate: Candidate) {
    setMessage(null);

    if (!organizationId) {
      setMessage({ type: "error", text: "Nenustatyta organizacija." });
      return;
    }

    const candidateEmail = (candidate.email || "").trim();

    if (!candidateEmail) {
      setMessage({
        type: "error",
        text: "Kandidatas neturi el. pašto, todėl negalima sukurti kvietimo prisijungti.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Priimti kandidatą ${candidate.first_name} ${candidate.last_name} ir sukurti kvietimą prisijungti prie darbuotojų modulio?`,
    );

    if (!confirmed) return;

    setAcceptingCandidateId(candidate.id);

    try {
      const inviteToken = createInviteToken();

      const invitePayload = {
        organization_id: organizationId,
        email: candidateEmail,
        role: "employee",
        status: "pending",
        token: inviteToken,
      };

      const { error: inviteError } = await supabase
        .from("organization_invites")
        .insert(invitePayload);

      if (inviteError) {
        setMessage({
          type: "error",
          text: "Nepavyko sukurti kvietimo darbuotojui.",
          details: errorText(inviteError),
        });
        return;
      }

      const { error: candidateError } = await supabase
        .from("candidates")
        .update({ status: "invited" })
        .eq("id", candidate.id)
        .eq("organization_id", organizationId);

      if (candidateError) {
        setMessage({
          type: "warning",
          text: "Kvietimas sukurtas, bet kandidato būsena neatnaujinta.",
          details: errorText(candidateError),
        });
        await onRefresh?.();
        return;
      }

      await logAudit({
        organizationId,
        tableName: "organization_invites",
        recordId: candidate.id,
        action: "candidate.invite_created",
        changes: getChangedFields({}, {
          email: candidateEmail,
          role: "employee",
          status: "pending",
          candidate_id: candidate.id,
        }),
      });

      await logAudit({
        organizationId,
        tableName: "candidates",
        recordId: candidate.id,
        action: "candidate.hired",
        changes: getChangedFields(
          { status: candidate.status || "new" },
          { status: "invited", email: candidateEmail, desired_role: candidate.desired_role || null },
        ),
      });

      setMessage({
        type: "success",
        text: `Kandidatas ${candidate.first_name} ${candidate.last_name} priimtas. Sukurtas kvietimas prisijungti.`,
      });

      await onRefresh?.();
    } catch (error) {
      setMessage({
        type: "error",
        text: "Nepavyko priimti kandidato į darbuotojus.",
        details: errorText(error),
      });
    } finally {
      setAcceptingCandidateId(null);
    }
  }

  function resetForm() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setDesiredRole("");
    setExperience("");
    setConsent(false);
    setQuestions(DEFAULT_QUESTIONS);
    setMessage(null);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#c9d8d0] bg-white shadow-sm">
      <header className="border-b border-[#dbe6e0] bg-[#486b5d] px-5 py-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
              Darbuotojo priėmimas
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Priėmimo prašymai</h2>
            <p className="mt-1 max-w-4xl text-sm font-semibold text-white/80">
              Paruoškite pasirinktam darbuotojui nuorodą, kad prašymą priimti į darbą jis užpildytų nuotoliniu būdu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg bg-white/12 px-3 py-2 text-sm font-black text-white/90 hover:bg-white/20"
            >
              Išvalyti formą
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-[#dbe6e0] bg-[#f7fcf9] px-4 py-2 text-sm font-bold text-[#486b5d]">
        Ši sritis skirta jau pasirinktam darbuotojui. Ji nepakeičia atrankos ir neprašo perteklinių jautrių duomenų.
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-[#dbe6e0] bg-[#ffffff] p-4">
          <h3 className="text-xl font-black text-[#10251f]">Pasirinkto darbuotojo duomenys</h3>
          <p className="mt-2 text-sm font-semibold text-[#6a7e75]">
            Įveskite kontaktus ir pareigas, dėl kurių jau susitarta.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-black text-[#6a7e75]">Vardas</span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Vardas"
                className="h-10 w-full rounded-lg border border-[#c2d3ca] bg-white px-4 text-sm font-bold text-[#10251f] outline-none focus:border-[#486b5d] focus:ring-2 focus:ring-[#dce7e2]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-black text-[#6a7e75]">Pavardė</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Pavardė"
                className="h-10 w-full rounded-lg border border-[#c2d3ca] bg-white px-4 text-sm font-bold text-[#10251f] outline-none focus:border-[#486b5d] focus:ring-2 focus:ring-[#dce7e2]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-black text-[#6a7e75]">El. paštas</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="vardas@pastas.lt"
                className="h-10 w-full rounded-lg border border-[#c2d3ca] bg-white px-4 text-sm font-bold text-[#10251f] outline-none focus:border-[#486b5d] focus:ring-2 focus:ring-[#dce7e2]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-black text-[#6a7e75]">Telefonas</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+370..."
                className="h-10 w-full rounded-lg border border-[#c2d3ca] bg-white px-4 text-sm font-bold text-[#10251f] outline-none focus:border-[#486b5d] focus:ring-2 focus:ring-[#dce7e2]"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-black text-[#6a7e75]">Pareigos, į kurias priimamas</span>
              <input
                value={desiredRole}
                onChange={(event) => setDesiredRole(event.target.value)}
                placeholder="Pvz. slaugytojo padėjėjas, administratorius"
                className="h-10 w-full rounded-lg border border-[#c2d3ca] bg-white px-4 text-sm font-bold text-[#10251f] outline-none focus:border-[#486b5d] focus:ring-2 focus:ring-[#dce7e2]"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-black text-[#6a7e75]">Padalinys arba priėmimo pastaba</span>
              <textarea
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
                placeholder="Pvz., Slaugos skyrius, planuojama pradžia ar kita atsakingam darbuotojui svarbi pastaba."
                rows={3}
                className="w-full resize-none rounded-lg border border-[#c2d3ca] bg-white px-4 py-2 text-sm font-bold text-[#10251f] outline-none focus:border-[#486b5d] focus:ring-2 focus:ring-[#dce7e2]"
              />
            </label>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-[#dbe6e0] bg-white px-4 py-2">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-[#c2d3ca] text-[#486b5d] focus:ring-emerald-600"
            />
            <span className="text-sm font-black leading-6 text-[#486b5d]">
              Darbuotojas informuotas, kad jo duomenys bus tvarkomi darbo sutarties sudarymo ir vykdymo tikslu.
            </span>
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveCandidate("new")}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c2d3ca] bg-white px-4 text-sm font-black text-[#486b5d] transition hover:bg-[#ffffff] disabled:opacity-60"
            >
              <Plus size={16} />
              {saving ? "Saugoma..." : "Išsaugoti prašymą"}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => void saveAndOpenQuestionnaireEmail()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#486b5d] px-4 text-sm font-black text-white transition hover:bg-[#39594c] disabled:opacity-60"
            >
              <Mail size={16} />
              {saving ? "Ruošiama..." : "Siųsti prašymo nuorodą"}
            </button>

            <button
              type="button"
              onClick={() => void copyEmailText()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c2d3ca] bg-white px-4 text-sm font-black text-[#486b5d] transition hover:bg-[#ffffff]"
            >
              <Copy size={16} />
              Kopijuoti trumpą laišką
            </button>
          </div>

          {message ? (
            <div
              className={[
                "mt-4 whitespace-pre-wrap rounded-lg border px-4 py-2 text-sm font-bold",
                message.type === "success"
                  ? "border-[#c9d8d0] bg-[#f7fcf9] text-[#486b5d]"
                  : message.type === "warning"
                    ? "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]"
                    : "border-[#efc0bd] bg-[#fff1f0] text-red-800",
              ].join(" ")}
            >
              <div>{message.text}</div>
              {message.details ? (
                <div className="mt-2 break-words rounded-xl bg-white/60 p-3 text-xs font-semibold opacity-90">
                  {message.details}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-[#dbe6e0] bg-white p-4">
          <h3 className="text-xl font-black text-[#10251f]">Priėmimo prašymo laukai</h3>
          <p className="mt-2 text-sm font-semibold text-[#6a7e75]">
            Pasirinkite informaciją, kurios reikia darbo sutarties ir priėmimo dokumentų paruošimui.
          </p>

          <div className="mt-5 space-y-3">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="flex items-start gap-3 rounded-lg border border-[#dbe6e0] bg-[#ffffff] px-4 py-2"
              >
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-[#6a7e75]">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <textarea
                    value={question.label}
                    onChange={(event) =>
                      updateQuestion(question.id, { label: event.target.value })
                    }
                    rows={2}
                    aria-label={`Redaguoti ${index + 1} klausimą`}
                    className="w-full resize-y rounded-lg border border-[#c2d3ca] bg-white px-3 py-2 text-sm font-black text-[#10251f] outline-none transition focus:border-[#486b5d] focus:ring-2 focus:ring-[#dce7e2]"
                  />
                  <div className="mt-2 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-xs font-black text-[#486b5d]">
                      <input
                        type="checkbox"
                        className="accent-[#486b5d]"
                        checked={question.required}
                        onChange={(event) =>
                          updateQuestion(question.id, {
                            required: event.target.checked,
                          })
                        }
                      />
                      Privalomas
                    </label>
                    <label className="flex items-center gap-2 text-xs font-black text-[#486b5d]">
                      <input
                        type="checkbox"
                        className="accent-[#486b5d]"
                        checked={question.includeInContract}
                        onChange={(event) =>
                          updateQuestion(question.id, {
                            includeInContract: event.target.checked,
                          })
                        }
                      />
                      Naudoti sutarčiai
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeQuestion(question.id)}
                  className="rounded-xl border border-[#dbe6e0] bg-white p-2 text-[#6a7e75] hover:bg-[#ffffff]"
                  aria-label="Pašalinti klausimą"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-[#dbe6e0] bg-[#ffffff] p-4">
            <h4 className="text-sm font-black text-[#486b5d]">
              Pridėti savo klausimą
            </h4>
            <textarea
              value={newQuestion}
              onChange={(event) => setNewQuestion(event.target.value)}
              placeholder="Įrašykite klausimą. Neklauskite asmens kodo, dokumentų kopijų ar jautrių duomenų."
              rows={3}
              className="mt-3 w-full resize-none rounded-lg border border-[#c2d3ca] bg-white px-4 py-2 text-sm font-bold text-[#10251f] outline-none focus:border-[#486b5d] focus:ring-2 focus:ring-[#dce7e2]"
            />
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm font-bold text-[#486b5d]">
                <input
                  type="checkbox"
                  className="accent-[#486b5d]"
                  checked={newQuestionRequired}
                  onChange={(event) => setNewQuestionRequired(event.target.checked)}
                />
                Privalomas
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-[#486b5d]">
                <input
                  type="checkbox"
                  className="accent-[#486b5d]"
                  checked={newQuestionContract}
                  onChange={(event) => setNewQuestionContract(event.target.checked)}
                />
                Galima naudoti darbo sutarčiai
              </label>
              <button
                type="button"
                onClick={addQuestion}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#486b5d] px-4 py-2 text-sm font-black text-white hover:bg-[#39594c]"
                style={{ backgroundColor: "#486b5d", color: "#ffffff" }}
              >
                <Plus size={16} />
                Pridėti klausimą
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-[#dbe6e0] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm font-semibold text-[#6a7e75]">
                Darbuotojui siunčiamas trumpas laiškas su saugia nuoroda į atskirą prašymo formą.
              </p>
              <button
                type="button"
                onClick={() => void copyQuestionnaireLink()}
                className="inline-flex items-center gap-2 rounded-lg border border-[#c2d3ca] bg-white px-3 py-2 text-xs font-black text-[#486b5d] hover:bg-[#ffffff]"
              >
                <Link2 size={14} />
                Kopijuoti nuorodą
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-[#dbe6e0] bg-[#ffffff] p-4">
              <div className="flex items-center gap-2 text-sm font-black text-[#10251f]">
                <ExternalLink size={16} className="text-[#486b5d]" />
                Vieša priėmimo prašymo forma
              </div>
              <p className="mt-2 break-all rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#486b5d]">
                {questionnairePreviewLink}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6a7e75]">Privalomi</p>
                  <p className="mt-1 text-2xl font-black text-[#10251f]">
                    {selectedQuestions.filter((q) => q.required).length}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6a7e75]">Papildomi</p>
                  <p className="mt-1 text-2xl font-black text-[#10251f]">
                    {selectedQuestions.filter((q) => !q.required).length}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6a7e75]">Formatas</p>
                  <p className="mt-1 text-sm font-black text-[#10251f]">Nuoroda į anketą</p>
                </div>
              </div>
            </div>

            <div className="mt-4 border border-[#dbe6e0] bg-white p-4">
              <h4 className="text-sm font-black text-[#486b5d]">
                Darbuotojo matoma forma
              </h4>
              <p className="mt-2 text-sm font-semibold text-black">
                Atsakymai pateikiami saugioje internetinėje formoje, ne el. paštu.
              </p>
              <div className="mt-4 space-y-3">
                {selectedQuestions.map((question, index) => (
                  <div
                    key={question.id}
                    className="border border-[#c2d3ca] bg-white p-4"
                  >
                    <p className="text-sm font-black text-black">
                      {index + 1}. {question.label}
                      {question.required ? " *" : ""}
                    </p>
                    <div className="mt-3 min-h-11 border-b-2 border-[#c2d3ca] px-1 py-2 text-sm text-[#6a7e75]">
                      Darbuotojas atsakys čia
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[#dbe6e0] bg-white p-4">
        <h3 className="text-xl font-black text-[#10251f]">Priėmimo prašymų sąrašas</h3>
        <div className="mt-4 overflow-hidden rounded-lg border border-[#dbe6e0]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#ffffff] text-[#6a7e75]">
              <tr>
                <th className="px-4 py-2 font-black">Darbuotojas</th>
                <th className="px-4 py-2 font-black">Kontaktai</th>
                <th className="px-4 py-2 font-black">Pareigos</th>
                <th className="px-4 py-2 font-black">Būsena</th>
                <th className="px-4 py-2 font-black">Patirtis</th>
                <th className="px-4 py-2 text-right font-black">Veiksmai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {safeCandidates.length ? (
                safeCandidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td className="px-4 py-2 font-bold text-[#10251f]">
                      {candidate.first_name} {candidate.last_name}
                    </td>
                    <td className="px-4 py-2">
                      {candidate.email || "—"} / {candidate.phone || "—"}
                    </td>
                    <td className="px-4 py-2">{candidate.desired_role || "—"}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-[#486b5d]">
                        {candidateStatusLabel(candidate.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2">{candidate.experience || "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {questionnairesByCandidateId[candidate.id] ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setPreviewCandidateId(candidate.id)}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#cfe0d7] bg-white px-4 text-xs font-black text-[#486b5d] transition hover:border-[#486b5d]"
                            >
                              <FileText size={15} />
                              Peržiūrėti atsakymus
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadQuestionnaireSummary(candidate)}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#cfe0d7] bg-white px-4 text-xs font-black text-[#486b5d] transition hover:border-[#486b5d]"
                            >
                              <Download size={15} />
                              Atsisiųsti
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyQuestionnaireSummary(candidate)}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#cfe0d7] bg-white px-4 text-xs font-black text-[#486b5d] transition hover:border-[#486b5d]"
                            >
                              <Copy size={15} />
                              Kopijuoti
                            </button>
                            <button
                              type="button"
                              onClick={() => forwardQuestionnaireToAccounting(candidate)}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#cfe0d7] bg-white px-4 text-xs font-black text-[#486b5d] transition hover:border-[#486b5d]"
                            >
                              <Send size={15} />
                              Persiųsti
                            </button>
                          </>
                        ) : null}
                        {(candidate.status || "new") === "invited" || (candidate.status || "new") === "hired" ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-[#f7fcf9] px-3 py-1 text-xs font-black text-[#486b5d]">
                            <CheckCircle2 size={14} />
                            Perduota komandai
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={acceptingCandidateId === candidate.id}
                            onClick={() => void acceptCandidateToTeam(candidate)}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#486b5d] px-4 text-xs font-black text-white transition hover:bg-[#39594c] disabled:opacity-60"
                          >
                            <UserPlus size={15} />
                            {acceptingCandidateId === candidate.id ? "Kuriama..." : "Priimti į komandą"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center font-bold text-[#6a7e75]">
                    Priėmimo prašymų dar nėra.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {previewCandidate && previewQuestionnaire ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10251f]/45 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 bg-[#486b5d] px-8 py-7 text-white">
              <div>
                <p className="text-sm font-bold tracking-[0.08em] text-white/80">
                  Priėmimo prašymo atsakymai
                </p>
                <h3 className="mt-2 font-serif text-4xl font-semibold leading-tight">
                  {previewCandidate.first_name} {previewCandidate.last_name}
                </h3>
                <p className="mt-3 text-sm font-semibold text-white/85">
                  Pateikta: {formatDateTime(previewQuestionnaire.submitted_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCandidateId(null)}
                className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Uždaryti"
              >
                <X size={24} />
              </button>
            </div>

            <div className="max-h-[calc(90vh-220px)] overflow-y-auto px-8 py-6">
              <div className="grid gap-4">
                {questionnaireAnswerRows(previewQuestionnaire).length ? (
                  questionnaireAnswerRows(previewQuestionnaire).map((row, index) => (
                    <div
                      key={`${row.label}-${index}`}
                      className="rounded-2xl border border-[#dbe6e0] bg-white px-5 py-4"
                    >
                      <p className="text-sm font-black text-[#486b5d]">
                        {index + 1}. {row.label}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-base font-semibold text-[#10251f]">
                        {row.answer}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-[#dbe6e0] bg-white px-5 py-6 text-base font-semibold text-[#486b5d]">
                    Atsakymų šiame prašyme dar nėra.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-[#dbe6e0] bg-[#f7fcf9] px-8 py-5">
              <button
                type="button"
                onClick={() => downloadQuestionnaireSummary(previewCandidate)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cfe0d7] bg-white px-4 text-sm font-black text-[#486b5d] transition hover:border-[#486b5d]"
              >
                <Download size={16} />
                Atsisiųsti
              </button>
              <button
                type="button"
                onClick={() => void copyQuestionnaireSummary(previewCandidate)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cfe0d7] bg-white px-4 text-sm font-black text-[#486b5d] transition hover:border-[#486b5d]"
              >
                <Copy size={16} />
                Kopijuoti
              </button>
              <button
                type="button"
                onClick={() => forwardQuestionnaireToAccounting(previewCandidate)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#486b5d] px-5 text-sm font-black text-white transition hover:bg-[#39594c]"
              >
                <Send size={16} />
                Persiųsti buhalterijai
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
