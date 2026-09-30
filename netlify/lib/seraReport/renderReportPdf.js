// Renders the candidate PDF from the stored report JSON — same sections and
// order as the report page, no transcript. Pure: no env, no network (the caller
// passes the logo bytes). Works in Node (server) and in the browser (DEV mock).
// A4, white page, navy headings, brand accent line, AI notice as the footer of
// every page.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { SCORE_BANDS } from '../../../src/config/seraRubric.js'
import { REPORT_FINE_PRINT, ROUND_LABELS, formatTimestamp, reportSections } from '../../../src/shared/seraReportSchema.js'

const A4 = [595.28, 841.89]
const M = 48 // side margin
const FOOTER_H = 58
const NAVY = rgb(0.043, 0.122, 0.294)
const TEXT = rgb(0.13, 0.16, 0.22)
const MUTED = rgb(0.42, 0.45, 0.5)
const LINE = rgb(0.88, 0.89, 0.92)
const GREEN = rgb(0.02, 0.59, 0.41)
const AMBER = rgb(0.85, 0.47, 0.02)
const BRAND = [rgb(1, 0.369, 0), rgb(1, 0, 0.541), rgb(0.545, 0.361, 0.965)] // orange, pink, purple
const CYAN = rgb(0.133, 0.827, 0.933)

const HORIZON = { '30d': 'Next 30 days', '1-3m': '1–3 months', '6-12m': '6–12 months' }
const BAND_LABEL = Object.fromEntries(SCORE_BANDS.map((b) => [b.id, b.label]))

const formatDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`
}
const formatDuration = (s) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`

