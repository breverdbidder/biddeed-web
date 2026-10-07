'use client'

import dynamic from 'next/dynamic'
import { useEngagedMount } from '@/lib/perf/idle'

const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

// The free-report popup (issue #181) opens after a 12 s dwell, 45% scroll or
// exit intent - never at first paint - so its code (Radix Dialog, the account
// step, the email-code flow) is not in the first-load bundle. Pass 3
// (2026-10-07): it mounts on the visitor's first interaction, or 5 s after
// load, instead of at the first idle slot after load - which still put ~17 KiB
// of script into the page-load window. The dwell still counts from page start
// (FreeReportPopup uses performance.now()), so a visitor sees no difference.
const FreeReportPopup = dynamic(() => import('@/components/lead/FreeReportPopup'), { ssr: false })

// Everything that touches Clerk - ClerkProvider, its appearance, the PostHog
// identity tie-in and the Clerk-aware popup - lives in ClerkAuthShell and is
// loaded only on the auth branch below. Without auth (no key pair, an
// unrecognised host, or the signed-out landing page - see layout.tsx) the
// Clerk SDK is never downloaded (PageSpeed pass 3, 2026-10-07).
const ClerkAuthShell = dynamic(() => import('./ClerkAuthShell'))

export default function ConditionalClerkProvider({
  children,
  nonce,
  hostAuthorized = false,
  authEnabled = false,
}: {
  children: React.ReactNode
  /**
   * Whether the serving host is one the production Clerk instance recognises
   * (biddeed.ai, *.biddeed.ai, localhost). Computed server-side in layout.tsx
   * from x-forwarded-host so server and client render identically. On any
   * other host Clerk's same-origin /__clerk proxy calls are answered 400
   * host_invalid by Clerk - so the provider stands down instead of shipping
   * two guaranteed-failed requests per page view.
   */
  hostAuthorized?: boolean
  /**
   * Explicit staged activation flag. Keys may be present while the provider
   * remains disabled until proxy and authenticated E2E checks pass.
   */
  authEnabled?: boolean
  /**
   * CSP nonce from middleware (x-nonce). REQUIRED: script-src uses
   * 'strict-dynamic', which makes host allowlists inert — Clerk's injected
   * scripts are only trusted if they carry the nonce. Without this the sign-in
   * form renders but every Clerk request is blocked and Continue does nothing.
   * (Scar carried over from zonewise-web, where this exact failure shipped.)
   */
  nonce?: string
}) {
  const popupReady = useEngagedMount()

  // No key -> render children without ClerkProvider. Keeps the app fully
  // functional in passthrough mode and mirrors middleware.ts, where
  // CLERK_ENABLED requires both halves of the credential pair.
  if (!CLERK_KEY || !hostAuthorized || !authEnabled) {
    // No auth on this host/deploy: every visitor is signed out.
    return (
      <>
        {children}
        {popupReady ? <FreeReportPopup signedIn={false} /> : null}
      </>
    )
  }

  return <ClerkAuthShell nonce={nonce}>{children}</ClerkAuthShell>
}
