'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  BedDouble,
  Boxes,
  ClipboardList,
  PackageOpen,
  Pill,
  Plus,
  Search,
  ShieldCheck,
  Shirt,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

type InventoryCategory =
  | 'diapers'
  | 'bedding'
  | 'cleaning'
  | 'medication'
  | 'uniforms'
  | 'other'

type StockFilter = '' | 'ok' | 'low' | 'empty'
type LogTypeFilter = '' | 'in' | 'out' | 'adjustment'

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

type PersonOption = {
  id: string
  label: string
}

type CategoryMeta = {
  code: InventoryCategory
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
}

type Option = {
  value: string
  label: string
}

type AddForm = {
  name: string
  category: InventoryCategory
  subcategory: string
  size: string
  unit: string
  quantity: string
  minQuantity: string
}

type IssueLine = {
  itemId: string
  targetId: string
  quantity: string
  notes: string
}

type RefillLine = {
  itemId: string
  quantity: string
  notes: string
}

const CATEGORIES: CategoryMeta[] = [
  {
    code: 'diapers',
    title: 'Sauskelnės',
    description: 'Dydžiai, likučiai ir nurašymai gyventojams.',
    href: '/inventory/diapers',
    icon: PackageOpen,
  },
  {
    code: 'bedding',
    title: 'Patalynė',
    description: 'Komplektai, paklodės, užvalkalai ir judėjimas.',
    href: '/inventory/bedding',
    icon: BedDouble,
  },
  {
    code: 'cleaning',
    title: 'Valymo priemonės',
    description: 'Valymo priemonių atsargos ir sunaudojimas.',
    href: '/inventory/cleaning',
    icon: Sparkles,
  },
  {
    code: 'medication',
    title: 'Vaistai',
    description: 'Vaistų likučiai, papildymai ir nurašymai.',
    href: '/inventory/medication',
    icon: Pill,
  },
  {
    code: 'uniforms',
    title: 'Darbuotojų uniformos',
    description: 'Darbuotojų apranga, dydžiai ir išdavimai.',
    href: '/inventory/uniforms',
    icon: Shirt,
  },
  {
    code: 'other',
    title: 'Kita',
    description: 'Kitos sandėlio prekės ir priemonės.',
    href: '/inventory/other',
    icon: Boxes,
  },
]

const SUBCATEGORY_OPTIONS: Record<InventoryCategory, Option[]> = {
  diapers: [
    { value: 'pants', label: 'Kelnaitės' },
    { value: 'tape', label: 'Juostinės sauskelnės' },
    { value: 'night', label: 'Naktinės sauskelnės' },
    { value: 'insert', label: 'Įklotai' },
    { value: 'underpad', label: 'Paklotai' },
  ],
  bedding: [
    { value: 'set', label: 'Patalynės komplektas' },
    { value: 'sheet', label: 'Paklodė' },
    { value: 'duvet_cover', label: 'Antklodės užvalkalas' },
    { value: 'pillowcase', label: 'Pagalvės užvalkalas' },
    { value: 'blanket', label: 'Antklodė' },
    { value: 'pillow', label: 'Pagalvė' },
    { value: 'towel', label: 'Rankšluostis' },
  ],
  cleaning: [
    { value: 'spray', label: 'Purškiklis' },
    { value: 'liquid', label: 'Skystis' },
    { value: 'powder', label: 'Milteliai' },
    { value: 'gel', label: 'Gelis' },
    { value: 'wipes', label: 'Servetėlės' },
    { value: 'disinfectant', label: 'Dezinfekantas' },
    { value: 'bags', label: 'Maišeliai' },
    { value: 'gloves', label: 'Pirštinės' },
  ],
  medication: [
    { value: 'tablet', label: 'Tabletės' },
    { value: 'capsule', label: 'Kapsulės' },
    { value: 'liquid', label: 'Skystis' },
    { value: 'drops', label: 'Lašai' },
    { value: 'ointment', label: 'Tepalas' },
    { value: 'injection', label: 'Injekcija' },
    { value: 'bandage', label: 'Tvarstis' },
  ],
  uniforms: [
    { value: 'shirt', label: 'Marškinėliai' },
    { value: 'pants', label: 'Kelnės' },
    { value: 'jacket', label: 'Švarkas / džemperis' },
    { value: 'robe', label: 'Chalatas' },
    { value: 'shoes', label: 'Avalynė' },
    { value: 'apron', label: 'Prijuostė' },
  ],
  other: [
    { value: 'general', label: 'Bendra prekė' },
    { value: 'equipment', label: 'Įranga' },
    { value: 'office', label: 'Kanceliarinės prekės' },
    { value: 'hygiene', label: 'Higienos priemonės' },
  ],
}

const SIZE_OPTIONS: Partial<Record<InventoryCategory, string[]>> = {
  diapers: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  bedding: ['60x120', '80x160', '90x200', '140x200', '160x200', '200x220'],
  uniforms: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '36', '38', '40', '42', '44', '46'],
}

const DEFAULT_ADD_FORM: AddForm = {
  name: '',
  category: 'diapers',
  subcategory: 'pants',
  size: 'M',
  unit: 'vnt.',
  quantity: '0',
  minQuantity: '0',
}

const DEFAULT_ISSUE_LINE: IssueLine = {
  itemId: '',
  targetId: '',
  quantity: '1',
  notes: '',
}

const DEFAULT_REFILL_LINE: RefillLine = {
  itemId: '',
  quantity: '1',
  notes: '',
}

function getReadableError(error: unknown) {
  if (!error) return 'Nepavyko įvykdyti veiksmo.'
  if (error instanceof Error) return error.message

  if (typeof error === 'object') {
    const e = error as { message?: string; details?: string; hint?: string; code?: string }
    if (e.message) return e.message
    if (e.details) return e.details
    if (e.hint) return e.hint
    if (e.code) return `Klaidos kodas: ${e.code}`
  }

  return 'Nepavyko įvykdyti veiksmo.'
}

function shouldShowSize(category: InventoryCategory) {
  return category === 'diapers' || category === 'bedding' || category === 'uniforms'
}

function getSizeLabel(category: InventoryCategory) {
  if (category === 'bedding') return 'Matmuo'
  return 'Dydis'
}

