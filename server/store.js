// Persistent file-based store for Sera sessions, orders, and student codes.
// Replaces @netlify/blobs with zero dependencies, 100% local persistence.
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.SERA_DATA_DIR || path.join(__dirname, 'data')

const SESSIONS_DIR = path.join(DATA_DIR, 'sessions')
const ORDERS_DIR = path.join(DATA_DIR, 'orders')
const RESERVATIONS_DIR = path.join(DATA_DIR, 'reservations')
const STUDENTS_FILE = path.join(DATA_DIR, 'student_codes.json')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

// Sample campus codes. Placeholders for tests and local development only: a fresh production
// install starts with no codes (real ones are added to student_codes.json by hand), unless
// SERA_SEED_SAMPLE_CODES=1 is set.
const SAMPLE_STUDENT_CODES = {
  'YZI-PUNE-OCT26': { instituteName: 'Pune Institute of Applied Technology', seatsTotal: 50, seatsLeft: 42, active: true },
  'YZI-MUMBAI-NOV26': { instituteName: 'Mumbai Technical Academy', seatsTotal: 30, seatsLeft: 15, active: true },
  'YZI-DELHI-NOV26': { instituteName: 'Delhi Institute of Management & Tech', seatsTotal: 40, seatsLeft: 20, active: true },
  'YZI-FULL-TEST': { instituteName: 'Full Capacity Institute', seatsTotal: 25, seatsLeft: 0, active: true },
}

const DEFAULT_STUDENT_CODES = process.env.SERA_SEED_SAMPLE_CODES === '1' ? SAMPLE_STUDENT_CODES : {}

async function ensureDirs() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true })
  await fs.mkdir(ORDERS_DIR, { recursive: true })
  await fs.mkdir(RESERVATIONS_DIR, { recursive: true })

  try {
    await fs.access(STUDENTS_FILE)
  } catch {
    await fs.writeFile(STUDENTS_FILE, JSON.stringify(DEFAULT_STUDENT_CODES, null, 2), 'utf8')
  }
}

// Initialise dirs on module load
await ensureDirs()

// Atomic JSON write to avoid file corruption on crashes
async function writeJsonAtomic(filePath, data) {
  const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8')
  // On Windows a rename onto a file that is being read fails with EPERM/EBUSY/EACCES for a moment; retry.
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(tmpPath, filePath)
      return
    } catch (err) {
      if (attempt >= 8 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) {
        await fs.rm(tmpPath, { force: true })
        throw err
      }
      await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1)))
    }
  }
}

// --- Session Store ---
export async function getSession(sessionId) {
  if (!sessionId) return null
  const safeId = String(sessionId).replace(/[^a-zA-Z0-9_\-]/g, '')
  const filePath = path.join(SESSIONS_DIR, `${safeId}.json`)
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function saveSession(session) {
  if (!session || !session.sessionId) {
    throw new Error('saveSession requires session.sessionId')
  }
  const safeId = String(session.sessionId).replace(/[^a-zA-Z0-9_\-]/g, '')
  const filePath = path.join(SESSIONS_DIR, `${safeId}.json`)
  await writeJsonAtomic(filePath, session)
  return session
}

export async function findSessionByEmail(email) {
  if (!email) return null
  const cleanEmail = String(email).trim().toLowerCase()
  try {
    const files = await fs.readdir(SESSIONS_DIR)
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const raw = await fs.readFile(path.join(SESSIONS_DIR, file), 'utf8')
      const sess = JSON.parse(raw)
      if (sess?.email?.toLowerCase() === cleanEmail) {
        return sess
      }
    }
  } catch (err) {
    console.error('findSessionByEmail error:', err)
  }
  return null
}

// The Vapi webhook finds its session by call id when the metadata did not come back.
export async function findSessionByVapiCallId(callId) {
  if (!callId) return null
  try {
    for (const file of await fs.readdir(SESSIONS_DIR)) {
      if (!file.endsWith('.json')) continue
      const sess = JSON.parse(await fs.readFile(path.join(SESSIONS_DIR, file), 'utf8'))
      if (sess?.vapi?.callId === callId) return sess
    }
  } catch (err) {
    console.error('findSessionByVapiCallId error:', err)
  }
  return null
}

