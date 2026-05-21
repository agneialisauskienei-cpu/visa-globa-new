'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Inbox,
  Pill,
  RefreshCw,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react'

import MobileBottomNav from '@/components/mobile/MobileBottomNav'
import { useNotifications } from '@/components/providers/NotificationProvider'
import { getCurrentMembership } from '@/lib/current-membership'
import { getReadableError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { supabase } from '@/lib/supabase'

type NotificationRow = {
  id: string
  title: string
  message: string | null
  type: string | null
  is_read: boolean | null
  created_at: string | null
}

type FilterKey = 'all' | 'critical' | 'action' | 'info' | 'unread'
type Priority = 'critical' | 'action' | 'info'

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Visi' },
  { key: 'critical', label: 'Kritiniai' },
  { key: 'action', label: 'Reikia veiksmo' },
  { key: 'info', label: 'Informaciniai' },
  { key: 'unread', label: 'Nauji' },
]

function notificationTypeLabel(type: string | null) {
  const value = String(type || '').toLowerCase()

  if (value === 'task') return 'Užduotis'
  if (value === 'handover') return 'Perdavimas'
  if (value === 'medicine') return 'Medicina'
  if (value === 'schedule') return 'Grafikas'
  if (value === 'training') return 'Mokymai'
  if (value === 'document') return 'Dokumentai'
  if (value === 'critical') return 'Kritinis'
  if (value === 'action') return 'Reikia veiksmo'
  if (value === 'info') return 'Informacinis'

  return type || 'Pranešimas'
}

function notificationPriority(type: string | null, title: string): Priority {
  const value = `${type || ''} ${title || ''}`.toLowerCase()

  if (
    value.includes('critical') ||
    value.includes('krit') ||
    value.includes('emergency') ||
    value.includes('sos') ||
    value.includes('kritimas') ||
    value.includes('vaistų klaida') ||
    value.includes('incident')
  ) {
    return 'critical'
  }

  if (
    value.includes('task') ||
    value.includes('handover') ||
    value.includes('medicine') ||
    value.includes('perdav') ||
    value.includes('vaist') ||
    value.includes('užduot') ||
    value.includes('action')
  ) {
    return 'action'
  }

  return 'info'
}

function priorityLabel(priority: Priority) {
  if (priority === 'critical') return 'Garsas'
  if (priority === 'action') return 'Vibracija'
  return 'Tyliai'
}

function priorityClasses(priority: Priority) {
  if (priority === 'critical') {
    return {
      card: 'border-rose-200 bg-rose-50/80',
      icon: 'bg-rose-100 text-rose-700',
      badge: 'bg-rose-700 text-white',
      bar: 'bg-rose-600',
    }
  }

  if (priority === 'action') {
    return {
      card: 'border-amber-200 bg-amber-50/70',
      icon: 'bg-amber-100 text-amber-700',
      badge: 'bg-amber-100 text-amber-800',
      bar: 'bg-amber-500',
    }
  }

  return {
    card: 'border-slate-200/70 bg-white',
    icon: 'bg-slate-100 text-slate-600',
    badge: 'bg-slate-100 text-slate-600',
    bar: 'bg-slate-300',
  }
}

function priorityIcon(priority: Priority) {
  if (priority === 'critical') return AlertTriangle
  if (priority === 'action') return Bell
  return Clock3
}

