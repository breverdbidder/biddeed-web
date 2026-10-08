/**
 * "Bare brief": a shared Investment Brief (/briefs/<uuid>) rendered without the app shell.
 *
 * The brief is a standalone, phone-first document sent to an investor who has no
 * account. The shell's nav, Deed panel, Clerk, analytics, chat widget and webfonts
 * are ~430 KB of mostly unused JS and fonts there, and Ariel's bar is PageSpeed
 * mobile >= 95. Middleware marks the document GET (never trusted from the client)
 * and the root layout then renders html/body around the page and nothing else.
 */
export const BARE_BRIEF_REQUEST_HEADER = 'x-bd-bare-brief'

const BRIEF_PATH = /^\/briefs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isBareBriefRequest(req: { method: string; pathname: string; headers: Headers }): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  if (!BRIEF_PATH.test(req.pathname)) return false
  // A client-side navigation fetches the RSC payload and keeps the layout it booted with.
  if (req.headers.get('rsc') === '1' || req.headers.get('next-router-prefetch')) return false
  return true
}