function getSizePlaceholder(category: InventoryCategory) {
  if (category === 'bedding') return 'Pvz. 90x200'
  if (category === 'uniforms') return 'Pvz. M arba 42'
  return 'Pvz. M'
}

function getDefaultSubcategory(category: InventoryCategory) {
  return SUBCATEGORY_OPTIONS[category]?.[0]?.value || ''
}

function getDefaultSize(category: InventoryCategory) {
  return SIZE_OPTIONS[category]?.[0] || ''
}

function getStockStatus(quantity: number | null, minQuantity: number | null): StockFilter {
  const q = Number(quantity || 0)
  if (q <= 0) return 'empty'
  if (minQuantity !== null && minQuantity !== undefined && q <= Number(minQuantity)) return 'low'
  return 'ok'
}

function getStockLabel(status: string) {
  if (status === 'empty') return 'Pasibaigė'
  if (status === 'low') return 'Baigiasi'
  return 'Tvarkoje'
}

function getCategoryTitle(category: string | null) {
  return CATEGORIES.find((item) => item.code === category)?.title || 'Kita'
}

function getSubcategoryLabel(category: string | null, subcategory: string | null) {
  if (!subcategory) return '—'
  const options = SUBCATEGORY_OPTIONS[(category || 'other') as InventoryCategory] || []
  return options.find((option) => option.value === subcategory)?.label || subcategory
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('lt-LT')
}

function formatQuantity(quantity: number | null, unit: string | null) {
  return `${Number(quantity || 0)} ${unit || 'vnt.'}`
}

function isUniformItem(item: InventoryItem | null | undefined) {
  return item?.category === 'uniforms'
}

