import { useEffect, useState } from 'react'
import { Image as ImageIcon, UserPlus, Building2, Users, Trash2 } from 'lucide-react'
import { supabase, publicUrlFor, uploadFile } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import { Button, Field, Select, Spinner } from '../components/ui'

const ROLES = ['admin', 'member', 'freelancer', 'client']
const CLIENT_COLORS = ['#5DD62C', '#3B82F6', '#EAB308', '#6366F1', '#EF4444', '#EC4899', '#14B8A6']

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-green" />
        <h3 className="font-medium text-text">{title}</h3>
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const { settings, loadSettings, clients, loadClients, collaborators, loadCollaborators, pushToast } = useApp()
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  const loadUsers = async () => {
    setLoadingUsers(true)
    const { data } = await supabase.from('user_roles').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoadingUsers(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function handleUploadSetting(key, file) {
    if (!file) return
    const url = await uploadFile(file, 'settings')
    await supabase.from('settings').upsert({ key, logo_url: url }, { onConflict: 'key' })
    await loadSettings()
    pushToast({ message: 'Imagem atualizada.', type: 'success' })
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-text">Configurações</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <Section icon={ImageIcon} title="Logo do sistema">
          <ImageUploadField
            currentUrl={publicUrlFor(settings.system_logo?.logo_url)}
            onUpload={(file) => handleUploadSetting('system_logo', file)}
          />
        </Section>

        <Section icon={ImageIcon} title="Imagem do Login">
          <ImageUploadField
            currentUrl={publicUrlFor(settings.login_bg_image?.logo_url)}
            onUpload={(file) => handleUploadSetting('login_bg_image', file)}
          />
        </Section>

        <Section icon={ImageIcon} title="Favicon">
          <ImageUploadField
            currentUrl={publicUrlFor(settings.favicon?.logo_url)}
            onUpload={(file) => handleUploadSetting('favicon', file)}
          />
        </Section>
      </div>

      <Section icon={UserPlus} title="Novo usuário">
        <NewUserForm onCreated={loadUsers} />
      </Section>

      <Section icon={Users} title="Usuários">
        {loadingUsers ? (
          <Spinner />
        ) : (
          <div className="flex flex-col gap-2">
            {users.map((u) => (
              <UserRow key={u.id} user={u} onChanged={loadUsers} />
            ))}
          </div>
        )}
      </Section>

      <Section icon={Building2} title="Novo cliente">
        <NewClientForm onCreated={loadClients} />
      </Section>

      <Section icon={Building2} title="Clientes">
        <div className="flex flex-col gap-2">
          {clients.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2 bg-bg4 rounded-input">
              <span className="w-3 h-3 rounded-full" style={{ background: c.color || 'var(--green)' }} />
              <span className="text-sm text-text flex-1">{c.name}</span>
              <span className="text-xs text-text3">{c.seg}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Users} title="Novo colaborador">
        <NewCollaboratorForm onCreated={loadCollaborators} />
      </Section>

      <Section icon={Users} title="Colaboradores">
        <div className="flex flex-col gap-2">
          {collaborators.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2 bg-bg4 rounded-input">
              <span className="text-sm text-text flex-1">{c.name}</span>
              {c.email && <span className="text-xs text-text3">{c.email}</span>}
              <span className="text-xs text-text3">{c.role}</span>
              <button
                onClick={async () => {
                  await supabase.from('collaborators').delete().eq('id', c.id)
                  loadCollaborators()
                }}
                className="text-text3 hover:text-red"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function ImageUploadField({ currentUrl, onUpload }) {
  const [uploading, setUploading] = useState(false)
  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 rounded-input bg-bg4 flex items-center justify-center overflow-hidden flex-shrink-0">
        {currentUrl ? (
          <img src={currentUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={22} className="text-text3" />
        )}
      </div>
      <label className="inline-flex items-center gap-2 rounded-input font-medium text-sm px-4 py-2.5 bg-bg4 text-text hover:bg-bg5 border border-border2 cursor-pointer transition-colors duration-150">
        {uploading ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : 'Enviar imagem'}
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            setUploading(true)
            try {
              await onUpload(file)
            } finally {
              setUploading(false)
            }
          }}
        />
      </label>
    </div>
  )
}

function NewUserForm({ onCreated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('member')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError
      const { error } = await supabase.from('user_roles').insert({ email, role })
      if (error) throw error
      setEmail('')
      setPassword('')
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-3 items-end">
      <Field label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Field label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
      <Button type="submit" loading={saving}>
        Criar usuário
      </Button>
    </form>
  )
}

function UserRow({ user, onChanged }) {
  async function updateRole(role) {
    await supabase.from('user_roles').update({ role }).eq('id', user.id)
    onChanged()
  }
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-bg4 rounded-input">
      <span className="text-sm text-text flex-1 truncate">{user.email}</span>
      <select
        value={user.role}
        onChange={(e) => updateRole(e.target.value)}
        className="input-base text-xs px-2 py-1"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  )
}

function NewClientForm({ onCreated }) {
  const [name, setName] = useState('')
  const [seg, setSeg] = useState('')
  const [resp, setResp] = useState('')
  const [color, setColor] = useState(CLIENT_COLORS[0])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from('clients').insert({ name, seg, resp, color })
      if (error) throw error
      setName('')
      setSeg('')
      setResp('')
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid md:grid-cols-3 gap-3">
        <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <Field label="Segmento" value={seg} onChange={(e) => setSeg(e.target.value)} />
        <Field label="Responsável" value={resp} onChange={(e) => setResp(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        {CLIENT_COLORS.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => setColor(c)}
            className="w-6 h-6 rounded-full border-2"
            style={{ background: c, borderColor: color === c ? '#fff' : 'transparent' }}
          />
        ))}
        <Button type="submit" loading={saving} className="ml-auto">
          Criar cliente
        </Button>
      </div>
    </form>
  )
}

function NewCollaboratorForm({ onCreated }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from('collaborators').insert({ name, role, email: email || null })
      if (error) throw error
      setName('')
      setRole('')
      setEmail('')
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-3 items-end">
      <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
      <Field label="Função" value={role} onChange={(e) => setRole(e.target.value)} />
      <Field
        label="E-mail (para notificações)"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        hint="Só recebe @menções se tiver login"
      />
      <Button type="submit" loading={saving}>
        Adicionar
      </Button>
    </form>
  )
}
