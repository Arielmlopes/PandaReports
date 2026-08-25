import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button, Field, Toggle, Modal, ColorPicker } from '@/components/ui'
import { PALETTE } from '@/utils'

export default function SettingsPage() {
  const { clients, collaborators, dispatch, showToast } = useApp()
  const { user, logout } = useAuth()
  const [userRoles, setUserRoles] = useState([])
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'member' })
  const [newClient, setNewClient] = useState({ name: '', seg: '', resp: '', color: PALETTE[0] })
  const [newCollab, setNewCollab] = useState({ name: '', role: '' })
  const [addingUser, setAddingUser] = useState(false)

  useEffect(() => {
    supabase.from('user_roles').select('*').order('created_at').then(({ data }) => setUserRoles(data || []))
  }, [])

  const createUser = async () => {
    if (!newUser.email || !newUser.password) { showToast('Preencha e-mail e senha', 'error'); return }
    setAddingUser(true)
    try {
      await supabase.auth.signUp({ email: newUser.email, password: newUser.password })
      const { data } = await supabase.from('user_roles').upsert({ email: newUser.email, role: newUser.role }, { onConflict: 'email' }).select().single()
      if (data) setUserRoles(prev => [...prev.filter(r => r.email !== data.email), data])
      setNewUser({ email: '', password: '', role: 'member' })
      showToast('Usuário criado!')
    } catch (e) { showToast('Erro ao criar usuário', 'error') }
    setAddingUser(false)
  }

  const createClient = async () => {
    if (!newClient.name) { showToast('Informe o nome', 'error'); return }
    const { data, error } = await supabase.from('clients').insert(newClient).select().single()
    if (error) { showToast('Erro ao criar', 'error'); return }
    dispatch({ type: 'ADD_CLIENT', payload: data })
    setNewClient({ name: '', seg: '', resp: '', color: PALETTE[0] })
    showToast('Cliente criado!')
  }

  const createCollab = async () => {
    if (!newCollab.name) { showToast('Informe o nome', 'error'); return }
    const { data, error } = await supabase.from('collaborators').insert(newCollab).select().single()
    if (error) { showToast('Erro ao criar', 'error'); return }
    dispatch({ type: 'ADD_COLLABORATOR', payload: data })
    setNewCollab({ name: '', role: '' })
    showToast('Colaborador adicionado!')
  }

  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('sys_logo') || '')
  const [logoUploading, setLogoUploading] = useState(false)

  const uploadLogo = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setLogoUploading(true)
    const path = `logos/system_logo_${Date.now()}.jpg`
    const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('uploads').getPublicUrl(path)
      await supabase.from('settings').upsert({ key: 'system_logo', logo_url: data.publicUrl }, { onConflict: 'key' })
      setLogoUrl(data.publicUrl)
      localStorage.setItem('sys_logo', data.publicUrl)
      showToast('Logo atualizada! Recarregue a página.')
    } else showToast('Erro ao enviar logo', 'error')
    setLogoUploading(false)
  }

  const removeLogo = async () => {
    await supabase.from('settings').delete().eq('key', 'system_logo')
    setLogoUrl(''); localStorage.removeItem('sys_logo')
    showToast('Logo removida')
  }

  const [loginImageUrl, setLoginImageUrl] = useState(() => localStorage.getItem('sys_login_image') || '')
  const [loginImageUploading, setLoginImageUploading] = useState(false)

  const uploadLoginImage = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setLoginImageUploading(true)
    const path = `login/login_image_${Date.now()}.jpg`
    const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('uploads').getPublicUrl(path)
      await supabase.from('settings').upsert({ key: 'login_image', logo_url: data.publicUrl }, { onConflict: 'key' })
      setLoginImageUrl(data.publicUrl)
      localStorage.setItem('sys_login_image', data.publicUrl)
      showToast('Imagem da tela de login atualizada!')
    } else showToast('Erro ao enviar imagem', 'error')
    setLoginImageUploading(false)
  }

  const removeLoginImage = async () => {
    await supabase.from('settings').delete().eq('key', 'login_image')
    setLoginImageUrl(''); localStorage.removeItem('sys_login_image')
    showToast('Imagem removida — voltou ao padrão')
  }

  const Section = ({ title, children }) => (
    <motion.div className="card p-5 mb-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      {children}
    </motion.div>
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>⚙️ Configurações</h1>

      {/* Logo do sistema */}
      <Section title="🖼 Logo do sistema">
        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>Aparece na sidebar. Substitui o nome "Panda Reports" quando definida.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {logoUrl
            ? <img src={logoUrl} alt="Logo atual" style={{ height: 48, maxWidth: 160, objectFit: 'contain', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}/>
            : <div style={{ width: 48, height: 48, borderRadius: 8, background: '#6BAF45', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🐼</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(107,175,69,0.1)', border: '1px solid rgba(107,175,69,0.3)', color: '#6BAF45', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <input type="file" accept="image/*" className="hidden" onChange={uploadLogo}/>
              {logoUploading ? '⏳ Enviando...' : '📤 Enviar logo'}
            </label>
            {logoUrl && <button onClick={removeLogo} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Remover</button>}
          </div>
        </div>
      </Section>

      {/* Imagem da tela de login */}
      <Section title="🖼 Imagem da tela de login">
        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>Aparece no card do lado esquerdo da tela de login. Se não definida, usa o visual padrão com o panda.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {loginImageUrl
            ? <img src={loginImageUrl} alt="Imagem de login atual" style={{ width: 90, height: 130, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }}/>
            : <div style={{ width: 90, height: 130, borderRadius: 10, background: '#141414', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🐼</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(107,175,69,0.1)', border: '1px solid rgba(107,175,69,0.3)', color: '#6BAF45', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <input type="file" accept="image/*" className="hidden" onChange={uploadLoginImage}/>
              {loginImageUploading ? '⏳ Enviando...' : '📤 Enviar imagem'}
            </label>
            {loginImageUrl && <button onClick={removeLoginImage} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Remover</button>}
          </div>
        </div>
      </Section>

      <Section title="Novo usuário">
        <Field label="E-mail"><input className="input" type="email" value={newUser.email} onChange={e => setNewUser(p => ({...p, email: e.target.value}))} placeholder="email@exemplo.com" /></Field>
        <Field label="Senha inicial"><input className="input" type="password" value={newUser.password} onChange={e => setNewUser(p => ({...p, password: e.target.value}))} placeholder="mínimo 6 caracteres" /></Field>
        <Field label="Função">
          <select className="input" value={newUser.role} onChange={e => setNewUser(p => ({...p, role: e.target.value}))}>
            <option value="admin">Admin — acesso total</option>
            <option value="member">Membro — só Fluxo</option>
            <option value="freelancer">Freelancer — cards atribuídos</option>
            <option value="client">Cliente — portal próprio</option>
          </select>
        </Field>
        <Button variant="green" loading={addingUser} onClick={createUser}>Criar usuário</Button>

        {userRoles.length > 0 && (
          <div className="mt-4 space-y-2">
            {userRoles.map(r => (
              <div key={r.id} className="flex items-center gap-3 bg-bg-3 rounded-lg px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">{r.email[0].toUpperCase()}</div>
                <span className="flex-1 text-xs truncate">{r.email}</span>
                <select className="text-xs bg-bg-4 border border-border rounded px-1.5 py-1 text-text-3" value={r.role} onChange={async e => {
                  await supabase.from('user_roles').update({ role: e.target.value }).eq('id', r.id)
                  setUserRoles(prev => prev.map(u => u.id === r.id ? {...u, role: e.target.value} : u))
                  showToast('Função atualizada')
                }}>
                  <option value="admin">Admin</option>
                  <option value="member">Membro</option>
                  <option value="freelancer">Freelancer</option>
                  <option value="client">Cliente</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Novo cliente">
        <Field label="Nome *"><input className="input" value={newClient.name} onChange={e => setNewClient(p => ({...p, name: e.target.value}))} placeholder="Nome do cliente" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Segmento"><input className="input" value={newClient.seg} onChange={e => setNewClient(p => ({...p, seg: e.target.value}))} placeholder="Ex: Saúde" /></Field>
          <Field label="Responsável"><input className="input" value={newClient.resp} onChange={e => setNewClient(p => ({...p, resp: e.target.value}))} placeholder="Ex: Ana Lima" /></Field>
        </div>
        <Field label="Cor"><ColorPicker value={newClient.color} onChange={c => setNewClient(p => ({...p, color: c}))} /></Field>
        <Button variant="green" className="mt-3" onClick={createClient}>Criar cliente</Button>
      </Section>

      <Section title="Novo colaborador">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome *"><input className="input" value={newCollab.name} onChange={e => setNewCollab(p => ({...p, name: e.target.value}))} placeholder="Nome" /></Field>
          <Field label="Função"><input className="input" value={newCollab.role} onChange={e => setNewCollab(p => ({...p, role: e.target.value}))} placeholder="Ex: Designer" /></Field>
        </div>
        <Button variant="indigo" onClick={createCollab}>Adicionar colaborador</Button>
        <div className="mt-3 space-y-1.5">
          {collaborators.map(c => (
            <div key={c.id} className="flex items-center gap-2 bg-bg-3 rounded-lg px-3 py-2">
              <div className="w-5 h-5 rounded-full bg-indigo-500/80 flex items-center justify-center text-[9px] font-bold text-white">{c.name[0]}</div>
              <span className="flex-1 text-xs">{c.name}</span>
              {c.role && <span className="text-[10px] text-text-3">{c.role}</span>}
              <button className="text-text-3 hover:text-red-400 transition-colors text-xs" onClick={() => {
                supabase.from('collaborators').delete().eq('id', c.id).then(() => { dispatch({ type: 'DELETE_COLLABORATOR', payload: c.id }); showToast('Removido') })
              }}>✕</button>
            </div>
          ))}
        </div>
      </Section>

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{user?.email}</p>
            <p className="text-xs text-text-3">Conectado</p>
          </div>
          <Button variant="red" size="sm" onClick={logout}>Sair</Button>
        </div>
      </div>
    </div>
  )
}
