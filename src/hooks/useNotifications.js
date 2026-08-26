import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const POLL_MS = 30000

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const channelRef = useRef(null)

  const load = useCallback(async () => {
    if (!user?.email) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_email', user.email)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data || [])
  }, [user?.email])

  useEffect(() => {
    if (!user?.email) return
    load()

    const interval = setInterval(load, POLL_MS)

    // Nome de canal unico por montagem: evita colisao de topico quando o
    // React (StrictMode) monta/desmonta/remonta o efeito rapidamente.
    const channel = supabase.channel(`notifications-${user.email}-${Math.random().toString(36).slice(2)}`)
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_email=eq.${user.email}`
        },
        () => load()
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [user?.email, load])

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)))
  }

  async function markAllRead() {
    if (!user?.email) return
    await supabase.from('notifications').update({ read: true }).eq('user_email', user.email).eq('read', false)
    setNotifications((n) => n.map((x) => ({ ...x, read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return { notifications, unreadCount, markRead, markAllRead, reload: load }
}
