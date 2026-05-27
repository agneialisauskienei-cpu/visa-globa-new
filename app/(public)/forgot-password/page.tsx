'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()

    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: 'https://visagloba.lt/update-password',
      }
    )

    if (error) {
      setMessage('Nepavyko išsiųsti atkūrimo laiško.')
      setLoading(false)
      return
    }

    setMessage('Slaptažodžio atkūrimo nuoroda išsiųsta į el. paštą.')
    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1f17] px-6">
      <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
        <h1 className="text-3xl font-black text-slate-900">
          Pamiršai slaptažodį?
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          Įvesk savo el. paštą ir atsiųsime slaptažodžio atkūrimo nuorodą.
        </p>

        <form onSubmit={handleReset} className="mt-6 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vardas@imone.lt"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 outline-none focus:border-emerald-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-emerald-700 px-5 py-4 font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {loading
              ? 'Siunčiama...'
              : 'Siųsti atkūrimo nuorodą'}
          </button>
        </form>

        {message ? (
          <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}
      </div>
    </main>
  )
}