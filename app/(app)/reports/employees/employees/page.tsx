"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  Briefcase,
  CalendarClock,
  FileSpreadsheet,
  GraduationCap,
  Printer,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import ReportFiltersBar from "@/components/reports/ReportFiltersBar"

type EmployeeRow = {
  id: string
  user_id: string
  organization_id: string
  role: string | null
  staff_type: string | null
  position: string | null
  department: string | null
  is_active: boolean | null
  employment_start_date: string | null
  profile: any | null
  trainings: any[]
  schedules: any[]
  absences: any[]
  trainingStatus: string
  scheduleStatus: string
  absenceStatus: string
}

type Stat = {
  label: string
  value: number | string
  tone?: "default" | "success" | "warning" | "danger"
  filter?: Record<string, string>
}

type ReportData = {
  stats: Stat[]
  rows: EmployeeRow[]
  priorities: any[]
  trainingStats: Stat[]
  scheduleStats: Stat[]
}

const emptyReport: ReportData = {
  stats: [],
  rows: [],
  priorities: [],
  trainingStats: [],
  scheduleStats: [],
}

function employeeName(row: EmployeeRow) {
  return (
    row.profile?.full_name ||
    [row.profile?.first_name, row.profile?.last_name].filter(Boolean).join(" ") ||
    row.profile?.email ||
    "Nenurodytas darbuotojas"
  )
}

function daysUntil(dateValue: any) {
  if (!dateValue) return null
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  return Math.ceil((date.getTime() - Date.now()) / 86400000)
}

function expiry(row: any) {
  return row.valid_until || row.expires_at || row.expiry_date || row.certificate_valid_until || row.valid_to || null
}

function trainingStatus(items: any[]) {
  if (!items.length) return "Trūksta duomenų"
  if (
    items.some((x) =>
      ["pending", "submitted", "waiting", "laukiama", "laukia"].includes(
        String(x.status || "").toLowerCase()
      )
    )
  ) {
    return "Laukia patvirtinimo"
  }
  if (
    items.some((x) => {
      const d = daysUntil(expiry(x))
      return d !== null && d < 0
    })
  ) {
    return "Pasibaigę"
  }
  if (
    items.some((x) => {
      const d = daysUntil(expiry(x))
      return d !== null && d >= 0 && d <= 30
    })
  ) {
    return "Baigiasi"
  }
  return "Tvarkinga"
}

function scheduleHours(items: any[]) {
  return items.reduce((sum, x) => {
    if (typeof x.hours === "number") return sum + x.hours
    const start = x.start_time ? Number(String(x.start_time).slice(0, 2)) : NaN
    const end = x.end_time ? Number(String(x.end_time).slice(0, 2)) : NaN
    if (!Number.isNaN(start) && !Number.isNaN(end)) {
      return sum + (end >= start ? end - start : 24 - start + end)
    }
    return sum
  }, 0)
}

function scheduleStatus(items: any[]) {
  if (!items.length) return "Be grafiko"
  if (scheduleHours(items) > 48) return "Viršvalandžių rizika"
  return "Tvarkinga"
}

function absenceStatus(items: any[]) {
  if (!items.length) return "Nėra"
  if (
    items.some((x) =>
      ["pending", "waiting", "laukiama", "laukia"].includes(
        String(x.status || "").toLowerCase()
      )
    )
  ) {
    return "Laukia prašymas"
  }
  return "Neatvyksta"
}

function risk(row: EmployeeRow) {
  if (!row.position || !row.department) return "Aukšta"
  if (row.trainingStatus === "Pasibaigę" || row.scheduleStatus !== "Tvarkinga") return "Aukšta"
  if (row.trainingStatus === "Baigiasi" || row.trainingStatus === "Laukia patvirtinimo") return "Vidutinė"
  return "Žema"
}

