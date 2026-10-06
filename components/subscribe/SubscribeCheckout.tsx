'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { track } from '@/lib/analytics/funnel'

import { PLANS } from '@/components/deed-home/LandingSections'
import { apiUrl } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Interval = 'monthly' | 'annual'
type TierSlug = 'investor' | 'pro' | 'proplus'

const PLAY_LAUNCH_PROMO = 'MVP_PLAY_LAUNCH'

const TIER_PLAN: Record<TierSlug, (typeof PLANS)[number]> = {
  investor: PLANS.find((p) => p.name === 'Investor')!,
  pro: PLANS.find((p) => p.name === 'Pro')!,
  proplus: PLANS.find((p) => p.name === 'Pro Plus')!,
}

function isTierSlug(v: string | null): v is TierSlug {
  return v === 'investor' || v === 'pro' || v === 'proplus'
}

// Pro Plus and Enterprise are locked as Coming Soon (Ariel, 2026-09-10):
// neither has a self-serve checkout. Pro Plus reopens with 50 statewide
// reports and the weekly county dossier; Enterprise stays custom/unlimited.
// Both render this screen instead of a checkout form. ?tier=enterprise used
// to fall through to the 'pro' default and silently sold the wrong plan
// (#20120) - the explicit screens below keep that class of bug closed.
function ComingSoon({ tier }: { tier: 'proplus' | 'enterprise' }) {
  const copy =
    tier === 'proplus'
      ? {
          eyebrow: 'biddeed.ai Pro Plus',
          title: 'Pro Plus opens soon.',
          body: 'Everything you need from the auction calendar to the closing table: 50 statewide full SIGNAL$ reports a month, a weekly SIGNAL$ dossier for one chosen county, budgets, scopes of work, and books that match the job. Pro is live today with 30 reports a month.',
          href: '/subscribe?tier=pro',
          cta: 'Start Pro today',
        }
      : {
          eyebrow: 'biddeed.ai Enterprise',
          title: 'Enterprise opens soon.',
          body: 'White-label, unlimited, broker B2B - priced to your county footprint and seat count. Custom contracts only, never a self-serve checkout. Tell us what you need and we will follow up first.',
          href: '/support',
          cta: 'Contact us',
        }
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{copy.eyebrow}</p>
        <h1 className="font-display mt-2 text-2xl font-medium tracking-tight text-foreground">{copy.title}</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{copy.body}</p>
        <a
          href={copy.href}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {copy.cta}
        </a>
      </div>
    </div>
  )
}

/**
 * Posts the existing Worker checkout contract:
 * {tier, customer_email, interval} -> POST /subscribe/checkout -> {url}.
 * referral_code, visitor_id, and promo are optional passthroughs — additive,
 * not part of the required contract, and safe to omit if absent.
 * Promo is metadata for campaign attribution / schedule wiring; the frontend
 * never invents Stripe secrets or applies discounts itself.
 */
