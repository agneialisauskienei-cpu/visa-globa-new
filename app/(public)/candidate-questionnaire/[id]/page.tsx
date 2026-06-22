"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Send,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type CandidateQuestion = {
  id: string;
  label: string;
  required?: boolean;
  includeInContract?: boolean;
  category?: "contract" | "work" | "availability" | "qualification" | "other" | string;
};

type QuestionnaireRow = {
  id?: string;
  organization_id: string | null;
  candidate_id: string | null;
  status: string | null;
  questions: CandidateQuestion[] | null;
  answers?: Record<string, string> | null;
  submitted_at?: string | null;
  sent_to?: string | null;
};

type CandidateRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  desired_role: string | null;
};

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
];

function hasForbiddenData(text: string) {
  const lower = text.toLowerCase();
  return FORBIDDEN_HINTS.some((hint) => lower.includes(hint));
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

function normalizeQuestions(value: unknown): CandidateQuestion[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const question = item as Partial<CandidateQuestion>;
      const label = String(question.label || "").trim();
      if (!label) return null;

      return {
        id: String(question.id || `question-${index}`),
        label,
        required: Boolean(question.required),
        includeInContract: Boolean(question.includeInContract),
        category: question.category || "other",
      };
    })
    .filter(Boolean) as CandidateQuestion[];
}

function categoryLabel(category?: string) {
  switch (category) {
    case "contract":
      return "Sutarčiai";
    case "work":
      return "Darbas";
    case "availability":
      return "Užimtumas";
    case "qualification":
      return "Kvalifikacija";
    default:
      return "Kita";
  }
}

