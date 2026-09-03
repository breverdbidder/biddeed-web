import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

// Clerk turns on only when BOTH halves of the credential pair are present.
//
// This used to test CLERK_SECRET_KEY alone. That is a live footgun: setting
// just the secret key flips this true, clerkMiddleware() then initialises
// without a publishable key, and because middleware runs on EVERY request the
// failure is not a broken sign-in page -- it is the whole site. On biddeed.ai
// that now includes the apex homepage, which the Worker proxies here.
// Requiring the pair means a half-finished credential rollout degrades to
// passthrough (the current, working, auth-light behaviour) instead of an
// outage. Verified 2026-08-20: neither key is set on biddeed-web, so this
// evaluates false and the site keeps serving exactly as it does today.
const CLERK_ENABLED = Boolean(
  process.env.CLERK_RUNTIME_ENABLED === 'true' &&
  process.env.CLERK_SECRET_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
)
const IS_PROD = process.env.NODE_ENV === 'production'

const isPublicRoute = createRouteMatcher([
  // API routes — public data endpoints
  '/api/health(.*)',
  '/api/stats(.*)',
  '/api/coverage(.*)', // public: customers verify county coverage BEFORE paying
  '/api/parcels/search(.*)', // public: look up any address before paying
  '/api/kpis(.*)',
  '/api/auctions(.*)',
  '/api/bcpao-lookup(.*)',
  '/api/bcpao-photo(.*)',
  '/api/explorer(.*)',
  '/api/parcels(.*)',
  '/api/zoning-chat(.*)',
  '/api/zoning-report(.*)',
  '/api/owner-intel(.*)',
  '/api/chat-v2(.*)',
  '/api/reports(.*)',
  '/api/alerts(.*)', // API enforces its own Clerk account scope and JSON 401 responses
  '/api/saved-searches(.*)', // API enforces its own Clerk account scope and JSON 401 responses
  '/api/title-search(.*)', // API enforces its own Clerk account scope and JSON 401 responses
  '/api/skip-trace(.*)', // API enforces its own Clerk account scope and provider gate
  '/api/watchlist(.*)', // API enforces its own Clerk account scope and JSON 401 responses
  '/api/csp-report(.*)',
  // Deed's same-origin SSE proxy to the Worker's /chat/api. Public for the
  // same reason /chat is on the Worker: the conversational surface is how a
  // prospect evaluates the product before there is an account to protect.
  // The route holds no credential — the Worker owns ROUTER_PROXY_KEY — and it
  // forwards the caller's real IP so the Worker's per-IP rate limit still
  // applies per visitor rather than per deployment.
  '/api/deed(.*)',
  '/api/floorplan(.*)',
  '/api/massing(.*)', // public: 3D Massing Engine has no login gate, same as /massing page itself
  // Stripe webhooks MUST be public (Stripe sends without auth)
  '/api/stripe/webhook(.*)',
  // Post-checkout fulfilment, called by /order/success. Public for the same
  // reason '/order(.*)' below is: the buyer has no account when they return
  // from Stripe, so auth.protect() here would strand every purchase behind a
  // sign-in wall. This is not a widened surface — the route never trusts the
  // session id as proof of payment; it hands it to confirm_checkout_session(),
  // which re-reads payment_status from Stripe before writing anything, and a
  // forged id gets `unpaid`. Omitting it while '/order(.*)' was allowlisted
  // was an oversight: the page was public and the endpoint it depends on was
  // not, which breaks the moment Clerk keys are configured.
  '/api/checkout(.*)',
  // Pages — public access
  '/',
  '/chat(.*)',
  '/dashboard(.*)',
  '/pricing(.*)',
  '/help(.*)',
  '/docs(.*)',
  '/explore(.*)',
  '/explorer(.*)',
  '/discover(.*)',
  '/alerts(.*)',
  '/massing(.*)',
  '/floorplan(.*)',
  '/proforma(.*)',
  '/auth(.*)',
  '/foreclosures(.*)',
  '/conquest(.*)',
  '/competitors(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/report(.*)',
  '/auctions(.*)',
  // Post-checkout confirmation. The buyer has no account at this point, so
  // gating it behind auth would strand every purchase.
  '/order(.*)',
  // Same reasoning as /order(.*) above -- this is the /subscribe flow's
  // post-checkout page (app/success/page.tsx). Omitted here while /order was
  // allowlisted was the same oversight already called out for /api/checkout:
  // it went undetected on Vercel because CLERK_RUNTIME_ENABLED has been false
  // there since 2026-08-20, so auth.protect() never actually ran. Found live
  // 2026-09-03 during the #19813 Cloudflare canary, where CLERK_RUNTIME_ENABLED
  // is true: signed-out visitors got a Clerk protect-rewrite 404 on /success
  // instead of their paid confirmation page.
  '/success(.*)',
  '/radar(.*)',
  '/privacy(.*)',
  '/terms(.*)',
  '/disclaimer(.*)',
  // SUMMIT 77c39794 — public parcel/property share cards (viral-loop phase 1)
  '/parcel(.*)',
  '/property(.*)',
    '/card(.*)',
  // SEO files — belt & suspenders (matcher also excludes txt|xml below)
  '/robots.txt',
  '/sitemap.xml',
  '/robots(.*)',
  '/sitemap(.*)',
])

