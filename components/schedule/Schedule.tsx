"use client"

import { useMemo, useRef, useState } from "react"
import { HotTable } from "@handsontable/react"
import type { HotTableClass } from "@handsontable/react"
import Handsontable from "handsontable"
import "handsontable/dist/handsontable.full.css"

type Row = string[]

const EMPLOYEE_COL = 0
const DAYS_IN_MONTH = 31
const statuses = new Set(["P", "A", "L"])

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function normalizeTimePart(input: string, isEnd = false): string | null {
  const value = input.trim()

  if (/^\d{1,2}$/.test(value)) {
    const h = Number(value)
    if (h === 24 && isEnd) return "24:00"
    if (h < 0 || h > 23) return null
    return `${pad2(h)}:00`
  }

  const match = value.match(/^(\d{1,2}):(\d{1,2})$/)
  if (!match) return null

  const h = Number(match[1])
  const m = Number(match[2])

  if (h === 24 && isEnd && m === 0) return "24:00"
  if (h < 0 || h > 23 || m < 0 || m > 59) return null

  return `${pad2(h)}:${pad2(m)}`
}

function normalizeCellValue(input: unknown): string {
  const raw = String(input ?? "").trim()
  if (!raw) return ""

  const upper = raw.toUpperCase()
  if (statuses.has(upper)) return upper

  const normalizedDash = raw.replace(/[–—]/g, "-").replace(/\s+/g, "")
  const parts = normalizedDash.split("-")
  if (parts.length !== 2) return raw

  const start = normalizeTimePart(parts[0], false)
  const end = normalizeTimePart(parts[1], true)
  if (!start || !end) return raw

  return `${start}-${end}`
}

