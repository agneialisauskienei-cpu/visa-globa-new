'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { theme } from '@/lib/theme'

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
        backgroundColor: theme.colors.background,
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          padding: 32,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 20,
          boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
          backgroundColor: theme.colors.card,
        }}
      >
        <h1
          style={{
            marginBottom: 24,
            textAlign: 'center',
            fontSize: 42,
            fontWeight: 700,
            color: theme.colors.text,
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
              border: `1px solid ${theme.colors.border}`,
              fontSize: 18,
              boxSizing: 'border-box',
              outline: 'none',
              color: theme.colors.text,
              backgroundColor: theme.colors.card,
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
              border: `1px solid ${theme.colors.border}`,
              fontSize: 18,
              boxSizing: 'border-box',
              outline: 'none',
              color: theme.colors.text,
              backgroundColor: theme.colors.card,
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
              backgroundColor: theme.colors.primary,
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
              color: theme.colors.error,
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
            color: theme.colors.textSecondary,
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
            color: theme.colors.text,
          }}
        >
          <p>
            Pamiršai slaptažodį?{' '}
            <a href="/reset-password" style={{ color: theme.colors.link }}>
              Atkurti
            </a>
          </p>

          <p>
            Neturi paskyros?{' '}
            <a href="/signup" style={{ color: theme.colors.link }}>
              Registruotis
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}