"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  RefreshCw,
  Search,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentOrganizationId } from "@/lib/current-organization";

type InviteStatus = "pending" | "accepted" | "cancelled" | "expired" | string;

type Invite = {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  status: InviteStatus;
  created_at: string;
  updated_at?: string | null;
  expires_at?: string | null;
  accepted_at?: string | null;
  invited_by?: string | null;
};

type NewInviteForm = {
  email: string;
  role: "employee" | "admin" | "owner";
};

const DEFAULT_FORM: NewInviteForm = {
  email: "",
  role: "employee",
};

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    owner: "Savininkas",
    admin: "Administratorius",
    employee: "Darbuotojas",
  };

  return labels[role] || role || "—";
}

function statusLabel(status: InviteStatus) {
  const labels: Record<string, string> = {
    pending: "Laukia prisijungimo",
    accepted: "Priimtas",
    cancelled: "Atšauktas",
    expired: "Pasibaigęs",
  };

  return labels[String(status || "").toLowerCase()] || status || "—";
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isPending(status: InviteStatus) {
  return String(status || "").toLowerCase() === "pending";
}

function statusClass(status: InviteStatus) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (normalized === "accepted") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (normalized === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function InvitesModule() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [form, setForm] = useState<NewInviteForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"active" | "all" | "pending" | "accepted" | "cancelled">("active");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const orgId = await getCurrentOrganizationId();
      setOrganizationId(orgId);

      const { data, error: inviteError } = await supabase
        .from("organization_invites")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (inviteError) throw inviteError;

      setInvites((data || []) as Invite[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nepavyko įkelti kvietimų.");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const pending = invites.filter((invite) => isPending(invite.status)).length;
    const accepted = invites.filter((invite) => String(invite.status).toLowerCase() === "accepted").length;
    const cancelled = invites.filter((invite) => String(invite.status).toLowerCase() === "cancelled").length;

    return {
      total: invites.length,
      pending,
      accepted,
      cancelled,
    };
  }, [invites]);

  const filteredInvites = useMemo(() => {
    const search = query.trim().toLowerCase();

    return invites.filter((invite) => {
      const status = String(invite.status || "").toLowerCase();

      if (filter === "active" && status === "accepted") return false;
      if (filter !== "active" && filter !== "all" && status !== filter) return false;

      if (!search) return true;

      return (
        String(invite.email || "").toLowerCase().includes(search) ||
        roleLabel(invite.role).toLowerCase().includes(search) ||
        statusLabel(invite.status).toLowerCase().includes(search)
      );
    });
  }, [filter, invites, query]);

  async function createInvite() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const email = normalizeEmail(form.email);

      if (!organizationId) {
        setError("Nepavyko nustatyti įstaigos.");
        return;
      }

      if (!email || !email.includes("@")) {
        setError("Įveskite teisingą el. pašto adresą.");
        return;
      }

      const existingPending = invites.find(
        (invite) => normalizeEmail(invite.email) === email && isPending(invite.status),
      );

      if (existingPending) {
        await sendInviteEmail(existingPending.email, existingPending.role, organizationId);
        setMessage("Toks kvietimas jau yra. Laiškas išsiųstas dar kartą.");
        setForm(DEFAULT_FORM);
        await load();
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error: insertError } = await supabase
        .from("organization_invites")
        .insert({
          organization_id: organizationId,
          email,
          role: form.role,
          status: "pending",
          invited_by: user?.id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select("*")
        .single();

      if (insertError) throw insertError;

      await sendInviteEmail(email, form.role, organizationId);

      setInvites((current) => [data as Invite, ...current]);
      setForm(DEFAULT_FORM);
      setMessage("Kvietimas sukurtas ir išsiųstas el. paštu.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Nepavyko sukurti kvietimo.");
    } finally {
      setSaving(false);
    }
  }

  async function sendInviteEmail(email: string, role: string, orgId: string) {
    const response = await fetch("/api/invitations/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        organizationId: orgId,
        role,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || "Nepavyko išsiųsti kvietimo laiško.");
    }

    return payload;
  }

  async function resendInvite(invite: Invite) {
    try {
      setResendingId(invite.id);
      setError("");
      setMessage("");

      if (!organizationId) {
        setError("Nepavyko nustatyti įstaigos.");
        return;
      }

      await sendInviteEmail(invite.email, invite.role, organizationId);
      setMessage(`Kvietimas išsiųstas dar kartą: ${invite.email}`);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Nepavyko persiųsti kvietimo.");
    } finally {
      setResendingId(null);
    }
  }

  async function cancelInvite(invite: Invite) {
    try {
      setError("");
      setMessage("");

      const { error: updateError } = await supabase
        .from("organization_invites")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invite.id);

      if (updateError) throw updateError;

      setMessage("Kvietimas atšauktas.");
      await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Nepavyko atšaukti kvietimo.");
    }
  }


  async function approveInvite(invite: Invite) {
    try {
      setApprovingId(invite.id);
      setError("");
      setMessage("");

      if (!organizationId) {
        setError("Nepavyko nustatyti įstaigos.");
        return;
      }

      const email = normalizeEmail(invite.email);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email")
        .ilike("email", email)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.id) {
        setError("Darbuotojas dar neprisijungė pagal kvietimą. Pirmiausia jis turi paspausti laiške esančią nuorodą ir susikurti paskyrą.");
        return;
      }

      const { error: memberError } = await supabase
        .from("organization_members")
        .upsert(
          {
            organization_id: organizationId,
            user_id: profile.id,
            role: invite.role || "employee",
            is_active: true,
          },
          {
            onConflict: "organization_id,user_id",
          },
        );

      if (memberError) throw memberError;

      const { error: inviteError } = await supabase
        .from("organization_invites")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invite.id);

      if (inviteError) throw inviteError;

      setMessage(`Kvietimas patvirtintas: ${invite.email}`);
      await load();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Nepavyko patvirtinti kvietimo.");
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-[28px] border border-[#c9d8d0] bg-white shadow-sm">
        <div className="bg-[#486b5d] px-6 py-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">
                Naudotojų valdymas
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">
                Kvietimai prisijungti
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-white/80">
                Čia kuriami darbuotojų kvietimai. Priimti kvietimai vėliau gali būti paslėpti, o laukiančius galima persiųsti dar kartą.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-[#486b5d] shadow-sm transition hover:bg-[#f8faf8] disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atnaujinti
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-[#dbe6e0] bg-[#eef4f1] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Laukia" value={loading ? "…" : String(stats.pending)} tone={stats.pending > 0 ? "amber" : "emerald"} />
          <StatCard label="Priimti" value={loading ? "…" : String(stats.accepted)} tone="emerald" />
          <StatCard label="Atšaukti" value={loading ? "…" : String(stats.cancelled)} tone={stats.cancelled > 0 ? "red" : "muted"} />
          <StatCard label="Visi" value={loading ? "…" : String(stats.total)} tone="muted" />
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#047857]">
              Naujas kvietimas
            </p>
            <h3 className="mt-2 text-2xl font-black text-[#10251f]">
              Pakviesti darbuotoją
            </h3>
            <p className="mt-1 text-sm font-bold leading-6 text-[#6a7e75]">
              Darbuotojas gaus el. laišką ir galės susikurti paskyrą.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-black text-[#486b5d]">El. paštas</span>
                <input
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="vardas@imone.lt"
                  className="mt-2 w-full rounded-2xl border border-[#c9d8d0] bg-white px-4 py-3 text-base font-bold text-[#10251f] outline-none transition focus:border-[#047857] focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-black text-[#486b5d]">Rolė</span>
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value as NewInviteForm["role"],
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-[#c9d8d0] bg-white px-4 py-3 text-base font-bold text-[#10251f] outline-none transition focus:border-[#047857] focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="employee">Darbuotojas</option>
                  <option value="admin">Administratorius</option>
                  <option value="owner">Savininkas</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => void createInvite()}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#047857] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#065f46] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" />
                {saving ? "Siunčiama..." : "Sukurti ir išsiųsti kvietimą"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {(message || error) ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm font-black ${
                  error
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                {error || message}
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#dbe6e0] bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#047857]">
                    Sąrašas
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-[#10251f]">
                    Darbuotojų kvietimai
                  </h3>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6a7e75]" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Ieškoti..."
                      className="w-full rounded-xl border border-[#c9d8d0] bg-[#f8faf8] py-2 pl-9 pr-3 text-sm font-bold outline-none focus:border-[#047857] focus:ring-4 focus:ring-emerald-100 sm:w-56"
                    />
                  </div>

                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value as typeof filter)}
                    className="rounded-xl border border-[#c9d8d0] bg-[#f8faf8] px-3 py-2 text-sm font-black text-[#486b5d] outline-none focus:border-[#047857] focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="active">Aktyvūs</option>
                    <option value="pending">Laukia</option>
                    <option value="accepted">Priimti</option>
                    <option value="cancelled">Atšaukti</option>
                    <option value="all">Visi</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <EmptyState icon={<RefreshCw className="h-5 w-5 animate-spin" />} title="Kraunama..." text="Įkeliami kvietimai." />
                ) : filteredInvites.length === 0 ? (
                  <EmptyState icon={<Mail className="h-5 w-5" />} title="Kvietimų nėra" text="Sukurkite naują kvietimą darbuotojui." />
                ) : (
                  filteredInvites.map((invite) => (
                    <article
                      key={invite.id}
                      className="rounded-2xl border border-[#dbe6e0] bg-[#f8faf8] p-4 transition hover:bg-white hover:shadow-sm"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-lg font-black text-[#10251f]">
                              {invite.email}
                            </p>
                            <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(invite.status)}`}>
                              {statusLabel(invite.status)}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-[#6a7e75]">
                            <span>Rolė: {roleLabel(invite.role)}</span>
                            <span>Sukurta: {formatDate(invite.created_at)}</span>
                            <span>Galioja iki: {formatDate(invite.expires_at)}</span>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          {isPending(invite.status) ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void resendInvite(invite)}
                                disabled={resendingId === invite.id}
                                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
                              >
                                <Send className="h-4 w-4" />
                                {resendingId === invite.id ? "Siunčiama..." : "Persiųsti"}
                              </button>

                              <button
                                type="button"
                                onClick={() => void approveInvite(invite)}
                                disabled={approvingId === invite.id}
                                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-700 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-800 disabled:opacity-60"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                {approvingId === invite.id ? "Tvirtinama..." : "Patvirtinti"}
                              </button>

                              <button
                                type="button"
                                onClick={() => void cancelInvite(invite)}
                                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100"
                              >
                                <X className="h-4 w-4" />
                                Atšaukti
                              </button>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-xl border border-[#dbe6e0] bg-white px-3 py-2 text-xs font-black text-[#6a7e75]">
                              <CheckCircle2 className="h-4 w-4" />
                              Baigta
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  Jei laiškas neatėjo, pirmiausia patikrinkite ar el. paštas teisingas, ar nėra Spam/Promotions aplanke, tada spauskite „Persiųsti“. Kai darbuotojas paspaus laiško nuorodą ir susikurs paskyrą, administratoriui beliks paspausti „Patvirtinti“.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "red" | "muted";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "red"
        ? "border-red-200 bg-red-50 text-red-700"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-[#dbe6e0] bg-white text-[#486b5d]";

  return (
    <article className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-80">
        {label}
      </p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </article>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#c9d8d0] bg-[#f8faf8] p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#486b5d] shadow-sm">
        {icon}
      </div>
      <p className="mt-3 text-lg font-black text-[#10251f]">{title}</p>
      <p className="mt-1 text-sm font-bold text-[#6a7e75]">{text}</p>
    </div>
  );
}
