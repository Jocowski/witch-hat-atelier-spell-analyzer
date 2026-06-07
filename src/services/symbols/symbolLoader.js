// symbolLoader.js — fetch the DB `symbols` overlay and apply it to the runtime store.
// No-ops gracefully when Supabase isn't configured (the JSON baseline stays in effect), so the
// Studio works offline / logged-out exactly as before.
import { listSymbols } from '../supabase/symbols.js'
import { hasSupabase } from '../supabase/client.js'
import { applyOverlay } from './symbolStore.js'

let loaded = false

/** Pull all registry rows and overlay them onto the JSON baseline. Safe to call repeatedly. */
export async function loadDbSymbols() {
  if (!hasSupabase()) return
  try {
    const rows = await listSymbols()
    applyOverlay(rows || [])
    loaded = true
  } catch {
    /* keep the baseline on any failure (network/RLS/etc.) */
  }
}

export function symbolsLoaded() {
  return loaded
}
