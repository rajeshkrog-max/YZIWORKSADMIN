// Strict check of the LLM's offers — the UI never shows a broken tile.
// Pure: no env, no network.
import { WORK_MODES } from './prompt.js'

const TEXT_FIELDS = ['company', 'logoLetter', 'industry', 'city', 'workMode', 'role', 'whyFit', 'finalTwist']
const CTC_MIN = 1
const CTC_MAX = 50
const MAX_SPREAD = 6 // LPA between min and max

// Well-known companies an invented name must not use (whole words, lowercase).
const REAL_COMPANIES = [
  'tcs', 'tata', 'infosys', 'wipro', 'hcl', 'tech mahindra', 'mahindra', 'reliance', 'jio', 'airtel', 'adani',
  'accenture', 'deloitte', 'kpmg', 'pwc', 'ey', 'cognizant', 'capgemini', 'genpact', 'ibm', 'oracle',
  'google', 'alphabet', 'amazon', 'microsoft', 'apple', 'meta', 'facebook', 'netflix', 'uber', 'ola',
  'flipkart', 'myntra', 'zomato', 'swiggy', 'paytm', 'phonepe', 'razorpay', 'zoho', 'freshworks', 'byjus',
  'hdfc', 'icici', 'sbi', 'axis', 'kotak', 'bajaj', 'godrej', 'larsen', 'infoedge', 'naukri', 'nykaa', 'meesho',
]

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const isText = (v) => typeof v === 'string' && v.trim().length > 0
const isRealCompany = (name) => {
  const padded = ` ${norm(name)} `
  return REAL_COMPANIES.some((c) => padded.includes(` ${c} `))
}

// json: the LLM output ({ offers: [...] }). → { valid, errors: [string] }
export function validateOffers(json) {
  const errors = []
  const offers = json?.offers
  if (!Array.isArray(offers) || offers.length !== 3) {
    return { valid: false, errors: [`expected exactly 3 offers, got ${Array.isArray(offers) ? offers.length : 'none'}`] }
  }

  offers.forEach((o, i) => {
    const at = `offers[${i}]`
    if (!o || typeof o !== 'object') return errors.push(`${at}: not an object`)
    for (const key of TEXT_FIELDS) if (!isText(o[key])) errors.push(`${at}.${key}: missing or empty`)
    if (isText(o.logoLetter) && !/^[A-Z]$/.test(o.logoLetter.trim())) errors.push(`${at}.logoLetter: must be one capital letter`)
    if (isText(o.company) && isText(o.logoLetter) && o.company.trim()[0].toUpperCase() !== o.logoLetter.trim()) {
      errors.push(`${at}.logoLetter: must be the company's first letter`)
    }
    if (isText(o.workMode) && !WORK_MODES.includes(o.workMode)) errors.push(`${at}.workMode: must be one of ${WORK_MODES.join(', ')}`)
    if (isText(o.company) && isRealCompany(o.company)) errors.push(`${at}.company: "${o.company}" looks like a real company`)

    const { ctcMinLpa: min, ctcMaxLpa: max } = o
    if (!Number.isFinite(min) || !Number.isFinite(max)) errors.push(`${at}: CTC must be numbers`)
    else {
      if (min >= max) errors.push(`${at}: ctcMinLpa must be below ctcMaxLpa`)
      if (min < CTC_MIN || max > CTC_MAX) errors.push(`${at}: CTC must be within ${CTC_MIN}–${CTC_MAX} LPA`)
      if (max - min > MAX_SPREAD) errors.push(`${at}: CTC range wider than ${MAX_SPREAD} LPA`)
    }

    if (!Array.isArray(o.skills) || o.skills.length !== 3 || !o.skills.every(isText)) {
      errors.push(`${at}.skills: exactly 3 non-empty skills`)
    } else if (new Set(o.skills.map(norm)).size !== 3) errors.push(`${at}.skills: must be 3 different skills`)
  })

  if (!errors.length) {
    if (new Set(offers.map((o) => norm(o.company))).size !== 3) errors.push('offers: company names must differ')
    if (new Set(offers.map((o) => `${norm(o.role)}|${norm(o.industry)}`)).size !== 3) {
      errors.push('offers: the 3 offers must differ in role or industry')
    }
  }
  return { valid: errors.length === 0, errors }
}
