import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button, Field, Modal, Toggle, Spinner } from '@/components/ui'
import { ChevronLeft, ChevronRight, Plus, Trash2, RotateCcw } from 'lucide-react'

const DAYS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo']

const getMondayOfWeek = (d = new Date()) => {
  const dt = new Date(d)
  const day = dt.getDay()
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day))
  dt.setHours(0,0,0,0)
  return dt
}
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate()+n); return r }
const dateStr = (d) => d.toISOString().split('T')[0]
const fmtTime = (t) => t ? t.slice(0,5) : ''

function getTimeState(task) {
  if (!task.task_time || task.completed) return 'normal'
  const monday = new Date(task.week_date + 'T00:00:00')
  const taskDate = new Date(monday)
  taskDate.setDate(monday.getDate() + (task.day_of_week - 1))
  const [hh, mm] = task.task_time.split(':').map(Number)
  taskDate.setHours(hh, mm, 0, 0)
  const diffMin = (taskDate - Date.now()) / 60000
  if (diffMin < 0) return 'overdue'
  if (diffMin <= 120) return 'warning'
  return 'normal'
}

function wasLate(task) {
  if (!task.task_time || !task.completed_at) return null
  const monday = new Date(task.week_date + 'T00:00:00')
  const taskDate = new Date(monday)
  taskDate.setDate(monday.getDate() + (task.day_of_week - 1))
  const [hh, mm] = task.task_time.split(':').map(Number)
  taskDate.setHours(hh, mm, 0, 0)
  return new Date(task.completed_at) > taskDate
}

