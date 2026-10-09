'use client'

import { useAuctionCounts } from '@/components/shell/useAuctionCounts'

/**
 * "2,794 live right now across 61 counties, " for the home page plans
 * section, from the same /api/auctions/summary request the rest of the page
 * already makes (useAuctionCounts memoises it per page, so this island adds
 * no request).
 *
 * The section used to print "2,911 live right now across 60 counties" as a
 * string literal - the PROMISE-3 defect (issue 20518) fixed on /pricing but
 * never on the home page copy of the same paragraph. Measured 2026-10-09 the
 * live figures were 2,794 across 61. When the summary is unavailable the
 * phrase renders nothing rather than a number nobody measured.
 */
export default function LiveCountsPhrase() {
  const { upcoming, counties } = useAuctionCounts()
  if (!upcoming || !counties) return null
  return <>{upcoming.toLocaleString('en-US')} live right now across {counties} counties, </>
}
