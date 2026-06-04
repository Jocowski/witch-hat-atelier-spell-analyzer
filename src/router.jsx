// App routing: the Studio (the drawing app) is the default screen; /login + /admin/* are admin-only.
// The Studio is the front door, so it loads eagerly; the Admin and Login screens are code-split
// (React.lazy) so the Studio's initial bundle doesn't pull in admin-only views or the auth UI.
import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import StudioPage from './studio/StudioPage.jsx'
import RequireAdmin from './admin/RequireAdmin.jsx'

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

function Nav() {
  const { pathname } = useLocation()
  // The login/admin screens are full-page and carry their own chrome — hide the top nav there.
  if (pathname.startsWith('/admin') || pathname.startsWith('/login')) return null
  return (
    <nav className="app-nav">
      <Link className={pathname === '/' ? 'on' : ''} to="/">Studio</Link>
      <Link to="/admin">Admin</Link>
    </nav>
  )
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Nav />
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
