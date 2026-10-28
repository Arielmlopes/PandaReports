import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  X,
  Paperclip,
  Check,
  Send,
  AtSign,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Undo2,
  Upload,
  FileText,
  CheckCircle2,
  Pencil,
  Star,
  Play
} from 'lucide-react'
import { supabase, uploadFile, sanitizeFileName } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import { useAuth } from '../contexts/AuthContext'
import { Button, Modal, Field, Select, Avatar, Badge, Spinner, EmptyState } from '../components/ui'
import { TextWithPreviews } from '../components/ui/LinkPreview'
import { downloadBlob, formatDateLong, fileCategory } from '../utils'

const PAGE_SIZE = 20
let styleInjected = false

// Anexo que pode virar capa: imagem, ou video que tenha um frame (`poster`).
const canBeCover = (a) => a?.ft === 'image' || (a?.ft === 'video' && !!a.poster)
// URL da imagem a mostrar: o proprio arquivo (imagem) ou o frame do video.
const coverUrl = (a) => (a?.ft === 'video' ? a.poster : a?.url)

// Capa do card: o anexo marcado com `cover: true`; se nenhum foi marcado, a primeira
// imagem; se nao ha imagens, o frame do primeiro video.
function getCover(attachments) {
  const list = attachments || []
  return (
    list.find((a) => a.cover && canBeCover(a)) ||
    list.find((a) => a.ft === 'image') ||
    list.find((a) => a.ft === 'video' && a.poster) ||
    null
  )
}

// Tira um frame do video (no navegador, sem servidor) pra servir de capa.
// Tenta alguns instantes e escolhe o primeiro que nao seja praticamente preto.
// Devolve um Blob JPEG, ou null se o navegador nao conseguir ler o video.
function extractVideoFrame(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    let finished = false
    function finish(blob) {
      if (finished) return
      finished = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
      resolve(blob)
    }
    const timer = setTimeout(() => finish(null), 15000)
    video.onerror = () => finish(null)

    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
      const times = d ? [Math.min(1, d / 2), d * 0.25, d * 0.5] : [0.1]
      let attempt = 0
      let best = null

      const grab = () => {
        const w = video.videoWidth
        const h = video.videoHeight
        if (!w || !h) return finish(null)
        const scale = Math.min(1, 1280 / w)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(w * scale)
        canvas.height = Math.round(h * scale)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // brilho medio de uma amostra pequena, pra descartar frame preto
        const probe = ctx.getImageData(0, 0, canvas.width, canvas.height, { colorSpace: 'srgb' })
        let sum = 0
        let n = 0
        for (let i = 0; i < probe.data.length; i += 4 * 97) {
          sum += (probe.data[i] + probe.data[i + 1] + probe.data[i + 2]) / 3
          n += 1
        }
        const bright = n ? sum / n : 0

        canvas.toBlob(
          (blob) => {
            if (!best || bright > best.bright) best = { blob, bright }
            attempt += 1
            if (bright > 22 || attempt >= times.length) finish(best.blob)
            else video.currentTime = times[attempt]
          },
          'image/jpeg',
          0.85
        )
      }

      video.onseeked = grab
      video.currentTime = times[0]
    }

    video.src = url
  })
}

function injectKanbanStyles() {
  if (styleInjected) return
  styleInjected = true
  const style = document.createElement('style')
  style.textContent = `
    .kb-board { overflow-x: auto; overflow-y: hidden; scrollbar-width: auto; }
    .kb-board::-webkit-scrollbar { height: 16px; }
    .kb-board::-webkit-scrollbar-track { background: var(--bg2); border-radius: 8px; }
    .kb-board::-webkit-scrollbar-thumb { background: var(--bg5); border-radius: 8px; border: 3px solid var(--bg2); }
    .kb-board::-webkit-scrollbar-thumb:hover { background: var(--text3); }
    .kb-column { min-height: 0; display: flex; flex-direction: column; }
    .kb-column-body { min-height: 0; overflow-y: auto; }
    .kb-card { content-visibility: auto; contain-intrinsic-size: 220px; }
    .kb-drop-line { height: 2px; background: var(--green); border-radius: 2px; margin: 2px 0; box-shadow: 0 0 6px var(--green-glow); }
  `
  document.head.appendChild(style)
}

