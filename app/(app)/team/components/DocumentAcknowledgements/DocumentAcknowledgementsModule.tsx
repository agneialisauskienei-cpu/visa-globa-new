"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { supabase } from "@/lib/supabase"
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Info,
  Plus,
  Send,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react"

type EmployeeOption = {
  id: string
  full_name?: string | null
  name?: string | null
  role?: string | null
  department?: string | null
}

type AcknowledgementRecord = {
  id: string
  organization_id: string
  employee_id: string
  document_title: string
  document_type: string | null
  document_version: string | null
  document_file_path?: string | null
  document_file_name?: string | null
  document_sha256?: string | null
  status: string | null
  assigned_by?: string | null
  assigned_at: string | null
  viewed_at?: string | null
  acknowledged_at: string | null
  acknowledged_ip?: string | null
  acknowledged_user_agent?: string | null
  due_date: string | null
  note: string | null
}

type Props = {
  organizationId: string | null | undefined
  employees: EmployeeOption[]
  acknowledgements?: AcknowledgementRecord[]
  currentUserId?: string | null
  onRefresh?: () => void | Promise<void>
}

const DOCUMENT_TYPES = [
  "Darbo tvarkos taisyklės",
  "Pareiginis aprašymas",
  "Darbuotojų saugos instrukcija",
  "Konfidencialumo politika",
  "Asmens duomenų apsaugos politika",
  "Vidaus procedūra",
  "Kita",
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDateTime(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[ąčęėįšųūž]/g, (char) => {
      const map: Record<string, string> = {
        ą: "a",
        č: "c",
        ę: "e",
        ė: "e",
        į: "i",
        š: "s",
        ų: "u",
        ū: "u",
        ž: "z",
      }
      return map[char] || char
    })
    .replace(/[^a-z0-9._-]/g, "-")
}

function employeeName(employees: EmployeeOption[], id: string) {
  const employee = employees.find((item) => item.id === id)
  return employee?.full_name || employee?.name || "Darbuotojas"
}

function isOverdue(dueDate?: string | null, status?: string | null) {
  if (!dueDate || status === "acknowledged") return false
  const today = new Date(`${todayIso()}T00:00:00`)
  const due = new Date(`${dueDate}T00:00:00`)
  return !Number.isNaN(due.getTime()) && due < today
}

function effectiveViewedAt(item: AcknowledgementRecord) {
  return item.viewed_at || item.acknowledged_at || null
}

function statusMeta(item: AcknowledgementRecord) {
  const viewed = effectiveViewedAt(item)

  if (item.status === "acknowledged") {
    return {
      label: "Susipažinta",
      sub: formatDateTime(item.acknowledged_at),
      className: "bg-emerald-100 text-emerald-800",
      borderClass: "border-emerald-200",
    }
  }

  if (isOverdue(item.due_date, item.status)) {
    return {
      label: "Vėluoja",
      sub: `iki ${formatDate(item.due_date)}`,
      className: "bg-red-100 text-red-800",
      borderClass: "border-red-200",
    }
  }

  if (viewed) {
    return {
      label: "Peržiūrėta",
      sub: formatDateTime(viewed),
      className: "bg-indigo-100 text-indigo-800",
      borderClass: "border-indigo-200",
    }
  }

  if (item.status === "sent") {
    return {
      label: "Išsiųsta",
      sub: formatDateTime(item.assigned_at),
      className: "bg-blue-100 text-blue-800",
      borderClass: "border-blue-200",
    }
  }

  return {
    label: "Laukia",
    sub: formatDateTime(item.assigned_at),
    className: "bg-amber-100 text-amber-800",
    borderClass: "border-amber-200",
  }
}

