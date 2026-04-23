'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bell,
  BedDouble,
  Building2,
  ClipboardList,
  FileText,
  HeartPulse,
  Home,
  Package,
  Repeat,
  Settings,
  User,
  Users,
} from 'lucide-react'

type MembershipRole = 'owner' | 'admin' | 'employee' | null

type SidebarItem = {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number
}

type Props = {
  notificationsCount?: number
  role?: MembershipRole
  organizationId?: string | null
}

export default function AppSidebar({
  notificationsCount = 0,
  role = null,
}: Props) {
  const pathname = usePathname()

  const adminItems: SidebarItem[] = [
    { href: '/admin-dashboard', label: 'Pagrindinis', icon: <Home size={16} /> },
    { href: '/residents', label: 'Gyventojai', icon: <User size={16} /> },
    { href: '/team', label: 'Personalas', icon: <Users size={16} /> },
    { href: '/activities', label: 'Grafikai', icon: <BarChart3 size={16} /> },
    { href: '/health-records', label: 'Sveikatos įrašai', icon: <HeartPulse size={16} /> },
    { href: '/documents', label: 'Dokumentai', icon: <FileText size={16} /> },
    { href: '/notifications', label: 'Pranešimai', icon: <Bell size={16} />, badge: notificationsCount },
    { href: '/reports', label: 'Ataskaitos', icon: <ClipboardList size={16} /> },
    { href: '/settings', label: 'Nustatymai', icon: <Settings size={16} /> },
    { href: '/organization', label: 'Mano įstaiga', icon: <Building2 size={16} /> },
    { href: '/rooms', label: 'Kambariai', icon: <BedDouble size={16} /> },
    { href: '/inventory', label: 'Sandėlis', icon: <Package size={16} /> },
    { href: '/handover', label: 'Perdavimai', icon: <Repeat size={16} /> },
  ]

  const employeeItems: SidebarItem[] = [
    { href: '/employee-dashboard', label: 'Pagrindinis', icon: <Home size={16} /> },
    { href: '/my-residents', label: 'Gyventojai', icon: <User size={16} /> },
    { href: '/my-tasks', label: 'Užduotys', icon: <ClipboardList size={16} /> },
    { href: '/activities', label: 'Grafikai', icon: <BarChart3 size={16} /> },
    { href: '/notifications', label: 'Pranešimai', icon: <Bell size={16} />, badge: notificationsCount },
    { href: '/my-profile', label: 'Profilis', icon: <Users size={16} /> },
  ]

  const items = role === 'owner' || role === 'admin' ? adminItems : employeeItems

  return (
    <aside className="sticky top-0 h-screen w-[248px] shrink-0 overflow-y-auto bg-[#062b20] text-white">
      <div className="flex h-full flex-col px-4 py-5">
        <div className="mb-5 flex items-center gap-2 px-2">
          <div className="h-7 w-7 rounded-full bg-emerald-400/20 ring-1 ring-emerald-300/20" />
          <div className="text-[22px] font-bold tracking-tight">VisaGloba</div>
        </div>

        <nav className="space-y-1.5">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/' && pathname?.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  active
                    ? 'bg-[#0f4f3d] text-white'
                    : 'text-emerald-50/85 hover:bg-[#0b3b2d] hover:text-white'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-200'
                      : 'bg-transparent text-emerald-100/80 group-hover:text-emerald-100'
                  }`}
                >
                  {item.icon}
                </span>

                <span className="flex-1">{item.label}</span>

                {item.badge && item.badge > 0 ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      active
                        ? 'bg-emerald-400/20 text-emerald-100'
                        : 'bg-white/10 text-emerald-50/90'
                    }`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Jonas Petraitis</div>
          <div className="mt-1 text-xs text-emerald-100/65">
            {role === 'owner' ? 'Savininkas' : role === 'admin' ? 'Administratorius' : 'Darbuotojas'}
          </div>
        </div>
      </div>
    </aside>
  )
}