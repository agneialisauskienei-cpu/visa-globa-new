'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { theme } from '@/lib/theme'

type Client = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  status: string | null
  created_at: string | null
  organization_id: string | null
}

type Profile = {
  id: string
  organization_id: string | null
}

export default function ClientsPage() {
  const router = useRouter()

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const loadClients = async () => {
      setLoading(true)
      setMessage('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        setMessage('Nepavyko užkrauti profilio informacijos.')
        setLoading(false)
        return
      }

      const typedProfile = profile as Profile

      if (!typedProfile.organization_id) {
        setMessage('Tavo paskyra dar nepriskirta jokiai įstaigai.')
        setLoading(false)
        return
      }

      setOrganizationId(typedProfile.organization_id)

      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email, phone, status, created_at, organization_id')
        .eq('organization_id', typedProfile.organization_id)
        .order('created_at', { ascending: false })

      if (error) {
        setMessage('Nepavyko užkrauti klientų sąrašo.')
        setLoading(false)
        return
      }

      setClients((data || []) as Client[])
      setLoading(false)
    }

    loadClients()
  }, [router])

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()

    if (!q) return clients

    return clients.filter((client) => {
      const values = [
        client.name || '',
        client.email || '',
        client.phone || '',
        client.status || '',
      ]
        .join(' ')
        .toLowerCase()

      return values.includes(q)
    })
  }, [clients, search])

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    if (!organizationId) {
      setMessage('Tavo paskyra dar nepriskirta jokiai įstaigai.')
      setSaving(false)
      return
    }

    const { data, error } = await supabase
      .from('clients')
      .insert([
        {
          name,
          email,
          phone,
          status: 'new',
          created_by: user.id,
          organization_id: organizationId,
        },
      ])
      .select('id, name, email, phone, status, created_at, organization_id')
      .single()

    if (error) {
      setMessage('Nepavyko pridėti kliento.')
      setSaving(false)
      return
    }

    setClients((prev) => [data as Client, ...prev])
    setName('')
    setEmail('')
    setPhone('')
    setMessage('Klientas sėkmingai pridėtas.')
    setSaving(false)
  }

  const updateStatus = async (id: string, newStatus: string) => {
    setMessage('')

    const { error } = await supabase
      .from('clients')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      setMessage('Nepavyko atnaujinti kliento statuso.')
      return
    }

    setClients((prev) =>
      prev.map((client) =>
        client.id === id ? { ...client, status: newStatus } : client
      )
    )

    setMessage('Kliento statusas atnaujintas.')
  }

  const totalClients = clients.length
  const newClients = clients.filter((c) => c.status === 'new').length
  const inProgressClients = clients.filter(
    (c) => c.status === 'in_progress'
  ).length
  const approvedClients = clients.filter((c) => c.status === 'approved').length

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
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 42,
                color: theme.colors.text,
              }}
            >
              Klientai
            </h1>

            <p
              style={{
                marginTop: 8,
                color: theme.colors.textSecondary,
                fontSize: 16,
              }}
            >
              Klientų valdymas, būsenos ir kontaktai.
            </p>
          </div>

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
            Grįžti į dashboard
          </button>
        </div>

        {message && (
          <p
            style={{
              marginBottom: 18,
              color:
                message.includes('sėkmingai') ||
                message.includes('atnaujintas')
                  ? theme.colors.success
                  : theme.colors.error,
              fontSize: 15,
            }}
          >
            {message}
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              backgroundColor: theme.colors.card,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 18,
              padding: 20,
              boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            }}
          >
            <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: 14 }}>
              Visi klientai
            </p>
            <h2 style={{ margin: '10px 0 0 0', color: theme.colors.text, fontSize: 30 }}>
              {totalClients}
            </h2>
          </div>

          <div
            style={{
              backgroundColor: theme.colors.card,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 18,
              padding: 20,
              boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            }}
          >
            <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: 14 }}>
              Nauji
            </p>
            <h2 style={{ margin: '10px 0 0 0', color: theme.colors.text, fontSize: 30 }}>
              {newClients}
            </h2>
          </div>

          <div
            style={{
              backgroundColor: theme.colors.card,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 18,
              padding: 20,
              boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            }}
          >
            <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: 14 }}>
              Procese
            </p>
            <h2 style={{ margin: '10px 0 0 0', color: theme.colors.text, fontSize: 30 }}>
              {inProgressClients}
            </h2>
          </div>

          <div
            style={{
              backgroundColor: theme.colors.card,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 18,
              padding: 20,
              boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            }}
          >
            <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: 14 }}>
              Patvirtinti
            </p>
            <h2 style={{ margin: '10px 0 0 0', color: theme.colors.text, fontSize: 30 }}>
              {approvedClients}
            </h2>
          </div>
        </div>

        <div
          style={{
            backgroundColor: theme.colors.card,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 20,
            padding: 20,
            boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            marginBottom: 24,
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
            Pridėti naują klientą
          </h2>

          <form
            onSubmit={handleAddClient}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            <input
              type="text"
              placeholder="Vardas ir pavardė"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                padding: 14,
                borderRadius: 12,
                border: `1px solid ${theme.colors.border}`,
                fontSize: 16,
                boxSizing: 'border-box',
                color: theme.colors.text,
                backgroundColor: theme.colors.card,
              }}
            />

            <input
              type="email"
              placeholder="El. paštas"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                padding: 14,
                borderRadius: 12,
                border: `1px solid ${theme.colors.border}`,
                fontSize: 16,
                boxSizing: 'border-box',
                color: theme.colors.text,
                backgroundColor: theme.colors.card,
              }}
            />

            <input
              type="text"
              placeholder="Telefono numeris"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              style={{
                padding: 14,
                borderRadius: 12,
                border: `1px solid ${theme.colors.border}`,
                fontSize: 16,
                boxSizing: 'border-box',
                color: theme.colors.text,
                backgroundColor: theme.colors.card,
              }}
            />

            <button
              type="submit"
              disabled={saving}
              style={{
                padding: 14,
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: theme.colors.primary,
                color: '#fff',
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              {saving ? 'Saugoma...' : 'Pridėti klientą'}
            </button>
          </form>
        </div>

        <div
          style={{
            backgroundColor: theme.colors.card,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 20,
            padding: 20,
            boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            marginBottom: 20,
          }}
        >
          <input
            type="text"
            placeholder="Ieškoti pagal vardą, el. paštą, telefoną ar statusą"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: 14,
              borderRadius: 12,
              border: `1px solid ${theme.colors.border}`,
              fontSize: 16,
              boxSizing: 'border-box',
              color: theme.colors.text,
              backgroundColor: theme.colors.card,
            }}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gap: 16,
          }}
        >
          {filteredClients.length === 0 ? (
            <div
              style={{
                backgroundColor: theme.colors.card,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 18,
                padding: 24,
                boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: theme.colors.textSecondary,
                  fontSize: 16,
                }}
              >
                Klientų nerasta.
              </p>
            </div>
          ) : (
            filteredClients.map((client) => (
              <div
                key={client.id}
                style={{
                  backgroundColor: theme.colors.card,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 18,
                  padding: 20,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 20,
                        fontWeight: 700,
                        color: theme.colors.text,
                      }}
                    >
                      {client.name || 'Be vardo'}
                    </p>

                    <p
                      style={{
                        marginTop: 8,
                        marginBottom: 0,
                        fontSize: 15,
                        color: theme.colors.textSecondary,
                        lineHeight: 1.7,
                      }}
                    >
                      <strong>El. paštas:</strong> {client.email || '-'}
                      <br />
                      <strong>Telefonas:</strong> {client.phone || '-'}
                      <br />
                      <strong>Statusas:</strong> {client.status || 'new'}
                    </p>
                  </div>

                  <select
                    value={client.status || 'new'}
                    onChange={(e) => updateStatus(client.id, e.target.value)}
                    style={{
                      minWidth: 180,
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: `1px solid ${theme.colors.border}`,
                      fontSize: 15,
                      backgroundColor: '#fff',
                      color: theme.colors.text,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="new">new</option>
                    <option value="in_progress">in_progress</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}