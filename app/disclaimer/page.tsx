/**
 * biddeed.ai/disclaimer — legal + zoning trust page (ZW-P0-002).
 *
 * Live traffic today is still served by the Cloudflare Worker
 * (`cli-anything-biddeed` DISCLAIMER_HTML). This Next route is the app-shell
 * source of truth so middleware allowlisting, BuyReportCheckout, and auction
 * stamps share one URL that survives a Worker → Next cutover.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Disclaimer — BidDeed.AI',
  description:
    'BidDeed.AI is an information and analytics platform, not legal, financial, or investment advice — read the full disclaimer before bidding.',
  alternates: {
    canonical: 'https://biddeed.ai/disclaimer',
  },
}

export default function DisclaimerPage() {
  return (
    <section
      className="mx-auto min-w-0 w-full max-w-3xl space-y-8 px-4 py-10 sm:px-6 lg:px-8"
      aria-labelledby="disclaimer-title"
    >
      <header className="border-b border-border pb-6">
        <a
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          ← Back to home
        </a>
        <h1
          id="disclaimer-title"
          className="font-display mt-4 text-3xl font-medium leading-tight tracking-tight text-foreground sm:text-4xl"
        >
          Disclaimer
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated September 23, 2026</p>
      </header>

      <div
        role="note"
        className="rounded-xl border border-border border-l-4 border-l-primary bg-card p-5 text-sm leading-7 text-foreground"
      >
        <p>
          <strong>Not legal advice.</strong> BidDeed.AI is an information and analytics platform, not a
          law firm, title company, real-estate brokerage, or financial advisor. Nothing on this site or
          from our chatbot, reports, or the SIGNAL$ Max Bid analysis constitutes legal, financial,
          investment, tax, or title advice, and no attorney-client, fiduciary, or brokerage relationship
          is created. Foreclosure and tax-deed investing carries substantial risk of loss, including
          total loss of your bid. Auction data, valuations, and bid estimates are informational, may be
          incomplete or inaccurate, and must be independently verified. Always consult a licensed
          Florida attorney and conduct your own due diligence before bidding.
        </p>
      </div>

      <div className="space-y-6 text-base leading-7 text-muted-foreground">
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">Informational purpose only</h2>
          <p>
            All content, data, analytics, county intelligence, auction calendars, and the SIGNAL$ Max Bid
            Formula are provided for general informational purposes. Property values, opening bids,
            judgment amounts, liens, and outcomes are sourced from public records and third parties and
            are provided &quot;as is&quot; without warranty of accuracy, completeness, or fitness for a
            particular purpose.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">Zoning and land-use data</h2>
          <p>
            Zoning codes, future land use, dimensional standards (setbacks, height, density, FAR,
            parking, permitted uses, overlays), and related parcel enrichment are informational only.
            Verified jurisdiction standards cite the researched land development code when available.
            Pattern estimates derived from a zone-code label are orientation aids, not that
            jurisdiction&apos;s adopted standards. Zoning ordinances change; coverage and research depth
            vary by Florida county and municipality. Always verify with the local planning or zoning
            department (and counsel) before any development, construction, or investment decision.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">No guarantee of results</h2>
          <p>
            Past results (including any example outcomes shown on this site) do not guarantee future
            performance. A &quot;max bid&quot; figure is an estimate, not a recommendation to bid, and not a
            prediction of sale price or profit.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">Independent verification required</h2>
          <p>
            You are solely responsible for verifying all information with the county clerk, property
            appraiser, planning department, and a licensed attorney before participating in any auction
            or relying on zoning or dimensional data.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, Everest Capital USA, BidDeed.AI, ZoneWise.AI, and
            their affiliates are not liable for damages arising from use of or reliance on information
            on this service — including bidding decisions, auction outcomes, or zoning interpretations.
          </p>
        </section>
      </div>

      <p className="border-t border-border pt-6 text-sm text-muted-foreground">
        © 2026 BidDeed.AI · Everest Capital USA ·{' '}
        <a href="/terms" className="font-semibold text-primary underline-offset-4 hover:underline">
          Terms
        </a>{' '}
        ·{' '}
        <a href="/privacy" className="font-semibold text-primary underline-offset-4 hover:underline">
          Privacy
        </a>{' '}
        ·{' '}
        <a href="/support" className="font-semibold text-primary underline-offset-4 hover:underline">
          Support
        </a>
      </p>
    </section>
  )
}
