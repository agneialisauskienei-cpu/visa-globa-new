"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type InviteRow = {
  id: string;
  organization_id: string;
  email: string | null;
  role: string | null;
  status: string | null;
  token: string | null;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getReadableError(error: unknown) {
  if (!error) return "Nepavyko įvykdyti veiksmo.";
  if (error instanceof Error) return error.message;

  if (typeof error === "object") {
    const maybe = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return [maybe.message, maybe.details, maybe.hint, maybe.code]
      .filter(Boolean)
      .join(" · ");
  }

  return String(error);
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function getInviteByToken(inviteToken: string) {
    const { data, error } = await supabase
      .from("organization_invites")
      .select("id, organization_id, email, role, status, token")
      .eq("token", inviteToken)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Kvietimas nerastas arba nuoroda neteisinga.");

    const invite = data as InviteRow;

    if (invite.status && invite.status !== "pending" && invite.status !== "accepted") {
      throw new Error("Šis kvietimas nebegalioja.");
    }

    return invite;
  }

  async function findExistingUserIdByEmail(normalizedEmail: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) return null;

    return data?.id || null;
  }

  async function createMembership(invite: InviteRow, userId: string, normalizedEmail: string) {
    const response = await fetch("/api/invitations/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizedEmail,
        organizationId: invite.organization_id,
        role: invite.role || "employee",
        userId,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.error || "Nepavyko aktyvuoti narystės.");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      if (!token) {
        throw new Error("Registracija galima tik per darbovietės kvietimo nuorodą.");
      }

      const invite = await getInviteByToken(token);
      const normalizedEmail = normalizeEmail(email || invite.email || "");

      if (!normalizedEmail) {
        throw new Error("Įvesk el. paštą.");
      }

      if (invite.email && normalizeEmail(invite.email) !== normalizedEmail) {
        throw new Error(`Šis kvietimas skirtas el. paštui ${invite.email}.`);
      }

      if (!password || password.length < 6) {
        throw new Error("Slaptažodis turi būti bent 6 simbolių.");
      }

      let userId = await findExistingUserIdByEmail(normalizedEmail);

      if (!userId) {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              role: invite.role || "employee",
            },
          },
        });

        if (signUpError) throw signUpError;

        userId = authData.user?.id || null;
      }

      if (!userId) {
        throw new Error("Nepavyko nustatyti naudotojo paskyros.");
      }

      await createMembership(invite, userId, normalizedEmail);

      setMessage("Paskyra aktyvuota. Gali prisijungti.");
      router.replace("/login");
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-xl items-center justify-center">
        <section className="w-full rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm">
          <div className="mb-6">
            <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700">
              Darbovietės kvietimas
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Susikurk prisijungimą
            </h1>
            <p className="mt-2 font-semibold leading-6 text-slate-500">
              Registracija galima tik gavus kvietimą iš įstaigos. Įstaigos kodo pildyti nereikia.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold uppercase tracking-widest text-slate-500">
                El. paštas
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="vardas@pastas.lt"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:border-emerald-300 focus:bg-white"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-extrabold uppercase tracking-widest text-slate-500">
                Slaptažodis
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Bent 6 simboliai"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none transition focus:border-emerald-300 focus:bg-white"
                required
              />
            </label>

            {message ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 font-bold text-amber-800">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-slate-950 px-5 py-3 font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Aktyvuojama..." : "Aktyvuoti paskyrą"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
