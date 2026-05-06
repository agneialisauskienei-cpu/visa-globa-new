"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type EmployeeOption = {
  id: string
  full_name?: string | null
  name?: string | null
  role?: string | null
}

type CredentialRecord = {
  id: string
  organization_id?: string | null
  employee_id: string
  type: string | null
  number?: string | null
  issuer?: string | null
  issued_at?: string | null
  expires_at?: string | null
  status?: string | null
  note?: string | null
}

type MissingDocumentRecord = {
  employee_id: string
  employee_name?: string | null
  type: string
}

type DocumentsModuleProps = {
  organizationId: string | null | undefined
  currentUserId?: string | null
  employees: EmployeeOption[]
  credentials: CredentialRecord[]
  requiredDocuments?: string[]
  onRefresh?: () => void | Promise<void>
}

type DocsFilter = "all" | "valid" | "expiring" | "expired" | "missing"

const CREDENTIAL_TYPES = [
  "Sveikatos pažyma",
  "Profesinė licencija",
  "Pirmos pagalbos pažymėjimas",
  "Higienos pažymėjimas",
  "Kita",
]

const DEFAULT_REQUIRED_DOCUMENTS = ["Sveikatos pažyma"]

const CHECK_METHODS = [
  "Matytas originalas vietoje",
  "Patikrinta oficialiame registre",
  "Pateikta darbuotojo informacija",
  "Patikrinta pagal vidinę tvarką",
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

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function diffDays(date: Date) {
  const today = parseDate(todayIso())!
  const clean = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const cleanToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.ceil((clean.getTime() - cleanToday.getTime()) / 86400000)
}

function getDocumentStatus(record?: CredentialRecord | null) {
  if (!record) {
    return {
      key: "missing" as const,
      label: "Trūksta",
      className: "bg-slate-100 text-slate-700",
    }
  }

  const expires = parseDate(record.expires_at)
  if (!expires) {
    return {
      key: "valid" as const,
      label: "Galioja",
      className: "bg-emerald-100 text-emerald-800",
    }
  }

  const daysLeft = diffDays(expires)

  if (daysLeft < 0) {
    return {
      key: "expired" as const,
      label: "Pasibaigė",
      className: "bg-red-100 text-red-800",
    }
  }

  if (daysLeft <= 30) {
    return {
      key: "expiring" as const,
      label: "Baigiasi",
      className: "bg-amber-100 text-amber-800",
    }
  }

  return {
    key: "valid" as const,
    label: "Galioja",
    className: "bg-emerald-100 text-emerald-800",
  }
}

function employeeName(employees: EmployeeOption[], id: string) {
  const employee = employees.find((item) => item.id === id)
  return employee?.full_name || employee?.name || "Darbuotojas"
}

function makeMissingDocuments(
  employees: EmployeeOption[],
  credentials: CredentialRecord[],
  requiredDocuments: string[],
) {
  const rows: MissingDocumentRecord[] = []

  for (const employee of employees) {
    for (const required of requiredDocuments) {
      const exists = credentials.some(
        (credential) =>
          credential.employee_id === employee.id &&
          normalizeCredentialType(credential.type) === normalizeCredentialType(required) &&
          getDocumentStatus(credential).key !== "expired",
      )

      if (!exists) {
        rows.push({
          employee_id: employee.id,
          employee_name: employee.full_name || employee.name || "Darbuotojas",
          type: normalizeCredentialType(required),
        })
      }
    }
  }

  return rows
}

export default function DocumentsModule({
  organizationId,
  currentUserId,
  employees,
  credentials,
  requiredDocuments = DEFAULT_REQUIRED_DOCUMENTS,
  onRefresh,
}: DocumentsModuleProps) {
  const [filter, setFilter] = useState<DocsFilter>("all")
  const [employeeId, setEmployeeId] = useState("")
  const [type, setType] = useState(CREDENTIAL_TYPES[0])
  const [number, setNumber] = useState("")
  const [issuer, setIssuer] = useState("")
  const [issuedAt, setIssuedAt] = useState(todayIso())
  const [expiresAt, setExpiresAt] = useState("")
  const [note, setNote] = useState("")
  const [checkMethod, setCheckMethod] = useState(CHECK_METHODS[0])
  const [checkedAt, setCheckedAt] = useState(todayIso())
  const [checkedByText, setCheckedByText] = useState("")
  const [confirmed, setConfirmed] = useState(false)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
    details?: string
  } | null>(null)

  const missingDocuments = useMemo(
    () => makeMissingDocuments(employees, credentials, requiredDocuments),
    [employees, credentials, requiredDocuments],
  )

  const credentialRows = useMemo(() => {
    const existing = credentials.map((record) => ({
      kind: "credential" as const,
      id: record.id,
      employee_id: record.employee_id,
      employee_name: employeeName(employees, record.employee_id),
      type: normalizeCredentialType(record.type),
      number: record.number || "—",
      expires_at: record.expires_at || "—",
      status: getDocumentStatus(record),
      record,
    }))

    const missing = missingDocuments.map((row) => ({
      kind: "missing" as const,
      id: `missing-${row.employee_id}-${row.type}`,
      employee_id: row.employee_id,
      employee_name: row.employee_name || employeeName(employees, row.employee_id),
      type: normalizeCredentialType(row.type),
      number: "—",
      expires_at: "—",
      status: getDocumentStatus(null),
      record: null,
    }))

    return [...existing, ...missing]
  }, [credentials, employees, missingDocuments])

  const counts = useMemo(() => {
    const base = {
      all: credentialRows.length,
      valid: 0,
      expiring: 0,
      expired: 0,
      missing: 0,
    }

    for (const row of credentialRows) {
      base[row.status.key] += 1
    }

    return base
  }, [credentialRows])

  const compliancePercent = useMemo(() => {
    const total = counts.valid + counts.expiring + counts.expired + counts.missing
    if (!total) return 100
    return Math.round(((counts.valid + counts.expiring) / total) * 100)
  }, [counts])

  const filteredRows = credentialRows.filter((row) => {
    if (filter === "all") return true
    return row.status.key === filter
  })

  function fillFromMissing(row: MissingDocumentRecord | { employee_id: string; type: string }) {
    setEmployeeId(row.employee_id)
    setType(normalizeCredentialType(row.type))
    setNumber("")
    setIssuer("")
    setIssuedAt(todayIso())
    setExpiresAt("")
    setNote("")
    setCheckMethod(CHECK_METHODS[0])
    setCheckedAt(todayIso())
    setCheckedByText("")
    setConfirmed(false)
    setMessage(null)
    window.requestAnimationFrame(() => {
      document.getElementById("documents-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
  }

  async function handleSave() {
    setMessage(null)

    if (!organizationId) {
      setMessage({
        type: "error",
        text: "Nepavyko išsaugoti: nenustatyta organizacija.",
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
        text: "Pasirink dokumento tipą.",
      })
      return
    }

    if (!confirmed) {
      setMessage({
        type: "error",
        text: "Pažymėk patvirtinimą, kad dokumentas patikrintas dėl darbo.",
      })
      return
    }

    setSaving(true)

    try {
      const { data: credential, error: credentialError } = await supabase
        .from("personnel_credentials")
        .insert({
          organization_id: organizationId,
          employee_id: employeeId,
          type: normalizeCredentialType(type),
          number: number.trim() || null,
          issuer: issuer.trim() || null,
          issued_at: issuedAt || null,
          expires_at: expiresAt || null,
          status: "active",
          note: note.trim() || null,
        })
        .select("id")
        .single()

      if (credentialError) {
        setMessage({
          type: "error",
          text: "Nepavyko išsaugoti dokumento.",
          details: credentialError.message,
        })
        return
      }

      const { error: verificationError } = await supabase
        .from("document_verifications")
        .insert({
          organization_id: organizationId,
          employee_id: employeeId,
          credential_id: credential?.id || null,
          type: normalizeCredentialType(type),
          method: checkMethod,
          checked_at: checkedAt || todayIso(),
          checked_by: currentUserId || null,
          checked_by_text: checkedByText.trim() || null,
          result: "confirmed",
          note: note.trim() || null,
        })

      if (verificationError) {
        setMessage({
          type: "error",
          text: "Dokumentas išsaugotas, bet nepavyko išsaugoti patikrinimo fakto.",
          details: verificationError.message,
        })
        await onRefresh?.()
        return
      }

      setMessage({
        type: "success",
        text: "Dokumentas ir patikrinimo faktas išsaugoti.",
      })

      setFilter("all")
      setNumber("")
      setIssuer("")
      setIssuedAt(todayIso())
      setExpiresAt("")
      setNote("")
      setCheckMethod(CHECK_METHODS[0])
      setCheckedAt(todayIso())
      setCheckedByText("")
      setConfirmed(false)

      await onRefresh?.()
    } catch (error) {
      setMessage({
        type: "error",
        text: "Klaida saugant dokumentą.",
        details: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Vienas dokumentų modulis
          </p>
          <h2 className="mt-1 text-3xl font-black text-slate-950">
            Dokumentai
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500">
            Pažymos, licencijos ir patikrinimo faktas tvarkomi vienoje vietoje.
            Atskiro „Dokumentų patikrinimai“ modulio nebereikia.
          </p>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-6 py-4 text-center">
          <div className="text-4xl font-black text-emerald-800">{compliancePercent}%</div>
          <div className="text-xs font-black uppercase tracking-wide text-emerald-700">
            Atitiktis
          </div>
        </div>
      </div>

      {(counts.expiring > 0 || counts.expired > 0 || counts.missing > 0) ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-black text-amber-900">
          Yra dokumentų rizikų: {counts.expiring} baigiasi, {counts.expired} pasibaigę,
          {" "}{counts.missing} trūksta. Tokius darbuotojus grafike verta žymėti įspėjimu.
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-900">
          Dokumentų rizikų nėra.
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-3">
        {[
          ["all", "Visi", counts.all],
          ["valid", "Galioja", counts.valid],
          ["expiring", "Baigiasi", counts.expiring],
          ["expired", "Pasibaigę", counts.expired],
          ["missing", "Trūksta", counts.missing],
        ].map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key as DocsFilter)}
            className={[
              "rounded-2xl border px-4 py-2 text-sm font-black transition",
              filter === key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            {label} · {count}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.35fr]">
        <div id="documents-form" className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6">
          <h3 className="text-2xl font-black text-slate-950">Pridėti dokumentą</h3>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Įvedamas dokumento faktas ir privalomas patikrinimas. Failų kelti nereikia.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
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
                {Array.from(new Set([...CREDENTIAL_TYPES, ...requiredDocuments, type].filter(Boolean))).map((item) => (
                  <option key={item} value={normalizeCredentialType(item)}>
                    {normalizeCredentialType(item)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-black text-slate-600">Numeris</span>
              <input
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                placeholder="Dokumento nr."
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

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h4 className="text-sm font-black uppercase tracking-[0.14em] text-amber-800">
              Privalomas patikrinimo faktas
            </h4>

            <div className="mt-4 grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-black text-slate-600">Patikrinimo būdas</span>
                <select
                  value={checkMethod}
                  onChange={(event) => setCheckMethod(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-amber-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                >
                  {CHECK_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-black text-slate-600">Patikrinimo data</span>
                  <input
                    type="date"
                    value={checkedAt}
                    onChange={(event) => setCheckedAt(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-amber-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-black text-slate-600">Kas patikrino</span>
                  <input
                    value={checkedByText}
                    onChange={(event) => setCheckedByText(event.target.value)}
                    placeholder="Vardas arba pareigos"
                    className="h-12 w-full rounded-2xl border border-amber-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </label>
              </div>
            </div>
          </div>

          <label className="mt-4 block space-y-2">
            <span className="text-sm font-black text-slate-600">Pastaba</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Neprivaloma pastaba"
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
              Patvirtinu, kad dokumentas patikrintas dėl darbo ir įvesti duomenys yra teisingi.
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

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-700 px-7 text-base font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saugoma..." : "+ Išsaugoti"}
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-black text-slate-950">Dokumentų sąrašas</h3>
              <p className="text-sm font-bold text-slate-500">
                Filtras: {filter === "all" ? "Visi" : filter === "valid" ? "Galioja" : filter === "expiring" ? "Baigiasi" : filter === "expired" ? "Pasibaigę" : "Trūksta"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFilter("all")}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              Rodyti visus
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-black">Darbuotojas</th>
                  <th className="px-4 py-3 font-black">Tipas</th>
                  <th className="px-4 py-3 font-black">Nr.</th>
                  <th className="px-4 py-3 font-black">Galioja iki</th>
                  <th className="px-4 py-3 font-black">Būsena</th>
                  <th className="px-4 py-3 font-black">Veiksmai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.length ? (
                  filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.employee_name}</td>
                      <td className="px-4 py-3">{row.type}</td>
                      <td className="px-4 py-3">{row.number}</td>
                      <td className="px-4 py-3">{row.expires_at}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${row.status.className}`}>
                          {row.status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.kind === "missing" ? (
                          <button
                            type="button"
                            onClick={() => fillFromMissing({ employee_id: row.employee_id, type: row.type })}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                          >
                            Pridėti dokumentą
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fillFromMissing({ employee_id: row.employee_id, type: row.type })}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                          >
                            Atnaujinti
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center font-bold text-slate-500">
                      Dokumentų pagal pasirinktą filtrą nėra.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
