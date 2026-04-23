'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function MobileBottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/residents', label: 'Gyventojai' },
    { href: '/inventory', label: 'Sandėlis' },
    { href: '/team', label: 'Darbuotojai' },
    { href: '/my-schedule', label: 'Grafikas' },
  ]

  return (
    <div style={styles.wrapper}>
      {navItems.map((item) => {
        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              ...styles.link,
              ...(isActive ? styles.active : {}),
            }}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    background: '#ffffff',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 1000,
  },
  link: {
    textDecoration: 'none',
    color: '#6b7280',
    fontSize: 12,
    fontWeight: 700,
  },
  active: {
    color: '#111827',
  },
}