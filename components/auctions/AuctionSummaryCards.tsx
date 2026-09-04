'use client'

import type { AuctionSummary } from '@/types/auctions'

// Aug 17 2026: the fourth card read "298 KPIs / 3.1x / vs <a competitor>".
// All three values were hardcoded and nothing sourced them, and we do not
// name competitors on our own product surface (standing rule from Ariel).
// Replaced with a real number the SSOT summary function actually returns.

interface Props {
  summary: AuctionSummary | null
  loading: boolean
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card dark:bg-card border border-border dark:border-border rounded-lg p-4">
      <p className="text-xs text-muted-foreground dark:text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-foreground dark:text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

export default function AuctionSummaryCards({ summary, loading }: Props) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card dark:bg-card border border-border dark:border-border rounded-lg p-4 animate-pulse">
            <div className="h-3 w-16 bg-muted dark:bg-muted rounded mb-2" />
            <div className="h-8 w-12 bg-muted dark:bg-muted rounded" />
          </div>
        ))}
      </div>
    )
  }

  const countyCount = Object.keys(summary.by_county).length
  const addressRate = summary.total > 0
    ? `${((summary.with_address / summary.total) * 100).toFixed(0)}%`
    : '0%'
  // by_sale_type, not by_type: auction_type is NULL on 12,959 rows, so the
  // old split silently dropped 12% of the table (89,402 + 6,606 = 96,008 of
  // 108,968). sale_type is never null and always sums to the full count.
  const bySale = summary.by_sale_type || summary.by_type
  const fcCount = bySale['foreclosure'] || 0
  const tdCount = bySale['tax_deed'] || 0
  const upcoming = summary.upcoming ?? 0
  const upcomingCounties = summary.counties_upcoming ?? 0

  // Tiles size by CONTAINER width, not viewport.
  //
  // Tailwind's responsive prefixes read the viewport, but these tiles live in
  // the workspace column, whose real width is viewport minus the nav rail minus
  // the Deed panel. Measured in production 2026-08-20 at 1280x800 with Deed
  // open: the container was ~460px while the breakpoint still forced five
  // columns, so the tiles were squeezed until the figures themselves clipped -
  // the total rendered as "109,40". A truncated number on a bidding screen is a
  // wrong number, not a cosmetic issue.
  //
  // auto-fit + minmax resolves against the actual container width and needs no
  // container-query plugin, so the tiles wrap instead of shrinking.
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
      <StatCard label="Total Auctions" value={summary.total.toLocaleString()} sub={`${countyCount} counties`} />
      <StatCard label="Foreclosures" value={fcCount.toLocaleString()} sub={`${tdCount.toLocaleString()} tax deeds`} />
      <StatCard label="With Address" value={summary.with_address.toLocaleString()} sub={addressRate} />
      <StatCard label="Upcoming" value={upcoming.toLocaleString()} sub={`${upcomingCounties} counties`} />
      <StatCard label="AI Scoring" value="Live" sub="Shapira Formula" />
    </div>
  )
}
