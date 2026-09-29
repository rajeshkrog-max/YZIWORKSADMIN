# Sera report — spec for the backend

The report is the product. **Everything on it must come from the real interview.** No invented numbers, no flattering filler, no benchmarks we don't have. This doc is how the server produces it.

## Where it happens today

- `netlify/functions/sera-retell-webhook.js` receives Retell's `call_analyzed` event, skips incomplete calls (the disconnection-reason gate), calls `generateJson` (`netlify/lib/openai.js`) with `buildReportPrompt` + `REPORT_SCHEMA` from `netlify/lib/seraReport.js`, emails the team, and stores the result in Netlify Blobs (`sera-eligibility` store, key = email).
- `netlify/functions/sera-get-report.js` is polled by the browser and returns the stored report.

The new pipeline below **replaces** `netlify/lib/seraReport.js` (and the YouTube `resources` step — resources are not part of the new report). The webhook itself has **not** been changed on `feat/ui-revamp`; plug the new functions in as described here.

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
   - `verifyReport`: a quote only survives if it's found (normalised: case, punctuation, accents) inside a **candidate** line of the transcript; its round + timestamp are then taken from the transcript. Strengths/growth points must point at a real candidate line (±3 s). The rewrite's "you said" must be word for word and its question must be Sera's. Offer fit "shown" without a real quote becomes "not shown yet". Everything removed is listed in `dropped` — **log it**.
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

`src/services/seraMockReport.js` (DEV only) builds the sample report by running this same pipeline on `netlify/lib/seraReport/fixtures/sampleInterview.js`, so it passes `validate()` and all its quotes are real. None of it ships in a production build.
