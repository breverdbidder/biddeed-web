/**
 * Origins whose Server Action requests Next accepts although the request's
 * host is a different one (next.config.mjs experimental.serverActions).
 *
 * The public site is biddeed.ai, but the router Worker proxies it to
 * biddeed-web-production.<account>.workers.dev, and Next sees that workers.dev
 * host no matter what X-Forwarded-Host the Worker sends. Next's CSRF check
 * compares the browser's Origin (biddeed.ai) with that host and, when they
 * differ and the origin is not listed here, answers every Server Action with
 * 500 "Invalid Server Actions request." (error code E80).
 *
 * The one Server Action on this site is Clerk's invalidateCacheAction, which
 * Clerk awaits in __internal_onBeforeSetActive right after a sign-up code or a
 * sign-in factor is accepted, BEFORE it activates the session. Measured on
 * biddeed.ai 28 Sep 2026: that request answered 500 (digest ...@E80), React
 * threw #441, and the promise never resolved (still pending at 20 s), so the
 * new member sat on a dead spinner / blank page until SignedInRedirect's
 * fallback poll noticed the session 18-48 s later (PostHog, 27 and 28 Sep).
 *
 * Exact hosts only: these are the site's own public origins, nothing wider.
 */
export const SERVER_ACTION_ALLOWED_ORIGINS = ['biddeed.ai', 'www.biddeed.ai']
