'use client'

import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable/base'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/styles/ht-theme-classic.min.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

registerAllModules()

type Resident = {
  id: string
  full_name: string | null
  first_name?: string | null
  last_name?: string | null
  current_room_id?: string | null
  current_status?: string | null
}

type Room = {
  id: string
  name: string | null
}

type ActivitySession = {
  id: string
  organization_id: string
  title: string
  session_date: string
  start_time: string | null
  end_time: string | null
}

type AttendanceStatus = 'attended' | 'absent' | 'refused' | 'not_applicable'
type CellCode = 'D' | 'N' | 'A' | 'T' | ''

type AttendanceRow = {
  session_id: string
  resident_id: string
  status: AttendanceStatus
  note?: string | null
}

type GridChange = [number, number | string, unknown, unknown]
type MessageType = 'success' | 'error' | 'info'

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('lt-LT', {
    year: 'numeric',
    month: 'long',
  }).format(date)
}

function toDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function residentName(resident: Resident) {
  if (resident.full_name?.trim()) return resident.full_name.trim()
  return [resident.first_name, resident.last_name].filter(Boolean).join(' ').trim() || 'Be vardo'
}

function statusToCode(status?: string | null): CellCode {
  switch (status) {
    case 'attended':
      return 'D'
    case 'absent':
      return 'N'
    case 'refused':
      return 'A'
    case 'not_applicable':
      return 'T'
    default:
      return ''
  }
}

function codeToStatus(code: string): AttendanceStatus | null {
  const normalized = normalizeCode(code)

  switch (normalized) {
    case 'D':
      return 'attended'
    case 'N':
      return 'absent'
    case 'A':
      return 'refused'
    case 'T':
      return 'not_applicable'
    default:
      return null
  }
}

function normalizeCode(value: unknown): CellCode {
  const raw = String(value ?? '').trim().toUpperCase()

  if (!raw) return ''

  if (['D', 'DALYVAVO', 'ATTENDED'].includes(raw)) return 'D'
  if (['N', 'NEDALYVAVO', 'ABSENT'].includes(raw)) return 'N'
  if (['A', 'ATSISAKĖ', 'ATSISAKE', 'REFUSED', 'R'].includes(raw)) return 'A'
  if (['T', 'NETAIKOMA', 'NOT_APPLICABLE', 'NA'].includes(raw)) return 'T'

  return ''
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  const seen = new Set<string>()
  const result: T[] = []

  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    result.push(row)
  }

  return result
}

function isValidTimeRange(startTime: string, endTime: string) {
  if (!startTime || !endTime) return true
  return startTime < endTime
}

