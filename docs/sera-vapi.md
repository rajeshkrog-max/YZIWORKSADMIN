# Meet AI Sera on Vapi — one squad call

The whole interview (Sera → Vinit → Sonia) is **one Vapi squad call**. The backend is `server/index.js` on YZIServer (Node, port 4005, kept running by `server/start.sh`; Apache forwards `/api/sera/*` and `/.netlify/functions/*` to it). The `sera-*` Netlify functions are legacy and not used. The four website form handlers (`send-otp`, `verify-otp`, `send-contact`, `r2-create-upload`) are still in `netlify/functions/` and run inside this server through `server/formEndpoints.js`.

Vapi logic is pure modules in `netlify/lib/seraVapi/` (unit-tested), wired into `server/index.js`:

| Module | What it does |
|---|---|
| `call.js` | `createVapiCall` — `POST https://api.vapi.ai/call/web` with the public key (server side), squad id from `VAPI_SQUAD_ID` |
| `control.js` | the two live-control messages for the offer handoff, and the POST to `controlUrl` |
| `squad.js` | squad member names ↔ round ids (browser-safe) |
| `clientEvents.js` | spots the `show_offers` tool call in Vapi messages; answers it on the server (browser-safe) |
| `webhook.js` | webhook credential check, end-of-call report → per-round transcripts, drop / report decision |

## Order of events (do not collapse these)

1. **Before any call.** The candidate uploads one PDF. `POST /api/sera/extract-resume` reads it with one OpenAI call (is it a résumé? highlight, field, text), then `generateOffers` builds the **3 offers from that résumé**. They are saved on the session. A bad PDF stops here: no offers, no call, no report PDF. No canned offers.
2. **Start one call.** `POST /api/sera/start-call` (`{ sessionId, paymentId }`):
   - refuses with 500 `Interview service is not configured` if `VAPI_PUBLIC_KEY` or `VAPI_SQUAD_ID` is missing — checked first, so nothing is reserved, charged or consumed;
   - needs a stored résumé under `sera-interviews/` and 3 stored offers;
   - New User: a **verified, unused** payment for the same email. It is marked used only after the call exists, so a retry after a failed start reuses it and is never charged twice;
   - Student: a valid code with a seat; the seat is taken after the slot is reserved and given back if Vapi fails;
   - one interview per email (`SERA_ADMIN_EMAILS` bypass), reserved **before** the call is created, deleted if Vapi fails;
   - creates the call, stores `controlUrl` on the **server** session only, returns `{ success, sessionId, callId, webCallUrl }`.
3. **During the call.** Sera finishes screening, says the offers are on screen, calls `show_offers`, then stays silent. The page mutes the mic, shows the stored cards, and starts a **45 s cap** (the call is open and silent, so this is cost control). No tap → `offers[0]` is picked.
4. **Card tap.** `POST /api/sera/offers/choose` (`{ sessionId, offerId }`). The server checks `offerId` is one of the 3 stored offers, then POSTs the control messages below to the stored `controlUrl`. Only after both succeed does the page start the HR round. Same call id throughout.
5. **After the call.** Vapi sends `end-of-call-report` to `/api/sera/vapi-webhook`. That is the **only** place the report and its PDF are generated — once per interview. The browser polls `POST /api/sera/get-report` (a plain read, no LLM).

## Control payload (offer handoff)

Sent in this order to `monitor.controlUrl` (stored per session):

```json
{ "type": "add-message", "triggerResponseEnabled": false,
  "message": { "role": "system", "content":
    "Candidate chose <company>, <role>, <city>, <workMode>, CTC ₹<min>–<max> LPA. Skills: <skills joined>. Why it fits: <whyFit>. Final-round situation: <finalTwist>. Use only this offer." } }
```

```json
{ "type": "handoff",
  "destination": { "type": "assistant", "assistantName": "Vinit – HR Round" },
  "content": "Connecting you to Vinit from HR." }
```

Every field comes from the chosen stored offer — nothing is hardcoded. The `handoff` is not sent if the `add-message` fails. A repeat tap is a no-op; a different card after the handoff is refused (409).

Vinit's own squad handoff goes to `sonia-final round`. Sonia has no handoff and ends the call.

**Squad prompt rules.** At call creation only the **screening** variables exist (`first_name`, `field`, `resume_highlight`), so Vinit's and Sonia's prompts must **not** depend on `{{company}}`, `{{role}}` etc. They read the offer from the system message above.