async function sha256(file: File) {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export default function DocumentAcknowledgementsModule({
  organizationId,
  employees,
  acknowledgements = [],
  currentUserId,
  onRefresh,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [recipientMode, setRecipientMode] = useState<"all" | "department" | "employees">("employees")
  const [selectedDepartment, setSelectedDepartment] = useState("")
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [documentTitle, setDocumentTitle] = useState("")
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0])
  const [documentVersion, setDocumentVersion] = useState("1.0")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dueDate, setDueDate] = useState("")
  const [note, setNote] = useState("")
  const [confirmationRequired, setConfirmationRequired] = useState(true)

  const [localAcknowledgements, setLocalAcknowledgements] = useState<AcknowledgementRecord[]>(acknowledgements)
  const [loadingAcknowledgements, setLoadingAcknowledgements] = useState(false)

  const activeAcknowledgements = acknowledgements.length ? acknowledgements : localAcknowledgements

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
    details?: string
  } | null>(null)

  const [detailsItem, setDetailsItem] = useState<AcknowledgementRecord | null>(null)
  const [previewItem, setPreviewItem] = useState<AcknowledgementRecord | null>(null)
  const [previewConfirmed, setPreviewConfirmed] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  useEffect(() => {
    setLocalAcknowledgements(acknowledgements)
  }, [acknowledgements])

  async function loadAcknowledgements() {
    if (!organizationId) {
      setLocalAcknowledgements([])
      return
    }

    setLoadingAcknowledgements(true)

    const { data, error } = await supabase
      .from("personnel_document_acknowledgements")
      .select("*")
      .eq("organization_id", organizationId)
      .order("assigned_at", { ascending: false })

    setLoadingAcknowledgements(false)

    if (error) {
      setMessage({
        type: "error",
        text: "Nepavyko užkrauti susipažinimų sąrašo.",
        details: error.message,
      })
      return
    }

    setLocalAcknowledgements((data || []) as AcknowledgementRecord[])
  }

  useEffect(() => {
    void loadAcknowledgements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const departments = useMemo(() => {
    return Array.from(
      new Set(
        employees
          .map((employee) => employee.department?.trim())
          .filter((department): department is string => Boolean(department)),
      ),
    ).sort((a, b) => a.localeCompare(b, "lt"))
  }, [employees])

  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase()

    return employees.filter((employee) => {
      const haystack = [
        employee.full_name,
        employee.name,
        employee.role,
        employee.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return !query || haystack.includes(query)
    })
  }, [employeeSearch, employees])

  const targetEmployeeIds = useMemo(() => {
    if (recipientMode === "all") return employees.map((employee) => employee.id)

    if (recipientMode === "department") {
      if (!selectedDepartment) return []
      return employees
        .filter((employee) => employee.department === selectedDepartment)
        .map((employee) => employee.id)
    }

    return selectedEmployeeIds
  }, [employees, recipientMode, selectedDepartment, selectedEmployeeIds])

  const selectedEmployeeSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds])

  const selectedEmployeesLabel = useMemo(() => {
    const count = targetEmployeeIds.length

    if (recipientMode === "all") return `Visi darbuotojai (${count})`
    if (recipientMode === "department") {
      return selectedDepartment ? `${selectedDepartment} (${count})` : "Skyrius nepasirinktas"
    }

    return count === 1 ? "1 pasirinktas darbuotojas" : `${count} pasirinkta darbuotojų`
  }, [recipientMode, selectedDepartment, targetEmployeeIds.length])

  const counts = useMemo(() => {
    return activeAcknowledgements.reduce(
      (acc, item) => {
        if (item.status === "acknowledged") acc.acknowledged += 1
        else if (isOverdue(item.due_date, item.status)) acc.overdue += 1
        else if (effectiveViewedAt(item)) acc.viewed += 1
        else acc.pending += 1
        return acc
      },
      { acknowledged: 0, viewed: 0, pending: 0, overdue: 0 },
    )
  }, [activeAcknowledgements])

  async function uploadPdf(fileHash: string) {
    if (!organizationId) throw new Error("Nenustatyta organizacija.")
    if (!selectedFile) throw new Error("Pasirink PDF failą.")
    if (selectedFile.type !== "application/pdf") throw new Error("Galima įkelti tik PDF failą.")
    if (selectedFile.size > 15 * 1024 * 1024) {
      throw new Error("PDF failas per didelis. Maksimalus dydis: 15 MB.")
    }

    const path = `${organizationId}/acknowledgements/${Date.now()}-${fileHash.slice(0, 12)}-${safeFileName(selectedFile.name)}`

    const { error } = await supabase.storage
      .from("employee-acknowledgement-documents")
      .upload(path, selectedFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/pdf",
      })

    if (error) throw error

    return { path, fileName: selectedFile.name }
  }

  async function handleAssign(status: "draft" | "sent" = "sent") {
    setMessage(null)

    if (!organizationId) return setMessage({ type: "error", text: "Nenustatyta organizacija." })
    if (!targetEmployeeIds.length) {
      return setMessage({
        type: "error",
        text: "Pasirink gavėjus: visus darbuotojus, skyrių arba konkrečius darbuotojus.",
      })
    }
    if (!documentTitle.trim()) return setMessage({ type: "error", text: "Įrašyk dokumento pavadinimą." })
    if (!selectedFile) {
      return setMessage({
        type: "error",
        text: "Įkelk PDF failą – darbuotojas turi turėti ką perskaityti.",
      })
    }
    if (!confirmationRequired) {
      return setMessage({
        type: "error",
        text: "Susipažinimo faktui būtinas darbuotojo patvirtinimas sistemoje.",
      })
    }

    setSaving(true)

    try {
      const fileHash = await sha256(selectedFile)
      const uploaded = await uploadPdf(fileHash)

      const assignedAt = new Date().toISOString()
      const rows = targetEmployeeIds.map((targetEmployeeId) => ({
        organization_id: organizationId,
        employee_id: targetEmployeeId,
        document_title: documentTitle.trim(),
        document_type: documentType,
        document_version: documentVersion.trim() || null,
        document_file_path: uploaded.path,
        document_file_name: uploaded.fileName,
        document_sha256: fileHash,
        status,
        assigned_by: currentUserId || null,
        assigned_at: assignedAt,
        viewed_at: null,
        acknowledged_at: null,
        due_date: dueDate || null,
        note: [
          note.trim() || null,
          `Gavėjai: ${selectedEmployeesLabel}`,
          status === "sent" ? `Išsiųsta: ${formatDateTime(assignedAt)}` : `Juodraštis: ${formatDateTime(assignedAt)}`,
        ]
          .filter(Boolean)
          .join("\n"),
      }))

      const { error } = await supabase
        .from("personnel_document_acknowledgements")
        .insert(rows)

      if (error) {
        setMessage({
          type: "error",
          text: "PDF įkeltas, bet nepavyko priskirti dokumento susipažinimui.",
          details: error.message,
        })
        return
      }

      setMessage({
        type: "success",
        text:
          status === "sent"
            ? `PDF dokumentas išsiųstas susipažinimui: ${targetEmployeeIds.length} gavėjų. Peržiūra ir patvirtinimas registruojami su laiko žymomis.`
            : `PDF dokumentas išsaugotas kaip juodraštis: ${targetEmployeeIds.length} gavėjų.`,
      })

      setDocumentTitle("")
      setDocumentVersion("1.0")
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      setDueDate("")
      setNote("")
      setConfirmationRequired(true)
      setSelectedEmployeeIds([])
      setSelectedDepartment("")
      setEmployeeSearch("")

      await loadAcknowledgements()
      await onRefresh?.()
    } catch (error) {
      setMessage({
        type: "error",
        text: "Klaida priskiriant dokumentą.",
        details: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSaving(false)
    }
  }

  async function markViewed(item: AcknowledgementRecord) {
    await fetch("/api/personnel/document-acknowledgements/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledgementId: item.id }),
    })
  }

  async function markAcknowledged(item: AcknowledgementRecord) {
    setMessage(null)

    try {
      const response = await fetch("/api/personnel/document-acknowledgements/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledgementId: item.id }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setMessage({
          type: "error",
          text: result?.error || "Nepavyko išsaugoti susipažinimo fakto.",
          details: result?.details,
        })
        return
      }

      setMessage({
        type: "success",
        text: "Susipažinimo faktas išsaugotas su audito laiko žyma.",
      })

      setPreviewItem(null)
      setPreviewConfirmed(false)
      setSignedUrl(null)

      await onRefresh?.()
    } catch (error) {
      setMessage({
        type: "error",
        text: "Klaida saugant susipažinimą.",
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async function openPreview(item: AcknowledgementRecord) {
    setPreviewItem(item)
    setPreviewConfirmed(false)
    setSignedUrl(null)
    setMessage(null)

    if (!item.document_file_path) return

    setLoadingPreview(true)

    const { data, error } = await supabase.storage
      .from("employee-acknowledgement-documents")
      .createSignedUrl(item.document_file_path, 60 * 10)

    setLoadingPreview(false)

    if (error) {
      setMessage({
        type: "error",
        text: "Nepavyko atidaryti PDF peržiūros.",
        details: error.message,
      })
      return
    }

    setSignedUrl(data.signedUrl)

    if (!item.viewed_at) {
      await markViewed(item)
      await onRefresh?.()
    }
  }

  function openLocalPdfPreview() {
    if (!selectedFile) return
    const url = URL.createObjectURL(selectedFile)
    window.open(url, "_blank", "noopener,noreferrer")
    window.setTimeout(() => URL.revokeObjectURL(url), 30000)
  }

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Audit-ready dokumentų susipažinimai
          </p>
          <h2 className="mt-1 text-3xl font-black text-slate-950">
            Susipažinimas su dokumentais
          </h2>
          <p className="mt-2 max-w-4xl text-sm font-semibold text-slate-500">
            Sistema registruoja PDF dokumentą, versiją, SHA-256 hash, išsiuntimo, peržiūros ir
            patvirtinimo laiko žymas.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center md:grid-cols-4">
          <StatBox value={counts.acknowledged} label="Susipažinta" tone="emerald" />
          <StatBox value={counts.viewed} label="Peržiūrėta" tone="indigo" />
          <StatBox value={counts.pending} label="Laukia" tone="amber" />
          <StatBox value={counts.overdue} label="Vėluoja" tone="red" />
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-blue-300 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-900 shadow-sm">
        BDAR principas: saugomas PDF dokumentas, jo versija, hash ir susipažinimo faktas.
        Darbuotojo asmens dokumentų kopijų kelti nereikia.
      </div>

      <div className="grid gap-7 xl:grid-cols-[520px_minmax(0,1fr)] 2xl:grid-cols-[560px_minmax(0,1fr)]">
        <div className="h-fit rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 xl:sticky xl:top-6">
          <h3 className="text-2xl font-black text-slate-950">Priskirti PDF dokumentą</h3>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Įkelk PDF, kurį darbuotojas turės perskaityti prieš patvirtindamas.
          </p>

          <div className="mt-5 grid gap-5">
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-black text-slate-600">Kam siųsti susipažinimui</span>
                  <p className="mt-1 text-xs font-bold text-slate-400">{selectedEmployeesLabel}</p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                  {targetEmployeeIds.length} gav.
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <RecipientModeButton active={recipientMode === "all"} onClick={() => setRecipientMode("all")}>
                  Visi
                </RecipientModeButton>
                <RecipientModeButton
                  active={recipientMode === "department"}
                  onClick={() => setRecipientMode("department")}
                >
                  Pagal skyrių
                </RecipientModeButton>
                <RecipientModeButton
                  active={recipientMode === "employees"}
                  onClick={() => setRecipientMode("employees")}
                >
                  Pagal darbuotoją
                </RecipientModeButton>
              </div>

              {recipientMode === "department" ? (
                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Skyrius</span>
                  <select
                    value={selectedDepartment}
                    onChange={(event) => setSelectedDepartment(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Pasirinkti skyrių</option>
                    {departments.map((department) => (
                      <option key={department} value={department}>
                        {department} — {employees.filter((employee) => employee.department === department).length}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {recipientMode === "employees" ? (
                <div className="space-y-3">
                  <input
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder="Ieškoti pagal vardą, pareigas ar skyrių"
                    className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEmployeeIds(filteredEmployees.map((employee) => employee.id))}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                    >
                      Pasirinkti matomus
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedEmployeeIds([])}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                    >
                      Išvalyti
                    </button>
                  </div>

                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                    {filteredEmployees.length ? (
                      filteredEmployees.map((employee) => {
                        const checked = selectedEmployeeSet.has(employee.id)

                        return (
                          <label
                            key={employee.id}
                            className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white px-3 py-2 hover:bg-emerald-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                setSelectedEmployeeIds((current) => {
                                  if (event.target.checked) {
                                    return Array.from(new Set([...current, employee.id]))
                                  }

                                  return current.filter((id) => id !== employee.id)
                                })
                              }}
                              className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-black text-slate-800">
                                {employee.full_name || employee.name || employee.id}
                              </span>
                              <span className="block truncate text-xs font-bold text-slate-400">
                                {[employee.role, employee.department].filter(Boolean).join(" · ") || "—"}
                              </span>
                            </span>
                          </label>
                        )
                      })
                    ) : (
                      <div className="px-3 py-8 text-center text-sm font-bold text-slate-500">
                        Darbuotojų nerasta.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-black text-slate-600">Dokumento tipas</span>
                <select
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-600">Versija</span>
                <input
                  value={documentVersion}
                  onChange={(event) => setDocumentVersion(event.target.value)}
                  placeholder="1.0"
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-black text-slate-600">Dokumento pavadinimas</span>
              <input
                value={documentTitle}
                onChange={(event) => setDocumentTitle(event.target.value)}
                placeholder="Pvz. Darbo tvarkos taisyklės"
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-black text-slate-600">Susipažinti iki</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <div
              className="cursor-pointer rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 text-center transition hover:border-emerald-400 hover:bg-emerald-50"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />

              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <Upload size={28} />
              </div>

              <div className="text-base font-black text-slate-900">Pasirinkti PDF</div>
              <p className="mt-2 text-sm font-bold text-slate-500">
                {selectedFile ? selectedFile.name : "PDF nepasirinktas. Maks. 15 MB."}
              </p>

              {selectedFile ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                  <CheckCircle2 size={14} />
                  PDF pasirinktas
                </div>
              ) : null}
            </div>

            {selectedFile ? (
              <button
                type="button"
                onClick={openLocalPdfPreview}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                <Eye size={16} />
                Peržiūrėti PDF prieš priskiriant
              </button>
            ) : null}

            <label className="space-y-2">
              <span className="text-sm font-black text-slate-600">Pastaba administracijai</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Neprivaloma pastaba"
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={confirmationRequired}
                onChange={(event) => setConfirmationRequired(event.target.checked)}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span className="text-sm font-black leading-6 text-slate-700">
                Darbuotojas turės atidaryti PDF ir patvirtinti susipažinimą sistemoje.
              </span>
            </label>
          </div>

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

          <div className="mt-5 grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleAssign("draft")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <Plus size={16} />
              Juodraštis
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleAssign("sent")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60"
            >
              <Send size={16} />
              {saving ? "Saugoma..." : "Priskirti darbuotojui"}
            </button>
          </div>
        </div>

        <div className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-6">
          <h3 className="text-2xl font-black text-slate-950">Susipažinimų sąrašas</h3>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Kortelės vietoje plačios lentelės, todėl dešinė pusė nebekerpama.
          </p>

          <div className="mt-5 space-y-3">
            {loadingAcknowledgements ? (
              <div className="rounded-3xl border border-dashed border-slate-300 px-4 py-10 text-center font-bold text-slate-500">
                Kraunamas susipažinimų sąrašas...
              </div>
            ) : activeAcknowledgements.length ? (
              activeAcknowledgements.map((item) => {
                const meta = statusMeta(item)

                return (
                  <article
                    key={item.id}
                    className={`rounded-3xl border bg-white p-4 shadow-sm ${meta.borderClass}`}
                  >
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-lg font-black text-slate-950">
                            {item.document_title}
                          </h4>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${meta.className}`}>
                            {meta.label}
                          </span>
                        </div>

                        <div className="mt-1 text-sm font-bold text-slate-500">
                          {employeeName(employees, item.employee_id)}
                          {employees.find((employee) => employee.id === item.employee_id)?.department
                            ? ` · ${employees.find((employee) => employee.id === item.employee_id)?.department}`
                            : ""}
                        </div>

                        <div className="mt-2 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-2">
                          <div className="truncate">
                            Tipas: {item.document_type || "Dokumentas"}
                          </div>
                          <div>Versija: {item.document_version || "—"}</div>
                          <div>Terminas: {formatDate(item.due_date)}</div>
                          <div>Išsiųsta: {formatDateTime(item.assigned_at)}</div>
                          <div>Perskaityta: {formatDateTime(effectiveViewedAt(item))}</div>
                          <div>Susipažinta: {formatDateTime(item.acknowledged_at)}</div>
                        </div>

                        {item.document_file_name ? (
                          <div className="mt-2 truncate text-xs font-semibold text-slate-400">
                            Failas: {item.document_file_name}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
                        <button
                          type="button"
                          onClick={() => setDetailsItem(item)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-xs font-black text-slate-700 hover:bg-slate-50"
                        >
                          <Info size={14} />
                          Detalės
                        </button>

                        <button
                          type="button"
                          onClick={() => void openPreview(item)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800"
                        >
                          <Eye size={14} />
                          PDF
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 px-4 py-10 text-center font-bold text-slate-500">
                Susipažinimų įrašų dar nėra.
              </div>
            )}
          </div>

          {counts.overdue > 0 ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              Yra darbuotojų, kurie vėluoja susipažinti su dokumentais.
            </div>
          ) : null}
        </div>
      </div>

      {detailsItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-3xl rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                  Susipažinimo auditas
                </p>
                <h3 className="mt-1 text-2xl font-black text-slate-950">
                  {detailsItem.document_title}
                </h3>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {employeeName(employees, detailsItem.employee_id)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDetailsItem(null)}
                className="rounded-2xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              <AuditBox label="Dokumento tipas" value={detailsItem.document_type || "—"} />
              <AuditBox label="Versija" value={detailsItem.document_version || "—"} />
              <AuditBox label="Failas" value={detailsItem.document_file_name || "—"} />
              <AuditBox label="Būsena" value={statusMeta(detailsItem).label} />
              <AuditBox label="Terminas" value={formatDate(detailsItem.due_date)} />
              <AuditBox label="Išsiųsta" value={formatDateTime(detailsItem.assigned_at)} />
              <AuditBox label="Išsiuntė" value={detailsItem.assigned_by || "—"} />
              <AuditBox label="Peržiūrėta" value={formatDateTime(effectiveViewedAt(detailsItem))} />
              <AuditBox label="Patvirtinta" value={formatDateTime(detailsItem.acknowledged_at)} />
              <AuditBox label="IP" value={detailsItem.acknowledged_ip || "—"} />
              <div className="md:col-span-2">
                <AuditBox label="SHA-256 hash" value={detailsItem.document_sha256 || "—"} mono />
              </div>
              <div className="md:col-span-2">
                <AuditBox label="User-Agent" value={detailsItem.acknowledged_user_agent || "—"} />
              </div>
              {detailsItem.note ? (
                <div className="md:col-span-2">
                  <AuditBox label="Pastaba" value={detailsItem.note} />
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5">
              <button
                type="button"
                onClick={() => {
                  setDetailsItem(null)
                  void openPreview(detailsItem)
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800"
              >
                <Eye size={16} />
                Peržiūrėti PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                  PDF peržiūra
                </p>
                <h3 className="mt-1 text-2xl font-black text-slate-950">
                  {previewItem.document_title}
                </h3>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {previewItem.document_type || "Dokumentas"}
                  {previewItem.document_version ? ` · v${previewItem.document_version}` : ""}
                  {previewItem.document_file_name ? ` · ${previewItem.document_file_name}` : ""}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPreviewItem(null)
                  setPreviewConfirmed(false)
                  setSignedUrl(null)
                }}
                className="rounded-2xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="h-[62vh] bg-slate-100">
              {loadingPreview ? (
                <div className="flex h-full items-center justify-center text-sm font-black text-slate-600">
                  Kraunamas PDF...
                </div>
              ) : signedUrl ? (
                <iframe src={signedUrl} title={previewItem.document_title} className="h-full w-full" />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm font-bold text-amber-900">
                  PDF failo kelias nerastas arba nepavyko sukurti peržiūros nuorodos.
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 px-6 py-5">
              {previewItem.status === "acknowledged" ? (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
                  <CheckCircle2 size={18} />
                  Darbuotojas jau patvirtino susipažinimą: {formatDateTime(previewItem.acknowledged_at)}
                </div>
              ) : (
                <>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <input
                      type="checkbox"
                      checked={previewConfirmed}
                      onChange={(event) => setPreviewConfirmed(event.target.checked)}
                      className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                    />
                    <span className="text-sm font-black leading-6 text-slate-700">
                      Patvirtinu, kad PDF dokumentas buvo perskaitytas ir darbuotojas susipažino su jo turiniu.
                    </span>
                  </label>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (!previewConfirmed) {
                          setMessage({
                            type: "error",
                            text: "Prieš patvirtinimą reikia pažymėti, kad PDF perskaitytas.",
                          })
                          return
                        }
                        void markAcknowledged(previewItem)
                      }}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-6 text-sm font-black text-white hover:bg-emerald-800"
                    >
                      <ShieldCheck size={16} />
                      Patvirtinti susipažinimą
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function RecipientModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "min-h-11 rounded-2xl px-3 text-sm font-black transition",
        active
          ? "bg-emerald-700 text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

function StatBox({
  value,
  label,
  tone,
}: {
  value: number
  label: string
  tone: "emerald" | "indigo" | "amber" | "red"
}) {
  const styles = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-800",
    indigo: "border-indigo-100 bg-indigo-50 text-indigo-800",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    red: "border-red-100 bg-red-50 text-red-800",
  }

  return (
    <div className={`rounded-2xl border px-4 py-3 ${styles[tone]}`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-black">{label}</div>
    </div>
  )
}

function AuditBox({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div
        className={[
          "mt-1 break-words text-sm font-black text-slate-900",
          mono ? "font-mono text-xs" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  )
}
