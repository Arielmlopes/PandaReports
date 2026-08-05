import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button, Field, Modal, Spinner, Empty } from '@/components/ui'
import { ChevronLeft, ChevronRight, X, Download, Link, Plus, Trash2, FileText, Filter, Calendar } from 'lucide-react'
import { forceDownload, fmtDateShort } from '@/utils'
import jsPDF from 'jspdf'

/* ── Media Lightbox ──────────────────────────────────── */
function Lightbox({ files, startIdx, onClose }) {
  const [idx, setIdx] = useState(startIdx)
  const f = files[idx]
  useEffect(() => {
    const h = e => { if(e.key==='Escape')onClose(); if(e.key==='ArrowLeft')setIdx(i=>Math.max(0,i-1)); if(e.key==='ArrowRight')setIdx(i=>Math.min(files.length-1,i+1)) }
    document.addEventListener('keydown',h); return()=>document.removeEventListener('keydown',h)
  },[files.length,onClose])
  if(!f) return null
  return (
    <motion.div style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.94)',display:'flex',flexDirection:'column'}}
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',flexShrink:0}}>
        <span style={{fontSize:13,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'60%'}}>{f.name||f.url?.split('/').pop()}</span>
        <div style={{display:'flex',gap:8}}>
          <button style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:8,background:'#6BAF45',color:'#000',fontSize:12,fontWeight:700,border:'none',cursor:'pointer'}} onClick={()=>forceDownload(f.url,f.name||'arquivo')}><Download size={13}/>Salvar</button>
          <button style={{width:32,height:32,borderRadius:8,background:'rgba(255,255,255,.1)',border:'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}><X size={15}/></button>
        </div>
      </div>
      {idx>0&&<button style={{position:'fixed',left:12,top:'50%',transform:'translateY(-50%)',width:40,height:40,borderRadius:'50%',background:'rgba(255,255,255,.1)',border:'none',color:'#fff',fontSize:22,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setIdx(i=>i-1)}>‹</button>}
      {idx<files.length-1&&<button style={{position:'fixed',right:12,top:'50%',transform:'translateY(-50%)',width:40,height:40,borderRadius:'50%',background:'rgba(255,255,255,.1)',border:'none',color:'#fff',fontSize:22,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setIdx(i=>i+1)}>›</button>}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',padding:'0 60px'}}>
        {f.file_type==='video'
          ? <video src={f.url} controls autoPlay style={{maxWidth:'100%',maxHeight:'calc(100vh - 160px)',borderRadius:8,background:'#000'}}/>
          : <img src={f.url} alt="" style={{maxWidth:'100%',maxHeight:'calc(100vh - 160px)',objectFit:'contain',borderRadius:8}}/>}
      </div>
      {files.length>1&&(
        <div style={{display:'flex',gap:7,padding:'8px 20px',overflowX:'auto',flexShrink:0,justifyContent:'center'}}>
          {files.map((a,i)=>(
            <div key={i} onClick={()=>setIdx(i)} style={{width:46,height:46,borderRadius:7,overflow:'hidden',border:`2px solid ${i===idx?'#6BAF45':'transparent'}`,cursor:'pointer',flexShrink:0,opacity:i===idx?1:0.5,transition:'all .12s'}}>
              <img src={a.url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

/* ── Upload Modal ────────────────────────────────────── */
function UploadModal({ open, clientId, onClose, onCreated }) {
  const { collaborators, showToast } = useApp()
  const [files, setFiles] = useState([])
  const [desc, setDesc] = useState('')
  const [collabId, setCollabId] = useState('')
  const [type, setType] = useState('Post')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    if (!files.length) { showToast('Selecione ao menos um arquivo','error'); return }
    setLoading(true)
    const { data: mat, error } = await supabase.from('materials').insert({ client_id: clientId, description: desc, type, date, collaborator_id: collabId||null }).select().single()
    if (error) { showToast('Erro ao criar material','error'); setLoading(false); return }
    const fileRows = []
    for (const f of files) {
      const safe = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'_')
      const path = `${clientId}/${mat.id}/${Date.now()}_${safe}`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, f, { upsert: true })
      if (!upErr) {
        const { data: pub } = supabase.storage.from('uploads').getPublicUrl(path)
        const ft = f.type.startsWith('video') ? 'video' : 'image'
        const { data: fRow } = await supabase.from('files').insert({ material_id: mat.id, url: pub.publicUrl, name: f.name, file_type: ft }).select().single()
        if (fRow) fileRows.push(fRow)
      }
    }
    onCreated({ ...mat, files: fileRows })
    onClose(); setFiles([]); setDesc(''); setCollabId('')
    showToast('Material adicionado!'); setLoading(false)
  }
  const TYPES = ['Post','Carrossel','Vídeo','Story','Reels','ID Visual','Arte impressa','Outro']
  return (
    <Modal open={open} onClose={onClose} title="Adicionar material">
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Field label="Tipo">
          <select className="input" value={type} onChange={e=>setType(e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Data"><input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field>
      </div>
      <Field label="Descrição" optional><input className="input" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Ex: Post aniversário da empresa"/></Field>
      <Field label="Colaborador" optional>
        <select className="input" value={collabId} onChange={e=>setCollabId(e.target.value)}><option value="">— Nenhum —</option>{collaborators.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </Field>
      <Field label="Arquivos *">
        <label style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,border:'2px dashed rgba(255,255,255,0.11)',borderRadius:12,padding:24,cursor:'pointer',transition:'border-color .15s,background .15s'}} className="hover:border-green hover:bg-green/5">
          <input type="file" multiple className="hidden" onChange={e=>setFiles(Array.from(e.target.files))} accept="image/*,video/*,application/pdf"/>
          <span style={{fontSize:24,opacity:0.4}}>☁</span>
          <span style={{fontSize:13,color:'#888'}}>Arraste ou clique para selecionar</span>
          <span style={{fontSize:11,color:'#555'}}>PNG, JPG, MP4, PDF · múltiplos arquivos</span>
          {files.length>0&&<span style={{fontSize:12,color:'#6BAF45',fontWeight:600}}>{files.length} arquivo(s) selecionado(s)</span>}
        </label>
      </Field>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="green" loading={loading} onClick={submit}>Salvar material</Button>
      </div>
    </Modal>
  )
}

/* ── PDF Export ──────────────────────────────────────── */
async function loadImageAsDataURL(url) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

async function getImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve({ w: 1, h: 1 })
    img.src = dataUrl
  })
}

async function exportPDF(client, materials, period, sysLogoUrl) {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  const W = 210, H = 297, margin = 14, contentW = W - margin * 2

  // ── CAPA ─────────────────────────────────────────────
  doc.setFillColor(10, 10, 10)
  doc.rect(0, 0, W, H, 'F')
  doc.setFillColor(107, 175, 69)
  doc.rect(0, 0, W, 4, 'F')
  doc.rect(0, H - 4, W, 4, 'F')

  // Logo da agência
  let logoBottomY = 70
  if (sysLogoUrl) {
    const logoData = await loadImageAsDataURL(sysLogoUrl)
    if (logoData) {
      const { w, h } = await getImageDimensions(logoData)
      const logoW = Math.min(100, contentW)
      const logoH = logoW * (h / w)
      const cappedH = Math.min(logoH, 50)
      const cappedW = cappedH * (w / h)
      doc.addImage(logoData, 'PNG', (W - cappedW) / 2, 60, cappedW, cappedH, undefined, 'FAST')
      logoBottomY = 60 + cappedH + 16
    }
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(38)
    doc.setTextColor(107, 175, 69); doc.text('Panda', W / 2, 90, { align: 'center' })
    doc.setTextColor(255, 255, 255); doc.text('Reports', W / 2, 112, { align: 'center' })
    logoBottomY = 128
  }

  // Linha
  doc.setDrawColor(107, 175, 69); doc.setLineWidth(0.4)
  doc.line(margin + 30, logoBottomY, W - margin - 30, logoBottomY)

  // Textos da capa
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.setTextColor(136, 136, 136)
  doc.text('RELATÓRIO DE MATERIAIS', W / 2, logoBottomY + 13, { align: 'center' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(255, 255, 255)
  const cn = client.name.length > 32 ? client.name.slice(0, 32) + '…' : client.name
  doc.text(cn, W / 2, logoBottomY + 28, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(107, 175, 69)
  doc.text(period, W / 2, logoBottomY + 40, { align: 'center' })

  // Box de contagem
  const boxY = H - 85
  doc.setFillColor(20, 20, 20); doc.roundedRect(margin, boxY, contentW, 42, 3, 3, 'F')
  const countTypes = [
    { label: 'Posts',      fn: t => t.toLowerCase().includes('post') },
    { label: 'Carrosséis', fn: t => t.toLowerCase().includes('carrossel') },
    { label: 'Vídeos',     fn: t => ['vídeo','video'].some(v => t.toLowerCase().includes(v)) },
    { label: 'Reels',      fn: t => t.toLowerCase().includes('reels') },
    { label: 'Stories',    fn: t => ['story','stories'].some(v => t.toLowerCase().includes(v)) },
  ]
  let bx = margin + 8
  countTypes.forEach(({ label, fn }) => {
    const count = materials.filter(m => fn(m.type || '')).length
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(count > 0 ? 107 : 85, count > 0 ? 175 : 85, count > 0 ? 69 : 85)
    doc.text(String(count), bx, boxY + 20)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(136, 136, 136)
    doc.text(label, bx, boxY + 28); bx += 36
  })
  // Total badge
  doc.setFillColor(107, 175, 69); doc.roundedRect(W - margin - 36, boxY + 6, 34, 30, 3, 3, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(0, 0, 0)
  doc.text(String(materials.length), W - margin - 19, boxY + 22, { align: 'center' })
  doc.setFontSize(7); doc.text('TOTAL', W - margin - 19, boxY + 30, { align: 'center' })

  // Data
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(85, 85, 85)
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, W / 2, H - 10, { align: 'center' })

  // ── PÁGINAS DE MATERIAIS ──────────────────────────────
  // Layout: lista, vários materiais por página
  // Cada material: caixa com type | description | date à esquerda, thumbnail à direita (proporcional)

  const THUMB_MAX_W = 52   // max width da thumbnail em mm
  const THUMB_MAX_H = 52   // max height da thumbnail em mm
  const ROW_PAD = 4        // padding interno do box
  const ROW_MIN_H = 22     // altura mínima do box
  const ROW_GAP = 5        // espaço entre boxes
  const PAGE_TOP = 14      // margem do topo da página de materiais
  const PAGE_BOTTOM = H - 12
  const LEFT_W = contentW - THUMB_MAX_W - 6  // largura da coluna de texto

  let y = PAGE_TOP
  let firstMatPage = true

  for (const m of materials) {
    const imgs = (m.files || []).filter(f => f.file_type === 'image')
    const cover = imgs[0]

    // Carrega imagem e calcula dimensões proporcionais
    let imgData = null
    let thumbW = 0, thumbH = 0
    if (cover) {
      imgData = await loadImageAsDataURL(cover.url)
      if (imgData) {
        const { w: iw, h: ih } = await getImageDimensions(imgData)
        // Calcula proporcional dentro do max
        if (iw / ih > THUMB_MAX_W / THUMB_MAX_H) {
          // Paisagem: limita pela largura
          thumbW = THUMB_MAX_W
          thumbH = THUMB_MAX_W * (ih / iw)
        } else {
          // Retrato: limita pela altura
          thumbH = THUMB_MAX_H
          thumbW = THUMB_MAX_H * (iw / ih)
        }
      }
    }

    const rowH = Math.max(ROW_MIN_H, thumbH + ROW_PAD * 2)

    // Nova página se não couber
    if (firstMatPage || y + rowH > PAGE_BOTTOM) {
      doc.addPage()
      doc.setFillColor(12, 12, 12); doc.rect(0, 0, W, H, 'F')
      doc.setFillColor(107, 175, 69); doc.rect(0, 0, W, 3, 'F'); doc.rect(0, H - 3, W, 3, 'F')
      // Mini header
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(107, 175, 69)
      doc.text(client.name, margin, 10)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(85, 85, 85)
      doc.text(`  ·  ${period}`, margin + doc.getTextWidth(client.name), 10)
      y = PAGE_TOP + 4
      firstMatPage = false
    }

    // Box do material
    doc.setFillColor(22, 22, 22); doc.roundedRect(margin, y, contentW, rowH, 2, 2, 'F')

    // Thumbnail proporcional (direita, centralizada verticalmente no box)
    if (imgData && thumbW > 0) {
      const thumbX = margin + contentW - thumbW - ROW_PAD
      const thumbY = y + (rowH - thumbH) / 2
      const fmt = imgData.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(imgData, fmt, thumbX, thumbY, thumbW, thumbH, undefined, 'FAST')
      // Indicador de múltiplas imagens
      if (imgs.length > 1) {
        doc.setFillColor(0, 0, 0, 0.7); doc.roundedRect(thumbX + thumbW - 14, thumbY + thumbH - 7, 13, 6, 1, 1, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(255, 255, 255)
        doc.text(`+${imgs.length - 1}`, thumbX + thumbW - 7.5, thumbY + thumbH - 3.5, { align: 'center' })
      }
    }

    // Texto (esquerda)
    const tx = margin + ROW_PAD
    const ty = y + ROW_PAD + 4

    // Type badge
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(107, 175, 69)
    doc.text(m.type || 'Material', tx, ty)

    // Date
    if (m.date) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(85, 85, 85)
      doc.text(`  ·  ${m.date}`, tx + doc.getTextWidth(m.type || 'Material'), ty)
    }

    // Description
    if (m.description) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(232, 232, 232)
      const maxChars = Math.floor(LEFT_W / 1.8)
      const desc = m.description.length > maxChars ? m.description.slice(0, maxChars) + '…' : m.description
      // Word wrap manual simples
      const words = desc.split(' ')
      let line = '', lineY = ty + 7, lineCount = 0
      for (const word of words) {
        const test = line + (line ? ' ' : '') + word
        if (doc.getTextWidth(test) > LEFT_W - 4 || lineCount >= 2) {
          if (lineCount < 2) { doc.text(line, tx, lineY); lineY += 4.5; lineCount++ }
          line = lineCount < 2 ? word : '…'
        } else { line = test }
      }
      if (line && lineCount < 3) doc.text(line, tx, lineY)
    }

    y += rowH + ROW_GAP
  }

  // Numeração
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(85, 85, 85)
    doc.text(`Página ${i - 1} de ${pageCount - 1}`, W - margin, H - 7, { align: 'right' })
  }

  doc.save(`relatorio-${client.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.pdf`)
}
/* ── Date helpers ────────────────────────────────────── */
const today = () => new Date().toISOString().split('T')[0]
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().split('T')[0] }
const startOfWeek = () => { const d = new Date(); d.setDate(d.getDate()-d.getDay()+1); return d.toISOString().split('T')[0] }
const startOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }

const QUICK_PERIODS = [
  { label: 'Esta semana', from: startOfWeek, to: today },
  { label: 'Sem. passada', from: () => daysAgo(14), to: () => daysAgo(7) },
  { label: 'Este mês', from: startOfMonth, to: today },
  { label: 'Últimos 3 meses', from: () => daysAgo(90), to: today },
  { label: 'Últimos 6 meses', from: () => daysAgo(180), to: today },
  { label: 'Este ano', from: () => `${new Date().getFullYear()}-01-01`, to: today },
  { label: 'Todos', from: () => '2000-01-01', to: today },
]

const MAT_TYPES = ['Todos','Post','Post feed','Carrossel','Vídeo','Video','Story','Stories','Reels','ID Visual','Arte impressa','Outro']

/* ── Main Page ───────────────────────────────────────── */
export default function ClientPage() {
  const { id } = useParams()
  const { clients } = useApp()
  const { isAdmin } = useAuth()
  const client = clients.find(c => c.id === id)
  const [materials, setMaterials] = useState([])
  const [briefings, setBriefings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('materials')
  const [lightbox, setLightbox] = useState(null)
  const [uploadModal, setUploadModal] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [quickPeriod, setQuickPeriod] = useState(6) // index into QUICK_PERIODS (default: Todos)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [typeFilter, setTypeFilter] = useState('Todos')
  const [showDatePicker, setShowDatePicker] = useState(false)

  const fromDate = useCustom ? customFrom : QUICK_PERIODS[quickPeriod]?.from() || '2000-01-01'
  const toDate = useCustom ? customTo : QUICK_PERIODS[quickPeriod]?.to() || today()

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      supabase.from('materials').select('*, files(*)').eq('client_id', id).order('date', { ascending: false }),
      supabase.from('briefings').select('*').eq('client_id', id).order('created_at', { ascending: false })
    ]).then(([m, b]) => {
      setMaterials(m.data || [])
      setBriefings(b.data || [])
      setLoading(false)
    })
  }, [id])

  // Flexible type match — handles "Post feed", "post", "Post", etc.
  const typeMatch = (matType, filter) => {
    if (filter === 'Todos') return true
    if (!matType) return false
    const m = matType.toLowerCase().trim()
    const f = filter.toLowerCase().trim()
    return m === f || m.startsWith(f) || f.startsWith(m) ||
      m.includes(f) || f.includes(m)
  }

  // Build type chips from actual DB values
  const typeList = useMemo(() => {
    const dbTypes = [...new Set(materials.map(m => m.type).filter(Boolean))].sort()
    return ['Todos', ...dbTypes]
  }, [materials])

  // Period-only filter (for KPI counts — independent of type chip)
  const periodFiltered = useMemo(() => {
    return materials.filter(m => (!fromDate || m.date >= fromDate) && (!toDate || m.date <= toDate))
  }, [materials, fromDate, toDate])

  // Full filter (period + type — for display)
  const filtered = useMemo(() => {
    return periodFiltered.filter(m => typeMatch(m.type, typeFilter))
  }, [periodFiltered, typeFilter])

  // KPIs always from period-only (so counts don't change when type chip is selected)
  const kpis = useMemo(() => ({
    total: periodFiltered.length,
    post: periodFiltered.filter(m => typeMatch(m.type, 'Post')).length,
    carrossel: periodFiltered.filter(m => typeMatch(m.type, 'Carrossel')).length,
    video: periodFiltered.filter(m => typeMatch(m.type, 'Vídeo') || typeMatch(m.type, 'Reels')).length,
    story: periodFiltered.filter(m => typeMatch(m.type, 'Story') || typeMatch(m.type, 'Stories')).length,
  }), [periodFiltered])

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/form/${id}`)
    setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleExport = async () => {
    if (!periodFiltered.length) return
    setExporting(true)
    const period = useCustom ? `${customFrom} a ${customTo}` : QUICK_PERIODS[quickPeriod]?.label || 'Todos'
    const sysLogoUrl = localStorage.getItem('sys_logo') || ''
    try { await exportPDF(client, periodFiltered, period, sysLogoUrl) } catch(e) { console.error(e) }
    setExporting(false)
  }

  const deleteMaterial = async (matId) => {
    if (!window.confirm('Excluir este material?')) return
    await supabase.from('materials').delete().eq('id', matId)
    setMaterials(p => p.filter(m => m.id !== matId))
  }

  // Group by date for timeline view
  const grouped = useMemo(() => {
    const g = {}
    filtered.forEach(m => {
      const key = m.date || 'Sem data'
      if (!g[key]) g[key] = []
      g[key].push(m)
    })
    return Object.entries(g).sort(([a],[b]) => b.localeCompare(a))
  }, [filtered])

  if (!client) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}><Spinner/></div>

  const periodLabel = useCustom
    ? `${customFrom} → ${customTo}`
    : QUICK_PERIODS[quickPeriod]?.label || 'Todos'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
        {client.logo_url
          ? <img src={client.logo_url} style={{width:44,height:44,borderRadius:10,objectFit:'cover',flexShrink:0}} alt={client.name}/>
          : <div style={{width:44,height:44,borderRadius:10,background:client.color,flexShrink:0}}/>}
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{fontSize:18,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{client.name}</h1>
          <p style={{fontSize:12,color:'#666'}}>{[client.seg,client.resp].filter(Boolean).join(' · ')}</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          <button onClick={copyLink} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:9,border:`1px solid ${linkCopied?'#6BAF45':'rgba(255,255,255,0.1)'}`,background:'transparent',fontSize:12,color:linkCopied?'#6BAF45':'#888',cursor:'pointer',transition:'all .15s'}}>
            <Link size={13}/> {linkCopied?'✓ Copiado':'Link pedidos'}
          </button>
          <button onClick={handleExport} disabled={exporting||!periodFiltered.length} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:9,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',fontSize:12,color:'#888',cursor:'pointer',transition:'all .15s',opacity:filtered.length?1:0.4}}>
            <FileText size={13}/> {exporting?'Gerando...':'Exportar PDF'}
          </button>
          {isAdmin&&<button onClick={()=>setUploadModal(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:9,background:'#6BAF45',border:'none',fontSize:12,fontWeight:600,color:'#000',cursor:'pointer'}}>
            <Plus size={13}/> Adicionar
          </button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{padding:'10px 20px 0',display:'flex',gap:8,flexShrink:0,borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
        {['materials','briefings'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'8px 16px',fontSize:12,fontWeight:600,cursor:'pointer',border:'none',background:'transparent',borderBottom:`2px solid ${tab===t?'#6BAF45':'transparent'}`,color:tab===t?'#6BAF45':'#888',transition:'all .15s',marginBottom:-1}}>
            {t==='materials'?`🗂 Materiais (${materials.length})`:`📋 Pedidos (${briefings.length})`}
          </button>
        ))}
      </div>

      {tab === 'materials' && (
        <>
          {/* KPI cards */}
          <div style={{padding:'14px 20px 10px',display:'flex',gap:10,flexShrink:0,overflowX:'auto'}}>
            {[
              {label:'TOTAL',value:kpis.total,sub:'materiais',color:'#6BAF45'},
              {label:'POSTS',value:kpis.post},
              {label:'CARROSSÉIS',value:kpis.carrossel},
              {label:'VÍDEOS & REELS',value:kpis.video},
              {label:'STORIES',value:kpis.story},
            ].map(k=>(
              <div key={k.label} style={{background:'#141414',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,padding:'12px 16px',minWidth:120,flexShrink:0}}>
                <p style={{fontSize:9,textTransform:'uppercase',letterSpacing:'0.07em',color:'#555',fontWeight:700,marginBottom:4}}>{k.label}</p>
                <p style={{fontSize:22,fontWeight:700,color:k.color||'#E8E8E8',lineHeight:1}}>{k.value}</p>
                {k.sub&&<p style={{fontSize:10,color:'#555',marginTop:2}}>{k.sub}</p>}
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{padding:'0 20px 12px',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              {/* Period quick filters */}
              <span style={{fontSize:11,color:'#555',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',flexShrink:0}}>Período:</span>
              {QUICK_PERIODS.map((p,i)=>(
                <button key={p.label} onClick={()=>{setQuickPeriod(i);setUseCustom(false)}} style={{padding:'4px 10px',borderRadius:100,fontSize:11,fontWeight:600,cursor:'pointer',border:`1px solid ${!useCustom&&quickPeriod===i?'rgba(107,175,69,0.5)':'rgba(255,255,255,0.1)'}`,background:!useCustom&&quickPeriod===i?'rgba(107,175,69,0.1)':'transparent',color:!useCustom&&quickPeriod===i?'#6BAF45':'#888',transition:'all .12s',flexShrink:0}}>
                  {p.label}
                </button>
              ))}

              {/* Custom date range */}
              <button onClick={()=>setShowDatePicker(!showDatePicker)} style={{padding:'4px 10px',borderRadius:100,fontSize:11,fontWeight:600,cursor:'pointer',border:`1px solid ${useCustom?'rgba(107,175,69,0.5)':'rgba(255,255,255,0.1)'}`,background:useCustom?'rgba(107,175,69,0.1)':'transparent',color:useCustom?'#6BAF45':'#888',display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                <Calendar size={11}/> Personalizado
              </button>
              {showDatePicker&&(
                <div style={{display:'flex',alignItems:'center',gap:6,background:'#141414',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:'6px 10px'}}>
                  <span style={{fontSize:11,color:'#666'}}>De</span>
                  <input type="date" value={customFrom} onChange={e=>{setCustomFrom(e.target.value);setUseCustom(true)}} style={{background:'transparent',border:'none',color:'#E8E8E8',fontSize:12,outline:'none',cursor:'pointer'}}/>
                  <span style={{fontSize:11,color:'#666'}}>até</span>
                  <input type="date" value={customTo} onChange={e=>{setCustomTo(e.target.value);setUseCustom(true)}} style={{background:'transparent',border:'none',color:'#E8E8E8',fontSize:12,outline:'none',cursor:'pointer'}}/>
                  {useCustom&&<button onClick={()=>{setUseCustom(false);setShowDatePicker(false)}} style={{background:'none',border:'none',color:'#666',cursor:'pointer',fontSize:16,lineHeight:1}}>×</button>}
                </div>
              )}

              {/* Separator */}
              <span style={{width:1,height:20,background:'rgba(255,255,255,0.08)',flexShrink:0}}/>

              {/* Type filter */}
              <span style={{fontSize:11,color:'#555',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',flexShrink:0}}>Tipo:</span>
              {typeList.map(t=>(
                <button key={t} onClick={()=>setTypeFilter(t)} style={{padding:'4px 10px',borderRadius:100,fontSize:11,fontWeight:600,cursor:'pointer',border:`1px solid ${typeFilter===t?'rgba(107,175,69,0.5)':'rgba(255,255,255,0.1)'}`,background:typeFilter===t?'rgba(107,175,69,0.1)':'transparent',color:typeFilter===t?'#6BAF45':'#888',transition:'all .12s',flexShrink:0}}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Content area */}
      <div style={{flex:1,overflow:'auto',padding:'0 20px 20px',minHeight:0}}>
        {loading ? <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:200}}><Spinner/></div> : (
          tab==='materials' ? (
            filtered.length===0
              ? <div style={{textAlign:'center',padding:'60px 20px',color:'#555'}}><div style={{fontSize:40,marginBottom:12,opacity:0.3}}>🗂</div><p>Nenhum material no período selecionado</p></div>
              : <div>
                  {grouped.map(([date, mats])=>{
                    const fmtDate = date!=='Sem data' ? new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}) : 'Sem data'
                    return(
                      <div key={date} style={{marginBottom:24}}>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                          <span style={{fontSize:12,fontWeight:700,color:'#888',textTransform:'capitalize'}}>{fmtDate}</span>
                          <span style={{fontSize:10,padding:'2px 8px',borderRadius:100,background:'rgba(255,255,255,0.06)',color:'#555'}}>{mats.length} item{mats.length!==1?'s':''}</span>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
                          {mats.map((m,mi)=>{
                            const imgs=(m.files||[]).filter(f=>['image','video'].includes(f.file_type))
                            const cover=imgs[0]
                            return(
                              <motion.div key={m.id} style={{background:'#141414',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,overflow:'hidden',cursor:'pointer',transition:'border-color .15s'}}
                                initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:mi*0.02}}
                                whileHover={{y:-2,borderColor:'rgba(107,175,69,0.4)'}}
                                className="group">
                                <div style={{height:130,background:'#111',overflow:'hidden',position:'relative'}} onClick={()=>cover&&setLightbox({files:imgs.map(f=>({...f,name:f.url?.split('/').pop()})),idx:0})}>
                                  {cover
                                    ? cover.file_type==='video'
                                      ? <video src={cover.url} muted preload="metadata" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                      : <img src={cover.url} style={{width:'100%',height:'100%',objectFit:'cover'}} loading="lazy" alt=""/>
                                    : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,opacity:0.2}}>🖼</div>}
                                  {imgs.length>1&&<span style={{position:'absolute',bottom:6,right:6,background:'rgba(0,0,0,0.7)',color:'#fff',fontSize:9,padding:'2px 6px',borderRadius:100}}>+{imgs.length-1}</span>}
                                  {m.type&&<span style={{position:'absolute',top:6,left:6,background:'rgba(107,175,69,0.85)',color:'#000',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:100}}>{m.type}</span>}
                                </div>
                                <div style={{padding:'10px 12px'}}>
                                  <p style={{fontSize:12,fontWeight:500,color:'#E8E8E8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:4}}>{m.description||'Sem descrição'}</p>
                                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                    <span style={{fontSize:10,color:'#555'}}>{m.date?new Date(m.date+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}):''}</span>
                                    {isAdmin&&<button onClick={e=>{e.stopPropagation();deleteMaterial(m.id)}} style={{background:'none',border:'none',color:'#555',cursor:'pointer',opacity:0,transition:'opacity .15s',padding:2}} className="group-hover:opacity-100"><Trash2 size={12}/></button>}
                                  </div>
                                </div>
                              </motion.div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
          ) : (
            briefings.length===0
              ? <div style={{textAlign:'center',padding:'60px 20px',color:'#555'}}><div style={{fontSize:40,marginBottom:12,opacity:0.3}}>📋</div><p>Nenhum pedido ainda</p><p style={{fontSize:12,marginTop:6}}>Compartilhe o link acima para receber pedidos</p></div>
              : <div style={{maxWidth:680,display:'flex',flexDirection:'column',gap:10}}>
                  {briefings.map(b=>(
                    <motion.div key={b.id} style={{background:'#141414',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'16px'}} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                            <span style={{fontFamily:'monospace',fontSize:10,color:'#555'}}>{b.protocol}</span>
                            <span style={{fontSize:10,padding:'2px 8px',borderRadius:100,fontWeight:700,background:b.status?.includes('Aguardando')?'rgba(234,179,8,0.1)':'rgba(107,175,69,0.1)',color:b.status?.includes('Aguardando')?'#eab308':'#6BAF45',border:`1px solid ${b.status?.includes('Aguardando')?'rgba(234,179,8,0.25)':'rgba(107,175,69,0.25)'}`}}>{b.status}</span>
                          </div>
                          <p style={{fontSize:14,fontWeight:600,marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.title||'Sem título'}</p>
                          {b.type&&<span style={{display:'inline-block',fontSize:10,padding:'2px 8px',borderRadius:100,background:'rgba(255,255,255,0.06)',color:'#888',marginBottom:8}}>{b.type}</span>}
                          {b.description&&<p style={{fontSize:12,color:'#888',lineHeight:1.4}}>{b.description}</p>}
                          {b.deadline&&<p style={{fontSize:11,color:'#555',marginTop:6}}>Prazo: {b.deadline}</p>}
                        </div>
                        {isAdmin&&(
                          <select style={{fontSize:11,background:'#1A1A1A',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'6px 8px',color:'#888',cursor:'pointer',flexShrink:0}} value={b.status} onChange={async e=>{await supabase.from('briefings').update({status:e.target.value}).eq('id',b.id);setBriefings(p=>p.map(x=>x.id===b.id?{...x,status:e.target.value}:x))}}>
                            <option>Recebido - Aguardando producao</option>
                            <option>Em producao</option>
                            <option>Aguardando aprovacao</option>
                            <option>Aprovado pelo cliente</option>
                            <option>Concluido</option>
                          </select>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
          )
        )}
      </div>

      <UploadModal open={uploadModal} clientId={id} onClose={()=>setUploadModal(false)} onCreated={m=>setMaterials(p=>[m,...p])}/>
      <AnimatePresence>{lightbox&&<Lightbox files={lightbox.files} startIdx={lightbox.idx} onClose={()=>setLightbox(null)}/>}</AnimatePresence>
    </div>
  )
}
