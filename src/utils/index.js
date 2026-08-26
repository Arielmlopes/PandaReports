// Convencao ja usada nos dados existentes do Supabase: file_type/ft guarda a
// categoria curta ("image", "video", "pdf", "doc"), nao o MIME completo do browser.
export function fileCategory(mimeType) {
  if (!mimeType) return 'doc'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType === 'application/pdf') return 'pdf'
  return 'doc'
}

export function formatDate(date, opts = {}) {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: opts.year ? 'numeric' : undefined,
    ...opts
  }).format(d)
}

export function formatDateLong(date) {
  const d = typeof date === 'string' ? new Date(date) : date
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d)
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(d)
  return `${capitalize(weekday)}, ${day}`
}

export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function formatTime(time) {
  if (!time) return ''
  return time.slice(0, 5)
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function generateProtocol() {
  const date = new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `PED-${y}${m}${d}-${rand}`
}

export function debounce(fn, delay = 300) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export const URL_REGEX = /(https?:\/\/[^\s]+)/g

export function extractUrls(text) {
  if (!text) return []
  return text.match(URL_REGEX) || []
}

export function downloadBlob(url, filename) {
  return fetch(url)
    .then((res) => res.blob())
    .then((blob) => {
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename || 'download'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(blobUrl)
    })
}

export function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const PERIOD_RANGES = {
  week: () => {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? 6 : day - 1
    const start = new Date(now)
    start.setDate(now.getDate() - diff)
    start.setHours(0, 0, 0, 0)
    return { start, end: now }
  },
  lastWeek: () => {
    const { start } = PERIOD_RANGES.week()
    const end = new Date(start)
    end.setMilliseconds(-1)
    const s2 = new Date(start)
    s2.setDate(s2.getDate() - 7)
    return { start: s2, end }
  },
  month: () => {
    const now = new Date()
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now }
  },
  m3: () => {
    const now = new Date()
    const start = new Date(now)
    start.setMonth(start.getMonth() - 3)
    return { start, end: now }
  },
  m6: () => {
    const now = new Date()
    const start = new Date(now)
    start.setMonth(start.getMonth() - 6)
    return { start, end: now }
  },
  year: () => {
    const now = new Date()
    return { start: new Date(now.getFullYear(), 0, 1), end: now }
  },
  all: () => ({ start: null, end: null })
}

export function getPeriodRange(key) {
  return (PERIOD_RANGES[key] || PERIOD_RANGES.all)()
}
