import type { Metadata } from 'next'
import BuyReportCheckout from '@/components/buy-report/BuyReportCheckout'

// force-dynamic: middleware mints a per-request CSP nonce (see middleware.ts),
// and this route reads the `mca_id`/`county`/`address`/`date` query params
// (property-card prefill from chat) per request.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Buy One SIGNAL$ Property Report — $25 | BidDeed.AI',
  description:
    'ZoneWise zoning, comps, value band, and red flags for one auction. Max-bid and ML figures stay Withheld until the rebuilt model is validated. One-time $25, no subscription.',
  alternates: {
    canonical: 'https://biddeed.ai/buy-report',
  },
}

export default function BuyReportPage() {
  return <BuyReportCheckout />
}
