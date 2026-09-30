# Sera interview — backend contract (rounds, offers, one-time rule, rejoin)

The frontend for the interview room, offer tiles, connection-lost screen and
rejoin runs in mock mode. This doc is what the server side needs to do to make
it real — especially **the money rules**. The frontend talks to the backend for
this **only** through:

- `src/services/seraResumeService.js` (résumé check + the 3 offers)
- `src/services/seraOffersService.js` (save the chosen offer)
- `src/services/seraCallService.js` (`sera-start-call` per round, release a reservation, poll the report)
- `src/services/seraSessionService.js` (intentional end, dropped call, rejoin)

**One session object** everywhere: `src/shared/seraSession.js` — `sessionId, route, firstName, email, phone, studentCode, resume { objectKey, highlight, field }, offers[3], chosenOfferId, rounds { screening, hr, final: { callId, status, transcript } }, summaries { screening, hr }, payment { orderId, paymentId }, report, status`. Store it server-side under `sessionId` in the same shape (plus `resumeText`, server-only).

Every endpoint below must return `Content-Type: application/json`. The `/api/...` paths need a redirect in `netlify.toml` or a `config.path` on the function. Search the frontend for `TODO(backend)`.

## Rounds

Configured in `src/config/seraRounds.js`:

**One flow for both routes** (New User and Student) — about 11 minutes:

| Round | Length | Interviewer | Retell agent (server env) |
|---|---|---|---|
| Screening | 5 min | Sera | `RETELL_AGENT_ID_SCREENING` |
| Pick an offer | no timer | — (no call runs) | — |
| HR round | 3 min | Vinit, HR | `RETELL_AGENT_ID_HR` |
| Final round | 3 min | Arvind, Business Head | `RETELL_AGENT_ID_FINAL` |

The only difference between routes is payment: **New User pays ₹249** (route id `'visitor'`), **Student uses an institute code** and doesn't pay.

Turn timer (one answer): 45 s in every round (`turnSeconds` in the config).

Between HR and Final the page shows a 2–3 s hand-over ("Connecting you to the final round with Arvind…").

Plan for the real calls: one Retell agent per round (IDs above — server-only env vars, never `VITE_`, never in `src/`). Screening runs first; HR and Final run after the offer choice with the chosen offer passed as dynamic variables. **No call runs while the candidate is choosing an offer** (no paid minutes burn during the choice).

> **Naming:** the paying route is shown to users as **"New User"**. Its internal route id is still **`'visitor'`** — in code, API bodies and stored data. Only the label changed.


## Résumé + offers (both routes)

`sera-extract-resume` → `prepareResume(file)`. After the résumé check passes, the **same function** calls
`generateOffers(llmCall, { resumeText, field, highlight })` (`netlify/lib/seraOffers/`) and returns them:

- Response: `{ valid: true, highlight, field, offers: [3] }` | `{ valid: false, reason }`
- Offer: `{ id, company, logoLetter, industry, city, workMode, role, ctcMinLpa, ctcMaxLpa, skills: [3], whyFit, finalTwist }`
- `generateOffers` validates strictly (`validateOffers`: exactly 3, no empty fields, invented company, `ctcMin < ctcMax`, sane LPA range, 3 different skills, offers differ in role or industry), **retries once**, then throws — return a 500 then; the frontend never shows broken tiles and never starts a paid call without offers.
- Store `resumeText` + `offers` on the server session. The browser keeps `resume` + `offers` on its session.

`POST /api/sera/offers/choose` → `saveOfferChoice(sessionId, offerId)`

- Body: `{ sessionId, offerId }` → `{ ok: true }` | `{ ok: false, error }`
- Sets `chosenOfferId`. The HR and Final agents' variables come from this offer.

## Per-round calls (`netlify/lib/seraCall/`)

`sera-start-call` body: `{ sessionId, round, route, email, name (= firstName), studentCode, paymentId, objectKey, highlight, field }`. The server loads the stored session and uses:

- `pickAgentId(round)` → `RETELL_AGENT_ID_SCREENING` / `_HR` / `_FINAL` (throws a clear error if one is missing).
- `buildCallVariables(session, round)` → `retell_llm_dynamic_variables`, **exactly**:

