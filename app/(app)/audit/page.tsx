"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { AlertTriangle, ArrowLeft, CalendarDays, Filter, RefreshCw, Search, ShieldCheck, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getCurrentOrganizationId } from "@/lib/current-organization"

type AuditLog = {
  id: string
  organization_id: string | null
  table_name: string
  record_id: string | null
  action: string
  changed_by: string | null
  actor?: string | null
  user_id?: string | null
  changed_at: string | null
  created_at?: string | null
  changes: Record<string, unknown> | null
  entity_type?: string | null
  entity_id?: string | null
  metadata?: Record<string, unknown> | null
}

type Profile = {
  id: string
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

type Resident = {
  id: string
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  resident_code?: string | null
  current_room_id?: string | null
}

type Room = {
  id: string
  name?: string | null
}

type Task = {
  id: string
  title?: string | null
  resident_id?: string | null
}

type OrganizationMember = {
  id?: string | null
  user_id?: string | null
  role?: string | null
  position?: string | null
  department?: string | null
}

type PersonnelTraining = {
  id: string
  employee_id?: string | null
  title?: string | null
  training_name?: string | null
  name?: string | null
}

const TABLE_LABELS: Record<string, string> = {
  residents: "Gyventojai",
  resident_contacts: "Kontaktai",
  resident_care_plans: "Globos planai",
  resident_daily_logs: "Kasdieniai įrašai",
  resident_handover_entries: "Perdavimo žurnalai",
  resident_isgp_goals: "ISGP planas",
  resident_incidents: "Incidentai",
  rooms: "Kambariai",
  tasks: "Užduotys",
  task_comments: "Užduočių komentarai",
  inventory_items: "Sandėlio prekės",
  inventory_issue_history: "Sandėlio judėjimai",
  inventory_transactions: "Sandėlio judėjimai",
  organization_members: "Darbuotojai",
  personnel_trainings: "Personalo mokymai",
  personnel_credentials: "Personalo dokumentai",
  personnel_positions: "Etatų planas",
  candidates: "Kandidatai",
  profiles: "Naudotojų profiliai",
  organization_invites: "Kvietimai",
  handover_logs: "Perdavimo žurnalai",
  handover_log_items: "Perdavimo žurnalo įrašai",
  reports: "Ataskaitos",
  report_exports: "Ataskaitų eksportai",
  medications: "Medicina",
  resident_medications: "Medicina",
  medication_administrations: "Vaistų administravimas",
  medication_administration_logs: "Medicina",
  medication_prn_logs: "Medicina",
  medication_logs: "Vaistų žurnalas",
  medicine_logs: "Medicinos žurnalas",
  resident_health_records: "Sveikatos įrašai",
  resident_vitals: "Medicina",
  resident_medical_notes: "Medicininės pastabos",
  vacation_requests: "Atostogų ir neatvykimų prašymai",
  document_verifications: "Dokumentų patikrinimai",
  staff_access: "Darbuotojų teisės",
  permissions: "Teisės",
  role_permissions: "Rolių teisės",
  user_permissions: "Individualios teisės",
}

const FIELD_LABELS: Record<string, string> = {
  title: "Pavadinimas",
  description: "Aprašymas",
  note: "Pastaba",
  contacts: "Kontaktai",
  assigned_staff_ids: "Atsakingi darbuotojai",
  authorization_basis: "Teisės pagrindas",
  authorization_notes: "Pagrindo pastaba",
  can_receive_info: "Gali gauti informaciją",
  is_primary: "Pagrindinis",
  relationship: "Ryšys",
  actions: "Veiksmai",
  responsible: "Atsakingas",
  review_date: "Peržiūros data",
  action_taken: "Atlikti veiksmai",
  incident_type: "Incidento tipas",
  severity: "Sunkumas",
  occurred_at: "Įvykio laikas",
  status: "Statusas",
  current_status: "Statusas",
  priority: "Prioritetas",
  assigned_to: "Atsakingas darbuotojas",
  created_by: "Sukūrė",
  resident_id: "Gyventojas",
  resident_name: "Gyventojas",
  category: "Kategorija",
  department: "Skyrius",
  due_date: "Terminas",
  completed_at: "Užbaigta",
  valid_until: "Galioja iki",
  hours: "Valandos",
  provider: "Teikėjas",
  training_name: "Mokymo pavadinimas",
  certificate_number: "Pažymėjimo nr.",
  approval_status: "Patvirtinimo būsena",
  approved_at: "Patvirtinta",
  verified_at: "Patikrinta",
  reviewed_at: "Peržiūrėta",
  employee_id: "Darbuotojas",
  recurrence_days: "Kartojimas",
  recurrence_until: "Kartoti iki",
  recurrence_parent_id: "Periodinės užduoties šaltinis",
  first_name: "Vardas",
  last_name: "Pavardė",
  full_name: "Vardas ir pavardė",
  resident_code: "Vidinis ID",
  birth_date: "Gimimo data",
  arrival_date: "Atvykimo data",
  current_room_id: "Kambarys",
  room_id: "Kambarys",
  room: "Kambarys",
  room_reserved_until: "Rezervuota iki",
  phone: "Telefonas",
  email: "El. paštas",
  address: "Adresas",
  notes: "Pastabos",
  name: "Pavadinimas",
  room_type: "Tipas",
  capacity: "Vietos",
  floor: "Aukštas",
  gender: "Lytis",
  occupied_by: "Užimta",
  reserved_for: "Rezervuota",
  reserved_until: "Rezervuota iki",
  room_status: "Kambario būsena",
  role: "Rolė",
  legacy_role: "Rolė",
  is_active: "Aktyvus",
  accepted_at: "Priimta",
  expires_at: "Galioja iki",
  invited_by: "Pakvietė",
  token: "Kvietimo kodas",
  item_name: "Prekė",
  item_id: "Prekė",
  quantity: "Kiekis",
  unit: "Mato vnt.",
  type: "Tipas",
  employee_full_name: "Darbuotojas",
  action: "Veiksmas",
  Veiksmas: "Veiksmas",
  Pavadinimas: "Pavadinimas",
  Statusas: "Statusas",
  Kambarys: "Kambarys",
  Gyventojas: "Gyventojas",
  Atsakingas: "Atsakingas darbuotojas",
  Vaistas: "Vaistas",
  Dozė: "Dozė",
  Laikas: "Laikas",
  "Vartojimo būdas": "Vartojimo būdas",
  Sandėlis: "Sandėlis",
  Darbuotojas: "Darbuotojas",
  Pastabos: "Pastabos",
  "Paskyrimo šaltinis": "Paskyrimo šaltinis",
  "Pagal poreikį": "Pagal poreikį",
  "Dviguba patikra": "Dviguba patikra",
  "Antras darbuotojas": "Antras darbuotojas",
  "Nurašyta iš sandėlio": "Nurašyta iš sandėlio",
  "Likutis po nurašymo": "Likutis po nurašymo",
  "Nurašoma per dozę": "Nurašoma per dozę",
  Priežastis: "Priežastis",
  AKS: "AKS",
  Pulsas: "Pulsas",
  Cukrus: "Cukrus",
  Temperatūra: "Temperatūra",
  Svoris: "Svoris",
  medication_name: "Vaistas",
  dose: "Dozė",
  scheduled_time: "Laikas",
  route: "Vartojimo būdas",
  prescription_source: "Paskyrimo šaltinis",
  prescribed_by: "Paskyrė",
  is_prn: "Pagal poreikį",
  requires_double_check: "Dviguba patikra",
  inventory_item_id: "Sandėlis",
  inventory_units_per_dose: "Nurašoma per dozę",
  prepared_by: "Paruošė",
  prepared_at: "Paruošta",
  given_by: "Sudavė",
  given_at: "Suduota",
  administered_by: "Registravo",
  administered_at: "Registruota",
  reason: "Priežastis",
  result: "Rezultatas",
  shift_date: "Pamainos data",
  shift_type: "Pamaina",
  is_important: "Svarbus įrašas",
  needs_follow_up: "Reikia tęsti",
  module: "Modulis",
  bp_sys: "AKS sistolinis",
  bp_dia: "AKS diastolinis",
  pulse: "Pulsas",
  sugar: "Cukrus",
  temperature: "Temperatūra",
  weight: "Svoris",
  Prekė: "Prekė",
  Tipas: "Tipas",
  Dydis: "Dydis / matmuo",
  Kiekis: "Kiekis",
  Kam: "Kam",
  Kas: "Kas grąžino",
  "Minimalus kiekis": "Minimalus kiekis",
  requested_days: "Prašoma dienų",
  Size: "Dydis / matmuo",
  size: "Dydis / matmuo",
  subcategory: "Potipis",
  Subcategory: "Potipis",
  Category: "Kategorija",
  employee_user_id: "Darbuotojas",
  employeeUserId: "Darbuotojas",
  "Employee User Id": "Darbuotojas",
  user_id: "Naudotojas",
  "User Id": "Naudotojas",
  is_external: "Išorinis",
  "Is External": "Išorinis",
  is_fractional: "Dalinis kiekis",
  "Is Fractional": "Dalinis kiekis",
  instructions: "Instrukcija",
  "Instructions": "Instrukcija",
  safety_notes: "Saugumo pastabos",
  "Safety Notes": "Saugumo pastabos",
  prescription_date: "Paskyrimo data",
  "Prescription Date": "Paskyrimo data",
  min_quantity: "Minimalus kiekis",
  "Min Quantity": "Minimalus kiekis",
  room_number: "Kambario numeris",
  "Room Number": "Kambario numeris",
  has_sink: "Kriauklė",
  "Has Sink": "Kriauklė",
  has_oxygen: "Deguonies įvadas",
  "Has Oxygen": "Deguonies įvadas",
  has_shower: "Dušas",
  "Has Shower": "Dušas",
  has_nursing: "Slaugos įranga",
  "Has Nursing": "Slaugos įranga",
  is_accessible: "Pritaikyta judėjimui",
  "Is Accessible": "Pritaikyta judėjimui",
  wheelchair_accessible: "Pritaikyta vežimėliui",
  "Wheelchair Accessible": "Pritaikyta vežimėliui",
  has_private_wc: "Privatus WC",
  "Has Private Wc": "Privatus WC",
  functional_bed: "Funkcinė lova",
  "Functional Bed": "Funkcinė lova",
  has_functional_bed: "Funkcinė lova",
  "Has Functional Bed": "Funkcinė lova",
  oxygen: "Deguonis",
  "Oxygen": "Deguonis",
  nursing: "Slauga",
  "Nursing": "Slauga",
  shower: "Dušas",
  "Shower": "Dušas",
  sink: "Kriauklė",
  "Sink": "Kriauklė",
  wc: "WC",
  "Wc": "WC",
  employment_rate: "Etato dydis",
  "Employment Rate": "Etato dydis",
  weekly_hours: "Savaitės valandos",
  "Weekly Hours": "Savaitės valandos",
  employment_type: "Darbo sutarties tipas",
  "Employment Type": "Darbo sutarties tipas",
  employment_start_date: "Darbo pradžia",
  "Employment Start Date": "Darbo pradžia",
  termination_date: "Darbo pabaiga",
  "Termination Date": "Darbo pabaiga",
  extra_permissions: "Papildomos teisės",
  "Extra Permissions": "Papildomos teisės",
  permissions: "Teisės",
  "Permissions": "Teisės",
  staff_type: "Darbuotojo tipas",
  "Staff Type": "Darbuotojo tipas",
  position: "Pareigos",
  "Position": "Pareigos",
  is_deputy: "Pavaduoja",
  "Is Deputy": "Pavaduoja",
  is_archived: "Archyvuotas",
  "Is Archived": "Archyvuotas",
  access_scope: "Prieigos apimtis",
  scope: "Prieigos apimtis",
  data_scope: "Duomenų apimtis",
  permission: "Teisė",
  permission_key: "Teisė",
  permission_code: "Teisė",
  module_key: "Modulis",
  module_name: "Modulis",
  access_group: "Pareigų grupė",
  access_level: "Prieigos lygis",
  base_permissions: "Bazinės teisės",
  effective_permissions: "Galutinės teisės",
  granted_permissions: "Suteiktos teisės",
  revoked_permissions: "Atimtos teisės",
  denied_permissions: "Uždraustos teisės",
  old_permissions: "Ankstesnės teisės",
  new_permissions: "Naujos teisės",
  can_view_sensitive: "Gali matyti jautrius duomenis",
  view_sensitive: "Jautrių duomenų peržiūra",
  export_sensitive: "Jautrių duomenų eksportas",
  sensitive_access: "Jautri prieiga",
  is_sensitive: "Jautru",
  allow_export: "Leidžiamas eksportas",
  allow_delete: "Leidžiamas trynimas",
  allow_approve: "Leidžiamas tvirtinimas",
  approved_by: "Patvirtino",
  rejected_by: "Atmetė",
  reviewed_by: "Peržiūrėjo",
  submitted_by: "Pateikė",
  checked_by: "Patikrino",
  checked_at: "Patikrinta",
  check_method: "Tikrinimo būdas",
  issuer: "Išdavėjas",
  issued_at: "Išduota",
  desired_role: "Pageidaujamos pareigos",
  experience: "Patirtis",
  consent: "Sutikimas",
}

const VALUE_LABELS: Record<string, string> = {
  insert: "Sukurta",
  update: "Atnaujinta",
  delete: "Ištrinta",
  pending: "Laukia patvirtinimo",
  accepted: "Priimtas",
  expired: "Pasibaigęs",
  cancelled: "Atšauktas",
  new: "Nauja",
  assigned: "Priskirta",
  in_progress: "Vykdoma",
  waiting: "Laukia informacijos",
  done: "Atlikta",
  overdue: "Pavėluota",
  arriving_soon: "Netrukus atvyks",
  active: "Gyvena",
  aktyvus: "Aktyvus",
  completed: "Užbaigta",
  in_review: "Peržiūrima",
  hospital: "Ligoninėje",
  temporary_leave: "Laikinai išvykęs",
  deceased: "Mirė",
  contract_ended: "Nutraukė sutartį",
  low: "Žemas",
  medium: "Vidutinis",
  high: "Aukštas",
  critical: "Kritinis",
  available: "Laisvas",
  occupied: "Užimtas",
  reserved: "Rezervuotas",
  owner: "Savininkas",
  admin: "Administratorius",
  employee: "Darbuotojas",
  male: "Vyrai",
  female: "Moterys",
  mixed: "Mišrus",
  true: "Taip",
  false: "Ne",
  prepared: "Paruošta",
  given: "Suduota",
  morning: "Rytinė",
  day: "Dieninė",
  evening: "Vakarinė",
  night: "Naktinė",
  other: "Kita",
  "handover_log.created": "Sukurtas perdavimo įrašas",
  "handover_log.confirmed_seen": "Patvirtinta, kad mačiau",
  "handover_log.comment_added": "Pridėtas komentaras",
  "handover_log.archived": "Archyvuotas perdavimo įrašas",
  "inventory.item_created": "Pridėta sandėlio prekė",
  "inventory.item_issued": "Išduota prekė gyventojui",
  "inventory.uniform_issued": "Išduota uniforma darbuotojui",
  "inventory.item_refilled": "Papildytas sandėlis",
  "inventory.uniform_returned": "Grąžinta uniforma",
  "Vaistas paskirtas": "Vaistas paskirtas",
  "p.r.n. registruota": "p.r.n. registruota",
  "Rodikliai įvesti": "Rodikliai įvesti",
  pending_approval: "Laukia patvirtinimo",
  approved: "Patvirtinta",
  rejected: "Atmesta",
  valid: "Galioja",
  invalid: "Negalioja",
  social_worker: "Socialinis darbuotojas",
  nurse: "Slaugytojas / medikas",
  doctor: "Gydytojas",
  activity_specialist: "Užimtumo specialistas",
  maintenance: "Ūkis",
  administration: "Administracija",
  care_worker: "Priežiūros darbuotojas",
  full_time: "Pilnas etatas",
  part_time: "Dalinis etatas",
  repair: "Remontuojamas",
  preparing: "Ruošiamas",
  bedding: "Patalynė",
  diapers: "Sauskelnės",
  medication: "Vaistai",
  uniform: "Uniformos",
  cleaning: "Valymo priemonės",
  hygiene: "Higienos prekės",
  sheet: "Paklodė",
  tape: "Lipnios sauskelnės",
  out: "Išduota / nurašyta",
  in: "Papildyta",
  vnt: "vnt.",
  kg: "kg",
  "training.approved": "Mokymas patvirtintas",
  "training.created": "Pridėtas mokymas",
  "training.updated": "Atnaujintas mokymas",
  "training.rejected": "Mokymas atmestas",
  "document.created": "Pridėtas dokumentas",
  "document.updated": "Atnaujintas dokumentas",
  "document.checked": "Dokumentas patikrintas",
  "document.acknowledged": "Dokumentas patvirtintas darbuotojo",
  "vacation.created": "Pateiktas prašymas",
  "vacation.approved": "Prašymas patvirtintas",
  "vacation.rejected": "Prašymas atmestas",
  "candidate.created": "Sukurtas kandidatas",
  "candidate.updated": "Atnaujintas kandidatas",
  "candidate.questionnaire_sent": "Kandidatui išsiųstas klausimynas",
  "candidate.hired": "Kandidatas priimtas",
  "employee.created": "Sukurtas darbuotojas",
  "employee.updated": "Atnaujinti darbuotojo duomenys",
  "employee.archived": "Darbuotojas archyvuotas",
  "employee.reactivated": "Darbuotojas aktyvuotas",
  "position_plan.created": "Sukurta pareigybės plano eilutė",
  "position_plan.updated": "Atnaujinta pareigybės plano eilutė",
  "position_plan.deleted": "Ištrinta pareigybės plano eilutė",
  "staff_type.updated": "Atnaujintos pareigos / teisės",
  "vacation_request.created": "Pateiktas prašymas",
  all: "Visi",
  department_only: "Tik skyrius",
  assigned_only: "Tik priskirti",
  own_created: "Tik savo sukurti",
  own_and_assigned: "Savo ir priskirti",
  read_only: "Tik skaitymas",
  limited: "Ribota prieiga",
  full_access: "Pilna prieiga",
  no_access: "Nėra prieigos",
  allowed: "Leidžiama",
  denied: "Draudžiama",
  granted: "Suteikta",
  revoked: "Atimta",
  sensitive: "Jautri prieiga",
  non_sensitive: "Įprasta prieiga",
  "staff_access.updated": "Atnaujintos darbuotojo teisės",
  "staff_access.permission_granted": "Suteikta papildoma teisė",
  "staff_access.permission_revoked": "Atimta papildoma teisė",
  "staff_access.scope_changed": "Pakeista prieigos apimtis",
  "staff_access.sensitive_changed": "Pakeista jautri prieiga",
  "permission.granted": "Suteikta teisė",
  "permission.revoked": "Atimta teisė",
  "permission.updated": "Atnaujinta teisė",
  "permissions.updated": "Atnaujintos teisės",
  "role.updated": "Pakeista rolė",
  "access.updated": "Atnaujinta prieiga",
  "position.updated": "Pakeistos pareigos",
  "document_verification.created": "Užregistruotas dokumento patikrinimas",
  "document_verification.updated": "Atnaujintas dokumento patikrinimas",
  "candidate.question_added": "Pridėtas kandidato klausimas",
  "candidate.question_removed": "Pašalintas kandidato klausimas",
}

const SHIFT_LABELS: Record<string, string> = {
  morning: "Rytinė",
  day: "Dieninė",
  evening: "Vakarinė",
  night: "Naktinė",
  other: "Kita",
}


const PERMISSION_LABELS: Record<string, string> = {
  "dashboard.view": "Darbalaukis",
  "tasks.view": "Užduotys: peržiūra",
  "tasks.create": "Užduotys: kūrimas",
  "tasks.manage": "Užduotys: valdymas",
  "residents.view_basic": "Gyventojai: bazinė informacija",
  "residents.view": "Gyventojai: peržiūra",
  "residents.create": "Gyventojai: kūrimas",
  "residents.update": "Gyventojai: redagavimas",
  "residents.delete": "Gyventojai: trynimas",
  "residents.view_sensitive": "Gyventojai: jautrūs duomenys",
  "residents.export": "Gyventojai: eksportas",
  "medicine.view": "Medicina: peržiūra",
  "medicine.create": "Medicina: kūrimas",
  "medicine.update": "Medicina: redagavimas",
  "medicine.manage": "Medicina: valdymas",
  "medicine.approve": "Medicina: tvirtinimas",
  "medicine.delete": "Medicina: trynimas",
  "handover.view": "Perdavimo žurnalai: peržiūra",
  "handover.create": "Perdavimo žurnalai: kūrimas",
  "handover.manage": "Perdavimo žurnalai: valdymas",
  "activities.manage": "Veiklos / užimtumas",
  "rooms.view": "Kambariai: peržiūra",
  "rooms.manage": "Kambariai: valdymas",
  "inventory.view": "Sandėlis: peržiūra",
  "inventory.issue": "Sandėlis: išdavimas",
  "inventory.manage": "Sandėlis: valdymas",
  "inventory.write_off": "Sandėlis: nurašymas",
  "employees.view": "Darbuotojai: peržiūra",
  "employees.manage": "Darbuotojai: valdymas",
  "employees.permissions": "Darbuotojai: teisių valdymas",
  "schedules.view": "Grafikai: peržiūra",
  "schedules.manage": "Grafikai: valdymas",
  "vacations.view": "Prašymai: peržiūra",
  "vacations.approve": "Prašymai: tvirtinimas",
  "trainings.view": "Mokymai: peržiūra",
  "trainings.manage": "Mokymai: valdymas",
  "trainings.approve": "Mokymai: tvirtinimas",
  "documents.view": "Dokumentai: peržiūra",
  "documents.manage": "Dokumentai: valdymas",
  "documents.verify": "Dokumentai: patikrinimas",
  "reports.view": "Ataskaitos: peržiūra",
  "reports.export": "Ataskaitos: eksportas",
  "audit.view": "Auditas: peržiūra",
  "audits.view": "Auditas: peržiūra",
}

function permissionValueLabel(value: string) {
  return PERMISSION_LABELS[value] || VALUE_LABELS[value] || value
}

function formatPermissionList(value: unknown) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(value)
            return Array.isArray(parsed) ? parsed : value.split(",")
          } catch {
            return value.split(",")
          }
        })()
      : []

  const labels = rawItems
    .map((item) => permissionValueLabel(String(item).trim()))
    .filter(Boolean)

  if (!labels.length) return "—"
  if (labels.length <= 5) return labels.join(", ")
  return `${labels.slice(0, 5).join(", ")} ir dar ${labels.length - 5}`
}

