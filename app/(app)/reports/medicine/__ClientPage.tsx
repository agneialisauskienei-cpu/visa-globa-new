"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import {
  ArrowDownToLine,
  ArrowLeft,
  BarChart3,
  CircleAlert,
  FileSpreadsheet,
  PieChart,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react"

type ReportFilters = {
  period: string
  dateFrom: string
  dateTo: string
  department: string
  status: string
  responsible: string
  search: string
}

type KpiRow = {
  label: string
  value: string | number
  description?: string
}

type ReportRecord = {
  id: string
  date: string
  title: string
  status: string
  comment?: string
  residentName?: string
  responsibleName?: string
  riskLevel?: string
}

type DistributionRow = {
  label: string
  value: number
  tone?: "green" | "orange" | "red" | "slate"
}

type MedicineReportResponse = {
  generatedAt?: string
  kpis?: KpiRow[]
  focusItems?: string[]
  sections?: string[]
  dynamics?: number[]
  distribution?: DistributionRow[]
  records?: ReportRecord[]
  canExport?: boolean
}

const defaultFilters: ReportFilters = {
  period: "this_month",
  dateFrom: "",
  dateTo: "",
  department: "all",
  status: "all",
  responsible: "all",
  search: "",
}

const periodOptions = [
  { value: "this_month", label: "Šis mėnuo" },
  { value: "last_month", label: "Praėjęs mėnuo" },
  { value: "this_year", label: "Šie metai" },
  { value: "custom", label: "Pasirinktas laikotarpis" },
]

const statusOptions = [
  { value: "all", label: "Visos būsenos" },
  { value: "completed", label: "Tvarkinga" },
  { value: "pending", label: "Laukia peržiūros" },
  { value: "risk", label: "Rizika" },
  { value: "missed", label: "Praleista" },
]

const departmentOptions = [
  { value: "all", label: "Visi skyriai" },
  { value: "slauga", label: "Slauga" },
  { value: "socialinis", label: "Socialinis darbas" },
  { value: "administracija", label: "Administracija" },
]

const responsibleOptions = [
  { value: "all", label: "Visi atsakingi" },
  { value: "me", label: "Mano įrašai" },
  { value: "nurse", label: "Slauga" },
  { value: "admin", label: "Administratorius" },
]

function readFilters(params: URLSearchParams): ReportFilters {
  return {
    period: params.get("period") || defaultFilters.period,
    dateFrom: params.get("dateFrom") || defaultFilters.dateFrom,
    dateTo: params.get("dateTo") || defaultFilters.dateTo,
    department: params.get("department") || defaultFilters.department,
    status: params.get("status") || defaultFilters.status,
    responsible: params.get("responsible") || defaultFilters.responsible,
    search: params.get("search") || defaultFilters.search,
  }
}

function filtersToQuery(filters: ReportFilters) {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return
    if (defaultFilters[key as keyof ReportFilters] === value) return
    params.set(key, value)
  })

  return params
}

function apiQuery(filters: ReportFilters) {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return
    if (value === "all") return
    params.set(key, value)
  })

  return params.toString()
}

function statusBadge(status: string) {
  const normalized = status.toLowerCase()

  if (["risk", "missed", "overdue", "rizika", "praleista"].includes(normalized)) {
    return "bg-red-50 text-red-700"
  }

  if (["pending", "review", "laukiama", "laukia"].includes(normalized)) {
    return "bg-orange-50 text-orange-700"
  }

  return "bg-emerald-50 text-emerald-700"
}

function SkeletonCards() {
  return (
    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100" />
          <div className="mt-4 h-10 w-20 animate-pulse rounded-2xl bg-slate-100" />
          <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
    </section>
  )
}

