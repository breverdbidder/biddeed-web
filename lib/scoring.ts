/**
 * Display helpers for auction money values.
 *
 * The old fixed max-bid formula and its BID / REVIEW / SKIP ratio badges
 * lived here. They are retired (Ariel, 29 Sep 2026): BidDeed's max bid is the
 * SIGNAL$ Max Bid from the machine-learning model (third-party purchase
 * probability and predicted clearing price from prior auctions, plus the
 * plaintiff's price-on-the-dollar history against the final judgment on
 * foreclosures), withheld under report policy v1 until it passes validation.
 * Do not add a rule-of-thumb max bid or verdict back here.
 */

export function formatCurrency(val: number | null | undefined): string {
  if (val == null) return '--'
  return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
