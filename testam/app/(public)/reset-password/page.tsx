'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { theme } from '@/lib/theme'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== 'undefined'
          ? `${window.location.origin}/update-password`
          : undefined,
    })

    if (error) {
      setMessage('Nepavyko išsiųsti atkūrimo nuorodos.')
      setLoading(false)
      return
    }

    setMessage('Patikrink savo el. paštą. Išsiuntėme atkūrimo nuorodą.')
    setLoading(false)
    setEmail('')
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
            fontSize: 36,
            fontWeight: 700,
            color: theme.colors.text,
          }}
        >
          Slaptažodžio atkūrimas
        </h1>

        <form onSubmit={handleReset}>
          <input
            type="email"
            placeholder="El. paštas"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            {loading ? 'Siunčiama...' : 'Siųsti nuorodą'}
          </button>
        </form>

        {message && (
          <p
            style={{
              marginTop: 14,
              color: message.includes('Patikrink')
                ? theme.colors.success
                : theme.colors.error,
              textAlign: 'center',
              fontSize: 15,
              lineHeight: 1.6,
            }}
          >
            {message}
          </p>
        )}

        <div style={{ marginTop: 22, textAlign: 'center', fontSize: 16 }}>
          <Link href="/login" style={{ color: theme.colors.link }}>
            Grįžti į prisijungimą
          </Link>
        </div>
      </div>
    </div>
  )
}