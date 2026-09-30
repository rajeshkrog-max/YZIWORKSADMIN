// Renders docs/samples/sera-report-sample.pdf from the test fixtures
// (the same sample report the DEV mock shows). Run: npm run sample:pdf
import { writeFile } from 'node:fs/promises'
import { buildMockReport } from '../src/services/seraMockReport.js'
import { renderReportPdf } from '../netlify/lib/seraReport/renderReportPdf.js'
import { loadReportPdfAssets } from '../netlify/lib/seraReport/pdfAssets.node.js'

const report = buildMockReport({ route: 'visitor', firstName: process.argv[2] || 'Priya' })
report.interviewDate = '2026-09-30'
const bytes = await renderReportPdf(report, await loadReportPdfAssets())
const out = process.argv[3] || 'docs/samples/sera-report-sample.pdf'
await writeFile(out, bytes)
console.log(`Wrote ${out} (${Math.round(bytes.length / 1024)} KB)`)
