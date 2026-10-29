# YZIVPS cutover runbook

State on 2026-10-24: everything runs on the VPS (`ssh YZIVPS`, 129.121.169.26) and has been tested by pinning each hostname to
that IP. The old host (YZIServer, 119.18.49.9) has its backend and `yzi-web` stopped. DNS still points at the old IP, so the
public sites are down until phase 1 below is done.

Both domains are registered at **GoDaddy** and use the nameservers `ns1/ns2.bluehost.in`. Those zones are hosted on the old
cPanel account. **Do not delete the old account before phase 2 is finished**, or both domains stop resolving.

## Phase 1: point the sites at the VPS (cPanel > Zone Editor on the old account)

Set these **A records to `129.121.169.26`**, TTL `300`:

| Zone | Names |
|---|---|
| yziworks.com | `@`, `mail`, `*`, `admin`, `www.admin`, `app`, `www.app`, `eventrics`, `www.eventrics`, `vd-technical`, `www.vd-technical`, `hypertech`, `www.hypertech`, `apex-cloud-partners`, `www.apex-cloud-partners`, `apex-labs`, `www.apex-labs` |
| youngzoneindia.com | `@`, `mail`, `yziworks`, `www.yziworks`, `work`, `www.work`, `works`, `www.works` |

Also:

- SPF `TXT` records that contain `ip4:119.18.49.9`: replace the IP with `129.121.169.26`. yziworks.com: `@`, `*`, `admin`, `app`,
  `eventrics`, `vd-technical`, `hypertech`, `apex-cloud-partners`, `apex-labs`. youngzoneindia.com: `yziworks`, `work`, `works`.
  Do **not** touch the `youngzoneindia.com` apex SPF (`include:spf.protection.outlook.com`).
- Lower the TTL to `300` on the `www` CNAMEs and on the `yziworks.com` MX.
- **Leave the Microsoft 365 records alone**: `youngzoneindia.com` MX (`youngzoneindia-com.mail.protection.outlook.com`),
  apex SPF, and the `autodiscover` CNAME (`autodiscover.outlook.com`).
- The cPanel-only records (`cpanel`, `whm`, `webdisk`, `webmail`, `ftp`, `autodiscover`/`autoconfig` A, CalDAV/CardDAV SRV,
  `_acme-challenge*`, `_cpanel-dcv-test-record`) can stay until phase 2; they die with the old account.

Check from anywhere: `nslookup yziworks.com 1.1.1.1` shows `129.121.169.26`. Visitors with a cached answer reach the stopped old
server for up to 4 hours (the old TTL).

## Phase 1b: real certificates (on the VPS, after the A records resolve)

```bash
certbot certonly --webroot -w /var/www/html --cert-name yziworks-all \
  -d yziworks.com -d www.yziworks.com \
  -d admin.yziworks.com -d www.admin.yziworks.com -d app.yziworks.com -d www.app.yziworks.com \
  -d eventrics.yziworks.com -d www.eventrics.yziworks.com -d vd-technical.yziworks.com -d www.vd-technical.yziworks.com \
  -d hypertech.yziworks.com -d www.hypertech.yziworks.com -d apex-cloud-partners.yziworks.com -d www.apex-cloud-partners.yziworks.com \
  -d apex-labs.yziworks.com -d www.apex-labs.yziworks.com
certbot certonly --webroot -w /var/www/html --cert-name youngzoneindia \
  -d youngzoneindia.com -d www.youngzoneindia.com -d work.youngzoneindia.com -d www.work.youngzoneindia.com \
  -d works.youngzoneindia.com -d www.works.youngzoneindia.com -d mail.youngzoneindia.com
```

Then point `SSLCertificateFile`/`SSLCertificateKeyFile` in `/etc/apache2/sites-available/020-…`, `030-…`, `040-…`, `050-…`,
`000-default` at `/etc/letsencrypt/live/<cert-name>/{fullchain,privkey}.pem`, set the same for Dovecot, and add a deploy hook
(`/etc/letsencrypt/renewal-hooks/deploy/`) that runs `systemctl reload apache2 dovecot`. Until then the copied cPanel
certificates (valid to December 2026 / January 2027) serve HTTPS.