export default function KanbanPage() {
  const { clients, collaborators, pushToast } = useApp()
  const { user, isFreelancer } = useAuth()
  const [columns, setColumns] = useState([])
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [visibleCounts, setVisibleCounts] = useState({})
  const [activeCard, setActiveCard] = useState(null)
  const [newCardColumn, setNewCardColumn] = useState(null)
  const [dragCardId, setDragCardId] = useState(null)
  const [dragOver, setDragOver] = useState(null) // { columnId, cardId, side }
  const [newColumnOpen, setNewColumnOpen] = useState(false)
  const boardRef = useRef(null)
  const panState = useRef({ active: false, startX: 0, startScroll: 0 })

  useEffect(() => {
    injectKanbanStyles()
  }, [])

  const loadBoard = useCallback(async () => {
    setLoading(true)
    const [{ data: cols }, { data: crds }] = await Promise.all([
      supabase.from('kanban_columns').select('*').order('position'),
      supabase.from('kanban_cards').select('*').order('position')
    ])
    setColumns(cols || [])
    let visibleCards = crds || []
    if (isFreelancer && user?.email) {
      const { data: mine } = await supabase.from('collaborators').select('id').or(`email.ilike.${user.email},name.ilike.${user.email}`)
      const myIds = new Set((mine || []).map((m) => m.id))
      visibleCards = visibleCards.filter((c) => myIds.has(c.collaborator_id))
    }
    setCards(visibleCards)
    setLoading(false)
  }, [isFreelancer, user?.email])

  useEffect(() => {
    loadBoard()
  }, [loadBoard])

  const cardsByColumn = useMemo(() => {
    const map = {}
    columns.forEach((col) => {
      map[col.id] = cards.filter((c) => c.column_id === col.id).sort((a, b) => a.position - b.position)
    })
    return map
  }, [columns, cards])

  function getVisibleCount(colId) {
    return visibleCounts[colId] || PAGE_SIZE
  }

  // Calcula quais cards precisam ser gravados no banco, comparando SEMPRE com o
  // estado "de antes do drop" (snapshot em `cards`), e nao com a copia ja alterada.
  // (Comparar com a copia alterada fazia o card arrastado parecer "inalterado"
  // quando a posicao antiga coincidia com a nova, e ele nao era salvo — voltava
  // pro lugar ao recarregar.)
  function diffUpdates(columnId, orderedCards) {
    const before = new Map(cards.map((c) => [c.id, c]))
    return orderedCards
      .map((c, i) => ({ id: c.id, position: i, column_id: columnId }))
      .filter((u) => {
        const old = before.get(u.id)
        return !old || old.position !== u.position || old.column_id !== u.column_id
      })
  }

  function applyOrderLocally(columnId, orderedCards) {
    setCards((prev) => {
      const ids = new Set(orderedCards.map((c) => c.id))
      const others = prev.filter((c) => !ids.has(c.id))
      const updated = orderedCards.map((c, i) => ({ ...c, position: i, column_id: columnId }))
      return [...others, ...updated]
    })
  }

  function resetDrag() {
    setDragCardId(null)
    setDragOver(null)
  }

  async function handleDrop(targetColumnId, targetCardId) {
    if (!dragCardId) return
    const dragged = cards.find((c) => c.id === dragCardId)
    // soltar o card em cima dele mesmo: nao faz nada
    if (!dragged || targetCardId === dragCardId) {
      resetDrag()
      return
    }

    const originColumnId = dragged.column_id
    const targetList = cardsByColumn[targetColumnId]?.filter((c) => c.id !== dragCardId) || []

    let insertIndex = targetList.length
    if (targetCardId) {
      const idx = targetList.findIndex((c) => c.id === targetCardId)
      if (idx >= 0) insertIndex = dragOver?.side === 'below' ? idx + 1 : idx
    }

    const newTargetList = [...targetList]
    newTargetList.splice(insertIndex, 0, { ...dragged, column_id: targetColumnId })

    const updates = diffUpdates(targetColumnId, newTargetList)
    applyOrderLocally(targetColumnId, newTargetList)

    if (originColumnId !== targetColumnId) {
      const originList = cardsByColumn[originColumnId]?.filter((c) => c.id !== dragCardId) || []
      updates.push(...diffUpdates(originColumnId, originList))
      applyOrderLocally(originColumnId, originList)
    }

    // a tela ja reflete o movimento; so entao salva (em paralelo) no banco
    resetDrag()

    try {
      const results = await Promise.all(
        updates.map((u) =>
          supabase.from('kanban_cards').update({ position: u.position, column_id: u.column_id }).eq('id', u.id)
        )
      )
      if (results.some((r) => r.error)) throw new Error('save failed')
    } catch {
      pushToast({ message: 'Não foi possível salvar a movimentação. Recarregando o quadro…', type: 'error' })
      loadBoard()
      return
    }

    if (originColumnId !== targetColumnId && dragged.collaborator_id) {
      const collab = collaborators.find((c) => c.id === dragged.collaborator_id)
      const targetCol = columns.find((c) => c.id === targetColumnId)
      if (collab?.email && collab.email !== user?.email) {
        notify(collab.email, {
          type: 'card_moved',
          title: `Card movido: ${dragged.title}`,
          body: `Foi movido para "${targetCol?.label}"`,
          card_id: dragged.id
        }).catch(() => {})
      }
    }
  }

  async function notify(userEmail, payload) {
    await supabase.from('notifications').insert({ user_email: userEmail, read: false, ...payload })
  }

  async function createColumn(label, color) {
    try {
      const position = columns.length ? Math.max(...columns.map((c) => c.position ?? 0)) + 1 : 0
      const { data, error } = await supabase.from('kanban_columns').insert({ label, color, position }).select().single()
      if (error) throw error
      setColumns((cols) => [...cols, data])
      setNewColumnOpen(false)
    } catch {
      pushToast({ message: 'Não foi possível criar a coluna.', type: 'error' })
    }
  }

  // Rola o quadro (e a coluna) sozinho quando o card e arrastado perto da borda,
  // pra dar pra levar um card ate colunas/posicoes fora da tela.
  function autoScrollWhileDragging(e) {
    const board = boardRef.current
    if (board) {
      const r = board.getBoundingClientRect()
      const edge = 70
      if (e.clientX < r.left + edge) board.scrollLeft -= 16
      else if (e.clientX > r.right - edge) board.scrollLeft += 16
    }
    const body = e.target.closest?.('.kb-column-body') || e.currentTarget.querySelector?.('.kb-column-body')
    if (body) {
      const br = body.getBoundingClientRect()
      if (e.clientY < br.top + 50) body.scrollTop -= 14
      else if (e.clientY > br.bottom - 50) body.scrollTop += 14
    }
  }

  function startPan(e) {
    if (e.target.closest('.kb-card') || e.target.closest('button') || e.target.closest('input')) return
    panState.current = { active: true, startX: e.clientX, startScroll: boardRef.current.scrollLeft }
    boardRef.current.style.cursor = 'grabbing'
  }
  function movePan(e) {
    if (!panState.current.active) return
    const dx = e.clientX - panState.current.startX
    boardRef.current.scrollLeft = panState.current.startScroll - dx
  }
  function endPan() {
    panState.current.active = false
    if (boardRef.current) boardRef.current.style.cursor = 'grab'
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-xl font-semibold text-text">Fluxo</h1>
        <Button icon={Plus} onClick={() => setNewCardColumn(columns[0]?.id || null)} disabled={!columns.length}>
          Nova demanda
        </Button>
      </div>

      <div
        ref={boardRef}
        className="kb-board flex gap-6 flex-1 pb-4"
        style={{ cursor: 'grab' }}
        onMouseDown={startPan}
        onMouseMove={movePan}
        onMouseUp={endPan}
        onMouseLeave={endPan}
      >
        {columns.map((col) => {
          const allCards = cardsByColumn[col.id] || []
          const visibleCount = getVisibleCount(col.id)
          const visibleCards = allCards.slice(0, visibleCount)

          const isDropTarget = !!dragCardId && dragOver?.columnId === col.id
          const showEndLine = isDropTarget && dragOver?.cardId === null

          return (
            <div
              key={col.id}
              className={`kb-column flex-shrink-0 w-[220px] md:w-[260px] rounded-card border h-full transition-colors duration-100 ${
                isDropTarget ? 'bg-green-dim border-green' : 'bg-bg2 border-border'
              }`}
              onDragOver={(e) => {
                if (!dragCardId) return
                e.preventDefault()
                // chegou aqui = o cursor esta no espaco da coluna fora dos cards
                // (os cards param a propagacao): o destino e o fim da coluna
                setDragOver((prev) =>
                  prev?.columnId === col.id && prev?.cardId === null ? prev : { columnId: col.id, cardId: null, side: 'end' }
                )
                autoScrollWhileDragging(e)
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget)) return
                setDragOver((prev) => (prev?.columnId === col.id ? null : prev))
              }}
              onDrop={(e) => {
                e.preventDefault()
                handleDrop(col.id, null)
              }}
            >
              <div className="flex items-center justify-between px-3 py-3 flex-shrink-0 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color || 'var(--green)' }} />
                  <span className="text-sm font-medium text-text truncate">{col.label}</span>
                  <span className="text-xs text-text3">{allCards.length}</span>
                </div>
                <button onClick={() => setNewCardColumn(col.id)} className="text-text3 hover:text-green">
                  <Plus size={16} />
                </button>
              </div>

              <div className="kb-column-body flex-1 p-2 flex flex-col gap-2">
                {visibleCards.map((card) => (
                  <div key={card.id}>
                    {dragOver?.columnId === col.id && dragOver?.cardId === card.id && dragOver?.side === 'above' && (
                      <div className="kb-drop-line" />
                    )}
                    <CardItem
                      card={card}
                      client={clients.find((c) => c.id === card.client_id)}
                      collaborator={collaborators.find((c) => c.id === card.collaborator_id)}
                      draggable
                      isDragging={dragCardId === card.id}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        // Firefox so inicia o drag se houver algum dado no dataTransfer
                        e.dataTransfer.setData('text/plain', card.id)
                        setDragCardId(card.id)
                      }}
                      onDragEnd={resetDrag}
                      onDragOver={(e) => {
                        if (!dragCardId) return
                        e.preventDefault()
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        const side = e.clientY - rect.top < rect.height / 2 ? 'above' : 'below'
                        setDragOver((prev) =>
                          prev?.columnId === col.id && prev?.cardId === card.id && prev?.side === side
                            ? prev
                            : { columnId: col.id, cardId: card.id, side }
                        )
                        autoScrollWhileDragging(e)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDrop(col.id, card.id)
                      }}
                      onClick={() => setActiveCard(card)}
                    />
                    {dragOver?.columnId === col.id && dragOver?.cardId === card.id && dragOver?.side === 'below' && (
                      <div className="kb-drop-line" />
                    )}
                  </div>
                ))}

                {showEndLine && dragCardId && <div className="kb-drop-line" />}

                {allCards.length > visibleCount && (
                  <button
                    onClick={() => setVisibleCounts((v) => ({ ...v, [col.id]: visibleCount + PAGE_SIZE }))}
                    className="text-xs text-text3 hover:text-green py-2 text-center"
                  >
                    Ver mais {Math.min(PAGE_SIZE, allCards.length - visibleCount)} ↓
                  </button>
                )}

                {allCards.length === 0 && (
                  <p className="text-xs text-text3 text-center py-6">Nenhum card</p>
                )}
              </div>
            </div>
          )
        })}

        <button
          onClick={() => setNewColumnOpen(true)}
          className="flex-shrink-0 w-[160px] h-full rounded-card border border-dashed border-border2 text-text3 hover:text-green hover:border-green/40 flex flex-col items-center justify-center gap-2 transition-colors"
        >
          <Plus size={20} />
          <span className="text-sm">Nova coluna</span>
        </button>
      </div>

      {newColumnOpen && <NewColumnModal onClose={() => setNewColumnOpen(false)} onCreate={createColumn} />}

      {newCardColumn && (
        <NewCardModal
          defaultColumnId={newCardColumn}
          columns={columns}
          clients={clients}
          collaborators={collaborators}
          countInColumn={(colId) => (cardsByColumn[colId] || []).length}
          onClose={() => setNewCardColumn(null)}
          onCreated={(card) => {
            setCards((c) => [...c, card])
            setNewCardColumn(null)
          }}
        />
      )}

      {activeCard && (
        <CardDetailModal
          key={activeCard.id}
          card={cards.find((c) => c.id === activeCard.id) || activeCard}
          columns={columns}
          clients={clients}
          collaborators={collaborators}
          onClose={() => setActiveCard(null)}
          onUpdate={(patch) => setCards((prev) => prev.map((c) => (c.id === activeCard.id ? { ...c, ...patch } : c)))}
          onDelete={() => {
            setCards((prev) => prev.filter((c) => c.id !== activeCard.id))
            setActiveCard(null)
          }}
          notify={notify}
        />
      )}
    </div>
  )
}