function timeToMinutes(time: string, isEnd = false): number | null {
  const match = time.match(/^(\d{2}):(\d{2})$/)
  if (!match) return null

  const h = Number(match[1])
  const m = Number(match[2])

  if (h === 24 && isEnd && m === 0) return 24 * 60
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

function getDurationMinutes(value: string): number {
  const normalized = normalizeCellValue(value)
  const parts = normalized.split("-")
  if (parts.length !== 2) return 0

  const start = timeToMinutes(parts[0], false)
  const end = timeToMinutes(parts[1], true)
  if (start === null || end === null) return 0
  if (start === end) return 0

  return end > start ? end - start : 24 * 60 - start + end
}

function compactDisplay(value: string): string[] {
  const normalized = normalizeCellValue(value)
  if (!normalized) return ["+"]
  const upper = normalized.toUpperCase()
  if (statuses.has(upper)) return [upper]

  const parts = normalized.split("-")
  if (parts.length !== 2) return [normalized]

  const short = (time: string) => time.endsWith(":00") ? time.slice(0, 2) : time
  return [short(parts[0]), short(parts[1])]
}

function createInitialData(): Row[] {
  const emptyDays = Array.from({ length: DAYS_IN_MONTH }, () => "")
  return [
    ["Vardenė Pavardenė\nadmin", ...emptyDays],
    ["Almontienė\nemployee", ...emptyDays],
  ]
}

function cellKind(value: string) {
  const normalized = normalizeCellValue(value)
  const upper = normalized.toUpperCase()

  if (!normalized) return "empty"
  if (upper === "P") return "rest"
  if (upper === "A") return "vacation"
  if (upper === "L") return "sick"
  if (getDurationMinutes(normalized) > 0) {
    const [start, end] = normalized.split("-")
    const startMinutes = timeToMinutes(start, false)
    const endMinutes = timeToMinutes(end, true)
    return startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes ? "night" : "work"
  }
  return "invalid"
}

function scheduleRenderer(
  instance: Handsontable.Core,
  td: HTMLTableCellElement,
  row: number,
  col: number,
  prop: string | number,
  value: unknown,
  cellProperties: Handsontable.CellProperties
) {
  Handsontable.renderers.TextRenderer(instance, td, row, col, prop, value, cellProperties)

  td.className = td.className.replace(/\b(schedule-[a-z]+|employee-cell)\b/g, "")

  if (col === EMPLOYEE_COL) {
    td.classList.add("employee-cell")
    td.textContent = String(value ?? "")
    return td
  }

  const normalized = normalizeCellValue(value)
  const kind = cellKind(normalized)
  td.classList.add(`schedule-${kind}`)
  td.textContent = ""

  const pill = document.createElement("div")
  pill.className = "schedule-pill"

  const duration = getDurationMinutes(normalized)
  pill.title = normalized
    ? duration > 0
      ? `${normalized} · ${(duration / 60).toFixed(duration % 60 === 0 ? 0 : 1)} val.`
      : normalized
    : "Tuščia"

  const lines = compactDisplay(normalized)
  if (lines.length === 1) {
    pill.textContent = lines[0]
  } else {
    pill.classList.add("schedule-pill-time")
    const start = document.createElement("span")
    start.textContent = lines[0]
    const end = document.createElement("span")
    end.textContent = lines[1]
    pill.appendChild(start)
    pill.appendChild(end)
  }

  td.appendChild(pill)
  return td
}

export default function Schedule() {
  const hotRef = useRef<HotTableClass>(null)
  const [data, setData] = useState<Row[]>(createInitialData)

  const columns = useMemo(
    () => [
      { data: EMPLOYEE_COL, readOnly: true, width: 170, renderer: scheduleRenderer },
      ...Array.from({ length: DAYS_IN_MONTH }).map((_, index) => ({
        data: index + 1,
        type: "text",
        width: 31,
        renderer: scheduleRenderer,
      })),
    ],
    []
  )

  const nestedHeaders = useMemo(
    () => [
      [
        { label: "Darbuotojas", colspan: 1 },
        ...Array.from({ length: DAYS_IN_MONTH }).map((_, i) => ({
          label: String(i + 1).padStart(2, "0"),
          colspan: 1,
        })),
      ],
    ],
    []
  )

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 18,
        padding: 14,
        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
      }}
      onSubmit={(e) => e.preventDefault()}
    >
      <style>{`
        .schedule-table {
          width: 100%;
          max-width: 100%;
          overflow: hidden;
        }

        .schedule-table .handsontable {
          font-family: inherit;
        }

        .schedule-table .htCore td {
          height: 44px;
          vertical-align: middle;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
          padding: 2px !important;
        }

        .schedule-table .htCore th {
          height: 30px;
          font-size: 11px;
          font-weight: 900;
          background: #f4f7fb;
          color: #0f172a;
          padding: 2px !important;
        }

        .schedule-table .employee-cell {
          white-space: pre-line !important;
          font-weight: 900;
          line-height: 1.25;
          background: #f8fafc !important;
          color: #0f172a !important;
        }

        .schedule-table .schedule-pill {
          width: 100%;
          min-height: 36px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          overflow: hidden;
          text-overflow: ellipsis;
          padding: 0 1px;
          line-height: 1.05;
        }

        .schedule-table .schedule-pill-time {
          flex-direction: column;
          gap: 2px;
        }

        .schedule-table .schedule-empty .schedule-pill {
          border: 2px dashed #cbd5e1;
          color: #94a3b8;
          background: #ffffff;
          font-size: 18px;
          font-weight: 900;
        }

        .schedule-table .schedule-work .schedule-pill {
          background: linear-gradient(180deg, #bbf7d0, #86efac);
          color: #065f46;
          border: 1px solid #86efac;
        }

        .schedule-table .schedule-night .schedule-pill {
          background: linear-gradient(180deg, #fed7aa, #fdba74);
          color: #9a3412;
          border: 1px solid #fdba74;
        }

        .schedule-table .schedule-rest .schedule-pill {
          background: linear-gradient(180deg, #ddd6fe, #c4b5fd);
          color: #4c1d95;
          border: 1px solid #c4b5fd;
        }

        .schedule-table .schedule-vacation .schedule-pill {
          background: linear-gradient(180deg, #bfdbfe, #93c5fd);
          color: #1e3a8a;
          border: 1px solid #93c5fd;
        }

        .schedule-table .schedule-sick .schedule-pill {
          background: linear-gradient(180deg, #fecaca, #fca5a5);
          color: #7f1d1d;
          border: 1px solid #fca5a5;
        }

        .schedule-table .schedule-invalid .schedule-pill {
          background: #fee2e2;
          color: #991b1b;
          border: 2px solid #fca5a5;
        }
      `}</style>

      <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 8 }}>
        Darbo grafikas
      </h2>
      <div style={{ color: "#64748b", fontWeight: 800, marginBottom: 16 }}>
        Mėnesio vaizdas sutankintas, kad matytųsi visos 31 dienos. Langelyje rodoma trumpai, pilną reikšmę matai užvedus pelę arba redaguojant.
      </div>

      <div className="schedule-table">
        <HotTable
          ref={hotRef}
          data={data}
          nestedHeaders={nestedHeaders}
          columns={columns as any}
          rowHeaders={true}
          width="100%"
          height="64vh"
          stretchH="all"
          fixedColumnsStart={1}
          rowHeaderWidth={30}
          manualColumnResize={true}
          manualRowResize={true}
          preventOverflow="horizontal"
          licenseKey="non-commercial-and-evaluation"
          afterChange={(changes, source) => {
            if (!changes || source === "loadData") return

            setData((prev) => {
              const next = prev.map((row) => [...row])

              changes.forEach(([row, col, _oldValue, newValue]) => {
                if (typeof row !== "number" || typeof col !== "number") return
                if (col === EMPLOYEE_COL) return

                const normalized = normalizeCellValue(newValue)
                next[row][col] = normalized

                if (normalized !== String(newValue ?? "")) {
                  queueMicrotask(() => {
                    hotRef.current?.hotInstance?.setDataAtCell(
                      row,
                      col,
                      normalized,
                      "internal-normalize"
                    )
                    hotRef.current?.hotInstance?.render()
                  })
                }
              })

              return next
            })
          }}
        />
      </div>
    </div>
  )
}
