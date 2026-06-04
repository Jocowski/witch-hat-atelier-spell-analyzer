// data-services/audit.js — write and read the audit_log table (admin-only via RLS).
import { supabase, hasSupabase } from './supabase.js'

/**
 * Append an entry to audit_log.
 * `actor` is resolved from the current session; callers only supply action + target.
 * The insert RLS policy requires the user to be an admin.
 *
 * @param {{ action: string, target?: object }} entry
 * @returns {Promise<object>} The inserted row.
 */
export async function logAction({ action, target }) {
  if (!hasSupabase()) return null
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('audit_log')
    .insert({
      actor: user?.id ?? null,
      action,
      target: target ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

/**
 * Fetch the most recent audit log entries (admin-only; RLS enforces this).
 * @param {number} [limit=100]
 * @returns {Promise<object[]>}
 */
export async function recentAudit(limit = 100) {
  if (!hasSupabase()) return []
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data
}
