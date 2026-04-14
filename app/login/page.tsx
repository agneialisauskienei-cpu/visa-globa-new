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
      if (error.message === 'Email not confirmed') {
        setMessage('Patvirtink savo el. paštą prieš prisijungiant.')
      } else if (error.message === 'Invalid login credentials') {
        setMessage('Neteisingas el. paštas arba slaptažodis.')
      } else {
        setMessage('Įvyko klaida. Bandyk dar kartą.')
      }

      setLoading(false)
      return
    }

    if (data.user) {
      router.push('/dashboard')
      return
    }

    setMessage('Prisijungti nepavyko.')
    setLoading(false)
  }

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '60px auto',
        padding: 24,
        border: '1px solid #e5e5e5',
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        backgroundColor: '#fff',
      }}
    >
      <h1 style={{ marginBottom: 20, textAlign: 'center' }}>Prisijungimas</h1>

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
            padding: 12,
            borderRadius: 8,
            border: '1px solid #ccc',
            fontSize: 16,
            boxSizing: 'border-box',
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
            padding: 12,
            borderRadius: 8,
            border: '1px solid #ccc',
            fontSize: 16,
            boxSizing: 'border-box',
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          {loading ? 'Jungiamasi...' : 'Prisijungti'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: 14, color: 'red', textAlign: 'center' }}>
          {message}
        </p>
      )}

      <p style={{ marginTop: 16, fontSize: 14, textAlign: 'center' }}>
        Jei ką tik registravaisi, patikrink savo el. paštą ir patvirtink paskyrą.
      </p>

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <p>
          Pamiršai slaptažodį? <a href="/reset-password">Atkurti</a>
        </p>

        <p style={{ marginTop: 8 }}>
          Neturi paskyros? <a href="/signup">Registruotis</a>
        </p>
      </div>
    </div>
  )
}