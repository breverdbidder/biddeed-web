import type { Metadata } from 'next'
import Landing from '@/components/home/Landing'

/**
 * force-dynamic. middleware.ts mints a per-request CSP nonce and Next reads it
 * by parsing the content-security-policy header off the INCOMING request.
 * Static HTML is produced at build time, before any middleware runs, so its
 * script tags can never carry a nonce and 'strict-dynamic' refuses every one
 * of them — which is exactly how this route shipped blank once before. Do not
 * remove this line: the landing page carries the whole conversion funnel.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'BidDeed.AI — Auction Intelligence',
  description:
    'Agentic auction intelligence for Florida foreclosure and tax deed investors: live sale data, parcel research and reports.',
}

export default function Home() {
  return <Landing />
}
