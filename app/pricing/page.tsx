import type { Metadata } from 'next'
import PricingTiers from '@/components/pricing/PricingTiers'

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

export default function PricingPage() {
  return <PricingTiers />
}
