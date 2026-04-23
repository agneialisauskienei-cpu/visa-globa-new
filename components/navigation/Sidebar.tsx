'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  BedDouble,
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  HeartHandshake,
  Home,
  LogOut,
  Package,
  Pill,
  Settings,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ROUTES } from '@/lib/routes'

type UiRole = 'super_admin' | 'admin' | 'employee' | null

type SidebarUser = {
  fullName: string
  role: UiRole
  roleLabel: string
}

function getUiRole(email: string | null | undefined): UiRole {
  const e = (email || '').toLowerCase()

  if (e === 'info@skaitytaknyga.lt') return 'super_admin'
  if (e === 'miauksena@gmail.com') return 'admin'

  return 'employee'
}

function getRoleLabel(role: UiRole) {
  if (role === 'super_admin') return 'Super admin'
  if (role === 'admin') return 'Admin'
  if (role === 'employee') return 'Darbuotojas'
  return 'Naudotojas'
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [user, setUser] = useState<SidebarUser | null>(null)

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    setUser({
      fullName: user.email || 'Vartotojas',
      role: getUiRole(user.email),
      roleLabel: getRoleLabel(getUiRole(user.email)),
    })
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const superAdminLinks = useMemo(
    () => [
      { href: '/admin-dashboard', label: 'Pagrindinis', icon: Home },
      { href: '/organizations', label: 'Įstaigos', icon: Users }, // 🔥 svarbiausias
      { href: '/admin-join-requests', label: 'Užklausos', icon: FileText },
      { href: '/notifications', label: 'Pranešimai', icon: Bell },
      { href: '/system', label: 'Sistema', icon: Settings },
    ],
    []
  )

  const adminLinks = useMemo(
    () => [
      { href: '/admin-dashboard', label: 'Pagrindinis', icon: Home },
      { href: '/residents', label: 'Gyventojai', icon: Users },
      { href: '/team', label: 'Darbuotojai', icon: ShieldCheck },
      { href: '/rooms', label: 'Kambariai', icon: BedDouble },
      { href: '/medications', label: 'Sveikatos įrašai', icon: Pill },
      { href: '/inventory', label: 'Sandėliai', icon: Package },
      { href: '/company-info', label: 'Įmonės info', icon: Building2 },
      { href: '/admin-join-requests', label: 'Patvirtinimai', icon: FileText },
      { href: '/notifications', label: 'Pranešimai', icon: Bell },
      { href: '/system', label: 'Sistema', icon: Settings },
    ],
    []
  )

  const employeeLinks = useMemo(
    () => [
      { href: '/employee-dashboard', label: 'Pagrindinis', icon: Home },
      { href: '/my-residents', label: 'Mano gyventojai', icon: Users },
      { href: '/my-tasks', label: 'Užduotys', icon: ClipboardList },
      { href: '/my-schedule', label: 'Grafikas', icon: CalendarDays },
      { href: '/notifications', label: 'Pranešimai', icon: Bell },
      { href: '/profile', label: 'Profilis', icon: User },
      { href: '/system', label: 'Sistema', icon: Settings },
    ],
    []
  )

  const links =
    user?.role === 'super_admin'
      ? superAdminLinks
      : user?.role === 'admin'
      ? adminLinks
      : employeeLinks

  return (
    <aside style={styles.sidebar}>
      <div>
        <div style={styles.logo}>VisaGloba</div>

        <nav style={styles.nav}>
          {links.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...styles.link,
                  ...(active ? styles.active : {}),
                }}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div style={styles.bottom}>
        <div>{user?.fullName}</div>
        <div style={styles.role}>{user?.roleLabel}</div>

        <button onClick={logout} style={styles.logout}>
          Atsijungti
        </button>
      </div>
    </aside>
  )
}

const styles: any = {
  sidebar: {
    width: 240,
    height: '100vh',
    background: '#0f172a',
    color: '#fff',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 20,
  },
  nav: {
    display: 'grid',
    gap: 8,
  },
  link: {
    display: 'flex',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    textDecoration: 'none',
    color: '#cbd5f5',
  },
  active: {
    background: '#1e293b',
    color: '#fff',
  },
  bottom: {
    display: 'grid',
    gap: 6,
  },
  role: {
    fontSize: 12,
    color: '#94a3b8',
  },
  logout: {
    marginTop: 10,
    padding: 8,
    background: '#ef4444',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    cursor: 'pointer',
  },
}