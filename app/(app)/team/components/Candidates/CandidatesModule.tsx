"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Copy, Mail, Plus, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Candidate = {
  id: string;
  first_name: string;
  last_name: string;
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

type CandidatesModuleProps = {
  organizationId: string | null | undefined;
  candidates?: Candidate[] | null;
  onRefresh?: () => void | Promise<void>;
};

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
    label:
      "Kokio darbo krūvio pageidaujate: pilno etato, dalinio etato ar pamaininio darbo?",
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
    label:
      "Ar sutiktumėte dirbti vakarais, savaitgaliais ar švenčių dienomis, jei pareigybė to reikalauja?",
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
    label:
      "Ar turite pareigoms reikalingų pažymų, licencijų ar mokymų? Nurodykite tik dokumento tipą ir galiojimą, be asmens kodo ar dokumento kopijų.",
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

function buildEmailBody(candidateName: string, questions: CandidateQuestion[]) {
  const required = questions.filter((q) => q.required);
  const optional = questions.filter((q) => !q.required);

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
    ...(optional.length
      ? optional.map((q, index) => `${index + 1}. ${q.label}`)
      : ["Papildomų klausimų nėra."]),
    "",
    "Atsakydami į šį laišką patvirtinate, kad pateikta informacija yra teisinga ir ją galima naudoti atrankos tikslu.",
    "",
    "Pagarbiai",
  ].join("\n");
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

  const emailBody = useMemo(
    () => buildEmailBody(candidateName || "kandidate", selectedQuestions),
    [candidateName, selectedQuestions],
  );

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent("Klausimai dėl darbo atrankos");
    const body = encodeURIComponent(emailBody);
    return `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
  }, [email, emailBody]);

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

  async function copyEmailText() {
    await navigator.clipboard.writeText(emailBody);
    setMessage({ type: "success", text: "Laiško tekstas nukopijuotas." });
  }

  async function saveCandidate(status: "new" | "questionnaire_sent" = "new") {
    setMessage(null);

    if (!organizationId) {
      setMessage({ type: "error", text: "Nenustatyta organizacija." });
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setMessage({ type: "error", text: "Įvesk kandidato vardą ir pavardę." });
      return;
    }

    if (!email.trim()) {
      setMessage({
        type: "error",
        text: "Įvesk kandidato el. paštą, nes klausimynas siunčiamas paštu.",
      });
      return;
    }

    if (!consent) {
      setMessage({
        type: "error",
        text: "Būtinas kandidato sutikimas dėl duomenų tvarkymo atrankos tikslu.",
      });
      return;
    }

    if (selectedQuestions.some((q) => hasForbiddenData(q.label))) {
      setMessage({
        type: "error",
        text: "Klausimyne yra draudžiamų / perteklinių duomenų užuominų.",
        details:
          "Pašalink klausimus apie asmens kodą, dokumentų kopijas, diagnozes ar specialių kategorijų duomenis.",
      });
      return;
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
        .single();

      if (candidateError) {
        setMessage({
          type: "error",
          text: "Nepavyko išsaugoti kandidato į `candidates`.",
          details: errorText(candidateError),
        });
        return;
      }

      const questionnairePayload = {
        organization_id: organizationId,
        candidate_id: candidate.id,
        status: status === "questionnaire_sent" ? "sent" : "draft",
        questions: selectedQuestions,
        email_body: emailBody,
        sent_to: email.trim(),
      };

      const { error: questionnaireError } = await supabase
        .from("candidate_questionnaires")
        .insert(questionnairePayload);

      if (questionnaireError) {
        setMessage({
          type: "warning",
          text: "Kandidatas išsaugotas, bet klausimyno įrašas neišsaugotas.",
          details: errorText(questionnaireError),
        });
        await onRefresh?.();
        return;
      }

      setMessage({
        type: "success",
        text:
          status === "questionnaire_sent"
            ? "Kandidatas išsaugotas, klausimyno tekstas paruoštas siuntimui."
            : "Kandidatas išsaugotas.",
      });

      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setDesiredRole("");
      setExperience("");
      setConsent(false);
      setQuestions(DEFAULT_QUESTIONS);

      await onRefresh?.();
    } catch (error) {
      setMessage({
        type: "error",
        text: "Klaida saugant kandidatą.",
        details: errorText(error),
      });
    } finally {
      setSaving(false);
    }
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
      const inviteToken =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
              Kandidatai
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Atranka ir klausimynai</h2>
            <p className="mt-1 max-w-4xl text-sm font-semibold text-white/80">
              Kandidatų kontaktai, klausimynai ir priėmimas į komandą vienoje vietoje.
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

      <div className="border-b border-[#dbe6e0] bg-[#eef4f1] px-4 py-2 text-sm font-bold text-[#486b5d]">
        BDAR saugi atranka: neklausiama asmens kodo, dokumentų kopijų, diagnozių ar kitų perteklinių jautrių duomenų.
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-[#dbe6e0] bg-[#f8faf8] p-4">
          <h3 className="text-xl font-black text-[#10251f]">Kandidato duomenys</h3>
          <p className="mt-2 text-sm font-semibold text-[#6a7e75]">
            Įvesk tik būtinus atrankos kontaktinius duomenis.
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
              <span className="text-sm font-black text-[#6a7e75]">Norimos pareigos</span>
              <input
                value={desiredRole}
                onChange={(event) => setDesiredRole(event.target.value)}
                placeholder="Pvz. slaugytojo padėjėjas, administratorius"
                className="h-10 w-full rounded-lg border border-[#c2d3ca] bg-white px-4 text-sm font-bold text-[#10251f] outline-none focus:border-[#486b5d] focus:ring-2 focus:ring-[#dce7e2]"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-black text-[#6a7e75]">Trumpa aktuali patirtis</span>
              <textarea
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
                placeholder="Tik su pareigomis susijusi patirtis. Nerašyti perteklinių asmens duomenų."
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
              Kandidatas sutiko, kad jo pateikti duomenys būtų tvarkomi atrankos tikslu.
            </span>
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveCandidate("new")}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c2d3ca] bg-white px-4 text-sm font-black text-[#486b5d] transition hover:bg-[#f8faf8] disabled:opacity-60"
            >
              <Plus size={16} />
              {saving ? "Saugoma..." : "Išsaugoti kandidatą"}
            </button>

            <a
              href={email ? mailtoHref : undefined}
              onClick={(event) => {
                if (!email) {
                  event.preventDefault();
                  setMessage({
                    type: "error",
                    text: "Įvesk kandidato el. paštą prieš siunčiant klausimyną.",
                  });
                  return;
                }
                void saveCandidate("questionnaire_sent");
              }}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#486b5d] px-4 text-sm font-black text-white transition hover:bg-[#39594c]"
            >
              <Mail size={16} />
              Siųsti klausimyną el. paštu
            </a>

            <button
              type="button"
              onClick={() => void copyEmailText()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c2d3ca] bg-white px-4 text-sm font-black text-[#486b5d] transition hover:bg-[#f8faf8]"
            >
              <Copy size={16} />
              Kopijuoti laišką
            </button>
          </div>

          {message ? (
            <div
              className={[
                "mt-4 whitespace-pre-wrap rounded-lg border px-4 py-2 text-sm font-bold",
                message.type === "success"
                  ? "border-[#c9d8d0] bg-[#eef4f1] text-[#486b5d]"
                  : message.type === "warning"
                    ? "border-[#ead8a7] bg-[#fff9e8] text-[#8a5a13]"
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
          <h3 className="text-xl font-black text-[#10251f]">Klausimynas kandidatui</h3>
          <p className="mt-2 text-sm font-semibold text-[#6a7e75]">
            Šabloną galima papildyti savo klausimais, bet sistema blokuoja akivaizdžiai perteklinius klausimus.
          </p>

          <div className="mt-5 space-y-3">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="flex items-start gap-3 rounded-lg border border-[#dbe6e0] bg-[#f8faf8] px-4 py-2"
              >
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-[#6a7e75]">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-[#10251f]">{question.label}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {question.required ? (
                      <span className="rounded-full bg-[#fff1f0] px-3 py-1 text-xs font-black text-[#8a2f27]">
                        Privalomas
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-[#6a7e75]">
                        Neprivalomas
                      </span>
                    )}
                    {question.includeInContract ? (
                      <span className="rounded-full bg-[#eef4f1] px-3 py-1 text-xs font-black text-[#486b5d]">
                        Gali būti naudojama sutarčiai
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeQuestion(question.id)}
                  className="rounded-xl border border-[#dbe6e0] bg-white p-2 text-[#6a7e75] hover:bg-[#f8faf8]"
                  aria-label="Pašalinti klausimą"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-[#dbe6e0] bg-[#f8faf8] p-4">
            <h4 className="text-sm font-black uppercase tracking-[0.14em] text-[#6a7e75]">
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
                  checked={newQuestionRequired}
                  onChange={(event) => setNewQuestionRequired(event.target.checked)}
                />
                Privalomas
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-[#486b5d]">
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
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
              >
                <Plus size={16} />
                Pridėti klausimą
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-[#dbe6e0] bg-white p-4">
            <h4 className="text-sm font-black uppercase tracking-[0.14em] text-[#6a7e75]">
              Laiško peržiūra
            </h4>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-xs font-semibold leading-5 text-slate-100">
              {emailBody}
            </pre>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[#dbe6e0] bg-white p-4">
        <h3 className="text-xl font-black text-[#10251f]">Kandidatų sąrašas</h3>
        <div className="mt-4 overflow-hidden rounded-lg border border-[#dbe6e0]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8faf8] text-[#6a7e75]">
              <tr>
                <th className="px-4 py-2 font-black">Kandidatas</th>
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
                      {(candidate.status || "new") === "invited" || (candidate.status || "new") === "hired" ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#eef4f1] px-3 py-1 text-xs font-black text-[#486b5d]">
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
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center font-bold text-[#6a7e75]">
                    Kandidatų dar nėra.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
