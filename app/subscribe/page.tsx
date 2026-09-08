import type { Metadata } from 'next'
import SubscribeCheckout from '@/components/subscribe/SubscribeCheckout'

// force-dynamic: middleware mints a per-request CSP nonce (see middleware.ts),
// and this route reads the `tier`/`interval`/`ref` query params per request.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Subscribe — BidDeed.AI',
  description: 'Start your BidDeed.AI subscription — Investor, Pro, or Pro Plus. Secure checkout via Stripe.',
  alternates: {
    canonical: 'https://biddeed.ai/subscribe',
  },
}

export default function SubscribePage() {
  return <SubscribeCheckout />
}
