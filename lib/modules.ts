import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/current-organization'

export async function isModuleEnabled(moduleKey: string): Promise<boolean> {
  const organizationId = await getCurrentOrganizationId()

  if (!organizationId) return false

  const { data, error } = await supabase
    .from('organization_modules')
    .select('is_enabled')
    .eq('organization_id', organizationId)
    .eq('module_key', moduleKey)
    .maybeSingle()

  if (error) {
    console.error('Module check error:', error)
    return false
  }

  return data?.is_enabled === true
}

export async function getEnabledModules(): Promise<string[]> {
  const organizationId = await getCurrentOrganizationId()

  if (!organizationId) return []

  const { data, error } = await supabase
    .from('organization_modules')
    .select('module_key, is_enabled')
    .eq('organization_id', organizationId)
    .eq('is_enabled', true)

  if (error) {
    console.error('Enabled modules load error:', error)
    return []
  }

  return (data || []).map((item) => item.module_key)
}