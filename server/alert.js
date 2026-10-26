// Owner alerts by email through the VPS's send-only Postfix (`sendmail -t`, loopback only).
// Off unless SERA_ALERT_EMAIL is set; never throws, so an alert can't break a request.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const SENDMAIL = process.env.SERA_SENDMAIL_PATH || '/usr/sbin/sendmail'
const FROM = process.env.SERA_ALERT_FROM || 'Sera Alerts <noreply@youngzoneindia.com>'

const oneLine = (text) => String(text).replace(/[\r\n]+/g, ' ').slice(0, 200)

// → Promise<boolean> (true when sendmail accepted the message)
export function sendAlert(subject, lines) {
  const to = process.env.SERA_ALERT_EMAIL
  if (!to || !existsSync(SENDMAIL)) return Promise.resolve(false)
  const message = [
    `From: ${FROM}`,
    `To: ${oneLine(to)}`,
    `Subject: [Sera] ${oneLine(subject)}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    ...[].concat(lines),
    '',
  ].join('\n')
  return new Promise((resolve) => {
    try {
      const child = spawn(SENDMAIL, ['-t', '-i'], { stdio: ['pipe', 'ignore', 'ignore'] })
      const timer = setTimeout(() => child.kill(), 15000)
      child.on('error', () => { clearTimeout(timer); resolve(false) })
      child.on('close', (code) => { clearTimeout(timer); resolve(code === 0) })
      child.stdin.end(message)
    } catch {
      resolve(false)
    }
  }).then((sent) => {
    if (!sent) console.warn(`[Alert] could not send: ${oneLine(subject)}`)
    return sent
  })
}
