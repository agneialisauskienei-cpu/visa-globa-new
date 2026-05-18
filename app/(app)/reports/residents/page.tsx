"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  BarChart3,
  BedDouble,
  CalendarDays,
  CircleAlert,
  FileSpreadsheet,
  Home,
  PieChart,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/current-organization"

type Resident = {
  id: string
  organization_id: string
  resident_code: string | null
  full_name: string | null
  first_name: string | null
  last_name: string | null
  current_status: string | null
  current_room_id: string | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  care_level: string | null
  assigned_to: string | null
  birth_date: string | null
  internal_notes: string | null
}

type Room = {
  id: string
  name: string | null
  is_active?: boolean | null
}

type ResidentAssignment = {
  resident_id: string
  user_id: string
  is_primary: boolean | null
}

type Filters = {
  period: "all" | "month" | "previous_month" | "year"
  floor: string
  room: string
  status: string
  careLevel: string
  risk: RiskKey | ""
}

type RiskKey = "unassigned" | "fall" | "nutrition" | "behavior" | "infection" | "missing_room" | "hospital"
type DetailMode = "all" | "active" | "occupancy" | "free_rooms" | "attention" | RiskKey

const STATUS_LABELS: Record<string, string> = {
  netrukus_atvyks: "Netrukus atvyks",
  gyvena: "Gyvena",
  ligonineje: "Ligoninėje",
  laikinai_isvykes: "Laikinai išvykęs",
  sutartis_nutraukta: "Sutartis nutraukta",
  mire: "Miręs",
}

const CARE_LABELS: Record<string, string> = {
  savarankiskas: "Savarankiškas",
  daline_slauga: "Dalinė slauga",
  slauga: "Slauga",
  intensyvi_slauga: "Intensyvi slauga",
}

const RISK_LABELS: Record<RiskKey, string> = {
  unassigned: "Be atsakingo darbuotojo",
  fall: "Griuvimo rizika",
  nutrition: "Mitybos rizika",
  behavior: "Elgesio rizika",
  infection: "Infekcijų / izoliacijos rizika",
  missing_room: "Be kambario",
  hospital: "Ligoninėje",
}

const DEFAULT_FILTERS: Filters = {
  period: "all",
  floor: "",
  room: "",
  status: "",
  careLevel: "",
  risk: "",
}

