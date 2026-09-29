/*
 * SeraWave — "Siri Wave Line" orb, ported from VoiceOrbs.
 * https://github.com/amunozdev/voiceorbs (src/registry/orbe/siri-wave-line)
 *
 * MIT License
 *
 * Copyright (c) 2026 Alexis Munoz
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Changes from the original: TypeScript/Next.js → plain JS/Vite; the helper
 * modules (orb-state, orb-color, use-orb-animator, use-in-view,
 * use-reduced-motion) are folded into this file; the four curves use the YZI
 * brand colours; the canvas fills its container (any aspect ratio) instead of a
 * fixed square; `bleed` stretches it to the full viewport width; theme follows
 * <html data-theme>, with `tone="dark"` pinning the dark look; idle is a little
 * livelier so it reads as alive rather than a flat line.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTheme } from '../../theme/useTheme'

// ── orb-state ───────────────────────────────────────────────────────────────
const STATES = ['idle', 'connecting', 'listening', 'thinking', 'speaking', 'error', 'disabled']
const ERROR_COLOR_FROM = '#fb7185'
const ERROR_COLOR_TO = '#f43f5e'

const hexToRgb = (hex) => {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = Number.parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const wave = (x) => 0.5 - 0.5 * Math.cos(x)

const stateEnergy = (state, t) => {
  switch (state) {
    case 'listening':
      return 0.4 + 0.32 * wave(t * 17) + 0.18 * wave(t * 8.2 + 3)
    case 'speaking':
      return 0.3 + 0.24 * wave(t * 12.4) + 0.16 * wave(t * 6 + 1.2)
    case 'thinking':
      return 0.24 + 0.2 * wave(t * 4.8)
    case 'connecting':
      return 0.12 + 0.1 * wave(t * 3.2)
    case 'error':
      return 0.2
    default:
      return 0
  }
}

const approach = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt))

const stateRate = (state) => {
  if (state === 'idle' || state === 'disabled') return 5
  if (state === 'error') return 10
  return 14
}

const createStateMix = (initial = 'idle') => {
  const weights = Object.fromEntries(STATES.map((s) => [s, 0]))
  weights[initial] = 1
  const update = (state, dt, rate = stateRate(state)) => {
    let total = 0
    for (const key of STATES) {
      const target = key === state ? 1 : 0
      const next = approach(weights[key], target, rate, dt)
      weights[key] = target === 0 && next < 0.001 ? 0 : next
      total += weights[key]
    }
    if (total > 0) for (const key of STATES) weights[key] /= total
    return weights
  }
  return { weights, update }
}

const blendStates = (weights, table) => {
  const out = {}
  for (const key of STATES) {
    const w = weights[key]
    if (w === 0) continue
    const row = table[key]
    for (const param of Object.keys(row)) out[param] = (out[param] ?? 0) + row[param] * w
  }
  return out
}

const blendEnergy = (weights, t) => {
  let energy = 0
  for (const key of STATES) if (weights[key] > 0) energy += weights[key] * stateEnergy(key, t)
  return energy
}

const clamp01 = (v) => Math.min(1, Math.max(0, v))

// ── orb-color ───────────────────────────────────────────────────────────────
const toLinear = (c) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const toSrgb = (v) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
  return Math.min(255, Math.max(0, c * 255))
}
const mixRgb = (a, b, t) => [
  toSrgb(toLinear(a[0]) + (toLinear(b[0]) - toLinear(a[0])) * t),
  toSrgb(toLinear(a[1]) + (toLinear(b[1]) - toLinear(a[1])) * t),
  toSrgb(toLinear(a[2]) + (toLinear(b[2]) - toLinear(a[2])) * t),
]
const rgba = ([r, g, b], alpha) =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.min(1, Math.max(0, alpha)).toFixed(3)})`

// ── use-reduced-motion ──────────────────────────────────────────────────────
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches
const subscribeReducedMotion = (onChange) => {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
const useReducedMotion = () => useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false)

// ── use-in-view ─────────────────────────────────────────────────────────────
// Pauses the animation loop while the element is off-screen or the tab is hidden.
const observeActivity = (el, onChange) => {
  let inView = true
  let pageVisible = document.visibilityState === 'visible'
  let active = inView && pageVisible

  const sync = () => {
    const next = inView && pageVisible
    if (next === active) return
    active = next
    onChange(next)
  }

  const observer =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((entries) => {
          inView = entries[entries.length - 1]?.isIntersecting ?? true
          sync()
        })
  observer?.observe(el)

  const onVisibility = () => {
    pageVisible = document.visibilityState === 'visible'
    sync()
  }
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    observer?.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

// ── use-orb-animator ────────────────────────────────────────────────────────
const MAX_FRAME_DT = 0.1
const smoothLevel = (current, target, dt) => approach(current, target, target > current ? 14 : 4, dt)

function useOrbAnimator(hostRef, { state, levelRef, speed = 1, onFrame }) {
  const optionsRef = useRef({ state, levelRef, speed, onFrame })
  const wakeRef = useRef(() => {})
  const frameRef = useRef({
    dt: 0,
    dPhase: 0,
    phase: 0,
    time: 0,
    weights: createStateMix(state).weights,
    level: 0,
    live: false,
    reduced: false,
    state,
  })

  useEffect(() => {
    optionsRef.current = { state, levelRef, speed, onFrame }
    wakeRef.current()
  }, [state, levelRef, speed, onFrame])

  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const mix = createStateMix(optionsRef.current.state)
    const frame = frameRef.current
    frame.weights = mix.weights
    let reduced = prefersReducedMotion()
    let raf = 0
    let last = null
    let active = true

    const tick = (now) => {
      raf = 0
      const dt = last === null ? 0 : Math.min((now - last) / 1000, MAX_FRAME_DT)
      last = now
      const opts = optionsRef.current
      const live = opts.levelRef?.current
      const hasLive = typeof live === 'number' && live >= 0
      mix.update(opts.state, dt)
      frame.dPhase = reduced ? 0 : dt * Math.max(0, opts.speed)
      if (!reduced) {
        frame.time += dt
        frame.phase += frame.dPhase
      }
      const target = reduced ? 0 : hasLive ? live : blendEnergy(mix.weights, frame.phase)
      frame.level = smoothLevel(frame.level, target, dt)
      frame.dt = dt
      frame.live = hasLive
      frame.reduced = reduced
      frame.state = opts.state
      opts.onFrame?.(frame)
      const idle = reduced && mix.weights[opts.state] > 0.999 && frame.level < 0.001
      if (active && !idle) raf = requestAnimationFrame(tick)
      else last = null
    }

    const wake = () => {
      if (active && raf === 0) raf = requestAnimationFrame(tick)
    }
    const halt = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      last = null
    }
    wakeRef.current = wake

    const unobserve = observeActivity(el, (next) => {
      active = next
      if (next) wake()
      else halt()
    })
    const unsubscribe = subscribeReducedMotion(() => {
      reduced = prefersReducedMotion()
      wake()
    })
    wake()

    return () => {
      halt()
      unobserve()
      unsubscribe()
      wakeRef.current = () => {}
    }
  }, [hostRef])

  return { frameRef }
}

// ── siri-wave-line ──────────────────────────────────────────────────────────
const CURVES = 4
const SAMPLES = 160
const X_RANGE = 2

// Per-state look. `idle` differs from upstream (amp 0.035 → 0.3, slower flow)
// so the resting wave visibly breathes instead of sitting almost flat.
const PARAMS = {
  idle: { amp: 0.3, ampLevel: 0, freq: 1.6, freqLevel: 0, flow: 0.55, spread: 0.35, width: 1.5, wobble: 0.35, jitter: 0, line: 0.6, dim: 1, fill: 0.22, f0: 1, f1: 0.7, f2: 0.5, f3: 0.35 },
  connecting: { amp: 0.26, ampLevel: 0.05, freq: 2.6, freqLevel: 0, flow: 1.4, spread: 0, width: 0.5, wobble: 0.1, jitter: 0, line: 0.45, dim: 0.92, fill: 0.28, f0: 1, f1: 0.3, f2: 0.18, f3: 0.1 },
  listening: { amp: 0.06, ampLevel: 0.5, freq: 2.6, freqLevel: 1.6, flow: 2.4, spread: 0.55, width: 1, wobble: 0.3, jitter: 0, line: 0.35, dim: 1, fill: 0.26, f0: 1, f1: 0.8, f2: 0.65, f3: 0.5 },
  thinking: { amp: 0.22, ampLevel: 0.05, freq: 3.4, freqLevel: 0, flow: 2, spread: 0, width: 0.5, wobble: 0.15, jitter: 0, line: 0.4, dim: 1, fill: 0.28, f0: 1, f1: 0.85, f2: 0.7, f3: 0.55 },
  speaking: { amp: 0.06, ampLevel: 0.6, freq: 2.8, freqLevel: 3.2, flow: 3.4, spread: 1, width: 1.05, wobble: 0.3, jitter: 0, line: 0.25, dim: 1, fill: 0.3, f0: 1, f1: 0.9, f2: 0.8, f3: 0.7 },
  error: { amp: 0.13, ampLevel: 0, freq: 7.5, freqLevel: 0, flow: 4, spread: 0.2, width: 0.55, wobble: 0, jitter: 0.8, line: 0.45, dim: 1, fill: 0.3, f0: 1, f1: 0.8, f2: 0.6, f3: 0.45 },
  disabled: { amp: 0.006, ampLevel: 0, freq: 1.2, freqLevel: 0, flow: 0.2, spread: 0.2, width: 1.8, wobble: 0, jitter: 0, line: 0.35, dim: 0.45, fill: 0.15, f0: 1, f1: 0.3, f2: 0.2, f3: 0.1 },
}

const BASE_CENTER = [-0.35, 0.4, 0.05, -0.7]
const FREQ_MUL = [1, 1.3, 0.75, 1.55]
const FLOW_MUL = [1, 1.2, 0.85, 1.4]
const WOBBLE_RATE = [1.3, 1.7, 2.1, 1.1]
const SEED = [0.3, 2.1, 4.2, 5.4]
const BLACK = [0, 0, 0]
const WHITE = [255, 255, 255]

// One brand colour per curve: cyan, pink, purple, orange.
const BRAND = ['#22D3EE', '#FF008A', '#8B5CF6', '#FF5E00']

const desaturate = (c, t) => {
  const g = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722
  return mixRgb(c, [g, g, g], t)
}

// state: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error' | 'disabled'
// Size it with `width`/`height` props or with className (e.g. h-[200px] w-full).
// bleed: stretch the canvas to the full viewport width while the component
// stays in normal flow (the sign-in band). tone: 'dark' pins the dark look.
function SeraWave({
  state = 'idle',
  width,
  height,
  speed = 1,
  colors = BRAND,
  levelRef,
  tone,
  bleed = false,
  label = 'Sera voice wave',
  className,
}) {
  const { isDark } = useTheme()
  const dark = tone === 'dark' || isDark

  const hostRef = useRef(null)
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const darkRef = useRef(dark)
  const colorRef = useRef(colors)
  const rendererRef = useRef(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const reduced = useReducedMotion()

  const onFrame = useCallback((frame) => rendererRef.current?.(frame, frame.dt), [])
  const { frameRef } = useOrbAnimator(hostRef, { state, levelRef, speed, onFrame })

  // Measure the drawing area. In bleed mode the stage is pulled left to the
  // viewport edge and widened to the viewport's client width (excludes the
  // scrollbar, so no horizontal scroll).
  useEffect(() => {
    const host = hostRef.current
    const stage = stageRef.current
    if (!host || !stage) return
    const measure = () => {
      const rect = host.getBoundingClientRect()
      let w = rect.width
      if (bleed) {
        w = document.documentElement.clientWidth
        stage.style.left = `${-rect.left}px`
        stage.style.width = `${w}px`
      }
      const next = { w: Math.round(w), h: Math.round(rect.height) }
      setBox((prev) => (prev.w === next.w && prev.h === next.h ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(host)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [bleed])

  useEffect(() => {
    darkRef.current = dark
    colorRef.current = colors
    rendererRef.current?.(frameRef.current, 0)
  }, [dark, colors, frameRef])

  useEffect(() => {
    const canvas = canvasRef.current
    const W = box.w
    const H = box.h
    if (!canvas || W < 2 || H < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const cy = H / 2
    const wide = W > H * 2
    const pad = wide ? 0 : Math.min(W, H) * 0.04
    // Wide bands get taller peaks so the wave fills more of the band's height.
    const halfH = H * (wide ? 1 : 0.5)
    const unit = Math.min(1.8, Math.max(0.8, Math.min(W, H) / 168))
    // Wide canvases get more wave cycles so the shape isn't stretched flat.
    const cycles = Math.min(4, Math.max(1, W / H / 1.6))
    const xs = new Float32Array(SAMPLES)
    const xn = new Float32Array(SAMPLES)
    const edge = new Float32Array(SAMPLES)
    const ys = new Float32Array(SAMPLES)
    for (let j = 0; j < SAMPLES; j += 1) {
      const u = j / (SAMPLES - 1)
      xs[j] = pad + u * (W - pad * 2)
      xn[j] = (u * 2 - 1) * X_RANGE
      const e = 1 - (u * 2 - 1) ** 2
      edge[j] = e * e
    }

    const ampS = new Float32Array(CURVES)
    const centerS = new Float32Array(CURVES)
    const phs = new Float32Array(CURVES)
    for (let i = 0; i < CURVES; i += 1) {
      centerS[i] = BASE_CENTER[i] * 0.35
      phs[i] = SEED[i]
    }
    const factors = new Float32Array(CURVES)
    const fillStr = ['', '', '', '']
    const glowGrad = [null, null, null, null]
    const lineGrad = [null, null, null, null]
    let baseGrad = null
    let freqS = PARAMS.idle.freq
    let prevPhase = frameRef.current.phase
    let lightMix = darkRef.current ? 0 : 1
    let colorKey = ''
    let first = true

    const errFrom = hexToRgb(ERROR_COLOR_FROM)
    const errTo = hexToRgb(ERROR_COLOR_TO)

    const edgeGradient = (c) => {
      const g = ctx.createLinearGradient(pad, 0, W - pad, 0)
      g.addColorStop(0, rgba(c, 0))
      g.addColorStop(0.18, rgba(c, 0.55))
      g.addColorStop(0.5, rgba(c, 1))
      g.addColorStop(0.82, rgba(c, 0.55))
      g.addColorStop(1, rgba(c, 0))
      return g
    }

    const ensureColors = (errW, disW) => {
      const list = colorRef.current
      const key = `${list.join('|')}|${Math.round(errW * 100)}|${Math.round(disW * 100)}|${Math.round(lightMix * 100)}`
      if (key === colorKey) return
      colorKey = key
      const palette = list.map((hex, i) => mixRgb(hexToRgb(hex), i % 2 ? errTo : errFrom, errW))
      for (let i = 0; i < CURVES; i += 1) {
        const base = mixRgb(desaturate(palette[i % palette.length], disW * 0.8), BLACK, lightMix * 0.2)
        fillStr[i] = rgba(base, 1)
        glowGrad[i] = edgeGradient(base)
        lineGrad[i] = edgeGradient(mixRgb(base, mixRgb(WHITE, BLACK, lightMix), 0.3 - lightMix * 0.12))
      }
      const mid = mixRgb(desaturate(mixRgb(palette[0], palette[2 % palette.length], 0.5), disW * 0.8), BLACK, lightMix * 0.25)
      baseGrad = edgeGradient(mid)
    }

    const render = (frame, dt) => {
      const w = frame.weights
      const p = blendStates(w, PARAMS)
      const snap = frame.reduced || first
      first = false
      const dPhase = frame.phase - prevPhase
      prevPhase = frame.phase
      const level = clamp01(frame.level)
      const isDarkNow = darkRef.current

      lightMix = frame.reduced || dt === 0 ? (isDarkNow ? 0 : 1) : approach(lightMix, isDarkNow ? 0 : 1, 6, dt)
      ensureColors(clamp01(w.error), clamp01(w.disabled))

      const targetFreq = p.freq + p.freqLevel * level
      freqS = snap ? targetFreq : approach(freqS, targetFreq, 6, dt)
      factors[0] = p.f0
      factors[1] = p.f1
      factors[2] = p.f2
      factors[3] = p.f3
      const baseAmp = p.amp + p.ampLevel * level
      const thinkT = frame.phase * 1.3
      const sweep = Math.sin(frame.phase * 0.8) * 1.3

      for (let i = 0; i < CURVES; i += 1) {
        const target = baseAmp * factors[i]
        const rate = target > ampS[i] ? 12 : 5
        ampS[i] = snap ? target : approach(ampS[i], target, rate, dt)
        const center =
          p.spread * BASE_CENTER[i] + w.thinking * Math.sin(thinkT + i * 1.35) * 1.2 + w.connecting * sweep
        centerS[i] = snap ? center : approach(centerS[i], center, 10, dt)
        phs[i] += dPhase * p.flow * FLOW_MUL[i]
      }

      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.clearRect(0, 0, W, H)

      const dim = p.dim
      if (baseGrad) {
        ctx.globalAlpha = clamp01(p.line * dim * (1 + lightMix * 0.3))
        ctx.fillStyle = baseGrad
        ctx.fillRect(pad, cy - 0.5 * unit, W - pad * 2, unit)
      }

      for (let pass = 0; pass < 2; pass += 1) {
        const passW = pass === 0 ? 1 - lightMix : lightMix
        if (passW < 0.004) continue
        ctx.globalCompositeOperation = pass === 0 ? 'lighter' : 'source-over'
        const fillBoost = pass === 0 ? 1 : 1.25
        for (let k = CURVES - 1; k >= 0; k -= 1) {
          const wob = 1 - p.wobble * (0.5 + 0.5 * Math.sin(frame.phase * WOBBLE_RATE[k] + SEED[k]))
          const jit =
            1 + p.jitter * (0.6 * Math.sin(frame.phase * 31 + k * 1.7) + 0.4 * Math.sin(frame.phase * 47 + k * 2.9))
          const amp = ampS[k] * wob * jit * halfH
          if (amp < 0.05) continue
          const width = Math.max(0.2, p.width)
          const c = centerS[k]
          const fk = freqS * FREQ_MUL[k] * cycles
          const ph = phs[k]
          for (let j = 0; j < SAMPLES; j += 1) {
            const u = (xn[j] - c) / width
            const u4 = u * u * u * u
            const env = 2 / (2 + u4)
            ys[j] = amp * env * env * edge[j] * Math.sin(fk * xn[j] - ph)
          }
          ctx.beginPath()
          ctx.moveTo(xs[0], cy - ys[0])
          for (let j = 1; j < SAMPLES; j += 1) ctx.lineTo(xs[j], cy - ys[j])
          for (let j = SAMPLES - 1; j >= 0; j -= 1) ctx.lineTo(xs[j], cy + ys[j])
          ctx.closePath()

          ctx.globalAlpha = clamp01(p.fill * dim * passW * fillBoost)
          ctx.fillStyle = fillStr[k]
          ctx.fill()

          ctx.globalAlpha = clamp01(0.14 * dim * passW)
          ctx.strokeStyle = glowGrad[k] ?? fillStr[k]
          ctx.lineWidth = 4.5 * unit
          ctx.stroke()

          ctx.globalAlpha = clamp01(0.85 * dim * passW)
          ctx.strokeStyle = lineGrad[k] ?? fillStr[k]
          ctx.lineWidth = 1.1 * unit
          ctx.stroke()
        }
      }
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }

    rendererRef.current = render
    render(frameRef.current, 0)

    return () => {
      rendererRef.current = null
    }
  }, [box.w, box.h, frameRef])

  useEffect(() => {
    if (state !== 'error' || reduced) return
    const canvas = canvasRef.current
    if (!canvas) return
    const shake = canvas.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-1.5px)' },
        { transform: 'translateX(3px)' },
        { transform: 'translateX(-2px)' },
        { transform: 'translateX(1px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 340, easing: 'ease-out' },
    )
    return () => shake.cancel()
  }, [state, reduced])

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={label}
      data-state={state}
      className={className}
      style={{ position: 'relative', width, height }}
    >
      <div ref={stageRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ display: 'block', width: box.w || '100%', height: box.h || '100%' }}
        />
      </div>
    </div>
  )
}

export default SeraWave
