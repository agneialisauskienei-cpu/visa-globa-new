 'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, ChevronLeft, Clock, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import MobileBottomNav from '@/components/mobile/MobileBottomNav'
import { getCurrentOrganizationId } from '@/lib/current-organization'

type ShiftRow = {
  id: string
  shift_date: string
  start_time: string | null
  end_time: string | null
  shift_type: string | null
  status: string | null
  notes: string | null
}

type MembershipRow = { role: 'owner' | 'admin' | 'employee' }
type NotificationCountRow = { id: string; is_read: boolean | null }

function getReadableError(error: unknown) {
  if (!error) return 'Nežinoma klaida.'
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const maybe = error as { message?: string; details?: string; hint?: string; code?: string }
    return maybe.message || maybe.details || maybe.hint || (maybe.code ? `Klaidos kodas: ${maybe.code}` : 'Nepavyko įvykdyti veiksmo.')
  }
  return 'Nepavyko įvykdyti veiksmo.'
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('lt-LT', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatShiftTime(start: string | null, end: string | null) {
  return `${start?.slice(0, 5) || '--:--'}–${end?.slice(0, 5) || '--:--'}`
}

export default function MySchedulePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [notificationsCount, setNotificationsCount] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  async function loadData() {
    setLoading(true)
    setMessage('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const organizationId = await getCurrentOrganizationId()
      if (!organizationId) { setMessage('Nepavyko nustatyti įstaigos.'); return }
      const { data: membership, error: membershipError } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .maybeSingle()
      if (membershipError) throw membershipError
      const typedMembership = (membership as MembershipRow | null) || null
      if (typedMembership?.role === 'owner' || typedMembership?.role === 'admin') { router.replace('/admin-dashboard'); return }

      const today = new Date()
      const endDate = new Date(today)
      endDate.setDate(today.getDate() + 14)
      const from = today.toISOString().slice(0, 10)
      const to = endDate.toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('work_shifts')
        .select('id, shift_date, start_time, end_time, shift_type, status, notes')
        .eq('user_id', user.id)
        .gte('shift_date', from)
        .lte('shift_date', to)
        .order('shift_date', { ascending: true })
        .order('start_time', { ascending: true })
      if (error) throw error
      setShifts((data as ShiftRow[]) || [])

      const { data: notifications, error: notificationsError } = await supabase
        .from('notifications')
        .select('id, is_read')
        .eq('user_id', user.id)
        .eq('is_read', false)
      if (notificationsError) throw notificationsError
      setNotificationsCount(((notifications as NotificationCountRow[]) || []).length)
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  const todayText = useMemo(() => new Date().toLocaleDateString('lt-LT'), [])
  const nextShift = shifts[0]

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="rounded-3xl border border-slate-200/70 bg-white p-8 text-center shadow-sm"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-700"/><p className="mt-4 text-lg font-black text-slate-700">Kraunama...</p></div></main>
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-950">
      <section className="rounded-b-[34px] bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-950 px-5 pb-7 pt-6 text-white shadow-md">
        <div className="flex items-start justify-between gap-4">
          <button onClick={() => router.push('/employee-dashboard')} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 text-white"><ChevronLeft className="h-5 w-5" /></button>
          <button onClick={() => void loadData()} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 text-white"><RefreshCw className="h-5 w-5" /></button>
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.32em] text-emerald-100">Mano grafikas</p>
        <h1 className="mt-3 text-3xl font-black leading-tight">Artimiausios pamainos</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-emerald-50/90">Rodomos artimiausios 14 dienų pamainos nuo {todayText}.</p>
        <div className="mt-5 rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-100">Kita pamaina</p>
          <div className="mt-2 flex items-center justify-between gap-4">
            <strong className="text-xl font-black">{nextShift ? formatDate(nextShift.shift_date) : 'Nėra suplanuota'}</strong>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-900">{nextShift ? formatShiftTime(nextShift.start_time, nextShift.end_time) : '—'}</span>
          </div>
        </div>
      </section>

      <section className="space-y-3 px-4 pt-5">
        {message ? <div className="rounded-[24px] border border-slate-200/70 bg-white p-4 text-sm font-extrabold text-slate-700 shadow-sm">{message}</div> : null}
        {shifts.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm"><CalendarClock className="mx-auto h-10 w-10 text-slate-400" /><p className="mt-4 text-lg font-black text-slate-700">Artimiausių pamainų nerasta</p><p className="mt-1 text-sm font-semibold text-slate-500">Kai grafikas bus patvirtintas, jis atsiras čia.</p></div>
        ) : shifts.map((shift) => (
          <article key={shift.id} className="rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-widest text-emerald-700">{shift.shift_type || 'Pamaina'}</p><h2 className="mt-2 text-xl font-black">{formatDate(shift.shift_date)}</h2></div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">{shift.status || 'suplanuota'}</span>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-black text-slate-700"><Clock className="mr-2 inline h-4 w-4" />{formatShiftTime(shift.start_time, shift.end_time)}</div>
            {shift.notes?.trim() ? <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{shift.notes.trim()}</p> : null}
          </article>
        ))}
      </section>

      <MobileBottomNav notificationsCount={notificationsCount} />
    </main>
  )
}
