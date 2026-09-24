'use client'

import { useCallback, useEffect, useState } from 'react'
import { track } from '@/lib/analytics/funnel'
import { SkeletonInline } from '@/components/ui/skeleton'

type Availability = {
  sold: number
  cap: number
  remaining: number
  soldOut: boolean
  offer: {
    priceAnnualUsd: number
    tier: string
    rateLock: string
    listProAnnualUsd: number
  }
}

export function PioneerCheckout() {
  const [avail, setAvail] = useState<Availability | null>(null)
  const [availState, setAvailState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // PARITY CP-1 §2: the seat count loads with a placeholder, and a failed
  // count no longer disables the purchase for good — the checkout itself
  // re-checks the cap on the server (409 when sold out), so the count is
  // information, not a gate. It can be retried in place.
  const refresh = useCallback(async () => {
    setAvailState('loading')
    try {
      const res = await fetch('/api/pioneers/availability', { cache: 'no-store' })
      if (!res.ok) throw new Error('Could not load seats')
      setAvail(await res.json())
      setAvailState('ready')
    } catch {
      setAvailState('error')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function startCheckout(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/pioneers/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Checkout failed')
        setLoading(false)
        return
      }
      if (data.url) {
        track('checkout_started', { product: 'pioneer_pro', plan: 'pro_annual', surface: 'pioneers' }, { beacon: true })
        window.location.href = data.url as string
        // Stays in "Redirecting to Stripe…" (loading) while the browser leaves.
        return
      }
      setError('No checkout URL returned')
      setLoading(false)
    } catch {
      setError('Checkout failed')
      setLoading(false)
    }
  }

  const soldOut = avail?.soldOut === true

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-primary/40 bg-card p-6 shadow-xl">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">Join 100 Pioneers</h2>
        {availState === 'ready' && avail ? (
          <p className="text-base font-medium text-primary">
            {avail.remaining} of {avail.cap} left
          </p>
        ) : availState === 'loading' ? (
          <p className="text-base font-medium text-primary" role="status">
            <SkeletonInline className="h-4 w-24" />
            <span className="sr-only">Loading seats left</span>
          </p>
        ) : (
          <button type="button" onClick={() => void refresh()} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Seats left unavailable · Try again
          </button>
        )}
      </div>

      <p className="mb-4 text-base leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">$990/year</span> for{' '}
        <span className="font-medium text-foreground">Pro</span> access (list{' '}
        {avail ? `$${avail.offer.listProAnnualUsd.toLocaleString()}/yr` : '$1,990/yr'}). Same dollar
        as Investor annual — you get Pro, and your <span className="text-foreground">$990/yr Pro rate
        stays locked</span> for as long as you keep renewing. Cancel and the lock ends. Cap: 100.
        No Pro Plus. No direct founder line.
      </p>

      {soldOut ? (
        <p className="rounded-lg bg-secondary px-4 py-3 text-base text-foreground">
          Sold out — all 100 Pioneer seats are taken.
        </p>
      ) : (
        <form onSubmit={startCheckout} className="space-y-3">
          <label className="block text-[15px] text-muted-foreground">
            Email for Stripe receipt
            <input
              type="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="you@company.com"
              className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="submit"
            disabled={loading || availState === 'loading'}
            className="min-h-11 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {loading ? 'Redirecting to Stripe…' : 'Continue to Stripe — $990/year Pro'}
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-base text-destructive sm:text-[15px]" role="alert">{error}</p>}
    </div>
  )
}
