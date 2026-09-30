# Sera report — spec for the backend

The report is the product. **Everything on it must come from the real interview.** No invented numbers, no flattering filler, no benchmarks we don't have. This doc is how the server produces it.

## Where it happens

After the **final** round's Retell webhook, once per interview: `generateReport` (below) → validate → store on the session → `renderReportPdfOnServer(report)` → store the PDF. `sera-get-report` (polled by the browser) and the download only read what's stored. Wiring status and order: [BACKEND_HANDOFF.md](BACKEND_HANDOFF.md). The old `netlify/lib/seraReport.js` + YouTube resources in today's webhook are replaced by this pipeline — delete them when wiring.

## The new pieces (all pure — no env, no network, unit-tested)

| File | What it does |
|---|---|
| `src/shared/seraReportSchema.js` | The exact JSON shape of the stored report + `validate(report)` + `reportSections(report)` (what the page/PDF show). Used by both browser and functions. |
| `src/config/seraRubric.js` | Skills, 1–5 anchored rubric descriptions, weights, **expected levels** (our own entry-level targets), score bands, thresholds. |
| `netlify/lib/seraReport/prompt.js` | `buildReportPrompt(...)`, `REPORT_LLM_SCHEMA` (strict JSON schema for the LLM), `REPORT_LLM_OPTIONS` (`temperature: 0.2`). |
| `netlify/lib/seraReport/verify.js` | `verifyReport(llmJson, transcript)` — drops anything not found in the transcript. |
| `netlify/lib/seraReport/metrics.js` | `computeMetrics(transcript, plannedRounds)` — speaking stats in code. |
| `netlify/lib/seraReport/scoring.js` | `scoreFromRatings(ratings, RUBRIC_CONFIG)` — all scores in code. |
| `netlify/lib/seraReport/assemble.js` | `assembleReport(...)` — builds the stored report. |
| `netlify/lib/seraReport/index.js` | Re-exports all of the above + `buildReport(...)` (everything after the LLM call in one step). |
| `netlify/lib/seraReport/seraReport.test.js` | `npm test` (node's built-in runner). |

## From the 3 rounds — `generateReport` (`fromRounds.js`)

Call it **once**, after the final round's webhook:

```js
import { generateReport } from '../lib/seraReport/index.js'
const { report, dropped, validation } = await generateReport(
  ({ prompt, schema }) => generateJson({ prompt, schema }),
  { transcripts: { screening, hr, final }, chosenOffer, resumeHighlights, route, firstName, interviewDate },
)
```

It merges the 3 round transcripts (`mergeRoundTranscripts`), builds the prompt, makes the **one** LLM call and runs `buildReport`. Rules on top of the steps below: a quote must match word for word in the **same round** it claims; offer fit is exactly the chosen offer's 3 skills (a skill is "shown" only with a kept quote); a round that ran < 60% of its time **or** where the candidate said < 25 words (`RUBRIC_CONFIG.minUserWordsPerRound`) is "Not enough to score" (`null`).

## Order of steps in the webhook

```
transcript → buildReportPrompt → LLM → verifyReport → computeMetrics → scoreFromRatings → assembleReport → validate → store
```

1. **Only for complete interviews.** Keep today's rule: an incomplete/short call gets **no report**; store `status: 'incomplete'` and the page shows the honest "ended early" state. (Rejoin rules: a dropped round is re-run; the report is generated **once**, when the final round completes — see `docs/sera-interview-contract.md`.)
2. **Transcript.** Build `transcript: [{ role: 'agent' | 'user', text, start, end, round }]` from Retell's `transcript_object` (each utterance has `role`, `content` and `words[{ word, start, end }]`): `text = content`, `start = words[0].start`, `end = words[words.length - 1].end`, `round` = which round the utterance belongs to. For students with two calls (screening; HR + final), `start/end` are seconds from the start of **that round's** part — for call 2, split HR/final at the round boundary.
3. **Prompt.** `buildReportPrompt({ transcript, resumeHighlights, route, rounds, chosenOffer })` — `rounds` = the round ids that ran; `chosenOffer` = `{ company, role, skills }` (students) or `null`.
4. **LLM.** `generateJson({ prompt, schema: REPORT_LLM_SCHEMA })` with `REPORT_LLM_OPTIONS` (low temperature — check the model accepts `temperature`; if it doesn't, leave it out). JSON only. The LLM **rates 1–5 and quotes** — it never produces a score.
5. **Everything else in one call:**
   ```js
   import { buildReport } from '../lib/seraReport/index.js'
   import { roundsFor } from '../../src/config/seraRounds.js'

   const { report, dropped, validation } = buildReport({
     llmJson, transcript, route, plannedRounds: roundsFor(route), chosenOffer, firstName, interviewDate: 'YYYY-MM-DD',
   })
   if (dropped.length) console.warn('Sera report: dropped unverifiable items', { email, dropped })
   if (!validation.valid) { /* log validation.errors, store status: 'failed', alert the team — never store an invalid report */ }
   ```
   - `verifyReport`: a quote only survives if it's found (normalised: case, punctuation, accents) inside a **candidate** line of the **same round** in the transcript; its timestamp is then taken from the transcript. Strengths/growth points must point at a real candidate line (±3 s). The rewrite's "you said" must be word for word and its question must be Sera's. Offer fit "shown" without a real quote becomes "not shown yet". Everything removed is listed in `dropped` — **log it**.
   - `computeMetrics`: average answer length, filler words (fixed list incl. Hinglish — see `FILLER_PHRASES`), talk share, time spoken, questions answered, rounds completed/cut short. Code, not the LLM.
   - `scoreFromRatings`: 1–5 → 0–100 per rating; skill = mean of its ratings; round = mean over its answers (null if fewer than 2 rated answers, or if the round was cut short); overall = weighted mean of scored skills (null if fewer than 3). Band from fixed thresholds (`<50` needs work, `50–69` getting there, `≥70` ready).
6. **Store** the validated report JSON (e.g. in the same Blobs record: `{ status: 'complete', report }`). **The stored JSON is the single source of truth** — the page, the PDF and the team email all read it. Never re-run the LLM to "refresh" a report.
7. Generate the PDF from the stored JSON at this point (Part D below) and store it next to the report.

## Truth rules (what the prompt and code enforce)

- Ratings use written, anchored rubric descriptions for an **entry-level** candidate.
- Every quote is word for word, with round + timestamp; unverifiable quotes are removed.
- No evidence → `null` → the page hides that bar/section. Never guessed.
- Every strength/growth point references a specific moment.
- Offer fit is "shown" only with a supporting quote.
- Company names are practice examples, never real companies.
- "Expected level for this role" markers come from `src/config/seraRubric.js` — **our own rubric targets**. Never describe them as data about real candidates or hires.

## Mock mode

`src/services/seraMockReport.js` (DEV only) runs this same pipeline — and `seraOffers` / `seraCall` — on `netlify/lib/fixtures/` (sample résumé, 3 offers, 3-round transcript), so it passes `validate()` and all its quotes are real. None of it ships in a production build.

## Download report (PDF)

### Generating the PDF — once, when the report is created

`netlify/lib/seraReport/renderReportPdf.js` (pure; `pdf-lib` + `@pdf-lib/fontkit`). On the server call it through `pdfAssets.node.js`, which loads the logo and fonts:

```js
import { renderReportPdfOnServer } from '../lib/seraReport/pdfAssets.node.js'
import { reportFilename } from '../lib/seraReport/renderReportPdf.js'

const pdfBytes = await renderReportPdfOnServer(report)
// store next to the report (e.g. R2: sera-reports/<sessionId>.pdf) with
// Content-Disposition: attachment; filename="<reportFilename(report)>"
```

- A4, white page, navy headings, thin brand-gradient line under the header. Page 1: YZI Works logo, "Sera Interview Report", first name, date, "3-round interview · about 11 minutes", chosen offer, drawn score gauge + verdict, summary. Then: round scores, skills (bar + quote with round and time), what worked / what to work on, one answer improved, offer fit, how you spoke, the plan. Blocks never split across pages; empty sections are skipped. Footer on every page: "Prepared by Sera · YZI Works", the AI notice, "Page X of Y". **No transcript.**
- Fonts: Noto Sans (₹, accented Latin) + Noto Sans Devanagari (only embedded when the report contains Devanagari), OFL, in `src/assets/fonts/`. Bundled with the functions via `netlify.toml` `included_files` (already set). The PDF is ~1 MB (full font embedding — pdf-lib's subsetting drops Noto glyphs).
- Sample: `docs/samples/sera-report-sample.pdf` (`npm run sample:pdf`, from the test fixtures).
- Generated **once** from the stored JSON. The download and the team copy never re-render or re-run the LLM.

### `POST /api/sera/report/download` → `downloadReport(sessionId)` (`src/services/seraReportService.js`)

- Body: `{ sessionId }`
- Response: `{ ok: true, url, filename }` | `{ ok: false, error }`
  - `url` — a **short-lived signed URL** (suggest ≤ 5 minutes) to the stored PDF. Set `Content-Disposition: attachment; filename="Sera-Report-{FirstName}-{YYYY-MM-DD}.pdf"` on the object/URL — the browser's `download` attribute is ignored for cross-origin links, so the filename must come from the server.
- **Ownership check:** the session's email must match the signed-in candidate (verify the Google access token as in `/api/sera/login`). Never sign a URL for someone else's report.
- **Team copy, once:** on the **first** successful download of a report, email the PDF to `RESEND_TO_EMAIL` (Resend, same as today's team email). Store `teamCopySentAt` on the report record and skip the email when it's set — later clicks only download. This must be idempotent (two clicks racing still send one email).
- Errors: the page shows "Couldn't prepare your report. Try again." — return `{ ok: false }` rather than a 500 with HTML.

### Mock mode

With `VITE_SERA_MOCK=true` on the dev server, `downloadReport` builds the PDF in the browser from the sample report (so you can open the real file) and logs `Would email a team copy…` on the first click, `Team copy already sent… download only` after that. `pdf-lib` and the renderer are loaded only in that DEV branch — they are not in the production bundle.
