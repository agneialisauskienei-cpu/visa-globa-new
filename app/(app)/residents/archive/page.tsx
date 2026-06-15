'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getCurrentAccess, hasPermission } from '@/lib/app-access'
import { supabase } from '@/lib/supabase'

type ArchivedResident = {
  id: string
  full_name: string | null
  current_status: string | null
  archived_at: string
}

export default function ResidentsArchivePage() {
  const [residents, setResidents] = useState<ArchivedResident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const access = await getCurrentAccess()
        if (!access.organizationId || !hasPermission(access, 'residents.view_basic')) {
          throw new Error('Neturite teisės peržiūrėti gyventojų archyvo.')
        }

        const { data, error: queryError } = await supabase
          .from('residents')
          .select('id, full_name, current_status, archived_at')
          .eq('organization_id', access.organizationId)
          .not('archived_at', 'is', null)
          .order('archived_at', { ascending: false })

        if (queryError) throw queryError
        setResidents((data || []) as ArchivedResident[])
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Nepavyko įkelti archyvo.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  if (loading) return <div>Kraunama...</div>

  return (
    <div style={{ padding: 24 }}>
      <h1>Archyvas</h1>
      <Link href="/residents">← Grįžti į aktyvius</Link>
      {error ? <p role="alert">{error}</p> : null}

      <table style={{ marginTop: 20, width: '100%' }}>
        <thead>
          <tr>
            <th>Vardas</th>
            <th>Statusas</th>
            <th>Archyvuota</th>
          </tr>
        </thead>
        <tbody>
          {!error && residents.map((resident) => (
            <tr key={resident.id}>
              <td>{resident.full_name || '—'}</td>
              <td>{resident.current_status || '—'}</td>
              <td>{new Date(resident.archived_at).toLocaleString('lt-LT')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
