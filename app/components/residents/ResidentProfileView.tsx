"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

type AttendanceStatus =
  | "attended"
  | "absent"
  | "refused"
  | "not_applicable"
  | "D"
  | "N"
  | "A"
  | "T"
  | string

type AttendanceRow = {
  id: string
  resident_id: string
  session_id: string
  status: AttendanceStatus | null
  note: string | null
  activity_title: string | null
  session_date: string | null
  start_time: string | null
  end_time: string | null
}

type Props = {
  residentId?: string | null
}

function pickParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value || null
}

function formatDate(value: string | null) {
  if (!value) return "—"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("lt-LT", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date)
}

function formatTime(start: string | null, end: string | null) {
  if (!start && !end) return ""
  return `${start?.slice(0, 5) || ""}${end ? `–${end.slice(0, 5)}` : ""}`
}

function statusLabel(status: AttendanceStatus | null) {
  if (status === "attended" || status === "D") return "Dalyvavo"
  if (status === "absent" || status === "N") return "Nedalyvavo"
  if (status === "refused" || status === "A") return "Atsisakė"
  if (status === "not_applicable" || status === "T") return "Netaikoma"
  return "Nepažymėta"
}

function statusClass(status: AttendanceStatus | null) {
  if (status === "attended" || status === "D") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800"
  }

  if (status === "absent" || status === "N") {
    return "border-slate-200 bg-slate-50 text-slate-700"
  }

  if (status === "refused" || status === "A") {
    return "border-orange-200 bg-orange-50 text-orange-800"
  }

  if (status === "not_applicable" || status === "T") {
    return "border-blue-200 bg-blue-50 text-blue-800"
  }

  return "border-gray-200 bg-gray-50 text-gray-700"
}

export default function ResidentActivityAttendanceAuto({ residentId }: Props) {
  const params = useParams()

  const resolvedResidentId =
    residentId ||
    pickParamValue(params?.id as string | string[] | undefined) ||
    pickParamValue(params?.residentId as string | string[] | undefined) ||
    pickParamValue(params?.resident_id as string | string[] | undefined)

  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage(null)

      if (!resolvedResidentId) {
        setRows([])
        setErrorMessage("Nerastas gyventojo ID URL adrese.")
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("resident_activity_attendance_view")
        .select(
          "id,resident_id,session_id,status,note,activity_title,session_date,start_time,end_time"
        )
        .eq("resident_id", resolvedResidentId)
        .order("session_date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(50)

      if (cancelled) return

      if (error) {
        setRows([])
        setErrorMessage(`${error.message}${error.code ? ` · ${error.code}` : ""}`)
      } else {
        setRows(data || [])
      }

      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [resolvedResidentId])

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.status === "attended" || row.status === "D") acc.attended += 1
        if (row.status === "absent" || row.status === "N") acc.absent += 1
        if (row.status === "refused" || row.status === "A") acc.refused += 1
        if (row.status === "not_applicable" || row.status === "T") acc.notApplicable += 1
        return acc
      },
      { attended: 0, absent: 0, refused: 0, notApplicable: 0 }
    )
  }, [rows])

  return (
    <section className="rounded-[24px] border border-[#dfe7df] bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-black text-[#17251f]">Veiklų lankomumas</h2>
          <p className="mt-1 text-sm font-semibold text-[#68776d]">
            Automatiškai susieta pagal gyventojo ID iš URL.
          </p>
        </div>

        <a
          href="/activities"
          className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 hover:bg-emerald-100"
        >
          Atidaryti veiklas
        </a>
      </div>

      <div className="mb-4 rounded-2xl border border-[#e4ebe5] bg-[#f8faf8] p-3 text-xs font-bold text-[#617268]">
        Naudojamas resident_id:{" "}
        <span className="break-all text-[#17251f]">
          {resolvedResidentId || "nerastas"}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
          <div className="text-xs font-black uppercase tracking-wide text-emerald-700">
            Dalyvavo
          </div>
          <div className="text-2xl font-black text-emerald-900">{summary.attended}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-black uppercase tracking-wide text-slate-600">
            Nedalyvavo
          </div>
          <div className="text-2xl font-black text-slate-800">{summary.absent}</div>
        </div>

        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3">
          <div className="text-xs font-black uppercase tracking-wide text-orange-700">
            Atsisakė
          </div>
          <div className="text-2xl font-black text-orange-900">{summary.refused}</div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
          <div className="text-xs font-black uppercase tracking-wide text-blue-700">
            Netaikoma
          </div>
          <div className="text-2xl font-black text-blue-900">{summary.notApplicable}</div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-[#dfe7df] bg-[#f8faf8] p-4 text-sm font-bold text-[#617268]">
          Kraunamas veiklų lankomumas...
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
          Nepavyko užkrauti veiklų lankomumo: {errorMessage}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#dfe7df] bg-[#f8faf8] p-4 text-sm font-bold text-[#617268]">
          Šiam gyventojui veiklų lankomumo įrašų nerasta.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e4ebe5]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f7faf7] text-xs uppercase tracking-wide text-[#617268]">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Veikla</th>
                <th className="px-4 py-3">Statusas</th>
                <th className="px-4 py-3">Pastaba</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[#edf2ee]">
                  <td className="px-4 py-3 font-bold text-[#263b31]">
                    {formatDate(row.session_date)}
                    <div className="text-xs font-semibold text-[#68776d]">
                      {formatTime(row.start_time, row.end_time)}
                    </div>
                  </td>

                  <td className="px-4 py-3 font-black text-[#17251f]">
                    {row.activity_title || "Veikla"}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                        row.status
                      )}`}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </td>

                  <td className="px-4 py-3 font-semibold text-[#617268]">
                    {row.note || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