// Rate limit presets per endpoint category (D4 requirements)
const CHECKOUT_LIMIT = { limit: 5, windowSeconds: 60 }
const CSP_REPORT_LIMIT = { limit: 10, windowSeconds: 60 }
const API_LIMIT = { limit: 60, windowSeconds: 60 }

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  return forwarded?.split(',')[0].trim() || realIp || 'unknown'
}

/**
 * Rate-limit response.
 *
 * Every 429 used to return the bare string 'Too Many Requests', which a browser
 * renders as an unstyled white page in monospace: no branding, no explanation,
 * no way back. A real user clicking quickly through sign-in can land on it, and
 * it reads like the site is broken rather than briefly protecting itself.
 *
 * API clients still get machine-readable JSON — an HTML page is the wrong answer
 * for fetch(). Content negotiation decides that, not the request path, so
 * /api/auth called from a browser form and from a script both behave correctly.
 *
 * No external assets and no JS: this response deliberately bypasses the CSP/
 * nonce pipeline, so it must be fully self-contained. The meta refresh honours
 * Retry-After, so the page recovers on its own without the user doing anything.
 */
function tooManyRequests(req: NextRequest, resetAt: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  const headers: Record<string, string> = {
    'Retry-After': String(retryAfter),
    'Cache-Control': 'no-store',
  }

  if (!(req.headers.get('accept') || '').includes('text/html')) {
    return NextResponse.json(
      {
        error: 'too_many_requests',
        message: 'Rate limit exceeded. Please retry shortly.',
        retry_after_seconds: retryAfter,
      },
      { status: 429, headers }
    )
  }

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="${retryAfter}">
<title>One moment · BidDeed.AI</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#f4eee5; color:#1c1917; padding:24px;
         font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .card { width:100%; max-width:440px; background:#fffaf3; border:1px solid #d8cfc2;
          border-radius:16px; padding:32px 28px; text-align:center; }
  .brand { display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:22px; }
  .mark { width:36px; height:36px; border-radius:9px; background:#c96a4a; color:#fffaf3;
          font-weight:800; font-size:18px; display:flex; align-items:center; justify-content:center; }
  .name { font-size:17px; font-weight:700; color:#1c1917; }
  .name span { color:#c96a4a; }
  h1 { font-size:20px; margin:0 0 10px; color:#1c1917; }
  p { margin:0 0 22px; font-size:14px; line-height:1.6; color:#6b625a; }
  .wait { font-variant-numeric:tabular-nums; font-weight:700; color:#c96a4a; }
  a { display:inline-flex; align-items:center; justify-content:center; min-height:44px;
      padding:0 22px; border-radius:10px; background:#c96a4a; color:#fffaf3;
      font-weight:700; font-size:14px; text-decoration:none; }
  .fine { margin-top:18px; font-size:12px; color:#8a8178; }
</style></head>
<body>
  <main class="card">
    <div class="brand"><div class="mark">B</div><div class="name">BidDeed<span>.AI</span></div></div>
    <h1>One moment</h1>
    <p>We are seeing a burst of requests from your connection. This page retries
       itself in <span class="wait">${retryAfter}s</span> — no need to refresh.</p>
    <a href="/">Back to BidDeed.AI</a>
    <div class="fine">Nothing is wrong with your account. This is a temporary rate limit.</div>
  </main>
</body></html>`

  return new NextResponse(html, {
    status: 429,
    headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function rateLimitMiddleware(req: NextRequest): NextResponse | undefined {
  const pathname = req.nextUrl.pathname
  const clientIp = getClientIp(req)

  const isRscPrefetch =
    req.headers.get('rsc') === '1' ||
    req.headers.get('next-router-prefetch') === '1' ||
    req.nextUrl.searchParams.has('_rsc')

  if (
    !isRscPrefetch &&
    (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up') || pathname.startsWith('/api/auth'))
  ) {
    const result = checkRateLimit(`auth:${clientIp}`, RATE_LIMITS.auth)
    if (!result.allowed) {
      return tooManyRequests(req, result.resetAt)
    }
  } else if (pathname.startsWith('/api/stripe/checkout')) {
    const result = checkRateLimit(`checkout:${clientIp}`, CHECKOUT_LIMIT)
    if (!result.allowed) {
      return tooManyRequests(req, result.resetAt)
    }
  } else if (pathname.startsWith('/api/csp-report')) {
    // CSP reports: silently drop over limit (no 429 to avoid noise)
    const result = checkRateLimit(`csp:${clientIp}`, CSP_REPORT_LIMIT)
    if (!result.allowed) {
      return new NextResponse(null, { status: 204 })
    }
  } else if (pathname.startsWith('/api/')) {
    const result = checkRateLimit(`api:${clientIp}`, API_LIMIT)
    if (!result.allowed) {
      return tooManyRequests(req, result.resetAt)
    }
  }
}

/**
 * Generate per-request nonce and build CSP header.
 * Dev mode: Content-Security-Policy-Report-Only
 * Prod mode: Content-Security-Policy (enforcing)
 *
 * ELEVENLABS / VOICE — READ THIS BEFORE BELIEVING THE PREVIOUS COMMENT.
 *
 * This block used to describe script-src additions for the ElevenLabs Voice
 * Draftsman widget: https://unpkg.com plus two pinned sha256 hashes for the
 * inline scripts the widget inserts into itself. Measured against the live
 * response on 2026-08-20: NONE OF THEM ARE IN THE POLICY BELOW. connect-src
 * does carry all four ElevenLabs origins, so the widget would be allowed to
 * talk to ElevenLabs but its own bundle is refused before it can. The voice
 * agent cannot load, and the comment said otherwise for two days.
 *
 * Two further gaps in the same policy, both UNTESTED against a real session:
 *  - media-src is absent entirely, so it falls back to default-src 'self',
 *    which does not permit blob:. Conversational audio playback is a blob:
 *    path.
 *  - frame-src carries no ElevenLabs origin. If the chosen integration
 *    iframes, it is blocked.
 *
 * RECOMMENDED FIX, pending Ariel's sign-off (CSP is his lane): use the npm SDK
 * (@elevenlabs/react) rather than the unpkg widget embed. A bundled dependency
 * is covered by 'strict-dynamic' through our own nonced entry chunk, needs no
 * third-party host in script-src, and needs no pinned hashes that silently rot
 * on the vendor's next release. That reduces the whole change to one media-src
 * line instead of a permanent third-party concession.
 *
 * If the widget route is chosen instead, regenerate the hashes from real
 * violation reports — app/api/csp-report/route.ts now exists to receive them
 * and logs the browser's script-sample, which is the value you hash. Until
 * 2026-08-20 that endpoint was referenced by report-uri but had no handler, so
 * every report 404'd and the instruction to "check /api/csp-report" pointed at
 * a route that could not answer.
 */
function buildCspHeaders(nonce: string): Record<string, string> {
  const csp = [
    `default-src 'self'`,
    // 'strict-dynamic' means the browser ignores 'self' and every host-source
    // and trusts only nonced scripts. That REQUIRES every page under this
    // middleware to be rendered per-request, because a nonce is per-request by
    // definition: statically prerendered HTML is produced at build time, when
    // middleware never runs, so its script tags can never carry one.
    //
    // Measured on the deployed preview 2026-08-18: / and /auctions were static
    // (marked as static in the build output), so of 12 script tags 0 were
    // nonced, all 7 same-origin chunks were refused, and /auctions painted 90
    // characters with no calendar and no map - the white-screen failure this
    // rebuild exists to end. zonewise.ai, which runs this same policy
    // successfully, serves those routes dynamically: 33 script tags, 29 nonced.
    //
    // The fix is therefore `export const dynamic = 'force-dynamic'` on the
    // pages, NOT a weaker policy. Dropping 'strict-dynamic' was tried and only
    // moved the failure: chunks then loaded, but Next's inline flight-data
    // scripts were refused instead, so the page still never hydrated.
    // blob: is here for mapbox-gl, which compiles its renderer into a Blob and
    // spawns it as a worker. Without it the map pane paints white on every
    // load. ('strict-dynamic' makes the browser ignore scheme-sources for
    // scripts, so the directive that actually unblocks the worker is
    // worker-src below; blob: is stated in both, per spec, so the policy does
    // not depend on a fallback chain.)
    // app.chatwoot.com is listed here for completeness/documentation, but
    // 'strict-dynamic' makes every host-source in this directive inert per
    // spec — the browser trusts only nonced (or nonce-descended) scripts.
    // ChatwootWidget.tsx therefore renders its two inline scripts with the
    // request nonce; sdk.js itself is fetched cross-origin by those nonced
    // scripts, which is permitted (fetching a script has no origin
    // restriction — only the fetching script needs to be trusted).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' blob: https://js.stripe.com https://*.clerk.accounts.dev https://clerk.biddeed.ai https://app.chatwoot.com`,
    // Explicit rather than inheriting from script-src via child-src.
    `worker-src 'self' blob:`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https://img.clerk.com https://images.clerk.dev https://*.clerk.accounts.dev https://clerk.biddeed.ai https://*.supabase.co https://www.bcpao.us https://gis.brevardfl.gov https://api.mapbox.com https://*.mapbox.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `connect-src 'self' https://*.clerk.accounts.dev wss://*.clerk.accounts.dev https://clerk.biddeed.ai https://api.clerk.com https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://api.stripe.com https://api.us.elevenlabs.io wss://api.us.elevenlabs.io https://api.elevenlabs.io wss://api.elevenlabs.io https://app.chatwoot.com wss://app.chatwoot.com`,
    `frame-src 'self' https://*.clerk.accounts.dev https://clerk.biddeed.ai https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com https://app.chatwoot.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `report-uri /api/csp-report`,
    `report-to csp-endpoint`,
  ].join('; ')

  const cspHeaderName = IS_PROD
    ? 'Content-Security-Policy'
    : 'Content-Security-Policy-Report-Only'

  return {
    [cspHeaderName]: csp,
    'Report-To': JSON.stringify({
      group: 'csp-endpoint',
      max_age: 10886400,
      endpoints: [{ url: '/api/csp-report' }],
    }),
  }
}

function applySecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  const cspHeaders = buildCspHeaders(nonce)

  for (const [key, value] of Object.entries(cspHeaders)) {
    response.headers.set(key, value)
  }

  // Additional security headers (complement next.config static headers)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  // microphone=(self): required for the ElevenLabs Voice Draftsman widget on
  // /floorplan to request mic access. Was microphone=() (blocked site-wide),
  // which silently broke voice before the browser even reached agent config.
  response.headers.set('Permissions-Policy', 'geolocation=(self), payment=(self \"https://js.stripe.com\"), camera=(), microphone=(self), interest-cohort=()')

  // Pass nonce to pages via header so they can use it in <script nonce={}>
  response.headers.set('x-nonce', nonce)

  return response
}

/**
 * Build the request headers Next.js needs in order to nonce its own scripts.
 *
 * Next does NOT look at x-nonce. Confirmed in
 * next/dist/server/app-render/app-render.js: it reads
 * headers['content-security-policy'] (falling back to the report-only variant)
 * off the INCOMING request and parses the nonce out of that string.
 * applySecurityHeaders also sets x-nonce on the RESPONSE, which is useful for
 * pages rendering their own inline <script nonce={...}>, but it never reaches
 * the renderer - so with response-only propagation Next emitted every script
 * tag with no nonce at all.
 */
function withNonceRequestHeaders(req: NextRequest, nonce: string): Headers {
  const headers = new Headers(req.headers)
  headers.set('x-nonce', nonce)
  for (const [name, value] of Object.entries(buildCspHeaders(nonce))) {
    headers.set(name, value)
  }
  return headers
}

function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Buffer.from(array).toString('base64')
}

// When Clerk is not configured, use a passthrough middleware with rate limiting + CSP
function passthroughMiddleware(req: NextRequest) {
  const rateLimitResponse = rateLimitMiddleware(req)
  if (rateLimitResponse) return rateLimitResponse

  const nonce = generateNonce()
  const response = NextResponse.next({
    request: { headers: withNonceRequestHeaders(req, nonce) },
  })
  return applySecurityHeaders(response, nonce)
}

export default CLERK_ENABLED
  ? clerkMiddleware(async (auth, req) => {
      const rateLimitResponse = rateLimitMiddleware(req)
      if (rateLimitResponse) return rateLimitResponse

      if (!isPublicRoute(req)) {
        await auth.protect()
      }

      const nonce = generateNonce()
      const response = NextResponse.next({
        request: { headers: withNonceRequestHeaders(req, nonce) },
      })
      return applySecurityHeaders(response, nonce)
    })
  : passthroughMiddleware

/**
 * WHY THIS MATCHER LOOKS LIKE THIS — the CSP outage, root-caused.
 *
 * Symptom (measured 2026-08-18): `curl -sI https://biddeed-web.vercel.app/radar`
 * returned NO content-security-policy, NO x-nonce, and none of the static
 * headers from next.config.mjs either. The apex therefore fell through to the
 * Worker's own SECURITY_CSP, which has no `blob:` and no api.mapbox.com — the
 * white map pane in META_PROMPT_v7 section 0.
 *
 * Root cause: Next PREFIXES every middleware matcher with basePath at build
 * time. While the app was mounted at basePath '/radar' the single matcher
 * `/((?!_next|...).*)` compiled to `/radar/((?!_next|...).*)`, which requires
 * a trailing slash — so the app's own home page, exactly `/radar`, matched
 * nothing and middleware never ran on it. next.config's `headers()` source
 * `/(.*)` is basePath-prefixed the same way, which is why those headers were
 * missing too. Two independent symptoms, one cause. Verified by compiling both
 * regexes against both basePaths.
 *
 * basePath is now '' so the old matcher would work again by accident. It is
 * rewritten anyway, because "works by accident" is how this broke:
 *   - '/' is listed EXPLICITLY. It is the landing page and the single most
 *     expensive route to lose a nonce on; it does not depend on a lookahead.
 *   - the dot is properly escaped ('\\.' -> /\./). In the previous string the
 *     escape was swallowed by the JS string literal, so the regex carried a
 *     bare `.` matching ANY character — '/anycss', '/apixml' and friends were
 *     silently excluded from CSP.
 *   - the extension list is anchored with $, so only real file extensions
 *     bypass, not any path that happens to contain 'css'.
 *   - _next/static and _next/image still bypass: hashed assets need no nonce
 *     and running middleware on them is pure latency.
 */
export const config = {
  matcher: [
    '/',
    // EG14 P3: txt|xml keep /robots.txt and /sitemap.xml out of middleware.
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:html?|css|js|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)$).*)',
    '/(api|trpc)(.*)',
  ],
}
