// The squad members and which interview round each one runs. Pure and
// browser-safe (the web client and the webhook both use it).

// Exact squad member names in the "YZI Interview" squad (note the en dashes).
export const SQUAD_MEMBERS = {
  screening: 'Sera – Screening',
  hr: 'Vinit – HR Round',
  final: 'sonia-final round',
}

const ROUND_BY_MEMBER = new Map(Object.entries(SQUAD_MEMBERS).map(([round, name]) => [name.toLowerCase(), round]))

// "Sera – Screening" → 'screening'. Falls back to a keyword in case a member is renamed slightly.
export function roundOfAssistantName(name) {
  const n = String(name ?? '').trim().toLowerCase()
  if (!n) return null
  if (ROUND_BY_MEMBER.has(n)) return ROUND_BY_MEMBER.get(n)
  if (n.includes('sonia') || n.includes('final')) return 'final'
  if (n.includes('vinit') || /\bhr\b/.test(n)) return 'hr'
  if (n.includes('sera') || n.includes('screening')) return 'screening'
  return null
}
