'use client'

import Link from 'next/link'
import { use, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

type InventoryCategory =
  | 'diapers'
  | 'bedding'
  | 'cleaning'
  | 'medication'
  | 'other'

type InventoryItem = {
  id: string
  organization_id: string
  name: string
  unit: string | null
  quantity: number | null
  category: string | null
  subcategory: string | null
  size: string | null
  min_quantity: number | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

type InventoryLog = {
  id: string
  organization_id: string
  item_id: string
  item_name: string | null
  category: string | null
  subcategory: string | null
  size: string | null
  unit: string | null
  resident_id: string | null
  resident_code: string | null
  employee_user_id: string | null
  employee_full_name: string | null
  quantity: number | null
  type: string | null
  notes: string | null
  created_at: string | null
}

type RouteParams = Promise<{
  category: string
}>

type ReportScope = 'stock' | 'history_all' | 'history_filtered'

const VALID_CATEGORIES: InventoryCategory[] = [
  'diapers',
  'bedding',
  'cleaning',
  'medication',
  'other',
]

export default function InventoryCategoryPage({
  params,
}: {
  params: RouteParams
}) {
  const { category } = use(params)

  const normalizedCategory = VALID_CATEGORIES.includes(category as InventoryCategory)
    ? (category as InventoryCategory)
    : null

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const [items, setItems] = useState<InventoryItem[]>([])
  const [logs, setLogs] = useState<InventoryLog[]>([])

  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [residentFilter, setResidentFilter] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_desc')

  useEffect(() => {
    if (!normalizedCategory) {
      setLoading(false)
      setMessage('Neteisinga kategorija.')
      return
    }

    loadData(normalizedCategory)
  }, [normalizedCategory])

  async function loadData(currentCategory: InventoryCategory) {
    setLoading(true)
    setMessage('')

    try {
      const orgId = await getCurrentOrganizationId()

      if (!orgId) {
        setOrganizationId(null)
        setItems([])
        setLogs([])
        setMessage('Nepavyko nustatyti įstaigos.')
        return
      }

      setOrganizationId(orgId)

      const [itemsResult, logsResult] = await Promise.all([
        supabase
          .from('inventory_items')
          .select(
            'id, organization_id, name, unit, quantity, category, subcategory, size, min_quantity, is_active, created_at, updated_at'
          )
          .eq('organization_id', orgId)
          .eq('category', currentCategory),
        supabase
          .from('inventory_issue_history_view')
          .select(
            'id, organization_id, item_id, item_name, category, subcategory, size, unit, resident_id, resident_code, employee_user_id, employee_full_name, quantity, type, notes, created_at'
          )
          .eq('organization_id', orgId)
          .eq('category', currentCategory)
          .order('created_at', { ascending: false })
          .limit(500),
      ])

      if (itemsResult.error) throw itemsResult.error
      if (logsResult.error) throw logsResult.error

      setItems((itemsResult.data || []) as InventoryItem[])
      setLogs((logsResult.data || []) as InventoryLog[])
    } catch (error: any) {
      setItems([])
      setLogs([])
      setMessage(error?.message || 'Nepavyko įkelti kategorijos duomenų.')
    } finally {
      setLoading(false)
    }
  }

  function clearAllFilters() {
    setSearch('')
    setStockFilter('')
    setEmployeeFilter('')
    setResidentFilter('')
    setSizeFilter('')
    setSortBy('created_desc')
  }

  const filteredItems = useMemo(() => {
    let result = [...items]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((item) =>
        [
          item.name || '',
          getSubcategoryLabel(item.category, item.subcategory),
          shouldUseSize(item.category) ? item.size || '' : '',
          item.unit || '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
    }

    if (stockFilter) {
      result = result.filter(
        (item) => getStockStatusCode(item.quantity, item.min_quantity) === stockFilter
      )
    }

    if (sizeFilter) {
      result = result.filter((item) => (item.size || '') === sizeFilter)
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '', 'lt')
        case 'name_desc':
          return (b.name || '').localeCompare(a.name || '', 'lt')
        case 'qty_desc':
          return Number(b.quantity || 0) - Number(a.quantity || 0)
        case 'qty_asc':
          return Number(a.quantity || 0) - Number(b.quantity || 0)
        case 'created_asc':
          return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
        case 'created_desc':
        default:
          return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
      }
    })

    return result
  }, [items, search, stockFilter, sizeFilter, sortBy])

  const filteredLogs = useMemo(() => {
    let result = [...logs]

    if (search.trim()) {
      const q = search.trim().toLowerCase()

      result = result.filter((log) =>
        [
          log.item_name || '',
          getSubcategoryLabel(log.category, log.subcategory),
          shouldUseSize(log.category) ? log.size || '' : '',
          log.employee_full_name || '',
          log.resident_code || '',
          log.notes || '',
          getLogTypeLabel(log.type),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
    }

    if (employeeFilter) {
      result = result.filter((log) => (log.employee_user_id || '') === employeeFilter)
    }

    if (residentFilter) {
      result = result.filter((log) => (log.resident_id || '') === residentFilter)
    }

    if (sizeFilter) {
      result = result.filter((log) => (log.size || '') === sizeFilter)
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'item_asc':
          return (a.item_name || '').localeCompare(b.item_name || '', 'lt')
        case 'item_desc':
          return (b.item_name || '').localeCompare(a.item_name || '', 'lt')
        case 'employee_asc':
          return (a.employee_full_name || '').localeCompare(
            b.employee_full_name || '',
            'lt'
          )
        case 'employee_desc':
          return (b.employee_full_name || '').localeCompare(
            a.employee_full_name || '',
            'lt'
          )
        case 'created_asc':
          return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
        case 'created_desc':
        default:
          return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
      }
    })

    return result
  }, [logs, search, employeeFilter, residentFilter, sizeFilter, sortBy])

  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>()

    logs.forEach((log) => {
      if (log.employee_user_id && log.employee_full_name) {
        map.set(log.employee_user_id, log.employee_full_name)
      }
    })

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'lt'))
  }, [logs])

  const residentOptions = useMemo(() => {
    const map = new Map<string, string>()

    logs.forEach((log) => {
      if (log.resident_id && log.resident_code) {
        map.set(log.resident_id, log.resident_code)
      }
    })

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'lt'))
  }, [logs])

  const stats = useMemo(() => {
    const totalItems = items.length
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    const lowStock = items.filter(
      (item) => getStockStatusCode(item.quantity, item.min_quantity) === 'low'
    ).length
    const emptyStock = items.filter(
      (item) => getStockStatusCode(item.quantity, item.min_quantity) === 'empty'
    ).length

    const totalLogs = logs.length
    const outLogs = logs.filter((log) => log.type === 'out').length
    const inLogs = logs.filter((log) => log.type === 'in').length

    return {
      totalItems,
      totalQuantity,
      lowStock,
      emptyStock,
      totalLogs,
      outLogs,
      inLogs,
    }
  }, [items, logs])

  function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
    if (!rows.length) {
      setMessage('Nėra duomenų atsisiuntimui.')
      return
    }

    const headers = Object.keys(rows[0])
    const escapeValue = (value: unknown) =>
      `"${String(value ?? '').replace(/"/g, '""')}"`

    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => escapeValue(row[header])).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function exportReport(scope: ReportScope) {
    if (!normalizedCategory) return

    if (scope === 'stock') {
      const rows = filteredItems.map((item) => ({
        pavadinimas: item.name,
        tipas: getSubcategoryLabel(item.category, item.subcategory),
        dydis: shouldUseSize(item.category) ? item.size || '' : '',
        vienetas: item.unit || '',
        kiekis: Number(item.quantity || 0),
        minimalus_kiekis: item.min_quantity ?? '',
        busena: getStockStatusLabel(item.quantity, item.min_quantity),
        sukurta: item.created_at ? new Date(item.created_at).toLocaleString('lt-LT') : '',
        atnaujinta: item.updated_at ? new Date(item.updated_at).toLocaleString('lt-LT') : '',
      }))

      downloadCsv(`${normalizedCategory}_likuciai.csv`, rows)
      return
    }

    const source = scope === 'history_filtered' ? filteredLogs : logs

    const rows = source.map((log) => ({
      preke: log.item_name || '',
      tipas: getSubcategoryLabel(log.category, log.subcategory),
      dydis: shouldUseSize(log.category) ? log.size || '' : '',
      kiekis: Number(log.quantity || 0),
      vienetas: log.unit || '',
      operacija: getLogTypeLabel(log.type),
      gyventojas: log.resident_code || '',
      darbuotojas: log.employee_full_name || '',
      pastabos: log.notes || '',
      data: log.created_at ? new Date(log.created_at).toLocaleString('lt-LT') : '',
    }))

    downloadCsv(
      scope === 'history_filtered'
        ? `${normalizedCategory}_istorija_filtruota.csv`
        : `${normalizedCategory}_istorija.csv`,
      rows
    )
  }

  if (!normalizedCategory) {
    return (
      <div style={styles.outer}>
        <div style={styles.page}>
          <div style={styles.tableCard}>
            <h1 style={styles.title}>Neteisinga kategorija</h1>
            <Link href="/inventory" style={styles.backLink}>
              ← Grįžti į sandėlį
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const categoryTitle = getCategoryLabel(normalizedCategory)
  const categoryTone = getCategoryToneStyle(getCategoryTone(normalizedCategory))
  const showSizeFilter = normalizedCategory === 'diapers'

  return (
    <div style={styles.outer}>
      <div style={styles.page}>
        <div style={styles.topBar}>
          <Link href="/inventory" style={styles.backLink}>
            ← Grįžti į sandėlį
          </Link>

          <Link href="/dashboard" style={styles.backLink}>
            ← Grįžti į dashboard
          </Link>
        </div>

        <div style={{ ...styles.heroCard, ...categoryTone }}>
          <div>
            <h1 style={styles.title}>{categoryTitle}</h1>
            <p style={styles.subtitle}>
              Detalus kategorijos vaizdas su likučiais, judėjimo istorija ir ataskaitomis.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button onClick={() => exportReport('stock')} style={styles.secondaryButton}>
              Atsisiųsti likučius
            </button>
            <button onClick={() => exportReport('history_all')} style={styles.secondaryButton}>
              Atsisiųsti visą istoriją
            </button>
            <button
              onClick={() => exportReport('history_filtered')}
              style={styles.primaryButton}
            >
              Atsisiųsti pagal filtrus
            </button>
          </div>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        <div style={styles.statsRow}>
          <StatCard label="Skirtingų prekių" value={String(stats.totalItems)} />
          <StatCard label="Bendras kiekis" value={String(stats.totalQuantity)} />
          <StatCard label="Baigiasi" value={String(stats.lowStock)} />
          <StatCard label="Pasibaigė" value={String(stats.emptyStock)} />
        </div>

        <div style={styles.statsRowSecondary}>
          <StatCard label="Visi judėjimai" value={String(stats.totalLogs)} />
          <StatCard label="Nurašymai" value={String(stats.outLogs)} />
          <StatCard label="Papildymai" value={String(stats.inLogs)} />
        </div>

        <div style={styles.contentGrid}>
          <aside style={styles.sidebar}>
            <div style={styles.sidebarCard}>
              <h2 style={styles.sidebarTitle}>Filtrai</h2>

              <Field label="Paieška">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Prekė, tipas, pastabos..."
                  style={styles.input}
                />
              </Field>

              <Field label="Likutis">
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                  style={styles.input}
                >
                  <option value="">Visi</option>
                  <option value="ok">Yra sandėlyje</option>
                  <option value="low">Baigiasi</option>
                  <option value="empty">Pasibaigė</option>
                </select>
              </Field>

              {showSizeFilter ? (
                <Field label="Dydis">
                  <select
                    value={sizeFilter}
                    onChange={(e) => setSizeFilter(e.target.value)}
                    style={styles.input}
                  >
                    <option value="">Visi</option>
                    {getSizeOptions().map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              <Field label="Darbuotojas">
                <select
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  style={styles.input}
                >
                  <option value="">Visi</option>
                  {employeeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Gyventojas">
                <select
                  value={residentFilter}
                  onChange={(e) => setResidentFilter(e.target.value)}
                  style={styles.input}
                >
                  <option value="">Visi</option>
                  {residentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Rūšiavimas">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={styles.input}
                >
                  <option value="created_desc">Naujausi viršuje</option>
                  <option value="created_asc">Seniausi viršuje</option>
                  <option value="name_asc">Prekė A–Ž</option>
                  <option value="name_desc">Prekė Ž–A</option>
                  <option value="qty_desc">Daugiausia kiekio</option>
                  <option value="qty_asc">Mažiausia kiekio</option>
                  <option value="employee_asc">Darbuotojas A–Ž</option>
                  <option value="employee_desc">Darbuotojas Ž–A</option>
                </select>
              </Field>

              <button
                onClick={clearAllFilters}
                style={{ ...styles.secondaryButton, width: '100%' }}
              >
                Valyti filtrus
              </button>
            </div>
          </aside>

          <div style={styles.mainContent}>
            <div style={styles.tableCard}>
              <div style={styles.cardHeader}>
                <h2 style={styles.sectionTitle}>Kategorijos likučiai</h2>
                <div style={styles.smallMeta}>Rodoma prekių: {filteredItems.length}</div>
              </div>

              {loading ? (
                <div style={styles.emptyState}>Kraunami likučiai...</div>
              ) : filteredItems.length === 0 ? (
                <div style={styles.emptyState}>Prekių nerasta.</div>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Pavadinimas</th>
                        <th style={styles.th}>Tipas</th>
                        <th style={styles.th}>Dydis</th>
                        <th style={styles.th}>Kiekis</th>
                        <th style={styles.th}>Min. kiekis</th>
                        <th style={styles.th}>Būsena</th>
                        <th style={styles.th}>Atnaujinta</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredItems.map((item) => (
                        <tr key={item.id} style={styles.tr}>
                          <td style={styles.tdBold}>{item.name || '—'}</td>
                          <td style={styles.td}>
                            {getSubcategoryLabel(item.category, item.subcategory)}
                          </td>
                          <td style={styles.td}>
                            {shouldUseSize(item.category) ? item.size || '—' : '—'}
                          </td>
                          <td style={styles.td}>{formatQuantity(item.quantity, item.unit)}</td>
                          <td style={styles.td}>
                            {item.min_quantity !== null && item.min_quantity !== undefined
                              ? formatQuantity(item.min_quantity, item.unit)
                              : '—'}
                          </td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.statusBadge,
                                ...stockStatusStyle(item.quantity, item.min_quantity),
                              }}
                            >
                              {getStockStatusLabel(item.quantity, item.min_quantity)}
                            </span>
                          </td>
                          <td style={styles.td}>
                            {item.updated_at
                              ? new Date(item.updated_at).toLocaleString('lt-LT')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={styles.tableCard}>
              <div style={styles.cardHeader}>
                <h2 style={styles.sectionTitle}>Kategorijos judėjimo istorija</h2>
                <div style={styles.smallMeta}>Rodoma įrašų: {filteredLogs.length}</div>
              </div>

              {loading ? (
                <div style={styles.emptyState}>Kraunama istorija...</div>
              ) : filteredLogs.length === 0 ? (
                <div style={styles.emptyState}>Istorijos įrašų nerasta.</div>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Prekė</th>
                        <th style={styles.th}>Tipas</th>
                        <th style={styles.th}>Dydis</th>
                        <th style={styles.th}>Kiekis</th>
                        <th style={styles.th}>Operacija</th>
                        <th style={styles.th}>Gyventojas</th>
                        <th style={styles.th}>Darbuotojas</th>
                        <th style={styles.th}>Data</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredLogs.map((log) => (
                        <tr key={log.id} style={styles.tr}>
                          <td style={styles.tdBold}>{log.item_name || '—'}</td>
                          <td style={styles.td}>
                            {getSubcategoryLabel(log.category, log.subcategory)}
                          </td>
                          <td style={styles.td}>
                            {shouldUseSize(log.category) ? log.size || '—' : '—'}
                          </td>
                          <td style={styles.td}>{formatQuantity(log.quantity, log.unit)}</td>
                          <td style={styles.td}>{getLogTypeLabel(log.type)}</td>
                          <td style={styles.td}>{log.resident_code || '—'}</td>
                          <td style={styles.td}>{log.employee_full_name || '—'}</td>
                          <td style={styles.td}>
                            {log.created_at
                              ? new Date(log.created_at).toLocaleString('lt-LT')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function shouldUseSize(category: string | null | undefined) {
  return category === 'diapers'
}

function getSizeOptions() {
  return [
    { value: 'XS', label: 'XS' },
    { value: 'S', label: 'S' },
    { value: 'M', label: 'M' },
    { value: 'L', label: 'L' },
    { value: 'XL', label: 'XL' },
    { value: 'XXL', label: 'XXL' },
  ]
}

function getCategoryLabel(category: string | null) {
  switch (category) {
    case 'diapers':
      return 'Sauskelnės'
    case 'bedding':
      return 'Patalynė'
    case 'cleaning':
      return 'Valymo priemonės'
    case 'medication':
      return 'Vaistai'
    case 'other':
      return 'Kita'
    default:
      return 'Nenurodyta'
  }
}

function getCategoryTone(category: InventoryCategory) {
  switch (category) {
    case 'diapers':
      return 'blue'
    case 'bedding':
      return 'violet'
    case 'cleaning':
      return 'green'
    case 'medication':
      return 'red'
    case 'other':
    default:
      return 'gray'
  }
}

function getSubcategoryLabel(category: string | null, subcategory: string | null) {
  if (!subcategory) return '—'

  if (category === 'diapers') {
    switch (subcategory) {
      case 'pants':
        return 'Kelnaitės'
      case 'tape':
        return 'Juostinės'
      case 'night':
        return 'Naktinės'
      case 'insert':
        return 'Įklotai'
      default:
        return subcategory
    }
  }

  if (category === 'bedding') {
    switch (subcategory) {
      case 'set':
        return 'Komplektas'
      case 'sheet':
        return 'Paklodė'
      case 'cover':
        return 'Užvalkalas'
      case 'pillowcase':
        return 'Pagalvės užvalkalas'
      case 'blanket':
        return 'Antklodė'
      default:
        return subcategory
    }
  }

  if (category === 'cleaning') {
    switch (subcategory) {
      case 'spray':
        return 'Purškalas'
      case 'liquid':
        return 'Skystis'
      case 'powder':
        return 'Milteliai'
      case 'gel':
        return 'Gelis'
      case 'wipes':
        return 'Servetėlės'
      default:
        return subcategory
    }
  }

  if (category === 'medication') {
    switch (subcategory) {
      case 'tablet':
        return 'Tabletės'
      case 'liquid':
        return 'Skystis'
      case 'capsule':
        return 'Kapsulės'
      case 'drops':
        return 'Lašai'
      case 'ointment':
        return 'Tepalas'
      case 'injection':
        return 'Injekcija'
      default:
        return subcategory
    }
  }

  return subcategory
}

function formatQuantity(quantity: number | null, unit: string | null) {
  const safeQuantity = Number(quantity || 0)
  const safeUnit = unit?.trim() || 'vnt.'
  return `${safeQuantity} ${safeUnit}`
}

function getStockStatusCode(quantity: number | null, minQuantity: number | null) {
  const q = Number(quantity || 0)

  if (q <= 0) return 'empty'
  if (minQuantity !== null && minQuantity !== undefined && q <= Number(minQuantity)) {
    return 'low'
  }
  return 'ok'
}

function getStockStatusLabel(quantity: number | null, minQuantity: number | null) {
  const code = getStockStatusCode(quantity, minQuantity)

  if (code === 'empty') return 'Pasibaigė'
  if (code === 'low') return 'Baigiasi'
  return 'Yra sandėlyje'
}

function stockStatusStyle(
  quantity: number | null,
  minQuantity: number | null
): React.CSSProperties {
  const code = getStockStatusCode(quantity, minQuantity)

  if (code === 'empty') {
    return {
      background: '#fee2e2',
      color: '#b91c1c',
      border: '1px solid #fecaca',
    }
  }

  if (code === 'low') {
    return {
      background: '#fef3c7',
      color: '#92400e',
      border: '1px solid #fde68a',
    }
  }

  return {
    background: '#dcfce7',
    color: '#166534',
    border: '1px solid #bbf7d0',
  }
}

function getLogTypeLabel(type: string | null) {
  switch (type) {
    case 'in':
      return 'Papildymas'
    case 'out':
      return 'Nurašymas'
    case 'adjustment':
      return 'Koregavimas'
    default:
      return '—'
  }
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

function getCategoryToneStyle(
  tone: 'blue' | 'violet' | 'green' | 'red' | 'gray'
): React.CSSProperties {
  switch (tone) {
    case 'blue':
      return {
        background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)',
        border: '1px solid #bfdbfe',
      }
    case 'violet':
      return {
        background: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)',
        border: '1px solid #ddd6fe',
      }
    case 'green':
      return {
        background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)',
        border: '1px solid #bbf7d0',
      }
    case 'red':
      return {
        background: 'linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)',
        border: '1px solid #fecdd3',
      }
    case 'gray':
    default:
      return {
        background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        border: '1px solid #e2e8f0',
      }
  }
}

const styles: Record<string, React.CSSProperties> = {
  outer: {
    width: '100%',
    padding: '20px 24px 40px',
  },
  page: {
    width: '100%',
    maxWidth: 1700,
    margin: '0 auto',
    display: 'grid',
    gap: 18,
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  backLink: {
    textDecoration: 'none',
    color: '#111827',
    fontSize: 14,
    fontWeight: 700,
    padding: '8px 12px',
    borderRadius: 10,
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
  },
  heroCard: {
    borderRadius: 22,
    padding: 20,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  headerActions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: 40,
    fontWeight: 800,
    lineHeight: 1.1,
    color: '#111827',
  },
  subtitle: {
    margin: '10px 0 0',
    color: '#6b7280',
    fontSize: 17,
  },
  message: {
    padding: '12px 14px',
    borderRadius: 14,
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    color: '#111827',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
  },
  statsRowSecondary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
  },
  statCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 18,
    padding: 16,
    minHeight: 110,
    display: 'grid',
    alignContent: 'start',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 800,
    marginBottom: 8,
    lineHeight: 1,
    color: '#111827',
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: 600,
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '300px minmax(0, 1fr)',
    gap: 18,
    alignItems: 'start',
  },
  sidebar: {
    position: 'sticky',
    top: 20,
  },
  sidebarCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 22,
    padding: 18,
    display: 'grid',
    gap: 14,
  },
  sidebarTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: '#111827',
  },
  mainContent: {
    display: 'grid',
    gap: 18,
  },
  tableCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 22,
    padding: 20,
    display: 'grid',
    gap: 16,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
  },
  smallMeta: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: 700,
  },
  field: {
    display: 'grid',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 700,
    color: '#111827',
  },
  input: {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: 12,
    padding: '11px 12px',
    fontSize: 14,
    outline: 'none',
    background: '#fff',
  },
  primaryButton: {
    border: 'none',
    borderRadius: 12,
    padding: '12px 18px',
    background: '#0f172a',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid #d1d5db',
    borderRadius: 12,
    padding: '12px 16px',
    background: '#fff',
    color: '#111827',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  emptyState: {
    padding: 24,
    textAlign: 'center',
    color: '#6b7280',
    border: '1px dashed #d1d5db',
    borderRadius: 16,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 1100,
    tableLayout: 'fixed',
  },
  th: {
    textAlign: 'left',
    padding: '12px 10px',
    borderBottom: '1px solid #e5e7eb',
    color: '#6b7280',
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '14px 10px',
    color: '#374151',
    fontSize: 14,
    fontWeight: 500,
    verticalAlign: 'middle',
  },
  tdBold: {
    padding: '14px 10px',
    color: '#111827',
    fontSize: 14,
    fontWeight: 800,
    verticalAlign: 'middle',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
}