function downloadCsv(rows: Array<Record<string, string>>, fileName: string) {
  const headers = Object.keys(rows[0] || { tuscia: "" })
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => `"${String(row[header] || "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n")
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export default function ReportPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filters = useMemo(() => readFilters(searchParams), [searchParams])
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(filters)
  const [data, setData] = useState<MedicineReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadReport = useCallback(async () => {
    const query = apiQuery(filters)
    setLoading(true)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const organizationId = await getCurrentOrganizationId()

      if (!token || !organizationId) {
        setData(null)
        setError("Prisijunkite, kad matytumėte medicinos ataskaitą.")
        return
      }

      const response = await fetch(`/api/reports/medicine${query ? `?${query}` : ""}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-organization-id": organizationId,
        },
        cache: "no-store",
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || "Nepavyko įkelti medicinos ataskaitos.")
      }

      const json = (await response.json()) as MedicineReportResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko įkelti medicinos ataskaitos.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadReport()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadReport])

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadReport()
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [loadReport])

  const applyFilters = () => {
    const query = filtersToQuery(draftFilters)
    router.replace(query.toString() ? `${pathname}?${query.toString()}` : pathname)
  }

  const resetFilters = () => {
    setDraftFilters(defaultFilters)
    router.replace(pathname)
  }

  const kpis = data?.kpis || []
  const focusItems = data?.focusItems || []
  const sections = data?.sections || []
  const dynamics = data?.dynamics || []
  const distribution = data?.distribution || []
  const records = data?.records || []
  const totalDistribution = distribution.reduce((sum, row) => sum + Number(row.value || 0), 0)
  const goodValue = distribution.find((row) => row.tone === "green")?.value || 0
  const goodPercent = totalDistribution > 0 ? Math.round((Number(goodValue) / totalDistribution) * 100) : 0

  function exportCsv() {
    const rows = records.map((record) => ({
      data: record.date || "",
      irasas: record.title || "",
      gyventojas: record.residentName || "",
      atsakingas: record.responsibleName || "",
      busena: record.status || "",
      rizika: record.riskLevel || "",
      komentaras: record.comment || "",
    }))
    const fallbackRows = kpis.map((kpi) => ({
      data: data?.generatedAt || "",
      irasas: kpi.label,
      gyventojas: "",
      atsakingas: "",
      busena: String(kpi.value),
      rizika: "",
      komentaras: kpi.description || "",
    }))
    downloadCsv(rows.length ? rows : fallbackRows, "medicinos-ataskaita.csv")
  }

  return (
    <div className="min-h-screen bg-[#f6f8f7] px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-[1480px] space-y-6">
        <Link href="/reports" className="inline-flex items-center gap-2 text-sm font-black text-emerald-700">
          <ArrowLeft className="h-4 w-4" />
          Grįžti į ataskaitas
        </Link>

        <section className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-700">ATASKAITOS POLAPIS</p>
              <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-950">Medicinos ataskaita</h1>
              <p className="mt-3 max-w-4xl text-lg font-bold text-slate-500">
                BDAR saugi vaistų, PRN, praleistų dozių, saugos įvykių ir peržiūrų suvestinė pagal realius įstaigos duomenis.
              </p>
              {data?.generatedAt ? (
                <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Atnaujinta: {new Date(data.generatedAt).toLocaleString("lt-LT")}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={loadReport}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700"
              >
                <RefreshCw className="h-4 w-4" />
                Atnaujinti
              </button>
              <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700">
                <FileSpreadsheet className="h-4 w-4" />
                CSV
              </button>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl bg-[#087a5b] px-5 py-3 text-sm font-black text-white shadow-md">
                <ArrowDownToLine className="h-4 w-4" />
                PDF
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-7">
            <select value={draftFilters.period} onChange={(event) => setDraftFilters((old) => ({ ...old, period: event.target.value }))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
              {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input type="date" value={draftFilters.dateFrom} onChange={(event) => setDraftFilters((old) => ({ ...old, dateFrom: event.target.value, period: "custom" }))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700" />
            <input type="date" value={draftFilters.dateTo} onChange={(event) => setDraftFilters((old) => ({ ...old, dateTo: event.target.value, period: "custom" }))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700" />
            <select value={draftFilters.department} onChange={(event) => setDraftFilters((old) => ({ ...old, department: event.target.value }))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
              {departmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={draftFilters.status} onChange={(event) => setDraftFilters((old) => ({ ...old, status: event.target.value }))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={draftFilters.responsible} onChange={(event) => setDraftFilters((old) => ({ ...old, responsible: event.target.value }))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
              {responsibleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <div className="flex gap-3">
              <button type="button" onClick={applyFilters} className="flex-1 rounded-2xl bg-[#087a5b] px-5 text-sm font-black text-white">Taikyti</button>
              <button type="button" onClick={resetFilters} className="rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600">Valyti</button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={draftFilters.search}
              onChange={(event) => setDraftFilters((old) => ({ ...old, search: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters()
              }}
              className="h-12 flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="Paieška pagal gyventoją, vaistą, įvykį, atsakingą darbuotoją..."
            />
          </div>
        </section>

        {error ? (
          <section className="rounded-[24px] border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700">
            {error}
          </section>
        ) : null}

        {loading ? <SkeletonCards /> : (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {kpis.length ? kpis.map((row) => (
              <div key={row.label} className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-black text-slate-500">{row.label}</p>
                <div className="mt-2 text-4xl font-black text-slate-950">{row.value}</div>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-500">{row.description || "Skaičiuojama pagal pasirinktus filtrus."}</p>
              </div>
            )) : (
              <div className="rounded-[26px] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500 shadow-sm xl:col-span-4">
                Pagal pasirinktus filtrus KPI duomenų nerasta.
              </div>
            )}
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[30px] border border-orange-100 bg-orange-50/70 p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <CircleAlert className="h-6 w-6 text-orange-600" />
              <h2 className="text-2xl font-black text-slate-950">Reikia dėmesio</h2>
            </div>
            <div className="mt-5 space-y-3">
              {focusItems.length ? focusItems.map((item) => (
                <div key={item} className="rounded-2xl bg-white/80 p-4 text-sm font-black text-orange-800">{item}</div>
              )) : <p className="text-sm font-bold text-orange-800">Šiuo metu kritinių medicinos rizikų pagal filtrus nėra.</p>}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-black text-slate-950">Ataskaitos dalys</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {(sections.length ? sections : ["Praleistos dozės", "PRN peržiūros", "Saugos įvykiai", "Vaistų likučiai"]).map((item) => (
                <div key={item} className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-black text-slate-950">{item}</p>
                  <p className="mt-2 text-sm font-bold text-slate-500">Rodoma pagal pasirinktus filtrus, organizaciją ir darbuotojo teises.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-emerald-700" />
              <h2 className="text-2xl font-black text-slate-950">Dinamika per laikotarpį</h2>
            </div>
            <div className="mt-6 flex h-[300px] items-end gap-4 rounded-[24px] bg-slate-50 p-6">
              {(dynamics.length ? dynamics : [0]).map((height, index) => (
                <div key={`${height}-${index}`} className="flex flex-1 flex-col items-center gap-3">
                  <div className="w-full rounded-t-2xl bg-emerald-600" style={{ height: `${Math.max(4, Math.min(100, height))}%` }} />
                  <span className="text-xs font-black text-slate-400">{index + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <PieChart className="h-6 w-6 text-emerald-700" />
              <h2 className="text-2xl font-black text-slate-950">Paskirstymas pagal statusą</h2>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-[220px_1fr]">
              <div className="flex h-[220px] w-[220px] items-center justify-center rounded-full border-[34px] border-emerald-600 bg-emerald-50">
                <div className="text-center">
                  <div className="text-4xl font-black text-slate-950">{goodPercent}%</div>
                  <div className="text-sm font-black text-slate-500">tvarkinga</div>
                </div>
              </div>
              <div className="space-y-3">
                {distribution.length ? distribution.map((row) => (
                  <div key={row.label} className={row.tone === "orange" ? "rounded-2xl bg-orange-50 p-4" : row.tone === "red" ? "rounded-2xl bg-red-50 p-4" : "rounded-2xl bg-slate-50 p-4"}>
                    <p className="font-black text-slate-950">{row.label}: {row.value}</p>
                    <p className="text-sm font-bold text-slate-500">Pagal aktyvius filtrus.</p>
                  </div>
                )) : <p className="text-sm font-bold text-slate-500">Paskirstymo duomenų nėra.</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-black text-slate-950">Detalūs įrašai</h2>
            <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200">
              <table className="w-full border-collapse text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-sm font-black text-slate-500">Data</th>
                    <th className="px-5 py-4 text-sm font-black text-slate-500">Įrašas</th>
                    <th className="px-5 py-4 text-sm font-black text-slate-500">Gyventojas</th>
                    <th className="px-5 py-4 text-sm font-black text-slate-500">Būsena</th>
                    <th className="px-5 py-4 text-sm font-black text-slate-500">Komentaras</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length ? records.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-5 py-4 text-sm font-bold text-slate-600">{item.date}</td>
                      <td className="px-5 py-4 text-sm font-black text-slate-950">{item.title}</td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-600">{item.residentName || "—"}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusBadge(item.status)}`}>{item.status}</span>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-500">{item.comment || "—"}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm font-bold text-slate-500">
                        Pagal pasirinktus filtrus duomenų nerasta.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-emerald-700" />
              <h2 className="text-2xl font-black text-slate-950">Eksportas ir auditas</h2>
            </div>
            <p className="mt-4 text-sm font-bold leading-6 text-slate-500">
              Ataskaita naudoja tuos pačius aktyvius filtrus peržiūrai, CSV eksportui ir PDF spausdinimo peržiūrai. Auditui verta saugoti:
              kas peržiūrėjo arba eksportavo ataskaitą, kada ir su kokiais filtrais.
            </p>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-600">
              Duomenys kraunami iš: <span className="font-black text-slate-950">/api/reports/medicine</span><br />
              Eksportas: CSV generuojamas šiame puslapyje, PDF atidaromas per spausdinimo peržiūrą.<br />
              Realtime: galima jungti per Supabase channel pagal medication_logs, medication_safety_events ir PRN lenteles.
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
