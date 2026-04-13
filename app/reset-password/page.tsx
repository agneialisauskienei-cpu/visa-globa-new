'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:3000/update-password',
    })

    if (error) {
      setMessage('Klaida: ' + error.message)
    } else {
      setMessage('Patikrink el. paštą 🔑')
    }

    setLoading(false)
  }

  return (
    <div style={{ padding: 40, maxWidth: 420 }}>
      <h1>Atkurti slaptažodį</h1>

      <form onSubmit={handleReset} style={{ display: 'grid', gap: 12 }}>
        <input
          type="email"
          placeholder="El. paštas"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 12 }}
        />

        <button type="submit" disabled={loading} style={{ padding: 12 }}>
          {loading ? 'Siunčiama...' : 'Siųsti nuorodą'}
        </button>
      </form>

      {message && <p style={{ marginTop: 16 }}>{message}</p>}
    </div>
  )
}