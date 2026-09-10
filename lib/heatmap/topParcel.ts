import { getRecommendation } from '@/lib/scoring'
import type { TopParcel } from './types'

export interface CandidateAuctionRow {
  id: string
  county: string
  property_address: string | null
  auction_date: string | null
  sale_type: string | null
  opening_bid: number | null
  assessed_value: number | null
  market_value: number | null
}

const RANK: Record<string, number> = { BID: 0, REVIEW: 1, SKIP: 2, UNKNOWN: 3 }

/**
 * Deterministic "strongest actionable parcel" rule (issue #75, Technical/UX
 * risks — "no fabricated top parcel"): rank by Shapira Formula recommendation
 * (BID beats REVIEW beats SKIP beats UNKNOWN, same engine /radar uses), tie
 * broken by soonest auction_date. Given the same rows, this always returns
 * the same parcel — no randomness, no invented data.
 */
export function pickTopParcel(rows: CandidateAuctionRow[]): TopParcel | null {
  if (rows.length === 0) return null

  const scored = rows.map((r) => {
    const justValue = r.market_value ?? r.assessed_value
    const score = getRecommendation(justValue, r.opening_bid)
    return { row: r, score }
  })

  scored.sort((a, b) => {
    const rankDiff = RANK[a.score.recommendation] - RANK[b.score.recommendation]
    if (rankDiff !== 0) return rankDiff
    const aDate = a.row.auction_date ?? '9999-12-31'
    const bDate = b.row.auction_date ?? '9999-12-31'
    return aDate.localeCompare(bDate)
  })

  const best = scored[0]
  return {
    id: best.row.id,
    property_address: best.row.property_address,
    auction_date: best.row.auction_date,
    sale_type: best.row.sale_type,
    opening_bid: best.row.opening_bid,
    market_value: best.row.market_value ?? best.row.assessed_value,
    recommendation: best.score.recommendation,
    county: best.row.county,
  }
}
