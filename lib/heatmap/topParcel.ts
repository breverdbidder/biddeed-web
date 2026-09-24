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

/**
 * The county's next upcoming auction with a street address: soonest
 * auction_date, then id, so the same rows always give the same parcel and
 * nothing is invented (issue #75, "no fabricated top parcel").
 *
 * SIGNAL-15 (2026-09-24): this used to rank by the Shapira formula's
 * BID / REVIEW / SKIP call and print that call on the public map, while the
 * auction page withholds the same verdict on every tier (report policy v1,
 * app/api/auctions/[id]/route.ts). Ranking by the withheld call and naming
 * the winner "strongest actionable" disclosed it anyway, so the pick is now
 * by date and carries no verdict.
 */
export function pickTopParcel(rows: CandidateAuctionRow[]): TopParcel | null {
  const withAddress = rows.filter((r) => (r.property_address ?? '').trim() !== '')
  const pool = withAddress.length > 0 ? withAddress : rows
  if (pool.length === 0) return null
  const best = [...pool].sort((a, b) => {
    const aDate = a.auction_date ?? '9999-12-31'
    const bDate = b.auction_date ?? '9999-12-31'
    return aDate.localeCompare(bDate) || a.id.localeCompare(b.id)
  })[0]
  return {
    id: best.id,
    property_address: best.property_address,
    auction_date: best.auction_date,
    sale_type: best.sale_type,
    opening_bid: best.opening_bid,
    market_value: best.market_value ?? best.assessed_value,
    county: best.county,
  }
}
