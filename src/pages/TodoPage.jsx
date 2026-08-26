import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Lock, Repeat, Check, Undo2, Trash2, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import { useAuth } from '../contexts/AuthContext'
import { Button, Modal, Field, Select, Toggle, Badge, Spinner, EmptyState } from '../components/ui'
import { formatTime } from '../utils'

const DAY_LABELS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

function mondayOf(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toISODate(d) {
  return d.toISOString().slice(0, 10)
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export default function TodoPage() {
  const { clients, pushToast } = useApp()
  const { user, isAdmin } = useAuth()
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalDay, setModalDay] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const [tab, setTab] = useState('board') // board | done
  const [boards, setBoards] = useState([])
  const [activeBoardId, setActiveBoardId] = useState(null) // null = quadro padrao "Equipe"
  const [newBoardOpen, setNewBoardOpen] = useState(false)
  // Detecta se a coluna todo_items.board_id (e a tabela todo_boards) ja existem no banco.
  // Enquanto a migracao (supabase/migrations.sql) nao rodar, o app tem que continuar
  // funcionando exatamente como antes, sem filtrar/gravar board_id em nada.
  const [boardsSupported, setBoardsSupported] = useState(false)
  const [boardsChecked, setBoardsChecked] = useState(false)

  const weekDateStr = toISODate(weekStart)
  const today = toISODate(new Date())

  useEffect(() => {
    supabase
      .from('todo_items')
      .select('board_id')
      .limit(1)
      .then(({ error }) => {
        setBoardsSupported(!error)
        setBoardsChecked(true)
      })
  }, [])

  const loadBoards = useCallback(async () => {
    if (!isAdmin || !user?.email || !boardsSupported) return
    const { data, error } = await supabase.from('todo_boards').select('*').eq('owner_email', user.email).order('created_at')
    if (!error) setBoards(data || [])
  }, [isAdmin, user?.email, boardsSupported])

  useEffect(() => {
    loadBoards()
  }, [loadBoards])

  async function createBoard(name) {
    try {
      const { data, error } = await supabase.from('todo_boards').insert({ name, owner_email: user.email }).select().single()
      if (error) throw error
      setBoards((b) => [...b, data])
      setActiveBoardId(data.id)
      setNewBoardOpen(false)
    } catch {
      pushToast({ message: 'Não foi possível criar o quadro. Rode a migração do banco (supabase/migrations.sql).', type: 'error' })
    }
  }

  const loadWeek = useCallback(async () => {
    setLoading(true)
    let itemsQuery = supabase.from('todo_items').select('*').eq('week_date', weekDateStr).order('position')
    if (boardsSupported) {
      itemsQuery = activeBoardId ? itemsQuery.eq('board_id', activeBoardId) : itemsQuery.is('board_id', null)
    }
    const { data } = await itemsQuery

    const visible = (data || []).filter((t) => !t.is_private || t.owner_email === user?.email)
    setItems(visible)

    // propagar recorrentes da semana anterior (dentro do mesmo quadro)
    const prevWeekStr = toISODate(addDays(weekStart, -7))
    let prevQuery = supabase.from('todo_items').select('*').eq('week_date', prevWeekStr).eq('is_recurring', true)
    if (boardsSupported) {
      prevQuery = activeBoardId ? prevQuery.eq('board_id', activeBoardId) : prevQuery.is('board_id', null)
    }
    const { data: prevRecurring } = await prevQuery

    const toInsert = []
    for (const p of prevRecurring || []) {
      if (p.is_private && p.owner_email !== user?.email) continue
      const exists = visible.find(
        (v) =>
          v.title === p.title &&
          v.day_of_week === p.day_of_week &&
          v.owner_email === p.owner_email &&
          v.assigned_email === p.assigned_email
      )
      if (!exists) {
        toInsert.push({
          title: p.title,
          day_of_week: p.day_of_week,
          client_id: p.client_id,
          assigned_email: p.assigned_email,
          task_time: p.task_time,
          is_recurring: true,
          week_date: weekDateStr,
          completed: false,
          position: p.position,
          is_private: p.is_private,
          owner_email: p.owner_email,
          ...(boardsSupported ? { board_id: activeBoardId } : {})
        })
      }
    }
    if (toInsert.length > 0) {
      const { data: inserted } = await supabase.from('todo_items').insert(toInsert).select()
      setItems((prev) => [...prev, ...(inserted || [])])
    }

    setLoading(false)
  }, [weekDateStr, weekStart, user?.email, activeBoardId, boardsSupported])

  useEffect(() => {
    loadWeek()
  }, [loadWeek])

  function timeStatus(item) {
    if (!item.task_time) return null
    const dayDate = addDays(weekStart, item.day_of_week)
    const scheduled = new Date(`${toISODate(dayDate)}T${item.task_time}`)
    const diffMs = scheduled.getTime() - Date.now()
    if (item.completed) return 'done'
    if (diffMs < 0) return 'late'
    if (diffMs <= 2 * 3600 * 1000) return 'soon'
    return 'normal'
  }

  async function toggleComplete(item) {
    const completed = !item.completed
    const patch = { completed, completed_at: completed ? new Date().toISOString() : null }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))
    await supabase.from('todo_items').update(patch).eq('id', item.id)
  }

  async function deleteItem(item) {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    await supabase.from('todo_items').delete().eq('id', item.id)
  }

  const doneItems = items.filter((i) => i.completed)

  return (
    <div className="p-4 md:p-6 flex flex-col h-[calc(100vh-57px)]">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3 flex-shrink-0">
        <h1 className="text-xl font-semibold text-text">To-Do Semanal</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-bg4 rounded-input p-1">
            <button onClick={() => setTab('board')} className={`text-xs px-3 py-1.5 rounded-input ${tab === 'board' ? 'bg-bg text-text' : 'text-text3'}`}>
              Board
            </button>
            <button onClick={() => setTab('done')} className={`text-xs px-3 py-1.5 rounded-input ${tab === 'done' ? 'bg-bg text-text' : 'text-text3'}`}>
              Concluídos ({doneItems.length})
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekStart((w) => addDays(w, -7))} className="text-text3 hover:text-text p-1">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setWeekStart(mondayOf(new Date()))} className="text-xs text-text2 hover:text-text px-2">
              Hoje
            </button>
            <button onClick={() => setWeekStart((w) => addDays(w, 7))} className="text-text3 hover:text-text p-1">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {isAdmin && boardsChecked && !boardsSupported && (
        <div className="mb-4 flex-shrink-0 text-xs text-yellow bg-yellow/10 border border-yellow/30 rounded-input px-3 py-2">
          Quadros pessoais (separados do "Equipe") ainda não estão disponíveis — rode a migração do banco
          (supabase/migrations.sql) pra liberar.
        </div>
      )}

      {isAdmin && boardsSupported && (
        <div className="flex items-center gap-2 flex-wrap mb-4 flex-shrink-0">
          <button
            onClick={() => setActiveBoardId(null)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${
              activeBoardId === null
                ? 'bg-green-dim text-green border-green/30'
                : 'bg-bg4 text-text2 border-border2 hover:text-text'
            }`}
          >
            <Users size={12} /> Equipe
          </button>
          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveBoardId(b.id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${
                activeBoardId === b.id
                  ? 'bg-green-dim text-green border-green/30'
                  : 'bg-bg4 text-text2 border-border2 hover:text-text'
              }`}
            >
              {b.name}
            </button>
          ))}
          <button
            onClick={() => setNewBoardOpen(true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-dashed border-border2 text-text3 hover:text-green hover:border-green/40"
          >
            <Plus size={12} /> Novo quadro
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : tab === 'done' ? (
        <DoneList items={doneItems} clients={clients} onUndo={toggleComplete} />
      ) : (
        <div className="flex gap-3 flex-1 overflow-x-auto lg:overflow-x-visible lg:grid lg:grid-cols-7 snap-x snap-proximity lg:snap-none pb-3">
          {DAY_LABELS.map((label, dayIdx) => {
            const dayDate = addDays(weekStart, dayIdx)
            const isToday = toISODate(dayDate) === today
            const dayItems = items
              .filter((i) => i.day_of_week === dayIdx)
              .sort((a, b) => (a.position || 0) - (b.position || 0))
            const shared = dayItems.filter((i) => !i.is_private)
            const priv = dayItems.filter((i) => i.is_private)

            return (
              <div
                key={dayIdx}
                className={`flex-shrink-0 w-[78vw] sm:w-[260px] lg:w-auto snap-start flex flex-col rounded-card border ${
                  isToday ? 'border-green/40 bg-green-dim/20' : 'border-border bg-bg2'
                }`}
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
                  <div>
                    <p className={`text-sm font-medium ${isToday ? 'text-green' : 'text-text'}`}>{label}</p>
                    <p className="text-[11px] text-text3">{dayDate.getDate()}/{dayDate.getMonth() + 1}</p>
                  </div>
                  <button onClick={() => setModalDay(dayIdx)} className="text-text3 hover:text-green">
                    <Plus size={15} />
                  </button>
                </div>

                <div className="todo-col-body flex-1 overflow-y-auto p-2 flex flex-col gap-3" style={{ minHeight: 0 }}>
                  <TaskSection
                    label="Compartilhadas"
                    items={shared}
                    clients={clients}
                    timeStatus={timeStatus}
                    onToggle={toggleComplete}
                    onEdit={setEditItem}
                    onDelete={deleteItem}
                  />
                  {priv.length > 0 && (
                    <TaskSection
                      label="Privadas"
                      icon={Lock}
                      items={priv}
                      clients={clients}
                      timeStatus={timeStatus}
                      onToggle={toggleComplete}
                      onEdit={setEditItem}
                      onDelete={deleteItem}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(modalDay !== null || editItem) && (
        <TaskModal
          dayOfWeek={editItem ? editItem.day_of_week : modalDay}
          weekDateStr={weekDateStr}
          boardId={boardsSupported ? activeBoardId : undefined}
          clients={clients}
          userEmail={user?.email}
          existing={editItem}
          onClose={() => {
            setModalDay(null)
            setEditItem(null)
          }}
          onSaved={(item, isNew) => {
            setItems((prev) => (isNew ? [...prev, item] : prev.map((i) => (i.id === item.id ? item : i))))
            setModalDay(null)
            setEditItem(null)
          }}
        />
      )}

      {newBoardOpen && <NewBoardModal onClose={() => setNewBoardOpen(false)} onCreate={createBoard} />}
    </div>
  )
}

function TaskSection({ label, icon: Icon, items, clients, timeStatus, onToggle, onEdit, onDelete }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-text3 mb-1.5 px-1">
        {Icon && <Icon size={10} />}
        {label}
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <TaskCard
            key={item.id}
            item={item}
            client={clients.find((c) => c.id === item.client_id)}
            status={timeStatus(item)}
            onToggle={() => onToggle(item)}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item)}
          />
        ))}
        {items.length === 0 && <p className="text-[11px] text-text3 px-1">Nada por aqui</p>}
      </div>
    </div>
  )
}

