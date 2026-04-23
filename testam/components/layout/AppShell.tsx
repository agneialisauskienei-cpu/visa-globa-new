'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppSidebar from '@/components/layout/AppSidebar'

type MembershipRole = 'owner' | 'admin' | 'employee' | null

const HIDDEN_SHELL_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/create-password',
  '/update-password',
  '/pending-approval',
  '/success',
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const [notificationsCount, setNotificationsCount] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const [role, setRole] = useState<MembershipRole>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const shouldHideShell = useMemo(() => {
    if (!pathname) return false
    return HIDDEN_SHELL_ROUTES.some((route) => pathname === route)
  }, [pathname])

  useEffect(() => {
    if (shouldHideShell) return
    loadShellData()
  }, [pathname, shouldHideShell])

  async function loadShellData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setNotificationsCount(0)
        setRole(null)
        setOrganizationId(null)

        if (!HIDDEN_SHELL_ROUTES.includes(pathname || '')) {
          router.replace('/login')
        }
        return
      }

      const [membershipRes, notificationsRes, pendingRes] = await Promise.all([
        supabase
          .from('organization_members')
          .select('organization_id, role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false),

        supabase
          .from('organization_join_requests')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      const membership = (membershipRes.data || null) as
        | { organization_id: string; role: MembershipRole }
        | null

      const hasPendingRequest = !!pendingRes.data

      if (!membership) {
        setNotificationsCount(0)
        setRole(null)
        setOrganizationId(null)

        if (hasPendingRequest) {
          if (pathname !== '/pending-approval') {
            router.replace('/pending-approval')
          }
          return
        }

        if (!HIDDEN_SHELL_ROUTES.includes(pathname || '')) {
          router.replace('/login')
        }
        return
      }

      setRole(membership.role || null)
      setOrganizationId(membership.organization_id || null)
      setNotificationsCount(notificationsRes.count || 0)

      if (pathname === '/pending-approval') {
        if (membership.role === 'owner' || membership.role === 'admin') {
          router.replace('/admin-dashboard')
          return
        }

        if (membership.role === 'employee') {
          router.replace('/employee-dashboard')
          return
        }
      }
    } catch {
      setNotificationsCount(0)
      setRole(null)
      setOrganizationId(null)
    }
  }

  async function handleLogout() {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
      router.replace('/login')
      router.refresh()
    } finally {
      setLoggingOut(false)
    }
  }

  if (shouldHideShell) {
    return <>{children}</>
  }

  return (
    <div style={styles.shell}>
      <AppSidebar
        notificationsCount={notificationsCount}
        role={role}
        organizationId={organizationId}
      />

      <div style={styles.contentArea}>
        <header style={styles.topbar}>
          <div />

          <div style={styles.topbarRight}>
            <Link href="/notifications" style={styles.notificationButton}>
              <span style={styles.notificationIconWrap}>
                <BellIcon />
              </span>
              <span style={styles.notificationText}>Pranešimai</span>
              {notificationsCount > 0 ? (
                <span style={styles.notificationBadge}>
                  {notificationsCount > 99 ? '99+' : notificationsCount}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              style={styles.logoutButton}
              disabled={loggingOut}
            >
              <span style={styles.logoutIconWrap}>
                <LogoutIcon />
              </span>
              <span>{loggingOut ? 'Atsijungiama...' : 'Atsijungti'}</span>
            </button>
          </div>
        </header>

        <div style={styles.pageWrap}>{children}</div>
      </div>
    </div>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" style={styles.iconSvg} aria-hidden="true">
      <path
        d="M6.75 16.25h10.5l-1.07-1.22a2.3 2.3 0 0 1-.55-1.51v-2.37a3.63 3.63 0 1 0-7.26 0v2.37c0 .55-.2 1.08-.55 1.51l-1.07 1.22Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 18.3a1.8 1.8 0 0 0 3.6 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" style={styles.iconSvg} aria-hidden="true">
      <path
        d="M14 7V5.8A1.8 1.8 0 0 0 12.2 4H6.8A1.8 1.8 0 0 0 5 5.8v12.4A1.8 1.8 0 0 0 6.8 20h5.4a1.8 1.8 0 0 0 1.8-1.8V17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 12h8.5M16.4 8.9 19.5 12l-3.1 3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh',
    display: 'flex',
    background: '#ffffff',
  },
  contentArea: {
    flex: 1,
    minWidth: 0,
    padding: 18,
    display: 'grid',
    gap: 16,
    background: '#ffffff',
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    padding: '4px 2px 8px',
    background: '#ffffff',
  },
  topbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  notificationButton: {
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    padding: '10px 14px',
    background: '#ffffff',
    border: '1px solid #d8e1d8',
    color: '#2b3a2f',
    fontWeight: 800,
    boxShadow: '0 8px 24px rgba(56, 78, 61, 0.05)',
  },
  notificationIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#eef3ee',
    color: '#5a7561',
    border: '1px solid #dde7dd',
    flexShrink: 0,
  },
  notificationText: {
    fontSize: 14,
    fontWeight: 800,
  },
  notificationBadge: {
    minWidth: 22,
    height: 22,
    padding: '0 6px',
    borderRadius: 999,
    background: '#5d7865',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
  },
  logoutButton: {
    border: '1px solid #d8e1d8',
    cursor: 'pointer',
    borderRadius: 16,
    padding: '10px 14px',
    background: '#ffffff',
    color: '#2b3a2f',
    fontSize: 14,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0 8px 24px rgba(56, 78, 61, 0.05)',
  },
  logoutIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#eef3ee',
    color: '#5a7561',
    border: '1px solid #dde7dd',
    flexShrink: 0,
  },
  iconSvg: {
    width: 18,
    height: 18,
    display: 'block',
  },
  pageWrap: {
    minWidth: 0,
    background: '#ffffff',
  },
}