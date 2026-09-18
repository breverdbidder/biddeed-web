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
    <div className="mx-auto max-w-xl rounded-2xl border border-amber-500/40 bg-zinc-950/80 p-6 shadow-xl">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Join 100 Pioneers</h2>
        {avail && (
          <p className="text-sm text-amber-300/90">
            {avail.remaining} of {avail.cap} left
          </p>
        )}
      </div>

      <p className="mb-4 text-sm leading-relaxed text-zinc-300">
        <span className="font-medium text-white">$990/year</span> for{' '}
        <span className="font-medium text-white">Pro</span> access (list{' '}
        {avail ? `$${avail.offer.listProAnnualUsd.toLocaleString()}/yr` : '$1,990/yr'}). Same dollar
        as Investor annual — you get Pro, and your <span className="text-white">$990/yr Pro rate
        stays locked</span> for as long as you keep renewing. Cancel and the lock ends. Cap: 100.
        No Pro Plus. No direct founder line.
      </p>

      {soldOut ? (
        <p className="rounded-lg bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
          Sold out — all 100 Pioneer seats are taken.
        </p>
      ) : (
        <form onSubmit={startCheckout} className="space-y-3">
          <label className="block text-sm text-zinc-400">
            Email for Stripe receipt
            <input
              type="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="you@company.com"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-amber-500"
            />
          </label>
          <button
            type="submit"
            disabled={loading || !avail}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {loading ? 'Redirecting to Stripe…' : 'Continue to Stripe — $990/year Pro'}
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  )
}
