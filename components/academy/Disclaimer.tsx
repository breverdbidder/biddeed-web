import { Scale } from 'lucide-react'

/**
 * Florida investor-education disclaimer (#63). Rendered inline on lessons
 * that touch process, liens or money, and once site-wide in the Academy
 * layout footer (app/academy/layout.tsx).
 */
export function Disclaimer() {
  return (
    <p className="my-6 flex gap-3 rounded-xl border border-border bg-muted p-4 text-xs leading-5 text-muted-foreground not-prose">
      <Scale aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        BidDeed Academy is investor education for Florida foreclosure and tax deed auctions. It is not
        legal, financial, tax or investment advice, and it is not a title opinion or title insurance.
        Auction rules, deadlines and statutes change, and every property is different — verify what you
        read here against the county clerk, the official auction record and your own attorney or title
        professional before you bid. BidDeed.AI informs the human bidder; it never bids for you.
      </span>
    </p>
  )
}
