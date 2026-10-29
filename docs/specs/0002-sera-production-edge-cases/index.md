# 0002. Meet Sera: production edge cases

**Date**: 2026-10-26
**Status**: Accepted (two rule changes confirmed with the owner on 2026-10-26)

## Summary

This is a full pass over what a real candidate can run into, from sign-in to the PDF. It covers the backend on YZIVPS and the page. The goal is that no paid or code-based interview ends in a dead end, nobody is charged twice, and nobody can get free calls. No live Vapi call was made. The résumé path was tested on production with the demo code; everything else ran against the real server process with fake providers (`server/edgeCases.test.js`).

## Rule changes (confirmed by the owner)

1. **A lost call.** The call ends before the offers appear, the candidate did not press End, and Sera did not end it herself. The cause can be a network or provider error, a refresh, a closed tab, or silence. The interview then gets **one free restart** from Sera, with no new payment and no new seat, so one interview costs at most two calls. After the offers, or on a second loss, the one report is built **from what was said**. A candidate who said nothing at all gets no report. Code: `netlify/lib/seraVapi/afterCall.js`.
2. **A failed report** (an OpenAI error, a timeout, or a failed validation) is retried **once** automatically, 20 s later. That gives at most two report runs per interview, the same cap that restart recovery already had. Code: `finalizeReport` in `server/index.js`, `canClaimReport` in `server/recovery.js`.

## Edge cases and how each is handled

| # | What the candidate hits | Before | Now |
|---|---|---|---|
| 1 | Pays, then the tab closes, the phone locks or the network drops before the page confirms the payment | Money taken, order stays "created", and signing in again asks them to pay again | At login, at create-order and at start-call, the server asks Razorpay (`GET /v1/orders/{id}/payments`) about that email's unconfirmed orders. A captured or authorized payment counts as verified, so they are never charged twice |
| 2 | Pays, the confirm call fails | "You haven't been charged" (false) | Retried 4 times. If it still fails: "Your payment went through... don't pay again", and case 1 picks it up |
| 3 | Refreshes the page at any step | Everything is lost (state was in memory only) | The session id is kept in `sessionStorage`. The page reopens at the right step: upload, pay, wrap-up, restart or report |
| 4 | Closes the tab or comes back on another device | A new session: blocked as "already used", and the report can't be seen | Login finds this email's interview and reopens it (`resumed`). They see the report, the wait, or the restart |
| 5 | Refreshes or closes the tab during the call by accident | The call ends and the interview is lost | The browser asks before leaving. If they leave before the offers anyway, they get the one free restart (rule 1) |
| 6 | Network or provider drop mid-interview | The "lost" screen promised a WhatsApp rejoin link that is never sent (a squad call can't be rejoined) | Before the offers: restart screen (rule 1). After: the report on what was said. No rejoin codes are issued |
| 7 | Microphone blocked, missing or busy, or the page is open in an in-app browser (WhatsApp, Instagram) | Seen only after the call was created and the payment used: "call dropped unexpectedly" | The mic is checked before the résumé read, the payment and the call. Each case gets a specific instruction |
| 8 | A start that stalls is released by the page | The Vapi call kept running, so a page could release and keep talking, again and again, on one payment | The server ends the released call (`end-call`). Forgiveness is capped at 3 per session |
| 9 | Report generation fails once (OpenAI 429/5xx, timeout) | `report_failed` with nothing for the candidate | One automatic retry (rule 2). The page keeps waiting, for up to 6 minutes |
| 10 | Report still not ready after 90 s | "On its way by email" (no email exists) | The page polls for 6 minutes. After that, an honest message: it is saved, and a refresh or a later login shows it |
| 11 | Candidate said nothing, or the report failed twice | "We'll get you scheduled for another session" (nothing schedules it) | Two honest messages that point to the site's contact form |
| 12 | The PDF render or upload failed when the report was built | The download link pointed to a missing file | The download renders the PDF from the stored report (no LLM call) and stores it |
| 13 | Two students take the last seat at the same moment | A race on the seat file could give both of them the seat | Seat changes are serialized, so exactly one gets it |
| 14 | Double click, or two tabs reading the résumé | Two OpenAI reads | One read per session at a time, at most 6 per session, 20 per IP per 10 min |
| 15 | Anyone calls create-order or create-upload directly | Razorpay orders were created with any email, and uploads were unlimited | An order needs a signed-in New User session, and the email comes from the session. A recent unpaid order is reused. Uploads are rate-limited per IP |
| 16 | A replayed payment verify | Reset `used: false` on a used payment | A known order only, and `used` is never reset |
| 17 | A slow or hung provider | Requests had no timeout and could hang behind Apache's 120 s proxy limit | Timeouts on every outbound call: OpenAI résumé 50 s per step, report 180 s, Vapi create 20 s, Vapi control 10 s, Razorpay 10–15 s, Google and MSG91 10 s |
| 18 | A page says "connection lost" | Marked the live session `dropped`, which broke the offer pick | Recorded as a note only. Vapi's end-of-call report decides |
| 19 | No Google account | Could not sign in | "No Google account? Use WhatsApp and your email": a typed name and email (not verified) plus the WhatsApp OTP. Still one interview per email. A typed email never takes an admin or demo email, reopens an interview only from the WhatsApp number that took it, and only unlocks a payment made from that number (owner request, 2026-10-26) |
| 20 | A report fails twice | Nobody on our side knew | An email alert to `SERA_ALERT_EMAIL` through the VPS Postfix (`server/alert.js`) |
| 21 | Pay screen mentions Terms and Refund Policy | Neither page existed | `/terms` and `/refund-policy` (`src/pages/Policies.jsx`), linked from the pay screen. The wording is a draft for the owner to review |

Already handled before this pass, and re-checked: a bad, blank or non-résumé PDF (rejected with the reason, no offers and no charge); a 10 MB upload through Apache and ModSecurity; one interview per email; a payment marked used only after the call exists; a webhook delivered twice; a webhook for a stale call; a server restart mid-call (recovery, spec 0001); the offer pick cap; `controlUrl` and résumé text never sent to the browser.

## Acceptance

- `server/edgeCases.test.js` (13 cases), `netlify/lib/seraVapi/afterCall.test.js`, `netlify/lib/seraPayment/seraPayment.test.js` and `server/resumePoint.test.js` cover the rows above. The full suite passes.
- On production (2026-10-26), using the demo code with no Vapi call: a real résumé went through the check and offers in about 9–10 s. An invoice and a blank PDF were rejected with reasons. `session/get` leaks neither `controlUrl` nor the résumé text.

## Open (owner)

- ~~`MSG91_AUTH_KEY`~~ set on YZIVPS on 2026-10-26. Key and widget (`SecureOTPWidget4QIQ`, default channel WhatsApp, retry SMS/email) are in the same MSG91 account "yzi". The server verifies every WhatsApp OTP. `send-otp.js` sent `widget_id` (MSG91 answered "Widget Not Found" while the function reported success); it now sends `widgetId` + `tokenAuth` and reports failures.
- Review the wording of `/terms` and `/refund-policy` (refund window 7 days, reply in 3 working days, the ₹249 price).
- A Razorpay webhook (`payment.captured`) would make case 1 instant. It needs a webhook secret from the Razorpay dashboard.
