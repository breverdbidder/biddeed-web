import type { Metadata } from 'next'
import PricingTiers from '@/components/pricing/PricingTiers'

// force-dynamic: middleware mints a per-request CSP nonce (see middleware.ts) —
// same reasoning as every other route in this app (app/d4d/page.tsx et al).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pricing — BidDeed.AI',
  description:
    'BidDeed.AI plans and pricing — Free, Investor, Pro and Pro Plus. Property intelligence, win-probability prediction, and PM tools for FL auctions.',
  alternates: {
    canonical: 'https://biddeed.ai/pricing',
  },
}

export default function PricingPage() {
  return <PricingTiers />
}
