'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Home,
  LogOut,
  Settings,
  HeartHandshake,
  UserRound,
  Users,
  Inbox,
  UserPlus,
  BarChart3,
  PackageOpen,
  ClipboardCheck,
ShieldCheck,
  ListChecks,
} from 'lucide-react'
import { getCurrentAccess, type SystemRole } from '@/lib/app-access'
import { supabase } from '@/lib/supabase'

type MenuItem = {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  roles: SystemRole[]
}

const MENU: MenuItem[] = [
  { label: 'Pagrindinis', href: '/admin-dashboard', icon: Home, roles: ['owner', 'admin', 'employee'] },
  { label: 'Įstaigos', href: '/organizations', icon: Building2, roles: ['owner'] },
  { label: 'Darbuotojai', href: '/employees', icon: Users, roles: ['admin'] },
  { label: 'Užduotys', href: '/tasks', icon: ListChecks, roles: ['admin', 'employee'] },
  { label: 'Gyventojai', href: '/residents', icon: UserRound, roles: ['admin', 'employee'] },
  { label: 'Kambariai', href: '/rooms', icon: Home, roles: ['admin', 'employee'] },
  { label: 'Sandėliai', href: '/inventory', icon: PackageOpen, roles: ['admin', 'employee'] },
  { label: 'Perdavimo žurnalai', href: '/handover-logs', icon: ClipboardCheck, roles: ['admin', 'employee'] },
  { label: 'Užklausos', href: '/requests', icon: Inbox, roles: ['admin', 'employee'] },
  { label: 'Kvietimai', href: '/invites', icon: UserPlus, roles: ['admin'] },
  { label: 'Ataskaitos', href: '/reports', icon: BarChart3, roles: ['admin'] },
  { label: 'Auditas', href: '/audit', icon: ShieldCheck, roles: ['admin'] },
  { label: 'Nustatymai', href: '/settings', icon: Settings, roles: ['owner', 'admin', 'employee'] },
]

function getRoleLabel(role: SystemRole | null) {
  if (role === 'owner') return 'Super Admin'
  if (role === 'admin') return 'Administratorius'
  if (role === 'employee') return 'Darbuotojas'
  return 'Sistema'
}

function getInitials(email: string) {
  if (!email) return 'VG'
  return email.split('@')[0].slice(0, 2).toUpperCase()
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [role, setRole] = useState<SystemRole | null>(null)
  const [email, setEmail] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    void loadAccess()
  }, [])

  async function loadAccess() {
    const access = await getCurrentAccess()
    setRole(access.role)
    setEmail(access.email || '')
  }

  async function logout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const items = useMemo(() => {
    if (!role) return []
    return MENU.filter((item) => item.roles.includes(role))
  }, [role])

  return (
    <aside style={styles.sidebar}>
      <div style={styles.top}>
        <Link href="/admin-dashboard" style={styles.logo}>
          <HeartHandshake size={24} strokeWidth={2.4} style={styles.logoIcon} />
          <span>VisaGloba</span>
        </Link>

        <nav style={styles.nav}>
          {items.map((item) => {
            const Icon = item.icon
            const active =
              pathname === item.href ||
              (item.href !== '/admin-dashboard' && pathname.startsWith(item.href + '/'))

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...styles.link,
                  ...(active ? styles.linkActive : {}),
                }}
              >
                <Icon size={18} strokeWidth={2.2} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div style={styles.bottom}>
        <div style={styles.userCard}>
          <div style={styles.avatar}>{getInitials(email)}</div>

          <div>
            <div style={styles.userName}>Naudotojas</div>
            <div style={styles.userRole}>{getRoleLabel(role)}</div>
          </div>
        </div>

        <button type="button" onClick={() => void logout()} disabled={loggingOut} style={styles.logout}>
          <LogOut size={17} strokeWidth={2.4} />
          {loggingOut ? 'Atsijungiama...' : 'Atsijungti'}
        </button>
      </div>
    </aside>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 270,
    minHeight: '100vh',
    padding: '18px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    background:
      'radial-gradient(circle at top left, rgba(74,222,128,0.12), transparent 34%), linear-gradient(180deg, #021d16 0%, #043326 100%)',
  },
  top: {
    display: 'grid',
    gap: 18,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#fff',
    textDecoration: 'none',
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: '-0.03em',
  },
  logoIcon: {
    color: '#86efac',
  },
  nav: {
    display: 'grid',
    gap: 4,
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 14,
    color: '#d8f8e7',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: 13,
    minHeight: 40,
  },
  linkActive: {
    background: 'linear-gradient(180deg, #1c7a3a 0%, #196f34 100%)',
    color: '#ffffff',
  },
  bottom: {
    display: 'grid',
    gap: 12,
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: '#111827',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 12,
  },
  userName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 800,
  },
  userRole: {
    color: '#9ee7b6',
    fontSize: 11,
    fontWeight: 700,
  },
  logout: {
    width: '100%',
    border: 'none',
    borderRadius: 14,
    padding: '10px',
    background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
}