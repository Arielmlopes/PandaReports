import { useNavigate } from 'react-router-dom'
import { X, GitBranch, AtSign, MessageCircle, CheckCircle2, FileText, Check } from 'lucide-react'
import { SlidePanel } from '../ui/Animated'
import { EmptyState } from '../ui'
import { useNotifications } from '../../hooks/useNotifications'

const TYPE_ICON = {
  card_moved: GitBranch,
  mention: AtSign,
  comment: MessageCircle,
  finalized: CheckCircle2,
  new_briefing: FileText
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export function NotifPanel({ open, onClose }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()

  function handleClick(n) {
    markRead(n.id)
    if (n.card_id) navigate('/kanban')
    onClose()
  }

  return (
    <SlidePanel open={open} onClose={onClose} width={340}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <h3 className="font-semibold text-text">Notificações</h3>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-green hover:underline flex items-center gap-1">
                <Check size={12} /> Marcar todas
              </button>
            )}
            <button onClick={onClose} className="text-text3 hover:text-text">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 && (
            <EmptyState title="Sem notificações" description="Você está em dia." />
          )}
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.type] || FileText
            const isMention = n.type === 'mention'
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full flex items-start gap-3 px-4 py-3 border-b border-border text-left hover:bg-bg4 transition-colors ${
                  !n.read ? 'bg-green-dim/30' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-bg4 flex items-center justify-center text-green flex-shrink-0 mt-0.5">
                  <Icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text truncate">{n.title}</p>
                  {n.body && <p className="text-xs text-text2 line-clamp-2 mt-0.5">{n.body}</p>}
                  <span className="text-[11px] text-text3 mt-1 block">{timeAgo(n.created_at)}</span>
                </div>
                {!n.read && (
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${isMention ? 'bg-yellow' : 'bg-green'}`}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </SlidePanel>
  )
}