export default function ResidentsReportPage() {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [residents, setResidents] = useState<Resident[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [assignments, setAssignments] = useState<Record<string, string[]>>({})
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [detailMode, setDetailMode] = useState<DetailMode>("attention")

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setMessage("")

      const organizationId = await getCurrentOrganizationId()
      if (!organizationId) {
        setMessage("Nepavyko nustatyti aktyvios įstaigos.")
        setResidents([])
        setRooms([])
        setAssignments({})
        return
      }

      const [residentsResult, roomsResult] = await Promise.all([
        supabase
          .from("residents")
          .select("id, organization_id, resident_code, full_name, first_name, last_name, current_status, current_room_id, is_active, created_at, updated_at, care_level, assigned_to, birth_date, internal_notes")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false }),
        supabase
          .from("rooms")
          .select("id, name, is_active")
          .eq("organization_id", organizationId)
          .order("name", { ascending: true }),
      ])

      if (residentsResult.error) throw residentsResult.error
      if (roomsResult.error) throw roomsResult.error

      const residentRows = (residentsResult.data || []) as Resident[]
      const residentIds = residentRows.map((resident) => resident.id)
      let assignmentsByResident: Record<string, string[]> = {}

      if (residentIds.length > 0) {
        const assignmentsResult = await supabase
          .from("resident_assignments")
          .select("resident_id, user_id, is_primary")
          .in("resident_id", residentIds)

        if (!assignmentsResult.error) {
          assignmentsByResident = ((assignmentsResult.data || []) as ResidentAssignment[]).reduce(
            (acc, assignment) => {
              if (!assignment.resident_id || !assignment.user_id) return acc
              acc[assignment.resident_id] = acc[assignment.resident_id] || []
              acc[assignment.resident_id].push(assignment.user_id)
              return acc
            },
            {} as Record<string, string[]>
          )
        }
      }

      for (const resident of residentRows) {
        if (resident.assigned_to) {
          assignmentsByResident[resident.id] = Array.from(
            new Set([...(assignmentsByResident[resident.id] || []), resident.assigned_to])
          )
        }
      }

      setResidents(residentRows)
      setRooms((roomsResult.data || []) as Room[])
      setAssignments(assignmentsByResident)
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setLoading(false)
    }
  }

  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms])

  const floors = useMemo(() => {
    return Array.from(new Set(rooms.map((room) => getFloor(room.name)).filter(Boolean))).sort()
  }, [rooms])

  const filteredResidents = useMemo(() => {
    return residents.filter((resident) => {
      if (!matchesPeriod(resident, filters.period)) return false
      if (filters.status && normalizeStatus(resident.current_status) !== filters.status) return false
      if (filters.careLevel && normalizeCareLevel(resident.care_level) !== filters.careLevel) return false
      if (filters.room && resident.current_room_id !== filters.room) return false
      if (filters.floor && getFloor(roomById.get(resident.current_room_id || "")?.name) !== filters.floor) return false
      if (filters.risk && !hasRisk(resident, filters.risk, assignments)) return false
      return true
    })
  }, [residents, filters, assignments, roomById])

  const stats = useMemo(() => {
    const active = filteredResidents.filter(isActiveResident)
    const occupiedRooms = new Set(active.map((resident) => resident.current_room_id).filter(Boolean))
    const activeRooms = rooms.filter((room) => room.is_active !== false)
    const freeRooms = activeRooms.filter((room) => !occupiedRooms.has(room.id))
    const occupancy = activeRooms.length ? Math.round((occupiedRooms.size / activeRooms.length) * 100) : 0
    const attentionResidents = filteredResidents.filter((resident) => getResidentRisks(resident, assignments).length > 0)

    return {
      active,
      activeCount: active.length,
      occupancy,
      freeRooms,
      attentionResidents,
      statusCounts: countBy(filteredResidents, (resident) => normalizeStatus(resident.current_status) || "nezinoma"),
      careCounts: countBy(filteredResidents, (resident) => normalizeCareLevel(resident.care_level) || "nepasirinkta"),
      risks: (Object.keys(RISK_LABELS) as RiskKey[]).map((key) => ({
        key,
        label: RISK_LABELS[key],
        residents: filteredResidents.filter((resident) => hasRisk(resident, key, assignments)),
      })),
    }
  }, [filteredResidents, rooms, assignments])

  const detailRows = useMemo(() => {
    if (detailMode === "all") return filteredResidents
    if (detailMode === "active") return stats.active
    if (detailMode === "occupancy") return stats.active.filter((resident) => resident.current_room_id)
    if (detailMode === "free_rooms") return []
    if (detailMode === "attention") return stats.attentionResidents
    return filteredResidents.filter((resident) => hasRisk(resident, detailMode, assignments))
  }, [detailMode, filteredResidents, stats, assignments])

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, ...(key === "floor" ? { room: "" } : {}) }))
  }

  function exportCsv() {
    const rows = filteredResidents.map((resident) => ({
      kodas: resident.resident_code || "",
      vardas: residentName(resident),
      statusas: statusLabel(resident.current_status),
      kambarys: roomName(resident.current_room_id, roomById),
      prieziuros_lygis: careLabel(resident.care_level),
      rizikos: getResidentRisks(resident, assignments).map((risk) => risk.label).join("; "),
      atnaujinta: formatDate(resident.updated_at || resident.created_at),
    }))
    downloadCsv(rows, "gyventoju-ataskaita.csv")
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link href="/reports" className="inline-flex items-center gap-2 text-sm font-black text-emerald-700">
          <ArrowLeft className="h-4 w-4" />
          Grįžti į ataskaitas
        </Link>

        <section className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-emerald-50 text-emerald-700">
                <Users className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-700">Gyventojų analitika</p>
                <h1 className="mt-3 text-5xl font-black tracking-tight">Gyventojų ataskaita</h1>
                <p className="mt-3 max-w-4xl text-lg font-bold text-slate-500">
                  Filtruojama suvestinė pagal statusą, kambarį, priežiūros lygį ir rizikas. Skaičiai yra paspaudžiami.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => window.print()} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700">
                Spausdinti
              </button>
              <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700">
                <FileSpreadsheet className="h-4 w-4" />
                CSV
              </button>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-md transition hover:bg-emerald-800">
                <ArrowDownToLine className="h-4 w-4" />
                PDF
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700">{message}</div>
        ) : null}

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-7">
            <Select value={filters.period} onChange={(value) => updateFilter("period", value as Filters["period"])}>
              <option value="all">Visas laikotarpis</option>
              <option value="month">Šis mėnuo</option>
              <option value="previous_month">Praėjęs mėnuo</option>
              <option value="year">Šie metai</option>
            </Select>
            <Select value={filters.floor} onChange={(value) => updateFilter("floor", value)}>
              <option value="">Visi aukštai</option>
              {floors.map((floor) => <option key={floor} value={floor}>{floor}</option>)}
            </Select>
            <Select value={filters.room} onChange={(value) => updateFilter("room", value)}>
              <option value="">Visi kambariai</option>
              {rooms
                .filter((room) => !filters.floor || getFloor(room.name) === filters.floor)
                .map((room) => <option key={room.id} value={room.id}>{room.name || room.id}</option>)}
            </Select>
            <Select value={filters.status} onChange={(value) => updateFilter("status", value)}>
              <option value="">Visos būsenos</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select value={filters.careLevel} onChange={(value) => updateFilter("careLevel", value)}>
              <option value="">Visi priežiūros lygiai</option>
              {Object.entries(CARE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select value={filters.risk} onChange={(value) => updateFilter("risk", value as RiskKey | "")}>
              <option value="">Visos rizikos</option>
              {Object.entries(RISK_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 text-sm font-black text-slate-700 transition hover:bg-slate-100">
              Valyti
            </button>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Aktyvūs gyventojai" value={loading ? "..." : String(stats.activeCount)} desc="Gyvena arba netrukus atvyks pagal pasirinktus filtrus." onClick={() => setDetailMode("active")} />
          <KpiCard title="Užimtumas" value={loading ? "..." : `${stats.occupancy}%`} desc="Užimti aktyvūs kambariai pagal gyventojus." onClick={() => setDetailMode("occupancy")} />
          <KpiCard title="Laisvos vietos" value={loading ? "..." : String(stats.freeRooms.length)} desc="Aktyvūs kambariai be aktyvaus gyventojo." onClick={() => setDetailMode("free_rooms")} />
          <KpiCard title="Reikia dėmesio" value={loading ? "..." : String(stats.attentionResidents.length)} desc="Rizikos, trūkstami kambariai arba priskyrimai." tone="warning" onClick={() => setDetailMode("attention")} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[30px] border border-orange-100 bg-orange-50/70 p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <CircleAlert className="h-6 w-6 text-orange-600" />
              <h2 className="text-2xl font-black">Reikia dėmesio</h2>
            </div>
            <div className="mt-5 space-y-3">
              {stats.risks.filter((risk) => risk.residents.length > 0).slice(0, 6).map((risk) => (
                <button key={risk.key} type="button" onClick={() => setDetailMode(risk.key)} className="flex w-full items-center justify-between rounded-2xl bg-white/80 p-4 text-left text-sm font-black text-orange-800 transition hover:bg-white">
                  <span>{risk.label}</span>
                  <span className="rounded-full bg-orange-100 px-3 py-1">{risk.residents.length}</span>
                </button>
              ))}
              {!loading && stats.attentionResidents.length === 0 ? (
                <div className="rounded-2xl bg-white/80 p-4 text-sm font-black text-emerald-700">Pagal filtrus rizikų nerasta.</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <BedDouble className="h-6 w-6 text-emerald-700" />
              <h2 className="text-2xl font-black">Slaugos ir priežiūros apkrova</h2>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(CARE_LABELS).map(([key, label]) => (
                <button key={key} type="button" onClick={() => updateFilter("careLevel", key)} className="rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-emerald-50">
                  <p className="text-sm font-black text-slate-500">{label}</p>
                  <p className="mt-1 text-3xl font-black">{stats.careCounts[key] || 0}</p>
                </button>
              ))}
              <button type="button" onClick={() => updateFilter("careLevel", "")} className="rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-emerald-50">
                <p className="text-sm font-black text-slate-500">Nepasirinkta</p>
                <p className="mt-1 text-3xl font-black">{stats.careCounts.nepasirinkta || 0}</p>
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <ChartCard title="Atvykimai ir būsenų pokyčiai" icon={<BarChart3 className="h-6 w-6 text-emerald-700" />}>
            <div className="mt-6 flex h-[280px] items-end gap-4 rounded-[24px] bg-slate-50 p-6">
              {Object.entries(STATUS_LABELS).map(([key, label]) => {
                const value = stats.statusCounts[key] || 0
                const height = Math.max(8, Math.round((value / Math.max(filteredResidents.length, 1)) * 100))
                return (
                  <button key={key} type="button" onClick={() => updateFilter("status", key)} className="flex flex-1 flex-col items-center gap-3">
                    <div className="w-full rounded-t-2xl bg-emerald-600 transition hover:bg-emerald-700" style={{ height: `${height}%` }} />
                    <span className="text-center text-[11px] font-black text-slate-500">{label}</span>
                    <span className="text-xs font-black text-slate-900">{value}</span>
                  </button>
                )
              })}
            </div>
          </ChartCard>

          <ChartCard title="Užimtumas ir būsenos" icon={<PieChart className="h-6 w-6 text-emerald-700" />}>
            <div className="mt-6 grid gap-5 md:grid-cols-[220px_1fr]">
              <button type="button" onClick={() => setDetailMode("occupancy")} className="flex h-[220px] w-[220px] items-center justify-center rounded-full border-[34px] border-emerald-600 bg-emerald-50">
                <div className="text-center">
                  <div className="text-4xl font-black">{stats.occupancy}%</div>
                  <div className="text-sm font-black text-slate-500">užimtumas</div>
                </div>
              </button>
              <div className="space-y-3">
                {Object.entries(STATUS_LABELS).slice(0, 4).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => updateFilter("status", key)} className="flex w-full items-center justify-between rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-emerald-50">
                    <span className="font-black">{label}</span>
                    <span className="text-sm font-black text-emerald-700">{stats.statusCounts[key] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          </ChartCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <SummaryPanel title="Rizikų suvestinė" icon={<ShieldAlert className="h-6 w-6 text-orange-600" />}>
            {stats.risks.map((risk) => (
              <button key={risk.key} type="button" onClick={() => setDetailMode(risk.key)} className="w-full rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-orange-50">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black">{risk.label}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">{risk.residents.length}</span>
                </div>
                <p className="mt-2 text-sm font-bold text-slate-500">{risk.residents.slice(0, 2).map(residentName).join(", ") || "Įrašų nėra"}</p>
              </button>
            ))}
          </SummaryPanel>

          <SummaryPanel title="Veiklų aktyvumas" icon={<Activity className="h-6 w-6 text-emerald-700" />}>
            <InfoLine label="Ataskaitos imtis" value={`${filteredResidents.length} gyvent.`} />
            <InfoLine label="Su priskirtu darbuotoju" value={`${filteredResidents.filter((r) => (assignments[r.id] || []).length > 0).length} gyvent.`} />
            <InfoLine label="Be kambario" value={`${stats.risks.find((r) => r.key === "missing_room")?.residents.length || 0} gyvent.`} />
            <InfoLine label="Rizikos žymos pastabose" value={`${stats.risks.filter((r) => !["unassigned", "missing_room", "hospital"].includes(r.key)).reduce((sum, r) => sum + r.residents.length, 0)} įraš.`} />
          </SummaryPanel>

          <SummaryPanel title="Perdavimai ir dokumentai" icon={<CalendarDays className="h-6 w-6 text-emerald-700" />}>
            <InfoLine label="Paskutiniai atnaujinti" value={`${filteredResidents.filter((r) => isRecent(r.updated_at)).length} per 7 d.`} />
            <InfoLine label="Be gimimo datos" value={`${filteredResidents.filter((r) => !r.birth_date).length} gyvent.`} />
            <InfoLine label="Archyvinės būsenos" value={`${filteredResidents.filter((r) => ["sutartis_nutraukta", "mire"].includes(normalizeStatus(r.current_status))).length} gyvent.`} />
            <InfoLine label="Ligoninėje / išvykę" value={`${filteredResidents.filter((r) => ["ligonineje", "laikinai_isvykes"].includes(normalizeStatus(r.current_status))).length} gyvent.`} />
          </SummaryPanel>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Home className="h-6 w-6 text-emerald-700" />
              <div>
                <h2 className="text-2xl font-black">{detailTitle(detailMode)}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">Paspauskite skaičių arba riziką, kad pakeistumėte šią detalizaciją.</p>
              </div>
            </div>
            <button type="button" onClick={() => void loadData()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atnaujinti
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200">
            {detailMode === "free_rooms" ? (
              <FreeRoomsTable rooms={stats.freeRooms} />
            ) : (
              <ResidentsTable residents={detailRows} roomById={roomById} assignments={assignments} />
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
      {children}
    </select>
  )
}

function KpiCard({ title, value, desc, onClick, tone = "default" }: { title: string; value: string; desc: string; onClick: () => void; tone?: "default" | "warning" }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-[26px] border p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone === "warning" ? "border-orange-100 bg-orange-50" : "border-slate-200 bg-white"}`}>
      <p className="text-sm font-black text-slate-500">{title}</p>
      <div className="mt-2 text-4xl font-black">{value}</div>
      <p className="mt-3 text-sm font-bold leading-6 text-slate-500">{desc}</p>
    </button>
  )
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex items-center gap-3">
        {icon}
        <h2 className="text-2xl font-black">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function SummaryPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex items-center gap-3">
        {icon}
        <h2 className="text-2xl font-black">{title}</h2>
      </div>
      <div className="mt-5 space-y-3">{children}</div>
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="font-black">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-500">{value}</p>
    </div>
  )
}

function ResidentsTable({ residents, roomById, assignments }: { residents: Resident[]; roomById: Map<string, Room>; assignments: Record<string, string[]> }) {
  if (residents.length === 0) {
    return <div className="bg-slate-50 p-8 text-center text-sm font-black text-slate-500">Įrašų pagal pasirinktą detalizaciją nėra.</div>
  }

  return (
    <table className="w-full min-w-[960px] border-collapse text-left">
      <thead className="bg-slate-50">
        <tr>
          {["Kodas", "Gyventojas", "Statusas", "Kambarys", "Priežiūros lygis", "Atsakingas", "Rizikos", "Atnaujinta"].map((head) => (
            <th key={head} className="px-5 py-4 text-sm font-black text-slate-500">{head}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {residents.map((resident) => {
          const risks = getResidentRisks(resident, assignments)
          return (
            <tr key={resident.id} className="border-t border-slate-100">
              <td className="px-5 py-4 text-sm font-bold text-slate-600">{resident.resident_code || "—"}</td>
              <td className="px-5 py-4 text-sm font-black text-slate-900">{residentName(resident)}</td>
              <td className="px-5 py-4 text-sm font-bold text-slate-600"><StatusBadge status={resident.current_status} /></td>
              <td className="px-5 py-4 text-sm font-bold text-slate-600">{roomName(resident.current_room_id, roomById)}</td>
              <td className="px-5 py-4 text-sm font-bold text-slate-600">{careLabel(resident.care_level)}</td>
              <td className="px-5 py-4 text-sm font-bold text-slate-600">{(assignments[resident.id] || []).length ? `${assignments[resident.id].length} prisk.` : "Trūksta"}</td>
              <td className="px-5 py-4 text-sm font-bold text-slate-600">{risks.map((risk) => risk.label).join(", ") || "—"}</td>
              <td className="px-5 py-4 text-sm font-bold text-slate-600">{formatDate(resident.updated_at || resident.created_at)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function FreeRoomsTable({ rooms }: { rooms: Room[] }) {
  if (rooms.length === 0) {
    return <div className="bg-slate-50 p-8 text-center text-sm font-black text-slate-500">Laisvų aktyvių kambarių pagal filtrus nėra.</div>
  }

  return (
    <table className="w-full border-collapse text-left">
      <thead className="bg-slate-50">
        <tr>
          <th className="px-5 py-4 text-sm font-black text-slate-500">Kambarys</th>
          <th className="px-5 py-4 text-sm font-black text-slate-500">Aukštas</th>
          <th className="px-5 py-4 text-sm font-black text-slate-500">Būsena</th>
        </tr>
      </thead>
      <tbody>
        {rooms.map((room) => (
          <tr key={room.id} className="border-t border-slate-100">
            <td className="px-5 py-4 text-sm font-black text-slate-900">{room.name || room.id}</td>
            <td className="px-5 py-4 text-sm font-bold text-slate-600">{getFloor(room.name) || "—"}</td>
            <td className="px-5 py-4 text-sm font-bold text-emerald-700">Laisvas</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const normalized = normalizeStatus(status)
  const color = normalized === "gyvena" ? "bg-emerald-50 text-emerald-700" : normalized === "ligonineje" || normalized === "laikinai_isvykes" ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-700"
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${color}`}>{statusLabel(status)}</span>
}

function getResidentRisks(resident: Resident, assignments: Record<string, string[]>) {
  const risks: Array<{ key: RiskKey; label: string }> = []
  ;(Object.keys(RISK_LABELS) as RiskKey[]).forEach((key) => {
    if (hasRisk(resident, key, assignments)) risks.push({ key, label: RISK_LABELS[key] })
  })
  return risks
}

function hasRisk(resident: Resident, key: RiskKey, assignments: Record<string, string[]>) {
  const notes = `${resident.internal_notes || ""}`.toLowerCase()
  if (key === "unassigned") return (assignments[resident.id] || []).length === 0
  if (key === "missing_room") return isActiveResident(resident) && !resident.current_room_id
  if (key === "hospital") return normalizeStatus(resident.current_status) === "ligonineje"
  if (key === "fall") return includesAny(notes, ["griuv", "kritim", "fall"])
  if (key === "nutrition") return includesAny(notes, ["mity", "svor", "maitin", "nutrition"])
  if (key === "behavior") return includesAny(notes, ["elges", "agres", "neram", "behavior"])
  if (key === "infection") return includesAny(notes, ["infek", "izoli", "covid", "virus"])
  return false
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle))
}

function isActiveResident(resident: Resident) {
  const status = normalizeStatus(resident.current_status)
  return resident.is_active !== false && (status === "gyvena" || status === "netrukus_atvyks")
}

function matchesPeriod(resident: Resident, period: Filters["period"]) {
  if (period === "all") return true
  const date = new Date(resident.updated_at || resident.created_at || "")
  if (Number.isNaN(date.getTime())) return true

  const now = new Date()
  if (period === "month") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  if (period === "year") return date.getFullYear() === now.getFullYear()
  if (period === "previous_month") {
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return date.getFullYear() === previous.getFullYear() && date.getMonth() === previous.getMonth()
  }
  return true
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce(
    (acc, item) => {
      const key = getKey(item)
      acc[key] = (acc[key] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )
}

function normalizeStatus(status: string | null) {
  return String(status || "").trim().toLowerCase()
}

function normalizeCareLevel(careLevel: string | null) {
  return String(careLevel || "").trim().toLowerCase()
}

function statusLabel(status: string | null) {
  return STATUS_LABELS[normalizeStatus(status)] || "—"
}

function careLabel(careLevel: string | null) {
  return CARE_LABELS[normalizeCareLevel(careLevel)] || "Nepasirinkta"
}

function residentName(resident: Resident) {
  const full = String(resident.full_name || "").trim()
  if (full) return full
  return [resident.first_name, resident.last_name].filter(Boolean).join(" ").trim() || resident.resident_code || resident.id
}

function roomName(roomId: string | null, roomById: Map<string, Room>) {
  if (!roomId) return "—"
  return roomById.get(roomId)?.name || roomId
}

function getFloor(roomNameValue: string | null | undefined) {
  const value = String(roomNameValue || "").trim()
  const match = value.match(/(\d+)\s*(a\.?|aukšt|aukstas)/i) || value.match(/^(\d)/)
  return match ? `${match[1]} aukštas` : ""
}

function detailTitle(mode: DetailMode) {
  if (mode === "all") return "Visi gyventojai"
  if (mode === "active") return "Aktyvūs gyventojai"
  if (mode === "occupancy") return "Užimti kambariai"
  if (mode === "free_rooms") return "Laisvos vietos"
  if (mode === "attention") return "Rizikos ir dėmesio reikalaujantys įrašai"
  return RISK_LABELS[mode]
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("lt-LT")
}

function isRecent(value: string | null) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return date >= sevenDaysAgo
}

function downloadCsv(rows: Array<Record<string, string>>, fileName: string) {
  const headers = Object.keys(rows[0] || { tuscia: "" })
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => `"${String(row[header] || "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function getReadableError(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error && "message" in error) return String((error as { message?: unknown }).message || "Nepavyko užkrauti ataskaitos.")
  return "Nepavyko užkrauti ataskaitos."
}
