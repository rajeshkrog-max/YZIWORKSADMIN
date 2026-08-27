# YZI Works — project context for Claude

This file is auto-loaded by Claude Code at the start of every session in this
repo. Read it before doing anything else. It exists so work on the "Meet Ai
Sera" feature survives across chat sessions/context resets.

## What this project is

YZI Works (Young Zone India Works) — a live, production React 19 + Vite +
Tailwind 4 site on Netlify. Repo: `rajeshkrog-max/YZIWORKSADMIN`, branch
`main`. Backend is Netlify Functions (`netlify/functions/*`), no database.

**This is a live site people actually use to apply for programs. Treat it
accordingly — isolated new files for new features, don't touch working code
unless asked, verify locally before pushing.**

Existing core flow (do not touch without explicit instruction): Early
Builder / Early Partner application forms (`src/components/EarlyBuildersForm.jsx`,
`EarlyPartnersForm.jsx`) → MSG91 phone OTP → Cloudflare R2 presigned upload →
`netlify/functions/verify-otp.js` emails the team via Resend.

## Current initiative: "Meet Ai Sera" — AI voice interview feature

**Status as of 2026-08-27: real implementation is BUILT and PUSHED to main
(commit d37bd78). Route `/meet-sera` is live, all backend functions exist,
build + lint verified clean, dev-server click-through of hero → sign-in →
nav-link confirmed no console errors. See "What's NOT yet verified" below
before assuming this works end-to-end — the actual paid API calls (Retell
voice call, Gemini analysis, Resend email, the Blobs eligibility gate) have
NOT been exercised with real traffic yet, only reviewed against real API
docs and syntax-checked. If asked to keep building/fixing this feature,
read the actual current source under `src/pages/MeetSera.jsx`,
`src/components/sera/`, `src/hooks/useSeraInterview.js`, and
`netlify/functions/sera-*.js` — don't rebuild from this doc's earlier
planning notes below, which describe the *design*, not necessarily every
exact implementation detail.

**What's NOT yet verified (needs a real end-to-end test with a real
Google account, a real résumé PDF, and willingness to spend a little real
Retell/Gemini credit):**
- The Retell webhook signature verification (`sera-retell-webhook.js`) —
  built exactly to docs.retellai.com/features/secure-webhook, but never
  received a real webhook call yet.
- The Retell Client SDK event wiring in `useSeraInterview.js`
  (`agent_start_talking`/`agent_stop_talking`/`update`/`call_ended`) — event
  names confirmed from the SDK's real source on GitHub, but the actual
  `update` event's transcript field shape is assumed, not confirmed live.
- The Netlify Blobs one-per-account gate — logic is straightforward but
  unexercised.
- The interview screen's live "current question" caption was deliberately
  NOT implemented in v1 (only a state indicator: Sera speaking / Your turn
  / Wrapping up) — parsing the live question text from the transcript was
  judged too uncertain to ship without live testing. Can be added once the
  real `update` event shape is confirmed.
- The "Worth watching" resource-links panel from the earlier prototype was
  dropped from v1 scope — not in the real report screen yet.

### What it is

The existing "Meet Ai Sera" nav item (today: opens `VideoModal.jsx`, plays
`sera.mp4`) becomes a real page. Flow: Google sign-in → upload one PDF
résumé → a **5-minute live speech-to-speech interview** with "Sera" (Retell
AI, default Retell voice — **not** ElevenLabs, that was considered and
dropped) → on-screen strengths/weaknesses report + 3-tier career roadmap +
curated resource links + YZI community CTA. Fully decoupled from the
application funnel above — no OTP, doesn't touch `verify-otp.js`.

### Locked interview mechanics (from user's team — do not redesign without re-confirming with user)

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

Only 1 warm-up + 3 skill + 1 close — never 5 "real interview" questions.
Difficulty is intentionally dumb: 2 levels only (Basic/Average), never Hard.

**UI must be quiet** — one focus: Sera + clock + whose turn it is.
- Always-visible 5:00 session countdown (people relax when they see the end)
- Separate 35s turn timer, visible ONLY while candidate is speaking — this
  is the actual cost control (an unbounded answer eats the paid minute)
- Ring amber at 10s left, Sera soft-cuts-in at 3s left
- Silence: 8s → gentle nudge; +12s more → skip the question, no shaming
- Sera's own questions ≤8s spoken; she talks <70s total across all 5 min
- Current question shown as ONE short line, never a paragraph
- State must be visually obvious: `Sera speaking` / `Your turn` / `Wrapping up`
- **No live transcript dump on screen** — explicitly forbidden, "looks cheap,
  makes people self-conscious"
- Never show "Grammar test", "Evaluating English", a score, or a red error
  mid-call
- Sera does NOT explain the roadmap live — that renders after `end_call`,
  on the report screen

Data captured: fluency/clarity (Q1), resume-fit signal (Q2-Q4), target role
+ CTC band + timeline (Q5) — combined with pre-call form data (name, résumé
text, field, language) into the same JSON shape the report/roadmap
generation expects. Don't invent a separate scoring system.

### Retell system prompt (already written into Retell's dashboard by user — treat as source of truth, matches the spec above)

