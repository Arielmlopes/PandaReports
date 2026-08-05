import { motion } from 'framer-motion'

export default function AppLoader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-bg gap-4">
      <motion.div
        className="w-12 h-12 bg-green rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-green/20"
        animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        🐼
      </motion.div>
      <motion.div
        className="w-32 h-1 bg-bg-3 rounded-full overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-green to-green-2 rounded-full"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  )
}
