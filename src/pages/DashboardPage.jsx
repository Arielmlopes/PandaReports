import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as THREE from 'three'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { KpiCard, StaggerList, StaggerItem, HoverCard } from '@/components/ui/Animated'
import { Spinner } from '@/components/ui'

/* ── 3D Dashboard Header ─────────────────────────────────────── */
function HeroHeader() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = canvas.offsetWidth, H = canvas.offsetHeight
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100)
    camera.position.z = 12

    // Floating particles field
    const N = 120
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(N * 3)
    const vel = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      pos[i*3] = (Math.random()-0.5) * 30
      pos[i*3+1] = (Math.random()-0.5) * 8
      pos[i*3+2] = (Math.random()-0.5) * 10
      vel[i*3] = (Math.random()-0.5) * 0.01
      vel[i*3+1] = (Math.random()-0.5) * 0.008
      vel[i*3+2] = 0
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({ color: 0x6BAF45, size: 0.12, transparent: true, opacity: 0.8 })
    const points = new THREE.Points(geo, mat)
    scene.add(points)

    // Floating rings
    const rings = []
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(2 + i * 1.5, 0.04, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0x6BAF45, transparent: true, opacity: 0.12 - i * 0.03 })
      )
      r.rotation.x = Math.random() * Math.PI
      r.rotation.y = Math.random() * Math.PI
      scene.add(r); rings.push(r)
    }

    // Small panda in corner
    const pandaGroup = new THREE.Group()
    const pMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })
    const sp = (r, x, y, z, m) => { const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), m); mesh.position.set(x,y,z); pandaGroup.add(mesh) }
    sp(0.7, 0, 0, 0, pMat(0x111111))   // body
    sp(0.55, 0, 0.9, 0, pMat(0xf0f0f0)) // head
    sp(0.18, -0.38, 1.12, 0, pMat(0x111111)) // ear L
    sp(0.18, 0.38, 1.12, 0, pMat(0x111111)) // ear R
    sp(0.1, -0.18, 0.88, 0.5, pMat(0x111111)) // eye L
    sp(0.1, 0.18, 0.88, 0.5, pMat(0x111111)) // eye R
    sp(0.06, 0, 0.78, 0.54, pMat(0x222222)) // nose
    pandaGroup.position.set(8, 0, 0)
    scene.add(pandaGroup)
    const amb = new THREE.AmbientLight(0xffffff, 0.8)
    const dir = new THREE.DirectionalLight(0x6BAF45, 2)
    dir.position.set(5, 5, 5)
    scene.add(amb, dir)

    let frame = 0, animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      frame++
      const t = frame * 0.01
      // Drift particles
      const p = geo.attributes.position.array
      for (let i = 0; i < N; i++) {
        p[i*3] += vel[i*3]; p[i*3+1] += vel[i*3+1]
        if (p[i*3] > 15 || p[i*3] < -15) vel[i*3] *= -1
        if (p[i*3+1] > 4 || p[i*3+1] < -4) vel[i*3+1] *= -1
      }
      geo.attributes.position.needsUpdate = true
      // Rotate rings
      rings.forEach((r, i) => { r.rotation.x += 0.003 + i*0.001; r.rotation.y += 0.002 + i*0.0015 })
      // Animate panda
      pandaGroup.rotation.y = Math.sin(t * 0.7) * 0.3
      pandaGroup.position.y = Math.sin(t * 0.9) * 0.3
      renderer.render(scene, camera)
    }
    animate()
    return () => { cancelAnimationFrame(animId); renderer.dispose() }
  }, [])

  return (
    <div className="relative rounded-2xl overflow-hidden mb-6" style={{
      background: 'linear-gradient(135deg, #0f1f0f 0%, #141414 50%, #0D1A20 100%)',
      border: '1px solid rgba(107,175,69,0.2)', height: 140
    }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"/>
      <div className="absolute inset-0 flex flex-col justify-center px-8" style={{ pointerEvents: 'none' }}>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, type: 'spring' }}>
          <h1 className="font-bold" style={{ fontSize: 32, lineHeight: 1.1, textShadow: '0 0 30px rgba(107,175,69,0.3)' }}>
            <span style={{ color: '#6BAF45' }}>Panda</span>{' '}
            <span className="text-white">Reports</span>
          </h1>
          <p className="text-text-3 text-sm mt-1">Plataforma de relatórios da agência</p>
        </motion.div>
        <motion.div className="flex gap-2 mt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <span className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(107,175,69,0.12)', color: '#6BAF45', border: '1px solid rgba(107,175,69,0.25)' }}>
            🐼 Sistema ativo
          </span>
        </motion.div>
      </div>
    </div>
  )
}

