// Fibonacci-sphere particle orb — state-blend math.
// Ported from the open-source VoiceOrbs "Particles Orb" (MIT licensed,
// github.com/amunozdev/voiceorbs), stripped of the Next.js/TS/React-hooks
// plumbing since this project is plain Vite + React.

export const ORB_STATES = ['idle', 'connecting', 'listening', 'thinking', 'speaking']
export const ALL_ORB_STATES = [...ORB_STATES, 'error', 'disabled']

const ERROR_COLOR_FROM = '#fb7185'
const ERROR_COLOR_TO = '#f43f5e'
const TWO_PI = Math.PI * 2
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
export const PARTICLE_COUNT = 720

export function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = Number.parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mixRgb(a, b, m) {
  return [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, a[2] + (b[2] - a[2]) * m]
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

export function stateMotion(state) {
  switch (state) {
    case 'listening': return 'ripple'
    case 'thinking': return 'pulse'
    case 'speaking': return 'flow'
    default: return 'none'
  }
}

export function stateEnergy(state, t) {
  switch (state) {
    case 'listening': return 0.4 + 0.32 * Math.abs(Math.sin(t * 8.5)) + 0.18 * Math.abs(Math.sin(t * 4.1 + 1.5))
    case 'speaking': return 0.3 + 0.24 * Math.abs(Math.sin(t * 6.2)) + 0.16 * Math.abs(Math.sin(t * 3 + 0.6))
    case 'thinking': return 0.24 + 0.2 * Math.abs(Math.sin(t * 2.4))
    case 'connecting': return 0.12 + 0.1 * Math.abs(Math.sin(t * 1.6))
    case 'error': return 0.2
    default: return 0
  }
}

export function approach(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt))
}

export function createStateMix(initial = 'idle') {
  const weights = { idle: 0, connecting: 0, listening: 0, thinking: 0, speaking: 0, error: 0, disabled: 0 }
  weights[initial] = 1
  const keys = Object.keys(weights)
  function update(state, dt, rate = 6) {
    let total = 0
    for (const key of keys) {
      const target = key === state ? 1 : 0
      const next = approach(weights[key], target, rate, dt)
      weights[key] = target === 0 && next < 0.001 ? 0 : next
      total += weights[key]
    }
    if (total > 0) for (const key of keys) weights[key] /= total
    return weights
  }
  return { weights, update }
}

const ERROR_FROM_RGB = hexToRgb(ERROR_COLOR_FROM)
const ERROR_TO_RGB = hexToRgb(ERROR_COLOR_TO)

export function buildSphere(count) {
  const points = []
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const radiusAtY = Math.sqrt(1 - y * y)
    const theta = GOLDEN_ANGLE * i
    points.push({
      x: Math.cos(theta) * radiusAtY,
      y,
      z: Math.sin(theta) * radiusAtY,
      ringFrac: (i * 0.61803398875) % 1,
      seed: ((i * 0.7548776662) % 1) * TWO_PI,
      tone: (i * 0.5436890126) % 1,
    })
  }
  return points
}

