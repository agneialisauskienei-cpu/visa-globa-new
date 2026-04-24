'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  Download,
  PackageOpen,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type CategoryKey = 'diapers' | 'bedding' | 'cleaning' | 'medication' | 'uniforms' | 'other'
type StockFilter = '' | 'ok' | 'low' | 'empty'
type OperationFilter = '' | 'in' | 'out' | 'adjustment'

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
  created_at: string | null
  updated_at: string | null
}

type InventoryHistory = {
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

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  diapers: 'Sauskelnės',
  bedding: 'Patalynė',
  cleaning: 'Valymo priemonės',
  medication: 'Vaistai',
  uniforms: 'Darbuotojų uniformos',
  other: 'Kita',
}

const CATEGORY_SUBTITLES: Record<CategoryKey, string> = {
  diapers: 'Dydžių, likučių ir išdavimų valdymas.',
  bedding: 'Patalynės, užvalkalų ir komplektų judėjimas.',
  cleaning: 'Valymo priemonių likučiai ir sunaudojimas.',
  medication: 'Vaistų likučiai, papildymai ir nurašymai.',
  uniforms: 'Darbuotojų apranga, dydžiai ir išdavimai.',
  other: 'Kitos sandėlio prekės ir jų judėjimas.',
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
  shirt: 'Marškinėliai',
  jacket: 'Švarkas / džemperis',
  robe: 'Chalatas',
  shoes: 'Avalynė',
  apron: 'Prijuostė',
  general: 'Bendra prekė',
  equipment: 'Įranga',
  office: 'Kanceliarinės prekės',
  hygiene: 'Higienos priemonės',
}