function pillClass(value: string) {
  if (["Aukšta", "Pasibaigę", "Trūksta duomenų", "Viršvalandžių rizika"].includes(value)) {
    return "bg-red-50 text-red-700 border-red-200"
  }
  if (
    [
      "Vidutinė",
      "Baigiasi",
      "Laukia patvirtinimo",
      "Be grafiko",
      "Laukia prašymas",
      "Neatvyksta",
    ].includes(value)
  ) {
    return "bg-orange-50 text-orange-700 border-orange-200"
  }
  return "bg-emerald-50 text-emerald-700 border-emerald-200"
}

function cardToneClass(tone?: string) {
  if (tone === "danger") return "border-red-100 bg-red-50/70 text-red-800 hover:bg-red-50"
  if (tone === "warning") return "border-orange-100 bg-orange-50/70 text-orange-800 hover:bg-orange-50"
  if (tone === "success") return "border-emerald-100 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-50"
  return "border-slate-200 bg-white text-slate-950 hover:bg-slate-50"
}

async function safeQuery(table: string, organizationId: string, userIds: string[], memberIds: string[]) {
  const byOrg = await supabase.from(table).select("*").eq("organization_id", organizationId).limit(1000)
  if (!byOrg.error && byOrg.data) return byOrg.data

  if (userIds.length) {
    const byUser = await supabase.from(table).select("*").in("user_id", userIds).limit(1000)
    if (!byUser.error && byUser.data) return byUser.data
  }

  if (memberIds.length) {
    const byMember = await supabase.from(table).select("*").in("organization_member_id", memberIds).limit(1000)
    if (!byMember.error && byMember.data) return byMember.data
  }

  return []
}

function belongs(item: any, userId: string, memberId: string) {
  return (
    item.user_id === userId ||
    item.employee_id === userId ||
    item.employee_id === memberId ||
    item.organization_member_id === memberId
  )
}

