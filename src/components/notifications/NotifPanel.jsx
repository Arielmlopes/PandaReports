import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { SlidePanel } from '@/components/ui/Animated'
import { timeAgo } from '@/utils'

const ICONS = { card_moved: '🗂', mention: '@', comment: '💬', finalized: '✅', new_briefing: '📋' }
const COLORS = { card_moved: 'bg-blue-400/15', mention: 'bg-green/15', comment: 'bg-purple-400/15', finalized: 'bg-green/15', new_briefing: 'bg-yellow-400/15' }

export default function NotifPanel({ open, onClose }) {
  const { notifications, dispatch, showToast } = useApp()
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.email) return
    const load = async () => {
      const { data } = await supabase.from('notifications').select('*').eq('user_email', user.email).order('created_at', { ascending: false }).limit(50)
      if (data) dispatch({ type: 'SET_NOTIFICATIONS', payload: data })
    }
    load()
    // Real-time subscription
    const channel = supabase.channel('notifs').on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notifications',
      filter: `user_email=eq.${user.email}`
    }, (payload) => {
      dispatch({ type: 'ADD_NOTIFICATION', payload: payload.new })
    }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.email, dispatch])

  const markAllRead = async () => {
    dispatch({ type: 'MARK_ALL_READ' })
    await supabase.from('notifications').update({ read: true }).eq('user_email', user?.email)
    showToast('Todas marcadas como lidas')
  }

  const clickNotif = async (n) => {
    if (!n.read) {
      dispatch({ type: 'MARK_NOTIF_READ', payload: n.id })
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    }
    onClose()
  }

  const unread = notifications.filter(n => !n.read).length

  return (
    <SlidePanel open={open} onClose={onClose} title={`🔔 Notificações${unread > 0 ? ` (${unread})` : ''}`} width="w-80">
      {unread > 0 && (
        <div className="px-4 py-2 border-b border-border">
          <button onClick={markAllRead} className="text-xs text-green hover:text-green-2 transition-colors">
            Marcar todas como lidas
          </button>
        </div>
      )}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-3">
          <div className="text-4xl mb-3 opacity-30">🔔</div>
          <p className="text-sm">Nenhuma notificação</p>
        </div>
      ) : (
        <div>
          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              className={`flex gap-3 px-4 py-3 cursor-pointer border-b border-border transition-colors hover:bg-bg-3 relative ${!n.read ? 'bg-green/3' : ''}`}
              onClick={() => clickNotif(n)}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              {!n.read && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-green rounded-r" />}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${COLORS[n.type] || 'bg-bg-3'}`}>
                {ICONS[n.type] || '🔔'}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs leading-snug ${!n.read ? 'font-medium text-text' : 'text-text-2'}`}>{n.title}</p>
                {n.body && <p className="text-[11px] text-text-3 mt-0.5 line-clamp-2">{n.body}</p>}
                <p className="text-[10px] text-text-3 mt-1">{timeAgo(n.created_at)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </SlidePanel>
  )
}
