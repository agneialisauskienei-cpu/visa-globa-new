'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ClipboardList,
  Contact,
  FileText,
  Home,
  Package,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  User,
  UserRoundCheck,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'
import { getChangedFields, logAudit } from '@/lib/audit'

type TabKey = 'card' | 'contacts' | 'plan' | 'logs' | 'incidents' | 'inventory'

type Resident = {
  id: string
  organization_id?: string | null
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  name?: string | null
  resident_code?: string | null
  code?: string | null
  birth_date?: string | null
  arrival_date?: string | null
  current_room_id?: string | null
  department?: string | null
  assigned_to?: string | null
  current_status?: string | null
  status?: string | null
  archived_at?: string | null
  room_reserved_until?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  created_at?: string | null
}

type Room = {
  id: string
  name: string | null
  floor?: number | null
}

type Profile = {
  id: string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
}

type ResidentContact = {
  id: string
  organization_id: string
  resident_id: string
  full_name: string
  relationship: string | null
  phone: string | null
  email: string | null
  priority: number | null
  can_receive_info: boolean | null
  communication_notes: string | null
  created_at: string | null
}

type CarePlan = {
  id: string
  organization_id: string
  resident_id: string
  needs: string | null
  goals: string | null
  services: string | null
  responsible_staff: string | null
  review_date: string | null
  status: string | null
  created_at: string | null
}


type ResidentTask = {
  id: string
  organization_id: string | null
  title: string
  description: string | null
  status: string | null
  priority: string | null
  assigned_to: string | null
  resident_id: string | null
  care_plan_id: string | null
  category: string | null
  department: string | null
  due_date: string | null
  completed_at: string | null
  recurrence_days: number | null
  created_at: string | null
}

type DailyLog = {
  id: string
  organization_id: string
  resident_id: string
  employee_user_id: string | null
  employee_full_name: string | null
  activity_type: string | null
  note: string | null
  risk_type: string | null
  services_done: string | null
  created_at: string | null
}

type Incident = {
  id: string
  organization_id: string
  resident_id: string
  incident_at: string | null
  type: string | null
  observed_by: string | null
  actions_taken: string | null
  relatives_informed: boolean | null
  medics_informed: boolean | null
  result: string | null
  created_at: string | null
}

type InventoryItem = {
  id: string
  organization_id: string
  name: string | null
  category: string | null
  subcategory: string | null
  size: string | null
  unit: string | null
  quantity: number | null
  min_quantity: number | null
}

type InventoryHistory = {
  id: string
  item_name: string | null
  category: string | null
  subcategory: string | null
  size: string | null
  quantity: number | null
  unit: string | null
  type: string | null
  created_at: string | null
  employee_full_name: string | null
  notes: string | null
}

const STATUS_OPTIONS = [
  { value: 'arriving_soon', label: 'Netrukus atvyks' },
  { value: 'active', label: 'Gyvena' },
  { value: 'hospital', label: 'Ligoninėje' },
  { value: 'temporary_leave', label: 'Laikinai išvykęs' },
  { value: 'deceased', label: 'Mirė' },
  { value: 'contract_ended', label: 'Nutraukė sutartį' },
]

const CATEGORY_LABELS: Record<string, string> = {
  diapers: 'Sauskelnės',
  bedding: 'Patalynė',
  cleaning: 'Valymo priemonės',
  medication: 'Vaistai',
  uniforms: 'Darbuotojų uniformos',
  other: 'Kita',
}

const SUBCATEGORY_LABELS: Record<string, string> = {
  pants: 'Kelnaitės',
  tape: 'Juostinės sauskelnės',
  night: 'Naktinės sauskelnės',
  insert: 'Įklotai',
  underpad: 'Paklotai',
  set: 'Patalynės komplektas',
  sheet: 'Paklodė',
  duvet_cover: 'Antklodės užvalkalas',
  pillowcase: 'Pagalvės užvalkalas',
  blanket: 'Antklodė',
  pillow: 'Pagalvė',
  towel: 'Rankšluostis',
  spray: 'Purškiklis',
  liquid: 'Skystis',
  powder: 'Milteliai',
  gel: 'Gelis',
  wipes: 'Servetėlės',
  disinfectant: 'Dezinfekantas',
  bags: 'Maišeliai',
  gloves: 'Pirštinės',
  tablet: 'Tabletės',
  capsule: 'Kapsulės',
  drops: 'Lašai',
  ointment: 'Tepalas',
  injection: 'Injekcija',
  bandage: 'Tvarstis',
  general: 'Bendra prekė',
  equipment: 'Įranga',
  office: 'Kanceliarinės prekės',
  hygiene: 'Higienos priemonės',
}

function residentName(resident: Resident | null) {
  if (!resident) return 'Gyventojas'
  const fullName = String(resident.full_name || resident.name || '').trim()
  const firstName = String(resident.first_name || '').trim()
  const lastName = String(resident.last_name || '').trim()
  const combined = [firstName, lastName].filter(Boolean).join(' ').trim()
  return fullName || combined || 'Gyventojas'
}

function profileName(profile: Profile | null) {
  if (!profile) return '—'
  const fullName = String(profile.full_name || '').trim()
  const firstName = String(profile.first_name || '').trim()
  const lastName = String(profile.last_name || '').trim()
  const combined = [firstName, lastName].filter(Boolean).join(' ').trim()
  const email = String(profile.email || '').trim()
  return fullName || combined || email || '—'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('lt-LT')
}

