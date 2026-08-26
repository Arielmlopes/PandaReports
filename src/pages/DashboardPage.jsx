import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { Users, PackageCheck, Clock, KanbanSquare } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useApp } from '../contexts/AppContext'
import { supabase } from '../lib/supabase'
import { KpiCard, StaggerList, staggerItem, MotionDiv } from '../components/ui/Animated'
import { HoverCard } from '../components/ui/Animated'
import { Badge, Spinner } from '../components/ui'
import { greeting } from '../utils'

function DashboardHeader3D({ name }) {
  const canvasRef = useRef(null)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reducedMotion || !canvasRef.current) return
    const canvas = canvasRef.current
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 50)
    camera.position.set(0, 0, 6)

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const count = 60
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10
      positions[i * 3 + 1] = (Math.random() - 0.5) * 4
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({ color: 0x5dd62c, size: 0.05, transparent: true, opacity: 0.6 })
    const points = new THREE.Points(geo, mat)
    scene.add(points)

    let raf
    function animate(t) {
      points.rotation.y = t / 8000
      points.position.y = Math.sin(t / 2000) * 0.1
      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      renderer.dispose()
    }
  }, [reducedMotion])

  return (
    <div className="relative rounded-card overflow-hidden bg-gradient-to-br from-bg3 to-bg2 border border-border px-6 py-8 mb-6">
      {!reducedMotion && <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />}
      <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text">
            {greeting()}, {name}
          </h1>
          <p className="text-text2 text-sm mt-1">Aqui está o resumo da sua operação hoje.</p>
        </div>
        <Badge color="green">● Sistema ativo</Badge>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { clients } = useApp()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ deliveries: 0, pending: 0, cards: 0 })
  const [clientCounts, setClientCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      setLoading(true)
      const [{ count: deliveries }, { count: pending }, { count: cards }, { data: materials }] = await Promise.all([
        supabase.from('materials').select('*', { count: 'exact', head: true }),
        supabase.from('briefings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('kanban_cards').select('*', { count: 'exact', head: true }),
        supabase.from('materials').select('client_id')
      ])
      const counts = {}
      ;(materials || []).forEach((m) => {
        counts[m.client_id] = (counts[m.client_id] || 0) + 1
      })
      setClientCounts(counts)
      setStats({ deliveries: deliveries || 0, pending: pending || 0, cards: cards || 0 })
      setLoading(false)
    }
    loadStats()
  }, [])

  const name = user?.email?.split('@')[0] || 'usuário'
  const maxCount = Math.max(1, ...Object.values(clientCounts))

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <DashboardHeader3D name={name} />

      <div className="flex flex-wrap gap-4 mb-8">
        <KpiCard icon={Users} label="Clientes" value={clients.length} color="green" />
        <KpiCard icon={PackageCheck} label="Entregas totais" value={stats.deliveries} color="blue" />
        <KpiCard icon={Clock} label="Pedidos pendentes" value={stats.pending} color="yellow" />
        <KpiCard icon={KanbanSquare} label="Cards no Fluxo" value={stats.cards} color="indigo" />
      </div>

      <h2 className="text-lg font-semibold text-text mb-4">Clientes</h2>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {clients.map((c) => {
            const count = clientCounts[c.id] || 0
            const pct = Math.round((count / maxCount) * 100)
            return (
              <MotionDiv key={c.id} variants={staggerItem}>
                <HoverCard onClick={() => navigate(`/clients/${c.id}`)} className="p-4 cursor-pointer flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name} loading="lazy" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                        style={{ background: c.color || 'var(--green)' }}
                      >
                        {c.name?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-text font-medium truncate">{c.name}</p>
                      <p className="text-text3 text-xs truncate">{c.seg || 'Sem segmento'}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-text3 mb-1">
                      <span>{count} materiais</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-bg4 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: c.color || 'var(--green)' }}
                      />
                    </div>
                  </div>
                </HoverCard>
              </MotionDiv>
            )
          })}
        </StaggerList>
      )}
    </div>
  )
}
