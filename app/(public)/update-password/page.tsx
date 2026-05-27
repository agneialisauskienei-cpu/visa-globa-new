'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function UpdatePasswordPage() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showRepeatPassword, setShowRepeatPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setIsSuccess(false)

    if (password.length < 6) {
      setMessage('Slaptažodis turi būti bent 6 simbolių.')
      setLoading(false)
      return
    }

    if (password !== repeatPassword) {
      setMessage('Slaptažodžiai nesutampa.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setMessage('Nepavyko atnaujinti slaptažodžio. Atkūrimo nuoroda gali būti pasibaigusi.')
      setIsSuccess(false)
      setLoading(false)
      return
    }

    setMessage('Slaptažodis sėkmingai pakeistas. Nukreipiame į prisijungimą.')
    setIsSuccess(true)
    setLoading(false)

    window.setTimeout(() => {
      router.replace('/login')
      router.refresh()
    }, 1500)
  }

  return (
    <main className="min-h-screen bg-[#0b1f17] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_40px_120px_rgba(0,0,0,0.35)] lg:grid-cols-[1fr_0.95fr]">
          <div className="hidden bg-gradient-to-br from-[#0a372a] via-[#0f4f3d] to-[#176c43] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium">
                Naujas slaptažodis
              </div>

              <h1 className="mt-6 text-5xl font-black leading-tight">
                VisaGloba.
                <br />
                Sukurk naują
                <br />
                slaptažodį.
              </h1>

              <p className="mt-5 max-w-md text-base leading-7 text-emerald-50/85">
                Įvesk naują slaptažodį. Po išsaugojimo galėsi prisijungti į sistemą įprastai.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 text-sm text-emerald-50/85">
              Jei puslapis rodo klaidą, slaptažodžio atkūrimo nuoroda gali būti pasibaigusi — paprašyk naujos.
            </div>
          </div>

          <div className="p-8 md:p-10">
            <div className="mx-auto max-w-md">
              <div className="text-3xl font-black tracking-tight text-slate-900">
                Pakeisti slaptažodį
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Įvesk naują slaptažodį ir pakartok jį patvirtinimui.
              </p>

              <form onSubmit={handleUpdatePassword} className="mt-8 space-y-4">
                <PasswordField
                  label="Naujas slaptažodis"
                  value={password}
                  show={showPassword}
                  onChange={setPassword}
                  onToggle={() => setShowPassword((value) => !value)}
                />

                <PasswordField
                  label="Pakartok slaptažodį"
                  value={repeatPassword}
                  show={showRepeatPassword}
                  onChange={setRepeatPassword}
                  onToggle={() => setShowRepeatPassword((value) => !value)}
                />

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
                  {loading ? 'Saugoma...' : 'Išsaugoti naują slaptažodį'}
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

function PasswordField({
  label,
  value,
  show,
  onChange,
  onToggle,
}: {
  label: string
  value: string
  show: boolean
  onChange: (value: string) => void
  onToggle: () => void
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          required
          minLength={6}
          className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 pr-14 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
        />

        <button
          type="button"
          aria-label={show ? 'Slėpti slaptažodį' : 'Rodyti slaptažodį'}
          onClick={onToggle}
          className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          {show ? (
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
  )
}
