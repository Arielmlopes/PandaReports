import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [clients, setClients] = useState([])
  const [collaborators, setCollaborators] = useState([])
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [toasts, setToasts] = useState([])

  const loadClients = useCallback(async () => {
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients(data || [])
  }, [])

  const loadCollaborators = useCallback(async () => {
    const { data } = await supabase.from('collaborators').select('*').order('name')
    setCollaborators(data || [])
  }, [])

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('settings').select('*')
    const map = {}
    ;(data || []).forEach((s) => {
      map[s.key] = s
    })
    setSettings(map)
  }, [])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadClients(), loadCollaborators(), loadSettings()])
    setLoading(false)
  }, [loadClients, loadCollaborators, loadSettings])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  function pushToast(toast) {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, type: 'info', duration: 3500, ...toast }])
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, toast.duration || 3500)
  }

  function dismissToast(id) {
    setToasts((t) => t.filter((x) => x.id !== id))
  }

  const value = {
    clients,
    collaborators,
    settings,
    loading,
    loadClients,
    loadCollaborators,
    loadSettings,
    refreshAll,
    sidebarCollapsed,
    setSidebarCollapsed,
    toasts,
    pushToast,
    dismissToast
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
