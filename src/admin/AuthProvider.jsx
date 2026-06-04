// AuthProvider.jsx — Supabase Auth context for the admin area.
// Exports: AuthProvider (default), useAuth() hook.
// The orchestrator must:
//   1. Wrap the app (or at least the /admin subtree) with <AuthProvider>.
//   2. Import useAuth where role-gating is needed.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  getSession,
  getProfile,
  signIn as dsSignIn,
  signOut as dsSignOut,
  onAuthChange,
} from '../data-services/auth.js'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export default function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [user, setUser]         = useState(null)
  const [profile, setProfile]   = useState(null)
  const [role, setRole]         = useState(null)
  const [loading, setLoading]   = useState(true)

  // Fetch the profile (and role) for the currently signed-in user.
  const refreshProfile = useCallback(async () => {
    try {
      const p = await getProfile()
      setProfile(p)
      setRole(p?.role ?? null)
    } catch {
      setProfile(null)
      setRole(null)
    }
  }, [])

  // Bootstrap: read existing session on mount, then subscribe to changes.
  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        const s = await getSession()
        if (!cancelled) {
          setSession(s)
          setUser(s?.user ?? null)
          if (s?.user) {
            await refreshProfile()
          }
        }
      } catch {
        // Supabase not configured or network error — stay logged-out gracefully.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    boot()

    const sub = onAuthChange(async (_event, s) => {
      if (cancelled) return
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        await refreshProfile()
      } else {
        setProfile(null)
        setRole(null)
      }
    })

    return () => {
      cancelled = true
      sub.unsubscribe?.()
    }
  }, [refreshProfile])

  const signIn = useCallback(async (email, password) => {
    const data = await dsSignIn(email, password)
    // onAuthChange will fire and update state; but we also refresh immediately
    // so callers can await signIn() and see the updated role right away.
    setSession(data.session)
    setUser(data.user)
    await refreshProfile()
    return data
  }, [refreshProfile])

  const signOut = useCallback(async () => {
    await dsSignOut()
    setSession(null)
    setUser(null)
    setProfile(null)
    setRole(null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const s = await getSession()
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) await refreshProfile()
      else { setProfile(null); setRole(null) }
    } catch { /* ignore */ }
  }, [refreshProfile])

  return (
    <AuthContext.Provider value={{ session, user, profile, role, loading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
