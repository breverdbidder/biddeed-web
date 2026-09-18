import { NextRequest, NextResponse } from 'next/server'

import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { getCallerTierId, tierAtLeast } from '@/lib/tier/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const COUNTY_RE = /^[a-z _.'-]{3,40}$/i

/**
 * GET /api/auctions/outcomes?county=&days=&limit=
 *
 * PROMISE-10 (issue 20518). /pricing prints "Outcome scorecard after each
 * sale" as an Investor checkmark, inherited by Pro and Pro Plus. Nothing in
 * the product surfaced a completed sale: auction_results holds 5 rows with a
 * latest date of 2025-12-30, daily_auction_outcomes holds none, and
 * /api/auctions has no status filter at all — it only ever answers about
 * auctions that have not happened yet. A Pioneer could not look up what
 * anything sold for.
 *
 * The data was there the whole time: 3,709 sales with a sold amount across 60
 * counties, 2,119 of them in the last 180 days.
 *
 * What makes it a scorecard rather than a list is the comparison. A sold
 * amount on its own is a fact; next to what the sale opened at and what the
 * county assessed the property at, it is a read on whether the room was
 * disciplined. auction_outcome_scorecard() computes those three, plus who took
 * it — the street, the bank, or a named buyer.
 *
 * Investor and up. Free does not print this line, so free does not get it:
 * tier rank, not a named capability, same as the Investment Score.
 */
export async function GET(request: NextRequest) {
  const tierId = await getCallerTierId()
  if (!tierAtLeast(tierId, 'investor')) {
    return NextResponse.json(
      {
        error: 'Outcome scorecards are part of Investor and above.',
        tierId,
        upgradeTier: 'investor',
        upgradePrice: 99,
      },
      { status: 402 }
    )
  }

  const { searchParams } = new URL(request.url)
  const countyParam = searchParams.get('county')
  if (countyParam && !COUNTY_RE.test(countyParam)) {
    return NextResponse.json({ error: 'invalid county' }, { status: 400 })
  }
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '180', 10) || 180, 1), 1825)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200)

  const supabase = getRetryingSupabaseClient(undefined, { retryMode: 'full' })
  const { data, error } = await supabase.rpc('auction_outcome_scorecard', {
    p_county: countyParam ? countyParam.toLowerCase() : null,
    p_days: days,
    p_limit: limit,
  })
  if (error) {
    return NextResponse.json({ error: 'Unable to load outcomes.' }, { status: 502 })
  }

  const rows = (data ?? []) as Array<{
    winner_kind: string
    premium_pct: number | null
    sold_to_assessed_pct: number | null
    sold_amount: number | null
  }>

  // The roll-up is the point of the page, so it is computed here rather than
  // left to the client: a bidder wants "third parties paid 5x the opening bid
  // in this county last quarter", not 50 rows to average by hand.
  const avg = (pick: (r: (typeof rows)[number]) => number | null) => {
    const values = rows.map(pick).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    if (!values.length) return null
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
  }
  const byWinner: Record<string, number> = {}
  for (const r of rows) byWinner[r.winner_kind] = (byWinner[r.winner_kind] ?? 0) + 1

  return NextResponse.json({
    outcomes: rows,
    summary: {
      sales: rows.length,
      window_days: days,
      county: countyParam ? countyParam.toLowerCase() : null,
      by_winner: byWinner,
      avg_premium_pct: avg((r) => r.premium_pct),
      avg_sold_to_assessed_pct: avg((r) => r.sold_to_assessed_pct),
      avg_sold_amount: avg((r) => r.sold_amount),
    },
  })
}
