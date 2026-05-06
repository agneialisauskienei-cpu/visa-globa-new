"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Archive,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Plus,
  RefreshCw,
  ShieldAlert,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/current-organization"

type Priority = "low" | "medium" | "high" | "critical"
type ShiftType = "morning" | "day" | "evening" | "night" | "other"

type Resident = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  resident_code: string | null
  current_room_id: string | null
}

type Room = {
  id: string
  name: string | null
}

type Profile = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
}

type HandoverLog = {
  id: string
  organization_id: string
  resident_id: string | null
  shift_date: string
  shift_type: ShiftType
  category: string
  priority: Priority
  title: string
  note: string
  is_important: boolean
  needs_follow_up: boolean
  follow_up_task_id: string | null
  archived: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string | null
}

type Ack = {
  id: string
  handover_id: string
  user_id: string
  read_at: string
}

type Comment = {
  id: string
  handover_id: string
  created_by: string | null
  comment: string
  created_at: string
}

const CATEGORIES = [
  "Bendra informacija",
  "Sveikata",
  "Slauga",
  "Mityba",
  "Elgesys / emocijos",
  "Incidentas",
  "Artimieji",
  "Ūkio klausimas",
  "Užduotis kitai pamainai",
]

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Žemas" },
  { value: "medium", label: "Vidutinis" },
  { value: "high", label: "Aukštas" },
  { value: "critical", label: "Kritinis" },
]

const SHIFTS: { value: ShiftType; label: string }[] = [
  { value: "morning", label: "Rytinė" },
  { value: "day", label: "Dieninė" },
  { value: "evening", label: "Vakarinė" },
  { value: "night", label: "Naktinė" },
  { value: "other", label: "Kita" },
]

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("lt-LT")
}

function formatShortDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("lt-LT")
}

function profileName(profile?: Profile | null) {
  if (!profile) return "—"
  const full = String(profile.full_name || "").trim()
  const first = String(profile.first_name || "").trim()
  const last = String(profile.last_name || "").trim()
  const combined = [first, last].filter(Boolean).join(" ").trim()
  return full || combined || profile.email || "—"
}

function residentName(resident?: Resident | null, roomsById?: Record<string, string>) {
  if (!resident) return "Bendra įstaigos informacija"
  const full = String(resident.full_name || "").trim()
  const first = String(resident.first_name || "").trim()
  const last = String(resident.last_name || "").trim()
  const combined = [first, last].filter(Boolean).join(" ").trim()
  const code = resident.resident_code ? ` · ${resident.resident_code}` : ""
  const room = resident.current_room_id && roomsById?.[resident.current_room_id] ? ` · ${roomsById[resident.current_room_id]}` : ""
  return `${full || combined || "Gyventojas"}${code}${room}`
}

function priorityLabel(priority: Priority | string | null) {
  return PRIORITIES.find((item) => item.value === priority)?.label || priority || "—"
}

function shiftLabel(shift: ShiftType | string | null) {
  return SHIFTS.find((item) => item.value === shift)?.label || shift || "—"
}

