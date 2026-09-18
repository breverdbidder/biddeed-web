'use client'

import { useCallback, useEffect, useState } from 'react'

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
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/pioneers/availability', { cache: 'no-store' })
      if (!res.ok) throw new Error('Could not load seats')
      setAvail(await res.json())
    } catch {
      setError('Could not load Pioneer availability')
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
        window.location.href = data.url as string
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
        {avail && (
          <p className="text-base font-medium text-primary">
            {avail.remaining} of {avail.cap} left
          </p>
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
            disabled={loading || !avail}
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