## Phase 2: move DNS hosting off the old account

1. Done 2026-10-25: both zones exist in the Cloudflare account of admin@youngzoneindia.com (Free plan, every record DNS only, no
   proxy), imported from `docs/dns/*.zone` and checked against `garrett.ns.cloudflare.com`. They include the Microsoft 365 records.
2. At GoDaddy, change the nameservers of both domains to `garrett.ns.cloudflare.com` and `rosemary.ns.cloudflare.com`.
3. Wait for resolvers (up to 48 h), confirm with `nslookup -type=NS yziworks.com`.

## Phase 2b: final gaps closed (2026-10-26)

- Old HOME leftovers (other-domain mail, `~/etc` webmail DBs, tarballs, scripts, `.ssh`; 1.1 GB, 24,559 entries) are in
  `/home/yzi/archive-old-server/home-rest` (mode 700).
- Mailboxes only on the old host were imported into Dovecot: `hr@tapptagstechnologies.com` (9 INBOX + 9 Sent) and
  `manish@geniuseducationalacademy.in` (3). Message counts match the source, wrong passwords are refused, the old
  md5-crypt hashes were reused (rotate both passwords, two hashes were once shown in chat). Backup of the previous
  user list: `/etc/dovecot/users.bak-pre-import`.
- Outbound mail: send-only Postfix + OpenDKIM. Cloudflare got `yzi2026._domainkey` (DKIM), `_dmarc` (`p=none`) and the apex SPF
  was edited in place to `include:spf.protection.outlook.com ip4:129.121.169.26 -all`. M365 MX and autodiscover untouched.
  `opendkim-testkey` says key OK, a local message carries a valid DKIM signature, one test mail to Gmail got `250 OK` over TLS 1.3.
  Still to do by the owner: ask Bluehost support to set reverse DNS of 129.121.169.26 to `mail.youngzoneindia.com`
  (it is the generic `ip-129-121-169-26.local` today), and read SPF/DKIM/DMARC in the Gmail "Show original" of the test mail.
- WordPress log noise `Undefined variable $r` (about 216 lines) comes from the Trustindex plugin
  `review-widgets-for-trustpilot` 4.3, `trustindex-plugin.class.php` line 1293. Harmless; update the plugin in wp-admin.
- `yzi-backup` now also saves `/etc/postfix`, `/etc/opendkim`, `/etc/mailname`, `/etc/aliases`; the mail tarball covers all mailboxes.
- Checks after the changes: `yzi-health status` all ok, `certbot renew --dry-run` passes for both lineages, all hostnames answer with a valid certificate.

## Phase 2c: security review and hardening (2026-10-26)

An external + authenticated review of both sites and the VPS found and fixed:

- **Blocked, not yet fixed — needs the owner:** Elementor Pro (3.23.3) and WP Rocket (3.8.8) are both out of date;
  Elementor Pro 3.23.3 is vulnerable to CVE-2026-32475 (critical unauthenticated file-upload RCE, fixed in 4.2.2,
  current is 4.3.2). Checked and confirmed: no published page currently has a Form widget with an active File Upload
  field, so this specific hole has no entry point on this site today — but the vulnerable code is still present.
  Attempting the update through WordPress's own upgrader (same code path as "Update Now") failed with
  **"Download failed. Unauthorized"** from Elementor's license server; WP Rocket's updater didn't offer an update at
  all, the same symptom. Both licenses need checking/renewing in the owner's Elementor and WP Rocket accounts, then
  updated from wp-admin → Plugins.
- **Fixed:** two forgotten full WordPress installs (`tapptagstechnologies.com`, `geniuseducationalacademy.in`) were
  sitting inside the live docroot and reachable at `/tapptagstechnologies/` and `/geniuseducationalacademy/` — now
  `RedirectMatch 404` in `050-youngzoneindia.conf`. Code and DB kept (already in the nightly backup) in case they're
  needed later.
