import Link from "next/link"
  import {
    ArrowDownToLine,
    ArrowLeft,
    BarChart3,
    CircleAlert,
    FileSpreadsheet,
    PieChart,
    TrendingUp,
  } from "lucide-react"

  const focusItems = [
    "Kambariai su rezervacijomis",
"Viršyta kambario talpa",
"Laisvos vietos pagal slaugos poreikį",
"Reikia funkcinės lovos arba deguonies",
"Lyties priskyrimo neatitikimai",
"Pritaikymo WC / dušo poreikis"
  ]

  const rows = [
    ["Aktyvūs įrašai", "42", "Pagrindinis kiekis per pasirinktą laikotarpį"],
    ["Laukiantys", "7", "Reikia peržiūros arba patvirtinimo"],
    ["Rizikos", "3", "Automatiškai išskirti prioritetai"],
    ["Pokytis", "+12%", "Palyginimas su ankstesniu laikotarpiu"],
  ]

  export default function ReportPage() {
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
                <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-700">
                  ATASKAITOS POLAPIS
                </p>

                <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-950">
                  Kambarių ataskaita
                </h1>

                <p className="mt-3 max-w-4xl text-lg font-bold text-slate-500">
                  Kambarių užimtumas, laisvos vietos, rezervacijos, pritaikymas ir kambarių tipai.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700">
                  Spausdinti
                </button>
                <button type="button" className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700">
                  <FileSpreadsheet className="h-4 w-4" />
                  XLS
                </button>
                <button type="button" className="inline-flex items-center gap-2 rounded-2xl bg-[#087a5b] px-5 py-3 text-sm font-black text-white shadow-md">
                  <ArrowDownToLine className="h-4 w-4" />
                  PDF
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 xl:grid-cols-6">
              <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
                <option>Šis mėnuo</option>
                <option>Praėjęs mėnuo</option>
                <option>Šie metai</option>
                <option>Pasirinktas laikotarpis</option>
              </select>
              <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
                <option>Visi skyriai</option>
                <option>Slauga</option>
                <option>Socialinis darbas</option>
                <option>Ūkis</option>
              </select>
              <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
                <option>Visos būsenos</option>
                <option>Aktyvūs</option>
                <option>Laukia</option>
                <option>Rizika</option>
              </select>
              <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
                <option>Visi atsakingi</option>
                <option>Administratorius</option>
                <option>Vadovas</option>
                <option>Darbuotojas</option>
              </select>
              <input className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700" placeholder="Paieška..." />
              <button type="button" className="rounded-2xl bg-[#087a5b] px-5 text-sm font-black text-white">
                Taikyti
              </button>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {rows.map((row) => (
              <div key={row[0]} className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-black text-slate-500">{row[0]}</p>
                <div className="mt-2 text-4xl font-black text-slate-950">{row[1]}</div>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-500">{row[2]}</p>
              </div>
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
                  <div key={item} className="rounded-2xl bg-white/80 p-4 text-sm font-black text-orange-800">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Ataskaitos dalys</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {focusItems.map((item) => (
                  <div key={item} className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-black text-slate-950">{item}</p>
                    <p className="mt-2 text-sm font-bold text-slate-500">Rodoma pagal pasirinktus filtrus ir teises.</p>
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
                {[45, 70, 55, 90, 62, 78, 50].map((height, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-3">
                    <div className="w-full rounded-t-2xl bg-emerald-600" style={{ height: `${height}%` }} />
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
                    <div className="text-4xl font-black text-slate-950">72%</div>
                    <div className="text-sm font-black text-slate-500">atitinka</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-black text-slate-950">Tvarkingi įrašai</p>
                    <p className="text-sm font-bold text-slate-500">Atitinka pasirinktus kriterijus.</p>
                  </div>
                  <div className="rounded-2xl bg-orange-50 p-4">
                    <p className="font-black text-orange-700">Reikia peržiūros</p>
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
                      <th className="px-5 py-4 text-sm font-black text-slate-500">Įrašas</th>
                      <th className="px-5 py-4 text-sm font-black text-slate-500">Būsena</th>
                      <th className="px-5 py-4 text-sm font-black text-slate-500">Komentaras</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4].map((item) => (
                      <tr key={item} className="border-t border-slate-100">
                        <td className="px-5 py-4 text-sm font-bold text-slate-600">2026-05-14</td>
                        <td className="px-5 py-4 text-sm font-black text-slate-950">Ataskaitos įrašas {item}</td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Tvarkinga</span>
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-slate-500">Pavyzdinis komentaras</td>
                      </tr>
                    ))}
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
                PDF skirtas vadovybei ir spausdinimui, XLS detaliai analizei,
                CSV techniniam eksportui. Eksportas turi naudoti filtrus ir būti įrašomas į auditą.
              </p>
            </div>
          </section>
        </div>
      </div>
    )
  }