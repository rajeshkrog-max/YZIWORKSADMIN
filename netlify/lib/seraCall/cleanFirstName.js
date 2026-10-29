// First name as the interviewers say it. Pure: no env, no network — also used
// in the browser (src/shared/seraSession.js).

// Titles skipped before the first name (compared without dots, lowercase).
const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'er', 'prof'])

// "Dr. priya SHARMA" → "Priya", "R. K. Sharma" → "Sharma", "" → "".
// First word that isn't a title or an initial; letters (and their marks, for
// Devanagari etc.) only; capitalised.
export function cleanFirstName(name) {
  for (const word of String(name ?? '').trim().split(/\s+/)) {
    const letters = word.replace(/[^\p{L}\p{M}]+/gu, '')
    if (!letters) continue
    if (TITLES.has(letters.toLowerCase())) continue
    if (letters.length === 1) continue // an initial, with or without a dot
    return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase()
  }
  return ''
}
