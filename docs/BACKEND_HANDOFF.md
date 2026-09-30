# Sera backend handoff — start here

The Meet Sera frontend is complete and runs end to end in mock mode (`VITE_SERA_MOCK=true` on `npm run dev`). This page is the **one starting point** for wiring the real backend, in build order. The detailed contracts are linked, not repeated:

| Doc | What's in it |
|---|---|
| [sera-login-contract.md](sera-login-contract.md) | Login + student code: request/response, what the server verifies |
| [sera-payment-contract.md](sera-payment-contract.md) | Pay screen flow, create-order / verify shapes, mock mode |
| [sera-interview-contract.md](sera-interview-contract.md) | Rounds, offers, per-round calls + variables, session statuses, rejoin endpoints |
| [sera-report-spec.md](sera-report-spec.md) | Report pipeline, truth rules, PDF, download |
| `docs/samples/sera-report-sample.pdf` | The candidate PDF, rendered from the test fixtures (`npm run sample:pdf`) |

**Ground rules.** The browser talks to the backend **only** through `src/services/*`. Server logic lives as **pure modules** in `netlify/lib/*` (no env, no network, unit-tested with `npm test`) — endpoints are thin wrappers: read/verify input → load the session → call the module → store → respond. One data shape everywhere: the **session** in `src/shared/seraSession.js`. Every endpoint returns `Content-Type: application/json`; `/api/...` paths need a redirect in `netlify.toml` or a `config.path` on the function. Every gap is marked `// TODO(backend)` — full list at the bottom.

## 1. Env vars (names only)

Server-only unless it starts with `VITE_`. Never put a secret in a `VITE_` var, never commit one. Set them in `.env` (local) and Netlify; `.env.example` has the ones you set by hand.

| Name | Used in |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | browser — Google sign-in (`src/utils/googleAuth.js`) |
| `VITE_MSG91_WIDGET_ID`, `VITE_MSG91_TOKEN_AUTH` | browser — MSG91 OTP widget (login + Builder/Partner forms) |
| `VITE_RAZORPAY_KEY_ID` | browser — fallback Razorpay key id only (server returns `keyId`) |
| `VITE_SERA_MOCK` | browser — `true` on localhost only; never on Netlify |
| `MSG91_AUTH_KEY`, `MSG91_WIDGET_ID` | `/api/sera/login` — verify the MSG91 success token |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | `/api/sera/payment/create-order`, `/verify` |
| `RAZORPAY_WEBHOOK_SECRET` | `/api/sera/payment/webhook` |
| `RETELL_API_KEY` | `sera-start-call` (create-web-call) |
| `RETELL_WEBHOOK_SECRET` | `sera-retell-webhook` (signature — the "Webhook"-badged Retell key) |
| `RETELL_AGENT_ID_SCREENING`, `RETELL_AGENT_ID_HR`, `RETELL_AGENT_ID_FINAL` | `sera-start-call` via `pickAgentId(round)`. (`RETELL_AGENT_ID` is the old single agent — remove once per-round calls are live.) |
| `OPENAI_API_KEY` | `netlify/lib/openai.js` — résumé check, offers, summaries, report |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | `sera-create-upload`, `sera-extract-resume`, webhook (résumé link), report PDF storage |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_TO_EMAIL` | team emails (report copy, drop/rejoin alerts) |
| `SERA_ADMIN_EMAILS` | `sera-start-call` — test accounts that bypass the one-interview gate |
| `NETLIFY_SITE_ID`, `NETLIFY_BLOBS_TOKEN` | `netlify/lib/eligibilityStore.js` — Blobs outside the Netlify runtime |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN` | rejoin link/code on WhatsApp |
| `YOUTUBE_API_KEY`, `GEMINI_API_KEY` | old report / unused — remove with the old webhook code |

## 2. Endpoints the frontend calls

