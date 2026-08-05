import { X, Loader2 } from 'lucide-react'
import { useEffect } from 'react'

// ─── Button ──────────────────────────────────────────────────────────────────
export function Button({ variant = 'ghost', size = 'md', className = '', loading, children, ...props }) {
  const variants = {
    green: 'btn-green',
    ghost: 'btn-ghost',
    red: 'btn-red',
    indigo: 'btn-indigo',
  }
  const sizes = { sm: 'btn-sm', md: '', lg: 'px-4 py-2.5 text-sm' }
  return (
    <button className={`btn ${variants[variant]} ${sizes[size]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${width} animate-fadeIn`}>
        {title && (
          <div className="modal-header">
            <h3 className="text-sm font-semibold">{title}</h3>
            <button onClick={onClose} className="w-6 h-6 rounded-md bg-bg-3 border border-border flex items-center justify-center text-text-2 hover:text-text transition-colors">
              <X size={14} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Toast ───────────────────────────────────────────────────────────────────
export function Toast({ toast }) {
  if (!toast) return null
  const colors = { success: 'border-green', error: 'border-red-500' }
  const dots = { success: 'bg-green', error: 'bg-red-500' }
  return (
    <div className={`fixed bottom-5 right-5 bg-bg-2 border ${colors[toast.type]} rounded-xl p-3 z-[600] shadow-2xl flex items-center gap-2.5 max-w-xs animate-fadeIn`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dots[toast.type]}`} />
      <span className="text-sm text-text">{toast.message}</span>
    </div>
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = true }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width="max-w-sm">
      <p className="text-sm text-text-2 mb-5">{message}</p>
      <div className="flex gap-2 justify-center">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant={danger ? 'red' : 'green'} onClick={onConfirm}>Confirmar</Button>
      </div>
    </Modal>
  )
}

// ─── Field ───────────────────────────────────────────────────────────────────
export function Field({ label, required, optional, hint, error, children }) {
  return (
    <div className="mb-3">
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-green ml-1">*</span>}
          {optional && <span className="text-text-3 font-normal normal-case tracking-normal ml-1 text-[11px]">opcional</span>}
        </label>
      )}
      {children}
      {hint && <p className="text-[11px] text-text-3 mt-1">{hint}</p>}
      {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
    </div>
  )
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
export function Avatar({ name = '?', size = 'sm', color = '#818cf8' }) {
  const sizes = { xs: 'w-5 h-5 text-[8px]', sm: 'w-7 h-7 text-[10px]', md: 'w-9 h-9 text-xs', lg: 'w-12 h-12 text-sm' }
  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`} style={{ background: color }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
export function Spinner({ className = '' }) {
  return <Loader2 size={20} className={`animate-spin ${className}`} />
}

// ─── Empty State ─────────────────────────────────────────────────────────────
export function Empty({ icon = '📭', title, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-text-3">
      <div className="text-5xl mb-3 opacity-30">{icon}</div>
      {title && <h3 className="text-sm text-text-2 font-medium mb-1">{title}</h3>}
      {message && <p className="text-xs">{message}</p>}
    </div>
  )
}

// ─── Badge ───────────────────────────────────────────────────────────────────
export function Badge({ children, color = 'green' }) {
  const colors = {
    green: 'bg-green/15 text-green border-green/30',
    yellow: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30',
    red: 'bg-red-400/15 text-red-400 border-red-400/30',
    blue: 'bg-blue-400/15 text-blue-400 border-blue-400/30',
    indigo: 'bg-indigo-400/15 text-indigo-400 border-indigo-400/30',
  }
  return <span className={`badge border ${colors[color]}`}>{children}</span>
}

// ─── Color Picker ────────────────────────────────────────────────────────────
const PALETTE = ['#6BAF45','#3b82f6','#a855f7','#f97316','#ec4899','#eab308','#14b8a6','#ef4444','#64748b','#06b6d4']
export function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap mt-1.5">
      {PALETTE.map(c => (
        <button key={c} onClick={() => onChange(c)} className={`w-5 h-5 rounded-full transition-transform ${value === c ? 'ring-2 ring-white scale-110' : ''}`} style={{ background: c }} />
      ))}
    </div>
  )
}

// ─── Toggle ──────────────────────────────────────────────────────────────────
export function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} className={`w-8 h-[18px] rounded-full relative transition-colors flex-shrink-0 ${value ? 'bg-green' : 'bg-bg-4 border border-border-2'}`}>
      <span className={`absolute top-[3px] w-3 h-3 bg-white rounded-full transition-all ${value ? 'left-[17px]' : 'left-[2px]'}`} />
    </button>
  )
}

// ─── Dropzone ────────────────────────────────────────────────────────────────
export function Dropzone({ onFiles, accept, label, sublabel, className = '' }) {
  const handleDrop = (e) => { e.preventDefault(); onFiles(e.dataTransfer.files) }
  return (
    <div
      className={`border-2 border-dashed border-border-2 rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-green hover:bg-green/5 ${className}`}
      onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.multiple=true; if(accept) inp.accept=accept; inp.onchange=(e)=>onFiles(e.target.files); inp.click() }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="text-2xl mb-2 text-text-3">☁</div>
      <p className="text-sm text-text-2">{label || 'Arraste ou clique para selecionar'}</p>
      {sublabel && <p className="text-xs text-text-3 mt-1">{sublabel}</p>}
    </div>
  )
}
