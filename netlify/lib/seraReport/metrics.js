// Speaking metrics computed IN CODE from the transcript (never by the LLM).
// Pure: no env, no network.

// Fixed filler list. Deliberately excludes ambiguous words ("like", "so",
// "na", "toh") that are usually real words, not fillers.
export const FILLER_PHRASES = [
  'um', 'umm', 'uh', 'uhh', 'erm', 'hmm',
  'you know', 'i mean', 'basically', 'actually', 'literally', 'sort of', 'kind of',
  // Hinglish
  'matlab', 'yaani', 'kya bolte', 'kya kehte', 'wo kya hai', 'vo kya hai',
]

export const normalise = (text) =>
  String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ') // keep letters, digits and marks (incl. Devanagari)
    .trim()

// Sera's line counts as a question if it asks one or gives a prompt to answer.
const PROMPT_PATTERN = /\?|\b(tell me|describe|explain|walk me through|give me an example|talk me through)\b/i
export const isQuestion = (text) => PROMPT_PATTERN.test(String(text ?? ''))

const words = (text) => normalise(text).split(' ').filter(Boolean)
const duration = (t) => Math.max(0, t.end - t.start)
const round1 = (n) => Math.round(n * 10) / 10

export function countFillers(text) {
  const padded = ` ${normalise(text)} `
  return FILLER_PHRASES.reduce((sum, phrase) => sum + (padded.split(` ${phrase} `).length - 1), 0)
}

// transcript: [{ role: 'agent'|'user', text, start, end, round }] (start/end in seconds)
// plannedRounds (optional): [{ id, seconds }] — to flag rounds that were cut short.
// minUserWords: a round where the candidate said fewer words also counts as cut
// short ("Not enough to score").
export function computeMetrics(transcript, plannedRounds = null, cutShortRatio = 0.6, minUserWords = 0) {
  const answers = []
  transcript.forEach((t, i) => {
    if (t.role !== 'user' || words(t.text).length < 3) return
    const previous = transcript.slice(0, i).reverse().find((p) => p.round === t.round && p.role === 'agent')
    answers.push({ ...t, answersQuestion: Boolean(previous && isQuestion(previous.text)) })
  })

  const userSeconds = transcript.filter((t) => t.role === 'user').reduce((s, t) => s + duration(t), 0)
  const agentSeconds = transcript.filter((t) => t.role === 'agent').reduce((s, t) => s + duration(t), 0)
  const fillerWords = transcript.filter((t) => t.role === 'user').reduce((s, t) => s + countFillers(t.text), 0)

  const perRound = {}
  for (const id of [...new Set(transcript.map((t) => t.round))]) {
    const turns = transcript.filter((t) => t.round === id)
    const durationSeconds = Math.max(...turns.map((t) => t.end)) - Math.min(...turns.map((t) => t.start))
    const planned = plannedRounds?.find((r) => r.id === id)?.seconds
    const userWords = turns.filter((t) => t.role === 'user').reduce((s, t) => s + words(t.text).length, 0)
    perRound[id] = {
      durationSeconds,
      userWords,
      answers: answers.filter((a) => a.round === id && a.answersQuestion).length,
      cutShort: (planned ? durationSeconds < planned * cutShortRatio : false) || userWords < minUserWords,
    }
  }

  return {
    avgAnswerSeconds: answers.length ? Math.round(answers.reduce((s, a) => s + duration(a), 0) / answers.length) : 0,
    fillerWords,
    fillersPerMinute: userSeconds > 0 ? round1(fillerWords / (userSeconds / 60)) : 0,
    talkShare: userSeconds + agentSeconds > 0 ? Math.round((userSeconds / (userSeconds + agentSeconds)) * 100) / 100 : 0,
    secondsSpoken: Math.round(userSeconds),
    questionsAnswered: answers.filter((a) => a.answersQuestion).length,
    roundsCompleted: Object.values(perRound).filter((r) => r.answers > 0 && !r.cutShort).length,
    perRound,
  }
}