function CardItem({ card, client, collaborator, onClick, isDragging, ...dragProps }) {
  const cover = getCover(card.attachments)
  // IMPORTANTE: tem que ser um <div> comum, nao um motion.div. O Framer Motion
  // reserva onDragStart/onDrag/onDragEnd pro drag proprio dele e NAO repassa esses
  // handlers pro DOM — o dragstart nativo nunca chegava no React, o app nao sabia
  // qual card estava sendo arrastado e o drop era ignorado (o card "voltava").
  return (
    <div
      className={`kb-card card p-2.5 cursor-pointer flex flex-col gap-2 bg-bg3 transition-opacity ${
        isDragging ? 'opacity-40 border-green' : ''
      }`}
      onClick={onClick}
      {...dragProps}
    >
      {coverUrl(cover) && (
        <img src={coverUrl(cover)} alt="" loading="lazy" className="w-full h-[120px] object-cover rounded-input" />
      )}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: client?.color || 'var(--green)' }} />
        <span className="text-[11px] text-text3 truncate">{client?.name || 'Sem cliente'}</span>
        {card.finalized_material_id && (
          <Badge color="green" className="ml-auto flex-shrink-0">
            <Check size={10} /> Enviado
          </Badge>
        )}
      </div>
      <p className="text-sm text-text font-medium line-clamp-2">{card.title}</p>
      {card.description && <p className="text-xs text-text2 line-clamp-2">{card.description}</p>}
      <div className="flex items-center justify-between mt-1">
        {collaborator ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar name={collaborator.name} size={18} />
            <span className="text-[11px] text-text3 truncate">{collaborator.name}</span>
          </div>
        ) : (
          <span />
        )}
        {card.attachments?.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-text3">
            <Paperclip size={11} /> {card.attachments.length}
          </span>
        )}
      </div>
    </div>
  )
}

