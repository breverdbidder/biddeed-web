import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

const CLERK_ENABLED = Boolean(process.env.CLERK_SECRET_KEY)
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
  '/api/csp-report(.*)',
  '/api/floorplan(.*)',
  '/api/massing(.*)', // public: 3D Massing Engine has no login gate, same as /massing page itself
  // Stripe webhooks MUST be public (Stripe sends without auth)
  '/api/stripe/webhook(.*)',
  // Pages — public access
  '/',
  '/chat(.*)',
  '/dashboard(.*)',
  '/pricing(.*)',
  '/help(.*)',
  '/docs(.*)',
  '/explore(.*)',
  '/explorer(.*)',
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
<title>One moment · ZoneWise.AI</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#060b16; color:#e2e8f0; padding:24px;
         font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .card { width:100%; max-width:440px; background:rgba(15,23,42,.6); border:1px solid #1e293b;
          border-radius:16px; padding:32px 28px; text-align:center; }
  .brand { display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:22px; }
  .mark { width:36px; height:36px; border-radius:9px; background:#1d4ed8; color:#fff;
          font-weight:800; font-size:18px; display:flex; align-items:center; justify-content:center; }
  .name { font-size:17px; font-weight:700; color:#fff; }
  .name span { color:#f59e0b; }
  h1 { font-size:20px; margin:0 0 10px; color:#fff; }
  p { margin:0 0 22px; font-size:14px; line-height:1.6; color:#94a3b8; }
  .wait { font-variant-numeric:tabular-nums; font-weight:700; color:#f59e0b; }
  a { display:inline-flex; align-items:center; justify-content:center; min-height:44px;
      padding:0 22px; border-radius:10px; background:#f59e0b; color:#0b1220;
      font-weight:700; font-size:14px; text-decoration:none; }
  .fine { margin-top:18px; font-size:12px; color:#475569; }
</style></head>
<body>
  <main class="card">
    <div class="brand"><div class="mark">Z</div><div class="name">ZoneWise<span>.AI</span></div></div>
    <h1>One moment</h1>
    <p>We are seeing a burst of requests from your connection. This page retries
       itself in <span class="wait">${retryAfter}s</span> — no need to refresh.</p>
    <a href="/">Back to ZoneWise.AI</a>
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
 * script-src additions for ElevenLabs Voice Draftsman widget (Aug 2026):
 * - https://unpkg.com: hosts the @elevenlabs/convai-widget-embed bundle
 * - two sha256 hashes: the widget bootstraps by inserting two small inline
 *   <script> tags itself; strict-dynamic propagation does not cover these on
 *   all browsers, so pin the exact hashes reported by the browser's own CSP
 *   violation errors. NOTE: these hashes are tied to a specific widget
 *   bundle version — if a future ElevenLabs widget update changes its
 *   bootstrap script content, these hashes will need to be regenerated from
 *   fresh CSP violation reports (check /api/csp-report or browser console).
 * connect-src additions: the widget calls ElevenLabs' regional API (US) for
 * agent config and the realtime conversation websocket.
 */
function buildCspHeaders(nonce: string): Record<string, string> {
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com https://*.clerk.accounts.dev https://clerk.zonewise.ai`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https://img.clerk.com https://images.clerk.dev https://*.clerk.accounts.dev https://clerk.zonewise.ai https://*.supabase.co https://www.bcpao.us https://gis.brevardfl.gov https://api.mapbox.com https://*.mapbox.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `connect-src 'self' https://*.clerk.accounts.dev wss://*.clerk.accounts.dev https://clerk.zonewise.ai https://api.clerk.com https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://api.stripe.com https://api.us.elevenlabs.io wss://api.us.elevenlabs.io https://api.elevenlabs.io wss://api.elevenlabs.io`,
    `frame-src 'self' https://*.clerk.accounts.dev https://clerk.zonewise.ai https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com`,
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
  const response = NextResponse.next()
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
      const response = NextResponse.next()
      return applySecurityHeaders(response, nonce)
    })
  : passthroughMiddleware

export const config = {
  matcher: [
    // EG14 P3 FIX: added txt|xml so /robots.txt and /sitemap.xml bypass middleware entirely
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)).*)',
    '/(api|trpc)(.*)',
  ],
}
