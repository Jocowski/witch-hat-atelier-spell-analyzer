// AdminPage.jsx — the admin shell.
// Route: /admin  (protected by RequireAdmin)
// Tabs: Training · Registry · Review
// Default export.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'
import TrainingView from './TrainingView.jsx'
import RegistryView from './RegistryView.jsx'
import ReviewView   from './ReviewView.jsx'
import TraceView    from './TraceView.jsx'
import './admin.css'

const TABS = [
  { id: 'training', label: 'Training' },
  { id: 'registry', label: 'Registry' },
  { id: 'trace',    label: 'Trace'    },
  { id: 'review',   label: 'Review'   },
]

export default function AdminPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('training')

  async function handleSignOut() {
    try {
      await signOut()
    } finally {
      navigate('/login')
    }
  }

  return (
    <div className="admin-shell">
      {/* ── Header ── */}
      <header className="admin-header">
        <span className="admin-header-title">Spell Studio · Admin</span>
        <span className="admin-header-user">{user?.email}</span>
        <button className="admin-btn admin-btn-ghost" onClick={handleSignOut}>
          Sign out
        </button>
      </header>

      {/* ── Tab bar ── */}
      <nav className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`admin-tab${activeTab === t.id ? ' admin-tab-active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Tab content ── */}
      <main className="admin-content">
        {activeTab === 'training' && <TrainingView />}
        {activeTab === 'registry' && <RegistryView />}
        {activeTab === 'trace'    && <TraceView />}
        {activeTab === 'review'   && <ReviewView />}
      </main>
    </div>
  )
}
