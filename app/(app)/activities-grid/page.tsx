"use client"

import { HotTable } from "@handsontable/react"
import Handsontable from "handsontable/base"
import { registerAllModules } from "handsontable/registry"
import "handsontable/styles/ht-theme-classic.min.css"
import { useEffect, useMemo, useState } from "react"
import { CalendarDays, CheckCircle2, Grid3X3, Info, RefreshCw, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/current-organization"

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

type AttendanceStatus = "attended" | "absent" | "refused" | "not_applicable"
type CellCode = "D" | "N" | "A" | "T" | ""

type AttendanceRow = {
  session_id: string
  resident_id: string
  status: AttendanceStatus
  note?: string | null
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("lt-LT", {
    year: "numeric",
    month: "long",
  }).format(date)
}

function formatDayHeader(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  const day = new Intl.DateTimeFormat("lt-LT", { weekday: "long" }).format(date)
  const mmdd = new Intl.DateTimeFormat("lt-LT", { month: "2-digit", day: "2-digit" }).format(date).replace(" ", "")
  return `${mmdd} (${day.charAt(0).toUpperCase()}${day.slice(1)})`
}

function toDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
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

function getMonthDays(monthDate: Date) {
  const start = startOfMonth(monthDate)
  const end = endOfMonth(monthDate)
  const days: Date[] = []

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }

  return days
}

function residentName(resident: Resident) {
  if (resident.full_name?.trim()) return resident.full_name.trim()
  return [resident.first_name, resident.last_name].filter(Boolean).join(" ").trim() || "Be vardo"
}

function statusToCode(status?: string | null): CellCode {
  switch (status) {
    case "attended":
      return "D"
    case "absent":
      return "N"
    case "refused":
      return "A"
    case "not_applicable":
      return "T"
    default:
      return ""
  }
}

function codeToStatus(code: string): AttendanceStatus | null {
  switch (normalizeCode(code)) {
    case "D":
      return "attended"
    case "N":
      return "absent"
    case "A":
      return "refused"
    case "T":
      return "not_applicable"
    default:
      return null
  }
}

