// Checks the LLM's output against the real transcript. Anything it can't find
// is removed — never shown. Pure: no env, no network. The caller logs `dropped`.
import { normalise } from './metrics.js'

const MIN_QUOTE_WORDS = 4
const MOMENT_TOLERANCE_SECONDS = 3

// A quote counts only if (normalised) it appears inside one candidate line.
// Round + timestamp are then taken from the transcript, not from the LLM.
function findQuote(quote, transcript) {
  if (!quote?.text) return null
  const needle = normalise(quote.text)
  if (needle.split(' ').filter(Boolean).length < MIN_QUOTE_WORDS) return null
  const lines = transcript.filter((t) => t.role === 'user' && normalise(t.text).includes(needle))
  if (!lines.length) return null
  const best =
    lines.find((t) => t.round === quote.round && Math.abs(t.start - quote.timestamp) <= MOMENT_TOLERANCE_SECONDS) ?? lines[0]
  return { text: quote.text.trim(), round: best.round, timestamp: best.start }
}

// A "moment" must be a real candidate line (same round, start within ±3 s).
function findMoment(item, transcript) {
  const line = transcript.find(
    (t) => t.role === 'user' && t.round === item?.round && Math.abs(t.start - item?.timestamp) <= MOMENT_TOLERANCE_SECONDS,
  )
  return line ? { round: line.round, timestamp: line.start } : null
}

const hasAgentLine = (text, transcript) =>
  transcript.some((t) => t.role === 'agent' && normalise(t.text).includes(normalise(text)))

// → { verified, dropped: [{ path, reason, text? }] }
export function verifyReport(llmJson, transcript) {
  const dropped = []
  const drop = (path, reason, text) => dropped.push({ path, reason, ...(text ? { text } : {}) })

  const answers = (llmJson.answers ?? []).filter((a, i) => {
    const moment = findMoment(a, transcript)
    if (!moment) drop(`answers[${i}]`, 'no candidate line at this round/time')
    return Boolean(moment)
  })

  const skillQuotes = {}
  for (const [id, quote] of Object.entries(llmJson.skillQuotes ?? {})) {
    const found = findQuote(quote, transcript)
    if (quote && !found) drop(`skillQuotes.${id}`, 'quote not found in transcript', quote.text)
    skillQuotes[id] = found
  }

  const points = (key) =>
    (llmJson[key] ?? []).slice(0, 3).flatMap((item, i) => {
      const moment = findMoment(item, transcript)
      if (!moment) {
        drop(`${key}[${i}]`, 'no specific moment in the transcript', item?.text)
        return []
      }
      return [{ text: item.text, moment }]
    })

  let rewrite = null
  if (llmJson.rewrite) {
    const said = findQuote({ ...llmJson.rewrite, text: llmJson.rewrite.youSaid }, transcript)
    if (!said) drop('rewrite', '"youSaid" not found in transcript', llmJson.rewrite.youSaid)
    else if (!hasAgentLine(llmJson.rewrite.question, transcript)) drop('rewrite', 'question not found in transcript', llmJson.rewrite.question)
    else rewrite = { question: llmJson.rewrite.question, youSaid: llmJson.rewrite.youSaid, stronger: llmJson.rewrite.stronger, round: said.round, timestamp: said.timestamp }
  }

  const offerFit = (llmJson.offerFit ?? []).map((item, i) => {
    if (!item.shown) return { requirement: item.requirement, shown: false, quote: null }
    const found = findQuote(item.quote, transcript)
    if (!found) drop(`offerFit[${i}]`, '"shown" without a quote from the transcript — marked not shown', item.quote?.text)
    return { requirement: item.requirement, shown: Boolean(found), quote: found }
  })

  return {
    verified: {
      answers,
      skillQuotes,
      summary: llmJson.summary ?? null,
      roundNotes: llmJson.roundNotes ?? {},
      strengths: points('strengths'),
      growth: points('growth'),
      rewrite,
      offerFit,
      plan: llmJson.plan ?? [],
    },
    dropped,
  }
}
