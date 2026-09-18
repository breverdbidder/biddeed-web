/**
 * The origin the caller actually used — for absolute URLs handed back to
 * users (share links, PARITY CP-4 PR B).
 *
 * Behind the biddeed.ai router Worker (cli-anything-biddeed src/worker.js)
 * this app is fetched at its workers.dev origin, so `new URL(req.url).origin`
 * is the INTERNAL host. PR B built share links from it and playwright-rls run
 * 35323278324 (2026-09-18) caught it live: expected
 * https://biddeed.ai/projects/shared/<token>, received
 * https://biddeed-web-production.<sub>.workers.dev/projects/shared/<token>.
 *
 * The router sets X-Biddeed-Canonical-Host (router-owned: deleted inbound and
 * re-set) and X-Forwarded-Host (the public host that was typed), plus
 * X-Forwarded-Proto. Prefer those, then Host, then the request URL, so a
 * direct workers.dev caller keeps workers.dev and local dev keeps
 * http://127.0.0.1:<port>. A caller can only spoof the origin in its OWN
 * response, so nothing here is a trust boundary.
 */
const HOST_RE = /^[A-Za-z0-9.-]+(?::\d{1,5})?$/

function first(value: string | null): string {
  return (value ?? '').split(',')[0].trim()
}

export function publicOrigin(req: Request): string {
  const url = new URL(req.url)
  const h = req.headers
  const candidates = [first(h.get('x-biddeed-canonical-host')), first(h.get('x-forwarded-host')), first(h.get('host')), url.host]
  const host = candidates.find((c) => c && HOST_RE.test(c)) ?? url.host
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)
  const proto = isLocal ? first(h.get('x-forwarded-proto')) || url.protocol.replace(':', '') || 'http' : 'https'
  return `${proto}://${host}`
}
