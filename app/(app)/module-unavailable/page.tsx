"use client"

import Link from "next/link"
import { Check, Info } from "lucide-react"
import { useSearchParams } from "next/navigation"

const MODULE_LABELS: Record<string, string> = {
  employees: "Darbuotojų",
  tasks: "Užduočių",
  residents: "Gyventojų",
  activities: "Veiklų",
  medicine: "Medicinos",
  rooms: "Kambarių",
  inventory: "Sandėlio",
  handover: "Perdavimo žurnalų",
  reports: "Ataskaitų",
  audit: "Audito",
}

const PACKAGES = [
  {
    name: "Startas",
    code: "starter",
    price: "nuo 49 €/mėn.",
    description: "Pagrindiniai kasdieniai darbai mažai komandai.",
    modules: ["Darbuotojai", "Užduotys", "Gyventojai", "Kambariai"],
  },
  {
    name: "Bazinis",
    code: "basic",
    price: "nuo 79 €/mėn.",
    description: "Įstaigos kasdienos valdymas su veiklomis ir perdavimu.",
    modules: ["Startas", "Veiklos", "Perdavimo žurnalai"],
  },
  {
    name: "Pro",
    code: "pro",
    price: "nuo 129 €/mėn.",
    description: "Pilnesnis darbas komandai, medikamentams ir ataskaitoms.",
    modules: ["Bazinis", "Medicina", "Sandėlis", "Ataskaitos"],
  },
  {
    name: "Enterprise",
    code: "enterprise",
    price: "individualiai",
    description: "Visi moduliai, auditai ir platesnis administravimas.",
    modules: ["Pro", "Auditas", "Visi moduliai", "Prioritetinis palaikymas"],
  },
]

export default function ModuleUnavailablePage() {
  const searchParams = useSearchParams()
  const moduleKey = searchParams.get("module") || ""
  const label = MODULE_LABELS[moduleKey] || "Šis"

  return (
    <main className="vg-app-shell mx-auto max-w-7xl px-5 py-8 text-[#10251f]">
      <section className="overflow-hidden rounded-2xl border border-[#c9d8d0] bg-white shadow-sm">
        <div className="bg-[#486b5d] px-6 py-6 text-white">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
            Modulis neįjungtas
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl font-semibold leading-tight md:text-4xl">
                {label} modulis nepriklauso jūsų paketui
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-white/82">
                Kreipkitės į organizacijos administratorių arba „VisaGloba“
                administraciją dėl paketo pakeitimo. Žemiau matote, kokie
                paketai galimi ir ką jie atrakina.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-white px-5 text-sm font-black text-[#486b5d] shadow-sm transition hover:bg-[#f7fcf9]"
            >
              Grįžti į pagrindinį
            </Link>
          </div>
        </div>

        <div className="border-b border-[#dbe6e0] bg-white px-6 py-4">
          <div className="flex items-start gap-3 rounded-xl border border-[#486b5d] bg-white px-4 py-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#486b5d]" />
            <p className="text-sm font-bold leading-6 text-[#10251f]">
              Paketų kainos pateikiamos kaip orientacinės. Galutinė kaina gali
              priklausyti nuo įstaigos dydžio, naudotojų skaičiaus ir pasirinktų
              papildomų modulių.
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-6 lg:grid-cols-4">
          {PACKAGES.map((plan) => (
            <article
              key={plan.code}
              className="flex h-full flex-col rounded-xl border border-[#486b5d] bg-white p-5 shadow-[0_1px_3px_rgba(16,37,31,0.08)]"
            >
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7e75]">
                {plan.code}
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#10251f]">
                {plan.name}
              </h2>
              <p className="mt-1 text-lg font-black text-[#486b5d]">
                {plan.price}
              </p>
              <p className="mt-3 text-sm font-bold leading-6 text-[#10251f]">
                {plan.description}
              </p>

              <ul className="mt-5 grid gap-2 text-sm font-bold text-[#10251f]">
                {plan.modules.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#486b5d]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
