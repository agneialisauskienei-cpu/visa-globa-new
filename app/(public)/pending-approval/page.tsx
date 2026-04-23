'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationContext } from '@/lib/current-organization'

type MembershipRole = 'owner' | 'admin' | 'employee' | null

export default function PendingApprovalPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      if (isMounted) {
        setEmail(user.email || '')
        setLoading(false)
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [router])

  useEffect(() => {
    const interval = setInterval(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { organizationId, activeMembership } = await getCurrentOrganizationContext()
      const role = (activeMembership?.role || null) as MembershipRole

      if (!organizationId || !activeMembership) {
        return
      }

      if (role === 'owner' || role === 'admin') {
        window.location.href = '/admin-dashboard'
        return
      }

      if (role === 'employee') {
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
    <main className="min-h-screen bg-[#f5f6f4] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl items-center justify-center">
        <section className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_40px_120px_rgba(0,0,0,0.12)] lg:grid-cols-[1fr_0.95fr]">
          <div className="hidden bg-gradient-to-br from-[#0a372a] via-[#0f4f3d] to-[#176c43] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium">
                Laukiama patvirtinimo
              </div>

              <h1 className="mt-6 text-5xl font-black leading-tight">
                Paskyra
                <br />
                dar neaktyvuota.
              </h1>

              <p className="mt-5 max-w-md text-base leading-7 text-emerald-50/85">
                Administratorius dar turi patvirtinti, kad tikrai esi įstaigos darbuotojas.
                Kai paskyra bus aktyvuota, būsi automatiškai nukreipta į savo darbo aplinką.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 text-sm text-emerald-50/85">
              Sistema tikrina tavo prieigą automatiškai kas kelias sekundes.
            </div>
          </div>

          <div className="p-8 md:p-10">
            <div className="mx-auto max-w-md">
              <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
                Laukiama patvirtinimo
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-900">
                Paskyra dar neaktyvuota
              </h1>

              <p className="mt-3 text-sm leading-7 text-slate-500">
                Kol paskyra nepatvirtinta, vidinių sistemos puslapių nematysi.
                Kai administratorius patvirtins paskyrą, būsi automatiškai nukreipta
                į savo darbo aplinką.
              </p>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-500">
                  Registruotas el. paštas
                </div>
                <div className="mt-2 text-base font-semibold text-slate-900">
                  {loading ? 'Kraunama...' : email || '—'}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Jei jau turėtum būti patvirtinta, pabandyk atsijungti ir prisijungti iš naujo
                arba susisiek su administratoriumi.
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="mt-6 rounded-2xl bg-[#0f4f3d] px-5 py-4 text-base font-semibold text-white transition hover:bg-[#0c4333]"
              >
                Atsijungti
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}