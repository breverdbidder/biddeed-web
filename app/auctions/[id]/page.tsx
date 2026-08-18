import AuctionDetail from '@/components/auctions/AuctionDetail'

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
    <div className="bg-[#020617] min-h-screen">
      <AuctionDetail auctionId={id} />
    </div>
  )
}
