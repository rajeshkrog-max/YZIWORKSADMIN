// Fix the small, mechanical mistakes the LLM makes in the 3 offers BEFORE they are
// validated, so one stray skill or a too-wide salary range no longer throws away the
// whole answer (Meet Sera handoff, Fix 1). validateOffers stays the final check:
// anything this cannot safely repair is left for it to reject.
// Pure: no env, no network. Never mutates its input.
import { WORK_MODES } from './prompt.js'
import { REAL_COMPANIES, isRealCompany } from './validate.js'

export const CTC_FLOOR = 1
export const CTC_CEILING = 50
export const REPAIR_MAX_SPREAD = 4 // LPA; the prompt asks for 1–4, the validator allows up to 6

const NAME_SUFFIXES = ['Labs', 'Works', 'Systems', 'Collective', 'Partners']
const TEXT_FIELDS = ['company', 'logoLetter', 'industry', 'city', 'workMode', 'role', 'whyFit', 'finalTwist']

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const tidy = (s) => String(s).replace(/\s+/g, ' ').trim()
const round1 = (n) => Math.round(n * 10) / 10
const toNumber = (v) => {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(/[^0-9.]+/g, ''))
    return Number.isFinite(n) && n > 0 ? n : v
  }
  return v
}

const WORK_MODE_ALIASES = new Map([
  ['on site', 'On-site'], ['onsite', 'On-site'], ['office', 'On-site'], ['in office', 'On-site'], ['work from office', 'On-site'],
  ['hybrid', 'Hybrid'],
  ['remote', 'Remote'], ['wfh', 'Remote'], ['work from home', 'Remote'],
])
const fixWorkMode = (mode) => {
  if (typeof mode !== 'string') return mode
  return WORK_MODES.find((m) => norm(m) === norm(mode)) ?? WORK_MODE_ALIASES.get(norm(mode)) ?? mode
}

// "Axis Fintech" → "Fintech Labs"; "Tata" → "<Industry> Labs". Removes every real-company word,
// then adds a suffix so the name still reads like a company.
function inventCompanyName(name, industry, index) {
  let words = tidy(name).split(' ').filter(Boolean)
  // Drop each real-company phrase as a whole ("tech mahindra" removes both words, a lone "Tech" stays).
  for (const company of REAL_COMPANIES) {
    const parts = company.split(' ')
    for (let i = 0; i + parts.length <= words.length; ) {
      if (parts.every((p, j) => norm(words[i + j]) === p)) words = [...words.slice(0, i), ...words.slice(i + parts.length)]
      else i++
    }
  }
  const kept = words.join(' ')
  const base = kept || tidy(String(industry ?? '')).split(' ')[0] || 'Nova'
  const name2 = `${base} ${NAME_SUFFIXES[index % NAME_SUFFIXES.length]}`
  return isRealCompany(name2) ? `Nova ${NAME_SUFFIXES[index % NAME_SUFFIXES.length]}` : name2
}

function repairOne(o, index) {
  if (!o || typeof o !== 'object') return o
  const out = { ...o }
  for (const key of TEXT_FIELDS) if (typeof out[key] === 'string') out[key] = tidy(out[key])

  out.workMode = fixWorkMode(out.workMode)

  if (typeof out.company === 'string' && out.company && isRealCompany(out.company)) {
    out.company = inventCompanyName(out.company, out.industry, index)
  }
  // The logo letter is always the company's first letter.
  if (typeof out.company === 'string' && /^[A-Za-z]/.test(out.company)) out.logoLetter = out.company[0].toUpperCase()

  // Skills: trimmed, no blanks, no duplicates, at most 3. Fewer than 3 is left for the validator.
  if (Array.isArray(out.skills)) {
    const seen = new Set()
    out.skills = out.skills
      .filter((s) => typeof s === 'string' && s.trim())
      .map(tidy)
      .filter((s) => (seen.has(norm(s)) ? false : seen.add(norm(s))))
      .slice(0, 3)
  }

  // CTC: numbers, inside 1–50 LPA, min below max, spread at most 4 LPA.
  let min = toNumber(out.ctcMinLpa)
  let max = toNumber(out.ctcMaxLpa)
  if (Number.isFinite(min) && Number.isFinite(max)) {
    if (min > max) [min, max] = [max, min]
    min = Math.min(Math.max(min, CTC_FLOOR), CTC_CEILING - 1)
    max = Math.min(Math.max(max, CTC_FLOOR), CTC_CEILING)
    if (max <= min) max = Math.min(min + 1, CTC_CEILING)
    if (max - min > REPAIR_MAX_SPREAD) max = min + REPAIR_MAX_SPREAD
    out.ctcMinLpa = round1(min)
    out.ctcMaxLpa = round1(max)
  }
  return out
}

// json: the LLM output ({ offers: [...] }) → a repaired copy (same shape). Anything that is not
// an object with an offers array comes back unchanged.
export function repairOffers(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.offers)) return json
  const offers = json.offers.slice(0, 3).map(repairOne)

  // Two offers with the same company name: give the later one a suffix.
  const used = new Set()
  offers.forEach((o, i) => {
    if (!o || typeof o.company !== 'string' || !o.company) return
    if (used.has(norm(o.company))) {
      o.company = `${o.company} ${NAME_SUFFIXES[i % NAME_SUFFIXES.length]}`
      o.logoLetter = o.company[0].toUpperCase()
    }
    used.add(norm(o.company))
  })
  return { ...json, offers }
}