function exportCsv(rows: EmployeeRow[]) {
  const headers = [
    "Vardas",
    "El. paštas",
    "Pareigybė",
    "Rolė",
    "Skyrius",
    "Tipas",
    "Statusas",
    "Mokymai",
    "Grafikas",
    "Neatvykimai",
    "Rizika",
  ]
  const body = rows.map((r) => [
    employeeName(r),
    r.profile?.email || "",
    r.position || "",
    r.role || "",
    r.department || "",
    r.staff_type || "",
    r.is_active ? "Aktyvus" : "Neaktyvus",
    r.trainingStatus,
    r.scheduleStatus,
    r.absenceStatus,
    risk(r),
  ])
  const csv = [headers, ...body]
    .map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
    .join("\n")
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "darbuotoju-ataskaita.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export default function EmployeesReportPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [report, setReport] = useState<ReportData>(emptyReport)
  const [selected, setSelected] = useState<EmployeeRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  function applyFilter(filter: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(filter).forEach(([key, value]) => {
      if (value === "__clear__") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    router.push(`?${params.toString()}`)
  }

  function clearFilters() {
    router.push("?")
  }

  async function load() {
    setLoading(true)
    setError("")

    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user

    if (!user) {
      setError("Neprisijungęs naudotojas.")
      setLoading(false)
      return
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()

    if (membershipError || !membership?.organization_id) {
      setError(membershipError?.message || "Nerasta aktyvi organizacija prisijungusiam naudotojui.")
      setLoading(false)
      return
    }

    let query = supabase
      .from("organization_members")
      .select("id,user_id,organization_id,role,staff_type,position,department,is_active,employment_start_date")
      .eq("organization_id", membership.organization_id)

    if (searchParams.get("includeInactive") !== "true") query = query.eq("is_active", true)
    if (searchParams.get("department")) query = query.eq("department", searchParams.get("department"))
    if (searchParams.get("role")) query = query.eq("role", searchParams.get("role"))
    if (searchParams.get("position")) query = query.eq("position", searchParams.get("position"))
    if (searchParams.get("staffType")) query = query.eq("staff_type", searchParams.get("staffType"))
    if (searchParams.get("status") === "active") query = query.eq("is_active", true)
    if (searchParams.get("status") === "inactive") query = query.eq("is_active", false)

    const { data: members, error: membersError } = await query

    if (membersError) {
      setError(membersError.message)
      setLoading(false)
      return
    }

    const baseRows = members || []
    const userIds = baseRows.map((x: any) => x.user_id).filter(Boolean)
    const memberIds = baseRows.map((x: any) => x.id).filter(Boolean)

    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("id,email,first_name,last_name,full_name,phone")
          .in("id", userIds)
      : { data: [] }

    const [trainings, schedules, absences] = await Promise.all([
      safeQuery("employee_trainings", membership.organization_id, userIds, memberIds),
      safeQuery("employee_schedules", membership.organization_id, userIds, memberIds),
      safeQuery("employee_absences", membership.organization_id, userIds, memberIds),
    ])

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    let rows: EmployeeRow[] = baseRows.map((row: any) => {
      const employeeTrainings = trainings.filter((x: any) => belongs(x, row.user_id, row.id))
      const employeeSchedules = schedules.filter((x: any) => belongs(x, row.user_id, row.id))
      const employeeAbsences = absences.filter((x: any) => belongs(x, row.user_id, row.id))

      return {
        ...row,
        profile: profileMap.get(row.user_id) || null,
        trainings: employeeTrainings,
        schedules: employeeSchedules,
        absences: employeeAbsences,
        trainingStatus: trainingStatus(employeeTrainings),
        scheduleStatus: scheduleStatus(employeeSchedules),
        absenceStatus: absenceStatus(employeeAbsences),
      }
    })

    const search = searchParams.get("search")
    if (search) {
      const needle = search.toLowerCase()
      rows = rows.filter((row) =>
        [
          employeeName(row),
          row.profile?.email,
          row.position,
          row.department,
          row.role,
          row.staff_type,
          row.trainingStatus,
          row.scheduleStatus,
          row.absenceStatus,
          risk(row),
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle))
      )
    }

    const trainingFilter = searchParams.get("trainingStatus")
    const scheduleFilter = searchParams.get("scheduleStatus")
    const absenceFilter = searchParams.get("absenceStatus")
    const riskFilter = searchParams.get("risk")

    if (trainingFilter) rows = rows.filter((row) => row.trainingStatus === trainingFilter)
    if (scheduleFilter) rows = rows.filter((row) => row.scheduleStatus === scheduleFilter)
    if (absenceFilter) rows = rows.filter((row) => row.absenceStatus === absenceFilter)
    if (riskFilter) rows = rows.filter((row) => risk(row) === riskFilter)

    const active = rows.filter((x) => x.is_active).length
    const inactive = rows.filter((x) => !x.is_active).length
    const withoutPosition = rows.filter((x) => !x.position).length
    const withoutDepartment = rows.filter((x) => !x.department).length
    const missingTrainings = rows.filter((x) => x.trainingStatus === "Trūksta duomenų").length
    const expiredTrainings = rows.filter((x) => x.trainingStatus === "Pasibaigę").length
    const expiringTrainings = rows.filter((x) => x.trainingStatus === "Baigiasi").length
    const pendingTrainings = rows.filter((x) => x.trainingStatus === "Laukia patvirtinimo").length
    const withoutSchedule = rows.filter((x) => x.scheduleStatus === "Be grafiko").length
    const scheduleRisks = rows.filter((x) => x.scheduleStatus === "Viršvalandžių rizika").length
    const absencesNow = rows.filter((x) => x.absenceStatus !== "Nėra").length
    const highRisk = rows.filter((x) => risk(x) === "Aukšta").length

    setReport({
      stats: [
        { label: "Aktyvūs darbuotojai", value: active, tone: "success", filter: { status: "active" } },
        { label: "Neaktyvūs darbuotojai", value: inactive, filter: { includeInactive: "true", status: "inactive" } },
        { label: "Be pareigybės", value: withoutPosition, tone: withoutPosition ? "warning" : "success", filter: { position: "__empty__" } },
        { label: "Be skyriaus", value: withoutDepartment, tone: withoutDepartment ? "warning" : "success", filter: { department: "__empty__" } },
      ],
      trainingStats: [
        { label: "Trūksta mokymų duomenų", value: missingTrainings, tone: missingTrainings ? "warning" : "success", filter: { trainingStatus: "Trūksta duomenų" } },
        { label: "Pasibaigę mokymai", value: expiredTrainings, tone: expiredTrainings ? "danger" : "success", filter: { trainingStatus: "Pasibaigę" } },
        { label: "Baigiasi per 30 d.", value: expiringTrainings, tone: expiringTrainings ? "warning" : "success", filter: { trainingStatus: "Baigiasi" } },
        { label: "Laukia patvirtinimo", value: pendingTrainings, tone: pendingTrainings ? "warning" : "success", filter: { trainingStatus: "Laukia patvirtinimo" } },
      ],
      scheduleStats: [
        { label: "Be grafiko", value: withoutSchedule, tone: withoutSchedule ? "warning" : "success", filter: { scheduleStatus: "Be grafiko" } },
        { label: "Grafiko rizikos", value: scheduleRisks, tone: scheduleRisks ? "danger" : "success", filter: { scheduleStatus: "Viršvalandžių rizika" } },
        { label: "Neatvykimai", value: absencesNow, tone: absencesNow ? "warning" : "success", filter: { absenceStatus: "Neatvyksta" } },
      ],
      priorities: [
        ...(withoutDepartment ? [{ title: `${withoutDepartment} darbuotojai be skyriaus`, description: "Reikia priskirti skyrių.", filter: { department: "__empty__" } }] : []),
        ...(withoutPosition ? [{ title: `${withoutPosition} darbuotojai be pareigybės`, description: "Reikia priskirti pareigybę.", filter: { position: "__empty__" } }] : []),
        ...(expiredTrainings ? [{ title: `${expiredTrainings} darbuotojai turi pasibaigusių mokymų`, description: "Reikia administratoriaus peržiūros.", filter: { trainingStatus: "Pasibaigę" } }] : []),
        ...(withoutSchedule ? [{ title: `${withoutSchedule} darbuotojai be grafiko`, description: "Reikia priskirti pamainas.", filter: { scheduleStatus: "Be grafiko" } }] : []),
        ...(highRisk ? [{ title: `${highRisk} aukštos rizikos darbuotojai`, description: "Patikrink pareigybę, skyrių, mokymus ir grafiką.", filter: { risk: "Aukšta" } }] : []),
      ],
      rows,
    })

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const departmentStats = useMemo(() => {
    const map = new Map<string, number>()
    report.rows.forEach((row) => map.set(row.department || "Be skyriaus", (map.get(row.department || "Be skyriaus") || 0) + 1))
    return Array.from(map.entries())
  }, [report.rows])

  const positionStats = useMemo(() => {
    const map = new Map<string, number>()
    report.rows.forEach((row) => map.set(row.position || "Be pareigybės", (map.get(row.position || "Be pareigybės") || 0) + 1))
    return Array.from(map.entries()).slice(0, 8)
  }, [report.rows])

  const activeFilterCount = useMemo(() => {
    let count = 0
    searchParams.forEach((value, key) => {
      if (value && key) count += 1
    })
    return count
  }, [searchParams])

  return (
    <div className="min-h-screen bg-[#f6f8f7] px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-[1480px] space-y-6">
        <Link href="/reports" className="inline-flex items-center gap-2 text-sm font-black text-emerald-700">
          <ArrowLeft className="h-4 w-4" /> Grįžti į ataskaitas
        </Link>

        <section className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-emerald-50 text-emerald-700">
                <Users className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-700">REALŪS ĮSTAIGOS DUOMENYS</p>
                <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-950">Darbuotojų ataskaita</h1>
                <p className="mt-3 max-w-5xl text-lg font-bold leading-8 text-slate-500">
                  Visi KPI blokai, prioritetai, skyrių/pareigybių blokai ir būsenos veikia kaip filtrai.
                </p>
                {activeFilterCount ? (
                  <button type="button" onClick={clearFilters} className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700">
                    Išvalyti filtrus ({activeFilterCount})
                  </button>
                ) : null}
                {loading ? <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-500">Kraunami duomenys...</p> : null}
                {error ? <p className="mt-4 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">{error}</p> : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700"><RefreshCw className="h-4 w-4" />Atnaujinti</button>
              <button type="button" onClick={() => exportCsv(report.rows)} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700"><FileSpreadsheet className="h-4 w-4" />CSV / XLS</button>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700"><Printer className="h-4 w-4" />Spausdinti</button>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl bg-[#087a5b] px-5 py-3 text-sm font-black text-white shadow-md"><ArrowDownToLine className="h-4 w-4" />PDF</button>
            </div>
          </div>
        </section>

        <ReportFiltersBar />

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {report.stats.map((stat) => (
            <button key={stat.label} type="button" onClick={() => stat.filter && applyFilter(stat.filter)} className={`rounded-[26px] border p-6 text-left shadow-sm transition ${cardToneClass(stat.tone)}`}>
              <p className="text-sm font-black opacity-75">{stat.label}</p>
              <div className="mt-2 text-4xl font-black">{stat.value}</div>
              <p className="mt-3 text-xs font-black opacity-60">Spausk filtruoti</p>
            </button>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[30px] border border-orange-100 bg-orange-50/70 p-7 shadow-sm">
            <div className="flex items-center gap-3"><AlertTriangle className="h-6 w-6 text-orange-600" /><h2 className="text-2xl font-black text-slate-950">Reikia dėmesio</h2></div>
            <div className="mt-5 space-y-3">
              {report.priorities.length ? report.priorities.map((item) => (
                <button key={item.title} type="button" onClick={() => item.filter && applyFilter(item.filter)} className="w-full rounded-2xl bg-white/80 p-4 text-left transition hover:bg-white">
                  <p className="text-sm font-black text-orange-800">{item.title}</p>
                  <p className="mt-2 text-sm font-bold text-orange-700">{item.description}</p>
                  <p className="mt-2 text-xs font-black text-orange-500">Spausk filtruoti</p>
                </button>
              )) : <div className="rounded-2xl bg-white/80 p-4 text-sm font-black text-emerald-700">Kritinių prioritetų pagal filtrus nėra.</div>}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3"><Briefcase className="h-6 w-6 text-emerald-700" /><h2 className="text-2xl font-black text-slate-950">Darbuotojai pagal skyrius</h2></div>
            <div className="mt-5 space-y-3">
              {departmentStats.map(([department, count]) => (
                <button key={department} type="button" onClick={() => applyFilter(department === "Be skyriaus" ? { department: "__empty__" } : { department })} className="w-full rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-emerald-50">
                  <div className="flex items-center justify-between gap-4"><p className="font-black text-slate-950">{department}</p><p className="text-2xl font-black text-slate-950">{count}</p></div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, (count / Math.max(1, report.rows.length)) * 100)}%` }} /></div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3"><GraduationCap className="h-6 w-6 text-emerald-700" /><h2 className="text-2xl font-black text-slate-950">Mokymų būsena</h2></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {report.trainingStats.map((s) => (
                <button key={s.label} type="button" onClick={() => s.filter && applyFilter(s.filter)} className="rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-emerald-50">
                  <p className="text-sm font-black text-slate-500">{s.label}</p><p className="mt-2 text-3xl font-black text-slate-950">{s.value}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3"><CalendarClock className="h-6 w-6 text-emerald-700" /><h2 className="text-2xl font-black text-slate-950">Grafikų rizikos</h2></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {report.scheduleStats.map((s) => (
                <button key={s.label} type="button" onClick={() => s.filter && applyFilter(s.filter)} className="rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-emerald-50">
                  <p className="text-sm font-black text-slate-500">{s.label}</p><p className="mt-2 text-3xl font-black text-slate-950">{s.value}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-emerald-700" /><h2 className="text-2xl font-black text-slate-950">Teisės ir pareigybės</h2></div>
            <div className="mt-5 space-y-3">
              {positionStats.map(([pos, count]) => (
                <button key={pos} type="button" onClick={() => applyFilter(pos === "Be pareigybės" ? { position: "__empty__" } : { position: pos })} className="flex w-full items-center justify-between rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-emerald-50">
                  <p className="font-black text-slate-950">{pos}</p><p className="text-xl font-black text-slate-950">{count}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex items-center gap-3"><UserCheck className="h-6 w-6 text-emerald-700" /><h2 className="text-2xl font-black text-slate-950">Darbuotojų lentelė</h2></div>
          <div className="mt-5 overflow-x-auto rounded-[22px] border border-slate-200">
            <table className="w-full min-w-[1350px] border-collapse text-left">
              <thead className="bg-slate-50"><tr>{["Darbuotojas","Pareigybė","Rolė","Skyrius","Tipas","Statusas","Mokymai","Grafikas","Neatvykimai","Rizika","Veiksmai"].map((h) => <th key={h} className="px-5 py-4 text-sm font-black text-slate-500">{h}</th>)}</tr></thead>
              <tbody>
                {report.rows.length ? report.rows.map((row) => {
                  const r = risk(row)
                  return (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-sm font-black text-emerald-700">{employeeName(row).split(" ").map((p) => p[0]).join("").slice(0,2).toUpperCase()}</div><div><p className="font-black text-slate-950">{employeeName(row)}</p><p className="text-xs font-bold text-slate-500">{row.profile?.email || "El. paštas nenurodytas"}</p></div></div></td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-600">{row.position || "—"}</td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-600">{row.role || "—"}</td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-600">{row.department || "—"}</td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-600">{row.staff_type || "—"}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${row.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{row.is_active ? "Aktyvus" : "Neaktyvus"}</span></td>
                      <td className="px-5 py-4"><button type="button" onClick={() => applyFilter({ trainingStatus: row.trainingStatus })} className={`rounded-full border px-3 py-1 text-xs font-black ${pillClass(row.trainingStatus)}`}>{row.trainingStatus}</button></td>
                      <td className="px-5 py-4"><button type="button" onClick={() => applyFilter({ scheduleStatus: row.scheduleStatus })} className={`rounded-full border px-3 py-1 text-xs font-black ${pillClass(row.scheduleStatus)}`}>{row.scheduleStatus}</button></td>
                      <td className="px-5 py-4"><button type="button" onClick={() => applyFilter({ absenceStatus: row.absenceStatus })} className="text-sm font-bold text-slate-600">{row.absenceStatus}</button></td>
                      <td className="px-5 py-4"><button type="button" onClick={() => applyFilter({ risk: r })} className={`rounded-full border px-3 py-1 text-xs font-black ${pillClass(r)}`}>{r}</button></td>
                      <td className="px-5 py-4"><button type="button" onClick={() => setSelected(row)} className="text-sm font-black text-emerald-700">Peržiūrėti</button></td>
                    </tr>
                  )
                }) : <tr><td colSpan={11} className="px-5 py-10 text-center text-sm font-bold text-slate-500">Pagal pasirinktus filtrus duomenų nerasta.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[30px] bg-white p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-5">
              <div><p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">DARBUOTOJO INFORMACIJA</p><h2 className="mt-2 text-3xl font-black text-slate-950">{employeeName(selected)}</h2><p className="mt-2 text-sm font-bold text-slate-500">{selected.profile?.email || "El. paštas nenurodytas"}</p></div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-2xl bg-slate-100 p-3 text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[["Pareigybė", selected.position || "—"],["Skyrius", selected.department || "—"],["Rolė", selected.role || "—"],["Darbuotojo tipas", selected.staff_type || "—"],["Statusas", selected.is_active ? "Aktyvus" : "Neaktyvus"],["Darbo pradžia", selected.employment_start_date || "—"],["Telefonas", selected.profile?.phone || "—"],["Rizika", risk(selected)],["Mokymai", selected.trainingStatus],["Grafikas", selected.scheduleStatus],["Neatvykimai", selected.absenceStatus]].map(([label,value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-2 text-base font-black text-slate-950">{value}</p></div>)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
