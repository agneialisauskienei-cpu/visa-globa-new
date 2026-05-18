"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { getCurrentOrganizationId } from "@/lib/current-organization";

type Priority = "low" | "medium" | "high" | "critical";
type ShiftType = "morning" | "day" | "evening" | "night" | "other";

type HandoverEntry = {
  id: string;
  organization_id: string;
  resident_id: string | null;
  shift_date: string;
  shift_type: ShiftType;
  category: string;
  priority: Priority;
  title: string;
  note: string;
  is_important: boolean;
  needs_follow_up: boolean;
  archived: boolean;
  read_at: string | null;
  created_at: string;
  created_by: string | null;
};

type NewEntryForm = {
  category: string;
  priority: Priority;
  shift_date: string;
  shift_type: ShiftType;
  title: string;
  note: string;
  is_important: boolean;
  needs_follow_up: boolean;
};

type Props = {
  residentId: string;
  residentName?: string;
};

const CATEGORIES = [
  "Bendra",
  "Slauga",
  "Sveikata",
  "Mityba",
  "Elgesys / emocijos",
  "Incidentas",
  "Ūkis",
  "Artimieji",
  "Užduotis kitai pamainai",
];

const TOPICS: Array<{
  label: string;
  category: string;
  priority: Priority;
  title: string;
}> = [
  { label: "Slauga", category: "Slauga", priority: "medium", title: "Slaugos informacija" },
  { label: "Sveikata", category: "Sveikata", priority: "high", title: "Sveikatos stebėjimas" },
  { label: "Mityba", category: "Mityba", priority: "medium", title: "Mitybos informacija" },
  { label: "Elgesys", category: "Elgesys / emocijos", priority: "medium", title: "Elgesio / emocijų pokytis" },
  { label: "Incidentas", category: "Incidentas", priority: "critical", title: "Incidentas" },
  { label: "Ūkis", category: "Ūkis", priority: "medium", title: "Ūkio klausimas" },
  { label: "Artimieji", category: "Artimieji", priority: "medium", title: "Informacija apie artimuosius" },
  { label: "Užduotis", category: "Užduotis kitai pamainai", priority: "high", title: "Užduotis kitai pamainai" },
];

const SHIFTS: Array<{ value: ShiftType; label: string }> = [
  { value: "morning", label: "Rytinė" },
  { value: "day", label: "Dieninė" },
  { value: "evening", label: "Vakarinė" },
  { value: "night", label: "Naktinė" },
  { value: "other", label: "Kita" },
];

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: "low", label: "Žemas" },
  { value: "medium", label: "Vidutinis" },
  { value: "high", label: "Aukštas" },
  { value: "critical", label: "Kritinis" },
];

function today() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function initialForm(): NewEntryForm {
  return {
    category: "Bendra",
    priority: "medium",
    shift_date: today(),
    shift_type: "day",
    title: "",
    note: "",
    is_important: false,
    needs_follow_up: false,
  };
}

function priorityLabel(priority: Priority) {
  return PRIORITIES.find((item) => item.value === priority)?.label || priority;
}

function shiftLabel(shift: ShiftType) {
  return SHIFTS.find((item) => item.value === shift)?.label || shift;
}

