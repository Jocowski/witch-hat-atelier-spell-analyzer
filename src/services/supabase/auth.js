// data-services/auth.js — Supabase Auth helpers + profile access.
import { supabase, hasSupabase } from './client.js'

/**
 * Sign in an existing user with email + password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: object, session: object }>}
 */
export async function signIn(email, password) {
  if (!hasSupabase()) throw new Error('Supabase not configured')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data
}

/**
 * Register a new user with email + password.
 * Passes `username` in raw_user_meta_data so the `handle_new_user` trigger can
 * store it in the profiles row.
 * @param {string} email
 * @param {string} password
 * @param {string} username
 * @returns {Promise<{ user: object, session: object }>}
 */
export async function signUp(email, password, username) {
  if (!hasSupabase()) throw new Error('Supabase not configured')
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  })
  if (error) throw new Error(error.message)
  return data
}

/**
 * Sign out the current user.
 * @returns {Promise<void>}
 */
export async function signOut() {
  if (!hasSupabase()) return
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

/**
 * Return the current session object, or null if not signed in.
 * @returns {Promise<object|null>}
 */
export async function getSession() {
  if (!hasSupabase()) return null
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw new Error(error.message)
  return session
}

/**
 * Return the current authenticated user, or null.
 * @returns {Promise<object|null>}
 */
export async function getUser() {
  if (!hasSupabase()) return null
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw new Error(error.message)
  return user
}

/**
 * Return the profiles row for the current user (includes `role`),
 * or null when unauthenticated or Supabase is unavailable.
 * @returns {Promise<object|null>}
 */
export async function getProfile() {
  if (!hasSupabase()) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (error) throw new Error(error.message)
  return data
}

/**
 * Subscribe to auth state changes (SIGNED_IN, SIGNED_OUT, etc.).
 * Returns the Supabase subscription object; call `.unsubscribe()` to clean up.
 * No-ops (returns a dummy object) when Supabase is not configured.
 *
 * @param {(event: string, session: object|null) => void} cb
 * @returns {{ unsubscribe: () => void }}
 */
export function onAuthChange(cb) {
  if (!hasSupabase()) return { unsubscribe: () => {} }
  const { data: { subscription } } = supabase.auth.onAuthStateChange(cb)
  return subscription
}
