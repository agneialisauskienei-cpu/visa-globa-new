import {
  Activity,
  ArrowRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Home,
  Pill,
  ShieldCheck,
  Users,
  UserRoundCheck,
} from "lucide-react"

const reports = [
  {
    title: "Gyventojų ataskaita",
    href: "/reports/residents",
    description: "Užimtumas, būsenos, kambariai, slaugos apkrova, veiklos, perdavimai ir rizikos.",
    icon: Users,
    tag: "Gyventojai",
  },
  {
    title: "Darbuotojų ataskaita",
    href: "/reports/employees",
    description: "Pareigybės, mokymai, neatvykimai, darbo krūviai, prašymai ir trūkstami veiksmai.",
    icon: UserRoundCheck,
    tag: "Personalas",
  },
  {
    title: "Medicinos ataskaita",
    href: "/reports/medicine",
    description: "Vaistų paskyrimai, PRN, praleistos dozės, saugos įvykiai ir peržiūros.",
    icon: Pill,
    tag: "Medicina",
  },
  {
    title: "Veiklų ataskaita",
    href: "/reports/activities",
    description: "Veiklų planas, lankomumas, atsisakymai, nedalyvavimas ir socialinis aktyvumas.",
    icon: Activity,
    tag: "Veiklos",
  },
  {
    title: "Užduočių ataskaita",
    href: "/reports/tasks",
    description: "Vėluojančios, skubios, pasikartojančios ir atliktos užduotys pagal atsakingus.",
    icon: ClipboardCheck,
    tag: "Užduotys",
  },
  {
    title: "Kambarių ataskaita",
    href: "/reports/rooms",
    description: "Užimtumas, laisvos vietos, rezervacijos, pritaikymas ir kambarių tipai.",
    icon: Home,
    tag: "Kambariai",
  },
  {
    title: "Perdavimo žurnalų ataskaita",
    href: "/reports/handover",
    description: "Neperžiūrėti perdavimai, kritinės žymos, pamainų įrašai ir veiksmai.",
    icon: FileText,
    tag: "Perdavimai",
  },
  {
    title: "Audito ataskaita",
    href: "/reports/audit",
    description: "Kas, ką ir kada keitė sistemoje, jautrių duomenų peržiūros ir eksportų istorija.",
    icon: ShieldCheck,
    tag: "Auditas",
  },
]

export default function ReportsPage() {
  return (
    <div className="min-h-screen bg-[#f6f8f7] px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-[1480px] space-y-6">
        <section className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-emerald-50 text-emerald-700">
              <ClipboardList className="h-8 w-8" />
            </div>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-700">
                ĮSTAIGOS ATASKAITOS
              </p>

              <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-950">
                Ataskaitos
              </h1>

              <p className="mt-3 max-w-4xl text-lg font-bold text-slate-500">
                Pirmiausia atsidaryk norimą ataskaitos polapį, peržiūrėk diagramas,
                lenteles, rizikas ir tada eksportuok PDF, XLS arba CSV pagal pasirinktus filtrus.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          {reports.map((item) => {
            const Icon = item.icon

            return (
              <a
                key={item.href}
                href={item.href}
                className="group rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-emerald-50 text-emerald-700 shadow-sm">
                      <Icon className="h-7 w-7" />
                    </div>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      {item.tag}
                    </span>
                  </div>

                  <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:text-emerald-700" />
                </div>

                <h2 className="mt-6 text-3xl font-black text-slate-950">
                  {item.title}
                </h2>

                <p className="mt-3 text-base font-bold leading-7 text-slate-500">
                  {item.description}
                </p>

                <div className="mt-6 text-sm font-black text-emerald-700">
                  Peržiūrėti ataskaitą →
                </div>
              </a>
            )
          })}
        </section>
      </div>
    </div>
  )
}