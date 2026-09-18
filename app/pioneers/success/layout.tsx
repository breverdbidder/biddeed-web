import type { Metadata } from 'next'

// The success page is a client component (useSearchParams), so its metadata
// lives here. A post-checkout page carries a session id in the URL and must
// never be indexed; the canonical is the bare path.
export const metadata: Metadata = {
  title: 'Pioneer seat confirmed — BidDeed.AI',
  description: 'Your 100 Pioneers seat is being confirmed and Pro access unlocked.',
  alternates: { canonical: 'https://biddeed.ai/pioneers/success' },
  robots: { index: false, follow: false },
}

export default function PioneerSuccessLayout({ children }: { children: React.ReactNode }) {
  return children
}
