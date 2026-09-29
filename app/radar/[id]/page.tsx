import AuctionDetail from '@/components/auctions/AuctionDetail'

/**
 * Auction detail, linked from the workspace at /radar/:id. The app also has a
 * /auctions/:id page; bare /auctions is the HTML calendar, and the legacy
 * /auctions?county=... JSON contract is a separate Cloudflare-router route.
 *
 * force-dynamic for the CSP nonce — a prerendered page can never carry one and
 * renders blank under 'strict-dynamic'. See middleware.ts.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Paid Auction Detail — BidDeed.AI',
  description: 'Paid auction intelligence for BidDeed.AI subscribers.',
}

export default async function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="bg-background">
      <AuctionDetail auctionId={id} />
    </div>
  )
}
