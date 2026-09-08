import type { Metadata } from 'next'
import AuctionsLayout from '@/components/auctions/AuctionsLayout'

// Rendered per-request so middleware can stamp a CSP nonce onto every script
// tag. The site-wide CSP uses 'strict-dynamic', under which the browser trusts
// ONLY nonced scripts - and statically prerendered HTML is built before any
// middleware runs, so it can never carry a nonce. Prerendering this route
// silently ships a page whose scripts are all refused. See middleware.ts.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Auction Calendar — BidDeed.AI',
  description: 'Live foreclosure and tax deed auction calendar across Florida counties.',
  alternates: {
    canonical: 'https://biddeed.ai/auctions',
  },
}

export default function AuctionsPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="border-b border-border bg-card px-4 sm:px-6 pt-6 pb-4 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground">Auction Calendar</h1>
        <p className="text-muted-foreground text-base mt-1">Florida foreclosure &amp; tax deed auctions — live data</p>
      </div>
      {/* This page already carries the page's one h1 above — AuctionsLayout's
          own heading would be a second h1. /radar has no page-level h1 of its
          own and relies on AuctionsLayout for it, so the heading is opt-out,
          not opt-in. */}
      <AuctionsLayout showHeading={false} />
    </div>
  )
}