export default function ActivitiesGridPage() {
  const [monthDate, setMonthDate] = useState<Date>(startOfMonth(new Date()))

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<MessageType>('info')

  const [residents, setResidents] = useState<Resident[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [sessions, setSessions] = useState<ActivitySession[]>([])
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([])

  const [search, setSearch] = useState('')
  const [roomFilter, setRoomFilter] = useState('')

  const [newSessionTitle, setNewSessionTitle] = useState('')
  const [newSessionDate, setNewSessionDate] = useState(toDateInput(new Date()))
  const [newSessionStartTime, setNewSessionStartTime] = useState('10:00')
  const [newSessionEndTime, setNewSessionEndTime] = useState('11:00')

  const loadRequestIdRef = useRef(0)

  const monthStart = useMemo(() => startOfMonth(monthDate), [monthDate])
  const monthEnd = useMemo(() => endOfMonth(monthDate), [monthDate])

  useEffect(() => {
    setNewSessionDate(toDateInput(monthStart))
  }, [monthStart])

  useEffect(() => {
    void loadMonth()
  }, [monthDate])

  async function getAccessToken() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) throw new Error(error.message)
    if (!session?.access_token) throw new Error('Nėra aktyvios sesijos.')

    return session.access_token
  }

  const roomMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const room of rooms) {
      map.set(room.id, room.name || '—')
    }
    return map
  }, [rooms])

  function roomName(roomId?: string | null) {
    if (!roomId) return '—'
    return roomMap.get(roomId) || '—'
  }

  async function loadMonth() {
    const requestId = ++loadRequestIdRef.current

    setLoading(true)
    setMessage('')
    setMessageType('info')

    try {
      const orgId = await getCurrentOrganizationId()

      if (!orgId) {
        if (requestId !== loadRequestIdRef.current) return
        setMessage('Nepavyko nustatyti organizacijos.')
        setMessageType('error')
        setLoading(false)
        return
      }

      const [
        { data: residentsData, error: residentsError },
        { data: roomsData, error: roomsError },
        { data: sessionsData, error: sessionsError },
      ] = await Promise.all([
        supabase
          .from('residents')
          .select('id, full_name, first_name, last_name, current_room_id, current_status')
          .eq('organization_id', orgId)
          .order('full_name'),
        supabase
          .from('rooms')
          .select('id, name')
          .eq('organization_id', orgId)
          .order('name'),
        supabase
          .from('activity_sessions')
          .select('id, organization_id, title, session_date, start_time, end_time')
          .eq('organization_id', orgId)
          .gte('session_date', toDateInput(monthStart))
          .lte('session_date', toDateInput(monthEnd))
          .order('session_date', { ascending: true })
          .order('start_time', { ascending: true }),
      ])

      if (requestId !== loadRequestIdRef.current) return

      if (residentsError) throw residentsError
      if (roomsError) throw roomsError
      if (sessionsError) throw sessionsError

      const safeResidents = uniqueById(
        ((residentsData || []) as Resident[]).filter(
          (resident) => !['sutartis_nutraukta', 'mire'].includes(resident.current_status || '')
        )
      )

      const safeRooms = uniqueById((roomsData || []) as Room[])
      const safeSessions = uniqueById((sessionsData || []) as ActivitySession[])

      setResidents(safeResidents)
      setRooms(safeRooms)
      setSessions(safeSessions)

      const sessionIds = safeSessions.map((session) => session.id)

      if (!sessionIds.length) {
        setAttendanceRows([])
        return
      }

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('activity_attendance')
        .select('session_id, resident_id, status, note')
        .in('session_id', sessionIds)

      if (requestId !== loadRequestIdRef.current) return
      if (attendanceError) throw attendanceError

      setAttendanceRows((attendanceData || []) as AttendanceRow[])
    } catch (error: any) {
      if (requestId !== loadRequestIdRef.current) return
      setMessage(error?.message || 'Nepavyko užkrauti mėnesio veiklų.')
      setMessageType('error')
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false)
      }
    }
  }

  async function handleCreateSession() {
    if (!newSessionTitle.trim()) {
      setMessage('Įvesk veiklos pavadinimą.')
      setMessageType('error')
      return
    }

    if (!newSessionDate) {
      setMessage('Pasirink datą.')
      setMessageType('error')
      return
    }

    if (!isValidTimeRange(newSessionStartTime, newSessionEndTime)) {
      setMessage('Pabaigos laikas turi būti vėlesnis už pradžios laiką.')
      setMessageType('error')
      return
    }

    setCreatingSession(true)
    setMessage('')
    setMessageType('info')

    try {
      const accessToken = await getAccessToken()

      const response = await fetch('/api/activity-sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newSessionTitle.trim(),
          session_date: newSessionDate,
          start_time: newSessionStartTime || null,
          end_time: newSessionEndTime || null,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.message || 'Nepavyko sukurti veiklos.')
      }

      setNewSessionTitle('')
      await loadMonth()
      setMessage('Veikla sukurta.')
      setMessageType('success')
    } catch (error: any) {
      setMessage(error?.message || 'Nepavyko sukurti veiklos.')
      setMessageType('error')
    } finally {
      setCreatingSession(false)
    }
  }

  const filteredResidents = useMemo(() => {
    let rows = [...residents]
    const q = search.trim().toLowerCase()

    if (q) {
      rows = rows.filter((resident) => {
        const room = roomName(resident.current_room_id)
        return `${residentName(resident)} ${room}`.toLowerCase().includes(q)
      })
    }

    if (roomFilter) {
      rows = rows.filter((resident) => resident.current_room_id === roomFilter)
    }

    return rows
  }, [residents, search, roomFilter, roomMap])

  const visibleResidents = filteredResidents

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRow>()

    for (const row of attendanceRows) {
      map.set(`${row.resident_id}__${row.session_id}`, row)
    }

    return map
  }, [attendanceRows])

  const duplicatedNames = useMemo(() => {
    const counts = new Map<string, number>()

    for (const resident of visibleResidents) {
      const name = residentName(resident)
      counts.set(name, (counts.get(name) || 0) + 1)
    }

    return counts
  }, [visibleResidents])

  const gridData = useMemo(() => {
    return visibleResidents.map((resident) => {
      const name = residentName(resident)
      const room = roomName(resident.current_room_id)
      const shouldShowRoom = (duplicatedNames.get(name) || 0) > 1
      const firstCell = shouldShowRoom ? `${name} · ${room}` : name

      const row: string[] = [firstCell]

      for (const session of sessions) {
        const found = attendanceMap.get(`${resident.id}__${session.id}`)
        row.push(statusToCode(found?.status))
      }

      return row
    })
  }, [visibleResidents, sessions, attendanceMap, duplicatedNames, roomMap])

  const dayGroups = useMemo(() => {
    const groups: Array<{ date: string; count: number }> = []

    for (const session of sessions) {
      const last = groups[groups.length - 1]

      if (!last || last.date !== session.session_date) {
        groups.push({ date: session.session_date, count: 1 })
      } else {
        last.count += 1
      }
    }

    return groups
  }, [sessions])

  const nestedHeaders = useMemo(() => {
    const topRow: Array<string | { label: string; colspan: number }> = ['']

    for (const group of dayGroups) {
      topRow.push({
        label: new Intl.DateTimeFormat('lt-LT', {
          day: '2-digit',
          month: '2-digit',
        }).format(new Date(group.date)),
        colspan: group.count,
      })
    }

    const secondRow: string[] = ['Gyventojas']

    for (const session of sessions) {
      const time = session.start_time ? `${session.start_time} ` : ''
      secondRow.push(`${time}${session.title}`)
    }

    return [topRow, secondRow]
  }, [dayGroups, sessions])

  const colHeaders = useMemo(() => {
    return ['Gyventojas', ...sessions.map((session) => `${session.session_date} ${session.title}`)]
  }, [sessions])

  const columnDefs = useMemo(() => {
    return [
      {
        data: 0,
        readOnly: true,
      },
      ...sessions.map(() => ({
        type: 'dropdown',
        source: ['D', 'N', 'A', 'T'],
        strict: false,
        allowInvalid: false,
      })),
    ]
  }, [sessions])

  const colWidths = useMemo(() => {
    return [320, ...sessions.map(() => 150)]
  }, [sessions])

  async function saveGridChanges(changes: GridChange[]) {
    if (!changes.length) return
    if (!sessions.length || !visibleResidents.length) return

    const upsertPayload: AttendanceRow[] = []
    const deleteTargets: Array<{ session_id: string; resident_id: string }> = []

    for (const [rowIndex, prop, _oldValue, newValue] of changes) {
      const colIndex = typeof prop === 'number' ? prop : Number(prop)

      if (!Number.isFinite(colIndex)) continue
      if (colIndex === 0) continue

      const resident = visibleResidents[rowIndex]
      const session = sessions[colIndex - 1]

      if (!resident || !session) continue

      const normalizedCode = normalizeCode(newValue)

      if (!normalizedCode) {
        deleteTargets.push({
          session_id: session.id,
          resident_id: resident.id,
        })
        continue
      }

      const mappedStatus = codeToStatus(normalizedCode)

      if (!mappedStatus) continue

      upsertPayload.push({
        session_id: session.id,
        resident_id: resident.id,
        status: mappedStatus,
        note: null,
      })
    }

    if (!upsertPayload.length && !deleteTargets.length) return

    setSaving(true)
    setMessage('')
    setMessageType('info')

    try {
      if (upsertPayload.length) {
        const { error: upsertError } = await supabase.from('activity_attendance').upsert(upsertPayload, {
          onConflict: 'session_id,resident_id',
        })

        if (upsertError) throw upsertError
      }

      for (const target of deleteTargets) {
        const { error: deleteError } = await supabase
          .from('activity_attendance')
          .delete()
          .eq('session_id', target.session_id)
          .eq('resident_id', target.resident_id)

        if (deleteError) throw deleteError
      }

      setAttendanceRows((prev) => {
        let next = [...prev]

        if (deleteTargets.length) {
          const deleteKeys = new Set(
            deleteTargets.map((item) => `${item.resident_id}__${item.session_id}`)
          )

          next = next.filter((row) => !deleteKeys.has(`${row.resident_id}__${row.session_id}`))
        }

        if (upsertPayload.length) {
          const indexMap = new Map<string, number>()

          next.forEach((row, index) => {
            indexMap.set(`${row.resident_id}__${row.session_id}`, index)
          })

          for (const item of upsertPayload) {
            const key = `${item.resident_id}__${item.session_id}`
            const existingIndex = indexMap.get(key)

            if (existingIndex === undefined) {
              next.push(item)
            } else {
              next[existingIndex] = {
                ...next[existingIndex],
                status: item.status,
                note: item.note ?? next[existingIndex].note ?? null,
              }
            }
          }
        }

        return next
      })

      const changedCount = upsertPayload.length + deleteTargets.length
      setMessage(`Išsaugota pakeitimų: ${changedCount}`)
      setMessageType('success')
    } catch (error: any) {
      setMessage(error?.message || 'Nepavyko išsaugoti pakeitimų.')
      setMessageType('error')
    } finally {
      setSaving(false)
    }
  }

  async function handleAfterChange(changes: GridChange[] | null, source: string) {
    if (!changes || !changes.length) return
    if (source === 'loadData') return

    await saveGridChanges(changes)
  }

  function messageClassName() {
    switch (messageType) {
      case 'success':
        return 'mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
      case 'error':
        return 'mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800'
      default:
        return 'mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700'
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Kraunama mėnesio veiklų lentelė...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-[1900px] space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                Veiklų matrica
              </h1>
              <p className="mt-2 text-base text-slate-600">
                Vienas mėnuo per ekraną, kelios veiklos vienai dienai, Excel tipo redagavimas.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMonthDate((prev) => addMonths(prev, -1))}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                ← Ankstesnis
              </button>

              <div className="min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-center text-sm font-semibold capitalize text-slate-800">
                {formatMonthLabel(monthDate)}
              </div>

              <button
                type="button"
                onClick={() => setMonthDate((prev) => addMonths(prev, 1))}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Kitas →
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[1.3fr_0.9fr_0.8fr_0.8fr_0.8fr]">
            <input
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              placeholder="Naujos veiklos pavadinimas"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
            />

            <input
              type="date"
              value={newSessionDate}
              onChange={(e) => setNewSessionDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
            />

            <input
              type="time"
              value={newSessionStartTime}
              onChange={(e) => setNewSessionStartTime(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
            />

            <input
              type="time"
              value={newSessionEndTime}
              onChange={(e) => setNewSessionEndTime(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
            />

            <button
              type="button"
              onClick={() => void handleCreateSession()}
              disabled={creatingSession}
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {creatingSession ? 'Kuriama...' : 'Pridėti veiklą'}
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr_auto]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ieškoti gyventojo..."
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
            />

            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
            >
              <option value="">Visi kambariai</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name || room.id}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">
                Gyventojų: {visibleResidents.length}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">
                Veiklų: {sessions.length}
              </span>
              {saving ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 font-medium text-amber-700">
                  Saugoma...
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 font-medium text-emerald-700">
              D = dalyvavo
            </span>
            <span className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 font-medium text-rose-700">
              N = nedalyvavo
            </span>
            <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-medium text-amber-700">
              A = atsisakė
            </span>
            <span className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 font-medium text-slate-700">
              T = netaikoma
            </span>
            <span className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700">
              Tuščia = ištrinti įrašą
            </span>
          </div>

          {message ? <div className={messageClassName()}>{message}</div> : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              Šiam mėnesiui veiklų dar nėra.
            </div>
          ) : (
            <HotTable
              data={gridData}
              colHeaders={colHeaders}
              nestedHeaders={nestedHeaders}
              columns={columnDefs as any}
              colWidths={colWidths}
              rowHeaders={true}
              width="100%"
              height="72vh"
              stretchH="all"
              fixedColumnsStart={1}
              manualColumnResize={true}
              manualRowResize={true}
              autoWrapRow={false}
              autoWrapCol={false}
              copyPaste={true}
              fillHandle={{
                autoInsertRow: false,
                direction: 'vertical',
              }}
              contextMenu={true}
              outsideClickDeselects={false}
              viewportRowRenderingOffset={40}
              viewportColumnRenderingOffset={20}
              licenseKey="non-commercial-and-evaluation"
              theme="ht-theme-classic"
              afterChange={(changes, source) => {
                void handleAfterChange(changes as GridChange[] | null, source)
              }}
              cells={(row, col) => {
                const cellProperties: Handsontable.CellProperties = {}

                if (col === 0) {
                  cellProperties.readOnly = true
                  cellProperties.className = 'bg-slate-50 font-semibold text-slate-900'
                  return cellProperties
                }

                const value = gridData[row]?.[col]

                if (value === 'D') {
                  cellProperties.className = 'bg-emerald-100 text-emerald-900 font-bold'
                } else if (value === 'N') {
                  cellProperties.className = 'bg-rose-100 text-rose-900 font-bold'
                } else if (value === 'A') {
                  cellProperties.className = 'bg-amber-100 text-amber-900 font-bold'
                } else if (value === 'T') {
                  cellProperties.className = 'bg-slate-200 text-slate-800 font-bold'
                } else {
                  cellProperties.className = 'bg-white text-slate-700'
                }

                return cellProperties
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}