- **Fixed:** `review-widgets-for-trustpilot` (the source of the `$r` PHP warning) was an abandoned plugin pulled from
  wordpress.org in 2021 — deactivated via WP's own `deactivate_plugins()`. It was live on the Home page; nothing
  replaced it yet.
- **Fixed:** WordPress REST API user enumeration (`/wp-json/wp/v2/users` leaked the `shopmanager` login name)
  blocked for unauthenticated requests via a new mu-plugin, `wp-content/mu-plugins/yzi-rest-hardening.php`.
- **Fixed:** XML-RPC blocked at Apache (`<Files xmlrpc.php>`) — confirmed 216+ brute-force hits from botnet IPs in the
  access logs and no legitimate use (no Jetpack on this install). `wp-admin/install.php` blocked too (pure info
  disclosure once WordPress is installed).
- **Fixed:** security headers added globally via `yzi-common.conf`: `X-Frame-Options: SAMEORIGIN` and a
  `Permissions-Policy` that disables geolocation/camera/usb/magnetometer/gyroscope/accelerometer. Microphone and
  payment were deliberately left unrestricted — the Sera voice interview (`yziworks.com`) needs microphone via
  Vapi/`getUserMedia`, and WooCommerce checkout may need Payment Request.
- **Fixed:** `ubuntu` (the stock cloud-init account — its only SSH activity was credential-stuffing bots, never
  the owner) is locked, has no SSH key, shell is `nologin`, and is out of the `sudo` group. `yzi` no longer has
  passwordless or group-based sudo (`ALL=(ALL) NOPASSWD:ALL` removed, removed from the `sudo` group); confirmed this
  doesn't break `scripts/deploy-yzivps.sh`, which already runs as root and does `sudo -u yzi` from the outside, not
  `yzi` sudo-ing itself. Backups of the removed sudoers files and `ubuntu`'s key are in
  `/root/sudoers-backup-pre-hardening` on the VPS.
- Verified clean (no change needed): external port surface is exactly 22/80/443/993; direct-IP and unmatched-Host
  requests return `421`, not a default vhost; `wp-config.php`/`.env`/`.git`/debug logs all 403; TLS 1.0/1.1 disabled;
  SSH key-only with fail2ban; MariaDB and the Sera backend bound to localhost only; Postfix isn't an open relay; no
  CORS misconfiguration on the Sera API.
- A fresh backup was taken before any change; `yzi-health status` and all hostnames were re-checked after.

## Phase 3: retire the old server

Only after phase 2, a few clean days on the VPS, and a last look at what is still only on the old account:
the cold archive is in `/home/yzi/archive-old-server`, staging copies in `/home/yzi/staging` (delete once happy).

Checklist before the owner deletes YZIServer:

1. `nslookup -type=NS yziworks.com` and `youngzoneindia.com` show the Cloudflare nameservers, and public resolvers return `129.121.169.26`.
2. `ssh YZIVPS yzi-health status` all ok; `cat /var/lib/yzi/backup.status` starts with `ok` and is under a day old.
3. `bash scripts/pull-yzivps-backup.sh --files` run once, so a copy sits on the PC (the VPS backups share its disk).
4. Archive present: `ls /home/yzi/archive-old-server` has `home-rest`, the cold archive and the sera-app WhatsApp session.
5. Mail: the nine Dovecot users log in with their new passwords; Gmail "Show original" of the test mail shows SPF, DKIM and DMARC `pass`.
6. Reverse DNS requested at Bluehost.
7. Nothing else points at the old host: GoDaddy nameservers are Cloudflare's, no A/MX/CNAME record uses `119.18.49.9`
   (Cloudflare export), and external integrations (Vapi webhook, Razorpay, MSG91, Google sign in) use `yziworks.com`.
8. A few clean days: no new errors in `journalctl -u yzi-backend` and the Apache error logs.

## Rollback (before phase 2)

Set the A records back to `119.18.49.9` and remove `~/yzi-backend/run/stop` and `~/yzi-web/run/stop` on the old host (cron restarts
both within a minute). Anything written on the VPS after the cutover (new interviews, orders) would be missing there.
