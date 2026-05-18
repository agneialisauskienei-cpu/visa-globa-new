"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowDownToLine,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CircleAlert,
  FileSpreadsheet,
  PieChart,
  Search,
  TrendingUp,
} from "lucide-react"

type ActivityStatus = "Tvarkinga" | "Laukia" | "Rizika"

type ActivityRecord = {
  id: number
  date: string
  title: string
  department: string
  responsible: string
  status: ActivityStatus
  attendance: number
  expected: number
  comment: string
}

type Filters = {
  period: string
  department: string
  status: string
  responsible: string
  search: string
}

const initialFilters: Filters = {
  period: "this-month",
  department: "all",
  status: "all",
  responsible: "all",
  search: "",
}

const records: ActivityRecord[] = [
  {
    id: 1,
    date: "2026-05-14",
    title: "Muzikos terapija",
    department: "Socialinis darbas",
    responsible: "Rasa Petrauskienė",
    status: "Tvarkinga",
    attendance: 18,
    expected: 21,
    comment: "Aktyvus dalyvavimas, 3 gyventojai atsisakė.",
  },
  {
    id: 2,
    date: "2026-05-13",
    title: "Kineziterapijos grupė",
    department: "Slauga",
    responsible: "Jonas Kazlauskas",
    status: "Rizika",
    attendance: 6,
    expected: 14,
    comment: "Mažas dalyvavimas, reikia individualaus plano.",
  },
  {
    id: 3,
    date: "2026-05-12",
    title: "Rankdarbių užsiėmimas",
    department: "Užimtumas",
    responsible: "Administratorius",
    status: "Tvarkinga",
    attendance: 12,
    expected: 12,
    comment: "Visi suplanuoti gyventojai dalyvavo.",
  },
  {
    id: 4,
    date: "2026-05-10",
    title: "Pasivaikščiojimas kieme",
    department: "Socialinis darbas",
    responsible: "Rasa Petrauskienė",
    status: "Laukia",
    attendance: 9,
    expected: 16,
    comment: "Neužpildytas atsisakiusių gyventojų komentaras.",
  },
  {
    id: 5,
    date: "2026-04-29",
    title: "Biblioterapija",
    department: "Užimtumas",
    responsible: "Vadovas",
    status: "Tvarkinga",
    attendance: 10,
    expected: 13,
    comment: "Rekomenduota tęsti mažose grupėse.",
  },
]

const focusItems = [
  "Gyventojai nedalyvavo veiklose ilgiau nei 7 dienas",
  "Dažni atsisakymai dalyvauti",
  "Žemas socialinis aktyvumas",
  "Neužpildytas lankomumas",
  "Veiklos be atsakingo darbuotojo",
  "Individualiai pritaikytų veiklų poreikis",
]

function downloadCsv(rows: ActivityRecord[]) {
  const headers = ["data", "veikla", "skyrius", "atsakingas", "busena", "dalyvavo", "planuota", "komentaras"]
  const csvRows = rows.map((record) =>
    [
      record.date,
      record.title,
      record.department,
      record.responsible,
      record.status,
      String(record.attendance),
      String(record.expected),
      record.comment,
    ].map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
  )
  const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "veiklu-ataskaita.csv"
  link.click()
  URL.revokeObjectURL(url)
}

function statusBadge(status: ActivityStatus) {
  if (status === "Rizika") return "bg-red-50 text-red-700"
  if (status === "Laukia") return "bg-orange-50 text-orange-700"
  return "bg-emerald-50 text-emerald-700"
}

