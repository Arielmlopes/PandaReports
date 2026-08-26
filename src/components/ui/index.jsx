import { forwardRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Eye, EyeOff, Check, ChevronDown } from 'lucide-react'
import { initials } from '../../utils'

/* ---------------- Button ---------------- */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  className = '',
  disabled,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-input font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none'
  const sizes = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-sm px-4 py-2.5',
    lg: 'text-base px-5 py-3'
  }
  const variants = {
    primary: 'bg-green text-[#0a1206] hover:bg-green2 shadow-[0_0_0_0_transparent]',
    secondary: 'bg-bg4 text-text hover:bg-bg5 border border-border2',
    ghost: 'bg-transparent text-text2 hover:bg-bg4 hover:text-text',
    danger: 'bg-red/10 text-red hover:bg-red/20 border border-red/30',
    outline: 'bg-transparent border border-border2 text-text hover:border-green hover:text-green'
  }

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        Icon && <Icon size={16} />
      )}
      {children}
    </motion.button>
  )
}

/* ---------------- Field ---------------- */
export const Field = forwardRef(function Field(
  { label, error, hint, type = 'text', className = '', ...props },
  ref
) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const actualType = isPassword ? (show ? 'text' : 'password') : type

  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-sm text-text2 font-medium">{label}</span>}
      <div className="relative">
        <input
          ref={ref}
          type={actualType}
          className="input-base w-full px-3.5 py-2.5 text-sm text-text placeholder:text-text3"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text3 hover:text-text2"
            tabIndex={-1}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {hint && !error && <span className="text-xs text-text3">{hint}</span>}
      {error && <span className="text-xs text-red">{error}</span>}
    </label>
  )
})

export function TextArea({ label, error, className = '', ...props }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-sm text-text2 font-medium">{label}</span>}
      <textarea
        className="input-base w-full px-3.5 py-2.5 text-sm text-text placeholder:text-text3 resize-none"
        {...props}
      />
      {error && <span className="text-xs text-red">{error}</span>}
    </label>
  )
}

export function Select({ label, className = '', children, ...props }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-sm text-text2 font-medium">{label}</span>}
      <div className="relative">
        <select
          className="input-base w-full px-3.5 py-2.5 text-sm text-text appearance-none pr-9"
          {...props}
        >
          {children}
        </select>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text3 pointer-events-none" />
      </div>
    </label>
  )
}

/* ---------------- Toggle ---------------- */
export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`flex items-center gap-2.5 cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-9 h-5 rounded-full transition-colors duration-150"
        style={{ background: checked ? 'var(--green)' : 'var(--bg5)' }}
      >
        <motion.span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white"
          animate={{ x: checked ? 16 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
      {label && <span className="text-sm text-text">{label}</span>}
    </label>
  )
}

/* ---------------- Badge ---------------- */
export function Badge({ children, color = 'default', className = '' }) {
  const colors = {
    default: 'bg-bg4 text-text2 border-border2',
    green: 'bg-green-dim text-green border-green/30',
    red: 'bg-red/10 text-red border-red/30',
    yellow: 'bg-yellow/10 text-yellow border-yellow/30',
    blue: 'bg-blue/10 text-blue border-blue/30',
    indigo: 'bg-indigo/10 text-indigo border-indigo/30'
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${colors[color]} ${className}`}
    >
      {children}
    </span>
  )
}

/* ---------------- Avatar ---------------- */
export function Avatar({ name, src, size = 32, className = '' }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        style={{ width: size, height: size }}
        className={`rounded-full object-cover border border-border2 ${className}`}
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={`rounded-full bg-green-dim text-green flex items-center justify-center font-semibold border border-green/20 ${className}`}
    >
      {initials(name)}
    </div>
  )
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className={`glass relative w-full ${sizes[size]} rounded-modal shadow-2xl max-h-[90vh] flex flex-col`}
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h3 className="font-semibold text-text">{title}</h3>
                <button onClick={onClose} className="text-text3 hover:text-text transition-colors">
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
            {footer && <div className="px-5 py-4 border-t border-border flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

/* ---------------- Toast ---------------- */
export function ToastContainer({ toasts, onDismiss }) {
  const colors = {
    success: 'border-green/40 text-green',
    error: 'border-red/40 text-red',
    info: 'border-border2 text-text'
  }
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className={`glass rounded-card px-4 py-3 text-sm flex items-start justify-between gap-3 border ${colors[t.type] || colors.info}`}
          >
            <span>{t.message}</span>
            <button onClick={() => onDismiss(t.id)} className="text-text3 hover:text-text">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  )
}

/* ---------------- Checkbox ---------------- */
export function Checkbox({ checked, onChange, label, disabled }) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="w-4.5 h-4.5 rounded flex items-center justify-center border transition-colors duration-150"
        style={{
          width: 18,
          height: 18,
          background: checked ? 'var(--green)' : 'var(--bg4)',
          borderColor: checked ? 'var(--green)' : 'var(--border2)'
        }}
      >
        {checked && <Check size={12} color="#0a1206" strokeWidth={3} />}
      </button>
      {label && <span className="text-sm text-text">{label}</span>}
    </label>
  )
}

/* ---------------- Spinner ---------------- */
export function Spinner({ size = 20, className = '' }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

/* ---------------- EmptyState ---------------- */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-bg4 flex items-center justify-center mb-4 text-text3">
          <Icon size={24} />
        </div>
      )}
      <h3 className="text-text font-medium mb-1">{title}</h3>
      {description && <p className="text-text2 text-sm max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  )
}