/* ── Dashboard Page ──────────────────────────────────────────── */
export default function DashboardPage() {
  const { clients, dispatch } = useApp()
  const { isAdmin } = useAuth()
  const [matCounts, setMatCounts] = useState({})
  const [briefingCount, setBriefingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const [clientsRes, collabsRes, mats, briefs] = await Promise.all([
        supabase.from('clients').select('*').order('created_at'),
        supabase.from('collaborators').select('*').order('name'),
        supabase.from('materials').select('id,client_id'),
        supabase.from('briefings').select('id', { count: 'exact' }).eq('status', 'Recebido - Aguardando producao')
      ])
      if (clientsRes.data) dispatch({ type: 'SET_CLIENTS', payload: clientsRes.data })
      if (collabsRes.data) dispatch({ type: 'SET_COLLABORATORS', payload: collabsRes.data })
      if (mats.data) {
        const counts = {}
        mats.data.forEach(m => { counts[m.client_id] = (counts[m.client_id] || 0) + 1 })
        setMatCounts(counts)
      }
      setBriefingCount(briefs.count || 0)
      setLoading(false)
    }
    load()
  }, [dispatch])

  const totalMats = Object.values(matCounts).reduce((a, b) => a + b, 0)

  if (loading) return <div className="flex items-center justify-center h-40"><Spinner/></div>

  return (
    <div className="overflow-y-auto h-full">
      <HeroHeader/>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Clientes" value={clients.length} color="text-green" icon="🏢" index={0}/>
        <KpiCard label="Entregas" value={totalMats} sub="materiais totais" index={1}/>
        <KpiCard label="Pedidos" value={briefingCount} sub="aguardando" color="text-yellow-400" icon="📋" index={2}/>
        <KpiCard label="Fluxo ativo" value={clients.length} sub="projetos" color="text-blue-400" icon="🗂" index={3}/>
      </div>

      {/* Clients grid */}
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-text-2">Clientes</h2>
      </div>
      {clients.length === 0
        ? <div className="text-center py-16 text-text-3"><div className="text-4xl mb-3 opacity-30">🏢</div><p className="text-sm">Nenhum cliente ainda</p></div>
        : <StaggerList>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {clients.map(client => (
                <StaggerItem key={client.id}>
                  <HoverCard className="card p-4 cursor-pointer hover:border-border-2 transition-colors" onClick={() => navigate(`/clients/${client.id}`)}>
                    <div className="flex items-center gap-2.5 mb-3">
                      {client.logo_url
                        ? <img src={client.logo_url} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" alt={client.name}/>
                        : <span className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: client.color }}/>}
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{client.name}</div>
                        {client.seg && <div className="text-xs text-text-3 truncate">{client.seg}</div>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-3">{matCounts[client.id] || 0} materiais</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green/10 text-green">Ver →</span>
                    </div>
                    <div className="mt-3 h-0.5 bg-bg-4 rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ background: client.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (matCounts[client.id] || 0) * 5)}%` }}
                        transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}/>
                    </div>
                  </HoverCard>
                </StaggerItem>
              ))}
            </div>
          </StaggerList>}
    </div>
  )
}
