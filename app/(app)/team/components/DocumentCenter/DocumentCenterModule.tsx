"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getChangedFields, logAudit } from "@/lib/audit"
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Send,
  Upload,
} from "lucide-react"

type EmployeeOption = {
  id: string
  full_name?: string | null
  name?: string | null
  role?: string | null
}

type CompanyDocument = {
  id: string
  organization_id: string
  title: string
  type: string | null
  version: string | null
  content_text: string | null
  file_path: string | null
  file_name: string | null
  status: string | null
  created_at: string | null
  published_at: string | null
}

type DocumentAcknowledgement = {
  id: string
  organization_id: string
  employee_id: string
  document_id: string | null
  document_title: string
  document_type: string | null
  document_version: string | null
  status: string | null
  assigned_at: string | null
  due_date: string | null
  acknowledged_at: string | null
  note: string | null
}

type Props = {
  organizationId: string | null | undefined
  currentUserId?: string | null
  employees: EmployeeOption[]
  documents?: CompanyDocument[]
  acknowledgements?: DocumentAcknowledgement[]
  onRefresh?: () => void | Promise<void>
}

type DocumentMode = "text" | "pdf"
type Tab = "library" | "assignments" | "employee-view"

const DOCUMENT_TYPES = [
  "Darbo tvarkos taisyklės",
  "Pareiginis aprašymas",
  "Darbuotojų saugos instrukcija",
  "Konfidencialumo politika",
  "Asmens duomenų apsaugos politika",
  "Vidaus procedūra",
  "Kita",
]

const DOCUMENT_MANAGER_ROLES = new Set(["owner", "admin", "director", "hr"])

