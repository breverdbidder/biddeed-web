import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getCountyBySlug } from '@/lib/counties'
import { getCountyAuctionData } from '@/lib/countyAuctionData'
import { SALE_TYPE_LEGAL, SALE_TYPES, type SaleTypeSlug } from '@/lib/countyLegal'

/**
 * /counties/:county/:saleType -- foreclosure or tax-deed detail page (CMO
 * Factory CP-C2, issue #19821). Same server-render contract as the parent
 * /counties/:county page: live figures come from a direct Supabase RPC call
 * in the server component, not a client fetch.
 */
export const dynamic = 'force-dynamic'

function isSaleType(v: string): v is SaleTypeSlug {
  return (SALE_TYPES as readonly string[]).includes(v)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ county: string; saleType: string }>
}): Promise<Metadata> {
  const { county: slug, saleType } = await params
  const county = getCountyBySlug(slug)
  if (!county || !isSaleType(saleType)) return {}
  const legal = SALE_TYPE_LEGAL[saleType]
  const data = await getCountyAuctionData(slug)
  const count = saleType === 'foreclosure' ? data.foreclosureUpcoming : data.taxDeedUpcoming
  const nextDate = saleType === 'foreclosure' ? data.nextForeclosureDate : data.nextTaxDeedDate
  const title = `${county.name} County ${legal.label}s | BidDeed.AI`
  const description =
    count > 0
      ? `${count} upcoming ${county.name} County ${legal.label.toLowerCase()}s, next on ${nextDate}. Deposit rules, redemption period, and what survives the sale under ${legal.statuteChapter}.`
      : `${county.name} County ${legal.label.toLowerCase()} guide — deposit rules, redemption period, and what survives the sale under ${legal.statuteChapter}.`
  return {
    title,
    description,
    alternates: { canonical: `https://biddeed.ai/counties/${slug}/${saleType}` },
  }
}

export default async function CountySaleTypePage({
  params,
}: {
  params: Promise<{ county: string; saleType: string }>
}) {
  const { county: slug, saleType } = await params
  const county = getCountyBySlug(slug)
  if (!county || !isSaleType(saleType)) notFound()

  const legal = SALE_TYPE_LEGAL[saleType]
  const [data, h] = await Promise.all([getCountyAuctionData(slug), headers()])
  const nonce = h.get('x-nonce') ?? undefined

  const count = saleType === 'foreclosure' ? data.foreclosureUpcoming : data.taxDeedUpcoming
  const nextDate = saleType === 'foreclosure' ? data.nextForeclosureDate : data.nextTaxDeedDate
  const otherSlug: SaleTypeSlug = saleType === 'foreclosure' ? 'tax-deed' : 'foreclosure'
  const otherLabel = SALE_TYPE_LEGAL[otherSlug].label
  const otherCount = otherSlug === 'foreclosure' ? data.foreclosureUpcoming : data.taxDeedUpcoming

  const faq = [
    { q: `What happens to a mortgage after a ${county.name} County ${legal.label.toLowerCase()}?`, a: legal.whatSurvives },
    { q: `How much deposit do I need to bid on a ${county.name} County ${legal.label.toLowerCase()}?`, a: legal.deposit },
    { q: `Can I redeem/stop a ${county.name} County ${legal.label.toLowerCase()}?`, a: legal.redemption },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Dataset',
        name: `${county.name} County, Florida ${legal.label.toLowerCase()}s`,
        description: `Live upcoming ${legal.label.toLowerCase()} count for ${county.name} County, Florida.`,
        url: `https://biddeed.ai/counties/${slug}/${saleType}`,
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: 'BidDeed.AI', url: 'https://biddeed.ai' },
        spatialCoverage: { '@type': 'Place', name: `${county.name} County, Florida, USA` },
        variableMeasured: ['auction_date', 'opening_bid', 'case_number'],
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
          { '@type': 'ListItem', position: 3, name: `${legal.label}s`, item: `https://biddeed.ai/counties/${slug}/${saleType}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
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
          <Link href={`/counties/${slug}`} className="hover:text-amber-400">{county.name} County</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-200">{legal.label}s</span>
        </nav>

        <h1 className="text-2xl md:text-3xl font-bold text-slate-50">
          {county.name} County {legal.label}s — Florida
        </h1>

        <p className="mt-4 text-slate-300 leading-relaxed">
          {count > 0 ? (
            <>
              <strong className="text-amber-400">{count}</strong> upcoming {county.name} County {legal.label.toLowerCase()}
              {count === 1 ? '' : 's'}, next on <strong className="text-slate-100">{nextDate}</strong>. Run by the {county.name}{' '}
              County Clerk of Court under {legal.statuteChapter} — a real government auction, not a private listing.
            </>
          ) : (
            <>
              No upcoming {county.name} County {legal.label.toLowerCase()}s are scheduled in our data right now.
              These sales are run by the {county.name} County Clerk of Court under {legal.statuteChapter} when
              scheduled.
            </>
          )}
        </p>

        <section className="mt-8 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">How it runs</h2>
          <p className="mt-2 text-slate-300 leading-relaxed">{legal.howItRuns}</p>
        </section>

        <section className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Deposit &amp; payment</h2>
          <p className="mt-2 text-slate-300 leading-relaxed">{legal.deposit}</p>
        </section>

        <section className="mt-4 rounded-lg border-2 border-amber-900/60 bg-amber-950/10 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400">What survives the sale</h2>
          <p className="mt-2 text-slate-200 leading-relaxed">{legal.whatSurvives}</p>
        </section>

        <section className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Redemption</h2>
          <p className="mt-2 text-slate-300 leading-relaxed">{legal.redemption}</p>
        </section>

        <section className="mt-10 border-t border-slate-800 pt-8">
          <h2 className="text-lg font-semibold text-slate-100">Frequently asked</h2>
          <dl className="mt-4 space-y-5">
            {faq.map((f) => (
              <div key={f.q}>
                <dt className="font-medium text-slate-200">{f.q}</dt>
                <dd className="mt-1 text-sm text-slate-400 leading-relaxed">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10 border-t border-slate-800 pt-8 flex flex-wrap gap-4 text-sm">
          <Link href={`/counties/${slug}/${otherSlug}`} className="text-amber-400 hover:underline">
            {county.name} County {otherLabel}s ({otherCount}) →
          </Link>
          <Link href="/radar" className="text-amber-400 hover:underline">Live auction calendar →</Link>
          <Link href="/buy-report" className="text-amber-400 hover:underline">Get a SIGNAL$ Property Report →</Link>
          <Link href={`/counties/${slug}`} className="text-slate-400 hover:underline">Back to {county.name} County →</Link>
        </section>

        <p className="mt-10 text-xs text-slate-500">
          Educational information, not legal advice. Statute citations reflect Florida law as of the last review
          date; confirm current requirements with the {county.name} County Clerk of Court or a licensed Florida
          attorney before bidding. See our <Link href="/disclaimer" className="underline">disclaimer</Link>.
        </p>
      </main>
    </div>
  )
}
