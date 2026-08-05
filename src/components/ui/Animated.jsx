import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'

export function AnimatedCounter({ value, duration = 1.5, prefix = '', suffix = '' }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    let start = 0
    const end = parseInt(value) || 0
    if (start === end) return

    const startTime = performance.now()
    const step = (now) => {
      const elapsed = (now - startTime) / (duration * 1000)
      const progress = Math.min(elapsed, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease out cubic
      setDisplay(Math.floor(eased * end))
      if (progress < 1) requestAnimationFrame(step)
      else setDisplay(end)
    }
    requestAnimationFrame(step)
  }, [inView, value, duration])

  return <span ref={ref}>{prefix}{display}{suffix}</span>
}

// ─── KPI Card with animation ──────────────────────────────────────────────────
export function KpiCard({ label, value, sub, color = 'text-green', icon, index = 0 }) {
  return (
    <motion.div
      className="card p-4 hover:border-border-2 transition-colors"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, type: 'spring', stiffness: 300, damping: 24 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      <div className="text-xs uppercase tracking-widest text-text-3 font-semibold mb-2 flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div className={`text-2xl font-bold leading-none ${color}`}>
        <AnimatedCounter value={value} />
      </div>
      {sub && <div className="text-xs text-text-3 mt-1">{sub}</div>}
    </motion.div>
  )
}

// ─── Page transition wrapper ──────────────────────────────────────────────────
export function PageTransition({ children }) {
  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

// ─── Stagger list wrapper ─────────────────────────────────────────────────────
export function StaggerList({ children, stagger = 0.06 }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className = '' }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 14 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 22 } }
      }}
    >
      {children}
    </motion.div>
  )
}

// ─── Hover card ───────────────────────────────────────────────────────────────
export function HoverCard({ children, className = '', onClick }) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  )
}

// ─── Slide-in panel (notifications) ──────────────────────────────────────────
export function SlidePanel({ open, onClose, title, children, width = 'w-80' }) {
  return (
    <>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/40 z-[290]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
      )}
      <motion.div
        className={`fixed top-0 right-0 bottom-0 ${width} bg-bg-2 border-l border-border-2 z-[300] flex flex-col shadow-2xl`}
        initial={{ x: '100%' }}
        animate={{ x: open ? 0 : '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
          <h3 className="font-semibold text-sm">{title}</h3>
          <button onClick={onClose} className="text-text-3 hover:text-text transition-colors">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </motion.div>
    </>
  )
}
