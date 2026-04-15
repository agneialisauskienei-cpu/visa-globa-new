import { supabase } from '@/lib/supabase'

export async function getCurrentOrganizationId(): Promise<string | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (error) {
    return null
  }

  return data?.organization_id ?? null
}

