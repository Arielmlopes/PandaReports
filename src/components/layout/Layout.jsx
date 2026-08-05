import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useApp } from '@/contexts/AppContext'
import { ChevronLeft, ChevronRight, LayoutDashboard, Columns, CheckSquare, Settings, Bell, Menu, X, Users, Trash2 } from 'lucide-react'
import NotifPanel from '@/components/notifications/NotifPanel'
import { supabase } from '@/lib/supabase'

const TOPBAR_H = 56

/* ── Client list — isolated to prevent search re-renders ── */
const ClientList = memo(function ClientList({ clients, collapsed }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => q ? clients.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) : clients, [clients, q])
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {!collapsed && (
        <div className="px-3 pt-2 pb-1.5 flex-shrink-0">
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#555', fontWeight: 700, marginBottom: 6 }}>Clientes</p>
          <input
            style={{ width: '100%', background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#E8E8E8', outline: 'none' }}
            placeholder="⌕ Buscar..."
            value={q}
            onChange={e => setQ(e.target.value)}
            onFocus={e => e.target.style.borderColor = '#6BAF45'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px', minHeight: 0 }}>
        {filtered.map(c => (
          <NavLink key={c.id} to={`/clients/${c.id}`}>
            {({ isActive }) => (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8,
                fontSize: 12, cursor: 'pointer', transition: 'background .12s',
                background: isActive ? 'rgba(107,175,69,0.1)' : 'transparent',
                color: isActive ? '#6BAF45' : '#888',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#1A1A1A'; if (!isActive) e.currentTarget.style.color = '#E8E8E8' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; if (!isActive) e.currentTarget.style.color = '#888' }}
                title={collapsed ? c.name : ''}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }}/>
                {!collapsed && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>}
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )
})

/* ── Main Layout ──────────────────────────────────────── */
export default function Layout({ children }) {
  const { user, role, logout, isAdmin, isMember } = useAuth()
  const { clients, collaborators, notifications, toast, dispatch, showToast } = useApp()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sb_col') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [sysLogo, setSysLogo] = useState(() => localStorage.getItem('sys_logo') || '')
  const location = useLocation()
  const navigate = useNavigate()

  const unread = notifications.filter(n => !n.read).length
  useEffect(() => { localStorage.setItem('sb_col', collapsed ? '1' : '0') }, [collapsed])
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Load system logo
  useEffect(() => {
    supabase.from('settings').select('logo_url').eq('key', 'system_logo').single().then(({ data }) => {
      if (data?.logo_url) { setSysLogo(data.logo_url); localStorage.setItem('sys_logo', data.logo_url) }
    })
  }, [])

  const deleteCollab = async (id, name) => {
    if (!window.confirm(`Remover ${name}?`)) return
    await supabase.from('collaborators').delete().eq('id', id)
    dispatch({ type: 'DELETE_COLLABORATOR', payload: id })
    showToast('Colaborador removido')
  }

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', show: isAdmin || isMember },
    { to: '/kanban', icon: Columns, label: 'Fluxo', show: true },
    { to: '/todo', icon: CheckSquare, label: 'To-Do Semanal', show: isAdmin || isMember },
  ].filter(n => n.show)

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Logo / Brand */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: TOPBAR_H, borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, cursor: 'pointer' }}
        onClick={() => navigate('/')}
        title="Dashboard"
      >
        {sysLogo ? (
          <img src={sysLogo} alt="Logo" style={{ height: collapsed ? 28 : 36, maxWidth: collapsed ? 28 : 140, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }}/>
        ) : (
          <>
            <motion.div style={{ width: 28, height: 28, background: '#6BAF45', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, boxShadow: '0 0 12px rgba(107,175,69,0.3)' }}
              whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }}>🐼</motion.div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}
                  initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.2 }}>
                  Panda <em style={{ color: '#6BAF45', fontStyle: 'normal' }}>Reports</em>
                </motion.span>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px 8px 4px', flexShrink: 0 }}>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}>
            {({ isActive }) => (
              <motion.div
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9,
                  fontSize: 13, cursor: 'pointer', marginBottom: 2, transition: 'background .12s, color .12s',
                  background: isActive ? 'rgba(107,175,69,0.1)' : 'transparent',
                  color: isActive ? '#6BAF45' : '#888',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  fontWeight: isActive ? 600 : 400,
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#1A1A1A'; e.currentTarget.style.color = '#E8E8E8' } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' } }}
                whileTap={{ scale: 0.97 }} title={collapsed ? item.label : ''}>
                <item.icon size={16} style={{ flexShrink: 0 }}/>
                <AnimatePresence>
                  {!collapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>{item.label}</motion.span>}
                </AnimatePresence>
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Clients */}
      {isAdmin && <ClientList clients={clients} collapsed={collapsed}/>}

      {/* Collaborators */}
      {isAdmin && !collapsed && collaborators.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 8px 6px', flexShrink: 0 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#555', fontWeight: 700, padding: '0 6px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users size={9}/> Colaboradores
          </p>
          <div style={{ maxHeight: 120, overflowY: 'auto' }}>
            {collaborators.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 7, fontSize: 12, color: '#888' }}
                onMouseEnter={e => e.currentTarget.querySelector('.del-btn').style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.querySelector('.del-btn').style.opacity = '0'}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{c.name[0]}</div>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                {c.role && <span style={{ fontSize: 10, color: '#555', flexShrink: 0 }}>{c.role}</span>}
                <button className="del-btn" style={{ opacity: 0, transition: 'opacity .15s', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2, display: 'flex' }}
                  onClick={() => deleteCollab(c.id, c.name)}><Trash2 size={11}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        {isAdmin && (
          <NavLink to="/settings">
            {({ isActive }) => (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9,
                fontSize: 13, cursor: 'pointer', marginBottom: 6, transition: 'background .12s',
                background: isActive ? 'rgba(107,175,69,0.1)' : 'transparent',
                color: isActive ? '#6BAF45' : '#888',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#1A1A1A'; e.currentTarget.style.color = '#E8E8E8' } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' } }}
                title={collapsed ? 'Configurações' : ''}>
                <Settings size={16} style={{ flexShrink: 0 }}/>
                {!collapsed && <span>Configurações</span>}
              </div>
            )}
          </NavLink>
        )}
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: '#1A1A1A', marginTop: 4 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{user?.email?.charAt(0).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#E8E8E8' }}>{user?.email?.split('@')[0]}</div>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'capitalize' }}>{role}</div>
            </div>
            <button onClick={logout} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: 2 }} title="Sair">↩</button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Desktop sidebar */}
      <motion.aside style={{ background: '#0D0D0D', borderRight: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}
        animate={{ width: collapsed ? 54 : 248 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="hidden md:flex">
        <SidebarContent/>
        <motion.button style={{ position: 'absolute', right: -12, top: 68, width: 24, height: 24, background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
          onClick={() => setCollapsed(!collapsed)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          {collapsed ? <ChevronRight size={12}/> : <ChevronLeft size={12}/>}
        </motion.button>
      </motion.aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} className="md:hidden"/>
            <motion.aside style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: 248, background: '#0D0D0D', borderRight: '1px solid rgba(255,255,255,0.07)', zIndex: 50, display: 'flex', flexDirection: 'column' }}
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="md:hidden">
              <SidebarContent/>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{ height: TOPBAR_H, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0, background: '#0D0D0D', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <button className="md:hidden" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }} onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={18}/> : <Menu size={18}/>}
          </button>
          <div style={{ flex: 1 }}/>
          <motion.button style={{ position: 'relative', width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', cursor: 'pointer', transition: 'background .15s, color .15s' }}
            onClick={() => setNotifOpen(!notifOpen)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1A1A1A'; e.currentTarget.style.color = '#E8E8E8' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' }}>
            <Bell size={16}/>
            <AnimatePresence>
              {unread > 0 && (
                <motion.span style={{ position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500 }}>
                  {unread > 99 ? '99+' : unread}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} style={{ height: '100%', overflow: 'hidden' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <NotifPanel open={notifOpen} onClose={() => setNotifOpen(false)}/>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div style={{ position: 'fixed', bottom: 24, right: 24, background: '#141414', border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#6BAF45'}`, borderRadius: 12, padding: '12px 16px', zIndex: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', gap: 10, maxWidth: 320 }}
            initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: toast.type === 'error' ? '#ef4444' : '#6BAF45', flexShrink: 0 }}/>
            <span style={{ fontSize: 13, color: '#E8E8E8' }}>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
