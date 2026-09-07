import type { Metadata } from 'next'
import { requireCapability } from '@/lib/tier/server'
import D4DLocked from '@/components/d4d/D4DLocked'
import D4DWorkspace from '@/components/d4d/D4DWorkspace'

// force-dynamic: middleware mints a per-request CSP nonce (see middleware.ts)
// and requireCapability() reads the live Clerk session on every load — a
// signed-in Pro user and a signed-out visitor must never share a cached page.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Drive for Dollars — BidDeed.AI',
  description:
    'Build a field route from upcoming Florida foreclosure and tax deed lots, drive it hands-free, and log what you find off the auction calendar.',
}

export default async function D4DPage() {
  const check = await requireCapability('build_d4d_route')

  if (!check.allowed) {
    return <D4DLocked check={check} />
  }

  return <D4DWorkspace />
}
