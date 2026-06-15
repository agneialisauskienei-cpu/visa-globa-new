"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

const MODULE_LABELS: Record<string, string> = {
  employees: "Darbuotojų",
  tasks: "Užduočių",
  residents: "Gyventojų",
  activities: "Veiklų",
  medicine: "Medicinos",
  rooms: "Kambarių",
  inventory: "Sandėlių",
  handover: "Perdavimo žurnalų",
  reports: "Ataskaitų",
  audit: "Audito",
}

export default function ModuleUnavailablePage() {
  const searchParams = useSearchParams()
  const moduleKey = searchParams.get("module") || ""
  const label = MODULE_LABELS[moduleKey] || "Šis"

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-6 py-16">
      <section className="w-full rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-700">
          Modulis neįjungtas
        </p>
        <h1 className="mt-3 text-3xl font-black text-slate-900">
          {label} modulis nepriklauso jūsų paketui
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
          Kreipkitės į organizacijos administratorių arba „VisaGloba“ administraciją
          dėl paketo pakeitimo.
        </p>
        <Link
          href="/dashboard"
          className="mt-7 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white"
        >
          Grįžti į pagrindinį
        </Link>
      </section>
    </main>
  )
}