function isPermissionKey(key?: string) {
  return Boolean(key && /permission|permissions|teis/.test(String(key).toLowerCase()))
}

const HIDDEN_CHANGE_KEYS = new Set([
  "id",
  "module",
  "organization_id",
  "record_id",
  "entity_id",
  "entity_type",
  "table_name",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "source",
  "payload",
  "metadata",
  "profile_id",
])

const IMPORTANT_TABLES = new Set([
  "resident_medications",
  "medication_administration_logs",
  "medication_prn_logs",
  "resident_vitals",
  "resident_incidents",
  "handover_logs",
  "vacation_requests",
  "personnel_credentials",
  "document_verifications",
  "personnel_trainings",
  "candidates",
  "organization_members",
  "personnel_positions",
  "document_verifications",
])

function shiftValueLabel(value: unknown) {
  const str = String(value || "")
  return SHIFT_LABELS[str] || VALUE_LABELS[str] || str || "—"
}

function humanActionLabel(value: string) {
  const raw = String(value || "").trim()
  if (!raw) return "—"
  if (VALUE_LABELS[raw]) return VALUE_LABELS[raw]
  const normalized = raw.replaceAll("_", ".").toLowerCase()
  if (VALUE_LABELS[normalized]) return VALUE_LABELS[normalized]
  if (normalized.includes("training") && normalized.includes("approved")) return "Mokymas patvirtintas"
  if (normalized.includes("training") && normalized.includes("rejected")) return "Mokymas atmestas"
  if (normalized.includes("training") && normalized.includes("created")) return "Pridėtas mokymas"
  if (normalized.includes("vacation") && normalized.includes("approved")) return "Prašymas patvirtintas"
  if (normalized.includes("vacation") && normalized.includes("rejected")) return "Prašymas atmestas"
  if (normalized.includes("vacation") && normalized.includes("created")) return "Pateiktas prašymas"
  if (normalized.includes("candidate") && normalized.includes("questionnaire")) return "Kandidatui išsiųstas klausimynas"
  if (normalized.includes("candidate") && normalized.includes("hired")) return "Kandidatas priimtas"
  if (normalized.includes("candidate") && normalized.includes("created")) return "Sukurtas kandidatas"
  if (normalized.includes("employee") && normalized.includes("archived")) return "Darbuotojas archyvuotas"
  if (normalized.includes("employee") && normalized.includes("created")) return "Sukurtas darbuotojas"
  if (normalized.includes("employee") && normalized.includes("updated")) return "Atnaujinti darbuotojo duomenys"
  if (normalized.includes("permission") && normalized.includes("granted")) return "Suteikta teisė"
  if (normalized.includes("permission") && normalized.includes("revoked")) return "Atimta teisė"
  if (normalized.includes("permission") && normalized.includes("updated")) return "Atnaujintos teisės"
  if (normalized.includes("staff") && normalized.includes("access")) return "Atnaujintos darbuotojo teisės"
  if (normalized.includes("role") && normalized.includes("updated")) return "Pakeista rolė"
  if (normalized.includes("scope") && normalized.includes("changed")) return "Pakeista prieigos apimtis"
  if (normalized.endsWith(".created")) return "Sukurta"
  if (normalized.endsWith(".updated")) return "Atnaujinta"
  if (normalized.endsWith(".deleted")) return "Ištrinta"
  if (normalized.includes("confirmed_seen")) return "Patvirtinta, kad mačiau"
  if (normalized.includes("comment")) return "Komentaras"
  if (normalized.includes("archived")) return "Archyvuota"
  return raw.replaceAll("_", " ").replaceAll(".", " ").replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
}

