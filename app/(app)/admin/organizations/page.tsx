'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { theme } from '@/lib/theme'

type Organization = {
  id: string
  name: string
  company_code: string | null
  vat_code: string | null
  email: string | null
  phone: string | null
  address: string | null
  logo_url: string | null
  created_at: string | null
}

export default function AdminOrganizationsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [organizations, setOrganizations] = useState<Organization[]>([])

  const [name, setName] = useState('')
  const [companyCode, setCompanyCode] = useState('')
  const [vatCode, setVatCode] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    const loadPage = async () => {
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
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError || profile?.role !== 'super_admin') {
        router.push('/dashboard')
        return
      }

      const { data, error } = await supabase
        .from('organizations')
        .select(
          'id, name, company_code, vat_code, email, phone, address, logo_url, created_at'
        )
        .order('created_at', { ascending: false })

      if (error) {
        setMessage('Nepavyko užkrauti įstaigų sąrašo.')
        setLoading(false)
        return
      }

      setOrganizations((data || []) as Organization[])
      setLoading(false)
    }

    loadPage()
  }, [router])

  const handleCreateOrganization = async (e: React.FormEvent) => {
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

    const { data, error } = await supabase
      .from('organizations')
      .insert([
        {
          created_by: user.id,
          name,
          company_code: companyCode || null,
          vat_code: vatCode || null,
          email: email || null,
          phone: phone || null,
          address: address || null,
          logo_url: logoUrl || null,
        },
      ])
      .select(
        'id, name, company_code, vat_code, email, phone, address, logo_url, created_at'
      )
      .single()

    if (error) {
      setMessage('Nepavyko sukurti įstaigos.')
      setSaving(false)
      return
    }

    setOrganizations((prev) => [data as Organization, ...prev])

    setName('')
    setCompanyCode('')
    setVatCode('')
    setEmail('')
    setPhone('')
    setAddress('')
    setLogoUrl('')
    setMessage('Įstaiga sėkmingai sukurta.')
    setSaving(false)
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
              Įstaigos
            </h1>

            <p
              style={{
                marginTop: 8,
                color: theme.colors.textSecondary,
                fontSize: 16,
              }}
            >
              Super admin gali kurti ir valdyti įstaigas.
            </p>
          </div>

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
            Grįžti į admin
          </button>
        </div>

        {message && (
          <p
            style={{
              marginBottom: 18,
              color: message.includes('sėkmingai')
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
            Sukurti naują įstaigą
          </h2>

          <form
            onSubmit={handleCreateOrganization}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 14,
            }}
          >
            <input
              type="text"
              placeholder="Įstaigos pavadinimas"
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
              type="text"
              placeholder="Įmonės kodas"
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value)}
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
              placeholder="PVM kodas"
              value={vatCode}
              onChange={(e) => setVatCode(e.target.value)}
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
              placeholder="Telefonas"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
              placeholder="Adresas"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
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
              placeholder="Logotipo URL"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
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
              {saving ? 'Kuriama...' : 'Sukurti įstaigą'}
            </button>
          </form>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 16,
          }}
        >
          {organizations.length === 0 ? (
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
                Įstaigų dar nėra.
              </p>
            </div>
          ) : (
            organizations.map((organization) => (
              <div
                key={organization.id}
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
                    gap: 16,
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 22,
                        fontWeight: 700,
                        color: theme.colors.text,
                      }}
                    >
                      {organization.name}
                    </p>

                    <p
                      style={{
                        marginTop: 10,
                        marginBottom: 0,
                        color: theme.colors.textSecondary,
                        lineHeight: 1.8,
                        fontSize: 15,
                      }}
                    >
                      <strong>Įmonės kodas:</strong>{' '}
                      {organization.company_code || '-'}
                      <br />
                      <strong>PVM kodas:</strong> {organization.vat_code || '-'}
                      <br />
                      <strong>El. paštas:</strong> {organization.email || '-'}
                      <br />
                      <strong>Telefonas:</strong> {organization.phone || '-'}
                      <br />
                      <strong>Adresas:</strong> {organization.address || '-'}
                    </p>
                  </div>

                  {organization.logo_url ? (
                    <img
                      src={organization.logo_url}
                      alt={organization.name}
                      style={{
                        width: 90,
                        height: 90,
                        objectFit: 'contain',
                        borderRadius: 12,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: '#fff',
                        padding: 8,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 90,
                        height: 90,
                        borderRadius: 12,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: theme.colors.textSecondary,
                        fontSize: 13,
                        textAlign: 'center',
                        padding: 8,
                      }}
                    >
                      Nėra logo
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}