// Creates a render(dt) closure bound to one canvas/points/state-mix instance.
export function createOrbRenderer({ ctx, points, size, colorsRef, stateRef }) {
  const center = size / 2
  const baseRadius = center * 0.62
  const stateMix = createStateMix(stateRef.current)
  const angleX = 0.32
  let t = 0
  let angleY = 0
  let connectingPhase = 0

  return function render(dt) {
    t += dt
    const st = stateRef.current
    const w = stateMix.update(st, dt)

    let ripple = 0, pulse = 0, flow = 0
    for (const s of ORB_STATES) {
      const kind = stateMotion(s)
      if (kind === 'ripple') ripple += w[s]
      else if (kind === 'pulse') pulse += w[s]
      else if (kind === 'flow') flow += w[s]
    }
    const wIdle = w.idle, wConn = w.connecting, wError = w.error, wDisabled = w.disabled
    const motionScale = 1 - wDisabled * 0.96

    const level = clamp01(stateEnergy(st, t))

    const spin = (0.14 + ripple * (0.9 + level * 1.6) + flow * 0.4 + wConn * 0.3) * motionScale
    angleY += dt * spin
    connectingPhase = (connectingPhase + dt * 1.1) % TWO_PI

    const breathe = 0.05 * (0.25 + wIdle * 0.75) * Math.sin(t * 1.1) * motionScale
    const conv = pulse * (0.22 + 0.12 * Math.sin(t * 2.6 + 1))
    const expand = flow * (0.08 + level * 0.32)
    const radius = baseRadius * (1 + breathe + level * 0.16 + expand - conv)

    const from = mixRgb(hexToRgb(colorsRef.current.from), ERROR_FROM_RGB, wError)
    const to = mixRgb(hexToRgb(colorsRef.current.to), ERROR_TO_RGB, wError)

    const shakeAmp = wError * radius * 0.05 * motionScale
    const shakeX = shakeAmp * (Math.sin(t * 26) + 0.5 * Math.sin(t * 15.7))
    const shakeY = shakeAmp * (Math.cos(t * 22.5) + 0.5 * Math.sin(t * 13.1))

    const idleAmp = wIdle * radius * 0.055 * motionScale
    const jitterAmp = (flow + wError * 0.7) * radius * (0.015 + level * 0.085) * motionScale
    const rippleAmp = ripple * (0.045 + level * 0.24)
    const pulseAmp = pulse * 0.16
    const alphaScale = 1 - wDisabled * 0.35

    const cosY = Math.cos(angleY), sinY = Math.sin(angleY)
    const cosX = Math.cos(angleX), sinX = Math.sin(angleX)

    ctx.clearRect(0, 0, size, size)
    const glow = ripple + pulse + flow
    ctx.globalCompositeOperation = glow > 0.5 ? 'lighter' : 'source-over'

    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const x1 = p.x * cosY - p.z * sinY
      const z1 = p.x * sinY + p.z * cosY
      const y1 = p.y * cosX - z1 * sinX
      const z2 = p.y * sinX + z1 * cosX

      const depth = (z2 + 1) / 2
      const perspective = 0.65 + depth * 0.45

      let pointRadius = radius
      if (rippleAmp > 0.002) pointRadius *= 1 + rippleAmp * Math.sin(p.y * 4.5 - t * 6.5)
      if (pulseAmp > 0.002) pointRadius *= 1 - pulseAmp * (0.5 + 0.5 * Math.sin(p.ringFrac * TWO_PI + t * 3.1))

      let ox = shakeX, oy = shakeY
      if (idleAmp > 0.01) {
        ox += idleAmp * (Math.sin(t * 0.55 + p.seed * 3.7) + 0.5 * Math.sin(t * 1.3 + p.seed * 1.3))
        oy += idleAmp * (Math.cos(t * 0.62 + p.seed * 2.9) + 0.5 * Math.sin(t * 1.05 + p.seed * 5.1))
      }
      if (jitterAmp > 0.01) {
        ox += jitterAmp * Math.sin(t * 14 + p.seed * 9.3)
        oy += jitterAmp * Math.cos(t * 17 + p.seed * 6.1)
      }

      const sphereX = center + x1 * pointRadius * perspective + ox
      const sphereY = center + y1 * pointRadius * perspective + oy
      const sphereAlpha = (0.12 + depth * depth * 0.78) * alphaScale
      const sphereDot = 0.6 + depth * 1.5

      let screenX = sphereX, screenY = sphereY, alpha = sphereAlpha, dot = sphereDot

      if (wConn > 0.004) {
        const base = (i / points.length) * TWO_PI
        const jitter = 0.05 * Math.sin(t * 1.3 + p.seed)
        const ringAngle = base + connectingPhase + jitter
        const ringR = center * (0.58 + 0.13 * p.ringFrac) * (1 + 0.05 * Math.sin(t + p.seed * 1.7))
        const circleX = center + Math.cos(ringAngle) * ringR
        const circleY = center + Math.sin(ringAngle) * ringR
        const ringAlpha = 0.35 + p.tone * 0.5
        const ringDot = 0.75 + p.tone * 0.9

        screenX = sphereX + (circleX - sphereX) * wConn
        screenY = sphereY + (circleY - sphereY) * wConn
        alpha = sphereAlpha + (ringAlpha - sphereAlpha) * wConn
        dot = sphereDot + (ringDot - sphereDot) * wConn
      }

      const cr = from[0] + (to[0] - from[0]) * p.tone
      const cg = from[1] + (to[1] - from[1]) * p.tone
      const cb = from[2] + (to[2] - from[2]) * p.tone

      ctx.beginPath()
      ctx.fillStyle = `rgba(${cr | 0}, ${cg | 0}, ${cb | 0}, ${alpha.toFixed(3)})`
      ctx.arc(screenX, screenY, dot, 0, TWO_PI)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}
