'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentMembership, type CurrentMembership } from '@/lib/current-membership'
import { getReadableError } from '@/lib/errors'

type State = {
  loading: boolean
  membership: CurrentMembership | null
  userId: string | null
  error: string
}

export function useCurrentMembership() {
  const [state, setState] = useState<State>({
    loading: true,
    membership: null,
    userId: null,
    error: '',
  })

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setState((prev) => ({ ...prev, loading: true, error: '' }))

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        if (!user) {
          if (!mounted) return
          setState({
            loading: false,
            membership: null,
            userId: null,
            error: '',
          })
          return
        }

        const membership = await getCurrentMembership(user.id)

        if (!mounted) return

        setState({
          loading: false,
          membership,
          userId: user.id,
          error: '',
        })
      } catch (error) {
        if (!mounted) return
        setState({
          loading: false,
          membership: null,
          userId: null,
          error: getReadableError(error),
        })
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [])

  return state
}