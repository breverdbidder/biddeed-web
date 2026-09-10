import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getCountyBySlug } from '@/lib/counties'
import { getCountyAuctionData } from '@/lib/countyAuctionData'
import { GENERAL_FAQ } from '@/lib/countyLegal'

/**
 * /counties/:county -- programmatic county overview page (CMO Factory CP-C2,
 * issue #19821). Server-rendered: all figures come from a direct Supabase
 * RPC call in an async server component, so they are present in the HTML
 * the server sends (curl-visible), never fetched client-side after
 * hydration. See middleware.ts / app/layout.tsx for why 'force-dynamic' is
 * required for the CSP nonce to reach this route's JSON-LD <script>.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ county: string }>
}): Promise<Metadata> {
  const { county: slug } = await params
  const county = getCountyBySlug(slug)
  if (!county) return {}
  const data = await getCountyAuctionData(slug)
  const title = `${county.name} County, FL Foreclosure & Tax Deed Auctions | BidDeed.AI`
  const description =
    data.totalUpcoming > 0
      ? `${data.totalUpcoming} upcoming ${county.name} County auctions — ${data.foreclosureUpcoming} foreclosure, ${data.taxDeedUpcoming} tax deed, next on ${data.nextAnyDate}. What survives the sale, deposit rules, and how to bid.`
      : `${county.name} County, Florida foreclosure and tax deed auction guide — how sales run, deposit rules, and what survives the sale.`
  return {
    title,
    description,
    alternates: { canonical: `https://biddeed.ai/counties/${slug}` },
  }
}

export default async function CountyPage({
  params,
}: {
  params: Promise<{ county: string }>
}) {
  const { county: slug } = await params
  const county = getCountyBySlug(slug)
  if (!county) notFound()

  const [data, h] = await Promise.all([getCountyAuctionData(slug), headers()])
  const nonce = h.get('x-nonce') ?? undefined

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Dataset',
        name: `${county.name} County, Florida tax deed and foreclosure auctions`,
        description: `Live upcoming foreclosure and tax deed auction counts for ${county.name} County, Florida.`,
        url: `https://biddeed.ai/counties/${slug}`,
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: 'BidDeed.AI', url: 'https://biddeed.ai' },
        spatialCoverage: { '@type': 'Place', name: `${county.name} County, Florida, USA` },
        variableMeasured: ['auction_date', 'sale_type', 'foreclosure_count', 'tax_deed_count'],
      },
      {
        '@type': 'Place',
        name: `${county.name} County, Florida`,
        containedInPlace: { '@type': 'AdministrativeArea', name: 'Florida' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Counties', item: 'https://biddeed.ai/counties' },
          { '@type': 'ListItem', position: 2, name: `${county.name} County`, item: `https://biddeed.ai/counties/${slug}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: GENERAL_FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-400">
          <Link href="/counties" className="hover:text-amber-400">Counties</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-200">{county.name} County</span>
        </nav>

        <h1 className="text-2xl md:text-3xl font-bold text-slate-50">
          {county.name} County, Florida — Foreclosure &amp; Tax Deed Auctions
        </h1>

        <p className="mt-4 text-slate-300 leading-relaxed">
          {data.totalUpcoming > 0 ? (
            <>
              <strong className="text-amber-400">{data.totalUpcoming}</strong> upcoming {county.name} County auction
              {data.totalUpcoming === 1 ? '' : 's'} — {data.foreclosureUpcoming} foreclosure and {data.taxDeedUpcoming} tax
              deed, next on <strong className="text-slate-100">{data.nextAnyDate ?? '—'}</strong>. These are real auctions
              run by the {county.name} County Clerk of Court, not private listings.
            </>
          ) : (
            <>
              No upcoming auctions are scheduled for {county.name} County in our data right now. These are real auctions
              run by the {county.name} County Clerk of Court when scheduled — check back or see the full{' '}
              <Link href="/counties" className="text-amber-400 hover:underline">Florida auction calendar</Link>.
            </>
          )}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href={`/counties/${slug}/foreclosure`}
            className="block rounded-lg border border-red-900/50 bg-red-950/20 p-5 hover:border-red-700 transition-colors"
          >
            <div className="text-xs uppercase tracking-wide text-red-400">Foreclosure Auctions</div>
            <div className="mt-1 text-2xl font-bold text-slate-50">{data.foreclosureUpcoming}</div>
            <div className="mt-1 text-sm text-slate-400">
              Next: {data.nextForeclosureDate ?? 'none scheduled'} — deposit rules, what survives the sale →
            </div>
          </Link>
          <Link
            href={`/counties/${slug}/tax-deed`}
            className="block rounded-lg border border-amber-900/50 bg-amber-950/10 p-5 hover:border-amber-600 transition-colors"
          >
            <div className="text-xs uppercase tracking-wide text-amber-400">Tax Deed Sales</div>
            <div className="mt-1 text-2xl font-bold text-slate-50">{data.taxDeedUpcoming}</div>
            <div className="mt-1 text-sm text-slate-400">
              Next: {data.nextTaxDeedDate ?? 'none scheduled'} — deposit rules, what survives the sale →
            </div>
          </Link>
        </div>

        <section className="mt-10 border-t border-slate-800 pt-8">
          <h2 className="text-lg font-semibold text-slate-100">Frequently asked</h2>
          <dl className="mt-4 space-y-5">
            {GENERAL_FAQ.map((f) => (
              <div key={f.q}>
                <dt className="font-medium text-slate-200">{f.q}</dt>
                <dd className="mt-1 text-sm text-slate-400 leading-relaxed">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10 border-t border-slate-800 pt-8 flex flex-wrap gap-4 text-sm">
          <Link href="/radar" className="text-amber-400 hover:underline">See the live {county.name} County auction calendar →</Link>
          <Link href="/buy-report" className="text-amber-400 hover:underline">Get a SIGNAL$ Property Report →</Link>
          <Link href="/counties" className="text-slate-400 hover:underline">All 67 Florida counties →</Link>
        </section>

        <p className="mt-10 text-xs text-slate-500">
          For Everyone. Everywhere. Florida is the first state live on BidDeed.AI — the on-ramp for out-of-state and
          international bidders into real US county foreclosure and tax deed auctions run by county clerks of court.
        </p>
      </main>
    </div>
  )
}