export default function InventoryCategoryPage() {
  const { category } = useParams()
  const categoryKey = String(category || '') as CategoryKey

  const [items, setItems] = useState<InventoryItem[]>([])
  const [history, setHistory] = useState<InventoryHistory[]>([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const [searchDraft, setSearchDraft] = useState('')
  const [stockDraft, setStockDraft] = useState<StockFilter>('')
  const [operationDraft, setOperationDraft] = useState<OperationFilter>('')
  const [targetDraft, setTargetDraft] = useState('')
  const [issuerDraft, setIssuerDraft] = useState('')
  const [sortDraft, setSortDraft] = useState('newest')

  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('')
  const [operationFilter, setOperationFilter] = useState<OperationFilter>('')
  const [targetFilter, setTargetFilter] = useState('')
  const [issuerFilter, setIssuerFilter] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  const [refillItem, setRefillItem] = useState<InventoryItem | null>(null)
  const [refillQuantity, setRefillQuantity] = useState('1')
  const [refillNotes, setRefillNotes] = useState('')

  const categoryTitle = CATEGORY_LABELS[categoryKey] || 'Sandėlio kategorija'
  const categorySubtitle = CATEGORY_SUBTITLES[categoryKey] || ''

  useEffect(() => {
    void loadData()
  }, [categoryKey])

  async function loadData() {
    const { data: itemsData } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('category', categoryKey)
      .order('created_at', { ascending: false })

    const { data: historyData } = await supabase
      .from('inventory_issue_history_view')
      .select('*')
      .eq('category', categoryKey)
      .order('created_at', { ascending: false })

    setItems((itemsData || []) as InventoryItem[])
    setHistory((historyData || []) as InventoryHistory[])
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

  function getStockStatus(item: InventoryItem): StockFilter {
    const quantity = Number(item.quantity || 0)
    const min = Number(item.min_quantity || 0)

    if (quantity <= 0) return 'empty'
    if (quantity <= min) return 'low'
    return 'ok'
  }

  function getStockLabel(item: InventoryItem) {
    const status = getStockStatus(item)
    if (status === 'empty') return 'Pasibaigė'
    if (status === 'low') return 'Baigiasi'
    return 'Pakanka'
  }

  function applyFilters() {
    setSearch(searchDraft)
    setStockFilter(stockDraft)
    setOperationFilter(operationDraft)
    setTargetFilter(targetDraft)
    setIssuerFilter(issuerDraft)
    setSortBy(sortDraft)
  }

  function clearFilters() {
    setSearchDraft('')
    setStockDraft('')
    setOperationDraft('')
    setTargetDraft('')
    setIssuerDraft('')
    setSortDraft('newest')

    setSearch('')
    setStockFilter('')
    setOperationFilter('')
    setTargetFilter('')
    setIssuerFilter('')
    setSortBy('newest')
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

  async function refillSelectedItem() {
    try {
      if (!refillItem) return

      const quantity = Number(refillQuantity || 0)
      if (Number.isNaN(quantity) || quantity <= 0) {
        setMessage('Papildomas kiekis turi būti didesnis už 0.')
        return
      }

      setSaving(true)
      setMessage('')

      const actor = await getActorName()
      const currentQuantity = Number(refillItem.quantity || 0)
      const newQuantity = currentQuantity + quantity

      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', refillItem.id)

      if (updateError) throw updateError

      const { error: historyError } = await supabase.from('inventory_issue_history').insert({
        organization_id: refillItem.organization_id,
        item_id: refillItem.id,
        item_name: refillItem.name,
        category: refillItem.category,
        subcategory: refillItem.subcategory,
        size: refillItem.size,
        unit: refillItem.unit,
        resident_id: null,
        resident_code: null,
        employee_user_id: actor.userId,
        employee_full_name: actor.name,
        quantity,
        type: 'in',
        notes: refillNotes.trim() || null,
      })

      if (historyError) throw historyError

      setRefillItem(null)
      setRefillQuantity('1')
      setRefillNotes('')
      setMessage('Prekė papildyta.')
      await loadData()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nepavyko papildyti prekės.')
    } finally {
      setSaving(false)
    }
  }

  const targetOptions = useMemo(() => {
    const values = new Set<string>()
    history.forEach((row) => {
      if (row.resident_code) values.add(row.resident_code)
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'lt'))
  }, [history])

  const issuerOptions = useMemo(() => {
    const values = new Set<string>()
    history.forEach((row) => {
      if (row.employee_full_name) values.add(row.employee_full_name)
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'lt'))
  }, [history])

  const filteredItems = useMemo(() => {
    let result = [...items]
    const q = search.trim().toLowerCase()

    if (q) {
      result = result.filter((item) =>
        [item.name, subcategoryLabel(item.subcategory), item.size, item.unit]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
    }

    if (stockFilter) {
      result = result.filter((item) => getStockStatus(item) === stockFilter)
    }

    result.sort((a, b) => {
      if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''), 'lt')
      if (sortBy === 'quantity_asc') return Number(a.quantity || 0) - Number(b.quantity || 0)
      if (sortBy === 'quantity_desc') return Number(b.quantity || 0) - Number(a.quantity || 0)
      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
    })

    return result
  }, [items, search, stockFilter, sortBy])

  const filteredHistory = useMemo(() => {
    let result = [...history]
    const q = search.trim().toLowerCase()

    if (q) {
      result = result.filter((row) =>
        [
          row.item_name,
          subcategoryLabel(row.subcategory),
          row.size,
          row.resident_code,
          row.employee_full_name,
          row.notes,
          operationLabel(row.type),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
    }

    if (operationFilter) result = result.filter((row) => row.type === operationFilter)
    if (targetFilter) result = result.filter((row) => row.resident_code === targetFilter)
    if (issuerFilter) result = result.filter((row) => row.employee_full_name === issuerFilter)

    return result
  }, [history, search, operationFilter, targetFilter, issuerFilter])

  const stats = useMemo(() => {
    return {
      items: items.length,
      quantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      low: items.filter((item) => getStockStatus(item) === 'low').length,
      empty: items.filter((item) => getStockStatus(item) === 'empty').length,
      movements: history.length,
      out: history.filter((row) => row.type === 'out').length,
      in: history.filter((row) => row.type === 'in').length,
    }
  }, [items, history])

  function exportHistory() {
    const rows = filteredHistory.map((row) => ({
      data: row.created_at ? new Date(row.created_at).toLocaleString('lt-LT') : '',
      preke: row.item_name || '',
      tipas: subcategoryLabel(row.subcategory),
      dydis: row.size || '',
      kiekis: `${row.quantity || 0} ${row.unit || 'vnt.'}`,
      operacija: operationLabel(row.type),
      kam: row.resident_code || '',
      kas_atliko: row.employee_full_name || '',
      pastaba: row.notes || '',
    }))

    const headers = Object.keys(rows[0] || {})
    if (!headers.length) return

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => `"${String((row as any)[header] || '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${categoryKey}_istorija.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerTop}>
        <Link href="/inventory" style={styles.backButton}>
          <ArrowLeft size={16} />
          Grįžti į sandėlį
        </Link>
      </div>

      <section style={styles.hero}>
        <div style={styles.heroIcon}>
          <PackageOpen size={28} />
        </div>

        <div>
          <div style={styles.eyebrow}>Sandėlio kategorija</div>
          <h1 style={styles.title}>{categoryTitle}</h1>
          <p style={styles.subtitle}>{categorySubtitle}</p>
        </div>
      </section>

      {message ? <div style={styles.message}>{message}</div> : null}

      <section style={styles.statsGrid}>
        <button style={styles.statCard} onClick={() => setStockDraft('')}>
          <strong>{stats.items}</strong>
          <span>Skirtingų prekių</span>
        </button>

        <button style={styles.statCard} onClick={() => setStockDraft('')}>
          <strong>{stats.quantity}</strong>
          <span>Bendras kiekis</span>
        </button>

        <button style={{ ...styles.statCard, ...styles.warningStat }} onClick={() => setStockDraft('low')}>
          <strong>{stats.low}</strong>
          <span>Baigiasi</span>
        </button>

        <button style={{ ...styles.statCard, ...styles.dangerStat }} onClick={() => setStockDraft('empty')}>
          <strong>{stats.empty}</strong>
          <span>Pasibaigė</span>
        </button>

        <button style={styles.statCard} onClick={() => setOperationDraft('')}>
          <strong>{stats.movements}</strong>
          <span>Judėjimų</span>
        </button>

        <button style={{ ...styles.statCard, ...styles.greenStat }} onClick={() => setOperationDraft('out')}>
          <strong>{stats.out}</strong>
          <span>Nurašymai</span>
        </button>

        <button style={styles.statCard} onClick={() => setOperationDraft('in')}>
          <strong>{stats.in}</strong>
          <span>Papildymai</span>
        </button>
      </section>

      <section style={styles.layout}>
        <aside style={styles.filters}>
          <div style={styles.filterTitle}>
            <SlidersHorizontal size={18} />
            Filtrai
          </div>

          <label style={styles.field}>
            <span>Paieška</span>
            <div style={styles.searchBox}>
              <Search size={16} />
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Prekė, tipas, kam..."
                style={styles.searchInput}
              />
            </div>
          </label>

          <label style={styles.field}>
            <span>Likutis</span>
            <select value={stockDraft} onChange={(e) => setStockDraft(e.target.value as StockFilter)} style={styles.input}>
              <option value="">Visi</option>
              <option value="ok">Pakanka</option>
              <option value="low">Baigiasi</option>
              <option value="empty">Pasibaigė</option>
            </select>
          </label>

          <label style={styles.field}>
            <span>Operacija</span>
            <select value={operationDraft} onChange={(e) => setOperationDraft(e.target.value as OperationFilter)} style={styles.input}>
              <option value="">Visos</option>
              <option value="out">Nurašymai</option>
              <option value="in">Papildymai</option>
              <option value="adjustment">Koregavimai</option>
            </select>
          </label>

          <label style={styles.field}>
            <span>Kam</span>
            <select value={targetDraft} onChange={(e) => setTargetDraft(e.target.value)} style={styles.input}>
              <option value="">Visi</option>
              {targetOptions.map((target) => (
                <option key={target} value={target}>
                  {target}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span>Kas išdavė</span>
            <select value={issuerDraft} onChange={(e) => setIssuerDraft(e.target.value)} style={styles.input}>
              <option value="">Visi</option>
              {issuerOptions.map((issuer) => (
                <option key={issuer} value={issuer}>
                  {issuer}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span>Rūšiavimas</span>
            <select value={sortDraft} onChange={(e) => setSortDraft(e.target.value)} style={styles.input}>
              <option value="newest">Naujausi viršuje</option>
              <option value="name">Pavadinimas A–Ž</option>
              <option value="quantity_desc">Daugiausia kiekio</option>
              <option value="quantity_asc">Mažiausia kiekio</option>
            </select>
          </label>

          <button style={styles.filterButton} onClick={applyFilters}>
            Filtruoti
          </button>

          <button style={styles.clearButton} onClick={clearFilters}>
            Valyti filtrus
          </button>
        </aside>

        <main style={styles.content}>
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Kategorijos likučiai</h2>
            <p style={styles.meta}>Rodoma prekių: {filteredItems.length}</p>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Pavadinimas</th>
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
                  <tr key={item.id}>
                    <td style={styles.tdBold}>{item.name}</td>
                    <td style={styles.td}>{subcategoryLabel(item.subcategory)}</td>
                    <td style={styles.td}>{item.size || '—'}</td>
                    <td style={styles.td}>{item.quantity || 0} {item.unit || 'vnt.'}</td>
                    <td style={styles.td}>{item.min_quantity ?? '—'}</td>
                    <td style={styles.td}>
                      <span style={getStockStatus(item) === 'ok' ? styles.ok : styles.warning}>
                        {getStockLabel(item)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        onClick={() => {
                          setRefillItem(item)
                          setRefillQuantity('1')
                          setRefillNotes('')
                        }}
                        style={getStockStatus(item) === 'low' ? styles.refillUrgentButton : styles.refillButton}
                      >
                        <Plus size={14} />
                        Papildyti
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Judėjimo istorija</h2>
                <p style={styles.meta}>Rodoma įrašų: {filteredHistory.length}</p>
              </div>

              <button onClick={exportHistory} style={styles.exportButton}>
                <Download size={16} />
                Eksportuoti
              </button>
            </div>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Prekė</th>
                  <th style={styles.th}>Kiekis</th>
                  <th style={styles.th}>Operacija</th>
                  <th style={styles.th}>Kam</th>
                  <th style={styles.th}>Kas atliko</th>
                  <th style={styles.th}>Data</th>
                </tr>
              </thead>

              <tbody>
                {filteredHistory.map((row) => (
                  <tr key={row.id}>
                    <td style={styles.tdBold}>
                      {row.item_name}
                      <div style={styles.sub}>
                        {subcategoryLabel(row.subcategory)}
                        {row.size ? ` • ${row.size}` : ''}
                      </div>
                    </td>

                    <td style={styles.td}>{row.quantity} {row.unit || 'vnt.'}</td>

                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...(row.type === 'out' ? styles.outBadge : styles.inBadge) }}>
                        {row.type === 'out' ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
                        {operationLabel(row.type)}
                      </span>
                    </td>

                    <td style={styles.td}>{row.resident_code || '—'}</td>
                    <td style={styles.td}>{row.employee_full_name || '—'}</td>
                    <td style={styles.td}>{row.created_at ? new Date(row.created_at).toLocaleString('lt-LT') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </main>
      </section>

      {refillItem ? (
        <div style={styles.modalBackdrop} onClick={() => setRefillItem(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Papildyti prekę</h2>
                <p style={styles.modalSubtitle}>{refillItem.name}</p>
              </div>

              <button type="button" onClick={() => setRefillItem(null)} style={styles.iconButton}>
                <X size={18} />
              </button>
            </div>

            <label style={styles.field}>
              <span>Kiekis</span>
              <input
                type="number"
                min="1"
                value={refillQuantity}
                onChange={(e) => setRefillQuantity(e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span>Pastaba</span>
              <input
                value={refillNotes}
                onChange={(e) => setRefillNotes(e.target.value)}
                placeholder="Pvz. papildyta iš sandėlio"
                style={styles.input}
              />
            </label>

            <div style={styles.modalActions}>
              <button type="button" onClick={() => setRefillItem(null)} style={styles.clearButton}>
                Atšaukti
              </button>
              <button type="button" onClick={() => void refillSelectedItem()} disabled={saving} style={styles.filterButton}>
                {saving ? 'Saugoma...' : 'Papildyti'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    display: 'grid',
    gap: 18,
  },
  headerTop: {
    display: 'flex',
  },
  backButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 13px',
    borderRadius: 12,
    background: '#ecfdf5',
    color: '#047857',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 900,
  },
  hero: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    border: '1px solid #e5e7eb',
    borderRadius: 24,
    padding: 22,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    background: '#ecfdf5',
    color: '#047857',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#047857',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  title: {
    margin: '4px 0',
    fontSize: 34,
    fontWeight: 950,
    color: '#0f172a',
  },
  subtitle: {
    margin: 0,
    color: '#64748b',
    fontSize: 15,
    fontWeight: 650,
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
    border: '1px solid #e5e7eb',
    background: '#ffffff',
    borderRadius: 18,
    padding: 15,
    textAlign: 'left',
    cursor: 'pointer',
    display: 'grid',
    gap: 6,
  },
  warningStat: {
    background: '#fffbeb',
    borderColor: '#fde68a',
  },
  dangerStat: {
    background: '#fff1f2',
    borderColor: '#fecdd3',
  },
  greenStat: {
    background: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '280px minmax(0, 1fr)',
    gap: 16,
    alignItems: 'start',
  },
  filters: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 20,
    padding: 16,
    display: 'grid',
    gap: 14,
    position: 'sticky',
    top: 16,
  },
  filterTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 950,
  },
  field: {
    display: 'grid',
    gap: 6,
    color: '#334155',
    fontSize: 12,
    fontWeight: 850,
  },
  input: {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: 13,
    padding: '10px 11px',
    fontSize: 14,
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #d1d5db',
    borderRadius: 13,
    padding: '0 11px',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    width: '100%',
    padding: '10px 0',
    fontSize: 14,
  },
  filterButton: {
    border: 'none',
    background: '#047857',
    color: '#ffffff',
    borderRadius: 13,
    padding: '11px 12px',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
  },
  clearButton: {
    border: 'none',
    background: '#f1f5f9',
    color: '#0f172a',
    borderRadius: 13,
    padding: '11px 12px',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
  },
  content: {
    display: 'grid',
    gap: 16,
    minWidth: 0,
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 20,
    padding: 20,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 950,
    color: '#0f172a',
  },
  meta: {
    margin: '6px 0 16px',
    color: '#64748b',
    fontSize: 13,
    fontWeight: 800,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 10px',
    borderBottom: '1px solid #e5e7eb',
    fontWeight: 900,
    color: '#475569',
  },
  td: {
    padding: '14px 10px',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
    fontWeight: 650,
  },
  tdBold: {
    padding: '14px 10px',
    borderBottom: '1px solid #f1f5f9',
    color: '#0f172a',
    fontWeight: 900,
  },
  sub: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
    fontWeight: 650,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 11px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  },
  outBadge: {
    background: '#fee2e2',
    color: '#b91c1c',
  },
  inBadge: {
    background: '#dcfce7',
    color: '#166534',
  },
  warning: {
    background: '#fef3c7',
    color: '#92400e',
    padding: '5px 11px',
    borderRadius: 999,
    fontWeight: 850,
  },
  ok: {
    background: '#dcfce7',
    color: '#166534',
    padding: '5px 11px',
    borderRadius: 999,
    fontWeight: 850,
  },
  refillButton: {
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
  refillUrgentButton: {
    border: '1px solid #fde68a',
    background: '#fffbeb',
    color: '#92400e',
    borderRadius: 12,
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  exportButton: {
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#0f172a',
    borderRadius: 13,
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
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
    maxWidth: 460,
    background: '#ffffff',
    borderRadius: 22,
    padding: 20,
    display: 'grid',
    gap: 16,
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 950,
    color: '#0f172a',
  },
  modalSubtitle: {
    margin: '4px 0 0',
    color: '#64748b',
    fontSize: 14,
    fontWeight: 750,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: '1px solid #d1d5db',
    background: '#ffffff',
    cursor: 'pointer',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
}