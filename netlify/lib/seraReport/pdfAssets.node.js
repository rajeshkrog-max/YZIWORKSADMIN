// SERVER ONLY (Node fs) — the logo + fonts renderReportPdf embeds. Bundled
// with the functions via netlify.toml [functions] included_files.
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const FILES = {
  logoJpeg: 'src/assets/logo_light.jpeg',
  regular: 'src/assets/fonts/NotoSans-Regular.ttf',
  bold: 'src/assets/fonts/NotoSans-Bold.ttf',
  italic: 'src/assets/fonts/NotoSans-Italic.ttf',
  devanagari: 'src/assets/fonts/NotoSansDevanagari-Regular.ttf',
  devanagariBold: 'src/assets/fonts/NotoSansDevanagari-Bold.ttf',
}

// Repo root locally; the function's working directory on Netlify.
const ROOTS = [process.cwd(), path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')]
const resolve = (rel) => ROOTS.map((root) => path.join(root, rel)).find(existsSync)

// → { logoJpeg, fonts: { regular, bold, italic, devanagari, devanagariBold } }
export async function loadReportPdfAssets() {
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, rel]) => {
      const file = resolve(rel)
      if (!file) throw new Error(`Sera PDF asset missing: ${rel} (check netlify.toml included_files)`)
      return [key, new Uint8Array(await readFile(file))]
    }),
  )
  const { logoJpeg, ...fonts } = Object.fromEntries(entries)
  return { logoJpeg, fonts }
}

// The one server entry for the candidate PDF (download + team email copy).
export async function renderReportPdfOnServer(report) {
  const { renderReportPdf } = await import('./renderReportPdf.js')
  return renderReportPdf(report, await loadReportPdfAssets())
}
