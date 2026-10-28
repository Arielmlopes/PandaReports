import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { supabase, uploadFile } from '../lib/supabase'
import { Button, Field, TextArea, Spinner } from '../components/ui'
import { generateProtocol, fileCategory } from '../utils'

const TYPE_OPTIONS = ['Post', 'Carrossel', 'Vídeo', 'Reels', 'Stories', 'Outro']

export default function PublicBriefingPage() {
  const { clientId } = useParams()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('Post')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [contact, setContact] = useState('')
  const [refLinks, setRefLinks] = useState('')
  const [files, setFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [protocol, setProtocol] = useState(null)

  useEffect(() => {
    // RPC devolve so nome/cor/logo; anon nao le a tabela clients.
    supabase.rpc('get_public_client', { p_id: clientId }).then(({ data }) => {
      setClient(data?.[0] || null)
      setLoading(false)
    })
  }, [clientId])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const proto = generateProtocol()
      const uploadedFiles = []
      for (const file of files) {
        const url = await uploadFile(file, `briefings/${proto}`)
        uploadedFiles.push({ url, name: file.name, file_type: fileCategory(file.type) })
      }

      const { error } = await supabase.from('briefings').insert({
        client_id: clientId,
        protocol: proto,
        title,
        type,
        description,
        deadline: deadline || null,
        contact,
        ref_links: refLinks,
        files: uploadedFiles,
        status: 'pending'
      })
      if (error) throw error
      setProtocol(proto)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Spinner />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text2">
        Cliente não encontrado.
      </div>
    )
  }

  if (protocol) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-8 max-w-sm w-full text-center flex flex-col items-center gap-3"
        >
          <CheckCircle2 size={40} className="text-green" />
          <h2 className="text-lg font-semibold text-text">Pedido enviado!</h2>
          <p className="text-text2 text-sm">Seu protocolo de acompanhamento é:</p>
          <p className="text-green font-mono font-semibold text-lg">{protocol}</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg py-10 px-4">
      <div className="max-w-lg mx-auto flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-semibold"
              style={{ background: client.color || 'var(--green)' }}
            >
              {client.name?.[0]?.toUpperCase()}
            </div>
          )}
          <h1 className="text-lg font-semibold text-text">{client.name}</h1>
          <p className="text-text2 text-sm">Solicitar novo material</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${
                  type === t ? 'bg-green-dim text-green border-green/30' : 'bg-bg4 text-text2 border-border2'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <Field label="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <TextArea label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
          <Field label="Prazo desejado" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <Field label="WhatsApp para contato" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="(00) 00000-0000" />
          <TextArea label="Referências (links)" value={refLinks} onChange={(e) => setRefLinks(e.target.value)} rows={2} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-text2 font-medium">Anexos</span>
            <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files))} className="text-sm text-text2" />
          </label>

          <Button type="submit" loading={submitting} className="w-full mt-2">
            Enviar pedido
          </Button>
        </form>
      </div>
    </div>
  )
}