export default function InventoryPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const [items, setItems] = useState<InventoryItem[]>([])
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [residents, setResidents] = useState<PersonOption[]>([])
  const [employees, setEmployees] = useState<PersonOption[]>([])

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('')
  const [logTypeFilter, setLogTypeFilter] = useState<LogTypeFilter>('')
  const [residentHistoryFilter, setResidentHistoryFilter] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [showRefillModal, setShowRefillModal] = useState(false)

  const [addForms, setAddForms] = useState<AddForm[]>([DEFAULT_ADD_FORM])
  const [issueLines, setIssueLines] = useState<IssueLine[]>([DEFAULT_ISSUE_LINE])
  const [refillLines, setRefillLines] = useState<RefillLine[]>([DEFAULT_REFILL_LINE])

  useEffect(() => {
    void loadInventory()
  }, [])

  async function loadInventory() {
    try {
      setLoading(true)
      setMessage('')

      const orgId = await getCurrentOrganizationId()

      if (!orgId) {
        setOrganizationId(null)
        setMessage('Nepavyko nustatyti aktyvios įstaigos.')
        setItems([])
        setLogs([])
        setResidents([])
        setEmployees([])
        return
      }

      setOrganizationId(orgId)

      const [itemsResult, logsResult, residentsResult, membersResult] = await Promise.all([
        supabase
          .from('inventory_items')
          .select(
            'id, organization_id, name, unit, quantity, category, subcategory, size, min_quantity, is_active, created_at, updated_at'
          )
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false }),

        supabase
          .from('inventory_issue_history_view')
          .select(
            'id, organization_id, item_id, item_name, category, subcategory, size, unit, resident_id, resident_code, employee_user_id, employee_full_name, quantity, type, notes, created_at'
          )
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(200),

        supabase
          .from('residents')
          .select('id, first_name, last_name, full_name')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false }),

        supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', orgId)
          .eq('is_active', true),
      ])

      if (itemsResult.error) throw itemsResult.error
      if (logsResult.error) throw logsResult.error
      if (residentsResult.error) throw residentsResult.error
      if (membersResult.error) throw membersResult.error

      setItems((itemsResult.data || []) as InventoryItem[])
      setLogs((logsResult.data || []) as InventoryLog[])

      setResidents(
        ((residentsResult.data || []) as Record<string, unknown>[]).map((resident) => {
          const firstName = String(resident.first_name || '').trim()
          const lastName = String(resident.last_name || '').trim()
          const fullName = String(resident.full_name || '').trim()

          return {
            id: String(resident.id),
            label: fullName || [firstName, lastName].filter(Boolean).join(' ').trim() || String(resident.id),
          }
        })
      )

      const memberUserIds = ((membersResult.data || []) as Record<string, unknown>[])
        .map((member) => String(member.user_id || '').trim())
        .filter(Boolean)

      if (memberUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, full_name')
          .in('id', memberUserIds)

        if (profilesError) throw profilesError

        setEmployees(
          ((profilesData || []) as Record<string, unknown>[]).map((profile) => {
            const firstName = String(profile.first_name || '').trim()
            const lastName = String(profile.last_name || '').trim()
            const fullName = String(profile.full_name || '').trim()
            const email = String(profile.email || '').trim()

            return {
              id: String(profile.id),
              label: fullName || [firstName, lastName].filter(Boolean).join(' ').trim() || email || String(profile.id),
            }
          })
        )
      } else {
        setEmployees([])
      }
    } catch (error) {
      setMessage(getReadableError(error))
      setItems([])
      setLogs([])
      setResidents([])
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  function openAddModal(category?: InventoryCategory) {
    const selectedCategory = category || 'diapers'
    setAddForms([
      {
        ...DEFAULT_ADD_FORM,
        category: selectedCategory,
        subcategory: getDefaultSubcategory(selectedCategory),
        size: getDefaultSize(selectedCategory),
      },
    ])
    setShowAddModal(true)
    setMessage('')
  }

  function openIssueModal(itemId?: string) {
    setIssueLines([{ ...DEFAULT_ISSUE_LINE, itemId: itemId || '' }])
    setShowIssueModal(true)
    setMessage('')
  }

  function openRefillModal(itemId?: string) {
    setRefillLines([{ ...DEFAULT_REFILL_LINE, itemId: itemId || '' }])
    setShowRefillModal(true)
    setMessage('')
  }

  function updateAddForm(index: number, patch: Partial<AddForm>) {
    setAddForms((prev) =>
      prev.map((form, currentIndex) => {
        if (currentIndex !== index) return form

        if (patch.category) {
          return {
            ...form,
            ...patch,
            subcategory: getDefaultSubcategory(patch.category),
            size: getDefaultSize(patch.category),
          }
        }

        return { ...form, ...patch }
      })
    )
  }

  function updateIssueLine(index: number, patch: Partial<IssueLine>) {
    setIssueLines((prev) =>
      prev.map((line, currentIndex) => (currentIndex === index ? { ...line, ...patch } : line))
    )
  }

  function updateRefillLine(index: number, patch: Partial<RefillLine>) {
    setRefillLines((prev) =>
      prev.map((line, currentIndex) => (currentIndex === index ? { ...line, ...patch } : line))
    )
  }

  async function getActorName() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) return { userId: null, name: null }

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    const profileRecord = (profile || {}) as Record<string, unknown>
    const fullName = String(profileRecord.full_name || '').trim()
    const firstName = String(profileRecord.first_name || '').trim()
    const lastName = String(profileRecord.last_name || '').trim()
    const email = String(profileRecord.email || user.email || '').trim()

    return {
      userId: user.id,
      name: fullName || [firstName, lastName].filter(Boolean).join(' ').trim() || email || null,
    }
  }

  async function createItems() {
    try {
      if (!organizationId) {
        setMessage('Nepavyko nustatyti aktyvios įstaigos.')
        return
      }

      const rows = addForms.map((form) => {
        const cleanName = form.name.trim()
        const cleanUnit = form.unit.trim() || 'vnt.'
        const cleanSubcategory = form.subcategory.trim()
        const cleanSize = shouldShowSize(form.category) ? form.size.trim() : ''
        const quantity = Number(form.quantity || 0)
        const minQuantity = Number(form.minQuantity || 0)

        if (!cleanName) throw new Error('Visų prekių pavadinimai yra privalomi.')
        if (Number.isNaN(quantity) || quantity < 0) throw new Error('Kiekis turi būti teigiamas skaičius.')
        if (Number.isNaN(minQuantity) || minQuantity < 0) {
          throw new Error('Minimalus kiekis turi būti teigiamas skaičius.')
        }

        return {
          organization_id: organizationId,
          name: cleanName,
          category: form.category,
          subcategory: cleanSubcategory || null,
          size: cleanSize || null,
          unit: cleanUnit,
          quantity,
          min_quantity: minQuantity,
          is_active: true,
        }
      })

      setSaving(true)
      setMessage('')

      const { error } = await supabase.from('inventory_items').insert(rows)
      if (error) throw error

      setShowAddModal(false)
      setAddForms([DEFAULT_ADD_FORM])
      setMessage(rows.length === 1 ? 'Prekė sėkmingai pridėta.' : 'Prekės sėkmingai pridėtos.')
      await loadInventory()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSaving(false)
    }
  }

  async function issueItems() {
    try {
      if (!organizationId) {
        setMessage('Nepavyko nustatyti aktyvios įstaigos.')
        return
      }

      const actor = await getActorName()
      const updates: Array<{ item: InventoryItem; newQuantity: number }> = []
      const historyRows: Array<Record<string, unknown>> = []

      for (const line of issueLines) {
        const item = items.find((currentItem) => currentItem.id === line.itemId)
        const quantity = Number(line.quantity || 0)

        if (!item) throw new Error('Kiekvienoje eilutėje pasirink prekę.')
        if (Number.isNaN(quantity) || quantity <= 0) throw new Error('Nurašomas kiekis turi būti didesnis už 0.')

        const currentQuantity = Number(item.quantity || 0)
        if (quantity > currentQuantity) {
          throw new Error(`Prekei "${item.name}" sandėlyje yra tik ${formatQuantity(currentQuantity, item.unit)}.`)
        }

        const targetOptions = isUniformItem(item) ? employees : residents
        const target = targetOptions.find((option) => option.id === line.targetId)

        if (!target) {
          throw new Error(isUniformItem(item) ? 'Uniformoms pasirink darbuotoją.' : 'Pasirink gyventoją.')
        }

        updates.push({
          item,
          newQuantity: currentQuantity - quantity,
        })

        historyRows.push({
          organization_id: organizationId,
          item_id: item.id,
          item_name: item.name,
          category: item.category,
          subcategory: item.subcategory,
          size: item.size,
          unit: item.unit,
          resident_id: isUniformItem(item) ? null : target.id,
          resident_code: isUniformItem(item) ? `Darbuotojas: ${target.label}` : target.label,
          employee_user_id: actor.userId,
          employee_full_name: actor.name,
          quantity,
          type: 'out',
          notes: line.notes.trim() || null,
        })
      }

      setSaving(true)
      setMessage('')

      for (const update of updates) {
        const { error } = await supabase
          .from('inventory_items')
          .update({
            quantity: update.newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', update.item.id)

        if (error) throw error
      }

      const { error: historyError } = await supabase.from('inventory_issue_history').insert(historyRows)
      if (historyError) throw historyError

      setShowIssueModal(false)
      setIssueLines([DEFAULT_ISSUE_LINE])
      setMessage('Prekės sėkmingai nurašytos.')
      await loadInventory()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSaving(false)
    }
  }

  async function refillItems() {
    try {
      if (!organizationId) {
        setMessage('Nepavyko nustatyti aktyvios įstaigos.')
        return
      }

      const actor = await getActorName()
      const updates: Array<{ item: InventoryItem; newQuantity: number }> = []
      const historyRows: Array<Record<string, unknown>> = []

      for (const line of refillLines) {
        const item = items.find((currentItem) => currentItem.id === line.itemId)
        const quantity = Number(line.quantity || 0)

        if (!item) throw new Error('Kiekvienoje eilutėje pasirink prekę.')
        if (Number.isNaN(quantity) || quantity <= 0) throw new Error('Papildomas kiekis turi būti didesnis už 0.')

        const currentQuantity = Number(item.quantity || 0)

        updates.push({
          item,
          newQuantity: currentQuantity + quantity,
        })

        historyRows.push({
          organization_id: organizationId,
          item_id: item.id,
          item_name: item.name,
          category: item.category,
          subcategory: item.subcategory,
          size: item.size,
          unit: item.unit,
          resident_id: null,
          resident_code: null,
          employee_user_id: actor.userId,
          employee_full_name: actor.name,
          quantity,
          type: 'in',
          notes: line.notes.trim() || null,
        })
      }

      setSaving(true)
      setMessage('')

      for (const update of updates) {
        const { error } = await supabase
          .from('inventory_items')
          .update({
            quantity: update.newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', update.item.id)

        if (error) throw error
      }

      const { error: historyError } = await supabase.from('inventory_issue_history').insert(historyRows)
      if (historyError) throw historyError

      setShowRefillModal(false)
      setRefillLines([DEFAULT_REFILL_LINE])
      setMessage('Sandėlis sėkmingai papildytas.')
      await loadInventory()
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSaving(false)
    }
  }

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return CATEGORIES

    return CATEGORIES.filter((category) =>
      [category.title, category.description, category.code].join(' ').toLowerCase().includes(q)
    )
  }, [search])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()

    return items.filter((item) => {
      const matchesSearch = q
        ? [
            item.name || '',
            getCategoryTitle(item.category),
            getSubcategoryLabel(item.category, item.subcategory),
            item.size || '',
            item.unit || '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(q)
        : true

      const matchesCategory = categoryFilter ? item.category === categoryFilter : true
      const matchesStock = stockFilter ? getStockStatus(item.quantity, item.min_quantity) === stockFilter : true

      return matchesSearch && matchesCategory && matchesStock
    })
  }, [items, search, categoryFilter, stockFilter])

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase()

    return logs.filter((log) => {
      const matchesSearch = q
        ? [
            log.item_name || '',
            getCategoryTitle(log.category),
            getSubcategoryLabel(log.category, log.subcategory),
            log.size || '',
            log.resident_code || '',
            log.employee_full_name || '',
            log.notes || '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(q)
        : true

      const matchesCategory = categoryFilter ? log.category === categoryFilter : true
      const matchesType = logTypeFilter ? log.type === logTypeFilter : true
      const matchesResident = residentHistoryFilter ? log.resident_id === residentHistoryFilter : true

      return matchesSearch && matchesCategory && matchesType && matchesResident
    })
  }, [logs, search, categoryFilter, logTypeFilter, residentHistoryFilter])

  const categoryStats = useMemo(() => {
    return CATEGORIES.reduce(
      (acc, category) => {
        const categoryItems = items.filter((item) => item.category === category.code)
        const totalQuantity = categoryItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
        const low = categoryItems.filter((item) => getStockStatus(item.quantity, item.min_quantity) === 'low').length
        const empty = categoryItems.filter((item) => getStockStatus(item.quantity, item.min_quantity) === 'empty').length

        acc[category.code] = {
          items: categoryItems.length,
          quantity: totalQuantity,
          low,
          empty,
        }

        return acc
      },
      {} as Record<InventoryCategory, { items: number; quantity: number; low: number; empty: number }>
    )
  }, [items])

  const globalStats = useMemo(() => {
    const totalItems = items.length
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    const low = items.filter((item) => getStockStatus(item.quantity, item.min_quantity) === 'low').length
    const empty = items.filter((item) => getStockStatus(item.quantity, item.min_quantity) === 'empty').length
    const movements = logs.length
    const out = logs.filter((log) => log.type === 'out').length
    const incoming = logs.filter((log) => log.type === 'in').length

    return {
      totalItems,
      totalQuantity,
      low,
      empty,
      movements,
      out,
      incoming,
    }
  }, [items, logs])

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Sandėlių valdymas</div>
          <h1 style={styles.title}>Sandėlis</h1>
          <p style={styles.subtitle}>
            Valdyk prekių likučius, stebėk judėjimą ir greitai pasiek kiekvieną kategoriją.
          </p>
        </div>

        <div style={styles.heroActions}>
          <button type="button" onClick={() => openAddModal()} style={styles.secondaryButton}>
            <Plus size={16} /> Pridėti prekes
          </button>

          <button type="button" onClick={() => openRefillModal()} style={styles.secondaryButton}>
            <ArrowUpCircle size={16} /> Papildyti
          </button>

          <button type="button" onClick={() => openIssueModal()} style={styles.primaryButton}>
            <Trash2 size={16} /> Nurašyti
          </button>
        </div>
      </section>

      {message ? <div style={styles.message}>{message}</div> : null}

      <section style={styles.statsGrid}>
        <StatCard label="Skirtingų prekių" value={globalStats.totalItems} onClick={() => setStockFilter('')} active={!stockFilter} />
        <StatCard label="Bendras kiekis" value={globalStats.totalQuantity} onClick={() => setStockFilter('')} active={!stockFilter} />
        <StatCard label="Baigiasi" value={globalStats.low} tone="warning" onClick={() => setStockFilter((prev) => (prev === 'low' ? '' : 'low'))} active={stockFilter === 'low'} />
        <StatCard label="Pasibaigė" value={globalStats.empty} tone="danger" onClick={() => setStockFilter((prev) => (prev === 'empty' ? '' : 'empty'))} active={stockFilter === 'empty'} />
        <StatCard label="Judėjimų" value={globalStats.movements} onClick={() => setLogTypeFilter('')} active={!logTypeFilter} />
        <StatCard label="Nurašymų" value={globalStats.out} tone="green" onClick={() => setLogTypeFilter((prev) => (prev === 'out' ? '' : 'out'))} active={logTypeFilter === 'out'} />
        <StatCard label="Papildymų" value={globalStats.incoming} onClick={() => setLogTypeFilter((prev) => (prev === 'in' ? '' : 'in'))} active={logTypeFilter === 'in'} />
      </section>

      <section style={styles.toolbar}>
        <Field label="Paieška">
          <div style={styles.searchBox}>
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Prekė, kategorija, gyventojas..."
              style={styles.searchInput}
            />
          </div>
        </Field>

        <Field label="Kategorija">
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} style={styles.input}>
            <option value="">Visos</option>
            {CATEGORIES.map((category) => (
              <option key={category.code} value={category.code}>
                {category.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Likutis">
          <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as StockFilter)} style={styles.input}>
            <option value="">Visi</option>
            <option value="ok">Tvarkoje</option>
            <option value="low">Baigiasi</option>
            <option value="empty">Pasibaigė</option>
          </select>
        </Field>

        <Field label="Gyventojas istorijoje">
          <select
            value={residentHistoryFilter}
            onChange={(event) => setResidentHistoryFilter(event.target.value)}
            style={styles.input}
          >
            <option value="">Visi</option>
            {residents.map((resident) => (
              <option key={resident.id} value={resident.id}>
                {resident.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Operacija istorijoje">
          <select value={logTypeFilter} onChange={(event) => setLogTypeFilter(event.target.value as LogTypeFilter)} style={styles.input}>
            <option value="">Visos</option>
            <option value="out">Nurašymai</option>
            <option value="in">Papildymai</option>
            <option value="adjustment">Koregavimai</option>
          </select>
        </Field>

        <button type="button" onClick={() => void loadInventory()} style={styles.refreshButton}>
          Atnaujinti
        </button>
      </section>

      <section style={styles.categoryGrid}>
        {filteredCategories.map((category) => {
          const Icon = category.icon
          const stats = categoryStats[category.code]
          const status = stats.empty > 0 ? 'empty' : stats.low > 0 ? 'low' : stats.items > 0 ? 'ok' : 'none'

          return (
            <article key={category.code} style={styles.categoryCard}>
              <div style={styles.categoryTop}>
                <div style={styles.categoryIcon}>
                  <Icon size={23} strokeWidth={2.2} />
                </div>

                <span style={{ ...styles.categoryStatus, ...getCategoryStatusStyle(status) }}>
                  {status === 'none' ? 'Nėra prekių' : getStockLabel(status)}
                </span>
              </div>

              <div>
                <h2 style={styles.categoryTitle}>{category.title}</h2>
                <p style={styles.categoryDescription}>{category.description}</p>
              </div>

              <div style={styles.categoryStats}>
                <div style={styles.categoryStatItem}>
                  <strong style={styles.categoryStatNumber}>{stats.items}</strong>
                  <span style={styles.categoryStatLabel}>Prekių</span>
                </div>

                <div style={styles.categoryStatItem}>
                  <strong style={styles.categoryStatNumber}>{stats.quantity}</strong>
                  <span style={styles.categoryStatLabel}>Kiekis</span>
                </div>

                <div style={styles.categoryStatItem}>
                  <strong style={styles.categoryStatNumber}>{stats.low + stats.empty}</strong>
                  <span style={styles.categoryStatLabel}>Rizika</span>
                </div>
              </div>

              <div style={styles.categoryActions}>
                <button type="button" onClick={() => openAddModal(category.code)} style={styles.categoryAddButton}>
                  <Plus size={15} /> Pridėti
                </button>

                <Link href={category.href} style={styles.cardFooter}>
                  Atidaryti <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          )
        })}
      </section>

      <section style={styles.bottomGrid}>
        <DataCard title="Likučiai" meta={`Rodoma prekių: ${filteredItems.length}`}>
          {loading ? (
            <EmptyState text="Kraunama..." />
          ) : filteredItems.length === 0 ? (
            <EmptyState text="Prekių nerasta." />
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Prekė</th>
                    <th style={styles.th}>Kategorija</th>
                    <th style={styles.th}>Tipas</th>
                    <th style={styles.th}>Dydis / matmuo</th>
                    <th style={styles.th}>Kiekis</th>
                    <th style={styles.th}>Min.</th>
                    <th style={styles.th}>Būsena</th>
                    <th style={styles.th}>Veiksmai</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} style={styles.tr}>
                      <td style={styles.tdBold}>{item.name}</td>
                      <td style={styles.td}>{getCategoryTitle(item.category)}</td>
                      <td style={styles.td}>{getSubcategoryLabel(item.category, item.subcategory)}</td>
                      <td style={styles.td}>{item.size || '—'}</td>
                      <td style={styles.td}>{formatQuantity(item.quantity, item.unit)}</td>
                      <td style={styles.td}>
                        {item.min_quantity !== null && item.min_quantity !== undefined
                          ? formatQuantity(item.min_quantity, item.unit)
                          : '—'}
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.statusBadge, ...getCategoryStatusStyle(getStockStatus(item.quantity, item.min_quantity)) }}>
                          {getStockLabel(getStockStatus(item.quantity, item.min_quantity))}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.inlineActions}>
                          <button type="button" onClick={() => openRefillModal(item.id)} style={styles.inlineGreenButton}>
                            Papildyti
                          </button>
                          <button type="button" onClick={() => openIssueModal(item.id)} style={styles.inlineDangerButton}>
                            Nurašyti
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataCard>

        <DataCard title="Paskutiniai judėjimai" meta={`Rodoma įrašų: ${filteredLogs.length}`}>
          {loading ? (
            <EmptyState text="Kraunama..." />
          ) : filteredLogs.length === 0 ? (
            <EmptyState text="Judėjimų nerasta." />
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.historyTable}>
                <thead>
                  <tr>
                    <th style={styles.th}>Data</th>
                    <th style={styles.th}>Prekė</th>
                    <th style={styles.th}>Operacija</th>
                    <th style={styles.th}>Kiekis</th>
                    <th style={styles.th}>Kam</th>
                    <th style={styles.th}>Darbuotojas</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} style={styles.tr}>
                      <td style={styles.td}>{formatDate(log.created_at)}</td>
                      <td style={styles.tdBold}>{log.item_name || '—'}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.logBadge, ...(log.type === 'in' ? styles.inBadge : styles.outBadge) }}>
                          {log.type === 'in' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                          {log.type === 'in' ? 'Papildymas' : log.type === 'out' ? 'Nurašymas' : 'Koregavimas'}
                        </span>
                      </td>
                      <td style={styles.td}>{formatQuantity(log.quantity, log.unit)}</td>
                      <td style={styles.td}>{log.resident_code || '—'}</td>
                      <td style={styles.td}>{log.employee_full_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataCard>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>Sistemos būsena</h2>
            <p style={styles.cardSubtitle}>Greita sandėlio modulio patikra.</p>
          </div>

          <ShieldCheck size={22} color="#047857" />
        </div>

        <div style={styles.statusList}>
          <div style={styles.statusItem}>
            <span style={styles.statusDot} />
            Likučių apskaita aktyvi
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusDot} />
            Judėjimo istorija įjungta
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusDot} />
            Multi nurašymas ir papildymas aktyvus
          </div>
        </div>
      </section>

      {showAddModal ? (
        <MultiAddModal
          forms={addForms}
          saving={saving}
          onClose={() => {
            if (!saving) setShowAddModal(false)
          }}
          onChange={updateAddForm}
          onAddLine={() =>
            setAddForms((prev) => [
              ...prev,
              {
                ...DEFAULT_ADD_FORM,
                subcategory: getDefaultSubcategory(DEFAULT_ADD_FORM.category),
                size: getDefaultSize(DEFAULT_ADD_FORM.category),
              },
            ])
          }
          onRemoveLine={(index) => setAddForms((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
          onSubmit={() => void createItems()}
        />
      ) : null}

      {showIssueModal ? (
        <MultiIssueModal
          title="Nurašyti"
          lines={issueLines}
          items={items}
          residents={residents}
          employees={employees}
          saving={saving}
          onClose={() => {
            if (!saving) setShowIssueModal(false)
          }}
          onChange={updateIssueLine}
          onAddLine={() => setIssueLines((prev) => [...prev, DEFAULT_ISSUE_LINE])}
          onRemoveLine={(index) => setIssueLines((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
          onSubmit={() => void issueItems()}
        />
      ) : null}

      {showRefillModal ? (
        <MultiRefillModal
          lines={refillLines}
          items={items}
          saving={saving}
          onClose={() => {
            if (!saving) setShowRefillModal(false)
          }}
          onChange={updateRefillLine}
          onAddLine={() => setRefillLines((prev) => [...prev, DEFAULT_REFILL_LINE])}
          onRemoveLine={(index) => setRefillLines((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
          onSubmit={() => void refillItems()}
        />
      ) : null}
    </div>
  )
}

function MultiAddModal({
  forms,
  saving,
  onClose,
  onChange,
  onAddLine,
  onRemoveLine,
  onSubmit,
}: {
  forms: AddForm[]
  saving: boolean
  onClose: () => void
  onChange: (index: number, patch: Partial<AddForm>) => void
  onAddLine: () => void
  onRemoveLine: (index: number) => void
  onSubmit: () => void
}) {
  return (
    <Modal title="Pridėti prekes" subtitle="Gali pridėti kelias skirtingas prekes vienu kartu." onClose={onClose}>
      <div style={styles.multiLines}>
        {forms.map((form, index) => (
          <div key={index} style={styles.multiLine}>
            <Field label="Pavadinimas *">
              <input
                value={form.name}
                onChange={(event) => onChange(index, { name: event.target.value })}
                placeholder="Pvz. Pampers M"
                style={styles.input}
              />
            </Field>

            <Field label="Kategorija">
              <select value={form.category} onChange={(event) => onChange(index, { category: event.target.value as InventoryCategory })} style={styles.input}>
                {CATEGORIES.map((category) => (
                  <option key={category.code} value={category.code}>
                    {category.title}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tipas">
              <select value={form.subcategory} onChange={(event) => onChange(index, { subcategory: event.target.value })} style={styles.input}>
                {SUBCATEGORY_OPTIONS[form.category].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            {shouldShowSize(form.category) ? (
              <Field label={getSizeLabel(form.category)}>
                <input
                  value={form.size}
                  onChange={(event) => onChange(index, { size: event.target.value })}
                  placeholder={getSizePlaceholder(form.category)}
                  list={`size-options-${form.category}-${index}`}
                  style={styles.input}
                />
                <datalist id={`size-options-${form.category}-${index}`}>
                  {(SIZE_OPTIONS[form.category] || []).map((size) => (
                    <option key={size} value={size} />
                  ))}
                </datalist>
              </Field>
            ) : null}

            <Field label="Vienetas">
              <input value={form.unit} onChange={(event) => onChange(index, { unit: event.target.value })} style={styles.input} />
            </Field>

            <Field label="Kiekis">
              <input type="number" min="0" value={form.quantity} onChange={(event) => onChange(index, { quantity: event.target.value })} style={styles.input} />
            </Field>

            <Field label="Min. kiekis">
              <input type="number" min="0" value={form.minQuantity} onChange={(event) => onChange(index, { minQuantity: event.target.value })} style={styles.input} />
            </Field>

            {forms.length > 1 ? (
              <button type="button" onClick={() => onRemoveLine(index)} style={styles.removeLineButton}>
                Pašalinti
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div style={styles.modalActions}>
        <button type="button" onClick={onAddLine} style={styles.secondaryButton}>
          <Plus size={16} /> Pridėti eilutę
        </button>
        <button type="button" onClick={onClose} style={styles.cancelButton}>
          Atšaukti
        </button>
        <button type="button" onClick={onSubmit} disabled={saving} style={styles.saveButton}>
          {saving ? 'Saugoma...' : 'Išsaugoti'}
        </button>
      </div>
    </Modal>
  )
}

function MultiIssueModal({
  title,
  lines,
  items,
  residents,
  employees,
  saving,
  onClose,
  onChange,
  onAddLine,
  onRemoveLine,
  onSubmit,
}: {
  title: string
  lines: IssueLine[]
  items: InventoryItem[]
  residents: PersonOption[]
  employees: PersonOption[]
  saving: boolean
  onClose: () => void
  onChange: (index: number, patch: Partial<IssueLine>) => void
  onAddLine: () => void
  onRemoveLine: (index: number) => void
  onSubmit: () => void
}) {
  return (
    <Modal title={title} subtitle="Gali nurašyti kelias prekes vienu kartu. Uniformos priskiriamos darbuotojams." onClose={onClose}>
      <div style={styles.multiLines}>
        {lines.map((line, index) => {
          const selectedItem = items.find((item) => item.id === line.itemId) || null
          const targetOptions = isUniformItem(selectedItem) ? employees : residents

          return (
            <div key={index} style={styles.multiLine}>
              <Field label="Prekė *">
                <select value={line.itemId} onChange={(event) => onChange(index, { itemId: event.target.value, targetId: '' })} style={styles.input}>
                  <option value="">Pasirink prekę</option>
                  {items
                    .filter((item) => Number(item.quantity || 0) > 0)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {formatQuantity(item.quantity, item.unit)}
                      </option>
                    ))}
                </select>
              </Field>

              <Field label={isUniformItem(selectedItem) ? 'Darbuotojas *' : 'Gyventojas *'}>
                <select value={line.targetId} onChange={(event) => onChange(index, { targetId: event.target.value })} style={styles.input}>
                  <option value="">Pasirink</option>
                  {targetOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Kiekis *">
                <input
                  type="number"
                  min="1"
                  max={selectedItem ? Number(selectedItem.quantity || 0) : undefined}
                  value={line.quantity}
                  onChange={(event) => onChange(index, { quantity: event.target.value })}
                  style={styles.input}
                />
              </Field>

              <Field label="Pastaba">
                <input value={line.notes} onChange={(event) => onChange(index, { notes: event.target.value })} style={styles.input} />
              </Field>

              {selectedItem ? <div style={styles.issueInfo}>Sandėlyje: <strong>{formatQuantity(selectedItem.quantity, selectedItem.unit)}</strong></div> : null}

              {lines.length > 1 ? (
                <button type="button" onClick={() => onRemoveLine(index)} style={styles.removeLineButton}>
                  Pašalinti
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      <div style={styles.modalActions}>
        <button type="button" onClick={onAddLine} style={styles.secondaryButton}>
          <Plus size={16} /> Pridėti eilutę
        </button>
        <button type="button" onClick={onClose} style={styles.cancelButton}>
          Atšaukti
        </button>
        <button type="button" onClick={onSubmit} disabled={saving} style={styles.dangerSaveButton}>
          {saving ? 'Saugoma...' : 'Nurašyti'}
        </button>
      </div>
    </Modal>
  )
}

function MultiRefillModal({
  lines,
  items,
  saving,
  onClose,
  onChange,
  onAddLine,
  onRemoveLine,
  onSubmit,
}: {
  lines: RefillLine[]
  items: InventoryItem[]
  saving: boolean
  onClose: () => void
  onChange: (index: number, patch: Partial<RefillLine>) => void
  onAddLine: () => void
  onRemoveLine: (index: number) => void
  onSubmit: () => void
}) {
  return (
    <Modal title="Papildyti sandėlį" subtitle="Gali papildyti kelias prekes vienu kartu." onClose={onClose}>
      <div style={styles.multiLines}>
        {lines.map((line, index) => {
          const selectedItem = items.find((item) => item.id === line.itemId) || null

          return (
            <div key={index} style={styles.multiLine}>
              <Field label="Prekė *">
                <select value={line.itemId} onChange={(event) => onChange(index, { itemId: event.target.value })} style={styles.input}>
                  <option value="">Pasirink prekę</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {formatQuantity(item.quantity, item.unit)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Kiekis *">
                <input type="number" min="1" value={line.quantity} onChange={(event) => onChange(index, { quantity: event.target.value })} style={styles.input} />
              </Field>

              <Field label="Pastaba">
                <input value={line.notes} onChange={(event) => onChange(index, { notes: event.target.value })} placeholder="Pvz. gauta iš tiekėjo" style={styles.input} />
              </Field>

              {selectedItem ? <div style={styles.issueInfo}>Dabar: <strong>{formatQuantity(selectedItem.quantity, selectedItem.unit)}</strong></div> : null}

              {lines.length > 1 ? (
                <button type="button" onClick={() => onRemoveLine(index)} style={styles.removeLineButton}>
                  Pašalinti
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      <div style={styles.modalActions}>
        <button type="button" onClick={onAddLine} style={styles.secondaryButton}>
          <Plus size={16} /> Pridėti eilutę
        </button>
        <button type="button" onClick={onClose} style={styles.cancelButton}>
          Atšaukti
        </button>
        <button type="button" onClick={onSubmit} disabled={saving} style={styles.saveButton}>
          {saving ? 'Saugoma...' : 'Papildyti'}
        </button>
      </div>
    </Modal>
  )
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string
  subtitle: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h2 style={styles.modalTitle}>{title}</h2>
            <p style={styles.modalSubtitle}>{subtitle}</p>
          </div>

          <button type="button" onClick={onClose} style={styles.iconButton}>
            <X size={18} />
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
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  )
}

function StatCard({
  label,
  value,
  tone = 'default',
  active = false,
  onClick,
}: {
  label: string
  value: number
  tone?: 'default' | 'warning' | 'danger' | 'green'
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.statCard,
        ...(tone === 'warning' ? styles.warningStat : {}),
        ...(tone === 'danger' ? styles.dangerStat : {}),
        ...(tone === 'green' ? styles.greenStat : {}),
        ...(active ? styles.activeStat : {}),
      }}
    >
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </button>
  )
}

function DataCard({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: ReactNode
}) {
  return (
    <section style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <h2 style={styles.cardTitle}>{title}</h2>
          {meta ? <p style={styles.cardSubtitle}>{meta}</p> : null}
        </div>
      </div>

      {children}
    </section>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div style={styles.emptyState}>{text}</div>
}

function getCategoryStatusStyle(status: string): CSSProperties {
  if (status === 'empty') {
    return {
      background: '#fff1f2',
      color: '#be123c',
      border: '1px solid #fecdd3',
    }
  }

  if (status === 'low') {
    return {
      background: '#fffbeb',
      color: '#b45309',
      border: '1px solid #fde68a',
    }
  }

  if (status === 'none') {
    return {
      background: '#f8fafc',
      color: '#64748b',
      border: '1px solid #e2e8f0',
    }
  }

  return {
    background: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0',
  }
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: 'grid',
    gap: 18,
  },
  hero: {
    background:
      'radial-gradient(circle at top left, rgba(34,197,94,0.12), transparent 34%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    border: '1px solid #e5e7eb',
    borderRadius: 24,
    padding: 24,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
    flexWrap: 'wrap',
    boxShadow: '0 18px 48px rgba(15, 23, 42, 0.045)',
  },
  eyebrow: {
    color: '#047857',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  title: {
    margin: '6px 0 0',
    color: '#0f172a',
    fontSize: 34,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: '-0.05em',
  },
  subtitle: {
    margin: '10px 0 0',
    color: '#64748b',
    fontSize: 15,
    fontWeight: 650,
    lineHeight: 1.5,
    maxWidth: 680,
  },
  heroActions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryButton: {
    border: 'none',
    borderRadius: 15,
    padding: '12px 15px',
    background: '#047857',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 850,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 14px 30px rgba(4,120,87,0.18)',
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid #a7f3d0',
    borderRadius: 15,
    padding: '12px 15px',
    background: '#ffffff',
    color: '#047857',
    fontSize: 14,
    fontWeight: 850,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  message: {
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    borderRadius: 16,
    padding: 13,
    fontSize: 14,
    fontWeight: 800,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 12,
  },
  statCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 20,
    padding: 16,
    boxShadow: '0 14px 38px rgba(15, 23, 42, 0.035)',
    textAlign: 'left',
    cursor: 'pointer',
  },
  activeStat: {
    outline: '2px solid #16a34a',
    boxShadow: '0 0 0 4px rgba(22,163,74,0.14)',
  },
  warningStat: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
  },
  dangerStat: {
    background: '#fff1f2',
    border: '1px solid #fecdd3',
  },
  greenStat: {
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
  },
  statValue: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: 950,
    lineHeight: 1,
  },
  statLabel: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 12,
    fontWeight: 850,
  },
  toolbar: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 20,
    padding: 14,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
    alignItems: 'end',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    border: '1px solid #d1d5db',
    borderRadius: 14,
    padding: '0 12px',
    color: '#64748b',
  },
  searchInput: {
    width: '100%',
    border: 'none',
    outline: 'none',
    padding: '11px 0',
    fontSize: 14,
    background: 'transparent',
  },
  refreshButton: {
    border: '1px solid #d1d5db',
    borderRadius: 14,
    background: '#ffffff',
    color: '#0f172a',
    padding: '11px 14px',
    fontSize: 14,
    fontWeight: 850,
    cursor: 'pointer',
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 14,
  },
  categoryCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 24,
    padding: 18,
    minHeight: 225,
    display: 'grid',
    gap: 16,
    boxShadow: '0 16px 44px rgba(15, 23, 42, 0.035)',
  },
  categoryTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    background: '#ecfdf5',
    color: '#047857',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryStatus: {
    padding: '5px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  categoryTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: 19,
    fontWeight: 950,
    letterSpacing: '-0.03em',
  },
  categoryDescription: {
    margin: '7px 0 0',
    color: '#64748b',
    fontSize: 13,
    fontWeight: 650,
    lineHeight: 1.45,
  },
  categoryStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 10,
  },
  categoryStatItem: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
    minWidth: 0,
  },
  categoryStatNumber: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 950,
    lineHeight: 1,
  },
  categoryStatLabel: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: 750,
    whiteSpace: 'nowrap',
  },
  categoryActions: {
    borderTop: '1px solid #f1f5f9',
    paddingTop: 12,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },
  categoryAddButton: {
    border: '1px solid #a7f3d0',
    background: '#ecfdf5',
    color: '#047857',
    borderRadius: 12,
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  cardFooter: {
    color: '#047857',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 900,
    textDecoration: 'none',
  },
  bottomGrid: {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 16,
  alignItems: 'start',
},
  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 24,
    padding: 20,
    boxShadow: '0 16px 44px rgba(15, 23, 42, 0.035)',
    minWidth: 0,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  cardTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: '-0.03em',
  },
  cardSubtitle: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: 13,
    fontWeight: 650,
  },
  emptyState: {
    marginTop: 16,
    padding: 22,
    border: '1px dashed #cbd5e1',
    borderRadius: 16,
    color: '#64748b',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 750,
  },
  tableWrap: {
    marginTop: 14,
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    minWidth: 900,
    borderCollapse: 'collapse',
  },
  historyTable: {
    width: '100%',
    minWidth: 900,
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '11px 10px',
    borderBottom: '1px solid #e5e7eb',
    color: '#64748b',
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '13px 10px',
    color: '#334155',
    fontSize: 13,
    fontWeight: 650,
    verticalAlign: 'middle',
  },
  tdBold: {
    padding: '13px 10px',
    color: '#0f172a',
    fontSize: 13,
    fontWeight: 900,
    verticalAlign: 'middle',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  inlineActions: {
    display: 'flex',
    gap: 7,
    flexWrap: 'wrap',
  },
  inlineGreenButton: {
    border: '1px solid #a7f3d0',
    background: '#ecfdf5',
    color: '#047857',
    borderRadius: 11,
    padding: '7px 9px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
  },
  inlineDangerButton: {
    border: '1px solid #fecdd3',
    background: '#fff1f2',
    color: '#be123c',
    borderRadius: 11,
    padding: '7px 9px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
  },
  logBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  inBadge: {
    background: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0',
  },
  outBadge: {
    background: '#fff1f2',
    color: '#be123c',
    border: '1px solid #fecdd3',
  },
  statusList: {
    marginTop: 18,
    display: 'grid',
    gap: 13,
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#334155',
    fontSize: 14,
    fontWeight: 750,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: '#22c55e',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 100,
  },
  modalCard: {
    width: '100%',
    maxWidth: 1060,
    maxHeight: '92vh',
    overflow: 'auto',
    background: '#ffffff',
    borderRadius: 24,
    padding: 22,
    display: 'grid',
    gap: 18,
    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.25)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
  },
  modalTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: '-0.04em',
  },
  modalSubtitle: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: 14,
    fontWeight: 650,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#0f172a',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiLines: {
    display: 'grid',
    gap: 12,
  },
  multiLine: {
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
    borderRadius: 18,
    padding: 14,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
    alignItems: 'end',
  },
  field: {
    display: 'grid',
    gap: 6,
    minWidth: 0,
  },
  label: {
    color: '#334155',
    fontSize: 12,
    fontWeight: 850,
  },
  input: {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: 13,
    padding: '11px 12px',
    fontSize: 14,
    outline: 'none',
    background: '#ffffff',
    boxSizing: 'border-box',
  },
  issueInfo: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    color: '#334155',
    padding: 12,
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 750,
  },
  removeLineButton: {
    border: '1px solid #fecdd3',
    background: '#fff1f2',
    color: '#be123c',
    borderRadius: 13,
    padding: '11px 12px',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  cancelButton: {
    border: '1px solid #d1d5db',
    borderRadius: 14,
    padding: '11px 14px',
    background: '#ffffff',
    color: '#0f172a',
    fontSize: 14,
    fontWeight: 850,
    cursor: 'pointer',
  },
  saveButton: {
    border: 'none',
    borderRadius: 14,
    padding: '11px 14px',
    background: '#047857',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 850,
    cursor: 'pointer',
  },
  dangerSaveButton: {
    border: 'none',
    borderRadius: 14,
    padding: '11px 14px',
    background: '#dc2626',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 850,
    cursor: 'pointer',
  },
}