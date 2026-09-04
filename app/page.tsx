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
  title: 'BidDeed.AI — Every Foreclosure. Every Tax Deed. Yours To Win.',
  description:
    'AI-powered foreclosure and tax deed auction intelligence for all 67 Florida counties. Ask Deed what is coming to auction, what to bid, and what the zoning allows — before you bid.',
}

// Organization + WebSite + Person JSON-LD (SPR-06, issue #19826, CONTENT_SOP.md
// C0/SS5.7): `/` carried no schema at all before this. type="application/ld+json"
// is inert data, not executable script -- CSP script-src (see middleware.ts,
// 'strict-dynamic' + per-request nonce) does not apply to it, so no nonce is
// needed here. M7 founder carve-out: Ariel Shapira's own name/roles are the
// one person allowed in public assets.
const ORG_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'BidDeed.AI',
  url: 'https://biddeed.ai',
  sameAs: [
    'https://www.youtube.com/@biddeedai',
    'https://everestcapitalusa.com',
    'https://zonewise.ai',
  ],
}

const WEBSITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'BidDeed.AI',
  url: 'https://biddeed.ai',
}

const PERSON_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Ariel Shapira',
  jobTitle: 'Founder',
  url: 'https://biddeed.ai',
  sameAs: [
    'https://www.youtube.com/@biddeedai',
    'https://everestcapitalusa.com',
    'https://zonewise.ai',
  ],
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PERSON_JSON_LD) }}
      />
      <DeedHome />
    </>
  )
}
