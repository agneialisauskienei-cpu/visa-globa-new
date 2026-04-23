'use client'

import Link from 'next/link'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

type InventoryCategory = 'diapers' | 'bedding' | 'cleaning' | 'medication' | 'other'
type StockFilter = '' | 'ok' | 'low' | 'empty'
type ActivityFilter = '' | 'in' | 'out'
type SummaryFilter = 'all' | 'low' | 'empty' | 'logs' | 'out' | 'in'

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
  item_id: string | null
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

type ResidentOption = {
  id: string
  label: string
}

type AddRow = {
  name: string
  category: InventoryCategory
  subcategory: string
  size: string
  unit: string
  quantity: string
  min_quantity: string
}

type IssueRow = {
  item_id: string
  quantity: string
  notes: string
}

const CATEGORY_OPTIONS: { value: InventoryCategory; label: string }[] = [
  { value: 'diapers', label: 'Sauskelnės' },
  { value: 'bedding', label: 'Patalynė' },
  { value: 'cleaning', label: 'Valymo priemonės' },
  { value: 'medication', label: 'Vaistai' },
  { value: 'other', label: 'Kita' },
]

const SUBCATEGORY_OPTIONS: Record<InventoryCategory, { value: string; label: string }[]> = {
  diapers: [
    { value: 'pants', label: 'Kelnaitės' },
    { value: 'tape', label: 'Juostinės' },
    { value: 'night', label: 'Naktinės' },
    { value: 'insert', label: 'Įklotai' },
  ],
  bedding: [
    { value: 'set', label: 'Komplektas' },
    { value: 'sheet', label: 'Paklodė' },
    { value: 'cover', label: 'Užvalkalas' },
    { value: 'pillowcase', label: 'Pagalvės užvalkalas' },
    { value: 'blanket', label: 'Antklodė' },
  ],
  cleaning: [
    { value: 'spray', label: 'Purškalas' },
    { value: 'liquid', label: 'Skystis' },
    { value: 'powder', label: 'Milteliai' },
    { value: 'gel', label: 'Gelis' },
    { value: 'wipes', label: 'Servetėlės' },
  ],
  medication: [
    { value: 'tablet', label: 'Tabletės' },
    { value: 'liquid', label: 'Skystis' },
    { value: 'capsule', label: 'Kapsulės' },
    { value: 'drops', label: 'Lašai' },
    { value: 'ointment', label: 'Tepalas' },
    { value: 'injection', label: 'Injekcija' },
  ],
  other: [],
}

const UNIT_OPTIONS = ['vnt.', 'pak.', 'but.', 'kg', 'l']

const COLORS = {
  bg: '#ffffff',
  page: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f8faf8',
  border: '#e5e7eb',
  borderSoft: '#eef2ef',
  borderStrong: '#b7d9c1',
  text: '#111827',
  textSoft: '#4b5563',
  green: '#15803d',
  greenDark: '#166534',
  greenSoft: '#e8f5ec',
  greenSofter: '#f6fbf7',
  amber: '#b45309',
  amberSoft: '#fff7ed',
  red: '#b91c1c',
  redSoft: '#fef2f2',
  shadow: '0 10px 28px rgba(17, 24, 39, 0.06)',
  shadowStrong: '0 18px 40px rgba(17, 24, 39, 0.10)',
}

function createEmptyAddRow(): AddRow {
  return {
    name: '',
    category: 'diapers',
    subcategory: SUBCATEGORY_OPTIONS.diapers[0]?.value || '',
    size: 'M',
    unit: 'vnt.',
    quantity: '',
    min_quantity: '',
  }
}

function createEmptyIssueRow(itemId = ''): IssueRow {
  return {
    item_id: itemId,
    quantity: '1',
    notes: '',
  }
}

function shouldUseSize(category?: string | null) {
  return category !== 'medication'
}

function getCategoryLabel(category?: string | null) {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label || 'Kita'
}

function getSubcategoryLabel(category?: string | null, subcategory?: string | null) {
  if (!category || !subcategory) return ''
  return (
    SUBCATEGORY_OPTIONS[category as InventoryCategory]?.find((option) => option.value === subcategory)
      ?.label || subcategory
  )
}

function getStockStatus(quantity?: number | null, minQuantity?: number | null): StockFilter | 'none' {
  const qty = Number(quantity || 0)
  const min = Number(minQuantity || 0)
  if (qty <= 0) return 'empty'
  if (min > 0 && qty <= min) return 'low'
  return 'ok'
}

function getLogTypeLabel(type?: string | null) {
  if (type === 'out') return 'Nurašymas'
  if (type === 'in') return 'Papildymas'
  return type || 'Judėjimas'
}