export async function findSessionByRejoin({ token, code }) {
  const cleanToken = token ? String(token).trim() : null
  const cleanCode = code ? String(code).trim().toUpperCase() : null

  try {
    const files = await fs.readdir(SESSIONS_DIR)
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const raw = await fs.readFile(path.join(SESSIONS_DIR, file), 'utf8')
      const sess = JSON.parse(raw)
      if (cleanToken && sess?.rejoinToken === cleanToken) return sess
      if (cleanCode && sess?.rejoinCode === cleanCode) return sess
    }
  } catch (err) {
    console.error('findSessionByRejoin error:', err)
  }
  return null
}

// --- Payment Order Store ---
// Merges into the stored order: verify/used updates must not drop the email,
// session or amount recorded when the order was created.
export async function saveOrder(orderId, orderData) {
  const safeId = String(orderId).replace(/[^a-zA-Z0-9_\-]/g, '')
  const filePath = path.join(ORDERS_DIR, `${safeId}.json`)
  const existing = (await getOrder(orderId)) ?? {}
  const now = new Date().toISOString()
  await writeJsonAtomic(filePath, { createdAt: now, ...existing, ...orderData, orderId, updatedAt: now })
}

// Every order, read from disk (the payment reconcile looks up one email's orders). Unreadable files are skipped.
export async function listOrders() {
  const orders = []
  try {
    for (const file of await fs.readdir(ORDERS_DIR)) {
      if (!file.endsWith('.json')) continue
      try {
        orders.push(JSON.parse(await fs.readFile(path.join(ORDERS_DIR, file), 'utf8')))
      } catch {
        /* a file being written: seen next time */
      }
    }
  } catch (err) {
    console.error('listOrders error:', err.code || err.message)
  }
  return orders
}

export async function getOrder(orderId) {
  const safeId = String(orderId).replace(/[^a-zA-Z0-9_\-]/g, '')
  const filePath = path.join(ORDERS_DIR, `${safeId}.json`)
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function findOrderByPaymentId(paymentId) {
  if (!paymentId) return null
  try {
    const files = await fs.readdir(ORDERS_DIR)
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const raw = await fs.readFile(path.join(ORDERS_DIR, file), 'utf8')
      const order = JSON.parse(raw)
      if (order?.paymentId === paymentId) return order
    }
  } catch (err) {
    console.error('findOrderByPaymentId error:', err)
  }
  return null
}

// --- Student Codes Store ---
export async function getStudentCodes() {
  let codes
  try {
    codes = JSON.parse(await fs.readFile(STUDENTS_FILE, 'utf8'))
  } catch {
    codes = { ...DEFAULT_STUDENT_CODES }
  }
  // The showcase credential lives in env (SERA_DEMO_CODE / SERA_DEMO_SEATS), not in git. It is
  // added to the file on first sight; after that the file's seat count is the truth.
  const demoCode = String(process.env.SERA_DEMO_CODE ?? '').trim().toUpperCase()
  if (demoCode && !codes[demoCode]) {
    const seats = Math.max(0, Number.parseInt(process.env.SERA_DEMO_SEATS ?? '20', 10) || 20)
    codes[demoCode] = { instituteName: 'YZI Works Demo', seatsTotal: seats, seatsLeft: seats, active: true, demo: true }
  }
  return codes
}

const isExpired = (entry) => Boolean(entry.expiresAt) && Date.parse(entry.expiresAt) < Date.now()

export async function checkStudentCode(code) {
  const clean = String(code || '').trim().toUpperCase()
  const codes = await getStudentCodes()
  const entry = codes[clean]
  if (!entry || !entry.active) {
    return { valid: false, reason: 'not_found' }
  }
  if (isExpired(entry)) return { valid: false, reason: 'expired' }
  return {
    valid: true,
    instituteName: entry.instituteName,
    seatsLeft: entry.seatsLeft,
  }
}

// → the entry if `code` is an active showcase (demo) code, else null.
export async function getDemoCode(code) {
  const entry = (await getStudentCodes())[String(code || '').trim().toUpperCase()]
  if (!entry?.demo || !entry.active) return null
  return { instituteName: entry.instituteName, seatsLeft: entry.seatsLeft, expired: isExpired(entry) }
}

