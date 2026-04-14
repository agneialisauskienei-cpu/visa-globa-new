'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { theme } from '@/lib/theme'

type Profile = {
  id: string
  email: string | null
  role: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true)
      setMessage('')

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      setEmail(user.email || '')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
        setMessage('Nepavyko užkrauti profilio informacijos.')
        setRole('nenustatyta')
        setLoading(false)
        return
      }

      const typedProfile = profile as Profile

      setRole(typedProfile?.role || 'nenustatyta')
      setLoading(false)
    }

    loadUser()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontSize: 20,
        }}
      >
        Kraunama...
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: theme.colors.background,
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 38,
                color: theme.colors.text,
              }}
            >
              Dashboard
            </h1>

            <p
              style={{
                marginTop: 8,
                color: theme.colors.textSecondary,
                fontSize: 16,
              }}
            >
              Sveika atvykusi į sistemą.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            {role === 'super_admin' && (
              <button
                onClick={() => router.push('/admin')}
                style={{
                  padding: '12px 18px',
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: theme.colors.link,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                Admin panel
              </button>
            )}

            <button
              onClick={() => router.push('/clients')}
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#0f172a',
                color: '#fff',
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              Klientai
            </button>

            <button
              onClick={handleLogout}
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: theme.colors.primary,
                color: '#fff',
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              Atsijungti
            </button>
          </div>
        </div>

        {message && (
          <p
            style={{
              marginBottom: 18,
              color: theme.colors.error,
              fontSize: 15,
            }}
          >
            {message}
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20,
          }}
        >
          <div
            style={{
              backgroundColor: theme.colors.card,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: 18,
                color: theme.colors.text,
                fontSize: 22,
              }}
            >
              Paskyros informacija
            </h2>

            <p style={{ color: theme.colors.textSecondary, fontSize: 16 }}>
              <strong>El. paštas:</strong> {email}
            </p>

            <p style={{ color: theme.colors.textSecondary, fontSize: 16 }}>
              <strong>Rolė:</strong> {role}
            </p>
          </div>

          <div
            style={{
              backgroundColor: theme.colors.card,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: 18,
                color: theme.colors.text,
                fontSize: 22,
              }}
            >
              Kitas žingsnis
            </h2>

            <p style={{ color: theme.colors.textSecondary, lineHeight: 1.7 }}>
              Čia vėliau galėsi pridėti klientų paraiškas, dokumentų įkėlimą,
              statusus ir admin valdymą.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}