'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, FolderPlus, Lock } from 'lucide-react'

import { formatCountyLabel } from '@/lib/counties'
import { apiUrl } from '@/lib/api'
import { tierAtLeast } from '@/lib/tier/rank'
import { PLANS } from '@/components/deed-home/LandingSections'
import { createViewerResolver, type TierAnswer, type ViewerState } from '@/lib/auctions/viewer-state'
import { createListingCache, decideOffer, reportLink } from '@/lib/buy-report/offer'
import type { Auction } from '@/types/auctions'

/**
 * The one detail card every auction pin opens, whichever surface the pin was
 * on: /radar (map, table, sidebar), /maps and the homepage map. Extracted
 * from AuctionsLayout's selected-auction modal 2026-09-18, when the same
 * card had to serve the homepage and /maps pins too (owner decision: "The
 * pin from the home page should give this minimum data as well for each
 * property").
 *
 * Tier-aware field release (owner decision 2026-09-18): the public card is
 * a conversion surface, not a broken-data report. Anonymous viewers see the
 * free-to-browse facts with "Unlock with Free" on the free-member fields
 * (canon: "free members see the published number on every property");
 * signed-in free viewers see those and get "Unlock with Investor" on the
 * Investor fields (canon: "Plaintiff identity", "Unlimited property
 * cards"); Investor and above see every value. Genuine gaps for entitled
 * viewers render "Not yet enriched" - honest about our pipeline, never an
 * invented value and never a claim that county records lack the field (that
 * phrasing is reserved for confirmed source-truth absence, which the pin
 * feed does not establish). Parties are auction-type-appropriate -
 * plaintiff/defendant are foreclosure concepts, so a tax deed shows its
 * certificate number and owner instead. (There is no defendant column on
 * multi_county_auctions at all; the old card rendered it as an em-dash on
 * every row.)
 */

const investorPlan = PLANS.find((p) => p.name === 'Investor')
const INVESTOR_PRICE_LABEL = investorPlan ? `${investorPlan.price}${investorPlan.per}` : ''

/**
 * Asked again on every card open (lib/auctions/viewer-state.ts says why: an
 * answer kept for the whole session outlived a visitor's sign-up). Fails
 * closed to 'anonymous' (locks shown).
 */
const viewerResolver = createViewerResolver(
  () => fetch(apiUrl('/api/viewer/tier'), { cache: 'no-store' }).then((r) => r.json() as Promise<TierAnswer>),
  (tierId) => tierAtLeast(tierId, 'investor')
)

function useViewerState(): ViewerState {
  const [viewer, setViewer] = useState<ViewerState>(() => viewerResolver.last() ?? 'anonymous')
  useEffect(() => {
    let live = true
    viewerResolver.resolve().then((v) => {
      if (live) setViewer(v)
    })
    return () => {
      live = false
    }
  }, [])
  return viewer
}

/**
 * Whether the $25 SIGNAL$ report is on sale for this auction: the same county
 * listing /buy-report checks (tax deeds in the certified counties, clerk
 * exclusions applied). 28 Sep 2026: the map is where signed-in members spend
 * their time (PostHog), and its card offered only the $99/mo Investor plan -
 * no way to buy the one-off report for the property on screen. Shown only
 * for a listed auction, so the link never leads to a report that is not sold.
 */
const storefrontListing = createListingCache((slug) =>
  fetch(apiUrl(`/buy-report/auctions?county=${encodeURIComponent(slug)}`)).then((r) => (r.ok ? r.json() : null))
)

function useReportOnSale(auction: Auction): boolean {
  const [onSale, setOnSale] = useState(false)
  useEffect(() => {
    let live = true
    setOnSale(false)
    if (!auction.case_number) return
    storefrontListing(auction.county).then((listing) => {
      if (live) setOnSale(decideOffer(listing, auction.case_number, auction.auction_date).state === 'sellable')
    })
    return () => {
      live = false
    }
  }, [auction.id, auction.county, auction.case_number, auction.auction_date])
  return onSale
}