function toDateInput(value: string | null | undefined) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function toDateTimeInput(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

function categoryLabel(value: string | null) {
  if (!value) return '—'
  return CATEGORY_LABELS[value] || value
}

function subcategoryLabel(value: string | null) {
  if (!value) return '—'
  return SUBCATEGORY_LABELS[value] || value
}

function operationLabel(type: string | null) {
  if (type === 'out') return 'Nurašymas'
  if (type === 'in') return 'Papildymas'
  if (type === 'adjustment') return 'Koregavimas'
  return '—'
}

function statusLabel(value: string | null | undefined) {
  return STATUS_OPTIONS.find((item) => item.value === value)?.label || value || '—'
}


function taskStatusLabel(value: string | null | undefined) {
  if (value === 'new') return 'Nauja'
  if (value === 'assigned') return 'Priskirta'
  if (value === 'in_progress') return 'Vykdoma'
  if (value === 'waiting') return 'Laukia informacijos'
  if (value === 'done') return 'Atlikta'
  if (value === 'cancelled') return 'Atšaukta'
  if (value === 'overdue') return 'Pavėluota'
  return value || '—'
}

function taskPriorityLabel(value: string | null | undefined) {
  if (value === 'low') return 'Žemas'
  if (value === 'medium') return 'Vidutinis'
  if (value === 'high') return 'Aukštas'
  if (value === 'critical') return 'Kritinis'
  return value || '—'
}

function isTaskOverdue(task: ResidentTask) {
  if (!task.due_date) return false
  if (task.status === 'done' || task.status === 'cancelled') return false
  return new Date(task.due_date).getTime() < Date.now()
}

function planTitle(plan: CarePlan) {
  return String(plan.goals || plan.needs || plan.services || 'Individualus planas').trim()
}

function isArchivedStatus(status: string | null | undefined) {
  return status === 'deceased' || status === 'contract_ended'
}

export default function ResidentDetailsPage() {
  const params = useParams()
  const residentId = String(params.id || '')

  const [activeTab, setActiveTab] = useState<TabKey>('card')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [resident, setResident] = useState<Resident | null>(null)

  const [rooms, setRooms] = useState<Room[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [assignedProfile, setAssignedProfile] = useState<Profile | null>(null)

  const [contacts, setContacts] = useState<ResidentContact[]>([])
  const [carePlans, setCarePlans] = useState<CarePlan[]>([])
  const [residentTasks, setResidentTasks] = useState<ResidentTask[]>([])
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [inventoryHistory, setInventoryHistory] = useState<InventoryHistory[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])

  const [residentForm, setResidentForm] = useState({
    first_name: '',
    last_name: '',
    resident_code: '',
    birth_date: '',
    arrival_date: '',
    current_room_id: '',
    department: '',
    assigned_to: '',
    current_status: 'active',
    room_reserved_until: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  })

  const [contactForm, setContactForm] = useState({
    full_name: '',
    relationship: '',
    phone: '',
    email: '',
    priority: '1',
    can_receive_info: false,
    communication_notes: '',
  })

  const [planForm, setPlanForm] = useState({
    needs: '',
    goals: '',
    services: '',
    responsible_staff: '',
    review_date: '',
  })

  const [dailyLogForm, setDailyLogForm] = useState({
    activity_type: 'Priežiūra',
    note: '',
    risk_type: '',
    services_done: '',
  })

  const [incidentForm, setIncidentForm] = useState({
    incident_at: '',
    type: 'Griuvimas',
    observed_by: '',
    actions_taken: '',
    relatives_informed: false,
    medics_informed: false,
    result: '',
  })

  const [editingContact, setEditingContact] = useState<ResidentContact | null>(null)
  const [editingPlan, setEditingPlan] = useState<CarePlan | null>(null)
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null)
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null)

  const [showIssueModal, setShowIssueModal] = useState(false)
  const [issueItemId, setIssueItemId] = useState('')
  const [issueQuantity, setIssueQuantity] = useState('1')
  const [issueNotes, setIssueNotes] = useState('')

  useEffect(() => {
    if (!residentId) return
    void loadData()
  }, [residentId])

  async function loadData() {
    try {
      setLoading(true)
      setMessage('')

      const residentResult = await supabase
        .from('residents')
        .select('*')
        .eq('id', residentId)
        .maybeSingle()

      if (residentResult.error) throw residentResult.error

      const residentData = (residentResult.data || null) as Resident | null
      setResident(residentData)

      const orgId = residentData?.organization_id || (await getCurrentOrganizationId())
      setOrganizationId(orgId || null)

      if (residentData) {
        setResidentForm({
          first_name: residentData.first_name || '',
          last_name: residentData.last_name || '',
          resident_code: residentData.resident_code || residentData.code || '',
          birth_date: toDateInput(residentData.birth_date),
          arrival_date: toDateInput(residentData.arrival_date),
          current_room_id: residentData.current_room_id || '',
          department: residentData.department || '',
          assigned_to: residentData.assigned_to || '',
          current_status: residentData.current_status || residentData.status || 'active',
          room_reserved_until: toDateInput(residentData.room_reserved_until),
          phone: residentData.phone || '',
          email: residentData.email || '',
          address: residentData.address || '',
          notes: residentData.notes || '',
        })
      }

      const [
        historyResult,
        contactsResult,
        plansResult,
        tasksResult,
        logsResult,
        incidentsResult,
        roomsResult,
        membersResult,
      ] = await Promise.all([
        supabase
          .from('inventory_issue_history_view')
          .select('id, item_name, category, subcategory, size, quantity, unit, type, created_at, employee_full_name, notes')
          .eq('resident_id', residentId)
          .order('created_at', { ascending: false }),

        supabase
          .from('resident_contacts')
          .select('*')
          .eq('resident_id', residentId)
          .order('priority', { ascending: true }),

        supabase
          .from('resident_care_plans')
          .select('*')
          .eq('resident_id', residentId)
          .order('created_at', { ascending: false }),

        supabase
          .from('tasks')
          .select('id, organization_id, title, description, status, priority, assigned_to, resident_id, care_plan_id, category, department, due_date, completed_at, recurrence_days, created_at')
          .eq('resident_id', residentId)
          .order('created_at', { ascending: false }),

        supabase
          .from('resident_daily_logs')
          .select('*')
          .eq('resident_id', residentId)
          .order('created_at', { ascending: false }),

        supabase
          .from('resident_incidents')
          .select('*')
          .eq('resident_id', residentId)
          .order('incident_at', { ascending: false }),

        orgId
          ? supabase.from('rooms').select('id, name, floor').eq('organization_id', orgId)
          : Promise.resolve({ data: [], error: null }),

        orgId
          ? supabase.from('organization_members').select('user_id').eq('organization_id', orgId).eq('is_active', true)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (historyResult.error) throw historyResult.error
      if (contactsResult.error) throw contactsResult.error
      if (plansResult.error) throw plansResult.error
      if (tasksResult.error) throw tasksResult.error
      if (logsResult.error) throw logsResult.error
      if (incidentsResult.error) throw incidentsResult.error
      if (roomsResult.error) throw roomsResult.error
      if (membersResult.error) throw membersResult.error

      setInventoryHistory((historyResult.data || []) as InventoryHistory[])
      setContacts((contactsResult.data || []) as ResidentContact[])
      setCarePlans((plansResult.data || []) as CarePlan[])
      setResidentTasks((tasksResult.data || []) as ResidentTask[])
      setDailyLogs((logsResult.data || []) as DailyLog[])
      setIncidents((incidentsResult.data || []) as Incident[])
      setRooms((roomsResult.data || []) as Room[])

      const memberIds = ((membersResult.data || []) as Record<string, unknown>[])
        .map((item) => String(item.user_id || ''))
        .filter(Boolean)

      if (memberIds.length > 0) {
        const profilesResult = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, full_name')
          .in('id', memberIds)

        if (profilesResult.error) throw profilesResult.error

        const profileList = (profilesResult.data || []) as Profile[]
        setProfiles(profileList)

        if (residentData?.assigned_to) {
          setAssignedProfile(profileList.find((profile) => profile.id === residentData.assigned_to) || null)
        } else {
          setAssignedProfile(null)
        }
      } else {
        setProfiles([])
        setAssignedProfile(null)
      }

      if (orgId) {
        const itemsResult = await supabase
          .from('inventory_items')
          .select('id, organization_id, name, category, subcategory, size, unit, quantity, min_quantity')
          .eq('organization_id', orgId)
          .neq('category', 'uniforms')
          .gt('quantity', 0)
          .order('name', { ascending: true })

        if (itemsResult.error) throw itemsResult.error
        setInventoryItems((itemsResult.data || []) as InventoryItem[])
      } else {
        setInventoryItems([])
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko įkelti gyventojo duomenų.')
    } finally {
      setLoading(false)
    }
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

    const record = (profile || {}) as Record<string, unknown>
    const fullName = String(record.full_name || '').trim()
    const firstName = String(record.first_name || '').trim()
    const lastName = String(record.last_name || '').trim()
    const email = String(record.email || user.email || '').trim()

    return {
      userId: user.id,
      name: fullName || [firstName, lastName].filter(Boolean).join(' ').trim() || email || null,
    }
  }

  async function saveResident() {
    try {
      if (!resident) return

      setSaving(true)
      setMessage('')

      const fullName = [residentForm.first_name, residentForm.last_name].filter(Boolean).join(' ').trim()
      const newStatus = residentForm.current_status
      const roomId = residentForm.current_room_id || null

      const archivedAt = isArchivedStatus(newStatus)
        ? resident.archived_at || new Date().toISOString()
        : null

      let occupiedBy: string | null = null
      let reservedFor: string | null = null
      let roomStatus = 'available'

      if (newStatus === 'arriving_soon') {
        reservedFor = resident.id
        roomStatus = 'reserved'
      }

      if (newStatus === 'active' || newStatus === 'hospital' || newStatus === 'temporary_leave') {
        occupiedBy = resident.id
        roomStatus = 'occupied'
      }

      if (isArchivedStatus(newStatus)) {
        occupiedBy = null
        reservedFor = null
        roomStatus = 'available'
      }

      await supabase
        .from('rooms')
        .update({
          occupied_by: null,
          reserved_for: null,
          reserved_until: null,
          room_status: 'available',
        })
        .or(`occupied_by.eq.${resident.id},reserved_for.eq.${resident.id}`)

      if (roomId && !isArchivedStatus(newStatus)) {
        await supabase
          .from('rooms')
          .update({
            occupied_by: occupiedBy,
            reserved_for: reservedFor,
            reserved_until: newStatus === 'arriving_soon' ? residentForm.room_reserved_until || null : null,
            room_status: roomStatus,
          })
          .eq('id', roomId)
      }

      const { data, error } = await supabase
        .from('residents')
        .update({
          first_name: residentForm.first_name || null,
          last_name: residentForm.last_name || null,
          full_name: fullName || null,
          resident_code: residentForm.resident_code || null,
          birth_date: residentForm.birth_date || null,
          arrival_date: residentForm.arrival_date || null,
          current_room_id: isArchivedStatus(newStatus) ? null : roomId,
          department: residentForm.department || null,
          assigned_to: residentForm.assigned_to || null,
          current_status: newStatus,
          archived_at: archivedAt,
          room_reserved_until: newStatus === 'arriving_soon' ? residentForm.room_reserved_until || null : null,
          phone: residentForm.phone || null,
          email: residentForm.email || null,
          address: residentForm.address || null,
          notes: residentForm.notes || null,
        })
        .eq('id', resident.id)
        .select()
        .single()

      if (error) throw error

     const beforeResidentForm = {
  first_name: resident.first_name || '',
  last_name: resident.last_name || '',
  resident_code: resident.resident_code || resident.code || '',
  birth_date: toDateInput(resident.birth_date),
  arrival_date: toDateInput(resident.arrival_date),
  current_room_id: resident.current_room_id || '',
  department: resident.department || '',
  assigned_to: resident.assigned_to || '',
  current_status: resident.current_status || resident.status || 'active',
  room_reserved_until: toDateInput(resident.room_reserved_until),
  phone: resident.phone || '',
  email: resident.email || '',
  address: resident.address || '',
  notes: resident.notes || '',
}

const residentChanges = getChangedFields(beforeResidentForm, residentForm)

if (Object.keys(residentChanges).length > 0) {
  await logAudit({
    organizationId,
    tableName: 'residents',
    recordId: data.id,
    action: 'update',
    changes: residentChanges,
  })
}

      setMessage('Gyventojo duomenys išsaugoti.')
      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko išsaugoti gyventojo.')
    } finally {
      setSaving(false)
    }
  }

  async function createContact() {
    try {
      if (!organizationId) return
      if (!contactForm.full_name.trim()) {
        setMessage('Įvesk kontakto vardą.')
        return
      }

      setSaving(true)
      setMessage('')

      const { data, error } = await supabase
        .from('resident_contacts')
        .insert({
          organization_id: organizationId,
          resident_id: residentId,
          full_name: contactForm.full_name.trim(),
          relationship: contactForm.relationship || null,
          phone: contactForm.phone || null,
          email: contactForm.email || null,
          priority: Number(contactForm.priority || 1),
          can_receive_info: contactForm.can_receive_info,
          communication_notes: contactForm.communication_notes || null,
        })
        .select()
        .single()

      if (error) throw error

      await logAudit({
        organizationId,
        tableName: 'resident_contacts',
        recordId: data.id,
        action: 'insert',
        changes: contactForm,
      })

      setContactForm({
        full_name: '',
        relationship: '',
        phone: '',
        email: '',
        priority: '1',
        can_receive_info: false,
        communication_notes: '',
      })

      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko pridėti kontakto.')
    } finally {
      setSaving(false)
    }
  }

  async function updateContact() {
    try {
      if (!editingContact) return
      setSaving(true)
      setMessage('')

      const { error } = await supabase
        .from('resident_contacts')
        .update({
          full_name: editingContact.full_name || null,
          relationship: editingContact.relationship || null,
          phone: editingContact.phone || null,
          email: editingContact.email || null,
          priority: editingContact.priority || 1,
          can_receive_info: Boolean(editingContact.can_receive_info),
          communication_notes: editingContact.communication_notes || null,
        })
        .eq('id', editingContact.id)

      if (error) throw error

      await logAudit({
        organizationId,
        tableName: 'resident_contacts',
        recordId: editingContact.id,
        action: 'update',
        changes: editingContact,
      })

      setEditingContact(null)
      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko atnaujinti kontakto.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteContact(id: string) {
    if (!confirm('Ar tikrai ištrinti kontaktą?')) return

    try {
      setSaving(true)
      setMessage('')

      const deleted = contacts.find((item) => item.id === id) || null
      const { error } = await supabase.from('resident_contacts').delete().eq('id', id)

      if (error) throw error

      await logAudit({
        organizationId,
        tableName: 'resident_contacts',
        recordId: id,
        action: 'delete',
        changes: deleted,
      })

      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko ištrinti kontakto.')
    } finally {
      setSaving(false)
    }
  }

  async function createCarePlan() {
    try {
      if (!organizationId) return
      setSaving(true)
      setMessage('')

      const { data, error } = await supabase
        .from('resident_care_plans')
        .insert({
          organization_id: organizationId,
          resident_id: residentId,
          needs: planForm.needs || null,
          goals: planForm.goals || null,
          services: planForm.services || null,
          responsible_staff: planForm.responsible_staff || null,
          review_date: planForm.review_date || null,
          status: 'active',
        })
        .select()
        .single()

      if (error) throw error

      await logAudit({
        organizationId,
        tableName: 'resident_care_plans',
        recordId: data.id,
        action: 'insert',
        changes: planForm,
      })

      setPlanForm({
        needs: '',
        goals: '',
        services: '',
        responsible_staff: '',
        review_date: '',
      })

      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko pridėti plano.')
    } finally {
      setSaving(false)
    }
  }

  async function updatePlan() {
    try {
      if (!editingPlan) return
      setSaving(true)
      setMessage('')

      const { error } = await supabase
        .from('resident_care_plans')
        .update({
          needs: editingPlan.needs || null,
          goals: editingPlan.goals || null,
          services: editingPlan.services || null,
          responsible_staff: editingPlan.responsible_staff || null,
          review_date: editingPlan.review_date || null,
          status: editingPlan.status || 'active',
        })
        .eq('id', editingPlan.id)

      if (error) throw error

      await logAudit({
        organizationId,
        tableName: 'resident_care_plans',
        recordId: editingPlan.id,
        action: 'update',
        changes: editingPlan,
      })

      setEditingPlan(null)
      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko atnaujinti plano.')
    } finally {
      setSaving(false)
    }
  }

  async function deletePlan(id: string) {
    if (!confirm('Ar tikrai ištrinti planą?')) return

    try {
      setSaving(true)
      setMessage('')

      const deleted = carePlans.find((item) => item.id === id) || null
      const { error } = await supabase.from('resident_care_plans').delete().eq('id', id)

      if (error) throw error

      await logAudit({
        organizationId,
        tableName: 'resident_care_plans',
        recordId: id,
        action: 'delete',
        changes: deleted,
      })

      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko ištrinti plano.')
    } finally {
      setSaving(false)
    }
  }

  async function createDailyLog() {
    try {
      if (!organizationId) return
      const actor = await getActorName()

      setSaving(true)
      setMessage('')

      const { data, error } = await supabase
        .from('resident_daily_logs')
        .insert({
          organization_id: organizationId,
          resident_id: residentId,
          employee_user_id: actor.userId,
          employee_full_name: actor.name,
          activity_type: dailyLogForm.activity_type || null,
          note: dailyLogForm.note || null,
          risk_type: dailyLogForm.risk_type || null,
          services_done: dailyLogForm.services_done || null,
        })
        .select()
        .single()

      if (error) throw error

      await logAudit({
        organizationId,
        tableName: 'resident_daily_logs',
        recordId: data.id,
        action: 'insert',
        changes: dailyLogForm,
      })

      setDailyLogForm({
        activity_type: 'Priežiūra',
        note: '',
        risk_type: '',
        services_done: '',
      })

      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko pridėti įrašo.')
    } finally {
      setSaving(false)
    }
  }

  async function updateDailyLog() {
    try {
      if (!editingLog) return
      setSaving(true)
      setMessage('')

      const { error } = await supabase
        .from('resident_daily_logs')
        .update({
          activity_type: editingLog.activity_type || null,
          note: editingLog.note || null,
          risk_type: editingLog.risk_type || null,
          services_done: editingLog.services_done || null,
        })
        .eq('id', editingLog.id)

      if (error) throw error

      await logAudit({
        organizationId,
        tableName: 'resident_daily_logs',
        recordId: editingLog.id,
        action: 'update',
        changes: editingLog,
      })

      setEditingLog(null)
      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko atnaujinti įrašo.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteDailyLog(id: string) {
    if (!confirm('Ar tikrai ištrinti įrašą?')) return

    try {
      setSaving(true)
      setMessage('')

      const deleted = dailyLogs.find((item) => item.id === id) || null
      const { error } = await supabase.from('resident_daily_logs').delete().eq('id', id)

      if (error) throw error

      await logAudit({
        organizationId,
        tableName: 'resident_daily_logs',
        recordId: id,
        action: 'delete',
        changes: deleted,
      })

      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko ištrinti įrašo.')
    } finally {
      setSaving(false)
    }
  }

  async function createIncident() {
    try {
      if (!organizationId) return
      setSaving(true)
      setMessage('')

      const { data, error } = await supabase
        .from('resident_incidents')
        .insert({
          organization_id: organizationId,
          resident_id: residentId,
          incident_at: incidentForm.incident_at || new Date().toISOString(),
          type: incidentForm.type || null,
          observed_by: incidentForm.observed_by || null,
          actions_taken: incidentForm.actions_taken || null,
          relatives_informed: incidentForm.relatives_informed,
          medics_informed: incidentForm.medics_informed,
          result: incidentForm.result || null,
        })
        .select()
        .single()

      if (error) throw error

      await logAudit({
        organizationId,
        tableName: 'resident_incidents',
        recordId: data.id,
        action: 'insert',
        changes: incidentForm,
      })

      setIncidentForm({
        incident_at: '',
        type: 'Griuvimas',
        observed_by: '',
        actions_taken: '',
        relatives_informed: false,
        medics_informed: false,
        result: '',
      })

      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko pridėti incidento.')
    } finally {
      setSaving(false)
    }
  }

  async function updateIncident() {
    try {
      if (!editingIncident) return
      setSaving(true)
      setMessage('')

      const { error } = await supabase
        .from('resident_incidents')
        .update({
          incident_at: editingIncident.incident_at || null,
          type: editingIncident.type || null,
          observed_by: editingIncident.observed_by || null,
          actions_taken: editingIncident.actions_taken || null,
          relatives_informed: Boolean(editingIncident.relatives_informed),
          medics_informed: Boolean(editingIncident.medics_informed),
          result: editingIncident.result || null,
        })
        .eq('id', editingIncident.id)

      if (error) throw error

      await logAudit({
        organizationId,
        tableName: 'resident_incidents',
        recordId: editingIncident.id,
        action: 'update',
        changes: editingIncident,
      })

      setEditingIncident(null)
      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko atnaujinti incidento.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteIncident(id: string) {
    if (!confirm('Ar tikrai ištrinti incidentą?')) return

    try {
      setSaving(true)
      setMessage('')

      const deleted = incidents.find((item) => item.id === id) || null
      const { error } = await supabase.from('resident_incidents').delete().eq('id', id)

      if (error) throw error

      await logAudit({
        organizationId,
        tableName: 'resident_incidents',
        recordId: id,
        action: 'delete',
        changes: deleted,
      })

      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko ištrinti incidento.')
    } finally {
      setSaving(false)
    }
  }

  async function issueItem() {
    try {
      if (!resident) return

      const selectedItem = inventoryItems.find((item) => item.id === issueItemId)
      const quantity = Number(issueQuantity || 0)

      if (!selectedItem) {
        setMessage('Pasirink prekę.')
        return
      }

      if (Number.isNaN(quantity) || quantity <= 0) {
        setMessage('Kiekis turi būti didesnis už 0.')
        return
      }

      const currentQuantity = Number(selectedItem.quantity || 0)

      if (quantity > currentQuantity) {
        setMessage(`Sandėlyje yra tik ${currentQuantity} ${selectedItem.unit || 'vnt.'}.`)
        return
      }

      setSaving(true)
      setMessage('')

      const actor = await getActorName()
      const newQuantity = currentQuantity - quantity

      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedItem.id)

      if (updateError) throw updateError

      const { data: historyData, error: historyError } = await supabase
        .from('inventory_issue_history')
        .insert({
          organization_id: selectedItem.organization_id,
          item_id: selectedItem.id,
          item_name: selectedItem.name,
          category: selectedItem.category,
          subcategory: selectedItem.subcategory,
          size: selectedItem.size,
          unit: selectedItem.unit,
          resident_id: resident.id,
          resident_code: residentName(resident),
          employee_user_id: actor.userId,
          employee_full_name: actor.name,
          quantity,
          type: 'out',
          notes: issueNotes.trim() || null,
        })
        .select()
        .single()

      if (historyError) throw historyError

      await logAudit({
        organizationId,
        tableName: 'inventory_issue_history',
        recordId: historyData.id,
        action: 'insert',
        changes: {
          item_id: selectedItem.id,
          item_name: selectedItem.name,
          quantity,
          resident_id: resident.id,
          resident_name: residentName(resident),
          employee: actor.name,
          notes: issueNotes,
        },
      })

      setShowIssueModal(false)
      setIssueItemId('')
      setIssueQuantity('1')
      setIssueNotes('')
      setMessage('Prekė nurašyta gyventojui.')
      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko nurašyti prekės.')
    } finally {
      setSaving(false)
    }
  }

  const currentRoom = useMemo(() => {
    if (!resident?.current_room_id) return null
    return rooms.find((room) => room.id === resident.current_room_id) || null
  }, [resident, rooms])

  const issuedTotal = useMemo(
    () =>
      inventoryHistory
        .filter((item) => item.type === 'out')
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [inventoryHistory]
  )

  const monthIssuedTotal = useMemo(() => {
    const now = new Date()
    return inventoryHistory
      .filter((item) => {
        if (item.type !== 'out' || !item.created_at) return false
        const date = new Date(item.created_at)
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      })
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  }, [inventoryHistory])

  const monthlyByCategory = useMemo(() => {
    const now = new Date()
    const map = new Map<string, number>()

    inventoryHistory.forEach((item) => {
      if (item.type !== 'out' || !item.created_at) return
      const date = new Date(item.created_at)
      if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return

      const key = categoryLabel(item.category)
      map.set(key, (map.get(key) || 0) + Number(item.quantity || 0))
    })

    return Array.from(map.entries()).map(([category, quantity]) => ({ category, quantity }))
  }, [inventoryHistory])

  const carePlanTaskStats = useMemo(() => {
    const map = new Map<string, { total: number; done: number; overdue: number; active: number }>()

    carePlans.forEach((plan) => {
      map.set(plan.id, { total: 0, done: 0, overdue: 0, active: 0 })
    })

    residentTasks.forEach((task) => {
      if (!task.care_plan_id) return
      const current = map.get(task.care_plan_id) || { total: 0, done: 0, overdue: 0, active: 0 }
      current.total += 1
      if (task.status === 'done') current.done += 1
      else if (isTaskOverdue(task)) current.overdue += 1
      else current.active += 1
      map.set(task.care_plan_id, current)
    })

    return map
  }, [carePlans, residentTasks])

  if (loading) return <div style={styles.page}>Kraunama...</div>

  if (!resident) {
    return (
      <div style={styles.page}>
        <Link href="/residents" style={styles.back}>
          <ArrowLeft size={16} />
          Grįžti į gyventojus
        </Link>
        <div style={styles.empty}>Gyventojas nerastas.</div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerTop}>
        <Link href="/residents" style={styles.back}>
          <ArrowLeft size={16} />
          Grįžti į gyventojus
        </Link>

        <button type="button" onClick={() => setShowIssueModal(true)} style={styles.primaryButton}>
          <Plus size={16} />
          Nurašyti prekę
        </button>
      </div>

      {message ? <div style={styles.message}>{message}</div> : null}

      <section style={styles.hero}>
        <div style={styles.heroIcon}>
          <User size={28} />
        </div>

        <div>
          <div style={styles.eyebrow}>Gyventojo kortelė</div>
          <h1 style={styles.title}>{residentName(resident)}</h1>
          <p style={styles.subtitle}>
            {resident.resident_code || resident.code || 'Be vidinio ID'} · {statusLabel(resident.current_status || resident.status)}
          </p>
        </div>
      </section>

      <section style={styles.stats}>
        <Stat icon={<Package size={18} />} value={inventoryHistory.length} label="Sandėlio judėjimų" />
        <Stat icon={<Calendar size={18} />} value={issuedTotal} label="Išduota iš viso" />
        <Stat icon={<Calendar size={18} />} value={monthIssuedTotal} label="Išduota šį mėnesį" />
        <Stat icon={<Home size={18} />} value={currentRoom?.name || '—'} label="Kambarys" />
        <Stat icon={<UserRoundCheck size={18} />} value={profileName(assignedProfile)} label="Atsakingas darbuotojas" />
      </section>

      <nav style={styles.tabs}>
        <TabButton active={activeTab === 'card'} onClick={() => setActiveTab('card')} icon={<User size={16} />} label="Kortelė" />
        <TabButton active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} icon={<Contact size={16} />} label="Kontaktai" />
        <TabButton active={activeTab === 'plan'} onClick={() => setActiveTab('plan')} icon={<FileText size={16} />} label="Planas" />
        <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<ClipboardList size={16} />} label="Įrašai" />
        <TabButton active={activeTab === 'incidents'} onClick={() => setActiveTab('incidents')} icon={<AlertTriangle size={16} />} label="Incidentai" />
        <TabButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={16} />} label="Prekės" />
      </nav>

      {activeTab === 'card' ? (
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.sectionTitle}>Pagrindinė informacija</h2>
            <button type="button" onClick={() => void saveResident()} disabled={saving} style={styles.primaryButton}>
              <Save size={16} />
              {saving ? 'Saugoma...' : 'Išsaugoti'}
            </button>
          </div>

          <div style={styles.formGrid}>
            <Field label="Vardas">
              <input value={residentForm.first_name} onChange={(e) => setResidentForm({ ...residentForm, first_name: e.target.value })} style={styles.input} />
            </Field>

            <Field label="Pavardė">
              <input value={residentForm.last_name} onChange={(e) => setResidentForm({ ...residentForm, last_name: e.target.value })} style={styles.input} />
            </Field>

            <Field label="Vidinis gyventojo ID">
              <input value={residentForm.resident_code} onChange={(e) => setResidentForm({ ...residentForm, resident_code: e.target.value })} style={styles.input} />
            </Field>

            <Field label="Gimimo data">
              <input type="date" value={residentForm.birth_date} onChange={(e) => setResidentForm({ ...residentForm, birth_date: e.target.value })} style={styles.input} />
            </Field>

            <Field label="Atvykimo data">
              <input type="date" value={residentForm.arrival_date} onChange={(e) => setResidentForm({ ...residentForm, arrival_date: e.target.value })} style={styles.input} />
            </Field>

            <Field label="Statusas">
              <select value={residentForm.current_status} onChange={(e) => setResidentForm({ ...residentForm, current_status: e.target.value })} style={styles.input}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Kambarys">
              <select value={residentForm.current_room_id} onChange={(e) => setResidentForm({ ...residentForm, current_room_id: e.target.value })} style={styles.input}>
                <option value="">Nepriskirta</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name || room.id}</option>
                ))}
              </select>
            </Field>

            {residentForm.current_status === 'arriving_soon' ? (
              <Field label="Rezervuota iki">
                <input
                  type="date"
                  value={residentForm.room_reserved_until}
                  onChange={(e) => setResidentForm({ ...residentForm, room_reserved_until: e.target.value })}
                  style={styles.input}
                />
              </Field>
            ) : null}

            <Field label="Skyrius">
              <input value={residentForm.department} onChange={(e) => setResidentForm({ ...residentForm, department: e.target.value })} style={styles.input} />
            </Field>

            <Field label="Atsakingas darbuotojas">
              <select value={residentForm.assigned_to} onChange={(e) => setResidentForm({ ...residentForm, assigned_to: e.target.value })} style={styles.input}>
                <option value="">Nepriskirta</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profileName(profile)}</option>
                ))}
              </select>
            </Field>

            <Field label="Telefonas">
              <input value={residentForm.phone} onChange={(e) => setResidentForm({ ...residentForm, phone: e.target.value })} style={styles.input} />
            </Field>

            <Field label="El. paštas">
              <input value={residentForm.email} onChange={(e) => setResidentForm({ ...residentForm, email: e.target.value })} style={styles.input} />
            </Field>

            <Field label="Adresas">
              <input value={residentForm.address} onChange={(e) => setResidentForm({ ...residentForm, address: e.target.value })} style={styles.input} />
            </Field>

            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span>Pastabos</span>
              <textarea value={residentForm.notes} onChange={(e) => setResidentForm({ ...residentForm, notes: e.target.value })} style={styles.textarea} />
            </label>
          </div>
        </section>
      ) : null}

      {activeTab === 'contacts' ? (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Kontaktai ir atstovai</h2>

          <div style={styles.formGrid}>
            <Field label="Vardas, pavardė">
              <input value={contactForm.full_name} onChange={(e) => setContactForm({ ...contactForm, full_name: e.target.value })} style={styles.input} />
            </Field>
            <Field label="Ryšys">
              <input value={contactForm.relationship} onChange={(e) => setContactForm({ ...contactForm, relationship: e.target.value })} placeholder="Pvz. dukra, globėjas" style={styles.input} />
            </Field>
            <Field label="Telefonas">
              <input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} style={styles.input} />
            </Field>
            <Field label="El. paštas">
              <input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} style={styles.input} />
            </Field>
            <Field label="Prioritetas">
              <input type="number" min="1" value={contactForm.priority} onChange={(e) => setContactForm({ ...contactForm, priority: e.target.value })} style={styles.input} />
            </Field>
            <label style={styles.checkboxRow}>
              <input type="checkbox" checked={contactForm.can_receive_info} onChange={(e) => setContactForm({ ...contactForm, can_receive_info: e.target.checked })} />
              Gali gauti informaciją
            </label>
            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span>Bendravimo pastabos</span>
              <textarea value={contactForm.communication_notes} onChange={(e) => setContactForm({ ...contactForm, communication_notes: e.target.value })} style={styles.textarea} />
            </label>
          </div>

          <button type="button" onClick={() => void createContact()} disabled={saving} style={styles.primaryButton}>
            <Plus size={16} />
            Pridėti kontaktą
          </button>

          {contacts.length === 0 ? (
            <div style={styles.empty}>Kontaktų dar nėra.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Kontaktas</th>
                  <th style={styles.th}>Ryšys</th>
                  <th style={styles.th}>Telefonas / el. paštas</th>
                  <th style={styles.th}>Leidimas</th>
                  <th style={styles.th}>Pastabos</th>
                  <th style={styles.th}>Veiksmai</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td style={styles.tdBold}>{contact.full_name}</td>
                    <td style={styles.td}>{contact.relationship || '—'}</td>
                    <td style={styles.td}>{contact.phone || contact.email || '—'}</td>
                    <td style={styles.td}>{contact.can_receive_info ? 'Taip' : 'Ne'}</td>
                    <td style={styles.td}>{contact.communication_notes || '—'}</td>
                    <td style={styles.td}>
                      <RowActions onEdit={() => setEditingContact(contact)} onDelete={() => void deleteContact(contact.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {activeTab === 'plan' ? (
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Individualus socialinės globos planas</h2>
              <p style={styles.sectionHint}>
                Čia planas susiejamas su užduotimis: kiekvienam plano punktui gali matyti aktyvias, atliktas ir vėluojančias užduotis.
              </p>
            </div>

            <Link href="/tasks" style={styles.secondaryLink}>
              <ClipboardList size={16} />
              Atidaryti užduotis
            </Link>
          </div>

          <div style={styles.formGrid}>
            <Field label="Poreikiai">
              <textarea value={planForm.needs} onChange={(e) => setPlanForm({ ...planForm, needs: e.target.value })} style={styles.textarea} />
            </Field>
            <Field label="Tikslai">
              <textarea value={planForm.goals} onChange={(e) => setPlanForm({ ...planForm, goals: e.target.value })} style={styles.textarea} />
            </Field>
            <Field label="Numatytos paslaugos">
              <textarea value={planForm.services} onChange={(e) => setPlanForm({ ...planForm, services: e.target.value })} style={styles.textarea} />
            </Field>
            <Field label="Atsakingi darbuotojai">
              <input value={planForm.responsible_staff} onChange={(e) => setPlanForm({ ...planForm, responsible_staff: e.target.value })} style={styles.input} />
            </Field>
            <Field label="Peržiūros data">
              <input type="date" value={planForm.review_date} onChange={(e) => setPlanForm({ ...planForm, review_date: e.target.value })} style={styles.input} />
            </Field>
          </div>

          <button type="button" onClick={() => void createCarePlan()} disabled={saving} style={styles.primaryButton}>
            <Plus size={16} />
            Pridėti planą
          </button>

          {carePlans.length === 0 ? (
            <div style={styles.empty}>Planų dar nėra.</div>
          ) : (
            <div style={styles.planGrid}>
              {carePlans.map((plan) => {
                const tasksForPlan = residentTasks.filter((task) => task.care_plan_id === plan.id)
                const stats = carePlanTaskStats.get(plan.id) || { total: 0, done: 0, overdue: 0, active: 0 }
                const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

                return (
                  <article key={plan.id} style={styles.planCard}>
                    <div style={styles.planHeader}>
                      <div>
                        <div style={styles.eyebrow}>Plano punktas</div>
                        <h3 style={styles.planTitle}>{planTitle(plan)}</h3>
                        <p style={styles.planMeta}>
                          Peržiūra: {plan.review_date || '—'} · Statusas: {plan.status || '—'}
                        </p>
                      </div>

                      <RowActions onEdit={() => setEditingPlan(plan)} onDelete={() => void deletePlan(plan.id)} />
                      <Link
                        href={`/tasks?resident_id=${resident?.id || ''}&care_plan_id=${plan.id}`}
                        style={styles.primaryButton}
                      >
                        <Plus size={14} />
                        Nauja užduotis
                      </Link>
                    </div>

                    <div style={styles.planDetailsGrid}>
                      <InfoBlock label="Poreikiai" value={plan.needs || '—'} />
                      <InfoBlock label="Tikslai" value={plan.goals || '—'} />
                      <InfoBlock label="Paslaugos" value={plan.services || '—'} />
                      <InfoBlock label="Atsakingi" value={plan.responsible_staff || '—'} />
                    </div>

                    <div style={styles.planTaskSummary}>
                      <div style={styles.progressHeader}>
                        <strong>Plano užduotys</strong>
                        <span>{progress}% atlikta</span>
                      </div>
                      <div style={styles.progressTrack}>
                        <div style={{ ...styles.progressFill, width: `${progress}%` }} />
                      </div>

                      <div style={styles.taskStats}>
                        <span>Viso: {stats.total}</span>
                        <span>Aktyvios: {stats.active}</span>
                        <span>Vėluoja: {stats.overdue}</span>
                        <span>Atlikta: {stats.done}</span>
                      </div>
                    </div>

                    {tasksForPlan.length === 0 ? (
                      <div style={styles.emptySmall}>
                        Šiam planui užduočių nėra. Sukurk užduotį modulyje „Užduotys“ ir pasirink šį individualų planą.
                      </div>
                    ) : (
                      <div style={styles.taskList}>
                        {tasksForPlan.map((task) => {
                          const assigned = profiles.find((profile) => profile.id === task.assigned_to)
                          const overdue = isTaskOverdue(task)

                          return (
                            <div key={task.id} style={styles.taskItem}>
                              <div>
                                <strong>{task.title}</strong>
                                <div style={styles.meta}>
                                  {task.category || '—'} · Terminas: {formatDate(task.due_date)} · Atsakingas: {profileName(assigned)}
                                </div>
                              </div>

                              <div style={styles.taskBadges}>
                                <span style={{ ...styles.taskBadge, ...(overdue ? styles.badgeOverdue : task.status === 'done' ? styles.badgeDone : styles.badgeActive) }}>
                                  {overdue ? 'Pavėluota' : taskStatusLabel(task.status)}
                                </span>
                                <span style={{ ...styles.taskBadge, ...(task.priority === 'critical' || task.priority === 'high' ? styles.badgePriorityHigh : styles.badgePriority) }}>
                                  {taskPriorityLabel(task.priority)}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </article>
                )
              })}

              {residentTasks.filter((task) => !task.care_plan_id).length > 0 ? (
                <article style={styles.planCard}>
                  <div style={styles.planHeader}>
                    <div>
                      <div style={styles.eyebrow}>Nesusietos užduotys</div>
                      <h3 style={styles.planTitle}>Užduotys be individualaus plano</h3>
                      <p style={styles.planMeta}>Šias užduotis verta priskirti konkrečiam planui.</p>
                    </div>
                  </div>

                  <div style={styles.taskList}>
                    {residentTasks.filter((task) => !task.care_plan_id).map((task) => (
                      <div key={task.id} style={styles.taskItem}>
                        <div>
                          <strong>{task.title}</strong>
                          <div style={styles.meta}>{task.category || '—'} · Terminas: {formatDate(task.due_date)}</div>
                        </div>
                        <span style={{ ...styles.taskBadge, ...(isTaskOverdue(task) ? styles.badgeOverdue : styles.badgeActive) }}>
                          {isTaskOverdue(task) ? 'Pavėluota' : taskStatusLabel(task.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'logs' ? (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Kasdienės veiklos / įrašai</h2>

          <div style={styles.formGrid}>
            <Field label="Veiklos tipas">
              <select value={dailyLogForm.activity_type} onChange={(e) => setDailyLogForm({ ...dailyLogForm, activity_type: e.target.value })} style={styles.input}>
                <option>Priežiūra</option>
                <option>Higiena</option>
                <option>Maitinimas</option>
                <option>Socialinė veikla</option>
                <option>Stebėjimas</option>
                <option>Kita</option>
              </select>
            </Field>
            <Field label="Rizika / incidentas">
              <input value={dailyLogForm.risk_type} onChange={(e) => setDailyLogForm({ ...dailyLogForm, risk_type: e.target.value })} style={styles.input} />
            </Field>
            <Field label="Atliktos paslaugos">
              <input value={dailyLogForm.services_done} onChange={(e) => setDailyLogForm({ ...dailyLogForm, services_done: e.target.value })} style={styles.input} />
            </Field>
            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span>Trumpas įrašas</span>
              <textarea value={dailyLogForm.note} onChange={(e) => setDailyLogForm({ ...dailyLogForm, note: e.target.value })} style={styles.textarea} />
            </label>
          </div>

          <button type="button" onClick={() => void createDailyLog()} disabled={saving} style={styles.primaryButton}>
            <Plus size={16} />
            Pridėti įrašą
          </button>

          {dailyLogs.length === 0 ? (
            <div style={styles.empty}>Įrašų dar nėra.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Data</th>
                  <th style={styles.th}>Tipas</th>
                  <th style={styles.th}>Įrašas</th>
                  <th style={styles.th}>Darbuotojas</th>
                  <th style={styles.th}>Rizika</th>
                  <th style={styles.th}>Veiksmai</th>
                </tr>
              </thead>
              <tbody>
                {dailyLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={styles.tdBold}>{formatDate(log.created_at)}</td>
                    <td style={styles.td}>{log.activity_type || '—'}</td>
                    <td style={styles.td}>{log.note || '—'}</td>
                    <td style={styles.td}>{log.employee_full_name || '—'}</td>
                    <td style={styles.td}>{log.risk_type || '—'}</td>
                    <td style={styles.td}>
                      <RowActions onEdit={() => setEditingLog(log)} onDelete={() => void deleteDailyLog(log.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {activeTab === 'incidents' ? (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Incidentai</h2>

          <div style={styles.formGrid}>
            <Field label="Data ir laikas">
              <input type="datetime-local" value={incidentForm.incident_at} onChange={(e) => setIncidentForm({ ...incidentForm, incident_at: e.target.value })} style={styles.input} />
            </Field>
            <Field label="Tipas">
              <select value={incidentForm.type} onChange={(e) => setIncidentForm({ ...incidentForm, type: e.target.value })} style={styles.input}>
                <option>Griuvimas</option>
                <option>Konfliktas</option>
                <option>Pablogėjusi būklė</option>
                <option>Dingimas</option>
                <option>Savižalos rizika</option>
                <option>Kita</option>
              </select>
            </Field>
            <Field label="Kas pastebėjo">
              <input value={incidentForm.observed_by} onChange={(e) => setIncidentForm({ ...incidentForm, observed_by: e.target.value })} style={styles.input} />
            </Field>
            <label style={styles.checkboxRow}>
              <input type="checkbox" checked={incidentForm.relatives_informed} onChange={(e) => setIncidentForm({ ...incidentForm, relatives_informed: e.target.checked })} />
              Informuoti artimieji
            </label>
            <label style={styles.checkboxRow}>
              <input type="checkbox" checked={incidentForm.medics_informed} onChange={(e) => setIncidentForm({ ...incidentForm, medics_informed: e.target.checked })} />
              Informuoti medikai
            </label>
            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span>Kokių veiksmų imtasi</span>
              <textarea value={incidentForm.actions_taken} onChange={(e) => setIncidentForm({ ...incidentForm, actions_taken: e.target.value })} style={styles.textarea} />
            </label>
            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span>Rezultatas</span>
              <textarea value={incidentForm.result} onChange={(e) => setIncidentForm({ ...incidentForm, result: e.target.value })} style={styles.textarea} />
            </label>
          </div>

          <button type="button" onClick={() => void createIncident()} disabled={saving} style={styles.primaryButton}>
            <Plus size={16} />
            Pridėti incidentą
          </button>

          {incidents.length === 0 ? (
            <div style={styles.empty}>Incidentų nėra.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Data</th>
                  <th style={styles.th}>Tipas</th>
                  <th style={styles.th}>Pastebėjo</th>
                  <th style={styles.th}>Veiksmai</th>
                  <th style={styles.th}>Informuoti</th>
                  <th style={styles.th}>Rezultatas</th>
                  <th style={styles.th}>Veiksmai</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => (
                  <tr key={incident.id}>
                    <td style={styles.tdBold}>{formatDate(incident.incident_at)}</td>
                    <td style={styles.td}>{incident.type || '—'}</td>
                    <td style={styles.td}>{incident.observed_by || '—'}</td>
                    <td style={styles.td}>{incident.actions_taken || '—'}</td>
                    <td style={styles.td}>{[incident.relatives_informed ? 'artimieji' : '', incident.medics_informed ? 'medikai' : ''].filter(Boolean).join(', ') || '—'}</td>
                    <td style={styles.td}>{incident.result || '—'}</td>
                    <td style={styles.td}>
                      <RowActions onEdit={() => setEditingIncident(incident)} onDelete={() => void deleteIncident(incident.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {activeTab === 'inventory' ? (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Išduotos prekės</h2>

          <div style={styles.categoryGrid}>
            {monthlyByCategory.length === 0 ? (
              <div style={styles.empty}>Šį mėnesį nurašymų nėra.</div>
            ) : (
              monthlyByCategory.map((item) => (
                <div key={item.category} style={styles.categoryCard}>
                  <strong>{item.quantity}</strong>
                  <span>{item.category}</span>
                </div>
              ))
            )}
          </div>

          {inventoryHistory.length === 0 ? (
            <div style={styles.empty}>Prekių istorijos dar nėra.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Prekė</th>
                  <th style={styles.th}>Kategorija</th>
                  <th style={styles.th}>Kiekis</th>
                  <th style={styles.th}>Operacija</th>
                  <th style={styles.th}>Kas atliko</th>
                  <th style={styles.th}>Data</th>
                </tr>
              </thead>
              <tbody>
                {inventoryHistory.map((item) => (
                  <tr key={item.id}>
                    <td style={styles.tdBold}>
                      {item.item_name || '—'}
                      <div style={styles.sub}>
                        {subcategoryLabel(item.subcategory)}
                        {item.size ? ` • ${item.size}` : ''}
                        {item.notes ? ` • ${item.notes}` : ''}
                      </div>
                    </td>
                    <td style={styles.td}>{categoryLabel(item.category)}</td>
                    <td style={styles.td}>{Number(item.quantity || 0)} {item.unit || 'vnt.'}</td>
                    <td style={styles.td}>{operationLabel(item.type)}</td>
                    <td style={styles.td}>{item.employee_full_name || '—'}</td>
                    <td style={styles.td}>{formatDate(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {showIssueModal ? (
        <Modal title="Nurašyti prekę" subtitle={residentName(resident)} onClose={() => setShowIssueModal(false)}>
          <Field label="Prekė">
            <select value={issueItemId} onChange={(e) => setIssueItemId(e.target.value)} style={styles.input}>
              <option value="">Pasirink prekę</option>
              {inventoryItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {Number(item.quantity || 0)} {item.unit || 'vnt.'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kiekis">
            <input type="number" min="1" value={issueQuantity} onChange={(e) => setIssueQuantity(e.target.value)} style={styles.input} />
          </Field>
          <Field label="Pastaba">
            <input value={issueNotes} onChange={(e) => setIssueNotes(e.target.value)} placeholder="Pvz. išduota pagal poreikį" style={styles.input} />
          </Field>
          <div style={styles.modalActions}>
            <button type="button" onClick={() => setShowIssueModal(false)} style={styles.cancelButton}>Atšaukti</button>
            <button type="button" onClick={() => void issueItem()} disabled={saving} style={styles.primaryButton}>
              {saving ? 'Saugoma...' : 'Nurašyti'}
            </button>
          </div>
        </Modal>
      ) : null}

      {editingContact ? (
        <Modal title="Redaguoti kontaktą" subtitle={editingContact.full_name} onClose={() => setEditingContact(null)}>
          <Field label="Vardas, pavardė">
            <input value={editingContact.full_name || ''} onChange={(e) => setEditingContact({ ...editingContact, full_name: e.target.value })} style={styles.input} />
          </Field>
          <Field label="Ryšys">
            <input value={editingContact.relationship || ''} onChange={(e) => setEditingContact({ ...editingContact, relationship: e.target.value })} style={styles.input} />
          </Field>
          <Field label="Telefonas">
            <input value={editingContact.phone || ''} onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })} style={styles.input} />
          </Field>
          <Field label="El. paštas">
            <input value={editingContact.email || ''} onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })} style={styles.input} />
          </Field>
          <Field label="Prioritetas">
            <input type="number" min="1" value={editingContact.priority || 1} onChange={(e) => setEditingContact({ ...editingContact, priority: Number(e.target.value || 1) })} style={styles.input} />
          </Field>
          <label style={styles.checkboxRow}>
            <input type="checkbox" checked={Boolean(editingContact.can_receive_info)} onChange={(e) => setEditingContact({ ...editingContact, can_receive_info: e.target.checked })} />
            Gali gauti informaciją
          </label>
          <Field label="Pastabos">
            <textarea value={editingContact.communication_notes || ''} onChange={(e) => setEditingContact({ ...editingContact, communication_notes: e.target.value })} style={styles.textarea} />
          </Field>
          <div style={styles.modalActions}>
            <button type="button" onClick={() => setEditingContact(null)} style={styles.cancelButton}>Atšaukti</button>
            <button type="button" onClick={() => void updateContact()} disabled={saving} style={styles.primaryButton}>Išsaugoti</button>
          </div>
        </Modal>
      ) : null}

      {editingPlan ? (
        <Modal title="Redaguoti planą" subtitle="Individualus socialinės globos planas" onClose={() => setEditingPlan(null)}>
          <Field label="Poreikiai">
            <textarea value={editingPlan.needs || ''} onChange={(e) => setEditingPlan({ ...editingPlan, needs: e.target.value })} style={styles.textarea} />
          </Field>
          <Field label="Tikslai">
            <textarea value={editingPlan.goals || ''} onChange={(e) => setEditingPlan({ ...editingPlan, goals: e.target.value })} style={styles.textarea} />
          </Field>
          <Field label="Paslaugos">
            <textarea value={editingPlan.services || ''} onChange={(e) => setEditingPlan({ ...editingPlan, services: e.target.value })} style={styles.textarea} />
          </Field>
          <Field label="Atsakingi darbuotojai">
            <input value={editingPlan.responsible_staff || ''} onChange={(e) => setEditingPlan({ ...editingPlan, responsible_staff: e.target.value })} style={styles.input} />
          </Field>
          <Field label="Peržiūros data">
            <input type="date" value={toDateInput(editingPlan.review_date)} onChange={(e) => setEditingPlan({ ...editingPlan, review_date: e.target.value })} style={styles.input} />
          </Field>
          <Field label="Statusas">
            <select value={editingPlan.status || 'active'} onChange={(e) => setEditingPlan({ ...editingPlan, status: e.target.value })} style={styles.input}>
              <option value="active">Aktyvus</option>
              <option value="archived">Archyvuotas</option>
              <option value="completed">Užbaigtas</option>
            </select>
          </Field>
          <div style={styles.modalActions}>
            <button type="button" onClick={() => setEditingPlan(null)} style={styles.cancelButton}>Atšaukti</button>
            <button type="button" onClick={() => void updatePlan()} disabled={saving} style={styles.primaryButton}>Išsaugoti</button>
          </div>
        </Modal>
      ) : null}

      {editingLog ? (
        <Modal title="Redaguoti įrašą" subtitle={formatDate(editingLog.created_at)} onClose={() => setEditingLog(null)}>
          <Field label="Veiklos tipas">
            <select value={editingLog.activity_type || 'Priežiūra'} onChange={(e) => setEditingLog({ ...editingLog, activity_type: e.target.value })} style={styles.input}>
              <option>Priežiūra</option>
              <option>Higiena</option>
              <option>Maitinimas</option>
              <option>Socialinė veikla</option>
              <option>Stebėjimas</option>
              <option>Kita</option>
            </select>
          </Field>
          <Field label="Rizika">
            <input value={editingLog.risk_type || ''} onChange={(e) => setEditingLog({ ...editingLog, risk_type: e.target.value })} style={styles.input} />
          </Field>
          <Field label="Atliktos paslaugos">
            <input value={editingLog.services_done || ''} onChange={(e) => setEditingLog({ ...editingLog, services_done: e.target.value })} style={styles.input} />
          </Field>
          <Field label="Įrašas">
            <textarea value={editingLog.note || ''} onChange={(e) => setEditingLog({ ...editingLog, note: e.target.value })} style={styles.textarea} />
          </Field>
          <div style={styles.modalActions}>
            <button type="button" onClick={() => setEditingLog(null)} style={styles.cancelButton}>Atšaukti</button>
            <button type="button" onClick={() => void updateDailyLog()} disabled={saving} style={styles.primaryButton}>Išsaugoti</button>
          </div>
        </Modal>
      ) : null}

      {editingIncident ? (
        <Modal title="Redaguoti incidentą" subtitle={editingIncident.type || 'Incidentas'} onClose={() => setEditingIncident(null)}>
          <Field label="Data ir laikas">
            <input type="datetime-local" value={toDateTimeInput(editingIncident.incident_at)} onChange={(e) => setEditingIncident({ ...editingIncident, incident_at: e.target.value })} style={styles.input} />
          </Field>
          <Field label="Tipas">
            <select value={editingIncident.type || 'Griuvimas'} onChange={(e) => setEditingIncident({ ...editingIncident, type: e.target.value })} style={styles.input}>
              <option>Griuvimas</option>
              <option>Konfliktas</option>
              <option>Pablogėjusi būklė</option>
              <option>Dingimas</option>
              <option>Savižalos rizika</option>
              <option>Kita</option>
            </select>
          </Field>
          <Field label="Kas pastebėjo">
            <input value={editingIncident.observed_by || ''} onChange={(e) => setEditingIncident({ ...editingIncident, observed_by: e.target.value })} style={styles.input} />
          </Field>
          <label style={styles.checkboxRow}>
            <input type="checkbox" checked={Boolean(editingIncident.relatives_informed)} onChange={(e) => setEditingIncident({ ...editingIncident, relatives_informed: e.target.checked })} />
            Informuoti artimieji
          </label>
          <label style={styles.checkboxRow}>
            <input type="checkbox" checked={Boolean(editingIncident.medics_informed)} onChange={(e) => setEditingIncident({ ...editingIncident, medics_informed: e.target.checked })} />
            Informuoti medikai
          </label>
          <Field label="Veiksmai">
            <textarea value={editingIncident.actions_taken || ''} onChange={(e) => setEditingIncident({ ...editingIncident, actions_taken: e.target.value })} style={styles.textarea} />
          </Field>
          <Field label="Rezultatas">
            <textarea value={editingIncident.result || ''} onChange={(e) => setEditingIncident({ ...editingIncident, result: e.target.value })} style={styles.textarea} />
          </Field>
          <div style={styles.modalActions}>
            <button type="button" onClick={() => setEditingIncident(null)} style={styles.cancelButton}>Atšaukti</button>
            <button type="button" onClick={() => void updateIncident()} disabled={saving} style={styles.primaryButton}>Išsaugoti</button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}


function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoBlock}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Modal({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h2 style={styles.modalTitle}>{title}</h2>
            {subtitle ? <p style={styles.modalSubtitle}>{subtitle}</p> : null}
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

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={styles.rowActions}>
      <button type="button" onClick={onEdit} style={styles.smallButton}>Redaguoti</button>
      <button type="button" onClick={onDelete} style={styles.dangerButton}>
        <Trash2 size={14} />
        Trinti
      </button>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div style={styles.statCard}>
      {icon}
      <div>
        <strong style={styles.statNumber}>{value}</strong>
        <span style={styles.statLabel}>{label}</span>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} style={{ ...styles.tabButton, ...(active ? styles.activeTab : {}) }}>
      {icon}
      {label}
    </button>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 24, display: 'grid', gap: 18 },
  headerTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  back: { display: 'inline-flex', alignItems: 'center', gap: 8, color: '#047857', textDecoration: 'none', fontSize: 14, fontWeight: 900 },
  primaryButton: { border: 'none', background: '#047857', color: '#ffffff', borderRadius: 13, padding: '11px 13px', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 },
  hero: { display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid #e5e7eb', borderRadius: 24, padding: 22 },
  heroIcon: { width: 58, height: 58, borderRadius: 18, background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#047857', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' },
  title: { margin: '4px 0', color: '#0f172a', fontSize: 34, fontWeight: 950 },
  subtitle: { margin: 0, color: '#64748b', fontSize: 15, fontWeight: 700 },
  message: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 16, padding: 13, fontSize: 14, fontWeight: 800 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  statCard: { display: 'flex', alignItems: 'center', gap: 12, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 16, minWidth: 0 },
  statNumber: { display: 'block', color: '#0f172a', fontSize: 20, fontWeight: 950, wordBreak: 'break-word' },
  statLabel: { display: 'block', color: '#64748b', fontSize: 12, fontWeight: 850 },
  tabs: { display: 'flex', gap: 8, overflowX: 'auto', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 8 },
  tabButton: { border: 'none', background: 'transparent', color: '#64748b', borderRadius: 13, padding: '10px 12px', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' },
  activeTab: { background: '#ecfdf5', color: '#047857' },
  card: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 22, padding: 20, display: 'grid', gap: 14, overflowX: 'auto' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  sectionTitle: { margin: 0, color: '#0f172a', fontSize: 22, fontWeight: 950 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  field: { display: 'grid', gap: 6, color: '#334155', fontSize: 12, fontWeight: 850 },
  input: { width: '100%', border: '1px solid #d1d5db', borderRadius: 13, padding: '10px 11px', fontSize: 14, boxSizing: 'border-box' },
  textarea: { width: '100%', minHeight: 96, border: '1px solid #d1d5db', borderRadius: 13, padding: '10px 11px', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: 9, color: '#334155', fontSize: 13, fontWeight: 850 },
  categoryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 },
  categoryCard: { background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 16, padding: 14, display: 'grid', gap: 5, color: '#047857' },
  empty: { padding: 22, border: '1px dashed #cbd5e1', borderRadius: 16, color: '#64748b', textAlign: 'center', fontSize: 14, fontWeight: 750 },
  table: { width: '100%', minWidth: 920, borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px 10px', borderBottom: '1px solid #e5e7eb', color: '#475569', fontWeight: 900 },
  td: { padding: '14px 10px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 650, verticalAlign: 'top' },
  tdBold: { padding: '14px 10px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 900, verticalAlign: 'top' },
  sub: { marginTop: 4, color: '#64748b', fontSize: 12, fontWeight: 650 },
  rowActions: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  smallButton: { background: '#f1f5f9', color: '#0f172a', border: 'none', padding: '7px 10px', borderRadius: 10, cursor: 'pointer', fontWeight: 800 },
  dangerButton: { background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '7px 10px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 },
  modalCard: { width: '100%', maxWidth: 620, maxHeight: '92vh', overflow: 'auto', background: '#ffffff', borderRadius: 22, padding: 20, display: 'grid', gap: 16 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  modalTitle: { margin: 0, fontSize: 22, fontWeight: 950, color: '#0f172a' },
  modalSubtitle: { margin: '4px 0 0', color: '#64748b', fontSize: 14, fontWeight: 750 },
  iconButton: { width: 38, height: 38, borderRadius: 12, border: '1px solid #d1d5db', background: '#ffffff', cursor: 'pointer' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
  cancelButton: { border: 'none', background: '#f1f5f9', color: '#0f172a', borderRadius: 13, padding: '11px 13px', fontSize: 13, fontWeight: 900, cursor: 'pointer' },

  sectionHint: { margin: '6px 0 0', color: '#64748b', fontSize: 13, fontWeight: 700 },
  secondaryLink: { border: '1px solid #a7f3d0', background: '#ecfdf5', color: '#047857', borderRadius: 13, padding: '10px 13px', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none' },
  planGrid: { display: 'grid', gap: 14 },
  planCard: { border: '1px solid #e5e7eb', borderRadius: 18, padding: 16, background: '#ffffff', display: 'grid', gap: 14 },
  planHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  planTitle: { margin: '4px 0', color: '#0f172a', fontSize: 18, fontWeight: 950 },
  planMeta: { margin: 0, color: '#64748b', fontSize: 13, fontWeight: 750 },
  planDetailsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 },
  infoBlock: { background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 14, padding: 12, display: 'grid', gap: 5, color: '#334155', fontSize: 12, fontWeight: 800 },
  planTaskSummary: { background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 14, padding: 12, display: 'grid', gap: 9 },
  progressHeader: { display: 'flex', justifyContent: 'space-between', gap: 10, color: '#0f172a', fontSize: 13, fontWeight: 900 },
  progressTrack: { height: 9, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#047857', borderRadius: 999 },
  taskStats: { display: 'flex', gap: 8, flexWrap: 'wrap', color: '#64748b', fontSize: 12, fontWeight: 800 },
  emptySmall: { padding: 14, border: '1px dashed #cbd5e1', borderRadius: 14, color: '#64748b', fontSize: 13, fontWeight: 750 },
  taskList: { display: 'grid', gap: 8 },
  taskItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 14, padding: 12 },
  taskBadges: { display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  taskBadge: { display: 'inline-flex', borderRadius: 999, padding: '5px 9px', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' },
  badgeActive: { background: '#ecfdf5', color: '#047857' },
  badgeDone: { background: '#dcfce7', color: '#166534' },
  badgeOverdue: { background: '#fee2e2', color: '#b91c1c' },
  badgePriority: { background: '#fef9c3', color: '#854d0e' },
  badgePriorityHigh: { background: '#ffedd5', color: '#c2410c' },

}