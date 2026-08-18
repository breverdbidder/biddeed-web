import type { Metadata } from 'next'
import AuctionsLayout from '@/components/auctions/AuctionsLayout'

// Rendered per-request so middleware can stamp a CSP nonce onto every script
// tag. The site-wide CSP uses 'strict-dynamic', under which the browser trusts
// ONLY nonced scripts - and statically prerendered HTML is built before any
// middleware runs, so it can never carry a nonce. Prerendering this route
// silently ships a page whose scripts are all refused. See middleware.ts.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'AuctionRadar — BidDeed.AI',
  description:
    'Live Florida foreclosure and tax deed auctions: map, calendar, table and spreadsheet views across 67 counties.',
}

/**
 * The root used to be a two-line placeholder, so the deployed site looked empty
 * even though the whole application was sitting one path away at /auctions.
 * AuctionRadar is the product; it belongs at the front door.
 */
export default function Home() {
  return (
    <div className="bg-[#020617] min-h-screen">
      <div className="border-b border-slate-700/50 bg-bd-navy-700/80 px-4 sm:px-6 pt-6 pb-4 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-white">
          Bid<span className="text-bd-orange">Deed</span>.AI &middot; AuctionRadar
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Florida foreclosure &amp; tax deed auctions &mdash; live data
        </p>
      </div>
      <AuctionsLayout />
    </div>
  )
}
