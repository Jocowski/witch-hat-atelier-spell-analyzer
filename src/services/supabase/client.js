// Supabase client (browser). Config comes from Vite env (.env → import.meta.env). When the env is
// absent (e.g. the engine-only build or tests), `supabase` is null and callers fall back to local
// behavior — so the app degrades gracefully instead of crashing without a DB.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anon ? createClient(url, anon) : null
export const hasSupabase = () => supabase != null