export default function NotificationsPage() {
  const router = useRouter()
  const { unreadCount, refreshUnreadCount } = useNotifications()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<NotificationRow[]>([])
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [soundEnabled, setSoundEnabled] = useState(true)

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unreadItems = useMemo(
    () => items.filter((item) => !item.is_read),
    [items],
  )

  const criticalItems = useMemo(
    () =>
      items.filter(
        (item) => notificationPriority(item.type, item.title) === 'critical',
      ),
    [items],
  )

  const actionItems = useMemo(
    () =>
      items.filter(
        (item) => notificationPriority(item.type, item.title) === 'action',
      ),
    [items],
  )

  const infoItems = useMemo(
    () =>
      items.filter(
        (item) => notificationPriority(item.type, item.title) === 'info',
      ),
    [items],
  )

  const filteredItems = useMemo(() => {
    if (activeFilter === 'unread') return unreadItems

    if (activeFilter === 'critical') {
      return items.filter(
        (item) => notificationPriority(item.type, item.title) === 'critical',
      )
    }

    if (activeFilter === 'action') {
      return items.filter(
        (item) => notificationPriority(item.type, item.title) === 'action',
      )
    }

    if (activeFilter === 'info') {
      return items.filter(
        (item) => notificationPriority(item.type, item.title) === 'info',
      )
    }

    return items
  }, [activeFilter, items, unreadItems])

  async function loadData() {
    setLoading(true)
    setMessage('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace(ROUTES.login)
        return
      }

      const membership = await getCurrentMembership(user.id)

      if (membership?.role === 'owner' || membership?.role === 'admin') {
        router.replace(ROUTES.adminDashboard)
        return
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, type, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setItems((data as NotificationRow[]) || [])
      await refreshUnreadCount()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(id: string) {
    setMessage('')

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)

      if (error) throw error

      await loadData()
    } catch (error) {
      setMessage(getReadableError(error))
    }
  }

  async function markAllAsRead() {
    const ids = unreadItems.map((item) => item.id)

    if (!ids.length) return

    setMessage('')

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', ids)

      if (error) throw error

      await loadData()
    } catch (error) {
      setMessage(getReadableError(error))
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-[28px] border border-slate-200/70 bg-white p-8 text-center shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-800" />
          <p className="mt-4 text-lg font-black text-slate-700">
            Kraunama...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-28 pt-0 text-slate-950 sm:px-6 sm:py-6 sm:pb-24">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-b-[34px] bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-950 px-5 pb-8 pt-7 text-white shadow-[0_18px_42px_rgba(2,6,23,0.18)] sm:rounded-[34px] sm:bg-white sm:bg-none sm:px-7 sm:text-slate-950 sm:shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <button
              type="button"
              onClick={() => router.push(ROUTES.employeeDashboard)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-white/12 text-white backdrop-blur transition hover:bg-white/18 active:scale-[0.98] sm:bg-slate-100 sm:text-slate-700"
              aria-label="Atgal į skydelį"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => void loadData()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-white/12 text-white backdrop-blur transition hover:bg-white/18 active:scale-[0.98] sm:bg-slate-100 sm:text-slate-700"
              aria-label="Atnaujinti"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-8 flex items-start justify-between gap-4 sm:mt-6">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-100 sm:text-emerald-700">
                Pranešimų centras
              </p>

              <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl sm:text-slate-950">
                Dabar svarbu
              </h1>

              <p className="mt-3 max-w-[620px] text-sm font-semibold leading-6 text-emerald-50/90 sm:text-base sm:text-slate-500">
                Kritiniai pranešimai skirti garsui, svarbūs — vibracijai, o
                informaciniai lieka tylūs pranešimų centre.
              </p>
            </div>

            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[28px] bg-white/15 text-white backdrop-blur sm:bg-slate-100 sm:text-emerald-800">
              <Bell className="h-9 w-9" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
            <HeroStat label="Kritiniai" value={String(criticalItems.length)} />
            <HeroStat label="Veiksmai" value={String(actionItems.length)} />
            <HeroStat label="Nauji" value={String(unreadItems.length || unreadCount)} />
            <div className="hidden sm:block">
              <HeroStat label="Visi" value={String(items.length)} />
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
            {message}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
                  Gautieji
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  Pranešimai
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                  Grupuojama pagal prioritetą, garsą ir reikalingą veiksmą.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setSoundEnabled((value) => !value)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  {soundEnabled ? (
                    <Volume2 className="h-4 w-4 text-emerald-700" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-slate-500" />
                  )}
                  {soundEnabled ? 'Garsas įjungtas' : 'Garsas išjungtas'}
                </button>

                <button
                  type="button"
                  onClick={() => void markAllAsRead()}
                  disabled={unreadItems.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Pažymėti visus
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={`rounded-full border px-4 py-2.5 text-sm font-black transition ${
                    activeFilter === filter.key
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="mt-5">
              {filteredItems.length === 0 ? (
                <div className="rounded-[28px] border border-slate-200/70 bg-slate-50 p-8 text-center sm:min-h-[220px] sm:content-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                    <Inbox className="h-7 w-7" />
                  </div>
                  <p className="mt-4 text-lg font-black text-slate-800">
                    Pranešimų nėra
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Kai atsiras naujų žinučių, jos bus rodomos čia.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredItems.map((item) => (
                    <NotificationCard
                      key={item.id}
                      item={item}
                      onMarkAsRead={markAsRead}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="grid gap-5">
            <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
                    Logika
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                    Garsų taisyklės
                  </h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                    Kad darbuotojai negautų per daug signalų.
                  </p>
                </div>

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-emerald-700">
                  <ShieldCheck className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <RuleCard
                  icon={<Bell className="h-5 w-5" />}
                  title="Kritiniai"
                  text="Garsas + vibracija + prisegtas pranešimas."
                />
                <RuleCard
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="Svarbūs"
                  text="Vibracija, be garso, kol nėra eskalavimo."
                />
                <RuleCard
                  icon={<CalendarDays className="h-5 w-5" />}
                  title="Informaciniai"
                  text="Tik pranešimų centre, be garso."
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
                Santrauka
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                Šiandien
              </h2>

              <div className="mt-5 grid gap-3">
                <SummaryRow
                  icon={<AlertTriangle className="h-5 w-5" />}
                  title="Kritiniai"
                  value={`${criticalItems.length} praneš.`}
                  tone="rose"
                />
                <SummaryRow
                  icon={<Pill className="h-5 w-5" />}
                  title="Reikia veiksmo"
                  value={`${actionItems.length} praneš.`}
                  tone="amber"
                />
                <SummaryRow
                  icon={<ClipboardList className="h-5 w-5" />}
                  title="Informaciniai"
                  value={`${infoItems.length} praneš.`}
                  tone="slate"
                />
              </div>
            </section>
          </aside>
        </section>
      </div>

      <MobileBottomNav />
    </main>
  )
}

function NotificationCard({
  item,
  onMarkAsRead,
}: {
  item: NotificationRow
  onMarkAsRead: (id: string) => Promise<void>
}) {
  const priority = notificationPriority(item.type, item.title)
  const classes = priorityClasses(priority)
  const Icon = priorityIcon(priority)

  return (
    <article
      className={`relative overflow-hidden rounded-[24px] border p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition hover:border-emerald-200 hover:bg-white ${classes.card}`}
    >
      <div className={`absolute bottom-0 left-0 top-0 w-1 ${classes.bar}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
              {notificationTypeLabel(item.type)}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${classes.badge}`}
            >
              {priorityLabel(priority)}
            </span>

            {!item.is_read ? (
              <span className="rounded-full bg-emerald-800 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white">
                Nauja
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 text-lg font-black leading-snug text-slate-950">
            {item.title}
          </h3>

          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            {item.message || '—'}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${classes.icon}`}
        >
          {item.is_read && priority !== 'critical' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-200/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
          <Clock3 className="h-4 w-4" />
          {formatDateTime(item.created_at)}
        </div>

        {!item.is_read ? (
          <button
            type="button"
            onClick={() => void onMarkAsRead(item.id)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
          >
            <CheckCircle2 className="h-4 w-4" />
            Pažymėti kaip skaitytą
          </button>
        ) : null}
      </div>
    </article>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] bg-white/15 p-4 backdrop-blur sm:bg-slate-100">
      <div className="text-2xl font-black text-white sm:text-slate-950">
        {value}
      </div>
      <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-emerald-50 sm:text-emerald-700">
        {label}
      </div>
    </div>
  )
}

function RuleCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode
  title: string
  text: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-black text-slate-950">{title}</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">
          {text}
        </p>
      </div>
    </div>
  )
}

function SummaryRow({
  icon,
  title,
  value,
  tone,
}: {
  icon: React.ReactNode
  title: string
  value: string
  tone: 'rose' | 'amber' | 'slate'
}) {
  const toneClass = {
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-600',
  }[tone]

  return (
    <div className="flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-black text-slate-950">{title}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">{value}</p>
        </div>
      </div>
    </div>
  )
}
