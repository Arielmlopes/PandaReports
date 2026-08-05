import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

export const ROLES = { ADMIN: 'admin', MEMBER: 'member', CLIENT: 'client', FREELANCER: 'freelancer' }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  const resolveRole = async (email) => {
    const { data } = await supabase.from('user_roles').select('role').eq('email', email).single()
    return data?.role || ROLES.MEMBER
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setUser(data.session.user)
        const r = await resolveRole(data.session.user.email)
        setRole(r)
      }
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user)
        const r = await resolveRole(session.user.email)
        setRole(r)
      } else {
        setUser(null)
        setRole(null)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const r = await resolveRole(email)
    setRole(r)
    return { user: data.user, role: r }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setRole(null)
  }

  const isAdmin = role === ROLES.ADMIN
  const isMember = role === ROLES.MEMBER
  const isClient = role === ROLES.CLIENT
  const isFreelancer = role === ROLES.FREELANCER
  const canAccessAdmin = isAdmin
  const canAccessKanban = isAdmin || isMember || isFreelancer
  const canAccessClients = isAdmin || isMember

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout, isAdmin, isMember, isClient, isFreelancer, canAccessAdmin, canAccessKanban, canAccessClients, ROLES }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
