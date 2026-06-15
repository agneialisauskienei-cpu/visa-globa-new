"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ClipboardList,
  CalendarDays,
  HelpCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentOrganizationId } from "@/lib/current-organization";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

type Priority = "low" | "medium" | "high" | "critical";
type ShiftType = "morning" | "day" | "evening" | "night" | "other";

type Resident = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  resident_code: string | null;
  current_room_id: string | null;
};

type Room = { id: string; name: string | null };

type Profile = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type HandoverLog = {
  id: string;
  organization_id: string;
  resident_id: string | null;
  shift_date: string;
  shift_type: ShiftType;
  category: string;
  priority: Priority;
  title: string;
  note: string;
  is_important: boolean;
  needs_follow_up: boolean;
  follow_up_task_id: string | null;
  archived: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string | null;
};

type Ack = {
  id: string;
  organization_id?: string;
  handover_id: string;
  user_id: string;
  read_at: string;
};

type Comment = {
  id: string;
  organization_id?: string;
  handover_id: string;
  created_by: string | null;
  comment: string;
  created_at: string;
};

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
];

const TOPIC_BUTTONS = [
  { label: "Slauga", category: "Slauga", priority: "medium" as Priority, title: "Slaugos informacija" },
  { label: "Sveikata", category: "Sveikata", priority: "high" as Priority, title: "Sveikatos stebėjimas" },
  { label: "Mityba", category: "Mityba", priority: "medium" as Priority, title: "Mitybos informacija" },
  { label: "Elgesys", category: "Elgesys / emocijos", priority: "medium" as Priority, title: "Elgesio / emocijų pokytis" },
  { label: "Incidentas", category: "Incidentas", priority: "critical" as Priority, title: "Incidentas" },
  { label: "Ūkis", category: "Ūkio klausimas", priority: "medium" as Priority, title: "Ūkio klausimas" },
  { label: "Artimieji", category: "Artimieji", priority: "medium" as Priority, title: "Informacija apie artimuosius" },
  { label: "Užduotis", category: "Užduotis kitai pamainai", priority: "high" as Priority, title: "Užduotis kitai pamainai" },
];

const QUICK_TEMPLATES = [
  "Atsisakė maisto",
  "Blogai miegojo",
  "Stebėti temperatūrą",
  "Buvo neramus / agresyvus",
  "Reikia informuoti slaugytoją",
  "Reikia sutaisyti",
];

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Žemas" },
  { value: "medium", label: "Vidutinis" },
  { value: "high", label: "Aukštas" },
  { value: "critical", label: "Kritinis" },
];

const SHIFTS: { value: ShiftType; label: string }[] = [
  { value: "morning", label: "Rytinė" },
  { value: "day", label: "Dieninė" },
  { value: "evening", label: "Vakarinė" },
  { value: "night", label: "Naktinė" },
  { value: "other", label: "Kita" },
];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("lt-LT");
}

function formatShortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("lt-LT");
}

function profileName(profile?: Profile | null) {
  if (!profile) return "—";
  const full = String(profile.full_name || "").trim();
  const first = String(profile.first_name || "").trim();
  const last = String(profile.last_name || "").trim();
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return full || combined || profile.email || "—";
}

function residentName(resident?: Resident | null, roomsById?: Record<string, string>) {
  if (!resident) return "Bendra įstaigos informacija";
  const full = String(resident.full_name || "").trim();
  const first = String(resident.first_name || "").trim();
  const last = String(resident.last_name || "").trim();
  const combined = [first, last].filter(Boolean).join(" ").trim();
  const code = resident.resident_code ? ` · ${resident.resident_code}` : "";
  const room = resident.current_room_id && roomsById?.[resident.current_room_id]
    ? ` · ${roomsById[resident.current_room_id]}`
    : "";
  return `${full || combined || "Gyventojas"}${code}${room}`;
}

function priorityLabel(priority: Priority | string | null) {
  return PRIORITIES.find((item) => item.value === priority)?.label || priority || "—";
}

function shiftLabel(shift: ShiftType | string | null) {
  return SHIFTS.find((item) => item.value === shift)?.label || shift || "—";
}

function priorityClasses(priority: Priority) {
  if (priority === "critical") return "border-red-200 bg-red-50 text-red-900";
  if (priority === "high") return "border-orange-200 bg-orange-50 text-orange-900";
  if (priority === "medium") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function priorityPillClasses(priority: Priority) {
  if (priority === "critical") return "bg-red-900 text-white";
  if (priority === "high") return "bg-orange-900 text-white";
  if (priority === "medium") return "bg-amber-900 text-white";
  return "bg-[#2f4f3f] text-white";
}

function getReadableError(error: unknown) {
  if (!error) return "Nepavyko atlikti veiksmo.";
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const maybe = error as { message?: string; details?: string; hint?: string; code?: string };
    return [maybe.message, maybe.details, maybe.hint, maybe.code].filter(Boolean).join(" · ");
  }
  return String(error);
}


async function writeAuditLog(input: {
  organizationId: string;
  action: string;
  entityId: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const now = new Date().toISOString();
    const tableName = input.entityType || "handover_logs";
    const changes = {
      ...(input.metadata || {}),
      module: "handover_logs",
    };

    const attempts = [
      {
        table: "audit_log",
        payload: {
          organization_id: input.organizationId,
          table_name: tableName,
          record_id: input.entityId,
          action: input.action,
          changed_by: user?.id || null,
          actor: user?.id || null,
          changed_at: now,
          created_at: now,
          changes,
        },
      },
      {
        table: "audit_logs",
        payload: {
          organization_id: input.organizationId,
          table_name: tableName,
          record_id: input.entityId,
          action: input.action,
          changed_by: user?.id || null,
          user_id: user?.id || null,
          changed_at: now,
          created_at: now,
          changes,
        },
      },
      {
        table: "audit_logs",
        payload: {
          organization_id: input.organizationId,
          entity_type: tableName,
          entity_id: input.entityId,
          action: input.action,
          user_id: user?.id || null,
          created_at: now,
          metadata: changes,
        },
      },
    ];

    for (const attempt of attempts) {
      const { error } = await supabase.from(attempt.table).insert(attempt.payload as never);
      if (!error) return;
    }
  } catch {
    // Audit neturi nulaužti pagrindinio veiksmo UI.
  }
}

