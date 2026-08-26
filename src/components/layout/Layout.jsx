import { memo, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  KanbanSquare,
  ListChecks,
  Search,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  Menu
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useApp } from '../../contexts/AppContext'
import { useNotifications } from '../../hooks/useNotifications'
import { publicUrlFor } from '../../lib/supabase'
import { Avatar } from '../ui'
import { PageTransition } from '../ui/Animated'
import { NotifPanel } from '../notifications/NotifPanel'
import { debounce } from '../../utils'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/kanban', label: 'Fluxo', icon: KanbanSquare },
  { to: '/todo', label: 'To-Do Semanal', icon: ListChecks }
]

const BOTTOM_NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/kanban', label: 'Fluxo', icon: KanbanSquare },
  { to: '/todo', label: 'Todo', icon: ListChecks },
  { to: '/settings', label: 'Menu', icon: Menu }
]

/* ClientList isolado: estado de busca 100% local, nao sobe pro Layout pai */
const ClientList = memo(function ClientList({ clients, collapsed }) {
  const [query, setQuery] = useState('')
  const onSearchChange = useMemo(() => debounce((v) => setQuery(v), 300), [])

  const filtered = useMemo(() => {
    if (!query) return clients
    const q = query.toLowerCase()
    return clients.filter((c) => c.name?.toLowerCase().includes(q))
  }, [clients, query])

  if (collapsed) return null

  return (
    <div className="flex flex-col gap-1">
      <div className="relative px-1">
        <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text3" />
        <input
          type="text"
          placeholder="Buscar cliente..."
          defaultValue=""
          onChange={(e) => onSearchChange(e.target.value)}
          className="input-base w-full pl-8 pr-2 py-1.5 text-xs"
        />
      </div>
      <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto mt-1">
        {filtered.length === 0 && <span className="text-xs text-text3 px-3 py-2">Nenhum cliente encontrado</span>}
        {filtered.map((c) => (
          <NavLink
            key={c.id}
            to={`/clients/${c.id}`}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-input text-sm truncate transition-colors duration-150 ${
                isActive ? 'bg-green-dim text-green sidebar-item-active' : 'text-text2 hover:bg-bg4 hover:text-text'
              }`
            }
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: c.color || 'var(--green)' }}
            />
            <span className="truncate">{c.name}</span>
          </NavLink>
        ))}
      </div>
    </div>
  )
})

function Sidebar({ collapsed, setCollapsed }) {
  const { clients, collaborators, settings } = useApp()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const logoUrl = publicUrlFor(settings.system_logo?.logo_url)

  return (
    <motion.aside
      animate={{ width: collapsed ? 54 : 248 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="hidden md:flex flex-col h-screen sticky top-0 bg-bg2 border-r border-border overflow-hidden flex-shrink-0"
    >
      <div className={`relative flex items-center justify-center flex-shrink-0 ${collapsed ? 'px-2 py-3' : 'px-4 py-4'}`}>
        {!collapsed && (
          <Link to="/dashboard" className="flex items-center justify-center min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Panda Reports" className="rounded-lg object-contain flex-shrink-0 w-[128px] h-[128px]" />
            ) : (
              <span className="text-3xl flex-shrink-0">🐼</span>
            )}
          </Link>
        )}
        {collapsed && (
          <Link to="/dashboard" className="flex items-center justify-center min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Panda Reports" className="rounded-lg object-contain flex-shrink-0 w-8 h-8" />
            ) : (
              <span className="text-2xl flex-shrink-0">🐼</span>
            )}
          </Link>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text3 hover:text-text flex-shrink-0"
        >
          <ChevronLeft size={16} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-6 pb-4">
        <div className="flex flex-col gap-1">
          {!collapsed && <span className="text-[11px] uppercase tracking-wider text-text3 px-3 mb-1">Navegação</span>}
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-input text-sm font-medium transition-colors duration-150 ${
                  isActive ? 'bg-green-dim text-green sidebar-item-active' : 'text-text2 hover:bg-bg4 hover:text-text'
                }`
              }
            >
              <item.icon size={17} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {!collapsed && <span className="text-[11px] uppercase tracking-wider text-text3 px-3 mb-1">Clientes</span>}
          <ClientList clients={clients} collapsed={collapsed} />
        </div>

        {!collapsed && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-text3 px-3 mb-1">Colaboradores</span>
            <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
              {collaborators.map((c) => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-text2 truncate">
                  <Avatar name={c.name} size={20} />
                  <span className="truncate">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border px-3 py-3 flex flex-col gap-1 flex-shrink-0">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-input text-sm font-medium transition-colors duration-150 ${
              isActive ? 'bg-green-dim text-green' : 'text-text2 hover:bg-bg4 hover:text-text'
            }`
          }
        >
          <Settings size={17} />
          {!collapsed && <span>Configurações</span>}
        </NavLink>
        <div className="flex items-center gap-2 px-3 py-2">
          <Avatar name={user?.email} size={28} />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={async () => {
              await logout()
              navigate('/login')
            }}
            className="text-text3 hover:text-red flex-shrink-0"
            title="Sair"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </motion.aside>
  )
}

function Topbar({ onOpenNotif, unreadCount }) {
  const location = useLocation()
  const { clients } = useApp()
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const breadcrumb = useMemo(() => {
    const map = {
      '/dashboard': 'Dashboard',
      '/kanban': 'Fluxo',
      '/todo': 'To-Do Semanal',
      '/settings': 'Configurações'
    }
    if (map[location.pathname]) return map[location.pathname]
    if (location.pathname.startsWith('/clients/')) {
      const id = location.pathname.split('/')[2]
      return clients.find((c) => c.id === id)?.name || 'Cliente'
    }
    return 'Panda Reports'
  }, [location.pathname, clients])

  const results = useMemo(() => {
    if (!query) return []
    const q = query.toLowerCase()
    return clients.filter((c) => c.name?.toLowerCase().includes(q)).slice(0, 6)
  }, [query, clients])

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 px-4 md:px-6 py-3 border-b border-border bg-bg/80 backdrop-blur-md">
      <h2 className="text-sm font-medium text-text truncate hidden md:block">{breadcrumb}</h2>

      <div className="relative flex-1 max-w-sm ml-auto">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" />
        <input
          type="text"
          placeholder="Buscar..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input-base w-full pl-8 pr-3 py-2 text-sm"
        />
        <AnimatePresence>
          {query && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-full mt-1 left-0 right-0 glass rounded-card overflow-hidden shadow-xl"
            >
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    navigate(`/clients/${c.id}`)
                    setQuery('')
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg4 text-left"
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: c.color || 'var(--green)' }} />
                  {c.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button onClick={onOpenNotif} className="relative text-text2 hover:text-text flex-shrink-0">
        <Bell size={19} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500 }}
            className="absolute -top-1.5 -right-1.5 bg-red text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>
    </header>
  )
}

function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-bg2 border-t border-border flex items-stretch h-16">
      {BOTTOM_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 text-[11px] ${
              isActive ? 'text-green' : 'text-text3'
            }`
          }
        >
          <item.icon size={19} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function Layout() {
  const { sidebarCollapsed, setSidebarCollapsed } = useApp()
  const { unreadCount } = useNotifications()
  const [notifOpen, setNotifOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onOpenNotif={() => setNotifOpen(true)} unreadCount={unreadCount} />

        <main className="flex-1 pb-20 md:pb-0">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>

      <BottomNav />

      <NotifPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  )
}
