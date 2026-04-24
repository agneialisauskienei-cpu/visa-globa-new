"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/current-organization"

type AuditLog = {
  id: string
  organization_id: string | null
  table_name: string
  record_id: string | null
  action: string
  changed_by: string | null
  changed_at: string | null
  created_at?: string | null
  changes: Record<string, unknown> | null
}

type Profile = {
  id: string
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

type Resident = {
  id: string
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  resident_code?: string | null
  current_room_id?: string | null
}

type Room = {
  id: string
  name?: string | null
}

type Task = {
  id: string
  title?: string | null
  resident_id?: string | null
}

const TABLE_LABELS: Record<string, string> = {
  residents: "Gyventojai",
  resident_contacts: "Kontaktai",
  resident_care_plans: "Globos planai",
  resident_daily_logs: "Kasdieniai įrašai",
  resident_incidents: "Incidentai",
  rooms: "Kambariai",
  tasks: "Užduotys",
  task_comments: "Užduočių komentarai",
  inventory_items: "Sandėlio prekės",
  inventory_issue_history: "Sandėlio istorija",
  inventory_transactions: "Sandėlio judėjimai",
  organization_members: "Darbuotojai",
  profiles: "Naudotojų profiliai",
  organization_invites: "Kvietimai",
  handover_logs: "Perdavimo žurnalai",
  handover_log_items: "Perdavimo žurnalo įrašai",
  reports: "Ataskaitos",
  report_exports: "Ataskaitų eksportai",
  medications: "Medicina",
  resident_medications: "Gyventojo vaistai",
  medication_administrations: "Vaistų administravimas",
  medication_logs: "Vaistų žurnalas",
  medicine_logs: "Medicinos žurnalas",
  resident_health_records: "Sveikatos įrašai",
  resident_vitals: "Gyvybiniai rodikliai",
  resident_medical_notes: "Medicininės pastabos",
}

const FIELD_LABELS: Record<string, string> = {
  title: "Pavadinimas",
  description: "Aprašymas",
  status: "Statusas",
  current_status: "Statusas",
  priority: "Prioritetas",
  assigned_to: "Atsakingas darbuotojas",
  created_by: "Sukūrė",
  resident_id: "Gyventojas",
  resident_name: "Gyventojas",
  category: "Kategorija",
  department: "Skyrius",
  due_date: "Terminas",
  completed_at: "Užbaigta",
  recurrence_days: "Kartojimas",
  recurrence_until: "Kartoti iki",
  recurrence_parent_id: "Periodinės užduoties šaltinis",
  first_name: "Vardas",
  last_name: "Pavardė",
  full_name: "Vardas ir pavardė",
  resident_code: "Vidinis ID",
  birth_date: "Gimimo data",
  arrival_date: "Atvykimo data",
  current_room_id: "Kambarys",
  room_id: "Kambarys",
  room: "Kambarys",
  room_reserved_until: "Rezervuota iki",
  phone: "Telefonas",
  email: "El. paštas",
  address: "Adresas",
  notes: "Pastabos",
  name: "Pavadinimas",
  room_type: "Tipas",
  capacity: "Vietos",
  floor: "Aukštas",
  gender: "Lytis",
  occupied_by: "Užimta",
  reserved_for: "Rezervuota",
  reserved_until: "Rezervuota iki",
  room_status: "Kambario būsena",
  role: "Rolė",
  legacy_role: "Rolė",
  is_active: "Aktyvus",
  accepted_at: "Priimta",
  expires_at: "Galioja iki",
  invited_by: "Pakvietė",
  token: "Kvietimo kodas",
  item_name: "Prekė",
  item_id: "Prekė",
  quantity: "Kiekis",
  unit: "Mato vnt.",
  type: "Tipas",
  employee_full_name: "Darbuotojas",
  action: "Veiksmas",
  Veiksmas: "Veiksmas",
  Pavadinimas: "Pavadinimas",
  Statusas: "Statusas",
  Kambarys: "Kambarys",
  Gyventojas: "Gyventojas",
  Atsakingas: "Atsakingas darbuotojas",
  Kartojimas: "Kartojimas",
}

const VALUE_LABELS: Record<string, string> = {
  insert: "Sukurta",
  update: "Atnaujinta",
  delete: "Ištrinta",
  pending: "Laukia patvirtinimo",
  accepted: "Priimtas",
  expired: "Pasibaigęs",
  cancelled: "Atšauktas",
  new: "Nauja",
  assigned: "Priskirta",
  in_progress: "Vykdoma",
  waiting: "Laukia informacijos",
  done: "Atlikta",
  overdue: "Pavėluota",
  arriving_soon: "Netrukus atvyks",
  active: "Gyvena",
  hospital: "Ligoninėje",
  temporary_leave: "Laikinai išvykęs",
  deceased: "Mirė",
  contract_ended: "Nutraukė sutartį",
  low: "Žemas",
  medium: "Vidutinis",
  high: "Aukštas",
  critical: "Kritinis",
  available: "Laisvas",
  occupied: "Užimtas",
  reserved: "Rezervuotas",
  owner: "Savininkas",
  admin: "Administratorius",
  employee: "Darbuotojas",
  male: "Vyrai",
  female: "Moterys",
  mixed: "Mišrus",
  true: "Taip",
  false: "Ne",
}

function tableLabel(value: string) {
  return TABLE_LABELS[value] || value || "—"
}

function fieldLabel(value: string) {
  return FIELD_LABELS[value] || value || "—"
}

function actionLabel(value: string) {
  return VALUE_LABELS[value] || value || "—"
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("lt-LT")
}

function profileName(profile?: Profile | null) {
  if (!profile) return null
  const fullName = String(profile.full_name || "").trim()
  const firstName = String(profile.first_name || "").trim()
  const lastName = String(profile.last_name || "").trim()
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim()
  return fullName || combined || profile.email || null
}

function residentName(resident?: Resident | null, roomsById?: Record<string, string>) {
  if (!resident) return null
  const fullName = String(resident.full_name || "").trim()
  const firstName = String(resident.first_name || "").trim()
  const lastName = String(resident.last_name || "").trim()
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim()
  const name = fullName || combined || "Gyventojas"
  const code = resident.resident_code ? ` · ${resident.resident_code}` : ""
  const room = resident.current_room_id && roomsById?.[resident.current_room_id] ? ` · ${roomsById[resident.current_room_id]}` : ""
  return `${name}${code}${room}`
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [tableFilter, setTableFilter] = useState("")

  const [profilesById, setProfilesById] = useState<Record<string, string>>({})
  const [residentsById, setResidentsById] = useState<Record<string, string>>({})
  const [roomsById, setRoomsById] = useState<Record<string, string>>({})
  const [tasksById, setTasksById] = useState<Record<string, string>>({})

  useEffect(() => {
    void loadLogs()
  }, [])

  async function loadLogs() {
    try {
      setLoading(true)
      setMessage("")

      const orgId = await getCurrentOrganizationId()

      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(1000)

      if (error) throw error

      const auditRows = (data || []) as AuditLog[]
      setLogs(auditRows)

      const userIds = Array.from(
        new Set(
          auditRows
            .flatMap((row) => {
              const ids: string[] = []
              if (row.changed_by) ids.push(row.changed_by)
              Object.entries(row.changes || {}).forEach(([key, value]) => {
                const pushValue = (v: unknown) => {
                  if (typeof v === "string" && isUuidLike(v)) ids.push(v)
                }

                if (key === "assigned_to" || key === "created_by" || key === "invited_by") {
                  if (value && typeof value === "object" && "from" in value && "to" in value) {
                    const item = value as { from: unknown; to: unknown }
                    pushValue(item.from)
                    pushValue(item.to)
                  } else {
                    pushValue(value)
                  }
                }
              })
              return ids
            })
            .filter(Boolean)
        )
      )

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, first_name, last_name, email")
          .in("id", userIds)

        setProfilesById(
          Object.fromEntries(
            ((profilesData || []) as Profile[]).map((profile) => [
              profile.id,
              profileName(profile) || profile.id,
            ])
          )
        )
      } else {
        setProfilesById({})
      }

      if (orgId) {
        const [residentsResult, roomsResult, tasksResult] = await Promise.all([
          supabase
            .from("residents")
            .select("id, full_name, first_name, last_name, resident_code, current_room_id")
            .eq("organization_id", orgId),

          supabase
            .from("rooms")
            .select("id, name")
            .eq("organization_id", orgId),

          supabase
            .from("tasks")
            .select("id, title, resident_id")
            .eq("organization_id", orgId),
        ])

        const roomMap = Object.fromEntries(
          ((roomsResult.data || []) as Room[]).map((room) => [
            room.id,
            room.name || "Kambarys",
          ])
        )

        const residentMap = Object.fromEntries(
          ((residentsResult.data || []) as Resident[]).map((resident) => [
            resident.id,
            residentName(resident, roomMap) || resident.id,
          ])
        )

        const taskMap = Object.fromEntries(
          ((tasksResult.data || []) as Task[]).map((task) => [
            task.id,
            [task.title || "Užduotis", task.resident_id ? residentMap[task.resident_id] : null]
              .filter(Boolean)
              .join(" · "),
          ])
        )

        setRoomsById(roomMap)
        setResidentsById(residentMap)
        setTasksById(taskMap)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko įkelti audito žurnalo.")
    } finally {
      setLoading(false)
    }
  }

  function cleanValue(value: unknown, key?: string) {
    if (value === null || value === undefined || value === "") return "—"
    if (typeof value === "boolean") return value ? "Taip" : "Ne"

    if (key === "recurrence_days") {
      const n = Number(value)
      return n > 0 ? `Kas ${n} d.` : "—"
    }

    const str = String(value)

    if (
      key === "assigned_to" ||
      key === "created_by" ||
      key === "invited_by" ||
      key === "changed_by"
    ) {
      return profilesById[str] || str
    }

    if (
      key === "resident_id" ||
      key === "resident_name" ||
      key === "resident" ||
      key === "occupied_by" ||
      key === "reserved_for" ||
      key === "Gyventojas"
    ) {
      return residentsById[str] || str
    }

    if (
      key === "current_room_id" ||
      key === "room_id" ||
      key === "room" ||
      key === "Kambarys"
    ) {
      return roomsById[str] || str
    }

    if (key === "task_id" || key === "recurrence_parent_id") {
      return tasksById[str] || str
    }

    if (VALUE_LABELS[str]) return VALUE_LABELS[str]

    if (isUuidLike(str)) {
      return profilesById[str] || residentsById[str] || roomsById[str] || tasksById[str] || str
    }

    return str
  }

  function renderChangeValue(key: string, value: unknown) {
    if (value && typeof value === "object" && "from" in value && "to" in value) {
      const item = value as { from: unknown; to: unknown }

      return (
        <span style={styles.changeValue}>
          {cleanValue(item.from, key)} → {cleanValue(item.to, key)}
        </span>
      )
    }

    return <span style={styles.changeValue}>{cleanValue(value, key)}</span>
  }

  function renderChanges(changes: Record<string, unknown> | null) {
    if (!changes || Object.keys(changes).length === 0) {
      return <span style={styles.muted}>—</span>
    }

    if ("old" in changes || "new" in changes) {
      return (
        <div style={styles.changeItem}>
          <strong>Įrašas</strong>
          <span style={styles.changeValue}>Pakeistas</span>
        </div>
      )
    }

    return (
      <div style={styles.changesList}>
        {Object.entries(changes).map(([key, value]) => (
          <div key={key} style={styles.changeItem}>
            <strong>{fieldLabel(key)}</strong>
            {renderChangeValue(key, value)}
          </div>
        ))}
      </div>
    )
  }

  function recordName(log: AuditLog) {
    if (!log.record_id) return "—"
    if (log.table_name === "residents") return residentsById[log.record_id] || log.record_id
    if (log.table_name === "rooms") return roomsById[log.record_id] || log.record_id
    if (log.table_name === "tasks") return tasksById[log.record_id] || log.record_id
    return log.record_id
  }

  const tableOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.table_name))).sort((a, b) =>
      tableLabel(a).localeCompare(tableLabel(b), "lt")
    )
  }, [logs])

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase()

    return logs.filter((log) => {
      if (actionFilter && log.action !== actionFilter) return false
      if (tableFilter && log.table_name !== tableFilter) return false

      if (!q) return true

      return [
        log.table_name,
        tableLabel(log.table_name),
        log.action,
        actionLabel(log.action),
        log.record_id,
        recordName(log),
        log.changed_by,
        JSON.stringify(log.changes || {}),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [logs, search, actionFilter, tableFilter, profilesById, residentsById, roomsById, tasksById])

  return (
    <div style={styles.page}>
      <div style={styles.headerTop}>
        <Link href="/admin-dashboard" style={styles.back}>
          <ArrowLeft size={16} />
          Grįžti
        </Link>

        <button type="button" onClick={() => void loadLogs()} style={styles.refreshButton}>
          <RefreshCw size={16} />
          Atnaujinti
        </button>
      </div>

      <section style={styles.hero}>
        <div style={styles.heroIcon}>
          <ShieldCheck size={28} />
        </div>

        <div>
          <div style={styles.eyebrow}>Sistemos kontrolė</div>
          <h1 style={styles.title}>Audito žurnalas</h1>
          <p style={styles.subtitle}>Kas, ką ir kada keitė sistemoje.</p>
        </div>
      </section>

      {message ? <div style={styles.message}>{message}</div> : null}

      <section style={styles.filters}>
        <label style={styles.field}>
          <span>Paieška</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ieškoti pagal modulį, veiksmą, pakeitimą..."
            style={styles.input}
          />
        </label>

        <label style={styles.field}>
          <span>Veiksmas</span>
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} style={styles.input}>
            <option value="">Visi</option>
            <option value="insert">Sukurta</option>
            <option value="update">Atnaujinta</option>
            <option value="delete">Ištrinta</option>
          </select>
        </label>

        <label style={styles.field}>
          <span>Lentelė</span>
          <select value={tableFilter} onChange={(event) => setTableFilter(event.target.value)} style={styles.input}>
            <option value="">Visos</option>
            {tableOptions.map((table) => (
              <option key={table} value={table}>
                {tableLabel(table)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            setSearch("")
            setActionFilter("")
            setTableFilter("")
          }}
          style={styles.clearButton}
        >
          Valyti
        </button>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.sectionTitle}>Įrašai</h2>
          <div style={styles.meta}>{loading ? "Kraunama..." : `Rodoma: ${filteredLogs.length}`}</div>
        </div>

        {filteredLogs.length === 0 ? (
          <div style={styles.empty}>Audito įrašų nėra.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Data</th>
                  <th style={styles.th}>Veiksmas</th>
                  <th style={styles.th}>Vieta</th>
                  <th style={styles.th}>Įrašas</th>
                  <th style={styles.th}>Pakeitimai</th>
                </tr>
              </thead>

              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={styles.td}>{formatDate(log.changed_at || log.created_at)}</td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          ...(log.action === "delete"
                            ? styles.badgeDanger
                            : log.action === "insert"
                              ? styles.badgeSuccess
                              : styles.badgeInfo),
                        }}
                      >
                        {actionLabel(log.action)}
                      </span>
                    </td>

                    <td style={styles.tdBold}>{tableLabel(log.table_name)}</td>

                    <td style={styles.td}>
                      <strong>{recordName(log)}</strong>
                      {log.record_id && recordName(log) !== log.record_id ? (
                        <div style={styles.sub}>{log.record_id}</div>
                      ) : null}
                    </td>

                    <td style={styles.td}>{renderChanges(log.changes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 24, display: "grid", gap: 18 },
  headerTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  back: { display: "inline-flex", alignItems: "center", gap: 8, color: "#047857", textDecoration: "none", fontSize: 14, fontWeight: 900 },
  refreshButton: { border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857", borderRadius: 13, padding: "10px 13px", fontSize: 13, fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 },
  hero: { display: "flex", alignItems: "center", gap: 16, background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e5e7eb", borderRadius: 24, padding: 22 },
  heroIcon: { width: 58, height: 58, borderRadius: 18, background: "#ecfdf5", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center" },
  eyebrow: { color: "#047857", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" },
  title: { margin: "4px 0", color: "#0f172a", fontSize: 34, fontWeight: 950 },
  subtitle: { margin: 0, color: "#64748b", fontSize: 15, fontWeight: 700 },
  message: { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", borderRadius: 16, padding: 13, fontSize: 14, fontWeight: 800 },
  filters: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 20, padding: 16, display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 180px 220px auto", gap: 12, alignItems: "end" },
  field: { display: "grid", gap: 6, color: "#334155", fontSize: 12, fontWeight: 850 },
  input: { width: "100%", border: "1px solid #d1d5db", borderRadius: 13, padding: "10px 11px", fontSize: 14, boxSizing: "border-box" },
  clearButton: { border: "none", background: "#f1f5f9", color: "#0f172a", borderRadius: 13, padding: "11px 13px", fontSize: 13, fontWeight: 900, cursor: "pointer" },
  card: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 22, padding: 20, display: "grid", gap: 14, overflowX: "auto" },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  sectionTitle: { margin: 0, color: "#0f172a", fontSize: 22, fontWeight: 950 },
  meta: { color: "#64748b", fontSize: 13, fontWeight: 850 },
  empty: { padding: 22, border: "1px dashed #cbd5e1", borderRadius: 16, color: "#64748b", textAlign: "center", fontSize: 14, fontWeight: 750 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", minWidth: 1080, borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e5e7eb", color: "#475569", fontWeight: 900 },
  td: { padding: "12px 10px", borderBottom: "1px solid #f1f5f9", color: "#334155", fontWeight: 650, verticalAlign: "top" },
  tdBold: { padding: "12px 10px", borderBottom: "1px solid #f1f5f9", color: "#0f172a", fontWeight: 900, verticalAlign: "top" },
  badge: { display: "inline-flex", borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 900 },
  badgeSuccess: { background: "#dcfce7", color: "#166534" },
  badgeInfo: { background: "#dbeafe", color: "#1d4ed8" },
  badgeDanger: { background: "#fee2e2", color: "#b91c1c" },
  sub: { color: "#64748b", fontSize: 11, fontWeight: 650, wordBreak: "break-all", marginTop: 4 },
  muted: { color: "#94a3b8" },
  changesList: { display: "grid", gap: 5 },
  changeItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "7px 10px", maxWidth: 560, fontSize: 12 },
  changeValue: { color: "#64748b", fontWeight: 750, textAlign: "right", wordBreak: "break-word" },
}
