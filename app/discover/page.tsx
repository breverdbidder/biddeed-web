import type { Metadata } from 'next'
import AppShell from '@/components/shell/AppShell'
import DiscoveryPage from '@/components/discovery/DiscoveryPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Discovery — BidDeed.AI',
  description: 'Search source-backed Florida foreclosure and tax deed auction inventory with coverage and freshness disclosures.',
}

export default function DiscoverRoute() {
  return (
    <AppShell>
      <DiscoveryPage />
    </AppShell>
  )
}
