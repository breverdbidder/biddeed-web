import { LIGHT as C } from '@/lib/design-tokens'
/**
 * Shapira Formula - Investment Scoring
 *
 * MAX_BID = (JUST_VALUE x 0.70) - REPAIRS - $10,000 - MIN($25,000, JUST_VALUE x 0.15)
 *
 * Recommendation:
 *   BID    -> max_bid / opening_bid >= 75%  (green)
 *   REVIEW -> max_bid / opening_bid 60-74%  (amber)
 *   SKIP   -> max_bid / opening_bid < 60%   (red)
 */

export type Recommendation = 'BID' | 'REVIEW' | 'SKIP' | 'UNKNOWN'

export interface ScoringResult {
  recommendation: Recommendation
  color: string
  maxBid: number | null
  ratio: number | null
}

export function calculateMaxBid(justValue: number | null, repairs: number = 0): number | null {
  if (!justValue || justValue <= 0) return null
  const result = Math.round(
    (justValue * 0.70) - repairs - 10000 - Math.min(25000, justValue * 0.15)
  )
  return Math.max(0, result)
}

export function getRecommendation(
  justValue: number | null,
  openingBid: number | null
): ScoringResult {
  const maxBid = calculateMaxBid(justValue)
  if (maxBid === null) {
    return { recommendation: 'UNKNOWN', color: C.border, ratio: null, maxBid: null }
  }

  const bid = openingBid || justValue || 0
  if (bid <= 0) {
    return { recommendation: 'UNKNOWN', color: C.border, ratio: null, maxBid }
  }

  const ratio = Math.round((maxBid / bid) * 100)

  if (ratio >= 75) {
    return { recommendation: 'BID', color: C.brand, ratio, maxBid }
  }
  if (ratio >= 60) {
    return { recommendation: 'REVIEW', color: C.navy, ratio, maxBid }
  }
  return { recommendation: 'SKIP', color: C.border, ratio, maxBid }
}

export function formatCurrency(val: number | null | undefined): string {
  if (val == null) return '--'
  return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
