'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Bell, CalendarDays, Home, LogOut, User, Users } from 'lucide-react'
import { ROUTES } from '@/lib/routes'
import { supabase } from '@/lib/supabase'

function isActive(pathname: string, href: string) {
  return pathname === href
}

type NavItem = {
  href: string
  label: string
  icon: typeof Home
  badge?: number
  action?: () => Promise<void> | void
}

export default function MobileBottomNav({
  notificationsCount = 0,
}: {
  notificationsCount?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace(ROUTES.login)
  }

  if (!isMobile) return null

  const items: NavItem[] = [
    { href: ROUTES.employeeDashboard, label: 'Pagr.', icon: Home },
    { href: ROUTES.myResidents, label: 'Gyvent.', icon: Users },
    { href: ROUTES.mySchedule, label: 'Grafikas', icon: CalendarDays },
    { href: ROUTES.notifications, label: 'Praneš.', icon: Bell, badge: notificationsCount },
    { href: ROUTES.myProfile, label: 'Profilis', icon: User },
    { href: '#logout', label: 'Išeiti', icon: LogOut, action: handleLogout },
  ]

  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        borderTop: '1px solid #e2e8f0',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(18px)',
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        padding: '8px 6px calc(8px + env(safe-area-inset-bottom))',
        boxShadow: '0 -14px 38px rgba(15,23,42,0.08)',
      }}
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href)
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={(event) => {
              if (item.action) {
                event.preventDefault()
                void item.action()
              }
            }}
            style={{
              textDecoration: 'none',
              color: active ? '#047857' : '#64748b',
              display: 'grid',
              placeItems: 'center',
              gap: 4,
              padding: '8px 2px',
              position: 'relative',
              fontSize: 11,
              fontWeight: active ? 800 : 600,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: 44,
                height: 44,
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: active ? '#065f46' : 'transparent',
                color: active ? '#fff' : '#64748b',
                transition: 'all .2s ease',
              }}
            >
              <Icon size={20} />
              {item.badge && item.badge > 0 ? (
                <span
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -10,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 999,
                    background: '#dc2626',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 5px',
                  }}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
            </div>

            <span>{item.label}</span>

            {active ? (
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  width: 24,
                  height: 3,
                  borderRadius: 999,
                  background: '#047857',
                }}
              />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
