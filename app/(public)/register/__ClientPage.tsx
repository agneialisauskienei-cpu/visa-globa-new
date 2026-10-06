"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setStoredOrganizationId } from "@/lib/current-organization";

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

  async function createMembership(accessToken: string) {
    const response = await fetch("/api/invitations/approve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        inviteToken: token,
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

      if (!password || password.length < 8) {
        throw new Error("Slaptažodis turi būti bent 8 simbolių.");
      }

      const {
        data: { session: existingSession },
      } = await supabase.auth.getSession();
      let accessToken = existingSession?.access_token || "";
      let sessionEmail = normalizeEmail(existingSession?.user.email || "");

      if (accessToken && sessionEmail === normalizedEmail) {
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) throw passwordError;
      } else {
        const existingUserId = await findExistingUserIdByEmail(normalizedEmail);

        if (existingUserId) {
          const { data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            });
          if (signInError) throw signInError;
          accessToken = signInData.session?.access_token || "";
          sessionEmail = normalizeEmail(signInData.user?.email || "");
        } else {
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
          accessToken = authData.session?.access_token || "";
          sessionEmail = normalizeEmail(authData.user?.email || "");
        }
      }

      if (!accessToken || sessionEmail !== normalizedEmail) {
        throw new Error(
          "Patvirtinkite el. paštą ir dar kartą atidarykite kvietimo nuorodą.",
        );
      }

      await createMembership(accessToken);

      setStoredOrganizationId(invite.organization_id);

      setMessage("Paskyra aktyvuota.");
      router.replace(invite.role === "admin" ? "/dashboard" : "/employee-dashboard");
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7faf8] px-4 py-6 text-[#10251f] sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-[1180px] items-center gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative hidden min-h-[620px] overflow-hidden rounded-[22px] border border-[#dbe6e0] bg-[#486b5d] shadow-[0_22px_60px_rgba(16,37,31,0.12)] lg:block">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,37,31,.95),rgba(72,107,93,.86)),radial-gradient(circle_at_20%_20%,rgba(216,248,231,.25),transparent_34%)]" />
          <div className="relative z-10 flex min-h-[620px] flex-col justify-between px-10 py-10 text-white">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-white/70">
                VisaGloba
              </p>
              <h1 className="mt-5 max-w-md text-5xl font-black leading-tight">
                Kvietimo paskyra darbui sistemoje.
              </h1>
              <p className="mt-5 max-w-md text-base font-semibold leading-7 text-white/78">
                Prisijungimą galima susikurti tik gavus įstaigos kvietimo nuorodą.
              </p>
            </div>

            <div className="rounded-[18px] border border-white/15 bg-white/10 p-5 text-sm font-semibold leading-6 text-white/80">
              Jei nuoroda nebegalioja, administratorius gali išsiųsti naują kvietimą iš darbuotojų modulio.
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[540px] rounded-[22px] border border-[#dbe6e0] bg-white p-7 shadow-[0_16px_44px_rgba(16,37,31,0.10)] sm:p-9">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#486b5d]">
              Darbovietės kvietimas
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#10251f]">
              Susikurk prisijungimą
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#6a7e75]">
              Įvesk kvietime nurodytą el. paštą ir susikurk slaptažodį. Įstaigos kodo pildyti nereikia.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-[#6a7e75]">
                El. paštas
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="vardas@pastas.lt"
                className="h-[52px] w-full rounded-[14px] border border-[#c9d8d0] bg-[#fbfdfb] px-4 text-base font-bold text-[#10251f] outline-none transition focus:border-[#8fdcb1] focus:bg-white"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-[#6a7e75]">
                Slaptažodis
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Bent 8 simboliai"
                className="h-[52px] w-full rounded-[14px] border border-[#c9d8d0] bg-[#fbfdfb] px-4 text-base font-bold text-[#10251f] outline-none transition focus:border-[#8fdcb1] focus:bg-white"
                required
                minLength={8}
              />
            </label>

            {message ? (
              <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-800">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="h-[52px] w-full rounded-[14px] bg-[#486b5d] px-5 text-base font-black text-white transition hover:bg-[#39594c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Aktyvuojama..." : "Aktyvuoti paskyrą"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/login")}
              className="h-[52px] w-full rounded-[14px] border border-[#dbe6e0] bg-white px-5 text-base font-black text-[#486b5d] transition hover:bg-[#f7fcf9]"
            >
              Grįžti į prisijungimą
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
