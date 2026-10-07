/**
 * "Lean home": the signed-out landing page, rendered without Clerk
 * (PageSpeed pass 3, approved by Ariel 2026-10-07).
 *
 * Every visitor used to download and boot the Clerk SDK (clerk-js, @clerk/ui,
 * ~430 ms of main thread on a mid-range phone) on the landing page, where
 * almost no one is signed in. Middleware now marks a request as the lean home
 * when it is a document GET of exactly '/' that carries no Clerk session; the
 * root layout then renders that page with auth off, exactly like a host where
 * Clerk is not configured. Anyone with a session - and every other route -
 * is unchanged.
 *
 * The cli-anything-biddeed router Worker repeats the same cookie test before
 * it serves '/' from its 60-second edge cache (src/worker.js,
 * isAnonymousHomeRequest). Keep the two in step.
 */
export const LEAN_HOME_REQUEST_HEADER = 'x-bd-lean-home'
/** Response marker: the Worker edge-caches '/' only when it sees this. */
export const LEAN_HOME_RESPONSE_HEADER = 'x-bd-lean'

type CookieLike = { name: string; value: string }

/**
 * True when the cookies show a Clerk session, or one Clerk may still need to
 * refresh: a session JWT, a non-zero client "updated at" marker (signed in on
 * this browser), or a development-instance handshake token.
 */
export function hasClerkSession(cookies: CookieLike[]): boolean {
  for (const { name, value } of cookies) {
    if (name === '__session' || name.startsWith('__session_')) return true
    if ((name === '__client_uat' || name.startsWith('__client_uat_')) && value && value !== '0') return true
    if (name === '__clerk_db_jwt' || name.startsWith('__clerk_db_jwt_')) return true
  }
  return false
}

export function isLeanHomeRequest(req: {
  method: string
  pathname: string
  search: URLSearchParams
  headers: Headers
  cookies: CookieLike[]
}): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  if (req.pathname !== '/') return false
  // Client-side navigations fetch the RSC payload; the layout is not re-rendered
  // for those, and a page that is already running keeps the mode it booted in.
  if (req.headers.get('rsc') === '1' || req.headers.get('next-router-prefetch')) return false
  // Clerk handshake / redirect-back parameters mean auth is mid-flight.
  for (const key of req.search.keys()) {
    if (key.startsWith('__clerk')) return false
  }
  return !hasClerkSession(req.cookies)
}
