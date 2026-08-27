# YZI Works — project context for Claude

This file is auto-loaded by Claude Code at the start of every session in this
repo. Read it before doing anything else. It exists so work on the "Meet Ai
Sera" feature survives across chat sessions/context resets — the user is
switching to a fresh chat right after this file is written because context
filled up, so treat this as the single source of truth going forward, not
a supplement to conversation history you don't have.

## What this project is

YZI Works (Young Zone India Works) — a live, production React 19 + Vite +
Tailwind 4 site on Netlify. Repo: `rajeshkrog-max/YZIWORKSADMIN`, branch
`main`. Backend is Netlify Functions (`netlify/functions/*`), no traditional
database — Netlify Blobs is used as a lightweight KV store where needed.

**This is a live site people actually use to apply for programs. Treat it
accordingly — isolated new files for new features, don't touch working code
unless asked, verify locally (`npm run build`, `npm run lint`) before pushing.**

Existing core flow (do not touch without explicit instruction): Early
Builder / Early Partner application forms (`src/components/EarlyBuildersForm.jsx`,
`EarlyPartnersForm.jsx`) → MSG91 phone OTP → Cloudflare R2 presigned upload →
`netlify/functions/verify-otp.js` emails the team via Resend.

## Current initiative: "Meet Ai Sera" — AI voice interview feature

**Status as of 2026-08-27 (end of day): fully built, pushed, and live-tested
up through résumé validation. The one remaining untested piece is the
actual live voice call itself (Retell connection, webhook, report
delivery) — that's the very next thing to verify.** Read the actual current
source before making changes — don't rebuild from memory of this doc:
`src/pages/MeetSera.jsx`, `src/components/sera/`, `src/hooks/useSeraInterview.js`,
`netlify/functions/sera-*.js`, `netlify/lib/*.js`.

### What it is

The "Meet Ai Sera" nav item is a real page at `/meet-sera` (was: opened
`VideoModal.jsx`, played `sera.mp4` — now fully replaced). Flow: Google
sign-in → upload one PDF résumé → **5-minute live speech-to-speech
interview** with "Sera" (Retell AI, default Retell voice, no ElevenLabs) →
on-screen strengths/growth-areas report + 3-tier career roadmap. Fully
decoupled from the application funnel — no OTP, doesn't touch `verify-otp.js`.

### Locked interview mechanics (from user's team — do not redesign without re-confirming)

Exact 5-minute clock, not open-ended:

| Time | Who | What |
|---|---|---|
| 0:00–0:15 | Sera | Greeting + rules, no question yet |
| 0:15–0:55 | Q1 Warm-up | "How was your day" — English sample, never called a grammar test |
| 0:55–1:50 | Q2 Skill | Easy, resume-fact based |
| 1:50–2:50 | Q3 Skill | Branches on Q2: weak → "which tool/task were you comfortable with"; clear → "what was hardest, how'd you handle it" |
| 2:50–3:50 | Q4 Skill | Practical/scenario |
| 3:50–4:35 | Q5 Close | Target role + CTC band + timeline, ONE combined question, salary never asked first/bare |
| 4:35–4:55 | Sera | Thanks, says roadmap is coming |
| 4:55–5:00 | System | Hard stop |

Only 1 warm-up + 3 skill + 1 close. Difficulty is intentionally dumb: 2
levels only (Basic/Average), never Hard.

**UI must be quiet** — orb + clock + whose turn it is, nothing else.
Implemented in `SeraInterview.jsx` / `useSeraInterview.js`:
- Always-visible 5:00 session countdown
- Separate 35s turn timer, visible only while candidate is speaking (ring
  amber at 10s left) — this is real cost control, an unbounded answer eats
  the paid minute
- State indicator: `Sera speaking` / `Your turn` / `Wrapping up` — no live
  transcript dump on screen (deliberately not built — see "Known gaps" below)
- Sera never explains the roadmap live — that renders after `end_call`, on
  the report screen

### Retell system prompt — CURRENT VERSION, paste-ready (revised 2026-08-27 for warmth)

