import type { Metadata } from 'next'
import DeedHome from '@/components/deed-home/DeedHome'

/**
 * force-dynamic. middleware.ts mints a per-request CSP nonce and Next reads it
 * by parsing the content-security-policy header off the INCOMING request.
 * Static HTML is produced at build time, before any middleware runs, so its
 * script tags can never carry a nonce and 'strict-dynamic' refuses every one
 * of them — which is exactly how this route shipped blank once before. Do not
 * remove this line: the home page carries the whole conversion funnel.
 *
 * The home page reads ?c=<thread id> with useSearchParams; force-dynamic also
 * means it needs no Suspense boundary for that (see AppShell for why a
 * boundary here would be a hydration hazard).
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'BidDeed.AI — Know your number before the gavel',
  description:
    'AI-powered foreclosure and tax deed auction intelligence for all 67 Florida counties. Ask Deed what is coming to auction, what to bid, and what the zoning allows — before you bid.',
}

export default function Home() {
  return <DeedHome />
}
