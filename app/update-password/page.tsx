'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('Tikrinama sesija...')
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()

      if (data.session) {
        setReady(true)
        setMessage('')
      } else {
        setReady(false)
        setMessage('Sesija nerasta. Atidaryk naują nuorodą iš el. laiško.')
      }
    }

    checkSession()
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()

    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      setMessage('Sesija nerasta. Atidaryk naują nuorodą iš el. laiško.')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setMessage('Klaida: ' + error.message)
      setLoading(false)
      return
    }

    router.replace('/login')
  }

  return (
    <div style={{ padding: 40, maxWidth: 420 }}>
      <h1>Naujas slaptažodis</h1>

      <form onSubmit={handleUpdate} style={{ display: 'grid', gap: 12 }}>
        <input
          type="password"
          placeholder="Naujas slaptažodis"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 12 }}
        />

        <button type="submit" disabled={!ready || loading} style={{ padding: 12 }}>
          {loading ? 'Saugoma...' : 'Išsaugoti'}
        </button>
      </form>

      {message && <p style={{ marginTop: 16 }}>{message}</p>}
    </div>
  )
}