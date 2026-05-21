'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  Pill,
  Plus,
  Users,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import MobileBottomNav from '@/components/mobile/MobileBottomNav'

type QuickAction = {
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  tone: string
}

const quickActions: QuickAction[] = [
  {
    title: 'Vaistai',
    description: 'Žymėti davimą',
    href: '/medicine',
    icon: Pill,
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    title: 'Perdavimai',
    description: 'Naujas įrašas',
    href: '/handover-logs',
    icon: ClipboardList,
    tone: 'bg-slate-100 text-slate-700',
  },
  {
    title: 'Gyventojai',
    description: 'Mano sąrašas',
    href: '/my-residents',
    icon: Users,
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    title: 'Užduotys',
    description: 'Darbai',
    href: '/tasks',
    icon: CheckCircle2,
    tone: 'bg-slate-100 text-slate-700',
  },
]

const importantItems = [
  {
    title: 'Kritinis perdavimas',
    text: 'Peržiūrėkite naujus pamainos įrašus.',
    href: '/handover-logs',
    icon: AlertTriangle,
  },
  {
    title: '08:00 vaistai',
    text: 'Patikrinkite šiandienos davimus.',
    href: '/medicine',
    icon: Pill,
  },
  {
    title: 'Mano užduotys',
    text: 'Atidarykite priskirtus darbus.',
    href: '/tasks',
    icon: ClipboardList,
  },
]

export default function MobileEmployeeDashboard() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [initials, setInitials] = useState('NA')

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, full_name, first_name, last_name, email')
        .eq('id', user.id)
        .maybeSingle()

      const name =
        data?.full_name ||
        [data?.first_name, data?.last_name].filter(Boolean).join(' ').trim() ||
        data?.email ||
        user.email ||
        'Naudotojas'

      const parts = name.split(/\s+/).filter(Boolean)
      setInitials(
        parts.length >= 2
          ? `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase()
          : name.slice(0, 2).toUpperCase()
      )
      setAvatarUrl(data?.avatar_url || null)
    }

    void loadProfile()
  }, [])

  return (
    <main className="min-h-screen bg-slate-50 pb-32 text-slate-950">
      <section className="overflow-hidden rounded-b-[34px] bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-950 px-5 pb-8 pt-7 text-white shadow-[0_18px_42px_rgba(2,6,23,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-100">
              Darbuotojo režimas
            </p>

            <h1 className="mt-3 text-3xl font-black leading-tight">
              Labas rytas
            </h1>

            <p className="mt-3 max-w-[320px] text-sm font-semibold text-emerald-50/90">
              Pamainos informacija, užduotys ir svarbiausi veiksmai vienoje vietoje.
            </p>
          </div>

          <div className="h-16 w-16 overflow-hidden rounded-[28px] bg-white/90 text-emerald-950 shadow-sm">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profilio nuotrauka"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-black">
                {initials}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <HeroStat label="Užduotys" value="0" />
          <HeroStat label="Perdavimai" value="2" />
          <HeroStat label="Vaistai" value="3" />
        </div>
      </section>

      <section className="space-y-5 px-4 pt-5">
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon

            return (
              <Link
                key={action.title}
                href={action.href}
                className="rounded-[28px] border border-slate-200/70 bg-white p-4 text-left shadow-[0_10px_30px_rgba(15,23,42,0.08)] active:scale-[0.99]"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${action.tone}`}>
                  <Icon className="h-6 w-6" />
                </div>

                <h2 className="mt-4 text-lg font-black text-slate-950">
                  {action.title}
                </h2>

                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {action.description}
                </p>
              </Link>
            )
          })}
        </div>

        <section>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
                Pamaina
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                Dabar svarbu
              </h2>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {importantItems.map((item) => {
              const Icon = item.icon

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Icon className="h-6 w-6" />
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-base font-black text-slate-950">
                        {item.title}
                      </h3>
                      <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-500">
                        {item.text}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
                    Atidaryti
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      </section>

      <MobileBottomNav />
    </main>
  )
}

function HeroStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[28px] bg-white/15 p-4 backdrop-blur">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-emerald-50">
        {label}
      </div>
    </div>
  )
}
