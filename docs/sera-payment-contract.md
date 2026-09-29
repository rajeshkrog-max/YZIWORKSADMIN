# Sera payment — backend contract

The visitor pay screen is built and runs in mock mode. This doc is what the
server side needs to do to make it real. The frontend talks to the backend for
payment **only** through `src/services/seraPaymentService.js`.

## Where pay sits in the flow

- **Visitor:** login → upload PDF → preparing (R2 upload + résumé check) → **pay** → interview → wrapup → report
- **Student:** login → upload PDF → preparing → interview. **Students never pay** — they never see the pay screen, a price, or the Razorpay script.

Rules the frontend already follows:

- The pay screen appears only after the résumé check says the PDF is valid. A bad PDF goes back to upload and no order is created.
- The interview (`sera-start-call` + Retell) starts only after `verifyPayment` returns `ok`. Never on the Razorpay popup callback alone.
- Closing Razorpay or a failed payment keeps the user on the pay screen, where they can retry. No Retell call is created.
- If `sera-start-call` fails **after** a verified payment, the frontend keeps that `paymentId` and sends it again on the next attempt instead of asking the visitor to pay again. The server must accept a verified-but-unused `paymentId` on retry.

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

- **Amount from the server, never the browser.** Create the Razorpay order with the amount from server config: ₹249 = `24900` paise, currency `INR`. The browser's `src/config/seraPricing.js` is display-only.
- **Verify the signature:** `HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)` must equal `signature` (hex). Compare in constant time.
- **Tie the payment to the person:** store the order with the email it was created for, and on verify check the order belongs to that email. Mark the payment as verified and **unused**.
- **`sera-start-call` must refuse visitors without a verified, unused `paymentId`** for that email. When the call is created, mark the payment as used (one payment = one interview). The frontend already sends `route`, `studentCode` and `paymentId` in the `sera-start-call` body; today's function ignores them.
- **Existing one-interview-per-account gate:** `sera-start-call` currently blocks any Google account that has already done an interview (`already-used`). For paid visitors that check needs to become "one interview per payment", or a returning visitor would pay and then be blocked. It's worth also checking eligibility in `create-order`, so nobody can pay for an interview they can't start.

## Webhook (later)

- `payment.captured` is a backup for the case where the browser closes between paying and `verify`. It can come later.
- It must be idempotent on `payment_id`: the same payment arriving twice (webhook + verify, or a webhook retry) must not create two interviews or two records.
- Verify it with `RAZORPAY_WEBHOOK_SECRET` (Razorpay's `X-Razorpay-Signature` header).

## Env

| Name | Where | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` | server | Used to create orders; returned to the browser as `keyId`. |
| `RAZORPAY_KEY_SECRET` | server only | Signs/verifies. Never in a `VITE_` variable, never in the browser. |
| `RAZORPAY_WEBHOOK_SECRET` | server only | Later, for the webhook. |
| `VITE_RAZORPAY_KEY_ID` | browser | Fallback key id only. Documented in `.env.example`. |

## Before going live

- The pay screen says "By paying you agree to our Terms and Refund Policy". There are no Terms or Refund pages on the site yet, so it's plain text with a TODO. Razorpay usually requires both pages to be published before activating a live account.

## Mock mode (localhost)

`VITE_SERA_MOCK=true`: no Razorpay script loads. `createOrder` returns a fake order for 24900 paise, a fake checkout offers "Pay ₹249 (test)", "Simulate failure" and "Close", and `verifyPayment` returns `ok`. Mock mode also fakes the résumé upload + check (plain `vite` has no Netlify functions; a file name containing "bad" is rejected) and stops at the interview screen without creating a call.
