# Sera payment — backend contract

The New User pay screen is built and runs in mock mode. This doc is what the
server side needs to do to make it real. The frontend talks to the backend for
payment **only** through `src/services/seraPaymentService.js`.

> **Naming:** the paying route is shown to users as **"New User"**. Its internal route id is still **`'visitor'`** — in code, API bodies and stored data. Only the label changed.


## Where pay sits in the flow

- **New User** (route id `'visitor'`): login → upload PDF → preparing (R2 upload + résumé check) → **pay** → interview → wrapup → report
- **Student:** login → upload PDF → preparing → interview. **Students never pay** — they never see the pay screen, a price, or the Razorpay script.

Rules the frontend already follows:

- The pay screen appears only after the résumé check says the PDF is valid. A bad PDF goes back to upload and no order is created.
- The interview (`sera-start-call` + Retell) starts only after `verifyPayment` returns `ok`. Never on the Razorpay popup callback alone.
- Closing Razorpay or a failed payment keeps the user on the pay screen, where they can retry. No Retell call is created.
- If `sera-start-call` fails **after** a verified payment, the frontend keeps that `paymentId` and sends it again on the next attempt instead of asking the New User to pay again. The server must accept a verified-but-unused `paymentId` on retry.

## Endpoints

Both must return `Content-Type: application/json`. Netlify functions live at `/.netlify/functions/<name>` by default, so these `/api/...` paths need a redirect in `netlify.toml` or a `config.path` on the function. Until they exist, the service returns a friendly error ("We couldn't reach the payment server. You haven't been charged…"). Search for `TODO(backend)`.

### `POST /api/sera/payment/create-order` → `createOrder({ email, phone, objectKey })`

- Body: `{ email, phone, objectKey }` — `phone` is 10 digits without `+91`; `objectKey` is the résumé's R2 key.
- Response:
  - `{ ok: true, orderId, amountPaise, currency, keyId }`
  - `{ ok: false, error }` — `error` is shown to the user, so keep it short and human.
- `keyId` is the Razorpay **key id** (public). The frontend passes it to Checkout; `VITE_RAZORPAY_KEY_ID` is only a fallback.

### `POST /api/sera/payment/verify` → `verifyPayment({ orderId, paymentId, signature })`

- Body: `{ orderId, paymentId, signature }` — straight from Razorpay's success handler (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`).
- Response:
  - `{ ok: true, paymentId }`
  - `{ ok: false, error }`

## What the server must do

Amount from server config (₹249 = `24900` paise), signature check, the webhook, start-call refusing New Users without a verified unused payment, and the env vars: **[BACKEND_HANDOFF.md §4 and §1](BACKEND_HANDOFF.md)** — the single source for these rules.

## Before going live

- The pay screen says "By paying you agree to our Terms and Refund Policy". There are no Terms or Refund pages on the site yet, so it's plain text with a TODO. Razorpay usually requires both pages to be published before activating a live account.

## Mock mode (localhost)

`VITE_SERA_MOCK=true` on the dev server: no Razorpay script loads. "Pay ₹249" shows a short "Processing…" and goes straight into the interview (`createOrder` / `verifyPayment` return fake success). Payment failure and "popup closed" are tested from the floating DEV panel, which arms the outcome of the next Pay click. Mock mode also fakes the résumé upload + check (plain `vite` has no Netlify functions; a file name containing "bad" is rejected) and simulates the call itself (`src/services/seraMockCall.js`) — no `sera-start-call`, no Retell. None of the DEV-only pieces ship in a production build.
