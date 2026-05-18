"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { ReportFilters } from "@/lib/reports/types"
import { filtersToQueryString, readReportFilters } from "@/lib/reports/filters"

export default function ReportFiltersBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialFilters = useMemo(
    () => readReportFilters(searchParams),
    [searchParams]
  )

  const [filters, setFilters] = useState<ReportFilters>(initialFilters)

  function updateFilter(key: keyof ReportFilters, value: string | boolean) {
    setFilters((current) => ({
      ...current,
      [key]: value === "" ? undefined : value,
    }))
  }

  function applyFilters() {
    const query = filtersToQueryString(filters)
    router.push(query ? `?${query}` : "?")
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 xl:grid-cols-7">
        <input
          type="date"
          value={filters.dateFrom ?? ""}
          onChange={(event) => updateFilter("dateFrom", event.target.value)}
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
        />

        <input
          type="date"
          value={filters.dateTo ?? ""}
          onChange={(event) => updateFilter("dateTo", event.target.value)}
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
        />

        <input
          value={filters.department ?? ""}
          onChange={(event) => updateFilter("department", event.target.value)}
          placeholder="Skyrius"
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
        />

        <input
          value={filters.status ?? ""}
          onChange={(event) => updateFilter("status", event.target.value)}
          placeholder="Statusas"
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
        />

        <input
          value={filters.search ?? ""}
          onChange={(event) => updateFilter("search", event.target.value)}
          placeholder="Paieška"
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
        />

        <label className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(filters.includeInactive)}
            onChange={(event) => updateFilter("includeInactive", event.target.checked)}
          />
          Neaktyvūs
        </label>

        <button
          type="button"
          onClick={applyFilters}
          className="rounded-2xl bg-[#087a5b] px-5 text-sm font-black text-white"
        >
          Taikyti
        </button>
      </div>
    </section>
  )
}