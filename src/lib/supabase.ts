import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
// Newer Supabase dashboards show a "publishable key" (sb_publishable_...)
// where older projects show the anon key (eyJ...). Either works as the
// browser-side key; security comes from RLS, not from hiding it.
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined

/**
 * Null until .env is configured — the app then runs in prototype mode
 * with in-memory sample data (Sprint 1 behavior).
 */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null

export const isCloudMode = supabase !== null