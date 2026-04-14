'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { theme } from '@/lib/theme'

type UserProfile = {
  id: string
  email: string
  role: string
}

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [myId, setMyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadUsers = async () => {
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
        .select('role')
        .eq('id', user.id)
        .single()

      if (meError || me?.role !== 'super_admin') {
        router.push('/dashboard')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role')
        .order('created_at', { ascending: false })

      if (error) {
        setMessage('Nepavyko užkrauti vartotojų.')
        setLoading(false)
        return
      }

      setUsers(data || [])
      setLoading(false)
    }

    loadUsers()
  }, [router])

  const updateRole = async (id: string, newRole: string) => {
    setMessage('')

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', id)

    if (error) {
      setMessage('Nepavyko atnaujinti rolės.')
      return
    }

    setUsers((prev) =>
      prev.map((user) =>
        user.id === id ? { ...user, role: newRole } : user
      )
    )

    setMessage('Rolė sėkmingai atnaujinta.')
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

          <button
            onClick={() => router.push('/dashboard')}
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
            Grįžti į dashboard
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
            display: 'grid',
            gap: 16,
          }}
        >
          {users.map((user) => (
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
                    }}
                  >
                    {user.email}
                  </p>

                  <p
                    style={{
                      marginTop: 8,
                      marginBottom: 0,
                      fontSize: 15,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Dabartinė rolė: <strong>{user.role}</strong>
                    {user.id === myId ? ' (tu)' : ''}
                  </p>
                </div>

                <select
                  value={user.role}
                  onChange={(e) => updateRole(user.id, e.target.value)}
                  style={{
                    minWidth: 180,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: `1px solid ${theme.colors.border}`,
                    fontSize: 15,
                    backgroundColor: '#fff',
                    color: theme.colors.text,
                  }}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  <option value="super_admin">super_admin</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}