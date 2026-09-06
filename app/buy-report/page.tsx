'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const REPORT_SECTIONS = [
  'Executive decision summary',
  'Property identity and parcel match',
  'Auction date, time, and sale type',
  'Opening bid and verified financial metrics',
  'Assessed value and market context',
  'Equity and value-gap analysis',
  'Maximum-bid reasoning',
  'Risk and cancellation indicators',
  'Tax, lien, and title-search boundary',
  'Ownership and party context',
  'Auction and recording history',
  'Comparable-property context',
  'Property characteristics and media',
  'Neighborhood and location signals',
  'Bid strategy scenarios',
  'Sensitivity and downside cases',
  'Source citations and freshness',
  'Auction outcome scorecard',
]

type Auction = {
  id?: string | number
  county?: string | null
  case_number?: string | null
  property_address?: string | null
  city?: string | null
  auction_date?: string | null
  sale_type?: string | null
  opening_bid?: number | null
  judgment_amount?: number | null
  assessed_value?: number | null
  market_value?: number | null
  source_url?: string | null
}

function money(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return 'Not published'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value))
}

export default function BuyReportPage() {
  const [auction, setAuction] = useState<Auction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const query = useMemo(() => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search), [])
  const county = query.get('county') || ''
  const caseNumber = query.get('case_number') || ''
  const address = query.get('address') || ''

  useEffect(() => {
    const params = new URLSearchParams({ limit: '1', upcoming: 'true' })
    if (caseNumber) params.set('case_number', caseNumber)
    else if (county) params.set('county', county)
    fetch(`/api/auctions?${params.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Auction lookup failed (${response.status})`)
        return response.json()
      })
      .then((payload) => setAuction(payload.data?.[0] || null))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Auction lookup unavailable'))
      .finally(() => setLoading(false))
  }, [caseNumber, county])

  const property = auction || {
    county,
    case_number: caseNumber,
    property_address: address,
  }
  const displayAddress = property.property_address || address || 'Select a property from the auction calendar'
  const displayCounty = property.county || county || 'Florida'

  return (
    <main className="min-h-screen bg-secondary px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/radar" className="text-sm font-semibold text-primary underline underline-offset-4">Back to properties</Link>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-primary">BidDeed.AI · SIGNAL$ Property Report</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">The evidence behind your next bid.</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-foreground">A source-grounded preview of the 18-section S5 report. The full report preserves property identity, verified metrics, assumptions, citations, and decision context in one workflow.</p>
          </div>
          <div className="rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-bold text-primary">One report · $25</div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border border-border bg-card p-6 shadow-[0_18px_50px_rgba(58,39,26,0.09)] sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Property summary</p>
                <h2 className="mt-2 text-2xl font-black">{displayAddress}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{displayCounty} · Case {property.case_number || 'not published'}</p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">{property.sale_type || 'auction'}</span>
            </div>

            {loading && <p className="py-6 text-sm text-muted-foreground">Loading verified auction context…</p>}
            {error && <p className="mt-5 border border-primary/30 bg-secondary p-3 text-sm text-primary">{error}. The report remains available as a bounded preview; verify all figures against the cited authority before bidding.</p>}

            <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ['Auction date', property.auction_date || 'Not published'],
                ['Opening bid', money(property.opening_bid)],
                ['Judgment amount', money(property.judgment_amount)],
                ['Market value', money(property.market_value)],
              ].map(([label, value]) => <div key={label} className="border-l-2 border-primary pl-3"><dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-extrabold text-foreground">{value}</dd></div>)}
            </dl>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#report-sections" className="bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-bd-orange-600">Review all 18 sections</a>
              {property.source_url && <a href={property.source_url} target="_blank" rel="noreferrer" className="border border-border px-5 py-3 text-sm font-bold text-foreground">View source authority</a>}
            </div>
          </div>

          <aside className="bg-foreground p-6 text-primary-foreground shadow-[0_18px_50px_rgba(31,33,30,0.18)] sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Conversion path</p>
            <h2 className="mt-3 text-2xl font-black">Make the next decision with the full evidence set.</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">The paid S5 report unlocks the full property-specific analysis. This page intentionally shows only the verified preview context until checkout and entitlement proof are complete.</p>
            <button type="button" disabled className="mt-6 w-full cursor-not-allowed bg-primary px-5 py-3 text-sm font-bold text-white opacity-90">Checkout integration pending certification</button>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">Informational only — not legal, financial, or investment advice. A report is not title insurance, an appraisal, or a guarantee of outcome.</p>
          </aside>
        </section>

        <section id="report-sections" className="mt-10 border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">S5 report architecture</p><h2 className="mt-2 text-2xl font-black">All 18 sections are defined</h2></div>
            <span className="text-sm font-bold text-primary">18 / 18 mapped</span>
          </div>
          <div className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {REPORT_SECTIONS.map((section, index) => <div key={section} className="flex gap-3 border-b border-border pb-3 text-sm"><span className="font-black text-primary">{String(index + 1).padStart(2, '0')}</span><span className="font-semibold text-foreground">{section}</span></div>)}
          </div>
        </section>
      </div>
    </main>
  )
}
