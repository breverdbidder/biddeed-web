import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Inter } from 'next/font/google'
import './globals.css'
import AppShell from '@/components/shell/AppShell'
import ConditionalClerkProvider from '@/components/ConditionalClerkProvider'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
})

// Inline SVG data URI, not a file. The Worker proxies exactly five path
// shapes to this app -- '/', '/_next/*', three '/api/*' trees, '/radar*' and
// '/order/success' -- so any icon served from its own URL 404s at the apex,
// and a browser with no <link rel="icon"> probes /favicon.ico and logs a
// console error on every page. A data URI needs no request and no proxy
// branch.
const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23F59E0B'/%3E%3Ctext x='16' y='23' font-family='system-ui,sans-serif' font-size='20' font-weight='800' text-anchor='middle' fill='%23020617'%3EB%3C/text%3E%3C/svg%3E"

export const metadata: Metadata = {
  title: 'BidDeed.AI — Auction Intelligence',
  description: 'Auction intelligence for foreclosure and tax deed investors.',
  icons: { icon: [{ url: ICON, type: 'image/svg+xml' }] },
}

/**
 * Force-dynamic at the layout, not just per page.
 *
 * Two reasons, both load-bearing:
 *  1. CSP. middleware mints a per-request nonce and Next reads it off the
 *     incoming content-security-policy header. Prerendered HTML is built
 *     before middleware runs, carries no nonce, and 'strict-dynamic' then
 *     refuses every script on it. Marking the layout covers routes that have
 *     no page file of their own -- /_not-found in particular.
 *  2. Hydration. The shell's nav reads useSearchParams; with nothing
 *     prerendered it needs no Suspense boundary, and without that boundary
 *     the sidebar hydrates in the same pass as its provider (see AppShell).
 */
export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  themeColor: '#020617',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // CSP nonce minted per-request by middleware. ClerkProvider must carry it:
  // script-src uses 'strict-dynamic', so Clerk's injected scripts are only
  // trusted when they inherit this nonce. The layout is already
  // force-dynamic, so reading headers() here changes nothing about rendering.
  const nonce = (await headers()).get('x-nonce') ?? undefined
  // `dark` is fixed on <html>. There is no theme switch: every component in
  // this app -- the shell and the ported AuctionRadar views alike -- carries
  // dark: variants and was designed against the #020617 / #0b1220 / #1e293b
  // palette. Without the class, Tailwind's darkMode:['class'] leaves the
  // workspace rendering its light fallback inside dark chrome.
  return (
    <html
      lang="en"
      className={`${inter.variable} dark`}
      style={{ background: '#020617', color: '#e2e8f0' }}
    >
      <body>
        {/*
          The shell wraps every route: nav rail, topbar and the Deed panel are
          persistent chrome, so they mount once here rather than per page.
          Every page underneath must export `dynamic = 'force-dynamic'` — see
          middleware.ts for why a prerendered page cannot carry a CSP nonce.
        */}
        {/*
          ConditionalClerkProvider no-ops (renders children directly) when
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is absent — mirroring middleware's
          CLERK_ENABLED pair-gate — so this wrapper is inert until the Clerk
          env pair is configured, and the shell can use Clerk hooks once it is.
        */}
        <ConditionalClerkProvider nonce={nonce}>
          <AppShell>{children}</AppShell>
        </ConditionalClerkProvider>
      </body>
    </html>
  )
}