The user explicitly wants Sera to sound like a genuine, warm, perceptive
HR person — not robotic, not a script reading machine. This version was
rewritten for that specifically: real acknowledgment before moving on,
graceful "we're short on time, let's skip this, that's fine" language
instead of an abrupt cutoff, gentle silence handling. **This is the
prompt as of this writing — if the user says they've changed it again in
Retell's dashboard since, that supersedes this copy; ask if unsure.**

```
You are Sera — warm, sharp, and genuinely curious about people. This is a 5-minute conversation, not a test, and it should never feel like one. Talk the way a thoughtful, senior person at a company would talk to someone they actually want to see do well — not like a script, not like a form being filled in.

How to sound human, not robotic:
- Actually react to what they say before moving on. A short, real acknowledgment first ("That's a solid range of work," "Good, that's exactly the kind of detail I wanted") — then the next question. Never jump straight from their answer to your next line with no reaction.
- Vary your acknowledgments. Don't repeat the same phrase every time.
- Speak short. One question at a time. Never stack two questions together.
- Do not ask name, email, phone, or résumé details already known — you've already read their résumé.
- Max 1 follow-up per question.

Handling time and silence like a person would, not a timer:
- If they're still going past 30 seconds, don't just cut in — acknowledge what they've said so far first, THEN move on warmly. Example: "Got it, that gives me a good sense — let's keep moving so we get to everything." Never sound impatient or abrupt.
- If they go quiet, don't rush them. Wait a moment, then check in gently: "Take your time — even two or three lines is enough whenever you're ready."
- If we're genuinely running short on time and a question hasn't been answered yet, say so honestly and kindly, and offer to skip it — for example: "We're a little tight on time, so let's skip this one and move to the next — that's completely fine." Never make them feel rushed or judged for it.
- If they seem to misunderstand a question, rephrase it once, simply — don't just repeat it louder or robotically.

What never to do:
- Do not score them on the call.
- Do not explain strengths, weaknesses, or roadmap on the call — that comes after, on their screen.
- Never say "grammar test" or "evaluating your English."
- Simple English. Hinglish is okay if the user uses it — match their language naturally, don't force English.
- After the last answer, thank them warmly and specifically — reference something real they said — then end the call.

Flow:
1) Greet with the welcome message, then ask Q1.
2) Q1: "How was your day today? Tell me in 20 to 30 seconds."
3) Q2: "From your recent work, what did you actually do? Explain simply."
4) Q3: If Q2 was weak, ask "Which task or tool were you most comfortable with?" If Q2 was clear, ask "What was the hardest part, and how did you handle it?"
5) Q4: "If you got a small task in your field tomorrow, what would you start with first?"
6) Q5: "Last question. What role are you targeting next, what salary band, and by when? A range is fine, like 3 to 4 LPA or 6 to 8 LPA."
7) Close: Thank them, referencing something specific and real from the conversation, then say: "I'll now prepare your strengths and a short roadmap on the screen." Then end the call.

Never start a new question after the closing line.
```

**Still open / not confirmed:** (1) whether résumé text is actually reaching
this prompt as a dynamic variable so Q2 references something real — the
backend passes `candidate_name`, `resume_highlight`, `field` as
`retell_llm_dynamic_variables` in `sera-start-call.js`, but whether the
Retell LLM config actually *uses* `{{resume_highlight}}` in its prompt/state
needs checking in Retell's dashboard, not just our code. (2) The 5:00 hard
stop should also be set as Retell's own max-call-duration dashboard field
(seconds = 300) as a hard backstop, not just prompt discipline — confirm
it's set.

### Cost control (this matters a lot to the user — "not even a single dollar wasted")

- **One interview per Google account**, enforced via Netlify Blobs
  (`sera-eligibility` store) — checked and reserved in `sera-start-call.js`
  *before* the Retell call is created.
- **`SERA_ADMIN_EMAILS`** (comma-separated env var, NOT hardcoded) bypasses
  that gate — set to `rajeshkrog@gmail.com` for the user's own repeat
  testing. **User still needs to add this to `.env` and Netlify** — it
  wasn't confirmed done as of this writing, check before assuming it works.