function actionKind(value: string) {
  const normalized = String(value || "").toLowerCase()
  if (normalized.includes("delete") || normalized.includes("deleted") || normalized.includes("ištr")) return "delete"
  if (normalized.includes("insert") || normalized.includes("created") || normalized.includes("sukurt")) return "insert"
  if (normalized.includes("archive")) return "archive"
  if (normalized.includes("confirmed") || normalized.includes("seen")) return "seen"
  if (normalized.includes("comment")) return "comment"
  if (normalized.includes("approved") || normalized.includes("granted") || normalized.includes("confirmed")) return "insert"
  if (normalized.includes("rejected") || normalized.includes("revoked") || normalized.includes("denied")) return "delete"
  return "update"
}

function dayHeading(value?: string | null) {
  if (!value) return "Be datos"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Be datos"

  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const key = date.toISOString().slice(0, 10)
  const todayKey = today.toISOString().slice(0, 10)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)

  if (key === todayKey) return "Šiandien"
  if (key === yesterdayKey) return "Vakar"

  return date.toLocaleDateString("lt-LT", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function tableLabel(value: string) {
  if (TABLE_LABELS[value]) return TABLE_LABELS[value]
  if (!value) return "Kita"

  const normalized = value.toLowerCase()
  if (normalized.includes("inventory")) return "Sandėlio judėjimai"
  if (normalized.includes("medication") || normalized.includes("medicine")) return "Medicina"
  if (normalized.includes("handover")) return "Perdavimo žurnalai"
  if (normalized.includes("resident")) return "Gyventojai"
  if (normalized.includes("profile")) return "Naudotojų profiliai"
  if (normalized.includes("member") || normalized.includes("employee")) return "Darbuotojai"

  return "Kita"
}

function fieldLabel(value: string) {
  if (FIELD_LABELS[value]) return FIELD_LABELS[value]
  if (PERMISSION_LABELS[value]) return PERMISSION_LABELS[value]
  if (!value) return "—"
  return value
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
}

function actionLabel(value: string) {
  return humanActionLabel(value)
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("lt-LT")
}

function profileName(profile?: Profile | null) {
  if (!profile) return null
  const fullName = String(profile.full_name || "").trim()
  const firstName = String(profile.first_name || "").trim()
  const lastName = String(profile.last_name || "").trim()
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim()
  return fullName || combined || profile.email || null
}

function residentName(resident?: Resident | null, roomsById?: Record<string, string>) {
  if (!resident) return null
  const fullName = String(resident.full_name || "").trim()
  const firstName = String(resident.first_name || "").trim()
  const lastName = String(resident.last_name || "").trim()
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim()
  const name = fullName || combined || "Gyventojas"
  const code = resident.resident_code ? ` · ${resident.resident_code}` : ""
  const room = resident.current_room_id && roomsById?.[resident.current_room_id] ? ` · ${roomsById[resident.current_room_id]}` : ""
  return `${name}${code}${room}`
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function singularTableLabel(tableName: string) {
  const labels: Record<string, string> = {
    residents: "Gyventojas",
    resident_contacts: "Kontaktas",
    resident_handover_entries: "Perdavimo įrašas",
    resident_isgp_goals: "ISGP tikslas",
    rooms: "Kambarys",
    tasks: "Užduotis",
    organization_members: "Darbuotojas",
    personnel_trainings: "Mokymas",
    profiles: "Naudotojas",
    organization_invites: "Kvietimas",
    handover_logs: "Perdavimo įrašas",
    report_exports: "Ataskaita",
    resident_medications: "Vaistas",
    medication_administration_logs: "Vaistų veiksmas",
    medication_prn_logs: "p.r.n. įrašas",
    resident_vitals: "Rodikliai",
  }

  return labels[tableName] || tableLabel(tableName)
}

function valuesDiffer(before: unknown, after: unknown) {
  return String(before ?? "") !== String(after ?? "")
}

function diffObjects(before: Record<string, unknown>, after: Record<string, unknown>) {
  const result: Record<string, { from: unknown; to: unknown }> = {}
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]))

  keys.forEach((key) => {
    if ([
      "id",
      "created_at",
      "updated_at",
      "organization_id",
      "created_by",
      "resident_id",
      "inventory_item_id",
      "medication_id",
    ].includes(key)) return

    const oldValue = before?.[key] ?? null
    const newValue = after?.[key] ?? null

    if (valuesDiffer(oldValue, newValue)) {
      result[key] = { from: oldValue, to: newValue }
    }
  })

  return result
}

