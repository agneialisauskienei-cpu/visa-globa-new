'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { theme } from '@/lib/theme'
import {
  getCurrentOrganization,
  getOrganizationProfile,
  updateOrganizationProfile,
  type OrganizationProfile,
} from '@/lib/organization'

type OrganizationRole = 'owner' | 'admin' | 'employee'

function getOrganizationRoleLabel(role: string | null) {
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

function getReadableError(error: unknown) {
  if (!error) return 'Nežinoma klaida.'

  if (error instanceof Error) return error.message

  if (typeof error === 'object') {
    const maybeError = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
      error?: string
      statusCode?: string | number
    }

    if (maybeError.message) return maybeError.message
    if (maybeError.details) return maybeError.details
    if (maybeError.hint) return maybeError.hint
    if (maybeError.error) return maybeError.error
    if (maybeError.code) return `Klaidos kodas: ${maybeError.code}`
    if (maybeError.statusCode) return `Statusas: ${maybeError.statusCode}`
  }

  return 'Nepavyko įvykdyti veiksmo.'
}

export default function OrganizationPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  const [organizationRole, setOrganizationRole] =
    useState<OrganizationRole | null>(null)
  const [organization, setOrganization] = useState<OrganizationProfile | null>(null)

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
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

      try {
        const membership = await getCurrentOrganization(user.id)
        setOrganizationRole(membership.role)

        const org = await getOrganizationProfile(user.id)
        setOrganization(org)

        setName(org.name || '')
        setCode(org.code || '')
        setAddress(org.address || '')
        setLogoUrl(org.logo_url || '')
      } catch (error) {
        console.error('Organization load error:', error)
        setMessage('Nepavyko užkrauti įstaigos profilio.')
      }

      setLoading(false)
    }

    loadPage()
  }, [router])

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    setMessage('')

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
      const safeExt = fileExt.replace(/[^a-z0-9]/g, '') || 'png'
      const filePath = `public/logo-${Date.now()}.${safeExt}`

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || undefined,
        })

      if (uploadError) {
        throw uploadError
      }

      const { data } = supabase.storage.from('logos').getPublicUrl(filePath)

      if (!data?.publicUrl) {
        throw new Error('Nepavyko gauti viešos logotipo nuorodos.')
      }

      setLogoUrl(data.publicUrl)
      setMessage('Logotipas sėkmingai įkeltas. Nepamiršk išsaugoti pakeitimų.')
    } catch (error) {
      console.error('Upload error:', error)
      setMessage(`Nepavyko įkelti logotipo: ${getReadableError(error)}`)
    }

    setUploading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
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

    try {
      const updated = await updateOrganizationProfile(user.id, {
        name,
        code,
        address,
        logo_url: logoUrl,
      })

      setOrganization(updated)
      setName(updated.name || '')
      setCode(updated.code || '')
      setAddress(updated.address || '')
      setLogoUrl(updated.logo_url || '')
      setMessage('Įstaigos profilis sėkmingai išsaugotas.')
    } catch (error) {
      console.error('Save error:', error)
      setMessage(getReadableError(error))
    }

    setSaving(false)
  }

  const canEdit =
    organizationRole === 'owner' || organizationRole === 'admin'

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
              Įstaigos profilis
            </h1>

            <p
              style={{
                marginTop: 8,
                color: theme.colors.textSecondary,
                fontSize: 16,
              }}
            >
              Čia gali tvarkyti savo įstaigos informaciją.
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
            Grįžti į valdymo skydelį
          </button>
        </div>

        {message && (
          <p
            style={{
              marginBottom: 18,
              color:
                message.includes('sėkmingai') ||
                message.includes('išsaugotas')
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
            marginBottom: 24,
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
              Informacija
            </h2>

            <p
              style={{
                color: theme.colors.textSecondary,
                fontSize: 16,
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              <strong>Įstaigos ID:</strong> {organization?.id || '-'}
              <br />
              <strong>Tavo rolė:</strong> {getOrganizationRoleLabel(organizationRole)}
              <br />
              <strong>Redagavimas:</strong>{' '}
              {canEdit ? 'Leidžiamas' : 'Neleidžiamas'}
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
              Logotipas
            </h2>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 18,
                flexWrap: 'wrap',
              }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Įstaigos logotipas"
                  style={{
                    width: 120,
                    height: 120,
                    objectFit: 'contain',
                    borderRadius: 16,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: '#fff',
                    padding: 8,
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 16,
                    border: `1px dashed ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: theme.colors.textSecondary,
                    fontSize: 14,
                    textAlign: 'center',
                    padding: 10,
                    boxSizing: 'border-box',
                  }}
                >
                  Nėra logotipo
                </div>
              )}

              {canEdit && (
                <div style={{ minWidth: 220 }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 10,
                      fontSize: 15,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Įkelti naują logotipą
                  </label>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileUpload(e.target.files[0])
                      }
                    }}
                    style={{
                      width: '100%',
                      fontSize: 14,
                      color: theme.colors.text,
                    }}
                  />

                  {uploading && (
                    <p
                      style={{
                        marginTop: 10,
                        marginBottom: 0,
                        color: theme.colors.textSecondary,
                      }}
                    >
                      Keliama...
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
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
            Redaguoti profilį
          </h2>

          {!canEdit ? (
            <p
              style={{
                margin: 0,
                color: theme.colors.textSecondary,
                fontSize: 16,
                lineHeight: 1.7,
              }}
            >
              Tu gali peržiūrėti įstaigos informaciją, bet redaguoti ją gali tik
              savininkas arba administratorius.
            </p>
          ) : (
            <form
              onSubmit={handleSave}
              style={{
                display: 'grid',
                gap: 16,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 16,
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 8,
                      color: theme.colors.text,
                      fontWeight: 600,
                      fontSize: 15,
                    }}
                  >
                    Įstaigos pavadinimas
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Pvz. Tremtinių namai"
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

                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 8,
                      color: theme.colors.text,
                      fontWeight: 600,
                      fontSize: 15,
                    }}
                  >
                    Įmonės kodas
                  </label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Pvz. 511212"
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
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    color: theme.colors.text,
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  Adresas
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Pvz. Meškeriotojų g. 22, Vilnius"
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
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="submit"
                  disabled={saving || uploading}
                  style={{
                    padding: '14px 22px',
                    borderRadius: 12,
                    border: 'none',
                    cursor:
                      saving || uploading ? 'not-allowed' : 'pointer',
                    opacity: saving || uploading ? 0.7 : 1,
                    backgroundColor: theme.colors.primary,
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 16,
                  }}
                >
                  {saving ? 'Saugoma...' : 'Išsaugoti'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}