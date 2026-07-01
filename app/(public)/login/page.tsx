'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, supabaseConfig } from '@/lib/supabase'
import { setStoredOrganizationId } from '@/lib/current-organization'

function getReadableError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('email not confirmed')) {
    return 'Patvirtink savo el. paštą prieš prisijungiant.'
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Neteisingas el. paštas arba slaptažodis.'
  }

  if (normalized.includes('invalid api key') || normalized.includes('apikey')) {
    return 'Prisijungimo konfigūracija neteisinga. Reikia patikrinti Supabase viešąjį raktą Vercel aplinkoje.'
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('fetch')
  ) {
    return 'Nepavyko pasiekti prisijungimo serverio. Patikrink Supabase adresą ir Vercel aplinkos kintamuosius.'
  }

  if (normalized.includes('too many requests') || normalized.includes('rate limit')) {
    return 'Per daug bandymų prisijungti. Palauk kelias minutes ir bandyk dar kartą.'
  }

  return `Prisijungti nepavyko: ${message}`
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const normalizedEmail = email.trim().toLowerCase()

      if (!supabaseConfig.hasUrl || !supabaseConfig.hasPublicKey || supabaseConfig.usesPlaceholder) {
        setMessage(
          'Prisijungimas nesukonfigūruotas: trūksta NEXT_PUBLIC_SUPABASE_URL arba NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
        )
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) {
        console.error('Login failed:', error)
        setMessage(getReadableError(error.message))
        setLoading(false)
        return
      }

      if (!data.user) {
        setMessage('Prisijungti nepavyko.')
        setLoading(false)
        return
      }

      // Membership tikrinam stabiliau: imam pirmą aktyvų įrašą, o ne tik maybeSingle scenarijų
      const { data: memberships, error: membershipError } = await supabase
        .from('organization_members')
        .select('organization_id, role, is_active, created_at')
        .eq('user_id', data.user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

      if (membershipError) {
        console.error('Login membership lookup failed:', membershipError)
        setMessage(`Prisijungta, bet nepavyko patikrinti organizacijos: ${membershipError.message}`)
        setLoading(false)
        return
      }

      const membership = memberships?.[0] || null
      const role = membership?.role || null

      if (!membership?.organization_id) {
        router.replace('/pending-approval')
        router.refresh()
        return
      }

      setStoredOrganizationId(membership.organization_id)

      if (role === 'owner' || role === 'admin') {
        router.replace('/dashboard')
        router.refresh()
        return
      }

      router.replace('/employee-dashboard')
      router.refresh()
    } catch (error) {
      console.error('Login unexpected error:', error)
      setMessage(error instanceof Error ? getReadableError(error.message) : 'Įvyko klaida. Bandyk dar kartą.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1f17] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_40px_120px_rgba(0,0,0,0.35)] lg:grid-cols-[1fr_0.95fr]">
          <div className="hidden bg-gradient-to-br from-[#0a372a] via-[#0f4f3d] to-[#176c43] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium">
                Prisijungimas
              </div>

              <h1 className="mt-6 text-5xl font-black leading-tight">
                VisaGloba.
                <br />
                Tęsk darbą
                <br />
                savo sistemoje.
              </h1>

              <p className="mt-5 max-w-md text-base leading-7 text-emerald-50/85">
                Prisijunk prie gyventojų, kambarių, darbuotojų ir užduočių valdymo vienoje vietoje.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 text-sm text-emerald-50/85">
              Prisijungus būsi nukreipta į tavo rolę atitinkantį dashboardą.
            </div>
          </div>

          <div className="p-8 md:p-10">
            <div className="mx-auto max-w-md">
              <div className="text-3xl font-black tracking-tight text-slate-900">
                Prisijungti
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Įvesk savo el. paštą ir slaptažodį.
              </p>

              <form onSubmit={handleLogin} className="mt-8 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    El. paštas
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vardas@imone.lt"
                    required
                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700">
                      Slaptažodis
                    </label>

                    <button
                      type="button"
                      onClick={() => router.push('/forgot-password')}
                      className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800"
                    >
                      Pamiršai slaptažodį?
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 pr-14 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                    />

                    <button
                      type="button"
                      aria-label={showPassword ? 'Slėpti slaptažodį' : 'Rodyti slaptažodį'}
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.89 1 12a13.16 13.16 0 0 1 4.22-5.74" />
                          <path d="M9.9 4.24A10.84 10.84 0 0 1 12 4c5 0 9.27 3.11 11 8a13.18 13.18 0 0 1-2.9 4.33" />
                          <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                          <path d="M1 1l22 22" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {message ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#0f4f3d] px-5 py-4 text-base font-semibold text-white transition hover:bg-[#0c4333] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Jungiama...' : 'Prisijungti'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
