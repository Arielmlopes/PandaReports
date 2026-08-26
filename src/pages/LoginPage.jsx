import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogIn, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useApp } from '../contexts/AppContext'
import { Button, Field, Checkbox } from '../components/ui'
import { publicUrlFor } from '../lib/supabase'

export default function LoginPage() {
  const { login, getSavedSessions, removeSavedSession } = useAuth()
  const { settings, pushToast } = useApp()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const savedSessions = getSavedSessions()
  const loginBg = publicUrlFor(settings.login_bg_image?.logo_url)
  const logoUrl = publicUrlFor(settings.system_logo?.logo_url)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password, remember)
      navigate('/dashboard')
    } catch (err) {
      setError('E-mail ou senha inválidos.')
      pushToast({ message: 'Falha no login.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-bg">
      {/* Lado esquerdo */}
      <div
        className="relative w-full md:w-[60%] h-56 md:h-screen flex items-end p-8 overflow-hidden"
        style={
          loginBg
            ? { backgroundImage: `url(${loginBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: 'linear-gradient(135deg, #0F0F0F, #1a2a0f)' }
        }
      >
        {!loginBg && <AnimatedGradientBlobs />}
        <div className="absolute inset-0 bg-black/40" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="relative z-10"
        >
          <h1 className="text-white text-2xl md:text-3xl font-bold">Panda Agency</h1>
          <p className="text-white/70 text-sm mt-1">Relatórios e gestão de entregas, em um só lugar.</p>
        </motion.div>
      </div>

      {/* Lado direito */}
      <div className="w-full md:w-[40%] flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm flex flex-col gap-6"
        >
          <div className="flex flex-col items-center gap-3 mb-2">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-14 h-14 object-contain" />
            ) : (
              <span className="text-4xl">🐼</span>
            )}
            <h2 className="text-xl font-semibold text-text">Bem-vindo de volta</h2>
          </div>

          {savedSessions.length > 0 && (
            <div className="flex flex-col gap-2">
              {savedSessions.map((s) => (
                <button
                  key={s.email}
                  type="button"
                  onClick={() => setEmail(s.email)}
                  className="card flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-green-dim text-green flex items-center justify-center flex-shrink-0">
                    <User size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text truncate">{s.email}</p>
                    <p className="text-xs text-text3">Clique para entrar</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeSavedSession(s.email)
                    }}
                    className="text-text3 hover:text-red text-xs"
                  >
                    remover
                  </button>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@pandaagency.com"
              required
            />
            <Field
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <div className="flex items-center justify-between">
              <Checkbox checked={remember} onChange={setRemember} label="Lembrar acesso" />
            </div>
            {error && <p className="text-xs text-red">{error}</p>}
            <Button type="submit" icon={LogIn} loading={loading} className="w-full mt-1">
              Entrar
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  )
}

function AnimatedGradientBlobs() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-96 h-96 rounded-full bg-green/10 blur-3xl -top-20 -left-20"
      />
      <motion.div
        animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-80 h-80 rounded-full bg-green2/10 blur-3xl bottom-0 right-0"
      />
    </div>
  )
}