function normalizeAuditRow(row: Record<string, unknown>, sourceTable: "audit_log" | "audit_logs"): AuditLog {
  const changedAt = String(row.changed_at || row.created_at || row.inserted_at || "") || null
  const tableName = String(row.table_name || row.entity_type || row.entity || "—")
  const recordId = String(row.record_id || row.entity_id || row.record || "") || null
  const changedBy = String(row.changed_by || row.user_id || row.actor || row.created_by || "") || null
  const rawChanges = row.changes || row.metadata || row.payload
  const changes = rawChanges && typeof rawChanges === "object" && !Array.isArray(rawChanges)
    ? rawChanges as Record<string, unknown>
    : {}

  return {
    ...row,
    id: String(row.id || `${sourceTable}-${tableName}-${recordId || "record"}-${changedAt || Math.random()}`),
    organization_id: String(row.organization_id || "") || null,
    table_name: tableName,
    record_id: recordId,
    action: String(row.action || "update"),
    changed_by: changedBy,
    actor: String(row.actor || row.user_id || changedBy || "") || null,
    user_id: String(row.user_id || changedBy || "") || null,
    changed_at: changedAt,
    created_at: String(row.created_at || changedAt || "") || null,
    changes,
  }
}

async function loadAuditTable(tableName: "audit_log" | "audit_logs", orgId: string | null) {
  let query = supabase.from(tableName).select("*")

  if (orgId) {
    query = query.eq("organization_id", orgId)
  }

  const { data, error } = await query.limit(1000)

  if (error) {
    console.warn(`[audit] ${tableName} skipped:`, error.message)
    return [] as AuditLog[]
  }

  return ((data || []) as Record<string, unknown>[]).map((row) => normalizeAuditRow(row, tableName))
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [tableFilter, setTableFilter] = useState("")
  const [quickFilter, setQuickFilter] = useState<"all" | "today" | "warning" | "danger">("all")

  const [profilesById, setProfilesById] = useState<Record<string, string>>({})
  const [residentsById, setResidentsById] = useState<Record<string, string>>({})
  const [roomsById, setRoomsById] = useState<Record<string, string>>({})
  const [tasksById, setTasksById] = useState<Record<string, string>>({})
  const [membersById, setMembersById] = useState<Record<string, string>>({})
  const [trainingsById, setTrainingsById] = useState<Record<string, string>>({})

  useEffect(() => {
    void loadLogs()
  }, [])

  async function loadLogs() {
    try {
      setLoading(true)
      setMessage("")

      const orgId = await getCurrentOrganizationId()

      const [legacyAuditRows, modernAuditRows] = await Promise.all([
        loadAuditTable("audit_log", orgId),
        loadAuditTable("audit_logs", orgId),
      ])

      const auditRows = [...legacyAuditRows, ...modernAuditRows]
        .sort((a, b) => String(b.changed_at || b.created_at || "").localeCompare(String(a.changed_at || a.created_at || "")))
        .slice(0, 1000)

      setLogs(auditRows)

      const userIds = Array.from(
        new Set(
          auditRows
            .flatMap((row) => {
              const ids: string[] = []
              if (row.changed_by) ids.push(row.changed_by)
              if (row.actor) ids.push(row.actor)
              if (
                row.record_id &&
                (row.table_name === "organization_members" || row.table_name === "profiles")
              ) {
                ids.push(row.record_id)
              }
              Object.entries(row.changes || {}).forEach(([key, value]) => {
                const pushValue = (v: unknown) => {
                  if (typeof v === "string" && isUuidLike(v)) ids.push(v)
                }

                if (key === "assigned_to" || key === "created_by" || key === "invited_by" || key === "employee_id") {
                  if (value && typeof value === "object" && "from" in value && "to" in value) {
                    const item = value as { from: unknown; to: unknown }
                    pushValue(item.from)
                    pushValue(item.to)
                  } else {
                    pushValue(value)
                  }
                }
              })
              return ids
            })
            .filter(Boolean)
        )
      )

      let nextProfilesById: Record<string, string> = {}

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, first_name, last_name, email")
          .in("id", userIds)

        nextProfilesById = Object.fromEntries(
          ((profilesData || []) as Profile[]).map((profile) => [
            profile.id,
            profileName(profile) || profile.id,
          ])
        )
      }

      if (orgId) {
        const [residentsResult, roomsResult, tasksResult, membersResult, trainingsResult] = await Promise.all([
          supabase
            .from("residents")
            .select("id, full_name, first_name, last_name, resident_code, current_room_id")
            .eq("organization_id", orgId),

          supabase
            .from("rooms")
            .select("id, name")
            .eq("organization_id", orgId),

          supabase
            .from("tasks")
            .select("id, title, resident_id")
            .eq("organization_id", orgId),

          supabase
            .from("organization_members")
            .select("id, user_id, role, position, department")
            .eq("organization_id", orgId),

          supabase
            .from("personnel_trainings")
            .select("id, employee_id, title, training_name, name")
            .eq("organization_id", orgId),
        ])

        const memberRows = (membersResult.data || []) as OrganizationMember[]
        const trainingRows = (trainingsResult.data || []) as PersonnelTraining[]
        const extraUserIds = Array.from(
          new Set(
            [
              ...memberRows.map((member) => member.user_id),
              ...trainingRows.map((training) => training.employee_id),
            ].filter((id): id is string => Boolean(id && !nextProfilesById[id]))
          )
        )

        if (extraUserIds.length > 0) {
          const { data: extraProfiles } = await supabase
            .from("profiles")
            .select("id, full_name, first_name, last_name, email")
            .in("id", extraUserIds)

          nextProfilesById = {
            ...nextProfilesById,
            ...Object.fromEntries(
              ((extraProfiles || []) as Profile[]).map((profile) => [
                profile.id,
                profileName(profile) || profile.id,
              ])
            ),
          }
        }

        const roomMap = Object.fromEntries(
          ((roomsResult.data || []) as Room[]).map((room) => [
            room.id,
            room.name || "Kambarys",
          ])
        )

        const residentMap = Object.fromEntries(
          ((residentsResult.data || []) as Resident[]).map((resident) => [
            resident.id,
            residentName(resident, roomMap) || resident.id,
          ])
        )

        const taskMap = Object.fromEntries(
          ((tasksResult.data || []) as Task[]).map((task) => [
            task.id,
            [task.title || "Užduotis", task.resident_id ? residentMap[task.resident_id] : null]
              .filter(Boolean)
              .join(" · "),
          ])
        )

        const memberMap = Object.fromEntries(
          memberRows.flatMap((member) => {
            const label =
              (member.user_id && nextProfilesById[member.user_id]) ||
              member.position ||
              member.role ||
              "Darbuotojas"
            return [member.id, member.user_id]
              .filter((id): id is string => Boolean(id))
              .map((id) => [id, label])
          })
        )

        const trainingMap = Object.fromEntries(
          trainingRows.map((training) => {
            const title = training.title || training.training_name || training.name || "Mokymas"
            const employee = training.employee_id ? nextProfilesById[training.employee_id] : null
            return [
              training.id,
              employee ? `${title} · ${employee}` : title,
            ]
          })
        )

        setRoomsById(roomMap)
        setResidentsById(residentMap)
        setTasksById(taskMap)
        setMembersById(memberMap)
        setTrainingsById(trainingMap)
      } else {
        setMembersById({})
        setTrainingsById({})
      }

      setProfilesById(nextProfilesById)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nepavyko įkelti audito žurnalo.")
    } finally {
      setLoading(false)
    }
  }

  function cleanValue(value: unknown, key?: string): string {
    if (value === null || value === undefined || value === "") return "—"
    if (typeof value === "boolean") return value ? "Taip" : "Ne"

    if (Array.isArray(value)) {
      if (key === "contacts") return `Kontaktai atnaujinti (${value.length})`
      if (key === "assigned_staff_ids") return value.map((item) => cleanValue(item, "employee_id")).join(", ") || "—"
      if (isPermissionKey(key)) return formatPermissionList(value)
      return value.length ? `Atnaujinta (${value.length})` : "—"
    }

    if (typeof value === "object") {
      if (key === "contacts") return "Kontaktai atnaujinti"
      return "Atnaujinta"
    }

    if (key === "recurrence_days") {
      const n = Number(value)
      return n > 0 ? `Kas ${n} d.` : "—"
    }

    const str = String(value)

    if (isPermissionKey(key)) return formatPermissionList(str)
    if (PERMISSION_LABELS[str]) return PERMISSION_LABELS[str]

    if (key === "shift_type") return shiftValueLabel(str)
    if (key === "module") return tableLabel(str)

    if (
      key === "assigned_to" ||
      key === "created_by" ||
      key === "invited_by" ||
      key === "employee_id" ||
      key === "changed_by" ||
      key === "prepared_by" ||
      key === "given_by" ||
      key === "administered_by" ||
      key === "measured_by"
    ) {
      return profilesById[str] || membersById[str] || str
    }

    if (
      key === "resident_id" ||
      key === "resident_name" ||
      key === "resident" ||
      key === "occupied_by" ||
      key === "reserved_for" ||
      key === "Gyventojas"
    ) {
      return residentsById[str] || str
    }

    if (
      key === "current_room_id" ||
      key === "room_id" ||
      key === "room" ||
      key === "Kambarys"
    ) {
      return roomsById[str] || str
    }

    if (key === "task_id" || key === "recurrence_parent_id") {
      return tasksById[str] || str
    }

    if (key === "training_id") {
      return trainingsById[str] || str
    }

    if (VALUE_LABELS[str]) return VALUE_LABELS[str]

    if (isUuidLike(str)) {
      return profilesById[str] || membersById[str] || trainingsById[str] || residentsById[str] || roomsById[str] || tasksById[str] || "Susijęs įrašas"
    }

    if (str.length > 120) return `${str.slice(0, 120)}…`

    return str
  }

  function renderChangeValue(key: string, value: unknown) {
    if (value && typeof value === "object" && "from" in value && "to" in value) {
      const item = value as { from: unknown; to: unknown }

      return (
        <span style={styles.changeValue}>
          {cleanValue(item.from, key)} → {cleanValue(item.to, key)}
        </span>
      )
    }

    return <span style={styles.changeValue}>{cleanValue(value, key)}</span>
  }

  function normalizeChanges(changes: Record<string, unknown> | null) {
    if (!changes || Object.keys(changes).length === 0) return {}

    const source = ("old" in changes || "new" in changes)
      ? diffObjects(
          changes.old && typeof changes.old === "object" ? changes.old as Record<string, unknown> : {},
          changes.new && typeof changes.new === "object" ? changes.new as Record<string, unknown> : {},
        )
      : changes

    return Object.fromEntries(
      Object.entries(source).filter(([key, value]) => {
        if (HIDDEN_CHANGE_KEYS.has(key)) return false
        if (value === null || value === undefined || value === "") return false
        if (value && typeof value === "object" && "from" in value && "to" in value) {
          const item = value as { from: unknown; to: unknown }
          return valuesDiffer(item.from, item.to)
        }
        return true
      }),
    )
  }

  function renderChanges(changes: Record<string, unknown> | null) {
    const normalized = normalizeChanges(changes)

    if (Object.keys(normalized).length === 0) {
      return <span style={styles.muted}>—</span>
    }

    return (
      <div style={styles.changesList}>
        {Object.entries(normalized).map(([key, value]) => (
          <div key={key} style={styles.changeItem}>
            <strong>{fieldLabel(key)}</strong>
            {renderChangeValue(key, value)}
          </div>
        ))}
      </div>
    )
  }

  function changeCurrentValue(changes: Record<string, unknown> | null, keys: string[]) {
    const normalized = normalizeChanges(changes)

    for (const key of keys) {
      const value = normalized[key]
      if (value && typeof value === "object" && "to" in value) {
        const item = value as { to: unknown }
        if (item.to !== null && item.to !== undefined && item.to !== "") return cleanValue(item.to, key)
      }

      if (value !== null && value !== undefined && value !== "") return cleanValue(value, key)
    }

    return null
  }

  function recordName(log: AuditLog) {
    if (!log.record_id) return "—"
    if (log.table_name === "residents") return residentsById[log.record_id] || log.record_id
    if (log.table_name === "rooms") return roomsById[log.record_id] || log.record_id
    if (log.table_name === "tasks") return tasksById[log.record_id] || log.record_id
    if (log.table_name === "organization_members" || log.table_name === "profiles") {
      return membersById[log.record_id] || profilesById[log.record_id] || changeCurrentValue(log.changes, ["full_name", "employee_full_name", "email"]) || "Darbuotojas"
    }
    if (log.table_name === "resident_contacts") {
      return changeCurrentValue(log.changes, ["full_name", "name", "resident_id", "phone", "email"]) || "Kontaktas"
    }
    if (log.table_name === "resident_handover_entries") {
      return changeCurrentValue(log.changes, ["note", "category", "resident_id"]) || "Perdavimo įrašas"
    }
    if (log.table_name === "resident_isgp_goals") {
      return changeCurrentValue(log.changes, ["title", "description", "resident_id"]) || "ISGP tikslas"
    }
    if (log.table_name === "personnel_trainings") {
      return trainingsById[log.record_id] || changeCurrentValue(log.changes, ["title", "training_name", "name", "employee_id"]) || "Mokymas"
    }
    if (log.table_name === "personnel_credentials" || log.table_name === "document_verifications") {
      return changeCurrentValue(log.changes, ["type", "document_type", "employee_id", "number", "certificate_number"]) || "Dokumentas"
    }
    if (log.table_name === "candidates") {
      return changeCurrentValue(log.changes, ["full_name", "first_name", "last_name", "email", "desired_role"]) || "Kandidatas"
    }
    if (log.table_name === "vacation_requests") {
      const employee = changeCurrentValue(log.changes, ["employee_id", "employee_full_name"]) || ""
      const type = changeCurrentValue(log.changes, ["type"]) || "Prašymas"
      const start = changeCurrentValue(log.changes, ["start_date"]) || ""
      const end = changeCurrentValue(log.changes, ["end_date"]) || ""
      return [type, employee, [start, end].filter(Boolean).join("–")].filter(Boolean).join(" · ") || "Prašymas"
    }
    if (log.table_name === "handover_logs") {
      return changeCurrentValue(log.changes, ["title", "Pavadinimas", "category", "Kategorija"]) || "Perdavimo įrašas"
    }
    if (["resident_medications", "medication_administration_logs", "medication_prn_logs", "resident_vitals"].includes(log.table_name)) {
      const resident = changeCurrentValue(log.changes, ["Gyventojas", "resident_id"]) || ""
      const medication = changeCurrentValue(log.changes, ["Vaistas", "medication_name"]) || ""
      const dose = changeCurrentValue(log.changes, ["Dozė", "dose"]) || ""
      const action = changeCurrentValue(log.changes, ["Veiksmas", "status"]) || ""

      return [resident, medication, dose, action]
        .filter(Boolean)
        .join(" • ") || singularTableLabel(log.table_name)
    }
    if (isUuidLike(log.record_id)) return singularTableLabel(log.table_name)
    return log.record_id
  }

  function actorName(log: AuditLog) {
    const actorId = log.changed_by || log.actor || log.user_id
    if (!actorId) return "—"
    return profilesById[actorId] || actorId
  }

  function riskLevel(log: AuditLog) {
    const normalized = normalizeChanges(log.changes)
    const priority = String(changeCurrentValue(log.changes, ["priority", "Prioritetas"]) || "").toLowerCase()
    const category = String(changeCurrentValue(log.changes, ["category", "Kategorija"]) || "").toLowerCase()
    const action = String(log.action || "").toLowerCase()

    if (action.includes("delete") || action.includes("deleted")) return "danger"
    if (priority === "critical" || category.includes("incident")) return "danger"
    if (priority === "high" || IMPORTANT_TABLES.has(log.table_name)) return "warning"
    if (Object.keys(normalized).some((key) => ["is_important", "needs_follow_up"].includes(key))) return "warning"
    return "normal"
  }

  function rowStyle(log: AuditLog) {
    const risk = riskLevel(log)
    if (risk === "danger") return { ...styles.tr, ...styles.trDanger }
    if (risk === "warning") return { ...styles.tr, ...styles.trWarning }
    return styles.tr
  }

  function actionBadgeStyle(action: string) {
    const kind = actionKind(action)
    if (kind === "delete") return { ...styles.badge, ...styles.badgeDanger }
    if (kind === "insert") return { ...styles.badge, ...styles.badgeSuccess }
    if (kind === "archive") return { ...styles.badge, ...styles.badgeNeutral }
    if (kind === "seen") return { ...styles.badge, ...styles.badgeMuted }
    if (kind === "comment") return { ...styles.badge, ...styles.badgeComment }
    return { ...styles.badge, ...styles.badgeInfo }
  }

  function riskBadge(log: AuditLog) {
    const risk = riskLevel(log)
    if (risk === "danger") return <span style={{ ...styles.riskBadge, ...styles.riskDanger }}>Rizika</span>
    if (risk === "warning") return <span style={{ ...styles.riskBadge, ...styles.riskWarning }}>Svarbu</span>
    return null
  }


  const tableOptions = useMemo(() => {
    return Array.from(new Set<string>(logs.map((log) => tableLabel(log.table_name))))
      .filter((label) => label && label !== "Kita")
      .sort((a, b) => a.localeCompare(b, "lt"))
  }, [logs])

  const actionOptions = useMemo(() => {
    return Array.from(new Set<string>(logs.map((log) => log.action).filter(Boolean))).sort((a, b) =>
      actionLabel(a).localeCompare(actionLabel(b), "lt")
    )
  }, [logs])

  const q = search.trim().toLowerCase()
  const auditRows = logs.filter((log) => Object.keys(normalizeChanges(log.changes)).length > 0)

  const allCount = auditRows.length
  const allTodayCount = auditRows.filter((log) => dayHeading(log.changed_at || log.created_at) === "Šiandien").length
  const allWarningCount = auditRows.filter((log) => riskLevel(log) === "warning").length
  const allDangerCount = auditRows.filter((log) => riskLevel(log) === "danger").length

  const filteredLogs = auditRows.filter((log) => {
    if (actionFilter && log.action !== actionFilter) return false
    if (tableFilter && tableLabel(log.table_name) !== tableFilter) return false
    if (quickFilter === "today" && dayHeading(log.changed_at || log.created_at) !== "Šiandien") return false
    if (quickFilter === "warning" && riskLevel(log) !== "warning") return false
    if (quickFilter === "danger" && riskLevel(log) !== "danger") return false

    if (!q) return true

    return [
      log.table_name,
      tableLabel(log.table_name),
      log.action,
      actionLabel(log.action),
      log.record_id,
      recordName(log),
      actorName(log),
      log.changed_by,
      log.actor,
      JSON.stringify(log.changes || {}),
    ]
      .join(" ")
      .toLowerCase()
      .includes(q)
  })

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, AuditLog[]>()

    filteredLogs.forEach((log) => {
      const heading = dayHeading(log.changed_at || log.created_at)
      const current = groups.get(heading) || []
      current.push(log)
      groups.set(heading, current)
    })

    return Array.from(groups.entries())
  }, [filteredLogs])

  const highRiskCount = filteredLogs.filter((log) => riskLevel(log) === "danger").length
  const todayCount = filteredLogs.filter((log) => dayHeading(log.changed_at || log.created_at) === "Šiandien").length

  return (
    <div style={styles.page}>
      <div style={styles.headerTop}>
        <Link href="/dashboard" style={styles.back}>
          <ArrowLeft size={16} />
          Grįžti
        </Link>

        <button type="button" onClick={() => void loadLogs()} style={styles.refreshButton}>
          <RefreshCw size={16} />
          Atnaujinti
        </button>
      </div>

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroIcon}>
            <ShieldCheck size={30} />
          </div>
          <div>
            <div style={styles.eyebrow}>Sistemos kontrolė</div>
            <h1 style={styles.title}>Audito žurnalas</h1>
            <p style={styles.subtitle}>Aiškiai matyk, kas, kada ir ką pakeitė sistemoje.</p>
          </div>
        </div>

        <div style={styles.heroStats}>
          <div style={styles.heroStat}>
            <strong>{filteredLogs.length}</strong>
            <span>Rodoma</span>
          </div>
          <div style={styles.heroStat}>
            <strong>{todayCount}</strong>
            <span>Šiandien</span>
          </div>
          <div style={highRiskCount > 0 ? styles.heroStatDanger : styles.heroStat}>
            <strong>{highRiskCount}</strong>
            <span>Rizikos</span>
          </div>
        </div>
      </section>

      {message ? <div style={styles.message}>{message}</div> : null}

      <section style={styles.quickStats} aria-label="Greitieji audito filtrai">
        <button
          type="button"
          onClick={() => setQuickFilter("all")}
          style={quickFilter === "all" ? { ...styles.quickStatCard, ...styles.quickStatActive } : styles.quickStatCard}
        >
          <ShieldCheck size={20} />
          <div style={styles.quickStatText}>
            <strong>{allCount}</strong>
            <span>Visi audito įrašai</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setQuickFilter("today")}
          style={quickFilter === "today" ? { ...styles.quickStatCard, ...styles.quickStatActive } : styles.quickStatCard}
        >
          <CalendarDays size={20} />
          <div style={styles.quickStatText}>
            <strong>{allTodayCount}</strong>
            <span>Šiandienos veiksmai</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setQuickFilter("warning")}
          style={quickFilter === "warning" ? { ...styles.quickStatWarning, ...styles.quickStatActive } : styles.quickStatWarning}
        >
          <Sparkles size={20} />
          <div style={styles.quickStatText}>
            <strong>{allWarningCount}</strong>
            <span>Svarbūs pakeitimai</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setQuickFilter("danger")}
          style={quickFilter === "danger" ? { ...styles.quickStatDanger, ...styles.quickStatActive } : styles.quickStatDanger}
        >
          <AlertTriangle size={20} />
          <div style={styles.quickStatText}>
            <strong>{allDangerCount}</strong>
            <span>Rizikos / kritiniai</span>
          </div>
        </button>
      </section>

      <section style={styles.filters}>
        <label style={styles.fieldWide}>
          <span><Search size={14} /> Paieška</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ieškoti pagal modulį, darbuotoją, gyventoją, veiksmą, pakeitimą..."
            style={styles.input}
          />
        </label>

        <label style={styles.field}>
          <span><Filter size={14} /> Veiksmas</span>
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} style={styles.input}>
            <option value="">Visi</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>{actionLabel(action)}</option>
            ))}
          </select>
        </label>

        <label style={styles.field}>
          <span>Modulis</span>
          <select value={tableFilter} onChange={(event) => setTableFilter(event.target.value)} style={styles.input}>
            <option value="">Visi</option>
            {tableOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            setSearch("")
            setActionFilter("")
            setTableFilter("")
            setQuickFilter("all")
          }}
          style={styles.clearButton}
        >
          Valyti
        </button>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.cardKicker}>Įrašai</div>
            <h2 style={styles.sectionTitle}>Audito įvykiai</h2>
          </div>
          <div style={styles.meta}>{loading ? "Kraunama..." : `Rodoma: ${filteredLogs.length}`}</div>
        </div>

        {filteredLogs.length === 0 ? (
          <div style={styles.empty}>Audito įrašų pagal pasirinktus filtrus nėra.</div>
        ) : (
          <div style={styles.tableWrap}>
            {groupedLogs.map(([group, groupLogs]) => (
              <div key={group} style={styles.groupBlock}>
                <div style={styles.groupHeading}>{group}</div>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Laikas</th>
                      <th style={styles.th}>Veiksmas</th>
                      <th style={styles.th}>Kas keitė</th>
                      <th style={styles.th}>Vieta</th>
                      <th style={styles.th}>Įrašas</th>
                      <th style={styles.th}>Pakeitimai</th>
                    </tr>
                  </thead>

                  <tbody>
                    {groupLogs.map((log) => (
                      <tr key={log.id} style={rowStyle(log)}>
                        <td style={styles.tdTime}>{formatDate(log.changed_at || log.created_at)}</td>

                        <td style={styles.td}>
                          <div style={styles.actionCell}>
                            <span style={actionBadgeStyle(log.action)}>{actionLabel(log.action)}</span>
                            {riskBadge(log)}
                          </div>
                        </td>

                        <td style={styles.tdBold}>{actorName(log)}</td>

                        <td style={styles.tdBold}>{tableLabel(log.table_name)}</td>

                        <td style={styles.tdRecord}>
                          <strong>{recordName(log)}</strong>
                          {null}
                        </td>

                        <td style={styles.td}>{renderChanges(log.changes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 24,
    display: "grid",
    gap: 18,
    background: "#f3f6f4",
    color: "#10251f",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  back: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#047857",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 900,
  },
  refreshButton: {
    border: "1px solid #c9d8d0",
    background: "#ffffff",
    color: "#486b5d",
    borderRadius: 14,
    padding: "11px 15px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 10px 26px rgba(15,23,42,.06)",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 18,
    background: "linear-gradient(135deg, #486b5d 0%, #064e3b 55%, #022c22 100%)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 30,
    padding: 26,
    color: "#ffffff",
    boxShadow: "0 22px 60px rgba(2,44,34,.18)",
  },
  heroContent: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    minWidth: 0,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    background: "rgba(255,255,255,.14)",
    color: "#d1fae5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  eyebrow: {
    color: "#bbf7d0",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.22em",
  },
  title: {
    margin: "5px 0",
    color: "#ffffff",
    fontSize: 38,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.045em",
  },
  subtitle: {
    margin: 0,
    color: "rgba(255,255,255,.82)",
    fontSize: 15,
    fontWeight: 750,
  },
  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(100px, 1fr))",
    gap: 10,
  },
  heroStat: {
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 18,
    background: "rgba(255,255,255,.10)",
    padding: "13px 15px",
    display: "grid",
    gap: 3,
    minWidth: 110,
  },
  heroStatDanger: {
    border: "1px solid rgba(254,202,202,.48)",
    borderRadius: 18,
    background: "rgba(127,29,29,.28)",
    padding: "13px 15px",
    display: "grid",
    gap: 3,
    minWidth: 110,
  },
  message: {
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    borderRadius: 18,
    padding: 14,
    fontSize: 14,
    fontWeight: 850,
  },
  quickStats: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
    gap: 14,
  },
  quickStatCard: {
    appearance: "none",
    width: "100%",
    border: "1px solid #dbe6e0",
    borderRadius: 22,
    background: "#ffffff",
    padding: "18px 22px",
    color: "#486b5d",
    boxShadow: "0 10px 28px rgba(15,23,42,.06)",
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr)",
    alignItems: "center",
    gap: 14,
    cursor: "pointer",
    textAlign: "left",
  },
  quickStatWarning: {
    appearance: "none",
    width: "100%",
    border: "1px solid #fde68a",
    borderRadius: 22,
    background: "#fffbeb",
    padding: "18px 22px",
    color: "#92400e",
    boxShadow: "0 10px 28px rgba(15,23,42,.06)",
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr)",
    alignItems: "center",
    gap: 14,
    cursor: "pointer",
    textAlign: "left",
  },
  quickStatDanger: {
    appearance: "none",
    width: "100%",
    border: "1px solid #fecaca",
    borderRadius: 22,
    background: "#fff1f2",
    padding: "18px 22px",
    color: "#be123c",
    boxShadow: "0 10px 28px rgba(15,23,42,.06)",
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr)",
    alignItems: "center",
    gap: 14,
    cursor: "pointer",
    textAlign: "left",
  },
  quickStatActive: {
    outline: "4px solid rgba(4,120,87,.10)",
    borderColor: "#047857",
    transform: "translateY(-1px)",
  },
  quickStatText: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    minWidth: 0,
  },
  filters: {
    background: "#ffffff",
    border: "1px solid #dbe6e0",
    borderRadius: 24,
    padding: 16,
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) 220px 240px auto",
    gap: 12,
    alignItems: "end",
    boxShadow: "0 10px 28px rgba(15,23,42,.05)",
  },
  field: {
    display: "grid",
    gap: 7,
    color: "#526174",
    fontSize: 12,
    fontWeight: 900,
  },
  fieldWide: {
    display: "grid",
    gap: 7,
    color: "#526174",
    fontSize: 12,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    minHeight: 44,
    border: "1px solid #d1d5db",
    borderRadius: 15,
    padding: "10px 13px",
    fontSize: 14,
    fontWeight: 750,
    color: "#10251f",
    background: "#ffffff",
    boxSizing: "border-box",
    outline: "none",
  },
  clearButton: {
    border: "none",
    background: "#eef4f1",
    color: "#486b5d",
    borderRadius: 15,
    minHeight: 44,
    padding: "11px 16px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #dbe6e0",
    borderRadius: 26,
    padding: 22,
    display: "grid",
    gap: 16,
    overflowX: "auto",
    boxShadow: "0 14px 38px rgba(15,23,42,.06)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  cardKicker: {
    color: "#047857",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
  },
  sectionTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 28,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },
  meta: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 900,
  },
  empty: {
    padding: 26,
    border: "1px dashed #cbd5e1",
    borderRadius: 18,
    color: "#64748b",
    textAlign: "center",
    fontSize: 14,
    fontWeight: 800,
  },
  tableWrap: {
    display: "grid",
    gap: 16,
    overflowX: "auto",
  },
  groupBlock: {
    display: "grid",
    gap: 8,
  },
  groupHeading: {
    width: "max-content",
    borderRadius: 999,
    background: "#eef4f1",
    color: "#486b5d",
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  table: {
    width: "100%",
    minWidth: 1120,
    borderCollapse: "separate",
    borderSpacing: 0,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
  },
  th: {
    textAlign: "left",
    padding: "14px 14px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f8fafc",
    color: "#526174",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  tr: {
    background: "#ffffff",
  },
  trWarning: {
    background: "#ffffff",
    boxShadow: "inset 5px 0 0 #f59e0b",
  },
  trDanger: {
    background: "#ffffff",
    boxShadow: "inset 5px 0 0 #e11d48",
  },
  td: {
    padding: "13px 14px",
    borderBottom: "1px solid #f1f5f9",
    color: "#334155",
    fontWeight: 700,
    verticalAlign: "top",
  },
  tdTime: {
    width: 145,
    padding: "13px 14px",
    borderBottom: "1px solid #f1f5f9",
    color: "#334155",
    fontWeight: 900,
    verticalAlign: "top",
  },
  tdBold: {
    padding: "13px 14px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    fontWeight: 950,
    verticalAlign: "top",
  },
  tdRecord: {
    padding: "13px 14px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    fontWeight: 850,
    verticalAlign: "top",
    maxWidth: 280,
  },
  actionCell: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 11px",
    fontSize: 12,
    fontWeight: 950,
    lineHeight: 1.15,
  },
  badgeSuccess: { background: "#dcfce7", color: "#166534" },
  badgeInfo: { background: "#dbeafe", color: "#1d4ed8" },
  badgeDanger: { background: "#fee2e2", color: "#b91c1c" },
  badgeNeutral: { background: "#f1f5f9", color: "#475569" },
  badgeMuted: { background: "#eef4f1", color: "#486b5d" },
  badgeComment: { background: "#ede9fe", color: "#6d28d9" },
  riskBadge: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 950,
  },
  riskDanger: { background: "#be123c", color: "#ffffff" },
  riskWarning: { background: "#f59e0b", color: "#ffffff" },
  sub: {
    display: "block",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 650,
    wordBreak: "break-all",
    marginTop: 5,
  },
  muted: { color: "#94a3b8" },
  changesList: {
    display: "grid",
    gap: 7,
    maxWidth: 650,
  },
  changeItem: {
    display: "grid",
    gridTemplateColumns: "minmax(120px, .75fr) minmax(160px, 1fr)",
    alignItems: "center",
    gap: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: "9px 12px",
    fontSize: 12,
  },
  changeValue: {
    color: "#64748b",
    fontWeight: 850,
    textAlign: "right",
    wordBreak: "break-word",
  },
}
