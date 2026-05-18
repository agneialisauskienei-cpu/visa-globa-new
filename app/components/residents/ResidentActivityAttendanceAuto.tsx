"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AttendanceStatus =
  | "attended"
  | "absent"
  | "refused"
  | "not_applicable"
  | "D"
  | "N"
  | "A"
  | "T"
  | string;

type AttendanceRow = {
  id: string;
  resident_id: string;
  session_id: string;
  status: AttendanceStatus | null;
  note: string | null;
  activity_title: string | null;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
};

type AttendanceSummary = {
  total: number;
  attended: number;
  absent: number;
  refused: number;
  notApplicable: number;
};

function pickParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value || null;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("lt-LT", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatTime(start: string | null, end: string | null) {
  if (!start && !end) return "";

  const safeStart = start ? start.slice(0, 5) : "";
  const safeEnd = end ? end.slice(0, 5) : "";

  return `${safeStart}${safeEnd ? `–${safeEnd}` : ""}`;
}

function statusLabel(status: AttendanceStatus | null) {
  if (status === "attended" || status === "D") return "Dalyvavo";
  if (status === "absent" || status === "N") return "Nedalyvavo";
  if (status === "refused" || status === "A") return "Atsisakė";
  if (status === "not_applicable" || status === "T") return "Netaikoma";

  return "Nepažymėta";
}

function statusClass(status: AttendanceStatus | null) {
  if (status === "attended" || status === "D") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "absent" || status === "N") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  if (status === "refused" || status === "A") {
    return "border-orange-200 bg-orange-50 text-orange-800";
  }

  if (status === "not_applicable" || status === "T") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  return "border-gray-200 bg-gray-50 text-gray-700";
}

function percent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function StatCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number | string;
  helper: string;
  tone: "green" | "slate" | "orange" | "blue" | "neutral";
}) {
  const toneClass = {
    green: "border-emerald-100 bg-emerald-50 text-emerald-900",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    orange: "border-orange-100 bg-orange-50 text-orange-900",
    blue: "border-blue-100 bg-blue-50 text-blue-900",
    neutral: "border-stone-200 bg-stone-50 text-stone-800",
  }[tone];

  return (
    <div className={`min-w-0 rounded-2xl border p-3 ${toneClass}`}>
      <div className="truncate text-[11px] font-black uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black leading-none">{value}</div>
      <div className="mt-1 truncate text-xs font-bold opacity-75">{helper}</div>
    </div>
  );
}

export default function ResidentActivityAttendanceAuto() {
  const params = useParams();

  const residentId =
    pickParamValue(params?.id as string | string[] | undefined) ||
    pickParamValue(params?.residentId as string | string[] | undefined) ||
    pickParamValue(params?.resident_id as string | string[] | undefined);

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAttendance() {
      if (!residentId) {
        setRows([]);
        setErrorMessage("Nerastas gyventojo ID URL adrese.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("resident_activity_attendance_view")
        .select(
          "id,resident_id,session_id,status,note,activity_title,session_date,start_time,end_time",
        )
        .eq("resident_id", residentId)
        .order("session_date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(50);

      if (cancelled) return;

      if (error) {
        setRows([]);
        setErrorMessage(`${error.message}${error.code ? ` · ${error.code}` : ""}`);
      } else {
        setRows((data || []) as AttendanceRow[]);
      }

      setLoading(false);
    }

    void loadAttendance();

    return () => {
      cancelled = true;
    };
  }, [residentId]);

  const summary = useMemo<AttendanceSummary>(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;

        if (row.status === "attended" || row.status === "D") acc.attended += 1;
        else if (row.status === "absent" || row.status === "N") acc.absent += 1;
        else if (row.status === "refused" || row.status === "A") acc.refused += 1;
        else if (row.status === "not_applicable" || row.status === "T") {
          acc.notApplicable += 1;
        }

        return acc;
      },
      {
        total: 0,
        attended: 0,
        absent: 0,
        refused: 0,
        notApplicable: 0,
      },
    );
  }, [rows]);

  const visibleRows = rows.slice(0, 8);

  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[17px] font-black tracking-tight text-slate-950">
            Veiklų lankomumas
          </h2>
          <p className="mt-1 text-sm font-bold text-slate-500">
            Paskutiniai veiklų modulio įrašai ir lankomumo statistika.
          </p>
        </div>

        <a
          href="/activities"
          className="inline-flex shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 hover:bg-emerald-100"
        >
          Iš veiklų modulio
        </a>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <StatCard label="Iš viso" value={summary.total} helper="įrašai" tone="neutral" />
        <StatCard
          label="Dalyvavo"
          value={summary.attended}
          helper={percent(summary.attended, summary.total)}
          tone="green"
        />
        <StatCard
          label="Nedalyvavo"
          value={summary.absent}
          helper={percent(summary.absent, summary.total)}
          tone="slate"
        />
        <StatCard
          label="Atsisakė"
          value={summary.refused}
          helper={percent(summary.refused, summary.total)}
          tone="orange"
        />
      </div>

      {summary.notApplicable > 0 ? (
        <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
          Netaikoma: {summary.notApplicable} įraš.
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-500">
          Kraunamas veiklų lankomumas...
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          Nepavyko užkrauti veiklų lankomumo: {errorMessage}
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-500">
          Veiklų lankomumo įrašų dar nėra.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Veikla</th>
                <th className="px-4 py-3">Statusas</th>
                <th className="px-4 py-3">Pastaba</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
              {visibleRows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDate(row.session_date)}
                    <div className="text-xs font-semibold text-slate-500">
                      {formatTime(row.start_time, row.end_time)}
                    </div>
                  </td>

                  <td className="min-w-[180px] px-4 py-3 font-black text-slate-900">
                    {row.activity_title || "Veikla"}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold ${statusClass(
                        row.status,
                      )}`}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </td>

                  <td className="min-w-[140px] px-4 py-3">{row.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > visibleRows.length ? (
        <div className="mt-3 text-xs font-bold text-slate-500">
          Rodoma {visibleRows.length} iš {rows.length} paskutinių įrašų.
        </div>
      ) : null}
    </section>
  );
}
