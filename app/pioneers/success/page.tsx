'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { track } from '@/lib/analytics/funnel'

function SuccessInner() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working')

  useEffect(() => {
    if (!sessionId) {
      setStatus('error')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/pioneers/confirm?session_id=${encodeURIComponent(sessionId)}`, {
          method: 'POST',
        })
        if (cancelled) return
        if (res.ok) {
          // Funnel completion (PARITY D14) for the Pioneer Pro conversion.
          // Fires only when confirm succeeds; PostHogIdentify attributes it to
          // the buyer. Server-side (Stripe webhook) is the reliable count and
          // is held for billing-path sign-off.
          try {
            ;(globalThis as unknown as { posthog?: { capture?: (e: string, p?: Record<string, unknown>) => void } })
              .posthog?.capture?.('checkout_completed', { product: 'pioneer_pro', plan: 'pro_annual', session_id: sessionId })
          } catch {}
          try {
            track('purchase_completed', { product: 'pioneer_pro', plan: 'pro_annual', currency: 'usd', surface: 'pioneers_success' })
          } catch {}
        }
        setStatus(res.ok ? 'ok' : 'error')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
      <h1 className="mb-3 text-3xl font-bold">
        {status === 'working' ? 'Confirming your Pioneer seat…' : status === 'ok' ? "You're in" : 'Almost there'}
      </h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        {status === 'ok'
          ? 'Pro access is unlocking now. Keep renewing at $990/year to hold your rate lock.'
          : status === 'working'
            ? 'Stripe payment received — finishing Pro entitlement and seat claim.'
            : 'Payment may still be settling. Refresh in a minute, or open the dashboard once you get the receipt email.'}
      </p>
      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Go to dashboard
      </Link>
    </main>
  )
}

export default function PioneerSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
          Loading…
        </main>
      }
    >
      <SuccessInner />
    </Suspense>
  )
}
