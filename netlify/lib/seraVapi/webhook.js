// Vapi server-message handling for the end-of-call report. Pure: no env, no
// network (the secret is passed in).
import crypto from 'node:crypto'
import { roundOfAssistantName } from './squad.js'

const sha = (v) => crypto.createHash('sha256').update(String(v)).digest()

// Fails closed: no configured secret means nothing is accepted.
// Accepts `Authorization: Bearer <secret>` (Vapi custom credential) or the legacy `X-Vapi-Secret`.
export function verifyVapiWebhook(headers, secret) {
  if (!secret) return false
  const get = (name) => String(headers?.[name] ?? '')
  const bearer = get('authorization').replace(/^Bearer\s+/i, '')
  const legacy = get('x-vapi-secret')
  const expected = sha(secret)
  return [bearer, legacy].some((given) => given && crypto.timingSafeEqual(sha(given), expected))
}

const SPOKEN_ROLES = { assistant: 'agent', bot: 'agent', user: 'user' }

// artifact.messages → { screening: [turn], hr: [turn], final: [turn] } with times in
// seconds from the start of THAT round (the shape the report module expects).
// Rounds come from the `assistantName` Vapi puts on each bot message in a squad.
// `marks` ({ hrStartSeconds, finalStartSeconds }, seconds from call start) is only a
// fallback for when no message carries a name.
// → { transcripts, attributedByName }
export function splitRounds(messages, marks = {}) {
  const spoken = (messages ?? [])
    .filter((m) => SPOKEN_ROLES[m?.role] && String(m.message ?? '').trim())
    .map((m, i, all) => {
      const start = Number(m.secondsFromStart) || 0
      const duration = Number(m.duration) > 0 ? Number(m.duration) / 1000 : null
      const next = Number(all[i + 1]?.secondsFromStart)
      return {
        raw: m,
        role: SPOKEN_ROLES[m.role],
        text: String(m.message).trim(),
        start,
        end: duration ? start + duration : Math.max(start, next || start),
      }
    })

  // Vapi stamps each bot message with `assistantName` (`name` is only on tool results).
  const attributedByName = spoken.some((t) => roundOfAssistantName(t.raw.assistantName ?? t.raw.name))
  let current = 'screening'
  const byRound = { screening: [], hr: [], final: [] }
  for (const turn of spoken) {
    if (attributedByName) {
      current = (turn.role === 'agent' && roundOfAssistantName(turn.raw.assistantName ?? turn.raw.name)) || current
    } else if (marks.finalStartSeconds != null && turn.start >= marks.finalStartSeconds) current = 'final'
    else if (marks.hrStartSeconds != null && turn.start >= marks.hrStartSeconds) current = 'hr'
    byRound[current].push(turn)
  }

  const transcripts = {}
  for (const [round, turns] of Object.entries(byRound)) {
    const base = turns[0]?.start ?? 0
    transcripts[round] = turns.map(({ role, text, start, end }) => ({
      role,
      text,
      start: Math.max(0, start - base),
      end: Math.max(0, end - base),
    }))
  }
  return { transcripts, attributedByName }
}

// Reasons that mean "the conversation ran its course" — including silence and
// hang-ups, which are NOT network drops. Anything else (pipeline / provider /
// transport errors) is a real drop.
const FINISHED_REASONS = new Set([
  'assistant-ended-call',
  'assistant-said-end-call-phrase',
  'customer-ended-call',
  'exceeded-max-duration',
  'silence-timed-out',
])
export const isFinishedReason = (endedReason) => FINISHED_REASONS.has(endedReason)

// What the end-of-call report means for the session.
//  'report'     → run the one report (+ PDF)
//  'dropped'    → real drop before the end; no report, the lost screen / rejoin applies
//  'incomplete' → the candidate never said anything; no report, no LLM cost
export function decideOutcome({ endedReason, transcripts, candidateEnded }) {
  const spokeAnywhere = Object.values(transcripts).some((turns) => turns.some((t) => t.role === 'user'))
  if (!spokeAnywhere) return 'incomplete'
  const reachedFinal = transcripts.final.length > 0
  if (!isFinishedReason(endedReason) && !candidateEnded && !reachedFinal) return 'dropped'
  return 'report'
}

// Vapi's Call has no top-level `metadata`; ours comes back inside the overrides.
export const sessionIdFromCall = (call) =>
  call?.metadata?.sessionId ?? call?.squadOverrides?.metadata?.sessionId ?? call?.assistantOverrides?.metadata?.sessionId ?? null

// Server messages arrive as { message: { type, ... } }.
export function parseEndOfCall(body) {
  const m = body?.message
  if (m?.type !== 'end-of-call-report') return null
  const call = m.call ?? {}
  return {
    callId: call.id ?? null,
    sessionId: sessionIdFromCall(call),
    endedReason: m.endedReason ?? call.endedReason ?? null,
    messages: m.artifact?.messages ?? m.messages ?? [],
  }
}
