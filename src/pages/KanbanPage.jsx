import { useEffect, useState, useRef, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button, Field, Modal, Spinner } from '@/components/ui'
import { Plus, Paperclip, Trash2, ChevronLeft, ChevronRight, X, Download } from 'lucide-react'
import { FILE_ICONS, forceDownload } from '@/utils'

/* ── inject CSS once ────────────────────────────────────────── */
;(function(){
  if(document.getElementById('kbcss')) return
  const s = document.createElement('style'); s.id='kbcss'; s.textContent=`
  .kb-wrap{height:100%;display:flex;flex-direction:column;overflow:hidden}
  .kb-toolbar{flex-shrink:0;padding:16px 16px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .kb-board-wrap{flex:1;min-height:0;overflow:hidden;padding:0 16px 12px}
  .kb-board{display:flex;gap:10px;height:100%;overflow-x:auto;overflow-y:hidden}
  .kb-board::-webkit-scrollbar{height:10px}
  .kb-board::-webkit-scrollbar-track{background:#111;border-radius:5px}
  .kb-board{cursor:grab}
  .kb-board.panning{cursor:grabbing;user-select:none}
  .kb-board::-webkit-scrollbar-thumb{background:#222;border-radius:4px}
  .kb-col{width:250px;min-width:250px;flex-shrink:0;display:flex;flex-direction:column;min-height:0;
    background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:12px;height:100%}
  .kb-col.drag-over{border-color:#6BAF45;background:rgba(107,175,69,0.04)}
  .kb-col-head{display:flex;align-items:center;gap:8px;padding:11px 13px;
    border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0}
  .kb-col-label{font-size:12px;font-weight:700;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#E8E8E8}
  .kb-col-count{font-size:10px;padding:1px 7px;border-radius:100px;
    background:#1A1A1A;border:1px solid rgba(255,255,255,0.07);color:#666;flex-shrink:0}
  .kb-cards{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:8px;
    display:flex;flex-direction:column;gap:8px;overscroll-behavior:contain}
  .kb-cards::-webkit-scrollbar{width:3px}
  .kb-cards::-webkit-scrollbar-thumb{background:#222;border-radius:3px}
  .kb-col-add{padding:8px 12px;font-size:11px;color:#666;background:transparent;border:none;
    border-top:1px solid rgba(255,255,255,0.07);cursor:pointer;display:flex;align-items:center;
    gap:4px;flex-shrink:0;border-radius:0 0 12px 12px;transition:color .15s,background .15s}
  .kb-col-add:hover{color:#6BAF45;background:rgba(107,175,69,0.05)}
  .kb-card{background:#1A1A1A;border:1px solid rgba(255,255,255,0.09);border-radius:10px;
    overflow:hidden;cursor:pointer;transition:border-color .12s;flex-shrink:0}
  .kb-card:hover{border-color:rgba(107,175,69,0.5)}
  .kb-card.dragging{opacity:0.35}
  .kb-card.drag-above{border-top:2px solid #6BAF45}
  .kb-card.drag-below{border-bottom:2px solid #6BAF45}
  .kb-cover{height:126px;overflow:hidden;background:#111}
  .kb-cover img{width:100%;height:100%;object-fit:cover;display:block}
  .kb-body{padding:10px 12px}
  .kb-row1{display:flex;align-items:center;gap:5px;margin-bottom:6px}
  .kb-cdot{width:6px;height:6px;border-radius:50%;flex-shrink:0;display:inline-block}
  .kb-cname{font-size:10px;color:#888;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .kb-fbadge{font-size:9px;padding:1px 5px;border-radius:100px;background:rgba(107,175,69,.12);
    color:#6BAF45;border:1px solid rgba(107,175,69,.3);font-weight:700;flex-shrink:0}
  .kb-title{font-size:12.5px;font-weight:600;color:#E8E8E8;line-height:1.35;margin-bottom:4px;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .kb-desc{font-size:11px;color:#666;line-height:1.3;margin-bottom:5px;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .kb-foot{display:flex;align-items:center;justify-content:space-between;margin-top:6px}
  .kb-av{width:18px;height:18px;border-radius:50%;background:#6366f1;display:flex;
    align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0}
  .kb-avname{font-size:10px;color:#666;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .kb-attc{font-size:10px;color:#666;display:flex;align-items:center;gap:3px}
  .kb-more{width:100%;padding:8px;font-size:11px;color:#6BAF45;background:rgba(107,175,69,.06);
    border:1px dashed rgba(107,175,69,.3);border-radius:8px;cursor:pointer;text-align:center;
    transition:background .15s;flex-shrink:0}
  .kb-more:hover{background:rgba(107,175,69,.12)}
  .av-wrap{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.94);display:flex;flex-direction:column}
  .av-top{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;flex-shrink:0}
  .av-main{flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:0 56px}
  .av-main img{max-width:100%;max-height:calc(100vh - 160px);object-fit:contain;border-radius:8px}
  .av-main video{max-width:100%;max-height:calc(100vh - 160px);border-radius:8px;background:#000}
  .av-main iframe{width:min(860px,90vw);height:calc(100vh - 180px);border:none;border-radius:8px;background:#fff}
  .av-strip{display:flex;gap:7px;padding:8px 20px;overflow-x:auto;flex-shrink:0;justify-content:center}
  .av-thumb{width:46px;height:46px;border-radius:7px;overflow:hidden;border:2px solid transparent;cursor:pointer;flex-shrink:0;transition:all .12s}
  .av-thumb.on{border-color:#6BAF45;transform:scale(1.1)}
  .av-thumb img,.av-thumb video{width:100%;height:100%;object-fit:cover;display:block}
  .av-thumb-ico{width:100%;height:100%;background:#222;display:flex;align-items:center;justify-content:center;font-size:16px}
  .av-nav{position:fixed;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;
    background:rgba(255,255,255,.1);border:none;color:#fff;font-size:22px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;z-index:1;transition:background .15s}
  .av-nav:hover{background:rgba(255,255,255,.2)}
  `
  document.head.appendChild(s)
}())

