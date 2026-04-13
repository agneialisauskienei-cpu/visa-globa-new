'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSignup = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    console.log('SIGNUP:', { data, error })

    if (error) {
      alert(error.message)
      return
    }

    if (!data.user) {
      alert('Nepavyko sukurti vartotojo')
      return
    }

    alert('Registracija sėkminga!')
    window.location.href = '/login'
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Registracija</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <br /><br />

      <input
        type="password"
        placeholder="Slaptažodis"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <br /><br />

      <button onClick={handleSignup}>Registruotis</button>
    </div>
  )
}