import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const REMEMBER_KEY = 'panda_remember_session'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // Papel vem de user_roles por auth.uid(). Sem linha = sem acesso ('none'); nunca assume 'member'.
  const loadRole = useCallback(async (userId) => {
    if (!userId) {
      setRole(null)
      return
    }
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle()
    setRole(data?.role || 'none')
  }, [])

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      if (data.session?.user?.id) await loadRole(data.session.user.id)
      setLoading(false)
    }
    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession?.user?.id) loadRole(newSession.user.id)
      else setRole(null)
    })

    return () => sub.subscription.unsubscribe()
  }, [loadRole])

  async function login(email, password, remember) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // Resolve o role antes de devolver o controle: evita que uma navegacao
    // imediata para uma rota admin (ex: Configuracoes) veja role ainda nulo.
    await loadRole(data.user?.id)
    if (remember) {
      const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) || '[]')
      const exists = saved.find((s) => s.email === email)
      if (!exists) {
        saved.push({ email })
        localStorage.setItem(REMEMBER_KEY, JSON.stringify(saved))
      }
    }
    return data
  }

  async function logout() {
    await supabase.auth.signOut()
    setSession(null)
    setRole(null)
  }

  function getSavedSessions() {
    return JSON.parse(localStorage.getItem(REMEMBER_KEY) || '[]')
  }

  function removeSavedSession(email) {
    const saved = getSavedSessions().filter((s) => s.email !== email)
    localStorage.setItem(REMEMBER_KEY, JSON.stringify(saved))
  }

  const value = {
    session,
    user: session?.user || null,
    role,
    loading,
    login,
    logout,
    getSavedSessions,
    removeSavedSession,
    isAdmin: role === 'admin',
    isMember: role === 'member',
    isFreelancer: role === 'freelancer',
    isClient: role === 'client'
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
