import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'

export default function SplashScreen({ onComplete }) {
  const canvasRef = useRef(null)
  const [phase, setPhase] = useState('loading') // loading | reveal | done

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = window.innerWidth, H = window.innerHeight

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000)
    camera.position.z = 22

    // ── Build panda geometry from spheres ──────────────────
    const group = new THREE.Group()
    scene.add(group)

    const mat = (color, emissive = 0x000000) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.3, roughness: 0.4, metalness: 0.1 })

    const sphere = (r, x, y, z, m) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 32), m)
      mesh.position.set(x, y, z); group.add(mesh); return mesh
    }

    // Body
    sphere(5, 0, -3, 0, mat(0x111111))
    // Head
    sphere(3.5, 0, 3.5, 0, mat(0xfafafa))
    // Ears
    sphere(1.2, -3, 6.2, 0, mat(0x111111))
    sphere(1.2, 3, 6.2, 0, mat(0x111111))
    // Eyes
    sphere(0.7, -1.2, 4.2, 3, mat(0x111111))
    sphere(0.7, 1.2, 4.2, 3, mat(0x111111))
    // Eye shine
    sphere(0.25, -0.95, 4.4, 3.5, mat(0xffffff, 0xffffff))
    sphere(0.25, 1.45, 4.4, 3.5, mat(0xffffff, 0xffffff))
    // Nose
    sphere(0.4, 0, 3.1, 3.3, mat(0x222222))
    // Eye patches
    sphere(1.1, -1.2, 4.1, 1.5, mat(0x1a1a1a))
    sphere(1.1, 1.2, 4.1, 1.5, mat(0x1a1a1a))
    // Arms
    sphere(1.5, -5.5, -1, 0, mat(0x111111))
    sphere(1.5, 5.5, -1, 0, mat(0x111111))
    // Legs
    sphere(1.6, -2.5, -7.5, 0, mat(0x111111))
    sphere(1.6, 2.5, -7.5, 0, mat(0x111111))
    // Belly
    sphere(3, 0, -2, 1.5, mat(0xdddddd))

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0x6BAF45, 2.5)
    dirLight.position.set(5, 10, 8)
    scene.add(dirLight)
    const rimLight = new THREE.DirectionalLight(0x4488ff, 1)
    rimLight.position.set(-8, 5, -5)
    scene.add(rimLight)
    const fillLight = new THREE.PointLight(0xffffff, 1, 40)
    fillLight.position.set(0, 0, 15)
    scene.add(fillLight)

    // Particle ring
    const N = 300
    const pGeo = new THREE.BufferGeometry()
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const r = 12 + Math.random() * 4
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = (Math.random() - 0.5) * 6
      pos[i * 3 + 2] = Math.sin(a) * r
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const pMat = new THREE.PointsMaterial({ color: 0x6BAF45, size: 0.18, transparent: true, opacity: 0.7 })
    scene.add(new THREE.Points(pGeo, pMat))

    // Animate
    let frame = 0, animId
    const startY = -25
    group.position.y = startY
    group.scale.setScalar(0.01)

    const animate = () => {
      animId = requestAnimationFrame(animate)
      frame++
      const t = frame / 60
      // Entry animation
      if (frame < 80) {
        const p = Math.min(1, frame / 60)
        const ease = 1 - Math.pow(1 - p, 3)
        group.position.y = startY + ease * 25
        group.scale.setScalar(0.01 + ease * 0.99)
      }
      // Idle float + rotate
      group.rotation.y = t * 0.6
      group.position.y = Math.sin(t * 0.8) * 0.8
      // Particle ring
      pMat.opacity = 0.4 + Math.sin(t * 1.2) * 0.3
      renderer.render(scene, camera)
    }
    animate()

    const t1 = setTimeout(() => setPhase('reveal'), 1400)
    const t2 = setTimeout(() => { setPhase('done'); onComplete?.() }, 3200)
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      clearTimeout(t1); clearTimeout(t2)
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
    }
  }, [onComplete])

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: 'radial-gradient(ellipse at 40% 60%, #0f1f0f 0%, #0D0D0D 70%)' }}
          exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.7, ease: 'easeInOut' }}>
          {/* Three.js canvas */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"/>

          {/* Overlay text */}
          <AnimatePresence>
            {phase === 'reveal' && (
              <motion.div className="relative z-10 text-center pointer-events-none"
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.5, type: 'spring', stiffness: 180 }}>
                <motion.h1 className="font-bold tracking-tight"
                  style={{ fontSize: 52, lineHeight: 1, textShadow: '0 0 40px rgba(107,175,69,0.4)' }}
                  initial={{ letterSpacing: '0.4em', opacity: 0 }}
                  animate={{ letterSpacing: '-0.02em', opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.1 }}>
                  <span className="text-white">Panda </span>
                  <span style={{ color: '#6BAF45' }}>Reports</span>
                </motion.h1>
                <motion.p className="text-text-3 text-sm mt-3 tracking-[0.3em] uppercase"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                  Plataforma de relatórios premium
                </motion.p>
                {/* Loading bar */}
                <motion.div className="mx-auto mt-8 overflow-hidden rounded-full" style={{ width: 180, height: 2, background: 'rgba(255,255,255,0.08)' }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <motion.div style={{ height: '100%', background: 'linear-gradient(90deg, #6BAF45, #7DC952)', borderRadius: 9999, transformOrigin: 'left' }}
                    initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.4, delay: 0.4, ease: 'easeInOut' }}/>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
