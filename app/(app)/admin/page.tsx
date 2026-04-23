'use client'

import { useRouter } from 'next/navigation'
import {
  Bell,
  CalendarDays,
  ChevronRight,
  FileText,
  HeartPulse,
  Home,
  LogOut,
  Menu,
  Settings,
  Users,
  UserSquare2,
  BarChart3,
  ClipboardList,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const sidebarItems = [
  { label: 'Pagrindinis', icon: Home, active: true },
  { label: 'Gyventojai', icon: Users },
  { label: 'Personalas', icon: UserSquare2 },
  { label: 'Grafikai', icon: CalendarDays },
  { label: 'Sveikatos įrašai', icon: HeartPulse },
  { label: 'Dokumentai', icon: FileText },
  { label: 'Užduotys', icon: ClipboardList },
  { label: 'Ataskaitos', icon: BarChart3 },
  { label: 'Nustatymai', icon: Settings },
]

export default function DashboardPage() {
  const router = useRouter()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const todayRange = useMemo(() => '2024-05-20 — 2024-05-26', [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 bg-emerald-950 text-white lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-6 py-5">
            <div className="text-3xl font-bold tracking-tight">VisaGloba</div>
            <p className="mt-2 text-sm text-emerald-100/70">
              Globos įstaigos valdymo sistema
            </p>
          </div>

          <div className="flex-1 px-4 py-5">
            <div className="space-y-2">
              {sidebarItems.map((item) => (
                <SidebarItem
                  key={item.label}
                  label={item.label}
                  icon={item.icon}
                  active={item.active}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">Jonas Petraitis</div>
              <div className="mt-1 text-xs text-emerald-100/70">Direktorius</div>

              <button
                type="button"
                onClick={handleLogout}
                className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-100/80 transition hover:text-white"
              >
                <LogOut size={16} />
                Atsijungti
              </button>
            </div>
          </div>
        </aside>

        {mobileSidebarOpen ? (
          <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileSidebarOpen(false)}>
            <aside
              className="h-full w-80 bg-emerald-950 p-4 text-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-white/10 px-2 py-4">
                <div className="text-2xl font-bold tracking-tight">VisaGloba</div>
                <p className="mt-2 text-sm text-emerald-100/70">
                  Globos įstaigos valdymo sistema
                </p>
              </div>

              <div className="py-4">
                <div className="space-y-2">
                  {sidebarItems.map((item) => (
                    <SidebarItem
                      key={item.label}
                      label={item.label}
                      icon={item.icon}
                      active={item.active}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Jonas Petraitis</div>
                <div className="mt-1 text-xs text-emerald-100/70">Direktorius</div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-100/80 transition hover:text-white"
                >
                  <LogOut size={16} />
                  Atsijungti
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
                >
                  <Menu size={18} />
                </button>

                <div>
                  <div className="text-2xl font-bold tracking-tight">Pagrindinis skydelis</div>
                  <div className="mt-1 text-sm text-slate-500">
                    Savaitės apžvalga ir svarbiausi rodikliai
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500 sm:block">
                  {todayRange}
                </div>

                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                >
                  <Bell size={18} />
                </button>
              </div>
            </div>
          </header>

          <section className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Gyventojai"
                value="124"
                meta="+3 nuo praėjusios savaitės"
              />
              <StatCard
                title="Kambariai"
                value="48"
                meta="+1 nuo praėjusios savaitės"
              />
              <StatCard
                title="Laisvos vietos"
                value="7"
                meta="-1 nuo praėjusios savaitės"
              />
              <StatCard
                title="Užduotys"
                value="12"
                meta="3 vėluoja"
                danger
              />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="mb-5 text-base font-semibold text-slate-800">
                  Gyventojų pasiskirstymas
                </div>

                <div className="flex flex-col gap-8 md:flex-row md:items-center">
                  <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-[conic-gradient(#166534_0_62%,#4ade80_62_86%,#dcfce7_86_100%)]">
                    <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white">
                      <div className="text-3xl font-bold">124</div>
                      <div className="text-xs text-slate-500">iš viso</div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <LegendItem
                      label="Ilgalaikė globa"
                      value="62%"
                      color="bg-emerald-700"
                    />
                    <LegendItem
                      label="Trumpalaikė globa"
                      value="24%"
                      color="bg-emerald-400"
                    />
                    <LegendItem
                      label="Dienos socialinė"
                      value="14%"
                      color="bg-emerald-100"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="mb-5 text-base font-semibold text-slate-800">
                  Artimiausi įvykiai
                </div>

                <div className="space-y-5">
                  <EventRow
                    title="Medikų vizitas"
                    time="Gegužės 21 d. 10:00"
                    tag="Šiandien"
                  />
                  <EventRow
                    title="Komandos susirinkimas"
                    time="Gegužės 22 d. 09:00"
                    tag="Rytoj"
                  />
                  <EventRow
                    title="Gaisrinės patikra"
                    time="Gegužės 24 d. 13:00"
                    tag="Penktadienį"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="mb-5 text-base font-semibold text-slate-800">
                  Užduotys
                </div>

                <div className="space-y-5">
                  <TaskRow
                    title="Atnaujinti gyventojo sveikatos planą"
                    date="Iki 2024-05-21"
                    status="Vėluoja"
                    statusClass="bg-rose-100 text-rose-600"
                  />
                  <TaskRow
                    title="Patvirtinti vaistų likučius"
                    date="Iki 2024-05-22"
                    status="Laukiama"
                    statusClass="bg-amber-100 text-amber-600"
                  />
                  <TaskRow
                    title="Paruošti mėnesio ataskaitą"
                    date="Iki 2024-05-25"
                    status="Atlikta"
                    statusClass="bg-emerald-100 text-emerald-600"
                  />
                </div>
              </div>

              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="mb-5 text-base font-semibold text-slate-800">
                  Greitos nuorodos
                </div>

                <div className="space-y-3">
                  <QuickAction label="Naujas gyventojas" />
                  <QuickAction label="Naujas dokumentas" />
                  <QuickAction label="Sukurti pranešimą" />
                  <QuickAction label="Atidaryti veiklų modulį" />
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[28px] bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-emerald-500/15 p-3">
                      <ShieldBadge />
                    </div>
                    <div className="text-xl font-semibold">Saugumas ir atitikimas</div>
                  </div>

                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-emerald-50/85">
                    Duomenų prieiga valdoma pagal organizaciją ir rolę. Sistema
                    pritaikyta saugiam kasdieniam darbui su jautriais duomenimis.
                  </p>
                </div>

                <div>
                  <div className="text-4xl font-black">100%</div>
                  <div className="mt-1 text-sm text-emerald-100/80">Duomenų saugumas</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function SidebarItem({
  label,
  icon: Icon,
  active = false,
}: {
  label: string
  icon: React.ComponentType<{ size?: number }>
  active?: boolean
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
        active
          ? 'bg-emerald-700 text-white'
          : 'text-emerald-50/90 hover:bg-emerald-900'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  )
}

function StatCard({
  title,
  value,
  meta,
  danger = false,
}: {
  title: string
  value: string
  meta: string
  danger?: boolean
}) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-3 text-4xl font-bold leading-none text-slate-900">{value}</div>
      <div className={`mt-3 text-xs ${danger ? 'text-rose-500' : 'text-slate-400'}`}>
        {meta}
      </div>
    </div>
  )
}

function LegendItem({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <div className={`h-3 w-3 rounded-full ${color}`} />
        <span className="text-slate-600">{label}</span>
      </div>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  )
}

function EventRow({
  title,
  time,
  tag,
}: {
  title: string
  time: string
  tag: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-medium text-slate-800">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{time}</div>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
        {tag}
      </span>
    </div>
  )
}

function TaskRow({
  title,
  date,
  status,
  statusClass,
}: {
  title: string
  date: string
  status: string
  statusClass: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-medium text-slate-800">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{date}</div>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
        {status}
      </span>
    </div>
  )
}

function QuickAction({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
    >
      <span>{label}</span>
      <ChevronRight size={16} />
    </button>
  )
}

function ShieldBadge() {
  return <Bell size={24} />
}