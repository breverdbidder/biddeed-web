import type { Metadata } from 'next'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import CountyGrid from '@/components/counties/CountyGrid'

// force-dynamic: middleware mints a per-request CSP nonce (see middleware.ts) —
// same reasoning as every other route in this app (app/d4d/page.tsx et al).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Counties — BidDeed.AI',
  description:
    'Every Florida county BidDeed.AI covers, with live auction counts and next sale dates. Gold Standard counties add full CMA and ZoneWise zoning.',
  alternates: {
    canonical: 'https://biddeed.ai/counties',
  },
}

type CountyRow = {
  county: string
  county_display: string
  upcoming: number
  next_auction: string | null
  is_gold_standard: boolean
  sale_types: string
}

// auctions_summary_ssot's sibling for per-county detail; read-only, so the
// stronger 'full' retry mode is safe (same pattern as app/api/auctions/summary).
async function fetchCounties(): Promise<CountyRow[]> {
  const supabase = getRetryingSupabaseClient(undefined, { retryMode: 'full' })
  const { data, error } = await supabase.rpc('get_all_counties_with_status')
  if (error || !Array.isArray(data)) return []
  return data as CountyRow[]
}

export default async function CountiesPage() {
  const counties = await fetchCounties()
  const sorted = [...counties].sort((a, b) => b.upcoming - a.upcoming)
  const goldCount = counties.filter((c) => c.is_gold_standard).length

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-10 sm:px-6 sm:pb-16 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Coverage</p>
      <h1 className="font-display mt-2 text-[1.9rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-4xl">
        67 Florida counties. Real inventory, priced daily.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        Every county on the calendar, with the upcoming sale count and next auction date pulled live.{' '}
        {goldCount > 0 ? (
          <>
            <span className="font-semibold text-foreground">{goldCount} Gold Standard {goldCount === 1 ? 'county' : 'counties'}</span> carry
            the full CMA, ZoneWise zoning, and win-probability prediction — every other county gets the auction
            calendar and max-bid range today, with the full build rolling out county by county.
          </>
        ) : (
          'Gold Standard counties carry the full CMA, ZoneWise zoning, and win-probability prediction.'
        )}
      </p>

      {sorted.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          County coverage is temporarily unavailable. Please retry shortly.
        </div>
      ) : (
        <CountyGrid counties={sorted} />
      )}
    </div>
  )
}
