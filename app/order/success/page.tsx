import SuccessClient from '@/components/success/SuccessClient'

/**
 * Must be dynamic, not prerendered.
 *
 * middleware.ts mints a per-request CSP nonce and Next only picks it up by
 * parsing the content-security-policy header off the *incoming* request. Static
 * HTML is generated at build time, before middleware ever runs, so it can never
 * carry a nonce -- and under 'strict-dynamic' a script without one does not
 * execute. A statically prerendered page here renders blank in production. That
 * exact failure already cost this app its home page once.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Order confirmed — BidDeed.AI',
  robots: { index: false, follow: false },
}

export default function SuccessPage() {
  return <SuccessClient />
}
