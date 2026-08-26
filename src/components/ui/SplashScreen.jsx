import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'

const TOTAL_MS = 3500

export function SplashScreen({ onDone }) {
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const [visible, setVisible] = useState(true)
  const [progress, setProgress] = useState(0)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    let raf
    let renderer, scene, camera, panda, particles

    const start = performance.now()

    if (!reducedMotion && canvasRef.current && stageRef.current) {
      const stage = stageRef.current
      const getSize = () => ({ w: stage.clientWidth, h: stage.clientHeight })

      scene = new THREE.Scene()
      const { w, h } = getSize()
      camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
      camera.position.set(0, -0.4, 6)
      camera.lookAt(0, -0.4, 0)

      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true })
      renderer.setSize(w, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

      const ambient = new THREE.AmbientLight(0xffffff, 0.7)
      const dir = new THREE.DirectionalLight(0x5dd62c, 0.6)
      dir.position.set(2, 3, 4)
      scene.add(ambient, dir)

      panda = buildPanda()
      panda.position.y = -3
      scene.add(panda)

      particles = buildParticleRing()
      scene.add(particles)

      function buildPanda() {
        const group = new THREE.Group()
        const white = new THREE.MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.6 })
        const black = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 })

        const head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), white)
        group.add(head)

        const earGeo = new THREE.SphereGeometry(0.32, 24, 24)
        const earL = new THREE.Mesh(earGeo, black)
        earL.position.set(-0.75, 0.75, -0.1)
        const earR = new THREE.Mesh(earGeo, black)
        earR.position.set(0.75, 0.75, -0.1)
        group.add(earL, earR)

        const patchGeo = new THREE.SphereGeometry(0.32, 24, 24)
        const patchL = new THREE.Mesh(patchGeo, black)
        patchL.position.set(-0.38, 0.12, 0.85)
        patchL.scale.set(1, 1.3, 0.6)
        const patchR = new THREE.Mesh(patchGeo, black)
        patchR.position.set(0.38, 0.12, 0.85)
        patchR.scale.set(1, 1.3, 0.6)
        group.add(patchL, patchR)

        const eyeGeo = new THREE.SphereGeometry(0.08, 16, 16)
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff })
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
        eyeL.position.set(-0.38, 0.16, 1.08)
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat)
        eyeR.position.set(0.38, 0.16, 1.08)
        group.add(eyeL, eyeR)

        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), black)
        nose.position.set(0, -0.22, 1.05)
        nose.scale.set(1, 0.7, 0.7)
        group.add(nose)

        const body = new THREE.Mesh(new THREE.SphereGeometry(1.15, 32, 32), white)
        body.position.set(0, -1.7, 0)
        body.scale.set(1, 1.1, 0.9)
        group.add(body)

        const armGeo = new THREE.SphereGeometry(0.4, 20, 20)
        const armL = new THREE.Mesh(armGeo, black)
        armL.position.set(-1.15, -1.5, 0.2)
        const armR = new THREE.Mesh(armGeo, black)
        armR.position.set(1.15, -1.5, 0.2)
        group.add(armL, armR)

        const legGeo = new THREE.SphereGeometry(0.42, 20, 20)
        const legL = new THREE.Mesh(legGeo, black)
        legL.position.set(-0.55, -2.85, 0.1)
        const legR = new THREE.Mesh(legGeo, black)
        legR.position.set(0.55, -2.85, 0.1)
        group.add(legL, legR)

        group.scale.set(0.55, 0.55, 0.55)
        return group
      }

      function buildParticleRing() {
        const count = 80
        const geo = new THREE.BufferGeometry()
        const positions = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2
          const radius = 2.4 + Math.random() * 0.5
          positions[i * 3] = Math.cos(angle) * radius
          positions[i * 3 + 1] = (Math.random() - 0.5) * 1.5
          positions[i * 3 + 2] = Math.sin(angle) * radius
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        const mat = new THREE.PointsMaterial({ color: 0x5dd62c, size: 0.06, transparent: true, opacity: 0.8 })
        return new THREE.Points(geo, mat)
      }

      function onResize() {
        if (!renderer || !camera) return
        const { w: rw, h: rh } = getSize()
        camera.aspect = rw / rh
        camera.updateProjectionMatrix()
        renderer.setSize(rw, rh)
      }
      window.addEventListener('resize', onResize)

      function animate(now) {
        const elapsed = now - start
        const riseProgress = Math.min(elapsed / 900, 1)
        const eased = 1 - Math.pow(1 - riseProgress, 3)
        panda.position.y = -3 + eased * 3
        panda.rotation.y = Math.sin(elapsed / 1400) * 0.15
        if (riseProgress >= 1) {
          panda.position.y = 0 + Math.sin(elapsed / 600) * 0.08
        }
        if (particles) particles.rotation.y = elapsed / 3000

        renderer.render(scene, camera)
        raf = requestAnimationFrame(animate)
      }
      raf = requestAnimationFrame(animate)

      return () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', onResize)
        renderer.dispose()
      }
    }
  }, [reducedMotion])

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 100 / (TOTAL_MS / 60), 100))
    }, 60)

    const timeout = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDone?.(), 400)
    }, TOTAL_MS)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [onDone])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-bg overflow-hidden"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex flex-col items-center">
            {!reducedMotion && (
              <div ref={stageRef} className="relative w-72 h-72 sm:w-80 sm:h-80">
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              </div>
            )}
            {reducedMotion && <div className="text-6xl mb-4">🐼</div>}

            <div className="relative flex flex-col items-center gap-6 -mt-4">
              <motion.h1
                initial={{ opacity: 0, letterSpacing: '0.4em' }}
                animate={{ opacity: 1, letterSpacing: '0.1em' }}
                transition={{ duration: 1, delay: 0.6 }}
                className="text-2xl font-bold text-text uppercase"
              >
                Panda Reports
              </motion.h1>

              <div className="w-48 h-1 rounded-full bg-bg4 overflow-hidden">
                <motion.div
                  className="h-full bg-green"
                  style={{ width: `${progress}%` }}
                  transition={{ ease: 'linear' }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