export default function CandidateQuestionnairePage() {
  const params = useParams<{ id: string }>();
  const candidateId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireRow | null>(null);
  const [candidate, setCandidate] = useState<CandidateRow | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string; details?: string } | null>(null);

  const questions = useMemo(
    () => normalizeQuestions(questionnaire?.questions || []),
    [questionnaire?.questions],
  );

  const candidateName = useMemo(() => {
    const name = `${candidate?.first_name || ""} ${candidate?.last_name || ""}`.trim();
    return name || "Kandidate";
  }, [candidate?.first_name, candidate?.last_name]);

  const answeredRequiredCount = useMemo(() => {
    return questions.filter((question) => {
      if (!question.required) return false;
      return Boolean((answers[question.id] || "").trim());
    }).length;
  }, [answers, questions]);

  const requiredCount = questions.filter((question) => question.required).length;
  const progress = requiredCount ? Math.round((answeredRequiredCount / requiredCount) * 100) : 100;

  const loadQuestionnaire = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    if (!candidateId) {
      setMessage({ type: "error", text: "Neteisinga anketos nuoroda." });
      setLoading(false);
      return;
    }

    try {
      const { data: questionnaireData, error: questionnaireError } = await supabase
        .from("candidate_questionnaires")
        .select("id, organization_id, candidate_id, status, questions, answers, submitted_at, sent_to")
        .eq("candidate_id", candidateId)
        .maybeSingle();

      if (questionnaireError) {
        setMessage({
          type: "error",
          text: "Nepavyko įkelti anketos.",
          details: errorText(questionnaireError),
        });
        setLoading(false);
        return;
      }

      if (!questionnaireData) {
        setMessage({ type: "error", text: "Anketa nerasta arba nuoroda nebegalioja." });
        setLoading(false);
        return;
      }

      const row = questionnaireData as QuestionnaireRow;
      setQuestionnaire(row);
      setAnswers(row.answers || {});
      setSubmitted(Boolean(row.submitted_at || row.status === "answered"));

      if (row.candidate_id) {
        const { data: candidateData } = await supabase
          .from("candidates")
          .select("id, first_name, last_name, email, desired_role")
          .eq("id", row.candidate_id)
          .maybeSingle();

        if (candidateData) setCandidate(candidateData as CandidateRow);
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "Klaida įkeliant anketą.",
        details: errorText(error),
      });
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadQuestionnaire();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadQuestionnaire]);

  function updateAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function validateAnswers() {
    const missingRequired = questions.filter(
      (question) => question.required && !(answers[question.id] || "").trim(),
    );

    if (missingRequired.length) {
      setMessage({
        type: "error",
        text: `Užpildykite privalomus klausimus: ${missingRequired
          .map((question) => question.label)
          .join(", ")}`,
      });
      return false;
    }

    const forbiddenAnswer = Object.values(answers).find((answer) => hasForbiddenData(answer || ""));

    if (forbiddenAnswer) {
      setMessage({
        type: "error",
        text: "Atsakyme gali būti perteklinių arba jautrių asmens duomenų.",
        details:
          "Nerašykite asmens kodo, dokumentų numerių/kopijų, sveikatos diagnozių, politinių, religinių ar kitų specialių kategorijų duomenų.",
      });
      return false;
    }

    return true;
  }

  async function submitAnswers() {
    setMessage(null);

    if (!questionnaire?.candidate_id) {
      setMessage({ type: "error", text: "Nepavyko nustatyti kandidato anketos." });
      return;
    }

    if (submitted) {
      setMessage({ type: "success", text: "Anketa jau pateikta." });
      return;
    }

    if (!validateAnswers()) return;

    setSaving(true);

    try {
      const submittedAt = new Date().toISOString();

      const { error: questionnaireError } = await supabase
        .from("candidate_questionnaires")
        .update({
          answers,
          status: "answered",
          submitted_at: submittedAt,
        })
        .eq("candidate_id", questionnaire.candidate_id)
        .eq("organization_id", questionnaire.organization_id)
        .is("submitted_at", null);

      if (questionnaireError) {
        setMessage({
          type: "error",
          text: "Nepavyko pateikti anketos.",
          details: errorText(questionnaireError),
        });
        return;
      }

      await supabase
        .from("candidates")
        .update({ status: "answered" })
        .eq("id", questionnaire.candidate_id)
        .eq("organization_id", questionnaire.organization_id);

      setSubmitted(true);
      setQuestionnaire((prev) =>
        prev ? { ...prev, answers, status: "answered", submitted_at: submittedAt } : prev,
      );
      setMessage({ type: "success", text: "Ačiū, anketa sėkmingai pateikta." });
    } catch (error) {
      setMessage({
        type: "error",
        text: "Klaida pateikiant anketą.",
        details: errorText(error),
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7f4] px-4 py-8 text-[#10251f]">
        <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center">
          <div className="rounded-3xl border border-[#dbe6e0] bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#486b5d]" />
            <p className="mt-4 text-sm font-bold text-[#6a7e75]">Įkeliama kandidato anketa...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7f4] px-4 py-8 text-[#10251f]">
      <div className="mx-auto max-w-4xl">
        <section className="overflow-hidden rounded-3xl border border-[#c9d8d0] bg-white shadow-sm">
          <header className="bg-[#486b5d] px-5 py-6 text-white sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-[0.08em] text-white/70">
                  Priėmimo prašymas
                </p>
                <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                  {submitted ? "Prašymas pateiktas" : "Užpildykite prašymą priimti į darbą"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/82">
                  Sveiki, {candidateName}. Pateikite informaciją, reikalingą jūsų priėmimui ir darbo sutarties paruošimui.
                </p>
              </div>

              <div className="rounded-2xl bg-white/12 px-4 py-3 text-sm font-black text-white">
                {candidate?.desired_role ? candidate.desired_role : "Priėmimo prašymas"}
              </div>
            </div>
          </header>

          <div className="border-b border-[#dbe6e0] bg-[#f7fcf9] px-5 py-4 sm:px-8">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#486b5d]" />
              <div>
                <h2 className="text-sm font-black text-[#486b5d]">Svarbu dėl asmens duomenų</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#52685f]">
                  Neprašome asmens kodo, dokumentų kopijų, paso/ID kortelės, sveikatos diagnozių,
                  politinių, religinių ar kitų specialių kategorijų duomenų. Pateikite tik tai, kas
                  būtina darbo sutarties ir priėmimo dokumentų paruošimui.
                </p>
              </div>
            </div>
          </div>

          {message ? (
            <div
              className={[
                "mx-5 mt-5 whitespace-pre-wrap rounded-2xl border px-4 py-3 text-sm font-bold sm:mx-8",
                message.type === "success"
                  ? "border-[#c9d8d0] bg-[#f7fcf9] text-[#486b5d]"
                  : "border-[#efc0bd] bg-[#fff1f0] text-red-800",
              ].join(" ")}
            >
              <div className="flex items-start gap-2">
                {message.type === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <div>{message.text}</div>
                  {message.details ? (
                    <div className="mt-2 break-words rounded-xl bg-white/60 p-3 text-xs font-semibold opacity-90">
                      {message.details}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {!message && !questionnaire ? (
            <div className="px-5 py-10 text-center sm:px-8">
              <AlertCircle className="mx-auto h-9 w-9 text-red-700" />
              <h2 className="mt-4 text-xl font-black text-[#10251f]">Anketa nerasta</h2>
              <p className="mt-2 text-sm font-semibold text-[#6a7e75]">
                Patikrinkite, ar atidarėte teisingą nuorodą.
              </p>
            </div>
          ) : null}

          {questionnaire ? (
            <div className="px-5 py-6 sm:px-8">
              {submitted ? (
                <div className="rounded-2xl border border-[#c9d8d0] bg-[#f7fcf9] p-6 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-[#486b5d]" />
                  <h2 className="mt-4 text-xl font-black text-[#10251f]">Ačiū, atsakymai gauti</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#52685f]">
                    Organizacija peržiūrės Jūsų atsakymus ir parengs priėmimo bei darbo sutarties dokumentus.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-5 rounded-2xl border border-[#dbe6e0] bg-[#ffffff] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#486b5d] shadow-sm">
                          <ClipboardList size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-[#10251f]">
                            Privalomi atsakymai: {answeredRequiredCount} iš {requiredCount}
                          </p>
                          <p className="text-xs font-bold text-[#6a7e75]">
                            Iš viso klausimų: {questions.length}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#486b5d] shadow-sm">
                        {progress}%
                      </span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-[#486b5d] transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {questions.map((question, index) => (
                      <label
                        key={question.id}
                        className="block border border-[#c2d3ca] bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f7fcf9] text-xs font-black text-[#486b5d]">
                                {index + 1}
                              </span>
                              <span className="rounded-full bg-[#ffffff] px-3 py-1 text-xs font-black text-[#6a7e75]">
                                {categoryLabel(question.category)}
                              </span>
                              {question.required ? (
                                <span className="rounded-full bg-[#fff1f0] px-3 py-1 text-xs font-black text-[#8a2f27]">
                                  Privalomas
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-3 text-base font-black leading-6 text-[#10251f]">
                              {question.label}
                            </p>
                          </div>
                        </div>

                        <textarea
                          value={answers[question.id] || ""}
                          onChange={(event) => updateAnswer(question.id, event.target.value)}
                          rows={question.label.length > 90 ? 4 : 3}
                          placeholder="Įrašykite atsakymą..."
                          className="mt-4 w-full resize-none rounded-xl border border-[#c2d3ca] bg-[#ffffff] px-4 py-3 text-sm font-semibold leading-6 text-[#10251f] outline-none transition focus:border-[#486b5d] focus:bg-white focus:ring-2 focus:ring-[#dce7e2]"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="sticky bottom-0 -mx-5 mt-6 border-t border-[#dbe6e0] bg-white/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-bold leading-5 text-[#6a7e75]">
                        Pateikdami prašymą patvirtinate, kad informacija teisinga ir gali būti naudojama priėmimo bei darbo sutarties dokumentams parengti.
                      </p>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void submitAnswers()}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#486b5d] px-5 text-sm font-black text-white transition hover:bg-[#39594c] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={16} />}
                        {saving ? "Pateikiama..." : "Pateikti anketą"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
