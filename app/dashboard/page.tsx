'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ProfileRow = {
  id: string
  email: string | null
  role: string | null
}

type MembershipRow = {
  organization_id: string
  role: 'owner' | 'admin' | 'employee'
}

export default function DashboardPage() {
  const router = useRouter()

  useEffect(() => {
    const resolveDashboard = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('id', user.id)
        .maybeSingle()

      const typedProfile = (profile as ProfileRow | null) || null
      const globalRole = typedProfile?.role || ''

      if (globalRole === 'super_admin') {
        router.replace('/admin')
        return
      }

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      const typedMembership = (membership as MembershipRow | null) || null
      const organizationRole = typedMembership?.role || ''

      if (organizationRole === 'owner' || organizationRole === 'admin') {
        router.replace('/admin-dashboard')
        return
      }

      if (organizationRole === 'employee') {
        router.replace('/employee-dashboard')
        return
      }

      router.replace('/login')
    }

    resolveDashboard()
  }, [router])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        color: '#475569',
        background: '#f8fafc',
      }}
    >
      Kraunama...
    </div>
  )
}