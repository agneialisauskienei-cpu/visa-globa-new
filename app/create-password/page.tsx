'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function CreatePasswordPage() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('Tikrinama sesija...')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()

      if (data.session) {
        setMessage('')
        setReady(true)
      } else {
        setMessage('Sesija nerasta. Atidaryk naują nuorodą iš el. laiško.')
      }
    }

    checkSession()
  }, [])

  const handleSavePassword = async () => {
    const { data } = await supabase.auth.getSession()

    if (!data.session) {
      setMessage('Sesija nerasta. Atidaryk naują nuorodą iš el. laiško.')
      return
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage('Klaida: ' + error.message)
      return
    }

    window.location.href = '/success'
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Sukurti slaptažodį</h1>

      <input
        type="password"
        placeholder="Naujas slaptažodis"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ padding: 8, marginRight: 8 }}
      />

      <button onClick={handleSavePassword} disabled={!ready}>
        Išsaugoti slaptažodį
      </button>

      <p>{message}</p>
    </div>
  )
}