export default function HandoverLogsPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [logs, setLogs] = useState<HandoverLog[]>([])
  const [acks, setAcks] = useState<Ack[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [roomsById, setRoomsById] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const [residentFilter, setResidentFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [shiftFilter, setShiftFilter] = useState("all")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [importantOnly, setImportantOnly] = useState(false)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [query, setQuery] = useState("")

  const [selectedLog, setSelectedLog] = useState<HandoverLog | null>(null)
  const [commentText, setCommentText] = useState("")

  const [form, setForm] = useState({
    resident_id: "",
    shift_date: todayDate(),
    shift_type: "day" as ShiftType,
    category: "Bendra informacija",
    priority: "medium" as Priority,
    title: "",
    note: "",
    is_important: false,
    needs_follow_up: false,
  })

  useEffect(() => {
    void loadAll()
  }, [])

  async function loadAll() {
    try {
      setLoading(true)
      setMessage("")

      const {
        data: { user },
      } = await supabase.auth.getUser()

      setCurrentUserId(user?.id || null)

      const orgId = await getCurrentOrganizationId()
      setOrganizationId(orgId)

      if (!orgId) {
        setMessage("Nepavyko nustatyti organizacijos.")
        return
      }

      const [logsResult, acksResult, commentsResult, residentsResult, roomsResult, membersResult] = await Promise.all([
        supabase
          .from("handover_logs")
          .select("*")
          .eq("organization_id", orgId)
          .order("shift_date", { ascending: false })
          .order("created_at", { ascending: false }),

        supabase
          .from("handover_acknowledgements")
          .select("*")
          .eq("organization_id", orgId),

        supabase
          .from("handover_comments")
          .select("*")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),

        supabase
          .from("residents")
          .select("id, full_name, first_name, last_name, resident_code, current_room_id")
          .eq("organization_id", orgId)
          .is("archived_at", null),

        supabase
          .from("rooms")
          .select("id, name")
          .eq("organization_id", orgId),

        supabase
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", orgId)
          .eq("is_active", true),
      ])

      if (logsResult.error) throw logsResult.error
      if (acksResult.error) throw acksResult.error
      if (commentsResult.error) throw commentsResult.error
      if (residentsResult.error) throw residentsResult.error
      if (roomsResult.error) throw roomsResult.error
      if (membersResult.error) throw membersResult.error

      setLogs((logsResult.data || []) as HandoverLog[])
      setAcks((acksResult.data || []) as Ack[])
      setComments((commentsResult.data || []) as Comment[])
      setResidents((residentsResult.data || []) as Resident[])
      setRoomsById(
        Object.fromEntries(((roomsResult.data || []) as Room[]).map((room) => [room.id, room.name || "Kambarys"]))
      )

      const memberIds = ((membersResult.data || []) as { user_id: string }[])
        .map((item) => item.user_id)
        .filter(Boolean)

      if (memberIds.length > 0) {
        const profilesResult = await supabase
          .from("profiles")
          .select("id, full_name, first_name, last_name, email")
          .in("id", memberIds)

        if (profilesResult.error) throw profilesResult.error
        setProfiles((profilesResult.data || []) as Profile[])
      } else {
        setProfiles([])
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko įkelti perdavimo žurnalų.")
    } finally {
      setLoading(false)
    }
  }

  function isRead(logId: string) {
    if (!currentUserId) return false
    return acks.some((ack) => ack.handover_id === logId && ack.user_id === currentUserId)
  }

  async function createLog() {
    try {
      if (!organizationId || !currentUserId) return
      if (!form.title.trim()) {
        setMessage("Įvesk žurnalo pavadinimą.")
        return
      }
      if (!form.note.trim()) {
        setMessage("Įvesk perdavimo įrašą.")
        return
      }

      setSaving(true)
      setMessage("")

      const { data, error } = await supabase
        .from("handover_logs")
        .insert({
          organization_id: organizationId,
          resident_id: form.resident_id || null,
          created_by: currentUserId,
          shift_date: form.shift_date,
          shift_type: form.shift_type,
          category: form.category,
          priority: form.priority,
          title: form.title.trim(),
          note: form.note.trim(),
          is_important: form.is_important,
          needs_follow_up: form.needs_follow_up,
        })
        .select("*")
        .single()

      if (error) throw error

      if (form.needs_follow_up) {
        const { data: taskData } = await supabase
          .from("tasks")
          .insert({
            organization_id: organizationId,
            title: `Perdavimo žurnalas: ${form.title.trim()}`,
            description: form.note.trim(),
            status: "assigned",
            priority: form.priority,
            assigned_to: currentUserId,
            created_by: currentUserId,
            resident_id: form.resident_id || null,
            category: "Perdavimo žurnalas",
            due_date: new Date().toISOString(),
          })
          .select("id")
          .single()

        if (taskData?.id) {
          await supabase
            .from("handover_logs")
            .update({ follow_up_task_id: taskData.id, updated_by: currentUserId })
            .eq("id", data.id)
        }
      }

      setForm({
        resident_id: "",
        shift_date: todayDate(),
        shift_type: "day",
        category: "Bendra informacija",
        priority: "medium",
        title: "",
        note: "",
        is_important: false,
        needs_follow_up: false,
      })

      setMessage("Perdavimo įrašas sukurtas.")
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko sukurti perdavimo įrašo.")
    } finally {
      setSaving(false)
    }
  }

  async function markRead(log: HandoverLog) {
    try {
      if (!organizationId || !currentUserId) return
      setSaving(true)

      const { error } = await supabase
        .from("handover_acknowledgements")
        .upsert(
          {
            organization_id: organizationId,
            handover_id: log.id,
            user_id: currentUserId,
            read_at: new Date().toISOString(),
          },
          { onConflict: "handover_id,user_id" }
        )

      if (error) throw error
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko pažymėti kaip perskaityta.")
    } finally {
      setSaving(false)
    }
  }

  async function addComment() {
    try {
      if (!organizationId || !currentUserId || !selectedLog || !commentText.trim()) return
      setSaving(true)

      const { error } = await supabase.from("handover_comments").insert({
        organization_id: organizationId,
        handover_id: selectedLog.id,
        created_by: currentUserId,
        comment: commentText.trim(),
      })

      if (error) throw error

      setCommentText("")
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko pridėti komentaro.")
    } finally {
      setSaving(false)
    }
  }

  async function archiveLog(log: HandoverLog) {
    if (!confirm("Ar tikrai archyvuoti perdavimo įrašą?")) return

    try {
      if (!currentUserId) return
      setSaving(true)

      const { error } = await supabase
        .from("handover_logs")
        .update({
          archived: true,
          updated_by: currentUserId,
        })
        .eq("id", log.id)

      if (error) throw error
      await loadAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko archyvuoti.")
    } finally {
      setSaving(false)
    }
  }

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase()

    return logs.filter((log) => {
      const resident = residents.find((item) => item.id === log.resident_id)
      const author = profiles.find((item) => item.id === log.created_by)

      if (!includeArchived && log.archived) return false
      if (residentFilter !== "all" && (log.resident_id || "") !== residentFilter) return false
      if (priorityFilter !== "all" && log.priority !== priorityFilter) return false
      if (shiftFilter !== "all" && log.shift_type !== shiftFilter) return false
      if (importantOnly && !log.is_important) return false
      if (unreadOnly && isRead(log.id)) return false

      if (!q) return true

      return [
        log.title,
        log.note,
        log.category,
        priorityLabel(log.priority),
        shiftLabel(log.shift_type),
        residentName(resident, roomsById),
        profileName(author),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [
    logs,
    residents,
    profiles,
    roomsById,
    residentFilter,
    priorityFilter,
    shiftFilter,
    unreadOnly,
    importantOnly,
    includeArchived,
    query,
    currentUserId,
    acks,
  ])

  const stats = useMemo(() => {
    const activeLogs = logs.filter((log) => !log.archived)
    return {
      all: activeLogs.length,
      unread: activeLogs.filter((log) => !isRead(log.id)).length,
      important: activeLogs.filter((log) => log.is_important).length,
      critical: activeLogs.filter((log) => log.priority === "critical").length,
      followUp: activeLogs.filter((log) => log.needs_follow_up).length,
    }
  }, [logs, acks, currentUserId])

  if (loading) return <div style={styles.page}>Kraunama...</div>

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroIcon}>
          <ClipboardList size={28} />
        </div>

        <div>
          <div style={styles.eyebrow}>Pamainų perdavimas</div>
          <h1 style={styles.title}>Perdavimo žurnalai</h1>
          <p style={styles.subtitle}>
            Svarbi informacija kitai pamainai, perskaitymo žymos, komentarai ir užduotys veiksmams.
          </p>
        </div>

        <button type="button" onClick={() => void loadAll()} style={styles.refreshButton}>
          <RefreshCw size={16} />
          Atnaujinti
        </button>
      </section>

      {message ? <div style={styles.message}>{message}</div> : null}

      <section style={styles.stats}>
        <Stat label="Aktyvūs" value={stats.all} />
        <Stat label="Neperskaityti" value={stats.unread} warning />
        <Stat label="Svarbūs" value={stats.important} />
        <Stat label="Kritiniai" value={stats.critical} danger />
        <Stat label="Reikia veiksmo" value={stats.followUp} warning />
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.sectionTitle}>Naujas perdavimo įrašas</h2>
          <button type="button" onClick={() => void createLog()} disabled={saving} style={styles.primaryButton}>
            <Plus size={16} />
            {saving ? "Saugoma..." : "Sukurti"}
          </button>
        </div>

        <div style={styles.formGrid}>
          <Field label="Gyventojas">
            <select
              style={styles.input}
              value={form.resident_id}
              onChange={(e) => setForm({ ...form, resident_id: e.target.value })}
            >
              <option value="">Bendra įstaigos informacija</option>
              {residents.map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {residentName(resident, roomsById)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Pamaina">
            <select
              style={styles.input}
              value={form.shift_type}
              onChange={(e) => setForm({ ...form, shift_type: e.target.value as ShiftType })}
            >
              {SHIFTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Data">
            <input
              type="date"
              style={styles.input}
              value={form.shift_date}
              onChange={(e) => setForm({ ...form, shift_date: e.target.value })}
            />
          </Field>

          <Field label="Kategorija">
            <select
              style={styles.input}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </Field>

          <Field label="Prioritetas">
            <select
              style={styles.input}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
            >
              {PRIORITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Pavadinimas">
            <input
              style={styles.input}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Pvz. Vakarinės pamainos pastaba"
            />
          </Field>

          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={form.is_important}
              onChange={(e) => setForm({ ...form, is_important: e.target.checked })}
            />
            Svarbu
          </label>

          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={form.needs_follow_up}
              onChange={(e) => setForm({ ...form, needs_follow_up: e.target.checked })}
            />
            Sukurti užduotį veiksmui
          </label>

          <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
            <span>Įrašas</span>
            <textarea
              style={styles.textarea}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Trumpai, tik tai kas būtina kitai pamainai. Venk perteklinių jautrių duomenų."
            />
          </label>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Filtrai</h2>

        <div style={styles.filters}>
          <Field label="Paieška">
            <input
              style={styles.input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ieškoti pagal tekstą, gyventoją, autorių..."
            />
          </Field>

          <Field label="Gyventojas">
            <select style={styles.input} value={residentFilter} onChange={(e) => setResidentFilter(e.target.value)}>
              <option value="all">Visi</option>
              <option value="">Bendra įstaigos informacija</option>
              {residents.map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {residentName(resident, roomsById)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Pamaina">
            <select style={styles.input} value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
              <option value="all">Visos</option>
              {SHIFTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Prioritetas">
            <select style={styles.input} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="all">Visi</option>
              {PRIORITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <label style={styles.checkboxRow}>
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Tik neperskaityti
          </label>

          <label style={styles.checkboxRow}>
            <input type="checkbox" checked={importantOnly} onChange={(e) => setImportantOnly(e.target.checked)} />
            Tik svarbūs
          </label>

          <label style={styles.checkboxRow}>
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            Rodyti archyvą
          </label>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.sectionTitle}>Įrašai</h2>
          <span style={styles.meta}>Rodoma: {filteredLogs.length}</span>
        </div>

        {filteredLogs.length === 0 ? (
          <div style={styles.empty}>Perdavimo įrašų nėra.</div>
        ) : (
          <div style={styles.logGrid}>
            {filteredLogs.map((log) => {
              const resident = residents.find((item) => item.id === log.resident_id)
              const author = profiles.find((item) => item.id === log.created_by)
              const commentsForLog = comments.filter((comment) => comment.handover_id === log.id)
              const read = isRead(log.id)

              return (
                <article key={log.id} style={styles.logCard}>
                  <div style={styles.logHeader}>
                    <div>
                      <div style={styles.logMeta}>
                        {formatShortDate(log.shift_date)} · {shiftLabel(log.shift_type)} · {log.category}
                      </div>
                      <h3 style={styles.logTitle}>{log.title}</h3>
                      <p style={styles.residentLine}>{residentName(resident, roomsById)}</p>
                    </div>

                    <div style={styles.badgeStack}>
                      {!read ? <span style={styles.unreadBadge}>Neperskaityta</span> : <span style={styles.readBadge}>Perskaityta</span>}
                      {log.is_important ? <span style={styles.importantBadge}>Svarbu</span> : null}
                      <span style={{ ...styles.priorityBadge, ...priorityStyle(log.priority) }}>
                        {priorityLabel(log.priority)}
                      </span>
                    </div>
                  </div>

                  <p style={styles.note}>{log.note}</p>

                  <div style={styles.footerMeta}>
                    <span>Sukūrė: {profileName(author)}</span>
                    <span>{formatDate(log.created_at)}</span>
                    <span>Komentarų: {commentsForLog.length}</span>
                    {log.follow_up_task_id ? <span>Užduotis sukurta</span> : null}
                  </div>

                  <div style={styles.actions}>
                    {!read ? (
                      <button type="button" style={styles.successButton} onClick={() => void markRead(log)} disabled={saving}>
                        <CheckCircle2 size={15} />
                        Perskaityta
                      </button>
                    ) : null}

                    <button type="button" style={styles.secondaryButton} onClick={() => setSelectedLog(log)}>
                      <MessageSquare size={15} />
                      Komentarai
                    </button>

                    {!log.archived ? (
                      <button type="button" style={styles.dangerSoftButton} onClick={() => void archiveLog(log)} disabled={saving}>
                        <Archive size={15} />
                        Archyvuoti
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {selectedLog ? (
        <div style={styles.modalBackdrop} onClick={() => setSelectedLog(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.sectionTitle}>{selectedLog.title}</h2>
                <p style={styles.subtitle}>{selectedLog.note}</p>
              </div>
            </div>

            <div style={styles.commentList}>
              {comments.filter((comment) => comment.handover_id === selectedLog.id).length === 0 ? (
                <div style={styles.empty}>Komentarų nėra.</div>
              ) : (
                comments.filter((comment) => comment.handover_id === selectedLog.id).map((comment) => {
                  const author = profiles.find((profile) => profile.id === comment.created_by)
                  return (
                    <div key={comment.id} style={styles.comment}>
                      <strong>{profileName(author)}</strong>
                      <span>{formatDate(comment.created_at)}</span>
                      <p>{comment.comment}</p>
                    </div>
                  )
                })
              )}
            </div>

            <textarea
              style={styles.textarea}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Komentaras..."
            />

            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => setSelectedLog(null)}>
                Uždaryti
              </button>
              <button type="button" style={styles.primaryButton} onClick={() => void addComment()} disabled={saving}>
                Pridėti komentarą
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function Stat({ label, value, danger, warning }: { label: string; value: number; danger?: boolean; warning?: boolean }) {
  return (
    <div style={{ ...styles.stat, ...(danger ? styles.statDanger : warning ? styles.statWarning : {}) }}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

function priorityStyle(priority: Priority): React.CSSProperties {
  if (priority === "critical") return { background: "#fee2e2", color: "#b91c1c" }
  if (priority === "high") return { background: "#ffedd5", color: "#c2410c" }
  if (priority === "medium") return { background: "#fef9c3", color: "#854d0e" }
  return { background: "#dcfce7", color: "#166534" }
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 24, display: "grid", gap: 18, background: "#f8fafc" },
  hero: { display: "grid", gridTemplateColumns: "58px 1fr auto", gap: 16, alignItems: "center", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 24, padding: 22 },
  heroIcon: { width: 58, height: 58, borderRadius: 18, background: "#ecfdf5", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center" },
  eyebrow: { color: "#047857", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" },
  title: { margin: 0, fontSize: 34, fontWeight: 950, color: "#0f172a" },
  subtitle: { margin: "6px 0 0", color: "#64748b", fontSize: 14, fontWeight: 700 },
  refreshButton: { border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857", borderRadius: 13, padding: "10px 13px", fontSize: 13, fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 },
  message: { padding: 12, borderRadius: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857", fontWeight: 800 },
  stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 },
  stat: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 },
  statDanger: { background: "#fff1f2", borderColor: "#fecdd3" },
  statWarning: { background: "#fff7ed", borderColor: "#fed7aa" },
  statValue: { fontSize: 28, fontWeight: 900, color: "#0f172a" },
  statLabel: { color: "#64748b", fontWeight: 800, fontSize: 13 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 18, display: "grid", gap: 14 },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  filters: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  field: { display: "grid", gap: 6, color: "#334155", fontSize: 13, fontWeight: 800 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" },
  textarea: { width: "100%", minHeight: 110, border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, fontSize: 14, boxSizing: "border-box" },
  checkboxRow: { display: "flex", alignItems: "center", gap: 9, color: "#334155", fontSize: 13, fontWeight: 850 },
  primaryButton: { border: "none", borderRadius: 12, padding: "10px 14px", background: "#047857", color: "#fff", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 },
  secondaryButton: { border: "1px solid #cbd5e1", borderRadius: 12, padding: "8px 12px", background: "#fff", color: "#0f172a", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  successButton: { border: "none", borderRadius: 12, padding: "8px 12px", background: "#047857", color: "#fff", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  dangerSoftButton: { border: "none", borderRadius: 12, padding: "8px 12px", background: "#fee2e2", color: "#b91c1c", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  empty: { padding: 24, textAlign: "center", color: "#64748b" },
  meta: { color: "#64748b", fontSize: 13, fontWeight: 800 },
  logGrid: { display: "grid", gap: 12 },
  logCard: { border: "1px solid #e2e8f0", borderRadius: 18, background: "#fff", padding: 16, display: "grid", gap: 12 },
  logHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  logMeta: { color: "#047857", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em" },
  logTitle: { margin: "4px 0", fontSize: 18, fontWeight: 950, color: "#0f172a" },
  residentLine: { margin: 0, color: "#64748b", fontSize: 13, fontWeight: 800 },
  badgeStack: { display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" },
  unreadBadge: { background: "#fff7ed", color: "#c2410c", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 900 },
  readBadge: { background: "#dcfce7", color: "#166534", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 900 },
  importantBadge: { background: "#fee2e2", color: "#b91c1c", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 900 },
  priorityBadge: { borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 900 },
  note: { margin: 0, color: "#334155", lineHeight: 1.5, whiteSpace: "pre-wrap" },
  footerMeta: { display: "flex", gap: 10, flexWrap: "wrap", color: "#64748b", fontSize: 12, fontWeight: 800 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 },
  modal: { width: "100%", maxWidth: 760, maxHeight: "92vh", overflow: "auto", background: "#fff", borderRadius: 20, padding: 20, display: "grid", gap: 14 },
  modalHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  commentList: { display: "grid", gap: 8, maxHeight: 280, overflowY: "auto" },
  comment: { border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 12, padding: 12 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10 },
}
