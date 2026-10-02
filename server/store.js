// Persistent file-based store for Sera sessions, orders, and student codes.
// Replaces @netlify/blobs with zero dependencies, 100% local persistence.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.SERA_DATA_DIR || path.join(__dirname, 'data')

const SESSIONS_DIR = path.join(DATA_DIR, 'sessions')
const ORDERS_DIR = path.join(DATA_DIR, 'orders')
const STUDENTS_FILE = path.join(DATA_DIR, 'student_codes.json')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

// Default student codes seed (campus partners)
const DEFAULT_STUDENT_CODES = {
  'YZI-PUNE-OCT26': { instituteName: 'Pune Institute of Applied Technology', seatsTotal: 50, seatsLeft: 42, active: true },
  'YZI-MUMBAI-NOV26': { instituteName: 'Mumbai Technical Academy', seatsTotal: 30, seatsLeft: 15, active: true },
  'YZI-DELHI-NOV26': { instituteName: 'Delhi Institute of Management & Tech', seatsTotal: 40, seatsLeft: 20, active: true },
  'YZI-FULL-TEST': { instituteName: 'Full Capacity Institute', seatsTotal: 25, seatsLeft: 0, active: true },
}

async function ensureDirs() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true })
  await fs.mkdir(ORDERS_DIR, { recursive: true })

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
  await fs.rename(tmpPath, filePath)
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
export async function saveOrder(orderId, orderData) {
  const safeId = String(orderId).replace(/[^a-zA-Z0-9_\-]/g, '')
  const filePath = path.join(ORDERS_DIR, `${safeId}.json`)
  await writeJsonAtomic(filePath, { ...orderData, orderId, updatedAt: new Date().toISOString() })
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
  try {
    const raw = await fs.readFile(STUDENTS_FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return DEFAULT_STUDENT_CODES
  }
}

export async function checkStudentCode(code) {
  const clean = String(code || '').trim().toUpperCase()
  const codes = await getStudentCodes()
  const entry = codes[clean]
  if (!entry || !entry.active) {
    return { valid: false, reason: 'not_found' }
  }
  return {
    valid: true,
    instituteName: entry.instituteName,
    seatsLeft: entry.seatsLeft,
  }
}

export async function consumeStudentSeat(code) {
  const clean = String(code || '').trim().toUpperCase()
  const codes = await getStudentCodes()
  const entry = codes[clean]
  if (!entry || !entry.active) {
    return { success: false, reason: 'not_found' }
  }
  if (entry.seatsLeft <= 0) {
    return { success: false, reason: 'no_seats_left' }
  }

  entry.seatsLeft -= 1
  await writeJsonAtomic(STUDENTS_FILE, codes)
  return { success: true, seatsLeft: entry.seatsLeft }
}
