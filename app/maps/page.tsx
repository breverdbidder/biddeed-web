import type { Metadata } from 'next'
import MapsPageClient from '@/components/heatmap/MapsPageClient'
import { requireCapability } from '@/lib/tier/server'
import { parseHeatmapSearchParams } from '@/lib/heatmap/url-state'

// force-dynamic: middleware mints a per-request CSP nonce (see middleware.ts,
// same reasoning as every other route in this app). Also: this page's initial
// signed-in/entitlement state is per-request (Clerk session), so it cannot be
// statically prerendered anyway.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Florida Auction Intelligence Map — BidDeed.AI',
  description:
    'Live Florida foreclosure and tax deed auction pins over county market-direction layers. Free county view; accounts unlock ZIP-level and premium KPIs.',
  alternates: {
    canonical: 'https://biddeed.ai/maps',
  },
}

export default async function MapsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const rawParams = await searchParams
  const initialState = parseHeatmapSearchParams(rawParams)

  // One capability check gives us both signals: userId != null is the free
  // "signed in with Clerk" gate, allowed is the paid "view_premium_heatmap_layers"
  // gate. requireCapability() already treats a missing/misconfigured Clerk or
  // Supabase session as "not entitled" rather than throwing (see
  // lib/tier/server.ts) — the correct failure mode for a paywall badge.
  const check = await requireCapability('view_premium_heatmap_layers')

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <MapsPageClient
        initialState={initialState}
        signedIn={check.userId != null}
        paidEntitled={check.allowed}
      />
    </div>
  )
}