Sera's prompt must contain this rule, and her `handoff_to_assistant` must not fire at the end of screening:

> After the last screening question, say the three offers are on screen, call `show_offers`, then stay silent. Do not call `handoff_to_assistant`. The page hands off after the candidate picks a card.

`show_offers` is a tool on Sera's assistant. Its server URL is the webhook below; the server answers the `tool-calls` message so Vapi does not wait on it.

## What the saved squad needs (checked against the real squad, 2026-10-05)

| Where | State today | Needed |
|---|---|---|
| Sera | no `show_offers` tool; closing says offers appear on screen, then "end the call" | add the `show_offers` tool; closing: say offers are on screen, call `show_offers`, stay silent. Her `handoff_to_assistant` to Vinit stays but must not fire at the end of screening |
| Vinit | prompt and first message use `{{company}}`, `{{role}}`, `{{city}}`, `{{work_mode}}`, `{{ctc_range}}`, `{{requirements}}`; closing says "hand over to Arvind" | nothing fills those variables (the offer is chosen mid-call). Rewrite to read the offer from the system message; first message must not use them; hand over to **Sonia** |
| Sonia | prompt says "You are Arvind"; uses `{{company}}`, `{{role}}`, `{{final_twist}}` etc.; no way to end the call | same fix; call her Sonia; add an end-call tool |
| Server URL | none on the squad, the assistants or the org | set it (see Webhook) or no report is ever generated |
| Max duration | assistants have 300 s / 240 s / 240 s | the call passes 720 s; if Vapi applies the per-assistant values instead, Sera's 300 s would cut the call. Raise them |

## Webhook

- URL: `https://yziworks.com/api/sera/vapi-webhook`
- Credential: set the squad/assistant **Server URL credential** to a Bearer token equal to `VAPI_WEBHOOK_SECRET` (the legacy `X-Vapi-Secret` header is also accepted). With no secret configured, every request is refused (fails closed).
- Server messages needed: `end-of-call-report` and `tool-calls`.
- Rounds are split by the **assistant name Vapi puts on each message in a squad** (`Sera – Screening`, `Vinit – HR Round`, `sonia-final round`). If no message carries a name, a time mark from the handoff is the only fallback and a warning is logged.
- Idempotent per call: a stale call id, or a retry of the same report, does nothing. A report is never generated twice.
- What a call end means:
  - candidate said nothing → `incomplete`, no LLM call;
  - candidate hung up, silence, max duration, assistant ended → finished (possibly short) → report;
  - a transport/provider error before the final round, and the candidate did not press End → `dropped` (the lost screen), no report.

## Browser

