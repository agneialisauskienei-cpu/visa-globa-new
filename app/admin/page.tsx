'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { theme } from '@/lib/theme'

type UserProfile = {
  id: string
  email: string | null
  role: string | null
  created_at?: string | null
}

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [myId, setMyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState('')

  useEffect(() => {
    const loadAdminPage = async () => {
      setLoading(true)
      setMessage('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setMyId(user.id)

      const { data: me, error: meError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single()

      if (meError || me?.role !== 'super_admin') {
        router.push('/dashboard')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        setMessage('Nepavyko užkrauti vartotojų sąrašo.')
        setLoading(false)
        return
      }

      setUsers(data || [])
      setLoading(false)
    }

    loadAdminPage()
  }, [router])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return users

    return users.filter((user) => {
      const email = user.email?.toLowerCase() || ''
      const role = user.role?.toLowerCase() || ''
      return email.includes(query) || role.includes(query)
    })
  }, [users, search])

  const updateRole = async (id: string, newRole: string) => {
    setSavingId(id)
    setMessage('')

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', id)

    if (error) {
      setMessage('Nepavyko atnaujinti rolės.')
      setSavingId('')
      return
    }

    setUsers((prev) =>
      prev.map((user) =>
        user.id === id ? { ...user, role: newRole } : user
      )
    )

    setMessage('Rolė sėkmingai atnaujinta.')
    setSavingId('')
  }

  const totalUsers = users.length
  const totalAdmins = users.filter((u) => u.role === 'admin').length
  const totalSuperAdmins = users.filter((u) => u.role === 'super_admin').length

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
              Admin panel
            </h1>

            <p
              style={{
                marginTop: 8,
                color: theme.colors.textSecondary,
                fontSize: 16,
              }}
            >
              Vartotojų rolės ir prieigos valdymas.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
            <p
              style={{
                margin: 0,
                color: theme.colors.textSecondary,
                fontSize: 14,
              }}
            >
              Visi vartotojai
            </p>
            <h2
              style={{
                margin: '10px 0 0 0',
                color: theme.colors.text,
                fontSize: 30,
              }}
            >
              {totalUsers}
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
            <p
              style={{
                margin: 0,
                color: theme.colors.textSecondary,
                fontSize: 14,
              }}
            >
              Admin
            </p>
            <h2
              style={{
                margin: '10px 0 0 0',
                color: theme.colors.text,
                fontSize: 30,
              }}
            >
              {totalAdmins}
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
            <p
              style={{
                margin: 0,
                color: theme.colors.textSecondary,
                fontSize: 14,
              }}
            >
              Super admin
            </p>
            <h2
              style={{
                margin: '10px 0 0 0',
                color: theme.colors.text,
                fontSize: 30,
              }}
            >
              {totalSuperAdmins}
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
            marginBottom: 20,
          }}
        >
          <input
            type="text"
            placeholder="Ieškoti pagal el. paštą arba rolę"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: 14,
              borderRadius: 12,
              border: `1px solid ${theme.colors.border}`,
              fontSize: 16,
              boxSizing: 'border-box',
              outline: 'none',
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
          {filteredUsers.length === 0 ? (
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
                Vartotojų nerasta.
              </p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
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
                        fontSize: 18,
                        fontWeight: 700,
                        color: theme.colors.text,
                        wordBreak: 'break-word',
                      }}
                    >
                      {user.email || 'Be el. pašto'}
                    </p>

                    <p
                      style={{
                        marginTop: 8,
                        marginBottom: 0,
                        fontSize: 15,
                        color: theme.colors.textSecondary,
                      }}
                    >
                      Dabartinė rolė: <strong>{user.role || 'user'}</strong>
                      {user.id === myId ? ' (tu)' : ''}
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <select
                      value={user.role || 'user'}
                      onChange={(e) => updateRole(user.id, e.target.value)}
                      disabled={savingId === user.id}
                      style={{
                        minWidth: 190,
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: `1px solid ${theme.colors.border}`,
                        fontSize: 15,
                        backgroundColor: '#fff',
                        color: theme.colors.text,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>

                    {savingId === user.id && (
                      <span
                        style={{
                          fontSize: 14,
                          color: theme.colors.textSecondary,
                        }}
                      >
                        Saugoma...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}