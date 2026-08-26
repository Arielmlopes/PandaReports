import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ---------------- PageTransition ---------------- */
export function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>
  )
}

/* ---------------- HoverCard ---------------- */
export function HoverCard({ children, className = '', onClick, ...props }) {
  return (
    <motion.div
      whileHover={{ y: -2, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`card ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/* ---------------- SlidePanel ---------------- */
export function SlidePanel({ open, onClose, children, width = 340, side = 'right' }) {
  const x = side === 'right' ? [width, 0, width] : [-width, 0, -width]
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={`fixed top-0 ${side === 'right' ? 'right-0' : 'left-0'} h-full z-50 glass shadow-2xl`}
            style={{ width }}
            initial={{ x: x[0] }}
            animate={{ x: x[1] }}
            exit={{ x: x[2] }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ---------------- AnimatedCounter ---------------- */
export function AnimatedCounter({ value = 0, duration = 0.8, suffix = '', prefix = '' }) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef(null)
  const fromRef = useRef(0)

  useEffect(() => {
    fromRef.current = display
    startRef.current = null
    let raf

    function tick(ts) {
      if (!startRef.current) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = fromRef.current + (value - fromRef.current) * eased
      setDisplay(current)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <span>
      {prefix}
      {Math.round(display).toLocaleString('pt-BR')}
      {suffix}
    </span>
  )
}

/* ---------------- KpiCard ---------------- */
export function KpiCard({ icon: Icon, label, value, delta, color = 'green' }) {
  const colorMap = {
    green: 'text-green bg-green-dim',
    blue: 'text-blue bg-blue/10',
    yellow: 'text-yellow bg-yellow/10',
    indigo: 'text-indigo bg-indigo/10'
  }
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="card flex-1 min-w-[160px] px-5 py-4 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-text2 text-sm">{label}</span>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-text">
          <AnimatedCounter value={value} />
        </span>
        {delta && <span className="text-xs text-green">{delta}</span>}
      </div>
    </motion.div>
  )
}

/* ---------------- FadeIn ---------------- */
export function FadeIn({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ---------------- StaggerList ---------------- */
export function StaggerList({ children, className = '', staggerDelay = 0.04 }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: staggerDelay } }
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 }
}

export const MotionDiv = motion.div
