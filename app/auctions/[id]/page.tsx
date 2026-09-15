import AuctionDetail from '@/components/auctions/AuctionDetail'

export const metadata = {
  title: 'Paid Auction Detail — BidDeed.AI',
  description: 'Paid auction intelligence for BidDeed.AI subscribers.',
}

export default async function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="bg-background min-h-screen">
      <AuctionDetail auctionId={id} />
    </div>
  )
}
