'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const handleRegister = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
      },
    })

    if (error) {
      setMessage('Klaida: ' + error.message)
    } else {
      setMessage('Patikrink el. paštą 📩')
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Registracija</h1>

      <input
        type="email"
        placeholder="Įvesk email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: 8, marginRight: 8 }}
      />

      <button onClick={handleRegister}>Registruotis</button>

      <p>{message}</p>

      <p style={{ marginTop: 16 }}>
        Jau turi paskyrą? <a href="/login">Prisijunk</a>
      </p>
    </div>
  )
}import LoginPage from './login/page'

export default function Home() {
  return <LoginPage />
}