function NewCardModal({ defaultColumnId, columns, clients, collaborators, countInColumn, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [columnId, setColumnId] = useState(defaultColumnId)
  const [clientId, setClientId] = useState('')
  const [collaboratorId, setCollaboratorId] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('kanban_cards')
        .insert({
          title,
          description,
          column_id: columnId,
          client_id: clientId || null,
          collaborator_id: collaboratorId || null,
          attachments: [],
          position: countInColumn(columnId)
        })
        .select()
        .single()
      if (error) throw error
      onCreated(data)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Nova demanda">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Título" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        <Select label="Coluna" value={columnId} onChange={(e) => setColumnId(e.target.value)}>
          {columns.map((col) => (
            <option key={col.id} value={col.id}>
              {col.label}
            </option>
          ))}
        </Select>
        <Select label="Cliente" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Sem cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Colaborador" value={collaboratorId} onChange={(e) => setCollaboratorId(e.target.value)}>
          <option value="">Sem colaborador</option>
          {collaborators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Criar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

const COLUMN_COLORS = ['#5DD62C', '#3B82F6', '#EAB308', '#6366F1', '#EF4444', '#EC4899', '#14B8A6', '#A1A1AA']

function NewColumnModal({ onClose, onCreate }) {
  const [label, setLabel] = useState('')
  const [color, setColor] = useState(COLUMN_COLORS[0])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onCreate(label, color)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Nova coluna">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Nome da coluna" value={label} onChange={(e) => setLabel(e.target.value)} required autoFocus />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-text2 font-medium">Cor</span>
          <div className="flex items-center gap-2 flex-wrap">
            {COLUMN_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full border-2"
                style={{ background: c, borderColor: color === c ? '#fff' : 'transparent' }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Criar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function CardDetailModal({ card, columns, clients, collaborators, onClose, onUpdate, onDelete, notify }) {
  const { user } = useAuth()
  const { pushToast } = useApp()
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description || '')
  const [editingDescription, setEditingDescription] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [mentionQuery, setMentionQuery] = useState(null)
  const [viewerIndex, setViewerIndex] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const textareaRef = useRef(null)
  const attachmentsRef = useRef(card.attachments || [])
  const latestRef = useRef({})

  useEffect(() => {
    attachmentsRef.current = card.attachments || []
  }, [card.attachments])

  const client = clients.find((c) => c.id === card.client_id)

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from('kanban_comments')
      .select('*')
      .eq('card_id', card.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }, [card.id])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  async function saveField(patch) {
    onUpdate(patch)
    await supabase.from('kanban_cards').update(patch).eq('id', card.id)
  }

  function handleDescriptionChange(e) {
    setDescription(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }

  function handleCommentChange(e) {
    const val = e.target.value
    setCommentText(val)
    const cursor = e.target.selectionStart
    const upToCursor = val.slice(0, cursor)
    const match = upToCursor.match(/@([a-zA-Z0-9_ ]*)$/)
    setMentionQuery(match ? match[1] : null)
  }

  function insertMention(name) {
    const cursor = textareaRef.current.selectionStart
    const before = commentText.slice(0, cursor).replace(/@([a-zA-Z0-9_ ]*)$/, `@${name} `)
    const after = commentText.slice(cursor)
    setCommentText(before + after)
    setMentionQuery(null)
    textareaRef.current.focus()
  }

  async function submitComment() {
    if (!commentText.trim()) return
    const { data, error } = await supabase
      .from('kanban_comments')
      .insert({ card_id: card.id, user_email: user.email, content: commentText })
      .select()
      .single()
    if (error) return
    setComments((c) => [...c, data])

    const mentioned = collaborators.filter((c) => commentText.includes(`@${c.name}`))
    for (const m of mentioned) {
      if (!m.email || m.email === user.email) continue
      await notify(m.email, {
        type: 'mention',
        title: `${user.email} mencionou você`,
        body: commentText,
        card_id: card.id
      })
    }
    if (card.collaborator_id) {
      const owner = collaborators.find((c) => c.id === card.collaborator_id)
      if (owner?.email && owner.email !== user.email) {
        await notify(owner.email, {
          type: 'comment',
          title: `Novo comentário em "${card.title}"`,
          body: commentText,
          card_id: card.id
        })
      }
    }

    setCommentText('')
  }

  async function editComment(id, content) {
    const { error } = await supabase.from('kanban_comments').update({ content }).eq('id', id)
    if (error) return
    setComments((c) => c.map((x) => (x.id === id ? { ...x, content } : x)))
  }

  async function deleteComment(id) {
    const { error } = await supabase.from('kanban_comments').delete().eq('id', id)
    if (error) return
    setComments((c) => c.filter((x) => x.id !== id))
  }

  // Sobe arquivos (botao, Ctrl+V ou arrastar) e anexa na demanda.
  // attachmentsRef evita perder anexos quando duas colagens/uploads acontecem seguidas.
  async function uploadFiles(files) {
    if (!files.length) return
    setUploading(true)
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const url = await uploadFile(file, `kanban/${card.id}`)
          const att = { url, name: sanitizeFileName(file.name), ft: fileCategory(file.type) }
          if (att.ft === 'video') {
            // frame do video vira a capa do card (se o navegador conseguir ler o video)
            try {
              const frame = await extractVideoFrame(file)
              if (frame) {
                att.poster = await uploadFile(
                  new File([frame], `capa-${Date.now()}.jpg`, { type: 'image/jpeg' }),
                  `kanban/${card.id}`
                )
              }
            } catch {
              /* sem frame: o video e anexado normalmente, so fica sem capa automatica */
            }
          }
          return att
        })
      )

      // se entrou video com frame, ele passa a ser a capa (e so uma capa por card)
      let next = [...attachmentsRef.current, ...uploaded]
      const newVideo = [...uploaded].reverse().find((a) => a.ft === 'video' && a.poster)
      if (newVideo) {
        next = next.map((a) => {
          const { cover, ...rest } = a
          return a === newVideo ? { ...rest, cover: true } : rest
        })
      }
      attachmentsRef.current = next
      await saveField({ attachments: next })
      pushToast({
        message: newVideo
          ? 'Vídeo anexado — a capa do card foi criada a partir de um frame.'
          : uploaded.length === 1
            ? 'Arquivo anexado à demanda.'
            : `${uploaded.length} arquivos anexados à demanda.`,
        type: 'success'
      })
    } catch {
      pushToast({ message: 'Não foi possível anexar o arquivo. Tente novamente.', type: 'error' })
    } finally {
      setUploading(false)
    }
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // permite escolher o mesmo arquivo de novo depois
    await uploadFiles(files)
  }

  async function handleDeleteAttachment(index) {
    const next = attachmentsRef.current.filter((_, i) => i !== index)
    attachmentsRef.current = next
    await saveField({ attachments: next })
  }

  // Marca a imagem como capa (so uma por card). Se ela ja e a capa escolhida,
  // remove a escolha e a capa volta a ser a primeira imagem.
  async function handleToggleCover(index) {
    const current = attachmentsRef.current
    if (!canBeCover(current[index])) return
    const wasCover = !!current[index].cover
    const next = current.map((a, i) => {
      const { cover, ...rest } = a
      return i === index && !wasCover ? { ...rest, cover: true } : rest
    })
    attachmentsRef.current = next
    await saveField({ attachments: next })
    pushToast({ message: wasCover ? 'Capa removida.' : 'Imagem definida como capa do card.', type: 'success' })
  }

  // Ctrl+V de imagem e arrastar-e-soltar arquivos em qualquer lugar da demanda aberta.
  latestRef.current = { uploadFiles, finalizeOpen }
  useEffect(() => {
    let depth = 0
    const types = (e) => Array.from(e.dataTransfer?.types || [])
    const hasFiles = (e) => types(e).includes('Files')
    // imagem arrastada de outra pagina (ex: resultado do Google): vem como URL/HTML
    const hasImageUrl = (e) => !types(e).includes('Files') && types(e).includes('text/html')

    function nameFor(file, i) {
      if (file.name && !/^image\.(png|jpe?g|gif|webp)$/i.test(file.name)) return file.name
      const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
      return `colado-${stamp}${i ? `-${i + 1}` : ''}.${ext}`
    }

    function onPaste(e) {
      if (latestRef.current.finalizeOpen) return
      const files = Array.from(e.clipboardData?.items || [])
        .filter((it) => it.kind === 'file')
        .map((it) => it.getAsFile())
        .filter(Boolean)
      if (!files.length) return // texto comum: cola normalmente
      e.preventDefault()
      latestRef.current.uploadFiles(files.map((f, i) => new File([f], nameFor(f, i), { type: f.type })))
    }

    function onDragEnter(e) {
      if (!hasFiles(e) && !hasImageUrl(e)) return
      depth += 1
      setDragActive(true)
    }
    function onDragOver(e) {
      if (!hasFiles(e) && !hasImageUrl(e)) return
      if (latestRef.current.finalizeOpen && e.target.closest?.('input[type="file"]')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
    function onDragLeave(e) {
      if (!hasFiles(e) && !hasImageUrl(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragActive(false)
    }
    // com o modal "Finalizar" aberto, deixa o proprio campo de arquivo receber o drop
    const overFileInput = (e) => latestRef.current.finalizeOpen && e.target.closest?.('input[type="file"]')

    async function onDrop(e) {
      if (!hasFiles(e) && !hasImageUrl(e)) return
      if (overFileInput(e)) return
      e.preventDefault()
      depth = 0
      setDragActive(false)
      if (latestRef.current.finalizeOpen) return

      const dropped = Array.from(e.dataTransfer.files || [])
      if (dropped.length) {
        latestRef.current.uploadFiles(dropped)
        return
      }
      // fallback: pega a URL da <img> do HTML arrastado e baixa a imagem
      const html = e.dataTransfer.getData('text/html')
      const src = html && new DOMParser().parseFromString(html, 'text/html').querySelector('img')?.src
      if (!src) return
      try {
        const blob = await (await fetch(src)).blob()
        if (!blob.type.startsWith('image/')) return
        const probe = new File([blob], '', { type: blob.type })
        latestRef.current.uploadFiles([new File([blob], nameFor(probe, 0), { type: blob.type })])
      } catch {
        pushToast({
          message: 'Esse site não permite copiar a imagem direto. Salve a imagem e arraste o arquivo, ou use Ctrl+V.',
          type: 'error'
        })
      }
    }

    window.addEventListener('paste', onPaste)
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleFinalize({ type, description: finalDesc, files, reuseAttachment }) {
    const { data: material, error } = await supabase
      .from('materials')
      .insert({
        client_id: card.client_id,
        description: finalDesc || card.title,
        type,
        date: new Date().toISOString().slice(0, 10),
        collaborator_id: card.collaborator_id
      })
      .select()
      .single()
    if (error) return

    if (files.length > 0) {
      for (const file of files) {
        const url = await uploadFile(file, `materials/${material.id}`)
        await supabase.from('files').insert({ material_id: material.id, url, name: file.name, file_type: fileCategory(file.type) })
      }
    } else if (reuseAttachment) {
      // sem upload novo: reaproveita o ultimo anexo ja presente no card (ja esta no storage)
      await supabase
        .from('files')
        .insert({ material_id: material.id, url: reuseAttachment.url, name: reuseAttachment.name, file_type: reuseAttachment.ft })
    }

    await saveField({ finalized_material_id: material.id })
    setFinalizeOpen(false)
    pushToast({ message: 'Card finalizado e enviado para Materiais.', type: 'success' })
  }

  async function handleUndoFinalize() {
    await saveField({ finalized_material_id: null })
  }

  const mentionCandidates = mentionQuery !== null
    ? collaborators.filter((c) => c.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
    : []

  return (
    <Modal open onClose={onClose} title="Detalhes do card" size="xl">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col gap-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== card.title && saveField({ title })}
            className="text-lg font-semibold text-text bg-transparent border-none outline-none focus:bg-bg4 rounded-input px-1 -mx-1"
          />

          {editingDescription ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={description}
                onChange={handleDescriptionChange}
                placeholder="Descrição..."
                rows={14}
                autoFocus
                className="input-base px-3 py-2 text-sm resize-y min-h-[280px]"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    saveField({ description })
                    setEditingDescription(false)
                  }}
                >
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDescription(card.description || '')
                    setEditingDescription(false)
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingDescription(true)}
              className="cursor-text rounded-input hover:bg-bg4 px-3 py-2 -mx-3 transition-colors"
            >
              {description ? (
                <TextWithPreviews text={description} collapsible />
              ) : (
                <span className="text-sm text-text3">Adicionar descrição...</span>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2 gap-3">
              <span className="text-sm font-medium text-text2">Anexos</span>
              <span className="text-[11px] text-text3 hidden sm:inline">
                Cole (Ctrl+V) ou arraste imagens para anexar
              </span>
              <label className="text-xs text-green cursor-pointer flex items-center gap-1 flex-shrink-0">
                <Upload size={12} /> {uploading ? 'Enviando...' : 'Adicionar'}
                <input type="file" multiple hidden onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(card.attachments || []).map((a, i) => (
                <div key={i} className="group relative aspect-square rounded-input overflow-hidden bg-bg4">
                  <button
                    onClick={() => setViewerIndex(i)}
                    className="w-full h-full flex items-center justify-center"
                  >
                    {canBeCover(a) ? (
                      <img src={coverUrl(a)} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <FileText size={20} className="text-text3" />
                    )}
                    {a.ft === 'video' && (
                      <span className="absolute inset-0 m-auto w-7 h-7 rounded-full bg-black/60 flex items-center justify-center pointer-events-none">
                        <Play size={13} className="text-white ml-0.5" fill="currentColor" />
                      </span>
                    )}
                  </button>
                  {a === getCover(card.attachments) && (
                    <span className="absolute bottom-1 left-1 flex items-center gap-1 bg-green text-[#0a1206] text-[10px] font-bold rounded-full px-1.5 py-0.5 pointer-events-none">
                      <Star size={9} fill="currentColor" /> Capa
                    </span>
                  )}
                  {canBeCover(a) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleCover(i)
                      }}
                      className="absolute top-1 left-1 bg-black/70 rounded-full p-1 text-white/80 opacity-0 group-hover:opacity-100 hover:text-green transition-opacity"
                      title={a.cover ? 'Remover como capa' : 'Definir como capa'}
                    >
                      <Star size={12} fill={a.cover ? 'currentColor' : 'none'} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteAttachment(i)
                    }}
                    className="absolute top-1 right-1 bg-black/70 rounded-full p-1 text-white/80 opacity-0 group-hover:opacity-100 hover:text-red transition-opacity"
                    title="Remover anexo"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {uploading && (
                <div className="aspect-square rounded-input bg-bg4 flex items-center justify-center text-green">
                  <Spinner size={18} />
                </div>
              )}
              {(!card.attachments || card.attachments.length === 0) && !uploading && (
                <div className="col-span-4 rounded-input border border-dashed border-border2 text-center text-xs text-text3 py-5">
                  Nenhum anexo — cole uma imagem (Ctrl+V) ou arraste um arquivo aqui
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <span className="text-sm font-medium text-text2 mb-3 block">Comentários</span>
            <div className="flex flex-col gap-3 max-h-56 overflow-y-auto mb-3">
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  canManage={c.user_email === user.email}
                  onSave={(content) => editComment(c.id, content)}
                  onDelete={() => deleteComment(c.id)}
                />
              ))}
              {comments.length === 0 && <p className="text-xs text-text3">Nenhum comentário ainda.</p>}
            </div>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={commentText}
                onChange={handleCommentChange}
                placeholder="Escreva um comentário... use @ para mencionar"
                rows={2}
                className="input-base w-full px-3 py-2 text-sm resize-none pr-10"
              />
              <button
                onClick={submitComment}
                className="absolute right-2 bottom-2 text-green hover:text-green2"
              >
                <Send size={16} />
              </button>
              {mentionCandidates.length > 0 && (
                <div className="absolute bottom-full mb-1 left-0 glass rounded-card overflow-hidden w-48 z-10">
                  {mentionCandidates.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => insertMention(c.name)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg4 text-left"
                    >
                      <AtSign size={12} className="text-text3" />
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Select
            label="Coluna"
            value={card.column_id}
            onChange={(e) => saveField({ column_id: e.target.value })}
          >
            {columns.map((col) => (
              <option key={col.id} value={col.id}>
                {col.label}
              </option>
            ))}
          </Select>
          <Select
            label="Colaborador"
            value={card.collaborator_id || ''}
            onChange={(e) => saveField({ collaborator_id: e.target.value || null })}
          >
            <option value="">Sem colaborador</option>
            {collaborators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          {client && (
            <div className="text-sm text-text2">
              Cliente: <span className="text-text">{client.name}</span>
            </div>
          )}

          <div className="border-t border-border pt-4 flex flex-col gap-2">
            {card.finalized_material_id ? (
              <>
                <Badge color="green" className="justify-center py-1.5">
                  <CheckCircle2 size={12} /> Enviado
                </Badge>
                <Button variant="outline" icon={Undo2} onClick={handleUndoFinalize}>
                  Desfazer
                </Button>
              </>
            ) : (
              <Button icon={Send} onClick={() => setFinalizeOpen(true)}>
                Finalizar
              </Button>
            )}
            <Button
              variant="danger"
              icon={Trash2}
              onClick={async () => {
                await supabase.from('kanban_cards').delete().eq('id', card.id)
                onDelete()
              }}
            >
              Excluir card
            </Button>
          </div>
        </div>
      </div>

      {dragActive &&
        createPortal(
          <div className="fixed inset-0 z-[70] pointer-events-none flex items-center justify-center bg-black/60 p-6">
            <div className="border-2 border-dashed border-green rounded-modal bg-bg3/90 px-10 py-12 text-center">
              <Upload size={34} className="text-green mx-auto mb-3" />
              <p className="text-text font-semibold">Solte para anexar à demanda</p>
              <p className="text-text3 text-sm mt-1">Imagens, vídeos, PDFs e documentos</p>
            </div>
          </div>,
          document.body
        )}

      {viewerIndex !== null && (
        <AttachmentViewer
          attachments={card.attachments || []}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={setViewerIndex}
          onToggleCover={handleToggleCover}
          onDelete={(i) => {
            const remaining = (card.attachments || []).length - 1
            handleDeleteAttachment(i)
            if (remaining <= 0) setViewerIndex(null)
            else setViewerIndex(Math.min(i, remaining - 1))
          }}
        />
      )}

      {finalizeOpen && (
        <FinalizeModal
          onClose={() => setFinalizeOpen(false)}
          onSubmit={handleFinalize}
          defaultDescription={card.title}
          existingAttachments={card.attachments || []}
        />
      )}
    </Modal>
  )
}

function CommentItem({ comment, canManage, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)

  function handleSave() {
    if (!draft.trim()) return
    onSave(draft)
    setEditing(false)
  }

  return (
    <div className="group flex gap-2">
      <Avatar name={comment.user_email} size={26} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs text-text3">{comment.user_email}</p>
          {canManage && !editing && (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2">
              <button onClick={() => setEditing(true)} className="text-text3 hover:text-green">
                <Pencil size={11} />
              </button>
              <button onClick={onDelete} className="text-text3 hover:text-red">
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="flex flex-col gap-1.5 mt-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              autoFocus
              className="input-base w-full px-2.5 py-1.5 text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>
                Salvar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(comment.content)
                  setEditing(false)
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <TextWithPreviews text={comment.content} collapsible />
        )}
      </div>
    </div>
  )
}

function AttachmentViewer({ attachments, index, onClose, onNavigate, onDelete, onToggleCover }) {
  const file = attachments[index]

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        // so fecha o visualizador — sem isso o ESC tambem fechava o card por baixo
        e.stopPropagation()
        onClose()
      }
      if (e.key === 'ArrowRight' && index < attachments.length - 1) onNavigate(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [index, attachments.length, onClose, onNavigate])

  if (!file) return null

  // Renderiza direto no <body>: dentro do modal do card (que tem backdrop-filter)
  // o "position: fixed" ficava preso na caixa do modal em vez de ocupar a tela toda,
  // e a imagem vazava pra fora e era cortada.
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
        <span className="text-white/80 text-sm truncate">{file.name}</span>
        <div className="flex items-center gap-3">
          {onToggleCover && (file.ft === 'image' || (file.ft === 'video' && file.poster)) && (
            <button
              onClick={() => onToggleCover(index)}
              className={`flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                file.cover
                  ? 'bg-green text-[#0a1206] border-green'
                  : 'text-white/80 border-white/30 hover:text-white hover:border-white/60'
              }`}
              title={file.cover ? 'Remover como capa' : 'Usar esta imagem como capa do card'}
            >
              <Star size={14} fill={file.cover ? 'currentColor' : 'none'} />
              {file.cover ? 'É a capa' : 'Definir como capa'}
            </button>
          )}
          <button onClick={() => downloadBlob(file.url, file.name)} className="text-white/70 hover:text-white">
            <Download size={20} />
          </button>
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm('Remover este anexo?')) onDelete(index)
              }}
              className="text-white/70 hover:text-red"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={22} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center relative px-12">
        {index > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onNavigate(index - 1)
            }}
            className="absolute left-2 text-white/60 hover:text-white"
          >
            <ChevronLeft size={32} />
          </button>
        )}
        {file.ft === 'image' && (
          <img src={file.url} alt="" onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full object-contain" />
        )}
        {file.ft === 'video' && (
          <video
            src={file.url}
            poster={file.poster || undefined}
            controls
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full"
          />
        )}
        {file.ft === 'pdf' && (
          <iframe src={file.url} title={file.name} onClick={(e) => e.stopPropagation()} className="w-full h-full bg-white" />
        )}
        {file.ft !== 'image' && file.ft !== 'video' && file.ft !== 'pdf' && (
          <div className="flex flex-col items-center gap-3 text-white" onClick={(e) => e.stopPropagation()}>
            <FileText size={48} />
            <Button onClick={() => downloadBlob(file.url, file.name)}>Baixar arquivo</Button>
          </div>
        )}
        {index < attachments.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onNavigate(index + 1)
            }}
            className="absolute right-2 text-white/60 hover:text-white"
          >
            <ChevronRight size={32} />
          </button>
        )}
      </div>
      {attachments.length > 1 && (
        <div className="flex gap-2 justify-center p-4 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
          {attachments.map((a, i) => (
            <button
              key={i}
              onClick={() => onNavigate(i)}
              className={`w-14 h-14 rounded-input overflow-hidden border-2 flex-shrink-0 ${
                i === index ? 'border-green' : 'border-transparent opacity-60'
              }`}
            >
              {a.ft === 'image' || (a.ft === 'video' && a.poster) ? (
                <img src={a.ft === 'video' ? a.poster : a.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-bg4 flex items-center justify-center">
                  <FileText size={16} className="text-text3" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}

function FinalizeModal({ onClose, onSubmit, defaultDescription, existingAttachments }) {
  const [type, setType] = useState('Post')
  const [description, setDescription] = useState(defaultDescription || '')
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const lastAttachment = existingAttachments?.[existingAttachments.length - 1] || null

  async function handleSubmit(e) {
    e.preventDefault()
    if (files.length === 0 && !lastAttachment) {
      setError('Anexe uma arte final ou adicione um anexo ao card antes de finalizar.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await onSubmit({ type, description, files, reuseAttachment: files.length === 0 ? lastAttachment : null })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Finalizar card">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
          <option>Post</option>
          <option>Carrossel</option>
          <option>Vídeo</option>
          <option>Reels</option>
          <option>Stories</option>
        </Select>
        <Field label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-text2 font-medium">Artes finais</span>
          {lastAttachment && files.length === 0 && (
            <div className="flex items-center gap-2 p-2 bg-bg4 rounded-input border border-border2">
              {lastAttachment.ft === 'image' ? (
                <img src={lastAttachment.url} alt="" className="w-10 h-10 object-cover rounded-input flex-shrink-0" />
              ) : (
                <FileText size={18} className="text-text3 flex-shrink-0" />
              )}
              <span className="text-xs text-text2 truncate">Vai usar o último anexo do card: {lastAttachment.name}</span>
            </div>
          )}
          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files))} className="text-sm text-text2" />
          <span className="text-xs text-text3">
            {lastAttachment
              ? 'Deixe em branco para usar o anexo acima, ou selecione arquivos novos para substituir.'
              : 'Selecione ao menos um arquivo (o card ainda não tem anexos).'}
          </span>
        </label>
        {error && <p className="text-xs text-red">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Enviar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
