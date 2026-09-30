// Renders the candidate PDF from the stored report JSON — same sections and
// order as the report page, never the transcript. Pure: no env, no network —
// the caller passes the logo and font bytes (loadReportPdfAssets in
// pdfAssets.node.js on the server; seraReportService in the DEV browser mock).
// Works in Node and in the browser.
//
// A4, white page, navy headings, thin brand-gradient line under the header,
// "Prepared by Sera · YZI Works" + the AI notice + "Page X of Y" on every page.
// Noto Sans (₹, accented Latin) with Noto Sans Devanagari for Hindi names/words.
// @pdf-lib/fontkit's Devanagari (Indic) shaper expects this global.
import 'regenerator-runtime/runtime.js'
import { LineCapStyle, PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { SCORE_BANDS } from '../../../src/config/seraRubric.js'
import { REPORT_FINE_PRINT, ROUND_LABELS, formatTimestamp, reportSections } from '../../../src/shared/seraReportSchema.js'

const A4 = [595.28, 841.89]
const M = 56 // side margin
const W = A4[0] - 2 * M // content width
const TOP = 56
const FOOTER_H = 64 // footer band at the bottom of every page

const NAVY = rgb(0.043, 0.122, 0.294)
const TEXT = rgb(0.12, 0.15, 0.21)
const MUTED = rgb(0.42, 0.45, 0.5)
const LINE = rgb(0.9, 0.91, 0.93)
const TRACK = rgb(0.93, 0.94, 0.96)
const GREEN = rgb(0.02, 0.59, 0.41)
const AMBER = rgb(0.85, 0.47, 0.02)
const RED = rgb(0.86, 0.27, 0.27)
const BRAND = [
  [1, 0.369, 0],
  [1, 0, 0.541],
  [0.545, 0.361, 0.965],
] // orange → pink → purple
const PURPLE = rgb(...BRAND[2])

const HORIZON = { '30d': 'Next 30 days', '1-3m': '1–3 months', '6-12m': '6–12 months' }
const BAND_LABEL = Object.fromEntries(SCORE_BANDS.map((b) => [b.id, b.label]))
const BAND_COLOR = { needs_work: RED, getting_there: AMBER, ready: GREEN }
const DEVANAGARI = /(\p{Script=Devanagari}+)/u
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const formatDate = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}
const formatDuration = (s) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`
const brandAt = (t) => {
  const seg = Math.min(BRAND.length - 2, Math.floor(t * (BRAND.length - 1)))
  const local = t * (BRAND.length - 1) - seg
  return rgb(...BRAND[seg].map((c, i) => c + (BRAND[seg + 1][i] - c) * local))
}

// assets: { logoJpeg?, fonts?: { regular, bold, italic, devanagari, devanagariBold } } (bytes).
// Without fonts it falls back to Helvetica (₹ → "Rs", non-Latin text dropped).
export async function renderReportPdf(report, { logoJpeg = null, fonts = null } = {}) {
  const doc = await PDFDocument.create()
  doc.setTitle(`Sera Interview Report — ${report.firstName}`)
  doc.setAuthor('Sera · YZI Works')
  doc.setCreator('Sera (YZI Works)')
  doc.setSubject('Practice interview report')

  // ── Fonts ── one "face" = a Latin font + (optionally) a Devanagari fallback.
  let face
  if (fonts?.regular) {
    doc.registerFontkit(fontkit)
    // Full embedding: pdf-lib's subsetting drops glyphs from Noto fonts.
    // Devanagari is embedded only when the report actually contains it.
    const hasDeva = DEVANAGARI.test(JSON.stringify(report))
    const embed = (bytes) => (bytes ? doc.embedFont(bytes, { subset: false }) : null)
    const [regular, bold, italic, deva, devaBold] = await Promise.all(
      [
        fonts.regular,
        fonts.bold ?? fonts.regular,
        fonts.italic ?? fonts.regular,
        hasDeva ? fonts.devanagari : null,
        hasDeva ? (fonts.devanagariBold ?? fonts.devanagari) : null,
      ].map(embed),
    )
    face = { regular: [regular, deva], bold: [bold, devaBold], italic: [italic, deva] }
  } else {
    const [regular, bold, italic] = await Promise.all(
      [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique].map((f) => doc.embedFont(f)),
    )
    face = { regular: [regular, null], bold: [bold, null], italic: [italic, null] }
  }
  const charsets = new Map()
  const supports = (font, ch) => {
    if (!charsets.has(font)) charsets.set(font, new Set(font.getCharacterSet()))
    return charsets.get(font).has(ch.codePointAt(0))
  }
  // Text → runs [{ text, font }]: Devanagari to its font, unsupported glyphs dropped.
  const runs = (str, [latin, deva]) =>
    String(str ?? '')
      .split(DEVANAGARI)
      .filter(Boolean)
      .map((part) => {
        const isDeva = DEVANAGARI.test(part)
        const font = isDeva && deva ? deva : latin
        let text = isDeva && deva ? part : part.replace(/₹\s?/g, supports(latin, '₹') ? '₹' : 'Rs ')
        if (!(isDeva && deva)) text = [...text].filter((ch) => supports(latin, ch)).join('')
        return { text, font }
      })
      .filter((r) => r.text)
  const widthOf = (str, f, size) => runs(str, f).reduce((w, r) => w + r.font.widthOfTextAtSize(r.text, size), 0)

  const logo = logoJpeg ? await doc.embedJpg(logoJpeg) : null

  // ── Layout engine. `measuring` runs the same code without drawing, so a
  // block's height is known before it's placed (nothing splits awkwardly).
  const pages = []
  let page = null
  let y = 0
  let measuring = false
  const newPage = () => {
    page = doc.addPage(A4)
    pages.push(page)
    y = A4[1] - TOP
  }
  const bottom = FOOTER_H + 20
  const measure = (fn) => {
    const [saveY, saveMeasuring] = [y, measuring]
    measuring = true
    fn()
    const h = saveY - y
    y = saveY
    measuring = saveMeasuring
    return h
  }
  const ensure = (h) => {
    if (!measuring && y - h < bottom) newPage()
  }
  const block = (fn) => {
    ensure(measure(fn))
    fn()
  }
  const space = (h) => {
    y -= h
  }

  const draw = (str, { f = face.regular, size = 10.5, color = TEXT, x = M }) => {
    let cx = x
    for (const r of runs(str, f)) {
      page.drawText(r.text, { x: cx, y, size, font: r.font, color })
      cx += r.font.widthOfTextAtSize(r.text, size)
    }
  }
  const wrap = (str, f, size, width) => {
    const lines = []
    for (const para of String(str ?? '').split('\n')) {
      let line = ''
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word
        if (line && widthOf(next, f, size) > width) {
          lines.push(line)
          line = word
        } else line = next
      }
      if (line) lines.push(line)
    }
    return lines
  }
  // Paragraph; `lead` = line height factor.
  const text = (str, { f = face.regular, size = 10.5, color = TEXT, x = M, width = M + W - x, lead = 1.45 } = {}) => {
    for (const line of wrap(str, f, size, width)) {
      space(size * lead)
      if (!measuring) draw(line, { f, size, color, x })
    }
  }
  const rect = (props) => !measuring && page.drawRectangle(props)
  const gradientLine = (x, yy, width, h) => {
    const steps = 48
    for (let i = 0; i < steps; i++) rect({ x: x + (width * i) / steps, y: yy, width: width / steps + 0.3, height: h, color: brandAt(i / (steps - 1)) })
  }
  const bar = (value, { expected = null, color = PURPLE } = {}) => {
    space(12)
    rect({ x: M, y: y + 3, width: W, height: 5, color: TRACK })
    rect({ x: M, y: y + 3, width: (W * value) / 100, height: 5, color })
    if (expected !== null) rect({ x: M + (W * expected) / 100 - 0.75, y: y, width: 1.5, height: 11, color: NAVY })
  }
  const moment = (m) => `${ROUND_LABELS[m.round]} · ${formatTimestamp(m.timestamp)}`
  const dot = (color, dy) => !measuring && page.drawCircle({ x: M + 3.5, y: y + dy, size: 3, color })

  // Section heading, kept on the same page as the section's first block.
  const section = (label, title, first) => {
    const heading = () => {
      space(26)
      if (!measuring) draw(label.toUpperCase(), { f: face.bold, size: 7.5, color: MUTED })
      text(title, { f: face.bold, size: 15, color: NAVY, lead: 1.5 })
      space(6)
    }
    ensure(measure(heading) + (first ? measure(first) : 0))
    heading()
  }
  const items = (label, title, list, render) => {
    if (!list.length) return
    section(label, title, () => render(list[0]))
    list.forEach((item) => block(() => render(item)))
  }

  const show = reportSections(report)
  newPage()

  // ── Header ──
  const headerTop = y
  if (logo) {
    // logo_light.jpeg is 1000×1000; the mark sits at x 196–716, y 313–667 on white.
    const s = 104 / 520
    page.drawImage(logo, { x: M - 196 * s, y: headerTop + 313 * s - 1000 * s, width: 1000 * s, height: 1000 * s })
  } else {
    y = headerTop - 20
    draw('YZI Works', { f: face.bold, size: 18, color: NAVY })
  }
  const metaX = M + W - 200
  y = headerTop - 8
  draw('SERA INTERVIEW REPORT', { f: face.bold, size: 7.5, color: MUTED, x: metaX })
  y -= 14
  draw(formatDate(report.interviewDate), { size: 9.5, color: TEXT, x: metaX })
  y -= 13
  draw(`3-round interview · about ${report.interviewMinutes} minutes`, { size: 9.5, color: MUTED, x: metaX })
  y = headerTop - 354 * (104 / 520) - 16
  gradientLine(M, y, W, 1.6)
  space(34)
  draw('Sera Interview Report', { f: face.bold, size: 24, color: NAVY })
  space(20)
  draw(`for ${report.firstName}`, { size: 13, color: TEXT })
  if (report.chosenOffer) {
    space(18)
    draw(`Practice offer: ${report.chosenOffer.company} · ${report.chosenOffer.role}`, { size: 10, color: MUTED })
  }
  space(18)

  // ── Score gauge + verdict + summary ──
  const gaugeR = 52
  const summaryX = M + 2 * gaugeR + 34
  const summaryW = M + W - summaryX
  const summaryLines = show.summary ? wrap(report.overall.summary, face.regular, 10.5, summaryW) : []
  const boxH = Math.max(gaugeR + 72, 40 + summaryLines.length * 15.5)
  rect({ x: M, y: y - boxH, width: W, height: boxH, color: rgb(0.975, 0.978, 0.988), borderColor: LINE, borderWidth: 0.8 })
  const cx = M + 18 + gaugeR
  const cy = y - 20 - gaugeR
  const arc = (from, to) => {
    const pt = (a) => [cx + gaugeR * Math.cos(a), cy + gaugeR * Math.sin(a)]
    const [x1, y1] = pt(from)
    const [x2, y2] = pt(to)
    // drawSvgPath flips y: draw in SVG space relative to the page origin.
    return { path: `M ${x1} ${-y1} A ${gaugeR} ${gaugeR} 0 0 1 ${x2} ${-y2}`, x: 0, y: 0 }
  }
  const stroke = (from, to, color) => {
    const { path, x, y: yy } = arc(from, to)
    page.drawSvgPath(path, { x, y: yy, borderColor: color, borderWidth: 9, borderLineCap: LineCapStyle.Round })
  }
  stroke(Math.PI, 0.0001, TRACK)
  if (show.gauge) {
    const score = report.overall.score
    stroke(Math.PI, Math.PI - (Math.PI * Math.max(score, 1)) / 100, BAND_COLOR[report.overall.band] ?? PURPLE)
    const label = String(score)
    page.drawText(label, { x: cx - face.bold[0].widthOfTextAtSize(label, 26) / 2, y: cy + 4, size: 26, font: face.bold[0], color: NAVY })
    const verdict = BAND_LABEL[report.overall.band] ?? ''
    page.drawText('out of 100', { x: cx - face.regular[0].widthOfTextAtSize('out of 100', 8) / 2, y: cy - 8, size: 8, font: face.regular[0], color: MUTED })
    page.drawText(verdict, { x: cx - face.bold[0].widthOfTextAtSize(verdict, 11) / 2, y: cy - 30, size: 11, font: face.bold[0], color: BAND_COLOR[report.overall.band] ?? NAVY })
  } else {
    const na = 'Not enough to score'
    page.drawText(na, { x: cx - face.regular[0].widthOfTextAtSize(na, 9) / 2, y: cy - 4, size: 9, font: face.regular[0], color: MUTED })
  }
  const boxTop = y
  y = boxTop - 16
  draw('SUMMARY', { f: face.bold, size: 7.5, color: MUTED, x: summaryX })
  y -= 4
  for (const line of summaryLines) {
    y -= 15.5
    draw(line, { size: 10.5, x: summaryX })
  }
  y = boxTop - boxH
  space(8)
  const f = report.facts
  text(
    `You spoke for ${formatDuration(f.secondsSpoken)} · ${f.questionsAnswered} questions answered · ${f.roundsCompleted} of ${f.roundsTotal} rounds completed`,
    { size: 9, color: MUTED },
  )
  text(
    "How Sera scores: each answer is rated 1–5 per skill against a written rubric for an entry-level candidate; the scores are then computed in code. Below 50 Needs work, 50–69 Getting there, 70+ Ready. Expected levels are YZI's own targets.",
    { size: 8, color: MUTED, lead: 1.4 },
  )

  // ── Round scores ──
  if (show.rounds) {
    items('Round by round', 'How each round went', report.rounds, (r) => {
      space(8)
      text(`${r.label}`, { f: face.bold, size: 11 })
      if (!measuring) {
        const right = `${r.score !== null ? `${r.score}/100` : 'Not enough to score'}  ·  ${formatTimestamp(r.durationSeconds)}`
        draw(right, { size: 9.5, color: MUTED, x: M + W - widthOf(right, face.regular, 9.5) })
      }
      if (r.score !== null) bar(r.score)
      if (r.note) text(r.note, { size: 9.5, color: MUTED })
    })
  }

  // ── Skills ──
  if (show.skills) {
    const skills = report.skills.filter((s) => show.skillBar(s))
    const note = () => text("The dark mark on each bar is the expected level for this role (YZI's own target).", { size: 8.5, color: MUTED })
    const skill = (s) => {
        space(10)
        text(s.label, { f: face.bold, size: 11 })
        if (!measuring) {
          const right = `${s.score}/100`
          draw(right, { f: face.bold, size: 10, color: NAVY, x: M + W - widthOf(right, face.bold, 10) })
        }
        bar(s.score, { expected: s.expected, color: rgb(0.133, 0.6, 0.85) })
        if (s.quote) {
          space(2)
          text(`“${s.quote.text}”`, { f: face.italic, size: 10, x: M + 10 })
          text(moment(s.quote), { size: 8, color: MUTED, x: M + 10 })
        }
    }
    section('Skills, with what you said', 'Where you stand on each skill', () => (note(), skill(skills[0])))
    note()
    skills.forEach((s) => block(() => skill(s)))
    const missing = report.skills.filter((s) => !show.skillBar(s)).map((s) => s.label)
    if (missing.length) block(() => (space(8), text(`Not enough evidence in this interview: ${missing.join(', ')}.`, { size: 9, color: MUTED })))
  }

  // ── What worked / what to work on ──
  const point = (color) => (item) => {
    space(6)
    const top = y
    text(item.text, { x: M + 14, size: 10.5 })
    if (!measuring) {
      const yy = y
      y = top
      dot(color, -11.5)
      y = yy
    }
    text(moment(item.moment), { x: M + 14, size: 8, color: MUTED })
  }
  if (show.strengths) items('What worked', 'Strengths you showed', report.strengths, point(GREEN))
  if (show.growth) items('What to work on', 'Where to grow next', report.growth, point(AMBER))

  // ── One answer, improved ──
  if (show.rewrite) {
    const rw = report.rewrite
    const body = () => {
      text(`“${rw.question}”`, { f: face.bold, size: 11, color: NAVY })
      text(`Sera's question · ${moment(rw)}`, { size: 8, color: MUTED })
      space(8)
      text('YOU SAID', { f: face.bold, size: 7.5, color: MUTED })
      text(`“${rw.youSaid}”`, { f: face.italic, size: 10.5 })
      space(8)
      text('A STRONGER ANSWER', { f: face.bold, size: 7.5, color: GREEN })
      text(rw.stronger, { size: 10.5 })
    }
    section('One answer, improved', 'Same facts, told better', body)
    body()
  }

  // ── Offer fit ──
  if (show.offerFit) {
    items('Offer fit', `Fit for the ${report.offerFit.company} offer`, report.offerFit.items, (item) => {
      space(6)
      const top = y
      text(`${item.requirement} — ${item.shown ? 'shown in the interview' : 'not shown yet'}`, { f: face.bold, x: M + 14, size: 10.5 })
      if (!measuring) {
        const yy = y
        y = top
        dot(item.shown ? GREEN : AMBER, -11.5)
        y = yy
      }
      if (item.quote) text(`“${item.quote.text}” · ${moment(item.quote)}`, { f: face.italic, x: M + 14, size: 9, color: MUTED })
    })
  }

  // ── How you spoke ── three tiles
  if (show.speaking) {
    const sp = report.speaking
    const tiles = [
      [`${sp.avgAnswerSeconds} s`, 'Average answer length'],
      [`${sp.fillersPerMinute}/min`, `Filler words (${sp.fillerWords} in total)`],
      [`${Math.round(sp.talkShare * 100)}%`, 'Share of the time you spoke'],
    ]
    const body = () => {
      space(66)
      if (measuring) return
      const base = y
      const gap = 12
      const tw = (W - 2 * gap) / 3
      tiles.forEach(([value, label], i) => {
        const x = M + i * (tw + gap)
        page.drawRectangle({ x, y: base, width: tw, height: 60, color: rgb(0.975, 0.978, 0.988), borderColor: LINE, borderWidth: 0.8 })
        page.drawText(value, { x: x + 12, y: base + 32, size: 17, font: face.bold[0], color: NAVY })
        y = base + 14
        draw(wrap(label, face.regular, 8.5, tw - 20)[0] ?? '', { size: 8.5, color: MUTED, x: x + 12 })
      })
      y = base
    }
    section('How you spoke', 'Measured from the interview', body)
    body()
  }

  // ── Your plan ──
  if (show.plan) {
    items('Your plan', 'What to do next', report.plan, (step) => {
      space(8)
      text(HORIZON[step.horizon].toUpperCase(), { f: face.bold, size: 7.5, color: PURPLE })
      text(step.title, { f: face.bold, size: 11, color: NAVY })
      text(step.text, { size: 10.5 })
      text(`Skills: ${step.skills.join(', ')}`, { size: 8.5, color: MUTED })
    })
  }

  // ── Closing ──
  block(() => {
    space(22)
    text('Want help getting there? The YZI community connects you with real work and people who can help you build these skills — yziworks.netlify.app', { size: 9.5, color: MUTED })
  })

  // ── Footer on every page ──
  const small = face.regular[0]
  pages.forEach((p, i) => {
    p.drawRectangle({ x: M, y: FOOTER_H, width: W, height: 0.6, color: LINE })
    p.drawText('Prepared by Sera · YZI Works', { x: M, y: FOOTER_H - 13, size: 7.5, font: face.bold[0], color: NAVY })
    const label = `Page ${i + 1} of ${pages.length}`
    p.drawText(label, { x: M + W - small.widthOfTextAtSize(label, 7.5), y: FOOTER_H - 13, size: 7.5, font: small, color: MUTED })
    let fy = FOOTER_H - 25
    for (const line of wrap(REPORT_FINE_PRINT, face.regular, 6.8, W)) {
      let x = M
      for (const r of runs(line, face.regular)) {
        p.drawText(r.text, { x, y: fy, size: 6.8, font: r.font, color: MUTED })
        x += r.font.widthOfTextAtSize(r.text, 6.8)
      }
      fy -= 8.5
    }
  })

  return doc.save()
}

// "Sera-Report-Priya-2026-09-29.pdf"
export const reportFilename = (report) =>
  `Sera-Report-${String(report.firstName).replace(/[^A-Za-z0-9-]+/g, '') || 'Candidate'}-${report.interviewDate}.pdf`
