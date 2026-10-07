import acsData from '@/lib/heatmap/data/fl-county-acs-2024.json'
import type { CountyAcsDataset } from '@/lib/heatmap/types'
import HomepageMapModule from './HomepageMapModule'
import { FieldRoutes, Footer, Founder, HowItWorks, Pricing, Proof, RehabProjects } from './LandingSections'

const ACS = acsData as unknown as CountyAcsDataset

/**
 * Everything below the hero on the empty home page, rendered on the server
 * and handed to DeedHome as its `below` slot (PageSpeed pass 3, 2026-10-07).
 * It used to be part of DeedHome's client bundle: ~25 KB of section code plus
 * the 18 KB ACS dataset, downloaded and executed on every phone before the
 * page could respond. Now it arrives as HTML; only the map module (scroll-
 * triggered) and the plan cards' ask-Deed buttons hydrate.
 */
export default function HomeBelowFold() {
  return (
    <>
      {/* ── Florida Auction Intelligence Map (issue #75) ─────────────────
          Below the hero, before the proof/story sections — the hero itself
          is untouched, no full control stack lives here (Amendment 2). */}
      <div className="pt-10 sm:pt-14">
        <HomepageMapModule countyCount={ACS.counties.length} vintageLabel={ACS.vintage_label} sourceTable={ACS.tables['B25077']} />
      </div>

      {/* ── Evidence ──────────────────────────────────────────────────── */}
      <div className="space-y-20 pb-20 pt-10 sm:space-y-28 sm:pt-14">
        <Proof />
        <Founder />
        <HowItWorks />
        <FieldRoutes />
        <RehabProjects />
        <Pricing />
      </div>
      <Footer />
    </>
  )
}
