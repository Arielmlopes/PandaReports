import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Field } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react'

const SAVED_KEY = 'panda_creds'
const LOGIN_IMG_KEY = 'sys_login_image'

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
  const [loginImage, setLoginImage] = useState(() => localStorage.getItem(LOGIN_IMG_KEY) || '')

  useEffect(() => {
    if (user) navigate('/', { replace: true })
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || 'null')
      if (saved) { setSavedCreds(saved); setEmail(saved.email); setPassword(saved.password) }
    } catch {}
  }, [user, navigate])

  useEffect(() => {
    supabase.from('settings').select('logo_url').eq('key', 'login_image').single().then(({ data }) => {
      if (data?.logo_url) { setLoginImage(data.logo_url); localStorage.setItem(LOGIN_IMG_KEY, data.logo_url) }
    })
  }, [])

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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0D0D0D] p-6 md:p-10 overflow-y-auto">
      <div className="w-full max-w-5xl flex flex-col md:flex-row items-center gap-10 md:gap-16">

        {/* Left — visual card */}
        <motion.div
          className="relative w-full md:w-[340px] h-[240px] md:h-[520px] rounded-[28px] overflow-hidden flex-shrink-0 border border-white/10"
          initial={{ opacity: 0, x: -24, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        >
          {loginImage ? (
            <img src={loginImage} alt="Panda Reports" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 20%, #1a2a1a 0%, #0D0D0D 70%)' }}>
              <motion.div
                className="absolute top-1/4 left-1/4 w-40 h-40 rounded-full opacity-20"
                style={{ background: 'radial-gradient(circle, #6BAF45, transparent)' }}
                animate={{ scale: [1, 1.25, 1], x: [0, 20, 0], y: [0, -20, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute bottom-1/4 right-1/4 w-32 h-32 rounded-full opacity-15"
                style={{ background: 'radial-gradient(circle, #7DC952, transparent)' }}
                animate={{ scale: [1.2, 1, 1.2], x: [0, -15, 0], y: [0, 15, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="w-20 h-20 rounded-3xl bg-green flex items-center justify-center text-4xl shadow-lg shadow-green/20"
                  whileHover={{ rotate: [0, -5, 5, 0], scale: 1.05 }}
                  transition={{ duration: 0.5 }}
                >
                  🐼
                </motion.div>
              </div>
            </div>
          )}

          {/* Badge top-left */}
          <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10">
            <span className="text-sm leading-none">🐼</span>
            <span className="text-[11px] font-semibold text-white tracking-wide">Panda</span>
          </div>

          {/* Caption bottom */}
          <div className="absolute bottom-0 inset-x-0 p-4 pt-10" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }}>
            <p className="text-[11px] text-white/70 font-medium">Panda Reports</p>
            <p className="text-[10px] text-white/40">Plataforma de relatórios premium</p>
          </div>
        </motion.div>

        {/* Right — form */}
        <motion.div
          className="flex-1 w-full max-w-sm mx-auto md:mx-0"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 24 }}
        >
          <div className="flex items-center gap-1.5 mb-3 text-green text-[11px] font-semibold uppercase tracking-wide">
            <Sparkles size={12} /> Acesso à plataforma
          </div>
          <h1 className="text-2xl md:text-[28px] font-bold leading-tight text-white mb-1">
            Bem-vindo de volta<br />à Panda Reports
          </h1>
          <p className="text-text-3 text-sm mb-7">Entre com sua conta para continuar</p>

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

            <label className="flex items-center gap-2 mb-5 cursor-pointer">
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
              {loading ? <><span className="spinner border-black/20 border-t-black" /> Entrando…</> : <>Entrar na plataforma <ArrowRight size={15} /></>}
            </motion.button>
          </form>

          <p className="text-center text-[11px] text-text-3 mt-5">Panda Agency · Plataforma interna</p>
        </motion.div>
      </div>
    </div>
  )
}
