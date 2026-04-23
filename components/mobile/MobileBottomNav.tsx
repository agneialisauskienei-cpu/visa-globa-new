'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Bell, CalendarDays, Home, User, Users } from 'lucide-react'
import { ROUTES } from '@/lib/routes'
import { useNotifications } from '@/components/providers/NotificationProvider'

function isActive(pathname: string, href: string) {
  return pathname === href
}

export default function MobileBottomNav() {
  const pathname = usePathname()
  const { unreadCount } = useNotifications()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!isMobile) return null

  const items = [
    { href: ROUTES.employeeDashboard, label: 'Pagr.', icon: Home },
    { href: ROUTES.myResidents, label: 'Gyvent.', icon: Users },
    { href: ROUTES.mySchedule, label: 'Grafikas', icon: CalendarDays },
    { href: ROUTES.notifications, label: 'Praneš.', icon: Bell, badge: unreadCount },
    { href: ROUTES.myProfile, label: 'Profilis', icon: User },
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
        background: '#ffffff',
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        padding: '8px 8px calc(8px + env(safe-area-inset-bottom))',
        boxShadow: '0 -6px 20px rgba(15,23,42,0.06)',
      }}
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href)
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              textDecoration: 'none',
              color: active ? '#0f766e' : '#64748b',
              display: 'grid',
              placeItems: 'center',
              gap: 4,
              padding: '8px 4px',
              position: 'relative',
              fontSize: 12,
              fontWeight: active ? 800 : 600,
            }}
          >
            <div style={{ position: 'relative' }}>
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
                  background: '#0f766e',
                }}
              />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}