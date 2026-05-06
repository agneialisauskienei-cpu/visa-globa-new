"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type EmployeeOption = {
  id: string
  full_name?: string | null
  name?: string | null
  role?: string | null
}

type CredentialFormProps = {
  organizationId: string | null | undefined
  employees: EmployeeOption[]

  // Palaikau abu pavadinimus, kad tiktų tavo esamam page.tsx
  defaultEmployeeId?: string | null
  initialEmployeeId?: string | null
  defaultType?: string | null
  initialType?: string | null

  onSaved?: () => void | Promise<void>
  onCancel?: () => void
}

const CREDENTIAL_TYPES = [
  "Sveikatos pažyma",
  "Profesinė licencija",
  "Pirmos pagalbos pažymėjimas",
  "Higienos pažymėjimas",
  "Kita",
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeCredentialType(value?: string | null) {
  const raw = String(value || "").trim()
  if (!raw) return CREDENTIAL_TYPES[0]

  const lower = raw.toLowerCase()
  if (lower.includes("sveikat")) return "Sveikatos pažyma"
  if (lower.includes("licenc")) return "Profesinė licencija"
  if (lower.includes("pirmos") || lower.includes("pagalb")) return "Pirmos pagalbos pažymėjimas"
  if (lower.includes("higien")) return "Higienos pažymėjimas"

  return raw
}

export default function CredentialForm({
  organizationId,
  employees,
  defaultEmployeeId,
  initialEmployeeId,
  defaultType,
  initialType,
  onSaved,
  onCancel,
}: CredentialFormProps) {
  const resolvedInitialEmployeeId = initialEmployeeId || defaultEmployeeId || ""
  const resolvedInitialType = normalizeCredentialType(initialType || defaultType)

  const [employeeId, setEmployeeId] = useState(resolvedInitialEmployeeId)
  const [type, setType] = useState(resolvedInitialType)
  const [number, setNumber] = useState("")
  const [issuer, setIssuer] = useState("")
  const [issuedAt, setIssuedAt] = useState(todayIso())
  const [expiresAt, setExpiresAt] = useState("")
  const [note, setNote] = useState("")
  const [confirmed, setConfirmed] = useState(false)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
    details?: string
  } | null>(null)

  useEffect(() => {
    setEmployeeId(resolvedInitialEmployeeId)
  }, [resolvedInitialEmployeeId])

  useEffect(() => {
    setType(resolvedInitialType)
  }, [resolvedInitialType])

  useEffect(() => {
    // Kai iš sąrašo paspaudžiamas kitas „Trūksta“ įrašas,
    // išvalome tik įvedimo laukus, bet paliekame darbuotoją ir tipą.
    setNumber("")
    setIssuer("")
    setIssuedAt(todayIso())
    setExpiresAt("")
    setNote("")
    setConfirmed(false)
    setMessage(null)
  }, [resolvedInitialEmployeeId, resolvedInitialType])

  const selectedEmployeeName = useMemo(() => {
    const employee = employees.find((item) => item.id === employeeId)
    return employee?.full_name || employee?.name || "Pasirinktas darbuotojas"
  }, [employeeId, employees])

  async function handleSave() {
    setMessage(null)

    if (!organizationId) {
      setMessage({
        type: "error",
        text: "Nepavyko išsaugoti: nenustatyta organizacija.",
        details: "Patikrink organizacijos narystę ir app-access.ts.",
      })
      return
    }

    if (!employeeId) {
      setMessage({
        type: "error",
        text: "Pasirink darbuotoją.",
      })
      return
    }

    if (!type.trim()) {
      setMessage({
        type: "error",
        text: "Pasirink pažymos / licencijos tipą.",
      })
      return
    }

    if (!confirmed) {
      setMessage({
        type: "error",
        text: "Pažymėk patvirtinimą, kad dokumentas buvo patikrintas.",
      })
      return
    }

    setSaving(true)

    try {
      const payload = {
        organization_id: organizationId,
        employee_id: employeeId,
        type: type.trim(),
        number: number.trim() || null,
        issuer: issuer.trim() || null,
        issued_at: issuedAt || null,
        expires_at: expiresAt || null,
        status: "active",
        note: note.trim() || null,
      }

      const { error } = await supabase.from("personnel_credentials").insert(payload)

      if (error) {
        console.error("personnel_credentials insert error:", error)
        setMessage({
          type: "error",
          text: "Nepavyko išsaugoti pažymos.",
          details: error.message,
        })
        return
      }

      setMessage({
        type: "success",
        text: `Pažyma patvirtinta ir išsaugota: ${selectedEmployeeName}.`,
      })

      setNumber("")
      setIssuer("")
      setIssuedAt(todayIso())
      setExpiresAt("")
      setNote("")
      setConfirmed(false)

      await onSaved?.()
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error)
      console.error("CredentialForm save failed:", error)
      setMessage({
        type: "error",
        text: "Klaida saugant pažymą.",
        details,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
          Dokumento suvedimas
        </p>
        <h3 className="mt-1 text-2xl font-black text-slate-950">
          Pridėti pažymą / licenciją
        </h3>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Failų kelti nereikia – saugomas tik dokumento faktas, numeris,
          galiojimas ir patvirtinimas sistemoje.
        </p>
      </div>

      <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
        Forma skirta iš karto suvesti ir patvirtinti trūkstamą dokumentą.
        Po išsaugojimo darbuotojo dokumentų įspėjimas grafike turi dingti po duomenų atnaujinimo.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-black text-slate-600">Darbuotojas</span>
          <select
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Pasirinkti darbuotoją</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name || employee.name || employee.id}
                {employee.role ? ` — ${employee.role}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-black text-slate-600">Dokumento tipas</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          >
            {Array.from(new Set([...CREDENTIAL_TYPES, type].filter(Boolean))).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-black text-slate-600">Numeris</span>
          <input
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="Dokumento nr. arba paskutiniai simboliai"
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-black text-slate-600">Išdavė / kur patikrinta</span>
          <input
            value={issuer}
            onChange={(event) => setIssuer(event.target.value)}
            placeholder="Įstaiga / institucija / registras"
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-black text-slate-600">Galioja nuo</span>
          <input
            type="date"
            value={issuedAt}
            onChange={(event) => setIssuedAt(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-black text-slate-600">Galioja iki</span>
          <input
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
      </div>

      <label className="mt-4 block space-y-2">
        <span className="text-sm font-black text-slate-600">Pastaba</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Neprivaloma pastaba. Nerašyti perteklinių asmens duomenų."
          rows={3}
          className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
        />
        <span className="text-sm font-black leading-6 text-slate-700">
          Patvirtinu, kad dokumentas buvo peržiūrėtas sistemos naudotojo ir
          įrašau tik būtinus duomenis: tipą, galiojimą, numerį / patikrinimo faktą ir pastabą.
        </span>
      </label>

      {message ? (
        <div
          className={[
            "mt-4 rounded-2xl border px-4 py-3 text-sm font-bold",
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800",
          ].join(" ")}
        >
          <div>{message.text}</div>
          {message.details ? (
            <div className="mt-1 break-words text-xs font-semibold opacity-80">
              {message.details}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 text-base font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Atšaukti
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-700 px-7 text-base font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saugoma..." : "+ Patvirtinti ir išsaugoti"}
        </button>
      </div>
    </section>
  )
}
