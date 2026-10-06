import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Pencil
} from 'lucide-react'
import { supabase, uploadFile, sanitizeFileName } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import { useAuth } from '../contexts/AuthContext'
import { Button, Modal, Field, Select, Avatar, Badge, Spinner, EmptyState } from '../components/ui'
import { TextWithPreviews } from '../components/ui/LinkPreview'
import { downloadBlob, formatDateLong, fileCategory } from '../utils'

const PAGE_SIZE = 20
let styleInjected = false

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
      const { data: me } = await supabase.from('collaborators').select('id').eq('name', user.email).maybeSingle()
      visibleCards = visibleCards.filter((c) => c.collaborator_id === me?.id)
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

  async function persistPositions(columnId, orderedCards) {
    // So manda pro banco os cards cuja posicao/coluna realmente mudou. Sem isso,
    // soltar um card numa coluna com centenas de cards (ex: "Finalizado") disparava
    // uma atualizacao sequencial pra TODOS eles — lento o bastante pra parecer
    // travado/com erro, mesmo quando so 1 card de fato mudou de lugar.
    const updates = orderedCards
      .map((c, i) => ({ id: c.id, position: i, column_id: columnId, changed: c.position !== i || c.column_id !== columnId }))
      .filter((u) => u.changed)

    setCards((prev) => {
      const others = prev.filter((c) => !orderedCards.find((o) => o.id === c.id))
      const updated = orderedCards.map((c, i) => ({ ...c, position: i, column_id: columnId }))
      return [...others, ...updated]
    })

    try {
      const results = await Promise.all(
        updates.map((u) => supabase.from('kanban_cards').update({ position: u.position, column_id: u.column_id }).eq('id', u.id))
      )
      if (results.some((r) => r.error)) {
        pushToast({ message: 'Não foi possível salvar a posição do card. Tente novamente.', type: 'error' })
      }
    } catch {
      pushToast({ message: 'Não foi possível salvar a posição do card. Tente novamente.', type: 'error' })
    }
  }

  async function handleDrop(targetColumnId, targetCardId) {
    if (!dragCardId) return
    const dragged = cards.find((c) => c.id === dragCardId)
    if (!dragged) return

    const originColumnId = dragged.column_id
    const targetList = cardsByColumn[targetColumnId]?.filter((c) => c.id !== dragCardId) || []

    let insertIndex = targetList.length
    if (targetCardId) {
      const idx = targetList.findIndex((c) => c.id === targetCardId)
      insertIndex = dragOver?.side === 'below' ? idx + 1 : idx
    }

    const newTargetList = [...targetList]
    newTargetList.splice(insertIndex, 0, { ...dragged, column_id: targetColumnId })

    await persistPositions(targetColumnId, newTargetList)

    if (originColumnId !== targetColumnId) {
      const originList = cardsByColumn[originColumnId]?.filter((c) => c.id !== dragCardId) || []
      await persistPositions(originColumnId, originList)

      if (dragged.collaborator_id) {
        const collab = collaborators.find((c) => c.id === dragged.collaborator_id)
        const targetCol = columns.find((c) => c.id === targetColumnId)
        if (collab?.email && collab.email !== user?.email) {
          await notify(collab.email, {
            type: 'card_moved',
            title: `Card movido: ${dragged.title}`,
            body: `Foi movido para "${targetCol?.label}"`,
            card_id: dragged.id
          })
        }
      }
    }

    setDragCardId(null)
    setDragOver(null)
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

          return (
            <div
              key={col.id}
              className="kb-column flex-shrink-0 w-[220px] md:w-[260px] bg-bg2 rounded-card border border-border h-full"
              onDragOver={(e) => e.preventDefault()}
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
                      onDragStart={() => setDragCardId(card.id)}
                      onDragOver={(e) => {
                        e.preventDefault()
                        const rect = e.currentTarget.getBoundingClientRect()
                        const side = e.clientY - rect.top < rect.height / 2 ? 'above' : 'below'
                        setDragOver({ columnId: col.id, cardId: card.id, side })
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

function CardItem({ card, client, collaborator, onClick, ...dragProps }) {
  const cover = card.attachments?.[0]
  return (
    <motion.div
      whileHover={{ y: -1 }}
      className="kb-card card p-2.5 cursor-pointer flex flex-col gap-2 bg-bg3"
      onClick={onClick}
      {...dragProps}
    >
      {cover?.url && cover.ft === 'image' && (
        <img src={cover.url} alt="" loading="lazy" className="w-full h-[120px] object-cover rounded-input" />
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
    </motion.div>
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
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const textareaRef = useRef(null)

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

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    try {
      const uploaded = []
      for (const file of files) {
        const url = await uploadFile(file, `kanban/${card.id}`)
        uploaded.push({ url, name: sanitizeFileName(file.name), ft: fileCategory(file.type) })
      }
      const attachments = [...(card.attachments || []), ...uploaded]
      await saveField({ attachments })
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteAttachment(index) {
    const attachments = (card.attachments || []).filter((_, i) => i !== index)
    await saveField({ attachments })
  }

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
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text2">Anexos</span>
              <label className="text-xs text-green cursor-pointer flex items-center gap-1">
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
                    {a.ft === 'image' ? (
                      <img src={a.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <FileText size={20} className="text-text3" />
                    )}
                  </button>
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
              {(!card.attachments || card.attachments.length === 0) && (
                <span className="text-xs text-text3 col-span-4">Nenhum anexo</span>
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

      {viewerIndex !== null && (
        <AttachmentViewer
          attachments={card.attachments || []}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={setViewerIndex}
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

function AttachmentViewer({ attachments, index, onClose, onNavigate, onDelete }) {
  const file = attachments[index]

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && index < attachments.length - 1) onNavigate(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, attachments.length, onClose, onNavigate])

  if (!file) return null

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
        <span className="text-white/80 text-sm truncate">{file.name}</span>
        <div className="flex items-center gap-3">
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
      <div className="flex-1 flex items-center justify-center relative px-12">
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
          <img src={file.url} alt="" onClick={(e) => e.stopPropagation()} className="max-h-[75vh] max-w-full object-contain" />
        )}
        {file.ft === 'video' && (
          <video src={file.url} controls onClick={(e) => e.stopPropagation()} className="max-h-[75vh] max-w-full" />
        )}
        {file.ft === 'pdf' && (
          <iframe src={file.url} title={file.name} onClick={(e) => e.stopPropagation()} className="w-full h-[75vh] bg-white" />
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
              {a.ft === 'image' ? (
                <img src={a.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-bg4 flex items-center justify-center">
                  <FileText size={16} className="text-text3" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
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