const STATUS_COLOR = {
  done: 'green',
  late: 'red',
  soon: 'yellow',
  normal: 'default'
}

function TaskCard({ item, client, status, onToggle, onEdit, onDelete }) {
  return (
    <div className="group bg-bg3 border border-border rounded-input px-2.5 py-2 flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <button onClick={onToggle} className="mt-0.5 flex-shrink-0">
          <div
            className="w-4 h-4 rounded flex items-center justify-center border"
            style={{
              background: item.completed ? 'var(--green)' : 'transparent',
              borderColor: item.completed ? 'var(--green)' : 'var(--border2)'
            }}
          >
            {item.completed && <Check size={11} color="#0a1206" strokeWidth={3} />}
          </div>
        </button>
        <button onClick={onEdit} className={`flex-1 text-left text-sm ${item.completed ? 'line-through text-text3' : 'text-text'}`}>
          {item.title}
        </button>
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-text3 hover:text-red flex-shrink-0">
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap pl-6">
        {item.task_time && <Badge color={STATUS_COLOR[status]}>{formatTime(item.task_time)}</Badge>}
        {client && (
          <span className="flex items-center gap-1 text-[11px] text-text3">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: client.color || 'var(--green)' }} />
            {client.name}
          </span>
        )}
        {item.is_recurring && <Repeat size={10} className="text-text3" />}
        {item.is_private && <Lock size={10} className="text-text3" />}
      </div>
    </div>
  )
}

