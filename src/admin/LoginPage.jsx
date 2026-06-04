// LoginPage.jsx — admin login form.
// Route: /login
// On success → navigates to /admin.
// NOTE FOR ORCHESTRATOR: the first admin user must be seeded manually via a Supabase SQL script
// (e.g. call auth.users insert + UPDATE public.profiles SET role='admin' WHERE id=<uid>).
// No self-registration is exposed here — login only.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'
import './admin.css'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      navigate('/admin')
    } catch (err) {
      setError(err.message || 'Sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-wrap">
      <div className="admin-login-card">
        <h2 className="admin-login-title">Spell Studio — Admin</h2>
        <form onSubmit={handleSubmit} className="admin-login-form">
          <label className="admin-label">
            Email
            <input
              type="email"
              className="admin-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              disabled={loading}
            />
          </label>
          <label className="admin-label">
            Password
            <input
              type="password"
              className="admin-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </label>
          {error && <p className="admin-error">{error}</p>}
          <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="admin-back-link">
          <Link to="/">Back to Studio</Link>
        </p>
      </div>
    </div>
  )
}
