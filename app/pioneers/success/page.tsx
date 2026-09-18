'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-100">
      <h1 className="mb-3 text-3xl font-bold">
        {status === 'working' ? 'Confirming your Pioneer seat…' : status === 'ok' ? "You're in" : 'Almost there'}
      </h1>
      <p className="mb-6 max-w-md text-zinc-400">
        {status === 'ok'
          ? 'Pro access is unlocking now. Keep renewing at $990/year to hold your rate lock.'
          : status === 'working'
            ? 'Stripe payment received — finishing Pro entitlement and seat claim.'
            : 'Payment may still be settling. Refresh in a minute, or open the dashboard once you get the receipt email.'}
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950"
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
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
          Loading…
        </main>
      }
    >
      <SuccessInner />
    </Suspense>
  )
}
