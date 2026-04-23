'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type ApiResult =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; status: number; data: unknown }
  | { kind: 'error'; status?: number; message: string; data?: unknown }

export default function StarterTestPage() {
  const [result, setResult] = useState<ApiResult>({ kind: 'idle' })

  async function handleTestResidentsApi() {
    setResult({ kind: 'loading' })

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        setResult({
          kind: 'error',
          message: `Nepavyko gauti sesijos: ${sessionError.message}`,
        })
        return
      }

      if (!session?.access_token) {
        setResult({
          kind: 'error',
          message: 'Nėra aktyvios sesijos arba access token.',
        })
        return
      }

      const response = await fetch('/api/residents', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      let payload: unknown = null

      try {
        payload = await response.json()
      } catch {
        payload = { message: 'Atsakymas nebuvo validus JSON.' }
      }

      if (!response.ok) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'message' in payload &&
          typeof (payload as { message?: unknown }).message === 'string'
            ? (payload as { message: string }).message
            : 'API grąžino klaidą.'

        setResult({
          kind: 'error',
          status: response.status,
          message,
          data: payload,
        })
        return
      }

      setResult({
        kind: 'success',
        status: response.status,
        data: payload,
      })
    } catch (error: unknown) {
      setResult({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Įvyko nežinoma klaida kviečiant API.',
      })
    }
  }

  async function handleCreateResident() {
    setResult({ kind: 'loading' })

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        setResult({
          kind: 'error',
          message: `Nepavyko gauti sesijos: ${sessionError.message}`,
        })
        return
      }

      if (!session?.access_token) {
        setResult({
          kind: 'error',
          message: 'Nėra aktyvios sesijos arba access token.',
        })
        return
      }

      const response = await fetch('/api/residents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: 'Test Gyventojas',
          status: 'active',
        }),
      })

      let payload: unknown = null

      try {
        payload = await response.json()
      } catch {
        payload = { message: 'Atsakymas nebuvo validus JSON.' }
      }

      if (!response.ok) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'message' in payload &&
          typeof (payload as { message?: unknown }).message === 'string'
            ? (payload as { message: string }).message
            : 'Nepavyko sukurti test gyventojo.'

        setResult({
          kind: 'error',
          status: response.status,
          message,
          data: payload,
        })
        return
      }

      setResult({
        kind: 'success',
        status: response.status,
        data: payload,
      })
    } catch (error: unknown) {
      setResult({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Įvyko nežinoma klaida kuriant gyventoją.',
      })
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Starter API testas</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Šis puslapis paima aktyvios sesijos tokeną ir kviečia{' '}
          <code>/api/residents</code>.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleTestResidentsApi}
            disabled={result.kind === 'loading'}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {result.kind === 'loading'
              ? 'Tikrinama...'
              : 'Testuoti /api/residents'}
          </button>

          <button
            onClick={handleCreateResident}
            disabled={result.kind === 'loading'}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {result.kind === 'loading'
              ? 'Kuriama...'
              : 'Sukurti test gyventoją'}
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-neutral-50 p-4">
          <h2 className="text-sm font-semibold">Rezultatas</h2>

          {result.kind === 'idle' && (
            <p className="mt-2 text-sm text-neutral-600">
              Kol kas testas nepaleistas.
            </p>
          )}

          {result.kind === 'loading' && (
            <p className="mt-2 text-sm text-neutral-600">Kraunama...</p>
          )}

          {result.kind === 'error' && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-red-600">
                Klaida{result.status ? ` (${result.status})` : ''}: {result.message}
              </p>

              {result.data !== undefined && (
                <pre className="overflow-x-auto rounded-xl border border-red-200 bg-white p-3 text-xs">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </div>
          )}

          {result.kind === 'success' && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-green-700">
                Sėkmė ({result.status})
              </p>
              <pre className="overflow-x-auto rounded-xl border border-green-200 bg-white p-3 text-xs">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}