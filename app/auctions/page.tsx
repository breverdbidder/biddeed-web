import type { Metadata } from 'next'
import AuctionsLayout from '@/components/auctions/AuctionsLayout'

export const metadata: Metadata = {
  title: 'Auction Calendar — BidDeed.AI',
  description: 'Live foreclosure and tax deed auction calendar across Florida counties.',
}

export default function AuctionsPage() {
  return (
    <div className="bg-[#020617] min-h-screen">
      <div className="border-b border-slate-700/50 bg-bd-navy-700/80 px-4 sm:px-6 pt-6 pb-4 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-white">Auction Calendar</h1>
        <p className="text-slate-400 text-sm mt-1">Florida foreclosure &amp; tax deed auctions — live data</p>
      </div>
      <AuctionsLayout />
    </div>
  )
}