function Field({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  const has = value != null && value !== ''
  return (
    <div>
      <p className="text-muted-foreground dark:text-muted-foreground">{label}</p>
      {has ? (
        <p className={`text-foreground dark:text-white font-medium ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
      ) : (
        <p className="text-muted-foreground/70 dark:text-muted-foreground/70 text-xs italic">Not yet enriched</p>
      )}
    </div>
  )
}

/**
 * A gated field on the public card: the label stays (the card previews the
 * category) and the value is the conversion CTA, never a blank or a
 * broken-looking placeholder.
 */
function LockedField({ label, cta, href }: { label: string; cta: string; href: string }) {
  return (
    <div>
      <p className="text-muted-foreground dark:text-muted-foreground">{label}</p>
      <a href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
        <Lock className="size-3" aria-hidden />
        {cta}
      </a>
    </div>
  )
}

export default function AuctionPinCard({ auction, onClose }: { auction: Auction; onClose: () => void }) {
  const isTaxDeed = (auction.sale_type || auction.auction_type) === 'tax_deed'
  const justValue = auction.market_value ?? auction.assessed_value ?? null
  const viewer = useViewerState()
  const reportOnSale = useReportOnSale(auction)
  const isAnonymous = viewer === 'anonymous'
  const isInvestor = viewer === 'investor'
  // Free-member fields (assessed value, parcel ID) gate on signup; Investor
  // fields (year built, living area, parties, certificate/case) gate on the
  // Investor tier. Field classes: lib/auctions/pin-contract PIN_FIELD_RELEASE.
  const freeCta = { cta: 'Unlock with Free', href: '/sign-up' }
  const investorCta = { cta: 'Unlock with Investor', href: '/subscribe?tier=investor' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card dark:bg-card border border-border dark:border-border rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground dark:text-white">
              {auction.property_address || 'No Address'}
            </h2>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              {formatCountyLabel(auction.county)} County
              {auction.case_number ? <> &middot; {auction.case_number}</> : null}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground dark:text-muted-foreground">Type</p>
            <p className={`font-medium ${auction.auction_type === 'foreclosure' ? 'text-primary' : 'text-foreground'}`}>
              {auction.auction_type === 'foreclosure' ? 'Foreclosure' : 'Tax Deed'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground dark:text-muted-foreground">Auction Date</p>
            <p className="text-foreground dark:text-white font-medium tabular">
              {auction.auction_date
                ? new Date(auction.auction_date + 'T00:00:00').toLocaleDateString()
                : '—'}
            </p>
          </div>
          {isAnonymous ? (
            <LockedField label="Assessed Value" {...freeCta} />
          ) : (
            <div>
              <p className="text-muted-foreground dark:text-muted-foreground">Assessed Value</p>
              <p className="text-foreground dark:text-white font-medium tabular">
                {justValue
                  ? '$' + justValue.toLocaleString('en-US', { maximumFractionDigits: 0 })
                  : '—'}
              </p>
            </div>
          )}
          {isInvestor ? (
            <Field label="Year Built" value={auction.year_built} />
          ) : (
            <LockedField label="Year Built" {...investorCta} />
          )}
          {isTaxDeed ? (
            <>
              {isInvestor ? (
                <Field label="Certificate #" value={auction.cert_number} mono />
              ) : (
                <LockedField label="Certificate #" {...investorCta} />
              )}
              {isInvestor ? (
                <Field label="Owner" value={auction.owner_name} />
              ) : (
                <LockedField label="Owner" {...investorCta} />
              )}
            </>
          ) : (
            <>
              {isInvestor ? (
                <Field label="Plaintiff" value={auction.plaintiff} />
              ) : (
                <LockedField label="Plaintiff" {...investorCta} />
              )}
              {/* No defendant column exists on multi_county_auctions; render
                  the row only when a future feed actually supplies one. */}
              {isInvestor && auction.defendant ? <Field label="Defendant" value={auction.defendant} /> : null}
            </>
          )}
          {isInvestor ? (
            <Field
              label="Living Area"
              value={auction.living_area_sqft ? auction.living_area_sqft.toLocaleString() + ' sqft' : null}
            />
          ) : (
            <LockedField label="Living Area" {...investorCta} />
          )}
          {isAnonymous ? (
            <LockedField label="Parcel ID" {...freeCta} />
          ) : (
            <Field label="Parcel ID" value={auction.parcel_id} mono />
          )}
        </div>

        {auction.is_vacant_land && (
          <div className="mt-4 px-3 py-2 bg-muted dark:bg-card rounded-md">
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">
              This parcel is classified as <span className="font-medium text-foreground dark:text-muted-foreground">vacant land</span> with no situs address.
            </p>
          </div>
        )}

        {auction.address_status && (
          <div className="mt-3 px-3 py-2 bg-foreground/10 dark:bg-foreground/15/20 rounded-md">
            <p className="text-xs text-foreground dark:text-foreground">
              Status: {auction.address_status.replace(/_/g, ' ')}
            </p>
          </div>
        )}

        {reportOnSale ? (
          <a
            href={reportLink(auction)}
            className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
          >
            Buy SIGNAL$ report for this auction - $25 <ArrowRight className="size-4" aria-hidden />
          </a>
        ) : null}

        {viewer !== 'investor' ? (
          <a
            href={isAnonymous ? '/sign-up' : '/subscribe?tier=investor'}
            className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Lock className="size-4" aria-hidden />
            {isAnonymous
              ? 'Unlock with Free - assessed value and parcel ID'
              : `Unlock with Investor${INVESTOR_PRICE_LABEL ? ' - ' + INVESTOR_PRICE_LABEL : ''}: year built, living area, parties and case details`}
          </a>
        ) : null}

        {/* S2 hook (issue #19847 Pass 3) — same /chat?new_project_county=
            mechanism every other hook point across the product uses. */}
        <a
          href={`/chat?new_project_county=${encodeURIComponent(auction.county || '')}&case=${encodeURIComponent(auction.case_number || '')}&source=pin_card`}
          className="mt-4 flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-primary dark:text-primary underline hover:no-underline"
        >
          <FolderPlus className="size-4" aria-hidden />
          New project from this
        </a>
      </div>
    </div>
  )
}