`useSeraInterview.js` joins the server-created call with `@vapi-ai/web` (`reconnect({ webCallUrl })`, which never calls the Vapi API, so no public key is needed). It never holds a Vapi secret and never calls `vapi.start(squadId)`. It maps `call-start`, `speech-start/end` (the assistant's speech) and `show_offers` onto the existing turn pill and round rail. Mock mode (`VITE_SERA_MOCK=true`, Vite dev only) never touches Vapi.

## Env names (values go in `.env` on YZIServer, never in git)

| Name | |
|---|---|
| `VAPI_PUBLIC_KEY` | **server only** — creates the call. Vapi's `POST /call/web` answers 401 to a private key. Never `VITE_`, never sent to the browser |
| `VAPI_SQUAD_ID` | the "YZI Interview" squad |
| `VAPI_WEBHOOK_SECRET` | credential Vapi sends to the webhook |
| `VAPI_PRIVATE_KEY` | not used by the interview flow (only for reading the squad / calls by hand) |

`VAPI_API_BASE` and `OPENAI_API_BASE` exist only so `npm test` can run the real server against fakes.

## Tests

`npm test` includes `netlify/lib/seraVapi/seraVapi.test.js` (pure modules) and `server/vapiFlow.test.js`, which starts the real server in a temp data dir against a fake Vapi and fake OpenAI and checks: missing squad id → 500 and nothing created; one call per interview; no `controlUrl` in any browser response; the exact control messages for the chosen offer on the same call id; webhook auth; exactly one report and one LLM call even when the webhook is delivered twice; dropped / incomplete outcomes; the 90 s stall forgiveness.

## Verified against Vapi's real API (2026-10-05, with two probe calls that nobody joined)

- `POST /call` cannot create a web call (it demands a phone number). `POST /call/web` can, and it takes the **public** key (a private key gets 401). It returns 201 with `webCallUrl` (also `transport.callUrl`), `monitor.controlUrl` and `status: queued`.
- `maxDurationSeconds`, `metadata` and `monitorPlan` are **not** call-level fields: unknown top-level fields are silently dropped. They go in `squadOverrides` (the code does this). The metadata comes back as `call.squadOverrides.metadata`, not `call.metadata`; the webhook reads it there and otherwise finds the session by call id.
- The control URL accepts `add-message` and `end-call`, and **accepts `handoff` as a valid type** (a made-up type is rejected with 400 listing `handoff` among the valid ones). Whether a live handoff to `Vinit – HR Round` actually switches assistants needs a joined call.
- The squad "YZI Interview" exists with exactly the member names the code expects, and Sera → Vinit and Vinit → Sonia handoffs are configured.

## What a real call showed (2026-10-05, call of 633 s, $0.87)

- The whole squad flow works live: Sera → `show_offers` (229 s) → handoff to Vinit (251 s) → Vinit hands to Sonia (455 s) → Sonia (480 s).
- The handoff **control message works** (`handed to Vinit via handoff`), and its `variableValues` fill Vinit's first line ("HR at LumaCart Digital"). They **persist into Sonia's** first message too.
- Each **bot message carries `assistantName`** (and `assistantId`); user messages do not; tool results carry `name`. Roles seen: `bot`, `user`, `system`, `tool_calls`, `tool_call_result`.
- Vapi delivers `assistant.started` and `speech-update` (status started/stopped, role assistant/user) to the browser by default, and `assistant.started` to the server URL by default.

## Rounds and time (who ends what)

The page never stops the call. An earlier version force-stopped it at the final round's clock + 20 s; the clocks had drifted from the real conversation (Vinit ran about 3:25, not 3:00), so it cut Sonia off mid-sentence.

Vinit's and Sonia's prompts say *"You can't see a clock. The interview system … may send you a short system note about time remaining."* The server is that system (`netlify/lib/seraVapi/rounds.js`):

| When | What the server sends into the call |
|---|---|
| HR round starts (card tap) | HR timers start. 200 s in: `add-message` "Interview system note: time is nearly up." (read on the next turn). 240 s: "…time is up." (makes Vinit close and call `handoff_to_assistant`) |
| HR 265 s, Vinit still talking | `handoff` to `sonia-final round` — **only if** Vapi's round signals have been arriving (otherwise it could restart Sonia) |
| HR 275 s, no Vapi signals ever seen | assume Vinit handed off and start Sonia's timers |
| Sonia starts (`assistant.started` / `conversation-update` with her `assistantName`) | the same two notes at 200 s and 240 s |
| Sonia 260 s | `end-call`: Sonia has no end-call tool, so the server ends the call after her closing |
| Anything else | `maxDurationSeconds` 900 ends a call nothing else ended |

Round times live in one place, `src/config/seraRounds.js`: screening 300 (Sera ran 229 s), HR 240 (Vinit tells candidates "about four minutes"), final 240. Timers are in memory: a server restart mid-call loses them, and `maxDurationSeconds` is the backstop. The browser follows the server's round (`callRound` from `/api/sera/session/get`, polled every 2 s) and Vapi's own client messages. Its clock starts when Sera is actually audible (first `speech-update`), with a "Connecting…" state before that; the SDK reports `call-start` twice, so the second is ignored.

`SERA_ROUND_TIME_SCALE` (default 1) shrinks the timer delays and exists only so `npm test` can run a whole interview in seconds.

## Not verified (check on the next live call)

- That a live `handoff` control message really moves the call to Vinit. If it does not, the server asks Sera to use her own `handoff_to_assistant` tool instead (logged as `via nudge`).
- That the server's `assistant.started` / `conversation-update` messages carry the same assistant name (if not, the blind-mode fallback above applies; look for `-> final (assumed` in `~/yzi-backend/yzi-backend.log`).
- The shape of the `tool-calls` message for `show_offers` (the code accepts every shape Vapi has used).
- That Apache forwards the `Authorization` header to port 4005 for the webhook (`curl` it once).

## Known limits

- **Rejoin after a drop** is not implemented on the squad: a squad call always starts at its first member, so restarting at HR or Final needs a decision. The lost screen and the `/api/sera/rejoin` endpoint exist but cannot restart a call.
- The Netlify functions (`netlify/functions/sera-*`) and `netlify/lib/seraCall/agents.js` are the old Retell path and are unused.
