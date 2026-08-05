import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Button, Field } from '@/components/ui'
import { generateProtocol } from '@/utils'

const FORM_TYPES = ['Post feed', 'Stories', 'Reels', 'Arte impressa', 'Logo', 'Vídeo', 'Outro']

export default function PublicBriefingPage() {
  const { clientId } = useParams()
  const [client, setClient] = useState(null)
  const [form, setForm] = useState({ title: '', type: '', description: '', deadline: '', ref_links: '', contact: '' })
  const [files, setFiles] = useState([])
  const [step, setStep] = useState('form') // form | submitting | success
  const [protocol, setProtocol] = useState('')

  useEffect(() => {
    supabase.from('clients').select('*').eq('id', clientId).single().then(({ data }) => setClient(data))
  }, [clientId])

  const submit = async () => {
    if (!form.title || !form.type) return
    setStep('submitting')
    const prot = generateProtocol()
    try {
      const fileRows = []
      for (const f of files) {
        const path = `briefings/${clientId}/${prot}/${f.name}`
        const { error: upErr } = await supabase.storage.from('uploads').upload(path, f, { upsert: true })
        if (!upErr) {
          const { data: pub } = supabase.storage.from('uploads').getPublicUrl(path)
          fileRows.push({ url: pub.publicUrl, name: f.name })
        }
      }
      await supabase.from('briefings').insert({
        client_id: clientId, protocol: prot, status: 'Recebido - Aguardando producao',
        ...form, files: fileRows
      })
      setProtocol(prot)
      setStep('success')
    } catch {
      setStep('form')
    }
  }

  if (!client) return <div className="min-h-screen flex items-center justify-center bg-bg"><div className="text-text-3 text-sm">Carregando...</div></div>

  return (
    <div className="min-h-screen bg-bg py-10 px-4" style={{ background: 'radial-gradient(ellipse at top, #111 0%, #0D0D0D 70%)' }}>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          {client.logo_url
            ? <img src={client.logo_url} className="w-14 h-14 rounded-2xl object-cover mx-auto mb-4" alt={client.name} />
            : <div className="w-14 h-14 rounded-2xl mx-auto mb-4" style={{ background: client.color }} />
          }
          <h1 className="text-lg font-bold">{client.name}</h1>
          <p className="text-text-3 text-sm mt-1">Formulário de solicitação de arte</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === 'success' ? (
            <motion.div key="success" className="card p-8 text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <motion.div className="text-5xl mb-4" animate={{ rotate: [0, 10, -10, 0] }} transition={{ delay: 0.3 }}>✅</motion.div>
              <h2 className="text-lg font-bold mb-2">Pedido enviado!</h2>
              <p className="text-text-3 text-sm mb-4">Nossa equipe irá analisar e entrar em contato em breve.</p>
              <div className="bg-bg-3 rounded-xl p-3 inline-block">
                <p className="text-xs text-text-3">Protocolo</p>
                <p className="font-mono font-bold text-green text-sm">{protocol}</p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" className="card p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Field label="Tipo de arte *">
                <div className="flex flex-wrap gap-2">
                  {FORM_TYPES.map(t => (
                    <button key={t} onClick={() => setForm(p => ({...p, type: t}))} className={`chip ${form.type === t ? 'chip-active' : 'chip-inactive'}`}>{t}</button>
                  ))}
                </div>
              </Field>
              <Field label="Título / Tema *">
                <input className="input" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="Ex: Post dia das mães" />
              </Field>
              <Field label="Descrição">
                <textarea className="input resize-none" rows={4} value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Descreva o que precisa, cores, textos, estilo..." />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prazo desejado">
                  <input className="input" type="date" value={form.deadline} onChange={e => setForm(p => ({...p, deadline: e.target.value}))} />
                </Field>
                <Field label="Contato WhatsApp">
                  <input className="input" value={form.contact} onChange={e => setForm(p => ({...p, contact: e.target.value}))} placeholder="(00) 00000-0000" />
                </Field>
              </div>
              <Field label="Referências / Links">
                <input className="input" value={form.ref_links} onChange={e => setForm(p => ({...p, ref_links: e.target.value}))} placeholder="Links de referência ou inspiração" />
              </Field>
              <Field label="Anexos" optional>
                <label className="flex items-center gap-2 border border-dashed border-border-2 rounded-lg px-4 py-3 cursor-pointer hover:border-green transition-colors">
                  <input type="file" multiple className="hidden" onChange={e => setFiles(Array.from(e.target.files))} />
                  <span className="text-text-3 text-sm">📎 Clique para anexar arquivos</span>
                  {files.length > 0 && <span className="ml-auto text-xs text-green">{files.length} arquivo(s)</span>}
                </label>
              </Field>
              <Button variant="green" className="w-full justify-center mt-2" loading={step === 'submitting'} onClick={submit}>
                Enviar pedido
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-[11px] text-text-3 mt-6">Panda Agency · Sistema de pedidos</p>
      </div>
    </div>
  )
}
