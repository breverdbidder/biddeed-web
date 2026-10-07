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
 * page could respond. Now it arrives as HTML. The map module (scroll-
 * triggered) is the only client component; the plan cards' ask-Deed buttons
 * work by delegation (DeedHome).
 *
 * The evidence sections and the footer are `content-visibility: auto`
 * (PageSpeed pass 4, 2026-10-07): they are ~60% of the page's DOM (345 of 567
 * elements on a phone) yet all start a screen or more below the fold, and the
 * browser laid all of them out before the first paint. Skipping them until
 * they near the viewport halved the first layout - measured at 4x CPU
 * throttle on a phone viewport: 54-86 ms -> 31-39 ms. Pixel-identical on
 * desktop (9 viewport frames); on a phone the pricing cards sit 1 px lower.
 * The intrinsic sizes are rough per-breakpoint averages so the scrollbar
 * barely moves; `auto` remembers each section's real height once rendered.
 * A link to a section (/#pricing, /#d4d, /#projects) turns the skipping off
 * for the whole stack (`:has(:target)`): the page scrolls smoothly, and
 * placeholder heights above the target would make it overshoot (measured:
 * /#pricing landed 911 px past the heading on a phone, 628 px on desktop).
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
      <div className="space-y-20 pb-20 pt-10 sm:space-y-28 sm:pt-14 [&>*]:[content-visibility:auto] [&>*]:[contain-intrinsic-size:auto_1500px] sm:[&>*]:[contain-intrinsic-size:auto_900px] [&:has(:target)>*]:[content-visibility:visible]">
        <Proof />
        <Founder />
        <HowItWorks />
        <FieldRoutes />
        <RehabProjects />
        <Pricing />
      </div>
      <div className="[content-visibility:auto] [contain-intrinsic-size:auto_560px] sm:[contain-intrinsic-size:auto_330px]">
        <Footer />
      </div>
    </>
  )
}
