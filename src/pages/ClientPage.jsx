import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import jsPDF from 'jspdf'
import {
  Link as LinkIcon,
  Download,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Video,
  Layers,
  FileText
} from 'lucide-react'
import { supabase, publicUrlFor, uploadFile } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import { KpiCard } from '../components/ui/Animated'
import { Button, Modal, Field, TextArea, Select, Spinner, EmptyState, Badge } from '../components/ui'
import { formatDate, formatDateLong, getPeriodRange, downloadBlob, fileCategory } from '../utils'

const PERIOD_OPTIONS = [
  { key: 'week', label: 'Esta semana' },
  { key: 'lastWeek', label: 'Sem. passada' },
  { key: 'month', label: 'Este mês' },
  { key: 'm3', label: '3m' },
  { key: 'm6', label: '6m' },
  { key: 'year', label: 'Este ano' },
  { key: 'all', label: 'Todos' }
]

const TYPE_ICONS = {
  post: ImageIcon,
  carrossel: Layers,
  carousel: Layers,
  video: Video,
  vídeo: Video,
  reel: Video,
  reels: Video,
  stories: ImageIcon,
  story: ImageIcon
}

function normalizeType(t) {
  return (t || '').trim().toLowerCase()
}

export default function ClientPage() {
  const { id } = useParams()
  const { collaborators, settings, pushToast } = useApp()
  const [client, setClient] = useState(null)
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [customRange, setCustomRange] = useState({ start: '', end: '' })
  const [typeFilter, setTypeFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [lightbox, setLightbox] = useState(null) // { materialIndex, fileIndex }
  const [exporting, setExporting] = useState(false)

  const loadClient = useCallback(async () => {
    const { data } = await supabase.from('clients').select('*').eq('id', id).maybeSingle()
    setClient(data)
  }, [id])

  const loadMaterials = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('materials')
      .select('*, files(*)')
      .eq('client_id', id)
      .order('date', { ascending: false })
    setMaterials(data || [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadClient()
    loadMaterials()
  }, [loadClient, loadMaterials])

  const periodFiltered = useMemo(() => {
    let start, end
    if (period === 'custom') {
      start = customRange.start ? new Date(customRange.start) : null
      end = customRange.end ? new Date(customRange.end + 'T23:59:59') : null
    } else {
      const range = getPeriodRange(period)
      start = range.start
      end = range.end
    }
    return materials.filter((m) => {
      const d = new Date(m.date)
      if (start && d < start) return false
      if (end && d > end) return false
      return true
    })
  }, [materials, period, customRange])

  const availableTypes = useMemo(() => {
    const set = new Map()
    materials.forEach((m) => {
      const norm = normalizeType(m.type)
      if (norm && !set.has(norm)) set.set(norm, m.type)
    })
    return Array.from(set.entries())
  }, [materials])

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return periodFiltered
    return periodFiltered.filter((m) => normalizeType(m.type) === typeFilter)
  }, [periodFiltered, typeFilter])

  const kpis = useMemo(() => {
    const counts = { total: periodFiltered.length, post: 0, carrossel: 0, video: 0, stories: 0 }
    periodFiltered.forEach((m) => {
      const t = normalizeType(m.type)
      if (t === 'post') counts.post++
      else if (t === 'carrossel' || t === 'carousel') counts.carrossel++
      else if (t === 'video' || t === 'vídeo' || t === 'reel' || t === 'reels') counts.video++
      else if (t === 'stories' || t === 'story') counts.stories++
    })
    return counts
  }, [periodFiltered])

  const grouped = useMemo(() => {
    const map = new Map()
    filtered.forEach((m) => {
      const key = new Date(m.date).toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(m)
    })
    return Array.from(map.entries()).sort((a, b) => new Date(b[1][0].date) - new Date(a[1][0].date))
  }, [filtered])

  async function handleExportPDF() {
    setExporting(true)
    try {
      const doc = new jsPDF()
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const MARGIN = 14
      const GREEN = [93, 214, 44]
      const periodLabel = period === 'custom' ? 'Personalizado' : PERIOD_OPTIONS.find((p) => p.key === period)?.label || 'Todos'

      // ---------------- Capa ----------------
      doc.setFillColor(15, 15, 15)
      doc.rect(0, 0, pageW, pageH, 'F')
      doc.setFillColor(...GREEN)
      doc.rect(0, 0, pageW, 2.5, 'F')

      const systemLogoUrl = publicUrlFor(settings.system_logo?.logo_url)
      let logoBottom = 30
      if (systemLogoUrl) {
        try {
          const logo = await loadImageForPdf(systemLogoUrl)
          const size = 30
          const ratio = Math.min(size / logo.width, size / logo.height)
          const w = logo.width * ratio
          const h = logo.height * ratio
          doc.addImage(logo.dataUrl, 'JPEG', pageW / 2 - w / 2, 32, w, h)
          logoBottom = 32 + h
        } catch {
          // segue sem logo
        }
      }
      doc.setFontSize(11)
      doc.setTextColor(248, 248, 248)
      doc.text('PANDA REPORTS', pageW / 2, logoBottom + 8, { align: 'center' })

      doc.setFontSize(30)
      doc.setTextColor(248, 248, 248)
      doc.text('RELATÓRIO', pageW / 2, logoBottom + 40, { align: 'center' })
      doc.setFontSize(22)
      doc.setTextColor(...GREEN)
      doc.text(client?.name || '', pageW / 2, logoBottom + 54, { align: 'center' })

      doc.setDrawColor(...GREEN)
      doc.setLineWidth(0.6)
      doc.line(pageW / 2 - 18, logoBottom + 62, pageW / 2 + 18, logoBottom + 62)

      doc.setFontSize(9.5)
      doc.setTextColor(160, 160, 160)
      doc.text(`Período: ${periodLabel} · ${periodFiltered.length} materiais`, pageW / 2, logoBottom + 72, { align: 'center' })

      const chips = [
        { label: 'Total', value: kpis.total, color: GREEN },
        { label: 'Posts', value: kpis.post, color: [59, 130, 246] },
        { label: 'Carrosséis', value: kpis.carrossel, color: [99, 102, 241] },
        { label: 'Vídeos & Reels', value: kpis.video, color: [234, 179, 8] },
        { label: 'Stories', value: kpis.stories, color: GREEN }
      ]
      const chipGap = 3
      const chipW = (pageW - MARGIN * 2 - chipGap * (chips.length - 1)) / chips.length
      const chipH = 26
      const chipsY = logoBottom + 90
      chips.forEach((chip, i) => {
        const cx = MARGIN + i * (chipW + chipGap)
        doc.setFillColor(24, 24, 24)
        doc.roundedRect(cx, chipsY, chipW, chipH, 2, 2, 'F')
        doc.setFillColor(...chip.color)
        doc.roundedRect(cx, chipsY, chipW, 1.4, 0.7, 0.7, 'F')
        doc.setFontSize(15)
        doc.setTextColor(248, 248, 248)
        doc.text(String(chip.value), cx + chipW / 2, chipsY + 14, { align: 'center' })
        doc.setFontSize(6.5)
        doc.setTextColor(150, 150, 150)
        doc.text(chip.label, cx + chipW / 2, chipsY + 21, { align: 'center' })
      })

      doc.setDrawColor(45, 45, 45)
      doc.line(MARGIN, pageH - 20, pageW - MARGIN, pageH - 20)
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text(`Panda Agency · gerado em ${new Date().toLocaleString('pt-BR')}`, pageW / 2, pageH - 14, { align: 'center' })

      // ---------------- Paginas de materiais (grid) ----------------
      const COLS = 3
      const GAP = 6
      const CELL_W = (pageW - MARGIN * 2 - GAP * (COLS - 1)) / COLS
      const IMG_H = 42
      const TEXT_H = 20
      const CELL_H = IMG_H + 3 + TEXT_H
      const ROW_GAP = 6
      const HEADER_H = 28
      const usableH = pageH - HEADER_H - MARGIN
      const ROWS_PER_PAGE = Math.max(1, Math.floor((usableH + ROW_GAP) / (CELL_H + ROW_GAP)))
      const ITEMS_PER_PAGE = ROWS_PER_PAGE * COLS
      const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))

      for (let p = 0; p < totalPages; p++) {
        doc.addPage()
        doc.setFillColor(255, 255, 255)
        doc.rect(0, 0, pageW, pageH, 'F')
        doc.setFontSize(12)
        doc.setTextColor(20, 20, 20)
        doc.text(client?.name || '', MARGIN, 16)
        doc.setFontSize(8)
        doc.setTextColor(140, 140, 140)
        doc.text(`Relatório de materiais · ${periodLabel}`, MARGIN, 21)
        doc.text(`${p + 1}/${totalPages}`, pageW - MARGIN, 16, { align: 'right' })
        doc.setDrawColor(225, 225, 225)
        doc.line(MARGIN, 24, pageW - MARGIN, 24)

        const pageItems = filtered.slice(p * ITEMS_PER_PAGE, (p + 1) * ITEMS_PER_PAGE)

        for (let i = 0; i < pageItems.length; i++) {
          const m = pageItems[i]
          const row = Math.floor(i / COLS)
          const col = i % COLS
          const x = MARGIN + col * (CELL_W + GAP)
          const y = HEADER_H + row * (CELL_H + ROW_GAP)

          doc.setFillColor(244, 244, 244)
          doc.roundedRect(x, y, CELL_W, IMG_H, 2, 2, 'F')

          const firstFile = m.files?.[0]
          if (firstFile?.url && firstFile.file_type === 'image') {
            try {
              const img = await loadImageForPdf(firstFile.url, 500)
              let w = img.width
              let h = img.height
              const ratio = Math.min(CELL_W / w, IMG_H / h)
              w *= ratio
              h *= ratio
              doc.addImage(img.dataUrl, 'JPEG', x + (CELL_W - w) / 2, y + (IMG_H - h) / 2, w, h)
            } catch {
              // segue sem imagem se falhar
            }
          }

          if (m.files?.length > 1) {
            doc.setFillColor(15, 15, 15)
            doc.roundedRect(x + CELL_W - 13, y + IMG_H - 8, 11, 6, 1, 1, 'F')
            doc.setFontSize(6.5)
            doc.setTextColor(255, 255, 255)
            doc.text(`+${m.files.length - 1}`, x + CELL_W - 7.5, y + IMG_H - 3.8, { align: 'center' })
          }

          doc.setFontSize(6.5)
          doc.setTextColor(...GREEN)
          doc.text((m.type || '').toUpperCase(), x, y + IMG_H + 5)
          doc.setTextColor(150, 150, 150)
          doc.text(formatDate(m.date), x + CELL_W, y + IMG_H + 5, { align: 'right' })

          doc.setFontSize(7.5)
          doc.setTextColor(30, 30, 30)
          const lines = doc.splitTextToSize(m.description || 'Sem descrição', CELL_W)
          doc.text(lines.slice(0, 2), x, y + IMG_H + 10)
        }
      }

      doc.save(`relatorio-${client?.name || 'cliente'}.pdf`)
      pushToast({ message: 'PDF exportado com sucesso.', type: 'success' })
    } finally {
      setExporting(false)
    }
  }

  function loadImageForPdf(url, maxDim = 900) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
        const width = Math.max(1, Math.round(img.naturalWidth * scale))
        const height = Math.max(1, Math.round(img.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.78), width, height })
      }
      img.onerror = reject
      img.src = url
    })
  }

  function copyOrderLink() {
    const link = `${window.location.origin}/form/${id}`
    navigator.clipboard.writeText(link)
    pushToast({ message: 'Link de pedidos copiado.', type: 'success' })
  }

  if (!client) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} loading="lazy" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
              style={{ background: client.color || 'var(--green)' }}
            >
              {client.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-text">{client.name}</h1>
            <p className="text-text3 text-sm">
              {client.seg || 'Sem segmento'} • {client.resp || 'Sem responsável'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" icon={LinkIcon} onClick={copyOrderLink}>
            Link pedidos
          </Button>
          <Button variant="secondary" icon={Download} loading={exporting} onClick={handleExportPDF}>
            Exportar PDF
          </Button>
          <Button icon={Plus} onClick={() => setAddOpen(true)}>
            Adicionar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="flex flex-wrap gap-4 mb-6">
        <KpiCard label="Total" value={kpis.total} color="green" />
        <KpiCard label="Posts" value={kpis.post} color="blue" />
        <KpiCard label="Carrosséis" value={kpis.carrossel} color="indigo" />
        <KpiCard label="Vídeos & Reels" value={kpis.video} color="yellow" />
        <KpiCard label="Stories" value={kpis.stories} color="green" />
      </div>

      {/* Filtros de periodo */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PERIOD_OPTIONS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${
              period === p.key
                ? 'bg-green-dim text-green border-green/30'
                : 'bg-bg4 text-text2 border-border2 hover:text-text'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setPeriod('custom')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${
            period === 'custom'
              ? 'bg-green-dim text-green border-green/30'
              : 'bg-bg4 text-text2 border-border2 hover:text-text'
          }`}
        >
          Personalizado
        </button>
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customRange.start}
              onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
              className="input-base text-xs px-2 py-1.5"
            />
            <span className="text-text3 text-xs">até</span>
            <input
              type="date"
              value={customRange.end}
              onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
              className="input-base text-xs px-2 py-1.5"
            />
          </div>
        )}
      </div>

      {/* Filtros de tipo */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setTypeFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${
            typeFilter === 'all'
              ? 'bg-bg5 text-text border-border2'
              : 'bg-transparent text-text3 border-border hover:text-text2'
          }`}
        >
          Todos os tipos
        </button>
        {availableTypes.map(([norm, original]) => (
          <button
            key={norm}
            onClick={() => setTypeFilter(norm)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 capitalize ${
              typeFilter === norm
                ? 'bg-bg5 text-text border-border2'
                : 'bg-transparent text-text3 border-border hover:text-text2'
            }`}
          >
            {original}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum material encontrado" description="Ajuste os filtros ou adicione um novo material." />
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map(([dateKey, items]) => (
            <div key={dateKey}>
              <h3 className="text-sm font-medium text-text2 mb-3">{formatDateLong(items[0].date)}</h3>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
              >
                {items.map((m) => {
                  const cover = m.files?.[0]
                  const Icon = TYPE_ICONS[normalizeType(m.type)] || FileText
                  return (
                    <motion.button
                      key={m.id}
                      whileHover={{ y: -2 }}
                      onClick={() =>
                        setLightbox({
                          materialIndex: filtered.findIndex((x) => x.id === m.id),
                          fileIndex: 0
                        })
                      }
                      className="card overflow-hidden text-left flex flex-col"
                    >
                      <div className="relative bg-bg4 aspect-square flex items-center justify-center overflow-hidden">
                        {cover?.file_type?.startsWith('image') ? (
                          <img src={cover.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                        ) : cover?.file_type?.startsWith('video') ? (
                          <video src={cover.url} className="w-full h-full object-cover" muted />
                        ) : (
                          <Icon size={28} className="text-text3" />
                        )}
                        <Badge className="absolute top-2 left-2 capitalize">{m.type}</Badge>
                        {m.files?.length > 1 && (
                          <span className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                            +{m.files.length - 1}
                          </span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs text-text truncate">{m.description || 'Sem descrição'}</p>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddMaterialModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        clientId={id}
        collaborators={collaborators}
        onSaved={() => {
          setAddOpen(false)
          loadMaterials()
        }}
      />

      {lightbox && (
        <Lightbox
          materials={filtered}
          index={lightbox.materialIndex}
          fileIndex={lightbox.fileIndex}
          onClose={() => setLightbox(null)}
          onNavigate={(materialIndex, fileIndex) => setLightbox({ materialIndex, fileIndex })}
        />
      )}
    </div>
  )
}

function AddMaterialModal({ open, onClose, clientId, collaborators, onSaved }) {
  const [description, setDescription] = useState('')
  const [type, setType] = useState('Post')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [collaboratorId, setCollaboratorId] = useState('')
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: material, error } = await supabase
        .from('materials')
        .insert({
          client_id: clientId,
          description,
          type,
          date,
          collaborator_id: collaboratorId || null
        })
        .select()
        .single()
      if (error) throw error

      for (const file of files) {
        const url = await uploadFile(file, `materials/${material.id}`)
        await supabase.from('files').insert({
          material_id: material.id,
          url,
          name: file.name,
          file_type: fileCategory(file.type)
        })
      }

      setDescription('')
      setFiles([])
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar material" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextArea
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
            <option>Post</option>
            <option>Carrossel</option>
            <option>Vídeo</option>
            <option>Reels</option>
            <option>Stories</option>
          </Select>
          <Field label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Select label="Colaborador" value={collaboratorId} onChange={(e) => setCollaboratorId(e.target.value)}>
          <option value="">Nenhum</option>
          {collaborators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-text2 font-medium">Arquivos</span>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files))}
            className="text-sm text-text2"
          />
        </label>
        <div className="flex justify-end gap-2 mt-2">
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

function Lightbox({ materials, index, fileIndex, onClose, onNavigate }) {
  const material = materials[index]
  const files = material?.files || []
  const file = files[fileIndex]

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, fileIndex])

  function goNext() {
    if (fileIndex < files.length - 1) onNavigate(index, fileIndex + 1)
    else if (index < materials.length - 1) onNavigate(index + 1, 0)
  }
  function goPrev() {
    if (fileIndex > 0) onNavigate(index, fileIndex - 1)
    else if (index > 0) onNavigate(index - 1, 0)
  }

  if (!material || !file) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] bg-black/90 flex flex-col"
        onClick={onClose}
      >
        <div className="flex items-start justify-between gap-4 p-4 border-b border-white/10" onClick={(e) => e.stopPropagation()}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {material.type && (
                <Badge color="green" className="capitalize">
                  {material.type}
                </Badge>
              )}
              <span className="text-white/50 text-xs">{formatDateLong(material.date)}</span>
            </div>
            <h3 className="text-white text-base font-medium truncate">{material.description || 'Sem descrição'}</h3>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={() => downloadBlob(file.url, file.name)} className="text-white/70 hover:text-white">
              <Download size={20} />
            </button>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center relative px-12">
          <button
            onClick={(e) => {
              e.stopPropagation()
              goPrev()
            }}
            className="absolute left-2 text-white/60 hover:text-white"
          >
            <ChevronLeft size={32} />
          </button>

          {file.file_type?.startsWith('image') && (
            <img src={file.url} alt="" onClick={(e) => e.stopPropagation()} className="max-h-[75vh] max-w-full object-contain" />
          )}
          {file.file_type?.startsWith('video') && (
            <video src={file.url} controls onClick={(e) => e.stopPropagation()} className="max-h-[75vh] max-w-full" />
          )}
          {file.file_type === 'pdf' && (
            <iframe src={file.url} title={file.name} onClick={(e) => e.stopPropagation()} className="w-full h-[75vh] bg-white" />
          )}
          {!file.file_type?.startsWith('image') && !file.file_type?.startsWith('video') && file.file_type !== 'pdf' && (
            <div className="flex flex-col items-center gap-3 text-white" onClick={(e) => e.stopPropagation()}>
              <FileText size={48} />
              <Button onClick={() => downloadBlob(file.url, file.name)}>Baixar arquivo</Button>
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation()
              goNext()
            }}
            className="absolute right-2 text-white/60 hover:text-white"
          >
            <ChevronRight size={32} />
          </button>
        </div>

        {files.length > 1 && (
          <div className="flex gap-2 justify-center p-4 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
            {files.map((f, i) => (
              <button
                key={f.id}
                onClick={() => onNavigate(index, i)}
                className={`w-14 h-14 rounded-input overflow-hidden border-2 flex-shrink-0 ${
                  i === fileIndex ? 'border-green' : 'border-transparent opacity-60'
                }`}
              >
                {f.file_type?.startsWith('image') ? (
                  <img src={f.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-bg4 flex items-center justify-center">
                    <FileText size={16} className="text-text3" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
