'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import AppSidebar from '@/components/layout/AppSidebar'
import {
  getCurrentOrganizationContext,
  getStoredOrganizationId,
  setCurrentOrganizationId,
} from '@/lib/current-organization'

type MembershipRole = 'owner' | 'admin' | 'employee' | null

type ActiveMembership = {
  organization_id: string
  role?: MembershipRole
  is_active?: boolean | null
  created_at?: string | null
}

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
  const [switchingOrg, setSwitchingOrg] = useState(false)
  const [role, setRole] = useState<MembershipRole>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [memberships, setMemberships] = useState<ActiveMembership[]>([])
  const [bootstrapping, setBootstrapping] = useState(true)

  const shouldHideShell = useMemo(() => {
    if (!pathname) return false
    return HIDDEN_SHELL_ROUTES.some((route) => pathname === route)
  }, [pathname])

  useEffect(() => {
    if (shouldHideShell) {
      setBootstrapping(false)
      return
    }

    void loadShellData()
  }, [pathname, shouldHideShell])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'active_organization_id') {
        void loadShellData()
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [pathname, shouldHideShell])

  async function loadShellData() {
    try {
      setBootstrapping(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        resetShellState()

        if (!HIDDEN_SHELL_ROUTES.includes(pathname || '')) {
          router.replace('/login')
        }
        return
      }

      const [
        { organizationId: activeOrganizationId, memberships: activeMemberships, activeMembership },
        notificationsRes,
        pendingRes,
      ] = await Promise.all([
        getCurrentOrganizationContext(),
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

      const hasPendingRequest = !!pendingRes.data

      if (!activeMembership || !activeOrganizationId) {
        resetShellState()

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

      const nextRole = (activeMembership.role || null) as MembershipRole

      setRole(nextRole)
      setOrganizationId(activeOrganizationId)
      setMemberships(activeMemberships)
      setNotificationsCount(notificationsRes.count || 0)

      if (pathname === '/pending-approval' || pathname === '/dashboard') {
        redirectToRoleHome(nextRole)
        return
      }
    } catch (error) {
      console.error('Shell load failed:', error)
    } finally {
      setBootstrapping(false)
    }
  }

  function resetShellState() {
    setNotificationsCount(0)
    setRole(null)
    setOrganizationId(null)
    setMemberships([])
  }

  function redirectToRoleHome(nextRole: MembershipRole) {
    if (nextRole === 'owner' || nextRole === 'admin') {
      router.replace('/admin-dashboard')
      return
    }

    router.replace('/employee-dashboard')
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

  async function handleOrganizationChange(nextOrganizationId: string) {
    if (!nextOrganizationId || nextOrganizationId === organizationId) return

    try {
      setSwitchingOrg(true)

      const ok = await setCurrentOrganizationId(nextOrganizationId)

      if (!ok) {
        console.error('Failed to switch organization')
        return
      }

      const nextMembership =
        memberships.find((item) => item.organization_id === nextOrganizationId) || null
      const nextRole = (nextMembership?.role || null) as MembershipRole

      setOrganizationId(nextOrganizationId)
      setRole(nextRole)

      if (nextRole === 'owner' || nextRole === 'admin') {
        router.replace('/admin-dashboard')
      } else {
        router.replace('/employee-dashboard')
      }

      router.refresh()
    } finally {
      setSwitchingOrg(false)
    }
  }

  if (shouldHideShell) {
    return <>{children}</>
  }

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen bg-[#f5f6f4] text-slate-900">
        <div className="m-auto rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm shadow-sm">
          Kraunama sistema...
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#f5f6f4] text-slate-900">
      <AppSidebar
        notificationsCount={notificationsCount}
        role={role}
        organizationId={organizationId}
      />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between px-6 py-4 lg:px-8">
            <div className="min-w-0">
              <div className="text-sm text-slate-500">Aktyvi organizacija</div>

              <div className="mt-1 flex items-center gap-3">
                {memberships.length > 1 ? (
                  <div className="relative">
                    <select
                      value={organizationId || ''}
                      onChange={(e) => void handleOrganizationChange(e.target.value)}
                      disabled={switchingOrg}
                      className="appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 pr-10 text-sm font-semibold text-slate-900 outline-none transition hover:bg-slate-100 focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {memberships.map((membership) => (
                        <option
                          key={membership.organization_id}
                          value={membership.organization_id}
                        >
                          {membership.organization_id}
                        </option>
                      ))}
                    </select>

                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                  </div>
                ) : (
                  <div className="text-base font-semibold text-slate-900">
                    {organizationId || getStoredOrganizationId() || 'Nepasirinkta'}
                  </div>
                )}

                {switchingOrg ? (
                  <span className="text-xs font-medium text-emerald-700">
                    Perjungiama...
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={
                  role === 'owner' || role === 'admin'
                    ? '/admin-dashboard'
                    : '/employee-dashboard'
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Pagrindinis
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-xl bg-[#0f4f3d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0c4333] disabled:opacity-60"
              >
                {loggingOut ? 'Atsijungiama...' : 'Atsijungti'}
              </button>
            </div>
          </div>
        </header>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}