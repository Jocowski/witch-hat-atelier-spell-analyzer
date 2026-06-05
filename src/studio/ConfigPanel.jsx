/**
 * ConfigPanel.jsx — gear-triggered settings drawer for the Studio.
 *
 * Sections (all gated by runtime capabilities):
 *   - !hasSupabase → "Backend not configured." — nothing actionable.
 *   - hasSupabase + !isAuthed → Login form (email + password, no register link).
 *   - isAuthed → signed-in email + Sign out + two opt-in toggles:
 *       • Use database training  (useDbTraining)
 *       • Show training tools    (showTrainingTools)
 *   - isAdmin (canOpenAdmin) → Open Admin overlay (lazy-loaded AdminPage in a full-screen portal).
 *
 * Accessibility: Esc closes; backdrop click closes.
 *
 * Props (all required when open=true):
 *   open                  boolean
 *   onClose               () => void
 *   useDbTraining         boolean   — current toggle state (from StudioPage localStorage)
 *   onToggleDbTraining    () => void
 *   showTrainingTools     boolean   — current toggle state (from StudioPage localStorage)
 *   onToggleTrainingTools () => void
 */

import { lazy, Suspense, useState, useEffect, useCallback } from 'react'
import { useCapabilities } from '../app/capabilities.js'
import { useAuth } from '../admin/AuthProvider.jsx'

// AdminOverlay is lazy-loaded on first open — keeps react-router-dom + AdminPage out of the
// initial bundle. AdminOverlay wraps AdminPage in a MemoryRouter so useNavigate() works
// without a BrowserRouter in the tree (safe for GitHub Pages — never touches the URL).
const AdminOverlay = lazy(() => import('./AdminOverlay.jsx'))

export default function ConfigPanel({
  open,
  onClose,
  useDbTraining,
  onToggleDbTraining,
  showTrainingTools,
  onToggleTrainingTools,
}) {
  const { hasSupabase, isAuthed, canOpenAdmin } = useCapabilities()
  const { user, signIn, signOut } = useAuth()

  // Login form local state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState(null)
  const [loginBusy, setLoginBusy] = useState(false)

  // Admin overlay state
  const [adminOpen, setAdminOpen] = useState(false)

  // Close on Esc
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      if (adminOpen) { setAdminOpen(false) } else { onClose() }
    }
  }, [adminOpen, onClose])

  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  // Auto-close the admin overlay when the user becomes unauthenticated (sign-out from inside admin).
  useEffect(() => {
    if (!isAuthed) setAdminOpen(false)
  }, [isAuthed])

  // Reset login form when panel closes or user logs in
  useEffect(() => {
    if (!open || isAuthed) {
      setEmail('')
      setPassword('')
      setLoginError(null)
      setLoginBusy(false)
    }
  }, [open, isAuthed])

  if (!open) return null

  async function handleLogin(e) {
    e.preventDefault()
    if (loginBusy) return
    setLoginError(null)
    setLoginBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setLoginError(err?.message || 'Sign in failed. Check your email and password.')
    } finally {
      setLoginBusy(false)
    }
  }

  async function handleSignOut() {
    await signOut()
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  function handleAdminBackdropClick(e) {
    if (e.target === e.currentTarget) setAdminOpen(false)
  }

  return (
    <>
      {/* Config drawer backdrop */}
      <div className="cfg-backdrop" onClick={handleBackdropClick} aria-modal="true" role="dialog" aria-label="Settings">
        <div className="cfg-panel">
          <div className="cfg-header">
            <span className="cfg-title">Settings</span>
            <button className="cfg-close" onClick={onClose} aria-label="Close settings">✕</button>
          </div>

          <div className="cfg-body">
            {!hasSupabase && (
              <p className="cfg-notice">Backend not configured.</p>
            )}

            {hasSupabase && !isAuthed && (
              <section className="cfg-section">
                <h3 className="cfg-section-title">Sign in</h3>
                <form className="cfg-login-form" onSubmit={handleLogin}>
                  <label className="cfg-label">
                    Email
                    <input
                      className="cfg-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      disabled={loginBusy}
                    />
                  </label>
                  <label className="cfg-label">
                    Password
                    <input
                      className="cfg-input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      disabled={loginBusy}
                    />
                  </label>
                  {loginError && <p className="cfg-error">{loginError}</p>}
                  <button className="primary cfg-submit" type="submit" disabled={loginBusy}>
                    {loginBusy ? 'Signing in…' : 'Sign in'}
                  </button>
                </form>
              </section>
            )}

            {isAuthed && (
              <>
                <section className="cfg-section">
                  <div className="cfg-account-row">
                    <span className="cfg-account-email">{user?.email}</span>
                    <button className="secondary cfg-signout" onClick={handleSignOut}>Sign out</button>
                  </div>
                </section>

                <section className="cfg-section">
                  <h3 className="cfg-section-title">Recognition</h3>
                  <label className="cfg-toggle-row">
                    <input
                      type="checkbox"
                      checked={useDbTraining}
                      onChange={onToggleDbTraining}
                    />
                    <span className="cfg-toggle-label">Use database training</span>
                  </label>
                  <p className="cfg-toggle-desc">
                    Augment the bundled recognizer with verified samples from the database.
                    The bundled seed remains the floor — recognition can only improve.
                  </p>
                </section>

                <section className="cfg-section">
                  <h3 className="cfg-section-title">Training</h3>
                  <label className="cfg-toggle-row">
                    <input
                      type="checkbox"
                      checked={showTrainingTools}
                      onChange={onToggleTrainingTools}
                    />
                    <span className="cfg-toggle-label">Show training tools</span>
                  </label>
                  <p className="cfg-toggle-desc">
                    Reveal contribute-to-training buttons on detected symbols.
                    Submissions are held for admin review before affecting recognition.
                  </p>
                </section>

                {canOpenAdmin && (
                  <section className="cfg-section">
                    <h3 className="cfg-section-title">Admin</h3>
                    <button className="primary cfg-admin-btn" onClick={() => setAdminOpen(true)}>
                      Open Admin
                    </button>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Admin full-screen overlay */}
      {adminOpen && (
        <div className="cfg-admin-overlay" onClick={handleAdminBackdropClick}>
          <div className="cfg-admin-shell">
            <button
              className="cfg-admin-close"
              onClick={() => setAdminOpen(false)}
              aria-label="Close admin"
            >
              ✕ Close Admin
            </button>
            <Suspense
              fallback={
                <div className="cfg-admin-loading">Loading admin…</div>
              }
            >
              <AdminOverlay />
            </Suspense>
          </div>
        </div>
      )}
    </>
  )
}
