"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getChangedFields, logAudit } from "@/lib/audit"

type EmployeeOption = {
  id: string
  full_name?: string | null
  name?: string | null
  role?: string | null
}

type CredentialFormProps = {
  organizationId: string | null | undefined
  employees: EmployeeOption[]
  initialEmployeeId?: string | null
  initialType?: string | null
  defaultEmployeeId?: string | null
  defaultType?: string | null
  currentUserId?: string | null
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

const CHECK_METHODS = [
  "Matytas originalas vietoje",
  "Patikrinta oficialiame registre",
  "Pateikta darbuotojo informacija",
  "Patikrinta pagal vidinę tvarką",
]

const DOCUMENT_MANAGER_ROLES = new Set(["owner", "admin", "director", "hr"])

function canManageDocuments(role?: string | null) {
  return DOCUMENT_MANAGER_ROLES.has(String(role || "").trim().toLowerCase())
}

function errorDetails(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object") {
    const details = error as { message?: string; details?: string }
    return details.message || details.details || String(error)
  }
  return String(error)
}

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
  initialEmployeeId,
  initialType,
  defaultEmployeeId,
  defaultType,
  currentUserId,
  onSaved,
  onCancel,
}: CredentialFormProps) {
  const resolvedEmployeeId = initialEmployeeId || defaultEmployeeId || ""
  const resolvedType = normalizeCredentialType(initialType || defaultType)

  const [employeeId, setEmployeeId] = useState(resolvedEmployeeId)
  const [type, setType] = useState(resolvedType)
  const [number, setNumber] = useState("")
  const [issuer, setIssuer] = useState("")
  const [issuedAt, setIssuedAt] = useState(todayIso())
  const [expiresAt, setExpiresAt] = useState("")
  const [note, setNote] = useState("")

  const [checkMethod, setCheckMethod] = useState(CHECK_METHODS[0])
  const [checkedAt, setCheckedAt] = useState(todayIso())
  const [checkedByText, setCheckedByText] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [canManage, setCanManage] = useState(false)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
    details?: string
  } | null>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setEmployeeId(resolvedEmployeeId), [resolvedEmployeeId])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setType(resolvedType), [resolvedType])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, [resolvedEmployeeId, resolvedType])

  useEffect(() => {
    let mounted = true

    async function checkAccess() {
      setCheckingAccess(true)

      try {
        if (!organizationId || !currentUserId) {
          if (!mounted) return
          setCanManage(false)
          return
        }

        const { data, error } = await supabase
          .from("organization_members")
          .select("role, is_active")
          .eq("organization_id", organizationId)
          .eq("user_id", currentUserId)
          .maybeSingle()

        if (error) throw error

        if (!mounted) return
        setCanManage(Boolean(data?.is_active) && canManageDocuments(data?.role))
      } catch (error: unknown) {
        if (!mounted) return
        setCanManage(false)
        setMessage({
          type: "error",
          text: "Nepavyko patikrinti dokumentų formos teisių.",
          details: errorDetails(error),
        })
      } finally {
        if (mounted) setCheckingAccess(false)
      }
    }

    void checkAccess()

    return () => {
      mounted = false
    }
  }, [organizationId, currentUserId])

  const selectedEmployeeName = useMemo(() => {
    const employee = employees.find((item) => item.id === employeeId)
    return employee?.full_name || employee?.name || "Pasirinktas darbuotojas"
  }, [employeeId, employees])

  async function handleSave() {
    setMessage(null)

    if (!canManage) {
      setMessage({ type: "error", text: "Neturite teisės tvarkyti darbuotojų dokumentų." })
      return
    }

    if (!organizationId) {
      setMessage({ type: "error", text: "Nepavyko išsaugoti: nenustatyta organizacija." })
      return
    }

    if (!employeeId) {
      setMessage({ type: "error", text: "Pasirink darbuotoją." })
      return
    }

    if (!type.trim()) {
      setMessage({ type: "error", text: "Pasirink dokumento tipą." })
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
      const normalizedType = normalizeCredentialType(type)
      const { data: existingRows, error: existingError } = await supabase
        .from("personnel_credentials")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("employee_id", employeeId)
        .eq("type", normalizedType)
        .eq("status", "active")
        .limit(1)

      if (existingError) throw existingError

      if ((existingRows || []).length > 0) {
        setMessage({
          type: "error",
          text: "Šis darbuotojas jau turi aktyvų tokio tipo dokumentą.",
        })
        return
      }

      const { data: credential, error: credentialError } = await supabase
        .from("personnel_credentials")
        .insert({
          organization_id: organizationId,
          employee_id: employeeId,
          type: normalizedType,
          number: number.trim() || null,
          issuer: issuer.trim() || null,
          issued_at: issuedAt || null,
          expires_at: expiresAt || null,
          status: "active",
          note: note.trim() || null,
        })
        .select("id")
        .maybeSingle()

      if (credentialError) {
        setMessage({
          type: "error",
          text: "Nepavyko išsaugoti pažymos.",
          details: credentialError.message,
        })
        return
      }

      if (!credential?.id) {
        setMessage({
          type: "error",
          text: "Pažyma išsaugota, bet DB negrąžino įrašo ID. Patikrink RLS.",
        })
        return
      }

      const { error: verificationError } = await supabase
        .from("document_verifications")
        .insert({
          organization_id: organizationId,
          employee_id: employeeId,
          credential_id: credential.id,
          type: normalizedType,
          method: checkMethod,
          checked_at: checkedAt || todayIso(),
          checked_by: currentUserId || null,
          checked_by_text: checkedByText.trim() || null,
          result: "confirmed",
          note: note.trim() || null,
        })

      if (verificationError) {
        await supabase
          .from("personnel_credentials")
          .delete()
          .eq("id", credential.id)
          .eq("organization_id", organizationId)

        setMessage({
          type: "error",
          text: "Patikrinimo fakto išsaugoti nepavyko, todėl pažymos įrašas atšauktas.",
          details: verificationError.message,
        })
        await onSaved?.()
        return
      }

      try {
        await logAudit({
          organizationId: organizationId || null,
          tableName: "personnel_credentials",
          recordId: credential.id,
          action: "insert",
          changes: getChangedFields(
            {},
            {
              employee_id: employeeId,
              type: normalizedType,
              number: number.trim() || null,
              issuer: issuer.trim() || null,
              issued_at: issuedAt || null,
              expires_at: expiresAt || null,
              status: "active",
              check_method: checkMethod,
              checked_at: checkedAt || todayIso(),
              checked_by: currentUserId || null,
              checked_by_text: checkedByText.trim() || null,
              note: note.trim() || null,
            },
          ),
        })
      } catch (auditError) {
        console.warn("[CredentialForm] audit skipped", auditError)
      }

      setMessage({
        type: "success",
        text: `Pažyma ir patikrinimo faktas išsaugoti: ${selectedEmployeeName}.`,
      })

      setNumber("")
      setIssuer("")
      setIssuedAt(todayIso())
      setExpiresAt("")
      setNote("")
      setCheckMethod(CHECK_METHODS[0])
      setCheckedAt(todayIso())
      setCheckedByText("")
      setConfirmed(false)

      await onSaved?.()
    } catch (error) {
      setMessage({
        type: "error",
        text: "Klaida saugant duomenis.",
        details: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
          Dokumento patikrinimas
        </p>
        <h3 className="mt-1 text-2xl font-black text-slate-950">
          Pridėti pažymą / licenciją
        </h3>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Failų kelti nereikia – įvedamas dokumento faktas ir privalomas patikrinimo įrašas.
        </p>
      </div>

      {checkingAccess ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-600">
          Tikrinamos dokumentų formos teisės...
        </div>
      ) : !canManage ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-black text-amber-900">
          Dokumentų formą gali valdyti tik savininkas, administratorius, direktorius arba HR.
        </div>
      ) : (
        <>

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
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-black text-slate-600">Numeris</span>
          <input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="Dokumento nr." className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-black text-slate-600">Išdavė / kur patikrinta</span>
          <input value={issuer} onChange={(event) => setIssuer(event.target.value)} placeholder="Įstaiga / institucija / registras" className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-black text-slate-600">Galioja nuo</span>
          <input type="date" value={issuedAt} onChange={(event) => setIssuedAt(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-black text-slate-600">Galioja iki</span>
          <input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
        </label>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h4 className="text-sm font-black uppercase tracking-[0.14em] text-amber-800">
          Privalomas patikrinimo faktas
        </h4>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-black text-slate-600">Patikrinimo būdas</span>
            <select value={checkMethod} onChange={(event) => setCheckMethod(event.target.value)} className="h-12 w-full rounded-2xl border border-amber-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
              {CHECK_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-black text-slate-600">Patikrinimo data</span>
            <input type="date" value={checkedAt} onChange={(event) => setCheckedAt(event.target.value)} className="h-12 w-full rounded-2xl border border-amber-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-black text-slate-600">Kas patikrino</span>
            <input value={checkedByText} onChange={(event) => setCheckedByText(event.target.value)} placeholder="Vardas arba pareigos" className="h-12 w-full rounded-2xl border border-amber-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
          </label>
        </div>
      </div>

      <label className="mt-4 block space-y-2">
        <span className="text-sm font-black text-slate-600">Pastaba</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Neprivaloma pastaba" rows={3} className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
      </label>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
        <span className="text-sm font-black leading-6 text-slate-700">
          Patvirtinu, kad dokumentas patikrintas dėl darbo ir įvesti duomenys yra teisingi.
        </span>
      </label>

      {message ? (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          <div>{message.text}</div>
          {message.details ? <div className="mt-1 break-words text-xs font-semibold opacity-80">{message.details}</div> : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={saving} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 text-base font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
            Atšaukti
          </button>
        ) : null}

        <button type="button" onClick={handleSave} disabled={saving} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-700 px-7 text-base font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? "Saugoma..." : "+ Išsaugoti su patikrinimu"}
        </button>
      </div>
        </>
      )}
    </section>
  )
}
