import { NextResponse } from 'next/server'
import { getCallerViewer } from '@/lib/tier/server'

export const dynamic = 'force-dynamic'

/**
 * The pin card's viewer state (tier-aware field release, owner decision
 * 2026-09-18). The card renders "Unlock with Free" / "Unlock with Investor"
 * CTAs from this; the DATA-level gate lives in /api/auctions and
 * /api/auctions/map, which redact the same fields server-side, so this
 * endpoint only ever drives presentation. no-store: the response is
 * per-viewer.
 */
export async function GET() {
  const viewer = await getCallerViewer()
  return NextResponse.json(
    { tier_id: viewer.tierId, signed_in: viewer.signedIn },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
