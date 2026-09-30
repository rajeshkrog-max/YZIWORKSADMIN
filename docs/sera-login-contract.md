# Sera login — backend contract

The frontend login is built and runs in mock mode. This doc is what the server
side needs to do to make it real. The frontend talks to the backend **only**
through `src/services/seraAuthService.js`.

## The flow

1. User picks a tab: **New User** or **Student**. (The New User route id is `'visitor'` everywhere in code and API bodies — only the label changed.)
2. Both: "Continue with Google" → Google popup → we get name, email, picture, access token.
3. Student only: types a campus code → checked while typing → shows institute + seats left, or an error.
4. Both: WhatsApp number (+91, 10 digits) → MSG91 WhatsApp OTP popup → we get an MSG91 token. (Student: only unlocked once the code is valid.)
5. Continue → `completeLogin(...)` → server verifies everything and returns a session.
6. Frontend stores the session as the interview profile and moves to résumé upload.

## Service functions (`src/services/seraAuthService.js`)

### `checkStudentCode(code)`

- Input: `code` — string. The frontend trims and uppercases it (e.g. `YZI-PUNE-OCT26`).
- Output:
  - `{ valid: true, instituteName: string, seatsLeft: number }`
  - `{ valid: false, reason: string }`
- `valid: true` with `seatsLeft: 0` is shown as "No seats left for this code" and blocks the next step.
- If the endpoint is unreachable, the frontend treats it as `{ valid: false, reason: 'unavailable' }` and shows "Couldn't check the code right now".
- The same field also takes **one-time rejoin codes** after a dropped call: return `{ valid: true, kind: 'rejoin' }`, or `{ valid: false, reason: 'expired' | 'used' }`. The login then calls `redeemRejoin` instead of `completeLogin`. See `docs/sera-interview-contract.md`.

### `completeLogin({ route, google, phone, msg91Token, studentCode })`

- Input:
  - `route` — `'visitor' | 'student'`
  - `google` — `{ name, email, picture, accessToken }`
  - `phone` — 10-digit string, no `+91` (e.g. `"9876543210"`)
  - `msg91Token` — the token MSG91's widget returns in its success callback (`data.message`)
  - `studentCode` — string for students, `null` for New Users
- Output:
  - `{ ok: true, session: { route, name, email, phone, studentCode, instituteName } }`
  - `{ ok: false, error: string }` — `error` is shown to the user under the Continue button, so keep it short and human.

### `isMockMode()`

- Returns `true` when `VITE_SERA_MOCK=true`. Frontend-only; the server never sees mock traffic.

## What the server must verify (never trust the browser)

- **Google** — call `https://www.googleapis.com/oauth2/v3/userinfo` with `Authorization: Bearer <accessToken>`. Use the email Google returns, not the one in the request body. Reject if the call fails or `email_verified` is false.
- **Phone** — verify `msg91Token` with MSG91's server-side access-token check (`POST https://control.msg91.com/api/v5/widget/verifyAccessToken` with the MSG91 auth key and `access-token`; confirm the exact request shape in MSG91's current docs). Use the phone number MSG91 confirms, and check it matches `91` + `phone`.
  - Note: `netlify/functions/verify-otp.js` (the Builder/Partner form) does **not** do this check today — it trusts the browser. Don't copy that; the Sera login needs the real check.
- **Student code** — for `route: 'student'` only: the code exists, is active, isn't expired, and has `seatsLeft > 0`. Return `instituteName` from the server, not from the request.

## Seats

A seat is **not** consumed at login. `checkStudentCode` and `completeLogin` only read the seat count. The seat is taken when the interview actually starts (a later step, in the start-call function).

## Suggested endpoints

- `POST /api/sera/student-code/check` — body `{ code }` → `checkStudentCode` output
- `POST /api/sera/login` — body `{ route, google, phone, msg91Token, studentCode }` → `completeLogin` output

Both must return `Content-Type: application/json`. Netlify functions live at `/.netlify/functions/<name>` by default, so these `/api/...` paths need a redirect in `netlify.toml` or a `config.path` on the function.

Until they exist, the service returns a friendly error ("We couldn't reach the server…") and the code check shows "Couldn't check the code right now". Search for `TODO(backend)`.

## Google access token

`signInWithGoogle()` in `src/utils/googleAuth.js` returns `{ name, email, picture, accessToken }`, and the login passes it through unchanged as `google.accessToken` in `completeLogin`. Use it for the server-side email check above. (In mock mode it's the placeholder `mock-google-token`.)

## Env

- `VITE_SERA_MOCK` — `true` on localhost for mock mode; unset/`false` everywhere else. Documented in `.env.example`. Never set it on Netlify.
- MSG91 — the login uses the **same** widget (`VITE_MSG91_WIDGET_ID`, `VITE_MSG91_TOKEN_AUTH`) as the Early Builder/Partner forms, launched the same way (`loadMsg91Script` + `openMsg91OTP` + `useOtpLaunchGuard`). MSG91 does not allow a custom OTP UI; its own popup collects the code.
  - **In the MSG91 dashboard, the widget must be set to the WhatsApp channel** (the page tells users "We'll send a one-time code to this number on WhatsApp").
  - **The success token must be verified on the server** (see "What the server must verify" above) — the browser's success callback alone proves nothing. The server-side auth key is `MSG91_AUTH_KEY` (server-only, never `VITE_`).

## Mock mode (localhost)

- Google and MSG91 popups are replaced by small fake popups.
- Student codes: `YZI-PUNE-OCT26` → valid, "Pune Institute", 42 seats. `YZI-FULL-TEST` → valid, 0 seats. Anything else → invalid.
- Mock OTP: any 4 digits verify; `0000` fails.
- `completeLogin` returns `ok` with the data it was given.
