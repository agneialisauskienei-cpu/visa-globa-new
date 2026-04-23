'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { theme } from '@/lib/theme'
import { getCurrentOrganization } from '@/lib/organization'

type OrganizationRole = 'owner' | 'admin' | 'employee'

type Client = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  status: string | null
  created_at: string
}

function getReadableError(error: unknown) {
  if (!error) return 'Nežinoma klaida.'

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object') {
    const maybeError = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    if (maybeError.message) return maybeError.message
    if (maybeError.details) return maybeError.details
    if (maybeError.hint) return maybeError.hint
    if (maybeError.code) return `Klaidos kodas: ${maybeError.code}`
  }

  return 'Nepavyko įvykdyti veiksmo.'
}

function getRoleLabel(role: OrganizationRole | null) {
  switch (role) {
    case 'owner':
      return 'Savininkas'
    case 'admin':
      return 'Administratorius'
    case 'employee':
      return 'Darbuotojas'
    default:
      return 'Nenustatyta'
  }
}

export default function ClientsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [organizationRole, setOrganizationRole] =
    useState<OrganizationRole | null>(null)
  const [clients, setClients] = useState<Client[]>([])

  useEffect(() => {
    const loadClients = async () => {
      setLoading(true)
      setMessage('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      try {
        const membership = await getCurrentOrganization(user.id)
        const role = membership.role as OrganizationRole
        const orgId = membership.organization_id

        setOrganizationRole(role)
        setOrganizationId(orgId)

        if (role === 'employee') {
          router.replace('/dashboard')
          return
        }

        const { data, error } = await supabase
          .from('clients')
          .select('id, name, email, phone, status, created_at')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Clients load error:', error)
          setMessage(getReadableError(error))
          setLoading(false)
          return
        }

        setClients((data as Client[]) || [])
      } catch (error) {
        console.error('Clients page error:', error)
        setMessage(getReadableError(error))
      }

      setLoading(false)
    }

    loadClients()
  }, [router])

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
            alignItems: 'flex-start',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 24,
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
              Klientai
            </h1>

            <p
              style={{
                marginTop: 8,
                fontSize: 16,
                color: theme.colors.textSecondary,
              }}
            >
              Čia rodomi tavo įstaigos klientai.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => router.push('/dashboard')}
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
              Grįžti į valdymo skydelį
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
            backgroundColor: theme.colors.card,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 20,
            padding: 24,
            boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            marginBottom: 24,
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
            Informacija
          </h2>

          <p style={{ color: theme.colors.textSecondary, fontSize: 16 }}>
            <strong>Tavo rolė:</strong> {getRoleLabel(organizationRole)}
          </p>

          <p style={{ color: theme.colors.textSecondary, fontSize: 16 }}>
            <strong>Įstaigos ID:</strong> {organizationId || '-'}
          </p>

          <p style={{ color: theme.colors.textSecondary, fontSize: 16 }}>
            <strong>Klientų kiekis:</strong> {clients.length}
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
              fontSize: 24,
            }}
          >
            Klientų sąrašas
          </h2>

          {clients.length === 0 ? (
            <p
              style={{
                margin: 0,
                color: theme.colors.textSecondary,
                fontSize: 16,
              }}
            >
              Klientų dar nėra.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 16,
              }}
            >
              {clients.map((client) => (
                <div
                  key={client.id}
                  style={{
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 16,
                    padding: 18,
                    backgroundColor: theme.colors.background,
                  }}
                >
                  <p
                    style={{
                      margin: '0 0 10px 0',
                      color: theme.colors.text,
                      fontSize: 20,
                      fontWeight: 700,
                    }}
                  >
                    {client.name || 'Be pavadinimo'}
                  </p>

                  <p style={{ margin: '0 0 6px 0', color: theme.colors.textSecondary }}>
                    <strong>El. paštas:</strong> {client.email || '-'}
                  </p>

                  <p style={{ margin: '0 0 6px 0', color: theme.colors.textSecondary }}>
                    <strong>Telefonas:</strong> {client.phone || '-'}
                  </p>

                  <p style={{ margin: '0 0 6px 0', color: theme.colors.textSecondary }}>
                    <strong>Būsena:</strong> {client.status || '-'}
                  </p>

                  <p style={{ margin: 0, color: theme.colors.textSecondary }}>
                    <strong>Sukurta:</strong>{' '}
                    {client.created_at
                      ? new Date(client.created_at).toLocaleString('lt-LT')
                      : '-'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}