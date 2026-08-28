import { useEffect, useRef } from 'react'

// Ambient network background — ported directly from the approved hero
// concept's #net canvas (same node count, distance threshold, velocity/
// bounce physics, and colors). The concept didn't need to handle visibility
// lifecycle since it was a single static preview page; here we mirror
// SeraOrb.jsx's existing prefers-reduced-motion + IntersectionObserver +
// visibilitychange pattern exactly rather than inventing a new one.
const NODE_COUNT = 55
const MAX_DIST = 150

function SeraNetworkBackground({ className }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    const resize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const nodes = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
    }))

    function drawNet() {
      ctx.clearRect(0, 0, width, height)
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > width) n.vx *= -1
        if (n.y < 0 || n.y > height) n.vy *= -1
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < MAX_DIST) {
            const alpha = (1 - d / MAX_DIST) * 0.35
            ctx.strokeStyle = `rgba(139,92,246,${alpha})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
      for (const n of nodes) {
        ctx.fillStyle = 'rgba(34,211,238,0.75)'
        ctx.beginPath()
        ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      drawNet()
      window.removeEventListener('resize', resize)
      return
    }

    let raf = 0
    let running = true

    const frame = () => {
      raf = 0
      drawNet()
      if (running) raf = requestAnimationFrame(frame)
    }

    const wake = () => {
      if (raf === 0) raf = requestAnimationFrame(frame)
    }
    const halt = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    }

    const observer = new IntersectionObserver((entries) => {
      const visible = entries[entries.length - 1]?.isIntersecting ?? true
      running = visible
      if (visible) wake()
      else halt()
    })
    observer.observe(canvas)

    const onVisibility = () => {
      const visible = document.visibilityState === 'visible'
      running = visible
      if (visible) wake()
      else halt()
    }
    document.addEventListener('visibilitychange', onVisibility)

    wake()

    return () => {
      halt()
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className={className} aria-hidden="true">
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55 }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(60% 50% at 50% 38%, rgba(5,5,10,0) 0%, rgba(5,5,10,0.55) 68%, rgba(5,5,10,0.96) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

export default SeraNetworkBackground
