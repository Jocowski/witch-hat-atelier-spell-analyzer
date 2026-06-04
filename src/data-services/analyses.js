// data-services/analyses.js — log and retrieve spell analyses.
import { supabase, hasSupabase } from './supabase.js'

/**
 * Persist a completed analysis to the `analyses` table.
 * `created_by` is set to the currently authenticated user's id (Supabase handles
 * this via RLS / session context — the insert policy requires created_by = auth.uid()).
 *
 * @param {{ composition: object, engine_result?: object,
 *           ai_report?: object, corrections?: object }} analysis
 * @returns {Promise<object>} The inserted row.
 */
export async function logAnalysis({ composition, engine_result, ai_report, corrections }) {
  if (!hasSupabase()) return null
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('analyses')
    .insert({
      composition,
      engine_result: engine_result ?? null,
      ai_report: ai_report ?? null,
      corrections: corrections ?? null,
      created_by: user?.id ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

/**
 * Fetch the most recent analyses visible to the current user
 * (own rows for regular users, all rows for admins — enforced by RLS).
 *
 * @param {number} [limit=50]
 * @returns {Promise<object[]>}
 */
export async function recentAnalyses(limit = 50) {
  if (!hasSupabase()) return []
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data
}