export default function HandoverLogsPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [logs, setLogs] = useState<HandoverLog[]>([]);
  const [acks, setAcks] = useState<Ack[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roomsById, setRoomsById] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);

  const [residentFilter, setResidentFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [importantOnly, setImportantOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [query, setQuery] = useState("");

  const [selectedLog, setSelectedLog] = useState<HandoverLog | null>(null);
  const [commentText, setCommentText] = useState("");

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
  });

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 1024);

    update();
    window.addEventListener("resize", update);

    return () => window.removeEventListener("resize", update);
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      setMessage("");

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      const orgId = await getCurrentOrganizationId();
      setOrganizationId(orgId);

      if (!orgId) {
        setMessage("Nepavyko nustatyti organizacijos.");
        return;
      }

      const [logsResult, acksResult, commentsResult, residentsResult, roomsResult, membersResult] = await Promise.all([
        supabase.from("handover_logs").select("*").eq("organization_id", orgId).order("shift_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("handover_acknowledgements").select("*").eq("organization_id", orgId),
        supabase.from("handover_comments").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
        supabase.from("residents").select("id, full_name, first_name, last_name, resident_code, current_room_id").eq("organization_id", orgId),
        supabase.from("rooms").select("id, name").eq("organization_id", orgId),
        supabase.from("organization_members").select("user_id").eq("organization_id", orgId).eq("is_active", true),
      ]);

      if (logsResult.error) throw logsResult.error;
      if (acksResult.error) throw acksResult.error;
      if (commentsResult.error) throw commentsResult.error;
      if (residentsResult.error) throw residentsResult.error;
      if (roomsResult.error) throw roomsResult.error;
      if (membersResult.error) throw membersResult.error;

      setLogs((logsResult.data || []) as HandoverLog[]);
      setAcks((acksResult.data || []) as Ack[]);
      setComments((commentsResult.data || []) as Comment[]);
      setResidents((residentsResult.data || []) as Resident[]);
      setRoomsById(Object.fromEntries(((roomsResult.data || []) as Room[]).map((room) => [room.id, room.name || "Kambarys"])));

      const memberIds = ((membersResult.data || []) as { user_id: string }[]).map((item) => item.user_id).filter(Boolean);
      if (memberIds.length > 0) {
        const profilesResult = await supabase.from("profiles").select("id, full_name, first_name, last_name, email").in("id", memberIds);
        if (profilesResult.error) throw profilesResult.error;
        setProfiles((profilesResult.data || []) as Profile[]);
      } else {
        setProfiles([]);
      }
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setLoading(false);
    }
  }

  function isRead(logId: string) {
    if (!currentUserId) return false;
    return acks.some((ack) => ack.handover_id === logId && ack.user_id === currentUserId);
  }

  async function createLog() {
    if (!organizationId || !currentUserId) return;
    if (!form.title.trim()) {
      setMessage("Įrašyk pavadinimą.");
      return;
    }
    if (!form.note.trim()) {
      setMessage("Įrašyk perdavimo informaciją.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const { data, error } = await supabase
        .from("handover_logs")
        .insert({
          organization_id: organizationId,
          resident_id: form.resident_id || null,
          shift_date: form.shift_date,
          shift_type: form.shift_type,
          category: form.category,
          priority: form.priority,
          title: form.title.trim(),
          note: form.note.trim(),
          is_important: form.is_important,
          needs_follow_up: form.needs_follow_up,
          archived: false,
          created_by: currentUserId,
          updated_by: currentUserId,
        })
        .select("id")
        .single();

      if (error) throw error;

      await writeAuditLog({
        organizationId,
        action: "handover_log.created",
        entityType: "handover_logs",
        entityId: data.id,
        metadata: {
          resident_id: form.resident_id || null,
          shift_date: form.shift_date,
          shift_type: form.shift_type,
          category: form.category,
          priority: form.priority,
          is_important: form.is_important,
          needs_follow_up: form.needs_follow_up,
        },
      });

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
      });
      await loadAll();
      setMessage("Perdavimo įrašas sukurtas.");
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function markRead(log: HandoverLog) {
    try {
      if (!organizationId || !currentUserId) return;
      setSaving(true);
      const { error } = await supabase.from("handover_acknowledgements").upsert(
        {
          organization_id: organizationId,
          handover_id: log.id,
          user_id: currentUserId,
          read_at: new Date().toISOString(),
        },
        { onConflict: "handover_id,user_id" },
      );
      if (error) throw error;

      await writeAuditLog({
        organizationId,
        action: "handover_log.confirmed_seen",
        entityType: "handover_logs",
        entityId: log.id,
        metadata: {
          resident_id: log.resident_id || null,
          shift_date: log.shift_date,
          shift_type: log.shift_type,
          category: log.category,
        },
      });

      await loadAll();
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function addComment() {
    try {
      if (!organizationId || !currentUserId || !selectedLog || !commentText.trim()) return;
      setSaving(true);
      const { error } = await supabase.from("handover_comments").insert({
        organization_id: organizationId,
        handover_id: selectedLog.id,
        created_by: currentUserId,
        comment: commentText.trim(),
      });
      if (error) throw error;

      await writeAuditLog({
        organizationId,
        action: "handover_log.comment_added",
        entityType: "handover_logs",
        entityId: selectedLog.id,
        metadata: {
          resident_id: selectedLog.resident_id || null,
          comment_length: commentText.trim().length,
        },
      });

      setCommentText("");
      await loadAll();
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function archiveLog(log: HandoverLog) {
    if (!confirm("Ar tikrai archyvuoti perdavimo įrašą?")) return;
    try {
      if (!currentUserId) return;
      setSaving(true);
      const { error } = await supabase
        .from("handover_logs")
        .update({ archived: true, updated_by: currentUserId, updated_at: new Date().toISOString() })
        .eq("id", log.id)
        .eq("organization_id", log.organization_id);
      if (error) throw error;

      await writeAuditLog({
        organizationId: log.organization_id,
        action: "handover_log.archived",
        entityType: "handover_logs",
        entityId: log.id,
        metadata: {
          resident_id: log.resident_id || null,
          shift_date: log.shift_date,
          category: log.category,
        },
      });

      await loadAll();
    } catch (error) {
      setMessage(getReadableError(error));
    } finally {
      setSaving(false);
    }
  }

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      const resident = residents.find((item) => item.id === log.resident_id);
      const author = profiles.find((item) => item.id === log.created_by);

      if (!includeArchived && log.archived) return false;
      if (residentFilter !== "all" && (log.resident_id || "") !== residentFilter) return false;
      if (priorityFilter !== "all" && log.priority !== priorityFilter) return false;
      if (shiftFilter !== "all" && log.shift_type !== shiftFilter) return false;
      if (importantOnly && !log.is_important) return false;
      if (unreadOnly && isRead(log.id)) return false;
      if (!q) return true;

      return [
        log.title,
        log.note,
        log.category,
        priorityLabel(log.priority),
        shiftLabel(log.shift_type),
        residentName(resident, roomsById),
        profileName(author),
      ].join(" ").toLowerCase().includes(q);
    });
  }, [logs, residents, profiles, roomsById, residentFilter, priorityFilter, shiftFilter, unreadOnly, importantOnly, includeArchived, query, currentUserId, acks]);

  const stats = useMemo(() => {
    const activeLogs = logs.filter((log) => !log.archived);
    return {
      all: activeLogs.length,
      unread: activeLogs.filter((log) => !isRead(log.id)).length,
      important: activeLogs.filter((log) => log.is_important).length,
      critical: activeLogs.filter((log) => log.priority === "critical").length,
      followUp: activeLogs.filter((log) => log.needs_follow_up).length,
      incidents: activeLogs.filter((log) => log.category === "Incidentas").length,
    };
  }, [logs, acks, currentUserId]);

  const hotResidents = useMemo(() => {
    const counts = new Map<string, { resident: Resident; count: number; critical: number }>();
    logs.filter((log) => !log.archived && log.resident_id).forEach((log) => {
      const resident = residents.find((item) => item.id === log.resident_id);
      if (!resident) return;
      const current = counts.get(resident.id) || { resident, count: 0, critical: 0 };
      current.count += 1;
      if (log.priority === "critical" || log.category === "Incidentas") current.critical += 1;
      counts.set(resident.id, current);
    });
    return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [logs, residents]);

  if (isMobile) {
    return (
      <main className="min-h-screen bg-[#ffffff] pb-32 text-[#10251f]">
        <section className="mx-4 mt-4 overflow-hidden rounded-[30px] border border-emerald-900/10 bg-[#486b5d] px-5 pb-7 pt-7 text-white shadow-[0_16px_45px_rgba(16,37,31,0.14)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-100">
                Perdavimo žurnalai
              </p>
              <h1 className="mt-3 text-[34px] font-black leading-[0.98] tracking-[-0.045em]">
                Pamainų perdavimas
              </h1>
              <p className="mt-4 max-w-[320px] text-[15px] font-semibold leading-6 text-emerald-50/90">
                Svarbiausi įrašai, kuriuos turi pamatyti kita pamaina.
              </p>
            </div>

            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-white/15 text-white backdrop-blur">
              <ClipboardList className="h-7 w-7" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <MobileHeroStat label="Visi" value={stats.all} />
            <MobileHeroStat label="Nauji" value={stats.unread} />
            <MobileHeroStat label="Svarbūs" value={stats.important} />
          </div>
        </section>

        <section className="space-y-4 px-4 pt-5">
          {message ? (
            <div className="rounded-[24px] border border-amber-100 bg-amber-50 p-4 text-sm font-black text-amber-800">
              {message}
            </div>
          ) : null}

          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8ea0b5]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ieškoti gyventojo, teksto..."
              className="h-14 w-full rounded-[22px] border border-[#dbe6e0] bg-white pl-12 pr-4 text-[15px] font-black text-[#10251f] shadow-[0_8px_24px_rgba(15,23,42,0.05)] outline-none placeholder:text-[#8ea0b5] focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
            />
          </label>

          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <MobileFilterChip
              active={!includeArchived && !unreadOnly && !importantOnly}
              onClick={() => {
                setIncludeArchived(false);
                setUnreadOnly(false);
                setImportantOnly(false);
              }}
            >
              Visi
            </MobileFilterChip>
            <MobileFilterChip
              active={unreadOnly}
              onClick={() => {
                setIncludeArchived(false);
                setUnreadOnly((value) => !value);
              }}
            >
              Nauji
            </MobileFilterChip>
            <MobileFilterChip active={importantOnly} onClick={() => setImportantOnly((value) => !value)}>
              Svarbūs
            </MobileFilterChip>
            <MobileFilterChip
              active={includeArchived}
              onClick={() => {
                setUnreadOnly(false);
                setIncludeArchived((value) => !value);
              }}
            >
              Archyvas
            </MobileFilterChip>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MobileMiniStat label="Sekti" value={stats.followUp} />
            <MobileMiniStat label="Kritiniai" value={stats.critical} />
          </div>

          {hotResidents.length > 0 ? (
            <section className="rounded-[28px] border border-[#dbe6e0] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Dažniausiai minimi</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-[#10251f]">Gyventojai</h2>
                </div>
                <Sparkles className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {hotResidents.map((item) => (
                  <button
                    key={item.resident.id}
                    type="button"
                    onClick={() => setResidentFilter(item.resident.id)}
                    className="min-w-[190px] rounded-[22px] border border-[#dbe6e0] bg-[#ffffff] p-3 text-left transition active:scale-[0.98]"
                  >
                    <p className="line-clamp-1 text-sm font-black text-[#10251f]">{residentName(item.resident, roomsById)}</p>
                    <p className="mt-1 text-xs font-bold text-[#526174]">{item.count} įrašai · {item.critical} krit.</p>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Pamaina</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">Dabar svarbu</h2>
              </div>
              <button
                type="button"
                onClick={() => void loadAll()}
                className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#dbe6e0] bg-white text-emerald-700 shadow-sm"
                aria-label="Atnaujinti"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="rounded-[28px] border border-[#dbe6e0] bg-white p-8 text-center text-sm font-black text-[#526174]">
                Perdavimo įrašų pagal filtrus nėra.
              </div>
            ) : (
              filteredLogs.map((log) => {
                const resident = residents.find((item) => item.id === log.resident_id);
                const author = profiles.find((item) => item.id === log.created_by);
                const read = isRead(log.id);

                return (
                  <article
                    key={log.id}
                    className={`rounded-[28px] border bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ${
                      log.priority === "critical"
                        ? "border-rose-200"
                        : log.priority === "high"
                          ? "border-amber-200"
                          : "border-[#dbe6e0]"
                    } ${log.archived ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[#f7fcf9] px-3 py-1 text-[11px] font-black text-[#486b5d]">
                            {shiftLabel(log.shift_type)}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
                            {priorityLabel(log.priority)}
                          </span>
                          {!read ? (
                            <span className="rounded-full bg-[#047857] px-3 py-1 text-[11px] font-black text-white">Nauja</span>
                          ) : null}
                          {log.is_important ? (
                            <span className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-black text-rose-700">Svarbu</span>
                          ) : null}
                        </div>

                        <h3 className="mt-3 text-xl font-black leading-tight tracking-[-0.02em] text-[#10251f]">
                          {log.title}
                        </h3>
                        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-[#526174]">
                          {log.note}
                        </p>
                      </div>

                      {!read ? (
                        <button
                          type="button"
                          onClick={() => void markRead(log)}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-emerald-50 text-emerald-700"
                          aria-label="Patvirtinti, kad mačiau"
                        >
                          <CheckCircle2 className="h-6 w-6" />
                        </button>
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#ffffff] text-[#8ea0b5]">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div className="mt-4 rounded-[22px] bg-[#ffffff] p-3">
                      <p className="line-clamp-1 text-sm font-black text-[#486b5d]">{residentName(resident, roomsById)}</p>
                      <p className="mt-1 text-xs font-bold text-[#526174]">
                        {formatShortDate(log.shift_date)} · {profileName(author)}
                      </p>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="flex-1 rounded-[18px] bg-[#047857] px-4 py-3 text-sm font-black text-white"
                      >
                        Atidaryti
                      </button>
                      {!log.archived ? (
                        <button
                          type="button"
                          onClick={() => void archiveLog(log)}
                          className="rounded-[18px] border border-[#dbe6e0] bg-white px-4 py-3 text-sm font-black text-[#486b5d]"
                        >
                          Arch.
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </section>

        <button
          type="button"
          onClick={() => setMobileCreateOpen(true)}
          className="fixed bottom-28 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-[#047857] text-white shadow-2xl active:scale-95"
          aria-label="Naujas perdavimo įrašas"
        >
          <Plus className="h-7 w-7" />
        </button>

        {mobileCreateOpen ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-[#047857]/50 p-4 backdrop-blur-sm md:p-6">
            <section className="max-h-[calc(100vh-48px)] w-full max-w-[980px] overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)]">
              <div className="flex items-start justify-between gap-5 bg-[#486b5d] px-6 py-5 text-white">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/80">Naujas įrašas</p>
                  <h2 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">Perduoti informaciją</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileCreateOpen(false)}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Uždaryti"
                >
                  <X size={28} strokeWidth={2.1} />
                </button>
              </div>

              <div className="max-h-[calc(100vh-178px)] space-y-4 overflow-y-auto bg-[#ffffff] p-6">
                <Field label="Gyventojas">
                  <select value={form.resident_id} onChange={(event) => setForm((prev) => ({ ...prev, resident_id: event.target.value }))} className="input">
                    <option value="">Bendra įstaigos informacija</option>
                    {residents.map((resident) => (
                      <option key={resident.id} value={resident.id}>{residentName(resident, roomsById)}</option>
                    ))}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Pamaina">
                    <select value={form.shift_type} onChange={(event) => setForm((prev) => ({ ...prev, shift_type: event.target.value as ShiftType }))} className="input">
                      {SHIFTS.map((shift) => <option key={shift.value} value={shift.value}>{shift.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Prioritetas">
                    <select value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as Priority }))} className="input">
                      {PRIORITIES.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="Pavadinimas">
                  <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} className="input" placeholder="Pvz. Stebėti po kritimo" />
                </Field>

                <Field label="Informacija">
                  <textarea value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} className="input min-h-32 resize-none" placeholder="Ką būtina perduoti kitai pamainai?" />
                </Field>

                <div className="grid gap-2">
                  <label className="flex items-center gap-3 rounded-[20px] border border-[#dbe6e0] bg-[#ffffff] p-4 text-sm font-black text-[#486b5d]">
                    <input type="checkbox" checked={form.is_important} onChange={(event) => setForm((prev) => ({ ...prev, is_important: event.target.checked }))} />
                    Pažymėti kaip svarbų
                  </label>
                  <label className="flex items-center gap-3 rounded-[20px] border border-[#dbe6e0] bg-[#ffffff] p-4 text-sm font-black text-[#486b5d]">
                    <input type="checkbox" checked={form.needs_follow_up} onChange={(event) => setForm((prev) => ({ ...prev, needs_follow_up: event.target.checked }))} />
                    Reikia sekti kitai pamainai
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => void createLog().then(() => setMobileCreateOpen(false))}
                  disabled={saving}
                  className="flex h-14 w-full items-center justify-center rounded-[20px] bg-emerald-800 text-base font-black text-white shadow-lg disabled:opacity-60"
                >
                  {saving ? "Saugoma..." : "Sukurti įrašą"}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {selectedLog ? (
          <LogModal
            log={selectedLog}
            resident={residents.find((item) => item.id === selectedLog.resident_id)}
            author={profiles.find((item) => item.id === selectedLog.created_by)}
            comments={comments.filter((comment) => comment.handover_id === selectedLog.id)}
            profiles={profiles}
            roomsById={roomsById}
            commentText={commentText}
            setCommentText={setCommentText}
            onClose={() => setSelectedLog(null)}
            onAddComment={() => void addComment()}
            saving={saving}
          />
        ) : null}

        <style jsx>{`
          .input {
            width: 100%;
            border-radius: 1.15rem;
            border: 1px solid #dbe3ef;
            background: white;
            padding: 0.9rem 1rem;
            font-weight: 850;
            color: #0f172a;
            outline: none;
          }

          .input:focus {
            border-color: #10b981;
            box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.12);
          }
        `}</style>

        <MobileBottomNav />
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#ffffff] p-6 text-[#10251f]">
        <div className="mx-auto w-full max-w-[1700px] rounded-[22px] border border-[#dbe6e0] bg-white p-8 text-center font-black shadow-sm">
          Kraunama perdavimo žurnalus...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#ffffff] p-6 text-[#10251f]">
      <div className="mx-auto w-full max-w-[1700px] space-y-6">
        <section className="overflow-hidden rounded-[30px] border border-emerald-900/10 bg-white shadow-[0_16px_45px_rgba(16,37,31,0.14)]">
          <div className="flex flex-col gap-6 bg-[#486b5d] p-7 text-white lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#e8f7ef] text-[#486b5d] shadow-sm">
                <ClipboardList className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-100/80">Perdavimo žurnalai</p>
                <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-white">Pamainų perdavimas</h1>
                <p className="mt-2 max-w-4xl text-lg font-semibold text-white/85">
                  Svarbi informacija tarp pamainų, susieta su gyventojais ir atsakomybės tęstinumu.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setHelpOpen(true)} className="inline-flex items-center gap-2 rounded-[14px] bg-white/10 px-5 py-3 font-extrabold text-white ring-1 ring-white/15 transition hover:bg-white/20">
                <HelpCircle className="h-4 w-4" /> Pagalba
              </button>
              <button type="button" onClick={() => void loadAll()} className="inline-flex items-center gap-2 rounded-[14px] bg-[#e8f7ef] px-5 py-3 font-extrabold text-[#486b5d] transition hover:bg-white">
                <RefreshCw className="h-4 w-4" /> Atnaujinti
              </button>
            </div>
          </div>

          <div className="border-t border-emerald-900/10 bg-[#f7fcf9] p-3">
            <div className="flex flex-wrap gap-2">
              <HandoverTab active={!includeArchived && !unreadOnly && !importantOnly} icon={<ClipboardList className="h-4 w-4" />} label="Visi aktyvūs" count={stats.all} onClick={() => { setIncludeArchived(false); setUnreadOnly(false); setImportantOnly(false); }} />
              <HandoverTab active={unreadOnly} icon={<CheckCircle2 className="h-4 w-4" />} label="Nepatvirtinti" count={stats.unread} onClick={() => { setIncludeArchived(false); setUnreadOnly((v) => !v); }} />
              <HandoverTab active={importantOnly} icon={<ShieldAlert className="h-4 w-4" />} label="Svarbūs" count={stats.important} onClick={() => setImportantOnly((v) => !v)} />
              <HandoverTab active={includeArchived} icon={<Archive className="h-4 w-4" />} label="Archyvas" onClick={() => { setUnreadOnly(false); setIncludeArchived((v) => !v); }} />
            </div>
          </div>
        </section>

        {message ? <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-5 font-extrabold text-amber-900">{message}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <Stat title="Visi" value={stats.all} />
          <Stat title="Nepatvirtinti" value={stats.unread} tone="blue" />
          <Stat title="Svarbūs" value={stats.important} tone="amber" />
          <Stat title="Kritiniai" value={stats.critical} tone="rose" />
          <Stat title="Sekti" value={stats.followUp} tone="emerald" />
          <Stat title="Incidentai" value={stats.incidents} tone="rose" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[560px_minmax(0,1fr)]">
          <article className="xl:sticky xl:top-6 self-start rounded-[24px] border border-[#c9d8d0] bg-white p-6 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100/80">Naujas įrašas</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Perduoti informaciją</h2>
            <p className="mt-1 font-semibold text-[#526174]">Pirmiausia pasirink temą, tada, jei reikia, priskirk gyventoją.</p>

            <div className="mt-5 space-y-4">
              <Field label="Tema">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TOPIC_BUTTONS.map((topic) => {
                    const isActive = form.category === topic.category;

                    return (
                      <button
                        key={topic.label}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            category: topic.category,
                            priority: topic.priority,
                            title: prev.title || topic.title,
                          }))
                        }
                        className={[
                          "min-h-12 rounded-[14px] border px-3 py-2 text-sm font-black transition",
                          isActive
                            ? "border-emerald-300 bg-emerald-700 text-white shadow-sm"
                            : "border-[#dbe6e0] bg-[#ffffff] text-[#486b5d] hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800",
                        ].join(" ")}
                      >
                        {topic.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Gyventojas">
                <select value={form.resident_id} onChange={(event) => setForm((prev) => ({ ...prev, resident_id: event.target.value }))} className="input">
                  <option value="">Nepriskirta konkrečiam gyventojui</option>
                  {residents.map((resident) => (
                    <option key={resident.id} value={resident.id}>{residentName(resident, roomsById)}</option>
                  ))}
                </select>
              </Field>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Data"><input type="date" value={form.shift_date} onChange={(event) => setForm((prev) => ({ ...prev, shift_date: event.target.value }))} className="input" /></Field>
                <Field label="Pamaina">
                  <select value={form.shift_type} onChange={(event) => setForm((prev) => ({ ...prev, shift_type: event.target.value as ShiftType }))} className="input">
                    {SHIFTS.map((shift) => <option key={shift.value} value={shift.value}>{shift.label}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Kategorija">
                  <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} className="input">
                    {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </Field>
                <Field label="Prioritetas">
                  <select value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as Priority }))} className="input">
                    {PRIORITIES.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Pavadinimas"><input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Pvz. Stebėti po kritimo" className="input" /></Field>
              <Field label="Informacija"><textarea value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} placeholder="Ką būtina perduoti kitai pamainai?" className="input min-h-32 resize-none" /></Field>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {QUICK_TEMPLATES.map((template) => (
                  <button key={template} type="button" onClick={() => setForm((prev) => ({ ...prev, title: prev.title || template, note: prev.note ? `${prev.note}\n${template}` : template }))} className="rounded-[14px] border border-[#dbe6e0] bg-[#ffffff] px-3 py-2 text-left text-xs font-black text-[#526174] hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
                    + {template}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-3 rounded-[14px] border border-[#dbe6e0] bg-[#ffffff] p-4 text-sm font-black text-[#486b5d]">
                <input type="checkbox" checked={form.is_important} onChange={(event) => setForm((prev) => ({ ...prev, is_important: event.target.checked }))} />
                Pažymėti kaip svarbų
              </label>
              <label className="flex items-center gap-3 rounded-[14px] border border-[#dbe6e0] bg-[#ffffff] p-4 text-sm font-black text-[#486b5d]">
                <input type="checkbox" checked={form.needs_follow_up} onChange={(event) => setForm((prev) => ({ ...prev, needs_follow_up: event.target.checked }))} />
                Reikia sekti / perduoti kitai pamainai
              </label>

              <button type="button" onClick={() => void createLog()} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#047857] px-5 py-3 font-extrabold text-white transition hover:bg-[#036747] disabled:opacity-60">
                <Plus className="h-4 w-4" /> {saving ? "Saugoma..." : "Sukurti įrašą"}
              </button>
            </div>
          </article>

          <div className="min-w-0 space-y-6">
            <article className="rounded-[24px] border border-[#c9d8d0] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Filtrai</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-[#10251f]">Pamainos informacija</h2>
                  <p className="mt-1 text-sm font-semibold text-[#526174]">Atrinkite įrašus pagal gyventoją, prioritetą, pamainą ir būseną.</p>
                </div>
                <label className="relative block w-full xl:max-w-md">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8ea0b5]" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ieškoti pagal tekstą, gyventoją..." className="h-12 w-full rounded-[14px] border border-[#dbe6e0] bg-[#ffffff] py-3 pl-12 pr-4 font-bold text-[#10251f] outline-none focus:border-emerald-300 focus:bg-white" />
                </label>
              </div>

              <div className="mt-5 space-y-3">
                <div className="grid gap-3 lg:grid-cols-3">
                  <select
                    value={residentFilter}
                    onChange={(event) => setResidentFilter(event.target.value)}
                    className="h-14 w-full min-w-0 rounded-[14px] border border-[#dbe6e0] bg-white px-5 text-sm font-black text-[#10251f] outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                  >
                    <option value="all">Visi gyventojai</option>
                    {residents.map((resident) => (
                      <option key={resident.id} value={resident.id}>
                        {residentName(resident, roomsById)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value)}
                    className="h-14 w-full min-w-0 rounded-[14px] border border-[#dbe6e0] bg-white px-5 text-sm font-black text-[#10251f] outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                  >
                    <option value="all">Visi prioritetai</option>
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={shiftFilter}
                    onChange={(event) => setShiftFilter(event.target.value)}
                    className="h-14 w-full min-w-0 rounded-[14px] border border-[#dbe6e0] bg-white px-5 text-sm font-black text-[#10251f] outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                  >
                    <option value="all">Visos pamainos</option>
                    {SHIFTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <FilterToggle active={!includeArchived && !unreadOnly && !importantOnly} onClick={() => { setIncludeArchived(false); setUnreadOnly(false); }}>Visi aktyvūs</FilterToggle>
                  <FilterToggle active={unreadOnly} onClick={() => { setIncludeArchived(false); setUnreadOnly((v) => !v); }}>Nepatvirtinti</FilterToggle>
                  <FilterToggle active={importantOnly} onClick={() => setImportantOnly((v) => !v)}>Svarbūs</FilterToggle>
                  <FilterToggle active={includeArchived} onClick={() => { setUnreadOnly(false); setIncludeArchived((v) => !v); }}>Archyvas</FilterToggle>
                </div>
              </div>
            </article>

            {hotResidents.length > 0 ? (
              <article className="rounded-[24px] border border-[#c9d8d0] bg-white p-6 shadow-[0_1px_3px_rgba(16,37,31,0.10)]">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Dažniausiai minimi</p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {hotResidents.map((item) => (
                    <button key={item.resident.id} type="button" onClick={() => setResidentFilter(item.resident.id)} className="rounded-[14px] border border-[#dbe6e0] bg-[#ffffff] p-4 text-left hover:border-emerald-200 hover:bg-emerald-50">
                      <p className="font-black text-[#10251f]">{residentName(item.resident, roomsById)}</p>
                      <p className="mt-1 text-sm font-bold text-[#526174]">{item.count} įrašai · {item.critical} krit.</p>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            <section className="grid gap-4">
              {filteredLogs.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[#c9d8d0] bg-white p-10 text-center font-bold text-[#526174]">Perdavimo įrašų pagal filtrus nėra.</div>
              ) : (
                filteredLogs.map((log) => {
                  const resident = residents.find((item) => item.id === log.resident_id);
                  const author = profiles.find((item) => item.id === log.created_by);
                  const read = isRead(log.id);

                  return (
                    <article key={log.id} className={`rounded-[22px] border p-5 shadow-sm ${priorityClasses(log.priority)} ${log.archived ? "opacity-60" : ""}`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${priorityPillClasses(log.priority)}`}>{priorityLabel(log.priority)}</span>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#486b5d]">{shiftLabel(log.shift_type)}</span>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#486b5d]">{log.category}</span>
                            {log.is_important ? <span className="rounded-full bg-red-900 px-3 py-1 text-xs font-black text-white">Svarbu</span> : null}
                            {log.needs_follow_up ? <span className="rounded-full bg-[#047857] px-3 py-1 text-xs font-black text-white">Sekti</span> : null}
                          </div>
                          <h3 className="mt-3 text-2xl font-black text-[#10251f]">{log.title}</h3>
                          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-[#486b5d]">{log.note}</p>
                          <p className="mt-3 text-sm font-bold text-[#526174]">{residentName(resident, roomsById)} · {formatShortDate(log.shift_date)} · Sukūrė: {profileName(author)} · {formatDate(log.created_at)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <button type="button" onClick={() => setSelectedLog(log)} className="inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-2 text-sm font-black text-[#486b5d] shadow-sm hover:bg-[#ffffff]"><MessageSquare className="h-4 w-4" /> Komentarai</button>
                          {!read ? <button type="button" onClick={() => void markRead(log)} className="inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-2 text-sm font-black text-emerald-700 shadow-sm hover:bg-emerald-50"><CheckCircle2 className="h-4 w-4" /> Patvirtinti, kad mačiau</button> : null}
                          {!log.archived ? <button type="button" onClick={() => void archiveLog(log)} className="inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-2 text-sm font-black text-[#486b5d] shadow-sm hover:bg-[#ffffff]"><Archive className="h-4 w-4" /> Archyvas</button> : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </section>
          </div>
        </section>
      </div>

      {selectedLog ? (
        <LogModal
          log={selectedLog}
          resident={residents.find((item) => item.id === selectedLog.resident_id)}
          author={profiles.find((item) => item.id === selectedLog.created_by)}
          comments={comments.filter((comment) => comment.handover_id === selectedLog.id)}
          profiles={profiles}
          roomsById={roomsById}
          commentText={commentText}
          setCommentText={setCommentText}
          onClose={() => setSelectedLog(null)}
          onAddComment={() => void addComment()}
          saving={saving}
        />
      ) : null}

      {helpOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#047857]/45 p-4 backdrop-blur-sm">
          <section className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#dbe6e0] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-6 bg-[#486b5d] p-5 text-white">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
                  Kaip naudoti
                </p>
                <h2 className="mt-1 text-4xl font-black tracking-tight text-white">
                  Perdavimo žurnalų taisyklės
                </h2>
                <p className="mt-2 max-w-3xl text-base font-semibold leading-7 text-[#526174]">
                  Perdavimo žurnalas skirtas informacijai tarp pamainų perduoti, atsakomybei tęsti ir rizikoms mažinti.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[#f7fcf9] text-[#526174] transition hover:bg-[#dbe6e0]"
                aria-label="Uždaryti"
              >
                <X size={28} strokeWidth={2.1} />
              </button>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-2">
              <HelpRuleCard
                title="1. Rašyk tik būtina informaciją"
                text="Įrašas turi būti naudingas kitai pamainai arba gyventojo priežiūros tęstinumui. Venk perteklinių ir neaktualių asmens duomenų."
              />
              <HelpRuleCard
                title="2. Priskirk gyventoją"
                text="Jei įrašas apie konkretų gyventoją, pasirink gyventoją. Tada įrašas bus matomas ir bendrame perdavimo žurnale, ir gyventojo kortelėje."
              />
              <HelpRuleCard
                title="3. Naudok prioritetus"
                text="Kritinis prioritetas tinka incidentams, sveikatos pokyčiams ir situacijoms, kur reikia greito veiksmo. Svarbus įrašas lieka aiškiai pažymėtas."
              />
              <HelpRuleCard
                title="4. Patvirtink, kad matei"
                text="Kita pamaina ir atsakingi darbuotojai turi patvirtinti, kad įrašą matė. Iki patvirtinimo įrašas lieka nepatvirtintų sąraše."
              />
              <HelpRuleCard
                title="5. Gyventojo kortelėje įrašas lieka"
                text="Su gyventoju susietas perdavimo įrašas gyventojo kortelėje lieka kaip istorija. Bendrame sąraše galima filtruoti ir archyvuoti pagal darbo eigą."
              />
              <HelpRuleCard
                title="6. Audit log"
                text="Sukūrimas, patvirtinimas, komentaras ir archyvavimas įrašomi į auditą, kad būtų matoma kas, kada ir ką atliko."
              />
            </div>
          </section>
        </div>
      ) : null}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.875rem;
          border: 1px solid #dbe6e0;
          background: white;
          padding: 0.9rem 1rem;
          font-weight: 800;
          color: #10251f;
          outline: none;
        }
        .input:focus {
          border-color: #047857;
          box-shadow: 0 0 0 4px rgba(4, 120, 87, 0.12);
        }
      `}</style>
    </main>
  );
}

function HandoverTab({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-black transition ${
        active
          ? "bg-white text-[#10251f] shadow-sm ring-1 ring-[#c9d8d0]"
          : "text-[#486b5d] hover:bg-white/70"
      }`}
    >
      {icon}
      {label}
      {typeof count === "number" ? (
        <span className="ml-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-black text-[#047857] ring-1 ring-[#c9d8d0]">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function MobileHeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] bg-white/15 p-4 backdrop-blur">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-emerald-50">{label}</div>
    </div>
  );
}

function MobileMiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[24px] border border-[#dbe6e0] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="text-2xl font-black text-[#10251f]">{value}</div>
      <div className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#526174]">{label}</div>
    </div>
  );
}

function MobileFilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-black transition active:scale-[0.98] ${
        active
          ? "bg-[#047857] text-white shadow-sm"
          : "border border-[#dbe6e0] bg-white text-[#526174]"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ title, value, tone = "slate" }: { title: string; value: number; tone?: "slate" | "blue" | "amber" | "rose" | "emerald" }) {
  const toneClass = {
    slate: "bg-white text-[#486b5d]",
    blue: "bg-[#f7fcf9] text-[#047857]",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-800",
    emerald: "bg-emerald-50 text-[#047857]",
  }[tone];

  return (
    <article className={`rounded-[22px] border border-[#dbe6e0] p-5 shadow-[0_1px_3px_rgba(16,37,31,0.08)] ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{title}</p>
      <p className="mt-2 text-4xl font-black tracking-[-0.03em]">{value}</p>
    </article>
  );
}


function HelpRuleCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-[22px] border border-[#dbe6e0] bg-[#ffffff] p-5">
      <h3 className="text-lg font-black text-[#10251f]">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#526174]">{text}</p>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-extrabold uppercase tracking-widest text-[#526174]">{label}</span>
      {children}
    </label>
  );
}

function FilterToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-12 items-center justify-center rounded-[14px] border px-4 text-sm font-black transition ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#dbe6e0] bg-white text-[#526174] hover:border-slate-300 hover:bg-[#ffffff]"}`}>
      {children}
    </button>
  );
}

function LogModal({
  log,
  resident,
  author,
  comments,
  profiles,
  roomsById,
  commentText,
  setCommentText,
  onClose,
  onAddComment,
  saving,
}: {
  log: HandoverLog;
  resident?: Resident;
  author?: Profile;
  comments: Comment[];
  profiles: Profile[];
  roomsById: Record<string, string>;
  commentText: string;
  setCommentText: (value: string) => void;
  onClose: () => void;
  onAddComment: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#047857]/45 p-4 backdrop-blur-sm">
      <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-6 border-b border-[#dbe6e0] p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Perdavimo įrašas</p>
            <h2 className="mt-1 text-4xl font-black tracking-tight">{log.title}</h2>
            <p className="mt-2 font-semibold text-[#526174]">{residentName(resident, roomsById)} · {profileName(author)} · {formatDate(log.created_at)}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[#f7fcf9] text-[#526174]"><X size={28} strokeWidth={2.1} /></button>
        </div>

        <div className="space-y-5 p-5">
          <div className={`rounded-[22px] border p-5 ${priorityClasses(log.priority)}`}>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-black ${priorityPillClasses(log.priority)}`}>{priorityLabel(log.priority)}</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#486b5d]">{shiftLabel(log.shift_type)}</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#486b5d]">{log.category}</span>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm font-semibold leading-6 text-[#486b5d]">{log.note}</p>
          </div>

          <div className="rounded-[22px] border border-[#dbe6e0] bg-[#ffffff] p-5">
            <h3 className="text-xl font-black">Komentarai</h3>
            <div className="mt-4 space-y-3">
              {comments.length ? comments.map((comment) => {
                const author = profiles.find((profile) => profile.id === comment.created_by);
                return (
                  <div key={comment.id} className="rounded-[14px] bg-white p-4">
                    <p className="font-black text-[#10251f]">{profileName(author)}</p>
                    <p className="mt-1 text-sm font-semibold text-[#526174]">{formatDate(comment.created_at)}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-[#486b5d]">{comment.comment}</p>
                  </div>
                );
              }) : <p className="text-sm font-bold text-[#526174]">Komentarų nėra.</p>}
            </div>
            <div className="mt-4 flex gap-3">
              <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} className="input min-h-20 flex-1 resize-none" placeholder="Parašyti komentarą..." />
              <button type="button" onClick={onAddComment} disabled={saving || !commentText.trim()} className="rounded-[14px] bg-emerald-800 px-5 py-3 font-black text-white hover:bg-emerald-900 disabled:opacity-60">Pridėti</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
