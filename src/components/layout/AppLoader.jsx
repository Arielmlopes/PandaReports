import { motion } from 'framer-motion'

export function AppLoader() {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-bg">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="w-10 h-10 rounded-full border-2 border-green border-t-transparent"
      />
    </div>
  )
}
