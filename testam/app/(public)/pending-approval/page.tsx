'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PendingApprovalPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      setEmail(user.email || '')
    }

    load()
  }, [router])

  useEffect(() => {
    const interval = setInterval(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      const typedMembership =
        (membership as { role: 'owner' | 'admin' | 'employee' } | null) || null

      if (typedMembership?.role === 'owner' || typedMembership?.role === 'admin') {
        window.location.href = '/admin-dashboard'
        return
      }

      if (typedMembership?.role === 'employee') {
        window.location.href = '/employee-dashboard'
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.badge}>Laukiama patvirtinimo</div>
        <h1 style={styles.title}>Paskyra dar neaktyvuota</h1>
        <p style={styles.subtitle}>
          Administratorius dar turi patvirtinti, kad tikrai esi įstaigos darbuotojas.
        </p>

        <div style={styles.infoBox}>
          <div style={styles.infoLabel}>Registruotas el. paštas</div>
          <div style={styles.infoValue}>{email || '—'}</div>
        </div>

        <div style={styles.note}>
          Kol paskyra nepatvirtinta, vidinių sistemos puslapių nematysi. Kai administratorius
          patvirtins paskyrą, būsi automatiškai nukreiptas į savo darbo aplinką.
        </div>

        <button onClick={handleLogout} style={styles.button}>
          Atsijungti
        </button>
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
    maxWidth: 560,
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
    fontSize: 30,
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
  infoBox: {
    borderRadius: 18,
    border: '1px solid #e3ebe4',
    background: '#fafcfb',
    padding: 16,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: '#6b7c71',
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 900,
    color: '#1f3128',
  },
  note: {
    color: '#607066',
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  button: {
    border: 'none',
    borderRadius: 14,
    background: '#587561',
    color: '#fff',
    padding: '12px 16px',
    fontWeight: 900,
    cursor: 'pointer',
    width: 'fit-content',
  },
}