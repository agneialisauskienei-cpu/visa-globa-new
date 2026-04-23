'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  notificationsCount?: number
}

export default function MobileBottomNav({
  notificationsCount = 0,
}: Props) {
  const pathname = usePathname()

  const items = [
    { href: '/employee-dashboard', label: 'Pagr.', icon: '⌂' },
    { href: '/my-residents', label: 'Gyv.', icon: '👥' },
    { href: '/my-tasks', label: 'Užd.', icon: '✓' },
    {
      href: '/notifications',
      label: 'Notif.',
      icon: '🔔',
      badge: notificationsCount,
    },
    { href: '/my-profile', label: 'Profilis', icon: '👤' },
  ]

  return (
    <nav style={styles.nav}>
      <div style={styles.inner}>
        {items.map((item) => {
          const active = pathname === item.href

          return (
            <Link key={item.href} href={item.href} style={styles.link}>
              <div style={styles.item}>
                <div
                  style={{
                    ...styles.icon,
                    color: active ? '#111827' : '#9ca3af',
                  }}
                >
                  {item.icon}
                </div>

                <div
                  style={{
                    ...styles.label,
                    color: active ? '#111827' : '#9ca3af',
                  }}
                >
                  {item.label}
                </div>

                {item.badge > 0 && (
                  <span style={styles.badge}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(255,255,255,0.95)',
    borderTop: '1px solid #e5e7eb',
    backdropFilter: 'blur(10px)',
    zIndex: 100,
  },
  inner: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    maxWidth: 600,
    margin: '0 auto',
  },
  link: {
    textDecoration: 'none',
  },
  item: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 0 10px',
  },
  icon: {
    fontSize: 20,
    lineHeight: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 4,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 18,
    background: '#ef4444',
    color: '#fff',
    fontSize: 10,
    fontWeight: 800,
    borderRadius: 999,
    padding: '2px 6px',
  },
}