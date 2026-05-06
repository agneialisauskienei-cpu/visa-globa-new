"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Info, RefreshCw, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/current-organization"

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

const codeOptions: Array<{ code: CellCode; label: string; status: AttendanceStatus | null }> = [
  { code: "", label: "—", status: null },
  { code: "D", label: "D", status: "attended" },
  { code: "N", label: "N", status: "absent" },
  { code: "A", label: "A", status: "refused" },
  { code: "T", label: "T", status: "not_applicable" },
]

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

function cellStyle(code: CellCode): React.CSSProperties {
  if (code === "D") return styles.cellD
  if (code === "N") return styles.cellN
  if (code === "A") return styles.cellA
  if (code === "T") return styles.cellT
  return styles.cellEmpty
}

export default function ActivitiesGridPage() {
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

  const monthStart = useMemo(() => startOfMonth(monthDate), [monthDate])
  const monthEnd = useMemo(() => endOfMonth(monthDate), [monthDate])

  useEffect(() => {
    setNewSessionDate(toDateInput(monthStart))
  }, [monthStart])

  useEffect(() => {
    void loadMonth()
  }, [monthDate])

  async function getAccessToken() {
    const { data: { session }, error } = await supabase.auth.getSession()
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

    setCreatingSession(true)
    setMessage("")

    try {
      const accessToken = await getAccessToken()

      const response = await fetch("/api/activity-sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newSessionTitle.trim(),
          session_date: newSessionDate,
          start_time: newSessionStartTime || null,
          end_time: newSessionEndTime || null,
        }),
      })

      const payload = await response.json()

      if (!response.ok) throw new Error(payload?.message || "Nepavyko sukurti veiklos.")

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
    for (const row of attendanceRows) map.set(`${row.resident_id}__${row.session_id}`, row)
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
    if (statusFilter) rows = rows.filter((resident) => sessions.some((session) => getCode(resident.id, session.id) === statusFilter))

    return rows
  }, [residents, search, roomFilter, statusFilter, rooms, sessions, attendanceRows])

  const dayGroups = useMemo(() => {
    const groups: Array<{ date: string; count: number }> = []
    for (const session of sessions) {
      const last = groups[groups.length - 1]
      if (!last || last.date !== session.session_date) groups.push({ date: session.session_date, count: 1 })
      else last.count += 1
    }
    return groups
  }, [sessions])

  async function updateAttendance(residentId: string, sessionId: string, code: string) {
    const normalized = normalizeCode(code)
    const mappedStatus = codeToStatus(normalized)
    if (!organizationId || !mappedStatus) return

    setSaving(true)
    setMessage("")

    const payload: AttendanceRow = { session_id: sessionId, resident_id: residentId, status: mappedStatus, note: null }

    const { error } = await supabase.from("activity_attendance").upsert([payload], {
      onConflict: "session_id,resident_id",
    })

    if (error) {
      setMessage(error.message || "Nepavyko išsaugoti pakeitimo.")
      setSaving(false)
      return
    }

    setAttendanceRows((prev) => {
      const key = `${residentId}__${sessionId}`
      const found = prev.findIndex((row) => `${row.resident_id}__${row.session_id}` === key)
      if (found === -1) return [...prev, payload]
      const next = [...prev]
      next[found] = { ...next[found], status: mappedStatus }
      return next
    })

    setSavedCount((count) => count + 1)
    setSavedAt(new Date().toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    setSaving(false)
  }

  if (loading) return <div style={styles.loading}>Kraunama mėnesio veiklų lentelė...</div>

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.header}>
          <div style={styles.headerTop}>
            <div>
              <h1 style={styles.title}>Veiklų matrica</h1>
              <p style={styles.subtitle}>Vienas mėnuo per ekraną, kelios veiklos vienai dienai, Excel tipo redagavimas.</p>
            </div>

            <div style={styles.monthControls}>
              <button type="button" onClick={() => setMonthDate((prev) => addMonths(prev, -1))} style={styles.monthButton}>← Ankstesnis</button>
              <div style={styles.monthLabel}>{formatMonthLabel(monthDate)}</div>
              <button type="button" onClick={() => setMonthDate((prev) => addMonths(prev, 1))} style={styles.monthButton}>Kitas →</button>
            </div>
          </div>

          <div style={styles.createGrid}>
            <input value={newSessionTitle} onChange={(e) => setNewSessionTitle(e.target.value)} placeholder="Naujos veiklos pavadinimas" style={styles.input} />
            <input type="date" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)} style={styles.input} />
            <input type="time" value={newSessionStartTime} onChange={(e) => setNewSessionStartTime(e.target.value)} style={styles.input} />
            <input type="time" value={newSessionEndTime} onChange={(e) => setNewSessionEndTime(e.target.value)} style={styles.input} />
            <button type="button" onClick={() => void handleCreateSession()} disabled={creatingSession} style={styles.addButton}>{creatingSession ? "Kuriama..." : "Pridėti veiklą"}</button>
          </div>

          <div style={styles.filters}>
            <label style={styles.searchWrap}>
              <Search size={19} color="#94a3b8" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ieškoti gyventojo..." style={styles.searchInput} />
            </label>

            <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} style={styles.input}>
              <option value="">Visi kambariai</option>
              {rooms.map((room) => <option key={room.id} value={room.id}>{room.name || room.id}</option>)}
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
              <button type="button" style={styles.refreshButton} onClick={() => void loadMonth()}>Atnaujinti <RefreshCw size={15} /></button>
            </div>
          </div>

          {message ? <div style={styles.message}>{message}</div> : null}
        </section>

        <section style={styles.tableShell}>
          {sessions.length === 0 ? (
            <div style={styles.empty}>Šiam mėnesiui veiklų dar nėra.</div>
          ) : (
            <>
              <div style={styles.matrixScroll}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ ...styles.rowNumberHead, ...styles.stickyLeft0 }} />
                      <th rowSpan={2} style={{ ...styles.personHead, ...styles.stickyLeft1 }}>Gyventojas</th>
                      {dayGroups.map((group) => <th key={group.date} colSpan={group.count} style={styles.dayHead}>{formatDayHeader(group.date)}</th>)}
                    </tr>
                    <tr>
                      {sessions.map((session) => <th key={session.id} style={styles.sessionHead}>{toShortTime(session.start_time)} {session.title}</th>)}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredResidents.map((resident, rowIndex) => (
                      <tr key={resident.id}>
                        <td style={{ ...styles.rowNumber, ...styles.stickyLeft0 }}>{rowIndex + 1}</td>
                        <td style={{ ...styles.personCell, ...styles.stickyLeft1 }}>
                          <strong>{residentName(resident)}</strong>
                          <span>Kambarys: {roomName(resident.current_room_id)}</span>
                        </td>

                        {sessions.map((session) => {
                          const value = getCode(resident.id, session.id)
                          return (
                            <td key={`${resident.id}-${session.id}`} style={styles.statusCellWrap}>
                              <select value={value} onChange={(event) => void updateAttendance(resident.id, session.id, event.target.value)} style={{ ...styles.statusCell, ...cellStyle(value) }}>
                                {codeOptions.map((option) => <option key={option.code || "empty"} value={option.code}>{option.label}</option>)}
                              </select>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={styles.hint}><Info size={18} /><span>Spauskite į langelį ir rinkitės: D / N / A / T. Statusas išsaugomas automatiškai.</span></div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  loading: { padding: 24, color: "#64748b", fontSize: 14 },
  page: { minHeight: "100vh", background: "#f8fafc", padding: 22, color: "#0f172a" },
  shell: { maxWidth: 1680, margin: "0 auto", display: "grid", gap: 16 },
  header: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 28, boxShadow: "0 20px 50px rgba(15,23,42,.08)" },
  headerTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 },
  title: { margin: 0, color: "#0f172a", fontSize: 44, lineHeight: 1, fontWeight: 950, letterSpacing: "-0.05em" },
  subtitle: { margin: "12px 0 0", color: "#64748b", fontSize: 17, fontWeight: 700 },
  monthControls: { display: "flex", alignItems: "center", gap: 14 },
  monthButton: { height: 50, border: "1px solid #dbe3ef", background: "#ffffff", color: "#0f172a", borderRadius: 16, padding: "0 22px", fontWeight: 900, cursor: "pointer", boxShadow: "0 6px 16px rgba(15,23,42,.04)" },
  monthLabel: { height: 50, minWidth: 230, border: "1px solid #dbe3ef", background: "#f8fafc", color: "#0f172a", borderRadius: 16, padding: "0 22px", fontWeight: 950, display: "flex", alignItems: "center", justifyContent: "center", textTransform: "capitalize" },
  createGrid: { marginTop: 28, display: "grid", gridTemplateColumns: "1.4fr .75fr .8fr .8fr .9fr", gap: 14 },
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
  matrixScroll: { border: "1px solid #dbe3ef", borderRadius: 18, overflow: "auto", maxHeight: "72vh", background: "#ffffff" },
  table: { width: "100%", minWidth: 1050, borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" },
  rowNumberHead: { width: 48, background: "#f1f5f9", borderRight: "1px solid #dbe3ef", borderBottom: "1px solid #dbe3ef", zIndex: 8 },
  personHead: { width: 230, background: "#f1f5f9", color: "#1e293b", fontSize: 19, fontWeight: 950, borderRight: "1px solid #dbe3ef", borderBottom: "1px solid #dbe3ef", zIndex: 8 },
  stickyLeft0: { position: "sticky", left: 0, zIndex: 5 },
  stickyLeft1: { position: "sticky", left: 48, zIndex: 5 },
  dayHead: { background: "#dbeafe", color: "#1e3a8a", fontSize: 17, fontWeight: 950, textAlign: "center", height: 48, borderRight: "1px solid #bfdbfe", borderBottom: "1px solid #bfdbfe" },
  sessionHead: { background: "#1e4f83", color: "#ffffff", fontSize: 16, fontWeight: 950, textAlign: "center", height: 48, borderRight: "1px solid #93c5fd", borderBottom: "1px solid #93c5fd" },
  rowNumber: { width: 48, background: "#f8fafc", color: "#475569", textAlign: "center", borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", fontWeight: 750 },
  personCell: { background: "#ffffff", borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", padding: "10px 14px", display: "grid", gap: 4, minHeight: 68 },
  statusCellWrap: { borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", padding: 3, height: 68 },
  statusCell: { width: "100%", height: "100%", borderRadius: 8, border: "2px solid transparent", padding: "0 14px", fontSize: 22, fontWeight: 950, outline: "none", cursor: "pointer" },
  cellD: { background: "#dcfce7", color: "#15803d", border: "2px solid #86efac" },
  cellN: { background: "#fee2e2", color: "#dc2626", border: "2px solid #fca5a5" },
  cellA: { background: "#fef3c7", color: "#c2410c", border: "2px solid #facc15" },
  cellT: { background: "#fef9c3", color: "#854d0e", border: "2px solid #fde047" },
  cellEmpty: { background: "#ffffff", color: "#475569", border: "2px solid #e2e8f0" },
  hint: { marginTop: 16, background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 12, color: "#64748b", padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, fontWeight: 750 },
  empty: { border: "1px dashed #cbd5e1", borderRadius: 18, padding: 26, textAlign: "center", color: "#64748b", background: "#f8fafc" },
}
