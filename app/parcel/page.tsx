import type { Metadata } from 'next'
import ParcelDesk from '@/components/parcel/ParcelDesk'
import { parsePrefill } from '@/lib/parcel-prefill'

// force-dynamic: middleware mints a per-request CSP nonce (see middleware.ts),
// and this route reads the auction prefill from the query string per request
// (/parcel?mca_id=&county=&address=&opening_bid=&assessed=, from a map pin
// card). A static route with search params, not a dynamic segment: this
// OpenNext deploy 404s dynamic page segments outside the prerender manifest
// (see app/preview/page.tsx). '/parcel(.*)' is already public in middleware.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Parcel: Auction Underwriting Desk | BidDeed.AI',
  description:
    'Underwrite a Florida auction lot before you bid: rental, flip and BRRRR math on your own numbers, with a BID, REVIEW or SKIP call. Runs in your browser.',
  alternates: {
    canonical: 'https://biddeed.ai/parcel',
  },
}

export default async function ParcelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const prefill = parsePrefill(await searchParams)
  return <ParcelDesk prefill={prefill} />
}
