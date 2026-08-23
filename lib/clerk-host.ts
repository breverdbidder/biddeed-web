/**
 * Whether Clerk may activate on this host.
 *
 * The production Clerk instance is bound to biddeed.ai. On any other host its
 * same-origin /__clerk proxy calls are answered 400 host_invalid (MEASURED
 * 2026-08-23 on both WebKit and Chromium against biddeed-web.vercel.app), so
 * on unauthorized hosts the app runs in passthrough: no provider, no
 * guaranteed-failed bootstrap requests, and the auth pages say plainly that
 * sign-in lives on the canonical domain instead of rendering a form whose
 * every request fails.
 *
 * One definition, used by layout.tsx and both auth pages, so the provider and
 * the pages can never disagree about whether auth is live here.
 */
export function isClerkHostAuthorized(host: string | null | undefined): boolean {
  const h = (host ?? '').split(':')[0]
  return h === 'biddeed.ai' || h.endsWith('.biddeed.ai') || h === 'localhost' || h === '127.0.0.1'
}
