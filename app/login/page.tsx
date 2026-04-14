'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      router.push('/dashboard')
      return
    }

    setMessage('Prisijungti nepavyko')
    setLoading(false)
  }

  return (
    <div style={{ padding: 40, maxWidth: 400, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 20 }}>Prisijungimas</h1>

      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="El. paštas"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            display: 'block',
            width: '100%',
            marginBottom: 12,
            padding: 10,
          }}
        />

        <input
          type="password"
          placeholder="Slaptažodis"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            display: 'block',
            width: '100%',
            marginBottom: 12,
            padding: 10,
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 10,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Jungiamasi...' : 'Prisijungti'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: 12, color: 'red' }}>{message}</p>
      )}

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <p>
          Pamiršai slaptažodį?{' '}
          <a href="/reset-password">Atkurti</a>
        </p>

        <p style={{ marginTop: 8 }}>
          Neturi paskyros?{' '}
          <a href="/signup">Registruotis</a>
        </p>
      </div>
    </div>
  )
}