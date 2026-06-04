// RequireAdmin.jsx — route guard for /admin/* routes.
// Uses useAuth() from AuthProvider; redirects to /login when not authenticated or not admin.
// Usage (in router.jsx):
//   <Route element={<RequireAdmin />}>
//     <Route path="/admin" element={<AdminPage />} />
//   </Route>
// — or wrap children directly:
//   <RequireAdmin><AdminPage /></RequireAdmin>
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'

export default function RequireAdmin({ children }) {
  const { session, role, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--ink-dim)' }}>
        Checking access…
      </div>
    )
  }

  if (!session || role !== 'admin') {
    return <Navigate to="/login" replace />
  }

  // Support both the <Outlet/> pattern (nested routes) and explicit children.
  return children ? <>{children}</> : <Outlet />
}
