'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function getReadableError(error: unknown) {
  if (!error) return 'Nežinoma klaida.'
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const maybe = error as { message?: string; details?: string; hint?: string; code?: string }
    if (maybe.message) return maybe.message
    if (maybe.details) return maybe.details
    if (maybe.hint) return maybe.hint
    if (maybe.code) return `Klaidos kodas: ${maybe.code}`
  }
  return 'Nepavyko įvykdyti veiksmo.'
}

export default function SignupPage() {
  const router = useRouter()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizationCode, setOrganizationCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const normalizedCode = organizationCode.trim().toUpperCase()

      if (!normalizedCode) {
        setMessage('Įvesk įstaigos kodą.')
        setSaving(false)
        return
      }

      const { data: organization, error: organizationError } = await supabase
        .from('organizations')
        .select('id, name, invite_code')
        .eq('invite_code', normalizedCode)
        .maybeSingle()

      if (organizationError) throw organizationError

      if (!organization) {
        setMessage('Neteisingas įstaigos kodas.')
        setSaving(false)
        return
      }

      const authRes = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })

      if (authRes.error) throw authRes.error

      const user = authRes.data.user

      if (!user) {
        setMessage('Nepavyko sukurti paskyros.')
        setSaving(false)
        return
      }

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        email: email.trim(),
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        full_name: [firstName, lastName].filter(Boolean).join(' ').trim() || null,
      })

      if (profileError) throw profileError

      const { error: requestError } = await supabase
        .from('organization_join_requests')
        .insert({
          organization_id: organization.id,
          user_id: user.id,
          email: email.trim(),
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          status: 'pending',
        })

      if (requestError) throw requestError

      router.replace('/pending-approval')
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.badge}>Registracija</div>
        <h1 style={styles.title}>Prisijungimas prie įstaigos</h1>
        <p style={styles.subtitle}>
          Įvesk savo duomenis ir įstaigos kodą. Po registracijos paskyrą turės patvirtinti administratorius.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Vardas"
            style={styles.input}
          />

          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Pavardė"
            style={styles.input}
          />

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="El. paštas"
            style={styles.input}
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Slaptažodis"
            style={styles.input}
            required
          />

          <input
            value={organizationCode}
            onChange={(e) => setOrganizationCode(e.target.value.toUpperCase())}
            placeholder="Įstaigos kodas"
            style={styles.input}
            required
          />

          {message ? <div style={styles.message}>{message}</div> : null}

          <button type="submit" disabled={saving} style={styles.button}>
            {saving ? 'Kuriama...' : 'Registruotis'}
          </button>
        </form>
      </section>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f4f6f4',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    background: '#fff',
    border: '1px solid #dde5de',
    borderRadius: 28,
    padding: 28,
    display: 'grid',
    gap: 16,
    boxShadow: '0 12px 28px rgba(48,68,55,0.05)',
  },
  badge: {
    display: 'inline-flex',
    width: 'fit-content',
    padding: '7px 12px',
    borderRadius: 999,
    background: '#eef4ef',
    color: '#587561',
    fontSize: 12,
    fontWeight: 900,
  },
  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 900,
    color: '#173120',
  },
  subtitle: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.6,
    color: '#64756a',
    fontWeight: 700,
  },
  form: {
    display: 'grid',
    gap: 12,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 14,
    border: '1px solid #d8e4da',
    padding: '12px 14px',
    fontSize: 14,
    outline: 'none',
  },
  message: {
    padding: '12px 14px',
    borderRadius: 14,
    background: '#fff8f6',
    border: '1px solid #f1d0c2',
    color: '#9a3412',
    fontWeight: 700,
  },
  button: {
    border: 'none',
    borderRadius: 14,
    background: '#587561',
    color: '#fff',
    padding: '12px 16px',
    fontWeight: 900,
    cursor: 'pointer',
  },
}