'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { theme } from '@/lib/theme'
import { getCurrentOrganization } from '@/lib/organization'

type Resident = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  created_at: string
}

type Room = {
  id: string
  name: string | null
  room_number: string | null
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
      error_description?: string
    }

    if (maybeError.message) return maybeError.message
    if (maybeError.details) return maybeError.details
    if (maybeError.hint) return maybeError.hint
    if (maybeError.error_description) return maybeError.error_description
    if (maybeError.code) return `Klaidos kodas: ${maybeError.code}`
  }

  return 'Nepavyko įvykdyti veiksmo.'
}

export default function RoomResidentsPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = Array.isArray(params.id) ? params.id[0] : params.id

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [residents, setResidents] = useState<Resident[]>([])

  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [creating, setCreating] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const loadResidents = async () => {
    if (!roomId || typeof roomId !== 'string') {
      setMessage('Nepavyko nustatyti kambario.')
      setLoading(false)
      return
    }

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

      if (!membership?.organization_id) {
        setMessage('Nepavyko nustatyti įstaigos.')
        setLoading(false)
        return
      }

      setOrganizationId(membership.organization_id)

      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, name, room_number')
        .eq('id', roomId)
        .eq('organization_id', membership.organization_id)
        .single()

      if (roomError || !roomData) {
        setMessage(
          roomError
            ? `Nepavyko užkrauti kambario: ${getReadableError(roomError)}`
            : 'Kambarys nerastas.'
        )
        setLoading(false)
        return
      }

      setRoom(roomData as Room)

      const { data, error } = await supabase
        .from('residents')
        .select('id, name, email, phone, created_at')
        .eq('room_id', roomId)
        .eq('organization_id', membership.organization_id)
        .order('created_at', { ascending: false })

      if (error) {
        setMessage(`Nepavyko užkrauti gyventojų: ${getReadableError(error)}`)
        setResidents([])
        setLoading(false)
        return
      }

      setResidents((data as Resident[]) || [])
    } catch (error) {
      console.error('Room residents load error:', error)
      setMessage(`Nepavyko užkrauti gyventojų: ${getReadableError(error)}`)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadResidents()
  }, [roomId])

  const handleAddResident = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setMessage('')

    if (!roomId || typeof roomId !== 'string') {
      setMessage('Nepavyko nustatyti kambario.')
      setCreating(false)
      return
    }

    if (!organizationId) {
      setMessage('Nepavyko nustatyti įstaigos.')
      setCreating(false)
      return
    }

    if (!newName.trim()) {
      setMessage('Įvesk gyventojo vardą.')
      setCreating(false)
      return
    }

    const { error } = await supabase.from('residents').insert({
      name: newName.trim(),
      email: newEmail.trim() || null,
      phone: newPhone.trim() || null,
      room_id: roomId,
      organization_id: organizationId,
    })

    if (error) {
      setMessage(`Nepavyko pridėti gyventojo: ${getReadableError(error)}`)
      setCreating(false)
      return
    }

    setNewName('')
    setNewEmail('')
    setNewPhone('')
    setCreating(false)
    setMessage('Gyventojas sėkmingai pridėtas.')

    await loadResidents()
  }

  const handleRemove = async (residentId: string) => {
    setRemovingId(residentId)
    setMessage('')

    const { error } = await supabase.from('residents').delete().eq('id', residentId)

    if (error) {
      setMessage(`Nepavyko pašalinti gyventojo: ${getReadableError(error)}`)
      setRemovingId(null)
      return
    }

    setResidents((prev) => prev.filter((item) => item.id !== residentId))
    setRemovingId(null)
    setMessage('Gyventojas pašalintas.')
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
          width: '100%',
          maxWidth: 1500,
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
              Gyventojai
            </h1>

            <p
              style={{
                marginTop: 8,
                color: theme.colors.textSecondary,
                fontSize: 16,
              }}
            >
              {room
                ? `Kambarys: ${room.room_number || room.name || room.id}`
                : 'Kambario gyventojų valdymas'}
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
              onClick={() => router.push('/rooms')}
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#07122f',
                color: '#fff',
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              Atgal į kambarius
            </button>

            <button
              onClick={() => router.push('/residents')}
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
              Visi gyventojai
            </button>
          </div>
        </div>

        {message && (
          <p
            style={{
              marginBottom: 18,
              color:
                message.includes('sėkmingai') || message.includes('pašalintas')
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
            gridTemplateColumns: 'minmax(360px, 420px) 1fr',
            gap: 24,
            alignItems: 'start',
          }}
        >
          <form
            onSubmit={handleAddResident}
            style={{
              backgroundColor: theme.colors.card,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
              position: 'sticky',
              top: 24,
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
              Pridėti gyventoją
            </h2>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  color: theme.colors.text,
                  fontWeight: 600,
                }}
              >
                Vardas
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Pvz. Jonas Jonaitis"
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

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  color: theme.colors.text,
                  fontWeight: 600,
                }}
              >
                El. paštas
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Pvz. vardas@pastas.lt"
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

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  color: theme.colors.text,
                  fontWeight: 600,
                }}
              >
                Telefonas
              </label>
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Pvz. +37060000000"
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

            <button
              type="submit"
              disabled={creating}
              style={{
                width: '100%',
                padding: '14px 18px',
                borderRadius: 12,
                border: 'none',
                cursor: creating ? 'not-allowed' : 'pointer',
                backgroundColor: theme.colors.link,
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? 'Pridedama...' : 'Pridėti gyventoją'}
            </button>
          </form>

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
              Gyventojų sąrašas
            </h2>

            {residents.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  color: theme.colors.textSecondary,
                  fontSize: 16,
                }}
              >
                Šiame kambaryje gyventojų dar nėra.
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gap: 16,
                }}
              >
                {residents.map((resident) => (
                  <div
                    key={resident.id}
                    style={{
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 16,
                      padding: 18,
                      backgroundColor: theme.colors.background,
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 16,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <p
                        style={{
                          margin: '0 0 10px 0',
                          color: theme.colors.text,
                          fontSize: 20,
                          fontWeight: 700,
                        }}
                      >
                        {resident.name || 'Be vardo'}
                      </p>

                      <p
                        style={{
                          margin: '0 0 6px 0',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        <strong>El. paštas:</strong> {resident.email || '-'}
                      </p>

                      <p
                        style={{
                          margin: '0 0 6px 0',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        <strong>Telefonas:</strong> {resident.phone || '-'}
                      </p>

                      <p
                        style={{
                          margin: 0,
                          color: theme.colors.textSecondary,
                        }}
                      >
                        <strong>Pridėtas:</strong>{' '}
                        {resident.created_at
                          ? new Date(resident.created_at).toLocaleString('lt-LT')
                          : '-'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(resident.id)}
                      disabled={removingId === resident.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 12,
                        border: `1px solid ${theme.colors.border}`,
                        cursor:
                          removingId === resident.id ? 'not-allowed' : 'pointer',
                        backgroundColor: theme.colors.card,
                        color: theme.colors.text,
                        fontWeight: 600,
                        fontSize: 15,
                        opacity: removingId === resident.id ? 0.7 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {removingId === resident.id
                        ? 'Šalinama...'
                        : 'Pašalinti'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}