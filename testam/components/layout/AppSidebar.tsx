'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'

type MembershipRole = 'owner' | 'admin' | 'employee' | null

type SidebarItem = {
  href: string
  label: string
  icon: ReactNode
}

type Props = {
  notificationsCount?: number
  role?: MembershipRole
  organizationId?: string | null
}

const ACCENT = '#5e7c66'
const ACCENT_SOFT = '#eef4ef'
const ACCENT_BORDER = '#d8e4da'
const TEXT_DARK = '#24322a'
const TEXT_SOFT = '#66756c'

export default function AppSidebar({
  notificationsCount = 0,
  role = null,
  organizationId = null,
}: Props) {
  const pathname = usePathname()

  const adminItems: SidebarItem[] = [
    { href: '/admin-dashboard', label: 'Pagrindinis', icon: <HomeIcon /> },
    { href: '/organization', label: 'Mano įstaiga', icon: <BuildingIcon /> },
    { href: '/admin-join-requests', label: 'Patvirtinimai', icon: <ApprovalsIcon /> },
    { href: '/admin-tasks', label: 'Užduotys', icon: <TasksIcon /> },
    { href: '/team', label: 'Darbuotojai', icon: <UsersIcon /> },
    { href: '/residents', label: 'Gyventojai', icon: <ResidentsIcon /> },
    { href: '/rooms', label: 'Kambariai', icon: <RoomsIcon /> },
    { href: '/inventory', label: 'Sandėlis', icon: <InventoryIcon /> },
    { href: '/handover', label: 'Perdavimai', icon: <HandoverIcon /> },
    { href: '/notifications', label: 'Pranešimai', icon: <BellIcon /> },
    { href: '/my-profile', label: 'Profilis', icon: <ProfileIcon /> },
  ]

  const employeeItems: SidebarItem[] = [
    { href: '/employee-dashboard', label: 'Pagrindinis', icon: <HomeIcon /> },
    { href: '/my-residents', label: 'Gyventojai', icon: <ResidentsIcon /> },
    { href: '/my-tasks', label: 'Užduotys', icon: <TasksIcon /> },
    { href: '/handover', label: 'Perdavimai', icon: <HandoverIcon /> },
    { href: '/my-schedule', label: 'Grafikas', icon: <CalendarIcon /> },
    { href: '/notifications', label: 'Pranešimai', icon: <BellIcon /> },
    { href: '/my-profile', label: 'Profilis', icon: <ProfileIcon /> },
  ]

  const items = role === 'owner' || role === 'admin' ? adminItems : employeeItems
  const roleLabel =
    role === 'owner' ? 'Savininkas' : role === 'admin' ? 'Administratorius' : 'Darbuotojas'

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brandCard}>
        <div style={styles.brandBadge}>{roleLabel}</div>
        <div style={styles.brandTitle}>Vidaus sistema</div>
        <div style={styles.brandSubtitle}>
          {organizationId ? `Organizacija: ${organizationId}` : 'Kasdieniam darbui ir valdymui'}
        </div>
      </div>

      <nav style={styles.nav}>
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (!!pathname && item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                ...styles.link,
                ...(active ? styles.linkActive : {}),
              }}
            >
              <span
                style={{
                  ...styles.iconWrap,
                  ...(active ? styles.iconWrapActive : {}),
                }}
              >
                {item.icon}
              </span>

              <span
                style={{
                  ...styles.label,
                  ...(active ? styles.labelActive : {}),
                }}
              >
                {item.label}
              </span>

              {item.href === '/notifications' && notificationsCount > 0 ? (
                <span
                  style={{
                    ...styles.badge,
                    ...(active ? styles.badgeActive : {}),
                  }}
                >
                  {notificationsCount > 99 ? '99+' : notificationsCount}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

function HomeIcon() {
  return <svg viewBox="0 0 24 24" style={styles.iconSvg}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function BuildingIcon() {
  return <svg viewBox="0 0 24 24" style={styles.iconSvg}><path d="M5 20V6.5A1.5 1.5 0 0 1 6.5 5H14v15M14 9h4.5A1.5 1.5 0 0 1 20 10.5V20M8 9h2M8 12h2M8 15h2M14 13h2M14 16h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function ApprovalsIcon() {
  return <svg viewBox="0 0 24 24" style={styles.iconSvg}><path d="M7 12.5 10 15.5 17 8.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
}
function UsersIcon() {
  return <svg viewBox="0 0 24 24" style={styles.iconSvg}><path d="M15 19v-1.2a3.8 3.8 0 0 0-3.8-3.8H8.8A3.8 3.8 0 0 0 5 17.8V19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="10" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M19 19v-1a3.2 3.2 0 0 0-2.4-3.1M14.8 5.2a3 3 0 0 1 0 5.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function ResidentsIcon() {
  return <svg viewBox="0 0 24 24" style={styles.iconSvg}><path d="M7 18a5 5 0 0 1 10 0M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function RoomsIcon() {
  return <svg viewBox="0 0 24 24" style={styles.iconSvg}><path d="M4 20V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11M4 16h16M8 11h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function InventoryIcon() {
  return <svg viewBox="0 0 24 24" style={styles.iconSvg}><path d="M5 8.5 12 5l7 3.5-7 3.5-7-3.5ZM5 8.5V16l7 3.5 7-3.5V8.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function TasksIcon() {
  return <svg viewBox="0 0 24 24" style={styles.iconSvg}><path d="M9 6h10M9 12h10M9 18h10M4.5 6.5l1.5 1.5 2.5-3M4.5 12.5 6 14l2.5-3M4.5 18.5 6 20l2.5-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function HandoverIcon() {
  return <svg viewBox="0 0 24 24" style={styles.iconSvg}><path d="M7 7h10M7 12h10M7 17h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
}
function CalendarIcon() {
  return <svg viewBox="0 0 24 24" style={styles.iconSvg}><rect x="4" y="5" width="16" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M8 3v4M16 3v4M4 10h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
}
function BellIcon() {
  return <svg viewBox="0 0 24 24" style={styles.iconSvg}><path d="M6.75 16.25h10.5l-1.07-1.22a2.3 2.3 0 0 1-.55-1.51v-2.37a3.63 3.63 0 1 0-7.26 0v2.37c0 .55-.2 1.08-.55 1.51l-1.07 1.22Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" /><path d="M10.2 18.3a1.8 1.8 0 0 0 3.6 0" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>
}
function ProfileIcon() {
  return <svg viewBox="0 0 24 24" style={styles.iconSvg}><circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M6 19a6 6 0 0 1 12 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
}

const styles: Record<string, CSSProperties> = {
  sidebar: {
    width: 286,
    minWidth: 286,
    padding: 18,
    display: 'grid',
    gap: 14,
    alignSelf: 'start',
    position: 'sticky',
    top: 0,
    height: '100vh',
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg, #6c8771 0%, #5c7662 100%)',
    borderRight: '1px solid rgba(255,255,255,0.08)',
  },
  brandCard: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 24,
    padding: 18,
    boxShadow: '0 14px 30px rgba(43, 61, 48, 0.14)',
  },
  brandBadge: {
    display: 'inline-flex',
    alignSelf: 'start',
    marginBottom: 12,
    padding: '7px 12px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.18)',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1.2,
    marginBottom: 8,
  },
  brandSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 700,
    wordBreak: 'break-word',
  },
  nav: {
    display: 'grid',
    gap: 10,
  },
  link: {
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    padding: '10px 12px',
    background: '#ffffff',
    border: `1.5px solid ${ACCENT_BORDER}`,
    boxShadow: '0 10px 22px rgba(39, 55, 44, 0.06)',
    minHeight: 58,
  },
  linkActive: {
    border: `1.5px solid ${ACCENT}`,
    boxShadow: '0 12px 24px rgba(57, 84, 66, 0.12)',
    background: '#ffffff',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: ACCENT_SOFT,
    color: ACCENT,
    border: `1px solid ${ACCENT_BORDER}`,
    flexShrink: 0,
  },
  iconWrapActive: {
    background: ACCENT_SOFT,
    color: ACCENT,
    border: `1px solid ${ACCENT}`,
  },
  iconSvg: {
    width: 18,
    height: 18,
    display: 'block',
  },
  label: {
    fontSize: 14,
    fontWeight: 800,
    color: TEXT_SOFT,
    letterSpacing: 0.1,
  },
  labelActive: {
    color: TEXT_DARK,
  },
  badge: {
    marginLeft: 'auto',
    minWidth: 22,
    height: 22,
    padding: '0 6px',
    borderRadius: 999,
    background: ACCENT_SOFT,
    color: ACCENT,
    fontSize: 11,
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    border: `1px solid ${ACCENT_BORDER}`,
  },
  badgeActive: {
    background: ACCENT,
    color: '#ffffff',
    border: `1px solid ${ACCENT}`,
  },
}