import { useState } from 'react'
import { X, Link as LinkIcon, Loader2, ChevronUp, ChevronDown } from 'lucide-react'
import { useLinkPreview } from '../../hooks/useLinkPreview'

export function LinkPreview({ url, onRemove, compact = false }) {
  const { preview, loading, failed } = useLinkPreview(url)

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text3 text-xs px-3 py-2 border border-border rounded-card">
        <Loader2 size={14} className="animate-spin" />
        Carregando preview...
      </div>
    )
  }

  if (failed || !preview?.title) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-blue text-sm hover:underline break-all"
      >
        <LinkIcon size={13} />
        {url}
      </a>
    )
  }

  let domain = ''
  try {
    domain = new URL(url).hostname.replace('www.', '')
  } catch {
    domain = url
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative flex ${compact ? 'flex-row items-center gap-3 p-2' : 'flex-col'} border border-border rounded-card overflow-hidden hover:border-green transition-colors duration-150 bg-bg4 max-w-md`}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          loading="lazy"
          className={compact ? 'w-14 h-14 object-cover rounded-input flex-shrink-0' : 'w-full h-32 object-cover'}
        />
      )}
      <div className={`flex flex-col gap-0.5 min-w-0 ${compact ? '' : 'p-3'}`}>
        <div className="flex items-center gap-1.5 text-text3 text-xs">
          <img
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
            alt=""
            className="w-3.5 h-3.5"
          />
          {domain}
        </div>
        <span className="text-sm text-text font-medium truncate">{preview.title}</span>
        {preview.description && !compact && (
          <span className="text-xs text-text2 line-clamp-2">{preview.description}</span>
        )}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove()
          }}
          className="absolute top-1.5 right-1.5 bg-bg/80 rounded-full p-1 text-text3 hover:text-red opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={12} />
        </button>
      )}
    </a>
  )
}

const LONG_TEXT_CHARS = 220
const LONG_TEXT_LINES = 4

export function TextWithPreviews({ text, collapsible = false }) {
  const [expanded, setExpanded] = useState(!collapsible)

  if (!text) return null
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  const urls = text.match(urlRegex) || []

  const isLong = collapsible && (text.length > LONG_TEXT_CHARS || text.split('\n').length > LONG_TEXT_LINES)
  const showFull = expanded || !isLong

  return (
    <div className="flex flex-col gap-2">
      <p
        className={`text-sm text-text whitespace-pre-wrap break-words ${!showFull ? 'line-clamp-4' : ''}`}
      >
        {parts.map((part, i) =>
          urlRegex.test(part) ? (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline">
              {part}
            </a>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((x) => !x)
          }}
          className="self-start text-xs font-semibold text-green bg-green-dim hover:bg-green-dim border border-green rounded-full px-3 py-1 flex items-center gap-1 transition-colors"
        >
          {showFull ? (
            <>
              <ChevronUp size={12} /> Mostrar menos
            </>
          ) : (
            <>
              <ChevronDown size={12} /> Mostrar mais
            </>
          )}
        </button>
      )}
      {showFull &&
        urls.slice(0, 1).map((url) => <LinkPreview key={url} url={url} compact />)}
    </div>
  )
}
