# YZI Works

Marketing site and AI interview product for Young Zone India. It is live and real people use it to apply for programs and to take interviews, so treat changes with care: add new files for new features, do not touch working code unless asked, and verify locally before shipping.

## Stack

- **Language / Runtime**: JavaScript (ES modules), Node 20 on the server
- **Frontend**: React 19, Vite 8, Tailwind 4, react-router-dom 7 (SPA in `src/`)
- **Backend**: `server/index.js`, plain Node `http` with a file store, self hosted on YZIVPS, a Bluehost VPS running Ubuntu with systemd (not Netlify; the old shared cPanel host YZIServer is retired). See [server/AGENTS.md](server/AGENTS.md)
- **Voice interview**: one Vapi squad call via `@vapi-ai/web`. See [docs/sera-vapi.md](docs/sera-vapi.md)
- **Services**: OpenAI Responses API, Cloudflare R2, Razorpay, MSG91, Resend, Google sign in
- **Package manager**: npm

## Build approach

<TBD, set by /scope>

## Commands

```bash
npm install
npm run dev       # Vite; /api and /.netlify proxy to the backend on 127.0.0.1:4005
npm run server    # backend on :4005
npm run build
npm run lint
npm test          # node --test, no framework
npm run sample:pdf
```

## Product areas

- **Marketing site and application forms**: Home, About, Application Process. `EarlyBuildersForm.jsx` and `EarlyPartnersForm.jsx` collect applications through MSG91 OTP and R2 uploads. Do not change them without explicit instruction.
- **Meet Ai Sera** (`/meet-sera`): a paid or code based AI interview. Sign in with Google or a typed email (not verified, one interview per email), plus a WhatsApp OTP; one PDF résumé, three offers built from it, then Screening (Sera, 5 min), Offer pick (no timer), HR round (Vinit, 4 min) and Final round (Sonia, 4 min). It ends with an on screen report and a PDF. Round config is in `src/config/seraRounds.js`.

## Rules

- The browser talks to the backend only through `src/services/*`. The shared session shape is in `src/shared/seraSession.js`.
- Server logic lives in pure, unit tested modules in `netlify/lib/*`. `server/index.js` is the thin wrapper that reads input, loads the session, calls a module and stores the result.
- Cost control: one interview per email, reserved before the Vapi call is created. The report and PDF are generated once per interview, in the Vapi webhook only (one exception, confirmed with the owner on 2026-10-08, spec 0001: after a restart `server/recovery.js` may run a report that the restart cut short once more, never one that failed, so at most two runs per interview). Spec 0002 (confirmed 2026-10-26): a failed report is retried once (still at most two runs), and a call lost before the offers gets one free restart (at most two calls per interview); after the offers a lost call is reported on what was said. The browser polls a plain read endpoint. Never add a client side analysis call or an unauthenticated endpoint that calls an LLM.
- Never put a secret in a `VITE_` variable or in `src/`. `.env.example` lists names only. Never print or commit secret values.
- Candidate data (résumés, sessions, orders) is personal. Keep it out of git, logs and chat.
- Change the interview rounds, timings, squad prompts or cost control rules only after confirming with the user.
- Before shipping run `node --check server/index.js`, `npm test`, `npm run lint` and `npm run build`.
- A passing local build is not enough. Check the real environment (server logs, `/api/sera/diagnostics`) when something fails only in production.
- Verify a provider's current documentation, or test against its real API, before concluding an integration is broken.

## Operations

