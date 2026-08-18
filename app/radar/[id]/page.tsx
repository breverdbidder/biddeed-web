import AuctionDetail from '@/components/auctions/AuctionDetail'

/**
 * Auction detail, reachable at /radar/:id.
 *
 * It used to be /auctions/:id, which now collides with the Worker's JSON API
 * at the apex; the whole workspace moved under /radar instead.
 *
 * force-dynamic for the CSP nonce — a prerendered page can never carry one and
 * renders blank under 'strict-dynamic'. See middleware.ts.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return {
    title: `Auction #${id} — BidDeed.AI`,
    description: 'Auction detail — property info, parcel data, zoning, and map.',
  }
}

export default async function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="bg-[#020617]">
      <AuctionDetail auctionId={id} />
    </div>
  )
}