/* ── Attachment Viewer ────────────────────────────────── */
function AttViewer({ files, idx: ini, onClose }) {
  const [idx, setIdx] = useState(ini)
  const f = files[idx]
  useEffect(() => {
    const h = e => {
      if(e.key==='Escape') onClose()
      if(e.key==='ArrowLeft') setIdx(i=>Math.max(0,i-1))
      if(e.key==='ArrowRight') setIdx(i=>Math.min(files.length-1,i+1))
    }
    document.addEventListener('keydown',h)
    return()=>document.removeEventListener('keydown',h)
  },[files.length,onClose])
  if(!f) return null
  const ft=f.ft||'file'
  return(
    <div className="av-wrap" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="av-top">
        <span style={{fontSize:13,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'60%'}}>{f.name}</span>
        <div style={{display:'flex',gap:8}}>
          <button style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:8,background:'#6BAF45',color:'#000',fontSize:12,fontWeight:700,border:'none',cursor:'pointer'}} onClick={()=>forceDownload(f.url,f.name)}><Download size={13}/>Salvar</button>
          <button style={{width:32,height:32,borderRadius:8,background:'rgba(255,255,255,.1)',border:'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}><X size={15}/></button>
        </div>
      </div>
      {idx>0&&<button className="av-nav" style={{left:12}} onClick={()=>setIdx(i=>i-1)}>‹</button>}
      {idx<files.length-1&&<button className="av-nav" style={{right:12}} onClick={()=>setIdx(i=>i+1)}>›</button>}
      <div className="av-main">
        {ft==='image'&&<img src={f.url} alt={f.name}/>}
        {ft==='video'&&<video src={f.url} controls autoPlay/>}
        {ft==='pdf'&&<iframe src={f.url} title={f.name}/>}
        {!['image','video','pdf'].includes(ft)&&(
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:72,marginBottom:16}}>{FILE_ICONS[ft]||'📎'}</div>
            <p style={{color:'#fff',fontWeight:600,marginBottom:12}}>{f.name}</p>
            <button style={{display:'flex',alignItems:'center',gap:8,margin:'0 auto',padding:'8px 20px',borderRadius:8,background:'#6BAF45',color:'#000',fontWeight:700,border:'none',cursor:'pointer'}} onClick={()=>forceDownload(f.url,f.name)}><Download size={14}/>Baixar</button>
          </div>
        )}
      </div>
      {files.length>1&&(
        <div className="av-strip">
          {files.map((a,i)=>(
            <div key={i} className={`av-thumb ${i===idx?'on':''}`} onClick={()=>setIdx(i)}>
              {a.ft==='image'?<img src={a.url} alt=""/>:<div className="av-thumb-ico">{FILE_ICONS[a.ft]||'📎'}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Card Detail ──────────────────────────────────────── */
function CardDetail({card:ini,columns,clients,collabs,isAdmin,onClose,onUpdate,onDelete}){
  const {showToast}=useApp()
  const [card,setCard]=useState({...ini})
  const [viewer,setViewer]=useState(null)
  const [upl,setUpl]=useState(false)
  const save=async(field,value)=>{
    const u={...card,[field]:value};setCard(u);onUpdate(u)
    await supabase.from('kanban_cards').update({[field]:value}).eq('id',card.id)
  }
  const handleFiles=async(files)=>{
    setUpl(true)
    const atts=[...(card.attachments||[])]
    for(const f of files){
      const safe=f.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'_')
      const path=`kanban/${card.client_id}/${card.id}/${Date.now()}_${safe}`
      const{error}=await supabase.storage.from('uploads').upload(path,f,{upsert:true})
      if(!error){
        const{data}=supabase.storage.from('uploads').getPublicUrl(path)
        const ft=f.type.startsWith('video')?'video':f.type==='application/pdf'?'pdf':f.type.startsWith('image')?'image':'file'
        atts.push({url:data.publicUrl,name:f.name,ft})
      }
    }
    await save('attachments',atts);setUpl(false);showToast('Anexo(s) adicionado(s)!')
  }
  const atts=card.attachments||[]
  return(
    <>
      <Modal open title={card.title} onClose={onClose} width="max-w-xl">
        <Field label="Título"><input className="input" value={card.title} onChange={e=>setCard(p=>({...p,title:e.target.value}))} onBlur={e=>save('title',e.target.value)}/></Field>
        <Field label="Descrição">
          <textarea className="input resize-none" rows={3} value={card.description||''} style={{overflow:'hidden'}}
            onChange={e=>{setCard(p=>({...p,description:e.target.value}));e.target.style.height='auto';e.target.style.height=e.target.scrollHeight+'px'}}
            onBlur={e=>save('description',e.target.value)}/>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Coluna"><select className="input" value={card.column_id} onChange={e=>save('column_id',e.target.value)}>{columns.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
          <Field label="Responsável"><select className="input" value={card.collaborator_id||''} onChange={e=>save('collaborator_id',e.target.value||null)}><option value="">— Nenhum —</option>{collabs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <div style={{marginTop:8}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'#555'}}>Anexos {atts.length>0&&`(${atts.length})`}</span>
            <label style={{cursor:'pointer',fontSize:12,color:'#888',display:'flex',alignItems:'center',gap:4}} className="hover:text-green transition-colors">
              <input type="file" multiple className="hidden" onChange={e=>handleFiles(Array.from(e.target.files))} accept="image/*,video/*,application/pdf,.doc,.docx,.ppt,.pptx"/>
              {upl?'⏳ Enviando...':'📎 Adicionar'}
            </label>
          </div>
          {atts.length===0
            ?<label style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'1px dashed rgba(255,255,255,0.11)',borderRadius:10,padding:14,cursor:'pointer',fontSize:12,color:'#555',transition:'border-color .15s,color .15s'}} className="hover:border-green hover:text-green">
              <input type="file" multiple className="hidden" onChange={e=>handleFiles(Array.from(e.target.files))}/>
              📎 Clique para adicionar arquivos
            </label>
            :<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
              {atts.map((a,i)=>(
                <div key={i} style={{position:'relative',aspectRatio:'1',borderRadius:8,overflow:'hidden',border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',background:'#1A1A1A'}} className="group hover:border-green transition-colors" onClick={()=>setViewer({files:atts,idx:i})}>
                  {a.ft==='image'&&<img src={a.url} style={{width:'100%',height:'100%',objectFit:'cover'}} loading="lazy" alt=""/>}
                  {a.ft==='video'&&<video src={a.url} muted preload="metadata" style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
                  {!['image','video'].includes(a.ft)&&<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4}}><span style={{fontSize:24}}>{FILE_ICONS[a.ft]||'📎'}</span><span style={{fontSize:9,color:'#666'}}>{(a.name||'').split('.').pop().toUpperCase()}</span></div>}
                  <div style={{position:'absolute',bottom:0,left:0,right:0,background:'rgba(0,0,0,.65)',padding:'3px 5px'}} className="opacity-0 group-hover:opacity-100 transition-opacity"><p style={{fontSize:9,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</p></div>
                  {isAdmin&&<button style={{position:'absolute',top:3,right:3,width:16,height:16,borderRadius:4,background:'rgba(0,0,0,.7)',border:'none',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} className="opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all" onClick={e=>{e.stopPropagation();const n=[...atts];n.splice(i,1);save('attachments',n)}}>×</button>}
                </div>
              ))}
            </div>}
        </div>
        {isAdmin&&(
          <div className="mt-5 pt-4 border-t border-border flex justify-between">
            <Button variant="red" size="sm" onClick={()=>supabase.from('kanban_cards').delete().eq('id',card.id).then(()=>{onDelete(card.id);showToast('Demanda excluída')})}><Trash2 size={13}/>Excluir</Button>
            {card.finalized_material_id
              ?<div className="flex items-center gap-2 text-xs text-green font-medium">✅ Enviado <button className="text-text-3 hover:text-text ml-1" onClick={()=>save('finalized_material_id',null)}>Desfazer</button></div>
              :<Button variant="ghost" size="sm" onClick={()=>showToast('Finalizar: em breve!')}>📤 Finalizar</Button>}
          </div>
        )}
      </Modal>
      <AnimatePresence>{viewer&&<AttViewer files={viewer.files} idx={viewer.idx} onClose={()=>setViewer(null)}/>}</AnimatePresence>
    </>
  )
}

/* ── New Card Modal ───────────────────────────────────── */
function NewCard({open,defaultColId,columns,clients,collabs,onClose,onCreated}){
  const [f,setF]=useState({title:'',desc:'',colId:'',clientId:'',collabId:''})
  const [loading,setLoading]=useState(false)
  const {showToast}=useApp()
  useEffect(()=>{if(defaultColId)setF(p=>({...p,colId:defaultColId}))},[defaultColId])
  const submit=async()=>{
    if(!f.title||!f.clientId){showToast('Preencha título e cliente','error');return}
    setLoading(true)
    const{data,error}=await supabase.from('kanban_cards').insert({title:f.title,description:f.desc,column_id:f.colId,client_id:f.clientId,collaborator_id:f.collabId||null,attachments:[],position:0}).select().single()
    setLoading(false)
    if(error){showToast('Erro ao criar','error');return}
    onCreated(data);onClose()
    setF({title:'',desc:'',colId:defaultColId||'',clientId:'',collabId:''})
    showToast('Demanda criada!')
  }
  return(
    <Modal open={open} onClose={onClose} title="Nova demanda">
      <Field label="Cliente *"><select className="input" value={f.clientId} onChange={e=>setF(p=>({...p,clientId:e.target.value}))}><option value="">— Selecionar —</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Título *"><input className="input" value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))} placeholder="Ex: Post de aniversário" autoFocus/></Field>
      <Field label="Descrição" optional><textarea className="input resize-none" rows={3} value={f.desc} onChange={e=>setF(p=>({...p,desc:e.target.value}))}/></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Coluna"><select className="input" value={f.colId} onChange={e=>setF(p=>({...p,colId:e.target.value}))}>{columns.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
        <Field label="Responsável" optional><select className="input" value={f.collabId} onChange={e=>setF(p=>({...p,collabId:e.target.value}))}><option value="">— Nenhum —</option>{collabs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </div>
      <div className="flex gap-2 justify-end mt-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="green" loading={loading} onClick={submit}>Criar demanda</Button></div>
    </Modal>
  )
}

/* ── Main ─────────────────────────────────────────────── */
export default function KanbanPage(){
  const {clients,collaborators:collabs}=useApp()
  const {isAdmin}=useAuth()
  const [columns,setColumns]=useState([])
  const [cards,setCards]=useState([])
  const [filter,setFilter]=useState('all')
  const [sel,setSel]=useState(null)
  const [newMod,setNewMod]=useState({open:false,colId:null})
  const [loading,setLoading]=useState(true)
  const [limits,setLimits]=useState({})
  const BATCH=20
  const boardRef=useRef(null)
  const isPanning=useRef(false)
  const panStart=useRef({x:0,sl:0})
  const drag=useRef({})

  useEffect(()=>{
    Promise.all([
      supabase.from('kanban_columns').select('*').order('position'),
      supabase.from('kanban_cards').select('id,title,description,column_id,client_id,collaborator_id,attachments,position,finalized_material_id').order('position')
    ]).then(([c,k])=>{
      if(c.data)setColumns(c.data)
      if(k.data)setCards(k.data)
      setLoading(false)
    })
  },[])

  const colCards=useCallback(colId=>
    cards.filter(c=>c.column_id===colId&&(filter==='all'||c.client_id===filter))
      .sort((a,b)=>(a.position??0)-(b.position??0))
  ,[cards,filter])

  // Drag helpers
  const clearIndicators=()=>document.querySelectorAll('.kb-card.drag-above,.kb-card.drag-below').forEach(el=>el.classList.remove('drag-above','drag-below'))

  const onDragStart=(e,cardId)=>{drag.current={cardId};setTimeout(()=>e.target.classList.add('dragging'),0)}
  const onDragEnd=e=>{e.target.classList.remove('dragging');clearIndicators()}
  const onCardOver=(e,targetId)=>{
    if(drag.current.cardId===targetId)return
    e.preventDefault();e.stopPropagation();clearIndicators()
    const r=e.currentTarget.getBoundingClientRect()
    e.currentTarget.classList.add(e.clientY<r.top+r.height/2?'drag-above':'drag-below')
  }
  const onColOver=e=>{e.preventDefault();e.currentTarget.classList.add('drag-over')}
  const onColLeave=e=>{if(!e.currentTarget.contains(e.relatedTarget))e.currentTarget.classList.remove('drag-over')}

  const onCardDrop=async(e,targetId)=>{
    e.preventDefault();e.stopPropagation()
    document.querySelectorAll('.kb-col.drag-over,.kb-card.drag-above,.kb-card.drag-below').forEach(el=>el.classList.remove('drag-over','drag-above','drag-below'))
    const{cardId}=drag.current;drag.current={}
    if(!cardId||cardId===targetId)return
    const dragged=cards.find(c=>c.id===cardId)
    const target=cards.find(c=>c.id===targetId)
    if(!dragged||!target)return
    const colId=target.column_id
    const r=e.currentTarget.getBoundingClientRect()
    const before=e.clientY<r.top+r.height/2
    const cc=cards.filter(c=>c.column_id===colId&&c.id!==cardId).sort((a,b)=>(a.position??0)-(b.position??0))
    const ti=cc.findIndex(c=>c.id===targetId)
    cc.splice(before?ti:ti+1,0,{...dragged,column_id:colId})
    const reordered=cc.map((c,i)=>({...c,position:i}))
    setCards(p=>[...p.filter(c=>c.column_id!==colId&&c.id!==cardId),...reordered])
    for(const c of reordered)supabase.from('kanban_cards').update({column_id:colId,position:c.position}).eq('id',c.id)
  }

  const onColDrop=async(e,colId)=>{
    e.preventDefault()
    document.querySelectorAll('.kb-col.drag-over').forEach(el=>el.classList.remove('drag-over'))
    const{cardId}=drag.current;drag.current={}
    if(!cardId)return
    const dragged=cards.find(c=>c.id===cardId)
    if(!dragged||dragged.column_id===colId)return
    const max=cards.filter(c=>c.column_id===colId).reduce((m,c)=>Math.max(m,c.position??0),-1)
    setCards(p=>p.map(c=>c.id===cardId?{...c,column_id:colId,position:max+1}:c))
    supabase.from('kanban_cards').update({column_id:colId,position:max+1}).eq('id',cardId)
  }

  if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}><Spinner/></div>

  return(
    <div className="kb-wrap">
      <div className="kb-toolbar">
        <select className="input" style={{width:'auto',fontSize:12}} value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">Todos os clientes</option>
          {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {isAdmin&&<Button variant="green" size="sm" onClick={()=>setNewMod({open:true,colId:columns[0]?.id})}><Plus size={14}/>Nova demanda</Button>}
      </div>

      <div className="kb-board-wrap">
        <div className="kb-board" ref={boardRef}
          onMouseDown={e=>{
            if(e.target.closest('.kb-card')||e.button!==0)return
            isPanning.current=true;panStart.current={x:e.clientX,sl:boardRef.current.scrollLeft}
            boardRef.current.classList.add('panning')
          }}
          onMouseMove={e=>{
            if(!isPanning.current)return
            boardRef.current.scrollLeft=panStart.current.sl-(e.clientX-panStart.current.x)
          }}
          onMouseUp={()=>{isPanning.current=false;boardRef.current?.classList.remove('panning')}}
          onMouseLeave={()=>{isPanning.current=false;boardRef.current?.classList.remove('panning')}}>
          {columns.map(col=>{
            const all=colCards(col.id)
            const lim=limits[col.id]||BATCH
            const visible=all.slice(0,lim)
            const hasMore=all.length>lim
            return(
              <div key={col.id} className="kb-col" onDragOver={onColOver} onDragLeave={onColLeave} onDrop={e=>onColDrop(e,col.id)}>
                <div className="kb-col-head">
                  <span style={{width:8,height:8,borderRadius:'50%',background:col.color,flexShrink:0,display:'inline-block'}}/>
                  <span className="kb-col-label">{col.label}</span>
                  <span className="kb-col-count">{all.length}</span>
                </div>

                {/* ← THIS IS THE KEY: flex:1 + min-height:0 + overflow-y:auto */}
                <div className="kb-cards">
                  {all.length===0&&<p style={{textAlign:'center',fontSize:11,color:'#666',padding:'20px 0'}}>Sem demandas</p>}
                  {visible.map(card=>{
                    const client=clients.find(c=>c.id===card.client_id)
                    const collab=collabs.find(c=>c.id===card.collaborator_id)
                    const atts=card.attachments||[]
                    const cover=atts.find(a=>a.ft==='image')
                    return(
                      <div key={card.id} className="kb-card" draggable
                        onDragStart={e=>onDragStart(e,card.id)} onDragEnd={onDragEnd}
                        onDragOver={e=>onCardOver(e,card.id)}
                        onDragLeave={clearIndicators}
                        onDrop={e=>onCardDrop(e,card.id)}
                        onClick={()=>setSel(card)}>
                        {cover&&<div className="kb-cover"><img src={cover.url} loading="lazy" alt=""/></div>}
                        <div className="kb-body">
                          <div className="kb-row1">
                            {client&&<span className="kb-cdot" style={{background:client.color}}/>}
                            <span className="kb-cname">{client?.name||''}</span>
                            {card.finalized_material_id&&<span className="kb-fbadge">✓</span>}
                          </div>
                          <p className="kb-title">{card.title}</p>
                          {card.description&&<p className="kb-desc">{card.description}</p>}
                          <div className="kb-foot">
                            {collab
                              ?<div style={{display:'flex',alignItems:'center',gap:5}}>
                                  <div className="kb-av">{collab.name[0]}</div>
                                  <span className="kb-avname">{collab.name}</span>
                                </div>
                              :<span/>}
                            {atts.length>0&&<span className="kb-attc">📎 {atts.length}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {hasMore&&(
                    <button className="kb-more" onClick={()=>setLimits(l=>({...l,[col.id]:(l[col.id]||BATCH)+BATCH}))}>
                      Ver mais {all.length-lim} cards ↓
                    </button>
                  )}
                </div>

                <button className="kb-col-add" onClick={()=>setNewMod({open:true,colId:col.id})}>
                  <Plus size={12}/>Adicionar
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <NewCard open={newMod.open} defaultColId={newMod.colId} columns={columns} clients={clients} collabs={collabs}
        onClose={()=>setNewMod({open:false,colId:null})} onCreated={card=>setCards(p=>[...p,card])}/>
      <AnimatePresence>
        {sel&&<CardDetail card={sel} columns={columns} clients={clients} collabs={collabs} isAdmin={isAdmin}
          onClose={()=>setSel(null)}
          onUpdate={u=>{setCards(p=>p.map(c=>c.id===u.id?u:c));setSel(u)}}
          onDelete={id=>{setCards(p=>p.filter(c=>c.id!==id));setSel(null)}}/>}
      </AnimatePresence>
    </div>
  )
}