| Method + path | Called from | Request | Response | Errors |
|---|---|---|---|---|
| `POST /api/sera/student-code/check` | `seraAuthService.checkStudentCode` | `{ code }` | `{ valid: true, instituteName, seatsLeft }` \| `{ valid: true, kind: 'rejoin' }` | `{ valid: false, reason: 'not_found' \| 'expired' \| 'used' }` |
| `POST /api/sera/login` | `seraAuthService.completeLogin` | `{ route, google: { name, email, picture, accessToken }, phone, msg91Token, studentCode }` | `{ ok: true, login: { route, firstName, email, phone, studentCode } }` | `{ ok: false, error }` (shown to the user) |
| `POST /.netlify/functions/sera-create-upload` *(exists)* | `seraResumeService` → `utils/seraUpload` | `{ filename, contentType, size }` | `{ success: true, uploadUrl, objectKey }` | `{ error }` + 4xx/5xx |
| `POST /.netlify/functions/sera-extract-resume` *(exists; add offers)* | `seraResumeService.prepareResume` | `{ objectKey }` | `{ valid: true, highlight, field, offers: [3] }` | `{ valid: false, reason }` (not a résumé); 500 `{ error }` (our side, incl. offers failed) |
| `POST /api/sera/payment/create-order` | `seraPaymentService.createOrder` | `{ email, phone, objectKey }` | `{ ok: true, orderId, amountPaise, currency, keyId }` | `{ ok: false, error }` |
| `POST /api/sera/payment/verify` | `seraPaymentService.verifyPayment` | `{ orderId, paymentId, signature }` | `{ ok: true, paymentId }` | `{ ok: false, error }` |
| `POST /.netlify/functions/sera-start-call` *(exists; make per-round)* | `seraCallService.startRoundCall` | `{ sessionId, round, route, email, name, studentCode, paymentId, objectKey, highlight, field }` | `{ success: true, sessionId, callId, accessToken }` | 403 `{ error: 'already-used', message }`; `{ error }` |
| `POST /.netlify/functions/sera-release-reservation` *(exists)* | `seraCallService.releaseReservation` | `{ email }` | `{ released: true }` | `{ error }` |
| `POST /api/sera/offers/choose` | `seraOffersService.saveOfferChoice` | `{ sessionId, offerId }` | `{ ok: true }` | `{ ok: false, error }` |
| `POST /api/sera/session/end` | `seraSessionService.markCandidateEnded` | `{ sessionId }` | `{ ok }` | — |
| `POST /api/sera/session/lost` | `seraSessionService.reportConnectionLost` | `{ sessionId, round }` | `{ ok, rejoinIssued }` | — |
| `POST /api/sera/rejoin` | `seraSessionService.redeemRejoin` | `{ token \| code, email, phone }` | `{ ok: true, session, round }` | `{ ok: false, reason: 'expired' \| 'used' \| 'mismatch' \| 'invalid' }` |
| `POST /.netlify/functions/sera-get-report` *(exists)* | `seraCallService.fetchReport` (polled every 2 s) | `{ email, sessionId }` | `{ ready: false }` \| `{ ready: true, report }` \| `{ ready: true, incomplete: true }` | 4xx/5xx → keeps polling |
| `POST /api/sera/report/download` | `seraReportService.downloadReport` | `{ sessionId }` | `{ ok: true, url, filename }` | `{ ok: false, error }` |

Server-only (no frontend caller): `sera-retell-webhook` (Retell), `/api/sera/payment/webhook` (Razorpay).

## 3. Which pure module each endpoint calls

| Endpoint | Module (import from) |
|---|---|
| `sera-extract-resume` | `generateOffers(llmCall, { resumeText, field, highlight })` — `netlify/lib/seraOffers` (validates, retries once, then throws) |
| `/api/sera/login` | `cleanFirstName(google.name)` — `netlify/lib/seraCall`; `createSession(...)` — `src/shared/seraSession.js` |
| `sera-start-call` | `pickAgentId(round)`, `buildCallVariables(session, round)` — `netlify/lib/seraCall` |
| `sera-retell-webhook` (screening, HR) | `buildSummaryPrompt(transcript, round)` + `SUMMARY_LLM_SCHEMA` → `parseSummary(json)` — `netlify/lib/seraCall` |
| `sera-retell-webhook` (final) | `generateReport(llmCall, { transcripts, chosenOffer, resumeHighlights, route, firstName, interviewDate })` — `netlify/lib/seraReport`; then `renderReportPdfOnServer(report)` — `netlify/lib/seraReport/pdfAssets.node.js` |
| `/api/sera/report/download` + team copy | the PDF stored by the webhook (rendered once by `renderReportPdfOnServer`) — never re-render, never re-run the LLM |