- **The analysis LLM call runs exactly ONCE per interview, not twice.**
  Originally the browser called its own analysis endpoint immediately AND
  the webhook ran a second, redundant one for email reliability — that
  was real double cost for zero benefit and was fixed (commit 628fcd8):
  now `sera-retell-webhook.js` is the ONLY place analysis ever runs; it
  stores the result inside the same Blobs record; the browser polls
  `sera-get-report.js` (zero LLM cost, pure Blobs read) every 2s for up to
  ~60s and displays whatever the webhook already computed. Don't
  reintroduce a client-side analysis call — if the polling approach needs
  changing, keep the "exactly one LLM call per interview" invariant.
- `sera-analyze-report.js` was deleted entirely — it was also an
  unauthenticated endpoint anyone could've called directly to burn money
  with no eligibility check. Don't recreate a similar unguarded endpoint.
- **User should also set a hard monthly spend cap directly in the OpenAI
  dashboard** (platform.openai.com/settings/organization/limits) as a
  backstop — not yet confirmed done, worth asking.

### LLM provider: OpenAI, not Gemini — full story, don't relitigate without new evidence

Original plan was Gemini (`GEMINI_API_KEY`). That key turned out to be
Google's new `AQ.`-format "Auth key" (confirmed real and current via
Google's own developer forums — Google is retiring `AIzaSy...` Standard
keys by Sept 2026), and it **never worked** despite trying three
independent, correctly-implemented auth methods against the real API:
`?key=` query param, `x-goog-api-key` header, and Google's own official
`@google/genai` SDK — all three returned the byte-identical `401
ACCESS_TOKEN_TYPE_UNSUPPORTED` error. Google Cloud Console's own "Create
API key" flow for Gemini now also forces service-account binding (not a
simple key) for this project, which would require full OAuth2
service-account JWT auth — a much bigger implementation, still with no
guarantee it'd resolve whatever is actually broken account-side. Given
time pressure, the user chose to switch providers rather than keep
debugging an unresolved Google-side issue.

**Now using OpenAI, model `gpt-5.6-terra`**, via `netlify/lib/openai.js`
(Responses API — `POST https://api.openai.com/v1/responses`, `text.format`
for strict JSON schema, not the older `response_format`). This was
**verified working end-to-end live**: real API key, real strict JSON
schema, real résumé text, HTTP 200, correct structured output. `OPENAI_API_KEY`
is confirmed present and working in both `.env` and Netlify.

`netlify/lib/gemini.js` is left in the repo, unused, as a reference in case
Google's account-side issue ever gets resolved and the user wants to
switch back — it is not imported by anything currently.

### Tech stack decisions

- New, isolated files only: `src/pages/MeetSera.jsx`, `src/components/sera/*`,
  `src/hooks/useSeraInterview.js`, `src/utils/seraUpload.js`,
  `src/utils/googleAuth.js`. Zero edits to the existing form components or
  `verify-otp.js`. Existing files touched: `src/App.jsx` (one route),
  `src/components/Navbar.jsx` (one nav link), `eslint.config.js` (scoped
  Node globals to `netlify/**`, fixed 61 pre-existing false-positive lint
  errors, no behavior change), `public/_headers` (new file, COOP fix, see
  below).
- Sign-in: Google Identity Services token-client flow
  (`src/utils/googleAuth.js`), not the existing MSG91 phone OTP. Needed two
  fixes to actually work live: (1) the deployed origin
  `https://yziworks.netlify.app` had to be added under Authorized
  JavaScript origins in Google Cloud Console (user did this, config-only);
  (2) default `Cross-Origin-Opener-Policy: same-origin` was silently
  blocking the sign-in popup from ever signaling back to the page, hanging
  forever on "Signing you in…" — fixed via `public/_headers` setting
  `same-origin-allow-popups` (commit 6eacdea).
- Résumé storage: reuses existing R2 bucket/credentials, new folder
  namespace (`sera-interviews/`), PDF-only, single file, 10MB cap,
  validated both client- and server-side.