export default function ReportPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [selectedKpi, setSelectedKpi] = useState("Rizikos")

  const filteredRecords = useMemo(() => {
    const search = filters.search.trim().toLowerCase()

    return records.filter((record) => {
      const matchesDepartment = filters.department === "all" || record.department === filters.department
      const matchesStatus = filters.status === "all" || record.status === filters.status
      const matchesResponsible = filters.responsible === "all" || record.responsible === filters.responsible
      const matchesSearch = !search || [record.title, record.comment, record.responsible].some((value) => value.toLowerCase().includes(search))
      const matchesPeriod = filters.period !== "last-month" || record.date.startsWith("2026-04")

      return matchesDepartment && matchesStatus && matchesResponsible && matchesSearch && matchesPeriod
    })
  }, [filters])

  const activeCount = filteredRecords.length
  const waitingCount = filteredRecords.filter((record) => record.status === "Laukia").length
  const riskCount = filteredRecords.filter((record) => record.status === "Rizika").length
  const attendancePercent = filteredRecords.length
    ? Math.round((filteredRecords.reduce((sum, record) => sum + record.attendance, 0) / filteredRecords.reduce((sum, record) => sum + record.expected, 0)) * 100)
    : 0

  const kpis = [
    ["Aktyvūs įrašai", String(activeCount), "Pagrindinis kiekis per pasirinktą laikotarpį"],
    ["Laukiantys", String(waitingCount), "Reikia peržiūros arba patvirtinimo"],
    ["Rizikos", String(riskCount), "Automatiškai išskirti prioritetai"],
    ["Dalyvavimas", `${attendancePercent}%`, "Dalyvavusių ir planuotų gyventojų santykis"],
  ]

  const selectedDetails = selectedKpi === "Rizikos"
    ? filteredRecords.filter((record) => record.status === "Rizika")
    : selectedKpi === "Laukiantys"
      ? filteredRecords.filter((record) => record.status === "Laukia")
      : filteredRecords

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
              <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-950">Veiklų ataskaita</h1>
              <p className="mt-3 max-w-4xl text-lg font-bold text-slate-500">
                Veiklų planas, lankomumas, atsisakymai, nedalyvavimas ir socialinis aktyvumas.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => window.print()} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700">
                Spausdinti
              </button>
              <button type="button" onClick={() => downloadCsv(filteredRecords)} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700">
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
          <div className="grid gap-4 xl:grid-cols-6">
            <select value={filters.period} onChange={(event) => setFilters({ ...filters, period: event.target.value })} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
              <option value="this-month">Šis mėnuo</option>
              <option value="last-month">Praėjęs mėnuo</option>
              <option value="year">Šie metai</option>
            </select>
            <select value={filters.department} onChange={(event) => setFilters({ ...filters, department: event.target.value })} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
              <option value="all">Visi skyriai</option>
              <option value="Slauga">Slauga</option>
              <option value="Socialinis darbas">Socialinis darbas</option>
              <option value="Užimtumas">Užimtumas</option>
            </select>
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
              <option value="all">Visos būsenos</option>
              <option value="Tvarkinga">Tvarkinga</option>
              <option value="Laukia">Laukia</option>
              <option value="Rizika">Rizika</option>
            </select>
            <select value={filters.responsible} onChange={(event) => setFilters({ ...filters, responsible: event.target.value })} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
              <option value="all">Visi atsakingi</option>
              <option value="Rasa Petrauskienė">Rasa Petrauskienė</option>
              <option value="Jonas Kazlauskas">Jonas Kazlauskas</option>
              <option value="Administratorius">Administratorius</option>
              <option value="Vadovas">Vadovas</option>
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-black text-slate-700" placeholder="Paieška..." />
            </div>
            <button type="button" onClick={() => setFilters(initialFilters)} className="rounded-2xl bg-[#087a5b] px-5 text-sm font-black text-white">
              Išvalyti
            </button>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((row) => (
            <button key={row[0]} type="button" onClick={() => setSelectedKpi(row[0])} className={`rounded-[26px] border p-6 text-left shadow-sm transition ${selectedKpi === row[0] ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"}`}>
              <p className="text-sm font-black text-slate-500">{row[0]}</p>
              <div className="mt-2 text-4xl font-black text-slate-950">{row[1]}</div>
              <p className="mt-3 text-sm font-bold leading-6 text-slate-500">{row[2]}</p>
            </button>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[30px] border border-orange-100 bg-orange-50/70 p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <CircleAlert className="h-6 w-6 text-orange-600" />
              <h2 className="text-2xl font-black text-slate-950">Reikia dėmesio</h2>
            </div>
            <div className="mt-5 space-y-3">
              {focusItems.map((item) => (
                <div key={item} className="rounded-2xl bg-white/80 p-4 text-sm font-black text-orange-800">{item}</div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-black text-slate-950">{selectedKpi}: detalės</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {selectedDetails.length ? selectedDetails.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-black text-slate-950">{item.title}</p>
                  <p className="mt-2 text-sm font-bold text-slate-500">{item.date} · {item.responsible}</p>
                </div>
              )) : (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm font-black text-slate-500">Pagal pasirinktus filtrus įrašų nėra.</div>
              )}
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
              {filteredRecords.map((record) => (
                <div key={record.id} className="flex flex-1 flex-col items-center gap-3">
                  <div className="w-full rounded-t-2xl bg-emerald-600" style={{ height: `${Math.max(12, Math.round((record.attendance / record.expected) * 100))}%` }} />
                  <span className="text-xs font-black text-slate-400">{record.date.slice(5)}</span>
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
                  <div className="text-4xl font-black text-slate-950">{attendancePercent}%</div>
                  <div className="text-sm font-black text-slate-500">dalyvavo</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-black text-slate-950">Tvarkingi įrašai: {filteredRecords.filter((record) => record.status === "Tvarkinga").length}</p>
                  <p className="text-sm font-bold text-slate-500">Atitinka pasirinktus kriterijus.</p>
                </div>
                <div className="rounded-2xl bg-orange-50 p-4">
                  <p className="font-black text-orange-700">Reikia peržiūros: {waitingCount + riskCount}</p>
                  <p className="text-sm font-bold text-orange-700">Rizikos ir neužbaigti veiksmai.</p>
                </div>
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
                    <th className="px-5 py-4 text-sm font-black text-slate-500">Veikla</th>
                    <th className="px-5 py-4 text-sm font-black text-slate-500">Atsakingas</th>
                    <th className="px-5 py-4 text-sm font-black text-slate-500">Būsena</th>
                    <th className="px-5 py-4 text-sm font-black text-slate-500">Komentaras</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length ? filteredRecords.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-5 py-4 text-sm font-bold text-slate-600">{item.date}</td>
                      <td className="px-5 py-4 text-sm font-black text-slate-950">{item.title}</td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-600">{item.responsible}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${statusBadge(item.status)}`}>{item.status}</span></td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-500">{item.comment}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm font-bold text-slate-500">Pagal pasirinktus filtrus veiklų nerasta.</td>
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
              CSV ir PDF naudoja aktyvius filtrus. Kai bus prijungtas serverinis endpointas, čia verta saugoti, kas eksportavo ataskaitą, kada ir kokius filtrus taikė.
            </p>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-600">
              <CalendarDays className="mb-3 h-5 w-5 text-emerald-700" />
              Rodoma įrašų: <span className="font-black text-slate-950">{filteredRecords.length}</span><br />
              Dalyvavimas: <span className="font-black text-slate-950">{attendancePercent}%</span><br />
              Rizikos: <span className="font-black text-slate-950">{riskCount}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
