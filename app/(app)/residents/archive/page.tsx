'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ResidentsArchivePage() {
  const [residents, setResidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('residents')
      .select('*')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })

    setResidents(data || [])
    setLoading(false)
  }

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ padding: 24 }}>
      <h1>Archyvas</h1>

      <Link href="/residents">← Grįžti į aktyvius</Link>

      <table style={{ marginTop: 20, width: '100%' }}>
        <thead>
          <tr>
            <th>Vardas</th>
            <th>Statusas</th>
            <th>Archyvuota</th>
          </tr>
        </thead>

        <tbody>
          {residents.map((r) => (
            <tr key={r.id}>
              <td>{r.full_name}</td>
              <td>{r.current_status}</td>
              <td>{new Date(r.archived_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}