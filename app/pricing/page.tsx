import type { Metadata } from 'next'
import PricingTiers from '@/components/pricing/PricingTiers'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'

// force-dynamic: middleware mints a per-request CSP nonce (see middleware.ts) —
// same reasoning as every other route in this app (app/d4d/page.tsx et al).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pricing — BidDeed.AI',
  description:
    'BidDeed.AI pricing: look free with no account, then $25 SIGNAL$ reports, Investor, Pro, Pro Plus and Enterprise plans for Florida auctions.',
  alternates: {
    canonical: 'https://biddeed.ai/pricing',
  },
}

/**
 * PROMISE-3 (issue 20518): the count in the opening paragraph is read here,
 * not typed into the component. auctions_summary_ssot is the same SSOT the
 * product reads, so the sales page and the calendar cannot disagree. On any
 * failure the counts come back null and the sentence simply omits them — a
 * pricing page that guesses at its own inventory is worse than one that stays
 * quiet.
 */
async function liveCounts() {
  try {
    const supabase = getRetryingSupabaseClient(undefined, { retryMode: 'full' })
    const { data, error } = await supabase.rpc('auctions_summary_ssot')
    if (error || !data || typeof data !== 'object') return { upcoming: null, counties: null }
    const row = data as Record<string, unknown>
    const upcoming = typeof row.upcoming === 'number' ? row.upcoming : null
    const counties = typeof row.counties_upcoming === 'number' ? row.counties_upcoming : null
    return { upcoming, counties }
  } catch {
    return { upcoming: null, counties: null }
  }
}

export default async function PricingPage() {
  const counts = await liveCounts()
  return <PricingTiers counts={counts} />
}
