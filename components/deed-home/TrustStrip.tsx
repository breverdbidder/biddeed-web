'use client'

import { formatCount, useAuctionCounts } from '@/components/shell/useAuctionCounts'
import { cn } from '@/lib/utils'

/* ── Live counts ─────────────────────────────────────────────────────────── */

export default function TrustStrip() {
  const c = useAuctionCounts()
  const items = [
    { value: formatCount(c.upcoming), label: 'upcoming sales', title: 'Live-scoped upcoming auctions across Florida, from the shared auction summary.' },
    { value: formatCount(c.counties), label: 'counties with sales', title: 'Counties with at least one upcoming sale on the calendar right now.' },
    { value: formatCount(c.total), label: 'auction records', title: 'Every foreclosure and tax deed auction record BidDeed.AI has captured to date.' },
  ]
  return (
    <dl className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-center">
      {/* dt before dd in the DOM (axe definition-list / WCAG 1.3.1); flex-row-reverse keeps the number-first reading order on screen. */}
      {items.map((it) => (
        <div key={it.label} className="flex flex-row-reverse items-baseline gap-2" title={it.title}>
          <dt className="text-sm text-muted-foreground">{it.label}</dt>
          <dd className={cn('tabular text-lg font-semibold text-foreground', c.loading && 'animate-pulse')}>{it.value}</dd>
        </div>
      ))}
      <div className="flex flex-row-reverse items-baseline gap-2">
        <dt className="text-sm text-muted-foreground">Florida counties covered</dt>
        <dd className="text-lg font-semibold text-foreground">67</dd>
      </div>
    </dl>
  )
}