// Seat counts are read-modify-write on one file: two students starting at the same moment must not
// both take the last seat, so every seat change waits for the one before it.
let seatQueue = Promise.resolve()
const serialSeat = (fn) => {
  const run = seatQueue.then(fn)
  seatQueue = run.catch(() => {})
  return run
}

export const consumeStudentSeat = (code) => serialSeat(() => consumeSeatNow(code))
export const refundStudentSeat = (code) => serialSeat(() => refundSeatNow(code))

async function consumeSeatNow(code) {
  const clean = String(code || '').trim().toUpperCase()
  const codes = await getStudentCodes()
  const entry = codes[clean]
  if (!entry || !entry.active) {
    return { success: false, reason: 'not_found' }
  }
  if (isExpired(entry)) return { success: false, reason: 'expired' }
  if (entry.seatsLeft <= 0) {
    return { success: false, reason: 'no_seats_left' }
  }

  entry.seatsLeft -= 1
  await writeJsonAtomic(STUDENTS_FILE, codes)
  return { success: true, seatsLeft: entry.seatsLeft }
}

async function refundSeatNow(code) {
  const clean = String(code || '').trim().toUpperCase()
  const codes = await getStudentCodes()
  const entry = codes[clean]
  if (!entry) return { success: false }
  entry.seatsLeft = Math.min(entry.seatsTotal ?? Infinity, entry.seatsLeft + 1)
  await writeJsonAtomic(STUDENTS_FILE, codes)
  return { success: true, seatsLeft: entry.seatsLeft }
}

// --- One interview per email ---
// The slot is created with an exclusive write, so two tabs / a double click cannot
// both get it. Reserved BEFORE the Vapi call is created, released if that fails.
const reservationPath = (email) =>
  path.join(RESERVATIONS_DIR, `${crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex')}.json`)

export async function getReservation(email) {
  try {
    return JSON.parse(await fs.readFile(reservationPath(email), 'utf8'))
  } catch {
    return null
  }
}

// → true if this call took the slot, false if the email already has one.
export async function reserveInterview(email, data) {
  try {
    await fs.writeFile(
      reservationPath(email),
      JSON.stringify({ ...data, status: 'reserved', reservedAt: new Date().toISOString() }, null, 2),
      { encoding: 'utf8', flag: 'wx' }
    )
    return true
  } catch (err) {
    if (err?.code === 'EEXIST') return false
    throw err
  }
}

export async function updateReservation(email, patch) {
  const current = (await getReservation(email)) ?? {}
  await writeJsonAtomic(reservationPath(email), { ...current, ...patch })
}

export async function releaseReservation(email) {
  await fs.rm(reservationPath(email), { force: true })
}

// --- Listing, for the restart recovery sweep (server/recovery.js) ---
// Every session, read from disk. Files that cannot be read are skipped, never fatal.
export async function listSessions() {
  const sessions = []
  try {
    for (const file of await fs.readdir(SESSIONS_DIR)) {
      if (!file.endsWith('.json')) continue
      try {
        sessions.push(JSON.parse(await fs.readFile(path.join(SESSIONS_DIR, file), 'utf8')))
      } catch {
        /* a file being written or damaged: the next sweep sees it again */
      }
    }
  } catch (err) {
    console.error('listSessions error:', err.code || err.message)
  }
  return sessions
}

// Every reservation with its file key (the email is stored only as a hash, so the key is how one is released).
export async function listReservations() {
  const reservations = []
  try {
    for (const file of await fs.readdir(RESERVATIONS_DIR)) {
      if (!file.endsWith('.json')) continue
      try {
        reservations.push({ ...JSON.parse(await fs.readFile(path.join(RESERVATIONS_DIR, file), 'utf8')), key: file.slice(0, -5) })
      } catch {
        /* skipped, seen again next sweep */
      }
    }
  } catch (err) {
    console.error('listReservations error:', err.code || err.message)
  }
  return reservations
}

export async function releaseReservationByKey(key) {
  if (!/^[a-f0-9]{64}$/.test(String(key))) return
  await fs.rm(path.join(RESERVATIONS_DIR, `${key}.json`), { force: true })
}