function normalizeCode(value: unknown): CellCode {
  const raw = String(value ?? "").trim().toUpperCase()

  if (!raw) return ""
  if (["D", "DALYVAVO", "ATTENDED"].includes(raw)) return "D"
  if (["N", "NEDALYVAVO", "ABSENT"].includes(raw)) return "N"
  if (["A", "ATSISAKĖ", "ATSISAKE", "REFUSED", "R"].includes(raw)) return "A"
  if (["T", "NETAIKOMA", "NOT_APPLICABLE", "NA"].includes(raw)) return "T"

  return ""
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

function toShortTime(value?: string | null) {
  return value ? value.slice(0, 5) : ""
}

function calendarDayLabel(date: Date) {
  return new Intl.DateTimeFormat("lt-LT", { weekday: "short", day: "2-digit" }).format(date)
}

export default function ActivitiesGridPage() {
  const [viewMode, setViewMode] = useState<"calendar" | "excel">("calendar")
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [monthDate, setMonthDate] = useState<Date>(startOfMonth(new Date()))

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [message, setMessage] = useState("")
  const [savedCount, setSavedCount] = useState(0)
  const [savedAt, setSavedAt] = useState("")

  const [residents, setResidents] = useState<Resident[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [sessions, setSessions] = useState<ActivitySession[]>([])
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([])

  const [search, setSearch] = useState("")
  const [roomFilter, setRoomFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const [newSessionTitle, setNewSessionTitle] = useState("")
  const [newSessionDate, setNewSessionDate] = useState(toDateInput(new Date()))
  const [newSessionStartTime, setNewSessionStartTime] = useState("10:00")
  const [newSessionEndTime, setNewSessionEndTime] = useState("11:00")

  const [selectedCalendarDate, setSelectedCalendarDate] = useState(toDateInput(new Date()))

  const monthStart = useMemo(() => startOfMonth(monthDate), [monthDate])
  const monthEnd = useMemo(() => endOfMonth(monthDate), [monthDate])
  const monthDays = useMemo(() => getMonthDays(monthDate), [monthDate])

  useEffect(() => {
    setNewSessionDate(toDateInput(monthStart))
    setSelectedCalendarDate(toDateInput(monthStart))
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
    if (!session?.access_token) throw new Error("Nėra aktyvios sesijos.")

    return session.access_token
  }

  function roomName(roomId?: string | null) {
    if (!roomId) return "—"
    return rooms.find((room) => room.id === roomId)?.name || "—"
  }

  async function loadMonth() {
    setLoading(true)
    setMessage("")

    try {
      const orgId = await getCurrentOrganizationId()

      if (!orgId) {
        setMessage("Nepavyko nustatyti organizacijos.")
        setLoading(false)
        return
      }

      setOrganizationId(orgId)

      const [
        { data: residentsData, error: residentsError },
        { data: roomsData, error: roomsError },
        { data: sessionsData, error: sessionsError },
      ] = await Promise.all([
        supabase
          .from("residents")
          .select("id, full_name, first_name, last_name, current_room_id, current_status")
          .eq("organization_id", orgId)
          .order("full_name"),
        supabase.from("rooms").select("id, name").eq("organization_id", orgId).order("name"),
        supabase
          .from("activity_sessions")
          .select("id, organization_id, title, session_date, start_time, end_time")
          .eq("organization_id", orgId)
          .gte("session_date", toDateInput(monthStart))
          .lte("session_date", toDateInput(monthEnd))
          .order("session_date", { ascending: true })
          .order("start_time", { ascending: true }),
      ])

      if (residentsError) throw residentsError
      if (roomsError) throw roomsError
      if (sessionsError) throw sessionsError

      const safeResidents = uniqueById(
        ((residentsData || []) as Resident[]).filter(
          (resident) => !["sutartis_nutraukta", "mire"].includes(resident.current_status || "")
        )
      )

      const safeRooms = uniqueById((roomsData || []) as Room[])
      const safeSessions = uniqueById((sessionsData || []) as ActivitySession[])

      setResidents(safeResidents)
      setRooms(safeRooms)
      setSessions(safeSessions)

      const sessionIds = safeSessions.map((s) => s.id)

      if (!sessionIds.length) {
        setAttendanceRows([])
        setLoading(false)
        return
      }

      const { data: attendanceData, error: attendanceError } = await supabase
        .from("activity_attendance")
        .select("session_id, resident_id, status, note")
        .in("session_id", sessionIds)

      if (attendanceError) throw attendanceError

      setAttendanceRows((attendanceData || []) as AttendanceRow[])
    } catch (error: any) {
      setMessage(error?.message || "Nepavyko užkrauti mėnesio veiklų.")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSession() {
    if (!newSessionTitle.trim()) {
      setMessage("Įvesk veiklos pavadinimą.")
      return
    }

    if (!newSessionDate) {
      setMessage("Pasirink datą.")
      return
    }

    if (newSessionStartTime && newSessionEndTime && newSessionEndTime <= newSessionStartTime) {
      setMessage("Pabaigos laikas turi būti vėlesnis už pradžios laiką.")
      return
    }

    setCreatingSession(true)
    setMessage("")

    try {
      if (!organizationId) throw new Error("Nepavyko nustatyti organizacijos.")

      // Pirma bandom tiesiogiai įrašyti. Jei RLS neleidžia, bandom per API.
      const direct = await supabase.from("activity_sessions").insert({
        organization_id: organizationId,
        title: newSessionTitle.trim(),
        session_date: newSessionDate,
        start_time: newSessionStartTime || null,
        end_time: newSessionEndTime || null,
      })

      if (direct.error) {
        const accessToken = await getAccessToken()

        const response = await fetch("/api/activity-sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organization_id: organizationId,
            title: newSessionTitle.trim(),
            session_date: newSessionDate,
            start_time: newSessionStartTime || null,
            end_time: newSessionEndTime || null,
          }),
        })

        const text = await response.text()
        const payload = text ? JSON.parse(text) : {}

        if (!response.ok) {
          throw new Error(payload?.message || "Nepavyko sukurti veiklos.")
        }
      }

      setNewSessionTitle("")
      await loadMonth()
      setMessage("Veikla sukurta.")
    } catch (error: any) {
      setMessage(error?.message || "Nepavyko sukurti veiklos.")
    } finally {
      setCreatingSession(false)
    }
  }

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRow>()

    for (const row of attendanceRows) {
      map.set(`${row.resident_id}__${row.session_id}`, row)
    }

    return map
  }, [attendanceRows])

  function getCode(residentId: string, sessionId: string): CellCode {
    return statusToCode(attendanceMap.get(`${residentId}__${sessionId}`)?.status)
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

    if (roomFilter) rows = rows.filter((resident) => resident.current_room_id === roomFilter)

    if (statusFilter) {
      rows = rows.filter((resident) => {
        return sessions.some((session) => getCode(resident.id, session.id) === statusFilter)
      })
    }

    return rows
  }, [residents, search, roomFilter, statusFilter, rooms, sessions, attendanceRows])

  const attendanceGridData = useMemo(() => {
    return filteredResidents.map((resident) => {
      return [
        `${residentName(resident)}\nKambarys: ${roomName(resident.current_room_id)}`,
        ...sessions.map((session) => getCode(resident.id, session.id)),
      ]
    })
  }, [filteredResidents, sessions, attendanceRows, rooms])

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
    const topRow: Array<string | { label: string; colspan: number }> = [""]

    for (const group of dayGroups) {
      topRow.push({
        label: formatDayHeader(group.date),
        colspan: group.count,
      })
    }

    const secondRow: string[] = ["Gyventojas"]

    for (const session of sessions) {
      secondRow.push(`${toShortTime(session.start_time)} ${session.title}`)
    }

    return [topRow, secondRow]
  }, [dayGroups, sessions])

  const columns = useMemo(() => {
    return [
      {
        data: 0,
        readOnly: true,
      },
      ...sessions.map(() => ({
        type: "dropdown",
        source: ["D", "N", "A", "T"],
        strict: false,
        allowInvalid: false,
      })),
    ]
  }, [sessions])

  const colHeaders = useMemo(() => {
    return ["Gyventojas", ...sessions.map((session) => `${session.session_date} ${session.title}`)]
  }, [sessions])

  const colWidths = useMemo(() => [260, ...sessions.map(() => 155)], [sessions])

  async function saveGridChanges(changes: Array<[number, number | string, unknown, unknown]>) {
    if (!changes.length || !sessions.length || !filteredResidents.length) return

    const payload: AttendanceRow[] = []

    for (const [rowIndex, prop, _oldValue, newValue] of changes) {
      const colIndex = typeof prop === "number" ? prop : Number(prop)

      if (!Number.isFinite(colIndex)) continue
      if (colIndex === 0) continue

      const resident = filteredResidents[rowIndex]
      const session = sessions[colIndex - 1]

      if (!resident || !session) continue

      const normalizedCode = normalizeCode(newValue)
      const mappedStatus = codeToStatus(normalizedCode)

      if (!mappedStatus) continue

      payload.push({
        session_id: session.id,
        resident_id: resident.id,
        status: mappedStatus,
        note: null,
      })
    }

    if (!payload.length) return

    setSaving(true)
    setMessage("")

    const { error } = await supabase.from("activity_attendance").upsert(payload, {
      onConflict: "session_id,resident_id",
    })

    if (error) {
      setMessage(error.message || "Nepavyko išsaugoti pakeitimų.")
    } else {
      setAttendanceRows((prev) => {
        const next = [...prev]
        const indexMap = new Map<string, number>()

        next.forEach((row, index) => {
          indexMap.set(`${row.resident_id}__${row.session_id}`, index)
        })

        for (const item of payload) {
          const key = `${item.resident_id}__${item.session_id}`
          const existingIndex = indexMap.get(key)

          if (existingIndex === undefined) next.push(item)
          else next[existingIndex] = { ...next[existingIndex], status: item.status }
        }

        return next
      })

      setSavedCount((count) => count + payload.length)
      setSavedAt(new Date().toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    }

    setSaving(false)
  }

  async function handleAfterChange(changes: Array<[number, number | string, unknown, unknown]> | null, source: string) {
    if (!changes?.length) return
    if (source === "loadData") return
    await saveGridChanges(changes)
  }

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, ActivitySession[]>()

    for (const session of sessions) {
      const list = map.get(session.session_date) || []
      list.push(session)
      map.set(session.session_date, list)
    }

    return map
  }, [sessions])

  const selectedDaySessions = sessionsByDate.get(selectedCalendarDate) || []

  if (loading) return <div style={styles.loading}>Kraunama mėnesio veiklų lentelė...</div>

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.header}>
          <div style={styles.headerTop}>
            <div>
              <h1 style={styles.title}>Veiklų matrica</h1>
              <p style={styles.subtitle}>Kalendorius planavimui, Dalyviai greitam D / N / A / T suvedimui.</p>
            </div>

            <div style={styles.monthControls}>
              <button type="button" onClick={() => setMonthDate((prev) => addMonths(prev, -1))} style={styles.monthButton}>
                ← Ankstesnis
              </button>

              <div style={styles.monthLabel}>{formatMonthLabel(monthDate)}</div>

              <button type="button" onClick={() => setMonthDate((prev) => addMonths(prev, 1))} style={styles.monthButton}>
                Kitas →
              </button>
            </div>
          </div>

          <div style={styles.viewToggle}>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              style={viewMode === "calendar" ? styles.viewButtonActive : styles.viewButton}
            >
              <CalendarDays size={18} />
              Kalendorius
            </button>

            <button
              type="button"
              onClick={() => setViewMode("excel")}
              style={viewMode === "excel" ? styles.viewButtonActive : styles.viewButton}
            >
              <Grid3X3 size={18} />
              Dalyviai
            </button>
          </div>

          <div style={styles.createGrid}>
            <input
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              placeholder="Naujos veiklos pavadinimas"
              style={styles.input}
            />

            <input
              type="date"
              value={newSessionDate}
              onChange={(e) => setNewSessionDate(e.target.value)}
              style={styles.input}
            />

            <input
              type="time"
              value={newSessionStartTime}
              onChange={(e) => setNewSessionStartTime(e.target.value)}
              style={styles.input}
            />

            <input
              type="time"
              value={newSessionEndTime}
              onChange={(e) => setNewSessionEndTime(e.target.value)}
              style={styles.input}
            />

            <button type="button" onClick={() => void handleCreateSession()} disabled={creatingSession} style={styles.addButton}>
              {creatingSession ? "Kuriama..." : "Pridėti veiklą"}
            </button>
          </div>

          <div style={styles.filters}>
            <label style={styles.searchWrap}>
              <Search size={19} color="#94a3b8" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ieškoti gyventojo..." style={styles.searchInput} />
            </label>

            <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} style={styles.input}>
              <option value="">Visi kambariai</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name || room.id}
                </option>
              ))}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.input}>
              <option value="">Visi attendance statusai</option>
              <option value="D">Dalyvavo</option>
              <option value="N">Nedalyvavo</option>
              <option value="A">Atsisakė</option>
              <option value="T">Netaikoma</option>
            </select>

            <span style={styles.countPill}>Gyventojų: {filteredResidents.length}</span>
            <span style={styles.countPill}>Veiklų: {sessions.length}</span>
          </div>

          <div style={styles.statusLine}>
            <div style={styles.legend}>
              <span style={{ ...styles.legendPill, ...styles.legendD }}>D = dalyvavo</span>
              <span style={{ ...styles.legendPill, ...styles.legendN }}>N = nedalyvavo</span>
              <span style={{ ...styles.legendPill, ...styles.legendA }}>A = atsisakė</span>
              <span style={{ ...styles.legendPill, ...styles.legendT }}>T = netaikoma</span>
            </div>

            <div style={styles.saveBox}>
              <CheckCircle2 size={18} color="#059669" />
              <strong>{saving ? "Saugoma..." : savedCount > 0 ? `Išsaugota pakeitimų: ${savedCount}` : "Paruošta"}</strong>
              {savedAt ? <span>{savedAt}</span> : null}
              <button type="button" style={styles.refreshButton} onClick={() => void loadMonth()}>
                Atnaujinti <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {message ? <div style={styles.message}>{message}</div> : null}
        </section>

        {viewMode === "calendar" ? (
          <section style={styles.calendarShell}>
            <div style={styles.calendarGrid}>
              {monthDays.map((day) => {
                const key = toDateInput(day)
                const daySessions = sessionsByDate.get(key) || []
                const isSelected = key === selectedCalendarDate

                return (
                  <button
                    key={key}
                    type="button"
                    style={isSelected ? styles.calendarDayActive : styles.calendarDay}
                    onClick={() => {
                      setSelectedCalendarDate(key)
                      setNewSessionDate(key)
                    }}
                  >
                    <div style={styles.calendarDayTop}>
                      <strong>{calendarDayLabel(day)}</strong>
                      <span>{daySessions.length}</span>
                    </div>

                    <div style={styles.calendarActivities}>
                      {daySessions.slice(0, 6).map((session) => (
                        <div key={session.id} style={styles.calendarActivity}>
                          <strong>{toShortTime(session.start_time)}</strong> {session.title}
                        </div>
                      ))}

                      {daySessions.length > 6 ? <div style={styles.moreActivities}>+{daySessions.length - 6}</div> : null}
                      {daySessions.length === 0 ? <div style={styles.noActivities}>Nėra veiklų</div> : null}
                    </div>
                  </button>
                )
              })}
            </div>

            <div style={styles.dayPanel}>
              <h2 style={styles.dayPanelTitle}>{formatDayHeader(selectedCalendarDate)}</h2>
              <p style={styles.dayPanelSub}>Paspausk veiklą ir pereik į Excel matricą greitam lankomumo suvedimui.</p>

              <div style={styles.daySessions}>
                {selectedDaySessions.map((session) => (
                  <button key={session.id} type="button" style={styles.daySessionCard} onClick={() => setViewMode("excel")}>
                    <strong>{toShortTime(session.start_time)} {session.title}</strong>
                    <span>{session.end_time ? `Iki ${toShortTime(session.end_time)}` : "Be pabaigos laiko"}</span>
                  </button>
                ))}

                {selectedDaySessions.length === 0 ? <div style={styles.empty}>Šiai dienai veiklų nėra.</div> : null}
              </div>
            </div>
          </section>
        ) : (
          <section style={styles.tableShell}>
            {sessions.length === 0 ? (
              <div style={styles.empty}>Šiam mėnesiui veiklų dar nėra. Gyventojų: {filteredResidents.length}. Pridėk veiklą viršuje.</div>
            ) : (
              <>
                <HotTable
                  data={attendanceGridData}
                  colHeaders={colHeaders}
                  nestedHeaders={nestedHeaders}
                  columns={columns as any}
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
                    direction: "vertical",
                  }}
                  contextMenu={true}
                  outsideClickDeselects={false}
                  viewportRowRenderingOffset={40}
                  viewportColumnRenderingOffset={20}
                  enterMoves={{ row: 1, col: 0 }}
                  tabMoves={{ row: 0, col: 1 }}
                  licenseKey="non-commercial-and-evaluation"
                  themeName="ht-theme-classic"
                  afterChange={(changes, source) => void handleAfterChange(changes as any, source)}
                  cells={(row, col) => {
                    const cellProperties: Handsontable.CellProperties = {}

                    if (col === 0) {
                      cellProperties.readOnly = true
                      cellProperties.className = "vg-person-cell"
                      return cellProperties
                    }

                    const value = attendanceGridData[row]?.[col]

                    if (value === "D") cellProperties.className = "vg-status-d"
                    else if (value === "N") cellProperties.className = "vg-status-n"
                    else if (value === "A") cellProperties.className = "vg-status-a"
                    else if (value === "T") cellProperties.className = "vg-status-t"
                    else cellProperties.className = "vg-status-empty"

                    return cellProperties
                  }}
                />

                <div style={styles.hint}>
                  <Info size={18} />
                  <span>
                    Excel režimas: copy/paste veikia, langelio kampą galima tempti žemyn, Enter juda žemyn, Tab juda į dešinę.
                  </span>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  loading: { padding: 24, color: "#64748b", fontSize: 14 },
  page: { minHeight: "100vh", background: "#f8fafc", padding: 22, color: "#0f172a" },
  shell: { maxWidth: 1680, margin: "0 auto", display: "grid", gap: 16 },
  header: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 22, padding: 22, boxShadow: "0 10px 28px rgba(15,23,42,.055)" },
  headerTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 },
  title: { margin: 0, color: "#0f172a", fontSize: 36, lineHeight: 1, fontWeight: 950, letterSpacing: "-0.04em" },
  subtitle: { margin: "8px 0 0", color: "#64748b", fontSize: 15, fontWeight: 700 },
  monthControls: { display: "flex", alignItems: "center", gap: 14 },
  monthButton: { height: 50, border: "1px solid #dbe3ef", background: "#ffffff", color: "#0f172a", borderRadius: 16, padding: "0 22px", fontWeight: 900, cursor: "pointer", boxShadow: "0 6px 16px rgba(15,23,42,.04)" },
  monthLabel: { height: 50, minWidth: 230, border: "1px solid #dbe3ef", background: "#f8fafc", color: "#0f172a", borderRadius: 16, padding: "0 22px", fontWeight: 950, display: "flex", alignItems: "center", justifyContent: "center", textTransform: "capitalize" },
  viewToggle: { marginTop: 22, display: "flex", gap: 10, background: "#f8fafc", border: "1px solid #e2e8f0", padding: 6, borderRadius: 16, width: "fit-content" },
  viewButton: { border: "none", background: "transparent", borderRadius: 12, padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900, color: "#64748b", cursor: "pointer" },
  viewButtonActive: { border: "none", background: "#ffffff", borderRadius: 12, padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 950, color: "#047857", cursor: "pointer", boxShadow: "0 8px 18px rgba(15,23,42,.08)" },
  createGrid: { marginTop: 22, display: "grid", gridTemplateColumns: "1.4fr .75fr .8fr .8fr .9fr", gap: 14 },
  input: { width: "100%", height: 54, border: "1px solid #dbe3ef", borderRadius: 15, padding: "0 18px", fontSize: 15, color: "#0f172a", background: "#ffffff", outline: "none", boxSizing: "border-box" },
  addButton: { border: "none", height: 54, borderRadius: 15, background: "#059669", color: "#ffffff", fontSize: 15, fontWeight: 950, cursor: "pointer" },
  filters: { marginTop: 24, display: "grid", gridTemplateColumns: "1.4fr .9fr .95fr auto auto", gap: 14, alignItems: "center" },
  searchWrap: { height: 54, border: "1px solid #dbe3ef", borderRadius: 15, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", boxSizing: "border-box" },
  searchInput: { border: "none", outline: "none", flex: 1, fontSize: 15, background: "transparent" },
  countPill: { height: 54, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", borderRadius: 999, padding: "0 18px", display: "flex", alignItems: "center", fontWeight: 850, whiteSpace: "nowrap" },
  statusLine: { marginTop: 24, display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" },
  legend: { display: "flex", flexWrap: "wrap", gap: 10 },
  legendPill: { borderRadius: 12, padding: "11px 16px", fontWeight: 950, border: "1px solid" },
  legendD: { background: "#dcfce7", color: "#059669", borderColor: "#a7f3d0" },
  legendN: { background: "#fee2e2", color: "#dc2626", borderColor: "#fecaca" },
  legendA: { background: "#fef3c7", color: "#ea580c", borderColor: "#fde68a" },
  legendT: { background: "#f1f5f9", color: "#334155", borderColor: "#dbe3ef" },
  saveBox: { minHeight: 54, background: "#ecfdf5", color: "#047857", border: "1px solid #bbf7d0", borderRadius: 14, padding: "0 14px", display: "flex", alignItems: "center", gap: 12 },
  refreshButton: { border: "1px solid #dbe3ef", background: "#ffffff", color: "#0f172a", borderRadius: 12, height: 38, padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900, cursor: "pointer" },
  message: { marginTop: 14, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, color: "#475569", fontWeight: 750 },
  tableShell: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 16, boxShadow: "0 20px 50px rgba(15,23,42,.08)" },
  calendarShell: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 16 },
  calendarGrid: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 22, padding: 12, display: "grid", gridTemplateColumns: "repeat(7, minmax(132px, 1fr))", gap: 8, boxShadow: "0 10px 28px rgba(15,23,42,.055)", overflowX: "auto" },
  calendarDay: { minHeight: 132, border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 14, padding: 9, textAlign: "left", display: "grid", alignContent: "start", gap: 7, cursor: "pointer" },
  calendarDayActive: { minHeight: 132, border: "1px solid #047857", background: "#ecfdf5", borderRadius: 14, padding: 9, textAlign: "left", display: "grid", alignContent: "start", gap: 7, cursor: "pointer", boxShadow: "0 0 0 2px rgba(4,120,87,.08)" },
  calendarDayTop: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", color: "#0f172a" },
  calendarActivities: { display: "grid", gap: 6 },
  calendarActivity: { background: "#eef6ff", color: "#1e3a8a", border: "1px solid #bfdbfe", borderRadius: 8, padding: "4px 6px", fontSize: 11, fontWeight: 850, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  moreActivities: { color: "#047857", fontSize: 12, fontWeight: 950 },
  noActivities: { color: "#94a3b8", fontSize: 12, fontWeight: 750 },
  dayPanel: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 22, padding: 16, display: "grid", alignContent: "start", gap: 12, boxShadow: "0 10px 28px rgba(15,23,42,.055)" },
  dayPanelTitle: { margin: 0, fontSize: 24, fontWeight: 950 },
  dayPanelSub: { margin: 0, color: "#64748b", fontWeight: 700, lineHeight: 1.45 },
  daySessions: { display: "grid", gap: 10 },
  daySessionCard: { border: "1px solid #dbe3ef", background: "#f8fafc", borderRadius: 14, padding: 12, textAlign: "left", display: "grid", gap: 4, cursor: "pointer" },
  hint: { marginTop: 16, background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 12, color: "#64748b", padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, fontWeight: 750 },
  empty: { border: "1px dashed #cbd5e1", borderRadius: 18, padding: 26, textAlign: "center", color: "#64748b", background: "#f8fafc" },
}
