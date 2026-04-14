'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { theme } from '@/lib/theme'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setMessage('Nepavyko atnaujinti slaptažodžio.')
      setLoading(false)
      return
    }

    setMessage('Slaptažodis sėkmingai pakeistas.')
    setLoading(false)

    setTimeout(() => {
      router.push('/login')
    }, 1500)
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
          Naujas slaptažodis
        </h1>

        <form onSubmit={handleUpdatePassword}>
          <input
            type="password"
            placeholder="Naujas slaptažodis"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
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
            {loading ? 'Saugoma...' : 'Išsaugoti'}
          </button>
        </form>

        {message && (
          <p
            style={{
              marginTop: 14,
              color: message.includes('sėkmingai')
                ? theme.colors.success
                : theme.colors.error,
              textAlign: 'center',
              fontSize: 15,
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  )
}