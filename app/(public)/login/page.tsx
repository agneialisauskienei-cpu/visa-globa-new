'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { supabase, supabaseConfig } from '@/lib/supabase'
import { setStoredOrganizationId } from '@/lib/current-organization'
import { isLoginServiceIncident, reportSystemIncident } from '@/lib/system-incidents'

function getPublicLoginError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('email not confirmed')) {
    return 'Patvirtink savo el. paštą prieš prisijungiant.'
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Neteisingas el. paštas arba slaptažodis.'
  }

  if (
    normalized.includes('invalid api key') ||
    normalized.includes('apikey') ||
    normalized.includes('missing configuration')
  ) {
    return 'Prisijungimo paslauga laikinai nepasiekiama. Bandyk dar kartą vėliau arba kreipkis į administratorių.'
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('fetch')
  ) {
    return 'Nepavyko prisijungti prie sistemos. Patikrink interneto ryšį ir bandyk dar kartą.'
  }

  if (normalized.includes('too many requests') || normalized.includes('rate limit')) {
    return 'Per daug bandymų prisijungti. Palauk kelias minutes ir bandyk dar kartą.'
  }

  return 'Prisijungti nepavyko. Patikrink duomenis ir bandyk dar kartą.'
}

function getReadableError(message: string) {
  return getPublicLoginError(message)
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
        console.error('Login configuration is missing public Supabase values:', supabaseConfig)
        reportSystemIncident({
          type: 'auth_configuration_unavailable',
          source: 'login',
          path: '/login',
        })
        setMessage(getPublicLoginError('missing configuration'))
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) {
        console.error('Login failed:', error)
        if (isLoginServiceIncident(error.message)) {
          reportSystemIncident({
            type: 'auth_service_unavailable',
            source: 'login',
            path: '/login',
          })
        }
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
        reportSystemIncident({
          type: 'membership_check_failed',
          source: 'login',
          path: '/login',
        })
        setMessage('Prisijungimas pavyko, bet nepavyko patikrinti paskyros teisių. Bandyk dar kartą arba kreipkis į administratorių.')
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
      reportSystemIncident({
        type: 'login_unexpected_error',
        source: 'login',
        path: '/login',
      })
      setMessage(error instanceof Error ? getReadableError(error.message) : 'Įvyko klaida. Bandyk dar kartą.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7faf8] px-4 py-6 text-[#10251f] sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-[1280px] items-center gap-6 lg:grid-cols-[1.04fr_0.96fr]">
        <section className="relative hidden min-h-[680px] overflow-hidden rounded-[22px] border border-[#dbe6e0] bg-[#e9f1ed] shadow-[0_22px_60px_rgba(16,37,31,0.12)] lg:block">
          <div
            className="absolute inset-0 bg-cover bg-[center_38%]"
            style={{
              backgroundImage:
                'linear-gradient(90deg, rgba(0,60,46,.84) 0%, rgba(0,60,46,.58) 38%, rgba(0,60,46,.16) 72%, rgba(0,60,46,.08) 100%), linear-gradient(180deg, rgba(0,60,46,.06), rgba(0,60,46,.22)), url("https://assets.carescout.com/5760x3840/9e5d91ecad/older-adult-and-caregiver-smiling-at-each-other.jpeg/m/1600x0")',
            }}
          />

          <div className="relative z-10 flex min-h-[680px] max-w-[560px] flex-col justify-center px-12 py-12 text-white">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="mb-8 inline-flex w-fit items-center gap-3 text-2xl font-black"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-white/25 bg-white/15">
                <Heart className="h-5 w-5" />
              </span>
              VisaGloba
            </button>

            <p className="text-xs font-black uppercase tracking-[0.28em] text-white/80">
              Prisijungimas
            </p>
            <h1 className="mt-4 text-[52px] font-black leading-[1.04] tracking-normal">
              Tęskite darbą savo sistemoje.
            </h1>
            <p className="mt-5 max-w-[520px] text-lg font-bold leading-8 text-white/90">
              Gyventojai, pamainos, užduotys ir pranešimai laukia vienoje
              aiškioje darbo vietoje.
            </p>

            <div className="mt-8 h-0.5 w-16 rounded-full bg-[#c9d8d0]" />
            <p className="mt-6 max-w-[520px] rounded-[16px] border border-white/20 bg-white/10 p-4 text-sm font-extrabold leading-6 text-white/90">
              Prisijungus sistema automatiškai atidarys jūsų rolei skirtą
              darbalaukį.
            </p>
          </div>
        </section>

        <section className="rounded-[22px] border border-[#dbe6e0] bg-white p-6 shadow-[0_18px_52px_rgba(16,37,31,0.08)] sm:p-8 lg:p-10">
          <div className="mx-auto max-w-md">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="mb-10 flex w-fit items-center gap-4 text-2xl font-black text-[#10251f] sm:text-3xl lg:hidden"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#003c2e] text-white">
                <Heart className="h-5 w-5" />
              </span>
              VisaGloba
            </button>

            <h1 className="text-[36px] font-black leading-tight tracking-normal text-[#10251f] sm:text-[44px]">
              Prisijungti
            </h1>
            <p className="mt-3 text-base font-bold leading-7 text-[#64786f]">
              Įveskite savo el. paštą ir slaptažodį.
            </p>

              <form onSubmit={handleLogin} className="mt-8 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-black text-[#39594c]">
                    El. paštas
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vardas@imone.lt"
                    required
                    className="block w-full rounded-[14px] border border-[#c9d8d0] bg-[#f9fbfa] px-4 py-4 text-base font-semibold text-[#10251f] outline-none transition placeholder:text-[#8a9b93] focus:border-[#486b5d] focus:bg-white"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-black text-[#39594c]">
                      Slaptažodis
                    </label>

                    <button
                      type="button"
                      onClick={() => router.push('/forgot-password')}
                      className="text-sm font-black text-[#486b5d] transition hover:text-[#39594c]"
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
                      className="block w-full rounded-[14px] border border-[#c9d8d0] bg-[#f9fbfa] px-4 py-4 pr-14 text-base font-semibold text-[#10251f] outline-none transition placeholder:text-[#8a9b93] focus:border-[#486b5d] focus:bg-white"
                    />

                    <button
                      type="button"
                      aria-label={showPassword ? 'Slėpti slaptažodį' : 'Rodyti slaptažodį'}
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#64786f] transition hover:bg-[#edf7f2] hover:text-[#486b5d]"
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
                  <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                    {message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-[12px] bg-[#486b5d] px-5 text-base font-black text-white transition hover:bg-[#39594c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Jungiama...' : 'Prisijungti'}
                </button>
              </form>
            </div>
        </section>
      </div>
    </main>
  )
}
