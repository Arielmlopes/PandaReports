import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { SplashScreen } from './components/ui/SplashScreen'
import { AppLoader } from './components/layout/AppLoader'
import { Layout } from './components/layout/Layout'
import { ToastContainer } from './components/ui'
import { useAuth } from './contexts/AuthContext'
import { useApp } from './contexts/AppContext'
import { publicUrlFor } from './lib/supabase'

import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ClientPage from './pages/ClientPage'
import KanbanPage from './pages/KanbanPage'
import TodoPage from './pages/TodoPage'
import SettingsPage from './pages/SettingsPage'
import PublicBriefingPage from './pages/PublicBriefingPage'

function ProtectedRoute({ children }) {
  const { session, loading, role, logout } = useAuth()
  if (loading) return <AppLoader />
  if (!session) return <Navigate to="/login" replace />
  if (role === 'none') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bg text-text p-6 text-center">
        <p className="text-lg font-semibold">Sem acesso</p>
        <p className="text-sm text-text2">Sua conta ainda não foi liberada por um administrador.</p>
        <button onClick={logout} className="px-4 py-2 rounded-input bg-bg4 text-sm">
          Sair
        </button>
      </div>
    )
  }
  return children
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return <AppLoader />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const [splashDone, setSplashDone] = useState(() => sessionStorage.getItem('panda_splash_done') === '1')
  const { loading: authLoading } = useAuth()
  const { toasts, dismissToast, settings } = useApp()

  function handleSplashDone() {
    sessionStorage.setItem('panda_splash_done', '1')
    setSplashDone(true)
  }

  useEffect(() => {
    const faviconUrl = publicUrlFor(settings.favicon?.logo_url)
    if (!faviconUrl) return
    let link = document.querySelector('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = faviconUrl
  }, [settings.favicon])

  if (!splashDone) return <SplashScreen onDone={handleSplashDone} />
  if (authLoading) return <AppLoader />

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/form/:clientId" element={<PublicBriefingPage />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/clients/:id" element={<ClientPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/todo" element={<TodoPage />} />
          <Route
            path="/settings"
            element={
              <AdminRoute>
                <SettingsPage />
              </AdminRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}