function canManageDocuments(role?: string | null) {
  return DOCUMENT_MANAGER_ROLES.has(String(role || "").trim().toLowerCase())
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function employeeName(employees: EmployeeOption[], id: string) {
  const employee = employees.find((item) => item.id === id)
  return employee?.full_name || employee?.name || "Darbuotojas"
}

function statusMeta(status?: string | null, dueDate?: string | null) {
  if (status === "acknowledged") {
    return { label: "Susipažinta", className: "bg-emerald-100 text-emerald-800" }
  }

  if (dueDate) {
    const today = new Date(`${todayIso()}T00:00:00`)
    const due = new Date(`${dueDate}T00:00:00`)
    if (!Number.isNaN(due.getTime()) && due < today) {
      return { label: "Vėluoja", className: "bg-red-100 text-red-800" }
    }
  }

  if (status === "sent") return { label: "Išsiųsta", className: "bg-blue-100 text-blue-800" }
  if (status === "draft") return { label: "Juodraštis", className: "bg-slate-100 text-slate-700" }

  return { label: "Laukia", className: "bg-amber-100 text-amber-800" }
}

function documentStatusMeta(status?: string | null) {
  if (status === "published") return { label: "Publikuotas", className: "bg-emerald-100 text-emerald-800" }
  if (status === "archived") return { label: "Archyvuotas", className: "bg-slate-100 text-slate-700" }
  return { label: "Juodraštis", className: "bg-amber-100 text-amber-800" }
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

async function writeDocumentAudit(input: {
  organizationId?: string | null
  tableName: string
  recordId?: string | null
  action: "insert" | "update" | "delete"
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}) {
  try {
    await logAudit({
      organizationId: input.organizationId || null,
      tableName: input.tableName,
      recordId: input.recordId || null,
      action: input.action,
      changes: getChangedFields(input.before || {}, input.after || {}),
    })
  } catch (error) {
    console.warn("[DocumentCenterModule] audit skipped", error)
  }
}

export default function DocumentCenterModule({
  organizationId,
  currentUserId,
  employees,
  documents = [],
  acknowledgements = [],
  onRefresh,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [activeTab, setActiveTab] = useState<Tab>("library")
  const [mode, setMode] = useState<DocumentMode>("text")
  const [title, setTitle] = useState("")
  const [type, setType] = useState(DOCUMENT_TYPES[0])
  const [version, setVersion] = useState("1.0")
  const [contentText, setContentText] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [publishNow, setPublishNow] = useState(true)

  const [selectedDocumentId, setSelectedDocumentId] = useState("")
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [dueDate, setDueDate] = useState("")
  const [assignmentNote, setAssignmentNote] = useState("")

  const [employeePreviewId, setEmployeePreviewId] = useState("")
  const [ackConfirm, setAckConfirm] = useState(false)

  const [checkingAccess, setCheckingAccess] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error" | "warning"
    text: string
    details?: string
  } | null>(null)

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
      } catch (error) {
        if (!mounted) return
        setCanManage(false)
        setMessage({
          type: "error",
          text: "Nepavyko patikrinti dokumentų centro teisių.",
          details: error instanceof Error ? error.message : String(error),
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

  const publishedDocuments = documents.filter((doc) => doc.status === "published")

  const effectiveActiveTab: Tab = canManage ? activeTab : "employee-view"

  const visibleTabs: Array<[Tab, string]> = canManage
    ? [
        ["library", "Biblioteka"],
        ["assignments", "Priskyrimai"],
        ["employee-view", "Darbuotojo vaizdas"],
      ]
    : [["employee-view", "Mano dokumentai"]]

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId) || null,
    [documents, selectedDocumentId],
  )

  const employeeAssignments = useMemo(() => {
    const previewId = canManage ? employeePreviewId : currentUserId
    if (!previewId) return []
    return acknowledgements.filter((item) => item.employee_id === previewId)
  }, [acknowledgements, canManage, currentUserId, employeePreviewId])

  const counts = useMemo(() => {
    return acknowledgements.reduce(
      (acc, item) => {
        const meta = statusMeta(item.status, item.due_date)
        if (meta.label === "Susipažinta") acc.acknowledged += 1
        else if (meta.label === "Vėluoja") acc.overdue += 1
        else acc.pending += 1
        return acc
      },
      { acknowledged: 0, pending: 0, overdue: 0 },
    )
  }, [acknowledgements])

  function toggleEmployee(id: string) {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  function resetDocumentForm() {
    setTitle("")
    setType(DOCUMENT_TYPES[0])
    setVersion("1.0")
    setContentText("")
    setSelectedFile(null)
    setPublishNow(true)
  }

  async function uploadPdfIfNeeded(documentId: string) {
    if (mode !== "pdf" || !selectedFile) {
      return { filePath: null as string | null, fileName: null as string | null }
    }

    if (selectedFile.type !== "application/pdf") {
      throw new Error("Galima įkelti tik PDF failą.")
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      throw new Error("PDF failas per didelis. Maksimalus dydis: 10 MB.")
    }

    const path = `${organizationId}/${documentId}/${Date.now()}-${safeFileName(selectedFile.name)}`

    const { error } = await supabase.storage
      .from("company-documents")
      .upload(path, selectedFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/pdf",
      })

    if (error) throw error

    return { filePath: path, fileName: selectedFile.name }
  }

  async function handleSaveDocument() {
    setMessage(null)

    if (!canManage) {
      setMessage({ type: "error", text: "Neturite teisės kurti dokumentų." })
      return
    }

    if (!organizationId) {
      setMessage({ type: "error", text: "Nenustatyta organizacija." })
      return
    }

    if (!title.trim()) {
      setMessage({ type: "error", text: "Įrašyk dokumento pavadinimą." })
      return
    }

    if (mode === "text" && !contentText.trim()) {
      setMessage({ type: "error", text: "Įrašyk dokumento tekstą arba pasirink PDF režimą." })
      return
    }

    if (mode === "pdf" && !selectedFile) {
      setMessage({ type: "error", text: "Pasirink PDF failą." })
      return
    }

    setSaving(true)

    try {
      const normalizedTitle = title.trim()
      const normalizedVersion = version.trim() || "1.0"
      const duplicate = documents.some(
        (document) =>
          document.organization_id === organizationId &&
          document.title.trim().toLowerCase() === normalizedTitle.toLowerCase() &&
          String(document.version || "1.0").trim().toLowerCase() ===
            normalizedVersion.toLowerCase(),
      )

      if (duplicate) {
        setMessage({
          type: "error",
          text: "Toks dokumento pavadinimas ir versija jau yra.",
        })
        return
      }

      const { data: created, error: insertError } = await supabase
        .from("company_documents")
        .insert({
          organization_id: organizationId,
          title: normalizedTitle,
          type,
          version: normalizedVersion,
          content_text: mode === "text" ? contentText.trim() : null,
          file_path: null,
          file_name: null,
          status: publishNow ? "published" : "draft",
          created_by: currentUserId || null,
          published_at: publishNow ? new Date().toISOString() : null,
        })
        .select("id")
        .maybeSingle()

      if (insertError) {
        setMessage({
          type: "error",
          text: "Nepavyko išsaugoti dokumento.",
          details: insertError.message,
        })
        return
      }

      if (!created?.id) {
        setMessage({
          type: "error",
          text: "Dokumentas išsaugotas, bet DB negrąžino įrašo ID. Patikrink RLS.",
        })
        return
      }

      const upload = await uploadPdfIfNeeded(created.id)

      if (upload.filePath) {
        const { error: updateError } = await supabase
          .from("company_documents")
          .update({
            file_path: upload.filePath,
            file_name: upload.fileName,
          })
          .eq("id", created.id)

        if (updateError) {
          await supabase.storage
            .from("company-documents")
            .remove([upload.filePath])

          setMessage({
            type: "error",
            text: "Dokumentas sukurtas, bet PDF kelio nepavyko priskirti. Failas pašalintas iš storage.",
            details: updateError.message,
          })
          await onRefresh?.()
          return
        }
      }

      await writeDocumentAudit({
        organizationId,
        tableName: "company_documents",
        recordId: created.id,
        action: "insert",
        after: {
          title: normalizedTitle,
          type,
          version: normalizedVersion,
          status: publishNow ? "published" : "draft",
          file_name: upload.fileName,
        },
      })

      setMessage({
        type: "success",
        text: publishNow ? "Dokumentas išsaugotas ir publikuotas." : "Dokumentas išsaugotas kaip juodraštis.",
      })

      resetDocumentForm()
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

  async function publishDocument(document: CompanyDocument) {
    setMessage(null)

    if (!canManage) {
      setMessage({ type: "error", text: "Neturite teisės publikuoti dokumentų." })
      return
    }

    const { data, error } = await supabase
      .from("company_documents")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", document.id)
      .select("id")
      .maybeSingle()

    if (error) {
      setMessage({
        type: "error",
        text: "Nepavyko publikuoti dokumento.",
        details: error.message,
      })
      return
    }

    if (!data?.id) {
      setMessage({
        type: "error",
        text: "Dokumentas nerastas arba neturite teisės jo publikuoti.",
      })
      return
    }

    await writeDocumentAudit({
      organizationId,
      tableName: "company_documents",
      recordId: document.id,
      action: "update",
      before: { status: document.status || "draft", published_at: document.published_at || null },
      after: { status: "published", published_at: "now" },
    })

    setMessage({ type: "success", text: "Dokumentas publikuotas." })
    await onRefresh?.()
  }

  async function assignDocument() {
    setMessage(null)

    if (!canManage) {
      setMessage({ type: "error", text: "Neturite teisės priskirti dokumentų." })
      return
    }

    if (!organizationId) {
      setMessage({ type: "error", text: "Nenustatyta organizacija." })
      return
    }

    if (!selectedDocument) {
      setMessage({ type: "error", text: "Pasirink dokumentą." })
      return
    }

    if (!selectedEmployeeIds.length) {
      setMessage({ type: "error", text: "Pasirink bent vieną darbuotoją." })
      return
    }

    setSaving(true)

    try {
      const selectedVersion = selectedDocument.version || "1.0"
      const existingAssignmentKeys = new Set(
        acknowledgements
          .filter(
            (item) =>
              item.organization_id === organizationId &&
              item.document_id === selectedDocument.id &&
              String(item.document_version || "1.0") === selectedVersion &&
              item.status !== "archived",
          )
          .map((item) => item.employee_id),
      )
      const duplicateEmployeeIds = selectedEmployeeIds.filter((employeeId) =>
        existingAssignmentKeys.has(employeeId),
      )
      const newEmployeeIds = selectedEmployeeIds.filter(
        (employeeId) => !existingAssignmentKeys.has(employeeId),
      )

      if (!newEmployeeIds.length) {
        setMessage({
          type: "warning",
          text: "Šis dokumentas pasirinktai versijai jau priskirtas pasirinktiems darbuotojams.",
        })
        return
      }

      const rows = newEmployeeIds.map((employeeId) => ({
        organization_id: organizationId,
        employee_id: employeeId,
        document_id: selectedDocument.id,
        document_title: selectedDocument.title,
        document_type: selectedDocument.type,
        document_version: selectedVersion,
        status: "sent",
        assigned_by: currentUserId || null,
        assigned_at: new Date().toISOString(),
        due_date: dueDate || null,
        note: assignmentNote.trim() || null,
      }))

      const { data: createdRows, error } = await supabase
        .from("personnel_document_acknowledgements")
        .insert(rows)
        .select("id, employee_id, document_id, document_version")

      if (error) {
        setMessage({
          type: "error",
          text: "Nepavyko priskirti dokumento.",
          details: error.message,
        })
        return
      }

      await Promise.all(
        (createdRows || []).map((created) =>
          writeDocumentAudit({
            organizationId,
            tableName: "personnel_document_acknowledgements",
            recordId: created.id,
            action: "insert",
            after: {
              employee_id: created.employee_id,
              document_id: created.document_id,
              document_version: created.document_version,
              status: "sent",
              due_date: dueDate || null,
            },
          }),
        ),
      )

      setMessage({
        type: duplicateEmployeeIds.length ? "warning" : "success",
        text: duplicateEmployeeIds.length
          ? `Dokumentas priskirtas naujiems darbuotojams. ${duplicateEmployeeIds.length} dubl. praleista.`
          : "Dokumentas priskirtas darbuotojams.",
      })
      setSelectedEmployeeIds([])
      setDueDate("")
      setAssignmentNote("")
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

  async function acknowledge(item: DocumentAcknowledgement) {
    setMessage(null)

    const canAcknowledgeForEmployee =
      canManage || (!!currentUserId && item.employee_id === currentUserId)

    if (!canAcknowledgeForEmployee) {
      setMessage({
        type: "error",
        text: "Negalima pažymėti susipažinimo už kitą darbuotoją.",
      })
      return
    }

    if (!ackConfirm) {
      setMessage({
        type: "error",
        text: "Pažymėk patvirtinimą, kad darbuotojas susipažino su dokumentu.",
      })
      return
    }

    let updateQuery = supabase
      .from("personnel_document_acknowledgements")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", item.id)

    if (!canManage) {
      updateQuery = updateQuery.eq("employee_id", currentUserId || "")
    }

    const { data, error } = await updateQuery.select("id").maybeSingle()

    if (error) {
      setMessage({
        type: "error",
        text: "Nepavyko išsaugoti susipažinimo fakto.",
        details: error.message,
      })
      return
    }

    if (!data?.id) {
      setMessage({
        type: "error",
        text: "Susipažinimo įrašas nerastas arba neturite teisės jo keisti.",
      })
      return
    }

    setMessage({ type: "success", text: "Susipažinimo faktas išsaugotas." })
    await writeDocumentAudit({
      organizationId,
      tableName: "personnel_document_acknowledgements",
      recordId: item.id,
      action: "update",
      before: { status: item.status || "sent", acknowledged_at: item.acknowledged_at || null },
      after: { status: "acknowledged", acknowledged_at: "now", employee_id: item.employee_id },
    })

    setAckConfirm(false)
    await onRefresh?.()
  }

  async function copyDocumentLink(document: CompanyDocument) {
    const text = document.file_path
      ? `Dokumentas: ${document.title} (v${document.version || "1.0"})`
      : `${document.title} (v${document.version || "1.0"})\n\n${document.content_text || ""}`

    await navigator.clipboard.writeText(text)
    setMessage({ type: "success", text: "Dokumento tekstas / nuorodos informacija nukopijuota." })
  }

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Dokumentų centras
          </p>
          <h2 className="mt-1 text-3xl font-black text-slate-950">
            Dokumentai ir susipažinimai
          </h2>
          <p className="mt-2 max-w-4xl text-sm font-semibold text-slate-500">
            Čia kuriami vidaus dokumentai, PDF arba tekstinės versijos, valdoma versija ir
            darbuotojų susipažinimo faktas. Svarbiausia saugoti ne failo kopiją pas darbuotoją,
            o dokumento versiją ir patvirtinimo faktą sistemoje.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <div className="text-2xl font-black text-emerald-800">{counts.acknowledged}</div>
            <div className="text-xs font-black text-emerald-700">Susipažinta</div>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <div className="text-2xl font-black text-amber-800">{counts.pending}</div>
            <div className="text-xs font-black text-amber-700">Laukia</div>
          </div>
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
            <div className="text-2xl font-black text-red-800">{counts.overdue}</div>
            <div className="text-xs font-black text-red-700">Vėluoja</div>
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-900">
        BDAR principas: dokumentų centre saugomas dokumento turinys / PDF, versija ir susipažinimo
        faktas. Nereikia rinkti perteklinių darbuotojo duomenų ar kelti jo asmeninių dokumentų kopijų.
      </div>

      {checkingAccess ? (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-black text-slate-700">
          Tikrinamos dokumentų centro teisės...
        </div>
      ) : null}

      {!checkingAccess && !canManage ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-black text-amber-900">
          Rodomi tik jūsų dokumentai ir susipažinimo veiksmai.
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-3">
        {visibleTabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as Tab)}
            className={[
              "rounded-2xl border px-4 py-2 text-sm font-black transition",
              effectiveActiveTab === key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {message ? (
        <div
          className={[
            "mb-5 rounded-2xl border px-4 py-3 text-sm font-bold",
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : message.type === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-800"
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

      {effectiveActiveTab === "library" ? (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.2fr]">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6">
            <h3 className="text-2xl font-black text-slate-950">Sukurti dokumentą</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Rekomenduojama naudoti tekstinį dokumentą, o PDF – kai dokumentas jau paruoštas ir patvirtintas.
            </p>

            <div className="mt-5 grid gap-4">
              <div className="flex rounded-2xl border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setMode("text")}
                  className={[
                    "flex-1 rounded-xl px-4 py-2 text-sm font-black",
                    mode === "text" ? "bg-slate-900 text-white" : "text-slate-600",
                  ].join(" ")}
                >
                  Tekstas sistemoje
                </button>
                <button
                  type="button"
                  onClick={() => setMode("pdf")}
                  className={[
                    "flex-1 rounded-xl px-4 py-2 text-sm font-black",
                    mode === "pdf" ? "bg-slate-900 text-white" : "text-slate-600",
                  ].join(" ")}
                >
                  PDF failas
                </button>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-600">Dokumento pavadinimas</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Pvz. Darbo tvarkos taisyklės"
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-black text-slate-600">Tipas</span>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  >
                    {DOCUMENT_TYPES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-black text-slate-600">Versija</span>
                  <input
                    value={version}
                    onChange={(event) => setVersion(event.target.value)}
                    placeholder="1.0"
                    className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>

              {mode === "text" ? (
                <label className="space-y-2">
                  <span className="text-sm font-black text-slate-600">Dokumento tekstas</span>
                  <textarea
                    value={contentText}
                    onChange={(event) => setContentText(event.target.value)}
                    rows={12}
                    placeholder="Įrašyk dokumento turinį. Darbuotojas matys tekstą ir patvirtins susipažinimą sistemoje."
                    className="w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50"
                  >
                    <Upload size={16} />
                    Pasirinkti PDF
                  </button>
                  <p className="mt-3 text-sm font-bold text-slate-500">
                    {selectedFile ? selectedFile.name : "PDF nepasirinktas. Maks. 10 MB."}
                  </p>
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={publishNow}
                  onChange={(event) => setPublishNow(event.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span className="text-sm font-black leading-6 text-slate-700">
                  Iš karto publikuoti. Tik publikuotus dokumentus galima priskirti darbuotojams.
                </span>
              </label>

              <button
                type="button"
                onClick={() => void handleSaveDocument()}
                disabled={saving}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60"
              >
                <Plus size={16} />
                {saving ? "Saugoma..." : "Išsaugoti dokumentą"}
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6">
            <h3 className="text-2xl font-black text-slate-950">Dokumentų biblioteka</h3>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-black">Dokumentas</th>
                    <th className="px-4 py-3 font-black">Tipas</th>
                    <th className="px-4 py-3 font-black">Būsena</th>
                    <th className="px-4 py-3 font-black">Veiksmai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.length ? (
                    documents.map((document) => {
                      const meta = documentStatusMeta(document.status)
                      return (
                        <tr key={document.id}>
                          <td className="px-4 py-3">
                            <div className="font-black text-slate-900">{document.title}</div>
                            <div className="text-xs font-bold text-slate-500">
                              v{document.version || "1.0"}
                              {document.file_name ? ` · ${document.file_name}` : ""}
                            </div>
                          </td>
                          <td className="px-4 py-3">{document.type || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${meta.className}`}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {document.status !== "published" ? (
                                <button
                                  type="button"
                                  onClick={() => void publishDocument(document)}
                                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                                >
                                  Publikuoti
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => void copyDocumentLink(document)}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                              >
                                Kopijuoti
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center font-bold text-slate-500">
                        Dokumentų dar nėra.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {effectiveActiveTab === "assignments" ? (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.2fr]">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6">
            <h3 className="text-2xl font-black text-slate-950">Priskirti darbuotojams</h3>

            <div className="mt-5 grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-black text-slate-600">Dokumentas</span>
                <select
                  value={selectedDocumentId}
                  onChange={(event) => setSelectedDocumentId(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Pasirinkti dokumentą</option>
                  {publishedDocuments.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title} · v{doc.version || "1.0"}
                    </option>
                  ))}
                </select>
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

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-600">Pastaba</span>
                <textarea
                  value={assignmentNote}
                  onChange={(event) => setAssignmentNote(event.target.value)}
                  rows={3}
                  placeholder="Neprivaloma pastaba darbuotojui"
                  className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-black text-slate-600">Darbuotojai</span>
                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeIds(employees.map((employee) => employee.id))}
                    className="text-xs font-black text-emerald-700"
                  >
                    Pažymėti visus
                  </button>
                </div>

                <div className="max-h-72 space-y-2 overflow-auto pr-1">
                  {employees.map((employee) => (
                    <label
                      key={employee.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(employee.id)}
                        onChange={() => toggleEmployee(employee.id)}
                      />
                      <span className="text-sm font-bold text-slate-800">
                        {employee.full_name || employee.name || employee.id}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void assignDocument()}
                disabled={saving}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60"
              >
                <Send size={16} />
                {saving ? "Priskiriama..." : "Priskirti susipažinimui"}
              </button>
            </div>
          </div>

          <AssignmentsTable
            employees={employees}
            acknowledgements={acknowledgements}
            onAcknowledge={(item) => void acknowledge(item)}
          />
        </div>
      ) : null}

      {effectiveActiveTab === "employee-view" ? (
        <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6">
            <h3 className="text-2xl font-black text-slate-950">Darbuotojo vaizdas</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Čia gali patikrinti, kaip darbuotojas matys jam priskirtus dokumentus.
            </p>

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-black text-slate-600">Darbuotojas</span>
              <select
                value={canManage ? employeePreviewId : currentUserId || ""}
                onChange={(event) => {
                  if (canManage) setEmployeePreviewId(event.target.value)
                }}
                disabled={!canManage}
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

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={ackConfirm}
                onChange={(event) => setAckConfirm(event.target.checked)}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span className="text-sm font-black leading-6 text-slate-700">
                Patvirtinu, kad darbuotojas susipažino su pasirinktu dokumentu.
              </span>
            </label>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6">
            <h3 className="text-2xl font-black text-slate-950">Priskirti dokumentai</h3>
            <div className="mt-5 space-y-3">
              {employeeAssignments.length ? (
                employeeAssignments.map((item) => {
                  const meta = statusMeta(item.status, item.due_date)
                  const document = documents.find((doc) => doc.id === item.document_id)
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-black text-slate-950">
                            {item.document_title}
                          </div>
                          <div className="text-sm font-bold text-slate-500">
                            {item.document_type || "Dokumentas"} · v{item.document_version || "1.0"}
                          </div>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${meta.className}`}>
                          {meta.label}
                        </span>
                      </div>

                      {document?.content_text ? (
                        <div className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
                          {document.content_text}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
                          Dokumentas yra PDF formatu. Darbuotojas turi jį peržiūrėti sistemoje prieš patvirtindamas.
                        </div>
                      )}

                      {item.status !== "acknowledged" ? (
                        <button
                          type="button"
                          onClick={() => void acknowledge(item)}
                          className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
                        >
                          <CheckCircle2 size={16} />
                          Patvirtinti susipažinimą
                        </button>
                      ) : null}
                    </div>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-slate-200 px-4 py-10 text-center font-bold text-slate-500">
                  Šiam darbuotojui dokumentų nepriskirta.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function AssignmentsTable({
  employees,
  acknowledgements,
  onAcknowledge,
}: {
  employees: EmployeeOption[]
  acknowledgements: DocumentAcknowledgement[]
  onAcknowledge: (item: DocumentAcknowledgement) => void
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6">
      <h3 className="text-2xl font-black text-slate-950">Susipažinimų sąrašas</h3>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-black">Darbuotojas</th>
              <th className="px-4 py-3 font-black">Dokumentas</th>
              <th className="px-4 py-3 font-black">Terminas</th>
              <th className="px-4 py-3 font-black">Būsena</th>
              <th className="px-4 py-3 font-black">Veiksmai</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {acknowledgements.length ? (
              acknowledgements.map((item) => {
                const meta = statusMeta(item.status, item.due_date)
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {employeeName(employees, item.employee_id)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{item.document_title}</div>
                      <div className="text-xs font-semibold text-slate-500">
                        {item.document_type || "Dokumentas"}
                        {item.document_version ? ` · v${item.document_version}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">{item.due_date || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${meta.className}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.status === "acknowledged" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700">
                          <CheckCircle2 size={14} />
                          Patvirtinta
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAcknowledge(item)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                        >
                          Pažymėti susipažinta
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center font-bold text-slate-500">
                  Susipažinimų įrašų dar nėra.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {acknowledgements.some((item) => statusMeta(item.status, item.due_date).label === "Vėluoja") ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          Yra darbuotojų, kurie vėluoja susipažinti su dokumentais.
        </div>
      ) : null}
    </div>
  )
}
