// App routing: the Studio (new drawing app) is the default screen; the legacy structured
// drag-drop editor stays reachable at /editor; /admin is added later (WS5). Keeping the old App
// untouched at its own route avoids a risky monolith refactor while the Studio becomes the front door.
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import StudioPage from './studio/StudioPage.jsx'
import LoginPage from './admin/LoginPage.jsx'
import AdminPage from './admin/AdminPage.jsx'
import RequireAdmin from './admin/RequireAdmin.jsx'

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
      <Routes>
        <Route path="/" element={<StudioPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/*" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
