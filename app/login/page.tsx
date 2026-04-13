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
    <div style={{ padding: 40, maxWidth: 420 }}>
      <h1>Prisijungimas</h1>

      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="El. paštas"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        />

        <input
          type="password"
          placeholder="Slaptažodis"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Jungiamasi...' : 'Prisijungti'}
        </button>
      </form>

      {message && <p>{message}</p>}

      <p>
        Pamiršai slaptažodį? <a href="/reset-password">Atkurti</a>
      </p>
    </div>
  )
}