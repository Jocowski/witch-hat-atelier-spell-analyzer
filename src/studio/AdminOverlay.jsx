// AdminOverlay.jsx — wraps AdminPage in a MemoryRouter so its useNavigate() / Link
// hooks have an in-memory history that never touches the browser URL.
// This lets AdminPage work inside the ConfigPanel overlay without a BrowserRouter,
// keeping GitHub Pages free of SPA 404s.
import { MemoryRouter } from 'react-router-dom'
import AdminPage from '../admin/AdminPage.jsx'

export default function AdminOverlay() {
  return (
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>
  )
}
