import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Button, Field } from '@/components/ui'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

const SAVED_KEY = 'panda_creds'

export default function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedCreds, setSavedCreds] = useState(null)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || 'null')
      if (saved) { setSavedCreds(saved); setEmail(saved.email); setPassword(saved.password) }
    } catch {}
  }, [user, navigate])

  const handleLogin = async (e) => {
    e?.preventDefault()
    if (!email || !password) { setError('Preencha e-mail e senha'); return }
    setLoading(true); setError('')
    try {
      const { role } = await login(email, password)
      if (remember) localStorage.setItem(SAVED_KEY, JSON.stringify({ email, password }))
      else localStorage.removeItem(SAVED_KEY)
      navigate('/', { replace: true })
    } catch (err) {
      setError('E-mail ou senha incorretos')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 30% 50%, #1a2a1a 0%, #0D0D0D 60%)' }}>

      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #6BAF45, transparent)' }}
          animate={{ scale: [1, 1.2, 1], x: [0, 20, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }}
          animate={{ scale: [1.2, 1, 1.2], x: [0, -15, 0], y: [0, 15, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-sm mx-4"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            className="w-14 h-14 rounded-2xl bg-green mx-auto mb-4 flex items-center justify-center text-2xl shadow-lg shadow-green/20"
            whileHover={{ rotate: [0, -5, 5, 0], scale: 1.05 }}
            transition={{ duration: 0.5 }}
          >
            🐼
          </motion.div>
          <h1 className="text-xl font-bold">
            <span className="text-white">Panda </span>
            <span className="text-green">Reports</span>
          </h1>
          <p className="text-text-3 text-xs mt-1">Plataforma de relatórios premium</p>
        </div>

        {/* Card */}
        <div className="card p-6" style={{ backdropFilter: 'blur(20px)', background: 'rgba(20,20,20,0.8)' }}>

          {/* Saved session */}
          {savedCreds && (
            <motion.button
              className="w-full mb-4 p-3 rounded-xl bg-green/10 border border-green/25 text-left hover:border-green/40 transition-colors"
              onClick={() => handleLogin()}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="text-[10px] text-green font-bold uppercase tracking-wide mb-0.5">✓ Sessão salva</div>
              <div className="text-sm font-medium">{savedCreds.email}</div>
              <div className="text-xs text-text-3">Clique para entrar automaticamente</div>
            </motion.button>
          )}

          {/* Error */}
          {error && (
            <motion.div
              className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleLogin}>
            <Field label="E-mail">
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                <input className="input pl-9" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
            </Field>
            <Field label="Senha">
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                <input className="input pl-9 pr-9" type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text transition-colors">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-3.5 h-3.5 accent-green" />
              <span className="text-xs text-text-2">Lembrar minha senha</span>
            </label>

            <motion.button
              type="submit"
              className="btn btn-green w-full justify-center py-2.5 text-sm font-bold"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? <><span className="spinner border-black/20 border-t-black" /> Entrando…</> : 'Entrar na plataforma'}
            </motion.button>
          </form>

          <p className="text-center text-[11px] text-text-3 mt-4">Panda Agency · Plataforma interna</p>
        </div>
      </motion.div>
    </div>
  )
}
