import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "placeholder-key"

export const supabaseConfig = {
  hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  hasPublicKey: Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  usesPlaceholder:
    supabaseUrl === "https://placeholder.supabase.co" ||
    supabaseAnonKey === "placeholder-key",
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
