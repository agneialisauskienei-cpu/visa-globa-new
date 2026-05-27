'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function getSiteUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://visagloba.lt'
}

export default function ForgotPasswordPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setIsSuccess(false)

    const normalizedEmail = email.trim().toLowerCase()

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${getSiteUrl()}/update-password`,
    })

    if (error) {
      setMessage('Nepavyko išsiųsti atkūrimo nuorodos. Patikrink el. paštą ir bandyk dar kartą.')
      setIsSuccess(false)
      setLoading(false)
      return
    }

    setMessage('Patikrink el. paštą. Išsiuntėme slaptažodžio atkūrimo nuorodą.')
    setIsSuccess(true)
    setLoading(false)
    setEmail('')
  }

  return (
    <main className="min-h-screen bg-[#0b1f17] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_40px_120px_rgba(0,0,0,0.35)] lg:grid-cols-[1fr_0.95fr]">
          <div className="hidden bg-gradient-to-br from-[#0a372a] via-[#0f4f3d] to-[#176c43] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium">
                Slaptažodžio atkūrimas
              </div>

              <h1 className="mt-6 text-5xl font-black leading-tight">
                VisaGloba.
                <br />
                Atkurk
                <br />
                prisijungimą.
              </h1>

              <p className="mt-5 max-w-md text-base leading-7 text-emerald-50/85">
                Įvesk el. paštą ir gausi saugią nuorodą naujam slaptažodžiui nustatyti.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 text-sm text-emerald-50/85">
              Nuoroda galioja ribotą laiką. Jei laiško nematai, patikrink ir Spam / Promotions aplankus.
            </div>
          </div>

          <div className="p-8 md:p-10">
            <div className="mx-auto max-w-md">
              <div className="text-3xl font-black tracking-tight text-slate-900">
                Pamiršai slaptažodį?
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Įvesk savo el. paštą. Atsiųsime nuorodą, kuri nuves į naujo slaptažodžio sukūrimo puslapį.
              </p>

              <form onSubmit={handleReset} className="mt-8 space-y-4">
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

                {message ? (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                      isSuccess
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    {message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#0f4f3d] px-5 py-4 text-base font-semibold text-white transition hover:bg-[#0c4333] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Siunčiama...' : 'Siųsti atkūrimo nuorodą'}
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Grįžti į prisijungimą
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