function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h3 style={styles.modalTitle}>{title}</h3>
            {subtitle ? <p style={styles.modalSubtitle}>{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} style={styles.iconButton}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  )
}

function StatCard({
  label,
  value,
  active,
  onClick,
}: {
  label: string
  value: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} style={active ? styles.statCardActive : styles.statCard}>
      <span style={active ? { ...styles.statLabel, color: '#ffffff', opacity: 0.9 } : styles.statLabel}>{label}</span>
      <strong style={active ? { ...styles.statValue, color: '#ffffff' } : styles.statValue}>{value}</strong>
    </button>
  )
}

export default function InventoryDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const [items, setItems] = useState<InventoryItem[]>([])
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [residents, setResidents] = useState<ResidentOption[]>([])

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<InventoryCategory | ''>('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('')
  const [residentFilter, setResidentFilter] = useState('')
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('')
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>('all')

  const [showAddModal, setShowAddModal] = useState(false)
  const [showIssueModal, setShowIssueModal] = useState(false)

  const [addRows, setAddRows] = useState<AddRow[]>([createEmptyAddRow()])
  const [issueResidentId, setIssueResidentId] = useState('')
  const [issueRows, setIssueRows] = useState<IssueRow[]>([createEmptyIssueRow()])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setMessage('')

    try {
      const orgId = await getCurrentOrganizationId()

      if (!orgId) {
        setOrganizationId(null)
        setItems([])
        setLogs([])
        setResidents([])
        setMessage('Nepavyko nustatyti įstaigos.')
        return
      }

      setOrganizationId(orgId)

      const [itemsResult, logsResult, residentsResult] = await Promise.all([
        supabase
          .from('inventory_items')
          .select('id, organization_id, name, unit, quantity, category, subcategory, size, min_quantity, is_active, created_at, updated_at')
          .eq('organization_id', orgId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('inventory_issue_history_view')
          .select('id, organization_id, item_id, item_name, category, subcategory, size, unit, resident_id, resident_code, employee_user_id, employee_full_name, quantity, type, notes, created_at')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('residents')
          .select('id, resident_code')
          .eq('organization_id', orgId)
          .order('resident_code', { ascending: true }),
      ])

      if (itemsResult.error) throw itemsResult.error
      if (logsResult.error) throw logsResult.error
      if (residentsResult.error) throw residentsResult.error

      const loadedItems = (itemsResult.data || []) as InventoryItem[]
      const loadedLogs = (logsResult.data || []) as InventoryLog[]
      const loadedResidents = ((residentsResult.data || []) as Array<{ id: string; resident_code: string | null }>).map(
        (resident) => ({
          id: resident.id,
          label: resident.resident_code?.trim() || `Gyventojas ${resident.id.slice(0, 6)}`,
        })
      )

      setItems(loadedItems)
      setLogs(loadedLogs)
      setResidents(loadedResidents)

      if (!issueResidentId && loadedResidents.length > 0) {
        setIssueResidentId(loadedResidents[0].id)
      }

      if (issueRows.length === 1 && !issueRows[0].item_id && loadedItems.length > 0) {
        setIssueRows([createEmptyIssueRow(loadedItems[0].id)])
      }
    } catch (error: any) {
      setItems([])
      setLogs([])
      setResidents([])
      setMessage(error?.message || 'Nepavyko įkelti sandėlio duomenų.')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const totalItems = items.length
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    const lowStock = items.filter((item) => getStockStatus(item.quantity, item.min_quantity) === 'low').length
    const emptyStock = items.filter((item) => getStockStatus(item.quantity, item.min_quantity) === 'empty').length
    const totalLogs = logs.length
    const outLogs = logs.filter((log) => log.type === 'out').length
    const inLogs = logs.filter((log) => log.type === 'in').length

    return { totalItems, totalQuantity, lowStock, emptyStock, totalLogs, outLogs, inLogs }
  }, [items, logs])

  const availableItems = useMemo(() => items.filter((item) => Number(item.quantity || 0) > 0), [items])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()

    let next = items.filter((item) => {
      if (categoryFilter && item.category !== categoryFilter) return false

      const status = getStockStatus(item.quantity, item.min_quantity)
      const effectiveStockFilter = summaryFilter === 'low' ? 'low' : summaryFilter === 'empty' ? 'empty' : stockFilter
      if (effectiveStockFilter && status !== effectiveStockFilter) return false

      if (!q) return true

      const haystack = [
        item.name,
        getCategoryLabel(item.category),
        getSubcategoryLabel(item.category, item.subcategory),
        item.size,
        item.unit,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(q)
    })

    next = next.sort((a, b) => {
      const statusOrder = { empty: 0, low: 1, ok: 2, none: 3 }
      const aStatus = statusOrder[getStockStatus(a.quantity, a.min_quantity)]
      const bStatus = statusOrder[getStockStatus(b.quantity, b.min_quantity)]
      if (aStatus !== bStatus) return aStatus - bStatus
      return a.name.localeCompare(b.name, 'lt')
    })

    return next
  }, [items, search, categoryFilter, stockFilter, summaryFilter])

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase()
    const effectiveActivityFilter = summaryFilter === 'out' ? 'out' : summaryFilter === 'in' ? 'in' : activityFilter

    return logs.filter((log) => {
      if (categoryFilter && log.category !== categoryFilter) return false
      if (residentFilter && log.resident_id !== residentFilter) return false
      if (effectiveActivityFilter && log.type !== effectiveActivityFilter) return false
      if (!q) return true

      const haystack = [
        log.item_name,
        getCategoryLabel(log.category),
        getSubcategoryLabel(log.category, log.subcategory),
        log.size,
        log.notes,
        log.resident_code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(q)
    })
  }, [logs, search, categoryFilter, residentFilter, activityFilter, summaryFilter])

  function openAddModal() {
    setShowAddModal(true)
    setAddRows([createEmptyAddRow()])
    setMessage('')
  }

  function openIssueModal(defaultItemId?: string) {
    setShowIssueModal(true)
    setIssueRows([createEmptyIssueRow(defaultItemId || availableItems[0]?.id || '')])
    setMessage('')
  }

  function closeModals() {
    if (saving) return
    setShowAddModal(false)
    setShowIssueModal(false)
  }

  function updateAddRow(index: number, field: keyof AddRow, value: string) {
    setAddRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row
        const nextRow = { ...row, [field]: value }
        if (field === 'category') {
          const nextCategory = value as InventoryCategory
          const options = SUBCATEGORY_OPTIONS[nextCategory]
          nextRow.subcategory = options[0]?.value || ''
          if (!shouldUseSize(nextCategory)) nextRow.size = ''
          if (shouldUseSize(nextCategory) && !nextRow.size) nextRow.size = 'M'
        }
        return nextRow
      })
    )
  }

  function updateIssueRow(index: number, field: keyof IssueRow, value: string) {
    setIssueRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)))
  }

  function addAddRow() {
    setAddRows((current) => [...current, createEmptyAddRow()])
  }

  function removeAddRow(index: number) {
    setAddRows((current) => (current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index)))
  }

  function addIssueRow() {
    setIssueRows((current) => [...current, createEmptyIssueRow(availableItems[0]?.id || '')])
  }

  function removeIssueRow(index: number) {
    setIssueRows((current) => (current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index)))
  }

  async function writeInventoryLog(payload: Record<string, unknown>) {
    const firstTry = await supabase.from('inventory_logs').insert({ ...payload, performed_by: 'Administratorius' })

    if (!firstTry.error) return

    if (String(firstTry.error.message || '').toLowerCase().includes('employee_user_id')) {
      throw new Error('inventory_logs.employee_user_id dar yra privalomas. Reikia SQL: ALTER TABLE inventory_logs ALTER COLUMN employee_user_id DROP NOT NULL;')
    }

    const secondTry = await supabase.from('inventory_logs').insert(payload)
    if (secondTry.error) throw secondTry.error
  }

  async function handleBulkAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!organizationId) {
      setMessage('Nepavyko nustatyti įstaigos.')
      return
    }

    const cleaned = addRows
      .map((row) => ({
        ...row,
        name: row.name.trim(),
        quantityNumber: Number(row.quantity),
        minQuantityNumber: row.min_quantity.trim() ? Number(row.min_quantity) : 0,
      }))
      .filter((row) => row.name)

    if (!cleaned.length) {
      setMessage('Įveskite bent vieną prekę.')
      return
    }

    for (const row of cleaned) {
      if (!Number.isFinite(row.quantityNumber) || row.quantityNumber <= 0) {
        setMessage('Visų eilučių kiekiai turi būti didesni už 0.')
        return
      }
      if (!Number.isFinite(row.minQuantityNumber) || row.minQuantityNumber < 0) {
        setMessage('Minimalus kiekis negali būti neigiamas.')
        return
      }
    }

    setSaving(true)
    setMessage('')

    try {
      for (const row of cleaned) {
        const normalizedSize = shouldUseSize(row.category) ? row.size.trim() || null : null
        const existing = items.find(
          (item) =>
            item.name.trim().toLowerCase() === row.name.toLowerCase() &&
            (item.category || '') === row.category &&
            (item.subcategory || '') === row.subcategory &&
            (item.unit || '') === row.unit &&
            (item.size || '') === (normalizedSize || '')
        )

        if (existing) {
          const newQuantity = Number(existing.quantity || 0) + row.quantityNumber
          const updateResult = await supabase
            .from('inventory_items')
            .update({
              quantity: newQuantity,
              min_quantity: row.minQuantityNumber,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)

          if (updateResult.error) throw updateResult.error

          await writeInventoryLog({
            organization_id: organizationId,
            item_id: existing.id,
            quantity: row.quantityNumber,
            type: 'in',
            notes: 'Papildyta iš sandėlio formos',
          })
        } else {
          const insertResult = await supabase
            .from('inventory_items')
            .insert({
              organization_id: organizationId,
              name: row.name,
              category: row.category,
              subcategory: row.subcategory || null,
              size: normalizedSize,
              unit: row.unit,
              quantity: row.quantityNumber,
              min_quantity: row.minQuantityNumber,
              is_active: true,
            })
            .select('id')
            .single()

          if (insertResult.error) throw insertResult.error

          await writeInventoryLog({
            organization_id: organizationId,
            item_id: insertResult.data.id,
            quantity: row.quantityNumber,
            type: 'in',
            notes: 'Nauja prekė pridėta į sandėlį',
          })
        }
      }

      setShowAddModal(false)
      setAddRows([createEmptyAddRow()])
      setMessage('Prekės sėkmingai pridėtos.')
      await loadData()
    } catch (error: any) {
      setMessage(error?.message || 'Nepavyko pridėti prekių.')
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkIssue(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!organizationId) {
      setMessage('Nepavyko nustatyti įstaigos.')
      return
    }

    if (!issueResidentId) {
      setMessage('Pasirinkite gyventoją.')
      return
    }

    const cleaned = issueRows.filter((row) => row.item_id)
    if (!cleaned.length) {
      setMessage('Pasirinkite bent vieną prekę nurašymui.')
      return
    }

    for (const row of cleaned) {
      const quantity = Number(row.quantity)
      const item = items.find((candidate) => candidate.id === row.item_id)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setMessage('Nurašymo kiekiai turi būti didesni už 0.')
        return
      }
      if (!item) {
        setMessage('Viena iš pasirinktų prekių neberasta.')
        return
      }
      if (quantity > Number(item.quantity || 0)) {
        setMessage(`Nepakanka likučio prekei „${item.name}“.`)
        return
      }
    }

    setSaving(true)
    setMessage('')

    try {
      for (const row of cleaned) {
        const item = items.find((candidate) => candidate.id === row.item_id)
        if (!item) continue
        const quantity = Number(row.quantity)
        const nextQuantity = Number(item.quantity || 0) - quantity

        const updateResult = await supabase
          .from('inventory_items')
          .update({ quantity: nextQuantity, updated_at: new Date().toISOString() })
          .eq('id', item.id)

        if (updateResult.error) throw updateResult.error

        await writeInventoryLog({
          organization_id: organizationId,
          item_id: item.id,
          resident_id: issueResidentId,
          quantity: -quantity,
          type: 'out',
          notes: row.notes.trim() || null,
        })
      }

      setShowIssueModal(false)
      setIssueRows([createEmptyIssueRow(availableItems[0]?.id || '')])
      setMessage('Prekės sėkmingai nurašytos.')
      await loadData()
    } catch (error: any) {
      setMessage(error?.message || 'Nepavyko nurašyti prekių.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.outer}>
        <div style={styles.page}>
          <div style={styles.loadingCard}>Kraunami sandėlio duomenys…</div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.outer}>
      <div style={styles.page}>
        <div style={styles.topBar}>
          <Link href="/dashboard" style={styles.backLink}>
            ← Grįžti į dashboard
          </Link>
        </div>

        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Sandėlis</h1>
            <p style={styles.subtitle}>Pridėk prekes, nurašyk gyventojui ir stebėk judėjimą vienoje vietoje.</p>
          </div>
          <div style={styles.headerButtons}>
            <button type="button" onClick={openAddModal} style={styles.secondaryButton}>
              + Pridėti prekes
            </button>
            <button type="button" onClick={() => openIssueModal()} style={styles.primaryButton}>
              Nurašyti gyventojui
            </button>
          </div>
        </div>

        {message ? <div style={styles.message}>{message}</div> : null}

        <div style={styles.statsGrid}>
          <StatCard label="Skirtingų prekių" value={String(stats.totalItems)} active={summaryFilter === 'all'} onClick={() => setSummaryFilter('all')} />
          <StatCard label="Bendras kiekis" value={String(stats.totalQuantity)} active={summaryFilter === 'all'} onClick={() => setSummaryFilter('all')} />
          <StatCard label="Baigiasi" value={String(stats.lowStock)} active={summaryFilter === 'low'} onClick={() => setSummaryFilter('low')} />
          <StatCard label="Pasibaigė" value={String(stats.emptyStock)} active={summaryFilter === 'empty'} onClick={() => setSummaryFilter('empty')} />
          <StatCard label="Visi judėjimai" value={String(stats.totalLogs)} active={summaryFilter === 'logs'} onClick={() => setSummaryFilter('logs')} />
          <StatCard label="Nurašymai" value={String(stats.outLogs)} active={summaryFilter === 'out'} onClick={() => setSummaryFilter('out')} />
          <StatCard label="Papildymai" value={String(stats.inLogs)} active={summaryFilter === 'in'} onClick={() => setSummaryFilter('in')} />
        </div>

        <div style={styles.filtersCard}>
          <div style={styles.filtersGrid}>
            <Field label="Paieška">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Prekė, tipas, pastabos..." style={styles.input} />
            </Field>

            <Field label="Kategorija">
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as InventoryCategory | '')} style={styles.input}>
                <option value="">Visos</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Likutis">
              <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as StockFilter)} style={styles.input}>
                <option value="">Visi</option>
                <option value="ok">Yra sandėlyje</option>
                <option value="low">Baigiasi</option>
                <option value="empty">Pasibaigė</option>
              </select>
            </Field>

            <Field label="Gyventojas istorijoje">
              <select value={residentFilter} onChange={(e) => setResidentFilter(e.target.value)} style={styles.input}>
                <option value="">Visi</option>
                {residents.map((resident) => (
                  <option key={resident.id} value={resident.id}>
                    {resident.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Operacija istorijoje">
              <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)} style={styles.input}>
                <option value="">Visos</option>
                <option value="out">Nurašymai</option>
                <option value="in">Papildymai</option>
              </select>
            </Field>
          </div>
        </div>

        <div style={styles.layoutGrid}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Likučiai</h2>
                <p style={styles.panelSubtitle}>Aktyvus filtras: {summaryFilter === 'all' ? 'viskas' : summaryFilter}</p>
              </div>
              <span style={styles.badge}>{filteredItems.length} įraš.</span>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Prekė</th>
                    <th style={styles.th}>Kategorija</th>
                    <th style={styles.th}>Tipas</th>
                    <th style={styles.th}>Dydis</th>
                    <th style={styles.th}>Kiekis</th>
                    <th style={styles.th}>Min.</th>
                    <th style={styles.th}>Būsena</th>
                    <th style={styles.th}>Veiksmas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const status = getStockStatus(item.quantity, item.min_quantity)
                    return (
                      <tr key={item.id}>
                        <td style={styles.tdStrong}>{item.name}</td>
                        <td style={styles.td}>{getCategoryLabel(item.category)}</td>
                        <td style={styles.td}>{getSubcategoryLabel(item.category, item.subcategory) || '—'}</td>
                        <td style={styles.td}>{shouldUseSize(item.category) ? item.size || '—' : '—'}</td>
                        <td style={styles.td}>{Number(item.quantity || 0)} {item.unit || ''}</td>
                        <td style={styles.td}>{item.min_quantity ?? '—'}</td>
                        <td style={styles.td}>
                          <span
                            style={
                              status === 'empty'
                                ? styles.statusDanger
                                : status === 'low'
                                  ? styles.statusWarn
                                  : styles.statusOk
                            }
                          >
                            {status === 'empty' ? 'Pasibaigė' : status === 'low' ? 'Baigiasi' : 'Yra'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <button
                            type="button"
                            style={Number(item.quantity || 0) <= 0 ? styles.rowButtonDisabled : styles.rowButton}
                            disabled={Number(item.quantity || 0) <= 0}
                            onClick={() => openIssueModal(item.id)}
                          >
                            Nurašyti
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {!filteredItems.length ? (
                    <tr>
                      <td colSpan={8} style={styles.emptyCell}>
                        Pagal pasirinktus filtrus nieko nerasta.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Paskutiniai judėjimai</h2>
                <p style={styles.panelSubtitle}>Papildymai ir nurašymai su gyventoju.</p>
              </div>
              <span style={styles.badge}>{filteredLogs.length} įraš.</span>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Data</th>
                    <th style={styles.th}>Prekė</th>
                    <th style={styles.th}>Operacija</th>
                    <th style={styles.th}>Kiekis</th>
                    <th style={styles.th}>Gyventojas</th>
                    <th style={styles.th}>Pastabos</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.slice(0, 100).map((log) => (
                    <tr key={log.id}>
                      <td style={styles.td}>{log.created_at ? new Date(log.created_at).toLocaleString('lt-LT') : '—'}</td>
                      <td style={styles.tdStrong}>{log.item_name || '—'}</td>
                      <td style={styles.td}>{getLogTypeLabel(log.type)}</td>
                      <td style={styles.td}>{Number(log.quantity || 0)} {log.unit || ''}</td>
                      <td style={styles.td}>{log.resident_code || '—'}</td>
                      <td style={styles.td}>{log.notes || '—'}</td>
                    </tr>
                  ))}
                  {!filteredLogs.length ? (
                    <tr>
                      <td colSpan={6} style={styles.emptyCell}>
                        Pagal pasirinktus filtrus judėjimų nėra.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <Modal open={showAddModal} onClose={closeModals} title="Pridėti prekes" subtitle="Gali su pliusu įdėti kelias eilutes iš karto.">
        <form onSubmit={handleBulkAdd}>
          <div style={styles.modalBody}>
            {addRows.map((row, index) => {
              const subcategories = SUBCATEGORY_OPTIONS[row.category]
              const showSize = shouldUseSize(row.category)
              return (
                <div key={index} style={styles.rowCard}>
                  <div style={styles.rowCardHeader}>
                    <strong style={styles.rowCardTitle}>Eilutė #{index + 1}</strong>
                    <button type="button" style={styles.smallGhostButton} onClick={() => removeAddRow(index)}>
                      Pašalinti
                    </button>
                  </div>

                  <div style={styles.modalGrid}>
                    <Field label="Pavadinimas">
                      <input value={row.name} onChange={(e) => updateAddRow(index, 'name', e.target.value)} style={styles.input} placeholder="Pvz. Tena Pants" />
                    </Field>

                    <Field label="Kategorija">
                      <select value={row.category} onChange={(e) => updateAddRow(index, 'category', e.target.value)} style={styles.input}>
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Tipas">
                      <select value={row.subcategory} onChange={(e) => updateAddRow(index, 'subcategory', e.target.value)} style={styles.input}>
                        {subcategories.length ? (
                          subcategories.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))
                        ) : (
                          <option value="">Nėra</option>
                        )}
                      </select>
                    </Field>

                    {showSize ? (
                      <Field label="Dydis">
                        <input value={row.size} onChange={(e) => updateAddRow(index, 'size', e.target.value)} style={styles.input} placeholder="Pvz. M" />
                      </Field>
                    ) : (
                      <Field label="Vienetas">
                        <select value={row.unit} onChange={(e) => updateAddRow(index, 'unit', e.target.value)} style={styles.input}>
                          {UNIT_OPTIONS.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}

                    {showSize ? (
                      <Field label="Vienetas">
                        <select value={row.unit} onChange={(e) => updateAddRow(index, 'unit', e.target.value)} style={styles.input}>
                          {UNIT_OPTIONS.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null}

                    <Field label="Kiekis">
                      <input value={row.quantity} onChange={(e) => updateAddRow(index, 'quantity', e.target.value)} style={styles.input} type="number" min="0" step="1" />
                    </Field>

                    <Field label="Minimalus kiekis">
                      <input value={row.min_quantity} onChange={(e) => updateAddRow(index, 'min_quantity', e.target.value)} style={styles.input} type="number" min="0" step="1" />
                    </Field>
                  </div>
                </div>
              )
            })}

            <button type="button" onClick={addAddRow} style={styles.addLineButton}>
              + Pridėti dar vieną eilutę
            </button>
          </div>

          <div style={styles.modalActions}>
            <button type="button" onClick={closeModals} style={styles.secondaryButton} disabled={saving}>
              Uždaryti
            </button>
            <button type="submit" style={styles.primaryButton} disabled={saving}>
              {saving ? 'Saugoma…' : 'Išsaugoti'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showIssueModal} onClose={closeModals} title="Nurašyti gyventojui" subtitle="Vienu kartu gali nurašyti kelias prekes tam pačiam gyventojui.">
        <form onSubmit={handleBulkIssue}>
          <div style={styles.modalBody}>
            <div style={styles.rowCard}>
              <Field label="Gyventojas">
                <select value={issueResidentId} onChange={(e) => setIssueResidentId(e.target.value)} style={styles.input}>
                  <option value="">Pasirinkti</option>
                  {residents.map((resident) => (
                    <option key={resident.id} value={resident.id}>
                      {resident.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {issueRows.map((row, index) => {
              const selectedItem = items.find((item) => item.id === row.item_id)
              return (
                <div key={index} style={styles.rowCard}>
                  <div style={styles.rowCardHeader}>
                    <strong style={styles.rowCardTitle}>Eilutė #{index + 1}</strong>
                    <button type="button" style={styles.smallGhostButton} onClick={() => removeIssueRow(index)}>
                      Pašalinti
                    </button>
                  </div>

                  <div style={styles.modalGrid}>
                    <Field label="Prekė">
                      <select value={row.item_id} onChange={(e) => updateIssueRow(index, 'item_id', e.target.value)} style={styles.input}>
                        <option value="">Pasirinkti</option>
                        {availableItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · {getCategoryLabel(item.category)} · likutis {Number(item.quantity || 0)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Kiekis">
                      <input value={row.quantity} onChange={(e) => updateIssueRow(index, 'quantity', e.target.value)} style={styles.input} type="number" min="1" step="1" />
                    </Field>

                    <Field label="Pastabos">
                      <input value={row.notes} onChange={(e) => updateIssueRow(index, 'notes', e.target.value)} style={styles.input} placeholder="Nebūtina" />
                    </Field>

                    <div style={styles.infoTile}>
                      <span style={styles.infoTileLabel}>Likutis</span>
                      <strong style={styles.infoTileValue}>
                        {selectedItem ? `${Number(selectedItem.quantity || 0)} ${selectedItem.unit || ''}` : '—'}
                      </strong>
                    </div>
                  </div>
                </div>
              )
            })}

            <button type="button" onClick={addIssueRow} style={styles.addLineButton}>
              + Pridėti dar vieną eilutę
            </button>
          </div>

          <div style={styles.modalActions}>
            <button type="button" onClick={closeModals} style={styles.secondaryButton} disabled={saving}>
              Uždaryti
            </button>
            <button type="submit" style={styles.primaryButton} disabled={saving}>
              {saving ? 'Saugoma…' : 'Patvirtinti nurašymą'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  outer: {
    minHeight: '100vh',
    background: COLORS.bg,
    padding: '24px',
  },
  page: {
    maxWidth: 1480,
    margin: '0 auto',
    display: 'grid',
    gap: 18,
  },
  loadingCard: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 24,
    padding: '32px 24px',
    color: COLORS.text,
    boxShadow: COLORS.shadow,
  },
  topBar: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  backLink: {
    color: COLORS.greenDark,
    textDecoration: 'none',
    fontWeight: 700,
  },
  header: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 24,
    padding: '24px 26px',
    boxShadow: COLORS.shadow,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.08,
    color: COLORS.text,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '8px 0 0',
    color: COLORS.textSoft,
    fontSize: 15,
  },
  headerButtons: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  primaryButton: {
    border: 'none',
    background: COLORS.green,
    color: '#fff',
    borderRadius: 14,
    padding: '12px 18px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(22, 163, 74, 0.22)',
  },
  secondaryButton: {
    border: `1px solid ${COLORS.green}`,
    background: '#fff',
    color: COLORS.greenDark,
    borderRadius: 14,
    padding: '12px 18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  smallGhostButton: {
    border: `1px solid ${COLORS.border}`,
    background: '#fff',
    color: COLORS.textSoft,
    borderRadius: 12,
    padding: '8px 12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  rowButton: {
    border: `1px solid ${COLORS.green}`,
    background: COLORS.greenSofter,
    color: COLORS.greenDark,
    borderRadius: 10,
    padding: '9px 12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  rowButtonDisabled: {
    border: `1px solid ${COLORS.border}`,
    background: '#f9fafb',
    color: '#9ca3af',
    borderRadius: 10,
    padding: '9px 12px',
    fontWeight: 700,
  },
  message: {
    background: COLORS.greenSofter,
    border: `1px solid ${COLORS.borderStrong}`,
    color: COLORS.greenDark,
    borderRadius: 18,
    padding: '14px 16px',
    fontWeight: 600,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 12,
  },
  statCard: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 18,
    padding: '16px 18px',
    display: 'grid',
    gap: 8,
    textAlign: 'left',
    cursor: 'pointer',
    boxShadow: COLORS.shadow,
  },
  statCardActive: {
    background: COLORS.green,
    border: `1px solid ${COLORS.green}`,
    borderRadius: 18,
    padding: '16px 18px',
    display: 'grid',
    gap: 8,
    textAlign: 'left',
    cursor: 'pointer',
    boxShadow: '0 14px 28px rgba(22, 163, 74, 0.22)',
  },
  statLabel: {
    color: COLORS.textSoft,
    fontSize: 13,
    fontWeight: 600,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 28,
    lineHeight: 1,
  },
  filtersCard: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 22,
    padding: 18,
    boxShadow: COLORS.shadow,
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  layoutGrid: {
    display: 'grid',
    gridTemplateColumns: '1.15fr 1fr',
    gap: 18,
  },
  panel: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 24,
    padding: 18,
    boxShadow: COLORS.shadow,
    minWidth: 0,
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  panelTitle: {
    margin: 0,
    color: COLORS.text,
    fontSize: 22,
  },
  panelSubtitle: {
    margin: '4px 0 0',
    color: COLORS.textSoft,
    fontSize: 14,
  },
  badge: {
    background: COLORS.greenSofter,
    color: COLORS.greenDark,
    border: `1px solid ${COLORS.borderStrong}`,
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
  },
  tableWrap: {
    overflowX: 'auto',
    border: `1px solid ${COLORS.borderSoft}`,
    borderRadius: 18,
    background: '#fff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 760,
  },
  th: {
    textAlign: 'left',
    background: COLORS.surfaceAlt,
    color: COLORS.textSoft,
    fontSize: 13,
    fontWeight: 700,
    padding: '12px 14px',
    borderBottom: `1px solid ${COLORS.border}`,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '13px 14px',
    borderBottom: `1px solid ${COLORS.borderSoft}`,
    color: COLORS.textSoft,
    fontSize: 14,
    verticalAlign: 'middle',
    background: '#fff',
  },
  tdStrong: {
    padding: '13px 14px',
    borderBottom: `1px solid ${COLORS.borderSoft}`,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 700,
    verticalAlign: 'middle',
    background: '#fff',
  },
  emptyCell: {
    padding: '22px 16px',
    textAlign: 'center',
    color: COLORS.textSoft,
    background: '#fff',
  },
  statusOk: {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: 999,
    background: COLORS.greenSoft,
    color: COLORS.greenDark,
    fontSize: 12,
    fontWeight: 700,
  },
  statusWarn: {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: 999,
    background: COLORS.amberSoft,
    color: COLORS.amber,
    fontSize: 12,
    fontWeight: 700,
  },
  statusDanger: {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: 999,
    background: COLORS.redSoft,
    color: COLORS.red,
    fontSize: 12,
    fontWeight: 700,
  },
  field: {
    display: 'grid',
    gap: 7,
  },
  fieldLabel: {
    fontSize: 13,
    color: COLORS.textSoft,
    fontWeight: 700,
  },
  input: {
    width: '100%',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    padding: '12px 13px',
    fontSize: 14,
    color: COLORS.text,
    background: '#fff',
    outline: 'none',
    boxShadow: 'inset 0 1px 2px rgba(17, 24, 39, 0.03)',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.22)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modalCard: {
    width: 'min(1100px, 100%)',
    maxHeight: '90vh',
    overflow: 'auto',
    background: COLORS.surface,
    borderRadius: 26,
    border: `1px solid ${COLORS.border}`,
    boxShadow: COLORS.shadowStrong,
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    padding: '22px 22px 0',
  },
  modalTitle: {
    margin: 0,
    color: COLORS.text,
    fontSize: 26,
  },
  modalSubtitle: {
    margin: '6px 0 0',
    color: COLORS.textSoft,
  },
  iconButton: {
    border: `1px solid ${COLORS.border}`,
    background: '#fff',
    color: COLORS.textSoft,
    width: 40,
    height: 40,
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: 16,
  },
  modalBody: {
    padding: 22,
    display: 'grid',
    gap: 14,
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 12,
    alignItems: 'end',
  },
  rowCard: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 18,
    background: COLORS.surfaceAlt,
    padding: 16,
    display: 'grid',
    gap: 14,
  },
  rowCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  rowCardTitle: {
    color: COLORS.text,
    fontSize: 15,
  },
  addLineButton: {
    border: `1px dashed ${COLORS.green}`,
    background: COLORS.greenSofter,
    color: COLORS.greenDark,
    borderRadius: 16,
    padding: '14px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    padding: '0 22px 22px',
    flexWrap: 'wrap',
  },
  infoTile: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: '12px 14px',
    background: '#fff',
    minHeight: 48,
    display: 'grid',
    alignContent: 'center',
    gap: 4,
  },
  infoTileLabel: {
    color: COLORS.textSoft,
    fontSize: 12,
    fontWeight: 700,
  },
  infoTileValue: {
    color: COLORS.text,
    fontSize: 16,
  },
}