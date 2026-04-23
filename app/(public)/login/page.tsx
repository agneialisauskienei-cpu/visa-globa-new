'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationContext } from '@/lib/current-organization'

type MembershipRole = 'owner' | 'admin' | 'employee' | null

function getReadableError(message: string) {
  if (message === 'Email not confirmed') {
    return 'Patvirtink savo el. paštą prieš prisijungiant.'
  }

  if (message === 'Invalid login credentials') {
    return 'Neteisingas el. paštas arba slaptažodis.'
  }

  return 'Įvyko klaida. Bandyk dar kartą.'
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setMessage(getReadableError(error.message))
        setLoading(false)
        return
      }

      if (!data.user) {
        setMessage('Prisijungti nepavyko.')
        setLoading(false)
        return
      }

      const { organizationId, activeMembership } = await getCurrentOrganizationContext()

      const role = (activeMembership?.role || null) as MembershipRole

      if (!organizationId || !activeMembership) {
        router.replace('/pending-approval')
        router.refresh()
        return
      }

      if (role === 'owner' || role === 'admin') {
        router.replace('/admin-dashboard')
        router.refresh()
        return
      }

      router.replace('/employee-dashboard')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Įvyko klaida. Bandyk dar kartą.')
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
              Prisijungus būsi nukreipta į tavo rolę ir aktyvią organizaciją atitinkantį dashboardą.
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
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Slaptažodis
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                  />
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