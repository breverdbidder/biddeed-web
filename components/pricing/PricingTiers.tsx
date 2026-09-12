'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

import { PLANS, W, BTN_PRIMARY, BTN_QUIET, BTN_DISABLED } from '@/components/deed-home/LandingSections'
import { cn } from '@/lib/utils'

type Interval = 'monthly' | 'annual'

export default function PricingTiers() {
  const [interval, setInterval] = useState<Interval>('monthly')

  return (
    <div className="tier-cq mx-auto w-full max-w-6xl px-4 pb-28 pt-10 sm:px-6 sm:pb-16 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Plans</p>
      <h1 className="font-display mt-2 text-[1.9rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-4xl">
        One below-market win pays for years of <a href="/maps" className="font-medium text-primary underline underline-offset-2 hover:text-primary/80">biddeed.ai</a>.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        Every Florida auction is free to browse, and free members see the published number on every property:
        2,911 live right now across 60 counties, each with its own <a href="/maps" className="font-medium text-primary underline underline-offset-2 hover:text-primary/80">deal page</a>.
        Investor, Pro, and Pro Plus add the depth: reports, Due Diligence, and video property assessment with
        360° Orbit on the properties you work, as available. Every level includes the Academy lessons written for it.
      </p>

      <div
        role="radiogroup"
        aria-label="Billing interval"
        className="mt-8 inline-flex rounded-xl border border-input bg-card p-1"
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
              interval === iv ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'
            )}
          >
            {iv === 'annual' ? 'Annual — save 2 months' : 'Monthly'}
          </button>
        ))}
      </div>

      <div className="tier-grid mt-8">
        {PLANS.map((p) => {
          const showAnnual = interval === 'annual' && p.annualPrice
          const price = showAnnual ? p.annualPrice : p.price
          const per = showAnnual ? p.annualPer : p.per
          const href =
            p.cta.href && interval === 'annual' && p.cta.href.startsWith('/subscribe')
              ? `${p.cta.href}&interval=annual`
              : p.cta.href

          return (
            <div
              key={p.name}
              className={cn(
                'flex flex-col rounded-2xl border bg-card p-6',
                p.featured ? 'border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.10)]' : 'border-border'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-foreground">{p.name}</h2>
                {p.featured ? (
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">
                    Most chosen
                  </span>
                ) : null}
              </div>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="tabular font-display text-4xl font-medium tracking-tight text-foreground">
                  {price}
                </span>
                <span className="text-sm text-muted-foreground">{per}</span>
                {/* The visible price flips with the client-side interval toggle above,
                    so a plain (non-JS) fetch of this page only ever sees one state.
                    This keeps the other price in the server-rendered HTML too —
                    sr-only, so it changes nothing visually. */}
                {p.annualPrice ? (
                  <span className="sr-only">
                    {showAnnual ? `${p.price}${p.per} also available monthly` : `${p.annualPrice}${p.annualPer} also available annually`}
                  </span>
                ) : null}
              </p>
              <p className="mt-2 text-base text-muted-foreground">{p.blurb}</p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-base leading-5 text-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {f}
                  </li>
                ))}
                {p.soon?.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-base leading-5 text-muted-foreground">
                    <span className="mt-1 inline-block size-2.5 shrink-0 rounded-full border border-input" aria-hidden />
                    <span>
                      {f} <span className="text-xs font-semibold uppercase tracking-wide text-primary">soon</span>
                    </span>
                  </li>
                ))}
              </ul>
              {href ? (
                <a href={href} className={cn(BTN_PRIMARY, 'mt-6 w-full')}>
                  {p.cta.label}
                </a>
              ) : (
                <span aria-disabled="true" className={cn(BTN_DISABLED, 'mt-6 w-full')}>
                  {p.cta.label}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-secondary p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold text-foreground">The level between Free and Investor</h2>
          <p className="mt-1 text-base text-muted-foreground">
            One SIGNAL$ Property Report for a single auction, $25, no subscription. The Academy&apos;s free
            How-to-use-BidDeed track shows you what is inside first.
          </p>
        </div>
        <a href={W.buyReport} className={cn(BTN_QUIET, 'shrink-0 bg-card')}>
          Buy one report — $25 →
        </a>
      </div>
    </div>
  )
}
