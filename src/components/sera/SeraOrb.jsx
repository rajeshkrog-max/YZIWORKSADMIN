import { useEffect, useRef } from 'react'
import { buildSphere, createOrbRenderer, PARTICLE_COUNT } from './orbMath'

// state: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error' | 'disabled'
function SeraOrb({
  state = 'idle',
  size = 168,
  colorFrom = '#8b5cf6',
  colorTo = '#22d3ee',
  className,
}) {
  const canvasRef = useRef(null)
  const stateRef = useRef(state)
  const colorsRef = useRef({ from: colorFrom, to: colorTo })

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    colorsRef.current = { from: colorFrom, to: colorTo }
  }, [colorFrom, colorTo])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const drawSize = size * dpr
    canvas.width = drawSize
    canvas.height = drawSize
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const points = buildSphere(PARTICLE_COUNT)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const render = createOrbRenderer({ ctx, points, size, colorsRef, stateRef })

    if (reduceMotion) {
      render(0)
      return
    }

    let raf = 0
    let last = null
    let running = true

    const frame = (now) => {
      raf = 0
      const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.1)
      last = now
      render(dt)
      if (running) raf = requestAnimationFrame(frame)
    }

    const wake = () => {
      if (raf === 0) {
        last = null
        raf = requestAnimationFrame(frame)
      }
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
    }
  }, [size])

  return (
    <div
      role="img"
      aria-label="Sera"
      data-state={state}
      className={className}
      style={{
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        opacity: state === 'disabled' ? 0.5 : 1,
        filter: state === 'disabled' ? 'grayscale(0.85)' : undefined,
        transition: 'opacity 0.4s ease, filter 0.4s ease',
      }}
    >
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
    </div>
  )
}

export default SeraOrb