export default function TodoPage() {
  const { clients, collaborators } = useApp()
  const { isAdmin, isMember, user } = useAuth()
  const [weekDate, setWeekDate] = useState(() => getMondayOfWeek())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('board')
  const [modal, setModal] = useState({ open: false, editing: null, dayNum: 1 })

  const loadItems = useCallback(async () => {
    setLoading(true)
    const wStr = dateStr(weekDate)
    const prevWStr = dateStr(addDays(weekDate, -7))
    const { data: curr } = await supabase.from('todo_items').select('*').eq('week_date', wStr).order('position')
    const { data: prevRec } = await supabase.from('todo_items').select('*').eq('week_date', prevWStr).eq('is_recurring', true)
    let all = curr || []
    // Propagate recurring from previous week
    if (prevRec?.length) {
      const toCreate = []
      for (const t of prevRec) {
        if (!all.find(e => e.is_recurring && e.title === t.title && e.day_of_week === t.day_of_week)) {
          toCreate.push({ title:t.title, day_of_week:t.day_of_week, client_id:t.client_id, assigned_email:t.assigned_email, task_time:t.task_time, is_recurring:true, week_date:wStr, completed:false, position:t.position })
        }
      }
      if (toCreate.length) {
        const { data: created } = await supabase.from('todo_items').insert(toCreate).select()
        if (created) all = [...all, ...created]
      }
    }
    setItems(all)
    setLoading(false)
  }, [weekDate])

  useEffect(() => { loadItems() }, [loadItems])

  const toggleItem = async (id) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    const completed = !item.completed
    const completed_at = completed ? new Date().toISOString() : null
    setItems(p => p.map(i => i.id === id ? {...i, completed, completed_at} : i))
    await supabase.from('todo_items').update({ completed, completed_at }).eq('id', id)
  }

  const deleteItem = async (id) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    if (item.is_recurring) {
      const wStr = dateStr(weekDate)
      await supabase.from('todo_items').delete().eq('is_recurring', true).eq('title', item.title).eq('day_of_week', item.day_of_week).gte('week_date', wStr)
      setItems(p => p.filter(i => !(i.is_recurring && i.title === item.title && i.day_of_week === item.day_of_week)))
    } else {
      await supabase.from('todo_items').delete().eq('id', id)
      setItems(p => p.filter(i => i.id !== id))
    }
  }

  const wStr = dateStr(weekDate)
  const prevW = dateStr(addDays(weekDate, -7))
  const todayStr = dateStr(new Date())
  const mon = weekDate
  const sun = addDays(weekDate, 6)
  const fmt = d => `${d.getDate()}/${d.getMonth()+1}`

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-3 mb-4 flex-wrap flex-shrink-0">
        <div className="flex gap-2">
          <button onClick={() => setTab('board')} className={`chip ${tab==='board'?'chip-active':'chip-inactive'}`}>📋 Semana</button>
          <button onClick={() => setTab('done')} className={`chip ${tab==='done'?'chip-active':'chip-inactive'}`}>✅ Concluídos</button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setWeekDate(getMondayOfWeek())} className="text-xs text-text-3 hover:text-green px-2 py-1 rounded border border-border hover:border-green transition-colors">Hoje</button>
          <button onClick={() => setWeekDate(d => addDays(d, -7))} className="w-7 h-7 bg-bg-3 border border-border rounded-lg flex items-center justify-center text-text-2 hover:text-text"><ChevronLeft size={14}/></button>
          <span className="text-sm font-semibold whitespace-nowrap">{fmt(mon)} – {fmt(sun)}</span>
          <button onClick={() => setWeekDate(d => addDays(d, 7))} className="w-7 h-7 bg-bg-3 border border-border rounded-lg flex items-center justify-center text-text-2 hover:text-text"><ChevronRight size={14}/></button>
          <Button variant="green" size="sm" onClick={() => setModal({ open:true, editing:null, dayNum:1 })}><Plus size={14}/> Nova tarefa</Button>
        </div>
      </div>

      {loading ? <div className="flex items-center justify-center flex-1"><Spinner/></div> : (
        tab === 'board' ? (
          <div className="flex gap-3 flex-1 pb-2" style={{overflowX:"auto",overflowY:"hidden",minHeight:0}}>
            {DAYS.map((day, i) => {
              const dayNum = i + 1
              const dayDate = addDays(weekDate, i)
              const dayStr = dateStr(dayDate)
              const isToday = dayStr === todayStr
              const dayItems = items.filter(t => t.week_date === wStr && t.day_of_week === dayNum).sort((a,b)=>(a.position??0)-(b.position??0))
              return (
                <div key={day} className="bg-bg-2 border border-border rounded-xl flex flex-col flex-shrink-0" style={{width:260,minWidth:260,flex:1,minHeight:0,maxHeight:'100%'}}>
                  <div className={`px-3 py-2.5 border-b border-border flex items-center gap-2 flex-shrink-0 ${isToday?'border-green/30':''}`}>
                    <span className={`text-xs font-bold flex-1 ${isToday?'text-green':''}`}>{day}</span>
                    <span className={`text-[10px] ${isToday?'text-green opacity-70':'text-text-3'}`}>{dayDate.getDate()}/{dayDate.getMonth()+1}</span>
                  </div>
                  <div className="overflow-y-auto flex-1 p-2 flex flex-col gap-2" style={{overscrollBehavior:'contain'}}>
                    {dayItems.length === 0 && <p className="text-center text-[11px] text-text-3 py-4">Sem tarefas</p>}
                    {dayItems.map(t => {
                      const state = getTimeState(t)
                      const client = clients.find(c => c.id === t.client_id)
                      return (
                        <div key={t.id} className={`rounded-lg border p-2.5 flex gap-2 transition-all
                          ${t.completed ? 'opacity-50 border-border bg-bg-3' : state==='overdue' ? 'bg-red-500/5 border-red-500/30' : state==='warning' ? 'bg-yellow-400/5 border-yellow-400/30' : 'bg-bg-3 border-border-2 hover:border-green/40'}`}>
                          <button onClick={() => toggleItem(t.id)}
                            className={`w-4 h-4 rounded-full border flex-shrink-0 mt-0.5 flex items-center justify-center transition-all
                              ${t.completed ? 'bg-green border-green text-black text-[9px]' : state==='overdue'?'border-red-400':'border-border-2 hover:border-green'}`}>
                            {t.completed && '✓'}
                          </button>
                          <div className="flex-1 min-w-0" onClick={() => setModal({open:true, editing:t, dayNum})}>
                            <p className={`text-xs font-medium leading-snug cursor-pointer ${t.completed?'line-through text-text-3':''}`}>{t.title}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {client && <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full" style={{background:client.color}}/><span className="text-[10px] text-text-3 truncate">{client.name}</span></span>}
                              {t.task_time && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${t.completed?'bg-green/10 text-green border-green/25':state==='overdue'?'bg-red-500/10 text-red-400 border-red-500/25':state==='warning'?'bg-yellow-400/10 text-yellow-400 border-yellow-400/25':'bg-bg-4 text-text-3 border-border'}`}>🕐 {fmtTime(t.task_time)}</span>}
                              {t.is_recurring && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 font-bold">🔄</span>}
                            </div>
                          </div>
                          <button onClick={() => deleteItem(t.id)} className="text-text-3 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"><Trash2 size={11}/></button>
                        </div>
                      )
                    })}
                  </div>
                  <button className="px-3 py-2 text-xs text-text-3 hover:text-green hover:bg-green/5 border-t border-border transition-colors flex items-center gap-1 flex-shrink-0 rounded-b-xl"
                    onClick={() => setModal({open:true,editing:null,dayNum})}>
                    <Plus size={11}/> Adicionar
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <div className="max-w-2xl space-y-2">
              {items.filter(t => t.week_date===wStr && t.completed).length === 0
                ? <div className="text-center py-16 text-text-3"><div className="text-4xl mb-3 opacity-30">✅</div><p className="text-sm">Nenhuma tarefa concluída esta semana</p></div>
                : items.filter(t => t.week_date===wStr && t.completed).map(t => {
                    const late = wasLate(t)
                    const client = clients.find(c => c.id === t.client_id)
                    const completedAt = t.completed_at ? new Date(t.completed_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : ''
                    return (
                      <div key={t.id} className="card p-3.5 flex items-center gap-3">
                        <span className="text-lg">{late===true?'🔴':'✅'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-through text-text-2 truncate">{t.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {client && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{background:client.color}}/><span className="text-[10px] text-text-3">{client.name}</span></span>}
                            {t.task_time && <span className="text-[10px] text-text-3">Previsto: {fmtTime(t.task_time)}</span>}
                            {t.task_time && (
                              late === true
                                ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/25 font-bold">⚠ Em atraso</span>
                                : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green/10 text-green border border-green/25 font-bold">✓ No prazo</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[11px] text-text-3">{completedAt}</span>
                          <button onClick={() => toggleItem(t.id)} className="text-text-3 hover:text-green text-xs"><RotateCcw size={13}/></button>
                        </div>
                      </div>
                    )
                  })
              }
            </div>
          </div>
        )
      )}

      {/* Modal */}
      <TodoModal open={modal.open} editing={modal.editing} defaultDay={modal.dayNum} clients={clients} collaborators={collaborators}
        weekDate={weekDate}
        onClose={() => setModal(p => ({...p, open:false, editing:null}))}
        onSaved={(item) => {
          setItems(p => modal.editing ? p.map(i => i.id===item.id?item:i) : [...p, item])
          setModal(p => ({...p, open:false, editing:null}))
        }}
        onDeleted={(id) => { deleteItem(id); setModal(p=>({...p,open:false,editing:null})) }}
      />
    </div>
  )
}

function TodoModal({ open, editing, defaultDay, clients, collaborators, weekDate, onClose, onSaved, onDeleted }) {
  const { showToast } = useApp()
  const [f, setF] = useState({ title:'', day:defaultDay||1, time:'', clientId:'', assignedEmail:'', recurring:false })
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (editing) setF({ title:editing.title||'', day:editing.day_of_week||1, time:editing.task_time?editing.task_time.slice(0,5):'', clientId:editing.client_id||'', assignedEmail:editing.assigned_email||'', recurring:editing.is_recurring||false })
    else setF(p => ({ ...p, day:defaultDay||1, title:'', time:'', clientId:'', assignedEmail:'', recurring:false }))
  }, [editing, defaultDay])
  const submit = async () => {
    if (!f.title) { showToast('Informe o título','error'); return }
    setLoading(true)
    const wStr = dateStr(weekDate)
    const payload = { title:f.title, day_of_week:parseInt(f.day), task_time:f.time||null, client_id:f.clientId||null, assigned_email:f.assignedEmail||null, is_recurring:f.recurring, week_date:wStr }
    if (editing) {
      const { data } = await supabase.from('todo_items').update(payload).eq('id', editing.id).select().single()
      onSaved(data)
    } else {
      const { data } = await supabase.from('todo_items').insert({...payload, completed:false, position:0}).select().single()
      onSaved(data)
    }
    setLoading(false)
    showToast(editing ? 'Tarefa atualizada!' : 'Tarefa criada!')
  }
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar tarefa' : 'Nova tarefa'} width="max-w-md">
      <Field label="Tarefa *"><input className="input" value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))} placeholder="Ex: Postar no Instagram" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dia">
          <select className="input" value={f.day} onChange={e=>setF(p=>({...p,day:e.target.value}))}>
            {['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'].map((d,i)=><option key={i} value={i+1}>{d}</option>)}
          </select>
        </Field>
        <Field label="Horário" optional><input className="input" type="time" value={f.time} onChange={e=>setF(p=>({...p,time:e.target.value}))} /></Field>
      </div>
      <Field label="Cliente" optional><select className="input" value={f.clientId} onChange={e=>setF(p=>({...p,clientId:e.target.value}))}><option value="">— Nenhum —</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <div className="flex items-center justify-between bg-bg-3 border border-border-2 rounded-xl p-3 mb-3">
        <div><p className="text-xs font-semibold">🔄 Demanda recorrente</p><p className="text-[11px] text-text-3">Aparece automaticamente toda semana</p></div>
        <Toggle value={f.recurring} onChange={v=>setF(p=>({...p,recurring:v}))} />
      </div>
      <div className="flex items-center justify-between">
        {editing ? <Button variant="red" size="sm" onClick={() => onDeleted(editing.id)}><Trash2 size={13}/> Excluir</Button> : <span/>}
        <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="green" loading={loading} onClick={submit}>Salvar</Button></div>
      </div>
    </Modal>
  )
}