export default function SubscribeCheckout() {
  const params = useSearchParams()
  const rawTier = params.get('tier')
  const promo = params.get('promo')

  if (rawTier === 'enterprise' || rawTier === 'proplus') {
    return <ComingSoon tier={rawTier} />
  }

  const tier: TierSlug = isTierSlug(rawTier) ? (rawTier as TierSlug) : 'pro'
  const plan = TIER_PLAN[tier]
  const isPlayLaunch = promo === PLAY_LAUNCH_PROMO && tier === 'pro'
  // Launch offer is monthly ($199 month 1 → 2 free). Annual stays available
  // on the normal subscribe path without this promo.
  const initialInterval: Interval =
    isPlayLaunch ? 'monthly' : params.get('interval') === 'annual' ? 'annual' : 'monthly'

  const [interval, setInterval] = useState<Interval>(initialInterval)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const price = interval === 'annual' && plan.annualPrice ? plan.annualPrice : plan.price
  const per = interval === 'annual' && plan.annualPer ? plan.annualPer : plan.per
  const refCode = params.get('ref')

  const canAnnual = useMemo(() => Boolean(plan.annualPrice) && !isPlayLaunch, [plan, isPlayLaunch])

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
      interval: isPlayLaunch ? 'monthly' : interval,
    }
    if (refCode) payload.referral_code = refCode
    if (visitorId) payload.visitor_id = visitorId
    if (promo) payload.promo = promo

    try {
      const res = await fetch(apiUrl('/subscribe/checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        track(
          'checkout_started',
          {
            product: 'subscription',
            plan: tier,
            interval: isPlayLaunch ? 'monthly' : interval,
            surface: 'subscribe',
            ...(promo ? { promo } : {}),
          },
          { beacon: true }
        )
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
        {isPlayLaunch ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              BidDeed Field · Play launch offer
            </p>
            <h1 className="font-display mt-2 text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Pay 1 month. Get 2 free.
            </h1>
            <p className="mt-4 text-base leading-6 text-muted-foreground">
              Pro is $199/mo. For the Field Android soft launch, pay{' '}
              <span className="font-semibold text-foreground">$199 for month 1</span>
              ; months 2 and 3 are free; then Pro continues at $199/mo until you cancel.
              Billing is on biddeed.ai (Stripe) — not a Google Play in-app purchase.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm leading-6 text-muted-foreground">
              <li>
                Month 1: <span className="font-semibold text-foreground">$199</span> charged today
              </li>
              <li>
                Months 2–3: <span className="font-semibold text-foreground">$0</span>
              </li>
              <li>
                Month 4+: <span className="font-semibold text-foreground">$199/mo</span> until you cancel
              </li>
            </ul>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="tabular font-display text-4xl font-medium tracking-tight text-foreground">
                $199
              </span>
              <span className="text-sm text-muted-foreground">due today · then 2 months free</span>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              BidDeed.AI {plan.name}
            </h1>
            <p className="mt-2 flex items-baseline gap-1">
              <span className="tabular font-display text-4xl font-medium tracking-tight text-foreground">
                {price}
              </span>
              <span className="text-sm text-muted-foreground">{per}</span>
            </p>
            <p className="mt-4 text-base leading-6 text-muted-foreground">
              Enter your email to continue to secure checkout. You are redirected to Stripe — no card is
              stored here.
            </p>
          </>
        )}

        {canAnnual ? (
          <div
            role="radiogroup"
            aria-label="Billing interval"
            className="mt-6 inline-flex rounded-xl border border-input bg-background p-1"
          >
            {(['monthly', 'annual'] as const).map((iv) => (
              <button
                key={iv}
                type="button"
                role="radio"
                aria-checked={interval === iv}
                onClick={() => setInterval(iv)}
                className={cn(
                  'min-h-9 rounded-lg px-4 text-sm font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  interval === iv
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-secondary'
                )}
              >
                {iv === 'annual' ? `Annual — ${plan.annualPrice}/yr` : `Monthly — ${plan.price}/mo`}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          {!isPlayLaunch ? null : (
            <p className="text-sm leading-6 text-muted-foreground">
              Enter your email to continue to secure checkout. You are redirected to Stripe — no card is
              stored here.
            </p>
          )}
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
            {submitting
              ? 'Redirecting to checkout…'
              : isPlayLaunch
                ? 'Start Pro — Play launch →'
                : 'Continue to checkout →'}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>

        {isPlayLaunch ? (
          <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
            Offer code <span className="font-mono font-semibold text-foreground">{PLAY_LAUNCH_PROMO}</span>.
            Limited to the Play launch window. Not redeemable as cash. Android listing may be Internal
            testing / invite-only until production rollout.
          </p>
        ) : (
          <p className="mt-5 text-center text-base text-muted-foreground">
            Not ready to pay?{' '}
            <a href="/free-report" className="font-semibold text-primary underline-offset-4 hover:underline">
              Try 67 counties free — no card required →
            </a>
          </p>
        )}
      </div>
    </div>
  )
}
