// App routing: the Studio (the drawing app) is the default screen; /login + /admin/* are admin-only.
// The Studio is the front door, so it loads eagerly; the Admin and Login screens are code-split
// (React.lazy) so the Studio's initial bundle doesn't pull in admin-only views or the auth UI.
import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import StudioPage from './studio/StudioPage.jsx'
import RequireAdmin from './admin/RequireAdmin.jsx'
import { loadDbSymbols } from './engine/symbolLoader.js'

// Admin-only screens: only fetched when the user actually navigates to /login or /admin.
const LoginPage = lazy(() => import('./admin/LoginPage.jsx'))
const AdminPage = lazy(() => import('./admin/AdminPage.jsx'))

function RouteFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--ink-dim)' }}>
      Loading…
    </div>
  )
}

export default function AppRouter() {
  // Load the DB symbol overlay once at boot (baseline ⊕ overlay). No-ops without Supabase.
  useEffect(() => { loadDbSymbols() }, [])

  // Navigation between Studio and Admin is by URL (/, /admin) — no top nav bar.
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<StudioPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/*" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