function priorityClass(priority: Priority) {
  if (priority === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "high") return "border-amber-200 bg-amber-50 text-amber-700";
  if (priority === "medium") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function safeError(error: unknown) {
  if (!error) return "Nežinoma klaida.";
  if (error instanceof Error) return error.message;

  if (typeof error === "object") {
    const item = error as Record<string, unknown>;
    return [
      item.message ? String(item.message) : "",
      item.details ? String(item.details) : "",
      item.hint ? String(item.hint) : "",
      item.code ? String(item.code) : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return String(error);
}


async function writeAuditLog(input: {
  organizationId: string;
  action: string;
  entityId: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("audit_logs").insert({
      organization_id: input.organizationId,
      user_id: user?.id || null,
      action: input.action,
      entity_type: input.entityType || "handover_log",
      entity_id: input.entityId,
      metadata: input.metadata || {},
      created_at: new Date().toISOString(),
    });
  } catch {
    // Audit neturi nulaužti pagrindinio veiksmo UI.
  }
}


export default function ResidentHandoverEntriesPanel({ residentId, residentName }: Props) {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [entries, setEntries] = useState<HandoverEntry[]>([]);
  const [form, setForm] = useState<NewEntryForm>(() => initialForm());
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residentId]);

  async function loadEntries() {
    setLoading(true);
    setMessage("");

    try {
      const orgId = await getCurrentOrganizationId();

      if (!orgId) {
        setMessage("Nepavyko nustatyti organizacijos.");
        return;
      }

      setOrganizationId(orgId);

      const { data, error } = await supabase
        .from("handover_logs")
        .select(
          "id, organization_id, resident_id, shift_date, shift_type, category, priority, title, note, is_important, needs_follow_up, archived, read_at, created_at, created_by",
        )
        .eq("organization_id", orgId)
        .eq("resident_id", residentId)
        .eq("archived", false)
        .order("shift_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      setEntries((data as HandoverEntry[]) || []);
    } catch (error) {
      setMessage(`Nepavyko įkelti perdavimo žurnalo: ${safeError(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function createEntry() {
    const title = form.title.trim();
    const note = form.note.trim();

    if (!title) {
      setMessage("Įvesk įrašo pavadinimą.");
      return;
    }

    if (!note) {
      setMessage("Įvesk informaciją, kurią reikia perduoti.");
      return;
    }

    if (!organizationId) {
      setMessage("Nepavyko nustatyti organizacijos.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("handover_logs")
        .insert({
          organization_id: organizationId,
          resident_id: residentId,
          shift_date: form.shift_date,
          shift_type: form.shift_type,
          category: form.category,
          priority: form.priority,
          title,
          note,
          is_important: form.is_important,
          needs_follow_up: form.needs_follow_up,
          archived: false,
          created_by: user?.id || null,
          updated_by: user?.id || null,
        })
        .select(
          "id, organization_id, resident_id, shift_date, shift_type, category, priority, title, note, is_important, needs_follow_up, archived, read_at, created_at, created_by",
        )
        .single();

      if (error) throw error;

      setEntries((previous) => [data as HandoverEntry, ...previous]);

      await writeAuditLog({
        organizationId,
        action: "handover_log.created_from_resident_card",
        entityId: data.id,
        metadata: {
          resident_id: residentId,
          category: form.category,
          priority: form.priority,
          shift_type: form.shift_type,
          needs_follow_up: form.needs_follow_up,
          is_important: form.is_important,
        },
      });

      setForm(initialForm());
      setMessage("Perdavimo įrašas pridėtas prie gyventojo kortelės ir bendro perdavimo žurnalo.");
    } catch (error) {
      setMessage(`Nepavyko pridėti įrašo: ${safeError(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function markRead(entry: HandoverEntry) {
    try {
      const { error } = await supabase
        .from("handover_logs")
        .update({ read_at: new Date().toISOString() })
        .eq("id", entry.id);

      if (error) throw error;

      setEntries((previous) =>
        previous.map((item) =>
          item.id === entry.id ? { ...item, read_at: new Date().toISOString() } : item,
        ),
      );

      await writeAuditLog({
        organizationId: entry.organization_id,
        action: "handover_log.confirmed_seen_from_resident_card",
        entityId: entry.id,
        metadata: {
          resident_id: entry.resident_id || residentId,
          category: entry.category,
          shift_type: entry.shift_type,
        },
      });
    } catch (error) {
      setMessage(`Nepavyko pažymėti kaip perskaitytą: ${safeError(error)}`);
    }
  }

  const filteredEntries = useMemo(() => {
    const value = query.trim().toLowerCase();

    return entries.filter((entry) => {
      const matchesQuery = value
        ? [entry.title, entry.note, entry.category, entry.shift_type, entry.priority]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(value)
        : true;

      const matchesPriority =
        priorityFilter === "all" ? true : entry.priority === priorityFilter;

      return matchesQuery && matchesPriority;
    });
  }, [entries, priorityFilter, query]);

  const stats = useMemo(() => {
    return {
      all: entries.length,
      unread: entries.filter((entry) => !entry.read_at).length,
      important: entries.filter((entry) => entry.is_important).length,
      follow: entries.filter((entry) => entry.needs_follow_up).length,
      critical: entries.filter((entry) => entry.priority === "critical").length,
    };
  }, [entries]);

  return (
    <section className="space-y-5">
      {message ? (
        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 font-extrabold text-amber-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        <MiniStat label="Visi" value={stats.all} />
        <MiniStat label="Nepatvirtinti" value={stats.unread} tone="blue" />
        <MiniStat label="Svarbūs" value={stats.important} tone="amber" />
        <MiniStat label="Sekti" value={stats.follow} tone="emerald" />
        <MiniStat label="Kritiniai" value={stats.critical} tone="rose" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[460px_minmax(0,1fr)]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
            Naujas įrašas
          </p>
          <h3 className="mt-1 text-2xl font-black tracking-tight">
            Perdavimo įrašas gyventojui
          </h3>
          <p className="mt-1 font-semibold text-slate-500">
            Įrašas bus matomas ir bendrame perdavimo žurnale.
          </p>

          <div className="mt-5 space-y-4">
            <Field label="Tema">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TOPICS.map((topic) => {
                  const active = form.category === topic.category;

                  return (
                    <button
                      key={topic.label}
                      type="button"
                      onClick={() =>
                        setForm((previous) => ({
                          ...previous,
                          category: topic.category,
                          priority: topic.priority,
                          title: previous.title || topic.title,
                        }))
                      }
                      className={[
                        "min-h-11 rounded-2xl border px-3 py-2 text-sm font-black transition",
                        active
                          ? "border-emerald-300 bg-emerald-700 text-white shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800",
                      ].join(" ")}
                    >
                      {topic.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Data">
                <input
                  type="date"
                  value={form.shift_date}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, shift_date: event.target.value }))
                  }
                  className="input"
                />
              </Field>

              <Field label="Pamaina">
                <select
                  value={form.shift_type}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      shift_type: event.target.value as ShiftType,
                    }))
                  }
                  className="input"
                >
                  {SHIFTS.map((shift) => (
                    <option key={shift.value} value={shift.value}>
                      {shift.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Kategorija">
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, category: event.target.value }))
                  }
                  className="input"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Prioritetas">
                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      priority: event.target.value as Priority,
                    }))
                  }
                  className="input"
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Pavadinimas">
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, title: event.target.value }))
                }
                placeholder="Pvz. Stebėti po kritimo"
                className="input"
              />
            </Field>

            <Field label="Informacija">
              <textarea
                value={form.note}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, note: event.target.value }))
                }
                placeholder={`Ką būtina perduoti kitai pamainai apie ${residentName || "gyventoją"}?`}
                className="input min-h-32 resize-none"
              />
            </Field>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-700">
              <input
                type="checkbox"
                checked={form.is_important}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, is_important: event.target.checked }))
                }
              />
              Pažymėti kaip svarbų
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-700">
              <input
                type="checkbox"
                checked={form.needs_follow_up}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    needs_follow_up: event.target.checked,
                  }))
                }
              />
              Reikia sekti / perduoti kitai pamainai
            </label>

            <button
              type="button"
              onClick={() => void createEntry()}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-5 py-3 font-extrabold text-white transition hover:bg-emerald-900 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {saving ? "Saugoma..." : "Pridėti įrašą"}
            </button>
          </div>
        </article>

        <article className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
                Perdavimo žurnalas
              </p>
              <h3 className="mt-1 text-2xl font-black tracking-tight">
                Gyventojo perdavimo įrašai
              </h3>
              <p className="mt-1 font-semibold text-slate-500">
                Čia rodomi tik su šiuo gyventoju susieti įrašai.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadEntries()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-extrabold text-emerald-700 transition hover:bg-emerald-100"
            >
              <RefreshCw className="h-4 w-4" />
              Atnaujinti
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block min-w-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ieškoti įrašuose..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              />
            </label>

            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className="input"
            >
              <option value="all">Visi prioritetai</option>
              {PRIORITIES.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 grid gap-3">
            {loading ? (
              <EmptyState text="Kraunama perdavimo įrašus..." />
            ) : filteredEntries.length ? (
              filteredEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-emerald-200 hover:bg-emerald-50"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600">
                          {entry.category}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${priorityClass(entry.priority)}`}>
                          {priorityLabel(entry.priority)}
                        </span>
                        {entry.is_important ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                            Svarbu
                          </span>
                        ) : null}
                        {entry.needs_follow_up ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                            Sekti
                          </span>
                        ) : null}
                      </div>

                      <h4 className="mt-3 text-xl font-black text-slate-950">{entry.title}</h4>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">
                        {entry.note}
                      </p>
                    </div>

                    <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {entry.shift_date}
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-400">
                        {shiftLabel(entry.shift_type)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                    <div className="text-xs font-bold text-slate-500">
                      Sukurta: {new Date(entry.created_at).toLocaleString("lt-LT")}
                    </div>

                    {!entry.read_at ? (
                      <button
                        type="button"
                        onClick={() => void markRead(entry)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Patvirtinti, kad mačiau
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-500">
                        <CheckCircle2 className="h-4 w-4" />
                        Patvirtinta
                      </span>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <EmptyState text="Su šiuo gyventoju susietų perdavimo įrašų dar nėra." />
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function MiniStat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "blue" | "amber" | "emerald" | "rose";
}) {
  const toneClass = {
    slate: "bg-white text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
  }[tone];

  return (
    <article className={`rounded-3xl border border-slate-200 p-5 shadow-sm ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-2 text-4xl font-black">{value}</p>
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-extrabold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <ClipboardList className="mx-auto h-10 w-10 text-slate-400" />
      <p className="mt-4 font-black text-slate-600">{text}</p>
    </div>
  );
}