`llmCall` is `({ prompt, schema }) => generateJson({ prompt, schema })` from `netlify/lib/openai.js`. The PDF needs the logo + fonts bundled: `netlify.toml` → `[functions] included_files` (already set).

## 4. Razorpay (New User only — route id `'visitor'`, label "New User")

- **create-order:** amount from **server config**, ₹249 = `24900` paise, `INR` — never from the browser (`src/config/seraPricing.js` is display-only). Store the order with the email it was created for. Check eligibility here too, so nobody pays for an interview they can't start.
- **verify:** `HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)` (hex) must equal `signature`; constant-time compare; the order must belong to that email. Mark the payment **verified + unused**.
- **webhook** (`payment.captured`, backup for a closed browser): verify `X-Razorpay-Signature` with `RAZORPAY_WEBHOOK_SECRET`; **idempotent on `payment_id`** (webhook + verify, or retries, never create two records/interviews).
- **start-call** refuses a New User without a **verified, unused** `paymentId` for that email, and marks it used when the call is created. A verified-but-unused `paymentId` must be accepted on retry (the frontend resends it; the user is never charged twice).
- The one-interview-per-Google-account gate in `sera-start-call` must become "one interview per payment / seat", or a returning New User would pay and then be blocked.

## 5. MSG91 (WhatsApp OTP)

