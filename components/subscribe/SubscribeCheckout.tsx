'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { PLANS } from '@/components/deed-home/LandingSections'
import { apiUrl } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Interval = 'monthly' | 'annual'
type TierSlug = 'investor' | 'pro' | 'proplus'

const TIER_PLAN: Record<TierSlug, (typeof PLANS)[number]> = {
  investor: PLANS.find((p) => p.name === 'Investor')!,
  pro: PLANS.find((p) => p.name === 'Pro')!,
  proplus: PLANS.find((p) => p.name === 'Pro Plus')!,
}

function isTierSlug(v: string | null): v is TierSlug {
  return v === 'investor' || v === 'pro' || v === 'proplus'
}

/**
 * Posts the existing Worker checkout contract unchanged:
 * {tier, customer_email, interval} -> POST /subscribe/checkout -> {url}.
 * referral_code and visitor_id are optional passthroughs the live page also
 * sends today (ref query param, bd_vid localStorage) — additive, not part of
 * the required contract, and safe to omit if either is absent.
 */
export default function SubscribeCheckout() {
  const params = useSearchParams()
  const tier: TierSlug = isTierSlug(params.get('tier')) ? (params.get('tier') as TierSlug) : 'pro'
  const plan = TIER_PLAN[tier]
  const initialInterval: Interval = params.get('interval') === 'annual' ? 'annual' : 'monthly'

  const [interval, setInterval] = useState<Interval>(initialInterval)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const price = interval === 'annual' && plan.annualPrice ? plan.annualPrice : plan.price
  const per = interval === 'annual' && plan.annualPer ? plan.annualPer : plan.per
  const refCode = params.get('ref')

  const canAnnual = useMemo(() => Boolean(plan.annualPrice), [plan])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    let visitorId: string | null = null
    try {
      visitorId = window.localStorage.getItem('bd_vid')
    } catch {
      // localStorage unavailable (private mode) — proceed without it.
    }

    const payload: Record<string, string> = {
      tier,
      customer_email: email.trim(),
      interval,
    }
    if (refCode) payload.referral_code = refCode
    if (visitorId) payload.visitor_id = visitorId

    try {
      const res = await fetch(apiUrl('/subscribe/checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      setError(data.error || 'Something went wrong. Please try again.')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">BidDeed.AI {plan.name}</p>
        <p className="mt-2 flex items-baseline gap-1">
          <span className="tabular font-display text-4xl font-medium tracking-tight text-foreground">{price}</span>
          <span className="text-sm text-muted-foreground">{per}</span>
        </p>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Enter your email to continue to secure checkout. You are redirected to Stripe — no card is stored here.
        </p>

        {canAnnual ? (
          <div role="radiogroup" aria-label="Billing interval" className="mt-6 inline-flex rounded-xl border border-input bg-background p-1">
            {(['monthly', 'annual'] as const).map((iv) => (
              <button
                key={iv}
                type="button"
                role="radio"
                aria-checked={interval === iv}
                onClick={() => setInterval(iv)}
                className={cn(
                  'min-h-9 rounded-lg px-4 text-sm font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  interval === iv ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'
                )}
              >
                {iv === 'annual' ? `Annual — ${plan.annualPrice}/yr` : `Monthly — ${plan.price}/mo`}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <label htmlFor="sub-email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="sub-email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-11"
          />
          <Button type="submit" disabled={submitting} className="mt-2 min-h-11">
            {submitting ? 'Redirecting to checkout…' : 'Continue to checkout →'}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Not ready to pay?{' '}
          <a href="/free-report" className="font-semibold text-primary underline-offset-4 hover:underline">
            Try 67 counties free — no card required →
          </a>
        </p>
      </div>
    </div>
  )
}
