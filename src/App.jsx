import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AppProvider } from '@/contexts/AppContext'
import Layout from '@/components/layout/Layout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ClientPage from '@/pages/ClientPage'
import KanbanPage from '@/pages/KanbanPage'
import TodoPage from '@/pages/TodoPage'
import SettingsPage from '@/pages/SettingsPage'
import PublicBriefingPage from '@/pages/PublicBriefingPage'
import AppLoader from '@/components/layout/AppLoader'

function ProtectedRoute({ children, roles }) {
  const { user, role, loading } = useAuth()
  if (loading) return <AppLoader />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <AppLoader />

  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" replace />} />
        <Route path="/form/:clientId" element={<PublicBriefingPage />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route index element={<DashboardPage />} />
                <Route path="clients/:id" element={<ClientPage />} />
                <Route path="kanban" element={<KanbanPage />} />
                <Route path="todo" element={<TodoPage />} />
                <Route path="settings" element={<ProtectedRoute roles={['admin']}><SettingsPage /></ProtectedRoute>} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