- Résumé validation: `sera-extract-resume.js` extracts text via `pdf-parse`
  **v2**, which has a completely different class-based API than the old
  v1 (`new PDFParse({ data: buffer })` → `await parser.getText()` →
  `await parser.destroy()` — NOT the old `pdf(buffer)` function). Then one
  OpenAI call both validates "is this really a résumé" AND extracts a
  specific highlight sentence + field, in one round trip.
- Orb: ported from the open-source **VoiceOrbs "Particles Orb"**
  (MIT licensed, github.com/amunozdev/voiceorbs) — Fibonacci-sphere
  particle system with smooth state-blending. Adapted from its original
  Next.js/TypeScript form to plain Vite/React
  (`src/components/sera/orbMath.js` + `SeraOrb.jsx`). Live-tested on a
  real mobile viewport, renders correctly.
- Voice: Retell's own default voice. ElevenLabs was considered, explicitly
  dropped.

### Env vars — confirmed present in BOTH local `.env` and Netlify unless noted

Already existed: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_TO_EMAIL`,
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`VITE_MSG91_TOKEN_AUTH`, `VITE_MSG91_WIDGET_ID`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_TOKEN`.

Added for Sera, confirmed in both places: `RETELL_API_KEY`,
`RETELL_WEBHOOK_SECRET`, `RETELL_AGENT_ID`, `VITE_GOOGLE_CLIENT_ID`,
`OPENAI_API_KEY`.

Added for Sera, **NOT yet confirmed added** — check before assuming: `SERA_ADMIN_EMAILS`.

Present but unused/dead: `GEMINI_API_KEY` (the broken AQ. key — harmless to
leave, nothing imports `netlify/lib/gemini.js` anymore).

### Known gaps / deliberately deferred (not oversights — don't "fix" without asking)

- Live "current question" caption on the interview screen was deliberately
  NOT built — showing it needs the Retell `update` event's exact transcript
  field shape, which is unconfirmed without a live call. Only a state
  indicator (Sera speaking / Your turn / Wrapping up) ships in v1.
- The "Worth watching" resource-links panel and full YouTube-link section
  from the early prototype is not in the real report screen.
- `sera-extract-resume.js` and `sera-create-upload.js` aren't gated by the
  Google-sign-in/eligibility check the way `sera-start-call.js` is —
  someone could technically call them directly without signing in first.
  Low cost impact (cheap calls, and no voice-call cost is incurred unless
  they get all the way to `sera-start-call.js`), but a real minor gap if
  tightening further matters later.

### What's genuinely NOT yet verified (the actual next step)

Everything up through résumé upload + validation has been tested live on
the deployed site and confirmed working. **The live voice call itself —
Retell connecting, the webhook firing, the report actually rendering —
has never been exercised end-to-end.** That's the next real test. If it
fails, check in this order: (1) Retell dashboard — is `general_prompt` on
the correct LLM resource actually saved/published with the new prompt
above; (2) is max call duration set to 300s; (3) `sera-start-call.js`'s
dynamic variables actually reaching the agent; (4) the webhook signature
verification (`RETELL_WEBHOOK_SECRET` as the HMAC key, per
docs.retellai.com/features/secure-webhook — untested against a real
webhook call); (5) `sera-get-report.js` polling actually finding the
completed record.

### How to continue this work

1. This feature is far enough along that "do not code without asking"
   applies less rigidly than at the start — but any change to the locked
   interview mechanics, the Retell prompt, or the cost-control invariants
   above still needs explicit confirmation, not silent redesign.
2. Verify locally (`npm run build`, `npm run lint`, `node --check` on any
   new Netlify function) before pushing, every time.
3. The user writes fast/blunt feedback with typos and occasional profanity
   when frustrated — that's urgency, not hostility. Respond to the
   technical content.
4. When the user pastes a screenshot showing a secret value (API key,
   token), do not echo that value back in your response — read it from
   the actual file/source instead, and tell the user directly if a value
   was exposed and should be rotated.
5. When diagnosing an integration failure, verify against the provider's
   *current* real documentation before concluding — this project has hit
   multiple cases (`pdf-parse` v2's API, Gemini's AQ-key transition,
   OpenAI's Responses API format) where assuming based on general
   knowledge would have been wrong. Test empirically where possible
   (a real local call against the real API) rather than reasoning from
   docs alone.
