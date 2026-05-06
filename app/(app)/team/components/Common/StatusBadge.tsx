"use client"

export type StatusTone = "good" | "warn" | "bad" | "muted"

export function statusLabel(status?: string | null) {
  const value = String(status || "").toLowerCase()
  if (value === "valid" || value === "ok") return "Galioja"
  if (value === "expiring") return "Baigiasi"
  if (value === "expired") return "Pasibaigė"
  if (value === "missing") return "Trūksta"
  if (value === "submitted") return "Pateikta"
  if (value === "approved") return "Patvirtinta"
  if (value === "rejected") return "Atmesta"
  if (value === "cancelled") return "Atšaukta"
  if (value === "draft") return "Juodraštis"
  return status || "—"
}

export function statusTone(status?: string | null): StatusTone {
  const value = String(status || "").toLowerCase()
  if (["valid", "ok", "approved"].includes(value)) return "good"
  if (["expiring", "submitted", "draft"].includes(value)) return "warn"
  if (["expired", "rejected"].includes(value)) return "bad"
  return "muted"
}

export default function StatusBadge({ status }: { status?: string | null }) {
  const tone = statusTone(status)
  const cls =
    tone === "good"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "warn"
        ? "bg-amber-100 text-amber-700"
        : tone === "bad"
          ? "bg-red-100 text-red-700"
          : "bg-slate-100 text-slate-600"

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${cls}`}>{statusLabel(status)}</span>
}
