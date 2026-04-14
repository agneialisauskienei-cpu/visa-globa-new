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
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f7f7f8',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          padding: 32,
          border: '1px solid #e5e7eb',
          borderRadius: 20,
          boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
          backgroundColor: '#ffffff',
        }}
      >
        <h1
          style={{
            marginBottom: 24,
            textAlign: 'center',
            fontSize: 42,
            fontWeight: 700,
          }}
        >
          Prisijungimas
        </h1>

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
              marginBottom: 14,
              padding: 16,
              borderRadius: 14,
              border: '1px solid #d1d5db',
              fontSize: 18,
              boxSizing: 'border-box',
              outline: 'none',
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
              marginBottom: 16,
              padding: 16,
              borderRadius: 14,
              border: '1px solid #d1d5db',
              fontSize: 18,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 16,
              borderRadius: 14,
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              fontWeight: 600,
              backgroundColor: '#111827',
              color: '#ffffff',
            }}
          >
            {loading ? 'Jungiamasi...' : 'Prisijungti'}
          </button>
        </form>

        {message && (
          <p
            style={{
              marginTop: 14,
              color: '#dc2626',
              textAlign: 'center',
              fontSize: 15,
            }}
          >
            {message}
          </p>
        )}

        <p
          style={{
            marginTop: 18,
            fontSize: 15,
            textAlign: 'center',
            color: '#4b5563',
            lineHeight: 1.6,
          }}
        >
          Jei ką tik registravaisi, patikrink savo el. paštą ir patvirtink
          paskyrą.
        </p>

        <div
          style={{
            marginTop: 22,
            textAlign: 'center',
            fontSize: 16,
            lineHeight: 1.9,
          }}
        >
          <p>
            Pamiršai slaptažodį?{' '}
            <a href="/reset-password" style={{ color: '#2563eb' }}>
              Atkurti
            </a>
          </p>

          <p>
            Neturi paskyros?{' '}
            <a href="/signup" style={{ color: '#2563eb' }}>
              Registruotis
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}