```
You are Sera, a calm interview coach. This is a 5-minute voice interview, not a test.

Rules:
- Speak short. One question at a time.
- Do not ask name, email, phone, or resume details already known.
- Max 1 follow-up per question.
- If the user talks more than 30 seconds, say "Got it" and move next.
- If silent, wait, then say "Take your time. Two or three lines is enough."
- Do not score them on the call.
- Do not explain strengths, weaknesses, or roadmap on the call.
- Simple English. Hinglish is okay if the user uses it.
- After the last answer, thank them and end the call.

Flow:
1) Greet with the welcome message, then ask Q1.
2) Q1: "How was your day today? Tell me in 20 to 30 seconds."
3) Q2: "From your recent work, what did you actually do? Explain simply."
4) Q3: If Q2 was weak, ask "Which task or tool were you most comfortable with?" If Q2 was clear, ask "What was the hardest part, and how did you handle it?"
5) Q4: "If you got a small task in your field tomorrow, what would you start with first?"
6) Q5: "Last question. What role are you targeting next, what salary band, and by when? A range is fine, like 3 to 4 LPA or 6 to 8 LPA."
7) Close: "That's our time. I'll now prepare your strengths and a short roadmap on the screen." Then end the call.

Never start a new question after the closing line.
```

**Two open items flagged for user, not yet confirmed:**
1. Q2 doesn't reference a specific résumé detail — confirm résumé text is
   actually passed to the agent as a dynamic variable and used somewhere
   (Q2 should feel like it's reacting to *this* person's résumé).
2. The 5:00 hard stop needs to be Retell's own max-call-duration dashboard
   setting (seconds), not just prompt discipline — confirm it's set to 300.

### Access control decision (OPEN — needs user's final call before going live)

User is paying per Retell/Gemini call and does not want random/unlimited
usage. Recommended approach, not yet built:
- **One interview per Google account**, enforced via **Netlify Blobs**
  (built-in KV store, no new DB needed) — check-before-allow in the
  webhook/start-call function.
- **Spend caps set directly in Retell's and Gemini's dashboards** as backup.
- Optional (product decision, not decided): gate the nav entry point behind
  "already applied" or an invite link, instead of being open to any visitor.

### Tech stack decisions

- New, isolated files only: `src/pages/MeetSera.jsx`, `src/components/sera/*`,
  `src/hooks/useSeraInterview.js`, `src/utils/seraUpload.js`. Zero edits to
  the existing form components or `verify-otp.js`.
- New Netlify functions needed: résumé text extraction, Retell webhook
  handler (transcript → Gemini analysis → Resend email), report/roadmap
  analysis endpoint, and (per access-control above) a check/reserve
  endpoint backed by Netlify Blobs.
- Sign-in: Google OAuth (ID-token flow, no client secret needed for this),
  not the existing MSG91 phone OTP.
- Résumé storage: reuses existing R2 bucket/credentials, new folder
  namespace, PDF-only, single file, 10MB cap.
- Analysis LLM: **Gemini** (`GEMINI_API_KEY`) — not Anthropic/OpenAI, that
  was the original plan but the user switched.
- Voice: Retell's own default voice. ElevenLabs was considered, explicitly
  dropped — do not add ElevenLabs integration unless user asks again.

### Env vars — confirmed present in BOTH local `.env` and Netlify dashboard (names only, never put actual values in this file or commit them)

Already existed: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_TO_EMAIL`,
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`VITE_MSG91_TOKEN_AUTH`, `VITE_MSG91_WIDGET_ID`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_TOKEN`.

New for Sera, confirmed added to both places: `RETELL_API_KEY`,
`RETELL_WEBHOOK_SECRET`, `RETELL_AGENT_ID`, `VITE_GOOGLE_CLIENT_ID`,
`GEMINI_API_KEY`.

### Prototype reference

A clickable HTML/CSS/JS mockup (no real APIs, all mocked/scripted) was
built and iterated in a Claude Artifact to validate look/feel before real
code — brand colors matched to real `src/index.css` tokens
(`--color-yzi-orange #FF5E00`, `--color-yzi-pink #FF008A`,
`--color-yzi-purple #8B5CF6`, `--color-yzi-cyan #22D3EE`), custom
Fibonacci-sphere particle orb as Sera's visual identity, Bricolage
Grotesque display font. **The prototype's interview screen does NOT yet
match the locked mechanics above** (it still types out a live transcript
and runs an open ~2-min script) — it needs to be rebuilt against the exact
spec in this file when the real interview screen gets built, not ported
as-is. The prototype is disposable/scratch — real implementation happens
fresh in this repo's actual source files.

### How to continue this work

1. Do not write real implementation code until the user explicitly says go
   — check the current conversation, don't assume a prior chat's "go"
   still applies.
2. For any new UI that's visually uncertain, prototype in a Claude Artifact
   first and iterate there before touching real source files — this is
   the user's established preference for this project.
3. Pull exact brand colors/type from `src/index.css` and existing
   components — never invent approximations.
4. Before committing/pushing to the live repo: run `npm run build` locally
   first, and only commit/push when the user explicitly asks for it (they
   have asked for this before, e.g. the announcement bar text change, but
   confirm per-change).
5. The user writes fast/blunt feedback with typos — respond to the
   technical content, not the tone.