- Backend host: `ssh YZIVPS` (root, key only; app user `yzi`), app in `/home/yzi/yzi-backend`, data in `server/data`, secrets in `.env` there (chmod 600). Services: `yzi-backend` (Node, :4005), `yzi-web` (Next.js tenant app, :3001), `apache2`, `php8.5-fpm`, `mariadb`, `dovecot`. Restart with `sudo systemctl restart yzi-backend` (graceful: `server/shutdown.js` waits up to 40 s). Logs: `journalctl -u yzi-backend`.
- Deploy with `bash scripts/deploy-yzivps.sh`, and add `--frontend` whenever `src/` changed. It runs the tests first and stops on a failure, backs up and uploads, loads the new code on the server, restarts through systemd, waits for the new build to answer, then checks the live site. It refuses while an interview is live, a report is being built, or a call ended without a finished report (`FORCE=1` overrides). Deploy the backend before the frontend. `scripts/deploy-sera-vapi.sh` targets the retired host.
- The `--frontend` upload ships the whole `dist/` (hashed `assets/` first, `index.html` last, the previous `index.html` kept as `index.html.prev-<stamp>`), so new files in `public/` go out too.
- Backend and frontend stay in sync through three checks: `server/frontendContract.test.js` (every endpoint `src/` calls must be served; runs in `npm test`), `npm run smoke` (the same list against the live site, plus a comparison of live and local `dist/` files with `--dist`), and the build id in `GET /api/sera/health` (written to `BUILD` by the deploy).
- Health check: `curl https://yziworks.com/api/sera/health` (also `/health` on the server itself).
- Web server: Apache 2.4 vhosts in `/etc/apache2/sites-available`: `020` yziworks.com (SPA from `/var/www/yziworks.com/public`, `/api/sera` and `/.netlify/functions` to :4005), `030` tenant subdomains (admin, app, eventrics, vd-technical, hypertech, apex-cloud-partners, apex-labs to :3001), `040` work/works.youngzoneindia.com (301 to yziworks.com), `050` youngzoneindia.com (WordPress, a separate product, `/var/www/youngzoneindia.com/public_html`, PHP-FPM, MariaDB). Certificates are Let's Encrypt (`certbot.timer`, deploy hook reloads Apache and Dovecot).
- DNS is hosted at Cloudflare (Free, records DNS only, no proxy; zone files in `docs/dns/`), nameservers `garrett.ns.cloudflare.com` and `rosemary.ns.cloudflare.com`, set at GoDaddy (the registrar). `youngzoneindia.com` mail (MX, SPF, autodiscover) is Microsoft 365 and must not be touched. Cutover notes and rollback: [docs/yzivps-cutover.md](docs/yzivps-cutover.md).
- Backups: `yzi-backup.timer` runs `/usr/local/sbin/yzi-backup` daily at 21:30 UTC: databases, backend data and `.env`, all mailboxes, configs (incl. Postfix and OpenDKIM keys) and certificates into `/var/backups/yzi` (14 sets), WordPress and site files as hard-linked snapshots in `/var/backups/yzi-files` (7), each archive test-read, result in `/var/lib/yzi/backup.status`. They sit on the same disk: `bash scripts/pull-yzivps-backup.sh` copies the newest set to this computer (`--files` adds the file snapshot). Cold archive of the old host: `/home/yzi/archive-old-server`.
- Self healing: systemd restarts apache2, php-fpm, mariadb, dovecot, `yzi-backend` and `yzi-web` within seconds (`Restart=always`); `yzi-health.timer` checks every minute (restart after 2 failed checks, at most 3 per 30 min; also warns on disk, memory, certificate age, backup age, pending reboot). `ssh YZIVPS yzi-health status` shows it; log in `/var/lib/yzi/health.log` and `journalctl -t yzi-health`. fail2ban guards ssh, dovecot and WordPress logins (`yzi-wordpress` jail). There is no outbound alert channel yet (needs the Microsoft 365 mailbox or an uptime service).
- Production runs Node 24 from `/opt/node` (official build, no glibc workarounds). The old host's watchdog, cron `ensure.sh`, `run/stop` file and 25-process limit no longer apply; `server/supervise.mjs`, `ensure.sh` and `start.sh` are legacy.
- Firewall (ufw) allows 22, 80, 443 and 993 only; ssh is key only with fail2ban. MariaDB listens on localhost only. Inbound mail is IMAPS only (Dovecot, users in `/etc/dovecot/users`, Maildirs in `/var/mail/vhosts/<domain>/<user>`): the seven legacy `@youngzoneindia.com` mailboxes plus `hr@tapptagstechnologies.com` and `manish@geniuseducationalacademy.in` (imported 2026-10-26; those two domains have no MX, so they only hold history). Real `@youngzoneindia.com` mail goes to Microsoft 365 (MX, autodiscover: do not touch). Outbound is a send-only Postfix (loopback only, no inbound) plus OpenDKIM (selector `yzi2026`), so WordPress `mail()` and the contact forms work as on the old host. DNS for it: apex SPF `v=spf1 include:spf.protection.outlook.com ip4:129.121.169.26 -all` (one record, edit in place, never add a second), `yzi2026._domainkey` and `_dmarc` (`p=none`) in `docs/dns/youngzoneindia.com.zone`. Reverse DNS for the IP is set by Bluehost support (must be `mail.youngzoneindia.com`). The Microsoft 365 SMTP route (`yzi-set-smtp`, needs the mailbox password typed by the owner) stays available as a fallback.
- The old cPanel host answered HTTP 406 to bodies typed `application/pdf` or `application/msword`; the VPS does not (checked 2026-10-26), but keep sending files as `application/octet-stream` (what `src/utils/r2Upload.js` does) and JSON for everything else.
- The website forms need `RESEND_API_KEY`, `MSG91_AUTH_KEY` and `MSG91_WIDGET_ID` in the server `.env`; until set, those endpoints answer 503. Export them before running the deploy script and it adds them.
- Security hardening on `youngzoneindia.com` (2026-10-26, see `docs/yzivps-cutover.md` Phase 2c for the full list): XML-RPC and `wp-admin/install.php` blocked at Apache; the forgotten `tapptagstechnologies`/`geniuseducationalacademy` WordPress installs that used to live in the same docroot are blocked (`RedirectMatch 404`), code+DB kept; REST API user listing blocked unauthenticated via `wp-content/mu-plugins/yzi-rest-hardening.php`; `X-Frame-Options` and a `Permissions-Policy` (microphone and payment deliberately left open — Sera's voice interview needs the mic) are set globally in `yzi-common.conf`. `yzi` and `ubuntu` no longer have sudo (removed from the `sudo` group and their NOPASSWD sudoers files); the deploy script is unaffected since it already runs as root and does `sudo -u yzi` from outside. **Open: Elementor Pro and WP Rocket are both behind on security fixes and their vendor license/update check is failing ("Download failed. Unauthorized") — needs the owner to check both licenses, then update from wp-admin.**

## Legacy

`netlify/lib/gemini.js` and the `netlify/functions/sera-*` files are leftover from the Netlify and Retell era and are not used. Three handlers in `netlify/functions/` are still live: `send-otp`, `verify-otp` (the Early Builder and Early Partner application email) and `send-contact`. `server/formEndpoints.js` runs them inside the backend, so the forms keep calling `/.netlify/functions/<name>` and Apache forwards that path to the server. Application file uploads are written in `server/applicationUploads.js`: the forms get signed upload URLs that point at this server (`/.netlify/functions/r2-upload`), which stores the file in R2. Do not rename these paths without updating the forms.

## Specs and docs

- [docs/sera-vapi.md](docs/sera-vapi.md) (call flow, offer handoff, webhook, squad rules)
- [docs/BACKEND_HANDOFF.md](docs/BACKEND_HANDOFF.md) (endpoint table; the Retell parts are history)
- [docs/sera-interview-contract.md](docs/sera-interview-contract.md), [docs/sera-login-contract.md](docs/sera-login-contract.md), [docs/sera-payment-contract.md](docs/sera-payment-contract.md), [docs/sera-report-spec.md](docs/sera-report-spec.md)
- Specs go in `docs/specs/` as `NNNN-title.md`.

## Context files

- [server/AGENTS.md](server/AGENTS.md) (live Sera backend on YZIVPS: routes, store, deploy, restart)
- [netlify/lib/AGENTS.md](netlify/lib/AGENTS.md) (shared pure modules: Vapi, offers, report, OpenAI client)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