// logoJpeg: bytes of src/assets/logo_light.jpeg (1000×1000; the logo sits at
// x 196–716, y 313–667 on a white background). Optional.
export async function renderReportPdf(report, { logoJpeg = null } = {}) {
  const doc = await PDFDocument.create()
  doc.setTitle(`Sera interview report — ${report.firstName}`)
  doc.setAuthor('YZI Works')
  doc.setCreator('Sera (YZI Works)')

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique)
  const logo = logoJpeg ? await doc.embedJpg(logoJpeg) : null

  // Standard PDF fonts only cover WinAnsi: swap/strip anything else.
  const supported = new Set(font.getCharacterSet())
  const clean = (text) =>
    String(text ?? '')
      .replace(/₹/g, 'Rs ')
      .replace(/[✓✔]/g, '')
      .replace(/↗/g, '')
      .split('')
      .map((ch) => (supported.has(ch.codePointAt(0)) || ch === '\n' ? ch : ''))
      .join('')

  const pages = []
  let page
  let y

  const newPage = () => {
    page = doc.addPage(A4)
    pages.push(page)
    y = A4[1] - M
  }
  const ensure = (h) => {
    if (y - h < FOOTER_H + 12) newPage()
  }

  const wrap = (text, f, size, width) => {
    const lines = []
    for (const para of clean(text).split('\n')) {
      let line = ''
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word
        if (f.widthOfTextAtSize(next, size) > width && line) {
          lines.push(line)
          line = word
        } else line = next
      }
      lines.push(line)
    }
    return lines
  }

  const text = (str, { f = font, size = 10, color = TEXT, x = M, width = A4[0] - 2 * M, gap = 3 } = {}) => {
    for (const line of wrap(str, f, size, width)) {
      ensure(size + gap)
      page.drawText(line, { x, y: y - size, size, font: f, color })
      y -= size + gap
    }
  }
  const space = (h) => {
    y -= h
  }
  const accentLine = (x, yy, width, thickness = 2) => {
    const seg = width / BRAND.length
    BRAND.forEach((color, i) =>
      page.drawRectangle({ x: x + i * seg, y: yy, width: seg, height: thickness, color }),
    )
  }
  // keepWith: room needed after the heading, so a short section isn't split.
  const heading = (label, title, keepWith = 40) => {
    ensure(52 + keepWith)
    space(14)
    page.drawText(clean(label).toUpperCase(), { x: M, y: y - 8, size: 7.5, font: bold, color: MUTED })
    space(13)
    text(title, { f: bold, size: 14, color: NAVY })
    space(4)
  }
  const bar = (value, expected = null, color = CYAN) => {
    ensure(12)
    const w = A4[0] - 2 * M
    page.drawRectangle({ x: M, y: y - 6, width: w, height: 5, color: LINE })
    page.drawRectangle({ x: M, y: y - 6, width: (w * value) / 100, height: 5, color })
    if (expected !== null) page.drawRectangle({ x: M + (w * expected) / 100 - 0.75, y: y - 9, width: 1.5, height: 11, color: NAVY })
    space(12)
  }
  const moment = (m) => `${ROUND_LABELS[m.round]} · ${formatTimestamp(m.timestamp)}`
  const dot = (color) => page.drawCircle({ x: M + 3.5, y: y - 5, size: 3, color })

  const show = reportSections(report)
  newPage()

  // ── Header ──
  if (logo) {
    const s = 110 / 520
    page.drawImage(logo, { x: M - 196 * s, y: A4[1] - 40 + 313 * s - 1000 * s, width: 1000 * s, height: 1000 * s })
    y = A4[1] - 40 - 354 * s - 18
  } else {
    page.drawText('YZI Works', { x: M, y: A4[1] - 60, size: 18, font: bold, color: NAVY })
    y = A4[1] - 80
  }
  accentLine(M, y, A4[0] - 2 * M, 2.5)
  space(22)
  page.drawText("SERA'S READING", { x: M, y, size: 8, font: bold, color: MUTED })
  space(8)
  text(`Your interview report, ${report.firstName}`, { f: bold, size: 22, color: NAVY, gap: 4 })
  const chips = [formatDate(report.interviewDate), `3-round interview · about ${report.interviewMinutes} minutes`]
  if (report.chosenOffer) chips.push(`${report.chosenOffer.company} · ${report.chosenOffer.role} (practice offer)`)
  text(chips.join('   ·   '), { size: 9, color: MUTED })

  // ── Summary ──
  heading('Summary', show.gauge ? `Overall ${report.overall.score}/100 — ${BAND_LABEL[report.overall.band]}` : 'Overall')
  if (show.gauge) bar(report.overall.score, null, BRAND[1])
  if (show.summary) text(report.overall.summary, { size: 10.5, gap: 4 })
  space(4)
  const f = report.facts
  text(`Time you spoke: ${formatDuration(f.secondsSpoken)} · Questions answered: ${f.questionsAnswered} · Rounds completed: ${f.roundsCompleted} of ${f.roundsTotal}`, { size: 9, color: MUTED })
  text(
    'How Sera scores: each answer is rated 1–5 per skill against a written rubric for an entry-level candidate; the numbers are then computed in code (averages turned into 0–100). Below 50 Needs work, 50–69 Getting there, 70+ Ready. Expected levels are YZI\'s own targets.',
    { size: 8, color: MUTED },
  )

  // ── Round by round (student) ──
  if (show.rounds) {
    heading('Round by round', 'How each round went')
    for (const r of report.rounds) {
      ensure(40)
      text(`${r.label}   ${r.score !== null ? `${r.score}/100` : 'Not enough to score'}   (${formatTimestamp(r.durationSeconds)})`, { f: bold, size: 10.5 })
      if (r.score !== null) bar(r.score, null, BRAND[2])
      if (r.note) text(r.note, { size: 9.5, color: MUTED })
      space(4)
    }
  }

  // ── Skills ──
  if (show.skills) {
    heading('Skills, with what you said', 'Where you stand on each skill')
    text('The dark mark on each bar is the expected level for this role (YZI\'s own target).', { size: 8, color: MUTED })
    space(4)
    for (const s of report.skills) {
      ensure(46)
      text(`${s.label}   ${show.skillBar(s) ? `${s.score}/100` : 'Not enough evidence in this interview'}`, { f: bold, size: 10.5 })
      if (show.skillBar(s)) {
        bar(s.score, s.expected)
        if (s.quote) {
          text(`“${s.quote.text}”`, { f: italic, size: 9.5, x: M + 8, width: A4[0] - 2 * M - 8 })
          text(moment(s.quote), { size: 8, color: MUTED, x: M + 8 })
        }
      }
      space(5)
    }
  }

  // ── What worked / What to work on ──
  const points = (label, items, color) => {
    heading('What worked · What to work on', label)
    for (const item of items) {
      ensure(30)
      dot(color)
      text(item.text, { x: M + 12, width: A4[0] - 2 * M - 12, size: 10 })
      text(moment(item.moment), { x: M + 12, size: 8, color: MUTED })
      space(3)
    }
  }
  if (show.strengths) points('What worked', report.strengths, GREEN)
  if (show.growth) points('What to work on', report.growth, AMBER)

  // ── One answer, improved ──
  if (show.rewrite) {
    const rw = report.rewrite
    heading('One answer, improved', `“${rw.question}”`)
    text(`Sera's question · ${moment(rw)}`, { size: 8, color: MUTED })
    space(4)
    text('You said', { f: bold, size: 9, color: MUTED })
    text(`“${rw.youSaid}”`, { f: italic, size: 10 })
    space(4)
    text('A stronger answer', { f: bold, size: 9, color: GREEN })
    text(rw.stronger, { size: 10 })
  }

  // ── Offer fit (student) ──
  if (show.offerFit) {
    heading('Offer fit', `Fit for the ${report.offerFit.company} offer`)
    text(`${report.offerFit.role} · practice offer`, { size: 9, color: MUTED })
    space(4)
    for (const item of report.offerFit.items) {
      ensure(30)
      dot(item.shown ? GREEN : AMBER)
      text(`${item.requirement} — ${item.shown ? 'Shown in interview' : 'Not shown yet'}`, { f: bold, x: M + 12, size: 10 })
      if (item.quote) text(`“${item.quote.text}”  ${moment(item.quote)}`, { f: italic, x: M + 12, width: A4[0] - 2 * M - 12, size: 9, color: MUTED })
      space(3)
    }
  }

  // ── How you spoke ──
  if (show.speaking) {
    const sp = report.speaking
    heading('How you spoke', 'Measured from the interview', 50)
    text(`Average answer length: ${sp.avgAnswerSeconds} s — how long you usually spoke before Sera's next question.`, { size: 10 })
    text(`Filler words: ${sp.fillerWords} — about ${sp.fillersPerMinute} per minute of your speaking.`, { size: 10 })
    text(`Share of time you spoke: ${Math.round(sp.talkShare * 100)}% — of all the time either of you was talking.`, { size: 10 })
  }

  // ── Your plan ──
  if (show.plan) {
    heading('Your plan', 'What to do next')
    for (const step of report.plan) {
      ensure(44)
      text(`${HORIZON[step.horizon]} — ${step.title}`, { f: bold, size: 10.5 })
      text(step.text, { size: 10 })
      text(`Skills: ${step.skills.join(', ')}`, { size: 8.5, color: MUTED })
      space(5)
    }
  }

  // ── Community ──
  heading('YZI community', 'Want help getting there?')
  text('Join the YZI community on yziworks.netlify.app — it connects you with real work and people who can help you build these skills.', { size: 10 })

  // ── Footer on every page: AI notice + page number ──
  pages.forEach((p, i) => {
    const w = A4[0] - 2 * M
    const seg = w / BRAND.length
    BRAND.forEach((color, k) => p.drawRectangle({ x: M + k * seg, y: FOOTER_H, width: seg, height: 1, color }))
    let fy = FOOTER_H - 11
    for (const line of wrap(REPORT_FINE_PRINT, font, 7, w - 40)) {
      p.drawText(line, { x: M, y: fy, size: 7, font, color: MUTED })
      fy -= 9
    }
    const label = `${i + 1} / ${pages.length}`
    p.drawText(label, { x: A4[0] - M - font.widthOfTextAtSize(label, 7), y: FOOTER_H - 11, size: 7, font, color: MUTED })
  })

  return doc.save()
}

// "Sera-Report-Priya-2026-09-29.pdf"
export const reportFilename = (report) =>
  `Sera-Report-${String(report.firstName).replace(/[^A-Za-z0-9-]+/g, '') || 'Candidate'}-${report.interviewDate}.pdf`
