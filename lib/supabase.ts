import { createClient } from '@supabase/supabase-js'

const missingSupabaseUrl = "https://missing-supabase-url.invalid"
const missingSupabaseKey = "missing-supabase-key"

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || missingSupabaseUrl
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  missingSupabaseKey

export const supabaseConfig = {
  hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  hasPublicKey: Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  usesPlaceholder:
    supabaseUrl === missingSupabaseUrl ||
    supabaseAnonKey === missingSupabaseKey,
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
