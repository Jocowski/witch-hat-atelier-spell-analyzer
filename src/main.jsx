import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import ThemeProvider from './theme/ThemeProvider.jsx'
import AuthProvider from './admin/AuthProvider.jsx'
import { useAuth } from './admin/AuthProvider.jsx'
import StudioPage from './studio/StudioPage.jsx'
import { loadDbSymbols } from './engine/symbolLoader.js'
import './index.css'
import './theme/themes.css'

// Root is rendered inside AuthProvider so it can read the session.
// loadDbSymbols is called ONLY when a session is present (authed user).
// Anonymous visitors get the JSON baseline and make ZERO Supabase network calls.
function Root() {
  const { session } = useAuth()

  useEffect(() => {
    if (session) {
      loadDbSymbols()
    }
  }, [session])

  return <StudioPage />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
