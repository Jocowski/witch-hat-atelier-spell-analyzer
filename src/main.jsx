import React from 'react'
import ReactDOM from 'react-dom/client'
import AppRouter from './router.jsx'
import ThemeProvider from './theme/ThemeProvider.jsx'
import AuthProvider from './admin/AuthProvider.jsx'
import './index.css'
import './theme/themes.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