- In the MSG91 dashboard the widget (`VITE_MSG91_WIDGET_ID`) must be set to the **WhatsApp** channel — the page tells users the code comes on WhatsApp.
- `/api/sera/login` **verifies the success token server-side** with `MSG91_AUTH_KEY` (confirm the exact verify-access-token request in MSG91's current docs) and uses the phone MSG91 confirms (`91` + 10 digits). The browser callback alone proves nothing. `verify-otp.js` (Builder/Partner forms) does not do this — don't copy it.

## 6. Retell (3 agents, 3 calls)

- One agent per round: `RETELL_AGENT_ID_SCREENING` (Sera, 300 s), `RETELL_AGENT_ID_HR` (Vinit, 180 s), `RETELL_AGENT_ID_FINAL` (Arvind, 180 s). Set each agent's max call duration in Retell to match (hard backstop).
- `sera-start-call` per round: load the session by `sessionId`, `agent_id = pickAgentId(round)`, `retell_llm_dynamic_variables = buildCallVariables(session, round)`, `metadata = { sessionId, round }`. Exact variable lists: [interview contract → Per-round calls](sera-interview-contract.md#per-round-calls-netlifylibseracall). **No call runs while the candidate picks an offer.**
- Webhook per round (`call_ended`, signature checked): store `rounds[round].transcript` (`[{ role, text, start, end }]` from `transcript_object`) and `callId` on the session found by `metadata.sessionId`; idempotent on `call_id`. After screening → `summaries.screening`; after HR → `summaries.hr`; after final → report **once** (+ PDF). Retell's agent/model/prompt config lives in Retell's dashboard, not in code.
- **Silence hang-up ≠ network drop.** An inactivity/silence end or an agent/max-duration end is a finished (possibly short) round — the report shows "Not enough to score" where evidence is thin. Only a real connection failure, **and** the candidate didn't press End (`/api/sera/session/end`), is `dropped`. Confirm the exact `disconnection_reason` values in Retell's current docs — don't guess.

## 7. Money and one-time rules

1. **One payment = one session. One student seat = one session.** Bound at reserve time; a seat is consumed when the interview actually starts, not at login.
2. **Max 1 rejoin per session.** A second drop sends no new link/code — email the admin instead (`rejoinIssued: false`).
3. Rejoin token/code: random, single-use, 48 h, bound to session + email + phone. New User → link on WhatsApp; Student → code typed in the Student code field.
4. **Rejoin never creates a Razorpay order and never consumes another seat**; it restarts the dropped round, keeping earlier rounds and the chosen offer.
5. **The report and its LLM call run once**, after the final round. `sera-get-report` and the download are reads only.
6. All webhook handling is idempotent (Retell `call_id`, Razorpay `payment_id`). Admin email on every drop and rejoin.

## 8. Test checklist after wiring

- [ ] `npm test`, `npm run lint`, `npm run build` pass; `node --check` on every changed function.
- [ ] Deploy succeeds on Netlify (a push is not a deploy — check the Deploys page) and function logs are clean (`npx netlify logs --function <name> --since 1h`).
- [ ] Student: valid code → login → upload → no pay screen → screening → 3 offer tiles (invented companies, `₹x–y LPA`) → HR → Final → report + PDF.
- [ ] New User: login → upload → pay ₹249 (Razorpay test mode) → verify → screening … report. Closing the popup or a failed payment creates no call.
- [ ] Tampered `signature` → verify fails. Replayed webhook → still one payment record.
- [ ] start-call with no/used `paymentId` (New User) or no seat (Student) → refused, no Retell call created.
- [ ] Retell call logs show the exact variables per agent (screening 3, HR 8, final 10); HR/Final mention the chosen offer.
- [ ] A non-résumé PDF → "doesn't look like a résumé", no offers generated, no call.
- [ ] End early in HR → no rejoin; report shows "Not enough to score" for the short rounds, never a guessed number.
- [ ] Drop the network in HR → one rejoin link/code on WhatsApp → rejoin restarts HR, no payment, no seat. Second drop → admin email, no link.
- [ ] Exactly one report LLM call per interview (OpenAI usage), PDF downloads with `Sera-Report-<Name>-<date>.pdf`, team copy emailed on the first download only.
- [ ] Production bundle: `grep` of `dist/` finds no mock data, test accounts or secrets.

## TODO(backend) list

Generated with `grep -rn "TODO(backend)" src netlify` (file:line — note):

- `src/hooks/useSeraInterview.js:249` — real Retell drops — call this from the Retell disconnect
- `src/hooks/useSeraInterview.js:386` — real mode — startRoundCall(session, 'hr') once the server supports it.
- `src/hooks/useSeraInterview.js:523` — start the rejoin call via startRoundCall(session, round)
- `src/services/seraAuthService.js:65` — POST /api/sera/student-code/check — not built yet.
- `src/services/seraAuthService.js:83` — POST /api/sera/login — not built yet. Server must verify the
- `src/services/seraCallService.js:26` — only 'screening' is live today; 'hr' and 'final' need the
- `src/services/seraOffersService.js:30` — POST /api/sera/offers/choose — not built yet.
- `src/services/seraPaymentService.js:29` — POST /api/sera/payment/webhook (Razorpay) — idempotent on payment_id.
- `src/services/seraPaymentService.js:43` — POST /api/sera/payment/create-order — not built yet.
- `src/services/seraPaymentService.js:56` — POST /api/sera/payment/verify — not built yet.
- `src/services/seraReportService.js:73` — POST /api/sera/report/download — not built yet.
- `src/services/seraResumeService.js:42` — sera-extract-resume must return `offers` (generateOffers).
- `src/services/seraSessionService.js:39` — POST /api/sera/session/end — not built yet.
- `src/services/seraSessionService.js:64` — POST /api/sera/session/lost — not built yet. The server must
- `src/services/seraSessionService.js:104` — POST /api/sera/rejoin — not built yet.
- `netlify/functions/sera-extract-resume.js:65` — after a valid résumé, call generateOffers(llmCall, { resumeText, field, highlight })
- `netlify/functions/sera-get-report.js:6` — look the report up by sessionId (the body now carries it), not only by email.
- `netlify/functions/sera-release-reservation.js:10` — verify the caller owns this email (Google token / session) before releasing —
- `netlify/functions/sera-retell-webhook.js:184` — per round — store rounds[round].transcript by metadata { sessionId, round }; after
- `netlify/functions/sera-start-call.js:23` — per-round calls — load the session by sessionId, use pickAgentId(round) and
