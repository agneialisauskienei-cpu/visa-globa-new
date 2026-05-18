'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  BedDouble,
  Boxes,
  PackageOpen,
  Pill,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Shirt,
  Sparkles,
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
  isActive?: boolean
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

type UniformReturnLine = {
  itemId: string
  targetId: string
  quantity: string
  notes: string
}

const CATEGORIES: CategoryMeta[] = [
  {
    code: 'diapers',
    title: 'Sauskelnės',
    description: 'Dydžiai, likučiai ir išdavimai gyventojams.',
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
    description: 'Vaistų likučiai, papildymai ir išdavimai.',
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

const DEFAULT_UNIFORM_RETURN_LINE: UniformReturnLine = {
  itemId: '',
  targetId: '',
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

function isUniformReturnLog(log: InventoryLog) {
  return log.category === 'uniforms' && log.type === 'in' && (log.resident_code || '').startsWith('Grąžino darbuotojas:')
}

function getLogOperationLabel(log: InventoryLog) {
  if (isUniformReturnLog(log)) return 'Grąžinimas'
  if (log.type === 'in') return 'Papildymas'
  if (log.type === 'out') return 'Išdavimas'
  return 'Koregavimas'
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
  const [showUniformIssueModal, setShowUniformIssueModal] = useState(false)
  const [showRefillModal, setShowRefillModal] = useState(false)
  const [showUniformReturnModal, setShowUniformReturnModal] = useState(false)

  const [addForms, setAddForms] = useState<AddForm[]>([DEFAULT_ADD_FORM])
  const [issueLines, setIssueLines] = useState<IssueLine[]>([DEFAULT_ISSUE_LINE])
  const [refillLines, setRefillLines] = useState<RefillLine[]>([DEFAULT_REFILL_LINE])
  const [uniformReturnLines, setUniformReturnLines] = useState<UniformReturnLine[]>([DEFAULT_UNIFORM_RETURN_LINE])

  useEffect(() => {
    void loadInventory()
  }, [])

  async function loadInventory(options: { clearMessage?: boolean } = {}) {
    try {
      const { clearMessage = true } = options
      setLoading(true)
      if (clearMessage) setMessage('')

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
          .select('user_id, is_active')
          .eq('organization_id', orgId),
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
      const memberActivityByUserId = new Map(
        ((membersResult.data || []) as Record<string, unknown>[]).map((member) => [
          String(member.user_id || '').trim(),
          member.is_active !== false,
        ])
      )

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
              label: `${fullName || [firstName, lastName].filter(Boolean).join(' ').trim() || email || String(profile.id)}${memberActivityByUserId.get(String(profile.id)) === false ? ' (neaktyvus)' : ''}`,
              isActive: memberActivityByUserId.get(String(profile.id)) !== false,
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

  function openUniformIssueModal(itemId?: string) {
    setIssueLines([{ ...DEFAULT_ISSUE_LINE, itemId: itemId || '' }])
    setShowUniformIssueModal(true)
    setMessage('')
  }

  function openRefillModal(itemId?: string) {
    setRefillLines([{ ...DEFAULT_REFILL_LINE, itemId: itemId || '' }])
    setShowRefillModal(true)
    setMessage('')
  }

  function openUniformReturnModal(itemId?: string) {
    setUniformReturnLines([{ ...DEFAULT_UNIFORM_RETURN_LINE, itemId: itemId || '' }])
    setShowUniformReturnModal(true)
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

  function updateUniformReturnLine(index: number, patch: Partial<UniformReturnLine>) {
    setUniformReturnLines((prev) =>
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
      const activeOrganizationId = organizationId || (await getCurrentOrganizationId())

      if (!activeOrganizationId) {
        setMessage('Nepavyko nustatyti aktyvios įstaigos.')
        return
      }

      if (!organizationId) setOrganizationId(activeOrganizationId)

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
          organization_id: activeOrganizationId,
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
      await loadInventory({ clearMessage: false })
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

      const uniformIssue = showUniformIssueModal
      const actor = await getActorName()
      const updates: Array<{ item: InventoryItem; newQuantity: number }> = []
      const historyRows: Array<Record<string, unknown>> = []

      for (const line of issueLines) {
        const item = items.find((currentItem) => currentItem.id === line.itemId)
        const quantity = Number(line.quantity || 0)

        if (!item) throw new Error('Kiekvienoje eilutėje pasirink prekę.')
        if (uniformIssue && !isUniformItem(item)) throw new Error('Uniformų išdavime galima rinktis tik uniformas.')
        if (!uniformIssue && isUniformItem(item)) throw new Error('Uniformoms naudok atskirą mygtuką „Išduoti uniformą“.')
        if (Number.isNaN(quantity) || quantity <= 0) throw new Error('Išduodamas kiekis turi būti didesnis už 0.')

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
      setShowUniformIssueModal(false)
      setIssueLines([DEFAULT_ISSUE_LINE])
      setMessage('Prekės sėkmingai išduotos.')
      await loadInventory({ clearMessage: false })
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
      await loadInventory({ clearMessage: false })
    } catch (error) {
      setMessage(getReadableError(error))
    } finally {
      setSaving(false)
    }
  }

  async function returnUniforms() {
    try {
      if (!organizationId) {
        setMessage('Nepavyko nustatyti aktyvios įstaigos.')
        return
      }

      const actor = await getActorName()
      const updates: Array<{ item: InventoryItem; newQuantity: number }> = []
      const historyRows: Array<Record<string, unknown>> = []

      for (const line of uniformReturnLines) {
        const item = items.find((currentItem) => currentItem.id === line.itemId)
        const quantity = Number(line.quantity || 0)
        const employee = employees.find((option) => option.id === line.targetId)

        if (!item) throw new Error('Kiekvienoje eilutėje pasirink uniformą.')
        if (!isUniformItem(item)) throw new Error('Grąžinimui galima rinktis tik uniformas.')
        if (!employee) throw new Error('Pasirink darbuotoją, kuris grąžino uniformą.')
        if (Number.isNaN(quantity) || quantity <= 0) throw new Error('Grąžinamas kiekis turi būti didesnis už 0.')

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
          resident_code: `Grąžino darbuotojas: ${employee.label}`,
          employee_user_id: actor.userId,
          employee_full_name: actor.name,
          quantity,
          type: 'in',
          notes: line.notes.trim() || 'Uniforma grąžinta darbuotojui išėjus iš darbo / pasibaigus naudojimui.',
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

      setShowUniformReturnModal(false)
      setUniformReturnLines([DEFAULT_UNIFORM_RETURN_LINE])
      setMessage('Uniformos sėkmingai grąžintos į sandėlį.')
      await loadInventory({ clearMessage: false })
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

  const riskRows = useMemo(() => {
    const criticalItems = items
      .filter((item) => getStockStatus(item.quantity, item.min_quantity) === 'empty')
      .slice(0, 3)
    const lowItems = items
      .filter((item) => getStockStatus(item.quantity, item.min_quantity) === 'low')
      .slice(0, 3)

    return [
      {
        title: 'Pasibaigusios prekės',
        value: globalStats.empty,
        desc: criticalItems.length
          ? criticalItems.map((item) => item.name).join(', ')
          : 'Kritinių likučių nėra.',
        tone: 'danger' as const,
      },
      {
        title: 'Baigiasi likučiai',
        value: globalStats.low,
        desc: lowItems.length ? lowItems.map((item) => item.name).join(', ') : 'Minimalūs kiekiai nepasiekti.',
        tone: 'warning' as const,
      },
      {
        title: 'Šiandienos veiksmas',
        value: globalStats.empty + globalStats.low,
        desc: globalStats.empty + globalStats.low > 0 ? 'Peržiūrėti rizikas ir papildyti sandėlį.' : 'Sandėlio rizikos suvaldytos.',
        tone: globalStats.empty > 0 ? 'danger' as const : globalStats.low > 0 ? 'warning' as const : 'green' as const,
      },
    ]
  }, [items, globalStats])

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroIcon}>
            <Boxes size={29} strokeWidth={2.2} />
          </div>

          <div>
            <div style={styles.eyebrow}>Sandėlių valdymas</div>
            <h1 style={styles.title}>Sandėlis</h1>
            <p style={styles.subtitle}>
              Valdyk prekių likučius, stebėk judėjimą ir greitai pasiek kiekvieną kategoriją.
            </p>
          </div>
        </div>

        <div style={styles.heroActions}>
          <div style={styles.actionGroup}>
            <button type="button" onClick={() => openAddModal()} style={styles.secondaryButton}>
              <Plus size={16} /> Pridėti prekes
            </button>

            <button type="button" onClick={() => openRefillModal()} style={styles.secondaryButton}>
              <ArrowUpCircle size={16} /> Papildyti prekes
            </button>

            <button type="button" onClick={() => openIssueModal()} style={styles.primaryButton}>
              <Send size={16} /> Išduoti prekes gyventojui
            </button>
          </div>

          <div style={styles.uniformActionGroup}>
            <button type="button" onClick={() => openUniformIssueModal()} style={styles.secondaryButton}>
              <Shirt size={16} /> Išduoti uniformą
            </button>

            <button type="button" onClick={() => openUniformReturnModal()} style={styles.secondaryButton}>
              <ArrowDownCircle size={16} /> Grąžinti uniformą
            </button>
          </div>
        </div>
      </section>

      {message ? <div style={styles.message}>{message}</div> : null}

      <section style={styles.statsGrid}>
        <StatCard label="Skirtingų prekių" value={globalStats.totalItems} onClick={() => setStockFilter('')} active={!stockFilter} />
        <StatCard label="Bendras kiekis" value={globalStats.totalQuantity} onClick={() => setStockFilter('')} active={!stockFilter} />
        <StatCard label="Baigiasi" value={globalStats.low} tone="warning" onClick={() => setStockFilter((prev) => (prev === 'low' ? '' : 'low'))} active={stockFilter === 'low'} />
        <StatCard label="Pasibaigė" value={globalStats.empty} tone="danger" onClick={() => setStockFilter((prev) => (prev === 'empty' ? '' : 'empty'))} active={stockFilter === 'empty'} />
        <StatCard label="Judėjimų" value={globalStats.movements} onClick={() => setLogTypeFilter('')} active={!logTypeFilter} />
        <StatCard label="Išdavimų" value={globalStats.out} tone="green" onClick={() => setLogTypeFilter((prev) => (prev === 'out' ? '' : 'out'))} active={logTypeFilter === 'out'} />
        <StatCard label="Papildymų" value={globalStats.incoming} onClick={() => setLogTypeFilter((prev) => (prev === 'in' ? '' : 'in'))} active={logTypeFilter === 'in'} />
      </section>

      <section style={styles.riskPanel}>
        <div style={styles.riskHeader}>
          <div>
            <div style={styles.warningEyebrow}>Prioritetai</div>
            <h2 style={styles.cardTitle}>Reikia dėmesio</h2>
            <p style={styles.cardSubtitle}>Svarbiausi sandėlio signalai darbuotojui prieš išduodant prekes.</p>
          </div>

          <div style={styles.warningIcon}>
            <AlertTriangle size={23} />
          </div>
        </div>

        <div style={styles.riskGrid}>
          {riskRows.map((row) => (
            <button
              key={row.title}
              type="button"
              onClick={() => {
                if (row.tone === 'danger') setStockFilter((prev) => (prev === 'empty' ? '' : 'empty'))
                if (row.tone === 'warning') setStockFilter((prev) => (prev === 'low' ? '' : 'low'))
              }}
              style={{ ...styles.riskCard, ...getRiskCardStyle(row.tone) }}
            >
              <div>
                <p style={styles.riskTitle}>{row.title}</p>
                <p style={styles.riskDesc}>{row.desc}</p>
              </div>
              <strong style={styles.riskValue}>{row.value}</strong>
            </button>
          ))}
        </div>
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
            <option value="out">Išdavimai</option>
            <option value="in">Papildymai</option>
            <option value="adjustment">Koregavimai</option>
          </select>
        </Field>

        <button type="button" onClick={() => void loadInventory()} style={styles.refreshButton}>
          <RefreshCw size={16} /> Atnaujinti
        </button>
      </section>

      <section style={styles.categoryGrid}>
        {filteredCategories.map((category) => {
          const Icon = category.icon
          const stats = categoryStats[category.code]
          const status = stats.empty > 0 ? 'empty' : stats.low > 0 ? 'low' : stats.items > 0 ? 'ok' : 'none'
          const riskCount = stats.low + stats.empty
          const fillPercent = stats.items > 0 ? Math.max(8, Math.round(((stats.items - riskCount) / stats.items) * 100)) : 0

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

              <div>
                <div style={styles.progressMeta}>
                  <span>Stabilumas</span>
                  <strong>{stats.items ? `${fillPercent}%` : '—'}</strong>
                </div>
                <div style={styles.progressTrack}>
                  <span style={{ ...styles.progressBar, width: `${fillPercent}%`, background: status === 'empty' ? '#e11d48' : status === 'low' ? '#f59e0b' : '#10b981' }} />
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
            <EmptyState text="Sandėlis dar tuščias pagal pasirinktus filtrus. Pridėkite pirmą prekę arba išvalykite filtrus." />
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
                          {isUniformItem(item) ? (
                            <>
                              <button type="button" onClick={() => openUniformIssueModal(item.id)} style={styles.inlineDangerButton}>
                                Išduoti darbuotojui
                              </button>
                              <button type="button" onClick={() => openUniformReturnModal(item.id)} style={styles.inlineGreenButton}>
                                Grąžinti
                              </button>
                            </>
                          ) : (
                            <button type="button" onClick={() => openIssueModal(item.id)} style={styles.inlineDangerButton}>
                              Išduoti gyventojui
                            </button>
                          )}
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
            <EmptyState text="Judėjimų dar nėra pagal pasirinktus filtrus. Papildymai, išdavimai ir grąžinimai atsiras čia." />
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
                          {getLogOperationLabel(log)}
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
            Multi išdavimas, grąžinimas ir papildymas aktyvus
          </div>
        </div>
      </section>

      {showAddModal ? (
        <MultiAddModal
          forms={addForms}
          saving={saving}
          message={message}
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
          title="Išduoti gyventojui"
          subtitle="Gali išduoti kelias prekes vienu kartu. Šis veiksmas skirtas gyventojų prekėms."
          targetType="resident"
          lines={issueLines}
          items={items.filter((item) => !isUniformItem(item))}
          residents={residents}
          employees={employees}
          saving={saving}
          message={message}
          onClose={() => {
            if (!saving) setShowIssueModal(false)
          }}
          onChange={updateIssueLine}
          onAddLine={() => setIssueLines((prev) => [...prev, DEFAULT_ISSUE_LINE])}
          onRemoveLine={(index) => setIssueLines((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
          onSubmit={() => void issueItems()}
        />
      ) : null}

      {showUniformIssueModal ? (
        <MultiIssueModal
          title="Išduoti uniformą"
          subtitle="Uniformos išduodamos tik darbuotojams ir vėliau gali būti grąžintos į sandėlį."
          targetType="employee"
          lines={issueLines}
          items={items.filter(isUniformItem)}
          residents={residents}
          employees={employees}
          saving={saving}
          message={message}
          onClose={() => {
            if (!saving) setShowUniformIssueModal(false)
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
          message={message}
          onClose={() => {
            if (!saving) setShowRefillModal(false)
          }}
          onChange={updateRefillLine}
          onAddLine={() => setRefillLines((prev) => [...prev, DEFAULT_REFILL_LINE])}
          onRemoveLine={(index) => setRefillLines((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
          onSubmit={() => void refillItems()}
        />
      ) : null}

      {showUniformReturnModal ? (
        <MultiUniformReturnModal
          lines={uniformReturnLines}
          items={items.filter(isUniformItem)}
          employees={employees}
          saving={saving}
          message={message}
          onClose={() => {
            if (!saving) setShowUniformReturnModal(false)
          }}
          onChange={updateUniformReturnLine}
          onAddLine={() => setUniformReturnLines((prev) => [...prev, DEFAULT_UNIFORM_RETURN_LINE])}
          onRemoveLine={(index) => setUniformReturnLines((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
          onSubmit={() => void returnUniforms()}
        />
      ) : null}
    </main>
  )
}

function MultiAddModal({
  forms,
  saving,
  message,
  onClose,
  onChange,
  onAddLine,
  onRemoveLine,
  onSubmit,
}: {
  forms: AddForm[]
  saving: boolean
  message: string
  onClose: () => void
  onChange: (index: number, patch: Partial<AddForm>) => void
  onAddLine: () => void
  onRemoveLine: (index: number) => void
  onSubmit: () => void
}) {
  return (
    <Modal title="Pridėti prekes" subtitle="Gali pridėti kelias skirtingas prekes vienu kartu." onClose={onClose}>
      {message ? <div style={styles.modalMessage}>{message}</div> : null}

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
  subtitle,
  targetType,
  lines,
  items,
  residents,
  employees,
  saving,
  message,
  onClose,
  onChange,
  onAddLine,
  onRemoveLine,
  onSubmit,
}: {
  title: string
  subtitle: string
  targetType: 'resident' | 'employee'
  lines: IssueLine[]
  items: InventoryItem[]
  residents: PersonOption[]
  employees: PersonOption[]
  saving: boolean
  message: string
  onClose: () => void
  onChange: (index: number, patch: Partial<IssueLine>) => void
  onAddLine: () => void
  onRemoveLine: (index: number) => void
  onSubmit: () => void
}) {
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      {message ? <div style={styles.modalMessage}>{message}</div> : null}

      <div style={styles.multiLines}>
        {lines.map((line, index) => {
          const selectedItem = items.find((item) => item.id === line.itemId) || null
          const targetOptions = targetType === 'employee'
            ? employees.filter((employee) => employee.isActive !== false)
            : residents

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

              <Field label={targetType === 'employee' ? 'Darbuotojas *' : 'Gyventojas *'}>
                <select value={line.targetId} onChange={(event) => onChange(index, { targetId: event.target.value })} style={styles.input}>
                  <option value="">{targetType === 'employee' ? 'Pasirink darbuotoją' : 'Pasirink gyventoją'}</option>
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
          {saving ? 'Saugoma...' : 'Išduoti'}
        </button>
      </div>
    </Modal>
  )
}

function MultiRefillModal({
  lines,
  items,
  saving,
  message,
  onClose,
  onChange,
  onAddLine,
  onRemoveLine,
  onSubmit,
}: {
  lines: RefillLine[]
  items: InventoryItem[]
  saving: boolean
  message: string
  onClose: () => void
  onChange: (index: number, patch: Partial<RefillLine>) => void
  onAddLine: () => void
  onRemoveLine: (index: number) => void
  onSubmit: () => void
}) {
  return (
    <Modal title="Papildyti sandėlį" subtitle="Gali papildyti kelias prekes vienu kartu." onClose={onClose}>
      {message ? <div style={styles.modalMessage}>{message}</div> : null}

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

function MultiUniformReturnModal({
  lines,
  items,
  employees,
  saving,
  message,
  onClose,
  onChange,
  onAddLine,
  onRemoveLine,
  onSubmit,
}: {
  lines: UniformReturnLine[]
  items: InventoryItem[]
  employees: PersonOption[]
  saving: boolean
  message: string
  onClose: () => void
  onChange: (index: number, patch: Partial<UniformReturnLine>) => void
  onAddLine: () => void
  onRemoveLine: (index: number) => void
  onSubmit: () => void
}) {
  return (
    <Modal title="Grąžinti uniformą" subtitle="Uniformos grąžinamos į sandėlį ir istorijoje susiejamos su darbuotoju." onClose={onClose}>
      {message ? <div style={styles.modalMessage}>{message}</div> : null}

      <div style={styles.multiLines}>
        {lines.map((line, index) => {
          const selectedItem = items.find((item) => item.id === line.itemId) || null

          return (
            <div key={index} style={styles.multiLine}>
              <Field label="Uniforma *">
                <select value={line.itemId} onChange={(event) => onChange(index, { itemId: event.target.value })} style={styles.input}>
                  <option value="">Pasirink uniformą</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {formatQuantity(item.quantity, item.unit)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Darbuotojas *">
                <select value={line.targetId} onChange={(event) => onChange(index, { targetId: event.target.value })} style={styles.input}>
                  <option value="">Pasirink darbuotoją</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Kiekis *">
                <input type="number" min="1" value={line.quantity} onChange={(event) => onChange(index, { quantity: event.target.value })} style={styles.input} />
              </Field>

              <Field label="Pastaba">
                <input value={line.notes} onChange={(event) => onChange(index, { notes: event.target.value })} placeholder="Pvz. grąžinta išėjus iš darbo" style={styles.input} />
              </Field>

              {selectedItem ? <div style={styles.issueInfo}>Sandėlyje dabar: <strong>{formatQuantity(selectedItem.quantity, selectedItem.unit)}</strong></div> : null}

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
          {saving ? 'Saugoma...' : 'Grąžinti'}
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

function getRiskCardStyle(tone: 'danger' | 'warning' | 'green'): CSSProperties {
  if (tone === 'danger') {
    return {
      background: '#fff1f2',
      border: '1px solid #fecdd3',
      color: '#be123c',
    }
  }

  if (tone === 'warning') {
    return {
      background: '#fffbeb',
      border: '1px solid #fde68a',
      color: '#b45309',
    }
  }

  return {
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    color: '#047857',
  }
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    padding: 24,
    display: 'grid',
    gap: 24,
    color: '#020617',
  },
  hero: {
    width: '100%',
    maxWidth: 1280,
    margin: '0 auto',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 28,
    padding: 28,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 24,
    alignItems: 'center',
    flexWrap: 'wrap',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  },
  heroContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    minWidth: 0,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    background: '#ecfdf5',
    color: '#047857',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
  },
  eyebrow: {
    color: '#047857',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  title: {
    margin: '8px 0 0',
    color: '#0f172a',
    fontSize: 40,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: '-0.03em',
  },
  subtitle: {
    margin: '8px 0 0',
    color: '#64748b',
    fontSize: 17,
    fontWeight: 650,
    lineHeight: 1.5,
    maxWidth: 680,
  },
  heroActions: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  actionGroup: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  uniformActionGroup: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
    borderLeft: '1px solid #e2e8f0',
    paddingLeft: 16,
  },
  primaryButton: {
    border: '1px solid #34d399',
    borderRadius: 16,
    padding: '12px 18px',
    background: '#047857',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 900,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 10px 22px rgba(4,120,87,0.18)',
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid #bbf7d0',
    borderRadius: 16,
    padding: '12px 18px',
    background: '#ecfdf5',
    color: '#047857',
    fontSize: 14,
    fontWeight: 900,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  message: {
    width: '100%',
    maxWidth: 1280,
    margin: '0 auto',
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    borderRadius: 16,
    padding: 13,
    fontSize: 14,
    fontWeight: 800,
  },
  statsGrid: {
    width: '100%',
    maxWidth: 1280,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 16,
  },
  statCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 24,
    padding: 20,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    textAlign: 'left',
    cursor: 'pointer',
  },
  activeStat: {
    outline: '2px solid #10b981',
    boxShadow: '0 0 0 4px rgba(16,185,129,0.12)',
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
    fontSize: 34,
    fontWeight: 950,
    lineHeight: 1,
  },
  statLabel: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 12,
    fontWeight: 850,
  },
  riskPanel: {
    width: '100%',
    maxWidth: 1280,
    margin: '0 auto',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 28,
    padding: 24,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  },
  riskHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
  },
  warningEyebrow: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  warningIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    background: '#fffbeb',
    color: '#d97706',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
  },
  riskGrid: {
    marginTop: 20,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
  },
  riskCard: {
    borderRadius: 20,
    padding: 16,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'flex-start',
    textAlign: 'left',
    cursor: 'pointer',
  },
  riskTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: 15,
    fontWeight: 950,
  },
  riskDesc: {
    margin: '6px 0 0',
    color: '#475569',
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.45,
  },
  riskValue: {
    color: 'currentColor',
    fontSize: 32,
    fontWeight: 950,
    lineHeight: 1,
  },
  toolbar: {
    width: '100%',
    maxWidth: 1280,
    margin: '0 auto',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 24,
    padding: 18,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
    alignItems: 'end',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    border: '1px solid #cbd5e1',
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
    border: '1px solid #cbd5e1',
    borderRadius: 14,
    background: '#ffffff',
    color: '#0f172a',
    padding: '11px 14px',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  categoryGrid: {
    width: '100%',
    maxWidth: 1280,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 14,
  },
  categoryCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 24,
    padding: 18,
    minHeight: 225,
    display: 'grid',
    gap: 16,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
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
  progressMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    color: '#64748b',
    fontSize: 12,
    fontWeight: 900,
  },
  progressTrack: {
    marginTop: 8,
    height: 8,
    overflow: 'hidden',
    borderRadius: 999,
    background: '#e2e8f0',
  },
  progressBar: {
    display: 'block',
    height: '100%',
    borderRadius: 999,
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
    width: '100%',
    maxWidth: 1280,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 20,
    alignItems: 'start',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 24,
    padding: 24,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
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
    padding: 28,
    border: '1px dashed #cbd5e1',
    borderRadius: 20,
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
    padding: '12px 10px',
    borderBottom: '1px solid #e2e8f0',
    color: '#64748b',
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '14px 10px',
    color: '#334155',
    fontSize: 13,
    fontWeight: 650,
    verticalAlign: 'middle',
  },
  tdBold: {
    padding: '14px 10px',
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
  modalMessage: {
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    color: '#be123c',
    borderRadius: 16,
    padding: 13,
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.45,
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