| Agent | Variables |
|---|---|
| Screening (Sera) | `first_name`, `field`, `resume_highlight` |
| HR (Vinit) | `first_name`, `company`, `city`, `work_mode`, `role`, `ctc_range` (`"₹6–8 LPA"`), `requirements` (the offer's 3 skills, comma list), `screening_summary` |
| Final (Arvind) | all HR variables + `hr_summary`, `final_twist` |

**Summaries** — generated from the round's transcript when its `call_ended` webhook arrives, **before** the next round starts: `buildSummaryPrompt(transcript, round)` + `SUMMARY_LLM_SCHEMA` → `parseSummary(json)` → `session.summaries.screening` (after screening) / `.hr` (after HR). Two neutral lines, no scores. A missing summary is sent as `''`, never blocks the call.

**Transcripts** — each round's `call_ended` webhook stores `rounds[round].transcript` as `[{ role, text, start, end }]` (times from the start of that call).

**Report** — once, after the final round's webhook: `generateReport(llmCall, { transcripts, chosenOffer, resumeHighlights, route, firstName, interviewDate })` (`netlify/lib/seraReport/`). See `docs/sera-report-spec.md`.

## Session statuses

```
reserved → live → completed | ended_by_candidate | dropped | failed_to_start
```

- **reserved** — payment verified (New User) or seat checked (Student); the session exists but no call yet.
- **live** — a Retell call for this session is running.
- **completed** — the final round finished normally.
- **ended_by_candidate** — the candidate pressed End and confirmed.
- **dropped** — the connection was lost (see the strict rule below).
- **failed_to_start** — the call never connected.

## The money rules

1. **One payment = one session. One student seat = one session.** The payment (New User) or seat (Student) is bound to the session at **reserve** time.
2. A seat is **consumed when the interview actually starts**, not at login (see the login contract).
3. **"dropped" only when BOTH are true:**
   - Retell's disconnection reason is a connection/network failure — **confirm the exact reason values in Retell's CURRENT docs**, don't guess; **and**
   - `markCandidateEnded` was **not** called for this session.

   If the candidate pressed End (or closed the tab after pressing End), it is **ended_by_candidate** — no rejoin.
4. **Max 1 rejoin per session.** A second drop does **not** send another link/code; instead email the admin for a manual decision. (`reportConnectionLost` returns `rejoinIssued: false`, and the frontend then says "Our team has been notified…".)
5. **Rejoin token / code:** random, **single-use**, **48 h expiry**, bound to **session + email + phone**.
   - New User → a **link** on WhatsApp: `https://…/meet-sera?rejoin=TOKEN`
   - Student → a **code** on WhatsApp, typed into the same "Student code" field
6. **Rejoin never creates a Razorpay order and never consumes another seat.** `sera-start-call` checks the session instead of payment/seat.
7. **Rejoin restarts the dropped round.** Earlier rounds (and the chosen offer) are kept.
8. **The report is generated once**, only when the final round completes.
9. **Admin email on every drop and every rejoin:** who, when, which round, the disconnection reason.
10. **All webhook handling is idempotent** on Retell `call_id` and Razorpay `payment_id`.

## Session endpoints

### `POST /api/sera/session/end` → `markCandidateEnded(sessionId)`

- Called **before** the frontend hangs up, when the candidate confirms "End interview". The frontend waits at most 1.5 s for it, then hangs up anyway.
- Body: `{ sessionId }` → `{ ok }`
- Effect: session → `ended_by_candidate`. No rejoin can be issued for it.

### `POST /api/sera/session/lost` → `reportConnectionLost(sessionId, round)`

- Called when the call drops without the candidate pressing End.
- Body: `{ sessionId, round }` (`round` = round id, e.g. `"hr"`)
- Response: `{ ok, rejoinIssued }`
- The server still decides using Retell's disconnection reason (rule 3). Only if it's a real drop **and** this is the first drop: create the token/code, send it on WhatsApp, return `rejoinIssued: true`. Otherwise return `rejoinIssued: false` (and email the admin).
- Frontend TODO: today only mock mode calls this. Real Retell drop detection must be wired once the server can confirm the reason.

### `POST /api/sera/rejoin` → `redeemRejoin({ token | code, email, phone })`

- Body: `{ token, code, email, phone }` (one of `token` / `code`), after the candidate has signed in with Google **and** verified WhatsApp on the login card. The server must verify the Google access token and MSG91 token the same way as `/api/sera/login`.
- Response:
  - `{ ok: true, session: <the session object>, round }` — `round` = the round to restart
  - `{ ok: false, reason: 'expired' | 'used' | 'mismatch' | 'invalid' }`
- On `ok`, mark the token/code used. The frontend then skips upload and pay and restarts `round`.

### Student rejoin codes in `checkStudentCode`

The Student code field accepts both campus codes and rejoin codes. `POST /api/sera/student-code/check` should also recognise rejoin codes:

- `{ valid: true, kind: 'rejoin' }` — a live rejoin code (identity is checked later by `/api/sera/rejoin`)
- `{ valid: false, reason: 'expired' | 'used' }` — so the candidate sees it before spending an OTP

## Mock mode (localhost)

With `VITE_SERA_MOCK=true` on the dev server, the DEV panel (bottom-right) drives everything: skip to the end of a round, jump to offers, end, drop the call, open the New User rejoin link (`REJOIN-LINK-TEST`) or use the student rejoin code (`REJOIN-TEST`; `REJOIN-EXPIRED` shows the expired state). Mock sessions live in `sessionStorage`. None of the DEV-only code ships in a production build.
