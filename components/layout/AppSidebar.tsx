'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getCurrentAccess, type SystemRole } from '@/lib/app-access'
import { getMenuForRole } from '@/lib/app-menu'
import { Home } from 'lucide-react'
import { Home } from 'lucide-react'

export default function AppSidebar() {
  const pathname = usePathname()

  const [role, setRole] = useState<SystemRole | null>(null)
  const [email, setEmail] = useState<string>('')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const access = await getCurrentAccess()
    setRole(access.role)
    setEmail(access.email || '')
  }

  const items = getMenuForRole(role)

  return (
    <aside style={styles.sidebar}>
      {/* LOGO */}
      <div style={styles.logo}>
        💚 <span>VisaGloba</span>
      </div>

      {/* MENU */}
      <nav style={styles.nav}>
        {items.map((item) => {
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
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* USER */}
      <div style={styles.footer}>
        <div style={styles.userEmail}>{email}</div>

        <button style={styles.logout}>
          Atsijungti
        </button>
      </div>
    </aside>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 260,
    minHeight: '100vh',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',

    // 🌿 ŽALIA TEMA
    background: 'linear-gradient(180deg, #022c22 0%, #064e3b 100%)',
    color: '#fff',
  },

  logo: {
    fontSize: 22,
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },

  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },

  link: {
    padding: '12px 14px',
    borderRadius: 10,
    color: '#d1fae5',
    textDecoration: 'none',
    fontWeight: 600,
    transition: 'all 0.2s',

    background: 'transparent',
  },

  active: {
    background: '#065f46',
    color: '#fff',
  },

  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  userEmail: {
    fontSize: 13,
    color: '#a7f3d0',
  },

  logout: {
    padding: '10px',
    borderRadius: 10,
    border: 'none',
    background: '#ef4444',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
}