function DoneList({ items, clients, onUndo }) {
  if (items.length === 0) return <EmptyState title="Nenhuma tarefa concluída" description="Marque tarefas como feitas para vê-las aqui." />

  return (
    <div className="flex flex-col gap-2 overflow-y-auto">
      {items.map((item) => {
        const dayDate = item.task_time ? new Date(`${item.week_date}T${item.task_time}`) : null
        const late = dayDate && item.completed_at && new Date(item.completed_at) > dayDate
        return (
          <div key={item.id} className="card px-4 py-3 flex items-center gap-3">
            <Badge color={late ? 'red' : 'green'}>{late ? '⚠ Em atraso' : '✓ No prazo'}</Badge>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text truncate">{item.title}</p>
              <p className="text-[11px] text-text3">
                {clients.find((c) => c.id === item.client_id)?.name || 'Sem cliente'} •{' '}
                {item.completed_at && new Date(item.completed_at).toLocaleString('pt-BR')}
              </p>
            </div>
            <Button size="sm" variant="ghost" icon={Undo2} onClick={() => onUndo(item)}>
              Desfazer
            </Button>
          </div>
        )
      })}
    </div>
  )
}

function TaskModal({ dayOfWeek, weekDateStr, boardId, clients, userEmail, existing, onClose, onSaved }) {
  const [title, setTitle] = useState(existing?.title || '')
  const [day, setDay] = useState(dayOfWeek ?? 0)
  const [time, setTime] = useState(existing?.task_time || '')
  const [clientId, setClientId] = useState(existing?.client_id || '')
  const [recurring, setRecurring] = useState(existing?.is_recurring || false)
  const [priv, setPriv] = useState(existing?.is_private || false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        title,
        day_of_week: day,
        task_time: time || null,
        client_id: clientId || null,
        is_recurring: recurring,
        is_private: priv,
        owner_email: userEmail,
        week_date: weekDateStr,
        ...(boardId !== undefined ? { board_id: boardId } : {})
      }
      if (existing) {
        const { data, error } = await supabase.from('todo_items').update(payload).eq('id', existing.id).select().single()
        if (error) throw error
        onSaved(data, false)
      } else {
        const { data, error } = await supabase
          .from('todo_items')
          .insert({ ...payload, completed: false, position: 0 })
          .select()
          .single()
        if (error) throw error
        onSaved(data, true)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={existing ? 'Editar tarefa' : 'Nova tarefa'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Título" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Dia" value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {DAY_LABELS.map((l, i) => (
              <option key={i} value={i}>
                {l}
              </option>
            ))}
          </Select>
          <Field label="Horário (opcional)" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <Select label="Cliente (opcional)" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Nenhum</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Toggle checked={recurring} onChange={setRecurring} label="Recorrente (repete toda semana)" />
        <Toggle checked={priv} onChange={setPriv} label="Privada (só você vê)" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function NewBoardModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onCreate(name)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo quadro">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Nome do quadro"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Financeiro, Projeto X..."
          required
          autoFocus
        />
        <p className="text-xs text-text3">
          Um quadro separado do "Equipe", com suas próprias colunas de dias e tarefas. Visível só para você.
        </p>
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
