// ─── Date Formatting ────────────────────────────────────────────────────────
const DAYS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export const fmtDate = (d) => {
  const dt = new Date(d + 'T12:00:00')
  return `${DAYS[dt.getDay()]}, ${dt.getDate()} de ${MONTHS[dt.getMonth()]}`
}
export const fmtDateShort = (d) => {
  const dt = new Date(d + 'T12:00:00')
  return `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`
}
export const fmtTime = (t) => t ? t.slice(0, 5) : ''
export const dateStr = (d = new Date()) => d.toISOString().split('T')[0]
export const timeAgo = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'agora mesmo'
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  return `há ${Math.floor(diff / 86400)} dia(s)`
}

// ─── File Utils ──────────────────────────────────────────────────────────────
export const safeFileName = (name) =>
  name.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

export const getFileType = (file) => {
  const { type, name } = file
  if (type.startsWith('video')) return 'video'
  if (type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return 'pdf'
  if (type.includes('word') || /\.(doc|docx)$/i.test(name)) return 'word'
  if (type.includes('presentation') || /\.(ppt|pptx)$/i.test(name)) return 'ppt'
  if (type.includes('spreadsheet') || /\.(xls|xlsx)$/i.test(name)) return 'excel'
  if (type.startsWith('image')) return 'image'
  return 'file'
}

export const FILE_ICONS = { video:'🎬', pdf:'📄', word:'📝', ppt:'📊', excel:'📊', image:'🖼', file:'📎' }

// ─── String Utils ────────────────────────────────────────────────────────────
export const slugify = (str) => str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
export const generateProtocol = () => {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  return `PED-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`
}

// ─── Week Utils ──────────────────────────────────────────────────────────────
export const getMondayOfWeek = (date = new Date()) => {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}
export const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// ─── Color ───────────────────────────────────────────────────────────────────
export const PALETTE = ['#6BAF45','#3b82f6','#a855f7','#f97316','#ec4899','#eab308','#14b8a6','#ef4444','#64748b','#06b6d4']

// ─── Storage Upload ──────────────────────────────────────────────────────────
export const uploadFile = async (supabase, bucket, path, file) => {
  const safePath = path.split('/').map(safeFileName).join('/')
  const { error } = await supabase.storage.from(bucket).upload(safePath, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(safePath)
  return data.publicUrl
}

export const dataURLtoBlob = (dataURL) => {
  const arr = dataURL.split(','), mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  const u8 = new Uint8Array(bstr.length)
  for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i)
  return new Blob([u8], { type: mime })
}

export const forceDownload = async (url, name) => {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(a.href); document.body.removeChild(a) }, 1000)
  } catch { window.open(url, '_blank') }
}
